import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const patchSource = readFileSync(path.join(process.cwd(), "public", "elevenlabs-tts-patch.js"), "utf8");
let environmentCount = 0;

function installPatchEnv() {
  document.body.innerHTML = "";
  delete window.__englishGoElevenLabsTtsPatch;
  localStorage.clear();

  const nativeSpeak = vi.fn();
  const nativeCancel = vi.fn();
  const nativePause = vi.fn();
  const nativeResume = vi.fn();

  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      speak: nativeSpeak,
      cancel: nativeCancel,
      pause: nativePause,
      resume: nativeResume,
      getVoices: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });

  class TestUtterance {
    constructor(text) {
      this.text = text;
      this.lang = "en-US";
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
    }
  }

  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    configurable: true,
    value: TestUtterance,
  });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: TestUtterance,
  });
  let objectUrlCount = 0;
  const environmentId = ++environmentCount;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => `blob:test-audio-${environmentId}-${++objectUrlCount}`),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });

  return { nativeSpeak, nativeCancel, nativePause, nativeResume };
}

function loadPatch(provider = "openai") {
  if (provider) localStorage.setItem("eg_tts_provider", provider);
  window.eval(patchSource);
}

describe("Speech provider adapter", () => {
  it("retains ElevenLabs as the default without requiring a new key", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("mp3", { headers: { "Content-Type": "audio/mpeg" } })));
    localStorage.setItem("eg_tts_voice_id", "EXAVITQu4vr4xnSDxMaL");
    loadPatch(null);

    expect(window.EnglishGoTTS.getSettings()).toEqual({ provider: "elevenlabs", voiceId: "EXAVITQu4vr4xnSDxMaL", speed: 1 });
    await window.EnglishGoTTS.getAudioUrl("apple");
    expect(fetch.mock.calls[0][0]).toBe("/.netlify/functions/elevenlabs-tts");
    expect(JSON.parse(fetch.mock.calls[0][1].body).voiceId).toBe("EXAVITQu4vr4xnSDxMaL");
    expect(localStorage.getItem("eg_openai_tts_voice")).toBeNull();
  });

  it("preserves separate voice choices when switching APIs with the previous settings object", () => {
    installPatchEnv();
    localStorage.setItem("eg_tts_voice_id", "EXAVITQu4vr4xnSDxMaL");
    localStorage.setItem("eg_openai_tts_voice", "cedar");
    loadPatch(null);
    window.EnglishGoTTS.setSettings({ ...window.EnglishGoTTS.getSettings(), provider: "openai" });
    expect(window.EnglishGoTTS.getSettings().voiceId).toBe("cedar");
    window.EnglishGoTTS.setSettings({ voiceId: "coral" });
    window.EnglishGoTTS.setSettings({ ...window.EnglishGoTTS.getSettings(), provider: "elevenlabs" });
    expect(window.EnglishGoTTS.getSettings().voiceId).toBe("EXAVITQu4vr4xnSDxMaL");
    window.EnglishGoTTS.setSettings({ provider: "openai" });
    expect(window.EnglishGoTTS.getSettings().voiceId).toBe("coral");
  });

  it("never mixes cached pronunciation between providers", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("audio", { headers: { "Content-Type": "audio/wav" } })));
    loadPatch(null);
    const elevenlabs = await window.EnglishGoTTS.getAudioUrl("apple");
    window.EnglishGoTTS.setSettings({ provider: "openai" });
    const openai = await window.EnglishGoTTS.getAudioUrl("apple");
    window.EnglishGoTTS.setSettings({ provider: "elevenlabs" });
    expect(await window.EnglishGoTTS.getAudioUrl("apple")).toBe(elevenlabs);
    window.EnglishGoTTS.setSettings({ provider: "openai" });
    expect(await window.EnglishGoTTS.getAudioUrl("apple")).toBe(openai);
    expect(openai).not.toBe(elevenlabs);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/.netlify/functions/elevenlabs-tts", "/.netlify/functions/openai-tts"]);
  });

  it("keeps an older in-flight response in its original provider cache after switching", async () => {
    installPatchEnv();
    let finishElevenLabs;
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { finishElevenLabs = resolve; }))
      .mockResolvedValueOnce(new Response("openai", { headers: { "Content-Type": "audio/wav" } }));
    loadPatch(null);
    const pendingElevenLabs = window.EnglishGoTTS.getAudioUrl("apple");
    window.EnglishGoTTS.setSettings({ provider: "openai" });
    const openai = await window.EnglishGoTTS.getAudioUrl("apple");
    finishElevenLabs(new Response("elevenlabs", { headers: { "Content-Type": "audio/mpeg" } }));
    const elevenlabs = await pendingElevenLabs;
    expect(await window.EnglishGoTTS.getAudioUrl("apple")).toBe(openai);
    window.EnglishGoTTS.setSettings({ provider: "elevenlabs" });
    expect(await window.EnglishGoTTS.getAudioUrl("apple")).toBe(elevenlabs);
    expect(elevenlabs).not.toBe(openai);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("uses device speech without dynamic API requests or preloads, while fixed recordings still work", async () => {
    const { nativeSpeak } = installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("mp3", { headers: { "Content-Type": "audio/mpeg" } })));
    globalThis.Audio = vi.fn(() => ({ play: vi.fn(() => Promise.resolve()), pause: vi.fn() }));
    loadPatch("device");
    expect(window.EnglishGoTTS.getSettings()).toEqual({ provider: "device", voiceId: "", speed: 1 });
    expect(window.EnglishGoTTS.getVoiceOptions()).toEqual([]);
    const utterance = new SpeechSynthesisUtterance("apple");
    window.speechSynthesis.speak(utterance);
    expect(nativeSpeak).toHaveBeenCalledExactlyOnceWith(utterance);
    expect(await window.EnglishGoTTS.preloadMany(["apple", "book"])).toBe(0);
    expect(window.EnglishGoTTS.regenerate("apple")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    const recording = new SpeechSynthesisUtterance("The fox sits.");
    recording.__englishGoAudioUrl = "/audio/picture-books/fox.mp3";
    window.speechSynthesis.speak(recording);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch.mock.calls[0][0]).toBe(recording.__englishGoAudioUrl);
    expect(nativeSpeak).toHaveBeenCalledTimes(1);
  });
  it.each(['cancel', 'replace'])("ignores an old word request failing after %s", async action => {
    const { nativeSpeak } = installPatchEnv();
    let reject;
    globalThis.fetch = vi.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
      .mockImplementation(() => new Promise(() => {}));
    globalThis.Audio = vi.fn(() => ({ play: vi.fn(() => Promise.resolve()), pause: vi.fn() }));
    loadPatch();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance('apple'));
    if (action === 'cancel') window.speechSynthesis.cancel();
    else window.speechSynthesis.speak(new SpeechSynthesisUtterance('book'));
    reject(new Error('offline'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(nativeSpeak).not.toHaveBeenCalled();
    expect(document.getElementById('eg-tts-status-toast')).toBeNull();
  });

  it("shares English preloaded audio with a device using a British voice", async () => {
    const { nativeSpeak } = installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('mp3', { headers: { 'Content-Type': 'audio/mpeg' } })));
    const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn() };
    globalThis.Audio = vi.fn(() => audio);
    loadPatch();
    await window.EnglishGoTTS.preload('apple');
    const u = new SpeechSynthesisUtterance('apple'); u.lang = 'en-GB';
    window.speechSynthesis.speak(u);
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(nativeSpeak).not.toHaveBeenCalled();
  });

  it.each(["elevenlabs", "openai"])("only looks up saved %s audio while preloading and silently skips missing clips", async provider => {
    installPatchEnv();
    let paidRequests = 0;
    globalThis.fetch = vi.fn(async (_, options) => {
      const body = JSON.parse(options.body);
      if (body.cacheOnly) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
      paidRequests += 1;
      return new Response("audio", { headers: { "Content-Type": "audio/wav" } });
    });
    loadPatch(provider);
    const progress = vi.fn();
    expect(await window.EnglishGoTTS.preloadMany(["apple", "book"], { onProgress: progress })).toBe(0);
    expect(progress).toHaveBeenLastCalledWith(0, 2);
    expect(paidRequests).toBe(0);
    expect(fetch.mock.calls.every(([url, options]) => url === `/.netlify/functions/${provider}-tts` && JSON.parse(options.body).cacheOnly === true)).toBe(true);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(document.getElementById("eg-tts-status-toast")).toBeNull();
    await window.EnglishGoTTS.getAudioUrl("apple");
    expect(paidRequests).toBe(1);
  });

  it("keeps preloading cache-only even if callers pass a regeneration option", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 204 }));
    loadPatch();
    expect(await window.EnglishGoTTS.preload("apple", { forceRegenerate: true })).toBeNull();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ cacheOnly: true, forceRegenerate: false });
  });

  it("starts explicit playback independently of a pending cache-only lookup miss", async () => {
    installPatchEnv();
    let finishLookup;
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { finishLookup = resolve; }))
      .mockResolvedValueOnce(new Response("new audio", { headers: { "Content-Type": "audio/wav" } }));
    loadPatch();
    const lookup = window.EnglishGoTTS.preload("apple");
    const audio = await window.EnglishGoTTS.getAudioUrl("apple");
    expect(fetch.mock.calls.map(([, options]) => JSON.parse(options.body).cacheOnly)).toEqual([true, false]);
    finishLookup(new Response(null, { status: 204 }));
    expect(await lookup).toBeNull();
    expect(await window.EnglishGoTTS.preload("apple")).toBe(audio);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("briefly remembers lookup misses while explicit plays bypass those misses", async () => {
    installPatchEnv();
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    globalThis.fetch = vi.fn(async (_, options) => JSON.parse(options.body).cacheOnly
      ? new Response(null, { status: 204 })
      : new Response("audio", { headers: { "Content-Type": "audio/wav" } }));
    loadPatch();
    await window.EnglishGoTTS.preload("apple");
    await window.EnglishGoTTS.preload("apple");
    expect(fetch).toHaveBeenCalledOnce();
    now += 30001;
    await window.EnglishGoTTS.preload("apple");
    expect(fetch).toHaveBeenCalledTimes(2);
    const audio = await window.EnglishGoTTS.getAudioUrl("apple");
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(await window.EnglishGoTTS.preload("apple")).toBe(audio);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("bounds remembered lookup misses and keeps them separate for each provider", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 204 }));
    loadPatch();
    for (let index = 0; index < 129; index += 1) await window.EnglishGoTTS.preload(`word ${index}`);
    await window.EnglishGoTTS.preload("word 128");
    expect(fetch).toHaveBeenCalledTimes(129);
    await window.EnglishGoTTS.preload("word 0");
    expect(fetch).toHaveBeenCalledTimes(130);
    window.EnglishGoTTS.setSettings({ provider: "elevenlabs" });
    await window.EnglishGoTTS.preload("word 0");
    expect(fetch).toHaveBeenCalledTimes(131);
    expect(fetch.mock.calls.at(-1)[0]).toBe("/.netlify/functions/elevenlabs-tts");
  });

  it("explains API failures while keeping the current word's device fallback", async () => {
    const { nativeSpeak } = installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('', { status: 500 })));
    globalThis.Audio = vi.fn(() => ({ play: vi.fn(() => Promise.resolve()), pause: vi.fn() }));
    loadPatch();
    const u = new SpeechSynthesisUtterance('apple');
    window.speechSynthesis.speak(u);
    await vi.waitFor(() => expect(nativeSpeak).toHaveBeenCalledExactlyOnceWith(u));
    expect(document.getElementById('eg-tts-status-toast')).toHaveTextContent('500');
  });

  it("asks for a new click when playback is blocked instead of switching voices", async () => {
    const { nativeSpeak } = installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('mp3', { headers: { 'Content-Type': 'audio/mpeg' } })));
    const audio = { play: vi.fn().mockResolvedValueOnce().mockRejectedValue(new DOMException('blocked', 'NotAllowedError')), pause: vi.fn() };
    globalThis.Audio = vi.fn(() => audio);
    loadPatch();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance('apple'));
    await vi.waitFor(() => expect(document.getElementById('eg-tts-status-toast')).toHaveTextContent('請再按一次'));
    expect(nativeSpeak).not.toHaveBeenCalled();
  });

  it("ignores stale word audio events and only falls back once for a current media failure", async () => {
    const { nativeSpeak } = installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('mp3', { headers: { 'Content-Type': 'audio/mpeg' } })));
    const audios = [];
    globalThis.Audio = vi.fn(() => { const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn() }; audios.push(audio); return audio; });
    loadPatch();
    const old = new SpeechSynthesisUtterance('apple'); old.onend = vi.fn();
    window.speechSynthesis.speak(old);
    await vi.waitFor(() => expect(audios[0].onerror).toBeTypeOf('function'));
    const next = new SpeechSynthesisUtterance('book');
    window.speechSynthesis.speak(next);
    audios[0].onerror(); audios[0].onended();
    expect(nativeSpeak).not.toHaveBeenCalled(); expect(old.onend).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(audios[1].onerror).toBeTypeOf('function'));
    audios[1].onerror(); audios[1].onerror();
    expect(nativeSpeak).toHaveBeenCalledExactlyOnceWith(next);
  });

  it("reports API-only book failures instead of silently using a system voice", async () => {
    const { nativeSpeak } = installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')));
    globalThis.Audio = vi.fn(() => ({play:vi.fn(() => Promise.resolve()),pause:vi.fn()}));
    loadPatch();
    const u = new SpeechSynthesisUtterance('Pip was a little fox.');
    u.__englishGoRequireApi = true; u.__englishGoTrackWords = true; u.onerror = vi.fn();
    window.speechSynthesis.speak(u);
    await vi.waitFor(() => expect(u.onerror).toHaveBeenCalledOnce());
    expect(nativeSpeak).not.toHaveBeenCalled();
  });
  it("does not report an HTML fallback page as downloaded audio", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('<html>app</html>', { headers: { 'Content-Type': 'text/html' } })));
    loadPatch();
    const ready = await window.EnglishGoTTS.preloadMany([{ text: 'A fox.', audioUrl: '/missing-audio' }]);
    expect(ready).toBe(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("starts story word tracking on actual playback, freezes paused progress, and ignores cancelled audio", async () => {
    const { nativeSpeak } = installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('mp3', {headers:{'Content-Type':'audio/mpeg'}})));
    const audio = { play:vi.fn(() => Promise.resolve()), pause:vi.fn(), currentTime:0, duration:8, paused:false };
    globalThis.Audio = vi.fn(() => audio);
    loadPatch();
    const utterance = new SpeechSynthesisUtterance('A little fox looks up.');
    utterance.__englishGoTrackWords = true;
    utterance.__englishGoPlaybackRate = .8;
    utterance.onboundary = vi.fn(); utterance.onstart = vi.fn(); utterance.onprogress = vi.fn();
    window.speechSynthesis.speak(utterance);
    await vi.waitFor(() => expect(audio.onplaying).toBeTypeOf('function'));
    expect(nativeSpeak).not.toHaveBeenCalled();
    expect(audio.playbackRate).toBe(.8);
    expect(utterance.onstart).not.toHaveBeenCalled();
    audio.onplaying(); audio.onplaying();
    expect(utterance.onstart).toHaveBeenCalledOnce();
    audio.currentTime = 2; audio.ontimeupdate();
    expect(utterance.onprogress).toHaveBeenCalledWith({currentTime:2,duration:8});
    audio.paused = true; audio.currentTime = 3; audio.ontimeupdate();
    expect(utterance.onprogress).toHaveBeenCalledTimes(1);
    window.speechSynthesis.cancel(); audio.paused = false; audio.ontimeupdate(); audio.onerror();
    expect(utterance.onprogress).toHaveBeenCalledTimes(1);
    expect(nativeSpeak).not.toHaveBeenCalled();
  });

  it("does not speak an old story when its request fails after cancellation", async () => {
    const { nativeSpeak } = installPatchEnv();
    let reject;
    globalThis.fetch = vi.fn(() => new Promise((_, fail) => { reject = fail; }));
    globalThis.Audio = vi.fn(() => ({play:vi.fn(() => Promise.resolve()),pause:vi.fn(),currentTime:0}));
    loadPatch();
    const utterance = new SpeechSynthesisUtterance('The old page.');
    utterance.__englishGoTrackWords = true;
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.cancel();
    reject(new Error('network unavailable'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(nativeSpeak).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads in the browser without syntax errors", () => {
    installPatchEnv();

    expect(() => loadPatch()).not.toThrow();
  });

  it("exposes voice settings without injecting a floating panel", () => {
    installPatchEnv();
    loadPatch();

    expect(document.querySelector("#eg-tts-panel")).toBeNull();
    expect(window.EnglishGoTTS.getVoiceOptions()).toHaveLength(3);
    expect(window.EnglishGoTTS.getSettings().speed).toBe(1);
  });

  it("keeps TTS status feedback clear of the mobile novel reader", () => {
    installPatchEnv();
    loadPatch();

    const styles = Array.from(document.querySelectorAll("style")).map(style => style.textContent).join("\n");
    expect(styles).not.toContain("#eg-tts-panel");
    expect(styles).toContain('body[data-eg-module="novels"] #eg-tts-loading-toast,body[data-eg-module="novels"] #eg-tts-status-toast{bottom:calc(76px + env(safe-area-inset-bottom,0px))}');
  });

  it("starts with an OpenAI voice without overwriting the legacy provider preference", () => {
    installPatchEnv();
    localStorage.setItem("eg_tts_voice_id", "1AKkSX7KMPHIWuz76m0n");
    localStorage.setItem("eg_tts_speed", "0.8");
    loadPatch();

    expect(window.EnglishGoTTS.getSettings()).toEqual({
      provider: "openai",
      voiceId: "marin",
      speed: 0.8,
    });
    expect(window.EnglishGoTTS.getVoiceOptions().map(voice => voice.id)).toEqual(["marin", "cedar", "coral"]);
    expect(localStorage.getItem("eg_tts_voice_id")).toBe("1AKkSX7KMPHIWuz76m0n");
    expect(document.querySelector("#eg-tts-panel")).toBeNull();
  });

  it("restores OpenAI voice settings independently of legacy ElevenLabs ids", () => {
    installPatchEnv();
    localStorage.setItem("eg_tts_voice_id", "EXAVITQu4vr4xnSDxMaL");
    localStorage.setItem("eg_openai_tts_voice", "cedar");
    loadPatch();

    expect(window.EnglishGoTTS.getSettings().voiceId).toBe("cedar");
    window.EnglishGoTTS.setSettings({ voiceId: "coral", speed: 1.2 });
    expect(localStorage.getItem("eg_openai_tts_voice")).toBe("coral");
    expect(localStorage.getItem("eg_tts_voice_id")).toBe("EXAVITQu4vr4xnSDxMaL");
    expect(window.EnglishGoTTS.getSettings()).toEqual({ provider: "openai", voiceId: "coral", speed: 1.2 });
  });

  it("repairs an unsupported stored OpenAI voice", () => {
    installPatchEnv();
    localStorage.setItem("eg_openai_tts_voice", "21m00Tcm4TlvDq8ikWAM");
    loadPatch();

    expect(window.EnglishGoTTS.getSettings().voiceId).toBe("marin");
    expect(localStorage.getItem("eg_openai_tts_voice")).toBe("marin");
  });

  it("ignores unapproved voice ids", () => {
    installPatchEnv();
    loadPatch();

    window.EnglishGoTTS.setSettings({ voiceId: "unknown-cloned-voice" });

    expect(window.EnglishGoTTS.getSettings().voiceId).toBe("marin");
  });

  it("preserves capitalization and sentence punctuation in API requests", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("mp3", { headers: { "Content-Type": "audio/mpeg" } })));
    loadPatch();

    await window.EnglishGoTTS.getAudioUrl("Do I take the US bus?");

    const payload = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(globalThis.fetch.mock.calls[0][0]).toBe("/.netlify/functions/openai-tts");
    expect(globalThis.fetch.mock.calls[0][1].method).toBe("POST");
    expect(payload.text).toBe("Do I take the US bus?");
    expect(payload.voiceId).toBe("marin");
    expect(payload.speed).toBe(1);
  });

  it("reuses dynamic audio for the same OpenAI voice and fetches new audio when the voice changes", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("mp3", { headers: { "Content-Type": "audio/mpeg" } })));
    loadPatch();

    await window.EnglishGoTTS.getAudioUrl("apple");
    await window.EnglishGoTTS.getAudioUrl("apple");
    window.EnglishGoTTS.setSettings({ voiceId: "cedar" });
    await window.EnglishGoTTS.getAudioUrl("apple");
    window.EnglishGoTTS.setSettings({ voiceId: "marin" });
    await window.EnglishGoTTS.getAudioUrl("apple");

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(globalThis.fetch.mock.calls.map(([url, options]) => [url, JSON.parse(options.body).voiceId])).toEqual([
      ["/.netlify/functions/openai-tts", "marin"],
      ["/.netlify/functions/openai-tts", "cedar"],
    ]);
  });

  it("keeps dictionary speech on the device without calling OpenAI", () => {
    const { nativeSpeak } = installPatchEnv();
    globalThis.fetch = vi.fn();
    loadPatch();
    const utterance = new SpeechSynthesisUtterance("dictionary");
    utterance.__englishGoWebSpeechOnly = true;

    window.speechSynthesis.speak(utterance);

    expect(nativeSpeak).toHaveBeenCalledExactlyOnceWith(utterance);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("loads fixed novel narration through its immutable GET URL", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("mp3", { headers: { "Content-Type": "audio/mpeg" } })));
    loadPatch();
    const audioUrl = "/.netlify/functions/elevenlabs-tts?novel=v1-story-c1-en-block-0-hash";

    await window.EnglishGoTTS.getAudioUrl("The forest is quiet.", { lang: "en-US", audioUrl });

    expect(globalThis.fetch).toHaveBeenCalledWith(audioUrl, expect.objectContaining({
      method: "GET",
      cache: "force-cache",
    }));
  });

  it("preloads object-based English and Chinese novel audio items", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("mp3", { headers: { "Content-Type": "audio/mpeg" } })));
    loadPatch();

    const readyCount = await window.EnglishGoTTS.preloadMany([
      { text: "The forest is quiet.", lang: "en-US", audioUrl: "/audio-en" },
      { text: "森林很安靜。", lang: "zh-TW", audioUrl: "/audio-zh" },
    ], { limit: 2, concurrency: 2 });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(globalThis.fetch.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining(["/audio-en", "/audio-zh"]));
    expect(readyCount).toBe(2);
  });

  it("reports only successfully prepared audio items", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(url => url === "/audio-ok"
      ? Promise.resolve(new Response("mp3", { headers: { "Content-Type": "audio/mpeg" } }))
      : Promise.resolve(new Response("missing", { status: 404 })));
    loadPatch();

    const readyCount = await window.EnglishGoTTS.preloadMany([
      { text: "The forest is quiet.", lang: "en-US", audioUrl: "/audio-ok" },
      { text: "The river is quiet.", lang: "en-US", audioUrl: "/audio-missing" },
    ], { limit: 2, concurrency: 2 });

    expect(readyCount).toBe(1);
  });

  it("keeps unmarked Chinese speech on native browser speech", () => {
    const { nativeSpeak } = installPatchEnv();
    loadPatch();

    const utterance = new SpeechSynthesisUtterance("\u9019\u662f\u4e00\u53e5\u4e2d\u6587\u3002");
    utterance.lang = "zh-TW";
    window.speechSynthesis.speak(utterance);

    expect(nativeSpeak).toHaveBeenCalledWith(utterance);
  });

  it("routes novel-marked Chinese speech through the fixed API voice", () => {
    const { nativeSpeak } = installPatchEnv();
    globalThis.fetch = vi.fn(() => new Promise(() => {}));
    const audio = {
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      currentTime: 0,
      playbackRate: 1,
      volume: 1,
    };
    globalThis.Audio = vi.fn(() => audio);
    loadPatch();

    const utterance = new SpeechSynthesisUtterance("\u9019\u662f\u5c0f\u8aaa\u7684\u4e2d\u6587\u65c1\u767d\u3002");
    utterance.lang = "zh-TW";
    utterance.__englishGoApiTts = true;
    window.speechSynthesis.speak(utterance);

    expect(nativeSpeak).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(payload).toMatchObject({
      text: "\u9019\u662f\u5c0f\u8aaa\u7684\u4e2d\u6587\u65c1\u767d\u3002",
      lang: "zh-TW",
      speed: 1,
    });
    expect(payload).not.toHaveProperty("voiceId");
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("unlocks English audio during the click before the API response arrives", () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(() => new Promise(() => {}));
    const audio = {
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      currentTime: 0,
      playbackRate: 1,
      volume: 1,
    };
    globalThis.Audio = vi.fn(() => audio);
    loadPatch();

    const utterance = new SpeechSynthesisUtterance("The forest is quiet.");
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);

    expect(globalThis.fetch).toHaveBeenCalled();
    expect(document.getElementById("eg-tts-loading-toast")).toHaveAttribute("role", "status");
    expect(document.getElementById("eg-tts-loading-toast")).toHaveTextContent("正在準備發音");
    expect(globalThis.Audio).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("pauses and resumes active cloud audio instead of only native speech", () => {
    const { nativePause, nativeResume } = installPatchEnv();
    globalThis.fetch = vi.fn(() => new Promise(() => {}));
    const audio = {
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      currentTime: 0,
      playbackRate: 1,
      volume: 1,
    };
    globalThis.Audio = vi.fn(() => audio);
    loadPatch();

    const utterance = new SpeechSynthesisUtterance("The forest is quiet.");
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.pause();
    window.speechSynthesis.resume();

    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(nativePause).toHaveBeenCalledTimes(1);
    expect(nativeResume).toHaveBeenCalledTimes(1);
  });

  it("evicts old blobs above 128 cached entries", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("mp3", { headers: { "Content-Type": "audio/mpeg" } })));
    loadPatch();
    const first = await window.EnglishGoTTS.getAudioUrl("word 0");
    for (let index = 1; index < 129; index += 1) await window.EnglishGoTTS.getAudioUrl(`word ${index}`);
    await window.EnglishGoTTS.getAudioUrl("word 128");
    expect(fetch).toHaveBeenCalledTimes(129);
    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith(first));
    await window.EnglishGoTTS.getAudioUrl("word 0");
    expect(fetch).toHaveBeenCalledTimes(130);
  });

  it("bounds cached audio at 24 MB and delays revoking an evicted playing URL until playback ends", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(async () => ({ ok: true, headers: new Headers(), blob: async () => ({ size: 4 * 1024 * 1024, type: "audio/wav" }) }));
    const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn() };
    globalThis.Audio = vi.fn(() => audio);
    loadPatch();
    window.EnglishGoTTS.speak("playing");
    await vi.waitFor(() => expect(audio.onended).toBeTypeOf("function"));
    const activeUrl = audio.src;
    for (let index = 0; index < 6; index += 1) await window.EnglishGoTTS.getAudioUrl(`large ${index}`);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(activeUrl);
    const pauses = audio.pause.mock.calls.length;
    expect(audio.src).toBe(activeUrl);
    audio.onended();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(activeUrl);
    expect(audio.pause).toHaveBeenCalledTimes(pauses);
    await window.EnglishGoTTS.getAudioUrl("playing");
    expect(fetch).toHaveBeenCalledTimes(8);
  });

  it("drops superseded generation responses before allocating a blob URL or starting fallback speech", async () => {
    const { nativeSpeak } = installPatchEnv();
    let finishOld;
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockResolvedValueOnce(new Response("new", { headers: { "Content-Type": "audio/wav", "X-TTS-Cache-Upload": "ok" } }));
    globalThis.Audio = vi.fn(() => ({ play: vi.fn(() => Promise.resolve()), pause: vi.fn() }));
    loadPatch();
    window.EnglishGoTTS.speak("apple");
    window.EnglishGoTTS.regenerate("apple");
    await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce());
    finishOld(new Response("old", { headers: { "Content-Type": "audio/wav" } }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(nativeSpeak).not.toHaveBeenCalled();
    expect(await window.EnglishGoTTS.getAudioUrl("apple")).toBe(URL.createObjectURL.mock.results[0].value);
  });

  it("coalesces repeated regeneration and joins it before returning older cached audio", async () => {
    installPatchEnv();
    let finishRegeneration;
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response("old", { headers: { "Content-Type": "audio/wav" } }))
      .mockImplementationOnce(() => new Promise(resolve => { finishRegeneration = resolve; }));
    loadPatch();
    const old = await window.EnglishGoTTS.getAudioUrl("apple");
    const first = window.EnglishGoTTS.getAudioUrl("apple", { forceRegenerate: true });
    const second = window.EnglishGoTTS.getAudioUrl("apple", { forceRegenerate: true });
    const playback = window.EnglishGoTTS.getAudioUrl("apple");
    const preload = window.EnglishGoTTS.preload("apple");
    expect(fetch).toHaveBeenCalledTimes(2);
    finishRegeneration(new Response("new", { headers: { "Content-Type": "audio/wav", "X-TTS-Cache-Upload": "ok" } }));
    const results = await Promise.all([first, second, playback, preload]);
    expect(new Set(results).size).toBe(1);
    expect(results[0]).not.toBe(old);
    expect(await window.EnglishGoTTS.getAudioUrl("apple")).toBe(results[0]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("plays the new regeneration when clicked while an older preload is still pending", async () => {
    const { nativeSpeak } = installPatchEnv();
    let finishLookup;
    let finishRegeneration;
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { finishLookup = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { finishRegeneration = resolve; }));
    const audios = [];
    globalThis.Audio = vi.fn(() => { const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn() }; audios.push(audio); return audio; });
    loadPatch();
    const lookup = window.EnglishGoTTS.preload("apple");
    window.EnglishGoTTS.regenerate("apple");
    window.EnglishGoTTS.speak("apple");
    expect(fetch).toHaveBeenCalledTimes(2);
    finishLookup(new Response(null, { status: 204 }));
    expect(await lookup).toBeNull();
    finishRegeneration(new Response("new", { headers: { "Content-Type": "audio/wav", "X-TTS-Cache-Upload": "ok" } }));
    await vi.waitFor(() => expect(audios[1].play).toHaveBeenCalledTimes(2));
    expect(audios[1].src).toBe(URL.createObjectURL.mock.results[0].value);
    expect(audios[0].play).toHaveBeenCalledTimes(1);
    expect(nativeSpeak).not.toHaveBeenCalled();
  });

  it("keeps pending regeneration scoped to its provider and allows retry after failure", async () => {
    installPatchEnv();
    let failOpenAI;
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise((_, reject) => { failOpenAI = reject; }))
      .mockResolvedValueOnce(new Response("elevenlabs", { headers: { "Content-Type": "audio/mpeg" } }))
      .mockResolvedValueOnce(new Response("openai", { headers: { "Content-Type": "audio/wav", "X-TTS-Cache-Upload": "ok" } }));
    loadPatch();
    const first = window.EnglishGoTTS.getAudioUrl("apple", { forceRegenerate: true }).catch(error => error);
    window.EnglishGoTTS.setSettings({ provider: "elevenlabs" });
    const elevenlabs = await window.EnglishGoTTS.getAudioUrl("apple");
    window.EnglishGoTTS.setSettings({ provider: "openai" });
    const joined = window.EnglishGoTTS.getAudioUrl("apple", { forceRegenerate: true }).catch(error => error);
    expect(fetch).toHaveBeenCalledTimes(2);
    failOpenAI(new Error("offline"));
    const failures = await Promise.all([first, joined]);
    expect(failures.every(error => error.ttsReason === "network")).toBe(true);
    const retried = await window.EnglishGoTTS.getAudioUrl("apple", { forceRegenerate: true });
    expect(retried).not.toBe(elevenlabs);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/.netlify/functions/openai-tts", "/.netlify/functions/elevenlabs-tts", "/.netlify/functions/openai-tts"]);
  });

  it("starts fresh playback after failed regeneration instead of joining an invalidated older request", async () => {
    const { nativeSpeak } = installPatchEnv();
    let finishOld;
    let finishFresh;
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockImplementationOnce(() => new Promise(resolve => { finishFresh = resolve; }));
    const audios = [];
    globalThis.Audio = vi.fn(() => { const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn() }; audios.push(audio); return audio; });
    loadPatch();
    window.EnglishGoTTS.speak("apple");
    window.EnglishGoTTS.regenerate("apple");
    await vi.waitFor(() => expect(document.getElementById("eg-tts-status-toast")).toHaveTextContent("雲端發音暫時無法播放"));

    window.EnglishGoTTS.speak("apple");
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toMatchObject({ forceRegenerate: false, cacheOnly: false });
    finishOld(new Response("old", { headers: { "Content-Type": "audio/wav" } }));
    await new Promise(resolve => setTimeout(resolve, 0));
    const joinedFresh = window.EnglishGoTTS.getAudioUrl("apple");
    expect(fetch).toHaveBeenCalledTimes(3);
    finishFresh(new Response("fresh", { headers: { "Content-Type": "audio/wav" } }));
    const freshUrl = await joinedFresh;
    await vi.waitFor(() => expect(audios[2].play).toHaveBeenCalledTimes(2));
    expect(audios[2].src).toBe(freshUrl);
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(nativeSpeak).not.toHaveBeenCalled();
  });
});

describe('prerecorded storybook audio packs',()=>{
 it('preloads more than 120 assets and retains the first narration in memory',async()=>{
  installPatchEnv();globalThis.fetch=vi.fn(()=>Promise.resolve(new Response('mp3',{headers:{'Content-Type':'audio/mpeg'}})));loadPatch();
  const items=Array.from({length:128},(_,i)=>({text:'word '+i,audioUrl:'/audio/picture-books/test-'+i+'.mp3'}));
  const progress=vi.fn();expect(await window.EnglishGoTTS.preloadMany(items,{limit:items.length,onProgress:progress})).toBe(128);
  expect(progress).toHaveBeenLastCalledWith(128,128);
  await window.EnglishGoTTS.preloadMany([items[0]],{limit:1});expect(globalThis.fetch).toHaveBeenCalledTimes(128);
 });
 it('reuses downloaded book audio after restarting the player without a network request',async()=>{
  const files=new Map();const cache={match:vi.fn(async key=>files.get(key)?.clone()),put:vi.fn(async(key,res)=>files.set(key,res))};
  Object.defineProperty(window,'caches',{configurable:true,value:{open:vi.fn(async()=>cache)}});
  try{
   installPatchEnv();globalThis.fetch=vi.fn(()=>Promise.resolve(new Response('mp3',{headers:{'Content-Type':'audio/mpeg'}})));loadPatch();
   const item={text:'evidence',audioUrl:'/audio/picture-books/evidence.mp3'};
   expect(await window.EnglishGoTTS.preloadMany([item],{limit:1})).toBe(1);expect(cache.put).toHaveBeenCalledOnce();
   installPatchEnv();globalThis.fetch=vi.fn(()=>Promise.reject(Error('offline')));loadPatch();
   expect(await window.EnglishGoTTS.preloadMany([item],{limit:1})).toBe(1);expect(globalThis.fetch).not.toHaveBeenCalled();
  }finally{delete window.caches;}
 });
});
