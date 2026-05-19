import { describe, expect, it } from "vitest";
import { CLOCK_TOWER_NOVEL } from "./clockTowerNovel.js";

function blocks(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const blankBlocks = raw.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const lineBlocks = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
  return blankBlocks.length <= 1 && lineBlocks.length > 1 ? lineBlocks : blankBlocks;
}

describe("Clock Tower junior novel bilingual text", () => {
  it("keeps every chapter with one Chinese block per English block", () => {
    for (const chapter of CLOCK_TOWER_NOVEL.chapters) {
      expect(blocks(chapter.zh), `chapter ${chapter.no}`).toHaveLength(blocks(chapter.en).length);
    }
  });

  it("keeps chapter 6 English and Chinese blocks aligned", () => {
    const chapter = CLOCK_TOWER_NOVEL.chapters.find(ch => ch.no === 6);
    const en = blocks(chapter.en);
    const zh = blocks(chapter.zh);

    expect(zh).toHaveLength(en.length);
    expect(zh[en.indexOf("The Headmaster shouted immediately:")]).toBe("校長立刻大喊：");
    expect(zh[en.indexOf("“Protect the boy!”")]).toBe("「保護那孩子！」");
    expect(zh[en.indexOf("Three teachers jumped between Ethan and the smoke.")]).toBe("三名老師跳到伊森與黑煙之間。");
  });

  it("keeps chapter 1 page 9 English and Chinese blocks aligned", () => {
    const chapter = CLOCK_TOWER_NOVEL.chapters.find(ch => ch.no === 1);
    const en = blocks(chapter.en);
    const zh = blocks(chapter.zh);

    expect(zh).toHaveLength(en.length);
    expect(zh[en.indexOf("And around the tower—")]).toBe("高塔周圍——");
    expect(zh[en.indexOf("Tiny glowing stars.")]).toBe("發光的小星星。");
    expect(zh[en.indexOf("Ethan stood up.")]).toBe("伊森站起來。");
    expect(zh[en.indexOf("“Who sent that?”")]).toBe("「誰寄的？」");
  });

  it("keeps corrected later chapters aligned at known drift points", () => {
    const pairs = [
      [8, "A tall figure wearing black armor covered in silver symbols.", "一個穿著刻滿銀色符號黑色盔甲的高大身影。"],
      [2, "A huge black train waited beside the tracks.", "一輛巨大的黑色列車停在軌道旁。"],
      [3, "A pair of glowing purple eyes slowly appeared.", "一雙紫色發光眼睛慢慢出現。"],
      [4, "“Why is it looking at me?!”", "「它為什麼看著我？！」"],
      [4, "Cold spread across the cabin floor.", "寒氣蔓延車廂地板。"],
      [5, "“We’re going to miss the arrival ceremony!”", "「我們會錯過入學儀式！」"],
      [5, "The gates were enormous.", "學校大門非常巨大。"],
      [7, "Something had awakened.", "有某種東西，已經甦醒。"],
      [8, "“That’s impossible…” Ethan whispered.", "「這不可能……」伊森低聲說。"],
      [8, "“…What is THAT?”", "「……那是什麼？」"],
      [8, "“THE TOWER AWAITS.”", "「高塔正在等待。」"],
      [8, "ALONE.", "「獨自一人。」"],
      [9, "Step after step.", "一步又一步。"],
      [9, "At the center of the library stood a giant tree made entirely of silver light.", "在圖書館中央，有一棵完全由銀光組成的巨大樹。"],
      [10, "“THE SEAL IS BREAKING…”", "「封印正在崩壞……」"],
      [11, "HE IS ALREADY AWAKE.", "「祂已經醒了。」"],
      [12, "Something began rising toward them.", "某種東西正在往上爬。"],
      [13, "“The tower itself is alive.”", "「高塔本身是活的。」"],
      [13, "The chamber vanished.", "整個空間消失。"],
      [14, "SEAL THE GATE\nOR\nOPEN THE PRISON", "「封閉大門」\n或者\n「打開監獄」"],
      [15, "A new Keeper had awakened.", "新的守護者，已經誕生。"],
      [16, "Another secret waited to awaken.", "另一個秘密，正在等待甦醒。"],
    ];

    for (const [chapterNo, english, chinese] of pairs) {
      const chapter = CLOCK_TOWER_NOVEL.chapters.find(ch => ch.no === chapterNo);
      const en = blocks(chapter.en);
      const zh = blocks(chapter.zh);
      expect(zh[en.indexOf(english)], `chapter ${chapterNo}: ${english}`).toBe(chinese);
    }
  });
});
