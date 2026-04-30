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
  let activeAudio = null;

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
    try {
      voiceId = localStorage.getItem(LS_VOICE) || DEFAULT_VOICE;
      speed = clamp(localStorage.getItem(LS_SPEED), 0.7, 1.2, DEFAULT_SPEED);
    } catch {}
    return { voiceId, speed };
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
    if (typeof utterance.onboundary === "function") return false; // keep browser TTS for word highlighting
    return true;
  }

  function emitEnd(utterance) {
    try {
      if (typeof utterance.onend === "function") {
        utterance.onend(new Event("end"));
      }
    } catch {}
  }

  function emitStart(utterance) {
    try {
      if (typeof utterance.onstart === "function") {
        utterance.onstart(new Event("start"));
      }
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
    const unique = [...new Set((texts || []).map(normalizeText).filter(t => /[a-z]/i.test(t) && t.length <= MAX_CHARS))].slice(0, 25);
    for (const text of unique) {
      getAudioUrl(text, options).catch(() => {});
      await new Promise(r => setTimeout(r, 250));
    }
  }

  window.EnglishGoTTS = {
    getSettings,
    setSettings(settings = {}) {
      try {
        if (settings.voiceId) localStorage.setItem(LS_VOICE, settings.voiceId);
        if (settings.speed != null) localStorage.setItem(LS_SPEED, String(clamp(settings.speed, 0.7, 1.2, DEFAULT_SPEED)));
      } catch {}
      window.dispatchEvent(new CustomEvent("englishgo:tts-settings-changed", { detail: getSettings() }));
    },
    preload: warmupTexts,
    speak(text, options = {}) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      return synth.speak(utterance, options);
    },
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
})();
