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

function extraWordCard(word,[meaning,pos]){
  return{w:word,ph:"",p:pos,m:meaning,f:[],c:[],ex:`I can use the word "${word}".`,ez:`我會使用「${meaning}」這個單字。`,img:""};
}

const ELEMENTARY_WORDS = {...BASIC_ELEMENTARY_WORDS,...EXTRA_ELEMENTARY_WORDS};

export const EXTRA_WORDS = {
  elementary: Object.entries(ELEMENTARY_WORDS).map(([word,meta])=>extraWordCard(word,meta)),
  junior: [],
  senior: [],
};
