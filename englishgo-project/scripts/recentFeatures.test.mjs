import { describe, expect, it } from "vitest";
import { collectRecentFeatureUpdates } from "./recentFeatures.mjs";

describe("recent feature updates", () => {
  it("keeps only functional additions from git commits", () => {
    const commits = [
      { hash: "aaaaaaaa", date: "2026-05-21", subject: "Add senior Taipei Cipher song" },
      { hash: "bbbbbbbb", date: "2026-05-20", subject: "Fix mobile novel reader layout" },
      { hash: "cccccccc", date: "2026-05-19", subject: "Add ministry elementary word bank" },
      { hash: "dddddddd", date: "2026-05-18", subject: "Add exam range SRS review" },
      { hash: "eeeeeeee", date: "2026-05-17", subject: "Add song timing calibration updates" },
      { hash: "ffffffff", date: "2026-05-16", subject: "Add AI kid-friendly dictionary panel" },
    ];

    const updates = collectRecentFeatureUpdates(commits, { limit: 4 });

    expect(updates.map((item) => item.title)).toEqual([
      "高中歌曲新增",
      "考試範圍複習",
      "AI 小朋友字典",
    ]);
    expect(updates.map((item) => item.category)).toEqual([
      "歌曲",
      "複習",
      "AI",
    ]);
    expect(updates[0]).toMatchObject({
      description: "Taipei Cipher 台北接力饒舌",
      level: "高中",
      href: "https://github.com/VivanChen/EnglishGo/commit/aaaaaaaa",
    });
    expect(updates[0]).not.toHaveProperty("match");
  });
});
