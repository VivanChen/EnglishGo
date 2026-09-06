import { useEffect, useRef, useState } from 'react';
import PixelPet from '../components/PetCompanion.jsx';
import { GachaMachineArt } from '../components/PetWorldArt.jsx';
import { planPetPulls } from '../data/petGacha.js';

export default function PetGachaStudio({onBack,onNavigate,c,coins,setCoins,eggs,setEggs,pets,setPets,api}) {
  const {Hdr,useLS,EGG_COST,EGG_HATCH_TASKS,GACHA_SR_PITY,RARITY_INFO,PETS,playSound}=api;
  const [pity,setPity]=useLS('gachaPity',{sinceSR:0,total:0});
  const [receipt,setReceipt]=useLS('gachaReceipt',null);
  const [phase,setPhase]=useState(receipt?.items?.length?'result':'lobby');
  const rolling=useRef(false),timer=useRef(null),heading=useRef(null);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  useEffect(()=>{if(phase==='result')heading.current?.focus()},[phase]);
  const reveal=()=>{clearTimeout(timer.current);rolling.current=false;setPhase('result');playSound?.('good')};
  const roll=count=>{
    if(rolling.current||coins<EGG_COST*count)return;
    rolling.current=true;
    const settled=planPetPulls({count,pity,pets,eggs,api});
    // Commit the reward before presentation. Leaving during the animation loses nothing.
    setCoins(value=>Math.max(0,value-EGG_COST*count));setPets(settled.pets);setEggs(settled.eggs);setPity(settled.pity);
    setReceipt({items:settled.items,date:new Date().toISOString()});
    setPhase('rolling');playSound?.('flip');
    timer.current=setTimeout(reveal,window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.egCalm==='true'?100:1400);
  };
  const close=()=>{setReceipt(null);setPhase('lobby')};
  const goHome=()=>{setReceipt(null);onNavigate?.('pets','eggs')};
  const total=Object.values(PETS).flat().length,owned=new Set(pets.map(p=>p.petId)).size;
  const ready=eggs.filter(e=>e.progress>=EGG_HATCH_TASKS[e.rarity]).length;
  return <div className="pet-world pet-gacha" data-testid="pet-gacha-studio">
    <Hdr t="🥚 森林扭蛋屋" onBack={onBack} cl={c.cl}/>
    <div className="pet-trail"><span>01 遇見</span><i>→</i><span>02 學習孵化</span><i>→</i><span>03 一起長大</span></div>
    {phase==='result'&&receipt?.items?.length?<>
      <div className="pet-section-heading"><div><span className="pet-eyebrow">A NEW LITTLE STORY</span><h2 ref={heading} tabIndex={-1}>把這份相遇帶回家</h2><p>結果已經存好了，接著一起照顧牠吧。</p></div><span className="pet-wallet">金幣 {coins}</span></div>
      <div className={`pet-receipt-grid ${receipt.items.length===1?'is-single':''}`}>
        {receipt.items.map(item=><article key={item.id} className="pet-receipt" style={{'--pet-rarity':RARITY_INFO[item.rarity].color}}>
          <span className="pet-pill">{RARITY_INFO[item.rarity].label} · {item.resultType==='newEgg'?'新夥伴':item.resultType==='eggMerge'?'孵化助力':'成長能量'}</span>
          <div className="pet-receipt-portrait"><PixelPet petId={item.petId} stage={item.resultType==='petBoost'?'adult':'egg'} size={receipt.items.length===1?152:80} animate={false}/></div>
          <h3>{item.pet.name}{item.resultType==='petBoost'?'':'蛋'}</h3>
          <p>{item.resultType==='newEgg'?`已放入蛋倉 · 學習 ${EGG_HATCH_TASKS[item.rarity]} 題就能孵化`:item.resultType==='eggMerge'?`重複蛋自動融合 · 進度 +${item.progressGain}`:`XP +${item.dupeExp} · 親密度 +${item.dupeBond}`}</p>
          {receipt.items.length===1&&<p className="pet-story">{item.pet.story}</p>}
          {(item.pityHit||item.guarantee)&&<small>{item.pityHit?'本次已套用 SR 保底':'本次已套用十連保底'}</small>}
        </article>)}
      </div>
      <div className="pet-button-row">{onNavigate&&<button className="pet-primary" onClick={goHome}>帶回家，看看蛋倉 →</button>}<button className="pet-secondary" onClick={close}>收下結果</button></div>
    </>:<>
      <section className="pet-gacha-hero">
        <div className="pet-gacha-machine"><span className="pet-art-label">FOREST EGG HOUSE</span><GachaMachineArt rolling={phase==='rolling'}/><span className="pet-machine-caption">每一顆蛋，都有自己的故事</span></div>
        <div className="pet-gacha-welcome"><span className="pet-eyebrow">用學習金幣，遇見新朋友</span><h2>今天會遇見<br/>哪位小夥伴？</h2><p>轉出一顆蛋，再用英文學習陪牠孵化。重複的夥伴也會化成成長能量。</p>
          <div className="pet-wallet">我的學習金幣 <b>{coins}</b></div>
          {phase==='rolling'?<div className="pet-opening" role="status"><h3>小夥伴正在打招呼…</h3><button className="pet-secondary" onClick={reveal}>直接看結果</button></div>:<>
            <button className="pet-primary pet-roll" disabled={coins<EGG_COST} onClick={()=>roll(1)}>轉出一顆蛋 <span>金幣 {EGG_COST}</span></button>
            {coins<EGG_COST&&<p className="pet-note">還差 {EGG_COST-coins} 金幣，完成學習後再來吧。{onNavigate&&<button className="pet-link" onClick={()=>onNavigate('srs')}>去學單字 →</button>}</p>}
            <details className="pet-batch"><summary>一次轉出 10 顆</summary><p>使用 {EGG_COST*10} 金幣，至少 1 顆稀有以上。</p><button className="pet-secondary" disabled={coins<EGG_COST*10} onClick={()=>roll(10)}>十連抽 · {EGG_COST*10} 金幣</button></details>
          </>}
        </div>
      </section>
      <section className="pet-gacha-next"><div><span className="pet-eyebrow">接下來，陪牠長大</span><h3>{ready?`${ready} 顆蛋準備孵化了！`:eggs.length?`${eggs.length} 顆蛋正在等你陪伴`:owned?'想遇見新朋友，隨時都可以回來':'你的第一位朋友，從一顆蛋開始'}</h3><p>遇見 {owned}/{total} 種寵物 · 抽蛋只使用學習金幣。</p></div>{onNavigate&&<button className="pet-secondary" disabled={phase==='rolling'} onClick={()=>onNavigate('pets','eggs')}>前往蛋倉 →</button>}</section>
      <details className="pet-rules"><summary>看看機率與重複蛋的規則</summary><div className="pet-rarity-grid">{Object.entries(RARITY_INFO).map(([id,info])=><div key={id}><b>{info.label}</b><strong>{info.rate}%</strong></div>)}</div><p>一般抽取機率如上。若持續未抽中 SR／SSR，最多再 {Math.max(1,GACHA_SR_PITY-(pity?.sinceSR||0))} 次會套用 SR 以上保底。十連抽另有 R 以上保底。</p><p>重複蛋增加孵化進度；已擁有的寵物增加 XP、親密度與原有共鳴能量。稀有度不影響參與家園活動的資格。</p></details>
    </>}
  </div>;
}
