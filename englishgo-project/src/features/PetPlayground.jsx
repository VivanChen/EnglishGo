import { useEffect, useRef, useState } from 'react';
import PixelPet from '../components/PetCompanion.jsx';
import { PetHabitatScene } from '../components/PetWorldArt.jsx';
import { awardPetPlay, getPetJourney, getPlayStars, makePetPlay, petPlayReducer } from '../data/petJourney.js';

export default function PetPlayground({pets,setPets,setCoins,c,onBack,incrTask,foods,getDef,levelUpPet,Hdr,speak,stopSpeech,playSound}) {
  const [ids,setIds]=useState(()=>pets.slice(0,2).map(p=>p.petId)),[mode,setMode]=useState('picnic'),[level,setLevel]=useState(1),[run,setRun]=useState(null),[reward,setReward]=useState(null);
  const current=useRef(null),paid=useRef(false),dialog=useRef(null),title=useRef(null);
  const selected=pets.filter(p=>ids.includes(p.petId)),leader=selected[0];
  const send=action=>{const next=petPlayReducer(current.current,action);current.current=next;setRun(next);return next};
  useEffect(()=>{const hidden=()=>{if(document.hidden){send({type:'PAUSE'});stopSpeech?.()}};document.addEventListener('visibilitychange',hidden);return()=>{document.removeEventListener('visibilitychange',hidden);stopSpeech?.()}},[stopSpeech]);
  useEffect(()=>{if(run?.phase==='paused')dialog.current?.showModal?.();else dialog.current?.close?.()},[run?.phase]);
  const start=()=>{paid.current=false;setReward(null);const next=makePetPlay(mode,foods,level);current.current=next;setRun(next)};
  const leave=()=>{stopSpeech?.();current.current=null;setRun(null);setReward(null)};
  const pick=id=>{const before=current.current,next=send({type:'PICK',id});if(next!==before){playSound?.(next.feedback==='retry'?'flip':'good');if(next.phase==='correct')speak?.(next.rounds[next.index].answers.map(key=>foods.find(f=>f.id===key)?.word).join(', '))}};
  const next=()=>{
    const state=send({type:'NEXT'});stopSpeech?.();
    if(state.phase!=='done'||paid.current)return;
    paid.current=true;
    const fresh=selected.filter(p=>!getPetJourney(p).today.includes(state.mode));
    setPets(previous=>previous.map(p=>ids.includes(p.petId)?levelUpPet(awardPetPlay(p,state)):p));
    if(fresh.length){setCoins?.(coins=>coins+8);incrTask?.('playToday')}
    setReward({fresh:fresh.length,coins:fresh.length?8:0});playSound?.('combo');
  };
  useEffect(()=>{if(run?.phase==='done')title.current?.focus()},[run?.phase]);
  const unlocked=stage=>stage===1||selected.some(p=>(p.playRecords?.[`${mode}:${stage-1}`]||0)>0);
  const isPaused=run?.phase==='paused',view=isPaused?{...run,phase:run.resume}:run;
  return <div className="pet-world pet-playground" data-testid="pet-playground">
    <Hdr t="🧺 夥伴遊樂園" onBack={run?leave:onBack} cl={c.cl}/>
    {!run?<>
      <PetHabitatScene pets={selected} caption="一隻也能玩，兩隻一起留下回憶"/>
      <div className="pet-section-heading"><div><span className="pet-eyebrow">PLAY, LEARN & GROW</span><h2>今天一起玩什麼？</h2><p>每次 3 回合，不限時間。先選一到兩位夥伴。</p></div></div>
      <div className="pet-partner-picker" aria-label="選擇遊戲夥伴">{pets.map(p=><button key={p.petId} aria-pressed={ids.includes(p.petId)} onClick={()=>{setIds(previous=>previous.includes(p.petId)?previous.filter(id=>id!==p.petId):previous.length<2?[...previous,p.petId]:[previous[0],p.petId]);setLevel(1)}}><PixelPet petId={p.petId} stage={(p.level||1)>=4?'adult':'baby'} size={54} animate={false}/><span>{getDef(p)?.name||p.petId}</span>{ids.includes(p.petId)&&<b>✓</b>}</button>)}</div>
      {!pets.length&&<p className="pet-note">孵化第一隻寵物，就可以一起玩了。<button className="pet-link" onClick={onBack}>回蛋倉看看</button></p>}
      <div className="pet-play-modes">{[{id:'picnic',icon:'🧺',name:'野餐接力',text:'看懂夥伴的願望，選出正確的英文食物。'},{id:'memory',icon:'🍃',name:'記憶尋寶',text:'記住食物路線，照順序找回野餐寶物。'}].map(item=><button key={item.id} className={mode===item.id?'is-selected':''} aria-pressed={mode===item.id} onClick={()=>{setMode(item.id);setLevel(1)}}><span>{item.icon}</span><h3>{item.name}</h3><p>{item.text}</p></button>)}</div>
      <div className="pet-play-levels">{[1,2,3].map(stage=><button key={stage} aria-pressed={level===stage} disabled={!unlocked(stage)} onClick={()=>setLevel(stage)}><b>{['小小起步','默契練習','最佳拍檔'][stage-1]}</b><span>{unlocked(stage)?`第 ${stage} 關`:'先完成上一關'}</span><small>{'★'.repeat(Math.max(0,...selected.map(p=>p.playRecords?.[`${mode}:${stage}`]||0)))||'☆ ☆ ☆'}</small></button>)}</div>
      <button className="pet-primary pet-play-start" disabled={!leader||!unlocked(level)} onClick={start}>帶夥伴出發 →</button><p className="pet-note">每位夥伴每天每款遊戲首次完成可得 XP +18、親密 +8；有首次完成的夥伴時，這局另得金幣 +8。再玩可提升星星紀錄。</p>
    </>:run.phase==='done'?<section className="pet-play-result">
      <PetHabitatScene pets={selected} celebrate caption="又多了一段一起完成的回憶"/>
      <h2 ref={title} tabIndex={-1}>三回合完成！我們做到了</h2><div className="pet-result-stars" aria-label={`${getPlayStars(run)} 顆星`}>{'★'.repeat(getPlayStars(run))}{'☆'.repeat(3-getPlayStars(run))}</div>
      <p>{run.points} 分 · 複習 {new Set(run.rounds.flatMap(r=>r.answers)).size} 個食物單字</p><p className="pet-note">完成得 1 星；失誤不超過 2 次再得 1 星；零失誤且沒用提示再得 1 星。</p><p>{reward?.fresh?`${reward.fresh} 位夥伴留下陪伴印記 · XP +18、親密 +8 · 金幣 +${reward.coins}`:'今天的成長獎勵已領過，這次更新了最佳星星紀錄。'}</p>
      <div className="pet-review-words">{[...new Set(run.rounds.flatMap(r=>r.answers))].map(id=>{const food=foods.find(f=>f.id===id);return <button key={id} className="pet-secondary" onClick={()=>speak?.(food.word)}>{food.emoji} {food.word} · {food.name} ♫</button>})}</div>
      <div className="pet-button-row">{level<3&&<button className="pet-primary" onClick={()=>{leave();setLevel(level+1)}}>看看下一關 →</button>}<button className="pet-secondary" onClick={leave}>回遊樂園</button><button className="pet-secondary" onClick={onBack}>回家休息</button></div>
    </section>:<>
      <div className="pet-play-hud"><b>{mode==='picnic'?'野餐接力':'記憶尋寶'} · 第 {level} 關</b><span>回合 {view.index+1}/3</span><button className="pet-secondary" onClick={()=>{send({type:'PAUSE'});stopSpeech?.()}}>Ⅱ 暫停</button></div>
      <PetHabitatScene pets={selected} compact celebrate={view.phase==='correct'} caption={view.phase==='correct'?'太好了，寶物找到了！':'想一想，再一起找出來'}/>
      <div className="pet-play-route" aria-label={`已完成 ${view.completed} 回合`}>{[0,1,2].map(i=><div key={i} className={i<view.completed?'is-done':i===view.index?'is-current':''}><span>{i<view.completed?'✓':i+1}</span><b>{['準備野餐','分享美味','帶回回憶'][i]}</b></div>)}</div>
      <section className="pet-play-puzzle" aria-label="本回合任務" inert={isPaused?'':undefined}>
        {mode==='picnic'?<><span className="pet-eyebrow">幫夥伴準備野餐</span><h2>找出「{foods.find(f=>f.id===view.rounds[view.index].answers[0])?.name}」</h2><button className="pet-secondary" onClick={()=>speak?.(foods.find(f=>f.id===view.rounds[view.index].answers[0])?.word)}>♫ 聽聽英文</button>{view.feedback==='hint'&&<p className="pet-word-hint">英文是 {foods.find(f=>f.id===view.rounds[view.index].answers[0])?.word}</p>}</>:<><span className="pet-eyebrow">記住路線，再找寶物</span><h2>{view.phase==='preview'?'從左到右，記住順序':'接下來要找哪一個？'}</h2>{view.phase==='preview'?<div className="pet-memory-preview">{view.rounds[view.index].answers.map((id,i)=>{const food=foods.find(f=>f.id===id);return <button key={`${id}-${i}`} onClick={()=>speak?.(food.word)}><small>{i+1}</small><span>{food.emoji}</span><b>{food.word}</b><em>{food.name}</em></button>})}</div>:<div className="pet-memory-slots">{view.rounds[view.index].answers.map((id,i)=><span key={i}>{i<view.step?foods.find(f=>f.id===id)?.word:'?'}</span>)}</div>}{view.phase==='preview'&&<button className="pet-primary" onClick={()=>send({type:'READY'})}>我記住了，開始尋寶</button>}</>}
        {view.phase!=='preview'&&<div className="pet-food-choices">{view.rounds[view.index].items.map(food=><button key={food.id} onClick={()=>pick(food.id)} disabled={view.phase!=='playing'} data-food={food.id}>{mode==='picnic'&&level===1&&<span>{food.emoji}</span>}<b>{food.word}</b>{mode==='picnic'&&level===1&&<small>{food.name}</small>}</button>)}</div>}
        <div className="pet-play-feedback" role="status">{view.feedback==='retry'?'差一點點，從第一個再試試。需要時可以看提示。':view.phase==='correct'?'找到了！你和夥伴配合得很好。':''}</div>
        <div className="pet-button-row">{view.phase==='correct'?<button className="pet-primary" onClick={next}>{view.index===2?'完成野餐，看看成果 →':'前往下一回合 →'}</button>:view.phase==='playing'&&<button className="pet-secondary" onClick={()=>send({type:'HINT'})}>{mode==='memory'?'再看一次路線':'給我一個提示'}</button>}</div>
      </section>
      <dialog className="pet-pause-dialog" ref={dialog} onCancel={e=>{e.preventDefault();send({type:'RESUME'})}}><span className="pet-eyebrow">TAKE A LITTLE BREAK</span><h2>夥伴陪你休息一下</h2><p>回合和路線都會留在原位。</p><div className="pet-button-row"><button className="pet-primary" onClick={()=>send({type:'RESUME'})}>繼續一起玩</button><button className="pet-secondary" onClick={leave}>回遊樂園</button></div></dialog>
    </>}
  </div>;
}
