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
  const LEGACY_CUSTOM_VOICE = "1AKkSX7KMPHIWuz76m0n";
  const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";
  const DEFAULT_SPEED = 1;
  const SILENT_AUDIO_URL = "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA==";
  const CHINESE_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;
  const VOICES = [
    { id: "21m00Tcm4TlvDq8ikWAM", label: "清晰美式（推薦）", accent: "US" },
    { id: "EXAVITQu4vr4xnSDxMaL", label: "溫暖美式", accent: "US" },
    { id: "ErXwobaYiN019PkySvjV", label: "沉穩美式", accent: "US" },
  ];
  const ALLOWED_VOICE_IDS = new Set(VOICES.map(voice => voice.id));
  let activeAudio = null;
  let loadingToast = null;
  let loadingButton = null;
  let loadingCounter = 0;

  function clamp(n, min, max, fallback) {
    if (n == null || n === "") return fallback;
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
      .replace(/^['"“”‘’]+|['"“”‘’]+$/g, "");
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
      if (voiceId === LEGACY_CUSTOM_VOICE || !ALLOWED_VOICE_IDS.has(voiceId)) {
        voiceId = DEFAULT_VOICE;
        localStorage.setItem(LS_VOICE, DEFAULT_VOICE);
      }
      speed = clamp(localStorage.getItem(LS_SPEED), 0.7, 1.2, DEFAULT_SPEED);
    } catch {}
    return { voiceId, speed };
  }

  function makeCacheKey(text, settings) {
    if (settings.audioUrl) return `asset|${settings.audioUrl}`;
    return `${settings.lang || "en-US"}|${settings.voiceId || "server-default"}|${settings.speed || DEFAULT_SPEED}|${normalizeText(text)}`;
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
    if (utterance?.__englishGoAudioUrl) return true;
    if (typeof utterance.onboundary === "function") return false;
    if (/^en/i.test(lang)) return /[A-Za-z]/.test(text);
    if (isChineseLang(lang)) {
      return utterance?.__englishGoApiTts === true && CHINESE_RE.test(text);
    }
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

    const fixedAudioUrl = String(options.audioUrl || "").trim();
    const requestUrl = fixedAudioUrl || "/.netlify/functions/elevenlabs-tts";
    const requestOptions = fixedAudioUrl
      ? { method: "GET", cache: "force-cache", headers: { Accept: "audio/mpeg" } }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: normalized, voiceId: settings.voiceId, lang: settings.lang, speed: settings.speed }),
        };

    const promise = fetch(requestUrl, requestOptions)
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
    const hasFixedAssets = rawItems.some(item => item && typeof item === "object" && item.audioUrl);
    const limit = clamp(options.limit, 1, hasFixedAssets ? 24 : 12, 5);
    const concurrency = clamp(options.concurrency, 1, 3, 2);
    const seen = new Set();
    const items = [];

    for (const item of rawItems) {
      const itemOptions = item && typeof item === "object" ? { ...options, ...item } : options;
      const normalized = normalizeText(item && typeof item === "object" ? item.text : item);
      const uniqueKey = itemOptions.audioUrl || `${itemOptions.lang || "en-US"}|${normalized}`;
      if (!isEligibleText(normalized, itemOptions.lang) || seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
      items.push({ text: normalized, options: itemOptions });
      if (items.length >= limit) break;
    }

    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const next = items[index++];
        await preload(next.text, next.options);
      }
    });

    await Promise.allSettled(workers);
    return items.length;
  }

  function renderPanel() {
    if (document.getElementById("eg-tts-panel")) return;
    const style = document.createElement("style");
    style.textContent = `
      #eg-tts-panel{position:fixed;right:18px;bottom:calc(18px + env(safe-area-inset-bottom,0px));width:250px;background:rgba(255,255,255,.96);color:#123;border:1px solid rgba(0,0,0,.08);border-radius:16px;box-shadow:0 12px 30px rgba(0,0,0,.18);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;z-index:2147483647;overflow:hidden;font-size:13px;backdrop-filter:blur(10px)}
      #eg-tts-panel.eg-mini{width:auto}
      #eg-tts-panel.eg-mini .eg-body{display:none}
      #eg-tts-panel .eg-head{display:flex;width:100%;min-height:44px;align-items:center;justify-content:space-between;padding:10px 12px;border:0;border-radius:0;background:linear-gradient(135deg,#0f8f6f,#16b88f);color:#fff;font:800 13px system-ui,-apple-system,'Segoe UI',sans-serif;cursor:pointer;text-align:left}
      #eg-tts-panel .eg-body{padding:12px;display:grid;gap:10px}
      #eg-tts-panel label{display:block;font-size:12px;font-weight:700;color:#345;margin-bottom:4px}
      #eg-tts-panel select,#eg-tts-panel input[type=range]{width:100%}
      #eg-tts-panel select{border:1px solid #d9e2e7;border-radius:10px;padding:7px;background:#fff}
      #eg-tts-panel .eg-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
      #eg-tts-panel .eg-chip{font-size:12px;background:#eef8f4;border-radius:999px;padding:3px 8px;color:#087557;font-weight:700}
      #eg-tts-panel button{border:0;border-radius:10px;padding:7px 9px;background:#0f8f6f;color:#fff;font-weight:800;cursor:pointer;flex-shrink:0}
      #eg-tts-panel .eg-small{font-size:11px;color:#789;line-height:1.35}
      #eg-tts-loading-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%) translateY(18px);display:flex;align-items:center;gap:9px;padding:10px 14px;border-radius:999px;background:rgba(15,143,111,.96);color:#fff;font:700 13px system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 10px 24px rgba(0,0,0,.22);z-index:2147483646;opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease;max-width:min(420px,calc(100vw - 32px))}
      body[data-eg-module="srs"] #eg-tts-panel{bottom:calc(96px + env(safe-area-inset-bottom,0px))}
      body[data-eg-module="srs"] #eg-tts-loading-toast{bottom:calc(96px + env(safe-area-inset-bottom,0px))}
      body[data-eg-module="srs"]:has(.srs-page.has-dict) #eg-tts-panel{display:none}
      #eg-tts-loading-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .eg-tts-spinner{width:14px;height:14px;border-radius:999px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:egTtsSpin .75s linear infinite;flex:0 0 auto}
      .eg-tts-loading-target{position:relative;animation:egTtsPulse .9s ease-in-out infinite!important;filter:drop-shadow(0 0 8px rgba(15,143,111,.5))}
      @media (max-width:640px){
        #eg-tts-panel{right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));width:min(250px,calc(100vw - 20px))}
        #eg-tts-panel.eg-mini{width:48px;height:48px;max-width:none;border-radius:999px}
        #eg-tts-panel.eg-mini .eg-head{width:48px;height:48px;min-height:48px;padding:0;justify-content:center;border-radius:999px;font-size:0}
        #eg-tts-panel.eg-mini .eg-head span:first-child:before{content:"🎧";font-size:21px}
        #eg-tts-panel.eg-mini #eg-tts-toggle{display:none}
        body[data-eg-module="srs"] #eg-tts-panel{display:none}
        body[data-eg-module="srs"] #eg-tts-loading-toast{bottom:calc(112px + env(safe-area-inset-bottom,0px))}
      }
      @keyframes egTtsSpin{to{transform:rotate(360deg)}}
      @keyframes egTtsPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
    `;
    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.id = "eg-tts-panel";
    panel.innerHTML = `
      <button type="button" class="eg-head" aria-label="發音設定" aria-expanded="false" aria-controls="eg-tts-body" title="展開發音設定"><span>🎧 發音設定</span><span id="eg-tts-toggle" aria-hidden="true">−</span></button>
      <div class="eg-body" id="eg-tts-body">
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
          <span class="eg-small">雲端自然語速；連線失敗時自動改用裝置語音</span>
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
    panel.querySelector("#eg-tts-test").addEventListener("click", () => window.EnglishGoTTS.speak("I packed three apples for our train ride this morning."));
    head.addEventListener("click", () => {
      panel.classList.toggle("eg-mini");
      const minimized = panel.classList.contains("eg-mini");
      toggle.textContent = minimized ? "+" : "−";
      head.setAttribute("aria-expanded", String(!minimized));
      head.title = minimized ? "展開發音設定" : "收合發音設定";
    });
    window.addEventListener("englishgo:tts-settings-changed", sync);
    sync();
  }

  window.EnglishGoTTS = {
    getAudioUrl,
    getSettings,
    preload,
    preloadMany,
    getVoiceOptions() {
      return VOICES.map(voice => ({ ...voice }));
    },
    setSettings(settings = {}) {
      try {
        if (settings.voiceId && ALLOWED_VOICE_IDS.has(settings.voiceId)) localStorage.setItem(LS_VOICE, settings.voiceId);
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
  window.dispatchEvent(new CustomEvent("englishgo:tts-installed"));

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
    const audio = new Audio(SILENT_AUDIO_URL);
    activeAudio = audio;
    audio.muted = true;
    const unlockPlayback = audio.play().catch(() => {});

    getAudioUrl(text, { lang: utterance.lang, audioUrl: utterance.__englishGoAudioUrl })
      .then((url) => {
        if (activeAudio !== audio) return null;
        audio.pause();
        audio.src = url;
        audio.currentTime = 0;
        audio.muted = false;
        audio.playbackRate = 1;
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
        return unlockPlayback.then(() => audio.play()).then(() => hideTtsLoading(loadingToken)).catch((err) => {
          hideTtsLoading(loadingToken);
          throw err;
        });
      })
      .catch(() => {
        if (activeAudio === audio) activeAudio = null;
        try { audio.pause(); } catch {}
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
