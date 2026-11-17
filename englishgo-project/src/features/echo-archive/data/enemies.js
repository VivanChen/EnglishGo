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
  hollowTome: {
    en: 'The Hollow Tome', zh: '空白之書', hp: [124, 124], art: 'tome', boss: true,
    moves: {
      torrent: { en: 'Ink Torrent', zh: '墨流', dmg: 5, hits: 3 },
      erase: { en: 'Erase', zh: '抹除', dmg: 9, cards: [{ id: 'smudge', n: 2 }] },
      blank: { en: 'Blank Page', zh: '空白之頁', ward: 14, might: 1 },
      lastChapter: { en: 'Last Chapter', zh: '最終章', dmg: 22 },
    },
    next: enemy => (enemy.hp < enemy.maxHp / 2 && !enemy.uses?.lastChapter ? 'lastChapter' : ['torrent', 'erase', 'blank'][enemy.turns % 3]),
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
  clockwarden: {
    en: 'The Clockwarden', zh: '時之守衛', hp: [200, 200], art: 'clock', boss: true, countdown: 'midnight',
    moves: {
      tick: { en: 'Tick', zh: '滴', dmg: 7, hits: 2 },
      tock: { en: 'Tock', zh: '答', ward: 20, exposed: 2 },
      gears: { en: 'Grinding Gears', zh: '齒輪絞殺', dmg: 12, cards: [{ id: 'dust', n: 2 }] },
      midnight: { en: 'Midnight', zh: '午夜鐘響', dmg: 34 },
    },
    next: enemy => ['tick', 'tock', 'gears', 'midnight'][enemy.turns % 4],
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
  },
};

export const ENCOUNTERS = {
  1: {
    easy: [['inkling', 'inkling'], ['moth'], ['dustWisp', 'dustWisp', 'dustWisp']],
    normal: [['bookworm'], ['inkling', 'moth'], ['moth', 'dustWisp', 'dustWisp'], ['bookworm', 'inkling'], ['inkling', 'inkling', 'inkling']],
    elite: [['quillKnight'], ['librarian']],
    boss: ['hollowTome'],
  },
  2: {
    easy: [['cogRat', 'cogRat'], ['sentinel'], ['rustMite', 'rustMite', 'rustMite']],
    normal: [['pendulum', 'rustMite'], ['sentinel', 'cogRat'], ['cogRat', 'cogRat', 'rustMite'], ['pendulum', 'cogRat']],
    elite: [['brassGolem'], ['twinGear', 'twinGear']],
    boss: ['clockwarden'],
  },
  3: {
    easy: [['hushWraith'], ['echoShade', 'echoShade']],
    normal: [['gargoyle', 'echoShade'], ['hushWraith', 'echoShade'], ['gargoyle'], ['echoShade', 'echoShade', 'echoShade']],
    elite: [['veiledOracle'], ['silentKnight']],
    boss: ['unspoken'],
  },
};

export const ACTS = {
  1: { en: 'The Whispering Stacks', zh: '低語書庫', roman: 'I', mood: '被寂靜侵蝕的書架之間，墨跡開始蠕動。' },
  2: { en: 'The Rusted Clockwork', zh: '鏽蝕鐘塔', roman: 'II', mood: '時間在這裡生鏽，每一聲滴答都是警告。' },
  3: { en: 'The Throne of Silence', zh: '靜默王座', roman: 'III', mood: '所有被遺忘的話語，都在王座下沉睡。' },
};
