// `hero` limits a relic to one hero's runs (starter relics and familiar ones).
export const RELICS = {
  inkwell: { en: 'Endless Inkwell', zh: '不竭墨水瓶', tier: 'starter', glyph: 'inkwell', color: '#7aa8ff', text: '每場戰鬥勝利後回復 6 生命。' },
  spiritJar: { en: 'Spirit Jar', zh: '靈瓶', tier: 'starter', glyph: 'jar', color: '#b48bff', hero: 'caller', text: '每場戰鬥開始時，墨靈 +2。' },

  cinderCharm: { en: 'Cinder Charm', zh: '灰燼護符', tier: 'common', glyph: 'charm', color: '#ff8a4c', text: '每回合開始時，對隨機一名敵人施加 2 層 Burn。' },
  paperCrane: { en: 'Paper Crane', zh: '紙鶴', tier: 'common', glyph: 'crane', color: '#f4ead2', text: '每場戰鬥開始時，所有敵人獲得 1 層 Weak。' },
  smudgedLens: { en: 'Smudged Lens', zh: '污損鏡片', tier: 'common', glyph: 'lens', color: '#9aa6c9', text: '每抽到 1 張狀態牌或詛咒，獲得 3 Ward。' },
  spiritBell: { en: 'Spirit Bell', zh: '召靈鈴', tier: 'common', glyph: 'bell', color: '#c39bff', hero: 'caller', text: '每場戰鬥開始時，墨靈 +2。' },
  metronome: { en: 'Metronome', zh: '節拍器', tier: 'uncommon', glyph: 'metronome', color: '#d6a648', text: '每回合打出第 6 張牌時，獲得 1 點能量。' },
  runestone: { en: 'Runestone', zh: '符文石', tier: 'uncommon', glyph: 'rune', color: '#7fe0d0', text: '每場戰鬥第一次 Chant 強化成功時，獲得 1 點能量並抽 1 張牌。' },
  goldLeaf: { en: 'Gold Leaf', zh: '金箔', tier: 'uncommon', glyph: 'leaf', color: '#f2c76b', text: '商店所有商品打 8 折。' },
  inkHorn: { en: 'Ink Horn', zh: '墨角', tier: 'uncommon', glyph: 'horn', color: '#9b7bff', hero: 'caller', text: '墨靈攻擊時，額外施加 2 層 Burn。' },
  bulwark: { en: 'Bulwark Stone', zh: '城牆石', tier: 'rare', glyph: 'tower', color: '#8fb3c9', text: '回合開始時，Ward 只會消失一半。' },
  bloodInk: { en: 'Blood Ink', zh: '血墨', tier: 'rare', glyph: 'drop', color: '#e2504f', text: '每回合第一次失去生命時，獲得 1 層 Might。' },
  emberHeart: { en: 'Ember Heart', zh: '燼心', tier: 'rare', glyph: 'emberHeart', color: '#ff6a3d', text: '敵人受到的 Burn 傷害 +50%。' },

  lantern: { en: 'Brass Lantern', zh: '黃銅提燈', tier: 'common', glyph: 'lantern', color: '#f2c76b', text: '每場戰鬥第一回合多 1 點能量。' },
  bookmark: { en: 'Silk Bookmark', zh: '絲綢書籤', tier: 'common', glyph: 'bookmark', color: '#e0697a', text: '每場戰鬥第一回合多抽 2 張牌。' },
  whetstone: { en: 'Whetstone', zh: '磨刀石', tier: 'common', glyph: 'whetstone', color: '#a9b4c2', text: '每場戰鬥開始時獲得 1 層 Might。' },
  anchor: { en: 'Iron Anchor', zh: '鐵錨', tier: 'common', glyph: 'anchor', color: '#8fb3c9', text: '每場戰鬥第一回合獲得 10 Ward。' },
  emberStone: { en: 'Ember Stone', zh: '餘燼石', tier: 'common', glyph: 'gem', color: '#ff7a45', text: '每場戰鬥開始時，對所有敵人施加 3 層 Burn。' },
  moonPeach: { en: 'Moon Peach', zh: '月光桃', tier: 'common', glyph: 'peach', color: '#ffb3c1', text: '拾取時最大生命 +10。' },
  oldCoin: { en: 'Old Coin', zh: '古老銀幣', tier: 'common', glyph: 'coin', color: '#e8c47a', text: '拾取時獲得 120 金幣。' },
  redThread: { en: 'Red Thread', zh: '紅線', tier: 'common', glyph: 'thread', color: '#e05a4f', text: '每場戰鬥開始時回復 3 生命。' },

  thornRing: { en: 'Thorn Ring', zh: '荊棘戒', tier: 'uncommon', glyph: 'ring', color: '#7fc28a', text: '每場戰鬥開始時獲得 3 層 Spikes。' },
  goldenQuill: { en: 'Golden Quill', zh: '金羽筆', tier: 'uncommon', glyph: 'quill', color: '#f2c76b', text: 'Chant 強化成功時，抽 1 張牌。' },
  mirrorShard: { en: 'Mirror Shard', zh: '鏡之碎片', tier: 'uncommon', glyph: 'shard', color: '#bfe6ff', text: '每場戰鬥的第一張攻擊牌會打出兩次。' },
  hourglass: { en: 'Hourglass', zh: '沙漏', tier: 'uncommon', glyph: 'hourglass', color: '#e3c28f', text: '每第 3 回合開始時多 1 點能量。' },
  teaSet: { en: 'Tea Set', zh: '午後茶具', tier: 'uncommon', glyph: 'tea', color: '#9fd3b5', text: '在燈下休憩時額外回復 15 生命。' },

  ironNib: { en: 'Iron Nib', zh: '鐵筆尖', tier: 'rare', glyph: 'nib', color: '#c9d1dc', text: '每打出第 10 張攻擊牌，該牌傷害加倍。' },
  owlFeather: { en: 'Owl Feather', zh: '夜梟羽', tier: 'rare', glyph: 'feather', color: '#c5b29a', text: '回合結束時，若沒有 Ward，獲得 6 Ward。' },
  starChart: { en: 'Star Chart', zh: '星圖', tier: 'rare', glyph: 'stars', color: '#9cc7ff', text: '卡牌獎勵多 1 個選項。' },
  phoenixAsh: { en: 'Phoenix Ash', zh: '鳳凰灰燼', tier: 'rare', glyph: 'phoenix', color: '#ff9f43', text: '生命歸零時，回復 50% 生命（僅一次）。' },

  midnightOil: { en: 'Midnight Oil', zh: '午夜燈油', tier: 'boss', glyph: 'oil', color: '#ffd35c', text: '每回合 +1 能量。燈下休憩時無法回復生命。' },
  grandCodex: { en: 'Grand Codex', zh: '大法典', tier: 'boss', glyph: 'book', color: '#c39bff', text: '每回合 +1 能量。每場戰鬥開始時，2 張 Smudge 洗入抽牌堆。' },
  crownOfEchoes: { en: 'Crown of Echoes', zh: '回聲之冠', tier: 'boss', glyph: 'crown', color: '#f2c76b', text: '每回合 +1 能量。敵人開局獲得 1 層 Might。' },
  runeHeart: { en: 'Runic Heart', zh: '符文之心', tier: 'boss', glyph: 'heart', color: '#ff7aa2', text: '每回合多抽 1 張牌。' },
  sageEye: { en: "Sage's Eye", zh: '賢者之眼', tier: 'boss', glyph: 'eye', color: '#7fe0d0', text: '所有 Chant 牌費用 -1。Chant 強化時回復 2 生命。' },
};

export const ENERGY_RELICS = ['midnightOil', 'grandCodex', 'crownOfEchoes'];

export const POTIONS = {
  fireTonic: { en: 'Fire Tonic', zh: '烈焰藥劑', color: '#ff6a3d', target: 'enemy', text: '對一名敵人造成 20 傷害。' },
  ironTonic: { en: 'Iron Tonic', zh: '鐵壁藥劑', color: '#8fb3c9', target: 'self', text: '獲得 12 Ward。' },
  swiftTonic: { en: 'Swift Tonic', zh: '疾風藥劑', color: '#6fe0b4', target: 'self', text: '抽 3 張牌。' },
  starTonic: { en: 'Star Tonic', zh: '星光藥劑', color: '#ffd35c', target: 'self', text: '獲得 2 點能量。' },
  mightTonic: { en: 'Might Tonic', zh: '力量藥劑', color: '#e2504f', target: 'self', text: '獲得 2 層 Might。' },
  healTonic: { en: 'Healing Tonic', zh: '治癒藥劑', color: '#ff8fb1', target: 'self', text: '回復 20 生命。' },
  hexTonic: { en: 'Hex Tonic', zh: '咒印藥劑', color: '#9b7bff', target: 'enemy', text: '對一名敵人施加 3 層 Exposed 與 2 層 Weak。' },
  emberTonic: { en: 'Ember Tonic', zh: '火種藥劑', color: '#ff9f43', target: 'self', text: '對所有敵人施加 6 層 Burn。' },
};
