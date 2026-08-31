import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  findPageForBlock,
  nextSpreadStart,
  normalizeMeasuredHeights,
  paginateByHeight,
  previousSpreadStart,
  spreadStartForPage,
} from "./novelPagination.js";
import { makeNovelAudioItem, novelBlockPairs } from "../data/novelAudio.js";

const NOVEL_READING_FONT='Georgia, Cambria, "Times New Roman", serif';
const NOVEL_PAPER="#FFFEF9";
const NOVEL_SURROUND="#E8E4DA";
const LazyNovelIllustration=lazy(()=>import("../components/NovelIllustration.jsx"));
function NovelIllustration(props){return <Suspense fallback={<div data-testid={props.fill?"novel-illustration-frame":undefined} style={{height:props.fill?"100%":props.small?150:props.cover?240:360,width:props.fill?"100%":undefined,borderRadius:props.small?0:18,background:"linear-gradient(135deg,#0B3F35,#77C79D)"}}/>}><LazyNovelIllustration {...props}/></Suspense>}
function isNovelReaderControlTarget(target,currentTarget){
  const control=target?.closest?.("button,a,input,select,textarea,[role='button'],[role='tab'],[contenteditable='true']");
  return Boolean(control&&currentTarget?.contains?.(control));
}
function savedNovelBlock(progress){
  if(progress?.blockIndex==null)return null;
  const value=Number(progress.blockIndex);
  return Number.isFinite(value)&&value>=0?Math.floor(value):null;
}
export default function NovelM({lv,onBack,onXp,deps}){
  const {LV,S,useLS,readingWords,playSound,stopSpeech,speak,speakStory,Hdr}=deps;
  const c=LV[lv];const[novelData,setNovelData]=useState(null);const[ni,setNi]=useState(0);const[ci,setCi]=useState(null);const[page,setPage]=useState(0);const[activeBlock,setActiveBlock]=useState(null);const[activeVocab,setActiveVocab]=useState(null);const[sidePanel,setSidePanel]=useState(null);const[showZh,setShowZh]=useState(true);const[immersive,setImmersive]=useState(true);const[isNarrating,setIsNarrating]=useState(false);const[isNarrationPaused,setIsNarrationPaused]=useState(false);const[mobileToolsOpen,setMobileToolsOpen]=useState(false);const[audioPreload,setAudioPreload]=useState({status:"idle",ready:0,total:0});const[done,setDone]=useLS("novelDone",{});const[quizAns,setQuizAns]=useLS("novelQuiz",{});const[readingProgress,setReadingProgress]=useLS("novelReadingProgress",{});const[readingPrefs,setReadingPrefs]=useLS("novelReadingPrefs",{fontSize:16,lineHeight:1.66});const[measuredPages,setMeasuredPages]=useState([]);const[layoutVersion,setLayoutVersion]=useState(0);const[pageTurn,setPageTurn]=useState(null);const rewarded=useRef({});const pendingPageRef=useRef(0);const readingAnchorRef=useRef(null);const novelSpeechRef=useRef(null);const novelPanelRef=useRef(null);const novelSpreadRef=useRef(null);const novelBlockRefs=useRef({});const measureBlockRefs=useRef({});const swipeStartRef=useRef(null);const pageTurnTimerRef=useRef(null);const pageTurnRef=useRef(null);const pageTurnSequenceRef=useRef(0);
  const[viewportWidth,setViewportWidth]=useState(()=>typeof window==="undefined"?1024:window.innerWidth||1024);
  useEffect(()=>{let active=true;import("../data/novels.js").then(m=>{if(active)setNovelData(m.NOVELS)}).catch(()=>{if(active)setNovelData({elementary:[]})});return()=>{active=false}},[]);
  useEffect(()=>()=>{novelSpeechRef.current?.cancel?.();window.clearTimeout?.(pageTurnTimerRef.current);pageTurnRef.current=null},[]);
  useEffect(()=>{if(typeof window==="undefined")return;const onResize=()=>setViewportWidth(window.innerWidth||1024);onResize();window.addEventListener("resize",onResize);return()=>window.removeEventListener("resize",onResize)},[]);
  useEffect(()=>{let active=true;document.fonts?.ready?.then(()=>{if(active)setLayoutVersion(v=>v+1)});return()=>{active=false}},[]);
  useEffect(()=>{const target=Math.max(0,Number(pendingPageRef.current)||0);pendingPageRef.current=0;window.clearTimeout?.(pageTurnTimerRef.current);pageTurnTimerRef.current=null;pageTurnRef.current=null;setPageTurn(null);setPage(target);setActiveBlock(null);setActiveVocab(null);setSidePanel(null);setMobileToolsOpen(false);novelBlockRefs.current={};novelPanelRef.current?.scrollTo({top:0})},[ci,ni]);
  const isMobile=viewportWidth<=560;
  const visiblePageCount=isMobile?1:2;
  const readerFontSize=Math.max(14,Math.min(22,Number(readingPrefs.fontSize)||16));
  const readerLineHeight=Math.max(1.5,Math.min(2.1,Number(readingPrefs.lineHeight)||1.66));
  const readingFocus=immersive;
  const novels=novelData?(novelData[lv]?.length?novelData[lv]:novelData.elementary):[];
  const novel=novels[ni];const completed=done[novel?.id]||[];const chapter=ci==null?null:novel.chapters[ci];const blockPairs=useMemo(()=>novelBlockPairs(chapter?.en,chapter?.zh),[chapter]);const enBlocks=useMemo(()=>blockPairs.map(b=>b.en),[blockPairs]);const zhBlocks=useMemo(()=>blockPairs.map(b=>b.zh),[blockPairs]);const words=chapter?readingWords(chapter.en).length:0;const pct=novel?Math.round((completed.length/novel.chapters.length)*100):0;
  const novelImageBase=novel?.imageBase||"/images/novels/secret-forest";
  useEffect(()=>{if(typeof Image==="undefined"||!novel)return;const max=novel.chapters.length;const nums=ci==null?[1,2,3,4].filter(n=>n<=max):[ci+1,ci+2].filter(n=>n>=1&&n<=max);if(ci==null){const cover=new Image();cover.src=`${novelImageBase}/cover.jpg`}nums.forEach(n=>{const img=new Image();img.src=`${novelImageBase}/chapter-${n}${ci==null?"-thumb":""}.jpg`})},[ci,novel,novelImageBase]);
  const estimatedBlockHeights=useMemo(()=>{
    const pageWidth=isMobile?Math.max(280,viewportWidth-52):340;
    const lineChars=Math.max(20,Math.floor(pageWidth/(readerFontSize*.58)));
    return blockPairs.map(block=>{
      const enLines=Math.max(1,Math.ceil(String(block.en||"").length/lineChars));
      const zhLines=showZh&&block.zh?Math.max(1,Math.ceil(String(block.zh).length/Math.max(12,Math.floor(lineChars*.72)))):0;
      return 22+(enLines*readerFontSize*readerLineHeight)+(zhLines?16+zhLines*Math.max(13,readerFontSize-2)*readerLineHeight:0);
    });
  },[blockPairs,isMobile,readerFontSize,readerLineHeight,showZh,viewportWidth]);
  const fallbackPages=useMemo(()=>{
    const capacity=readingFocus?(isMobile?500:610):(isMobile?410:430);
    return paginateByHeight(blockPairs,estimatedBlockHeights,capacity,6,isMobile?2:1);
  },[blockPairs,estimatedBlockHeights,isMobile,readingFocus]);
  const pages=measuredPages.length?measuredPages:fallbackPages;
  const pageNow=spreadStartForPage(Math.min(page,Math.max(0,pages.length-1)),visiblePageCount);
  const pagesAt=start=>Array.from({length:visiblePageCount},(_,offset)=>({index:start+offset,blocks:pages[start+offset]||[]})).filter(item=>item.index<pages.length);
  const visiblePages=pagesAt(pageNow);
  const pageBlocks=visiblePages.flatMap(item=>item.blocks);
  const pageStart=pageBlocks.length?Math.min(...pageBlocks.map(block=>block.i)):0;
  const novelAudioItem=(text,lang="en-US",kind="block",blockIndex=0)=>makeNovelAudioItem({novelId:novel?.id,chapterNo:chapter?.no,lang,kind,blockIndex,text});
  useLayoutEffect(()=>{
    const anchor=readingAnchorRef.current;
    if(anchor==null||!chapter||!pages.length)return;
    const anchoredPage=spreadStartForPage(findPageForBlock(pages,anchor),visiblePageCount);
    if(anchoredPage!==pageNow){window.clearTimeout?.(pageTurnTimerRef.current);pageTurnTimerRef.current=null;pageTurnRef.current=null;setPageTurn(null);setPage(anchoredPage)}
  },[chapter?.no,pages,visiblePageCount]);
  useEffect(()=>{if(chapter&&pageBlocks.length)readingAnchorRef.current=pageStart},[chapter?.no,pageNow]);
  useEffect(()=>{if(activeBlock!=null){const targetPage=findPageForBlock(pages,activeBlock);if(targetPage<pageNow||targetPage>=pageNow+visiblePageCount)turnPage(targetPage,targetPage>pageNow?"forward":"backward",false)}},[activeBlock,pageNow,pages,visiblePageCount]);
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
    const normalizedMeasured=isMobile?normalizeMeasuredHeights(measured,estimatedBlockHeights):measured;
    const pageChrome=isMobile?82:96;
    const nextPages=paginateByHeight(blockPairs,normalizedMeasured,Math.max(200,spreadHeight-pageChrome),6,isMobile?2:1);
    setMeasuredPages(current=>{
      const currentKey=current.map(items=>items.map(item=>item.i).join(",")).join("|");
      const nextKey=nextPages.map(items=>items.map(item=>item.i).join(",")).join("|");
      return currentKey===nextKey?current:nextPages;
    });
  },[blockPairs,chapter,estimatedBlockHeights,isMobile,layoutVersion,readerFontSize,readerLineHeight,readingFocus,showZh,visiblePageCount]);
  useEffect(()=>{
    if(!chapter||typeof window==="undefined"||/jsdom/i.test(navigator.userAgent||""))return;
    const frame=window.requestAnimationFrame(()=>{
      window.scrollTo({top:0,behavior:"auto"});
      document.documentElement.scrollTop=0;
      document.body.scrollTop=0;
    });
    return()=>window.cancelAnimationFrame(frame);
  },[chapter?.no]);
  useEffect(()=>{if(!novel||!chapter||ci==null||!pages.length)return;setReadingProgress(d=>({...d,[novel.id]:{chapterNo:chapter.no,chapterIndex:ci,page:pageNow,pageCount:pages.length,blockIndex:pageStart,blockCount:blockPairs.length,updatedAt:Date.now()}}))},[novel?.id,chapter?.no,ci,pageNow,pageStart,pages.length,blockPairs.length]);
  useEffect(()=>{
    if(!novel||!chapter||typeof window==="undefined"||/jsdom/i.test(navigator.userAgent||""))return;
    const nextStart=nextSpreadStart(pageNow,pages.length,visiblePageCount);
    const blocks=[...pageBlocks,...(nextStart!==pageNow?pagesAt(nextStart).flatMap(item=>item.blocks):[])];
    const seen=new Set();
    const uniqueBlocks=blocks.filter(block=>{if(seen.has(block.i))return false;seen.add(block.i);return true});
    const items=[
      novelAudioItem(chapter.title,"en-US","title"),
      novelAudioItem(chapter.zhTitle,"zh-TW","title"),
      ...uniqueBlocks.flatMap(block=>[
        block.en?novelAudioItem(block.en,"en-US","block",block.i):null,
        block.zh?novelAudioItem(block.zh,"zh-TW","block",block.i):null,
      ].filter(Boolean)),
    ];
    let cancelled=false;
    setAudioPreload({status:"loading",ready:0,total:items.length});
    const preload=async()=>{
      const preloadMany=window.EnglishGoTTS?.preloadMany;
      if(typeof preloadMany!=="function"){if(!cancelled)setAudioPreload({status:"unavailable",ready:0,total:items.length});return}
      try{
        const ready=Number(await preloadMany(items,{limit:items.length,concurrency:2}))||0;
        if(!cancelled)setAudioPreload({status:ready>=items.length?"ready":"partial",ready,total:items.length});
      }catch{if(!cancelled)setAudioPreload({status:"partial",ready:0,total:items.length})}
    };
    if(window.EnglishGoTTS)preload();
    else window.addEventListener("englishgo:tts-installed",preload,{once:true});
    return()=>{cancelled=true;window.removeEventListener("englishgo:tts-installed",preload)};
  },[novel?.id,chapter?.no,pageNow,pages,visiblePageCount]);
  const quiz=chapter?chapter.quiz||[]:[];const quizKey=chapter?`${novel.id}:${chapter.no}`:"";const quizState=quizAns[quizKey]||{};const quizAnswered=quiz.filter((_,i)=>quizState[i]!=null).length;const quizDone=!quiz.length||quiz.every((_,i)=>quizState[i]!=null);
  const chooseQuiz=(qi,oi)=>setQuizAns(d=>({...d,[quizKey]:{...(d[quizKey]||{}),[qi]:oi}}));
  const completeChapter=()=>{if(!chapter)return;if(!quizDone){playSound("wrong");return}const key=`${novel.id}:${chapter.no}`;if(!completed.includes(chapter.no)){setDone(d=>({...d,[novel.id]:[...new Set([...(d[novel.id]||[]),chapter.no])]}));if(!rewarded.current[key]){rewarded.current[key]=true;onXp?.(15);playSound("done")}}};
  const stopNovelSpeech=()=>{const handle=novelSpeechRef.current;novelSpeechRef.current=null;if(handle?.cancel)handle.cancel();else stopSpeech();setActiveBlock(null);setActiveVocab(null);setIsNarrating(false);setIsNarrationPaused(false)};
  const pauseNovelSpeech=()=>{if(!isNarrating||isNarrationPaused)return;const handle=novelSpeechRef.current;if(handle?.pause){if(handle.pause()===false)return}else{try{window.speechSynthesis?.pause?.()}catch{}}setIsNarrationPaused(true)};
  const resumeNovelSpeech=()=>{if(!isNarrating||!isNarrationPaused)return;const handle=novelSpeechRef.current;if(handle?.resume){if(handle.resume()===false)return}else{try{window.speechSynthesis?.resume?.()}catch{}}setIsNarrationPaused(false)};
  const startNovelStory=(items,options={})=>{setActiveBlock(null);setActiveVocab(null);setIsNarrationPaused(false);setIsNarrating(true);if(isMobile)setMobileToolsOpen(false);const handle=speakStory(items,{...options,onFinish:()=>{setIsNarrating(false);setIsNarrationPaused(false);options.onFinish?.()},oncancel:()=>{setIsNarrating(false);setIsNarrationPaused(false);options.oncancel?.()}});novelSpeechRef.current=handle;return handle};
  const showBlockPage=bi=>setPage(spreadStartForPage(findPageForBlock(pages,bi),visiblePageCount));
  const englishChapterItems=()=>[novelAudioItem(chapter.title,"en-US","title"),...blockPairs.filter(block=>block.en).map(block=>novelAudioItem(block.en,"en-US","block",block.i))];
  const chineseChapterItems=()=>[novelAudioItem(chapter.zhTitle,"zh-TW","title"),...blockPairs.filter(block=>block.zh).map(block=>novelAudioItem(block.zh,"zh-TW","block",block.i))];
  const readChapter=()=>{if(!chapter||!enBlocks.length)return;startNovelStory(englishChapterItems(),{onSentence:i=>{const bi=i-1;if(bi>=0){setActiveBlock(bi);showBlockPage(bi)}},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readPage=()=>{if(!pageBlocks.length)return;startNovelStory(pageBlocks.filter(b=>b.en).map(b=>novelAudioItem(b.en,"en-US","block",b.i)),{onSentence:i=>setActiveBlock(pageBlocks[i]?.i),onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readChapterZh=()=>{if(!chapter||!zhBlocks.length)return;startNovelStory(chineseChapterItems(),{onSentence:i=>{const bi=i-1;if(bi>=0){setActiveBlock(bi);showBlockPage(bi)}},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readPageZh=()=>{const items=pageBlocks.filter(b=>b.zh).map(b=>novelAudioItem(b.zh,"zh-TW","block",b.i));if(!items.length)return;startNovelStory(items,{onSentence:i=>setActiveBlock(items[i]?.blockIndex),onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const bilingualChapterItems=()=>[novelAudioItem(chapter.title,"en-US","title"),novelAudioItem(chapter.zhTitle,"zh-TW","title"),...blockPairs.flatMap(block=>[
    block.en?novelAudioItem(block.en,"en-US","block",block.i):null,
    block.zh?novelAudioItem(block.zh,"zh-TW","block",block.i):null,
  ].filter(Boolean))];
  const bilingualPageItems=()=>pageBlocks.flatMap(block=>[
    block.en?novelAudioItem(block.en,"en-US","block",block.i):null,
    block.zh?novelAudioItem(block.zh,"zh-TW","block",block.i):null,
  ].filter(Boolean));
  const readBilingualChapter=()=>{if(!chapter||!enBlocks.length)return;startNovelStory(bilingualChapterItems(),{onSentence:(_,__,item)=>{const bi=item?.blockIndex;if(bi!=null){setActiveBlock(bi);showBlockPage(bi)}},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readBilingualPage=()=>{const items=bilingualPageItems();if(!items.length)return;startNovelStory(items,{onSentence:(_,__,item)=>{if(item?.blockIndex!=null)setActiveBlock(item.blockIndex)},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const speakNovelText=(text,lang="en-US",rate=0.78,idx=null)=>{const item=novelAudioItem(text,lang,"block",idx);const finish=()=>{setActiveBlock(null);setIsNarrating(false);setIsNarrationPaused(false)};const utterance=speak(item.text,item.lang,item.rate,{apiTts:item.apiTts,audioUrl:item.audioUrl,onend:finish,onerror:finish,oncancel:finish});if(!utterance)return;novelSpeechRef.current=null;setActiveVocab(null);setActiveBlock(idx);setIsNarrationPaused(false);setIsNarrating(true)};
  const speakNovelVocab=(word)=>{const finish=()=>{setActiveVocab(null);setIsNarrating(false);setIsNarrationPaused(false)};const utterance=speak(word,"en-US",0.86,{onend:finish,onerror:finish,oncancel:finish});if(!utterance)return;novelSpeechRef.current=null;setActiveBlock(null);setActiveVocab(word);setIsNarrationPaused(false);setIsNarrating(true)};
  const goChapter=(i,startPage=0,startBlock=null)=>{stopNovelSpeech();const safePage=Math.max(0,Number(startPage)||0);pendingPageRef.current=safePage;readingAnchorRef.current=startBlock==null?null:Math.max(0,Number(startBlock)||0);setImmersive(true);setCi(i);setPage(safePage);if(typeof navigator==="undefined"||!/jsdom/i.test(navigator.userAgent||"")){try{window.scrollTo?.({top:0,behavior:"smooth"})}catch{}}};
  const backToList=()=>{stopNovelSpeech();setCi(null)};
  if(!novelData)return(<div><Hdr t="📘 英文小說" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入小說中...</div></div>);
  if(!novel)return(<div><Hdr t="📘 英文小說" onBack={onBack} cl={c.cl}/><div style={{...S.card,padding:"28px 18px",textAlign:"center",color:S.t2}}>這個年級的小說準備中</div></div>);
  const resumeProgress=novel?readingProgress[novel.id]:null;
  const resumeIndex=resumeProgress?novel.chapters.findIndex(ch=>ch.no===resumeProgress.chapterNo):-1;
  const resumeChapter=resumeIndex>=0?novel.chapters[resumeIndex]:null;
  const resumePageCount=resumeChapter?Math.max(1,Number(resumeProgress?.pageCount)||Math.ceil(novelBlockPairs(resumeChapter.en,resumeChapter.zh).length/2)):1;
  const resumePage=Math.max(0,Math.min(Number(resumeProgress?.page)||0,resumePageCount-1));
  const resumeBlock=savedNovelBlock(resumeProgress);
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
          <div style={{fontSize:12,color:S.t2,marginTop:3}}>上次讀到 Chapter {resumeChapter.no} · {resumeBlock==null?`Page ${resumePage+1}`:`段落 ${resumeBlock+1}`}</div>
        </div>
        <button onClick={()=>goChapter(resumeIndex,resumePage,resumeBlock)} style={{...S.btn,background:c.cl,color:"#fff",padding:"10px 16px",fontSize:13,flex:"0 0 auto"}}>繼續閱讀</button>
      </div>
    </div>}
    {novels.length>1&&<div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:10}}>{novels.map((n,i)=><button key={n.id} onClick={()=>{setNi(i);setCi(null)}} style={{flexShrink:0,padding:"8px 12px",border:"none",borderRadius:12,background:i===ni?c.cl:S.bg2,color:i===ni?"#fff":S.t1,fontWeight:700,fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>{n.title}</button>)}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,158px),1fr))",gap:10}}>
      {novel.chapters.map((ch,i)=>{const isDone=completed.includes(ch.no);const chProgress=readingProgress[novel.id]?.chapterNo===ch.no?readingProgress[novel.id]:null;const chPageCount=Math.max(1,Number(chProgress?.pageCount)||Math.ceil(novelBlockPairs(ch.en,ch.zh).length/2));const chPage=Math.max(0,Math.min(Number(chProgress?.page)||0,chPageCount-1));const chBlock=savedNovelBlock(chProgress);const chQuiz=ch.quiz||[];const chQuizState=quizAns[`${novel.id}:${ch.no}`]||{};const chQuizAnswered=chQuiz.filter((_,qi)=>chQuizState[qi]!=null).length;const statusText=isDone?"已完成":chProgress?`進行中 · ${chBlock==null?`Page ${chPage+1}/${chPageCount}`:`段落 ${chBlock+1}`}`:"尚未開始";return(<div key={ch.no} data-testid={`novel-chapter-card-${ch.no}`} onClick={()=>goChapter(i,chProgress?chPage:0,chBlock)} style={{...S.card,padding:0,overflow:"hidden",cursor:"pointer",border:`1px solid ${isDone?"#1D9E75":chProgress?c.cl:S.bd}`,boxShadow:chProgress?`0 10px 24px ${c.cl}22`:S.card.boxShadow}}>
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
  const audioPreloadLabel=audioPreload.status==="loading"?`語音準備中 0/${audioPreload.total}`:audioPreload.status==="ready"?"✓ 本頁語音已就緒":audioPreload.status==="partial"?`語音待連線 ${audioPreload.ready}/${audioPreload.total}`:audioPreload.status==="unavailable"?"語音服務待連線":"固定真人旁白";
  const panelTop=isMobile?"auto":"76px";
  const panelStyle={position:"fixed",zIndex:130,left:isMobile?0:"max(12px, calc((100vw - 760px) / 2 - 304px))",right:isMobile?0:"auto",top:panelTop,bottom:isMobile?0:18,width:isMobile?"auto":286,maxHeight:isMobile?"calc(72vh - env(safe-area-inset-bottom))":"calc(100vh - 94px)",overflowY:"auto",background:S.bg1,border:`1px solid ${c.cl}55`,borderRadius:isMobile?"18px 18px 0 0":16,boxShadow:"0 20px 48px rgba(15,110,86,.22)",padding:14,paddingBottom:isMobile?"calc(14px + env(safe-area-inset-bottom))":14};
  const pageActionsStyle={display:"flex",gap:8,alignItems:"center",paddingTop:10,paddingBottom:isMobile?"calc(10px + env(safe-area-inset-bottom))":"10px",flex:"0 0 auto"};
  const mobileReaderHeight=readingFocus?(mobileToolsOpen?"clamp(480px, calc(100svh - 320px), 660px)":isNarrating?"clamp(520px, calc(100svh - 255px), 740px)":"clamp(540px, calc(100svh - 210px), 780px)"):"clamp(430px, calc(100svh - 320px), 620px)";
  const finishPageTurn=(transitionId,event)=>{if(event&&event.currentTarget!==event.target)return;const transition=pageTurnRef.current;if(!transition||transition.id!==transitionId)return;window.clearTimeout?.(pageTurnTimerRef.current);pageTurnTimerRef.current=null;pageTurnRef.current=null;setPage(transition.targetStart);setPageTurn(current=>current?.id===transitionId?null:current)};
  const turnPage=(target,direction,stopAudio=true)=>{if(pageTurnRef.current)return;if(stopAudio){stopNovelSpeech();setActiveBlock(null)}const targetStart=spreadStartForPage(Math.max(0,Math.min(target,pages.length-1)),visiblePageCount);if(targetStart===pageNow)return;const transition={id:++pageTurnSequenceRef.current,direction,sourceStart:pageNow,targetStart};pageTurnRef.current=transition;setPageTurn(transition);window.clearTimeout?.(pageTurnTimerRef.current);pageTurnTimerRef.current=window.setTimeout?.(()=>finishPageTurn(transition.id),480)};
  const goPreviousPage=()=>turnPage(previousSpreadStart(pageNow,visiblePageCount),"backward");
  const goNextPage=()=>turnPage(nextSpreadStart(pageNow,pages.length,visiblePageCount),"forward");
  const handleReaderKeyDown=e=>{if(pageTurnRef.current)return;if(e.key==="ArrowLeft"&&canPrevPage){e.preventDefault();goPreviousPage()}if(e.key==="ArrowRight"&&canNextPage){e.preventDefault();goNextPage()}};
  const handlePointerDown=e=>{
    if(pageTurnRef.current||isNovelReaderControlTarget(e.target,e.currentTarget)){
      swipeStartRef.current=null;
      return;
    }
    swipeStartRef.current={x:e.clientX,y:e.clientY,id:e.pointerId};
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const handlePointerCancel=()=>{swipeStartRef.current=null};
  const handlePointerUp=e=>{const start=swipeStartRef.current;swipeStartRef.current=null;try{e.currentTarget.releasePointerCapture?.(e.pointerId)}catch{}if(!start||start.id!==e.pointerId||pageTurnRef.current)return;const dx=e.clientX-start.x;const dy=e.clientY-start.y;if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.25)return;if(dx<0&&canNextPage)goNextPage();if(dx>0&&canPrevPage)goPreviousPage()};
  const renderNovelBlock=(b,measuring=false)=><section key={`${measuring?"measure":"read"}-${b.i}`} ref={el=>{if(measuring){if(el)measureBlockRefs.current[b.i]=el}else if(el)novelBlockRefs.current[b.i]=el}} onClick={measuring?undefined:()=>speakNovelText(b.en,"en-US",0.78,b.i)} style={{padding:isMobile?"7px 8px":"9px 10px",borderRadius:8,background:!measuring&&activeBlock===b.i?"#E6F7F0":"transparent",border:`1px solid ${!measuring&&activeBlock===b.i?c.cl:"transparent"}`,transition:"background .18s,border-color .18s",cursor:measuring?"default":"pointer"}}>
    <div style={{display:"flex",gap:8,alignItems:"flex-start"}}><p data-testid={measuring?undefined:"novel-reader-text"} style={{flex:1,margin:0,fontSize:readerFontSize,lineHeight:readerLineHeight,color:S.t1,fontFamily:NOVEL_READING_FONT,fontWeight:/^“|^[A-Z][a-z]+[?!]?$/.test(b.en)?800:650,whiteSpace:"pre-line",overflowWrap:"anywhere"}}>{b.en}</p>{measuring?<span data-testid="novel-measure-speaker" aria-hidden="true" style={{width:34,height:34,flexShrink:0}}/>:<button aria-label="朗讀英文" onClick={e=>{e.stopPropagation();e.currentTarget.blur();speakNovelText(b.en,"en-US",0.78,b.i)}} style={{width:34,height:34,border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:10,padding:0,fontSize:13,cursor:"pointer",fontFamily:"inherit",color:c.cl,flexShrink:0}}>🔊</button>}</div>
    {showZh&&b.zh&&<div data-testid={measuring?undefined:"novel-reader-translation"} style={{marginTop:isMobile?6:8,padding:isMobile?"7px 8px":"8px 10px",background:"#FFF8E9",border:"none",borderLeft:"3px solid #D6B873",borderRadius:"2px 7px 7px 2px",fontSize:Math.max(13,readerFontSize-2),lineHeight:readerLineHeight,color:S.t2,fontFamily:"inherit",whiteSpace:"pre-line",display:"flex",gap:8,alignItems:"flex-start",overflowWrap:"anywhere"}}><span style={{flex:1}}>{b.zh}</span>{measuring?<span data-testid="novel-measure-speaker" aria-hidden="true" style={{width:30,height:30,flexShrink:0}}/>:<button onClick={e=>{e.stopPropagation();e.currentTarget.blur();speakNovelText(b.zh,"zh-TW",1,b.i)}} title="朗讀中文" aria-label="朗讀中文（固定真人聲線）" style={{width:30,height:30,background:"#fff",border:"1px solid #E5D2A5",borderRadius:9,fontSize:14,cursor:"pointer",flexShrink:0}}>🔈</button>}</div>}
  </section>;
  const pageSheetStyle=(item,start=pageNow)=>({height:"100%",minWidth:0,overflow:"hidden",display:"flex",flexDirection:"column",background:NOVEL_PAPER,border:"1px solid #D7D1C4",borderRadius:isMobile?8:item.index===start?"8px 1px 1px 8px":"1px 8px 8px 1px",padding:isMobile?"11px 9px 9px":"16px 14px 12px",boxShadow:item.index===start?"inset -15px 0 22px rgba(77,64,43,.055),0 9px 20px rgba(47,39,28,.09)":"inset 15px 0 22px rgba(77,64,43,.055),0 9px 20px rgba(47,39,28,.09)"});
  const renderPageFace=item=><>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:isMobile?5:8,flex:"0 0 auto"}}><div><div style={{fontSize:12,fontWeight:900,color:c.cl}}>Page {item.index+1}</div><div style={{fontSize:10,color:S.t3,fontWeight:800}}>{chapter.title}</div></div><span style={{fontSize:11,color:S.t3}}>{item.blocks.length?`${item.blocks[0].i+1}-${item.blocks[item.blocks.length-1].i+1}`:""}</span></div>
    <div data-testid="novel-page-content" style={{display:"grid",gap:6,flex:"1 1 auto",minHeight:0,overflowX:"hidden",overflowY:isMobile?"auto":"hidden",overscrollBehavior:"contain",scrollbarWidth:"thin",alignContent:"start"}}>{item.blocks.map(block=>renderNovelBlock(block))}</div>
    <div style={{marginTop:"auto",paddingTop:6,textAlign:"center",fontSize:10,color:S.t3,flex:"0 0 auto"}}>{item.index+1}</div>
  </>;
  const renderPageSheet=(item,start=pageNow)=><article key={item.index} data-testid="novel-book-page" style={pageSheetStyle(item,start)}>{renderPageFace(item)}</article>;
  const sourceTurnPages=pageTurn?pagesAt(pageTurn.sourceStart):[];
  const targetTurnPages=pageTurn?pagesAt(pageTurn.targetStart):[];
  const displayedPages=pageTurn?(isMobile?targetTurnPages:pageTurn.direction==="forward"?[sourceTurnPages[0],targetTurnPages[1]].filter(Boolean):[targetTurnPages[0],sourceTurnPages[1]].filter(Boolean)):visiblePages;
  const turningSource=pageTurn?(isMobile?sourceTurnPages[0]:pageTurn.direction==="forward"?sourceTurnPages[1]:sourceTurnPages[0]):null;
  const turningBack=pageTurn?(isMobile?targetTurnPages[0]:pageTurn.direction==="forward"?targetTurnPages[0]:targetTurnPages[1]):null;
  const renderPageTurn=()=>pageTurn&&turningSource?<div data-testid="novel-page-turn" data-direction={pageTurn.direction} data-transition-id={pageTurn.id} aria-hidden="true" inert="" onAnimationEnd={event=>finishPageTurn(pageTurn.id,event)} style={{position:"absolute",zIndex:6,top:isMobile?8:10,bottom:0,left:isMobile?4:pageTurn.direction==="forward"?"calc(50% + 1px)":8,width:isMobile?"calc(100% - 8px)":"calc(50% - 9px)",transformStyle:isMobile?"flat":"preserve-3d",transformOrigin:pageTurn.direction==="forward"?"left center":"right center",animation:`${isMobile?"novel-sheet-mobile":"novel-sheet"}-${pageTurn.direction} 400ms cubic-bezier(.3,.05,.2,1) forwards`,pointerEvents:"none"}}>
    <article style={{...pageSheetStyle(turningSource,pageTurn.sourceStart),position:"absolute",inset:0,backfaceVisibility:"hidden",borderRadius:isMobile?8:pageTurn.direction==="forward"?"2px 8px 8px 2px":"8px 2px 2px 8px",boxShadow:pageTurn.direction==="forward"?"-12px 4px 22px rgba(62,43,24,.22)":"12px 4px 22px rgba(62,43,24,.22)"}}>{renderPageFace(turningSource)}</article>
    {!isMobile&&<article aria-hidden="true" style={{...pageSheetStyle(turningBack||turningSource,pageTurn.targetStart),position:"absolute",inset:0,backfaceVisibility:"hidden",transform:"rotateY(180deg)",borderRadius:pageTurn.direction==="forward"?"8px 2px 2px 8px":"2px 8px 8px 2px",background:"linear-gradient(90deg,#F2EBDD,#FFFDF7 18%,#FFFDF7 82%,#E9DFCF)",boxShadow:pageTurn.direction==="forward"?"12px 4px 22px rgba(62,43,24,.18)":"-12px 4px 22px rgba(62,43,24,.18)",color:"transparent"}}>
      <div style={{height:6,width:"36%",borderRadius:3,background:"rgba(93,75,52,.12)",margin:"5px 0 18px"}}/>
      <div style={{display:"grid",gap:12}}>{[82,66,76,58,72].map((width,i)=><div key={i} style={{height:5,width:`${width}%`,borderRadius:3,background:"rgba(93,75,52,.1)"}}/>)}</div>
    </article>}
  </div>:null;
  const finishAndGo=()=>{completeChapter();if(quizDone){next!=null?goChapter(next):backToList()}};
  return(<div>{!(readingFocus&&isMobile)&&<Hdr t="📘 英文小說" onBack={backToList} cl={c.cl} extra={!readingFocus?<button onClick={()=>setShowZh(z=>!z)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 8px",fontSize:12,color:c.cl,cursor:"pointer",fontFamily:"inherit"}}>{showZh?"隱藏中文":"顯示中文"}</button>:null}/>}
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
    {readingFocus&&<div data-testid="novel-immersive-toolbar" style={{display:"flex",alignItems:"center",gap:isMobile?7:7,flexDirection:isMobile?"column":"row",marginBottom:8,padding:isMobile?"7px 8px":"9px 12px",border:`1px solid ${c.cl}44`,borderRadius:10,background:"rgba(255,255,255,.94)",boxShadow:"0 8px 22px rgba(20,66,52,.09)"}}>
      <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0,flex:isMobile?"0 0 auto":"1 1 230px",width:isMobile?"100%":undefined}}>
        {isMobile?<button type="button" onClick={backToList} aria-label="返回章節列表" style={{width:36,height:36,border:`1px solid ${S.bd}`,borderRadius:11,background:S.bg2,color:c.cl,fontSize:18,fontWeight:900,cursor:"pointer",flexShrink:0,padding:0}}>←</button>:<div style={{width:32,height:32,borderRadius:"50%",background:c.cl,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,flexShrink:0}}>{chapter.no}</div>}
        <div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:900,color:S.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{chapter.title}</div><div style={{fontSize:10,color:S.t3,fontWeight:800}}>{isMobile?`Chapter ${chapter.no} · Page ${pageNow+1}`:`Pages ${pageNow+1}-${Math.min(pageNow+2,pages.length)}`} · {chapterPct}%</div></div>
        <span data-testid="novel-audio-status" role="status" aria-live="polite" title={audioPreloadLabel} style={{fontSize:10,fontWeight:900,color:audioPreload.status==="partial"||audioPreload.status==="unavailable"?"#9A6410":c.cl,background:audioPreload.status==="partial"||audioPreload.status==="unavailable"?"#FFF4D8":c.bg,borderRadius:999,padding:"4px 7px",whiteSpace:"nowrap"}}>{isMobile?(audioPreload.status==="ready"?"✓ 語音就緒":audioPreload.status==="loading"?"準備語音…":audioPreload.status==="partial"||audioPreload.status==="unavailable"?"語音待連線":"真人旁白"):audioPreloadLabel}</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,width:isMobile?"100%":undefined,flex:isMobile?"0 0 auto":"0 1 120px",minWidth:isMobile?0:80}}><div style={{height:6,background:S.bg2,borderRadius:999,overflow:"hidden",flex:"1 1 auto",minWidth:40}}><div style={{height:"100%",width:`${chapterPct}%`,background:c.cl,borderRadius:999}}/></div>{isMobile&&<button type="button" onClick={()=>setMobileToolsOpen(open=>!open)} aria-label={mobileToolsOpen?"收合閱讀工具":"展開閱讀工具"} aria-expanded={mobileToolsOpen} aria-controls={mobileToolsOpen?"novel-reading-tools":undefined} style={{...S.btn,background:mobileToolsOpen?c.bg:S.bg2,color:mobileToolsOpen?c.cl:S.t1,border:`1px solid ${mobileToolsOpen?c.cl:S.bd}`,padding:"7px 10px",fontSize:11,minHeight:36,whiteSpace:"nowrap"}}>⚙ 閱讀工具 {mobileToolsOpen?"▴":"▾"}</button>}</div>
      {isMobile&&isNarrating&&<div data-testid="novel-playback-controls" role="group" aria-label="小說朗讀控制" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,width:"100%"}}>{isNarrationPaused?<button onClick={resumeNovelSpeech} aria-label="繼續小說朗讀" style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 10px",fontSize:12,minHeight:40}}>▶ 繼續</button>:<button onClick={pauseNovelSpeech} aria-label="暫停小說朗讀" style={{...S.btn,background:c.bg,color:c.cl,border:`1px solid ${c.cl}`,padding:"8px 10px",fontSize:12,minHeight:40}}>Ⅱ 暫停</button>}<button onClick={stopNovelSpeech} aria-label="停止小說朗讀" style={{...S.btn,background:"#FFF0F0",color:"#B54848",border:"1px solid #E9B8B8",padding:"8px 10px",fontSize:12,minHeight:40}}>■ 停止</button></div>}
      {(!isMobile||mobileToolsOpen)&&<div id="novel-reading-tools" data-testid="novel-toolbar-actions" aria-label="小說閱讀工具" style={{display:isMobile?"grid":"flex",gridTemplateColumns:isMobile?"repeat(3, minmax(0, 1fr))":undefined,gap:7,alignItems:"center",overflowX:"visible",flexWrap:isMobile?undefined:"wrap",width:isMobile?"100%":undefined,maxWidth:"100%",paddingBottom:isMobile?2:0}}>
        <button onClick={readBilingualPage} disabled={!pageBlocks.some(b=>b.zh)} aria-label="英中本頁朗讀" style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 10px",fontSize:11,opacity:pageBlocks.some(b=>b.zh)?1:.45,flexShrink:0}}>🎧 本頁</button>
        <button onClick={readBilingualChapter} disabled={!zhBlocks.length} aria-label="整章朗讀" style={{...S.btn,background:c.bg,color:c.cl,padding:"8px 10px",fontSize:11,opacity:zhBlocks.length?1:.45,flexShrink:0}}>▶ 整章</button>
        {!isMobile&&isNarrating&&(isNarrationPaused?<button onClick={resumeNovelSpeech} aria-label="繼續小說朗讀" style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 10px",fontSize:11,flexShrink:0}}>▶ 繼續</button>:<button onClick={pauseNovelSpeech} aria-label="暫停小說朗讀" style={{...S.btn,background:c.bg,color:c.cl,border:`1px solid ${c.cl}`,padding:"8px 10px",fontSize:11,flexShrink:0}}>Ⅱ 暫停</button>)}
        {!isMobile&&isNarrating&&<button onClick={stopNovelSpeech} aria-label="停止小說朗讀" style={{...S.btn,background:"#FFF0F0",color:"#B54848",border:"1px solid #E9B8B8",padding:"8px 10px",fontSize:11,flexShrink:0}}>■ 停止</button>}
        <button onClick={()=>setShowZh(z=>!z)} aria-label={showZh?"隱藏中文":"顯示中文"} style={{...S.btn,background:showZh?"#FFF7E6":S.bg2,color:S.t1,padding:"8px 10px",fontSize:11,flexShrink:0}}>{showZh?"中✓":"中文"}</button>
        <button onClick={()=>updateReadingPrefs({fontSize:Math.max(14,readerFontSize-2)})} aria-label="A-" style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 10px",fontSize:11,minWidth:38,flexShrink:0}}>A-</button>
        <button onClick={()=>updateReadingPrefs({fontSize:Math.min(22,readerFontSize+2)})} aria-label="A+" style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 10px",fontSize:11,minWidth:38,flexShrink:0}}>A+</button>
        <button onClick={()=>updateReadingPrefs({lineHeight:readerLineHeight>=1.9?1.66:1.9})} aria-label={readerLineHeight>=1.9?"一般行距":"寬行距"} style={{...S.btn,background:readerLineHeight>=1.9?c.bg:S.bg2,color:readerLineHeight>=1.9?c.cl:S.t1,padding:"8px 10px",fontSize:11,flexShrink:0}}>行距</button>
        <button onClick={()=>{setSidePanel(panelIsVocab?null:"vocab");if(isMobile)setMobileToolsOpen(false)}} aria-label="重點單字" style={{...S.btn,background:panelIsVocab?c.cl:S.bg2,color:panelIsVocab?"#fff":S.t1,padding:"8px 10px",fontSize:11,flexShrink:0}}>單字</button>
        <button onClick={()=>{setSidePanel(sidePanel==="quiz"?null:"quiz");if(isMobile)setMobileToolsOpen(false)}} aria-label={`章節測驗 ${quizAnswered}/${quiz.length}`} style={{...S.btn,background:sidePanel==="quiz"?c.cl:S.bg2,color:sidePanel==="quiz"?"#fff":S.t1,padding:"8px 10px",fontSize:11,flexShrink:0}}>測驗 {quizAnswered}/{quiz.length}</button>
        <button onClick={()=>setImmersive(false)} aria-label="退出沉浸" style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 10px",fontSize:11,flexShrink:0}}>退出沉浸</button>
      </div>}
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
    <style data-testid="novel-page-turn-styles">{`@keyframes novel-sheet-forward{0%{transform:rotateY(0);filter:brightness(1);box-shadow:-4px 2px 10px rgba(55,44,30,.10)}48%{filter:brightness(.9);box-shadow:-22px 8px 32px rgba(55,44,30,.25)}100%{transform:rotateY(-180deg);filter:brightness(1);box-shadow:-2px 1px 5px rgba(55,44,30,.05)}}@keyframes novel-sheet-backward{0%{transform:rotateY(0);filter:brightness(1);box-shadow:4px 2px 10px rgba(55,44,30,.10)}48%{filter:brightness(.9);box-shadow:22px 8px 32px rgba(55,44,30,.25)}100%{transform:rotateY(180deg);filter:brightness(1);box-shadow:2px 1px 5px rgba(55,44,30,.05)}}@keyframes novel-sheet-mobile-forward{0%{transform:translateX(0);opacity:1}55%{opacity:.82}100%{transform:translateX(-22%);opacity:0}}@keyframes novel-sheet-mobile-backward{0%{transform:translateX(0);opacity:1}55%{opacity:.82}100%{transform:translateX(22%);opacity:0}}@media (prefers-reduced-motion:reduce){[data-testid="novel-page-turn"]{animation:novel-sheet-fade 120ms ease-out forwards!important}}@keyframes novel-sheet-fade{from{opacity:.72}to{opacity:0}}`}</style>
    <div data-testid="novel-reader-panel" ref={novelPanelRef} role="region" aria-label="小說閱讀器，可左右滑動或用方向鍵翻頁" tabIndex={0} onKeyDown={handleReaderKeyDown} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel} onLostPointerCapture={handlePointerCancel} style={{height:isMobile?mobileReaderHeight:readingFocus?"clamp(600px, calc(100vh - 190px), 860px)":"clamp(430px, calc(100vh - 330px), 720px)",minHeight:0,overflowY:"hidden",overflowX:"hidden",overscrollBehavior:"contain",touchAction:"pan-y",padding:isMobile?"0 4px calc(14px + env(safe-area-inset-bottom))":"0 4px 12px",border:"1px solid #CBC5B9",borderRadius:14,background:NOVEL_SURROUND,display:"flex",flexDirection:"column",position:"relative",outline:"none",transition:"height .18s ease"}}>
      <div ref={novelSpreadRef} data-testid="novel-book-spread" data-book-style="clean-paper" style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2, minmax(0, 1fr))",gap:isMobile?0:2,flex:"1 1 auto",minHeight:0,padding:isMobile?"8px 4px 0":"10px 8px 0",position:"relative",perspective:1400}}>
        {!isMobile&&<div data-testid="novel-book-spine" aria-hidden="true" style={{position:"absolute",zIndex:3,left:"50%",top:10,bottom:0,width:10,transform:"translateX(-50%)",background:"linear-gradient(90deg,rgba(67,56,42,.08),rgba(255,255,255,.82),rgba(67,56,42,.08))",boxShadow:"0 0 12px rgba(55,45,32,.09)",pointerEvents:"none"}}/>}
        {displayedPages.map(item=>renderPageSheet(item,pageTurn?.targetStart??pageNow))}
        {renderPageTurn()}
      </div>
      <div data-testid="novel-measurement-layer" aria-hidden="true" style={{position:"absolute",visibility:"hidden",pointerEvents:"none",zIndex:-1,width:isMobile?"calc(100% - 24px)":"calc(50% - 22px)",height:1,overflow:"hidden",left:0,top:0,padding:isMobile?"11px 9px":"16px 14px",boxSizing:"border-box"}}>{blockPairs.map(block=>renderNovelBlock(block,true))}</div>
      <div data-testid="novel-page-actions" style={pageActionsStyle}><button onClick={goPreviousPage} disabled={!canPrevPage||!!pageTurn} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,padding:"10px",fontSize:13,opacity:canPrevPage&&!pageTurn?1:.4}}>上一頁</button><div style={{minWidth:isMobile?112:92,textAlign:"center"}}><div style={{fontSize:12,color:S.t1,fontWeight:900,whiteSpace:"nowrap"}}>{isMobile?`Page ${pageNow+1}`:`Pages ${pageNow+1}-${Math.min(pageNow+2,pages.length)}`}</div><div style={{fontSize:10,color:S.t3,whiteSpace:"nowrap"}}>{isMobile?"↔ 左右滑動 · ":""}段落 {pageStart+1}-{pageEnd} / {blockPairs.length}</div></div><button onClick={goNextPage} disabled={!canNextPage||!!pageTurn} style={{...S.btn,background:c.cl,color:"#fff",flex:1,padding:"10px",fontSize:13,opacity:canNextPage&&!pageTurn?1:.4}}>下一頁</button></div>
    </div>
    <div style={{display:"flex",gap:8,marginTop:10}}><button onClick={backToList} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,padding:"11px",fontSize:13}}>章節列表</button><button onClick={finishAndGo} disabled={!quizDone} style={{...S.btn,background:c.cl,color:"#fff",flex:1,padding:"11px",fontSize:13,opacity:quizDone?1:.45}}>{next!=null?"完成並下一章":"完成並返回"}</button></div>
    </div>
  </div>);
}
// ═══ SONGS (英文歌曲練習) ═════════════════════════════════════════════
