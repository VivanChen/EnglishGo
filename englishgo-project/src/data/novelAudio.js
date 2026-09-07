export const NOVEL_AUDIO_VERSION = "v1";
export const NOVEL_CHINESE_AUDIO_VERSION = "v2";
export const NOVEL_CHINESE_VOICE_ID = "fQj4gJSexpu8RDE2Ii5m";
export const NOVEL_ENGLISH_RATE = 0.9;
export const NOVEL_CHINESE_RATE = 1;

export function novelBlocks(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const blankBlocks = raw.split(/\n\s*\n/).map(value => value.trim()).filter(Boolean);
  const lineBlocks = raw.split(/\n+/).map(value => value.trim()).filter(Boolean);
  return blankBlocks.length <= 1 && lineBlocks.length > 1 ? lineBlocks : blankBlocks;
}

export function novelBlockPairs(enText, zhText, context = "novel chapter") {
  const en = novelBlocks(enText);
  const zh = novelBlocks(zhText);
  // A missing translation cannot be located by sentence length. Reject it so
  // the catalog build fails instead of publishing invented paragraph matches.
  if (en.length !== zh.length) {
    throw new Error(`Unaligned ${context}: ${en.length} English paragraphs, ${zh.length} Chinese paragraphs. Correct the source translations before publishing.`);
  }
  return en.map((text, i) => ({ en: text, zh: zh[i], i }));
}

function contentHash(value) {
  const input = String(value || "");
  let first = 0xdeadbeef ^ input.length;
  let second = 0x41c6ce57 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 2654435761);
    second = Math.imul(second ^ code, 1597334677);
  }
  first = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909);
  second = Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909);
  return `${(second >>> 0).toString(16).padStart(8, "0")}${(first >>> 0).toString(16).padStart(8, "0")}`;
}

function cleanIdPart(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "novel";
}

export function makeNovelAudioAssetId({ novelId, chapterNo, lang, kind = "block", blockIndex = 0, text }) {
  const language = /^zh/i.test(String(lang || "")) ? "zh" : "en";
  const version = language === "zh" ? NOVEL_CHINESE_AUDIO_VERSION : NOVEL_AUDIO_VERSION;
  const rate = language === "zh" ? NOVEL_CHINESE_RATE : NOVEL_ENGLISH_RATE;
  const position = kind === "title" ? "title" : `block-${Math.max(0, Number(blockIndex) || 0)}`;
  const hash = contentHash(JSON.stringify({ version, language, rate, text: String(text || "") }));
  return `${version}-${cleanIdPart(novelId)}-c${Math.max(1, Number(chapterNo) || 1)}-${language}-${position}-${hash}`;
}

export function getNovelAudioUrl(input) {
  const assetId = typeof input === "string" ? input : makeNovelAudioAssetId(input);
  return `/.netlify/functions/elevenlabs-tts?novel=${encodeURIComponent(assetId)}`;
}

export function makeNovelAudioItem({ novelId, chapterNo, lang, kind = "block", blockIndex = 0, text }) {
  const isChinese = /^zh/i.test(String(lang || ""));
  return {
    text,
    lang: isChinese ? "zh-TW" : "en-US",
    rate: isChinese ? NOVEL_CHINESE_RATE : NOVEL_ENGLISH_RATE,
    apiTts: isChinese,
    audioUrl: getNovelAudioUrl({ novelId, chapterNo, lang, kind, blockIndex, text }),
    ...(kind === "block" ? { blockIndex } : {}),
  };
}
