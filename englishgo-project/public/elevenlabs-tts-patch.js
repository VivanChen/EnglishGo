(() => {
  if (!window.speechSynthesis || window.__englishGoElevenLabsTtsPatch) return;
  window.__englishGoElevenLabsTtsPatch = true;

  const synth = window.speechSynthesis;
  const nativeSpeak = synth.speak.bind(synth);
  const nativeCancel = synth.cancel.bind(synth);
  const nativePause = typeof synth.pause === "function" ? synth.pause.bind(synth) : null;
  const nativeResume = typeof synth.resume === "function" ? synth.resume.bind(synth) : null;
  const audioCache = new Map();
  const inflight = new Map();
  const regenerations = new Map();
  const lookupMisses = new Map();
  const LOOKUP_MISS_TTL = 30_000;
  const MAX_LOOKUP_MISSES = 128;
  const cacheGenerations = new Map();
  const deferredRevocations = new Set();
  const MAX_CACHE_BYTES = 24 * 1024 * 1024;
  const MAX_CACHE_ENTRIES = 128;
  let cacheBytes = 0;
  const MAX_CHARS = 350;
  const LS_PROVIDER = "eg_tts_provider";
  const LS_SPEED = "eg_tts_speed";
  const DEFAULT_PROVIDER = "elevenlabs";
  const DEFAULT_SPEED = 1;
  const SILENT_AUDIO_URL = "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA==";
  const CHINESE_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;
  const PROVIDERS = {
    elevenlabs: { voiceKey: "eg_tts_voice_id", voices: [
      { id: "21m00Tcm4TlvDq8ikWAM", label: "清晰美式（推薦）", accent: "US" },
      { id: "EXAVITQu4vr4xnSDxMaL", label: "溫暖美式", accent: "US" },
      { id: "ErXwobaYiN019PkySvjV", label: "沉穩美式", accent: "US" },
    ] },
    openai: { voiceKey: "eg_openai_tts_voice", voices: [
      { id: "marin", label: "清晰自然（推薦）" },
      { id: "cedar", label: "溫暖沉穩" },
      { id: "coral", label: "明亮親切" },
    ] },
    device: { voices: [] },
  };
  let activeAudio = null;
  let activeAudioPaused = false;
  let lastRegenerableText = "";
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

  function normalizeTtsText(text) {
    const normalized = normalizeText(text);
    // The vocabulary key is lowercase, but this entry means the pronoun “I”.
    return normalized === "i" ? "I" : normalized;
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
    let provider = DEFAULT_PROVIDER;
    let voiceId = PROVIDERS[provider].voices[0].id;
    let speed = DEFAULT_SPEED;
    try {
      const savedProvider = localStorage.getItem(LS_PROVIDER);
      if (Object.hasOwn(PROVIDERS, savedProvider)) provider = savedProvider;
      const { voiceKey, voices } = PROVIDERS[provider];
      voiceId = voiceKey ? localStorage.getItem(voiceKey) || voices[0].id : "";
      if (voiceKey && !voices.some(voice => voice.id === voiceId)) {
        voiceId = voices[0].id;
        localStorage.setItem(voiceKey, voiceId);
      }
      speed = clamp(localStorage.getItem(LS_SPEED), 0.7, 1.2, DEFAULT_SPEED);
    } catch {}
    return { provider, voiceId, speed };
  }

  function applyGlobalSpeechSpeed(utterance) {
    if (!utterance?.__englishGoUseGlobalSpeed || utterance.__englishGoGlobalSpeedApplied || isChineseLang(utterance.lang)) return;
    const baseRate = Number(utterance.rate) || 1;
    utterance.rate = Math.min(10, Math.max(0.1, baseRate * getSettings().speed));
    utterance.__englishGoGlobalSpeedApplied = true;
  }

  function makeCacheKey(text, settings) {
    if (settings.audioUrl) return `asset|${settings.audioUrl}`;
    const normalized = normalizeTtsText(text);
    const pronunciationRevision = /^[A-Za-z]{1,3}$/.test(normalized) ? "short-words-v2|" : "";
    return `${settings.provider}-v1|${settings.lang || "en-US"}|${settings.voiceId || "server-default"}|${settings.speed || DEFAULT_SPEED}|${pronunciationRevision}${normalized}`;
  }

  function revokeUnusedUrl(url) {
    // Let promise consumers attach the URL before deciding whether it is active.
    window.setTimeout(() => {
      if (activeAudio?.src === url) deferredRevocations.add(url);
      else { try { URL.revokeObjectURL(url); } catch {} }
    }, 0);
  }

  function releaseDeferredUrls() {
    for (const url of deferredRevocations) {
      if (activeAudio?.src === url) continue;
      deferredRevocations.delete(url);
      try { URL.revokeObjectURL(url); } catch {}
    }
  }

  function removeCachedAudio(key) {
    const entry = audioCache.get(key);
    if (!entry) return;
    audioCache.delete(key);
    cacheBytes -= entry.bytes;
    revokeUnusedUrl(entry.url);
  }

  function cacheAudio(key, url, bytes) {
    removeCachedAudio(key);
    audioCache.set(key, { url, bytes });
    cacheBytes += bytes;
    while (audioCache.size > MAX_CACHE_ENTRIES || cacheBytes > MAX_CACHE_BYTES) {
      removeCachedAudio(audioCache.keys().next().value);
    }
  }

  function stopActiveAudio() {
    try {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
        activeAudio = null;
        activeAudioPaused = false;
      }
    } catch {}
    releaseDeferredUrls();
  }

  function shouldUseCloudSpeech(utterance) {
    if (utterance?.__englishGoWebSpeechOnly) return false;
    const text = String(utterance?.text || "").trim();
    const lang = String(utterance?.lang || "en-US");
    if (!text || text.length > MAX_CHARS) return false;
    if (utterance?.__englishGoAudioUrl) return true;
    if (getSettings().provider === "device") return false;
    if (typeof utterance.onboundary === "function" && !utterance.__englishGoTrackWords) return false;
    if (/^en/i.test(lang)) return /[A-Za-z]/.test(text);
    if (isChineseLang(lang)) {
      return utterance?.__englishGoApiTts === true && CHINESE_RE.test(text);
    }
    return false;
  }

  function fallbackSpeech(utterance, error) {
    const blocked = error?.name === "NotAllowedError";
    const reason = blocked ? "playback-blocked" : error?.ttsReason || "audio-playback";
    const detail = { text: normalizeText(utterance.text), reason, status: error?.status || null };
    window.dispatchEvent(new CustomEvent("englishgo:tts-fallback", { detail }));
    const notice = document.createElement("div");
    notice.id = "eg-tts-status-toast";
    notice.className = "show";
    notice.setAttribute("role", "status");
    notice.textContent = blocked ? "瀏覽器暫時阻擋播放，請再按一次發音按鈕。"
      : utterance.__englishGoRequireApi ? "雲端發音暫時無法播放，請稍後再試。"
      : reason === "network" ? "發音連線失敗，暫時使用裝置語音。"
      : reason === "api" ? `雲端發音暫時無法使用（${detail.status}），暫時使用裝置語音。`
      : "雲端音訊無法播放，暫時使用裝置語音。";
    document.getElementById(notice.id)?.remove();
    document.body.appendChild(notice);
    window.setTimeout(() => notice.remove(), 5000);
    if (blocked) {
      utterance.onerror?.(new Event("error"));
      return;
    }
    if (utterance.__englishGoRequireApi) {
      utterance.onerror?.(new Event("error"));
      return;
    }
    applyGlobalSpeechSpeed(utterance);
    return nativeSpeak(utterance);
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
      loadingToast.setAttribute("role", "status");
      loadingToast.setAttribute("aria-live", "polite");
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
    const forceRegenerate = options.forceRegenerate === true;
    const fixedAudioUrl = String(options.audioUrl || "").trim();
    const cacheOnly = !fixedAudioUrl && options.cacheOnly === true;
    const baseSettings = getSettings();
    // English cloud voices are selected by voiceId, not by the device's locale.
    // Use the same key for preloads and playback on en-GB/en-AU devices.
    const lang = /^en/i.test(options.lang || "en-US") ? "en-US" : options.lang;
    const settings = {
      ...baseSettings,
      ...options,
      lang,
      voiceId: options.voiceId ?? (isChineseLang(lang) ? undefined : baseSettings.voiceId),
      speed: isChineseLang(lang) ? 1 : options.speed ?? baseSettings.speed,
    };
    // Provider choice is a learner setting, never an arbitrary URL in options.
    settings.provider = baseSettings.provider;
    if (settings.provider === "device" && !options.audioUrl) return null;
    const normalized = normalizeTtsText(text);
    if (!isEligibleText(normalized, settings.lang)) throw new Error("Text is not eligible for cloud speech");
    if (forceRegenerate && options.audioUrl) throw new Error("Fixed audio assets cannot be regenerated");
    if (forceRegenerate && cacheOnly) throw new Error("Cache lookups cannot regenerate speech");
    const cacheKey = makeCacheKey(normalized, settings);
    // A click or a second regeneration should wait for the newest requested
    // audio, instead of reusing an older result or paying for another synthesis.
    if (regenerations.has(cacheKey)) return regenerations.get(cacheKey);
    let generation = cacheGenerations.get(cacheKey) || 0;
    if (forceRegenerate) {
      generation += 1;
      cacheGenerations.set(cacheKey, generation);
      lookupMisses.delete(cacheKey);
      // Older requests may finish, but later clicks must never join their
      // invalidated generation if this regeneration fails first.
      inflight.delete(cacheKey);
      inflight.delete(`${cacheKey}|lookup`);
    }
    if (!forceRegenerate && audioCache.has(cacheKey)) {
      const entry = audioCache.get(cacheKey);
      audioCache.delete(cacheKey);
      audioCache.set(cacheKey, entry);
      return entry.url;
    }
    const inflightKey = forceRegenerate ? `${cacheKey}|regenerate` : cacheOnly ? `${cacheKey}|lookup` : cacheKey;
    if (!forceRegenerate && inflight.has(cacheKey)) return inflight.get(cacheKey);
    if (!forceRegenerate && inflight.has(inflightKey)) return inflight.get(inflightKey);
    if (cacheOnly && lookupMisses.has(cacheKey)) {
      if (lookupMisses.get(cacheKey) > Date.now()) return null;
      lookupMisses.delete(cacheKey);
    }

    const requestUrl = fixedAudioUrl || `/.netlify/functions/${settings.provider === "openai" ? "openai" : "elevenlabs"}-tts`;
    const requestOptions = fixedAudioUrl
      ? { method: "GET", cache: "force-cache", headers: { Accept: "audio/mpeg" } }
      : {
          method: "POST",
          ...(forceRegenerate ? { cache: "no-store" } : {}),
          headers: {
            "Content-Type": "application/json",
            ...(forceRegenerate ? { "Cache-Control": "no-cache" } : {}),
          },
          body: JSON.stringify({ text: normalized, voiceId: settings.voiceId, lang: settings.lang, speed: settings.speed, forceRegenerate, cacheOnly }),
        };

    async function fetchAudio() {
      // Book MP3s are generated before deployment. Reuse their persistent local copy.
      let saved;
      if (fixedAudioUrl.startsWith('/audio/picture-books/') && window.caches) {
        try {
          saved = await window.caches.open('storybook-audio-v1');
          const hit = await saved.match(requestUrl);
          if (hit?.ok && /^audio\//i.test(hit.headers.get('content-type') || '')) return hit;
        } catch { saved = null; }
      }
      let response;
      try {
        response = await fetch(requestUrl, requestOptions);
      } catch (cause) {
        throw Object.assign(new Error("TTS network request failed", { cause }), { ttsReason: "network" });
      }
      if (saved && response.ok && /^audio\//i.test(response.headers.get('content-type') || '')) {
        try { await saved.put(requestUrl, response.clone()); } catch { /* Storage may be full; playback still works. */ }
      }
      return response;
    }
    const promise = fetchAudio()
      .then(async (res) => {
        if (!res.ok) throw Object.assign(new Error(`Cloud speech failed: ${res.status}`), { ttsReason: "api", status: res.status });
        if (cacheOnly && res.status === 204) {
          if ((cacheGenerations.get(cacheKey) || 0) === generation && !audioCache.has(cacheKey)) {
            lookupMisses.delete(cacheKey);
            lookupMisses.set(cacheKey, Date.now() + LOOKUP_MISS_TTL);
            while (lookupMisses.size > MAX_LOOKUP_MISSES) lookupMisses.delete(lookupMisses.keys().next().value);
          }
          return null;
        }
        const blob = await res.blob();
        if (!blob.size || !/^audio\//i.test(blob.type)) throw new Error('TTS response is not audio');
        if (blob.size > MAX_CACHE_BYTES) throw new Error('TTS audio is too large');
        if ((cacheGenerations.get(cacheKey) || 0) !== generation) {
          throw Object.assign(new Error("Speech was superseded by regeneration"), { ttsReason: "stale" });
        }
        if (forceRegenerate) {
          const saved = res.headers.get("X-TTS-Cache-Upload") === "ok";
          const notice = document.createElement("div");
          notice.id = "eg-tts-status-toast";
          notice.className = "show";
          notice.setAttribute("role", "status");
          notice.textContent = saved
            ? "已重新生成發音，並更新快取。"
            : "已重新生成發音，但快取更新失敗；稍後播放可能仍是舊音訊。";
          document.getElementById(notice.id)?.remove();
          document.body.appendChild(notice);
          window.setTimeout(() => notice.remove(), 5000);
        }
        const url = URL.createObjectURL(blob);
        lookupMisses.delete(cacheKey);
        cacheAudio(cacheKey, url, blob.size);
        return url;
      })
      .finally(() => {
        if (inflight.get(inflightKey) === promise) inflight.delete(inflightKey);
        if (regenerations.get(cacheKey) === promise) regenerations.delete(cacheKey);
      });

    inflight.set(inflightKey, promise);
    if (forceRegenerate) regenerations.set(cacheKey, promise);
    return promise;
  }

  function preload(text, options = {}) {
    const preloadOptions = options.audioUrl ? options : { ...options, cacheOnly: true, forceRegenerate: false };
    return getAudioUrl(text, preloadOptions).catch(() => null);
  }

  async function preloadMany(texts, options = {}) {
    const rawItems = Array.isArray(texts) ? texts : [texts];
    const hasFixedAssets = rawItems.some(item => item && typeof item === "object" && item.audioUrl);
    const limit = clamp(options.limit, 1, hasFixedAssets ? 512 : 12, 5);
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
    let readyCount = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const next = items[index++];
        const url = await preload(next.text, next.options);
        if (url) readyCount += 1;
        if (typeof options.onProgress === "function") options.onProgress(readyCount, items.length);
      }
    });

    await Promise.allSettled(workers);
    return readyCount;
  }

  function renderTtsStyles() {
    if (document.getElementById("eg-tts-styles")) return;
    const style = document.createElement("style");
    style.id = "eg-tts-styles";
    style.textContent = `
      #eg-tts-loading-toast,#eg-tts-status-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%) translateY(18px);display:flex;align-items:center;gap:9px;padding:10px 14px;border-radius:999px;background:rgba(15,143,111,.96);color:#fff;font:700 13px system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 10px 24px rgba(0,0,0,.22);z-index:2147483646;opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease;max-width:min(420px,calc(100vw - 32px))}
      #eg-tts-loading-toast.show,#eg-tts-status-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .eg-tts-spinner{width:14px;height:14px;border-radius:999px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:egTtsSpin .75s linear infinite;flex:0 0 auto}
      .eg-tts-loading-target{position:relative;animation:egTtsPulse .9s ease-in-out infinite!important;filter:drop-shadow(0 0 8px rgba(15,143,111,.5))}
      body[data-eg-module="srs"] #eg-tts-loading-toast,body[data-eg-module="srs"] #eg-tts-status-toast{bottom:calc(96px + env(safe-area-inset-bottom,0px))}
      body[data-eg-module="novels"] #eg-tts-loading-toast,body[data-eg-module="novels"] #eg-tts-status-toast{bottom:calc(76px + env(safe-area-inset-bottom,0px))}
      @media (max-width:640px){body[data-eg-module="srs"] #eg-tts-loading-toast,body[data-eg-module="srs"] #eg-tts-status-toast{bottom:calc(112px + env(safe-area-inset-bottom,0px))}}
      @keyframes egTtsSpin{to{transform:rotate(360deg)}}
      @keyframes egTtsPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
    `;
    document.head.appendChild(style);
  }

  window.EnglishGoTTS = {
    getAudioUrl,
    getSettings,
    preload,
    preloadMany,
    getVoiceOptions() {
      return PROVIDERS[getSettings().provider].voices.map(voice => ({ ...voice }));
    },
    getLastRegenerableText() {
      return lastRegenerableText;
    },
    setSettings(settings = {}) {
      const current = getSettings();
      const provider = Object.hasOwn(PROVIDERS, settings.provider) ? settings.provider : current.provider;
      const { voiceKey, voices } = PROVIDERS[provider];
      try {
        if (Object.hasOwn(PROVIDERS, settings.provider)) localStorage.setItem(LS_PROVIDER, provider);
        if (voiceKey && voices.some(voice => voice.id === settings.voiceId)) localStorage.setItem(voiceKey, settings.voiceId);
        if (settings.speed != null) localStorage.setItem(LS_SPEED, String(clamp(settings.speed, 0.7, 1.2, DEFAULT_SPEED)));
      } catch {}
      window.dispatchEvent(new CustomEvent("englishgo:tts-settings-changed", { detail: getSettings() }));
    },
    regenerate(text, lang = "en-US") {
      if (getSettings().provider === "device") return null;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.__englishGoForceRegenerate = true;
      utterance.__englishGoRequireApi = true;
      return synth.speak(utterance);
    },
    regenerateLast() {
      return lastRegenerableText ? window.EnglishGoTTS.regenerate(lastRegenerableText) : null;
    },
    speak(text) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.__englishGoUseGlobalSpeed = true;
      return synth.speak(utterance);
    },
  };
  renderTtsStyles();
  window.dispatchEvent(new CustomEvent("englishgo:tts-installed"));

  synth.cancel = function patchedCancel() {
    stopActiveAudio();
    hideTtsLoading();
    document.getElementById("eg-tts-status-toast")?.remove();
    return nativeCancel();
  };

  synth.pause = function patchedPause() {
    if (activeAudio) {
      activeAudioPaused = true;
      try { activeAudio.pause(); } catch {}
    }
    return nativePause?.();
  };

  synth.resume = function patchedResume() {
    if (activeAudio) {
      activeAudioPaused = false;
      try { activeAudio.play()?.catch?.(() => {}); } catch {}
    }
    return nativeResume?.();
  };

  synth.speak = function patchedSpeak(utterance) {
    document.getElementById("eg-tts-status-toast")?.remove();
    if (utterance && !isChineseLang(utterance.lang) && utterance.__englishGoUseGlobalSpeed !== false) {
      utterance.__englishGoUseGlobalSpeed = true;
    }
    if (!shouldUseCloudSpeech(utterance)) {
      stopActiveAudio();
      hideTtsLoading();
      applyGlobalSpeechSpeed(utterance);
      return nativeSpeak(utterance);
    }

    const text = normalizeTtsText(utterance.text);
    if (!utterance.__englishGoAudioUrl && /^en/i.test(String(utterance.lang || "en-US"))) {
      lastRegenerableText = text;
      window.dispatchEvent(new CustomEvent("englishgo:tts-last-regenerable", { detail: { text } }));
    }

    stopActiveAudio();
    nativeCancel();
    const loadingToken = showTtsLoading(text);
    const audio = new Audio(SILENT_AUDIO_URL);
    activeAudio = audio;
    activeAudioPaused = false;
    audio.muted = true;
    const unlockPlayback = audio.play().catch(() => {});
    const fail = error => {
      // A cancelled/replaced request must never resurrect its old system voice.
      // Clearing activeAudio also makes duplicate media/play errors harmless.
      if (activeAudio !== audio) return;
      stopActiveAudio();
      hideTtsLoading(loadingToken);
      if (error?.ttsReason === "stale") return;
      fallbackSpeech(utterance, error);
    };

    getAudioUrl(text, {
      lang: utterance.lang,
      audioUrl: utterance.__englishGoAudioUrl,
      forceRegenerate: utterance.__englishGoForceRegenerate === true,
    })
      .then((url) => {
        if (activeAudio !== audio) return null;
        audio.pause();
        audio.src = url;
        audio.currentTime = 0;
        audio.muted = false;
        const isFixedEnglishAsset = utterance.__englishGoAudioUrl && utterance.__englishGoUseGlobalSpeed && !isChineseLang(utterance.lang);
        const assetSpeed = isFixedEnglishAsset ? getSettings().speed : 1;
        const localPlaybackRate = clamp(utterance.__englishGoPlaybackRate, 0.7, 1.2, 1);
        audio.playbackRate = isFixedEnglishAsset
          ? clamp(localPlaybackRate * assetSpeed, 0.49, 1.44, 1)
          : clamp(utterance.__englishGoPlaybackRate, 0.7, 1.2, 1);
        audio.volume = typeof utterance.volume === "number" ? utterance.volume : 1;
        audio.oncanplay = () => { if (activeAudio === audio) hideTtsLoading(loadingToken); };
        let started = false;
        audio.onplaying = () => {
          if (activeAudio !== audio) return;
          hideTtsLoading(loadingToken);
          if (utterance.__englishGoTrackWords && !started) { started = true; emitStart(utterance); }
        };
        audio.ontimeupdate = () => {
          if (activeAudio !== audio || audio.paused || !started || !utterance.__englishGoTrackWords) return;
          utterance.onprogress?.({ currentTime: audio.currentTime, duration: audio.duration });
        };
        audio.onended = () => {
          if (activeAudio !== audio) return;
          if (activeAudio === audio) {
            activeAudio = null;
            activeAudioPaused = false;
          }
          releaseDeferredUrls();
          hideTtsLoading(loadingToken);
          emitEnd(utterance);
        };
        audio.onerror = () => fail(audio.error);
        if (!utterance.__englishGoTrackWords) emitStart(utterance);
        return unlockPlayback.then(() => activeAudio !== audio || activeAudioPaused ? null : audio.play())
          .then(() => { if (activeAudio === audio) hideTtsLoading(loadingToken); });
      })
      .catch(fail);

    return undefined;
  };

})();
