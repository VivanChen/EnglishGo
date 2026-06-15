import { useEffect, useRef, useState } from "react";
import {
  countChineseCharacters,
  countEnglishWords,
  detectSourceLanguage,
  translateStudentText,
} from "./translationService.js";

const UNSAFE_MESSAGE = "內容不適合學生使用，無法翻譯或朗讀。";
const TRANSLATION_READER_STYLES = `
.translation-reader{display:grid;gap:12px;color:var(--tr-text);padding-bottom:calc(16px + env(safe-area-inset-bottom))}
.translation-reader-form{display:grid;gap:10px}
.translation-reader-controls{display:flex;gap:8px;align-items:end;flex-wrap:wrap}
.translation-reader-field{display:grid;gap:5px;min-width:min(220px,100%);flex:1}
.translation-reader-label{font-size:14px;font-weight:700;color:var(--tr-text)}
.translation-reader-select,.translation-reader-input{width:100%;box-sizing:border-box;border:1px solid var(--tr-border);border-radius:8px;background:var(--tr-surface);color:var(--tr-text);font:inherit}
.translation-reader-select{height:42px;padding:0 12px}
.translation-reader-input{min-height:180px;resize:vertical;padding:13px 14px;line-height:1.7}
.translation-reader-select:focus-visible,.translation-reader-input:focus-visible,.translation-reader-button:focus-visible{outline:3px solid var(--tr-accent-soft);outline-offset:2px}
.translation-reader-meta{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;color:var(--tr-muted);font-size:13px}
.translation-reader-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.translation-reader-button{min-height:42px;border:1px solid var(--tr-border);border-radius:8px;padding:0 14px;background:var(--tr-surface);color:var(--tr-text);font:inherit;font-weight:700;cursor:pointer}
.translation-reader-button:hover{border-color:var(--tr-accent)}
.translation-reader-button:disabled{cursor:not-allowed;opacity:.55}
.translation-reader-icon-button{width:42px;padding:0;font-size:20px}
.translation-reader-primary{border-color:var(--tr-accent);background:var(--tr-accent);color:#fff}
.translation-reader-notice{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 12px;border-left:4px solid var(--tr-accent);background:var(--tr-accent-soft);color:var(--tr-text)}
.translation-reader-notice p{margin:0}
.translation-reader-message{margin:0;padding:10px 12px;border-left:4px solid var(--tr-border);background:var(--tr-surface-alt);color:var(--tr-text)}
.translation-reader-message[data-tone="unsafe"],.translation-reader-message[data-tone="error"]{border-left-color:#B42318}
.translation-reader-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.translation-reader-panel{min-width:0;padding:16px;border:1px solid var(--tr-border);border-radius:8px;background:var(--tr-surface)}
.translation-reader-panel h2{margin:0 0 10px;font-size:16px;letter-spacing:0}
.translation-reader-text{min-height:96px;margin:0 0 14px;overflow-wrap:anywhere;white-space:pre-wrap;line-height:1.8}
.translation-reader-copied{color:var(--tr-accent);font-size:13px;font-weight:700}
@media (max-width:680px){
  .translation-reader-results{grid-template-columns:1fr}
  .translation-reader-input{min-height:150px}
  .translation-reader-primary{width:100%}
  .translation-reader-controls{align-items:stretch}
}
`;

function getTranslationErrorMessage(error) {
  if (error?.code === "unsafe_content") return UNSAFE_MESSAGE;
  if (error?.code === "empty_input") return "請先輸入句子。";
  if (error?.code === "indeterminate_language") return "請輸入中文或英文句子。";
  if (error?.code === "source_too_long") return error.message;
  if (error?.code === "translation_too_long") {
    return "翻譯結果超過朗讀上限，請縮短原文後再試。";
  }
  if (error?.code === "missing_key") return "需要 Gemini API Key。";
  if (error?.name === "AbortError") return "";
  return "AI 翻譯暫時無法使用，請稍後再試。";
}

export default function TranslationReader({
  apiKey,
  onBack,
  onOpenSettings,
  speak,
  speakWebSpeech,
  stopSpeech,
  translateText = translateStudentText,
  Header,
  theme,
}) {
  const [text, setText] = useState("");
  const [direction, setDirection] = useState("auto");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const requestRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(null);
  const copyTimerRef = useRef(null);

  const abortRequest = () => {
    requestRef.current?.abort();
    requestRef.current = null;
  };

  const resetOutput = () => {
    setResult(null);
    setStatus("idle");
    setMessage("");
    setCopied(false);
    setSpeaking(null);
  };

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    return () => {
      requestRef.current?.abort();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      stopSpeech?.();
    };
  }, [stopSpeech]);

  const sourceLanguage = direction === "zh-en"
    ? "zh-TW"
    : direction === "en-zh"
      ? "en-US"
      : detectSourceLanguage(text);
  const count = sourceLanguage === "zh-TW"
    ? countChineseCharacters(text)
    : countEnglishWords(text);
  const countLabel = sourceLanguage === "zh-TW"
    ? `${count}/400 字`
    : `${count}/200 words`;

  const submit = async event => {
    event.preventDefault();
    stopSpeech?.();
    setSpeaking(null);
    if (!apiKey?.trim()) {
      setResult(null);
      setStatus("error");
      setMessage("需要 Gemini API Key。");
      return;
    }
    abortRequest();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    setMessage("");
    setResult(null);

    try {
      const nextResult = await translateText({
        text,
        direction,
        apiKey,
        signal: controller.signal,
      });

      if (requestRef.current !== controller || controller.signal.aborted) return;

      if (nextResult?.status === "safe") {
        setResult(nextResult);
        setStatus("success");
        return;
      }

      if (nextResult?.status === "unsafe") {
        setResult(null);
        setStatus("unsafe");
        setMessage(UNSAFE_MESSAGE);
        return;
      }

      setStatus("error");
      setMessage("AI 翻譯暫時無法使用，請稍後再試。");
    } catch (error) {
      if (requestRef.current !== controller || controller.signal.aborted) return;
      const errorMessage = getTranslationErrorMessage(error);
      if (!errorMessage) {
        setStatus("idle");
        return;
      }
      setResult(null);
      setMessage(errorMessage);
      if (error?.code === "unsafe_content") {
        setStatus("unsafe");
        return;
      }
      setStatus("error");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  const handleTextChange = event => {
    abortRequest();
    stopSpeech?.();
    resetOutput();
    setText(event.target.value);
  };

  const handleDirectionChange = event => {
    abortRequest();
    stopSpeech?.();
    resetOutput();
    setDirection(event.target.value);
  };

  const handleSwap = () => {
    abortRequest();
    stopSpeech?.();
    resetOutput();
    setDirection(currentDirection => {
      if (currentDirection === "zh-en") return "en-zh";
      if (currentDirection === "en-zh") return "zh-en";
      const detected = detectSourceLanguage(text);
      if (detected === "en-US") return "zh-en";
      if (detected === "zh-TW") return "en-zh";
      return "auto";
    });
  };

  const handleClear = () => {
    abortRequest();
    stopSpeech?.();
    setText("");
    resetOutput();
  };

  const handleBack = () => {
    abortRequest();
    stopSpeech?.();
    onBack?.();
  };

  const handleCopy = async () => {
    if (!result || status !== "success") return;
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(result.translation);
    } catch {
      setCopied(false);
      return;
    }
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1600);
  };

  const narrate = kind => {
    if (!result || status !== "success") return;
    const isSource = kind === "source";
    const value = isSource ? result.sourceText : result.translation;
    const language = isSource ? result.sourceLanguage : result.targetLanguage;
    const options = {
      onend: () => setSpeaking(null),
      onerror: () => setSpeaking(null),
    };

    stopSpeech?.();
    setSpeaking(kind);
    if (language === "zh-TW") {
      speakWebSpeech?.(value, "zh-TW", 1, options);
      return;
    }
    speak?.(value, "en-US", 0.9, options);
  };

  const rootStyle = {
    "--tr-accent": theme?.accent || "#0F766E",
    "--tr-accent-soft": theme?.accentSoft || "#CCFBF1",
    "--tr-surface": theme?.surface || "#FFFFFF",
    "--tr-surface-alt": theme?.surfaceAlt || "#F7F7F5",
    "--tr-border": theme?.border || "#D7D7D2",
    "--tr-text": theme?.text || "#202124",
    "--tr-muted": theme?.muted || "#5F6368",
  };

  return (
    <section
      className="translation-reader"
      data-status={status}
      data-testid="translation-reader"
      style={rootStyle}
    >
      <style data-translation-reader-styles>{TRANSLATION_READER_STYLES}</style>
      {Header ? <Header t="AI 翻譯朗讀" onBack={handleBack} /> : null}

      <form className="translation-reader-form" onSubmit={submit}>
        <div className="translation-reader-controls">
          <div className="translation-reader-field">
            <label className="translation-reader-label" htmlFor="translation-direction">
              翻譯方向
            </label>
            <select
              className="translation-reader-select"
              id="translation-direction"
              aria-label="翻譯方向"
              value={direction}
              onChange={handleDirectionChange}
            >
              <option value="auto">自動判斷</option>
              <option value="zh-en">中翻英</option>
              <option value="en-zh">英翻中</option>
            </select>
          </div>
          <button
            className="translation-reader-button translation-reader-icon-button"
            type="button"
            aria-label="交換翻譯方向"
            title="交換翻譯方向"
            onClick={handleSwap}
          >
            ⇄
          </button>
        </div>

        <label className="translation-reader-label" htmlFor="translation-source">
          輸入要翻譯的句子
        </label>
        <textarea
          className="translation-reader-input"
          id="translation-source"
          value={text}
          onChange={handleTextChange}
        />
        <div className="translation-reader-meta">
          <span>上限 200 English words / 400 中文字</span>
          <span data-testid="translation-count">{countLabel}</span>
        </div>
        <div className="translation-reader-actions">
          <button
            className="translation-reader-button translation-reader-primary"
            type="submit"
            disabled={!text.trim()}
          >
            AI 翻譯與檢核
          </button>
          <button
            className="translation-reader-button"
            type="button"
            onClick={handleClear}
          >
            清除
          </button>
        </div>
      </form>

      {!apiKey?.trim() ? (
        <div className="translation-reader-notice">
          <p>需要 Gemini API Key</p>
          <button
            className="translation-reader-button"
            type="button"
            onClick={onOpenSettings}
          >
            前往 Key 設定
          </button>
        </div>
      ) : null}
      {status === "loading" ? (
        <p className="translation-reader-message" role="status">翻譯中...</p>
      ) : null}
      {message ? (
        <p
          className="translation-reader-message"
          data-tone={status}
          role={status === "error" || status === "unsafe" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}

      {result && status === "success" ? (
        <div
          className="translation-reader-results"
          data-testid="translation-results"
        >
          <section
            className="translation-reader-panel"
            data-testid="translation-source-panel"
          >
            <h2>原文</h2>
            <p className="translation-reader-text">{result.sourceText}</p>
            <div className="translation-reader-actions">
              <button
                className="translation-reader-button"
                type="button"
                aria-pressed={speaking === "source"}
                onClick={() => narrate("source")}
              >
                朗讀原文
              </button>
            </div>
          </section>
          <section
            className="translation-reader-panel"
            data-testid="translation-result-panel"
          >
            <h2>翻譯</h2>
            <p className="translation-reader-text">{result.translation}</p>
            <div className="translation-reader-actions">
              <button
                className="translation-reader-button"
                type="button"
                aria-pressed={speaking === "translation"}
                onClick={() => narrate("translation")}
              >
                朗讀翻譯
              </button>
              <button
                className="translation-reader-button"
                type="button"
                onClick={handleCopy}
              >
                複製翻譯
              </button>
              {copied ? <span className="translation-reader-copied">已複製</span> : null}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
