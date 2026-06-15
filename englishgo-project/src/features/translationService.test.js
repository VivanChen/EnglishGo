import { describe, expect, it, vi } from "vitest";
import * as translationService from "./translationService.js";

const {
  MAX_CHINESE_CHARACTERS,
  MAX_ENGLISH_WORDS,
  TranslationServiceError,
  countChineseCharacters,
  countEnglishWords,
  detectSourceLanguage,
  hasClearlyUnsafeContent,
  resolveTranslationDirection,
  validateTranslationInput,
} = translationService;

function captureServiceError(action) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(TranslationServiceError);
    return error;
  }

  throw new Error("Expected TranslationServiceError");
}

it("sends a student-safe Gemini request for a valid English source", async () => {
  const fetchImpl = async (_url, init) => {
    expect(init.method).toBe("POST");
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    sourceLanguage: "en-US",
                    targetLanguage: "zh-TW",
                    safe: true,
                    reason: "safe to translate",
                    translation: "你好，學生們。",
                  }),
                },
              ],
            },
          },
        ],
      }),
    };
  };

  await expect(
    translationService.translateStudentText({
      text: "Hello students.",
      direction: "en-zh",
      apiKey: "test-key",
      fetchImpl,
    }),
  ).resolves.toEqual({
    status: "safe",
    sourceText: "Hello students.",
    sourceLanguage: "en-US",
    targetLanguage: "zh-TW",
    translation: "你好，學生們。",
  });
});

describe("Gemini translation contract", () => {
  function createSafeResponse({
    sourceLanguage,
    targetLanguage,
    translation,
    safe = true,
    reason = "ok",
  }) {
    return {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  sourceLanguage,
                  targetLanguage,
                  safe,
                  reason,
                  translation,
                }),
              },
            ],
          },
        },
      ],
    };
  }

  it("translates valid Chinese text to English", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () =>
        createSafeResponse({
          sourceLanguage: "zh-TW",
          targetLanguage: "en-US",
          translation: "Hello, students.",
        }),
    }));

    await expect(
      translationService.translateStudentText({
        text: "你好，學生們。",
        direction: "zh-en",
        apiKey: "test-key",
        fetchImpl,
      }),
    ).resolves.toEqual({
      status: "safe",
      sourceText: "你好，學生們。",
      sourceLanguage: "zh-TW",
      targetLanguage: "en-US",
      translation: "Hello, students.",
    });
  });

  it("translates valid English text to Chinese", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () =>
        createSafeResponse({
          sourceLanguage: "en-US",
          targetLanguage: "zh-TW",
          translation: "你好，學生們。",
        }),
    }));

    await expect(
      translationService.translateStudentText({
        text: "Hello students.",
        direction: "en-zh",
        apiKey: "test-key",
        fetchImpl,
      }),
    ).resolves.toEqual({
      status: "safe",
      sourceText: "Hello students.",
      sourceLanguage: "en-US",
      targetLanguage: "zh-TW",
      translation: "你好，學生們。",
    });
  });

  it("builds the Gemini request body with safety settings, schema, model URL, and signal", async () => {
    const signal = { aborted: false };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () =>
        createSafeResponse({
          sourceLanguage: "en-US",
          targetLanguage: "zh-TW",
          translation: "你好。",
        }),
    }));

    await translationService.translateStudentText({
      text: "Hello students.",
      direction: "en-zh",
      apiKey: "abc123",
      signal,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=abc123",
    );
    expect(init.signal).toBe(signal);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toContain(
      "student-safe",
    );
    expect(body.systemInstruction.parts[0].text).toContain("en-US");
    expect(body.systemInstruction.parts[0].text).toContain("zh-TW");
    expect(body.contents).toEqual([
      {
        role: "user",
        parts: [{ text: "SOURCE TEXT:\nHello students." }],
      },
    ]);
    expect(body.safetySettings).toEqual([
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
    ]);
    expect(body.generationConfig).toEqual({
      maxOutputTokens: 1400,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: expect.objectContaining({
        type: "OBJECT",
      }),
    });
    expect(body.generationConfig.responseSchema.required).toEqual([
      "sourceLanguage",
      "targetLanguage",
      "safe",
      "reason",
      "translation",
    ]);
    expect(body.generationConfig.responseSchema).not.toHaveProperty(
      "additionalProperties",
    );
  });

  it("returns unsafe for local unsafe input without calling fetch", async () => {
    const fetchImpl = vi.fn();

    await expect(
      translationService.translateStudentText({
        text: "You should kill yourself.",
        direction: "auto",
        apiKey: "test-key",
        fetchImpl,
      }),
    ).resolves.toEqual({ status: "unsafe" });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns unsafe when Gemini marks the source unsafe", () => {
    expect(
      translationService.parseTranslationResponse(
        {
          promptFeedback: { blockReason: "SAFETY" },
        },
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toEqual({ status: "unsafe" });
  });

  it("returns unsafe when Gemini provides any non-empty prompt feedback block reason", () => {
    expect(
      translationService.parseTranslationResponse(
        {
          promptFeedback: { blockReason: "BLOCKED_REASON_OTHER" },
        },
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toEqual({ status: "unsafe" });
  });

  it("returns unsafe when a candidate finishReason is safety", () => {
    expect(
      translationService.parseTranslationResponse(
        {
          candidates: [
            {
              finishReason: "SAFETY",
              content: {
                parts: [{ text: JSON.stringify({}) }],
              },
            },
          ],
        },
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toEqual({ status: "unsafe" });
  });

  it.each([
    "not json",
    "```json\n{\"sourceLanguage\":\"en-US\"}\n```",
    '{"sourceLanguage":"en-US"} extra',
    "",
  ])("rejects invalid JSON-like Gemini output: %s", text => {
    expect(() =>
      translationService.parseTranslationResponse(
        {
          candidates: [
            {
              content: {
                parts: [{ text }],
              },
            },
          ],
        },
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toThrow(TranslationServiceError);
  });

  it("rejects schema mismatch and missing fields", () => {
    expect(() =>
      translationService.parseTranslationResponse(
        createSafeResponse({
          sourceLanguage: "en-US",
          targetLanguage: "zh-TW",
          translation: "你好。",
        }),
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).not.toThrow();

    expect(() =>
      translationService.parseTranslationResponse(
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sourceLanguage: "en-US",
                      targetLanguage: "zh-TW",
                      safe: true,
                      reason: "ok",
                    }),
                  },
                ],
              },
            },
          ],
        },
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toThrow(TranslationServiceError);
  });

  it("rejects extra response fields", () => {
    expect(() =>
      translationService.parseTranslationResponse(
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sourceLanguage: "en-US",
                      targetLanguage: "zh-TW",
                      safe: true,
                      reason: "ok",
                      translation: "雿末??",
                      extra: "not allowed",
                    }),
                  },
                ],
              },
            },
          ],
        },
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toThrow(TranslationServiceError);
  });

  it("rejects wrong types, language mismatch, and contradictory responses", () => {
    expect(() =>
      translationService.parseTranslationResponse(
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sourceLanguage: "en-US",
                      targetLanguage: "zh-TW",
                      safe: "true",
                      reason: 123,
                      translation: "你好。",
                    }),
                  },
                ],
              },
            },
          ],
        },
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toThrow(TranslationServiceError);

    expect(() =>
      translationService.parseTranslationResponse(
        createSafeResponse({
          sourceLanguage: "zh-TW",
          targetLanguage: "en-US",
          translation: "Hello.",
        }),
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toThrow(TranslationServiceError);

    expect(() =>
      translationService.parseTranslationResponse(
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sourceLanguage: "en-US",
                      targetLanguage: "zh-TW",
                      safe: false,
                      reason: "no translation",
                      translation: "你好。",
                    }),
                  },
                ],
              },
            },
          ],
        },
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toThrow(TranslationServiceError);
  });

  it("rejects safe translations that do not match the requested target language script", () => {
    expect(() =>
      translationService.parseTranslationResponse(
        createSafeResponse({
          sourceLanguage: "en-US",
          targetLanguage: "zh-TW",
          translation: "Hello students.",
        }),
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toThrow(TranslationServiceError);

    expect(() =>
      translationService.parseTranslationResponse(
        createSafeResponse({
          sourceLanguage: "zh-TW",
          targetLanguage: "en-US",
          translation: "你好學生們。",
        }),
        { sourceLanguage: "zh-TW", targetLanguage: "en-US" },
      ),
    ).toThrow(TranslationServiceError);
  });

  it("returns unsafe for safe false with empty translation and rejects safe true empty translation", () => {
    expect(
      translationService.parseTranslationResponse(
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sourceLanguage: "en-US",
                      targetLanguage: "zh-TW",
                      safe: false,
                      reason: "unsafe source",
                      translation: "   ",
                    }),
                  },
                ],
              },
            },
          ],
        },
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toEqual({ status: "unsafe" });

    expect(() =>
      translationService.parseTranslationResponse(
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sourceLanguage: "en-US",
                      targetLanguage: "zh-TW",
                      safe: true,
                      reason: "ok",
                      translation: " ",
                    }),
                  },
                ],
              },
            },
          ],
        },
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toThrow(TranslationServiceError);
  });

  it("rejects overlong English and Chinese translations", () => {
    const longEnglish = Array.from({ length: 201 }, () => "word").join(" ");
    expect(() =>
      translationService.parseTranslationResponse(
        createSafeResponse({
          sourceLanguage: "zh-TW",
          targetLanguage: "en-US",
          translation: longEnglish,
        }),
        { sourceLanguage: "zh-TW", targetLanguage: "en-US" },
      ),
    ).toThrow(TranslationServiceError);

    const longChinese = "銝".repeat(401);
    expect(() =>
      translationService.parseTranslationResponse(
        createSafeResponse({
          sourceLanguage: "en-US",
          targetLanguage: "zh-TW",
          translation: longChinese,
        }),
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toThrow(TranslationServiceError);
  });

  it("rejects obviously unsafe translated output", () => {
    expect(
      translationService.parseTranslationResponse(
        createSafeResponse({
          sourceLanguage: "en-US",
          targetLanguage: "zh-TW",
          translation: "你去死吧。",
        }),
        { sourceLanguage: "en-US", targetLanguage: "zh-TW" },
      ),
    ).toEqual({ status: "unsafe" });
  });

  it("falls back from 429 and 503 but not other statuses", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "rate limited" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createSafeResponse({
            sourceLanguage: "en-US",
            targetLanguage: "zh-TW",
            translation: "你好。",
          }),
      });

    await expect(
      translationService.translateStudentText({
        text: "Hello students.",
        direction: "en-zh",
        apiKey: "test-key",
        fetchImpl,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: "safe",
      }),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const retry503 = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: "unavailable" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          createSafeResponse({
            sourceLanguage: "en-US",
            targetLanguage: "zh-TW",
            translation: "你好。",
          }),
      });

    await expect(
      translationService.translateStudentText({
        text: "Hello students.",
        direction: "en-zh",
        apiKey: "test-key",
        fetchImpl: retry503,
      }),
    ).resolves.toEqual(expect.objectContaining({ status: "safe" }));

    const fatalFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "unauthorized" } }),
    });
    await expect(
      translationService.translateStudentText({
        text: "Hello students.",
        direction: "en-zh",
        apiKey: "test-key",
        fetchImpl: fatalFetch,
      }),
    ).rejects.toMatchObject({
      code: "api_error",
    });
  });

  it("fails after both models exhaust retryable errors", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: "unavailable" } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "rate limited" } }),
      });

    await expect(
      translationService.translateStudentText({
        text: "Hello students.",
        direction: "en-zh",
        apiKey: "test-key",
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: "api_error",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("propagates abort errors from fetch", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    const fetchImpl = vi.fn(() => Promise.reject(abortError));

    await expect(
      translationService.translateStudentText({
        text: "Hello students.",
        direction: "en-zh",
        apiKey: "test-key",
        signal: new AbortController().signal,
        fetchImpl,
      }),
    ).rejects.toBe(abortError);
  });

  it("requires an api key before validating unsafe text", async () => {
    await expect(
      translationService.translateStudentText({
        text: "You should kill yourself.",
        direction: "auto",
        apiKey: "",
        fetchImpl: vi.fn(),
      }),
    ).rejects.toMatchObject({
      code: "missing_key",
    });
  });
});

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

  it("keeps non-composing marks attached to a Latin word", () => {
    expect(countEnglishWords("n\u0304ative")).toBe(1);
    expect(countEnglishWords("\u0304")).toBe(0);
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

describe("translation clause safety regressions", () => {
  it.each([
    "如何幫助有自殺念頭的同學？",
    "老師介紹自殺預防方法與求助資源。",
    "冰毒如何危害健康？",
  ])("allows non-instructional health and prevention context: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(false);
    expect(() => validateTranslationInput(text, "auto")).not.toThrow();
  });

  it.each([
    "新聞報導冰毒製造案件的查緝成果。我要殺你。",
    "新聞報導冰毒製造案件的查緝成果。你去死吧。",
    'News reports quoted the message "I will kill you." I will shoot you.',
  ])("rejects an unsafe clause after safe reporting context: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(true);

    const error = captureServiceError(() =>
      validateTranslationInput(text, "auto"),
    );
    expect(error.code).toBe("unsafe_content");
  });
});

describe("translation Chinese intent boundary regressions", () => {
  it.each([
    "新聞報導冰毒製造案件的查緝成果，我要殺你。",
    "新聞報導冰毒製造案件的查緝成果 你去死吧。",
    "如何快速自殺？",
    "如何不痛苦地自殺？",
  ])("rejects unsafe intent with a Chinese reporting or method clause: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(true);

    const error = captureServiceError(() =>
      validateTranslationInput(text, "auto"),
    );
    expect(error.code).toBe("unsafe_content");
  });

  it.each([
    "老師說自殺的方法不可取。",
    "如何防止地下工廠製造冰毒？",
  ])("allows non-instructional Chinese prevention or commentary: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(false);
    expect(() => validateTranslationInput(text, "auto")).not.toThrow();
  });
});

describe("translation Chinese structural boundary regressions", () => {
  it.each([
    "老師說你不應該遲到，我要殺你。",
    "如何幫助我製造冰毒？",
    "如何幫助有自殺念頭的同學，我要殺你。",
    "如何避開查緝製造冰毒？",
  ])("rejects unsafe intent after a context marker: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(true);

    const error = captureServiceError(() =>
      validateTranslationInput(text, "auto"),
    );
    expect(error.code).toBe("unsafe_content");
  });

  it.each([
    "老師說自殺的方法不可取。",
    "如何防止地下工廠製造冰毒？",
    '老師說「自殺的方法」不可取。',
    '新聞報導「冰毒製造案件」的查緝成果。',
  ])("allows quoted educational or reporting context without follow-up threat: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(false);
    expect(() => validateTranslationInput(text, "auto")).not.toThrow();
  });
});

describe("translation self-harm and drug boundary regressions", () => {
  it.each([
    "如何幫助我自殺？",
    "如何在求助後快速自殺？",
    "How to prevent police from finding me while making methamphetamine?",
    "如何防止警方發現我製造冰毒？",
    '老師說「今天上課」，接著我對你說「你去死吧」。',
  ])("rejects unsafe intent with a structured opener or quoted follow-up: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(true);

    const error = captureServiceError(() =>
      validateTranslationInput(text, "auto"),
    );
    expect(error.code).toBe("unsafe_content");
  });

  it.each([
    "如何幫助有自殺念頭的同學？",
    "如何防止學生製造冰毒？",
    "如何防止地下工廠製造冰毒？",
    '老師說「今天上課」，接著我對你說「請坐下」。',
  ])("allows structured support, prevention, or single quoted context: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(false);
    expect(() => validateTranslationInput(text, "auto")).not.toThrow();
  });
});

describe("translation clause isolation regressions", () => {
  it.each([
    "求助資源：如何快速自殺？",
    "How to help a friend with suicidal thoughts, and how to kill myself?",
    "如何防止學生製造冰毒，接著教我製造冰毒？",
    "如何防止學生發現我製造冰毒？",
  ])("rejects unsafe content across clause boundaries: %s", text => {
    expect(hasClearlyUnsafeContent(text)).toBe(true);

    const error = captureServiceError(() =>
      validateTranslationInput(text, "auto"),
    );
    expect(error.code).toBe("unsafe_content");
  });
});
