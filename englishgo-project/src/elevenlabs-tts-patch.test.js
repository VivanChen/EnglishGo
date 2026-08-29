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
  const nativeResume = vi.fn();

  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      speak: nativeSpeak,
      cancel: nativeCancel,
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

  return { nativeSpeak, nativeCancel };
}

function loadPatch() {
  window.eval(patchSource);
}

describe("ElevenLabs TTS patch", () => {
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
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(new Blob(["mp3"], { type: "audio/mpeg" }))));
    loadPatch();

    await window.EnglishGoTTS.getAudioUrl("Do I take the US bus?");

    const payload = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(payload.text).toBe("Do I take the US bus?");
    expect(payload.speed).toBe(1);
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
});
