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

  it("keeps unmarked Chinese speech on native browser speech", () => {
    const { nativeSpeak } = installPatchEnv();
    loadPatch();

    const utterance = new SpeechSynthesisUtterance("\u9019\u662f\u4e00\u53e5\u4e2d\u6587\u3002");
    utterance.lang = "zh-TW";
    window.speechSynthesis.speak(utterance);

    expect(nativeSpeak).toHaveBeenCalledWith(utterance);
  });

  it("keeps novel-marked Chinese speech native without calling the API", () => {
    const { nativeSpeak } = installPatchEnv();
    globalThis.fetch = vi.fn();
    loadPatch();

    const utterance = new SpeechSynthesisUtterance("\u9019\u662f\u5c0f\u8aaa\u7684\u4e2d\u6587\u65c1\u767d\u3002");
    utterance.lang = "zh-TW";
    utterance.__englishGoApiTts = true;
    window.speechSynthesis.speak(utterance);

    expect(nativeSpeak).toHaveBeenCalledWith(utterance);
    expect(globalThis.fetch).not.toHaveBeenCalled();
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
