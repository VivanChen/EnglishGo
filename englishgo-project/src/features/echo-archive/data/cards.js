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
  mythic: { en: 'Mythic', zh: '神話' },
  special: { en: 'Special', zh: '特殊' },
};

// Play styles, used to group the codex and to give each run a direction.
export const ARCHETYPES = {
  blade: { en: 'Blade', zh: '斬擊流', text: '用力量與重擊直接壓制敵人。' },
  burn: { en: 'Burn', zh: '灼燒流', text: '疊加 Burn，再一口氣引爆。' },
  ward: { en: 'Guard', zh: '守護流', text: '堆高 Ward，把防禦轉成反擊。' },
  combo: { en: 'Combo', zh: '連擊流', text: '一回合打出很多張牌，越打越強。' },
  chant: { en: 'Chant', zh: '詠唱流', text: '讀對符文單字，讓牌永久成長。' },
  ink: { en: 'Ink', zh: '墨漬流', text: '把敵人塞來的廢牌變成燃料。' },
  familiar: { en: 'Familiar', zh: '墨靈流', text: '喚墨師專屬：餵養墨靈，讓它替你戰鬥。' },
  fold: { en: 'Fold', zh: '摺紙流', text: '摺出一疊 0 費的紙刃，一回合打出一大串。' },
  steam: { en: 'Steam', zh: '蒸汽流', text: '機巧師專屬：累積 Steam 讓牌變強，在過熱前一口氣洩壓。' },
  twilight: { en: 'Twilight', zh: '晝夜流', text: '暮光騎士專屬：白晝進攻、黑夜防守，抓準交替的時機。' },
  special: { en: 'Special', zh: '特殊', text: '狀態牌與詛咒。' },
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
  combo: { en: 'Combo', zh: '連擊', text: '本回合每打出過 1 張牌，效果就再增強一次。' },
  inscribe: { en: 'Inscribe', zh: '銘刻', text: '永久提升這張牌的數值，整趟遠征都有效。' },
  keep: { en: 'Keep', zh: '保留', text: '回合結束時不會被棄掉，會留在手中。' },
  charge: { en: 'Charge', zh: '蓄能', text: '下回合開始時，獲得等同層數的額外能量。' },
  conjure: { en: 'Conjure', zh: '召喚', text: '把一張隨機的牌加入手中，本回合費用為 0。' },
  statusCard: { en: 'Status', zh: '狀態牌', text: '敵人塞進你牌組的 Smudge、Dust，以及詛咒牌。' },
  familiar: { en: 'Familiar', zh: '墨靈', text: '喚墨師的墨靈夥伴。層數就是它的攻擊力：每回合結束時攻擊生命最低的敵人，之後層數 -1。整場戰鬥都會保留。' },
  paperBlade: { en: 'Paper Blade', zh: '紙刃', text: '摺出來的 0 費攻擊牌，造成 4 傷害。打出後消逝；回合結束時還在手中也會消逝。' },
  reflect: { en: 'Reflect', zh: '反射', text: '敵人這一輪攻擊你時，被 Ward 擋下的傷害會反彈給攻擊者。你的回合開始時消失。' },
  steam: { en: 'Steam', zh: '蒸汽', text: '機巧師的鍋爐壓力，整場戰鬥都會保留。很多牌會隨 Steam 變強。回合結束時若 Steam 達到 10，就會過熱：失去 6 生命並歸零。' },
  vent: { en: 'Vent', zh: '洩壓', text: '把 Steam 一口氣放光，歸零。' },
  overheat: { en: 'Overheat', zh: '過熱', text: '回合結束時 Steam 達到 10 以上：失去 6 生命（無視 Ward），Steam 歸零。' },
  day: { en: 'Day', zh: '白晝', text: '暮光騎士的第 1、3、5… 回合是白晝。標著 ☀ 的效果只在白晝生效。' },
  night: { en: 'Night', zh: '黑夜', text: '暮光騎士的第 2、4、6… 回合是黑夜。標著 ☾ 的效果只在黑夜生效。' },
  eclipse: { en: 'Eclipse', zh: '晝夜交替', text: '立刻把白晝換成黑夜，或把黑夜換成白晝。下回合開始時仍會照常交替。' },
};

export const POWER_TEXT = {
  stoneheart: { en: 'Stoneheart', zh: '石心', kw: 'ward', text: v => [`回合結束時獲得 `, num(v), ` `, kw('ward')] },
  wildfire: { en: 'Wildfire', zh: '野火', kw: 'burn', text: v => [`回合開始時，對所有敵人施加 `, num(v), ` 層 `, kw('burn')] },
  clarity: { en: 'Clarity', zh: '清明', text: v => [`每回合多抽 `, num(v), ` 張牌`] },
  resonance: { en: 'Resonance', zh: '共鳴', text: v => [`每打出一張技能牌，隨機對一名敵人造成 `, num(v), ` 傷害`] },
  scholar: { en: 'Scholar', zh: '學者', kw: 'chant', text: v => [kw('chant'), ` 強化成功時，獲得 `, num(v), ` 點能量`] },
  ascend: { en: 'Ascend', zh: '昇華', kw: 'might', text: v => [`回合開始時獲得 `, num(v), ` 層 `, kw('might')] },
  bastion: { en: 'Iron Will', zh: '鋼鐵意志', kw: 'ward', text: () => ['你的 ', kw('ward'), ' 不會在回合開始時消失'] },
  momentum: { en: 'Momentum', zh: '衝勁', kw: 'combo', text: v => [`每回合每打出第 `, num(v), ` 張牌，就抽 1 張牌`] },
  thousandCuts: { en: 'Thousand Cuts', zh: '千刃', text: v => [`每打出一張牌，對所有敵人造成 `, num(v), ` 傷害`] },
  archmage: { en: 'Archmage', zh: '大法師', kw: 'chant', text: () => ['你的 ', kw('chant'), ' 牌會打出兩次'] },
  livingInk: { en: 'Living Ink', zh: '活墨', kw: 'statusCard', text: () => [kw('statusCard'), ' 費用變成 0 且可以打出：打出時消逝並抽 1 張牌'] },
  library: { en: 'Grand Library', zh: '大圖書館', kw: 'conjure', text: v => ['回合開始時 ', kw('conjure'), ' ', num(v), ' 張隨機技能牌'] },
  bond: { en: 'Soul Bond', zh: '心靈連結', kw: 'familiar', text: v => [kw('familiar'), ' 每次攻擊後，獲得 ', num(v), ' ', kw('ward')] },
  emberSpirit: { en: 'Ember Spirit', zh: '燼靈', kw: 'familiar', text: v => [kw('familiar'), ' 攻擊時施加 ', num(v), ' 層 ', kw('burn')] },
  legion: { en: 'Legion', zh: '墨之軍團', kw: 'familiar', text: v => ['回合開始時，', kw('familiar'), ' +', num(v)] },
  twinStrike: { en: 'Twin Spirit', zh: '雙生靈', kw: 'familiar', text: () => [kw('familiar'), ' 每次會多攻擊 1 次'] },
  sovereign: { en: 'Ink Sovereign', zh: '墨之君主', kw: 'familiar', text: () => ['每打出 1 張攻擊牌，', kw('familiar'), ' +1。', kw('familiar'), ' 改為攻擊所有敵人'] },
  origami: { en: 'Origami', zh: '摺紙師', kw: 'paperBlade', text: v => ['回合開始時，把 ', num(v), ' 張 ', kw('paperBlade'), ' 加入手中'] },
  keenCrease: { en: 'Keen Crease', zh: '鋒摺', kw: 'paperBlade', text: v => [kw('paperBlade'), ' 的傷害 +', num(v)] },
  paperArmor: { en: 'Paper Armor', zh: '紙鎧', kw: 'paperBlade', text: v => ['每打出 1 張 ', kw('paperBlade'), '，獲得 ', num(v), ' ', kw('ward')] },
  afterimage: { en: 'Afterimage', zh: '殘影', kw: 'echo', text: v => ['回合開始時獲得 ', num(v), ' 次 ', kw('echo'), '：本回合第一張攻擊牌打出兩次'] },
  eternalFlame: { en: 'Eternal Flame', zh: '不滅之火', kw: 'burn', text: () => ['敵人身上的 ', kw('burn'), ' 不再每回合減少'] },
  wordsmith: { en: 'Wordsmith', zh: '詞匠', kw: 'chant', text: v => [kw('chant'), ' 強化成功時，獲得 ', num(v), ' ', kw('ward')] },
  swordSaint: { en: 'Sword Saint', zh: '劍聖', text: () => ['你的單體攻擊牌會同時打中所有敵人'] },
  hellfire: { en: 'Hellfire', zh: '業火', kw: 'burn', text: v => ['回合開始時，對所有敵人施加 ', num(v), ' 層 ', kw('burn'), '，然後所有敵人的 ', kw('burn'), ' 額外引燃一次（不會減少層數）'] },
  colossus: { en: 'Colossus', zh: '巨像', kw: 'ward', text: () => ['回合結束時，對所有敵人造成等同你 ', kw('ward'), ' 一半的傷害'] },
  perpetualMotion: { en: 'Perpetual Motion', zh: '永動機', kw: 'combo', text: v => ['每回合每打出第 ', num(v), ' 張牌，獲得 1 點能量並抽 1 張牌'] },
  eloquence: { en: 'Eloquence', zh: '雄辯', kw: 'chant', text: v => [kw('chant'), ' 強化成功時，對所有敵人造成 ', num(v), ' 傷害'] },
  runeChoir: { en: 'Rune Choir', zh: '符文合唱', kw: 'chant', text: v => ['回合開始時，把 ', num(v), ' 張隨機 ', kw('chant'), ' 牌加入手中，本回合 0 費'] },
  abyssalInk: { en: 'Abyssal Ink', zh: '深淵之墨', kw: 'statusCard', text: v => ['回合開始時，把 1 張 Smudge 加入手中。每有 1 張 ', kw('statusCard'), ' 消逝，對所有敵人造成 ', num(v), ' 傷害'] },
  origamiWorkshop: { en: 'Origami Workshop', zh: '摺紙工坊', kw: 'paperBlade', text: v => ['每打出 1 張不是 ', kw('paperBlade'), ' 的牌，把 ', num(v), ' 張 ', kw('paperBlade'), ' 加入手中'] },
  paperDragon: { en: 'Paper Dragon', zh: '紙龍', kw: 'paperBlade', text: v => [kw('paperBlade'), ' 改為攻擊所有敵人，且傷害 +', num(v)] },
  eternalSpirit: { en: 'Eternal Spirit', zh: '永恆之靈', kw: 'familiar', text: () => [kw('familiar'), ' 攻擊後不再減少層數'] },
  turbine: { en: 'Turbine', zh: '渦輪', kw: 'steam', text: v => ['回合開始時，', kw('steam'), ' +', num(v)] },
  heatSink: { en: 'Heat Sink', zh: '散熱片', kw: 'vent', text: v => ['每次 ', kw('steam'), ' 歸零（', kw('vent'), ' 或 ', kw('overheat'), '），獲得 ', num(v), ' ', kw('ward')] },
  exhaust: { en: 'Exhaust Engine', zh: '排氣引擎', kw: 'vent', text: v => ['每次 ', kw('steam'), ' 歸零（', kw('vent'), ' 或 ', kw('overheat'), '），抽 ', num(v), ' 張牌'] },
  safetyValve: { en: 'Safety Valve', zh: '安全閥', kw: 'overheat', text: v => [kw('overheat'), ' 不再傷害你，改為對所有敵人造成 ', num(v), ' 傷害'] },
  dayborn: { en: 'Dayborn', zh: '晝之子', kw: 'day', text: v => ['每次進入 ', kw('day'), '，獲得 ', num(v), ' 層 ', kw('might')] },
  nightwatch: { en: 'Nightwatch', zh: '夜巡', kw: 'night', text: v => ['每次進入 ', kw('night'), '，獲得 ', num(v), ' ', kw('ward')] },
  orbit: { en: 'Twin Orbit', zh: '雙星軌道', kw: 'eclipse', text: v => ['每次白晝與黑夜交替，對所有敵人造成 ', num(v), ' 傷害'] },
  eternalTwilight: { en: 'Eternal Twilight', zh: '永恆暮光', kw: 'eclipse', text: () => ['每次白晝與黑夜交替，獲得 1 點能量並抽 1 張牌'] },
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

  // ── Archive expansion: unlocked through the Archive Gacha (pack: true) ──
  // Burn
  fireball: { en: 'Fireball', zh: '火球', type: 'attack', rarity: 'common', cost: 2, target: 'enemy', glyph: 'fireball', arch: 'burn', pack: true, fx: [{ op: 'damage', v: [10, 13] }, { op: 'debuff', st: 'burn', v: [3, 4] }] },
  kindling: { en: 'Kindling', zh: '引火', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', glyph: 'flame', arch: 'burn', pack: true, fx: [{ op: 'damage', v: [2, 3] }, { op: 'debuff', st: 'burn', v: [2, 3] }] },
  emberShield: { en: 'Ember Shield', zh: '餘燼之盾', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'flameShield', arch: 'burn', pack: true, fx: [{ op: 'ward', v: [6, 9] }, { op: 'debuff', st: 'burn', v: [2, 3], all: true }] },
  detonate: { en: 'Detonate', zh: '引爆', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', glyph: 'burst', arch: 'burn', pack: true, fx: [{ op: 'detonate', v: [2, 3] }] },
  spread: { en: 'Spread', zh: '燎原', type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'enemy', glyph: 'wildfire', arch: 'burn', pack: true, fx: [{ op: 'spreadBurn' }] },
  sunfall: { en: 'Sunfall', zh: '落日', type: 'attack', rarity: 'mythic', cost: 3, target: 'all', glyph: 'sun', arch: 'burn', pack: true, fx: [{ op: 'debuff', st: 'burn', v: [8, 12], all: true }, { op: 'burnTickAll' }], fade: true },
  // Guard
  brace: { en: 'Brace', zh: '架勢', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'barrier', arch: 'ward', pack: true, keep: true, fx: [{ op: 'ward', v: [7, 10] }] },
  thornMail: { en: 'Thorn Mail', zh: '荊棘甲', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'thorn', arch: 'ward', pack: true, fx: [{ op: 'ward', v: [5, 7] }, { op: 'buff', st: 'spikes', v: [2, 3] }] },
  shieldBash: { en: 'Shield Bash', zh: '盾擊', type: 'attack', rarity: 'uncommon', cost: [2, 1], target: 'all', glyph: 'shieldBash', arch: 'ward', pack: true, fx: [{ op: 'damageWard', all: true }] },
  counterstrike: { en: 'Counterstrike', zh: '以守為攻', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'parry', arch: 'ward', pack: true, fx: [{ op: 'ward', v: [8, 11] }, { op: 'buff', st: 'charge', v: 1 }] },
  ironWill: { en: 'Iron Will', zh: '鋼鐵意志', type: 'power', rarity: 'rare', cost: [3, 2], target: 'self', glyph: 'helm', arch: 'ward', pack: true, fx: [{ op: 'power', id: 'bastion', v: 1, set: true }] },
  aegis: { en: 'Aegis', zh: '神盾', type: 'skill', rarity: 'mythic', cost: 2, target: 'self', glyph: 'aegis', arch: 'ward', pack: true, fx: [{ op: 'ward', v: [20, 26] }, { op: 'buff', st: 'grace', v: [3, 4] }], fade: true },
  // Combo
  jab: { en: 'Jab', zh: '快拳', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', glyph: 'fist', arch: 'combo', pack: true, fx: [{ op: 'damage', v: [3, 4], perCombo: [2, 3] }] },
  chargeUp: { en: 'Charge Up', zh: '蓄力', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'surge', arch: 'combo', pack: true, fx: [{ op: 'buff', st: 'charge', v: [2, 3] }, { op: 'draw', v: 1 }] },
  flurry: { en: 'Page Flurry', zh: '書頁亂舞', type: 'attack', rarity: 'uncommon', cost: 1, target: 'all', glyph: 'pages', arch: 'combo', pack: true, fx: [{ op: 'damage', v: [3, 4], random: true, comboHits: true }] },
  momentum: { en: 'Momentum', zh: '衝勁', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'dash', arch: 'combo', pack: true, fx: [{ op: 'power', id: 'momentum', v: [4, 3], set: true }] },
  mirrorImage: { en: 'Mirror Image', zh: '鏡像', type: 'skill', rarity: 'rare', cost: [1, 0], target: 'self', glyph: 'shard', arch: 'combo', pack: true, fx: [{ op: 'copyLast' }], fade: true },
  thousandCuts: { en: 'Thousand Cuts', zh: '千刃', type: 'power', rarity: 'mythic', cost: 2, target: 'self', glyph: 'cuts', arch: 'combo', pack: true, fx: [{ op: 'power', id: 'thousandCuts', v: [1, 2] }] },
  // Chant
  runeBlade: { en: 'Rune Blade', zh: '符文刃', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'rune', arch: 'chant', pack: true, fx: [{ op: 'damage', v: [6, 8] }], chant: [{ op: 'inscribe', v: [2, 3] }] },
  lexiconShield: { en: 'Lexicon Shield', zh: '詞彙之盾', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'runeShield', arch: 'chant', pack: true, fx: [{ op: 'ward', v: [6, 8] }], chant: [{ op: 'inscribe', v: [2, 3] }] },
  wordOfPower: { en: 'Word of Power', zh: '真言', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self', glyph: 'spark2', arch: 'chant', pack: true, fx: [{ op: 'energy', v: 1 }], chant: [{ op: 'draw', v: [1, 2] }], fade: true },
  runeStorm: { en: 'Rune Storm', zh: '符文風暴', type: 'attack', rarity: 'rare', cost: 2, target: 'all', glyph: 'storm', arch: 'chant', pack: true, fx: [{ op: 'damage', v: [5, 7], all: true, perChant: [3, 4] }] },
  archmage: { en: 'Archmage', zh: '大法師', type: 'power', rarity: 'mythic', cost: [3, 2], target: 'self', glyph: 'hat', arch: 'chant', pack: true, fx: [{ op: 'power', id: 'archmage', v: 1, set: true }] },
  // Ink
  absorb: { en: 'Absorb', zh: '吸墨', type: 'skill', rarity: 'common', cost: 0, target: 'self', glyph: 'siphon', arch: 'ink', pack: true, fx: [{ op: 'absorb', draw: [0, 1] }] },
  blotWard: { en: 'Blot Ward', zh: '墨盾', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'inkwell', arch: 'ink', pack: true, fx: [{ op: 'wardPerStatus', v: [4, 5], per: [3, 4] }] },
  inkBlot: { en: 'Ink Blot', zh: '墨爆', type: 'attack', rarity: 'uncommon', cost: 1, target: 'all', glyph: 'blot', arch: 'ink', pack: true, fx: [{ op: 'damage', v: [6, 8], all: true }, { op: 'addStatus', id: 'smudge', v: 1 }] },
  quillDance: { en: 'Quill Dance', zh: '筆舞', type: 'attack', rarity: 'rare', cost: 1, target: 'enemy', glyph: 'quill', arch: 'ink', pack: true, fx: [{ op: 'damage', v: [4, 6] }, { op: 'conjure', kind: 'attack', v: 1 }] },
  livingInk: { en: 'Living Ink', zh: '活墨', type: 'power', rarity: 'mythic', cost: [1, 0], target: 'self', glyph: 'livingInk', arch: 'ink', pack: true, fx: [{ op: 'power', id: 'livingInk', v: 1, set: true }] },

  // ── Wave 2: choices and new tricks (base collection) ──
  recall: { en: 'Recall', zh: '回想', type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'self', glyph: 'recall', arch: 'combo', fx: [{ op: 'choose', from: 'discard', action: 'toHand' }] },
  sift: { en: 'Sift', zh: '篩選', type: 'skill', rarity: 'common', cost: 0, target: 'self', glyph: 'sift', arch: 'combo', fx: [{ op: 'draw', v: [2, 3] }, { op: 'choose', from: 'hand', action: 'discard' }] },
  foresee: { en: 'Foresee', zh: '預見', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'crystal', arch: 'combo', fx: [{ op: 'choose', from: 'top', n: [3, 5], action: 'toHand' }, { op: 'ward', v: [3, 5] }] },
  whetblade: { en: 'Whetblade', zh: '淬鍊', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'whetblade', arch: 'blade', fx: [{ op: 'upgradeHand', all: [false, true] }, { op: 'ward', v: 4 }] },
  leech: { en: 'Leech', zh: '吸取', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'leech', arch: 'blade', fx: [{ op: 'damage', v: [7, 9] }, { op: 'heal', v: [2, 3] }] },
  thunderclap: { en: 'Thunderclap', zh: '雷擊', type: 'attack', rarity: 'common', cost: 1, target: 'all', glyph: 'thunderclap', arch: 'blade', fx: [{ op: 'damage', v: [4, 6], all: true }, { op: 'debuff', st: 'weak', v: 1, all: true }] },
  patience: { en: 'Patience', zh: '沉著', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'patience', arch: 'ward', keep: true, fx: [{ op: 'ward', v: [6, 8], perKept: [3, 4] }] },
  wordflood: { en: 'Word Flood', zh: '文思泉湧', type: 'skill', rarity: 'rare', cost: 'X', target: 'self', glyph: 'wordflood', arch: 'combo', fx: [{ op: 'drawX', v: [1, 2] }] },
  // ── Wave 2: Archive Gacha ──
  offering: { en: 'Offering', zh: '獻祭', type: 'skill', rarity: 'common', cost: 0, target: 'self', glyph: 'offering', arch: 'ink', pack: true, fx: [{ op: 'choose', from: 'hand', action: 'fade', energy: [2, 3] }] },
  paperCut: { en: 'Paper Cut', zh: '紙割', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', glyph: 'paperCut', arch: 'combo', pack: true, fx: [{ op: 'damage', v: [2, 3], hits: 2, perCombo: 1 }] },
  emberRain: { en: 'Ember Rain', zh: '餘燼雨', type: 'attack', rarity: 'uncommon', cost: 1, target: 'all', glyph: 'emberRain', arch: 'burn', pack: true, fx: [{ op: 'damage', v: 3, hits: [4, 5], random: true, burnPerHit: 1 }] },
  bookwall: { en: 'Book Wall', zh: '書牆', type: 'skill', rarity: 'uncommon', cost: 2, target: 'self', glyph: 'bookwall', arch: 'ward', pack: true, fx: [{ op: 'wardPerHand', v: [3, 4] }] },
  palimpsest: { en: 'Palimpsest', zh: '重寫', type: 'skill', rarity: 'rare', cost: 1, target: 'self', glyph: 'palimpsest', arch: 'chant', pack: true, fx: [{ op: 'choose', from: 'hand', action: 'inscribe', v: [3, 4] }], fade: true },
  grandLibrary: { en: 'Grand Library', zh: '大圖書館', type: 'power', rarity: 'mythic', cost: [2, 1], target: 'self', glyph: 'library', arch: 'ink', pack: true, fx: [{ op: 'power', id: 'library', v: 1 }] },

  // ── The Inkcaller (second hero): Familiar and Burn ──
  inkBolt: { en: 'Ink Bolt', zh: '墨彈', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', glyph: 'inkDrop', hero: 'caller', arch: 'familiar', fx: [{ op: 'damage', v: [6, 9] }] },
  inkVeil: { en: 'Ink Veil', zh: '墨幕', type: 'skill', rarity: 'starter', cost: 1, target: 'self', glyph: 'veil', hero: 'caller', arch: 'familiar', fx: [{ op: 'ward', v: [5, 8] }] },
  summonSpirit: { en: 'Summon', zh: '喚靈', type: 'skill', rarity: 'starter', cost: 1, target: 'self', glyph: 'spirit', hero: 'caller', arch: 'familiar', fx: [{ op: 'feed', v: [3, 5] }], chant: [{ op: 'feed', v: [2, 3] }] },
  cinderLash: { en: 'Cinder Lash', zh: '燼鞭', type: 'attack', rarity: 'starter', cost: 2, target: 'enemy', glyph: 'spiritFlame', hero: 'caller', arch: 'burn', fx: [{ op: 'damage', v: [7, 9] }, { op: 'debuff', st: 'burn', v: [4, 6] }] },
  spiritClaw: { en: 'Spirit Claw', zh: '靈爪', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'spiritClaw', hero: 'caller', arch: 'familiar', fx: [{ op: 'damage', v: [5, 7] }, { op: 'feed', v: [1, 2] }] },
  inkSpray: { en: 'Ink Spray', zh: '墨霧', type: 'attack', rarity: 'common', cost: 1, target: 'all', glyph: 'inkSpray', hero: 'caller', arch: 'familiar', fx: [{ op: 'damage', v: [4, 6], all: true }, { op: 'feed', v: 1 }] },
  command: { en: 'Command', zh: '號令', type: 'skill', rarity: 'common', cost: [1, 0], target: 'self', glyph: 'command', hero: 'caller', arch: 'familiar', fx: [{ op: 'unleash', v: 1 }] },
  nourish: { en: 'Nourish', zh: '滋養', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'jar', hero: 'caller', arch: 'familiar', fx: [{ op: 'feed', v: [4, 6] }] },
  shadowGuard: { en: 'Shadow Guard', zh: '影衛', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'veil', hero: 'caller', arch: 'familiar', fx: [{ op: 'wardFamiliar', v: [3, 6] }] },
  smolder: { en: 'Smolder', zh: '悶燒', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'flame', hero: 'caller', arch: 'burn', fx: [{ op: 'damage', v: [3, 4] }, { op: 'debuff', st: 'burn', v: [3, 4] }, { op: 'ifFamiliar', n: 5, then: [{ op: 'debuff', st: 'burn', v: 3 }] }] },
  quickInk: { en: 'Quick Ink', zh: '速寫', type: 'skill', rarity: 'common', cost: 0, target: 'self', glyph: 'inkDrop', hero: 'caller', arch: 'familiar', fx: [{ op: 'draw', v: [1, 2] }, { op: 'feed', v: 1 }] },
  inkLance: { en: 'Ink Lance', zh: '墨槍', type: 'attack', rarity: 'common', cost: 2, target: 'enemy', glyph: 'pierce', hero: 'caller', arch: 'familiar', fx: [{ op: 'damage', v: [9, 12], perFamiliar: 1 }] },
  devourInk: { en: 'Feast', zh: '墨宴', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', glyph: 'maw', hero: 'caller', arch: 'familiar', fx: [{ op: 'spend', half: true, v: [2, 3] }] },
  spiritBarrier: { en: 'Spirit Barrier', zh: '靈障', type: 'skill', rarity: 'uncommon', cost: 2, target: 'self', glyph: 'barrier', hero: 'caller', arch: 'familiar', fx: [{ op: 'ward', v: [10, 14] }, { op: 'feed', v: 2 }] },
  kindredFlame: { en: 'Kindred Flame', zh: '同源之火', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'spiritFlame', hero: 'caller', arch: 'burn', fx: [{ op: 'burnFromFamiliar', v: [0.5, 1] }] },
  swarm: { en: 'Swarm', zh: '群墨', type: 'attack', rarity: 'uncommon', cost: 1, target: 'all', glyph: 'swarm', hero: 'caller', arch: 'familiar', fx: [{ op: 'damage', v: [3, 4], random: true, hitsPerFamiliar: 3 }] },
  bond: { en: 'Soul Bond', zh: '心靈連結', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'bond', hero: 'caller', arch: 'familiar', fx: [{ op: 'power', id: 'bond', v: [3, 4] }] },
  emberSpirit: { en: 'Ember Spirit', zh: '燼靈', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'spiritFlame', hero: 'caller', arch: 'burn', fx: [{ op: 'power', id: 'emberSpirit', v: [2, 3] }] },
  pact: { en: 'Blood Pact', zh: '血契', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self', glyph: 'drop', hero: 'caller', arch: 'familiar', fx: [{ op: 'loseHp', v: 3 }, { op: 'feed', v: [5, 7] }] },
  doubleCast: { en: 'Twin Command', zh: '雙重號令', type: 'skill', rarity: 'uncommon', cost: [2, 1], target: 'self', glyph: 'command', hero: 'caller', arch: 'familiar', fx: [{ op: 'unleash', v: 2 }] },
  legion: { en: 'Legion', zh: '墨之軍團', type: 'power', rarity: 'rare', cost: 2, target: 'self', glyph: 'legion', hero: 'caller', arch: 'familiar', fx: [{ op: 'power', id: 'legion', v: [2, 3] }] },
  unboundSpirit: { en: 'Unbound', zh: '解放之靈', type: 'skill', rarity: 'rare', cost: 1, target: 'self', glyph: 'spirit', hero: 'caller', arch: 'familiar', fx: [{ op: 'doubleFamiliar' }], fade: [true, false] },
  inkStorm: { en: 'Ink Storm', zh: '墨暴', type: 'attack', rarity: 'rare', cost: 'X', target: 'self', glyph: 'swarm', hero: 'caller', arch: 'familiar', fx: [{ op: 'unleash', x: true, plus: [0, 1] }] },
  lastLight: { en: 'Last Light', zh: '殘光', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', glyph: 'sun', hero: 'caller', arch: 'familiar', fx: [{ op: 'spend', v: [3, 4] }], fade: true },
  twinSpirit: { en: 'Twin Spirit', zh: '雙生靈', type: 'power', rarity: 'rare', cost: [3, 2], target: 'self', glyph: 'bond', hero: 'caller', arch: 'familiar', fx: [{ op: 'power', id: 'twinStrike', v: 1 }] },
  inkSovereign: { en: 'Ink Sovereign', zh: '墨之君主', type: 'power', rarity: 'mythic', cost: [3, 2], target: 'self', glyph: 'sovereign', hero: 'caller', arch: 'familiar', fx: [{ op: 'power', id: 'sovereign', v: 1 }] },
  spiritHowl: { en: 'Spirit Howl', zh: '靈嚎', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'howl', hero: 'caller', arch: 'familiar', fx: [{ op: 'debuff', st: 'weak', v: [1, 2], all: true }, { op: 'feed', v: 2 }] },
  pounce: { en: 'Pounce', zh: '撲擊', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', glyph: 'pounce', hero: 'caller', arch: 'familiar', fx: [{ op: 'damage', v: [5, 7] }, { op: 'unleash', v: 1 }] },

  // ── Wave 4: Fold, a paper-token archetype both heroes can build ──
  // Paper Blades only ever exist inside one combat (made by these cards).
  paperBlade: { en: 'Paper Blade', zh: '紙刃', type: 'attack', rarity: 'special', cost: 0, target: 'enemy', glyph: 'paperBlade', arch: 'fold', token: true, fx: [{ op: 'damage', v: [4, 6] }], fade: true, fleeting: true },
  fold: { en: 'Fold', zh: '摺紙', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'fold', arch: 'fold', fx: [{ op: 'fold', v: [2, 3] }] },
  crease: { en: 'Crease', zh: '摺痕', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'crease', arch: 'fold', fx: [{ op: 'damage', v: [6, 9] }, { op: 'fold', v: 1 }] },
  paperFan: { en: 'Paper Fan', zh: '紙扇', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'paperFan', arch: 'fold', fx: [{ op: 'ward', v: [5, 8] }, { op: 'fold', v: 1 }] },
  confetti: { en: 'Confetti', zh: '紙吹雪', type: 'attack', rarity: 'uncommon', cost: 1, target: 'all', glyph: 'confetti', arch: 'fold', fx: [{ op: 'damage', v: 3, all: true }, { op: 'burstHand', kind: 'paper', v: [4, 6] }] },
  origami: { en: 'Origami', zh: '摺紙師', type: 'power', rarity: 'uncommon', cost: [1, 0], target: 'self', glyph: 'origami', arch: 'fold', fx: [{ op: 'power', id: 'origami', v: 1 }] },
  keenCrease: { en: 'Keen Crease', zh: '鋒摺', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'keenCrease', arch: 'fold', fx: [{ op: 'power', id: 'keenCrease', v: [2, 3] }] },
  paperArmor: { en: 'Paper Armor', zh: '紙鎧', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'paperArmor', arch: 'fold', fx: [{ op: 'power', id: 'paperArmor', v: [2, 3] }] },
  finalFold: { en: 'Final Fold', zh: '終摺', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', glyph: 'finalFold', arch: 'fold', fx: [{ op: 'damage', v: [6, 8], perBlade: [3, 4] }], fade: true },
  paperPlane: { en: 'Paper Plane', zh: '紙飛機', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', glyph: 'paperPlane', arch: 'fold', pack: true, fx: [{ op: 'damage', v: [2, 3] }, { op: 'fold', v: 1 }] },
  thousandCranes: { en: 'Thousand Cranes', zh: '千紙鶴', type: 'skill', rarity: 'mythic', cost: [2, 1], target: 'self', glyph: 'thousandCranes', arch: 'fold', pack: true, fx: [{ op: 'fold', fill: true, upBlades: true }], fade: true },

  // ── Wave 4: new tricks for the older play styles ──
  honedEdge: { en: 'Honed Edge', zh: '磨刃', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'honedEdge', arch: 'blade', fx: [{ op: 'damage', v: [6, 8], grow: [3, 4] }] },
  execute: { en: 'Execute', zh: '處決', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', glyph: 'execute', arch: 'blade', fx: [{ op: 'damage', v: [10, 14], wounded: true }] },
  afterimage: { en: 'Afterimage', zh: '殘影', type: 'power', rarity: 'mythic', cost: [2, 1], target: 'self', glyph: 'afterimage', arch: 'blade', pack: true, fx: [{ op: 'power', id: 'afterimage', v: 1 }] },
  scorch: { en: 'Scorch', zh: '灼痕', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'scorch', arch: 'burn', fx: [{ op: 'damage', v: [5, 7], perBurn: 1 }] },
  brand: { en: 'Brand', zh: '烙印', type: 'skill', rarity: 'common', cost: 1, target: 'enemy', glyph: 'brand', arch: 'burn', fx: [{ op: 'debuff', st: 'burn', v: [4, 6] }, { op: 'debuff', st: 'exposed', v: 1 }] },
  eternalFlame: { en: 'Eternal Flame', zh: '不滅之火', type: 'power', rarity: 'rare', cost: [2, 1], target: 'self', glyph: 'eternalFlame', arch: 'burn', fx: [{ op: 'power', id: 'eternalFlame', v: 1, set: true }] },
  verse: { en: 'Verse', zh: '詩節', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'verse', arch: 'chant', fx: [{ op: 'damage', v: [4, 5], hits: 2 }], chant: [{ op: 'damage', v: [4, 5] }] },
  spellbook: { en: 'Spellbook', zh: '咒文書', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'spellbook', arch: 'chant', fx: [{ op: 'draw', v: [2, 3] }], chant: [{ op: 'energy', v: 1 }] },
  wordsmith: { en: 'Wordsmith', zh: '詞匠', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'wordsmith', arch: 'chant', fx: [{ op: 'power', id: 'wordsmith', v: [5, 7] }] },
  epic: { en: 'Epic', zh: '史詩', type: 'attack', rarity: 'rare', cost: 3, target: 'all', glyph: 'epic', arch: 'chant', fx: [{ op: 'damage', v: [13, 17], all: true }], chant: [{ op: 'damage', v: [7, 9], all: true }] },
  smear: { en: 'Smear', zh: '抹墨', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'smear', arch: 'ink', fx: [{ op: 'damage', v: [6, 8], perStatus: [2, 3] }] },
  scrub: { en: 'Scrub', zh: '擦拭', type: 'skill', rarity: 'common', cost: [1, 0], target: 'self', glyph: 'scrub', arch: 'ink', fx: [{ op: 'draw', v: 2 }, { op: 'choose', from: 'hand', action: 'fade' }] },
  inkTide: { en: 'Ink Tide', zh: '墨潮', type: 'attack', rarity: 'uncommon', cost: 1, target: 'all', glyph: 'inkTide', arch: 'ink', fx: [{ op: 'damage', v: [5, 7], all: true }, { op: 'burstHand', kind: 'junk', v: [5, 7] }] },

  // ── Wave 5: a Rare payoff and a Mythic centrepiece for every play style ──
  mountainCleaver: { en: 'Mountain Cleaver', zh: '開山斬', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', glyph: 'mountainCleaver', arch: 'blade', fx: [{ op: 'damage', v: [18, 22], mightMult: [3, 4] }] },
  swordSaint: { en: 'Sword Saint', zh: '劍聖', type: 'power', rarity: 'mythic', cost: 2, target: 'self', glyph: 'swordSaint', arch: 'blade', fx: [{ op: 'power', id: 'swordSaint', v: 1, set: true }, { op: 'buff', st: 'might', v: [2, 3] }] },
  flashpoint: { en: 'Flashpoint', zh: '燃點', type: 'skill', rarity: 'rare', cost: [1, 0], target: 'self', glyph: 'flashpoint', arch: 'burn', fx: [{ op: 'debuff', st: 'burn', v: [3, 4], all: true }, { op: 'doubleBurn', all: true }], fade: true },
  hellfire: { en: 'Hellfire', zh: '業火', type: 'power', rarity: 'mythic', cost: [3, 2], target: 'self', glyph: 'hellfire', arch: 'burn', fx: [{ op: 'power', id: 'hellfire', v: [2, 3] }] },
  mirrorWall: { en: 'Mirror Wall', zh: '鏡牆', type: 'skill', rarity: 'rare', cost: 2, target: 'self', glyph: 'mirrorWall', arch: 'ward', fx: [{ op: 'ward', v: [13, 17] }, { op: 'reflect' }] },
  colossus: { en: 'Colossus', zh: '巨像', type: 'power', rarity: 'mythic', cost: [3, 2], target: 'self', glyph: 'colossus', arch: 'ward', fx: [{ op: 'ward', v: [10, 14] }, { op: 'power', id: 'colossus', v: 1, set: true }] },
  finisher: { en: 'Finisher', zh: '終結技', type: 'attack', rarity: 'rare', cost: 1, target: 'enemy', glyph: 'finisher', arch: 'combo', fx: [{ op: 'damage', v: [5, 7], comboHits: true }] },
  perpetualMotion: { en: 'Perpetual Motion', zh: '永動機', type: 'power', rarity: 'mythic', cost: 2, target: 'self', glyph: 'perpetualMotion', arch: 'combo', fx: [{ op: 'power', id: 'perpetualMotion', v: [4, 3], set: true }] },
  eloquence: { en: 'Eloquence', zh: '雄辯', type: 'power', rarity: 'rare', cost: 1, target: 'self', glyph: 'eloquence', arch: 'chant', fx: [{ op: 'power', id: 'eloquence', v: [6, 8] }] },
  runeChoir: { en: 'Rune Choir', zh: '符文合唱', type: 'power', rarity: 'mythic', cost: [3, 2], target: 'self', glyph: 'runeChoir', arch: 'chant', fx: [{ op: 'power', id: 'runeChoir', v: 2 }] },
  blackout: { en: 'Blackout', zh: '墨染', type: 'attack', rarity: 'rare', cost: 2, target: 'all', glyph: 'blackout', arch: 'ink', fx: [{ op: 'damage', v: [4, 5], hits: 2, all: true, hitsPerStatus: true }, { op: 'addStatus', id: 'smudge', v: 1 }] },
  abyssalInk: { en: 'Abyssal Ink', zh: '深淵之墨', type: 'power', rarity: 'mythic', cost: [3, 2], target: 'self', glyph: 'abyssalInk', arch: 'ink', fx: [{ op: 'power', id: 'abyssalInk', v: 5 }] },
  origamiWorkshop: { en: 'Origami Workshop', zh: '摺紙工坊', type: 'power', rarity: 'rare', cost: [2, 1], target: 'self', glyph: 'origamiWorkshop', arch: 'fold', fx: [{ op: 'power', id: 'origamiWorkshop', v: 1 }] },
  paperDragon: { en: 'Paper Dragon', zh: '紙龍', type: 'power', rarity: 'mythic', cost: [3, 2], target: 'self', glyph: 'paperDragon', arch: 'fold', fx: [{ op: 'power', id: 'paperDragon', v: 2 }, { op: 'fold', v: [3, 4] }] },
  spiritSurge: { en: 'Spirit Surge', zh: '靈潮', type: 'skill', rarity: 'rare', cost: 2, target: 'self', glyph: 'spiritSurge', hero: 'caller', arch: 'familiar', fx: [{ op: 'feed', v: [6, 8] }, { op: 'unleash', v: 2 }] },
  eternalSpirit: { en: 'Eternal Spirit', zh: '永恆之靈', type: 'power', rarity: 'mythic', cost: [2, 1], target: 'self', glyph: 'eternalSpirit', hero: 'caller', arch: 'familiar', fx: [{ op: 'feed', v: [5, 7] }, { op: 'power', id: 'eternalSpirit', v: 1, set: true }] },

  // ── The Tinker (third hero): Steam ──
  // Steam builds up as cards are played and makes `perSteam` cards hit harder;
  // `vent` cards cash it in. At 10 or more at the end of a turn it overheats.
  wrench: { en: 'Wrench', zh: '扳手', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', glyph: 'wrench', hero: 'tinker', arch: 'steam', fx: [{ op: 'damage', v: [6, 9] }, { op: 'steam', v: 1 }] },
  plating: { en: 'Plating', zh: '鐵板', type: 'skill', rarity: 'starter', cost: 1, target: 'self', glyph: 'helm', hero: 'tinker', arch: 'steam', fx: [{ op: 'ward', v: [5, 8] }, { op: 'steam', v: 1 }] },
  stoke: { en: 'Stoke', zh: '加煤', type: 'skill', rarity: 'starter', cost: 1, target: 'self', glyph: 'kindle', hero: 'tinker', arch: 'steam', fx: [{ op: 'steam', v: [3, 4] }, { op: 'draw', v: 1 }], chant: [{ op: 'draw', v: 1 }] },
  steamBlast: { en: 'Steam Blast', zh: '蒸汽噴射', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', glyph: 'steam', hero: 'tinker', arch: 'steam', fx: [{ op: 'damage', v: [4, 6], perSteam: [2, 3] }, { op: 'vent' }] },
  pistonPunch: { en: 'Piston Punch', zh: '活塞拳', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'fist', hero: 'tinker', arch: 'steam', fx: [{ op: 'damage', v: [4, 6], perSteam: 1 }] },
  rivetGun: { en: 'Rivet Gun', zh: '鉚釘槍', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'pierce', hero: 'tinker', arch: 'steam', fx: [{ op: 'damage', v: [3, 4], hits: 2 }, { op: 'steam', v: 2 }] },
  spannerSpin: { en: 'Spanner Spin', zh: '扳手迴旋', type: 'attack', rarity: 'common', cost: 1, target: 'all', glyph: 'whirl', hero: 'tinker', arch: 'steam', fx: [{ op: 'damage', v: [5, 7], all: true }, { op: 'steam', v: 1 }] },
  coolant: { en: 'Coolant', zh: '冷卻液', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'drop', hero: 'tinker', arch: 'steam', fx: [{ op: 'ward', v: [7, 10] }, { op: 'steam', v: -3 }] },
  boilerPlate: { en: 'Boiler Plate', zh: '鍋爐裝甲', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'helm', hero: 'tinker', arch: 'steam', fx: [{ op: 'ward', v: [4, 6], perSteam: 1 }] },
  tuneUp: { en: 'Tune-Up', zh: '調校', type: 'skill', rarity: 'common', cost: 0, target: 'self', glyph: 'gear', hero: 'tinker', arch: 'steam', fx: [{ op: 'draw', v: [1, 2] }, { op: 'steam', v: 2 }] },
  steamHammer: { en: 'Steam Hammer', zh: '蒸汽錘', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', glyph: 'shatter', hero: 'tinker', arch: 'steam', fx: [{ op: 'damage', v: [12, 16], perSteam: 1 }, { op: 'steam', v: 2 }] },
  ventStorm: { en: 'Vent Storm', zh: '噴氣風暴', type: 'attack', rarity: 'uncommon', cost: 1, target: 'all', glyph: 'steam', hero: 'tinker', arch: 'steam', fx: [{ op: 'damage', v: [2, 4], perSteam: 1, all: true }, { op: 'vent' }] },
  turbine: { en: 'Turbine', zh: '渦輪', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'perpetualMotion', hero: 'tinker', arch: 'steam', fx: [{ op: 'power', id: 'turbine', v: [2, 3] }] },
  heatSink: { en: 'Heat Sink', zh: '散熱片', type: 'power', rarity: 'uncommon', cost: [1, 0], target: 'self', glyph: 'stone', hero: 'tinker', arch: 'steam', fx: [{ op: 'power', id: 'heatSink', v: [7, 9] }] },
  gaugeCheck: { en: 'Gauge Check', zh: '看壓力錶', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self', glyph: 'gauge', hero: 'tinker', arch: 'steam', fx: [{ op: 'draw', v: [1, 2] }, { op: 'ifSteam', n: 6, then: [{ op: 'energy', v: 1 }] }] },
  overclock: { en: 'Overclock', zh: '超頻', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self', glyph: 'surge', hero: 'tinker', arch: 'steam', fx: [{ op: 'energy', v: [1, 2] }, { op: 'steam', v: 4 }] },
  overdrive: { en: 'Overdrive', zh: '極限運轉', type: 'skill', rarity: 'rare', cost: [1, 0], target: 'self', glyph: 'gauge', hero: 'tinker', arch: 'steam', fx: [{ op: 'doubleSteam' }, { op: 'draw', v: 1 }] },
  boilerBurst: { en: 'Boiler Burst', zh: '鍋爐爆裂', type: 'attack', rarity: 'rare', cost: 3, target: 'all', glyph: 'burst', hero: 'tinker', arch: 'steam', fx: [{ op: 'damage', v: [12, 16], perSteam: [3, 4], all: true }, { op: 'vent' }], fade: true },
  exhaustEngine: { en: 'Exhaust Engine', zh: '排氣引擎', type: 'power', rarity: 'rare', cost: [2, 1], target: 'self', glyph: 'steam', hero: 'tinker', arch: 'steam', fx: [{ op: 'power', id: 'exhaust', v: 2 }] },
  safetyValve: { en: 'Safety Valve', zh: '安全閥', type: 'power', rarity: 'mythic', cost: [2, 1], target: 'self', glyph: 'valve', hero: 'tinker', arch: 'steam', fx: [{ op: 'power', id: 'safetyValve', v: 15, set: true }, { op: 'steam', v: 3 }] },

  // ── The Twilight Knight (fourth hero): Day and Night ──
  // Turns alternate Day (odd rounds) and Night (even rounds). `day`/`night` on
  // an effect add to its number; `onDay`/`onNight` on a card add effects.
  sunblade: { en: 'Sunblade', zh: '日刃', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', glyph: 'sunblade', hero: 'knight', arch: 'twilight', fx: [{ op: 'damage', v: [5, 7], day: [3, 4] }] },
  moonguard: { en: 'Moonguard', zh: '月盾', type: 'skill', rarity: 'starter', cost: 1, target: 'self', glyph: 'moonshield', hero: 'knight', arch: 'twilight', fx: [{ op: 'ward', v: [4, 6], night: [3, 4] }] },
  duskStrike: { en: 'Dusk Strike', zh: '暮光斬', type: 'attack', rarity: 'starter', cost: 2, target: 'enemy', glyph: 'sunblade', hero: 'knight', arch: 'twilight', fx: [{ op: 'damage', v: [9, 12] }], onDay: [{ op: 'debuff', st: 'exposed', v: 2 }], onNight: [{ op: 'ward', v: [6, 8] }], chant: [{ op: 'damage', v: [5, 7] }] },
  eclipse: { en: 'Eclipse', zh: '日月交替', type: 'skill', rarity: 'starter', cost: [1, 0], target: 'self', glyph: 'eclipse', hero: 'knight', arch: 'twilight', fx: [{ op: 'eclipse' }, { op: 'draw', v: 1 }] },
  solarFlare: { en: 'Solar Flare', zh: '日焰', type: 'attack', rarity: 'common', cost: 1, target: 'all', glyph: 'sun', hero: 'knight', arch: 'twilight', fx: [{ op: 'damage', v: [5, 7], all: true, day: 3 }] },
  moonbeam: { en: 'Moonbeam', zh: '月光', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'moon', hero: 'knight', arch: 'twilight', fx: [{ op: 'damage', v: [7, 10] }], onNight: [{ op: 'draw', v: 1 }] },
  dawnStrike: { en: 'Dawn Strike', zh: '晨擊', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', glyph: 'spark', hero: 'knight', arch: 'twilight', fx: [{ op: 'damage', v: [4, 6], day: [3, 4] }] },
  starlitVeil: { en: 'Starlit Veil', zh: '星紗', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'veil', hero: 'knight', arch: 'twilight', fx: [{ op: 'ward', v: [6, 9] }], onNight: [{ op: 'debuff', st: 'weak', v: 1, all: true }] },
  twilightStep: { en: 'Twilight Step', zh: '暮步', type: 'skill', rarity: 'common', cost: 1, target: 'self', glyph: 'dash', hero: 'knight', arch: 'twilight', fx: [{ op: 'ward', v: [5, 8] }, { op: 'eclipse' }] },
  crescentCut: { en: 'Crescent Cut', zh: '新月斬', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', glyph: 'arc', hero: 'knight', arch: 'twilight', fx: [{ op: 'damage', v: [4, 5], hits: 2 }], onNight: [{ op: 'damage', v: [4, 5] }] },
  zenith: { en: 'Zenith', zh: '天頂斬', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', glyph: 'sunblade', hero: 'knight', arch: 'twilight', fx: [{ op: 'damage', v: [13, 17], day: [6, 8] }] },
  midnightVigil: { en: 'Midnight Vigil', zh: '午夜守望', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'moonshield', hero: 'knight', arch: 'twilight', fx: [{ op: 'ward', v: [8, 11] }], onNight: [{ op: 'buff', st: 'charge', v: 1 }] },
  solstice: { en: 'Solstice', zh: '至日', type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'self', glyph: 'hourglass', hero: 'knight', arch: 'twilight', fx: [{ op: 'holdSky' }, { op: 'draw', v: 2 }] },
  dayborn: { en: 'Dayborn', zh: '晝之子', type: 'power', rarity: 'uncommon', cost: [1, 0], target: 'self', glyph: 'sun', hero: 'knight', arch: 'twilight', fx: [{ op: 'power', id: 'dayborn', v: 1 }] },
  nightwatch: { en: 'Nightwatch', zh: '夜巡', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', glyph: 'moon', hero: 'knight', arch: 'twilight', fx: [{ op: 'power', id: 'nightwatch', v: [7, 10] }] },
  eclipseBurst: { en: 'Eclipse Burst', zh: '蝕爆', type: 'attack', rarity: 'uncommon', cost: 1, target: 'all', glyph: 'eclipse', hero: 'knight', arch: 'twilight', fx: [{ op: 'damage', v: [7, 10], all: true }, { op: 'eclipse' }] },
  totalEclipse: { en: 'Total Eclipse', zh: '全蝕', type: 'skill', rarity: 'rare', cost: [2, 1], target: 'self', glyph: 'eclipse', hero: 'knight', arch: 'twilight', fx: [{ op: 'bothSky' }, { op: 'draw', v: 1 }], fade: true },
  meteorLance: { en: 'Meteor Lance', zh: '星墜之槍', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', glyph: 'comet', hero: 'knight', arch: 'twilight', fx: [{ op: 'damage', v: [10, 13] }], onDay: [{ op: 'damage', v: [10, 13] }] },
  twinOrbit: { en: 'Twin Orbit', zh: '雙星軌道', type: 'power', rarity: 'rare', cost: [2, 1], target: 'self', glyph: 'stars', hero: 'knight', arch: 'twilight', fx: [{ op: 'power', id: 'orbit', v: [5, 7] }] },
  eternalTwilight: { en: 'Eternal Twilight', zh: '永恆暮光', type: 'power', rarity: 'mythic', cost: [3, 2], target: 'self', glyph: 'eclipse', hero: 'knight', arch: 'twilight', fx: [{ op: 'power', id: 'eternalTwilight', v: 1, set: true }] },

  // Statuses and curses
  smudge: { en: 'Smudge', zh: '墨漬', type: 'status', rarity: 'special', cost: null, target: 'none', glyph: 'blot', fx: [], fleeting: true },
  dust: { en: 'Dust', zh: '塵埃', type: 'status', rarity: 'special', cost: null, target: 'none', glyph: 'dust', fx: [] },
  regret: { en: 'Regret', zh: '悔恨', type: 'curse', rarity: 'special', cost: null, target: 'none', glyph: 'regret', fx: [], endTurn: [{ op: 'loseHp', v: 2 }] },
  doubt: { en: 'Doubt', zh: '疑慮', type: 'curse', rarity: 'special', cost: null, target: 'none', glyph: 'doubt', fx: [], endTurn: [{ op: 'selfWeak', v: 1 }] },
};

export const STARTER_DECK = ['slash', 'slash', 'slash', 'slash', 'slash', 'guard', 'guard', 'guard', 'guard', 'thunder'];

export const REWARD_POOL = Object.entries(CARDS)
  .filter(([, card]) => ['common', 'uncommon', 'rare', 'mythic'].includes(card.rarity))
  .map(([id]) => id);
export const CHANT_CARDS = Object.entries(CARDS).filter(([, card]) => card.chant).map(([id]) => id);
// Cards found in the Archive Gacha. Everything else is in the base collection.
export const ARCHIVE_CARDS = Object.entries(CARDS).filter(([, card]) => card.pack).map(([id]) => id);
export const isUnlocked = (id, unlocked) => !CARDS[id].pack || Boolean(unlocked?.includes(id));

const BASE_ARCH = {
  blade: ['slash', 'cleave', 'comet', 'shatter', 'pierce', 'finale', 'devour', 'storm', 'wrath', 'ascend', 'riposte', 'dash'],
  burn: ['ember', 'inferno', 'kindle', 'siphon', 'wildfire'],
  ward: ['guard', 'barrier', 'parry', 'smoke', 'fortress', 'rebound', 'stoneheart', 'bramble', 'poise', 'sanctum'],
  combo: ['twinFang', 'flick', 'whirl', 'starfall', 'echo', 'haste', 'surge', 'insight', 'focus', 'rewind', 'clarity', 'resonance'],
  chant: ['thunder', 'runeBolt', 'mend', 'hex', 'warHymn', 'runeWard', 'scholar'],
};
export function archOf(id) {
  const card = CARDS[id];
  if (card.arch) return card.arch;
  if (card.rarity === 'special') return 'special';
  return Object.keys(BASE_ARCH).find(key => BASE_ARCH[key].includes(id)) || 'blade';
}

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
// A ☀ or ☾ mark; `on` lights it up when that half of the day is active.
const sky = (which, on) => ({ sky: which, on: Boolean(on) });

// Extra from Steam and from the Day/Night bonus of an effect, as the engine adds it.
export function skyBonus(effect, up, ctx = {}) {
  return (effect.day && ctx.day ? val(effect.day, up) : 0) + (effect.night && ctx.night ? val(effect.night, up) : 0);
}
const steamBonus = (effect, up, ctx = {}) => (effect.perSteam ? Math.floor(val(effect.perSteam, up) * (ctx.steam || 0)) : 0);
function skyNote(effect, up, ctx) {
  const notes = [];
  if (effect.day) notes.push(['（', sky('day', ctx.day), ' +', num(val(effect.day, up)), '）']);
  if (effect.night) notes.push(['（', sky('night', ctx.night), ' +', num(val(effect.night, up)), '）']);
  return notes.flat();
}

function effectText(effect, up, ctx) {
  const v = val(effect.v, up);
  const bonus = ctx.bonus || 0;
  switch (effect.op) {
    case 'damage': {
      const raw = v + bonus + (effect.perCombo ? val(effect.perCombo, up) * (ctx.combo || 0) : 0) + (effect.perChant ? val(effect.perChant, up) * (ctx.chants || 0) : 0) + (effect.perFamiliar ? val(effect.perFamiliar, up) * (ctx.familiar || 0) : 0)
        + (effect.perBlade ? val(effect.perBlade, up) * (ctx.blades || 0) : 0) + (effect.perStatus ? val(effect.perStatus, up) * (ctx.statuses || 0) : 0)
        + (effect.mightMult ? (ctx.might || 0) * (val(effect.mightMult, up) - 1) : 0) + steamBonus(effect, up, ctx) + skyBonus(effect, up, ctx);
      const shown = toned(previewDamage(raw, ctx), v);
      if (effect.perSteam || effect.day || effect.night) {
        const head = effect.all ? ['對所有敵人造成 ', shown, ' 傷害'] : ['造成 ', shown, ' 傷害'];
        const hits = val(effect.hits || 1, up);
        return [...head, ...(hits > 1 ? [` ×${hits}`] : []), ...skyNote(effect, up, ctx), ...(effect.perSteam ? ['。', kw('steam'), ' 每層 +', num(val(effect.perSteam, up))] : [])];
      }
      const hits = effect.hits === 'X' ? 'X' : val(effect.hits || 1, up);
      const times = hits === 'X' ? [' X 次'] : hits > 1 ? [` ×${hits}`] : [];
      if (effect.comboHits) return [effect.random ? '隨機對敵人造成 ' : '造成 ', shown, ' 傷害，次數等於本回合已打出的牌數 +1（', kw('combo'), '）', ...(ctx.combo != null ? ['（目前 ', num((ctx.combo || 0) + 1, 'up'), ' 次）'] : [])];
      if (effect.hitsPerStatus) {
        const now = ctx.statuses != null ? ['（目前 ', num(hits + ctx.statuses, 'up'), ' 次）'] : [];
        return ['對所有敵人造成 ', shown, ' 傷害 ×', num(hits), '。牌組中每有 1 張 ', kw('statusCard'), '，再多打 1 次', ...now];
      }
      if (effect.hitsPerFamiliar) {
        const extra = ctx.familiar != null ? ['（目前 ', num(1 + Math.floor((ctx.familiar || 0) / effect.hitsPerFamiliar), 'up'), ' 次）'] : [];
        return ['隨機對敵人造成 ', shown, ' 傷害 1 次，', kw('familiar'), ' 每有 ', num(effect.hitsPerFamiliar), ' 層再多 1 次', ...extra];
      }
      if (effect.perFamiliar) return ['造成 ', shown, ' 傷害。', kw('familiar'), ' 每有 1 層，傷害 +', num(val(effect.perFamiliar, up))];
      if (effect.random) return ['隨機對敵人造成 ', shown, ' 傷害', ...times, ...(effect.burnPerHit ? ['，每次命中施加 ', num(effect.burnPerHit), ' 層 ', kw('burn')] : [])];
      let base = effect.all ? ['對所有敵人造成 ', shown, ' 傷害', ...times] : ['造成 ', shown, ' 傷害', ...times];
      if (effect.perCombo) base = [...base, '。', kw('combo'), '：本回合每打出過 1 張牌，傷害 +', num(val(effect.perCombo, up))];
      if (effect.perChant) base = [...base, '。本場每成功 ', kw('chant'), ' 1 次，傷害 +', num(val(effect.perChant, up))];
      if (effect.perBlade) base = [...base, '。本場每打出過 1 張 ', kw('paperBlade'), '，傷害 +', num(val(effect.perBlade, up))];
      if (effect.perStatus) base = [...base, '。牌組中每有 1 張 ', kw('statusCard'), '，傷害 +', num(val(effect.perStatus, up))];
      if (effect.perBurn) base = [...base, '。目標每有 1 層 ', kw('burn'), '，傷害 +', num(val(effect.perBurn, up))];
      if (effect.wounded) base = [...base, '。若目標生命在一半以下，傷害加倍'];
      if (effect.grow) base = [...base, '。每打出一次，本場戰鬥中這張牌的傷害 +', num(val(effect.grow, up))];
      if (effect.mightMult) base = [...base, '。', kw('might'), ' 對這張牌有 ', num(val(effect.mightMult, up)), ' 倍效果'];
      return effect.onKill ? [...base, '。若擊倒目標，最大生命 +', num(val(effect.onKill, up))] : base;
    }
    case 'damageWard': return [effect.all ? '對所有敵人造成等同你 ' : '造成等同你目前 ', kw('ward'), ' 的傷害'];
    case 'ward': {
      const kept = effect.perKept ? val(effect.perKept, up) * (ctx.kept || 0) : 0;
      const base = ['獲得 ', toned(previewWard(v + bonus + kept + steamBonus(effect, up, ctx) + skyBonus(effect, up, ctx) + (ctx.moonstone && ctx.night ? 3 : 0), ctx), v), ' ', kw('ward'), ...skyNote(effect, up, ctx)];
      if (effect.perSteam) return [...base, '。', kw('steam'), ' 每層 +', num(val(effect.perSteam, up))];
      return effect.perKept ? [...base, '。每在手中保留過 1 回合，再 +', num(val(effect.perKept, up))] : base;
    }
    case 'steam': return v >= 0 ? [kw('steam'), ' +', num(v)] : [kw('steam'), ' −', num(-v)];
    case 'vent': return [kw('vent'), '：', kw('steam'), ' 歸零'];
    case 'doubleSteam': return [kw('steam'), ' 加倍', ...(ctx.steam != null ? ['（目前 ', num(ctx.steam, 'up'), ' → ', num(ctx.steam * 2, 'up'), '）'] : [])];
    case 'ifSteam': return ['若 ', kw('steam'), ' 有 ', num(effect.n), ' 以上，', ...effect.then.flatMap(item => effectText(item, up, ctx))];
    case 'eclipse': return [kw('eclipse'), '：', sky('day', ctx.day), ' ⇄ ', sky('night', ctx.night)];
    case 'bothSky': return ['本回合同時算作 ', kw('day'), ' 和 ', kw('night'), '（兩邊的效果都會生效）'];
    case 'holdSky': return ['下回合不會交替晝夜，維持現在的 ', sky('day', ctx.day), '/', sky('night', ctx.night)];
    case 'detonate': return ['造成等同目標 ', kw('burn'), ' ×', num(v), ' 的傷害，並移除它的 ', kw('burn')];
    case 'spreadBurn': return ['把目標的 ', kw('burn'), ' 複製給其他所有敵人'];
    case 'burnTickAll': return ['所有敵人立刻受到等同自身 ', kw('burn'), ' 的傷害'];
    case 'copyLast': return ['把本回合上一張打出的牌複製到手中，費用變成 0'];
    case 'conjure': return [kw('conjure'), '：隨機加入 ', num(v), ' 張攻擊牌到手中'];
    case 'absorb': return ['讓手中所有 ', kw('statusCard'), ' 消逝，每張獲得 1 點能量', ...(val(effect.draw, up) ? ['並抽 1 張牌'] : [])];
    case 'addStatus': return ['把 ', num(v), ' 張 Smudge 放進你的棄牌堆'];
    case 'wardPerStatus': return ['獲得 ', toned(previewWard(v + val(effect.per, up) * (ctx.statuses || 0), ctx), v), ' ', kw('ward'), '，牌組中每有 1 張 ', kw('statusCard'), ' 再 +', num(val(effect.per, up))];
    case 'inscribe': return [kw('inscribe'), ' ', num(v), '：這張牌的數值永久 +', num(v)];
    case 'choose': {
      const n = val(effect.n, up);
      const what = { toHand: '加入手中', discard: '丟進棄牌堆', fade: '消逝', inscribe: '' }[effect.action];
      if (effect.from === 'discard') return ['從棄牌堆挑 1 張牌', what];
      if (effect.from === 'top') return ['查看抽牌堆頂 ', num(n), ' 張，挑 1 張', what, '，其餘放進棄牌堆'];
      if (effect.action === 'fade') return effect.energy ? ['挑手中 1 張牌', what, '，獲得 ', num(val(effect.energy, up)), ' 點能量'] : ['挑手中 1 張牌', what];
      if (effect.action === 'inscribe') return ['挑手中 1 張牌 ', kw('inscribe'), ' ', num(v), '（永久 +', num(v), '）'];
      return ['挑手中 1 張牌', what];
    }
    case 'upgradeHand': return val(effect.all, up) ? ['本場戰鬥中，升級手中所有的牌'] : ['本場戰鬥中，升級手中 1 張牌（自選）'];
    case 'drawX': return ['抽 X+', num(v), ' 張牌'];
    case 'wardPerHand': return ['手中每有 1 張牌，獲得 ', toned(previewWard(v, ctx), v), ' ', kw('ward')];
    case 'draw': return [`抽 `, num(v), ` 張牌`];
    case 'energy': return ['獲得 ', num(v), ' 點能量'];
    case 'debuff': return [effect.all ? '對所有敵人施加 ' : '施加 ', num(v), ' 層 ', kw(effect.st)];
    case 'buff': return ['獲得 ', num(v), ' 層 ', kw(effect.st)];
    case 'heal': return ['回復 ', num(v), ' 生命'];
    case 'loseHp': return ['失去 ', num(v), ' 生命'];
    case 'selfWeak': return ['回合結束時若在手中，獲得 ', num(v), ' 層 ', kw('weak')];
    case 'doubleWard': return ['使你的 ', kw('ward'), ' 加倍'];
    case 'doubleBurn': return [effect.all ? '使所有敵人的 ' : '使目標的 ', kw('burn'), ' 加倍'];
    case 'reflect': return [kw('reflect'), '：直到你的下回合，被 ', kw('ward'), ' 擋下的攻擊傷害會反彈給攻擊者'];
    case 'stripWard': return ['移除目標所有 ', kw('ward')];
    case 'echo': return [kw('echo'), '：下一張攻擊牌打出兩次'];
    case 'wardFromBurn': return ['獲得等同所有敵人 ', kw('burn'), ' 總和的 ', kw('ward')];
    case 'ifExposed': return ['若目標有 ', kw('exposed'), '，', ...effect.then.flatMap(item => effectText(item, up, ctx))];
    case 'recycle': return ['將棄牌堆洗回抽牌堆'];
    case 'power': return POWER_TEXT[effect.id].text(v);
    case 'feed': return [kw('familiar'), ' +', num(v)];
    case 'unleash': {
      if (effect.x) { const plus = val(effect.plus, up); return [kw('familiar'), ' 立刻攻擊 X', ...(plus ? ['+', num(plus)] : []), ' 次']; }
      return [kw('familiar'), ' 立刻攻擊', ...(v > 1 ? [' ', num(v), ' 次'] : [])];
    }
    case 'spend': {
      const now = ctx.familiar != null ? ['（目前 ', num((effect.half ? Math.floor(ctx.familiar / 2) : ctx.familiar) * v, 'up'), '）'] : [];
      return [effect.half ? '消耗一半 ' : '消耗全部 ', kw('familiar'), '，造成消耗層數 ×', num(v), ' 的傷害', ...now];
    }
    case 'burnFromFamiliar': return ['對所有敵人施加等同 ', kw('familiar'), v < 1 ? ' 一半' : '', ' 層數的 ', kw('burn')];
    case 'doubleFamiliar': return [kw('familiar'), ' 層數加倍'];
    case 'wardFamiliar': return ['獲得 ', toned(previewWard(v + (ctx.familiar || 0), ctx), v), ' ', kw('ward'), '（', num(v), ' + ', kw('familiar'), ' 層數）'];
    case 'ifFamiliar': return ['若 ', kw('familiar'), ' 有 ', num(effect.n), ' 層以上，', ...effect.then.flatMap(item => effectText(item, up, ctx))];
    case 'fold': return effect.fill ? ['把手牌補滿', effect.upBlades ? '升級過的 ' : ' ', kw('paperBlade')] : ['把 ', num(v), ' 張 ', kw('paperBlade'), ' 加入手中'];
    case 'burstHand': return ['手中每張 ', kw(effect.kind === 'junk' ? 'statusCard' : 'paperBlade'), ' 都會消逝，並對所有敵人造成 ', toned(previewDamage(v, ctx), v), ' 傷害'];
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
  ctx = { ...ctx, bonus: (inst.bonus || 0) + (inst.grow || 0) + (inst.id === 'paperBlade' ? (ctx.keen || 0) + (ctx.dragon || 0) : 0), kept: inst.kept || 0 };
  if (card.cost === null && !ctx.livingInk) lines.push([kw('unplayable'), '。']);
  if (card.cost === null && ctx.livingInk) lines.push(['（', kw('statusCard'), '）打出時消逝並抽 1 張牌。']);
  if (card.keep) lines.push([kw('keep'), '。']);
  const body = card.fx.map(effect => effectText(effect, up, ctx));
  if (card.endTurn) body.push(...card.endTurn.map(effect => effect.op === 'loseHp' ? ['回合結束時若在手中，失去 ', num(val(effect.v, up)), ' 生命'] : effectText(effect, up, ctx)));
  if (body.length) lines.push(joinSentences(body));
  if (card.onDay) lines.push([sky('day', ctx.day), kw('day'), '：', ...joinSentences(card.onDay.map(effect => effectText(effect, up, ctx)))]);
  if (card.onNight) lines.push([sky('night', ctx.night), kw('night'), '：', ...joinSentences(card.onNight.map(effect => effectText(effect, up, ctx)))]);
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
