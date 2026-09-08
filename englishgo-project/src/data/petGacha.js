const nonnegative = value => Math.max(0, Number(value) || 0);

export function mergePendingEggRewards(...eggs) {
  return eggs.reduce((total, egg) => {
    const reward = egg?.pendingDuplicateReward;
    return {exp: total.exp + nonnegative(reward?.exp), bond: total.bond + nonnegative(reward?.bond), dupes: total.dupes + nonnegative(reward?.dupes)};
  }, {exp: 0, bond: 0, dupes: 0});
}

export function applyPendingEggReward(pet, egg, api, now = new Date().toISOString()) {
  const reward = mergePendingEggRewards(egg);
  if (!reward.exp && !reward.bond && !reward.dupes) return pet;
  return api.applyDuplicatePetReward(pet, reward, now);
}

export function planPetPulls({count,pity,pets,eggs,api,now=Date.now()}) {
  if(count!==1&&count!==10)throw new RangeError('每次可取得 1 顆或 10 顆蛋。');
  const {rollRarity,randomPet,RARITY_ORDER,GACHA_SR_PITY,EGG_HATCH_TASKS,DUPLICATE_EGG_PROGRESS,getDuplicatePetReward,applyDuplicatePetReward}=api;
  let since=Math.floor(nonnegative(pity?.sinceSR));
  const total=Math.floor(nonnegative(pity?.total));
  const pulls=Array.from({length:count},(_,i)=>{
    let rarity=rollRarity();const pityHit=since>=GACHA_SR_PITY-1&&RARITY_ORDER[rarity]<RARITY_ORDER.SR;
    if(pityHit)rarity='SR';
    since=RARITY_ORDER[rarity]>=RARITY_ORDER.SR?0:since+1;
    return {rarity,pet:randomPet(rarity),pityHit,id:`pull_${now}_${total+i}`};
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
      const before=nonnegative(egg.progress);
      // Keep every reward useful, even when repeats within one ten-pull fill an egg.
      if(before>=needed){
        const reward=getDuplicatePetReward(pull.rarity);
        egg.pendingDuplicateReward=mergePendingEggRewards(egg,{pendingDuplicateReward:reward});
        egg.updatedAt=new Date(now).toISOString();
        return {...pull,petId,resultType:'eggReserve',dupeExp:reward.exp,dupeBond:reward.bond,targetProgress:before,targetNeeded:needed};
      }
      egg.progress=Math.min(needed,before+gain);egg.updatedAt=new Date(now).toISOString();
      return {...pull,petId,resultType:'eggMerge',progressGain:egg.progress-before,targetProgress:egg.progress,targetNeeded:needed};
    }
    nextEggs.push({id:`egg_${now}_${total+i}`,rarity:pull.rarity,petId,progress:0,date:new Date(now).toISOString()});
    return {...pull,petId,resultType:'newEgg'};
  });
  return {items,pets:nextPets,eggs:nextEggs,pity:{sinceSR:since,total:total+count}};
}
