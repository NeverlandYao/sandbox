// ────────────────────────────────────────────────
//  全局状态
// ────────────────────────────────────────────────
const state = {
  chatHistory: [],
  gameHistory: [],
  gameState: 0,
  activeTab: "view-ai-explore",
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

const gameLog        = document.querySelector("#gameLog");
const gameOptions    = document.querySelector("#gameOptions");
const resetGameBtn   = document.querySelector("#resetGameBtn");

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
const task2Log             = document.querySelector("#task2Log");

// ────────────────────────────────────────────────
//  行为追踪
// ────────────────────────────────────────────────
function trackBehavior(action, detail = {}) {
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: state.sessionId,
      userId: state.userId,
      action,
      detail
    })
  }).catch(() => {});
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
  addMessage(
    "assistant",
    `👋 欢迎来到「分支与循环」课堂！我是小智，专门帮你搞懂 **if** 和 **for**。\n\n你可以：\n- 直接输入问题（回车发送）\n- 点击下方快捷按钮\n- 点击「开始语音提问」用说话的方式提问\n\n试试问我：什么时候用 if？`
  );
  bindEvents();
  initVoiceInput();
  updateSpeakButton();
  resetGame();
  resetChallenge();
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

  // 编程小课堂事件
  sendBtn.addEventListener("click", () => void handleUserCommand(commandInput.value.trim(), { source: "text" }));
  commandInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); void handleUserCommand(commandInput.value.trim(), { source: "text" }); }
  });

  resetChatBtn.addEventListener("click", () => {
    trackBehavior("click_button", { button: "resetChatBtn" });
    resetConversation();
  });
  
  generateBtn.addEventListener("click", () => {
    trackBehavior("click_button", { button: "generateBtn" });
    void generatePlan();
  });
  
  voiceBtn.addEventListener("click", () => {
    trackBehavior("click_button", { button: "voiceBtn" });
    void toggleVoiceInput();
  });
  
  speakToggleBtn.addEventListener("click", () => {
    trackBehavior("click_button", { button: "speakToggleBtn" });
    toggleSpeechOutput();
  });

  quickButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
      trackBehavior("click_quick_action", { command: btn.dataset.command });
      void handleUserCommand(btn.dataset.command, { source: "quick_action" });
    })
  );

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
}

// ────────────────────────────────────────────────
//  语音输入
// ────────────────────────────────────────────────

function getActiveVoiceUI() {
  if (state.activeTab === "view-ai-challenge") {
    return { btn: task1VoiceBtn, status: task1VoiceStatus, input: task1Input, handler: handleTask1Command };
  }
  return { btn: voiceBtn, status: voiceStatus, input: commandInput, handler: handleUserCommand };
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
//  AI 知识探秘 游戏逻辑
// ────────────────────────────────────────────────
const GAME_SCENES = {
  0: {
    msg: "欢迎来到《智语奇旅》！在这里我们将一起探索人工智能的奥秘。你想先探索哪个领域呢？",
    options: [
      { label: "1. 了解 AI 核心特征", target: 1 },
      { label: "2. 了解 AI 的分类", target: 2 }
    ]
  },
  1: {
    msg: "**AI 的核心特征包括：**\n\n- **自主性**：无人类干预自主完成任务。\n- **学习能力**：从数据中提取规律，不断优化。\n- **交互与适应**：根据反馈动态调整。\n- **感知与理解**：“看懂”图像、“听懂”声音。\n- **推理与决策**：计算最优解，辅助选择。\n\n你想深入了解哪个特征？",
    options: [
      { label: "学习能力是怎样的？", target: 11 },
      { label: "什么是感知与理解？", target: 12 },
      { label: "返回主菜单", target: 0 }
    ]
  },
  11: {
    msg: "**学习能力**：AI 系统能够从数据中提取规律，通过训练不断优化自身性能。比如深度学习算法，它不仅能发现特征，还能像人类一样创作文本、图像与代码！\n\n你可以切换到顶部的**“创想挑战”**，去试试语音助手挑战吧！",
    options: [
      { label: "返回主菜单", target: 0 }
    ]
  },
  12: {
    msg: "**感知与理解**：机器不仅能通过传感器“看”和“听”，还能通过算法“读懂”人类语言（自然语言处理）。这是实现人机自然交互的基础！",
    options: [
      { label: "返回主菜单", target: 0 }
    ]
  },
  2: {
    msg: "**AI 可以分为三类：**\n\n- **弱人工智能 (ANI)**：特定领域超越人类，如 Siri。\n- **强人工智能 (AGI)**：像人类一样具有通用理解和解决问题能力。\n- **超人工智能 (ASI)**：智能远超人类，具有自我优化和创新能力。\n\n我们现在用的 AI 大多属于哪一种呢？",
    options: [
      { label: "弱人工智能", target: 21 },
      { label: "强人工智能", target: 22 }
    ]
  },
  21: {
    msg: "回答正确！✅ 目前我们广泛使用的都是**弱人工智能 (ANI)**，它们只能在特定的预定义领域内工作。\n\n知识探秘已完成，快去顶部的**“创想挑战”**测试你的点子吧！",
    options: [
      { label: "返回主菜单", target: 0 }
    ]
  },
  22: {
    msg: "不对哦~ ❌ 强人工智能目前还处于理论研究阶段，我们现在常用的都是**弱人工智能 (ANI)**。",
    options: [
      { label: "返回主菜单", target: 0 }
    ]
  }
};

function resetGame() {
  if (gameLog) gameLog.innerHTML = "";
  state.gameHistory = [];
  setGameState(0);
}

function setGameState(sceneId) {
  state.gameState = sceneId;
  const scene = GAME_SCENES[sceneId];
  if (scene) {
    addGameMessage("assistant", scene.msg);
    renderGameOptions(scene.options);
  }
}

function addGameMessage(role, content) {
  if (!gameLog) return;
  if (role === "user" || role === "assistant") {
    state.gameHistory.push({ role, content });
  }

  const el = document.createElement("div");
  el.className = `message ${role}`;

  if (role === "assistant") {
    el.innerHTML = renderMarkdown(content);
    // 移除 markdown 符号，让语音朗读更自然
    const speakableText = content.replace(/[*_`#]/g, '');
    speakText(speakableText);
  } else {
    el.textContent = content;
  }

  gameLog.appendChild(el);
  gameLog.scrollTop = gameLog.scrollHeight;
  return el;
}

function renderGameOptions(options) {
  if (!gameOptions) return;
  gameOptions.innerHTML = "";
  if (!options || options.length === 0) {
    gameOptions.style.display = "none";
    return;
  }
  
  gameOptions.style.display = "flex";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "game-choice-btn";
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      trackBehavior("game_choice", { label: opt.label, target: opt.target });
      addGameMessage("user", opt.label);
      setGameState(opt.target);
    });
    gameOptions.appendChild(btn);
  });
}

// ────────────────────────────────────────────────
//  创想挑战 逻辑
// ────────────────────────────────────────────────
let task1History = [];

function resetChallenge() {
  if (task1Log) task1Log.innerHTML = "";
  task1History = [];
  addTask1Message("assistant", "**你好，AI创想家！这里是任务一。**\n\n请向我下达以下类型的指令，我会像语音助手一样响应：\n1. **常规指令**（如：什么是AI）\n2. **模糊指令**（如：我心情不太好）\n3. **连续对话**（根据刚才的话题继续问）\n\n*请在下方输入框告诉我，或者点击上方语音输入。*");
  
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
    task2Log.innerHTML = "";
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
请对用户的方案进行专业且鼓励的点评，指出其设计的亮点，并分析该方案具体体现了哪些人工智能的核心特征（如感知与理解、交互与适应等）。如果方案有待完善，可以温和地引导用户补充。字数控制在200字以内，分点清晰说明。`;

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
