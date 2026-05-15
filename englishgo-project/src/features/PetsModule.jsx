import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

let ACTION_PROMPTS,BOND_MILESTONES,DAILY_TASK_DEFS,DUPLICATE_EGG_PROGRESS,DUPLICATE_PET_REWARD,EGG_COST,EGG_HATCH_TASKS,GACHA_SR_PITY,Hdr,MAX_STAT,PETS,PET_ACTIONS,PET_ADVENTURE_BOSS_REQUIRED_CLEARS,PET_ADVENTURE_ENEMY_ICONS,PET_ADVENTURE_SKILLS,PET_ADVENTURE_SKILL_UNLOCKS,PET_ADVENTURE_SKILL_VISUALS,PET_CULTIVATION_ACTIONS,PET_EVENTS,PET_FOODS,RARITY_INFO,RARITY_ORDER,S,STAGE_NAMES,STAGE_SAYINGS,TIME_GREETINGS,applyDuplicatePetReward,buildPetAdventureStages,calcDecay,choosePetFoodForNeed,completePetAdventureProgress,createPetAdventureBgm,getAdventureAnswerLine,getAdventureCorrectSpeech,getAdventurePetDef,getAdventureQuestionMeta,getAdventureQuestionSpeech,getBondLevel,getCareCount,getDuplicateEnergyInfo,getDuplicatePetReward,getEventCenter,getNextPetAdventureSkillCard,getPetAdventureDifficulty,getPetAdventureFatigue,getPetAdventurePower,getPetAdventureProgress,getPetAdventureScore,getPetAdventureSkill,getPetAdventureSkillCards,getPetCareAverage,getPetCareSuggestion,getPetCultivationPlan,getPetDailyCultivation,getPetMood,getPetReadiness,getPetSize,getPetStage,getPetUrgentNeed,getSelectedPetAdventureSkill,getTeamAdventureMorale,getTimeOfDay,hashPin,improvePetAfterAdventure,isPetAdventureBossReady,isPetSleeping,levelUpPet,loadPetAdventureQuestions,petCloudLogin,petCloudSignup,playPetAdventureSkillSound,playSound,randomPet,rollRarity,savePetAdventureProgress,speak,triggerRewardBurst,useLS;
function setPetModuleDeps(deps={}){
  ({ACTION_PROMPTS,BOND_MILESTONES,DAILY_TASK_DEFS,DUPLICATE_EGG_PROGRESS,DUPLICATE_PET_REWARD,EGG_COST,EGG_HATCH_TASKS,GACHA_SR_PITY,Hdr,MAX_STAT,PETS,PET_ACTIONS,PET_ADVENTURE_BOSS_REQUIRED_CLEARS,PET_ADVENTURE_ENEMY_ICONS,PET_ADVENTURE_SKILLS,PET_ADVENTURE_SKILL_UNLOCKS,PET_ADVENTURE_SKILL_VISUALS,PET_CULTIVATION_ACTIONS,PET_EVENTS,PET_FOODS,RARITY_INFO,RARITY_ORDER,S,STAGE_NAMES,STAGE_SAYINGS,TIME_GREETINGS,applyDuplicatePetReward,buildPetAdventureStages,calcDecay,choosePetFoodForNeed,completePetAdventureProgress,createPetAdventureBgm,getAdventureAnswerLine,getAdventureCorrectSpeech,getAdventurePetDef,getAdventureQuestionMeta,getAdventureQuestionSpeech,getBondLevel,getCareCount,getDuplicateEnergyInfo,getDuplicatePetReward,getEventCenter,getNextPetAdventureSkillCard,getPetAdventureDifficulty,getPetAdventureFatigue,getPetAdventurePower,getPetAdventureProgress,getPetAdventureScore,getPetAdventureSkill,getPetAdventureSkillCards,getPetCareAverage,getPetCareSuggestion,getPetCultivationPlan,getPetDailyCultivation,getPetMood,getPetReadiness,getPetSize,getPetStage,getPetUrgentNeed,getSelectedPetAdventureSkill,getTeamAdventureMorale,getTimeOfDay,hashPin,improvePetAfterAdventure,isPetAdventureBossReady,isPetSleeping,levelUpPet,loadPetAdventureQuestions,petCloudLogin,petCloudSignup,playPetAdventureSkillSound,playSound,randomPet,rollRarity,savePetAdventureProgress,speak,triggerRewardBurst,useLS}=deps);
}
function propsWithoutDeps(props){
  const {deps,...rest}=props;
  setPetModuleDeps(deps);
  return rest;
}

function GachaCeremony({rarity,mode}){
  // 不同稀有度的視覺差異
  const config={
    N: {beam:"rgba(255,255,255,0.7)", beamW:80, eggBg:"linear-gradient(135deg,#FFF8DC,#F5DEB3)", glow:"rgba(255,255,255,0.4)", shake:"gc_eggShake_n", orbColors:[]},
    R: {beam:"rgba(74,144,226,0.9)", beamW:100, eggBg:"linear-gradient(135deg,#E6F1FB,#C5DBEC)", glow:"rgba(74,144,226,0.6)", shake:"gc_eggShake_r", orbColors:["#4A90E2","#4A90E2","#6BA4E5"]},
    SR: {beam:"rgba(123,97,255,0.95)", beamW:120, eggBg:"linear-gradient(135deg,#EDE9FE,#C4B5FD)", glow:"rgba(123,97,255,0.7)", shake:"gc_eggShake_sr", orbColors:["#7B61FF","#9F8FFF","#7B61FF","#9F8FFF","#A78BFA"]},
    SSR:{beam:"rgba(255,215,0,1)", beamW:160, eggBg:"linear-gradient(135deg,#FFF3CD,#FFD700)", glow:"rgba(255,215,0,0.9)", shake:"gc_eggShake_ssr", orbColors:["#FFD700","#FFA500","#FFD700","#FFEC8B","#FFD700","#FFA500"]},
  }[rarity||"N"];
  const isSSR=rarity==="SSR";

  const styleSheet=`
@keyframes gc_eggDrop { 0%{transform:translate(-50%,-180px) scale(0.3);opacity:0} 60%{transform:translate(-50%,40px) scale(1.15);opacity:1} 80%{transform:translate(-50%,30px) scale(0.95)} 100%{transform:translate(-50%,40px) scale(1);opacity:1} }
@keyframes gc_eggShake_n { 0%,100%{transform:translate(-50%,40px) rotate(0deg)} 25%{transform:translate(-51%,40px) rotate(-2deg)} 75%{transform:translate(-49%,40px) rotate(2deg)} }
@keyframes gc_eggShake_r { 0%,100%{transform:translate(-50%,40px) rotate(0deg)} 25%{transform:translate(-52%,40px) rotate(-4deg)} 75%{transform:translate(-48%,40px) rotate(4deg)} }
@keyframes gc_eggShake_sr { 0%,100%{transform:translate(-50%,40px) rotate(0deg)} 25%{transform:translate(-53%,38px) rotate(-7deg)} 75%{transform:translate(-47%,38px) rotate(7deg)} }
@keyframes gc_eggShake_ssr { 0%,100%{transform:translate(-50%,40px) rotate(0deg)} 20%{transform:translate(-54%,36px) rotate(-12deg)} 60%{transform:translate(-46%,36px) rotate(12deg)} 80%{transform:translate(-50%,32px) rotate(0deg)} }
@keyframes gc_lightBeam { 0%{opacity:0;height:0} 30%{opacity:0.85;height:280px} 90%{opacity:0.85;height:280px} 100%{opacity:0;height:300px} }
@keyframes gc_screenFlash { 0%,100%{opacity:0} 50%{opacity:0.5} }
@keyframes gc_orb { 0%{transform:translate(0,0) scale(0);opacity:0} 30%{opacity:1;transform:translate(0,0) scale(1)} 100%{transform:translate(var(--gx),var(--gy)) scale(0.3);opacity:0} }
@keyframes gc_label { 0%{transform:translate(-50%,-20px);opacity:0} 30%,100%{transform:translate(-50%,0);opacity:1} }
@media (prefers-reduced-motion: reduce) { [data-gacha-ceremony] *{animation-duration:0.3s !important} }
`;

  const labelTxt=mode==="multi"?"十連抽中...":"抽獎中...";
  const rarityLabel=rarity?{N:"普通",R:"稀有",SR:"超稀有",SSR:"傳說 ✨"}[rarity]:"";

  // 為 SR/SSR 產生光點四散位置
  const orbs=config.orbColors.map((color,i)=>{
    const angle=(i*360/config.orbColors.length)+(i%2?15:-15);
    const distance=isSSR?160+Math.random()*40:120+Math.random()*30;
    return{
      color,
      gx:`${Math.cos(angle*Math.PI/180)*distance}px`,
      gy:`-${Math.abs(Math.sin(angle*Math.PI/180)*distance)+80}px`,
      delay:0.5+i*0.12,
      size:isSSR?10+Math.random()*4:6+Math.random()*4,
    };
  });

  return(<div data-gacha-ceremony style={{
    position:"relative",
    height:340,
    background:isSSR?"linear-gradient(180deg,#3d2817,#1a0f08)":"linear-gradient(180deg,#1a1a2e,#0a0a1f)",
    borderRadius:14,
    overflow:"hidden",
    marginBottom:12,
    boxShadow:`inset 0 0 40px ${config.glow}`,
  }}>
    <style>{styleSheet}</style>

    {/* SSR 全屏閃光 */}
    {isSSR&&<div style={{position:"absolute",inset:0,background:"#FFD700",animation:"gc_screenFlash 1.8s ease-in-out forwards",zIndex:1}}/>}

    {/* 標題標籤 */}
    <div style={{
      position:"absolute",top:16,left:"50%",
      animation:"gc_label 0.5s ease-out forwards",
      fontSize:13,fontWeight:700,
      color:isSSR?"#FFD700":(rarity==="SR"?"#C8B6FF":(rarity==="R"?"#87CEEB":"#fff")),
      background:isSSR?"rgba(255,215,0,0.15)":"rgba(0,0,0,0.4)",
      padding:"4px 14px",borderRadius:14,
      letterSpacing:1.5,zIndex:8,
      boxShadow:isSSR?"0 0 20px rgba(255,215,0,0.6)":"none",
    }}>{rarityLabel||labelTxt}</div>

    {/* 光柱（背景） */}
    <div style={{
      position:"absolute",bottom:60,left:"50%",
      width:config.beamW,
      transform:"translateX(-50%)",
      borderRadius:`${config.beamW/2}px ${config.beamW/2}px 0 0`,
      background:`linear-gradient(180deg,${config.beam},transparent)`,
      animation:"gc_lightBeam 1.5s 0.5s ease-in-out forwards",
      mixBlendMode:"screen",
      zIndex:2,
      filter:isSSR?"blur(2px)":"none",
    }}/>

    {/* SSR 內層更亮的白光柱 */}
    {isSSR&&<div style={{
      position:"absolute",bottom:60,left:"50%",
      width:60,
      transform:"translateX(-50%)",
      borderRadius:"30px 30px 0 0",
      background:"linear-gradient(180deg,rgba(255,255,255,0.95),transparent)",
      animation:"gc_lightBeam 1.5s 0.5s ease-in-out forwards",
      mixBlendMode:"screen",
      zIndex:3,
    }}/>}

    {/* 四散的光點（R/SR/SSR 才有） */}
    {orbs.map((orb,i)=>(<div key={i} style={{
      position:"absolute",bottom:140,left:"50%",
      width:orb.size,height:orb.size,borderRadius:"50%",
      background:orb.color,
      boxShadow:`0 0 ${orb.size*1.5}px ${orb.color}`,
      "--gx":orb.gx,"--gy":orb.gy,
      animation:`gc_orb 1.3s ${orb.delay}s ease-out forwards`,
      zIndex:4,
    }}/>))}

    {/* 蛋本體 */}
    <div style={{
      position:"absolute",top:0,left:"50%",
      width:80,height:100,
      borderRadius:"50% 50% 50% 50% / 60% 60% 40% 40%",
      background:config.eggBg,
      boxShadow:`inset -8px -8px 16px rgba(0,0,0,0.2), 0 0 ${isSSR?50:30}px ${config.glow}`,
      animation:`gc_eggDrop 0.8s ease-out forwards, ${config.shake} 0.15s ease-in-out 0.8s infinite`,
      zIndex:5,
    }}/>

    {/* 蛋上的小裝飾紋路 */}
    <div style={{
      position:"absolute",top:30,left:"50%",
      transform:"translateX(-50%)",
      width:30,height:8,
      borderRadius:"50%",
      background:"rgba(255,255,255,0.5)",
      animation:`gc_eggDrop 0.8s ease-out forwards, ${config.shake} 0.15s ease-in-out 0.8s infinite`,
      zIndex:6,
      pointerEvents:"none",
    }}/>
  </div>);
}

// ═══ GACHA MACHINE (扭蛋機) ═══════════════════════════════════════
function PetAdventurePageInner({lv,onBack,c,pets,setPets,eggs,setEggs,coins,setCoins,inventory,setInventory}){
  const[selectedIds,setSelectedIds]=useState([]);
  const[run,setRun]=useState(null);
  const[battle,setBattle]=useState(null);
  const[feedback,setFeedback]=useState(null);
  const[outcome,setOutcome]=useState(null);
  const[skillLoadout,setSkillLoadout]=useState({});
  const[battleSkillId,setBattleSkillId]=useState(null);
  const[adventureProgress,setAdventureProgress]=useState(()=>getPetAdventureProgress(lv));
  const[prepNotice,setPrepNotice]=useState(null);
  const bgmRef=useRef(null);
  const[battleAudioOn,setBattleAudioOn]=useState(()=>{try{return localStorage.getItem("englishgo_pet_adventure_audio")!=="off"}catch{return true}});
  const stopBattleBgm=useCallback(()=>{
    bgmRef.current?.stop?.();
    bgmRef.current=null;
  },[]);
  const startBattleBgm=useCallback((boss=false,difficulty=1)=>{
    stopBattleBgm();
    if(!battleAudioOn)return;
    bgmRef.current=createPetAdventureBgm({boss,difficulty});
  },[battleAudioOn,stopBattleBgm]);
  useEffect(()=>setAdventureProgress(getPetAdventureProgress(lv)),[lv]);
  useEffect(()=>{
    try{localStorage.setItem("englishgo_pet_adventure_audio",battleAudioOn?"on":"off")}catch{}
    if(!battleAudioOn)stopBattleBgm();
  },[battleAudioOn,stopBattleBgm]);
  useEffect(()=>()=>stopBattleBgm(),[stopBattleBgm]);
  useEffect(()=>{
    if(!run||!battle||!battleAudioOn)return;
    const stage=run.stages[battle.stageIndex];
    const boss=!!stage?.boss;
    if(bgmRef.current?.boss!==boss)startBattleBgm(boss,run.difficultyLevel||1);
  },[run,battle?.stageIndex,battleAudioOn,startBattleBgm]);
  const availablePets=useMemo(()=>pets.map(p=>({pet:p,def:getAdventurePetDef(p),power:getPetAdventurePower(p),skill:getPetAdventureSkill(p)})).filter(x=>x.def),[pets]);
  const selectedPets=availablePets.filter(x=>selectedIds.includes(x.pet.petId)).map(x=>x.pet);
  const teamPower=selectedPets.reduce((sum,p)=>sum+getPetAdventurePower(p),0);
  const teamMoralePreview=getTeamAdventureMorale(selectedPets);
  const teamPrepPlan=useMemo(()=>{
    const inv={...inventory};
    let feed=0,clean=0,rest=0,needsFood=0;
    selectedPets.forEach(p=>{
      const food=choosePetFoodForNeed(p,inv);
      if((p.hunger??80)<80){
        if(food){inv[food.id]=Math.max(0,(inv[food.id]||0)-1);feed++}
        else needsFood++;
      }
      if((p.poops||[]).length>0||(p.clean??80)<75)clean++;
      if((p.energy??80)<65)rest++;
    });
    return{feed,clean,rest,needsFood,total:feed+clean+rest};
  },[selectedPets,inventory]);
  const bestTeamIds=useMemo(()=>[...availablePets].sort((a,b)=>getPetAdventureScore(b.pet)-getPetAdventureScore(a.pet)).slice(0,3).map(x=>x.pet.petId),[availablePets]);
  const lowCareCount=selectedPets.filter(p=>(((p.hunger??80)+(p.clean??80)+(p.energy??80))/3)<55).length;
  const bossReady=isPetAdventureBossReady(adventureProgress);
  const difficultyLevel=getPetAdventureDifficulty(adventureProgress,bossReady);
  const clearsToBoss=Math.max(0,PET_ADVENTURE_BOSS_REQUIRED_CLEARS-(adventureProgress.bossCharge||0));
  const togglePet=(petId)=>{
    setOutcome(null);
    setPrepNotice(null);
    setSelectedIds(ids=>{
      if(ids.includes(petId))return ids.filter(id=>id!==petId);
      if(ids.length>=3)return ids;
      return [...ids,petId];
    });
  };
  const prepareSelectedTeam=()=>{
    if(!selectedPets.length)return;
    const inv={...inventory};
    const selected=new Set(selectedIds);
    const now=new Date().toISOString();
    let fed=0,cleaned=0,rested=0,needsFood=0,changed=0;
    const nextPets=pets.map(p=>{
      if(!selected.has(p.petId))return p;
      let updated={...p};
      let touched=false;
      const food=choosePetFoodForNeed(updated,inv);
      if((updated.hunger??80)<80){
        if(food){
          inv[food.id]=Math.max(0,(inv[food.id]||0)-1);
          updated.hunger=Math.min(MAX_STAT,(updated.hunger??80)+food.feed);
          updated.bond=(updated.bond||0)+1;
          fed++;
          touched=true;
        }else needsFood++;
      }
      if((updated.poops||[]).length>0||(updated.clean??80)<75){
        updated.poops=[];
        updated.clean=MAX_STAT;
        updated.bond=(updated.bond||0)+2;
        cleaned++;
        touched=true;
      }
      if((updated.energy??80)<65){
        updated.energy=MAX_STAT;
        rested++;
        touched=true;
      }
      if(!touched)return p;
      changed++;
      return{...updated,lastUpdate:now};
    });
    if(changed){
      setPets(nextPets);
      setInventory(inv);
      playSound?.("combo");
      setPrepNotice({ok:true,text:`整備完成：餵食 ${fed}、清潔 ${cleaned}、休息 ${rested}${needsFood?`；${needsFood} 隻仍缺食物`:""}`});
    }else{
      playSound?.("good");
      setPrepNotice({ok:needsFood===0,text:needsFood?`${needsFood} 隻寵物需要食物，食物庫存不足。`:"隊伍狀態良好，可以出戰。"});
    }
  };
  const startAdventure=async()=>{
    const team=availablePets.filter(x=>selectedIds.includes(x.pet.petId)).map(x=>x.pet);
    if(!team.length)return;
    const questionData=await loadPetAdventureQuestions();
    const progress=getPetAdventureProgress(lv);
    const ready=isPetAdventureBossReady(progress);
    const difficulty=getPetAdventureDifficulty(progress,ready);
    const stages=buildPetAdventureStages(team,lv,{bossReady:ready,difficultyLevel:difficulty,questionData});
    const power=team.reduce((sum,p)=>sum+getPetAdventurePower(p),0);
    const morale=getTeamAdventureMorale(team);
    const maxTeamHp=Math.round((150+power*.85)*morale.hpMult);
    const loadout=Object.fromEntries(team.map(p=>[p.petId,getSelectedPetAdventureSkill(p,skillLoadout).id]));
    setRun({stages,teamIds:selectedIds,teamPower:power,skillLoadout:loadout,hasBoss:ready,difficultyLevel:difficulty,progress,morale});
    setBattle({stageIndex:0,questionIndex:0,teamHp:maxTeamHp,maxTeamHp,enemyHp:stages[0].maxHp,answered:0,correct:0,miss:0});
    setFeedback(null);
    setOutcome(null);
    setBattleSkillId(null);
    startBattleBgm(!!stages[0]?.boss,difficulty);
    playSound?.("flip");
  };
  const finishAdventure=(won,finalHp)=>{
    stopBattleBgm();
    const hadBoss=!!run?.hasBoss;
    const runDifficulty=run?.difficultyLevel||difficultyLevel||1;
    const bossWin=won&&hadBoss;
    const rewardMult=won?(run?.morale?.rewardMult||1):1;
    const baseCoins=won?(bossWin?260+runDifficulty*45+selectedIds.length*25:90+runDifficulty*18+selectedIds.length*12):18;
    const baseExp=won?(bossWin?170:105):25;
    const rewardFood=PET_FOODS[Math.floor(Math.random()*PET_FOODS.length)];
    const bonusFood=bossWin?PET_FOODS.filter(f=>f.id!==rewardFood.id)[Math.floor(Math.random()*Math.max(1,PET_FOODS.length-1))]:null;
    const unlockedSkill=won&&!bossWin&&Math.random()<0.35?Object.values(PET_ADVENTURE_SKILLS)[Math.floor(Math.random()*Object.values(PET_ADVENTURE_SKILLS).length)]:null;
    const fatigue=getPetAdventureFatigue({won,bossWin});
    const skillReceiver=won&&unlockedSkill?pets.find(p=>selectedIds.includes(p.petId)&&!(p.skills||[]).includes(unlockedSkill.id)):null;
    const reward={
      won,
      bossWin,
      difficultyLevel:runDifficulty,
      coins:Math.round(baseCoins*rewardMult),
      food:rewardFood,
      foodCount:won?(bossWin?6+Math.min(4,Math.floor(runDifficulty/2)):3):1,
      bonusFood,
      bonusFoodCount:bossWin?3+Math.min(3,Math.floor(runDifficulty/3)):0,
      exp:Math.round(baseExp*rewardMult),
      bond:won?(bossWin?32:18):4,
      skill:unlockedSkill,
      skillReceiverName:skillReceiver?(getAdventurePetDef(skillReceiver)?.name||skillReceiver.petId):null,
      fatigue,
      finalHp,
    };
    const updateAdventurePet=p=>improvePetAfterAdventure(p,{
      exp:reward.exp,
      bond:reward.bond,
      skillId:skillReceiver&&p.petId===skillReceiver.petId?unlockedSkill.id:null,
      fatigue,
    });
    reward.growth=pets
      .filter(p=>selectedIds.includes(p.petId))
      .map(p=>{
        const next=updateAdventurePet(p);
        const readiness=getPetReadiness(next);
        return{
          petId:p.petId,
          name:getAdventurePetDef(p)?.name||p.petId,
          fromLevel:p.level||1,
          toLevel:next.level||1,
          exp:reward.exp,
          bond:reward.bond,
          skill:skillReceiver&&p.petId===skillReceiver.petId?unlockedSkill:null,
          readiness,
        };
      });
    setCoins(co=>co+reward.coins);
    setInventory(inv=>{
      const next={...inv,[rewardFood.id]:(inv[rewardFood.id]||0)+reward.foodCount};
      if(bonusFood&&reward.bonusFoodCount)next[bonusFood.id]=(next[bonusFood.id]||0)+reward.bonusFoodCount;
      return next;
    });
    const nextProgress=completePetAdventureProgress(run?.progress||getPetAdventureProgress(lv),won,hadBoss);
    savePetAdventureProgress(lv,nextProgress);
    setAdventureProgress(nextProgress);
    setPets(ps=>ps.map(p=>selectedIds.includes(p.petId)?updateAdventurePet(p):p));
    setOutcome(reward);
    setRun(null);
    setBattle(null);
    setFeedback(null);
    setBattleSkillId(null);
    playSound?.(won?"combo":"good");
  };
  const getBattleSkill=(pet,loadout=run?.skillLoadout,preferredId=battleSkillId)=>{
    const cards=getPetAdventureSkillCards(pet);
    const preferred=cards.find(card=>card.unlocked&&card.skill.id===preferredId);
    return preferred?.skill||getSelectedPetAdventureSkill(pet,loadout||{});
  };
  const getSkillAdvice=(skill,q,turnIndex=0)=>{
    const text=`${q?.q||""} ${q?.zh||""}`;
    if(skill.id==="wordSpark"&&/word|means|單字|意思/i.test(text))return"推薦：這是單字題，傷害提高";
    if(skill.id==="quickStep"&&turnIndex===0)return"推薦：每關第一回合加速攻擊";
    if(skill.id==="melodyHeal")return"穩定：答對後回復隊伍 HP";
    if(skill.id==="braveGuard")return"防守：答錯時降低反擊傷害";
    if(skill.id==="magicLeaf")return"穩定：魔法加傷";
    return"一般技能";
  };
  const isRecommendedSkill=(skill,q,turnIndex=0)=>{
    const text=`${q?.q||""} ${q?.zh||""}`;
    return (skill.id==="wordSpark"&&/word|means|單字|意思/i.test(text))||
      (skill.id==="quickStep"&&turnIndex===0)||
      skill.id==="magicLeaf";
  };
  const answerQuestion=(choiceIndex)=>{
    if(!run||!battle||feedback)return;
    const stage=run.stages[battle.stageIndex];
    const q=stage.questions[battle.questionIndex%stage.questions.length];
    const correct=choiceIndex===q.answer;
    const attacker=selectedPets[(battle.answered||0)%Math.max(1,selectedPets.length)]||selectedPets[0];
    const attackerDef=getAdventurePetDef(attacker);
    const activeSkill=getBattleSkill(attacker,run.skillLoadout,battleSkillId);
    const skillVisual=PET_ADVENTURE_SKILL_VISUALS[activeSkill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
    const skills=selectedPets.map(p=>p.petId===attacker?.petId?activeSkill:getSelectedPetAdventureSkill(p,run.skillLoadout));
    const skillPower=skills.reduce((sum,s)=>sum+(s?.power||0),0);
    const answerSpeech=getAdventureCorrectSpeech(q);
    const answerLine=getAdventureAnswerLine(q);
    if(correct){
      const openingBonus=activeSkill.id==="quickStep"&&battle.questionIndex===0?14:0;
      const wordBonus=activeSkill.id==="wordSpark"&&/word|means|單字|意思/i.test(`${q.q} ${q.zh}`)?12:0;
      const magicBonus=activeSkill.id==="magicLeaf"?8:0;
      const moraleBonus=run.morale?.damageBonus||0;
      const damage=Math.max(12,Math.round(30+run.teamPower*.18+skillPower*.45+activeSkill.power*1.7+openingBonus+wordBonus+magicBonus+moraleBonus+Math.random()*10));
      const heal=skills.some(s=>s?.id==="melodyHeal")?18:10;
      const nextEnemyHp=Math.max(0,battle.enemyHp-damage);
      const nextHp=Math.min(battle.maxTeamHp,battle.teamHp+heal);
      const stageClear=nextEnemyHp<=0;
      const last=battle.stageIndex>=run.stages.length-1;
      setFeedback({
        correct:true,choiceIndex,stageClear,last,damage,heal,tip:q.tip,nextQuestionIndex:battle.questionIndex+1,
        answerSpeech,answerLine,
        attackerId:attacker?.petId,attackerName:attackerDef?.name||attacker?.petId||"Pet",
        skill:activeSkill,skillVisual,
        message:`${attackerDef?.name||"Pet"} used ${activeSkill.name}! ${stage.enemy} took ${damage} damage.`,
        effectKey:Date.now(),
      });
      setBattle(b=>({...b,teamHp:nextHp,enemyHp:nextEnemyHp,answered:b.answered+1,correct:b.correct+1}));
      playPetAdventureSkillSound(activeSkill.id,true);
      window.setTimeout(()=>speak?.(answerSpeech),420);
      if(stageClear&&last){
        window.setTimeout(()=>finishAdventure(true,nextHp),900);
      }
      return;
    }
    const guard=skills.some(s=>s?.id==="braveGuard")?8:0;
    const damage=Math.max(6,stage.attack-guard);
    const nextHp=Math.max(0,battle.teamHp-damage);
    setBattle(b=>({...b,teamHp:nextHp,answered:b.answered+1,miss:b.miss+1}));
    setFeedback({
      correct:false,choiceIndex,stageClear:false,last:false,damage,tip:q.tip,nextQuestionIndex:battle.questionIndex+1,
      answerSpeech,answerLine,
      attackerId:attacker?.petId,attackerName:attackerDef?.name||attacker?.petId||"Pet",
      skill:activeSkill,skillVisual,
      message:`${stage.enemy} counterattacked! Team took ${damage} damage.${guard?" Brave Guard reduced the hit.":""}`,
      effectKey:Date.now(),
    });
    playPetAdventureSkillSound(activeSkill.id,false);
    if(nextHp<=0){
      window.setTimeout(()=>finishAdventure(false,0),900);
    }
  };
  const continueBattle=()=>{
    if(!battle||!feedback)return;
    setBattle(b=>({...b,questionIndex:feedback.nextQuestionIndex||b.questionIndex+1}));
    setFeedback(null);
    setBattleSkillId(null);
  };
  const nextStage=()=>{
    if(!run||!battle)return;
    const nextIndex=battle.stageIndex+1;
    const next=run.stages[nextIndex];
    setBattle(b=>({...b,stageIndex:nextIndex,questionIndex:0,enemyHp:next.maxHp}));
    setFeedback(null);
    setBattleSkillId(null);
    playSound?.("good");
  };
  const resetAdventure=()=>{
    stopBattleBgm();
    setRun(null);setBattle(null);setFeedback(null);setOutcome(null);
    setBattleSkillId(null);
  };
  const hpBar=(value,max,color)=>(
    <div style={{height:10,background:S.bg2,borderRadius:999,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.max(0,Math.min(100,(value/max)*100))}%`,background:color,borderRadius:999,transition:"width .25s"}}/>
    </div>
  );
  if(!availablePets.length){
    return(<div><Hdr t="🗺️ 寵物冒險" onBack={onBack} cl={c.cl}/>
      <div style={{...S.card,padding:"28px 20px",textAlign:"center"}}>
        <div style={{fontSize:46,marginBottom:8}}>🥚</div>
        <div style={{fontSize:20,fontWeight:900,color:S.t1}}>還沒有可出戰的寵物</div>
        <div style={{fontSize:13,color:S.t2,lineHeight:1.7,marginTop:8}}>先到扭蛋機取得寵物，再帶牠們挑戰英文冒險。</div>
      </div>
    </div>);
  }
  if(outcome){
    return(<div><Hdr t="🗺️ 冒險結果" onBack={onBack} cl={c.cl}/>
      <div style={{...S.card,padding:"24px 18px",textAlign:"center",background:`linear-gradient(135deg,${outcome.won?c.bg:"#FFF3CD"},var(--color-background-primary,#fff))`,border:`2px solid ${outcome.won?c.cl:"#EF9F27"}`}}>
        <div style={{fontSize:50,marginBottom:6}}>{outcome.won?"🏆":"🌤️"}</div>
        <div style={{fontSize:24,fontWeight:900,color:S.t1}}>{outcome.won?"冒險勝利！":"這次先撤退"}</div>
        <div style={{fontSize:13,color:S.t2,marginTop:6,lineHeight:1.7}}>{outcome.won?"寵物隊伍完成 3 關英文戰鬥，獲得更多培養資源。":"隊伍仍然獲得練習獎勵，下次可以帶等級更高或照顧狀態更好的寵物。"}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginTop:16,textAlign:"left"}}>
          <div style={{...S.card,padding:"12px",background:S.bg1}}><div style={{fontSize:12,color:S.t3}}>金幣</div><div style={{fontSize:20,fontWeight:900,color:"#EF9F27"}}>+{outcome.coins}</div></div>
          <div style={{...S.card,padding:"12px",background:S.bg1}}><div style={{fontSize:12,color:S.t3}}>道具</div><div style={{fontSize:18,fontWeight:900,color:S.t1}}>{outcome.food.emoji} {outcome.food.name} ×{outcome.foodCount}</div></div>
          {outcome.bonusFood&&<div style={{...S.card,padding:"12px",background:"linear-gradient(135deg,#FFF3CD,var(--color-background-primary,#fff))",border:"2px solid #EF9F27"}}><div style={{fontSize:12,color:S.t3}}>Boss Bonus</div><div style={{fontSize:17,fontWeight:1000,color:"#A05A00"}}>{outcome.bonusFood.emoji} {outcome.bonusFood.name} ×{outcome.bonusFoodCount}</div><div style={{fontSize:11,color:S.t2,marginTop:4}}>魔王獎勵改為金幣與培養道具。</div></div>}
          <div style={{...S.card,padding:"12px",background:S.bg1}}><div style={{fontSize:12,color:S.t3}}>寵物成長</div><div style={{fontSize:18,fontWeight:900,color:c.cl}}>XP +{outcome.exp} · 親密 +{outcome.bond}</div></div>
          {outcome.won&&outcome.skill&&<div style={{...S.card,padding:"12px",background:S.bg1}}><div style={{fontSize:12,color:S.t3}}>可能解鎖技能</div><div style={{fontSize:17,fontWeight:900,color:c.cl}}>{outcome.skill.emoji} {outcome.skill.zh}</div><div style={{fontSize:11,color:S.t2,marginTop:4}}>{outcome.skillReceiverName?`${outcome.skillReceiverName} 已學會。`:"隊伍已會此技能時，保留原有技能。"}</div></div>}
          {outcome.won&&!outcome.bossWin&&<div style={{...S.card,padding:"12px",background:S.bg1}}><div style={{fontSize:12,color:S.t3}}>Boss Progress</div><div style={{fontSize:18,fontWeight:900,color:c.cl}}>{Math.min(PET_ADVENTURE_BOSS_REQUIRED_CLEARS,adventureProgress.bossCharge||0)}/{PET_ADVENTURE_BOSS_REQUIRED_CLEARS}</div><div style={{fontSize:11,color:S.t2,marginTop:4}}>{isPetAdventureBossReady(adventureProgress)?"下一輪會出現魔王。":"繼續完成冒險來累積魔王挑戰。"}</div></div>}
        </div>
        {outcome.growth?.length>0&&<div style={{border:`1px solid ${S.bd}`,borderRadius:14,padding:"12px",marginTop:14,textAlign:"left",background:"rgba(255,255,255,.72)"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
            <div style={{fontSize:16,fontWeight:900,color:S.t1}}>戰後狀態</div>
            <div style={{fontSize:12,fontWeight:800,color:S.t2}}>{outcome.fatigue?.label||"冒險消耗"}：飽食 -{outcome.fatigue?.hunger||0}、清潔 -{outcome.fatigue?.clean||0}、體力 -{outcome.fatigue?.energy||0}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}>
            {outcome.growth.map((g,i)=><div key={`${g.petId}-${i}`} style={{border:`1px solid ${S.bd}`,borderRadius:12,padding:"10px",background:S.bg1}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
                <div style={{fontWeight:900,color:S.t1}}>{g.name}</div>
                <div style={{fontSize:12,fontWeight:900,color:g.readiness.color}}>{g.readiness.emoji} {g.readiness.label}</div>
              </div>
              <div style={{fontSize:12,color:S.t2,marginTop:5}}>Lv.{g.fromLevel}{g.toLevel>g.fromLevel?` → Lv.${g.toLevel}`:""} · XP +{g.exp} · 親密 +{g.bond}</div>
              {g.skill&&<div style={{fontSize:12,color:c.cl,fontWeight:900,marginTop:5}}>新技能：{g.skill.emoji} {g.skill.zh}</div>}
            </div>)}
          </div>
        </div>}
        <div style={{display:"flex",gap:8,marginTop:18}}>
          <button onClick={resetAdventure} style={{...S.btn,background:S.bg2,color:S.t1,flex:1}}>重新組隊</button>
          <button onClick={startAdventure} style={{...S.btn,background:c.cl,color:"#fff",flex:1}}>再冒險</button>
        </div>
      </div>
    </div>);
  }
  if(run&&battle){
    const stage=run.stages[battle.stageIndex];
    const q=stage.questions[battle.questionIndex%stage.questions.length];
    const isBoss=!!stage.boss;
    const activePet=feedback?.attackerId?selectedPets.find(p=>p.petId===feedback.attackerId):(selectedPets[(battle.answered||0)%Math.max(1,selectedPets.length)]||selectedPets[0]);
    const activeDef=getAdventurePetDef(activePet);
    const activeSkill=feedback?.skill||getBattleSkill(activePet,run.skillLoadout,battleSkillId);
    const activeVisual=feedback?.skillVisual||PET_ADVENTURE_SKILL_VISUALS[activeSkill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
    const enemyIcon=PET_ADVENTURE_ENEMY_ICONS[stage.id]||"🌑";
    const activeSkillCards=getPetAdventureSkillCards(activePet);
    const qMeta=getAdventureQuestionMeta(q);
    const questionSpeech=getAdventureQuestionSpeech(q);
    return(<div><Hdr t="🗺️ 寵物冒險" onBack={()=>{stopBattleBgm();setRun(null);setBattle(null);setFeedback(null);setBattleSkillId(null)}} cl={c.cl}/>
      <style>{`
@keyframes advPetReady {0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes advSkillFly {0%{transform:translate(-80px,42px) scale(.4) rotate(-12deg);opacity:0}25%{opacity:1}70%{transform:translate(34px,-16px) scale(1.35) rotate(8deg);opacity:1}100%{transform:translate(74px,-36px) scale(.6) rotate(18deg);opacity:0}}
@keyframes advEnemyHit {0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(7px)}60%{transform:translateX(-4px)}}
@keyframes advDamagePop {0%{transform:translateY(10px) scale(.85);opacity:0}35%{opacity:1}100%{transform:translateY(-18px) scale(1.05);opacity:0}}
@keyframes advDialog {0%{transform:translateY(6px);opacity:.4}100%{transform:translateY(0);opacity:1}}
@keyframes advSkillAura {0%{transform:scale(.7);opacity:.15}55%{transform:scale(1.18);opacity:.65}100%{transform:scale(1.45);opacity:0}}
@keyframes advScreenFlash {0%{opacity:0}20%{opacity:.62}100%{opacity:0}}
@keyframes advCardPulse {0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
[data-pet-adventure-layout]{display:grid;grid-template-columns:minmax(640px,1fr) minmax(300px,360px);gap:14px;align-items:start}
[data-pet-adventure-arena]{min-height:520px !important;margin-bottom:0 !important}
[data-pet-adventure-controls]{display:grid;gap:10px}
[data-adventure-party]{margin-top:6px!important}
[data-adventure-skill-hand],[data-adventure-status],[data-adventure-question]{margin-bottom:0 !important}
[data-adventure-status]{display:none!important}
[data-adventure-question]{position:absolute;left:18px;right:auto;top:64px;width:min(390px,42%);z-index:7;background:rgba(255,255,255,.76)!important;backdrop-filter:blur(14px);box-shadow:0 14px 34px rgba(0,0,0,.18)}
[data-adventure-question]{max-height:none;overflow:visible;border:1px solid rgba(255,255,255,.72)!important}
[data-adventure-question-title]{display:none!important}
[data-adventure-question-prompt]{font-size:16px!important;line-height:1.28!important}
[data-adventure-question-zh]{font-size:11px!important;margin-top:3px!important;opacity:.72}
[data-adventure-question-audio]{position:absolute;top:8px;right:8px;margin-top:0!important;min-height:30px!important;width:32px!important;padding:0!important;font-size:14px!important;background:rgba(255,255,255,.82)!important}
[data-adventure-answers]{display:grid!important;grid-template-columns:1fr 1fr;gap:6px!important;margin-top:8px!important}
[data-adventure-answers] button{min-height:36px!important;padding:8px 10px!important;font-size:13px!important}
[data-adventure-feedback]{margin-top:8px!important;padding:8px 9px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center}
[data-adventure-feedback-result]{font-size:13px!important;line-height:1.25!important}
[data-adventure-feedback-tip]{display:none!important}
[data-adventure-answer-line]{grid-column:1/-1!important;margin-top:0!important}
[data-adventure-answer-line] [data-adventure-answer-text]{font-size:12px!important;line-height:1.25!important}
[data-adventure-answer-line] button{min-height:30px!important;padding:6px 9px!important}
[data-adventure-feedback-action]{grid-column:1/-1!important}
[data-adventure-feedback] button{margin-top:0!important;min-height:34px!important;padding:8px 13px!important;font-size:12px!important;white-space:nowrap}
[data-adventure-answer-line] button{min-height:30px!important;padding:6px 9px!important;font-size:12px!important}
[data-adventure-skill-hand] button{min-height:72px!important;padding:9px 10px!important}
[data-adventure-skill-hand] button div:first-of-type{font-size:16px!important;margin-bottom:2px!important}
[data-adventure-skill-hand] button div:nth-of-type(3){display:none!important}
[data-adventure-skill-hand] > div:first-child{margin-bottom:8px!important}
[data-adventure-skill-hand] > div:first-child > div:first-child > div:first-child{font-size:14px!important}
[data-pet-adventure-controls]{position:sticky;top:10px}
@media (max-width: 820px){
  [data-pet-adventure-layout]{display:grid;grid-template-columns:1fr;grid-template-rows:1fr;position:relative}
  [data-pet-adventure-arena]{grid-area:1/1;min-height:calc(100dvh - 118px) !important;margin-bottom:0 !important}
  [data-pet-adventure-controls]{position:relative;top:auto;grid-area:1/1;align-self:end;z-index:8;padding:8px;gap:6px;max-height:44dvh;overflow:auto;overscroll-behavior:contain}
  [data-adventure-enemy]{right:10px!important;top:12px!important;width:46%!important;max-width:188px!important}
  [data-adventure-enemy] > div:first-child{padding:7px 9px!important}
  [data-adventure-enemy] > div:nth-child(2){font-size:52px!important;margin-top:3px!important}
  [data-adventure-team]{left:10px!important;bottom:132px!important;width:47%!important;max-width:190px!important}
  [data-adventure-team] > div:first-child{min-height:72px!important}
  [data-adventure-team] > div:first-child > div{flex-basis:54px!important}
  [data-adventure-team] > div:nth-child(2){padding:7px 9px!important}
  [data-adventure-dialog]{left:8px!important;right:8px!important;bottom:80px!important;padding:7px 9px!important;font-size:11px!important;border-width:2px!important;opacity:.92}
  [data-adventure-dialog] div{display:none}
  [data-adventure-skill-hand]{padding:8px!important;background:rgba(255,255,255,.92)!important;backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,.12)}
  [data-adventure-skill-hand] > div:first-child{margin-bottom:6px!important}
  [data-adventure-skill-hand] > div:last-child{display:flex!important;gap:7px!important;overflow-x:auto;padding-bottom:2px;scroll-snap-type:x mandatory}
  [data-adventure-skill-hand] button{flex:0 0 116px;min-height:54px!important;padding:7px 8px!important;scroll-snap-align:start}
  [data-adventure-skill-hand] button div:first-of-type{font-size:15px!important;margin-bottom:1px!important}
  [data-adventure-skill-hand] button div:nth-of-type(3){display:none}
  [data-adventure-question]{left:8px!important;right:8px!important;top:124px!important;bottom:auto!important;width:auto!important;max-height:none!important;overflow:visible!important;transform:none!important;padding:9px 10px!important;background:rgba(255,255,255,.88)!important;backdrop-filter:blur(14px);box-shadow:0 10px 28px rgba(0,0,0,.18)}
  [data-adventure-question-title]{font-size:11px!important;margin-bottom:3px!important}
  [data-adventure-question-prompt]{font-size:14px!important;line-height:1.24!important;padding-right:40px!important}
  [data-adventure-question-zh]{font-size:11px!important;margin-top:2px!important}
  [data-adventure-question-audio]{top:8px!important;right:8px!important;padding:0!important;font-size:13px!important;min-height:28px!important;width:30px!important}
  [data-adventure-answers]{gap:5px!important;margin-top:7px!important}
  [data-adventure-answers] button{min-height:34px!important;padding:7px 8px!important;font-size:12px!important}
  [data-adventure-feedback]{margin-top:7px!important;padding:7px 8px!important;grid-template-columns:minmax(0,1fr) auto!important}
  [data-adventure-feedback-result]{font-size:12px!important}
  [data-adventure-answer-line] [data-adventure-answer-text]{font-size:11px!important}
  [data-adventure-feedback] button{min-height:31px!important;padding:7px 10px!important;font-size:11px!important}
}
@media (max-width: 520px){
  [data-pet-adventure-arena]{min-height:calc(100dvh - 108px) !important}
  [data-pet-adventure-controls]{gap:8px}
  [data-adventure-question]{top:118px!important}
  [data-adventure-enemy]{width:44%!important;max-width:168px!important}
  [data-adventure-enemy] > div:nth-child(2){font-size:48px!important}
  [data-adventure-team]{bottom:126px!important;width:48%!important}
  [data-adventure-party]{margin-top:6px!important;grid-template-columns:repeat(3,minmax(0,1fr))!important}
  [data-adventure-party] > div{padding:7px!important;gap:5px!important}
  [data-adventure-party] > div > div:first-child{transform:scale(.78);transform-origin:left center}
  [data-adventure-party] > div > div:last-child div:first-child{font-size:10px!important}
  [data-adventure-party] > div > div:last-child div:last-child{font-size:9px!important}
}
@media (prefers-reduced-motion: reduce) { [data-pet-adventure-battle] *{animation:none !important} }
`}</style>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        {run.stages.map((s,i)=><div key={s.id} title={s.boss?"Boss":"Stage"} style={{flex:s.boss?1.4:1,height:s.boss?11:8,borderRadius:999,background:i<=battle.stageIndex?(s.boss?"linear-gradient(90deg,#7C2D12,#DC2626,#F59E0B)":c.cl):S.bg2,opacity:i===battle.stageIndex?1:.55,boxShadow:s.boss&&i<=battle.stageIndex?"0 0 12px rgba(220,38,38,.45)":"none"}}/> )}
      </div>
      <div data-pet-adventure-layout>
      <div data-pet-adventure-battle data-pet-adventure-arena style={{position:"relative",minHeight:isBoss?304:276,borderRadius:18,overflow:"hidden",marginBottom:10,border:`2px solid ${isBoss?"#DC2626":S.bd}`,background:isBoss?"linear-gradient(160deg,#230812 0%,#3B0A16 42%,#111827 100%)":`linear-gradient(160deg,${c.bg} 0%,var(--color-background-primary,#fff) 42%,#E1F5EE 100%)`,boxShadow:isBoss?"0 18px 40px rgba(220,38,38,.24)":"0 12px 28px rgba(15,110,86,.10)"}}>
        <div style={{position:"absolute",inset:0,background:isBoss?"radial-gradient(circle at 72% 24%, rgba(248,113,113,.35), transparent 30%), radial-gradient(circle at 22% 78%, rgba(124,58,237,.22), transparent 36%)":"radial-gradient(circle at 74% 24%, rgba(255,255,255,.85), transparent 28%), radial-gradient(circle at 20% 76%, rgba(15,110,86,.12), transparent 32%)"}}/>
        {isBoss&&<div style={{position:"absolute",left:14,top:12,zIndex:1,display:"flex",gap:7,alignItems:"center",fontSize:12,fontWeight:1000,color:"#FDE68A",background:"rgba(127,29,29,.78)",border:"1px solid rgba(253,230,138,.45)",borderRadius:999,padding:"6px 10px",boxShadow:"0 0 18px rgba(220,38,38,.35)"}}>👑 BOSS APPEARED · 連勝 3 關後出現</div>}
        {feedback&&<div key={`flash-${feedback.effectKey}`} style={{position:"absolute",inset:0,background:`radial-gradient(circle at 60% 42%, ${activeVisual.glow}, transparent 42%)`,animation:"advScreenFlash .5s ease-out forwards",pointerEvents:"none"}}/>}
        <div data-adventure-enemy style={{position:"absolute",right:18,top:18,width:"42%",maxWidth:260}}>
          <div style={{...S.card,padding:"10px 12px",background:isBoss?"rgba(254,242,242,.94)":"rgba(255,255,255,.88)",border:`2px solid ${isBoss?"#DC2626":S.bd}`}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",fontSize:12,fontWeight:900,color:S.t1}}>
              <span>{stage.enemy}</span><span>Lv.{Math.max(5,8+battle.stageIndex*7)}</span>
            </div>
            <div style={{marginTop:6}}>{hpBar(battle.enemyHp,stage.maxHp,"#E24B4A")}</div>
          </div>
          <div key={`enemy-${feedback?.effectKey||battle.stageIndex}`} style={{fontSize:isBoss?96:70,textAlign:"center",marginTop:isBoss?14:8,filter:isBoss?"drop-shadow(0 0 20px rgba(248,113,113,.72)) drop-shadow(0 16px 14px rgba(0,0,0,.38))":"drop-shadow(0 12px 10px rgba(0,0,0,.16))",animation:feedback?.correct?"advEnemyHit .38s ease-in-out":"none"}}>{enemyIcon}</div>
          {feedback?.correct&&<div key={`dmg-${feedback.effectKey}`} style={{position:"absolute",right:"38%",top:82,fontSize:20,fontWeight:1000,color:"#E24B4A",textShadow:"0 2px 0 #fff",animation:"advDamagePop .8s ease-out forwards"}}>-{feedback.damage}</div>}
        </div>
        <div data-adventure-team style={{position:"absolute",left:14,bottom:74,width:"50%",maxWidth:320}}>
          <div style={{display:"flex",alignItems:"flex-end",gap:4,minHeight:100}}>
            {selectedPets.map((p,i)=>{
              const isActive=p.petId===activePet?.petId;
              return(<div key={p.petId} style={{flex:"0 1 82px",textAlign:"center",opacity:isActive?1:.65,transform:isActive?"scale(1.08)":"scale(.92)",transition:"all .2s",animation:isActive&&!feedback?"advPetReady 1.2s ease-in-out infinite":"none"}}>
                <PixelPet petId={p.petId} stage={getPetStage(p)} size={isActive?74:56} animate={false}/>
                {isActive&&<div style={{height:5,margin:"2px auto 0",width:42,borderRadius:999,background:activeVisual.color}}/>}
              </div>);
            })}
          </div>
          <div style={{...S.card,padding:"10px 12px",background:"rgba(255,255,255,.9)",border:`1px solid ${S.bd}`}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",fontSize:12,fontWeight:900,color:S.t1}}>
              <span>{activeDef?.name||"Team"}</span><span>Team HP</span>
            </div>
            <div style={{marginTop:6}}>{hpBar(battle.teamHp,battle.maxTeamHp,c.cl)}</div>
          </div>
        </div>
        {feedback&&<>
          <div key={`aura-${feedback.effectKey}`} style={{position:"absolute",left:"38%",top:"50%",width:90,height:90,borderRadius:"50%",background:activeVisual.glow,animation:"advSkillAura .72s ease-out forwards",pointerEvents:"none"}}/>
          <div key={`skill-${feedback.effectKey}`} style={{position:"absolute",left:"46%",top:"42%",fontSize:58,color:activeVisual.color,filter:"drop-shadow(0 8px 10px rgba(0,0,0,.2))",animation:"advSkillFly .75s ease-out forwards",pointerEvents:"none"}}>{feedback.correct?activeVisual.effect:"💥"}</div>
        </>}
        <div data-adventure-dialog style={{position:"absolute",left:12,right:12,bottom:10,padding:"12px 14px",borderRadius:14,background:isBoss?"#3B0A16":"#123047",color:"#fff",border:`3px solid ${isBoss?"#FDE68A":"rgba(255,255,255,.9)"}`,boxShadow:"0 6px 16px rgba(0,0,0,.18)",fontSize:14,fontWeight:900,lineHeight:1.5,animation:"advDialog .2s ease-out"}}>
          {feedback?feedback.message:"選技能，答題攻擊。"}
        </div>
        <div data-adventure-question style={{...S.card,padding:"12px 13px",marginBottom:10}}>
          <div data-adventure-question-title style={{fontSize:12,color:c.cl,fontWeight:900,marginBottom:6}}>English Challenge</div>
          <div data-adventure-question-meta style={{display:"inline-flex",alignItems:"center",gap:5,marginBottom:6,padding:"3px 8px",borderRadius:999,background:qMeta.bg,border:`1px solid ${qMeta.color}33`,color:qMeta.color,fontSize:10,fontWeight:1000}}>
            <span>{qMeta.label}</span><span style={{opacity:.72}}>· {qMeta.zh}</span>
          </div>
          <div data-adventure-question-prompt style={{fontSize:17,fontWeight:900,color:S.t1,lineHeight:1.4}}>{q.q}</div>
          <div data-adventure-question-zh style={{fontSize:13,color:S.t2,marginTop:5}}>{q.zh}</div>
          <button data-adventure-question-audio aria-label="朗讀完整題目" title="朗讀完整題目" onClick={()=>speak(questionSpeech)} style={{marginTop:10,border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:999,padding:"7px 12px",fontSize:12,color:S.t2,cursor:"pointer",fontFamily:"inherit"}}>🔊</button>
          <div data-adventure-answers style={{display:"grid",gap:7,marginTop:10}}>
            {q.choices.map((choice,i)=>{
              const locked=!!feedback;
              const isCorrect=i===q.answer;
              const isPicked=feedback?.choiceIndex===i;
              const bg=locked&&isCorrect?"#E1F5EE":locked&&isPicked&&!isCorrect?"#FCEBEB":S.bg2;
              const border=locked&&isCorrect?"2px solid #1D9E75":locked&&isPicked&&!isCorrect?"2px solid #E24B4A":`1px solid ${S.bd}`;
              return(<button key={choice} onClick={()=>answerQuestion(i)} disabled={locked} style={{padding:"10px 12px",borderRadius:12,border,background:bg,textAlign:"left",fontSize:14,fontWeight:800,color:S.t1,cursor:locked?"default":"pointer",fontFamily:"inherit"}}>{choice}</button>);
            })}
          </div>
          {feedback&&<div data-adventure-feedback style={{marginTop:14,padding:"13px 14px",borderRadius:12,background:feedback.correct?"#E1F5EE":"#FFF3CD",border:`1px solid ${feedback.correct?"#1D9E75":"#EF9F27"}55`}}>
            <div data-adventure-feedback-result style={{fontSize:15,fontWeight:900,color:feedback.correct?"#0F6E56":"#856404"}}>{feedback.correct?`答對！造成 ${feedback.damage} 傷害，隊伍回復 ${feedback.heal} HP。`:`答錯了，敵人反擊造成 ${feedback.damage} 傷害。`}</div>
            <div data-adventure-feedback-tip style={{fontSize:12,color:S.t2,marginTop:5}}>重點：{feedback.tip}</div>
            {feedback.answerLine&&<div data-adventure-answer-line style={{marginTop:8,padding:"9px 10px",borderRadius:10,background:"rgba(255,255,255,.72)",border:`1px solid ${feedback.correct?"#1D9E7544":"#EF9F2744"}`,display:"flex",gap:8,alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,color:S.t3,fontWeight:900}}>完整正解</div>
                <div data-adventure-answer-text style={{fontSize:13,color:S.t1,fontWeight:900,lineHeight:1.4,marginTop:2}}>{feedback.answerLine}</div>
              </div>
              <button onClick={()=>speak(feedback.answerSpeech||feedback.answerLine)} aria-label="朗讀完整正解" title="朗讀完整正解" style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:999,padding:"6px 9px",fontSize:12,color:S.t2,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>🔊</button>
            </div>}
            {!feedback.stageClear&&battle.teamHp>0&&<button data-adventure-feedback-action onClick={continueBattle} style={{...S.btn,background:c.cl,color:"#fff",marginTop:10,fontSize:13}}>下一題</button>}
            {feedback.stageClear&&!feedback.last&&<button data-adventure-feedback-action onClick={nextStage} style={{...S.btn,background:c.cl,color:"#fff",marginTop:10,fontSize:13}}>前往下一關</button>}
          </div>}
        </div>
      </div>
      <div data-pet-adventure-controls>
      <div data-adventure-skill-hand style={{...S.card,padding:"12px 14px",marginBottom:10,border:`1px solid ${activeVisual.color}33`,background:`linear-gradient(135deg,${activeVisual.bg},var(--color-background-primary,#fff))`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:9}}>
          <div>
            <div style={{fontSize:13,fontWeight:1000,color:S.t1}}>技能</div>
            {run.morale&&<div style={{fontSize:10,color:run.morale.color,fontWeight:900,marginTop:2}}>{run.morale.emoji} {run.morale.label} · {run.morale.battleText}</div>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <button onClick={()=>setBattleAudioOn(v=>!v)} title={battleAudioOn?"關閉戰鬥音樂":"開啟戰鬥音樂"} style={{border:`1px solid ${battleAudioOn?activeVisual.color:S.bd}`,background:battleAudioOn?activeVisual.bg:S.bg2,borderRadius:999,padding:"5px 8px",fontSize:11,fontWeight:1000,color:battleAudioOn?activeVisual.color:S.t3,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>♪ {battleAudioOn?"ON":"OFF"}</button>
            <div style={{fontSize:12,fontWeight:1000,color:activeVisual.color,whiteSpace:"nowrap"}}>{activeSkill.emoji} {activeSkill.zh}</div>
          </div>
        </div>
        <div data-adventure-skill-grid style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(138px,1fr))",gap:8}}>
          {activeSkillCards.map(card=>{
            const visual=PET_ADVENTURE_SKILL_VISUALS[card.skill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
            const chosen=activeSkill.id===card.skill.id;
            const recommended=card.unlocked&&isRecommendedSkill(card.skill,q,battle.questionIndex);
            return(<button key={card.skill.id} disabled={!!feedback||!card.unlocked} onClick={()=>setBattleSkillId(card.skill.id)} style={{
              position:"relative",
              textAlign:"left",
              minHeight:86,
              padding:"10px 10px",
              borderRadius:12,
              border:`2px solid ${chosen?visual.color:recommended?"#EF9F27":S.bd}`,
              background:chosen?visual.bg:card.unlocked?S.bg1:"#f3f3f0",
              boxShadow:chosen?`0 8px 18px ${visual.glow}`:recommended?"0 6px 14px rgba(239,159,39,.18)":"none",
              opacity:card.unlocked?1:.5,
              cursor:feedback||!card.unlocked?"default":"pointer",
              fontFamily:"inherit",
              overflow:"hidden",
            }}>
              {recommended&&!chosen&&<span style={{position:"absolute",top:6,right:7,fontSize:10,fontWeight:1000,color:"#856404",background:"#FFF3CD",borderRadius:999,padding:"2px 6px"}}>推薦</span>}
              {chosen&&<span style={{position:"absolute",top:6,right:7,fontSize:10,fontWeight:1000,color:"#fff",background:visual.color,borderRadius:999,padding:"2px 6px"}}>已選</span>}
              <div style={{fontSize:18,marginBottom:3}}>{card.skill.emoji}</div>
              <div style={{fontSize:12,fontWeight:1000,color:card.unlocked?visual.color:S.t3}}>{card.skill.name}</div>
              <div style={{fontSize:11,color:S.t2,lineHeight:1.35,marginTop:3,paddingRight:chosen?34:0}}>{card.unlocked?getSkillAdvice(card.skill,q,battle.questionIndex):card.rule.learn}</div>
            </button>);
          })}
        </div>
      </div>
      <div data-adventure-status style={{...S.card,padding:"12px 14px",marginBottom:10,background:isBoss?"linear-gradient(135deg,#FEF2F2,var(--color-background-primary,#fff))":`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`,borderTop:`4px solid ${isBoss?"#DC2626":c.cl}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,color:isBoss?"#DC2626":c.cl,fontWeight:900}}>{isBoss?"BOSS":"Stage"} {isBoss?"":`${battle.stageIndex+1}/3`} · Turn {battle.questionIndex+1} · {stage.zh}</div>
            <div style={{fontSize:18,fontWeight:900,color:S.t1}}>{stage.emoji} {stage.name}</div>
            <div style={{fontSize:12,color:S.t2,marginTop:3}}>Enemy: {stage.enemy}（{stage.enemyZh}）</div>
          </div>
          <button onClick={()=>speak(stage.hint)} style={{...S.btn,background:S.bg1,color:c.cl,fontSize:12}}>朗讀提示</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
          <div><div style={{fontSize:12,fontWeight:900,color:S.t2,marginBottom:4}}>Team HP {battle.teamHp}/{battle.maxTeamHp}</div>{hpBar(battle.teamHp,battle.maxTeamHp,c.cl)}</div>
          <div><div style={{fontSize:12,fontWeight:900,color:S.t2,marginBottom:4}}>Enemy HP {battle.enemyHp}/{stage.maxHp}</div>{hpBar(battle.enemyHp,stage.maxHp,"#E24B4A")}</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10,fontSize:11,fontWeight:900}}>
          <span style={{padding:"4px 8px",borderRadius:999,background:S.bg1,color:S.t2}}>已答 {battle.answered}</span>
          <span style={{padding:"4px 8px",borderRadius:999,background:"#E1F5EE",color:"#0F6E56"}}>答對 {battle.correct}</span>
          <span style={{padding:"4px 8px",borderRadius:999,background:"#FCEBEB",color:"#B42318"}}>失誤 {battle.miss}</span>
        </div>
      </div>
      </div>
      </div>
      <div data-adventure-party style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginTop:10}}>
        {selectedPets.map(p=>{const def=getAdventurePetDef(p);const skill=getSelectedPetAdventureSkill(p,run.skillLoadout);const visual=PET_ADVENTURE_SKILL_VISUALS[skill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;const active=p.petId===activePet?.petId;return(<div key={p.petId} style={{...S.card,padding:"10px",display:"flex",alignItems:"center",gap:8,border:`2px solid ${active?visual.color:S.bd}`,background:active?visual.bg:S.bg1,animation:active&&!feedback?"advCardPulse 1.1s ease-in-out infinite":"none"}}>
          <PixelPet petId={p.petId} stage={getPetStage(p)} size={48} animate={false}/>
          <div style={{minWidth:0}}><div style={{fontSize:12,fontWeight:900,color:S.t1}}>{def?.name||p.petId}</div><div style={{fontSize:11,color:visual.color,fontWeight:900}}>{skill.emoji} {skill.name}</div></div>
        </div>)})}
      </div>
    </div>);
  }
  return(<div><Hdr t="🗺️ 寵物冒險" onBack={onBack} cl={c.cl}/>
    <div style={{...S.card,padding:"16px",marginBottom:12,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`,borderTop:`4px solid ${c.cl}`}}>
      <div style={{fontSize:24,fontWeight:900,color:S.t1}}>帶 3 隻寵物挑戰英文關卡</div>
      <div style={{fontSize:13,color:S.t2,lineHeight:1.7,marginTop:6}}>寵物的等級、親密度、照顧狀態與技能會影響戰力。每次冒險先挑戰 3 個隨機英文關卡，連續打贏後會出現大魔王；擊敗 Boss 可獲得培養道具、技能，還有特殊寵物蛋。</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
        <button onClick={()=>setSelectedIds(bestTeamIds)} style={{...S.btn,background:c.cl,color:"#fff",fontSize:13}}>推薦隊伍</button>
        <button onClick={()=>setSelectedIds([])} style={{...S.btn,background:S.bg1,color:S.t2,fontSize:13}}>清空選擇</button>
        {lowCareCount>0&&<span style={{alignSelf:"center",fontSize:12,fontWeight:800,color:"#B42318",background:"#FCEBEB",borderRadius:999,padding:"6px 10px"}}>{lowCareCount} 隻狀態偏低，戰力會受影響</span>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginTop:14}}>
        <div style={{...S.card,padding:"10px",background:S.bg1}}><div style={{fontSize:11,color:S.t3}}>隊伍</div><div style={{fontSize:18,fontWeight:900,color:c.cl}}>{selectedIds.length}/3</div></div>
        <div style={{...S.card,padding:"10px",background:S.bg1}}><div style={{fontSize:11,color:S.t3}}>總戰力</div><div style={{fontSize:18,fontWeight:900,color:S.t1}}>{teamPower}</div></div>
        <div style={{...S.card,padding:"10px",background:S.bg1}}><div style={{fontSize:11,color:S.t3}}>持有金幣</div><div style={{fontSize:18,fontWeight:900,color:"#EF9F27"}}>{coins}</div></div>
      </div>
    </div>
    <div style={{...S.card,padding:"14px 16px",marginBottom:12,border:`1px solid ${c.cl}33`,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
      <div style={{fontSize:14,fontWeight:900,color:S.t1}}>技能怎麼學？</div>
      <div style={{fontSize:12,color:S.t2,lineHeight:1.7,marginTop:5}}>每隻寵物都有天生技能；照顧、學習與冒險會讓寵物升級，達到等級後可裝備新技能。冒險勝利也可能掉落技能卡，會直接記錄到寵物身上。</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:9}}>
        {Object.values(PET_ADVENTURE_SKILLS).map(skill=>{const visual=PET_ADVENTURE_SKILL_VISUALS[skill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;const rule=PET_ADVENTURE_SKILL_UNLOCKS[skill.id];return(<span key={skill.id} style={{fontSize:11,fontWeight:900,color:visual.color,background:visual.bg,border:`1px solid ${visual.color}33`,borderRadius:999,padding:"5px 8px"}}>{skill.emoji} {skill.zh} · {rule.label}</span>)})}
      </div>
    </div>
    {selectedPets.length>0&&<div style={{...S.card,padding:"11px 14px",marginBottom:10,border:`1px solid ${teamMoralePreview.color}55`,background:`linear-gradient(135deg,${teamMoralePreview.color}12,var(--color-background-primary,#fff))`,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{fontSize:24}}>{teamMoralePreview.emoji}</div>
      <div style={{flex:1,minWidth:190}}>
        <div style={{fontSize:13,fontWeight:1000,color:teamMoralePreview.color}}>隊伍士氣：{teamMoralePreview.label} · 平均照顧 {teamMoralePreview.avg}/100</div>
        <div style={{fontSize:11,color:S.t2,marginTop:2}}>{teamMoralePreview.battleText}</div>
      </div>
    </div>}
    {selectedPets.length>0&&<div style={{...S.card,padding:"11px 14px",marginBottom:10,border:`1px solid ${(teamPrepPlan.total||teamPrepPlan.needsFood)?"#EF9F27":S.bd}`,background:(teamPrepPlan.total||teamPrepPlan.needsFood)?"linear-gradient(135deg,#FFF3CD,var(--color-background-primary,#fff))":S.bg1,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{fontSize:23}}>🎒</div>
      <div style={{flex:1,minWidth:190}}>
        <div style={{fontSize:13,fontWeight:1000,color:(teamPrepPlan.total||teamPrepPlan.needsFood)?"#856404":S.t1}}>出戰整備</div>
        <div style={{fontSize:11,color:S.t2,lineHeight:1.5,marginTop:2}}>
          {(teamPrepPlan.total||teamPrepPlan.needsFood)?`建議處理：餵食 ${teamPrepPlan.feed}、清潔 ${teamPrepPlan.clean}、休息 ${teamPrepPlan.rest}${teamPrepPlan.needsFood?`；缺食物 ${teamPrepPlan.needsFood}`:""}。`:"隊伍照顧狀態良好。"}
        </div>
        {prepNotice&&<div style={{fontSize:11,fontWeight:900,color:prepNotice.ok?"#0F6E56":"#B42318",marginTop:4}}>{prepNotice.text}</div>}
      </div>
      <button onClick={prepareSelectedTeam} style={{...S.btn,background:(teamPrepPlan.total||teamPrepPlan.needsFood)?"#EF9F27":S.bg2,color:(teamPrepPlan.total||teamPrepPlan.needsFood)?"#fff":S.t1,fontSize:12,padding:"9px 12px"}}>{teamPrepPlan.total?"整備隊伍":teamPrepPlan.needsFood?"檢查庫存":"再次檢查"}</button>
    </div>}
    {selectedPets.length>0&&<div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:10}}>
        <div><div style={{fontSize:14,fontWeight:900,color:S.t1}}>出戰卡牌與技能</div><div style={{fontSize:12,color:S.t3,marginTop:2}}>點技能卡可指定這隻寵物在戰鬥中使用的技能。</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:10}}>
        {selectedPets.map(p=>{
          const def=getAdventurePetDef(p);
          const selectedSkill=getSelectedPetAdventureSkill(p,skillLoadout);
          const power=getPetAdventurePower(p);
          return(<div key={p.petId} style={{border:`1px solid ${S.bd}`,borderRadius:14,padding:12,background:S.bg1}}>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
              <div style={{width:76,height:76,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",background:`linear-gradient(135deg,${c.bg},#fff)`,border:`2px solid ${c.cl}33`}}><PixelPet petId={p.petId} stage={getPetStage(p)} size={62} animate={false}/></div>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:15,fontWeight:1000,color:S.t1}}>{def?.name||p.petId}</div>
                <div style={{fontSize:11,color:S.t3,marginTop:2}}>Lv.{p.level||1} · 親密 {p.bond||0} · 戰力 {power}</div>
                <div style={{fontSize:11,color:c.cl,fontWeight:900,marginTop:4}}>裝備：{selectedSkill.emoji} {selectedSkill.zh}</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7}}>
              {getPetAdventureSkillCards(p).map(card=>{
                const visual=PET_ADVENTURE_SKILL_VISUALS[card.skill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
                const chosen=selectedSkill.id===card.skill.id;
                return(<button key={card.skill.id} disabled={!card.unlocked} onClick={()=>setSkillLoadout(loadout=>({...loadout,[p.petId]:card.skill.id}))} style={{textAlign:"left",padding:"8px 9px",borderRadius:10,border:`2px solid ${chosen?visual.color:S.bd}`,background:chosen?visual.bg:card.unlocked?S.bg2:"#f3f3f0",opacity:card.unlocked?1:.52,cursor:card.unlocked?"pointer":"not-allowed",fontFamily:"inherit",minHeight:70}}>
                  <div style={{fontSize:12,fontWeight:1000,color:card.unlocked?visual.color:S.t3}}>{card.skill.emoji} {card.skill.zh}</div>
                  <div style={{fontSize:10,color:S.t3,lineHeight:1.35,marginTop:3}}>{card.unlocked?card.source:card.rule.learn}</div>
                </button>);
              })}
            </div>
          </div>);
        })}
      </div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:10,marginBottom:14}}>
      {availablePets.map(({pet,def,power,skill})=>{
        const selected=selectedIds.includes(pet.petId);
        const ri=RARITY_INFO[pet.rarity]||RARITY_INFO.N;
        const careAvg=getPetCareAverage(pet);
        const readiness=getPetReadiness(pet);
        const adventureScore=getPetAdventureScore(pet);
        const equipped=getSelectedPetAdventureSkill(pet,skillLoadout);
        const equippedVisual=PET_ADVENTURE_SKILL_VISUALS[equipped.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
        return(<button key={pet.petId} onClick={()=>togglePet(pet.petId)} style={{...S.card,padding:"13px",textAlign:"left",border:`2px solid ${selected?equippedVisual.color:S.bd}`,background:selected?`linear-gradient(145deg,${equippedVisual.bg},var(--color-background-primary,#fff))`:S.bg1,cursor:"pointer",fontFamily:"inherit",color:S.t1,position:"relative",overflow:"hidden",boxShadow:selected?`0 10px 24px ${equippedVisual.glow}`:"none"}}>
          {selected&&<div style={{position:"absolute",top:8,right:8,fontSize:11,fontWeight:1000,color:"#fff",background:equippedVisual.color,borderRadius:999,padding:"3px 8px"}}>出戰</div>}
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{width:72,height:72,borderRadius:16,background:`radial-gradient(circle,${equippedVisual.glow},transparent 62%)`,display:"flex",alignItems:"center",justifyContent:"center"}}><PixelPet petId={pet.petId} stage={getPetStage(pet)} size={62} animate={false}/></div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:15,fontWeight:900,color:S.t1}}>{def.name}</div>
              <div style={{fontSize:11,color:ri.color,fontWeight:900}}>{ri.label} · Lv.{pet.level||1}</div>
              <div style={{fontSize:11,color:S.t3,marginTop:3}}>親密 {pet.bond||0} · 狀態 {careAvg}% · 戰力 {power}</div>
              <div style={{fontSize:11,color:readiness.color,fontWeight:900,marginTop:3}}>{readiness.emoji} {readiness.label} · 推薦 {adventureScore}</div>
              <div style={{fontSize:11,color:equippedVisual.color,fontWeight:1000,marginTop:4}}>{equipped.emoji} {equipped.zh}</div>
            </div>
          </div>
          <div style={{marginTop:10,padding:"8px 9px",borderRadius:10,background:S.bg2,fontSize:12,color:S.t2,lineHeight:1.45}}>
            <b style={{color:c.cl}}>{skill.emoji} {skill.zh}</b><br/>{skill.name}: {skill.desc}
          </div>
        </button>);
      })}
    </div>
    <button onClick={startAdventure} disabled={!selectedIds.length} style={{...S.btn,background:selectedIds.length?(bossReady?"#7C2D12":c.cl):S.bg2,color:selectedIds.length?"#fff":S.t3,width:"100%",padding:"15px",fontSize:16,cursor:selectedIds.length?"pointer":"not-allowed"}}>{bossReady?"挑戰魔王":"開始冒險"} · Lv.{difficultyLevel}{!bossReady?` · 魔王還差 ${clearsToBoss} 輪`:""}</button>
  </div>);
}

function GachaPageInner({onBack,c,coins,setCoins,eggs,setEggs,pets,setPets}){
  const[rolling,setRolling]=useState(false);
  const[rollingRarity,setRollingRarity]=useState(null);// (P0-3) 抽蛋動畫期間的稀有度，給光柱動畫用
  const[rollingMode,setRollingMode]=useState(null);// (P0-3) 'single' | 'multi'，給動畫文字用
  const[result,setResult]=useState(null);
  const[showResult,setShowResult]=useState(false);
  const[pity,setPity]=useLS("gachaPity",{sinceSR:0,total:0});
  const countByRarity=list=>Object.keys(RARITY_INFO).reduce((acc,k)=>({...acc,[k]:list.filter(x=>x.rarity===k).length}),{});
  const buildPulls=(count,guaranteeR=false)=>{
    let since=Number(pity?.sinceSR||0);
    const pulls=[];
    for(let i=0;i<count;i++){
      let rarity=rollRarity();
      const pityHit=since>=GACHA_SR_PITY-1;
      if(pityHit&&RARITY_ORDER[rarity]<RARITY_ORDER.SR)rarity="SR";
      const pet=randomPet(rarity);
      pulls.push({rarity,pet,i,pityHit});
      since=RARITY_ORDER[rarity]>=RARITY_ORDER.SR?0:since+1;
    }
    if(guaranteeR&&!pulls.some(p=>RARITY_ORDER[p.rarity]>=RARITY_ORDER.R)){
      const last=pulls[pulls.length-1];
      const pet=randomPet("R");
      pulls[pulls.length-1]={...last,rarity:"R",pet,guarantee:true};
    }
    return{pulls,nextPity:{sinceSR:since,total:Number(pity?.total||0)+count}};
  };
  const settlePulls=(pulls)=>{
    const now=new Date().toISOString();
    const ownedPetIds=new Set(pets.map(p=>p.petId));
    const virtualEggs=new Map(eggs.map(e=>[e.petId,{...e,existing:true}]));
    const eggProgress=new Map();
    const newEggs=[];
    const petRewards={};
    const resolved=pulls.map((pull,i)=>{
      const petId=pull.pet.id;
      if(ownedPetIds.has(petId)){
        const reward=getDuplicatePetReward(pull.rarity);
        petRewards[petId]=petRewards[petId]?{exp:petRewards[petId].exp+reward.exp,bond:petRewards[petId].bond+reward.bond,dupes:petRewards[petId].dupes+reward.dupes}:reward;
        return{...pull,id:`dupe_${Date.now()}_${i}`,petId,resultType:"petBoost",isNew:false,dupeExp:reward.exp,dupeBond:reward.bond};
      }
      const target=virtualEggs.get(petId);
      if(target){
        const gain=DUPLICATE_EGG_PROGRESS[pull.rarity]||DUPLICATE_EGG_PROGRESS.N;
        const needed=EGG_HATCH_TASKS[target.rarity]||EGG_HATCH_TASKS[pull.rarity];
        target.progress=Math.min(needed,(target.progress||0)+gain);
        if(target.existing)eggProgress.set(target.id,target.progress);
        else{
          const newEgg=newEggs.find(e=>e.id===target.id);
          if(newEgg)newEgg.progress=target.progress;
        }
        return{...pull,id:`merge_${Date.now()}_${i}`,petId,resultType:"eggMerge",isNew:false,progressGain:gain,targetEggId:target.id,targetProgress:target.progress,targetNeeded:needed};
      }
      const egg={id:`egg_${Date.now()}_${i}`,rarity:pull.rarity,petId,progress:0,date:now};
      virtualEggs.set(petId,{...egg,existing:false});
      newEggs.push(egg);
      return{...pull,id:egg.id,petId,resultType:"newEgg",egg,isNew:true};
    });
    if(Object.keys(petRewards).length&&setPets){
      setPets(ps=>ps.map(p=>petRewards[p.petId]?applyDuplicatePetReward(p,petRewards[p.petId],now):p));
    }
    if(eggProgress.size||newEggs.length){
      setEggs(es=>[
        ...es.map(e=>eggProgress.has(e.id)?{...e,progress:eggProgress.get(e.id),date:e.date||now,updatedAt:now}:e),
        ...newEggs,
      ]);
    }
    return resolved;
  };
  const runCelebration=(items)=>{
    const hasSSR=items.some(r=>r.rarity==="SSR");
    const hasSR=items.some(r=>r.rarity==="SR");
    if(hasSSR&&typeof triggerRewardBurst==="function"){
      triggerRewardBurst({emoji:"✨",count:14,fromX:window.innerWidth/2,fromY:window.innerHeight*0.4,size:30,duration:1700});
      triggerRewardBurst({emoji:"🌟",count:10,fromX:window.innerWidth/2,fromY:window.innerHeight*0.4,size:26,duration:1900});
      triggerRewardBurst({text:items.length>1?"出 SSR！":"傳說稀有！",fromX:window.innerWidth/2,fromY:"38%",textColor:"#FFD700",textSize:items.length>1?44:40,duration:1800});
    }else if(hasSR&&typeof triggerRewardBurst==="function"){
      triggerRewardBurst({emoji:"✨",count:6,fromX:window.innerWidth/2,fromY:window.innerHeight*0.4,size:22,duration:1300});
    }
  };

  const roll=()=>{
    if(coins<EGG_COST||rolling)return;
    // (P0-3) 提早決定稀有度，讓動畫可以根據結果秀對應光柱
    const{pulls,nextPity}=buildPulls(1,false);
    const{rarity}=pulls[0];
    setRolling(true);
    setRollingRarity(rarity);
    setRollingMode("single");
    setCoins(co=>co-EGG_COST);
    setPity(nextPity);
    playSound("flip");
    setTimeout(()=>{
      const settled=settlePulls(pulls);
      setResult(settled[0]);
      setShowResult(true);
      setRolling(false);
      setRollingRarity(null);
      setRollingMode(null);
      if(rarity==="SSR"||rarity==="SR")playSound("combo");else playSound("good");
      runCelebration(settled);
    },1800);
  };

  const roll10=()=>{
    if(coins<EGG_COST*10||rolling)return;
    // (P0-3) 提早決定 10 個稀有度，動畫顯示最高的那個
    const{pulls:preResults,nextPity}=buildPulls(10,true);
    // 找到最高稀有度作為動畫顯示
    const highest=preResults.reduce((a,b)=>RARITY_ORDER[b.rarity]>RARITY_ORDER[a.rarity]?b:a);
    setRolling(true);
    setRollingRarity(highest.rarity);
    setRollingMode("multi");
    setCoins(co=>co-EGG_COST*10);
    setPity(nextPity);
    playSound("flip");
    setTimeout(()=>{
      const results=settlePulls(preResults);
      setResult({multi:results});
      setShowResult(true);
      setRolling(false);
      setRollingRarity(null);
      setRollingMode(null);
      const hasRare=results.some(r=>r.rarity==="SSR"||r.rarity==="SR");
      if(hasRare)playSound("combo");else playSound("good");
      runCelebration(results);
    },1800);
  };

  if(showResult&&result){
    if(result.multi){
      const summary=countByRarity(result.multi);
      const best=result.multi.reduce((a,b)=>RARITY_ORDER[b.rarity]>RARITY_ORDER[a.rarity]?b:a,result.multi[0]);
      const newCount=result.multi.filter(r=>r.isNew).length;
      const mergedCount=result.multi.filter(r=>r.resultType==="eggMerge").length;
      const boostedCount=result.multi.filter(r=>r.resultType==="petBoost").length;
      return(<div><Hdr t="🎰 扭蛋結果" onBack={()=>{setShowResult(false);setResult(null)}} cl={c.cl}/>
        <div style={{...S.card,padding:"16px",marginBottom:12,borderTop:`4px solid ${RARITY_INFO[best.rarity].color}`,background:`linear-gradient(135deg,${RARITY_INFO[best.rarity].bg},var(--color-background-primary,#fff))`}}>
          <div style={{fontSize:18,fontWeight:900,color:S.t1}}>🎉 十連抽結果</div>
          <div style={{fontSize:12,color:S.t2,marginTop:4,lineHeight:1.7}}>最高稀有度：<b style={{color:RARITY_INFO[best.rarity].color}}>{RARITY_INFO[best.rarity].label}</b> · 新蛋 {newCount} 顆 · 融合 {mergedCount} 顆 · 成長能量 {boostedCount} 次</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>{Object.entries(RARITY_INFO).map(([k,v])=><div key={k} style={{padding:"5px 9px",borderRadius:999,background:v.bg,border:`1px solid ${v.color}33`,fontSize:11,fontWeight:800,color:v.color}}>{v.label} × {summary[k]||0}</div>)}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(108px,1fr))",gap:8}}>
          {result.multi.map((r,i)=>{const ri=RARITY_INFO[r.rarity];return(<div key={r.id} style={{...S.card,padding:"14px 8px",textAlign:"center",background:ri.bg,border:`2px solid ${ri.color}`,animation:`bounceIn .4s ${i*0.08}s both`}}>
            <div style={{display:"flex",justifyContent:"center",gap:4,alignItems:"center",minHeight:18}}><span style={{fontSize:10,fontWeight:800,color:ri.color}}>{ri.stars} {ri.label}</span></div>
            <div style={{display:"flex",justifyContent:"center",margin:"4px auto"}}><PixelPet petId={r.petId} stage={r.resultType==="petBoost"?"adult":"egg"} size={48} animate={false}/></div>
            <div style={{fontSize:12,fontWeight:800,color:S.t1}}>{r.pet.name}</div>
            <div style={{fontSize:10,color:r.isNew?c.cl:r.resultType==="eggMerge"?ri.color:S.t3,fontWeight:800,marginTop:3}}>{r.resultType==="newEgg"?"NEW":r.resultType==="eggMerge"?`融合 +${r.progressGain}`:`XP +${r.dupeExp}`}</div>
            {r.resultType==="petBoost"&&<div style={{fontSize:9,color:S.t3,fontWeight:800,marginTop:2}}>親密度 +{r.dupeBond}</div>}
            {(r.pityHit||r.guarantee)&&<div style={{fontSize:9,color:ri.color,fontWeight:800,marginTop:2}}>{r.pityHit?"SR 保底":"十連保底"}</div>}
          </div>)})}
        </div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button onClick={()=>{setShowResult(false);setResult(null)}} style={{...S.btn,background:c.cl,color:"#fff",fontSize:14,flex:1}}>收下結果</button>
          <button onClick={()=>{setShowResult(false);setResult(null);setTimeout(roll10,200)}} disabled={coins<EGG_COST*10} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14,flex:1,opacity:coins<EGG_COST*10?0.45:1}}>再十連</button>
        </div>
      </div>);
    }
    const ri=RARITY_INFO[result.rarity];
    const title=result.resultType==="newEgg"?`獲得 ${result.pet.name} 蛋！`:result.resultType==="eggMerge"?`${result.pet.name} 蛋已融合！`:`${result.pet.name} 轉成成長能量！`;
    return(<div><Hdr t="🎰 扭蛋結果" onBack={()=>{setShowResult(false);setResult(null)}} cl={c.cl}/>
      <div style={{...S.card,padding:"32px 20px",textAlign:"center",background:`linear-gradient(135deg,${ri.bg},var(--color-background-primary,#fff))`,border:`3px solid ${ri.color}`,animation:"bounceIn .5s ease-out"}}>
        <div style={{fontSize:14,fontWeight:700,color:ri.color,marginBottom:8}}>{ri.stars} {ri.label}</div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:12,animation:"emojiBounce 1.5s ease-in-out infinite"}}><PixelPet petId={result.pet.id} stage={result.resultType==="petBoost"?"adult":"egg"} size={128}/></div>
        <div style={{fontSize:22,fontWeight:700,color:S.t1}}>{title}</div>
        <div style={{fontSize:12,color:result.resultType==="newEgg"?c.cl:ri.color,fontWeight:900,marginTop:4}}>{result.resultType==="newEgg"?"NEW · 已放入蛋倉":result.resultType==="eggMerge"?`重複蛋自動融合 · 孵化進度 +${result.progressGain}`:`已擁有寵物 · XP +${result.dupeExp} · 親密度 +${result.dupeBond}`}</div>
        <div style={{fontSize:13,color:S.t2,marginTop:6}}>預覽：{result.pet.emoji} {result.pet.name}</div>
        <div style={{fontSize:12,color:S.t3,marginTop:8,fontStyle:"italic"}}>{result.pet.story}</div>
        {result.pityHit&&<div style={{marginTop:12,padding:"8px 12px",background:"#FFF3CD",border:"1px solid #EF9F27",borderRadius:10,fontSize:12,color:"#856404",fontWeight:800}}>SR 保底觸發，這次至少超稀有！</div>}
        <div style={{marginTop:16,padding:"10px 14px",background:S.bg2,borderRadius:10,fontSize:13,color:S.t2}}>
          {result.resultType==="newEgg"?`💡 繼續學習 ${EGG_HATCH_TASKS[result.rarity]} 題英文來孵化這顆蛋！`:result.resultType==="eggMerge"?`💡 到蛋倉查看進度：${result.targetProgress}/${result.targetNeeded}`:"💡 到寵物圖鑑查看寵物成長。"}
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button onClick={()=>{setShowResult(false);setResult(null)}} style={{...S.btn,background:c.cl,color:"#fff",fontSize:14,flex:1}}>收下結果</button>
        <button onClick={()=>{setShowResult(false);setResult(null);setTimeout(roll,200)}} disabled={coins<EGG_COST} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14,flex:1,opacity:coins<EGG_COST?0.45:1}}>再抽一次</button>
      </div>
    </div>);
  }

  const totalPets=Object.values(PETS).reduce((a,list)=>a+list.length,0);
  const collectedIds=new Set(pets.map(p=>p.petId));
  const collectedPct=Math.round((collectedIds.size/totalPets)*100);
  const duplicateEnergyTotal=pets.reduce((sum,p)=>sum+(p.dupes||0),0);
  const duplicatePowerBonus=pets.reduce((sum,p)=>sum+getDuplicateEnergyInfo(p).adventureBonus,0);
  const singlePulls=Math.floor(coins/EGG_COST);
  const tenReady=coins>=EGG_COST*10;
  const readyEggs=eggs.filter(e=>e.progress>=EGG_HATCH_TASKS[e.rarity]).length;
  const eggCounts=countByRarity(eggs);
  const srPityLeft=Math.max(1,GACHA_SR_PITY-Number(pity?.sinceSR||0));
  const coinNeed=coins<EGG_COST?EGG_COST-coins:coins<EGG_COST*10?EGG_COST*10-coins:0;

  return(<div><Hdr t="🎰 扭蛋機" onBack={onBack} cl={c.cl}/>
    {/* Coins display */}
    <div style={{...S.card,padding:"16px",marginBottom:12,background:`linear-gradient(135deg,#FFF3CD,#FFE066)`,border:"2px solid #EF9F27"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div><div style={{fontSize:32,fontWeight:900,color:"#EF9F27",lineHeight:1}}>🪙 {coins}</div><div style={{fontSize:12,color:"#856404",marginTop:4}}>可抽 {singlePulls} 次 · 答題可獲得金幣</div></div>
        <div style={{minWidth:150,flex:"1 1 180px"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#856404",fontWeight:800,marginBottom:4}}><span>十連進度</span><span>{Math.min(100,Math.floor(coins/(EGG_COST*10)*100))}%</span></div>
          <div style={{height:8,background:"rgba(255,255,255,.55)",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,coins/(EGG_COST*10)*100)}%`,background:"#EF9F27",borderRadius:999}}/></div>
          <div style={{fontSize:11,color:"#856404",marginTop:4}}>{tenReady?"可以十連抽了":`再 ${coinNeed} 金幣可${coins<EGG_COST?"單抽":"十連抽"}`}</div>
        </div>
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8,marginBottom:12}}>
      <div style={{...S.card,padding:"12px",background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}><div style={{fontSize:12,color:S.t2,fontWeight:700}}>收藏進度</div><div style={{fontSize:20,fontWeight:900,color:c.cl,marginTop:2}}>{collectedIds.size}/{totalPets}</div><div style={{height:6,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${collectedPct}%`,background:c.cl}}/></div></div>
      <div style={{...S.card,padding:"12px"}}><div style={{fontSize:12,color:S.t2,fontWeight:700}}>蛋倉狀態</div><div style={{fontSize:20,fontWeight:900,color:S.t1,marginTop:2}}>🥚 {eggs.length}</div><div style={{fontSize:11,color:readyEggs?c.cl:S.t3,marginTop:4,fontWeight:800}}>{readyEggs?`${readyEggs} 顆可以孵化`:"完成學習任務來孵蛋"}</div></div>
      <div style={{...S.card,padding:"12px",border:`1px solid ${srPityLeft<=3?"#EF9F27":S.bd}`}}><div style={{fontSize:12,color:S.t2,fontWeight:700}}>SR 保底</div><div style={{fontSize:20,fontWeight:900,color:srPityLeft<=3?"#EF9F27":S.t1,marginTop:2}}>最多 {srPityLeft} 抽</div><div style={{fontSize:11,color:S.t3,marginTop:4}}>沒有 SR/SSR 時會累積</div></div>
    </div>

    {/* Rarity rates */}
    <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:8}}><div style={{fontSize:13,fontWeight:800,color:S.t1}}>🎲 抽獎機率</div><div style={{fontSize:11,color:c.cl,fontWeight:800}}>十連至少 1 顆稀有以上</div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(76px,1fr))",gap:6}}>
        {Object.entries(RARITY_INFO).map(([k,v])=>(<div key={k} style={{flex:"1 1 60px",textAlign:"center",padding:"6px 8px",background:v.bg,borderRadius:8,border:`1px solid ${v.color}33`}}>
          <div style={{fontSize:10,fontWeight:700,color:v.color}}>{v.stars}</div>
          <div style={{fontSize:14,fontWeight:700,color:v.color}}>{v.rate}%</div>
          <div style={{fontSize:10,color:S.t3}}>{v.label}</div>
        </div>))}
      </div>
    </div>

    {/* Roll buttons */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
      <button onClick={roll} disabled={coins<EGG_COST||rolling} style={{...S.btn,background:`linear-gradient(135deg,${c.cl},${c.ac})`,color:"#fff",padding:"18px 12px",fontSize:15,opacity:coins<EGG_COST||rolling?0.45:1,boxShadow:`0 4px 12px ${c.cl}40`,display:"flex",flexDirection:"column",gap:3,animation:rolling?"emojiPulse .5s infinite":"none"}}>
        <span style={{fontSize:24}}>🎰</span>
        <span>單抽</span>
        <span style={{fontSize:11,opacity:.9}}>🪙 {EGG_COST}</span>
      </button>
      <button onClick={roll10} disabled={coins<EGG_COST*10||rolling} style={{...S.btn,background:`linear-gradient(135deg,#7B61FF,#9F8FFF)`,color:"#fff",padding:"18px 12px",fontSize:15,opacity:coins<EGG_COST*10||rolling?0.45:1,boxShadow:"0 4px 12px #7B61FF40",display:"flex",flexDirection:"column",gap:3,animation:rolling?"emojiPulse .5s infinite":"none"}}>
        <span style={{fontSize:24}}>✨</span>
        <span>十連抽</span>
        <span style={{fontSize:11,opacity:.9}}>🪙 {EGG_COST*10} · R+ 保底</span>
      </button>
    </div>

    {/* (P0-3) 三段戲劇化抽蛋動畫：落下 → 震動發光 → 自動進結果頁 */}
    {rolling&&<GachaCeremony rarity={rollingRarity} mode={rollingMode}/>}

    {/* Collection stats */}
    <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:800,color:S.t1,marginBottom:8}}>📚 我的收藏與蛋倉</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(76px,1fr))",gap:6}}>
        {Object.entries(RARITY_INFO).map(([k,v])=>{const total=PETS[k].length;const got=pets.filter(p=>p.rarity===k).length;return(<div key={k} style={{flex:"1 1 60px",textAlign:"center",padding:"6px",background:S.bg2,borderRadius:8}}>
          <div style={{fontSize:10,color:v.color,fontWeight:600}}>{v.label}</div>
          <div style={{fontSize:14,fontWeight:700,color:S.t1}}>{got}/{total}</div>
          <div style={{fontSize:10,color:S.t3,marginTop:1}}>蛋 {eggCounts[k]||0}</div>
        </div>)})}
      </div>
      <div style={{marginTop:10,padding:"9px 10px",borderRadius:12,background:"linear-gradient(135deg,#FFF3CD,var(--color-background-primary,#fff))",border:"1px solid #EF9F2744",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div style={{fontSize:22}}>✨</div>
        <div style={{flex:1,minWidth:170}}>
          <div style={{fontSize:12,fontWeight:900,color:"#856404"}}>重複成長能量：{duplicateEnergyTotal}</div>
          <div style={{fontSize:11,color:"#856404",lineHeight:1.5,marginTop:2}}>已轉成冒險戰力 +{duplicatePowerBonus}，同時保留 XP 與親密度補償。</div>
        </div>
      </div>
    </div>

    <div style={{...S.card,padding:"14px 16px",marginBottom:12,border:"1px solid #EF9F2744",background:"linear-gradient(135deg,#FFF9E6,var(--color-background-primary,#fff))"}}>
      <div style={{fontSize:13,fontWeight:900,color:S.t1,marginBottom:8}}>🔁 重複寵物怎麼處理</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:7}}>
        {Object.entries(RARITY_INFO).map(([rarity,info])=>{
          const petReward=DUPLICATE_PET_REWARD[rarity]||DUPLICATE_PET_REWARD.N;
          const eggGain=DUPLICATE_EGG_PROGRESS[rarity]||DUPLICATE_EGG_PROGRESS.N;
          return(<div key={rarity} style={{padding:"8px 9px",borderRadius:11,background:info.bg,border:`1px solid ${info.color}33`}}>
            <div style={{fontSize:11,fontWeight:900,color:info.color}}>{info.stars} {info.label}</div>
            <div style={{fontSize:11,color:S.t2,lineHeight:1.5,marginTop:4}}>已擁有：XP +{petReward.exp} · 親密 +{petReward.bond}</div>
            <div style={{fontSize:11,color:S.t2,lineHeight:1.5}}>重複蛋：孵化 +{eggGain}</div>
          </div>);
        })}
      </div>
    </div>

    {/* How to earn coins */}
    <div style={{...S.card,padding:"14px 16px"}}>
      <div style={{fontSize:13,fontWeight:800,color:S.t1,marginBottom:6}}>💰 如何獲得金幣</div>
      <div style={{fontSize:12,color:S.t2,lineHeight:1.8}}>
        • 每答對 1 題 → 獲得 1-5 🪙<br/>
        • 完成 SRS 輪次 → 額外獎勵<br/>
        • Combo 連擊 → 額外獎勵<br/>
        • 每日目標達成 → 大量金幣<br/>
        • 抽到重複蛋 → 自動融合成孵化進度<br/>
        • 抽到已擁有寵物 → 轉成 XP 與親密度<br/>
        <span style={{color:c.cl,fontWeight:800}}>這裡只使用學習金幣，不需要任何付費抽蛋。</span>
      </div>
    </div>
  </div>);
}


// ═══ PET SOUNDS (寵物叫聲 v2 - 真實聲音模擬) ═════════════════════════════
// Helper: create one "note" with frequency sweep, vibrato, ADSR envelope
function playNote(ctx,opts){
  const{freq,freqEnd,dur,type="sine",volume=0.2,attack=0.01,decay=0.05,start=0,vibrato=0,vibratoSpeed=6,filterFreq=null,filterQ=1,detune=0}=opts;
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  osc.type=type;
  osc.frequency.value=freq;
  if(detune)osc.detune.value=detune;
  const when=ctx.currentTime+start;
  // Frequency sweep (makes sound alive - like real animal vocalization)
  if(freqEnd!==undefined){
    osc.frequency.setValueAtTime(freq,when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20,freqEnd),when+dur);
  }
  // Vibrato (warbling effect for cuter sounds)
  let vibOsc=null,vibGain=null;
  if(vibrato>0){
    vibOsc=ctx.createOscillator();
    vibGain=ctx.createGain();
    vibOsc.frequency.value=vibratoSpeed;
    vibGain.gain.value=vibrato;
    vibOsc.connect(vibGain);
    vibGain.connect(osc.frequency);
    vibOsc.start(when);
    vibOsc.stop(when+dur);
  }
  // ADSR envelope
  gain.gain.setValueAtTime(0,when);
  gain.gain.linearRampToValueAtTime(volume,when+attack);
  gain.gain.linearRampToValueAtTime(volume*0.7,when+attack+decay);
  gain.gain.exponentialRampToValueAtTime(0.0001,when+dur);
  // Optional lowpass filter (makes sound warmer/mufflred)
  let node=gain;
  if(filterFreq){
    const filter=ctx.createBiquadFilter();
    filter.type="lowpass";
    filter.frequency.value=filterFreq;
    filter.Q.value=filterQ;
    gain.connect(filter);
    node=filter;
  }
  osc.connect(gain);
  node.connect(ctx.destination);
  osc.start(when);
  osc.stop(when+dur);
  return osc;
}

// Helper: create noise burst (for consonants, air sounds)
function playNoise(ctx,opts){
  const{dur,volume=0.1,start=0,filterFreq=2000,filterType="bandpass",filterQ=5}=opts;
  const bufferSize=ctx.sampleRate*dur;
  const buffer=ctx.createBuffer(1,bufferSize,ctx.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++)data[i]=Math.random()*2-1;
  const src=ctx.createBufferSource();
  src.buffer=buffer;
  const filter=ctx.createBiquadFilter();
  filter.type=filterType;
  filter.frequency.value=filterFreq;
  filter.Q.value=filterQ;
  const gain=ctx.createGain();
  const when=ctx.currentTime+start;
  gain.gain.setValueAtTime(0,when);
  gain.gain.linearRampToValueAtTime(volume,when+0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001,when+dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(when);
  src.stop(when+dur);
}

function playPetSound(petId){
  if(!window.AudioContext&&!window.webkitAudioContext)return;
  let ctx;
  try{ctx=new (window.AudioContext||window.webkitAudioContext)()}catch{return}

  // Detailed sound recipes per pet species
  const recipes={
    // N tier - everyday cute animals
    bunny:()=>{
      // Soft squeak "mew mew" - two short rising chirps
      playNote(ctx,{freq:720,freqEnd:1100,dur:0.08,type:"sine",volume:0.12,vibrato:15,vibratoSpeed:20,filterFreq:3000,attack:0.005});
      playNote(ctx,{freq:800,freqEnd:1200,dur:0.09,type:"sine",volume:0.12,vibrato:15,vibratoSpeed:20,filterFreq:3000,start:0.12,attack:0.005});
    },
    chick:()=>{
      // "Cheep cheep cheep!" - three quick high chirps
      [0,0.13,0.26].forEach(t=>{
        playNote(ctx,{freq:2400,freqEnd:1800,dur:0.06,type:"triangle",volume:0.08,vibrato:40,vibratoSpeed:30,filterFreq:5000,start:t,attack:0.003});
      });
    },
    puppy:()=>{
      // Playful "yip!" - quick bark with slight growl
      playNote(ctx,{freq:180,freqEnd:220,dur:0.04,type:"sawtooth",volume:0.1,filterFreq:800,filterQ:2,attack:0.002});
      playNote(ctx,{freq:500,freqEnd:350,dur:0.14,type:"sawtooth",volume:0.15,filterFreq:1200,start:0.03,attack:0.005});
      playNoise(ctx,{dur:0.05,volume:0.04,filterFreq:3000,filterType:"highpass"});
    },
    kitty:()=>{
      // "Meow" - warm descending purr-like sound
      playNote(ctx,{freq:800,freqEnd:400,dur:0.35,type:"triangle",volume:0.13,vibrato:8,vibratoSpeed:5,filterFreq:1500,filterQ:2,attack:0.03,decay:0.1});
      playNote(ctx,{freq:1200,freqEnd:600,dur:0.3,type:"sine",volume:0.05,vibrato:8,vibratoSpeed:5,filterFreq:2000,start:0.02});
    },
    piggy:()=>{
      // "Oink oink!" - two grunts
      [0,0.18].forEach(t=>{
        playNote(ctx,{freq:220,freqEnd:180,dur:0.12,type:"sawtooth",volume:0.13,filterFreq:900,filterQ:3,start:t,attack:0.005});
        playNoise(ctx,{dur:0.1,volume:0.05,filterFreq:1500,filterType:"bandpass",filterQ:3,start:t});
      });
    },
    froggy:()=>{
      // "Ribbit!" - low warble with throat resonance
      playNote(ctx,{freq:180,freqEnd:240,dur:0.1,type:"square",volume:0.1,filterFreq:600,filterQ:4,attack:0.003});
      playNote(ctx,{freq:240,freqEnd:180,dur:0.15,type:"square",volume:0.11,filterFreq:600,filterQ:4,vibrato:30,vibratoSpeed:25,start:0.1});
    },
    // R tier
    panda:()=>{
      // Cute bleat-like sound
      playNote(ctx,{freq:280,freqEnd:320,dur:0.15,type:"sine",volume:0.13,vibrato:20,vibratoSpeed:15,filterFreq:1200,attack:0.02});
      playNote(ctx,{freq:320,freqEnd:260,dur:0.2,type:"sine",volume:0.12,vibrato:20,vibratoSpeed:15,filterFreq:1200,start:0.17});
    },
    koala:()=>{
      // Low grunt-bellow
      playNote(ctx,{freq:130,freqEnd:100,dur:0.3,type:"sawtooth",volume:0.14,filterFreq:500,filterQ:5,attack:0.05,decay:0.1});
      playNote(ctx,{freq:260,freqEnd:200,dur:0.25,type:"triangle",volume:0.06,filterFreq:800,start:0.05});
    },
    fox:()=>{
      // High "yip-yip!" - sharp and quick
      [0,0.12].forEach(t=>{
        playNote(ctx,{freq:900,freqEnd:600,dur:0.08,type:"triangle",volume:0.13,vibrato:20,filterFreq:2500,start:t,attack:0.003});
      });
    },
    owl:()=>{
      // "Hoo hoo" - two deep hoots with wide vibrato
      [0,0.35].forEach(t=>{
        playNote(ctx,{freq:400,freqEnd:380,dur:0.3,type:"sine",volume:0.1,vibrato:15,vibratoSpeed:8,filterFreq:1000,filterQ:3,attack:0.08,decay:0.05,start:t});
      });
    },
    penguin:()=>{
      // Honking bray
      playNote(ctx,{freq:500,freqEnd:700,dur:0.12,type:"sawtooth",volume:0.12,filterFreq:1500,filterQ:3,attack:0.01});
      playNote(ctx,{freq:700,freqEnd:400,dur:0.15,type:"sawtooth",volume:0.13,filterFreq:1500,filterQ:3,start:0.1});
    },
    // SR tier - magical creatures
    unicorn:()=>{
      // Magical sparkle + gentle whinny
      playNote(ctx,{freq:800,freqEnd:1400,dur:0.15,type:"triangle",volume:0.09,vibrato:30,vibratoSpeed:12,filterFreq:3000,attack:0.02});
      playNote(ctx,{freq:1600,freqEnd:2400,dur:0.2,type:"sine",volume:0.06,filterFreq:4000,start:0.08,attack:0.02});
      playNote(ctx,{freq:2400,freqEnd:3600,dur:0.25,type:"sine",volume:0.04,start:0.15,attack:0.03});
    },
    dragon:()=>{
      // Deep growl + flame whoosh
      playNote(ctx,{freq:80,freqEnd:60,dur:0.4,type:"sawtooth",volume:0.15,filterFreq:400,filterQ:6,vibrato:5,attack:0.05});
      playNote(ctx,{freq:160,freqEnd:120,dur:0.35,type:"square",volume:0.1,filterFreq:600,start:0.02});
      playNoise(ctx,{dur:0.3,volume:0.08,filterFreq:800,filterType:"lowpass",start:0.1});
    },
    whale:()=>{
      // Deep haunting song with wave modulation
      playNote(ctx,{freq:150,freqEnd:110,dur:0.8,type:"sine",volume:0.14,vibrato:10,vibratoSpeed:3,filterFreq:500,filterQ:2,attack:0.1,decay:0.15});
      playNote(ctx,{freq:110,freqEnd:170,dur:0.7,type:"sine",volume:0.1,vibrato:8,vibratoSpeed:2,filterFreq:600,start:0.4,attack:0.1});
    },
    // SSR tier - legendary
    phoenix:()=>{
      // Majestic bird call with flame crackle
      playNote(ctx,{freq:1400,freqEnd:2200,dur:0.25,type:"triangle",volume:0.12,vibrato:40,vibratoSpeed:18,filterFreq:4000,attack:0.01});
      playNote(ctx,{freq:2200,freqEnd:1800,dur:0.2,type:"triangle",volume:0.1,vibrato:30,vibratoSpeed:15,filterFreq:4000,start:0.22});
      playNote(ctx,{freq:1800,freqEnd:2600,dur:0.15,type:"sine",volume:0.08,filterFreq:5000,start:0.4});
      playNoise(ctx,{dur:0.5,volume:0.03,filterFreq:3000,filterType:"bandpass",filterQ:8});
    },
    celestial:()=>{
      // Ethereal chord with shimmer
      [0,0.05,0.1].forEach((t,i)=>{
        playNote(ctx,{freq:[880,1100,1320][i],dur:0.5,type:"sine",volume:0.07,vibrato:15,vibratoSpeed:6,filterFreq:3000,attack:0.1,decay:0.1,start:t});
      });
      playNote(ctx,{freq:1760,dur:0.4,type:"sine",volume:0.04,vibrato:30,vibratoSpeed:10,start:0.2,attack:0.1});
      playNote(ctx,{freq:2640,freqEnd:3520,dur:0.3,type:"sine",volume:0.03,start:0.3,attack:0.1});
    },
  };

  const recipe=recipes[petId]||recipes[PET_VARIANT_BASE[petId]]||recipes.puppy;
  try{recipe()}catch{}
}

// Action-specific sound effects (when feeding, playing, etc)
function playActionSound(action){
  if(!window.AudioContext&&!window.webkitAudioContext)return;
  let ctx;
  try{ctx=new (window.AudioContext||window.webkitAudioContext)()}catch{return}
  const recipes={
    feed:()=>{
      // Munch munch!
      [0,0.15,0.3].forEach(t=>{
        playNoise(ctx,{dur:0.08,volume:0.1,filterFreq:800,filterType:"lowpass",start:t});
        playNote(ctx,{freq:200,freqEnd:150,dur:0.1,type:"square",volume:0.05,filterFreq:500,start:t});
      });
    },
    clean:()=>{
      // Splashing water
      playNoise(ctx,{dur:0.4,volume:0.08,filterFreq:1500,filterType:"bandpass",filterQ:2});
      playNote(ctx,{freq:600,freqEnd:1200,dur:0.2,type:"sine",volume:0.06,vibrato:50,vibratoSpeed:15,start:0.1});
      playNote(ctx,{freq:1200,freqEnd:800,dur:0.15,type:"sine",volume:0.05,start:0.25});
    },
    play:()=>{
      // Happy bounce
      [0,0.1,0.2,0.3].forEach((t,i)=>{
        const freq=[800,1000,1200,1500][i];
        playNote(ctx,{freq,dur:0.08,type:"triangle",volume:0.1,filterFreq:3000,start:t,attack:0.01});
      });
    },
    sleep:()=>{
      // Sleepy yawn
      playNote(ctx,{freq:400,freqEnd:200,dur:0.6,type:"sine",volume:0.12,vibrato:10,vibratoSpeed:3,filterFreq:1000,filterQ:2,attack:0.1,decay:0.2});
    },
    study:()=>{
      // Cute "aha!" moment (ding)
      playNote(ctx,{freq:1200,dur:0.1,type:"sine",volume:0.1,filterFreq:3000,attack:0.005});
      playNote(ctx,{freq:1800,dur:0.15,type:"sine",volume:0.08,start:0.08});
      playNote(ctx,{freq:2400,dur:0.2,type:"sine",volume:0.06,start:0.16});
    },
    levelUp:()=>{
      // Triumphant fanfare
      [523,659,784,1047].forEach((f,i)=>{
        playNote(ctx,{freq:f,dur:0.15,type:"triangle",volume:0.1,filterFreq:3000,start:i*0.08,attack:0.005});
      });
    },
    heart:()=>{
      // Heart pop sound
      playNote(ctx,{freq:1200,freqEnd:1800,dur:0.1,type:"sine",volume:0.08,attack:0.003});
      playNote(ctx,{freq:1500,freqEnd:2200,dur:0.15,type:"triangle",volume:0.06,start:0.05});
    },
  };
  const recipe=recipes[action];
  if(recipe){try{recipe()}catch{}}
}

// Pet home environments
const PET_HOMES={
  bunny:{bg:"linear-gradient(180deg,#B8E6FF 0%,#E8F5E9 50%,#9CDFA8 100%)",ground:"🌱🌱🌱🌱🌱🌱🌱🌱",items:["🥕","🌷","🌼","🦋"],name:"綠草地"},
  chick:{bg:"linear-gradient(180deg,#FFF4D6 0%,#FFE699 50%,#D4A574 100%)",ground:"🟡🟡🟡🟡🟡🟡🟡🟡",items:["🌾","🥚","🏠","🌻"],name:"農場"},
  puppy:{bg:"linear-gradient(180deg,#B8E6FF 0%,#E8F5E9 50%,#9CDFA8 100%)",ground:"🌳🌱🌳🌱🌳🌱🌳🌱",items:["🦴","⚾","🎾","🐾"],name:"公園"},
  kitty:{bg:"linear-gradient(180deg,#FFD6E8 0%,#FFE8F0 50%,#F5C6E0 100%)",ground:"🏠🏠🏠🏠🏠🏠🏠🏠",items:["🧶","🐟","🥛","🪑"],name:"溫馨的家"},
  piggy:{bg:"linear-gradient(180deg,#FFE0B2 0%,#FFCC80 50%,#BCAAA4 100%)",ground:"🟫🟫🟫🟫🟫🟫🟫🟫",items:["🌽","🥕","🍎","🌾"],name:"泥巴農場"},
  froggy:{bg:"linear-gradient(180deg,#A8E6CF 0%,#7FD1AE 50%,#4A9B7F 100%)",ground:"💧💧💧💧💧💧💧💧",items:["🌿","🍃","🪷","🐛"],name:"池塘"},
  hamster:{bg:"linear-gradient(180deg,#FFF7D6 0%,#FCE7B2 50%,#D8B47A 100%)",ground:"🌾🌾🌾🌾🌾🌾🌾🌾",items:["🌻","🌰","🥜","⚙️"],name:"倉鼠小屋"},
  turtle:{bg:"linear-gradient(180deg,#C8F7DC 0%,#8ED8B3 50%,#4F9F78 100%)",ground:"🌿💧🌿💧🌿💧🌿💧",items:["🪷","🌿","🐚","💧"],name:"綠水池"},
  duckling:{bg:"linear-gradient(180deg,#B8E6FF 0%,#FFF4A8 50%,#8FD3B3 100%)",ground:"💧🌾💧🌾💧🌾💧🌾",items:["🌾","💧","🪷","🌼"],name:"小鴨湖"},
  lamb:{bg:"linear-gradient(180deg,#D8F8FF 0%,#E8F5E9 50%,#BEE6A8 100%)",ground:"🌱🌼🌱🌼🌱🌼🌱🌼",items:["🌼","☁️","🌿","🌷"],name:"柔軟草原"},
  panda:{bg:"linear-gradient(180deg,#E1F5E1 0%,#C8E6C9 50%,#A5D6A7 100%)",ground:"🎋🎋🎋🎋🎋🎋🎋🎋",items:["🎋","🍃","🌿","⛰️"],name:"竹林"},
  koala:{bg:"linear-gradient(180deg,#FFF3E0 0%,#FFE0B2 50%,#BCAAA4 100%)",ground:"🌳🌳🌳🌳🌳🌳🌳🌳",items:["🌿","🍃","☀️","🌳"],name:"尤加利樹林"},
  fox:{bg:"linear-gradient(180deg,#FFE0B2 0%,#FFCC80 50%,#D7CCC8 100%)",ground:"🍂🍂🍂🍂🍂🍂🍂🍂",items:["🍂","🍄","🌰","🦊"],name:"秋天森林"},
  owl:{bg:"linear-gradient(180deg,#1A237E 0%,#3949AB 50%,#5C6BC0 100%)",ground:"🌳🌲🌳🌲🌳🌲🌳🌲",items:["🌙","⭐","🦇","🪐"],name:"夜空"},
  penguin:{bg:"linear-gradient(180deg,#B3E5FC 0%,#81D4FA 50%,#E1F5FE 100%)",ground:"❄️❄️❄️❄️❄️❄️❄️❄️",items:["🧊","❄️","🐟","⛄"],name:"冰原"},
  deer:{bg:"linear-gradient(180deg,#DFF7E4 0%,#B8DFB4 50%,#7AA56D 100%)",ground:"🌲🌿🌲🌿🌲🌿🌲🌿",items:["🍃","🌿","🌰","🌳"],name:"寧靜森林"},
  seal:{bg:"linear-gradient(180deg,#D8F3FF 0%,#A8D8F0 50%,#E9F8FF 100%)",ground:"🧊❄️🧊❄️🧊❄️🧊❄️",items:["🐟","🧊","❄️","🌊"],name:"冰海岸"},
  parrot:{bg:"linear-gradient(180deg,#C8F7DC 0%,#8CD67E 50%,#3C8D57 100%)",ground:"🌴🌿🌴🌿🌴🌿🌴🌿",items:["🌺","🍌","🌴","🪶"],name:"熱帶樹屋"},
  squirrel:{bg:"linear-gradient(180deg,#FFE8C2 0%,#D8A15D 50%,#8B5E34 100%)",ground:"🍂🌰🍂🌰🍂🌰🍂🌰",items:["🌰","🍄","🍂","🌳"],name:"堅果森林"},
  unicorn:{bg:"linear-gradient(180deg,#FFD1DC 0%,#E1BEE7 50%,#B39DDB 100%)",ground:"🌈🌈🌈🌈🌈🌈🌈🌈",items:["⭐","✨","🌈","💫"],name:"彩虹國度"},
  dragon:{bg:"linear-gradient(180deg,#FF6F00 0%,#D84315 50%,#BF360C 100%)",ground:"🔥🔥🔥🔥🔥🔥🔥🔥",items:["🔥","⚔️","💎","🏔️"],name:"火山洞穴"},
  whale:{bg:"linear-gradient(180deg,#01579B 0%,#0288D1 50%,#4FC3F7 100%)",ground:"🌊🌊🌊🌊🌊🌊🌊🌊",items:["🐚","🐠","🪸","🌊"],name:"深藍海洋"},
  pegasus:{bg:"linear-gradient(180deg,#DFF3FF 0%,#E9D8FF 50%,#B6C7FF 100%)",ground:"☁️☁️☁️☁️☁️☁️☁️☁️",items:["☁️","✨","🌈","🪽"],name:"雲端牧場"},
  griffin:{bg:"linear-gradient(180deg,#2F3A56 0%,#6B5B45 50%,#B88A44 100%)",ground:"⛰️⛰️⛰️⛰️⛰️⛰️⛰️⛰️",items:["🪶","⚔️","💎","🌟"],name:"高山神殿"},
  seaotter:{bg:"linear-gradient(180deg,#006D8F 0%,#20A4B8 50%,#7BDDE2 100%)",ground:"🌊🪸🌊🪸🌊🪸🌊🪸",items:["🐚","🪸","🌊","🦪"],name:"海草森林"},
  phoenix:{bg:"linear-gradient(180deg,#FFD700 0%,#FF8F00 50%,#E65100 100%)",ground:"🔥🔥🔥🔥🔥🔥🔥🔥",items:["🔥","⚡","✨","☀️"],name:"火焰聖地"},
  celestial:{bg:"linear-gradient(180deg,#4A148C 0%,#7B1FA2 50%,#9C27B0 100%)",ground:"✨✨✨✨✨✨✨✨",items:["✨","💫","⭐","🌟"],name:"神聖空間"},
  moonlion:{bg:"linear-gradient(180deg,#111827 0%,#26345C 50%,#6B7280 100%)",ground:"🌙✨🌙✨🌙✨🌙✨",items:["🌙","✨","🪐","⭐"],name:"月光王座"},
  aurorafox:{bg:"linear-gradient(180deg,#0B1736 0%,#1F7A8C 45%,#A7F3D0 100%)",ground:"❄️✨❄️✨❄️✨❄️✨",items:["✨","🌌","❄️","💫"],name:"極光雪原"},
};

const PET_VARIANT_BASE={
  hamster:"bunny",turtle:"froggy",duckling:"chick",lamb:"bunny",
  deer:"fox",seal:"penguin",parrot:"chick",squirrel:"fox",
  pegasus:"unicorn",griffin:"phoenix",seaotter:"whale",
  moonlion:"celestial",aurorafox:"fox",
};

// Random happy sayings (shown as speech bubbles)
const PET_SAYINGS=["Hello!","Love you!","Play with me!","I'm hungry...","Thank you!","I'm happy!","Good friend!","English is fun!","Teach me more!","Cuddle time!"];

// ═══ PETS GUARD (登入/註冊守門) ══════════════════════════════════════
function PetsGuardInner(props){
  const{c,petAccount,setPetAccount,setPets,setEggs,setInventory,setCoins,pets,eggs,inventory,coins}=props;
  const[mode,setMode]=useState(petAccount?"in":"welcome");// welcome | login | signup | in
  const[username,setUsername]=useState("");
  const[pin,setPin]=useState("");
  const[pin2,setPin2]=useState("");
  const[err,setErr]=useState("");
  const[loading,setLoading]=useState(false);
  const[mergeChoice,setMergeChoice]=useState(null);// for login conflict

  // If already logged in, show pets page directly
  if(mode==="in"&&petAccount){return<PetsPage {...props}/>}

  const doLogin=async()=>{
    setErr("");setLoading(true);
    const r=await petCloudLogin(username,pin);
    setLoading(false);
    if(!r.ok){setErr(r.err);return}
    // Check if local has unsaved data that would be lost
    const cloudData=r.data;
    const hasLocalData=(pets.length>0||eggs.length>0||coins>0);
    const hasCloudData=(cloudData.pets?.length>0||cloudData.eggs?.length>0||cloudData.coins>0);
    const pinHash=await hashPin(pin);
    if(hasLocalData&&hasCloudData){
      // Conflict: ask user how to merge
      setMergeChoice({cloudData,pinHash});
      return;
    }
    // No conflict: load cloud data (or keep local if cloud empty)
    if(hasCloudData){
      setPets(cloudData.pets||[]);
      setEggs(cloudData.eggs||[]);
      setInventory(cloudData.inventory||{});
      setCoins(cloudData.coins||0);
    }
    // else: keep local data, will sync up
    setPetAccount({username:cloudData.username,pinHash,lastSync:new Date().toISOString()});
    playSound("done");
    setMode("in");
  };

  const resolveMerge=(choice)=>{
    if(!mergeChoice)return;
    const{cloudData,pinHash}=mergeChoice;
    if(choice==="cloud"){
      setPets(cloudData.pets||[]);
      setEggs(cloudData.eggs||[]);
      setInventory(cloudData.inventory||{});
      setCoins(cloudData.coins||0);
    }else if(choice==="local"){
      // Keep local, will push up via auto-sync
    }else if(choice==="merge"){
      // Merge pets by petId (keep higher level/exp), sum coins
      const byId={};
      [...(cloudData.pets||[]),...pets].forEach(p=>{
        const ex=byId[p.petId];
        if(!ex||(p.level||1)>ex.level||((p.level||1)===ex.level&&(p.exp||0)>(ex.exp||0))){
          byId[p.petId]=p;
        }
      });
      setPets(Object.values(byId));
      // Merge eggs (keep all unique)
      const eggsById={};
      [...(cloudData.eggs||[]),...eggs].forEach(e=>{eggsById[e.id]=e});
      setEggs(Object.values(eggsById));
      // Sum inventory
      const inv={...(cloudData.inventory||{})};
      Object.keys(inventory).forEach(k=>{inv[k]=(inv[k]||0)+(inventory[k]||0)});
      setInventory(inv);
      setCoins((cloudData.coins||0)+coins);
    }
    setPetAccount({username:mergeChoice.cloudData.username,pinHash,lastSync:new Date().toISOString()});
    setMergeChoice(null);
    playSound("done");
    setMode("in");
  };

  const doSignup=async()=>{
    setErr("");
    if(pin!==pin2){setErr("兩次 PIN 不一致");return}
    setLoading(true);
    // Upload existing local pets/eggs/inventory/coins to preserve them
    const r=await petCloudSignup(username,pin,{pets,eggs,inventory,coins});
    setLoading(false);
    if(!r.ok){setErr(r.err);return}
    const pinHash=await hashPin(pin);
    setPetAccount({username:r.data.username,pinHash,lastSync:new Date().toISOString()});
    playSound("done");
    setMode("in");
  };

  // Merge conflict dialog
  if(mergeChoice){
    const cloud=mergeChoice.cloudData;
    return(<div><Hdr t="⚠️ 資料衝突" onBack={()=>setMergeChoice(null)} cl={c.cl}/>
      <div style={{...S.card,padding:"20px"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:48}}>⚠️</div>
          <div style={{fontSize:16,fontWeight:700,color:S.t1,marginTop:8}}>本機和雲端都有寵物資料</div>
          <div style={{fontSize:13,color:S.t2,marginTop:4}}>請選擇要如何處理</div>
        </div>

        {/* Comparison table */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          <div style={{...S.card,padding:"12px",textAlign:"center",background:S.bg2}}>
            <div style={{fontSize:13,fontWeight:700,color:S.t1,marginBottom:6}}>📱 本機</div>
            <div style={{fontSize:11,color:S.t2,lineHeight:1.8}}>
              🐾 {pets.length} 隻寵物<br/>
              🥚 {eggs.length} 顆蛋<br/>
              🪙 {coins} 金幣
            </div>
          </div>
          <div style={{...S.card,padding:"12px",textAlign:"center",background:c.bg}}>
            <div style={{fontSize:13,fontWeight:700,color:S.t1,marginBottom:6}}>☁️ 雲端</div>
            <div style={{fontSize:11,color:S.t2,lineHeight:1.8}}>
              🐾 {(cloud.pets||[]).length} 隻寵物<br/>
              🥚 {(cloud.eggs||[]).length} 顆蛋<br/>
              🪙 {cloud.coins||0} 金幣
            </div>
          </div>
        </div>

        <button onClick={()=>resolveMerge("merge")} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:14,marginBottom:8}}>✨ 合併（推薦）<div style={{fontSize:11,opacity:.9,marginTop:2}}>保留所有寵物和蛋，金幣相加</div></button>
        <button onClick={()=>resolveMerge("cloud")} style={{...S.btn,background:S.bg2,color:S.t1,width:"100%",padding:"12px",fontSize:13,marginBottom:8}}>☁️ 只用雲端資料（本機會清空）</button>
        <button onClick={()=>resolveMerge("local")} style={{...S.btn,background:S.bg2,color:S.t1,width:"100%",padding:"12px",fontSize:13}}>📱 只用本機資料（雲端會覆蓋）</button>
      </div>
    </div>);
  }

  // Welcome screen
  if(mode==="welcome"){
    return(<div><Hdr t="🐾 寵物樂園" onBack={props.onBack} cl={c.cl}/>
      <div style={{...S.card,padding:"32px 24px",textAlign:"center",background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
        <div style={{fontSize:64,marginBottom:12,animation:"emojiBounce 1.5s ease-in-out infinite"}}>🐾</div>
        <div style={{fontSize:22,fontWeight:700,color:S.t1,marginBottom:8}}>歡迎來到寵物樂園！</div>
        <div style={{fontSize:14,color:S.t2,lineHeight:1.8,marginBottom:20}}>
          建立小帳號讓寵物跨裝置同步<br/>
          在手機、平板都能看到你的寵物！
        </div>
        <div style={{...S.card,padding:"14px",marginBottom:16,background:"#FFF3CD",border:"1px solid #EF9F27",textAlign:"left"}}>
          <div style={{fontSize:13,fontWeight:600,color:"#856404",marginBottom:6}}>💡 關於小帳號</div>
          <div style={{fontSize:12,color:"#856404",lineHeight:1.8}}>
            • 只要「暱稱」+「4-6 位 PIN」<br/>
            • <b>不需要 Email 也不用密碼</b><br/>
            • 只有寵物資料會上雲端<br/>
            • 其他功能（單字卡、遊戲）繼續免登入
          </div>
        </div>
        <button onClick={()=>{setMode("signup");setUsername("");setPin("");setPin2("");setErr("")}} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:15,marginBottom:8}}>✨ 建立新帳號</button>
        <button onClick={()=>{setMode("login");setUsername("");setPin("");setErr("")}} style={{...S.btn,background:S.bg2,color:S.t1,width:"100%",padding:"14px",fontSize:14}}>🔑 已有帳號？登入</button>
      </div>
    </div>);
  }

  // Signup form
  if(mode==="signup"){
    return(<div><Hdr t="✨ 建立新帳號" onBack={()=>setMode("welcome")} cl={c.cl}/>
      <div style={{...S.card,padding:"24px 20px"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:48}}>🐾</div>
          <div style={{fontSize:14,color:S.t2,marginTop:8}}>取個好記的暱稱吧！</div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>📛 暱稱（2-20 字）</label>
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="例如：小明、貓咪控" maxLength={20} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:16,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>🔢 設定 PIN（4-6 位數字）</label>
          <input value={pin} onChange={e=>setPin(e.target.value.replace(/\\D/g,"").slice(0,6))} placeholder="輸入 4-6 位數字" type="tel" inputMode="numeric" maxLength={6} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:20,fontFamily:"monospace",letterSpacing:4,textAlign:"center",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>🔢 再輸入一次 PIN</label>
          <input value={pin2} onChange={e=>setPin2(e.target.value.replace(/\\D/g,"").slice(0,6))} placeholder="再輸入一次確認" type="tel" inputMode="numeric" maxLength={6} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:20,fontFamily:"monospace",letterSpacing:4,textAlign:"center",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        {err&&<div style={{padding:"10px 14px",background:"#FCEBEB",border:"1px solid #E24B4A",borderRadius:10,color:"#A32D2D",fontSize:13,marginBottom:12,textAlign:"center",fontWeight:600}}>❌ {err}</div>}

        {/* Local data preview */}
        {(pets.length>0||eggs.length>0||coins>0)&&<div style={{padding:"10px 14px",background:"#E1F5EE",border:"1px solid #1D9E75",borderRadius:10,fontSize:12,color:"#0F6E56",marginBottom:12,lineHeight:1.7}}>
          ✅ 你目前的本機資料會一起上傳：🐾 {pets.length} 寵物 · 🥚 {eggs.length} 蛋 · 🪙 {coins} 金幣
        </div>}

        <button onClick={doSignup} disabled={loading||!username.trim()||!pin||!pin2} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:15,opacity:(loading||!username.trim()||!pin||!pin2)?.4:1}}>{loading?"建立中...":"✨ 建立帳號"}</button>

        <div style={{...S.card,padding:"12px",marginTop:16,fontSize:12,color:S.t2,lineHeight:1.7,background:"#FFF3CD",border:"1px solid #EF9F27"}}>
          ⚠️ <b>請記住你的暱稱和 PIN！</b><br/>
          忘記就無法找回寵物了（沒有 Email 備援）
        </div>
      </div>
    </div>);
  }

  // Login form
  if(mode==="login"){
    return(<div><Hdr t="🔑 登入帳號" onBack={()=>setMode("welcome")} cl={c.cl}/>
      <div style={{...S.card,padding:"24px 20px"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:48}}>🔑</div>
          <div style={{fontSize:14,color:S.t2,marginTop:8}}>輸入你的暱稱和 PIN</div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>📛 暱稱</label>
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="你之前建立的暱稱" maxLength={20} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:16,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>🔢 PIN</label>
          <input value={pin} onChange={e=>setPin(e.target.value.replace(/\\D/g,"").slice(0,6))} placeholder="4-6 位數字" type="tel" inputMode="numeric" maxLength={6} onKeyDown={e=>{if(e.key==="Enter")doLogin()}} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:20,fontFamily:"monospace",letterSpacing:4,textAlign:"center",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        {err&&<div style={{padding:"10px 14px",background:"#FCEBEB",border:"1px solid #E24B4A",borderRadius:10,color:"#A32D2D",fontSize:13,marginBottom:12,textAlign:"center",fontWeight:600}}>❌ {err}</div>}

        <button onClick={doLogin} disabled={loading||!username.trim()||!pin} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:15,opacity:(loading||!username.trim()||!pin)?.4:1}}>{loading?"登入中...":"🔑 登入"}</button>
      </div>
    </div>);
  }

  return null;
}


// ═══ PIXEL PET SYSTEM (像素風寵物 - Tamagotchi 風格) ═══════════════════
// Each pet has 4 growth stage sprites encoded as 16x14 character grids
// Characters map to colors (see PIXEL_COLORS). '.' means transparent.

const LazyPixelPet=lazy(()=>import("../components/PixelPet.jsx"));
function PixelPetFallback({size=180}){return <span style={{display:"inline-block",width:size,height:size,borderRadius:12,background:"linear-gradient(135deg,var(--color-background-secondary,#f3f2ee),var(--color-background-primary,#fff))"}}/>}
function PixelPet(props){return <Suspense fallback={<PixelPetFallback size={props.size}/>}> <LazyPixelPet {...props}/> </Suspense>}

function PetHomeScene({pet,petDef,ri,mood,c,onCleanPoop}){
  const home=PET_HOMES[petDef.id]||PET_HOMES[PET_VARIANT_BASE[petDef.id]]||PET_HOMES.puppy;
  const stage=getPetStage(pet);
  const petFontSize=getPetSize(stage);
  const stageSayings=STAGE_SAYINGS[stage]||PET_SAYINGS;
  const sleeping=isPetSleeping();
  const poops=pet.poops||[];
  const[bubble,setBubble]=useState(null);
  const[petPos,setPetPos]=useState({x:50,y:50,bouncing:false});
  const[floatingItems,setFloatingItems]=useState([]);

  // Auto-wander: pet moves slowly around
  useEffect(()=>{
    const t=setInterval(()=>{
      setPetPos(p=>({
        x:Math.max(25,Math.min(75,p.x+(Math.random()-.5)*20)),
        y:Math.max(40,Math.min(65,p.y+(Math.random()-.5)*8)),
        bouncing:false,
      }));
    },3500);
    return()=>clearInterval(t);
  },[]);

  // Random sayings every 8-15 seconds (mix time greetings with stage sayings)
  useEffect(()=>{
    const showBubble=()=>{
      const useTime=Math.random()<0.4;// 40% chance of time-based greeting
      const timeKey=getTimeOfDay();
      const timeSayings=TIME_GREETINGS[timeKey]||TIME_GREETINGS.afternoon;
      const pool=useTime?timeSayings:stageSayings;
      const say=pool[Math.floor(Math.random()*pool.length)];
      setBubble(say);
      setTimeout(()=>setBubble(null),3000);
    };
    // Show greeting right away on mount
    const initial=setTimeout(showBubble,500);
    const t=setInterval(showBubble,8000+Math.random()*7000);
    return()=>{clearTimeout(initial);clearInterval(t)};
  },[]);

  // Floating ambient items
  useEffect(()=>{
    const spawn=()=>{
      const item=home.items[Math.floor(Math.random()*home.items.length)];
      const id=Date.now()+Math.random();
      setFloatingItems(f=>[...f,{id,emoji:item,x:Math.random()*90+5,startY:100,duration:6+Math.random()*4}]);
      setTimeout(()=>setFloatingItems(f=>f.filter(x=>x.id!==id)),10000);
    };
    spawn();
    const t=setInterval(spawn,3000);
    return()=>clearInterval(t);
  },[]);

  // Interaction: tap pet
  const tapCountRef=useRef(0);
  const tapResetRef=useRef(null);

  const tapPet=()=>{
    // Track rapid tapping for combo effect
    tapCountRef.current++;
    clearTimeout(tapResetRef.current);
    tapResetRef.current=setTimeout(()=>{tapCountRef.current=0},1500);
    const comboCount=tapCountRef.current;

    // Don't disturb sleeping pet (just a sleepy grumble)
    if(sleeping){
      const id=Date.now();
      setFloatingItems(f=>[...f,{id,emoji:"💤",x:petPos.x,startY:petPos.y,duration:2,isHeart:true}]);
      setTimeout(()=>setFloatingItems(f=>f.filter(x=>x.id!==id)),2000);
      setBubble("Zzz... don't wake me...");
      setTimeout(()=>setBubble(null),2000);
      return;
    }

    playPetSound(petDef.id);
    // Pet bounces
    setPetPos(p=>({...p,bouncing:true}));
    setTimeout(()=>setPetPos(p=>({...p,bouncing:false})),600);

    // Show random saying (or combo reaction for rapid taps)
    let say;
    if(comboCount>=5){
      say=["So much love!","Hehe, stop it!","You're the best!","Tickle tickle!"][Math.floor(Math.random()*4)];
    }else if(comboCount>=3){
      say=["Haha!","More please!","That tickles!","You like me?"][Math.floor(Math.random()*4)];
    }else{
      say=stageSayings[Math.floor(Math.random()*stageSayings.length)];
    }
    setBubble(say);
    setTimeout(()=>setBubble(null),2500);
    // Speak English greeting
    speak(say);

    // Multi-particle emission - more cute!
    const particles=comboCount>=5?["💖","✨","💕","⭐","🌟"]:comboCount>=3?["💖","💕","✨"]:["💖"];
    const count=Math.min(3+comboCount,8);
    for(let i=0;i<count;i++){
      const id=Date.now()+Math.random();
      const emoji=particles[Math.floor(Math.random()*particles.length)];
      const offsetX=(Math.random()-0.5)*30;
      setFloatingItems(f=>[...f,{id,emoji,x:petPos.x+offsetX,startY:petPos.y,duration:2+Math.random(),isHeart:true}]);
      setTimeout(()=>setFloatingItems(f=>f.filter(x=>x.id!==id)),2500);
    }

    // Action heart sound for feedback
    if(comboCount>=3)playActionSound("heart");
  };

  // Cleanup tap timer
  useEffect(()=>()=>clearTimeout(tapResetRef.current),[]);

  const urgentNeed=pet.hunger<30?{icon:"🍖",text:"好餓..."}:pet.clean<30?{icon:"💦",text:"好髒..."}:pet.energy<30?{icon:"😴",text:"好累..."}:null;

  return(<div style={{position:"relative",width:"100%",height:380,borderRadius:20,overflow:"hidden",marginBottom:12,background:home.bg,boxShadow:"0 6px 20px rgba(0,0,0,.15)",border:`3px solid ${ri.color}`}}>
    <style>{`
      @keyframes petBreathe{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.05)}}
      @keyframes petBounce{0%{transform:translate(-50%,-50%) scale(1)}25%{transform:translate(-50%,-90%) scale(1.15)}50%{transform:translate(-50%,-50%) scale(0.95)}75%{transform:translate(-50%,-70%) scale(1.1)}100%{transform:translate(-50%,-50%) scale(1)}}
      @keyframes petShake{0%,100%{transform:translate(-50%,-50%) rotate(0)}25%{transform:translate(-52%,-50%) rotate(-5deg)}75%{transform:translate(-48%,-50%) rotate(5deg)}}
      @keyframes petSleep{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-48%) scale(1.02)}}
      @keyframes zzzFloat{0%{transform:translate(-50%,-50%) translateY(0);opacity:1}50%{opacity:.6}100%{transform:translate(-50%,-50%) translateY(-30px);opacity:0}}
      @keyframes poopWiggle{0%,100%{transform:translateX(-50%) rotate(-3deg)}50%{transform:translateX(-50%) rotate(3deg)}}
      @keyframes floatUp{0%{transform:translateY(0) rotate(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-350px) rotate(360deg);opacity:0}}
      @keyframes heartFloat{0%{transform:translate(-50%,-50%) scale(0);opacity:1}50%{transform:translate(-50%,-120%) scale(1.5);opacity:1}100%{transform:translate(-50%,-200%) scale(0.5);opacity:0}}
      @keyframes bubbleIn{0%{transform:scale(0) translateY(10px);opacity:0}60%{transform:scale(1.1) translateY(0);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}
      @keyframes cloudDrift{0%{transform:translateX(-20px)}100%{transform:translateX(calc(100vw + 20px))}}
      @keyframes cloudDriftBack{0%{transform:translateX(calc(100vw + 20px))}100%{transform:translateX(-100px)}}
      @keyframes rarityGlow{0%,100%{box-shadow:0 0 12px ${ri.color}55,inset 0 0 20px ${ri.color}22}50%{box-shadow:0 0 24px ${ri.color}88,inset 0 0 30px ${ri.color}44}}
      @keyframes starTwinkle{0%,100%{opacity:0.3;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
      @keyframes moonGlow{0%,100%{filter:drop-shadow(0 0 6px rgba(255,255,224,0.5))}50%{filter:drop-shadow(0 0 14px rgba(255,255,224,0.9))}}
    `}</style>

    {/* (P2-1) 時段光線濾鏡 - 晝夜變化 */}
    {(()=>{
      const t=getTimeOfDay();
      if(t==="morning")return<div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(255,200,150,0.18),transparent 40%)",pointerEvents:"none",zIndex:1}}/>;
      if(t==="evening")return<div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(255,140,60,0.22),rgba(180,80,40,0.12) 60%)",pointerEvents:"none",zIndex:1}}/>;
      if(t==="night"||t==="sleeping")return<div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(20,30,90,0.45),rgba(10,20,60,0.3))",pointerEvents:"none",zIndex:1}}/>;
      return null;
    })()}

    {/* Rarity glow overlay for SR/SSR */}
    {(pet.rarity==="SR"||pet.rarity==="SSR")&&<div style={{position:"absolute",inset:0,borderRadius:17,animation:"rarityGlow 2.5s ease-in-out infinite",pointerEvents:"none",zIndex:1}}/>}

    {/* (P2-1) Sky decorations - 多層視差雲朵 + 晝夜元素 */}
    {(()=>{
      const t=getTimeOfDay();
      if(t==="night"||t==="sleeping"){
        // 夜晚：月亮 + 星星閃爍
        return(<>
          <div style={{position:"absolute",top:14,right:30,fontSize:32,zIndex:2,animation:"moonGlow 4s ease-in-out infinite"}}>🌙</div>
          <div style={{position:"absolute",top:24,left:"22%",fontSize:10,zIndex:2,animation:"starTwinkle 2s ease-in-out infinite"}}>⭐</div>
          <div style={{position:"absolute",top:42,left:"38%",fontSize:8,zIndex:2,animation:"starTwinkle 3s 0.5s ease-in-out infinite"}}>⭐</div>
          <div style={{position:"absolute",top:18,left:"58%",fontSize:9,zIndex:2,animation:"starTwinkle 2.5s 1s ease-in-out infinite"}}>✨</div>
          <div style={{position:"absolute",top:54,left:"15%",fontSize:7,zIndex:2,animation:"starTwinkle 2.8s 1.5s ease-in-out infinite"}}>⭐</div>
          <div style={{position:"absolute",top:66,left:"72%",fontSize:9,zIndex:2,animation:"starTwinkle 2.2s 0.8s ease-in-out infinite"}}>✨</div>
          <div style={{position:"absolute",top:32,left:"85%",fontSize:7,zIndex:2,animation:"starTwinkle 3.2s 0.3s ease-in-out infinite"}}>⭐</div>
        </>);
      }
      if(t==="morning"){
        return(<>
          <div style={{position:"absolute",top:8,right:20,fontSize:28,zIndex:2,opacity:0.85,filter:"drop-shadow(0 0 8px rgba(255,200,100,0.6))"}}>☀️</div>
          {/* 遠景雲（小、淡、慢） */}
          <div style={{position:"absolute",top:24,left:0,fontSize:14,opacity:.3,zIndex:2,animation:"cloudDrift 80s linear infinite"}}>☁️</div>
          <div style={{position:"absolute",top:38,left:0,fontSize:12,opacity:.25,zIndex:2,animation:"cloudDriftBack 100s linear infinite",animationDelay:"-50s"}}>☁️</div>
          {/* 中景雲（中、中速） */}
          <div style={{position:"absolute",top:14,left:0,fontSize:22,opacity:.5,zIndex:3,animation:"cloudDrift 50s linear infinite",animationDelay:"-15s"}}>☁️</div>
          {/* 近景雲（大、快） */}
          <div style={{position:"absolute",top:48,left:0,fontSize:28,opacity:.6,zIndex:4,animation:"cloudDrift 30s linear infinite",animationDelay:"-8s"}}>☁️</div>
        </>);
      }
      // 預設（中午、下午、傍晚）：三層視差雲朵
      return(<>
        <div style={{position:"absolute",top:24,left:0,fontSize:14,opacity:.3,zIndex:2,animation:"cloudDrift 80s linear infinite"}}>☁️</div>
        <div style={{position:"absolute",top:38,left:0,fontSize:12,opacity:.25,zIndex:2,animation:"cloudDriftBack 100s linear infinite",animationDelay:"-50s"}}>☁️</div>
        <div style={{position:"absolute",top:14,left:0,fontSize:22,opacity:.5,zIndex:3,animation:"cloudDrift 50s linear infinite",animationDelay:"-15s"}}>☁️</div>
        <div style={{position:"absolute",top:48,left:0,fontSize:28,opacity:.6,zIndex:4,animation:"cloudDrift 30s linear infinite",animationDelay:"-8s"}}>☁️</div>
      </>);
    })()}

    {/* Rarity badge top-left */}
    <div style={{position:"absolute",top:10,left:10,background:"rgba(255,255,255,.85)",backdropFilter:"blur(4px)",borderRadius:14,padding:"4px 10px",zIndex:10}}>
      <span style={{fontSize:11,fontWeight:700,color:ri.color}}>{ri.stars} {ri.label}</span>
      <span style={{fontSize:10,color:S.t3,marginLeft:6}}>· {STAGE_NAMES[stage]}</span>
    </div>

    {/* Mood indicator top-right */}
    <div style={{position:"absolute",top:10,right:10,background:"rgba(255,255,255,.85)",backdropFilter:"blur(4px)",borderRadius:14,padding:"4px 10px",zIndex:10}}>
      <span style={{fontSize:13}}>{sleeping?"💤":mood.emoji} </span><span style={{fontSize:11,fontWeight:600,color:sleeping?"#7EB5F0":mood.color}}>{sleeping?"睡覺中":mood.text}</span>
    </div>

    {/* Poop counter (only when poops exist) */}
    {poops.length>0&&<div style={{position:"absolute",top:46,right:10,background:"rgba(139,69,19,.9)",color:"#fff",borderRadius:14,padding:"4px 10px",zIndex:10,fontSize:11,fontWeight:600,animation:"emojiPulse 1.2s infinite"}}>
      💩 {poops.length} 個要清
    </div>}

    {/* Urgent need alert (below poop if both exist) */}
    {urgentNeed&&<div style={{position:"absolute",top:poops.length>0?82:46,right:10,background:"rgba(226,75,74,.9)",color:"#fff",borderRadius:14,padding:"4px 10px",zIndex:10,fontSize:11,fontWeight:600,animation:"emojiPulse 1s infinite"}}>
      {urgentNeed.icon} {urgentNeed.text}
    </div>}

    {/* Floating ambient items */}
    {floatingItems.map(item=>(<div key={item.id} style={{position:"absolute",left:`${item.x}%`,bottom:"-20px",fontSize:item.isHeart?28:20,animation:item.isHeart?"heartFloat 2.5s ease-out forwards":`floatUp ${item.duration}s linear forwards`,zIndex:3,pointerEvents:"none"}}>{item.emoji}</div>))}

    {/* Pet speech bubble */}
    {bubble&&<div style={{position:"absolute",left:`${petPos.x}%`,top:`${petPos.y-18}%`,transform:"translate(-50%,-100%)",background:"#fff",border:`2px solid ${ri.color}`,borderRadius:16,padding:"8px 14px",fontSize:13,fontWeight:700,color:S.t1,zIndex:8,animation:"bubbleIn .35s ease-out",whiteSpace:"nowrap",boxShadow:"0 3px 10px rgba(0,0,0,.15)"}}>
      {bubble}
      <div style={{position:"absolute",bottom:-8,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"8px solid transparent",borderRight:"8px solid transparent",borderTop:`8px solid ${ri.color}`}}/>
      <div style={{position:"absolute",bottom:-5,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:"6px solid #fff"}}/>
    </div>}

    {/* THE PET! Big and interactive - SVG illustration */}
    <button onClick={tapPet} style={{
      position:"absolute",
      left:`${petPos.x}%`,top:`${petPos.y}%`,
      transform:"translate(-50%,-50%)",
      background:"none",border:"none",cursor:"pointer",
      WebkitTapHighlightColor:"transparent",padding:0,
      animation:petPos.bouncing?"petBounce .6s ease-out":sleeping?"petSleep 3s ease-in-out infinite":urgentNeed?"petShake 1.2s ease-in-out infinite":"petBreathe 2.5s ease-in-out infinite",
      transition:"left 2s ease-in-out, top 2s ease-in-out",
      filter:urgentNeed?"grayscale(.3)":sleeping?"brightness(.7)":"none",
      zIndex:5,
      lineHeight:1,
      userSelect:"none",
    }}>
      <PixelPet petId={petDef.id} stage={stage} size={petFontSize*1.6} animate={!sleeping}/>
    </button>

    {/* Sleep ZZZ indicator */}
    {sleeping&&<div style={{position:"absolute",left:`${petPos.x+10}%`,top:`${petPos.y-15}%`,transform:"translate(-50%,-50%)",fontSize:32,animation:"zzzFloat 2s ease-in-out infinite",zIndex:6,pointerEvents:"none",color:"#7EB5F0",fontWeight:700,fontFamily:"monospace"}}>💤</div>}

    {/* Poops on the ground - clickable to clean */}
    {poops.map(poop=>(<button key={poop.id} onClick={(e)=>{e.stopPropagation();if(onCleanPoop)onCleanPoop(poop.id)}} style={{position:"absolute",left:`${poop.x}%`,bottom:42,transform:"translateX(-50%)",fontSize:28,background:"none",border:"none",cursor:"pointer",zIndex:4,WebkitTapHighlightColor:"transparent",padding:0,animation:"poopWiggle 2s ease-in-out infinite",lineHeight:1}} title="點我清理！">💩</button>))}

    {/* Night overlay */}
    {sleeping&&<div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 50% 30%, rgba(30,30,60,.2), rgba(20,20,40,.5))",pointerEvents:"none",zIndex:3}}/>}

    {/* Ground line with items */}
    <div style={{position:"absolute",bottom:0,left:0,right:0,height:40,background:`linear-gradient(180deg,transparent,rgba(0,0,0,.15))`,display:"flex",alignItems:"flex-end",justifyContent:"space-around",padding:"0 10px",fontSize:20,opacity:.65,letterSpacing:2,zIndex:2}}>
      {home.ground}
    </div>

    {/* Tap hint */}
    <div style={{position:"absolute",bottom:6,left:"50%",transform:"translateX(-50%)",background:"rgba(255,255,255,.85)",backdropFilter:"blur(4px)",borderRadius:12,padding:"4px 12px",fontSize:11,color:S.t2,fontWeight:600,zIndex:10}}>
      👆 點我互動！· {home.name}
    </div>

    {/* Pet name overlay */}
    <div style={{position:"absolute",bottom:30,right:10,background:"rgba(255,255,255,.9)",backdropFilter:"blur(4px)",borderRadius:14,padding:"6px 12px",zIndex:10}}>
      <div style={{fontSize:14,fontWeight:700,color:S.t1}}>{petDef.name}</div>
    </div>
  </div>);
}

// ═══ ACTION CELEBRATION (互動動作粒子動畫 - P0-2 視覺優化) ═════════
// 在寵物詳情頁的 PetHomeScene 上方覆蓋一層粒子動畫
// 餵食/洗澡/玩耍/睡覺/讀書 各有獨特粒子效果 + 數值跳動
function ActionCelebration({data}){
  const{actionKey,statText,statColor,foodEmoji,bonusText}=data;
  // 為了給 inline style 用 CSS variable，每個粒子放在獨立 div 裡
  const styleSheet=`
@keyframes ac_dropIn { 0%{transform:translate(-50%,-200px) rotate(0deg);opacity:0} 30%{opacity:1} 80%{transform:translate(-50%,40px) rotate(360deg);opacity:1} 100%{transform:translate(-50%,40px) rotate(360deg);opacity:0} }
@keyframes ac_bubbleUp { 0%{transform:translate(0,0) scale(0.4);opacity:0} 30%{opacity:1} 100%{transform:translate(var(--dx,20px),-120px) scale(1);opacity:0} }
@keyframes ac_heartBurst { 0%{transform:translate(-50%,0) scale(0.3);opacity:0} 30%{opacity:1} 100%{transform:translate(calc(-50% + var(--dx,40px)),var(--dy,-60px)) scale(1.2) rotate(var(--rot,20deg));opacity:0} }
@keyframes ac_zRise { 0%{transform:translate(-50%,0) scale(0.5);opacity:0} 30%{opacity:1} 100%{transform:translate(-50%,-100px) scale(1.6);opacity:0} }
@keyframes ac_starOrbit { 0%{transform:translate(0,0) scale(0.5);opacity:0} 25%{opacity:1} 100%{transform:translate(var(--dx,30px),var(--dy,-50px)) scale(1.1) rotate(var(--rot,180deg));opacity:0} }
@keyframes ac_statPop { 0%{transform:translate(-50%,0) scale(0.5);opacity:0} 20%{transform:translate(-50%,-15px) scale(1.3);opacity:1} 60%{transform:translate(-50%,-35px) scale(1);opacity:1} 100%{transform:translate(-50%,-65px) scale(0.9);opacity:0} }
@keyframes ac_flash { 0%,100%{opacity:0} 40%{opacity:0.35} 60%{opacity:0.35} }
@media (prefers-reduced-motion: reduce) { [data-action-celebration] *{animation-duration:0.1s !important;animation-iteration-count:1 !important} }
`;

  const renderParticles=()=>{
    if(actionKey==="feed"){
      return(<>
        <div style={{position:"absolute",top:0,left:"50%",fontSize:36,animation:"ac_dropIn 1.2s ease-in forwards",pointerEvents:"none"}}>{foodEmoji||"🍖"}</div>
      </>);
    }
    if(actionKey==="clean"){
      const bubbles=[
        {l:"30%",dx:"-15px",delay:"0s",size:24},
        {l:"45%",dx:"5px",delay:"0.15s",size:28},
        {l:"60%",dx:"15px",delay:"0.3s",size:22},
        {l:"40%",dx:"-5px",delay:"0.45s",size:18},
        {l:"55%",dx:"10px",delay:"0.6s",size:20},
        {l:"50%",dx:"0px",delay:"0.75s",size:16},
      ];
      return(<>
        <div style={{position:"absolute",inset:0,background:"#4A90E2",animation:"ac_flash 1.2s ease-in-out forwards",pointerEvents:"none"}}/>
        {bubbles.map((b,i)=>(<div key={i} style={{position:"absolute",bottom:"35%",left:b.l,fontSize:b.size,"--dx":b.dx,animation:`ac_bubbleUp 1.4s ${b.delay} ease-out forwards`,pointerEvents:"none"}}>💧</div>))}
      </>);
    }
    if(actionKey==="play"){
      const hearts=[
        {dx:"-50px",dy:"-40px",rot:"-30deg",delay:"0s",emo:"❤️",size:28},
        {dx:"50px",dy:"-40px",rot:"30deg",delay:"0.1s",emo:"❤️",size:28},
        {dx:"-30px",dy:"-70px",rot:"-15deg",delay:"0.25s",emo:"💕",size:22},
        {dx:"30px",dy:"-70px",rot:"15deg",delay:"0.4s",emo:"💕",size:22},
        {dx:"0px",dy:"-90px",rot:"0deg",delay:"0.55s",emo:"💖",size:24},
      ];
      return(<>
        {hearts.map((h,i)=>(<div key={i} style={{position:"absolute",bottom:"45%",left:"50%",fontSize:h.size,"--dx":h.dx,"--dy":h.dy,"--rot":h.rot,animation:`ac_heartBurst 1.4s ${h.delay} ease-out forwards`,pointerEvents:"none"}}>{h.emo}</div>))}
      </>);
    }
    if(actionKey==="sleep"){
      return(<>
        <div style={{position:"absolute",inset:0,background:"#7B61FF",animation:"ac_flash 1.2s ease-in-out forwards",opacity:0.2,pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:"50%",left:"50%",fontSize:36,fontWeight:700,color:"#fff",textShadow:"0 0 6px rgba(0,0,0,.4)",animation:"ac_zRise 1.6s 0s ease-out forwards",pointerEvents:"none"}}>Z</div>
        <div style={{position:"absolute",bottom:"50%",left:"50%",fontSize:28,fontWeight:700,color:"#fff",textShadow:"0 0 6px rgba(0,0,0,.4)",animation:"ac_zRise 1.6s 0.4s ease-out forwards",pointerEvents:"none"}}>z</div>
        <div style={{position:"absolute",bottom:"50%",left:"50%",fontSize:20,fontWeight:700,color:"#fff",textShadow:"0 0 6px rgba(0,0,0,.4)",animation:"ac_zRise 1.6s 0.8s ease-out forwards",pointerEvents:"none"}}>z</div>
      </>);
    }
    if(actionKey==="study"){
      const items=[
        {dx:"-60px",dy:"-30px",rot:"-180deg",delay:"0s",emo:"✨",size:26},
        {dx:"60px",dy:"-30px",rot:"180deg",delay:"0.15s",emo:"📚",size:26},
        {dx:"-40px",dy:"-70px",rot:"-90deg",delay:"0.3s",emo:"⭐",size:20},
        {dx:"40px",dy:"-70px",rot:"90deg",delay:"0.45s",emo:"📖",size:20},
        {dx:"0px",dy:"-90px",rot:"0deg",delay:"0.6s",emo:"✨",size:22},
      ];
      return(<>
        {items.map((it,i)=>(<div key={i} style={{position:"absolute",bottom:"45%",left:"50%",fontSize:it.size,"--dx":it.dx,"--dy":it.dy,"--rot":it.rot,animation:`ac_starOrbit 1.4s ${it.delay} ease-out forwards`,pointerEvents:"none"}}>{it.emo}</div>))}
      </>);
    }
    return null;
  };

  return(<div data-action-celebration style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:50,overflow:"hidden",borderRadius:"inherit"}}>
    <style>{styleSheet}</style>
    {renderParticles()}
    {statText&&<div style={{position:"absolute",top:"38%",left:"50%",fontSize:16,fontWeight:700,color:"#fff",background:statColor,padding:"6px 14px",borderRadius:14,boxShadow:"0 3px 10px rgba(0,0,0,.25)",animation:"ac_statPop 1.4s ease-out forwards",whiteSpace:"nowrap"}}>{statText}</div>}
    {bonusText&&<div style={{position:"absolute",top:"52%",left:"50%",transform:"translateX(-50%)",fontSize:12,fontWeight:900,color:"#856404",background:"#FFF3CD",border:"1px solid #EF9F27",padding:"7px 12px",borderRadius:12,boxShadow:"0 3px 10px rgba(0,0,0,.18)",animation:"ac_statPop 1.4s .08s ease-out forwards",whiteSpace:"nowrap"}}>{bonusText}</div>}
  </div>);
}

// ═══ LEVEL UP CELEBRATION (升級慶祝畫面 - P1-3 視覺優化) ════════════
// 全螢幕煙火 overlay：寵物放大、金光放射、LEVEL UP 大字落下、金幣彈出
// 進化階段（Lv 3 → Lv 4 = 成體; Lv 9 → Lv 10 = 完全體）會更盛大
function LevelUpCelebration({pet,petDef,fromLevel,toLevel,onClose}){
  const isEvolution=(fromLevel<4&&toLevel>=4)||(fromLevel<10&&toLevel>=10);
  // 自動 4 秒後關閉
  useEffect(()=>{
    const t=setTimeout(()=>onClose&&onClose(),isEvolution?5000:3500);
    return()=>clearTimeout(t);
  },[]);// eslint-disable-line

  const styleSheet=`
@keyframes lu_overlayIn { 0%{opacity:0} 100%{opacity:1} }
@keyframes lu_radial { 0%{transform:translate(-50%,-50%) scale(0) rotate(0deg);opacity:0} 30%{opacity:1} 100%{transform:translate(-50%,-50%) scale(2.2) rotate(180deg);opacity:0} }
@keyframes lu_petRise { 0%{transform:translate(-50%,-50%) scale(0.3);opacity:0} 30%{transform:translate(-50%,-50%) scale(1.3);opacity:1} 60%{transform:translate(-50%,-50%) scale(1.8);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.6);opacity:1} }
@keyframes lu_titleDrop { 0%{transform:translate(-50%,-100px) scale(0.5);opacity:0} 50%{transform:translate(-50%,0) scale(1.2);opacity:1} 70%{transform:translate(-50%,0) scale(0.95);opacity:1} 100%{transform:translate(-50%,0) scale(1);opacity:1} }
@keyframes lu_subText { 0%{transform:translate(-50%,15px);opacity:0} 100%{transform:translate(-50%,0);opacity:1} }
@keyframes lu_coinPop { 0%{transform:translate(0,0) scale(0);opacity:0} 30%{opacity:1} 100%{transform:translate(var(--cx),var(--cy)) scale(1) rotate(720deg);opacity:0} }
@keyframes lu_firework { 0%{transform:translate(0,0) scale(0);opacity:0} 30%{opacity:1} 100%{transform:translate(var(--fx),var(--fy)) scale(0.8);opacity:0} }
@keyframes lu_evolutionGlow { 0%{filter:brightness(1)} 50%{filter:brightness(1.8) saturate(1.5)} 100%{filter:brightness(1)} }
@media (prefers-reduced-motion: reduce) { [data-levelup] *{animation-duration:0.5s !important} }
`;

  // 散開的金幣
  const coins=Array.from({length:isEvolution?12:8},(_,i)=>{
    const angle=(i*360/(isEvolution?12:8))+(Math.random()*30-15);
    const dist=120+Math.random()*60;
    return{
      cx:`${Math.cos(angle*Math.PI/180)*dist}px`,
      cy:`${Math.sin(angle*Math.PI/180)*dist}px`,
      delay:0.4+i*0.05,
      size:isEvolution?28:24,
    };
  });

  // 煙火粒子
  const fireworks=Array.from({length:isEvolution?20:12},(_,i)=>{
    const angle=Math.random()*360;
    const dist=80+Math.random()*180;
    const colors=isEvolution?["#FFD700","#FF69B4","#FFA500","#FFEC8B","#FF1493"]:["#FFD700","#FFA500","#FFEC8B"];
    return{
      fx:`${Math.cos(angle*Math.PI/180)*dist}px`,
      fy:`${Math.sin(angle*Math.PI/180)*dist}px`,
      delay:0.6+Math.random()*0.6,
      color:colors[i%colors.length],
      size:5+Math.random()*4,
    };
  });

  return(<div data-levelup onClick={onClose} style={{
    position:"fixed",inset:0,
    background:isEvolution?"radial-gradient(circle,rgba(255,215,0,0.4),rgba(20,10,0,0.85))":"radial-gradient(circle,rgba(255,215,0,0.3),rgba(0,0,0,0.75))",
    zIndex:9999,
    cursor:"pointer",
    animation:"lu_overlayIn 0.3s ease-out forwards",
    overflow:"hidden",
    backdropFilter:"blur(2px)",
    WebkitBackdropFilter:"blur(2px)",
  }}>
    <style>{styleSheet}</style>

    {/* 放射光線（背景） */}
    <div style={{
      position:"absolute",top:"50%",left:"50%",
      width:600,height:600,
      background:`conic-gradient(from 0deg,transparent 0deg,${isEvolution?"#FFD700":"#FFA500"}99 30deg,transparent 60deg,transparent 90deg,${isEvolution?"#FFD700":"#FFA500"}99 120deg,transparent 150deg,transparent 180deg,${isEvolution?"#FFD700":"#FFA500"}99 210deg,transparent 240deg,transparent 270deg,${isEvolution?"#FFD700":"#FFA500"}99 300deg,transparent 330deg,transparent)`,
      animation:"lu_radial 2s ease-out forwards",
      mixBlendMode:"screen",
      opacity:0.7,
    }}/>

    {/* 寵物本體（放大居中） */}
    <div style={{
      position:"absolute",top:"50%",left:"50%",
      transform:"translate(-50%,-50%)",
      animation:`lu_petRise 1s 0.2s ease-out forwards${isEvolution?", lu_evolutionGlow 1.5s 1s ease-in-out infinite":""}`,
      opacity:0,
      zIndex:5,
    }}>
      <PixelPet petId={petDef.id} stage={getPetStage(pet)} size={120} animate={false}/>
    </div>

    {/* LEVEL UP 大字 */}
    <div style={{
      position:"absolute",top:"22%",left:"50%",
      animation:"lu_titleDrop 0.8s 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
      opacity:0,
      fontSize:isEvolution?44:36,fontWeight:900,
      color:"#FFD700",
      textShadow:"0 0 16px rgba(255,215,0,0.9), 3px 3px 0 #FF6B00, 6px 6px 12px rgba(0,0,0,0.5)",
      letterSpacing:isEvolution?4:2,
      whiteSpace:"nowrap",
      zIndex:10,
    }}>
      {isEvolution?"✨ 進化！ ✨":"LEVEL UP！"}
    </div>

    {/* 副文字：等級資訊 */}
    <div style={{
      position:"absolute",top:"34%",left:"50%",
      animation:"lu_subText 0.6s 1.1s ease-out forwards",
      opacity:0,
      fontSize:18,fontWeight:700,
      color:"#fff",
      textShadow:"0 2px 8px rgba(0,0,0,0.6)",
      whiteSpace:"nowrap",
      zIndex:10,
    }}>
      Lv.{fromLevel} → Lv.{toLevel}
    </div>

    {/* 寵物名稱 */}
    <div style={{
      position:"absolute",top:"72%",left:"50%",
      animation:"lu_subText 0.6s 1.3s ease-out forwards",
      opacity:0,
      fontSize:16,fontWeight:600,
      color:"#fff",
      textShadow:"0 2px 6px rgba(0,0,0,0.6)",
      whiteSpace:"nowrap",
      zIndex:10,
    }}>
      {petDef.name} 升級了！
    </div>

    {/* 點任意處關閉提示 */}
    <div style={{
      position:"absolute",bottom:32,left:"50%",
      animation:"lu_subText 0.6s 2s ease-out forwards",
      opacity:0,
      fontSize:11,
      color:"rgba(255,255,255,0.7)",
      whiteSpace:"nowrap",
      zIndex:10,
    }}>
      點任意處關閉
    </div>

    {/* 金幣彈出 */}
    {coins.map((coin,i)=>(<div key={`c${i}`} style={{
      position:"absolute",top:"50%",left:"50%",
      fontSize:coin.size,
      "--cx":coin.cx,"--cy":coin.cy,
      animation:`lu_coinPop 1.5s ${coin.delay}s ease-out forwards`,
      opacity:0,
      zIndex:8,
    }}>🪙</div>))}

    {/* 煙火粒子 */}
    {fireworks.map((fw,i)=>(<div key={`f${i}`} style={{
      position:"absolute",top:"50%",left:"50%",
      width:fw.size,height:fw.size,
      borderRadius:"50%",
      background:fw.color,
      boxShadow:`0 0 ${fw.size*2}px ${fw.color}`,
      "--fx":fw.fx,"--fy":fw.fy,
      animation:`lu_firework 1.8s ${fw.delay}s ease-out forwards`,
      opacity:0,
      zIndex:7,
    }}/>))}
  </div>);
}

// ═══ HATCH ANIMATION (孵化動畫 - V19) ═══════════════════════════════
// 蛋震動 → 裂開 → 寵物從中跳出
function HatchAnimation({data,onClose}){
  const{egg,petDef,ri}=data;
  const[stage,setStage]=useState(0);// 0: 震動 1: 裂開 2: 寵物出現

  useEffect(()=>{
    const t1=setTimeout(()=>setStage(1),700);
    const t2=setTimeout(()=>setStage(2),1100);
    const t3=setTimeout(()=>onClose&&onClose(),2400);
    return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3)};
  },[]);// eslint-disable-line

  const styleSheet=`
@keyframes ha_overlay { 0%{opacity:0} 100%{opacity:1} }
@keyframes ha_eggShake { 0%,100%{transform:translate(-50%,-50%) rotate(0deg)} 25%{transform:translate(-53%,-50%) rotate(-8deg)} 75%{transform:translate(-47%,-50%) rotate(8deg)} }
@keyframes ha_eggCrack { 0%{transform:translate(-50%,-50%) scale(1);opacity:1} 50%{transform:translate(-50%,-50%) scale(1.3);opacity:1} 100%{transform:translate(-50%,-50%) scale(2.5);opacity:0} }
@keyframes ha_petBurst { 0%{transform:translate(-50%,-50%) scale(0.2);opacity:0} 30%{transform:translate(-50%,-50%) scale(1.4);opacity:1} 60%{transform:translate(-50%,-50%) scale(0.9);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.2);opacity:1} }
@keyframes ha_shellPiece { 0%{transform:translate(0,0) rotate(0deg);opacity:1} 100%{transform:translate(var(--sx),var(--sy)) rotate(var(--sr));opacity:0} }
@keyframes ha_textRise { 0%{transform:translate(-50%,30px);opacity:0} 100%{transform:translate(-50%,0);opacity:1} }
@keyframes ha_glow { 0%,100%{box-shadow:0 0 30px ${ri.color}77} 50%{box-shadow:0 0 60px ${ri.color}, 0 0 100px ${ri.color}88} }
@media (prefers-reduced-motion: reduce) { [data-hatch] *{animation-duration:0.4s !important} }
`;

  // 蛋殼碎片
  const shells=Array.from({length:8},(_,i)=>{
    const angle=i*45+Math.random()*15;
    const dist=80+Math.random()*60;
    return{
      sx:`${Math.cos(angle*Math.PI/180)*dist}px`,
      sy:`${Math.sin(angle*Math.PI/180)*dist}px`,
      sr:`${(Math.random()*720-360)}deg`,
      delay:0.05+Math.random()*0.1,
    };
  });

  return(<div data-hatch onClick={onClose} style={{
    position:"fixed",inset:0,
    background:`radial-gradient(circle,${ri.color}33,rgba(0,0,0,0.85))`,
    zIndex:9999,
    cursor:"pointer",
    animation:"ha_overlay 0.3s ease-out forwards",
    backdropFilter:"blur(2px)",
    WebkitBackdropFilter:"blur(2px)",
  }}>
    <style>{styleSheet}</style>

    {/* 階段 0/1：蛋本體（震動 → 裂開消失） */}
    {stage<2&&<div style={{
      position:"absolute",top:"50%",left:"50%",
      width:120,height:150,
      borderRadius:"50% 50% 50% 50% / 60% 60% 40% 40%",
      background:`linear-gradient(135deg,#FFF8DC,${ri.color}66)`,
      boxShadow:`inset -10px -10px 20px rgba(0,0,0,0.2)`,
      animation:stage===0?"ha_eggShake 0.18s ease-in-out infinite, ha_glow 1.4s ease-in-out infinite":"ha_eggCrack 0.5s ease-out forwards",
      zIndex:5,
    }}/>}

    {/* 階段 1：蛋殼碎片散開 */}
    {stage>=1&&shells.map((sh,i)=>(<div key={`sh${i}`} style={{
      position:"absolute",top:"50%",left:"50%",
      width:14,height:18,
      background:"#FFF8DC",
      borderRadius:"50% 50% 0 0",
      "--sx":sh.sx,"--sy":sh.sy,"--sr":sh.sr,
      animation:`ha_shellPiece 0.8s ${sh.delay}s ease-out forwards`,
      opacity:0,
      zIndex:6,
      boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
    }}/>))}

    {/* 階段 2：寵物從蛋中跳出 */}
    {stage>=2&&<div style={{
      position:"absolute",top:"50%",left:"50%",
      animation:"ha_petBurst 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards",
      opacity:0,
      zIndex:7,
    }}>
      <PixelPet petId={petDef.id} stage="egg" size={120} animate={false}/>
    </div>}

    {/* 文字 */}
    {stage>=2&&<div style={{
      position:"absolute",top:"22%",left:"50%",
      animation:"ha_textRise 0.5s 0.3s ease-out forwards",
      opacity:0,
      fontSize:28,fontWeight:700,
      color:ri.color,
      textShadow:`0 0 16px ${ri.color}, 2px 2px 6px rgba(0,0,0,0.5)`,
      whiteSpace:"nowrap",
      zIndex:10,
    }}>
      🎉 孵化成功！
    </div>}
    {stage>=2&&<div style={{
      position:"absolute",top:"73%",left:"50%",
      animation:"ha_textRise 0.5s 0.5s ease-out forwards",
      opacity:0,
      fontSize:18,fontWeight:600,
      color:"#fff",
      textShadow:"0 2px 6px rgba(0,0,0,0.6)",
      whiteSpace:"nowrap",
      zIndex:10,
    }}>
      {ri.stars} {petDef.name}
    </div>}
  </div>);
}

// ═══ PLAYGROUND VIEW (寵物玩耍場 - P3-1) ════════════════════════════
// 兩隻寵物在草地上互動、英文對話，答對任務後才給獎勵
function PlaygroundView({pets,setPets,setCoins,c,onBack,incrTask}){
  // 隨機選兩隻寵物（不同的）
  const[selected,setSelected]=useState(()=>{
    if(pets.length<2)return[null,null];
    const idx1=Math.floor(Math.random()*pets.length);
    let idx2=Math.floor(Math.random()*pets.length);
    while(idx2===idx1)idx2=Math.floor(Math.random()*pets.length);
    return[idx1,idx2];
  });
  const[bubbleIdx,setBubbleIdx]=useState(0);
  const[played,setPlayed]=useState(false);
  const[answer,setAnswer]=useState(null);

  const PLAY_DIALOGUES=[
    {a:"Hi!",b:"Hello!",tip:"打招呼"},
    {a:"Let's play!",b:"OK!",tip:"一起玩吧"},
    {a:"You are cute!",b:"Thank you!",tip:"你好可愛"},
    {a:"I'm happy!",b:"Me too!",tip:"我很開心"},
    {a:"Want to play?",b:"Yes please!",tip:"想玩嗎？"},
    {a:"Good friend!",b:"Best friend!",tip:"好朋友"},
    {a:"Let's run!",b:"Wait for me!",tip:"一起跑！"},
    {a:"I love you!",b:"Love you too!",tip:"我愛你"},
  ];
  const dialogue=PLAY_DIALOGUES[bubbleIdx%PLAY_DIALOGUES.length];
  const PLAY_CHALLENGES=[
    {q:"Which sentence means「我們是好朋友」?",choices:["We are best friends!","I am hungry.","Good night."],answer:0,speak:"We are best friends!"},
    {q:"Choose the friendly answer to 'Let's play!'",choices:["OK!","No food.","Sleep tight."],answer:0,speak:"OK!"},
    {q:"Which word means「可愛的」?",choices:["cute","tired","dirty"],answer:0,speak:"cute"},
    {q:"Complete: My pet is ___.",choices:["happy","book","run"],answer:0,speak:"My pet is happy."},
  ];
  const challenge=PLAY_CHALLENGES[bubbleIdx%PLAY_CHALLENGES.length];

  useEffect(()=>{
    if(selected[0]===null)return;
    if(played||answer===challenge.answer)return;
    const t=setInterval(()=>{setBubbleIdx(i=>i+1);setAnswer(null)},5000);
    return()=>clearInterval(t);
  },[selected,played,answer,challenge.answer]);

  const playTogether=()=>{
    if(played||selected[0]===null)return;
    if(answer!==challenge.answer){
      setAnswer(answer===null?-1:answer);
      playSound("bad");
      return;
    }
    setPets(ps=>ps.map((p,i)=>{
      if(i===selected[0]||i===selected[1]){
        return levelUpPet({
          ...p,
          bond:(p.bond||0)+8,
          exp:(p.exp||0)+12,
          energy:Math.max(0,(p.energy||0)-4),
          lastUpdate:new Date().toISOString(),
        });
      }
      return p;
    }));
    setCoins?.(co=>co+8);
    incrTask?.("playToday");
    setPlayed(true);
    playSound("combo");
    if(typeof speak==="function")speak(challenge.speak);
  };

  const reroll=()=>{
    if(pets.length<2)return;
    let idx1=Math.floor(Math.random()*pets.length);
    let idx2=Math.floor(Math.random()*pets.length);
    while(idx2===idx1)idx2=Math.floor(Math.random()*pets.length);
    setSelected([idx1,idx2]);
    setBubbleIdx(0);
    setPlayed(false);
    setAnswer(null);
  };

  if(selected[0]===null)return(<div><Hdr t="🎪 玩耍場" onBack={onBack} cl={c.cl}/>
    <div style={{textAlign:"center",padding:"48px 16px"}}>
      <div style={{fontSize:48}}>🐣</div>
      <div style={{fontSize:14,color:S.t2,marginTop:12}}>需要至少 2 隻寵物才能玩耍喔！</div>
    </div>
  </div>);

  const p1=pets[selected[0]],p2=pets[selected[1]];
  const def1=PETS[p1.rarity].find(p=>p.id===p1.petId);
  const def2=PETS[p2.rarity].find(p=>p.id===p2.petId);
  if(!def1||!def2)return null;
  const ri1=RARITY_INFO[p1.rarity];
  const ri2=RARITY_INFO[p2.rarity];

  const styleSheet=`
@keyframes pg_walk1 { 0%,100%{transform:translateX(0) scaleY(1)} 25%{transform:translateX(-3px) scaleY(0.97)} 75%{transform:translateX(3px) scaleY(0.97)} }
@keyframes pg_walk2 { 0%,100%{transform:translateX(0) scaleY(1)} 25%{transform:translateX(3px) scaleY(0.97)} 75%{transform:translateX(-3px) scaleY(0.97)} }
@keyframes pg_bubble { 0%{transform:scale(0) translateY(8px);opacity:0} 30%{transform:scale(1.1) translateY(0);opacity:1} 90%{transform:scale(1) translateY(0);opacity:1} 100%{transform:scale(0.9) translateY(-5px);opacity:0} }
@keyframes pg_heart { 0%{transform:translate(0,0) scale(0);opacity:0} 30%{opacity:1;transform:translate(0,0) scale(1)} 100%{transform:translate(var(--hx),var(--hy)) scale(0.6);opacity:0} }
@keyframes pg_bg { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
@media (prefers-reduced-motion: reduce) { [data-playground] *{animation-duration:0.5s !important;animation-iteration-count:1 !important} }
`;

  return(<div data-playground><Hdr t="🎪 玩耍場" onBack={onBack} cl={c.cl} extra={<button onClick={reroll} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",color:S.t2}}>🎲 換組合</button>}/>
    <style>{styleSheet}</style>

    {/* 場景 */}
    <div style={{
      position:"relative",
      width:"100%",
      height:300,
      borderRadius:18,
      overflow:"hidden",
      marginBottom:14,
      background:"linear-gradient(135deg,#B8E6FF,#E8F5E9 50%,#9CDFA8)",
      backgroundSize:"200% 200%",
      animation:"pg_bg 12s ease infinite",
      boxShadow:"0 4px 16px rgba(0,0,0,0.12)",
      border:"3px solid #E91E63",
    }}>
      {/* 背景裝飾 */}
      <div style={{position:"absolute",top:14,left:20,fontSize:20,opacity:0.5}}>☁️</div>
      <div style={{position:"absolute",top:30,right:30,fontSize:24,opacity:0.6}}>☀️</div>
      <div style={{position:"absolute",top:24,left:"60%",fontSize:14,opacity:0.4}}>☁️</div>

      {/* 寵物 1 - 左側 */}
      <div style={{
        position:"absolute",bottom:60,left:"22%",
        animation:"pg_walk1 1.6s ease-in-out infinite",
      }}>
        <PixelPet petId={def1.id} stage={getPetStage(p1)} size={72} animate={false}/>
        {/* 對話氣泡 */}
        <div key={`b1-${bubbleIdx}`} style={{
          position:"absolute",bottom:"100%",left:"50%",
          transform:"translateX(-50%)",
          marginBottom:8,
          background:"#fff",
          border:`2px solid ${ri1.color}`,
          borderRadius:14,
          padding:"6px 14px",
          fontSize:14,fontWeight:700,
          color:S.t1,
          whiteSpace:"nowrap",
          animation:"pg_bubble 2.8s ease-in-out forwards",
          boxShadow:"0 3px 8px rgba(0,0,0,0.15)",
          zIndex:5,
        }}>
          {dialogue.a}
          <div style={{position:"absolute",bottom:-7,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:`7px solid ${ri1.color}`}}/>
        </div>
      </div>

      {/* 寵物 2 - 右側 */}
      <div style={{
        position:"absolute",bottom:60,right:"22%",
        animation:"pg_walk2 1.6s ease-in-out infinite",
      }}>
        <PixelPet petId={def2.id} stage={getPetStage(p2)} size={72} animate={false}/>
        <div key={`b2-${bubbleIdx}`} style={{
          position:"absolute",bottom:"100%",left:"50%",
          transform:"translateX(-50%)",
          marginBottom:8,
          background:"#fff",
          border:`2px solid ${ri2.color}`,
          borderRadius:14,
          padding:"6px 14px",
          fontSize:14,fontWeight:700,
          color:S.t1,
          whiteSpace:"nowrap",
          animation:"pg_bubble 2.8s 1.2s ease-in-out forwards",
          opacity:0,
          boxShadow:"0 3px 8px rgba(0,0,0,0.15)",
          zIndex:5,
        }}>
          {dialogue.b}
          <div style={{position:"absolute",bottom:-7,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:`7px solid ${ri2.color}`}}/>
        </div>
      </div>

      {/* 已玩耍：愛心爆裂 */}
      {played&&Array.from({length:8}).map((_,i)=>{
        const angle=i*45;
        const dist=60+Math.random()*30;
        return(<div key={`h${i}`} style={{
          position:"absolute",top:"50%",left:"50%",
          fontSize:22,
          "--hx":`${Math.cos(angle*Math.PI/180)*dist}px`,
          "--hy":`${Math.sin(angle*Math.PI/180)*dist-20}px`,
          animation:`pg_heart 1.6s ${i*0.05}s ease-out forwards`,
          opacity:0,
          zIndex:8,
          pointerEvents:"none",
        }}>{i%2?"❤️":"💖"}</div>);
      })}

      {/* 地面 */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:48,background:"linear-gradient(180deg,transparent,#9CDFA8 20%,#7FB28D)",zIndex:1}}/>
      <div style={{position:"absolute",bottom:6,left:0,right:0,textAlign:"center",fontSize:14,letterSpacing:3,zIndex:2}}>🌱🌷🌱🌼🌱🌷🌱🌼🌱</div>
    </div>

    {/* 中文翻譯 */}
    <div style={{...S.card,padding:"14px 18px",marginBottom:12,textAlign:"center",background:`linear-gradient(135deg,#FFE0F0,var(--color-background-primary,#fff))`,border:"2px solid #E91E63"}}>
      <div style={{fontSize:11,color:"#AD1457",fontWeight:600,marginBottom:4}}>💬 牠們在說什麼？</div>
      <div style={{fontSize:15,fontWeight:700,color:S.t1,marginBottom:2}}>"{dialogue.a}" + "{dialogue.b}"</div>
      <div style={{fontSize:12,color:S.t2}}>意思：{dialogue.tip}</div>
    </div>

    <div style={{...S.card,padding:"14px 16px",marginBottom:12,border:"1px solid #E91E6355",background:"linear-gradient(135deg,#FFF7FB,var(--color-background-primary,#fff))"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:8}}>
        <div style={{fontSize:12,fontWeight:1000,color:"#C2185B"}}>English Play Mission</div>
        <button onClick={()=>speak(challenge.q)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:999,padding:"5px 9px",fontSize:11,color:S.t2,cursor:"pointer",fontFamily:"inherit"}}>🔊</button>
      </div>
      <div style={{fontSize:15,fontWeight:900,color:S.t1,lineHeight:1.45,marginBottom:9}}>{challenge.q}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:7}}>
        {challenge.choices.map((choice,i)=>{
          const picked=answer===i;
          const wrong=picked&&i!==challenge.answer;
          const correct=picked&&i===challenge.answer;
          return(<button key={choice} onClick={()=>{setAnswer(i);playSound(i===challenge.answer?"good":"bad");if(i===challenge.answer)speak(challenge.speak)}} disabled={played} style={{padding:"10px 11px",borderRadius:12,border:`2px solid ${correct?"#1D9E75":wrong?"#E24B4A":S.bd}`,background:correct?"#E1F5EE":wrong?"#FCEBEB":S.bg1,color:S.t1,fontSize:13,fontWeight:900,textAlign:"left",cursor:played?"default":"pointer",fontFamily:"inherit"}}>{choice}</button>);
        })}
      </div>
      {answer!==null&&answer!==challenge.answer&&<div style={{fontSize:11,color:"#B42318",fontWeight:800,marginTop:7}}>先選出正確英文，再讓寵物一起玩。</div>}
      {answer===challenge.answer&&<div style={{fontSize:11,color:"#0F6E56",fontWeight:900,marginTop:7}}>答對了，可以開始遊戲獎勵。</div>}
    </div>

    {/* 寵物資訊 */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
      {[{p:p1,def:def1,ri:ri1},{p:p2,def:def2,ri:ri2}].map(({p,def,ri},i)=>(
        <div key={i} style={{...S.card,padding:"10px 12px",textAlign:"center",background:ri.bg,border:`2px solid ${ri.color}`}}>
          <div style={{fontSize:13,fontWeight:700,color:S.t1}}>{def.name}</div>
          <div style={{fontSize:10,color:S.t3,marginTop:2}}>Lv.{p.level} · 💖{p.bond||0}{played?<span style={{color:"#E91E63",fontWeight:700}}> +8 · XP +12</span>:""}</div>
        </div>
      ))}
    </div>

    {/* 主要操作按鈕 */}
    {!played?<button onClick={playTogether} style={{
      ...S.btn,
      width:"100%",
      padding:"16px",
      fontSize:16,
      background:"linear-gradient(135deg,#E91E63,#F06292)",
      color:"#fff",
      boxShadow:"0 4px 12px rgba(233,30,99,0.3)",
    }}>{answer===challenge.answer?"🎉 一起玩耍！(+8 親密度 / XP +12 / 金幣 +8)":"先完成英文任務"}</button>:
    <div style={{textAlign:"center",padding:"14px",background:"#FFE0F0",borderRadius:14,fontSize:14,color:"#C2185B",fontWeight:700,border:"2px solid #E91E63"}}>
      ✨ 玩得很開心！親密度 +8、XP +12、金幣 +8
    </div>}

    <div style={{...S.card,padding:"12px 16px",marginTop:12,background:S.bg2,fontSize:11,color:S.t3,textAlign:"center",lineHeight:1.7}}>
      💡 玩耍會消耗一點體力，但能大大增加親密度！<br/>
      點右上「🎲 換組合」可以選不同的寵物來互動
    </div>
  </div>);
}

// ═══ PETS PAGE (寵物圖鑑 v2 - 養成系統) ════════════════════════════
function PetsPage({onBack,c,pets,setPets,eggs,setEggs,coins,setCoins,inventory,setInventory,petAccount,setPetAccount,petTasks,setPetTasks,incrTask}){
  const[tab,setTab]=useState("tasks");
  const[selectedPet,setSelectedPet]=useState(null);
  const[actionModal,setActionModal]=useState(null);// {pet,action}
  const[shopOpen,setShopOpen]=useState(false);
  const[eventModal,setEventModal]=useState(null);// {pet,event}
  const[milestoneShown,setMilestoneShown]=useState(null);// celebration popup
  const[toast,setToast]=useState(null);// {msg, icon, type}
  const[confirmModal,setConfirmModal]=useState(null);// {msg, onConfirm}
  const[actionCelebration,setActionCelebration]=useState(null);// {actionKey, statText, statColor} (P0-2 視覺優化)
  const[levelUpShown,setLevelUpShown]=useState(null);// {pet, fromLevel, toLevel} (P1-3 升級慶祝)
  const[settingsOpen,setSettingsOpen]=useState(false);// (P2-3 無障礙設定 modal)
  const[animLevel,setAnimLevel]=useLS("eg_animLevel","full");// (P2-3) "full" | "lite" | "off"
  const[playgroundOpen,setPlaygroundOpen]=useState(false);// (P3-1 寵物玩耍場)
  const[hatchAnim,setHatchAnim]=useState(null);// (V19 孵化動畫) {pet, petDef, ri}
  const[petQuery,setPetQuery]=useState("");
  const[petRarity,setPetRarity]=useState("all");
  const[petSort,setPetSort]=useState("need");
  const[eggSort,setEggSort]=useState("ready");
  const[dexQuery,setDexQuery]=useState("");
  const[dexMode,setDexMode]=useState("all");
  const[dexRarity,setDexRarity]=useState("all");

  // (P2-3) 把動畫強度套用到 body class，全域 CSS 控制
  useEffect(()=>{
    if(typeof document==="undefined")return;
    document.body.classList.remove("eg-anim-full","eg-anim-lite","eg-anim-off");
    document.body.classList.add(`eg-anim-${animLevel}`);
  },[animLevel]);

  const showToast=(msg,icon="💬",type="info")=>{
    setToast({msg,icon,type});
    setTimeout(()=>setToast(null),2800);
  };

  // Today's task progress
  const today=new Date().toDateString();
  const taskCounts=petTasks?.date===today?(petTasks.counts||{}):{};
  const[claimedTasks,setClaimedTasks]=useLS("claimedTasks",{date:"",ids:[]});
  const claimedToday=claimedTasks?.date===today?(claimedTasks.ids||[]):[];
  const getPetDef=pet=>PETS[pet.rarity]?.find(p=>p.id===pet.petId);
  const totalPetKinds=Object.values(PETS).reduce((a,list)=>a+list.length,0);
  const ownedIds=useMemo(()=>new Set(pets.map(p=>p.petId)),[pets]);
  const readyEggCount=eggs.filter(e=>e.progress>=EGG_HATCH_TASKS[e.rarity]).length;
  const careNeedCount=pets.reduce((sum,p)=>sum+getCareCount(p),0);
  const bestBond=Math.max(0,...pets.map(p=>p.bond||0));
  const visiblePets=useMemo(()=>{
    const q=petQuery.trim().toLowerCase();
    const rows=pets.map((pet,idx)=>({pet,idx,def:PETS[pet.rarity]?.find(p=>p.id===pet.petId)})).filter(x=>x.def);
    return rows.filter(({pet,def})=>{
      if(petRarity!=="all"&&pet.rarity!==petRarity)return false;
      if(!q)return true;
      return [def.name,def.id,def.story,pet.rarity,...(def.words||[])].some(v=>String(v||"").toLowerCase().includes(q));
    }).sort((a,b)=>{
      if(petSort==="need")return getCareCount(b.pet)-getCareCount(a.pet)||RARITY_ORDER[b.pet.rarity]-RARITY_ORDER[a.pet.rarity]||b.pet.level-a.pet.level;
      if(petSort==="level")return (b.pet.level||1)-(a.pet.level||1)||RARITY_ORDER[b.pet.rarity]-RARITY_ORDER[a.pet.rarity];
      if(petSort==="bond")return (b.pet.bond||0)-(a.pet.bond||0);
      if(petSort==="rarity")return RARITY_ORDER[b.pet.rarity]-RARITY_ORDER[a.pet.rarity]||a.def.name.localeCompare(b.def.name,"zh-Hant");
      return a.idx-b.idx;
    });
  },[pets,petQuery,petRarity,petSort]);
  const visibleEggs=useMemo(()=>{
    return eggs.map((egg,idx)=>({egg,idx,def:PETS[egg.rarity]?.find(p=>p.id===egg.petId)})).filter(x=>x.def).sort((a,b)=>{
      const an=EGG_HATCH_TASKS[a.egg.rarity],bn=EGG_HATCH_TASKS[b.egg.rarity];
      const ar=a.egg.progress>=an,br=b.egg.progress>=bn;
      if(eggSort==="ready")return Number(br)-Number(ar)||RARITY_ORDER[b.egg.rarity]-RARITY_ORDER[a.egg.rarity]||(b.egg.progress/bn)-(a.egg.progress/an);
      if(eggSort==="rarity")return RARITY_ORDER[b.egg.rarity]-RARITY_ORDER[a.egg.rarity]||Number(br)-Number(ar);
      return new Date(b.egg.date||0)-new Date(a.egg.date||0);
    });
  },[eggs,eggSort]);
  const duplicateEggIssueCount=useMemo(()=>{
    const seen=new Set();
    return eggs.reduce((count,egg)=>{
      if(ownedIds.has(egg.petId)||seen.has(egg.petId))return count+1;
      seen.add(egg.petId);
      return count;
    },0);
  },[eggs,ownedIds]);
  const collectionStats=useMemo(()=>{
    const eggIds=new Set(eggs.map(e=>e.petId));
    const eggOnlyIds=[...eggIds].filter(id=>!ownedIds.has(id));
    const missingIds=Object.values(PETS).flat().map(p=>p.id).filter(id=>!ownedIds.has(id));
    const dupeTotal=pets.reduce((sum,p)=>sum+(p.dupes||0),0);
    const resonanceLeader=[...pets].sort((a,b)=>(b.dupes||0)-(a.dupes||0))[0]||null;
    const closestEgg=eggs
      .map(egg=>{
        const needed=EGG_HATCH_TASKS[egg.rarity]||1;
        const def=PETS[egg.rarity]?.find(p=>p.id===egg.petId);
        return{egg,def,needed,pct:Math.min(100,Math.round(((egg.progress||0)/needed)*100)),left:Math.max(0,needed-(egg.progress||0))};
      })
      .filter(x=>x.def)
      .sort((a,b)=>Number(b.egg.progress>=b.needed)-Number(a.egg.progress>=a.needed)||b.pct-a.pct||RARITY_ORDER[b.egg.rarity]-RARITY_ORDER[a.egg.rarity])[0]||null;
    return{eggOnlyCount:eggOnlyIds.length,missingCount:missingIds.length,dupeTotal,resonanceLeader,closestEgg};
  },[eggs,pets,ownedIds]);
  const quickCarePlan=useMemo(()=>{
    const inv={...inventory};
    let feed=0,clean=0,sleep=0,needsFood=0;
    pets.forEach(p=>{
      const food=choosePetFoodForNeed(p,inv);
      if((p.hunger??80)<75){
        if(food){inv[food.id]=Math.max(0,(inv[food.id]||0)-1);feed++}
        else needsFood++;
      }
      if((p.poops||[]).length>0||(p.clean??80)<70)clean++;
      if((p.energy??80)<55)sleep++;
    });
    return{feed,clean,sleep,needsFood,total:feed+clean+sleep};
  },[pets,inventory]);
  const mergeDuplicateEggs=()=>{
    if(!duplicateEggIssueCount)return;
    const now=new Date().toISOString();
    const kept=new Map();
    const rewards={};
    let merged=0,boosted=0;
    eggs.forEach(egg=>{
      if(ownedIds.has(egg.petId)){
        const r=getDuplicatePetReward(egg.rarity);
        rewards[egg.petId]=rewards[egg.petId]?{exp:rewards[egg.petId].exp+r.exp,bond:rewards[egg.petId].bond+r.bond,dupes:rewards[egg.petId].dupes+r.dupes}:r;
        boosted++;
        return;
      }
      const old=kept.get(egg.petId);
      if(!old){kept.set(egg.petId,{...egg});return}
      const gain=Math.max(DUPLICATE_EGG_PROGRESS[egg.rarity]||DUPLICATE_EGG_PROGRESS.N,egg.progress||0);
      const needed=EGG_HATCH_TASKS[old.rarity]||EGG_HATCH_TASKS[egg.rarity];
      old.progress=Math.min(needed,(old.progress||0)+gain);
      old.updatedAt=now;
      merged++;
    });
    if(Object.keys(rewards).length){
      setPets(ps=>ps.map(p=>rewards[p.petId]?applyDuplicatePetReward(p,rewards[p.petId],now):p));
    }
    setEggs([...kept.values()]);
    playSound("combo");
    showToast(`已整理重複蛋：融合 ${merged} 顆，轉成成長能量 ${boosted} 顆`,"✨","info");
  };

  const quickCareAll=()=>{
    const inv={...inventory};
    const now=new Date().toISOString();
    let fed=0,cleaned=0,rested=0,changed=0,needsFood=0;
    const nextPets=pets.map(p=>{
      let updated={...p};
      let touched=false;
      const food=choosePetFoodForNeed(updated,inv);
      if((updated.hunger??80)<75){
        if(food){
          inv[food.id]=Math.max(0,(inv[food.id]||0)-1);
          updated.hunger=Math.min(MAX_STAT,(updated.hunger??80)+food.feed);
          updated.bond=(updated.bond||0)+1;
          fed++;
          touched=true;
        }else{
          needsFood++;
        }
      }
      if((updated.poops||[]).length>0||(updated.clean??80)<70){
        updated.poops=[];
        updated.clean=MAX_STAT;
        updated.bond=(updated.bond||0)+2;
        cleaned++;
        touched=true;
      }
      if((updated.energy??80)<55){
        updated.energy=MAX_STAT;
        rested++;
        touched=true;
      }
      if(!touched)return p;
      changed++;
      return{...updated,lastUpdate:now};
    });
    if(!changed){
      if(needsFood){setShopOpen(true);showToast("有寵物想吃東西，但食物不夠。","🏪","info")}
      else showToast("目前沒有需要快速照顧的寵物。","👍","info");
      return;
    }
    setPets(nextPets);
    setInventory(inv);
    if(selectedPet){
      const refreshed=nextPets.find(p=>p.petId===selectedPet.petId);
      if(refreshed)setSelectedPet(refreshed);
    }
    if(fed)incrTask?.("feedToday",fed);
    if(cleaned)incrTask?.("cleanToday",cleaned);
    playSound("combo");
    showToast(`快速照顧完成：餵食 ${fed}、清潔 ${cleaned}、休息 ${rested}`,"✨","info");
    if(needsFood>0)window.setTimeout(()=>showToast(`${needsFood} 隻寵物還需要食物，記得補貨。`,"🏪","info"),900);
  };

  const claimTask=(task,event)=>{
    if(claimedToday.includes(task.id))return;
    const count=taskCounts[task.statKey]||0;
    if(count<task.target)return;
    // Bond multiplier bonus (if any pet is good friends)
    const maxBond=Math.max(0,...pets.map(p=>p.bond||0));
    const bonus=maxBond>=150?1.2:1;
    const finalCoins=Math.floor(task.reward.coins*bonus);
    setCoins(co=>co+finalCoins);
    // Give exp to highest-bond pet (most cared for)
    if(pets.length>0){
      const topIdx=pets.reduce((best,p,i)=>(p.bond||0)>(pets[best].bond||0)?i:best,0);
      setPets(ps=>{
        const updated=[...ps];
        const p={...updated[topIdx]};
        p.exp=(p.exp||0)+Math.floor(task.reward.exp*bonus);
        updated[topIdx]=levelUpPet(p);
        return updated;
      });
    }
    setClaimedTasks({date:today,ids:[...claimedToday,task.id]});
    playSound("combo");

    // (V20) 從按鈕位置噴金幣 + 中央顯示獎勵文字
    if(typeof triggerRewardBurst==="function"&&event){
      const center=getEventCenter(event);
      triggerRewardBurst({
        emoji:"🪙",count:Math.min(8,finalCoins),
        fromX:center.x,fromY:center.y,
        size:24,duration:1300,
      });
      triggerRewardBurst({
        text:`+${finalCoins} 🪙`,
        fromX:window.innerWidth/2,fromY:"35%",
        textColor:"#FFD700",textSize:36,
        duration:1400,
      });
    }
  };

  // Apply decay on mount
  useEffect(()=>{
    setPets(ps=>ps.map(p=>calcDecay(p)));
  },[]);

  const hatchEgg=(egg)=>{
    const petDef=PETS[egg.rarity].find(p=>p.id===egg.petId);
    if(!petDef)return;
    const ri=RARITY_INFO[egg.rarity];
    // (V19) 觸發孵化動畫
    setHatchAnim({egg,petDef,ri});
    playSound("flip");
    // 動畫播完才實際更新資料
    setTimeout(()=>{
      const now=new Date().toISOString();
      const existingIdx=pets.findIndex(p=>p.petId===egg.petId);
      if(existingIdx>=0){
        const reward=getDuplicatePetReward(egg.rarity);
        setPets(ps=>ps.map(p=>p.petId===egg.petId?applyDuplicatePetReward(p,reward,now):p));
        setSelectedPet(cur=>cur?.petId===egg.petId?applyDuplicatePetReward(cur,reward,now):cur);
        showToast(`${petDef.name} 已擁有，轉成 XP +${reward.exp}、親密 +${reward.bond}`,"✨","info");
      }else{
        setPets(ps=>[...ps,{
          petId:egg.petId,rarity:egg.rarity,level:1,exp:0,dupes:0,
          hunger:100,clean:100,energy:100,bond:0,
          hatchDate:now,lastUpdate:now,
        }]);
      }
      setEggs(es=>es.filter(e=>e.id!==egg.id));
      playSound("done");
    },1200);
  };

  const buyFood=(food,event)=>{
    if(coins<food.cost)return;
    setCoins(co=>co-food.cost);
    setInventory(inv=>({...inv,[food.id]:(inv[food.id]||0)+1}));
    playSound("good");
    // (V20) 食物粒子動畫
    if(typeof triggerRewardBurst==="function"&&event){
      const center=getEventCenter(event);
      triggerRewardBurst({
        emoji:food.emoji,count:5,
        fromX:center.x,fromY:center.y,
        size:28,duration:1100,
      });
    }
  };

  const performAction=(pet,actionKey,foodId=null)=>{
    // Don't let user disturb sleeping pet (except feed which is OK if really hungry)
    if(isPetSleeping()&&actionKey!=="feed"&&actionKey!=="sleep"){
      showToast("Zzz... 寵物正在睡覺，別吵醒他！","💤","sleep");
      return;
    }
    const action=PET_ACTIONS[actionKey];
    const prompts=ACTION_PROMPTS[actionKey];
    const prompt=prompts[Math.floor(Math.random()*prompts.length)];
    setActionModal({pet,actionKey,action,prompt,foodId,step:"learn"});
  };

  const completeAction=(actionKey,foodId)=>{
    const pet=actionModal.pet;
    const petIdx=pets.findIndex(p=>p.petId===pet.petId);
    if(petIdx<0)return;
    let updated={...pets[petIdx]};
    const prevBond=updated.bond||0;

    // 計算狀態變化文字（給粒子動畫的數值跳動用） (P0-2)
    let statText="",statColor="#1D9E75";

    if(actionKey==="feed"&&foodId){
      const food=PET_FOODS.find(f=>f.id===foodId);
      if(food){
        updated.hunger=Math.min(MAX_STAT,(updated.hunger||0)+food.feed);
        setInventory(inv=>({...inv,[foodId]:Math.max(0,(inv[foodId]||0)-1)}));
        statText=`🍖 +${food.feed}`;statColor="#EF9F27";
      }
      incrTask&&incrTask("feedToday");
    }else if(actionKey==="clean"){
      updated.clean=MAX_STAT;
      statText="✨ 滿格";statColor="#4A90E2";
      incrTask&&incrTask("cleanToday");
    }else if(actionKey==="play"){
      updated.bond=(updated.bond||0)+10;
      updated.energy=Math.max(0,(updated.energy||0)-5);
      statText="💖 +10";statColor="#E91E63";
      incrTask&&incrTask("playToday");
    }else if(actionKey==="sleep"){
      updated.energy=MAX_STAT;
      statText="⚡ 滿格";statColor="#7B61FF";
    }else if(actionKey==="study"){
      updated.bond=(updated.bond||0)+15;
      updated.exp=(updated.exp||0)+20;
      statText="XP +30";statColor="#1D9E75";
    }

    const dailyBefore=getPetDailyCultivation(updated);
    const dailyActions=[...new Set([...dailyBefore.actions,actionKey])];
    const cultivationBonus=dailyActions.length>=3&&!dailyBefore.comboClaimed?{exp:30,bond:10,coins:20}:null;
    if(cultivationBonus){
      updated.exp=(updated.exp||0)+cultivationBonus.exp;
      updated.bond=(updated.bond||0)+cultivationBonus.bond;
    }
    updated.careLog={date:dailyBefore.date,actions:dailyActions,comboClaimed:dailyBefore.comboClaimed||!!cultivationBonus};
    updated.exp=(updated.exp||0)+10;
    updated.lastUpdate=new Date().toISOString();
    const prevPetLevel=updated.level;// (P1-3 升級偵測)
    updated=levelUpPet(updated);
    const leveledUp=updated.level>prevPetLevel;// (P1-3)

    // Check for bond milestone crossing
    const prevLevel=getBondLevel(prevBond);
    const newLevel=getBondLevel(updated.bond||0);
    if(newLevel>prevLevel&&newLevel<=BOND_MILESTONES.length){
      setMilestoneShown({milestone:BOND_MILESTONES[newLevel-1],pet:updated});
      playSound("combo");
    }

    setPets(ps=>ps.map((p,i)=>i===petIdx?updated:p));
    setCoins(co=>co+5+(cultivationBonus?.coins||0));// reward for caring
    // Play action sound + pet's own voice for personality
    playActionSound(actionKey);
    setTimeout(()=>playPetSound(pet.petId),400);// pet reacts happily after action

    // 觸發粒子慶祝動畫 (P0-2 視覺優化)
    setActionModal(null);
    if(selectedPet&&selectedPet.petId===pet.petId)setSelectedPet(updated);
    setActionCelebration({actionKey,statText,statColor,bonusText:cultivationBonus?`今日培養完成：XP +${cultivationBonus.exp}、親密 +${cultivationBonus.bond}、金幣 +${cultivationBonus.coins}`:null,foodEmoji:foodId?(PET_FOODS.find(f=>f.id===foodId)?.emoji||"🍖"):null});
    setTimeout(()=>setActionCelebration(null),1400);

    // (P1-3) 升級慶祝：在動作粒子之後顯示
    if(leveledUp){
      setTimeout(()=>{
        setLevelUpShown({pet:updated,fromLevel:prevPetLevel,toLevel:updated.level});
        playSound("combo");
      },1500);
    }
  };

  // Pet Event (random English dialogue) - triggered when opening a pet
  const triggerEvent=(pet)=>{
    // 30% chance per pet selection
    if(Math.random()>0.3)return;
    const ev=PET_EVENTS[Math.floor(Math.random()*PET_EVENTS.length)];
    setEventModal({pet,event:ev,answered:null});
  };

  const answerEvent=(idx)=>{
    if(!eventModal||eventModal.answered!==null)return;
    const correct=idx===eventModal.event.correct;
    setEventModal(m=>({...m,answered:idx}));
    if(correct){
      setCoins(co=>co+eventModal.event.reward.coins);
      setPets(ps=>ps.map(p=>p.petId===eventModal.pet.petId?{...p,bond:(p.bond||0)+eventModal.event.reward.bond,lastUpdate:new Date().toISOString()}:p));
      playSound("combo");
      speak(eventModal.event.choices[eventModal.event.correct]);
    }else{
      playSound("bad");
    }
    setTimeout(()=>setEventModal(null),2500);
  };

  // Bond milestone celebration
  if(milestoneShown){
    const{milestone,pet}=milestoneShown;
    const petDef=PETS[pet.rarity].find(p=>p.id===pet.petId);
    return(<div><Hdr t="🎊 親密度里程碑" onBack={()=>setMilestoneShown(null)} cl={c.cl}/>
      <div style={{...S.card,padding:"32px 20px",textAlign:"center",background:`linear-gradient(135deg,${milestone.color}33,var(--color-background-primary,#fff))`,border:`3px solid ${milestone.color}`,animation:"bounceIn .5s"}}>
        <div style={{fontSize:72,marginBottom:8,animation:"emojiBounce 1s ease-in-out infinite"}}>{milestone.icon}</div>
        <div style={{fontSize:14,color:milestone.color,fontWeight:700,marginBottom:4}}>💖 {pet.bond||0} 親密度</div>
        <div style={{fontSize:24,fontWeight:700,color:S.t1}}>{milestone.title}</div>
        <div style={{fontSize:14,color:S.t2,marginTop:6}}>你和 {petDef.name} 已達到</div>
        <div style={{padding:"12px 16px",background:S.bg2,borderRadius:12,marginTop:14,fontSize:14,color:S.t1,lineHeight:1.6}}>
          🎁 <b style={{color:milestone.color}}>解鎖獎勵</b><br/>
          {milestone.desc}
        </div>
        <button onClick={()=>setMilestoneShown(null)} style={{...S.btn,background:milestone.color,color:"#fff",marginTop:18,padding:"14px 30px",fontSize:15}}>✨ 太棒了！</button>
      </div>
    </div>);
  }

  // (P1-3) 升級慶祝 overlay — 全螢幕煙火效果
  const levelUpOverlay=levelUpShown?(()=>{
    const{pet,fromLevel,toLevel}=levelUpShown;
    const petDef=PETS[pet.rarity].find(p=>p.id===pet.petId);
    if(!petDef)return null;
    return(<LevelUpCelebration pet={pet} petDef={petDef} fromLevel={fromLevel} toLevel={toLevel} onClose={()=>setLevelUpShown(null)}/>);
  })():null;

  // Pet event dialogue modal
  if(eventModal){
    const{pet,event,answered}=eventModal;
    const petDef=PETS[pet.rarity].find(p=>p.id===pet.petId);
    const correct=answered===event.correct;
    return(<div><Hdr t={`💭 ${petDef.name}問你`} onBack={()=>setEventModal(null)} cl={c.cl}/>
      <div style={{...S.card,padding:"24px 20px"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"center",animation:"emojiBounce 1s ease-in-out infinite"}}><PixelPet petId={petDef.id} stage={getPetStage(pet)} size={120}/></div>
          <div style={{marginTop:12,padding:"14px 18px",background:c.bg,borderRadius:16,display:"inline-block",border:`2px solid ${c.cl}`,fontSize:15,fontWeight:600,color:S.t1}}>
            💭 {event.q}
          </div>
        </div>

        <div style={{display:"grid",gap:8}}>
          {event.choices.map((ch,i)=>{
            const isChosen=answered===i;
            const isCorrect=i===event.correct;
            let bg=S.bg1,bd=`1px solid ${S.bd}`;
            if(answered!==null){
              if(isCorrect){bg="#E1F5EE";bd="2px solid #1D9E75"}
              else if(isChosen){bg="#FCEBEB";bd="2px solid #E24B4A"}
            }
            return(<button key={i} onClick={()=>answerEvent(i)} disabled={answered!==null} style={{padding:"14px 16px",borderRadius:12,background:bg,border:bd,textAlign:"left",fontSize:15,fontWeight:500,cursor:answered===null?"pointer":"default",fontFamily:"inherit",color:S.t1,transition:"all .2s",minHeight:52}}>
              {ch} {answered!==null&&isCorrect&&"✅"}{answered!==null&&isChosen&&!isCorrect&&"❌"}
            </button>);
          })}
        </div>

        {answered!==null&&<div style={{marginTop:16,padding:"14px 16px",borderRadius:12,background:correct?"#E1F5EE":"#FFF3CD",textAlign:"center"}}>
          {correct?(<>
            <div style={{fontSize:20,fontWeight:700,color:"#1D9E75"}}>✅ 答對了！</div>
            <div style={{fontSize:13,color:S.t2,marginTop:4}}>🪙 +{event.reward.coins} · 💖 +{event.reward.bond}</div>
          </>):(<>
            <div style={{fontSize:18,fontWeight:700,color:"#EF9F27"}}>❌ 不太對</div>
            <div style={{fontSize:13,color:S.t1,marginTop:4}}>正確答案：<b style={{color:"#1D9E75"}}>{event.choices[event.correct]}</b></div>
          </>)}
        </div>}
      </div>
    </div>);
  }

  // (P3-1) Playground Modal - 兩隻寵物互動
  if(playgroundOpen){
    return(<PlaygroundView pets={pets} setPets={setPets} setCoins={setCoins} c={c} onBack={()=>setPlaygroundOpen(false)} incrTask={incrTask}/>);
  }

  // (P2-3) Settings Modal - 無障礙與省電設定
  if(settingsOpen){
    return(<div><Hdr t="⚙️ 寵物頁設定" onBack={()=>setSettingsOpen(false)} cl={c.cl}/>
      <div style={{...S.card,padding:"18px 18px 22px",marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:700,color:S.t1,marginBottom:6}}>🎬 動畫效果強度</div>
        <div style={{fontSize:12,color:S.t3,lineHeight:1.7,marginBottom:14}}>
          調整寵物互動的動畫強度。如果手機溫度偏高、電池快沒電、或想要更安靜的體驗，可以選擇較低強度。
        </div>
        {[
          {v:"full",icon:"✨",title:"完整效果",desc:"所有粒子、光柱、煙火、震動全部播放"},
          {v:"lite",icon:"🌿",title:"輕量效果",desc:"基本動畫，省略大型粒子與全螢幕特效"},
          {v:"off",icon:"⚡",title:"關閉動畫",desc:"幾乎沒有動畫，最省電、最安靜"},
        ].map(opt=>(<button key={opt.v} onClick={()=>setAnimLevel(opt.v)} style={{
          width:"100%",
          textAlign:"left",
          padding:"14px 16px",
          marginBottom:8,
          background:animLevel===opt.v?`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`:S.bg2,
          border:`2px solid ${animLevel===opt.v?c.cl:S.bd}`,
          borderRadius:14,
          cursor:"pointer",
          fontFamily:"inherit",
          display:"flex",alignItems:"center",gap:12,
          transition:"all .2s",
        }}>
          <span style={{fontSize:28}}>{opt.icon}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:animLevel===opt.v?c.cl:S.t1}}>
              {opt.title}{animLevel===opt.v&&<span style={{marginLeft:6,fontSize:12}}>✓ 使用中</span>}
            </div>
            <div style={{fontSize:11,color:S.t3,marginTop:2,lineHeight:1.5}}>{opt.desc}</div>
          </div>
        </button>))}

        <div style={{marginTop:18,padding:"12px 14px",background:S.bg2,borderRadius:10,fontSize:11,color:S.t3,lineHeight:1.7}}>
          💡 提示：如果系統開啟了「減少動態效果」，動畫也會自動降級。<br/>
          設定會自動儲存，下次打開仍然有效。
        </div>
      </div>

      <button onClick={()=>setSettingsOpen(false)} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:15}}>✓ 完成</button>
    </div>);
  }

  // Action Modal (mini English challenge)
  if(actionModal){
    const{pet,actionKey,action,prompt,foodId}=actionModal;
    const petDef=PETS[pet.rarity].find(p=>p.id===pet.petId);
    return(<div><Hdr t={`${action.icon} ${action.name} ${petDef.emoji}`} onBack={()=>setActionModal(null)} cl={c.cl}/>
      <div style={{...S.card,padding:"28px 20px",textAlign:"center",background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
        <div style={{display:"flex",justifyContent:"center",animation:"emojiBounce 1s ease-in-out infinite"}}><PixelPet petId={petDef.id} stage={getPetStage(pet)} size={96}/></div>
        <div style={{fontSize:14,color:c.cl,fontWeight:600,marginTop:8}}>念出這句話來{action.name}！</div>
        <div style={{...S.card,padding:"18px 14px",marginTop:14,background:"var(--color-background-primary,#fff)"}}>
          <div style={{fontSize:22,fontWeight:700,color:S.t1}}>"{prompt}"</div>
          <button onClick={()=>speak(prompt)} style={{background:"none",border:"none",fontSize:28,cursor:"pointer",marginTop:8,padding:"4px"}}>🔊</button>
        </div>
        <div style={{fontSize:12,color:S.t3,marginTop:12,lineHeight:1.7}}>
          💡 用英文念出這句話給{petDef.name}聽！<br/>
          按「完成」來{action.name}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:16}}>
          <button onClick={()=>setActionModal(null)} style={{...S.btn,background:S.bg2,color:S.t2,fontSize:14}}>取消</button>
          <button onClick={()=>completeAction(actionKey,foodId)} style={{...S.btn,background:c.cl,color:"#fff",fontSize:14}}>✅ 我念完了！</button>
        </div>
      </div>
    </div>);
  }

  // Shop view
  if(shopOpen){
    return(<div><Hdr t="🏪 寵物商店" onBack={()=>setShopOpen(false)} cl={c.cl}/>
      <div style={{...S.card,padding:"14px 18px",marginBottom:12,textAlign:"center",background:"linear-gradient(135deg,#FFF3CD,#FFE066)",border:"2px solid #EF9F27"}}>
        <div style={{fontSize:28,fontWeight:700,color:"#EF9F27"}}>🪙 {coins}</div>
        <div style={{fontSize:11,color:"#856404",marginTop:2}}>購買食物餵食寵物</div>
      </div>
      <div style={{fontSize:13,color:S.t2,marginBottom:10,padding:"0 4px"}}>🍽️ 食物 — 點擊購買（同時學單字！）</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10}}>
        {PET_FOODS.map(food=>{const owned=inventory[food.id]||0;const canBuy=coins>=food.cost;return(<div key={food.id} style={{...S.card,padding:"14px 10px",textAlign:"center",border:canBuy?`1px solid ${S.bd}`:`1px solid ${S.bd}`,opacity:canBuy?1:.5,position:"relative"}}>
          {owned>0&&<div style={{position:"absolute",top:4,right:4,background:c.cl,color:"#fff",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:700}}>×{owned}</div>}
          <div style={{fontSize:40}}>{food.emoji}</div>
          <div style={{fontSize:13,fontWeight:600,color:S.t1,marginTop:4}}>{food.name}</div>
          <div style={{fontSize:11,color:S.t3}}>{food.word} · 🍖+{food.feed}</div>
          <button onClick={(e)=>{buyFood(food,e);speak(food.word)}} disabled={!canBuy} style={{...S.btn,background:canBuy?c.cl:S.bg2,color:canBuy?"#fff":S.t3,marginTop:8,fontSize:12,padding:"6px 12px",width:"100%",cursor:canBuy?"pointer":"not-allowed"}}>🪙 {food.cost}</button>
        </div>)})}
      </div>
      <div style={{...S.card,padding:"12px 16px",marginTop:12,fontSize:12,color:S.t2,lineHeight:1.8}}>
        💡 <b>小提示</b>：點食物按鈕會唸出英文單字，一邊買一邊學！
      </div>
    </div>);
  }

  // Single pet detail view (care page)
  if(selectedPet){
    const petDef=PETS[selectedPet.rarity].find(p=>p.id===selectedPet.petId);
    const ri=RARITY_INFO[selectedPet.rarity];
    const mood=getPetMood(selectedPet);
    const expNeeded=selectedPet.level*100;
    const foodsOwned=PET_FOODS.filter(f=>(inventory[f.id]||0)>0);
    const suggestedFood=choosePetFoodForNeed(selectedPet,inventory);
    const careSuggestion=getPetCareSuggestion(selectedPet,inventory);
    const cultivationPlan=getPetCultivationPlan(selectedPet,inventory);
    const readiness=getPetReadiness(selectedPet);
    const adventureSkill=getPetAdventureSkill(selectedPet);
    const adventureSkillVisual=PET_ADVENTURE_SKILL_VISUALS[adventureSkill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
    const adventureSkillCards=getPetAdventureSkillCards(selectedPet);
    const nextAdventureSkill=getNextPetAdventureSkillCard(selectedPet);
    const duplicateEnergy=getDuplicateEnergyInfo(selectedPet);
    const startSuggestedCare=()=>{
      if(!careSuggestion)return;
      if(careSuggestion.shop){setShopOpen(true);return}
      performAction(selectedPet,careSuggestion.actionKey,careSuggestion.foodId||null);
    };
    const runCultivationAction=action=>{
      if(!action)return;
      if(action.shop){setShopOpen(true);return}
      performAction(selectedPet,action.actionKey,action.foodId||null);
    };

    return(<div>
      {levelUpOverlay}
      <Hdr t={`${petDef.emoji} ${petDef.name}`} onBack={()=>setSelectedPet(null)} cl={c.cl} extra={<button onClick={()=>setShopOpen(true)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",color:S.t2}}>🏪 商店</button>}/>

      {/* Pet Home Scene - immersive environment */}
      <div style={{position:"relative"}}>
      <PetHomeScene pet={selectedPet} petDef={petDef} ri={ri} mood={mood} c={c} onCleanPoop={(poopId)=>{
        const updated={...selectedPet,poops:(selectedPet.poops||[]).filter(p=>p.id!==poopId),clean:Math.min(MAX_STAT,(selectedPet.clean||0)+5),bond:(selectedPet.bond||0)+2,lastUpdate:new Date().toISOString()};
        setPets(ps=>ps.map(p=>p.petId===selectedPet.petId?updated:p));
        setSelectedPet(updated);
        setCoins(co=>co+2);
        playSound("good");
        speak("Clean up!");
      }}/>
      {actionCelebration&&<ActionCelebration data={actionCelebration}/>}
      </div>

      {/* Level + Exp under the home */}
      <div style={{...S.card,padding:"12px 16px",marginBottom:12,textAlign:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:700,color:c.cl}}>Lv.{selectedPet.level}</span>
          <div style={{flex:1,height:8,background:S.bg2,borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${(selectedPet.exp/expNeeded)*100}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,transition:"width .3s"}}/>
          </div>
          <span style={{fontSize:11,color:S.t3}}>{selectedPet.exp}/{expNeeded}</span>
        </div>
      </div>

      <div style={{...S.card,padding:"14px 16px",marginBottom:12,border:`1px solid ${c.cl}33`,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",flexWrap:"wrap",marginBottom:10}}>
          <div>
            <div style={{fontSize:14,fontWeight:1000,color:S.t1}}>今日培養計畫</div>
            <div style={{fontSize:11,color:S.t2,marginTop:2,lineHeight:1.5}}>{cultivationPlan.primary.desc}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:S.t3,fontWeight:800}}>成長力</div>
            <div style={{fontSize:22,fontWeight:1000,color:c.cl}}>{cultivationPlan.score}</div>
          </div>
        </div>
        <div style={{padding:"10px 11px",borderRadius:12,background:S.bg1,border:`1px solid ${c.cl}22`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
          <div style={{flex:1,minWidth:170}}>
            <div style={{fontSize:13,fontWeight:1000,color:c.cl}}>{cultivationPlan.primary.title}</div>
            <div style={{display:"flex",gap:5,marginTop:7,alignItems:"center",flexWrap:"wrap"}}>
              {PET_CULTIVATION_ACTIONS.map(a=>{
                const done=cultivationPlan.daily.actions.includes(a.key);
                return(<span key={a.key} title={a.label} style={{width:26,height:26,borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,border:`1px solid ${done?c.cl:S.bd}`,background:done?c.cl:S.bg2,color:done?"#fff":S.t3}}>{done?"✓":a.short}</span>);
              })}
              <span style={{fontSize:11,color:S.t2,fontWeight:900,marginLeft:2}}>{cultivationPlan.daily.count}/{cultivationPlan.daily.target} 種培養</span>
            </div>
          </div>
          <button onClick={()=>runCultivationAction(cultivationPlan.primary.action)} style={{...S.btn,background:c.cl,color:"#fff",fontSize:12,padding:"10px 13px"}}>{cultivationPlan.primary.action?.label||"開始培養"}</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:10}}>
          <div style={{padding:"9px 10px",borderRadius:12,background:S.bg1,border:`1px solid ${S.bd}`}}>
            <div style={{fontSize:11,color:S.t3,fontWeight:800}}>進化</div>
            <div style={{fontSize:13,fontWeight:900,color:S.t1,marginTop:3}}>{cultivationPlan.evolution.currentLabel} → {cultivationPlan.evolution.nextLabel}</div>
            <div style={{height:6,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${cultivationPlan.evolution.pct}%`,background:c.cl,borderRadius:999}}/></div>
            <div style={{fontSize:10,color:S.t3,marginTop:4}}>{cultivationPlan.evolution.targetLevel?`還差約 ${cultivationPlan.evolution.expLeft} XP`:"已達最終型態"}</div>
          </div>
          <div style={{padding:"9px 10px",borderRadius:12,background:S.bg1,border:`1px solid ${S.bd}`}}>
            <div style={{fontSize:11,color:S.t3,fontWeight:800}}>羈絆</div>
            <div style={{fontSize:13,fontWeight:900,color:S.t1,marginTop:3}}>{cultivationPlan.bond.next?cultivationPlan.bond.next.title:"羈絆滿級"}</div>
            <div style={{height:6,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${cultivationPlan.bond.pct}%`,background:"#E91E63",borderRadius:999}}/></div>
            <div style={{fontSize:10,color:S.t3,marginTop:4}}>{cultivationPlan.bond.next?`還差 ${cultivationPlan.bond.left} 親密度`: "已解鎖全部里程碑"}</div>
          </div>
          <div style={{padding:"9px 10px",borderRadius:12,background:S.bg1,border:`1px solid ${S.bd}`}}>
            <div style={{fontSize:11,color:S.t3,fontWeight:800}}>技能</div>
            <div style={{fontSize:13,fontWeight:900,color:S.t1,marginTop:3}}>{cultivationPlan.nextSkill?`${cultivationPlan.nextSkill.skill.emoji} ${cultivationPlan.nextSkill.skill.zh}`:"技能已完整"}</div>
            <div style={{height:6,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${cultivationPlan.nextSkill?Math.min(100,((selectedPet.level||1)/(cultivationPlan.nextSkill.rule.level||1))*100):100}%`,background:adventureSkillVisual.color,borderRadius:999}}/></div>
            <div style={{fontSize:10,color:S.t3,marginTop:4}}>{cultivationPlan.nextSkill?cultivationPlan.nextSkill.rule.label:"可專心提升等級與羈絆"}</div>
          </div>
        </div>
        {!cultivationPlan.daily.comboClaimed&&<div style={{fontSize:11,color:"#856404",background:"#FFF3CD",border:"1px solid #EF9F2744",borderRadius:10,padding:"7px 9px",lineHeight:1.5,marginBottom:9}}>一天完成 3 種不同培養可得額外 XP +30、親密 +10、金幣 +20。</div>}
        {cultivationPlan.daily.comboClaimed&&<div style={{fontSize:11,color:"#0F6E56",background:"#E1F5EE",border:"1px solid #1D9E7544",borderRadius:10,padding:"7px 9px",lineHeight:1.5,marginBottom:9}}>今日培養獎勵已完成，明天可再次累積。</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(92px,1fr))",gap:7}}>
          {cultivationPlan.actions.map(action=><button key={action.key} onClick={()=>runCultivationAction(action)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:12,padding:"9px 8px",fontSize:12,fontWeight:900,color:S.t1,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <span>{action.emoji}</span><span>{action.label}</span>
          </button>)}
        </div>
      </div>

      {careSuggestion&&<div style={{...S.card,padding:"12px 14px",marginBottom:12,border:`1px solid ${readiness.color}55`,background:`linear-gradient(135deg,${readiness.color}12,var(--color-background-primary,#fff))`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{fontSize:24}}>{careSuggestion.emoji}</div>
        <div style={{flex:1,minWidth:180}}>
          <div style={{fontSize:13,fontWeight:900,color:readiness.color}}>冒險狀態：{readiness.label} · {readiness.avg}/100</div>
          <div style={{fontSize:11,color:S.t2,lineHeight:1.5,marginTop:2}}>{careSuggestion.reason}</div>
        </div>
        <button onClick={startSuggestedCare} style={{...S.btn,background:readiness.color,color:"#fff",fontSize:12,padding:"9px 12px"}}>{careSuggestion.label}</button>
      </div>}

      {/* Status bars (P1-2 液體感狀態條) */}
      <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
        <style>{`
@keyframes statbar_pulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.3)} }
@keyframes statbar_shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
@keyframes statbar_full { 0%,100%{box-shadow:0 0 0 rgba(255,215,0,0)} 50%{box-shadow:0 0 12px rgba(255,215,0,0.7)} }
@keyframes statbar_zzz { 0%{transform:translate(0,0);opacity:0} 30%{opacity:1} 100%{transform:translate(8px,-14px);opacity:0} }
@media (prefers-reduced-motion: reduce) { [data-statbar] *{animation:none !important} }
`}</style>
        <div style={{fontSize:13,fontWeight:600,color:S.t1,marginBottom:10}}>📊 寵物狀態</div>
        {[
          {key:"hunger",label:"🍖 飢餓度",val:selectedPet.hunger||0,color:"#EF9F27",dangerColor:"#E24B4A",icon:"🍖"},
          {key:"clean",label:"✨ 乾淨度",val:selectedPet.clean||0,color:"#4A90E2",dangerColor:"#9CA3AF",icon:"💦"},
          {key:"energy",label:"⚡ 體力",val:selectedPet.energy||0,color:"#1D9E75",dangerColor:"#7B61FF",icon:"⚡"},
          {key:"bond",label:"💖 親密度",val:selectedPet.bond||0,color:"#E91E63",dangerColor:null,icon:"💖"},
        ].map(s=>{
          const pct=Math.round(s.val);
          const isBond=s.key==="bond";
          const displayPct=isBond?Math.min(100,pct):pct;
          const urgent=!isBond&&pct<30;
          const critical=!isBond&&pct<20;
          const full=!isBond&&pct>=100;
          // 漸層色：緊急時偏向 dangerColor
          const barColor=urgent&&s.dangerColor?`linear-gradient(90deg,${s.dangerColor},${s.color})`:`linear-gradient(90deg,${s.color},${s.color}dd,${s.color})`;
          return(<div key={s.key} data-statbar style={{marginBottom:8,position:"relative"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3,alignItems:"center"}}>
              <span style={{color:S.t1,fontWeight:500,display:"flex",alignItems:"center",gap:4}}>
                {s.label}
                {/* 體力低時顯示打瞌睡 */}
                {s.key==="energy"&&pct<30&&!critical&&<span style={{fontSize:10,color:"#7B61FF",animation:"statbar_zzz 1.4s ease-out infinite",display:"inline-block"}}>z</span>}
              </span>
              <span style={{color:critical?"#E24B4A":urgent?"#856404":S.t2,fontWeight:600,display:"flex",alignItems:"center",gap:3}}>
                {pct}{isBond?"":"/100"}
                {critical&&<span style={{animation:"statbar_pulse 0.6s ease-in-out infinite"}}>⚠️</span>}
                {urgent&&!critical&&"⚠️"}
                {full&&<span style={{color:"#FFD700"}}>✨</span>}
              </span>
            </div>
            <div style={{
              height:10,
              background:S.bg2,
              borderRadius:5,
              overflow:"hidden",
              position:"relative",
              boxShadow:critical?"inset 0 0 0 1.5px rgba(226,75,74,0.4)":"inset 0 1px 2px rgba(0,0,0,0.08)",
              animation:full?"statbar_full 1.8s ease-in-out infinite":"none",
            }}>
              <div style={{
                height:"100%",
                width:`${Math.min(100,displayPct)}%`,
                background:barColor,
                borderRadius:5,
                transition:"width .5s cubic-bezier(0.34,1.56,0.64,1), background .3s",
                position:"relative",
                animation:critical?"statbar_pulse 0.8s ease-in-out infinite":"none",
                overflow:"hidden",
              }}>
                {/* 液體流光效果（高於 30 時顯示） */}
                {pct>30&&!isBond&&<div style={{
                  position:"absolute",top:0,left:0,
                  width:"40%",height:"100%",
                  background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)",
                  animation:"statbar_shimmer 2.5s ease-in-out infinite",
                }}/>}
                {/* 親密度條一直閃光 */}
                {isBond&&pct>10&&<div style={{
                  position:"absolute",top:0,left:0,
                  width:"30%",height:"100%",
                  background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)",
                  animation:"statbar_shimmer 3s ease-in-out infinite",
                }}/>}
              </div>
            </div>
          </div>);
        })}
      </div>

      {/* Action buttons */}
      <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:600,color:S.t1,marginBottom:10}}>🎮 互動（每次獲得 🪙 5）</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:8}}>
          {/* Feed — needs food */}
          <button onClick={()=>{if(!suggestedFood){setShopOpen(true)}else{performAction(selectedPet,"feed",suggestedFood.id)}}} style={{...S.btn,background:suggestedFood?"#FFF3CD":S.bg2,color:suggestedFood?"#856404":S.t3,padding:"14px 6px",fontSize:12,display:"flex",flexDirection:"column",gap:2,border:`1px solid ${suggestedFood?"#EF9F27":S.bd}`}}>
            <span style={{fontSize:24}}>🍖</span>
            <span>餵食</span>
            <span style={{fontSize:9,opacity:.7}}>{suggestedFood?`${suggestedFood.word} +${suggestedFood.feed}`:"去商店買"}</span>
          </button>
          <button onClick={()=>performAction(selectedPet,"clean")} style={{...S.btn,background:"#E6F1FB",color:"#185FA5",padding:"14px 6px",fontSize:12,display:"flex",flexDirection:"column",gap:2,border:"1px solid #4A90E2"}}>
            <span style={{fontSize:24}}>🛁</span>
            <span>洗澡</span>
            <span style={{fontSize:9,opacity:.7}}>wash</span>
          </button>
          <button onClick={()=>performAction(selectedPet,"play")} style={{...S.btn,background:"#E1F5EE",color:"#0F6E56",padding:"14px 6px",fontSize:12,display:"flex",flexDirection:"column",gap:2,border:"1px solid #1D9E75"}}>
            <span style={{fontSize:24}}>🎾</span>
            <span>玩耍</span>
            <span style={{fontSize:9,opacity:.7}}>play</span>
          </button>
          <button onClick={()=>performAction(selectedPet,"sleep")} style={{...S.btn,background:"#EDE9FE",color:"#7B61FF",padding:"14px 6px",fontSize:12,display:"flex",flexDirection:"column",gap:2,border:"1px solid #7B61FF"}}>
            <span style={{fontSize:24}}>😴</span>
            <span>睡覺</span>
            <span style={{fontSize:9,opacity:.7}}>sleep</span>
          </button>
          <button onClick={()=>performAction(selectedPet,"study")} style={{...S.btn,background:"#FCEBEB",color:"#E24B4A",padding:"14px 6px",fontSize:12,display:"flex",flexDirection:"column",gap:2,border:"1px solid #E24B4A"}}>
            <span style={{fontSize:24}}>📚</span>
            <span>讀書</span>
            <span style={{fontSize:9,opacity:.7}}>study</span>
          </button>
        </div>
      </div>

      <div style={{...S.card,padding:"14px 16px",marginBottom:12,border:"1px solid #EF9F2744",background:"linear-gradient(135deg,#FFF7D6,var(--color-background-primary,#fff))"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:9}}>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:S.t1}}>重複成長能量</div>
            <div style={{fontSize:11,color:S.t2,marginTop:2}}>抽到或孵到已擁有寵物時，會轉成 XP、親密度與冒險加成。</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:20,fontWeight:1000,color:"#EF9F27"}}>+{duplicateEnergy.dupes}</div>
            <div style={{fontSize:10,color:S.t3,fontWeight:800}}>能量</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
          <div style={{padding:"9px 10px",borderRadius:11,background:S.bg1,border:`1px solid ${S.bd}`}}>
            <div style={{fontSize:11,color:S.t3,fontWeight:800}}>共鳴階段</div>
            <div style={{fontSize:14,fontWeight:1000,color:"#856404",marginTop:3}}>{duplicateEnergy.label}</div>
          </div>
          <div style={{padding:"9px 10px",borderRadius:11,background:S.bg1,border:`1px solid ${S.bd}`}}>
            <div style={{fontSize:11,color:S.t3,fontWeight:800}}>冒險加成</div>
            <div style={{fontSize:14,fontWeight:1000,color:c.cl,marginTop:3}}>戰力 +{duplicateEnergy.adventureBonus}</div>
          </div>
          <div style={{padding:"9px 10px",borderRadius:11,background:S.bg1,border:`1px solid ${S.bd}`}}>
            <div style={{fontSize:11,color:S.t3,fontWeight:800}}>已獲得次數</div>
            <div style={{fontSize:14,fontWeight:1000,color:S.t1,marginTop:3}}>{duplicateEnergy.copies} 次</div>
          </div>
        </div>
        <div style={{marginTop:10}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:S.t3,fontWeight:800,marginBottom:4}}>
            <span>{duplicateEnergy.next?`下一階段需要 ${duplicateEnergy.next} 能量`:"已達最高能量階段"}</span>
            <span>{duplicateEnergy.next?`${duplicateEnergy.dupes}/${duplicateEnergy.next}`:"MAX"}</span>
          </div>
          <div style={{height:7,background:"rgba(0,0,0,.08)",borderRadius:999,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${duplicateEnergy.pct}%`,background:"#EF9F27",borderRadius:999,transition:"width .3s"}}/>
          </div>
        </div>
      </div>

      <div style={{...S.card,padding:"14px 16px",marginBottom:12,border:`1px solid ${adventureSkillVisual.color}44`,background:`linear-gradient(135deg,${adventureSkillVisual.bg},var(--color-background-primary,#fff))`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:S.t1}}>冒險技能</div>
            <div style={{fontSize:11,color:S.t2,marginTop:2}}>照顧、學習與冒險勝利會讓寵物更快解鎖技能。</div>
          </div>
          <button onClick={()=>speak(adventureSkill.words.join(", "))} style={{border:`1px solid ${adventureSkillVisual.color}55`,background:S.bg1,borderRadius:999,padding:"6px 10px",fontSize:11,fontWeight:900,color:adventureSkillVisual.color,cursor:"pointer",fontFamily:"inherit"}}>朗讀技能字</button>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",padding:"10px 11px",borderRadius:12,background:S.bg1,border:`1px solid ${adventureSkillVisual.color}33`,marginBottom:10}}>
          <div style={{fontSize:28}}>{adventureSkill.emoji}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:1000,color:adventureSkillVisual.color}}>{adventureSkill.name} · {adventureSkill.zh}</div>
            <div style={{fontSize:11,color:S.t2,lineHeight:1.5,marginTop:2}}>{adventureSkill.desc}</div>
          </div>
          <div style={{fontSize:12,fontWeight:1000,color:adventureSkillVisual.color}}>Power {adventureSkill.power}</div>
        </div>
        {nextAdventureSkill?<div style={{padding:"9px 10px",borderRadius:12,background:"#FFF3CD",border:"1px solid #EF9F2744",marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:900,color:"#856404"}}>下一個技能：{nextAdventureSkill.skill.emoji} {nextAdventureSkill.skill.zh}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
            <div style={{flex:1,height:7,background:"rgba(0,0,0,.08)",borderRadius:999,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(100,((selectedPet.level||1)/(nextAdventureSkill.rule.level||1))*100)}%`,background:"#EF9F27",borderRadius:999}}/>
            </div>
            <span style={{fontSize:11,color:"#856404",fontWeight:900}}>Lv.{selectedPet.level||1}/{nextAdventureSkill.rule.level}</span>
          </div>
          <div style={{fontSize:11,color:"#856404",marginTop:5,lineHeight:1.5}}>{nextAdventureSkill.rule.learn}</div>
        </div>:<div style={{padding:"9px 10px",borderRadius:12,background:"#E1F5EE",border:"1px solid #1D9E7544",fontSize:12,fontWeight:900,color:"#0F6E56",marginBottom:10}}>已開放目前所有技能，之後可透過冒險勝利繼續累積成長。</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(112px,1fr))",gap:7}}>
          {adventureSkillCards.map(card=>{
            const visual=PET_ADVENTURE_SKILL_VISUALS[card.skill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
            const pct=card.unlocked?100:Math.min(100,((selectedPet.level||1)/(card.rule.level||1))*100);
            return(<div key={card.skill.id} style={{padding:"8px 9px",borderRadius:11,border:`1px solid ${card.unlocked?visual.color:S.bd}`,background:card.unlocked?visual.bg:S.bg2,opacity:card.unlocked?1:.72}}>
              <div style={{fontSize:12,fontWeight:1000,color:card.unlocked?visual.color:S.t3}}>{card.skill.emoji} {card.skill.zh}</div>
              <div style={{fontSize:10,color:S.t3,marginTop:3}}>{card.unlocked?card.source:`Lv.${card.rule.level}`}</div>
              <div style={{height:5,background:"rgba(0,0,0,.08)",borderRadius:999,overflow:"hidden",marginTop:6}}>
                <div style={{height:"100%",width:`${pct}%`,background:card.unlocked?visual.color:S.t3,borderRadius:999}}/>
              </div>
            </div>);
          })}
        </div>
      </div>

      {/* Pet's words */}
      <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:600,color:S.t1,marginBottom:6}}>📚 {petDef.name}的專屬單字</div>
        <div style={{fontSize:11,color:S.t3,marginBottom:8,lineHeight:1.6}}>{petDef.story}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {petDef.words.map((w,i)=>(<div key={i} style={{padding:"6px 12px",background:S.bg2,borderRadius:10,fontSize:13,fontWeight:600,color:S.t1,cursor:"pointer"}} onClick={()=>speak(w)}>
            {w} 🔊
          </div>))}
        </div>
      </div>

      {selectedPet.dupes>0&&<div style={{textAlign:"center",fontSize:11,color:S.t3,marginTop:8}}>🎊 此寵物已獲得 {selectedPet.dupes+1} 次，重複能量會提高冒險表現。</div>}
    </div>);
  }

  // Tab views
  return(<div>
    {hatchAnim&&<HatchAnimation data={hatchAnim} onClose={()=>setHatchAnim(null)}/>}
    <Hdr t="🐾 寵物圖鑑" onBack={onBack} cl={c.cl} extra={<div style={{display:"flex",gap:4}}><button onClick={()=>setSettingsOpen(true)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 10px",fontSize:13,cursor:"pointer",color:S.t2}} title="設定">⚙️</button><button onClick={()=>setShopOpen(true)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",color:S.t2}}>🏪 商店</button></div>}/>
    <style>{`
/* (P2-3) 動畫強度全域控制 */
body.eg-anim-lite [data-action-celebration],
body.eg-anim-lite [data-levelup],
body.eg-anim-lite [data-gacha-ceremony] *:not(div) { animation-duration: 0.6s !important; animation-iteration-count: 1 !important; }
body.eg-anim-lite [data-pet-card] *,
body.eg-anim-lite [data-statbar] * { animation-duration: 4s !important; }
body.eg-anim-off [data-action-celebration],
body.eg-anim-off [data-levelup] { display: none !important; }
body.eg-anim-off [data-gacha-ceremony] *,
body.eg-anim-off [data-pet-card] *,
body.eg-anim-off [data-statbar] * { animation: none !important; transition: none !important; }
body.eg-anim-off [data-pet-card] { animation: none !important; }
`}</style>

    {/* Toast notification (cute, auto-dismiss) */}
    {toast&&<div style={{position:"fixed",bottom:30,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:toast.type==="sleep"?"linear-gradient(135deg,#5C6BC0,#3949AB)":"linear-gradient(135deg,"+c.cl+","+c.ac+")",color:"#fff",padding:"14px 22px",borderRadius:24,fontSize:14,fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,.3)",animation:"toastIn .3s ease-out, toastOut .3s ease-in 2.5s forwards",display:"flex",alignItems:"center",gap:10,maxWidth:"calc(100% - 40px)"}}>
      <style>{`
        @keyframes toastIn{from{transform:translateX(-50%) translateY(60px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
        @keyframes toastOut{to{transform:translateX(-50%) translateY(60px);opacity:0}}
      `}</style>
      <span style={{fontSize:22}}>{toast.icon}</span>
      <span>{toast.msg}</span>
    </div>}

    {/* Custom Confirm Modal (replaces window.confirm) */}
    {confirmModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeUp .25s"}} onClick={()=>setConfirmModal(null)}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--color-background-primary,#fff)",borderRadius:20,padding:"24px 22px",maxWidth:340,width:"100%",textAlign:"center",border:`2px solid ${c.cl}`,boxShadow:`0 12px 32px ${c.cl}33`,animation:"bounceIn .35s ease-out"}}>
        <div style={{fontSize:48,marginBottom:8}}>{confirmModal.icon}</div>
        <div style={{fontSize:14,color:S.t1,lineHeight:1.7,marginBottom:20,whiteSpace:"pre-line"}}>{confirmModal.msg}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <button onClick={()=>setConfirmModal(null)} style={{...S.btn,background:S.bg2,color:S.t1,padding:"12px",fontSize:13}}>取消</button>
          <button onClick={()=>{const fn=confirmModal.onConfirm;setConfirmModal(null);fn&&fn()}} style={{...S.btn,background:c.cl,color:"#fff",padding:"12px",fontSize:13}}>確定</button>
        </div>
      </div>
    </div>}
    {/* Account bar */}
    {petAccount&&<div style={{...S.card,padding:"8px 14px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",background:`${c.cl}08`}}>
      <div style={{fontSize:12,color:S.t2}}>👤 <b style={{color:c.cl}}>{petAccount.username}</b> <span style={{color:S.t3,marginLeft:4}}>· 已同步雲端 ☁️</span></div>
      <button onClick={()=>setConfirmModal({msg:"登出帳號？\n\n本地寵物資料將保留，但不會再同步到雲端。",icon:"👋",onConfirm:()=>setPetAccount(null)})} style={{background:"none",border:"none",fontSize:11,color:S.t3,cursor:"pointer",padding:"4px 8px",textDecoration:"underline"}}>登出</button>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:12}}>
      <button onClick={()=>setTab("dex")} style={{...S.card,padding:"12px",textAlign:"left",cursor:"pointer",fontFamily:"inherit",background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
        <div style={{fontSize:11,color:S.t2,fontWeight:800}}>收藏完成度</div>
        <div style={{fontSize:20,fontWeight:900,color:c.cl,marginTop:2}}>{ownedIds.size}/{totalPetKinds}</div>
        <div style={{height:6,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${Math.round(ownedIds.size/totalPetKinds*100)}%`,background:c.cl,borderRadius:999}}/></div>
      </button>
      <button onClick={()=>setTab("eggs")} style={{...S.card,padding:"12px",textAlign:"left",cursor:"pointer",fontFamily:"inherit",background:S.bg1}}>
        <div style={{fontSize:11,color:S.t2,fontWeight:800}}>蛋倉</div>
        <div style={{fontSize:20,fontWeight:900,color:S.t1,marginTop:2}}>🥚 {eggs.length}</div>
        <div style={{fontSize:11,color:readyEggCount?c.cl:S.t3,fontWeight:800,marginTop:3}}>{readyEggCount?`${readyEggCount} 顆可孵化`:collectionStats.eggOnlyCount?`${collectionStats.eggOnlyCount} 種新寵物蛋中`:"完成學習來孵蛋"}</div>
      </button>
      <button onClick={()=>setTab("pets")} style={{...S.card,padding:"12px",textAlign:"left",cursor:"pointer",fontFamily:"inherit",background:S.bg1,border:careNeedCount?`1px solid #EF9F27`:`1px solid ${S.bd}`}}>
        <div style={{fontSize:11,color:S.t2,fontWeight:800}}>照顧提醒</div>
        <div style={{fontSize:20,fontWeight:900,color:careNeedCount?"#EF9F27":S.t1,marginTop:2}}>{careNeedCount}</div>
        <div style={{fontSize:11,color:S.t3,fontWeight:800,marginTop:3}}>最高羈絆 {bestBond}</div>
      </button>
      <button onClick={()=>setTab("pets")} style={{...S.card,padding:"12px",textAlign:"left",cursor:"pointer",fontFamily:"inherit",background:"linear-gradient(135deg,#FFF3CD,var(--color-background-primary,#fff))",border:"1px solid #EF9F2744"}}>
        <div style={{fontSize:11,color:"#856404",fontWeight:800}}>重複能量</div>
        <div style={{fontSize:20,fontWeight:900,color:"#EF9F27",marginTop:2}}>✨ {collectionStats.dupeTotal}</div>
        <div style={{fontSize:11,color:"#856404",fontWeight:800,marginTop:3}}>{collectionStats.resonanceLeader?`最高 ${getDuplicateEnergyInfo(collectionStats.resonanceLeader).label}`:"抽到重複會成長"}</div>
      </button>
    </div>
    <div style={{...S.card,padding:"11px 14px",marginBottom:12,border:`1px solid ${collectionStats.closestEgg?.egg?.progress>=collectionStats.closestEgg?.needed?c.cl:S.bd}`,background:collectionStats.closestEgg?"linear-gradient(135deg,#F7FBFF,var(--color-background-primary,#fff))":S.bg1,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{fontSize:24}}>{readyEggCount?"🎉":collectionStats.closestEgg?"🥚":"📖"}</div>
      <div style={{flex:1,minWidth:190}}>
        <div style={{fontSize:12,fontWeight:900,color:S.t1}}>下一步建議</div>
        <div style={{fontSize:11,color:S.t2,lineHeight:1.5,marginTop:2}}>
          {readyEggCount?`有 ${readyEggCount} 顆蛋可以孵化，先去蛋倉看看。`:collectionStats.closestEgg?`${collectionStats.closestEgg.def.name} 蛋最接近孵化，還差 ${collectionStats.closestEgg.left} 題英文。`:collectionStats.missingCount?`圖鑑還缺 ${collectionStats.missingCount} 種寵物，可以透過扭蛋與冒險獎勵慢慢收集。`:"圖鑑已收齊，接下來可以培養親密度與重複能量。"}
        </div>
      </div>
      <button onClick={()=>setTab(readyEggCount||collectionStats.closestEgg?"eggs":"dex")} style={{...S.btn,background:c.cl,color:"#fff",fontSize:12,padding:"9px 12px"}}>{readyEggCount||collectionStats.closestEgg?"去蛋倉":"看圖鑑"}</button>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto"}}>
      <button onClick={()=>setTab("tasks")} style={{flex:"1 1 auto",padding:"10px 6px",borderRadius:12,background:tab==="tasks"?c.cl:S.bg2,color:tab==="tasks"?"#fff":S.t1,border:tab==="tasks"?"none":`1px solid ${S.bd}`,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>📋 任務 ({DAILY_TASK_DEFS.filter(t=>!claimedToday.includes(t.id)&&(taskCounts[t.statKey]||0)>=t.target).length})</button>
      <button onClick={()=>setTab("eggs")} style={{flex:"1 1 auto",padding:"10px 6px",borderRadius:12,background:tab==="eggs"?c.cl:S.bg2,color:tab==="eggs"?"#fff":S.t1,border:tab==="eggs"?"none":`1px solid ${S.bd}`,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>🥚 蛋 ({eggs.length})</button>
      <button onClick={()=>setTab("pets")} style={{flex:"1 1 auto",padding:"10px 6px",borderRadius:12,background:tab==="pets"?c.cl:S.bg2,color:tab==="pets"?"#fff":S.t1,border:tab==="pets"?"none":`1px solid ${S.bd}`,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>🐾 寵物 ({pets.length})</button>
      <button onClick={()=>setTab("dex")} style={{flex:"1 1 auto",padding:"10px 6px",borderRadius:12,background:tab==="dex"?c.cl:S.bg2,color:tab==="dex"?"#fff":S.t1,border:tab==="dex"?"none":`1px solid ${S.bd}`,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>📖 圖鑑</button>
    </div>

    {tab==="tasks"?(<div>
      {/* Daily tasks intro */}
      <div style={{...S.card,padding:"14px 16px",marginBottom:12,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
        <div style={{fontSize:14,fontWeight:700,color:S.t1,marginBottom:4}}>📋 每日英文任務</div>
        <div style={{fontSize:12,color:S.t2,lineHeight:1.7}}>
          完成任務拿獎勵！獎勵會給你最親密的寵物。<br/>
          {pets.length>0&&Math.max(...pets.map(p=>p.bond||0))>=150&&<span style={{color:"#1D9E75",fontWeight:600}}>💖 親密寵物加成：獎勵 +20%</span>}
        </div>
        <div style={{marginTop:8,display:"flex",gap:4,alignItems:"center",fontSize:11,color:S.t3}}>
          <span>📅 {today}</span>
          <span style={{marginLeft:"auto"}}>已完成 {claimedToday.length}/{DAILY_TASK_DEFS.length}</span>
        </div>
      </div>

      {/* Task list */}
      <div style={{display:"grid",gap:10}}>
        {DAILY_TASK_DEFS.map(task=>{
          const count=taskCounts[task.statKey]||0;
          const done=count>=task.target;
          const claimed=claimedToday.includes(task.id);
          const pct=Math.min(100,(count/task.target)*100);
          return(<div key={task.id} style={{...S.card,padding:"14px 16px",border:claimed?`2px solid ${S.bd}`:done?`2px solid #1D9E75`:`1px solid ${S.bd}`,opacity:claimed?.6:1,transition:"all .2s"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:32,opacity:claimed?.5:1}}>{task.icon}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14,fontWeight:600,color:S.t1}}>{task.name}</span>
                  {claimed&&<span style={{fontSize:11,color:"#1D9E75",fontWeight:700}}>✓ 已領取</span>}
                </div>
                <div style={{fontSize:11,color:S.t3,marginTop:2}}>{task.desc}</div>
                {/* Progress bar */}
                <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
                  <div style={{flex:1,height:6,background:S.bg2,borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:done?`linear-gradient(90deg,#1D9E75,${c.ac})`:c.cl,transition:"width .3s"}}/>
                  </div>
                  <span style={{fontSize:11,color:S.t2,fontWeight:600,minWidth:40,textAlign:"right"}}>{count}/{task.target}</span>
                </div>
                <div style={{fontSize:11,color:S.t3,marginTop:4}}>獎勵：🪙 {task.reward.coins} · ⭐ {task.reward.exp} Exp</div>
              </div>
              {done&&!claimed&&<button onClick={(e)=>claimTask(task,e)} style={{...S.btn,background:`linear-gradient(135deg,#1D9E75,${c.ac})`,color:"#fff",padding:"10px 14px",fontSize:13,animation:"emojiPulse 1.2s infinite"}}>🎁 領取</button>}
            </div>
          </div>);
        })}
      </div>

      {/* Bond rewards showcase */}
      {pets.length>0&&<div style={{...S.card,padding:"14px 16px",marginTop:12}}>
        <div style={{fontSize:13,fontWeight:600,color:S.t1,marginBottom:8}}>💖 羈絆等級（最高親密度寵物）</div>
        {(()=>{const maxBond=Math.max(0,...pets.map(p=>p.bond||0));const curLevel=getBondLevel(maxBond);return(<>
          <div style={{fontSize:11,color:S.t2,marginBottom:6}}>目前：💖 {maxBond} / 下一級 {curLevel<BOND_MILESTONES.length?BOND_MILESTONES[curLevel].bond:"MAX"}</div>
          <div style={{display:"grid",gap:4}}>
            {BOND_MILESTONES.map((m,i)=>{const unlocked=maxBond>=m.bond;return(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:8,background:unlocked?`${m.color}22`:S.bg2,border:unlocked?`1px solid ${m.color}`:`1px solid ${S.bd}`,opacity:unlocked?1:.5}}>
              <span style={{fontSize:18}}>{m.icon}</span>
              <span style={{flex:1,fontSize:12,fontWeight:600,color:S.t1}}>{m.title}</span>
              <span style={{fontSize:11,color:S.t2}}>{m.bond}</span>
              {unlocked&&<span style={{fontSize:10,color:m.color,fontWeight:700}}>✓</span>}
            </div>)})}
          </div>
        </>)})()}
      </div>}
    </div>):tab==="eggs"?(eggs.length===0?(<div style={{textAlign:"center",padding:"48px 16px"}}>
      <div style={{fontSize:48,marginBottom:8}}>🥚</div>
      <div style={{fontSize:16,fontWeight:600,color:S.t1}}>還沒有蛋！</div>
      <div style={{fontSize:13,color:S.t2,marginTop:4}}>去扭蛋機抽一顆吧！</div>
    </div>):(
    <>
    <div style={{...S.card,padding:"10px 12px",marginBottom:10,display:"flex",gap:8,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
      <div style={{fontSize:12,color:S.t2,fontWeight:800}}>蛋倉排序</div>
      <div style={{display:"flex",gap:5}}>
        {[{k:"ready",l:"可孵化優先"},{k:"rarity",l:"稀有度"},{k:"new",l:"最新"}].map(o=><button key={o.k} onClick={()=>setEggSort(o.k)} style={{border:`1px solid ${eggSort===o.k?c.cl:S.bd}`,background:eggSort===o.k?c.bg:S.bg1,color:eggSort===o.k?c.cl:S.t2,borderRadius:999,padding:"6px 9px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{o.l}</button>)}
      </div>
    </div>
    {duplicateEggIssueCount>0&&<div style={{...S.card,padding:"12px",marginBottom:10,border:"1px solid #EF9F27",background:"#FFF3CD",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:180}}><div style={{fontSize:13,fontWeight:900,color:"#856404"}}>偵測到 {duplicateEggIssueCount} 顆重複蛋</div><div style={{fontSize:11,color:"#856404",marginTop:2}}>重複蛋可融合成孵化進度；已擁有寵物的蛋會轉成 XP 與親密度。</div></div>
      <button onClick={mergeDuplicateEggs} style={{...S.btn,background:"#EF9F27",color:"#fff",padding:"9px 12px",fontSize:12}}>整理重複蛋</button>
    </div>}
    <div style={{display:"grid",gap:10}}>
      {visibleEggs.map(({egg})=>{
        const petDef=PETS[egg.rarity].find(p=>p.id===egg.petId);
        if(!petDef)return null;
        const ri=RARITY_INFO[egg.rarity];
        const needed=EGG_HATCH_TASKS[egg.rarity];
        const ready=egg.progress>=needed;
        const ownedAlready=ownedIds.has(egg.petId);
        const duplicateReward=getDuplicatePetReward(egg.rarity);
        return(<div key={egg.id} style={{...S.card,padding:"16px",border:`2px solid ${ri.color}`,background:ready?`linear-gradient(135deg,${ri.bg},var(--color-background-primary,#fff))`:"var(--color-background-primary,#fff)"}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",animation:ready?"emojiBounce 1s infinite":"none"}}><PixelPet petId={egg.petId} stage="egg" size={56}/></div>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:10,fontWeight:700,color:ri.color,background:ri.bg,padding:"2px 8px",borderRadius:10}}>{ri.stars} {ri.label}</span>
                <span style={{fontSize:10,fontWeight:900,color:ownedAlready?"#856404":"#0F6E56",background:ownedAlready?"#FFF3CD":"#E1F5EE",border:`1px solid ${ownedAlready?"#EF9F2744":"#1D9E7544"}`,padding:"2px 7px",borderRadius:999}}>{ownedAlready?"已擁有 · 轉能量":"新寵物蛋"}</span>
              </div>
              <div style={{fontSize:15,fontWeight:700,color:S.t1,marginTop:4}}>{petDef.name} 蛋</div>
              <div style={{fontSize:11,color:S.t3,fontStyle:"italic"}}>{petDef.story}</div>
              {ownedAlready&&<div style={{fontSize:11,color:"#856404",fontWeight:800,marginTop:4}}>孵化後轉成 XP +{duplicateReward.exp}、親密 +{duplicateReward.bond}、能量 +1</div>}
              <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
                <div style={{flex:1,height:8,background:S.bg2,borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,(egg.progress/needed)*100)}%`,background:`linear-gradient(90deg,${ri.color},${c.ac})`,transition:"width .3s"}}/>
                </div>
                <span style={{fontSize:11,color:S.t2,fontWeight:600,minWidth:48,textAlign:"right"}}>{egg.progress}/{needed}</span>
              </div>
            </div>
          </div>
          {ready&&<button onClick={()=>hatchEgg(egg)} style={{...S.btn,background:`linear-gradient(135deg,${ri.color},${c.ac})`,color:"#fff",width:"100%",marginTop:12,padding:"12px",fontSize:15,animation:"emojiPulse 1s infinite"}}>{ownedAlready?"✨ 孵化轉成長能量":"🎉 可以孵化了！點我"}</button>}
          {!ready&&<div style={{marginTop:10,fontSize:12,color:S.t3,textAlign:"center"}}>{ownedAlready?"✨ 可先用「整理重複蛋」轉成能量":"💪 再答對 "+(needed-egg.progress)+" 題就能孵化！"}</div>}
        </div>);
      })}
    </div>
    </>)):tab==="pets"?(
    pets.length===0?(<div style={{textAlign:"center",padding:"48px 16px"}}>
      <div style={{fontSize:48,marginBottom:8}}>🐣</div>
      <div style={{fontSize:16,fontWeight:600,color:S.t1}}>還沒有寵物！</div>
      <div style={{fontSize:13,color:S.t2,marginTop:4}}>先去扭蛋機獲得蛋，然後學習孵化吧！</div>
    </div>):(
    <>
    <style>{`
@keyframes pet_urgentRing { 0%,100%{box-shadow:0 0 0 0 rgba(226,75,74,.55)} 50%{box-shadow:0 0 0 6px rgba(226,75,74,0)} }
@keyframes pet_moodBob { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-3px) rotate(4deg)} }
@keyframes pet_sleepZ { 0%{transform:translate(0,0) scale(.8);opacity:0} 20%{opacity:.9} 100%{transform:translate(10px,-18px) scale(1.3);opacity:0} }
@keyframes pet_badgePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
@keyframes pet_breatheHappy { 0%,100%{transform:scaleY(1) translateY(0)} 50%{transform:scaleY(1.04) translateY(-2px)} }
@keyframes pet_breatheTired { 0%,100%{transform:scaleY(1) translateY(0)} 50%{transform:scaleY(0.97) translateY(1px)} }
@keyframes pet_breatheUrgent { 0%,100%{transform:translateX(0) scaleY(1)} 25%{transform:translateX(-1px) scaleY(0.98)} 75%{transform:translateX(1px) scaleY(0.98)} }
@keyframes pet_breatheSleep { 0%,100%{transform:scaleY(1) translateY(0)} 50%{transform:scaleY(1.06) translateY(-1px)} }
@media (prefers-reduced-motion: reduce) { [data-pet-card] *{animation:none !important} }
`}</style>
    {(quickCarePlan.total>0||quickCarePlan.needsFood>0)&&<div style={{...S.card,padding:"12px 14px",marginBottom:10,border:"1px solid #EF9F27",background:"linear-gradient(135deg,#FFF3CD,var(--color-background-primary,#fff))",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{fontSize:25}}>🧺</div>
      <div style={{flex:1,minWidth:190}}>
        <div style={{fontSize:13,fontWeight:900,color:"#856404"}}>照顧提醒</div>
        <div style={{fontSize:11,color:"#856404",lineHeight:1.5,marginTop:2}}>可快速處理：餵食 {quickCarePlan.feed}、清潔 {quickCarePlan.clean}、休息 {quickCarePlan.sleep}{quickCarePlan.needsFood?`；另有 ${quickCarePlan.needsFood} 隻缺食物`:""}。</div>
      </div>
      <button onClick={quickCareAll} style={{...S.btn,background:"#EF9F27",color:"#fff",fontSize:12,padding:"9px 12px"}}>{quickCarePlan.total>0?"一鍵照顧":"去補食物"}</button>
    </div>}
    <div style={{...S.card,padding:"12px",marginBottom:10,display:"grid",gap:8}}>
      <input value={petQuery} onChange={e=>setPetQuery(e.target.value)} placeholder="搜尋寵物、單字、故事..." style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:10,border:`1px solid ${S.bd}`,background:S.bg1,color:S.t1,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
        {[{k:"all",l:"全部"},{k:"N",l:"普通"},{k:"R",l:"稀有"},{k:"SR",l:"超稀有"},{k:"SSR",l:"極稀有"}].map(o=><button key={o.k} onClick={()=>setPetRarity(o.k)} style={{flexShrink:0,border:`1px solid ${petRarity===o.k?c.cl:S.bd}`,background:petRarity===o.k?c.bg:S.bg1,color:petRarity===o.k?c.cl:S.t2,borderRadius:999,padding:"6px 10px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{o.l}</button>)}
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
        <div style={{fontSize:11,color:S.t3,fontWeight:800}}>顯示 {visiblePets.length}/{pets.length} 隻</div>
        <select value={petSort} onChange={e=>setPetSort(e.target.value)} style={{padding:"7px 10px",borderRadius:9,border:`1px solid ${S.bd}`,background:S.bg1,color:S.t1,fontSize:12,fontFamily:"inherit",fontWeight:700}}>
          <option value="need">最需要照顧</option>
          <option value="level">等級高到低</option>
          <option value="bond">親密度高到低</option>
          <option value="rarity">稀有度高到低</option>
          <option value="new">取得順序</option>
        </select>
      </div>
    </div>
    {/* (P3-1) 玩耍場入口（多隻寵物時才顯示） */}
    {pets.length>=2&&<button onClick={()=>setPlaygroundOpen(true)} style={{
      width:"100%",
      padding:"14px 16px",
      marginBottom:12,
      background:`linear-gradient(135deg,#FFE0F0,#FFD1DC,#E1BEE7)`,
      border:"2px solid #E91E63",
      borderRadius:14,
      cursor:"pointer",
      fontFamily:"inherit",
      display:"flex",alignItems:"center",justifyContent:"center",gap:10,
      boxShadow:"0 3px 10px rgba(233,30,99,0.2)",
      transition:"transform .15s",
    }} onTouchStart={e=>e.currentTarget.style.transform="scale(0.97)"} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
      <span style={{fontSize:24}}>🎪</span>
      <div style={{textAlign:"left",flex:1}}>
        <div style={{fontSize:14,fontWeight:700,color:"#C2185B"}}>一起玩耍場</div>
        <div style={{fontSize:11,color:"#AD1457",marginTop:2}}>完成英文小任務，再讓兩隻寵物一起玩並拿獎勵。</div>
      </div>
      <span style={{fontSize:18,color:"#C2185B"}}>→</span>
    </button>}
    {visiblePets.length===0&&<div style={{...S.card,padding:"26px 16px",textAlign:"center",fontSize:13,color:S.t2,marginBottom:10}}>找不到符合條件的寵物。</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10}}>
      {visiblePets.map(({pet,def:petDef},i)=>{
        if(!petDef)return null;
        const ri=RARITY_INFO[pet.rarity];
        const need=getPetUrgentNeed(pet);
        const careCount=getCareCount(pet);
        const sleeping=isPetSleeping();
        const stats=[
          {v:pet.hunger??80,c:"#EF9F27"},
          {v:pet.clean??80,c:"#4A90E2"},
          {v:pet.energy??80,c:"#1D9E75"},
          {v:Math.min(100,(pet.bond||0)/3),c:"#E91E63"},
        ];
        const isUrgent=need.urgency===2;
        const duplicateInfo=getDuplicateEnergyInfo(pet);
        return(
        <div key={i} data-pet-card onClick={()=>{setSelectedPet(pet);triggerEvent(pet)}}
          style={{
            ...S.card,
            padding:"10px 8px 8px",
            textAlign:"center",
            border:`2px solid ${isUrgent?"#E24B4A":need.urgency===1?"#EF9F27":ri.color}`,
            background:ri.bg,
            cursor:"pointer",
            transition:"transform .15s",
            position:"relative",
            overflow:"hidden",
            animation:isUrgent?"pet_urgentRing 1.4s ease-in-out infinite":"none",
            boxShadow:duplicateInfo.dupes>0?`0 6px 18px rgba(239,159,39,${Math.min(.32,.12+duplicateInfo.dupes*.025)})`:undefined,
          }}
          onTouchStart={e=>e.currentTarget.style.transform="scale(0.95)"}
          onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}
        >
          {/* 心情氣泡 - 左上 */}
          <div style={{
            position:"absolute",top:6,left:6,
            background:"#fff",borderRadius:14,
            padding:"2px 7px 2px 5px",
            fontSize:11,fontWeight:600,
            color:isUrgent?"#E24B4A":need.urgency===1?"#856404":"#5F5E5A",
            boxShadow:"0 1px 3px rgba(0,0,0,.12)",
            display:"flex",alignItems:"center",gap:3,
            zIndex:3,
            animation:need.urgency>0?"pet_moodBob 1.6s ease-in-out infinite":"none",
          }}>
            <span style={{fontSize:13}}>{need.emoji}</span>
            <span style={{fontSize:9,letterSpacing:.5}}>{need.label}</span>
          </div>

          {/* 待辦徽章 - 右上 */}
          {careCount>0&&<div style={{
            position:"absolute",top:-6,right:-6,
            background:"#E24B4A",color:"#fff",
            borderRadius:"50%",width:24,height:24,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,fontWeight:700,
            boxShadow:"0 2px 6px rgba(226,75,74,.4)",
            animation:"pet_badgePulse 1s ease-in-out infinite",
            zIndex:4,
          }}>{careCount}</div>}

          {/* 稀有度星星 */}
          <div style={{fontSize:10,fontWeight:700,color:ri.color,marginTop:14}}>{ri.stars}</div>

          {/* 寵物本體（依心情切換動畫節奏） (P1-1) */}
          <div style={{
            margin:"4px auto",
            display:"flex",justifyContent:"center",
            position:"relative",
            animation:sleeping?"pet_breatheSleep 4s ease-in-out infinite":(isUrgent?"pet_breatheUrgent 0.8s ease-in-out infinite":(need.urgency===1?"pet_breatheTired 3.5s ease-in-out infinite":"pet_breatheHappy 2.4s ease-in-out infinite")),
            animationDelay:`${i*0.2}s`,
            opacity:sleeping?0.65:1,
            filter:sleeping?"saturate(0.7)":"none",
            transition:"opacity .3s, filter .3s",
          }}>
            <PixelPet petId={petDef.id} stage={getPetStage(pet)} size={56} animate={false}/>
            {sleeping&&<>
              <span style={{position:"absolute",top:-4,right:8,fontSize:11,color:"#7B61FF",fontWeight:700,animation:"pet_sleepZ 2s ease-out infinite"}}>z</span>
              <span style={{position:"absolute",top:-4,right:8,fontSize:11,color:"#7B61FF",fontWeight:700,animation:"pet_sleepZ 2s ease-out infinite",animationDelay:"0.7s"}}>Z</span>
            </>}
          </div>

          {/* 寵物名稱 */}
          <div style={{fontSize:12,fontWeight:600,color:S.t1}}>{petDef.name}</div>

          {/* 等級 */}
          <div style={{fontSize:10,color:c.cl,fontWeight:600,marginBottom:6}}>Lv.{pet.level}</div>

          {/* 重複成長能量 */}
          {duplicateInfo.dupes>0&&<div style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:9,color:"#856404",background:"#FFF3CD",border:"1px solid #EF9F2744",borderRadius:999,padding:"2px 6px",marginTop:-4,marginBottom:5,fontWeight:900}}>
            <span>✨</span><span>能量 +{duplicateInfo.dupes}</span>
          </div>}

          {/* 4 條微狀態條 - 卡片底部 */}
          <div style={{display:"flex",gap:2,padding:"0 2px"}}>
            {stats.map((s,si)=>(
              <div key={si} style={{flex:1,height:3,background:"rgba(0,0,0,.08)",borderRadius:2,overflow:"hidden"}}>
                <div style={{
                  height:"100%",
                  width:`${Math.max(4,Math.min(100,s.v))}%`,
                  background:s.c,
                  transition:"width .4s",
                  animation:s.v<20?"pet_badgePulse 1s ease-in-out infinite":"none",
                }}/>
              </div>
            ))}
          </div>
        </div>);
      })}
    </div>
    </>)):tab==="dex"?(
    <div>
      {(()=>{
        // 計算總完成度
        const allRarities=["N","R","SR","SSR"];
        const totalAll=allRarities.reduce((a,r)=>a+PETS[r].length,0);
        const gotAll=allRarities.reduce((a,r)=>a+pets.filter(p=>p.rarity===r).length,0);
        const allPct=Math.round((gotAll/totalAll)*100);
        return(<>
          {/* 總進度卡 */}
          <div style={{...S.card,padding:"16px 18px",marginBottom:12,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`,border:`2px solid ${c.cl}`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:14,fontWeight:700,color:S.t1}}>📖 圖鑑完成度</div>
              <div style={{fontSize:18,fontWeight:700,color:c.cl}}>{gotAll}/{totalAll}</div>
            </div>
            <div style={{height:10,background:S.bg2,borderRadius:5,overflow:"hidden",marginBottom:6}}>
              <div style={{height:"100%",width:`${allPct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,transition:"width .5s",borderRadius:5,boxShadow:`0 0 8px ${c.cl}66`}}/>
            </div>
            <div style={{fontSize:11,color:S.t3,textAlign:"center"}}>
              {allPct===100?"🏆 大師！全部寵物都收齊了！":allPct>=75?"✨ 快收齊了！繼續加油！":allPct>=50?"🌱 收藏一半囉！":"💪 繼續抽蛋探索吧！"}
            </div>
          </div>
          <div style={{...S.card,padding:"12px",marginBottom:12,display:"grid",gap:8}}>
            <input value={dexQuery} onChange={e=>setDexQuery(e.target.value)} placeholder="搜尋圖鑑：名稱、英文單字、故事..." style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:10,border:`1px solid ${S.bd}`,background:S.bg1,color:S.t1,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
              {[{k:"all",l:"全部"},{k:"owned",l:"已收集"},{k:"missing",l:"未收集"}].map(o=><button key={o.k} onClick={()=>setDexMode(o.k)} style={{flexShrink:0,border:`1px solid ${dexMode===o.k?c.cl:S.bd}`,background:dexMode===o.k?c.bg:S.bg1,color:dexMode===o.k?c.cl:S.t2,borderRadius:999,padding:"6px 10px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{o.l}</button>)}
              <span style={{width:1,background:S.bd,margin:"2px 2px",flexShrink:0}}/>
              {[{k:"all",l:"全部稀有度"},{k:"N",l:"普通"},{k:"R",l:"稀有"},{k:"SR",l:"超稀有"},{k:"SSR",l:"極稀有"}].map(o=><button key={o.k} onClick={()=>setDexRarity(o.k)} style={{flexShrink:0,border:`1px solid ${dexRarity===o.k?c.cl:S.bd}`,background:dexRarity===o.k?c.bg:S.bg1,color:dexRarity===o.k?c.cl:S.t2,borderRadius:999,padding:"6px 10px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{o.l}</button>)}
            </div>
          </div>

          {/* 各稀有度區塊 */}
          {allRarities.map(rarity=>{
            if(dexRarity!=="all"&&dexRarity!==rarity)return null;
            const ri=RARITY_INFO[rarity];
            const list=PETS[rarity];
            const got=list.filter(petDef=>pets.some(p=>p.petId===petDef.id));
            const pct=Math.round((got.length/list.length)*100);
            const q=dexQuery.trim().toLowerCase();
            const filteredList=list.filter(petDef=>{
              const owned=pets.some(p=>p.petId===petDef.id);
              if(dexMode==="owned"&&!owned)return false;
              if(dexMode==="missing"&&owned)return false;
              if(!q)return true;
              return [petDef.name,petDef.id,petDef.story,...(petDef.words||[])].some(v=>String(v||"").toLowerCase().includes(q));
            });
            if(filteredList.length===0)return null;
            return(<div key={rarity} style={{...S.card,padding:"14px 16px",marginBottom:12,background:ri.bg,border:`2px solid ${ri.color}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:ri.color}}>{ri.stars} {ri.label}</div>
                  <div style={{fontSize:10,color:S.t3,marginTop:1}}>機率 {ri.rate}%</div>
                </div>
                <div style={{fontSize:14,fontWeight:700,color:ri.color}}>{got.length}/{list.length}</div>
              </div>
              <div style={{height:6,background:"rgba(255,255,255,0.6)",borderRadius:3,overflow:"hidden",marginBottom:10}}>
                <div style={{height:"100%",width:`${pct}%`,background:ri.color,transition:"width .5s",borderRadius:3}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(92px,1fr))",gap:7}}>
                {filteredList.map(petDef=>{
                  const myPet=pets.find(p=>p.petId===petDef.id);
                  const owned=!!myPet;
                  const eggForPet=eggs.filter(e=>e.petId===petDef.id).sort((a,b)=>(b.progress||0)-(a.progress||0))[0];
                  const eggOwned=!!eggForPet;
                  const eggNeeded=eggForPet?(EGG_HATCH_TASKS[eggForPet.rarity]||1):1;
                  const duplicateInfo=owned?getDuplicateEnergyInfo(myPet):null;
                  return(<div key={petDef.id}
                    onClick={()=>{if(owned){setSelectedPet(myPet);triggerEvent(myPet)}else if(eggOwned){setTab("eggs")}}}
                    style={{
                      background:owned?"rgba(255,255,255,0.9)":eggOwned?"#FFF9E6":"rgba(0,0,0,0.06)",
                      borderRadius:10,
                      padding:"8px 5px",
                      textAlign:"center",
                      cursor:(owned||eggOwned)?"pointer":"default",
                      position:"relative",
                      transition:"transform .15s",
                      border:owned?`1.5px solid ${ri.color}`:eggOwned?"1.5px solid #EF9F27":"1.5px dashed rgba(0,0,0,0.15)",
                    }}
                    onTouchStart={e=>{if(owned||eggOwned)e.currentTarget.style.transform="scale(0.95)"}}
                    onTouchEnd={e=>{if(owned||eggOwned)e.currentTarget.style.transform="scale(1)"}}
                  >
                    <div style={{position:"absolute",top:5,right:5,fontSize:8,fontWeight:900,color:owned?ri.color:eggOwned?"#856404":S.t3,background:owned?ri.bg:eggOwned?"#FFF3CD":"rgba(255,255,255,.75)",borderRadius:999,padding:"1px 5px"}}>
                      {owned?"已收集":eggOwned?"蛋中":"未遇見"}
                    </div>
                    <div style={{
                      display:"flex",justifyContent:"center",margin:"12px auto 2px",
                      filter:(owned||eggOwned)?"none":"brightness(0.15) saturate(0)",
                      opacity:owned?1:eggOwned?0.95:0.4,
                    }}>
                      <PixelPet petId={petDef.id} stage={owned?getPetStage(myPet):(eggOwned?"egg":"adult")} size={42} animate={false}/>
                    </div>
                    {!owned&&!eggOwned&&<div style={{
                      position:"absolute",top:"50%",left:"50%",
                      transform:"translate(-50%,-30%)",
                      fontSize:18,fontWeight:700,
                      color:"rgba(0,0,0,0.45)",
                      pointerEvents:"none",
                    }}>?</div>}
                    <div style={{fontSize:10,fontWeight:600,color:(owned||eggOwned)?S.t1:S.t3,marginTop:2}}>
                      {owned||eggOwned?petDef.name:"???"}
                    </div>
                    {owned&&<div style={{fontSize:8,color:c.cl,fontWeight:600}}>Lv.{myPet.level||1}</div>}
                    {owned&&duplicateInfo.dupes>0&&<div style={{fontSize:8,color:"#856404",fontWeight:900,marginTop:1}}>能量 +{duplicateInfo.dupes}</div>}
                    {!owned&&eggOwned&&<div style={{fontSize:8,color:"#856404",fontWeight:900,marginTop:1}}>孵化 {eggForPet.progress||0}/{eggNeeded}</div>}
                  </div>);
                })}
              </div>
            </div>);
          })}

          <div style={{...S.card,padding:"12px 16px",marginTop:8,background:S.bg2,fontSize:11,color:S.t3,textAlign:"center",lineHeight:1.7}}>
            💡 在「🎰 扭蛋機」抽蛋來收集更多寵物！<br/>
            稀有度越高越難遇到，但也越特別 ✨
          </div>
        </>);
      })()}
    </div>
    ):null}
  </div>);
}

// ═══ SPONSOR PAGE (支持頁面 - 銀行轉帳與留言) ══════════════════════

export function PetAdventurePage(props){
  return <PetAdventurePageInner {...propsWithoutDeps(props)}/>;
}
export function GachaPage(props){
  return <GachaPageInner {...propsWithoutDeps(props)}/>;
}
export function PetsGuard(props){
  return <PetsGuardInner {...propsWithoutDeps(props)}/>;
}
