// Enemy roster. `next(enemy, roll)` returns the id of the move the enemy will
// telegraph next; `enemy.turns` counts the moves it has already taken.
const cycle = (...ids) => enemy => ids[enemy.turns % ids.length];
function mix(table, maxRepeat = 2) {
  return (enemy, roll) => {
    const recent = enemy.history.slice(-maxRepeat);
    const options = table.filter(([id]) => !(recent.length === maxRepeat && recent.every(previous => previous === id)));
    const total = options.reduce((sum, [, weight]) => sum + weight, 0);
    let value = roll * total;
    for (const [id, weight] of options) { value -= weight; if (value < 0) return id; }
    return options[options.length - 1][0];
  };
}

export const ENEMIES = {
  // ── Act I · The Whispering Stacks ──
  inkling: {
    en: 'Inkling', zh: '墨團', hp: [12, 16], art: 'inkling',
    moves: { splash: { en: 'Splash', zh: '潑濺', dmg: 6 }, smear: { en: 'Smear', zh: '塗抹', dmg: 3, weak: 1 } },
    next: mix([['splash', 65], ['smear', 35]]),
  },
  moth: {
    en: 'Paper Moth', zh: '紙蛾', hp: [22, 26], art: 'moth',
    moves: { flutter: { en: 'Flutter', zh: '振翅', dmg: 3, hits: 2 }, fold: { en: 'Fold', zh: '摺翼', ward: 7, might: 1 } },
    next: cycle('flutter', 'fold', 'flutter'),
  },
  dustWisp: {
    en: 'Dust Wisp', zh: '塵靈', hp: [8, 11], art: 'wisp',
    moves: { prick: { en: 'Prick', zh: '刺痛', dmg: 4 }, haze: { en: 'Haze', zh: '迷霧', cards: [{ id: 'dust', n: 1 }] } },
    next: mix([['prick', 70], ['haze', 30]]),
  },
  bookworm: {
    en: 'Bookworm', zh: '書蠹', hp: [36, 40], art: 'worm',
    moves: { gnaw: { en: 'Gnaw', zh: '啃咬', dmg: 9 }, chew: { en: 'Chew', zh: '咀嚼', dmg: 4, hits: 2 }, burrow: { en: 'Burrow', zh: '鑽洞', ward: 8, might: 2 } },
    next: mix([['gnaw', 45], ['chew', 35], ['burrow', 20]]),
  },
  quillKnight: {
    en: 'Quill Knight', zh: '羽筆騎士', hp: [68, 72], art: 'knight', elite: true,
    moves: {
      inkCharge: { en: 'Ink Charge', zh: '墨之蓄勢', might: 2, ward: 10 },
      lance: { en: 'Lance', zh: '長槍突刺', dmg: 13 },
      scribble: { en: 'Scribble', zh: '亂筆', dmg: 6, exposed: 2 },
    },
    next: enemy => (enemy.turns === 0 ? 'inkCharge' : ['lance', 'scribble', 'lance', 'inkCharge'][(enemy.turns - 1) % 4]),
  },
  librarian: {
    en: 'Hush Librarian', zh: '噤聲館長', hp: [60, 64], art: 'librarian', elite: true,
    moves: {
      shush: { en: 'Shush!', zh: '噓！', dmg: 6, weak: 2 },
      catalog: { en: 'Catalog', zh: '歸檔', ward: 12, cards: [{ id: 'smudge', n: 2 }] },
      overdue: { en: 'Overdue', zh: '逾期罰款', dmg: 18 },
    },
    next: cycle('shush', 'catalog', 'overdue'),
  },
  candleImp: {
    en: 'Candle Imp', zh: '燭火小鬼', hp: [16, 20], art: 'imp',
    moves: { singe: { en: 'Singe', zh: '燎燒', dmg: 4, burn: 2 }, flare: { en: 'Flare', zh: '爆燃', dmg: 9 } },
    next: mix([['singe', 55], ['flare', 45]]),
  },
  ribbonSerpent: {
    en: 'Ribbon Serpent', zh: '書籤蛇', hp: [30, 34], art: 'serpent',
    moves: {
      lash: { en: 'Lash', zh: '鞭打', dmg: 5, hits: 2 },
      bind: { en: 'Bind', zh: '纏縛', dmg: 7, weak: 1 },
      coil: { en: 'Coil', zh: '盤繞', ward: 6, might: 1 },
    },
    next: cycle('lash', 'bind', 'coil'),
  },
  inkweaver: {
    en: 'Inkweaver', zh: '墨織蛛', hp: [72, 76], art: 'spider', elite: true,
    moves: {
      bite: { en: 'Venom Bite', zh: '毒牙', dmg: 12 },
      brood: { en: 'Brood', zh: '孵化', summon: [{ id: 'inkling', n: 1 }], ward: 6 },
      web: { en: 'Web', zh: '織網', dmg: 5, weak: 2, frail: 1 },
      spin: { en: 'Spin', zh: '吐絲', ward: 12, might: 2 },
    },
    next: enemy => ['bite', 'brood', 'web', 'bite', 'spin'][enemy.turns % 5],
  },
  hollowTome: {
    en: 'The Hollow Tome', zh: '空白之書', hp: [124, 124], art: 'tome', boss: true,
    moves: {
      torrent: { en: 'Ink Torrent', zh: '墨流', dmg: 5, hits: 3 },
      erase: { en: 'Erase', zh: '抹除', dmg: 9, cards: [{ id: 'smudge', n: 2 }] },
      blank: { en: 'Blank Page', zh: '空白之頁', ward: 14, might: 1 },
      lastChapter: { en: 'Last Chapter', zh: '最終章', dmg: 22 },
    },
    next: enemy => (enemy.hp < enemy.maxHp / 2 && !enemy.uses?.lastChapter ? 'lastChapter' : ['torrent', 'erase', 'blank'][enemy.turns % 3]),
    phase2: { en: 'The Pages Turn Black', zh: '黑頁翻湧', text: '空白之書撕開最後一章：清除 Weak 與 Exposed，獲得 2 層 Might 和 12 Ward。', might: 2, ward: 12, cleanse: true },
  },
  // Second Act I boss: fight the arms or go for the head (the arms fall with it).
  tentacle: {
    en: 'Tentacle', zh: '觸手', hp: [16, 18], art: 'tentacle', minion: true, severs: 10,
    moves: { slap: { en: 'Slap', zh: '拍擊', dmg: 4 }, grab: { en: 'Grab', zh: '纏捲', dmg: 2, weak: 1 } },
    next: mix([['slap', 60], ['grab', 40]]),
  },
  inkKraken: {
    en: 'Inkwell Kraken', zh: '墨池巨怪', hp: [100, 100], art: 'kraken', boss: true,
    passive: '每打倒一條觸手，本體就受到 10 傷害；打倒本體，觸手會一起消失。觸手少於兩條時，牠會再長出新的。',
    moves: {
      inkJet: { en: 'Ink Jet', zh: '墨噴', dmg: 7, cards: [{ id: 'smudge', n: 1 }] },
      murk: { en: 'Murk', zh: '墨霧', allyWard: 7, weak: 2 },
      crush: { en: 'Crushing Arm', zh: '巨觸壓頂', dmg: 16 },
      regrow: { en: 'Regrow', zh: '再生', summon: [{ id: 'tentacle', n: 1 }], ward: 6 },
    },
    next: (enemy, roll, { allies = [] } = {}) => {
      const arms = allies.filter(ally => ally.id === 'tentacle').length;
      if (enemy.turns > 0 && arms < 2 && enemy.history.at(-1) !== 'regrow') return 'regrow';
      return ['inkJet', 'murk', 'crush'][enemy.turns % 3];
    },
    phase2: { en: 'Rising Tide', zh: '深淵漲潮', text: '墨池巨怪從深處伸出兩條新觸手，並獲得 1 層 Might。', might: 1, summon: [{ id: 'tentacle', n: 2 }] },
  },

  // ── Act II · The Rusted Clockwork ──
  cogRat: {
    en: 'Cog Rat', zh: '齒輪鼠', hp: [24, 28], art: 'rat',
    moves: { nibble: { en: 'Nibble', zh: '啃齧', dmg: 4, hits: 2 }, scurry: { en: 'Scurry', zh: '竄逃', dmg: 5, ward: 6 } },
    next: mix([['nibble', 60], ['scurry', 40]]),
  },
  sentinel: {
    en: 'Tick Sentinel', zh: '滴答哨兵', hp: [50, 54], art: 'sentinel',
    moves: { windUp: { en: 'Wind Up', zh: '上發條', ward: 12, might: 2 }, chime: { en: 'Chime', zh: '鐘鳴', dmg: 14 } },
    next: cycle('windUp', 'chime'),
  },
  pendulum: {
    en: 'Pendulum', zh: '擺錘', hp: [44, 48], art: 'pendulum',
    moves: { swing: { en: 'Swing', zh: '擺盪', dmg: 7, grow: 3 } },
    next: () => 'swing',
  },
  rustMite: {
    en: 'Rust Mite', zh: '鏽蟎', hp: [15, 19], art: 'mite',
    moves: { bite: { en: 'Bite', zh: '咬', dmg: 6 }, corrode: { en: 'Corrode', zh: '鏽蝕', dmg: 3, frail: 2 } },
    next: mix([['bite', 60], ['corrode', 40]]),
  },
  brassGolem: {
    en: 'Brass Golem', zh: '黃銅巨像', hp: [108, 112], art: 'golem', elite: true,
    moves: {
      stomp: { en: 'Stomp', zh: '踐踏', dmg: 8, exposed: 2 },
      heat: { en: 'Overheat', zh: '過熱', ward: 16, might: 3 },
      slam: { en: 'Slam', zh: '重擊', dmg: 22 },
    },
    next: cycle('stomp', 'heat', 'slam'),
  },
  twinGear: {
    en: 'Twin Gear', zh: '雙子齒輪', hp: [46, 50], art: 'gear', elite: true,
    moves: {
      grind: { en: 'Grind', zh: '碾磨', dmg: 9 },
      sync: { en: 'Synchronize', zh: '同步', allyWard: 8, might: 2 },
      spark: { en: 'Spark', zh: '火花', dmg: 5, burn: 3 },
    },
    next: mix([['grind', 45], ['sync', 25], ['spark', 30]]),
  },
  springJack: {
    en: 'Spring Jack', zh: '彈簧小丑', hp: [26, 30], art: 'jack',
    moves: { wind: { en: 'Wind Up', zh: '上緊發條', ward: 6, might: 2 }, boing: { en: 'Boing!', zh: '彈射', dmg: 12 } },
    next: cycle('wind', 'boing'),
  },
  oilSlick: {
    en: 'Oil Slick', zh: '機油怪', hp: [34, 38], art: 'slick',
    moves: {
      slick: { en: 'Slick', zh: '滑溜', dmg: 5, frail: 2 },
      ignite: { en: 'Ignite', zh: '引燃', dmg: 6, burn: 3 },
      ooze: { en: 'Ooze', zh: '滲回', ward: 8, heal: 6 },
    },
    next: mix([['slick', 40], ['ignite', 40], ['ooze', 20]]),
  },
  duelist: {
    en: 'Clockwork Duelist', zh: '機械決鬥者', hp: [100, 104], art: 'duelist', elite: true, start: { spikes: 2 },
    moves: {
      feint: { en: 'Feint', zh: '佯攻', dmg: 7, exposed: 2 },
      flurry: { en: 'Flurry', zh: '連刺', dmg: 5, hits: 3 },
      stance: { en: 'En Garde', zh: '架勢', ward: 14, might: 2 },
    },
    next: cycle('feint', 'flurry', 'stance'),
  },
  clockwarden: {
    en: 'The Clockwarden', zh: '時之守衛', hp: [200, 200], art: 'clock', boss: true,
    countdown: { move: 'midnight', every: 4, en: 'Midnight', tip: '午夜鐘響時會造成巨大傷害，記得提前準備 Ward！' },
    moves: {
      tick: { en: 'Tick', zh: '滴', dmg: 7, hits: 2 },
      tock: { en: 'Tock', zh: '答', ward: 20, exposed: 2 },
      gears: { en: 'Grinding Gears', zh: '齒輪絞殺', dmg: 12, cards: [{ id: 'dust', n: 2 }] },
      midnight: { en: 'Midnight', zh: '午夜鐘響', dmg: 34 },
    },
    next: enemy => ['tick', 'tock', 'gears', 'midnight'][enemy.turns % 4],
    phase2: { en: 'Overclock', zh: '超頻運轉', text: '時之守衛的齒輪開始超頻：獲得 3 層 Might 和 15 Ward。', might: 3, ward: 15 },
  },
  // Second Act II boss: two clockwork twins; the survivor rages when one falls.
  tick: {
    en: 'Tick', zh: '滴', hp: [95, 95], art: 'twinTick', boss: true, title: { en: 'Tick & Tock', zh: '滴答雙子' },
    avenge: { might: 4 }, passive: '雙子其中一個倒下時，另一個會暴怒（Might +4）。盡量讓兩個一起倒下！',
    moves: {
      rattle: { en: 'Rattle', zh: '連響', dmg: 4, hits: 3 },
      quick: { en: 'Quickstep', zh: '急拍', dmg: 8, frail: 1 },
      wind: { en: 'Wind Up', zh: '上鍊', ward: 10, might: 1 },
    },
    next: cycle('rattle', 'quick', 'wind'),
  },
  tock: {
    en: 'Tock', zh: '答', hp: [105, 105], art: 'twinTock', boss: true,
    avenge: { might: 4 }, passive: '雙子其中一個倒下時，另一個會暴怒（Might +4）。盡量讓兩個一起倒下！',
    moves: {
      brace: { en: 'Calibrate', zh: '校準', allyWard: 8 },
      toll: { en: 'Heavy Toll', zh: '重鳴', dmg: 15 },
      shake: { en: 'Shake', zh: '震盪', dmg: 7, exposed: 2 },
    },
    next: cycle('brace', 'toll', 'shake'),
  },

  // ── Act III · The Throne of Silence ──
  hushWraith: {
    en: 'Hush Wraith', zh: '寂靜幽魂', hp: [50, 55], art: 'wraith',
    moves: {
      wail: { en: 'Wail', zh: '哀嚎', dmg: 13 },
      muffle: { en: 'Muffle', zh: '消音', weak: 2, frail: 2 },
      haunt: { en: 'Haunt', zh: '纏繞', dmg: 6, hits: 2 },
    },
    next: mix([['wail', 40], ['muffle', 25], ['haunt', 35]]),
  },
  echoShade: {
    en: 'Echo Shade', zh: '回聲殘影', hp: [34, 38], art: 'shade',
    moves: { mimic: { en: 'Mimic', zh: '模仿', dmg: 10 }, flicker: { en: 'Flicker', zh: '閃爍', ward: 10, exposed: 1 } },
    next: mix([['mimic', 60], ['flicker', 40]]),
  },
  gargoyle: {
    en: 'Mute Gargoyle', zh: '啞石像鬼', hp: [64, 70], art: 'gargoyle', start: { spikes: 3 },
    moves: { crush: { en: 'Crush', zh: '碾碎', dmg: 17 }, stoneSkin: { en: 'Stone Skin', zh: '石膚', ward: 18 } },
    next: cycle('crush', 'stoneSkin'),
  },
  veiledOracle: {
    en: 'Veiled Oracle', zh: '蒙面神諭', hp: [118, 124], art: 'oracle', elite: true,
    moves: {
      glimpse: { en: 'Glimpse', zh: '窺見', weak: 2, exposed: 2, frail: 2 },
      prophecy: { en: 'Prophecy', zh: '預言', dmg: 8, hits: 2, cards: [{ id: 'doubt', n: 1 }] },
      veil: { en: 'Veil', zh: '帷幕', ward: 20, might: 3 },
      doom: { en: 'Doom', zh: '厄運', dmg: 30 },
    },
    next: cycle('glimpse', 'prophecy', 'veil', 'doom'),
  },
  silentKnight: {
    en: 'Silent Knight', zh: '無聲騎士', hp: [128, 134], art: 'silentKnight', elite: true, start: { ritual: 1 },
    moves: {
      strike: { en: 'Grave Strike', zh: '沉默斬', dmg: 15 },
      guard: { en: 'Iron Guard', zh: '鐵衛', ward: 16 },
      execute: { en: 'Execute', zh: '處決', dmg: 7, hits: 3 },
    },
    next: cycle('strike', 'guard', 'execute'),
  },
  muteBell: {
    en: 'Mute Bell', zh: '啞鐘', hp: [44, 48], art: 'bell',
    moves: { toll: { en: 'Toll', zh: '鐘響', dmg: 5, hits: 2, weak: 1 }, hush: { en: 'Hush', zh: '靜音', allyWard: 9 } },
    next: mix([['toll', 65], ['hush', 35]]),
  },
  forgottenScribe: {
    en: 'Forgotten Scribe', zh: '遺忘書記', hp: [40, 44], art: 'scribe',
    moves: {
      scrawl: { en: 'Scrawl', zh: '潦草', dmg: 11 },
      drain: { en: 'Drain', zh: '汲取', dmg: 7, heal: 7 },
      blot: { en: 'Blot', zh: '塗污', dmg: 4, cards: [{ id: 'smudge', n: 2 }] },
    },
    next: mix([['scrawl', 45], ['drain', 30], ['blot', 25]]),
  },
  choir: {
    en: 'Hollow Choir', zh: '空洞詩班', hp: [132, 138], art: 'choir', elite: true,
    moves: {
      gather: { en: 'Gather', zh: '聚集', summon: [{ id: 'echoShade', n: 1 }], allyWard: 6 },
      crescendo: { en: 'Crescendo', zh: '漸強', dmg: 9, grow: 4 },
      requiem: { en: 'Requiem', zh: '安魂曲', dmg: 6, hits: 3, weak: 1 },
      hymn: { en: 'Hymn', zh: '聖歌', allyWard: 12, might: 2 },
    },
    next: enemy => (enemy.turns === 0 ? 'gather' : ['crescendo', 'requiem', 'hymn', 'gather'][(enemy.turns - 1) % 4]),
  },
  unspoken: {
    en: 'The Unspoken', zh: '無言之主', hp: [280, 280], art: 'unspoken', boss: true,
    moves: {
      silence: { en: 'Silence', zh: '萬籟俱寂', weak: 2, frail: 2, cards: [{ id: 'smudge', n: 3 }] },
      voidBeam: { en: 'Void Beam', zh: '虛空射線', dmg: 9, hits: 3 },
      devour: { en: 'Devour', zh: '吞沒', dmg: 28 },
      crown: { en: 'Crown of Silence', zh: '寂靜之冠', ward: 30, might: 3 },
      unwrite: { en: 'Unwrite', zh: '逆寫', dmg: 14, exposed: 2 },
    },
    next: enemy => (enemy.hp < enemy.maxHp / 2
      ? ['crown', 'voidBeam', 'unwrite', 'devour'][enemy.turns % 4]
      : ['silence', 'voidBeam', 'devour', 'crown'][enemy.turns % 4]),
    phase2: { en: 'Crown of Silence', zh: '寂靜之冠', text: '無言之主戴上寂靜之冠：清除 Weak 與 Exposed，獲得 2 層 Might 和 25 Ward。', might: 2, ward: 25, cleanse: true },
  },
  // Second Act III boss: steals your Ward before it strikes, so read its intent.
  whisperThief: {
    en: 'The Whisper Thief', zh: '竊語者', hp: [270, 270], art: 'thief', boss: true,
    passive: '「竊取」會先偷走你全部的 Ward（其中一半變成牠的），再攻擊你。看到這個意圖時，改用攻擊應對！',
    moves: {
      muffle: { en: 'Muffle', zh: '封口', weak: 2, frail: 2, cards: [{ id: 'doubt', n: 1 }] },
      flurry: { en: 'Knife Flurry', zh: '亂刃', dmg: 6, hits: 4 },
      pilfer: { en: 'Pilfer', zh: '竊取', stealWard: true, dmg: 12 },
      hoard: { en: 'Hoard', zh: '囤積', ward: 22, might: 2 },
    },
    next: enemy => (enemy.hp < enemy.maxHp / 2
      ? ['pilfer', 'flurry', 'pilfer', 'hoard'][enemy.turns % 4]
      : ['muffle', 'flurry', 'pilfer', 'hoard'][enemy.turns % 4]),
    phase2: { en: 'Shadow Step', zh: '影遁', text: '竊語者躲進陰影：獲得 1 層 Might 和 20 Ward，並把 1 張 Doubt 塞進你的棄牌堆。', might: 1, ward: 20, cards: [{ id: 'doubt', n: 1 }] },
  },

  // ── Act IV · The Last Page (hidden; needs all three keys) ──
  gatekeeper: {
    en: 'The Gatekeeper', zh: '終頁守門人', hp: [170, 170], art: 'gate', elite: true,
    moves: {
      judgment: { en: 'Judgment', zh: '審判', dmg: 16, exposed: 1 },
      chains: { en: 'Chains', zh: '鎖鏈', dmg: 6, hits: 3, frail: 2 },
      seal: { en: 'Seal', zh: '封印', ward: 20, might: 2 },
    },
    next: cycle('judgment', 'chains', 'seal'),
  },
  lastSilence: {
    en: 'The Last Silence', zh: '終焉寂靜', hp: [380, 380], art: 'silence', boss: true, final: true,
    countdown: { move: 'oblivion', every: 5, en: 'Oblivion', tip: '每第 5 次行動，終焉寂靜會發動「永恆遺忘」造成巨大傷害！' },
    moves: {
      mute: { en: 'Mute the World', zh: '萬物噤聲', weak: 2, frail: 2, cards: [{ id: 'smudge', n: 2 }] },
      unmake: { en: 'Unmake', zh: '抹消', dmg: 10, hits: 2 },
      call: { en: 'Call the Echoes', zh: '召喚殘響', summon: [{ id: 'echoShade', n: 2 }] },
      erase: { en: 'Erase', zh: '擦除', dmg: 14, exposed: 2 },
      lastWord: { en: 'Last Word', zh: '最後一字', dmg: 7, hits: 4 },
      nothing: { en: 'Crown of Nothing', zh: '虛無之冠', ward: 30, might: 3 },
      oblivion: { en: 'Oblivion', zh: '永恆遺忘', dmg: 45 },
    },
    next: enemy => {
      if (enemy.turns % 5 === 4) return 'oblivion';
      const late = enemy.hp < enemy.maxHp / 2;
      return (late ? ['lastWord', 'call', 'nothing', 'erase'] : ['mute', 'unmake', 'call', 'erase'])[enemy.turns % 5];
    },
    phase2: { en: 'The Final Page', zh: '最後一頁', text: '終焉寂靜翻開最後一頁：召來兩道殘響，獲得 2 層 Might 和 25 Ward。', might: 2, ward: 25, summon: [{ id: 'echoShade', n: 2 }] },
  },
};

export const ENCOUNTERS = {
  1: {
    easy: [['inkling', 'inkling'], ['moth'], ['dustWisp', 'dustWisp', 'dustWisp'], ['candleImp', 'candleImp']],
    normal: [['bookworm'], ['inkling', 'moth'], ['moth', 'dustWisp', 'dustWisp'], ['bookworm', 'inkling'], ['inkling', 'inkling', 'inkling'], ['ribbonSerpent'], ['ribbonSerpent', 'candleImp'], ['candleImp', 'inkling', 'dustWisp']],
    elite: [['quillKnight'], ['librarian'], ['inkweaver']],
    bosses: [['hollowTome'], ['tentacle', 'inkKraken', 'tentacle']],
  },
  2: {
    easy: [['cogRat', 'cogRat'], ['sentinel'], ['rustMite', 'rustMite', 'rustMite'], ['springJack', 'cogRat']],
    normal: [['pendulum', 'rustMite'], ['sentinel', 'cogRat'], ['cogRat', 'cogRat', 'rustMite'], ['pendulum', 'cogRat'], ['oilSlick', 'springJack'], ['oilSlick', 'rustMite'], ['springJack', 'springJack']],
    elite: [['brassGolem'], ['twinGear', 'twinGear'], ['duelist']],
    bosses: [['clockwarden'], ['tick', 'tock']],
  },
  3: {
    easy: [['hushWraith'], ['echoShade', 'echoShade'], ['muteBell']],
    normal: [['gargoyle', 'echoShade'], ['hushWraith', 'echoShade'], ['gargoyle'], ['echoShade', 'echoShade', 'echoShade'], ['forgottenScribe', 'muteBell'], ['forgottenScribe', 'echoShade'], ['muteBell', 'hushWraith']],
    elite: [['veiledOracle'], ['silentKnight'], ['choir']],
    bosses: [['unspoken'], ['whisperThief']],
  },
  4: {
    easy: [['silentKnight']],
    normal: [['silentKnight']],
    elite: [['gatekeeper']],
    bosses: [['lastSilence']],
  },
};

// The enemy that stands for a boss encounter (on the map and in the records),
// and the name to show for it (twins share one title).
export const bossOf = encounter => encounter.find(id => ENEMIES[id]?.boss) || encounter[0];
export const bossName = encounter => { const def = ENEMIES[bossOf(encounter)]; return def.title || def; };

export const ACTS = {
  1: { en: 'The Whispering Stacks', zh: '低語書庫', roman: 'I', mood: '被寂靜侵蝕的書架之間，墨跡開始蠕動。' },
  2: { en: 'The Rusted Clockwork', zh: '鏽蝕鐘塔', roman: 'II', mood: '時間在這裡生鏽，每一聲滴答都是警告。' },
  3: { en: 'The Throne of Silence', zh: '靜默王座', roman: 'III', mood: '所有被遺忘的話語，都在王座下沉睡。' },
  4: { en: 'The Last Page', zh: '最後一頁', roman: 'IV', mood: '三把鑰匙同時發光。王座後方，一頁空白的紙正在等你寫下結局。' },
};

// Keys that open the hidden fourth act.
// Elite affixes: every elite fight gives its toughest foe one of these (two
// with the Champions trial). `values` grow with the act.
export const ELITE_AFFIXES = {
  armored: { en: 'Armored', zh: '鋼甲', glyph: 'shield', values: [7, 10, 13, 16], text: '開戰和每次行動前都獲得 {v} Ward。' },
  thorny: { en: 'Thorny', zh: '反刺', glyph: 'thorn', values: [2, 3, 4, 5], text: '帶著 {v} 層 Spikes：每次被攻擊都會反彈 {v} 傷害。' },
  swift: { en: 'Swift', zh: '迅捷', glyph: 'dash', text: '第一回合會連續行動兩次。' },
  vampiric: { en: 'Vampiric', zh: '吸血', glyph: 'leech', text: '攻擊造成的生命傷害，一半會回到牠身上。' },
  enraged: { en: 'Enraged', zh: '狂怒', glyph: 'wrath', values: [3, 4, 5, 6], text: '生命第一次掉到一半以下時，獲得 {v} 層 Might。' },
  splitting: { en: 'Splitting', zh: '分裂', glyph: 'burst', minions: { 1: 'inkling', 2: 'rustMite', 3: 'echoShade', 4: 'echoShade' }, text: '倒下時分裂出 2 隻小怪。' },
};
export const affixValue = (id, act) => ELITE_AFFIXES[id]?.values?.[Math.max(1, Math.min(4, act)) - 1] ?? 0;
export const affixText = (id, act) => ELITE_AFFIXES[id].text.replaceAll('{v}', String(affixValue(id, act)));

export const KEYS = {
  flame: { en: 'Flame Key', zh: '燭火之鑰', color: '#ffb35c', how: '在燈下休憩時取下（放棄休息或銘刻）' },
  page: { en: 'Page Key', zh: '書頁之鑰', color: '#9cc7ff', how: '打開寶箱時拿走（放棄寶箱裡的遺物）' },
  echo: { en: 'Echo Key', zh: '回聲之鑰', color: '#c39bff', how: '擊倒地圖上發出回聲的菁英' },
};
