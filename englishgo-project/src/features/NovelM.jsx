import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  findPageForBlock,
  nextSpreadStart,
  paginateByHeight,
  previousSpreadStart,
  spreadStartForPage,
} from "./novelPagination.js";

const NOVEL_READING_FONT='Georgia, Cambria, "Times New Roman", serif';
const NOVEL_PAPER="#FFFEF9";
const NOVEL_SURROUND="#E8E4DA";
const LazyNovelIllustration=lazy(()=>import("../components/NovelIllustration.jsx"));
function NovelIllustration(props){return <Suspense fallback={<div data-testid={props.fill?"novel-illustration-frame":undefined} style={{height:props.fill?"100%":props.small?150:props.cover?240:360,width:props.fill?"100%":undefined,borderRadius:props.small?0:18,background:"linear-gradient(135deg,#0B3F35,#77C79D)"}}/>}><LazyNovelIllustration {...props}/></Suspense>}
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
export default function NovelM({lv,onBack,onXp,deps}){
  const {LV,S,useLS,readingWords,playSound,stopSpeech,speak,speakStory,Hdr}=deps;
  const c=LV[lv];const[novelData,setNovelData]=useState(null);const[ni,setNi]=useState(0);const[ci,setCi]=useState(null);const[page,setPage]=useState(0);const[activeBlock,setActiveBlock]=useState(null);const[activeVocab,setActiveVocab]=useState(null);const[sidePanel,setSidePanel]=useState(null);const[showZh,setShowZh]=useState(true);const[immersive,setImmersive]=useState(true);const[done,setDone]=useLS("novelDone",{});const[quizAns,setQuizAns]=useLS("novelQuiz",{});const[readingProgress,setReadingProgress]=useLS("novelReadingProgress",{});const[readingPrefs,setReadingPrefs]=useLS("novelReadingPrefs",{fontSize:16,lineHeight:1.66});const[measuredPages,setMeasuredPages]=useState([]);const[layoutVersion,setLayoutVersion]=useState(0);const[pageTurn,setPageTurn]=useState(null);const rewarded=useRef({});const pendingPageRef=useRef(0);const novelSpeechRef=useRef(null);const novelPanelRef=useRef(null);const novelSpreadRef=useRef(null);const novelBlockRefs=useRef({});const measureBlockRefs=useRef({});const swipeStartRef=useRef(null);const pageTurnTimerRef=useRef(null);
  const[viewportWidth,setViewportWidth]=useState(()=>typeof window==="undefined"?1024:window.innerWidth||1024);
  useEffect(()=>{let active=true;import("../data/novels.js").then(m=>{if(active)setNovelData(m.NOVELS)}).catch(()=>{if(active)setNovelData({elementary:[]})});return()=>{active=false}},[]);
  useEffect(()=>()=>{novelSpeechRef.current?.cancel?.();window.clearTimeout?.(pageTurnTimerRef.current)},[]);
  useEffect(()=>{if(typeof window==="undefined")return;const onResize=()=>setViewportWidth(window.innerWidth||1024);onResize();window.addEventListener("resize",onResize);return()=>window.removeEventListener("resize",onResize)},[]);
  useEffect(()=>{let active=true;document.fonts?.ready?.then(()=>{if(active)setLayoutVersion(v=>v+1)});return()=>{active=false}},[]);
  useEffect(()=>{const target=Math.max(0,Number(pendingPageRef.current)||0);pendingPageRef.current=0;window.clearTimeout?.(pageTurnTimerRef.current);pageTurnTimerRef.current=null;setPageTurn(null);setPage(target);setActiveBlock(null);setActiveVocab(null);setSidePanel(null);novelBlockRefs.current={};novelPanelRef.current?.scrollTo({top:0})},[ci,ni]);
  const isMobile=viewportWidth<=560;
  const visiblePageCount=isMobile?1:2;
  const readerFontSize=Math.max(14,Math.min(22,Number(readingPrefs.fontSize)||16));
  const readerLineHeight=Math.max(1.5,Math.min(2.1,Number(readingPrefs.lineHeight)||1.66));
  const readingFocus=immersive;
  const novels=novelData?(novelData[lv]?.length?novelData[lv]:novelData.elementary):[];
  const novel=novels[ni];const completed=done[novel?.id]||[];const chapter=ci==null?null:novel.chapters[ci];const blockPairs=useMemo(()=>novelBlockPairs(chapter?.en,chapter?.zh),[chapter]);const enBlocks=useMemo(()=>blockPairs.map(b=>b.en),[blockPairs]);const zhBlocks=useMemo(()=>blockPairs.map(b=>b.zh),[blockPairs]);const words=chapter?readingWords(chapter.en).length:0;const pct=novel?Math.round((completed.length/novel.chapters.length)*100):0;
  const novelImageBase=novel?.imageBase||"/images/novels/secret-forest";
  useEffect(()=>{if(typeof Image==="undefined"||!novel)return;const max=novel.chapters.length;const nums=ci==null?[1,2,3,4].filter(n=>n<=max):[ci+1,ci+2].filter(n=>n>=1&&n<=max);if(ci==null){const cover=new Image();cover.src=`${novelImageBase}/cover.jpg`}nums.forEach(n=>{const img=new Image();img.src=`${novelImageBase}/chapter-${n}${ci==null?"-thumb":""}.jpg`})},[ci,novel,novelImageBase]);
  const fallbackPages=useMemo(()=>{
    const pageWidth=isMobile?Math.max(280,viewportWidth-52):340;
    const lineChars=Math.max(20,Math.floor(pageWidth/(readerFontSize*.58)));
    const heights=blockPairs.map(block=>{
      const enLines=Math.max(1,Math.ceil(String(block.en||"").length/lineChars));
      const zhLines=showZh&&block.zh?Math.max(1,Math.ceil(String(block.zh).length/Math.max(12,Math.floor(lineChars*.72)))):0;
      return 22+(enLines*readerFontSize*readerLineHeight)+(zhLines?16+zhLines*Math.max(13,readerFontSize-2)*readerLineHeight:0);
    });
    const capacity=readingFocus?(isMobile?590:610):(isMobile?390:430);
    return paginateByHeight(blockPairs,heights,capacity,6);
  },[blockPairs,isMobile,readerFontSize,readerLineHeight,readingFocus,showZh,viewportWidth]);
  const pages=measuredPages.length?measuredPages:fallbackPages;
  const pageNow=spreadStartForPage(Math.min(page,Math.max(0,pages.length-1)),visiblePageCount);
  const pagesAt=start=>Array.from({length:visiblePageCount},(_,offset)=>({index:start+offset,blocks:pages[start+offset]||[]})).filter(item=>item.index<pages.length);
  const visiblePages=pagesAt(pageNow);
  const pageBlocks=visiblePages.flatMap(item=>item.blocks);
  const pageStart=pageBlocks.length?Math.min(...pageBlocks.map(block=>block.i)):0;
  useEffect(()=>{if(activeBlock!=null){const targetPage=findPageForBlock(pages,activeBlock);if(targetPage<pageNow||targetPage>=pageNow+visiblePageCount)turnPage(targetPage,targetPage>pageNow?"forward":"backward",false)}},[activeBlock,pageNow,pages,visiblePageCount]);
  useEffect(()=>{setMeasuredPages([]);measureBlockRefs.current={}},[chapter?.no,isMobile,readerFontSize,readerLineHeight,readingFocus,showZh]);
  useEffect(()=>{
    const panel=novelPanelRef.current;
    if(!panel||typeof ResizeObserver==="undefined")return;
    const observer=new ResizeObserver(()=>setLayoutVersion(v=>v+1));
    observer.observe(panel);
    return()=>observer.disconnect();
  },[chapter?.no]);
  useLayoutEffect(()=>{
    if(!chapter||!blockPairs.length)return;
    const spreadHeight=novelSpreadRef.current?.clientHeight||0;
    const measured=blockPairs.map((_,index)=>measureBlockRefs.current[index]?.getBoundingClientRect?.().height||0);
    if(spreadHeight<240||measured.some(height=>height<=0))return;
    const nextPages=paginateByHeight(blockPairs,measured,Math.max(160,spreadHeight-112),6);
    setMeasuredPages(current=>{
      const currentKey=current.map(items=>items.map(item=>item.i).join(",")).join("|");
      const nextKey=nextPages.map(items=>items.map(item=>item.i).join(",")).join("|");
      return currentKey===nextKey?current:nextPages;
    });
  },[blockPairs,chapter,layoutVersion,readerFontSize,readerLineHeight,readingFocus,showZh,visiblePageCount]);
  useEffect(()=>{
    if(!chapter||typeof window==="undefined"||/jsdom/i.test(navigator.userAgent||""))return;
    const frame=window.requestAnimationFrame(()=>{
      window.scrollTo({top:0,behavior:"auto"});
      document.documentElement.scrollTop=0;
      document.body.scrollTop=0;
    });
    return()=>window.cancelAnimationFrame(frame);
  },[chapter?.no]);
  useEffect(()=>{if(!novel||!chapter||ci==null||!pages.length)return;setReadingProgress(d=>({...d,[novel.id]:{chapterNo:chapter.no,chapterIndex:ci,page:pageNow,pageCount:pages.length,updatedAt:Date.now()}}))},[novel?.id,chapter?.no,ci,pageNow,pages.length]);
  const quiz=chapter?chapter.quiz||[]:[];const quizKey=chapter?`${novel.id}:${chapter.no}`:"";const quizState=quizAns[quizKey]||{};const quizAnswered=quiz.filter((_,i)=>quizState[i]!=null).length;const quizDone=!quiz.length||quiz.every((_,i)=>quizState[i]!=null);
  const chooseQuiz=(qi,oi)=>setQuizAns(d=>({...d,[quizKey]:{...(d[quizKey]||{}),[qi]:oi}}));
  const completeChapter=()=>{if(!chapter)return;if(!quizDone){playSound("wrong");return}const key=`${novel.id}:${chapter.no}`;if(!completed.includes(chapter.no)){setDone(d=>({...d,[novel.id]:[...new Set([...(d[novel.id]||[]),chapter.no])]}));if(!rewarded.current[key]){rewarded.current[key]=true;onXp?.(15);playSound("done")}}};
  const stopNovelSpeech=()=>{novelSpeechRef.current?.cancel?.();novelSpeechRef.current=null;setActiveBlock(null);setActiveVocab(null);stopSpeech()};
  const showBlockPage=bi=>setPage(spreadStartForPage(findPageForBlock(pages,bi),visiblePageCount));
  const readChapter=()=>{if(!chapter||!enBlocks.length)return;stopNovelSpeech();novelSpeechRef.current=speakStory([chapter.title,...enBlocks],{rate:0.78,onSentence:i=>{const bi=i-1;if(bi>=0){setActiveBlock(bi);showBlockPage(bi)}},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readPage=()=>{if(!pageBlocks.length)return;stopNovelSpeech();novelSpeechRef.current=speakStory(pageBlocks.map(b=>b.en),{rate:0.78,onSentence:i=>setActiveBlock(pageBlocks[i]?.i),onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readChapterZh=()=>{if(!chapter||!zhBlocks.length)return;stopNovelSpeech();novelSpeechRef.current=speakStory([chapter.zhTitle,...zhBlocks],{lang:"zh-TW",rate:1,apiTts:true,onSentence:i=>{const bi=i-1;if(bi>=0){setActiveBlock(bi);showBlockPage(bi)}},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readPageZh=()=>{const items=pageBlocks.filter(b=>b.zh);if(!items.length)return;stopNovelSpeech();novelSpeechRef.current=speakStory(items.map(b=>b.zh),{lang:"zh-TW",rate:1,apiTts:true,onSentence:i=>setActiveBlock(items[i]?.i),onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const bilingualChapterItems=()=>[{text:chapter.title,lang:"en-US",rate:0.78},{text:chapter.zhTitle,lang:"zh-TW",rate:1,apiTts:true},...enBlocks.flatMap((en,i)=>[{text:en,lang:"en-US",rate:0.78,blockIndex:i},{text:zhBlocks[i],lang:"zh-TW",rate:1,apiTts:true,blockIndex:i}].filter(x=>x.text))];
  const bilingualPageItems=()=>pageBlocks.flatMap(b=>[{text:b.en,lang:"en-US",rate:0.78,blockIndex:b.i},{text:b.zh,lang:"zh-TW",rate:1,apiTts:true,blockIndex:b.i}].filter(x=>x.text));
  const readBilingualChapter=()=>{if(!chapter||!enBlocks.length)return;stopNovelSpeech();novelSpeechRef.current=speakStory(bilingualChapterItems(),{onSentence:(_,__,item)=>{const bi=item?.blockIndex;if(bi!=null){setActiveBlock(bi);showBlockPage(bi)}},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readBilingualPage=()=>{const items=bilingualPageItems();if(!items.length)return;stopNovelSpeech();novelSpeechRef.current=speakStory(items,{onSentence:(_,__,item)=>{if(item?.blockIndex!=null)setActiveBlock(item.blockIndex)},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const speakNovelText=(text,lang="en-US",rate=0.78,idx=null)=>{stopNovelSpeech();setActiveBlock(idx);speak(text,lang,rate,{apiTts:/^zh/i.test(lang),onend:()=>setActiveBlock(null)})};
  const speakNovelVocab=(word)=>{stopNovelSpeech();setActiveVocab(word);speak(word,"en-US",0.86,{onend:()=>setActiveVocab(null)})};
  const goChapter=(i,startPage=0)=>{stopNovelSpeech();pendingPageRef.current=Math.max(0,Number(startPage)||0);setImmersive(true);setCi(i);setPage(Math.max(0,Number(startPage)||0));if(typeof navigator==="undefined"||!/jsdom/i.test(navigator.userAgent||"")){try{window.scrollTo?.({top:0,behavior:"smooth"})}catch{}}};
  const backToList=()=>{stopNovelSpeech();setCi(null)};
  if(!novelData)return(<div><Hdr t="📘 英文小說" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入小說中...</div></div>);
  if(!novel)return(<div><Hdr t="📘 英文小說" onBack={onBack} cl={c.cl}/><div style={{...S.card,padding:"28px 18px",textAlign:"center",color:S.t2}}>這個年級的小說準備中</div></div>);
  const resumeProgress=novel?readingProgress[novel.id]:null;
  const resumeIndex=resumeProgress?novel.chapters.findIndex(ch=>ch.no===resumeProgress.chapterNo):-1;
  const resumeChapter=resumeIndex>=0?novel.chapters[resumeIndex]:null;
  const resumePageCount=resumeChapter?Math.max(1,Number(resumeProgress?.pageCount)||Math.ceil(novelBlockPairs(resumeChapter.en,resumeChapter.zh).length/2)):1;
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
      {novel.chapters.map((ch,i)=>{const isDone=completed.includes(ch.no);const chProgress=readingProgress[novel.id]?.chapterNo===ch.no?readingProgress[novel.id]:null;const chPageCount=Math.max(1,Number(chProgress?.pageCount)||Math.ceil(novelBlockPairs(ch.en,ch.zh).length/2));const chPage=Math.max(0,Math.min(Number(chProgress?.page)||0,chPageCount-1));const chQuiz=ch.quiz||[];const chQuizState=quizAns[`${novel.id}:${ch.no}`]||{};const chQuizAnswered=chQuiz.filter((_,qi)=>chQuizState[qi]!=null).length;const statusText=isDone?"已完成":chProgress?`進行中 · Page ${chPage+1}/${chPageCount}`:"尚未開始";return(<div key={ch.no} data-testid={`novel-chapter-card-${ch.no}`} onClick={()=>goChapter(i,chProgress?chPage:0)} style={{...S.card,padding:0,overflow:"hidden",cursor:"pointer",border:`1px solid ${isDone?"#1D9E75":chProgress?c.cl:S.bd}`,boxShadow:chProgress?`0 10px 24px ${c.cl}22`:S.card.boxShadow}}>
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
  const next=ci+1<novel.chapters.length?ci+1:null;const prev=ci>0?ci-1:null;const isDone=completed.includes(chapter.no);const canPrevPage=pageNow>0;const canNextPage=pageNow+visiblePageCount<pages.length;const quizScore=quiz.reduce((n,q,i)=>n+(quizState[i]===q.a?1:0),0);
  const pagePct=pages.length?Math.round(((pageNow+1)/pages.length)*100):0;
  const chapterPct=novel.chapters.length?Math.round((((chapter.no-1)+(pageNow+1)/Math.max(1,pages.length))/novel.chapters.length)*100):0;
  const pageEnd=pageBlocks.length?Math.max(...pageBlocks.map(block=>block.i))+1:0;
  const updateReadingPrefs=patch=>setReadingPrefs(d=>({...d,...patch}));
  const panelIsVocab=sidePanel==="vocab";
  const panelTitle=panelIsVocab?"重點單字":`章節測驗 ${quizAnswered}/${quiz.length}`;
  const panelTop=isMobile?"auto":"76px";
  const panelStyle={position:"fixed",zIndex:130,left:isMobile?0:"max(12px, calc((100vw - 760px) / 2 - 304px))",right:isMobile?0:"auto",top:panelTop,bottom:isMobile?0:18,width:isMobile?"auto":286,maxHeight:isMobile?"calc(72vh - env(safe-area-inset-bottom))":"calc(100vh - 94px)",overflowY:"auto",background:S.bg1,border:`1px solid ${c.cl}55`,borderRadius:isMobile?"18px 18px 0 0":16,boxShadow:"0 20px 48px rgba(15,110,86,.22)",padding:14,paddingBottom:isMobile?"calc(14px + env(safe-area-inset-bottom))":14};
  const pageActionsStyle={display:"flex",gap:8,alignItems:"center",paddingTop:10,paddingBottom:isMobile?"calc(10px + env(safe-area-inset-bottom))":"10px",flex:"0 0 auto"};
  const finishPageTurn=()=>{if(!pageTurn)return;window.clearTimeout?.(pageTurnTimerRef.current);pageTurnTimerRef.current=null;setPage(pageTurn.targetStart);setPageTurn(null)};
  const turnPage=(target,direction,stopAudio=true)=>{if(pageTurn)return;if(stopAudio){stopNovelSpeech();setActiveBlock(null)}const targetStart=spreadStartForPage(Math.max(0,Math.min(target,pages.length-1)),visiblePageCount);if(targetStart===pageNow)return;const transition={direction,sourceStart:pageNow,targetStart};setPageTurn(transition);window.clearTimeout?.(pageTurnTimerRef.current);pageTurnTimerRef.current=window.setTimeout?.(()=>{setPage(transition.targetStart);setPageTurn(null);pageTurnTimerRef.current=null},620)};
  const goPreviousPage=()=>turnPage(previousSpreadStart(pageNow,visiblePageCount),"backward");
  const goNextPage=()=>turnPage(nextSpreadStart(pageNow,pages.length,visiblePageCount),"forward");
  const handleReaderKeyDown=e=>{if(pageTurn)return;if(e.key==="ArrowLeft"&&canPrevPage){e.preventDefault();goPreviousPage()}if(e.key==="ArrowRight"&&canNextPage){e.preventDefault();goNextPage()}};
  const handlePointerDown=e=>{swipeStartRef.current={x:e.clientX,y:e.clientY,id:e.pointerId};e.currentTarget.setPointerCapture?.(e.pointerId)};
  const handlePointerUp=e=>{const start=swipeStartRef.current;swipeStartRef.current=null;if(!start||pageTurn)return;const dx=e.clientX-start.x;const dy=e.clientY-start.y;if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.25)return;if(dx<0&&canNextPage)goNextPage();if(dx>0&&canPrevPage)goPreviousPage()};
  const renderNovelBlock=(b,measuring=false)=><section key={`${measuring?"measure":"read"}-${b.i}`} ref={el=>{if(measuring){if(el)measureBlockRefs.current[b.i]=el}else if(el)novelBlockRefs.current[b.i]=el}} onClick={measuring?undefined:()=>speakNovelText(b.en,"en-US",0.78,b.i)} style={{padding:"9px 10px",borderRadius:8,background:!measuring&&activeBlock===b.i?"#E6F7F0":"transparent",border:`1px solid ${!measuring&&activeBlock===b.i?c.cl:"transparent"}`,transition:"background .18s,border-color .18s",cursor:measuring?"default":"pointer"}}>
    <div style={{display:"flex",gap:8,alignItems:"flex-start"}}><p data-testid={measuring?undefined:"novel-reader-text"} style={{flex:1,margin:0,fontSize:readerFontSize,lineHeight:readerLineHeight,color:S.t1,fontFamily:NOVEL_READING_FONT,fontWeight:/^“|^[A-Z][a-z]+[?!]?$/.test(b.en)?800:650,whiteSpace:"pre-line",overflowWrap:"anywhere"}}>{b.en}</p>{!measuring&&<button aria-label="朗讀英文" onClick={e=>{e.stopPropagation();e.currentTarget.blur();speakNovelText(b.en,"en-US",0.78,b.i)}} style={{width:34,height:34,border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:10,padding:0,fontSize:13,cursor:"pointer",fontFamily:"inherit",color:c.cl,flexShrink:0}}>🔊</button>}</div>
    {showZh&&b.zh&&<div data-testid={measuring?undefined:"novel-reader-translation"} style={{marginTop:8,padding:"8px 10px",background:"#FFF8E9",border:"none",borderLeft:"3px solid #D6B873",borderRadius:"2px 7px 7px 2px",fontSize:Math.max(13,readerFontSize-2),lineHeight:readerLineHeight,color:S.t2,fontFamily:"inherit",whiteSpace:"pre-line",display:"flex",gap:8,alignItems:"flex-start",overflowWrap:"anywhere"}}><span style={{flex:1}}>{b.zh}</span>{!measuring&&<button onClick={e=>{e.stopPropagation();e.currentTarget.blur();speakNovelText(b.zh,"zh-TW",1,b.i)}} title="朗讀中文" style={{width:30,height:30,background:"#fff",border:"1px solid #E5D2A5",borderRadius:9,fontSize:14,cursor:"pointer",flexShrink:0}}>🔈</button>}</div>}
  </section>;
  const pageSheetStyle=(item,start=pageNow)=>({height:"100%",minWidth:0,overflow:"hidden",display:"flex",flexDirection:"column",background:NOVEL_PAPER,border:"1px solid #D7D1C4",borderRadius:isMobile?8:item.index===start?"8px 1px 1px 8px":"1px 8px 8px 1px",padding:isMobile?"14px 12px 12px":"16px 14px 12px",boxShadow:item.index===start?"inset -15px 0 22px rgba(77,64,43,.055),0 9px 20px rgba(47,39,28,.09)":"inset 15px 0 22px rgba(77,64,43,.055),0 9px 20px rgba(47,39,28,.09)"});
  const renderPageFace=item=><>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:8,flex:"0 0 auto"}}><div><div style={{fontSize:12,fontWeight:900,color:c.cl}}>Page {item.index+1}</div><div style={{fontSize:10,color:S.t3,fontWeight:800}}>{chapter.title}</div></div><span style={{fontSize:11,color:S.t3}}>{item.blocks.length?`${item.blocks[0].i+1}-${item.blocks[item.blocks.length-1].i+1}`:""}</span></div>
    <div data-testid="novel-page-content" style={{display:"grid",gap:6,minHeight:0,overflow:"hidden",alignContent:"start"}}>{item.blocks.map(block=>renderNovelBlock(block))}</div>
    <div style={{marginTop:"auto",paddingTop:6,textAlign:"center",fontSize:10,color:S.t3,flex:"0 0 auto"}}>{item.index+1}</div>
  </>;
  const renderPageSheet=(item,start=pageNow)=><article key={item.index} data-testid="novel-book-page" style={pageSheetStyle(item,start)}>{renderPageFace(item)}</article>;
  const sourceTurnPages=pageTurn?pagesAt(pageTurn.sourceStart):[];
  const targetTurnPages=pageTurn?pagesAt(pageTurn.targetStart):[];
  const displayedPages=pageTurn?(isMobile?targetTurnPages:pageTurn.direction==="forward"?[sourceTurnPages[0],targetTurnPages[1]].filter(Boolean):[targetTurnPages[0],sourceTurnPages[1]].filter(Boolean)):visiblePages;
  const turningSource=pageTurn?(isMobile?sourceTurnPages[0]:pageTurn.direction==="forward"?sourceTurnPages[1]:sourceTurnPages[0]):null;
  const turningBack=pageTurn?(isMobile?targetTurnPages[0]:pageTurn.direction==="forward"?targetTurnPages[0]:targetTurnPages[1]):null;
  const renderPageTurn=()=>pageTurn&&turningSource?<div data-testid="novel-page-turn" data-direction={pageTurn.direction} aria-hidden="true" inert="" onAnimationEnd={finishPageTurn} style={{position:"absolute",zIndex:6,top:isMobile?8:10,bottom:0,left:isMobile?4:pageTurn.direction==="forward"?"calc(50% + 1px)":8,width:isMobile?"calc(100% - 8px)":"calc(50% - 9px)",transformStyle:"preserve-3d",transformOrigin:pageTurn.direction==="forward"?"left center":"right center",animation:`novel-sheet-${pageTurn.direction} 520ms cubic-bezier(.3,.05,.2,1) forwards`,pointerEvents:"none"}}>
    <article style={{...pageSheetStyle(turningSource,pageTurn.sourceStart),position:"absolute",inset:0,backfaceVisibility:"hidden",borderRadius:isMobile?8:pageTurn.direction==="forward"?"2px 8px 8px 2px":"8px 2px 2px 8px",boxShadow:pageTurn.direction==="forward"?"-12px 4px 22px rgba(62,43,24,.22)":"12px 4px 22px rgba(62,43,24,.22)"}}>{renderPageFace(turningSource)}</article>
    <article aria-hidden="true" style={{...pageSheetStyle(turningBack||turningSource,pageTurn.targetStart),position:"absolute",inset:0,backfaceVisibility:"hidden",transform:"rotateY(180deg)",borderRadius:isMobile?8:pageTurn.direction==="forward"?"8px 2px 2px 8px":"2px 8px 8px 2px",background:"linear-gradient(90deg,#F2EBDD,#FFFDF7 18%,#FFFDF7 82%,#E9DFCF)",boxShadow:pageTurn.direction==="forward"?"12px 4px 22px rgba(62,43,24,.18)":"-12px 4px 22px rgba(62,43,24,.18)",color:"transparent"}}>
      <div style={{height:6,width:"36%",borderRadius:3,background:"rgba(93,75,52,.12)",margin:"5px 0 18px"}}/>
      <div style={{display:"grid",gap:12}}>{[82,66,76,58,72].map((width,i)=><div key={i} style={{height:5,width:`${width}%`,borderRadius:3,background:"rgba(93,75,52,.1)"}}/>)}</div>
    </article>
  </div>:null;
  const finishAndGo=()=>{completeChapter();if(quizDone){next!=null?goChapter(next):backToList()}};
  return(<div><Hdr t="📘 英文小說" onBack={backToList} cl={c.cl} extra={!readingFocus?<button onClick={()=>setShowZh(z=>!z)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 8px",fontSize:12,color:c.cl,cursor:"pointer",fontFamily:"inherit"}}>{showZh?"隱藏中文":"顯示中文"}</button>:null}/>
    {!readingFocus&&<div style={{...S.card,padding:0,overflow:"hidden",marginBottom:10,border:`1px solid ${S.bd}`,borderTop:`4px solid ${c.cl}`,background:"linear-gradient(135deg,#FFFCF3,#F3FBF7)"}}>
      <div data-testid="novel-chapter-hero" style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"minmax(150px,220px) minmax(0,1fr)",gap:0,alignItems:"stretch"}}>
        <div data-testid="novel-hero-media" style={{height:isMobile?"clamp(180px, 48vw, 260px)":"clamp(170px,24vw,220px)",overflow:"visible"}}><NovelIllustration fill chapter={chapter.no} imageBase={novelImageBase} title={novel.title}/></div>
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
    <div data-testid="novel-immersive-shell" style={{width:readingFocus&&!isMobile?"min(1120px, calc(100vw - 32px))":"100%",marginLeft:readingFocus&&!isMobile?"50%":0,transform:readingFocus&&!isMobile?"translateX(-50%)":"none"}}>
    {readingFocus&&<div data-testid="novel-immersive-toolbar" style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:10,padding:isMobile?"9px 9px":"9px 12px",border:`1px solid ${c.cl}44`,borderRadius:10,background:"rgba(255,255,255,.94)",boxShadow:"0 8px 22px rgba(20,66,52,.09)"}}>
      <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0,flex:"1 1 230px"}}>
        <div style={{width:32,height:32,borderRadius:"50%",background:c.cl,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,flexShrink:0}}>{chapter.no}</div>
        <div style={{minWidth:0}}><div style={{fontSize:13,fontWeight:900,color:S.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{chapter.title}</div><div style={{fontSize:10,color:S.t3,fontWeight:800}}>{isMobile?`Page ${pageNow+1}`:`Pages ${pageNow+1}-${Math.min(pageNow+2,pages.length)}`} · {chapterPct}%</div></div>
      </div>
      <div style={{height:6,background:S.bg2,borderRadius:999,overflow:"hidden",flex:isMobile?"1 1 100%":"0 1 150px",minWidth:isMobile?0:90}}><div style={{height:"100%",width:`${chapterPct}%`,background:c.cl,borderRadius:999}}/></div>
      <button onClick={readBilingualPage} disabled={!pageBlocks.some(b=>b.zh)} aria-label="英中本頁朗讀" style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 10px",fontSize:11,opacity:pageBlocks.some(b=>b.zh)?1:.45}}>🎧 本頁</button>
      <button onClick={readBilingualChapter} disabled={!zhBlocks.length} aria-label="整章朗讀" style={{...S.btn,background:c.bg,color:c.cl,padding:"8px 10px",fontSize:11,opacity:zhBlocks.length?1:.45}}>▶ 整章</button>
      <button onClick={()=>setShowZh(z=>!z)} aria-label={showZh?"隱藏中文":"顯示中文"} style={{...S.btn,background:showZh?"#FFF7E6":S.bg2,color:S.t1,padding:"8px 10px",fontSize:11}}>{showZh?"中✓":"中文"}</button>
      <button onClick={()=>updateReadingPrefs({fontSize:Math.max(14,readerFontSize-2)})} aria-label="A-" style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 10px",fontSize:11,minWidth:38}}>A-</button>
      <button onClick={()=>updateReadingPrefs({fontSize:Math.min(22,readerFontSize+2)})} aria-label="A+" style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 10px",fontSize:11,minWidth:38}}>A+</button>
      <button onClick={()=>updateReadingPrefs({lineHeight:readerLineHeight>=1.9?1.66:1.9})} aria-label={readerLineHeight>=1.9?"一般行距":"寬行距"} style={{...S.btn,background:readerLineHeight>=1.9?c.bg:S.bg2,color:readerLineHeight>=1.9?c.cl:S.t1,padding:"8px 10px",fontSize:11}}>行距</button>
      <button onClick={()=>setSidePanel(panelIsVocab?null:"vocab")} aria-label="重點單字" style={{...S.btn,background:panelIsVocab?c.cl:S.bg2,color:panelIsVocab?"#fff":S.t1,padding:"8px 10px",fontSize:11}}>單字</button>
      <button onClick={()=>setSidePanel(sidePanel==="quiz"?null:"quiz")} aria-label={`章節測驗 ${quizAnswered}/${quiz.length}`} style={{...S.btn,background:sidePanel==="quiz"?c.cl:S.bg2,color:sidePanel==="quiz"?"#fff":S.t1,padding:"8px 10px",fontSize:11}}>測驗 {quizAnswered}/{quiz.length}</button>
      <button onClick={()=>setImmersive(false)} aria-label="退出沉浸" style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 10px",fontSize:11}}>退出沉浸</button>
    </div>}
    {!readingFocus&&<div data-testid="novel-reading-settings" style={{display:isMobile?"grid":"flex",gridTemplateColumns:isMobile?"repeat(3, minmax(0, 1fr))":undefined,alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:10,padding:"10px 12px",border:`1px solid ${c.cl}33`,borderRadius:12,background:"linear-gradient(135deg,#FFFFFF,#F1FBF6)",boxShadow:"0 8px 20px rgba(15,110,86,.06)"}}>
      <div style={{fontSize:13,fontWeight:900,color:S.t1,marginRight:isMobile?0:"auto",gridColumn:isMobile?"1 / -1":undefined}}>閱讀設定</div>
      <button onClick={()=>updateReadingPrefs({fontSize:Math.max(14,readerFontSize-2)})} aria-label="A-" style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 10px",fontSize:12,minWidth:42,width:isMobile?"100%":undefined}}>A-</button>
      <div style={{fontSize:12,fontWeight:900,color:c.cl,minWidth:42,textAlign:"center"}}>{readerFontSize}px</div>
      <button onClick={()=>updateReadingPrefs({fontSize:Math.min(22,readerFontSize+2)})} aria-label="A+" style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 10px",fontSize:12,minWidth:42,width:isMobile?"100%":undefined}}>A+</button>
      <button onClick={()=>updateReadingPrefs({lineHeight:readerLineHeight>=1.9?1.66:1.9})} style={{...S.btn,background:readerLineHeight>=1.9?c.bg:S.bg2,color:readerLineHeight>=1.9?c.cl:S.t1,padding:"8px 12px",fontSize:12,width:isMobile?"100%":undefined}}>{readerLineHeight>=1.9?"一般行距":"寬行距"}</button>
      <button onClick={()=>setImmersive(true)} style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 12px",fontSize:12,gridColumn:isMobile?"span 2":undefined,width:isMobile?"100%":undefined}}>進入沉浸</button>
      <button onClick={()=>setSidePanel(panelIsVocab?null:"vocab")} style={{...S.btn,background:panelIsVocab?c.cl:S.bg2,color:panelIsVocab?"#fff":S.t1,padding:"8px 12px",fontSize:12,width:isMobile?"100%":undefined}}>重點單字</button>
      <button onClick={()=>setSidePanel(sidePanel==="quiz"?null:"quiz")} style={{...S.btn,background:sidePanel==="quiz"?c.cl:S.bg2,color:sidePanel==="quiz"?"#fff":S.t1,padding:"8px 12px",fontSize:12,gridColumn:isMobile?"span 2":undefined,width:isMobile?"100%":undefined}}>章節測驗 {quizAnswered}/{quiz.length}</button>
    </div>}
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
    {!readingFocus&&<div data-testid="novel-chapter-nav" style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"auto minmax(0,1fr) auto",alignItems:"center",gap:8,marginBottom:10,fontSize:12,background:"#fff",border:`1px solid ${S.bd}`,borderRadius:12,padding:"9px 10px"}}><button onClick={()=>prev!=null&&goChapter(prev)} disabled={prev==null} style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 11px",opacity:prev==null?0.35:1,fontSize:12,order:isMobile?2:0}}>← 上一章</button><div style={{gridColumn:isMobile?"1 / -1":undefined,order:isMobile?1:0,minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:5}}><span style={{fontWeight:900,color:S.t1}}>章節概覽</span><span style={{fontWeight:900,color:c.cl}}>{chapterPct}%</span></div><div style={{height:7,background:S.bg2,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${chapterPct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:999}}/></div></div><button onClick={()=>next!=null&&goChapter(next)} disabled={next==null} style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 11px",opacity:next==null?0.35:1,fontSize:12,order:isMobile?3:0}}>下一章 →</button></div>}
    <style>{`@keyframes novel-sheet-forward{0%{transform:rotateY(0);filter:brightness(1)}45%{filter:brightness(.88)}100%{transform:rotateY(-180deg);filter:brightness(1)}}@keyframes novel-sheet-backward{0%{transform:rotateY(0);filter:brightness(1)}45%{filter:brightness(.88)}100%{transform:rotateY(180deg);filter:brightness(1)}}@media (prefers-reduced-motion:reduce){[data-testid="novel-page-turn"]{animation:novel-sheet-fade 120ms ease-out forwards!important}}@keyframes novel-sheet-fade{from{opacity:.72}to{opacity:0}}`}</style>
    <div data-testid="novel-reader-panel" ref={novelPanelRef} role="region" aria-label="小說閱讀器，可用左右方向鍵翻頁" tabIndex={0} onKeyDown={handleReaderKeyDown} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} style={{height:readingFocus?(isMobile?"clamp(560px, calc(100vh - 170px), 820px)":"clamp(600px, calc(100vh - 190px), 860px)"):(isMobile?"clamp(440px, calc(100vh - 260px), 720px)":"clamp(430px, calc(100vh - 330px), 720px)"),minHeight:0,overflowY:"hidden",overflowX:"hidden",overscrollBehavior:"contain",touchAction:"pan-y",padding:isMobile?"0 4px calc(18px + env(safe-area-inset-bottom))":"0 4px 12px",border:"1px solid #CBC5B9",borderRadius:14,background:NOVEL_SURROUND,display:"flex",flexDirection:"column",position:"relative",outline:"none"}}>
      <div ref={novelSpreadRef} data-testid="novel-book-spread" data-book-style="clean-paper" style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2, minmax(0, 1fr))",gap:isMobile?0:2,flex:"1 1 auto",minHeight:0,padding:isMobile?"8px 4px 0":"10px 8px 0",position:"relative",perspective:1400}}>
        {!isMobile&&<div data-testid="novel-book-spine" aria-hidden="true" style={{position:"absolute",zIndex:3,left:"50%",top:10,bottom:0,width:10,transform:"translateX(-50%)",background:"linear-gradient(90deg,rgba(67,56,42,.08),rgba(255,255,255,.82),rgba(67,56,42,.08))",boxShadow:"0 0 12px rgba(55,45,32,.09)",pointerEvents:"none"}}/>}
        {displayedPages.map(item=>renderPageSheet(item,pageTurn?.targetStart??pageNow))}
        {renderPageTurn()}
      </div>
      <div aria-hidden="true" style={{position:"absolute",visibility:"hidden",pointerEvents:"none",zIndex:-1,width:isMobile?"calc(100% - 24px)":"calc(50% - 22px)",height:1,overflow:"hidden",left:0,top:0,padding:"16px 14px",boxSizing:"border-box"}}>{blockPairs.map(block=>renderNovelBlock(block,true))}</div>
      <div data-testid="novel-page-actions" style={pageActionsStyle}><button onClick={goPreviousPage} disabled={!canPrevPage||!!pageTurn} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,padding:"10px",fontSize:13,opacity:canPrevPage&&!pageTurn?1:.4}}>上一頁</button><div style={{minWidth:92,textAlign:"center"}}><div style={{fontSize:12,color:S.t1,fontWeight:900,whiteSpace:"nowrap"}}>{isMobile?`Page ${pageNow+1}`:`Pages ${pageNow+1}-${Math.min(pageNow+2,pages.length)}`}</div><div style={{fontSize:10,color:S.t3}}>段落 {pageStart+1}-{pageEnd} / {blockPairs.length}</div></div><button onClick={goNextPage} disabled={!canNextPage||!!pageTurn} style={{...S.btn,background:c.cl,color:"#fff",flex:1,padding:"10px",fontSize:13,opacity:canNextPage&&!pageTurn?1:.4}}>下一頁</button></div>
    </div>
    <div style={{display:"flex",gap:8,marginTop:10}}><button onClick={backToList} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,padding:"11px",fontSize:13}}>章節列表</button><button onClick={finishAndGo} disabled={!quizDone} style={{...S.btn,background:c.cl,color:"#fff",flex:1,padding:"11px",fontSize:13,opacity:quizDone?1:.45}}>{next!=null?"完成並下一章":"完成並返回"}</button></div>
    </div>
  </div>);
}
// ═══ SONGS (英文歌曲練習) ═════════════════════════════════════════════
