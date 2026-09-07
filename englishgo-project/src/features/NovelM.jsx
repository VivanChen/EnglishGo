import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  findPageForBlock,
  nextSpreadStart,
  paginateByHeight,
  previousSpreadStart,
  spreadStartForPage,
} from "./novelPagination.js";
import { makeNovelAudioItem, novelBlockPairs } from "../data/novelAudio.js";
import { BOOKMARK_LIMIT, bookmarkKey, resolveBookmarks, resolveReadingBlock, NOVEL_READING_VERSION, NOVEL_TONES } from "./novelReading.js";
import { NovelJourney, NovelPreferences } from "./NovelReadingTools.jsx";
import NovelLibrary from "./NovelLibrary.jsx";
import "../novel-reading.css";

const NOVEL_READING_FONT='Georgia, Cambria, "Times New Roman", serif';
const LazyNovelIllustration=lazy(()=>import("../components/NovelIllustration.jsx"));
function NovelIllustration(props){return <Suspense fallback={<div data-testid={props.fill?"novel-illustration-frame":undefined} style={{height:props.fill?"100%":props.small?150:props.cover?240:360,width:props.fill?"100%":undefined,borderRadius:props.small?0:18,background:"linear-gradient(135deg,#0B3F35,#77C79D)"}}/>}><LazyNovelIllustration {...props}/></Suspense>}
function isNovelReaderControlTarget(target,currentTarget){
  const control=target?.closest?.("button,a,input,select,textarea,[role='button'],[role='tab'],[contenteditable='true']");
  return Boolean(control&&currentTarget?.contains?.(control));
}

export default function NovelM({lv,onBack,onXp,deps}){
  const {LV,S,useLS,readingWords,playSound,stopSpeech,speak,speakStory,Hdr}=deps;
  const c=LV[lv];const[novelData,setNovelData]=useState(null);const[selectedBooks,setSelectedBooks]=useLS("novelSelectedBooks",{});const[ci,setCi]=useState(null);const[page,setPage]=useState(0);const[activeBlock,setActiveBlock]=useState(null);const[activeVocab,setActiveVocab]=useState(null);const[sidePanel,setSidePanel]=useState(null);const[isNarrating,setIsNarrating]=useState(false);const[isNarrationPaused,setIsNarrationPaused]=useState(false);const[audioPreload,setAudioPreload]=useState({status:"idle",ready:0,total:0});const[done,setDone]=useLS("novelDone",{});const[quizAns,setQuizAns]=useLS("novelQuiz",{});const[readingProgress,setReadingProgress]=useLS("novelReadingProgress",{});const[readingPrefs,setReadingPrefs]=useLS("novelReadingPrefs",{fontSize:18,lineHeight:1.8});const[measurement,setMeasurement]=useState({chapter:null,pages:[]});const[layoutVersion,setLayoutVersion]=useState(0);const[pageTurn,setPageTurn]=useState(null);const rewarded=useRef({});const pendingPageRef=useRef(0);const readingAnchorRef=useRef(null);const novelSpeechRef=useRef(null);const novelPanelRef=useRef(null);const novelSpreadRef=useRef(null);const novelBlockRefs=useRef({});const measureBlockRefs=useRef({});const swipeStartRef=useRef(null);const pageTurnTimerRef=useRef(null);const pageTurnRef=useRef(null);const pageTurnSequenceRef=useRef(0);
  const[bookmarks,setBookmarks]=useLS("novelBookmarks",{});
  const[peekBlocks,setPeekBlocks]=useState({});
  const[bookmarkNotice,setBookmarkNotice]=useState(null);
  const[removedBookmark,setRemovedBookmark]=useState(null);
  const[focusBlock,setFocusBlock]=useState(null);
  const[selectedParagraph,setSelectedParagraph]=useState(null);
  const toolsPanelRef=useRef(null);
  const speechSequenceRef=useRef(0);
  const showZh=readingPrefs?.showZh!==false;

  const readerFont=readingPrefs?.fontFamily==="clear"?'Arial, "Noto Sans", sans-serif':NOVEL_READING_FONT;
  const tone=NOVEL_TONES[readingPrefs?.tone]||NOVEL_TONES.paper;
  const readerColors={"--reader-paper":tone.paper,"--reader-ink":tone.ink,"--reader-muted":tone.muted,"--reader-rule":tone.rule,"--reader-accent":tone.accent,"--reader-active":tone.active};
  const[viewportHeight,setViewportHeight]=useState(()=>typeof window==="undefined"?768:window.innerHeight||768);
  const[viewportWidth,setViewportWidth]=useState(()=>typeof window==="undefined"?1024:window.innerWidth||1024);
  useEffect(()=>{let active=true;import("../data/novels.js").then(m=>{if(active)setNovelData(m.NOVELS)}).catch(()=>{if(active)setNovelData({elementary:[]})});return()=>{active=false}},[]);
  useEffect(()=>()=>{speechSequenceRef.current++;if(novelSpeechRef.current?.cancel)novelSpeechRef.current.cancel();else stopSpeech();window.clearTimeout?.(pageTurnTimerRef.current);pageTurnRef.current=null},[]);
  useEffect(()=>{if(typeof window==="undefined")return;const onResize=()=>{setViewportWidth(window.innerWidth||1024);setViewportHeight(window.innerHeight||768)};onResize();window.addEventListener("resize",onResize);return()=>window.removeEventListener("resize",onResize)},[]);
  useEffect(()=>{let active=true;document.fonts?.ready?.then(()=>{if(active)setLayoutVersion(v=>v+1)});return()=>{active=false}},[]);
  const isMobile=viewportWidth<=560||(viewportWidth<=960&&viewportHeight<=500);
  const visiblePageCount=1;
  const readerFontSize=Math.max(14,Math.min(22,Number(readingPrefs?.fontSize)||16));
  const readerLineHeight=Math.max(1.5,Math.min(2.1,Number(readingPrefs?.lineHeight)||1.66));

  const novels=novelData?(novelData[lv]?.length?novelData[lv]:novelData.elementary):[];
  const ni=Math.max(0,novels.findIndex(book=>book.id===selectedBooks?.[lv]));
  const setNi=index=>setSelectedBooks(saved=>({...saved,[lv]:novels[index]?.id}));
  useEffect(()=>{const target=Math.max(0,Number(pendingPageRef.current)||0);pendingPageRef.current=0;window.clearTimeout?.(pageTurnTimerRef.current);pageTurnTimerRef.current=null;pageTurnRef.current=null;setPageTurn(null);setPage(target);setActiveBlock(null);setActiveVocab(null);setSidePanel(null);setPeekBlocks({});setBookmarkNotice(null);setRemovedBookmark(null);novelBlockRefs.current={};novelPanelRef.current?.scrollTo({top:0})},[ci,ni]);
  const novel=novels[ni];const completed=done[novel?.id]||[];const chapter=ci==null?null:novel?.chapters[ci];const blockPairs=useMemo(()=>novelBlockPairs(chapter?.en,chapter?.zh),[chapter]);const enBlocks=useMemo(()=>blockPairs.map(b=>b.en),[blockPairs]);const zhBlocks=useMemo(()=>blockPairs.map(b=>b.zh),[blockPairs]);

  useEffect(()=>{
    if(!chapter)return;
    document.documentElement.classList.add("novel-reading-open");
    if(isMobile)document.documentElement.classList.add("novel-mobile-reading");
    return()=>document.documentElement.classList.remove("novel-reading-open","novel-mobile-reading");
  },[chapter,isMobile]);
  const savedBookmarks=useMemo(()=>resolveBookmarks(novel,bookmarks?.[novel?.id]),[novel,bookmarks]);
  const savedKeys=new Set(savedBookmarks.map(bookmarkKey));
  useEffect(()=>{
    const panel=toolsPanelRef.current;
    if(!sidePanel||!panel)return;
    const previous=document.activeElement;
    panel.querySelector('button')?.focus();
    const handleKey=event=>{
      if(event.key==="Escape"){event.preventDefault();setSidePanel(null);return}
      if(event.key!=="Tab")return;
      const controls=[...panel.querySelectorAll('button:not(:disabled),select,input,a[href],[tabindex="0"]')];
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    };
    document.addEventListener("keydown",handleKey);
    const overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.removeEventListener("keydown",handleKey);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();else novelPanelRef.current?.focus({preventScroll:true})};
  },[sidePanel,isMobile]);
  const novelImageBase=novel?.imageBase||"/images/novels/secret-forest";
  useEffect(()=>{if(typeof Image==="undefined"||!novel)return;const max=novel.chapters.length;const nums=ci==null?[1,2,3,4].filter(n=>n<=max):[ci+1,ci+2].filter(n=>n>=1&&n<=max);if(ci==null){const cover=new Image();cover.src=`${novelImageBase}/cover.jpg`}nums.forEach(n=>{const img=new Image();img.src=`${novelImageBase}/chapter-${n}${ci==null?"-thumb":""}.jpg`})},[ci,novel,novelImageBase]);
  const estimatedBlockHeights=useMemo(()=>{
    const pageWidth=Math.max(200,Math.min(720,viewportWidth-48)-40);
    const lineChars=Math.max(20,Math.floor(pageWidth/(readerFontSize*.58)));
    return blockPairs.map(block=>{
      const enLines=Math.max(1,Math.ceil(String(block.en||"").length/lineChars));
      const zhLines=(showZh||peekBlocks[block.i])&&block.zh?Math.max(1,Math.ceil(String(block.zh).length/Math.max(12,Math.floor(lineChars*.72)))):0;
      return 12+Math.max(32,enLines*readerFontSize*readerLineHeight)+(zhLines?7+zhLines*Math.max(13,readerFontSize-2)*readerLineHeight:0);
    });
  },[blockPairs,isMobile,readerFontSize,readerLineHeight,showZh,peekBlocks,viewportWidth]);
  const fallbackPages=useMemo(()=>{
    const capacity=Math.max(120,viewportHeight-(isMobile?200:240));
    return paginateByHeight(blockPairs,estimatedBlockHeights,capacity,8,1);
  },[blockPairs,estimatedBlockHeights,isMobile,viewportHeight]);
  const pages=measurement.chapter===chapter&&measurement.pages.length?measurement.pages:fallbackPages;
  const pageNow=spreadStartForPage(Math.min(page,Math.max(0,pages.length-1)),visiblePageCount);
  const pagesAt=start=>Array.from({length:visiblePageCount},(_,offset)=>({index:start+offset,blocks:pages[start+offset]||[]})).filter(item=>item.index<pages.length);
  const visiblePages=pagesAt(pageNow);
  const pageBlocks=visiblePages.flatMap(item=>item.blocks);
  const pageStart=pageBlocks.length?Math.min(...pageBlocks.map(block=>block.i)):0;
  useLayoutEffect(()=>{
    const content=novelSpreadRef.current?.querySelector('[data-testid="novel-page-content"]');
    if(content)content.scrollTop=0;
  },[chapter,pageNow,pageTurn?.targetStart]);
  useEffect(()=>{
    if(focusBlock==null||!chapter||!pageBlocks.some(block=>block.i===focusBlock))return;
    const node=novelBlockRefs.current[focusBlock];
    if(!node)return;
    node.focus({preventScroll:true});
    const container=node.closest('[data-testid="novel-page-content"]');
    if(container)container.scrollTop+=node.getBoundingClientRect().top-container.getBoundingClientRect().top-8;
    setFocusBlock(null);
  },[focusBlock,chapter,pageNow,pages]);
  const novelAudioItem=(text,lang="en-US",kind="block",blockIndex=0)=>makeNovelAudioItem({novelId:novel?.id,chapterNo:chapter?.no,lang,kind,blockIndex,text});
  useLayoutEffect(()=>{
    const anchor=readingAnchorRef.current;
    if(anchor==null||!chapter||!pages.length)return;
    const anchoredPage=spreadStartForPage(findPageForBlock(pages,anchor),visiblePageCount);
    if(anchoredPage!==pageNow){window.clearTimeout?.(pageTurnTimerRef.current);pageTurnTimerRef.current=null;pageTurnRef.current=null;setPageTurn(null);setPage(anchoredPage)}
  },[chapter?.no,pages,visiblePageCount]);
  useEffect(()=>{if(chapter&&pageBlocks.length&&readingAnchorRef.current==null)readingAnchorRef.current=pageStart},[chapter?.no,pageNow]);
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
    const spreadHeight=novelSpreadRef.current?.querySelector('[data-testid="novel-page-content"]')?.clientHeight||0;
    const measured=blockPairs.map((_,index)=>measureBlockRefs.current[index]?.getBoundingClientRect?.().height||0);
    if(spreadHeight<80||measured.some(height=>height<=0))return;
    const nextPages=paginateByHeight(blockPairs,measured,Math.max(60,spreadHeight-4),8,1);
    setMeasurement(current=>{
      const currentKey=current.pages.map(items=>items.map(item=>item.i).join(",")).join("|");
      const nextKey=nextPages.map(items=>items.map(item=>item.i).join(",")).join("|");
      return current.chapter===chapter&&currentKey===nextKey?current:{chapter,pages:nextPages};
    });
  },[blockPairs,chapter,estimatedBlockHeights,isMobile,layoutVersion,readerFontSize,readerLineHeight,showZh,peekBlocks,readerFont,visiblePageCount]);
  useEffect(()=>{
    if(!chapter||typeof window==="undefined"||/jsdom/i.test(navigator.userAgent||""))return;
    const frame=window.requestAnimationFrame(()=>{
      window.scrollTo({top:0,behavior:"auto"});
      document.documentElement.scrollTop=0;
      document.body.scrollTop=0;
    });
    return()=>window.cancelAnimationFrame(frame);
  },[chapter?.no]);
  useEffect(()=>{if(!novel||!chapter||ci==null||!pages.length)return;setReadingProgress(d=>({...d,[novel.id]:{chapterNo:chapter.no,chapterIndex:ci,page:pageNow,pageCount:pages.length,blockIndex:Math.max(0,Math.min(readingAnchorRef.current??pageStart,blockPairs.length-1)),blockCount:blockPairs.length,contentVersion:NOVEL_READING_VERSION,updatedAt:Date.now()}}))},[novel?.id,chapter?.no,ci,pageNow,pageStart,pages.length,blockPairs.length,focusBlock]);
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
  const stopNovelSpeech=()=>{speechSequenceRef.current++;const handle=novelSpeechRef.current;novelSpeechRef.current=null;if(handle?.cancel)handle.cancel();else stopSpeech();setActiveBlock(null);setActiveVocab(null);setIsNarrating(false);setIsNarrationPaused(false)};
  const pauseNovelSpeech=()=>{if(!isNarrating||isNarrationPaused)return;const handle=novelSpeechRef.current;if(handle?.pause){if(handle.pause()===false)return}else{try{window.speechSynthesis?.pause?.()}catch{}}setIsNarrationPaused(true)};
  const resumeNovelSpeech=()=>{if(!isNarrating||!isNarrationPaused)return;const handle=novelSpeechRef.current;if(handle?.resume){if(handle.resume()===false)return}else{try{window.speechSynthesis?.resume?.()}catch{}}setIsNarrationPaused(false)};
  const startNovelStory=(items,options={})=>{
    const sequence=++speechSequenceRef.current;
    setActiveBlock(null);setActiveVocab(null);setIsNarrationPaused(false);setIsNarrating(true);
    setSidePanel(null);
    const guard=callback=>(...args)=>{if(sequence===speechSequenceRef.current)callback?.(...args)};
    const finish=callback=>guard(()=>{setIsNarrating(false);setIsNarrationPaused(false);callback?.()});
    const handle=speakStory(items,{...options,onSentence:guard(options.onSentence),onFinish:finish(options.onFinish),oncancel:finish(options.oncancel)});
    novelSpeechRef.current=handle;return handle;
  };
  const englishChapterItems=()=>[novelAudioItem(chapter.title,"en-US","title"),...blockPairs.filter(block=>block.en).map(block=>novelAudioItem(block.en,"en-US","block",block.i))];
  const chineseChapterItems=()=>[novelAudioItem(chapter.zhTitle,"zh-TW","title"),...blockPairs.filter(block=>block.zh).map(block=>novelAudioItem(block.zh,"zh-TW","block",block.i))];
  const readChapter=()=>{if(!chapter||!enBlocks.length)return;startNovelStory(englishChapterItems(),{onSentence:i=>{const bi=i-1;if(bi>=0)setActiveBlock(bi)},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readPage=()=>{if(!pageBlocks.length)return;startNovelStory(pageBlocks.filter(b=>b.en).map(b=>novelAudioItem(b.en,"en-US","block",b.i)),{onSentence:i=>setActiveBlock(pageBlocks[i]?.i),onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readChapterZh=()=>{if(!chapter||!zhBlocks.length)return;startNovelStory(chineseChapterItems(),{onSentence:i=>{const bi=i-1;if(bi>=0)setActiveBlock(bi)},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readPageZh=()=>{const items=pageBlocks.filter(b=>b.zh).map(b=>novelAudioItem(b.zh,"zh-TW","block",b.i));if(!items.length)return;startNovelStory(items,{onSentence:i=>setActiveBlock(items[i]?.blockIndex),onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const bilingualChapterItems=()=>[novelAudioItem(chapter.title,"en-US","title"),novelAudioItem(chapter.zhTitle,"zh-TW","title"),...blockPairs.flatMap(block=>[
    block.en?novelAudioItem(block.en,"en-US","block",block.i):null,
    block.zh?novelAudioItem(block.zh,"zh-TW","block",block.i):null,
  ].filter(Boolean))];
  const bilingualPageItems=()=>pageBlocks.flatMap(block=>[
    block.en?novelAudioItem(block.en,"en-US","block",block.i):null,
    block.zh?novelAudioItem(block.zh,"zh-TW","block",block.i):null,
  ].filter(Boolean));
  const readBilingualChapter=()=>{if(!chapter||!enBlocks.length)return;startNovelStory(bilingualChapterItems(),{onSentence:(_,__,item)=>{if(item?.blockIndex!=null)setActiveBlock(item.blockIndex)},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readBilingualPage=()=>{const items=bilingualPageItems();if(!items.length)return;startNovelStory(items,{onSentence:(_,__,item)=>{if(item?.blockIndex!=null)setActiveBlock(item.blockIndex)},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}})};
  const readBilingualFromHere=()=>{
    const items=blockPairs.filter(block=>block.i>=pageStart).flatMap(block=>[
      block.en?novelAudioItem(block.en,"en-US","block",block.i):null,
      block.zh?novelAudioItem(block.zh,"zh-TW","block",block.i):null,
    ].filter(Boolean));
    if(!items.length)return;
    startNovelStory(items,{onSentence:(_,__,item)=>{if(item?.blockIndex!=null)setActiveBlock(item.blockIndex)},onFinish:()=>{novelSpeechRef.current=null;setActiveBlock(null)},oncancel:()=>{novelSpeechRef.current=null;setActiveBlock(null)}});
  };
  const speakNovelText=(text,lang="en-US",rate=0.78,idx=null)=>{const sequence=++speechSequenceRef.current;const item=novelAudioItem(text,lang,"block",idx);const finish=()=>{if(sequence!==speechSequenceRef.current)return;setActiveBlock(null);setIsNarrating(false);setIsNarrationPaused(false)};const utterance=speak(item.text,item.lang,item.rate,{apiTts:item.apiTts,audioUrl:item.audioUrl,onend:finish,onerror:finish,oncancel:finish});if(!utterance)return;novelSpeechRef.current=null;setActiveVocab(null);setActiveBlock(idx);setIsNarrationPaused(false);setIsNarrating(true)};
  const speakNovelVocab=(word)=>{const sequence=++speechSequenceRef.current;const finish=()=>{if(sequence!==speechSequenceRef.current)return;setActiveVocab(null);setIsNarrating(false);setIsNarrationPaused(false)};const utterance=speak(word,"en-US",0.86,{onend:finish,onerror:finish,oncancel:finish});if(!utterance)return;novelSpeechRef.current=null;setActiveBlock(null);setActiveVocab(word);setIsNarrationPaused(false);setIsNarrating(true)};
  const goChapter=(i,startPage=0,startBlock=null)=>{stopNovelSpeech();const safePage=Math.max(0,Number(startPage)||0);pendingPageRef.current=safePage;readingAnchorRef.current=startBlock==null?null:Math.max(0,Number(startBlock)||0);setCi(i);setPage(safePage);if(typeof navigator==="undefined"||!/jsdom/i.test(navigator.userAgent||"")){try{window.scrollTo?.({top:0,behavior:"smooth"})}catch{}}};
  const backToList=()=>{stopNovelSpeech();setCi(null)};
  if(!novelData)return(<div><Hdr t="📘 英文小說" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入小說中...</div></div>);
  if(!novel)return(<div><Hdr t="📘 英文小說" onBack={onBack} cl={c.cl}/><div style={{...S.card,padding:"28px 18px",textAlign:"center",color:S.t2}}>這個年級的小說準備中</div></div>);
  if(ci==null)return <NovelLibrary novels={novels} novel={novel} index={ni} onSelect={setNi} onBack={onBack} onOpen={goChapter} completed={completed} progress={readingProgress} quizAnswers={quizAns} readingWords={readingWords}/>;

  const next=ci+1<novel.chapters.length?ci+1:null;
  const isDone=completed.includes(chapter.no);
  const canPrevPage=pageNow>0,canNextPage=pageNow+1<pages.length;
  const pagePct=Math.round(Math.min(pageNow+1,pages.length)/Math.max(1,pages.length)*100);
  const chapterPct=Math.round((ci+(pageNow+1)/Math.max(1,pages.length))/novel.chapters.length*100);
  const updateReadingPrefs=patch=>setReadingPrefs(current=>({...current,...patch}));
  const panelTitles={journey:'目錄與書籤',settings:'閱讀偏好',vocab:'重點單字',quiz:`章節測驗 ${quizAnswered}/${quiz.length}`,audio:'聽故事',tools:'閱讀工具',paragraph:'這一段，慢慢讀',scene:'故事裡的風景'};
  const playbackStatus=isNarrating?(isNarrationPaused?'朗讀已暫停':'正在陪你讀故事'):audioPreload.status==='ready'?'本頁語音已準備好':audioPreload.status==='loading'?'正在準備本頁語音':'連線後就能聽故事';
  const finishPageTurn=(id,event)=>{
    if(event&&event.target!==event.currentTarget)return;
    const transition=pageTurnRef.current;if(!transition||transition.id!==id)return;
    window.clearTimeout(pageTurnTimerRef.current);pageTurnRef.current=null;pageTurnTimerRef.current=null;
    readingAnchorRef.current=pages[transition.targetStart]?.[0]?.i??0;setPage(transition.targetStart);setPageTurn(null);
  };
  const turnPage=(target,direction,stopAudio=true)=>{
    if(pageTurnRef.current)return;
    if(stopAudio)stopNovelSpeech();
    const targetStart=Math.max(0,Math.min(target,pages.length-1));if(targetStart===pageNow)return;
    const transition={id:++pageTurnSequenceRef.current,targetStart,direction};
    pageTurnRef.current=transition;setPageTurn(transition);window.clearTimeout(pageTurnTimerRef.current);
    pageTurnTimerRef.current=window.setTimeout(()=>finishPageTurn(transition.id),260);
  };
  const goPreviousPage=()=>turnPage(previousSpreadStart(pageNow,1),'backward');
  const goNextPage=()=>turnPage(nextSpreadStart(pageNow,pages.length,1),'forward');
  const handleReaderKeyDown=event=>{
    if(pageTurnRef.current||sidePanel||isNovelReaderControlTarget(event.target,event.currentTarget)||event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key==='ArrowLeft'&&canPrevPage){event.preventDefault();goPreviousPage()}
    if(event.key==='ArrowRight'&&canNextPage){event.preventDefault();goNextPage()}
  };
  const handlePointerDown=event=>{
    if(event.pointerType==='mouse'||pageTurnRef.current||isNovelReaderControlTarget(event.target,event.currentTarget)){swipeStartRef.current=null;return}
    swipeStartRef.current={x:event.clientX,y:event.clientY,id:event.pointerId};
  };
  const handlePointerUp=event=>{
    const start=swipeStartRef.current;swipeStartRef.current=null;
    if(!start||start.id!==event.pointerId||pageTurnRef.current||window.getSelection?.()?.toString())return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.25)return;
    if(dx<0&&canNextPage)goNextPage();if(dx>0&&canPrevPage)goPreviousPage();
  };
  const writeBookmarks=items=>setBookmarks(saved=>({...saved,[novel.id]:items.map(({chapterNo,blockIndex,createdAt})=>({chapterNo,blockIndex,contentVersion:NOVEL_READING_VERSION,createdAt}))}));
  const removeBookmark=mark=>{writeBookmarks(savedBookmarks.filter(item=>bookmarkKey(item)!==bookmarkKey(mark)));setRemovedBookmark(mark);setBookmarkNotice('書籤已移除，還可以還原。')};
  const toggleBookmark=block=>{
    const mark={chapterNo:chapter.no,blockIndex:block.i,createdAt:Date.now()};
    if(savedKeys.has(bookmarkKey(mark))){removeBookmark(savedBookmarks.find(item=>bookmarkKey(item)===bookmarkKey(mark)));return}
    if(savedBookmarks.length>=BOOKMARK_LIMIT){setBookmarkNotice(`這本書已存滿 ${BOOKMARK_LIMIT} 個書籤，先整理一下再收藏。`);setRemovedBookmark(null);return}
    writeBookmarks([mark,...savedBookmarks]);setRemovedBookmark(null);setBookmarkNotice('這一段，已放進你的書籤。');
  };
  const jumpToBlock=(chapterIndex,blockIndex)=>{
    const blocks=novelBlockPairs(novel.chapters[chapterIndex]?.en,novel.chapters[chapterIndex]?.zh);
    const anchor=Math.max(0,Math.min(Number(blockIndex)||0,blocks.length-1));
    if(chapterIndex!==ci)goChapter(chapterIndex,0,anchor);
    else{stopNovelSpeech();window.clearTimeout(pageTurnTimerRef.current);pageTurnRef.current=null;setPageTurn(null);readingAnchorRef.current=anchor;setPage(findPageForBlock(pages,anchor));setSidePanel(null)}
    setFocusBlock(anchor);
  };
  const openPanel=panel=>setSidePanel(panel);
  const openParagraph=block=>{readingAnchorRef.current=block.i;setSelectedParagraph(block.i);openPanel('paragraph')};
  const paragraph=blockPairs[selectedParagraph];
  const finishAndGo=()=>{completeChapter();if(quizDone){next!=null?goChapter(next):backToList()}};
  const renderBookmarkNotice=()=>bookmarkNotice&&<div className="novel-bookmark-notice" role="status"><span>{bookmarkNotice}</span>{removedBookmark&&<button onClick={()=>{
    if(savedBookmarks.length>=BOOKMARK_LIMIT){setBookmarkNotice('書籤已滿，先移除一個再還原。');return}
    if(!savedKeys.has(bookmarkKey(removedBookmark)))writeBookmarks([removedBookmark,...savedBookmarks]);setRemovedBookmark(null);setBookmarkNotice('書籤已還原。');
  }}>還原書籤</button>}<button aria-label="關閉書籤提示" onClick={()=>{setBookmarkNotice(null);setRemovedBookmark(null)}}>×</button></div>;
  const renderNovelBlock=(block,measuring=false)=>{
    const saved=savedKeys.has(`${chapter.no}:${block.i}`),translated=showZh||peekBlocks[block.i];
    return <section className="novel-paragraph" key={`${measuring?'measure':'read'}-${block.i}`} data-reader-block={measuring?undefined:block.i} data-active={!measuring&&activeBlock===block.i} data-saved={saved} tabIndex={measuring?undefined:-1} aria-label={measuring?undefined:`段落 ${block.i+1}`} ref={element=>{if(measuring){if(element)measureBlockRefs.current[block.i]=element}else if(element)novelBlockRefs.current[block.i]=element}}>
      <p lang="en" data-testid={measuring?undefined:'novel-reader-text'} style={{fontFamily:readerFont,fontSize:readerFontSize,lineHeight:readerLineHeight}}>{block.en}</p>
      {translated&&block.zh&&<div lang="zh-Hant" className="novel-translation" data-testid={measuring?undefined:'novel-reader-translation'} style={{fontSize:Math.max(13,readerFontSize-2),lineHeight:readerLineHeight}}>{block.zh}</div>}
      {!measuring&&<button className="novel-paragraph-more" aria-label={`段落 ${block.i+1} 的閱讀工具`} title="聽這段、看中文或留書籤" onClick={()=>openParagraph(block)}>{saved?'▣':'⋯'}</button>}
    </section>;
  };
  const shownPage=pageTurn?.targetStart??pageNow;
  const shownBlocks=pages[shownPage]||[];
  const footerAction=!canNextPage?(quizDone?(next!=null?'完成・下一章':'完成・回書架'):'故事小測驗'):'下一頁';
  return <div className="novel-reading novel-reader-session" data-tone={readingPrefs?.tone||'paper'} style={{...readerColors,'--reader-translation':tone.translation,'--reader-surround':tone.surround}}>
    <header className="novel-reader-topbar" data-testid="novel-immersive-toolbar">
      <button className="novel-icon-button novel-reader-back" aria-label="返回章節列表" onClick={backToList}>←</button>
      <div className="novel-reader-heading"><span>第 {chapter.no} 章 <i>／ {novel.chapters.length}</i></span><h1 lang="en">{chapter.title}</h1></div>
      <nav className="novel-reader-top-actions" aria-label="閱讀選項"><button className="novel-icon-button" onClick={()=>openPanel('journey')} aria-label="☷ 目錄與書籤"><span aria-hidden="true">☷</span><small>目錄</small></button><button className="novel-icon-button" onClick={()=>openPanel('settings')} aria-label="閱讀偏好"><span aria-hidden="true">Aa</span><small>字體</small></button><button className="novel-icon-button" onClick={()=>openPanel('tools')} aria-label="展開閱讀工具"><span aria-hidden="true">⋯</span><small>工具</small></button></nav>
    </header>
    <div className="novel-reader-overall-progress" aria-hidden="true"><span style={{width:`${chapterPct}%`}}/></div>
    <div className="novel-reader-workspace" data-testid="novel-immersive-shell">
      <div className="novel-reading-companion" aria-hidden="true"><img src={`${novelImageBase}/chapter-${chapter.no}-thumb.jpg`} alt=""/><span>STORY TIME</span><p>{chapter.zhTitle}</p><i>讓想像，陪你翻下一頁。</i></div>
      <div className="novel-reader-paper" data-testid="novel-reader-panel" ref={novelPanelRef} role="region" aria-label="小說閱讀器，可左右滑動或用方向鍵翻頁" tabIndex={0} style={{background:tone.paper}} onKeyDown={handleReaderKeyDown} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={()=>{swipeStartRef.current=null}}>
        <div className="novel-book-spread" ref={novelSpreadRef} data-testid="novel-book-spread" data-book-style="single-page">
          <article className="novel-book-page" data-testid="novel-book-page">
            <div className="novel-page-heading"><span>{chapter.zhTitle}</span><span>{showZh?'英中對照':'英文閱讀'}</span></div>
            <div className="novel-page-content" data-testid="novel-page-content" data-direction={pageTurn?.direction} data-turning={!!pageTurn} onAnimationEnd={event=>pageTurn&&finishPageTurn(pageTurn.id,event)}>
              {shownBlocks.map(block=>renderNovelBlock(block))}
            </div>
            {pageTurn&&<span className="novel-turn-marker" data-testid="novel-page-turn" data-direction={pageTurn.direction} data-transition-id={pageTurn.id} onAnimationEnd={event=>finishPageTurn(pageTurn.id,event)} aria-hidden="true"/>}
          </article>
        </div>
        <div className="novel-measurement-layer" data-testid="novel-measurement-layer" aria-hidden="true">{blockPairs.map(block=>renderNovelBlock(block,true))}</div>
      </div>
      <div className="novel-reading-margin-note" aria-hidden="true"><span>✦</span><p>讀懂一句，<br/>就是一小步。</p></div>
    </div>
    <footer className="novel-reader-footer">
      <div className="novel-reader-position"><span>{isNarrating?(isNarrationPaused?'已暫停':'正在朗讀'):pageNow===0?'點段落旁的 ⋯，聽發音或留書籤':'閱讀位置已保存'}</span><button onClick={()=>openPanel('journey')} aria-label="選擇閱讀頁面">{pageNow+1} <i>/ {pages.length}</i> 頁 <span aria-hidden="true">⌄</span></button></div>
      <div className="novel-reader-pagination" data-testid="novel-page-actions">
        <button className="novel-page-step" onClick={goPreviousPage} disabled={!canPrevPage||!!pageTurn} aria-label="上一頁"><span aria-hidden="true">←</span><small>上一頁</small></button>
        <div className="novel-main-listen">{isNarrating?<div data-testid="novel-playback-controls" role="group" aria-label="小說朗讀控制"><button className="novel-listen-button" aria-label={isNarrationPaused?'繼續小說朗讀':'暫停小說朗讀'} onClick={isNarrationPaused?resumeNovelSpeech:pauseNovelSpeech}>{isNarrationPaused?'▶ 繼續聽':'Ⅱ 暫停朗讀'}</button><button className="novel-icon-button" aria-label="停止小說朗讀" onClick={stopNovelSpeech}>■</button></div>:<button className="novel-listen-button" onClick={showZh?readBilingualPage:readPage} aria-label={showZh?'英中本頁朗讀':'英文本頁朗讀'}><span aria-hidden="true">♫</span> 聽這一頁</button>}</div>
        <button className={`novel-page-step ${!canNextPage?'is-chapter-end':''}`} onClick={()=>canNextPage?goNextPage():quizDone?finishAndGo():openPanel('quiz')} disabled={!!pageTurn} aria-label={footerAction}><small>{footerAction}</small><span aria-hidden="true">→</span></button>
      </div>
      <div className="novel-page-progress" aria-hidden="true"><span style={{width:`${pagePct}%`}}/></div>
    </footer>
    {!sidePanel&&renderBookmarkNotice()}
    {sidePanel&&<div className="novel-drawer-layer"><button className="novel-drawer-backdrop" aria-label="關閉小說工具" tabIndex={-1} onClick={()=>setSidePanel(null)}/>
      <aside className="novel-drawer" ref={toolsPanelRef} role="dialog" aria-modal="true" aria-label={panelTitles[sidePanel]} data-testid="novel-side-panel">
        <header className="novel-drawer-heading"><div><span>第 {chapter.no} 章 · {chapter.zhTitle}</span><h2>{panelTitles[sidePanel]}</h2></div><button className="novel-icon-button" onClick={()=>setSidePanel(null)} aria-label="關閉工具面板">×</button></header>
        <div className="novel-drawer-content">
          {sidePanel==='journey'&&<><label className="novel-page-jump">接著哪一頁讀？<select aria-label="跳到頁面" value={pageNow} disabled={!!pageTurn} onChange={event=>{const target=Number(event.target.value);turnPage(target,target>pageNow?'forward':'backward');setSidePanel(null)}}>{pages.map((_,i)=><option key={i} value={i}>第 {i+1} 頁 / {pages.length}</option>)}</select></label><NovelJourney novel={novel} chapterNo={chapter.no} completed={completed} progress={{...readingProgress[novel.id],blockIndex:resolveReadingBlock(novel.id,readingProgress[novel.id])}} bookmarks={savedBookmarks} onJump={jumpToBlock} onRemove={removeBookmark}/></>}
          {sidePanel==='settings'&&<NovelPreferences prefs={{...readingPrefs,fontSize:readerFontSize,lineHeight:readerLineHeight}} onChange={updateReadingPrefs}/>}
          {sidePanel==='tools'&&<><p className="novel-tool-hint">想聽、想學，或想看看故事裡的風景，都從這裡開始。</p><div className="novel-tool-menu">{[['audio','♫','聽故事','整章朗讀，或從這裡接著聽'],['vocab','Aa','重點單字',`${chapter.vocab.length} 個故事裡的英文單字`],['quiz','✦',`故事小測驗`,`${quizAnswered} / ${quiz.length} 題・找找故事的線索`],['scene','▧','看插圖','把故事裡的風景看清楚']].map(([id,icon,title,description])=><button key={id} onClick={()=>openPanel(id)} aria-label={id==='quiz'?`章節測驗 ${quizAnswered}/${quiz.length}`:title}><span aria-hidden="true">{icon}</span><div><strong>{title}</strong><small>{description}</small></div><b aria-hidden="true">›</b></button>)}</div></>}
          {sidePanel==='audio'&&<><p className="novel-tool-hint">先聽英文，再聽中文，或試著只用英文跟上故事。</p><div className="novel-audio-options"><h3>英中一起聽</h3><button onClick={readBilingualPage} aria-label="英中本頁朗讀">♫ 聽這一頁</button><button onClick={readBilingualFromHere} aria-label="從這裡接著朗讀">從這裡接著聽 →</button><button onClick={readBilingualChapter} aria-label="整章朗讀">從本章開頭聽</button><h3>分開聽</h3><button onClick={readPage}>英文本頁</button><button onClick={readPageZh}>中文本頁</button><button onClick={readChapter}>英文整章</button><button onClick={readChapterZh}>中文整章</button></div><p className="novel-audio-note" role="status" data-testid="novel-audio-status">{playbackStatus}</p></>}
          {sidePanel==='paragraph'&&paragraph&&<><div className="novel-paragraph-preview"><p lang="en">{paragraph.en}</p><p lang="zh-Hant">{paragraph.zh}</p></div><div className="novel-paragraph-actions"><button onClick={()=>speakNovelText(paragraph.en,'en-US',0.78,paragraph.i)} aria-label="朗讀英文">♫ 聽英文</button><button onClick={()=>speakNovelText(paragraph.zh,'zh-TW',1,paragraph.i)} aria-label="朗讀中文（固定真人聲線）">♫ 聽中文</button><button onClick={()=>toggleBookmark(paragraph)} aria-label={`${savedKeys.has(`${chapter.no}:${paragraph.i}`)?'取消收藏':'收藏'}段落 ${paragraph.i+1}`} aria-pressed={savedKeys.has(`${chapter.no}:${paragraph.i}`)}>{savedKeys.has(`${chapter.no}:${paragraph.i}`)?'▣ 已存書籤':'▢ 留下書籤'}</button>{!showZh&&<button aria-label={`${peekBlocks[paragraph.i]?'收起':'看看'}段落 ${paragraph.i+1} 的中文`} onClick={()=>{readingAnchorRef.current=paragraph.i;setPeekBlocks(current=>({...current,[paragraph.i]:!current[paragraph.i]}));setSidePanel(null)}}>{peekBlocks[paragraph.i]?'收起書頁上的中文':'在書頁顯示這段中文'}</button>}</div></>}
          {sidePanel==='vocab'&&<><p className="novel-tool-hint">點一個單字，聽聽它怎麼念，再回到故事裡找找看。</p><div className="novel-vocabulary">{chapter.vocab.map(word=><button key={word} onClick={()=>speakNovelVocab(word)} aria-pressed={activeVocab===word}><span lang="en">{word}</span><span aria-hidden="true">♫</span></button>)}</div></>}
          {sidePanel==='scene'&&<><div className="novel-scene"><NovelIllustration fill chapter={chapter.no} imageBase={novelImageBase} title={novel.title}/></div><p className="novel-tool-hint">{chapter.zhTitle} · 你在這張圖裡發現了什麼？</p></>}
          {sidePanel==='quiz'&&<><p className="novel-tool-hint">不用急，可以回到故事找線索，選錯了也能再試一次。</p><div className="novel-quiz">{quiz.map((question,qi)=><section key={question.q}><span>故事線索 {qi+1}</span><h3 lang="en">{question.q}</h3>{showZh&&<p>{question.zh}</p>}<div>{question.o.map((option,oi)=><button key={option} onClick={()=>chooseQuiz(qi,oi)} data-answer={quizState[qi]!=null?(oi===question.a?'correct':quizState[qi]===oi?'wrong':undefined):undefined} aria-pressed={quizState[qi]===oi}>{option}</button>)}</div>{quizState[qi]!=null&&<p className="novel-quiz-feedback" role="status">{quizState[qi]===question.a?'答對了！你找到故事的線索了。':'再看看故事，綠色選項是正確答案。可以再選一次。'}</p>}</section>)}</div><button className="novel-primary-button novel-quiz-finish" onClick={finishAndGo} disabled={!quizDone}>{quizDone?(next!=null?'完成・下一章':'完成・回書架'):'答完問題，就能完成這一章'}</button>{isDone&&<p className="novel-tool-hint">這一章已完成，重讀不會重複領取獎勵。</p>}</>}
          {renderBookmarkNotice()}
        </div>
      </aside>
    </div>}
  </div>;
}
