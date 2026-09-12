import { useEffect, useRef, useState } from 'react';
import PetCharacterScene from './PetCharacterScene.jsx';
import './pet-showcase.css';
import './pet-care-studio.css';

// The interaction layer remains usable when WebGL is unavailable.
export default function PetCareStudio({petId, action, food, words=[], prompt, speak, stopSpeech, onReady, motion='full'}) {
  const washArea=useRef(null),washPointer=useRef(null),focusNextWash=useRef(false),foodControl=useRef(null),suppressClick=useRef(false),restControl=useRef(null),target=useRef(null), reaction=useRef(-5000),playTimer=useRef(null),playBusy=useRef(false), cleaned=useRef(new Set()),count=useRef(0), drag=useRef(null);
  const [sceneStatus,setSceneStatus]=useState('loading'),[playing,setPlaying]=useState(false),[progress,setProgress]=useState(0),[washed,setWashed]=useState([]),[holding,setHolding]=useState(false),[cursor,setCursor]=useState(null),[missed,setMissed]=useState(false);
  const restSteps=['調暗小夜燈','蓋好小被被','輕聲說晚安'];
  const [pages]=useState(()=>{const list=[...new Set(words.filter(w=>typeof w==='string'&&w.trim()).map(w=>w.trim()))].slice(0,3);return list.length?list:[prompt||'Let’s learn together.']});
  const speech=useRef(stopSpeech);speech.current=stopSpeech;
  useEffect(()=>()=>{if(action==='study')speech.current?.()},[action]);
  const required=action==='study'?pages.length:action==='clean'?4:3;
  const done=progress>=required;
  useEffect(()=>{if((action==='sleep'||action==='study')&&!done&&sceneStatus!=='loading')restControl.current?.focus({preventScroll:true})},[action,progress,sceneStatus,done]);
  const advance=()=>{if(count.current>=required)return;reaction.current=performance.now();count.current+=1;setProgress(count.current);};
  useEffect(()=>()=>clearTimeout(playTimer.current),[]);
  const toss=()=>{
    if(sceneStatus==='loading'||playBusy.current||count.current>=required)return;
    playBusy.current=true;setPlaying(true);reaction.current=performance.now();
    playTimer.current=setTimeout(()=>{playBusy.current=false;setPlaying(false);count.current+=1;setProgress(count.current)},1200);
  };
  const wash=(n,keyboard=false)=>{if(n<0||n>3||cleaned.current.has(n))return;focusNextWash.current=keyboard;cleaned.current.add(n);setWashed(v=>v.includes(n)?v:[...v,n]);advance();};
  useEffect(()=>{if(action==='clean'&&focusNextWash.current){focusNextWash.current=false;washArea.current?.querySelector('button:not(:disabled)')?.focus({preventScroll:true})}},[action,washed]);
  const wipeAt=e=>{const button=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-wash]');if(button&&washArea.current?.contains(button))wash(Number(button.dataset.wash)-1)};
  const stopWiping=e=>{if(washPointer.current===e.pointerId)washPointer.current=null};
  useEffect(()=>{onReady?.(done)},[done,onReady]);
  const eat=()=>{if(count.current>=required)return;setMissed(false);setHolding(false);advance();};
  useEffect(()=>{if(action==='feed'&&progress>0&&!done)foodControl.current?.focus({preventScroll:true})},[action,progress,done]);
  useEffect(()=>{if(action==='feed'&&holding&&!drag.current)target.current?.focus({preventScroll:true})},[action,holding]);
  const clearDrag=()=>{drag.current=null;setCursor(null);setHolding(false)};
  const drop=e=>{
    if(!drag.current||drag.current.id!==e.pointerId)return;
    const moved=drag.current.moved;
    if(moved){
      suppressClick.current=true;
      const r=target.current?.getBoundingClientRect();
      if(r&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)eat();
      else{setMissed(true);foodControl.current?.focus({preventScroll:true})}
    }
    clearDrag();
  };
  return <section className={`pc-studio ${action==='sleep'?'pc-rest':action==='study'?'pc-study':''}`} data-rest-stage={action==='sleep'?progress:undefined} aria-label="立體寵物照顧">
    <div className="pc-stage">
      <span className="pc-label">{action==='study'?'OUR LITTLE BOOK':action==='sleep'?'A LITTLE GOOD NIGHT':action==='play'?'FETCH & FRIENDS':action==='clean'?'BUBBLE BATH':'SNACK TIME'} · 陪伴小時光</span>
      <div className="pc-canvas"><PetCharacterScene petId={petId} motion={motion} reaction={reaction} activity={action} washed={washed} foodId={food?.id} bites={action==='feed'?progress:0} restStage={action==='sleep'?progress:0} targetRef={target} onStatus={setSceneStatus}/></div>
      {action==='sleep'?<span className="pc-rest-moon" aria-hidden="true">{progress>=2?'☾ z z':'☾'}</span>:(action==='play'||action==='study')?null:action==='clean'?<div ref={washArea} className="pc-spots" aria-label="清潔四處泡泡" onPointerDown={e=>{if(e.button!==0||washPointer.current!==null)return;washPointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);wipeAt(e)}} onPointerMove={e=>{if(washPointer.current===e.pointerId)wipeAt(e)}} onPointerUp={stopWiping} onPointerCancel={stopWiping} onLostPointerCapture={stopWiping}>{[0,1,2,3].map(n=><button key={n} data-wash={n+1} className={washed.includes(n)?'is-clean':''} disabled={washed.includes(n)} aria-label={`擦洗第 ${n+1} 處髒污`} onClick={e=>wash(n,e.detail===0)}><span aria-hidden="true">{washed.includes(n)?'✓':'🫧'}</span><small>{washed.includes(n)?'洗好了':`第 ${n+1} 處`}</small></button>)}</div>:<button ref={target} className="pc-mouth" aria-label="餵一口" disabled={done||!holding} onClick={eat}>{done?'好好吃！':'餵到這裡'}</button>}
      {progress>0&&action!=='sleep'&&<span key={progress} className="pc-feedback-burst" aria-hidden="true">{action==='clean'?'✧':'♡'}</span>}
      {cursor&&<span className="pc-drag" style={{left:cursor.x,top:cursor.y}}>{food?.emoji||'🍎'}</span>}
      <span className="pc-response" role="status">{action==='clean'?(done?'♡ 泡泡都洗掉了，清清爽爽！':progress?`好舒服！還有 ${4-progress} 處泡泡。`:'泡泡準備好了，幫我洗香香吧。'):action==='feed'&&missed?'差一點點！再把食物送到嘴邊吧。':action==='feed'&&holding?'啊～準備好吃這一口了！':action==='study'?(done?'♡ 書籤夾好了，今天又一起學會了一點。':'我準備好了，念給我聽吧。'):action==='sleep'?['今天想安靜地陪著你。','燈光柔和了，好舒服。','被子暖暖的，眼睛也閉起來了。','晚安，謝謝你今天的陪伴。'][progress]:action==='play'?(done?'♡ 三次都接到了！玩得好開心。':playing?'追到了！把球帶回來囉…':progress?'再丟一次，我準備好了！':'把球丟給我吧！'):done?'♡ 謝謝你照顧我！':progress? action==='clean'?'亮晶晶，再洗一下！':'啊嗚！還想再吃一口。':action==='feed'?'肚子準備好了，一起吃點好吃的。':'今天也想和你一起玩'}</span>
    </div>
    <p className="pc-instruction">{action==='study'?'聽一聽、念一念，再親手翻頁。不需要麥克風。':action==='sleep'?'調暗燈光、蓋好被子，再輕聲說晚安。':action==='play'?'丟球給夥伴，等牠帶回來。三回合，慢慢玩。':action==='clean'?'按住滑過四處泡泡，或逐一點按；放開就停止擦洗。':'拖食物到嘴邊，或先點食物再點「餵到這裡」。'}</p>
    {action==='sleep'&&<><ol className="pc-rest-steps" aria-label="晚安步驟">{restSteps.map((label,i)=><li key={label} aria-current={progress===i?'step':undefined} className={progress>i?'is-done':''}><span>{progress>i?'✓':i+1}</span>{label}</li>)}</ol><button key={progress} ref={restControl} className="pc-rest-action" disabled={sceneStatus==='loading'||done} onClick={advance}>{sceneStatus==='loading'?'夥伴準備中…':done?'晚安準備完成 ✓':restSteps[progress]}</button></>}
    {action==='study'&&<div className="pc-book"><small>{done?'今日共讀完成':`第 ${progress+1} / ${required} 頁`}</small><strong lang="en">{pages[Math.min(progress,required-1)]}</strong><button className="pc-listen" disabled={done} onClick={()=>{stopSpeech?.();speak?.(pages[progress])}}>♫ 聽這一頁</button><button key={progress} ref={restControl} className="pc-study-next" disabled={sceneStatus==='loading'||done} onClick={()=>{stopSpeech?.();advance()}}>{done?'書籤已夾好 ✓':progress===required-1?'這頁讀好了，夾上書籤':'這頁讀好了，翻下一頁'}</button></div>}
    {action==='play'&&<button className="pc-toss" disabled={sceneStatus==='loading'||done||playing} onClick={toss}>{sceneStatus==='loading'?'夥伴準備中…':playing?'正在接球…':done?'三回合完成 ✓':'🎾 丟球給夥伴'}</button>}
    {action==='feed'&&<><ol className="pc-portions" aria-label="三口食物份量">{[0,1,2].map(n=><li key={n} className={n<progress?'is-eaten':''} aria-label={`第 ${n+1} 口${n<progress?'已吃完':'待餵食'}`}><span aria-hidden="true">{n<progress?'✓':food?.emoji||'🍎'}</span></li>)}</ol><button ref={foodControl} className="pc-food" disabled={done} aria-pressed={holding} onClick={e=>{if(suppressClick.current&&e.detail!==0){suppressClick.current=false;return}if(done)return;setMissed(false);setHolding(true);target.current?.focus({preventScroll:true})}} onPointerDown={e=>{if(done||e.button!==0||drag.current)return;suppressClick.current=false;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};e.currentTarget.setPointerCapture(e.pointerId);setMissed(false);setHolding(true)}} onPointerMove={e=>{const active=drag.current;if(!active||active.id!==e.pointerId)return;if(Math.hypot(e.clientX-active.x,e.clientY-active.y)>8)active.moved=true;if(active.moved)setCursor({x:e.clientX,y:e.clientY})}} onPointerUp={drop} onPointerCancel={()=>{suppressClick.current=true;clearDrag()}} onLostPointerCapture={()=>{if(drag.current)clearDrag()}}>{done?'三口都吃完了 ✓':food?.emoji||'🍎'} {!done&&(holding?'食物拿好了':'拿起'+(food?.name||'食物'))}</button></>}
    <div className="pc-progress"><progress aria-label="照顧互動進度" max={required} value={progress}/><span>{progress}/{required} {action==='study'?'頁':action==='sleep'?'步':action==='play'?'回合':action==='clean'?'處洗乾淨':'口'}{action==='feed'?' · 共使用 1 份食物':''}</span></div>
  </section>;
}
