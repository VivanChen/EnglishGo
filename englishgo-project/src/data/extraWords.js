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

function extraWordCard(word,[meaning,pos]){
  return{w:word,ph:"",p:pos,m:meaning,f:[],c:[],ex:`Lily learned the word "${word}" in the story.`,ez:`莉莉在故事中學到「${meaning}」。`,img:""};
}

export const EXTRA_WORDS = {
  elementary: Object.entries(EXTRA_ELEMENTARY_WORDS).map(([word,meta])=>extraWordCard(word,meta)),
  junior: [],
  senior: [],
};
