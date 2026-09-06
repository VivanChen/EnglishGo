export function planPetPulls({count,pity,pets,eggs,api,now=Date.now()}) {
  const {rollRarity,randomPet,RARITY_ORDER,GACHA_SR_PITY,EGG_HATCH_TASKS,DUPLICATE_EGG_PROGRESS,getDuplicatePetReward,applyDuplicatePetReward}=api;
  let since=Number(pity?.sinceSR)||0;
  const pulls=Array.from({length:count},(_,i)=>{
    let rarity=rollRarity();const pityHit=since>=GACHA_SR_PITY-1;
    if(pityHit&&RARITY_ORDER[rarity]<RARITY_ORDER.SR)rarity='SR';
    since=RARITY_ORDER[rarity]>=RARITY_ORDER.SR?0:since+1;
    return {rarity,pet:randomPet(rarity),pityHit,id:`pull_${now}_${i}`};
  });
  if(count===10&&!pulls.some(p=>RARITY_ORDER[p.rarity]>=RARITY_ORDER.R))pulls[9]={...pulls[9],rarity:'R',pet:randomPet('R'),guarantee:true};
  const nextEggs=eggs.map(e=>({...e})),nextPets=pets.map(p=>({...p}));
  const items=pulls.map((pull,i)=>{
    const petId=pull.pet.id,existing=nextPets.findIndex(p=>p.petId===petId),egg=nextEggs.find(e=>e.petId===petId);
    if(existing>=0){
      const reward=getDuplicatePetReward(pull.rarity);
      nextPets[existing]=applyDuplicatePetReward(nextPets[existing],reward,new Date(now).toISOString());
      return {...pull,petId,resultType:'petBoost',dupeExp:reward.exp,dupeBond:reward.bond};
    }
    if(egg){
      const needed=EGG_HATCH_TASKS[egg.rarity],gain=DUPLICATE_EGG_PROGRESS[pull.rarity];
      const before=egg.progress||0;egg.progress=Math.min(needed,before+gain);egg.updatedAt=new Date(now).toISOString();
      return {...pull,petId,resultType:'eggMerge',progressGain:egg.progress-before,targetProgress:egg.progress,targetNeeded:needed};
    }
    nextEggs.push({id:`egg_${now}_${i}`,rarity:pull.rarity,petId,progress:0,date:new Date(now).toISOString()});
    return {...pull,petId,resultType:'newEgg'};
  });
  return {items,pets:nextPets,eggs:nextEggs,pity:{sinceSR:since,total:(Number(pity?.total)||0)+count}};
}
