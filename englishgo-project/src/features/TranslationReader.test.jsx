import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TranslationReader from "./TranslationReader.jsx";

const TRANSLATION_LAST_REQUEST_KEY = "eg_translation_last_request_at";

const Header = ({ t, onBack }) => (
  <header>
    <button type="button" onClick={onBack}>返回</button>
    <h1>{t}</h1>
  </header>
);

const theme = {
  accent: "#0F766E",
  accentSoft: "#CCFBF1",
  surface: "#FFFFFF",
  surfaceAlt: "#F7F7F5",
  border: "#D7D7D2",
  text: "#202124",
  muted: "#5F6368",
};

function renderReader(overrides = {}) {
  const props = {
    apiKey: "test-key",
    onBack: vi.fn(),
    onOpenSettings: vi.fn(),
    speak: vi.fn(),
    speakWebSpeech: vi.fn(),
    stopSpeech: vi.fn(),
    translateText: vi.fn().mockResolvedValue({
      status: "safe",
      sourceText: "我每天走路去學校。",
      sourceLanguage: "zh-TW",
      targetLanguage: "en-US",
      translation: "I walk to school every day.",
      explanation: "這句使用 every day 表達每天固定發生的事情。",
      keyPhrases: [
        { english: "walk to school", meaning: "走路去學校" },
        { english: "every day", meaning: "每天" },
      ],
      pronunciationSegments: [
        {
          text: "I walk to school",
          stressedWords: ["walk", "school"],
        },
        {
          text: "every day.",
          stressedWords: ["every", "day"],
        },
      ],
    }),
    Header,
    theme,
    ...overrides,
  };

  const view = render(<TranslationReader {...props} />);
  return { ...props, ...view };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
  localStorage.removeItem(TRANSLATION_LAST_REQUEST_KEY);
});

describe("TranslationReader", () => {
  it("translates safe text and exposes validated result actions", async () => {
    const props = renderReader();

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "我每天走路去學校。" },
    });

    expect(screen.getByTestId("translation-count")).toHaveTextContent("8/20 字");

    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));

    expect(await screen.findByText("I walk to school every day.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "朗讀原文" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "朗讀翻譯" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "複製翻譯" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "為什麼這樣翻" })).toBeInTheDocument();
    expect(
      screen.getByText("這句使用 every day 表達每天固定發生的事情。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "重要片語" })).toBeInTheDocument();
    expect(screen.getByText("walk to school")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "英文怎麼念" })).toBeInTheDocument();
    expect(screen.getByTestId("pronunciation-guide")).toHaveTextContent(
      "I walk to school / every day.",
    );
    expect(screen.getByTestId("pronunciation-guide").querySelectorAll("strong"))
      .toHaveLength(4);
    expect(props.translateText).toHaveBeenCalledWith(expect.objectContaining({
      text: "我每天走路去學校。",
      direction: "auto",
      apiKey: "test-key",
      signal: expect.any(AbortSignal),
    }));
    expect(screen.getByTestId("translation-reader")).toHaveAttribute("data-status", "success");
  });

  it("exposes idle and loading states while a request is pending", async () => {
    const deferred = createDeferred();
    renderReader({ translateText: vi.fn(() => deferred.promise) });
    const reader = screen.getByTestId("translation-reader");

    expect(reader).toHaveAttribute("data-status", "idle");

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "This is a test." },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));

    expect(reader).toHaveAttribute("data-status", "loading");
    expect(screen.getByText("翻譯中...")).toBeInTheDocument();

    await act(async () => {
      deferred.resolve({
        status: "safe",
        sourceText: "This is a test.",
        sourceLanguage: "en-US",
        targetLanguage: "zh-TW",
        translation: "這是一個測試。",
      });
    });

    expect(reader).toHaveAttribute("data-status", "success");
  });

  it("shows no result actions for unsafe content", async () => {
    renderReader({
      translateText: vi.fn().mockResolvedValue({ status: "unsafe" }),
    });

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "A sentence requiring review." },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));

    expect(
      await screen.findByText("內容不適合學生使用，無法翻譯或朗讀。"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("translation-reader")).toHaveAttribute("data-status", "unsafe");
    expect(screen.queryByTestId("translation-results")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "朗讀翻譯" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "複製翻譯" })).not.toBeInTheDocument();
  });

  it("maps provider errors without exposing provider details", async () => {
    renderReader({
      translateText: vi.fn().mockRejectedValue({
        code: "api_error",
        message: "provider-secret-detail",
      }),
    });

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "This is a test." },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));

    expect(
      await screen.findByText("AI 翻譯暫時無法使用，請稍後再試。"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("translation-reader")).toHaveAttribute("data-status", "error");
    expect(screen.queryByText("provider-secret-detail")).not.toBeInTheDocument();
    expect(screen.queryByTestId("translation-results")).not.toBeInTheDocument();
  });

  it("opens shared API key settings when the key is missing", () => {
    const props = renderReader({ apiKey: "" });

    expect(screen.getByText("需要 Gemini API Key")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "前往 Key 設定" }));

    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("does not submit translation work without an API key", () => {
    const translateText = vi.fn();
    renderReader({ apiKey: "", translateText });

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "This is a test." },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));

    expect(translateText).not.toHaveBeenCalled();
    expect(screen.getByText("需要 Gemini API Key。")).toBeInTheDocument();
    expect(screen.getByTestId("translation-reader")).toHaveAttribute("data-status", "error");
  });

  it("shows English word and Chinese character counts against their limits", () => {
    renderReader();
    const input = screen.getByLabelText("輸入要翻譯的句子");

    fireEvent.change(input, { target: { value: "One well-known student reads." } });
    expect(screen.getByTestId("translation-count")).toHaveTextContent("4/20 words");

    fireEvent.change(input, { target: { value: "我每天走路去學校。" } });
    expect(screen.getByTestId("translation-count")).toHaveTextContent("8/20 字");
  });

  it("clears a prior result and stops speech when source text changes", async () => {
    const props = renderReader();
    const input = screen.getByLabelText("輸入要翻譯的句子");

    fireEvent.change(input, { target: { value: "我每天走路去學校。" } });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    await screen.findByTestId("translation-results");
    props.stopSpeech.mockClear();

    fireEvent.change(input, { target: { value: "我搭公車去學校。" } });

    expect(screen.queryByTestId("translation-results")).not.toBeInTheDocument();
    expect(screen.getByTestId("translation-reader")).toHaveAttribute("data-status", "idle");
    expect(props.stopSpeech).toHaveBeenCalledTimes(1);
  });

  it("aborts input work and ignores a stale result when source text changes", async () => {
    const deferred = createDeferred();
    const signals = [];
    const translateText = vi.fn(({ signal }) => {
      signals.push(signal);
      return deferred.promise;
    });
    renderReader({ translateText });
    const input = screen.getByLabelText("輸入要翻譯的句子");

    fireEvent.change(input, { target: { value: "First sentence." } });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    fireEvent.change(input, { target: { value: "Second sentence." } });

    expect(signals[0].aborted).toBe(true);

    await act(async () => {
      deferred.resolve({
        status: "safe",
        sourceText: "First sentence.",
        sourceLanguage: "en-US",
        targetLanguage: "zh-TW",
        translation: "第一句。",
      });
    });

    expect(screen.queryByText("第一句。")).not.toBeInTheDocument();
    expect(screen.queryByTestId("translation-results")).not.toBeInTheDocument();
    expect(screen.getByTestId("translation-reader")).toHaveAttribute("data-status", "idle");
  });

  it("aborts an in-flight translation before starting the next submission", () => {
    const signals = [];
    const translateText = vi.fn(({ signal }) => {
      signals.push(signal);
      return new Promise(() => {});
    });
    renderReader({ translateText });
    const input = screen.getByLabelText("輸入要翻譯的句子");

    fireEvent.change(input, { target: { value: "First sentence." } });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    fireEvent.change(input, { target: { value: "Second sentence." } });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));

    expect(signals[0].aborted).toBe(true);
    expect(translateText).toHaveBeenCalledTimes(2);
  });

  it("switches explicit directions and auto direction opposite to detected text", () => {
    renderReader();
    const direction = screen.getByLabelText("翻譯方向");
    const swap = screen.getByRole("button", { name: "交換翻譯方向" });

    fireEvent.change(direction, { target: { value: "zh-en" } });
    fireEvent.click(swap);
    expect(direction).toHaveValue("en-zh");

    fireEvent.change(direction, { target: { value: "auto" } });
    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "This is an English sentence." },
    });
    fireEvent.click(swap);
    expect(direction).toHaveValue("zh-en");
  });

  it("stops stale speech before submitting another translation", async () => {
    const translateText = vi.fn()
      .mockResolvedValueOnce({
        status: "safe",
        sourceText: "我每天走路去學校。",
        sourceLanguage: "zh-TW",
        targetLanguage: "en-US",
        translation: "I walk to school every day.",
      })
      .mockResolvedValueOnce({ status: "unsafe" });
    const props = renderReader({ translateText });
    const input = screen.getByLabelText("輸入要翻譯的句子");

    fireEvent.change(input, { target: { value: "我每天走路去學校。" } });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    await screen.findByTestId("translation-results");
    fireEvent.click(screen.getByRole("button", { name: "朗讀翻譯" }));
    props.stopSpeech.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));

    expect(props.stopSpeech).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("內容不適合學生使用，無法翻譯或朗讀。"),
    ).toBeInTheDocument();
  });

  it("copies only the validated translation", async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderReader();

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "我每天走路去學校。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    await screen.findByTestId("translation-results");
    fireEvent.click(screen.getByRole("button", { name: "複製翻譯" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("I walk to school every day.");
    });
    expect(screen.getByText("已複製")).toBeInTheDocument();
  });

  it("does not report copy success when clipboard access fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderReader();

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "我每天走路去學校。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    await screen.findByTestId("translation-results");
    fireEvent.click(screen.getByRole("button", { name: "複製翻譯" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("已複製")).not.toBeInTheDocument();
  });

  it("clears input, result, and active speech", async () => {
    const props = renderReader();
    const input = screen.getByLabelText("輸入要翻譯的句子");

    fireEvent.change(input, { target: { value: "我每天走路去學校。" } });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    await screen.findByTestId("translation-results");
    props.stopSpeech.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "清除" }));

    expect(input).toHaveValue("");
    expect(screen.queryByTestId("translation-results")).not.toBeInTheDocument();
    expect(screen.getByTestId("translation-reader")).toHaveAttribute("data-status", "idle");
    expect(props.stopSpeech).toHaveBeenCalledTimes(1);
  });

  it("aborts work and stops speech when unmounted", () => {
    const signals = [];
    const props = renderReader({
      translateText: vi.fn(({ signal }) => {
        signals.push(signal);
        return new Promise(() => {});
      }),
    });

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "This is a test." },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    props.stopSpeech.mockClear();
    props.unmount();

    expect(signals[0].aborted).toBe(true);
    expect(props.stopSpeech).toHaveBeenCalledTimes(1);
  });

  it("does not persist source or translation text", async () => {
    const before = Object.keys(localStorage).sort();
    renderReader();

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "我每天走路去學校。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    await screen.findByTestId("translation-results");

    expect(Object.keys(localStorage).sort()).toEqual(before);
  });

  it("uses browser speech for Chinese and the existing English path for English", async () => {
    const props = renderReader();

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "我每天走路去學校。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    await screen.findByTestId("translation-results");

    fireEvent.click(screen.getByRole("button", { name: "朗讀原文" }));
    expect(props.speakWebSpeech).toHaveBeenCalledWith(
      "我每天走路去學校。",
      "zh-TW",
      1,
      expect.any(Object),
    );
    expect(props.speak).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "朗讀翻譯" }));
    expect(props.speak).toHaveBeenCalledWith(
      "I walk to school every day.",
      "en-US",
      0.9,
      expect.any(Object),
    );
  });

  it("uses the English path for an English source and browser speech for its Chinese result", async () => {
    const props = renderReader({
      translateText: vi.fn().mockResolvedValue({
        status: "safe",
        sourceText: "I read after dinner.",
        sourceLanguage: "en-US",
        targetLanguage: "zh-TW",
        translation: "我晚餐後閱讀。",
      }),
    });

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "I read after dinner." },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    await screen.findByTestId("translation-results");

    fireEvent.click(screen.getByRole("button", { name: "朗讀原文" }));
    expect(props.speak).toHaveBeenCalledWith(
      "I read after dinner.",
      "en-US",
      0.9,
      expect.any(Object),
    );

    fireEvent.click(screen.getByRole("button", { name: "朗讀翻譯" }));
    expect(props.speakWebSpeech).toHaveBeenCalledWith(
      "我晚餐後閱讀。",
      "zh-TW",
      1,
      expect.any(Object),
    );
  });

  it("starts a persistent 60-second cooldown when the API request starts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    const translateText = vi.fn(({ onRequestStart }) => {
      onRequestStart();
      return Promise.resolve({ status: "unsafe" });
    });
    renderReader({ translateText });

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "Hello students." },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    await act(async () => {});

    expect(translateText).toHaveBeenCalledWith(expect.objectContaining({
      onRequestStart: expect.any(Function),
    }));
    expect(localStorage.getItem(TRANSLATION_LAST_REQUEST_KEY)).toBe(
      String(Date.now()),
    );
    expect(screen.getByRole("button", { name: "請等待 60 秒" })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole("button", { name: "請等待 30 秒" })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole("button", { name: "AI 翻譯與檢核" })).toBeEnabled();
  });

  it("restores an active cooldown after remounting", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    localStorage.setItem(TRANSLATION_LAST_REQUEST_KEY, String(Date.now()));

    const first = renderReader();
    expect(screen.getByRole("button", { name: "請等待 60 秒" })).toBeDisabled();
    first.unmount();

    renderReader();
    expect(screen.getByRole("button", { name: "請等待 60 秒" })).toBeDisabled();
  });

  it("keeps cooldown after an API error because a request was sent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    const translateText = vi.fn(({ onRequestStart }) => {
      onRequestStart();
      return Promise.reject({ code: "api_error" });
    });
    renderReader({ translateText });

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "Hello students." },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    await act(async () => {});

    expect(screen.getByText("AI 翻譯暫時無法使用，請稍後再試。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "請等待 60 秒" })).toBeDisabled();
  });

  it("does not start cooldown when work is rejected before fetch", async () => {
    const translateText = vi.fn().mockRejectedValue({
      code: "source_too_long",
      message: "英文最多 20 words，目前 21 words。",
    });
    renderReader({ translateText });

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "A sentence rejected by local validation." },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));

    expect(
      await screen.findByText("英文最多 20 words，目前 21 words。"),
    ).toBeInTheDocument();
    expect(localStorage.getItem(TRANSLATION_LAST_REQUEST_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: "AI 翻譯與檢核" })).toBeEnabled();
  });

  it("stores only the cooldown timestamp after a request starts", async () => {
    const before = Object.keys(localStorage).sort();
    const translateText = vi.fn(({ onRequestStart }) => {
      onRequestStart();
      return Promise.resolve({ status: "unsafe" });
    });
    renderReader({ translateText });

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "Hello students." },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));
    await screen.findByText("內容不適合學生使用，無法翻譯或朗讀。");

    expect(Object.keys(localStorage).sort()).toEqual(
      [...before, TRANSLATION_LAST_REQUEST_KEY].sort(),
    );
    expect(localStorage.getItem(TRANSLATION_LAST_REQUEST_KEY)).toMatch(/^\d+$/);
  });

  it("renders responsive workspace classes and restrained panel CSS", async () => {
    renderReader();

    fireEvent.change(screen.getByLabelText("輸入要翻譯的句子"), {
      target: { value: "我每天走路去學校。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 翻譯與檢核" }));

    const results = await screen.findByTestId("translation-results");
    expect(results).toHaveClass("translation-reader-results");
    expect(screen.getByTestId("translation-source-panel")).toHaveClass("translation-reader-panel");
    expect(screen.getByTestId("translation-result-panel")).toHaveClass("translation-reader-panel");

    const css = document.querySelector(
      "style[data-translation-reader-styles]",
    )?.textContent || "";
    expect(css).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
    expect(css).toContain("@media (max-width:680px)");
    expect(css).toContain("grid-template-columns:1fr");
    expect(css).toContain(".translation-reader-learning");
    expect(css).toContain(".translation-reader-phrases");
    expect(css).toContain("border-radius:8px");
  });
});
