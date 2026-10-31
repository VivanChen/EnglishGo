import { useEffect, useMemo, useRef, useState } from 'react';
import TownScene from './TownScene.jsx';
import { EXPLORATION_PLACES, explorationPlacements, explorationReceipt } from './explorationData.js';
import { petVoice } from './townSounds.js';
import './world-explorer.css';

export default function WorldExplorer({ pet, receipts, dispatch, level='elementary', motion=true, quality='auto', onSound, speak, stopSpeech }) {
  const [placeId,setPlaceId]=useState(null),[taskId,setTaskId]=useState(null),[activity,setActivity]=useState(null);
  const [phase,setPhase]=useState('idle'),[feedback,setFeedback]=useState(null),[translation,setTranslation]=useState(false),[renderer,setRenderer]=useState('loading');
  const map=useRef(null),detail=useRef(null),nonce=useRef(0),currentTask=useRef(null);
  const place=EXPLORATION_PLACES.find(p=>p.id===placeId),task=place?.tasks.find(t=>t.id===taskId);
  const placements=useMemo(()=>place?explorationPlacements(place):[],[place]);
  const pets=useMemo(()=>[pet],[pet]);
  const collected=EXPLORATION_PLACES.reduce((sum,p)=>sum+p.tasks.filter(t=>receipts.includes(explorationReceipt(p.id,t.id))).length,0);
  useEffect(()=>{if(placeId)detail.current?.scrollIntoView({block:'start',behavior:'instant'});},[placeId]);
  useEffect(()=>()=>stopSpeech?.(),[stopSpeech]);
  useEffect(()=>{if(renderer==='fallback'&&phase==='walking')setPhase('ready');},[renderer,phase]);
  const visit=id=>{if(id===placeId){detail.current?.scrollIntoView({block:'start',behavior:'instant'});return;}stopSpeech?.();currentTask.current=null;setPlaceId(id);setTaskId(null);setActivity(null);setPhase('idle');setFeedback(null);setTranslation(false);setRenderer('loading');};
  const interact=id=>{
    const next=place.tasks.find(t=>`explore-${t.id}`===id);if(!next)return;
    stopSpeech?.();currentTask.current=id;setTaskId(next.id);setFeedback(null);setTranslation(false);
    setPhase(renderer==='fallback'?'ready':'walking');
    setActivity({type:'environment',placementId:id,petId:pet.id,nonce:++nonce.current});
    requestAnimationFrame(()=>detail.current?.querySelector('.town-scene-wrap')?.scrollIntoView({block:'center',behavior:'instant'}));
  };
  const encounter=event=>{
    if(event.placementId!==currentTask.current)return;
    if(event.phase==='arrived'){setPhase('ready');onSound?.('chime',.18);}
    if(event.phase==='blocked'){setPhase('blocked');setActivity(null);}
    if(event.phase==='finished')setActivity(null);
  };
  const answer=index=>{
    if(phase!=='ready'||!task)return;
    const correct=index===task.answer;setFeedback({correct,index});
    if(correct){dispatch({type:'EXPLORE_DISCOVERY',placeId,taskId,answer:index});setActivity({type:'hop',petId:pet.id,nonce:++nonce.current});onSound?.('success',.25);}
  };
  const back=()=>{visit(null);requestAnimationFrame(()=>map.current?.querySelector(`[data-place="${placeId}"]`)?.focus());};
  return <section className="town-world-explorer" aria-label="小島世界地圖">
    <div className="town-world-heading"><div><span className="town-eyebrow">WANDER TOGETHER</span><h2>今天，想去哪裡？</h2><p>六個散步地點，十二個小發現。點地圖，和夥伴一起出發。</p></div><span className="town-passport" aria-label={`旅行印記 ${collected} / 12`}>旅行印記 <b>{collected} / 12</b></span></div>
    <div className="town-world-map" ref={map}>
      <svg viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="town-map-waves" width="70" height="48" patternUnits="userSpaceOnUse"><path d="M10 20q10 8 20 0t20 0" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="2"/></pattern></defs><rect width="1000" height="650" fill="#c0dfe0"/><rect width="1000" height="650" fill="url(#town-map-waves)"/><path d="M175 485C65 390 160 295 210 220S230 40 390 45 515 130 665 100 895 225 815 355 885 515 675 570 275 650 175 485Z" fill="#f0dfba"/><path d="M198 465C110 380 200 300 240 225S255 72 390 75 530 165 665 130 852 230 780 350 842 485 660 535 285 610 198 465Z" fill="#b5c9a0"/><path d="M220 494Q220 380 300 273T350 104M300 273Q480 300 650 208T680 384 480 526 220 494" stroke="#f6edd2" strokeWidth="22" fill="none" strokeLinecap="round"/><path d="M220 494Q220 380 300 273T350 104M300 273Q480 300 650 208T680 384 480 526 220 494" stroke="#c9b895" strokeWidth="2" strokeDasharray="6 9" fill="none"/>{[[170,340],[440,200],[540,400],[800,270],[400,420],[550,90]].map(([x,y])=><g key={x} transform={`translate(${x} ${y})`}><path d="M0 0v35" stroke="#a58969" strokeWidth="9"/><ellipse rx="29" ry="34" fill="#85a482"/><ellipse cx="14" cy="-10" rx="19" ry="22" fill="#a1bb8c"/></g>)}<text x="850" y="575" fill="#54858c" fontSize="20" textAnchor="middle">N ↑</text></svg>
      {EXPLORATION_PLACES.map(p=><button key={p.id} data-place={p.id} className="town-map-stop" style={{left:`${p.x}%`,top:`${p.y}%`,'--place-color':p.color}} aria-pressed={placeId===p.id} aria-label={`前往${p.name}`} onClick={()=>visit(p.id)}><span aria-hidden="true">{p.icon}</span><strong>{p.name}</strong><small>{p.tasks.filter(t=>receipts.includes(explorationReceipt(p.id,t.id))).length} / 2 發現</small></button>)}
      <span className="town-map-note">SEABREEZE ISLAND · 自由散步</span>
    </div>
    {place&&<section className="town-destination" ref={detail} aria-label={place.name}>
      <header><div><small>{place.en}</small><h3>{place.name}</h3><p>{place.description}</p></div><button className="town-secondary" onClick={back}>返回地圖</button></header>
      <div className="town-destination-layout">
        <div className="town-scene-wrap"><TownScene key={place.id} pets={pets} activePetId={pet.id} placements={placements} activity={activity} scene={place.id} environmentEnabled motion={motion} quality={quality} onStatus={setRenderer} onEnvironment={encounter} onPlacementSelect={interact} onSound={onSound} onPet={()=>{if(phase==='walking'){currentTask.current=null;setPhase('idle');setTaskId(null);}setActivity({type:'greet',petId:pet.id,nonce:++nonce.current});onSound?.(petVoice(pet.speciesId),.4);}} onMove={()=>{setActivity(null);if(phase==='walking'){currentTask.current=null;setPhase('idle');setTaskId(null);}}}/><div className="town-scene-label"><b>{place.name}</b></div><div className="town-scene-bottom"><span>{phase==='walking'?'夥伴正走向新發現…':phase==='ready'?'發現線索了！在活動區讀一讀。':'點物件互動 · 點地面散步'}</span></div></div>
        <div className="town-discovery-panel">
          <h4>和夥伴一起找線索</h4><p>點下方活動，或直接點場景裡的物件。</p>
          <div className="town-discovery-actions">{place.tasks.map(t=><button key={t.id} className="town-secondary" aria-pressed={taskId===t.id} disabled={renderer==='loading'} onClick={()=>interact(`explore-${t.id}`)}><span>{t.title}</span><small>{receipts.includes(explorationReceipt(place.id,t.id))?'✓ 已收藏':'探索 →'}</small></button>)}</div>
          {phase==='walking'&&<p role="status">一起走近看看…</p>}
          {phase==='blocked'&&<p role="status">這條路走不過去，點活動再試一次。</p>}
          {renderer==='fallback'&&<p className="town-muted">輕量模式：點活動也能探索、收藏印記。</p>}
          {task&&phase==='ready'&&<div className="town-discovery-clue" key={task.id}>
            <span className="town-eyebrow">A LITTLE DISCOVERY</span><h4>{task.word}{level==='elementary'&&<small> · {task.zh}</small>}</h4>
            <p lang="en">{task.en}</p>{(level==='elementary'||translation)&&<p>{task.translation}</p>}
            <div className="town-discovery-tools">{speak&&<button className="town-text-button" onClick={()=>speak(task.en)}>聽英文線索</button>}{level!=='elementary'&&<button className="town-text-button" aria-expanded={translation} onClick={()=>setTranslation(!translation)}>{translation?'收起中文提示':'看中文提示'}</button>}</div>
            <p lang="en"><strong>{task.prompt}</strong></p><div className="town-discovery-answers">{task.options.map((o,i)=><button key={o.en} className="town-secondary" disabled={feedback?.correct} onClick={()=>answer(i)}><span lang="en">{o.en}</span>{(level==='elementary'||translation)&&<small>{o.zh}</small>}</button>)}</div>
            {feedback&&<p role="status" className={feedback.correct?'is-correct':''}>{feedback.correct?'✓ 發現已收藏！可以換個活動，或繼續去下一站。':'再讀一次上面的線索，慢慢找就好。'}</p>}
          </div>}
        </div>
      </div>
    </section>}
    <p className="town-footnote">散步地點全部開放；旅行印記會保存在小鎮。下方故事仍可依原本的進度繼續。</p>
  </section>;
}
