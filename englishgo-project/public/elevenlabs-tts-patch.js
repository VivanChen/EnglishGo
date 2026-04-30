(() => {
  if (!window.speechSynthesis || window.__englishGoElevenLabsTtsPatch) return;
  window.__englishGoElevenLabsTtsPatch = true;

  const synth = window.speechSynthesis;
  const nativeSpeak = synth.speak.bind(synth);
  const nativeCancel = synth.cancel.bind(synth);
  const audioCache = new Map();
  const inflight = new Map();
  const MAX_CHARS = 350;
  const LS_VOICE = "eg_tts_voice_id";
  const LS_SPEED = "eg_tts_speed";
  const LS_AUTO_PRELOAD = "eg_tts_auto_preload";
  const DEFAULT_VOICE = "1AKkSX7KMPHIWuz76m0n";
  const DEFAULT_SPEED = 0.9;
  const VOICES = [
    { id: "1AKkSX7KMPHIWuz76m0n", label: "目前選用", accent: "custom" },
    { id: "EXAVITQu4vr4xnSDxMaL", label: "美式 Bella", accent: "US" },
    { id: "21m00Tcm4TlvDq8ikWAM", label: "美式 Rachel", accent: "US" },
    { id: "ErXwobaYiN019PkySvjV", label: "英式 Antoni", accent: "UK" },
  ];
  let activeAudio = null;
  let preloadTimer = null;
  let lastPreloadSignature = "";

  function clamp(n, min, max, fallback) {
    const v = Number(n);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
  }

  function normalizeText(text) {
    return String(text || "")
      .normalize("NFKC")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^['"“”‘’]+|['"“”‘’.,!?;:，。！？；：]+$/g, "")
      .toLowerCase();
  }

  function getSettings() {
    let voiceId = DEFAULT_VOICE;
    let speed = DEFAULT_SPEED;
    let autoPreload = true;
    try {
      voiceId = localStorage.getItem(LS_VOICE) || DEFAULT_VOICE;
      speed = clamp(localStorage.getItem(LS_SPEED), 0.7, 1.2, DEFAULT_SPEED);
      autoPreload = localStorage.getItem(LS_AUTO_PRELOAD) !== "false";
    } catch {}
    return { voiceId, speed, autoPreload };
  }

  function makeCacheKey(text, settings) {
    return `${settings.voiceId}|${settings.speed}|${normalizeText(text)}`;
  }

  function stopActiveAudio() {
    try {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
        activeAudio = null;
      }
    } catch {}
  }

  function shouldUseElevenLabs(utterance) {
    const text = String(utterance?.text || "").trim();
    const lang = String(utterance?.lang || "en-US");
    if (!text || text.length > MAX_CHARS) return false;
    if (!/^en/i.test(lang)) return false;
    if (!/[A-Za-z]/.test(text)) return false;
    if (typeof utterance.onboundary === "function") return false;
    return true;
  }

  function emitEnd(utterance) {
    try {
      if (typeof utterance.onend === "function") utterance.onend(new Event("end"));
    } catch {}
  }

  function emitStart(utterance) {
    try {
      if (typeof utterance.onstart === "function") utterance.onstart(new Event("start"));
    } catch {}
  }

  async function getAudioUrl(text, options = {}) {
    const settings = { ...getSettings(), ...options };
    const normalized = normalizeText(text);
    const cacheKey = makeCacheKey(normalized, settings);
    if (audioCache.has(cacheKey)) return audioCache.get(cacheKey);
    if (inflight.has(cacheKey)) return inflight.get(cacheKey);

    const promise = fetch("/.netlify/functions/elevenlabs-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: normalized, voiceId: settings.voiceId, speed: settings.speed }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioCache.set(cacheKey, url);

        if (audioCache.size > 120) {
          const firstKey = audioCache.keys().next().value;
          try { URL.revokeObjectURL(audioCache.get(firstKey)); } catch {}
          audioCache.delete(firstKey);
        }
        return url;
      })
      .finally(() => inflight.delete(cacheKey));

    inflight.set(cacheKey, promise);
    return promise;
  }

  async function warmupTexts(texts, options = {}) {
    const unique = [...new Set((texts || []).map(normalizeText).filter(t => /[a-z]/i.test(t) && t.length <= MAX_CHARS))].slice(0, 20);
    for (const text of unique) {
      getAudioUrl(text, options).catch(() => {});
      await new Promise(r => setTimeout(r, 350));
    }
  }

  function collectVisibleEnglishTexts() {
    const root = document.querySelector("main") || document.body;
    const items = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION"].includes(tag)) return NodeFilter.FILTER_REJECT;
        const rect = parent.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return NodeFilter.FILTER_REJECT;
        if (rect.bottom < 0 || rect.top > window.innerHeight) return NodeFilter.FILTER_REJECT;
        const text = normalizeText(node.textContent);
        if (!/[a-z]/.test(text)) return NodeFilter.FILTER_REJECT;
        if (text.length < 2 || text.length > 90) return NodeFilter.FILTER_REJECT;
        if (text.split(" ").length > 10) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode() && items.length < 40) items.push(walker.currentNode.textContent);
    return [...new Set(items.map(normalizeText))].slice(0, 20);
  }

  function scheduleAutoPreload(delay = 1200) {
    const settings = getSettings();
    if (!settings.autoPreload) return;
    clearTimeout(preloadTimer);
    preloadTimer = setTimeout(() => {
      const texts = collectVisibleEnglishTexts();
      const signature = texts.join("|");
      if (!signature || signature === lastPreloadSignature) return;
      lastPreloadSignature = signature;
      warmupTexts(texts).catch(() => {});
    }, delay);
  }

  function renderPanel() {
    if (document.getElementById("eg-tts-panel")) return;
    const style = document.createElement("style");
    style.textContent = `
      #eg-tts-panel{position:fixed;right:18px;bottom:18px;width:220px;background:rgba(255,255,255,.96);color:#123;border:1px solid rgba(0,0,0,.08);border-radius:16px;box-shadow:0 12px 30px rgba(0,0,0,.18);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;z-index:2147483647;overflow:hidden;font-size:13px;backdrop-filter:blur(10px)}
      #eg-tts-panel.eg-mini{width:auto}
      #eg-tts-panel.eg-mini .eg-body{display:none}
      #eg-tts-panel .eg-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(135deg,#0f8f6f,#16b88f);color:#fff;font-weight:800;cursor:pointer}
      #eg-tts-panel .eg-body{padding:12px;display:grid;gap:10px}
      #eg-tts-panel label{display:block;font-size:12px;font-weight:700;color:#345;margin-bottom:4px}
      #eg-tts-panel select,#eg-tts-panel input[type=range]{width:100%}
      #eg-tts-panel select{border:1px solid #d9e2e7;border-radius:10px;padding:7px;background:#fff}
      #eg-tts-panel .eg-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
      #eg-tts-panel .eg-chip{font-size:12px;background:#eef8f4;border-radius:999px;padding:3px 8px;color:#087557;font-weight:700}
      #eg-tts-panel button{border:0;border-radius:10px;padding:7px 9px;background:#0f8f6f;color:#fff;font-weight:800;cursor:pointer}
      #eg-tts-panel button.eg-light{background:#eef3f5;color:#234}
      #eg-tts-panel .eg-small{font-size:11px;color:#789;line-height:1.35}
    `;
    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.id = "eg-tts-panel";
    panel.innerHTML = `
      <div class="eg-head"><span>🎧 發音設定</span><span id="eg-tts-toggle">−</span></div>
      <div class="eg-body">
        <div>
          <label for="eg-tts-voice">聲音</label>
          <select id="eg-tts-voice">${VOICES.map(v => `<option value="${v.id}">${v.label}${v.accent ? ` · ${v.accent}` : ""}</option>`).join("")}</select>
        </div>
        <div>
          <div class="eg-row"><label for="eg-tts-speed">語速</label><span class="eg-chip" id="eg-tts-speed-label"></span></div>
          <input id="eg-tts-speed" type="range" min="0.7" max="1.2" step="0.05" />
        </div>
        <div class="eg-row">
          <label style="margin:0"><input id="eg-tts-auto" type="checkbox" /> 自動預生成</label>
          <button class="eg-light" id="eg-tts-preload" type="button">預生成目前頁</button>
        </div>
        <div class="eg-row">
          <button id="eg-tts-test" type="button">試聽</button>
          <span class="eg-small">Help / help / HELP 會共用同一份音檔</span>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const voice = panel.querySelector("#eg-tts-voice");
    const speed = panel.querySelector("#eg-tts-speed");
    const speedLabel = panel.querySelector("#eg-tts-speed-label");
    const auto = panel.querySelector("#eg-tts-auto");
    const head = panel.querySelector(".eg-head");
    const toggle = panel.querySelector("#eg-tts-toggle");

    function sync() {
      const s = getSettings();
      voice.value = s.voiceId;
      speed.value = s.speed;
      speedLabel.textContent = `${s.speed.toFixed(2)}x`;
      auto.checked = s.autoPreload;
    }

    voice.addEventListener("change", () => window.EnglishGoTTS.setSettings({ voiceId: voice.value }));
    speed.addEventListener("input", () => {
      speedLabel.textContent = `${Number(speed.value).toFixed(2)}x`;
      window.EnglishGoTTS.setSettings({ speed: Number(speed.value) });
    });
    auto.addEventListener("change", () => window.EnglishGoTTS.setSettings({ autoPreload: auto.checked }));
    panel.querySelector("#eg-tts-test").addEventListener("click", () => window.EnglishGoTTS.speak("This is a clear English pronunciation test."));
    panel.querySelector("#eg-tts-preload").addEventListener("click", () => warmupTexts(collectVisibleEnglishTexts()));
    head.addEventListener("click", () => {
      panel.classList.toggle("eg-mini");
      toggle.textContent = panel.classList.contains("eg-mini") ? "+" : "−";
    });
    window.addEventListener("englishgo:tts-settings-changed", sync);
    sync();
  }

  window.EnglishGoTTS = {
    getSettings,
    setSettings(settings = {}) {
      try {
        if (settings.voiceId) localStorage.setItem(LS_VOICE, settings.voiceId);
        if (settings.speed != null) localStorage.setItem(LS_SPEED, String(clamp(settings.speed, 0.7, 1.2, DEFAULT_SPEED)));
        if (settings.autoPreload != null) localStorage.setItem(LS_AUTO_PRELOAD, settings.autoPreload ? "true" : "false");
      } catch {}
      window.dispatchEvent(new CustomEvent("englishgo:tts-settings-changed", { detail: getSettings() }));
      scheduleAutoPreload(300);
    },
    preload: warmupTexts,
    speak(text) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      return synth.speak(utterance);
    },
    collectVisibleTexts: collectVisibleEnglishTexts,
  };

  synth.cancel = function patchedCancel() {
    stopActiveAudio();
    return nativeCancel();
  };

  synth.speak = function patchedSpeak(utterance) {
    if (!shouldUseElevenLabs(utterance)) {
      stopActiveAudio();
      return nativeSpeak(utterance);
    }

    const text = String(utterance.text || "").trim();

    stopActiveAudio();
    nativeCancel();

    getAudioUrl(text)
      .then((url) => {
        const audio = new Audio(url);
        activeAudio = audio;
        const settings = getSettings();
        audio.playbackRate = clamp(utterance.rate || settings.speed, 0.7, 1.2, settings.speed);
        audio.volume = typeof utterance.volume === "number" ? utterance.volume : 1;
        audio.onended = () => {
          if (activeAudio === audio) activeAudio = null;
          emitEnd(utterance);
        };
        audio.onerror = () => {
          if (activeAudio === audio) activeAudio = null;
          nativeSpeak(utterance);
        };
        emitStart(utterance);
        return audio.play();
      })
      .catch(() => {
        nativeSpeak(utterance);
      });

    return undefined;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { renderPanel(); scheduleAutoPreload(); });
  } else {
    renderPanel();
    scheduleAutoPreload();
  }

  const observer = new MutationObserver(() => scheduleAutoPreload(1600));
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
