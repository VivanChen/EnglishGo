// Card catalogue for Echo Archive. Values written as [base, upgraded].
export const val = (value, up) => (Array.isArray(value) ? value[up ? 1 : 0] : value);

export const CARD_TYPES = {
  attack: { en: 'Attack', zh: '攻擊' },
  skill: { en: 'Skill', zh: '技能' },
  power: { en: 'Power', zh: '能力' },
  status: { en: 'Status', zh: '狀態' },
  curse: { en: 'Curse', zh: '詛咒' },
};

export const RARITIES = {
  starter: { en: 'Starter', zh: '基礎' },
  common: { en: 'Common', zh: '普通' },
  uncommon: { en: 'Uncommon', zh: '稀有' },
  rare: { en: 'Rare', zh: '傳說' },
  special: { en: 'Special', zh: '特殊' },
};

// Game terms stay in English on purpose: players pick them up the same way
// they learn words from any game, with the Chinese gloss one tap away.
export const KEYWORDS = {
  ward: { en: 'Ward', zh: '護盾', text: '抵擋即將受到的傷害。你的回合開始時歸零。' },
  might: { en: 'Might', zh: '力量', text: '每層使攻擊傷害 +1。' },
  grace: { en: 'Grace', zh: '靈巧', text: '每層使卡牌給予的 Ward +1。' },
  weak: { en: 'Weak', zh: '虛弱', text: '攻擊傷害減少 25%。每回合減少 1 層。' },
  exposed: { en: 'Exposed', zh: '破綻', text: '受到的攻擊傷害增加 50%。每回合減少 1 層。' },
  frail: { en: 'Frail', zh: '脆弱', text: '從卡牌獲得的 Ward 減少 25%。每回合減少 1 層。' },
  burn: { en: 'Burn', zh: '灼燒', text: '回合開始時受到等同層數的傷害（無視 Ward），然後減少 1 層。' },
  spikes: { en: 'Spikes', zh: '反刺', text: '被攻擊時，對攻擊者造成等同層數的傷害。' },
  ritual: { en: 'Ritual', zh: '儀式', text: '每次行動後獲得等同層數的 Might。' },
  fade: { en: 'Fade', zh: '消逝', text: '打出後，本場戰鬥中移除。' },
  fleeting: { en: 'Fleeting', zh: '轉瞬', text: '回合結束時若仍在手中，就會消逝。' },
  chant: { en: 'Chant', zh: '詠唱', text: '打出時解讀一個符文單字。讀對就強化效果；讀錯或略過也照常生效。' },
  echo: { en: 'Echo', zh: '回聲', text: '本回合下一張攻擊牌會再打出一次。' },
  unplayable: { en: 'Unplayable', zh: '無法打出', text: '這張牌不能打出。' },
};

export const POWER_TEXT = {
  stoneheart: { en: 'Stoneheart', zh: '石心', kw: 'ward', text: v => [`回合結束時獲得 `, num(v), ` `, kw('ward')] },
  wildfire: { en: 'Wildfire', zh: '野火', kw: 'burn', text: v => [`回合開始時，對所有敵人施加 `, num(v), ` 層 `, kw('burn')] },
  clarity: { en: 'Clarity', zh: '清明', text: v => [`每回合多抽 `, num(v), ` 張牌`] },
  resonance: { en: 'Resonance', zh: '共鳴', text: v => [`每打出一張技能牌，隨機對一名敵人造成 `, num(v), ` 傷害`] },
  scholar: { en: 'Scholar', zh: '學者', kw: 'chant', text: v => [kw('chant'), ` 強化成功時，獲得 `, num(v), ` 點能量`] },
  ascend: { en: 'Ascend', zh: '昇華', kw: 'might', text: v => [`回合開始時獲得 `, num(v), ` 層 `, kw('might')] },
};

export const CARDS = {
  // Starter
  slash: { en: 'Slash', zh: '斬擊', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', glyph: 'slash', fx: [{ op: 'damage', v: [6, 9] }] },
  guard: { en: 'Guard', zh: '防禦', type: 'skill', rarity: 'starter', cost: 1, target: 'self', glyph: 'shield', fx: [{ op: 'ward', v: [5, 8] }] },
  thunder: { en: 'Thunder', zh: '雷鳴', type: 'attack', rarity: 'starter', cost: 2, target: 'enemy', glyph: 'bolt', fx: [{ op: 'damage', v: [8, 10] }, { op: 'debuff', st: 'exposed', v: [2, 3] }], chant: [{ op: 'damage', v: [5, 7] }] },

  // Common attacks
  cleave: { en: 'Cleave', zh: '橫掃', type: 'attack', rarity: 'common', cost: 1, target: 'all', glyph: 'arc', fx: [{ op: 'damage', v: [8, 11], all: true }] },
  twinFang: { en: 'Twin Fang', zh: '雙牙', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'fangs', fx: [{ op: 'damage', v: [4, 6], hits: 2 }] },
  dash: { en: 'Dash', zh: '疾衝', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'dash', fx: [{ op: 'damage', v: [5, 7] }, { op: 'ward', v: [5, 7] }] },
  ember: { en: 'Ember', zh: '餘燼', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'flame', fx: [{ op: 'damage', v: [3, 4] }, { op: 'debuff', st: 'burn', v: [4, 6] }], chant: [{ op: 'debuff', st: 'burn', v: [3, 4] }] },
  riposte: { en: 'Riposte', zh: '還擊', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'riposte', fx: [{ op: 'damage', v: [7, 10] }, { op: 'draw', v: 1 }] },
  runeBolt: { en: 'Rune Bolt', zh: '符文彈', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'rune', fx: [{ op: 'damage', v: [7, 9] }], chant: [{ op: 'damage', v: [7, 9] }] },
  flick: { en: 'Flick', zh: '輕彈', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', glyph: 'spark', fx: [{ op: 'damage', v: [3, 5] }, { op: 'debuff', st: 'weak', v: 1 }] },
  comet: { en: 'Comet', zh: '彗星', type: 'attack', rarity: 'common', cost: 2, target: 'enemy', glyph: 'comet', fx: [{ op: 'damage', v: [14, 19] }] },
  rebound: { en: 'Rebound', zh: '反彈', type: 'attack', rarity: 'common', cost: [1, 0], target: 'enemy', glyph: 'rebound', fx: [{ op: 'damageWard' }] },

  // Common skills
  barrier: { en: 'Barrier', zh: '屏障', type: 'skill', rarity: 'common', cost: 2, target: 'self', glyph: 'barrier', fx: [{ op: 'ward', v: [12, 16] }] },
  parry: { en: 'Parry', zh: '招架', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'parry', fx: [{ op: 'ward', v: [5, 8] }, { op: 'draw', v: 1 }] },
  focus: { en: 'Focus', zh: '凝神', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'eye', fx: [{ op: 'draw', v: [2, 3] }] },
  smoke: { en: 'Smoke', zh: '煙幕', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'smoke', fx: [{ op: 'ward', v: [6, 8] }, { op: 'debuff', st: 'weak', v: [1, 2], all: true }] },
  mend: { en: 'Mend', zh: '治癒', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'leaf', fx: [{ op: 'heal', v: [4, 6] }], chant: [{ op: 'heal', v: [3, 4] }], fade: true },
  hex: { en: 'Hex', zh: '咒印', type: 'skill', rarity: 'common', cost: 1, target: 'enemy', glyph: 'hex', fx: [{ op: 'debuff', st: 'weak', v: [2, 3] }, { op: 'debuff', st: 'exposed', v: [2, 3] }], chant: [{ op: 'debuff', st: 'exposed', v: 1 }, { op: 'debuff', st: 'weak', v: 1 }] },
  insight: { en: 'Insight', zh: '洞察', type: 'skill', rarity: 'common', cost: 0, target: 'self', glyph: 'spark2', fx: [{ op: 'draw', v: [1, 2] }] },

  // Uncommon attacks
  whirl: { en: 'Whirl', zh: '旋風', type: 'attack', rarity: 'uncommon', cost: 1, target: 'all', glyph: 'whirl', fx: [{ op: 'damage', v: [4, 5], hits: 2, all: true }] },
  inferno: { en: 'Inferno', zh: '煉獄', type: 'attack', rarity: 'uncommon', cost: 2, target: 'all', glyph: 'inferno', fx: [{ op: 'damage', v: [6, 8], all: true }, { op: 'debuff', st: 'burn', v: [3, 4], all: true }] },
  shatter: { en: 'Shatter', zh: '粉碎', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', glyph: 'shatter', fx: [{ op: 'stripWard' }, { op: 'damage', v: [11, 15] }] },
  pierce: { en: 'Pierce', zh: '穿刺', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', glyph: 'pierce', fx: [{ op: 'ifExposed', then: [{ op: 'energy', v: 1 }] }, { op: 'damage', v: [9, 12] }] },
  starfall: { en: 'Starfall', zh: '星落', type: 'attack', rarity: 'uncommon', cost: 1, target: 'all', glyph: 'stars', fx: [{ op: 'damage', v: 3, hits: [4, 5], random: true }] },

  // Uncommon skills
  echo: { en: 'Echo', zh: '回聲', type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'self', glyph: 'echo', fx: [{ op: 'echo', v: 1 }] },
  fortress: { en: 'Fortress', zh: '堡壘', type: 'skill', rarity: 'uncommon', cost: [2, 1], target: 'self', glyph: 'tower', fx: [{ op: 'doubleWard' }] },
  kindle: { en: 'Kindle', zh: '助燃', type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'enemy', glyph: 'kindle', fx: [{ op: 'doubleBurn' }] },
  siphon: { en: 'Siphon', zh: '汲焰', type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'self', glyph: 'siphon', fx: [{ op: 'wardFromBurn' }] },
  warHymn: { en: 'War Hymn', zh: '戰歌', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'horn', fx: [{ op: 'buff', st: 'might', v: [2, 3] }], chant: [{ op: 'buff', st: 'might', v: 1 }], fade: true },
  haste: { en: 'Haste', zh: '迅捷', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self', glyph: 'hourglass', fx: [{ op: 'energy', v: [1, 2] }], fade: true },
  surge: { en: 'Surge', zh: '湧動', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self', glyph: 'surge', fx: [{ op: 'loseHp', v: [3, 2] }, { op: 'energy', v: 2 }] },
  runeWard: { en: 'Rune Ward', zh: '符文盾', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'runeShield', fx: [{ op: 'ward', v: [7, 10] }], chant: [{ op: 'ward', v: [6, 8] }] },
  rewind: { en: 'Rewind', zh: '倒轉', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'rewind', fx: [{ op: 'recycle' }, { op: 'draw', v: [3, 4] }], fade: true },

  // Uncommon powers
  stoneheart: { en: 'Stoneheart', zh: '石心', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'stone', fx: [{ op: 'power', id: 'stoneheart', v: [3, 4] }] },
  wrath: { en: 'Wrath', zh: '怒火', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'wrath', fx: [{ op: 'buff', st: 'might', v: [2, 3] }] },
  bramble: { en: 'Bramble', zh: '荊棘', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'thorn', fx: [{ op: 'buff', st: 'spikes', v: [3, 5] }] },
  poise: { en: 'Poise', zh: '從容', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'feather', fx: [{ op: 'buff', st: 'grace', v: [2, 3] }] },
  resonance: { en: 'Resonance', zh: '共鳴', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'wave', fx: [{ op: 'power', id: 'resonance', v: [3, 4] }] },

  // Rare
  finale: { en: 'Finale', zh: '終章', type: 'attack', rarity: 'rare', cost: 3, target: 'enemy', glyph: 'finale', fx: [{ op: 'damage', v: [28, 36] }], fade: true },
  devour: { en: 'Devour', zh: '吞噬', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', glyph: 'maw', fx: [{ op: 'damage', v: [10, 13], onKill: [3, 4] }], fade: true },
  storm: { en: 'Storm', zh: '風暴', type: 'attack', rarity: 'rare', cost: 'X', target: 'enemy', glyph: 'storm', fx: [{ op: 'damage', v: [5, 7], hits: 'X' }] },
  sanctum: { en: 'Sanctum', zh: '聖域', type: 'skill', rarity: 'rare', cost: 2, target: 'self', glyph: 'sanctum', fx: [{ op: 'ward', v: [25, 32] }], fade: true },
  wildfire: { en: 'Wildfire', zh: '野火', type: 'power', rarity: 'rare', cost: 2, target: 'self', glyph: 'wildfire', fx: [{ op: 'power', id: 'wildfire', v: [2, 3] }] },
  clarity: { en: 'Clarity', zh: '清明', type: 'power', rarity: 'rare', cost: [2, 1], target: 'self', glyph: 'moon', fx: [{ op: 'power', id: 'clarity', v: 1 }] },
  ascend: { en: 'Ascend', zh: '昇華', type: 'power', rarity: 'rare', cost: 3, target: 'self', glyph: 'crown', fx: [{ op: 'power', id: 'ascend', v: [2, 3] }] },
  scholar: { en: 'Scholar', zh: '學者', type: 'power', rarity: 'rare', cost: [1, 0], target: 'self', glyph: 'book', fx: [{ op: 'power', id: 'scholar', v: 1 }] },

  // Statuses and curses
  smudge: { en: 'Smudge', zh: '墨漬', type: 'status', rarity: 'special', cost: null, target: 'none', glyph: 'blot', fx: [], fleeting: true },
  dust: { en: 'Dust', zh: '塵埃', type: 'status', rarity: 'special', cost: null, target: 'none', glyph: 'dust', fx: [] },
  regret: { en: 'Regret', zh: '悔恨', type: 'curse', rarity: 'special', cost: null, target: 'none', glyph: 'regret', fx: [], endTurn: [{ op: 'loseHp', v: 2 }] },
  doubt: { en: 'Doubt', zh: '疑慮', type: 'curse', rarity: 'special', cost: null, target: 'none', glyph: 'doubt', fx: [], endTurn: [{ op: 'selfWeak', v: 1 }] },
};

export const STARTER_DECK = ['slash', 'slash', 'slash', 'slash', 'slash', 'guard', 'guard', 'guard', 'guard', 'thunder'];

export const REWARD_POOL = Object.entries(CARDS)
  .filter(([, card]) => ['common', 'uncommon', 'rare'].includes(card.rarity))
  .map(([id]) => id);
export const CHANT_CARDS = Object.entries(CARDS).filter(([, card]) => card.chant).map(([id]) => id);

export const isUnplayable = card => card.cost === null;
export const cardFades = (card, up) => Boolean(val(card.fade, up));
export const baseCost = (card, up) => (card.cost === 'X' || card.cost === null ? card.cost : val(card.cost, up));
export function cardTitle(inst) {
  const card = CARDS[inst.id];
  return `${card.en}${inst.up ? '+' : ''}`;
}

// ---------- Text rendering ----------
// Segments: plain strings, { kw } keyword chips, { n, tone } numbers.
const num = (n, tone) => ({ n, tone });
const kw = id => ({ kw: id });

export function previewDamage(base, ctx = {}) {
  let amount = base + (ctx.might || 0);
  if (ctx.weak) amount = Math.floor(amount * 0.75);
  if (ctx.exposed) amount = Math.floor(amount * 1.5);
  return Math.max(0, amount);
}
export function previewWard(base, ctx = {}) {
  let amount = base + (ctx.grace || 0);
  if (ctx.frail) amount = Math.floor(amount * 0.75);
  return Math.max(0, amount);
}
const toned = (shown, base) => num(shown, shown > base ? 'up' : shown < base ? 'down' : null);

function effectText(effect, up, ctx) {
  const v = val(effect.v, up);
  switch (effect.op) {
    case 'damage': {
      const shown = toned(previewDamage(v, ctx), v);
      const hits = effect.hits === 'X' ? 'X' : val(effect.hits || 1, up);
      const times = hits === 'X' ? [' X 次'] : hits > 1 ? [` ×${hits}`] : [];
      if (effect.random) return ['隨機對敵人造成 ', shown, ' 傷害', ...times];
      const base = effect.all ? ['對所有敵人造成 ', shown, ' 傷害', ...times] : ['造成 ', shown, ' 傷害', ...times];
      return effect.onKill ? [...base, '。若擊倒目標，最大生命 +', num(val(effect.onKill, up))] : base;
    }
    case 'damageWard': return ['造成等同你目前 ', kw('ward'), ' 的傷害'];
    case 'ward': return ['獲得 ', toned(previewWard(v, ctx), v), ' ', kw('ward')];
    case 'draw': return [`抽 `, num(v), ` 張牌`];
    case 'energy': return ['獲得 ', num(v), ' 點能量'];
    case 'debuff': return [effect.all ? '對所有敵人施加 ' : '施加 ', num(v), ' 層 ', kw(effect.st)];
    case 'buff': return ['獲得 ', num(v), ' 層 ', kw(effect.st)];
    case 'heal': return ['回復 ', num(v), ' 生命'];
    case 'loseHp': return ['失去 ', num(v), ' 生命'];
    case 'selfWeak': return ['回合結束時若在手中，獲得 ', num(v), ' 層 ', kw('weak')];
    case 'doubleWard': return ['使你的 ', kw('ward'), ' 加倍'];
    case 'doubleBurn': return ['使目標的 ', kw('burn'), ' 加倍'];
    case 'stripWard': return ['移除目標所有 ', kw('ward')];
    case 'echo': return [kw('echo'), '：下一張攻擊牌打出兩次'];
    case 'wardFromBurn': return ['獲得等同所有敵人 ', kw('burn'), ' 總和的 ', kw('ward')];
    case 'ifExposed': return ['若目標有 ', kw('exposed'), '，', ...effect.then.flatMap(item => effectText(item, up, ctx))];
    case 'recycle': return ['將棄牌堆洗回抽牌堆'];
    case 'power': return POWER_TEXT[effect.id].text(v);
    default: return [];
  }
}

function joinSentences(parts) {
  const out = [];
  parts.forEach((part, index) => { if (index) out.push('。'); out.push(...part); });
  if (parts.length) out.push('。');
  return out;
}

export function describeCard(inst, ctx = {}) {
  const card = CARDS[inst.id], up = Boolean(inst.up);
  const lines = [];
  if (card.cost === null) lines.push([kw('unplayable'), '。']);
  const body = card.fx.map(effect => effectText(effect, up, ctx));
  if (card.endTurn) body.push(...card.endTurn.map(effect => effect.op === 'loseHp' ? ['回合結束時若在手中，失去 ', num(val(effect.v, up)), ' 生命'] : effectText(effect, up, ctx)));
  if (body.length) lines.push(joinSentences(body));
  if (card.chant) lines.push([kw('chant'), '：', ...joinSentences(card.chant.map(effect => effectText(effect, up, ctx)))]);
  if (card.type === 'power' && card.fx.some(effect => effect.op === 'buff')) lines.push(['（持續整場戰鬥）']);
  if (cardFades(card, up)) lines.push([kw('fade'), '。']);
  if (card.fleeting) lines.push([kw('fleeting'), '。']);
  return lines;
}

export function cardKeywords(inst) {
  const lines = describeCard(inst);
  const found = new Set();
  lines.flat().forEach(seg => { if (seg && typeof seg === 'object' && seg.kw) found.add(seg.kw); });
  return [...found];
}
