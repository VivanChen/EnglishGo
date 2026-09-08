import { recordPetMoment } from "../data/petJourney.js";
import { useEffect, useRef, useState } from "react";
import PetIslandView from './PetIslandView.jsx';
import {ISLAND_GOALS,getIslandRoutes,getIslandGoalProgress,getIslandIncome} from '../data/petIslandStrategy.js';

import {ISLAND_DECKS,ISLAND_TOOLS,drawIslandEvent} from '../data/petIslandEvents.js';
import {createIslandSound} from '../audio/petIslandSound.js';

let G,Hdr,S,V,escapeRegexSafe,getAdventurePetDef,levelUpPet,shuffleCopy;
const PET_MONOPOLY_TILES=[
  {id:"start",type:"start",name:"起點",icon:"🏁",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"word-market",type:"word",name:"貝殼市集",icon:"🐚",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"grammar-gate",type:"grammar",name:"紫藤城門",icon:"⛩️",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"coin-park",type:"event",name:"機會公園",icon:"🪙",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"pet-school",type:"training",name:"寵物學院",icon:"🎓",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"word-harbor",type:"word",name:"帆船港口",icon:"⚓",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"north-station",type:"word",name:"台北車站",icon:"🚄",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"shop",type:"shop",name:"補給商店",icon:"🛒",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"grammar-plaza",type:"grammar",name:"星光廣場",icon:"🌟",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"chance",type:"event",name:"命運卡",icon:"✦",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"east-coast",type:"training",name:"花東海岸",icon:"🌊",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"word-station",type:"word",name:"海風車站",icon:"🚉",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"training-yard",type:"training",name:"訓練庭院",icon:"🏋️",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"forest-class",type:"grammar",name:"森林茶屋",icon:"🌲",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"grammar-tower",type:"grammar",name:"月光鐘塔",icon:"🏰",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"treasure",type:"event",name:"機會寶箱",icon:"🎁",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"south-market",type:"shop",name:"台南補給站",icon:"🥤",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"word-library",type:"word",name:"海角書店",icon:"📚",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"pet-camp",type:"training",name:"寵物營地",icon:"⛺",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"science-port",type:"word",name:"高雄港口",icon:"🚢",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"grammar-lab",type:"grammar",name:"星空研究所",icon:"🔬",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"island-fair",type:"event",name:"命運市集",icon:"🎡",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"pet-spa",type:"training",name:"溫泉寵物館",icon:"♨️",hint:"選擇落點，規劃你的島嶼資產"},
  {id:"boss",type:"boss",name:"冒險城堡",icon:"👑",hint:"選擇落點，規劃你的島嶼資產"},
 ].map(tile=>({...tile,hint:tile.type==='start'?'經過補給 +12；停留再 +8':tile.type==='event'?(['chance','island-fair'].includes(tile.id)?'抽命運卡：局勢可能逆轉':'抽機會卡：自己選擇風險與報酬'):tile.type==='boss'?'城堡冒險：再抽一張機會卡':`收購 ${({word:24,grammar:32,shop:28,training:30})[tile.type]} 旅費；同類兩棟可增加街區收入`}));
const PET_MONOPOLY_COMPUTERS=[
  {id:"cpu1",name:"電腦 1",color:"#2563EB",emoji:"🔵"},
  {id:"cpu2",name:"電腦 2",color:"#D97706",emoji:"🟠"},
  {id:"cpu3",name:"電腦 3",color:"#DB2777",emoji:"🟣"},
];
const PET_MONOPOLY_TYPE_META={
  start:{label:"起點",color:"#0F9F7A",soft:"#E7FFF5"},
  word:{label:"海港街區",color:"#2563EB",soft:"#EFF6FF"},
  grammar:{label:"星光街區",color:"#7C3AED",soft:"#F5F3FF"},
  event:{label:"機會",color:"#D97706",soft:"#FFF7ED"},
  shop:{label:"商店",color:"#0891B2",soft:"#ECFEFF"},
  training:{label:"休閒街區",color:"#DB2777",soft:"#FDF2F8"},
  boss:{label:"冒險",color:"#DC2626",soft:"#FEF2F2"},
};
const PET_MONOPOLY_CARDS=ISLAND_TOOLS;
const PET_MONOPOLY_CARD_BY_ID=PET_MONOPOLY_CARDS.reduce((map,card)=>({...map,[card.id]:card}),{});
const PET_MONOPOLY_STAKES=[100,300,500];
const PET_MONOPOLY_DICE_ROLL_MS=520;
const PET_MONOPOLY_PLAYER_STEP_MS=190;
const PET_MONOPOLY_CPU_STEP_MS=155;
const PET_MONOPOLY_CPU_GAP_MS=420;
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
function growPetFromMonopoly(pet,reward){
  if(!pet)return pet;
  let next={
    ...pet,
    exp:Math.max(0,Number(pet.exp)||0)+(reward.petExp||0),
    bond:Math.max(0,Number(pet.bond)||0)+(reward.bond||0),
    energy:Math.max(0,Math.min(100,Number(pet.energy??80)-2)),
    hunger:Math.max(0,Math.min(100,Number(pet.hunger??80)-1)),
    lastUpdate:new Date().toISOString(),
  };
  for(let i=0;i<8;i++){
    const leveled=levelUpPet(next);
    if(leveled===next)break;
    next=leveled;
  }
  return recordPetMoment(next,"monopoly");
}
function PetMonopolyM({lv,onBack,onNavigate,onComplete,onXp,c,pets=[],setPets,coins=0,setCoins,quiet,setQuiet}){
  const color=c?.cl||"#0F6E56";
  const accent=c?.ac||"#1D9E75";
  const tiles=PET_MONOPOLY_TILES;
  const defaultStake=100;
  const [encounter,setEncounter]=useState(null),[learning,setLearning]=useState(false),[learningUsed,setLearningUsed]=useState(-1),[toolTarget,setToolTarget]=useState(false),[soundOn,setSoundOn]=useState(()=>document.documentElement.dataset.egQuiet!=='true');
  const encounterRef=useRef(null),deckRef=useRef({}),soundRef=useRef(null),toolUsedRef=useRef(-1),shopUsedRef=useRef(-1),learningUsedRef=useRef(-1);
  if(!soundRef.current)soundRef.current=createIslandSound();
  useEffect(()=>()=>soundRef.current?.dispose(),[]);
  const soundEnabledRef=useRef(soundOn);
  useEffect(()=>{if(typeof quiet==='boolean'){setSoundOn(!quiet);soundEnabledRef.current=!quiet;if(quiet)soundRef.current.stop()}},[quiet]);
  const toggleSound=()=>{const next=!soundOn;setSoundOn(next);soundEnabledRef.current=next;setQuiet?.(!next);document.documentElement.dataset.egQuiet=String(!next);if(next){soundRef.current.unlock();soundRef.current.play('card')}else soundRef.current.stop()};
  const [shopUsed,setShopUsed]=useState(-1);
  const[gameStarted,setGameStarted]=useState(false);
  const[goalId,setGoalId]=useState('builder'),[visited,setVisited]=useState([]),[routes,setRoutes]=useState([]),[inspected,setInspected]=useState(null);
  const visitedRef=useRef([]),routesRef=useRef(null),answeringRef=useRef(false),upgradedTurnRef=useRef(-1);
  const[setupComputerCount,setSetupComputerCount]=useState(1);
  const[roundLimit,setRoundLimit]=useState(6);
  const[paused,setPaused]=useState(false);
  const[exitRequested,setExitRequested]=useState(false);
  const[result,setResult]=useState(null);
  const[answerReview,setAnswerReview]=useState(null);
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
  const[upgradedTurn,setUpgradedTurn]=useState(-1);
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
  const pausedRef=useRef(false);
  const resultRef=useRef(null);
  const cashRef=useRef(0);
  const playedRef=useRef(0);
  const earnedRef=useRef({xp:0,petExp:0,bond:0,correct:0});
  const pauseDialogRef=useRef(null);
  const resultTitleRef=useRef(null);
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
  useEffect(()=>()=>{moveTimersRef.current.forEach(timer=>clearTimeout(timer.id));moveTimersRef.current=[]},[]);
  useEffect(()=>{if(paused)pauseDialogRef.current?.showModal?.();else pauseDialogRef.current?.close?.()},[paused]);
  useEffect(()=>{if(result)resultTitleRef.current?.focus()},[result]);
  useEffect(()=>{const hidden=()=>{if(document.hidden&&gameStarted&&!resultRef.current)pauseGame()};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden)},[gameStarted]);
  const clearMoveTimers=()=>{moveTimersRef.current.forEach(timer=>clearTimeout(timer.id));moveTimersRef.current=[]};
  const scheduleMove=(callback,delay)=>{
    const timer={callback,remaining:delay,deadline:Date.now()+delay,id:null};
    timer.run=()=>{moveTimersRef.current=moveTimersRef.current.filter(item=>item!==timer);if(!resultRef.current)callback()};
    if(!pausedRef.current)timer.id=setTimeout(timer.run,delay);
    return timer;
  };
  const pauseGame=(exiting=false)=>{
    if(resultRef.current)return;
    if(!pausedRef.current)moveTimersRef.current.forEach(timer=>{clearTimeout(timer.id);timer.remaining=Math.max(0,timer.deadline-Date.now())});
    soundRef.current.stop();
    pausedRef.current=true;setPaused(true);setExitRequested(exiting);
  };
  const resumeGame=()=>{
    if(soundEnabledRef.current)soundRef.current.unlock();
    pausedRef.current=false;setPaused(false);setExitRequested(false);
    moveTimersRef.current.forEach(timer=>{timer.deadline=Date.now()+timer.remaining;timer.id=setTimeout(timer.run,timer.remaining)});
  };
  const updateGameCoins=updater=>{const next=Math.max(0,typeof updater==="function"?updater(cashRef.current):updater);cashRef.current=next;setGameCoins(next)};
  const updateComputers=updater=>{
    const next=typeof updater==='function'?updater(computersRef.current):updater;
    computersRef.current=next;setComputers(next);
  };
  const updateCardEffects=updater=>{
    const next=typeof updater==='function'?updater(cardEffectsRef.current):updater;
    cardEffectsRef.current=next;setCardEffects(next);
  };
  const showScreenEffect=effect=>{
    if(!effect)return;
    if(soundEnabledRef.current&&!pausedRef.current)soundRef.current.play(effect.kind);
    setScreenEffect({
      id:`${effect.kind||"effect"}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      color,
      icon:"✦",
      ...effect,
    });
  };
  const startGame=()=>{
    if(soundEnabledRef.current)soundRef.current.unlock();
    deckRef.current={};encounterRef.current=null;setEncounter(null);setToolTarget(false);toolUsedRef.current=-1;shopUsedRef.current=-1;setShopUsed(-1);learningUsedRef.current=-1;setLearningUsed(-1);
    const buyIn=Number(stake)||100;
    clearMoveTimers();
    pausedRef.current=false;setPaused(false);setExitRequested(false);resultRef.current=null;setResult(null);playedRef.current=0;earnedRef.current={xp:0,petExp:0,bond:0,correct:0};cashRef.current=buyIn;
    setGameCoins(buyIn);
    setComputerCount(setupComputerCount);
    const nextComputers=PET_MONOPOLY_COMPUTERS.map((cpu,i)=>({...cpu,position:(i+3)%PET_MONOPOLY_TILES.length,coins:buyIn,owned:[],active:true}));
    computersRef.current=nextComputers;
    setComputers(nextComputers);
    setPosition(0);setVisited([]);visitedRef.current=[];setRoutes([]);routesRef.current=null;setInspected(null);upgradedTurnRef.current=-1;
    setDice(null);
    setTurn(0);
    setPending(null);setAnswerReview(null);
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
    setCardHand({boost:1,shield:1,rent:1,control:1,block:1});
    setCardEffects({boost:false,shield:false,rent:false});
    cardEffectsRef.current={boost:false,shield:false,rent:false};
    setCardFlash(null);
    setCardUsedTurn(-1);
    setScore({correct:0,wrong:0,laps:0,boss:0});
    setStreak(0);
    setMoving(null);
    updateCpuBuyPause(0);
    setUpgradeDiscount(0);
    setUpgradedTurn(-1);
    setRecentQuestionWords([]);
    recentQuestionWordsRef.current=[];
    setGameStarted(true);
  };
  const exitGame=()=>{
    if(gameStarted&&!resultRef.current){pauseGame(true);return}
    clearMoveTimers();
    onBack?.();
  };
  const abandonGame=()=>{clearMoveTimers();pausedRef.current=false;setPaused(false);setExitRequested(false);setGameStarted(false);setMoving(null);setPending(null);setOffer(null);setRentDialog(null)};
  const finishGame=(reason='rounds')=>{
    if(resultRef.current)return;
    clearMoveTimers();setMoving(null);setPending(null);setOffer(null);setRentDialog(null);setGrandPrize(null);setScreenEffect(null);setEventFlash(null);setRentFlash(null);
    const assets=Object.entries(ownedRef.current).reduce((sum,[id,property])=>sum+getPetMonopolyPropertyValue(tiles.find(tile=>tile.id===id),property),0);
    const totals=[{id:'player',name:'你和夥伴',score:cashRef.current+assets},...computersRef.current.slice(0,computerCount).map(cpu=>({id:cpu.id,name:cpu.name,score:cpu.coins+cpu.owned.reduce((sum,id)=>sum+getPetMonopolyTileCost(tiles.find(tile=>tile.id===id)),0)}))].sort((a,b)=>b.score-a.score);
    const goal=ISLAND_GOALS.find(item=>item.id===goalId),goalProgress=getIslandGoalProgress(goalId,ownedRef.current,visitedRef.current),goalDone=goalProgress>=goal.target;
    const completed={goalProgress,goalDone,reason,rounds:playedRef.current,coins:12+(totals[0].id==='player'?6:0)+(goalDone?8:0),...earnedRef.current,rankings:totals,cash:cashRef.current,assets,partner:!!selectedPet};
    if(soundEnabledRef.current)soundRef.current.play('win');
    resultRef.current=completed;setResult(completed);setWinner(totals[0].id);setCoins?.(value=>(Number(value)||0)+completed.coins);onComplete?.();
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
    if(resultRef.current||!card||encounterRef.current||offer||toolTarget||routesRef.current||moving||pending||rentDialog||grandPrize||answerReview||pausedRef.current||toolUsedRef.current===turn||(Number(cardHand[cardId])||0)<=0||cardEffects[cardId])return;
    if(cardId==='block'){setToolTarget(true);return}
    toolUsedRef.current=turn;
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
    finishGame('island');
  };
  const showRentMoment=(event,continuation)=>{
    rentContinuationRef.current=continuation||null;
    setRentDialog({
      id:`rent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...event,
    });
  };
  const confirmRentMoment=()=>{
    if(pausedRef.current||resultRef.current)return;
    const dialog=rentDialog;
    const continuation=rentContinuationRef.current;
    rentContinuationRef.current=null;
    setRentDialog(null);
    if(dialog?.winner==="player"){
      claimGrandPrize();
      return;
    }
    if(pausedRef.current||resultRef.current)return;
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
        updateComputers(prev=>prev.map(cpu=>cpu.active===false?cpu:{...cpu,coins:cpu.coins+getIslandIncome(Object.fromEntries(cpu.owned.map(id=>[id,{level:1}])),tiles).total}));
        const income=getIslandIncome(ownedRef.current,tiles);
        if(income.total){updateGameCoins(value=>value+income.total);setFeedback(`建築收入 +${income.total} 旅費${income.bonus?`（含街區加成 +${income.bonus}）`:''}。輪到你規劃下一站。`)}
        if(playedRef.current>=roundLimit){finishGame();return}
        setTurn(value=>value+1);
        if(cpuBuyPauseRef.current>0)updateCpuBuyPause(v=>Math.max(0,v-1));
        if(!income.total)setFeedback("輪到你。選路、建設或使用道具。");
        return;
      }
      const cpu=computersRef.current[index];
      if(!cpu||cpu.active===false)return playOne(index+1);
      if(cpu.blocked){updateComputers(prev=>prev.map(item=>item.id===cpu.id?{...item,blocked:false}:item));setFeedback(`${cpu.name} 被路障攔住，停走一次。`);showScreenEffect({kind:'card',title:'路障生效',value:cpu.name});playOne(index+1);return}
      const base=rollPetMonopolyDice();
      const options=cpu.control?Array.from({length:6},(_,i)=>({steps:i+1,index:(cpu.position+i+1)%tiles.length})):getIslandRoutes(base,cpu.position,tiles.length);
      const value=route=>{const target=tiles[route.index];if(ownedRef.current[target.id])return -getPetMonopolyRent(target,ownedRef.current[target.id]);if(getPetMonopolyCpuOwner(computersRef.current,target.id,computerCount,cpu.id))return -8;if(isPetMonopolyOwnable(target)&&!cpu.owned.includes(target.id))return cpu.coins>=getPetMonopolyTileCost(target)+20?15:0;return target.type==='event'?7:2};
      const rolled=(cpu.control?options.sort((a,b)=>value(b)-value(a))[0].steps:index===0?base:options.sort((a,b)=>value(b)-value(a))[0].steps)+(cpu.boost?2:0);
      updateComputers(prev=>prev.map(item=>item.id===cpu.id?{...item,boost:false,control:false}:item));
      const nextPos=(cpu.position+rolled)%tiles.length;
      const tile=tiles[nextPos];
      const path=getPetMonopolyMovePath(cpu.position,rolled,tiles.length);
      setMoving({actor:"cpu",name:cpu.name,dice:rolled,to:tile.name,step:0,total:path.length,phase:"rolling"});
      showScreenEffect({kind:"dice",title:cpu.name,value:rolled,icon:"🎲",color:cpu.color});
      path.forEach((pos,step)=>{
        const timer=scheduleMove(()=>{
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
          const tileBonus=nextPos<cpu.position?12:0;
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
            const rentDue=Math.ceil((rentBoostActive?rentBase*2:rentBase)*(current.shield?.5:1));
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
            rentPaid=Math.min(Math.ceil(getPetMonopolyRent(tile,{level:1})*(otherCpuOwner.rent?2:1)*(current.shield?.5:1)),nextCoins);
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
              coins:nextCoins,shield:rentPaid?false:item.shield,
              owned:canBuy?[...item.owned,tile.id]:item.owned,
            };
            if(otherCpuOwner&&item.id===otherCpuOwner.id&&rentPaid)return{...item,coins:item.coins+rentPaid,rent:false};
            return {...item};
          });
          if(tile.type==='event'||tile.type==='boss'){
            const kind=['chance','island-fair'].includes(tile.id)?'fate':'chance';const draw=drawIslandEvent(kind,deckRef.current);deckRef.current=draw.piles;
            const actor=updatedComputers.find(item=>item.id===current.id);
            const option={...(draw.card.options.find(item=>(item.cash||item.allCash||item.steal)&&(!item.cost||actor.coins>=item.cost))||draw.card.options[0])};
            let delta=(option.cash||0)-(option.cost||0)+(option.allCash||0);
            if(option.gamble&&rollPetMonopolyDice()<=3)delta+=option.gamble;
            if(option.duel&&rollPetMonopolyDice()<=3){delta+=option.cost;option.steal=24}
            if(option.tax){if(actor.shield){actor.shield=false}else delta-=Math.min(20,actor.owned.length*4)}
            if(option.allCash){updateGameCoins(value=>value+option.allCash);updatedComputers.forEach(other=>{if(other.id!==actor.id&&other.active!==false)other.coins+=option.allCash})}
            if(option.steal){const rival=[{id:'player',coins:cashRef.current},...updatedComputers.filter(other=>other.id!==actor.id&&other.active!==false)].sort((a,b)=>b.coins-a.coins)[0];const amount=Math.min(rival?.coins||0,option.steal);delta+=amount;if(rival?.id==='player')updateGameCoins(value=>value-amount);else if(rival)updatedComputers.find(other=>other.id===rival.id).coins-=amount}
            if(option.card)actor[option.card]=true;
            if(option.discount)actor.discount=option.discount;
            if(Number.isInteger(option.move))actor.position=option.move;
            actor.coins=Math.max(0,actor.coins+delta);
            setEventFlash({title:`${current.name} · ${kind==='fate'?'命運':'機會'} · ${draw.card.title}`,text:option.label});
          }
          const settled={next:updatedComputers,eliminated:[]};
          updateComputers(settled.next);
          if(canBuy)showScreenEffect({kind:"buy",title:cpu.name,value:tile.name,icon:tile.icon,color:current.color});
          setMoving({actor:"cpu",name:cpu.name,dice:rolled,to:tile.name,step:path.length,total:path.length,result:canBuy?"收購":tile.type==="event"?"事件":"停留",phase:"done"});
          const playerWon=liveComputers(settled.next).length===0;
          const continueCpuRound=()=>{
            if(playerWon){
              claimGrandPrize();
              return;
            }
            const nextTimer=scheduleMove(()=>playOne(index+1),PET_MONOPOLY_CPU_GAP_MS);
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
              joke:playerProperty?"電腦摸摸口袋：這條街怎麼又漲租了？":"電腦互收租金，裁判先喝口水。",
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
    const timer=scheduleMove(playComputerRound,delay);
    moveTimersRef.current.push(timer);
  };
  const roll=()=>{
    if(encounterRef.current||toolTarget||pending||offer||moving||rentDialog||grandPrize||winner||answerReview||pausedRef.current||resultRef.current)return;
    if(routesRef.current)return;
    const baseRoll=rollPetMonopolyDice();
    if(soundEnabledRef.current)soundRef.current.unlock();
    const choices=cardEffectsRef.current.control?Array.from({length:6},(_,i)=>({face:i+1,steps:i+1,index:(position+i+1)%tiles.length})):getIslandRoutes(baseRoll,position,tiles.length,!!cardEffectsRef.current.boost);
    routesRef.current=choices;setRoutes(choices);setInspected(choices[0].index);
    setFeedback('兩條路線各有機會，選一個骰子出發。');
    showScreenEffect({kind:'dice',title:'擲出兩種可能',value:choices.map(route=>route.face).join(' / '),icon:'🎲',color});
  };
  const moveAlongRoute=choice=>{
    const route=routesRef.current?.find(item=>item.steps===choice.steps);
    if(!route||pausedRef.current||resultRef.current)return;
    routesRef.current=null;setRoutes([]);setInspected(null);
    updateCardEffects(prev=>({...prev,control:false}));
    const baseRoll=route.face;
    const boostActive=!!cardEffectsRef.current.boost;
    const rolled=route.steps;
    const nextPos=(position+rolled)%tiles.length;
    const tile=tiles[nextPos];

    const lapBonus=position+rolled>=tiles.length;
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
      const timer=scheduleMove(()=>{
        setPosition(pos);
        if(step+1<path.length){
          setMoving({actor:"player",dice:rolled,to:tile.name,step:step+1,total:path.length,phase:"walking"});
        }else{
          setMoving(null);
          setLastMove({dice:rolled,tile});
          resolveLanding(tile,nextPos,lapBonus);
          setFeedback(`到達「${tile.name}」`);
        }
      },PET_MONOPOLY_DICE_ROLL_MS+PET_MONOPOLY_PLAYER_STEP_MS*(step+1));
      moveTimersRef.current.push(timer);
    });
  };
  const showEncounter=value=>{encounterRef.current=value;setEncounter(value)};
  const endEncounter=()=>{showEncounter(null);queueComputerRound()};
  const resolveLanding=(tile,index,lapBonus)=>{
    playedRef.current+=1;
    const visits=[...new Set([...visitedRef.current,tile.type])];visitedRef.current=visits;setVisited(visits);
    if(lapBonus){updateGameCoins(value=>value+12);setScore(value=>({...value,laps:value.laps+1}))}
    if(selectedPet&&setPets){const reward={petExp:5,bond:1};setPets(prev=>prev.map((pet,i)=>i===petIndex?growPetFromMonopoly(pet,reward):pet));earnedRef.current.petExp+=5;earnedRef.current.bond+=1}
    const cpu=getPetMonopolyCpuOwner(computersRef.current,tile.id,computerCount);
    if(cpu){
      const shield=cardEffectsRef.current.shield;
      const amount=Math.min(cashRef.current,Math.ceil(getPetMonopolyRent(tile,{level:1})*(cpu.rent?2:1)*(shield?.5:1)));
      updateGameCoins(value=>value-amount);updateComputers(prev=>prev.map(item=>item.id===cpu.id?{...item,coins:item.coins+amount,rent:false}:item));
      if(shield)updateCardEffects(prev=>({...prev,shield:false}));
      setRentFlash({title:'過路費',text:shield?`${cpu.name} +${amount} · 護盾減半`:`${cpu.name} +${amount}`,effect:'rent-out'});
      showScreenEffect({kind:'rent-out',title:'支付租金',value:`−${amount}`});
      showRentMoment({kind:'rent-out',payer:'玩家',payee:cpu.name,amount,tileName:tile.name,joke:shield?'護盾已將租金減半。':'保留現金或使用護盾，可以減輕下次的租金壓力。'},()=>queueComputerRound());return;
    }
    if(isPetMonopolyOwnable(tile)&&!ownedRef.current[tile.id]){setOffer({tileId:tile.id,cost:getPetMonopolyTileCost(tile)});return}
    if(tile.type==='event'||tile.type==='boss'){
      const kind=['chance','island-fair'].includes(tile.id)?'fate':'chance';
      const draw=drawIslandEvent(kind,deckRef.current);deckRef.current=draw.piles;
      showEncounter({kind,...draw.card});showScreenEffect({kind:'event',title:kind==='fate'?'命運降臨':'機會來了',value:draw.card.title});return;
    }
    showEncounter({kind:'arrival',title:ownedRef.current[tile.id]?'回到自己的建築':'起點補給',text:ownedRef.current[tile.id]?'歇歇腳，建築會在這輪結束時帶來收入。':'領取 8 旅費補給，繼續規劃下一趟。',options:[{label:'繼續這一輪',cash:tile.type==='start'?8:0}]});
  };
  const resolveEvent=option=>{
    const event=encounterRef.current;
    if(!event||pausedRef.current||resultRef.current||!event.options.includes(option))return;
    if(option.cost&&!option.debt&&cashRef.current<option.cost)return;
    if(option.spendCard&&!cardHand[option.spendCard])return;
    showEncounter(null);
    let delta=(option.cash||0)-Math.min(cashRef.current,option.cost||0),message=option.label;
    if(option.gamble){const won=rollPetMonopolyDice()<=3;delta+=won?option.gamble:0;message=won?'投資成功，收到 36！':'攤位生意清淡，投資沒有回收。'}
    let steal=option.steal||0;
    if(option.duel){const won=rollPetMonopolyDice()<=3;if(won){delta+=option.cost;steal=24}message=won?'挑戰成功！':'挑戰失敗，支付 8 旅費。'}
    if(steal){const rival=[...liveComputers()].sort((a,b)=>b.coins-a.coins)[0];const amount=Math.min(rival?.coins||0,steal);delta+=amount;updateComputers(prev=>prev.map(cpu=>cpu.id===rival?.id?{...cpu,coins:cpu.coins-amount}:cpu));message+=` 轉移 ${amount} 旅費。`}
    if(option.tax){const tax=Math.min(20,Object.keys(ownedRef.current).length*4);if(cardEffectsRef.current.shield){updateCardEffects(prev=>({...prev,shield:false}));message='護盾擋下修繕費！'}else{delta-=tax;message=`維修費 −${Math.min(tax,cashRef.current)}`}}
    if(option.allCash){delta+=option.allCash;updateComputers(prev=>prev.map(cpu=>cpu.active===false?cpu:{...cpu,coins:cpu.coins+option.allCash}))}
    if(option.card)awardCard(option.card);
    if(option.spendCard)setCardHand(prev=>({...prev,[option.spendCard]:prev[option.spendCard]-1}));
    if(option.discount)setUpgradeDiscount(value=>Math.max(value,option.discount));
    if(Number.isInteger(option.move))setPosition(option.move);
    updateGameCoins(value=>value+delta);setFeedback(message);setEventFlash({title:event.title,text:message});
    showScreenEffect({kind:delta<0?'rent-out':'event',title:event.title,value:message});queueComputerRound();
  };
  const buyTool=cardId=>{
    const card=PET_MONOPOLY_CARD_BY_ID[cardId];
    if(!card||shopUsedRef.current===turn||!isIdle()||cashRef.current<card.price||(cardHand[cardId]||0)>=3)return;
    shopUsedRef.current=turn;setShopUsed(turn);updateGameCoins(value=>value-card.price);awardCard(cardId);
  };
  const blockOpponent=id=>{
    if(!toolTarget||pausedRef.current||resultRef.current||toolUsedRef.current===turn||!cardHand.block)return;
    const cpu=liveComputers().find(item=>item.id===id&&!item.blocked);if(!cpu)return;
    toolUsedRef.current=turn;setCardUsedTurn(turn);setToolTarget(false);setCardHand(prev=>({...prev,block:prev.block-1}));
    updateComputers(prev=>prev.map(item=>item.id===id?{...item,blocked:true}:item));showScreenEffect({kind:'card',title:'設置路障',value:`${cpu.name} 停走一次`});setFeedback(`路障已放好：${cpu.name} 下一次停走。`);
  };
  const isIdle=()=>!moving&&!pending&&!offer&&!routesRef.current&&!encounterRef.current&&!rentDialog&&!pausedRef.current&&!resultRef.current&&!toolTarget;
  const openLearning=()=>{
    if(!isIdle()||learningUsedRef.current===turn)return;
    learningUsedRef.current=turn;setLearningUsed(turn);answeringRef.current=false;
    setPending({tile:tiles[position],question:buildPetMonopolyQuestion(lv,tiles[position],turn+position,recentQuestionWordsRef.current)});
  };
  const skipLearning=()=>{if(!pausedRef.current&&!resultRef.current)setPending(null)};
  const answer=idx=>{
    if(!pending||answeringRef.current||pausedRef.current||resultRef.current)return;
    answeringRef.current=true;const question=pending.question;rememberQuestionWord(question);
    if(idx===question.answer){onXp?.(5);earnedRef.current.xp+=5;earnedRef.current.correct+=1;setFeedback('英文小彩蛋：學習 XP +5。');showScreenEffect({kind:'card',title:'學會了',value:'+5 XP'})}
    else setFeedback(`正確答案是 ${question.explain}。遊戲旅費與收購機會不受影響。`);
    setPending(null);
  };
  const offerResolvedRef=useRef(false);
  useEffect(()=>{offerResolvedRef.current=false},[offer]);
  const buyProperty=()=>{
    if(!offer||offerResolvedRef.current||ownedRef.current[offer.tileId]||pausedRef.current||resultRef.current)return;
    const tile=tiles.find(t=>t.id===offer.tileId);
    if(!tile)return setOffer(null);
    if((Number(gameCoins)||0)<offer.cost){
      setFeedback(`旅費不足，還差 ${offer.cost-(Number(gameCoins)||0)} 才能收購「${tile.name}」。可以保留旅費繼續走。`);
      return;
    }
    offerResolvedRef.current=true;
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
    if(!offer||offerResolvedRef.current||pausedRef.current)return;
    offerResolvedRef.current=true;
    if(offer)setFeedback("略過收購");
    setOffer(null);
    queueComputerRound();
  };
  const upgradeCurrentProperty=(tileId=tiles[position].id)=>{
    const property=ownedRef.current[tileId],tile=tiles.find(item=>item.id===tileId);
    if(encounterRef.current||toolTarget||!tile||!property||property.level>=3||upgradedTurnRef.current===turn||moving||pending||offer||routesRef.current||answerReview||rentDialog||pausedRef.current||resultRef.current)return;
    const cost=Math.max(5,getPetMonopolyUpgradeCost(property)-upgradeDiscount);
    if(cashRef.current<cost)return;
    upgradedTurnRef.current=turn;
    updateGameCoins(value=>value-cost);setUpgradeDiscount(0);
    const nextOwned={...ownedRef.current,[tileId]:{...property,level:property.level+1}};
    ownedRef.current=nextOwned;setOwned(nextOwned);setUpgradedTurn(turn);
    setFeedback(`${tile.name} 升到 Lv.${property.level+1}，每輪建築收入 +${(property.level+1)*2}。`);
    showScreenEffect({kind:'upgrade',title:'建築升級',value:`Lv.${property.level+1}`,icon:tile.icon,color});
  };
  return <PetIslandView {...{encounter,resolveEvent,learning,setLearning,learningUsed,openLearning,toolTarget,setToolTarget,blockOpponent,buyTool,shopUsed,soundOn,toggleSound,Hdr,exitGame,gameStarted,result,tiles,position,owned,computers,computerCount,selectedPet,selectedPetDef,
    routes,inspected,setInspected,paused,moving,startGame,roundLimit,setRoundLimit,setupComputerCount,setSetupComputerCount,
    stake,setStake,pets,petIndex,setPetIndex,goalId,setGoalId,visited,turn,gameCoins,score,rankings,pauseGame,skipLearning,
    pending,answer,answerReview,setAnswerReview,queueComputerRound,offer,offerTile,buyProperty,skipOffer,roll,moveAlongRoute,
    feedback,cardHand,cardEffects,cardUsedTurn,useCard,screenEffect,eventFlash,rentFlash,rentDialog,confirmRentMoment,
    upgradeCurrentProperty,upgradedTurn,upgradeDiscount,pauseDialogRef,resumeGame,abandonGame,exitRequested,
    setGameStarted,setResult,resultTitleRef,onBack,onNavigate}}
    cards={PET_MONOPOLY_CARDS} tileCost={getPetMonopolyTileCost} tileRent={getPetMonopolyRent}
    tileUpgradeCost={getPetMonopolyUpgradeCost} typeMeta={PET_MONOPOLY_TYPE_META} eventCount={Object.values(ISLAND_DECKS).flat().length}
    getPetName={pet=>getAdventurePetDef(pet)?.name||pet.petId}/>;
}

export default function PetMonopolyFeature(props){
  const {deps,...rest}=props;
  ({G,Hdr,S,V,escapeRegexSafe,getAdventurePetDef,levelUpPet,shuffleCopy}=deps||{});
  return <PetMonopolyM {...rest}/>;
}
