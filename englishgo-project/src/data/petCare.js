import { getPetJourney, recordPetMoment, petDay } from './petJourney.js';

export const CARE_CHOICES = [
  {id:'feed',icon:'🍎',name:'餵食',hint:'使用一份食物'},
  {id:'clean',icon:'🫧',name:'洗澡',hint:'清潔恢復到 100'},
  {id:'play',icon:'🎾',name:'玩耍',hint:'首次親密 +10 · 體力 −5'},
  {id:'sleep',icon:'☾',name:'休息',hint:'每天一次體力 +25'},
  {id:'study',icon:'📖',name:'讀書',hint:'首次 XP +30 · 親密 +15'},
];

// A care action can be repeated; growth and currency are earned once per kind/day.
export function completePetCare(pet, action, food, now=new Date()) {
  if(!pet||!CARE_CHOICES.some(item=>item.id===action)||action==='feed'&&!food)return null;
  const today=new Date(now).toDateString();
  const daily=[petDay(now),today].includes(pet.careLog?.date)?pet.careLog:{date:today,actions:[],comboClaimed:false};
  const priorActions=Array.isArray(daily.actions)?daily.actions:[];
  const first=!getPetJourney(pet,now).today.includes(action)&&!priorActions.includes(action);
  let updated={...pet};
  const rewards={coins:first?5:0,exp:first?(action==='study'?30:10):0,bond:first?(action==='study'?15:action==='play'?10:0):0};
  if(action==='feed')updated.hunger=Math.min(100,Math.max(0,pet.hunger??80)+food.feed);
  if(action==='clean'){updated.clean=100;updated.poops=[];}
  if(action==='sleep'&&first)updated.energy=Math.min(100,Math.max(0,pet.energy??80)+25);
  if(action==='play'&&first)updated.energy=Math.max(0,(pet.energy??80)-5);
  const actions=[...new Set([...priorActions,action])];
  const combo=actions.length>=3&&!daily.comboClaimed;
  if(combo){rewards.coins+=20;rewards.exp+=30;rewards.bond+=10;}
  updated={...updated,exp:(pet.exp||0)+rewards.exp,bond:(pet.bond||0)+rewards.bond,
    careLog:{date:today,actions,comboClaimed:daily.comboClaimed||combo},lastUpdate:new Date(now).toISOString()};
  return {pet:recordPetMoment(updated,action,now),rewards,first,combo};
}

export function petNeed(pet){
  if((pet.hunger??80)<60)return {action:'feed',label:'有點餓了，吃點東西吧',icon:'🍎'};
  if((pet.clean??80)<60||(pet.poops||[]).length)return {action:'clean',label:'一起把小家整理乾淨',icon:'🫧'};
  if((pet.energy??80)<50&&!getPetJourney(pet).today.includes('sleep'))return {action:'sleep',label:'休息一下，補充體力',icon:'☾'};
  return {action:'study',label:'精神很好，一起讀點英文',icon:'📖'};
}

// Absence is a gentle reminder, not a punishment. There is no unbounded offline loop.
export function refreshPetCare(pet, now=new Date()){
  const time=new Date(now).getTime(),last=new Date(pet.lastUpdate).getTime();
  if(!Number.isFinite(last)||last>time)return {...pet,energy:Math.min(100,Math.max(0,pet.energy??80)),lastUpdate:new Date(now).toISOString()};
  const hours=Math.max(0,(time-last)/3600000);
  if(hours<0.1)return pet;
  const elapsed=Math.min(hours,8),oldPoops=Array.isArray(pet.poops)?pet.poops.slice(-5):[];
  const count=Math.min(5-oldPoops.length,Math.floor(elapsed/4));
  const poops=[...oldPoops,...Array.from({length:count},(_,i)=>({id:time+i,x:30+i*20,time:new Date(now).toISOString()}))];
  return {...pet,hunger:Math.max(Math.min(pet.hunger??80,20),(pet.hunger??80)-elapsed*2),
    clean:Math.max(Math.min(pet.clean??80,20),(pet.clean??80)-elapsed-count*5),
    energy:Math.min(100,Math.max(0,pet.energy??80)+hours*8),poops,lastUpdate:new Date(now).toISOString()};
}
