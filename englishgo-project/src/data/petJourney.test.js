import { describe, expect, it } from 'vitest';
import { applyCampChoice, awardPetPlay, choosePetHabitat, choosePetPath, getJourneyBonus, getPetJourney, getPlayStars, makePetPlay, petPlayReducer, recordPetMoment } from './petJourney.js';
import { planPetPulls } from './petGacha.js';
const foods=[{id:'apple',word:'apple',name:'蘋果'},{id:'milk',word:'milk',name:'牛奶'},{id:'bread',word:'bread',name:'麵包'},{id:'fish',word:'fish',name:'魚'},{id:'banana',word:'banana',name:'香蕉'}];
const pet={petId:'bunny',level:2,bond:380,exp:5,hunger:80,energy:90};
const today=new Date(2026,8,6,12),tomorrow=new Date(2026,8,7,12);
const complete=state=>{
  for(let round=0;round<3;round++){
    state=petPlayReducer(state,{type:'READY'});
    for(const id of state.rounds[state.index].answers)state=petPlayReducer(state,{type:'PICK',id});
    state=petPlayReducer(state,{type:'NEXT'});
  }return state;
};
describe('pet growth and play',()=>{
  it('preserves old pet saves and caps each activity stamp to once per local day',()=>{
    const first=recordPetMoment(pet,'feed',today),again=recordPetMoment(first,'feed',today),next=recordPetMoment(again,'feed',tomorrow);
    expect(first).toMatchObject({...pet,journey:{marks:1,today:['feed']}});
    expect(again).toBe(first);expect(next.journey.marks).toBe(2);expect(next.journey.today).toEqual(['feed']);
    expect(recordPetMoment(pet,'unknown',today)).toBe(pet);
  });
  it('unlocks actual habitats without letting a stored locked value bypass the requirement',()=>{
    expect(choosePetHabitat(pet,'camp')).toBe(pet);
    const grown={...pet,journey:{marks:8,path:'curious'}};
    expect(choosePetHabitat(grown,'camp').journey.habitat).toBe('camp');
    expect(getPetJourney({...pet,journey:{marks:0,habitat:'camp'}}).habitat).toBe('meadow');
    expect(choosePetPath(grown,'brave').journey).toMatchObject({marks:8,path:'brave'});
  });
  it('turns chosen talents into distinct, bounded team benefits',()=>{
    expect(getJourneyBonus(['kind','curious','brave'].map(path=>({...pet,journey:{path,marks:500}})))).toEqual({hp:36,damage:12,guard:9});
    expect(getJourneyBonus([pet])).toEqual({hp:0,damage:0,guard:0});
  });
  it('camp choices heal or grant next-stage bonuses and replace previous camp effects',()=>{
    const battle={stageIndex:0,teamHp:75,maxTeamHp:100,campDamage:12,campGuard:8};
    expect(applyCampChoice(battle,'rest',{maxHp:80})).toMatchObject({stageIndex:1,teamHp:100,campDamage:0,campGuard:0});
    expect(applyCampChoice(battle,'focus',{maxHp:80})).toMatchObject({teamHp:75,campDamage:12,campGuard:0});
    expect(applyCampChoice(battle,'guard',{maxHp:80})).toMatchObject({teamHp:75,campDamage:0,campGuard:8});
    expect(applyCampChoice(battle,'unknown',{maxHp:80})).toBe(battle);
  });
  it('memory missions wait for readiness, freeze during pause and prevent extra rewards from repeat taps',()=>{
    let state=makePetPlay('memory',foods,2,()=>.3);
    const answer=state.rounds[0].answers[0];
    expect(petPlayReducer(state,{type:'PICK',id:answer})).toBe(state);
    state=petPlayReducer(state,{type:'READY'});const paused=petPlayReducer(state,{type:'PAUSE'});
    expect(petPlayReducer(paused,{type:'PICK',id:answer})).toBe(paused);
    state=petPlayReducer(paused,{type:'RESUME'});
    for(const id of state.rounds[0].answers)state=petPlayReducer(state,{type:'PICK',id});
    expect(state.completed).toBe(1);expect(petPlayReducer(state,{type:'PICK',id:answer})).toBe(state);
  });
  it('retries the complete memory route after a mistake and permits a helpful preview',()=>{
    let state=petPlayReducer(makePetPlay('memory',foods,2,()=>.4),{type:'READY'});
    state=petPlayReducer(state,{type:'PICK',id:state.rounds[0].answers[0]});
    const wrong=state.rounds[0].items.find(f=>f.id!==state.rounds[0].answers[1]);
    state=petPlayReducer(state,{type:'PICK',id:wrong.id});expect(state).toMatchObject({step:0,mistakes:1,feedback:'retry'});
    state=petPlayReducer(state,{type:'HINT'});expect(state).toMatchObject({phase:'preview',hints:1});
  });
  it('scales real choices and sequence lengths across all three stages',()=>{
    for(const mode of ['picnic','memory'])for(const level of [1,2,3]){
      const game=makePetPlay(mode,foods,level,()=>.6);expect(game.rounds).toHaveLength(3);
      for(const round of game.rounds){expect(round.items).toHaveLength(level+2);expect(round.answers).toHaveLength(mode==='memory'?level+1:1);expect(new Set(round.answers).size).toBe(round.answers.length)}
    }
    expect(makePetPlay('memory',foods.slice(0,2))).toBeNull();
  });
  it('requires finishing all three rounds, saves best stars and awards daily growth only once',()=>{
    const begun=makePetPlay('picnic',foods,1,()=>.5);expect(awardPetPlay(pet,begun,today)).toBe(pet);
    const done=complete(begun);expect(getPlayStars(done)).toBe(3);
    const first=awardPetPlay(pet,done,today),repeat=awardPetPlay(first,{...done,mistakes:5},today);
    expect(first).toMatchObject({bond:388,exp:23,journey:{marks:1}});
    expect(first.bond).toBe(pet.bond+8);
    expect(repeat.exp).toBe(first.exp);expect(repeat.journey.marks).toBe(1);expect(repeat.playRecords['picnic:1']).toBe(3);
    expect(awardPetPlay(repeat,done,tomorrow).exp).toBe(41);
  });
});
describe('gacha settlement before presentation',()=>{
  const api={rollRarity:()=> 'N',randomPet:rarity=>({id:`pet-${rarity}`,name:rarity}),RARITY_ORDER:{N:0,R:1,SR:2,SSR:3},GACHA_SR_PITY:20,EGG_HATCH_TASKS:{N:10,R:20,SR:30,SSR:40},DUPLICATE_EGG_PROGRESS:{N:3,R:5,SR:8,SSR:10},getDuplicatePetReward:()=>({exp:20,bond:2,dupes:1}),applyDuplicatePetReward:(pet,reward)=>({...pet,exp:pet.exp+reward.exp,bond:pet.bond+reward.bond,dupes:(pet.dupes||0)+1})};
  it('gives SR pity and resets its counter',()=>{
    const result=planPetPulls({count:1,pity:{sinceSR:19,total:19},pets:[],eggs:[],api,now:1});
    expect(result.items[0]).toMatchObject({rarity:'SR',pityHit:true,resultType:'newEgg'});expect(result.pity).toEqual({sinceSR:0,total:20});
  });
  it('merges duplicate eggs within a ten-pull without creating multiple copies or exceeding hatch progress',()=>{
    const result=planPetPulls({count:10,pity:{},pets:[],eggs:[],api,now:1});
    expect(result.eggs).toHaveLength(2);expect(result.eggs.find(e=>e.rarity==='N').progress).toBe(10);
    expect(result.items.at(-1)).toMatchObject({rarity:'R',guarantee:true});
    expect(result.items.filter(item=>item.resultType==='eggMerge')).toHaveLength(8);
  });
  it('boosts existing pets while preserving their growth fields',()=>{
    const existing={...pet,petId:'pet-N',journey:{marks:8,habitat:'camp'}};
    const result=planPetPulls({count:1,pity:{},pets:[existing],eggs:[],api,now:1});
    expect(result.pets[0]).toMatchObject({bond:382,exp:25,journey:{marks:8,habitat:'camp'}});expect(result.eggs).toEqual([]);expect(existing.bond).toBe(380);
  });
});
