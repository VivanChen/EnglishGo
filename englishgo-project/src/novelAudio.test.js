import { describe, expect, it } from "vitest";
import { NOVELS } from "./data/novels.js";
import {
  NOVEL_CHINESE_AUDIO_VERSION,
  NOVEL_CHINESE_VOICE_ID,
  getNovelAudioUrl,
  makeNovelAudioAssetId,
  makeNovelAudioItem,
  novelBlockPairs,
} from "./data/novelAudio.js";
import { NOVEL_AUDIO_CATALOG, NOVEL_AUDIO_CONFIG } from "../netlify/functions/novel-audio-catalog.js";

describe("fixed novel audio catalog", () => {
  it("contains every English and Chinese chapter title and aligned reading block", () => {
    let expected = 0;
    for (const novels of Object.values(NOVELS)) {
      for (const novel of novels) {
        for (const chapter of novel.chapters || []) {
          expected += 2;
          for (const block of novelBlockPairs(chapter.en, chapter.zh)) {
            if (block.en) expected += 1;
            if (block.zh) expected += 1;
          }
        }
      }
    }

    expect(Object.keys(NOVEL_AUDIO_CATALOG)).toHaveLength(expected);
    expect(expected).toBe(6926);
  });

  it("changes the immutable URL whenever narrated text changes", () => {
    const base = { novelId: "story", chapterNo: 1, lang: "en-US", blockIndex: 0 };
    const first = makeNovelAudioAssetId({ ...base, text: "A quiet morning." });
    const revised = makeNovelAudioAssetId({ ...base, text: "A bright morning." });

    expect(first).not.toBe(revised);
    expect(getNovelAudioUrl(first)).toContain(encodeURIComponent(first));
  });

  it("uses one fixed Mandarin setup and a fixed English narrator URL", () => {
    const chinese = makeNovelAudioItem({
      novelId: "story",
      chapterNo: 1,
      lang: "zh-TW",
      blockIndex: 0,
      text: "今天一起走去公園。",
    });
    const english = makeNovelAudioItem({
      novelId: "story",
      chapterNo: 1,
      lang: "en-US",
      blockIndex: 0,
      text: "We walked to the park today.",
    });

    expect(chinese).toMatchObject({ lang: "zh-TW", rate: 1, apiTts: true });
    expect(english).toMatchObject({ lang: "en-US", rate: 0.9, apiTts: false });
    expect(NOVEL_AUDIO_CONFIG.chineseVoiceId).toBe(NOVEL_CHINESE_VOICE_ID);
    expect(NOVEL_AUDIO_CONFIG.chineseAudioVersion).toBe(NOVEL_CHINESE_AUDIO_VERSION);
    expect(chinese.audioUrl).toContain(`novel=${NOVEL_CHINESE_AUDIO_VERSION}-`);
    expect(english.audioUrl).toContain("novel=v1-");
    expect(chinese.audioUrl).toContain("-zh-block-0-");
    expect(english.audioUrl).toContain("-en-block-0-");
  });
});
