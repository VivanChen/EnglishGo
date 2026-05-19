import { describe, expect, it } from "vitest";
import { EXTRA_WORDS } from "./extraWords.js";

const elementaryByWord = new Map(
  EXTRA_WORDS.elementary.map(card => [card.w.toLowerCase(), card])
);

describe("elementary supplemental word bank", () => {
  it("includes Ministry elementary PDF words with meaningful examples", () => {
    const words = ["o'clock", "stinky tofu", "comfortable", "motorcycle", "red envelope"];

    for (const word of words) {
      const card = elementaryByWord.get(word);
      expect(card, `${word} should be available to elementary SRS`).toBeTruthy();
      expect(card.ex).toBeTruthy();
      expect(card.ez).toBeTruthy();
      expect(card.ex).not.toContain("today's lesson picture");
      expect(card.ex).not.toContain("with my classmates after school");
      expect(card.ex).not.toContain("easy to understand");
    }
  });
});
