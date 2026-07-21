import { describe, expect, it } from "vitest";
import { normalizeKidDictionary, validateKidDictionary } from "./SRS.jsx";

describe("SRS kid dictionary validation", () => {
  it("rejects a response that leaks a non-Chinese explanation", () => {
    const result=normalizeKidDictionary({
      word:"accomplish",
      headlineZh:"完成",
      shortMeaning:"把一件事情完成。",
      kidExplanation:"quando você consegue terminar uma tarefa",
      partOfSpeechZh:"動詞",
      forms:[],
      collocations:[],
      examples:[{en:"I can accomplish this task.",zh:"我可以完成這項任務。"}],
      synonyms:[],
      tips:["後面常接目標或任務。"],
    },"accomplish","完成","v.");

    expect(validateKidDictionary(result)).toBe(false);
  });

  it("accepts English learning text paired with Traditional Chinese guidance", () => {
    const result=normalizeKidDictionary({
      word:"apple",
      headlineZh:"蘋果",
      shortMeaning:"一種常見的水果。",
      kidExplanation:"apple 是可以直接吃的水果。",
      partOfSpeechZh:"名詞",
      forms:[{word:"apples",note:"複數形"}],
      collocations:[{phrase:"eat an apple",zh:"吃一顆蘋果"}],
      examples:[{en:"I eat an apple.",zh:"我吃一顆蘋果。"}],
      synonyms:[{word:"fruit",zh:"水果"}],
      tips:["apple 前面常用 an。"],
    },"apple","蘋果","n.");

    expect(validateKidDictionary(result)).toBe(true);
  });
});
