import { useEffect, useRef, useState } from "react";
import PetSanctuary from "./PetSanctuary.jsx";
import PetExpedition from "./PetExpedition.jsx";
import PetGachaStudio from "./PetGachaStudio.jsx";
import { PetHabitatScene } from "../components/PetWorldArt.jsx";
import { mergePetSaves } from "../data/petSaveMerge.js";

let stopSpeech,ACTION_PROMPTS,BOND_MILESTONES,DAILY_TASK_DEFS,DUPLICATE_EGG_PROGRESS,DUPLICATE_PET_REWARD,EGG_COST,EGG_HATCH_TASKS,GACHA_SR_PITY,Hdr,MAX_STAT,PETS,PET_ACTIONS,PET_ADVENTURE_BOSS_REQUIRED_CLEARS,PET_ADVENTURE_ENEMY_ICONS,PET_ADVENTURE_SKILLS,PET_ADVENTURE_SKILL_UNLOCKS,PET_ADVENTURE_SKILL_VISUALS,PET_CULTIVATION_ACTIONS,PET_EVENTS,PET_FOODS,RARITY_INFO,RARITY_ORDER,S,STAGE_NAMES,STAGE_SAYINGS,TIME_GREETINGS,applyDuplicatePetReward,buildPetAdventureStages,calcDecay,choosePetFoodForNeed,completePetAdventureProgress,createPetAdventureBgm,getAdventureAnswerLine,getAdventureCorrectSpeech,getAdventurePetDef,getAdventureQuestionMeta,getAdventureQuestionSpeech,getBondLevel,getCareCount,getDuplicateEnergyInfo,getDuplicatePetReward,getEventCenter,getNextPetAdventureSkillCard,getPetAdventureDifficulty,getPetAdventureFatigue,getPetAdventurePower,getPetAdventureProgress,getPetAdventureScore,getPetAdventureSkill,getPetAdventureSkillCards,getPetCareAverage,getPetCareSuggestion,getPetCultivationPlan,getPetDailyCultivation,getPetMood,getPetReadiness,getPetSize,getPetStage,getPetUrgentNeed,getSelectedPetAdventureSkill,getTeamAdventureMorale,getTimeOfDay,hashPin,improvePetAfterAdventure,isPetAdventureBossReady,isPetSleeping,levelUpPet,loadPetAdventureQuestions,petCloudLogin,petCloudSignup,playPetAdventureSkillSound,playSound,randomPet,rollRarity,savePetAdventureProgress,speak,triggerRewardBurst,useLS;
function setPetModuleDeps(deps={}){
  ({stopSpeech,ACTION_PROMPTS,BOND_MILESTONES,DAILY_TASK_DEFS,DUPLICATE_EGG_PROGRESS,DUPLICATE_PET_REWARD,EGG_COST,EGG_HATCH_TASKS,GACHA_SR_PITY,Hdr,MAX_STAT,PETS,PET_ACTIONS,PET_ADVENTURE_BOSS_REQUIRED_CLEARS,PET_ADVENTURE_ENEMY_ICONS,PET_ADVENTURE_SKILLS,PET_ADVENTURE_SKILL_UNLOCKS,PET_ADVENTURE_SKILL_VISUALS,PET_CULTIVATION_ACTIONS,PET_EVENTS,PET_FOODS,RARITY_INFO,RARITY_ORDER,S,STAGE_NAMES,STAGE_SAYINGS,TIME_GREETINGS,applyDuplicatePetReward,buildPetAdventureStages,calcDecay,choosePetFoodForNeed,completePetAdventureProgress,createPetAdventureBgm,getAdventureAnswerLine,getAdventureCorrectSpeech,getAdventurePetDef,getAdventureQuestionMeta,getAdventureQuestionSpeech,getBondLevel,getCareCount,getDuplicateEnergyInfo,getDuplicatePetReward,getEventCenter,getNextPetAdventureSkillCard,getPetAdventureDifficulty,getPetAdventureFatigue,getPetAdventurePower,getPetAdventureProgress,getPetAdventureScore,getPetAdventureSkill,getPetAdventureSkillCards,getPetCareAverage,getPetCareSuggestion,getPetCultivationPlan,getPetDailyCultivation,getPetMood,getPetReadiness,getPetSize,getPetStage,getPetUrgentNeed,getSelectedPetAdventureSkill,getTeamAdventureMorale,getTimeOfDay,hashPin,improvePetAfterAdventure,isPetAdventureBossReady,isPetSleeping,levelUpPet,loadPetAdventureQuestions,petCloudLogin,petCloudSignup,playPetAdventureSkillSound,playSound,randomPet,rollRarity,savePetAdventureProgress,speak,triggerRewardBurst,useLS}=deps);
}
function propsWithoutDeps(props){
  const {deps,...rest}=props;
  setPetModuleDeps(deps);
  return rest;
}

export function formatPetTaskDate(value=new Date()){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))return String(value||"");
  return new Intl.DateTimeFormat("zh-TW",{year:"numeric",month:"long",day:"numeric",weekday:"short"}).format(date);
}

function PetAdventurePageInner(props){
  return <PetExpedition key={`${props.petAccount?.username||'local'}:${props.lv}`} {...props} api={{Hdr, PET_ADVENTURE_BOSS_REQUIRED_CLEARS, PET_ADVENTURE_ENEMY_ICONS, PET_ADVENTURE_SKILLS, PET_FOODS, buildPetAdventureStages, choosePetFoodForNeed, completePetAdventureProgress, createPetAdventureBgm, getAdventureAnswerLine, getAdventureCorrectSpeech, getAdventurePetDef, getAdventureQuestionMeta, getAdventureQuestionSpeech, getPetAdventureDifficulty, getPetAdventureFatigue, getPetAdventurePower, getPetAdventureProgress, getPetAdventureScore, getPetAdventureSkillCards, getPetReadiness, getPetStage, getSelectedPetAdventureSkill, getTeamAdventureMorale, improvePetAfterAdventure, isPetAdventureBossReady, loadPetAdventureQuestions, playPetAdventureSkillSound, playSound, savePetAdventureProgress, speak, stopSpeech}}/>;
}

function GachaPageInner(props){
  return <PetGachaStudio {...props} api={{Hdr,useLS,EGG_COST,EGG_HATCH_TASKS,GACHA_SR_PITY,RARITY_INFO,PETS,playSound,rollRarity,randomPet,RARITY_ORDER,DUPLICATE_EGG_PROGRESS,getDuplicatePetReward,applyDuplicatePetReward}}/>;
}

function PetsGuardInner(props){
  const{c,petAccount,setPetAccount,setPets,setEggs,setInventory,setCoins,pets,eggs,inventory,coins}=props;
  const[mode,setMode]=useState(()=>{if(petAccount)return "in";try{return localStorage.getItem("eg_petLocalMode")==="true"?"local":"welcome"}catch{return "welcome"}});// welcome | login | signup | in
  const[username,setUsername]=useState("");
  const[pin,setPin]=useState("");
  const[pin2,setPin2]=useState("");
  const[err,setErr]=useState("");
  const[loading,setLoading]=useState(false);
  const[mergeChoice,setMergeChoice]=useState(null);// for login conflict
  const requestId=useRef(0),requestPending=useRef(false),currentSave=useRef(null);
  currentSave.current={pets,eggs,inventory,coins};
  const inventoryTotal=items=>Object.values(items||{}).reduce((total,value)=>total+Math.max(0,Number(value)||0),0);
  const hasSaveData=save=>save.pets?.length>0||save.eggs?.length>0||save.coins>0||inventoryTotal(save.inventory)>0;
  const changeMode=next=>{
    requestId.current+=1;requestPending.current=false;setLoading(false);setMode(next);
  };
  // Leaving a form or unmounting invalidates both the network response and hashing.
  useEffect(()=>()=>{requestId.current+=1;requestPending.current=false},[]);

  useEffect(()=>{if(mode==="in"&&!petAccount)setMode("welcome")},[mode,petAccount]);
  // If already logged in, show pets page directly
  if(mode==="local"||(mode==="in"&&petAccount)){return<PetsPage {...props} onAccount={()=>changeMode("welcome")}/>}

  const doLogin=async()=>{
    if(requestPending.current)return;
    if(!/^[0-9]{4,6}$/.test(pin)){setErr("請輸入 4–6 位數字 PIN");return}
    const attempt=++requestId.current;requestPending.current=true;setErr("");setLoading(true);
    let r,pinHash;
    try{
      r=await petCloudLogin(username.trim(),pin);
      if(attempt!==requestId.current)return;
      if(!r.ok){requestPending.current=false;setLoading(false);setErr(r.err);return}
      pinHash=await hashPin(pin);
      if(attempt!==requestId.current)return;
    }catch{
      if(attempt!==requestId.current)return;
      requestPending.current=false;setLoading(false);setErr("暫時連不上雲端，請稍後再試。");return;
    }
    requestPending.current=false;setLoading(false);
    // Check if local has unsaved data that would be lost
    const cloudData=r.data;
    const hasLocalData=hasSaveData(currentSave.current);
    const hasCloudData=hasSaveData(cloudData);
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
      const merged=mergePetSaves({pets,eggs,inventory,coins},cloudData);
      setPets(merged.pets);setEggs(merged.eggs);setInventory(merged.inventory);setCoins(merged.coins);
    }
    setPetAccount({username:mergeChoice.cloudData.username,pinHash,lastSync:new Date().toISOString()});
    setMergeChoice(null);
    playSound("done");
    setMode("in");
  };

  const doSignup=async()=>{
    if(requestPending.current)return;
    setErr("");
    if(username.trim().length<2||!/^[0-9]{4,6}$/.test(pin)){setErr("暱稱至少 2 字，PIN 請用 4–6 位數字。");return}
    if(pin!==pin2){setErr("兩次 PIN 不一致");return}
    const attempt=++requestId.current;requestPending.current=true;setLoading(true);
    // Upload existing local pets/eggs/inventory/coins to preserve them
    let r,pinHash;
    try{
      r=await petCloudSignup(username.trim(),pin,{pets,eggs,inventory,coins});
      if(attempt!==requestId.current)return;
      if(!r.ok){requestPending.current=false;setLoading(false);setErr(r.err);return}
      pinHash=await hashPin(pin);
      if(attempt!==requestId.current)return;
    }catch{
      if(attempt!==requestId.current)return;
      requestPending.current=false;setLoading(false);setErr("暫時連不上雲端，請稍後再試。");return;
    }
    requestPending.current=false;setLoading(false);
    setPetAccount({username:r.data.username,pinHash,lastSync:new Date().toISOString()});
    playSound("done");
    setMode("in");
  };

  // Merge conflict dialog
  if(mergeChoice){
    const cloud=mergeChoice.cloudData;
    return(<div className="pet-world pet-sanctuary pet-access"><Hdr t="⚠️ 資料衝突" onBack={()=>{setMergeChoice(null);changeMode("login")}} cl={c.cl}/>
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
              🪙 {coins} 金幣<br/>
              🍎 {inventoryTotal(inventory)} 份食物
            </div>
          </div>
          <div style={{...S.card,padding:"12px",textAlign:"center",background:c.bg}}>
            <div style={{fontSize:13,fontWeight:700,color:S.t1,marginBottom:6}}>☁️ 雲端</div>
            <div style={{fontSize:11,color:S.t2,lineHeight:1.8}}>
              🐾 {(cloud.pets||[]).length} 隻寵物<br/>
              🥚 {(cloud.eggs||[]).length} 顆蛋<br/>
              🪙 {cloud.coins||0} 金幣<br/>
              🍎 {inventoryTotal(cloud.inventory)} 份食物
            </div>
          </div>
        </div>

        <button onClick={()=>resolveMerge("merge")} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:14,marginBottom:8}}>✨ 合併（推薦）<div style={{fontSize:11,opacity:.9,marginTop:2}}>保留所有夥伴與蛋；金幣、食物取較多的一份</div></button>
        <button onClick={()=>resolveMerge("cloud")} style={{...S.btn,background:S.bg2,color:S.t1,width:"100%",padding:"12px",fontSize:13,marginBottom:8}}>☁️ 只用雲端資料（本機會清空）</button>
        <button onClick={()=>resolveMerge("local")} style={{...S.btn,background:S.bg2,color:S.t1,width:"100%",padding:"12px",fontSize:13}}>📱 只用本機資料（雲端會覆蓋）</button>
      </div>
    </div>);
  }

  // Choose local play first; account setup is an optional route to the same home.
  if(mode==="welcome"){
    return <div className="pet-world pet-sanctuary pet-access"><Hdr t="🐾 寵物小家園" onBack={props.onBack} cl={c.cl}/>
      <section className="ps-hero"><div className="ps-hero-copy"><span className="pet-eyebrow">YOUR LITTLE COMPANION</span><h2>歡迎來到寵物樂園！</h2><p>先認識一位小夥伴，學英文、一起玩，也一起長大。第一次來，可以免費領養一顆蛋。</p><button className="pet-primary" onClick={()=>{try{localStorage.setItem("eg_petLocalMode","true")}catch{}changeMode("local")}}>先在這台裝置養寵物 →</button><p className="pet-note">進度保存在這個瀏覽器。之後可在設定連結雲端小帳號。</p></div><PetHabitatScene pets={pets.length?pets:[{petId:"bunny",level:1}]} caption="陪伴，從一句 Hello 開始"/></section>
      <section className="ps-next"><div><h3>想在手機和平板接著玩？</h3><p>小帳號只需要暱稱與 4–6 位數字 PIN。PIN 是登入憑證，請記住它；目前沒有 Email 找回功能。</p></div><div className="pet-button-row"><button className="pet-secondary" onClick={()=>{changeMode("login");setUsername("");setPin("");setErr("")}}>登入小帳號</button><button className="pet-secondary" onClick={()=>{changeMode("signup");setUsername("");setPin("");setPin2("");setErr("")}}>建立小帳號</button></div></section>
    </div>;
  }

  // Signup form
  if(mode==="signup"){
    return(<div className="pet-world pet-sanctuary pet-access"><Hdr t="✨ 建立新帳號" onBack={()=>changeMode("welcome")} cl={c.cl}/>
      <div style={{...S.card,padding:"24px 20px"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:48}}>🐾</div>
          <div style={{fontSize:14,color:S.t2,marginTop:8}}>取個好記的暱稱吧！</div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>📛 暱稱（2-20 字）</label>
          <input aria-label="暱稱" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="例如：小明、貓咪控" maxLength={20} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:16,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>🔢 設定 PIN（4-6 位數字）</label>
          <input aria-label="PIN" autoComplete="off" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="輸入 4-6 位數字" type="password" inputMode="numeric" maxLength={6} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:20,fontFamily:"monospace",letterSpacing:4,textAlign:"center",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>🔢 再輸入一次 PIN</label>
          <input aria-label="再次輸入 PIN" autoComplete="off" value={pin2} onChange={e=>setPin2(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="再輸入一次確認" type="password" inputMode="numeric" maxLength={6} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:20,fontFamily:"monospace",letterSpacing:4,textAlign:"center",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        {err&&<div style={{padding:"10px 14px",background:"#FCEBEB",border:"1px solid #E24B4A",borderRadius:10,color:"#A32D2D",fontSize:13,marginBottom:12,textAlign:"center",fontWeight:600}}>❌ {err}</div>}

        {/* Local data preview */}
        {hasSaveData(currentSave.current)&&<div style={{padding:"10px 14px",background:"#E1F5EE",border:"1px solid #1D9E75",borderRadius:10,fontSize:12,color:"#0F6E56",marginBottom:12,lineHeight:1.7}}>
          ✅ 你目前的本機資料會一起上傳：🐾 {pets.length} 寵物 · 🥚 {eggs.length} 蛋 · 🪙 {coins} 金幣 · 🍎 {inventoryTotal(inventory)} 份食物
        </div>}

        <button onClick={doSignup} disabled={loading||!username.trim()||!pin||!pin2} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:15,opacity:(loading||!username.trim()||!pin||!pin2)?.4:1}}>{loading?"建立中...":"✨ 建立帳號"}</button>

        <div style={{...S.card,padding:"12px",marginTop:16,fontSize:12,color:"#765a20",lineHeight:1.7,background:"#FFF3CD",border:"1px solid #EF9F27"}}>
          ⚠️ <b>請記住你的暱稱和 PIN！</b><br/>
          忘記就無法找回寵物了（沒有 Email 備援）
        </div>
      </div>
    </div>);
  }

  // Login form
  if(mode==="login"){
    return(<div className="pet-world pet-sanctuary pet-access"><Hdr t="🔑 登入帳號" onBack={()=>changeMode("welcome")} cl={c.cl}/>
      <div style={{...S.card,padding:"24px 20px"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:48}}>🔑</div>
          <div style={{fontSize:14,color:S.t2,marginTop:8}}>輸入你的暱稱和 PIN</div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>📛 暱稱</label>
          <input aria-label="暱稱" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="你之前建立的暱稱" maxLength={20} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:16,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>🔢 PIN</label>
          <input aria-label="PIN" autoComplete="off" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="4-6 位數字" type="password" inputMode="numeric" maxLength={6} onKeyDown={e=>{if(e.key==="Enter")doLogin()}} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:20,fontFamily:"monospace",letterSpacing:4,textAlign:"center",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        {err&&<div style={{padding:"10px 14px",background:"#FCEBEB",border:"1px solid #E24B4A",borderRadius:10,color:"#A32D2D",fontSize:13,marginBottom:12,textAlign:"center",fontWeight:600}}>❌ {err}</div>}

        <button onClick={doLogin} disabled={loading||!username.trim()||!pin} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:15,opacity:(loading||!username.trim()||!pin)?.4:1}}>{loading?"登入中...":"🔑 登入"}</button>
      </div>
    </div>);
  }

  return null;
}


function PetsPage(props){
  return <PetSanctuary {...props} api={{Hdr,useLS,PETS,EGG_HATCH_TASKS,RARITY_INFO,DAILY_TASK_DEFS,PET_FOODS,ACTION_PROMPTS,levelUpPet,calcDecay,speak,stopSpeech,playSound,applyDuplicatePetReward,getDuplicatePetReward}}/>;
}

export function PetAdventurePage(props){
  return <PetAdventurePageInner {...propsWithoutDeps(props)}/>;
}
export function GachaPage(props){
  return <GachaPageInner {...propsWithoutDeps(props)}/>;
}
export function PetsGuard(props){
  return <PetsGuardInner {...propsWithoutDeps(props)}/>;
}
