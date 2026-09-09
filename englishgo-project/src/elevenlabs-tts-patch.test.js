import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const patchSource = readFileSync(path.join(process.cwd(), "public", "elevenlabs-tts-patch.js"), "utf8");

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
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:test-audio"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });

  return { nativeSpeak, nativeCancel, nativePause, nativeResume };
}

function loadPatch() {
  window.eval(patchSource);
}

describe("ElevenLabs TTS patch", () => {
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

  it("renders an accessible keyboard-operable settings toggle", () => {
    installPatchEnv();
    loadPatch();

    const toggle=document.querySelector("#eg-tts-panel .eg-head");
    expect(toggle?.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("aria-controls","eg-tts-body");
    expect(toggle).toHaveAttribute("aria-expanded","false");

    toggle.click();
    expect(toggle).toHaveAttribute("aria-expanded","true");
  });

  it("keeps the floating voice panel away from the mobile novel reader", () => {
    installPatchEnv();
    loadPatch();

    const styles = Array.from(document.querySelectorAll("style")).map(style => style.textContent).join("\n");
    expect(styles).toContain('body[data-eg-module="novels"] #eg-tts-panel{display:none}');
    expect(styles).toContain('body[data-eg-module="novels"] #eg-tts-loading-toast{bottom:calc(76px + env(safe-area-inset-bottom,0px))}');
  });

  it("migrates the old custom voice to the clear recommended voice at natural speed", () => {
    installPatchEnv();
    localStorage.setItem("eg_tts_voice_id", "1AKkSX7KMPHIWuz76m0n");
    loadPatch();

    expect(window.EnglishGoTTS.getSettings()).toEqual({
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      speed: 1,
    });
    expect(document.querySelector("#eg-tts-voice")?.value).toBe("21m00Tcm4TlvDq8ikWAM");
    expect(document.querySelector("#eg-tts-panel")?.textContent).not.toContain("目前選用");
  });

  it("ignores unapproved voice ids", () => {
    installPatchEnv();
    loadPatch();

    window.EnglishGoTTS.setSettings({ voiceId: "unknown-cloned-voice" });

    expect(window.EnglishGoTTS.getSettings().voiceId).toBe("21m00Tcm4TlvDq8ikWAM");
  });

  it("preserves capitalization and sentence punctuation in API requests", async () => {
    installPatchEnv();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("mp3", { headers: { "Content-Type": "audio/mpeg" } })));
    loadPatch();

    await window.EnglishGoTTS.getAudioUrl("Do I take the US bus?");

    const payload = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(payload.text).toBe("Do I take the US bus?");
    expect(payload.speed).toBe(1);
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
});
