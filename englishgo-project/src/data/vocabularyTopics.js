export const VOCABULARY_TOPIC_TARGET = 20;
export const VOCABULARY_TOPIC_MINIMUM = 5;

export const VOCABULARY_TOPICS = [
  { id: "all", label: "全部單字", icon: "🌈", description: "從目前年級的完整字庫隨機練習" },
  { id: "daily", label: "生活日常", icon: "🏠", description: "居家、身體、衣物、感受與每天會做的事" },
  { id: "numbers", label: "數字時間", icon: "🔢", description: "數字、日期、星期、月份與時間" },
  { id: "food", label: "食物飲料", icon: "🍎", description: "餐點、水果、飲料、餐具與用餐情境" },
  { id: "transport", label: "交通工具", icon: "🚌", description: "車輛、道路、車站與旅行移動" },
  { id: "school", label: "學校學習", icon: "🎒", description: "校園、文具、課堂與學習用語" },
  { id: "people", label: "家庭人物", icon: "👨‍👩‍👧‍👦", description: "家人、朋友、職業與人物描述" },
  { id: "nature", label: "動物自然", icon: "🐾", description: "動物、植物、天氣與自然環境" },
  { id: "business", label: "商用職場", icon: "💼", description: "工作、公司、金錢、購物與服務情境" },
];

const VALID_TOPIC_IDS = new Set(VOCABULARY_TOPICS.map(topic => topic.id).filter(id => id !== "all"));
const THEMED_REVIEW_PREFIX = /^ThemedReview:/i;

const TOPIC_WORDS = {
  daily: [
    "little","small","large","long","short","tall","young","old","new","good","bad","cute","kind","nice","clean","dirty","hot","cold","warm","cool","easy","hard","fast","slow","early","late","full","hungry","thirsty","tired","sick","funny","quiet","loud","beautiful","favorite",
    "head","hair","face","eye","ear","nose","mouth","hand","arm","leg","foot","feet","tooth","body","neck","shoulder","finger","heart","stomach","knee","voice","sound","healthy","headache","medicine","comfortable","blind",
    "room","house","home","kitchen","bathroom","restroom","bedroom","dining room","living room","door","window","table","chair","desk","bed","apartment","garden","floor","ground","wall","lamp","light","towel","sofa","telephone","television","radio","refrigerator","fan",
    "shirt","tshirt","pants","shorts","skirt","dress","shoes","socks","hat","cap","coat","jacket","umbrella","uniform",
    "wake","wash","brush","sleep","night","morning","breakfast","dinner","walk","sit","stand","open","close","look","see","watch","listen","speak","talk","hear","smell","hold","pick","touch","smile","cry","laugh","shout","wait","live","visit","meet","call","help","carry","keep","begin","finish","remember","forget","care",
    "afraid","angry","bored","weak","excited","glad","surprised","lonely","alone","ready","safe","dangerous","serious","polite","honest","careful","busy","happy","friend","apartment","candle","ceiling","danger","darkness","escape","fear","injured","promise","protect","return","secret","warning","window","alleviate","deteriorate",
  ],
  numbers: [
    "zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty","thirty","forty","fifty","hundred","thousand","million","first","second","third","last","next","half","count",
    "monday","tuesday","wednesday","thursday","friday","saturday","sunday","january","february","march","april","may","june","july","august","september","october","november","december",
    "today","tomorrow","yesterday","morning","noon","afternoon","evening","night","tonight","week","weekend","month","year","day","minute","hour","time","o'clock","clock","a.m.","p.m.","date","birthday","past","future","ago","until","moment","later","during","already","yet","still","season","spring","summer","autumn","winter","midnight","final",
  ],
  food: [
    "apple","rice","bread","milk","egg","cake","cookie","banana","juice","tea","lunch","soup","candy","chicken","drink","eat","cook","noodles","pizza","hamburger","sandwich","salad","vegetable","fruit","tomato","potato","carrot","corn","meat","beef","pork","snack","sugar","salt","chocolate",
    "food","meal","menu","pie","steak","hot dog","butter","cheese","ham","oil","ice cream","popcorn","lemon","coke","coffee","bottle","bowl","knife","glass","spoon","cup","fork","chopsticks","delicious","fresh","order","taste","bite","grape","guava","papaya","peach","strawberry","watermelon","pineapple","kiwi","mango",
    "stinky tofu","soy milk","congee","pearl milk tea","pickle","wahoo","oyster","squid","rice dumpling","moon cake","pumpkin","breakfast","dinner","restaurant","bakery","supermarket","waiter","waitress",
  ],
  transport: [
    "bus","car","bike","bicycle","street","station","ride","drive","driver","road","block","town","city","airplane","plane","boat","motorcycle","ship","taxi","truck","airport","bridge","sidewalk","traffic","trip","travel","journey","ticket","scooter","mrt","train","platform","tunnel","suitcase","map","arrive","leave","go","come","move","turn","stop","catch","return",
  ],
  school: [
    "school","elementary school","junior high school","senior high school","teacher","student","class","classmate","classroom","playground","library","book","read","write","study","learn","practice","listen","speak","answer","ask","question","homework","lesson","test","story","song","letter","word","sentence","picture","dictionary","knowledge","example","language","prepare","repeat","understand","excellent","grade","problem","mistake",
    "pen","pencil","ruler","bag","eraser","notebook","paper","page","marker","computer","art","music","desk","uniform","headmaster","dormitory","shelves","map","symbol","memory","accepted","comprehensive","controversial","phenomenon","unprecedented","ambiguous","facilitate",
  ],
  people: [
    "mother","mom","father","dad","parent","parents","sister","brother","baby","child","children","girl","boy","man","woman","family","son","daughter","grandfather","grandmother","husband","wife","uncle","aunt","cousin","married",
    "friend","people","person","teenager","classmate","stranger","foreigner","everyone","someone","teacher","student","driver","farmer","shopkeeper","waiter","waitress","doctor","fisherman","nurse","boss","helper","player","keeper","keepers","guardian","king","heir","headmaster","prisoner",
    "pretty","handsome","healthy","friendly","polite","honest","careful","serious","smart","popular","successful","busy","able","famous","kind","gentle","brave","blind",
  ],
  nature: [
    "cow","pig","duck","chicken","sheep","mouse","tiger","lion","elephant","bear","turtle","snake","cat","dog","bird","fish","rabbit","monkey","horse","bee","goat","hen","kangaroo","koala","panda","wahoo","oyster","squid","seagull","bat","reindeer","creature",
    "farm","beach","mountain","sea","sun","moon","star","tree","flower","grass","sky","rain","wind","snow","leaf","rock","stone","sand","cloud","rainbow","forest","petal","twig","path","pond","river","branch","wave","trunk","lake","cave","hill","island","land","rose","air","earth","ice","cactus",
    "typhoon","weather","cloudy","dry","rainy","sunny","wet","windy","season","spring","summer","autumn","winter","nature","environment","phenomenon","sustainable",
  ],
  business: [
    "work","job","office","business","company","factory","bank","market","store","shop","supermarket","restaurant","bakery","bookstore","hotel","hospital","post","internet","email","telephone","meeting","boss","shopkeeper","waiter","waitress","driver","farmer","fisherman","nurse","doctor",
    "buy","sell","pay","money","price","cost","save","order","send","package","product","service","customer","manager","team","chance","successful","busy","possible","ticket","experience","prepare","complete","agree","decide","build","fix","machine","comprehensive","controversial","sophisticated","sustainable","facilitate",
  ],
};

const TOPIC_SETS = Object.fromEntries(
  Object.entries(TOPIC_WORDS).map(([topic, words]) => [topic, new Set(words.map(normalizeWord))])
);

function normalizeWord(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseVocabularyTopics(category) {
  const value = String(category || "").trim();
  if (!THEMED_REVIEW_PREFIX.test(value)) return [];
  return [...new Set(
    value.replace(THEMED_REVIEW_PREFIX, "")
      .split(",")
      .map(topic => topic.trim().toLowerCase())
      .filter(topic => VALID_TOPIC_IDS.has(topic)),
  )];
}

function getWeaknessMap(weakWords) {
  const weakness = new Map();
  (Array.isArray(weakWords) ? weakWords : []).forEach(item => {
    const key = normalizeWord(item?.w);
    if (!key) return;
    weakness.set(key, Math.max(weakness.get(key) || 0, Number(item?.n) || 1));
  });
  return weakness;
}

export function getWeakVocabularyForLevel(weakWords, level) {
  const list = Array.isArray(weakWords) ? weakWords : [];
  const targetLevel = String(level || "").trim();
  if (!targetLevel) return list;

  const scopedWords = new Set(list
    .filter(item => item?.level === targetLevel)
    .map(item => normalizeWord(item?.w))
    .filter(Boolean));
  const seen = new Set();
  return list.filter(item => {
    const key = normalizeWord(item?.w);
    if (!key || seen.has(key)) return false;
    const itemLevel = String(item?.level || "").trim();
    if (itemLevel && itemLevel !== targetLevel) return false;
    if (!itemLevel && scopedWords.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function updateWeakVocabulary(weakWords, word, amount = 1, limit = 50, level = "") {
  const list = Array.isArray(weakWords) ? weakWords : [];
  const cleanWord = String(word || "").trim();
  const key = normalizeWord(cleanWord);
  if (!key) return list;

  const delta = Number.isFinite(Number(amount)) ? Number(amount) : 1;
  const targetLevel = String(level || "").trim();
  const matchingIndexes = list.map((item, index) => ({ item, index })).filter(({ item }) => (
    normalizeWord(item?.w) === key
    && (!targetLevel || !item?.level || item.level === targetLevel)
  )).map(({ index }) => index);
  if (!matchingIndexes.length) {
    if (delta <= 0) return list;
    const next = { w: cleanWord, n: Math.max(1, delta) };
    if (targetLevel) next.level = targetLevel;
    const withNext = [...list, next];
    const max = Math.max(1, Number(limit) || 50);
    if (!targetLevel) return withNext.slice(-max);
    const scopedIndexes = withNext.map((item, index) => ({ item, index }))
      .filter(({ item }) => item?.level === targetLevel)
      .map(({ index }) => index);
    const expired = new Set(scopedIndexes.slice(0, Math.max(0, scopedIndexes.length - max)));
    return withNext.filter((_, index) => !expired.has(index));
  }

  const currentIndex = matchingIndexes.find(index => list[index]?.level === targetLevel) ?? matchingIndexes[0];
  const currentCount = Math.max(...matchingIndexes.map(index => Number(list[index]?.n) || 0));
  const nextCount = Math.max(0, currentCount + delta);
  if (nextCount === 0) return list.filter((_, index) => !matchingIndexes.includes(index));
  return list.flatMap((item, index) => {
    if (index === currentIndex) return [{ ...item, ...(targetLevel ? { level: targetLevel } : {}), n: nextCount }];
    return matchingIndexes.includes(index) ? [] : [item];
  });
}

export function countWeakVocabularyCards(cards, weakWords) {
  const weakness = getWeaknessMap(weakWords);
  return mergeUniqueWordCards(cards).filter(card => weakness.has(normalizeWord(card?.w))).length;
}

export function selectVocabularyTopicRound(cards, {
  weakWords = [],
  previousWords = [],
  limit = VOCABULARY_TOPIC_TARGET,
  random = Math.random,
} = {}) {
  const weakness = getWeaknessMap(weakWords);
  const previous = new Set((Array.isArray(previousWords) ? previousWords : []).map(item => (
    normalizeWord(typeof item === "string" ? item : item?.w)
  )).filter(Boolean));
  const max = Math.max(0, Number(limit) || 0);

  return mergeUniqueWordCards(cards)
    .map((card, index) => ({ card, index, tie: random() }))
    .sort((a, b) => {
      const aKey = normalizeWord(a.card?.w);
      const bKey = normalizeWord(b.card?.w);
      const weakDiff = (weakness.get(bKey) || 0) - (weakness.get(aKey) || 0);
      if (weakDiff) return weakDiff;
      const freshDiff = Number(previous.has(aKey)) - Number(previous.has(bKey));
      if (freshDiff) return freshDiff;
      return a.tie - b.tie || a.index - b.index;
    })
    .slice(0, max)
    .map(item => item.card);
}

export function mergeUniqueWordCards(...groups) {
  const seen = new Set();
  const merged = [];
  groups.flat().filter(Boolean).forEach(card => {
    const key = normalizeWord(card?.w);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(card);
  });
  return merged;
}

export function filterCardsByTopic(cards, topicId) {
  const list = Array.isArray(cards) ? cards : [];
  if (topicId === "all") return list;
  const words = TOPIC_SETS[topicId];
  if (!words) return [];
  return list.filter(card => (
    (Array.isArray(card?.topics) && card.topics.includes(topicId))
    || words.has(normalizeWord(card?.w))
  ));
}

export function getVocabularyTopicCatalog(cards) {
  return VOCABULARY_TOPICS.map(topic => {
    const count = filterCardsByTopic(cards, topic.id).length;
    const ready = topic.id === "all" ? count > 0 : count >= VOCABULARY_TOPIC_MINIMUM;
    const gap = topic.id === "all" ? 0 : Math.max(0, VOCABULARY_TOPIC_TARGET - count);
    const status = !ready ? "missing" : gap > 0 ? "limited" : "ready";
    return { ...topic, count, ready, gap, status };
  });
}
