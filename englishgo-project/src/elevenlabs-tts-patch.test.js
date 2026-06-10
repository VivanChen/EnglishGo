import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

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

    const utterance = new SpeechSynthesisUtterance("這是中文測試。");
    utterance.lang = "zh-TW";
    window.speechSynthesis.speak(utterance);

    expect(nativeSpeak).toHaveBeenCalledWith(utterance);
  });

  it("sends novel-marked Chinese speech to the Netlify TTS API", async () => {
    const { nativeSpeak } = installPatchEnv();
    const play = vi.fn(() => Promise.resolve());
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(new Blob(["mp3"], { type: "audio/mpeg" }), { status: 200 })),
    );
    globalThis.Audio = vi.fn(() => ({
      play,
      pause: vi.fn(),
      currentTime: 0,
      playbackRate: 1,
      volume: 1,
    }));
    globalThis.URL.createObjectURL = vi.fn(() => "blob:tts");

    loadPatch();

    const utterance = new SpeechSynthesisUtterance("這是小說中文朗讀。");
    utterance.lang = "zh-TW";
    utterance.__englishGoApiTts = true;
    window.speechSynthesis.speak(utterance);

    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/.netlify/functions/elevenlabs-tts",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"lang":"zh-TW"'),
        }),
      );
    });
    expect(nativeSpeak).not.toHaveBeenCalledWith(utterance);
  });
});
