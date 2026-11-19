// Story encounters. English leads, the Chinese line sits right below it.
// Effects are resolved by the run engine (see applyOutcome in engine.js).
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
    acts: [2], art: 'gear',
    title: { en: "The Tinker's Stall", zh: '修鐘匠的攤子' },
    body: { en: 'A tiny tinker sits among a thousand ticking parts. "Trade? Fix? Both?"', zh: '一位小小的修鐘匠坐在上千個滴答作響的零件中間：「交易？修理？還是都要？」' },
    choices: [
      { en: 'Sell a potion', zh: '賣掉一瓶藥劑', note: '失去 1 瓶藥劑，獲得 75 金幣', req: { potion: true }, effects: [{ op: 'losePotion' }, { op: 'gold', v: 75 }], result: { en: '"Fine glass, fine color. Sold!"', zh: '「好瓶子、好顏色。成交！」' } },
      { en: 'Tune your deck (60 gold)', zh: '調校牌組（60 金幣）', note: '隨機升級 2 張牌', req: { gold: 60 }, effects: [{ op: 'gold', v: -60 }, { op: 'upgradeRandom', v: 2 }], result: { en: 'Click, whirr, ding. Good as new.', zh: '喀、嗡、叮。跟新的一樣。' } },
      { en: 'Leave', zh: '離開', note: '什麼也不發生', effects: [], result: { en: 'Tick, tick, tick...', zh: '滴答、滴答、滴答……' } },
    ],
  },
  silentChoir: {
    acts: [3], art: 'choir',
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
};
