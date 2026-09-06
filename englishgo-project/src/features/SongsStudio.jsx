import { useState, useEffect, useMemo, useRef } from 'react';
import { songRecord, songLineRange } from '../data/learningWorkshops.js';
import { useWorkshopStorage } from './workshopStorage.js';
import SongSingAlong from './SongSingAlong.jsx';
import PracticeArt from '../components/PracticeArt.jsx';
export default function SongsStudio({lv,onBack,onXp,deps}){
  const { SONGS, LV, S, readingWords, shuffleCopy, scrollChildIntoPanel, speak, stopSpeech, Hdr } = deps;
  const { book, live, save, saveError } = useWorkshopStorage(`eg_song_studio_${lv}`);
  const [phrase, setPhrase] = useState(0), [segmentMode, setSegmentMode] = useState('off');
  const segment = useRef(null), playWanted = useRef(false), playToken = useRef(0), practiceLive = useRef(null), mounted = useRef(false);
  const songs=SONGS[lv]||[];const c=LV[lv];const[si,setSi]=useState(()=>Math.max(0,songs.findIndex(s=>s.id===book.selected)));const[time,setTime]=useState(0);const[dur,setDur]=useState(0);const[playing,setPlaying]=useState(false);const[audioLoading,setAudioLoading]=useState(true);const[audioError,setAudioError]=useState("");const[showZh,setShowZh]=useState(book.showZh!==false);const[view,setView]=useState("lyrics");const[speed,setSpeed]=useState([.85,1,1.15].includes(book.speed)?book.speed:1);const[practice,setPractice]=useState({idx:0,pick:null,score:0,done:false});const[timingDraft,setTimingDraft]=useState([]);const[timingExport,setTimingExport]=useState("");const audioRef=useRef(null);const lineRefs=useRef({});const songPanelRef=useRef(null);
  const timingMode=useMemo(()=>{try{return new URLSearchParams(window.location.search).get("timing")==="1"}catch{return false}},[]);
  const song=songs[si];const songLines=timingMode&&timingDraft.length?timingDraft:(song?.lines||[]);const lyricLines=useMemo(()=>songLines.map((l,i)=>({...l,i})).filter(l=>l.en),[songLines]);
  const singLines = lyricLines.filter(line => !/^\([^)]*\)$/.test(line.en));
  const singLine = singLines[Math.min(phrase, singLines.length - 1)];
  const record = song ? songRecord(book, song) : {};
  const writeRecord = (change, render = true) => {
    if (!song) return;
    const updated = change(songRecord(live.current, song));
    const next = { ...live.current, selected: render ? song.id : live.current.selected || song.id, songs: { ...live.current.songs, [song.id]: updated } };
    if (render && mounted.current) save(next);
    else { live.current = next; try { localStorage.setItem(`eg_song_studio_${lv}`, JSON.stringify(next)); } catch {} }
  };
  const persistPractice = next => { practiceLive.current = next; setPractice(next); writeRecord(r => ({ ...r, practice: next })); };
  const stopSegment = () => { segment.current = null; setSegmentMode('off'); };
  const pauseAudio = (clear = false) => { playWanted.current=false; playToken.current++; if (clear) stopSegment(); try { audioRef.current?.pause(); } catch {} setPlaying(false); };
  const leave = () => { pauseAudio(true); stopSpeech(); onBack(); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; playWanted.current=false; playToken.current++; stopSpeech(); }; }, [stopSpeech]);
  const hasAudio=!!song?.audio;
  const hasCover=!!song?.cover;
  const weights=useMemo(()=>lyricLines.map(l=>Math.max(1,readingWords(l.en).length)),[lyricLines]);
  const totalWeight=weights.reduce((a,b)=>a+b,0)||1;
  const hasTimedLyrics=lyricLines.length>0&&lyricLines.every(l=>Number.isFinite(Number(l.t)));
  const activeLine=useMemo(()=>{
    if(!lyricLines.length)return -1;
    if(!hasAudio)return -1;
    if(hasTimedLyrics){
      if(time<Number(lyricLines[0].t)-0.15)return -1;
      for(let i=lyricLines.length-1;i>=0;i--){if(time>=Number(lyricLines[i].t)-0.15)return lyricLines[i].i}
      return -1;
    }
    if(!dur)return lyricLines[0]?.i??-1;
    let pos=(time/dur)*totalWeight,acc=0;for(let i=0;i<lyricLines.length;i++){acc+=weights[i];if(pos<=acc)return lyricLines[i].i}return lyricLines.at(-1)?.i??-1
  },[time,dur,totalWeight,weights,lyricLines,hasTimedLyrics,hasAudio]);
  const activeLyricIdx=useMemo(()=>lyricLines.findIndex(l=>l.i===activeLine),[lyricLines,activeLine]);
  const activeLyric=activeLyricIdx>=0?lyricLines[activeLyricIdx]:null;
  const linePct=useMemo(()=>{if(activeLyricIdx<0||!dur)return 0;const cur=Number(lyricLines[activeLyricIdx].t);const nxt=Number(lyricLines[activeLyricIdx+1]?.t||dur);if(!Number.isFinite(cur)||!Number.isFinite(nxt)||nxt<=cur)return 0;return Math.max(0,Math.min(100,((time-cur)/(nxt-cur))*100))},[activeLyricIdx,lyricLines,time,dur]);
  const practiceItems=useMemo(()=>{
    if(!song)return[];
    const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const vocab=[...new Set((song.vocab||[]).filter(Boolean))];
    return lyricLines.map((line,idx)=>{
      const word=vocab.find(w=>new RegExp(`\\b${esc(w)}\\b`,"i").test(line.en));
      if(!word)return null;
      const blank=line.en.replace(new RegExp(`\\b${esc(word)}\\b`,"i"),"____");
      const distractors=shuffleCopy(vocab.filter(w=>w!==word)).slice(0,3);
      return{line,idx,word,blank,options:shuffleCopy([word,...distractors])};
    }).filter(Boolean).slice(0,8);
  },[song,lyricLines]);
  const currentPractice=practiceItems[practice.idx];
  useEffect(()=>{
    const stored = song ? songRecord(live.current, song).practice : {};
    const next = { idx: Number.isInteger(stored.idx) ? Math.min(Math.max(0, stored.idx), Math.max(0, practiceItems.length-1)) : 0, pick: typeof stored.pick === 'string' ? stored.pick : null, score: Math.max(0, Number(stored.score)||0), done: stored.done===true };
    practiceLive.current=next;setPractice(next);setPhrase(0);stopSegment();setTimingDraft((song?.lines||[]).map(l=>({...l})));setTimingExport("");setAudioError("");setAudioLoading(true);lineRefs.current={};setView("lyrics");songPanelRef.current?.scrollTo({top:0});
  },[song?.id]);
  useEffect(()=>{if(view!=="lyrics")songPanelRef.current?.scrollTo({top:0})},[view]);
  useEffect(()=>{const a=audioRef.current;if(a)a.playbackRate=speed},[speed,song?.id]);
  useEffect(()=>{
    const a=audioRef.current;if(!a)return; let lastSaved = -10, current = true, frame = null, metadataReady = false;
    const storePosition = (render=true) => { if(metadataReady)writeRecord(r=>({...r,position:a.currentTime||0}),render); };
    const onTime=()=>{
      const clip=segment.current;
      if(clip&&a.currentTime>=clip.end-.04){
        if(clip.repeat){a.currentTime=clip.start;}
        else {if(!a.paused)a.pause();if(Math.abs(a.currentTime-clip.end)>.08)a.currentTime=clip.end;}
      }
      setTime(a.currentTime||0);
      if(Math.abs(a.currentTime-lastSaved)>3){lastSaved=a.currentTime;storePosition();}
    };
    const onLoadStart=()=>{setAudioLoading(true);setAudioError("")};
    const onMeta=()=>{setDur(a.duration||0);setAudioLoading(false);setAudioError("");const position=songRecord(live.current,song).position;if(position>0&&Number.isFinite(a.duration))a.currentTime=Math.min(position,Math.max(0,a.duration-.1));metadataReady=true;setTime(a.currentTime||0);};
    const onCanPlay=()=>setAudioLoading(false);
    const watchBoundary=()=>{if(!current||a.paused)return;if(segment.current&&a.currentTime>=segment.current.end-.025)onTime();frame=requestAnimationFrame(watchBoundary)};
    const onPlay=()=>{setPlaying(true);setAudioLoading(false);setAudioError("");cancelAnimationFrame(frame);frame=requestAnimationFrame(watchBoundary)};
    const onPause=()=>{cancelAnimationFrame(frame);setPlaying(false);storePosition()};
    const onError=()=>{setPlaying(false);setAudioLoading(false);setAudioError("歌曲音訊載入失敗，請按「重新載入」後再試。")};
    const onEnd=()=>{
      const clip=segment.current;
      if(clip?.repeat){a.currentTime=clip.start;const token=++playToken.current;Promise.resolve(a.play()).then(()=>{if(token!==playToken.current&&(!playWanted.current||audioRef.current!==a))a.pause()}).catch(()=>{if(current&&token===playToken.current)onError()});return;}
      setPlaying(false);
      if(!clip&&!songRecord(live.current,song).listened){writeRecord(r=>({...r,listened:true,position:0}));onXp?.(10);}
    };
    const hide=()=>{if(document.hidden){playWanted.current=false;playToken.current++;a.pause();storePosition();}};
    const events={timeupdate:onTime,loadstart:onLoadStart,loadedmetadata:onMeta,canplay:onCanPlay,play:onPlay,pause:onPause,error:onError,ended:onEnd};
    Object.entries(events).forEach(([name,handler])=>a.addEventListener(name,handler));document.addEventListener('visibilitychange',hide);
    if(a.readyState>=1)onMeta();
    return()=>{current=false;cancelAnimationFrame(frame);Object.entries(events).forEach(([name,handler])=>a.removeEventListener(name,handler));document.removeEventListener('visibilitychange',hide);storePosition(false);playWanted.current=false;playToken.current++;if(!/jsdom/i.test(navigator.userAgent)){try{a.pause()}catch{}}};
  },[song?.id]);
  useEffect(()=>{if(view==="lyrics"&&activeLine>=0)scrollChildIntoPanel(songPanelRef.current,lineRefs.current[activeLine],{align:.42})},[activeLine,view,showZh,song?.id]);
  if(!song)return(<div className="practice-world songs-studio"><Hdr t="🎵 英文歌曲" onBack={leave} cl={c.cl}/><div style={{...S.card,padding:"28px 18px",textAlign:"center"}}><div style={{fontSize:42,marginBottom:8}}>🎧</div><div style={{fontSize:16,fontWeight:700,color:S.t1}}>這個年級的歌曲準備中</div><div style={{fontSize:13,color:S.t2,marginTop:6}}>先從小學歌曲開始驗證流程，之後可逐步加入更多歌曲。</div></div></div>);
  const fmt=s=>`${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,"0")}`;
  const fmt1=s=>`${fmt(s)}.${Math.floor(((s||0)%1)*10)}`;
  const roundTime=s=>Math.max(0,Math.round(Number(s||0)*10)/10);
  const updateLineTime=(idx,next)=>setTimingDraft(lines=>lines.map((line,i)=>i===idx?{...line,t:roundTime(next)}:line));
  const nudgeLine=(idx,delta)=>setTimingDraft(lines=>lines.map((line,i)=>i===idx?{...line,t:roundTime(Number(line.t||0)+delta)}:line));
  const nudgeAll=delta=>setTimingDraft(lines=>lines.map(line=>Number.isFinite(Number(line.t))?{...line,t:roundTime(Number(line.t)+delta)}:line));
  const exportTimings=()=>{const text=`lines:[\n${(timingDraft.length?timingDraft:song.lines).map(line=>line.sec?`  {sec:${JSON.stringify(line.sec)}},`:`  {t:${roundTime(line.t)},en:${JSON.stringify(line.en)},zh:${JSON.stringify(line.zh)}},`).join("\n")}\n]`;setTimingExport(text);navigator.clipboard?.writeText(text).catch(()=>{})};
  const calcStart=(line)=>{
    const idx=lyricLines.findIndex(l=>l.i===line?.i);if(idx<0)return 0;
    const timed=Number(line.t);
    return Number.isFinite(timed)?timed:weights.slice(0,idx).reduce((a,b)=>a+b,0)/totalWeight*(dur||0);
  };
  const play=()=>{const a=audioRef.current;if(!a)return;playWanted.current=true;const token=++playToken.current;stopSpeech();setAudioError("");setAudioLoading(a.readyState<2);a.playbackRate=speed;Promise.resolve(a.play()).then(()=>{if(token!==playToken.current&&(!playWanted.current||audioRef.current!==a))a.pause()}).catch(()=>{if(token!==playToken.current)return;setPlaying(false);setAudioLoading(false);setAudioError("歌曲無法播放，請按「重新載入」後再試。")})};
  const toggle=()=>{const a=audioRef.current;if(!a)return;stopSegment();if(a.paused)play();else pauseAudio()};
  const seekTo=(sec,auto=false)=>{const a=audioRef.current;if(!a)return;stopSegment();a.currentTime=Math.max(0,Math.min(sec,dur||sec));setTime(a.currentTime);writeRecord(r=>({...r,position:a.currentTime}));if(auto)play()};
  const retryAudio=()=>{const a=audioRef.current;if(!a)return;try{a.pause()}catch{}setPlaying(false);setTime(0);setDur(0);setAudioError("");setAudioLoading(true);a.load();play()};
  const playLine=(line,repeat=false)=>{const range=songLineRange(songLines,line?.i,dur);if(!range)return;pauseAudio();segment.current={...range,repeat};setSegmentMode(repeat?'repeat':'once');audioRef.current.currentTime=range.start;setTime(range.start);play()};
  const seekLine=(line,auto=true)=>{if(auto&&songLineRange(songLines,line?.i,dur))playLine(line);else seekTo(calcStart(line),auto)};
  const jumpLine=(delta)=>{if(!lyricLines.length)return;const base=activeLyricIdx>=0?activeLyricIdx:0;const next=Math.max(0,Math.min(lyricLines.length-1,base+delta));seekLine(lyricLines[next],true)};
  const choosePractice=(opt)=>{const current=practiceLive.current;if(!currentPractice||current?.pick)return;const ok=opt===currentPractice.word;persistPractice({...current,pick:opt,score:current.score+(ok?1:0)});const key=String(currentPractice.line.i);if(ok&&!songRecord(live.current,song).earned[key]){writeRecord(r=>({...r,earned:{...r.earned,[key]:true}}));onXp?.(2)}};
  const nextPractice=()=>{const current=practiceLive.current;if(!current?.pick)return;pauseAudio(true);persistPractice(current.idx>=practiceItems.length-1?{...current,done:true,pick:null}:{...current,idx:current.idx+1,pick:null})};
  const resetPractice=()=>{pauseAudio(true);persistPractice({idx:0,pick:null,score:0,done:false})};
  const retryPractice=()=>{const p=practiceLive.current;if(p?.pick&&p.pick!==currentPractice?.word)persistPractice({...p,pick:null})};
  const switchView=next=>{pauseAudio(true);setView(next);};
  const chooseSong=index=>{if(index===si)return;pauseAudio(true);save({...live.current,selected:songs[index].id});setSi(index);setTime(0);setDur(0);};
  const changeSpeed=value=>{setSpeed(value);save({...live.current,speed:value});};
  const toggleChinese=()=>{setShowZh(!showZh);save({...live.current,showZh:!showZh});};
  const choosePhrase=index=>{pauseAudio(true);setPhrase(index);};
  const markPhrase=()=>{pauseAudio(true);writeRecord(r=>({...r,practiced:[...new Set([...r.practiced,singLine.i])]}));};
  const tabStyle=k=>({padding:"8px 12px",borderRadius:999,border:"none",background:view===k?c.cl:S.bg2,color:view===k?"#fff":S.t2,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"});
  return(<div className="practice-world songs-studio"><Hdr t="🎵 英文歌曲" onBack={leave} cl={c.cl} extra={<button onClick={toggleChinese} style={{background:S.bg1,border:`1px solid ${S.bd}`,borderRadius:8,padding:"5px 9px",fontSize:12,color:c.cl,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{showZh?"隱藏中文":"顯示中文"}</button>}/>
    {songs.length>1&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:7,marginBottom:10}}>{songs.map((s,i)=><button key={s.id} aria-pressed={i===si} onClick={()=>chooseSong(i)} style={{padding:"10px 11px",borderRadius:12,background:i===si?c.cl:S.bg1,color:i===si?"#fff":S.t1,border:`1px solid ${i===si?c.cl:S.bd}`,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",textAlign:"left",boxShadow:i===si?"0 8px 18px rgba(15,110,86,.18)":"none"}}><div>{s.title}</div><div style={{fontSize:11,fontWeight:600,opacity:.72,marginTop:2}}>{s.theme}</div></button>)}</div>}
    <div className="song-player" style={{...S.card,padding:"18px 16px",marginBottom:10,borderTop:`4px solid ${c.cl}`,background:`linear-gradient(135deg,${c.bg}55,var(--color-background-primary,#fff))`}}>
      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>{hasCover?<button type="button" onClick={()=>hasAudio&&toggle()} aria-label={playing?"暫停歌曲":"播放歌曲"} title={playing?"暫停歌曲":"播放歌曲"} style={{position:"relative",width:"clamp(118px,28vw,172px)",aspectRatio:"1/1",border:`1px solid ${S.bd}`,borderRadius:16,overflow:"hidden",padding:0,background:S.bg2,boxShadow:"0 16px 34px rgba(0,0,0,.18)",cursor:hasAudio?"pointer":"default",flex:"0 0 auto"}}><img src={song.cover} alt={`${song.title} cover`} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/><span style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",width:54,height:54,borderRadius:999,background:"rgba(20,24,28,.84)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:playing?24:25,fontWeight:900,boxShadow:"0 10px 22px rgba(0,0,0,.35)"}}>{playing?"Ⅱ":"▶"}</span></button>:<div className="song-art"><PracticeArt kind="listening"/></div>}<div style={{flex:"1 1 220px",minWidth:0}}><div style={{fontSize:21,fontWeight:900,color:S.t1,lineHeight:1.2}}>{song.title}</div><div style={{fontSize:12,color:S.t2,marginTop:3}}>{song.zhTitle} · {song.theme} · {song.level}</div></div></div>
      {hasAudio?<><audio key={song.id} ref={audioRef} src={song.audio} preload="metadata"/>
      <div style={{padding:"12px",borderRadius:14,background:S.bg1,border:`1px solid ${S.bd}`,marginBottom:10}}><div style={{fontSize:11,fontWeight:800,color:"var(--garden-green)",marginBottom:5}}>現在播放</div><div style={{fontSize:16,fontWeight:900,color:S.t1,lineHeight:1.45,minHeight:24}}>{activeLyric?.en||"點播放開始，或點任一句歌詞重播。"}</div>{showZh&&activeLyric?.zh&&<div style={{fontSize:12,color:S.t2,lineHeight:1.5,marginTop:2}}>{activeLyric.zh}</div>}<div style={{height:4,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:9}}><div style={{height:"100%",width:`${linePct}%`,background:c.cl,borderRadius:999}}/></div></div>
      <input className="song-seek" type="range" aria-label="歌曲播放位置" min="0" max={Number.isFinite(dur)&&dur>0?dur:1} step="0.1" value={Math.min(time,dur||0)} disabled={!dur} onChange={e=>seekTo(Number(e.target.value),false)}/>
      <div style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:S.t3,marginBottom:10}}><span>{fmt(time)}</span><span style={{flex:1,textAlign:"center"}}>{audioError?"播放失敗":playing?"播放中":audioLoading&&!dur?"音訊載入中":"已暫停"}</span><span>{fmt(dur||0)}</span></div>
      {audioError&&<div role="alert" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",padding:"10px 11px",marginBottom:10,border:"1px solid #D96C5F",borderRadius:11,background:"#FFF1EF",color:"#8F2F25",fontSize:12,fontWeight:750,lineHeight:1.5}}><span>{audioError}</span><button onClick={retryAudio} style={{...S.btn,padding:"7px 11px",fontSize:12,background:"#8F2F25",color:"#fff",flex:"0 0 auto"}}>重新載入</button></div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:8}}><button onClick={()=>jumpLine(-1)} style={{...S.btn,padding:"9px 0",fontSize:12,background:S.bg2,color:S.t1}}>上一句</button><button onClick={()=>seekTo(time-5)} style={{...S.btn,padding:"9px 0",fontSize:12,background:S.bg2,color:S.t1}}>-5秒</button><button onClick={toggle} style={{...S.btn,padding:"9px 0",fontSize:13,background:c.cl,color:"#fff"}}>{playing?"暫停":"播放"}</button><button onClick={()=>seekTo(time+5)} style={{...S.btn,padding:"9px 0",fontSize:12,background:S.bg2,color:S.t1}}>+5秒</button><button onClick={()=>jumpLine(1)} style={{...S.btn,padding:"9px 0",fontSize:12,background:S.bg2,color:S.t1}}>下一句</button></div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{[.85,1,1.15].map(v=><button key={v} aria-pressed={speed===v} onClick={()=>changeSpeed(v)} style={{border:`1px solid ${speed===v?c.cl:S.bd}`,background:speed===v?c.bg:S.bg1,color:speed===v?c.cl:S.t2,borderRadius:999,padding:"6px 10px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{v===.85?"慢聽":v===1?"原速":"快聽"} {v}x</button>)}<button onClick={()=>activeLyric&&seekLine(activeLyric,true)} disabled={!activeLyric} style={{border:`1px solid ${S.bd}`,background:S.bg1,color:S.t2,borderRadius:999,padding:"6px 10px",fontSize:12,fontWeight:800,cursor:activeLyric?"pointer":"default",fontFamily:"inherit",opacity:activeLyric?1:.5}}>重播本句</button></div>
      </>:<div style={{padding:"11px 12px",border:`1px dashed ${c.cl}66`,borderRadius:12,background:S.bg1,fontSize:12,color:S.t2,lineHeight:1.6}}>音檔準備中。可以先閱讀歌詞與重點單字，產出 mp3 後再補上同步時間。</div>}
    </div>
    <p className="practice-save-note">{saveError?"這台裝置暫時無法保存，仍可繼續聽歌。":`已保存播放位置 ${fmt(record.position)}、跟唱與填空進度。按播放才會繼續。`}</p>
    {timingMode&&<div style={{...S.card,padding:"13px 14px",marginBottom:10,border:`1px solid ${c.cl}`,background:c.bg}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:9}}><div style={{fontSize:14,fontWeight:900,color:c.cl}}>Timing Lab</div><div style={{fontSize:12,color:S.t2,fontWeight:800}}>Current {fmt1(time)}</div><button onClick={()=>updateLineTime(activeLine,time)} disabled={activeLine<0} style={{...S.btn,background:c.cl,color:"#fff",padding:"7px 10px",fontSize:12,opacity:activeLine>=0?1:.45}}>Set active line</button><button onClick={()=>nudgeAll(-.1)} style={{...S.btn,background:S.bg1,color:S.t1,padding:"7px 10px",fontSize:12}}>All -0.1s</button><button onClick={()=>nudgeAll(.1)} style={{...S.btn,background:S.bg1,color:S.t1,padding:"7px 10px",fontSize:12}}>All +0.1s</button><button onClick={exportTimings} style={{...S.btn,background:"#1F2937",color:"#fff",padding:"7px 10px",fontSize:12}}>Export timings</button></div>
      <div style={{fontSize:12,color:S.t2,lineHeight:1.55}}>點播放後聽到一句開始時，按該句的 Set current；若只差一點，用 -0.1s / +0.1s 微調。匯出後可把內容貼回歌曲資料。</div>
      {timingExport&&<textarea aria-label="Exported timings" readOnly value={timingExport} style={{width:"100%",minHeight:130,marginTop:10,border:`1px solid ${S.bd}`,borderRadius:10,padding:10,fontFamily:"ui-monospace,SFMono-Regular,Consolas,monospace",fontSize:11,lineHeight:1.45,background:S.bg1,color:S.t1}}/>}
    </div>}
    <div className="song-view-tabs" style={{display:"flex",gap:6,marginBottom:10}}><button aria-pressed={view==="lyrics"} onClick={()=>switchView("lyrics")} style={tabStyle("lyrics")}>歌詞同步</button><button aria-pressed={view==="practice"} onClick={()=>switchView("practice")} style={tabStyle("practice")}>歌詞填空</button><button aria-pressed={view==="sing"} onClick={()=>switchView("sing")} style={tabStyle("sing")}>逐句跟唱</button></div>
    <div className="song-panel" ref={songPanelRef} style={{height:view==="lyrics"?"clamp(340px, calc(100vh - 430px), 680px)":"auto",minHeight:0,overflowY:"auto",overscrollBehavior:"contain",scrollBehavior:"smooth",padding:"0 4px 12px",border:`1px solid ${S.bd}`,borderRadius:12,background:"rgba(255,255,255,.42)"}}>
    {view==="sing"?<SongSingAlong lines={singLines} index={Math.min(phrase,singLines.length-1)} practiced={record.practiced||[]} range={songLineRange(songLines,singLine?.i,dur)} mode={segmentMode} playing={playing} onChoose={choosePhrase} onPlay={repeat=>playLine(singLine,repeat)} onStop={()=>pauseAudio(true)} onMark={markPhrase} onBack={leave} showZh={showZh}/>:view==="lyrics"?<div style={{...S.card,padding:"14px 12px",marginBottom:10}}>
      {songLines.map((line,i)=>line.sec?<div key={i} style={{fontSize:12,fontWeight:900,color:"var(--garden-green)",margin:"16px 4px 7px",letterSpacing:0}}>{line.sec}</div>:<div ref={el=>{if(el)lineRefs.current[i]=el}} key={i} onClick={()=>hasAudio&&seekLine({...line,i},true)} style={{padding:"11px 12px",borderRadius:12,background:activeLine===i?c.bg:S.bg2,border:`1px solid ${activeLine===i?c.cl:S.bd}`,marginBottom:7,cursor:hasAudio?"pointer":"default",transition:"all .15s",boxShadow:activeLine===i?"0 8px 20px rgba(15,110,86,.12)":"none"}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-start"}}><div style={{fontSize:11,color:activeLine===i?c.cl:S.t3,fontWeight:800,minWidth:34,paddingTop:3}}>{Number.isFinite(Number(line.t))?fmt(line.t):""}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,lineHeight:1.5,fontWeight:activeLine===i?900:700,color:S.t1}}>{line.en}</div>{showZh&&<div style={{fontSize:12,color:S.t2,marginTop:3,lineHeight:1.5}}>{line.zh}</div>}</div><button onClick={e=>{e.stopPropagation();seekLine({...line,i},true)}} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:999,padding:"5px 8px",fontSize:11,color:"var(--garden-green)",cursor:"pointer",fontFamily:"inherit",fontWeight:800,flexShrink:0}}>重播</button></div>
    {timingMode&&<div onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:8,paddingTop:8,borderTop:`1px dashed ${S.bd}`}}><span style={{fontSize:11,fontWeight:900,color:c.cl}}>t={fmt1(line.t)}</span><button onClick={()=>updateLineTime(i,time)} style={{border:`1px solid ${c.cl}`,background:c.bg,color:c.cl,borderRadius:999,padding:"5px 8px",fontSize:11,fontWeight:900,cursor:"pointer",fontFamily:"inherit"}}>Set current</button><button onClick={()=>nudgeLine(i,-.1)} style={{border:`1px solid ${S.bd}`,background:S.bg1,color:S.t2,borderRadius:999,padding:"5px 8px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>-0.1s</button><button onClick={()=>nudgeLine(i,.1)} style={{border:`1px solid ${S.bd}`,background:S.bg1,color:S.t2,borderRadius:999,padding:"5px 8px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>+0.1s</button></div>}
      </div>)}
    </div>:<div style={{...S.card,padding:"16px",marginBottom:10}}>
      {!practiceItems.length?<div style={{fontSize:13,color:S.t2}}>這首歌還沒有可練習的填空題。</div>:practice.done?<div style={{textAlign:"center",padding:"18px 8px"}}><div style={{fontSize:42}}>🎉</div><div style={{fontSize:17,fontWeight:900,color:S.t1,marginTop:4}}>練習完成</div><div style={{fontSize:13,color:S.t2,marginTop:4}}>答對 {practice.score}/{practiceItems.length} 題</div><button onClick={resetPractice} style={{...S.btn,background:c.cl,color:"#fff",padding:"10px 18px",fontSize:13,marginTop:12}}>再練一次</button><div className="practice-actions"><button onClick={()=>switchView("sing")}>把句子唱出來 →</button><button onClick={leave}>回首頁休息</button></div></div>:<><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{fontSize:12,fontWeight:900,color:"var(--garden-green)"}}>Question {practice.idx+1}/{practiceItems.length}</div><div style={{flex:1,height:6,background:S.bg2,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${((practice.idx+1)/practiceItems.length)*100}%`,background:c.cl}}/></div></div>
        <div style={{padding:"14px",borderRadius:12,background:S.bg2,border:`1px solid ${S.bd}`,marginBottom:10}}><div style={{fontSize:16,fontWeight:900,color:S.t1,lineHeight:1.5}}>{currentPractice.blank}</div>{showZh&&<div style={{fontSize:12,color:S.t2,marginTop:5}}>{currentPractice.line.zh}</div>}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:7}}>{currentPractice.options.map(opt=>{const picked=practice.pick===opt;const answered=!!practice.pick;const ok=opt===currentPractice.word;return <button key={opt} onClick={()=>choosePractice(opt)} disabled={answered} style={{border:`1px solid ${answered&&ok?c.cl:picked?"#D45757":S.bd}`,background:answered&&ok?c.bg:picked?"#FFF0F0":S.bg1,color:answered&&ok?c.cl:S.t1,borderRadius:10,padding:"10px 9px",fontSize:14,fontWeight:900,cursor:answered?"default":"pointer",fontFamily:"inherit"}}>{opt}</button>})}</div>
        {practice.pick&&<div style={{marginTop:10,padding:"10px 12px",borderRadius:10,background:practice.pick===currentPractice.word?c.bg:"#FFF0F0",color:practice.pick===currentPractice.word?c.cl:"#B54848",fontSize:13,fontWeight:900}}>{practice.pick===currentPractice.word?"答對了！":"答錯了"} 正確答案：{currentPractice.word}</div>}
        <div style={{display:"flex",gap:8,marginTop:10}}><button onClick={()=>seekLine(currentPractice.line,true)} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,padding:"10px",fontSize:13}}>聽這一句</button>{practice.pick&&practice.pick!==currentPractice.word&&<button onClick={retryPractice}>再試一次</button>}<button onClick={nextPractice} disabled={!practice.pick} style={{...S.btn,background:c.cl,color:"#fff",flex:1,padding:"10px",fontSize:13,opacity:practice.pick?1:.5}}>{practice.idx>=practiceItems.length-1?"完成":"下一題"}</button></div></>}
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
      <div style={{...S.card,padding:"14px 16px",fontSize:12,color:S.t2,lineHeight:1.7}}><div style={{fontWeight:900,color:S.t1,marginBottom:7}}>重點句型</div><div style={{display:"grid",gap:7}}>{(song.patterns||[]).map(p=><div key={p.p} style={{padding:"10px",border:`1px solid ${S.bd}`,borderRadius:10,background:S.bg1}}><div style={{fontSize:13,fontWeight:900,color:"var(--garden-green)"}}>{p.p}</div><button onClick={()=>speak(p.ex)} style={{border:"none",background:"none",padding:0,marginTop:4,fontSize:13,fontWeight:800,color:S.t1,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>{p.ex} 🔊</button>{showZh&&<div style={{fontSize:12,color:S.t2,marginTop:2}}>{p.zh}</div>}</div>)}</div></div>
      <div style={{...S.card,padding:"14px 16px",fontSize:12,color:S.t2,lineHeight:1.7}}><div style={{fontWeight:900,color:S.t1,marginBottom:7}}>重點單字</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{song.vocab.map(w=><button key={w} onClick={()=>speak(w)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:999,padding:"7px 10px",fontSize:12,color:"var(--garden-green)",cursor:"pointer",fontWeight:800,fontFamily:"inherit"}}>{w} 🔊</button>)}</div></div>
    </div>
    </div>
  </div>);
}
