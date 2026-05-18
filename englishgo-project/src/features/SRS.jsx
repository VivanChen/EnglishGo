import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const _gifCache = new Map();
const _kidDictCache = new Map();

async function fetchGif(word,apiKey){
  const key=String(apiKey||"").trim();
  const k=String(word||"").trim().toLowerCase();
  if(!key||!k)return null;
  const cacheKey=`${key}:${k}`;
  if(_gifCache.has(cacheKey))return _gifCache.get(cacheKey);
  try{
    const res=await fetch(`https://api.giphy.com/v1/gifs/translate?api_key=${encodeURIComponent(key)}&s=${encodeURIComponent(k)}&rating=g&lang=en`);
    if(!res.ok)return null;
    const data=await res.json();
    const url=data?.data?.images?.fixed_height_small?.url||data?.data?.images?.fixed_height?.url||null;
    _gifCache.set(cacheKey,url);
    return url;
  }catch{return null}
}

function yahooDictionaryUrl(word){
  return `https://tw.dictionary.search.yahoo.com/search?p=${encodeURIComponent(String(word||"").trim())}`;
}

function extractJson(text){
  let s=String(text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"");
  const a=s.indexOf("{");const b=s.lastIndexOf("}");
  if(a>=0&&b>a)s=s.slice(a,b+1);
  return JSON.parse(s);
}

function normalizeKidDictionary(raw,word,meaning,pos){
  const pickArr=v=>Array.isArray(v)?v.filter(Boolean).slice(0,6):[];
  return {
    word:raw.word||word,
    headlineZh:raw.headlineZh||meaning,
    shortMeaning:raw.shortMeaning||meaning,
    kidExplanation:raw.kidExplanation||`${word} 的意思是「${meaning}」。`,
    partOfSpeechZh:raw.partOfSpeechZh||pos||"",
    forms:pickArr(raw.forms).map(x=>({word:x.word||"",note:x.note||x.zh||""})).filter(x=>x.word||x.note),
    collocations:pickArr(raw.collocations).map(x=>({phrase:x.phrase||"",zh:x.zh||x.note||""})).filter(x=>x.phrase||x.zh),
    examples:pickArr(raw.examples).map(x=>({en:x.en||"",zh:x.zh||""})).filter(x=>x.en||x.zh).slice(0,3),
    synonyms:pickArr(raw.synonyms).map(x=>({word:x.word||"",zh:x.zh||""})).filter(x=>x.word||x.zh).slice(0,5),
    tips:pickArr(raw.tips).map(String).slice(0,3),
  };
}

async function generateKidDictionary(word,meaning,pos,level,apiKey){
  const cleanKey=String(word||"").trim().toLowerCase();
  const key=`${level}:${cleanKey}`;
  if(!cleanKey||!apiKey)return null;
  if(_kidDictCache.has(key))return _kidDictCache.get(key);
  try{
    const cached=localStorage.getItem(`kid_dict_${encodeURIComponent(key)}`);
    if(cached){
      const obj=JSON.parse(cached);
      _kidDictCache.set(key,obj);
      return obj;
    }
  }catch{}
  const levelName=level==="elementary"?"國小":level==="junior"?"國中":"高中";
  const prompt=`你是台灣英文老師。請為 ${levelName} 學生製作小朋友友善的英漢字典卡。

單字: ${word}
目前中文釋義: ${meaning}
詞性: ${pos}

要求:
- 使用繁體中文，語氣簡單清楚，適合學生自學。
- 不要給太艱深、宗教、成人或太抽象的解釋。
- 英文例句要短、自然、生活化。
- 常見搭配要像 Yahoo 字典一樣實用。
- 只回傳 JSON，不要 markdown。

JSON 格式:
{
  "word": "${word}",
  "headlineZh": "最常用中文意思",
  "shortMeaning": "一句話中文意思",
  "kidExplanation": "用小朋友懂的方式解釋",
  "partOfSpeechZh": "名詞/動詞/形容詞...",
  "forms": [{"word":"變化形","note":"中文說明"}],
  "collocations": [{"phrase":"英文搭配","zh":"中文意思"}],
  "examples": [{"en":"English sentence.","zh":"中文翻譯"}],
  "synonyms": [{"word":"similar word","zh":"中文意思"}],
  "tips": ["學習提醒"]
}`;
  const models=["gemini-2.5-flash-lite","gemini-2.5-flash","gemini-2.0-flash"];
  for(const model of models){
    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:900,temperature:0.45,responseMimeType:"application/json"}}),
      });
      const data=await res.json();
      if(data?.error)continue;
      const text=data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if(!text)continue;
      const parsed=normalizeKidDictionary(extractJson(text),word,meaning,pos);
      _kidDictCache.set(key,parsed);
      try{localStorage.setItem(`kid_dict_${encodeURIComponent(key)}`,JSON.stringify(parsed))}catch{}
      return parsed;
    }catch{}
  }
  throw new Error("Gemini dictionary generation failed");
}

// ═══ ANIMATED EMOJI FOR CARDS ══════════════════════════════════════
const ANIM_MAP={
  // POS-based fallback emojis with animation types
  "n.":["🏠","🎁","📦","🌍","💎","🎨","🧸","🪐","🌈","🎪"],
  "v.":["🏃","✨","🚀","⚡","🎯","🔥","💫","🌊","🎮","🦋"],
  "adj.":["🌟","🎭","🌺","🦄","🌙","❄️","🍀","💜","🌸","🎀"],
  "adv.":["💨","⏱","🎵","🔔","🌀","⭐","🎶","✈️","🌠","🎯"],
  "prep.":["📍","🔗","➡️","🔄","↔️","📌","🧭","🗺️","🎯","📐"],
  "conj.":["🔗","🤝","🔀","🔃","🧩","🔧","⚙️","🎯","🔌","📎"],
};
const ANIM_STYLES=["emojiBounce","emojiFloat","emojiSpin","emojiWiggle","emojiPulse","emojiSwing"];

function getWordEmoji(word){
  if(word.img)return{emoji:word.img,anim:ANIM_STYLES[word.w.length%ANIM_STYLES.length]};
  // Hash word to pick consistent emoji
  const h=word.w.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  const pos=word.p||"n.";
  const pool=ANIM_MAP[pos]||ANIM_MAP["n."];
  return{emoji:pool[h%pool.length],anim:ANIM_STYLES[h%ANIM_STYLES.length]};
}

// Floating sparkles on card background
function CardSparkles({color}){
  const ps=useMemo(()=>Array.from({length:6},(_,i)=>({
    id:i,x:15+Math.random()*70,y:10+Math.random()*80,
    s:Math.random()*8+4,d:Math.random()*3+2,
    dl:Math.random()*2,
    em:["✨","⭐","🌟","💫","🌸","🦋"][i%6]
  })),[]);
  return(<div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",borderRadius:16}}>
    {ps.map(p=><div key={p.id} style={{position:"absolute",left:`${p.x}%`,top:`${p.y}%`,fontSize:p.s,animation:`sparkleFloat ${p.d}s ${p.dl}s ease-in-out infinite`,opacity:.3}}>{p.em}</div>)}
  </div>);
}

// Mascot reaction
function Mascot({mood}){
  const faces={idle:"🐝",happy:"🐝✨",great:"🐝🎉",sad:"🐝💧",think:"🐝🤔"};
  return(<div style={{position:"absolute",top:8,right:12,fontSize:22,animation:mood==="happy"||mood==="great"?"mascotJump .5s ease-out":"mascotIdle 2s ease-in-out infinite",zIndex:1}}>{faces[mood]||faces.idle}</div>);
}

// ═══ SRS FLASHCARD (Gamified) ═══════════════════════════════════

export default function SRS({lv,onBack,onXp,onDone,trackWeak,gifKey,sharedWord,apiKey,weakWords=[],onOpenSettings,deps}){
  const {V,LV,S,fetchCloudVocab,fetchCloudWord,findAnyWord,sortCardsForStudy,createDeck,rateDeck,getWordImg,preloadImgs,isPlaceholderExample,exampleCache:_exampleCache,generateExample,preloadTts,speak,speechTimer,playSound,triggerRewardBurst,parseCSV,Hdr,Confetti}=deps;
  const built=V[lv];const[cards,setCards]=useState(built);const[deck,setDeck]=useState(()=>createDeck(built));const[flip,setFlip]=useState(false);const[info,setInfo]=useState(false);const[loading,setLoading]=useState(true);const[src,setSrc]=useState("built-in");const c=LV[lv];const fr=useRef();const completedRef=useRef(false);
  const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);const[comboAnim,setComboAnim]=useState(false);const[showConfetti,setShowConfetti]=useState(false);const[flipAnim,setFlipAnim]=useState(false);const[mascotMood,setMascotMood]=useState("idle");
  const[gifUrl,setGifUrl]=useState(null);const[gifLoading,setGifLoading]=useState(false);
  const[imgUrl,setImgUrl]=useState(null);
  const[dictOpen,setDictOpen]=useState(false);
  const[dictData,setDictData]=useState(null);const[dictLoading,setDictLoading]=useState(false);const[dictError,setDictError]=useState("");
  const[aiExample,setAiExample]=useState(null);// AI-generated example {en, zh}
  const[exampleLoading,setExampleLoading]=useState(false);
  useEffect(()=>{let active=true;(async()=>{setLoading(true);completedRef.current=false;setFlip(false);setFlipAnim(false);setCombo(0);setMaxCombo(0);const cloud=await fetchCloudVocab(lv,20);if(!active)return;if(cloud&&cloud.length>0){
    // If sharedWord, put it first in the deck
    let ordered=cloud;
    if(sharedWord){const si=cloud.findIndex(w=>w.w.toLowerCase()===sharedWord.toLowerCase());if(si>0){ordered=[cloud[si],...cloud.slice(0,si),...cloud.slice(si+1)]}else if(si<0){
      // Word not in cloud batch, try to fetch it specifically
      const w=await fetchCloudWord(lv,sharedWord);
      if(!active)return;
      if(w)ordered=[w,...cloud.slice(0,19)];
      else{const local=await findAnyWord(lv,sharedWord);if(!active)return;if(local)ordered=[local,...cloud.slice(0,19)]}
    }}
    ordered=sortCardsForStudy(ordered,weakWords,sharedWord);
    setCards(ordered);setDeck(createDeck(ordered));setSrc(`cloud (${ordered.length}字)`);
  }else{let base=built;if(sharedWord){const target=await findAnyWord(lv,sharedWord);if(!active)return;if(target){const key=String(target.w).toLowerCase();base=[target,...built.filter(w=>String(w.w).toLowerCase()!==key)]}}const ordered=sortCardsForStudy(base,weakWords,sharedWord);setCards(ordered);setDeck(createDeck(ordered));setSrc("built-in ("+ordered.length+"字)")}setLoading(false)})();return()=>{active=false}},[lv,sharedWord]);
  const cur=deck.queue[0]!==undefined?cards[deck.queue[0]]:null;const left=deck.queue.length;const done=left===0;const spokenExample=cur?(aiExample?.en||(!isPlaceholderExample(cur.ex,cur.w)?cur.ex:"")):"";
  useEffect(()=>{setDictOpen(false);setDictData(null);setDictError("")},[cur?.w]);
  useEffect(()=>{let active=true;if(!dictOpen||!cur){setDictLoading(false);return()=>{active=false}}if(!apiKey?.trim()){setDictLoading(false);setDictData(null);setDictError("");return()=>{active=false}}setDictLoading(true);setDictError("");generateKidDictionary(cur.w,cur.m,cur.p,lv,apiKey).then(data=>{if(!active)return;setDictData(data);setDictLoading(false)}).catch(()=>{if(!active)return;setDictData(null);setDictError("AI 字典目前產生失敗，請稍後再試，或使用 Yahoo 查詢。");setDictLoading(false)});return()=>{active=false}},[dictOpen,cur?.w,apiKey,lv]);
  // Fetch GIF for current word
  useEffect(()=>{let active=true;setGifUrl(null);if(!cur||!gifKey){setGifLoading(false);return()=>{active=false}}setGifLoading(true);fetchGif(cur.w,gifKey).then(url=>{if(!active)return;setGifUrl(url);setGifLoading(false)}).catch(()=>{if(active)setGifLoading(false)});return()=>{active=false}},[cur?.w,gifKey]);
  // Static image — always available regardless of Giphy key
  useEffect(()=>{if(cur){setImgUrl(getWordImg(cur.w));const upcoming=deck.queue.slice(0,4).map(i=>cards[i]).filter(Boolean);preloadImgs(upcoming,0,upcoming.length)}else setImgUrl(null)},[cur?.w,left,cards]);
  // Auto-detect bad examples and replace with AI-generated ones (when API key set)
  useEffect(()=>{
    let active=true;
    if(!cur){setAiExample(null);setExampleLoading(false);return()=>{active=false}};
    setAiExample(null);
    setExampleLoading(false);
    if(!isPlaceholderExample(cur.ex,cur.w)){return}// Original example is good, use it
    // Check if we have a cached AI example
    const k=cur.w.toLowerCase();
    if(_exampleCache[k]){setAiExample(_exampleCache[k]);return}
    try{const cached=localStorage.getItem(`ex_${k}`);if(cached){const obj=JSON.parse(cached);_exampleCache[k]=obj;setAiExample(obj);return}}catch{}
    // No cache - if API key available, generate
    if(apiKey){
      setExampleLoading(true);
      generateExample(cur.w,cur.m,cur.p,apiKey).then(ex=>{
        if(active&&ex)setAiExample(ex);
      }).finally(()=>{if(active)setExampleLoading(false)});
    }
    return()=>{active=false};
  },[cur?.w,apiKey]);
  useEffect(()=>{
    if(!cur||loading)return;
    const upcoming=deck.queue.slice(0,5).map(i=>cards[i]?.w).filter(Boolean);
    preloadTts([cur.w,...upcoming],{limit:5,concurrency:2});
    if(!spokenExample)return;
    const timer=window.setTimeout(()=>preloadTts(spokenExample,{limit:1,concurrency:1}),300);
    return()=>window.clearTimeout(timer);
  },[cur?.w,spokenExample,deck.queue,loading,cards]);
  useEffect(()=>{if(cur&&!flip&&!loading)speak(cur.w)},[cur?.w,flip,loading]);
  const rate=useCallback(a=>{if((a==="again"||a==="hard")&&cur)trackWeak(cur.w);if(a==="easy"||a==="good"){onXp();setMascotMood(a==="easy"?"great":"happy");setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));if(nc>=3){playSound("combo");setComboAnim(true);setTimeout(()=>setComboAnim(false),600);if(typeof triggerRewardBurst==="function"){triggerRewardBurst({text:`COMBO ×${nc}！`,fromX:window.innerWidth/2,fromY:"35%",textColor:nc>=10?"#FF1493":nc>=5?"#FFD700":"#FFA500",textSize:nc>=10?42:nc>=5?38:32,duration:1300});if(nc%5===0){triggerRewardBurst({emoji:"⭐",count:6,fromX:window.innerWidth/2,fromY:window.innerHeight*0.4,size:24,duration:1200})}}}else playSound("good");return nc})}else if(a==="again"){setCombo(0);setMascotMood("sad");playSound("bad")}else{setMascotMood("think");playSound("flip")}setTimeout(()=>setMascotMood("idle"),1500);setDeck(d=>rateDeck(d,a));setFlip(false);setFlipAnim(false)},[onXp,cur,trackWeak]);
  useEffect(()=>{const h=e=>{if(done)return;if(e.code==="Space"){e.preventDefault();if(!flip){setFlip(true);setFlipAnim(true);playSound("flip");if(spokenExample)speechTimer(()=>speak(spokenExample),350)}else{setFlip(false);setFlipAnim(false)}}if(flip){if(e.key==="1")rate("again");if(e.key==="2")rate("hard");if(e.key==="3")rate("good");if(e.key==="4")rate("easy")}if(e.key==="Enter"){e.preventDefault();if(cur)speak(flip?(spokenExample||cur.w):cur.w)}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[flip,done,cur,rate,spokenExample]);
  const handleCardTap=()=>{if(!flip){setFlip(true);setFlipAnim(true);playSound("flip");if(spokenExample)speechTimer(()=>speak(spokenExample),350)}};
  const handleCSV=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const p=parseCSV(ev.target.result);if(p.length){setCards(p);setDeck(createDeck(p));setFlip(false)}};r.readAsText(f,"utf-8")};
  useEffect(()=>{if(done&&!loading&&!completedRef.current){completedRef.current=true;onDone();playSound("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500)}},[done,loading]);
  if(loading)return(<div><Hdr t="🃏 SRS 單字卡" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px 16px",color:S.t3,fontSize:14}}><div style={{fontSize:40,animation:"emojiBounce 1s infinite"}}>📚</div><div style={{marginTop:8}}>從雲端載入單字庫...</div><div style={{width:120,height:4,background:S.bg2,borderRadius:2,margin:"12px auto",overflow:"hidden"}}><div style={{width:"60%",height:"100%",background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:2,animation:"pulse 1s infinite"}}/></div></div></div>);
  if(done){const{stats,total}=deck;const attempts=stats.again+stats.hard+stats.good+stats.easy;const goodPct=Math.round(((stats.good+stats.easy)/total)*100);return(<div>{showConfetti&&<Confetti/>}<Hdr t="🃏 SRS 單字卡" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{goodPct>=80?"🏆":goodPct>=60?"🎉":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>練習完成！共 {total} 張</h2>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,maxWidth:400,margin:"16px auto"}}>{[["😅 Again",stats.again,"#E24B4A"],["🤔 Hard",stats.hard,"#EF9F27"],["😊 Good",stats.good,"#1D9E75"],["🤩 Easy",stats.easy,"#185FA5"]].map(([l,v,cl])=>(<div key={l} style={{...S.card,padding:"12px 6px",textAlign:"center",borderTop:`3px solid ${cl}`}}><div style={{fontSize:26,fontWeight:700,color:cl}}>{v}</div><div style={{fontSize:11,color:S.t3,marginTop:2}}>{l}</div></div>))}</div><div style={{textAlign:"center",fontSize:13,color:S.t2,margin:"8px 0"}}>掌握率 {goodPct}% · 答題 {attempts} 次</div><div style={{fontSize:14,color:S.t2,marginBottom:14}}>{goodPct>=80?"太厲害了！🌟":goodPct>=60?"表現不錯！繼續加油 💪":"多練習幾次會更好！📖"}</div><button onClick={async()=>{setLoading(true);completedRef.current=false;setShowConfetti(false);setCombo(0);setMaxCombo(0);const cloud=await fetchCloudVocab(lv,20);const next=sortCardsForStudy(cloud?.length?cloud:cards,weakWords,sharedWord);setCards(next);setDeck(createDeck(next));setFlip(false);setLoading(false)}} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 新一輪</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}
  const pct=Math.round(((deck.total-left)/deck.total)*100);
  const rateTooltip=deck.total-left===0?"第一張卡片！加油 💪":"";const comboLabel=combo>=10?"🔥🔥🔥 UNSTOPPABLE!":combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";
  return(<div><Hdr t="🃏 SRS 單字卡" onBack={onBack} cl={c.cl} extra={<div style={{display:"flex",gap:4}}><button onClick={()=>setInfo(!info)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"2px 6px",fontSize:12,cursor:"pointer",color:S.t2}}>ⓘ</button><label style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"2px 6px",fontSize:12,cursor:"pointer",color:S.t2}}>📥<input ref={fr} type="file" accept=".csv" onChange={handleCSV} style={{display:"none"}}/></label></div>}/>
    {info&&<div style={{...S.card,padding:"12px 16px",marginBottom:10,fontSize:13,color:S.t2,lineHeight:1.7}}>💻 <b>Space</b> 翻牌/翻回 · <b>Enter</b> 朗讀 · <b>1</b>Again <b>2</b>Hard <b>3</b>Good <b>4</b>Easy<br/>📱 <b>點擊</b>翻牌 · 點 <b>🔙翻回</b> · <b>按鈕</b>評分<br/>🔎 <b>查字典</b>：翻到背面後點 <b>查字典</b>，可在右側查看小朋友版解釋、例句與常見搭配<div style={{marginTop:4,fontSize:11,color:S.t3}}>來源：{src} {gifKey?"· 🖼️ GIF 已啟用":""}</div>
      <div style={{borderTop:`1px solid ${S.bd}`,marginTop:8,paddingTop:8}}>
        <div style={{fontWeight:700,fontSize:12,color:S.t1,marginBottom:4}}>🖼️ 單字動圖 (Giphy，可選)</div>
        <div style={{fontSize:11,color:S.t3,marginBottom:6,lineHeight:1.7}}>未設定也能使用內建圖片與表情符號；貼上 Giphy API Key 後，單字卡會依目前單字自動顯示相關 GIF。<a href="/learn/gif-guide.html" target="_blank" rel="noreferrer" style={{color:c.cl,fontWeight:700}}>看效果與申請教學</a></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:6,marginBottom:7}}>
          <div style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:8,padding:"7px 8px",fontSize:11,color:S.t2}}><b style={{color:S.t1}}>未啟用</b><br/>顯示內建圖片 / emoji</div>
          <div style={{background:c.bg,border:`1px solid ${c.cl}33`,borderRadius:8,padding:"7px 8px",fontSize:11,color:S.t2}}><b style={{color:c.cl}}>啟用後</b><br/>依單字搜尋 GIF 動圖</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={()=>onOpenSettings?.()} style={{...S.btn,background:c.cl,color:"#fff",padding:"7px 12px",fontSize:12}}>前往 Key 設定</button>
          <a href="/learn/gif-guide.html" target="_blank" rel="noreferrer" style={{...S.btn,background:S.bg2,color:c.cl,padding:"7px 12px",fontSize:12,textDecoration:"none"}}>申請教學</a>
        </div>
      </div>
    </div>}
    {!(gifKey||"").trim()&&<div style={{...S.card,padding:"10px 12px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",fontSize:12,lineHeight:1.5}}>
      <div style={{color:S.t2,flex:"1 1 220px"}}><b style={{color:S.t1}}>🖼️ 單字動圖尚未啟用</b><br/>目前使用內建圖片；申請 Giphy Key 後可自動顯示單字相關 GIF。</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><a href="/learn/gif-guide.html" target="_blank" rel="noreferrer" style={{...S.btn,background:S.bg2,color:c.cl,padding:"8px 12px",fontSize:12,textDecoration:"none"}}>看效果</a><button onClick={()=>onOpenSettings?.()} style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 12px",fontSize:12}}>設定 Key</button></div>
    </div>}
    {comboLabel&&<div style={{textAlign:"center",fontSize:combo>=7?16:13,fontWeight:700,color:"#EF9F27",marginBottom:4,animation:comboAnim?"comboFlash .5s ease-out":"none"}}>{comboLabel}</div>}
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8,fontSize:12}}><div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3,transition:"width .3s"}}/></div><span style={{color:S.t3}}>{left}/{deck.total}</span>{[["#E24B4A",deck.stats.again],["#EF9F27",deck.stats.hard],["#1D9E75",deck.stats.good],["#185FA5",deck.stats.easy]].map(([cl,v],i)=><span key={i} style={{color:cl,fontWeight:600}}>{v}</span>)}</div>
    <style>{`@media (max-width: 900px){.srs-study-grid{grid-template-columns:1fr!important}.srs-dict-panel{max-height:none!important}}`}</style>
    <div className="srs-study-grid" style={{display:"grid",gridTemplateColumns:dictOpen&&flip?"minmax(0,1fr) minmax(300px,420px)":"1fr",gap:14,alignItems:"stretch"}}>
    <div data-testid="srs-card" onClick={handleCardTap} style={{cursor:!flip?"pointer":"default",borderRadius:16,padding:flip?(dictOpen?"16px 16px 18px":"18px 20px 22px"):"48px 20px",textAlign:"center",minHeight:flip?(dictOpen?420:280):220,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:flip?"flex-start":"center",background:flip?`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`:S.bg1,border:`2px solid ${flip?c.ac:S.bd}`,transition:"all .3s",userSelect:"none",WebkitUserSelect:"none",animation:flipAnim?"cardFlip .35s ease-out":"none",position:"relative",overflow:"hidden"}}>
      {/* Sparkles background */}
      {!flip&&<CardSparkles color={c.cl}/>}
      {/* Mascot */}
      <Mascot mood={mascotMood}/>
      {!flip?(<>
        {/* Front face: show GIF if available, else static image */}
        {gifUrl?<img src={gifUrl} alt={cur.w} style={{width:"90%",maxWidth:280,height:200,objectFit:"cover",borderRadius:18,marginBottom:10,position:"relative",zIndex:1,boxShadow:"0 6px 20px rgba(0,0,0,.15)"}} onError={e=>e.target.style.display="none"}/>
        :imgUrl?(imgUrl.type==="emoji"?<div style={{fontSize:120,marginBottom:10,position:"relative",zIndex:1,lineHeight:1,filter:"drop-shadow(0 4px 12px rgba(0,0,0,.15))"}}>{imgUrl.value}</div>
        :<img src={imgUrl.value} alt={cur.w} style={{width:"90%",maxWidth:280,height:200,objectFit:"cover",borderRadius:18,marginBottom:10,position:"relative",zIndex:1,boxShadow:"0 4px 16px rgba(0,0,0,.1)"}} onError={e=>e.target.style.display="none"}/>)
        :gifLoading&&gifKey?<div style={{fontSize:13,color:S.t3,marginBottom:6,position:"relative",zIndex:1,animation:"pulse 1s infinite"}}>載入圖片中...</div>:null}
        <div style={{fontSize:38,fontWeight:700,color:S.t1,letterSpacing:1,position:"relative",zIndex:1}}>{cur.w}<button onClick={e=>{e.stopPropagation();speak(cur.w)}} style={{background:"none",border:"none",fontSize:28,cursor:"pointer",marginLeft:6,verticalAlign:"middle",padding:"4px",minWidth:40,minHeight:40}}>🔊</button></div>
        {cur.ph&&<div style={{fontSize:14,color:S.t3,marginTop:3,position:"relative",zIndex:1}}>{cur.ph}</div>}
        <div style={{fontSize:14,color:"#fff",marginTop:16,padding:"10px 24px",background:`linear-gradient(135deg,${c.cl},${c.ac})`,borderRadius:24,fontWeight:600,boxShadow:`0 2px 8px ${c.cl}40`,position:"relative",zIndex:1}}>👆 點擊翻牌</div>
        <div style={{fontSize:11,color:S.t3,marginTop:5,position:"relative",zIndex:1}}>電腦可按 Space</div>
      </>):(<>
        {/* Back face images — GIF + static image */}
        {gifUrl&&<img src={gifUrl} alt={cur.w} style={{width:"80%",maxWidth:240,height:150,objectFit:"cover",borderRadius:14,marginBottom:6,boxShadow:"0 4px 12px rgba(0,0,0,.1)",border:`2px solid ${c.bg}`}} onError={e=>e.target.style.display="none"}/>}
        {imgUrl&&(imgUrl.type==="emoji"?<div style={{fontSize:80,marginBottom:6,lineHeight:1}}>{imgUrl.value}</div>:<img src={imgUrl.value} alt={cur.w} style={{width:"85%",maxWidth:260,height:140,objectFit:"cover",borderRadius:14,marginBottom:8,boxShadow:"0 3px 10px rgba(0,0,0,.08)"}} onError={e=>e.target.style.display="none"}/>)}
        <div style={{fontSize:28,fontWeight:700,color:c.cl,letterSpacing:.5}}>{cur.w} <span style={{fontSize:13,fontWeight:400,color:S.t3}}>({cur.p})</span> <button onClick={e=>{e.stopPropagation();speak(cur.w)}} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",verticalAlign:"middle",padding:"4px",minWidth:36,minHeight:36}}>🔊</button></div>
        <div style={{fontSize:22,fontWeight:600,color:S.t1,margin:"4px 0 8px"}}>{cur.m} <button onClick={e=>{e.stopPropagation();speak(cur.m,"zh-TW",0.9)}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",verticalAlign:"middle",padding:"4px",minWidth:36,minHeight:36}}>🔈</button></div>
        <button onClick={e=>{e.stopPropagation();setDictOpen(true)}} style={{background:S.bg2,border:`1px solid ${c.cl}66`,borderRadius:999,padding:"8px 14px",fontSize:13,cursor:"pointer",color:c.cl,fontFamily:"inherit",fontWeight:800,marginBottom:8}}>🔎 查字典</button>
        {cur.f?.length>0&&<div style={{fontSize:13,color:S.t2,marginBottom:6,width:"100%",padding:"8px 12px",background:`${c.ac}0a`,borderRadius:10,textAlign:"left"}}><b style={{color:c.cl,fontSize:12}}>📝 詞性變化</b><div style={{marginTop:3,display:"flex",flexWrap:"wrap",gap:4}}>{cur.f.map((f,i)=><span key={i} style={{background:S.bg2,padding:"2px 8px",borderRadius:6,fontSize:12}}>{f.w} <span style={{color:S.t3}}>({f.p}) {f.n}</span></span>)}</div></div>}
        {cur.c?.length>0&&<div style={{fontSize:13,color:S.t2,marginBottom:6,width:"100%",padding:"8px 12px",background:`${c.ac}08`,borderRadius:10,textAlign:"left"}}><b style={{color:c.cl,fontSize:12}}>🔗 常見搭配</b><div style={{marginTop:3}}>{cur.c.map((x,i)=><div key={i} style={{fontSize:13,padding:"2px 0",borderBottom:i<cur.c.length-1?`1px solid ${S.bd}`:"none"}}>· {x}</div>)}</div></div>}
        {(()=>{
          // Decide which example to show
          const useAi=aiExample&&isPlaceholderExample(cur.ex,cur.w);
          const exEn=useAi?aiExample.en:cur.ex;
          const exZh=useAi?aiExample.zh:cur.ez;
          const isPlaceholder=isPlaceholderExample(cur.ex,cur.w);

          // Show AI-generated example
          if(useAi){
            return(<div style={{fontSize:14,color:S.t1,width:"100%",padding:"10px 14px",background:`linear-gradient(135deg,${S.bg2},${c.bg}22)`,borderRadius:12,textAlign:"left",borderLeft:`3px solid ${c.cl}`}}>
              <div style={{fontSize:10,color:c.cl,fontWeight:600,marginBottom:4}}>✨ AI 生成例句</div>
              📖 <i>"{exEn}"</i>
              <button onClick={e=>{e.stopPropagation();speak(exEn)}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",marginLeft:4,verticalAlign:"middle",padding:"2px"}}>🔊</button>
              {exZh&&<div style={{fontSize:13,color:S.t3,fontStyle:"normal",marginTop:2}}>{exZh} <button onClick={e=>{e.stopPropagation();speak(exZh,"zh-TW",0.9)}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",verticalAlign:"middle",padding:"2px"}}>🔈</button></div>}
            </div>);
          }
          // Loading state
          if(isPlaceholder&&exampleLoading){
            return(<div style={{fontSize:13,color:S.t3,padding:"10px 14px",background:S.bg2,borderRadius:12,textAlign:"center",animation:"pulse 1s infinite"}}>
              ✨ AI 正在生成例句...
            </div>);
          }
          // Placeholder detected but no API key - show prompt
          if(isPlaceholder&&!apiKey){
            return(<div style={{fontSize:12,color:S.t3,padding:"10px 14px",background:S.bg2,borderRadius:12,textAlign:"center",lineHeight:1.6}}>
              💡 此單字的例句不太完整<br/>
              <button onClick={(e)=>{e.stopPropagation();onOpenSettings?.()}} style={{background:"none",border:`1px solid ${c.cl}`,color:c.cl,padding:"4px 12px",fontSize:11,borderRadius:8,marginTop:6,cursor:"pointer",fontFamily:"inherit"}}>🔑 前往 Key 設定</button>
            </div>);
          }
          // Original example is good, show it
          if(cur.ex&&!isPlaceholder){
            return(<div style={{fontSize:14,color:S.t1,width:"100%",padding:"10px 14px",background:`linear-gradient(135deg,${S.bg2},${c.bg}22)`,borderRadius:12,textAlign:"left",borderLeft:`3px solid ${c.cl}`}}>
              📖 <i>"{cur.ex}"</i>
              <button onClick={e=>{e.stopPropagation();speak(cur.ex)}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",marginLeft:4,verticalAlign:"middle",padding:"2px"}}>🔊</button>
              {cur.ez&&<div style={{fontSize:13,color:S.t3,fontStyle:"normal",marginTop:2}}>{cur.ez} <button onClick={e=>{e.stopPropagation();speak(cur.ez,"zh-TW",0.9)}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",verticalAlign:"middle",padding:"2px"}}>🔈</button></div>}
            </div>);
          }
          return null;
        })()}
      </>)}
    </div>
    {dictOpen&&flip&&cur&&<aside className="srs-dict-panel" role="complementary" aria-label="Dictionary results" style={{...S.card,padding:0,overflow:"hidden",maxHeight:560,display:"flex",flexDirection:"column",border:`1px solid ${c.cl}55`,boxShadow:"0 18px 48px rgba(20,66,52,.12)"}}>
      <div style={{padding:"12px 14px",borderBottom:`1px solid ${S.bd}`,background:`linear-gradient(135deg,${S.bg1},${c.bg})`,display:"flex",alignItems:"center",gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,color:c.cl,fontWeight:800}}>外部字典查詢</div>
          <div style={{fontSize:20,color:S.t1,fontWeight:900,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cur.w}</div>
          <div style={{fontSize:11,color:S.t3,marginTop:3,lineHeight:1.45}}>點右側 Yahoo 會開新分頁到 Yahoo 字典，可看更多外部釋義與例句。</div>
        </div>
        <a href={yahooDictionaryUrl(cur.w)} target="_blank" rel="noreferrer" title="開新分頁到 Yahoo 字典查詢" aria-label={`開新分頁到 Yahoo 字典查詢 ${cur.w}`} style={{...S.btn,background:c.cl,color:"#fff",padding:"7px 10px",fontSize:12,textDecoration:"none",minHeight:34,display:"inline-flex",alignItems:"center",gap:4,boxShadow:`0 8px 18px ${c.cl}22`,whiteSpace:"nowrap"}}>Yahoo 外站 ↗</a>
        <button onClick={()=>setDictOpen(false)} aria-label="Close dictionary" style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:10,width:34,height:34,cursor:"pointer",color:S.t2,fontSize:16}}>×</button>
      </div>
      <div style={{padding:14,overflow:"auto",fontSize:13,lineHeight:1.55,color:S.t2}}>
        {!apiKey?.trim()&&<div style={{padding:12,background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:12,color:S.t2,lineHeight:1.7}}>
          <div style={{fontWeight:900,color:S.t1,marginBottom:4}}>需要 Gemini API Key</div>
          <div>AI 字典會產生適合學生閱讀的中文解釋、例句、搭配詞與學習提醒，並快取在本機。</div>
          <button onClick={()=>onOpenSettings?.()} style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 12px",fontSize:12,marginTop:10}}>前往 Key 設定</button>
        </div>}
        {apiKey?.trim()&&dictLoading&&<div style={{padding:"28px 0",textAlign:"center",color:S.t3}}>AI 正在整理小朋友版字典...</div>}
        {apiKey?.trim()&&!dictLoading&&dictError&&<div style={{padding:12,background:"#fff4f4",border:"1px solid #f2c7c7",borderRadius:12,color:"#9f2f2f"}}>{dictError}</div>}
        {apiKey?.trim()&&!dictLoading&&!dictError&&!dictData&&<div style={{padding:12,background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:12,color:S.t3}}>尚未產生字典內容，可重新點擊查字典或使用 Yahoo 查詢。</div>}
        {apiKey?.trim()&&!dictLoading&&dictData&&<>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
            {cur.ph&&<span style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:999,padding:"4px 9px",fontWeight:700,color:S.t2}}>{cur.ph}</span>}
            <span style={{background:c.bg,border:`1px solid ${c.cl}33`,borderRadius:999,padding:"4px 9px",fontWeight:800,color:c.cl}}>{dictData.partOfSpeechZh||cur.p}</span>
            <button onClick={()=>speak(cur.w)} style={{...S.btn,background:c.cl,color:"#fff",padding:"6px 10px",fontSize:12}}>播放發音</button>
          </div>
          <div style={{padding:12,background:c.bg,border:`1px solid ${c.cl}33`,borderRadius:12,marginBottom:12}}>
            <div style={{fontSize:11,color:c.cl,fontWeight:900,marginBottom:3}}>小朋友版解釋</div>
            <div style={{fontSize:20,color:S.t1,fontWeight:900,marginBottom:4}}>{dictData.headlineZh||cur.m}</div>
            <div style={{color:S.t2,fontWeight:700,marginBottom:4}}>{dictData.shortMeaning}</div>
            <div style={{color:S.t2}}>{dictData.kidExplanation}</div>
          </div>
          {dictData.forms.length>0&&<div style={{padding:"10px 0",borderTop:`1px solid ${S.bd}`}}>
            <div style={{fontSize:12,color:c.cl,fontWeight:900,marginBottom:6}}>詞性變化</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{dictData.forms.map((f,i)=><span key={i} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:999,padding:"4px 8px",color:S.t2}}>{f.word}{f.note?`：${f.note}`:""}</span>)}</div>
          </div>}
          {dictData.collocations.length>0&&<div style={{padding:"10px 0",borderTop:`1px solid ${S.bd}`}}>
            <div style={{fontSize:12,color:c.cl,fontWeight:900,marginBottom:6}}>常見搭配</div>
            {dictData.collocations.map((x,i)=><div key={i} style={{marginBottom:5,color:S.t1}}>・<b>{x.phrase}</b>{x.zh?` - ${x.zh}`:""}</div>)}
          </div>}
          {dictData.examples.length>0&&<div style={{padding:"10px 0",borderTop:`1px solid ${S.bd}`}}>
            <div style={{fontSize:12,color:c.cl,fontWeight:900,marginBottom:6}}>例句</div>
            {dictData.examples.map((x,i)=><div key={i} style={{padding:"8px 10px",background:S.bg2,borderRadius:10,marginBottom:7}}>
              <div style={{color:S.t1,fontWeight:800}}>{x.en}</div>
              {x.zh&&<div style={{color:S.t3,marginTop:3}}>{x.zh}</div>}
            </div>)}
          </div>}
          {dictData.synonyms.length>0&&<div style={{padding:"10px 0",borderTop:`1px solid ${S.bd}`}}>
            <div style={{fontSize:12,color:c.cl,fontWeight:900,marginBottom:6}}>相似字</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{dictData.synonyms.map((s,i)=><span key={i} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:999,padding:"3px 7px",fontSize:11,color:S.t2}}>{s.word}{s.zh?` ${s.zh}`:""}</span>)}</div>
          </div>}
          {dictData.tips.length>0&&<div style={{padding:"10px 0",borderTop:`1px solid ${S.bd}`}}>
            <div style={{fontSize:12,color:c.cl,fontWeight:900,marginBottom:6}}>學習提醒</div>
            {dictData.tips.map((t,i)=><div key={i} style={{color:S.t2,marginBottom:4}}>・{t}</div>)}
          </div>}
          <div style={{fontSize:11,color:S.t3,borderTop:`1px solid ${S.bd}`,paddingTop:9,marginTop:4}}>資料來源：Gemini AI 產生，已快取於本機 · Yahoo 可作外部查詢參考</div>
        </>}
      </div>
    </aside>}
    </div>
    {flip&&<>
      <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:8}}>
        <button onClick={()=>{setFlip(false);setFlipAnim(false)}} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:14,padding:"10px 20px",fontSize:14,cursor:"pointer",color:S.t2,fontFamily:"inherit",minHeight:44}}>🔙 翻回</button>
        <button onClick={()=>{const url=`https://englishgo-vevan.netlify.app/?word=${encodeURIComponent(cur.w)}&lv=${lv}`;const t=`📘 今天學了一個英文單字！\n\n📝 ${cur.w}${cur.ph?` ${cur.ph}`:""}\n   ${cur.p} ${cur.m}\n${cur.ex?`\n📖 ${cur.ex}`:""}\n${cur.ez?`   ${cur.ez}`:""}\n\n一起來學英文 👇\n${url}`;shareLine(t,url)}} style={{background:"#06C755",border:"none",borderRadius:14,padding:"10px 16px",fontSize:14,cursor:"pointer",color:"#fff",fontFamily:"inherit",minHeight:44,fontWeight:600}}>📤 LINE</button>
        <button onClick={()=>{const url=`https://englishgo-vevan.netlify.app/?word=${encodeURIComponent(cur.w)}&lv=${lv}`;const t=`📘 ${cur.w}${cur.ph?` ${cur.ph}`:""} — ${cur.m}${cur.ex?`\n📖 ${cur.ex}`:""}${cur.ez?`\n   ${cur.ez}`:""}\n${url}`;navigator.clipboard?.writeText(t).then(()=>{const d=document.createElement("div");d.textContent="✅ 已複製！";d.style.cssText="position:fixed;top:20%;left:50%;transform:translateX(-50%);background:#1D9E75;color:#fff;padding:10px 24px;border-radius:20px;font-size:14px;font-weight:600;z-index:9999;animation:fadeUp .3s";document.body.appendChild(d);setTimeout(()=>d.remove(),1500)})}} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:14,padding:"10px 16px",fontSize:14,cursor:"pointer",color:S.t2,fontFamily:"inherit",minHeight:44}}>📋 複製</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginTop:8}}>{[{k:"again",l:"Again",n:"1",cl:"#E24B4A",bg:"#FCEBEB",em:"😅"},{k:"hard",l:"Hard",n:"2",cl:"#BA7517",bg:"#FAEEDA",em:"🤔"},{k:"good",l:"Good",n:"3",cl:"#0F6E56",bg:"#E1F5EE",em:"😊"},{k:"easy",l:"Easy",n:"4",cl:"#185FA5",bg:"#E6F1FB",em:"🤩"}].map(b=>(<button key={b.k} onClick={()=>rate(b.k)} style={{...S.btn,background:b.bg,color:b.cl,padding:"14px 4px",fontSize:14,display:"flex",flexDirection:"column",alignItems:"center",gap:2,transition:"transform .1s",minHeight:60,WebkitTapHighlightColor:"transparent"}} onTouchStart={e=>e.currentTarget.style.transform="scale(0.93)"} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"} onMouseDown={e=>e.currentTarget.style.transform="scale(0.95)"} onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}><span style={{fontSize:24}}>{b.em}</span>{b.l}<span style={{fontSize:10,opacity:.5}}>{b.n}</span></button>))}</div>
      
    </>}
  </div>);
}
// ═══ SPEAK PRACTICE (口說練習 - BeeSpeaker style) ══════════════════
function normalizeText(t){return t.toLowerCase().replace(/[^a-z0-9\s']/g,"").replace(/\s+/g," ").trim()}

// Levenshtein distance for fuzzy word matching
function editDist(a,b){
  if(a===b)return 0;
  if(!a.length)return b.length;
  if(!b.length)return a.length;
  const m=[];
  for(let i=0;i<=b.length;i++)m[i]=[i];
  for(let j=0;j<=a.length;j++)m[0][j]=j;
  for(let i=1;i<=b.length;i++)for(let j=1;j<=a.length;j++){
    m[i][j]=b[i-1]===a[j-1]?m[i-1][j-1]:Math.min(m[i-1][j-1]+1,m[i][j-1]+1,m[i-1][j]+1);
  }
  return m[b.length][a.length];
}

// Homophones and common misrecognitions (English)
