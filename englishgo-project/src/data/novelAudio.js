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

export function compactNovelBlocks(blocks, target) {
  const output = [...blocks];
  const mergeAt = index => {
    output[index] = `${output[index]}\n${output[index + 1]}`;
    output.splice(index + 1, 1);
  };

  while (output.length > target && output.length > 1) {
    const halfSentence = output.findIndex((block, index) => index < output.length - 1 && /[\uFF0C,]$/.test(String(block).trim()));
    if (halfSentence >= 0) {
      mergeAt(halfSentence);
      continue;
    }

    let index = 0;
    let shortest = Infinity;
    output.forEach((block, blockIndex) => {
      const score = String(block).replace(/\s+/g, "").length;
      if (score < shortest) {
        shortest = score;
        index = blockIndex;
      }
    });

    if (index === 0) {
      output[1] = `${output[0]}\n${output[1]}`;
      output.splice(0, 1);
    } else if (index === output.length - 1) {
      output[index - 1] = `${output[index - 1]}\n${output[index]}`;
      output.splice(index, 1);
    } else {
      const previousLength = String(output[index - 1]).length;
      const nextLength = String(output[index + 1]).length;
      if (previousLength <= nextLength) {
        output[index - 1] = `${output[index - 1]}\n${output[index]}`;
        output.splice(index, 1);
      } else {
        output[index + 1] = `${output[index]}\n${output[index + 1]}`;
        output.splice(index, 1);
      }
    }
  }

  return output;
}

export function novelBlockPairs(enText, zhText) {
  let en = novelBlocks(enText);
  let zh = novelBlocks(zhText);
  if (en.length && zh.length && en.length !== zh.length) {
    if (en.length > zh.length) en = compactNovelBlocks(en, zh.length);
    else zh = compactNovelBlocks(zh, en.length);
  }
  const length = Math.max(en.length, zh.length);
  return Array.from({ length }, (_, index) => ({ en: en[index] || "", zh: zh[index] || "", i: index }));
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
