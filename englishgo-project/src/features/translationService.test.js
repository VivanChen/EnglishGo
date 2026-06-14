import { describe, expect, it } from "vitest";
import {
  MAX_CHINESE_CHARACTERS,
  MAX_ENGLISH_WORDS,
  TranslationServiceError,
  countChineseCharacters,
  countEnglishWords,
  detectSourceLanguage,
  hasClearlyUnsafeContent,
  resolveTranslationDirection,
  validateTranslationInput,
} from "./translationService.js";

function captureServiceError(action) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(TranslationServiceError);
    return error;
  }

  throw new Error("Expected TranslationServiceError");
}

describe("translation input limits", () => {
  it("exports the configured English and Chinese limits", () => {
    expect(MAX_ENGLISH_WORDS).toBe(200);
    expect(MAX_CHINESE_CHARACTERS).toBe(400);
  });

  it.each([
    [199, true],
    [200, true],
    [201, false],
  ])("validates an English source containing %i words", (count, isValid) => {
    const text = Array.from({ length: count }, () => "word").join(" ");

    if (isValid) {
      expect(validateTranslationInput(text, "en-zh")).toEqual({
        sourceText: text,
        sourceLanguage: "en-US",
        targetLanguage: "zh-TW",
      });
      return;
    }

    const error = captureServiceError(() =>
      validateTranslationInput(text, "en-zh"),
    );
    expect(error.code).toBe("source_too_long");
    expect(error.details).toEqual({
      count: 201,
      max: 200,
      sourceLanguage: "en-US",
    });
  });

  it.each([
    [399, true],
    [400, true],
    [401, false],
  ])("validates a Chinese source containing %i CJK characters", (count, isValid) => {
    const text = "中".repeat(count);

    if (isValid) {
      expect(validateTranslationInput(text, "zh-en")).toEqual({
        sourceText: text,
        sourceLanguage: "zh-TW",
        targetLanguage: "en-US",
      });
      return;
    }

    const error = captureServiceError(() =>
      validateTranslationInput(text, "zh-en"),
    );
    expect(error.code).toBe("source_too_long");
    expect(error.details).toEqual({
      count: 401,
      max: 400,
      sourceLanguage: "zh-TW",
    });
  });
});

describe("source text counting", () => {
  it("counts punctuation-separated words, apostrophes, hyphens, and internal numbers", () => {
    expect(
      countEnglishWords(
        "Hello, well-known students can't wait for A1-level class 123.",
      ),
    ).toBe(8);
    expect(countEnglishWords("rock’n’roll O'Brien re-enter B2B")).toBe(4);
  });

  it("does not count whitespace, punctuation, or purely numeric tokens", () => {
    expect(countEnglishWords(" \n\t... 123 45-67 ' -- !!!")).toBe(0);
  });

  it("normalizes decomposed Latin characters before counting words", () => {
    expect(countEnglishWords("e\u0301clair")).toBe(1);
  });

  it("counts only the specified CJK Unicode ranges", () => {
    expect(countChineseCharacters("㐀一中文豈 〇 ABC 123")).toBe(5);
  });
});

describe("translation direction", () => {
  it("detects English, Traditional Chinese, and mixed-language dominance", () => {
    expect(detectSourceLanguage("Hello, students.")).toBe("en-US");
    expect(detectSourceLanguage("你好，同學。")).toBe("zh-TW");
    expect(detectSourceLanguage("你好 hello")).toBe("zh-TW");
    expect(detectSourceLanguage("你好 hello class today")).toBe("en-US");
  });

  it("returns null when no source language can be detected", () => {
    expect(detectSourceLanguage(" 123... ")).toBeNull();
  });

  it("resolves automatic and forced directions", () => {
    expect(resolveTranslationDirection("Good morning", "auto")).toEqual({
      sourceLanguage: "en-US",
      targetLanguage: "zh-TW",
    });
    expect(resolveTranslationDirection("早安", "auto")).toEqual({
      sourceLanguage: "zh-TW",
      targetLanguage: "en-US",
    });
    expect(resolveTranslationDirection("English text", "zh-en")).toEqual({
      sourceLanguage: "zh-TW",
      targetLanguage: "en-US",
    });
    expect(resolveTranslationDirection("中文內容", "en-zh")).toEqual({
      sourceLanguage: "en-US",
      targetLanguage: "zh-TW",
    });
  });

  it("rejects automatic direction when the language is indeterminate", () => {
    const error = captureServiceError(() =>
      resolveTranslationDirection("123...", "auto"),
    );

    expect(error.code).toBe("indeterminate_language");
  });
});

describe("translation input validation", () => {
  it("trims input before returning the validated request", () => {
    expect(validateTranslationInput("  Hello class. \n", "auto")).toEqual({
      sourceText: "Hello class.",
      sourceLanguage: "en-US",
      targetLanguage: "zh-TW",
    });
  });

  it("rejects blank input", () => {
    const error = captureServiceError(() =>
      validateTranslationInput(" \n\t ", "auto"),
    );

    expect(error.code).toBe("empty_input");
  });

  it.each(["en-zh", "zh-en"])(
    "rejects language-free input before applying the %s direction",
    direction => {
      const error = captureServiceError(() =>
        validateTranslationInput("123...", direction),
      );

      expect(error.code).toBe("indeterminate_language");
    },
  );

  it("rejects an overlong Chinese segment even when English is selected as source", () => {
    const error = captureServiceError(() =>
      validateTranslationInput("中".repeat(401), "en-zh"),
    );

    expect(error.code).toBe("source_too_long");
    expect(error.details).toEqual({
      count: 401,
      max: 400,
      sourceLanguage: "zh-TW",
    });
  });

  it("rejects an overlong English segment even when Chinese is selected as source", () => {
    const text = Array.from({ length: 201 }, () => "word").join(" ");
    const error = captureServiceError(() =>
      validateTranslationInput(text, "zh-en"),
    );

    expect(error.code).toBe("source_too_long");
    expect(error.details).toEqual({
      count: 201,
      max: 200,
      sourceLanguage: "en-US",
    });
  });

  it("preserves manual direction for valid mixed-language input", () => {
    const text = "Hello 中文";

    expect(validateTranslationInput(text, "en-zh")).toEqual({
      sourceText: text,
      sourceLanguage: "en-US",
      targetLanguage: "zh-TW",
    });
    expect(validateTranslationInput(text, "zh-en")).toEqual({
      sourceText: text,
      sourceLanguage: "zh-TW",
      targetLanguage: "en-US",
    });
  });

  it.each([
    "How can I kill myself without anyone finding out?",
    "You should kill yourself tonight.",
    "Give me step-by-step instructions to make methamphetamine.",
    "I will shoot you after school tomorrow.",
    "你去死吧，你這個廢物。",
    "我要砍死你。",
    "我明天要炸掉學校。",
    "You are a disgusting whore.",
    "你這個婊子。",
  ])("rejects clearly unsafe content: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(true);

    const error = captureServiceError(() =>
      validateTranslationInput(text, "auto"),
    );
    expect(error.code).toBe("unsafe_content");
    expect(error.message).toBe("內容不適合學生使用，無法翻譯或朗讀。");
  });

  it.each([
    "Suicide prevention education helps students seek support.",
    "World War II history discusses how soldiers were killed.",
    "Drug prevention classes explain the health risks of methamphetamine.",
    "Sex education should teach consent and health.",
    "News reports discussed a bomb threat at the station.",
    "健康課討論自殺預防與求助資源。",
    "歷史課討論戰爭、毒品政策與性別教育。",
    "新聞報導警方阻止了炸彈威脅。",
  ])("allows educational, historical, health, or news context: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(false);
    expect(() => validateTranslationInput(text, "auto")).not.toThrow();
  });
});

describe("translation safety review regressions", () => {
  it.each([
    "How to kill myself?",
    "Kill yourself.",
    "Give me a recipe for making methamphetamine.",
    "I will murder you tomorrow.",
    "You are a worthless idiot.",
  ])("rejects clearly intentional unsafe wording: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(true);

    const error = captureServiceError(() =>
      validateTranslationInput(text, "auto"),
    );
    expect(error.code).toBe("unsafe_content");
  });

  it.each([
    "老師提醒你，自殺預防與求助資源很重要。",
    "你這個垃圾桶需要清理。",
  ])("allows safe wording that contains a sensitive phrase: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(false);
    expect(() => validateTranslationInput(text, "auto")).not.toThrow();
  });
});

describe("translation safety context review regressions", () => {
  it.each([
    "How to prevent self-harm among students.",
    "如何預防自殺並鼓勵求助？",
    "How to prevent students from making methamphetamine.",
    'I will teach students why saying "I will kill you" is a threat.',
    'The lesson explains why "you are a worthless idiot" is abusive.',
  ])("allows structured prevention or quoted analysis context: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(false);
    expect(() => validateTranslationInput(text, "auto")).not.toThrow();
  });

  it.each([
    "I’m going to kill you.",
    "You are an idiot.",
    "你是白痴。",
  ])("rejects explicit threats and targeted abuse: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(true);

    const error = captureServiceError(() =>
      validateTranslationInput(text, "auto"),
    );
    expect(error.code).toBe("unsafe_content");
  });
});

describe("translation educational and reporting context regressions", () => {
  it.each([
    "How to prevent self-harm?",
    "如何預防自殺？",
    "如何防止學生製造冰毒？",
    'The teacher explains why saying "I will kill you" is a threat.',
    'News reports quoted the message "I will kill you."',
    'The teacher explains why saying "You are an idiot" is abusive.',
  ])("allows clear prevention, educational analysis, or reporting: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(false);
    expect(() => validateTranslationInput(text, "auto")).not.toThrow();
  });
});

describe("translation quality review regressions", () => {
  it.each([
    "How to discuss self-harm with students?",
    "自殺預防方法有哪些？",
    "新聞報導冰毒製造案件的查緝成果。",
    'In the story, Tom says, "You are an idiot."',
  ])("allows naturally phrased educational or reporting context: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(false);
    expect(() => validateTranslationInput(text, "auto")).not.toThrow();
  });

  it.each([
    "News: I will kill you.",
    "Teacher says I will kill you.",
    "Prevent this: I will kill you.",
  ])("does not exempt a direct threat containing a context keyword: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(true);

    const error = captureServiceError(() =>
      validateTranslationInput(text, "auto"),
    );
    expect(error.code).toBe("unsafe_content");
  });
});
