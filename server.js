const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { Pool } = require("pg");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 8000);
const CHAT_MODEL = process.env.SILICONFLOW_CHAT_MODEL || "Pro/zai-org/GLM-4.7";
const ASR_MODEL = process.env.SILICONFLOW_ASR_MODEL || "FunAudioLLM/SenseVoiceSmall";
const API_KEY = process.env.SILICONFLOW_API_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";

const dbPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 5000),
      ssl: {
        rejectUnauthorized: false
      }
    })
  : null;

if (dbPool) {
  dbPool.on("error", (error) => {
    console.error("Database pool error:", error.message);
  });
  
  // 初始化行为日志表
  dbPool.query(`
    CREATE TABLE IF NOT EXISTS public.sandbox_behavior (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(255),
      user_id VARCHAR(255),
      action VARCHAR(255),
      detail JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(err => console.error("Failed to create sandbox_behavior table:", err));
  
  // 初始化对话日志表
  dbPool.query(`
    CREATE TABLE IF NOT EXISTS public.sandbox_dialog (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(255),
      data_type VARCHAR(50),
      user_id VARCHAR(255),
      user_input TEXT,
      assistant_output TEXT,
      status VARCHAR(50),
      meta JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(err => console.error("Failed to create sandbox_dialog table:", err));
}

const dialogQueue = [];
const behaviorQueue = [];
let flushInProgress = false;
const DB_FLUSH_INTERVAL_MS = Number(process.env.DB_FLUSH_INTERVAL_MS || 1000);
const DB_BATCH_SIZE = Number(process.env.DB_BATCH_SIZE || 50);

if (dbPool) {
  setInterval(() => {
    void flushDbQueues();
  }, DB_FLUSH_INTERVAL_MS).unref();
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".md": "text/markdown; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/chat") {
      await handleChat(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/transcribe") {
      await handleTranscribe(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/generate") {
      await handleGenerate(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/track") {
      await handleTrack(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method Not Allowed" });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Server Error", detail: error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/`);
});

async function handleChat(req, res) {
  if (!ensureApiKey(res)) {
    return;
  }

  const body = await readJson(req);
  const message = String(body.message || "").trim();
  const history = Array.isArray(body.history) ? body.history : [];
  const sessionId = normalizeSessionId(body.sessionId);
  const source = normalizeOptionalText(body.source) || "text";
  
  // 支持前端传入自定义 system prompt
  const defaultSystemPrompt = `你是一名面向中学生的编程助教"小智"。请用简洁、友好、鼓励式的中文回答。优先讲清分支结构（if/else）和循环结构（for/while）。代码示例必须使用 Python 语言，并用代码块格式（\`\`\`python\\n...\\n\`\`\`）。每次回答不超过 150 字，最多分 3 段，每段 1-2 句话，语言轻松易懂。`;
  const systemPrompt = body.systemPrompt || defaultSystemPrompt;

  const clientIp = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "";
  let userId = normalizeOptionalText(body.userId);
  if (!userId) {
    const { createHash } = require("crypto");
    userId = "device_" + createHash("md5").update(clientIp + userAgent).digest("hex").slice(0, 12);
  }

  if (!message) {
    sendJson(res, 400, { error: "Missing message" });
    return;
  }

  const messages = [
    {
      role: "system",
      content: systemPrompt
    },
    ...history
      .filter((item) => item && (item.role === "user" || item.role === "assistant"))
      .slice(-10)
      .map((item) => ({
        role: item.role,
        content: String(item.content || "")
      })),
    {
      role: "user",
      content: message
    }
  ];

  const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      temperature: 0.7
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    enqueueDialogRecord({
      sessionId,
      dataType: "chat",
      userId,
      userInput: message,
      assistantOutput: data.error?.message || data.message || "Unknown error",
      status: "failed",
      meta: {
        source,
        historyCount: history.length,
        model: CHAT_MODEL,
        ip: clientIp,
        userAgent
      }
    });
    sendJson(res, response.status, {
      error: "Chat request failed",
      detail: data.error?.message || data.message || "Unknown error"
    });
    return;
  }

  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    enqueueDialogRecord({
      sessionId,
      dataType: "chat",
      userId,
      userInput: message,
      assistantOutput: "Empty chat response",
      status: "failed",
      meta: {
        source,
        historyCount: history.length,
        model: CHAT_MODEL,
        ip: clientIp,
        userAgent
      }
    });
    sendJson(res, 502, { error: "Empty chat response" });
    return;
  }

  enqueueDialogRecord({
    sessionId,
    dataType: "chat",
    userId,
    userInput: message,
    assistantOutput: reply,
    status: "success",
    meta: {
      source,
      historyCount: history.length,
      model: CHAT_MODEL,
      ip: clientIp,
      userAgent
    }
  });

  sendJson(res, 200, { reply, sessionId });
}

async function handleGenerate(req, res) {
  if (!ensureApiKey(res)) return;

  const body = await readJson(req);
  const scene = String(body.scene || "").trim();
  const sessionId = normalizeSessionId(body.sessionId);
  const source = normalizeOptionalText(body.source) || "transfer";
  
  const clientIp = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "";
  let userId = normalizeOptionalText(body.userId);
  if (!userId) {
    const { createHash } = require("crypto");
    userId = "device_" + createHash("md5").update(clientIp + userAgent).digest("hex").slice(0, 12);
  }

  if (!scene) {
    sendJson(res, 400, { error: "Missing scene" });
    return;
  }

  const messages = [
    {
      role: "system",
      content: `你是一名中学编程教师，擅长把生活场景转化为编程练习题。
用户会给你描述一个生活场景，请生成一道完整的编程练习题。

严格按照以下格式输出，不要添加额外内容：

**题目名：** （一句话题目）

**知识类型：** （从以下选一个：分支判断 / 循环结构 / 综合应用）

**题目描述：**
（2-3句中文，清楚说明题目要求，要贴近原始场景）

**解题思路：**
（分3步，每步一句话，引导学生思考如何解题）

**示例代码：**
\`\`\`python
# 在这里写示例代码，注释用中文，变量名用英文，使用 print 进行输出
\`\`\`

**小提示：** （一句鼓励或补充说明）`
    },
    {
      role: "user",
      content: `生活场景：${scene}`
    }
  ];

  const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      temperature: 0.8
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    enqueueDialogRecord({
      sessionId,
      dataType: "transfer",
      userId,
      userInput: scene,
      assistantOutput: data.error?.message || data.message || "Unknown error",
      status: "failed",
      meta: {
        source,
        model: CHAT_MODEL,
        ip: clientIp,
        userAgent
      }
    });
    sendJson(res, response.status, {
      error: "Generate request failed",
      detail: data.error?.message || data.message || "Unknown error"
    });
    return;
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    enqueueDialogRecord({
      sessionId,
      dataType: "transfer",
      userId,
      userInput: scene,
      assistantOutput: "Empty generate response",
      status: "failed",
      meta: {
        source,
        model: CHAT_MODEL,
        ip: clientIp,
        userAgent
      }
    });
    sendJson(res, 502, { error: "Empty generate response" });
    return;
  }

  enqueueDialogRecord({
    sessionId,
    dataType: "transfer",
    userId,
    userInput: scene,
    assistantOutput: content,
    status: "success",
    meta: {
      source,
      model: CHAT_MODEL,
      ip: clientIp,
      userAgent
    }
  });

  sendJson(res, 200, { content, sessionId });
}

async function handleTranscribe(req, res) {
  if (!ensureApiKey(res)) {
    return;
  }

  const formData = await parseMultipartFormData(req);
  const file = formData.get("file");

  if (!file) {
    sendJson(res, 400, { error: "Missing audio file" });
    return;
  }

  const upstream = new FormData();
  upstream.set("file", file, file.name || "recording.webm");
  upstream.set("model", ASR_MODEL);

  const response = await fetch("https://api.siliconflow.cn/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`
    },
    body: upstream
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    sendJson(res, response.status, {
      error: "Transcription request failed",
      detail: data.error?.message || data.message || "Unknown error"
    });
    return;
  }

  const text = String(data.text || data.result || "").trim();
  if (!text) {
    sendJson(res, 502, { error: "Empty transcription response" });
    return;
  }

  sendJson(res, 200, { text });
}

async function handleTrack(req, res) {
  const body = await readJson(req);
  const clientIp = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "";
  const items = Array.isArray(body.events) ? body.events : [body];

  for (const item of items) {
    const sessionId = normalizeSessionId(item.sessionId);
    const action = String(item.action || "").trim();
    const detail = item.detail || {};
    if (!action) continue;

    let userId = normalizeOptionalText(item.userId);
    if (!userId) {
      const { createHash } = require("crypto");
      userId = "device_" + createHash("md5").update(clientIp + userAgent).digest("hex").slice(0, 12);
    }

    enqueueBehaviorRecord({
      sessionId,
      userId,
      action,
      detail: { ...detail, ip: clientIp, userAgent, createdAt: item.createdAt || Date.now() }
    });
  }

  sendJson(res, 200, { success: true });
}

function ensureApiKey(res) {
  if (!API_KEY) {
    sendJson(res, 500, {
      error: "Missing SILICONFLOW_API_KEY",
      detail: "Please set SILICONFLOW_API_KEY in .env before calling AI APIs."
    });
    return false;
  }

  return true;
}

function enqueueDialogRecord(record) {
  if (!dbPool) {
    return false;
  }
  dialogQueue.push(record);
  if (dialogQueue.length >= DB_BATCH_SIZE) {
    void flushDbQueues();
  }
  return true;
}

function enqueueBehaviorRecord(record) {
  if (!dbPool) {
    return false;
  }
  behaviorQueue.push(record);
  if (behaviorQueue.length >= DB_BATCH_SIZE) {
    void flushDbQueues();
  }
  return true;
}

async function flushDbQueues() {
  if (!dbPool || flushInProgress) {
    return;
  }

  flushInProgress = true;

  try {
    await flushDialogQueue();
    await flushBehaviorQueue();
  } finally {
    flushInProgress = false;
  }
}

async function flushDialogQueue() {
  if (!dialogQueue.length) {
    return;
  }

  const batch = dialogQueue.splice(0, DB_BATCH_SIZE);
  const values = [];
  const placeholders = batch.map((item, index) => {
    const offset = index * 7;
    values.push(
      item.sessionId || randomUUID(),
      item.dataType,
      item.userId,
      item.userInput,
      item.assistantOutput,
      item.status || "success",
      JSON.stringify(item.meta || {})
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}::jsonb)`;
  });

  try {
    await dbPool.query(
      `
        insert into public.sandbox_dialog (
          session_id,
          data_type,
          user_id,
          user_input,
          assistant_output,
          status,
          meta
        )
        values ${placeholders.join(", ")}
      `,
      values
    );
  } catch (error) {
    dialogQueue.unshift(...batch);
    console.error("Failed to flush dialog queue:", error.message);
  }
}

async function flushBehaviorQueue() {
  if (!behaviorQueue.length) {
    return;
  }

  const batch = behaviorQueue.splice(0, DB_BATCH_SIZE);
  const values = [];
  const placeholders = batch.map((item, index) => {
    const offset = index * 4;
    values.push(
      item.sessionId || randomUUID(),
      item.userId,
      item.action,
      JSON.stringify(item.detail || {})
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::jsonb)`;
  });

  try {
    await dbPool.query(
      `INSERT INTO public.sandbox_behavior (session_id, user_id, action, detail) VALUES ${placeholders.join(", ")}`,
      values
    );
  } catch (error) {
    behaviorQueue.unshift(...batch);
    console.error("Failed to flush behavior queue:", error.message);
  }
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const relativePath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
  const normalizedPath = path.normalize(path.join(__dirname, relativePath));

  if (!normalizedPath.startsWith(__dirname)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.stat(normalizedPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendJson(res, 404, { error: "Not Found" });
      return;
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    fs.createReadStream(normalizedPath).pipe(res);
  });
}

function sendJson(res, statusCode, payload) {
  if (res.writableEnded) {
    return;
  }

  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function parseMultipartFormData(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  
  const request = new Request("http://localhost", {
    method: "POST",
    headers: req.headers,
    body: buffer
  });

  return request.formData();
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function getClientIp(req) {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "";
}

function normalizeSessionId(value) {
  const text = String(value || "").trim();
  return text || randomUUID();
}

function normalizeOptionalText(value) {
  const text = String(value || "").trim();
  return text || null;
}
