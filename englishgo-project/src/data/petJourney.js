// Additive pet data: old saves keep their levels, inventory and care history.
export const PET_PATHS = [
  {id:'kind',name:'暖心夥伴',icon:'♡',description:'穩穩守護隊伍',effect:'每階讓隊伍體力上限 +12',color:'#b55f76'},
  {id:'curious',name:'好奇學者',icon:'✧',description:'把學到的英文變成力量',effect:'每階讓答對的攻擊 +4',color:'#4878a4'},
  {id:'brave',name:'勇敢探險家',icon:'⚑',description:'遇到困難也能再試試',effect:'每階讓答錯的傷害 -3',color:'#4f8060'},
];
export const PET_HABITATS = [
  {id:'meadow',name:'晨光草地',marks:0},
  {id:'pond',name:'荷葉池畔',marks:3},
  {id:'camp',name:'星光營地',marks:8},
];
const EVENTS = ['feed','clean','play','sleep','study','picnic','memory','adventure','monopoly'];
export function petDay(value=new Date()) {
  const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function getPetJourney(pet={},now=new Date()) {
  const raw=pet.journey||{},marks=Math.max(0,Math.floor(Number(raw.marks)||0));
  const path=PET_PATHS.find(p=>p.id===raw.path)||PET_PATHS[0];
  const habitat=PET_HABITATS.find(h=>h.id===raw.habitat&&marks>=h.marks)||PET_HABITATS[0];
  const today=raw.day===petDay(now)?[...new Set((Array.isArray(raw.today)?raw.today:[]).filter(x=>EVENTS.includes(x)))]:[];
  const rank=marks>=12?3:marks>=6?2:marks>=3?1:0;
  const next=[3,6,12].find(n=>n>marks)||null;
  return {...raw,marks,path:path.id,habitat:habitat.id,day:petDay(now),today,rank,next};
}
export function recordPetMoment(pet,event,now=new Date()) {
  const journey=getPetJourney(pet,now);
  if(!EVENTS.includes(event)||journey.today.includes(event))return pet;
  return {...pet,journey:{...journey,marks:journey.marks+1,today:[...journey.today,event],lastMoment:event}};
}
export function choosePetPath(pet,path) {
  return PET_PATHS.some(p=>p.id===path)?{...pet,journey:{...getPetJourney(pet),path}}:pet;
}
export function choosePetHabitat(pet,habitat) {
  const journey=getPetJourney(pet),choice=PET_HABITATS.find(h=>h.id===habitat);
  return choice&&journey.marks>=choice.marks?{...pet,journey:{...journey,habitat}}:pet;
}
export function getJourneyBonus(pets=[]) {
  return pets.reduce((bonus,pet)=>{const {path,rank}=getPetJourney(pet);return {hp:bonus.hp+(path==='kind'?rank*12:0),damage:bonus.damage+(path==='curious'?rank*4:0),guard:bonus.guard+(path==='brave'?rank*3:0)}},{hp:0,damage:0,guard:0});
}
export const CAMP_CHOICES = [
  {id:'rest',icon:'☾',name:'休息一下',description:'回復隊伍 25% 體力'},
  {id:'focus',icon:'✧',name:'練習默契',description:'下一關每次答對多 12 傷害'},
  {id:'guard',icon:'♧',name:'整理裝備',description:'下一關每次答錯少 8 傷害'},
];
export function applyCampChoice(battle,choice,nextStage) {
  if(!CAMP_CHOICES.some(c=>c.id===choice)||!nextStage)return battle;
  return {...battle,stageIndex:battle.stageIndex+1,questionIndex:0,enemyHp:nextStage.maxHp,teamHp:choice==='rest'?Math.min(battle.maxTeamHp,battle.teamHp+Math.ceil(battle.maxTeamHp*.25)):battle.teamHp,campDamage:choice==='focus'?12:0,campGuard:choice==='guard'?8:0,campChoice:choice};
}

// All food words come from PET_FOODS, shared with the care shop.
export function shufflePetItems(items,rng=Math.random) {
  const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result;
}
export function makePetPlay(mode,foods,level=1,rng=Math.random) {
  const pool=shufflePetItems(foods.filter((food,index,list)=>food.id&&food.word&&list.findIndex(f=>f.id===food.id)===index),rng);
  if(pool.length<3)return null;
  const stage=Math.min(3,Math.max(1,level));
  const rounds=Array.from({length:3},(_,round)=>{
    const items=shufflePetItems(pool,rng).slice(0,mode==='memory'?Math.min(pool.length,stage+2):Math.min(pool.length,stage+2));
    const answers=mode==='memory'?shufflePetItems(items,rng).slice(0,Math.min(items.length,stage+1)).map(f=>f.id):[items[0].id];
    return {items:shufflePetItems(items,rng),answers};
  });
  return {mode,level:stage,rounds,index:0,step:0,phase:mode==='memory'?'preview':'playing',mistakes:0,roundMistakes:0,hints:0,feedback:null,completed:0,points:0};
}
export function petPlayReducer(state,action) {
  if(!state)return state;
  if(action.type==='PAUSE'&&['playing','preview','correct'].includes(state.phase))return {...state,resume:state.phase,phase:'paused'};
  if(action.type==='RESUME'&&state.phase==='paused')return {...state,phase:state.resume};
  if(action.type==='READY'&&state.phase==='preview')return {...state,phase:'playing',feedback:null};
  if(action.type==='HINT'&&state.phase==='playing')return {...state,phase:state.mode==='memory'?'preview':'playing',hints:state.hints+1,step:0,feedback:'hint'};
  if(action.type==='PICK'&&state.phase==='playing'){
    const round=state.rounds[state.index];
    if(!round.items.some(item=>item.id===action.id))return state;
    if(round.answers[state.step]!==action.id)return {...state,mistakes:state.mistakes+1,roundMistakes:state.roundMistakes+1,step:0,feedback:'retry'};
    const complete=state.step+1===round.answers.length;
    return {...state,step:state.step+1,phase:complete?'correct':'playing',feedback:complete?'correct':null,completed:state.completed+Number(complete),points:state.points+(complete?Math.max(40,100-state.roundMistakes*20):0)};
  }
  if(action.type==='NEXT'&&state.phase==='correct')return state.index===2?{...state,phase:'done'}:{...state,index:state.index+1,step:0,roundMistakes:0,feedback:null,phase:state.mode==='memory'?'preview':'playing'};
  return state;
}
export function getPlayStars(state){return state?.phase==='done'?1+Number(state.mistakes<=2)+Number(state.mistakes===0&&state.hints===0):0}
export function awardPetPlay(pet,state,now=new Date()) {
  if(!getPlayStars(state))return pet;
  const journey=getPetJourney(pet,now),first=!journey.today.includes(state.mode);
  const old=pet.playRecords||{},key=`${state.mode}:${state.level}`,stars=getPlayStars(state);
  return {...recordPetMoment(pet,state.mode,now),playRecords:{...old,[key]:Math.max(Number(old[key])||0,stars)},bond:(pet.bond||0)+(first?8:0),exp:(pet.exp||0)+(first?18:0),energy:first?Math.max(0,(pet.energy??80)-4):(pet.energy??80),lastUpdate:new Date(now).toISOString()};
}
