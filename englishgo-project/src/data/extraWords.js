import { getElementaryExample } from "./elementaryExamples.js";
import { JUNIOR_NOVEL_WORDS } from "./juniorNovelWords.js";
import { MINISTRY_ELEMENTARY_WORDS } from "./ministryElementaryWords.js";

const EXTRA_ELEMENTARY_WORDS = {
  curious:["好奇的","adj."], explore:["探索","v."], forest:["森林","n."], edge:["邊緣","n."], glow:["發光","v."], shadow:["影子","n."],
  magic:["魔法","n."], brave:["勇敢的","adj."], guide:["引導","v."], trust:["信任","v."], fairy:["小精靈","n."], wing:["翅膀","n."],
  petal:["花瓣","n."], twig:["小樹枝","n."], helper:["幫助者","n."], path:["小路","n."], pond:["池塘","n."], crystal:["水晶","n."],
  silent:["安靜的","adj."], gate:["大門","n."], river:["河流","n."], smoky:["煙霧般的","adj."], purple:["紫色的","adj."], bottom:["底部","n."],
  dive:["潛水","v."], ribbon:["緞帶","n."], branch:["樹枝","n."], sparkle:["閃耀","v."], wave:["波浪","n."], journey:["旅程","n."],
  trunk:["樹幹","n."], twisted:["扭曲的","adj."], memory:["記憶","n."], symbol:["符號","n."], spiral:["螺旋","n."], choose:["選擇","v."],
  echo:["回音","n."], smoke:["煙","n."], disappear:["消失","v."], lake:["湖","n."], mirror:["鏡子","n."], reflect:["反射","v."],
  surface:["表面","n."], spirit:["精靈","n."], beneath:["在...下面","prep."], truth:["真相","n."], spoon:["湯匙","n."], complete:["完整的；完成","adj./v."],
  steady:["穩定的","adj."], cave:["洞穴","n."], narrow:["狹窄的","adj."], puzzle:["謎題","n."], keyhole:["鑰匙孔","n."], pattern:["圖案","n."],
  ancient:["古老的","adj."], solid:["堅固的","adj."], tremble:["顫抖","v."], react:["反應","v."], lonely:["孤單的","adj."], evil:["邪惡的","adj."],
  reject:["拒絕","v."], destroy:["破壞","v."], force:["力量","n."], claw:["爪子","n."], gentle:["溫柔的","adj."], peaceful:["平靜的","adj."],
  amazing:["驚人的","adj."], alone:["獨自的","adj."], alive:["活著的","adj."], balance:["平衡","n."], surround:["包圍","v."], entrance:["入口","n."],
  miss:["想念；錯過","v."], courage:["勇氣","n."], kindness:["善良","n."], whisper:["低語","v."], ready:["準備好的","adj."], read:["閱讀","v."],
  write:["書寫","v."], practice:["練習","v."], learn:["學習","v."], strong:["強壯的","adj."], listen:["聽","v."], speak:["說","v."],
  mistake:["錯誤","n."], again:["再一次","adv."], wake:["醒來","v."], wash:["洗","v."], breakfast:["早餐","n."], after:["在...之後","prep."],
  home:["家","n."], dinner:["晚餐","n."], brush:["刷","v."], sleep:["睡覺","v."], night:["夜晚","n."], cat:["貓","n."],
  jump:["跳","v."], dog:["狗","n."], bird:["鳥","n."], fly:["飛","v."], fish:["魚","n."], swim:["游泳","v."], rabbit:["兔子","n."],
  monkey:["猴子","n."], horse:["馬","n."], bee:["蜜蜂","n."],
};

const BASIC_ELEMENTARY_WORDS = {
  little:["小的；少的","adj."], small:["小的","adj."], large:["大的","adj."], long:["長的","adj."], short:["短的；矮的","adj."], tall:["高的","adj."],
  young:["年輕的","adj."], old:["老的；舊的","adj."], new:["新的","adj."], good:["好的","adj."], bad:["壞的","adj."], cute:["可愛的","adj."],
  kind:["親切的；善良的","adj."], nice:["好的；友善的","adj."], clean:["乾淨的；打掃","adj./v."], dirty:["髒的","adj."], hot:["熱的","adj."], cold:["冷的","adj."],
  warm:["溫暖的","adj."], cool:["涼爽的；酷的","adj."], easy:["簡單的","adj."], hard:["困難的；硬的","adj."], fast:["快的","adj."], slow:["慢的","adj."],
  early:["早的","adj./adv."], late:["晚的；遲到的","adj."], full:["飽的；滿的","adj."], hungry:["餓的","adj."], thirsty:["渴的","adj."], tired:["累的","adj."],
  sick:["生病的","adj."], funny:["好笑的","adj."], quiet:["安靜的","adj."], loud:["大聲的","adj."], beautiful:["美麗的","adj."], favorite:["最喜歡的","adj./n."],
  red:["紅色；紅色的","n./adj."], blue:["藍色；藍色的","n./adj."], green:["綠色；綠色的","n./adj."], yellow:["黃色；黃色的","n./adj."], black:["黑色；黑色的","n./adj."],
  white:["白色；白色的","n./adj."], brown:["棕色；棕色的","n./adj."], pink:["粉紅色；粉紅色的","n./adj."], orange:["橘色；柳橙","n./adj."], gray:["灰色；灰色的","n./adj."],
  mother:["媽媽；母親","n."], mom:["媽媽","n."], father:["爸爸；父親","n."], dad:["爸爸","n."], parent:["父母親","n."], sister:["姊妹","n."],
  brother:["兄弟","n."], baby:["寶寶","n."], child:["小孩","n."], children:["小孩們","n."], girl:["女孩","n."], boy:["男孩","n."],
  man:["男人","n."], woman:["女人","n."], teacher:["老師","n."], student:["學生","n."], class:["班級；課","n."], family:["家人；家庭","n."],
  head:["頭","n."], hair:["頭髮","n."], face:["臉","n."], eye:["眼睛","n."], ear:["耳朵","n."], nose:["鼻子","n."],
  mouth:["嘴巴","n."], hand:["手","n."], arm:["手臂","n."], leg:["腿","n."], foot:["腳","n."], feet:["腳","n."],
  rice:["飯；米","n."], bread:["麵包","n."], milk:["牛奶","n."], egg:["蛋","n."], cake:["蛋糕","n."], cookie:["餅乾","n."],
  banana:["香蕉","n."], juice:["果汁","n."], tea:["茶","n."], lunch:["午餐","n."], soup:["湯","n."], candy:["糖果","n."],
  cow:["牛","n."], pig:["豬","n."], duck:["鴨子","n."], chicken:["雞；雞肉","n."], sheep:["羊","n."], mouse:["老鼠","n."],
  tiger:["老虎","n."], lion:["獅子","n."], elephant:["大象","n."], bear:["熊","n."], turtle:["烏龜","n."], snake:["蛇","n."],
  go:["去","v."], come:["來","v."], walk:["走路","v."], look:["看","v."], see:["看見","v."], watch:["觀看","v."],
  make:["製作","v."], take:["拿；帶","v."], open:["打開","v."], close:["關閉","v."], sit:["坐","v."], stand:["站","v."],
  drink:["喝","v."], draw:["畫畫","v."], sing:["唱歌","v."], dance:["跳舞","v."], cook:["煮飯","v."], help:["幫助","v."],
  like:["喜歡","v."], love:["愛；喜愛","v."], want:["想要","v."], need:["需要","v."], know:["知道","v."], think:["想；認為","v."],
  say:["說","v."], tell:["告訴","v."], ask:["問","v."], answer:["回答","v."], buy:["買","v."], use:["使用","v."],
  find:["找到","v."], carry:["攜帶","v."], classroom:["教室","n."], room:["房間","n."], house:["房子","n."], kitchen:["廚房","n."],
  bathroom:["浴室","n."], bedroom:["臥室","n."], door:["門","n."], window:["窗戶","n."], table:["桌子","n."], chair:["椅子","n."],
  desk:["書桌","n."], bed:["床","n."], bus:["公車","n."], car:["車子","n."], bike:["腳踏車","n."], street:["街道","n."],
  playground:["操場；遊樂場","n."], market:["市場","n."], today:["今天","n./adv."], tomorrow:["明天","n./adv."], yesterday:["昨天","n./adv."], afternoon:["下午","n."],
  evening:["傍晚；晚上","n."], week:["週","n."], month:["月","n."], year:["年","n."], day:["天；日子","n."], sun:["太陽","n."],
  moon:["月亮","n."], star:["星星","n."], tree:["樹","n."], flower:["花","n."], grass:["草","n."], sky:["天空","n."],
  rain:["雨；下雨","n./v."], wind:["風","n."], snow:["雪；下雪","n./v."], pen:["筆","n."], pencil:["鉛筆","n."], ruler:["尺","n."],
  bag:["袋子；書包","n."], eraser:["橡皮擦","n."], notebook:["筆記本","n."], paper:["紙","n."], page:["頁","n."], in:["在...裡面","prep."],
  on:["在...上面","prep."], under:["在...下面","prep."], by:["在...旁邊；藉由","prep."], near:["靠近","prep."], who:["誰","pron."],
  what:["什麼","pron."], where:["哪裡","adv."], when:["什麼時候","adv."], why:["為什麼","adv."], how:["如何；怎麼","adv."],
  and:["和；而且","conj."], but:["但是","conj."], because:["因為","conj."], very:["非常","adv."], too:["也；太","adv."], here:["這裡","adv."],
  there:["那裡","adv."], yes:["是；好的","adv."], no:["不；沒有","adv."],
};

const MORE_BASIC_ELEMENTARY_WORDS = {
  zero:["零","n."], one:["一","n."], two:["二","n."], three:["三","n."], four:["四","n."], five:["五","n."],
  six:["六","n."], seven:["七","n."], eight:["八","n."], nine:["九","n."], ten:["十","n."], eleven:["十一","n."],
  twelve:["十二","n."], thirteen:["十三","n."], fourteen:["十四","n."], fifteen:["十五","n."], sixteen:["十六","n."], seventeen:["十七","n."],
  eighteen:["十八","n."], nineteen:["十九","n."], twenty:["二十","n."], thirty:["三十","n."], forty:["四十","n."], fifty:["五十","n."],
  hundred:["一百","n."], first:["第一；首先","adj./adv."], second:["第二","adj."], third:["第三","adj."], last:["最後的","adj."], next:["下一個；接著","adj./adv."],
  monday:["星期一","n."], tuesday:["星期二","n."], wednesday:["星期三","n."], thursday:["星期四","n."], friday:["星期五","n."], saturday:["星期六","n."],
  sunday:["星期日","n."], january:["一月","n."], february:["二月","n."], march:["三月；行進","n./v."], april:["四月","n."], may:["五月；可以","n./v."],
  june:["六月","n."], july:["七月","n."], august:["八月","n."], september:["九月","n."], october:["十月","n."], november:["十一月","n."],
  december:["十二月","n."], morning:["早上","n."], noon:["中午","n."], minute:["分鐘","n."], hour:["小時","n."], time:["時間","n."],
  me:["我","pron."], my:["我的","pron."], mine:["我的東西","pron."], you:["你；你們","pron."], your:["你的；你們的","pron."], he:["他","pron."],
  him:["他","pron."], his:["他的","pron."], she:["她","pron."], her:["她；她的","pron."], it:["它","pron."], its:["它的","pron."],
  we:["我們","pron."], us:["我們","pron."], our:["我們的","pron."], they:["他們","pron."], them:["他們","pron."], their:["他們的","pron."],
  this:["這個","pron."], that:["那個","pron."], these:["這些","pron."], those:["那些","pron."], everyone:["每個人","pron."], someone:["某人","pron."],
  from:["從；來自","prep."], to:["到；給","prep."], for:["為了；給","prep."], with:["和...一起","prep."], without:["沒有","prep."], about:["關於","prep."],
  before:["在...之前","prep."], behind:["在...後面","prep."], beside:["在...旁邊","prep."], between:["在...之間","prep."], inside:["在裡面","adv./prep."], outside:["在外面","adv./prep."],
  into:["進入","prep."], out:["外出；出去","adv."], up:["向上","adv."], down:["向下","adv."], left:["左邊；左邊的","n./adj."], right:["右邊；正確的","n./adj."],
  have:["有","v."], has:["有","v."], give:["給","v."], get:["得到；拿到","v."], put:["放","v."], move:["移動","v."],
  turn:["轉動；輪到","v./n."], start:["開始","v."], stop:["停止","v."], wait:["等待","v."], work:["工作","v./n."], study:["讀書；學習","v."],
  try:["嘗試","v."], live:["居住；生活","v."], visit:["拜訪；參觀","v."], meet:["遇見；見面","v."], call:["打電話；呼叫","v."], show:["展示","v."],
  share:["分享","v."], keep:["保持","v."], begin:["開始","v."], finish:["完成；結束","v."], ride:["騎；搭乘","v."], drive:["開車","v."],
  smile:["微笑","v./n."], cry:["哭","v."], laugh:["笑","v."], shout:["大叫","v."], touch:["觸摸","v."], point:["指；點","v./n."],
  noodles:["麵","n."], pizza:["披薩","n."], hamburger:["漢堡","n."], sandwich:["三明治","n."], salad:["沙拉","n."], vegetable:["蔬菜","n."],
  fruit:["水果","n."], tomato:["番茄","n."], potato:["馬鈴薯","n."], carrot:["紅蘿蔔","n."], corn:["玉米","n."], meat:["肉","n."],
  beef:["牛肉","n."], pork:["豬肉","n."], snack:["點心","n."], sugar:["糖","n."], salt:["鹽","n."], chocolate:["巧克力","n."],
  shirt:["襯衫","n."], tshirt:["T恤","n."], pants:["褲子","n."], shorts:["短褲","n."], skirt:["裙子","n."], dress:["洋裝；穿","n./v."],
  shoes:["鞋子","n."], socks:["襪子","n."], hat:["帽子","n."], cap:["帽子","n."], coat:["外套","n."], jacket:["夾克","n."],
  farm:["農場","n."], beach:["海灘","n."], mountain:["山","n."], sea:["海","n."], station:["車站","n."], museum:["博物館","n."],
  office:["辦公室","n."], post:["郵件；張貼","n./v."], store:["商店","n."], supermarket:["超級市場","n."], library:["圖書館","n."], zoo:["動物園","n."],
  leaf:["葉子","n."], rock:["岩石","n."], stone:["石頭","n."], sand:["沙","n."], cloud:["雲","n."], rainbow:["彩虹","n."],
  homework:["家庭作業","n."], lesson:["課；課程","n."], test:["考試；測驗","n."], question:["問題","n."], story:["故事","n."], song:["歌曲","n."],
  letter:["字母；信","n."], word:["單字","n."], sentence:["句子","n."], picture:["圖片；照片","n."], computer:["電腦","n."], phone:["電話","n."],
  game:["遊戲","n."], toy:["玩具","n."], doll:["娃娃","n."], kite:["風箏","n."], soccer:["足球","n."], basketball:["籃球","n."],
  baseball:["棒球","n."], music:["音樂","n."], art:["美術；藝術","n."], movie:["電影","n."], many:["許多","adj."], much:["許多；非常","adj./adv."],
  more:["更多","adj./adv."], some:["一些","adj."], any:["任何；一些","adj."], every:["每一個","adj."], each:["每個","adj."], all:["全部","adj."],
  both:["兩者都","adj./pron."], few:["少數的","adj."], same:["相同的","adj."], different:["不同的","adj."], wrong:["錯的","adj."], ok:["好的","adj."],
};

function extraWordCard(word,meta){
  const [meaning,pos]=Array.isArray(meta)?meta:[meta.m,meta.p];
  const example = Array.isArray(meta) || !meta.ex
    ? getElementaryExample(word, meaning, pos)
    : {ex:meta.ex,ez:meta.ez};
  return{w:word,ph:"",p:pos,m:meaning,f:[],c:meta.c||[],ex:example.ex,ez:example.ez,img:meta.img||""};
}

const ELEMENTARY_WORDS = {...BASIC_ELEMENTARY_WORDS,...MORE_BASIC_ELEMENTARY_WORDS,...EXTRA_ELEMENTARY_WORDS,...MINISTRY_ELEMENTARY_WORDS};

export const EXTRA_WORDS = {
  elementary: Object.entries(ELEMENTARY_WORDS).map(([word,meta])=>extraWordCard(word,meta)),
  junior: JUNIOR_NOVEL_WORDS,
  senior: [],
};
