import { useEffect, useRef, useState } from 'react';
import PixelPet from '../components/PetCompanion.jsx';
import { PetHabitatScene } from '../components/PetWorldArt.jsx';
import { awardPetPlay, getPetJourney, getPlayStars, makePetPlay, petPlayReducer } from '../data/petJourney.js';
import './pet-games.css';

export default function PetPlayground({pets,setPets,setCoins,c,onBack,incrTask,foods,getDef,levelUpPet,Hdr,speak,stopSpeech,playSound}) {
  const [ids,setIds]=useState(()=>pets.slice(0,2).map(p=>p.petId)),[mode,setMode]=useState('picnic'),[level,setLevel]=useState(1),[run,setRun]=useState(null),[reward,setReward]=useState(null);
  const current=useRef(null),paid=useRef(false),dialog=useRef(null),title=useRef(null);
  const [exitRequested,setExitRequested]=useState(false),[setupError,setSetupError]=useState('');
  const selected=pets.filter(p=>ids.includes(p.petId)),leader=selected[0];
  const send=action=>{const next=petPlayReducer(current.current,action);current.current=next;setRun(next);return next};
  useEffect(()=>{const hidden=()=>{if(document.hidden){send({type:'PAUSE'});stopSpeech?.()}};document.addEventListener('visibilitychange',hidden);return()=>{document.removeEventListener('visibilitychange',hidden);stopSpeech?.()}},[stopSpeech]);
  useEffect(()=>{if(run?.phase==='paused')dialog.current?.showModal?.();else dialog.current?.close?.()},[run?.phase]);
  const start=()=>{if(!leader)return;paid.current=false;setReward(null);setExitRequested(false);const next=makePetPlay(mode,foods,level);if(!next){setSetupError('食物單字還沒準備好，請先回家再試一次。');return}setSetupError('');current.current=next;setRun(next)};
  const leave=()=>{stopSpeech?.();current.current=null;setRun(null);setReward(null);setExitRequested(false)};
  const pause=(exiting=false)=>{setExitRequested(exiting);send({type:'PAUSE'});stopSpeech?.()};
  const resume=()=>{setExitRequested(false);send({type:'RESUME'})};
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
    <Hdr t="🧺 夥伴遊樂園" onBack={run&&run.phase!=='done'?()=>pause(true):run?leave:onBack} cl={c.cl}/>
    {!run?<>
      <div className="pet-game-welcome"><div><span className="pet-eyebrow">一起玩，也一起長大</span><h2>留一點時間，<br/>給你的小夥伴。</h2><p>輕鬆玩 3 回合，慢慢想也沒關係。</p><div className="pet-game-tags"><span>免費遊玩</span><span>約 2–4 分鐘</span><span>隨時暫停</span></div></div><PetHabitatScene pets={selected} compact caption="一隻也能玩，兩隻一起留下回憶"/></div>
      <section className="pet-game-setup-section"><div className="pet-game-step-title"><span>01</span><div><h3>誰陪你一起玩？</h3><p>選 1–2 位夥伴。已選 {selected.length}/2 位</p></div></div>
      <div className="pet-partner-picker" aria-label="選擇遊戲夥伴">{pets.map(p=><button key={p.petId} aria-pressed={ids.includes(p.petId)} disabled={!ids.includes(p.petId)&&ids.length>=2} onClick={()=>{setIds(previous=>previous.includes(p.petId)?previous.filter(id=>id!==p.petId):[...previous,p.petId]);setLevel(1)}}><PixelPet petId={p.petId} stage={(p.level||1)>=4?'adult':'baby'} size={54} animate={false}/><span>{p.nickname||getDef(p)?.name||p.petId}</span>{ids.includes(p.petId)&&<b>✓</b>}</button>)}</div>
      {!pets.length&&<p className="pet-note">孵化第一隻寵物，就可以一起玩了。<button className="pet-link" onClick={onBack}>回寵物小屋</button></p>}{pets.length>0&&!leader&&<p className="pet-note" role="status">點選一位夥伴，就可以出發。</p>}</section>
      <section className="pet-game-setup-section"><div className="pet-game-step-title"><span>02</span><div><h3>今天想玩什麼？</h3><p>兩款遊戲都可以慢慢想，答錯還能再試。</p></div></div>
      <div className="pet-play-modes">{[{id:'picnic',icon:'🧺',name:'野餐接力',text:'看懂夥伴的願望，選出正確的英文食物。'},{id:'memory',icon:'🍃',name:'記憶尋寶',text:'記住食物路線，照順序找回野餐寶物。'}].map(item=><button key={item.id} className={mode===item.id?'is-selected':''} aria-pressed={mode===item.id} onClick={()=>{setMode(item.id);setLevel(1)}}><span>{item.icon}</span><h3>{item.name}</h3><p>{item.text}</p></button>)}</div>
      </section><section className="pet-game-setup-section"><div className="pet-game-step-title"><span>03</span><div><h3>選一個剛好的挑戰</h3><p>{mode==='picnic'?'看中文選英文；第一關有圖片與中文幫忙。':'先看食物順序，準備好後再依序選出英文。'}</p></div></div>
      <div className="pet-play-levels">{[1,2,3].map(stage=><button key={stage} aria-pressed={level===stage} disabled={!unlocked(stage)} onClick={()=>setLevel(stage)}><b>{['小小起步','默契練習','最佳拍檔'][stage-1]}</b><span>{unlocked(stage)?mode==='memory'?`記住 ${stage+1} 個食物`:`${stage+2} 個選項${stage===1?' · 圖文提示':' · 英文挑戰'}`:'先完成上一關'}</span><small aria-label="最佳星星紀錄">{'★'.repeat(Math.max(0,...selected.map(p=>p.playRecords?.[`${mode}:${stage}`]||0)))||'☆ ☆ ☆'}</small></button>)}</div></section>
      <div className="pet-game-launch"><div><strong>{mode==='picnic'?'野餐接力':'記憶尋寶'} · 第 {level} 關</strong><p>{leader?selected.map(p=>p.nickname||getDef(p)?.name||p.petId).join('、')+'已準備好':'先選一位夥伴'}</p></div><button className="pet-primary pet-play-start" disabled={!leader||!unlocked(level)} onClick={start}>帶夥伴出發 →</button></div>{setupError&&<p role="alert">{setupError}</p>}
      <details className="pet-game-reward-guide"><summary>完成後會得到什麼？</summary><p>每位夥伴每天每款遊戲首次完成：寵物 XP +18、親密 +8，體力 −4。有首次完成的夥伴時，這局另得金幣 +8。再玩可以提升星星紀錄，不重複發成長獎勵。</p></details>
    </>:run.phase==='done'?<section className="pet-play-result">
      <PetHabitatScene pets={selected} celebrate caption="又多了一段一起完成的回憶"/>
      <h2 ref={title} tabIndex={-1}>三回合完成！我們做到了</h2><div className="pet-result-stars" aria-label={`${getPlayStars(run)} 顆星`}>{'★'.repeat(getPlayStars(run))}{'☆'.repeat(3-getPlayStars(run))}</div>
      <p>{run.points} 分 · 複習 {new Set(run.rounds.flatMap(r=>r.answers)).size} 個食物單字</p><p className="pet-note">完成得 1 星；失誤不超過 2 次再得 1 星；零失誤且沒用提示再得 1 星。</p><div className="pet-game-earned" role="status">{reward?.fresh?<><span>已存入獎勵</span><strong>金幣 +{reward.coins}</strong><p>{reward.fresh} 位夥伴各獲得：寵物 XP +18、親密 +8、陪伴印記 +1，體力 −4。</p></>:'今天的成長獎勵已領過，這次更新了最佳星星紀錄。'}</div>
      <div className="pet-review-words">{[...new Set(run.rounds.flatMap(r=>r.answers))].map(id=>{const food=foods.find(f=>f.id===id);return <button key={id} className="pet-secondary" onClick={()=>speak?.(food.word)}>{food.emoji} {food.word} · {food.name} ♫</button>})}</div>
      <div className="pet-button-row">{level<3&&<button className="pet-primary" onClick={()=>{leave();setLevel(level+1)}}>看看下一關 →</button>}<button className="pet-secondary" onClick={leave}>回遊樂園</button><button className="pet-secondary" onClick={onBack}>回家休息</button></div>
    </section>:<>
      <div className="pet-play-hud"><b>{mode==='picnic'?'野餐接力':'記憶尋寶'} · 第 {level} 關</b><span>回合 {view.index+1}/3</span><button className="pet-secondary" onClick={()=>pause()}>Ⅱ 暫停</button></div>
      <PetHabitatScene pets={selected} compact celebrate={view.phase==='correct'} caption={view.phase==='correct'?'太好了，寶物找到了！':'想一想，再一起找出來'}/>
      <div className="pet-play-route" aria-label={`已完成 ${view.completed} 回合`}>{[0,1,2].map(i=><div key={i} className={i<view.completed?'is-done':i===view.index?'is-current':''}><span>{i<view.completed?'✓':i+1}</span><b>{['準備野餐','分享美味','帶回回憶'][i]}</b></div>)}</div>
      <section className="pet-play-puzzle" aria-label="本回合任務" inert={isPaused?'':undefined}>
        {mode==='picnic'?<><span className="pet-eyebrow">幫夥伴準備野餐</span><h2>找出「{foods.find(f=>f.id===view.rounds[view.index].answers[0])?.name}」</h2><button className="pet-secondary" onClick={()=>speak?.(foods.find(f=>f.id===view.rounds[view.index].answers[0])?.word)}>♫ 聽聽英文</button>{view.feedback==='hint'&&<p className="pet-word-hint">英文是 {foods.find(f=>f.id===view.rounds[view.index].answers[0])?.word}</p>}</>:<><span className="pet-eyebrow">記住路線，再找寶物</span><h2>{view.phase==='preview'?'從左到右，記住順序':'接下來要找哪一個？'}</h2>{view.phase==='preview'?<div className="pet-memory-preview">{view.rounds[view.index].answers.map((id,i)=>{const food=foods.find(f=>f.id===id);return <button key={`${id}-${i}`} onClick={()=>speak?.(food.word)}><small>{i+1}</small><span>{food.emoji}</span><b>{food.word}</b><em>{food.name}</em></button>})}</div>:<div className="pet-memory-slots">{view.rounds[view.index].answers.map((id,i)=><span key={i}>{i<view.step?foods.find(f=>f.id===id)?.word:'?'}</span>)}</div>}{view.phase==='preview'&&<button className="pet-primary" onClick={()=>send({type:'READY'})}>我記住了，開始尋寶</button>}</>}
        {view.phase!=='preview'&&<div className="pet-food-choices">{view.rounds[view.index].items.map(food=><button key={food.id} onClick={()=>pick(food.id)} disabled={view.phase!=='playing'} data-food={food.id}>{mode==='picnic'&&level===1&&<span>{food.emoji}</span>}<b>{food.word}</b>{mode==='picnic'&&level===1&&<small>{food.name}</small>}</button>)}</div>}
        <div className="pet-play-feedback" role="status">{view.feedback==='retry'?mode==='memory'?'再一起看看，從第一個重新找。需要時可以再看路線。':'再想一想，需要時可以聽英文或看提示。':view.phase==='correct'?'找到了！你和夥伴配合得很好。':''}</div>
        <div className="pet-button-row">{view.phase==='correct'?<button className="pet-primary" onClick={next}>{view.index===2?'完成野餐，看看成果 →':'前往下一回合 →'}</button>:view.phase==='playing'&&<button className="pet-secondary" onClick={()=>send({type:'HINT'})}>{mode==='memory'?'再看一次路線':'給我一個提示'}</button>}</div>
      </section>
      <dialog className="pet-pause-dialog" ref={dialog} aria-label={exitRequested?'離開這一局':'遊戲已暫停'} onCancel={e=>{e.preventDefault();resume()}}><span className="pet-eyebrow">已暫停 · 第 {view.index+1}/3 回合</span><h2>{exitRequested?'要先回遊樂園嗎？':'夥伴陪你休息一下'}</h2><p>繼續玩會回到剛才的位置。離開會放棄這局進度，完成三回合後才會得到獎勵。</p><div className="pet-button-row"><button className="pet-primary" onClick={resume}>繼續一起玩</button><button className="pet-secondary" onClick={leave}>結束這局，回遊樂園</button></div></dialog>
    </>}
  </div>;
}
