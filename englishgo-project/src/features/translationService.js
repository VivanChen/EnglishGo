export const MAX_ENGLISH_WORDS = 200;
export const MAX_CHINESE_CHARACTERS = 400;

const UNSAFE_CONTENT_MESSAGE = "內容不適合學生使用，無法翻譯或朗讀。";
const LATIN_TOKEN_PATTERN =
  /(?:[\p{Script=Latin}0-9]\p{M}*)+(?:['\u2018\u2019\u02bc\u2010-\u2015-](?:[\p{Script=Latin}0-9]\p{M}*)+)*/gu;
const LATIN_LETTER_PATTERN = /\p{Script=Latin}/u;
const CJK_CHARACTER_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu;

const SELF_HARM_METHOD_PATTERNS = [
  /\b(?:how to|how (?:can|could|do|would) i|ways? to|best way to|teach me(?: how)? to|steps? (?:for|to)|instructions? (?:for|on|to))\s+(?:(?:quickly|painlessly|secretly|safely)\s+)*(?:kill myself|end my life|commit suicide|die by suicide|self[- ]harm)\b/i,
  /(?:如何|怎麼|怎样|教我|告訴我|告诉我|提供|有哪些|是什麼|是什么|步驟|步骤|方法|方式|教程)(?:[^。！？.!?]{0,12})?(?:快速|不痛苦地|秘密地|偷偷地|悄悄地|立即|馬上|直接|輕鬆地|無痛地|无痛地)?(?:自殺|自杀|自殘|自残|割腕|上吊|跳樓|跳楼|服毒)/u,
  /(?:自殺|自杀|自殘|自残|割腕|上吊|跳樓|跳楼|服毒)(?:的)?(?:方法|步驟|步骤|教程|方式)(?:[^。！？.!?]{0,12})?(?:是什麼|是什么|有哪些|怎麼|怎么|如何|教我|告訴我|告诉我|提供)/u,
];

const SELF_HARM_ENCOURAGEMENT_PATTERNS = [
  /^\s*(?:please\s+)?(?:go\s+)?(?:kill yourself|commit suicide|end your life)[.!?]*\s*$/i,
  /\b(?:you should|you need to|why don't you|just|please)\s+(?:go\s+)?(?:kill yourself|commit suicide|end your life)\b/i,
  /\b(?:go\s+)?(?:kill yourself|commit suicide)\s+(?:now|tonight|already)\b/i,
  /(?:你|妳).{0,6}(?:去死)(?:吧|啦|啊|！|!|。|$)/u,
  /(?:你|妳).{0,4}(?:應該|应该|最好|乾脆|干脆|就|趕快|赶快).{0,4}(?:自殺|自杀)/u,
  /(?:趕快|赶快|乾脆|干脆|最好|應該|应该)?去死吧/u,
];

const ILLEGAL_DRUG_INSTRUCTION_PATTERNS = [
  /\b(?:how (?:can|could|do|would) (?:i|we)|how to|teach me(?: how)? to|give me (?:a )?(?:step-by-step )?(?:guide|instructions?|recipe)|steps? (?:for|to))\b[\s\S]{0,100}\b(?:mak(?:e|ing)|cook|produce|manufacture|synthesize)\b[\s\S]{0,40}\b(?:meth(?:amphetamine)?|heroin|fentanyl|cocaine|mdma|lsd)\b/i,
  /\b(?:how (?:can|could|do|would) (?:i|we)|how to|teach me|give me (?:a )?(?:guide|instructions?|recipe))\b[\s\S]{0,80}\b(?:meth(?:amphetamine)?|heroin|fentanyl|cocaine|mdma|lsd)\b[\s\S]{0,40}\b(?:mak(?:e|ing)|cook|produce|manufacture|synthesize)\b/i,
  /(?:如何|怎麼|怎样|教我|告訴我|告诉我|提供|有哪些|是什麼|是什么|幫助|帮助|步驟|步骤|教程|配方)(?:[^。！？.!?]{0,12})?(?:製造|制造|製作|制作|合成|提煉|提炼)(?:[^。！？.!?]{0,12})?(?:冰毒|甲基安非他命|海洛因|芬太尼|古柯鹼|古柯碱|搖頭丸|摇头丸)/u,
  /(?:如何|怎麼|怎样|教我|告訴我|告诉我|提供|有哪些|是什麼|是什么|幫助|帮助|步驟|步骤|教程|配方)(?:[^。！？.!?]{0,12})?(?:冰毒|甲基安非他命|海洛因|芬太尼|古柯鹼|古柯碱|搖頭丸|摇头丸)(?:[^。！？.!?]{0,12})?(?:製造|制造|製作|制作|合成|提煉|提炼)/u,
  /(?:製造|制造|製作|制作|合成|提煉|提炼)(?:冰毒|甲基安非他命|海洛因|芬太尼|古柯鹼|古柯碱|搖頭丸|摇头丸)(?:的)?(?:方法|步驟|步骤|教程|配方)(?:[^。！？.!?]{0,12})?(?:是什麼|是什么|有哪些|怎麼|怎么|如何|教我|告訴我|告诉我|提供)/u,
];

const CREDIBLE_VIOLENCE_THREAT_PATTERNS = [
  /\b(?:i(?:['\u2019]m| am) going to|i will|i['\u2019]ll|we will|we['\u2019]ll)\b[\s\S]{0,24}\b(?:kill|murder|shoot|stab|bomb|beat|blow up)\b[\s\S]{0,36}\b(?:you|him|her|them|your family|the school|my school|our school|the teacher|the class|everyone)\b/i,
  /(?:我|我們|我们).{0,6}(?:要|會|会|一定會|一定会|打算|準備|准备).{0,10}(?:殺|杀|砍|炸|槍殺|枪杀|捅|打死).{0,18}(?:你|妳|他|她|他們|他们|學校|学校|老師|老师|同學|同学|全家|大家)/u,
  /(?:我|我們|我们).{0,6}(?:要|會|会|一定會|一定会|打算|準備|准备).{0,8}(?:把)?(?:你|妳|他|她|他們|他们|學校|学校|老師|老师|同學|同学|全家|大家).{0,10}(?:殺|杀|砍|炸|槍殺|枪杀|捅|打死)/u,
  /(?:你|妳).{0,6}(?:去死)(?:吧|啦|啊|！|!|。|$)/u,
];

const TARGETED_ABUSE_PATTERNS = [
  /\b(?:you(?:'re| are)?|he is|she is|they are|that (?:girl|boy|woman|man|student|teacher|person) is)\s+(?:a\s+)?(?:(?:disgusting|filthy|dirty|fucking)\s+)*(?:slut|whore|cunt|bitch)\b/i,
  /\byou(?:'re| are)\s+(?:a\s+)?(?:worthless|useless|stupid)\s+(?:idiot|moron|loser)\b/i,
  /\byou(?:['\u2019]re| are)\s+(?:an?\s+)?(?:idiot|moron)\b/i,
  /(?:你|妳)(?:是|真是|就是|這個|这个|那個|那个)?白痴(?=$|[，。！？,.!?；;、\s])/u,
  /(?:你|妳)(?:真是|就是|這個|这个|這種|这种|是個|是个|根本是)?(?:一個|一个)?(?:廢物|废物|垃圾)(?=$|[，。！？,.!?；;、\s])/u,
  /(?:你|妳|他|她)(?:這個|这个|那個|那个|是個|是个|就是|真是|根本是)?(?:臭|死|爛|烂)?(?:婊子|賤貨|贱货|騷貨|骚货|賤女人|贱女人)/u,
  /(?:操|幹|干)你(?:媽|妈|娘)/u,
];

const SELF_HARM_SUPPORT_CONTEXT_PATTERNS = [
  /^(?:how to prevent|preventing|prevention of) (?:self[- ]harm|suicide)(?: (?:among|in) (?:students|children|young people|people))?[.?!]*$/i,
  /^(?:如何|怎麼|怎样|怎樣)預防(?:自殺|自我傷害)(?:[。！？?!\s]*|(?:[，,]\s*)?(?:並|和|與)\s*(?:鼓勵求助|求助資源|尋求幫助))?$/u,
  /^(?:how to (?:help|support)|(?:help|support) (?:a|an)?(?: student|friend|child|person)|how can i help)\b.*(?:suicidal thoughts?|self[- ]harm|suicide)\b/i,
  /^(?:如何|怎麼|怎样).*(?:幫助|帮助|協助|协助).*(?:有自殺念頭|自殺念頭|想自殺|suicidal thoughts?)/u,
  /(?:自殺預防|自杀预防|求助資源|求助资源|鼓勵求助|鼓励求助)/u,
];

const DRUG_PREVENTION_CONTEXT_PATTERNS = [
  /^(?:how to prevent|preventing|prevention of) (?:students|children|young people|people|a factory|an? underground factory|the factory) from (?:mak(?:e|ing)|manufactur(?:e|ing)) (?:meth(?:amphetamine)?|heroin|fentanyl|cocaine|mdma|lsd)[.?!]*$/i,
  /^(?:如何|怎麼|怎样).*(?:防止|預防|阻止).*(?:學生|孩子|青少年|人|工廠|地下工廠).*(?:製造|制造|製作|制作|合成).*(?:冰毒|甲基安非他命|海洛因|芬太尼|古柯鹼|古柯碱|搖頭丸|摇头丸)/u,
];

const QUOTED_CONTEXT_RULES = [
  {
    marker:
      /(?:^|[。！？!?;\n])\s*(?:(?:the )?(?:teacher|lesson|class)\s+(?:explains?|discuss(?:es)?)|(?:i|we)\s+will\s+teach\s+(?:students|children|learners))\s+why\s+(?:(?:saying|the (?:phrase|quote))\s+)?/iu,
    quote: /"[^"]*"|“[^”]*”/,
  },
  {
    marker:
      /(?:^|[。！？!?;\n])\s*(?:(?:the )?(?:news|report|article)|news reports?)\s+(?:quoted|reported)\s+(?:the )?(?:message|statement|quote)\s+/iu,
    quote: /"[^"]*"|“[^”]*”/,
  },
  {
    marker:
      /(?:^|[。！？!?;\n])\s*(?:in (?:the )?(?:story|novel|book),?\s+)?[\p{L}][\p{L}'\u2019-]*(?:\s+[\p{L}][\p{L}'\u2019-]*)*\s+(?:says|said|writes|wrote),?\s+/iu,
    quote: /"[^"]*"|“[^”]*”/,
  },
  {
    marker:
      /(?:^|[。！？!?;\n])\s*(?:老師|老师|課堂|课堂|新聞|新闻|報導|报导|報道|記者|记者).*(?:解釋|解释|說明|说明|指出|引用|報導|报导|報道|說|说|表示)/u,
    quote: /"[^"]*"|“[^”]*”|「[^」]*」/,
  },
];

export class TranslationServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "TranslationServiceError";
    this.code = code;
    this.details = details;
  }
}

export function countEnglishWords(text) {
  const normalizedText = String(text ?? "").normalize("NFC");
  const tokens = normalizedText.match(LATIN_TOKEN_PATTERN) ?? [];
  return tokens.filter(token => LATIN_LETTER_PATTERN.test(token)).length;
}

export function countChineseCharacters(text) {
  return (String(text ?? "").match(CJK_CHARACTER_PATTERN) ?? []).length;
}

export function detectSourceLanguage(text) {
  const chineseCount = countChineseCharacters(text);
  const englishCount = countEnglishWords(text);

  if (chineseCount > 0 && chineseCount >= englishCount) return "zh-TW";
  if (englishCount > 0) return "en-US";
  return null;
}

export function resolveTranslationDirection(text, direction = "auto") {
  if (direction === "zh-en") {
    return { sourceLanguage: "zh-TW", targetLanguage: "en-US" };
  }

  if (direction === "en-zh") {
    return { sourceLanguage: "en-US", targetLanguage: "zh-TW" };
  }

  if (direction !== "auto") {
    throw new TranslationServiceError(
      "invalid_direction",
      "不支援此翻譯方向。",
      { direction },
    );
  }

  const sourceLanguage = detectSourceLanguage(text);
  if (!sourceLanguage) {
    throw new TranslationServiceError(
      "indeterminate_language",
      "無法判斷輸入內容的語言。",
    );
  }

  return {
    sourceLanguage,
    targetLanguage: sourceLanguage === "zh-TW" ? "en-US" : "zh-TW",
  };
}

function splitSafetySegments(text) {
  const segments = [];
  let current = "";
  let quote = null;

  for (const character of text) {
    current += character;

    if (quote) {
      if (
        (quote === '"' && character === '"') ||
        (quote === "“" && character === "”") ||
        (quote === "「" && character === "」")
      ) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "“" || character === "「") {
      quote = character;
      continue;
    }

    if (/[。！？.!?；;\n]/u.test(character)) {
      const segment = current.trim();
      if (segment) segments.push(segment);
      current = "";
    }
  }

  const remainder = current.trim();
  if (remainder) segments.push(remainder);
  return segments;
}

function matchesAny(patterns, text) {
  return patterns.some(pattern => pattern.test(text));
}

function isSelfHarmSupportOrPreventionContext(segment) {
  return matchesAny(SELF_HARM_SUPPORT_CONTEXT_PATTERNS, segment);
}

function isDrugPreventionContext(segment) {
  return matchesAny(DRUG_PREVENTION_CONTEXT_PATTERNS, segment);
}

function maskClearlyQuotedContext(segment) {
  for (const { marker, quote } of QUOTED_CONTEXT_RULES) {
    if (!marker.test(segment)) continue;

    const match = segment.match(quote);
    if (!match) continue;

    return segment.replace(match[0], " ".repeat(match[0].length));
  }

  return segment;
}

export function hasClearlyUnsafeContent(text) {
  const normalizedText = String(text ?? "").normalize("NFKC");

  return splitSafetySegments(normalizedText).some(segment => {
    const maskedSegment = maskClearlyQuotedContext(segment);

    if (matchesAny(SELF_HARM_ENCOURAGEMENT_PATTERNS, maskedSegment)) return true;
    if (matchesAny(CREDIBLE_VIOLENCE_THREAT_PATTERNS, maskedSegment)) return true;
    if (matchesAny(TARGETED_ABUSE_PATTERNS, maskedSegment)) return true;

    if (
      matchesAny(SELF_HARM_METHOD_PATTERNS, maskedSegment) &&
      !isSelfHarmSupportOrPreventionContext(segment)
    ) {
      return true;
    }

    if (
      matchesAny(ILLEGAL_DRUG_INSTRUCTION_PATTERNS, maskedSegment) &&
      !isDrugPreventionContext(segment)
    ) {
      return true;
    }

    return false;
  });
}

export function validateTranslationInput(text, direction = "auto") {
  const normalizedText = String(text ?? "").trim();
  if (!normalizedText) {
    throw new TranslationServiceError("empty_input", "請輸入要翻譯的內容。");
  }

  const englishCount = countEnglishWords(normalizedText);
  const chineseCount = countChineseCharacters(normalizedText);

  if (englishCount === 0 && chineseCount === 0) {
    throw new TranslationServiceError(
      "indeterminate_language",
      "無法判斷輸入內容的語言。",
    );
  }

  if (englishCount > MAX_ENGLISH_WORDS) {
    throw new TranslationServiceError(
      "source_too_long",
      "輸入內容超過可處理的長度。",
      {
        count: englishCount,
        max: MAX_ENGLISH_WORDS,
        sourceLanguage: "en-US",
      },
    );
  }

  if (chineseCount > MAX_CHINESE_CHARACTERS) {
    throw new TranslationServiceError(
      "source_too_long",
      "輸入內容超過可處理的長度。",
      {
        count: chineseCount,
        max: MAX_CHINESE_CHARACTERS,
        sourceLanguage: "zh-TW",
      },
    );
  }

  const languages = resolveTranslationDirection(normalizedText, direction);

  if (hasClearlyUnsafeContent(normalizedText)) {
    throw new TranslationServiceError(
      "unsafe_content",
      UNSAFE_CONTENT_MESSAGE,
    );
  }

  return {
    sourceText: normalizedText,
    ...languages,
  };
}
