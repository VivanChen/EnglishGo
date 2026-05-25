import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

const NOVEL_PAGE_SIZE=5;
const LazyNovelIllustration=lazy(()=>import("../components/NovelIllustration.jsx"));
function NovelIllustration(props){return <Suspense fallback={<div style={{height:props.small?150:props.cover?240:360,borderRadius:props.small?0:18,background:"linear-gradient(135deg,#0B3F35,#77C79D)"}}/>}><LazyNovelIllustration {...props}/></Suspense>}
function novelBlocks(text){
  const raw=String(text||"").trim();
  if(!raw)return[];
  const blankBlocks=raw.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
  const lineBlocks=raw.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  return blankBlocks.length<=1&&lineBlocks.length>1?lineBlocks:blankBlocks;
}
function compactNovelBlocks(blocks,target){
  const out=[...blocks];
  const mergeAt=idx=>{out[idx]=`${out[idx]}\n${out[idx+1]}`;out.splice(idx+1,1)};
  while(out.length>target&&out.length>1){
    const halfSentence=out.findIndex((b,i)=>i<out.length-1&&/[\uFF0C,]$/.test(String(b).trim()));
    if(halfSentence>=0){mergeAt(halfSentence);continue}
    let idx=0,best=Infinity;
    out.forEach((b,i)=>{const score=String(b).replace(/\s+/g,"").length;if(score<best){best=score;idx=i}});
    if(idx===0){out[1]=`${out[0]}\n${out[1]}`;out.splice(0,1)}
    else if(idx===out.length-1){out[idx-1]=`${out[idx-1]}\n${out[idx]}`;out.splice(idx,1)}
    else{
      const prev=String(out[idx-1]).length,next=String(out[idx+1]).length;
      if(prev<=next){out[idx-1]=`${out[idx-1]}\n${out[idx]}`;out.splice(idx,1)}
      else{out[idx+1]=`${out[idx]}\n${out[idx+1]}`;out.splice(idx,1)}
    }
  }
  return out;
}
function novelBlockPairs(enText,zhText){
  let en=novelBlocks(enText),zh=novelBlocks(zhText);
  if(en.length&&zh.length&&en.length!==zh.length){
    if(en.length>zh.length)en=compactNovelBlocks(en,zh.length);
    else zh=compactNovelBlocks(zh,en.length);
  }
  const len=Math.max(en.length,zh.length);
  return Array.from({length:len},(_,i)=>({en:en[i]||"",zh:zh[i]||"",i}));
}
function scrollChildIntoPanel(panel,el,opts={}){
  if(!panel||!el)return;
  const align=opts.align??0.38;
  const behavior=opts.behavior||"smooth";
  const raf=typeof requestAnimationFrame==="function"?requestAnimationFrame:(fn)=>setTimeout(fn,16);
  raf(()=>raf(()=>{
    if(!panel||!el)return;
    const panelRect=panel.getBoundingClientRect();
    const elRect=el.getBoundingClientRect();
    const max=Math.max(0,panel.scrollHeight-panel.clientHeight);
    const target=panel.scrollTop+(elRect.top-panelRect.top)-(panel.clientHeight*align)+(elRect.height/2);
    panel.scrollTo({top:Math.max(0,Math.min(max,target)),behavior});
  }));
}
export default function NovelM({lv,onBack,onXp,deps}){
  const {LV,S,useLS,readingWords,playSound,stopSpeech,speak,speakStory,Hdr}=deps;
  const c=LV[lv];const[novelData,setNovelData]=useState(null);const[ni,setNi]=useState(0);const[ci,setCi]=useState(null);const[page,setPage]=useState(0);const[activeBlock,setActiveBlock]=useState(null);const[activeVocab,setActiveVocab]=useState(null);const[sidePanel,setSidePanel]=useState(null);const[showZh,setShowZh]=useState(true);const[done,setDone]=useLS("novelDone",{});const[quizAns,setQuizAns]=useLS("novelQuiz",{});const[readingProgress,setReadingProgress]=useLS("novelReadingProgress",{});const[readingPrefs,setReadingPrefs]=useLS("novelReadingPrefs",{fontSize:16,lineHeight:1.66,focus:false});const rewarded=useRef({});const pendingPageRef=useRef(0);const novelSpeechRef=useRef(null);const novelPanelRef=useRef(null);const novelBlockRefs=useRef({});
  const[viewportWidth,setViewportWidth]=useState(()=>typeof window==="undefined"?1024:window.innerWidth||1024);
  useEffect(()=>{let active=true;import("../data/novels.js").then(m=>{if(active)setNovelData(m.NOVELS)}).catch(()=>{if(active)setNovelData({elementary:[]})});return()=>{active=false}},[]);
  useEffect(()=>()=>novelSpeechRef.current?.cancel?.(),[]);
  useEffect(()=>{if(typeof window==="undefined")return;const onResize=()=>setViewportWidth(window.innerWidth||1024);onResize();window.addEventListener("resize",onResize);return()=>window.removeEventListener("resize",onResize)},[]);
  useEffect(()=>{const target=Math.max(0,Number(pendingPageRef.current)||0);pendingPageRef.current=0;setPage(target);setActiveBlock(null);setActiveVocab(null);setSidePanel(null);novelBlockRefs.current={};novelPanelRef.current?.scrollTo({top:0})},[ci,ni]);
  const isMobile=viewportWidth<=560;
  const novels=novelData?(novelData[lv]?.length?novelData[lv]:novelData.elementary):[];
  const novel=novels[ni];const completed=done[novel?.id]||[];const chapter=ci==null?null:novel.chapters[ci];const blockPairs=useMemo(()=>novelBlockPairs(chapter?.en,chapter?.zh),[chapter]);const enBlocks=useMemo(()=>blockPairs.map(b=>b.en),[blockPairs]);const zhBlocks=useMemo(()=>blockPairs.map(b=>b.zh),[blockPairs]);const words=chapter?readingWords(chapter.en).length:0;const pct=novel?Math.round((completed.length/novel.chapters.length)*100):0;
  const novelImageBase=novel?.imageBase||"/images/novels/secret-forest";
  useEffect(()=>{if(typeof Image==="undefined"||!novel)return;const max=novel.chapters.length;const nums=ci==null?[1,2,3,4].filter(n=>n<=max):[ci+1,ci+2].filter(n=>n>=1&&n<=max);if(ci==null){const cover=new Image();cover.src=`${novelImageBase}/cover.jpg`}nums.forEach(n=>{const img=new Image();img.src=`${novelImageBase}/chapter-${n}${ci==null?"-thumb":""}.jpg`})},[ci,novel,novelImageBase]);
  const pages=useMemo(()=>{const out=[];for(let i=0;i<blockPairs.length;i+=NOVEL_PAGE_SIZE)out.push(blockPairs.slice(i,i+NOVEL_PAGE_SIZE).map((b,j)=>({...b,i:i+j})));return out},[blockPairs]);
  const pageNow=Math.min(page,Math.max(0,pages.length-1));const pageBlocks=pages[pageNow]||[];const pageStart=pageNow*NOVEL_PAGE_SIZE;
  useEffect(()=>{if(activeBlock!=null)scrollChildIntoPanel(novelPanelRef.current,novelBlockRefs.current[activeBlock],{align:.36})},[activeBlock,pageNow,showZh]);
  useEffect(()=>{if(!novel||!chapter||ci==null||!pages.length)return;setReadingProgress(d=>({...d,[novel.id]:{chapterNo:chapter.no,chapterIndex:ci,page:pageNow,pageCount:pages.length,updatedAt:Date.now()}}))},[novel?.id,chapter?.no,ci,pageNow,pages.length]);
  const quiz=chapter?chapter.quiz||[]:[];const quizKey=chapter?`${novel.id}:${chapter.no}`:"";const quizState=quizAns[quizKey]||{};const quizAnswered=quiz.filter((_,i)=>quizState[i]!=null).length;const quizDone=!quiz.length||quiz.every((_,i)=>quizState[i]!=null);
  const chooseQuiz=(qi,oi)=>setQuizAns(d=>({...d,[quizKey]:{...(d[quizKey]||{}),[qi]:oi}}));
  const completeChapter=()=>{if(!chapter)return;if(!quizDone){playSound("wrong");return}const key=`${novel.id}:${chapter.no}`;if(!completed.includes(chapter.no)){setDone(d=>({...d,[novel.id]:[...new Set([...(d[novel.id]||[]),chapter.no])]}));if(!rewarded.current[key]){rewarded.current[key]=true;onXp?.(15);playSound("done")}}};
  const stopNovelSpeech=()=>{novelSpeechRef.current?.cancel?.();novelSpeechRef.current=null;setActiveBlock(null);setActiveVocab(null);stopSpeech()};
  const readChapter=()=>{if(!chapter||!enBlocks.length)return;stopNovelSpeech();novelSpeechRef.current=speakStory([chapter.title,...enBlocks],{rate:0.78,onSentence:i=>{const bi=i-1;if(bi>=0){setActiveBlock(bi);setPage(Math.floor(bi/NOVEL_PAGE_SIZE))}},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readPage=()=>{if(!pageBlocks.length)return;stopNovelSpeech();novelSpeechRef.current=speakStory(pageBlocks.map(b=>b.en),{rate:0.78,onSentence:i=>setActiveBlock(pageStart+i),onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readChapterZh=()=>{if(!chapter||!zhBlocks.length)return;stopNovelSpeech();novelSpeechRef.current=speakStory([chapter.zhTitle,...zhBlocks],{lang:"zh-TW",rate:1,onSentence:i=>{const bi=i-1;if(bi>=0){setActiveBlock(bi);setPage(Math.floor(bi/NOVEL_PAGE_SIZE))}},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readPageZh=()=>{const items=pageBlocks.filter(b=>b.zh);if(!items.length)return;stopNovelSpeech();novelSpeechRef.current=speakStory(items.map(b=>b.zh),{lang:"zh-TW",rate:1,onSentence:i=>setActiveBlock(items[i]?.i),onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const bilingualChapterItems=()=>[{text:chapter.title,lang:"en-US",rate:0.78},{text:chapter.zhTitle,lang:"zh-TW",rate:1},...enBlocks.flatMap((en,i)=>[{text:en,lang:"en-US",rate:0.78,blockIndex:i},{text:zhBlocks[i],lang:"zh-TW",rate:1,blockIndex:i}].filter(x=>x.text))];
  const bilingualPageItems=()=>pageBlocks.flatMap(b=>[{text:b.en,lang:"en-US",rate:0.78,blockIndex:b.i},{text:b.zh,lang:"zh-TW",rate:1,blockIndex:b.i}].filter(x=>x.text));
  const readBilingualChapter=()=>{if(!chapter||!enBlocks.length)return;stopNovelSpeech();novelSpeechRef.current=speakStory(bilingualChapterItems(),{onSentence:(_,__,item)=>{const bi=item?.blockIndex;if(bi!=null){setActiveBlock(bi);setPage(Math.floor(bi/NOVEL_PAGE_SIZE))}},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readBilingualPage=()=>{const items=bilingualPageItems();if(!items.length)return;stopNovelSpeech();novelSpeechRef.current=speakStory(items,{onSentence:(_,__,item)=>{if(item?.blockIndex!=null)setActiveBlock(item.blockIndex)},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const speakNovelText=(text,lang="en-US",rate=0.78,idx=null)=>{stopNovelSpeech();setActiveBlock(idx);speak(text,lang,rate,{onend:()=>setActiveBlock(null)})};
  const speakNovelVocab=(word)=>{stopNovelSpeech();setActiveVocab(word);speak(word,"en-US",0.86,{onend:()=>setActiveVocab(null)})};
  const goChapter=(i,startPage=0)=>{stopNovelSpeech();pendingPageRef.current=Math.max(0,Number(startPage)||0);setCi(i);setPage(Math.max(0,Number(startPage)||0));if(typeof navigator==="undefined"||!/jsdom/i.test(navigator.userAgent||"")){try{window.scrollTo?.({top:0,behavior:"smooth"})}catch{}}};
  const backToList=()=>{stopNovelSpeech();setCi(null)};
  if(!novelData)return(<div><Hdr t="📘 英文小說" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入小說中...</div></div>);
  if(!novel)return(<div><Hdr t="📘 英文小說" onBack={onBack} cl={c.cl}/><div style={{...S.card,padding:"28px 18px",textAlign:"center",color:S.t2}}>這個年級的小說準備中</div></div>);
  const resumeProgress=novel?readingProgress[novel.id]:null;
  const resumeIndex=resumeProgress?novel.chapters.findIndex(ch=>ch.no===resumeProgress.chapterNo):-1;
  const resumeChapter=resumeIndex>=0?novel.chapters[resumeIndex]:null;
  const resumePageCount=resumeChapter?Math.max(1,Math.ceil(novelBlockPairs(resumeChapter.en,resumeChapter.zh).length/NOVEL_PAGE_SIZE)):1;
  const resumePage=Math.max(0,Math.min(Number(resumeProgress?.page)||0,resumePageCount-1));
  if(ci==null)return(<div><Hdr t="📘 英文小說" onBack={onBack} cl={c.cl}/>
    <div style={{...S.card,padding:0,overflow:"hidden",marginBottom:12,borderTop:`4px solid ${c.cl}`}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,240px),1fr))",gap:0,background:"linear-gradient(135deg,#0C382E,#175B48 48%,#7ECBA9)",color:"#fff"}}>
        <div style={{padding:"22px 18px",display:"flex",flexDirection:"column",justifyContent:"center",minHeight:210}}>
          <div style={{fontSize:12,fontWeight:800,opacity:.78,marginBottom:6,letterSpacing:.2}}>{novel.theme} · {novel.level} · 有聲讀本</div>
          <div style={{fontSize:29,fontWeight:900,lineHeight:1.12,maxWidth:430}}>{novel.title}</div>
          <div style={{fontSize:16,fontWeight:800,opacity:.92,marginTop:7}}>{novel.zhTitle}</div>
          <div style={{fontSize:13,lineHeight:1.6,opacity:.86,marginTop:12,maxWidth:390}}>一章一章閱讀、聆聽、回答問題，練習長篇英文理解。</div>
          <div style={{display:"flex",gap:8,alignItems:"center",marginTop:18,fontSize:12}}><span>{completed.length}/{novel.chapters.length} 章完成</span><div style={{flex:1,maxWidth:190,height:7,background:"rgba(255,255,255,.22)",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:"#fff",borderRadius:4}}/></div><span>{pct}%</span></div>
        </div>
        <NovelIllustration cover chapter={1} imageBase={novelImageBase} title={novel.title}/>
      </div>
    </div>
    {resumeChapter&&<div style={{...S.card,padding:"13px 14px",marginBottom:12,border:`1px solid ${c.cl}`,background:"linear-gradient(135deg,#F0FFF8,#FFFFFF)"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"space-between",flexWrap:"wrap"}}>
        <div style={{minWidth:0,flex:"1 1 260px"}}>
          <div style={{fontSize:12,fontWeight:900,color:c.cl,marginBottom:3}}>閱讀進度</div>
          <div style={{fontSize:16,fontWeight:900,color:S.t1,lineHeight:1.3}}>{resumeChapter.title}</div>
          <div style={{fontSize:12,color:S.t2,marginTop:3}}>上次讀到 Chapter {resumeChapter.no} · Page {resumePage+1}</div>
        </div>
        <button onClick={()=>goChapter(resumeIndex,resumePage)} style={{...S.btn,background:c.cl,color:"#fff",padding:"10px 16px",fontSize:13,flex:"0 0 auto"}}>繼續閱讀</button>
      </div>
    </div>}
    {novels.length>1&&<div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:10}}>{novels.map((n,i)=><button key={n.id} onClick={()=>{setNi(i);setCi(null)}} style={{flexShrink:0,padding:"8px 12px",border:"none",borderRadius:12,background:i===ni?c.cl:S.bg2,color:i===ni?"#fff":S.t1,fontWeight:700,fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>{n.title}</button>)}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,158px),1fr))",gap:10}}>
      {novel.chapters.map((ch,i)=>{const isDone=completed.includes(ch.no);const chProgress=readingProgress[novel.id]?.chapterNo===ch.no?readingProgress[novel.id]:null;const chPageCount=Math.max(1,Number(chProgress?.pageCount)||Math.ceil(novelBlockPairs(ch.en,ch.zh).length/NOVEL_PAGE_SIZE));const chPage=Math.max(0,Math.min(Number(chProgress?.page)||0,chPageCount-1));const chQuiz=ch.quiz||[];const chQuizState=quizAns[`${novel.id}:${ch.no}`]||{};const chQuizAnswered=chQuiz.filter((_,qi)=>chQuizState[qi]!=null).length;const statusText=isDone?"已完成":chProgress?`進行中 · Page ${chPage+1}/${chPageCount}`:"尚未開始";return(<div key={ch.no} data-testid={`novel-chapter-card-${ch.no}`} onClick={()=>goChapter(i,chProgress?chPage:0)} style={{...S.card,padding:0,overflow:"hidden",cursor:"pointer",border:`1px solid ${isDone?"#1D9E75":chProgress?c.cl:S.bd}`,boxShadow:chProgress?`0 10px 24px ${c.cl}22`:S.card.boxShadow}}>
        <div style={{position:"relative",color:"#fff"}}>
          <NovelIllustration chapter={ch.no} small imageBase={novelImageBase} title={novel.title}/>
          <div style={{position:"absolute",top:8,left:8,width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,.9)",color:c.cl,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900}}>{ch.no}</div>
          {isDone&&<div style={{position:"absolute",top:8,right:8,borderRadius:999,background:"#E1F5EE",color:"#1D9E75",padding:"3px 8px",fontSize:11,fontWeight:800}}>已讀</div>}
        </div>
        <div style={{padding:"12px 12px 13px"}}>
          <div style={{fontSize:14,fontWeight:800,color:S.t1,lineHeight:1.35}}>{ch.title}</div>
          <div style={{fontSize:12,color:S.t2,marginTop:4}}>{ch.zhTitle}</div>
          <div style={{fontSize:11,color:S.t3,marginTop:8}}>{readingWords(ch.en).length} words · {ch.vocab.length} key words</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:9}}>
            <span style={{fontSize:10,fontWeight:900,color:isDone?"#1D9E75":chProgress?c.cl:S.t3,background:isDone?"#E1F5EE":chProgress?c.bg:S.bg2,border:`1px solid ${isDone?"#1D9E75":chProgress?c.cl:S.bd}`,borderRadius:999,padding:"4px 8px"}}>{statusText}</span>
            <span style={{fontSize:10,fontWeight:900,color:chQuizAnswered===chQuiz.length&&chQuiz.length?c.cl:S.t3,background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:999,padding:"4px 8px"}}>測驗 {chQuizAnswered}/{chQuiz.length}</span>
          </div>
        </div>
      </div>)})}
    </div>
  </div>);
  const next=ci+1<novel.chapters.length?ci+1:null;const prev=ci>0?ci-1:null;const isDone=completed.includes(chapter.no);const canPrevPage=pageNow>0;const canNextPage=pageNow+1<pages.length;const quizScore=quiz.reduce((n,q,i)=>n+(quizState[i]===q.a?1:0),0);
  const pagePct=pages.length?Math.round(((pageNow+1)/pages.length)*100):0;
  const chapterPct=novel.chapters.length?Math.round((((chapter.no-1)+(pageNow+1)/Math.max(1,pages.length))/novel.chapters.length)*100):0;
  const pageEnd=Math.min(pageStart+pageBlocks.length,blockPairs.length);
  const readerFontSize=Math.max(14,Math.min(22,Number(readingPrefs.fontSize)||16));
  const readerLineHeight=Math.max(1.5,Math.min(2.1,Number(readingPrefs.lineHeight)||1.66));
  const readingFocus=!!readingPrefs.focus;
  const updateReadingPrefs=patch=>setReadingPrefs(d=>({...d,...patch}));
  const panelIsVocab=sidePanel==="vocab";
  const panelTitle=panelIsVocab?"重點單字":`章節測驗 ${quizAnswered}/${quiz.length}`;
  const panelTop=isMobile?"auto":"76px";
  const panelStyle={position:"fixed",zIndex:130,left:isMobile?0:"max(12px, calc((100vw - 760px) / 2 - 304px))",right:isMobile?0:"auto",top:panelTop,bottom:isMobile?0:18,width:isMobile?"auto":286,maxHeight:isMobile?"72vh":"calc(100vh - 94px)",overflowY:"auto",background:S.bg1,border:`1px solid ${c.cl}55`,borderRadius:isMobile?"18px 18px 0 0":16,boxShadow:"0 20px 48px rgba(15,110,86,.22)",padding:14};
  const turnPage=p=>{stopNovelSpeech();setActiveBlock(null);setPage(Math.max(0,Math.min(p,pages.length-1)));novelPanelRef.current?.scrollTo({top:0,behavior:"smooth"})};
  const finishAndGo=()=>{completeChapter();if(quizDone){next!=null?goChapter(next):backToList()}};
  return(<div><Hdr t="📘 英文小說" onBack={backToList} cl={c.cl} extra={<button onClick={()=>setShowZh(z=>!z)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 8px",fontSize:12,color:c.cl,cursor:"pointer",fontFamily:"inherit"}}>{showZh?"隱藏中文":"顯示中文"}</button>}/>
    {!readingFocus&&<div style={{...S.card,padding:0,overflow:"hidden",marginBottom:10,border:`1px solid ${S.bd}`,borderTop:`4px solid ${c.cl}`,background:"linear-gradient(135deg,#FFFCF3,#F3FBF7)"}}>
      <div data-testid="novel-chapter-hero" style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"minmax(150px,220px) minmax(0,1fr)",gap:0,alignItems:"stretch"}}>
        <div style={{height:isMobile?150:"clamp(170px,24vw,220px)",overflow:"hidden"}}><NovelIllustration chapter={chapter.no} imageBase={novelImageBase} title={novel.title}/></div>
        <div style={{padding:isMobile?"13px 12px 14px":"16px",display:"grid",gap:12,minWidth:0}}>
          <div style={{display:"flex",gap:12,alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",minWidth:0,flex:isMobile?"1 1 100%":"1 1 260px"}}><div style={{width:42,height:42,borderRadius:"50%",background:c.cl,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,flexShrink:0}}> {chapter.no}</div><div style={{minWidth:0}}><div style={{fontSize:12,color:c.cl,fontWeight:900}}>Chapter {chapter.no}</div><div style={{fontSize:isMobile?20:22,fontWeight:900,color:S.t1,lineHeight:1.18,overflowWrap:"anywhere"}}>{chapter.title}</div><div style={{fontSize:13,color:S.t2,marginTop:3}}>{chapter.zhTitle} · {words} words</div></div></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7,flex:isMobile?"1 1 100%":"0 1 190px",minWidth:0}}>
              <div style={{padding:"8px 10px",border:`1px solid ${S.bd}`,borderRadius:10,background:"#fff"}}><div style={{fontSize:11,color:S.t3,fontWeight:800}}>頁面</div><div style={{fontSize:17,fontWeight:900,color:c.cl}}>{pageNow+1}/{pages.length}</div></div>
              <div style={{padding:"8px 10px",border:`1px solid ${S.bd}`,borderRadius:10,background:"#fff"}}><div style={{fontSize:11,color:S.t3,fontWeight:800}}>測驗</div><div style={{fontSize:17,fontWeight:900,color:quizDone?c.cl:S.t1}}>{quizScore}/{quiz.length}</div></div>
            </div>
          </div>
          <div style={{border:`1px solid ${c.cl}33`,background:"#fff",borderRadius:12,padding:"11px 12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:9}}><div style={{fontSize:13,fontWeight:900,color:S.t1}}>閱讀控制台</div><div style={{fontSize:12,color:c.cl,fontWeight:900}}><span>本頁進度</span> <span>{pagePct}%</span></div></div>
            <div style={{height:8,background:S.bg2,borderRadius:999,overflow:"hidden",marginBottom:10}}><div style={{height:"100%",width:`${pagePct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:999,transition:"width .2s"}}/></div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}><button onClick={readBilingualPage} disabled={!pageBlocks.some(b=>b.zh)} style={{...S.btn,background:c.cl,color:"#fff",padding:"9px 12px",fontSize:12,flex:"1 1 112px",opacity:pageBlocks.some(b=>b.zh)?1:.45}}>🎧 英中本頁</button><button onClick={readPage} style={{...S.btn,background:S.bg2,color:S.t1,padding:"9px 12px",fontSize:12,flex:"1 1 104px"}}>🔊 英文本頁</button><button onClick={readPageZh} disabled={!pageBlocks.some(b=>b.zh)} style={{...S.btn,background:S.bg2,color:S.t1,padding:"9px 12px",fontSize:12,flex:"1 1 104px",opacity:pageBlocks.some(b=>b.zh)?1:.45}}>🔈 中文本頁</button><button onClick={readBilingualChapter} disabled={!zhBlocks.length} style={{...S.btn,background:c.bg,color:c.cl,padding:"9px 12px",fontSize:12,flex:"1 1 116px",opacity:zhBlocks.length?1:.45}}>整章播放</button><button onClick={completeChapter} disabled={isDone||!quizDone} style={{...S.btn,background:isDone?"#E1F5EE":quizDone?c.cl:S.bg2,color:isDone?"#1D9E75":quizDone?"#fff":S.t3,padding:"9px 12px",fontSize:12,flex:"1 1 116px",opacity:(!quizDone&&!isDone)?0.62:1}}>{isDone?"已完成":quizDone?"完成 +15XP":"先完成測驗"}</button></div>
          </div>
        </div>
      </div>
    </div>}
    <div data-testid="novel-reading-settings" style={{display:isMobile?"grid":"flex",gridTemplateColumns:isMobile?"repeat(3, minmax(0, 1fr))":undefined,alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:10,padding:"10px 12px",border:`1px solid ${c.cl}33`,borderRadius:12,background:"linear-gradient(135deg,#FFFFFF,#F1FBF6)",boxShadow:"0 8px 20px rgba(15,110,86,.06)"}}>
      <div style={{fontSize:13,fontWeight:900,color:S.t1,marginRight:isMobile?0:"auto",gridColumn:isMobile?"1 / -1":undefined}}>閱讀設定</div>
      <button onClick={()=>updateReadingPrefs({fontSize:Math.max(14,readerFontSize-2)})} aria-label="A-" style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 10px",fontSize:12,minWidth:42,width:isMobile?"100%":undefined}}>A-</button>
      <div style={{fontSize:12,fontWeight:900,color:c.cl,minWidth:42,textAlign:"center"}}>{readerFontSize}px</div>
      <button onClick={()=>updateReadingPrefs({fontSize:Math.min(22,readerFontSize+2)})} aria-label="A+" style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 10px",fontSize:12,minWidth:42,width:isMobile?"100%":undefined}}>A+</button>
      <button onClick={()=>updateReadingPrefs({lineHeight:readerLineHeight>=1.9?1.66:1.9})} style={{...S.btn,background:readerLineHeight>=1.9?c.bg:S.bg2,color:readerLineHeight>=1.9?c.cl:S.t1,padding:"8px 12px",fontSize:12,width:isMobile?"100%":undefined}}>{readerLineHeight>=1.9?"一般行距":"寬行距"}</button>
      <button onClick={()=>updateReadingPrefs({focus:!readingFocus})} style={{...S.btn,background:readingFocus?c.cl:S.bg2,color:readingFocus?"#fff":S.t1,padding:"8px 12px",fontSize:12,gridColumn:isMobile?"span 2":undefined,width:isMobile?"100%":undefined}}>{readingFocus?"離開專注":"專注模式"}</button>
      <button onClick={()=>setSidePanel(panelIsVocab?null:"vocab")} style={{...S.btn,background:panelIsVocab?c.cl:S.bg2,color:panelIsVocab?"#fff":S.t1,padding:"8px 12px",fontSize:12,width:isMobile?"100%":undefined}}>重點單字</button>
      <button onClick={()=>setSidePanel(sidePanel==="quiz"?null:"quiz")} style={{...S.btn,background:sidePanel==="quiz"?c.cl:S.bg2,color:sidePanel==="quiz"?"#fff":S.t1,padding:"8px 12px",fontSize:12,gridColumn:isMobile?"span 2":undefined,width:isMobile?"100%":undefined}}>章節測驗 {quizAnswered}/{quiz.length}</button>
    </div>
    {sidePanel&&<>
      {isMobile&&<button aria-label="關閉小說工具" onClick={()=>setSidePanel(null)} style={{position:"fixed",inset:0,zIndex:120,background:"rgba(15,55,45,.28)",border:"none"}}/>}
      <aside data-testid="novel-side-panel" style={panelStyle}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
          <div style={{fontSize:16,fontWeight:900,color:S.t1}}>{panelTitle}</div>
          <button onClick={()=>setSidePanel(null)} aria-label="關閉工具面板" style={{width:34,height:34,border:`1px solid ${S.bd}`,borderRadius:12,background:S.bg2,cursor:"pointer",fontWeight:900,color:S.t1}}>×</button>
        </div>
        {panelIsVocab?<div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {chapter.vocab.map(w=>{const on=activeVocab===w;return <button key={w} onClick={e=>{e.currentTarget.blur();speakNovelVocab(w)}} style={{border:`1px solid ${on?c.cl:S.bd}`,background:on?"#E6F7F0":S.bg1,borderRadius:999,padding:"8px 10px",fontSize:13,color:c.cl,cursor:"pointer",fontWeight:900,fontFamily:"inherit",boxShadow:on?`0 0 0 2px ${c.cl}22`:"none",display:"inline-flex",gap:5,alignItems:"center"}}><span>{w}</span><span aria-hidden="true">🔊</span></button>})}
        </div>:<div style={{display:"grid",gap:10}}>
          {quiz.map((q,qi)=>{const picked=quizState[qi];return(<div key={q.q} style={{border:`1px solid ${S.bd}`,borderRadius:12,padding:"11px",background:S.bg1}}><div style={{fontSize:14,fontWeight:900,color:S.t1,lineHeight:1.45}}>{qi+1}. {q.q}</div>{showZh&&<div style={{fontSize:12,color:S.t2,marginTop:3}}>{q.zh}</div>}<div style={{display:"grid",gridTemplateColumns:"1fr",gap:7,marginTop:9}}>{q.o.map((o,oi)=>{const selected=picked===oi;const correct=oi===q.a;const answered=picked!=null;return <button key={o} onClick={()=>chooseQuiz(qi,oi)} style={{border:`1px solid ${answered&&correct?c.cl:selected?"#D45757":S.bd}`,background:answered&&correct?"#E6F7F0":selected?"#FFF0F0":S.bg2,color:answered&&correct?c.cl:S.t1,borderRadius:9,padding:"9px 10px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>{o}</button>})}</div>{picked!=null&&<div style={{fontSize:12,color:picked===q.a?c.cl:"#B54848",fontWeight:800,marginTop:7}}>{picked===q.a?"答對了":"答錯了，正確答案已標示"}</div>}</div>)})}
        </div>}
      </aside>
    </>}
    <div data-testid="novel-chapter-nav" style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"auto minmax(0,1fr) auto",alignItems:"center",gap:8,marginBottom:10,fontSize:12,background:"#fff",border:`1px solid ${S.bd}`,borderRadius:12,padding:"9px 10px"}}><button onClick={()=>prev!=null&&goChapter(prev)} disabled={prev==null} style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 11px",opacity:prev==null?0.35:1,fontSize:12,order:isMobile?2:0}}>← 上一章</button><div style={{gridColumn:isMobile?"1 / -1":undefined,order:isMobile?1:0,minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:5}}><span style={{fontWeight:900,color:S.t1}}>章節概覽</span><span style={{fontWeight:900,color:c.cl}}>{chapterPct}%</span></div><div style={{height:7,background:S.bg2,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${chapterPct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:999}}/></div></div><button onClick={()=>next!=null&&goChapter(next)} disabled={next==null} style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 11px",opacity:next==null?0.35:1,fontSize:12,order:isMobile?3:0}}>下一章 →</button></div>
    <div ref={novelPanelRef} style={{height:readingFocus?(isMobile?"clamp(520px, calc(100vh - 190px), 820px)":"clamp(560px, calc(100vh - 230px), 820px)"):(isMobile?"clamp(440px, calc(100vh - 260px), 720px)":"clamp(430px, calc(100vh - 330px), 720px)"),minHeight:0,overflowY:"auto",overflowX:"hidden",overscrollBehavior:"contain",scrollBehavior:"smooth",padding:"0 4px 12px",border:`1px solid ${S.bd}`,borderRadius:14,background:"linear-gradient(180deg,rgba(255,255,255,.72),rgba(245,251,248,.66))"}}>
    <article style={{background:"#FFFDF7",border:`1px solid ${S.bd}`,borderRadius:8,padding:readingFocus?(isMobile?"16px 12px 18px":"18px 16px 20px"):(isMobile?"12px 10px 14px":"14px 13px 16px"),boxShadow:"0 8px 22px rgba(64,43,20,.08)",position:"relative",maxWidth:readingFocus?720:"none",margin:readingFocus?"0 auto":"0",minWidth:0}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:6,background:"linear-gradient(180deg,#E8D9B7,#F8F0D6)"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:12,paddingLeft:4,flexWrap:"wrap"}}><div style={{minWidth:0}}><div style={{fontSize:12,fontWeight:900,color:c.cl}}>Page {pageNow+1}</div><div style={{fontSize:11,color:S.t3,fontWeight:800}}>段落 {pageStart+1}-{pageEnd} / {blockPairs.length}</div></div><div aria-label="本頁進度" style={{display:"flex",gap:4,alignItems:"center",justifyContent:"flex-end",overflowX:"auto",maxWidth:"100%",paddingBottom:2}}>{pages.map((_,i)=><button key={i} onClick={()=>turnPage(i)} aria-label={`前往第 ${i+1} 頁`} style={{width:i===pageNow?28:18,height:18,borderRadius:999,border:`1px solid ${i===pageNow?c.cl:S.bd}`,background:i===pageNow?c.cl:"#fff",display:"block",transition:"all .15s",cursor:"pointer",padding:0,flex:"0 0 auto"}} />)}</div></div>
      <div style={{display:"grid",gap:6}}>
        {pageBlocks.map(b=><section key={b.i} ref={el=>{if(el)novelBlockRefs.current[b.i]=el}} onClick={()=>speakNovelText(b.en,"en-US",0.78,b.i)} style={{padding:"9px 10px",borderRadius:8,background:activeBlock===b.i?"#E6F7F0":"transparent",border:`1px solid ${activeBlock===b.i?c.cl:"transparent"}`,transition:"all .18s",cursor:"pointer"}}>
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}><p data-testid="novel-reader-text" style={{flex:1,margin:0,fontSize:readerFontSize,lineHeight:readerLineHeight,color:S.t1,fontWeight:/^“|^[A-Z][a-z]+[?!]?$/.test(b.en)?800:650,whiteSpace:"pre-line"}}>{b.en}</p><button onClick={e=>{e.stopPropagation();e.currentTarget.blur();speakNovelText(b.en,"en-US",0.78,b.i)}} style={{width:34,height:34,border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:10,padding:0,fontSize:13,cursor:"pointer",fontFamily:"inherit",color:c.cl,flexShrink:0}}>🔊</button></div>
          {showZh&&b.zh&&<div style={{marginTop:8,padding:"8px 10px",background:"#FFF7E6",border:"1px solid #F0D59A",borderRadius:8,fontSize:Math.max(13,readerFontSize-2),lineHeight:readerLineHeight,color:S.t2,whiteSpace:"pre-line",display:"flex",gap:8,alignItems:"flex-start"}}><span style={{flex:1}}>{b.zh}</span><button onClick={e=>{e.stopPropagation();e.currentTarget.blur();speakNovelText(b.zh,"zh-TW",1,b.i)}} title="朗讀中文" style={{width:30,height:30,background:"#fff",border:"1px solid #F0D59A",borderRadius:9,fontSize:14,cursor:"pointer",flexShrink:0}}>🔈</button></div>}
        </section>)}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:14}}><button onClick={()=>turnPage(pageNow-1)} disabled={!canPrevPage} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,padding:"10px",fontSize:13,opacity:canPrevPage?1:.4}}>上一頁</button><div style={{fontSize:12,color:S.t3,fontWeight:700}}>{pageNow+1}/{pages.length}</div><button onClick={()=>turnPage(pageNow+1)} disabled={!canNextPage} style={{...S.btn,background:c.cl,color:"#fff",flex:1,padding:"10px",fontSize:13,opacity:canNextPage?1:.4}}>下一頁</button></div>
    </article>
    <div style={{display:"flex",gap:8,marginTop:10}}><button onClick={backToList} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,padding:"11px",fontSize:13}}>章節列表</button><button onClick={finishAndGo} disabled={!quizDone} style={{...S.btn,background:c.cl,color:"#fff",flex:1,padding:"11px",fontSize:13,opacity:quizDone?1:.45}}>{next!=null?"完成並下一章":"完成並返回"}</button></div>
    </div>
  </div>);
}
// ═══ SONGS (英文歌曲練習) ═════════════════════════════════════════════
