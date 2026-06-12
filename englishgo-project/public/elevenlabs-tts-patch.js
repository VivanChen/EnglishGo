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
  const DEFAULT_VOICE = "1AKkSX7KMPHIWuz76m0n";
  const DEFAULT_SPEED = 0.9;
  const CHINESE_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;
  const VOICES = [
    { id: "1AKkSX7KMPHIWuz76m0n", label: "目前選用", accent: "custom" },
    { id: "EXAVITQu4vr4xnSDxMaL", label: "美式 Bella", accent: "US" },
    { id: "21m00Tcm4TlvDq8ikWAM", label: "美式 Rachel", accent: "US" },
    { id: "ErXwobaYiN019PkySvjV", label: "英式 Antoni", accent: "UK" },
  ];
  let activeAudio = null;
  let loadingToast = null;
  let loadingButton = null;
  let loadingCounter = 0;

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

  function isChineseLang(lang) {
    return /^zh/i.test(String(lang || ""));
  }

  function isEligibleText(text, lang = "en-US") {
    const normalized = normalizeText(text);
    if (!normalized || normalized.length > MAX_CHARS) return false;
    return isChineseLang(lang) ? CHINESE_RE.test(normalized) : /[A-Za-z]/.test(normalized);
  }

  function getSettings() {
    let voiceId = DEFAULT_VOICE;
    let speed = DEFAULT_SPEED;
    try {
      voiceId = localStorage.getItem(LS_VOICE) || DEFAULT_VOICE;
      speed = clamp(localStorage.getItem(LS_SPEED), 0.7, 1.2, DEFAULT_SPEED);
    } catch {}
    return { voiceId, speed };
  }

  function makeCacheKey(text, settings) {
    return `${settings.lang || "en-US"}|${settings.voiceId || "server-default"}|${normalizeText(text)}`;
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
    if (utterance?.__englishGoWebSpeechOnly) return false;
    const text = String(utterance?.text || "").trim();
    const lang = String(utterance?.lang || "en-US");
    if (!text || text.length > MAX_CHARS) return false;
    if (typeof utterance.onboundary === "function") return false;
    if (/^en/i.test(lang)) return /[A-Za-z]/.test(text);
    if (isChineseLang(lang)) return false;
    return false;
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

  function findLikelySpeakerButton() {
    const candidates = Array.from(document.querySelectorAll("button,[role='button'],span,div,a"));
    const visible = candidates.filter(el => {
      const txt = (el.textContent || "").trim();
      if (!/[🔊🔈🔉🔇]/.test(txt)) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top >= -20 && rect.bottom <= window.innerHeight + 20;
    });
    return visible.at(-1) || null;
  }

  function showTtsLoading(text) {
    loadingCounter += 1;
    const token = loadingCounter;
    const shortText = normalizeText(text).slice(0, 28);
    const button = findLikelySpeakerButton();
    if (loadingButton && loadingButton !== button) loadingButton.classList.remove("eg-tts-loading-target");
    loadingButton = button;
    if (loadingButton) loadingButton.classList.add("eg-tts-loading-target");

    if (!loadingToast) {
      loadingToast = document.createElement("div");
      loadingToast.id = "eg-tts-loading-toast";
      loadingToast.innerHTML = `<span class="eg-tts-spinner"></span><span class="eg-tts-loading-text"></span>`;
      document.body.appendChild(loadingToast);
    }
    const textEl = loadingToast.querySelector(".eg-tts-loading-text");
    if (textEl) textEl.textContent = shortText ? `正在準備發音：${shortText}` : "正在準備發音…";
    loadingToast.classList.add("show");
    window.dispatchEvent(new CustomEvent("englishgo:tts-loading", { detail: { text: shortText } }));
    return token;
  }

  function hideTtsLoading(token) {
    if (token && token !== loadingCounter) return;
    if (loadingToast) loadingToast.classList.remove("show");
    if (loadingButton) loadingButton.classList.remove("eg-tts-loading-target");
    loadingButton = null;
    window.dispatchEvent(new CustomEvent("englishgo:tts-ready"));
  }

  async function getAudioUrl(text, options = {}) {
    const baseSettings = getSettings();
    const lang = options.lang || "en-US";
    const settings = {
      ...baseSettings,
      ...options,
      lang,
      voiceId: options.voiceId ?? (isChineseLang(lang) ? undefined : baseSettings.voiceId),
      speed: isChineseLang(lang) ? 1 : options.speed ?? baseSettings.speed,
    };
    const normalized = normalizeText(text);
    if (!isEligibleText(normalized, settings.lang)) throw new Error("Text is not eligible for ElevenLabs TTS");
    const cacheKey = makeCacheKey(normalized, settings);
    if (audioCache.has(cacheKey)) return audioCache.get(cacheKey);
    if (inflight.has(cacheKey)) return inflight.get(cacheKey);

    const promise = fetch("/.netlify/functions/elevenlabs-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: normalized, voiceId: settings.voiceId, lang: settings.lang, speed: settings.speed }),
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

  function preload(text, options = {}) {
    return getAudioUrl(text, options).catch(() => null);
  }

  async function preloadMany(texts, options = {}) {
    const rawItems = Array.isArray(texts) ? texts : [texts];
    const limit = clamp(options.limit, 1, 12, 5);
    const concurrency = clamp(options.concurrency, 1, 3, 2);
    const seen = new Set();
    const items = [];

    for (const item of rawItems) {
      const normalized = normalizeText(item);
      if (!isEligibleText(normalized, options.lang) || seen.has(normalized)) continue;
      seen.add(normalized);
      items.push(normalized);
      if (items.length >= limit) break;
    }

    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const next = items[index++];
        await preload(next, options);
      }
    });

    await Promise.allSettled(workers);
    return items.length;
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
      #eg-tts-panel .eg-small{font-size:11px;color:#789;line-height:1.35}
      #eg-tts-loading-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(18px);display:flex;align-items:center;gap:9px;padding:10px 14px;border-radius:999px;background:rgba(15,143,111,.96);color:#fff;font:700 13px system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 10px 24px rgba(0,0,0,.22);z-index:2147483646;opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease;max-width:min(420px,calc(100vw - 32px))}
      #eg-tts-loading-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .eg-tts-spinner{width:14px;height:14px;border-radius:999px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:egTtsSpin .75s linear infinite;flex:0 0 auto}
      .eg-tts-loading-target{position:relative;animation:egTtsPulse .9s ease-in-out infinite!important;filter:drop-shadow(0 0 8px rgba(15,143,111,.5))}
      @media (max-width:640px){
        #eg-tts-panel{right:12px;bottom:12px;width:min(220px,calc(100vw - 24px))}
        #eg-tts-panel.eg-mini{width:auto;max-width:calc(100vw - 24px)}
      }
      @keyframes egTtsSpin{to{transform:rotate(360deg)}}
      @keyframes egTtsPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
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
          <button id="eg-tts-test" type="button">試聽</button>
          <span class="eg-small">語速只調整播放，不重產音檔</span>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.classList.add("eg-mini");

    const voice = panel.querySelector("#eg-tts-voice");
    const speed = panel.querySelector("#eg-tts-speed");
    const speedLabel = panel.querySelector("#eg-tts-speed-label");
    const head = panel.querySelector(".eg-head");
    const toggle = panel.querySelector("#eg-tts-toggle");
    if (panel.classList.contains("eg-mini")) toggle.textContent = "+";

    function sync() {
      const s = getSettings();
      voice.value = s.voiceId;
      speed.value = s.speed;
      speedLabel.textContent = `${s.speed.toFixed(2)}x`;
    }

    voice.addEventListener("change", () => window.EnglishGoTTS.setSettings({ voiceId: voice.value }));
    speed.addEventListener("input", () => {
      speedLabel.textContent = `${Number(speed.value).toFixed(2)}x`;
      window.EnglishGoTTS.setSettings({ speed: Number(speed.value) });
    });
    panel.querySelector("#eg-tts-test").addEventListener("click", () => window.EnglishGoTTS.speak("This is a clear English pronunciation test."));
    head.addEventListener("click", () => {
      panel.classList.toggle("eg-mini");
      toggle.textContent = panel.classList.contains("eg-mini") ? "+" : "−";
    });
    window.addEventListener("englishgo:tts-settings-changed", sync);
    sync();
  }

  window.EnglishGoTTS = {
    getAudioUrl,
    getSettings,
    preload,
    preloadMany,
    setSettings(settings = {}) {
      try {
        if (settings.voiceId) localStorage.setItem(LS_VOICE, settings.voiceId);
        if (settings.speed != null) localStorage.setItem(LS_SPEED, String(clamp(settings.speed, 0.7, 1.2, DEFAULT_SPEED)));
      } catch {}
      window.dispatchEvent(new CustomEvent("englishgo:tts-settings-changed", { detail: getSettings() }));
    },
    speak(text) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      return synth.speak(utterance);
    },
  };

  synth.cancel = function patchedCancel() {
    stopActiveAudio();
    hideTtsLoading();
    return nativeCancel();
  };

  synth.speak = function patchedSpeak(utterance) {
    if (!shouldUseElevenLabs(utterance)) {
      stopActiveAudio();
      hideTtsLoading();
      return nativeSpeak(utterance);
    }

    const text = String(utterance.text || "").trim();

    stopActiveAudio();
    nativeCancel();
    const loadingToken = showTtsLoading(text);

    getAudioUrl(text, { lang: utterance.lang })
      .then((url) => {
        const audio = new Audio(url);
        activeAudio = audio;
        const settings = getSettings();
        audio.playbackRate = isChineseLang(utterance.lang) ? 1 : settings.speed;
        audio.volume = typeof utterance.volume === "number" ? utterance.volume : 1;
        audio.oncanplay = () => hideTtsLoading(loadingToken);
        audio.onplaying = () => hideTtsLoading(loadingToken);
        audio.onended = () => {
          if (activeAudio === audio) activeAudio = null;
          hideTtsLoading(loadingToken);
          emitEnd(utterance);
        };
        audio.onerror = () => {
          if (activeAudio === audio) activeAudio = null;
          hideTtsLoading(loadingToken);
          nativeSpeak(utterance);
        };
        emitStart(utterance);
        return audio.play().then(() => hideTtsLoading(loadingToken)).catch((err) => {
          hideTtsLoading(loadingToken);
          throw err;
        });
      })
      .catch(() => {
        hideTtsLoading(loadingToken);
        nativeSpeak(utterance);
      });

    return undefined;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPanel);
  } else {
    renderPanel();
  }
})();
