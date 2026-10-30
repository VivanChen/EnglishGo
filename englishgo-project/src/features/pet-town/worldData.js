// Original, offline-ready stories. Every level follows the same island events;
// vocabulary and reasoning change without changing a learner's unlocks.
export const LEVELS = ['elementary', 'junior', 'senior'];

export const PETS = [
  { id: 'harbor-cat', name: '凪凪', enName: 'Nagi', species: 'cat', speciesName: '海港小貓', trait: '細心的觀察家', description: '總會先發現屋簷下的小線索，也喜歡陪你在窗邊發呆。', color: '#f4d2a3', accent: '#b7784e', role: '觀察招牌、發現細節', greeting: 'Let’s look a little closer.', greetingZh: '我們再仔細看一點。' },
  { id: 'sunny-dog', name: '晴晴', enName: 'Haru', species: 'dog', speciesName: '陽光小狗', trait: '熱情的小鄰居', description: '記得每位鄰居的名字，最期待和你一起散步、送信。', color: '#d9a061', accent: '#fff1d5', role: '認識鄰居、傳遞問候', greeting: 'There is always room for a friend.', greetingZh: '這裡總有朋友的位置。' },
  { id: 'garden-rabbit', name: '小麥', enName: 'Mugi', species: 'rabbit', speciesName: '花園小兔', trait: '溫柔的園藝家', description: '耳朵會跟著風輕輕轉動；你來的時候，牠總留著一個野餐位子。', color: '#eee7de', accent: '#dfb2ab', role: '照料苗圃、整理生活', greeting: 'Small things grow with care.', greetingZh: '用心照顧，小小的事物也會長大。' },
];

export const REGIONS = [
  { id: 'harbor', name: '海風港町', enName: 'Seabreeze Harbor', description: '跟著海風認識小島，把一張明信片送到對的人手裡。', color: '#7eafb8', icon: '⌂', unlockAfter: 0 },
  { id: 'orchard', name: '山腳果園', enName: 'Hillside Orchard', description: '種子、雨水和一場野餐，慢慢把空地變成大家的花園。', color: '#8fa878', icon: '❋', unlockAfter: 3 },
  { id: 'starlight', name: '星見山丘', enName: 'Stargazer Hill', description: '沿著山路上的留言，準備一個讓每位朋友都能參加的觀星夜。', color: '#9397bc', icon: '✦', unlockAfter: 6 },
];

const furniture = (id, name, enName, kind, price, x, z, color, accent, starter = false) => ({ id, name, enName, kind, price, size: { x, z }, color, accent, starter, setId: id.split('-')[0] });
export const FURNITURE = [
  furniture('harbor-cushion', '海鹽軟墊', 'Sea-salt cushion', 'cushion', 30, .9, .9, '#d9e7df', '#80a9a7', true),
  furniture('harbor-bowl', '小魚餐碗', 'Little fish bowl', 'bowl', 20, .65, .65, '#eee5d1', '#8bafbd', true),
  furniture('harbor-bench', '漂流木長椅', 'Driftwood bench', 'bench', 80, 1.6, .75, '#b78e63', '#ebe5d2'),
  furniture('harbor-lantern', '港邊小燈', 'Harbor lantern', 'lantern', 50, .65, .65, '#7f9b97', '#ffe7a0'),
  furniture('harbor-mailbox', '薄荷信箱', 'Mint mailbox', 'mailbox', 70, .7, .7, '#8faf9a', '#efe8d3'),
  furniture('harbor-shells', '海邊收藏盤', 'Seashell tray', 'shells', 40, .8, .7, '#dfc7ae', '#f7eee0'),
  furniture('harbor-planter', '窗邊綠盆栽', 'Seaside planter', 'planter', 50, .9, .9, '#7f9d76', '#cbb397', true),
  furniture('harbor-table', '午後茶桌', 'Afternoon tea table', 'table', 100, 1.2, 1.2, '#c59a6d', '#ede0c9'),
  furniture('orchard-rug', '葉紋地毯', 'Leaf-pattern rug', 'rug', 45, 1.6, 1.3, '#a0b286', '#e8dec1'),
  furniture('orchard-stool', '蘋果小凳', 'Apple stool', 'stool', 35, .65, .65, '#c69470', '#a7b481'),
  furniture('orchard-watering-can', '晨光澆水壺', 'Morning watering can', 'wateringCan', 45, .7, .7, '#a7b6a4', '#eee2c2'),
  furniture('orchard-planter', '香草小花圃', 'Herb planter', 'planter', 50, .9, .9, '#8b9e66', '#bf906c'),
  furniture('orchard-tree', '小小蘋果樹', 'Little apple tree', 'tree', 120, 1.2, 1.2, '#8fa36d', '#c98d7f'),
  furniture('orchard-picnic', '格紋野餐席', 'Checked picnic blanket', 'picnic', 100, 1.7, 1.3, '#d8bd96', '#f5e7d1'),
  furniture('orchard-basket', '編織野餐籃', 'Woven picnic basket', 'basket', 50, .75, .65, '#b78b60', '#f0dfbf'),
  furniture('orchard-fence', '白木小圍欄', 'White garden fence', 'fence', 65, 1.5, .4, '#f1ead8', '#c5b494'),
  furniture('starlight-cushion', '月光軟墊', 'Moonlight cushion', 'cushion', 45, .9, .9, '#bbb7d4', '#f1e7d0'),
  furniture('starlight-lantern', '星光紙燈', 'Starlight paper lantern', 'lantern', 60, .65, .65, '#e3d6bd', '#f9e9b0'),
  furniture('starlight-telescope', '小島望遠鏡', 'Island telescope', 'telescope', 140, 1, 1, '#8f9ba8', '#d4bb8b'),
  furniture('starlight-bench', '觀星長椅', 'Stargazing bench', 'bench', 100, 1.6, .75, '#9899ac', '#e0d8c5'),
  furniture('starlight-rug', '星圖地毯', 'Star-map rug', 'rug', 65, 1.6, 1.3, '#9c9cb6', '#e6d9ac'),
  furniture('starlight-chime', '晚風風鈴', 'Evening wind chime', 'chime', 70, .65, .65, '#a1b7b9', '#d8c899'),
  furniture('starlight-fountain', '映月水盆', 'Moon-reflection basin', 'fountain', 130, 1.2, 1.2, '#adacb8', '#a9ccd0'),
  furniture('starlight-tree', '許願小樹', 'Little wishing tree', 'tree', 120, 1.2, 1.2, '#a7b29a', '#e9d7ad'),
];

const q = (prompt, zh, options, answer, en, explanationZh) => ({ prompt, zh, options: options.map(([optionEn, optionZh]) => ({ en: optionEn, zh: optionZh })), answer, explanation: { en, zh: explanationZh } });
const level = (en, zh, challenges) => ({ intro: { en, zh }, challenges });
const chapter = (id, regionId, order, title, enTitle, summary, rewardItemIds, levels) => ({
  id, regionId, order, title, enTitle, summary, scene: regionId, rewardItemIds, petXp: 40, bond: 8,
  levels: Object.fromEntries(LEVELS.map(key => [key, { ...levels[key], challenges: levels[key].challenges.map((challenge, index) => ({ ...challenge, id: `${id}-${key}-${index + 1}` })) }])),
});

export const CHAPTERS = [
  chapter('harbor-arrival', 'harbor', 1, '抵達小島的午後', 'An Afternoon Arrival', '找到自己的行李，也為新家選一條舒服的路。', ['harbor-bench'], {
    elementary: level('Your boat is here. Your bag has a blue fish on it. The blue path goes to your new home.', '船靠岸了。你的袋子上有一條藍色小魚。藍色小路通往你的新家。', [
      q('Which bag is yours?', '哪個袋子是你的？', [['The bag with a red star.', '有紅色星星的袋子。'], ['The bag with a blue fish.', '有藍色小魚的袋子。'], ['The bag with a green leaf.', '有綠色葉子的袋子。']], 1, 'The blue fish matches your bag tag.', '袋子上的藍色小魚和你的行李牌相同。'),
      q('Where does the blue path go?', '藍色小路通往哪裡？', [['The boat.', '船。'], ['The shop.', '商店。'], ['Your new home.', '你的新家。']], 2, 'Follow the blue path to your home.', '沿著藍色小路就能到新家。'),
    ]),
    junior: level('The harbor has three bags. Yours is the small bag beside the wooden bench, not the large one under it. A sign says, “Homes: follow the coast, then turn left.”', '港口有三個袋子。你的是木椅旁的小袋子，不是椅子下的大袋子。路標寫著：「住宅：沿海岸走，接著左轉。」', [
      q('Which description matches your bag?', '哪個描述符合你的袋子？', [['Small, beside the bench.', '小的，在長椅旁。'], ['Large, under the bench.', '大的，在長椅下。'], ['Small, on the boat.', '小的，在船上。']], 0, 'Beside means next to, so look next to the bench.', 'beside 是「在旁邊」，所以要看長椅旁。'),
      q('What should you do after following the coast?', '沿海岸走之後，應該怎麼走？', [['Return to the boat.', '回到船上。'], ['Turn left.', '左轉。'], ['Walk into the sea.', '走進海裡。']], 1, 'The word then tells you the next step: turn left.', 'then 指出下一步：左轉。'),
    ]),
    senior: level('Two routes lead to the cottage. The coastal route takes ten minutes and has no steps. The hillside shortcut takes six minutes but includes a steep staircase. Your trolley holds a heavy suitcase.', '有兩條路通往小屋。海岸路線要走十分鐘，沒有階梯；山坡捷徑只要六分鐘，但有陡峭的樓梯。你的推車上放著一個很重的行李箱。', [
      q('Which route is more practical for the loaded trolley?', '推著重行李時，哪條路較實用？', [['The staircase, because it is shorter.', '樓梯路線，因為比較短。'], ['Neither route can reach the cottage.', '兩條路都到不了小屋。'], ['The coastal route, because it is step-free.', '海岸路線，因為沒有階梯。']], 2, 'A step-free route is easier for a heavy trolley, even if it takes longer.', '沒有階梯的路更方便推重物，即使多花一點時間。'),
      q('A neighbor asks why you chose that route. Which answer explains the trade-off?', '鄰居問你為什麼選這條路。哪句話說明了取捨？', [['It takes longer, but I can keep the suitcase on the trolley.', '雖然比較久，但行李可以一直放在推車上。'], ['It is both the shortest and the steepest route.', '它同時是最短和最陡的路。'], ['I chose it because the cottage is closed.', '我選它是因為小屋關門了。']], 0, 'The answer explains both the extra time and the benefit.', '這個回答同時說明多花的時間與得到的便利。'),
    ]),
  }),
  chapter('harbor-postcard', 'harbor', 2, '迷路的明信片', 'The Wandering Postcard', '讀懂地址與方向，讓一份問候平安抵達。', ['harbor-mailbox', 'harbor-lantern'], {
    elementary: level('A postcard is for Mina. Mina lives in the yellow house. Her house is next to the bakery. Put the card in her mailbox.', '一張明信片要寄給 Mina。她住在麵包店旁的黃色房子裡。請把卡片放進她的信箱。', [
      q('Which house is Mina’s?', '哪一間是 Mina 的房子？', [['The yellow house.', '黃色的房子。'], ['The blue house.', '藍色的房子。'], ['The red house.', '紅色的房子。']], 0, 'Mina lives in the yellow house next to the bakery.', 'Mina 住在麵包店旁的黃色房子裡。'),
      q('Where should the postcard go?', '明信片應該放在哪裡？', [['In the pond.', '池塘裡。'], ['In the mailbox.', '信箱裡。'], ['Under the boat.', '船底下。']], 1, 'A mailbox keeps Mina’s postcard in the right place.', '把明信片放入信箱，Mina 就能收到。'),
    ]),
    junior: level('The postcard says “Mina, 12 Harbor Lane.” At the bakery, a neighbor says, “Go past the fountain. Her gate is opposite the bicycle shop.” The envelope is dry, but rain is coming.', '明信片上寫著「Mina，港口巷 12 號」。麵包店的鄰居說：「經過噴水池後，她家的門就在自行車店對面。」信封目前是乾的，但快下雨了。', [
      q('After passing the fountain, where should you look?', '經過噴水池後，應該看哪裡？', [['Behind the bakery.', '麵包店後面。'], ['Inside the bicycle shop.', '自行車店裡面。'], ['Across from the bicycle shop.', '自行車店對面。']], 2, 'Opposite means across from, not inside.', 'opposite 是「在對面」，不是在裡面。'),
      q('Which message politely checks the address?', '哪句話能有禮貌地確認地址？', [['Excuse me, is this 12 Harbor Lane?', '不好意思，請問這裡是港口巷 12 號嗎？'], ['Give me your bicycle now.', '現在把你的自行車給我。'], ['The fountain is very wet.', '噴水池很濕。']], 0, 'The question checks the house number before delivery.', '這個問題能在投遞前確認門牌號碼。'),
    ]),
    senior: level('The postcard is addressed to Mina at number 12, but the cottage’s number plate has fallen off. A notice on the gate reads, “Mina’s pottery workshop has moved next door. Personal mail still goes in this cottage’s green box.”', '明信片寄給 12 號的 Mina，但小屋的門牌掉了。門口告示寫著：「Mina 的陶藝工作室已搬到隔壁。私人郵件仍請投進這間小屋的綠色信箱。」', [
      q('Where should you deliver this personal postcard?', '這張私人明信片應該送到哪裡？', [['The workshop next door.', '隔壁的工作室。'], ['The cottage’s green mailbox.', '小屋的綠色信箱。'], ['Any box with a number plate.', '任何有門牌的信箱。']], 1, 'The notice distinguishes the workshop address from the personal-mail address.', '告示分開說明了工作室地址與私人郵件的收件處。'),
      q('Which reply accurately explains why you did not use the workshop address?', '哪個回答正確解釋了為什麼沒有寄到工作室？', [['The workshop never accepts visitors.', '工作室從不接待訪客。'], ['All the houses share one mailbox.', '所有房子共用一個信箱。'], ['The workshop moved, but the personal-mail instructions did not change.', '工作室搬了，但私人郵件的投遞方式沒變。']], 2, 'Only the workshop moved; the notice explicitly keeps personal mail at the cottage.', '搬走的是工作室；告示明確表示私人郵件仍送到小屋。'),
    ]),
  }),
  chapter('harbor-welcome', 'harbor', 3, '雨後的迎新會', 'Welcome After the Rain', '把邀請送給新朋友，替每位客人留一個位子。', ['harbor-table', 'harbor-shells'], {
    elementary: level('The rain stops. A welcome party starts at four. There are three friends and two chairs. Haru brings one more chair.', '雨停了。迎新會四點開始。有三位朋友，但只有兩張椅子。晴晴帶來了另一張椅子。', [
      q('When does the party start?', '聚會幾點開始？', [['At two.', '兩點。'], ['At four.', '四點。'], ['At six.', '六點。']], 1, 'The invitation says the party starts at four.', '邀請上說聚會四點開始。'),
      q('Haru brings a chair. What can you say?', '晴晴帶來一張椅子。你可以說什麼？', [['Please leave the island.', '請離開小島。'], ['The party was yesterday.', '聚會是昨天。'], ['Thank you! Please sit with us.', '謝謝你！請和我們一起坐。']], 2, 'A thank-you and an invitation help a new friend feel welcome.', '道謝並邀請一起坐，能讓新朋友感受到歡迎。'),
    ]),
    junior: level('The invitation says, “Meet in the square at four. If the rain returns, meet in the covered market instead.” Dark clouds arrive at half past three. Haru asks where to carry the cups.', '邀請上寫著：「四點在廣場集合。如果又下雨，就改在有屋頂的市場集合。」三點半時烏雲來了。晴晴問要把杯子搬到哪裡。', [
      q('It starts raining again. Where should everyone meet?', '又開始下雨了。大家應該在哪裡集合？', [['In the covered market.', '有屋頂的市場。'], ['In the open square.', '露天廣場。'], ['On the boat at five.', '五點在船上。']], 0, 'The rain plan changes the place, not the time.', '雨天計畫只改集合地點，沒有改時間。'),
      q('Which update gives guests both details they need?', '哪則更新同時告訴客人需要的兩項資訊？', [['The cups are blue.', '杯子是藍色的。'], ['Please meet at the covered market at four.', '請四點到有屋頂的市場集合。'], ['It may rain somewhere.', '某個地方可能會下雨。']], 1, 'Guests need the new meeting place and the original time.', '客人需要知道新地點與原訂時間。'),
    ]),
    senior: level('The welcome gathering will move indoors because the square is wet. The market hall has fewer seats, so the organizer suggests reserving the front row for guests who cannot stand for long. Haru volunteers to greet arrivals.', '廣場濕了，迎新會要改到室內。市場大廳的座位比較少，主辦人建議把前排留給不方便久站的客人。晴晴自願在入口迎接大家。', [
      q('What is the main reason for reserving the front row?', '保留前排座位的主要原因是什麼？', [['To reward the earliest arrivals only.', '只為了獎勵最早到的人。'], ['To leave all seats empty.', '為了讓所有座位空著。'], ['To make the gathering accessible to guests who need a seat.', '讓需要座位的客人也能輕鬆參加。']], 2, 'The seating plan responds to guests’ needs, rather than their arrival order.', '座位安排考慮的是客人的需要，而非抵達順序。'),
      q('Which greeting explains the arrangement without making assumptions?', '哪種招呼能說明安排，又不擅自判斷客人的需要？', [['Welcome! If you need a seat, there are reserved chairs at the front.', '歡迎！如果你需要座位，前面有保留的椅子。'], ['You look tired, so you must sit here.', '你看起來很累，所以一定要坐這裡。'], ['Only our oldest friends may sit down.', '只有最年長的朋友可以坐下。']], 0, 'Offering a choice lets guests tell you what they need.', '提供選擇，就能讓客人自行表達需要。'),
    ]),
  }),
  chapter('orchard-seeds', 'orchard', 4, '空白的種子牌', 'The Missing Seed Labels', '觀察種子的說明，幫小麥整理第一座香草花圃。', ['orchard-planter', 'orchard-watering-can'], {
    elementary: level('Mugi has two seed bags. The carrot bag shows an orange carrot. The bean bag shows a green bean. Carrots grow under the ground.', '小麥有兩袋種子。胡蘿蔔袋上畫著橘色胡蘿蔔；豆子袋上畫著綠色豆子。胡蘿蔔長在土裡。', [
      q('Which label belongs on the bag with the orange carrot?', '畫著橘色胡蘿蔔的袋子應該貼哪張標籤？', [['Carrot seeds.', '胡蘿蔔種子。'], ['Bean seeds.', '豆子種子。'], ['Flower seeds.', '花的種子。']], 0, 'The picture helps you match the carrot label.', '可以靠圖案找到胡蘿蔔的標籤。'),
      q('Where do carrots grow?', '胡蘿蔔長在哪裡？', [['On a high branch.', '高高的樹枝上。'], ['Under the ground.', '土裡。'], ['In the mailbox.', '信箱裡。']], 1, 'The orange part of a carrot grows under the ground.', '胡蘿蔔橘色的部分長在土裡。'),
    ]),
    junior: level('One packet says, “Basil: keep in a warm, sunny place.” Another says, “Lettuce: give it afternoon shade.” The east bed gets morning sun, while the south bed stays sunny all day.', '一包種子寫著：「羅勒：放在溫暖、有陽光的地方。」另一包寫著：「萵苣：下午需要遮陰。」東邊的花圃早上有陽光；南邊的花圃整天都有陽光。', [
      q('Which bed is better for the lettuce?', '哪個花圃比較適合萵苣？', [['The south bed, in sun all day.', '整天有陽光的南邊花圃。'], ['A shelf inside the closed shed.', '關著的工具屋裡的架子。'], ['The east bed, shaded in the afternoon.', '下午有遮陰的東邊花圃。']], 2, 'The east bed matches the packet’s afternoon-shade instruction.', '東邊花圃符合種子包上「下午遮陰」的說明。'),
      q('Which label will help volunteers care for the basil?', '哪張標籤能幫志工照顧羅勒？', [['Basil — warm and sunny.', '羅勒——溫暖、有陽光。'], ['Basil — no light at all.', '羅勒——完全不需要光。'], ['Basil — keep in the freezer.', '羅勒——放進冷凍庫。']], 0, 'The label keeps the care instructions with the plant.', '這張標籤把照顧方式和植物放在一起。'),
    ]),
    senior: level('The labels have faded, but Mugi kept a planting notebook. Tray A was sown with herbs that prefer well-drained soil. Tray B contains seedlings that need consistently moist soil. Water collects at the bottom of the low bed after rain.', '標籤褪色了，但小麥保留了一本種植筆記。A 盤種的是喜歡排水良好土壤的香草；B 盤幼苗需要持續保持濕潤的土壤。低處花圃在雨後會積水。', [
      q('Which placement best follows the notebook for Tray A?', 'A 盤放在哪裡最符合筆記？', [['In the low bed where water collects.', '容易積水的低處花圃。'], ['In a raised planter with drainage holes.', '有排水孔的高架花盆。'], ['In a sealed container full of water.', '裝滿水的密閉容器。']], 1, 'Drainage holes allow extra water to leave the soil.', '排水孔能讓多餘的水離開土壤。'),
      q('What is the most reliable way to replace the missing labels?', '怎麼補上遺失的標籤最可靠？', [['Guess from the color of each tray.', '根據每個盤子的顏色猜。'], ['Give every plant the same name.', '給所有植物相同的名字。'], ['Use the notebook’s records, then label each tray clearly.', '依照筆記記錄，清楚標示各盤。']], 2, 'The notebook provides evidence that appearance alone cannot.', '筆記提供的依據，比只看外觀更可靠。'),
    ]),
  }),
  chapter('orchard-water', 'orchard', 5, '找回澆水路線', 'The Watering Route', '讀懂一張簡短的工作紙，讓每一株幼苗都得到剛好的照顧。', ['orchard-tree', 'orchard-stool'], {
    elementary: level('First, fill the watering can. Next, water the small plants. Then put the can beside the shed. The pond is for the ducks.', '先把澆水壺裝滿，再澆小植物，最後把水壺放在工具屋旁。池塘是鴨子的家。', [
      q('What do you do first?', '第一步要做什麼？', [['Put the empty can away.', '把空水壺收起來。'], ['Fill the watering can.', '把澆水壺裝滿。'], ['Move the ducks.', '把鴨子搬走。']], 1, 'Fill the can before you water the plants.', '先裝滿水壺，才能替植物澆水。'),
      q('Where does the can go after watering?', '澆完水後，水壺要放在哪裡？', [['In a tree.', '樹上。'], ['In the duck pond.', '鴨子的池塘裡。'], ['Beside the shed.', '工具屋旁。']], 2, 'Put it beside the shed so everyone can find it.', '放在工具屋旁，大家下次都找得到。'),
    ]),
    junior: level('Today’s list says: check the soil, water only the dry beds, and close the tap. The herb bed is damp after last night’s rain. The new flower bed is dry.', '今天的工作單寫著：檢查土壤、只澆乾燥的花圃、關好水龍頭。昨晚下過雨，香草圃還很濕，新花圃則是乾的。', [
      q('Which bed needs water now?', '哪個花圃現在需要澆水？', [['The dry flower bed.', '乾燥的新花圃。'], ['The damp herb bed.', '還濕著的香草圃。'], ['Both beds, because all soil is dry.', '兩個都要，因為土壤都是乾的。']], 0, 'Check the soil instead of watering every bed automatically.', '先檢查土壤，不需要每個花圃都澆水。'),
      q('You finish watering. Which instruction is still left?', '你澆完水了。還剩哪一項工作？', [['Open the tap wider.', '把水龍頭開得更大。'], ['Close the tap.', '關好水龍頭。'], ['Wash the notebook in the pond.', '把筆記本放進池塘洗。']], 1, 'Closing the tap completes the list and saves water.', '關水龍頭就完成工作單，也能節省水。'),
    ]),
    senior: level('The orchard has enough collected rainwater for two beds. The shaded herbs are still moist, the young fruit trees have dry soil, and the newly planted flowers are beginning to wilt. The plan prioritizes plants showing immediate signs of needing water.', '果園收集的雨水只夠澆兩個區域。陰影裡的香草仍濕潤，幼果樹的土壤乾了，新種的花則開始萎垂。計畫要求優先照顧已明顯需要水的植物。', [
      q('How should you use the available rainwater?', '應該如何使用現有的雨水？', [['Give all of it to the moist herbs.', '全部澆在濕潤的香草上。'], ['Use it to wash the path first.', '先拿去清洗小路。'], ['Water the young trees and the wilting flowers.', '澆幼果樹和正在萎垂的花。']], 2, 'Both selected beds show a current need; the shaded herbs do not.', '選中的兩個區域目前都缺水，陰影裡的香草則不需要。'),
      q('Which note best helps the next volunteer avoid unnecessary watering?', '哪則記錄最能幫下一位志工避免重複澆水？', [['Trees and flowers watered this morning; herbs still moist. Check soil again tomorrow.', '今早已澆樹與花；香草仍濕潤。明天再檢查土壤。'], ['Everything is fine forever.', '所有植物永遠都沒問題。'], ['Water every plant again immediately.', '立即再澆所有植物一次。']], 0, 'A useful note records what was done and what to check next.', '有用的記錄會說明做過什麼，以及接著要檢查什麼。'),
    ]),
  }),
  chapter('orchard-picnic', 'orchard', 6, '第一場野餐', 'Our First Picnic', '一起讀食譜、分享食物，讓果園成為大家的地方。', ['orchard-picnic', 'orchard-basket'], {
    elementary: level('There are three friends at the picnic. Each friend needs one cup. Mugi brings apples. Wash the apples before you eat them.', '野餐有三位朋友，每人需要一個杯子。小麥帶來蘋果。吃蘋果前，要先洗乾淨。', [
      q('How many cups do the three friends need?', '三位朋友需要幾個杯子？', [['Three cups.', '三個杯子。'], ['One cup.', '一個杯子。'], ['No cups.', '不需要杯子。']], 0, 'One cup for each of three friends makes three cups.', '三位朋友每人一個杯子，一共是三個。'),
      q('What should you do before eating an apple?', '吃蘋果之前應該做什麼？', [['Paint it blue.', '把它塗成藍色。'], ['Wash it.', '把它洗乾淨。'], ['Put it in the mailbox.', '把它放入信箱。']], 1, 'The picnic instructions say to wash the apples first.', '野餐說明提醒我們先洗蘋果。'),
    ]),
    junior: level('The recipe says, “Wash the fruit, cut it into small pieces, then mix it in a bowl.” A guest cannot eat nuts, so the fruit salad and the nuts will be served in separate bowls.', '食譜寫著：「清洗水果、切成小塊，再放入碗中拌勻。」一位客人不能吃堅果，所以水果沙拉和堅果要用不同的碗盛裝。', [
      q('What comes between washing the fruit and mixing it?', '清洗水果和拌勻之間，要做什麼？', [['Put the bowl away.', '把碗收起來。'], ['Add nuts to every serving.', '每一份都加堅果。'], ['Cut the fruit into small pieces.', '把水果切成小塊。']], 2, 'The recipe gives three steps in order: wash, cut, mix.', '食譜依序列出三個步驟：洗、切、拌。'),
      q('Which label helps the guest choose the fruit salad?', '哪張標示能幫客人選擇水果沙拉？', [['Fruit salad — no nuts added.', '水果沙拉——未添加堅果。'], ['Every bowl contains nuts.', '每一碗都含堅果。'], ['Please guess what is inside.', '請猜猜裡面有什麼。']], 0, 'A clear label explains what has been added to the dish.', '清楚的標籤能說明餐點加入了哪些食材。'),
    ]),
    senior: level('More neighbors join than expected. Instead of making individual plates in advance, Mugi suggests serving the food in shared dishes with ingredient labels. Guests can choose portions, and leftovers can be packed after everyone has eaten.', '來的鄰居比預期多。小麥建議不要事先分裝個人餐盤，而是用標示食材的公用餐盤供餐。客人能自行決定份量；大家吃完之後再把剩菜打包。', [
      q('Why does Mugi suggest shared dishes?', '小麥為什麼建議使用公用餐盤？', [['So nobody can see the ingredients.', '這樣大家就看不到食材。'], ['They let guests choose portions as the number of guests changes.', '人數有變時，客人仍能自行選擇份量。'], ['They guarantee there will never be leftovers.', '這能保證永遠沒有剩菜。']], 1, 'The plan is flexible; it does not promise that every scrap will be eaten.', '這個安排有彈性，但並沒有保證所有食物都會吃完。'),
      q('Which announcement explains the plan clearly?', '哪個通知清楚說明了這個安排？', [['Take the largest portion before others arrive.', '趁其他人還沒到，先拿最大份。'], ['Pack all the food before serving anyone.', '在供餐之前就把所有食物打包。'], ['Please check the labels and take what you need. We will pack leftovers afterward.', '請看標籤並取用需要的份量，之後再一起打包剩下的食物。']], 2, 'The announcement supports informed choices and sharing.', '這則通知讓大家了解內容後再選擇，也方便分享。'),
    ]),
  }),
  chapter('starlight-trail', 'starlight', 7, '山路上的留言', 'Messages on the Hill', '讀一讀前人留下的線索，沿著安全的小路往上走。', ['starlight-telescope', 'starlight-chime'], {
    elementary: level('A sign says, “The hill path is open. The bridge is closed.” Follow the moon signs. The first moon sign is on the left.', '路標寫著：「山路開放，橋梁關閉。」請跟著月亮標記走。第一個月亮標記在左邊。', [
      q('Which route is open?', '哪條路開放？', [['The bridge.', '橋。'], ['The hill path.', '山路。'], ['The closed gate.', '關上的門。']], 1, 'The sign says the hill path is open.', '路標說山路開放。'),
      q('Where is the first moon sign?', '第一個月亮標記在哪裡？', [['On the right.', '右邊。'], ['Behind the boat.', '船後面。'], ['On the left.', '左邊。']], 2, 'Look left to find the first moon sign.', '往左看就能找到第一個月亮標記。'),
    ]),
    junior: level('The trail notice says, “After the stone steps, follow the path beside the stream. Do not cross the old bridge.” A second note says the observatory is just beyond the wooden shelter.', '步道告示寫著：「走過石階後，沿著溪流旁的小路走，不要過舊橋。」第二張紙條說，觀測台就在木製休息亭的另一邊。', [
      q('What should you do after the stone steps?', '走過石階之後應該怎麼走？', [['Walk beside the stream.', '沿溪流旁邊走。'], ['Cross the old bridge.', '走過舊橋。'], ['Turn back at once.', '立刻折返。']], 0, 'Beside the stream describes the safe route in the notice.', '告示指出安全的路線就在溪流旁邊。'),
      q('You reach the wooden shelter. Where is the observatory?', '你到達木製休息亭了。觀測台在哪裡？', [['Under the stream.', '溪流底下。'], ['Just beyond the shelter.', '休息亭的另一邊。'], ['Back at the harbor.', '回港口才找得到。']], 1, 'Beyond means farther along, on the other side.', 'beyond 指再往前一些、在另一側。'),
    ]),
    senior: level('An old map marks the bridge as the quickest route, but a dated notice posted this morning says the bridge is closed for repairs. The alternative path adds five minutes and leads past a sheltered rest area.', '舊地圖把橋標成最快的路線，但今早張貼、註明日期的告示說橋正封閉維修。替代路線多花五分鐘，會經過一處有遮蔽的休息區。', [
      q('Which information should guide your route today?', '今天應該以哪項資訊規劃路線？', [['The old map, because maps never change.', '舊地圖，因為地圖永遠不變。'], ['The shortest distance, regardless of the notice.', '只看最短距離，不管告示。'], ['This morning’s repair notice.', '今早的維修告示。']], 2, 'The dated notice reflects a current condition the old map cannot show.', '有日期的新告示反映了舊地圖無法呈現的現況。'),
      q('Which message best updates your friends?', '哪則訊息最適合通知朋友？', [['The bridge is closed today; use the path past the shelter and allow five extra minutes.', '橋今天關閉，請走經過休息區的小路，並多留五分鐘。'], ['The whole island is closed forever.', '整座小島永遠關閉了。'], ['Ignore every sign and follow the old map.', '忽略所有路標，照舊地圖走。']], 0, 'The update names the change, the alternative, and the extra travel time.', '這則更新說明了變動、替代路線與額外時間。'),
    ]),
  }),
  chapter('starlight-observatory', 'starlight', 8, '修好的觀星台', 'The Observatory Opens', '看懂準備清單，一起把觀星台整理成舒服的地方。', ['starlight-lantern', 'starlight-bench'], {
    elementary: level('It is evening. Put the blankets on the bench. Keep the little lamp low. Use the telescope to look at the moon.', '傍晚了。把毯子放到長椅上，讓小燈保持低亮度，再用望遠鏡看月亮。', [
      q('Where do the blankets go?', '毯子要放在哪裡？', [['On the bench.', '長椅上。'], ['In the fountain.', '水池裡。'], ['Under the path.', '小路下面。']], 0, 'The blankets belong on the bench for the guests.', '毯子放在長椅上，讓客人可以使用。'),
      q('What can help you see the moon more closely?', '什麼能幫你更近地看月亮？', [['A watering can.', '澆水壺。'], ['A telescope.', '望遠鏡。'], ['A picnic basket.', '野餐籃。']], 1, 'A telescope helps you see distant objects more clearly.', '望遠鏡能幫助你更清楚地看遠方的物體。'),
    ]),
    junior: level('The checklist says to set up the telescope before the guests arrive. A small red lamp lights the steps. Bright white lamps should stay off during the observation so everyone can see the night sky.', '清單說，要在客人抵達前架好望遠鏡。一盞紅色小燈照亮階梯。觀察時應關掉明亮的白燈，讓大家看清夜空。', [
      q('What needs to be ready before the guests arrive?', '客人抵達之前，什麼需要準備好？', [['A loud music show.', '吵鬧的音樂表演。'], ['Every white lamp switched on.', '把每一盞白燈都打開。'], ['The telescope.', '望遠鏡。']], 2, 'The checklist puts setting up the telescope before the guests’ arrival.', '清單要求在客人到達前先架好望遠鏡。'),
      q('Which light should remain on to show the steps?', '為了看清階梯，應該保留哪盞燈？', [['The small red lamp.', '紅色小燈。'], ['The brightest white lamp.', '最亮的白燈。'], ['No light at all near the steps.', '階梯旁完全不要有光。']], 0, 'The red lamp marks the steps while the bright white lights stay off.', '紅色小燈能照出階梯，明亮白燈則保持關閉。'),
    ]),
    senior: level('The volunteer guide asks visitors to keep bright screens dimmed during observation. There is a lit preparation area behind a curtain for checking equipment. A visitor wants to read a detailed instruction sheet without disturbing the group.', '志工指南請訪客在觀察時調暗螢幕。布簾後有一個明亮的準備區，可檢查器材。一位訪客想讀詳細說明書，又不打擾其他人。', [
      q('What is the best place for reading the detailed sheet?', '哪個地方最適合閱讀詳細說明書？', [['Beside the telescope with a bright flashlight pointed at everyone.', '在望遠鏡旁拿強光手電筒照向大家。'], ['The lit preparation area behind the curtain.', '布簾後有燈光的準備區。'], ['The unlit edge of the hill.', '山丘沒有燈的邊緣。']], 1, 'The preparation area provides light without disturbing the observation area.', '準備區有足夠光線，也不會干擾觀察區。'),
      q('Which explanation communicates the purpose of dimming screens?', '哪句話說明了調暗螢幕的用意？', [['Screens are not allowed anywhere on the island.', '島上任何地方都不准使用螢幕。'], ['A dim screen makes the moon larger.', '暗螢幕會讓月亮變大。'], ['Lower brightness helps everyone keep their eyes adjusted to the dark.', '降低亮度能幫大家維持對黑暗環境的適應。']], 2, 'The instruction protects the shared viewing conditions.', '這項提醒是為了維持大家共同的觀察環境。'),
    ]),
  }),
  chapter('starlight-letter', 'starlight', 9, '寫給小島的星光信', 'A Letter to Our Island', '把一路上的小事寫成邀請，和三位夥伴一起看星星。', ['starlight-fountain', 'starlight-tree', 'starlight-rug', 'starlight-cushion'], {
    elementary: level('We found a home by the sea. We grew a garden. Now we can watch the stars together. The star party is on Saturday night. Bring a warm jacket.', '我們在海邊找到了家，也種出一座花園。現在可以一起看星星了。觀星聚會在星期六晚上，請帶一件保暖外套。', [
      q('When is the star party?', '觀星聚會是什麼時候？', [['Monday morning.', '星期一早上。'], ['Saturday night.', '星期六晚上。'], ['Friday at lunch.', '星期五中午。']], 1, 'The invitation says Saturday night.', '邀請上寫的是星期六晚上。'),
      q('Which sentence invites all your friends?', '哪句話能邀請所有朋友？', [['Only I can see the stars.', '只有我可以看星星。'], ['Please stay away from our island.', '請不要靠近我們的小島。'], ['Come and watch the stars with us!', '來和我們一起看星星吧！']], 2, 'With us makes the invitation friendly and shared.', 'with us 是「和我們一起」，讓邀請充滿分享的心意。'),
    ]),
    junior: level('Your letter begins, “Thanks to our neighbors, the harbor, garden, and observatory feel like home.” The invitation is for Saturday at seven. Guests should bring a jacket; warm drinks will be provided.', '你的信開頭寫著：「多虧了鄰居們，港口、花園和觀測台都像家一樣溫暖。」活動在星期六七點。客人要帶外套，現場會提供熱飲。', [
      q('What should guests bring themselves?', '客人需要自己帶什麼？', [['A jacket.', '外套。'], ['All the warm drinks.', '所有熱飲。'], ['A new observatory.', '一座新觀測台。']], 0, 'The letter asks for a jacket and says drinks will be provided.', '信上請客人帶外套，並說熱飲會由現場提供。'),
      q('Which closing matches the thankful tone of the letter?', '哪個結尾符合這封信感謝的語氣？', [['You did nothing for our town.', '你們沒有為小鎮做任何事。'], ['Thank you for helping our little island feel like home.', '謝謝你們讓這座小島有家的感覺。'], ['We will never meet again.', '我們永遠不會再見面。']], 1, 'The closing thanks the neighbors for their help.', '這個結尾感謝鄰居一路上的幫忙。'),
    ]),
    senior: level('The final letter recalls three small acts: a neighbor explained the harbor signs, volunteers shared the orchard work, and everyone helped reopen the observatory. Rather than praising one hero, the letter celebrates how these contributions made the island welcoming.', '最後一封信回顧三件小事：鄰居解說港口路標、志工分擔果園工作、大家協助重新開放觀測台。這封信不是讚美一位英雄，而是慶祝這些付出如何讓小島變得友善。', [
      q('Which sentence best expresses the letter’s central idea?', '哪句話最能表達這封信的主旨？', [['Only the largest achievement deserves attention.', '只有最大的成就值得注意。'], ['Small contributions from many people can make a place feel like home.', '許多人小小的付出，可以讓一個地方有家的感覺。'], ['A welcoming island needs no cooperation.', '友善的小島不需要合作。']], 1, 'Each memory shows how shared effort builds belonging.', '每段回憶都說明，共同的努力能建立歸屬感。'),
      q('Clouds may hide the stars on Saturday. Which addition keeps the invitation welcoming and accurate?', '星期六可能有雲遮住星星。加上哪句話能讓邀請保持友善又準確？', [['The sky will definitely be clear because we want it to be.', '因為我們想看星星，所以一定晴空萬里。'], ['If there are clouds, nobody should ever visit again.', '如果有雲，大家以後都不要來。'], ['If the sky is cloudy, we will share our island stories indoors instead.', '如果天空多雲，我們就改在室內分享小島故事。']], 2, 'The alternative keeps the gathering possible without promising the weather.', '備案讓聚會仍能進行，也不對天氣做無法保證的承諾。'),
    ]),
  }),
];

export const getPetDefinition = id => PETS.find(pet => pet.id === id);
export const getFurniture = id => FURNITURE.find(item => item.id === id);
export const getChapter = id => CHAPTERS.find(item => item.id === id);
