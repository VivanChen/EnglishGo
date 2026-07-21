import { lazy, Suspense, useEffect, useRef, useState } from "react";

const LazyPixelPet=lazy(()=>import("../components/PixelPet.jsx"));
function PixelPetFallback({size=180}){return <span style={{display:"inline-block",width:size,height:size,borderRadius:12,background:"linear-gradient(135deg,var(--color-background-secondary,#f3f2ee),var(--color-background-primary,#fff))"}}/>}
function PixelPet(props){return <Suspense fallback={<PixelPetFallback size={props.size}/>}> <LazyPixelPet {...props}/> </Suspense>}

let G,Hdr,S,V,escapeRegexSafe,getAdventurePetDef,levelUpPet,shuffleCopy;
const PET_MONOPOLY_TILES=[
  {id:"start",type:"start",name:"起點",icon:"🏁",hint:"經過可領取補給"},
  {id:"word-market",type:"word",name:"單字市集",icon:"🔤",hint:"看中文選英文"},
  {id:"grammar-gate",type:"grammar",name:"文法城門",icon:"¶",hint:"補上正確句型"},
  {id:"coin-park",type:"event",name:"金幣公園",icon:"🪙",hint:"答對拿小獎"},
  {id:"pet-school",type:"training",name:"寵物學院",icon:"🎓",hint:"寵物 EXP 加成"},
  {id:"word-harbor",type:"word",name:"單字港口",icon:"⚓",hint:"核心字彙挑戰"},
  {id:"north-station",type:"word",name:"台北車站",icon:"🚄",hint:"快速翻譯挑戰"},
  {id:"shop",type:"shop",name:"補給商店",icon:"🛒",hint:"答對換補給金"},
  {id:"grammar-plaza",type:"grammar",name:"文法廣場",icon:"▦",hint:"句型四選一"},
  {id:"chance",type:"event",name:"命運卡",icon:"✦",hint:"隨機學習事件"},
  {id:"east-coast",type:"training",name:"花東海岸",icon:"🌊",hint:"寵物默契訓練"},
  {id:"word-station",type:"word",name:"單字車站",icon:"🚉",hint:"快速翻譯"},
  {id:"training-yard",type:"training",name:"訓練庭院",icon:"🏋️",hint:"寵物羈絆提升"},
  {id:"forest-class",type:"grammar",name:"阿里山課堂",icon:"🌲",hint:"文法判斷"},
  {id:"grammar-tower",type:"grammar",name:"文法塔",icon:"🏰",hint:"高分文法題"},
  {id:"treasure",type:"event",name:"寶箱格",icon:"🎁",hint:"答對開寶箱"},
  {id:"south-market",type:"shop",name:"台南補給站",icon:"🥤",hint:"補給與金幣"},
  {id:"word-library",type:"word",name:"單字圖書館",icon:"📚",hint:"例句單字"},
  {id:"pet-camp",type:"training",name:"寵物營地",icon:"⛺",hint:"休息後更親密"},
  {id:"science-port",type:"word",name:"高雄港口",icon:"🚢",hint:"港口單字挑戰"},
  {id:"grammar-lab",type:"grammar",name:"句型研究所",icon:"🔬",hint:"句型推理"},
  {id:"island-fair",type:"event",name:"島嶼市集",icon:"🎡",hint:"隨機獎勵"},
  {id:"pet-spa",type:"training",name:"溫泉寵物館",icon:"♨️",hint:"寵物恢復"},
  {id:"boss",type:"boss",name:"Boss 城堡",icon:"👑",hint:"高獎勵英文關卡"},
];
const PET_MONOPOLY_GRID=[
  [7,7],[6,7],[5,7],[4,7],[3,7],[2,7],[1,7],
  [1,6],[1,5],[1,4],[1,3],[1,2],
  [1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],
  [7,2],[7,3],[7,4],[7,5],[7,6],
];
const PET_MONOPOLY_COMPUTERS=[
  {id:"cpu1",name:"電腦 1",color:"#2563EB",emoji:"🔵"},
  {id:"cpu2",name:"電腦 2",color:"#D97706",emoji:"🟠"},
  {id:"cpu3",name:"電腦 3",color:"#DB2777",emoji:"🟣"},
];
const PET_MONOPOLY_TYPE_META={
  start:{label:"起點",color:"#0F9F7A",soft:"#E7FFF5"},
  word:{label:"單字",color:"#2563EB",soft:"#EFF6FF"},
  grammar:{label:"文法",color:"#7C3AED",soft:"#F5F3FF"},
  event:{label:"機會",color:"#D97706",soft:"#FFF7ED"},
  shop:{label:"商店",color:"#0891B2",soft:"#ECFEFF"},
  training:{label:"培養",color:"#DB2777",soft:"#FDF2F8"},
  boss:{label:"Boss",color:"#DC2626",soft:"#FEF2F2"},
};
const PET_MONOPOLY_CARDS=[
  {id:"boost",name:"\u52a0\u901f\u5361",icon:"\u2191",short:"+2",color:"#2563EB",desc:"\u4e0b\u6b21\u64f2\u9ab0 +2"},
  {id:"shield",name:"\u8b77\u76fe\u5361",icon:"\u25c7",short:"1/2",color:"#0F9F7A",desc:"\u4e0b\u6b21\u904e\u8def\u8cbb\u6e1b\u534a"},
  {id:"rent",name:"\u6536\u79df\u5361",icon:"$",short:"x2",color:"#D97706",desc:"\u4e0b\u6b21\u6536\u79df\u52a0\u500d"},
];
const PET_MONOPOLY_CARD_BY_ID=PET_MONOPOLY_CARDS.reduce((map,card)=>({...map,[card.id]:card}),{});
const PET_MONOPOLY_STAKES=[100,300,500];
const PET_MONOPOLY_GRAND_PRIZE={coins:80,xp:30,title:"勝利大禮包"};
const PET_MONOPOLY_DICE_ROLL_MS=520;
const PET_MONOPOLY_PLAYER_STEP_MS=190;
const PET_MONOPOLY_CPU_STEP_MS=155;
const PET_MONOPOLY_CPU_GAP_MS=420;
const PET_MONOPOLY_EVENT_DECK=[
  {id:"portal",name:"傳送門",kind:"portal",coins:4,xp:2,petExp:0,bond:0,text:"前往最近無主地"},
  {id:"tailwind",name:"順風前進",kind:"move",steps:2,coins:6,xp:3,petExp:3,bond:1,text:"前進 2 格"},
  {id:"detour",name:"臨時繞路",kind:"move",steps:-2,coins:3,xp:2,petExp:2,bond:0,text:"後退 2 格"},
  {id:"coin-rain",name:"金幣雨",kind:"reward",coins:20,xp:2,petExp:2,bond:1,text:"獲得大量金幣"},
  {id:"pet-snack",name:"寵物零食",kind:"reward",coins:6,xp:2,petExp:18,bond:5,text:"寵物成長加速"},
  {id:"tax",name:"臨時稅",kind:"tax",coins:0,xp:3,petExp:0,bond:0,text:"依地產數繳金幣"},
  {id:"draw-boost",name:"加速補給",kind:"card",cardId:"boost",coins:5,xp:2,petExp:2,bond:1,text:"抽到加速卡"},
  {id:"draw-shield",name:"護盾補給",kind:"card",cardId:"shield",coins:5,xp:2,petExp:2,bond:1,text:"抽到護盾卡"},
  {id:"draw-rent",name:"收租補給",kind:"card",cardId:"rent",coins:5,xp:2,petExp:2,bond:1,text:"抽到收租卡"},
  {id:"upgrade-coupon",name:"升級折扣",kind:"upgradeDiscount",discount:12,coins:6,xp:2,petExp:4,bond:1,text:"下一次升級少 12 金幣"},
  {id:"rent-spark",name:"收租加成",kind:"card",cardId:"rent",coins:8,xp:2,petExp:3,bond:1,text:"準備下次收租加倍"},
  {id:"cpu-pause",name:"電腦停買",kind:"cpuPause",coins:8,xp:2,petExp:3,bond:1,text:"電腦下一輪不能收購"},
  {id:"boss-shortcut",name:"Boss 捷徑",kind:"bossShortcut",coins:4,xp:4,petExp:8,bond:2,text:"前往 Boss 前哨"},
];
const PET_MONOPOLY_WORD_MODES=[
  {id:"zhToEn",label:"中文選英文"},
  {id:"enToZh",label:"英文選中文"},
  {id:"exampleBlank",label:"例句填空"},
  {id:"partOfSpeech",label:"詞性提示"},
  {id:"context",label:"情境判斷"},
];
function pickPetMonopolyWord(lv,seed=0,recentWords=[]){
  const list=(V[lv]||V.elementary||[]).filter(w=>w?.w&&w?.m);
  const recent=new Set((recentWords||[]).map(w=>String(w).toLowerCase()));
  const fresh=list.filter(w=>!recent.has(String(w.w).toLowerCase()));
  const source=fresh.length?fresh:list;
  return source[Math.abs(seed)%Math.max(1,source.length)]||{w:"learn",m:"學習",p:"v.",ex:"I learn English."};
}
function getPetMonopolyChoicePool(pool,mapChoice,count=3){
  const used=new Set();
  const choices=[];
  shuffleCopy(pool).forEach(item=>{
    const value=String(mapChoice(item)||"").trim();
    if(!value||used.has(value))return;
    used.add(value);
    choices.push(value);
  });
  return choices.slice(0,count);
}
function buildPetMonopolyQuestion(lv,tile,seed=0,recentWords=[]){
  const wordTiles=["word","event","shop","training","start"];
  const grammarList=(G[lv]||G.elementary||[]).filter(g=>g?.q?.s&&Array.isArray(g?.q?.o));
  if((tile?.type==="grammar"||tile?.type==="boss")&&grammarList.length){
    const topic=grammarList[Math.abs(seed)%grammarList.length];
    return{
      kind:"grammar",
      title:`英文挑戰：${topic.t}`,
      prompt:topic.q.s,
      sub:`${topic.d}${topic.pattern?` · ${topic.pattern}`:""}`,
      choices:topic.q.o.map(String),
      answer:topic.q.a,
      explain:topic.q.o[topic.q.a],
    };
  }
  const word=pickPetMonopolyWord(lv,seed,recentWords);
  const pool=(V[lv]||V.elementary||[]).filter(w=>w?.w&&w?.m&&w.w!==word.w);
  const mode=PET_MONOPOLY_WORD_MODES[Math.abs(seed)%PET_MONOPOLY_WORD_MODES.length];
  const englishWrongs=getPetMonopolyChoicePool(pool,w=>w.w,3);
  const meaningWrongs=getPetMonopolyChoicePool(pool,w=>w.m,3);
  const englishChoices=shuffleCopy([word.w,...englishWrongs]);
  const meaningChoices=shuffleCopy([word.m,...meaningWrongs]);
  const example=String(word.ex||"").trim();
  const blankExample=example&&new RegExp(escapeRegexSafe(word.w),"i").test(example)
    ?example.replace(new RegExp(escapeRegexSafe(word.w),"ig"),"____")
    :`____：${word.m}`;
  const modeBuilders={
    zhToEn:()=>({
      prompt:`「${word.m}」的英文是？`,
      sub:word.p?`${word.p}${example?` · ${example}`:""}`:example||"看中文選出正確英文",
      choices:englishChoices,
      answer:englishChoices.indexOf(word.w),
      explain:word.w,
    }),
    enToZh:()=>({
      prompt:`「${word.w}」的中文意思是？`,
      sub:word.p?`${word.p}${example?` · ${example}`:""}`:example||"看英文選出正確中文",
      choices:meaningChoices,
      answer:meaningChoices.indexOf(word.m),
      explain:word.m,
    }),
    exampleBlank:()=>({
      prompt:blankExample,
      sub:"選出最適合放進例句的英文單字",
      choices:englishChoices,
      answer:englishChoices.indexOf(word.w),
      explain:word.w,
    }),
    partOfSpeech:()=>({
      prompt:`${word.p||"單字"} · ${word.m}`,
      sub:example||"用詞性與中文意思判斷英文",
      choices:englishChoices,
      answer:englishChoices.indexOf(word.w),
      explain:word.w,
    }),
    context:()=>({
      prompt:`在「${tile?.name||"學習島"}」看到「${word.m}」，要選哪個英文？`,
      sub:example||"依情境選出正確單字",
      choices:englishChoices,
      answer:englishChoices.indexOf(word.w),
      explain:word.w,
    }),
  };
  const built=(modeBuilders[mode.id]||modeBuilders.zhToEn)();
  return{
    kind:wordTiles.includes(tile?.type)?"word":"word",
    title:`英文挑戰：${mode.label}`,
    mode:mode.id,
    modeLabel:mode.label,
    prompt:built.prompt,
    sub:built.sub,
    choices:built.choices,
    answer:built.answer,
    explain:built.explain,
    word,
  };
}
function getPetMonopolyReward(tile,lapBonus=false){
  const table={
    start:{xp:4,coins:0,petExp:4,bond:1,label:"起點補給"},
    word:{xp:8,coins:0,petExp:9,bond:2,label:"單字街獎勵"},
    grammar:{xp:10,coins:0,petExp:10,bond:2,label:"文法地產獎勵"},
    event:{xp:7,coins:0,petExp:7,bond:2,label:"機會命運"},
    shop:{xp:6,coins:10,petExp:6,bond:1,label:"商店補給"},
    training:{xp:9,coins:0,petExp:18,bond:5,label:"寵物訓練"},
    boss:{xp:18,coins:18,petExp:28,bond:8,label:"Boss 勝利獎勵"},
  };
  const base=table[tile?.type]||table.word;
  return lapBonus?{...base,xp:base.xp+6,coins:base.coins+8,petExp:base.petExp+4,bond:base.bond+1,label:`${base.label} + 繞行一圈`}:base;
}
function rollPetMonopolyDice(){
  try{
    const arr=new Uint32Array(1);
    crypto.getRandomValues(arr);
    return(arr[0]%6)+1;
  }catch{return Math.floor(Math.random()*6)+1}
}
function getPetMonopolyMovePath(from,dice,total){
  return Array.from({length:Math.max(0,Number(dice)||0)},(_,i)=>(from+i+1)%total);
}
function isPetMonopolyOwnable(tile){
  return["word","grammar","shop","training"].includes(tile?.type);
}
function getPetMonopolyTileCost(tile){
  const table={word:24,grammar:32,shop:28,training:30};
  return table[tile?.type]||24;
}
function getPetMonopolyUpgradeCost(property){
  return 18+(Number(property?.level)||1)*12;
}
function getPetMonopolyYield(property){
  const level=Number(property?.level)||1;
  return{coins:5+level*5,xp:level*2,petExp:level*3};
}
function getPetMonopolyRent(tile,property){
  const table={word:7,grammar:9,shop:8,training:8};
  const level=Number(property?.level)||1;
  return(table[tile?.type]||6)+(Math.max(0,level-1)*5);
}
function getPetMonopolyPropertyValue(tile,property){
  if(!tile||!property)return 0;
  const level=Number(property?.level)||1;
  return getPetMonopolyTileCost(tile)+(Math.max(0,level-1)*24);
}
function getPetMonopolyCpuOwner(computers,tileId,limit=3,excludeId=""){
  return(computers||[]).slice(0,limit).find(cpu=>cpu?.id!==excludeId&&(cpu?.owned||[]).includes(tileId))||null;
}
export function settlePetMonopolyBankruptComputers(computers=[],limit=3){
  const eliminated=[];
  const next=(computers||[]).map((cpu,i)=>{
    if(i<limit&&cpu?.active!==false&&(Number(cpu.coins)||0)<=0){
      eliminated.push(cpu);
      return{...cpu,coins:0,active:false,owned:[]};
    }
    return cpu;
  });
  return{next,eliminated};
}
function getPetMonopolyDistance(from,to,total){
  return((Number(to)||0)-(Number(from)||0)+total)%total;
}
function getNextPetMonopolyOpenTile(tiles,fromIndex,owned={},computers=[],computerCount=3){
  const total=tiles.length;
  for(let step=1;step<=total;step++){
    const index=(fromIndex+step)%total;
    const tile=tiles[index];
    if(isPetMonopolyOwnable(tile)&&!owned?.[tile.id]&&!getPetMonopolyCpuOwner(computers,tile.id,computerCount)){
      return{tile,index,step};
    }
  }
  return null;
}
export function getPetMonopolyCpuBuyDecision({cpu,tile,cost,availableCoins,playerPosition,tileIndex,total}){
  if(!cpu||cpu.active===false||!isPetMonopolyOwnable(tile)||!cost||availableCoins<cost||availableCoins<50)return{buy:false,reason:""};
  const priority={grammar:3,training:3,shop:2,word:1}[tile.type]||1;
  const afterBuy=availableCoins-cost;
  const distance=getPetMonopolyDistance(playerPosition,tileIndex,total);
  const pressure=distance>0&&distance<=4?8:0;
  const reserve=priority>=3?42:priority===2?56:70;
  const ownedCount=(cpu.owned||[]).length;
  const buy=afterBuy>=reserve+pressure||(priority>=3&&afterBuy>=34)||(priority===2&&ownedCount<2&&afterBuy>=48);
  return{buy,reason:buy?"buy":"reserve"};
}
function getPetMonopolyAffinityBonus(question,petDef){
  const focus=String(question?.word?.w||"").toLowerCase();
  if(!focus||!(petDef?.words||[]).map(w=>String(w).toLowerCase()).includes(focus))return{coins:0,petExp:0,label:""};
  return{coins:4,petExp:5,label:`${petDef.name} 熟悉 ${focus}，技能加成`};
}
function getPetMonopolyComboBonus(streak){
  if(streak<3)return{coins:0,xp:0,petExp:0,label:""};
  const tier=Math.min(4,Math.floor(streak/3));
  return{coins:tier*3,xp:tier*2,petExp:tier*2,label:`連勝 ${streak} 回合，加碼獎勵`};
}
function getPetMonopolyEventCard(tile,seed=0){
  const offsets={"coin-park":0,chance:1,treasure:4,"island-fair":8};
  const offset=offsets[tile?.id]??0;
  return PET_MONOPOLY_EVENT_DECK[Math.abs((Number(seed)||0)+offset)%PET_MONOPOLY_EVENT_DECK.length];
}
function getPetMonopolyTileTwist(tile,seed=0,context={}){
  if(tile?.type==="event"){
    const card=getPetMonopolyEventCard(tile,seed);
    const base={kind:card.kind,coins:card.coins||0,xp:card.xp||0,petExp:card.petExp||0,bond:card.bond||0,eventId:card.id,label:`${card.name}：${card.text}`};
    if(card.kind==="portal"){
      const target=getNextPetMonopolyOpenTile(
        context.tiles||PET_MONOPOLY_TILES,
        Number(context.position)||0,
        context.owned||{},
        context.computers||[],
        Number(context.computerCount)||3,
      );
      if(target)return{...base,label:`${card.name}：前往 ${target.tile.name}`,targetTileId:target.tile.id,targetIndex:target.index};
      return{...base,kind:"bonus",coins:10,xp:3,petExp:4,bond:1,label:`${card.name}：全地圖已被收購，改拿補給`};
    }
    if(card.kind==="move"){
      const tiles=context.tiles||PET_MONOPOLY_TILES;
      const total=tiles.length;
      const from=Number(context.position)||0;
      const index=(from+(Number(card.steps)||0)+total*4)%total;
      const target=tiles[index];
      return{...base,label:`${card.name}：${card.steps>0?"前進":"後退"} ${Math.abs(card.steps)} 格到 ${target?.name||"下一格"}`,targetTileId:target?.id,targetIndex:index,moveSteps:card.steps};
    }
    if(card.kind==="bossShortcut"){
      const tiles=context.tiles||PET_MONOPOLY_TILES;
      const bossIndex=tiles.findIndex(item=>item.id==="boss");
      const index=bossIndex>0?bossIndex-1:Math.max(0,tiles.length-1);
      const target=tiles[index];
      return{...base,label:`${card.name}：前往 ${target?.name||"Boss 前哨"}`,targetTileId:target?.id,targetIndex:index};
    }
    if(card.kind==="tax"){
      const tax=Math.max(3,Math.min(18,(Number(context.propertyCount)||0)*4||3));
      return{...base,coins:-tax,label:`${card.name}：繳 ${tax} 金幣`};
    }
    if(card.kind==="card"){
      return{...base,cardId:card.cardId};
    }
    if(card.kind==="upgradeDiscount"){
      return{...base,upgradeDiscount:card.discount||0};
    }
    if(card.kind==="cpuPause"){
      return{...base,cpuBuyPause:1};
    }
    return base;
  }
  if(tile?.type==="boss"){
    return{coins:10,xp:5,petExp:8,bond:2,label:"Boss 戰利品：皇冠寶箱"};
  }
  return null;
}
function getPetMonopolyCardDrop(tile,seed=0){
  if(!tile||tile.type==="event")return null;
  if(tile.type!=="boss"&&Math.abs(Number(seed)||0)%4!==0)return null;
  if(tile?.type==="word")return"boost";
  if(tile?.type==="grammar"||tile?.type==="shop")return"shield";
  if(tile?.type==="training"||tile?.type==="boss")return"rent";
  return null;
}
function growPetFromMonopoly(pet,reward){
  if(!pet)return pet;
  let next={
    ...pet,
    exp:Math.max(0,Number(pet.exp)||0)+(reward.petExp||0),
    bond:Math.min(100,Math.max(0,Number(pet.bond)||0)+(reward.bond||0)),
    energy:Math.max(0,Math.min(100,Number(pet.energy??80)-2)),
    hunger:Math.max(0,Math.min(100,Number(pet.hunger??80)-1)),
    lastUpdate:new Date().toISOString(),
  };
  for(let i=0;i<8;i++){
    const leveled=levelUpPet(next);
    if(leveled===next)break;
    next=leveled;
  }
  return next;
}
function PetMonopolyM({lv,onBack,onXp,c,pets=[],setPets,coins=0,setCoins}){
  const color=c?.cl||"#0F6E56";
  const accent=c?.ac||"#1D9E75";
  const tiles=PET_MONOPOLY_TILES;
  const walletCoins=Number(coins)||0;
  const defaultStake=walletCoins>=100?100:PET_MONOPOLY_STAKES[0];
  const[gameStarted,setGameStarted]=useState(false);
  const[setupComputerCount,setSetupComputerCount]=useState(3);
  const[stake,setStake]=useState(defaultStake);
  const[gameCoins,setGameCoins]=useState(0);
  const[petIndex,setPetIndex]=useState(0);
  const[position,setPosition]=useState(0);
  const[dice,setDice]=useState(null);
  const[turn,setTurn]=useState(0);
  const[pending,setPending]=useState(null);
  const[owned,setOwned]=useState({});
  const[offer,setOffer]=useState(null);
  const[lastMove,setLastMove]=useState(null);
  const[feedback,setFeedback]=useState("你的回合");
  const[eventFlash,setEventFlash]=useState(null);
  const[rentFlash,setRentFlash]=useState(null);
  const[rentDialog,setRentDialog]=useState(null);
  const[screenEffect,setScreenEffect]=useState(null);
  const[grandPrize,setGrandPrize]=useState(null);
  const[winner,setWinner]=useState(null);
  const[cardHand,setCardHand]=useState({boost:0,shield:0,rent:0});
  const[cardEffects,setCardEffects]=useState({boost:false,shield:false,rent:false});
  const[cardFlash,setCardFlash]=useState(null);
  const[cardUsedTurn,setCardUsedTurn]=useState(-1);
  const[score,setScore]=useState({correct:0,wrong:0,laps:0,boss:0});
  const[streak,setStreak]=useState(0);
  const[moving,setMoving]=useState(null);
  const[computerCount,setComputerCount]=useState(3);
  const[cpuBuyPause,setCpuBuyPause]=useState(0);
  const[upgradeDiscount,setUpgradeDiscount]=useState(0);
  const[recentQuestionWords,setRecentQuestionWords]=useState([]);
  const[computers,setComputers]=useState(()=>PET_MONOPOLY_COMPUTERS.map((cpu,i)=>({...cpu,position:(i+3)%PET_MONOPOLY_TILES.length,coins:100,owned:[],active:true})));
  const computersRef=useRef(computers);
  const ownedRef=useRef(owned);
  const cardEffectsRef=useRef(cardEffects);
  const cpuBuyPauseRef=useRef(cpuBuyPause);
  const recentQuestionWordsRef=useRef(recentQuestionWords);
  const moveTimersRef=useRef([]);
  const rentContinuationRef=useRef(null);
  const grandPrizeClaimedRef=useRef(false);
  const selectedPet=pets?.[petIndex]||null;
  const selectedPetDef=selectedPet?getAdventurePetDef(selectedPet):null;
  useEffect(()=>{
    if(typeof window==="undefined"||/jsdom/i.test(navigator?.userAgent||""))return;
    const resetScroll=()=>{
      try{window.scrollTo({top:0,left:0,behavior:"instant"})}catch{try{window.scrollTo(0,0)}catch{}}
      try{
        [document.scrollingElement,document.documentElement,document.body,...document.querySelectorAll("main,section,div")].forEach(el=>{
          if(el&&el.scrollTop>0)el.scrollTop=0;
          if(el&&el.scrollLeft>0)el.scrollLeft=0;
        });
      }catch{}
    };
    resetScroll();
    const raf=requestAnimationFrame(resetScroll);
    const timer=setTimeout(resetScroll,80);
    return()=>{cancelAnimationFrame(raf);clearTimeout(timer)};
  },[]);
  useEffect(()=>{if(pets.length&&petIndex>=pets.length)setPetIndex(0)},[pets.length,petIndex]);
  useEffect(()=>{ownedRef.current=owned},[owned]);
  useEffect(()=>{cardEffectsRef.current=cardEffects},[cardEffects]);
  useEffect(()=>{cpuBuyPauseRef.current=cpuBuyPause},[cpuBuyPause]);
  useEffect(()=>{recentQuestionWordsRef.current=recentQuestionWords},[recentQuestionWords]);
  useEffect(()=>()=>{moveTimersRef.current.forEach(clearTimeout);moveTimersRef.current=[]},[]);
  const clearMoveTimers=()=>{moveTimersRef.current.forEach(clearTimeout);moveTimersRef.current=[]};
  const updateGameCoins=updater=>setGameCoins(prev=>Math.max(0,typeof updater==="function"?updater(prev):updater));
  const updateComputers=updater=>setComputers(prev=>{
    const next=typeof updater==="function"?updater(prev):updater;
    computersRef.current=next;
    return next;
  });
  const updateCardEffects=updater=>setCardEffects(prev=>{
    const next=typeof updater==="function"?updater(prev):updater;
    cardEffectsRef.current=next;
    return next;
  });
  const showScreenEffect=effect=>{
    if(!effect)return;
    setScreenEffect({
      id:`${effect.kind||"effect"}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      color,
      icon:"✦",
      ...effect,
    });
  };
  const startGame=()=>{
    const buyIn=Number(stake)||0;
    if(buyIn<=0||walletCoins<buyIn)return;
    clearMoveTimers();
    setCoins?.(v=>Math.max(0,(Number(v)||0)-buyIn));
    setGameCoins(buyIn);
    setComputerCount(setupComputerCount);
    const nextComputers=PET_MONOPOLY_COMPUTERS.map((cpu,i)=>({...cpu,position:(i+3)%PET_MONOPOLY_TILES.length,coins:buyIn,owned:[],active:true}));
    computersRef.current=nextComputers;
    setComputers(nextComputers);
    setPosition(0);
    setDice(null);
    setTurn(0);
    setPending(null);
    setOwned({});
    ownedRef.current={};
    setOffer(null);
    setLastMove(null);
    setFeedback("你的回合");
    setEventFlash(null);
    setRentFlash(null);
    setRentDialog(null);
    rentContinuationRef.current=null;
    setScreenEffect(null);
    setGrandPrize(null);
    setWinner(null);
    grandPrizeClaimedRef.current=false;
    setCardHand({boost:0,shield:0,rent:0});
    setCardEffects({boost:false,shield:false,rent:false});
    cardEffectsRef.current={boost:false,shield:false,rent:false};
    setCardFlash(null);
    setCardUsedTurn(-1);
    setScore({correct:0,wrong:0,laps:0,boss:0});
    setStreak(0);
    setMoving(null);
    updateCpuBuyPause(0);
    setUpgradeDiscount(0);
    setRecentQuestionWords([]);
    recentQuestionWordsRef.current=[];
    setGameStarted(true);
  };
  const exitGame=()=>{
    if(gameStarted&&gameCoins>0)setCoins?.(v=>Math.max(0,(Number(v)||0)+gameCoins));
    onBack?.();
  };
  const updateCpuBuyPause=updater=>setCpuBuyPause(prev=>{
    const next=Math.max(0,typeof updater==="function"?updater(prev):updater);
    cpuBuyPauseRef.current=next;
    return next;
  });
  const rememberQuestionWord=question=>{
    const key=String(question?.word?.w||"").toLowerCase();
    if(!key)return;
    setRecentQuestionWords(prev=>{
      const next=[key,...prev.filter(item=>item!==key)].slice(0,12);
      recentQuestionWordsRef.current=next;
      return next;
    });
  };
  const awardCard=cardId=>{
    const card=PET_MONOPOLY_CARD_BY_ID[cardId];
    if(!card)return;
    setCardHand(prev=>({...prev,[cardId]:Math.min(3,(Number(prev[cardId])||0)+1)}));
    setCardFlash({title:"\u7372\u5f97\u9053\u5177",text:`${card.name} ${card.desc}`,color:card.color,icon:card.icon,effect:"gain"});
    showScreenEffect({kind:"card",effect:"gain",source:"card",title:"獲得道具",value:card.name,icon:card.icon,color:card.color});
  };
  const useCard=cardId=>{
    const card=PET_MONOPOLY_CARD_BY_ID[cardId];
    if(!card||moving||pending||rentDialog||grandPrize||cardUsedTurn===turn||(Number(cardHand[cardId])||0)<=0||cardEffects[cardId])return;
    setCardHand(prev=>({...prev,[cardId]:Math.max(0,(Number(prev[cardId])||0)-1)}));
    updateCardEffects(prev=>({...prev,[cardId]:true}));
    setCardUsedTurn(turn);
    setCardFlash({title:"\u5df2\u4f7f\u7528",text:`${card.name} ${card.desc}`,color:card.color,icon:card.icon,effect:"use"});
    showScreenEffect({kind:"card",effect:"use",source:"card",title:"使用道具",value:card.name,icon:card.icon,color:card.color});
  };
  const liveComputers=(list=computersRef.current)=>list.slice(0,computerCount).filter(cpu=>cpu?.active!==false);
  const retireBankruptComputers=list=>settlePetMonopolyBankruptComputers(list,computerCount);
  const claimGrandPrize=()=>{
    if(grandPrizeClaimedRef.current)return;
    grandPrizeClaimedRef.current=true;
    setWinner("player");
    setGrandPrize({...PET_MONOPOLY_GRAND_PRIZE,id:`grand-${Date.now()}`});
    setCoins?.(v=>Math.max(0,(Number(v)||0)+PET_MONOPOLY_GRAND_PRIZE.coins));
    onXp?.(PET_MONOPOLY_GRAND_PRIZE.xp);
    showScreenEffect({kind:"grand-prize",title:PET_MONOPOLY_GRAND_PRIZE.title,value:`+${PET_MONOPOLY_GRAND_PRIZE.coins}`,icon:"🎁",color:"#D97706"});
  };
  const showRentMoment=(event,continuation)=>{
    rentContinuationRef.current=continuation||null;
    setRentDialog({
      id:`rent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...event,
    });
  };
  const confirmRentMoment=()=>{
    const dialog=rentDialog;
    const continuation=rentContinuationRef.current;
    rentContinuationRef.current=null;
    setRentDialog(null);
    if(dialog?.winner==="player"){
      claimGrandPrize();
      return;
    }
    continuation?.();
  };
  const currentTile=tiles[position];
  const currentProperty=owned[currentTile.id];
  const currentMeta=PET_MONOPOLY_TYPE_META[currentTile.type]||PET_MONOPOLY_TYPE_META.word;
  const activeCards=PET_MONOPOLY_CARDS.filter(card=>cardEffects[card.id]);
  const currentYield=currentProperty?getPetMonopolyYield(currentProperty):null;
  const currentUpgradeBaseCost=currentProperty?getPetMonopolyUpgradeCost(currentProperty):0;
  const currentUpgradeCost=currentProperty?Math.max(5,currentUpgradeBaseCost-upgradeDiscount):0;
  const offerTile=offer?tiles.find(t=>t.id===offer.tileId):null;
  const propertyCount=Object.keys(owned).length;
  const activeComputers=liveComputers(computers);
  const playerAssetValue=Object.entries(owned).reduce((sum,[tileId,property])=>sum+getPetMonopolyPropertyValue(tiles.find(t=>t.id===tileId),property),0);
  const rankings=[
    {id:"player",name:"玩家",emoji:"🐾",color,score:(Number(gameCoins)||0)+playerAssetValue,owned:propertyCount},
    ...activeComputers.map(cpu=>({
      id:cpu.id,
      name:cpu.name,
      emoji:cpu.emoji,
      color:cpu.color,
      score:(Number(cpu.coins)||0)+cpu.owned.reduce((sum,tileId)=>sum+getPetMonopolyTileCost(tiles.find(t=>t.id===tileId)),0),
      owned:cpu.owned.length,
    })),
  ].sort((a,b)=>b.score-a.score);
  const playComputerRound=()=>{
    clearMoveTimers();
    const totalPlayers=computerCount;
    const playOne=index=>{
      if(index>=totalPlayers){
        setMoving(null);
        if(cpuBuyPauseRef.current>0)updateCpuBuyPause(v=>Math.max(0,v-1));
        setFeedback(prev=>prev?.startsWith("輪到")?prev:"輪到你。");
        return;
      }
      const cpu=computersRef.current[index];
      if(!cpu||cpu.active===false)return playOne(index+1);
      const rolled=rollPetMonopolyDice();
      const nextPos=(cpu.position+rolled)%tiles.length;
      const tile=tiles[nextPos];
      const path=getPetMonopolyMovePath(cpu.position,rolled,tiles.length);
      setMoving({actor:"cpu",name:cpu.name,dice:rolled,to:tile.name,step:0,total:path.length,phase:"rolling"});
      showScreenEffect({kind:"dice",title:cpu.name,value:rolled,icon:"🎲",color:cpu.color});
      path.forEach((pos,step)=>{
        const timer=setTimeout(()=>{
          updateComputers(prev=>prev.map((item,i)=>i===index?{...item,position:pos}:item));
          if(step+1<path.length){
            setMoving({actor:"cpu",name:cpu.name,dice:rolled,to:tile.name,step:step+1,total:path.length,phase:"walking"});
            return;
          }
          const current=computersRef.current[index]||cpu;
          const playerProperty=ownedRef.current[tile.id];
          const otherCpuOwner=getPetMonopolyCpuOwner(computersRef.current,tile.id,computerCount,current.id);
          const already=current.owned.includes(tile.id);
          const ownedByAny=!!playerProperty||!!otherCpuOwner||already;
          const tileBonus=tile.type==="shop"?5:tile.type==="event"?3:0;
          const buyCost=isPetMonopolyOwnable(tile)?getPetMonopolyTileCost(tile):0;
          const buyPaused=(Number(cpuBuyPauseRef.current)||0)>0;
          const buyDecision=getPetMonopolyCpuBuyDecision({
            cpu:current,
            tile,
            cost:buyCost,
            availableCoins:current.coins+tileBonus,
            playerPosition:position,
            tileIndex:nextPos,
            total:tiles.length,
          });
          const canBuy=isPetMonopolyOwnable(tile)&&!ownedByAny&&!buyPaused&&buyDecision.buy;
          const cost=canBuy?buyCost:0;
          let nextCoins=Math.max(0,current.coins+tileBonus-cost);
          let rentPaid=0;
          if(playerProperty){
            const rentBoostActive=!!cardEffectsRef.current.rent;
            const rentBase=getPetMonopolyRent(tile,playerProperty);
            const rentDue=rentBoostActive?rentBase*2:rentBase;
            rentPaid=Math.min(rentDue,nextCoins);
            nextCoins=Math.max(0,nextCoins-rentPaid);
            if(rentPaid){
              updateGameCoins(v=>v+rentPaid);
              if(rentBoostActive){
                updateCardEffects(prev=>({...prev,rent:false}));
                setCardFlash({title:"\u6536\u79df\u5361",text:`\u6536\u79df x2 +${rentPaid}`,color:PET_MONOPOLY_CARD_BY_ID.rent.color,icon:PET_MONOPOLY_CARD_BY_ID.rent.icon,effect:"use"});
                showScreenEffect({kind:"card",effect:"use",source:"card",title:"收租卡",value:`+${rentPaid}`,icon:PET_MONOPOLY_CARD_BY_ID.rent.icon,color:PET_MONOPOLY_CARD_BY_ID.rent.color});
              }
              setRentFlash({title:"\u6536\u79df",text:rentBoostActive?`${current.name} +${rentPaid}\uff5c\u6536\u79df\u5361 x2`:`${current.name} +${rentPaid}`,color,effect:"rent-in",amount:rentPaid,icon:"$"});
              showScreenEffect({kind:"rent-in",title:"收租",value:`+${rentPaid}`,icon:"$",color});
            }
          }else if(otherCpuOwner){
            rentPaid=Math.min(getPetMonopolyRent(tile,{level:1}),nextCoins);
            nextCoins=Math.max(0,nextCoins-rentPaid);
            if(rentPaid){
              setRentFlash({title:"過路費",text:`${current.name} → ${otherCpuOwner.name} ${rentPaid}`,color:otherCpuOwner.color,effect:"rent-cpu",amount:rentPaid,icon:"$"});
              showScreenEffect({kind:"rent-cpu",title:"過路費",value:rentPaid,icon:"$",color:otherCpuOwner.color});
            }
          }
          const updatedComputers=computersRef.current.map(item=>{
            if(item.id===current.id)return{
              ...item,
              position:nextPos,
              coins:nextCoins,
              owned:canBuy?[...item.owned,tile.id]:item.owned,
            };
            if(otherCpuOwner&&item.id===otherCpuOwner.id&&rentPaid)return{...item,coins:item.coins+rentPaid};
            return item;
          });
          const settled=retireBankruptComputers(updatedComputers);
          updateComputers(settled.next);
          if(canBuy)showScreenEffect({kind:"buy",title:cpu.name,value:tile.name,icon:tile.icon,color:current.color});
          setMoving({actor:"cpu",name:cpu.name,dice:rolled,to:tile.name,step:path.length,total:path.length,result:canBuy?"收購":tile.type==="event"?"事件":"停留",phase:"done"});
          const playerWon=liveComputers(settled.next).length===0;
          const continueCpuRound=()=>{
            if(playerWon){
              claimGrandPrize();
              return;
            }
            const nextTimer=setTimeout(()=>playOne(index+1),PET_MONOPOLY_CPU_GAP_MS);
            moveTimersRef.current.push(nextTimer);
          };
          if(rentPaid){
            const payee=playerProperty?"玩家":otherCpuOwner?.name||"電腦";
            showRentMoment({
              kind:playerProperty?"rent-in":"rent-cpu",
              payer:current.name,
              payee,
              amount:rentPaid,
              tileName:tile.name,
              color:playerProperty?color:otherCpuOwner?.color||color,
              winner:playerWon?"player":"",
              joke:playerProperty?"電腦摸摸口袋：這堂英文課怎麼還要付學費？":"電腦互收租金，裁判先喝口水。",
            },continueCpuRound);
          }else{
            continueCpuRound();
          }
        },PET_MONOPOLY_DICE_ROLL_MS+PET_MONOPOLY_CPU_STEP_MS*(step+1));
        moveTimersRef.current.push(timer);
      });
    };
    playOne(0);
  };
  const queueComputerRound=(delay=300)=>{
    if(winner||grandPrize)return;
    const nextCpu=liveComputers()[0];
    if(!nextCpu){
      claimGrandPrize();
      return;
    }
    setMoving({actor:"cpu",name:nextCpu.name||"電腦 1",dice:"",to:"",step:0,total:0,phase:"waiting"});
    const timer=setTimeout(playComputerRound,delay);
    moveTimersRef.current.push(timer);
  };
  const roll=()=>{
    if(pending||offer||moving||rentDialog||grandPrize||winner)return;
    const baseRoll=rollPetMonopolyDice();
    const boostActive=!!cardEffectsRef.current.boost;
    const rolled=baseRoll+(boostActive?2:0);
    const nextPos=(position+rolled)%tiles.length;
    const tile=tiles[nextPos];
    const question=buildPetMonopolyQuestion(lv,tile,turn+position+nextPos+rolled,recentQuestionWordsRef.current);
    const lapBonus=nextPos<=position&&position!==0;
    const path=getPetMonopolyMovePath(position,rolled,tiles.length);
    setDice(rolled);
    setLastMove(null);
    setEventFlash(null);
    setRentFlash(null);
    if(boostActive){
      updateCardEffects(prev=>({...prev,boost:false}));
      setCardFlash({title:"\u52a0\u901f\u5361",text:`${baseRoll} + 2 = ${rolled}`,color:PET_MONOPOLY_CARD_BY_ID.boost.color,icon:PET_MONOPOLY_CARD_BY_ID.boost.icon,effect:"use"});
    }else{
      setCardFlash(null);
    }
    showScreenEffect({kind:"dice",title:"玩家",value:rolled,icon:"🎲",color});
    setMoving({actor:"player",dice:rolled,to:tile.name,step:0,total:path.length,phase:"rolling"});
    setFeedback(`骰出 ${rolled}`);
    clearMoveTimers();
    path.forEach((pos,step)=>{
      const timer=setTimeout(()=>{
        setPosition(pos);
        if(step+1<path.length){
          setMoving({actor:"player",dice:rolled,to:tile.name,step:step+1,total:path.length,phase:"walking"});
        }else{
          setMoving(null);
          setLastMove({dice:rolled,tile});
          setPending({dice:rolled,nextPos,tile,question,lapBonus});
          setFeedback(`到達「${tile.name}」`);
        }
      },PET_MONOPOLY_DICE_ROLL_MS+PET_MONOPOLY_PLAYER_STEP_MS*(step+1));
      moveTimersRef.current.push(timer);
    });
  };
  const answer=idx=>{
    if(!pending)return;
    const correct=idx===pending.question.answer;
    rememberQuestionWord(pending.question);
    if(correct){
      const baseReward=getPetMonopolyReward(pending.tile,pending.lapBonus);
      const property=ownedRef.current[pending.tile.id];
      const cpuOwner=getPetMonopolyCpuOwner(computersRef.current,pending.tile.id,computerCount);
      const propertyYield=property?getPetMonopolyYield(property):{coins:0,xp:0,petExp:0};
      const affinity=getPetMonopolyAffinityBonus(pending.question,selectedPetDef);
      const nextStreak=streak+1;
      const combo=getPetMonopolyComboBonus(nextStreak);
      const twist=getPetMonopolyTileTwist(pending.tile,turn+pending.dice+pending.nextPos,{
        tiles,
        position:pending.nextPos,
        owned:ownedRef.current,
        computers:computersRef.current,
        computerCount,
        propertyCount,
        selectedPetDef,
      });
      const reward={
        ...baseReward,
        coins:baseReward.coins+propertyYield.coins+affinity.coins+combo.coins+(twist?.coins||0),
        xp:baseReward.xp+propertyYield.xp+combo.xp+(twist?.xp||0),
        petExp:baseReward.petExp+propertyYield.petExp+affinity.petExp+combo.petExp+(twist?.petExp||0),
        bond:baseReward.bond+(twist?.bond||0),
      };
      const totalXp=reward.xp;
      const totalCoins=reward.coins;
      const shieldActive=!!(cpuOwner&&cardEffectsRef.current.shield);
      const rentBase=cpuOwner?getPetMonopolyRent(pending.tile,{level:1}):0;
      const rentDue=shieldActive?Math.ceil(rentBase/2):rentBase;
      const rentPaid=cpuOwner?Math.min(rentDue,Math.max(0,(Number(gameCoins)||0)+totalCoins)):0;
      const rentMoment=cpuOwner&&rentPaid?{
        kind:"rent-out",
        payer:"玩家",
        payee:cpuOwner.name,
        amount:rentPaid,
        tileName:pending.tile.name,
        color:cpuOwner.color,
        joke:shieldActive?"護盾卡把帳單砍半，電腦只好小聲嘆氣。":"電腦拿出收據：這格地今天有點貴喔。",
      }:null;
      const continueAfterRent=fn=>rentMoment?showRentMoment(rentMoment,fn):fn();
      setScore(s=>({correct:s.correct+1,wrong:s.wrong,laps:s.laps+(pending.lapBonus?1:0),boss:s.boss+(pending.tile.type==="boss"?1:0)}));
      setStreak(nextStreak);
      onXp?.(totalXp);
      updateGameCoins(v=>v+totalCoins-rentPaid);
      if(twist?.upgradeDiscount)setUpgradeDiscount(prev=>Math.max(prev,twist.upgradeDiscount));
      if(twist?.cpuBuyPause)updateCpuBuyPause(prev=>Math.max(prev,twist.cpuBuyPause));
      if(cpuOwner&&rentPaid){
        updateComputers(prev=>prev.map(cpu=>cpu.id===cpuOwner.id?{...cpu,coins:cpu.coins+rentPaid}:cpu));
        if(shieldActive){
          updateCardEffects(prev=>({...prev,shield:false}));
          setCardFlash({title:"\u8b77\u76fe\u5361",text:`\u904e\u8def\u8cbb\u6e1b\u534a -${Math.max(0,rentBase-rentPaid)}`,color:PET_MONOPOLY_CARD_BY_ID.shield.color,icon:PET_MONOPOLY_CARD_BY_ID.shield.icon,effect:"use"});
          showScreenEffect({kind:"card",effect:"use",source:"card",title:"護盾卡",value:"過路費 1/2",icon:PET_MONOPOLY_CARD_BY_ID.shield.icon,color:PET_MONOPOLY_CARD_BY_ID.shield.color});
        }
        setRentFlash({title:"\u904e\u8def\u8cbb",text:shieldActive?`${cpuOwner.name} +${rentPaid}\uff5c\u8b77\u76fe\u6e1b\u534a`:`${cpuOwner.name} +${rentPaid}`,color:cpuOwner.color,effect:"rent-out",amount:rentPaid,icon:"$"});
        showScreenEffect({kind:"rent-out",title:"過路費",value:`-${rentPaid}`,icon:"$",color:cpuOwner.color});
      }else{
        setRentFlash(null);
      }
      if(selectedPet&&setPets){
        setPets(prev=>(prev||[]).map((pet,i)=>i===petIndex?growPetFromMonopoly(pet,reward):pet));
      }
      const propertyText=property?`，地產收益 +${propertyYield.coins} 金幣`:"";
      const affinityText=affinity.label?`，${affinity.label}`:"";
      const comboText=combo.label?`，${combo.label}`:"";
      const twistText=twist?`，${twist.label}`:"";
      const buyText=!property&&isPetMonopolyOwnable(pending.tile)?` 可收購：${getPetMonopolyTileCost(pending.tile)} 金幣。`:"";
      const bossText=pending.tile.type==="boss"?" Boss 擊敗。":"";
      const coinText=totalCoins>0?`、+${totalCoins} 金幣`:"";
      const msg=`答對 +${totalXp} XP${coinText}${propertyText}${affinityText}${comboText}${twistText}。${bossText}${buyText}`;
      setFeedback(msg);
      if(twist){
        setEventFlash({
          title:pending.tile.type==="boss"?"Boss 寶箱":"機會 / 命運",
          text:twist.label.replace(/^命運卡：/,"").replace(/^Boss 戰利品：/,""),
          color:PET_MONOPOLY_TYPE_META[pending.tile.type]?.color||color,
          effect:"event",
          icon:pending.tile.icon,
        });
        showScreenEffect({kind:"event",title:pending.tile.type==="boss"?"Boss 寶箱":"機會 / 命運",value:twist.name||pending.tile.name,icon:pending.tile.icon,color:PET_MONOPOLY_TYPE_META[pending.tile.type]?.color||color});
      }else{
        setEventFlash(null);
      }
      awardCard(twist?.cardId||getPetMonopolyCardDrop(pending.tile,turn+pending.dice+pending.nextPos));
      if(twist?.targetTileId){
        const targetTile=tiles.find(t=>t.id===twist.targetTileId);
        const targetIndex=tiles.findIndex(t=>t.id===twist.targetTileId);
        const targetCpuOwner=getPetMonopolyCpuOwner(computersRef.current,twist.targetTileId,computerCount);
        if(targetTile&&targetIndex>=0){
          setPosition(targetIndex);
          setLastMove({dice:pending.dice,tile:targetTile});
          if(isPetMonopolyOwnable(targetTile)&&!ownedRef.current[targetTile.id]&&!targetCpuOwner){
            setOffer({tileId:targetTile.id,cost:getPetMonopolyTileCost(targetTile)});
          }else{
            continueAfterRent(()=>queueComputerRound());
          }
        }else{
          continueAfterRent(()=>queueComputerRound());
        }
      }else{
        if(property){
          const nextOwned={...ownedRef.current,[pending.tile.id]:{...ownedRef.current[pending.tile.id],visits:(Number(ownedRef.current[pending.tile.id]?.visits)||0)+1}};
          ownedRef.current=nextOwned;
          setOwned(nextOwned);
        }
        if(!property&&!cpuOwner&&isPetMonopolyOwnable(pending.tile)){
          setOffer({tileId:pending.tile.id,cost:getPetMonopolyTileCost(pending.tile)});
        }else{
          continueAfterRent(()=>queueComputerRound());
        }
      }
    }else{
      const penalty=Math.min(Math.max(2,pending.dice),Math.max(0,Number(gameCoins)||0));
      const cpuOwner=getPetMonopolyCpuOwner(computersRef.current,pending.tile.id,computerCount);
      const shieldActive=!!(cpuOwner&&cardEffectsRef.current.shield);
      const rentBase=cpuOwner?getPetMonopolyRent(pending.tile,{level:1}):0;
      const rentDue=shieldActive?Math.ceil(rentBase/2):rentBase;
      const rentPaid=cpuOwner?Math.min(rentDue,Math.max(0,(Number(gameCoins)||0)-penalty)):0;
      const rentMoment=cpuOwner&&rentPaid?{
        kind:"rent-out",
        payer:"玩家",
        payee:cpuOwner.name,
        amount:rentPaid,
        tileName:pending.tile.name,
        color:cpuOwner.color,
        joke:"答錯已經很痛，電腦還補一張租金帳單。",
      }:null;
      if(penalty||rentPaid)updateGameCoins(v=>v-penalty-rentPaid);
      if(cpuOwner&&rentPaid){
        updateComputers(prev=>prev.map(cpu=>cpu.id===cpuOwner.id?{...cpu,coins:cpu.coins+rentPaid}:cpu));
        if(shieldActive){
          updateCardEffects(prev=>({...prev,shield:false}));
          setCardFlash({title:"\u8b77\u76fe\u5361",text:`\u904e\u8def\u8cbb\u6e1b\u534a -${Math.max(0,rentBase-rentPaid)}`,color:PET_MONOPOLY_CARD_BY_ID.shield.color,icon:PET_MONOPOLY_CARD_BY_ID.shield.icon,effect:"use"});
          showScreenEffect({kind:"card",effect:"use",source:"card",title:"護盾卡",value:"過路費 1/2",icon:PET_MONOPOLY_CARD_BY_ID.shield.icon,color:PET_MONOPOLY_CARD_BY_ID.shield.color});
        }
        setRentFlash({title:"\u904e\u8def\u8cbb",text:shieldActive?`${cpuOwner.name} +${rentPaid}\uff5c\u8b77\u76fe\u6e1b\u534a`:`${cpuOwner.name} +${rentPaid}`,color:cpuOwner.color,effect:"rent-out",amount:rentPaid,icon:"$"});
        showScreenEffect({kind:"rent-out",title:"過路費",value:`-${rentPaid}`,icon:"$",color:cpuOwner.color});
      }else{
        setRentFlash(null);
      }
      setScore(s=>({correct:s.correct,wrong:s.wrong+1,laps:s.laps,boss:s.boss}));
      setStreak(0);
      const msg=`失敗 -${penalty} 金幣｜答案：${pending.question.explain}`;
      setFeedback(msg);
      setEventFlash(null);
      if(rentMoment)showRentMoment(rentMoment,()=>queueComputerRound());
      else queueComputerRound();
    }
    setTurn(t=>t+1);
    setPending(null);
  };
  const buyProperty=()=>{
    if(!offer)return;
    const tile=tiles.find(t=>t.id===offer.tileId);
    if(!tile)return setOffer(null);
    if((Number(gameCoins)||0)<offer.cost){
      setFeedback(`金幣不足，還差 ${offer.cost-(Number(gameCoins)||0)} 金幣才能收購「${tile.name}」。`);
      return;
    }
    updateGameCoins(v=>v-offer.cost);
    const nextOwned={...ownedRef.current,[tile.id]:{level:1,visits:1}};
    ownedRef.current=nextOwned;
    setOwned(nextOwned);
    const msg=`已收購「${tile.name}」`;
    setFeedback(msg);
    showScreenEffect({kind:"buy",title:"收購地產",value:tile.name,icon:tile.icon,color});
    setOffer(null);
    queueComputerRound();
  };
  const skipOffer=()=>{
    if(offer)setFeedback("略過收購");
    setOffer(null);
    queueComputerRound();
  };
  const upgradeCurrentProperty=()=>{
    const property=owned[currentTile.id];
    if(!property||property.level>=3)return;
    const cost=currentUpgradeCost;
    if((Number(gameCoins)||0)<cost){
      setFeedback(`升級金幣不足，還差 ${cost-(Number(gameCoins)||0)} 金幣。`);
      return;
    }
    updateGameCoins(v=>v-cost);
    if(upgradeDiscount>0)setUpgradeDiscount(0);
    const nextOwned={...ownedRef.current,[currentTile.id]:{...property,level:property.level+1}};
    ownedRef.current=nextOwned;
    setOwned(nextOwned);
    const msg=`${currentTile.name} Lv.${property.level+1}`;
    setFeedback(msg);
    showScreenEffect({kind:"upgrade",title:"地產升級",value:`Lv.${property.level+1}`,icon:currentTile.icon,color});
    queueComputerRound();
  };
  const accuracy=Math.round((score.correct/Math.max(1,score.correct+score.wrong))*100);
  const goalDone=propertyCount>=4||score.boss>0;
  const goalText=score.boss>0?"Boss 擊敗":propertyCount>=4?"資產勝利":`收購 ${Math.max(0,4-propertyCount)} 格或擊敗 Boss`;
  const canUpgradeCurrent=!!currentProperty&&currentProperty.visits>=2&&currentProperty.level<3;
  return(<div className="pet-monopoly" style={{"--pm-accent":color,"--pm-accent-2":accent,"--pm-border":S.bd,"--pm-card":S.bg1,"--pm-surface":S.bg2,"--pm-text":S.t1,"--pm-muted":S.t2}}>
    <Hdr t="🎲 寵物大富翁" onBack={exitGame} cl={color}/>
    <style>{`
      .pet-monopoly{position:relative;display:grid;gap:12px;color:var(--pm-text)}
      .pet-monopoly button{font-family:inherit}
      .pm-setup{border:1px solid color-mix(in srgb,var(--pm-accent) 28%,var(--pm-border));border-radius:24px;background:linear-gradient(135deg,#F7FFFC,var(--pm-card));padding:18px;display:grid;gap:16px;box-shadow:0 22px 52px rgba(15,110,86,.1)}
      .pm-setup-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
      .pm-setup-title{font-size:28px;font-weight:1000;line-height:1.05;letter-spacing:0}
      .pm-setup-sub{font-size:13px;color:var(--pm-muted);font-weight:800;margin-top:6px}
      .pm-setup-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .pm-setup-panel{border:1px solid color-mix(in srgb,var(--pm-accent) 20%,var(--pm-border));border-radius:18px;background:rgba(255,255,255,.74);padding:14px;display:grid;gap:10px}
      .pm-option-row{display:flex;gap:8px;flex-wrap:wrap}
      .pm-option{border:1px solid color-mix(in srgb,var(--pm-accent) 20%,var(--pm-border));background:var(--pm-card);color:var(--pm-text);border-radius:14px;padding:10px 14px;font-size:14px;font-weight:1000;cursor:pointer;min-width:72px}
      .pm-option.is-active{background:var(--pm-accent);border-color:var(--pm-accent);color:#fff;box-shadow:0 12px 24px color-mix(in srgb,var(--pm-accent) 22%,transparent)}
      .pm-option:disabled{opacity:.42;cursor:not-allowed;box-shadow:none}
      .pm-start{border:0;border-radius:16px;background:linear-gradient(135deg,var(--pm-accent),var(--pm-accent-2));color:#fff;padding:13px 18px;font-size:15px;font-weight:1000;cursor:pointer;box-shadow:0 16px 32px color-mix(in srgb,var(--pm-accent) 24%,transparent)}
      .pm-start:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
      .pm-game-hud{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;align-items:stretch}
      .pm-hud-pill{border:1px solid color-mix(in srgb,var(--hud-color) 26%,var(--pm-border));border-radius:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--hud-color) 10%,#fff),rgba(255,255,255,.9));padding:9px 10px;font-size:12px;font-weight:900;color:var(--pm-muted)}
      .pm-hud-pill b{display:block;color:var(--hud-color);font-size:16px;line-height:1.15;margin-top:3px}
      .pm-hero{order:3;border:1px solid color-mix(in srgb,var(--pm-accent) 30%,var(--pm-border));border-radius:20px;background:radial-gradient(circle at 18% 12%,color-mix(in srgb,var(--pm-accent) 22%,transparent),transparent 30%),radial-gradient(circle at 92% 20%,rgba(250,204,21,.24),transparent 26%),linear-gradient(135deg,#F8FFF8,var(--pm-card));padding:14px 16px;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:12px;box-shadow:0 18px 38px rgba(15,110,86,.08)}
      .pm-kicker{display:inline-flex;align-items:center;gap:7px;color:var(--pm-accent);background:color-mix(in srgb,var(--pm-accent) 10%,#fff);border:1px solid color-mix(in srgb,var(--pm-accent) 24%,transparent);border-radius:999px;padding:6px 10px;font-size:12px;font-weight:1000}
      .pm-kicker-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .pm-deck-chip{display:inline-flex;align-items:center;gap:5px;color:#92400E;background:#FFF7ED;border:1px solid #FDBA74;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:1000}
      .pm-title{font-size:clamp(26px,4.4vw,42px);line-height:1.02;font-weight:1000;margin:8px 0 6px;letter-spacing:0}
      .pm-goal{display:inline-flex;align-items:center;gap:6px;margin-top:10px;border:1px solid color-mix(in srgb,var(--pm-accent) 25%,var(--pm-border));border-radius:999px;background:color-mix(in srgb,var(--pm-accent) 9%,#fff);color:var(--pm-accent);padding:7px 10px;font-size:12px;font-weight:1000}
      .pm-goal.is-done{background:#ECFDF3;color:#047857;border-color:#86EFAC}
      .pm-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .pm-stat{border:1px solid color-mix(in srgb,var(--tone) 24%,var(--pm-border));border-radius:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--tone) 12%,#fff),var(--pm-card));padding:10px;min-height:64px}
      .pm-stat b{display:block;font-size:20px;line-height:1.05;margin-top:6px}
      .pm-stat span{font-size:11px;color:var(--tone);font-weight:1000}
      .pm-roster{order:2;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.2fr);gap:10px;align-items:stretch}
      .pm-player-card,.pm-cpu-box{border:1px solid color-mix(in srgb,var(--pm-accent) 20%,var(--pm-border));border-radius:16px;background:linear-gradient(135deg,color-mix(in srgb,var(--pm-accent) 7%,#fff),var(--pm-card));padding:10px}
      .pm-player-card{display:flex;align-items:center;gap:9px}
      .pm-rank-box{position:absolute;left:12px;right:auto;top:12px;z-index:3;width:min(285px,calc(100% - 24px));border:1px solid color-mix(in srgb,var(--pm-accent) 22%,var(--pm-border));border-radius:14px;background:rgba(255,255,255,.7);backdrop-filter:blur(10px);padding:7px 8px;text-align:left;box-shadow:0 12px 26px rgba(15,110,86,.1)}
      .pm-rank-box .pm-section-title{text-align:left;font-size:11px}
      .pm-rank-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:5px}
      .pm-rank-row{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:5px;align-items:center;border:1px solid color-mix(in srgb,var(--rank-color) 26%,var(--pm-border));border-radius:999px;background:color-mix(in srgb,var(--rank-color) 7%,#fff);padding:4px 6px;font-size:10px;font-weight:1000;color:var(--pm-text)}
      .pm-rank-row span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pm-rank-row b{color:var(--rank-color);font-size:12px}
      .pm-cpu-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:8px}
      .pm-cpu-pill{border:1px solid color-mix(in srgb,var(--cpu-color) 32%,var(--pm-border));border-radius:12px;background:color-mix(in srgb,var(--cpu-color) 8%,#fff);padding:7px;font-size:11px;line-height:1.35;color:var(--pm-muted)}
      .pm-cpu-pill b{display:block;color:var(--cpu-color);font-size:12px}
      .pm-count-buttons{display:flex;gap:6px;margin-top:7px}
      .pm-count-buttons button{border:1px solid var(--pm-border);background:var(--pm-card);border-radius:999px;padding:5px 9px;font-size:11px;font-weight:1000;cursor:pointer;color:var(--pm-text)}
      .pm-count-buttons button.is-active{background:var(--pm-accent);color:#fff;border-color:var(--pm-accent)}
      .pm-main{order:1;display:block}
      .pm-board{position:relative;display:grid;grid-template-columns:repeat(7,minmax(68px,1fr));grid-template-rows:repeat(7,minmax(62px,1fr));gap:7px;border:1px solid color-mix(in srgb,var(--pm-accent) 28%,var(--pm-border));border-radius:24px;background:radial-gradient(circle at 22% 18%,rgba(14,165,233,.16),transparent 24%),radial-gradient(circle at 75% 78%,rgba(34,197,94,.15),transparent 25%),linear-gradient(135deg,#F7FFFC,var(--pm-card));padding:10px;box-shadow:0 18px 42px rgba(15,110,86,.1);min-height:600px}
      .pm-tile{position:relative;border:1px solid color-mix(in srgb,var(--tile-color) 34%,var(--pm-border));border-radius:13px;background:linear-gradient(135deg,var(--tile-soft),rgba(255,255,255,.92));padding:8px 6px 6px;text-align:left;overflow:hidden;min-height:62px;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease,filter .22s ease}
      .pm-tile.is-active{box-shadow:0 0 0 3px color-mix(in srgb,var(--tile-color) 26%,transparent),0 16px 30px color-mix(in srgb,var(--tile-color) 20%,transparent);transform:translateY(-3px) scale(1.015);animation:pmTilePulse .72s ease-out}
      .pm-tile.is-owned-by-player{border-color:color-mix(in srgb,var(--pm-accent) 70%,var(--pm-border));box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--pm-accent) 55%,transparent),0 0 0 1px color-mix(in srgb,var(--pm-accent) 14%,transparent)}
      .pm-tile.is-owned-by-cpu{border-color:color-mix(in srgb,var(--owner-color) 70%,var(--pm-border));box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--owner-color) 55%,transparent),0 0 0 1px color-mix(in srgb,var(--owner-color) 14%,transparent)}
      .pm-owner-band{position:absolute;left:0;right:0;top:0;height:8px;background:linear-gradient(90deg,var(--owner-color),color-mix(in srgb,var(--owner-color) 55%,#fff));box-shadow:0 7px 18px color-mix(in srgb,var(--owner-color) 24%,transparent)}
      .pm-tile-icon{font-size:20px;display:block}
      .pm-tile-name{display:block;font-size:11px;font-weight:1000;line-height:1.2;margin-top:4px}
      .pm-tile-type{display:inline-block;font-size:9px;font-weight:1000;color:var(--tile-color);background:color-mix(in srgb,var(--tile-color) 10%,#fff);border-radius:999px;padding:2px 6px;margin-top:5px}
      .pm-owner-badge{position:absolute;right:5px;top:9px;border-radius:999px;background:var(--owner-color);color:#fff;font-size:10px;font-weight:1000;padding:3px 6px;box-shadow:0 8px 18px color-mix(in srgb,var(--owner-color) 30%,transparent);animation:pmOwnerPop .55s ease-out both}
      .pm-owner-badge.cpu{background:var(--owner-color);box-shadow:0 6px 14px color-mix(in srgb,var(--owner-color) 26%,transparent)}
      .pm-token-stack{position:absolute;right:5px;bottom:5px;display:flex;gap:3px;align-items:center}
      .pm-token{width:32px;height:32px;border-radius:11px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(0,0,0,.12);overflow:hidden;border:2px solid #fff;font-size:14px;font-weight:1000;animation:pmTokenStep .36s ease-out both}
      .pm-token.cpu{background:var(--cpu-color);color:#fff}
      .pm-center{position:relative;grid-column:2 / 7;grid-row:2 / 7;border:1px dashed color-mix(in srgb,var(--pm-accent) 28%,var(--pm-border));border-radius:22px;background:linear-gradient(135deg,rgba(240,253,250,.72),rgba(255,255,255,.82));display:grid;place-items:center;text-align:center;padding:12px;overflow:hidden}
      .pm-island{position:absolute;inset:22px;border-radius:22px;background:radial-gradient(ellipse at 52% 46%,rgba(34,197,94,.34) 0 18%,transparent 19%),radial-gradient(ellipse at 50% 47%,rgba(20,184,166,.24) 0 29%,transparent 30%),linear-gradient(135deg,rgba(14,165,233,.12),rgba(250,204,21,.13));}
      .pm-island:before{content:"";position:absolute;left:48%;top:8%;width:112px;height:330px;border-radius:58% 44% 55% 45%;background:linear-gradient(160deg,#BFEFCC,#68D391 45%,#1D9E75);transform:rotate(17deg);box-shadow:0 18px 42px rgba(15,110,86,.22)}
      .pm-island-label{position:absolute;left:22px;top:20px;text-align:left;color:var(--pm-accent);font-weight:1000;font-size:18px}
      .pm-city{position:absolute;border-radius:999px;background:#fff;border:1px solid rgba(15,110,86,.2);padding:4px 8px;font-size:11px;font-weight:1000;color:#0F6E56;box-shadow:0 8px 20px rgba(15,110,86,.12)}
      .pm-overlay{position:absolute;right:12px;bottom:42px;z-index:8;width:min(360px,calc(100% - 24px));max-height:min(292px,50%);overflow:auto;border:1px solid rgba(15,110,86,.18);border-radius:18px;background:rgba(255,255,255,.72);backdrop-filter:blur(16px);box-shadow:0 18px 42px rgba(15,110,86,.16);padding:9px;display:grid;gap:7px}
      .pm-overlay[data-state="idle"],.pm-overlay[data-state="moving"]{max-height:none;overflow:visible}
      .pm-overlay[data-state="question"],.pm-overlay[data-state="offer"]{width:min(560px,calc(100% - 24px));max-height:min(460px,calc(100% - 96px))}
      .pm-overlay::-webkit-scrollbar{width:6px}
      .pm-overlay::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--pm-accent) 30%,transparent);border-radius:999px}
      .pm-dice{width:58px;height:58px;border:0;border-radius:18px;background:linear-gradient(135deg,var(--pm-accent),var(--pm-accent-2));color:#fff;font-size:28px;font-weight:1000;cursor:pointer;box-shadow:0 14px 26px color-mix(in srgb,var(--pm-accent) 24%,transparent);transition:transform .18s ease,box-shadow .18s ease}
      .pm-dice:not(:disabled):hover{transform:translateY(-2px) rotate(-3deg);box-shadow:0 18px 34px color-mix(in srgb,var(--pm-accent) 28%,transparent)}
      .pm-dice:disabled{opacity:.55;cursor:not-allowed}
      .pm-section-title{font-size:14px;font-weight:1000;color:var(--pm-text)}
      .pm-feedback{border:1px solid color-mix(in srgb,var(--pm-accent) 20%,var(--pm-border));border-radius:12px;background:linear-gradient(135deg,color-mix(in srgb,var(--pm-accent) 8%,#fff),rgba(255,255,255,.78));padding:6px 8px;font-size:12px;font-weight:900;line-height:1.35;color:var(--pm-accent);max-height:40px;overflow:hidden}
      .pm-card-hand{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
      .pm-card-button{border:1px solid color-mix(in srgb,var(--card-color) 28%,var(--pm-border));border-radius:12px;background:linear-gradient(135deg,color-mix(in srgb,var(--card-color) 12%,#fff),rgba(255,255,255,.9));padding:6px;display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:4px;align-items:center;text-align:left;color:var(--pm-text);cursor:pointer;box-shadow:0 8px 16px color-mix(in srgb,var(--card-color) 10%,transparent)}
      .pm-card-button.is-active{outline:2px solid color-mix(in srgb,var(--card-color) 38%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--card-color) 20%,#fff),#fff)}
      .pm-card-button:disabled{opacity:.46;cursor:not-allowed;box-shadow:none}
      .pm-card-icon{width:22px;height:22px;border-radius:9px;background:var(--card-color);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:1000}
      .pm-card-name{min-width:0;display:grid;gap:1px}
      .pm-card-name b{font-size:11px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pm-card-name span{font-size:10px;line-height:1.05;color:var(--card-color);font-weight:1000;white-space:nowrap}
      .pm-card-count{font-size:11px;font-weight:1000;color:var(--card-color)}
      .pm-card-active{border:1px solid color-mix(in srgb,var(--pm-accent) 20%,var(--pm-border));border-radius:999px;background:rgba(255,255,255,.72);padding:6px 9px;font-size:12px;font-weight:1000;color:var(--pm-text);display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap}
      .pm-card-active span{color:var(--pm-accent)}
      .pm-question{display:grid;gap:8px}
      .pm-question-mode{display:inline-flex;align-items:center;justify-content:center;border:1px solid color-mix(in srgb,var(--pm-accent) 24%,var(--pm-border));border-radius:999px;background:color-mix(in srgb,var(--pm-accent) 8%,#fff);color:var(--pm-accent);padding:3px 8px;font-size:11px;font-weight:1000}
      .pm-question h3{margin:0 0 6px;font-size:16px}
      .pm-question p{margin:0;color:var(--pm-muted);font-size:12px;line-height:1.45}
      .pm-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}
      .pm-choice{border:1px solid color-mix(in srgb,var(--pm-accent) 22%,var(--pm-border));border-radius:12px;background:var(--pm-card);padding:9px;font-size:14px;font-weight:1000;cursor:pointer;color:var(--pm-text)}
      .pm-choice:hover{border-color:var(--pm-accent);background:color-mix(in srgb,var(--pm-accent) 8%,#fff)}
      .pm-deal{border:1px solid color-mix(in srgb,var(--pm-accent) 28%,var(--pm-border));border-radius:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--pm-accent) 10%,#fff),rgba(255,255,255,.82));padding:9px;display:grid;gap:6px}
      .pm-deal-text{font-size:12px;color:var(--pm-muted);line-height:1.55}
      .pm-event-card{border:1px solid color-mix(in srgb,var(--event-color) 34%,var(--pm-border));border-radius:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--event-color) 14%,#fff),rgba(255,255,255,.9));padding:10px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;text-align:left;box-shadow:0 12px 26px color-mix(in srgb,var(--event-color) 14%,transparent)}
      .pm-event-card b{font-size:12px;color:var(--event-color)}
      .pm-event-card span{font-size:13px;font-weight:1000;color:var(--pm-text);line-height:1.35}
      .pm-card-burst{position:relative;overflow:hidden;grid-template-columns:38px minmax(0,1fr);animation:pmBurst .72s ease-out both;background:radial-gradient(circle at 18% 50%,color-mix(in srgb,var(--event-color) 28%,#fff),transparent 34%),linear-gradient(135deg,color-mix(in srgb,var(--event-color) 18%,#fff),rgba(255,255,255,.96))}
      .pm-card-burst:before,.pm-card-burst:after{content:"";position:absolute;inset:-45%;background:conic-gradient(from 20deg,transparent 0 18%,color-mix(in srgb,var(--event-color) 34%,transparent) 19% 21%,transparent 22% 42%,rgba(255,255,255,.78) 43% 45%,transparent 46%);animation:pmSpin 1.8s linear infinite;pointer-events:none}
      .pm-card-burst:after{animation-duration:2.4s;animation-direction:reverse;opacity:.6}
      .pm-burst-icon{position:relative;z-index:1;width:34px;height:34px;border-radius:14px;background:var(--event-color);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:18px;font-weight:1000;box-shadow:0 10px 22px color-mix(in srgb,var(--event-color) 28%,transparent)}
      .pm-burst-text{position:relative;z-index:1;display:grid;gap:2px}
      @keyframes pmBurst{0%{transform:scale(.86);filter:saturate(.8);opacity:.1}55%{transform:scale(1.04);filter:saturate(1.35);opacity:1}100%{transform:scale(1);filter:saturate(1)}}
      @keyframes pmSpin{to{transform:rotate(360deg)}}
      .pm-screen-effect{position:fixed;inset:0;z-index:190;pointer-events:none;display:grid;place-items:center;overflow:hidden;animation:pmScreenFade 1.32s ease-out both}
      .pm-screen-effect:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 46%,color-mix(in srgb,var(--effect-color) 24%,transparent),transparent 34%),rgba(255,255,255,.18);backdrop-filter:blur(1px)}
      .pm-screen-rings{position:absolute;inset:0;display:grid;place-items:center}
      .pm-screen-rings:before,.pm-screen-rings:after{content:"";position:absolute;width:210px;height:210px;border-radius:999px;border:3px solid color-mix(in srgb,var(--effect-color) 40%,transparent);animation:pmRingPop 1.1s ease-out both}
      .pm-screen-rings:after{width:300px;height:300px;animation-delay:.12s;opacity:.65}
      .pm-screen-rings span{position:absolute;left:50%;top:50%;width:10px;height:18px;border-radius:999px;background:var(--effect-color);box-shadow:0 0 18px color-mix(in srgb,var(--effect-color) 60%,transparent);transform:rotate(calc(var(--i)*25.7deg)) translateY(-120px);animation:pmParticle 1.1s ease-out both}
      .pm-effect-core{position:relative;z-index:2;min-width:190px;min-height:150px;border-radius:34px;background:linear-gradient(135deg,color-mix(in srgb,var(--effect-color) 18%,#fff),rgba(255,255,255,.92));border:2px solid color-mix(in srgb,var(--effect-color) 42%,#fff);box-shadow:0 30px 90px color-mix(in srgb,var(--effect-color) 26%,transparent);display:grid;place-items:center;align-content:center;gap:6px;padding:20px 26px;text-align:center;animation:pmEffectCore .9s cubic-bezier(.2,1.2,.2,1) both}
      .pm-effect-core b{font-size:15px;color:var(--effect-color)}
      .pm-effect-core span:last-child{font-size:28px;font-weight:1000;color:var(--pm-text);line-height:1.05}
      .pm-effect-icon{width:72px;height:72px;border-radius:26px;background:var(--effect-color);color:#fff;display:grid;place-items:center;font-size:38px;font-weight:1000;box-shadow:0 18px 38px color-mix(in srgb,var(--effect-color) 34%,transparent)}
      .pm-screen-effect.is-dice .pm-effect-icon{animation:pmDiceTumble .68s ease-in-out both}
      .pm-screen-effect.is-rent-in .pm-effect-core,.pm-screen-effect.is-buy .pm-effect-core,.pm-screen-effect.is-upgrade .pm-effect-core{animation-name:pmEffectCoreWin}
      .pm-screen-effect.is-rent-out .pm-effect-core{animation-name:pmEffectCoreHit}
      .pm-screen-effect.is-grand-prize .pm-effect-core{animation-name:pmGrandPrizePop}
      .pm-impact-toast{position:fixed;left:50%;top:84px;z-index:180;transform:translateX(-50%);pointer-events:none;display:grid;grid-template-columns:auto auto minmax(0,1fr);align-items:center;gap:8px;max-width:min(520px,calc(100vw - 28px));border:1px solid color-mix(in srgb,var(--impact-color) 38%,#fff);border-radius:999px;background:rgba(255,255,255,.82);backdrop-filter:blur(14px);box-shadow:0 20px 54px color-mix(in srgb,var(--impact-color) 20%,transparent);padding:8px 12px;animation:pmImpactToast 1.7s ease-out both}
      .pm-impact-toast b{color:var(--impact-color);font-size:13px}
      .pm-impact-toast span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--pm-text);font-size:12px;font-weight:1000}
      .pm-impact-icon{width:30px;height:30px;border-radius:12px;background:var(--impact-color);color:#fff;display:grid;place-items:center;font-size:16px;font-weight:1000}
      @keyframes pmTilePulse{0%{filter:saturate(.85);transform:scale(.98)}62%{filter:saturate(1.35);transform:translateY(-4px) scale(1.03)}100%{filter:saturate(1);transform:translateY(-3px) scale(1.015)}}
      @keyframes pmOwnerPop{0%{transform:scale(.7);opacity:0}70%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}
      @keyframes pmTokenStep{0%{transform:translateY(8px) scale(.86);opacity:.45}65%{transform:translateY(-5px) scale(1.08);opacity:1}100%{transform:translateY(0) scale(1)}}
      @keyframes pmScreenFade{0%{opacity:0}10%{opacity:1}74%{opacity:1}100%{opacity:0}}
      @keyframes pmRingPop{0%{transform:scale(.32);opacity:0}38%{opacity:1}100%{transform:scale(1.58);opacity:0}}
      @keyframes pmParticle{0%{opacity:0;transform:rotate(calc(var(--i)*25.7deg)) translateY(-42px) scale(.4)}30%{opacity:1}100%{opacity:0;transform:rotate(calc(var(--i)*25.7deg)) translateY(-188px) scale(1)}}
      @keyframes pmEffectCore{0%{transform:scale(.72) rotate(-4deg);opacity:0}60%{transform:scale(1.08) rotate(1deg);opacity:1}100%{transform:scale(1) rotate(0)}}
      @keyframes pmEffectCoreWin{0%{transform:translateY(22px) scale(.7);opacity:0}55%{transform:translateY(-10px) scale(1.1);opacity:1}100%{transform:translateY(0) scale(1)}}
      @keyframes pmEffectCoreHit{0%{transform:translateX(-18px) scale(.76);opacity:0}32%{transform:translateX(14px) scale(1.06);opacity:1}54%{transform:translateX(-8px) scale(1)}100%{transform:translateX(0) scale(1)}}
      @keyframes pmGrandPrizePop{0%{transform:scale(.45) rotate(-10deg);opacity:0}45%{transform:scale(1.18) rotate(4deg);opacity:1}70%{transform:scale(.96) rotate(-2deg)}100%{transform:scale(1) rotate(0)}}
      @keyframes pmDiceTumble{0%{transform:rotate(-24deg) scale(.72)}35%{transform:rotate(18deg) scale(1.12)}70%{transform:rotate(-10deg) scale(1.02)}100%{transform:rotate(0) scale(1)}}
      @keyframes pmImpactToast{0%{opacity:0;transform:translate(-50%,-16px) scale(.92)}18%{opacity:1;transform:translate(-50%,0) scale(1.03)}78%{opacity:1;transform:translate(-50%,0) scale(1)}100%{opacity:0;transform:translate(-50%,-12px) scale(.98)}}
      .pm-rent-dialog,.pm-prize-dialog{position:fixed;inset:0;z-index:210;display:grid;place-items:center;padding:18px;background:radial-gradient(circle at 50% 36%,color-mix(in srgb,var(--dialog-color) 18%,transparent),transparent 34%),rgba(10,20,18,.22);backdrop-filter:blur(5px);animation:pmDialogFade .18s ease-out both}
      .pm-rent-card,.pm-prize-card{position:relative;overflow:hidden;width:min(440px,calc(100vw - 30px));border:1px solid color-mix(in srgb,var(--dialog-color) 40%,#fff);border-radius:24px;background:linear-gradient(145deg,#fff,color-mix(in srgb,var(--dialog-color) 8%,#fff));box-shadow:0 28px 90px color-mix(in srgb,var(--dialog-color) 24%,transparent);padding:18px;display:grid;gap:12px;text-align:center}
      .pm-rent-card:before,.pm-prize-card:before{content:"";position:absolute;inset:-40% -20% auto;height:90%;background:linear-gradient(120deg,transparent,rgba(255,255,255,.72),transparent);transform:rotate(10deg);animation:pmPrizeSweep 1.4s ease-out both;pointer-events:none}
      .pm-rent-icon,.pm-prize-icon{width:72px;height:72px;border-radius:26px;margin:0 auto;display:grid;place-items:center;background:var(--dialog-color);color:#fff;font-size:38px;font-weight:1000;box-shadow:0 18px 42px color-mix(in srgb,var(--dialog-color) 28%,transparent);animation:pmDialogBounce .48s ease-out both}
      .pm-rent-title,.pm-prize-title{font-size:22px;font-weight:1000;color:var(--dialog-color);line-height:1.18}
      .pm-rent-amount,.pm-prize-reward{font-size:34px;font-weight:1000;color:var(--dialog-color);line-height:1}
      .pm-rent-talk{border:1px dashed color-mix(in srgb,var(--dialog-color) 35%,var(--pm-border));border-radius:16px;background:rgba(255,255,255,.76);padding:10px 12px;font-size:13px;font-weight:900;color:var(--pm-text);line-height:1.55}
      .pm-dialog-ok{border:0;border-radius:16px;background:var(--dialog-color);color:#fff;padding:12px 16px;font-size:15px;font-weight:1000;cursor:pointer;box-shadow:0 14px 28px color-mix(in srgb,var(--dialog-color) 22%,transparent)}
      .pm-cpu-status-list{display:none}
      @keyframes pmDialogFade{from{opacity:0}to{opacity:1}}
      @keyframes pmDialogBounce{0%{transform:translateY(16px) scale(.7);opacity:0}70%{transform:translateY(-4px) scale(1.08);opacity:1}100%{transform:translateY(0) scale(1)}}
      @keyframes pmPrizeSweep{0%{transform:translateX(-130%) rotate(10deg)}100%{transform:translateX(140%) rotate(10deg)}}
      .pm-action-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .pm-action{border:0;border-radius:12px;background:var(--pm-accent);color:#fff;padding:10px 12px;font-size:12px;font-weight:1000;cursor:pointer}
      .pm-action.secondary{background:var(--pm-surface);color:var(--pm-text);border:1px solid var(--pm-border)}
      .pm-action:disabled{opacity:.5;cursor:not-allowed}
      @media (max-width:900px){.pm-setup-grid,.pm-game-hud{grid-template-columns:1fr 1fr}.pm-board{grid-template-columns:repeat(7,minmax(44px,1fr));grid-template-rows:repeat(7,minmax(48px,1fr));gap:5px;min-height:540px;padding:8px}.pm-tile{min-height:48px;padding:7px 5px 5px}.pm-tile-name{font-size:9px}.pm-tile-type{display:none}.pm-token{width:25px;height:25px;border-radius:9px}.pm-center{padding:8px}.pm-overlay{right:8px;bottom:30px;width:min(340px,calc(100% - 16px));max-height:46%;padding:8px}.pm-overlay[data-state="idle"],.pm-overlay[data-state="moving"]{max-height:none;overflow:visible}.pm-overlay[data-state="question"],.pm-overlay[data-state="offer"]{width:min(480px,calc(100% - 16px));max-height:min(420px,calc(100% - 72px))}.pm-dice{width:54px;height:54px;font-size:24px}}
      @media (max-width:520px){.pm-setup{padding:12px;border-radius:18px}.pm-setup-grid,.pm-game-hud{grid-template-columns:1fr}.pm-setup-title{font-size:23px}.pm-board{gap:3px;min-height:500px}.pm-tile-icon{font-size:15px}.pm-tile-name{font-size:8px}.pm-choices{grid-template-columns:1fr}.pm-island-label{font-size:14px}.pm-city{display:none}.pm-rank-box{left:8px;right:auto;top:8px;transform:none;width:min(220px,calc(100% - 16px));padding:4px 5px;border-radius:999px}.pm-rank-box .pm-section-title{display:none}.pm-rank-list{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-top:0}.pm-rank-row{display:flex;justify-content:center;padding:3px 4px;border-radius:999px;font-size:10px;line-height:1}.pm-rank-row span:nth-child(2){display:none}.pm-rank-row span:last-child{display:inline;font-size:10px}.pm-overlay{left:8px;right:8px;bottom:22px;width:auto;max-height:45%}.pm-overlay[data-state="idle"],.pm-overlay[data-state="moving"]{max-height:none;overflow:visible}.pm-overlay[data-state="question"],.pm-overlay[data-state="offer"]{max-height:min(430px,calc(100% - 58px))}.pm-effect-core{min-width:150px;min-height:128px;padding:16px 20px}.pm-effect-icon{width:60px;height:60px;font-size:32px}.pm-effect-core span:last-child{font-size:22px}}
      @media (max-width:520px){.pm-card-hand{gap:5px}.pm-card-button{grid-template-columns:18px minmax(0,1fr);gap:4px;padding:6px 5px}.pm-card-icon{width:18px;height:18px;border-radius:7px;font-size:11px}.pm-card-name b{font-size:10px}.pm-card-name span{font-size:9px}.pm-card-count{display:none}.pm-card-active{font-size:11px;padding:5px 7px}}
    `}</style>
    {!gameStarted?(
      <section className="pm-setup" data-testid="pet-monopoly-setup">
        <div className="pm-setup-head">
          <div>
            <div className="pm-kicker-row">
              <div className="pm-kicker">開局設定</div>
              <div className="pm-deck-chip" data-testid="pet-monopoly-event-deck-size" data-event-count={PET_MONOPOLY_EVENT_DECK.length}>機會/命運 {PET_MONOPOLY_EVENT_DECK.length}</div>
            </div>
            <div className="pm-setup-title">學習島對局</div>
            <div className="pm-setup-sub">先選電腦玩家與投入金幣，雙方用同等本金開始。</div>
          </div>
          <button type="button" className="pm-start" data-testid="pet-monopoly-start" disabled={walletCoins<stake} onClick={startGame}>開始對局</button>
        </div>
        <div className="pm-setup-grid">
          <div className="pm-setup-panel">
            <div className="pm-section-title">電腦玩家</div>
            <div className="pm-option-row">
              {[1,2,3].map(n=><button key={n} type="button" className={`pm-option ${setupComputerCount===n?"is-active":""}`} data-testid={`pet-monopoly-setup-cpu-${n}`} onClick={()=>setSetupComputerCount(n)}>{n} 家</button>)}
            </div>
          </div>
          <div className="pm-setup-panel">
            <div className="pm-section-title">投入金幣</div>
            <div className="pm-option-row">
              {PET_MONOPOLY_STAKES.map(amount=><button key={amount} type="button" className={`pm-option ${stake===amount?"is-active":""}`} data-testid={`pet-monopoly-setup-stake-${amount}`} disabled={walletCoins<amount} onClick={()=>setStake(amount)}>{amount}</button>)}
            </div>
            <div className="pm-deal-text">錢包 {walletCoins} · 電腦本金會與你相同</div>
          </div>
        </div>
      </section>
    ):(
    <>
    <section className="pm-game-hud" data-testid="pet-monopoly-game-hud">
      <div className="pm-hud-pill" style={{"--hud-color":"#D97706"}}>投入 <b>{stake}</b></div>
      <div className="pm-hud-pill" style={{"--hud-color":color}}>玩家 <b data-testid="pet-monopoly-player-cash">{gameCoins}</b></div>
      <div className="pm-hud-pill" style={{"--hud-color":"#2563EB"}}>電腦 {activeComputers.length} <b>{activeComputers.map(cpu=>cpu.coins).join(" / ")||"全數退場"}</b></div>
      <div className="pm-hud-pill" data-testid="pet-monopoly-event-deck-size" data-event-count={PET_MONOPOLY_EVENT_DECK.length} style={{"--hud-color":"#D97706"}}>機會/命運 <b>{PET_MONOPOLY_EVENT_DECK.length}</b></div>
      <div className="pm-hud-pill" style={{"--hud-color":"#DB2777"}}>{goalText} <b>{propertyCount} 地產</b></div>
      <div className="pm-cpu-status-list" aria-hidden="true">
        {computers.slice(0,computerCount).map(cpu=><span key={cpu.id} data-testid={`pet-monopoly-cpu-status-${cpu.id}`} data-active={String(cpu.active!==false)}>{cpu.coins}</span>)}
      </div>
    </section>
    {screenEffect&&(
      <div key={screenEffect.id} className={`pm-screen-effect is-${screenEffect.kind}`} data-testid="pet-monopoly-screen-effect" data-effect={screenEffect.kind} style={{"--effect-color":screenEffect.color||color}}>
        <div className="pm-screen-rings" aria-hidden="true">
          {Array.from({length:14}).map((_,i)=><span key={i} style={{"--i":i}}/>)}
        </div>
        <div className="pm-effect-core" data-testid={screenEffect.kind==="dice"?"pet-monopoly-dice-effect":screenEffect.source==="card"?"pet-monopoly-card-burst":undefined} data-effect={screenEffect.effect||screenEffect.kind}>
          <span className="pm-effect-icon">{screenEffect.icon}</span>
          <b>{screenEffect.title}</b>
          <span>{screenEffect.value}</span>
        </div>
      </div>
    )}
    {rentFlash&&(
      <div className={`pm-impact-toast ${rentFlash.effect||""}`} data-testid="pet-monopoly-rent" data-effect={rentFlash.effect||"rent"} style={{"--impact-color":rentFlash.color||color}}>
        <span className="pm-impact-icon">{rentFlash.icon||"$"}</span>
        <b>{rentFlash.title}</b>
        <span>{rentFlash.text}</span>
      </div>
    )}
    {rentDialog&&(
      <div className="pm-rent-dialog" data-testid="pet-monopoly-rent-dialog" data-flow="paused" data-winner={rentDialog.winner||""} style={{"--dialog-color":rentDialog.color||color}}>
        <div className="pm-rent-card">
          <div className="pm-rent-icon">$</div>
          <div className="pm-rent-title">{rentDialog.kind==="rent-in"?`${rentDialog.payee}向${rentDialog.payer}收取租金`:`${rentDialog.payer}被${rentDialog.payee}收取租金`}</div>
          <div className="pm-rent-amount">{rentDialog.kind==="rent-in"?"+":"-"}{rentDialog.amount}</div>
          <div style={{fontSize:13,fontWeight:900,color:"var(--pm-muted)"}}>{rentDialog.tileName}</div>
          <div className="pm-rent-talk">{rentDialog.joke}</div>
          <button type="button" className="pm-dialog-ok" data-testid="pet-monopoly-rent-confirm" onClick={confirmRentMoment}>確定</button>
        </div>
      </div>
    )}
    {grandPrize&&(
      <div className="pm-prize-dialog" data-testid="pet-monopoly-grand-prize" style={{"--dialog-color":"#D97706"}}>
        <div className="pm-prize-card">
          <div className="pm-prize-icon">🎁</div>
          <div className="pm-prize-title">勝利大禮包</div>
          <div className="pm-prize-reward">+{grandPrize.coins}</div>
          <div className="pm-rent-talk">電腦玩家全數退場，寵物把彩帶拉到整張地圖都是。</div>
          <button type="button" className="pm-dialog-ok" onClick={()=>setGrandPrize(null)}>收下</button>
        </div>
      </div>
    )}
    {eventFlash&&(
      <div className="pm-impact-toast event" data-testid="pet-monopoly-event" data-effect={eventFlash.effect||"event"} style={{"--impact-color":eventFlash.color||color}}>
        <span className="pm-impact-icon">{eventFlash.icon||"✦"}</span>
        <b>{eventFlash.title}</b>
        <span>{eventFlash.text}</span>
      </div>
    )}
    <section className="pm-main">
      <div className="pm-board" data-testid="pet-monopoly-board" aria-label="寵物大富翁棋盤">
        {tiles.map((tile,i)=>{
          const meta=PET_MONOPOLY_TYPE_META[tile.type]||PET_MONOPOLY_TYPE_META.word;
          const[posCol,posRow]=PET_MONOPOLY_GRID[i]||[1,1];
          const active=i===position;
          const property=owned[tile.id];
          const cpuOwner=getPetMonopolyCpuOwner(activeComputers,tile.id,computerCount);
          const computerVisitors=activeComputers.filter(cpu=>cpu.position===i);
          const ownerId=property?"player":cpuOwner?.id||"none";
          return(
            <div key={tile.id} className={`pm-tile ${active?"is-active":""} ${property?"is-owned-by-player":cpuOwner?"is-owned-by-cpu":""}`} data-testid={`pet-monopoly-tile-${tile.id}`} data-owner={ownerId} data-owner-level={property?.level||(cpuOwner?1:0)} style={{"--tile-color":meta.color,"--tile-soft":meta.soft,"--owner-color":property?color:cpuOwner?.color||color,gridColumn:posCol,gridRow:posRow}}>
              {(property||cpuOwner)&&<span className="pm-owner-band" aria-hidden="true"/>}
              <span className="pm-tile-icon">{tile.icon}</span>
              <span className="pm-tile-name">{tile.name}</span>
              <span className="pm-tile-type">{meta.label}</span>
              {property&&<span className="pm-owner-badge" data-testid="pet-monopoly-player-owner">P Lv.{property.level}</span>}
              {!property&&cpuOwner&&<span className="pm-owner-badge cpu" data-testid="pet-monopoly-cpu-owner">{cpuOwner.name.replace("電腦 ","C")}</span>}
              {(active||computerVisitors.length>0)&&(
                <span className="pm-token-stack">
                  {active&&<span className="pm-token" aria-label="目前位置">{selectedPet?<PixelPet pet={selectedPet} size={32}/>:<span>🐾</span>}</span>}
                  {computerVisitors.map(cpu=><span key={cpu.id} className="pm-token cpu" style={{"--cpu-color":cpu.color}} title={cpu.name}>{cpu.name.replace("電腦 ","")}</span>)}
                </span>
              )}
            </div>
          );
        })}
        <div className="pm-center">
          <div className="pm-island" aria-hidden="true">
            <div className="pm-island-label">台灣學習島</div>
            <span className="pm-city" style={{left:"50%",top:"16%"}}>台北</span>
            <span className="pm-city" style={{left:"39%",top:"45%"}}>台中</span>
            <span className="pm-city" style={{left:"47%",top:"70%"}}>高雄</span>
            <span className="pm-city" style={{right:"18%",top:"48%"}}>花東</span>
          </div>
          <div className="pm-rank-box" data-testid="pet-monopoly-rankings">
            <div className="pm-section-title">排名</div>
            <div className="pm-rank-list">
              {rankings.map((rank,i)=>(
                <div key={rank.id} className="pm-rank-row" style={{"--rank-color":rank.color}}>
                  <b>#{i+1}</b>
                  <span>{rank.emoji} {rank.name}</span>
                  <span>{rank.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="pm-overlay pm-action-dock" data-testid="pet-monopoly-overlay" data-panel="dock" data-state={moving?"moving":pending?"question":offer?"offer":"idle"}>
            <div className="pm-feedback" data-testid="pet-monopoly-feedback">{feedback}</div>
            <div className="pm-card-hand" data-testid="pet-monopoly-cards">
              {PET_MONOPOLY_CARDS.map(card=>{
                const count=Number(cardHand[card.id])||0;
                const active=!!cardEffects[card.id];
                const disabled=!!moving||!!pending||!!rentDialog||!!grandPrize||!!winner||cardUsedTurn===turn||count<=0||active;
                return(
                  <button key={card.id} type="button" className={`pm-card-button ${active?"is-active":""}`} data-testid={`pet-monopoly-card-${card.id}`} style={{"--card-color":card.color}} disabled={disabled} onClick={()=>useCard(card.id)} aria-label={`${card.name} ${card.desc}`}>
                    <span className="pm-card-icon">{card.icon}</span>
                    <span className="pm-card-name"><b>{card.name}</b><span>{card.short}</span></span>
                    <span className="pm-card-count">x{count}</span>
                  </button>
                );
              })}
            </div>
            {activeCards.length>0&&(
              <div className="pm-card-active" data-testid="pet-monopoly-card-active">
                <span>{`\u5df2\u555f\u7528`}</span>
                {activeCards.map(card=><b key={card.id}>{card.name}</b>)}
              </div>
            )}
            {moving&&(
              <div className="pm-deal" data-testid="pet-monopoly-moving">
                <button className="pm-dice" data-testid="pet-monopoly-roll" disabled aria-label="擲骰">{moving.phase==="waiting"?"CPU":dice||moving.dice}</button>
                <div className="pm-section-title">{moving.phase==="waiting"?`${moving.name} 回合`:moving.phase==="rolling"?moving.actor==="cpu"?`${moving.name} 擲骰`:"玩家移動":moving.actor==="cpu"?`${moving.name} 移動`:"玩家移動"}</div>
                <div className="pm-deal-text">{moving.phase==="waiting"?"準備中":moving.phase==="rolling"?`骰出 ${moving.dice}`:`${moving.step}/${moving.total} → ${moving.to}`}</div>
              </div>
            )}
            {!moving&&pending&&(
              <div className="pm-question" data-testid="pet-monopoly-question-word" data-word={pending.question.word?.w||""}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:12,fontWeight:1000,color:color}}>英文挑戰 · 骰出 {pending.dice}</span>
                    <span className="pm-question-mode" data-testid="pet-monopoly-question-mode">{pending.question.modeLabel||pending.question.kind}</span>
                  </div>
                  <div style={{fontSize:12,fontWeight:1000,color:PET_MONOPOLY_TYPE_META[pending.tile.type]?.color||color}}>{pending.tile.name}</div>
                </div>
                <h3 data-testid="pet-monopoly-question-prompt">{pending.question.prompt}</h3>
                <p data-testid="pet-monopoly-question-sub">{pending.question.sub}</p>
                <div className="pm-choices">
                  {pending.question.choices.map((choice,i)=>(
                    <button key={`${choice}-${i}`} type="button" className="pm-choice" data-testid={i===pending.question.answer?"pet-monopoly-choice-correct":undefined} onClick={()=>answer(i)}>
                      {choice}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!moving&&!pending&&offer&&offerTile&&(
              <div className="pm-deal" data-testid="pet-monopoly-deal">
                <div className="pm-section-title">收購機會</div>
                <div className="pm-deal-text">「{offerTile.name}」· {offer.cost} 金幣</div>
                <div className="pm-deal-text">下次停留可升級</div>
                <div className="pm-action-row">
                  <button type="button" className="pm-action" data-testid="pet-monopoly-buy" disabled={(Number(gameCoins)||0)<offer.cost} onClick={buyProperty}>收購</button>
                  <button type="button" className="pm-action secondary" data-testid="pet-monopoly-skip-buy" onClick={skipOffer}>略過</button>
                </div>
              </div>
            )}
            {!moving&&!pending&&!offer&&(
              <div className="pm-deal">
                <div className="pm-section-title">{currentTile.icon} {currentTile.name}</div>
                <div className="pm-deal-text">{currentMeta.label}</div>
                {currentProperty&&(
                  <div className="pm-deal-text">Lv.{currentProperty.level} · +{currentYield.coins} 金幣 · +{currentYield.xp} XP</div>
                )}
                {currentProperty&&currentProperty.visits<2&&<div className="pm-deal-text" style={{fontWeight:1000,color:color}}>再停一次可升級</div>}
                {canUpgradeCurrent&&upgradeDiscount>0&&<div className="pm-deal-text" style={{fontWeight:1000,color:"#D97706"}}>升級折扣 -{upgradeDiscount} 金幣</div>}
                {canUpgradeCurrent&&<button type="button" className="pm-action" disabled={(Number(gameCoins)||0)<currentUpgradeCost} onClick={upgradeCurrentProperty}>升級 {currentUpgradeCost} 金幣</button>}
                {!currentProperty&&isPetMonopolyOwnable(currentTile)&&<div className="pm-deal-text">答題後可收購</div>}
                <div>
                  <button className="pm-dice" data-testid="pet-monopoly-roll" disabled={!!moving||!!pending||!!offer||!!rentDialog||!!grandPrize||!!winner} onClick={roll} aria-label="擲骰">{dice||"🎲"}</button>
                  <div style={{fontSize:13,fontWeight:1000,color:color,marginTop:8}}>{lastMove?lastMove.tile.name:"?"}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
    </>
    )}
  </div>);
}

export default function PetMonopolyFeature(props){
  const {deps,...rest}=props;
  ({G,Hdr,S,V,escapeRegexSafe,getAdventurePetDef,levelUpPet,shuffleCopy}=deps||{});
  return <PetMonopolyM {...rest}/>;
}
