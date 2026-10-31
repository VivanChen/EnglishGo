import { CHAPTERS, FURNITURE, LEVELS, REGIONS, getChapter, getFurniture, getPetDefinition } from './worldData.js';
import { PROGRESS_VERSION } from '../../data/progressReset.js';
import { explorationTask, explorationReceipt } from './explorationData.js';

export const WORLD_SCHEMA = 2;
export const TOWN_BOUNDS = { minX: -4, maxX: 4, minZ: -2, maxZ: 4, pathHalfWidth: .6 };
export const CARE_TYPES = ['feed', 'wash', 'play', 'sleep', 'pet'];
const LEARNING_SOURCES = new Set(['srs', 'quiz', 'speak', 'grammar', 'reading', 'novels', 'songs', 'dictation', 'scramble', 'colorIsland', 'wordDash', 'whack', 'match', 'bomb', 'story', 'pictureBooks']);
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, number(value, min)));
const natural = value => Math.max(0, Math.floor(number(value)));
const unique = values => [...new Set(values)];
const stamp = now => {
  const date = now instanceof Date ? now : new Date(now ?? Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
};
const day = value => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const safeId = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const text = (value, fallback = '') => typeof value === 'string' ? value.trim().slice(0, 80) || fallback : fallback;
const emptyProgress = () => ({ step: 0, answers: {}, attempts: {}, settled: false });

export function createWorld({ now } = {}) {
  const date = stamp(now);
  return {
    schemaVersion: WORLD_SCHEMA, progressVersion: PROGRESS_VERSION, createdAt: date, updatedAt: date,
    ownedPets: [], activePetId: null,
    ownedDecorations: FURNITURE.filter(item => item.starter).map(item => item.id),
    placements: [
      { id: 'placement-harbor-cushion', itemId: 'harbor-cushion', x: -2.5, z: 0, rotation: 0 },
      { id: 'placement-harbor-bowl', itemId: 'harbor-bowl', x: -2.5, z: 1.4, rotation: 0 },
      { id: 'placement-harbor-planter', itemId: 'harbor-planter', x: 2.6, z: 0, rotation: 0 },
    ],
    completedChapters: [], chapterProgress: {}, receipts: [], syncReceipts: [], journal: [],
    settings: { quality: 'auto', motion: true, sound: false, musicVolume:60, effectsVolume:80 },
    learningDays: {},
  };
}

export function getPetStage(pet) {
  const exp = natural(pet?.exp);
  const stage = exp >= 300 ? { id: 'grown', label: '自在的家人', start: 300, nextExp: null }
    : exp >= 120 ? { id: 'young', label: '默契夥伴', start: 120, nextExp: 300 }
      : { id: 'baby', label: '初識小夥伴', start: 0, nextExp: 120 };
  return { ...stage, level: Math.floor(exp / 40) + 1, progress: stage.nextExp ? Math.round(100 * (exp - stage.start) / (stage.nextExp - stage.start)) : 100 };
}

export function isChapterUnlocked(world, chapterId) {
  const chapter = getChapter(chapterId);
  return !!chapter && CHAPTERS.filter(item => item.order < chapter.order).every(item => world.completedChapters.includes(item.id));
}

export function getAdoptionSlots(world) {
  const completed = new Set(world?.completedChapters || []);
  if (CHAPTERS.slice(0, 6).every(chapter => completed.has(chapter.id))) return 3;
  if (CHAPTERS.slice(0, 3).every(chapter => completed.has(chapter.id))) return 2;
  return 1;
}

export function canAdoptPet(world, speciesId) {
  return !!getPetDefinition(speciesId) && world.ownedPets.length < getAdoptionSlots(world)
    && !world.ownedPets.some(pet => pet.speciesId === speciesId);
}

export function isDecorationUnlocked(world, itemId) {
  const item = getFurniture(itemId), region = REGIONS.find(region => region.id === item?.setId);
  return !!region && CHAPTERS.slice(0, region.unlockAfter).every(chapter => world.completedChapters.includes(chapter.id));
}

export function getChapterProgress(world, chapterId, level) {
  return world?.chapterProgress?.[`${chapterId}:${level}`] || emptyProgress();
}

function normalizeProgress(raw, chapterId, level) {
  const challenges = getChapter(chapterId)?.levels?.[level]?.challenges;
  if (!challenges || !raw || typeof raw !== 'object') return emptyProgress();
  const answers = {}, attempts = {};
  let step = 0;
  for (let index = 0; index < challenges.length; index++) {
    // Only a contiguous sequence of answered challenges can unlock completion.
    if (index > step) break;
    const answer = raw.answers?.[index];
    if (!Number.isInteger(answer) || answer < 0 || answer >= challenges[index].options.length) break;
    answers[index] = answer;
    attempts[index] = Math.max(1, Math.min(99, natural(raw.attempts?.[index])));
    if (answer === challenges[index].answer) step++;
  }
  return { step, answers, attempts, settled: step === challenges.length && raw.settled === true };
}

function footprint(placement) {
  const size = getFurniture(placement.itemId).size;
  const quarter = Math.round(placement.rotation / (Math.PI / 2));
  return Math.abs(quarter % 2) === 1 ? { x: size.z, z: size.x } : size;
}

export function validatePlacement(world, requested) {
  if (!requested || !getFurniture(requested.itemId) || !world.ownedDecorations.includes(requested.itemId)) return { ok: false, reason: '先取得這件家具，再把它放進小家。' };
  if (![requested.x, requested.z].every(value => typeof value === 'number' && Number.isFinite(value))
    || requested.rotation != null && (typeof requested.rotation !== 'number' || !Number.isFinite(requested.rotation))) return { ok: false, reason: '請選擇庭院裡的一個位置。' };
  const previous = world.placements.find(item => item.itemId === requested.itemId);
  const rotation = ((Math.round((requested.rotation || 0) / (Math.PI / 2)) % 4) + 4) % 4 * Math.PI / 2;
  const placement = {
    id: previous?.id || (safeId(requested.id) ? requested.id : `placement-${requested.itemId}`), itemId: requested.itemId,
    x: Math.round(requested.x * 10) / 10, z: Math.round(requested.z * 10) / 10, rotation,
  };
  if (world.placements.some(item => item.id === placement.id && item.itemId !== placement.itemId)) return { ok: false, reason: '這個家具位置已經有其他物件。' };
  const size = footprint(placement), { minX, maxX, minZ, maxZ, pathHalfWidth } = TOWN_BOUNDS;
  if (placement.x - size.x / 2 < minX || placement.x + size.x / 2 > maxX || placement.z - size.z / 2 < minZ || placement.z + size.z / 2 > maxZ) return { ok: false, reason: '家具要完整放在庭院裡，試著往裡面移一點。' };
  if (placement.x - size.x / 2 < pathHalfWidth && placement.x + size.x / 2 > -pathHalfWidth) return { ok: false, reason: '中間的小路留給夥伴散步，試試兩旁的空地。' };
  const isRug = id => getFurniture(id)?.kind === 'rug';
  const overlaps = !isRug(placement.itemId) && world.placements.some(other => {
    if (other.itemId === placement.itemId || isRug(other.itemId)) return false;
    const otherSize = footprint(other);
    return Math.abs(placement.x - other.x) + .001 < (size.x + otherSize.x) / 2
      && Math.abs(placement.z - other.z) + .001 < (size.z + otherSize.z) / 2;
  });
  if (overlaps) return { ok: false, reason: '這裡有家具了，留一點舒服的空間給它們。' };
  return { ok: true, placement };
}

function refreshPet(pet, now) {
  const nowMs = new Date(now).getTime(), lastMs = new Date(pet.lastUpdate).getTime();
  const hours = Number.isFinite(lastMs) ? Math.max(0, (nowMs - lastMs) / 3600000) : 0;
  const elapsed = Math.min(24, hours);
  return { ...pet,
    hunger: Math.max(50, clamp(pet.hunger, 50, 100) - elapsed),
    clean: Math.max(50, clamp(pet.clean, 50, 100) - elapsed * .5),
    energy: clamp(number(pet.energy, 80) + elapsed * 4, 50, 100), lastUpdate: now,
  };
}

function validSettings(raw = {}) {
  return { quality: ['auto', 'high', 'low'].includes(raw?.quality) ? raw.quality : 'auto', motion: raw?.motion !== false, sound: raw?.sound === true, musicVolume:clamp(number(raw?.musicVolume,60),0,100), effectsVolume:clamp(number(raw?.effectsVolume,80),0,100) };
}

// A v1/legacy save deliberately contributes no pets, eggs, food or unlocked
// content. This release starts new progression and never reimports them.
export function migrateLegacyWorld(raw, { now } = {}) {
  const base = createWorld({ now }), date = base.updatedAt;
  if (!raw || raw.schemaVersion !== WORLD_SCHEMA) return base;
  const seenPets = new Set(), ownedPets = [];
  for (const pet of Array.isArray(raw.ownedPets) ? raw.ownedPets : []) {
    const definition = getPetDefinition(pet?.speciesId);
    if (!definition || seenPets.has(definition.id)) continue;
    seenPets.add(definition.id);
    const oldLog = pet.careLog && typeof pet.careLog === 'object' ? pet.careLog : {};
    ownedPets.push(refreshPet({
      id: `pet-${definition.id}`, speciesId: definition.id, name: text(pet.name, definition.name),
      exp: natural(pet.exp), bond: natural(pet.bond), hunger: number(pet.hunger, 90), clean: number(pet.clean, 90), energy: number(pet.energy, 90),
      lastUpdate: pet.lastUpdate || date, adoptedAt: Number.isFinite(new Date(pet.adoptedAt).getTime()) ? pet.adoptedAt : date,
      careLog: { date: typeof oldLog.date === 'string' ? oldLog.date : '', actions: unique((Array.isArray(oldLog.actions) ? oldLog.actions : []).filter(item => CARE_TYPES.includes(item))) },
    }, date));
  }
  const ownedDecorations = unique([...base.ownedDecorations, ...(Array.isArray(raw.ownedDecorations) ? raw.ownedDecorations : []).filter(id => getFurniture(id))]);
  const world = { ...base, createdAt: Number.isFinite(new Date(raw.createdAt).getTime()) ? raw.createdAt : date,
    ownedPets, activePetId: ownedPets.some(pet => pet.id === raw.activePetId) ? raw.activePetId : ownedPets[0]?.id || null,
    ownedDecorations, placements: [],
    completedChapters: CHAPTERS.filter(chapter => Array.isArray(raw.completedChapters) && raw.completedChapters.includes(chapter.id)).map(chapter => chapter.id),
    receipts: unique((Array.isArray(raw.receipts) ? raw.receipts : []).filter(safeId)),
    syncReceipts: unique((Array.isArray(raw.syncReceipts) ? raw.syncReceipts : []).filter(safeId)),
    settings: validSettings(raw.settings),
    journal: (Array.isArray(raw.journal) ? raw.journal : []).filter(entry => entry && safeId(entry.id) && typeof entry.text === 'string').slice(-60).map(entry => ({ id: entry.id, text: entry.text.slice(0, 300), at: Number.isFinite(new Date(entry.at).getTime()) ? entry.at : date, kind: text(entry.kind, 'memory') })),
    learningDays: Object.fromEntries(Object.entries(raw.learningDays && typeof raw.learningDays === 'object' ? raw.learningDays : {}).filter(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort(([a], [b]) => b.localeCompare(a)).slice(0, 60).map(([key, value]) => [key, Math.min(5, natural(value))])),
  };
  for (const requested of Array.isArray(raw.placements) ? raw.placements : base.placements) {
    const checked = validatePlacement(world, requested);
    if (checked.ok && !world.placements.some(item => item.itemId === checked.placement.itemId)) world.placements.push(checked.placement);
  }
  for (const chapter of CHAPTERS) for (const level of LEVELS) {
    const key = `${chapter.id}:${level}`;
    if (raw.chapterProgress?.[key]) world.chapterProgress[key] = normalizeProgress(raw.chapterProgress[key], chapter.id, level);
  }
  return world;
}

function addJournal(world, id, message, at, kind) {
  if (world.journal.some(entry => entry.id === id)) return world.journal;
  return [...world.journal, { id, text: message, at, kind }].slice(-60);
}

export function applyWorldAction(input, action, { coins = 0, now } = {}) {
  const date = stamp(now), world = input?.schemaVersion === WORLD_SCHEMA ? input : createWorld({ now: date });
  const unchanged = notice => ({ world, coinDelta: 0, notice });
  if (!action || typeof action.type !== 'string') return unchanged('');
  const finish = (next, notice, extra = {}) => ({ world: { ...next, updatedAt: date }, coinDelta: 0, notice, ...extra });
  const receipt = id => world.receipts.includes(id);

  if (action.type === 'EXPLORE_DISCOVERY') {
    const task = explorationTask(action.placeId, action.taskId);
    if (!world.ownedPets.length || !task || action.answer !== task.answer) return unchanged('');
    const id = explorationReceipt(action.placeId, action.taskId);
    if (receipt(id)) return unchanged('');
    return finish({ ...world, receipts: [...world.receipts, id], journal: addJournal(world, id, `一起完成「${task.title}」：${task.word} — ${task.zh}`, date, 'exploration') }, '');
  }

  if (action.type === 'ADOPT_STARTER' || action.type === 'ADOPT_FRIEND') {
    const starter = action.type === 'ADOPT_STARTER';
    if (starter && world.ownedPets.length || !starter && !world.ownedPets.length) return unchanged('這次領養已經完成了。');
    if (!canAdoptPet(world, action.speciesId)) return unchanged('完成港町或果園的故事，就能迎接下一位朋友。');
    const definition = getPetDefinition(action.speciesId), id = `pet-${definition.id}`, receiptId = `adopt:${definition.id}`;
    if (receipt(receiptId)) return unchanged('這位朋友已經在家了。');
    const pet = { id, speciesId: definition.id, name: definition.name, exp: 0, bond: 0, hunger: 90, clean: 90, energy: 90, adoptedAt: date, lastUpdate: date, careLog: { date: '', actions: [] } };
    return finish({ ...world, ownedPets: [...world.ownedPets, pet], activePetId: id, receipts: [...world.receipts, receiptId], journal: addJournal(world, receiptId, `${definition.name} 搬進了小家。我們的故事從今天開始。`, date, 'adoption') }, `${definition.name}，歡迎回家！`);
  }

  if (action.type === 'SELECT_PET') {
    if (!world.ownedPets.some(pet => pet.id === action.petId)) return unchanged('這位朋友還沒有搬進小家。');
    return finish({ ...world, activePetId: action.petId }, '');
  }

  if (action.type === 'CARE') {
    const petId = action.petId || world.activePetId, careType = action.careType;
    const pet = world.ownedPets.find(item => item.id === petId);
    if (!pet || !CARE_TYPES.includes(careType)) return unchanged('先選一位想陪伴的朋友。');
    const today = day(date), receiptId = `care:${pet.id}:${today}:${careType}`, first = !receipt(receiptId) && !(pet.careLog?.date === today && pet.careLog.actions?.includes(careType));
    let nextPet = refreshPet(pet, date);
    if (careType === 'feed') nextPet.hunger = 100;
    if (careType === 'wash') nextPet.clean = 100;
    if (careType === 'sleep') nextPet.energy = 100;
    if (careType === 'play') nextPet.energy = Math.max(50, nextPet.energy - 3);
    nextPet = { ...nextPet, bond: pet.bond + (first ? 2 : 0), careLog: { date: today, actions: unique([...(pet.careLog?.date === today ? pet.careLog.actions || [] : []), careType]) } };
    const messages = { feed: '吃飽了，慢慢享受今天。', wash: '乾乾淨淨，連心情都輕盈了。', play: '一起玩的小時光，就是最好的禮物。', sleep: '休息一下，小島會等我們。', pet: '靠近一點，就覺得很安心。' };
    return finish({ ...world, ownedPets: world.ownedPets.map(item => item.id === petId ? nextPet : item), receipts: first ? [...world.receipts, receiptId] : world.receipts,
      journal: first ? addJournal(world, receiptId, `${pet.name}：${messages[careType]}`, date, 'care') : world.journal,
    }, `${messages[careType]}${first ? ' 親密 +2' : ''}`);
  }

  if (action.type === 'BUY_DECOR') {
    const item = getFurniture(action.itemId);
    if (!item) return unchanged('找不到這件家具。');
    if (world.ownedDecorations.includes(item.id)) return unchanged('這件家具已經在你的收藏裡了。');
    if (!isDecorationUnlocked(world, item.id)) return unchanged('先完成前一區的故事，就能認識這一區的家具。');
    if (!Number.isFinite(Number(coins)) || Number(coins) < item.price) return unchanged('金幣還不夠。探索也會送你家具，慢慢佈置就好。');
    return finish({ ...world, ownedDecorations: [...world.ownedDecorations, item.id], receipts: [...world.receipts, `buy:${item.id}`] }, `${item.name} 已加入收藏，選個喜歡的位置吧。`, { coinDelta: -item.price });
  }

  if (action.type === 'PLACE_DECOR') {
    const checked = validatePlacement(world, action.placement);
    if (!checked.ok) return unchanged(checked.reason);
    const placement = checked.placement;
    return finish({ ...world, placements: [...world.placements.filter(item => item.itemId !== placement.itemId), placement] }, `${getFurniture(placement.itemId).name} 放好了。`);
  }

  if (action.type === 'REMOVE_DECOR') {
    if (!world.placements.some(item => item.id === action.placementId)) return unchanged('');
    return finish({ ...world, placements: world.placements.filter(item => item.id !== action.placementId) }, '已收回收藏，隨時可以再放出來。');
  }

  if (action.type === 'STORY_PROGRESS') {
    const chapter = getChapter(action.chapterId), level = action.level;
    if (!world.ownedPets.length || !chapter || !LEVELS.includes(level) || !isChapterUnlocked(world, chapter.id)) return unchanged('先完成前一段故事，再一起往前走。');
    const key = `${chapter.id}:${level}`, progress = getChapterProgress(world, chapter.id, level), index = action.step;
    const challenge = chapter.levels[level].challenges[index];
    if (!Number.isInteger(index) || index !== progress.step || !challenge || !Number.isInteger(action.answer) || !challenge.options[action.answer]) return unchanged('');
    const correct = action.answer === challenge.answer;
    const next = { step: correct ? progress.step + 1 : progress.step, answers: { ...progress.answers, [index]: action.answer }, attempts: { ...progress.attempts, [index]: Math.min(99, (progress.attempts[index] || 0) + 1) }, settled: false };
    return finish({ ...world, chapterProgress: { ...world.chapterProgress, [key]: next } }, correct ? '找到線索了，故事往前走了一步。' : '再看看故事裡的線索，可以慢慢試。');
  }

  if (action.type === 'REPLAY_CHAPTER') {
    if (!getChapter(action.chapterId) || !LEVELS.includes(action.level) || !world.completedChapters.includes(action.chapterId)) return unchanged('先完成這一章，就能隨時重溫故事。');
    return finish({ ...world, chapterProgress: { ...world.chapterProgress, [`${action.chapterId}:${action.level}`]: emptyProgress() } }, '重新翻開這段回憶，和夥伴一起找找線索。');
  }

  if (action.type === 'COMPLETE_CHAPTER') {
    const chapter = getChapter(action.chapterId), level = action.level;
    if (!chapter || !LEVELS.includes(level) || !isChapterUnlocked(world, chapter.id)) return unchanged('前面的故事還在等你。');
    const key = `${chapter.id}:${level}`, progress = getChapterProgress(world, chapter.id, level), challenges = chapter.levels[level].challenges;
    if (progress.step !== challenges.length || !challenges.every((challenge, index) => progress.answers[index] === challenge.answer)) return unchanged('先找出這一章的兩個線索吧。');
    const pet = world.ownedPets.find(item => item.id === world.activePetId);
    if (!pet) return unchanged('先迎接一位夥伴，再一起完成故事。');
    if (progress.settled) return unchanged('這段回憶已經收好了，歡迎隨時再讀一次。');
    const chapterProgress = { ...world.chapterProgress, [key]: { ...progress, settled: true } };
    const receiptId = `chapter:${chapter.id}`;
    if (world.completedChapters.includes(chapter.id) || receipt(receiptId)) {
      const replayId = `replay:${chapter.id}:${day(date)}`;
      if (receipt(replayId)) return finish({ ...world, chapterProgress }, '今天的這段回憶已經陪伴夥伴成長了，還是可以開心重讀。');
      return finish({ ...world, chapterProgress,
        ownedPets: world.ownedPets.map(item => item.id === pet.id ? { ...refreshPet(item, date), exp: item.exp + 10 } : item),
        receipts: [...world.receipts, replayId], journal: addJournal(world, replayId, `和${pet.name}重溫了「${chapter.title}」，又發現了一點新的默契。`, date, 'replay'),
      }, `和${pet.name}重溫故事，成長 +10。家具與首次獎勵不會重複領取。`);
    }
    return finish({ ...world,
      chapterProgress,
      ownedPets: world.ownedPets.map(item => item.id === pet.id ? { ...refreshPet(item, date), exp: item.exp + chapter.petXp, bond: item.bond + chapter.bond } : item),
      ownedDecorations: unique([...world.ownedDecorations, ...chapter.rewardItemIds]), completedChapters: [...world.completedChapters, chapter.id], receipts: [...world.receipts, receiptId],
      journal: addJournal(world, receiptId, `和${pet.name}完成了「${chapter.title}」。新回憶也變成了家裡的小風景。`, date, 'story'),
    }, `「${chapter.title}」完成！${pet.name}成長 +${chapter.petXp}，故事禮物已放進收藏。`, { completedChapter: chapter.id });
  }

  if (action.type === 'LEARNING_EVENT') {
    const event = action.event;
    if (!safeId(event?.id) || event.id.length > 160 || !LEARNING_SOURCES.has(event?.source)) return unchanged('');
    const pet = world.ownedPets.find(item => item.id === world.activePetId);
    if (!pet || event.kind && !['practice', 'check', 'complete'].includes(event.kind)) return unchanged('');
    const receiptId = `learning:${event.id}`, today = day(date);
    if (receipt(receiptId)) return unchanged('');
    // Even a capped event is acknowledged, so replaying it tomorrow cannot pay.
    if ((world.learningDays?.[today] || 0) >= 5) return finish({ ...world, receipts: [...world.receipts, receiptId] }, '');
    const days = { ...(world.learningDays || {}), [today]: (world.learningDays?.[today] || 0) + 1 };
    const learningDays = Object.fromEntries(Object.entries(days).sort(([a], [b]) => b.localeCompare(a)).slice(0, 60));
    return finish({ ...world, ownedPets: world.ownedPets.map(item => item.id === pet.id ? { ...refreshPet(item, date), exp: item.exp + 2, bond: item.bond + 1 } : item), learningDays,
      receipts: [...world.receipts, receiptId],
    }, `${pet.name}陪你練習了一小步。成長 +2`);
  }

  if (action.type === 'SETTINGS') return finish({ ...world, settings: validSettings({ ...world.settings, ...(action.patch && typeof action.patch === 'object' ? action.patch : {}) }) }, '小家設定已保存。');
  return unchanged('');
}
