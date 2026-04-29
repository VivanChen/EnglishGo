(() => {
  if (!window.speechSynthesis || window.__englishGoElevenLabsTtsPatch) return;
  window.__englishGoElevenLabsTtsPatch = true;

  const synth = window.speechSynthesis;
  const nativeSpeak = synth.speak.bind(synth);
  const nativeCancel = synth.cancel.bind(synth);
  const audioCache = new Map();
  const MAX_CHARS = 350;
  let activeAudio = null;

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

  async function getAudioUrl(text) {
    if (audioCache.has(text)) return audioCache.get(text);

    const res = await fetch("/.netlify/functions/elevenlabs-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    audioCache.set(text, url);

    if (audioCache.size > 80) {
      const firstKey = audioCache.keys().next().value;
      try { URL.revokeObjectURL(audioCache.get(firstKey)); } catch {}
      audioCache.delete(firstKey);
    }

    return url;
  }

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
        audio.playbackRate = Math.min(1.25, Math.max(0.65, Number(utterance.rate || 1)));
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
