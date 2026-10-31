import { useEffect, useMemo, useRef, useState } from 'react';
import TownScene from './TownScene.jsx';
import { EXPLORATION_PLACES, explorationPlacements, explorationReceipt } from './explorationData.js';
import { petVoice } from './townSounds.js';
import './world-explorer.css';

export default function WorldExplorer({ pet, receipts, dispatch, level='elementary', motion=true, quality='auto', onSound, speak, stopSpeech }) {
  const [reaction,setReaction]=useState('');
  const [placeId,setPlaceId]=useState(null),[taskId,setTaskId]=useState(null),[activity,setActivity]=useState(null);
  const [phase,setPhase]=useState('idle'),[feedback,setFeedback]=useState(null),[translation,setTranslation]=useState(false),[renderer,setRenderer]=useState('loading');
  const map=useRef(null),detail=useRef(null),nonce=useRef(0),currentTask=useRef(null);
  const place=EXPLORATION_PLACES.find(p=>p.id===placeId),task=place?.tasks.find(t=>t.id===taskId);
  const placements=useMemo(()=>place?explorationPlacements(place):[],[place]);
  const pets=useMemo(()=>[pet],[pet]);
  const found=(p,t)=>receipts.includes(explorationReceipt(p.id,t.id));
  const suggested=EXPLORATION_PLACES.find(p=>p.tasks.some(t=>!found(p,t)));
  const nextTask=place?.tasks.find(t=>t.id!==taskId&&!found(place,t));
  const nextPlace=place&&[...EXPLORATION_PLACES.slice(EXPLORATION_PLACES.indexOf(place)+1),...EXPLORATION_PLACES.slice(0,EXPLORATION_PLACES.indexOf(place))].find(p=>p.tasks.some(t=>!found(p,t)));
  const collected=EXPLORATION_PLACES.reduce((sum,p)=>sum+p.tasks.filter(t=>receipts.includes(explorationReceipt(p.id,t.id))).length,0);
  useEffect(()=>{if(placeId)detail.current?.scrollIntoView({block:'start',behavior:'instant'});},[placeId]);
  useEffect(()=>()=>stopSpeech?.(),[stopSpeech]);
  useEffect(()=>{if(!reaction)return;const timer=setTimeout(()=>setReaction(''),6000);return()=>clearTimeout(timer);},[reaction]);
  useEffect(()=>{if(renderer==='fallback'&&phase==='walking')setPhase('ready');},[renderer,phase]);
  const visit=id=>{if(id===placeId){detail.current?.scrollIntoView({block:'start',behavior:'instant'});return;}stopSpeech?.();setReaction('');currentTask.current=null;setPlaceId(id);setTaskId(null);setActivity(null);setPhase('idle');setFeedback(null);setTranslation(false);setRenderer('loading');};
  const interact=id=>{
    const next=place.tasks.find(t=>`explore-${t.id}`===id);if(!next)return;
    stopSpeech?.();setReaction('');currentTask.current=id;setTaskId(next.id);setFeedback(null);setTranslation(false);
    setPhase(renderer==='fallback'?'ready':'walking');
    setActivity({type:'environment',placementId:id,petId:pet.id,nonce:++nonce.current});
    requestAnimationFrame(()=>detail.current?.querySelector('.town-scene-wrap')?.scrollIntoView({block:'center',behavior:'instant'}));
  };
  const stopEncounter=()=>{
    currentTask.current=null;setActivity(null);stopSpeech?.();
    if(phase==='walking'||phase==='blocked'){setPhase('idle');setTaskId(null);setFeedback(null);}
    setReaction('先停下腳步，想繼續時再選一個活動就好。');
  };
  const companion=type=>{
    stopEncounter();setActivity({type,petId:pet.id,nonce:++nonce.current});
    setReaction(`${pet.name||'小夥伴'}${{greet:'抬起小爪，和你打招呼！',stretch:'舒服地伸個懶腰，享受一起散步的時光。',hop:'開心地跳了一下，還想陪你去更多地方！'}[type]}`);
    if(type==='greet')onSound?.(petVoice(pet.speciesId),.4);
    requestAnimationFrame(()=>detail.current?.querySelector('.town-scene-wrap')?.scrollIntoView({block:'center',behavior:'instant'}));
  };
  const encounter=event=>{
    if(event.placementId!==currentTask.current)return;
    if(event.phase==='arrived'){setPhase('ready');onSound?.('chime',.18);}
    if(event.phase==='blocked'){setPhase('blocked');setActivity(null);}
    if(event.phase==='finished')setActivity(null);
  };
  const answer=index=>{
    if(phase!=='ready'||!task||feedback?.correct)return;
    const correct=index===task.answer;setFeedback({correct,index});
    if(correct){dispatch({type:'EXPLORE_DISCOVERY',placeId,taskId,answer:index});setActivity({type:'hop',petId:pet.id,nonce:++nonce.current});onSound?.('success',.25);}
  };
  const back=()=>{visit(null);requestAnimationFrame(()=>map.current?.querySelector(`[data-place="${placeId}"]`)?.focus());};
  return <section className="town-world-explorer" aria-label="小島世界地圖">
    <div className="town-world-heading"><div><span className="town-eyebrow">WANDER TOGETHER</span><h2>今天，想去哪裡？</h2><p>六個散步地點，十二個小發現。點地圖，和夥伴一起出發。</p></div><span className="town-passport" aria-label={`旅行印記 ${collected} / 12`}>旅行印記 <b>{collected} / 12</b></span></div>
    <div className="town-travel-suggestion"><span>{suggested?'還有新的風景，等你們一起發現。':'十二個發現都收藏了！選一站，再散步一次吧。'}</span>{suggested&&<button className="town-secondary" onClick={()=>visit(suggested.id)}>繼續探索：{suggested.name}</button>}</div>
    <div className="town-world-map" ref={map}>
      <svg viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="town-map-waves" width="70" height="48" patternUnits="userSpaceOnUse"><path d="M10 20q10 8 20 0t20 0" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="2"/></pattern></defs><rect width="1000" height="650" fill="#c0dfe0"/><rect width="1000" height="650" fill="url(#town-map-waves)"/><path d="M175 485C65 390 160 295 210 220S230 40 390 45 515 130 665 100 895 225 815 355 885 515 675 570 275 650 175 485Z" fill="#f0dfba"/><path d="M198 465C110 380 200 300 240 225S255 72 390 75 530 165 665 130 852 230 780 350 842 485 660 535 285 610 198 465Z" fill="#b5c9a0"/><path d="M220 494Q220 380 300 273T350 104M300 273Q480 300 650 208T680 384 480 526 220 494" stroke="#f6edd2" strokeWidth="22" fill="none" strokeLinecap="round"/><path d="M220 494Q220 380 300 273T350 104M300 273Q480 300 650 208T680 384 480 526 220 494" stroke="#c9b895" strokeWidth="2" strokeDasharray="6 9" fill="none"/>{[[170,340],[440,200],[540,400],[800,270],[400,420],[550,90]].map(([x,y])=><g key={x} transform={`translate(${x} ${y})`}><path d="M0 0v35" stroke="#a58969" strokeWidth="9"/><ellipse rx="29" ry="34" fill="#85a482"/><ellipse cx="14" cy="-10" rx="19" ry="22" fill="#a1bb8c"/></g>)}<text x="850" y="575" fill="#54858c" fontSize="20" textAnchor="middle">N ↑</text></svg>
      {EXPLORATION_PLACES.map(p=><button key={p.id} data-place={p.id} className={`town-map-stop ${p.tasks.every(t=>found(p,t))?'is-complete':''}`} style={{left:`${p.x}%`,top:`${p.y}%`,'--place-color':p.color}} aria-pressed={placeId===p.id} aria-label={`前往${p.name}`} aria-describedby={`map-progress-${p.id}`} onClick={()=>visit(p.id)}><span aria-hidden="true">{p.icon}</span><strong>{p.name}</strong><small id={`map-progress-${p.id}`}>{p.tasks.every(t=>found(p,t))?'✓ 本站已完成':`${p.tasks.filter(t=>found(p,t)).length} / 2 發現`}</small></button>)}
      <span className="town-map-note">SEABREEZE ISLAND · 自由散步</span>
    </div>
    <details className="town-travel-journal"><summary>翻開旅行手帳 · {collected} 個發現</summary><p>收藏一路學到的英文，也可以點卡片回去重遊。</p><div className="town-stamp-grid">{EXPLORATION_PLACES.flatMap(p=>p.tasks.map(t=><button key={`${p.id}-${t.id}`} className={found(p,t)?'is-collected':''} onClick={()=>visit(p.id)} aria-label={`${found(p,t)?'重遊':'探索'}${p.name}：${t.title}`}><small>{p.name} · {found(p,t)?'已收藏':'待發現'}</small><strong>{found(p,t)?t.word:'？'}</strong><span>{found(p,t)?t.zh:t.title}</span></button>))}</div></details>
    {place&&<section className="town-destination" ref={detail} aria-label={place.name}>
      <header><div><small>{place.en}</small><h3>{place.name}</h3><p>{place.description}</p></div><button className="town-secondary" onClick={back}>返回地圖</button></header>
      <div className="town-outing-actions" aria-label="旅途陪伴"><span>也可以先陪夥伴玩一下</span>{[['greet','打招呼'],['stretch','伸懶腰'],['hop','開心跳']].map(([type,label])=><button key={type} className="town-secondary" disabled={renderer==='loading'} onClick={()=>companion(type)}>{label}</button>)}</div>
      <div className="town-destination-layout">
        <div className="town-scene-wrap"><TownScene key={place.id} pets={pets} activePetId={pet.id} placements={placements} activity={activity} scene={place.id} environmentEnabled motion={motion} quality={quality} onStatus={setRenderer} onEnvironment={encounter} onPlacementSelect={interact} onSound={onSound} onPet={()=>companion('greet')} onMove={()=>{setReaction('');setActivity(null);if(phase==='walking'){currentTask.current=null;setPhase('idle');setTaskId(null);}}}/><div className="town-scene-label"><b>{place.name}</b></div>{reaction&&<div className="town-outing-caption" aria-hidden="true">{reaction}</div>}{phase==='walking'&&<button className="town-open-clue" aria-label="停止前往物件" onClick={stopEncounter}>停下腳步</button>}{phase==='ready'&&<button className="town-open-clue" onClick={()=>{const panel=detail.current?.querySelector('.town-discovery-panel');panel?.focus({preventScroll:true});panel?.scrollIntoView({block:'start',behavior:'instant'});}}>查看英文線索 ↓</button>}<div className="town-scene-bottom"><span>{phase==='walking'?'夥伴正走向新發現…':phase==='ready'?'發現線索了！在活動區讀一讀。':'點物件互動 · 點地面散步'}</span></div></div>
        <div className="town-discovery-panel" tabIndex={-1}>
          {reaction&&<p className="town-outing-reaction" role="status">{reaction}</p>}<h4>和夥伴一起找線索</h4><p>點下方活動，或直接點場景裡的物件。</p>
          <div className="town-discovery-actions">{place.tasks.map(t=><button key={t.id} className="town-secondary" aria-pressed={taskId===t.id} disabled={renderer==='loading'} onClick={()=>interact(`explore-${t.id}`)}><span>{t.title}</span><small>{receipts.includes(explorationReceipt(place.id,t.id))?'✓ 已收藏':'探索 →'}</small></button>)}</div>
          {phase==='walking'&&<div className="town-walking-status"><p role="status">{pet.name||'夥伴'}正前往「{task?.title}」…</p><button className="town-secondary" onClick={stopEncounter}>先停下來</button></div>}
          {phase==='blocked'&&<div className="town-walking-status"><p role="status">這條路走不過去，換個角度再試一次。</p><button className="town-secondary" onClick={()=>interact(`explore-${task.id}`)}>重新靠近</button><button className="town-secondary" onClick={stopEncounter}>先停下來</button></div>}
          {renderer==='fallback'&&<p className="town-muted">輕量模式：點活動也能探索、收藏印記。</p>}
          {task&&phase==='ready'&&<div className="town-discovery-clue" key={task.id}>
            <span className="town-eyebrow">A LITTLE DISCOVERY</span><h4>{task.word}{level==='elementary'&&<small> · {task.zh}</small>}</h4>
            <p lang="en">{task.en}</p>{(level==='elementary'||translation)&&<p>{task.translation}</p>}
            <div className="town-discovery-tools">{speak&&<button className="town-text-button" onClick={()=>speak(task.en)}>聽英文線索</button>}{level!=='elementary'&&<button className="town-text-button" aria-expanded={translation} onClick={()=>setTranslation(!translation)}>{translation?'收起中文提示':'看中文提示'}</button>}</div>
            <p lang="en"><strong>{task.prompt}</strong></p><div className="town-discovery-answers">{task.options.map((o,i)=><button key={o.en} className={`town-secondary ${feedback?.index===i?(feedback.correct?'is-answer-correct':'is-answer-retry'):''}`} disabled={feedback?.correct} onClick={()=>answer(i)}><span lang="en">{o.en}</span>{(level==='elementary'||translation)&&<small>{o.zh}</small>}</button>)}</div>
            {feedback&&<p role="status" className={feedback.correct?'is-correct':''}>{feedback.correct?'✓ 發現已收藏！可以換個活動，或繼續去下一站。':'再讀一次上面的線索，慢慢找就好。'}</p>}
            {feedback?.correct&&<div className="town-discovery-next">{nextTask?<button className="town-primary" onClick={()=>interact(`explore-${nextTask.id}`)}>探索下一個：{nextTask.title}</button>:nextPlace?<button className="town-primary" onClick={()=>visit(nextPlace.id)}>下一站：{nextPlace.name}</button>:<p>旅行手帳已集滿，謝謝你和夥伴一起走過小島！</p>}<button className="town-secondary" onClick={back}>回到世界地圖</button></div>}
          </div>}
        </div>
      </div>
    </section>}
    <p className="town-footnote">散步地點全部開放；旅行印記會保存在小鎮。下方故事仍可依原本的進度繼續。</p>
  </section>;
}
