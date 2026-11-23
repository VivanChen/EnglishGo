// Story encounters. English leads, the Chinese line sits right below it.
// Effects are resolved by the run engine (see applyOutcome in engine.js).
//
// A choice can do more than apply effects once:
//   outcomes: [{ w, effects, result, goto }]  a weighted random result
//   branch: { flag, yes, no }                 decided by a flag rolled when the
//                                             event starts (`roll: { flag: % }`)
//   goto: 'stage'                             moves to another page of the event
//   game: 'memory' | 'echo' | 'duel'          starts a small game; `rewards`
//                                             turns its score into effects
// Events with `game: 'climb'` or `game: 'wheel'` build their own choices.

// Short-lived blessings (and one omen) that events hand out. Each lasts for
// the next few fights and shows in the top bar until it runs out.
export const BOONS = {
  sun: { en: 'Sunlit Ink', zh: '日光墨', glyph: 'sun', fights: 3, text: '戰鬥開始時獲得 2 層 Might。' },
  moon: { en: 'Moon Veil', zh: '月之紗', glyph: 'moon', fights: 3, text: '戰鬥的第一回合獲得 8 Ward。' },
  star: { en: 'Star Map', zh: '星圖', glyph: 'stars', fights: 3, text: '戰鬥的第一回合多抽 2 張牌。' },
  comet: { en: 'Comet Tea', zh: '彗星茶', glyph: 'comet', fights: 2, text: '戰鬥的第一回合多 1 點能量。' },
  omen: { en: 'Tower Omen', zh: '高塔凶兆', glyph: 'tower', fights: 1, bad: true, text: '敵人開始戰鬥時獲得 1 層 Might。' },
};

export const DUEL_MOVES = {
  sword: { en: 'Sword', zh: '劍', glyph: 'slash', beats: 'scroll' },
  shield: { en: 'Shield', zh: '盾', glyph: 'shield', beats: 'sword' },
  scroll: { en: 'Scroll', zh: '卷軸', glyph: 'pages', beats: 'shield' },
};

export const KEEPER = {
  id: 'keeper', art: 'lantern',
  title: { en: 'The Lantern Keeper', zh: '守燈人' },
  body: {
    en: 'At the foot of the Archive, an old keeper lifts her lantern. "The silence is spreading. Take a gift before you climb."',
    zh: '書庫入口，年老的守燈人舉起提燈：「寂靜正在蔓延。出發前，帶走一份禮物吧。」',
  },
  choices: [
    { en: 'Taste the moon peach', zh: '嚐一口月光桃', note: '最大生命 +8', effects: [{ op: 'maxHp', v: 8 }], result: { en: 'Warmth fills your chest.', zh: '一股暖意充滿胸口。' } },
    { en: 'Open the old satchel', zh: '打開舊背包', note: '從 3 張卡中選 1 張', effects: [{ op: 'cardChoice', rarity: 'uncommon' }] },
    { en: 'Burn a faded page', zh: '燒掉褪色的書頁', note: '從牌組移除 1 張牌', effects: [{ op: 'remove' }] },
    { en: 'Take the coin purse', zh: '收下錢袋', note: '獲得 100 金幣', effects: [{ op: 'gold', v: 100 }], result: { en: 'The coins are cold and bright.', zh: '錢幣冰涼又閃亮。' } },
  ],
};

export const EVENTS = {
  mirror: {
    acts: [1, 2, 3], art: 'mirror',
    title: { en: 'The Whispering Mirror', zh: '低語之鏡' },
    body: { en: 'In the dark glass, another you smiles. "Give me one memory," it whispers, "and I will keep it safe."', zh: '漆黑的鏡中，另一個你微笑著：「給我一段記憶，我會好好保管。」' },
    choices: [
      { en: 'Give a memory', zh: '交出一段記憶', note: '移除 1 張牌', effects: [{ op: 'remove' }], result: { en: 'The mirror ripples like water, then goes still.', zh: '鏡面像水一樣泛起漣漪，然後歸於平靜。' } },
      { en: 'Smash the mirror', zh: '打碎鏡子', note: '獲得 60 金幣，加入詛咒 Regret', effects: [{ op: 'gold', v: 60 }, { op: 'curse', id: 'regret' }], result: { en: 'Silver shards fall like coins. Something sad follows you.', zh: '銀色碎片像錢幣般落下，某種悲傷跟上了你。' } },
      { en: 'Walk away', zh: '轉身離開', note: '什麼也不發生', effects: [], result: { en: 'You do not look back.', zh: '你沒有回頭。' } },
    ],
  },
  fountain: {
    acts: [1, 2, 3], art: 'fountain',
    title: { en: 'The Ink Fountain', zh: '墨泉' },
    body: { en: 'A fountain of silver ink hums softly. Old spells swim beneath the surface.', zh: '銀色墨泉輕聲低鳴，古老的咒語在水面下游動。' },
    choices: [
      { en: 'Drink deeply', zh: '大口喝下', note: '回復 25% 最大生命', effects: [{ op: 'healPct', v: 25 }], result: { en: 'The ink tastes like rain and starlight.', zh: '墨水嚐起來像雨水與星光。' } },
      { en: 'Dip your quill', zh: '沾一沾羽筆', note: '失去 6 生命，升級 1 張牌', req: { hp: 7 }, effects: [{ op: 'hurt', v: 6 }, { op: 'upgrade' }], result: { en: 'Your words glow a little brighter.', zh: '你的文字變得更明亮了。' } },
      { en: 'Leave', zh: '離開', note: '什麼也不發生', effects: [], result: { en: 'The humming fades behind you.', zh: '低鳴聲在身後漸漸消失。' } },
    ],
  },
  riddle: {
    acts: [1, 2, 3], art: 'door', riddle: true,
    title: { en: 'The Riddle Door', zh: '謎語之門' },
    body: { en: 'A stone door with a sleepy face yawns. "Answer my riddle, traveler, and I will open."', zh: '一扇長著睡臉的石門打了個呵欠：「旅人，答對我的謎語，我就為你開門。」' },
    riddles: [
      { q: { en: 'I have hands, but I cannot clap. What am I?', zh: '我有「手」，卻不能拍手。我是什麼？' }, options: [{ en: 'A clock', zh: '時鐘', ok: true }, { en: 'A tree', zh: '一棵樹' }, { en: 'A glove', zh: '手套' }] },
      { q: { en: 'I have a spine, but no bones. What am I?', zh: '我有「書背（脊椎）」，卻沒有骨頭。我是什麼？' }, options: [{ en: 'A fish', zh: '魚' }, { en: 'A book', zh: '一本書', ok: true }, { en: 'A cat', zh: '貓' }] },
      { q: { en: 'What has many keys but cannot open a door?', zh: '什麼東西有很多「鍵」，卻打不開任何一扇門？' }, options: [{ en: 'A map', zh: '地圖' }, { en: 'A box', zh: '箱子' }, { en: 'A piano', zh: '鋼琴', ok: true }] },
      { q: { en: 'What gets wetter the more it dries?', zh: '什麼東西越擦乾別人，自己就越濕？' }, options: [{ en: 'A towel', zh: '毛巾', ok: true }, { en: 'The sun', zh: '太陽' }, { en: 'A fish', zh: '魚' }] },
      { q: { en: 'What can you catch, but not throw?', zh: '什麼東西可以「抓到」，卻不能丟出去？' }, options: [{ en: 'A ball', zh: '球' }, { en: 'A cold', zh: '感冒', ok: true }, { en: 'A frog', zh: '青蛙' }] },
      { q: { en: 'What has one eye, but cannot see?', zh: '什麼東西有一隻「眼」，卻看不見？' }, options: [{ en: 'A needle', zh: '針', ok: true }, { en: 'A pirate', zh: '海盜' }, { en: 'An owl', zh: '貓頭鷹' }] },
    ],
    correct: { effects: [{ op: 'relic', tier: 'uncommon' }], result: { en: '"Clever!" The door swings open. A treasure waits inside.', zh: '「真聰明！」石門敞開，裡面藏著寶物。' } },
    wrong: { effects: [{ op: 'hurt', v: 6 }], result: { en: '"Wrong!" The door sneezes a cloud of stone dust at you.', zh: '「答錯了！」石門對你打了個滿是石粉的噴嚏。' } },
    leave: { en: 'Walk away', zh: '轉身離開', note: '什麼也不發生', effects: [], result: { en: 'The door goes back to sleep.', zh: '石門又睡著了。' } },
  },
  bard: {
    acts: [1, 2, 3], art: 'lute',
    title: { en: 'The Wandering Bard', zh: '流浪詩人' },
    body: { en: 'A bard with a cracked lute sings about words that refused to be forgotten.', zh: '抱著破舊魯特琴的詩人，唱著不願被遺忘的話語。' },
    choices: [
      { en: 'Listen quietly', zh: '靜靜聆聽', note: '回復 12 生命', effects: [{ op: 'heal', v: 12 }], result: { en: 'The song feels like a warm blanket.', zh: '這首歌像一條溫暖的毯子。' } },
      { en: 'Sing along', zh: '跟著一起唱', note: '獲得 1 張隨機 Chant 牌', effects: [{ op: 'chantCard' }], result: { en: 'Your voice joins hers. A new spell is born.', zh: '你的歌聲與她交織，一道新的咒語誕生了。' } },
      { en: 'Pay for a potion (40 gold)', zh: '付 40 金幣買藥劑', note: '獲得 1 瓶隨機藥劑', req: { gold: 40 }, effects: [{ op: 'gold', v: -40 }, { op: 'potion' }], result: { en: '"For the road," she winks.', zh: '「路上用吧。」她眨了眨眼。' } },
    ],
  },
  statue: {
    acts: [1, 2, 3], art: 'statue',
    title: { en: 'The Gilded Statue', zh: '鍍金雕像' },
    body: { en: 'A golden statue holds out a glowing gem. Its eyes seem to follow you.', zh: '金色雕像遞出一顆發光的寶石，它的眼睛似乎一直盯著你。' },
    choices: [
      { en: 'Take the gem', zh: '拿走寶石', note: '獲得 150 金幣，加入詛咒 Regret', effects: [{ op: 'gold', v: 150 }, { op: 'curse', id: 'regret' }], result: { en: 'The statue frowns. You feel a little heavier.', zh: '雕像皺起眉頭，你覺得心裡沉了一些。' } },
      { en: 'Polish the statue', zh: '幫雕像擦亮', note: '失去 5 生命，獲得 1 件遺物', req: { hp: 6 }, effects: [{ op: 'hurt', v: 5 }, { op: 'relic', tier: 'common' }], result: { en: 'It smiles and drops a small gift into your hand.', zh: '雕像露出微笑，把一份小禮物放進你手中。' } },
      { en: 'Leave', zh: '離開', note: '什麼也不發生', effects: [], result: { en: 'Its eyes follow you down the hall.', zh: '它的目光一路目送你走過長廊。' } },
    ],
  },
  binder: {
    acts: [1, 2, 3], art: 'binder',
    title: { en: 'The Old Bookbinder', zh: '老裝訂師' },
    body: { en: '"Torn pages, loose threads..." mutters the bookbinder. "Let me fix one of your cards."', zh: '「破掉的頁、鬆掉的線……」老裝訂師喃喃自語：「讓我修一張你的牌吧。」' },
    choices: [
      { en: 'Mend a card', zh: '修補一張牌', note: '升級 1 張牌', effects: [{ op: 'upgrade' }], result: { en: '"Good as new. Better, even."', zh: '「跟新的一樣，甚至更好。」' } },
      { en: 'Rebind everything (50 gold)', zh: '全部重新裝訂（50 金幣）', note: '隨機升級 2 張牌', req: { gold: 50 }, effects: [{ op: 'gold', v: -50 }, { op: 'upgradeRandom', v: 2 }], result: { en: 'Fresh thread, fresh spells.', zh: '新的縫線，新的咒語。' } },
      { en: 'Say goodbye', zh: '道別', note: '什麼也不發生', effects: [], result: { en: 'He waves without looking up.', zh: '他頭也不抬地揮了揮手。' } },
    ],
  },
  candle: {
    acts: [2, 3], art: 'candle',
    title: { en: 'The Candle of Memory', zh: '記憶之燭' },
    body: { en: 'A blue flame dances on a tall candle. Inside it, you see spells that were almost forgotten.', zh: '高高的蠟燭上跳動著藍色火焰，火光中浮現幾乎被遺忘的咒語。' },
    choices: [
      { en: 'Reach into the flame', zh: '把手伸進火焰', note: '失去 8 生命，從 3 張傳說卡中選 1 張', req: { hp: 9 }, effects: [{ op: 'hurt', v: 8 }, { op: 'cardChoice', rarity: 'rare' }] },
      { en: 'Warm your hands', zh: '暖暖手', note: '回復 10 生命', effects: [{ op: 'heal', v: 10 }], result: { en: 'The cold of the tower leaves your fingers.', zh: '高塔的寒意離開了你的指尖。' } },
      { en: 'Blow it out', zh: '吹熄蠟燭', note: '什麼也不發生', effects: [], result: { en: 'Darkness, and a thin line of smoke.', zh: '黑暗中，只剩一縷細煙。' } },
    ],
  },
  guardian: {
    acts: [2, 3], art: 'guardian',
    title: { en: 'The Sleeping Guardian', zh: '沉睡的守衛' },
    body: { en: 'A stone guardian sleeps on a pile of treasure. It snores like a small earthquake.', zh: '石像守衛睡在一堆寶物上，打呼聲像一場小地震。' },
    choices: [
      { en: 'Wake it and fight', zh: '叫醒它，正面對決', note: '戰鬥，勝利可得遺物', effects: [{ op: 'fight', encounter: ['gargoyle'], kind: 'elite' }] },
      { en: 'Sneak a few coins', zh: '偷偷拿幾枚金幣', note: '獲得 45 金幣，失去 4 生命', req: { hp: 5 }, effects: [{ op: 'gold', v: 45 }, { op: 'hurt', v: 4 }], result: { en: 'A pebble falls on your head. Worth it.', zh: '一顆小石頭砸到你的頭——值得。' } },
      { en: 'Tiptoe past', zh: '躡手躡腳地離開', note: '什麼也不發生', effects: [], result: { en: 'The snoring continues.', zh: '打呼聲還在繼續。' } },
    ],
  },
  scriptorium: {
    acts: [1, 2], art: 'quill',
    title: { en: 'The Busy Scriptorium', zh: '忙碌的抄寫室' },
    body: { en: 'Monks with ink-stained fingers copy books by candlelight. "We can copy anything," one says, "even a spell."', zh: '手指沾滿墨水的修士在燭光下抄書。其中一人說：「我們什麼都能抄，連咒語也行。」' },
    choices: [
      { en: 'Copy a spell (40 gold)', zh: '抄寫一道咒語（40 金幣）', note: '複製牌組中的 1 張牌', req: { gold: 40 }, effects: [{ op: 'gold', v: -40 }, { op: 'duplicate' }], result: { en: 'The copy is perfect, down to the last smudge.', zh: '抄本完美無缺，連最後一點墨漬都一模一樣。' } },
      { en: 'Lend a hand', zh: '幫忙抄寫', note: '失去 5 生命，隨機升級 1 張牌，獲得 30 金幣', req: { hp: 6 }, effects: [{ op: 'hurt', v: 5 }, { op: 'upgradeRandom', v: 1 }, { op: 'gold', v: 30 }], result: { en: 'Your hand aches, but your spells feel sharper.', zh: '你的手很痠，但咒語變得更鋒利了。' } },
      { en: 'Leave quietly', zh: '悄悄離開', note: '什麼也不發生', effects: [], result: { en: 'The scratching of quills follows you out.', zh: '羽筆的沙沙聲一路跟著你出去。' } },
    ],
  },
  wishingWell: {
    acts: [1, 2, 3], art: 'well',
    title: { en: 'The Wishing Well', zh: '許願井' },
    body: { en: 'A well full of glowing coins. A small sign says: "One coin, one wish. Maybe."', zh: '一口裝滿發光錢幣的井，旁邊的小牌子寫著：「一枚錢幣，一個願望。大概吧。」' },
    choices: [
      { en: 'Toss a coin (30 gold)', zh: '丟一枚金幣（30 金幣）', note: '一半機率得到 1 件遺物', req: { gold: 30 }, effects: [{ op: 'gold', v: -30 }, { op: 'chance', p: 50, then: [{ op: 'relic', tier: 'common' }] }], result: { en: 'The coin sinks. The water glows... or does it?', zh: '金幣沉了下去。水面亮了一下……真的嗎？' } },
      { en: 'Drink the water', zh: '喝一口井水', note: '回復 15 生命', effects: [{ op: 'heal', v: 15 }], result: { en: 'It tastes like copper and moonlight.', zh: '嚐起來像銅幣和月光。' } },
      { en: 'Walk on', zh: '繼續前進', note: '什麼也不發生', effects: [], result: { en: 'Wishes can wait.', zh: '願望可以等一等。' } },
    ],
  },
  lostScholar: {
    acts: [1, 2, 3], art: 'scholar',
    title: { en: 'The Lost Scholar', zh: '迷路的學者' },
    body: { en: '"Excuse me, which way is the exit?" A scholar is lost among the shelves, holding a tall stack of notes.', zh: '「不好意思，請問出口在哪裡？」一位學者抱著一大疊筆記，在書架間迷了路。' },
    choices: [
      { en: 'Show him the way', zh: '為他指路', note: '獲得 1 張隨機 Chant 牌', effects: [{ op: 'chantCard' }], result: { en: '"Thank you, friend! Please, take one of my spells."', zh: '「謝謝你，朋友！請收下我的一道咒語。」' } },
      { en: 'Trade notes', zh: '交換筆記', note: '移除 1 張牌，獲得 50 金幣', effects: [{ op: 'remove' }, { op: 'gold', v: 50 }], result: { en: 'He pays well for your old page.', zh: '他為你的舊書頁付了不錯的價錢。' } },
      { en: 'Keep walking', zh: '繼續趕路', note: '什麼也不發生', effects: [], result: { en: 'You hear him asking a bookshelf for directions.', zh: '你聽見他在向一座書架問路。' } },
    ],
  },
  emberAltar: {
    acts: [2, 3], art: 'altar',
    title: { en: 'The Ember Altar', zh: '餘燼祭壇' },
    body: { en: 'An altar of warm black stone. Cards placed on it burn away, and something new rises from the ashes.', zh: '一座溫熱的黑石祭壇。放上去的牌會燒成灰，再從灰燼中升起新的東西。' },
    choices: [
      { en: 'Offer a card', zh: '獻上一張牌', note: '把 1 張牌變成隨機的另一張牌，較容易是稀有卡', effects: [{ op: 'transform' }], result: { en: 'The ashes swirl and take a new shape.', zh: '灰燼旋轉著，化成了新的形狀。' } },
      { en: 'Offer your blood', zh: '獻上鮮血', note: '失去 10 生命，獲得 1 件稀有遺物', req: { hp: 11 }, effects: [{ op: 'hurt', v: 10 }, { op: 'relic', tier: 'uncommon' }], result: { en: 'The altar drinks, and gives something back.', zh: '祭壇喝下了鮮血，回贈你一樣東西。' } },
      { en: 'Step back', zh: '退後一步', note: '什麼也不發生', effects: [], result: { en: 'The embers sigh and dim.', zh: '餘燼輕嘆一聲，暗了下去。' } },
    ],
  },
  tinker: {
    acts: [2], home: 2, art: 'gear',
    title: { en: "The Tinker's Stall", zh: '修鐘匠的攤子' },
    body: { en: 'A tiny tinker sits among a thousand ticking parts. "Trade? Fix? Both?"', zh: '一位小小的修鐘匠坐在上千個滴答作響的零件中間：「交易？修理？還是都要？」' },
    choices: [
      { en: 'Sell a potion', zh: '賣掉一瓶藥劑', note: '失去 1 瓶藥劑，獲得 75 金幣', req: { potion: true }, effects: [{ op: 'losePotion' }, { op: 'gold', v: 75 }], result: { en: '"Fine glass, fine color. Sold!"', zh: '「好瓶子、好顏色。成交！」' } },
      { en: 'Tune your deck (60 gold)', zh: '調校牌組（60 金幣）', note: '隨機升級 2 張牌', req: { gold: 60 }, effects: [{ op: 'gold', v: -60 }, { op: 'upgradeRandom', v: 2 }], result: { en: 'Click, whirr, ding. Good as new.', zh: '喀、嗡、叮。跟新的一樣。' } },
      { en: 'Leave', zh: '離開', note: '什麼也不發生', effects: [], result: { en: 'Tick, tick, tick...', zh: '滴答、滴答、滴答……' } },
    ],
  },
  silentChoir: {
    acts: [3], home: 3, art: 'choir',
    title: { en: 'The Silent Choir', zh: '無聲合唱' },
    body: { en: 'Pale singers open their mouths, but no sound comes out. Their hymnbook glows on a stand.', zh: '蒼白的歌者張開嘴，卻發不出任何聲音。他們的聖歌集在架子上發著光。' },
    choices: [
      { en: 'Sing for them', zh: '為他們歌唱', note: '最大生命 +6', effects: [{ op: 'speak', text: 'Every voice deserves a song.' }, { op: 'maxHp', v: 6 }], result: { en: 'For a moment, they sing along. You feel lighter.', zh: '有那麼一刻，他們跟著你一起唱。你覺得輕盈多了。' } },
      { en: 'Take the hymnbook', zh: '拿走聖歌集', note: '獲得 1 件遺物，加入詛咒 Doubt', effects: [{ op: 'relic' }, { op: 'curse', id: 'doubt' }], result: { en: 'The book is warm. The silence behind you is cold.', zh: '書本很溫暖，身後的寂靜卻冰冷。' } },
      { en: 'Leave', zh: '離開', note: '什麼也不發生', effects: [], result: { en: 'You leave them to their quiet song.', zh: '你讓他們繼續唱那首安靜的歌。' } },
    ],
  },
  page: {
    acts: [1, 2], art: 'page',
    title: { en: 'A Forgotten Page', zh: '遺落的書頁' },
    body: { en: 'A torn page drifts down from above. It reads: "Brave words cut deeper than swords."', zh: '一張撕破的書頁從上方飄落，上面寫著：「勇敢的話語，比劍更鋒利。」' },
    choices: [
      { en: 'Keep the page', zh: '收下書頁', note: '獲得 1 張隨機稀有攻擊牌', effects: [{ op: 'randomCard', rarity: 'uncommon', type: 'attack' }], result: { en: 'The words fold into a new card.', zh: '文字摺成了一張新的牌。' } },
      { en: 'Read it aloud', zh: '大聲唸出來', note: '最大生命 +4', effects: [{ op: 'speak', text: 'Brave words cut deeper than swords.' }, { op: 'maxHp', v: 4 }], result: { en: 'Your voice echoes through the shelves. You feel stronger.', zh: '你的聲音在書架間迴盪，你覺得自己更強壯了。' } },
    ],
  },

  // ── Games and gambles ──
  tower: {
    acts: [1, 2, 3], art: 'tower', game: 'climb',
    title: { en: 'The Teetering Tower', zh: '搖晃的書塔' },
    body: { en: 'A tower of books wobbles up into the dark. Coins glint on every ledge. The higher you climb, the more it sways.', zh: '一座書塔搖搖晃晃地伸進黑暗，每一層都閃著錢幣的光。爬得越高，它晃得越厲害。' },
    climb: { loot: [25, 30, 40, 50, 60], fall: [0, 15, 30, 45, 60], hurt: 6 },
    results: {
      fall: { en: 'Crash! Books rain down, and the coins scatter into the dark.', zh: '嘩啦！書本像雨一樣落下，錢幣全滾進了黑暗裡。' },
      down: { en: 'You climb down slowly, pockets jingling.', zh: '你慢慢爬下來，口袋叮噹作響。' },
      top: { en: 'At the very top, a tiny chest waits just for you.', zh: '在塔頂，一個小寶箱正等著你。' },
      leave: { en: 'You let the tower sway on without you.', zh: '你決定讓書塔自己去晃吧。' },
    },
  },
  matching: {
    acts: [1, 2, 3], art: 'matching',
    title: { en: "The Librarian's Card Game", zh: '館長的翻牌遊戲' },
    body: { en: 'A ghost librarian deals eight cards face down. "Turn two at a time. Match each word with its meaning, and I shall reward you."', zh: '幽靈館長把八張牌蓋在桌上：「一次翻兩張，把單字和它的意思配成一對，我就給你獎勵。」' },
    choices: [
      { en: 'Play a round', zh: '玩一局', note: '配對越多獎勵越好，翻錯 5 次就結束', game: 'memory' },
      { en: 'Just have tea with her', zh: '陪她喝杯茶', note: '回復 10 生命', effects: [{ op: 'heal', v: 10 }], result: { en: '"Rest your eyes, then." She pours you a cup that never cools.', zh: '「那就讓眼睛休息一下吧。」她為你倒了一杯永遠不會變涼的茶。' } },
    ],
    rewards: [
      { min: 4, effects: [{ op: 'relic', tier: 'common' }, { op: 'gold', v: 20 }], result: { en: '"A perfect memory!" She hands you a treasure from her drawer.', zh: '「完美的記性！」她從抽屜裡拿出一件寶物送你。' } },
      { min: 3, effects: [{ op: 'upgradeRandom', v: 1 }, { op: 'gold', v: 30 }], result: { en: '"Very good." Your cards shimmer a little.', zh: '「很好。」你的牌閃了一下光。' } },
      { min: 1, effects: [{ op: 'gold', v: 30 }], result: { en: '"Not bad at all. Here, for the road."', zh: '「還不錯。拿去當路費吧。」' } },
      { min: 0, effects: [{ op: 'gold', v: 10 }], result: { en: '"Words are slippery things," she laughs.', zh: '「文字可是滑溜溜的呢。」她笑著說。' } },
    ],
  },
  echoHall: {
    acts: [1, 2, 3], art: 'echoHall',
    title: { en: 'The Hall of Echoes', zh: '回聲長廊' },
    body: { en: 'Every word spoken here comes back three times. The echoes love games: "Which word did we whisper?"', zh: '在這裡說的每一句話都會回來三次。回聲最愛玩遊戲：「我們剛剛悄悄說了哪個字？」' },
    choices: [
      { en: 'Play their game', zh: '陪回聲玩', note: '聽 3 次，選出聽到的英文字', game: 'echo' },
      { en: 'Shout your own name', zh: '大喊自己的名字', note: '最大生命 +3', effects: [{ op: 'maxHp', v: 3 }], result: { en: 'Your name rings down the hall, loud and proud.', zh: '你的名字在長廊裡迴盪，響亮又驕傲。' } },
    ],
    rewards: [
      { min: 3, effects: [{ op: 'upgrade' }, { op: 'boon', id: 'star' }], result: { en: '"Perfect ears!" The echoes gift you a clear mind.', zh: '「好靈的耳朵！」回聲送你一份清晰的思緒。' } },
      { min: 2, effects: [{ op: 'upgradeRandom', v: 1 }], result: { en: '"Almost!" One of your spells hums along.', zh: '「差一點點！」你的一道咒語跟著哼起歌來。' } },
      { min: 1, effects: [{ op: 'gold', v: 25 }], result: { en: 'The echoes toss you a few coins for trying.', zh: '回聲丟給你幾枚錢幣，謝謝你陪它們玩。' } },
      { min: 0, effects: [{ op: 'heal', v: 5 }], result: { en: 'The echoes giggle, again and again and again.', zh: '回聲咯咯笑著，一次、又一次、再一次。' } },
    ],
  },
  fortuneTeller: {
    acts: [1, 2, 3], art: 'fortuneTeller',
    title: { en: 'The Moth Fortune Teller', zh: '飛蛾占卜師' },
    body: { en: 'A moth in a lace shawl shuffles three glowing cards. "Sun, Moon or Star... or something darker. Shall we see?"', zh: '披著蕾絲披肩的飛蛾洗著三張發光的牌：「太陽、月亮、星星……或是更黑暗的東西。要看看嗎？」' },
    choices: [
      { en: 'Draw a card', zh: '抽一張牌', note: '隨機得到一個祝福，也可能是凶兆', outcomes: [
        { w: 30, effects: [{ op: 'boon', id: 'sun' }], result: { en: 'The Sun! Warmth runs down your arms.', zh: '是太陽！一股暖流湧進你的手臂。' } },
        { w: 30, effects: [{ op: 'boon', id: 'moon' }], result: { en: 'The Moon. A silver veil settles over you.', zh: '是月亮。一層銀色薄紗落在你身上。' } },
        { w: 25, effects: [{ op: 'boon', id: 'star' }], result: { en: 'The Star. Your thoughts feel quick and clear.', zh: '是星星。你的思緒變得又快又清楚。' } },
        { w: 15, effects: [{ op: 'boon', id: 'omen' }, { op: 'gold', v: 60 }], result: { en: 'The Tower... She winces, and slips you some coins "for luck".', zh: '是高塔……她皺了皺眉，偷偷塞給你一些錢幣「討個吉利」。' } },
      ] },
      { en: 'Pay to choose (45 gold)', zh: '付錢自己挑（45 金幣）', note: '從三個祝福中選一個', req: { gold: 45 }, effects: [{ op: 'gold', v: -45 }], goto: 'choose' },
    ],
    stages: {
      choose: {
        body: { en: '"A careful traveler. Pick your fate, then."', zh: '「真是謹慎的旅人。那就自己挑選命運吧。」' },
        choices: [
          { en: 'The Sun', zh: '太陽', note: '接下來 3 場戰鬥開始時獲得 2 層 Might', effects: [{ op: 'boon', id: 'sun' }], result: { en: 'Warmth runs down your arms.', zh: '一股暖流湧進你的手臂。' } },
          { en: 'The Moon', zh: '月亮', note: '接下來 3 場戰鬥的第一回合獲得 8 Ward', effects: [{ op: 'boon', id: 'moon' }], result: { en: 'A silver veil settles over you.', zh: '一層銀色薄紗落在你身上。' } },
          { en: 'The Star', zh: '星星', note: '接下來 3 場戰鬥的第一回合多抽 2 張牌', effects: [{ op: 'boon', id: 'star' }], result: { en: 'Your thoughts feel quick and clear.', zh: '你的思緒變得又快又清楚。' } },
        ],
      },
    },
  },
  mimicChest: {
    acts: [2, 3], art: 'mimicChest', roll: { mimic: 50 },
    title: { en: 'The Grinning Chest', zh: '咧嘴笑的寶箱' },
    body: { en: 'A treasure chest sits alone in the corner. Is it smiling at you? Chests do not smile. Probably.', zh: '角落裡孤零零地放著一個寶箱。它是不是在對你笑？寶箱不會笑的。大概吧。' },
    choices: [
      { en: 'Open it', zh: '直接打開', note: '可能是寶物，也可能是陷阱', branch: { flag: 'mimic',
        yes: { effects: [{ op: 'fight', encounter: ['springJack', 'springJack'], kind: 'elite' }] },
        no: { effects: [{ op: 'relic' }, { op: 'gold', v: 40 }], result: { en: 'Real treasure, real gold!', zh: '真的寶物，真的金子！' } } } },
      { en: 'Poke it with your quill', zh: '用羽筆戳一戳', note: '失去 3 生命，先看清楚再決定', req: { hp: 4 }, effects: [{ op: 'hurt', v: 3 }], branch: { flag: 'mimic', yes: { goto: 'growl' }, no: { goto: 'safe' } } },
    ],
    stages: {
      growl: {
        body: { en: 'The chest snaps at your quill! Two springy jesters pop out, giggling.', zh: '寶箱一口咬住你的羽筆！兩個彈簧小丑從裡面跳出來，咯咯笑著。' },
        choices: [
          { en: 'Fight them', zh: '打倒它們', note: '菁英戰鬥，勝利可得遺物', effects: [{ op: 'fight', encounter: ['springJack', 'springJack'], kind: 'elite' }] },
          { en: 'Back away slowly', zh: '慢慢後退', note: '撿起掉出來的 25 金幣', effects: [{ op: 'gold', v: 25 }], result: { en: 'You back away. A few coins rolled out when it snapped.', zh: '你慢慢退開。它咬下來的時候，掉出了幾枚錢幣。' } },
        ],
      },
      safe: {
        body: { en: 'Nothing happens. It is just a very happy-looking chest.', zh: '什麼事也沒發生。這只是一個看起來很開心的寶箱。' },
        choices: [
          { en: 'Open it', zh: '打開它', note: '獲得 1 件遺物和 40 金幣', effects: [{ op: 'relic' }, { op: 'gold', v: 40 }], result: { en: 'Real treasure, real gold!', zh: '真的寶物，真的金子！' } },
        ],
      },
    },
  },
  inkKitten: {
    acts: [1, 2], art: 'inkKitten',
    title: { en: 'The Ink Kitten', zh: '墨水小貓' },
    body: { en: 'A kitten made of ink pads after you, leaving tiny paw prints on every page. It mews hopefully.', zh: '一隻墨水做成的小貓跟在你後面，在每一頁上留下小小的腳印。牠充滿期待地喵了一聲。' },
    choices: [
      { en: 'Pet the kitten', zh: '摸摸小貓', note: '牠多半會很開心……', outcomes: [
        { w: 70, effects: [{ op: 'maxHp', v: 5 }], result: { en: 'It purrs like a tiny engine. Your heart feels bigger.', zh: '牠像小引擎一樣呼嚕呼嚕。你覺得心都變大了。' } },
        { w: 30, effects: [{ op: 'hurt', v: 3 }, { op: 'gold', v: 40 }], result: { en: 'Scratch! It bolts, knocking over a coin pouch on the way.', zh: '唰！牠抓了你一下就跑，還順便打翻了一個錢袋。' } },
      ] },
      { en: 'Follow it', zh: '跟著牠走', note: '看看牠要帶你去哪裡', goto: 'nook' },
    ],
    stages: {
      nook: {
        body: { en: 'The kitten leads you to a hidden nook behind the shelves. Something glints inside, and something shuffles.', zh: '小貓帶你來到書架後的秘密角落。裡面有東西在發光，也有東西在窸窸窣窣。' },
        choices: [
          { en: 'Reach inside', zh: '伸手進去', note: '可能是卡牌，也可能是敵人', outcomes: [
            { w: 55, effects: [{ op: 'cardChoice', rarity: 'uncommon' }] },
            { w: 45, effects: [{ op: 'fight', encounter: ['dustWisp', 'dustWisp', 'dustWisp'] }] },
          ] },
          { en: 'Curl up for a nap', zh: '和小貓一起睡個午覺', note: '回復 15 生命', effects: [{ op: 'heal', v: 15 }], result: { en: 'You wake up warm, with a kitten asleep on your chest.', zh: '你醒來時暖呼呼的，小貓正趴在你胸口睡覺。' } },
        ],
      },
    },
  },
  knightDuel: {
    acts: [2, 3], art: 'knightDuel',
    title: { en: 'Sword, Shield, Scroll', zh: '劍、盾、卷軸' },
    body: { en: 'A brass knight bows. "A duel of wits! Sword beats Scroll, Scroll beats Shield, Shield beats Sword. First to two wins."', zh: '黃銅騎士鞠了個躬：「來場鬥智吧！劍勝卷軸、卷軸勝盾、盾勝劍。先贏兩局的人獲勝。」' },
    choices: [
      { en: 'Accept the duel', zh: '接受挑戰', note: '贏了得到稀有遺物，輸了失去 8 生命', game: 'duel' },
      { en: 'Bow back politely', zh: '禮貌地回禮', note: '下一場戰鬥開始時獲得 2 層 Might', effects: [{ op: 'boon', id: 'sun', fights: 1 }], result: { en: '"Honor to you!" The knight taps your shoulder with its sword.', zh: '「向你致敬！」騎士用劍輕點你的肩膀。' } },
    ],
    rewards: {
      win: { effects: [{ op: 'relic', tier: 'uncommon' }], result: { en: '"Well fought!" The knight presents you with a prize.', zh: '「打得漂亮！」騎士獻上一份獎品。' } },
      lose: { effects: [{ op: 'hurt', v: 8 }], result: { en: '"Again some day!" The knight\'s victory lap knocks you over.', zh: '「改天再戰！」騎士繞場慶祝時把你撞倒了。' } },
    },
  },
  clockworkTea: {
    acts: [2], home: 2, art: 'clockworkTea',
    title: { en: 'The Clockwork Tea Party', zh: '發條茶會' },
    body: { en: 'Little wind-up guests click their cups together. The teapot whistles a tune, though one of its gears is clearly loose.', zh: '小小的發條客人們叮叮噹噹地碰杯。茶壺吹著口哨唱歌，不過它有個齒輪明顯鬆掉了。' },
    choices: [
      { en: 'Sip the tea', zh: '喝一口茶', note: '多半很好喝……', outcomes: [
        { w: 65, effects: [{ op: 'heal', v: 12 }, { op: 'boon', id: 'comet' }], result: { en: 'A perfect brew! You feel wound up and ready.', zh: '泡得剛剛好！你覺得全身的發條都上緊了。' } },
        { w: 35, effects: [{ op: 'hurt', v: 4 }, { op: 'potion' }], result: { en: 'Too hot! A guest apologizes with a little bottle.', zh: '太燙了！一位客人遞上一小瓶藥水向你道歉。' } },
      ] },
      { en: 'Fix the teapot', zh: '修理茶壺', note: '打開來看看', goto: 'fix' },
      { en: 'Eat a gear biscuit', zh: '吃一塊齒輪餅乾', note: '最大生命 +4', effects: [{ op: 'maxHp', v: 4 }], result: { en: 'Crunchy. Surprisingly filling.', zh: '喀滋喀滋。意外地有飽足感。' } },
    ],
    stages: {
      fix: {
        body: { en: 'Inside the teapot you find a loose gear and a tangled spring.', zh: '茶壺裡面有一個鬆掉的齒輪，和一條纏在一起的彈簧。' },
        choices: [
          { en: 'Tighten the gear', zh: '鎖緊齒輪', note: '可能得到遺物，也可能被蒸氣燙到', outcomes: [
            { w: 60, effects: [{ op: 'relic', tier: 'common' }], result: { en: 'The teapot sings! The guests give you a gift.', zh: '茶壺唱起歌來！客人們送了你一份禮物。' } },
            { w: 40, effects: [{ op: 'hurt', v: 6 }, { op: 'gold', v: 30 }], result: { en: 'Pssst! Steam bursts out. The guests pay you for trying.', zh: '噗咻！蒸氣噴了出來。客人們還是付錢謝謝你幫忙。' } },
          ] },
          { en: 'Untangle the spring', zh: '解開彈簧', note: '隨機升級 1 張牌，獲得 20 金幣', effects: [{ op: 'upgradeRandom', v: 1 }, { op: 'gold', v: 20 }], result: { en: 'Boing! The spring snaps back into place, and so do your spells.', zh: '啵嚶！彈簧彈回原位，你的咒語也跟著精神起來。' } },
        ],
      },
    },
  },
  fortuneWheel: {
    acts: [1, 2, 3], art: 'fortuneWheel', game: 'wheel',
    title: { en: 'The Wheel of Wonders', zh: '奇妙轉盤' },
    body: { en: 'A traveling merchant taps a painted wheel. "Spin it! Everyone wins something... almost everyone."', zh: '旅行商人敲了敲彩繪轉盤：「轉轉看！每個人都會得到東西……幾乎每個人啦。」' },
    wheel: {
      cost: [20, 35],
      segments: [
        { en: 'Relic', zh: '遺物', glyph: 'gem', color: '#b38cff', w: 1, effects: [{ op: 'relic', tier: 'common' }] },
        { en: '80 Gold', zh: '80 金幣', glyph: 'gold', color: '#e8c47a', w: 2, effects: [{ op: 'gold', v: 80 }] },
        { en: 'Potion', zh: '藥劑', glyph: 'drop', color: '#6fd3a5', w: 2, effects: [{ op: 'potion' }] },
        { en: 'Heal 15', zh: '回復 15', glyph: 'heartFill', color: '#ff8a8a', w: 2, effects: [{ op: 'heal', v: 15 }] },
        { en: 'Card', zh: '稀有卡', glyph: 'deck', color: '#8fc3ff', w: 1, effects: [{ op: 'randomCard', rarity: 'uncommon' }] },
        { en: 'Star Map', zh: '星圖', glyph: 'stars', color: '#9fe3ff', w: 1, effects: [{ op: 'boon', id: 'star' }] },
        { en: 'Curse', zh: '詛咒', glyph: 'regret', color: '#c45b8b', w: 1, effects: [{ op: 'curse', id: 'regret' }] },
        { en: 'Nothing', zh: '槓龜', glyph: 'smoke', color: '#8a8d99', w: 2, effects: [] },
      ],
    },
    results: {
      leave: { en: '"Next time, then!" The merchant waves you off.', zh: '「那就下次囉！」商人揮手送你離開。' },
      done: { en: 'The merchant tips her hat. "Come again, lucky one!"', zh: '商人抬了抬帽子：「歡迎再來，幸運兒！」' },
    },
  },
  readingRoom: {
    acts: [3], art: 'readingRoom',
    title: { en: 'The Haunted Reading Room', zh: '鬧鬼的閱覽室' },
    body: { en: 'Ghosts sit in old armchairs, turning pages that make no sound. One looks up and puts a finger to its lips: "Shhh."', zh: '幽靈們坐在舊扶手椅上，翻著不會發出聲音的書頁。其中一個抬起頭，把手指放在嘴唇上：「噓——」' },
    choices: [
      { en: 'Read them a story', zh: '唸故事給他們聽', note: '最大生命 +4，接下來 3 場戰鬥第一回合獲得 8 Ward', effects: [{ op: 'speak', text: 'Once upon a time, a brave word refused to be silent.' }, { op: 'maxHp', v: 4 }, { op: 'boon', id: 'moon' }], result: { en: 'The ghosts lean in. For the first time in years, they smile.', zh: '幽靈們湊過來聽。多年來第一次，他們露出了微笑。' } },
      { en: 'Borrow a glowing book', zh: '借一本發光的書', note: '可能得到傳說卡，也可能惹怒他們', outcomes: [
        { w: 55, effects: [{ op: 'cardChoice', rarity: 'rare' }] },
        { w: 45, effects: [{ op: 'fight', encounter: ['echoShade', 'echoShade'] }] },
      ] },
      { en: 'Blow out the candles', zh: '吹熄蠟燭', note: '菁英戰鬥，勝利可得遺物', effects: [{ op: 'fight', encounter: ['hushWraith', 'echoShade'], kind: 'elite' }] },
    ],
  },

  // ── Region events ──
  // The Drowned Stacks have no merchant; a Pearl Clam room opens this instead.
  pearlClam: {
    acts: [], room: true, art: 'pearl',
    title: { en: 'The Pearl Clam', zh: '珍珠蚌' },
    body: { en: 'A giant clam yawns open on the sunken floor. Inside, pearls glow like little moons. "Take one," it bubbles, "only one."', zh: '巨大的蚌殼在沉沒的地板上緩緩張開，裡面的珍珠像小月亮一樣發光。「拿一顆吧，」它吐著泡泡說，「只能一顆喔。」' },
    choices: [
      { en: 'The rose pearl', zh: '玫瑰珍珠', note: '最大生命 +6，回復 12 生命', effects: [{ op: 'maxHp', v: 6 }, { op: 'heal', v: 12 }], result: { en: 'The pearl melts into warmth in your hand.', zh: '珍珠在手心化成一股暖流。' } },
      { en: 'The golden pearl', zh: '金色珍珠', note: '獲得 80 金幣', effects: [{ op: 'gold', v: 80 }], result: { en: 'It clinks like a pile of coins. It is a pile of coins.', zh: '它叮噹作響，像一堆錢幣。原來真的是一堆錢幣。' } },
      { en: 'The moon pearl', zh: '月光珍珠', note: '隨機升級 2 張牌', effects: [{ op: 'upgradeRandom', v: 2 }], result: { en: 'Moonlight seeps into your cards.', zh: '月光滲進了你的牌裡。' } },
      { en: 'The black pearl', zh: '黑珍珠', note: '從牌組移除 1 張牌', effects: [{ op: 'remove' }], result: { en: 'The pearl swallows a page and goes quiet.', zh: '黑珍珠吞下一頁紙，安靜了下來。' } },
    ],
  },
  fallingStar: {
    acts: [], zones: ['observatory'], art: 'stars',
    title: { en: 'The Falling Star', zh: '墜落的星星' },
    body: { en: 'A tiny falling star is caught in the lens of the great telescope. It blinks at you, waiting for a wish.', zh: '一顆小小的流星卡在大望遠鏡的鏡片裡。它對你眨眨眼，好像在等你許願。' },
    choices: [
      { en: 'Make a wish aloud', zh: '大聲許願', note: '回復 30% 生命，接下來 3 場戰鬥的第一回合多抽 2 張牌', effects: [{ op: 'speak', text: 'Star light, star bright, I wish I may, I wish I might.' }, { op: 'healPct', v: 30 }, { op: 'boon', id: 'star' }], result: { en: 'The star glows brighter, as if it heard every word.', zh: '星星變得更亮了，好像聽見了你說的每一個字。' } },
      { en: 'Wish for courage', zh: '許願：勇氣', note: '失去 6 生命，從 3 張傳說卡中選 1 張', req: { hp: 7 }, effects: [{ op: 'hurt', v: 6 }, { op: 'cardChoice', rarity: 'rare' }] },
      { en: 'Keep the star in a jar', zh: '把星星裝進瓶子', note: '獲得 1 件遺物，加入詛咒 Doubt', effects: [{ op: 'relic' }, { op: 'curse', id: 'doubt' }], result: { en: 'The jar is warm. The star inside looks a little sad.', zh: '瓶子暖暖的，裡面的星星看起來有點難過。' } },
    ],
  },
};
