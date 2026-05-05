// ────────────────────────────────────────────────
//  全局状态
// ────────────────────────────────────────────────
const state = {
  chatHistory: [],
  gameHistory: [],
  gameState: 0,
  activeTab: "view-ai-challenge",
  speechEnabled: false,
  mediaRecorder: null,
  mediaStream: null,
  audioChunks: [],
  isWaitingReply: false,
  isGenerating: false,
  sessionId: getOrCreateSessionId(),
  userId: getOrCreateUserId()
};

// ────────────────────────────────────────────────
//  DOM 引用
// ────────────────────────────────────────────────
const navTabs        = document.querySelectorAll(".nav-tab");
const viewSections   = document.querySelectorAll(".view-section");

const chatLog        = document.querySelector("#chatLog");
const commandInput   = document.querySelector("#commandInput");
const sendBtn        = document.querySelector("#sendBtn");
const resetChatBtn   = document.querySelector("#resetChatBtn");
const painInput      = document.querySelector("#painInput");
const generateBtn    = document.querySelector("#generateBtn");
const planOutput     = document.querySelector("#planOutput");
const voiceBtn       = document.querySelector("#voiceBtn");
const voiceStatus    = document.querySelector("#voiceStatus");
const speakToggleBtn = document.querySelector("#speakToggleBtn");
const quickButtons   = document.querySelectorAll(".chip-btn");

const exploreBtns    = document.querySelectorAll(".explore-btn");
const exploreIframe  = document.getElementById("exploreIframe");

const task1Log             = document.querySelector("#task1Log");
const task1Input           = document.querySelector("#task1Input");
const task1SendBtn         = document.querySelector("#task1SendBtn");
const resetTask1Btn        = document.querySelector("#resetTask1Btn");
const task1VoiceBtn        = document.querySelector("#task1VoiceBtn");
const task1SpeakToggleBtn  = document.querySelector("#task1SpeakToggleBtn");
const task1VoiceStatus     = document.querySelector("#task1VoiceStatus");

const task2Scenario        = document.querySelector("#task2Scenario");
const task2Design          = document.querySelector("#task2Design");
const task2Effect          = document.querySelector("#task2Effect");
const task2SendBtn         = document.querySelector("#task2SendBtn");
const resetTask2Btn        = document.querySelector("#resetTask2Btn");
const task2Log             = document.querySelector("#task2Log");

// ────────────────────────────────────────────────
//  行为追踪
// ────────────────────────────────────────────────
const behaviorQueue = [];
let behaviorFlushTimer = null;
const BEHAVIOR_BATCH_SIZE = 10;
const BEHAVIOR_FLUSH_DELAY = 1500;

function trackBehavior(action, detail = {}) {
  behaviorQueue.push({
    sessionId: state.sessionId,
    userId: state.userId,
    action,
    detail,
    createdAt: Date.now()
  });

  if (behaviorQueue.length >= BEHAVIOR_BATCH_SIZE) {
    void flushBehaviorQueue();
    return;
  }

  if (!behaviorFlushTimer) {
    behaviorFlushTimer = window.setTimeout(() => {
      behaviorFlushTimer = null;
      void flushBehaviorQueue();
    }, BEHAVIOR_FLUSH_DELAY);
  }
}

async function flushBehaviorQueue(useBeacon = false) {
  if (behaviorFlushTimer) {
    window.clearTimeout(behaviorFlushTimer);
    behaviorFlushTimer = null;
  }

  if (!behaviorQueue.length) return;

  const events = behaviorQueue.splice(0, behaviorQueue.length);
  const payload = JSON.stringify({ events });

  if (useBeacon && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/track", blob);
    return;
  }

  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    });
  } catch {
    behaviorQueue.unshift(...events);
  }
}

// ────────────────────────────────────────────────
//  语音 API 检测
// ────────────────────────────────────────────────
const speechSynthesisApi   = window.speechSynthesis || null;
// 移除原生 SpeechRecognition，因为在国内容易出现 network 错误或 service-not-allowed
// 改为统一使用 getUserMedia + SiliconFlow ASR
const SpeechRecognitionAPI = null;

let recognition = null;
let isListening = false;

// ────────────────────────────────────────────────
//  启动
// ────────────────────────────────────────────────
// 注意：必须在定义 GAME_SCENES 之后调用
window.addEventListener("DOMContentLoaded", bootstrap);

function bootstrap() {
  bindEvents();
  initVoiceInput();
  updateSpeakButton();
  resetChallenge();
  window.addEventListener("beforeunload", () => {
    void flushBehaviorQueue(true);
  });
}

function bindEvents() {
  // 导航栏切换
  navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.target;
      state.activeTab = targetId;
      trackBehavior("switch_tab", { target: targetId });
      
      navTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      viewSections.forEach(section => {
        if (section.id === targetId) {
          section.style.display = "block";
          // 小延迟后添加active，触发动画
          setTimeout(() => section.classList.add("active"), 10);
        } else {
          section.style.display = "none";
          section.classList.remove("active");
        }
      });
    });
  });

  // 创想挑战事件
  if (task1SendBtn) {
    task1SendBtn.addEventListener("click", () => void handleTask1Command(task1Input.value.trim()));
  }
  if (task1Input) {
    task1Input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); void handleTask1Command(task1Input.value.trim()); }
    });
  }
  if (resetTask1Btn) {
    resetTask1Btn.addEventListener("click", () => {
      trackBehavior("click_button", { button: "resetTask1Btn" });
      resetChallenge();
    });
  }
  if (task1VoiceBtn) {
    task1VoiceBtn.addEventListener("click", () => {
      trackBehavior("click_button", { button: "task1VoiceBtn" });
      void toggleVoiceInput();
    });
  }
  if (task1SpeakToggleBtn) {
    task1SpeakToggleBtn.addEventListener("click", () => {
      trackBehavior("click_button", { button: "task1SpeakToggleBtn" });
      toggleSpeechOutput();
    });
  }
  
  if (task2SendBtn) {
    task2SendBtn.addEventListener("click", () => void handleTask2Command());
  }
  if (resetTask2Btn) {
    resetTask2Btn.addEventListener("click", () => {
      trackBehavior("click_button", { button: "resetTask2Btn" });
      resetTask2Form();
    });
  }
}

// ────────────────────────────────────────────────
//  语音输入
// ────────────────────────────────────────────────

function getActiveVoiceUI() {
  return { btn: task1VoiceBtn, status: task1VoiceStatus, input: task1Input, handler: handleTask1Command };
}

function initVoiceInput() {
  // 降级：录音上传到 SiliconFlow ASR
  if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
    if (voiceBtn) voiceBtn.disabled = true;
    if (task1VoiceBtn) task1VoiceBtn.disabled = true;
    if (!window.isSecureContext) {
      setVoiceStatus("录音需要安全环境，请通过 HTTPS 或 localhost 访问本页面。");
    } else {
      setVoiceStatus("当前浏览器不支持语音输入，建议使用最新版 Chrome，或直接文字输入。");
    }
    return;
  }

  if (!window.isSecureContext && location.protocol !== "file:") {
    setVoiceStatus("需要通过 localhost 或 https 打开才能使用录音功能。");
  } else {
    setVoiceStatus("支持录音上传识别。点击按钮开始提问。");
  }
}

async function toggleVoiceInput() {
  if (state.isWaitingReply) {
    setVoiceStatus("请等待 AI 回复完成后再使用语音。");
    return;
  }

  if (isListening) {
    stopRecording();
    return;
  }

  if (!window.isSecureContext && location.protocol !== "file:") {
    setVoiceStatus("当前页面不是安全环境，建议改用 localhost 打开。");
  }
  await startRecording();
}

async function startRecording() {
  try {
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioChunks = [];

    const mimeType = getSupportedRecordingType();
    state.mediaRecorder = mimeType
      ? new MediaRecorder(state.mediaStream, { mimeType })
      : new MediaRecorder(state.mediaStream);

    state.mediaRecorder.addEventListener("dataavailable", (e) => {
      if (e.data.size > 0) state.audioChunks.push(e.data);
    });

    state.mediaRecorder.addEventListener("stop", async () => {
      const audioType = state.mediaRecorder?.mimeType || mimeType || "audio/webm";
      const audioBlob = new Blob(state.audioChunks, { type: audioType });
      cleanupRecording();
      restoreVoiceButton();
      if (!audioBlob.size) { setVoiceStatus("没有录到有效音频，请重试。"); return; }
      await transcribeAudio(audioBlob, audioType);
    });

    state.mediaRecorder.start();
    isListening = true;
    
    const ui = getActiveVoiceUI();
    if (ui.btn) {
      ui.btn.classList.add("listening");
      ui.btn.textContent = "停止录音";
    }
    setVoiceStatus("🎙 正在录音，请说出完整内容…");
  } catch (error) {
    const msgs = {
      "NotAllowedError":       "没有麦克风权限，请允许浏览器访问麦克风。",
      "PermissionDeniedError": "没有麦克风权限，请允许浏览器访问麦克风。"
    };
    setVoiceStatus(msgs[error.name] || "麦克风不可用，请检查设备或改用文字输入。");
  }
}

function stopRecording() {
  if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") return;
  setVoiceStatus("录音已结束，正在识别中…");
  state.mediaRecorder.stop();
}

function cleanupRecording() {
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach((t) => t.stop());
    state.mediaStream = null;
  }
  state.mediaRecorder = null;
  state.audioChunks = [];
}

async function transcribeAudio(audioBlob, mimeType) {
  try {
    const ext = mimeType.includes("mp4") ? "m4a" : "webm";
    const formData = new FormData();
    formData.append("file", audioBlob, `recording.${ext}`);

    const response = await fetch("/api/transcribe", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.error || "语音转写失败");

    const text = String(data.text || "").trim();
    if (!text) throw new Error("转写结果为空");

    const ui = getActiveVoiceUI();
    if (ui.input) ui.input.value = text;
    setVoiceStatus(`✅ 识别完成：${text}`);
    await ui.handler(text, { source: "voice_upload" });
  } catch (error) {
    setVoiceStatus(`语音转写失败：${error.message}`);
  }
}

// ────────────────────────────────────────────────
//  语音朗读
// ────────────────────────────────────────────────
function toggleSpeechOutput() {
  if (!speechSynthesisApi) { setVoiceStatus("当前浏览器不支持语音朗读。"); return; }
  state.speechEnabled = !state.speechEnabled;
  updateSpeakButton();
  setVoiceStatus(state.speechEnabled ? "✅ 已开启朗读讲解。" : "已关闭朗读讲解。");
  if (!state.speechEnabled) speechSynthesisApi.cancel();
}

function updateSpeakButton() {
  const text = `朗读讲解：${state.speechEnabled ? "开 🔊" : "关"}`;
  if (speakToggleBtn) speakToggleBtn.textContent = text;
  if (task1SpeakToggleBtn) task1SpeakToggleBtn.textContent = text;
}

function speakText(text) {
  if (!state.speechEnabled || !speechSynthesisApi) return;
  speechSynthesisApi.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 1;
  speechSynthesisApi.speak(utterance);
}

// ────────────────────────────────────────────────
//  对话核心
// ────────────────────────────────────────────────
async function handleUserCommand(input, options = {}) {
  if (!input) { addMessage("system", "请先输入一个编程问题。"); return; }
  if (state.isWaitingReply) { addMessage("system", "请等待上一轮 AI 回复完成。"); return; }

  const previousHistory = state.chatHistory.filter(
    (item) => item.role === "user" || item.role === "assistant"
  );

  addMessage("user", input);
  commandInput.value = "";

  state.isWaitingReply = true;
  const thinkingEl = addThinkingIndicator();

  try {
    const reply = await requestAiReply(input, previousHistory, options);
    thinkingEl.remove();
    addMessage("assistant", reply);
    speakText(reply);
  } catch (error) {
    thinkingEl.remove();
    addMessage("system", `AI 请求失败：${error.message}`);
  } finally {
    state.isWaitingReply = false;
  }
}

function addThinkingIndicator() {
  const el = document.createElement("div");
  el.className = "message assistant thinking";
  el.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}

async function requestAiReply(message, history, options = {}) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history,
      sessionId: state.sessionId,
      userId: state.userId,
      source: options.source || "text"
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || "AI 对话失败");

  const reply = String(data.reply || "").trim();
  if (!reply) throw new Error("AI 返回内容为空");
  return reply;
}

// ────────────────────────────────────────────────
//  迁移应用 — AI 生成练习题
// ────────────────────────────────────────────────
async function generatePlan() {
  const scene = painInput.value.trim();
  if (!scene) {
    planOutput.innerHTML = '<div class="empty-state">请先输入一个生活场景。</div>';
    return;
  }
  if (state.isGenerating) return;

  state.isGenerating = true;
  generateBtn.disabled = true;
  generateBtn.textContent = "AI 生成中…";

  planOutput.innerHTML = `
    <div class="gen-loading">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
      <span class="gen-loading-text">AI 正在根据你的场景生成练习题…</span>
    </div>`;

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scene,
        sessionId: state.sessionId,
        userId: state.userId,
        source: "transfer"
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.error || "生成失败");

    const content = String(data.content || "").trim();
    if (!content) throw new Error("AI 返回内容为空");

    planOutput.innerHTML = `<article class="plan-card">${renderMarkdown(content)}</article>`;
  } catch (error) {
    planOutput.innerHTML = `<div class="empty-state gen-error">生成失败：${escapeHtml(error.message)}。请稍后重试。</div>`;
  } finally {
    state.isGenerating = false;
    generateBtn.disabled = false;
    generateBtn.textContent = "AI 生成练习题";
  }
}

// ────────────────────────────────────────────────
//  Markdown 渲染（安全，防 XSS）
// ────────────────────────────────────────────────
function renderMarkdown(rawText) {
  const segments = [];
  const fenceRe = /```[\w]*\n?([\s\S]*?)```/g;
  let lastIdx = 0;
  let match;

  while ((match = fenceRe.exec(rawText)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ type: "text", content: rawText.slice(lastIdx, match.index) });
    }
    segments.push({ type: "code", content: match[1] });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < rawText.length) {
    segments.push({ type: "text", content: rawText.slice(lastIdx) });
  }

  return segments.map((seg) => {
    if (seg.type === "code") {
      return `<pre class="msg-code"><code>${escapeHtml(seg.content.trim())}</code></pre>`;
    }
    let html = escapeHtml(seg.content);
    html = html.replace(/`([^`\n]+)`/g, '<code class="msg-inline">$1</code>');
    html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\n/g, "<br>");
    return html;
  }).join("");
}

// ────────────────────────────────────────────────
//  消息渲染
// ────────────────────────────────────────────────
function addMessage(role, content, shouldStore = role === "user" || role === "assistant") {
  if (shouldStore) state.chatHistory.push({ role, content });

  const el = document.createElement("div");
  el.className = `message ${role}`;

  if (role === "assistant") {
    el.innerHTML = renderMarkdown(content);
  } else {
    el.textContent = content;
  }

  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}

// ────────────────────────────────────────────────
//  重置对话
// ────────────────────────────────────────────────
function resetConversation() {
  chatLog.innerHTML = "";
  state.chatHistory = [];
  state.isWaitingReply = false;
  state.sessionId = resetSessionId();

  if (isListening) {
    if (recognition) recognition.stop();
    else stopRecording();
  }

  addMessage("assistant", "对话已重置。现在可以重新练习分支、循环或综合应用。");
  setVoiceStatus(recognition ? "语音已就绪。" : "语音已待命。");
}

// ────────────────────────────────────────────────
//  工具函数
// ────────────────────────────────────────────────
function restoreVoiceButton() {
  isListening = false;
  if (voiceBtn) { voiceBtn.classList.remove("listening"); voiceBtn.textContent = "开始语音提问"; }
  if (task1VoiceBtn) { task1VoiceBtn.classList.remove("listening"); task1VoiceBtn.textContent = "开始语音输入"; }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSupportedRecordingType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function setVoiceStatus(text) {
  if (voiceStatus) voiceStatus.textContent = text;
  if (task1VoiceStatus) task1VoiceStatus.textContent = text;
}

function getOrCreateSessionId() {
  const key = "sandbox_session_id";

  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) {
      return existing;
    }

    const next = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    window.sessionStorage.setItem(key, next);
    return next;
  } catch {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function resetSessionId() {
  const key = "sandbox_session_id";
  const next = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  try {
    window.sessionStorage.setItem(key, next);
  } catch {
    // Ignore storage failures and keep the in-memory session id.
  }

  return next;
}

function getOrCreateUserId() {
  const key = "sandbox_user_id";

  try {
    // 使用 localStorage 使 userId 跨会话、跨刷新持久保留
    const existing = window.localStorage.getItem(key);
    if (existing) {
      return existing;
    }

    const next = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `user_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    window.localStorage.setItem(key, next);
    return next;
  } catch {
    // 降级处理：如果 localStorage 禁用，则在内存里生成一个
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `user_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}



// ────────────────────────────────────────────────
//  创想挑战 逻辑
// ────────────────────────────────────────────────
let task1History = [];

function resetChallenge() {
  if (task1Log) task1Log.innerHTML = "";
  task1History = [];
  addTask1Message("assistant", "**你好，AI创想家！这里是任务一。**\n\n请向我下达以下类型的指令，我会像语音助手一样响应：\n1. **常规指令**（如：什么是AI）\n2. **模糊指令**（如：我心情不太好）\n3. **连续对话**（根据刚才的话题继续问）\n\n*请在下方输入框告诉我，或者点击上方语音输入。*");
  resetTask2Form();
}

function resetTask2Form() {
  if (task2Scenario) task2Scenario.value = "";
  if (task2Design) task2Design.value = "";
  if (task2Effect) task2Effect.value = "";
  if (task2Log) {
    task2Log.innerHTML = "";
    task2Log.style.display = "none";
  }
}

function addTask1Message(role, content, isThinking = false) {
  if (!task1Log) return null;
  if (role === "user" || (role === "assistant" && !isThinking)) {
    task1History.push({ role, content });
  }

  const el = document.createElement("div");
  el.className = `message ${role}`;
  if (isThinking) el.classList.add("thinking");

  if (role === "assistant") {
    el.innerHTML = isThinking ? content : renderMarkdown(content);
    if (!isThinking) {
      const speakableText = content.replace(/[*_`#]/g, '');
      speakText(speakableText);
    }
  } else {
    el.textContent = content;
  }

  task1Log.appendChild(el);
  task1Log.scrollTop = task1Log.scrollHeight;
  return el;
}

async function handleTask1Command(text) {
  if (!text) return;
  if (task1Input) task1Input.value = "";
  
  addTask1Message("user", text);
  trackBehavior("task1_input", { text });
  state.isWaitingReply = true;

  const thinkingEl = addTask1Message("assistant", '<span class="dot"></span><span class="dot"></span><span class="dot"></span>', true);

  const systemPrompt = `你现在是一个智能语音助手。用户正在进行【任务一：测试语音助手】。
用户会下达常规指令、模糊指令或进行连续对话。
请你完全像一个真实的、贴心的语音助手一样简短地响应用户的指令即可。不要进行任何额外的人工智能原理或特征分析。字数控制在80字以内，语言生动自然。`;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        systemPrompt: systemPrompt,
        history: task1History.slice(-6),
        sessionId: state.sessionId,
        userId: state.userId,
        source: "task1"
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.error || "AI 对话失败");

    const reply = String(data.reply || "").trim();
    if (thinkingEl) thinkingEl.remove();
    addTask1Message("assistant", reply);
  } catch (error) {
    if (thinkingEl) thinkingEl.remove();
    addTask1Message("system", `请求失败：${error.message}`);
  } finally {
    state.isWaitingReply = false;
  }
}

async function handleTask2Command() {
  const scenario = task2Scenario.value.trim();
  const design = task2Design.value.trim();
  const effect = task2Effect.value.trim();
  
  if (!scenario || !design || !effect) {
    alert("请完整填写场景描述、功能设计和预期效果三个部分！");
    return;
  }

  trackBehavior("task2_submit", { scenario, design, effect });
  state.isWaitingReply = true;

  if (task2Log) {
    task2Log.style.display = "flex";
    task2Log.innerHTML = ""; // 每次提交都清空旧的对话，只显示当前这一次的提交和回复
  }
  
  const userMessage = `【我的场景方案】\n1. 场景描述：${scenario}\n2. 功能设计：${design}\n3. 预期效果：${effect}`;
  
  const el = document.createElement("div");
  el.className = "message user";
  el.innerHTML = renderMarkdown(userMessage);
  task2Log.appendChild(el);
  
  const thinkingEl = document.createElement("div");
  thinkingEl.className = "message assistant thinking";
  thinkingEl.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  task2Log.appendChild(thinkingEl);

  const systemPrompt = `你现在是《智语奇旅》的向导。用户正在进行【任务二：设计应用场景】。
用户提交了包含场景描述、功能设计和预期效果的语音助手方案。
请你生成方案，必须**紧扣用户刚才提出的痛点和场景要求**，为他们生成一个全新、富含创意和技术深度的【智能语音助手方案】。不能脱离用户的需求自由发挥。新方案必须包含清晰的“场景描述”、“功能设计”和“预期效果”三部分，作为优秀示范。
请确保逻辑分明，语言简洁生动，易于理解，总字数控制在600-800字左右。`;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        systemPrompt: systemPrompt,
        history: [],
        sessionId: state.sessionId,
        userId: state.userId,
        source: "task2"
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.error || "AI 对话失败");

    const reply = String(data.reply || "").trim();
    thinkingEl.remove();
    
    const replyEl = document.createElement("div");
    replyEl.className = "message assistant";
    replyEl.innerHTML = renderMarkdown(reply);
    task2Log.appendChild(replyEl);
    task2Log.scrollTop = task2Log.scrollHeight;
    
    const speakableText = reply.replace(/[*_`#]/g, '');
    speakText(speakableText);
  } catch (error) {
    thinkingEl.remove();
    const errorEl = document.createElement("div");
    errorEl.className = "message system";
    errorEl.textContent = `请求失败：${error.message}`;
    task2Log.appendChild(errorEl);
  } finally {
    state.isWaitingReply = false;
  }
}
