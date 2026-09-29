import { getElementaryExample } from "./elementaryExamples.js";

// Publicly documented KNSH elementary word groups. The examples on the cards
// come from EnglishGo's existing elementary dictionary, not textbook sentences.
// Schools can use different KNSH series and school years, so keep book/term and
// source metadata on each curriculum card.
const SCHOOL_LIST_URL = "https://www.zjps.tp.edu.tw/uploads/1750832008939JCeydKpT.pdf";
const WW10_PLAN_URL = "https://tten.tp.edu.tw/Login/Downment?grade=6&spid=94ebd8fd-cd25-40b2-93c6-a2277a66ac03&subject=English";

const COURSE_GROUPS = [
  {
    grade: 1, semester: "總複習", book: "Go Go Starter 1.2 · ABC Review",
    source: SCHOOL_LIST_URL,
    words: `apple|ant|boy|ball|cat|cup|dog|door|elephant|egg|fox|fish|girl|goat|hat|hen|ink|insect|jam|juice|kid|kite|lion|lake|monkey|map|net|nose|octopus|ox|pig|pink|queen|question|robot|rabbit|sun|snake|tiger|toy|umbrella|up|vest|van|water|watch|box|six|yo-yo|yellow|zebra|zoo`,
  },
  {
    grade: 2, semester: "上學期", book: "Wonder World 1",
    source: SCHOOL_LIST_URL,
    words: `age|six|seven|eight|nine|ten|happy|sad|angry|hungry|thirsty|ball|car|doll|kite|robot|yo-yo|blue|green|pink|purple|red|yellow|color`,
  },
  {
    grade: 2, semester: "下學期", book: "Wonder World 2",
    source: SCHOOL_LIST_URL,
    words: `eleven|twelve|thirteen|fourteen|fifteen|bird|cat|dog|frog|rabbit|ox|dance|draw|sing|swim|fly|ride|can|grandfather|grandpa|grandmother|grandma|father|dad|mother|mom|brother|sister|cook|doctor|nurse|student|teacher`,
  },
  {
    grade: 3, semester: "上學期", book: "Wonder World 3",
    source: SCHOOL_LIST_URL,
    words: `sixteen|seventeen|eighteen|nineteen|twenty|weather|cloudy|rainy|sunny|windy|cold|hot|time|o'clock|twenty-five|thirty|thirty-five|forty|forty-five|fifty|fifty-five|book|eraser|pen|pencil|marker|ruler|in|on|under|box|chair|desk|schoolbag`,
  },
  {
    grade: 3, semester: "下學期", book: "Wonder World 4",
    source: SCHOOL_LIST_URL,
    words: `sixty|seventy|eighty|ninety|hundred|bathroom|bedroom|kitchen|dining room|living room|doing|cooking|eating|reading|sleeping|writing|running|hamburger|hot dog|juice|milk|water|ice cream|bear|lion|monkey|tiger|zebra|zoo`,
  },
  {
    grade: 4, semester: "上學期", book: "Wonder World 5",
    source: SCHOOL_LIST_URL,
    words: `coffee|cola|soda|tea|bubble tea|hot chocolate|soy milk|apple|banana|grape|guava|orange|papaya|pineapple|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|today|art|Chinese|English|math|music|PE|science|social studies|his|her|our|their`,
  },
  {
    grade: 4, semester: "下學期", book: "Wonder World 6",
    source: SCHOOL_LIST_URL,
    words: `bakery|bank|bookstore|hospital|park|post office|restaurant|supermarket|bike|bus|car|MRT|plane|scooter|taxi|train|dress|skirt|sweater|shirt|T-shirt|pants|shorts|shoes|sneakers|jacket|dollar|glasses|keys|water bottle|watch|umbrella|smartphone`,
  },
  {
    grade: 5, semester: "上學期", book: "Wonder World 7",
    source: SCHOOL_LIST_URL,
    words: `Australia|Canada|France|India|Japan|Taiwan|UK|USA|from|cold|cough|fever|headache|stomachache|toothache|runny nose|wrong|pizza|rice|soup|steak|dumpling|noodle|sandwich|French fries|would|homework|breakfast|lunch|dinner|get up|school|home|bed|time`,
  },
  {
    grade: 5, semester: "下學期", book: "Wonder World 8",
    source: SCHOOL_LIST_URL,
    words: `listen|music|play|basketball|watch|TV|camping|hiking|shopping|swimming|artist|dentist|farmer|singer|writer|bus driver|police officer|yesterday|library|museum|coffee shop|movie theater|night market|sports center`,
  },
  {
    grade: 6, semester: "上學期", book: "Wonder World 9",
    source: SCHOOL_LIST_URL,
    words: `clean|cook|play|visit|walk|watch|do|dish|laundry|have|breakfast|lunch|dinner|go|shop|swim|yesterday|beach|forest|island|lake|mountain|river|hot spring|convenience store|MRT station|science museum|tea shop|across|between|next`,
  },
  {
    grade: 6, semester: "下學期", book: "Wonder World 10",
    source: WW10_PLAN_URL,
    words: `badminton|baseball|tennis|soccer|volleyball|weekend|picnic|haircut|party|stay|study|trip|sushi|bibimbap|tacos|sausages|Japan|Mexico|South Korea|Germany|bitter|salty|sour|spicy|sweet`,
  },
];

export const KANG_HSUAN_ELEMENTARY_GRADES = Array.from({ length: 6 }, (_, index) => {
  const grade = index + 1;
  return {
    id: `kanghsuan-elementary-${grade}`,
    grade,
    label: `${grade} 年級`,
    icon: ["🌱", "🐣", "📘", "🎒", "🌟", "🎓"][index],
    description: grade === 1 ? "字母與基礎單字" : `Wonder World ${grade * 2 - 3}–${grade * 2 - 2}`,
    books: COURSE_GROUPS.filter(course => course.grade === grade).map(course => course.book),
  };
});

export const KANG_HSUAN_ELEMENTARY_WORDS = COURSE_GROUPS.flatMap(course =>
  [...new Set(course.words.split("|").map(word => word.trim()).filter(Boolean))].map(w => ({
    w,
    publisher: "康軒",
    publisherKey: "kanghsuan",
    schoolGrade: course.grade,
    schoolSemester: course.semester,
    schoolBook: course.book,
    curriculumSource: course.source,
  }))
);

const normalizeWord = word => String(word || "").trim().toLowerCase().replace(/\s+/g, " ");

const FALLBACK_CARD_DETAILS = Object.fromEntries([
  ["apple", "蘋果", "n.", "I eat an apple after lunch.", "我午餐後吃一顆蘋果。"],
  ["ant", "螞蟻", "n.", "An ant walks across the leaf.", "一隻螞蟻爬過葉子。"],
  ["ball", "球", "n.", "We kick the ball in the park.", "我們在公園踢球。"],
  ["fox", "狐狸", "n.", "The fox has a big, fluffy tail.", "狐狸有一條又大又蓬鬆的尾巴。"],
  ["ink", "墨水", "n.", "The blue ink is on my paper.", "我的紙上有藍色墨水。"],
  ["insect", "昆蟲", "n.", "A butterfly is a colorful insect.", "蝴蝶是一種色彩繽紛的昆蟲。"],
  ["jam", "果醬", "n.", "I put strawberry jam on my toast.", "我在吐司上塗草莓果醬。"],
  ["map", "地圖", "n.", "We use a map to find the park.", "我們看地圖找公園。"],
  ["net", "網子", "n.", "The ball lands in the net.", "球落進網子裡。"],
  ["octopus", "章魚", "n.", "The octopus has eight arms.", "章魚有八隻腕足。"],
  ["ox", "公牛", "n.", "The ox walks slowly on the farm.", "公牛在農場慢慢走。"],
  ["queen", "女王", "n.", "The queen waves to the children.", "女王向孩子們揮手。"],
  ["robot", "機器人", "n.", "My robot can dance.", "我的機器人會跳舞。"],
  ["vest", "背心", "n.", "I wear a vest on a cool day.", "天氣涼時我會穿背心。"],
  ["van", "廂型車", "n.", "The white van stops by the school.", "白色廂型車停在學校旁。"],
  ["water", "水", "n.", "I drink water after I run.", "我跑步後喝水。"],
  ["yo-yo", "溜溜球", "n.", "I can play with my yo-yo.", "我會玩溜溜球。"],
  ["zebra", "斑馬", "n.", "The zebra has black and white stripes.", "斑馬身上有黑白條紋。"],
  ["happy", "開心的", "adj.", "I feel happy when I play with my friends.", "和朋友一起玩時我覺得很開心。"],
  ["sad", "難過的", "adj.", "The little boy feels sad when it rains.", "下雨時那個小男孩覺得難過。"],
  ["grandpa", "爺爺；外公", "n.", "My grandpa tells me a funny story.", "爺爺講了一個有趣的故事給我聽。"],
  ["grandma", "奶奶；外婆", "n.", "My grandma makes warm soup for us.", "奶奶為我們煮了熱湯。"],
  ["twenty-five", "二十五", "n.", "I have twenty-five stickers in my book.", "我的冊子裡有二十五張貼紙。"],
  ["thirty-five", "三十五", "n.", "There are thirty-five books on the shelf.", "架子上有三十五本書。"],
  ["forty-five", "四十五", "n.", "The class starts in forty-five minutes.", "四十五分鐘後開始上課。"],
  ["fifty-five", "五十五", "n.", "Grandpa is fifty-five years old.", "爺爺五十五歲。"],
  ["book", "書", "n.", "I read a book before bed.", "我睡前讀一本書。"],
  ["schoolbag", "書包", "n.", "My schoolbag is under the desk.", "我的書包在書桌下面。"],
  ["sixty", "六十", "n.", "There are sixty seconds in a minute.", "一分鐘有六十秒。"],
  ["seventy", "七十", "n.", "The puzzle has seventy pieces.", "這個拼圖有七十片。"],
  ["eighty", "八十", "n.", "There are eighty students at the school fair.", "學校園遊會有八十位學生。"],
  ["ninety", "九十", "n.", "Grandma is ninety years old.", "奶奶九十歲。"],
  ["doing", "正在做", "v.", "What are you doing after school?", "你放學後要做什麼？"],
  ["cooking", "正在煮；烹飪", "v.", "Dad is cooking dinner in the kitchen.", "爸爸正在廚房煮晚餐。"],
  ["eating", "正在吃", "v.", "The children are eating lunch together.", "孩子們正在一起吃午餐。"],
  ["reading", "正在閱讀", "v.", "Mia is reading a story to her brother.", "米亞正在念故事給弟弟聽。"],
  ["sleeping", "正在睡覺", "v.", "The baby is sleeping in the bedroom.", "寶寶正在臥室裡睡覺。"],
  ["writing", "正在寫", "v.", "I am writing a note to my teacher.", "我正在寫一張便條給老師。"],
  ["running", "正在跑步", "v.", "The dog is running in the yard.", "狗正在院子裡跑。"],
  ["cola", "可樂", "n.", "Dad drinks cola with his sandwich.", "爸爸配著三明治喝可樂。"],
  ["soda", "汽水", "n.", "We share a bottle of soda at the picnic.", "我們在野餐時分享一瓶汽水。"],
  ["bubble tea", "珍珠奶茶", "n.", "My aunt buys bubble tea for us.", "阿姨買珍珠奶茶給我們。"],
  ["hot chocolate", "熱巧克力", "n.", "I drink hot chocolate on cold days.", "天冷時我會喝熱巧克力。"],
  ["Chinese", "中文；國語", "n.", "We read a story in Chinese class.", "我們在國語課讀故事。"],
  ["math", "數學", "n.", "We solve number puzzles in math class.", "我們在數學課解數字謎題。"],
  ["PE", "體育", "n.", "We play a team game in PE class.", "我們在體育課玩團體遊戲。"],
  ["science", "自然；科學", "n.", "We learn about plants in science class.", "我們在自然課學習植物。"],
  ["social studies", "社會", "n.", "We learn about maps in social studies.", "我們在社會課認識地圖。"],
  ["school", "學校", "n.", "I go to school every morning.", "我每天早上去上學。"],
  ["park", "公園", "n.", "We ride our bikes in the park.", "我們在公園騎腳踏車。"],
  ["post office", "郵局", "n.", "We send a birthday card at the post office.", "我們在郵局寄生日卡片。"],
  ["plane", "飛機", "n.", "The plane flies above the clouds.", "飛機在雲朵上方飛行。"],
  ["sweater", "毛衣", "n.", "I wear a sweater when it is cold.", "天冷時我會穿毛衣。"],
  ["T-shirt", "T 恤", "n.", "My blue T-shirt has a star on it.", "我的藍色 T 恤上有一顆星星。"],
  ["sneakers", "運動鞋", "n.", "I wear my sneakers for gym class.", "上體育課時我穿運動鞋。"],
  ["glasses", "眼鏡", "n.", "Grandpa wears glasses when he reads.", "爺爺閱讀時會戴眼鏡。"],
  ["keys", "鑰匙", "n.", "I put my keys in my schoolbag.", "我把鑰匙放進書包裡。"],
  ["water bottle", "水壺", "n.", "I fill my water bottle before school.", "上學前我把水壺裝滿。"],
  ["smartphone", "智慧型手機", "n.", "Mom uses her smartphone to call Grandma.", "媽媽用智慧型手機打電話給奶奶。"],
  ["Australia", "澳洲", "n.", "My cousin lives in Australia.", "我的表哥住在澳洲。"],
  ["Canada", "加拿大", "n.", "It is snowy in Canada in winter.", "加拿大冬天會下雪。"],
  ["France", "法國", "n.", "Paris is a city in France.", "巴黎是法國的一座城市。"],
  ["India", "印度", "n.", "My class reads a book about India.", "我們班讀了一本介紹印度的書。"],
  ["Japan", "日本", "n.", "We want to visit Japan one day.", "我們希望有一天去日本旅行。"],
  ["Taiwan", "臺灣", "n.", "I live in Taiwan.", "我住在臺灣。"],
  ["UK", "英國", "n.", "My uncle studies in the UK.", "我叔叔在英國讀書。"],
  ["USA", "美國", "n.", "The USA is across the ocean from Taiwan.", "美國在臺灣的海洋另一邊。"],
  ["cough", "咳嗽", "n./v.", "Cover your mouth when you cough.", "咳嗽時請摀住嘴巴。"],
  ["fever", "發燒", "n.", "Ben stays home because he has a fever.", "班發燒了，所以待在家裡。"],
  ["stomachache", "胃痛", "n.", "I have a stomachache, so I will rest.", "我胃痛了，所以要休息。"],
  ["toothache", "牙痛", "n.", "A toothache makes it hard to eat.", "牙痛讓人很難吃東西。"],
  ["runny nose", "流鼻水", "n.", "I have a runny nose today.", "我今天流鼻水。"],
  ["dumpling", "水餃；餃子", "n.", "We eat dumplings together at dinner.", "我們晚餐一起吃水餃。"],
  ["noodle", "麵條", "n.", "I like noodles with vegetables.", "我喜歡加蔬菜的麵。"],
  ["French fries", "薯條", "n.", "We share French fries after the game.", "比賽後我們一起吃薯條。"],
  ["would", "會；將（用於禮貌詢問）", "v.", "Would you like some soup?", "你想喝一點湯嗎？"],
  ["get up", "起床", "v.", "I get up at seven on school days.", "上學日我七點起床。"],
  ["play", "玩；打（球）", "v.", "We play basketball after school.", "我們放學後打籃球。"],
  ["TV", "電視", "n.", "We watch TV together after dinner.", "我們晚餐後一起看電視。"],
  ["camping", "露營", "n.", "Our family goes camping by the lake.", "我們全家在湖邊露營。"],
  ["hiking", "健行", "n.", "We go hiking on the mountain trail.", "我們在山徑健行。"],
  ["shopping", "購物", "n.", "We go shopping for fruit on Sunday.", "我們星期日去買水果。"],
  ["swimming", "游泳", "n.", "Swimming is fun on a hot day.", "天氣熱時游泳很有趣。"],
  ["artist", "藝術家", "n.", "The artist paints a picture of a dog.", "藝術家畫了一幅狗的圖。"],
  ["dentist", "牙醫", "n.", "The dentist checks my teeth.", "牙醫檢查我的牙齒。"],
  ["singer", "歌手", "n.", "The singer has a beautiful voice.", "這位歌手有好聽的嗓音。"],
  ["writer", "作家", "n.", "The writer makes up a story about a dragon.", "作家編了一個關於龍的故事。"],
  ["bus driver", "公車司機", "n.", "The bus driver stops near the school.", "公車司機在學校附近停車。"],
  ["police officer", "警察", "n.", "The police officer helps us cross the street.", "警察幫我們過馬路。"],
  ["coffee shop", "咖啡店", "n.", "We meet Dad at the coffee shop.", "我們在咖啡店和爸爸碰面。"],
  ["movie theater", "電影院", "n.", "We watch a movie at the movie theater.", "我們在電影院看電影。"],
  ["night market", "夜市", "n.", "We eat fruit at the night market.", "我們在夜市吃水果。"],
  ["sports center", "運動中心", "n.", "I play badminton at the sports center.", "我在運動中心打羽毛球。"],
  ["laundry", "洗衣物；洗衣店", "n.", "I help my dad fold the laundry.", "我幫爸爸摺衣服。"],
  ["shop", "購物；商店", "v./n.", "We shop for apples at the market.", "我們在市場買蘋果。"],
  ["hot spring", "溫泉", "n.", "We visit a hot spring with our family.", "我們和家人一起去泡溫泉。"],
  ["convenience store", "便利商店", "n.", "I buy milk at the convenience store.", "我在便利商店買牛奶。"],
  ["MRT station", "捷運站", "n.", "We meet at the MRT station.", "我們在捷運站碰面。"],
  ["science museum", "科學博物館", "n.", "Our class visits the science museum.", "我們班去參觀科學博物館。"],
  ["tea shop", "茶飲店", "n.", "The tea shop is next to the park.", "茶飲店在公園旁邊。"],
  ["across", "在對面；橫越", "adv./prep.", "The tea shop is across from the park.", "茶飲店在公園對面。"],
  ["haircut", "理髮；剪髮", "n.", "I get a haircut before school starts.", "開學前我去理髮。"],
  ["party", "派對；聚會", "n.", "We have a birthday party for Amy.", "我們為艾美辦生日派對。"],
  ["stay", "待著；停留", "v.", "I stay at home and read on Sunday.", "星期日我待在家裡閱讀。"],
  ["sushi", "壽司", "n.", "My family eats sushi for lunch.", "我家午餐吃壽司。"],
  ["bibimbap", "韓式拌飯", "n.", "The bibimbap has colorful vegetables.", "韓式拌飯裡有各種顏色的蔬菜。"],
  ["tacos", "塔可餅", "n.", "We make tacos with beans and corn.", "我們用豆子和玉米做塔可餅。"],
  ["sausages", "香腸", "n.", "The sausages are hot, so let them cool.", "香腸很燙，先讓它們涼一點。"],
  ["Mexico", "墨西哥", "n.", "Tacos are popular in Mexico.", "塔可餅在墨西哥很受歡迎。"],
  ["South Korea", "南韓", "n.", "Bibimbap is a food from South Korea.", "韓式拌飯是南韓料理。"],
  ["Germany", "德國", "n.", "My pen pal lives in Germany.", "我的筆友住在德國。"],
  ["bitter", "苦的", "adj.", "This dark chocolate tastes a little bitter.", "這塊黑巧克力吃起來有點苦。"],
  ["salty", "鹹的", "adj.", "The soup is too salty for me.", "這碗湯對我來說太鹹了。"],
  ["sour", "酸的", "adj.", "The green lemon tastes sour.", "這顆綠檸檬吃起來很酸。"],
  ["spicy", "辣的", "adj.", "The noodles are spicy, so I drink water.", "麵很辣，所以我喝水。"],
  ["sweet", "甜的", "adj.", "The mango is ripe and sweet.", "這顆芒果熟了，很甜。"],
].map(([word, meaning, pos, ex, ez]) => [normalizeWord(word), { m: meaning, p: pos, ex, ez }]));

export function getKangHsuanCardsForGrade(cards, grade) {
  const sourceCards = Array.isArray(cards) ? cards : [];
  const byWord = new Map();
  sourceCards.forEach(card => {
    const key = normalizeWord(card?.w);
    if (key && !byWord.has(key)) byWord.set(key, card);
  });

  const seen = new Set();
  return KANG_HSUAN_ELEMENTARY_WORDS
    .filter(item => item.schoolGrade === Number(grade))
    .flatMap(item => {
      const key = normalizeWord(item.w);
      if (!key || seen.has(key)) return [];
      const card = byWord.get(key);
      const fallback = FALLBACK_CARD_DETAILS[key];
      if (!card && !fallback) return [];
      seen.add(key);
      const details = fallback || {};
      const cardExampleIsValid = Boolean(card?.ex && card?.ez && !/[\u3400-\u9fff]/.test(card.ex));
      const example = cardExampleIsValid ? { ex: card.ex, ez: card.ez } : fallback?.ex
        ? { ex: fallback.ex, ez: fallback.ez }
        : getElementaryExample(item.w, card?.m || details.m, card?.p || details.p);
      return [{
        ...(card || {}),
        w: item.w,
        p: card?.p || details.p || "n.",
        m: card?.m || details.m || "",
        ex: cardExampleIsValid ? card.ex : fallback?.ex || card?.ex || example.ex,
        ez: cardExampleIsValid ? card.ez : fallback?.ez || card?.ez || example.ez,
        ...item,
      }];
    });
}
