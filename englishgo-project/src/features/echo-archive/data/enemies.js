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

  // ── Act II (other route) · The Drowned Stacks ──
  bubbleSprite: {
    en: 'Bubble Sprite', zh: '泡泡精', hp: [14, 18], art: 'bubble',
    moves: { pop: { en: 'Pop!', zh: '啵！', dmg: 7 }, froth: { en: 'Froth', zh: '吹泡泡', allyWard: 5 } },
    next: mix([['pop', 60], ['froth', 40]]),
  },
  pageCrab: {
    en: 'Page Crab', zh: '書頁蟹', hp: [26, 30], art: 'crab',
    moves: {
      pinch: { en: 'Pinch', zh: '夾擊', dmg: 4, hits: 2 },
      shell: { en: 'Shell Up', zh: '縮進殼裡', ward: 11 },
      snip: { en: 'Snip', zh: '剪頁', dmg: 8, frail: 1 },
    },
    next: cycle('pinch', 'shell', 'snip'),
  },
  drownedReader: {
    en: 'Drowned Reader', zh: '溺讀者', hp: [36, 40], art: 'reader',
    moves: {
      grasp: { en: 'Soggy Grasp', zh: '濕冷之握', dmg: 9 },
      mumble: { en: 'Mumble', zh: '喃喃自語', weak: 2, cards: [{ id: 'smudge', n: 1 }] },
      soak: { en: 'Soak', zh: '浸透', dmg: 6, heal: 6 },
    },
    next: mix([['grasp', 45], ['mumble', 25], ['soak', 30]]),
  },
  voltEel: {
    en: 'Volt Eel', zh: '電鰻', hp: [28, 32], art: 'eel',
    moves: { shock: { en: 'Shock', zh: '電擊', dmg: 3, hits: 3 }, charge: { en: 'Charge Up', zh: '蓄電', ward: 6, might: 1 } },
    next: mix([['shock', 60], ['charge', 40]]),
  },
  inkUrchin: {
    en: 'Ink Urchin', zh: '墨海膽', hp: [22, 26], art: 'urchin', start: { spikes: 2 },
    moves: { prick: { en: 'Prick', zh: '扎刺', dmg: 7 }, bristle: { en: 'Bristle', zh: '豎起尖刺', ward: 8, might: 1 } },
    next: cycle('prick', 'bristle'),
  },
  lanternJelly: {
    en: 'Lantern Jelly', zh: '燈水母', hp: [22, 26], art: 'jelly',
    moves: {
      sting: { en: 'Sting', zh: '螫刺', dmg: 5, frail: 2 },
      glow: { en: 'Glow', zh: '微光', allyWard: 7 },
      zap: { en: 'Zap', zh: '電光', dmg: 8 },
    },
    next: mix([['sting', 40], ['glow', 25], ['zap', 35]]),
  },
  reefWarden: {
    en: 'Reef Warden', zh: '珊瑚守衛', hp: [106, 112], art: 'reef', elite: true,
    moves: {
      coral: { en: 'Coral Armor', zh: '珊瑚甲', ward: 16, might: 2 },
      crash: { en: 'Reef Crash', zh: '礁石重擊', dmg: 21 },
      barnacle: { en: 'Barnacle Barrage', zh: '藤壺亂射', dmg: 7, hits: 2, exposed: 1 },
    },
    next: cycle('coral', 'crash', 'barnacle'),
  },
  sirenScholar: {
    en: 'Siren Scholar', zh: '海妖學者', hp: [88, 94], art: 'siren', elite: true,
    moves: {
      lullaby: { en: 'Lullaby', zh: '搖籃曲', weak: 2, frail: 2, cards: [{ id: 'doubt', n: 1 }] },
      aria: { en: 'Aria', zh: '詠嘆調', dmg: 6, hits: 3 },
      crescendo: { en: 'Crescendo', zh: '漸強', dmg: 13, grow: 3 },
    },
    next: cycle('lullaby', 'aria', 'crescendo'),
  },
  anglerFish: {
    en: 'Lamp Angler', zh: '燈籠魚', hp: [100, 106], art: 'angler', elite: true,
    moves: {
      lure: { en: 'Lure', zh: '誘光', exposed: 2, ward: 12 },
      chomp: { en: 'Chomp', zh: '大口咬下', dmg: 20 },
      nibble: { en: 'Nibble', zh: '輕咬', dmg: 6, hits: 2 },
    },
    next: cycle('lure', 'chomp', 'nibble'),
  },
  paperLeviathan: {
    en: 'The Paper Leviathan', zh: '紙鯨', hp: [195, 195], art: 'leviathan', boss: true,
    countdown: { move: 'tidalWave', every: 4, en: 'Tidal Wave', tip: '每第 4 次行動，紙鯨會掀起巨浪造成大量傷害，記得提前準備 Ward！' },
    moves: {
      spout: { en: 'Spout', zh: '噴泉', summon: [{ id: 'bubbleSprite', n: 1 }], ward: 10 },
      tailSlap: { en: 'Tail Slap', zh: '甩尾', dmg: 8, hits: 2 },
      swallow: { en: 'Swallow', zh: '吞噬', dmg: 13, cards: [{ id: 'smudge', n: 2 }] },
      tidalWave: { en: 'Tidal Wave', zh: '巨浪', dmg: 28 },
    },
    next: enemy => ['spout', 'tailSlap', 'swallow', 'tidalWave'][enemy.turns % 4],
    phase2: { en: 'Breach', zh: '破浪而出', text: '紙鯨衝出水面：清除 Weak 與 Exposed，獲得 2 層 Might 和 18 Ward。', might: 2, ward: 18, cleanse: true },
  },
  // Second Drowned boss: the captain hides behind his anchor until it breaks.
  ironAnchor: {
    en: 'Iron Anchor', zh: '鐵錨', hp: [32, 36], art: 'shipAnchor', minion: true,
    moves: { drag: { en: 'Drag Under', zh: '拖入水底', dmg: 6, frail: 1 }, brace: { en: 'Hold Fast', zh: '穩住', allyWard: 8 } },
    next: cycle('drag', 'brace'),
  },
  drownedCaptain: {
    en: 'The Drowned Captain', zh: '沉船船長', hp: [180, 180], art: 'captain', boss: true, guard: 'ironAnchor',
    passive: '鐵錨還在時，船長受到的傷害減半。先打倒鐵錨！鐵錨沉下去後，船長會花一回合重新拋錨。',
    moves: {
      cutlass: { en: 'Cutlass', zh: '彎刀連斬', dmg: 8, hits: 2 },
      broadside: { en: 'Broadside', zh: '舷砲齊射', dmg: 20 },
      shanty: { en: 'Sea Shanty', zh: '水手之歌', might: 2, ward: 10 },
      dropAnchor: { en: 'Drop Anchor', zh: '拋錨', summon: [{ id: 'ironAnchor', n: 1 }], ward: 8 },
    },
    next: (enemy, roll, { allies = [] } = {}) => {
      const anchored = allies.some(ally => ally.id === 'ironAnchor');
      if (enemy.turns > 0 && !anchored && enemy.history.at(-1) !== 'dropAnchor') return 'dropAnchor';
      return ['cutlass', 'broadside', 'shanty'][enemy.turns % 3];
    },
    phase2: { en: 'All Hands!', zh: '全員上甲板', text: '沉船船長吹響號角：清除 Weak 與 Exposed，獲得 2 層 Might 和 15 Ward。', might: 2, ward: 15, cleanse: true },
  },

  // ── Act III (other route) · The Starlit Observatory ──
  starMote: {
    en: 'Star Mote', zh: '星塵', hp: [18, 22], art: 'mote',
    moves: { twinkle: { en: 'Twinkle', zh: '閃爍', dmg: 7 }, flare: { en: 'Flare', zh: '耀斑', dmg: 3, burn: 2 } },
    next: mix([['twinkle', 60], ['flare', 40]]),
  },
  cometHound: {
    en: 'Comet Hound', zh: '彗星獵犬', hp: [40, 44], art: 'hound',
    moves: { pounce: { en: 'Pounce', zh: '飛撲', dmg: 7, hits: 2 }, howl: { en: 'Howl', zh: '星嚎', might: 2, ward: 8 } },
    next: mix([['pounce', 65], ['howl', 35]]),
  },
  orrerySentry: {
    en: 'Orrery Sentry', zh: '星儀哨兵', hp: [58, 64], art: 'orrery',
    moves: { align: { en: 'Align', zh: '行星連線', ward: 15, might: 2 }, beam: { en: 'Star Beam', zh: '星光射線', dmg: 17 } },
    next: cycle('align', 'beam'),
  },
  astroMage: {
    en: 'Astrolabe Mage', zh: '星盤術士', hp: [44, 48], art: 'astromage',
    moves: {
      chart: { en: 'Chart Fate', zh: '占星', exposed: 2, weak: 1 },
      bolt: { en: 'Star Bolt', zh: '星彈', dmg: 13 },
      mirror: { en: 'Mirror Sky', zh: '鏡空', allyWard: 9 },
    },
    next: mix([['bolt', 45], ['chart', 30], ['mirror', 25]]),
  },
  voidMoth: {
    en: 'Void Moth', zh: '虛空蛾', hp: [38, 42], art: 'voidMoth',
    moves: { dustWing: { en: 'Dust Wing', zh: '星塵之翼', dmg: 7, cards: [{ id: 'dust', n: 1 }] }, eclipseWing: { en: 'Eclipse Wing', zh: '蝕之翼', dmg: 5, hits: 2, frail: 1 } },
    next: mix([['dustWing', 50], ['eclipseWing', 50]]),
  },
  meteorImp: {
    en: 'Meteor Imp', zh: '隕石小鬼', hp: [30, 34], art: 'meteor',
    moves: { crash: { en: 'Crash Down', zh: '墜擊', dmg: 15 }, smolder: { en: 'Smolder', zh: '餘火', dmg: 5, burn: 3 } },
    next: mix([['crash', 50], ['smolder', 50]]),
  },
  greatBear: {
    en: 'The Great Bear', zh: '大熊星座', hp: [140, 146], art: 'bear', elite: true,
    moves: {
      roar: { en: 'Star Roar', zh: '星吼', weak: 2, might: 3 },
      maul: { en: 'Maul', zh: '熊掌連擊', dmg: 11, hits: 2 },
      starHide: { en: 'Star Hide', zh: '星之毛皮', ward: 22 },
    },
    next: enemy => ['roar', 'maul', 'starHide', 'maul'][enemy.turns % 4],
  },
  astronomer: {
    en: 'Clockwork Astronomer', zh: '機械天文學家', hp: [122, 128], art: 'astronomer', elite: true,
    moves: {
      observe: { en: 'Observe', zh: '觀測', summon: [{ id: 'starMote', n: 1 }], allyWard: 6 },
      lens: { en: 'Focus Lens', zh: '聚焦', dmg: 9, exposed: 2 },
      focus: { en: 'Sunbeam', zh: '日光束', dmg: 24 },
      calibrate: { en: 'Calibrate', zh: '校準', allyWard: 10, might: 2 },
    },
    next: enemy => (enemy.turns === 0 ? 'observe' : ['lens', 'focus', 'calibrate', 'observe'][(enemy.turns - 1) % 4]),
  },
  gravityKnight: {
    en: 'Gravity Knight', zh: '引力騎士', hp: [130, 136], art: 'gravity', elite: true,
    moves: {
      pull: { en: 'Gravity Pull', zh: '引力拉扯', dmg: 6, frail: 2, exposed: 2 },
      crush: { en: 'Moon Crush', zh: '月錘', dmg: 18 },
      orbit: { en: 'Orbit Guard', zh: '環繞護衛', ward: 18, might: 1 },
    },
    next: cycle('pull', 'crush', 'orbit'),
  },
  starEater: {
    en: 'The Star Eater', zh: '噬星者', hp: [285, 285], art: 'starEater', boss: true,
    countdown: { move: 'supernova', every: 4, en: 'Supernova', tip: '每第 4 次行動會引發超新星。場上每有一顆星塵，傷害就更高！' },
    passive: '每有一顆星塵在場，「超新星」的傷害 +6。趁早清掉星塵！',
    moves: {
      callStars: { en: 'Call the Stars', zh: '召星', summon: [{ id: 'starMote', n: 2 }], ward: 12 },
      starfall: { en: 'Starfall', zh: '星雨', dmg: 7, hits: 3 },
      gravity: { en: 'Crushing Gravity', zh: '重力壓制', weak: 2, frail: 2, cards: [{ id: 'dust', n: 2 }] },
      supernova: { en: 'Supernova', zh: '超新星', dmg: 34, perAlly: { id: 'starMote', dmg: 6 } },
    },
    next: enemy => ['callStars', 'starfall', 'gravity', 'supernova'][enemy.turns % 4],
    phase2: { en: 'Event Horizon', zh: '事件視界', text: '噬星者張開黑洞：清除 Weak 與 Exposed，召來 2 顆星塵，並獲得 2 層 Might。', might: 2, cleanse: true, summon: [{ id: 'starMote', n: 2 }] },
  },
  // Second Observatory boss: storms by day, shields by night.
  eclipseRegent: {
    en: 'The Eclipse Regent', zh: '日蝕攝政', hp: [275, 275], art: 'regent', boss: true,
    passive: '日蝕攝政在白晝與黑夜之間輪替：白晝時猛攻，黑夜時築起護盾並削弱你。黑夜是你進攻的好時機！',
    moves: {
      solarLance: { en: 'Solar Lance', zh: '日之槍', dmg: 12, hits: 2 },
      lunarVeil: { en: 'Lunar Veil', zh: '月之帷', ward: 26, weak: 2 },
      corona: { en: 'Corona', zh: '日冕', dmg: 9, burn: 4 },
      umbra: { en: 'Umbra', zh: '本影', frail: 2, exposed: 2, cards: [{ id: 'doubt', n: 1 }] },
      totality: { en: 'Totality', zh: '全蝕', dmg: 34 },
    },
    next: enemy => ['solarLance', 'lunarVeil', 'corona', 'umbra', enemy.phased ? 'totality' : 'solarLance', 'lunarVeil'][enemy.turns % 6],
    phase2: { en: 'Totality', zh: '全蝕降臨', text: '日蝕攝政讓日月重疊：清除 Weak 與 Exposed，獲得 2 層 Might 和 20 Ward，白晝的攻擊會變成「全蝕」。', might: 2, ward: 20, cleanse: true },
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
  drowned: {
    easy: [['bubbleSprite', 'bubbleSprite', 'bubbleSprite'], ['pageCrab'], ['inkUrchin', 'bubbleSprite'], ['voltEel']],
    normal: [['drownedReader', 'bubbleSprite'], ['pageCrab', 'inkUrchin'], ['lanternJelly', 'voltEel'], ['drownedReader', 'lanternJelly'], ['pageCrab', 'pageCrab'], ['voltEel', 'bubbleSprite'], ['lanternJelly', 'bubbleSprite']],
    elite: [['reefWarden'], ['sirenScholar', 'bubbleSprite'], ['anglerFish']],
    bosses: [['paperLeviathan'], ['ironAnchor', 'drownedCaptain']],
  },
  observatory: {
    easy: [['cometHound'], ['starMote', 'starMote', 'starMote'], ['meteorImp', 'starMote']],
    normal: [['orrerySentry', 'starMote'], ['cometHound', 'starMote'], ['astroMage', 'meteorImp'], ['voidMoth', 'cometHound'], ['orrerySentry'], ['astroMage', 'voidMoth'], ['meteorImp', 'meteorImp', 'starMote']],
    elite: [['greatBear'], ['astronomer'], ['gravityKnight']],
    bosses: [['starEater'], ['eclipseRegent']],
  },
};

// The enemy that stands for a boss encounter (on the map and in the records),
// and the name to show for it (twins share one title).
export const bossOf = encounter => encounter.find(id => ENEMIES[id]?.boss) || encounter[0];
export const bossName = encounter => { const def = ENEMIES[bossOf(encounter)]; return def.title || def; };

// Regions ("zones"). Acts II and III each have two: the original climb and a
// second route with its own foes, bosses and a differently shaped map. A run
// keeps its act number for scaling; `run.zone` names the other route.
export const ACTS = {
  1: { act: 1, en: 'The Whispering Stacks', zh: '低語書庫', roman: 'I', mood: '被寂靜侵蝕的書架之間，墨跡開始蠕動。' },
  2: { act: 2, en: 'The Rusted Clockwork', zh: '鏽蝕鐘塔', roman: 'II', mood: '時間在這裡生鏽，每一聲滴答都是警告。', glyph: 'gear', route: '往上爬進鐘塔：齒輪怪物、商人與熟悉的岔路。' },
  3: { act: 3, en: 'The Throne of Silence', zh: '靜默王座', roman: 'III', mood: '所有被遺忘的話語，都在王座下沉睡。', glyph: 'crown', route: '直上王座：寂靜的幽魂與無言之主。' },
  4: { act: 4, en: 'The Last Page', zh: '最後一頁', roman: 'IV', mood: '三把鑰匙同時發光。王座後方，一頁空白的紙正在等你寫下結局。' },
  drowned: { act: 2, en: 'The Drowned Stacks', zh: '沉沒書庫', roman: 'II', mood: '書庫的地下層早已沉入海中。往下潛吧，越深越暗，寶藏也越多。', glyph: 'drop', route: '往下潛進海底：地圖從上往下走，路比較窄。沒有商人，但有珍珠蚌送你寶物。' },
  observatory: { act: 3, en: 'The Starlit Observatory', zh: '星辰天文台', roman: 'III', mood: '塔頂的天文台漂浮在群星之間，星門連通著一座座浮島。', glyph: 'stars', route: '登上浮空的天文台：三座浮島由星橋相連，踏上星門可以直接跳到更高的島。' },
};
// The routes the player can pick after each boss (the first is the original).
export const ROUTES = { 2: [2, 'drowned'], 3: [3, 'observatory'] };
// The zone a run is in: its route for this act, or the act itself.
export const zoneOf = run => (run?.zone && ACTS[run.zone]?.act === run.act ? run.zone : run?.act || 1);

// Keys that open the hidden fourth act.
// Elite affixes: every elite fight gives its toughest foe one of these (two
// with the Champions trial). `values` grow with the act.
export const ELITE_AFFIXES = {
  armored: { en: 'Armored', zh: '鋼甲', glyph: 'shield', values: [7, 10, 13, 16], text: '開戰和每次行動前都獲得 {v} Ward。' },
  thorny: { en: 'Thorny', zh: '反刺', glyph: 'thorn', values: [2, 3, 4, 5], text: '帶著 {v} 層 Spikes：每次被攻擊都會反彈 {v} 傷害。' },
  swift: { en: 'Swift', zh: '迅捷', glyph: 'dash', text: '第一回合會連續行動兩次。' },
  vampiric: { en: 'Vampiric', zh: '吸血', glyph: 'leech', text: '攻擊造成的生命傷害，一半會回到牠身上。' },
  enraged: { en: 'Enraged', zh: '狂怒', glyph: 'wrath', values: [3, 4, 5, 6], text: '生命第一次掉到一半以下時，獲得 {v} 層 Might。' },
  splitting: { en: 'Splitting', zh: '分裂', glyph: 'burst', minions: { 1: 'inkling', 2: 'rustMite', 3: 'echoShade', 4: 'echoShade', drowned: 'bubbleSprite', observatory: 'starMote' }, text: '倒下時分裂出 2 隻小怪。' },
};
export const affixValue = (id, act) => ELITE_AFFIXES[id]?.values?.[Math.max(1, Math.min(4, act)) - 1] ?? 0;
export const affixText = (id, act) => ELITE_AFFIXES[id].text.replaceAll('{v}', String(affixValue(id, act)));

export const KEYS = {
  flame: { en: 'Flame Key', zh: '燭火之鑰', color: '#ffb35c', how: '在燈下休憩時取下（放棄休息或銘刻）' },
  page: { en: 'Page Key', zh: '書頁之鑰', color: '#9cc7ff', how: '打開寶箱時拿走（放棄寶箱裡的遺物）' },
  echo: { en: 'Echo Key', zh: '回聲之鑰', color: '#c39bff', how: '擊倒地圖上發出回聲的菁英' },
};
