import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { getElementaryExample } from "./data/elementaryExamples.js";
import { JUNIOR_SONGS } from "./data/juniorSongs.js";
import { SENIOR_SONGS } from "./data/seniorSongs.js";
import { RECENT_FEATURES } from "./data/recentFeatures.generated.js";

// ═══ SUPABASE CLIENT (lazy init, graceful fallback) ═════════════════
let _sb = null;
let _sbInit = false;

async function getSb() {
  if (_sbInit) return _sb;
  _sbInit = true;
  try {
    const url = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL;
    const key = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY;
    if (url && key) {
      const { createClient } = await import("@supabase/supabase-js");
      _sb = createClient(url, key);
    }
  } catch {}
  return _sb;
}

// ═══ PET CLOUD SYNC (寵物雲端同步) ═══════════════════════════════════
// SHA-256 hash for PIN security (browser-native)
async function hashPin(pin){
  try{
    const enc=new TextEncoder().encode(pin);
    const buf=await crypto.subtle.digest('SHA-256',enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch{
    // Fallback: simple hash for older browsers
    let h=0;for(let i=0;i<pin.length;i++){h=((h<<5)-h+pin.charCodeAt(i))|0}
    return String(h);
  }
}

function validateUsername(u){
  if(!u||typeof u!=='string')return false;
  const t=u.trim();
  return t.length>=2&&t.length<=20;
}
function validatePin(p){return /^\d{4,6}$/.test(p)}

// Cloud operations
async function petCloudSignup(username,pin,initialData={}){
  const sb=await getSb();
  if(!sb)return{ok:false,err:"雲端服務未啟用"};
  const u=username.trim();
  if(!validateUsername(u))return{ok:false,err:"暱稱需 2-20 字"};
  if(!validatePin(pin))return{ok:false,err:"PIN 需 4-6 位數字"};
  const pinHash=await hashPin(pin);
  try{
    // Check if username exists
    const{data:existing}=await sb.from('pet_users').select('username').eq('username',u).limit(1);
    if(existing?.length)return{ok:false,err:"暱稱已被使用"};
    const row={
      username:u,pin_hash:pinHash,
      pets:initialData.pets||[],
      eggs:initialData.eggs||[],
      inventory:initialData.inventory||{},
      coins:initialData.coins||0,
      created_at:new Date().toISOString(),
      last_sync:new Date().toISOString(),
    };
    const{error}=await sb.from('pet_users').insert(row);
    if(error)return{ok:false,err:"建立失敗："+error.message};
    return{ok:true,data:row};
  }catch(e){return{ok:false,err:"建立失敗"}}
}

async function petCloudLogin(username,pin){
  const sb=await getSb();
  if(!sb)return{ok:false,err:"雲端服務未啟用"};
  const u=username.trim();
  const pinHash=await hashPin(pin);
  try{
    const{data,error}=await sb.from('pet_users').select('*').eq('username',u).eq('pin_hash',pinHash).limit(1);
    if(error||!data?.length)return{ok:false,err:"暱稱或 PIN 錯誤"};
    return{ok:true,data:data[0]};
  }catch{return{ok:false,err:"登入失敗"}}
}

async function petCloudSave(username,pinHash,payload){
  const sb=await getSb();
  if(!sb)return false;
  try{
    const{error}=await sb.from('pet_users').update({
      pets:payload.pets||[],
      eggs:payload.eggs||[],
      inventory:payload.inventory||{},
      coins:payload.coins||0,
      last_sync:new Date().toISOString(),
    }).eq('username',username).eq('pin_hash',pinHash);
    return!error;
  }catch{return false}
}

async function submitSponsorMessage(name,message){
  const sb=await getSb();
  if(!sb)return{ok:false,err:"目前無法連線到雲端資料庫，請稍後再試。"};
  const n=(name||"").trim();
  const m=(message||"").trim();
  if(!n)return{ok:false,err:"請先填寫姓名。"};
  if(n.length>60)return{ok:false,err:"姓名請控制在 60 字以內。"};
  if(m.length>500)return{ok:false,err:"留言請控制在 500 字以內。"};
  try{
    const{error}=await sb.from("sponsor_messages").insert({name:n,message:m});
    if(error)return{ok:false,err:"留言送出失敗："+error.message};
    return{ok:true};
  }catch{
    return{ok:false,err:"留言送出失敗，請稍後再試。"};
  }
}


function mapWord(r){
  const localExample=r?.level==="elementary"&&r?.category==="Supplemental"
    ?getElementaryExample(r.word,r.meaning,r.pos)
    :null;
  try{return{w:r.word,ph:r.phonetic||'',p:r.pos||'',m:r.meaning,
    f:typeof r.forms==='string'?JSON.parse(r.forms||'[]'):(r.forms||[]),
    c:typeof r.collocations==='string'?JSON.parse(r.collocations||'[]'):(r.collocations||[]),
    ex:localExample?.ex||r.example||'',ez:localExample?.ez||r.example_zh||'',img:'',level:r.level,category:r.category||'',ceecLevel:r.ceec_level}}catch{return null}
}

const WORD_SELECT="id,word,phonetic,pos,meaning,forms,collocations,example,example_zh,category,ceec_level,level";
const VOCAB_POOL_TTL=5*60*1000;
const _cloudCountCache={};
const _cloudVocabPools={};
const _cloudWordCache={};
const _cloudSearchCache={};
const _dailyWordCache={};

function shuffleCopy(list){
  const arr=[...(list||[])];
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function sampleWords(words,count){
  return shuffleCopy(words).slice(0,count).map(w=>({...w}));
}

function dateKey(){
  const d=new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function hashText(text){
  let h=0;
  for(let i=0;i<text.length;i++)h=((h<<5)-h+text.charCodeAt(i))|0;
  return Math.abs(h);
}

async function fetchCloudVocab(level, count = 20) {
  const sb = await getSb();
  if (!sb) return null;
  try {
    const now=Date.now();
    const cached=_cloudVocabPools[level];
    if(cached&&now-cached.t<VOCAB_POOL_TTL&&cached.words?.length>=count){
      return sampleWords(cached.words,count);
    }

    const total=await fetchCloudCount(level);
    if(!total)return null;

    const target=Math.min(total,Math.max(count*3,60));
    const pageCount=total<=target?1:Math.min(4,Math.ceil(target/20));
    const pageSize=Math.min(total,Math.ceil(target/pageCount));
    const starts=[];
    const maxStart=Math.max(0,total-pageSize);
    for(let i=0;i<pageCount;i++){
      const start=maxStart?Math.floor(Math.random()*(maxStart+1)):0;
      starts.push(start);
    }

    const chunks=await Promise.all(starts.map(start=>
      sb.from('word_bank')
        .select(WORD_SELECT)
        .eq('level',level)
        .order('id',{ascending:true})
        .range(start,start+pageSize-1)
    ));
    const byId=new Map();
    chunks.forEach(({data,error})=>{
      if(error||!data)return;
      data.forEach(row=>{if(!byId.has(row.id))byId.set(row.id,row)});
    });
    let guard=0;
    while(byId.size<count&&byId.size<total&&guard<4){
      guard++;
      const start=Math.floor(Math.random()*(Math.max(1,total-pageSize+1)));
      const {data,error}=await sb.from('word_bank')
        .select(WORD_SELECT)
        .eq('level',level)
        .order('id',{ascending:true})
        .range(start,start+pageSize-1);
      if(!error&&data)data.forEach(row=>{if(!byId.has(row.id))byId.set(row.id,row)});
    }
    const words=[...byId.values()].map(r=>mapWord(r)).filter(Boolean);
    if(!words.length)return null;
    _cloudVocabPools[level]={t:now,words};
    return sampleWords(words,count);
  } catch { return null; }
}

async function fetchCloudCount(level) {
  const sb = await getSb();
  if (!sb) return 0;
  try {
    const now=Date.now();
    const cached=_cloudCountCache[level];
    if(cached&&now-cached.t<VOCAB_POOL_TTL)return cached.count;
    const { count } = await sb.from('word_bank').select('id', { count: 'exact', head: true }).eq('level', level);
    _cloudCountCache[level]={t:now,count:count||0};
    return count || 0;
  } catch { return 0; }
}

async function fetchCloudWord(level, word) {
  const sb = await getSb();
  const key=`${level}:${String(word||"").toLowerCase()}`;
  if(!sb||!word)return null;
  try{
    const cached=_cloudWordCache[key];
    if(cached)return {...cached};
    const pool=_cloudVocabPools[level]?.words||[];
    const pooled=pool.find(w=>w.w.toLowerCase()===String(word).toLowerCase());
    if(pooled){_cloudWordCache[key]=pooled;return {...pooled}}
    const {data,error}=await sb.from('word_bank')
      .select(WORD_SELECT)
      .eq('level',level)
      .ilike('word',String(word).trim())
      .limit(1);
    if(error||!data?.[0])return null;
    const mapped=mapWord(data[0]);
    if(mapped)_cloudWordCache[key]=mapped;
    return mapped?{...mapped}:null;
  }catch{return null}
}

function cleanIlikeTerm(term){
  return String(term||"").trim().replace(/[%_*]/g,"").slice(0,40);
}

function cloneWordResult(w){return w?{...w}:w}

function resultLevelBias(level,preferred){
  if(!level)return 0.2;
  if(level===preferred)return -0.04;
  const i=["elementary","junior","senior"].indexOf(level);
  return i>=0?i*0.04:0.16;
}

function mergeWordResults(items,limit=18,preferredLevel=null){
  const best=new Map();
  (items||[]).filter(Boolean).forEach(item=>{
    const key=String(item.w||"").toLowerCase();
    const prev=best.get(key);
    const score=(item.score??9)+resultLevelBias(item.level,preferredLevel);
    const prevScore=prev?(prev.score??9)+resultLevelBias(prev.level,preferredLevel):Infinity;
    if(!prev||score<prevScore||(score===prevScore&&item.source==="雲端字庫")){
      best.set(key,item);
    }
  });
  return[...best.values()].sort((a,b)=>((a.score??9)+resultLevelBias(a.level,preferredLevel))-((b.score??9)+resultLevelBias(b.level,preferredLevel))||String(a.w).localeCompare(String(b.w))).slice(0,limit);
}

function applyLevelSearch(query,levels){
  return levels.length===1?query.eq('level',levels[0]):query.in('level',levels);
}

async function searchCloudWords(level,query,limit=14,scope="all"){
  const sb=await getSb();
  const raw=String(query||"").trim();
  if(!sb||!raw)return[];
  const levels=searchLevels(level,scope);
  const key=`${levels.join("|")}:${raw.toLowerCase()}:${limit}`;
  if(_cloudSearchCache[key])return _cloudSearchCache[key].map(cloneWordResult);
  try{
    const candidates=wordQueryCandidates(raw).slice(0,3);
    const cleanMeaning=cleanIlikeTerm(raw);
    const jobs=[];
    candidates.forEach(c=>{
      const term=cleanIlikeTerm(c);
      if(!term)return;
      jobs.push(applyLevelSearch(sb.from('word_bank').select(WORD_SELECT),levels).ilike('word',`${term}%`).order('word',{ascending:true}).limit(limit));
      if(term.length>=3)jobs.push(applyLevelSearch(sb.from('word_bank').select(WORD_SELECT),levels).ilike('word',`%${term}%`).order('word',{ascending:true}).limit(Math.max(5,Math.ceil(limit/2))));
    });
    if(cleanMeaning){
      jobs.push(applyLevelSearch(sb.from('word_bank').select(WORD_SELECT),levels).ilike('meaning',`%${cleanMeaning}%`).order('word',{ascending:true}).limit(limit));
    }
    const chunks=await Promise.all(jobs);
    const out=[];
    const seen=new Set();
    chunks.forEach(({data,error})=>{
      if(error||!data)return;
      data.forEach(row=>{
        const mapped=mapWord(row);
        if(!mapped)return;
        const rowKey=String(mapped.w||"").toLowerCase();
        const rowLevel=mapped.level||row.level||level;
        const seenKey=`${rowLevel}:${rowKey}`;
        if(seen.has(seenKey))return;
        seen.add(seenKey);
        let score=scoreWordMatch(mapped,raw,candidates);
        if(String(mapped.m||"").includes(raw))score=Math.min(score,0.15);
        out.push({...mapped,level:rowLevel,source:"雲端字庫",score});
      });
    });
    const merged=mergeWordResults(out,limit,level);
    _cloudSearchCache[key]=merged;
    return merged.map(cloneWordResult);
  }catch{return[]}
}

async function fetchDailyCloudWord(level, fallback) {
  const sb = await getSb();
  if(!sb)return fallback;
  const key=`${level}:${dateKey()}`;
  try{
    if(_dailyWordCache[key])return {..._dailyWordCache[key]};
    const total=await fetchCloudCount(level);
    if(!total)return fallback;
    const index=hashText(key)%total;
    const {data,error}=await sb.from('word_bank')
      .select(WORD_SELECT)
      .eq('level',level)
      .order('id',{ascending:true})
      .range(index,index);
    const mapped=!error&&data?.[0]?mapWord(data[0]):null;
    if(mapped){_dailyWordCache[key]=mapped;_cloudWordCache[`${level}:${mapped.w.toLowerCase()}`]=mapped;return {...mapped}}
  }catch{}
  return fallback;
}

// ═══ HOOK: localStorage ═════════════════════════════════════════════
function useLS(key, init) {
  const [val, setVal] = useState(() => { try { const s = localStorage.getItem("eg_" + key); return s ? JSON.parse(s) : init; } catch { return init; } });
  useEffect(() => { try { localStorage.setItem("eg_" + key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal];
}

// ═══ VOCAB DATA ═════════════════════════════════════════════════════
const V = {
  elementary: [
    {w:"apple",ph:"/ˈæp.əl/",p:"n.",m:"蘋果",f:[{w:"apples",p:"n.",n:"複數"}],c:["an apple a day 一天一蘋果"],ex:"I eat an apple every day.",ez:"我每天吃一顆蘋果。",img:"🍎"},
    {w:"happy",ph:"/ˈhæp.i/",p:"adj.",m:"開心的",f:[{w:"happiness",p:"n.",n:"快樂"},{w:"happily",p:"adv.",n:"開心地"}],c:["feel happy 感到開心"],ex:"She feels very happy today.",ez:"她今天很開心。",img:"😊"},
    {w:"school",ph:"/skuːl/",p:"n.",m:"學校",f:[],c:["go to school 去上學"],ex:"I go to school every morning.",ez:"我每天早上去上學。",img:"🏫"},
    {w:"water",ph:"/ˈwɔː.tər/",p:"n.",m:"水",f:[{w:"watery",p:"adj.",n:"水汪汪的"}],c:["drink water 喝水"],ex:"Please drink more water.",ez:"請多喝水。",img:"💧"},
    {w:"friend",ph:"/frend/",p:"n.",m:"朋友",f:[{w:"friendly",p:"adj.",n:"友善的"},{w:"friendship",p:"n.",n:"友誼"}],c:["best friend 最好的朋友"],ex:"She is my best friend.",ez:"她是我最好的朋友。",img:"🤝"},
    {w:"run",ph:"/rʌn/",p:"v.",m:"跑",f:[{w:"runner",p:"n.",n:"跑者"}],c:["run fast 跑得快"],ex:"I like to run in the park.",ez:"我喜歡在公園跑步。",img:"🏃"},
    {w:"book",ph:"/bʊk/",p:"n.",m:"書",f:[{w:"bookstore",p:"n.",n:"書店"}],c:["read a book 讀書"],ex:"I read a book before bed.",ez:"我睡前讀書。",img:"📖"},
    {w:"eat",ph:"/iːt/",p:"v.",m:"吃",f:[{w:"ate",p:"v.",n:"過去式"},{w:"eaten",p:"v.",n:"過去分詞"}],c:["eat breakfast 吃早餐"],ex:"We eat lunch at noon.",ez:"我們中午吃午餐。",img:"🍽️"},
    {w:"big",ph:"/bɪɡ/",p:"adj.",m:"大的",f:[{w:"bigger",p:"adj.",n:"更大的"}],c:["big city 大城市"],ex:"The elephant is very big.",ez:"大象非常大。",img:"🐘"},
    {w:"play",ph:"/pleɪ/",p:"v.",m:"玩",f:[{w:"player",p:"n.",n:"玩家"}],c:["play games 玩遊戲"],ex:"The children play in the park.",ez:"孩子們在公園玩。",img:"⚽"},
  ],
  junior: [
    {w:"accomplish",ph:"/əˈkɑːm.plɪʃ/",p:"v.",m:"完成；達成",f:[{w:"accomplishment",p:"n.",n:"成就"}],c:["accomplish a goal 達成目標"],ex:"She accomplished her goal of reading 50 books.",ez:"她達成了讀50本書的目標。"},
    {w:"environment",ph:"/ɪnˈvaɪ.rən.mənt/",p:"n.",m:"環境",f:[{w:"environmental",p:"adj.",n:"環境的"}],c:["protect the environment 保護環境"],ex:"We should protect the environment.",ez:"我們應該保護環境。"},
    {w:"experience",ph:"/ɪkˈspɪr.i.əns/",p:"n./v.",m:"經驗",f:[{w:"experienced",p:"adj.",n:"有經驗的"}],c:["work experience 工作經驗"],ex:"Traveling is a great experience.",ez:"旅行是很棒的經歷。"},
    {w:"communicate",ph:"/kəˈmjuː.nɪ.keɪt/",p:"v.",m:"溝通",f:[{w:"communication",p:"n.",n:"溝通"}],c:["communicate with 與…溝通"],ex:"It's important to communicate clearly.",ez:"清楚溝通很重要。"},
    {w:"opportunity",ph:"/ˌɑː.pərˈtuː.nə.ti/",p:"n.",m:"機會",f:[],c:["golden opportunity 黃金機會"],ex:"Don't miss this great opportunity.",ez:"別錯過好機會。"},
    {w:"responsible",ph:"/rɪˈspɑːn.sə.bəl/",p:"adj.",m:"負責任的",f:[{w:"responsibility",p:"n.",n:"責任"}],c:["be responsible for 對…負責"],ex:"He is a responsible student.",ez:"他是負責任的學生。"},
    {w:"influence",ph:"/ˈɪn.flu.əns/",p:"n./v.",m:"影響",f:[{w:"influential",p:"adj.",n:"有影響力的"}],c:["have influence on 對…有影響"],ex:"Music has a great influence on people.",ez:"音樂對人有很大的影響。"},
    {w:"suggest",ph:"/səˈdʒest/",p:"v.",m:"建議",f:[{w:"suggestion",p:"n.",n:"建議"}],c:["suggest that 建議…"],ex:"I suggest that you study harder.",ez:"我建議你更用功。"},
    {w:"participate",ph:"/pɑːrˈtɪs.ɪ.peɪt/",p:"v.",m:"參與",f:[{w:"participation",p:"n.",n:"參與"}],c:["participate in 參加"],ex:"Students participate in various activities.",ez:"學生們參與各種活動。"},
    {w:"improve",ph:"/ɪmˈpruːv/",p:"v.",m:"改善",f:[{w:"improvement",p:"n.",n:"改善"}],c:["improve skills 提升技能"],ex:"Practice can improve your English.",ez:"練習可以提升英文。"},
  ],
  senior: [
    {w:"comprehensive",ph:"/ˌkɑːm.prɪˈhen.sɪv/",p:"adj.",m:"全面的",f:[{w:"comprehension",p:"n.",n:"理解力"}],c:["comprehensive analysis 全面分析"],ex:"The report provides a comprehensive analysis.",ez:"報告提供了全面分析。"},
    {w:"controversial",ph:"/ˌkɑːn.trəˈvɝː.ʃəl/",p:"adj.",m:"有爭議的",f:[{w:"controversy",p:"n.",n:"爭議"}],c:["controversial topic 爭議話題"],ex:"The policy is highly controversial.",ez:"這項政策極具爭議。"},
    {w:"phenomenon",ph:"/fɪˈnɑː.mə.nɑːn/",p:"n.",m:"現象",f:[{w:"phenomena",p:"n.",n:"複數"}],c:["natural phenomenon 自然現象"],ex:"Climate change is a global phenomenon.",ez:"氣候變遷是全球現象。"},
    {w:"sophisticated",ph:"/səˈfɪs.tɪ.keɪ.tɪd/",p:"adj.",m:"精密的",f:[{w:"sophistication",p:"n.",n:"精密"}],c:["sophisticated technology 精密科技"],ex:"The system uses sophisticated technology.",ez:"系統使用精密科技。"},
    {w:"alleviate",ph:"/əˈliː.vi.eɪt/",p:"v.",m:"減輕",f:[{w:"alleviation",p:"n.",n:"減輕"}],c:["alleviate pain 減輕疼痛"],ex:"This medicine can alleviate the pain.",ez:"這藥可以減輕疼痛。"},
    {w:"unprecedented",ph:"/ʌnˈpres.ə.den.tɪd/",p:"adj.",m:"史無前例的",f:[{w:"precedent",p:"n.",n:"先例"}],c:["unprecedented challenge 史無前例挑戰"],ex:"The pandemic caused unprecedented challenges.",ez:"疫情造成史無前例的挑戰。"},
    {w:"deteriorate",ph:"/dɪˈtɪr.i.ə.reɪt/",p:"v.",m:"惡化",f:[{w:"deterioration",p:"n.",n:"惡化"}],c:["health deteriorates 健康惡化"],ex:"His health began to deteriorate.",ez:"他的健康開始惡化。"},
    {w:"sustainable",ph:"/səˈsteɪ.nə.bəl/",p:"adj.",m:"可持續的",f:[{w:"sustainability",p:"n.",n:"可持續性"}],c:["sustainable development 永續發展"],ex:"We need sustainable energy solutions.",ez:"我們需要可持續能源方案。"},
    {w:"ambiguous",ph:"/æmˈbɪɡ.ju.əs/",p:"adj.",m:"模稜兩可的",f:[{w:"ambiguity",p:"n.",n:"模糊性"}],c:["ambiguous meaning 模糊的意思"],ex:"The instructions were ambiguous.",ez:"這些指示很模糊。"},
    {w:"facilitate",ph:"/fəˈsɪl.ɪ.teɪt/",p:"v.",m:"促進",f:[{w:"facilitator",p:"n.",n:"引導者"}],c:["facilitate learning 促進學習"],ex:"Technology can facilitate learning.",ez:"科技可以促進學習。"},
  ],
};

let _extraWordsPromise=null;
let _extraWordsCache=null;
async function loadExtraWords(){
  if(_extraWordsCache)return _extraWordsCache;
  if(!_extraWordsPromise){
    _extraWordsPromise=import("./data/extraWords.js").then(m=>m.EXTRA_WORDS||{}).catch(()=>({elementary:[],junior:[],senior:[]}));
  }
  _extraWordsCache=await _extraWordsPromise;
  return _extraWordsCache;
}
function normalizeWordQuery(q){return String(q||"").trim().toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g,"")}
function preferredLevels(level){return[level,...Object.keys(V).filter(k=>k!==level)]}
function searchLevels(level,scope="all"){return scope==="current"?[level]:preferredLevels(level)}
function wordQueryCandidates(query){
  const q=normalizeWordQuery(query);if(!q)return[];
  const set=new Set([q]);
  if(q.endsWith("ies")&&q.length>4)set.add(q.slice(0,-3)+"y");
  if(q.endsWith("es")&&q.length>3)set.add(q.slice(0,-2));
  if(q.endsWith("s")&&q.length>3&&!q.endsWith("ss"))set.add(q.slice(0,-1));
  if(q.endsWith("ing")&&q.length>5){
    const stem=q.slice(0,-3);set.add(stem);set.add(stem+"e");
    if(stem.length>2&&stem[stem.length-1]===stem[stem.length-2])set.add(stem.slice(0,-1));
  }
  if(q.endsWith("ed")&&q.length>4){
    const stem=q.slice(0,-2);set.add(stem);set.add(stem+"e");
    if(stem.length>2&&stem[stem.length-1]===stem[stem.length-2])set.add(stem.slice(0,-1));
  }
  return[...set];
}
function scoreWordMatch(word,raw,candidates){
  const key=String(word.w||"").toLowerCase();
  const meaning=String(word.m||"");
  if(candidates.includes(key))return 0;
  if(candidates.some(q=>key.startsWith(q)))return 1;
  if(candidates.some(q=>key.includes(q)))return 2;
  if(raw&&meaning){
    if(meaning===raw)return 0.05;
    if(meaning.startsWith(`${raw}；`)||meaning.startsWith(`${raw}，`))return 0.1;
    if(meaning.startsWith(`${raw}的`))return 0.2;
    if(meaning.startsWith(raw))return 0.6;
    if(meaning.includes(raw))return 3;
  }
  return 9;
}
function findLocalWord(level,word){
  const candidates=wordQueryCandidates(word);if(!candidates.length)return null;
  for(const l of preferredLevels(level)){const hit=(V[l]||[]).find(w=>candidates.includes(String(w.w).toLowerCase()));if(hit)return{...hit,level:l,source:"本地單字卡"}}
  return null;
}
function searchLocalWords(level,query,limit=16,scope="all"){
  const raw=String(query||"").trim();const candidates=wordQueryCandidates(query);if(!candidates.length&&!raw)return[];
  const out=[];const seen=new Set();
  searchLevels(level,scope).forEach(l=>(V[l]||[]).forEach(w=>{
    const key=String(w.w).toLowerCase();if(seen.has(`${l}:${key}`))return;
    const score=scoreWordMatch(w,raw,candidates);
    if(score<9){seen.add(`${l}:${key}`);out.push({...w,level:l,source:"本地單字卡",score})}
  }));
  return mergeWordResults(out,limit,level);
}
async function findAnyWord(level,word){
  const local=findLocalWord(level,word);if(local)return local;
  const candidates=wordQueryCandidates(word);if(!candidates.length)return null;
  const extra=await loadExtraWords();
  for(const l of preferredLevels(level)){
    const hit=(extra[l]||[]).find(w=>candidates.includes(String(w.w).toLowerCase()));
    if(hit)return{...hit,level:l,source:"補充重點單字"};
  }
  return null;
}
async function searchAnyWords(level,query,limit=16,scope="all"){
  const raw=String(query||"").trim();const candidates=wordQueryCandidates(query);
  const out=searchLocalWords(level,query,limit,scope);
  const seen=new Set(out.map(w=>`${w.level}:${String(w.w).toLowerCase()}`));
  if(!candidates.length&&!raw)return out;
  const extra=await loadExtraWords();
  searchLevels(level,scope).forEach(l=>(extra[l]||[]).forEach(w=>{
    const key=String(w.w).toLowerCase();if(seen.has(`${l}:${key}`))return;
    const score=scoreWordMatch(w,raw,candidates);
    if(score<9){seen.add(`${l}:${key}`);out.push({...w,level:l,source:"補充重點單字",score:score+0.2})}
  }));
  return mergeWordResults(out,limit,level);
}
// ═══ GRAMMAR ════════════════════════════════════════════════════════
const G = {
  elementary: [
    {t:"Be 動詞",d:"I am / You are / He is",ex:"I am a student.",examples:[{en:"I am hungry.",zh:"我餓了。"},{en:"They are my classmates.",zh:"他們是我的同學。"},{en:"The weather is nice today.",zh:"今天天氣很好。"}],q:{s:"She ___ a teacher.",o:["am","is","are","be"],a:1}},
    {t:"現在簡單式",d:"第三人稱加 s/es",ex:"He goes to school every day.",examples:[{en:"I play basketball after school.",zh:"我放學後打籃球。"},{en:"My sister likes music.",zh:"我妹妹喜歡音樂。"},{en:"Dad watches the news at night.",zh:"爸爸晚上看新聞。"}],q:{s:"She ___ breakfast at 7.",o:["eat","eats","eating","ate"],a:1}},
    {t:"現在進行式",d:"be + V-ing 正在做",ex:"I am reading a book now.",examples:[{en:"We are studying English now.",zh:"我們現在正在讀英文。"},{en:"The baby is sleeping.",zh:"寶寶正在睡覺。"},{en:"I am waiting for the bus.",zh:"我正在等公車。"}],q:{s:"They ___ TV now.",o:["watch","watches","are watching","watched"],a:2}},
    {t:"There is / There are",d:"表示「有…」",ex:"There are two cats.",examples:[{en:"There is a park near my house.",zh:"我家附近有一座公園。"},{en:"There are many books on the desk.",zh:"桌上有很多書。"},{en:"There is no milk in the fridge.",zh:"冰箱裡沒有牛奶。"}],q:{s:"There ___ a dog.",o:["is","are","has","have"],a:0}},
    {t:"名詞單複數",d:"大部分加 s，特殊變化要記",ex:"one child → two children",examples:[{en:"I have two boxes.",zh:"我有兩個盒子。"},{en:"Three children are playing outside.",zh:"三個孩子正在外面玩。"},{en:"There are five buses at the station.",zh:"車站有五輛公車。"}],q:{s:"I have three ___.",o:["box","boxs","boxes","boxies"],a:2}},
    {t:"代名詞",d:"I/me, he/him, she/her",ex:"She likes him.",examples:[{en:"Please help me.",zh:"請幫我。"},{en:"He gave her a gift.",zh:"他送她一份禮物。"},{en:"This book is mine.",zh:"這本書是我的。"}],q:{s:"Give ___ the book.",o:["I","my","me","mine"],a:2}},
    {t:"一般過去式",d:"動作發生在過去，動詞用過去式",ex:"I visited my grandma yesterday.",zh:"過去式用來說已經發生的事，常見時間線索有 yesterday, last night, two days ago。",pattern:"S + V-ed / 過去式動詞",tips:["先找過去時間線索","規則動詞多加 -ed","不規則動詞要直接記"],mistake:"看到 yesterday 不要再用現在式，例如 I go yesterday 要改成 I went yesterday。",examples:[{en:"We watched a movie last night.",zh:"我們昨晚看了一部電影。"},{en:"She bought a new bag yesterday.",zh:"她昨天買了一個新包包。"},{en:"Tom played soccer after school.",zh:"Tom 放學後踢足球。"}],q:{s:"He ___ his homework last night.",o:["does","did","do","doing"],a:1}},
    {t:"未來式 will / be going to",d:"will 表臨時決定或預測，be going to 表計畫",ex:"I will call you tonight.",zh:"will 常用在臨時決定、承諾、預測；be going to 常用在已經有安排或明顯跡象的未來。",pattern:"will + V / am-is-are going to + V",tips:["will 後面接原形動詞","be going to 前面要配 am/is/are","看句子是臨時決定還是已有計畫"],mistake:"不要寫 will goes，will 後面一定用原形 go。",examples:[{en:"I will help you.",zh:"我會幫你。"},{en:"She is going to visit Taipei tomorrow.",zh:"她明天要去台北。"},{en:"Look at the clouds. It is going to rain.",zh:"看那些雲。快要下雨了。"}],q:{s:"They ___ visit their uncle tomorrow.",o:["are going to","is going to","will to","going"],a:0}},
    {t:"can / can't",d:"表示能力、許可或不可能",ex:"I can swim.",zh:"can 表示能夠、可以；can't 表示不能、不可以。後面的動詞保持原形。",pattern:"can / can't + V",tips:["can 後面不加 to","第三人稱也不用加 s","否定可以寫 cannot 或 can't"],mistake:"He can plays 是錯的，can 後面要用 play。",examples:[{en:"She can speak English.",zh:"她會說英文。"},{en:"You can't eat in the library.",zh:"你不能在圖書館吃東西。"},{en:"Can I ask a question?",zh:"我可以問一個問題嗎？"}],q:{s:"My brother ___ ride a bike.",o:["can","cans","can to","is can"],a:0}},
    {t:"冠詞 a / an / the",d:"a/an 表泛指，the 表特定",ex:"I saw a dog. The dog was cute.",zh:"第一次提到或不特定的人事物常用 a/an；雙方都知道或第二次提到時用 the。",pattern:"a + 子音音開頭 / an + 母音音開頭 / the + 特定名詞",tips:["看發音不是只看字母","第一次提到多用 a/an","第二次提到或唯一事物用 the"],mistake:"an university 是錯的，university 發音以 /ju/ 開頭，所以用 a university。",examples:[{en:"I need an umbrella.",zh:"我需要一把傘。"},{en:"She has a cat. The cat is black.",zh:"她有一隻貓。那隻貓是黑色的。"},{en:"The sun is bright.",zh:"太陽很亮。"}],q:{s:"I ate ___ apple after lunch.",o:["a","an","the","x"],a:1}},
    {t:"疑問句 Do / Does",d:"一般動詞問句用 do / does",ex:"Does she like tea?",zh:"現在簡單式的一般動詞問句，要把 do 或 does 放到句首；he/she/it 用 does。",pattern:"Do/Does + S + 原形動詞?",tips:["he/she/it 問句用 does","用了 does 後動詞改回原形","回答可用 Yes, she does / No, she doesn't"],mistake:"Does she likes tea? 是錯的，does 已經表示第三人稱，like 不加 s。",examples:[{en:"Do you play tennis?",zh:"你打網球嗎？"},{en:"Does he live near school?",zh:"他住在學校附近嗎？"},{en:"What do they want?",zh:"他們想要什麼？"}],q:{s:"___ your father cook dinner?",o:["Do","Does","Is","Are"],a:1}},
    {t:"時間介系詞 in / on / at",d:"in 年月季節，on 日期星期，at 精確時間",ex:"We meet at 7 on Monday.",zh:"in 用在較大的時間範圍，on 用在日期或星期，at 用在明確時刻。",pattern:"in May / on Monday / at 7:30",tips:["月份年份季節用 in","星期日期用 on","幾點幾分用 at"],mistake:"at Monday 是錯的，星期要用 on Monday。",examples:[{en:"My birthday is in July.",zh:"我的生日在七月。"},{en:"We have a test on Friday.",zh:"我們星期五有考試。"},{en:"The class starts at nine.",zh:"課九點開始。"}],q:{s:"The party is ___ Saturday night.",o:["in","on","at","to"],a:1}},
  ],
  junior: [
    {t:"現在完成式",d:"have/has + p.p.",ex:"I have lived here for 5 years.",examples:[{en:"We have finished the project.",zh:"我們已經完成專題。"},{en:"She has never tried sushi.",zh:"她從沒試過壽司。"},{en:"I have known him since 2020.",zh:"我從 2020 年就認識他。"}],q:{s:"She ___ to Japan twice.",o:["has been","have been","was","went"],a:0}},
    {t:"被動語態",d:"be + p.p.",ex:"The window was broken.",examples:[{en:"The room is cleaned every day.",zh:"這個房間每天都被打掃。"},{en:"The song was written by Jay.",zh:"這首歌是 Jay 寫的。"},{en:"The report will be sent tonight.",zh:"報告今晚會被寄出。"}],q:{s:"The cake ___ by mom.",o:["baked","was baked","is baking","bake"],a:1}},
    {t:"關係代名詞",d:"who/which/that",ex:"The man who lives next door is a doctor.",examples:[{en:"The girl who won the race is my friend.",zh:"贏得比賽的女孩是我朋友。"},{en:"This is the phone that I bought yesterday.",zh:"這是我昨天買的手機。"},{en:"I like stories which have surprising endings.",zh:"我喜歡有驚喜結局的故事。"}],q:{s:"The book ___ I read was great.",o:["who","which","what","where"],a:1}},
    {t:"不定詞 vs 動名詞",d:"to V / V-ing",ex:"I enjoy reading. I want to go.",examples:[{en:"She decided to join the club.",zh:"她決定加入社團。"},{en:"They finished cleaning the classroom.",zh:"他們打掃完教室。"},{en:"I hope to see you again.",zh:"我希望再見到你。"}],q:{s:"She enjoys ___.",o:["swim","to swim","swimming","swam"],a:2}},
    {t:"連接詞",d:"because/although/if",ex:"Although it rained, we went out.",examples:[{en:"I stayed home because I was sick.",zh:"我待在家，因為我生病了。"},{en:"Although he was tired, he kept studying.",zh:"雖然他很累，他還是繼續讀書。"},{en:"If it rains, we will stay inside.",zh:"如果下雨，我們會待在室內。"}],q:{s:"___ he was tired, he kept working.",o:["Because","Although","If","So"],a:1}},
    {t:"比較級與最高級",d:"-er/-est 或 more/most",ex:"She is taller than her brother.",examples:[{en:"This question is easier than that one.",zh:"這題比那題簡單。"},{en:"English is more useful than I expected.",zh:"英文比我預期更有用。"},{en:"This is the most exciting game this year.",zh:"這是今年最刺激的比賽。"}],q:{s:"This is the ___ movie ever.",o:["good","better","best","most good"],a:2}},
    {t:"助動詞 should / must",d:"should 表建議，must 表必須",ex:"You should drink more water.",zh:"should 用來提出建議；must 表強烈義務或規定。後面都接原形動詞。",pattern:"should / must + V",tips:["should 語氣較柔和","must 表必須或很確定","後面動詞不加 s、不加 to"],mistake:"You should to sleep 是錯的，should 後面直接接 sleep。",examples:[{en:"You should review before the test.",zh:"考試前你應該複習。"},{en:"Students must wear uniforms.",zh:"學生必須穿制服。"},{en:"He must be at home now.",zh:"他現在一定在家。"}],q:{s:"You ___ finish your homework before dinner.",o:["must","must to","shoulds","are must"],a:0}},
    {t:"過去進行式",d:"was/were + V-ing",ex:"I was doing homework at eight.",zh:"過去進行式描述過去某個時間點正在發生的動作。",pattern:"was / were + V-ing",tips:["單數主詞多用 was","you/we/they 用 were","常搭配 when 或 at that time"],mistake:"I was do homework 是錯的，要用 was doing。",examples:[{en:"She was reading when I called.",zh:"我打電話時她正在閱讀。"},{en:"They were playing basketball at 5 p.m.",zh:"下午五點他們正在打籃球。"},{en:"I was sleeping at that time.",zh:"那時我正在睡覺。"}],q:{s:"We ___ dinner when the phone rang.",o:["eat","were eating","was eating","ate"],a:1}},
    {t:"未來式",d:"will / be going to / present continuous",ex:"We are meeting at the station tomorrow.",zh:"談未來可用 will、be going to，也可用現在進行式表示已安排好的行程。",pattern:"will + V / be going to + V / be + V-ing",tips:["臨時決定多用 will","已計畫多用 be going to","固定安排可用 be V-ing"],mistake:"表示已安排好的會面時，We are meet tomorrow 要改成 We are meeting tomorrow。",examples:[{en:"I will answer the phone.",zh:"我來接電話。"},{en:"We are going to have a picnic.",zh:"我們要去野餐。"},{en:"She is flying to Japan next week.",zh:"她下週要飛日本。"}],q:{s:"I ___ my dentist at 3 p.m. tomorrow.",o:["am seeing","saw","see","was seeing"],a:0}},
    {t:"間接問句",d:"疑問詞 + 主詞 + 動詞",ex:"Do you know where he lives?",zh:"間接問句放在句子裡當名詞子句，語序要改回主詞在前、動詞在後。",pattern:"Do you know + wh- + S + V?",tips:["不要保留倒裝語序","Yes/No 問句可用 whether/if","句尾只留一個問號"],mistake:"Do you know where does he live? 是錯的，要說 where he lives。",examples:[{en:"I don't know what she wants.",zh:"我不知道她想要什麼。"},{en:"Can you tell me when the class starts?",zh:"你能告訴我課什麼時候開始嗎？"},{en:"She asked if I was free.",zh:"她問我是否有空。"}],q:{s:"Can you tell me where ___?",o:["is the station","the station is","does the station","the station"],a:1}},
    {t:"too / enough",d:"too 表太過，enough 表足夠",ex:"The bag is too heavy to carry.",zh:"too 表示程度過高而無法做到某事；enough 表示足以做到某事。",pattern:"too + adj + to V / adj + enough + to V",tips:["too 放形容詞前","enough 放形容詞後","後面常接 to V 說結果"],mistake:"enough tall 是錯的，形容詞要放在 enough 前面：tall enough。",examples:[{en:"The soup is too hot to drink.",zh:"湯太燙，不能喝。"},{en:"He is old enough to drive.",zh:"他年紀夠大，可以開車。"},{en:"This room is big enough for us.",zh:"這房間夠大，適合我們。"}],q:{s:"She is tall ___ to reach the shelf.",o:["too","enough","very","so"],a:1}},
    {t:"使役與感官動詞",d:"make/let/have/see/hear + O + V",ex:"My teacher made us rewrite the essay.",zh:"make、let、have 以及 see、hear、watch 後面常接受詞加原形動詞，表示讓某人做或感受到某人做某事。",pattern:"V + O + 原形動詞",tips:["make 表要求或造成","let 表允許","see/hear/watch 強調看見或聽見完整動作"],mistake:"Let me to help 是錯的，要說 Let me help。",examples:[{en:"The news made me cry.",zh:"這則新聞讓我哭了。"},{en:"Mom let me use her computer.",zh:"媽媽讓我用她的電腦。"},{en:"I saw him cross the street.",zh:"我看見他過馬路。"}],q:{s:"The coach made the players ___ ten laps.",o:["run","to run","running","ran"],a:0}},
  ],
  senior: [
    {t:"假設語氣（現在）",d:"If + 過去式, would + V",ex:"If I were you, I would study harder.",examples:[{en:"If I had more time, I would learn French.",zh:"如果我有更多時間，我會學法文。"},{en:"She would join us if she were free.",zh:"如果她有空，她會加入我們。"},{en:"If this room were larger, we could hold the meeting here.",zh:"如果這房間更大，我們就能在這裡開會。"}],q:{s:"If I ___ rich, I would travel.",o:["am","was","were","be"],a:2}},
    {t:"假設語氣（過去）",d:"If + had p.p., would have p.p.",ex:"If I had studied, I would have passed.",examples:[{en:"If they had left earlier, they would have caught the train.",zh:"如果他們早點離開，就會趕上火車。"},{en:"I would have helped you if I had known.",zh:"如果我知道，我就會幫你。"},{en:"She might have won if she had practiced more.",zh:"如果她多練習，她可能會贏。"}],q:{s:"If she ___ earlier, she wouldn't have missed it.",o:["comes","came","had come","has come"],a:2}},
    {t:"分詞構句",d:"V-ing 開頭簡化子句",ex:"Walking along the street, I met a friend.",examples:[{en:"Feeling tired, he went to bed early.",zh:"因為覺得累，他早早上床睡覺。"},{en:"Built in 1920, the school is still in use.",zh:"這所學校建於 1920 年，至今仍在使用。"},{en:"Having finished the report, she took a break.",zh:"完成報告後，她休息了一下。"}],q:{s:"___ the letter, she cried.",o:["Reading","Read","To read","Reads"],a:0}},
    {t:"倒裝句",d:"否定副詞放句首",ex:"Never have I seen such beauty.",examples:[{en:"Rarely do we get such a chance.",zh:"我們很少有這樣的機會。"},{en:"Not only did he apologize, but he also paid for the damage.",zh:"他不只道歉，也賠償損失。"},{en:"Only then did I understand the problem.",zh:"直到那時我才了解問題。"}],q:{s:"Not only ___ hard, but he helped others.",o:["he worked","did he work","he did work","does he works"],a:1}},
    {t:"名詞子句",d:"that / whether / wh-",ex:"What he said surprised everyone.",examples:[{en:"I believe that effort matters.",zh:"我相信努力很重要。"},{en:"Whether she agrees is still unclear.",zh:"她是否同意仍不清楚。"},{en:"What you need is more practice.",zh:"你需要的是更多練習。"}],q:{s:"I don't know ___ she will come.",o:["that","whether","what","which"],a:1}},
    {t:"強調句型",d:"It is/was...that",ex:"It was John that broke the window.",examples:[{en:"It was my sister who solved the problem.",zh:"解決問題的是我妹妹。"},{en:"It is practice that makes the difference.",zh:"真正造成差異的是練習。"},{en:"It was in Taipei that we first met.",zh:"我們第一次見面是在台北。"}],q:{s:"It was ___ that I met her.",o:["in Tokyo","Tokyo","at Tokyo is","Tokyo where"],a:0}},
    {t:"完成進行式",d:"have/has/had been + V-ing",ex:"I have been studying for three hours.",zh:"完成進行式強調某動作從過去開始、持續到某時間點，並且常帶有持續造成的影響。",pattern:"have/has/had been + V-ing",tips:["現在完成進行式連到現在","過去完成進行式連到過去另一時間點","常搭配 for / since"],mistake:"I have studying 是錯的，要補上 been：I have been studying。",examples:[{en:"She has been working all day.",zh:"她一整天都在工作。"},{en:"They had been waiting for an hour before the bus arrived.",zh:"公車到之前，他們已經等了一小時。"},{en:"It has been raining since morning.",zh:"從早上開始一直在下雨。"}],q:{s:"He ___ for the company since 2021.",o:["has worked","has been working","is worked","had working"],a:1}},
    {t:"混合假設語氣",d:"過去條件影響現在結果",ex:"If I had slept earlier, I would not be tired now.",zh:"混合假設用來連接不同時間：過去沒有發生的條件，造成現在不同的結果。",pattern:"If + had p.p., S + would + V now",tips:["if 子句談過去，用 had p.p.","主要子句談現在，用 would + V","句中常有 now 或 today"],mistake:"不要兩邊都套同一種時間；看到 now 通常主要子句要回到現在結果。",examples:[{en:"If she had studied medicine, she would be a doctor now.",zh:"如果她當初讀醫，她現在就是醫生。"},{en:"If I had taken the job, I would live in London now.",zh:"如果我當初接那份工作，我現在會住在倫敦。"},{en:"If we had left earlier, we would be there now.",zh:"如果我們早點出發，現在就會在那裡。"}],q:{s:"If I had saved more money, I ___ a car now.",o:["would buy","would have bought","will buy","bought"],a:0}},
    {t:"讓步與轉折",d:"although / even though / however / nevertheless",ex:"Although the plan was risky, we tried it.",zh:"讓步子句承認某個事實，再提出相反或意外的結果；轉折副詞則連接兩個完整句子的對比。",pattern:"Although + S + V, S + V. / S + V; however, S + V.",tips:["although 後面接子句","however 通常用逗號隔開","although 不要和 but 重複使用"],mistake:"Although it was raining, but we left 是錯的，although 和 but 留一個就好。",examples:[{en:"Even though the task was hard, she finished it.",zh:"即使任務很難，她仍完成了。"},{en:"The idea sounds simple; however, it is difficult to apply.",zh:"這想法聽起來簡單，然而很難執行。"},{en:"Nevertheless, the team continued.",zh:"儘管如此，團隊仍繼續。"}],q:{s:"___ the test was difficult, many students passed.",o:["Although","Because","So","However"],a:0}},
    {t:"同位語",d:"用名詞片語補充說明前面的名詞",ex:"My brother, a software engineer, lives in Hsinchu.",zh:"同位語用另一個名詞或名詞片語補充前面的名詞，常用逗號隔開。",pattern:"Noun, appositive, + V",tips:["同位語不是完整子句","可用來補充身份或定義","非必要資訊通常用逗號"],mistake:"My brother who a doctor is busy 是錯的；若不是子句，直接用 My brother, a doctor, is busy。",examples:[{en:"Taipei, the capital of Taiwan, has excellent public transportation.",zh:"台北，台灣的首都，有很好的大眾運輸。"},{en:"Mr. Lin, our math teacher, is patient.",zh:"林老師，我們的數學老師，很有耐心。"},{en:"The novel, a classic in American literature, remains popular.",zh:"這本小說是美國文學經典，至今仍受歡迎。"}],q:{s:"Ms. Wang, ___, will give a speech.",o:["our principal","who our principal","is our principal","our principal is"],a:0}},
    {t:"關係子句進階",d:"非限定、介系詞 + whom/which",ex:"The project, which took months, was finally finished.",zh:"進階關係子句可補充非必要資訊，也可把介系詞放到 whom/which 前面，語氣較正式。",pattern:"N, which/who ..., V / prep + whom/which",tips:["非限定子句用逗號","人用 who/whom，物用 which","介系詞前置時不用 that"],mistake:"The issue about that we argued 是錯的，正式寫法是 the issue about which we argued。",examples:[{en:"My aunt, who lives in Tainan, is a chef.",zh:"我阿姨住在台南，她是廚師。"},{en:"The topic about which we talked was sensitive.",zh:"我們談到的那個主題很敏感。"},{en:"The museum, which opened last year, attracts many visitors.",zh:"那座去年開幕的博物館吸引許多遊客。"}],q:{s:"The scientist, ___ won the prize, gave a lecture.",o:["who","which","that","what"],a:0}},
    {t:"省略與替代",d:"用省略或替代避免重複",ex:"I like jazz, and so does my sister.",zh:"英文常用省略或替代讓句子更自然，例如 so do I、neither did he、do so、one/ones。",pattern:"so/neither + auxiliary + S / do so / one(s)",tips:["先找前句的助動詞或時態","肯定附和用 so","否定附和用 neither"],mistake:"I like it and so my sister 是錯的，要補助動詞：so does my sister。",examples:[{en:"I have finished the task, and so has Emma.",zh:"我完成任務了，Emma 也完成了。"},{en:"He didn't attend the meeting, and neither did I.",zh:"他沒參加會議，我也沒有。"},{en:"If you need a pen, I can lend you one.",zh:"如果你需要筆，我可以借你一支。"}],q:{s:"She can swim, and so ___ I.",o:["can","do","am","have"],a:0}},
  ],
};
// ═══ READING ════════════════════════════════════════════════════════
const R = {
  elementary: [
    {t:"My Pet Cat",tx:"I have a pet cat. Her name is Mimi. She is white and fluffy. Mimi likes to sleep on the sofa. She also likes to play with a ball. Every morning, I give her milk. Mimi is my best friend.",qs:[{q:"What is the cat's name?",o:["Nini","Mimi","Kiki","Lili"],a:1},{q:"What does Mimi like?",o:["Swim","Fly","Sleep on sofa","Cook"],a:2}]},
    {t:"A Rainy Day",tx:"Today is a rainy day. I cannot go to the park. I stay at home and draw pictures. My mom makes hot chocolate for me. I draw a rainbow. My sister wants to play a card game. We play together and have fun.",qs:[{q:"Why can't the child go out?",o:["Too hot","It's raining","Park closed","Mom said no"],a:1},{q:"What does the child draw?",o:["A cat","A house","A rainbow","A car"],a:2}]},
    {t:"My Family",tx:"There are five people in my family. My father is a doctor. My mother is a teacher. I have one brother and one sister. My brother is older than me. My sister is the youngest. We live in a big house near the school.",qs:[{q:"How many people?",o:["Three","Four","Five","Six"],a:2},{q:"What does father do?",o:["Teacher","Doctor","Driver","Cook"],a:1}]},
    {t:"At the Zoo",tx:"Our class goes to the zoo on Friday. We see monkeys, elephants, and birds. The elephants are very big, and the monkeys are funny. My favorite animal is the giraffe because it has a long neck. We eat lunch under a tree.",qs:[{q:"Where does the class go?",o:["Museum","Zoo","Library","Beach"],a:1},{q:"Which animal has a long neck?",o:["Monkey","Bird","Giraffe","Elephant"],a:2}]},
    {t:"Tom's New Bike",tx:"Tom has a new blue bike. He rides it to school with his sister. He always wears a helmet because safety is important. After school, Tom cleans the bike and puts it in the garage. He is proud of his bike.",qs:[{q:"What color is Tom's bike?",o:["Red","Blue","Green","Yellow"],a:1},{q:"Why does Tom wear a helmet?",o:["It is cold","For safety","For school","It is new"],a:1}]},
    {t:"The School Garden",tx:"There is a small garden behind our school. Students plant flowers and vegetables there. We water the plants every morning. In summer, we can see tomatoes and butterflies. The garden makes our school beautiful.",qs:[{q:"Where is the garden?",o:["Behind school","In the library","Near the bus","On the roof"],a:0},{q:"What do students do every morning?",o:["Pick tomatoes","Water plants","Catch butterflies","Paint flowers"],a:1}]},
    {t:"A Birthday Party",tx:"Today is Lily's birthday. Her friends come to her house at three o'clock. They sing a birthday song and eat chocolate cake. Lily gets a storybook from her uncle. Everyone plays games and laughs.",qs:[{q:"Whose birthday is it?",o:["Mimi's","Tom's","Lily's","Uncle's"],a:2},{q:"What gift does Lily get?",o:["A ball","A storybook","A bike","A cake"],a:1}]},
    {t:"Helping Grandma",tx:"Ben visits his grandma on Sunday. Grandma is cooking soup in the kitchen. Ben helps wash the carrots and set the table. After lunch, he reads a book to Grandma. Grandma smiles and says thank you.",qs:[{q:"When does Ben visit Grandma?",o:["Monday","Friday","Saturday","Sunday"],a:3},{q:"What does Ben read?",o:["A book","A letter","A menu","A map"],a:0}]},
    {t:"The Lost Pencil",tx:"Amy cannot find her favorite pencil. She looks under her desk and inside her schoolbag. Her friend Jack finds it near the window. Amy is happy and says thank you. Then she uses the pencil to draw a star.",qs:[{q:"What is Amy looking for?",o:["A pencil","A bag","A star","A window"],a:0},{q:"Who finds it?",o:["Amy","Jack","Teacher","Mom"],a:1}]},
    {t:"After School",tx:"After school, Ken goes to the playground. He plays soccer with his classmates. They run fast and shout happily. At five o'clock, Ken goes home and drinks water. He finishes his homework before dinner.",qs:[{q:"What does Ken play?",o:["Baseball","Basketball","Soccer","Cards"],a:2},{q:"What does Ken do before dinner?",o:["Sleeps","Finishes homework","Draws pictures","Watches TV"],a:1}]},
  ],
  junior: [
    {t:"The Power of Reading",tx:"Reading is one of the most important skills a student can develop. When you read regularly, you improve your vocabulary and strengthen critical thinking. Studies show that students who read for pleasure perform better in school.",qs:[{q:"Reading helps improve?",o:["Drawing","Vocabulary & thinking","Fitness","Cooking"],a:1},{q:"Who does better in school?",o:["Who exercise","Who read for fun","Who sleep more","Who watch TV"],a:1}]},
    {t:"Social Media and Teens",tx:"Social media has become a big part of teenagers' lives. Many students spend more than three hours a day on Instagram and YouTube. While social media helps people stay connected, too much screen time may lead to sleep problems. Experts suggest setting a daily time limit.",qs:[{q:"How much time on social media?",o:["30 min","1 hour","More than 3 hours","5 hours"],a:2},{q:"Experts suggest?",o:["Use more","Delete apps","Set time limit","Only use computers"],a:2}]},
    {t:"Bubble Tea History",tx:"Bubble tea was invented in Taiwan in the 1980s. A teahouse owner added tapioca balls to iced tea. The drink quickly became popular across Taiwan and spread to other countries. Today, bubble tea shops can be found all over the world.",qs:[{q:"Where was bubble tea invented?",o:["Japan","Korea","Taiwan","China"],a:2},{q:"When?",o:["1960s","1970s","1980s","1990s"],a:2}]},
    {t:"A Greener School",tx:"Students at Green Valley Junior High started a recycling program. Each classroom has boxes for paper, bottles, and cans. At the end of every week, volunteers collect the boxes and record the amount. The project helps students understand that small habits can protect the environment.",qs:[{q:"What program did students start?",o:["Music club","Recycling program","Sports day","Book sale"],a:1},{q:"What do volunteers record?",o:["The weather","The amount collected","Students' names","Class scores"],a:1}]},
    {t:"Learning a New Skill",tx:"Kevin wanted to learn how to play the guitar. At first, his fingers hurt and the songs sounded strange. However, he practiced for twenty minutes every day. After two months, he could play a simple song for his family. He learned that progress takes patience.",qs:[{q:"What skill did Kevin learn?",o:["Drawing","Cooking","Guitar","Swimming"],a:2},{q:"What lesson did he learn?",o:["Practice needs patience","Music is easy","Families are strict","Songs are strange"],a:0}]},
    {t:"The Night Market",tx:"Taiwanese night markets are famous for food, games, and friendly crowds. Visitors can try stinky tofu, fried chicken, and fruit juice. Some people go there to shop for clothes or play small games. Night markets are not only places to eat but also places to experience local culture.",qs:[{q:"What are night markets famous for?",o:["Snow","Food and games","Libraries","Hospitals"],a:1},{q:"What can people experience there?",o:["Local culture","Space travel","Online classes","A quiet forest"],a:0}]},
    {t:"A Team Project",tx:"Mia's science group had to build a small bridge with paper and tape. At first, everyone had different ideas and talked at the same time. Their teacher asked them to listen before speaking. After they shared jobs clearly, the group worked faster and built a strong bridge.",qs:[{q:"What did the group build?",o:["A tower","A bridge","A robot","A boat"],a:1},{q:"What helped the group work faster?",o:["Clear jobs","More tape","Talking loudly","Working alone"],a:0}]},
    {t:"Public Transportation",tx:"Taking buses and trains can reduce traffic and air pollution. In busy cities, public transportation also helps people save time because they do not need to find parking spaces. Although it may be crowded during rush hour, it is still an important choice for many commuters.",qs:[{q:"What can public transportation reduce?",o:["Homework","Traffic and pollution","School time","Rain"],a:1},{q:"When may it be crowded?",o:["At midnight","During rush hour","On quiet days","After dinner only"],a:1}]},
    {t:"Online Learning",tx:"Online learning gives students more flexibility. They can review videos, pause lessons, and study at home. However, students also need self-control because games and messages can easily distract them. A good learning plan can help them stay focused.",qs:[{q:"What does online learning give students?",o:["Flexibility","More buses","Free lunch","No homework"],a:0},{q:"What problem is mentioned?",o:["Heavy books","Easy distraction","No teachers anywhere","Too much rain"],a:1}]},
    {t:"The School Concert",tx:"The school concert was held in the auditorium on Friday night. Students played the piano, violin, and drums. The music club practiced for three weeks before the show. When the final song ended, parents and teachers clapped loudly. The performers felt nervous but proud.",qs:[{q:"Where was the concert held?",o:["Gym","Auditorium","Library","Classroom"],a:1},{q:"How did performers feel?",o:["Angry but tired","Nervous but proud","Bored and sleepy","Quiet and sad"],a:1}]},
  ],
  senior: [
    {t:"Ethics of AI",tx:"As AI becomes integrated into daily life, ethical questions arise. One concern is algorithmic bias — when AI perpetuates prejudices from training data. Furthermore, worker displacement by automated systems presents unprecedented economic challenges requiring thoughtful policy responses.",qs:[{q:"What is algorithmic bias?",o:["A virus","AI perpetuating prejudices","A language","A product"],a:1},{q:"Automation challenge?",o:["Pollution","Worker displacement","Privacy","Energy"],a:1}]},
    {t:"Procrastination Psychology",tx:"Procrastination is not simply laziness. Research suggests it is an emotional regulation problem. When tasks trigger negative emotions, the brain seeks relief through avoidance. Cognitive behavioral strategies, such as breaking tasks into smaller steps, have proven effective.",qs:[{q:"Procrastination is primarily?",o:["Time management","Laziness","Emotional regulation","Genetics"],a:2},{q:"What helps?",o:["Work longer","Ignore deadlines","Break into small steps","Sleep more"],a:2}]},
    {t:"Renewable Energy Future",tx:"The transition to renewable energy is one of the most consequential shifts in modern history. Solar and wind power costs have dropped dramatically. However, intermittent nature presents grid stability challenges. Energy storage technologies are crucial for addressing this limitation.",qs:[{q:"Solar/wind cost?",o:["Increased","Same","Decreased dramatically","Unpredictable"],a:2},{q:"What's crucial?",o:["More fossil fuels","Energy storage","Reduce use","More plants"],a:1}]},
    {t:"Digital Privacy",tx:"Digital privacy has become increasingly complicated as people depend on online services. Apps often collect location data, browsing behavior, and personal preferences. While such data can improve convenience, it may also be misused if companies lack transparency. Users need both awareness and stronger legal protection.",qs:[{q:"Why can data collection be useful?",o:["It improves convenience","It removes all ads","It stops learning","It blocks the internet"],a:0},{q:"What protection is mentioned?",o:["Longer passwords only","Stronger legal protection","More screen time","Fewer devices"],a:1}]},
    {t:"Urban Heat Islands",tx:"Large cities are often warmer than nearby rural areas because concrete, asphalt, and buildings absorb heat. This phenomenon is called the urban heat island effect. Planting trees, creating green roofs, and using reflective materials can reduce the problem and make cities more livable.",qs:[{q:"Why are cities warmer?",o:["They absorb heat","They have fewer people","They receive less sun","They have more rivers"],a:0},{q:"What can reduce the problem?",o:["More asphalt","Green roofs","Fewer trees","Darker roads"],a:1}]},
    {t:"Media Literacy",tx:"In an age of endless information, media literacy is essential. Readers must evaluate sources, check evidence, and notice emotional language. False stories often spread quickly because they are surprising or frightening. Careful readers pause before sharing and ask who benefits from the message.",qs:[{q:"What should careful readers check?",o:["Only pictures","Sources and evidence","Font size","Number of comments"],a:1},{q:"Why do false stories spread quickly?",o:["They are always true","They are surprising or frightening","They are very long","They use no emotion"],a:1}]},
    {t:"The Value of Sleep",tx:"Sleep is not merely a break from activity; it is a biological process that supports memory, emotional balance, and physical repair. Teenagers often sleep too little because of homework, phones, and early school schedules. Improving sleep habits can therefore improve both learning and health.",qs:[{q:"What does sleep support?",o:["Memory and repair","Only sports","Louder music","More homework"],a:0},{q:"Why may teenagers sleep too little?",o:["No phones","Early school schedules","Too much sunlight","Too much exercise only"],a:1}]},
    {t:"Cultural Preservation",tx:"Cultural preservation is more than protecting old buildings. It includes languages, festivals, crafts, songs, and everyday traditions. When communities preserve culture, younger generations gain a sense of identity. However, preservation should not freeze culture; living traditions can adapt while keeping their meaning.",qs:[{q:"What does cultural preservation include?",o:["Only old buildings","Languages and traditions","New phones","Sports scores"],a:1},{q:"What should preservation avoid?",o:["Any meaning","All learning","Freezing culture","Young people"],a:2}]},
    {t:"Ocean Plastic",tx:"Plastic pollution threatens marine ecosystems because many plastic items do not break down easily. Small pieces can be eaten by fish and enter the food chain. Governments, businesses, and consumers all have roles to play, from banning single-use products to choosing reusable containers.",qs:[{q:"Why is plastic dangerous?",o:["It disappears quickly","It does not break down easily","It feeds all fish","It cleans oceans"],a:1},{q:"What is one suggested action?",o:["Use more plastic bags","Choose reusable containers","Throw plastic into rivers","Ignore businesses"],a:1}]},
    {t:"Resilience in Failure",tx:"Failure is often viewed as a final result, but it can also be a source of feedback. People who develop resilience analyze what went wrong, adjust their strategies, and try again. This attitude does not make failure pleasant, but it makes failure useful for long-term growth.",qs:[{q:"How can failure be useful?",o:["As feedback","As a final stop","As a prize","As entertainment"],a:0},{q:"What do resilient people do?",o:["Avoid all goals","Adjust strategies","Blame others first","Stop trying"],a:1}]},
  ],
};
const R_ZH = {
  "My Pet Cat":{tx:"我有一隻寵物貓。牠的名字叫 Mimi。牠又白又蓬鬆。Mimi 喜歡睡在沙發上。牠也喜歡玩球。每天早上，我都給牠牛奶。Mimi 是我最好的朋友。",qs:["這隻貓的名字是什麼？","Mimi 喜歡做什麼？"]},
  "A Rainy Day":{tx:"今天是雨天。我不能去公園。我待在家裡畫圖。媽媽為我做熱巧克力。我畫了一道彩虹。我的妹妹想玩紙牌遊戲。我們一起玩得很開心。",qs:["為什麼這個孩子不能出去？","這個孩子畫了什麼？"]},
  "My Family":{tx:"我家有五個人。我的爸爸是醫生。我的媽媽是老師。我有一個哥哥和一個妹妹。我的哥哥比我大。我的妹妹年紀最小。我們住在學校附近的一棟大房子裡。",qs:["家裡有幾個人？","爸爸的工作是什麼？"]},
  "At the Zoo":{tx:"我們班星期五去動物園。我們看到猴子、大象和鳥。大象非常大，猴子很有趣。我最喜歡的動物是長頸鹿，因為牠有長長的脖子。我們在樹下吃午餐。",qs:["這個班級去了哪裡？","哪一種動物有長長的脖子？"]},
  "Tom's New Bike":{tx:"Tom 有一台新的藍色腳踏車。他和妹妹一起騎車去學校。他總是戴安全帽，因為安全很重要。放學後，Tom 清潔腳踏車，並把它放進車庫。他以自己的腳踏車為傲。",qs:["Tom 的腳踏車是什麼顏色？","Tom 為什麼戴安全帽？"]},
  "The School Garden":{tx:"我們學校後面有一個小花園。學生們在那裡種花和蔬菜。我們每天早上澆水。夏天時，我們可以看到番茄和蝴蝶。這座花園讓我們的學校變得美麗。",qs:["花園在哪裡？","學生每天早上做什麼？"]},
  "A Birthday Party":{tx:"今天是 Lily 的生日。她的朋友們三點到她家。他們唱生日歌，吃巧克力蛋糕。Lily 從叔叔那裡收到一本故事書。大家玩遊戲並開心地笑。",qs:["今天是誰的生日？","Lily 收到什麼禮物？"]},
  "Helping Grandma":{tx:"Ben 星期天去看奶奶。奶奶正在廚房煮湯。Ben 幫忙洗胡蘿蔔和擺餐桌。午餐後，他讀一本書給奶奶聽。奶奶微笑著說謝謝。",qs:["Ben 什麼時候去看奶奶？","Ben 讀了什麼？"]},
  "The Lost Pencil":{tx:"Amy 找不到她最喜歡的鉛筆。她看了桌子底下，也找了書包裡面。她的朋友 Jack 在窗戶旁邊找到它。Amy 很開心並說謝謝。接著她用那支鉛筆畫了一顆星星。",qs:["Amy 正在找什麼？","是誰找到它的？"]},
  "After School":{tx:"放學後，Ken 去操場。他和同學踢足球。他們跑得很快，開心地大叫。五點時，Ken 回家並喝水。他在晚餐前完成作業。",qs:["Ken 玩什麼運動？","Ken 晚餐前做了什麼？"]},
  "The Power of Reading":{tx:"閱讀是學生可以培養的最重要技能之一。當你規律閱讀時，你會增加字彙量並強化批判性思考。研究顯示，為興趣而閱讀的學生在學校表現更好。",qs:["閱讀有助於提升什麼？","誰在學校表現更好？"]},
  "Social Media and Teens":{tx:"社群媒體已成為青少年生活的重要部分。許多學生每天花超過三小時在 Instagram 和 YouTube 上。雖然社群媒體幫助人們保持聯繫，但過多螢幕時間可能導致睡眠問題。專家建議設定每日使用時間限制。",qs:["青少年花多少時間在社群媒體上？","專家建議什麼？"]},
  "Bubble Tea History":{tx:"珍珠奶茶於 1980 年代在台灣被發明。一位茶館老闆把粉圓加入冰茶中。這種飲料很快在台灣流行起來，並傳到其他國家。今天，世界各地都可以找到珍珠奶茶店。",qs:["珍珠奶茶在哪裡被發明？","珍珠奶茶是什麼時候被發明的？"]},
  "A Greener School":{tx:"Green Valley 國中的學生開始了一項回收計畫。每間教室都有放紙張、瓶子和罐子的箱子。每週結束時，志工會收集箱子並記錄數量。這項計畫幫助學生了解小習慣也能保護環境。",qs:["學生開始了什麼計畫？","志工記錄什麼？"]},
  "Learning a New Skill":{tx:"Kevin 想學彈吉他。一開始，他的手指會痛，歌曲聽起來也很奇怪。然而，他每天練習二十分鐘。兩個月後，他可以為家人彈一首簡單的歌。他學到進步需要耐心。",qs:["Kevin 學了什麼技能？","他學到了什麼道理？"]},
  "The Night Market":{tx:"台灣夜市以食物、遊戲和友善的人群聞名。遊客可以嘗試臭豆腐、炸雞和果汁。有些人去那裡買衣服或玩小遊戲。夜市不只是吃東西的地方，也是體驗在地文化的地方。",qs:["夜市以什麼聞名？","人們可以在那裡體驗什麼？"]},
  "A Team Project":{tx:"Mia 的自然科學小組必須用紙和膠帶做一座小橋。一開始，大家有不同想法，並同時說話。老師請他們先聽別人說完再發言。當他們清楚分配工作後，小組做得更快，也做出一座堅固的橋。",qs:["這個小組做了什麼？","什麼幫助小組做得更快？"]},
  "Public Transportation":{tx:"搭公車和火車可以減少交通和空氣污染。在忙碌的城市裡，大眾運輸也幫助人們節省時間，因為他們不需要找停車位。雖然尖峰時間可能很擁擠，但它仍然是許多通勤者的重要選擇。",qs:["大眾運輸可以減少什麼？","什麼時候可能會很擁擠？"]},
  "Online Learning":{tx:"線上學習給學生更多彈性。他們可以複習影片、暫停課程，並在家學習。然而，學生也需要自制力，因為遊戲和訊息很容易讓他們分心。好的學習計畫可以幫助他們保持專注。",qs:["線上學習給學生什麼？","文中提到什麼問題？"]},
  "The School Concert":{tx:"學校音樂會星期五晚上在禮堂舉行。學生們演奏鋼琴、小提琴和鼓。音樂社在表演前練習了三週。當最後一首歌結束時，家長和老師大聲鼓掌。表演者感到緊張但也很驕傲。",qs:["音樂會在哪裡舉行？","表演者感覺如何？"]},
  "Ethics of AI":{tx:"隨著人工智慧融入日常生活，倫理問題也隨之出現。其中一個擔憂是演算法偏見，也就是人工智慧延續訓練資料中的偏見。此外，自動化系統造成的勞工取代，也帶來前所未有的經濟挑戰，需要審慎的政策回應。",qs:["什麼是演算法偏見？","自動化帶來的挑戰是什麼？"]},
  "Procrastination Psychology":{tx:"拖延並不只是懶惰。研究指出，拖延是一種情緒調節問題。當任務引發負面情緒時，大腦會透過逃避來尋求舒緩。認知行為策略，例如把任務拆成較小的步驟，已被證實有效。",qs:["拖延主要是什麼問題？","什麼方法有幫助？"]},
  "Renewable Energy Future":{tx:"轉向再生能源是現代歷史中最重要的轉變之一。太陽能和風力發電的成本已大幅下降。然而，它們間歇性的特質帶來電網穩定性的挑戰。能源儲存技術對解決這個限制至關重要。",qs:["太陽能和風力的成本如何變化？","什麼是至關重要的？"]},
  "Digital Privacy":{tx:"隨著人們依賴線上服務，數位隱私變得越來越複雜。應用程式常收集位置資料、瀏覽行為和個人偏好。雖然這些資料能提升便利性，但如果公司缺乏透明度，也可能被濫用。使用者需要提高意識，也需要更強的法律保護。",qs:["為什麼資料收集可能有用？","文中提到什麼保護？"]},
  "Urban Heat Islands":{tx:"大城市通常比附近鄉村地區更熱，因為混凝土、柏油和建築物會吸收熱量。這種現象稱為都市熱島效應。種樹、建造綠屋頂和使用反光材料都可以減少這個問題，讓城市更宜居。",qs:["為什麼城市比較熱？","什麼可以減少這個問題？"]},
  "Media Literacy":{tx:"在資訊無窮無盡的時代，媒體識讀非常重要。讀者必須評估來源、檢查證據，並注意情緒化語言。假消息常常傳得很快，因為它們令人驚訝或害怕。謹慎的讀者在分享前會先停下來，並思考誰會從這則訊息中受益。",qs:["謹慎的讀者應該檢查什麼？","為什麼假消息傳得很快？"]},
  "The Value of Sleep":{tx:"睡眠不只是活動的休息時間；它是一個支持記憶、情緒平衡和身體修復的生物過程。青少年常因作業、手機和過早的上學時間而睡眠不足。因此，改善睡眠習慣能同時提升學習與健康。",qs:["睡眠支持什麼？","為什麼青少年可能睡太少？"]},
  "Cultural Preservation":{tx:"文化保存不只是保護老建築。它包含語言、節慶、工藝、歌曲和日常傳統。當社群保存文化時，年輕世代會獲得身分認同感。然而，保存不應讓文化停滯不前；活的傳統可以在保留意義的同時繼續調整。",qs:["文化保存包含什麼？","文化保存應避免什麼？"]},
  "Ocean Plastic":{tx:"塑膠污染威脅海洋生態系，因為許多塑膠物品不容易分解。小塑膠碎片可能被魚吃下，並進入食物鏈。政府、企業和消費者都有角色要扮演，從禁止一次性產品到選擇可重複使用的容器都包括在內。",qs:["為什麼塑膠很危險？","文中建議的一項行動是什麼？"]},
  "Resilience in Failure":{tx:"失敗常被視為最終結果，但它也可以是一種回饋來源。具有韌性的人會分析哪裡出錯、調整策略，然後再試一次。這種態度不會讓失敗變得愉快，但能讓失敗對長期成長有用。",qs:["失敗如何能有用？","有韌性的人會做什麼？"]},
};
// ═══ SONGS ═════════════════════════════════════════════════════════
const SONGS = {
  elementary: [
    {
      id:"elementary-step-by-step",
      title:"Step by Step",
      zhTitle:"一步一步來",
      audio:"/audio/songs/elementary-step-by-step.mp3",
      theme:"學英文信心",
      level:"小學",
      lines:[
        {sec:"Verse 1"},
        {t:9,en:"Good morning, hello,",zh:"早安，你好。"},
        {t:10,en:"I am ready, let's go.",zh:"我準備好了，我們出發吧。"},
        {t:13,en:"I can read, I can write,",zh:"我會閱讀，我會書寫。"},
        {t:15,en:"I can try with all my might.",zh:"我會盡全力嘗試。"},
        {sec:"Pre-Chorus"},
        {t:17,en:"One word, two words,",zh:"一個單字，兩個單字。"},
        {t:19,en:"Say them loud and clear.",zh:"大聲又清楚地說出來。"},
        {t:22,en:"Every day I practice,",zh:"我每天練習。"},
        {t:24,en:"English has no fear.",zh:"英文一點也不可怕。"},
        {sec:"Chorus"},
        {t:35,en:"Step by step, I learn today,",zh:"一步一步，我今天學習。"},
        {t:37,en:"Sing with me, let's find our way.",zh:"和我一起唱，找到我們的方法。"},
        {t:39,en:"Word by word, I grow so strong,",zh:"一字一句，我變得更強。"},
        {t:41,en:"English learning all day long.",zh:"一整天都在學英文。"},
        {sec:"Verse 2"},
        {t:48,en:"I can listen, I can speak,",zh:"我會聽，我會說。"},
        {t:50,en:"I get better every week.",zh:"我每週都變得更好。"},
        {t:52,en:"If I make a small mistake,",zh:"如果我犯了一個小錯。"},
        {t:54,en:"I just smile and try again.",zh:"我就微笑，然後再試一次。"},
        {sec:"Chorus"},
        {t:62,en:"Step by step, I learn today,",zh:"一步一步，我今天學習。"},
        {t:63,en:"Sing with me, let's find our way.",zh:"和我一起唱，找到我們的方法。"},
        {sec:"Outro"},
        {t:66,en:"Read and write,",zh:"閱讀與書寫。"},
        {t:68,en:"Speak and sing,",zh:"開口說，也開口唱。"},
        {t:69,en:"English gives my heart new wings.",zh:"英文讓我的心長出新的翅膀。"},
      ],
      vocab:["ready","read","write","practice","learn","strong","listen","speak","mistake","again"],
      patterns:[
        {p:"I can + V",ex:"I can read.",zh:"我可以閱讀。"},
        {p:"try with all my might",ex:"I can try with all my might.",zh:"我會盡全力嘗試。"},
        {p:"word by word",ex:"Word by word, I grow strong.",zh:"一字一句，我變得更強。"},
      ],
    },
    {
      id:"elementary-my-happy-day",
      title:"My Happy Day",
      zhTitle:"我的快樂一天",
      audio:"/audio/songs/elementary-my-happy-day.mp3",
      theme:"日常生活句型",
      level:"小學",
      lines:[
        {sec:"Verse 1"},
        {t:1,en:"I wake up in the morning,",zh:"我早上醒來。"},
        {t:4,en:"I wash my face and smile.",zh:"我洗臉，然後微笑。"},
        {t:7,en:"I eat my breakfast slowly,",zh:"我慢慢吃早餐。"},
        {t:10,en:"Then I walk to school a while.",zh:"然後我走一段路去學校。"},
        {sec:"Pre-Chorus"},
        {t:14,en:"What do you do every day?",zh:"你每天做什麼？"},
        {t:17,en:"I read, I write, I play.",zh:"我閱讀，我書寫，我玩耍。"},
        {t:20,en:"Where do you go after class?",zh:"下課後你去哪裡？"},
        {t:22,en:"I go home and say hooray.",zh:"我回家並開心歡呼。"},
        {sec:"Chorus"},
        {t:26,en:"This is my happy, happy day,",zh:"這是我快樂、快樂的一天。"},
        {t:29,en:"I learn and laugh along the way.",zh:"我一路學習，也一路歡笑。"},
        {t:32,en:"I can say, \"How are you?\"",zh:"我會說：「你好嗎？」"},
        {t:35,en:"I am fine, and how about you?",zh:"我很好，那你呢？"},
        {sec:"Verse 2"},
        {t:40,en:"I help my mom after dinner,",zh:"晚餐後我幫媽媽。"},
        {t:43,en:"I put my books away.",zh:"我把書收好。"},
        {t:46,en:"I brush my teeth before I sleep,",zh:"睡覺前我刷牙。"},
        {t:47,en:"Good night, see you another day.",zh:"晚安，明天再見。"},
        {sec:"Chorus"},
        {t:51,en:"This is my happy, happy day,",zh:"這是我快樂、快樂的一天。"},
        {t:54,en:"I learn and laugh along the way.",zh:"我一路學習，也一路歡笑。"},
        {t:58,en:"I can say, \"How are you?\"",zh:"我會說：「你好嗎？」"},
        {t:60,en:"I am fine, and how about you?",zh:"我很好，那你呢？"},
        {sec:"Outro"},
        {t:64,en:"Morning, noon, and night,",zh:"早上、中午和晚上。"},
        {t:66,en:"I try my best today.",zh:"今天我盡力做到最好。"},
        {t:68,en:"Every little English word,",zh:"每一個小小的英文單字。"},
        {t:70,en:"Helps me on my way.",zh:"都幫助我向前走。"},
      ],
      vocab:["wake","wash","breakfast","school","after","home","dinner","brush","sleep","night"],
      patterns:[
        {p:"I + V + every day",ex:"I read every day.",zh:"我每天閱讀。"},
        {p:"What do you do...?",ex:"What do you do after class?",zh:"下課後你做什麼？"},
        {p:"before + I + V",ex:"I brush my teeth before I sleep.",zh:"我睡前刷牙。"},
      ],
    },
    {
      id:"elementary-animal-friends",
      title:"Animal Friends",
      zhTitle:"動物朋友",
      audio:"/audio/songs/elementary-animal-friends.mp3",
      theme:"動物與動作單字",
      level:"小學",
      lines:[
        {sec:"Verse 1"},
        {t:4,en:"A cat can jump, jump, jump,",zh:"貓可以跳、跳、跳。"},
        {t:7,en:"A dog can run with me.",zh:"狗可以和我一起跑。"},
        {t:10,en:"A bird can fly up high,",zh:"鳥可以飛得高高的。"},
        {t:13,en:"A fish can swim in the sea.",zh:"魚可以在海裡游泳。"},
        {sec:"Pre-Chorus"},
        {t:17,en:"What can the animals do?",zh:"動物們會做什麼？"},
        {t:20,en:"Move your body, try it too.",zh:"動動你的身體，也試試看。"},
        {t:23,en:"Jump and run, swim and fly,",zh:"跳和跑，游泳和飛翔。"},
        {t:26,en:"Wave your hands up to the sky.",zh:"把手揮向天空。"},
        {sec:"Chorus"},
        {t:30,en:"Animal friends, come play with me,",zh:"動物朋友，來和我玩。"},
        {t:33,en:"In the park and by the tree.",zh:"在公園裡，在樹旁邊。"},
        {t:36,en:"Big or small, fast or slow,",zh:"不論大或小，快或慢。"},
        {t:39,en:"English words help us grow.",zh:"英文單字幫助我們成長。"},
        {sec:"Verse 2"},
        {t:47,en:"A rabbit hops across the grass,",zh:"兔子跳過草地。"},
        {t:50,en:"A monkey climbs the tree.",zh:"猴子爬上樹。"},
        {t:52,en:"A horse can walk and gallop,",zh:"馬可以走路和奔跑。"},
        {t:54,en:"A bee can buzz by me.",zh:"蜜蜂可以在我旁邊嗡嗡叫。"},
        {sec:"Outro"},
        {t:60,en:"Jump like a cat,",zh:"像貓一樣跳。"},
        {t:62,en:"Run like a dog,",zh:"像狗一樣跑。"},
        {t:64,en:"Fly like a bird,",zh:"像鳥一樣飛。"},
        {t:66,en:"Sing this song with me.",zh:"和我一起唱這首歌。"},
      ],
      vocab:["cat","jump","dog","run","bird","fly","fish","swim","rabbit","monkey","horse","bee"],
      patterns:[
        {p:"A/An + animal + can + V",ex:"A bird can fly.",zh:"一隻鳥會飛。"},
        {p:"like a + animal",ex:"Jump like a cat.",zh:"像貓一樣跳。"},
        {p:"Big or small",ex:"Big or small, we can learn.",zh:"不論大或小，我們都能學。"},
      ],
    },
  ],
  junior: JUNIOR_SONGS,
  senior: SENIOR_SONGS,
};
// ═══ DICTATION SENTENCES ════════════════════════════════════════════
const DICT = {
  elementary: ["I like to eat apples.","She is my best friend.","The dog is playing in the park.","We go to school every day.","My mother reads a book.","He runs very fast.","There are three cats.","I am happy today.","The sun is very big.","Please drink some water."],
  junior: ["She has been to Japan twice.","We should protect the environment.","He suggested that I study harder.","The book which I read was interesting.","Although it was raining, we went out.","Students participate in various activities.","Communication is very important.","I have lived here for five years.","The cake was baked by my mother.","Practice can improve your English."],
  senior: ["The policy is highly controversial among experts.","Climate change is a global phenomenon.","His health began to deteriorate rapidly.","The report provides a comprehensive analysis.","We need sustainable energy solutions.","The instructions were ambiguous and confusing.","Technology can facilitate effective learning.","The pandemic caused unprecedented challenges worldwide.","This medicine can alleviate the pain significantly.","The system uses sophisticated technology."],
};
// ═══ SCRAMBLE SENTENCES ═════════════════════════════════════════════
const SCRAM = {
  elementary: [{s:"I like to eat apples",h:"我喜歡吃蘋果"},{s:"She is a good student",h:"她是好學生"},{s:"The cat sleeps on the sofa",h:"貓睡在沙發上"},{s:"We play in the park",h:"我們在公園玩"},{s:"He goes to school every day",h:"他每天去上學"}],
  junior: [{s:"She has been to Japan twice",h:"她去過日本兩次"},{s:"The book which I read was interesting",h:"我讀的那本書很有趣"},{s:"We should protect the environment",h:"我們應該保護環境"},{s:"He suggested that I study harder",h:"他建議我更用功"},{s:"Although it rained we went out",h:"雖然下雨我們還是出去了"}],
  senior: [{s:"The policy is highly controversial among experts",h:"這項政策在專家間極具爭議"},{s:"Climate change is a global phenomenon that affects everyone",h:"氣候變遷是影響每個人的全球現象"},{s:"We need sustainable energy solutions for the future",h:"我們需要未來的永續能源方案"},{s:"The report provides a comprehensive analysis of the data",h:"報告提供了數據的全面分析"},{s:"Technology can facilitate effective learning in schools",h:"科技可以促進學校的有效學習"}],
};
// ═══ ACHIEVEMENTS ═══════════════════════════════════════════════════
const ACH_DEFS = [
  {id:"first_card",name:"初心者",desc:"完成第一次 SRS 練習",icon:"🌟",check:s=>s.srsRounds>=1},
  {id:"streak3",name:"三日不懈",desc:"連續學習 3 天",icon:"🔥",check:s=>s.streak>=3},
  {id:"streak7",name:"一週達人",desc:"連續學習 7 天",icon:"💎",check:s=>s.streak>=7},
  {id:"xp100",name:"經驗滿載",desc:"累積 100 XP",icon:"⭐",check:s=>s.xp>=100},
  {id:"xp500",name:"學霸之路",desc:"累積 500 XP",icon:"🏆",check:s=>s.xp>=500},
  {id:"quiz_perfect",name:"零失誤",desc:"測驗拿滿分",icon:"💯",check:s=>s.perfectQuiz>=1},
  {id:"dict5",name:"聽力新手",desc:"完成 5 次聽寫",icon:"🎧",check:s=>s.dictDone>=5},
  {id:"scram5",name:"語序大師",desc:"完成 5 次句子重組",icon:"🧩",check:s=>s.scramDone>=5},
];


// ═══ PET SYSTEM (寵物扭蛋系統) ══════════════════════════════════════
const PETS = {
  // N (普通) - 60% - egg needs 10 tasks
  N:[
    {id:"bunny",name:"小兔兔",emoji:"🐰",words:["rabbit","carrot","hop","jump","cute"],story:"愛吃胡蘿蔔的小兔子"},
    {id:"chick",name:"小雞",emoji:"🐥",words:["chick","egg","farm","yellow","tweet"],story:"剛出生的毛茸茸小雞"},
    {id:"puppy",name:"小狗狗",emoji:"🐶",words:["dog","bark","tail","play","friend"],story:"忠心的好夥伴"},
    {id:"kitty",name:"小貓咪",emoji:"🐱",words:["cat","meow","fish","soft","purr"],story:"優雅的小貓"},
    {id:"piggy",name:"小豬豬",emoji:"🐷",words:["pig","pink","mud","happy","cute"],story:"粉紅色的小豬"},
    {id:"froggy",name:"小青蛙",emoji:"🐸",words:["frog","pond","jump","green","wet"],story:"會唱歌的小青蛙"},
    {id:"hamster",name:"小倉鼠",emoji:"🐹",words:["hamster","seed","small","wheel","cute"],story:"喜歡跑滾輪的小倉鼠"},
    {id:"turtle",name:"小烏龜",emoji:"🐢",words:["turtle","slow","shell","walk","green"],story:"背著硬殼慢慢前進的朋友"},
    {id:"duckling",name:"小鴨鴨",emoji:"🦆",words:["duck","swim","yellow","quack","water"],story:"喜歡在水邊學英文的小鴨"},
    {id:"lamb",name:"小綿羊",emoji:"🐑",words:["lamb","wool","farm","soft","white"],story:"有柔軟羊毛的小綿羊"},
  ],
  // R (稀有) - 25%
  R:[
    {id:"panda",name:"熊貓寶寶",emoji:"🐼",words:["panda","bamboo","china","black","white"],story:"來自竹林的珍貴寶貝"},
    {id:"koala",name:"無尾熊",emoji:"🐨",words:["koala","tree","sleep","hug","australia"],story:"愛睡覺的小萌物"},
    {id:"fox",name:"小狐狸",emoji:"🦊",words:["fox","clever","forest","orange","wild"],story:"聰明機靈的狐狸"},
    {id:"owl",name:"貓頭鷹",emoji:"🦉",words:["owl","night","wise","forest","hoot"],story:"智慧之鳥"},
    {id:"penguin",name:"企鵝",emoji:"🐧",words:["penguin","ice","swim","cold","waddle"],story:"南極來的朋友"},
    {id:"deer",name:"森林小鹿",emoji:"🦌",words:["deer","forest","gentle","grass","antler"],story:"在森林裡安靜奔跑的小鹿"},
    {id:"seal",name:"小海豹",emoji:"🦭",words:["seal","snow","swim","clap","cold"],story:"會拍手鼓勵你的冰原朋友"},
    {id:"parrot",name:"小鸚鵡",emoji:"🦜",words:["parrot","talk","colorful","wing","repeat"],story:"喜歡跟著你重複英文的小鸚鵡"},
    {id:"squirrel",name:"小松鼠",emoji:"🐿️",words:["squirrel","nut","tree","quick","tail"],story:"動作很快、愛收集堅果的小松鼠"},
  ],
  // SR (超稀有) - 12%
  SR:[
    {id:"unicorn",name:"獨角獸",emoji:"🦄",words:["unicorn","magic","rainbow","dream","fantasy"],story:"傳說中的夢幻生物"},
    {id:"dragon",name:"小龍",emoji:"🐲",words:["dragon","fire","legend","power","ancient"],story:"強大的東方神獸"},
    {id:"whale",name:"小鯨魚",emoji:"🐳",words:["whale","ocean","deep","big","blue"],story:"海洋的溫柔巨人"},
    {id:"pegasus",name:"飛馬",emoji:"🪽",words:["pegasus","wing","fly","cloud","brave","myth"],story:"展開翅膀飛過雲端的神話夥伴"},
    {id:"griffin",name:"獅鷲獸",emoji:"🦅",words:["griffin","eagle","lion","guard","legend","brave"],story:"守護寶藏與知識的勇敢幻獸"},
    {id:"seaotter",name:"海獺守護者",emoji:"🦦",words:["otter","ocean","shell","clever","float","guard"],story:"抱著貝殼漂在海上的聰明守護者"},
  ],
  // SSR (極稀有) - 3%
  SSR:[
    {id:"phoenix",name:"鳳凰",emoji:"🔥",words:["phoenix","fire","reborn","legend","golden","eternal"],story:"浴火重生的傳說之鳥"},
    {id:"celestial",name:"聖獸",emoji:"✨",words:["celestial","divine","sacred","miracle","power","legend"],story:"守護學習者的神獸"},
    {id:"moonlion",name:"月光獅",emoji:"🦁",words:["moon","lion","shine","royal","courage","legend"],story:"在月光下守護勇氣的王者"},
    {id:"aurorafox",name:"極光狐",emoji:"🦊",words:["aurora","fox","light","north","mystery","dream"],story:"穿梭在極光中的神祕狐狸"},
  ],
};

const RARITY_INFO={
  N:{rate:60,color:"#9c9a92",bg:"#f3f2ee",label:"普通",stars:"⭐"},
  R:{rate:25,color:"#185FA5",bg:"#E6F1FB",label:"稀有",stars:"⭐⭐"},
  SR:{rate:12,color:"#7B61FF",bg:"#EDE9FE",label:"超稀有",stars:"⭐⭐⭐"},
  SSR:{rate:3,color:"#EF9F27",bg:"#FFF3CD",label:"極稀有",stars:"⭐⭐⭐⭐"},
};
const RARITY_ORDER={N:0,R:1,SR:2,SSR:3};
const GACHA_SR_PITY=20;

const EGG_COST=50; // coins per gacha pull
const EGG_HATCH_TASKS={N:10,R:15,SR:25,SSR:40}; // tasks needed to hatch
const DUPLICATE_EGG_PROGRESS={N:4,R:6,SR:10,SSR:16}; // duplicate egg merges into hatch progress
const DUPLICATE_PET_REWARD={
  N:{exp:40,bond:4},R:{exp:70,bond:7},SR:{exp:120,bond:12},SSR:{exp:220,bond:22},
};

function getDuplicatePetReward(rarity,dupes=1){
  const base=DUPLICATE_PET_REWARD[rarity]||DUPLICATE_PET_REWARD.N;
  return{exp:base.exp*dupes,bond:base.bond*dupes,dupes};
}

function applyDuplicatePetReward(pet,reward,now=new Date().toISOString()){
  let updated={...pet,dupes:(pet.dupes||0)+(reward.dupes||1),exp:(pet.exp||0)+(reward.exp||0),bond:(pet.bond||0)+(reward.bond||0),lastUpdate:now};
  let guard=0;
  while(updated.exp>=(updated.level||1)*100&&guard<20){
    const before=updated.level;
    updated=levelUpPet(updated);
    if(updated.level===before)break;
    guard++;
  }
  return updated;
}

const DUPLICATE_ENERGY_MILESTONES=[1,3,6,10,15,25];
function getDuplicateEnergyInfo(pet){
  const dupes=pet?.dupes||0;
  const copies=dupes+1;
  const current=DUPLICATE_ENERGY_MILESTONES.filter(n=>dupes>=n).at(-1)||0;
  const next=DUPLICATE_ENERGY_MILESTONES.find(n=>dupes<n)||null;
  const pct=next?Math.round(((dupes-current)/(next-current))*100):100;
  return{
    dupes,
    copies,
    current,
    next,
    pct:Math.max(0,Math.min(100,pct)),
    adventureBonus:dupes*3,
    growthBonus:dupes*10,
    label:dupes>=25?"傳說共鳴":dupes>=15?"極限共鳴":dupes>=10?"高階共鳴":dupes>=6?"穩定共鳴":dupes>=3?"成長共鳴":dupes>=1?"初階共鳴":"尚未共鳴",
  };
}

function rollRarity(){
  const r=Math.random()*100;
  if(r<3)return"SSR";
  if(r<15)return"SR";
  if(r<40)return"R";
  return"N";
}
function randomPet(rarity){
  const pool=PETS[rarity];
  return pool[Math.floor(Math.random()*pool.length)];
}

// ═══ PET FOODS & ITEMS (寵物食物與道具) ════════════════════════════
const PET_FOODS = [
  {id:"apple",name:"蘋果",emoji:"🍎",cost:10,feed:15,word:"apple"},
  {id:"banana",name:"香蕉",emoji:"🍌",cost:10,feed:15,word:"banana"},
  {id:"fish",name:"魚",emoji:"🐟",cost:15,feed:25,word:"fish"},
  {id:"meat",name:"肉",emoji:"🍖",cost:20,feed:30,word:"meat"},
  {id:"milk",name:"牛奶",emoji:"🥛",cost:12,feed:20,word:"milk"},
  {id:"bread",name:"麵包",emoji:"🍞",cost:8,feed:12,word:"bread"},
  {id:"cake",name:"蛋糕",emoji:"🍰",cost:30,feed:40,word:"cake"},
  {id:"carrot",name:"胡蘿蔔",emoji:"🥕",cost:8,feed:12,word:"carrot"},
];

const PET_ACTIONS = {
  feed: {icon:"🍖",name:"餵食",word:"feed",stat:"hunger",desc:"寵物餓了，餵他吃東西"},
  clean: {icon:"🛁",name:"洗澡",word:"wash",stat:"clean",desc:"寵物髒了，幫他洗個澡"},
  play: {icon:"🎾",name:"玩耍",word:"play",stat:"bond",desc:"陪寵物玩，增加親密度"},
  sleep: {icon:"😴",name:"睡覺",word:"sleep",stat:"energy",desc:"讓寵物休息恢復體力"},
  study: {icon:"📚",name:"讀書",word:"study",stat:"bond",desc:"跟寵物一起學單字"},
};

// Fun English sentences for actions
const ACTION_PROMPTS = {
  feed: ["I feed my pet.","My pet is hungry.","Eat your food!","Yummy yummy!","Time to eat!"],
  clean: ["Let's take a bath!","You are so dirty.","Clean and fresh!","Soap and water.","All clean now!"],
  play: ["Let's play together!","My pet is happy.","Catch the ball!","So much fun!","Good pet!"],
  sleep: ["Good night, sleep well.","Sweet dreams.","Rest now.","Close your eyes.","Sleep tight!"],
  study: ["Learn with me!","Reading is fun.","Smart pet!","Let's read a book.","Knowledge is power."],
};

// Pet stat decay (per hour, percentage)

// ═══ PET GROWTH STAGES (寵物成長階段) ═══════════════════════════════
// Each pet goes through 4 stages: egg → baby → adult → evolved
// Stage is determined by level: 1-3 baby, 4-9 adult, 10+ evolved
const STAGE_NAMES={baby:"幼寵",adult:"成寵",evolved:"進化形態"};
function getPetStage(pet){
  if(!pet||!pet.level)return"baby";
  if(pet.level>=10)return"evolved";
  if(pet.level>=4)return"adult";
  return"baby";
}

// Size multiplier per stage (for display)
function getPetSize(stage){
  return stage==="evolved"?180:stage==="adult"?155:125;
}

// Stage-specific sayings (English)
const STAGE_SAYINGS={
  baby:["Goo goo!","Feed me!","I'm small.","Pick me up!","Love me!","Cute!","Tiny paws!","Baby steps!"],
  adult:["I love you!","Let's play!","I'm strong!","Teach me more!","English is fun!","Best friend!","Adventure time!","Ready to learn!"],
  evolved:["I am powerful!","Together we grow!","Master and pet!","We are champions!","Knowledge is power!","I protect you!","Legendary bond!"],
};

// Time-based greetings (overrides stage sayings when appropriate)
const TIME_GREETINGS={
  morning:["Good morning!","Rise and shine!","What a beautiful day!","Morning sunshine!","Time to learn!"],
  noon:["Time for lunch!","I'm hungry!","Let's eat!","Noon already?","Hungry hungry!"],
  afternoon:["Let's play!","Nice afternoon!","Study time?","Snack time?","Having fun?"],
  evening:["Good evening!","Long day huh?","Let's relax!","Dinner soon?","Sunset is pretty!"],
  night:["Good night!","I'm sleepy...","Bedtime soon!","Sweet dreams!","See you tomorrow!"],
  sleeping:["Zzz...","Dreaming...","So tired..."],
};

function getTimeOfDay(){
  const h=new Date().getHours();
  if(h>=22||h<7)return"sleeping";
  if(h<10)return"morning";
  if(h<13)return"noon";
  if(h<17)return"afternoon";
  if(h<20)return"evening";
  return"night";
}

// ═══ DAILY TASKS (每日任務 - 跟寵物連動) ════════════════════════════
const DAILY_TASK_DEFS=[
  {id:"srs_5",icon:"🃏",name:"複習 5 個單字",desc:"完成 5 張 SRS 卡片",target:5,reward:{coins:20,exp:15},statKey:"srsToday"},
  {id:"quiz_3",icon:"📝",name:"答對 3 題測驗",desc:"測驗模式連對 3 題",target:3,reward:{coins:15,exp:10},statKey:"quizToday"},
  {id:"speak_1",icon:"🗣️",name:"口說練習 1 次",desc:"完成一次口說練習",target:1,reward:{coins:25,exp:20},statKey:"speakToday"},
  {id:"feed_1",icon:"🍖",name:"餵食寵物 1 次",desc:"給你的寵物餵食",target:1,reward:{coins:10,exp:5},statKey:"feedToday"},
  {id:"play_1",icon:"🎾",name:"陪寵物玩 1 次",desc:"陪寵物玩耍",target:1,reward:{coins:10,exp:5},statKey:"playToday"},
  {id:"clean_1",icon:"🛁",name:"幫寵物洗澡",desc:"保持寵物乾淨",target:1,reward:{coins:10,exp:5},statKey:"cleanToday"},
];

// ═══ RANDOM PET EVENTS (隨機事件 - 英文情境對話) ══════════════════════
// Pet randomly asks questions; player selects the right English response
const PET_EVENTS=[
  {q:"我餓了！你會說 'I am hungry' 嗎？",choices:["I am hungry.","I am happy.","I am tired."],correct:0,reward:{bond:5,coins:5}},
  {q:"我好想玩，要用英文邀請我！",choices:["Goodbye!","Let's play!","Good night!"],correct:1,reward:{bond:8,coins:8}},
  {q:"天氣變冷了，你會說 '好冷' 嗎？",choices:["It's hot.","It's cold.","It's raining."],correct:1,reward:{bond:5,coins:5}},
  {q:"我想睡覺了，跟我說晚安！",choices:["Good morning!","Good night!","Hello!"],correct:1,reward:{bond:8,coins:8}},
  {q:"主人我愛你，你要怎麼回答？",choices:["I hate you.","I love you too!","Goodbye."],correct:1,reward:{bond:15,coins:10}},
  {q:"今天學了什麼新單字？告訴我一個！",choices:["I don't know.","I learned a word today.","Nothing."],correct:1,reward:{bond:10,coins:10}},
  {q:"我想吃東西，哪個是食物？",choices:["table","apple","chair"],correct:1,reward:{bond:5,coins:5}},
  {q:"我是什麼顏色？",choices:["The sky is blue.","What is your color?","Tell me about yourself."],correct:2,reward:{bond:8,coins:8}},
  {q:"我好開心，你會說 'happy' 嗎？",choices:["sad","angry","happy"],correct:2,reward:{bond:5,coins:5}},
  {q:"主人今天開心嗎？用英文告訴我！",choices:["I am happy today.","The cat is black.","My name is Pet."],correct:0,reward:{bond:10,coins:10}},
];

// ═══ BOND REWARDS (親密度獎勵 - 羈絆系統) ══════════════════════════
const PET_ADVENTURE_SKILLS={
  wordSpark:{id:"wordSpark",emoji:"✨",name:"Word Spark",zh:"單字火花",desc:"答對單字題時提高攻擊力。",power:10,words:["word","read","study","wise","book","repeat"]},
  braveGuard:{id:"braveGuard",emoji:"🛡️",name:"Brave Guard",zh:"勇氣守護",desc:"答錯時降低受到的傷害。",power:8,words:["brave","strong","panda","dog","horse","lion","griffin","guard","deer"]},
  quickStep:{id:"quickStep",emoji:"⚡",name:"Quick Step",zh:"快速步伐",desc:"每一關開始時提高先攻傷害。",power:9,words:["run","jump","fast","rabbit","fox","quick","squirrel","wheel"]},
  melodyHeal:{id:"melodyHeal",emoji:"🎵",name:"Melody Heal",zh:"旋律治癒",desc:"過關後幫隊伍回復生命。",power:7,words:["sing","bird","song","river","whale","parrot","duck","otter","seal"]},
  magicLeaf:{id:"magicLeaf",emoji:"🌿",name:"Magic Leaf",zh:"魔法之葉",desc:"高階寵物的穩定魔法攻擊。",power:13,words:["magic","forest","dragon","unicorn","phoenix","celestial","pegasus","aurora","moon","legend"]},
};

const PET_ADVENTURE_SKILL_VISUALS={
  wordSpark:{color:"#7C3AED",bg:"#F3E8FF",glow:"rgba(124,58,237,.42)",effect:"✨",line:"released a Word Spark!"},
  braveGuard:{color:"#2563EB",bg:"#DBEAFE",glow:"rgba(37,99,235,.38)",effect:"🛡️",line:"raised Brave Guard!"},
  quickStep:{color:"#D97706",bg:"#FEF3C7",glow:"rgba(217,119,6,.42)",effect:"⚡",line:"dashed with Quick Step!"},
  melodyHeal:{color:"#DB2777",bg:"#FCE7F3",glow:"rgba(219,39,119,.36)",effect:"🎵",line:"sang Melody Heal!"},
  magicLeaf:{color:"#0F766E",bg:"#CCFBF1",glow:"rgba(15,118,110,.42)",effect:"🌿",line:"cast Magic Leaf!"},
};

const PET_ADVENTURE_SKILL_UNLOCKS={
  wordSpark:{level:1,label:"初始技能",learn:"所有寵物都能用基礎英文能量學會。"},
  quickStep:{level:3,label:"Lv.3 解鎖",learn:"多照顧、餵食、遊玩或冒險取得 XP 到 Lv.3。"},
  braveGuard:{level:5,label:"Lv.5 解鎖",learn:"寵物 Lv.5 後可學，適合保護隊伍。"},
  melodyHeal:{level:7,label:"Lv.7 解鎖",learn:"寵物 Lv.7 後可學，答對時能回復隊伍。"},
  magicLeaf:{level:10,label:"Lv.10 或稀有寵",learn:"Lv.10、SR/SSR，或冒險勝利掉落技能卡後可學。"},
};

const PET_ADVENTURE_STAGES=[
  {id:"forest",emoji:"🌲",name:"Forest Path",zh:"森林小徑",enemy:"Shadow Vine",enemyZh:"影藤",hint:"Read the question before you attack."},
  {id:"river",emoji:"💧",name:"River Bridge",zh:"河流木橋",enemy:"Mist Crab",enemyZh:"迷霧蟹",hint:"Choose the sentence that sounds natural."},
  {id:"cave",emoji:"🪨",name:"Echo Cave",zh:"回音洞穴",enemy:"Echo Bat",enemyZh:"回音蝙蝠",hint:"Grammar helps your pets hit harder."},
  {id:"tower",emoji:"🕯️",name:"Old Tower",zh:"古老高塔",enemy:"Clock Guard",enemyZh:"時鐘守衛",hint:"Look for time words and verbs."},
  {id:"garden",emoji:"🌼",name:"Moon Garden",zh:"月光花園",enemy:"Sleepy Thorn",enemyZh:"睡眠荊棘",hint:"Meaning matters more than speed."},
  {id:"sky",emoji:"⭐",name:"Star Gate",zh:"星光之門",enemy:"Night Sprite",enemyZh:"夜光精靈",hint:"Use your team skills together."},
];

const PET_ADVENTURE_BOSS={
  id:"boss",emoji:"👑",name:"Final Gate",zh:"最終魔王關",enemy:"Grammar Overlord",enemyZh:"文法魔王",boss:true,
  hint:"Use the right skill card. The boss is much stronger than normal enemies.",
};

const PET_ADVENTURE_ENEMY_ICONS={
  forest:"🌿",
  river:"🦀",
  cave:"🦇",
  tower:"🕰️",
  garden:"🌵",
  sky:"🌌",
  boss:"👹",
};

let _petAdventureQuestionsPromise=null;
function loadPetAdventureQuestions(){
  if(!_petAdventureQuestionsPromise){
    _petAdventureQuestionsPromise=import("./data/petAdventureQuestions.js");
  }
  return _petAdventureQuestionsPromise;
}

const PET_ADVENTURE_RECENT_QUESTION_KEY="englishgo_pet_adventure_recent_questions";
const PET_ADVENTURE_PROGRESS_KEY="englishgo_pet_adventure_progress";
const PET_ADVENTURE_BOSS_REQUIRED_CLEARS=3;

function getAdventureQuestionSource(lv,questionData){
  const {PET_ADVENTURE_QUESTIONS,PET_ADVENTURE_EXTRA_QUESTIONS}=questionData;
  return [
    ...(PET_ADVENTURE_QUESTIONS[lv]||PET_ADVENTURE_QUESTIONS.elementary),
    ...(PET_ADVENTURE_EXTRA_QUESTIONS[lv]||PET_ADVENTURE_EXTRA_QUESTIONS.elementary||[]),
  ];
}

function getAdventureQuestionKey(q){
  return String(q?.id||q?.q||"").toLowerCase().replace(/\s+/g," ").trim();
}

function uniqueAdventureQuestions(questions){
  const seen=new Set();
  return questions.filter(q=>{
    const key=getAdventureQuestionKey(q);
    if(!key||seen.has(key))return false;
    seen.add(key);
    return true;
  });
}

function keepLatestAdventureQuestionKeys(keys,limit=18){
  const seen=new Set();
  const result=[];
  for(let i=keys.length-1;i>=0;i--){
    const key=String(keys[i]||"").trim();
    if(!key||seen.has(key))continue;
    seen.add(key);
    result.unshift(key);
    if(result.length>=limit)break;
  }
  return result;
}

function getRecentAdventureQuestionKeys(){
  try{
    if(typeof localStorage==="undefined")return[];
    const raw=JSON.parse(localStorage.getItem(PET_ADVENTURE_RECENT_QUESTION_KEY)||"[]");
    return Array.isArray(raw)?keepLatestAdventureQuestionKeys(raw):[];
  }catch{
    return[];
  }
}

function saveRecentAdventureQuestionKeys(keys){
  try{
    if(typeof localStorage==="undefined")return;
    localStorage.setItem(PET_ADVENTURE_RECENT_QUESTION_KEY,JSON.stringify(keepLatestAdventureQuestionKeys(keys)));
  }catch{}
}

function getPetAdventureProgress(lv){
  try{
    if(typeof localStorage==="undefined")return{clears:0,bossCharge:0,bossesDefeated:0};
    const all=JSON.parse(localStorage.getItem(PET_ADVENTURE_PROGRESS_KEY)||"{}");
    const key=lv||"elementary";
    const progress=all?.[key]||{};
    return{
      clears:Number(progress.clears)||0,
      bossCharge:Math.max(0,Math.min(PET_ADVENTURE_BOSS_REQUIRED_CLEARS,Number(progress.bossCharge)||0)),
      bossesDefeated:Number(progress.bossesDefeated)||0,
    };
  }catch{
    return{clears:0,bossCharge:0,bossesDefeated:0};
  }
}

function savePetAdventureProgress(lv,progress){
  try{
    if(typeof localStorage==="undefined")return;
    const all=JSON.parse(localStorage.getItem(PET_ADVENTURE_PROGRESS_KEY)||"{}");
    all[lv||"elementary"]=progress;
    localStorage.setItem(PET_ADVENTURE_PROGRESS_KEY,JSON.stringify(all));
  }catch{}
}

function isPetAdventureBossReady(progress){
  return (progress?.bossCharge||0)>=PET_ADVENTURE_BOSS_REQUIRED_CLEARS;
}

function getPetAdventureDifficulty(progress,bossReady=false){
  const clears=Number(progress?.clears)||0;
  const bosses=Number(progress?.bossesDefeated)||0;
  return Math.min(12,1+Math.floor(clears/2)+bosses+(bossReady?1:0));
}

function completePetAdventureProgress(progress,won,hadBoss){
  if(!won)return progress;
  const clears=(progress?.clears||0)+1;
  if(hadBoss){
    return{clears,bossCharge:0,bossesDefeated:(progress?.bossesDefeated||0)+1};
  }
  return{
    clears,
    bossCharge:Math.min(PET_ADVENTURE_BOSS_REQUIRED_CLEARS,(progress?.bossCharge||0)+1),
    bossesDefeated:progress?.bossesDefeated||0,
  };
}

function getAdventurePetDef(pet){
  return PETS[pet?.rarity]?.find(p=>p.id===pet?.petId)||null;
}

function getPetAdventureSkill(pet){
  const manualSkill=(pet?.skills||[]).find(id=>PET_ADVENTURE_SKILLS[id]);
  if(manualSkill)return PET_ADVENTURE_SKILLS[manualSkill];
  const def=getAdventurePetDef(pet);
  const words=(def?.words||[]).map(w=>String(w).toLowerCase());
  const found=Object.values(PET_ADVENTURE_SKILLS).find(skill=>skill.words.some(w=>words.includes(w)));
  if(found)return found;
  if((pet?.level||1)>=10||RARITY_ORDER[pet?.rarity]>=RARITY_ORDER.SR)return PET_ADVENTURE_SKILLS.magicLeaf;
  return PET_ADVENTURE_SKILLS.wordSpark;
}

function getPetAdventureSkillCards(pet){
  const natural=getPetAdventureSkill(pet);
  const learned=new Set(pet?.skills||[]);
  const level=pet?.level||1;
  const rarityRank=RARITY_ORDER[pet?.rarity]||0;
  return Object.values(PET_ADVENTURE_SKILLS).map(skill=>{
    const rule=PET_ADVENTURE_SKILL_UNLOCKS[skill.id]||PET_ADVENTURE_SKILL_UNLOCKS.wordSpark;
    const unlockedByLevel=level>=rule.level;
    const unlockedByRarity=skill.id==="magicLeaf"&&rarityRank>=RARITY_ORDER.SR;
    const unlocked=skill.id===natural.id||learned.has(skill.id)||unlockedByLevel||unlockedByRarity;
    let source=skill.id===natural.id?"天生技能":learned.has(skill.id)?"冒險學會":unlockedByRarity?"稀有寵天賦":unlockedByLevel?rule.label:rule.label;
    return{skill,rule,unlocked,source};
  });
}

function getSelectedPetAdventureSkill(pet,loadout={}){
  const wanted=loadout?.[pet?.petId];
  const cards=getPetAdventureSkillCards(pet);
  const card=cards.find(x=>x.skill.id===wanted&&x.unlocked);
  return card?.skill||getPetAdventureSkill(pet);
}

function getPetAdventurePower(pet){
  const rarityBonus={N:0,R:8,SR:18,SSR:32}[pet?.rarity]||0;
  const careAvg=getPetCareAverage(pet);
  const skillBonus=(pet?.skills?.length||0)*7;
  return Math.max(18,Math.round(18+(pet?.level||1)*7+rarityBonus+(pet?.bond||0)/18+careAvg/7+(pet?.dupes||0)*3+skillBonus));
}

function getPetAdventureScore(pet){
  const readiness=getPetReadiness(pet);
  const carePenalty=getCareCount(pet)*10;
  return Math.max(1,Math.round(getPetAdventurePower(pet)+readiness.avg*.22-carePenalty));
}

function getNextPetAdventureSkillCard(pet){
  return getPetAdventureSkillCards(pet)
    .filter(card=>!card.unlocked)
    .sort((a,b)=>(a.rule.level||0)-(b.rule.level||0))[0]||null;
}

function shuffleAdventureQuestion(q){
  const rows=q.choices.map((choice,i)=>({choice,correct:i===q.answer})).sort(()=>Math.random()-.5);
  return {...q,choices:rows.map(r=>r.choice),answer:rows.findIndex(r=>r.correct)};
}

function getAdventureQuestionSpeech(q){
  const prompt=String(q?.speak||q?.q||"").trim();
  const answer=String(q?.choices?.[q?.answer]||"").trim();
  if(!prompt)return"";
  if(/_{2,}/.test(prompt)){
    return prompt
      .replace(/^\s*Complete\s*:\s*/i,"")
      .replace(/_{2,}/g,answer)
      .replace(/\s+/g," ")
      .trim();
  }
  return prompt.replace(/\s+/g," ").trim();
}

function isAdventureClozeQuestion(q){
  return /_{2,}/.test(String(q?.speak||q?.q||""));
}

function getAdventureCorrectSpeech(q){
  const answer=String(q?.choices?.[q?.answer]||"").trim();
  if(isAdventureClozeQuestion(q))return getAdventureQuestionSpeech(q);
  return answer||getAdventureQuestionSpeech(q);
}

function getAdventureAnswerLine(q){
  const answer=String(q?.choices?.[q?.answer]||"").trim();
  const speech=getAdventureCorrectSpeech(q);
  if(isAdventureClozeQuestion(q))return speech;
  return answer||speech;
}

function getAdventureQuestionMeta(q){
  const text=`${q?.q||""} ${q?.zh||""}`.toLowerCase();
  if(isAdventureClozeQuestion(q))return{label:"補空",zh:"完成句子",color:"#D97706",bg:"#FEF3C7"};
  if(/word|means|meaning|opposite|closest|單字|意思|相反|接近|noun|adjective|verb/.test(text))return{label:"單字",zh:"字義判斷",color:"#7C3AED",bg:"#F3E8FF"};
  if(/sentence|grammar|correct|passive|relative|clause|connector|transition|complete|句子|文法|語態|子句|連接詞|轉折|完成/.test(text))return{label:"文法",zh:"句型判斷",color:"#2563EB",bg:"#DBEAFE"};
  if(/what can|which one|answer fits|say before|question|哪一個|可以|適合|問句/.test(text))return{label:"理解",zh:"語意選擇",color:"#0F766E",bg:"#CCFBF1"};
  return{label:"挑戰",zh:"英文題",color:"#0F6E56",bg:"#E1F5EE"};
}

function drawAdventureQuestions(lv,count,usedKeys=new Set(),pickedKeys=[],questionData){
  const source=uniqueAdventureQuestions(getAdventureQuestionSource(lv,questionData));
  const fresh=source.filter(q=>!usedKeys.has(getAdventureQuestionKey(q)));
  const fallback=source.filter(q=>fresh.every(item=>getAdventureQuestionKey(item)!==getAdventureQuestionKey(q)));
  const pool=[...fresh].sort(()=>Math.random()-.5);
  if(pool.length<count)pool.push(...fallback.sort(()=>Math.random()-.5));
  const picked=[];
  for(let i=0;i<Math.min(count,pool.length);i++){
    const raw=pool[i];
    if(!raw)break;
    const key=getAdventureQuestionKey(raw);
    usedKeys.add(key);
    pickedKeys.push(key);
    picked.push(shuffleAdventureQuestion(raw));
  }
  return picked;
}

function buildPetAdventureStages(teamPets,lv,{bossReady=false,difficultyLevel=1,questionData}={}){
  const teamPower=teamPets.reduce((sum,p)=>sum+getPetAdventurePower(p),0);
  const hpScale=1+(Math.max(1,difficultyLevel)-1)*.14;
  const attackScale=1+(Math.max(1,difficultyLevel)-1)*.1;
  const stages=[...PET_ADVENTURE_STAGES].sort(()=>Math.random()-.5).slice(0,3);
  const recentQuestionKeys=getRecentAdventureQuestionKeys();
  const usedQuestions=new Set(recentQuestionKeys);
  const pickedQuestionKeys=[];
  const normalStages=stages.map((stage,i)=>{
    const maxHp=Math.round((82+i*34+teamPower*.22)*hpScale);
    return {
      ...stage,
      questions:drawAdventureQuestions(lv,6,usedQuestions,pickedQuestionKeys,questionData),
      maxHp,
      attack:Math.round((14+i*7+teamPower*.035)*attackScale),
      difficultyLevel,
    };
  });
  const adventureStages=bossReady?[
    ...normalStages,
    {
      ...PET_ADVENTURE_BOSS,
      questions:drawAdventureQuestions(lv,10,usedQuestions,pickedQuestionKeys,questionData),
      maxHp:Math.round((220+teamPower*.52)*hpScale),
      attack:Math.round((34+teamPower*.07)*attackScale),
      difficultyLevel:Math.min(12,difficultyLevel+1),
    },
  ]:normalStages;
  saveRecentAdventureQuestionKeys([...recentQuestionKeys,...pickedQuestionKeys]);
  return adventureStages;
}

function getPetAdventureFatigue({won=false,bossWin=false}={}){
  if(bossWin)return{hunger:14,clean:10,energy:18,label:"魔王戰消耗"};
  if(won)return{hunger:8,clean:6,energy:12,label:"冒險消耗"};
  return{hunger:5,clean:4,energy:8,label:"撤退消耗"};
}

function improvePetAfterAdventure(pet,{exp,bond,skillId,fatigue=null}){
  let updated={...pet,exp:(pet.exp||0)+exp,bond:(pet.bond||0)+bond,lastUpdate:new Date().toISOString()};
  if(fatigue){
    updated.hunger=Math.max(0,Math.min(MAX_STAT,(updated.hunger??80)-fatigue.hunger));
    updated.clean=Math.max(0,Math.min(MAX_STAT,(updated.clean??80)-fatigue.clean));
    updated.energy=Math.max(0,Math.min(MAX_STAT,(updated.energy??80)-fatigue.energy));
  }
  if(skillId){
    const skills=new Set(updated.skills||[]);
    skills.add(skillId);
    updated.skills=[...skills];
  }
  let guard=0;
  while(updated.exp>=(updated.level||1)*100&&guard<20){
    const before=updated.level;
    updated=levelUpPet(updated);
    if(updated.level===before)break;
    guard++;
  }
  return updated;
}

const BOND_MILESTONES=[
  {bond:50,title:"初識夥伴",desc:"解鎖專屬暱稱欄位",icon:"🤝",color:"#9c9a92"},
  {bond:150,title:"好朋友",desc:"每日任務獎勵 +20%",icon:"💛",color:"#EF9F27"},
  {bond:300,title:"親密夥伴",desc:"抽蛋折扣 10%",icon:"💖",color:"#E91E63"},
  {bond:500,title:"靈魂伴侶",desc:"孵化速度 +50%",icon:"✨",color:"#7B61FF"},
  {bond:1000,title:"永恆羈絆",desc:"寵物進化 + 金光特效",icon:"🌟",color:"#FFD700"},
];

function getBondLevel(bond){
  let level=0;
  for(let i=0;i<BOND_MILESTONES.length;i++){
    if(bond>=BOND_MILESTONES[i].bond)level=i+1;
  }
  return level;
}


const STAT_DECAY = {hunger:5,clean:3,energy:4};
const MAX_STAT = 100;

// Check if pet should be sleeping (22:00 - 07:00)
function isPetSleeping(){
  const h=new Date().getHours();
  return h>=22||h<7;
}

// Chance of poop per hour when awake (25% per hour)
const POOP_CHANCE_PER_HOUR=0.25;

function calcDecay(pet){
  if(!pet.lastUpdate)return pet;
  const hoursAgo=(Date.now()-new Date(pet.lastUpdate).getTime())/3600000;
  if(hoursAgo<0.1)return pet;
  // Calculate how many hours were spent sleeping vs awake
  const lastT=new Date(pet.lastUpdate).getTime();
  let sleepHours=0,awakeHours=0;
  // Sample every 30 min to estimate sleep time
  const steps=Math.min(48,Math.ceil(hoursAgo*2));
  for(let i=0;i<steps;i++){
    const t=new Date(lastT+(i/steps)*hoursAgo*3600000);
    const h=t.getHours();
    const isSleep=h>=22||h<7;
    if(isSleep)sleepHours+=hoursAgo/steps;
    else awakeHours+=hoursAgo/steps;
  }
  // While sleeping: no hunger/clean decay, but energy recovers!
  const decayHours=awakeHours;
  const energyRecovery=sleepHours*15;// +15/hr while sleeping
  // Poop accumulation (only while awake)
  const newPoops=[];
  const existingPoops=pet.poops||[];
  if(awakeHours>0.5){
    const poopCount=Math.floor(awakeHours*POOP_CHANCE_PER_HOUR);
    for(let i=0;i<poopCount;i++){
      newPoops.push({
        id:Date.now()+i,
        x:15+Math.random()*70,// % position
        time:new Date(lastT+(i+1)*(awakeHours/poopCount)*3600000).toISOString(),
      });
    }
  }
  const totalPoops=[...existingPoops,...newPoops].slice(-5);// max 5
  // Extra clean decay per poop (each poop costs -5 clean)
  const poopPenalty=totalPoops.length*5;
  return {
    ...pet,
    hunger:Math.max(0,(pet.hunger??80)-STAT_DECAY.hunger*decayHours),
    clean:Math.max(0,(pet.clean??80)-STAT_DECAY.clean*decayHours-poopPenalty),
    energy:Math.min(MAX_STAT,(pet.energy??80)-STAT_DECAY.energy*decayHours+energyRecovery),
    poops:totalPoops,
    lastUpdate:new Date().toISOString(),
  };
}

function getPetMood(pet){
  const avg=((pet.hunger??80)+(pet.clean??80)+(pet.energy??80))/3;
  if(avg>=70)return{emoji:"😊",text:"心情很好",color:"#1D9E75"};
  if(avg>=40)return{emoji:"😐",text:"普通",color:"#EF9F27"};
  return{emoji:"😢",text:"不開心",color:"#E24B4A"};
}

// ═══ 寵物列表卡片用 - 緊急需求判定 (P0-1 視覺優化) ═══════════════════
function getPetUrgentNeed(pet){
  const h=pet.hunger??80, cl=pet.clean??80, en=pet.energy??80;
  const poops=(pet.poops||[]).length;
  // 緊急（< 20）
  if(h<20)return{emoji:"😫",label:"好餓...",urgency:2,key:"hunger"};
  if(cl<20)return{emoji:"🤢",label:"好髒...",urgency:2,key:"clean"};
  if(en<20)return{emoji:"😵",label:"好累...",urgency:2,key:"energy"};
  if(poops>=3)return{emoji:"💩",label:"要清理！",urgency:2,key:"poop"};
  // 提醒（< 30）
  if(h<30)return{emoji:"😋",label:"想吃東西",urgency:1,key:"hunger"};
  if(cl<30)return{emoji:"🛁",label:"想洗澡",urgency:1,key:"clean"};
  if(en<30)return{emoji:"😴",label:"好想睡",urgency:1,key:"energy"};
  if(poops>0)return{emoji:"💩",label:"有便便",urgency:1,key:"poop"};
  // 平靜
  if(isPetSleeping())return{emoji:"💤",label:"睡覺中",urgency:0,key:"sleep"};
  const bond=pet.bond||0;
  if(bond>=300)return{emoji:"💖",label:"超愛你",urgency:0,key:"happy"};
  if(bond>=100)return{emoji:"😊",label:"很開心",urgency:0,key:"happy"};
  return{emoji:"🙂",label:"還不錯",urgency:0,key:"happy"};
}

function getCareCount(pet){
  let n=0;
  if((pet.hunger??80)<30)n++;
  if((pet.clean??80)<30)n++;
  if((pet.energy??80)<30)n++;
  if((pet.poops||[]).length>0)n++;
  return n;
}

function getPetCareAverage(pet){
  return Math.round(((pet?.hunger??80)+(pet?.clean??80)+(pet?.energy??80))/3);
}

function getPetReadiness(pet){
  const avg=getPetCareAverage(pet);
  const needs=getCareCount(pet);
  if(needs>0||avg<45)return{avg,label:"需要照顧",emoji:"⚠️",color:"#E24B4A",tone:"先照顧再出戰會更穩"};
  if(avg>=85)return{avg,label:"最佳狀態",emoji:"✨",color:"#1D9E75",tone:"冒險時傷害、HP、獎勵提升"};
  if(avg>=65)return{avg,label:"狀態穩定",emoji:"👍",color:"#0F6E56",tone:"可安心冒險"};
  return{avg,label:"有點疲倦",emoji:"😐",color:"#EF9F27",tone:"建議先補充體力或清潔"};
}

function getTeamAdventureMorale(teamPets=[]){
  const avg=teamPets.length?Math.round(teamPets.reduce((sum,p)=>sum+getPetCareAverage(p),0)/teamPets.length):80;
  const needs=teamPets.reduce((sum,p)=>sum+getCareCount(p),0);
  if(needs>0||avg<45)return{avg,needs,label:"低士氣",emoji:"⚠️",color:"#E24B4A",hpMult:.9,damageBonus:-8,rewardMult:1,battleText:"照顧不足，戰鬥力下降"};
  if(avg>=85)return{avg,needs,label:"高士氣",emoji:"✨",color:"#1D9E75",hpMult:1.12,damageBonus:14,rewardMult:1.15,battleText:"HP、傷害、獎勵提升"};
  if(avg>=65)return{avg,needs,label:"穩定",emoji:"👍",color:"#0F6E56",hpMult:1.04,damageBonus:6,rewardMult:1.05,battleText:"小幅提升戰鬥表現"};
  return{avg,needs,label:"普通",emoji:"🙂",color:"#EF9F27",hpMult:1,damageBonus:0,rewardMult:1,battleText:"正常出戰"};
}

function choosePetFoodForNeed(pet,inventory={}){
  const hunger=pet?.hunger??80;
  const foods=PET_FOODS.filter(f=>(inventory[f.id]||0)>0);
  if(!foods.length)return null;
  const need=Math.max(1,MAX_STAT-hunger);
  return [...foods].sort((a,b)=>Math.abs(a.feed-need)-Math.abs(b.feed-need)||a.feed-b.feed)[0];
}

function getPetCareSuggestion(pet,inventory={}){
  if(!pet)return null;
  const food=choosePetFoodForNeed(pet,inventory);
  const hunger=pet.hunger??80, clean=pet.clean??80, energy=pet.energy??80, poops=(pet.poops||[]).length;
  if(hunger<75&&food)return{actionKey:"feed",foodId:food.id,label:`餵 ${food.name}`,reason:`飢餓度 ${Math.round(hunger)}/100，建議補充 ${food.word}。`,emoji:food.emoji};
  if(hunger<75&&!food)return{shop:true,label:"補充食物",reason:"食物庫存不足，先到商店買一點食物。",emoji:"🏪"};
  if(poops>0||clean<70)return{actionKey:"clean",label:"洗澡清潔",reason:poops>0?"房間需要整理，清潔會提升冒險狀態。":"乾淨度偏低，洗澡後比較適合出戰。",emoji:"🛁"};
  if(energy<65)return{actionKey:"sleep",label:"休息一下",reason:`體力 ${Math.round(energy)}/100，休息後冒險更穩。`,emoji:"😴"};
  if(energy>=45)return{actionKey:"play",label:"一起玩",reason:"狀態不錯，可以透過遊戲增加親密度。",emoji:"🎮"};
  return{actionKey:"study",label:"一起學習",reason:"用短句練習維持親密度與經驗。",emoji:"📚"};
}

const PET_CULTIVATION_ACTIONS=[
  {key:"feed",label:"餵食",emoji:"🍖",short:"食"},
  {key:"clean",label:"清潔",emoji:"🛁",short:"潔"},
  {key:"play",label:"玩耍",emoji:"🎮",short:"玩"},
  {key:"sleep",label:"休息",emoji:"😴",short:"休"},
  {key:"study",label:"學習",emoji:"📚",short:"學"},
];

function getPetDailyCultivation(pet){
  const today=new Date().toDateString();
  const raw=pet?.careLog?.date===today?pet.careLog:{date:today,actions:[],comboClaimed:false};
  const actions=[...new Set((raw.actions||[]).filter(k=>PET_CULTIVATION_ACTIONS.some(a=>a.key===k)))];
  return{date:today,actions,comboClaimed:!!raw.comboClaimed,count:actions.length,target:3,complete:actions.length>=3};
}

function getPetExpToLevel(pet,targetLevel){
  const level=pet?.level||1;
  const exp=pet?.exp||0;
  if(!targetLevel||level>=targetLevel)return 0;
  let left=0;
  for(let lv=level;lv<targetLevel;lv++){
    left+=lv*100;
    if(lv===level)left-=Math.min(exp,lv*100);
  }
  return Math.max(0,left);
}

function getPetEvolutionProgress(pet){
  const level=pet?.level||1;
  const exp=pet?.exp||0;
  const stage=getPetStage(pet);
  const currentLabel={baby:"幼寵",adult:"成寵",evolved:"進化形態"}[stage]||"幼寵";
  const targetLevel=level<4?4:level<10?10:null;
  if(!targetLevel)return{currentLabel,nextLabel:"已完成進化",targetLevel:null,expLeft:0,pct:100};
  const startLevel=targetLevel===4?1:4;
  let total=0,gained=0;
  for(let lv=startLevel;lv<targetLevel;lv++){
    const need=lv*100;
    total+=need;
    if(lv<level)gained+=need;
    if(lv===level)gained+=Math.min(exp,need);
  }
  return{
    currentLabel,
    nextLabel:targetLevel===4?"成寵":"進化形態",
    targetLevel,
    expLeft:getPetExpToLevel(pet,targetLevel),
    pct:total?Math.round(Math.min(100,gained/total*100)):100,
  };
}

function getPetNextBondMilestone(pet){
  const bond=pet?.bond||0;
  const next=BOND_MILESTONES.find(m=>bond<m.bond);
  if(!next)return{next:null,left:0,pct:100};
  const prev=[...BOND_MILESTONES].reverse().find(m=>bond>=m.bond)?.bond||0;
  const pct=Math.round(Math.max(0,Math.min(100,((bond-prev)/(next.bond-prev))*100)));
  return{next,left:next.bond-bond,pct};
}

function getPetGrowthScore(pet){
  const readiness=getPetReadiness(pet);
  return Math.round((pet?.level||1)*14+(pet?.bond||0)/10+readiness.avg*.45+(pet?.skills?.length||0)*18+(pet?.dupes||0)*10);
}

function getPetCultivationPlan(pet,inventory={}){
  const daily=getPetDailyCultivation(pet);
  const readiness=getPetReadiness(pet);
  const care=getPetCareSuggestion(pet,inventory);
  const evolution=getPetEvolutionProgress(pet);
  const bond=getPetNextBondMilestone(pet);
  const nextSkill=getNextPetAdventureSkillCard(pet);
  const energy=pet?.energy??80;
  const suggestedFood=choosePetFoodForNeed(pet,inventory);
  const actionMap={
    feed:{key:"feed",label:suggestedFood?"餵食":"補食物",emoji:suggestedFood?.emoji||"🍖",actionKey:"feed",foodId:suggestedFood?.id||null,shop:!suggestedFood},
    clean:{key:"clean",label:"清潔",emoji:"🛁",actionKey:"clean"},
    play:{key:"play",label:"玩耍",emoji:"🎮",actionKey:"play"},
    sleep:{key:"sleep",label:"休息",emoji:"😴",actionKey:"sleep"},
    study:{key:"study",label:"學習",emoji:"📚",actionKey:"study"},
  };
  const actions=[];
  const addAction=a=>{
    if(!a||actions.some(x=>x.key===a.key))return;
    actions.push(a);
  };
  if(care){
    addAction(care.shop?{...actionMap.feed,shop:true,label:"補食物"}:{key:care.actionKey,label:care.label,emoji:care.emoji,actionKey:care.actionKey,foodId:care.foodId});
  }
  if(nextSkill||evolution.targetLevel)addAction(actionMap.study);
  if(bond.next&&energy>=35)addAction(actionMap.play);
  if(energy<55)addAction(actionMap.sleep);
  PET_CULTIVATION_ACTIONS.filter(a=>!daily.actions.includes(a.key)).forEach(a=>addAction(actionMap[a.key]));
  let primary;
  if(care&&(care.shop||readiness.avg<75||getCareCount(pet)>0)){
    primary={title:"先把狀態補穩",desc:care.reason,action:actions[0]};
  }else if(nextSkill){
    primary={title:`下一個技能：${nextSkill.skill.zh}`,desc:`距離 ${nextSkill.rule.label} 更近；學習與冒險都能累積經驗。`,action:actionMap.study};
  }else if(evolution.targetLevel){
    primary={title:`朝 ${evolution.nextLabel} 培養`,desc:`還差約 ${evolution.expLeft} XP 到 Lv.${evolution.targetLevel}。`,action:actionMap.study};
  }else if(bond.next){
    primary={title:`羈絆目標：${bond.next.title}`,desc:`親密度還差 ${bond.left}，玩耍或學習都能提升。`,action:energy>=35?actionMap.play:actionMap.sleep};
  }else{
    primary={title:"穩定培養完成",desc:"可以用學習或冒險維持成長，準備挑戰更高難度。",action:actionMap.study};
  }
  return{daily,readiness,care,evolution,bond,nextSkill,score:getPetGrowthScore(pet),primary,actions:actions.slice(0,4)};
}

function levelUpPet(pet){
  const expNeeded=pet.level*100;
  if(pet.exp>=expNeeded){return{...pet,level:pet.level+1,exp:pet.exp-expNeeded}}
  return pet;
}


// ═══ CONFIG ═════════════════════════════════════════════════════════
const LV={elementary:{l:"小學",en:"Elementary",cl:"#0F6E56",bg:"#E1F5EE",ac:"#1D9E75",ic:"🌱",wd:"300字"},junior:{l:"國中",en:"Junior High",cl:"#534AB7",bg:"#EEEDFE",ac:"#7F77DD",ic:"📚",wd:"1200字"},senior:{l:"高中",en:"Senior High",cl:"#993C1D",bg:"#FAECE7",ac:"#D85A30",ic:"🎓",wd:"4500+字"}};
let _voiceUri = null; // selected English voice URI
try{_voiceUri=localStorage.getItem("eg_voice")||null}catch{}

// Score a voice by perceived quality (higher = better)
function scoreVoice(v){
  let score=0;
  const n=v.name.toLowerCase();
  // Premium neural voices (best quality)
  if(/neural|natural|online|premium|enhanced|studio/i.test(v.name))score+=100;
  // Known good voice names (female, warm, story-friendly)
  if(/aria|jenny|sonia|libby|ava|emma|olivia|nova|shimmer|samantha|karen|tessa|moira|kate|serena/i.test(n))score+=80;
  // Microsoft Edge voices are high quality
  if(/microsoft/i.test(n)&&!/desktop/i.test(n))score+=50;
  // Google voices are decent
  if(/google/i.test(n))score+=40;
  // Apple voices are decent
  if(/apple|^com\.apple/i.test(n))score+=30;
  // Prefer female voices (better for kids content)
  if(/female|woman/i.test(n))score+=20;
  if(/male|man/i.test(n)&&!/female/i.test(n))score-=5;
  // Penalize low-quality voices
  if(/compact|espeak|robot/i.test(n))score-=50;
  if(/novelty|whisper|bubbles|bells|bahh|boing|deranged|hysterical|cellos|organ|trinoids|zarvox|wobble/i.test(n))score-=200;
  // Localized English preferences
  if(/en-us/i.test(v.lang))score+=10;
  if(/en-gb/i.test(v.lang))score+=8;
  if(/en-au/i.test(v.lang))score+=5;
  return score;
}

function getVoices(){
  const vs=window.speechSynthesis?.getVoices()?.filter(v=>/^en/i.test(v.lang))||[];
  return vs.sort((a,b)=>scoreVoice(b)-scoreVoice(a));// best first
}

// Auto-pick best voice if user hasn't chosen one
function getBestEnVoice(){
  if(_voiceUri){
    const v=window.speechSynthesis?.getVoices().find(x=>x.voiceURI===_voiceUri);
    if(v)return v;
  }
  return getVoices()[0]||null;
}

function getZhVoice(){
  const vs=window.speechSynthesis?.getVoices()||[];
  // Apply scoring to Chinese voices too
  const zh=vs.filter(v=>/^zh/i.test(v.lang));
  zh.sort((a,b)=>{
    let sa=0,sb=0;
    if(/neural|natural|online|premium/i.test(a.name))sa+=100;
    if(/neural|natural|online|premium/i.test(b.name))sb+=100;
    if(/hsiao|yating|mei-jia|tracy|hanhan|tina/i.test(a.name.toLowerCase()))sa+=50;
    if(/hsiao|yating|mei-jia|tracy|hanhan|tina/i.test(b.name.toLowerCase()))sb+=50;
    if(/tw/i.test(a.lang))sa+=20;
    if(/tw/i.test(b.lang))sb+=20;
    if(/male/i.test(a.name)&&!/female/i.test(a.name))sa-=10;
    if(/male/i.test(b.name)&&!/female/i.test(b.name))sb-=10;
    return sb-sa;
  });
  return zh[0]||null;
}

let _speechToken=0;
const _speechTimers=new Set();
const _speechCancelers=new Set();
function clearSpeechTimers(){
  _speechTimers.forEach(id=>clearTimeout(id));
  _speechTimers.clear();
}
function registerSpeechCanceler(fn){
  if(typeof fn!=="function")return()=>{};
  _speechCancelers.add(fn);
  return()=>_speechCancelers.delete(fn);
}
function stopSpeech(){
  const cancelers=[..._speechCancelers];
  _speechCancelers.clear();
  _speechToken+=1;
  clearSpeechTimers();
  cancelers.forEach(fn=>{try{fn()}catch{}});
  if(typeof window!=="undefined"&&window.speechSynthesis){
    try{window.speechSynthesis.cancel()}catch{}
  }
  return _speechToken;
}
function speechTimer(fn,delay,token=_speechToken){
  const id=setTimeout(()=>{
    _speechTimers.delete(id);
    if(token===_speechToken)fn();
  },delay);
  _speechTimers.add(id);
  return id;
}
function makeUtterance(t,l="en-US",r=0.9,opts={},token=_speechToken){
  const u=new SpeechSynthesisUtterance(t);
  u.lang=l;
  u.rate=r;
  u.pitch=opts.pitch||1.05;// slightly higher = warmer/livelier
  u.volume=opts.volume||1;
  const isZh=/^zh/i.test(l);
  if(isZh){
    const zhV=getZhVoice();
    if(zhV){u.voice=zhV;u.lang=zhV.lang}
  }else{
    const enV=getBestEnVoice();
    if(enV){u.voice=enV;u.lang=enV.lang}
  }
  const unregisterCancel=registerSpeechCanceler(opts.oncancel);
  const finish=e=>{unregisterCancel();if(token===_speechToken)opts.onend?.(e)};
  u.onend=finish;
  u.onerror=e=>{unregisterCancel();if(token===_speechToken)opts.onerror?.(e)};
  if(opts.onboundary)u.onboundary=e=>{if(token===_speechToken)opts.onboundary?.(e)};
  u.cancel=()=>{if(token===_speechToken)stopSpeech()};
  return u;
}
function startUtterance(u,token,delay=35){
  if(typeof window==="undefined"||!window.speechSynthesis||!u)return;
  speechTimer(()=>{
    if(token!==_speechToken)return;
    try{window.speechSynthesis.cancel()}catch{}
    try{window.speechSynthesis.resume?.()}catch{}
    window.speechSynthesis.speak(u);
  },delay,token);
}
function speak(t,l="en-US",r=0.9,opts={}){
  if(typeof window==="undefined"||!window.speechSynthesis||!t)return null;
  const token=stopSpeech();
  const u=makeUtterance(t,l,r,opts,token);
  startUtterance(u,token,opts.delay??35);
  return u;
}
function speakWebSpeech(t,l="en-US",r=0.9,opts={}){
  if(typeof window==="undefined"||!window.speechSynthesis||!t)return null;
  const token=stopSpeech();
  const u=makeUtterance(t,l,r,opts,token);
  u.__englishGoWebSpeechOnly=true;
  startUtterance(u,token,opts.delay??35);
  return u;
}

function preloadTts(texts,opts={}){
  if(typeof window==="undefined")return;
  const tts=window.EnglishGoTTS;
  if(!tts)return;
  const raw=Array.isArray(texts)?texts:[texts];
  const limit=opts.limit||5;
  const list=[];const seen=new Set();
  raw.forEach(item=>{
    const text=String(item||"").trim();
    const key=text.toLowerCase();
    if(!text||text.length>350||!/[A-Za-z]/.test(text)||seen.has(key))return;
    seen.add(key);list.push(text);
  });
  if(!list.length)return;
  if(typeof tts.preloadMany==="function"){tts.preloadMany(list,{...opts,limit});return}
  list.slice(0,limit).forEach(text=>tts.preload?.(text,opts));
}

// Speak multiple sentences with natural pauses between them (story narration)
// Returns a control handle with cancel() for cleanup
function speakStory(sentences,opts={}){
  if(typeof window==="undefined"||!window.speechSynthesis||!sentences||!sentences.length)return{cancel:()=>{}};
  const token=stopSpeech();
  let i=0;
  let cancelled=false;
  let pendingTimer=null;
  const unregisterCancel=registerSpeechCanceler(()=>{
    cancelled=true;
    if(pendingTimer)clearTimeout(pendingTimer);
    opts.oncancel?.();
  });
  const playNext=()=>{
    if(cancelled||token!==_speechToken)return;
    if(i>=sentences.length){unregisterCancel();opts.onFinish?.();return}
    const item=sentences[i];
    const text=typeof item==="string"?item:item?.text;
    const isLast=i===sentences.length-1;
    i++;
    opts.onSentence?.(i-1,text,item);
    const u=makeUtterance(text,item?.lang||opts.lang||"en-US",item?.rate||opts.rate||0.88,{
      pitch:item?.pitch||opts.pitch||1.08,
      onend:()=>{
        if(cancelled||token!==_speechToken)return;
        if(isLast){unregisterCancel();opts.onFinish?.()}
        else{pendingTimer=speechTimer(playNext,400,token)}// 400ms natural pause between sentences
      },
    },token);
    startUtterance(u,token,i===1?35:0);
  };
  playNext();
  return{
    cancel:()=>{
      cancelled=true;
      if(pendingTimer)clearTimeout(pendingTimer);
      unregisterCancel();
      opts.oncancel?.();
      stopSpeech();
    },
  };
}
function VoicePicker(){
  const[voices,setVoices]=useState([]);
  const[cur,setCur]=useState(_voiceUri||"");
  useEffect(()=>{
    const load=()=>{const v=getVoices();if(v.length)setVoices(v)};
    load();
    window.speechSynthesis?.addEventListener?.("voiceschanged",load);
    return()=>window.speechSynthesis?.removeEventListener?.("voiceschanged",load);
  },[]);
  if(!voices.length)return null;
  // Mark top 3 voices with ⭐ (high quality)
  const topScores=voices.slice(0,3).map(v=>v.voiceURI);
  return(<select value={cur} onChange={e=>{
    _voiceUri=e.target.value||null;setCur(e.target.value);
    try{localStorage.setItem("eg_voice",e.target.value)}catch{};
    if(e.target.value){const v=voices.find(x=>x.voiceURI===e.target.value);if(v)speak("Hello! Let me tell you a story.","en-US",0.9,{pitch:1.08})}
  }} style={{padding:"3px 4px",borderRadius:6,border:`1px solid var(--color-border-tertiary,#e0dfd9)`,fontSize:11,background:"var(--color-background-primary,#fff)",color:"var(--color-text-secondary,#73726c)",maxWidth:130,fontFamily:"inherit"}}>
    <option value="">🎤 自動選最佳</option>
    {voices.map(v=>{
      const star=topScores.includes(v.voiceURI)?"⭐ ":"";
      const flag=v.lang.includes("GB")?" 🇬🇧":v.lang.includes("AU")?" 🇦🇺":v.lang.includes("US")?" 🇺🇸":"";
      return(<option key={v.voiceURI} value={v.voiceURI}>{star}{v.name.replace(/Microsoft |Google |Apple /,"").slice(0,18)}{flag}</option>);
    })}
  </select>);
}
function createDeck(c){return{queue:c.map((_,i)=>i),rm:[],stats:{again:0,hard:0,good:0,easy:0},total:c.length,lapses:{}}}
function rateDeck(d,a){
  const n={...d,queue:[...d.queue],rm:[...d.rm],stats:{...d.stats},lapses:{...(d.lapses||{})}};
  const c=n.queue.shift();
  if(c===undefined)return n;
  n.stats[a]++;
  if(a==="again"||a==="hard"){
    n.lapses[c]=(n.lapses[c]||0)+(a==="again"?2:1);
    const delay=a==="again"?Math.min(2,n.queue.length):Math.min(Math.max(3,Math.ceil(n.queue.length*.6)),n.queue.length);
    n.queue.splice(delay,0,c);
  }else{
    n.rm.push(c);
  }
  return n;
}
function sortCardsForStudy(cards,weakWords=[],sharedWord=""){
  const weakRank=new Map((weakWords||[]).map(x=>[String(x.w||"").toLowerCase(),Number(x.n)||0]));
  const sw=String(sharedWord||"").toLowerCase();
  return[...cards].sort((a,b)=>{
    const aw=String(a?.w||"").toLowerCase(),bw=String(b?.w||"").toLowerCase();
    const as=sw&&aw===sw?1:0,bs=sw&&bw===sw?1:0;
    if(as!==bs)return bs-as;
    return(weakRank.get(bw)||0)-(weakRank.get(aw)||0);
  });
}
function parseExamWords(text){
  const seen=new Set();
  return String(text||"").split(/[^A-Za-z'-]+/).map(w=>w.trim().replace(/^[-']+|[-']+$/g,"").toLowerCase()).filter(w=>{
    if(!w||seen.has(w)||!/^[a-z][a-z'-]*$/.test(w))return false;
    seen.add(w);
    return true;
  }).slice(0,80);
}
function orderExamCards(cards,lv){
  return[...cards].sort((a,b)=>hashText(`${lv}:exam:${String(a?.w||"").toLowerCase()}`)-hashText(`${lv}:exam:${String(b?.w||"").toLowerCase()}`)||String(a?.w||"").localeCompare(String(b?.w||"")));
}
function countExamRawItems(text){
  return String(text||"").split(/[^A-Za-z'-]+/).map(w=>w.trim()).filter(Boolean).length;
}
function parseCSV(t){return t.trim().split("\n").slice(1).map(l=>{const m=l.match(/^"?([^",]+)"?\s*,\s*"?([\s\S]*?)"?\s*$/);if(!m)return null;const w=m[1].trim(),b=m[2].trim(),p=b.match(/\(([a-z.\/]+)\)\s*(.+?)(?:\n|$)/);return{w,ph:"",p:p?.[1]||"",m:p?.[2]?.trim()||b.split("\n")[0],f:[],c:[],ex:"",ez:""}}).filter(Boolean)}
// ═══ EXAMPLE QUALITY DETECTION & GENERATION ═══════════════════════════
// Detect placeholder/low-quality examples like "Example: word.", "This is a word.", "I have a word."
function escapeRegexSafe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}

function isPlaceholderExample(example, word){
  if(!example||!word)return true;
  const ex=example.trim();
  const exLower=ex.toLowerCase();
  const w=word.toLowerCase();

  // 1. 太短（少於 8 字元）
  if(ex.length<8)return true;

  // 2. "Example:" 開頭的垃圾模板
  if(/^example\s*[:\-]/i.test(ex))return true;
  if(/^\(example\)/i.test(ex))return true;

  // 3. 只有單字本身
  if(new RegExp(`^${escapeRegexSafe(w)}\\.?$`,"i").test(ex))return true;

  // 4. 例句不包含原單字（允許變化形）
  const wordRoot=w.replace(/(ing|ed|s|es|ly)$/i,"");
  if(!exLower.includes(w)&&wordRoot.length>=3&&!exLower.includes(wordRoot))return true;

  // 5. 字數少於 3 個英文字
  const wordCount=ex.replace(/[^\w\s]/g,"").split(/\s+/).filter(Boolean).length;
  if(wordCount<3)return true;

  // 6. 制式破碎模板
  const garbage=[
    /^(this|that)\s+is\s+\w+\.?$/i,
    /^\w+\s+is\s+(good|nice|great|bad)\.?$/i,
    /^see\s+\w+\.?$/i,
    /^the\s+\w+\.?$/i,
  ];
  if(garbage.some(p=>p.test(ex)))return true;

  return false;
}

// AI-generate a quality example sentence (cached per word)
const _exampleCache={};
async function generateExample(word, meaning, pos, apiKey){
  if(!word||!apiKey)return null;
  const k=word.toLowerCase();
  if(_exampleCache[k])return _exampleCache[k];
  // Check localStorage for persisted cache
  try{
    const cached=localStorage.getItem(`ex_${k}`);
    if(cached){
      const obj=JSON.parse(cached);
      _exampleCache[k]=obj;
      return obj;
    }
  }catch{}
  const prompt=`Create one short, natural English example sentence (8-15 words) using the word "${word}" (meaning: ${meaning}, part of speech: ${pos}). Then provide a Traditional Chinese translation.

Return STRICT JSON only:
{"en": "English sentence here", "zh": "中文翻譯"}`;
  try{
    const models=["gemini-2.5-flash-lite","gemini-2.5-flash","gemini-2.0-flash"];
    for(const model of models){
      try{
        const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:300,temperature:0.7}}),
        });
        const data=await res.json();
        if(data?.error)continue;
        let text=data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if(!text)continue;
        text=text.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"");
        const s=text.indexOf("{");const e=text.lastIndexOf("}");
        if(s>=0&&e>s)text=text.slice(s,e+1);
        const parsed=JSON.parse(text);
        if(parsed.en&&parsed.zh){
          _exampleCache[k]=parsed;
          try{localStorage.setItem(`ex_${k}`,JSON.stringify(parsed))}catch{}
          return parsed;
        }
      }catch{}
    }
  }catch{}
  return null;
}

// Curated emoji/icon illustrations for common words (better than random photos)
const WORD_ICONS={
  // Animals
  cat:"🐱",dog:"🐶",puppy:"🐶",kitten:"🐱",bird:"🐦",fish:"🐟",rabbit:"🐰",bunny:"🐰",horse:"🐴",cow:"🐄",pig:"🐷",sheep:"🐑",chicken:"🐔",duck:"🦆",
  lion:"🦁",tiger:"🐯",elephant:"🐘",monkey:"🐒",bear:"🐻",panda:"🐼",fox:"🦊",wolf:"🐺",mouse:"🐭",
  butterfly:"🦋",bee:"🐝",ant:"🐜",spider:"🕷️",snail:"🐌",frog:"🐸",snake:"🐍",turtle:"🐢",dolphin:"🐬",shark:"🦈",whale:"🐳",
  // Body
  hand:"✋",foot:"🦶",feet:"🦶",eye:"👁️",eyes:"👀",ear:"👂",nose:"👃",mouth:"👄",heart:"❤️",brain:"🧠",hair:"💇",tooth:"🦷",teeth:"🦷",
  // Food
  apple:"🍎",banana:"🍌",orange:"🍊",grape:"🍇",strawberry:"🍓",watermelon:"🍉",lemon:"🍋",peach:"🍑",
  bread:"🍞",cake:"🍰",rice:"🍚",noodle:"🍜",noodles:"🍜",pizza:"🍕",hamburger:"🍔",sandwich:"🥪",cookie:"🍪",chocolate:"🍫",candy:"🍬",
  milk:"🥛",water:"💧",coffee:"☕",tea:"🍵",juice:"🧃",
  meat:"🥩",egg:"🥚",eggs:"🥚",cheese:"🧀",salad:"🥗",soup:"🍲",
  // Nature
  sun:"☀️",moon:"🌙",star:"⭐",stars:"⭐",cloud:"☁️",rain:"🌧️",snow:"❄️",rainbow:"🌈",fire:"🔥",wind:"💨",
  tree:"🌳",flower:"🌸",grass:"🌱",leaf:"🍃",mountain:"⛰️",beach:"🏖️",ocean:"🌊",river:"🏞️",forest:"🌲",sea:"🌊",lake:"🏞️",
  // Objects
  book:"📚",pen:"🖊️",pencil:"✏️",bag:"🎒",chair:"🪑",table:"🪑",bed:"🛏️",door:"🚪",window:"🪟",key:"🔑",
  phone:"📱",computer:"💻",television:"📺",tv:"📺",camera:"📷",clock:"🕐",watch:"⌚",glasses:"👓",
  car:"🚗",bus:"🚌",train:"🚆",plane:"✈️",ship:"🚢",boat:"⛵",bike:"🚲",bicycle:"🚲",
  cup:"🥤",bottle:"🍼",box:"📦",lamp:"💡",light:"💡",map:"🗺️",
  // Places
  house:"🏠",home:"🏠",school:"🏫",hospital:"🏥",park:"🏞️",store:"🏪",shop:"🏬",restaurant:"🍴",hotel:"🏨",bank:"🏦",library:"📚",zoo:"🦁",garden:"🏡",city:"🌆",
  // Sports & activities
  ball:"⚽",basketball:"🏀",football:"🏈",tennis:"🎾",baseball:"⚾",
  music:"🎵",song:"🎵",guitar:"🎸",piano:"🎹",drum:"🥁",
  game:"🎮",toy:"🧸",
  // People
  family:"👨‍👩‍👧‍👦",mother:"👩",mom:"👩",father:"👨",dad:"👨",sister:"👧",brother:"👦",baby:"👶",child:"🧒",friend:"👫",teacher:"👩‍🏫",student:"🧑‍🎓",doctor:"👨‍⚕️",nurse:"👩‍⚕️",
  king:"👑",queen:"👸",
  boy:"👦",girl:"👧",man:"👨",woman:"👩",
  // Weather/time
  morning:"🌅",night:"🌙",day:"☀️",afternoon:"🌤️",evening:"🌆",
  spring:"🌸",summer:"☀️",autumn:"🍂",fall:"🍂",winter:"❄️",
  // Clothes
  shirt:"👕",pants:"👖",dress:"👗",shoes:"👟",hat:"🎩",socks:"🧦",coat:"🧥",
  // Misc
  money:"💰",gift:"🎁",present:"🎁",party:"🎉",birthday:"🎂",
  letter:"✉️",mail:"📧",newspaper:"📰",medicine:"💊",
};

// Verbs that have meaningful action emojis
const VERB_ICONS={
  run:"🏃",jump:"🦘",swim:"🏊",fly:"🛫",sleep:"😴",eat:"🍽️",drink:"🥤",read:"📖",write:"✍️",
  walk:"🚶",dance:"💃",sing:"🎤",play:"🎮",draw:"🎨",cook:"👨‍🍳",clean:"🧹",
  laugh:"😂",cry:"😭",smile:"😊",think:"🤔",listen:"👂",look:"👀",see:"👀",watch:"👀",
};

// Words where photos look great and are unambiguous
const PHOTO_FRIENDLY_WORDS=new Set([
  "mountain","ocean","beach","forest","desert","sunset","sunrise","river","lake","waterfall","sky","cloud","star","city","street","castle","temple","church","bridge","building","skyscraper","village","farm","pizza","sushi","ramen","steak","cake","fruit","vegetable","cheese","bread","train","airplane","ship","yacht","motorcycle","helicopter","soccer","basketball","baseball","football","tennis","golf","skiing","surfing","tiger","elephant","panda","dolphin","whale","butterfly","peacock"
]);

// Image cache (URL or {type, value} per word, or null for no image)
const _imgCache={};

function getWordImg(word){
  if(!word)return null;
  const k=word.toLowerCase().trim();
  if(_imgCache[k]!==undefined)return _imgCache[k];

  // Priority 1: emoji icon if available (most reliable)
  if(WORD_ICONS[k]){_imgCache[k]={type:"emoji",value:WORD_ICONS[k]};return _imgCache[k]}
  if(VERB_ICONS[k]){_imgCache[k]={type:"emoji",value:VERB_ICONS[k]};return _imgCache[k]}

  // Priority 2: high-quality photo for known concrete words
  if(PHOTO_FRIENDLY_WORDS.has(k)){
    const url=`https://loremflickr.com/400/220/${encodeURIComponent(k)}?lock=${k.charCodeAt(0)*100+k.length}`;
    _imgCache[k]={type:"photo",value:url};
    try{const img=new Image();img.src=url}catch{}
    return _imgCache[k];
  }

  // Otherwise: no image (better than wrong image)
  _imgCache[k]=null;
  return null;
}
function preloadImgs(words,start=0,n=3){
  for(let i=start;i<Math.min(start+n,words.length);i++){
    if(words[i]?.w)getWordImg(words[i].w);
  }
}
// ─── Markdown renderer ──────────────────────────────────────────────
function Md({text,color}){if(!text)return null;return text.split("\n").map((line,li)=>{if(!line.trim())return <br key={li}/>;const isB=/^\s*[\*\-•]\s+/.test(line);const cl=isB?line.replace(/^\s*[\*\-•]\s+/,""):line;const parts=[];let rem=cl,k=0;while(rem.length>0){const m=rem.match(/\*\*(.+?)\*\*/);if(m){const idx=rem.indexOf(m[0]);if(idx>0)parts.push(<span key={k++}>{rem.slice(0,idx)}</span>);const isEn=/^[a-zA-Z]/.test(m[1]);parts.push(<strong key={k++} style={{fontWeight:700,cursor:isEn?"pointer":"default",color:isEn?color:"inherit",textDecoration:isEn?"underline dotted":"none",textUnderlineOffset:"3px"}} onClick={()=>isEn&&speak(m[1])}>{m[1]}</strong>);rem=rem.slice(idx+m[0].length)}else{parts.push(<span key={k++}>{rem}</span>);break}}return<div key={li} style={{marginBottom:2,paddingLeft:isB?16:0,position:"relative"}}>{isB&&<span style={{position:"absolute",left:0}}>•</span>}{parts}</div>})}
function speakMx(text,rate=0.85){
  if(typeof window==="undefined"||!window.speechSynthesis)return{cancel:()=>{}};
  const token=stopSpeech();
  const cl=String(text||"").replace(/\*\*/g,"").replace(/[#•\-]/g," ");
  const segs=cl.split(/([a-zA-Z][a-zA-Z\s\-',.!?;:()]+)/g).filter(s=>s.trim());
  let i=0,cancelled=false;
  const playNext=()=>{
    if(cancelled||token!==_speechToken)return;
    const raw=segs[i++];if(!raw)return;
    const s=raw.trim();const en=/^[a-zA-Z]/.test(s);
    const u=makeUtterance(s,en?"en-US":"zh-TW",en?rate:rate+.15,{onend:()=>speechTimer(playNext,120,token)},token);
    startUtterance(u,token,i===1?35:0);
  };
  playNext();
  return{cancel:()=>{cancelled=true;stopSpeech()}};
}
// LINE share: mobile uses line.me/R/share, desktop uses social-plugins
function shareLine(text,url){
  const isMobile=/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
  if(isMobile){window.open(`https://line.me/R/share?text=${encodeURIComponent(text)}`,"_blank")}
  else{window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url||"https://englishgo-vevan.netlify.app")}&text=${encodeURIComponent(text)}`,"_blank")}
}

const S={btn:{padding:"12px 24px",borderRadius:12,border:"none",fontWeight:700,fontSize:16,cursor:"pointer",fontFamily:"inherit",transition:"transform .16s ease, box-shadow .16s ease, background .16s ease"},
  card:{background:"var(--color-background-primary,#fff)",borderRadius:14,border:"1px solid var(--color-border-tertiary,#e0dfd9)",boxShadow:"var(--eg-card-shadow,0 12px 32px rgba(20,66,52,.08))"},
  t1:"var(--color-text-primary,#2c2c2a)",t2:"var(--color-text-secondary,#73726c)",t3:"var(--color-text-tertiary,#9c9a92)",
  bg1:"var(--color-background-primary,#fff)",bg2:"var(--color-background-secondary,#f3f2ee)",bg3:"var(--color-background-tertiary,#f8f7f4)",bd:"var(--color-border-tertiary,#e0dfd9)"};

// ═══ GLOBAL REWARD BURST (V20 跨模組爽感) ════════════════════════════
// 從任意位置噴出粒子，可飛向目標座標（例如金幣計數器）
// 用法：window.__rewardBurst({emoji:"🪙",count:5,fromX,fromY,toX,toY})
let _rewardBurstSetter=null;
function triggerRewardBurst(opts){
  if(_rewardBurstSetter)_rewardBurstSetter({id:Date.now()+Math.random(),...opts});
}
function RewardBurstHost(){
  const[bursts,setBursts]=useState([]);
  useEffect(()=>{
    _rewardBurstSetter=(b)=>{
      setBursts(prev=>[...prev,b]);
      setTimeout(()=>setBursts(prev=>prev.filter(x=>x.id!==b.id)),(b.duration||1200)+200);
    };
    return()=>{_rewardBurstSetter=null};
  },[]);
  return(<>
    <style>{`
@keyframes rb_fly { 0%{transform:translate(0,0) scale(0.4);opacity:0} 15%{transform:translate(0,0) scale(1.3);opacity:1} 85%{opacity:1} 100%{transform:translate(var(--tx),var(--ty)) scale(0.6) rotate(var(--rot,180deg));opacity:0} }
@keyframes rb_pop { 0%{transform:translate(-50%,-50%) scale(0);opacity:0} 30%{transform:translate(-50%,-50%) scale(1.4);opacity:1} 70%{transform:translate(-50%,-50%) scale(1);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.2);opacity:0} }
@media (prefers-reduced-motion: reduce) { [data-reward-burst] *{animation-duration:0.3s !important} }
body.eg-anim-off [data-reward-burst] { display: none !important; }
`}</style>
    {bursts.map(b=>(<div key={b.id} data-reward-burst style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9998}}>
      {/* 中央彈出文字（如 COMBO ×3） */}
      {b.text&&<div style={{
        position:"fixed",
        top:b.fromY||"40%",left:b.fromX||"50%",
        fontSize:b.textSize||32,fontWeight:900,
        color:b.textColor||"#FFD700",
        textShadow:"0 0 14px rgba(255,215,0,0.9), 2px 2px 6px rgba(0,0,0,0.4)",
        letterSpacing:2,whiteSpace:"nowrap",
        animation:`rb_pop ${(b.duration||1200)/1000}s ease-out forwards`,
      }}>{b.text}</div>}
      {/* 粒子飛行 */}
      {b.emoji&&Array.from({length:b.count||5}).map((_,i)=>{
        const angle=(i*360/(b.count||5))+(Math.random()*40-20);
        const dist=40+Math.random()*30;
        const startOffsetX=Math.cos(angle*Math.PI/180)*dist;
        const startOffsetY=Math.sin(angle*Math.PI/180)*dist;
        const tx=(b.toX!=null&&b.fromX!=null)?(b.toX-b.fromX-startOffsetX):0;
        const ty=(b.toY!=null&&b.fromY!=null)?(b.toY-b.fromY-startOffsetY):-80-Math.random()*40;
        return(<div key={i} style={{
          position:"fixed",
          top:(b.fromY||window.innerHeight/2)+startOffsetY,
          left:(b.fromX||window.innerWidth/2)+startOffsetX,
          fontSize:b.size||24,
          "--tx":`${tx}px`,"--ty":`${ty}px`,
          "--rot":`${Math.random()*720-360}deg`,
          animation:`rb_fly ${(b.duration||1200)/1000}s ${i*0.05}s ease-out forwards`,
          opacity:0,
          willChange:"transform,opacity",
        }}>{b.emoji}</div>);
      })}
    </div>))}
  </>);
}

// 工具函式：從事件物件取按鈕中心座標
function getEventCenter(e){
  if(!e?.currentTarget)return{x:window.innerWidth/2,y:window.innerHeight/2};
  const r=e.currentTarget.getBoundingClientRect();
  return{x:r.left+r.width/2,y:r.top+r.height/2};
}

// ═══ MAIN APP ═══════════════════════════════════════════════════════
export default function App(){
  const[lv,setLv]=useState(null),[mod,setMod]=useState(null);
  const[menuGroup,setMenuGroup]=useState("learn");
  const[xp,setXp]=useLS("xp",0);
  const[coins,setCoins]=useLS("coins",0);
  const[pets,setPets]=useLS("pets",[]);
  const[eggs,setEggs]=useLS("eggs",[]);
  const[inventory,setInventory]=useLS("inv",{});// {foodId: count}
  const[petAccount,setPetAccount]=useLS("petAcc",null);// {username, pinHash, lastSync}
  const[petTasks,setPetTasks]=useLS("petTasks",{date:"",counts:{}});// daily task counters
  const[loginBonus,setLoginBonus]=useLS("loginBonus",{lastDate:"",streak:0,claimed:false});
  const[installPrompt,setInstallPrompt]=useState(null);// beforeinstallprompt event
  const[installDismissed,setInstallDismissed]=useLS("installDismissed",false);
  const[isOffline,setIsOffline]=useState(!navigator.onLine);
  const[streak,setStreak]=useLS("streak",1);
  const[daily,setDaily]=useLS("daily",{target:10,done:0,date:new Date().toDateString()});
  const[stats,setStats]=useLS("stats",{srsRounds:0,perfectQuiz:0,dictDone:0,scramDone:0});
  const[achUnlocked,setAchUnlocked]=useLS("ach",[]);
  const[dark,setDark]=useLS("dark",false);
  const[gemKey,setGemKey]=useLS("gemkey","");
  const[gifKey,setGifKey]=useLS("gifkey","");
  const[weakWords,setWeakWords]=useLS("weak",[]);
  const[history,setHistory]=useLS("hist",[]);
  const[sponsor,setSponsor]=useLS("sponsor",{code:"",active:false,name:""});
  const[showAch,setShowAch]=useState(null);
  const[sharedWord,setSharedWord]=useState(null);
  const[customDeck,setCustomDeck]=useState(null);
  const isSponsor=sponsor.active;

  // Deep link: detect ?word=xxx&lv=xxx from shared URL
  useEffect(()=>{
    const p=new URLSearchParams(window.location.search);
    const w=p.get("word"),l=p.get("lv"),support=p.get("support");
    if(w&&l&&LV[l]){setMenuGroup("learn");setLv(l);setMod("srs");setSharedWord(w)}
    if(support){setMenuGroup("tools");setLv(LV[l]?l:"elementary");setMod("sponsor")}
    if(w||support)window.history.replaceState({},"",window.location.pathname);
  },[]);

  // Check streak & daily reset + log history
  useEffect(()=>{const today=new Date().toDateString();if(daily.date!==today){
    // Save yesterday's data to history
    if(daily.date&&daily.done>0)setHistory(h=>[...h,{date:daily.date,xp:daily.done*5,done:daily.done}].slice(-60));
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);if(daily.date===yesterday.toDateString()&&daily.done>0)setStreak(s=>s+1);else setStreak(1);setDaily({target:10,done:0,date:today})}},[]);

  // Check achievements
  useEffect(()=>{const s={xp,streak,...stats};ACH_DEFS.forEach(a=>{if(!achUnlocked.includes(a.id)&&a.check(s)){setAchUnlocked(u=>[...u,a.id]);setShowAch(a)}});},[xp,streak,stats]);


  // PWA: listen for install prompt and online/offline
  useEffect(()=>{
    const handleInstallPrompt=(e)=>{e.preventDefault();setInstallPrompt(e)};
    const handleOnline=()=>setIsOffline(false);
    const handleOffline=()=>setIsOffline(true);
    window.addEventListener("beforeinstallprompt",handleInstallPrompt);
    window.addEventListener("online",handleOnline);
    window.addEventListener("offline",handleOffline);
    return()=>{
      window.removeEventListener("beforeinstallprompt",handleInstallPrompt);
      window.removeEventListener("online",handleOnline);
      window.removeEventListener("offline",handleOffline);
    };
  },[]);

  const handleInstall=async()=>{
    if(!installPrompt)return;
    installPrompt.prompt();
    const{outcome}=await installPrompt.userChoice;
    if(outcome==="accepted"){setInstallPrompt(null);playSound("combo")}
  };

  // Daily login bonus check on mount
  const[loginBonusModal,setLoginBonusModal]=useState(null);
  useEffect(()=>{
    const today=new Date().toDateString();
    const yesterday=new Date(Date.now()-86400000).toDateString();
    if(loginBonus.lastDate===today)return;// already checked today
    const isConsecutive=loginBonus.lastDate===yesterday;
    const newStreak=isConsecutive?(loginBonus.streak||0)+1:1;
    setLoginBonus({lastDate:today,streak:newStreak,claimed:false});
    // Show bonus modal after a short delay
    setTimeout(()=>setLoginBonusModal({streak:newStreak}),800);
  },[]);
  
  // Rewards by streak day
  const getLoginReward=(streak)=>{
    if(streak>=30)return{coins:200,xp:100,msg:"🎉 30 天連續登入！傳奇學習者！"};
    if(streak>=14)return{coins:100,xp:60,msg:"🌟 14 天連續登入！超強毅力！"};
    if(streak>=7)return{coins:70,xp:40,msg:"⭐ 連續一週登入！加油！"};
    if(streak>=3)return{coins:40,xp:25,msg:"✨ 連續 3 天！好習慣養成中"};
    return{coins:20,xp:10,msg:"👋 歡迎回來！"};
  };

  const claimLoginBonus=()=>{
    const r=getLoginReward(loginBonusModal.streak);
    setCoins(co=>co+r.coins);
    setXp(x=>x+r.xp);
    setLoginBonus(l=>({...l,claimed:true}));
    setLoginBonusModal(null);
    playSound("combo");
  };

  // Auto-sync pet data to cloud (debounced)
  useEffect(()=>{
    if(!petAccount)return;
    const t=setTimeout(()=>{
      petCloudSave(petAccount.username,petAccount.pinHash,{pets,eggs,inventory,coins});
    },1500);
    return()=>clearTimeout(t);
  },[pets,eggs,inventory,coins,petAccount]);

  const addXp=(n=5)=>{
    setXp(x=>x+n);
    setCoins(co=>co+Math.max(1,Math.floor(n/3)));// 1-5 coins per action
    setDaily(d=>({...d,done:Math.min(d.done+1,d.target)}));
    // Progress eggs
    setEggs(es=>es.map(e=>e.progress<EGG_HATCH_TASKS[e.rarity]?{...e,progress:e.progress+1}:e));
  };
  // Track daily pet task progress
  const incrTask=(key,amount=1)=>{
    const today=new Date().toDateString();
    setPetTasks(t=>{
      if(t.date!==today)return{date:today,counts:{[key]:amount}};
      return{...t,counts:{...t.counts,[key]:(t.counts[key]||0)+amount}};
    });
  };
  // Helper passed to learning modules so they count toward pet tasks too
  const addXpWithTask=(n=5,taskKey=null)=>{
    addXp(n);
    if(taskKey)incrTask(taskKey);
  };
  const trackWeak=(word)=>{setWeakWords(w=>{const e=w.find(x=>x.w===word);if(e)return w.map(x=>x.w===word?{...x,n:x.n+1}:x);return[...w,{w:word,n:1}].slice(-50)})};

  useEffect(()=>{
    const r=document.documentElement.style;
    r.colorScheme=dark?"dark":"light";
    const vars=dark?{
      '--color-background-primary':'#171B2D',
      '--color-background-secondary':'#202744',
      '--color-background-tertiary':'#090B1D',
      '--color-text-primary':'#F8FAFC',
      '--color-text-secondary':'#D5DCEF',
      '--color-text-tertiary':'#AAB4CE',
      '--color-border-tertiary':'#3A4264',
      '--eg-app-background':'linear-gradient(180deg,#0B0D22 0%,#10142E 42%,#080A18 100%)',
      '--eg-nav-background':'rgba(18,23,42,.92)',
      '--eg-card-shadow':'0 18px 42px rgba(0,0,0,.28)',
      '--eg-menu-hero-bg':'linear-gradient(135deg,rgba(52,211,153,.22) 0%,rgba(31,41,85,.94) 44%,rgba(9,11,29,.98) 100%)',
      '--eg-menu-card-bg':'linear-gradient(145deg,rgba(32,39,68,.96),rgba(21,26,47,.98))',
      '--eg-menu-panel-bg':'linear-gradient(145deg,rgba(26,33,60,.98),rgba(15,19,39,.98))',
      '--eg-hero-word':'#FFFFFF',
      '--eg-soft-track':'rgba(255,255,255,.14)',
    }:{
      '--color-background-primary':'#FFFFFF',
      '--color-background-secondary':'#F3F7F2',
      '--color-background-tertiary':'#FFFDF7',
      '--color-text-primary':'#1F2522',
      '--color-text-secondary':'#53625B',
      '--color-text-tertiary':'#7A857F',
      '--color-border-tertiary':'#D9E4DC',
      '--eg-app-background':'linear-gradient(180deg,#FFF8E8 0%,#F4FBF4 44%,#F7FAFF 100%)',
      '--eg-nav-background':'rgba(255,255,255,.88)',
      '--eg-card-shadow':'0 16px 36px rgba(20,66,52,.10)',
      '--eg-menu-hero-bg':'linear-gradient(135deg,#E6FFF3 0%,#FFFFFF 47%,#FFF1D8 100%)',
      '--eg-menu-card-bg':'linear-gradient(145deg,#FFFFFF,#F9FFFC)',
      '--eg-menu-panel-bg':'linear-gradient(145deg,#FFFFFF,#F7FFFB)',
      '--eg-hero-word':'#202522',
      '--eg-soft-track':'rgba(25,52,43,.10)',
    };
    Object.entries(vars).forEach(([k,v])=>r.setProperty(k,v));
  },[dark]);

  const openLandingFeature=(targetLevel,targetModule)=>{
    const nextLevel=LV[targetLevel]?targetLevel:"elementary";
    const targetGroup={
      songs:"read",novels:"read",reading:"read",dictation:"read",story:"read",
      whack:"game",match:"game",bomb:"game",scramble:"game",petMonopoly:"game",
      gacha:"pet",pets:"pet",petAdventure:"pet",
      achievements:"tools",weak:"tools",dashboard:"tools",settings:"tools",sponsor:"tools",
    }[targetModule]||"learn";
    setSharedWord(null);
    setCustomDeck(null);
    setMenuGroup(targetGroup);
    setLv(nextLevel);
    setMod(targetModule||null);
  };

  if(!lv)return<Landing onSelect={nextLv=>{setMenuGroup("learn");setLv(nextLv)}} onOpenFeature={openLandingFeature} dark={dark} setDark={setDark} keyMissing={!gemKey?.trim()||!gifKey?.trim()}/>;
  const c=LV[lv],back=()=>setMod(null);
  const openModule=(nextMod,group)=>{
    setSharedWord(null);
    setCustomDeck(null);
    if(group)setMenuGroup(group);
    setMod(nextMod);
  };

  return(
    <div style={{minHeight:"100vh",background:"var(--eg-app-background,var(--color-background-tertiary,#f8f7f4))",color:S.t1,fontFamily:"'Noto Sans TC','Segoe UI',sans-serif"}}>
      {/* Offline indicator - top bar */}
      {isOffline&&<div style={{position:"sticky",top:0,zIndex:100,background:"#EF9F27",color:"#fff",padding:"8px 14px",textAlign:"center",fontSize:12,fontWeight:600,letterSpacing:.5}}>
        📡 離線模式 · 已上過的內容可以繼續使用
      </div>}

      {/* Install to home screen banner */}
      {installPrompt&&!installDismissed&&<div style={{position:"sticky",top:isOffline?34:0,zIndex:99,background:`linear-gradient(135deg,${c.cl},${c.ac})`,color:"#fff",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 2px 8px rgba(0,0,0,.15)"}}>
        <div style={{fontSize:24}}>📱</div>
        <div style={{flex:1,fontSize:12,lineHeight:1.4}}>
          <div style={{fontWeight:700}}>安裝 EnglishGo 到主畫面</div>
          <div style={{opacity:.9,fontSize:11}}>離線也能用！像 App 一樣</div>
        </div>
        <button onClick={handleInstall} style={{background:"#fff",color:c.cl,border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>安裝</button>
        <button onClick={()=>setInstallDismissed(true)} style={{background:"rgba(255,255,255,.2)",color:"#fff",border:"none",borderRadius:8,padding:"8px 10px",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
      </div>}
      {/* Daily Login Bonus Modal */}
      {loginBonusModal&&(()=>{const r=getLoginReward(loginBonusModal.streak);return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeUp .3s"}} onClick={claimLoginBonus}>
        <div style={{background:"var(--color-background-primary,#fff)",borderRadius:24,padding:"32px 24px",maxWidth:340,width:"100%",textAlign:"center",border:`3px solid ${c.cl}`,boxShadow:`0 12px 32px ${c.cl}44`,animation:"bounceIn .5s ease-out"}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:56,marginBottom:10,animation:"emojiBounce 1s ease-in-out infinite"}}>🎁</div>
          <div style={{fontSize:20,fontWeight:700,color:S.t1}}>每日登入獎勵</div>
          <div style={{fontSize:13,color:S.t2,marginTop:6}}>{r.msg}</div>

          {/* Streak display */}
          <div style={{margin:"16px 0",padding:"14px 12px",background:`linear-gradient(135deg,${c.cl}22,${c.ac}22)`,borderRadius:12,border:`2px dashed ${c.cl}66`}}>
            <div style={{fontSize:11,color:S.t3,letterSpacing:1}}>連續登入</div>
            <div style={{fontSize:36,fontWeight:700,color:c.cl,fontFamily:"monospace",lineHeight:1}}>{loginBonusModal.streak} <span style={{fontSize:14,color:S.t2}}>天</span></div>
            <div style={{fontSize:20,marginTop:4}}>{"🔥".repeat(Math.min(loginBonusModal.streak,7))}</div>
          </div>

          {/* Rewards */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
            <div style={{padding:"12px 8px",background:"#FFF3CD",border:"1px solid #EF9F27",borderRadius:10}}>
              <div style={{fontSize:20}}>🪙</div>
              <div style={{fontSize:18,fontWeight:700,color:"#856404"}}>+{r.coins}</div>
              <div style={{fontSize:10,color:"#856404"}}>金幣</div>
            </div>
            <div style={{padding:"12px 8px",background:"#E1F5EE",border:"1px solid #1D9E75",borderRadius:10}}>
              <div style={{fontSize:20}}>⭐</div>
              <div style={{fontSize:18,fontWeight:700,color:"#0F6E56"}}>+{r.xp}</div>
              <div style={{fontSize:10,color:"#0F6E56"}}>經驗</div>
            </div>
          </div>

          {/* Streak milestones */}
          <div style={{marginBottom:14,fontSize:11,color:S.t3,lineHeight:1.6}}>
            下一個獎勵：
            {loginBonusModal.streak<3&&<> 連續 3 天 → +40 🪙</>}
            {loginBonusModal.streak>=3&&loginBonusModal.streak<7&&<> 連續 7 天 → +70 🪙</>}
            {loginBonusModal.streak>=7&&loginBonusModal.streak<14&&<> 連續 14 天 → +100 🪙</>}
            {loginBonusModal.streak>=14&&loginBonusModal.streak<30&&<> 連續 30 天 → +200 🪙</>}
            {loginBonusModal.streak>=30&&<> 🏆 已達最高獎勵！</>}
          </div>

          <button onClick={claimLoginBonus} style={{...S.btn,background:`linear-gradient(135deg,${c.cl},${c.ac})`,color:"#fff",padding:"14px 28px",fontSize:15,width:"100%"}}>✨ 領取獎勵</button>
        </div>
      </div>)})()}
      {/* Global mobile styles */}
      <style>{`
        *{-webkit-tap-highlight-color:transparent;box-sizing:border-box}
        html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
        body{overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch}
        button{touch-action:manipulation}
        input{font-size:16px!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes bounceIn{0%{transform:scale(0)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
        @keyframes comboFlash{0%{transform:scale(1.5);opacity:0}50%{opacity:1}100%{transform:scale(1)}}
        @keyframes cardFlip{0%{transform:rotateY(90deg);opacity:0.3}100%{transform:rotateY(0deg);opacity:1}}
        @keyframes confDrop{0%{transform:translateY(-10vh) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
        @keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,50,50,.4)}50%{box-shadow:0 0 0 16px rgba(220,50,50,0)}}
        @keyframes moleShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
        @keyframes molePop{0%{transform:scale(0) translateY(10px)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
        @keyframes matchFlip{0%{transform:rotateY(0)}50%{transform:rotateY(90deg)}100%{transform:rotateY(0)}}
        @keyframes emojiBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes emojiFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-10px) rotate(3deg)}}
        @keyframes emojiSpin{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(1.1)}100%{transform:rotate(360deg) scale(1)}}
        @keyframes emojiWiggle{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}
        @keyframes emojiPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
        @keyframes emojiSwing{0%,100%{transform:rotate(0deg)}25%{transform:rotate(15deg)}75%{transform:rotate(-15deg)}}
        @keyframes sparkleFloat{0%,100%{transform:translateY(0) scale(1);opacity:.25}50%{transform:translateY(-8px) scale(1.3);opacity:.5}}
        @keyframes mascotJump{0%{transform:translateY(0)}30%{transform:translateY(-12px) scale(1.2)}60%{transform:translateY(0)}80%{transform:translateY(-4px)}100%{transform:translateY(0)}}
        @keyframes mascotIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
      `}</style>
      {showAch&&<div onClick={()=>setShowAch(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><div style={{...S.card,padding:"32px 40px",textAlign:"center",animation:"fadeUp .4s ease-out"}}><div style={{fontSize:56}}>{showAch.icon}</div><div style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>成就解鎖！</div><div style={{fontSize:16,fontWeight:600,color:c.cl,marginTop:4}}>{showAch.name}</div><div style={{fontSize:13,color:S.t2,marginTop:4}}>{showAch.desc}</div><div style={{fontSize:11,color:S.t3,marginTop:12}}>點擊關閉</div></div></div>}
      <RewardBurstHost/>
      <nav style={{background:"var(--eg-nav-background,var(--color-background-primary,#fff))",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",borderBottom:`1px solid ${S.bd}`,boxShadow:"0 8px 24px rgba(0,0,0,.06)",padding:"8px 12px",paddingTop:"calc(8px + env(safe-area-inset-top, 0px))",display:"flex",alignItems:"center",gap:6,position:"sticky",top:0,zIndex:100}}>
        <button onClick={()=>{setMenuGroup("learn");setLv(null);setMod(null)}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",padding:"4px",minWidth:32,minHeight:32,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
        <span style={{fontSize:14}}>{c.ic}</span>
        <span style={{fontWeight:600,color:c.cl,fontSize:14,flex:1}}>{c.l}</span>
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:S.t3}}>
          <span>🔥{streak}</span>
          <span>⭐{xp}</span>
          <span style={{display:"none"}}>{daily.done}/{daily.target}</span>
        </div>
        <VoicePicker/>
        <button onClick={()=>setDark(!dark)} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",minWidth:32,minHeight:32,display:"flex",alignItems:"center",justifyContent:"center"}}>{dark?"☀️":"🌙"}</button>
      </nav>
      <div style={{maxWidth:!mod?940:mod==="petAdventure"?1280:mod==="petMonopoly"?1180:mod==="srs"?1080:760,margin:"0 auto",padding:mod==="petAdventure"||mod==="petMonopoly"?"14px 18px calc(20px + env(safe-area-inset-bottom, 0px))":"12px 12px calc(16px + env(safe-area-inset-bottom, 0px))"}}>
        {!mod?<MenuV2 lv={lv} onSelect={openModule} activeGroup={menuGroup} onGroupChange={setMenuGroup} daily={daily} c={c} xp={xp} coins={coins} streak={streak} achUnlocked={achUnlocked} weakWords={weakWords} isSponsor={isSponsor} pets={pets} eggs={eggs}/>:
         mod==="wordsearch"?<WordSearchM lv={lv} onBack={back} onOpenCard={(word,level)=>{setLv(level||lv);setSharedWord(word);setCustomDeck(null);setMod("srs")}}/>:
         mod==="exam"?<ExamReviewM lv={lv} onBack={back} c={c} apiKey={gemKey} onOpenSettings={()=>setMod("settings")} onStart={deck=>{setSharedWord(null);setCustomDeck(deck);setMod("srs")}}/>:
         mod==="srs"?<SRS lv={lv} onBack={back} onXp={n=>addXpWithTask(n,"srsToday")} onDone={()=>setStats(s=>({...s,srsRounds:s.srsRounds+1}))} trackWeak={trackWeak} gifKey={gifKey} sharedWord={sharedWord} apiKey={gemKey} weakWords={weakWords} customCards={customDeck?.cards||null} customSource={customDeck?.source||""} onOpenSettings={()=>setMod("settings")}/>:
         mod==="quiz"?<QuizM lv={lv} onBack={back} onXp={n=>addXpWithTask(n,"quizToday")} onPerfect={()=>setStats(s=>({...s,perfectQuiz:s.perfectQuiz+1}))} trackWeak={trackWeak}/>:
         mod==="speak"?<SpeakM lv={lv} onBack={back} onXp={n=>addXpWithTask(n,"speakToday")} apiKey={gemKey} onOpenSettings={()=>setMod("settings")}/>:
         mod==="whack"?<WhackM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="match"?<MatchM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="bomb"?<BombM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="petMonopoly"?<PetMonopolyM lv={lv} onBack={back} onXp={addXp} c={c} pets={pets} setPets={setPets} coins={coins} setCoins={setCoins}/>:
         mod==="grammar"?<GrammarM lv={lv} onBack={back} onXp={addXp} apiKey={gemKey} onOpenSettings={()=>setMod("settings")}/>:
         mod==="reading"?<ReadingM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="novels"?<NovelM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="songs"?<SongsM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="dictation"?<DictM lv={lv} onBack={back} onXp={addXp} onDone={()=>setStats(s=>({...s,dictDone:s.dictDone+1}))}/>:
         mod==="scramble"?<ScramM lv={lv} onBack={back} onXp={addXp} onDone={()=>setStats(s=>({...s,scramDone:s.scramDone+1}))}/>:
         mod==="ai"?<AIT lv={lv} onBack={back} apiKey={gemKey} onOpenSettings={()=>setMod("settings")}/>:
         mod==="story"?<StoryMode lv={lv} onBack={back} apiKey={gemKey} pets={pets} c={c} onXp={addXp} trackWeak={trackWeak} onOpenSettings={()=>setMod("settings")}/>:
         mod==="achievements"?<AchPage onBack={back} unlocked={achUnlocked} c={c}/>:
         mod==="weak"?<WeakPage onBack={back} weakWords={weakWords} setWeakWords={setWeakWords} c={c} lv={lv}/>:
         mod==="dashboard"?<Dashboard onBack={back} c={c} xp={xp} streak={streak} stats={stats} daily={daily} weakWords={weakWords} history={history} achUnlocked={achUnlocked} lv={lv} isSponsor={isSponsor}/>:
         mod==="settings"?<SettingsPage onBack={back} c={c} gemKey={gemKey} setGemKey={setGemKey} gifKey={gifKey} setGifKey={setGifKey}/>:
         mod==="gacha"?<GachaPage onBack={back} c={c} coins={coins} setCoins={setCoins} eggs={eggs} setEggs={setEggs} pets={pets} setPets={setPets}/>:
         mod==="pets"?<PetsGuard onBack={back} c={c} pets={pets} setPets={setPets} eggs={eggs} setEggs={setEggs} coins={coins} setCoins={setCoins} inventory={inventory} setInventory={setInventory} petAccount={petAccount} setPetAccount={setPetAccount} petTasks={petTasks} setPetTasks={setPetTasks} incrTask={incrTask}/>:
         mod==="petAdventure"?<PetAdventurePage lv={lv} onBack={back} c={c} pets={pets} setPets={setPets} eggs={eggs} setEggs={setEggs} coins={coins} setCoins={setCoins} inventory={inventory} setInventory={setInventory}/>:
         mod==="sponsor"?<SponsorPage onBack={back} c={c} sponsor={sponsor} setSponsor={setSponsor}/>:null}
        {/* Ad Banner — hidden for sponsors */}
        {/* No ads — pure learning experience */}
      </div>
      {/* Footer */}
      <footer style={{textAlign:"center",padding:"20px 16px calc(28px + env(safe-area-inset-bottom, 0px))",fontSize:11,color:S.t3,lineHeight:1.8,borderTop:`1px solid ${S.bd}`,marginTop:16}}>
        <div style={{maxWidth:480,margin:"0 auto"}}>
          <div style={{fontWeight:600,fontSize:12,color:S.t2,marginBottom:6}}>📘 如何使用 EnglishGo</div>
          <div style={{marginBottom:8}}>選擇等級（小學／國中／高中）後，透過 SRS 單字卡記憶單字，搭配口說練習、打地鼠拼字、配對翻牌等遊戲強化學習。AI 家教可即時回答英文問題。每天練習 10 題即可累積經驗值與成就徽章！</div>
          <div style={{marginBottom:8}}><button onClick={()=>{setMenuGroup("tools");setMod("settings")}} style={{background:"none",border:"none",padding:0,color:c.cl,textDecoration:"underline",font:"inherit",cursor:"pointer"}}>🔑 Key 設定</button> · <a href="/learn/api-keys.html" style={{color:c.cl,textDecoration:"underline"}}>API Key 申請教學</a> · <a href="/learn/gif-guide.html" style={{color:c.cl,textDecoration:"underline"}}>🖼️ 單字動圖說明</a> · <button onClick={()=>{setMenuGroup("tools");setMod("sponsor")}} style={{background:"none",border:"none",padding:0,color:c.cl,textDecoration:"underline",font:"inherit",cursor:"pointer"}}>☕ 支持我們</button></div>
          <div style={{display:"inline-block",fontSize:10,color:"#1D9E75",fontWeight:600,padding:"3px 10px",background:"#E1F5EE",borderRadius:10,marginBottom:6}}>✨ 100% 無廣告 · 純淨學習空間</div>
          <div>AI Tutor powered by <b>Gemini</b> · Speech by <b>Web Speech API</b></div>
          <div>© {new Date().getFullYear()} EnglishGo · 專為台灣學生設計</div>
        </div>
      </footer>
    </div>
  );
}

function SettingsPage({onBack,c,gemKey,setGemKey,gifKey,setGifKey}){
  const[gemInp,setGemInp]=useState(gemKey||"");
  const[gifInp,setGifInp]=useState(gifKey||"");
  const[showGem,setShowGem]=useState(false);
  const[showGif,setShowGif]=useState(false);
  const[saved,setSaved]=useState("");
  useEffect(()=>setGemInp(gemKey||""),[gemKey]);
  useEffect(()=>setGifInp(gifKey||""),[gifKey]);
  const flash=id=>{setSaved(id);window.setTimeout(()=>setSaved(""),1200)};
  const saveGem=()=>{setGemKey(gemInp.trim());flash("gem")};
  const saveGif=()=>{setGifKey(gifInp.trim());flash("gif")};
  const clearGem=()=>{setGemInp("");setGemKey("");flash("gem-clear")};
  const clearGif=()=>{setGifInp("");setGifKey("");flash("gif-clear")};
  const status=ok=>(
    <span style={{fontSize:11,fontWeight:900,color:ok?c.cl:S.t3,background:ok?c.bg:S.bg2,border:`1px solid ${ok?`${c.cl}33`:S.bd}`,borderRadius:999,padding:"4px 9px"}}>
      {ok?"已設定":"未設定"}
    </span>
  );
  const pill=t=><span key={t} style={{fontSize:11,color:c.cl,fontWeight:900,background:c.bg,border:`1px solid ${c.cl}26`,borderRadius:999,padding:"5px 9px"}}>{t}</span>;
  const inputStyle={width:"100%",padding:"11px 12px",borderRadius:12,border:`1px solid ${S.bd}`,fontSize:13,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"};
  return(<div>
    <Hdr t="API Key 設定" onBack={onBack} cl={c.cl}/>
    <div style={{...S.card,padding:"18px 20px",marginBottom:12,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
      <div style={{fontSize:18,fontWeight:1000,color:S.t1,marginBottom:6}}>統一管理外部服務 Key</div>
      <div style={{fontSize:13,color:S.t2,lineHeight:1.7}}>Key 只會儲存在目前瀏覽器的 localStorage，用來呼叫 Gemini 與 Giphy；不會寫入雲端資料庫。</div>
    </div>

    <section style={{...S.card,padding:"18px 20px",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:12}}>
        <div>
          <div style={{fontSize:16,fontWeight:1000,color:S.t1}}>Gemini API Key</div>
          <div style={{fontSize:12,color:S.t3,marginTop:3}}>AI 例句、AI 字典、家教與故事模式共用</div>
        </div>
        {status(!!gemKey?.trim())}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
        {["SRS AI 例句","SRS 小朋友字典","AI 家教","AI 故事"].map(pill)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:8,alignItems:"center"}}>
        <input value={gemInp} onChange={e=>setGemInp(e.target.value)} type={showGem?"text":"password"} placeholder="貼上 Gemini API Key" style={inputStyle}/>
        <button onClick={()=>setShowGem(v=>!v)} style={{...S.btn,background:S.bg2,color:S.t2,padding:"10px 12px",fontSize:12}}>{showGem?"隱藏":"顯示"}</button>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginTop:10}}>
        <button onClick={saveGem} style={{...S.btn,background:c.cl,color:"#fff",padding:"10px 16px",fontSize:13}}>儲存 Gemini Key</button>
        <button onClick={clearGem} style={{...S.btn,background:S.bg2,color:S.t2,padding:"10px 14px",fontSize:13}}>清除</button>
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:c.cl,fontWeight:900,textDecoration:"underline"}}>Google AI Studio</a>
        {(saved==="gem"||saved==="gem-clear")&&<span style={{fontSize:12,color:c.cl,fontWeight:900}}>已更新</span>}
      </div>
    </section>

    <section style={{...S.card,padding:"18px 20px",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:12}}>
        <div>
          <div style={{fontSize:16,fontWeight:1000,color:S.t1}}>Giphy API Key</div>
          <div style={{fontSize:12,color:S.t3,marginTop:3}}>可選，用來在 SRS 單字卡顯示相關 GIF 動圖</div>
        </div>
        {status(!!gifKey?.trim())}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
        {["SRS 單字動圖"].map(pill)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:8,alignItems:"center"}}>
        <input value={gifInp} onChange={e=>setGifInp(e.target.value)} type={showGif?"text":"password"} placeholder="貼上 Giphy API Key，可留空關閉" style={inputStyle}/>
        <button onClick={()=>setShowGif(v=>!v)} style={{...S.btn,background:S.bg2,color:S.t2,padding:"10px 12px",fontSize:12}}>{showGif?"隱藏":"顯示"}</button>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginTop:10}}>
        <button onClick={saveGif} style={{...S.btn,background:c.cl,color:"#fff",padding:"10px 16px",fontSize:13}}>儲存 Giphy Key</button>
        <button onClick={clearGif} style={{...S.btn,background:S.bg2,color:S.t2,padding:"10px 14px",fontSize:13}}>清除</button>
        <a href="/learn/gif-guide.html" target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:c.cl,fontWeight:900,textDecoration:"underline"}}>動圖設定教學</a>
        {(saved==="gif"||saved==="gif-clear")&&<span style={{fontSize:12,color:c.cl,fontWeight:900}}>已更新</span>}
      </div>
    </section>
  </div>);
}

// ═══ LANDING ════════════════════════════════════════════════════════
function Landing({onSelect,onOpenFeature,dark,setDark,keyMissing=false}){
  const[hov,setHov]=useState(null);
  const recentFeatures=(RECENT_FEATURES?.length?RECENT_FEATURES:[]).slice(0,3);
  const features=[
    {i:"🃏",t:"SRS 記憶",d:"間隔重複背單字",tone:"#10B981"},
    {i:"🎧",t:"聽說練習",d:"朗讀、聽寫、口說",tone:"#3B82F6"},
    {i:"🧩",t:"互動遊戲",d:"配對、拼字、打地鼠",tone:"#F59E0B"},
    {i:"🤖",t:"AI 家教",d:"即時問答與提示",tone:"#8B5CF6"},
    {i:"🐾",t:"寵物養成",d:"學習累積成長",tone:"#EC4899"},
    {i:"📚",t:"故事歌曲",d:"閱讀與跟讀輸入",tone:"#06B6D4"},
  ];
  const articles=[
    {href:"/learn/srs-method.html",t:"SRS 間隔重複",d:"用科學方式記住單字",ic:"🧠",tone:"#10B981"},
    {href:"/learn/speaking-tips.html",t:"英文口說提升",d:"不用出國也能練",ic:"🗣️",tone:"#3B82F6"},
    {href:"/learn/vocabulary-guide.html",t:"會考單字攻略",d:"國中 1200 字準備法",ic:"📚",tone:"#F59E0B"},
    {href:"/learn/api-keys.html",t:"API Key 教學",d:keyMissing?"尚有 Key 未設定，點這裡查看":"Gemini 與動圖設定",ic:"🔑",tone:"#8B5CF6",highlight:keyMissing},
    {href:"/learn/gif-guide.html",t:"單字動圖效果",d:"申請前先看差異",ic:"🖼️",tone:"#EC4899"},
    {href:"/?support=1",t:"支持 EnglishGo",d:"銀行轉帳與留言",ic:"☕",tone:"#0F766E"},
  ];
  const RecentCard=({item,i})=>(
    <button className="eg-update-card" type="button" onClick={()=>onOpenFeature?.(item.targetLevel,item.targetModule)} style={{"--update-color":item.tone,"--update-index":i}}>
      <span className="eg-update-icon">{item.icon}</span>
      <span style={{minWidth:0}}>
        <span className="eg-update-meta"><span className="eg-update-category">{item.category||"功能"}</span><span className="eg-update-level">{item.level}</span><span className="eg-update-date">{item.date}</span></span>
        <span className="eg-update-title">{item.title}</span>
        <span className="eg-update-desc">{item.description}</span>
      </span>
    </button>
  );
  return(<div className={`eg-landing ${dark?"is-dark":"is-light"}`}>
    <style>{`
      .eg-landing{--landing-text:${dark?"#F8FAFC":"#18211D"};--landing-muted:${dark?"#C9D4EA":"#5D6B64"};--landing-faint:${dark?"#8FA0C2":"#7B8882"};--landing-card:${dark?"rgba(25,32,58,.82)":"rgba(255,255,255,.86)"};--landing-border:${dark?"rgba(154,170,210,.28)":"rgba(13,118,90,.18)"};min-height:100vh;color:var(--landing-text);font-family:'Noto Sans TC','Segoe UI',sans-serif;background:${dark?"linear-gradient(180deg,#080A1A 0%,#101735 44%,#070812 100%)":"linear-gradient(180deg,#FFF4D6 0%,#EFFFF6 48%,#F8FBFF 100%)"};position:relative;overflow:hidden}
      .eg-landing,.eg-landing *{box-sizing:border-box}
      .eg-landing:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(135deg,${dark?"rgba(255,255,255,.035)":"rgba(15,110,86,.045)"} 0 1px,transparent 1px 34px);pointer-events:none}
      .eg-landing-shell{position:relative;z-index:1;max-width:1040px;margin:0 auto;padding:42px 18px 44px}
      .eg-landing-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:28px}
      .eg-landing-brand{display:inline-flex;align-items:center;gap:11px;border:1px solid var(--landing-border);background:var(--landing-card);border-radius:999px;padding:9px 16px;box-shadow:${dark?"0 14px 34px rgba(0,0,0,.25)":"0 14px 34px rgba(20,66,52,.10)"};backdrop-filter:blur(14px)}
      .eg-landing-brand strong{font-size:22px;letter-spacing:0}
      .eg-theme-toggle{border:1px solid var(--landing-border);background:var(--landing-card);color:var(--landing-text);border-radius:999px;padding:9px 14px;font:inherit;font-size:12px;font-weight:900;cursor:pointer;box-shadow:${dark?"0 12px 28px rgba(0,0,0,.22)":"0 12px 28px rgba(20,66,52,.08)"}}
      .eg-landing-hero{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px;align-items:stretch;margin-bottom:18px}
      .eg-landing-copy{border:1px solid var(--landing-border);border-radius:28px;background:${dark?"linear-gradient(145deg,rgba(24,32,67,.88),rgba(11,14,32,.92))":"linear-gradient(145deg,rgba(255,255,255,.9),rgba(236,255,246,.86))"};padding:28px;box-shadow:${dark?"0 22px 54px rgba(0,0,0,.28)":"0 22px 54px rgba(20,66,52,.12)"};position:relative;overflow:hidden}
      .eg-landing-copy:after{content:"";position:absolute;left:0;right:0;bottom:0;height:6px;background:linear-gradient(90deg,#10B981,#3B82F6,#F59E0B,#EC4899)}
      .eg-landing-kicker{display:inline-flex;align-items:center;gap:7px;border:1px solid ${dark?"rgba(52,211,153,.32)":"rgba(16,185,129,.24)"};background:${dark?"rgba(16,185,129,.13)":"rgba(16,185,129,.10)"};color:${dark?"#7FFFD1":"#08745A"};border-radius:999px;padding:7px 12px;font-size:12px;font-weight:1000;margin-bottom:16px}
      .eg-landing h1{font-size:clamp(34px,6vw,60px);line-height:1.02;margin:0 0 14px;font-weight:1000;letter-spacing:0}
      .eg-landing h1 span{background:linear-gradient(92deg,#10B981,#3B82F6 48%,#EC4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
      .eg-landing-lead{font-size:16px;line-height:1.85;color:var(--landing-muted);max-width:620px;margin:0}
      .eg-recent-updates{margin-top:16px;border:1px solid var(--landing-border);border-radius:18px;background:${dark?"linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.02))":"linear-gradient(135deg,rgba(255,255,255,.72),rgba(243,255,249,.58))"};padding:10px;position:relative;overflow:hidden;min-width:0;max-width:760px}
      .eg-recent-updates:before{content:"";position:absolute;inset:-60% 42% auto auto;width:150px;height:150px;border-radius:999px;background:radial-gradient(circle,color-mix(in srgb,#10B981 20%,transparent),transparent 65%);animation:updateGlow 5.5s ease-in-out infinite;pointer-events:none}
      .eg-recent-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}
      .eg-recent-title{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:1000;color:var(--landing-text)}
      .eg-recent-title span{font-size:11px;color:${dark?"#7FFFD1":"#08745A"};background:${dark?"rgba(16,185,129,.16)":"rgba(16,185,129,.11)"};border:1px solid ${dark?"rgba(52,211,153,.28)":"rgba(16,185,129,.22)"};border-radius:999px;padding:3px 7px}
      .eg-recent-source{font-size:10px;color:var(--landing-faint);font-weight:800;white-space:nowrap}
      .eg-recent-layout{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;min-width:0}
      .eg-update-card{position:relative;overflow:hidden;display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;border:1px solid color-mix(in srgb,var(--update-color) 26%,var(--landing-border));border-radius:14px;background:${dark?"rgba(255,255,255,.045)":"rgba(255,255,255,.72)"};padding:8px 9px;text-decoration:none;color:var(--landing-text);box-shadow:0 8px 18px color-mix(in srgb,var(--update-color) 7%,transparent);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease;min-width:0;font:inherit;text-align:left;cursor:pointer}
      .eg-update-card:after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent,color-mix(in srgb,var(--update-color) 10%,transparent),transparent);opacity:.75;transform:translateX(-120%);animation:updateSweep 4.8s ease-in-out infinite;animation-delay:calc(var(--update-index) * .55s);pointer-events:none}
      .eg-update-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--update-color) 64%,var(--landing-border));box-shadow:0 14px 28px color-mix(in srgb,var(--update-color) 14%,transparent)}
      .eg-update-icon{width:32px;height:32px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--update-color) 14%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--update-color) 16%,transparent);font-size:18px;flex:0 0 auto}
      .eg-update-meta{display:flex;align-items:center;gap:4px;min-width:0;margin-bottom:2px}
      .eg-update-level{font-size:9px;font-weight:1000;color:var(--update-color);background:color-mix(in srgb,var(--update-color) 12%,transparent);border-radius:999px;padding:2px 5px;white-space:nowrap}
      .eg-update-category{font-size:9px;font-weight:1000;color:var(--landing-text);background:${dark?"rgba(255,255,255,.07)":"rgba(255,255,255,.76)"};border:1px solid color-mix(in srgb,var(--update-color) 20%,transparent);border-radius:999px;padding:2px 5px;white-space:nowrap}
      .eg-update-date{font-size:9px;color:var(--landing-faint);font-weight:800}
      .eg-update-title{display:block;font-size:12px;font-weight:1000;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .eg-update-desc{display:block;font-size:10px;color:var(--landing-faint);line-height:1.35;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      @keyframes updateSweep{0%,62%,100%{transform:translateX(-120%)}78%{transform:translateX(120%)}}
      @keyframes updateGlow{0%,100%{transform:translate3d(0,0,0);opacity:.55}50%{transform:translate3d(-20px,18px,0);opacity:.95}}
      .eg-level-stack{display:grid;gap:12px}
      .eg-level-card{border:1px solid color-mix(in srgb,var(--level-color) 42%,var(--landing-border));background:${dark?"linear-gradient(145deg,rgba(28,36,70,.88),rgba(17,22,45,.96))":"linear-gradient(145deg,#FFFFFF,#F9FFFC)"};border-radius:22px;padding:17px 16px;text-align:left;color:var(--landing-text);cursor:pointer;font:inherit;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;box-shadow:0 14px 30px color-mix(in srgb,var(--level-color) 12%,transparent);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
      .eg-level-card:hover{transform:translateY(-3px);box-shadow:0 18px 38px color-mix(in srgb,var(--level-color) 20%,transparent);border-color:color-mix(in srgb,var(--level-color) 72%,var(--landing-border))}
      .eg-level-icon{width:48px;height:48px;border-radius:17px;display:flex;align-items:center;justify-content:center;font-size:25px;background:color-mix(in srgb,var(--level-color) 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--level-color) 18%,transparent)}
      .eg-level-title{display:block;font-size:20px;font-weight:1000;line-height:1.2}
      .eg-level-sub{display:block;font-size:12px;color:var(--landing-faint);margin-top:2px}
      .eg-level-badge{font-size:12px;font-weight:1000;color:var(--level-color);background:color-mix(in srgb,var(--level-color) 12%,transparent);border-radius:999px;padding:5px 9px;white-space:nowrap}
      .eg-feature-marquee{position:relative;overflow:hidden;border:1px solid var(--landing-border);border-radius:22px;background:${dark?"linear-gradient(135deg,rgba(25,32,58,.72),rgba(20,26,48,.88))":"linear-gradient(135deg,rgba(255,255,255,.68),rgba(241,255,249,.76))"};box-shadow:${dark?"0 12px 30px rgba(0,0,0,.18)":"0 12px 28px rgba(20,66,52,.08)"};margin:18px 0;padding:12px 0;backdrop-filter:blur(14px)}
      .eg-feature-marquee:before,.eg-feature-marquee:after{content:"";position:absolute;top:0;bottom:0;width:64px;z-index:2;pointer-events:none}
      .eg-feature-marquee:before{left:0;background:linear-gradient(90deg,var(--landing-card),transparent)}
      .eg-feature-marquee:after{right:0;background:linear-gradient(270deg,var(--landing-card),transparent)}
      .eg-feature-track{display:flex;gap:10px;width:max-content;animation:featureMarquee 28s linear infinite}
      .eg-feature-marquee:hover .eg-feature-track{animation-play-state:paused}
      .eg-feature{flex:0 0 auto;min-width:178px;border:1px solid color-mix(in srgb,var(--feature-color) 24%,var(--landing-border));border-radius:16px;background:${dark?"rgba(255,255,255,.045)":"rgba(255,255,255,.72)"};padding:11px 13px;display:flex;align-items:center;gap:10px;box-shadow:${dark?"0 8px 20px rgba(0,0,0,.12)":"0 8px 20px rgba(20,66,52,.05)"};user-select:none}
      .eg-feature-icon{width:34px;height:34px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--feature-color) 14%,transparent);font-size:20px;flex:0 0 auto}
      .eg-feature-title{font-size:12px;font-weight:1000;line-height:1.2}
      .eg-feature-desc{font-size:11px;color:var(--landing-faint);line-height:1.35;margin-top:2px;white-space:nowrap}
      @keyframes featureMarquee{from{transform:translateX(0)}to{transform:translateX(calc(-50% - 5px))}}
      .eg-article-section{border:1px solid var(--landing-border);border-radius:24px;background:var(--landing-card);padding:18px;backdrop-filter:blur(14px)}
      .eg-article-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px}
      .eg-article-head b{font-size:17px}
      .eg-article-head span{font-size:12px;color:var(--landing-faint)}
      .eg-article-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .eg-article{display:flex;gap:11px;align-items:flex-start;border:1px solid color-mix(in srgb,var(--article-color) 20%,var(--landing-border));border-radius:16px;background:${dark?"rgba(255,255,255,.035)":"rgba(255,255,255,.62)"};padding:13px;text-decoration:none;color:var(--landing-text);transition:transform .15s ease,border-color .15s ease}
      .eg-article:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--article-color) 60%,var(--landing-border))}
      .eg-article.is-highlight{position:relative;border-color:color-mix(in srgb,var(--article-color) 72%,var(--landing-border));background:linear-gradient(135deg,color-mix(in srgb,var(--article-color) 14%,var(--landing-card)),var(--landing-card));box-shadow:0 0 0 0 color-mix(in srgb,var(--article-color) 35%,transparent);animation:keyPulse 1.8s ease-in-out infinite}
      .eg-article.is-highlight:after{content:"建議設定";position:absolute;right:10px;top:8px;font-size:10px;font-weight:1000;color:var(--article-color);background:color-mix(in srgb,var(--article-color) 14%,#fff);border:1px solid color-mix(in srgb,var(--article-color) 28%,transparent);border-radius:999px;padding:3px 7px}
      .eg-article-ic{width:34px;height:34px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--article-color) 14%,transparent);flex:0 0 auto}
      .eg-article-title{display:block;font-size:13px;font-weight:1000}
      .eg-article-desc{display:block;font-size:11px;color:var(--landing-faint);margin-top:2px}
      .eg-key-reminder{display:flex;align-items:center;gap:10px;border:1px solid color-mix(in srgb,#8B5CF6 36%,var(--landing-border));border-radius:18px;background:${dark?"linear-gradient(135deg,rgba(139,92,246,.18),rgba(25,32,58,.82))":"linear-gradient(135deg,#F3E8FF,#FFFFFF)"};padding:12px 14px;margin-bottom:12px;color:var(--landing-text);box-shadow:0 14px 30px rgba(139,92,246,.12);text-decoration:none}
      .eg-key-reminder b{font-size:13px}
      .eg-key-reminder span{font-size:12px;color:var(--landing-muted);line-height:1.5}
      @keyframes keyPulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--article-color) 28%,transparent)}50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--article-color) 0%,transparent)}}
      .eg-landing-footer{margin-top:24px;text-align:center;font-size:11px;color:var(--landing-faint);line-height:1.8}
      @media(max-width:820px){
        .eg-landing-shell{padding:22px 12px 34px}
        .eg-landing-top{margin-bottom:18px}
        .eg-landing-hero{grid-template-columns:1fr}
        .eg-landing-copy{padding:22px 18px;border-radius:22px}
        .eg-recent-updates{max-width:none}
        .eg-recent-layout{grid-template-columns:1fr}
        .eg-recent-head{align-items:flex-start;flex-direction:column}
        .eg-feature-marquee{border-radius:18px;margin:14px 0}
        .eg-feature{min-width:166px}
        .eg-article-grid{grid-template-columns:1fr}
      }
      @media(max-width:420px){
        .eg-landing-brand strong{font-size:18px}
        .eg-theme-toggle{padding:8px 10px}
        .eg-level-card{grid-template-columns:auto 1fr;padding:14px}
        .eg-level-badge{grid-column:2}
      }
    `}</style>
    <main className="eg-landing-shell">
      <div className="eg-landing-top">
        <div className="eg-landing-brand"><span style={{fontSize:26}}>📘</span><strong>EnglishGo</strong></div>
        <button className="eg-theme-toggle" type="button" onClick={()=>setDark(!dark)}>{dark?"☀️ 白天模式":"🌙 黑夜模式"}</button>
      </div>
      <section className="eg-landing-hero">
        <div className="eg-landing-copy">
          <div className="eg-landing-kicker">台灣學生專用 · AI 英語學習平台</div>
          <h1>讓英文練習<br/><span>像遊戲一樣上癮</span></h1>
          <p className="eg-landing-lead">用單字卡、閱讀、歌曲、口說、互動遊戲與寵物養成，把每天 10 分鐘變成看得到進步的學習流程。</p>
          <section className="eg-recent-updates" aria-label="近期新增功能">
            <div className="eg-recent-head">
              <div className="eg-recent-title"><span>新功能</span>近期新增</div>
              <div className="eg-recent-source">點卡片直接進入功能</div>
            </div>
            <div className="eg-recent-layout">
              {recentFeatures.map((item,i)=><RecentCard key={`${item.title}-${item.date}-${i}`} item={item} i={i}/>)}
            </div>
          </section>
        </div>
        <div className="eg-level-stack" aria-label="選擇學習階段">
          {Object.entries(LV).map(([k,level])=>(
            <button key={k} type="button" className="eg-level-card" onClick={()=>onSelect(k)} onMouseEnter={()=>setHov(k)} onMouseLeave={()=>setHov(null)} style={{"--level-color":level.cl,transform:hov===k?"translateY(-3px)":"none"}}>
              <span className="eg-level-icon">{level.ic}</span>
              <span>
                <span className="eg-level-title">{level.l}</span>
                <span className="eg-level-sub">{level.en}</span>
              </span>
              <span className="eg-level-badge">{level.wd}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="eg-feature-marquee" aria-label="EnglishGo 功能亮點">
        <div className="eg-feature-track">
          {[...features,...features].map((f,i)=><div key={`${f.t}-${i}`} className="eg-feature" style={{"--feature-color":f.tone}} aria-hidden={i>=features.length}>
            <div className="eg-feature-icon">{f.i}</div>
            <div>
              <div className="eg-feature-title">{f.t}</div>
              <div className="eg-feature-desc">{f.d}</div>
            </div>
          </div>)}
        </div>
      </section>
      <section className="eg-article-section">
        <div className="eg-article-head"><b>學習資源</b><span>快速了解功能與設定</span></div>
        {keyMissing&&<a className="eg-key-reminder" href="/learn/api-keys.html">
          <span style={{fontSize:22}}>🔑</span>
          <span><b>AI 與動圖功能尚未完整設定</b><br/>點選 API Key 教學，完成 Gemini / Giphy 設定後可使用 AI 字典、AI 家教與單字動圖。</span>
        </a>}
        <div className="eg-article-grid">
          {articles.map(a=><a key={a.href} className={`eg-article ${a.highlight?"is-highlight":""}`} href={a.href} style={{"--article-color":a.tone}}>
            <span className="eg-article-ic">{a.ic}</span>
            <span><span className="eg-article-title">{a.t}</span><span className="eg-article-desc">{a.d}</span></span>
          </a>)}
        </div>
      </section>
      <footer className="eg-landing-footer">
        <div>AI Tutor powered by <b>Gemini</b> · Speech by <b>Web Speech API</b></div>
        <div>© {new Date().getFullYear()} EnglishGo · 專為台灣學生設計</div>
      </footer>
    </main>
  </div>);
}

function MenuV2({lv,onSelect,activeGroup="learn",onGroupChange,daily,c,xp,coins,streak,achUnlocked,weakWords,isSponsor,pets,eggs}){
  const target=Math.max(1,daily?.target||1);
  const pct=Math.min(100,Math.round(((daily?.done||0)/target)*100));
  const todayKey=dateKey();
  const vocab=V[lv]||[];
  const fallbackToday=vocab[hashText(`${todayKey}:${lv}:fallback`)%Math.max(1,vocab.length)]||{w:"learn",m:"學習",p:"v."};
  const[todayWord,setTodayWord]=useState(fallbackToday);
  const[cloudCount,setCloudCount]=useState(0);
  const setActiveGroup=onGroupChange||(()=>{});
  const gradeTheme=({
    elementary:{
      accent:"#0F9F7A",accent2:"#22C55E",accent3:"#0EA5E9",warm:"#F59E0B",
      soft:"#E8FFF4",
      hero:"radial-gradient(circle at 18% 8%,rgba(52,211,153,.30),transparent 32%),radial-gradient(circle at 86% 16%,rgba(250,204,21,.22),transparent 30%),linear-gradient(135deg,#ECFDF5 0%,#F8FFF2 52%,#F0F9FF 100%)",
      panel:"linear-gradient(135deg,rgba(15,159,122,.10),rgba(14,165,233,.06) 52%,rgba(250,204,21,.08))",
      groups:{learn:"#0F9F7A",read:"#1D7ED8",game:"#F59E0B",pet:"#EC4899",tools:"#8B5CF6"},
    },
    junior:{
      accent:"#4F46E5",accent2:"#0EA5E9",accent3:"#D946EF",warm:"#F97316",
      soft:"#EEF2FF",
      hero:"radial-gradient(circle at 16% 12%,rgba(99,102,241,.28),transparent 32%),radial-gradient(circle at 88% 10%,rgba(217,70,239,.20),transparent 28%),linear-gradient(135deg,#EEF2FF 0%,#F0FDFA 50%,#FFF7ED 100%)",
      panel:"linear-gradient(135deg,rgba(79,70,229,.10),rgba(14,165,233,.07) 50%,rgba(217,70,239,.08))",
      groups:{learn:"#4F46E5",read:"#0EA5E9",game:"#F97316",pet:"#D946EF",tools:"#14B8A6"},
    },
    senior:{
      accent:"#C2410C",accent2:"#F97316",accent3:"#7C3AED",warm:"#F59E0B",
      soft:"#FFF1E8",
      hero:"radial-gradient(circle at 18% 8%,rgba(249,115,22,.26),transparent 32%),radial-gradient(circle at 84% 14%,rgba(124,58,237,.19),transparent 30%),linear-gradient(135deg,#FFF7ED 0%,#FFF1F2 47%,#F5F3FF 100%)",
      panel:"linear-gradient(135deg,rgba(194,65,12,.10),rgba(249,115,22,.07) 48%,rgba(124,58,237,.08))",
      groups:{learn:"#C2410C",read:"#2563EB",game:"#EA580C",pet:"#BE185D",tools:"#7C3AED"},
    },
  })[lv]||{};
  useEffect(()=>{
    let active=true;
    setTodayWord(fallbackToday);
    setCloudCount(0);
    fetchCloudCount(lv).then(n=>{if(active)setCloudCount(n||0)});
    fetchDailyCloudWord(lv,fallbackToday).then(w=>{if(active&&w)setTodayWord(w)});
    return()=>{active=false};
  },[lv,todayKey]);

  const modules=[
    {id:"srs",group:"learn",icon:"▣",t:"單字卡",d:cloudCount?`目前 ${cloudCount} 個單字可練習`:"用間隔重複記單字",tag:"每日核心"},
    {id:"exam",group:"learn",icon:"📝",t:"考試複習",d:"輸入考試範圍自訂一輪",tag:"範圍複習"},
    {id:"wordsearch",group:"learn",icon:"⌕",t:"單字查詢",d:"查英文、中文、變化形",tag:"快速查找"},
    {id:"quiz",group:"learn",icon:"✓",t:"單字測驗",d:"選擇題確認理解",tag:"檢查記憶"},
    {id:"grammar",group:"learn",icon:"¶",t:"文法學堂",d:`${G?.[lv]?.length||0} 個文法主題`,tag:"句型理解"},
    {id:"speak",group:"learn",icon:"◉",t:"口說練習",d:"聽、念、比對發音",tag:"開口練習"},
    {id:"ai",group:"learn",icon:"AI",t:"AI 家教",d:"用 Gemini 問英文問題",tag:"個別指導"},
    {id:"reading",group:"read",icon:"R",t:"閱讀理解",d:`${R?.[lv]?.length||0} 篇短文練習`,tag:"短文測驗"},
    {id:"novels",group:"read",icon:"N",t:"英文小說",d:lv==="junior"?"國中奇幻長篇":"小學插圖故事",tag:"故事閱讀"},
    {id:"songs",group:"read",icon:"♪",t:"英文歌曲",d:(SONGS?.[lv]?.length||0)?`${SONGS[lv].length} 首歌曲`:"尚未建立歌曲",tag:"聽唱學習"},
    {id:"dictation",group:"read",icon:"D",t:"聽寫練習",d:"聽句子並輸入答案",tag:"聽力拼字"},
    {id:"story",group:"read",icon:"✦",t:"AI 故事",d:"生成適合程度的短故事",tag:"創意閱讀"},
    {id:"whack",group:"game",icon:"W",t:"打地鼠",d:"限時反應練單字",tag:"速度訓練"},
    {id:"match",group:"game",icon:"M",t:"配對遊戲",d:"英文與中文快速配對",tag:"記憶配對"},
    {id:"bomb",group:"game",icon:"B",t:"拆蛋拼字",d:"看提示完成拼字",tag:"拼字挑戰"},
    {id:"scramble",group:"game",icon:"S",t:"句子重組",d:"把單字排成正確句子",tag:"語順練習"},
    {id:"petMonopoly",group:"game",icon:"🎲",t:"寵物大富翁",d:"走棋盤答英文養寵物",tag:"寵物桌遊"},
    {id:"gacha",group:"pet",icon:"G",t:"扭蛋機",d:`${coins} 金幣可使用`,tag:"取得寵物"},
    {id:"pets",group:"pet",icon:"P",t:"寵物圖鑑",d:`${pets.length} 隻寵物 · ${eggs.length} 顆蛋`,tag:"培養照顧"},
    {id:"petAdventure",group:"pet",icon:"A",t:"寵物冒險",d:pets.length?`${pets.length} 隻可組隊戰鬥`:"先取得寵物再挑戰",tag:"英文戰鬥"},
    {id:"achievements",group:"tools",icon:"★",t:"成就牆",d:`${achUnlocked.length}/${ACH_DEFS.length} 個已解鎖`,tag:"學習成果"},
    {id:"weak",group:"tools",icon:"!",t:"弱點單字",d:weakWords.length?`${weakWords.length} 個需要複習`:"目前沒有弱點紀錄",tag:"補強清單"},
    {id:"dashboard",group:"tools",icon:"▤",t:"學習報告",d:"查看 XP、連續天數與紀錄",tag:"進度分析"},
    {id:"settings",group:"tools",icon:"Key",t:"API Key 設定",d:"Gemini 與 Giphy 統一管理",tag:"Key 管理"},
    {id:"sponsor",group:"tools",icon:"♡",t:isSponsor?"支持紀錄":"支持我們",d:isSponsor?"已留下支持資訊":"銀行轉帳與留言",tag:"支持專案"},
  ];
  const groups=[
    {id:"learn",icon:"▣",t:"學習",d:"單字、文法、口說",color:gradeTheme.groups?.learn||c.cl},
    {id:"read",icon:"R",t:"閱讀聽力",d:"短文、小說、歌曲",color:gradeTheme.groups?.read||"#185FA5"},
    {id:"game",icon:"▶",t:"遊戲",d:"用遊戲加強反應",color:gradeTheme.groups?.game||"#D97706"},
    {id:"pet",icon:"P",t:"寵物",d:"扭蛋、培養、冒險",color:gradeTheme.groups?.pet||"#DB2777"},
    {id:"tools",icon:"▤",t:"工具",d:"報告、弱點、支持",color:gradeTheme.groups?.tools||"#7C3AED"},
  ];
  const activeGroupData=groups.find(g=>g.id===activeGroup)||groups[0];
  const activeModules=modules.filter(m=>m.group===activeGroup);
  const recommendedIds=["srs","exam",weakWords.length?"weak":"wordsearch",pets.length?"petAdventure":"quiz"];
  const recommendedModules=recommendedIds.map(id=>modules.find(m=>m.id===id)).filter(Boolean);
  const statItems=[
    {label:"連續",value:`${streak} 天`,hint:"保持節奏",tone:"#E24B4A"},
    {label:"XP",value:xp,hint:"累積學習量",tone:"#D97706"},
    {label:"金幣",value:coins,hint:"可用於寵物",tone:"#C47A12",action:"gacha",group:"pet"},
    {label:"寵物",value:pets.length,hint:eggs.length?`${eggs.length} 顆蛋待孵化`:"培養夥伴",tone:gradeTheme.groups?.pet||c.cl,action:"pets",group:"pet"},
  ];
  const ModuleCard=({m})=>{
    const group=groups.find(g=>g.id===m.group)||groups[0];
    return(
      <button type="button" className="eg-menu-module" data-module-id={m.id} onClick={()=>onSelect(m.id,m.group)} style={{"--module-color":group.color}}>
        <span className="eg-menu-module-icon">{m.icon}</span>
        <span className="eg-menu-module-body">
          <span className="eg-menu-module-title">{m.t}</span>
          <span className="eg-menu-module-desc">{m.d}</span>
          <span className="eg-menu-module-tag">{m.tag}</span>
        </span>
      </button>
    );
  };
  const QuickAction=({m})=>{
    const group=groups.find(g=>g.id===m.group)||groups[0];
    return(
      <button type="button" className="eg-menu-quick-action" data-module-id={m.id} onClick={()=>onSelect(m.id,m.group)} style={{"--module-color":group.color}}>
        <span className="eg-menu-quick-icon">{m.icon}</span>
        <span className="eg-menu-quick-text">
          <span className="eg-menu-quick-title">{m.t}</span>
          <span className="eg-menu-quick-tag">{m.tag}</span>
        </span>
      </button>
    );
  };

  return(
    <div className="eg-menu" style={{"--accent":gradeTheme.accent||c.cl,"--accent-2":gradeTheme.accent2||c.ac,"--accent-3":gradeTheme.accent3||c.ac,"--accent-warm":gradeTheme.warm||c.ac,"--accent-soft":gradeTheme.soft||c.bg,"--grade-hero":gradeTheme.hero||`linear-gradient(135deg,${c.bg},${S.bg1} 58%)`,"--grade-panel":gradeTheme.panel||`linear-gradient(135deg,${c.bg},${S.bg1})`,"--card":S.bg1,"--surface":S.bg2,"--page":S.bg3,"--border":S.bd,"--text":S.t1,"--muted":S.t2,"--faint":S.t3}}>
      <style>{`
        .eg-menu{display:grid;gap:18px}
        .eg-menu button{font-family:inherit}
        .eg-menu-hero{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--accent) 34%,var(--border));border-radius:26px;background:var(--grade-hero);box-shadow:var(--eg-card-shadow,0 18px 40px rgba(15,110,86,.08));padding:20px;display:grid;grid-template-columns:minmax(0,1fr) 292px;gap:18px}
        .eg-menu-hero:before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,rgba(255,255,255,.32) 0%,transparent 34%,transparent 64%,rgba(255,255,255,.10) 100%);pointer-events:none;mix-blend-mode:screen}
        .eg-menu-hero:after{content:"";position:absolute;left:18px;right:18px;bottom:0;height:4px;border-radius:999px 999px 0 0;background:linear-gradient(90deg,var(--accent),var(--accent-2),var(--accent-3),var(--accent-warm));opacity:.85}
        .eg-menu-eyebrow{position:relative;z-index:1;display:inline-flex;align-items:center;gap:8px;width:max-content;max-width:100%;padding:7px 11px;border-radius:999px;border:1px solid color-mix(in srgb,var(--accent) 32%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 16%,var(--card)),color-mix(in srgb,var(--accent-3) 10%,var(--card)));color:var(--accent);font-size:12px;font-weight:1000;box-shadow:0 8px 18px color-mix(in srgb,var(--accent) 14%,transparent)}
        .eg-menu-word-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}
        .eg-menu-word{font-size:clamp(34px,7vw,54px);font-weight:1000;line-height:1;color:var(--eg-hero-word,var(--text));letter-spacing:0;text-shadow:0 2px 14px rgba(0,0,0,.12)}
        .eg-menu-sound{width:44px;height:44px;border-radius:15px;border:1px solid color-mix(in srgb,var(--accent) 30%,var(--border));background:var(--card);color:var(--accent);font-size:17px;font-weight:900;cursor:pointer;box-shadow:0 10px 22px color-mix(in srgb,var(--accent) 18%,transparent)}
        .eg-menu-word-meta{font-size:14px;color:var(--muted);margin-top:8px;line-height:1.55}
        .eg-menu-progress{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;margin-top:18px}
        .eg-menu-track{height:11px;border-radius:999px;background:var(--eg-soft-track,rgba(0,0,0,.07));overflow:hidden;box-shadow:inset 0 1px 4px rgba(0,0,0,.10)}
        .eg-menu-fill{height:100%;width:var(--progress);border-radius:999px;background:linear-gradient(90deg,var(--accent),var(--accent-2),var(--accent-3));transition:width .25s ease}
        .eg-menu-progress-label{font-size:12px;font-weight:1000;color:var(--accent)}
        .eg-menu-note{font-size:12px;color:var(--faint);line-height:1.6;margin-top:8px}
        .eg-menu-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;position:relative;z-index:1}
        .eg-menu-stat{border:1px solid color-mix(in srgb,var(--tone) 28%,var(--border));border-radius:18px;background:linear-gradient(145deg,color-mix(in srgb,var(--tone) 15%,var(--card)),var(--card));padding:13px;text-align:left;min-height:92px;cursor:default;box-shadow:0 10px 24px color-mix(in srgb,var(--tone) 10%,transparent)}
        .eg-menu-stat.has-action{cursor:pointer}
        .eg-menu-stat-label{display:block;font-size:11px;color:var(--tone);font-weight:1000}
        .eg-menu-stat-value{display:block;font-size:22px;color:var(--text);font-weight:1000;margin-top:8px;line-height:1.05}
        .eg-menu-stat-hint{display:block;font-size:11px;color:var(--faint);margin-top:6px;line-height:1.35}
        .eg-menu-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:2px 2px 10px}
        .eg-menu-section-title{font-size:16px;font-weight:1000;color:var(--text)}
        .eg-menu-section-sub{font-size:12px;color:var(--faint);margin-top:3px;line-height:1.45}
        .eg-menu-quick-row{position:relative;z-index:1;display:flex;align-items:center;gap:7px;margin-top:10px;overflow-x:auto;padding:1px 0 3px;scrollbar-width:none}
        .eg-menu-quick-row::-webkit-scrollbar{display:none}
        .eg-menu-quick-label{flex:0 0 auto;font-size:11px;font-weight:1000;color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,var(--card));border:1px solid color-mix(in srgb,var(--accent) 18%,transparent);border-radius:999px;padding:7px 9px}
        .eg-menu-quick-action{flex:0 0 auto;border:1px solid color-mix(in srgb,var(--module-color) 26%,var(--border));border-radius:999px;background:color-mix(in srgb,var(--module-color) 8%,var(--card));color:var(--text);display:inline-flex;align-items:center;gap:7px;min-height:36px;max-width:210px;padding:6px 10px;cursor:pointer;transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease}
        .eg-menu-quick-action:hover{transform:translateY(-1px);box-shadow:0 8px 18px color-mix(in srgb,var(--module-color) 14%,transparent);border-color:color-mix(in srgb,var(--module-color) 52%,var(--border))}
        .eg-menu-quick-icon{width:24px;height:24px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--module-color) 16%,var(--card));color:var(--module-color);font-size:12px;font-weight:1000;flex:0 0 auto}
        .eg-menu-quick-text{min-width:0;display:flex;align-items:baseline;gap:6px}
        .eg-menu-quick-title{font-size:12px;font-weight:1000;line-height:1.1;color:var(--text);white-space:nowrap}
        .eg-menu-quick-tag{font-size:10px;font-weight:900;color:var(--module-color);white-space:nowrap}
        .eg-menu-groups{position:relative;z-index:2;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:8px;border:1px solid color-mix(in srgb,var(--accent) 18%,var(--border));border-radius:22px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 6%,var(--card)),color-mix(in srgb,var(--accent-3) 5%,var(--surface)));box-shadow:0 12px 26px rgba(15,110,86,.06)}
        .eg-menu-group{position:relative;overflow:hidden;border:1px solid transparent;border-radius:16px;background:transparent;padding:11px 10px;text-align:left;cursor:pointer;min-height:74px;color:var(--text);transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease,background .14s ease}
        .eg-menu-group:hover{transform:translateY(-1px);background:color-mix(in srgb,var(--group-color) 7%,var(--card));border-color:color-mix(in srgb,var(--group-color) 18%,transparent)}
        .eg-menu-module:hover{transform:translateY(-2px)}
        .eg-menu-group.is-active{border-color:color-mix(in srgb,var(--group-color) 45%,var(--border));background:linear-gradient(135deg,color-mix(in srgb,var(--group-color) 18%,var(--card)),color-mix(in srgb,var(--group-color) 7%,var(--surface)));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--group-color) 12%,transparent),0 10px 22px color-mix(in srgb,var(--group-color) 12%,transparent)}
        .eg-menu-group.is-active:before{content:"";position:absolute;left:12px;right:12px;bottom:8px;height:3px;border-radius:999px;background:linear-gradient(90deg,var(--group-color),color-mix(in srgb,var(--group-color) 42%,#fff));opacity:.9}
        .eg-menu-group-top{display:flex;align-items:center;gap:8px}
        .eg-menu-group-icon{width:28px;height:28px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--group-color) 12%,var(--card));color:var(--group-color);font-weight:1000;font-size:13px}
        .eg-menu-group-title{font-size:13px;font-weight:1000;color:var(--text)}
        .eg-menu-group-desc{display:block;font-size:11px;color:var(--faint);line-height:1.35;margin-top:7px}
        .eg-menu-panel{position:relative;z-index:1;border:1px solid color-mix(in srgb,var(--active-color) 28%,var(--border));border-radius:24px;background:var(--eg-menu-panel-bg,var(--grade-panel));padding:16px;box-shadow:var(--eg-card-shadow,none);overflow:hidden}
        .eg-menu-panel:before{content:"";position:absolute;left:16px;right:16px;top:0;height:3px;border-radius:0 0 999px 999px;background:linear-gradient(90deg,var(--active-color),color-mix(in srgb,var(--active-color) 28%,transparent));opacity:.78}
        .eg-menu-module-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:10px}
        .eg-menu-module{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--module-color) 26%,var(--border));border-radius:18px;background:var(--eg-menu-card-bg,var(--card));padding:14px;text-align:left;display:flex;gap:11px;min-height:106px;cursor:pointer;color:var(--text);transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease}
        .eg-menu-module:hover{box-shadow:0 14px 28px color-mix(in srgb,var(--module-color) 18%,transparent);border-color:color-mix(in srgb,var(--module-color) 58%,var(--border))}
        .eg-menu-module:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(180deg,var(--module-color),color-mix(in srgb,var(--module-color) 44%,#fff));opacity:.95}
        .eg-menu-module:after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.20),transparent 42%);pointer-events:none}
        .eg-menu-module-icon{width:40px;height:40px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--module-color) 16%,var(--card));color:var(--module-color);font-size:15px;font-weight:1000;flex:0 0 auto;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--module-color) 14%,transparent)}
        .eg-menu-module-body{min-width:0;display:flex;flex-direction:column;align-items:flex-start}
        .eg-menu-module-title{font-size:14px;font-weight:1000;line-height:1.25;color:var(--text)}
        .eg-menu-module-desc{font-size:12px;color:var(--muted);line-height:1.45;margin-top:5px}
        .eg-menu-module-tag{font-size:10px;font-weight:1000;color:var(--module-color);background:color-mix(in srgb,var(--module-color) 10%,transparent);border:1px solid color-mix(in srgb,var(--module-color) 18%,transparent);border-radius:999px;padding:3px 8px;margin-top:auto}
        .eg-menu-alert{border:1px solid rgba(226,75,74,.24);border-radius:18px;background:linear-gradient(135deg,#FCEBEB,var(--card));padding:13px 14px;display:flex;align-items:center;gap:12px}
        .eg-menu-alert-title{font-size:13px;font-weight:1000;color:#B42318}
        .eg-menu-alert-body{font-size:12px;color:var(--muted);line-height:1.5;margin-top:3px}
        .eg-menu-alert-action{border:0;background:#E24B4A;color:#fff;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap}
        @media (max-width:760px){
          .eg-menu{gap:14px}
          .eg-menu-hero{grid-template-columns:1fr;padding:16px;border-radius:20px}
          .eg-menu-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;overflow:visible;padding-bottom:0}
          .eg-menu-stat{min-width:78px;min-height:74px;padding:10px}
          .eg-menu-stat-value{font-size:17px}
          .eg-menu-stat-hint{display:none}
          .eg-menu-groups{display:flex;overflow-x:auto;padding:7px;border-radius:18px}
          .eg-menu-group{min-width:112px;min-height:62px;padding:10px}
          .eg-menu-group-desc{display:none}
          .eg-menu-module-grid{grid-template-columns:1fr}
          .eg-menu-module{min-height:88px}
          .eg-menu-section-head{align-items:flex-start}
        }
        @media (max-width:420px){
          .eg-menu-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
          .eg-menu-word{font-size:34px}
          .eg-menu-alert{align-items:flex-start;flex-direction:column}
          .eg-menu-alert-action{width:100%}
        }
      `}</style>

      <section className="eg-menu-hero">
        <div>
          <div className="eg-menu-eyebrow">{c.ic} {c.l} 操作中心</div>
          <div className="eg-menu-word-row">
            <div className="eg-menu-word">{todayWord.w}</div>
            <button type="button" className="eg-menu-sound" onClick={()=>speak(todayWord.w)} aria-label="朗讀今日單字">▶</button>
          </div>
          <div className="eg-menu-word-meta">{todayWord.m} · {todayWord.p || "word"}</div>
          <div className="eg-menu-progress">
            <div className="eg-menu-track"><div className="eg-menu-fill" style={{"--progress":`${pct}%`}}/></div>
            <div className="eg-menu-progress-label">{pct}%</div>
          </div>
          <div className="eg-menu-note">今日進度會同時累積 XP、金幣與寵物培養。先完成推薦項目，再依需求切換分類。</div>
          <div className="eg-menu-quick-row" aria-label="建議下一步">
            <span className="eg-menu-quick-label">建議</span>
            {recommendedModules.map(m=><QuickAction key={`quick-${m.id}`} m={m}/>)}
          </div>
        </div>
        <div className="eg-menu-stats">
          {statItems.map(item=>(
            <button key={item.label} type="button" disabled={!item.action} onClick={()=>item.action&&onSelect(item.action,item.group)} className={`eg-menu-stat ${item.action?"has-action":""}`} style={{"--tone":item.tone}}>
              <span className="eg-menu-stat-label">{item.label}</span>
              <span className="eg-menu-stat-value">{item.value}</span>
              <span className="eg-menu-stat-hint">{item.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {weakWords.length>0&&(
        <section className="eg-menu-alert">
          <div style={{fontSize:22,fontWeight:1000,color:"#B42318"}}>!</div>
          <div style={{flex:1,minWidth:180}}>
            <div className="eg-menu-alert-title">有單字需要補強</div>
            <div className="eg-menu-alert-body">{[...weakWords].sort((a,b)=>b.n-a.n).slice(0,5).map(w=>`${w.w}(${w.n})`).join(" · ")}</div>
          </div>
          <button type="button" className="eg-menu-alert-action" onClick={()=>onSelect("weak","tools")}>開始複習</button>
        </section>
      )}

      <section className="eg-menu-groups" role="tablist" aria-label="功能分類">
        {groups.map(g=>{
          const active=g.id===activeGroup;
          return(
            <button key={g.id} type="button" role="tab" aria-selected={active} aria-controls="eg-menu-active-panel" className={`eg-menu-group ${active?"is-active":""}`} data-group-id={g.id} onClick={()=>setActiveGroup(g.id)} style={{"--group-color":g.color}}>
              <span className="eg-menu-group-top">
                <span className="eg-menu-group-icon">{g.icon}</span>
                <span className="eg-menu-group-title">{g.t}</span>
              </span>
              <span className="eg-menu-group-desc">{g.d}</span>
            </button>
          );
        })}
      </section>

      <section id="eg-menu-active-panel" className="eg-menu-panel" role="tabpanel" style={{"--active-color":activeGroupData.color}}>
        <div className="eg-menu-section-head">
          <div>
            <div className="eg-menu-section-title" style={{color:activeGroupData.color}}>{activeGroupData.t}</div>
            <div className="eg-menu-section-sub">{activeGroupData.d}</div>
          </div>
          <div style={{fontSize:12,fontWeight:1000,color:activeGroupData.color,background:`${activeGroupData.color}14`,borderRadius:999,padding:"6px 10px",whiteSpace:"nowrap"}}>{activeModules.length} 個功能</div>
        </div>
        <div className="eg-menu-module-grid">
          {activeModules.map(m=><ModuleCard key={m.id} m={m}/>)}
        </div>
      </section>
    </div>
  );
}

// ═══ MENU ═══════════════════════════════════════════════════════════
function Menu({lv,onSelect,daily,c,xp,coins,streak,achUnlocked,weakWords,isSponsor,pets,eggs}){
  const pct=Math.round((daily.done/daily.target)*100);
  const todayKey=dateKey();
  const fallbackToday=V[lv][hashText(`${todayKey}:${lv}:fallback`)%V[lv].length];
  const[todayWord,setTodayWord]=useState(fallbackToday);
  const[cloudCount,setCloudCount]=useState(0);
  const[activeGroup,setActiveGroup]=useState("learn");
  useEffect(()=>{let active=true;setTodayWord(fallbackToday);setCloudCount(0);fetchCloudCount(lv).then(n=>{if(active)setCloudCount(n||0)});fetchDailyCloudWord(lv,fallbackToday).then(w=>{if(active&&w)setTodayWord(w)});return()=>{active=false}},[lv,todayKey]);
  const modules=[
    {id:"srs",group:"learn",icon:"🃏",t:"SRS 單字卡",d:cloudCount?`雲端 ${cloudCount} 字`:"間隔重複",tag:"每日核心"},
    {id:"wordsearch",group:"learn",icon:"🔎",t:"單字查詢",d:"搜尋並開卡",tag:"快速查字"},
    {id:"quiz",group:"learn",icon:"📝",t:"單字測驗",d:"四選一",tag:"檢查記憶"},
    {id:"grammar",group:"learn",icon:"🧠",t:"文法學堂",d:`${G[lv].length} 個重點`,tag:"句型觀念"},
    {id:"speak",group:"learn",icon:"🗣️",t:"口說練習",d:"唸出來！",tag:"開口訓練"},
    {id:"ai",group:"learn",icon:"🤖",t:"AI 家教",d:"Gemini 對話",tag:"問問題"},
    {id:"reading",group:"read",icon:"📖",t:"閱讀理解",d:`${R[lv].length} 篇文章`,tag:"短文測驗"},
    {id:"novels",group:"read",icon:"📘",t:"英文小說",d:lv==="junior"?"16 章故事":`${NOVEL_COUNT} 章故事`,tag:"長篇閱讀"},
    {id:"songs",group:"read",icon:"🎵",t:"英文歌曲",d:(SONGS[lv]?.length||0)?`${SONGS[lv].length} 首歌`:"準備中",tag:"聽歌學英文"},
    {id:"dictation",group:"read",icon:"🎧",t:"聽寫訓練",d:"聽力養成",tag:"聽力"},
    {id:"story",group:"read",icon:"📖",t:"AI 故事",d:"寵物英文故事",tag:"AI 閱讀"},
    {id:"whack",group:"game",icon:"🔨",t:"打地鼠拼字",d:"限時拼字",tag:"拼字反應"},
    {id:"match",group:"game",icon:"🎴",t:"配對翻牌",d:"記憶遊戲",tag:"記憶配對"},
    {id:"bomb",group:"game",icon:"💣",t:"拆彈拼字",d:"限時拆彈！",tag:"拼字挑戰"},
    {id:"scramble",group:"game",icon:"🧩",t:"句子重組",d:"語序訓練",tag:"句子遊戲"},
    {id:"petMonopoly",group:"game",icon:"🎲",t:"寵物大富翁",d:"答英文走棋盤",tag:"寵物桌遊"},
    {id:"gacha",group:"pet",icon:"🎰",t:"扭蛋機",d:`🪙 ${coins} 金幣`,tag:"取得寵物"},
    {id:"pets",group:"pet",icon:"🐾",t:"寵物圖鑑",d:`${pets.length} 隻 · ${eggs.length} 顆蛋`,tag:"培養照顧"},
    {id:"petAdventure",group:"pet",icon:"🗺️",t:"寵物冒險",d:pets.length?`${pets.length} 隻可組隊`:"先取得寵物",tag:"英文戰鬥"},
    {id:"achievements",group:"tools",icon:"🏆",t:"成就徽章",d:`${achUnlocked.length}/${ACH_DEFS.length} 已解鎖`,tag:"收集"},
    {id:"weak",group:"tools",icon:"📕",t:"錯題本",d:weakWords.length?`${weakWords.length} 字需加強`:"還沒有錯題",tag:"複習"},
    {id:"dashboard",group:"tools",icon:"📊",t:"學習報告",d:"數據分析",tag:"進度"},
    {id:"sponsor",group:"tools",icon:"☕",t:isSponsor?"支持者 ✓":"支持我們",d:isSponsor?"感謝您的支持！":"銀行轉帳與留言",tag:"支持"},
  ];
  const groups=[
    {id:"learn",icon:"📚",t:"學習",d:"單字、文法、口說",color:c.cl},
    {id:"read",icon:"🎧",t:"閱讀聽力",d:"文章、小說、歌曲",color:"#185FA5"},
    {id:"game",icon:"🎮",t:"遊戲",d:"拼字與記憶",color:"#D97706"},
    {id:"pet",icon:"🐾",t:"寵物",d:"扭蛋、培養、冒險",color:"#DB2777"},
    {id:"tools",icon:"🧰",t:"工具",d:"錯題、報告、支援",color:"#7C3AED"},
  ];
  const activeGroupData=groups.find(g=>g.id===activeGroup)||groups[0];
  const activeModules=modules.filter(m=>m.group===activeGroup);
  const featuredIds=["srs",weakWords.length?"weak":"quiz",pets.length?"petAdventure":"gacha"];
  const featuredModules=featuredIds.map(id=>modules.find(m=>m.id===id)).filter(Boolean);
  const metricItems=[
    {icon:"🔥",label:"連續",value:streak,color:"#E24B4A"},
    {icon:"⭐",label:"XP",value:xp,color:"#D97706"},
    {icon:"🪙",label:"金幣",value:coins,color:"#EF9F27",onClick:()=>onSelect("gacha")},
    {icon:"🐾",label:"寵物",value:pets.length+(eggs.length?` +${eggs.length}🥚`:""),color:c.cl,onClick:()=>onSelect("pets")},
  ];
  const ModuleCard=({m,featured=false})=>{
    const group=groups.find(g=>g.id===m.group)||groups[0];
    return(<button onClick={()=>onSelect(m.id)} style={{textAlign:"left",cursor:"pointer",...S.card,padding:featured?"16px 16px 15px":"14px 13px",transition:"transform .14s, box-shadow .14s, border-color .14s",WebkitTapHighlightColor:"transparent",border:`1px solid ${featured?group.color:S.bd}`,background:featured?`linear-gradient(135deg,${group.color}14,var(--color-background-primary,#fff))`:S.bg1,fontFamily:"inherit",minHeight:featured?112:98,position:"relative",overflow:"hidden",boxShadow:featured?`0 10px 26px ${group.color}10`:"none"}}
      onTouchStart={e=>e.currentTarget.style.transform="scale(0.98)"}
      onTouchEnd={e=>e.currentTarget.style.transform="none"}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 8px 22px ${group.color}18`}}
      onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none"}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:group.color,opacity:featured?1:.45}}/>
      <div style={{position:"absolute",right:-18,top:-22,fontSize:72,opacity:.055,pointerEvents:"none"}}>{m.icon}</div>
      <div style={{display:"flex",alignItems:"flex-start",gap:10,position:"relative"}}>
        <div style={{width:featured?44:38,height:featured?44:38,borderRadius:12,background:`${group.color}16`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:featured?25:22,flexShrink:0,boxShadow:`inset 0 0 0 1px ${group.color}12`}}>{m.icon}</div>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:featured?15:14,fontWeight:900,color:S.t1,lineHeight:1.25}}>{m.t}</div>
          <div style={{fontSize:11,color:S.t2,lineHeight:1.45,marginTop:4}}>{m.d}</div>
          <div style={{display:"inline-block",marginTop:8,fontSize:10,fontWeight:900,color:group.color,background:`${group.color}12`,border:`1px solid ${group.color}22`,borderRadius:999,padding:"3px 8px"}}>{m.tag}</div>
        </div>
      </div>
    </button>);
  };
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12,marginBottom:12}}>
      <div style={{...S.card,padding:"18px",border:`1px solid ${c.cl}33`,background:`radial-gradient(circle at 92% 10%,${c.cl}22,transparent 28%),linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff) 62%)`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-18,bottom:-24,fontSize:116,opacity:.055,pointerEvents:"none"}}>{c.ic}</div>
        <div style={{position:"relative"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11,fontWeight:900,color:c.cl,background:`${c.cl}12`,border:`1px solid ${c.cl}22`,borderRadius:999,padding:"5px 9px",marginBottom:12}}>
            <span>{c.ic}</span><span>{c.l}學習首頁</span>
          </div>
          <div style={{fontSize:13,color:S.t2,fontWeight:800}}>今日推薦單字</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:3,flexWrap:"wrap"}}>
            <div style={{fontSize:"clamp(26px,6vw,38px)",fontWeight:1000,color:S.t1,lineHeight:1.05}}>{todayWord.w}</div>
            <button onClick={()=>speak(todayWord.w)} aria-label="朗讀今日單字" style={{border:`1px solid ${c.cl}33`,background:S.bg1,borderRadius:999,width:40,height:40,fontSize:20,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>🔊</button>
          </div>
          <div style={{fontSize:14,color:S.t2,marginTop:6,lineHeight:1.5}}>{todayWord.m} · {todayWord.p}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:16}}>
            <div style={{flex:1,height:10,background:"rgba(0,0,0,.06)",borderRadius:999,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:999,transition:"width .3s"}}/>
            </div>
            <div style={{fontSize:12,fontWeight:1000,color:c.cl,minWidth:46,textAlign:"right"}}>{pct}%</div>
          </div>
          <div style={{fontSize:11,color:S.t3,marginTop:6}}>今日進度 · 完成練習會累積 XP、金幣與寵物孵化進度</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
        {metricItems.map(item=><button key={item.label} onClick={item.onClick} disabled={!item.onClick} style={{...S.card,padding:"13px 12px",border:`1px solid ${item.color}22`,background:`linear-gradient(135deg,${item.color}10,var(--color-background-primary,#fff))`,textAlign:"left",fontFamily:"inherit",cursor:item.onClick?"pointer":"default",minHeight:78}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <span style={{fontSize:22}}>{item.icon}</span>
            <span style={{fontSize:10,color:item.color,fontWeight:1000,background:`${item.color}12`,borderRadius:999,padding:"2px 7px"}}>{item.label}</span>
          </div>
          <div style={{fontSize:22,fontWeight:1000,color:S.t1,marginTop:7,lineHeight:1}}>{item.value}</div>
        </button>)}
      </div>
    </div>
    {/* Weak words reminder */}
    {weakWords.length>0&&<div style={{...S.card,padding:"12px 14px",marginBottom:12,fontSize:14,border:"1px solid #E24B4A33",background:"linear-gradient(135deg,#FCEBEB,var(--color-background-primary,#fff))",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{fontSize:24}}>📕</div>
      <div style={{flex:1,minWidth:190}}>
        <div style={{fontWeight:900,color:"#B42318",fontSize:13}}>需加強單字</div>
        <div style={{fontSize:12,color:S.t2,marginTop:3,lineHeight:1.5}}>{[...weakWords].sort((a,b)=>b.n-a.n).slice(0,5).map(w=>`${w.w}(${w.n})`).join(" · ")}</div>
      </div>
      <button onClick={()=>onSelect("weak")} style={{border:"none",background:"#E24B4A",color:"#fff",borderRadius:999,padding:"8px 12px",fontSize:12,fontWeight:900,cursor:"pointer",fontFamily:"inherit"}}>去複習</button>
    </div>}
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,margin:"2px 2px 8px"}}>
        <div>
          <div style={{fontSize:15,fontWeight:1000,color:S.t1}}>推薦開始</div>
          <div style={{fontSize:11,color:S.t3,marginTop:2}}>每天先完成核心練習，再依需要切換分類。</div>
        </div>
        <button onClick={()=>setActiveGroup("learn")} style={{border:`1px solid ${c.cl}44`,background:c.bg,color:c.cl,borderRadius:999,padding:"6px 10px",fontSize:11,fontWeight:900,cursor:"pointer",fontFamily:"inherit"}}>看學習</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:9}}>
        {featuredModules.map(m=><ModuleCard key={`featured-${m.id}`} m={m} featured/>)}
      </div>
    </div>
    <div style={{...S.card,padding:"8px",marginBottom:12,display:"flex",gap:7,overflowX:"auto",border:`1px solid ${S.bd}`,background:S.bg1}}>
      {groups.map(g=>{
        const active=g.id===activeGroup;
        const count=modules.filter(m=>m.group===g.id).length;
        return(<button key={g.id} onClick={()=>setActiveGroup(g.id)} style={{border:`1px solid ${active?g.color:"transparent"}`,background:active?`linear-gradient(135deg,${g.color}18,var(--color-background-primary,#fff))`:S.bg2,borderRadius:13,padding:"10px 11px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",boxShadow:active?`0 6px 16px ${g.color}12`:"none",flex:"0 0 auto",minWidth:116}}>
          <div style={{display:"flex",alignItems:"center",gap:7,whiteSpace:"nowrap"}}>
            <span style={{fontSize:20}}>{g.icon}</span>
            <span style={{fontSize:13,fontWeight:1000,color:active?g.color:S.t1}}>{g.t}</span>
            <span style={{marginLeft:"auto",fontSize:10,fontWeight:900,color:active?g.color:S.t3,background:active?`${g.color}13`:S.bg2,borderRadius:999,padding:"2px 6px"}}>{count}</span>
          </div>
        </button>);
      })}
    </div>
    <div style={{...S.card,padding:"14px",border:`1px solid ${activeGroupData.color}22`,background:`linear-gradient(135deg,${activeGroupData.color}08,var(--color-background-primary,#fff))`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
        <div>
          <div style={{fontSize:15,fontWeight:1000,color:activeGroupData.color}}>{activeGroupData.icon} {activeGroupData.t}</div>
          <div style={{fontSize:11,color:S.t3,marginTop:2}}>{activeGroupData.d}</div>
        </div>
        <div style={{fontSize:11,color:activeGroupData.color,fontWeight:900,background:`${activeGroupData.color}12`,borderRadius:999,padding:"5px 9px"}}>{activeModules.length} 個功能</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(168px,1fr))",gap:9}}>
        {activeModules.map(m=><ModuleCard key={m.id} m={m}/>)}
      </div>
    </div>
  </div>);
}

const EXAM_AI_TERMS=[
  ["elementary-1a","小學 1 年級上學期"],["elementary-1b","小學 1 年級下學期"],
  ["elementary-2a","小學 2 年級上學期"],["elementary-2b","小學 2 年級下學期"],
  ["elementary-3a","小學 3 年級上學期"],["elementary-3b","小學 3 年級下學期"],
  ["elementary-4a","小學 4 年級上學期"],["elementary-4b","小學 4 年級下學期"],
  ["elementary-5a","小學 5 年級上學期"],["elementary-5b","小學 5 年級下學期"],
  ["elementary-6a","小學 6 年級上學期"],["elementary-6b","小學 6 年級下學期"],
  ["junior-1a","國中 1 年級上學期"],["junior-1b","國中 1 年級下學期"],
  ["junior-2a","國中 2 年級上學期"],["junior-2b","國中 2 年級下學期"],
  ["junior-3a","國中 3 年級上學期"],["junior-3b","國中 3 年級下學期"],
  ["senior-1a","高中 1 年級上學期"],["senior-1b","高中 1 年級下學期"],
  ["senior-2a","高中 2 年級上學期"],["senior-2b","高中 2 年級下學期"],
  ["senior-3a","高中 3 年級上學期"],["senior-3b","高中 3 年級下學期"],
];
const EXAM_AI_COUNTS=[5,10,15,20,30,50,80];
function defaultExamTerm(lv){return lv==="junior"?"junior-1a":lv==="senior"?"senior-1a":"elementary-1a"}
function normalizeExamAiWords(raw,count){
  const list=Array.isArray(raw?.words)?raw.words:Array.isArray(raw?.vocabulary)?raw.vocabulary:Array.isArray(raw?.items)?raw.items:[];
  const seen=new Set();
  return list.map(x=>String(typeof x==="string"?x:x?.word||x?.en||"").trim().toLowerCase().replace(/^[-']+|[-']+$/g,"")).filter(w=>{
    if(!w||seen.has(w)||!/^[a-z][a-z'-]*$/.test(w))return false;
    seen.add(w);
    return true;
  }).slice(0,count);
}
async function generateExamAiWords({term,lv,apiKey,count=10}){
  if(!apiKey?.trim())throw new Error("請先到設定填入 Gemini API Key。");
  const termLabel=EXAM_AI_TERMS.find(([id])=>id===term)?.[1]||LV[lv]?.l||"指定學年";
  const prompt=`你是台灣學生的英文考試複習老師。請依「${termLabel}」程度產生 ${count} 個適合考前複習的英文單字。

單字要求：
- 只輸出英文單字，不要中文、不要題目、不要例句。
- 小學生用生活字彙與校園常用字。
- 國中生用常見會考與課本核心字。
- 高中生用學測常見與閱讀常用字。
- 避免重複，避免太冷門或超出該學年太多。

請輸出 STRICT JSON：
{"words":["apple","school","water"]}`;
  const models=["gemini-2.5-flash-lite","gemini-2.5-flash","gemini-2.0-flash"];
  for(const model of models){
    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:1800,temperature:0.55,responseMimeType:"application/json"}}),
      });
      const data=await res.json();
      if(!res.ok||data?.error)continue;
      const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("");
      if(!text)continue;
      const words=normalizeExamAiWords(parseGrammarJson(text),count);
      if(words.length)return words;
    }catch{}
  }
  throw new Error("AI 單字暫時產生失敗，請稍後再試。");
}
function ExamReviewM({lv,onBack,c,onStart,apiKey,onOpenSettings}){
  const sample=lv==="elementary"?"apple school water happy run":lv==="junior"?"environment experience communicate opportunity improve":"comprehensive phenomenon sustainable ambiguous facilitate";
  const[text,setText]=useLS(`exam_${lv}`,"");
  const[aiTerm,setAiTerm]=useLS(`exam_ai_term_${lv}`,defaultExamTerm(lv));
  const[aiCount,setAiCount]=useLS(`exam_ai_count_${lv}`,10);
  const[aiNote,setAiNote]=useState("");
  const[aiBusy,setAiBusy]=useState(false);
  const[aiErr,setAiErr]=useState("");
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState("");
  const[progress,setProgress]=useState("");
  const words=useMemo(()=>parseExamWords(text),[text]);
  const rawCount=useMemo(()=>countExamRawItems(text),[text]);
  const ignoredCount=Math.max(0,rawCount-words.length);
  const start=async()=>{
    setErr("");
    setProgress("");
    if(words.length<1){setErr("請先輸入至少 1 個英文單字。");return}
    setBusy(true);
    try{
      let done=0;
      const resolved=await Promise.all(words.map(async word=>{
        const [cloud,local]=await Promise.all([fetchCloudWord(lv,word),findAnyWord(lv,word)]);
        const found=cloud||local;
        done+=1;
        setProgress(`${done}/${words.length}`);
        if(found)return{...found,w:found.w||word};
        return{w:word,ph:"",p:"",m:"待查字義",f:[],c:["使用查字典補上解釋"],ex:`I am reviewing ${word}.`,ez:"我正在複習這個單字。",source:"自訂輸入",customMissing:true};
      }));
      const cards=orderExamCards(resolved,lv);
      const missing=cards.filter(x=>x.customMissing).map(x=>x.w);
      onStart?.({cards,missing,source:`考試範圍 (${cards.length}字${missing.length?`，${missing.length}字待查`:''})`});
    }catch{
      setErr("整理單字時發生問題，請稍後再試。");
    }finally{
      setBusy(false);
      setProgress("");
    }
  };
  const generateAi=async()=>{
    setAiErr("");
    setAiNote("");
    if(!apiKey?.trim()){setAiErr("請先到設定填入 Gemini API Key。");onOpenSettings?.();return}
    setAiBusy(true);
    try{
      const count=Number(aiCount)||10;
      const generated=await generateExamAiWords({term:aiTerm,lv,apiKey,count});
      setText(generated.join(" "));
      setAiNote(`已產生 ${generated.length} 個單字並填入上方範圍。`);
    }
    catch(e){setAiErr(e?.message||"AI 單字暫時產生失敗。")}
    finally{setAiBusy(false)}
  };
  return(<div>
    <Hdr t="📝 考試範圍複習" onBack={onBack} cl={c.cl}/>
    <section style={{...S.card,padding:18,border:`1px solid ${c.cl}55`,background:`linear-gradient(135deg,${c.bg},${S.bg1})`,boxShadow:"0 18px 42px rgba(20,66,52,.10)"}}>
      <div className="eg-exam-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 220px",gap:14,alignItems:"stretch"}}>
        <div>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:999,background:S.bg2,border:`1px solid ${S.bd}`,fontSize:12,fontWeight:900,color:c.cl,marginBottom:10}}>考前自訂一輪</div>
          <h3 style={{fontSize:22,lineHeight:1.25,margin:"0 0 8px",color:S.t1}}>貼上老師指定的單字範圍</h3>
          <p style={{fontSize:13,lineHeight:1.7,color:S.t2,margin:"0 0 14px"}}>可用空格、逗號或換行分隔。系統會自動整理並打散順序，練習時不會照輸入順序出題。</p>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={`例如：\n${sample}`} disabled={busy} style={{width:"100%",minHeight:190,resize:"vertical",border:`1px solid ${S.bd}`,borderRadius:16,background:S.bg1,color:S.t1,padding:"13px 14px",fontSize:16,lineHeight:1.6,fontFamily:"inherit",outline:"none",boxShadow:"inset 0 1px 4px rgba(0,0,0,.04)",opacity:busy?0.82:1}}/>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginTop:7,fontSize:12,color:S.t3}}>
            <span>已自動儲存這份範圍</span>
            <span>{ignoredCount?`已合併/忽略 ${ignoredCount} 筆重複或無效內容`:"重複單字會自動合併"}</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:12}}>
            <button onClick={start} disabled={busy||words.length<1} style={{...S.btn,background:busy||words.length<1?S.bg2:c.cl,color:busy||words.length<1?S.t3:"#fff",padding:"11px 18px",fontSize:14,minHeight:44,cursor:busy||words.length<1?"not-allowed":"pointer"}}>{busy?`整理中 ${progress}`:"開始這輪複習"}</button>
            <button onClick={()=>setText(sample)} disabled={busy} style={{...S.btn,background:S.bg2,color:c.cl,padding:"11px 14px",fontSize:13,minHeight:44}}>填入範例</button>
            {text&&<button onClick={()=>setText("")} disabled={busy} style={{...S.btn,background:S.bg2,color:S.t2,padding:"11px 14px",fontSize:13,minHeight:44}}>清空</button>}
          </div>
          {err&&<div style={{marginTop:10,padding:"9px 11px",borderRadius:12,background:"#fff4f4",border:"1px solid #f2c7c7",color:"#9f2f2f",fontSize:13}}>{err}</div>}
          {words.length>0&&<div style={{marginTop:14,padding:12,border:`1px solid ${S.bd}`,borderRadius:16,background:S.bg1}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8}}>
              <div style={{fontSize:12,fontWeight:900,color:S.t2}}>本輪單字清單</div>
              <div style={{fontSize:11,color:S.t3}}>只確認範圍，不代表出題順序</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:6,maxHeight:150,overflow:"auto"}}>
              {words.map(w=><span key={w} style={{fontSize:12,color:S.t1,background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:10,padding:"6px 8px",fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w}</span>)}
            </div>
          </div>}
          <div style={{marginTop:16,padding:14,border:"1px solid #DDD6FE",borderRadius:18,background:"#F5F3FF"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:12,fontWeight:1000,color:"#6D28D9",marginBottom:4}}>AI 產生單字</div>
                <div style={{fontSize:15,fontWeight:900,color:S.t1}}>依學年、學期與數量填入單字範圍</div>
                <div style={{fontSize:12,color:S.t2,lineHeight:1.6,marginTop:3}}>選好程度與單字數量後，AI 會把單字放進上方輸入框，再用原本流程開始複習。</div>
              </div>
              <button onClick={generateAi} disabled={aiBusy} style={{...S.btn,background:"#6D28D9",color:"#fff",padding:"10px 14px",fontSize:13,minHeight:42,opacity:aiBusy ? .65 : 1}}>{aiBusy?"AI 產生中...":"AI 產生單字"}</button>
            </div>
            <div className="eg-exam-ai-controls" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 132px",gap:8}}>
              <select data-testid="exam-ai-term" value={aiTerm} onChange={e=>setAiTerm(e.target.value)} disabled={aiBusy} style={{width:"100%",border:"1px solid #C4B5FD",borderRadius:12,background:S.bg1,color:S.t1,padding:"10px 12px",fontSize:14,fontWeight:800,fontFamily:"inherit",outline:"none"}}>
                {EXAM_AI_TERMS.map(([id,label])=><option key={id} value={id}>{label}</option>)}
              </select>
              <select data-testid="exam-ai-count" value={aiCount} onChange={e=>setAiCount(Number(e.target.value))} disabled={aiBusy} style={{width:"100%",border:"1px solid #C4B5FD",borderRadius:12,background:S.bg1,color:S.t1,padding:"10px 12px",fontSize:14,fontWeight:800,fontFamily:"inherit",outline:"none"}}>
                {EXAM_AI_COUNTS.map(n=><option key={n} value={n}>{n} 字</option>)}
              </select>
            </div>
            {aiErr&&<div style={{marginTop:10,padding:"9px 11px",borderRadius:12,background:"#FFF7E6",border:"1px solid #F0D59A",color:"#8A5A00",fontSize:13,lineHeight:1.55}}>{aiErr}</div>}
            {aiNote&&<div style={{marginTop:10,padding:"9px 11px",borderRadius:12,background:"#EDE9FE",border:"1px solid #C4B5FD",color:"#5B21B6",fontSize:13,fontWeight:850,lineHeight:1.55}}>{aiNote}</div>}
          </div>
        </div>
        <aside style={{border:`1px solid ${S.bd}`,borderRadius:18,background:S.bg1,padding:14,display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <div style={{fontSize:12,fontWeight:900,color:S.t2}}>已讀取單字</div>
            <div style={{fontSize:34,fontWeight:1000,color:c.cl,lineHeight:1,marginTop:6}}>{words.length}</div>
            <div style={{fontSize:12,color:S.t3,marginTop:5}}>最多 80 個，重複會自動合併</div>
            {ignoredCount>0&&<div style={{fontSize:11,color:"#BA7517",marginTop:5}}>已排除 {ignoredCount} 筆重複或無效項目</div>}
          </div>
          <div style={{height:1,background:S.bd}}/>
          <div>
            <div style={{fontSize:12,fontWeight:900,color:S.t2,marginBottom:7}}>系統規則</div>
            {["保留你輸入的所有單字","優先使用雲端字庫資料","未收錄字可進 SRS 後查字典","練習順序由系統決定"].map(x=><div key={x} style={{display:"flex",gap:7,alignItems:"flex-start",fontSize:12,color:S.t2,lineHeight:1.55,marginBottom:6}}><span style={{color:c.cl,fontWeight:900}}>✓</span><span>{x}</span></div>)}
          </div>
          {words.length>0&&<div style={{fontSize:11,color:S.t3,lineHeight:1.6,padding:"9px 10px",background:S.bg2,borderRadius:12}}>開始後會先整理字義與例句，找不到的字仍會放進本輪，翻到背面可用「查字典」補充。</div>}
        </aside>
      </div>
    </section>
    <style>{`@media (max-width: 780px){.eg-exam-grid{grid-template-columns:1fr!important}}@media (max-width: 520px){.eg-exam-ai-controls{grid-template-columns:1fr!important}} textarea:focus{border-color:${c.cl}!important;box-shadow:0 0 0 3px ${c.cl}22!important}`}</style>
  </div>);
}

function WordSearchM({lv,onBack,onOpenCard}){
  const c=LV[lv];const[q,setQ]=useState("");const[results,setResults]=useState([]);const[loading,setLoading]=useState(false);const[searched,setSearched]=useState(false);
  const[scope,setScope]=useState("all");
  const searchSeq=useRef(0);
  const doSearch=useCallback(async(term=q)=>{
    const raw=String(term||"").trim();
    if(!raw){searchSeq.current++;setResults([]);setSearched(false);setLoading(false);return}
    const seq=++searchSeq.current;
    setLoading(true);setSearched(true);
    const[cloud,local]=await Promise.all([searchCloudWords(lv,raw,22,scope),searchAnyWords(lv,raw,22,scope)]);
    if(seq!==searchSeq.current)return;
    setResults(mergeWordResults([...cloud,...local],22,lv));
    setLoading(false);
  },[lv,q,scope]);
  useEffect(()=>{const t=window.setTimeout(()=>doSearch(q),260);return()=>window.clearTimeout(t)},[q,doSearch]);
  const open=(item)=>onOpenCard?.(item.w,item.level||lv);
  const examples=["little","小","媽媽","crystal","practice","responsible"];
  return(<div><Hdr t="🔎 單字查詢" onBack={onBack} cl={c.cl}/>
    <div style={{...S.card,padding:"14px 16px",marginBottom:10}}>
      <div style={{display:"flex",gap:8}}>
        <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")doSearch(q)}} placeholder="輸入英文或中文意思，例如 mom / 媽媽" autoFocus style={{flex:1,padding:"12px 13px",border:`1px solid ${S.bd}`,borderRadius:10,fontSize:16,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none"}}/>
        <button onClick={()=>doSearch(q)} style={{...S.btn,background:c.cl,color:"#fff",padding:"0 15px",fontSize:14}}>搜尋</button>
      </div>
      <div style={{display:"flex",gap:6,marginTop:10}}>
        {[["all","全部年級"],["current",`${LV[lv]?.l||"本年級"}`]].map(([id,label])=><button key={id} onClick={()=>setScope(id)} style={{border:`1px solid ${scope===id?c.cl:S.bd}`,background:scope===id?c.bg:S.bg1,borderRadius:999,padding:"6px 11px",fontSize:12,color:scope===id?c.cl:S.t2,cursor:"pointer",fontWeight:800,fontFamily:"inherit"}}>{label}</button>)}
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>{examples.map(w=><button key={w} onClick={()=>setQ(w)} style={{border:`1px solid ${S.bd}`,background:S.bg2,borderRadius:999,padding:"5px 10px",fontSize:12,color:S.t2,cursor:"pointer",fontFamily:"inherit"}}>{w}</button>)}</div>
    </div>
    {loading&&<div style={{textAlign:"center",padding:"18px",color:S.t3,fontSize:13}}>查詢中...</div>}
    {!loading&&searched&&results.length===0&&<div style={{...S.card,padding:"24px 16px",textAlign:"center",color:S.t2}}><div style={{fontSize:34,marginBottom:6}}>🔍</div><div style={{fontWeight:800,color:S.t1}}>找不到這個單字</div><div style={{fontSize:12,marginTop:5,lineHeight:1.6}}>可以輸入英文、中文意思，或試試原形，例如用 <b>run</b> 查詢 <b>running</b>。</div></div>}
    {!loading&&searched&&results.length>0&&<div style={{fontSize:12,color:S.t3,margin:"0 4px 8px"}}>找到 {results.length} 筆 · {scope==="all"?"全部年級":"本年級"}</div>}
    <div style={{display:"grid",gap:8}}>
      {!loading&&results.map(item=><div key={`${item.level}-${item.w}-${item.source}`} style={{...S.card,padding:"13px 14px",display:"flex",alignItems:"center",gap:12}}>
        <div onClick={()=>speak(item.w)} style={{width:44,height:44,borderRadius:12,background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,cursor:"pointer",flexShrink:0}}>{getWordImg(item.w)?.type==="emoji"?getWordImg(item.w).value:"🔊"}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:6,alignItems:"baseline",flexWrap:"wrap"}}><span style={{fontSize:18,fontWeight:900,color:S.t1}}>{item.w}</span>{item.ph&&<span style={{fontSize:12,color:S.t3}}>{item.ph}</span>}<span style={{fontSize:11,color:S.t3}}>{item.p}</span></div>
          <div style={{fontSize:14,color:S.t2,lineHeight:1.5,marginTop:2}}>{item.m}</div>
          <div style={{fontSize:11,color:S.t3,marginTop:4}}>{LV[item.level]?.l||item.level} · {item.source}</div>
        </div>
        <button onClick={()=>open(item)} style={{...S.btn,background:c.cl,color:"#fff",padding:"9px 10px",fontSize:12,flexShrink:0}}>到單字卡</button>
      </div>)}
    </div>
  </div>);
}


// ═══ GIF SEARCH (Giphy API) ═══════════════════════════════════════
const _gifCache={};
const LazySRS=lazy(()=>import("./features/SRS.jsx"));
function SRS(props){
  const deps={V,LV,S,fetchCloudVocab,fetchCloudWord,findAnyWord,sortCardsForStudy,createDeck,rateDeck,getWordImg,preloadImgs,isPlaceholderExample,exampleCache:_exampleCache,generateExample,preloadTts,speak,speakWebSpeech,speechTimer,playSound,triggerRewardBurst,parseCSV,Hdr,Confetti};
  return <Suspense fallback={<div style={{textAlign:"center",padding:"48px 16px",color:S.t3}}>??????...</div>}><LazySRS {...props} deps={deps}/></Suspense>;
}

function playSound(type){try{const ac=new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator();const g=ac.createGain();o.connect(g);g.connect(ac.destination);g.gain.value=0.15;if(type==="flip"){o.frequency.value=520;o.type="sine";g.gain.exponentialRampToValueAtTime(.01,ac.currentTime+.15);o.start();o.stop(ac.currentTime+.15)}else if(type==="good"){o.frequency.value=660;o.type="sine";o.start();setTimeout(()=>{o.frequency.value=880},80);g.gain.exponentialRampToValueAtTime(.01,ac.currentTime+.25);o.stop(ac.currentTime+.25)}else if(type==="bad"){o.frequency.value=300;o.type="triangle";g.gain.exponentialRampToValueAtTime(.01,ac.currentTime+.3);o.start();o.stop(ac.currentTime+.3)}else if(type==="combo"){o.frequency.value=780;o.type="sine";o.start();setTimeout(()=>{const o2=ac.createOscillator();const g2=ac.createGain();o2.connect(g2);g2.connect(ac.destination);g2.gain.value=0.12;o2.frequency.value=1040;o2.type="sine";g2.gain.exponentialRampToValueAtTime(.01,ac.currentTime+.2);o2.start();o2.stop(ac.currentTime+.2)},100);g.gain.exponentialRampToValueAtTime(.01,ac.currentTime+.15);o.stop(ac.currentTime+.15)}else if(type==="done"){[523,659,784,1047].forEach((f,i)=>{const oo=ac.createOscillator();const gg=ac.createGain();oo.connect(gg);gg.connect(ac.destination);gg.gain.value=0.1;oo.frequency.value=f;oo.type="sine";gg.gain.exponentialRampToValueAtTime(.01,ac.currentTime+i*.12+.3);oo.start(ac.currentTime+i*.12);oo.stop(ac.currentTime+i*.12+.3)})}}catch{}}

let _battleAudioCtx=null;
function getBattleAudioCtx(){
  if(typeof window==="undefined"||(!window.AudioContext&&!window.webkitAudioContext))return null;
  try{
    if(!_battleAudioCtx||_battleAudioCtx.state==="closed")_battleAudioCtx=new(window.AudioContext||window.webkitAudioContext)();
    _battleAudioCtx.resume?.();
    return _battleAudioCtx;
  }catch{return null}
}
function battleTone(ctx,{freq=440,endFreq=null,start=0,dur=.18,type="sine",volume=.08,destination=null,attack=.01,filterFreq=null}={}){
  if(!ctx)return;
  const when=ctx.currentTime+start;
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  let node=gain;
  osc.type=type;
  osc.frequency.setValueAtTime(freq,when);
  if(endFreq)osc.frequency.exponentialRampToValueAtTime(Math.max(1,endFreq),when+dur);
  gain.gain.setValueAtTime(.0001,when);
  gain.gain.linearRampToValueAtTime(volume,when+attack);
  gain.gain.exponentialRampToValueAtTime(.0001,when+dur);
  if(filterFreq){
    const filter=ctx.createBiquadFilter();
    filter.type="lowpass";
    filter.frequency.value=filterFreq;
    gain.connect(filter);
    node=filter;
  }
  osc.connect(gain);
  node.connect(destination||ctx.destination);
  osc.start(when);
  osc.stop(when+dur+.03);
}
function battleNoise(ctx,{start=0,dur=.12,volume=.05,filterType="bandpass",filterFreq=1800,destination=null}={}){
  if(!ctx)return;
  const buffer=ctx.createBuffer(1,Math.max(1,Math.floor(ctx.sampleRate*dur)),ctx.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const src=ctx.createBufferSource();
  const filter=ctx.createBiquadFilter();
  const gain=ctx.createGain();
  const when=ctx.currentTime+start;
  src.buffer=buffer;
  filter.type=filterType;
  filter.frequency.value=filterFreq;
  filter.Q.value=5;
  gain.gain.setValueAtTime(.0001,when);
  gain.gain.linearRampToValueAtTime(volume,when+.008);
  gain.gain.exponentialRampToValueAtTime(.0001,when+dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(destination||ctx.destination);
  src.start(when);
  src.stop(when+dur+.02);
}
function playPetAdventureSkillSound(skillId,correct=true){
  const ctx=getBattleAudioCtx();
  if(!ctx)return;
  if(!correct){
    battleNoise(ctx,{dur:.18,volume:.07,filterType:"lowpass",filterFreq:700});
    battleTone(ctx,{freq:220,endFreq:110,dur:.28,type:"sawtooth",volume:.08});
    return;
  }
  const recipes={
    wordSpark:()=>{[880,1175,1568].forEach((f,i)=>battleTone(ctx,{freq:f,dur:.11,start:i*.06,type:"sine",volume:.07,filterFreq:3600}));battleNoise(ctx,{start:.08,dur:.12,volume:.035,filterFreq:4200});},
    braveGuard:()=>{battleTone(ctx,{freq:196,dur:.22,type:"triangle",volume:.08});battleTone(ctx,{freq:392,dur:.18,start:.06,type:"square",volume:.045,filterFreq:1100});battleNoise(ctx,{start:.03,dur:.16,volume:.035,filterType:"highpass",filterFreq:2600});},
    quickStep:()=>{[520,780,1040].forEach((f,i)=>battleTone(ctx,{freq:f,endFreq:f*1.18,dur:.07,start:i*.055,type:"triangle",volume:.065,filterFreq:3200}));},
    melodyHeal:()=>{[523,659,784,1047].forEach((f,i)=>battleTone(ctx,{freq:f,dur:.18,start:i*.09,type:"sine",volume:.055,filterFreq:2600}));},
    magicLeaf:()=>{battleNoise(ctx,{dur:.34,volume:.035,filterFreq:1200});[330,495,742,990].forEach((f,i)=>battleTone(ctx,{freq:f,endFreq:f*1.35,dur:.24,start:i*.045,type:"triangle",volume:.05,filterFreq:3000}));},
  };
  (recipes[skillId]||recipes.wordSpark)();
}
function createPetAdventureBgm({boss=false,difficulty=1}={}){
  const ctx=getBattleAudioCtx();
  if(!ctx)return{stop:()=>{}};
  const master=ctx.createGain();
  master.gain.value=0.0001;
  master.connect(ctx.destination);
  const volume=boss?0.065:0.045;
  master.gain.linearRampToValueAtTime(volume,ctx.currentTime+.35);
  const base=boss?[98,116.5,130.8,87.3]:[130.8,146.8,164.8,196];
  const melody=boss?[196,233,261,174]:[523,659,587,784];
  const tempo=Math.max(.42,.62-Math.min(8,difficulty)*.018);
  let step=0;
  let stopped=false;
  const schedule=()=>{
    if(stopped)return;
    const s=step%8;
    const root=base[Math.floor(s/2)%base.length];
    battleTone(ctx,{freq:root,dur:tempo*.72,type:boss?"sawtooth":"triangle",volume:boss?0.042:0.03,destination:master,filterFreq:boss?620:900});
    if(s%2===0)battleTone(ctx,{freq:melody[(s/2)%melody.length],start:tempo*.35,dur:tempo*.34,type:"sine",volume:boss?0.024:0.018,destination:master,filterFreq:2400});
    if(s%2===1)battleNoise(ctx,{start:tempo*.2,dur:.035,volume:boss?0.018:0.012,filterType:"highpass",filterFreq:3600,destination:master});
    step++;
  };
  schedule();
  const timer=window.setInterval(schedule,tempo*1000);
  return{
    boss,
    stop:()=>{
      if(stopped)return;
      stopped=true;
      window.clearInterval(timer);
      try{
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value,ctx.currentTime);
        master.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.35);
        window.setTimeout(()=>master.disconnect(),450);
      }catch{}
    }
  };
}

function Confetti(){const ps=useMemo(()=>Array.from({length:40},(_,i)=>({id:i,x:Math.random()*100,d:Math.random()*3+2,c:["#E24B4A","#EF9F27","#1D9E75","#185FA5","#D85A30","#7F77DD","#FF69B4","#FFD700"][i%8],s:Math.random()*.4+.3,r:Math.random()*360})),[]);return(<div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>{ps.map(p=><div key={p.id} style={{position:"absolute",left:`${p.x}%`,top:0,width:8,height:8,background:p.c,borderRadius:p.id%3===0?"50%":"2px",animation:`confDrop ${p.d}s ${p.s}s ease-in forwards`,transform:`rotate(${p.r}deg)`}}/>)}</div>)}

const HOMOPHONES={
  "light":["lite","right"],"right":["rite","write","light"],"write":["right","rite"],
  "hear":["here"],"here":["hear"],"there":["their","theyre"],"their":["there","theyre"],
  "two":["to","too"],"to":["two","too"],"too":["to","two"],
  "for":["four","fore"],"four":["for","fore"],"knight":["night"],"night":["knight"],
  "no":["know"],"know":["no"],"sea":["see"],"see":["sea"],"be":["bee"],"bee":["be"],
  "by":["buy","bye"],"buy":["by","bye"],"bye":["by","buy"],
  "read":["red","reed"],"red":["read"],"meat":["meet"],"meet":["meat"],
  "week":["weak"],"weak":["week"],"one":["won"],"won":["one"],
  "hour":["our"],"our":["hour"],"flower":["flour"],"flour":["flower"],
  "pair":["pear","pare"],"pear":["pair"],"piece":["peace"],"peace":["piece"],
  "son":["sun"],"sun":["son"],"mail":["male"],"male":["mail"],
};

function normalizeText(text){
  return String(text||"")
    .toLowerCase()
    .replace(/[’‘]/g,"'")
    .replace(/[^a-z0-9'\s-]/g," ")
    .replace(/-/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function editDist(a,b){
  const s=String(a||""),t=String(b||"");
  const dp=Array.from({length:s.length+1},()=>Array(t.length+1).fill(0));
  for(let i=0;i<=s.length;i++)dp[i][0]=i;
  for(let j=0;j<=t.length;j++)dp[0][j]=j;
  for(let i=1;i<=s.length;i++){
    for(let j=1;j<=t.length;j++){
      const cost=s[i-1]===t[j-1]?0:1;
      dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost);
    }
  }
  return dp[s.length][t.length];
}

// Fuzzy match a single word — allow edit distance based on length
function wordMatches(target,spoken){
  if(target===spoken)return true;
  // Check homophones
  if(HOMOPHONES[target]?.includes(spoken)||HOMOPHONES[spoken]?.includes(target))return true;
  // Edit distance tolerance: 1 for 3-4 letters, 2 for 5-7, 3 for 8+
  const maxLen=Math.max(target.length,spoken.length);
  if(maxLen<=2)return target===spoken;
  const tol=maxLen<=4?1:maxLen<=7?2:3;
  const dist=editDist(target,spoken);
  if(dist<=tol)return true;
  // Substring match for longer words (apple/apples/applied)
  if(target.length>=4&&spoken.length>=4){
    if(spoken.startsWith(target.slice(0,Math.max(3,target.length-2))))return true;
    if(target.startsWith(spoken.slice(0,Math.max(3,spoken.length-2))))return true;
  }
  return false;
}

function compareWords(original,spoken){
  const ow=normalizeText(original).split(" ").filter(Boolean);
  const sw=normalizeText(spoken).split(" ").filter(Boolean);
  // Try to match each original word to any spoken word (fuzzy)
  const usedSpoken=new Set();
  const result=ow.map(w=>{
    let found=sw.findIndex((s,i)=>!usedSpoken.has(i)&&s===w);
    if(found<0)found=sw.findIndex((s,i)=>!usedSpoken.has(i)&&wordMatches(w,s));
    if(found>=0)usedSpoken.add(found);
    return{word:w,ok:found>=0,heard:found>=0?sw[found]:""};
  });
  const correct=result.filter(r=>r.ok).length;
  const extra=sw.filter((_,i)=>!usedSpoken.has(i));
  return{result,correct,total:ow.length,pct:Math.round((correct/Math.max(ow.length,1))*100),extra};
}

// Fallback sentences for when cloud is unavailable
const SPEAK_FALLBACK = {
  elementary:[{en:"apple",zh:"蘋果",type:"word"},{en:"I like to eat apples.",zh:"我喜歡吃蘋果。",type:"sentence"},{en:"happy",zh:"開心的",type:"word"},{en:"She is my best friend.",zh:"她是我最好的朋友。",type:"sentence"},{en:"school",zh:"學校",type:"word"},{en:"We go to school every day.",zh:"我們每天上學。",type:"sentence"},{en:"Good morning, everyone!",zh:"大家早安！",type:"sentence"},{en:"water",zh:"水",type:"word"},{en:"Please drink some water.",zh:"請喝一些水。",type:"sentence"},{en:"I am happy today.",zh:"我今天很開心。",type:"sentence"}],
  junior:[{en:"environment",zh:"環境",type:"word"},{en:"We should protect the environment.",zh:"我們應該保護環境。",type:"sentence"},{en:"experience",zh:"經驗",type:"word"},{en:"Practice can improve your English.",zh:"練習可以提升英文。",type:"sentence"},{en:"communicate",zh:"溝通",type:"word"},{en:"Communication is very important.",zh:"溝通非常重要。",type:"sentence"},{en:"opportunity",zh:"機會",type:"word"},{en:"Technology has changed our daily life.",zh:"科技改變了我們的日常生活。",type:"sentence"},{en:"She has been to Japan twice.",zh:"她去過日本兩次。",type:"sentence"},{en:"responsible",zh:"負責任的",type:"word"}],
  senior:[{en:"controversial",zh:"有爭議的",type:"word"},{en:"Climate change is a global phenomenon.",zh:"氣候變遷是全球現象。",type:"sentence"},{en:"sustainable",zh:"可持續的",type:"word"},{en:"We need sustainable energy solutions.",zh:"我們需要永續能源方案。",type:"sentence"},{en:"unprecedented",zh:"史無前例的",type:"word"},{en:"Technology can facilitate effective learning.",zh:"科技可以促進有效學習。",type:"sentence"},{en:"comprehensive",zh:"全面的",type:"word"},{en:"Critical thinking is an essential skill.",zh:"批判性思考是必要的技能。",type:"sentence"},{en:"deteriorate",zh:"惡化",type:"word"},{en:"Education is the foundation of society.",zh:"教育是社會的基石。",type:"sentence"}],
};

async function fetchSpeakItems(lv,count=10){
  const cloud=await fetchCloudVocab(lv,count);
  if(!cloud?.length)return SPEAK_FALLBACK[lv];
  const items=[];
  cloud.forEach(w=>{
    // Always add the word itself
    items.push({en:w.w,zh:w.m,type:"word",pos:w.p});
    // If has example, add sentence too
    if(w.ex&&w.ez)items.push({en:w.ex,zh:w.ez,type:"sentence",keyword:w.w});
  });
  return items.sort(()=>Math.random()-.5).slice(0,count);
}

const SPEAK_MODE_OPTIONS=[
  {id:"mixed",label:"單字+句子",desc:"先暖身，再練完整句"},
  {id:"word",label:"單字練習",desc:"專注發音與重音"},
  {id:"sentence",label:"句子練習",desc:"練語調與流暢度"},
];

function selectSpeakItemsByMode(source,mode){
  const list=Array.isArray(source)?source.filter(Boolean):[];
  if(mode==="word"){
    const words=list.filter(x=>x.type!=="sentence");
    return words.length?words:list;
  }
  if(mode==="sentence"){
    const sentences=list.filter(x=>x.type==="sentence");
    return sentences.length?sentences:list;
  }
  return list;
}

const PRONUNCIATION_HINTS={
  apple:{zhSound:"欸-婆",syllables:"ap · ple",stress:"第一拍 ap",mouth:"嘴巴先打開念「欸」，最後輕輕收成「婆」。",mistake:"不要把 ple 念成很重的「普」。",steps:["先慢慢念「欸」","尾巴輕輕補上「婆」","最後連起來 apple"]},
  school:{zhSound:"思-估",syllables:"school",stress:"整個字一拍",mouth:"先用很輕的「思」開頭，再把嘴唇收圓念 oo。",mistake:"不要漏掉開頭的 s，也不要念成中文「死故」。",steps:["先吐出 s 的氣音","接著念長長的 oo","最後輕收成 school"]},
  water:{zhSound:"窩-特",syllables:"wa · ter",stress:"第一拍 wa",mouth:"嘴巴先圓起來念「窩」，尾音短短收住。",mistake:"t 不要念太重，美式常聽起來像很輕的 d。",steps:["先念「窩」","再接很短的「特」","連起來 water"]},
  happy:{zhSound:"哈-皮",syllables:"hap · py",stress:"第一拍 hap",mouth:"先笑開嘴巴念 ha，第二拍輕輕收成 py。",mistake:"不要把 py 拉太長。",steps:["先念「哈」","再接輕短的「皮」","連起來 happy"]},
  run:{zhSound:"潤",syllables:"run",stress:"整個字一拍",mouth:"舌頭往後捲一點念 r，嘴巴不要張太大。",mistake:"不要念成中文「爛」或「讓」。",steps:["先做 r 的捲舌感","短短念出 u","最後收 n"]},
  environment:{zhSound:"恩-外-倫-門特",syllables:"en · vi · ron · ment",stress:"第二拍 vi",mouth:"先分四小段，第二拍說清楚，最後 ment 輕輕收尾。",mistake:"不要每一拍都一樣大聲。",steps:["先分段 en-vi-ron-ment","第二拍 vi 念大聲","最後加快連起來"]},
  experience:{zhSound:"伊克-斯比-瑞-恩斯",syllables:"ex · pe · ri · ence",stress:"第二拍 pe",mouth:"開頭 ex 很短，pe 要清楚，尾巴 ence 輕輕帶過。",mistake:"不要漏掉中間的 r 音。",steps:["先念 ex","再重念 pe","接 ri-ence"]},
  communicate:{zhSound:"可-謬-尼-開特",syllables:"com · mu · ni · cate",stress:"第二拍 mu",mouth:"第二拍嘴唇收圓像念「謬」，最後 cate 清楚收住。",mistake:"不要把每一拍都拖長。",steps:["先切成四拍","第二拍念大聲","最後連起來"]},
  opportunity:{zhSound:"阿-婆-吐-紐-迪",syllables:"op · por · tu · ni · ty",stress:"第三拍 tu",mouth:"前兩拍短短帶過，第三拍 tu 明顯一點。",mistake:"不要把 opportunity 念成一長串沒有重音。",steps:["先分成五拍","第三拍加重","慢慢連起來"]},
  responsible:{zhSound:"瑞-斯邦-瑟-伯",syllables:"re · spon · si · ble",stress:"第二拍 spon",mouth:"第二拍嘴巴放鬆往下，最後 ble 很輕。",mistake:"不要把 ble 念成完整的「波」。",steps:["先念 re","重念 spon","輕收 si-ble"]},
  controversial:{zhSound:"康-特-佛-修",syllables:"con · tro · ver · sial",stress:"第三拍 ver",mouth:"第三拍 ver 比較重，最後 sial 像很快的「修」。",mistake:"不要把最後一拍念成中文「校」。",steps:["先分四拍","第三拍加重","最後收短"]},
  sustainable:{zhSound:"瑟-斯-TEI-納-伯",syllables:"sus · tain · a · ble",stress:"第二拍 tain",mouth:"tain 要念成長音，尾巴 ble 很輕。",mistake:"不要把 sustain 和 able 分得太開。",steps:["先念 sus","重念 tain","接 a-ble"]},
  unprecedented:{zhSound:"安-普瑞-瑟-登-特",syllables:"un · pre · ce · dent · ed",stress:"第二拍 pre",mouth:"第二拍 pre 清楚，最後 ed 很短。",mistake:"不要把 ed 念成很重的「的」。",steps:["先分五拍","第二拍加重","尾音收短"]},
  comprehensive:{zhSound:"康-普瑞-亨-西夫",syllables:"com · pre · hen · sive",stress:"第三拍 hen",mouth:"第三拍 hen 明顯一點，最後 sive 用 v 輕輕震動。",mistake:"不要把 v 念成 f。",steps:["先分四拍","第三拍加重","最後注意 v"]},
  deteriorate:{zhSound:"迪-提-里-歐-瑞特",syllables:"de · te · ri · o · rate",stress:"第二拍 te",mouth:"前面兩拍清楚，後面 rio-rate 慢慢接上。",mistake:"不要漏掉中間的 ri-o。",steps:["先分五拍","第二拍加重","再加快連起來"]},
};

function speakGuideTarget(item){
  if(!item)return"";
  if(item.type==="sentence")return normalizeText(item.en);
  return String(item.en||"").trim().toLowerCase();
}
function sentenceContentWords(words){
  const weak=new Set(["i","you","he","she","we","they","my","your","his","her","our","their","a","an","the","to","in","on","at","of","for","and","is","am","are","was","were"]);
  return words.filter(word=>word.length>2&&!weak.has(word)).slice(0,4);
}
const BAD_PRONUNCIATION_CHARS=/[ㄅ-ㄩㆠ-ㆿぁ-ゟ゠-ヿА-Яа-я\u0600-\u06FF\u0900-\u097F]/u;
function hasBadPronunciationText(value){return BAD_PRONUNCIATION_CHARS.test(String(value||""))}
function safePronunciationValue(value,fallback){
  const text=String(value||"").trim();
  return text&&!hasBadPronunciationText(text)?text:fallback;
}
function localPronunciationGuide(item,lv){
  const target=speakGuideTarget(item);
  if(item?.type==="sentence"){
    const words=normalizeText(item.en).split(" ").filter(Boolean);
    const content=sentenceContentWords(words);
    const mid=Math.max(2,Math.ceil(words.length/2));
    const chunks=[words.slice(0,mid).join(" "),words.slice(mid).join(" ")].filter(Boolean);
    const hasSoftThe=words.some(x=>x==="the");
    const finalWord=words.at(-1)||"";
    return {
      target,
      zhSound:"先聽英文示範，再跟著分段說完整句。",
      syllables:chunks.join(" / "),
      stress:content.length?`重音放在 ${content.join(" / ")}；${hasSoftThe?"the 輕輕帶過，":""}${finalWord?`${finalWord} 的尾音自然收起。`:"整句不要每個字都一樣重。"}`:"功能字輕輕帶過，主要意思字說清楚。",
      mouth:`先聽整句節奏，再分成 ${chunks.join(" / ")} 跟讀；最後把整句自然接起來。`,
      mistake:"不要只盯著單一單字；句子練習要把停頓、重音和連音一起說出來。",
      steps:["先聽整句一次","分成短語慢慢跟讀","最後用正常速度說完整句"],
      words:[],
      source:"local",
      level:lv,
    };
  }
  const base=PRONUNCIATION_HINTS[target]||{
    zhSound:"先聽英文示範，再跟著音節慢慢念。",
    syllables:String(target||item?.en||"").replace(/-/g," · "),
    stress:"先聽示範，找最清楚、最用力的那一拍。",
    mouth:"先慢速跟讀，再把聲音連起來；不要用中文諧音記發音。",
    mistake:"不要完全照中文注音念，最後要回到英文示範音。",
    steps:["聽示範一次","照音節慢慢念","最後用正常速度念一次"],
  };
  return {
    target,
    zhSound:"先聽英文示範，再跟著音節慢慢念。",
    syllables:base.syllables||target,
    stress:base.stress||"先聽出最重的一拍。",
    mouth:"看示範音，先慢速模仿嘴型，再回到正常速度。",
    mistake:base.mistake||"不要用中文諧音背發音，最後要跟英文示範音對齊。",
    steps:Array.isArray(base.steps)&&base.steps.length?base.steps:["聽示範一次","慢速分段念","連起來正常念"],
    words:[],
    source:"local",
    level:lv,
  };
}
function normalizePronunciationGuide(raw,item,lv,source="ai"){
  const fallback=localPronunciationGuide(item,lv);
  const words=[];
  const steps=Array.isArray(raw?.steps)?raw.steps.map(x=>String(x||"").trim()).filter(x=>x&&!hasBadPronunciationText(x)).slice(0,4):fallback.steps;
  const syllables=safePronunciationValue(raw?.syllables,fallback.syllables);
  return {
    ...fallback,
    zhSound:safePronunciationValue(raw?.zhSound,fallback.zhSound),
    syllables,
    stress:safePronunciationValue(raw?.stress,fallback.stress),
    mouth:safePronunciationValue(raw?.mouth,fallback.mouth),
    mistake:safePronunciationValue(raw?.mistake,fallback.mistake),
    steps:steps.length?steps:fallback.steps,
    words,
    source,
  };
}
async function generatePronunciationGuide(item,lv,apiKey,coachingContext=null){
  if(!item||!apiKey?.trim())throw new Error("需要 Gemini API Key 才能產生 AI 發音提示。");
  const isSentence=item.type==="sentence";
  const target=speakGuideTarget(item);
  const contextKey=coachingContext?.heard?`:heard-${normalizeText(coachingContext.heard)}:${coachingContext.pct??0}`:"";
  const cacheKey=`speak_pron_${encodeURIComponent(`${lv}:${target}${contextKey}`)}`;
  try{const cached=localStorage.getItem(cacheKey);if(cached)return normalizePronunciationGuide(JSON.parse(cached),item,lv,"ai")}catch{}
  const analysisBlock=coachingContext?.heard?`

這次學生已經錄音，請優先針對這次結果設計補強練習：
這次辨識結果：${coachingContext.heard}
這次分數：${coachingContext.pct}%
漏掉或未通過：${coachingContext.missing?.length?coachingContext.missing.join(", "):"無"}
多辨識到：${coachingContext.extra?.length?coachingContext.extra.join(", "):"無"}

請把 steps 做成可以立刻照做的補強流程，例如「先練漏掉的短語」「再接前後單字」「最後說完整句」。`:"";
  const prompt=isSentence?`你是給台灣小朋友使用的英文發音老師。請針對目前這個完整英文句子的節奏、重音、停頓、連音提供發音提示，不要只講單一單字，也不要產生中文諧音。

程度：${LV[lv]?.name||lv}
完整英文句子：${item.en}
中文意思：${item.zh||""}
${analysisBlock}

請用繁體中文輸出 STRICT JSON：
{"zhSound":"一句話說明練習目標，不要寫中文諧音","syllables":"英文短語分段，用 / 分隔，例如：This is / the end / of the story","stress":"語調提醒，例如：the 輕輕帶過，story 的尾音自然收","mouth":"整句嘴型或連音提示，一句話","mistake":"台灣學生常見句子發音錯誤，一句話","steps":["第一步","第二步","第三步"],"words":[]}

規則：
- 不要輸出中文諧音、注音符號、日文假名或逐字母拼音。
- 只使用英文短語、重音、停頓、連音、嘴型來教發音。
- 主要目標是完整句子的流暢度，不是單字背誦。
- words 請固定回傳空陣列。`:`你是給台灣小朋友使用的英文發音老師。請只針對目前這個英文單字提供發音提示，不要產生中文諧音。

程度：${LV[lv]?.name||lv}
英文：${item.en}
中文意思：${item.zh||""}
重點單字：${target}
${analysisBlock}

請用繁體中文輸出 STRICT JSON：
{"zhSound":"一句話說明練習目標，不要寫中文諧音","syllables":"英文音節，用 · 分隔","stress":"重音在哪一拍","mouth":"嘴型或舌頭提示，一句話","mistake":"台灣學生常見錯誤，一句話","steps":["第一步","第二步","第三步"],"words":[]}

規則：
- 不要輸出中文諧音、注音符號、日文假名或逐字母拼音。
- 文字要短，小學生也看得懂。
- words 請固定回傳空陣列。`;
  const models=["gemini-2.5-flash-lite","gemini-2.5-flash","gemini-2.0-flash"];
  for(const model of models){
    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:900,temperature:0.35,responseMimeType:"application/json"}}),
      });
      const data=await res.json();
      if(!res.ok||data?.error)continue;
      const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("");
      if(!text)continue;
      const normalized=normalizePronunciationGuide(parseGrammarJson(text),item,lv,"ai");
      try{localStorage.setItem(cacheKey,JSON.stringify(normalized))}catch{}
      return normalized;
    }catch{}
  }
  throw new Error("AI 發音提示暫時產生失敗，請稍後再試。");
}

function speakPassThreshold(item){return item?.type==="word"?80:70}
function SpeakM({lv,onBack,onXp,apiKey,onOpenSettings}){
  const c=LV[lv];
  const[speakMode,setSpeakMode]=useLS(`speak_mode_${lv}`,"mixed");
  const[sourceItems,setSourceItems]=useState([]);
  const[items,setItems]=useState([]);const[loading,setLoading]=useState(true);
  const[si,setSi]=useState(0);const[phase,setPhase]=useState("ready");
  const[listening,setListening]=useState(false);const[spoken,setSpoken]=useState("");const[interim,setInterim]=useState("");
  const[comparison,setComparison]=useState(null);const[records,setRecords]=useState({});
  const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);
  const[showConfetti,setShowConfetti]=useState(false);const[showSuccess,setShowSuccess]=useState(false);
  const[noSupport,setNoSupport]=useState(false);const[tip,setTip]=useState("");
  const[pronGuide,setPronGuide]=useState(null);const[pronBusy,setPronBusy]=useState(false);const[pronErr,setPronErr]=useState("");
  const recogRef=useRef(null);const finalRef=useRef("");const interimRef=useRef("");const rewardedRef=useRef(new Set());

  const resetRound=useCallback((nextItems)=>{
    setItems(nextItems);setSi(0);setPhase("ready");setSpoken("");setInterim("");setComparison(null);setRecords({});setCombo(0);setMaxCombo(0);setTip("");rewardedRef.current=new Set();
  },[]);
  const loadItems=useCallback(async(mode=speakMode)=>{
    setLoading(true);stopSpeech();
    try{recogRef.current?.abort?.()}catch{}
    const r=await fetchSpeakItems(lv,12);
    setSourceItems(r);
    resetRound(selectSpeakItemsByMode(r,mode));
    setLoading(false);
  },[lv,resetRound,speakMode]);
  useEffect(()=>{loadItems(speakMode)},[lv]);

  const cur=items[si];const currentRecord=records[si];const score=Object.values(records).filter(r=>r.passed).length;const attemptsTotal=Object.values(records).reduce((n,r)=>n+(r.attempts||0),0);
  const localGuide=useMemo(()=>localPronunciationGuide(cur,lv),[cur?.en,cur?.zh,cur?.keyword,cur?.type,lv]);
  const guide=pronGuide||localGuide;
  useEffect(()=>{setPronGuide(null);setPronErr("");setPronBusy(false)},[cur?.en,cur?.keyword,lv]);

  useEffect(()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setNoSupport(true);return}
    const r=new SR();r.lang="en-US";r.interimResults=true;r.maxAlternatives=3;r.continuous=false;
    r.onresult=e=>{
      let final="",live="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        let best="",bestConf=-1;
        for(let j=0;j<e.results[i].length;j++){const alt=e.results[i][j];if((alt.confidence??0)>bestConf){bestConf=alt.confidence??0;best=alt.transcript}}
        if(e.results[i].isFinal)final+=` ${best}`;else live+=` ${best}`;
      }
      if(final.trim())finalRef.current=`${finalRef.current} ${final}`.trim();
      interimRef.current=live.trim();setInterim(interimRef.current||finalRef.current);
    };
    r.onerror=e=>{setListening(false);setPhase("ready");setSpoken(e.error==="not-allowed"?"[請允許麥克風權限後再試一次]":"[沒有聽到聲音，再試一次]")};
    r.onend=()=>{
      setListening(false);
      const heard=(finalRef.current||interimRef.current).trim();
      finalRef.current="";interimRef.current="";
      if(heard){setSpoken(heard);setInterim("")}
    };
    recogRef.current=r;
    return()=>{try{r.abort()}catch{}};
  },[]);

  useEffect(()=>{if(phase==="ready"&&cur&&!loading){const t=speechTimer(()=>speak(cur.en,"en-US",0.85),400);return()=>clearTimeout(t)}},[si,phase,loading,cur?.en]);

  useEffect(()=>{
    if(!spoken||spoken.startsWith("[")||!cur)return;
    const comp=compareWords(cur.en,spoken);const threshold=speakPassThreshold(cur);const passed=comp.pct>=threshold;
    setComparison(comp);setPhase("result");setTip("");
    setRecords(prev=>{
      const old=prev[si]||{attempts:0,bestPct:0,passed:false};
      return{...prev,[si]:{...old,attempts:(old.attempts||0)+1,bestPct:Math.max(old.bestPct||0,comp.pct),passed:old.passed||passed,lastPct:comp.pct,lastSpoken:spoken,comparison:comp,item:cur}};
    });
    if(passed){
      setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));return nc});
      setShowSuccess(true);speechTimer(()=>setShowSuccess(false),1200);
      if(!rewardedRef.current.has(si)){rewardedRef.current.add(si);onXp?.(comp.pct>=90?15:10)}
      playSound(comp.pct>=90?"combo":"good");
    }else{
      setCombo(0);playSound("bad");
      const miss=comp.result.filter(x=>!x.ok).map(x=>x.word).slice(0,3).join(", ");
      setTip(miss?`先練這些字：${miss}`:"再聽一次示範，注意重音和節奏。");
    }
  },[spoken,cur,si,onXp]);

  const startListening=()=>{
    if(!recogRef.current||listening)return;
    stopSpeech();setSpoken("");setInterim("");setComparison(null);setTip("");setPhase("listen");setListening(true);finalRef.current="";interimRef.current="";
    try{recogRef.current.abort?.()}catch{}
    speechTimer(()=>{try{recogRef.current.start()}catch{}},80);
  };
  const stopListening=()=>{if(recogRef.current&&listening){try{recogRef.current.stop()}catch{}}};
  const demo=()=>cur&&speak(cur.en,"en-US",0.85);
  const buildPronunciationContext=()=>{
    const comp=comparison||currentRecord?.comparison;
    const heard=(spoken&&!spoken.startsWith("[")?spoken:currentRecord?.lastSpoken||"").trim();
    if(!comp||!heard)return null;
    return {
      heard,
      pct:comp.pct,
      missing:(comp.result||[]).filter(x=>!x.ok).map(x=>x.word).slice(0,6),
      extra:(comp.extra||[]).slice(0,6),
    };
  };
  const pronunciationContext=buildPronunciationContext();
  const aiPronLabel="AI 分析這次發音";
  const loadAiPronunciation=async()=>{
    setPronErr("");
    if(!apiKey?.trim()){setPronErr("設定 Gemini Key 後，可以依目前題目或這次錄音產生補強練習。");onOpenSettings?.();return}
    setPronBusy(true);
    try{setPronGuide(await generatePronunciationGuide(cur,lv,apiKey,pronunciationContext))}
    catch(e){setPronErr(e?.message||"AI 發音提示暫時產生失敗。")}
    finally{setPronBusy(false)}
  };
  const retryAndListen=()=>{retry();speechTimer(startListening,120)};
  const nextItem=()=>{
    if(si+1>=items.length){playSound("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500);setPhase("done");return}
    setSi(s=>s+1);setPhase("ready");setSpoken("");setInterim("");setComparison(null);setTip("");
  };
  const retry=()=>{setPhase("ready");setSpoken("");setInterim("");setComparison(null);setTip("")};
  const restart=()=>loadItems();
  const changeSpeakMode=mode=>{
    setSpeakMode(mode);
    const source=sourceItems.length?sourceItems:SPEAK_FALLBACK[lv]||items;
    resetRound(selectSpeakItemsByMode(source,mode));
  };
  const retryWeak=()=>{
    const weak=items.map((item,i)=>({item,i,record:records[i]})).filter(x=>!x.record?.passed);
    if(!weak.length)return;
    setItems(weak.map(x=>x.item));setSi(0);setPhase("ready");setSpoken("");setInterim("");setComparison(null);setRecords({});setCombo(0);setTip("");rewardedRef.current=new Set();
  };

  const comboLabel=combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";
  if(noSupport)return(<div><Hdr t="🗣️ 口說練習" onBack={onBack} cl={c.cl}/><div style={{...S.card,padding:"24px 16px",textAlign:"center"}}><div style={{fontSize:40,marginBottom:10}}>😔</div><div style={{fontSize:14,color:S.t1,fontWeight:600}}>瀏覽器不支援語音辨識</div><div style={{fontSize:12,color:S.t2,marginTop:6}}>請使用 Chrome 或 Edge 瀏覽器</div></div></div>);
  if(loading||!cur)return(<div><Hdr t="🗣️ 口說練習" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入中...</div></div>);

  if(phase==="done"){const total=items.length;const finalPct=Math.round(score/Math.max(total,1)*100);const weak=items.map((item,i)=>({item,i,record:records[i]})).filter(x=>!x.record?.passed);return(<div>{showConfetti&&<Confetti/>}<Hdr t="🗣️ 口說練習" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"28px 12px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{finalPct>=80?"🏆":finalPct>=50?"🎉":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>口說練習完成！</h2><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxWidth:420,margin:"16px auto"}}>{[["通過",`${score}/${total}`,c.cl],["掌握率",`${finalPct}%`,finalPct>=80?"#1D9E75":"#EF9F27"],["嘗試",attemptsTotal,"#185FA5"]].map(([l,v,cl])=><div key={l} style={{...S.card,padding:"12px 8px",borderTop:`3px solid ${cl}`}}><div style={{fontSize:22,fontWeight:800,color:cl}}>{v}</div><div style={{fontSize:11,color:S.t3,marginTop:2}}>{l}</div></div>)}</div>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{fontSize:14,color:S.t2,margin:"8px 0 14px"}}>{finalPct>=80?"口說節奏很好，可以挑戰更長句子。":"建議聽示範後，把未通過項目逐字跟讀。"}</div>{weak.length>0&&<div style={{...S.card,padding:"12px 14px",maxWidth:540,margin:"0 auto 14px",textAlign:"left"}}><div style={{fontSize:13,fontWeight:800,color:"#E24B4A",marginBottom:8}}>需要再練</div><div style={{display:"grid",gap:7}}>{weak.map(({item,i,record})=><button key={`${item.en}-${i}`} onClick={()=>speak(item.en,"en-US",0.85)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:12,padding:"9px 11px",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}><div style={{fontSize:14,fontWeight:800,color:S.t1}}>{item.en}</div><div style={{fontSize:12,color:S.t2,marginTop:2}}>{item.zh} · 最高 {record?.bestPct||0}%</div></button>)}</div></div>}<button onClick={weak.length?retryWeak:restart} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>{weak.length?"只練未通過":"換一批"}</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}

  const pct=Math.round((si/items.length)*100);const threshold=speakPassThreshold(cur);const best=currentRecord?.bestPct||0;const attempts=currentRecord?.attempts||0;const isSentence=cur.type==="sentence";
  return(<div><Hdr t="🗣️ 口說練習" onBack={onBack} cl={c.cl}/>
    <section style={{...S.card,padding:"12px 14px",marginBottom:10,background:`linear-gradient(135deg,${c.bg},${S.bg1})`,border:`1px solid ${c.cl}33`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:9}}>
        <div><div style={{fontSize:13,fontWeight:1000,color:S.t1}}>練習模式</div><div style={{fontSize:12,color:S.t2,marginTop:2}}>先聽一次，再按麥克風跟讀。</div></div>
        <button onClick={()=>loadItems(speakMode)} style={{...S.btn,background:S.bg2,color:c.cl,padding:"8px 11px",fontSize:12}}>換一批</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(118px,1fr))",gap:7}}>
        {SPEAK_MODE_OPTIONS.map(opt=>{
          const active=speakMode===opt.id;
          return <button key={opt.id} aria-label={opt.label} onClick={()=>changeSpeakMode(opt.id)} style={{border:`1px solid ${active?c.cl:S.bd}`,background:active?c.bg:S.bg1,color:active?c.cl:S.t1,borderRadius:12,padding:"9px 10px",textAlign:"left",fontFamily:"inherit",cursor:"pointer",boxShadow:active?`0 8px 18px ${c.cl}14`:"none"}}>
            <div style={{fontSize:13,fontWeight:1000,lineHeight:1.2}}>{opt.label}</div>
            <div style={{fontSize:11,color:active?c.cl:S.t3,lineHeight:1.4,marginTop:3}}>{opt.desc}</div>
          </button>;
        })}
      </div>
    </section>
    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8,fontSize:12}}><div style={{flex:1,height:7,background:S.bg2,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:999,transition:"width .3s"}}/></div><span style={{color:S.t3,minWidth:44,textAlign:"right"}}>{si+1}/{items.length}</span><span style={{color:"#1D9E75",fontWeight:800,minWidth:32,textAlign:"right"}}>{score}✓</span></div>
    {comboLabel&&<div style={{textAlign:"center",fontSize:14,fontWeight:700,color:"#EF9F27",marginBottom:6,animation:"comboFlash .5s"}}>{comboLabel}</div>}
    {showSuccess&&<div style={{background:"linear-gradient(90deg,#2ECC71,#27AE60)",borderRadius:12,padding:"10px 16px",marginBottom:8,textAlign:"center",animation:"bounceIn .3s ease-out"}}><span style={{color:"#fff",fontWeight:700,fontSize:16}}>通過了！🎉</span></div>}

    <div style={{...S.card,padding:0,overflow:"hidden",marginBottom:12,borderTop:`4px solid ${c.cl}`}}>
      <div style={{background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`,padding:"18px 16px",textAlign:"center",borderBottom:`1px solid ${S.bd}`}}>
        <div style={{display:"flex",justifyContent:"center",gap:7,flexWrap:"wrap",marginBottom:8}}><span style={{fontSize:12,fontWeight:800,color:c.cl,background:"#fff",border:`1px solid ${c.cl}33`,borderRadius:999,padding:"5px 9px"}}>{isSentence?"句子":"單字"}</span><span style={{fontSize:12,fontWeight:800,color:best>=threshold?"#1D9E75":S.t3,background:best>=threshold?"#E1F5EE":S.bg2,borderRadius:999,padding:"5px 9px"}}>本題最高 {best}%</span><span style={{fontSize:12,fontWeight:800,color:S.t3,background:S.bg2,borderRadius:999,padding:"5px 9px"}}>已試 {attempts} 次</span><span style={{fontSize:12,fontWeight:800,color:S.t3,background:S.bg2,borderRadius:999,padding:"5px 9px"}}>通過 {threshold}%</span></div>
        <div style={{fontSize:15,color:S.t3,marginBottom:4}}>{isSentence?"看中文，唸出完整英文句子":"看中文，唸出英文單字"}</div>
        <div style={{fontSize:isSentence?23:32,fontWeight:800,color:S.t1,lineHeight:1.45}}>{cur.zh}</div>{cur.pos&&<div style={{fontSize:11,color:S.t3,marginTop:3}}>({cur.pos})</div>}
      </div>
      <div style={{padding:"20px 17px",textAlign:"center"}}>
        <div style={{fontSize:isSentence?25:42,fontWeight:800,color:c.cl,lineHeight:1.55,letterSpacing:0}}>{cur.en}</div>
        {cur.keyword&&!isSentence&&<div style={{fontSize:11,color:S.t3,marginTop:5}}>重點單字：<b style={{color:c.cl}}>{cur.keyword}</b></div>}
        {isSentence&&<div style={{display:"flex",gap:5,justifyContent:"center",flexWrap:"wrap",marginTop:10}}>{normalizeText(cur.en).split(" ").map(w=><span key={w} style={{fontSize:12,color:S.t2,background:S.bg2,borderRadius:999,padding:"4px 8px"}}>{w}</span>)}</div>}
        {guide?.target&&<div style={{margin:"16px auto 0",maxWidth:560,textAlign:"left",border:`1px solid ${c.cl}33`,background:`linear-gradient(135deg,${c.bg},${S.bg1})`,borderRadius:16,padding:"13px 14px",boxShadow:`0 10px 24px ${c.cl}10`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:10}}>
            <div>
              <div style={{fontSize:14,fontWeight:1000,color:S.t1}}>發音小老師</div>
              <div style={{fontSize:11,color:S.t3,marginTop:2}}>先聽英文示範，再用分段、重音和口型練習。</div>
            </div>
            {pronunciationContext&&<button onClick={loadAiPronunciation} disabled={pronBusy} aria-label={aiPronLabel} style={{...S.btn,background:guide.source==="ai"?c.cl:S.bg1,color:guide.source==="ai"?"#fff":c.cl,border:`1px solid ${c.cl}44`,padding:"7px 10px",fontSize:12,opacity:pronBusy?0.65:1}}>{pronBusy?"AI 整理中":aiPronLabel}</button>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(128px,1fr))",gap:8,marginBottom:10}}>
            {(isSentence?[["分段跟讀",guide.syllables],["語調提醒",guide.stress]]:[["音節",guide.syllables],["重音",guide.stress]]).map(([label,value])=><div key={label} style={{background:S.bg1,border:`1px solid ${S.bd}`,borderRadius:12,padding:"8px 10px"}}>
              <div style={{fontSize:11,color:S.t3,fontWeight:800,marginBottom:3}}>{label}</div>
              <div style={{fontSize:14,color:S.t1,fontWeight:1000,lineHeight:1.35}}>{value}</div>
            </div>)}
          </div>
          <div style={{display:"grid",gap:7,fontSize:12,lineHeight:1.6,color:S.t2}}>
            <div><b style={{color:S.t1}}>嘴型：</b>{guide.mouth}</div>
            <div><b style={{color:S.t1}}>常見卡點：</b>{guide.mistake}</div>
          </div>
          {guide.steps?.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>{guide.steps.map((step,i)=><button key={`${step}-${i}`} onClick={()=>speak(step,"zh-TW",0.95)} style={{border:`1px solid ${c.cl}22`,background:S.bg1,color:S.t2,borderRadius:999,padding:"5px 8px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}><span>{i+1}. </span><span>{step}</span></button>)}</div>}
          {pronErr&&<div style={{marginTop:9,fontSize:12,color:"#8A5A00",background:"#FFF7E6",border:"1px solid #F0D59A",borderRadius:10,padding:"7px 9px"}}>{pronErr}</div>}
        </div>}
      </div>
      <div style={{padding:"0 16px 16px",display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}><button onClick={demo} style={{...S.btn,background:c.bg,color:c.cl,padding:"9px 14px",fontSize:13}}>🔊 聽示範</button><button onClick={startListening} disabled={listening} style={{...S.btn,background:c.cl,color:"#fff",padding:"9px 14px",fontSize:13,opacity:listening?0.55:1}}>🎤 直接開說</button><button onClick={()=>window.open(`https://youglish.com/pronounce/${encodeURIComponent(cur.en)}/english`,"_blank")} style={{...S.btn,background:`${c.cl}22`,color:c.cl,padding:"9px 14px",fontSize:13,border:`1px solid ${c.cl}44`}}>🎬 真人發音</button></div>
    </div>

    {phase!=="result"&&<div style={{textAlign:"center",marginBottom:12}}>
      {!listening?(
        <button onClick={startListening} style={{width:92,height:92,borderRadius:"50%",border:"none",background:`linear-gradient(135deg,${c.cl},${c.ac})`,color:"#fff",fontSize:38,cursor:"pointer",boxShadow:`0 7px 24px ${c.cl}50`,transition:"transform .15s",WebkitTapHighlightColor:"transparent"}} onTouchStart={e=>{e.currentTarget.style.transform="scale(0.88)"}} onTouchEnd={e=>{e.currentTarget.style.transform="scale(1)"}}>🎤</button>
      ):(
        <button onClick={stopListening} style={{width:92,height:92,borderRadius:"50%",border:"none",background:"#E24B4A",color:"#fff",fontSize:36,cursor:"pointer",animation:"micPulse 1.2s ease-in-out infinite"}}>⏹</button>
      )}
      <div style={{fontSize:13,color:listening?"#E24B4A":S.t3,marginTop:8,fontWeight:listening?800:500}}>{listening?"正在聽，說完可按停止":"按下麥克風開始說"}</div>
      {(interim||spoken.startsWith("["))&&<div style={{...S.card,padding:"10px 12px",marginTop:10,fontSize:12,color:spoken.startsWith("[")?"#EF9F27":S.t2,textAlign:"center"}}>{spoken.startsWith("[")?spoken:`聽到：${interim}`}</div>}
    </div>}

    {phase==="result"&&comparison&&<div style={{...S.card,padding:"16px",marginBottom:12}}>
      <div style={{textAlign:"center",marginBottom:10}}><div style={{fontSize:42}}>{comparison.pct>=90?"🌟":comparison.pct>=threshold?"👍":comparison.pct>=40?"🤔":"😅"}</div><div style={{fontSize:15,fontWeight:800,color:comparison.pct>=threshold?"#1D9E75":"#E24B4A",marginTop:4}}>{comparison.pct>=threshold?"通過":"再練一次"}</div><div style={{margin:"9px auto",maxWidth:210}}><div style={{height:9,background:S.bg2,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${comparison.pct}%`,background:comparison.pct>=threshold?"linear-gradient(90deg,#1D9E75,#5DCAA5)":"linear-gradient(90deg,#E24B4A,#EF9F27)",borderRadius:999,transition:"width .5s"}}/></div><div style={{fontSize:11,color:S.t2,marginTop:4}}>準確度 {comparison.pct}% · 門檻 {threshold}%</div></div></div>
      <div style={{fontSize:17,lineHeight:2.25,textAlign:"center",margin:"8px 0"}}>{comparison.result.map((r,i)=><span key={i} title={r.heard?`聽到：${r.heard}`:"未聽到"} style={{display:"inline-block",padding:"3px 7px",borderRadius:8,margin:"2px",fontWeight:800,background:r.ok?"#E1F5EE":"#FCEBEB",color:r.ok?"#1D9E75":"#E24B4A"}}>{r.word}</span>)}</div>
      {comparison.result.some(r=>!r.ok)&&<div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap",margin:"2px 0 10px"}}>{comparison.result.filter(r=>!r.ok).map(r=><button key={r.word} onClick={()=>speak(r.word,"en-US",0.85)} style={{border:"1px solid #F0D59A",background:"#FFF7E6",color:"#8A5A00",borderRadius:999,padding:"6px 10px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>練 {r.word} 🔊</button>)}</div>}
      {tip&&<div style={{fontSize:12,color:"#8A5A00",background:"#FFF7E6",border:"1px solid #F0D59A",borderRadius:10,padding:"8px 10px",marginBottom:8,textAlign:"center"}}>{tip}</div>}
      <div style={{fontSize:12,color:S.t2,textAlign:"center",padding:"8px 10px",background:S.bg2,borderRadius:10}}>你說的是：{spoken}{comparison.extra?.length?` · 多聽到：${comparison.extra.join(", ")}`:""}</div>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12,flexWrap:"wrap"}}><button onClick={demo} style={{...S.btn,background:S.bg2,color:S.t1,padding:"10px 14px",fontSize:12,minHeight:42}}>聽示範</button><button onClick={retryAndListen} style={{...S.btn,background:"#FAEEDA",color:"#8A5A00",padding:"10px 14px",fontSize:12,minHeight:42}}>重說一次</button><button onClick={nextItem} style={{...S.btn,background:c.cl,color:"#fff",padding:"10px 14px",fontSize:12,minHeight:42}}>{si+1>=items.length?"完成":"下一個"}</button></div>
    </div>}
  </div>);
}
// ═══ WHACK-A-MOLE SPELLING (打地鼠拼字 v2) ══════════════════════════
function pickWhackWords(list,count,lv){
  const maxLen=lv==="elementary"?8:lv==="junior"?10:12;
  const clean=w=>String(w?.w||"").trim().toLowerCase();
  const source=shuffleCopy(list||[]).filter(w=>/^[a-z]+$/.test(clean(w))&&w?.m);
  const primary=source.filter(w=>{const len=clean(w).length;return len>=2&&len<=maxLen});
  const out=[],seen=new Set();
  [...primary,...source].forEach(w=>{
    if(out.length>=count)return;
    const word=clean(w);
    if(seen.has(word))return;
    seen.add(word);out.push({...w,w:word});
  });
  return out.slice(0,count);
}
function buildWhackHoles(word,lv){
  const letters=String(word||"").toLowerCase().replace(/[^a-z]/g,"").split("");
  const alphabet="abcdefghijklmnopqrstuvwxyz".split("");
  const extraCount=Math.max(4,Math.min(lv==="elementary"?6:8,12-letters.length));
  const distractors=shuffleCopy(alphabet.filter(l=>!letters.includes(l))).slice(0,extraCount);
  const moles=["🐹","🐿️","🦔","🐰","🦊"];
  return shuffleCopy([...letters,...distractors]).map((l,i)=>({id:`${i}-${l}-${Math.random().toString(36).slice(2)}`,letter:l,visible:true,mole:moles[i%moles.length]}));
}
function whackRoundTime(word,lv){
  const len=String(word||"").length;
  const base=lv==="elementary"?10:lv==="junior"?9:8;
  const per=lv==="elementary"?2.2:lv==="junior"?1.9:1.7;
  const cap=lv==="elementary"?28:lv==="junior"?25:23;
  return Math.min(cap,Math.max(base,Math.ceil(base+len*per)));
}
const PET_MONOPOLY_TILES=[
  {id:"start",type:"start",name:"起點",icon:"🏁",hint:"經過可領取補給"},
  {id:"word-market",type:"word",name:"單字市集",icon:"🔤",hint:"看中文選英文"},
  {id:"grammar-gate",type:"grammar",name:"文法城門",icon:"¶",hint:"補上正確句型"},
  {id:"coin-park",type:"event",name:"金幣公園",icon:"🪙",hint:"答對拿小獎"},
  {id:"pet-school",type:"training",name:"寵物學院",icon:"🎓",hint:"寵物 EXP 加成"},
  {id:"word-harbor",type:"word",name:"單字港口",icon:"⚓",hint:"核心字彙挑戰"},
  {id:"north-station",type:"word",name:"台北車站",icon:"🚄",hint:"快速翻譯挑戰"},
  {id:"shop",type:"shop",name:"補給商店",icon:"🛒",hint:"答對換補給金"},
  {id:"grammar-plaza",type:"grammar",name:"文法廣場",icon:"▦",hint:"句型四選一"},
  {id:"chance",type:"event",name:"命運卡",icon:"✦",hint:"隨機學習事件"},
  {id:"east-coast",type:"training",name:"花東海岸",icon:"🌊",hint:"寵物默契訓練"},
  {id:"word-station",type:"word",name:"單字車站",icon:"🚉",hint:"快速翻譯"},
  {id:"training-yard",type:"training",name:"訓練庭院",icon:"🏋️",hint:"寵物羈絆提升"},
  {id:"forest-class",type:"grammar",name:"阿里山課堂",icon:"🌲",hint:"文法判斷"},
  {id:"grammar-tower",type:"grammar",name:"文法塔",icon:"🏰",hint:"高分文法題"},
  {id:"treasure",type:"event",name:"寶箱格",icon:"🎁",hint:"答對開寶箱"},
  {id:"south-market",type:"shop",name:"台南補給站",icon:"🥤",hint:"補給與金幣"},
  {id:"word-library",type:"word",name:"單字圖書館",icon:"📚",hint:"例句單字"},
  {id:"pet-camp",type:"training",name:"寵物營地",icon:"⛺",hint:"休息後更親密"},
  {id:"science-port",type:"word",name:"高雄港口",icon:"🚢",hint:"港口單字挑戰"},
  {id:"grammar-lab",type:"grammar",name:"句型研究所",icon:"🔬",hint:"句型推理"},
  {id:"island-fair",type:"event",name:"島嶼市集",icon:"🎡",hint:"隨機獎勵"},
  {id:"pet-spa",type:"training",name:"溫泉寵物館",icon:"♨️",hint:"寵物恢復"},
  {id:"boss",type:"boss",name:"Boss 城堡",icon:"👑",hint:"高獎勵英文關卡"},
];
const PET_MONOPOLY_GRID=[
  [7,7],[6,7],[5,7],[4,7],[3,7],[2,7],[1,7],
  [1,6],[1,5],[1,4],[1,3],[1,2],
  [1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],
  [7,2],[7,3],[7,4],[7,5],[7,6],
];
const PET_MONOPOLY_COMPUTERS=[
  {id:"cpu1",name:"電腦 1",color:"#2563EB",emoji:"🔵"},
  {id:"cpu2",name:"電腦 2",color:"#D97706",emoji:"🟠"},
  {id:"cpu3",name:"電腦 3",color:"#DB2777",emoji:"🟣"},
];
const PET_MONOPOLY_TYPE_META={
  start:{label:"起點",color:"#0F9F7A",soft:"#E7FFF5"},
  word:{label:"單字",color:"#2563EB",soft:"#EFF6FF"},
  grammar:{label:"文法",color:"#7C3AED",soft:"#F5F3FF"},
  event:{label:"事件",color:"#D97706",soft:"#FFF7ED"},
  shop:{label:"商店",color:"#0891B2",soft:"#ECFEFF"},
  training:{label:"培養",color:"#DB2777",soft:"#FDF2F8"},
  boss:{label:"Boss",color:"#DC2626",soft:"#FEF2F2"},
};
function pickPetMonopolyWord(lv,seed=0){
  const list=(V[lv]||V.elementary||[]).filter(w=>w?.w&&w?.m);
  return list[Math.abs(seed)%Math.max(1,list.length)]||{w:"learn",m:"學習",p:"v.",ex:"I learn English."};
}
function buildPetMonopolyQuestion(lv,tile,seed=0){
  const wordTiles=["word","event","shop","training","start"];
  const grammarList=(G[lv]||G.elementary||[]).filter(g=>g?.q?.s&&Array.isArray(g?.q?.o));
  if((tile?.type==="grammar"||tile?.type==="boss")&&grammarList.length){
    const topic=grammarList[Math.abs(seed)%grammarList.length];
    return{
      kind:"grammar",
      title:`英文挑戰：${topic.t}`,
      prompt:topic.q.s,
      sub:`${topic.d}${topic.pattern?` · ${topic.pattern}`:""}`,
      choices:topic.q.o.map(String),
      answer:topic.q.a,
      explain:topic.q.o[topic.q.a],
    };
  }
  const word=pickPetMonopolyWord(lv,seed);
  const pool=(V[lv]||V.elementary||[]).filter(w=>w?.w&&w?.m&&w.w!==word.w);
  const wrongs=shuffleCopy(pool).slice(0,3).map(w=>w.w);
  const choices=shuffleCopy([word.w,...wrongs]);
  return{
    kind:wordTiles.includes(tile?.type)?"word":"word",
    title:"英文挑戰：單字翻譯",
    prompt:`「${word.m}」的英文是？`,
    sub:word.p?`${word.p}${word.ex?` · ${word.ex}`:""}`:word.ex||"看中文選出正確英文",
    choices,
    answer:choices.indexOf(word.w),
    explain:word.w,
    word,
  };
}
function getPetMonopolyReward(tile,lapBonus=false){
  const table={
    start:{xp:4,coins:6,petExp:4,bond:1,label:"起點補給"},
    word:{xp:8,coins:8,petExp:9,bond:2,label:"單字街獎勵"},
    grammar:{xp:10,coins:9,petExp:10,bond:2,label:"文法地產獎勵"},
    event:{xp:7,coins:14,petExp:7,bond:2,label:"事件卡獎勵"},
    shop:{xp:6,coins:18,petExp:6,bond:1,label:"商店補給"},
    training:{xp:9,coins:7,petExp:18,bond:5,label:"寵物訓練"},
    boss:{xp:18,coins:24,petExp:28,bond:8,label:"Boss 勝利獎勵"},
  };
  const base=table[tile?.type]||table.word;
  return lapBonus?{...base,xp:base.xp+6,coins:base.coins+12,petExp:base.petExp+4,bond:base.bond+1,label:`${base.label} + 繞行一圈`}:base;
}
function rollPetMonopolyDice(){
  try{
    const arr=new Uint32Array(1);
    crypto.getRandomValues(arr);
    return(arr[0]%6)+1;
  }catch{return Math.floor(Math.random()*6)+1}
}
function getPetMonopolyMovePath(from,dice,total){
  return Array.from({length:Math.max(0,Number(dice)||0)},(_,i)=>(from+i+1)%total);
}
function isPetMonopolyOwnable(tile){
  return["word","grammar","shop","training"].includes(tile?.type);
}
function getPetMonopolyTileCost(tile){
  const table={word:24,grammar:32,shop:28,training:30};
  return table[tile?.type]||24;
}
function getPetMonopolyUpgradeCost(property){
  return 18+(Number(property?.level)||1)*12;
}
function getPetMonopolyYield(property){
  const level=Number(property?.level)||1;
  return{coins:5+level*5,xp:level*2,petExp:level*3};
}
function getPetMonopolyAffinityBonus(question,petDef){
  const focus=String(question?.word?.w||"").toLowerCase();
  if(!focus||!(petDef?.words||[]).map(w=>String(w).toLowerCase()).includes(focus))return{coins:0,petExp:0,label:""};
  return{coins:4,petExp:5,label:`${petDef.name} 熟悉 ${focus}，技能加成`};
}
function getPetMonopolyComboBonus(streak){
  if(streak<3)return{coins:0,xp:0,petExp:0,label:""};
  const tier=Math.min(4,Math.floor(streak/3));
  return{coins:tier*3,xp:tier*2,petExp:tier*2,label:`連勝 ${streak} 回合，加碼獎勵`};
}
function getPetMonopolyTileTwist(tile,seed=0){
  if(tile?.type==="event"){
    const deck=[
      {coins:12,xp:2,petExp:0,bond:0,label:"命運卡：金幣雨 +12 金幣"},
      {coins:4,xp:7,petExp:4,bond:1,label:"命運卡：捷徑筆記 +7 XP"},
      {coins:0,xp:2,petExp:12,bond:3,label:"命運卡：寵物零食 +12 EXP"},
      {coins:18,xp:0,petExp:0,bond:0,label:"命運卡：寶箱爆開 +18 金幣"},
    ];
    return deck[Math.abs(seed)%deck.length];
  }
  if(tile?.type==="boss"){
    return{coins:10,xp:5,petExp:8,bond:2,label:"Boss 戰利品：皇冠寶箱"};
  }
  return null;
}
function growPetFromMonopoly(pet,reward){
  if(!pet)return pet;
  let next={
    ...pet,
    exp:Math.max(0,Number(pet.exp)||0)+(reward.petExp||0),
    bond:Math.min(100,Math.max(0,Number(pet.bond)||0)+(reward.bond||0)),
    energy:Math.max(0,Math.min(100,Number(pet.energy??80)-2)),
    hunger:Math.max(0,Math.min(100,Number(pet.hunger??80)-1)),
    lastUpdate:new Date().toISOString(),
  };
  for(let i=0;i<8;i++){
    const leveled=levelUpPet(next);
    if(leveled===next)break;
    next=leveled;
  }
  return next;
}
function PetMonopolyM({lv,onBack,onXp,c,pets=[],setPets,coins=0,setCoins}){
  const color=c?.cl||"#0F6E56";
  const accent=c?.ac||"#1D9E75";
  const tiles=PET_MONOPOLY_TILES;
  const[petIndex,setPetIndex]=useState(0);
  const[position,setPosition]=useState(0);
  const[dice,setDice]=useState(null);
  const[turn,setTurn]=useState(0);
  const[pending,setPending]=useState(null);
  const[owned,setOwned]=useState({});
  const[offer,setOffer]=useState(null);
  const[lastMove,setLastMove]=useState(null);
  const[feedback,setFeedback]=useState("按下骰子，目的地才會揭曉。");
  const[score,setScore]=useState({correct:0,wrong:0,laps:0,boss:0});
  const[streak,setStreak]=useState(0);
  const[moving,setMoving]=useState(null);
  const[computerCount,setComputerCount]=useState(3);
  const[computerNotice,setComputerNotice]=useState("電腦玩家會在你結束決定後行動。");
  const[computers,setComputers]=useState(()=>PET_MONOPOLY_COMPUTERS.map((cpu,i)=>({...cpu,position:(i+3)%PET_MONOPOLY_TILES.length,coins:90,owned:[],last:"等待開局"})));
  const moveTimersRef=useRef([]);
  const selectedPet=pets?.[petIndex]||null;
  const selectedPetDef=selectedPet?getAdventurePetDef(selectedPet):null;
  useEffect(()=>{
    if(typeof window==="undefined"||/jsdom/i.test(navigator?.userAgent||""))return;
    const resetScroll=()=>{
      try{window.scrollTo({top:0,left:0,behavior:"instant"})}catch{try{window.scrollTo(0,0)}catch{}}
      try{
        [document.scrollingElement,document.documentElement,document.body,...document.querySelectorAll("main,section,div")].forEach(el=>{
          if(el&&el.scrollTop>0)el.scrollTop=0;
          if(el&&el.scrollLeft>0)el.scrollLeft=0;
        });
      }catch{}
    };
    resetScroll();
    const raf=requestAnimationFrame(resetScroll);
    const timer=setTimeout(resetScroll,80);
    return()=>{cancelAnimationFrame(raf);clearTimeout(timer)};
  },[]);
  useEffect(()=>{if(pets.length&&petIndex>=pets.length)setPetIndex(0)},[pets.length,petIndex]);
  useEffect(()=>()=>{moveTimersRef.current.forEach(clearTimeout);moveTimersRef.current=[]},[]);
  const clearMoveTimers=()=>{moveTimersRef.current.forEach(clearTimeout);moveTimersRef.current=[]};
  const currentTile=tiles[position];
  const currentProperty=owned[currentTile.id];
  const currentMeta=PET_MONOPOLY_TYPE_META[currentTile.type]||PET_MONOPOLY_TYPE_META.word;
  const currentYield=currentProperty?getPetMonopolyYield(currentProperty):null;
  const currentUpgradeCost=currentProperty?getPetMonopolyUpgradeCost(currentProperty):0;
  const offerTile=offer?tiles.find(t=>t.id===offer.tileId):null;
  const propertyCount=Object.keys(owned).length;
  const activeComputers=computers.slice(0,computerCount);
  const playComputerRound=()=>{
    setComputers(prev=>prev.map((cpu,i)=>{
      if(i>=computerCount)return cpu;
      const rolled=rollPetMonopolyDice();
      const nextPos=(cpu.position+rolled)%tiles.length;
      const tile=tiles[nextPos];
      const already=cpu.owned.includes(tile.id);
      const canBuy=isPetMonopolyOwnable(tile)&&!already&&cpu.coins>=getPetMonopolyTileCost(tile);
      const cost=canBuy?getPetMonopolyTileCost(tile):0;
      return{
        ...cpu,
        position:nextPos,
        coins:Math.max(0,cpu.coins+(tile.type==="event"?6:3)-cost),
        owned:canBuy?[...cpu.owned,tile.id]:cpu.owned,
        last:`骰 ${rolled} 到 ${tile.name}${canBuy?"，收購成功":""}`,
      };
    }));
    setComputerNotice(`${computerCount} 位電腦玩家完成一輪行動。`);
  };
  const roll=()=>{
    if(pending||offer||moving)return;
    const rolled=rollPetMonopolyDice();
    const nextPos=(position+rolled)%tiles.length;
    const tile=tiles[nextPos];
    const question=buildPetMonopolyQuestion(lv,tile,turn+position+nextPos+rolled);
    const lapBonus=nextPos<=position&&position!==0;
    const path=getPetMonopolyMovePath(position,rolled,tiles.length);
    setDice(rolled);
    setLastMove(null);
    setMoving({actor:"player",dice:rolled,to:tile.name,step:0,total:path.length});
    setFeedback(`骰出 ${rolled}，移動中...`);
    clearMoveTimers();
    path.forEach((pos,step)=>{
      const timer=setTimeout(()=>{
        setPosition(pos);
        if(step+1<path.length){
          setMoving({actor:"player",dice:rolled,to:tile.name,step:step+1,total:path.length});
        }else{
          setMoving(null);
          setLastMove({dice:rolled,tile});
          setPending({dice:rolled,nextPos,tile,question,lapBonus});
          setFeedback(`落在「${tile.name}」。完成這格任務後才能結算效果。`);
        }
      },140*(step+1));
      moveTimersRef.current.push(timer);
    });
  };
  const answer=idx=>{
    if(!pending)return;
    const correct=idx===pending.question.answer;
    if(correct){
      const baseReward=getPetMonopolyReward(pending.tile,pending.lapBonus);
      const property=owned[pending.tile.id];
      const propertyYield=property?getPetMonopolyYield(property):{coins:0,xp:0,petExp:0};
      const affinity=getPetMonopolyAffinityBonus(pending.question,selectedPetDef);
      const nextStreak=streak+1;
      const combo=getPetMonopolyComboBonus(nextStreak);
      const twist=getPetMonopolyTileTwist(pending.tile,turn+pending.dice+pending.nextPos);
      const reward={
        ...baseReward,
        coins:baseReward.coins+propertyYield.coins+affinity.coins+combo.coins+(twist?.coins||0),
        xp:baseReward.xp+propertyYield.xp+combo.xp+(twist?.xp||0),
        petExp:baseReward.petExp+propertyYield.petExp+affinity.petExp+combo.petExp+(twist?.petExp||0),
        bond:baseReward.bond+(twist?.bond||0),
      };
      const totalXp=reward.xp;
      const totalCoins=reward.coins;
      setScore(s=>({correct:s.correct+1,wrong:s.wrong,laps:s.laps+(pending.lapBonus?1:0),boss:s.boss+(pending.tile.type==="boss"?1:0)}));
      setStreak(nextStreak);
      onXp?.(totalXp);
      setCoins?.(v=>Math.max(0,(Number(v)||0)+totalCoins));
      if(selectedPet&&setPets){
        setPets(prev=>(prev||[]).map((pet,i)=>i===petIndex?growPetFromMonopoly(pet,reward):pet));
      }
      const petText=selectedPet?`寵物獲得 ${reward.petExp} EXP、羈絆 +${reward.bond}`:"取得寵物後可累積寵物 EXP";
      const propertyText=property?`，地產收益 +${propertyYield.coins} 金幣`:"";
      const affinityText=affinity.label?`，${affinity.label}`:"";
      const comboText=combo.label?`，${combo.label}`:"";
      const twistText=twist?`，${twist.label}`:"";
      const buyText=!property&&isPetMonopolyOwnable(pending.tile)?` 可用 ${getPetMonopolyTileCost(pending.tile)} 金幣收購這格。`:"";
      const bossText=pending.tile.type==="boss"?" 已擊敗 Boss，達成勝利條件。":"";
      const msg=`答對！${reward.label}：+${totalXp} XP、+${totalCoins} 金幣${propertyText}${affinityText}${comboText}${twistText}，${petText}。${bossText}${buyText}`;
      setFeedback(msg);
      if(property){
        setOwned(prev=>({...prev,[pending.tile.id]:{...prev[pending.tile.id],visits:(Number(prev[pending.tile.id]?.visits)||0)+1}}));
      }
      if(!property&&isPetMonopolyOwnable(pending.tile)){
        setOffer({tileId:pending.tile.id,cost:getPetMonopolyTileCost(pending.tile)});
      }else{
        playComputerRound();
      }
    }else{
      const penalty=Math.min(Math.max(2,pending.dice),Math.max(0,Number(coins)||0));
      if(penalty)setCoins?.(v=>Math.max(0,(Number(v)||0)-penalty));
      setScore(s=>({correct:s.correct,wrong:s.wrong+1,laps:s.laps,boss:s.boss}));
      setStreak(0);
      const msg=`任務失敗，正確答案是 ${pending.question.explain}。支付 ${penalty} 金幣當作停留費。`;
      setFeedback(msg);
      playComputerRound();
    }
    setTurn(t=>t+1);
    setPending(null);
  };
  const buyProperty=()=>{
    if(!offer)return;
    const tile=tiles.find(t=>t.id===offer.tileId);
    if(!tile)return setOffer(null);
    if((Number(coins)||0)<offer.cost){
      setFeedback(`金幣不足，還差 ${offer.cost-(Number(coins)||0)} 金幣才能收購「${tile.name}」。`);
      return;
    }
    setCoins?.(v=>Math.max(0,(Number(v)||0)-offer.cost));
    setOwned(prev=>({...prev,[tile.id]:{level:1,visits:1}}));
    const msg=`已收購「${tile.name}」。之後再落到這格會產生地產收益，下一次再停到這格才能升級。`;
    setFeedback(msg);
    setOffer(null);
    playComputerRound();
  };
  const skipOffer=()=>{
    if(offer)setFeedback("已略過本次收購，輪到電腦玩家行動。");
    setOffer(null);
    playComputerRound();
  };
  const upgradeCurrentProperty=()=>{
    const property=owned[currentTile.id];
    if(!property||property.level>=3)return;
    const cost=getPetMonopolyUpgradeCost(property);
    if((Number(coins)||0)<cost){
      setFeedback(`升級金幣不足，還差 ${cost-(Number(coins)||0)} 金幣。`);
      return;
    }
    setCoins?.(v=>Math.max(0,(Number(v)||0)-cost));
    setOwned(prev=>({...prev,[currentTile.id]:{...property,level:property.level+1}}));
    const msg=`「${currentTile.name}」升到 Lv.${property.level+1}，未來收益提高。`;
    setFeedback(msg);
    playComputerRound();
  };
  const accuracy=Math.round((score.correct/Math.max(1,score.correct+score.wrong))*100);
  const goalDone=propertyCount>=4||score.boss>0;
  const goalText=score.boss>0?"Boss 已擊敗，這局完成。":propertyCount>=4?"資產目標達成，這局完成。":`勝利條件：再收購 ${Math.max(0,4-propertyCount)} 格地產，或挑戰 Boss 城堡。`;
  const canUpgradeCurrent=!!currentProperty&&currentProperty.visits>=2&&currentProperty.level<3;
  return(<div className="pet-monopoly" style={{"--pm-accent":color,"--pm-accent-2":accent,"--pm-border":S.bd,"--pm-card":S.bg1,"--pm-surface":S.bg2,"--pm-text":S.t1,"--pm-muted":S.t2}}>
    <Hdr t="🎲 寵物大富翁" onBack={onBack} cl={color}/>
    <style>{`
      .pet-monopoly{display:grid;gap:12px;color:var(--pm-text)}
      .pet-monopoly button{font-family:inherit}
      .pm-hero{order:3;border:1px solid color-mix(in srgb,var(--pm-accent) 30%,var(--pm-border));border-radius:20px;background:radial-gradient(circle at 18% 12%,color-mix(in srgb,var(--pm-accent) 22%,transparent),transparent 30%),radial-gradient(circle at 92% 20%,rgba(250,204,21,.24),transparent 26%),linear-gradient(135deg,#F8FFF8,var(--pm-card));padding:14px 16px;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:12px;box-shadow:0 18px 38px rgba(15,110,86,.08)}
      .pm-kicker{display:inline-flex;align-items:center;gap:7px;color:var(--pm-accent);background:color-mix(in srgb,var(--pm-accent) 10%,#fff);border:1px solid color-mix(in srgb,var(--pm-accent) 24%,transparent);border-radius:999px;padding:6px 10px;font-size:12px;font-weight:1000}
      .pm-title{font-size:clamp(26px,4.4vw,42px);line-height:1.02;font-weight:1000;margin:8px 0 6px;letter-spacing:0}
      .pm-desc{font-size:13px;color:var(--pm-muted);line-height:1.7;max-width:680px}
      .pm-goal{display:inline-flex;align-items:center;gap:6px;margin-top:10px;border:1px solid color-mix(in srgb,var(--pm-accent) 25%,var(--pm-border));border-radius:999px;background:color-mix(in srgb,var(--pm-accent) 9%,#fff);color:var(--pm-accent);padding:7px 10px;font-size:12px;font-weight:1000}
      .pm-goal.is-done{background:#ECFDF3;color:#047857;border-color:#86EFAC}
      .pm-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .pm-stat{border:1px solid color-mix(in srgb,var(--tone) 24%,var(--pm-border));border-radius:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--tone) 12%,#fff),var(--pm-card));padding:10px;min-height:64px}
      .pm-stat b{display:block;font-size:20px;line-height:1.05;margin-top:6px}
      .pm-stat span{font-size:11px;color:var(--tone);font-weight:1000}
      .pm-roster{order:2;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.2fr);gap:10px;align-items:stretch}
      .pm-player-card,.pm-cpu-box{border:1px solid color-mix(in srgb,var(--pm-accent) 20%,var(--pm-border));border-radius:16px;background:linear-gradient(135deg,color-mix(in srgb,var(--pm-accent) 7%,#fff),var(--pm-card));padding:10px}
      .pm-player-card{display:flex;align-items:center;gap:9px}
      .pm-cpu-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:8px}
      .pm-cpu-pill{border:1px solid color-mix(in srgb,var(--cpu-color) 32%,var(--pm-border));border-radius:12px;background:color-mix(in srgb,var(--cpu-color) 8%,#fff);padding:7px;font-size:11px;line-height:1.35;color:var(--pm-muted)}
      .pm-cpu-pill b{display:block;color:var(--cpu-color);font-size:12px}
      .pm-count-buttons{display:flex;gap:6px;margin-top:7px}
      .pm-count-buttons button{border:1px solid var(--pm-border);background:var(--pm-card);border-radius:999px;padding:5px 9px;font-size:11px;font-weight:1000;cursor:pointer;color:var(--pm-text)}
      .pm-count-buttons button.is-active{background:var(--pm-accent);color:#fff;border-color:var(--pm-accent)}
      .pm-main{order:1;display:block}
      .pm-board{position:relative;display:grid;grid-template-columns:repeat(7,minmax(76px,1fr));grid-template-rows:repeat(7,minmax(72px,1fr));gap:8px;border:1px solid color-mix(in srgb,var(--pm-accent) 28%,var(--pm-border));border-radius:28px;background:radial-gradient(circle at 22% 18%,rgba(14,165,233,.16),transparent 24%),radial-gradient(circle at 75% 78%,rgba(34,197,94,.15),transparent 25%),linear-gradient(135deg,#F7FFFC,var(--pm-card));padding:12px;box-shadow:0 22px 52px rgba(15,110,86,.11);min-height:710px}
      .pm-tile{position:relative;border:1px solid color-mix(in srgb,var(--tile-color) 34%,var(--pm-border));border-radius:14px;background:linear-gradient(135deg,var(--tile-soft),rgba(255,255,255,.92));padding:7px;text-align:left;overflow:hidden;min-height:72px}
      .pm-tile.is-active{box-shadow:0 0 0 3px color-mix(in srgb,var(--tile-color) 24%,transparent),0 12px 24px color-mix(in srgb,var(--tile-color) 18%,transparent);transform:translateY(-1px)}
      .pm-tile-icon{font-size:20px;display:block}
      .pm-tile-name{display:block;font-size:11px;font-weight:1000;line-height:1.2;margin-top:4px}
      .pm-tile-type{display:inline-block;font-size:9px;font-weight:1000;color:var(--tile-color);background:color-mix(in srgb,var(--tile-color) 10%,#fff);border-radius:999px;padding:2px 6px;margin-top:5px}
      .pm-owner-badge{position:absolute;right:5px;top:5px;border-radius:999px;background:var(--tile-color);color:#fff;font-size:10px;font-weight:1000;padding:3px 6px;box-shadow:0 6px 14px color-mix(in srgb,var(--tile-color) 26%,transparent)}
      .pm-token-stack{position:absolute;right:5px;bottom:5px;display:flex;gap:3px;align-items:center}
      .pm-token{width:32px;height:32px;border-radius:11px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(0,0,0,.12);overflow:hidden;border:2px solid #fff;font-size:14px;font-weight:1000}
      .pm-token.cpu{background:var(--cpu-color);color:#fff}
      .pm-center{position:relative;grid-column:2 / 7;grid-row:2 / 7;border:1px dashed color-mix(in srgb,var(--pm-accent) 28%,var(--pm-border));border-radius:24px;background:linear-gradient(135deg,rgba(240,253,250,.72),rgba(255,255,255,.82));display:grid;place-items:center;text-align:center;padding:18px;overflow:hidden}
      .pm-island{position:absolute;inset:22px;border-radius:22px;background:radial-gradient(ellipse at 52% 46%,rgba(34,197,94,.34) 0 18%,transparent 19%),radial-gradient(ellipse at 50% 47%,rgba(20,184,166,.24) 0 29%,transparent 30%),linear-gradient(135deg,rgba(14,165,233,.12),rgba(250,204,21,.13));}
      .pm-island:before{content:"";position:absolute;left:48%;top:8%;width:112px;height:330px;border-radius:58% 44% 55% 45%;background:linear-gradient(160deg,#BFEFCC,#68D391 45%,#1D9E75);transform:rotate(17deg);box-shadow:0 18px 42px rgba(15,110,86,.22)}
      .pm-island-label{position:absolute;left:22px;top:20px;text-align:left;color:var(--pm-accent);font-weight:1000;font-size:18px}
      .pm-city{position:absolute;border-radius:999px;background:#fff;border:1px solid rgba(15,110,86,.2);padding:4px 8px;font-size:11px;font-weight:1000;color:#0F6E56;box-shadow:0 8px 20px rgba(15,110,86,.12)}
      .pm-overlay{position:relative;z-index:2;width:min(520px,88%);border:1px solid rgba(15,110,86,.2);border-radius:22px;background:rgba(255,255,255,.82);backdrop-filter:blur(12px);box-shadow:0 24px 54px rgba(15,110,86,.18);padding:14px;display:grid;gap:10px}
      .pm-dice{width:72px;height:72px;border:0;border-radius:22px;background:linear-gradient(135deg,var(--pm-accent),var(--pm-accent-2));color:#fff;font-size:32px;font-weight:1000;cursor:pointer;box-shadow:0 18px 32px color-mix(in srgb,var(--pm-accent) 26%,transparent)}
      .pm-dice:disabled{opacity:.55;cursor:not-allowed}
      .pm-section-title{font-size:14px;font-weight:1000;color:var(--pm-text)}
      .pm-feedback{border:1px solid color-mix(in srgb,var(--pm-accent) 24%,var(--pm-border));border-radius:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--pm-accent) 9%,#fff),rgba(255,255,255,.86));padding:10px;font-size:13px;font-weight:900;line-height:1.55;color:var(--pm-accent)}
      .pm-question{display:grid;gap:8px}
      .pm-question h3{margin:0 0 8px;font-size:18px}
      .pm-question p{margin:0;color:var(--pm-muted);font-size:13px;line-height:1.55}
      .pm-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
      .pm-choice{border:1px solid color-mix(in srgb,var(--pm-accent) 22%,var(--pm-border));border-radius:14px;background:var(--pm-card);padding:12px;font-size:15px;font-weight:1000;cursor:pointer;color:var(--pm-text)}
      .pm-choice:hover{border-color:var(--pm-accent);background:color-mix(in srgb,var(--pm-accent) 8%,#fff)}
      .pm-deal{border:1px solid color-mix(in srgb,var(--pm-accent) 28%,var(--pm-border));border-radius:16px;background:linear-gradient(135deg,color-mix(in srgb,var(--pm-accent) 10%,#fff),var(--pm-card));padding:12px;display:grid;gap:9px}
      .pm-deal-text{font-size:12px;color:var(--pm-muted);line-height:1.55}
      .pm-action-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .pm-action{border:0;border-radius:12px;background:var(--pm-accent);color:#fff;padding:10px 12px;font-size:12px;font-weight:1000;cursor:pointer}
      .pm-action.secondary{background:var(--pm-surface);color:var(--pm-text);border:1px solid var(--pm-border)}
      .pm-action:disabled{opacity:.5;cursor:not-allowed}
      @media (max-width:900px){.pm-hero,.pm-roster{grid-template-columns:1fr}.pm-board{grid-template-columns:repeat(7,minmax(44px,1fr));grid-template-rows:repeat(7,minmax(48px,1fr));gap:5px;min-height:560px;padding:8px}.pm-tile{min-height:48px;padding:5px}.pm-tile-name{font-size:9px}.pm-tile-type{display:none}.pm-token{width:25px;height:25px;border-radius:9px}.pm-center{padding:8px}.pm-overlay{width:92%;padding:10px}.pm-dice{width:60px;height:60px;font-size:26px}}
      @media (max-width:520px){.pm-hero{padding:12px;border-radius:18px}.pm-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.pm-cpu-list{grid-template-columns:1fr}.pm-board{gap:3px;min-height:480px}.pm-tile-icon{font-size:15px}.pm-tile-name{font-size:8px}.pm-choices{grid-template-columns:1fr}.pm-island-label{font-size:14px}.pm-city{display:none}}
    `}</style>
    <section className="pm-hero">
      <div>
        <div className="pm-kicker">學習桌遊 · 寵物同行</div>
        <div className="pm-title">學習島棋盤</div>
        <div className="pm-desc">目標是收購地產、升級收益、用寵物技能拉開差距。英文任務是觸發格子效果的挑戰，不會先告訴你下一步會去哪裡。</div>
        <div className={`pm-goal ${goalDone?"is-done":""}`}>{goalDone?"🏆":"🎯"} {goalText}</div>
      </div>
      <div className="pm-stats">
        <div className="pm-stat" style={{"--tone":"#0F9F7A"}}><span>資產</span><b>{propertyCount}</b></div>
        <div className="pm-stat" style={{"--tone":"#D97706"}}><span>金幣</span><b>{coins}</b></div>
        <div className="pm-stat" style={{"--tone":"#2563EB"}}><span>回合</span><b>{turn}</b></div>
        <div className="pm-stat" style={{"--tone":"#DB2777"}}><span>連勝</span><b>{streak}</b></div>
      </div>
    </section>
    <section className="pm-roster">
      <div className="pm-player-card">
        <span style={{width:46,height:46,borderRadius:14,background:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",overflow:"hidden",boxShadow:"0 8px 18px rgba(0,0,0,.08)"}}>
          {selectedPet?<PixelPet pet={selectedPet} size={46}/>:<span style={{fontSize:24}}>🐾</span>}
        </span>
        <span style={{minWidth:0}}>
          <span style={{display:"block",fontSize:14,fontWeight:1000,color:S.t1}}>玩家 · {selectedPetDef?.name||"學習棋子"}</span>
          <span style={{display:"block",fontSize:12,color:S.t3}}>圈數 {score.laps} · 命中率 {accuracy}% · 地產 {propertyCount}</span>
        </span>
      </div>
      <div className="pm-cpu-box">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <div className="pm-section-title">電腦玩家</div>
          <div style={{fontSize:11,color:S.t3}}>最多 3 家 play</div>
        </div>
        <div className="pm-count-buttons" aria-label="電腦玩家數量">
          {[1,2,3].map(n=><button key={n} type="button" className={computerCount===n?"is-active":""} onClick={()=>setComputerCount(n)}>{n}</button>)}
        </div>
        <div className="pm-cpu-list">
          {activeComputers.map(cpu=>(
            <div key={cpu.id} className="pm-cpu-pill" style={{"--cpu-color":cpu.color}}>
              <b>{cpu.emoji} {cpu.name}</b>
              <span>金幣 {cpu.coins} · 地產 {cpu.owned.length}</span>
              <span style={{display:"block",marginTop:3}}>{cpu.last}</span>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:S.t3,marginTop:7}}>{computerNotice}</div>
      </div>
    </section>
    <section className="pm-main">
      <div className="pm-board" data-testid="pet-monopoly-board" aria-label="寵物大富翁棋盤">
        {tiles.map((tile,i)=>{
          const meta=PET_MONOPOLY_TYPE_META[tile.type]||PET_MONOPOLY_TYPE_META.word;
          const[posCol,posRow]=PET_MONOPOLY_GRID[i]||[1,1];
          const active=i===position;
          const property=owned[tile.id];
          const computerVisitors=activeComputers.filter(cpu=>cpu.position===i);
          return(
            <div key={tile.id} className={`pm-tile ${active?"is-active":""}`} style={{"--tile-color":meta.color,"--tile-soft":meta.soft,gridColumn:posCol,gridRow:posRow}}>
              <span className="pm-tile-icon">{tile.icon}</span>
              <span className="pm-tile-name">{tile.name}</span>
              <span className="pm-tile-type">{meta.label}</span>
              {property&&<span className="pm-owner-badge">Lv.{property.level}</span>}
              {(active||computerVisitors.length>0)&&(
                <span className="pm-token-stack">
                  {active&&<span className="pm-token" aria-label="目前位置">{selectedPet?<PixelPet pet={selectedPet} size={32}/>:<span>🐾</span>}</span>}
                  {computerVisitors.map(cpu=><span key={cpu.id} className="pm-token cpu" style={{"--cpu-color":cpu.color}} title={cpu.name}>{cpu.name.replace("電腦 ","")}</span>)}
                </span>
              )}
            </div>
          );
        })}
        <div className="pm-center">
          <div className="pm-island" aria-hidden="true">
            <div className="pm-island-label">台灣學習島</div>
            <span className="pm-city" style={{left:"50%",top:"16%"}}>台北</span>
            <span className="pm-city" style={{left:"39%",top:"45%"}}>台中</span>
            <span className="pm-city" style={{left:"47%",top:"70%"}}>高雄</span>
            <span className="pm-city" style={{right:"18%",top:"48%"}}>花東</span>
          </div>
          <div className="pm-overlay" data-testid="pet-monopoly-overlay">
            <div className="pm-feedback" data-testid="pet-monopoly-feedback">{feedback}</div>
            {moving&&(
              <div className="pm-deal" data-testid="pet-monopoly-moving">
                <div className="pm-section-title">移動中</div>
                <div className="pm-deal-text">骰出 {moving.dice}，正在前往「{moving.to}」：{moving.step}/{moving.total}</div>
              </div>
            )}
            {!moving&&pending&&(
              <div className="pm-question">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                  <div style={{fontSize:12,fontWeight:1000,color:color}}>英文挑戰 · 骰出 {pending.dice}</div>
                  <div style={{fontSize:12,fontWeight:1000,color:PET_MONOPOLY_TYPE_META[pending.tile.type]?.color||color}}>{pending.tile.name}</div>
                </div>
                <h3>{pending.question.prompt}</h3>
                <p>{pending.question.sub}</p>
                <div className="pm-choices">
                  {pending.question.choices.map((choice,i)=>(
                    <button key={`${choice}-${i}`} type="button" className="pm-choice" data-testid={i===pending.question.answer?"pet-monopoly-choice-correct":undefined} onClick={()=>answer(i)}>
                      {choice}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!moving&&!pending&&offer&&offerTile&&(
              <div className="pm-deal" data-testid="pet-monopoly-deal">
                <div className="pm-section-title">收購機會</div>
                <div className="pm-deal-text">用 {offer.cost} 金幣買下「{offerTile.name}」。第一次停到這格只能決定是否收購；下一次再停到已擁有地產才可升級。</div>
                <div className="pm-action-row">
                  <button type="button" className="pm-action" data-testid="pet-monopoly-buy" disabled={(Number(coins)||0)<offer.cost} onClick={buyProperty}>收購</button>
                  <button type="button" className="pm-action secondary" onClick={skipOffer}>略過</button>
                </div>
              </div>
            )}
            {!moving&&!pending&&!offer&&(
              <div className="pm-deal">
                <div className="pm-section-title">目前格子 · {currentTile.icon} {currentTile.name}</div>
                <div className="pm-deal-text">{currentTile.hint} · {currentMeta.label}</div>
                {currentProperty&&(
                  <div className="pm-deal-text">你的地產 Lv.{currentProperty.level}，再次停留收益 +{currentYield.coins} 金幣、+{currentYield.xp} XP。已停留 {currentProperty.visits||1} 次。</div>
                )}
                {currentProperty&&currentProperty.visits<2&&<div className="pm-deal-text" style={{fontWeight:1000,color:color}}>下一次再停到這格才能升級。</div>}
                {canUpgradeCurrent&&<button type="button" className="pm-action" disabled={(Number(coins)||0)<currentUpgradeCost} onClick={upgradeCurrentProperty}>升級 {currentUpgradeCost} 金幣</button>}
                {!currentProperty&&isPetMonopolyOwnable(currentTile)&&<div className="pm-deal-text">答對這格英文任務後，才會出現收購決定。</div>}
                <div>
                  <button className="pm-dice" data-testid="pet-monopoly-roll" disabled={!!moving||!!pending||!!offer} onClick={roll} aria-label="擲骰">{dice||"🎲"}</button>
                  <div style={{fontSize:13,fontWeight:1000,color:color,marginTop:8}}>{lastMove?`落在：${lastMove.tile.name}`:"目的地未知"}</div>
                  <div style={{fontSize:12,color:S.t3,marginTop:4}}>按下骰子，目的地才會揭曉。</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  </div>);
}

function WhackM({lv,onBack,onXp}){
  const c=LV[lv];
  const TOTAL_WORDS=10;
  const[words,setWords]=useState(()=>pickWhackWords(V[lv],TOTAL_WORDS,lv));const[loading,setLoading]=useState(true);
  const[wi,setWi]=useState(0);const[typed,setTyped]=useState([]);const[holes,setHoles]=useState([]);
  const[score,setScore]=useState(0);const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);
  const[timeLeft,setTimeLeft]=useState(0);const[phase,setPhase]=useState("ready");
  const[shakeIdx,setShakeIdx]=useState(-1);const[showConfetti,setShowConfetti]=useState(false);
  const[lives,setLives]=useState(3);const[hitAnim,setHitAnim]=useState(-1);
  const[roundMisses,setRoundMisses]=useState(0);const[totalMisses,setTotalMisses]=useState(0);
  const[missedWords,setMissedWords]=useState([]);const[hintFlash,setHintFlash]=useState("");
  const[lastMsg,setLastMsg]=useState("");
  const timerRef=useRef(null);const typedRef=useRef([]);

  useEffect(()=>{let active=true;setLoading(true);(async()=>{
    const cloud=await fetchCloudVocab(lv,TOTAL_WORDS*4);
    if(!active)return;
    const picked=pickWhackWords(cloud?.length?cloud:V[lv],TOTAL_WORDS,lv);
    setWords(picked.length?picked:pickWhackWords(V[lv],TOTAL_WORDS,lv));
    setWi(0);setScore(0);setCombo(0);setMaxCombo(0);setLives(3);setTotalMisses(0);setMissedWords([]);setShowConfetti(false);setPhase("ready");setLoading(false);
  })();return()=>{active=false;if(timerRef.current)clearInterval(timerRef.current)}},[lv]);
  useEffect(()=>{typedRef.current=typed},[typed]);
  useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current)},[]);

  const total=Math.min(words.length,TOTAL_WORDS);
  const cur=words[wi];
  const wordText=String(cur?.w||"").toLowerCase();
  const nextLetter=wordText[typed.length]||"";
  const ROUND_TIME=whackRoundTime(wordText,lv);

  const generateHoles=useCallback(()=>{
    if(!wordText)return;
    setHoles(buildWhackHoles(wordText,lv));
  },[wordText,lv]);

  const startRound=useCallback(()=>{
    if(!cur||!wordText)return;
    typedRef.current=[];setTyped([]);setRoundMisses(0);setHintFlash("");
    setLastMsg(`先找第 1 個字母：${wordText[0].toUpperCase()}`);
    generateHoles();setTimeLeft(ROUND_TIME);setPhase("play");
    if(timerRef.current)clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{setTimeLeft(t=>{if(t<=1){clearInterval(timerRef.current);setPhase("fail");setCombo(0);setLives(l=>Math.max(0,l-1));setMissedWords(m=>m.some(x=>x.w===cur.w)?m:[...m,cur]);playSound("bad");return 0}return t-1})},1000);
  },[cur,wordText,ROUND_TIME,generateHoles]);

  useEffect(()=>{if(phase==="ready"&&!loading&&cur)startRound()},[wi,loading,phase,cur,startRound]);

  const finishGame=(celebrate=true)=>{playSound("done");if(celebrate){setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500)}setPhase("done")};
  const tapLetter=(hole,idx)=>{
    if(phase!=="play"||!hole?.visible||!wordText)return;
    const current=typedRef.current;
    const expected=wordText[current.length];
    if(hole.letter===expected){
      playSound("flip");
      setHitAnim(idx);setTimeout(()=>setHitAnim(-1),300);
      const newTyped=[...current,hole.letter];
      typedRef.current=newTyped;setTyped(newTyped);
      setHoles(h=>h.map(x=>x.id===hole.id?{...x,visible:false}:x));
      const next=wordText[newTyped.length];
      setLastMsg(next?`很好，下一個找：${next.toUpperCase()}`:"完成！");
      if(newTyped.length===wordText.length){
        clearInterval(timerRef.current);
        setPhase("success");setScore(s=>s+1);onXp(10);
        setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));if(nc>=3)playSound("combo");else playSound("good");return nc});
        speak(cur.w);
      }
    }else{
      setShakeIdx(idx);setTimeout(()=>setShakeIdx(-1),300);
      setRoundMisses(n=>n+1);setTotalMisses(n=>n+1);setTimeLeft(t=>Math.max(1,t-1));
      const later=wordText.slice(current.length+1).includes(hole.letter);
      setLastMsg(later?`順序還沒到，先找：${expected.toUpperCase()}`:`不是這個字母，先找：${expected.toUpperCase()}`);
      playSound("bad");
    }
  };

  const useHint=()=>{
    if(phase!=="play"||!nextLetter)return;
    setHintFlash(nextLetter);setLastMsg(`提示：找發亮的 ${nextLetter.toUpperCase()}`);
    setTotalMisses(n=>n+1);setTimeLeft(t=>Math.max(2,t-2));playSound("flip");
    setTimeout(()=>setHintFlash(""),1400);
  };
  const retryWord=()=>{if(lives<=0){finishGame(false);return}setPhase("ready")};
  const nextWord=()=>{
    if(lives<=0&&phase==="fail"){finishGame(false);return}
    if(wi+1>=total){finishGame();return}
    setWi(w=>w+1);setPhase("ready");
  };
  const restart=async()=>{
    if(timerRef.current)clearInterval(timerRef.current);
    setLoading(true);setWi(0);setScore(0);setCombo(0);setMaxCombo(0);setLives(3);setTotalMisses(0);setMissedWords([]);setPhase("ready");
    const cloud=await fetchCloudVocab(lv,TOTAL_WORDS*4);
    const picked=pickWhackWords(cloud?.length?cloud:V[lv],TOTAL_WORDS,lv);
    setWords(picked.length?picked:pickWhackWords(V[lv],TOTAL_WORDS,lv));setLoading(false);
  };

  if(loading)return(<div><Hdr t="🔨 打地鼠拼字" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入中...</div></div>);
  if(!cur)return(<div><Hdr t="🔨 打地鼠拼字" onBack={onBack} cl={c.cl}/><div style={{...S.card,padding:"28px 18px",textAlign:"center",color:S.t2}}>目前沒有可練習的單字</div></div>);

  if(phase==="done"){const grade=total?Math.round(score/total*100):0;const review=words.slice(0,total);return(<div>{showConfetti&&<Confetti/>}<Hdr t="🔨 打地鼠拼字" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"28px 12px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{lives<=0?"💀":grade>=80?"🏆":"🎉"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>{lives<=0?"遊戲結束！":"拼字完成！"}</h2><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxWidth:420,margin:"16px auto"}}>{[["答對",`${score}/${total}`,c.cl],["準確率",`${grade}%`,grade>=80?"#1D9E75":"#EF9F27"],["錯敲",totalMisses,"#E24B4A"]].map(([l,v,cl])=><div key={l} style={{...S.card,padding:"12px 8px",textAlign:"center",borderTop:`3px solid ${cl}`}}><div style={{fontSize:22,fontWeight:800,color:cl}}>{v}</div><div style={{fontSize:11,color:S.t3,marginTop:2}}>{l}</div></div>)}</div>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{fontSize:14,color:S.t2,marginTop:8,marginBottom:14}}>{grade>=80?"拼字節奏很好，下一輪可以挑戰更快！":"可以先聽發音，再照字母順序慢慢敲。"}</div>{missedWords.length>0&&<div style={{...S.card,padding:"12px 14px",textAlign:"left",maxWidth:520,margin:"0 auto 12px"}}><div style={{fontSize:13,fontWeight:700,color:"#E24B4A",marginBottom:8}}>需要再練的字</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{missedWords.map(w=><button key={w.w} onClick={()=>speak(w.w)} style={{border:`1px solid ${S.bd}`,background:S.bg2,borderRadius:999,padding:"7px 10px",fontSize:12,color:S.t1,cursor:"pointer",fontFamily:"inherit"}}><b>{w.w}</b> · {w.m}</button>)}</div></div>}<div style={{...S.card,padding:"12px 14px",textAlign:"left",maxWidth:520,margin:"0 auto 16px"}}><div style={{fontSize:13,fontWeight:700,color:S.t1,marginBottom:8}}>本輪複習</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>{review.map(w=><button key={w.w} onClick={()=>speak(w.w)} style={{textAlign:"left",border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:12,padding:"9px 10px",fontSize:12,color:S.t2,cursor:"pointer",fontFamily:"inherit",lineHeight:1.45}}><div style={{fontSize:15,fontWeight:800,color:c.cl}}>{w.w}</div><div>{w.m}</div></button>)}</div></div><button onClick={restart} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 再玩一次</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}

  const completed=phase==="success"||phase==="fail"?wi+1:wi;
  const pct=Math.round((completed/Math.max(total,1))*100);
  const urgency=timeLeft<=3?"#E24B4A":timeLeft<=6?"#EF9F27":"#1D9E75";
  const comboLabel=combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";
  return(<div><Hdr t="🔨 打地鼠拼字" onBack={onBack} cl={c.cl}/>
    <style>{`@keyframes moleUp{0%{transform:translateY(80%) scale(0.7);opacity:0}60%{transform:translateY(-5%) scale(1.05)}100%{transform:translateY(0) scale(1);opacity:1}}@keyframes hammerHit{0%{transform:rotate(0) scale(1)}40%{transform:rotate(-15deg) scale(1.2)}100%{transform:rotate(0) scale(1)}}@keyframes hintGlow{0%,100%{box-shadow:0 0 0 0 rgba(239,159,39,.35)}50%{box-shadow:0 0 0 8px rgba(239,159,39,0)}}`}</style>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:12}}>
      <div style={{flex:1,height:8,background:S.bg2,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:999,transition:"width .3s"}}/></div>
      <span style={{color:S.t3,minWidth:44,textAlign:"right"}}>{wi+1}/{total}</span>
      <span style={{fontSize:14,minWidth:58,textAlign:"right"}}>{"❤️".repeat(lives)}{"🖤".repeat(Math.max(0,3-lives))}</span>
    </div>
    {comboLabel&&<div style={{textAlign:"center",fontSize:14,fontWeight:700,color:"#EF9F27",marginBottom:6,animation:"comboFlash .5s"}}>{comboLabel}</div>}

    <div style={{...S.card,padding:"14px 16px",textAlign:"center",marginBottom:10,position:"relative",overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:8}}>
        <div style={{fontSize:12,color:c.cl,fontWeight:700}}>看中文，照順序敲字母</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={()=>speak(cur.w)} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:999,padding:"6px 10px",fontSize:12,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>🔊 發音</button>
          <button onClick={useHint} disabled={phase!=="play"} style={{background:phase==="play"?"#FFF3CD":S.bg2,border:`1px solid ${S.bd}`,borderRadius:999,padding:"6px 10px",fontSize:12,cursor:phase==="play"?"pointer":"default",color:phase==="play"?"#8A5A00":S.t3,fontFamily:"inherit",opacity:phase==="play"?1:.55}}>💡 提示</button>
        </div>
      </div>
      <div style={{fontSize:30,fontWeight:800,color:S.t1,lineHeight:1.15}}>{cur.m}</div>
      <div style={{fontSize:13,color:S.t2,marginTop:3}}>{cur.p||" "}</div>
      <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",marginTop:10}}>
        <div style={{padding:"7px 12px",borderRadius:999,background:c.bg,color:c.cl,fontSize:13,fontWeight:800}}>下一個：{nextLetter?nextLetter.toUpperCase():"完成"}</div>
        <div style={{padding:"7px 12px",borderRadius:999,background:S.bg2,color:roundMisses?"#E24B4A":S.t3,fontSize:13,fontWeight:700}}>錯敲 {roundMisses}</div>
        <div style={{padding:"7px 12px",borderRadius:999,background:S.bg2,color:urgency,fontSize:13,fontWeight:800}}>{timeLeft}s</div>
      </div>
      {lastMsg&&<div style={{fontSize:12,color:S.t2,marginTop:8,minHeight:18}}>{lastMsg}</div>}
      <div style={{marginTop:8,position:"relative"}}>
        <div style={{height:8,background:S.bg2,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(timeLeft/ROUND_TIME)*100}%`,background:`linear-gradient(90deg,${urgency},${urgency}88)`,borderRadius:4,transition:"width .8s linear"}}/></div>
      </div>
    </div>

    <div style={{display:"flex",justifyContent:"center",gap:5,marginBottom:12,flexWrap:"wrap"}}>
      {wordText.split("").map((l,i)=>(<div key={i} style={{width:36,height:42,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:21,fontWeight:800,border:`2px solid ${i<typed.length?c.cl:i===typed.length?urgency:S.bd}`,background:i<typed.length?c.bg:i===typed.length?`${urgency}15`:S.bg2,color:i<typed.length?c.cl:S.t3,transition:"all .15s",animation:i===typed.length-1?"bounceIn .25s":"none",boxShadow:i===typed.length?`0 0 8px ${urgency}30`:"none"}}>{i<typed.length?typed[i].toUpperCase():"·"}</div>))}
    </div>

    {phase==="play"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(74px,1fr))",gap:10,maxWidth:520,margin:"0 auto"}}>
      {holes.map((h,i)=>{
        if(!h.visible)return <div key={h.id} style={{height:78,borderRadius:18,background:"linear-gradient(180deg,#D7C7A0,#BFA273)",border:`1px solid ${S.bd}`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,fontWeight:800,opacity:.55}}>✓</div>;
        const isHint=hintFlash&&h.letter===hintFlash;
        return(<button key={h.id} onClick={()=>tapLetter(h,i)} aria-label={`letter ${h.letter}`} style={{
          height:78,borderRadius:18,border:isHint?`3px solid #FFD166`:"none",
          background:"linear-gradient(180deg,#8B6914 0%,#6B4F12 40%,#4A3509 100%)",
          boxShadow:isHint?`0 0 0 3px ${c.bg}, inset 0 -4px 8px rgba(0,0,0,.2)`:"inset 0 -4px 8px rgba(0,0,0,.2), 0 4px 8px rgba(0,0,0,.1)",
          cursor:"pointer",transition:"transform .1s",
          animation:isHint?"hintGlow .8s infinite":shakeIdx===i?"moleShake .3s":hitAnim===i?"hammerHit .3s":"moleUp .3s ease-out",
          animationDelay:hitAnim!==i&&shakeIdx!==i&&!isHint?`${i*0.04}s`:"0s",
          animationFillMode:"both",
          WebkitTapHighlightColor:"transparent",
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:0,
          position:"relative",overflow:"hidden"
        }} onTouchStart={e=>e.currentTarget.style.transform="scale(0.9)"} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:10,background:"linear-gradient(180deg,#4CAF50,#388E3C)",borderRadius:"18px 18px 0 0"}}/>
          <div style={{fontSize:24,marginTop:4,filter:hitAnim===i||isHint?"brightness(1.35)":"none",transition:"filter .1s"}}>{h.mole}</div>
          <div style={{fontSize:23,fontWeight:900,color:"#FFD700",textShadow:"0 1px 3px rgba(0,0,0,.55)",textTransform:"uppercase",lineHeight:1}}>{h.letter}</div>
          {hitAnim===i&&<div style={{position:"absolute",inset:0,background:"rgba(255,215,0,.3)",borderRadius:18,pointerEvents:"none"}}/>}
        </button>)
      })}
    </div>}

    {(phase==="success"||phase==="fail")&&<div style={{...S.card,padding:"22px 18px",textAlign:"center",marginTop:10,animation:"fadeUp .3s"}}>
      <div style={{fontSize:48,animation:phase==="success"?"bounceIn .3s":"moleShake .3s"}}>{phase==="success"?"🎯":"⏰"}</div>
      <div style={{fontSize:18,fontWeight:800,color:phase==="success"?"#1D9E75":"#E24B4A",marginTop:6}}>{phase==="success"?"答對了！":"時間到！"}</div>
      <div style={{fontSize:24,fontWeight:900,color:c.cl,marginTop:4,letterSpacing:0}}>{cur.w}</div>
      <div style={{fontSize:13,color:S.t2,marginTop:2}}>{cur.m}</div>
      {phase==="fail"&&<div style={{fontSize:13,color:S.t2,marginTop:8}}>正確拼法：<b>{cur.w}</b></div>}
      <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",marginTop:14}}>
        {phase==="fail"&&lives>0&&<button onClick={retryWord} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14,padding:"11px 18px"}}>再試一次此字</button>}
        <button onClick={nextWord} style={{...S.btn,background:c.cl,color:"#fff",fontSize:14,padding:"11px 22px"}}>{lives<=0&&phase==="fail"?"💀 遊戲結束":wi+1>=total?"🏁 看成績":"▶ 下一題"}</button>
      </div>
    </div>}
  </div>);
}

// ═══ MEMORY MATCH (配對翻牌) ═══════════════════════════════════════
function normalizeMatchMeaning(text){
  return String(text||"").split(/[；;，,、/]/)[0].trim();
}
function pickMatchWords(list,count){
  const pool=shuffleCopy(list||[]).filter(w=>w?.w&&w?.m);
  const chosen=[],seenWords=new Set(),seenMeanings=new Set();
  pool.forEach(w=>{
    if(chosen.length>=count)return;
    const wordKey=String(w.w).toLowerCase();
    const meaningKey=normalizeMatchMeaning(w.m).toLowerCase();
    if(seenWords.has(wordKey)||!meaningKey||seenMeanings.has(meaningKey))return;
    seenWords.add(wordKey);seenMeanings.add(meaningKey);chosen.push(w);
  });
  pool.forEach(w=>{
    if(chosen.length>=count)return;
    const wordKey=String(w.w).toLowerCase();
    if(seenWords.has(wordKey))return;
    seenWords.add(wordKey);chosen.push(w);
  });
  return chosen.slice(0,count);
}
function MatchM({lv,onBack,onXp}){
  const c=LV[lv];
  const[words,setWords]=useState(V[lv]);const[loading,setLoading]=useState(true);
  const[cards,setCards]=useState([]);const[flipped,setFlipped]=useState([]);const[matched,setMatched]=useState([]);
  const[moves,setMoves]=useState(0);const[startTime,setStartTime]=useState(null);const[elapsed,setElapsed]=useState(0);
  const[phase,setPhase]=useState("ready");// ready,play,done
  const[showConfetti,setShowConfetti]=useState(false);const[resolving,setResolving]=useState(false);
  const[lastResult,setLastResult]=useState(null);const[peek,setPeek]=useState(false);
  const PAIRS=lv==="elementary"?6:lv==="junior"?6:6;

  useEffect(()=>{let active=true;setLoading(true);(async()=>{const cloud=await fetchCloudVocab(lv,PAIRS*3);if(!active)return;setWords(cloud?.length>=PAIRS?cloud:V[lv]);setLoading(false)})();return()=>{active=false}},[lv]);

  const initGame=useCallback(()=>{
    const chosen=pickMatchWords(words,PAIRS);
    const pairs=[];
    chosen.forEach((w,i)=>{
      pairs.push({id:`en-${i}`,pairId:i,type:"en",text:w.w,word:w});
      pairs.push({id:`zh-${i}`,pairId:i,type:"zh",text:normalizeMatchMeaning(w.m)||w.m,word:w});
    });
    setCards(shuffleCopy(pairs));
    setFlipped([]);setMatched([]);setMoves(0);setElapsed(0);setResolving(false);setLastResult(null);setPeek(false);setStartTime(Date.now());setPhase("play");
  },[words,PAIRS]);

  useEffect(()=>{if(!loading)initGame()},[loading]);

  // Timer
  useEffect(()=>{
    if(phase!=="play")return;
    const t=setInterval(()=>setElapsed(Math.floor((Date.now()-startTime)/1000)),1000);
    return()=>clearInterval(t);
  },[phase,startTime]);

  const flipCard=(idx)=>{
    if(phase!=="play")return;
    if(resolving||peek)return;
    if(flipped.length>=2)return;
    if(flipped.includes(idx))return;
    if(matched.includes(cards[idx].pairId))return;
    playSound("flip");
    const newFlipped=[...flipped,idx];
    setFlipped(newFlipped);
    if(newFlipped.length===1)setLastResult(null);

    if(newFlipped.length===2){
      setResolving(true);
      setMoves(m=>m+1);
      const[a,b]=[cards[newFlipped[0]],cards[newFlipped[1]]];
      if(a.pairId===b.pairId&&a.type!==b.type){
        // Match!
        setLastResult({ok:true,word:a.word});
        setTimeout(()=>{
          playSound("good");speak(a.word.w);
          setMatched(m=>{const nm=[...m,a.pairId];if(nm.length===PAIRS){setTimeout(()=>{playSound("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500);setPhase("done")},400);onXp(20)}else{onXp(5)}return nm});
          setFlipped([]);setResolving(false);
        },400);
      }else{
        // No match
        setLastResult({ok:false,left:a,right:b});
        setTimeout(()=>{playSound("bad");setFlipped([]);setResolving(false)},850);
      }
    }
  };

  const restart=()=>{initGame()};
  const usePeek=()=>{if(phase!=="play"||peek||resolving)return;setPeek(true);setMoves(m=>m+1);setLastResult({hint:true});playSound("flip");setTimeout(()=>{setPeek(false);setLastResult(null)},1800)};
  const isFlipped=(idx)=>peek||flipped.includes(idx)||matched.includes(cards[idx]?.pairId);
  const progress=Math.round((matched.length/PAIRS)*100);
  const reviewWords=[...new Map(cards.map(card=>[card.pairId,card.word])).values()];

  if(loading)return(<div><Hdr t="🎴 配對翻牌" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入中...</div></div>);

  if(phase==="done"){const stars=moves<=PAIRS*2?3:moves<=PAIRS*3?2:1;return(<div>{showConfetti&&<Confetti/>}<Hdr t="🎴 配對翻牌" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"24px 12px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{stars===3?"🏆":stars===2?"🎉":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>全部配對成功！</h2><div style={{display:"flex",justifyContent:"center",gap:16,marginTop:12,marginBottom:8}}><div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:c.cl}}>{moves}</div><div style={{fontSize:11,color:S.t3}}>翻牌次數</div></div><div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:c.cl}}>{elapsed}s</div><div style={{fontSize:11,color:S.t3}}>花費時間</div></div><div style={{textAlign:"center"}}><div style={{fontSize:22}}>{"⭐".repeat(stars)}</div><div style={{fontSize:11,color:S.t3}}>評價</div></div></div><div style={{fontSize:14,color:S.t2,marginBottom:14}}>{stars===3?"完美記憶！太厲害了！🌟":stars===2?"記憶力不錯！💪":"多玩幾次會更快！📖"}</div><div style={{...S.card,padding:"12px",maxWidth:520,margin:"0 auto 14px",textAlign:"left"}}><div style={{fontSize:13,fontWeight:700,color:S.t1,marginBottom:8}}>本輪複習</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>{reviewWords.map(w=><button key={w.w} onClick={()=>speak(w.w)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:10,padding:"8px 10px",textAlign:"left",fontFamily:"inherit",cursor:"pointer"}}><div style={{fontSize:15,fontWeight:800,color:c.cl}}>{w.w}</div><div style={{fontSize:12,color:S.t2,marginTop:2}}>{w.m}</div></button>)}</div></div><button onClick={restart} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 再玩一次</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}

  return(<div><Hdr t="🎴 配對翻牌" onBack={onBack} cl={c.cl}/>
    {/* Status bar */}
    <div style={{marginBottom:10,padding:"9px 10px",...S.card}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
        <span style={{fontSize:13,color:S.t2}}>🃏 {matched.length}/{PAIRS} 配對</span>
        <span style={{fontSize:13,color:S.t2}}>👆 {moves} 次</span>
        <span style={{fontSize:13,color:S.t2}}>⏱ {elapsed}s</span>
        <button onClick={usePeek} disabled={peek||resolving} style={{border:`1px solid ${S.bd}`,background:S.bg1,color:c.cl,borderRadius:10,padding:"5px 9px",fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:peek||resolving?"default":"pointer",opacity:(peek||resolving)?0.55:1}}>提示</button>
      </div>
      <div style={{height:5,background:S.bg2,borderRadius:4,overflow:"hidden",marginTop:8}}><div style={{height:"100%",width:`${progress}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,transition:"width .25s"}}/></div>
    </div>
    {/* Card grid */}
    {lastResult&&<div style={{fontSize:12,color:lastResult.ok?"#1D9E75":lastResult.hint?c.cl:"#E24B4A",background:lastResult.ok?"#E1F5EE":lastResult.hint?c.bg:"#FDECEC",border:`1px solid ${lastResult.ok?"#9AD8C6":lastResult.hint?c.ac:"#F4B5B5"}`,borderRadius:12,padding:"8px 10px",marginBottom:10,textAlign:"center",fontWeight:700}}>
      {lastResult.hint?"提示已開啟 1.8 秒，這次會多算一步。":lastResult.ok?`配對成功：${lastResult.word.w} = ${lastResult.word.m}`:`還不是一組：${lastResult.left.text} / ${lastResult.right.text}`}
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,maxWidth:480,margin:"0 auto"}}>
      {cards.map((card,idx)=>{const open=isFlipped(idx);const isMatched=matched.includes(card.pairId);
        return(<button key={card.id} onClick={()=>flipCard(idx)} disabled={open||resolving||peek} style={{height:82,borderRadius:12,border:isMatched?`2px solid ${c.cl}`:open?`2px solid ${c.ac}`:`2px solid ${S.bd}`,background:open?(isMatched?c.bg:S.bg1):`linear-gradient(135deg,${c.cl},${c.ac})`,cursor:open||resolving||peek?"default":"pointer",fontSize:open?(card.type==="en"?16:14):24,fontWeight:open?700:400,color:open?S.t1:"#fff",padding:"6px 7px",fontFamily:"inherit",transition:"all .2s",opacity:isMatched?.72:1,animation:open&&!isMatched?"matchFlip .3s ease-out":"none",WebkitTapHighlightColor:"transparent",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:open?"0 2px 8px rgba(0,0,0,.06)":"0 5px 14px rgba(0,0,0,.12)"}} onTouchStart={e=>{if(!open&&!resolving&&!peek)e.currentTarget.style.transform="scale(0.94)"}} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
          {open?(<span style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,lineHeight:1.25,maxWidth:"100%"}}><span style={{fontSize:10,color:isMatched?c.cl:S.t3,fontWeight:800}}>{card.type==="en"?"EN":"中文"}</span><span style={{wordBreak:"break-word",overflowWrap:"anywhere"}}>{card.text}{card.type==="en"&&isMatched?" ✓":""}</span></span>):"?"}
        </button>)})}
    </div>
    {/* Hint */}
    <div style={{textAlign:"center",fontSize:11,color:S.t3,marginTop:10}}>
      翻兩張牌，找到英文和中文的配對！
    </div>
  </div>);
}

// ═══ BOMB DEFUSE SPELLING (拆彈拼字 v2) ═════════════════════════════
function bombRoundTime(word,lv){
  const len=String(word||"").length;
  const base=lv==="elementary"?14:lv==="junior"?12:10;
  const per=lv==="elementary"?2.4:lv==="junior"?2.1:1.9;
  const cap=lv==="elementary"?34:lv==="junior"?30:26;
  return Math.min(cap,Math.max(base,Math.ceil(base+len*per)));
}
function BombM({lv,onBack,onXp}){
  const c=LV[lv];
  const TOTAL=10;
  const[words,setWords]=useState(()=>pickWhackWords(V[lv],TOTAL,lv));const[loading,setLoading]=useState(true);
  const[wi,setWi]=useState(0);const[input,setInput]=useState("");
  const[timeLeft,setTimeLeft]=useState(0);const[phase,setPhase]=useState("ready");
  const[score,setScore]=useState(0);const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);
  const[showConfetti,setShowConfetti]=useState(false);const[shake,setShake]=useState(false);
  const[hintLevel,setHintLevel]=useState(0);const[lives,setLives]=useState(3);
  const[attempts,setAttempts]=useState(0);const[wrongSubmits,setWrongSubmits]=useState(0);
  const[hintCount,setHintCount]=useState(0);const[missedWords,setMissedWords]=useState([]);
  const[lastMsg,setLastMsg]=useState("");
  const timerRef=useRef(null);const inputRef=useRef(null);

  const cur=words[wi];
  const wordText=String(cur?.w||"").toLowerCase();
  const total=Math.min(words.length,TOTAL);
  const BOMB_TIME=bombRoundTime(wordText,lv);
  const inputLetters=input.toLowerCase().split("");
  const firstWrong=inputLetters.findIndex((ch,i)=>ch!==wordText[i]);
  const prefixOk=firstWrong<0;
  const typedCount=Math.min(input.length,wordText.length);

  useEffect(()=>{let active=true;setLoading(true);(async()=>{
    const cloud=await fetchCloudVocab(lv,TOTAL*4);
    if(!active)return;
    const picked=pickWhackWords(cloud?.length?cloud:V[lv],TOTAL,lv);
    setWords(picked.length?picked:pickWhackWords(V[lv],TOTAL,lv));
    setWi(0);setScore(0);setCombo(0);setMaxCombo(0);setLives(3);setAttempts(0);setWrongSubmits(0);setHintCount(0);setMissedWords([]);setPhase("ready");setLoading(false);
  })();return()=>{active=false;if(timerRef.current)clearInterval(timerRef.current)}},[lv]);

  const startRound=useCallback(()=>{if(!cur||!wordText)return;setInput("");setHintLevel(0);setLastMsg("看中文提示，輸入完整英文單字。");setTimeLeft(BOMB_TIME);setPhase("play");
    if(timerRef.current)clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{setTimeLeft(t=>{if(t<=1){clearInterval(timerRef.current);setPhase("explode");setCombo(0);setLives(l=>Math.max(0,l-1));setMissedWords(m=>m.some(x=>x.w===cur.w)?m:[...m,cur]);playSound("bad");return 0}return t-1})},1000);
    setTimeout(()=>inputRef.current?.focus(),100);
  },[cur,wordText,BOMB_TIME]);
  useEffect(()=>{if(phase==="ready"&&!loading&&cur)startRound()},[wi,loading,phase,cur,startRound]);
  useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current)},[]);

  const handleInput=raw=>{
    const cleaned=String(raw||"").toLowerCase().replace(/[^a-z]/g,"").slice(0,wordText.length);
    setInput(cleaned);
    if(!cleaned){setLastMsg("輸入英文單字來剪斷導火線。");return}
    const bad=cleaned.split("").findIndex((ch,i)=>ch!==wordText[i]);
    if(bad>=0)setLastMsg(`第 ${bad+1} 個字母可能不對，先檢查再剪線。`);
    else if(cleaned.length<wordText.length)setLastMsg(`目前正確，還差 ${wordText.length-cleaned.length} 個字母。`);
    else setLastMsg("可以剪線了！");
  };
  const submit=()=>{
    if(phase!=="play"||!input.trim())return;
    const answer=input.trim().toLowerCase();
    setAttempts(n=>n+1);
    if(answer===wordText){
      clearInterval(timerRef.current);setPhase("defused");setScore(s=>s+1);onXp(10);
      setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));if(nc>=3)playSound("combo");else playSound("good");return nc});
      setMissedWords(m=>m.filter(x=>x.w!==cur.w));
      setLastMsg("拆彈成功！");speak(cur.w);
    }else{
      const bad=answer.split("").findIndex((ch,i)=>ch!==wordText[i]);
      const msg=answer.length<wordText.length?`還差 ${wordText.length-answer.length} 個字母。`:bad>=0?`第 ${bad+1} 個字母不對。`:"拼字不對，請再檢查。";
      setWrongSubmits(n=>n+1);setShake(true);setTimeout(()=>setShake(false),400);setTimeLeft(t=>Math.max(1,t-2));setLastMsg(`${msg} 扣 2 秒。`);playSound("bad");setTimeout(()=>inputRef.current?.focus(),80);
    }
  };
  const showHintFn=()=>{
    if(phase!=="play"||!wordText)return;
    const next=Math.min(wordText.length,hintLevel+1);
    setHintLevel(next);setHintCount(n=>n+1);setTimeLeft(t=>Math.max(2,t-2));
    setLastMsg(`提示已開到第 ${next} 個字母，扣 2 秒。`);
    if(next===1)speak(cur.w);else playSound("flip");
    setTimeout(()=>inputRef.current?.focus(),80);
  };
  const finishGame=(celebrate=true)=>{playSound("done");if(celebrate){setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500)}setPhase("done")};
  const retry=()=>{if(lives<=0){finishGame(false);return}setPhase("ready")};
  const next=()=>{
    if(lives<=0&&phase==="explode"){finishGame(false);return}
    if(wi+1>=total){finishGame(phase==="defused");return}
    setWi(w=>w+1);setPhase("ready");
  };
  const restart=async()=>{if(timerRef.current)clearInterval(timerRef.current);setLoading(true);setWi(0);setScore(0);setCombo(0);setMaxCombo(0);setLives(3);setAttempts(0);setWrongSubmits(0);setHintCount(0);setMissedWords([]);setPhase("ready");const cloud=await fetchCloudVocab(lv,TOTAL*4);const picked=pickWhackWords(cloud?.length?cloud:V[lv],TOTAL,lv);setWords(picked.length?picked:pickWhackWords(V[lv],TOTAL,lv));setLoading(false)};

  if(loading)return(<div><Hdr t="💣 拆彈拼字" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入中...</div></div>);
  if(!cur)return(<div><Hdr t="💣 拆彈拼字" onBack={onBack} cl={c.cl}/><div style={{...S.card,padding:"28px 18px",textAlign:"center",color:S.t2}}>目前沒有可練習的單字</div></div>);

  if(phase==="done"){const grade=total?Math.round(score/total*100):0;const review=words.slice(0,total);return(<div>{showConfetti&&<Confetti/>}<Hdr t="💣 拆彈拼字" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"28px 12px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{lives<=0?"💀":grade>=80?"🏆":"🎉"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>{lives<=0?"任務失敗...":"任務完成！"}</h2><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxWidth:420,margin:"16px auto"}}>{[["拆彈",`${score}/${total}`,c.cl],["準確率",`${grade}%`,grade>=80?"#1D9E75":"#EF9F27"],["錯誤",wrongSubmits,"#E24B4A"]].map(([l,v,cl])=><div key={l} style={{...S.card,padding:"12px 8px",textAlign:"center",borderTop:`3px solid ${cl}`}}><div style={{fontSize:22,fontWeight:800,color:cl}}>{v}</div><div style={{fontSize:11,color:S.t3,marginTop:2}}>{l}</div></div>)}</div>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{fontSize:14,color:S.t2,marginTop:8,marginBottom:14}}>送出 {attempts} 次 · 使用提示 {hintCount} 次</div>{missedWords.length>0&&<div style={{...S.card,padding:"12px 14px",textAlign:"left",maxWidth:520,margin:"0 auto 12px"}}><div style={{fontSize:13,fontWeight:700,color:"#E24B4A",marginBottom:8}}>爆炸或未完成的字</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{missedWords.map(w=><button key={w.w} onClick={()=>speak(w.w)} style={{border:`1px solid ${S.bd}`,background:S.bg2,borderRadius:999,padding:"7px 10px",fontSize:12,color:S.t1,cursor:"pointer",fontFamily:"inherit"}}><b>{w.w}</b> · {w.m}</button>)}</div></div>}<div style={{...S.card,padding:"12px 14px",textAlign:"left",maxWidth:520,margin:"0 auto 16px"}}><div style={{fontSize:13,fontWeight:700,color:S.t1,marginBottom:8}}>本輪複習</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>{review.map(w=><button key={w.w} onClick={()=>speak(w.w)} style={{textAlign:"left",border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:12,padding:"9px 10px",fontSize:12,color:S.t2,cursor:"pointer",fontFamily:"inherit",lineHeight:1.45}}><div style={{fontSize:15,fontWeight:800,color:c.cl}}>{w.w}</div><div>{w.m}</div></button>)}</div></div><button onClick={restart} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 再玩一次</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}

  const completed=phase==="defused"||phase==="explode"?wi+1:wi;
  const pct=Math.round((completed/Math.max(total,1))*100);
  const urgency=timeLeft<=3?"#E24B4A":timeLeft<=6?"#EF9F27":"#1D9E75";
  const fusePercent=(timeLeft/BOMB_TIME)*100;
  const comboLabel=combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";

  return(<div><Hdr t="💣 拆彈拼字" onBack={onBack} cl={c.cl}/>
    <style>{`@keyframes fuseBurn{0%,100%{opacity:1;text-shadow:0 0 6px #ff6600}50%{opacity:.6;text-shadow:0 0 12px #ff3300}}@keyframes bombTick{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}@keyframes explodeShake{0%,100%{transform:translate(0)}10%{transform:translate(-8px,4px)}30%{transform:translate(6px,-4px)}50%{transform:translate(-4px,6px)}70%{transform:translate(4px,-2px)}}`}</style>
    {/* Progress + Lives */}
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6,fontSize:12}}>
      <div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3,transition:"width .3s"}}/></div>
      <span style={{color:S.t3}}>{wi+1}/{total}</span>
      <span style={{fontSize:14}}>{"❤️".repeat(lives)}{"🖤".repeat(Math.max(0,3-lives))}</span>
    </div>
    {comboLabel&&<div style={{textAlign:"center",fontSize:14,fontWeight:700,color:"#EF9F27",marginBottom:4,animation:"comboFlash .5s"}}>{comboLabel}</div>}

    {/* Bomb card */}
    <div style={{...S.card,padding:0,marginBottom:12,animation:shake?"moleShake .4s":phase==="explode"?"explodeShake .5s":"none",overflow:"hidden"}}>
      {/* Fuse wire */}
      <div style={{position:"relative",height:28,background:`linear-gradient(90deg,${S.bg2} ${100-fusePercent}%,transparent ${100-fusePercent}%)`,borderBottom:`1px solid ${S.bd}`,overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,height:"100%",width:`${fusePercent}%`,background:"linear-gradient(90deg,#555 60%,#FF6600 85%,#FF3300)",transition:"width .8s linear",borderRadius:"0 4px 4px 0"}}/>
        {phase==="play"&&<div style={{position:"absolute",top:2,left:`${Math.max(fusePercent-3,0)}%`,fontSize:18,animation:"fuseBurn .4s infinite",transition:"left .8s linear"}}>🔥</div>}
      </div>

      <div style={{padding:"22px 18px",textAlign:"center"}}>
        {/* Bomb + Timer */}
        <div style={{fontSize:phase==="explode"?80:60,animation:phase==="play"&&timeLeft<=5?"bombTick .3s infinite":phase==="defused"?"bounceIn .5s":"none",transition:"font-size .3s"}}>{phase==="explode"?"💥":phase==="defused"?"✅":"💣"}</div>
        {phase==="play"&&<div style={{fontSize:40,fontWeight:700,color:urgency,fontFamily:"monospace",marginTop:4,animation:timeLeft<=3?"emojiPulse .4s infinite":"none"}}>{timeLeft}</div>}

        {/* Clue */}
        <div style={{fontSize:14,color:c.cl,fontWeight:600,marginTop:10}}>✂️ 拼出正確的字來剪斷導火線！</div>
        <div style={{fontSize:30,fontWeight:700,color:S.t1,marginTop:8}}>{cur.m}</div>
        <div style={{fontSize:14,color:S.t2,marginTop:2}}>{cur.p}</div>
        <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",marginTop:10}}>
          <div style={{padding:"7px 12px",borderRadius:999,background:S.bg2,color:prefixOk?c.cl:"#E24B4A",fontSize:13,fontWeight:800}}>輸入 {typedCount}/{wordText.length}</div>
          <div style={{padding:"7px 12px",borderRadius:999,background:S.bg2,color:urgency,fontSize:13,fontWeight:800}}>剩 {timeLeft}s</div>
          <div style={{padding:"7px 12px",borderRadius:999,background:S.bg2,color:wrongSubmits?"#E24B4A":S.t3,fontSize:13,fontWeight:800}}>錯誤 {wrongSubmits}</div>
        </div>
        {/* Hint area */}
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8,flexWrap:"wrap"}}>
          <button onClick={()=>speak(cur.w)} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:12,padding:"6px 14px",fontSize:13,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>🔊 聽發音</button>
          {phase==="play"&&<button onClick={showHintFn} disabled={hintLevel>=wordText.length} style={{background:hintLevel<wordText.length?"#FFF3CD":S.bg2,border:`1px solid ${S.bd}`,borderRadius:12,padding:"6px 14px",fontSize:13,cursor:hintLevel<wordText.length?"pointer":"default",color:hintLevel<wordText.length?"#8A5A00":S.t3,fontFamily:"inherit",opacity:hintLevel<wordText.length?1:.55}}>💡 提示</button>}
        </div>
        {lastMsg&&<div style={{marginTop:8,fontSize:12,color:prefixOk?S.t2:"#E24B4A",minHeight:18,fontWeight:prefixOk?500:700}}>{lastMsg}</div>}

        {/* Letter slots */}
        {phase==="play"&&<div style={{display:"flex",justifyContent:"center",gap:4,marginTop:10,flexWrap:"wrap"}}>
          {wordText.split("").map((l,i)=>{const typed=input[i];const wrong=typed&&typed!==l;const hinted=!typed&&i<hintLevel;return(<div key={i} style={{width:30,height:34,borderRadius:7,border:`2px solid ${wrong?"#E24B4A":typed?c.cl:hinted?"#EF9F27":S.bd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:wrong?"#E24B4A":typed?c.cl:hinted?"#8A5A00":S.t3,background:wrong?"#FCEBEB":typed?c.bg:hinted?"#FFF3CD":S.bg2,transition:"all .15s",animation:wrong?"moleShake .25s":"none"}}>{typed?typed.toUpperCase():hinted?l.toUpperCase():"·"}</div>)})}
        </div>}

        {/* Input */}
        {phase==="play"&&<div style={{marginTop:12}}>
          <input ref={inputRef} value={input} onChange={e=>handleInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submit()}} placeholder="輸入英文單字..." autoComplete="off" autoCapitalize="off" spellCheck="false" style={{width:"100%",maxWidth:300,padding:"14px 16px",borderRadius:14,border:`2px solid ${prefixOk?urgency:"#E24B4A"}`,fontSize:18,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",textAlign:"center",fontWeight:700,letterSpacing:0}}/>
          <div style={{marginTop:10}}><button onClick={submit} disabled={!input.trim()} style={{...S.btn,background:prefixOk?urgency:"#E24B4A",color:"#fff",padding:"12px 32px",fontSize:16,opacity:input.trim()?1:.4}}>✂️ 剪線拆彈！</button></div>
        </div>}

        {/* Result */}
        {phase==="defused"&&<div style={{marginTop:12,animation:"fadeUp .3s"}}><div style={{fontSize:20,fontWeight:700,color:"#1D9E75"}}>✅ 成功拆彈！</div><div style={{fontSize:22,color:c.cl,marginTop:4,fontWeight:800}}>{cur.w}</div><div style={{fontSize:13,color:S.t2,marginTop:2}}>{cur.m}</div></div>}
        {phase==="explode"&&<div style={{marginTop:12,animation:"fadeUp .3s"}}><div style={{fontSize:20,fontWeight:700,color:"#E24B4A"}}>💥 爆炸了！</div><div style={{fontSize:16,color:S.t1,marginTop:4}}>正確答案：<b style={{color:c.cl,fontSize:20}}>{cur.w}</b></div><div style={{fontSize:13,color:S.t2,marginTop:2}}>{cur.m}</div></div>}
      </div>
    </div>

    {(phase==="defused"||phase==="explode")&&<div style={{textAlign:"center",display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap"}}>{phase==="explode"&&lives>0&&<button onClick={retry} style={{...S.btn,background:S.bg2,color:S.t1,padding:"12px 20px",fontSize:15}}>再試一次此字</button>}<button onClick={next} style={{...S.btn,background:c.cl,color:"#fff",padding:"12px 28px",fontSize:15}}>{lives<=0&&phase==="explode"?"💀 遊戲結束":wi+1>=total?"🏁 看成績":"▶ 下一顆炸彈"}</button></div>}
  </div>);
}

// ═══ QUIZ ═══════════════════════════════════════════════════════════
function QuizM({lv,onBack,onXp,onPerfect,trackWeak}){
  const built=V[lv];const c=LV[lv];const QUIZ_SIZE=10;
  const[words,setWords]=useState(built);const[loading,setLoading]=useState(true);const[mode,setMode]=useState("en2zh");
  const[session,setSession]=useState(0);const[qi,setQi]=useState(0);const[score,setScore]=useState(0);const[sel,setSel]=useState(null);const[done,setDone]=useState(false);
  const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);const[showConfetti,setShowConfetti]=useState(false);const[review,setReview]=useState([]);
  useEffect(()=>{let active=true;setLoading(true);setWords(built);setQi(0);setScore(0);setSel(null);setDone(false);setReview([]);setCombo(0);setMaxCombo(0);(async()=>{const cloud=await fetchCloudVocab(lv,30);if(active&&cloud?.length)setWords(cloud);if(active)setLoading(false)})();return()=>{active=false}},[lv,built]);
  const buildQuestion=(w,i,kind)=>{
    const askEn=kind==="en2zh";
    const others=shuffleCopy(words.filter((_,j)=>j!==i)).slice(0,3);
    return{item:w,kind,prompt:askEn?w.w:w.m,answer:askEn?w.m:w.w,opts:shuffleCopy([...others.map(x=>askEn?x.m:x.w),askEn?w.m:w.w])};
  };
  const qs=useMemo(()=>{
    const usable=words.filter(w=>w?.w&&w?.m);
    return shuffleCopy(usable).slice(0,Math.min(QUIZ_SIZE,usable.length)).map((w,i)=>{
      const realIdx=words.indexOf(w);
      const kind=mode==="mix"?(i%2===0?"en2zh":"zh2en"):mode;
      return buildQuestion(w,realIdx>=0?realIdx:i,kind);
    });
  },[words,mode,session]);
  const resetQuiz=(nextMode=mode)=>{setMode(nextMode);setSession(s=>s+1);setQi(0);setScore(0);setSel(null);setDone(false);setCombo(0);setMaxCombo(0);setReview([]);setShowConfetti(false)};
  const finish=(finalScore)=>{setDone(true);if(finalScore>=qs.length)onPerfect?.();playSound("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500)};
  const pick=o=>{if(sel!==null||!qs.length)return;const q=qs[qi];setSel(o);const ok=o===q.answer;const nextScore=score+(ok?1:0);
    if(ok){setScore(nextScore);onXp?.(10);playSound("good");setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));return nc})}
    else{trackWeak?.(q.item.w);setReview(r=>r.some(x=>x.item.w===q.item.w)?r:[...r,{...q,picked:o}]);playSound("bad");setCombo(0)}
  };
  const next=()=>{setSel(null);if(qi+1>=qs.length)finish(score);else setQi(q=>q+1)};
  const comboLabel=combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";
  if(loading)return(<div><Hdr t="📝 單字測驗" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px 16px",color:S.t3,fontSize:14}}>載入中...</div></div>);
  if(!qs.length)return(<div><Hdr t="📝 單字測驗" onBack={onBack} cl={c.cl}/><div style={{...S.card,padding:"28px 18px",textAlign:"center",color:S.t2}}>目前沒有可測驗的單字</div></div>);
  if(done){const pct=Math.round((score/qs.length)*100);return(<div>{showConfetti&&<Confetti/>}<Hdr t="📝 單字測驗" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"30px 14px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{pct>=90?"🏆":pct>=70?"🎉":pct>=50?"👏":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>測驗完成！</h2><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxWidth:420,margin:"16px auto"}}>{[["答對",`${score}/${qs.length}`,c.cl],["掌握率",`${pct}%`,pct>=80?"#1D9E75":"#EF9F27"],["待複習",review.length,"#E24B4A"]].map(([l,v,cl])=><div key={l} style={{...S.card,padding:"12px 8px",borderTop:`3px solid ${cl}`}}><div style={{fontSize:22,fontWeight:800,color:cl}}>{v}</div><div style={{fontSize:11,color:S.t3,marginTop:2}}>{l}</div></div>)}</div>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{fontSize:14,color:S.t2,margin:"8px 0 14px"}}>{pct>=90?"單字掌握度很好，可以挑戰反向測驗。":pct>=70?"不錯，建議把錯題再聽一次。":"先從錯題複習開始，再測一輪。"}</div>{review.length>0&&<div style={{...S.card,padding:"12px 14px",maxWidth:560,margin:"0 auto 14px",textAlign:"left"}}><div style={{fontSize:13,fontWeight:800,color:"#E24B4A",marginBottom:8}}>錯題複習</div><div style={{display:"grid",gap:7}}>{review.map(r=><button key={`${r.item.w}-${r.kind}`} onClick={()=>speak(r.item.w)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:12,padding:"9px 11px",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}><div style={{fontSize:15,fontWeight:900,color:S.t1}}>{r.item.w} <span style={{fontSize:12,color:S.t3,fontWeight:600}}>{r.item.ph||""}</span></div><div style={{fontSize:12,color:S.t2,marginTop:2}}>正解：{r.item.m} · 你的答案：{r.picked}</div></button>)}</div></div>}<button onClick={()=>resetQuiz(mode)} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>再測一次</button><button onClick={()=>resetQuiz(mode==="en2zh"?"zh2en":"en2zh")} style={{...S.btn,background:S.bg2,color:S.t1,marginRight:8,fontSize:14}}>切換方向</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}
  const q=qs[qi];
  const progressPct=((qi+(sel!==null?1:0))/qs.length)*100;
  return(<div><Hdr t="📝 單字測驗" onBack={onBack} cl={c.cl}/>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,fontSize:12}}><div style={{flex:1,height:7,background:S.bg2,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${progressPct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:999,transition:"width .3s"}}/></div><span style={{color:S.t3,minWidth:44,textAlign:"right"}}>{qi+1}/{qs.length}</span><span style={{color:"#1D9E75",fontWeight:800,minWidth:32,textAlign:"right"}}>{score}✓</span></div>
    <div style={{display:"flex",gap:6,marginBottom:8,overflowX:"auto",paddingBottom:2}}>{[{k:"en2zh",l:"英選中"},{k:"zh2en",l:"中選英"},{k:"mix",l:"混合"}].map(m=><button key={m.k} onClick={()=>resetQuiz(m.k)} style={{flexShrink:0,padding:"7px 11px",borderRadius:999,border:"none",background:mode===m.k?c.cl:S.bg2,color:mode===m.k?"#fff":S.t2,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{m.l}</button>)}</div>
    {comboLabel&&<div style={{textAlign:"center",fontSize:14,fontWeight:700,color:"#EF9F27",marginBottom:4,animation:"comboFlash .5s"}}>{comboLabel}</div>}
    <div style={{...S.card,padding:"22px 18px",textAlign:"center",borderTop:`4px solid ${c.cl}`}}>
      <div style={{fontSize:12,color:S.t3,marginBottom:6}}>{q.kind==="en2zh"?"選出正確中文意思":"選出正確英文單字"}</div>
      <div style={{fontSize:q.kind==="en2zh"?36:24,fontWeight:900,color:S.t1,lineHeight:1.35,animation:"fadeUp .3s"}}>{q.prompt}</div>
      <div style={{fontSize:13,color:S.t3,marginTop:5,minHeight:18}}>{q.kind==="en2zh"?q.item.ph:""}</div>
      <button onClick={()=>speak(q.item.w)} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:999,fontSize:13,cursor:"pointer",margin:"10px 0 14px",padding:"7px 12px",fontFamily:"inherit",color:S.t2}}>🔊 {q.kind==="en2zh"?"聽單字":"聽正解"}</button>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>{q.opts.map((o,i)=>{const ok=o===q.answer,pk=sel===o;let bg=S.bg2,bd=`1px solid ${S.bd}`,cl=S.t1,anim="";if(sel!==null){if(ok){bg="#E1F5EE";bd="2px solid #1D9E75";cl="#146B45";anim="bounceIn .3s"}else if(pk){bg="#FCEBEB";bd="2px solid #E24B4A";cl="#A12F2F";anim="moleShake .3s"}}return<button key={i} onClick={()=>pick(o)} disabled={sel!==null} style={{padding:"14px 12px",borderRadius:14,background:bg,border:bd,cursor:sel!==null?"default":"pointer",fontSize:14,fontFamily:"inherit",color:cl,fontWeight:sel!==null&&ok?900:700,transition:"all .15s",animation:anim,minHeight:54,WebkitTapHighlightColor:"transparent",textAlign:"left",display:"flex",gap:9,alignItems:"center"}} onTouchStart={e=>{if(sel===null)e.currentTarget.style.transform="scale(0.95)"}} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}><span style={{width:24,height:24,borderRadius:"50%",background:sel!==null&&ok?"#1D9E75":S.bg1,color:sel!==null&&ok?"#fff":S.t3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,flexShrink:0}}>{String.fromCharCode(65+i)}</span><span>{o}</span></button>})}</div>
      {sel!==null&&<div style={{marginTop:12,padding:"11px 12px",borderRadius:12,background:sel===q.answer?"#E1F5EE":"#FFF3CD",fontSize:13,color:S.t2,lineHeight:1.65,textAlign:"left"}}><div style={{fontWeight:900,color:sel===q.answer?"#1D9E75":"#E24B4A",marginBottom:3}}>{sel===q.answer?"答對了":"答錯了"}</div><div><b style={{color:S.t1}}>{q.item.w}</b>{q.item.ph?` ${q.item.ph}`:""} · {q.item.m}</div>{q.item.ex&&<div style={{marginTop:4,color:S.t2}}>例句：{q.item.ex}</div>}</div>}
      {sel!==null&&<button onClick={next} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"12px",fontSize:14,marginTop:12}}>{qi+1>=qs.length?"看成績":"下一題"}</button>}
    </div>
  </div>);
}
// ═══ DICTATION ══════════════════════════════════════════════════════
function DictM({lv,onBack,onXp,onDone}){
  const sents=DICT[lv];const c=LV[lv];
  const[qi,setQi]=useState(0);const[inp,setInp]=useState("");const[result,setResult]=useState(null);const[score,setScore]=useState(0);const[done,setDone]=useState(false);
  const current=sents[qi];
  useEffect(()=>{if(!done&&!result){const t=speechTimer(()=>speak(current,undefined,0.75),300);return()=>clearTimeout(t)}},[qi,result]);
  const check=()=>{if(!inp.trim())return;const clean=s=>s.toLowerCase().replace(/[^a-z0-9\s]/g,"").trim();const correct=clean(current)===clean(inp);if(correct){setScore(s=>s+1);onXp(10)}setResult(correct)};
  const next=()=>{setResult(null);setInp("");if(qi+1>=sents.length){setDone(true);onDone()}else setQi(qi+1)};
  if(done){const pct=Math.round((score/sents.length)*100);return(<div><Hdr t="🎧 聽寫訓練" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{pct>=80?"🏆":pct>=60?"🎉":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>聽寫完成！</h2><div style={{fontSize:18,color:c.cl,fontWeight:600,marginTop:6}}>{score}/{sents.length} 正確 ({pct}%)</div><div style={{fontSize:14,color:S.t2,marginTop:8,marginBottom:16}}>{pct>=80?"聽力超棒！🌟":"多聽幾次會更好！💪"}</div><button onClick={()=>{setQi(0);setInp("");setResult(null);setScore(0);setDone(false)}} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 再練</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}
  return(<div><Hdr t="🎧 聽寫訓練" onBack={onBack} cl={c.cl}/><PB v={qi} mx={sents.length} cl={c.cl}/>
    <div style={{...S.card,padding:"28px 20px",textAlign:"center"}}>
      <div style={{fontSize:14,color:S.t3,marginBottom:14}}>仔細聽，然後打出你聽到的英文句子</div>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16}}>
        <button onClick={()=>speak(current,"en-US",0.6)} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:12,padding:"8px 14px"}}>🐢 慢速</button>
        <button onClick={()=>speak(current,"en-US",0.85)} style={{...S.btn,background:c.cl,color:"#fff",fontSize:12,padding:"8px 14px"}}>🔊 正常</button>
        <button onClick={()=>speak(current,"en-US",1.1)} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:12,padding:"8px 14px"}}>🐇 快速</button>
      </div>
      <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(result===null?check():next())} placeholder="在這裡打出你聽到的..." disabled={result!==null} style={{width:"100%",padding:"14px 16px",borderRadius:12,border:`2px solid ${result===null?S.bd:result?"#639922":"#E24B4A"}`,fontSize:16,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",textAlign:"center"}}/>
      {result===null?
        <button onClick={check} disabled={!inp.trim()} style={{...S.btn,background:c.cl,color:"#fff",marginTop:12,opacity:inp.trim()?1:.5}}>送出答案</button>:
        <div style={{marginTop:12}}>
          <div style={{fontSize:16,fontWeight:600,color:result?"#1D9E75":"#E24B4A",animation:result?"bounceIn .3s":"moleShake .3s"}}>{result?"✅ 正確！太棒了！":"❌ 不太對..."}</div>
          {!result&&<div style={{fontSize:13,color:S.t1,marginTop:6,padding:"8px 12px",background:"#EAF3DE",borderRadius:8}}>正確答案：{current}</div>}
          <button onClick={next} style={{...S.btn,background:c.cl,color:"#fff",marginTop:10,fontSize:12}}>下一題 →</button>
        </div>
      }
    </div>
  </div>);
}
// ═══ SENTENCE SCRAMBLE (句子重組 v2) ═══════════════════════════════
function ScramM({lv,onBack,onXp,onDone}){
  const data=SCRAM[lv];const c=LV[lv];
  const[qi,setQi]=useState(0);const[selected,setSelected]=useState([]);const[pool,setPool]=useState([]);
  const[result,setResult]=useState(null);const[score,setScore]=useState(0);const[done,setDone]=useState(false);
  const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);
  const[showConfetti,setShowConfetti]=useState(false);const[hintCount,setHintCount]=useState(0);
  const[attempts,setAttempts]=useState(0);const[wrongReview,setWrongReview]=useState([]);

  const current=data[qi]||data[0];
  const correctWords=useMemo(()=>String(current?.s||"").split(" ").filter(Boolean),[current]);
  const shuffleItems=useCallback((words)=>{
    const base=words.map((w,i)=>({w,id:`${i}-${w}`}));
    let out=shuffleCopy(base);
    if(out.map(x=>x.w).join(" ")===words.join(" ")&&out.length>1)out=[...out.slice(1),out[0]];
    return out;
  },[]);
  const setupQuestion=useCallback((idx)=>{
    const words=String(data[idx]?.s||"").split(" ").filter(Boolean);
    setPool(shuffleItems(words));setSelected([]);setResult(null);setHintCount(0);setAttempts(0);
  },[data,shuffleItems]);
  useEffect(()=>{if(qi<data.length)setupQuestion(qi)},[qi,setupQuestion,data.length]);

  const selectedText=selected.map(x=>x.w).join(" ");
  const positionRows=correctWords.map((word,i)=>({word,got:selected[i]?.w||"",ok:selected[i]?.w?.toLowerCase()===word.toLowerCase()}));
  const nextSlot=selected.length;
  const canEdit=result!==true;
  const tapPool=(item)=>{if(!canEdit)return;playSound("flip");setResult(null);setPool(p=>p.filter(x=>x.id!==item.id));setSelected(s=>[...s,item])};
  const tapSel=(item)=>{if(!canEdit)return;playSound("flip");setResult(null);setSelected(s=>s.filter(x=>x.id!==item.id));setPool(p=>[...p,item])};
  const undoLast=()=>{if(!canEdit||!selected.length)return;const last=selected[selected.length-1];setResult(null);setSelected(s=>s.slice(0,-1));setPool(p=>[last,...p]);playSound("flip")};
  const clearAll=()=>{if(!canEdit||!selected.length)return;setResult(null);setPool(p=>[...p,...selected]);setSelected([]);playSound("flip")};
  const showHint=()=>{
    if(!canEdit||selected.length>=correctWords.length)return;
    const target=correctWords[selected.length];
    const inPool=pool.find(x=>x.w.toLowerCase()===target.toLowerCase());
    setHintCount(n=>n+1);
    if(inPool){tapPool(inPool);speak(target,"en-US",0.85)}
    else speak(current.s,"en-US",0.85);
  };
  const revise=()=>{setResult(null);playSound("flip")};

  const check=()=>{
    if(selected.length<correctWords.length)return;
    const ok=selectedText.toLowerCase()===current.s.toLowerCase();
    setAttempts(n=>n+1);setResult(ok);
    if(ok){
      if(attempts===0)setScore(s=>s+1);
      onXp(hintCount?5:10);playSound("good");
      setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));if(nc>=3)playSound("combo");return nc});
      speak(current.s,"en-US",0.88);
    }else{
      setWrongReview(r=>r.some(x=>x.s===current.s)?r:[...r,current]);
      playSound("bad");setCombo(0);
    }
  };

  const next=()=>{
    if(qi+1>=data.length){
      setDone(true);onDone?.();playSound("done");
      setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500);
    }else setQi(qi+1)
  };
  const restart=()=>{setQi(0);setScore(0);setDone(false);setCombo(0);setMaxCombo(0);setWrongReview([]);setShowConfetti(false);setupQuestion(0)};

  if(done){const pct=Math.round((score/data.length)*100);return(<div>{showConfetti&&<Confetti/>}<Hdr t="🧩 句子重組" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"30px 14px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{pct>=80?"🏆":pct>=60?"🎉":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>重組完成！</h2><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxWidth:420,margin:"16px auto"}}>{[["正確",`${score}/${data.length}`,c.cl],["掌握率",`${pct}%`,pct>=80?"#1D9E75":"#EF9F27"],["待複習",wrongReview.length,"#E24B4A"]].map(([l,v,cl])=><div key={l} style={{...S.card,padding:"12px 8px",borderTop:`3px solid ${cl}`}}><div style={{fontSize:22,fontWeight:800,color:cl}}>{v}</div><div style={{fontSize:11,color:S.t3,marginTop:2}}>{l}</div></div>)}</div>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{fontSize:14,color:S.t2,margin:"8px 0 14px"}}>{pct>=80?"語序感很好，可以進入閱讀或造句練習。":"建議先看中文意思，再找主詞、動詞、地點或時間。"}</div>{wrongReview.length>0&&<div style={{...S.card,padding:"12px 14px",maxWidth:560,margin:"0 auto 14px",textAlign:"left"}}><div style={{fontSize:13,fontWeight:800,color:"#E24B4A",marginBottom:8}}>錯句複習</div><div style={{display:"grid",gap:7}}>{wrongReview.map(x=><button key={x.s} onClick={()=>speak(x.s,"en-US",0.88)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:12,padding:"9px 11px",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}><div style={{fontSize:14,fontWeight:800,color:S.t1}}>{x.s}</div><div style={{fontSize:12,color:S.t2,marginTop:2}}>{x.h} · 點擊聽發音</div></button>)}</div></div>}<button onClick={restart} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 再練</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}

  const comboLabel=combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";
  const wordCount=correctWords.length;
  const progressPct=((qi+(result===true?1:0))/data.length)*100;

  return(<div><Hdr t="🧩 句子重組" onBack={onBack} cl={c.cl}/>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,fontSize:12}}>
      <div style={{flex:1,height:7,background:S.bg2,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${progressPct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:999,transition:"width .3s"}}/></div>
      <span style={{color:S.t3,minWidth:44,textAlign:"right"}}>{qi+1}/{data.length}</span>
      <span style={{color:"#1D9E75",fontWeight:800,minWidth:32,textAlign:"right"}}>{score}✓</span>
    </div>
    {comboLabel&&<div style={{textAlign:"center",fontSize:14,fontWeight:700,color:"#EF9F27",marginBottom:6,animation:"comboFlash .5s"}}>{comboLabel}</div>}

    <div style={{...S.card,padding:"18px 16px",borderTop:`4px solid ${c.cl}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:13}}>
        <div style={{minWidth:0}}><div style={{fontSize:12,color:S.t3,marginBottom:4}}>把單字排成自然英文句子</div><div style={{fontSize:19,fontWeight:800,color:S.t1,lineHeight:1.45}}>💡 {current.h}</div></div>
        <div style={{display:"flex",gap:5,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}><span style={{fontSize:11,color:S.t3,background:S.bg2,borderRadius:999,padding:"5px 8px"}}>{wordCount} words</span><span style={{fontSize:11,color:S.t3,background:S.bg2,borderRadius:999,padding:"5px 8px"}}>提示 {hintCount}</span></div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(wordCount,6)}, minmax(38px,1fr))`,gap:5,marginBottom:8}}>
        {correctWords.map((_,i)=><div key={i} style={{height:6,borderRadius:999,background:i<selected.length?c.cl:i===nextSlot?`${c.cl}66`:S.bd,transition:"background .15s"}}/> )}
      </div>

      <div style={{minHeight:72,padding:"12px 10px",background:result===null?"linear-gradient(135deg,"+S.bg2+","+c.bg+"11)":result?"linear-gradient(135deg,#E1F5EE,#E8F5E9)":"linear-gradient(135deg,#FCEBEB,#FFF3CD)",borderRadius:14,display:"flex",flexWrap:"wrap",gap:7,marginBottom:8,border:`2px ${result===null?"dashed":"solid"} ${result===null?c.cl+"44":result?"#1D9E75":"#E24B4A"}`,transition:"all .3s",alignItems:"center",justifyContent:selected.length===0?"center":"flex-start"}}>
        {selected.length===0&&<span style={{color:S.t3,fontSize:13}}>點下面單字，依序放到這裡</span>}
        {selected.map((item,i)=>{const ok=result===false?item.w.toLowerCase()===correctWords[i]?.toLowerCase():null;return <button key={item.id} onClick={()=>tapSel(item)} style={{padding:"10px 14px",borderRadius:11,background:result===true?"#1D9E75":result===false?(ok?"#1D9E75":"#E24B4A"):c.cl,color:"#fff",border:"none",fontSize:15,cursor:canEdit?"pointer":"default",fontFamily:"inherit",fontWeight:800,animation:"fadeUp .2s",animationDelay:`${i*0.03}s`,animationFillMode:"both",boxShadow:`0 2px 6px ${c.cl}25`,WebkitTapHighlightColor:"transparent"}}>{item.w}</button>})}
      </div>

      {selected.length>0&&result!==true&&<div style={{display:"flex",gap:7,justifyContent:"flex-end",marginBottom:10,flexWrap:"wrap"}}>
        <button onClick={undoLast} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:999,fontSize:12,color:S.t2,cursor:"pointer",padding:"6px 10px",fontFamily:"inherit"}}>↶ 撤銷</button>
        <button onClick={clearAll} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:999,fontSize:12,color:S.t2,cursor:"pointer",padding:"6px 10px",fontFamily:"inherit"}}>清空</button>
      </div>}

      <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:14,minHeight:pool.length>0?52:0,transition:"min-height .3s"}}>
        {pool.map(item=>(<button key={item.id} onClick={()=>tapPool(item)} style={{padding:"11px 16px",borderRadius:12,background:S.bg1,color:S.t1,border:`2px solid ${S.bd}`,fontSize:15,cursor:canEdit?"pointer":"default",fontFamily:"inherit",fontWeight:700,transition:"all .15s",boxShadow:"0 2px 4px rgba(0,0,0,.04)",WebkitTapHighlightColor:"transparent"}} onTouchStart={e=>{if(canEdit)e.currentTarget.style.transform="scale(0.92)"}} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>{item.w}</button>))}
      </div>

      {selected.length>0&&<div style={{display:"grid",gap:5,marginBottom:14}}>
        {positionRows.slice(0,selected.length).map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:S.t2,background:S.bg2,borderRadius:10,padding:"6px 9px"}}><span style={{width:22,height:22,borderRadius:"50%",background:result===false?(r.ok?"#E1F5EE":"#FCEBEB"):c.bg,color:result===false?(r.ok?"#1D9E75":"#E24B4A"):c.cl,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,flexShrink:0}}>{i+1}</span><span style={{fontWeight:800,color:S.t1}}>{r.got}</span>{result===false&&<span style={{marginLeft:"auto",color:r.ok?"#1D9E75":"#E24B4A",fontWeight:800}}>{r.ok?"正確":`應為 ${r.word}`}</span>}</div>)}
      </div>}

      {result===null?(<div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
        <button onClick={showHint} disabled={selected.length>=wordCount} style={{...S.btn,background:S.bg2,color:S.t2,padding:"10px 16px",fontSize:13,borderRadius:14,opacity:selected.length>=wordCount?0.45:1}}>💡 補下一格</button>
        <button onClick={()=>speak(current.s,"en-US",0.88)} style={{...S.btn,background:S.bg2,color:S.t1,padding:"10px 16px",fontSize:13,borderRadius:14}}>🔊 聽整句</button>
        <button onClick={check} disabled={pool.length>0} style={{...S.btn,background:c.cl,color:"#fff",padding:"10px 24px",fontSize:14,opacity:pool.length>0?0.4:1,borderRadius:14}}>檢查答案</button>
      </div>):(
      <div style={{textAlign:"center",animation:"fadeUp .3s"}}>
        <div style={{fontSize:18,fontWeight:800,color:result?"#1D9E75":"#E24B4A",marginBottom:7,animation:result?"bounceIn .3s":"moleShake .3s"}}>{result?"語序正確":"順序還可以調整"}</div>
        {!result&&<div style={{marginBottom:10}}><div style={{fontSize:12,color:S.t3,marginBottom:4}}>正確語序：</div><div style={{fontSize:15,color:S.t1,padding:"10px 14px",background:"#E1F5EE",borderRadius:12,display:"inline-block",fontWeight:800,lineHeight:1.5}}>{current.s}</div></div>}
        <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>{!result&&<button onClick={revise} style={{...S.btn,background:"#FAEEDA",color:"#8A5A00",fontSize:13,padding:"10px 16px",borderRadius:14}}>修改答案</button>}<button onClick={()=>speak(current.s,"en-US",0.88)} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:13,padding:"10px 16px",borderRadius:14}}>聽整句</button><button onClick={next} style={{...S.btn,background:c.cl,color:"#fff",fontSize:14,padding:"10px 22px",borderRadius:14}}>{qi+1>=data.length?"看成績":"下一題"}</button></div>
      </div>)}
    </div>
  </div>);
}
// ═══ GRAMMAR (文法學堂 v3) ═══════════════════════════════════════════
const GRAMMAR_GUIDES={
  "Be 動詞":{zh:"用 be 動詞說明身分、狀態或位置。重點是主詞要搭配正確的 am / are / is。",pattern:"I am · you/we/they are · he/she/it is",tips:["先找主詞","單數用 is","you 和複數用 are"],mistake:"不要看到中文「是」就選 be，句子裡通常要用 am / is / are。"},
  "現在簡單式":{zh:"描述習慣、每天會做的事或一般事實。主詞是 he / she / it 時，動詞通常要加 s 或 es。",pattern:"I/You/We/They + V · He/She/It + Vs/Ves",tips:["找主詞","看是不是每天或習慣","第三人稱單數加 s/es"],mistake:"She / He 後面不要直接用原形動詞。"},
  "現在進行式":{zh:"表示現在正在發生的動作，常和 now 搭配。",pattern:"am / is / are + V-ing",tips:["看到 now 先想進行式","先選對 be 動詞","動詞改成 V-ing"],mistake:"不能只寫 V-ing，前面還需要 be 動詞。"},
  "There is / There are":{zh:"用來表示某個地方「有」什麼東西。後面的名詞決定 is 或 are。",pattern:"There is + 單數 · There are + 複數",tips:["看 There 後面的名詞","單數用 is","複數用 are"],mistake:"這個句型不是用 has / have 開頭。"},
  "名詞單複數":{zh:"數量超過一個時，名詞通常要變複數。很多字加 s，但也有 es 或特殊變化。",pattern:"one box · three boxes · one child · two children",tips:["先看數量","大多數加 s","s/x/ch/sh 結尾常加 es"],mistake:"box 的複數是 boxes，不是 boxs。"},
  "代名詞":{zh:"代名詞會因位置改變。當作主詞用 I/he/she；當作受詞用 me/him/her。",pattern:"主詞: I/he/she · 受詞: me/him/her",tips:["看空格在動詞前或後","動詞後常用受詞","所有格才用 my/his/her"],mistake:"Give 後面接人時要用 me，不是 I。"},
  "現在完成式":{zh:"表示到現在為止的經驗、持續或剛完成的事情。",pattern:"have / has + p.p.",tips:["看到 for/since/twice/ever 可想完成式","he/she/it 用 has","動詞要改過去分詞"],mistake:"has 後面不是接過去式 went，而是 p.p. been/gone。"},
  "被動語態":{zh:"當重點是東西被做了什麼，而不是誰做的，就常用被動語態。",pattern:"be + p.p. + by 人",tips:["找被做的主詞","看時態選 be 動詞","主要動詞用 p.p."],mistake:"The cake was baked 才是蛋糕被烤，不是 cake baked。"},
  "關係代名詞":{zh:"用 who / which / that 連接名詞和補充說明。人常用 who，物常用 which。",pattern:"人 + who/that · 物 + which/that",tips:["先看前面的名詞","人用 who","物或事情用 which"],mistake:"what 不是用來直接修飾前面的名詞。"},
  "不定詞 vs 動名詞":{zh:"有些動詞後面習慣接 to V，有些接 V-ing。enjoy 後面要接 V-ing。",pattern:"want to V · enjoy V-ing",tips:["先看前面的動詞","enjoy 後接 V-ing","want 後接 to V"],mistake:"enjoy to swim 不自然，應該說 enjoy swimming。"},
  "連接詞":{zh:"連接詞表示兩個句子之間的關係。because 是原因，although 是雖然，if 是如果。",pattern:"Although + 讓步 · Because + 原因 · If + 條件",tips:["看前後句意思","相反轉折用 although","原因用 because"],mistake:"Although 已有雖然，不要再加 but。"},
  "比較級與最高級":{zh:"比較兩個用比較級；三個以上或 ever 常用最高級。",pattern:"taller than · the best · the most important",tips:["看到 than 想比較級","看到 ever 或 the 想最高級","good 的最高級是 best"],mistake:"good 的最高級不是 most good。"},
  "假設語氣（現在）":{zh:"描述和現在事實相反或不太可能的想像。be 動詞常用 were。",pattern:"If + 過去式, would + 原形動詞",tips:["看到 would 想假設語氣","If 子句用過去式","I/he/she 也常用 were"],mistake:"If I were you 是固定常見用法。"},
  "假設語氣（過去）":{zh:"描述和過去事實相反的想像，表示如果當時怎樣，結果就會不同。",pattern:"If + had p.p., would have + p.p.",tips:["看是不是過去的後悔","If 子句用 had p.p.","主要子句用 would have p.p."],mistake:"過去假設不是 If she came，而是 If she had come。"},
  "分詞構句":{zh:"把副詞子句簡化，當主詞相同時可用 V-ing 開頭。",pattern:"V-ing ..., S + V",tips:["確認前後主詞相同","主動動作用 V-ing","表示同時或原因"],mistake:"分詞構句的動作要能對應後面句子的主詞。"},
  "倒裝句":{zh:"否定或限制副詞放句首時，後面常用助動詞倒裝。",pattern:"Never have I ... · Not only did he ...",tips:["看到否定語放句首","助動詞提前","主詞放助動詞後面"],mistake:"Not only he worked 應改成 Not only did he work。"},
  "名詞子句":{zh:"把一整個問題或句子當名詞使用，可以放在 know、think、wonder 後面。",pattern:"I know that ... · I wonder whether ... · What he said ...",tips:["看動詞後面缺一個內容","是否用 whether","疑問詞可引導名詞子句"],mistake:"間接問句通常不用疑問句倒裝。"},
  "強調句型":{zh:"用 It is/was ... that 來強調句子中的某個部分。",pattern:"It is/was + 被強調部分 + that + 其餘句子",tips:["找被強調的資訊","過去事件用 was","後面常接 that"],mistake:"It was in Tokyo that I met her，不要再加 where。"},
};
const GRAMMAR_DRILLS={
  "Be 動詞":[{s:"My friends ___ in the classroom.",o:["am","is","are","be"],a:2,e:"My friends 是複數，所以用 are。"},{s:"I ___ not tired today.",o:["am","is","are","be"],a:0,e:"I 要搭配 am。"}],
  "現在簡單式":[{s:"Tom ___ his teeth every morning.",o:["brush","brushes","brushing","brushed"],a:1,e:"Tom 是第三人稱單數，brush 加 es。"},{s:"They ___ English after dinner.",o:["study","studies","studying","studied"],a:0,e:"They 是複數主詞，動詞用原形。"}],
  "現在進行式":[{s:"Listen! The birds ___ outside.",o:["sing","sings","are singing","sang"],a:2,e:"Listen! 表示正在發生，用 are singing。"},{s:"Mom ___ dinner now.",o:["cooks","is cooking","cook","cooked"],a:1,e:"now 是進行式線索，Mom 搭配 is。"}],
  "There is / There are":[{s:"There ___ three pencils on the desk.",o:["is","are","has","have"],a:1,e:"three pencils 是複數，所以用 are。"},{s:"There ___ some water in the bottle.",o:["is","are","has","have"],a:0,e:"water 是不可數名詞，這裡用 is。"}],
  "名詞單複數":[{s:"Two ___ are in the box.",o:["watch","watchs","watches","watchies"],a:2,e:"watch 結尾 ch，複數加 es。"},{s:"The farmer has many ___.",o:["sheep","sheeps","sheepes","sheepies"],a:0,e:"sheep 單複數同形。"}],
  "代名詞":[{s:"This is Amy. I sit next to ___.",o:["she","her","hers","herself"],a:1,e:"介系詞 to 後面用受格 her。"},{s:"___ are going to the park.",o:["Us","Our","We","Ours"],a:2,e:"空格是主詞位置，用 We。"}],
  "一般過去式":[{s:"We ___ a new song yesterday.",o:["learn","learned","learning","learns"],a:1,e:"yesterday 是過去時間，用 learned。"},{s:"She ___ to school by bus last week.",o:["go","goes","went","going"],a:2,e:"go 的過去式是 went。"}],
  "未來式 will / be going to":[{s:"I think it ___ be sunny tomorrow.",o:["will","is going","was","does"],a:0,e:"預測未來常用 will。"},{s:"We ___ clean the classroom after lunch.",o:["am going to","is going to","are going to","will to"],a:2,e:"We 搭配 are going to。"}],
  "can / can't":[{s:"Can she ___ the piano?",o:["plays","play","to play","played"],a:1,e:"can 後面接原形動詞 play。"},{s:"Students ___ use phones during the test.",o:["can't","can't to","doesn't can","not can"],a:0,e:"can't 後面直接接原形動詞。"}],
  "冠詞 a / an / the":[{s:"He is ___ honest boy.",o:["a","an","the","x"],a:1,e:"honest 的 h 不發音，開頭是母音音，用 an。"},{s:"I bought a pen. ___ pen is blue.",o:["A","An","The","x"],a:2,e:"第二次提到同一支筆，用 the。"}],
  "疑問句 Do / Does":[{s:"___ they like science?",o:["Do","Does","Are","Is"],a:0,e:"they 的一般動詞問句用 Do。"},{s:"What ___ your sister want?",o:["do","does","is","are"],a:1,e:"your sister 是第三人稱單數，用 does。"}],
  "時間介系詞 in / on / at":[{s:"We eat lunch ___ noon.",o:["in","on","at","for"],a:2,e:"noon 是明確時刻，用 at。"},{s:"The festival is ___ October.",o:["in","on","at","to"],a:0,e:"月份用 in。"}],
  "現在完成式":[{s:"I ___ this movie before.",o:["saw","have seen","has seen","see"],a:1,e:"before 常搭配現在完成式 have seen。"},{s:"He ___ here since Monday.",o:["lives","has lived","lived","is living"],a:1,e:"since Monday 表示持續到現在，用 has lived。"}],
  "被動語態":[{s:"The letter ___ yesterday.",o:["sent","was sent","is sending","sends"],a:1,e:"信是被寄出，用 was sent。"},{s:"English ___ in many countries.",o:["speaks","is spoken","spoke","speaking"],a:1,e:"English 被人使用，用 is spoken。"}],
  "關係代名詞":[{s:"The woman ___ teaches us is kind.",o:["which","who","what","where"],a:1,e:"先行詞是人 woman，用 who。"},{s:"This is the bike ___ I want.",o:["who","where","that","what"],a:2,e:"先行詞是物 bike，可用 that。"}],
  "不定詞 vs 動名詞":[{s:"I plan ___ abroad next year.",o:["study","studying","to study","studied"],a:2,e:"plan 後面常接 to V。"},{s:"He avoids ___ late.",o:["arrive","to arrive","arriving","arrived"],a:2,e:"avoid 後面接 V-ing。"}],
  "連接詞":[{s:"I opened the window ___ it was hot.",o:["although","because","if","but"],a:1,e:"後面說原因，用 because。"},{s:"___ you practice, you will improve.",o:["If","Although","Because","So"],a:0,e:"前句是條件，用 If。"}],
  "比較級與最高級":[{s:"This bag is ___ than that one.",o:["heavy","heavier","heaviest","more heavy"],a:1,e:"than 前面用比較級 heavier。"},{s:"She is the ___ student in our class.",o:["careful","more careful","most careful","carefully"],a:2,e:"the + 最高級，用 most careful。"}],
  "助動詞 should / must":[{s:"You ___ see a doctor if you feel worse.",o:["should","should to","musts","are should"],a:0,e:"建議用 should，後面接原形 see。"},{s:"Drivers ___ stop at a red light.",o:["shoulds","must","must to","are must"],a:1,e:"交通規定用 must。"}],
  "過去進行式":[{s:"Dad ___ when I got home.",o:["was cooking","were cooking","cooks","cooked"],a:0,e:"Dad 是單數，用 was cooking。"},{s:"The kids ___ loudly at that time.",o:["talk","talked","were talking","was talking"],a:2,e:"kids 是複數，過去進行式用 were talking。"}],
  "未來式":[{s:"Look! The glass ___ fall.",o:["will","is going to","was going to","falls"],a:1,e:"有明顯跡象時常用 be going to。"},{s:"We ___ dinner with Mr. Chen tonight.",o:["have","are having","had","were having"],a:1,e:"已安排好的近期行程可用現在進行式。"}],
  "間接問句":[{s:"I wonder what time ___.",o:["is it","it is","does it","it"],a:1,e:"間接問句用主詞 + 動詞語序。"},{s:"Do you know why ___ sad?",o:["is she","she is","does she","she"],a:1,e:"why 後面接 she is，不倒裝。"}],
  "too / enough":[{s:"The box is too heavy ___.",o:["lift","lifting","to lift","lifted"],a:2,e:"too + adj + to V 表示太過而不能。"},{s:"The water is warm ___ to drink.",o:["too","enough","very","so"],a:1,e:"形容詞後面放 enough。"}],
  "使役與感官動詞":[{s:"Please let me ___ first.",o:["try","to try","trying","tried"],a:0,e:"let + 受詞 + 原形動詞。"},{s:"I heard someone ___ my name.",o:["call","to call","called","calls"],a:0,e:"hear + 受詞 + 原形動詞可表示聽見完整動作。"}],
  "假設語氣（現在）":[{s:"If I ___ taller, I could reach it.",o:["am","were","will be","be"],a:1,e:"與現在事實相反，be 動詞用 were。"},{s:"She would travel more if she ___ time.",o:["has","had","will have","having"],a:1,e:"If 子句用過去式 had。"}],
  "假設語氣（過去）":[{s:"If we had known, we ___ earlier.",o:["leave","left","would leave","would have left"],a:3,e:"過去假設的結果用 would have p.p.。"},{s:"He would have passed if he ___ harder.",o:["studies","studied","had studied","has studied"],a:2,e:"過去相反假設的 if 子句用 had p.p.。"}],
  "分詞構句":[{s:"___ tired, she went home early.",o:["Feel","Feeling","Felt","To feel"],a:1,e:"主動原因可用 V-ing 開頭。"},{s:"___ by many students, the app became popular.",o:["Use","Using","Used","To use"],a:2,e:"app 是被使用，用過去分詞 Used。"}],
  "倒裝句":[{s:"Never ___ such a difficult question.",o:["I have seen","have I seen","I saw","did I seen"],a:1,e:"Never 放句首時助動詞提前。"},{s:"Only after the test ___ the mistake.",o:["I noticed","noticed I","did I notice","I did notice"],a:2,e:"Only + 副詞片語放句首時，用倒裝 did I notice。"}],
  "名詞子句":[{s:"___ he said was surprising.",o:["That","What","Whether","Which"],a:1,e:"What he said 表示他說的事。"},{s:"I believe ___ she is right.",o:["what","whether","that","who"],a:2,e:"believe 後面可接 that 子句。"}],
  "強調句型":[{s:"It was my teacher ___ encouraged me.",o:["who","which","where","what"],a:0,e:"被強調的是人，用 who 或 that。"},{s:"It is hard work ___ matters most.",o:["who","where","that","what"],a:2,e:"強調句型常用 It is ... that。"}],
  "完成進行式":[{s:"They ___ for the bus for thirty minutes.",o:["wait","have been waiting","waited","are waited"],a:1,e:"for thirty minutes 表示持續到現在，用 have been waiting。"},{s:"She was tired because she ___ all night.",o:["studies","has studied","had been studying","is studying"],a:2,e:"過去某結果前的持續動作用 had been studying。"}],
  "混合假設語氣":[{s:"If he had taken the train, he ___ here now.",o:["is","would be","would have been","will be"],a:1,e:"過去條件影響現在結果，用 would be now。"},{s:"If I had learned coding earlier, I ___ more confident today.",o:["am","was","would be","would have been"],a:2,e:"today 指現在結果，所以用 would be。"}],
  "讓步與轉折":[{s:"The weather was cold; ___, we went hiking.",o:["because","however","although","so"],a:1,e:"分號後接轉折副詞 however。"},{s:"Even though he was nervous, he ___ calmly.",o:["speaks","spoke","speaking","spoken"],a:1,e:"主句敘述過去，用 spoke。"}],
  "同位語":[{s:"Jason, ___, won the contest.",o:["my cousin","who my cousin","is my cousin","my cousin is"],a:0,e:"同位語直接用名詞片語補充 Jason。"},{s:"The island, ___, attracts many tourists.",o:["a popular destination","which a popular destination","is popular destination","where popular"],a:0,e:"逗號中的同位語是名詞片語。"}],
  "關係子句進階":[{s:"The book, ___ I borrowed yesterday, is excellent.",o:["that","which","what","who"],a:1,e:"非限定關係子句用 which，不用 that。"},{s:"The friend with ___ I traveled is a photographer.",o:["who","whom","which","that"],a:1,e:"介系詞 with 後面正式用 whom。"}],
  "省略與替代":[{s:"I don't like horror movies, and neither ___ Ken.",o:["does","is","has","can"],a:0,e:"前句是現在簡單式否定，附和用 neither does。"},{s:"This shirt is too small. I need a larger ___.",o:["one","ones","it","that"],a:0,e:"one 代替前面的單數名詞 shirt。"}],
};
function normalizeGrammarExamples(rule,guide){
  const raw=Array.isArray(rule?.examples)&&rule.examples.length?rule.examples:(Array.isArray(guide?.examples)?guide.examples:[]);
  const examples=raw.map(x=>typeof x==="string"?{en:x,zh:""}:{en:String(x?.en||""),zh:String(x?.zh||"")}).filter(x=>x.en);
  if(rule?.ex&&!examples.some(x=>x.en===rule.ex))examples.unshift({en:rule.ex,zh:""});
  return examples.slice(0,5);
}
function grammarGuide(rule){
  const guide=GRAMMAR_GUIDES[rule?.t]||{};
  return {
    zh:rule?.zh||guide.zh||rule?.d||"",
    pattern:rule?.pattern||guide.pattern||rule?.d||"",
    tips:rule?.tips||guide.tips||["先找主詞和時間","再看句型","最後檢查答案是否自然"],
    mistake:rule?.mistake||guide.mistake||"選完後把句子完整讀一次，通常能發現不自然的地方。",
    examples:normalizeGrammarExamples(rule,guide),
  };
}
function grammarDrills(rule){return (GRAMMAR_DRILLS[rule?.t]||[]).slice(0,3)}
function parseGrammarJson(text){
  let raw=String(text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"");
  const s=raw.indexOf("{"),e=raw.lastIndexOf("}");
  if(s>=0&&e>s)raw=raw.slice(s,e+1);
  return JSON.parse(raw);
}
function normalizeGrammarAi(raw,rule){
  const fallback=grammarGuide(rule);
  const simple=String(raw?.simple||fallback.zh||rule?.d||"").trim();
  const examples=(Array.isArray(raw?.examples)?raw.examples:[]).map(x=>({en:String(x?.en||""),zh:String(x?.zh||"")})).filter(x=>x.en).slice(0,3);
  const practice=raw?.practice&&raw.practice.prompt?{
    prompt:String(raw.practice.prompt),
    answer:String(raw.practice.answer||""),
    explanation:String(raw.practice.explanation||""),
  }:null;
  return {simple,examples:examples.length?examples:fallback.examples.slice(0,3),practice};
}
async function generateGrammarAiExplanation(rule,lv,apiKey){
  if(!rule||!apiKey?.trim())throw new Error("需要 Gemini API Key 才能產生 AI 講解。");
  const cacheKey=`grammar_ai_${encodeURIComponent(`${lv}:${rule.t}`)}`;
  try{const cached=localStorage.getItem(cacheKey);if(cached)return normalizeGrammarAi(JSON.parse(cached),rule)}catch{}
  const guide=grammarGuide(rule);
  const prompt=`你是給台灣學生使用的 AI 英語文法家教。只講解目前這個文法主題，不要延伸到其他主題。

目前程度：${LV[lv]?.name||lv}
文法主題：${rule.t}
規則：${guide.zh}
句型：${guide.pattern}
範例：${guide.examples.map(x=>`${x.en}${x.zh?`（${x.zh}）`:""}`).join(" / ")}
小測驗：${rule.q?.s}
選項：${rule.q?.o?.join("、")}
正解：${rule.q?.o?.[rule.q?.a]}

請用繁體中文輸出 STRICT JSON：
{"simple":"用學生聽得懂的方式講解 2-3 句","examples":[{"en":"英文例句","zh":"繁中翻譯"}],"practice":{"prompt":"一題含 ___ 的練習題","answer":"答案","explanation":"為什麼"}}`;
  const models=["gemini-2.5-flash-lite","gemini-2.5-flash","gemini-2.0-flash"];
  for(const model of models){
    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:900,temperature:0.45,responseMimeType:"application/json"}}),
      });
      const data=await res.json();
      if(!res.ok||data?.error)continue;
      const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("");
      if(!text)continue;
      const normalized=normalizeGrammarAi(parseGrammarJson(text),rule);
      try{localStorage.setItem(cacheKey,JSON.stringify(normalized))}catch{}
      return normalized;
    }catch{}
  }
  throw new Error("AI 講解暫時產生失敗，請稍後再試。");
}
function grammarCloze(sentence,fill,cl){
  const parts=String(sentence||"").split("___");
  return parts.map((p,i)=><span key={i}>{p}{i<parts.length-1&&<span style={{display:"inline-block",minWidth:76,borderBottom:`3px solid ${cl}`,textAlign:"center",fontWeight:800,color:cl,padding:"0 6px",margin:"0 2px"}}>{fill||"？"}</span>}</span>);
}
function GrammarM({lv,onBack,onXp,apiKey,onOpenSettings}){
  const rules=G[lv];const c=LV[lv];
  const[sel,setSel]=useState(null);const[answers,setAnswers]=useState({});const[showResult,setShowResult]=useState(false);const[showHint,setShowHint]=useState(false);
  const[drillAnswers,setDrillAnswers]=useState({});
  const[aiExplain,setAiExplain]=useState(null);const[aiLoading,setAiLoading]=useState(false);const[aiError,setAiError]=useState("");
  const rewarded=useRef(new Set());
  useEffect(()=>{setSel(null);setAnswers({});setDrillAnswers({});setShowResult(false);setShowHint(false);setAiExplain(null);setAiError("");setAiLoading(false);rewarded.current=new Set()},[lv]);
  useEffect(()=>{setDrillAnswers({});setAiExplain(null);setAiError("");setAiLoading(false)},[sel,lv]);
  const completed=Object.keys(answers).length;
  const score=Object.values(answers).filter(a=>a?.correct).length;
  const pct=rules.length?Math.round(score/rules.length*100):0;
  const wrongIdx=rules.map((_,i)=>i).filter(i=>answers[i]&&!answers[i].correct);
  const openTopic=i=>{setSel(i);setShowResult(false);setShowHint(false)};
  const resetAll=()=>{setSel(null);setAnswers({});setShowResult(false);setShowHint(false);rewarded.current=new Set()};
  const startPractice=()=>openTopic(rules.findIndex((_,i)=>!answers[i])>=0?rules.findIndex((_,i)=>!answers[i]):0);
  const retryWrong=()=>{if(!wrongIdx.length)return;setAnswers(a=>{const next={...a};wrongIdx.forEach(i=>delete next[i]);return next});setShowResult(false);setShowHint(true);setSel(wrongIdx[0])};
  const handleAns=i=>{
    if(sel==null||answers[sel])return;
    const r=rules[sel];const correct=i===r.q.a;
    setAnswers(a=>({...a,[sel]:{choice:i,correct}}));
    if(correct){playSound("good");if(!rewarded.current.has(sel)){rewarded.current.add(sel);onXp?.(5)}}else playSound("bad");
  };
  const handleDrill=(di,oi)=>{
    const r=rules[sel],d=grammarDrills(r)[di];if(!d||drillAnswers[di]!=null)return;
    setDrillAnswers(a=>({...a,[di]:oi}));
    playSound(oi===d.a?"good":"bad");
  };
  const clearCurrentAnswer=()=>{setAnswers(a=>{const next={...a};delete next[sel];return next});setShowHint(true)};
  const goNext=()=>{setShowHint(false);if(sel<rules.length-1)setSel(sel+1);else setShowResult(true)};
  const goPrev=()=>{setShowHint(false);if(sel>0)setSel(sel-1)};
  const loadAiExplanation=async()=>{
    const r=rules[sel];
    if(!apiKey?.trim()){setAiError("請先到設定填入 Gemini API Key。");onOpenSettings?.();return}
    setAiLoading(true);setAiError("");
    try{setAiExplain(await generateGrammarAiExplanation(r,lv,apiKey))}
    catch(e){setAiError(e?.message||"AI 講解暫時產生失敗。")}
    finally{setAiLoading(false)}
  };

  if(showResult){return(<div><Hdr t="🧠 文法學堂" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"28px 12px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{pct>=80?"🏆":pct>=60?"🎉":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>文法學習完成！</h2><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxWidth:420,margin:"16px auto"}}>{[["答對",`${score}/${rules.length}`,c.cl],["掌握率",`${pct}%`,pct>=80?"#1D9E75":"#EF9F27"],["待複習",wrongIdx.length,"#E24B4A"]].map(([l,v,cl])=><div key={l} style={{...S.card,padding:"12px 8px",borderTop:`3px solid ${cl}`}}><div style={{fontSize:22,fontWeight:800,color:cl}}>{v}</div><div style={{fontSize:11,color:S.t3,marginTop:2}}>{l}</div></div>)}</div><div style={{fontSize:14,color:S.t2,margin:"8px 0 14px"}}>{pct>=80?"規則掌握得很好，可以進入閱讀或造句練習。":pct>=60?"基本概念不錯，建議把錯題再跑一輪。":"先看提示與範例，再慢慢重做錯題。"}</div>{wrongIdx.length>0&&<div style={{...S.card,padding:"12px 14px",maxWidth:520,margin:"0 auto 14px",textAlign:"left"}}><div style={{fontSize:13,fontWeight:800,color:"#E24B4A",marginBottom:8}}>錯題複習</div><div style={{display:"grid",gap:7}}>{wrongIdx.map(i=><button key={i} onClick={()=>openTopic(i)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:12,padding:"9px 11px",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}><div style={{fontSize:14,fontWeight:800,color:S.t1}}>{rules[i].t}</div><div style={{fontSize:12,color:S.t2,marginTop:2}}>正解：{rules[i].q.o[rules[i].q.a]} · 你的答案：{rules[i].q.o[answers[i].choice]}</div></button>)}</div></div>}<button onClick={wrongIdx.length?retryWrong:resetAll} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>{wrongIdx.length?"只練錯題":"重新學習"}</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}

  if(sel===null)return(<div><Hdr t="🧠 文法學堂" onBack={onBack} cl={c.cl}/>
    <div style={{...S.card,padding:"14px 16px",marginBottom:12,borderTop:`4px solid ${c.cl}`}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:10}}>
        <div><div style={{fontSize:14,fontWeight:800,color:S.t1}}>學習進度</div><div style={{fontSize:12,color:S.t2,marginTop:2}}>先看規則，再完成每個主題的小測驗。</div></div>
        <button onClick={startPractice} style={{...S.btn,background:c.cl,color:"#fff",fontSize:13,padding:"9px 14px",whiteSpace:"nowrap"}}>{completed?"繼續":"開始"}</button>
      </div>
      <div style={{height:8,background:S.bg2,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${(completed/rules.length)*100}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:999,transition:"width .25s"}}/></div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:S.t3,marginTop:7}}><span>已完成 {completed}/{rules.length}</span><span>答對 {score}</span></div>
    </div>
    <div style={{display:"grid",gap:8}}>
      {rules.map((r,i)=>{const a=answers[i];const guide=grammarGuide(r);const done=!!a;return(<button key={i} onClick={()=>openTopic(i)} style={{cursor:"pointer",...S.card,padding:"15px 16px",display:"flex",gap:12,alignItems:"center",border:"none",borderLeft:`4px solid ${done?(a.correct?"#1D9E75":"#E24B4A"):c.cl}`,transition:"all .15s",fontFamily:"inherit",textAlign:"left"}} onTouchStart={e=>e.currentTarget.style.transform="scale(0.98)"} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
        <div style={{width:38,height:38,borderRadius:"50%",background:done?(a.correct?"#E1F5EE":"#FCEBEB"):c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:done?17:14,fontWeight:800,color:done?(a.correct?"#1D9E75":"#E24B4A"):c.cl,flexShrink:0}}>{done?(a.correct?"✓":"!"):(i+1)}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontWeight:800,fontSize:15,color:S.t1}}>{r.t}</div><div style={{fontSize:12,color:S.t2,marginTop:3,lineHeight:1.45}}>{guide.zh}</div><div style={{fontSize:11,color:c.cl,marginTop:5,fontWeight:700}}>{guide.pattern}</div></div>
        <div style={{fontSize:18,opacity:.35}}>›</div>
      </button>)})}
    </div>
  </div>);

  const r=rules[sel];const guide=grammarGuide(r);const examples=guide.examples;const drills=grammarDrills(r);const current=answers[sel];const progress=(sel+1)/rules.length*100;const fill=current?r.q.o[current.choice]:"";const fillColor=current?(current.correct?"#1D9E75":"#E24B4A"):c.cl;
  return(<div><Hdr t="🧠 文法學堂" onBack={onBack} cl={c.cl}/>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,fontSize:12}}>
      <button onClick={()=>{setSel(null);setShowHint(false)}} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>列表</button>
      <div style={{flex:1,height:7,background:S.bg2,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${progress}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:999,transition:"width .3s"}}/></div>
      <span style={{color:S.t3,minWidth:38,textAlign:"right"}}>{sel+1}/{rules.length}</span>
    </div>

    <div style={{...S.card,padding:"18px 16px",marginBottom:10,borderTop:`4px solid ${c.cl}`}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:13}}>
        <div style={{width:42,height:42,borderRadius:"50%",background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:c.cl,flexShrink:0}}>{sel+1}</div>
        <div style={{flex:1}}><h3 style={{fontSize:20,fontWeight:800,color:S.t1,margin:"0 0 4px"}}>{r.t}</h3><div style={{fontSize:13,color:c.cl,fontWeight:800}}>{guide.pattern}</div></div>
        {current&&<div style={{fontSize:12,fontWeight:800,color:current.correct?"#1D9E75":"#E24B4A",background:current.correct?"#E1F5EE":"#FCEBEB",borderRadius:999,padding:"5px 9px",whiteSpace:"nowrap"}}>{current.correct?"已答對":"待複習"}</div>}
      </div>

      <div style={{display:"grid",gap:10,marginBottom:14}}>
        <div style={{background:`linear-gradient(135deg,${c.bg}55,${S.bg2})`,borderRadius:14,padding:"14px 15px",borderLeft:`4px solid ${c.cl}`}}><div style={{fontSize:12,fontWeight:800,color:c.cl,marginBottom:6}}>規則怎麼看</div><div style={{fontSize:14,color:S.t1,lineHeight:1.7,fontWeight:600}}>{guide.zh}</div></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>{guide.tips.map((t,i)=><div key={i} style={{padding:"10px 11px",borderRadius:12,background:S.bg2,border:`1px solid ${S.bd}`}}><div style={{fontSize:11,color:S.t3,fontWeight:800}}>STEP {i+1}</div><div style={{fontSize:13,color:S.t1,fontWeight:700,marginTop:3,lineHeight:1.45}}>{t}</div></div>)}</div>
      </div>

      <div style={{background:S.bg2,borderRadius:14,padding:"13px 14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:9}}><div style={{fontSize:12,fontWeight:800,color:S.t2}}>例句庫</div><button onClick={()=>speak(examples[0]?.en||r.ex)} style={{background:S.bg1,border:`1px solid ${S.bd}`,borderRadius:10,padding:"4px 8px",fontSize:12,cursor:"pointer",color:c.cl,fontFamily:"inherit"}}>🔊 第一句</button></div>
        <div style={{display:"grid",gap:8}}>
          {examples.map((ex,i)=><div key={`${ex.en}-${i}`} style={{background:S.bg1,border:`1px solid ${S.bd}`,borderRadius:12,padding:"10px 11px"}}>
            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <button onClick={()=>speak(ex.en)} style={{border:"none",background:c.bg,color:c.cl,borderRadius:8,width:30,height:30,cursor:"pointer",flexShrink:0,fontSize:13}}>🔊</button>
              <div style={{minWidth:0}}><div style={{fontSize:15,color:S.t1,fontWeight:800,lineHeight:1.5}}>{ex.en}</div>{ex.zh&&<div style={{fontSize:12,color:S.t2,lineHeight:1.55,marginTop:2}}>{ex.zh}</div>}</div>
            </div>
          </div>)}
        </div>
      </div>

      <div style={{background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:14,padding:"13px 14px",marginBottom:15}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:aiExplain?10:0}}>
          <div><div style={{fontSize:13,fontWeight:900,color:"#5B21B6"}}>AI 文法教練</div><div style={{fontSize:12,color:S.t2,marginTop:2}}>只整理「{r.t}」這個主題</div></div>
          <button onClick={loadAiExplanation} disabled={aiLoading} style={{...S.btn,background:"#6D28D9",color:"#fff",fontSize:13,padding:"9px 13px",borderRadius:12,whiteSpace:"nowrap",opacity:aiLoading ? .65 : 1}}>{aiLoading?"整理中...":"AI 講解"}</button>
        </div>
        {aiError&&<div style={{fontSize:12,color:"#8A5A00",background:"#FFF7E6",border:"1px solid #F0D59A",borderRadius:10,padding:"8px 10px",marginTop:10,lineHeight:1.55}}>{aiError}</div>}
        {aiExplain&&<div style={{display:"grid",gap:10,animation:"fadeUp .25s"}}>
          <div style={{fontSize:14,color:S.t1,lineHeight:1.7,fontWeight:650}}>{aiExplain.simple}</div>
          {aiExplain.examples.length>0&&<div style={{display:"grid",gap:7}}>{aiExplain.examples.map((ex,i)=><div key={`${ex.en}-${i}`} style={{background:"#fff",border:"1px solid #E9D5FF",borderRadius:11,padding:"9px 10px"}}><div style={{fontSize:14,fontWeight:800,color:S.t1}}>{ex.en}</div>{ex.zh&&<div style={{fontSize:12,color:S.t2,marginTop:2,lineHeight:1.5}}>{ex.zh}</div>}</div>)}</div>}
          {aiExplain.practice&&<div style={{background:"#fff",border:"1px solid #C4B5FD",borderRadius:12,padding:"10px 11px"}}>
            <div style={{fontSize:11,fontWeight:900,color:"#6D28D9",marginBottom:5}}>AI 小練習</div>
            <div style={{fontSize:14,color:S.t1,fontWeight:800,lineHeight:1.55}}>{aiExplain.practice.prompt}</div>
            <div style={{fontSize:12,color:S.t2,marginTop:5,lineHeight:1.55}}>答案：<b>{aiExplain.practice.answer}</b>{aiExplain.practice.explanation?`，${aiExplain.practice.explanation}`:""}</div>
          </div>}
        </div>}
      </div>

      {drills.length>0&&<div style={{background:S.bg1,border:`1px solid ${S.bd}`,borderRadius:14,padding:"13px 14px",marginBottom:15}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:10}}>
          <div><div style={{fontSize:14,fontWeight:900,color:S.t1}}>加強練習</div><div style={{fontSize:12,color:S.t2,marginTop:2}}>同一個文法點多做幾題，先熟悉判斷線索。</div></div>
          <div style={{fontSize:12,fontWeight:900,color:c.cl,background:c.bg,borderRadius:999,padding:"5px 9px",whiteSpace:"nowrap"}}>{Object.keys(drillAnswers).length}/{drills.length}</div>
        </div>
        <div style={{display:"grid",gap:10}}>
          {drills.map((d,di)=>{const picked=drillAnswers[di];return <div key={di} style={{border:`1px solid ${picked==null?S.bd:picked===d.a?"#9DDDC7":"#F1B5B5"}`,background:picked==null?S.bg2:picked===d.a?"#F0FBF6":"#FFF2F2",borderRadius:13,padding:"11px 12px"}}>
            <div style={{fontSize:13,fontWeight:850,color:S.t1,lineHeight:1.6,marginBottom:8}}>{grammarCloze(d.s,picked!=null?d.o[picked]:"",picked==null?c.cl:picked===d.a?"#1D9E75":"#E24B4A")}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:7}}>
              {d.o.map((o,oi)=>{const ok=oi===d.a,chosen=picked===oi;let bg=S.bg1,bd=`1px solid ${S.bd}`,cl=S.t1;if(picked!=null){if(ok){bg="#E1F5EE";bd="2px solid #1D9E75";cl="#146B45"}else if(chosen){bg="#FCEBEB";bd="2px solid #E24B4A";cl="#A12F2F"}}return <button key={o} data-testid={`grammar-drill-${di}-option-${oi}`} onClick={()=>handleDrill(di,oi)} disabled={picked!=null} style={{border:bd,background:bg,color:cl,borderRadius:11,padding:"9px 8px",fontSize:13,fontWeight:800,cursor:picked==null?"pointer":"default",fontFamily:"inherit"}}>{o}</button>})}
            </div>
            {picked!=null&&<div style={{fontSize:12,color:S.t2,lineHeight:1.55,marginTop:8}}>解析：{d.e}</div>}
          </div>})}
        </div>
      </div>}

      <div style={{borderTop:`2px solid ${S.bd}`,paddingTop:15}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:10}}><div style={{fontSize:14,fontWeight:800,color:S.t1}}>小測驗</div>{!current&&<button onClick={()=>setShowHint(v=>!v)} style={{background:showHint?"#FFF3CD":S.bg2,border:`1px solid ${S.bd}`,borderRadius:10,padding:"5px 9px",fontSize:12,cursor:"pointer",color:showHint?"#8A5A00":S.t2,fontFamily:"inherit"}}>提示</button>}</div>
        <button onClick={()=>speak(r.q.s.replace("___",current?r.q.o[current.choice]:"blank"))} style={{width:"100%",textAlign:"left",border:"none",background:S.bg2,borderRadius:13,padding:"12px 13px",fontSize:16,color:S.t1,lineHeight:1.75,fontWeight:650,fontFamily:"inherit",cursor:"pointer",marginBottom:10}}>{grammarCloze(r.q.s,fill,fillColor)} <span style={{fontSize:18}}>🔊</span></button>
        {showHint&&!current&&<div style={{fontSize:12,color:"#8A5A00",background:"#FFF7E6",border:"1px solid #F0D59A",borderRadius:12,padding:"9px 11px",marginBottom:10,lineHeight:1.6}}>提示：{guide.tips.join(" → ")}。正確答案通常符合「{guide.pattern}」。</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
          {r.q.o.map((o,i)=>{const ok=i===r.q.a,pk=current?.choice===i;let bg=S.bg2,bd=`1px solid ${S.bd}`,cl=S.t1,anim="";if(current){if(ok){bg="#E1F5EE";bd="2px solid #1D9E75";cl="#146B45";anim="bounceIn .3s"}else if(pk){bg="#FCEBEB";bd="2px solid #E24B4A";cl="#A12F2F";anim="moleShake .3s"}}return<button key={i} onClick={()=>handleAns(i)} disabled={!!current} style={{padding:"13px 10px",borderRadius:13,background:bg,border:bd,cursor:current?"default":"pointer",fontSize:15,fontFamily:"inherit",color:cl,fontWeight:current&&ok?800:650,transition:"all .15s",animation:anim,minHeight:48,WebkitTapHighlightColor:"transparent"}} onTouchStart={e=>{if(!current)e.currentTarget.style.transform="scale(0.96)"}} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>{o}</button>})}
        </div>
        {current&&<div style={{marginTop:12,padding:"12px 14px",borderRadius:12,background:current.correct?"#E1F5EE":"#FFF3CD",animation:"fadeUp .3s",lineHeight:1.65}}><div style={{fontSize:15,fontWeight:800,color:current.correct?"#1D9E75":"#E24B4A"}}>{current.correct?"答對了":"還不對"}</div>{!current.correct&&<div style={{fontSize:13,color:S.t1,marginTop:4}}>正確答案：<b style={{color:"#1D9E75"}}>{r.q.o[r.q.a]}</b></div>}<div style={{fontSize:12,color:S.t2,marginTop:4}}>解析：{guide.mistake}</div></div>}
      </div>
    </div>

    <div style={{display:"flex",gap:8,alignItems:"center"}}>
      <button onClick={goPrev} disabled={sel===0} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,opacity:sel===0?.35:1,fontSize:14,padding:"12px"}}>← 上一題</button>
      {current&&!current.correct&&<button onClick={clearCurrentAnswer} style={{...S.btn,background:"#FFF3CD",color:"#8A5A00",fontSize:14,padding:"12px 14px"}}>再試</button>}
      {current?<button onClick={goNext} style={{...S.btn,background:c.cl,color:"#fff",flex:1,fontSize:14,padding:"12px"}}>{sel>=rules.length-1?"看成績":"下一題 →"}</button>:<button onClick={()=>setShowHint(true)} style={{...S.btn,background:S.bg2,color:S.t2,flex:1,fontSize:14,padding:"12px"}}>先看提示</button>}
    </div>
  </div>);
}
// ═══ READING ════════════════════════════════════════════════════════
const READING_STOP_WORDS=new Set("a an and are as at be by can for from has have he her his i in is it its me my of on one or our she that the their there they this to too was we when while who with you your what where why how many more most than into every today".split(" "));
function splitReadingSentences(text){const m=String(text||"").match(/[^.!?]+[.!?]+/g);return(m?.length?m:[text]).map(s=>s.trim()).filter(Boolean)}
function readingWords(text){return(String(text||"").toLowerCase().match(/[a-z][a-z'-]*/g)||[]).map(w=>w.replace(/^'+|'+$/g,"")).filter(Boolean)}
function readingScore(qs,ans){return qs.reduce((n,q,i)=>n+(ans[i]===q.a?1:0),0)}
function readingKeywords(article,lv){
  const dict=new Map((V[lv]||[]).map(v=>[v.w.toLowerCase(),v]));
  const counts={};
  readingWords(article.tx).forEach(w=>{if(w.length<4||READING_STOP_WORDS.has(w))return;counts[w]=(counts[w]||0)+1});
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,8).map(([word,count])=>({word,count,info:dict.get(word)}));
}
function readingEvidence(text,q){
  const sentences=splitReadingSentences(text);
  const target=readingWords(`${q.q} ${q.o[q.a]}`).filter(w=>w.length>2&&!READING_STOP_WORDS.has(w));
  let best=sentences[0]||"",bestScore=-1;
  sentences.forEach(s=>{
    const low=s.toLowerCase();
    let score=target.reduce((n,w)=>n+(low.includes(w)?1:0),0);
    if(low.includes(String(q.o[q.a]).toLowerCase()))score+=3;
    if(score>bestScore){best=s;bestScore=score}
  });
  return best;
}
function ReadingM({lv,onBack,onXp}){
  const articles=R[lv];const[ai,setAi]=useState(0);const[answers,setAnswers]=useState({});const[focus,setFocus]=useState(-1);const[articlePlaying,setArticlePlaying]=useState(false);const rewarded=useRef({});const articleHandle=useRef(null);const c=LV[lv];const d=articles[ai];const ans=answers[ai]||{};
  const zh=R_ZH[d.t]||{};
  useEffect(()=>{setAi(0);setAnswers({});setFocus(-1);rewarded.current={}},[lv]);
  const sentences=useMemo(()=>splitReadingSentences(d.tx),[d]);
  const keys=useMemo(()=>readingKeywords(d,lv),[d,lv]);
  const wordCount=useMemo(()=>readingWords(d.tx).length,[d]);
  const score=readingScore(d.qs,ans);const answered=Object.keys(ans).length;const done=answered===d.qs.length;const pct=Math.round((score/d.qs.length)*100);
  const doneCount=articles.filter((a,i)=>Object.keys(answers[i]||{}).length===a.qs.length).length;
  const setArticleAns=fn=>setAnswers(all=>({...all,[ai]:typeof fn==="function"?fn(all[ai]||{}):fn}));
  const pick=(qi,oi)=>{if(ans[qi]!==undefined)return;setArticleAns(a=>({...a,[qi]:oi}));const ok=oi===d.qs[qi].a;playSound(ok?"good":"bad");const key=`${lv}:${ai}:${qi}`;if(ok&&!rewarded.current[key]){rewarded.current[key]=true;onXp?.(5)}};
  const stopArticle=()=>{articleHandle.current?.cancel();articleHandle.current=null;setArticlePlaying(false);setFocus(-1)};
  const playArticle=()=>{stopArticle();setArticlePlaying(true);articleHandle.current=speakStory(sentences,{rate:0.86,onSentence:i=>setFocus(i),onFinish:()=>{articleHandle.current=null;setArticlePlaying(false);setFocus(-1)},oncancel:()=>{articleHandle.current=null;setArticlePlaying(false);setFocus(-1)}})};
  useEffect(()=>{stopArticle();preloadTts([d.tx,...sentences,...d.qs.map(q=>q.q),...d.qs.map(q=>q.o[q.a])],{limit:8,concurrency:2});return()=>{articleHandle.current?.cancel()}},[d,sentences]);
  const resetArticle=()=>{setArticleAns({});setFocus(-1)};
  const goArticle=i=>{stopArticle();setAi(i)};
  return(<div><Hdr t="📖 閱讀理解" onBack={onBack} cl={c.cl} extra={<button onClick={articlePlaying?stopArticle:playArticle} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 8px",fontSize:12,color:c.cl,cursor:"pointer",fontFamily:"inherit"}}>{articlePlaying?"⏹ 停止":"🔊 全文"}</button>}/>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:12}}>
      <div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${(doneCount/articles.length)*100}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3,transition:"width .3s"}}/></div>
      <span style={{color:S.t3}}>完成 {doneCount}/{articles.length}</span>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto",paddingBottom:2}}>{articles.map((a,i)=>{const aAns=answers[i]||{};const aDone=Object.keys(aAns).length===a.qs.length;return(<button key={i} onClick={()=>goArticle(i)} style={{flexShrink:0,padding:"9px 13px",borderRadius:12,background:i===ai?c.cl:aDone?"#E1F5EE":S.bg2,minHeight:38,color:i===ai?"#fff":aDone?"#1D9E75":S.t1,border:aDone&&i!==ai?"1px solid #1D9E75":"none",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{aDone?"✓ ":""}{a.t}</button>)})}</div>

    <div style={{...S.card,padding:"18px 16px",marginBottom:10,borderTop:`4px solid ${c.cl}`}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",marginBottom:10}}>
        <div><h3 style={{fontSize:20,fontWeight:700,color:S.t1,margin:"0 0 3px"}}>{d.t}</h3><div style={{fontSize:12,color:S.t3}}>{wordCount} words · 約 {Math.max(1,Math.ceil(wordCount/120))} 分鐘</div></div>
        <div style={{display:"flex",gap:7,alignItems:"center",flexShrink:0}}><button onClick={articlePlaying?stopArticle:playArticle} style={{border:`1px solid ${c.cl}`,background:articlePlaying?"#FCEBEB":c.bg,color:articlePlaying?"#E24B4A":c.cl,borderRadius:12,padding:"7px 11px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{articlePlaying?"⏹ 停止":"🔊 朗讀全文"}</button><div style={{fontSize:12,fontWeight:700,color:c.cl,background:c.bg,borderRadius:12,padding:"5px 10px",whiteSpace:"nowrap"}}>{score}/{d.qs.length}</div></div>
      </div>
      <div style={{display:"grid",gap:7,marginBottom:12}}>
        {sentences.map((s,i)=><button key={i} onClick={()=>{stopArticle();setFocus(i);speak(s,"en-US",0.85)}} style={{textAlign:"left",fontSize:14,lineHeight:1.75,color:S.t1,padding:"9px 11px",background:focus===i?c.bg:S.bg2,border:`1px solid ${focus===i?c.cl:S.bd}`,borderRadius:10,cursor:"pointer",fontFamily:"inherit"}}>{s}</button>)}
      </div>
      {done&&zh.tx&&<div style={{marginBottom:12,padding:"12px 14px",background:"#FFF7E6",border:"1px solid #F0D59A",borderRadius:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:6}}><div style={{fontSize:12,fontWeight:700,color:"#8A5A00"}}>中文翻譯</div><button onClick={()=>{stopArticle();speak(zh.tx,"zh-TW",1)}} style={{background:"none",border:`1px solid #E4C573`,borderRadius:10,padding:"4px 8px",fontSize:12,color:"#8A5A00",cursor:"pointer",fontFamily:"inherit"}}>🔊 中文</button></div>
        <div style={{fontSize:13,lineHeight:1.8,color:S.t1,textAlign:"left"}}>{zh.tx}</div>
      </div>}
      {keys.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {keys.map(k=><button key={k.word} onClick={()=>speak(k.word)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:999,padding:"6px 10px",fontSize:12,color:S.t1,cursor:"pointer",fontFamily:"inherit"}}><b style={{color:c.cl}}>{k.word}</b>{k.info?.m?` · ${k.info.m}`:""}{k.count>1?` ×${k.count}`:""}</button>)}
      </div>}
    </div>

    {d.qs.map((q,qi)=>{const dn=ans[qi]!==undefined,correct=ans[qi]===q.a,evidence=readingEvidence(d.tx,q);return(<div key={qi} style={{...S.card,padding:"15px",marginBottom:8,borderLeft:`4px solid ${dn?(correct?"#1D9E75":"#E24B4A"):c.ac}`}}>
      <div style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:10}}><div style={{width:26,height:26,borderRadius:"50%",background:dn?(correct?"#E1F5EE":"#FCEBEB"):c.bg,color:dn?(correct?"#1D9E75":"#E24B4A"):c.cl,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>{qi+1}</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:S.t1,lineHeight:1.45}}>{q.q}</div>{done&&zh.qs?.[qi]&&<button onClick={()=>{stopArticle();speak(zh.qs[qi],"zh-TW",1)}} style={{marginTop:5,background:"#FFF7E6",border:"1px solid #F0D59A",borderRadius:10,padding:"5px 8px",fontSize:12,color:"#8A5A00",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>🔊 {zh.qs[qi]}</button>}</div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:7}}>{q.o.map((o,oi)=>{const ok=oi===q.a,pk=ans[qi]===oi;let bg=S.bg2,bd=`1px solid ${S.bd}`,cl=S.t1;if(dn){if(ok){bg="#E1F5EE";bd="2px solid #1D9E75";cl="#146B45"}else if(pk){bg="#FCEBEB";bd="2px solid #E24B4A";cl="#A12F2F"}}return<button key={oi} onClick={()=>pick(qi,oi)} style={{padding:"11px 10px",borderRadius:10,background:bg,border:bd,cursor:dn?"default":"pointer",fontSize:13,fontFamily:"inherit",color:cl,textAlign:"left",fontWeight:dn&&ok?700:500,minHeight:44}}>{o}</button>})}</div>
      {dn&&<div style={{marginTop:10,padding:"10px 12px",borderRadius:10,background:correct?"#E1F5EE":"#FFF3CD",fontSize:12,color:S.t2,lineHeight:1.65}}>
        <div style={{fontSize:13,fontWeight:700,color:correct?"#1D9E75":"#E24B4A",marginBottom:3}}>{correct?"答對":"答錯"} · 正解：{q.o[q.a]}</div>
        <div style={{color:S.t1}}>定位：{evidence}</div>
      </div>}
    </div>)})}

    {done&&<div style={{...S.card,padding:"18px 16px",textAlign:"center",marginTop:10,background:`linear-gradient(135deg,${pct>=80?"#E1F5EE":pct>=50?"#FFF3CD":"#FCEBEB"},var(--color-background-primary,#fff))`}}>
      <div style={{fontSize:42,animation:"bounceIn .4s ease-out"}}>{pct>=80?"🏆":pct>=50?"🎉":"💪"}</div>
      <div style={{fontSize:18,fontWeight:700,color:S.t1,marginTop:4}}>本篇完成</div>
      <div style={{fontSize:13,color:c.cl,fontWeight:700,marginTop:3}}>答對 {score}/{d.qs.length} · {pct}%</div>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button onClick={resetArticle} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,padding:"11px",fontSize:13}}>重做本篇</button>
        <button onClick={()=>goArticle((ai+1)%articles.length)} style={{...S.btn,background:c.cl,color:"#fff",flex:1,padding:"11px",fontSize:13}}>{ai+1>=articles.length?"回第一篇":"下一篇"}</button>
      </div>
    </div>}
  </div>);
}
// ═══ NOVELS (英文小說閱讀) ═════════════════════════════════════════════
const NOVEL_COUNT=8;
const LazyNovelM=lazy(()=>import("./features/NovelM.jsx"));
function NovelM(props){
  const deps={LV,S,useLS,readingWords,playSound,stopSpeech,speak,speakStory,Hdr};
  return <Suspense fallback={<div style={{textAlign:"center",padding:"48px",color:S.t3}}>Loading novels...</div>}><LazyNovelM {...props} deps={deps}/></Suspense>;
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
function SongsM({lv,onBack,onXp}){
  const songs=SONGS[lv]||[];const c=LV[lv];const[si,setSi]=useState(0);const[time,setTime]=useState(0);const[dur,setDur]=useState(0);const[playing,setPlaying]=useState(false);const[showZh,setShowZh]=useState(true);const[view,setView]=useState("lyrics");const[speed,setSpeed]=useState(1);const[practice,setPractice]=useState({idx:0,pick:null,score:0,done:false});const[timingDraft,setTimingDraft]=useState([]);const[timingExport,setTimingExport]=useState("");const audioRef=useRef(null);const lineRefs=useRef({});const songPanelRef=useRef(null);const rewarded=useRef({});
  const timingMode=useMemo(()=>{try{return new URLSearchParams(window.location.search).get("timing")==="1"}catch{return false}},[]);
  const song=songs[si];const songLines=timingMode&&timingDraft.length?timingDraft:(song?.lines||[]);const lyricLines=useMemo(()=>songLines.map((l,i)=>({...l,i})).filter(l=>l.en),[songLines]);
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
    const vocab=(song.vocab||[]).filter(Boolean);
    return lyricLines.map((line,idx)=>{
      const word=vocab.find(w=>new RegExp(`\\b${esc(w)}\\b`,"i").test(line.en));
      if(!word)return null;
      const blank=line.en.replace(new RegExp(`\\b${esc(word)}\\b`,"i"),"____");
      const distractors=shuffleCopy(vocab.filter(w=>w!==word)).slice(0,3);
      return{line,idx,word,blank,options:shuffleCopy([word,...distractors])};
    }).filter(Boolean).slice(0,8);
  },[song,lyricLines]);
  const currentPractice=practiceItems[practice.idx];
  useEffect(()=>{setPractice({idx:0,pick:null,score:0,done:false});setTimingDraft((song?.lines||[]).map(l=>({...l})));setTimingExport("");lineRefs.current={};setView("lyrics");songPanelRef.current?.scrollTo({top:0})},[song?.id]);
  useEffect(()=>{if(view!=="lyrics")songPanelRef.current?.scrollTo({top:0})},[view]);
  useEffect(()=>{const a=audioRef.current;if(a)a.playbackRate=speed},[speed,song?.id]);
  useEffect(()=>{const a=audioRef.current;if(!a)return;const onTime=()=>setTime(a.currentTime||0);const onMeta=()=>setDur(a.duration||0);const onPlay=()=>setPlaying(true);const onPause=()=>setPlaying(false);const onEnd=()=>{setPlaying(false);if(song&&!rewarded.current[song.id]){rewarded.current[song.id]=true;onXp?.(10)}};a.addEventListener("timeupdate",onTime);a.addEventListener("loadedmetadata",onMeta);a.addEventListener("play",onPlay);a.addEventListener("pause",onPause);a.addEventListener("ended",onEnd);return()=>{if(!(typeof navigator!=="undefined"&&/jsdom/i.test(navigator.userAgent))){try{a.pause()}catch{}};a.removeEventListener("timeupdate",onTime);a.removeEventListener("loadedmetadata",onMeta);a.removeEventListener("play",onPlay);a.removeEventListener("pause",onPause);a.removeEventListener("ended",onEnd)}},[song?.id]);
  useEffect(()=>{if(view==="lyrics"&&activeLine>=0)scrollChildIntoPanel(songPanelRef.current,lineRefs.current[activeLine],{align:.42})},[activeLine,view,showZh,song?.id]);
  if(!song)return(<div><Hdr t="🎵 英文歌曲" onBack={onBack} cl={c.cl}/><div style={{...S.card,padding:"28px 18px",textAlign:"center"}}><div style={{fontSize:42,marginBottom:8}}>🎧</div><div style={{fontSize:16,fontWeight:700,color:S.t1}}>這個年級的歌曲準備中</div><div style={{fontSize:13,color:S.t2,marginTop:6}}>先從小學歌曲開始驗證流程，之後可逐步加入更多歌曲。</div></div></div>);
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
  const play=()=>{const a=audioRef.current;if(!a)return;a.playbackRate=speed;a.play().catch(()=>{})};
  const toggle=()=>{const a=audioRef.current;if(!a)return;if(a.paused)play();else a.pause()};
  const seekTo=(sec,auto=false)=>{const a=audioRef.current;if(!a)return;a.currentTime=Math.max(0,Math.min(sec,dur||sec));if(auto)play()};
  const seekLine=(line,auto=true)=>seekTo(calcStart(line),auto);
  const jumpLine=(delta)=>{if(!lyricLines.length)return;const base=activeLyricIdx>=0?activeLyricIdx:0;const next=Math.max(0,Math.min(lyricLines.length-1,base+delta));seekLine(lyricLines[next],true)};
  const choosePractice=(opt)=>{if(!currentPractice||practice.pick)return;const ok=opt===currentPractice.word;setPractice(p=>({...p,pick:opt,score:p.score+(ok?1:0)}));if(ok&&!rewarded.current[`${song.id}:practice:${practice.idx}`]){rewarded.current[`${song.id}:practice:${practice.idx}`]=true;onXp?.(2)}};
  const nextPractice=()=>setPractice(p=>p.idx>=practiceItems.length-1?{...p,done:true,pick:null}:{...p,idx:p.idx+1,pick:null});
  const resetPractice=()=>setPractice({idx:0,pick:null,score:0,done:false});
  const tabStyle=k=>({padding:"8px 12px",borderRadius:999,border:"none",background:view===k?c.cl:S.bg2,color:view===k?"#fff":S.t2,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"});
  return(<div><Hdr t="🎵 英文歌曲" onBack={onBack} cl={c.cl} extra={<button onClick={()=>setShowZh(z=>!z)} style={{background:S.bg1,border:`1px solid ${S.bd}`,borderRadius:8,padding:"5px 9px",fontSize:12,color:c.cl,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{showZh?"隱藏中文":"顯示中文"}</button>}/>
    {songs.length>1&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:7,marginBottom:10}}>{songs.map((s,i)=><button key={s.id} onClick={()=>{setSi(i);setTime(0);setDur(0);setPlaying(false)}} style={{padding:"10px 11px",borderRadius:12,background:i===si?c.cl:S.bg1,color:i===si?"#fff":S.t1,border:`1px solid ${i===si?c.cl:S.bd}`,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",textAlign:"left",boxShadow:i===si?"0 8px 18px rgba(15,110,86,.18)":"none"}}><div>{s.title}</div><div style={{fontSize:11,fontWeight:600,opacity:.72,marginTop:2}}>{s.theme}</div></button>)}</div>}
    <div style={{...S.card,padding:"18px 16px",marginBottom:10,borderTop:`4px solid ${c.cl}`,background:`linear-gradient(135deg,${c.bg}55,var(--color-background-primary,#fff))`}}>
      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>{hasCover?<button type="button" onClick={()=>hasAudio&&toggle()} aria-label={playing?"暫停歌曲":"播放歌曲"} title={playing?"暫停歌曲":"播放歌曲"} style={{position:"relative",width:"clamp(118px,28vw,172px)",aspectRatio:"1/1",border:`1px solid ${S.bd}`,borderRadius:16,overflow:"hidden",padding:0,background:S.bg2,boxShadow:"0 16px 34px rgba(0,0,0,.18)",cursor:hasAudio?"pointer":"default",flex:"0 0 auto"}}><img src={song.cover} alt={`${song.title} cover`} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/><span style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",width:54,height:54,borderRadius:999,background:"rgba(20,24,28,.84)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:playing?24:25,fontWeight:900,boxShadow:"0 10px 22px rgba(0,0,0,.35)"}}>{playing?"Ⅱ":"▶"}</span></button>:<div style={{width:58,height:58,borderRadius:14,background:`linear-gradient(135deg,${c.cl},${c.ac})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,color:"#fff",flexShrink:0}}>🎵</div>}<div style={{flex:"1 1 220px",minWidth:0}}><div style={{fontSize:21,fontWeight:900,color:S.t1,lineHeight:1.2}}>{song.title}</div><div style={{fontSize:12,color:S.t2,marginTop:3}}>{song.zhTitle} · {song.theme} · {song.level}</div></div></div>
      {hasAudio?<><audio ref={audioRef} src={song.audio} preload="metadata"/>
      <div style={{padding:"12px",borderRadius:14,background:S.bg1,border:`1px solid ${S.bd}`,marginBottom:10}}><div style={{fontSize:11,fontWeight:800,color:c.cl,marginBottom:5}}>現在播放</div><div style={{fontSize:16,fontWeight:900,color:S.t1,lineHeight:1.45,minHeight:24}}>{activeLyric?.en||"點播放開始，或點任一句歌詞重播。"}</div>{showZh&&activeLyric?.zh&&<div style={{fontSize:12,color:S.t2,lineHeight:1.5,marginTop:2}}>{activeLyric.zh}</div>}<div style={{height:4,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:9}}><div style={{height:"100%",width:`${linePct}%`,background:c.cl,borderRadius:999}}/></div></div>
      <div onClick={e=>{const r=e.currentTarget.getBoundingClientRect();seekTo((e.clientX-r.left)/Math.max(1,r.width)*(dur||0),false)}} style={{height:10,background:S.bg2,borderRadius:999,overflow:"hidden",cursor:"pointer",marginBottom:8}}><div style={{height:"100%",width:`${dur?Math.min(100,time/dur*100):0}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:999}}/></div>
      <div style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:S.t3,marginBottom:10}}><span>{fmt(time)}</span><span style={{flex:1,textAlign:"center"}}>{playing?"播放中":"已暫停"}</span><span>{fmt(dur||0)}</span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:8}}><button onClick={()=>jumpLine(-1)} style={{...S.btn,padding:"9px 0",fontSize:12,background:S.bg2,color:S.t1}}>上一句</button><button onClick={()=>seekTo(time-5)} style={{...S.btn,padding:"9px 0",fontSize:12,background:S.bg2,color:S.t1}}>-5秒</button><button onClick={toggle} style={{...S.btn,padding:"9px 0",fontSize:13,background:c.cl,color:"#fff"}}>{playing?"暫停":"播放"}</button><button onClick={()=>seekTo(time+5)} style={{...S.btn,padding:"9px 0",fontSize:12,background:S.bg2,color:S.t1}}>+5秒</button><button onClick={()=>jumpLine(1)} style={{...S.btn,padding:"9px 0",fontSize:12,background:S.bg2,color:S.t1}}>下一句</button></div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{[.85,1,1.15].map(v=><button key={v} onClick={()=>setSpeed(v)} style={{border:`1px solid ${speed===v?c.cl:S.bd}`,background:speed===v?c.bg:S.bg1,color:speed===v?c.cl:S.t2,borderRadius:999,padding:"6px 10px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{v===.85?"慢聽":v===1?"原速":"快聽"} {v}x</button>)}<button onClick={()=>activeLyric&&seekLine(activeLyric,true)} disabled={!activeLyric} style={{border:`1px solid ${S.bd}`,background:S.bg1,color:S.t2,borderRadius:999,padding:"6px 10px",fontSize:12,fontWeight:800,cursor:activeLyric?"pointer":"default",fontFamily:"inherit",opacity:activeLyric?1:.5}}>重播本句</button></div>
      </>:<div style={{padding:"11px 12px",border:`1px dashed ${c.cl}66`,borderRadius:12,background:S.bg1,fontSize:12,color:S.t2,lineHeight:1.6}}>音檔準備中。可以先閱讀歌詞與重點單字，產出 mp3 後再補上同步時間。</div>}
    </div>
    {timingMode&&<div style={{...S.card,padding:"13px 14px",marginBottom:10,border:`1px solid ${c.cl}`,background:c.bg}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:9}}><div style={{fontSize:14,fontWeight:900,color:c.cl}}>Timing Lab</div><div style={{fontSize:12,color:S.t2,fontWeight:800}}>Current {fmt1(time)}</div><button onClick={()=>updateLineTime(activeLine,time)} disabled={activeLine<0} style={{...S.btn,background:c.cl,color:"#fff",padding:"7px 10px",fontSize:12,opacity:activeLine>=0?1:.45}}>Set active line</button><button onClick={()=>nudgeAll(-.1)} style={{...S.btn,background:S.bg1,color:S.t1,padding:"7px 10px",fontSize:12}}>All -0.1s</button><button onClick={()=>nudgeAll(.1)} style={{...S.btn,background:S.bg1,color:S.t1,padding:"7px 10px",fontSize:12}}>All +0.1s</button><button onClick={exportTimings} style={{...S.btn,background:"#1F2937",color:"#fff",padding:"7px 10px",fontSize:12}}>Export timings</button></div>
      <div style={{fontSize:12,color:S.t2,lineHeight:1.55}}>點播放後聽到一句開始時，按該句的 Set current；若只差一點，用 -0.1s / +0.1s 微調。匯出後可把內容貼回歌曲資料。</div>
      {timingExport&&<textarea aria-label="Exported timings" readOnly value={timingExport} style={{width:"100%",minHeight:130,marginTop:10,border:`1px solid ${S.bd}`,borderRadius:10,padding:10,fontFamily:"ui-monospace,SFMono-Regular,Consolas,monospace",fontSize:11,lineHeight:1.45,background:S.bg1,color:S.t1}}/>}
    </div>}
    <div style={{display:"flex",gap:6,marginBottom:10}}><button onClick={()=>setView("lyrics")} style={tabStyle("lyrics")}>歌詞同步</button><button onClick={()=>setView("practice")} style={tabStyle("practice")}>歌詞填空</button></div>
    <div ref={songPanelRef} style={{height:"clamp(340px, calc(100vh - 430px), 680px)",minHeight:0,overflowY:"auto",overscrollBehavior:"contain",scrollBehavior:"smooth",padding:"0 4px 12px",border:`1px solid ${S.bd}`,borderRadius:12,background:"rgba(255,255,255,.42)"}}>
    {view==="lyrics"?<div style={{...S.card,padding:"14px 12px",marginBottom:10}}>
      {songLines.map((line,i)=>line.sec?<div key={i} style={{fontSize:12,fontWeight:900,color:c.cl,margin:"16px 4px 7px",letterSpacing:0}}>{line.sec}</div>:<div ref={el=>{if(el)lineRefs.current[i]=el}} key={i} onClick={()=>hasAudio&&seekLine({...line,i},true)} style={{padding:"11px 12px",borderRadius:12,background:activeLine===i?c.bg:S.bg2,border:`1px solid ${activeLine===i?c.cl:S.bd}`,marginBottom:7,cursor:hasAudio?"pointer":"default",transition:"all .15s",boxShadow:activeLine===i?"0 8px 20px rgba(15,110,86,.12)":"none"}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-start"}}><div style={{fontSize:11,color:activeLine===i?c.cl:S.t3,fontWeight:800,minWidth:34,paddingTop:3}}>{Number.isFinite(Number(line.t))?fmt(line.t):""}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,lineHeight:1.5,fontWeight:activeLine===i?900:700,color:S.t1}}>{line.en}</div>{showZh&&<div style={{fontSize:12,color:S.t2,marginTop:3,lineHeight:1.5}}>{line.zh}</div>}</div><button onClick={e=>{e.stopPropagation();seekLine({...line,i},true)}} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:999,padding:"5px 8px",fontSize:11,color:c.cl,cursor:"pointer",fontFamily:"inherit",fontWeight:800,flexShrink:0}}>重播</button></div>
        {timingMode&&<div onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:8,paddingTop:8,borderTop:`1px dashed ${S.bd}`}}><span style={{fontSize:11,fontWeight:900,color:c.cl}}>t={fmt1(line.t)}</span><button onClick={()=>updateLineTime(i,time)} style={{border:`1px solid ${c.cl}`,background:c.bg,color:c.cl,borderRadius:999,padding:"5px 8px",fontSize:11,fontWeight:900,cursor:"pointer",fontFamily:"inherit"}}>Set current</button><button onClick={()=>nudgeLine(i,-.1)} style={{border:`1px solid ${S.bd}`,background:S.bg1,color:S.t2,borderRadius:999,padding:"5px 8px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>-0.1s</button><button onClick={()=>nudgeLine(i,.1)} style={{border:`1px solid ${S.bd}`,background:S.bg1,color:S.t2,borderRadius:999,padding:"5px 8px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>+0.1s</button></div>}
      </div>)}
    </div>:<div style={{...S.card,padding:"16px",marginBottom:10}}>
      {!practiceItems.length?<div style={{fontSize:13,color:S.t2}}>這首歌還沒有可練習的填空題。</div>:practice.done?<div style={{textAlign:"center",padding:"18px 8px"}}><div style={{fontSize:42}}>🎉</div><div style={{fontSize:17,fontWeight:900,color:S.t1,marginTop:4}}>練習完成</div><div style={{fontSize:13,color:S.t2,marginTop:4}}>答對 {practice.score}/{practiceItems.length} 題</div><button onClick={resetPractice} style={{...S.btn,background:c.cl,color:"#fff",padding:"10px 18px",fontSize:13,marginTop:12}}>再練一次</button></div>:<><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{fontSize:12,fontWeight:900,color:c.cl}}>Question {practice.idx+1}/{practiceItems.length}</div><div style={{flex:1,height:6,background:S.bg2,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${((practice.idx+1)/practiceItems.length)*100}%`,background:c.cl}}/></div></div>
        <div style={{padding:"14px",borderRadius:12,background:S.bg2,border:`1px solid ${S.bd}`,marginBottom:10}}><div style={{fontSize:16,fontWeight:900,color:S.t1,lineHeight:1.5}}>{currentPractice.blank}</div>{showZh&&<div style={{fontSize:12,color:S.t2,marginTop:5}}>{currentPractice.line.zh}</div>}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:7}}>{currentPractice.options.map(opt=>{const picked=practice.pick===opt;const answered=!!practice.pick;const ok=opt===currentPractice.word;return <button key={opt} onClick={()=>choosePractice(opt)} disabled={answered} style={{border:`1px solid ${answered&&ok?c.cl:picked?"#D45757":S.bd}`,background:answered&&ok?c.bg:picked?"#FFF0F0":S.bg1,color:answered&&ok?c.cl:S.t1,borderRadius:10,padding:"10px 9px",fontSize:14,fontWeight:900,cursor:answered?"default":"pointer",fontFamily:"inherit"}}>{opt}</button>})}</div>
        {practice.pick&&<div style={{marginTop:10,padding:"10px 12px",borderRadius:10,background:practice.pick===currentPractice.word?c.bg:"#FFF0F0",color:practice.pick===currentPractice.word?c.cl:"#B54848",fontSize:13,fontWeight:900}}>{practice.pick===currentPractice.word?"答對了！":"答錯了"} 正確答案：{currentPractice.word}</div>}
        <div style={{display:"flex",gap:8,marginTop:10}}><button onClick={()=>seekLine(currentPractice.line,true)} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,padding:"10px",fontSize:13}}>聽這一句</button><button onClick={nextPractice} disabled={!practice.pick} style={{...S.btn,background:c.cl,color:"#fff",flex:1,padding:"10px",fontSize:13,opacity:practice.pick?1:.5}}>{practice.idx>=practiceItems.length-1?"完成":"下一題"}</button></div></>}
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
      <div style={{...S.card,padding:"14px 16px",fontSize:12,color:S.t2,lineHeight:1.7}}><div style={{fontWeight:900,color:S.t1,marginBottom:7}}>重點句型</div><div style={{display:"grid",gap:7}}>{(song.patterns||[]).map(p=><div key={p.p} style={{padding:"10px",border:`1px solid ${S.bd}`,borderRadius:10,background:S.bg1}}><div style={{fontSize:13,fontWeight:900,color:c.cl}}>{p.p}</div><button onClick={()=>speak(p.ex)} style={{border:"none",background:"none",padding:0,marginTop:4,fontSize:13,fontWeight:800,color:S.t1,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>{p.ex} 🔊</button>{showZh&&<div style={{fontSize:12,color:S.t2,marginTop:2}}>{p.zh}</div>}</div>)}</div></div>
      <div style={{...S.card,padding:"14px 16px",fontSize:12,color:S.t2,lineHeight:1.7}}><div style={{fontWeight:900,color:S.t1,marginBottom:7}}>重點單字</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{song.vocab.map(w=><button key={w} onClick={()=>speak(w)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:999,padding:"7px 10px",fontSize:12,color:c.cl,cursor:"pointer",fontWeight:800,fontFamily:"inherit"}}>{w} 🔊</button>)}</div></div>
    </div>
    </div>
  </div>);
}
// ═══ AI TUTOR ═══════════════════════════════════════════════════════
function AIT({lv,onBack,apiKey,onOpenSettings}){
  const c=LV[lv];const RATES=[{l:"慢速",i:"🐢",v:0.6},{l:"正常",i:"🎯",v:0.85},{l:"快速",i:"🐇",v:1.15}];
  const initialMsg=useMemo(()=>({role:"a",content:`哈囉，我是你的 AI 英語家教。\n\n你可以貼上英文句子、問文法問題，或選上方練習模式開始。\n\n我會用適合你的程度說明，並把重點英文標成 **bold**，方便朗讀和複習。`}),[]);
  const[msgs,setMsgs]=useState(()=>[initialMsg]);
  const[inp,setInp]=useState("");const[busy,setBusy]=useState(false);const[showKey,setShowKey]=useState(!apiKey);const[ri,setRi]=useState(1);const[pi,setPi]=useState(-1);const[pt,setPt]=useState(0);const[copied,setCopied]=useState(-1);const btm=useRef(null);const reqRef=useRef(null);const speakPollRef=useRef(null);
  useEffect(()=>{btm.current?.scrollIntoView?.({behavior:"smooth"})},[msgs,busy]);
  useEffect(()=>()=>{reqRef.current?.abort();if(speakPollRef.current)clearInterval(speakPollRef.current);stopSpeech()},[]);
  const promptGroups=[
    {l:"學習",items:[
      {label:"新單字",prompt:`請依照${c.l}程度，教我 3 個今天可以用的英文單字。每個單字要有中文意思、自然例句、中文翻譯和一題小練習。`},
      {label:"文法",prompt:`請用${c.l}學生聽得懂的方式，教我一個常用英文文法。請給公式、例句、常見錯誤和一題練習。`},
      {label:"每日一句",prompt:`請給我一句適合${c.l}學生的每日英文句子，包含中文意思、發音提醒、替換練習。`},
      {label:"小測驗",prompt:`請出 5 題${c.l}程度英文小測驗，題型混合單字、文法和翻譯。請先不要公布答案，等我回答後再批改。`}
    ]},
    {l:"情境",items:[
      {label:"自我介紹",prompt:"請陪我練習英文自我介紹。先給我範例，再一步一步問我問題，最後幫我整理成一段自然英文。"},
      {label:"餐廳點餐",prompt:"請陪我練習在餐廳用英文點餐。你扮演店員，我扮演客人。每次只問一句，並在我回答後給修正。"},
      {label:"問路",prompt:"請陪我練習英文問路。用簡單對話，一次一句，回答後幫我修正。"},
      {label:"學校生活",prompt:"請陪我練習學校生活英文對話，例如借鉛筆、問功課、和同學打招呼。"}
    ]},
    {l:"批改",items:[
      {label:"批改句子",prompt:"我會輸入英文句子，請幫我批改。請用：原句、修正版、為什麼、再練一句 的格式回答。"},
      {label:"中翻英",prompt:"請出一句中文讓我翻成英文。等我回答後，請幫我批改並給更自然的說法。"},
      {label:"造句",prompt:"請給我一個英文單字，讓我造句。等我回答後，請幫我批改。"},
      {label:"日記",prompt:"請教我寫一篇 4 句英文小日記。先給架構，再讓我自己試寫，最後幫我修正。"}
    ]}
  ];
  const starterCards=[
    {title:"短句上手",desc:"一句英文、中文意思、替換練習",icon:"1",tone:"#2563EB",prompt:`請用${c.l}程度帶我練一句今天能用的英文。請先給一句英文和中文，再讓我替換一個單字。`},
    {title:"生活對話",desc:"一次一句，像真人陪練",icon:"Q",tone:"#DB2777",prompt:"請陪我做一段英文情境對話。先給我 3 個情境選項，等我選好後，每次只問一句並幫我修正。"},
    {title:"精準批改",desc:"原句、修正版、原因、再練一句",icon:"✓",tone:"#D97706",prompt:"我會貼一個英文句子。請用「原句、修正版、原因、再練一句」幫我批改，說明要簡短。"}
  ];
  const systemText=`You are EnglishGo AI Tutor for a Taiwanese ${c.l} student.
Reply mainly in Traditional Chinese, with target English words or phrases in **bold**.
Keep answers short, warm, accurate, and age-appropriate.
Adjust difficulty to ${c.en}: use simple words for elementary, add grammar detail for older students.
When teaching, prefer this structure:
重點:
例句:
小練習:
Use natural English examples with Traditional Chinese translation.
For correction requests, show 原句, 修正版, 原因, 再練一句.
Ask only one follow-up question at a time.
Do not imitate copyrighted songs, books, or specific artists.`;
  const errText=(e)=>{
    const msg=String(e?.message||e||"");
    if(e?.name==="AbortError")return null;
    if(/403|API key|API_KEY|permission|invalid/i.test(msg))return "⚠️ API Key 可能無效，請重新檢查 Gemini API Key。";
    if(/429|quota|rate/i.test(msg))return "⚠️ API 額度或頻率已達上限，請稍後再試。";
    if(/503|overloaded|demand|busy/i.test(msg))return "⚠️ AI 目前忙碌，已嘗試切換模型，請稍後再試。";
    return `⚠️ AI 家教暫時無法回答\n${msg||"請稍後再試一次。"}`;
  };
  const buildContents=(userMsg)=>{
    const recent=[...msgs,userMsg].filter((m,i)=>i>0||m.role==="u").slice(-12);
    while(recent[0]?.role==="a")recent.shift();
    return recent.map(m=>({role:m.role==="u"?"user":"model",parts:[{text:m.content}]}));
  };
  const callGemini=async(contents,signal)=>{
    const models=["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.0-flash"];
    let lastErr=null;
    for(const model of models){
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent((apiKey||"").trim())}`,{
        method:"POST",headers:{"Content-Type":"application/json"},signal,
        body:JSON.stringify({systemInstruction:{parts:[{text:systemText}]},contents,generationConfig:{maxOutputTokens:900,temperature:0.65,topP:0.9}})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok||data?.error){
        const code=data?.error?.code||res.status;const msg=data?.error?.message||res.statusText||"request failed";
        lastErr=new Error(`${code} ${msg}`);
        if(code===429||code===503)continue;
        throw lastErr;
      }
      const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("").trim();
      if(text)return text;
      lastErr=new Error("AI 沒有回傳內容");
    }
    throw lastErr||new Error("AI 暫時無法回答");
  };
  const send=async(ov)=>{
    const txt=(typeof ov==="string"?ov:inp).trim();
    if(!txt||busy)return;
    if(!apiKey?.trim()){onOpenSettings?.();setShowKey(true);return}
    if(!ov)setInp("");
    const userMsg={role:"u",content:txt};
    const contents=buildContents(userMsg);
    const ctl=new AbortController();
    reqRef.current=ctl;
    setMsgs(m=>[...m,userMsg]);
    setBusy(true);
    try{
      const ans=await callGemini(contents,ctl.signal);
      setMsgs(m=>[...m,{role:"a",content:ans}]);
    }catch(e){
      const text=errText(e);
      if(text)setMsgs(m=>[...m,{role:"a",content:text}]);
    }finally{
      if(reqRef.current===ctl){reqRef.current=null;setBusy(false)}
    }
  };
  const cancelSend=()=>{reqRef.current?.abort();reqRef.current=null;setBusy(false);setMsgs(m=>[...m,{role:"a",content:"已停止本次回答。"}])};
  const doSpeak=(text,idx)=>{
    if(pi===idx){stopSpeech();setPi(-1);if(speakPollRef.current)clearInterval(speakPollRef.current);return}
    if(speakPollRef.current)clearInterval(speakPollRef.current);
    setPi(idx);speakMx(text,RATES[ri].v);
    speakPollRef.current=setInterval(()=>{if(!window.speechSynthesis.speaking){setPi(-1);clearInterval(speakPollRef.current);speakPollRef.current=null}},300);
  };
  const copyMsg=async(text,idx)=>{try{await navigator.clipboard?.writeText(text)}catch{}setCopied(idx);setTimeout(()=>setCopied(-1),900)};
  const resetChat=()=>{reqRef.current?.abort();stopSpeech();setPi(-1);setBusy(false);setMsgs([initialMsg])};
  return(<div className="ai-tutor" style={{"--ai-accent":c.cl,"--ai-accent-bg":c.bg,"--ai-accent-soft":c.ac,"--ai-card":S.bg1,"--ai-surface":S.bg2,"--ai-border":S.bd,"--ai-text":S.t1,"--ai-muted":S.t2,"--ai-faint":S.t3}}>
    <style>{`
      .ai-tutor{display:flex;flex-direction:column;height:calc(100vh - 110px);min-height:0;gap:8px}
      .ai-tutor button,.ai-tutor textarea{font-family:inherit}
      .ai-tutor-toolbar{display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
      .ai-tutor-chip{border:1px solid var(--ai-border);background:var(--ai-card);color:var(--ai-muted);border-radius:9px;padding:6px 9px;font-size:12px;font-weight:800;cursor:pointer;min-height:32px}
      .ai-tutor-status{border:1px solid var(--ai-status-border);background:var(--ai-status-bg);color:var(--ai-status-text);border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900;white-space:nowrap}
      .ai-tutor-key{border:1px solid var(--ai-border);background:linear-gradient(135deg,var(--ai-card),var(--ai-surface));border-radius:12px;padding:12px 14px;margin-bottom:2px;font-size:12px;box-shadow:0 8px 22px rgba(15,110,86,.06)}
      .ai-tutor-key-title{font-size:13px;font-weight:1000;color:var(--ai-text);margin-bottom:4px}
      .ai-tutor-key-body{color:var(--ai-muted);line-height:1.6;margin-bottom:8px}
      .ai-tutor-hero{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--ai-accent) 28%,var(--ai-border));background:linear-gradient(135deg,color-mix(in srgb,var(--ai-accent) 13%,var(--ai-card)),var(--ai-card) 52%,color-mix(in srgb,#2563EB 7%,var(--ai-card)));border-radius:16px;padding:14px;box-shadow:0 12px 28px rgba(15,110,86,.08)}
      .ai-tutor-hero:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(180deg,var(--ai-accent),#2563EB,#D97706)}
      .ai-tutor-hero-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start;margin-bottom:12px}
      .ai-tutor-kicker{font-size:11px;font-weight:1000;color:var(--ai-accent);letter-spacing:0;margin-bottom:4px}
      .ai-tutor-title{font-size:18px;font-weight:1000;color:var(--ai-text);line-height:1.15;margin:0}
      .ai-tutor-subtitle{font-size:12px;color:var(--ai-muted);line-height:1.55;margin-top:5px}
      .ai-tutor-badges{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      .ai-tutor-badge{border:1px solid color-mix(in srgb,var(--ai-accent) 28%,var(--ai-border));background:var(--ai-card);color:var(--ai-accent);border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900;white-space:nowrap}
      .ai-tutor-starter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .ai-tutor-starter{border:1px solid color-mix(in srgb,var(--card-tone) 24%,var(--ai-border));background:linear-gradient(145deg,color-mix(in srgb,var(--card-tone) 9%,var(--ai-card)),var(--ai-card));border-radius:12px;padding:11px;text-align:left;cursor:pointer;display:grid;grid-template-columns:30px minmax(0,1fr);gap:9px;align-items:start;min-height:78px;color:var(--ai-text);transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease}
      .ai-tutor-starter:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--card-tone) 55%,var(--ai-border));box-shadow:0 10px 22px color-mix(in srgb,var(--card-tone) 12%,transparent)}
      .ai-tutor-starter:disabled{cursor:default;opacity:.55;transform:none;box-shadow:none}
      .ai-tutor-starter-icon{width:30px;height:30px;border-radius:10px;background:color-mix(in srgb,var(--card-tone) 14%,var(--ai-card));color:var(--card-tone);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:1000;border:1px solid color-mix(in srgb,var(--card-tone) 20%,transparent)}
      .ai-tutor-starter-title{display:block;font-size:13px;font-weight:1000;color:var(--card-tone);line-height:1.25}
      .ai-tutor-starter-desc{display:block;font-size:11px;color:var(--ai-muted);line-height:1.4;margin-top:4px}
      .ai-tutor-chat{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:2px 1px 6px}
      .ai-tutor-row{display:flex;gap:7px;align-items:flex-start}
      .ai-tutor-row.user{justify-content:flex-end}
      .ai-tutor-avatar{width:28px;height:28px;border-radius:10px;background:var(--ai-accent-bg);color:var(--ai-accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:1000;flex:0 0 28px;border:1px solid var(--ai-accent-soft)}
      .ai-tutor-bubble{max-width:min(86%,620px);padding:11px 13px;border-radius:14px;background:var(--ai-card);color:var(--ai-text);border:1px solid var(--ai-border);font-size:13px;line-height:1.72;white-space:pre-wrap;box-shadow:0 7px 18px rgba(0,0,0,.045)}
      .ai-tutor-bubble.user{background:linear-gradient(135deg,var(--ai-accent),color-mix(in srgb,var(--ai-accent) 80%,#2563EB));color:#fff;border:0;border-radius:14px 14px 4px 14px;box-shadow:none}
      .ai-tutor-actions{display:flex;gap:5px;margin-top:8px;justify-content:flex-end;flex-wrap:wrap}
      .ai-tutor-action{border:1px solid var(--ai-border);background:var(--ai-surface);color:var(--ai-muted);border-radius:999px;padding:4px 8px;font-size:11px;cursor:pointer;font-weight:800}
      .ai-tutor-action.active{background:var(--ai-accent-bg);color:var(--ai-accent)}
      .ai-tutor-thinking{align-self:flex-start;display:flex;align-items:center;gap:8px;border:1px solid var(--ai-border);background:var(--ai-card);border-radius:14px;padding:10px 12px;font-size:12px;color:var(--ai-muted)}
      .ai-tutor-promptbar{flex-shrink:0;border-top:1px solid var(--ai-border);padding-top:7px}
      .ai-tutor-tabs{display:flex;gap:5px;margin-bottom:6px;overflow-x:auto;scrollbar-width:none}
      .ai-tutor-tabs::-webkit-scrollbar,.ai-tutor-prompts::-webkit-scrollbar{display:none}
      .ai-tutor-tab{border:0;background:var(--ai-surface);color:var(--ai-muted);border-radius:999px;padding:6px 11px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap}
      .ai-tutor-tab.active{background:var(--ai-accent);color:#fff}
      .ai-tutor-prompts{display:flex;gap:6px;overflow-x:auto;padding-bottom:5px}
      .ai-tutor-prompt{flex:0 0 auto;border:1px solid var(--ai-border);background:var(--ai-card);color:var(--ai-muted);border-radius:999px;padding:7px 10px;font-size:12px;cursor:pointer;white-space:nowrap}
      .ai-tutor-compose{display:flex;gap:7px;align-items:flex-end;flex-shrink:0;padding-top:2px}
      .ai-tutor-compose textarea{flex:1;padding:12px;border-radius:12px;border:1px solid var(--ai-border);font-size:13px;outline:none;background:var(--ai-card);color:var(--ai-text);resize:none;min-height:45px;max-height:108px;line-height:1.5;box-sizing:border-box}
      .ai-tutor-send{border:0;background:var(--ai-accent);color:#fff;border-radius:12px;padding:12px 16px;min-width:66px;font-size:13px;font-weight:900;cursor:pointer}
      .ai-tutor-send:disabled{opacity:.48;cursor:default}
      @media (max-width:620px){
        .ai-tutor{height:calc(100vh - 98px)}
        .ai-tutor-hero{padding:12px;border-radius:14px}
        .ai-tutor-hero-head{grid-template-columns:1fr;gap:7px}
        .ai-tutor-badges{justify-content:flex-start}
        .ai-tutor-starter-grid{grid-template-columns:1fr}
        .ai-tutor-bubble{max-width:calc(100% - 36px)}
      }
    `}</style>
    <Hdr t="AI 英語家教" onBack={onBack} cl={c.cl} extra={<div className="ai-tutor-toolbar"><span className="ai-tutor-status" style={{"--ai-status-text":apiKey?c.cl:"#B42318","--ai-status-bg":apiKey?c.bg:"#FCEBEB","--ai-status-border":apiKey?c.ac:"#F5B5B5"}}>{apiKey?"Gemini 已就緒":"需要 Key"}</span><button className="ai-tutor-chip" onClick={()=>setRi(r=>(r+1)%3)} title="調整朗讀速度">{RATES[ri].i}{RATES[ri].l}</button><button className="ai-tutor-chip" onClick={resetChat} title="清空對話">清空</button><button className="ai-tutor-chip" onClick={()=>onOpenSettings?.()} title="API Key 設定">{apiKey?"🔑":"⚙️"}</button></div>}/>
    {showKey&&<div className="ai-tutor-key"><div className="ai-tutor-key-title">Gemini API Key</div><div className="ai-tutor-key-body">AI 家教共用全站 Gemini Key。請到統一設定頁輸入或更新。</div><button onClick={()=>onOpenSettings?.()} style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 14px",fontSize:12}}>前往 Key 設定</button></div>}
    <section data-testid="ai-tutor-starters" className="ai-tutor-hero">
      <div className="ai-tutor-hero-head">
        <div>
          <div className="ai-tutor-kicker">AI Tutor</div>
          <h3 className="ai-tutor-title">家教練習室</h3>
          <div className="ai-tutor-subtitle">先選模式，再用聊天微調。</div>
        </div>
        <div className="ai-tutor-badges">
          <span className="ai-tutor-badge">{c.l}</span>
          <span className="ai-tutor-badge">可朗讀、可複製</span>
        </div>
      </div>
      <div className="ai-tutor-starter-grid">
        {starterCards.map(card=><button key={card.title} className="ai-tutor-starter" style={{"--card-tone":card.tone}} onClick={()=>send(card.prompt)} disabled={busy}>
          <span className="ai-tutor-starter-icon">{card.icon}</span>
          <span><span className="ai-tutor-starter-title">{card.title}</span><span className="ai-tutor-starter-desc">{card.desc}</span></span>
        </button>)}
      </div>
    </section>
    <div className="ai-tutor-chat">
      {msgs.map((m,i)=>(<div key={i} className={`ai-tutor-row ${m.role==="u"?"user":""}`}>{m.role==="a"&&<div className="ai-tutor-avatar">AI</div>}<div className={`ai-tutor-bubble ${m.role==="u"?"user":""}`}>{m.role==="u"?m.content:<><Md text={m.content} color={c.cl}/><div className="ai-tutor-actions"><button onClick={()=>doSpeak(m.content,i)} className={`ai-tutor-action ${pi===i?"active":""}`}>{pi===i?"停止":"朗讀"}</button><button onClick={()=>copyMsg(m.content,i)} className="ai-tutor-action">{copied===i?"已複製":"複製"}</button></div></>}</div></div>))}
      {busy&&<div className="ai-tutor-thinking"><span style={{animation:"pulse 1.2s ease-in-out infinite"}}>AI 家教整理回答中...</span><button onClick={cancelSend} className="ai-tutor-action">停止</button></div>}
      <div ref={btm}/>
    </div>
    <div className="ai-tutor-promptbar"><div className="ai-tutor-tabs">{promptGroups.map((g,i)=>(<button key={i} onClick={()=>setPt(i)} className={`ai-tutor-tab ${pt===i?"active":""}`}>{g.l}</button>))}</div><div className="ai-tutor-prompts">{promptGroups[pt].items.map((p,i)=>(<button key={i} onClick={()=>send(p.prompt)} disabled={busy} className="ai-tutor-prompt" style={{opacity:busy?0.55:1,cursor:busy?"default":"pointer"}}>{p.label}</button>))}</div></div>
    <div className="ai-tutor-compose"><textarea value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} rows={1} placeholder={apiKey?"輸入英文問題、句子或想練習的主題...":"先設定 API Key ↑"}/><button onClick={()=>send()} disabled={busy||!inp.trim()} className="ai-tutor-send">發送</button></div>
  </div>);
}
// ═══ ACHIEVEMENTS PAGE ══════════════════════════════════════════════
function AchPage({onBack,unlocked,c}){
  return(<div><Hdr t="🏆 成就徽章" onBack={onBack} cl={c.cl}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
      {ACH_DEFS.map(a=>{const ok=unlocked.includes(a.id);return(
        <div key={a.id} style={{...S.card,padding:"18px 12px",textAlign:"center",opacity:ok?1:.4,transition:"all .2s"}}>
          <div style={{fontSize:48,marginBottom:8,filter:ok?"none":"grayscale(1)",animation:ok?"emojiFloat 3s ease-in-out infinite":"none"}}>{a.icon}</div>
          <div style={{fontWeight:600,fontSize:13,color:ok?S.t1:S.t3}}>{a.name}</div>
          <div style={{fontSize:12,color:S.t2,marginTop:2}}>{a.desc}</div>
          {ok&&<div style={{fontSize:11,color:c.cl,marginTop:4,fontWeight:600}}>已解鎖 ✓</div>}
        </div>
      )})}
    </div>
  </div>);
}
// ═══ STORY READER (故事閱讀器 - 帶朗讀高亮) ═══════════════════════
function StoryReader({story,pageIdx,setPageIdx,selectedPet,c,onNext,onExit}){
  const page=story.pages[pageIdx];
  const[charIdx,setCharIdx]=useState(-1);// char being spoken (for highlighting)
  const[playing,setPlaying]=useState(false);
  const[playingAll,setPlayingAll]=useState(false);// reading the whole page
  const[voiceName,setVoiceName]=useState("");
  const utterRef=useRef(null);
  const fallbackTimerRef=useRef(null);
  const storyHandleRef=useRef(null);

  // Get best voice name for display
  useEffect(()=>{
    const load=()=>{
      const v=getBestEnVoice();
      if(v)setVoiceName(v.name.replace(/Microsoft |Google |Apple /,"").slice(0,30));
    };
    load();
    window.speechSynthesis?.addEventListener?.("voiceschanged",load);
    return()=>window.speechSynthesis?.removeEventListener?.("voiceschanged",load);
  },[]);

  // Clean up on unmount or page change
  useEffect(()=>{
    return()=>{
      stopSpeech();
      if(fallbackTimerRef.current)clearTimeout(fallbackTimerRef.current);
      if(storyHandleRef.current)storyHandleRef.current.cancel();
      setPlaying(false);
      setCharIdx(-1);
    };
  },[pageIdx]);

  // playPage declared before useEffect that uses it (avoid TDZ issues)
  const playPage=useCallback(()=>{
    stopSpeech();
    if(fallbackTimerRef.current)clearTimeout(fallbackTimerRef.current);
    setPlaying(true);setCharIdx(0);setPlayingAll(false);

    // Fallback word highlighter for mobile browsers (onboundary not supported)
    // Use chained setTimeout with per-word duration based on length & punctuation
    const text=page.en;
    const words=text.split(/(\s+)/);// keep whitespace tokens
    const wordTokens=[];// {word, startIdx, durMs}
    let pos=0;
    const RATE=0.88;
    // Average reading speed: ~150 wpm at rate 1.0 = 400ms/word
    // At rate 0.88: ~455ms/word baseline
    // Per-character timing helps with long/short words
    const baseMsPerChar=72;// ~72ms per char average at rate 0.88
    for(const tok of words){
      if(/\s/.test(tok)){
        pos+=tok.length;
        continue;
      }
      // Calculate this word's duration based on char count + punctuation pause
      const lettersOnly=tok.replace(/[^a-zA-Z]/g,"");
      let dur=Math.max(180,lettersOnly.length*baseMsPerChar);
      // Punctuation adds pause AFTER the word
      if(/[.!?]$/.test(tok))dur+=400;// sentence-ending pause
      else if(/[,;:]$/.test(tok))dur+=200;// clause pause
      else if(/[—–]$/.test(tok))dur+=250;// dash pause
      wordTokens.push({startIdx:pos,durMs:dur});
      pos+=tok.length;
    }

    let useFallback=true;// onboundary will disable if it fires
    let cancelled=false;
    let curIdx=0;
    const tickWord=()=>{
      if(cancelled||!useFallback)return;
      if(curIdx>=wordTokens.length)return;
      setCharIdx(wordTokens[curIdx].startIdx);
      const thisDur=wordTokens[curIdx].durMs;
      curIdx++;
      fallbackTimerRef.current=setTimeout(tickWord,thisDur);
    };
    // Start with small delay to give TTS time to initialize
    fallbackTimerRef.current=setTimeout(tickWord,150);

    const u=speak(text,"en-US",RATE,{
      pitch:1.08,
      onboundary:(ev)=>{
        // Real boundary event fired - disable fallback and use real data
        useFallback=false;
        if(fallbackTimerRef.current){clearTimeout(fallbackTimerRef.current);fallbackTimerRef.current=null}
        if(ev.name==="word"||ev.charIndex!==undefined){
          setCharIdx(ev.charIndex);
        }
      },
      onend:()=>{
        cancelled=true;
        if(fallbackTimerRef.current){clearTimeout(fallbackTimerRef.current);fallbackTimerRef.current=null}
        setPlaying(false);setCharIdx(-1);
      },
      oncancel:()=>{
        cancelled=true;
        if(fallbackTimerRef.current){clearTimeout(fallbackTimerRef.current);fallbackTimerRef.current=null}
        setPlaying(false);setCharIdx(-1);
      },
    });
    utterRef.current=u;

    // Return cleanup for this play session
    return()=>{cancelled=true;if(fallbackTimerRef.current)clearTimeout(fallbackTimerRef.current)};
  },[page.en]);

  // Auto-play on page load
  useEffect(()=>{
    const t=setTimeout(()=>playPage(),400);
    return()=>clearTimeout(t);
  },[pageIdx,playPage]);

  const stopPlay=()=>{
    stopSpeech();
    if(fallbackTimerRef.current)clearTimeout(fallbackTimerRef.current);
    if(storyHandleRef.current){storyHandleRef.current.cancel();storyHandleRef.current=null}
    setPlaying(false);setCharIdx(-1);setPlayingAll(false);
  };

  // Play all pages one by one (story mode)
  const playAllStory=()=>{
    stopSpeech();
    if(fallbackTimerRef.current)clearTimeout(fallbackTimerRef.current);
    if(storyHandleRef.current)storyHandleRef.current.cancel();
    setPlayingAll(true);setPlaying(true);
    const sentences=story.pages.map(p=>p.en);
    storyHandleRef.current=speakStory(sentences,{
      rate:0.88,
      pitch:1.08,
      onSentence:(idx)=>{
        setPageIdx(idx);
        setCharIdx(0);
      },
      onFinish:()=>{setPlaying(false);setPlayingAll(false);setCharIdx(-1);storyHandleRef.current=null},
      oncancel:()=>{setPlaying(false);setPlayingAll(false);setCharIdx(-1);storyHandleRef.current=null},
    });
  };

  // Build highlighted text: split into words, highlight the one being spoken
  const renderHighlightedText=()=>{
    if(charIdx<0||!playing){
      return(<span>{page.en}</span>);
    }
    // Find word boundary containing charIdx
    const text=page.en;
    let wordStart=Math.min(charIdx,text.length-1);
    let wordEnd=wordStart;
    // Walk back to find word start
    while(wordStart>0&&/\S/.test(text[wordStart-1]))wordStart--;
    // Walk forward to find word end
    while(wordEnd<text.length&&/\S/.test(text[wordEnd]))wordEnd++;
    return(<>
      <span>{text.slice(0,wordStart)}</span>
      <span style={{background:`${c.cl}33`,padding:"2px 4px",borderRadius:4,color:c.cl,fontWeight:700,transition:"all .15s"}}>{text.slice(wordStart,wordEnd)}</span>
      <span>{text.slice(wordEnd)}</span>
    </>);
  };
  const focusLine=page?.word?`本頁重點：${page.word}${page.meaning?` · ${page.meaning}`:""}`:"";

  return(<div><Hdr t={`📖 ${story.zh_title}`} onBack={()=>{stopPlay();onExit()}} cl={c.cl} extra={<button onClick={playAllStory} disabled={playing&&!playingAll} style={{background:playingAll?c.cl:"none",border:`1px solid ${c.cl}`,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:playing&&!playingAll?"default":"pointer",color:playingAll?"#fff":c.cl,opacity:playing&&!playingAll?.4:1}}>{playingAll?"📖 朗讀中...":"🎙️ 整本朗讀"}</button>}/>
    {/* Progress dots */}
    <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:12}}>
      {story.pages.map((_,i)=>(<div key={i} style={{width:24,height:4,background:i<=pageIdx?c.cl:S.bg2,borderRadius:2,transition:"background .3s"}}/>))}
    </div>
    <div style={{...S.card,padding:"10px 12px",marginBottom:12,display:"flex",gap:8,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",background:"var(--color-background-primary,#fff)"}}>
      <div style={{minWidth:0}}>
        <div style={{fontSize:12,fontWeight:800,color:c.cl}}>{story.level_label||"AI 英文故事"}</div>
        {story.summary&&<div style={{fontSize:11,color:S.t2,lineHeight:1.5,marginTop:2}}>{story.summary}</div>}
      </div>
      <div style={{fontSize:11,fontWeight:800,color:S.t2,background:S.bg2,borderRadius:999,padding:"5px 9px",whiteSpace:"nowrap"}}>第 {pageIdx+1} 頁 / 共 {story.pages.length} 頁</div>
    </div>

    {/* Story card */}
    <div style={{...S.card,padding:"20px 18px",marginBottom:12,minHeight:280,background:`linear-gradient(135deg,${c.bg}66,var(--color-background-primary,#fff))`,border:`2px solid ${c.cl}33`,position:"relative"}}>
      {/* Playing indicator */}
      {playing&&<div style={{position:"absolute",top:10,right:10,background:c.cl,color:"#fff",borderRadius:10,padding:"3px 8px",fontSize:10,fontWeight:700,animation:"emojiPulse 1s infinite"}}>🎙️ 朗讀中</div>}

      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
        <PixelPet petId={selectedPet.petId} stage={getPetStage(selectedPet)} size={96} animate={playing}/>
      </div>

      {focusLine&&<div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
        <button type="button" onClick={()=>speak(page.word,"en-US",0.85,{pitch:1.1})} style={{border:`1px solid ${c.cl}55`,background:"var(--color-background-primary,#fff)",color:c.cl,borderRadius:999,padding:"6px 12px",fontSize:12,fontWeight:800,cursor:"pointer",boxShadow:`0 8px 18px ${c.cl}14`}}>{focusLine}</button>
      </div>}

      {/* English text (big, with word highlighting) */}
      <div style={{fontSize:18,fontWeight:500,color:S.t1,lineHeight:1.75,textAlign:"center",margin:"0 0 14px",minHeight:60}}>
        {renderHighlightedText()}
      </div>

      {/* Chinese translation */}
      <div style={{fontSize:13,color:S.t2,textAlign:"center",lineHeight:1.7,padding:"8px 12px",background:S.bg2,borderRadius:8}}>
        {page.zh}
      </div>

      {/* Keywords */}
      {page.keywords&&page.keywords.length>0&&<div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center"}}>
        {page.keywords.map((kw,i)=>(<span key={i} onClick={()=>speak(kw,"en-US",0.85,{pitch:1.1})} style={{padding:"4px 10px",background:c.bg,border:`1px solid ${c.cl}`,borderRadius:12,fontSize:12,color:c.cl,cursor:"pointer",fontWeight:600,WebkitTapHighlightColor:"transparent"}}>🔊 {kw}</span>))}
      </div>}
    </div>

    {/* Voice info */}
    {voiceName&&<div style={{textAlign:"center",fontSize:10,color:S.t3,marginBottom:10}}>🎤 {voiceName}</div>}

    {/* Controls */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <button onClick={playing?stopPlay:playPage} style={{...S.btn,background:playing?"#E24B4A":S.bg2,color:playing?"#fff":S.t1,padding:"14px",fontSize:13}}>{playing?"⏹️ 停止":"🔊 再聽一次"}</button>
      <button onClick={()=>{stopPlay();onNext()}} style={{...S.btn,background:c.cl,color:"#fff",padding:"14px",fontSize:13}}>{pageIdx<story.pages.length-1?"下一頁 →":"📝 開始測驗"}</button>
    </div>

  </div>);
}

// ═══ AI STORY MODE (AI 故事模式 - 用你的寵物做主角) ═══════════════════
const STORY_LEVEL_PROFILES={
  elem:{
    promptName:"elementary",
    label:"小學 A1 友善故事",
    pages:4,
    pageRule:"1-2 short sentences per page. Use familiar school, family, food, pet, action, and feeling words.",
    languageRule:"A1-A2 words, present tense first, no idioms, no long clauses.",
    quizRule:"Questions should check obvious facts from the story.",
  },
  junior:{
    promptName:"junior high",
    label:"國中 A2-B1 劇情故事",
    pages:5,
    pageRule:"2-3 clear sentences per page. Include a simple problem, action, turning point, and resolution.",
    languageRule:"A2-B1 words, natural connectors, one useful phrase per page, still easy to translate.",
    quizRule:"Questions should check facts, cause-effect, and one simple inference.",
  },
  senior:{
    promptName:"senior high",
    label:"高中 B1-B2 閱讀故事",
    pages:5,
    pageRule:"2-3 richer sentences per page with a clear plot and meaningful theme.",
    languageRule:"B1-B2 vocabulary, controlled complex sentences, useful academic or expressive words.",
    quizRule:"Questions should check facts, inference, and the story message.",
  },
};

function cleanStoryText(value,fallback=""){
  return String(value||fallback).replace(/\s+/g," ").trim();
}

function pickStoryFocusWord(page){
  const en=cleanStoryText(page?.en);
  const candidates=[
    page?.word,
    page?.focus_word,
    ...(Array.isArray(page?.keywords)?page.keywords:[]),
  ].map(w=>cleanStoryText(w).replace(/[^\w'-]/g,"")).filter(Boolean);
  const lowerEn=en.toLowerCase();
  const matched=candidates.find(w=>lowerEn.includes(w.toLowerCase()));
  if(matched)return matched;
  const words=en.match(/[A-Za-z][A-Za-z'-]{2,}/g)||[];
  return words[0]||"story";
}

function normalizeStoryPayload(raw,{lv,petName,themeName}){
  const profile=STORY_LEVEL_PROFILES[lv]||STORY_LEVEL_PROFILES.elem;
  const rawPages=Array.isArray(raw?.pages)?raw.pages:[];
  const pages=rawPages.slice(0,profile.pages).map((page,idx)=>{
    const en=cleanStoryText(page?.en,`Page ${idx+1} is about ${petName}.`);
    const zh=cleanStoryText(page?.zh,`第 ${idx+1} 頁是關於${petName}的故事。`);
    const word=pickStoryFocusWord({...page,en});
    const meaning=cleanStoryText(page?.meaning||page?.zh_word||page?.word_zh,word);
    const keywords=[word,...(Array.isArray(page?.keywords)?page.keywords:[])]
      .map(k=>cleanStoryText(k).replace(/[^\w'-]/g,""))
      .filter(Boolean)
      .filter((k,i,arr)=>arr.findIndex(x=>x.toLowerCase()===k.toLowerCase())===i)
      .slice(0,3);
    return{...page,en,zh,word,meaning,keywords};
  });
  while(pages.length<profile.pages){
    const idx=pages.length;
    pages.push({
      en:`${petName} learns a new word in the ${themeName} story.`,
      zh:`${petName}在${themeName}故事中學到一個新單字。`,
      word:"learns",
      meaning:"學到",
      keywords:["learns","story"],
    });
  }

  const rawQuestions=Array.isArray(raw?.questions)?raw.questions:[];
  const questions=rawQuestions.slice(0,3).map((q,idx)=>{
    const choices=Array.isArray(q?.choices)?q.choices:Array.isArray(q?.options)?q.options:[];
    const safeChoices=choices.map(ch=>cleanStoryText(ch)).filter(Boolean).slice(0,4);
    while(safeChoices.length<4)safeChoices.push(["A story detail","A different place","A new friend","A wrong idea"][safeChoices.length]);
    const correct=Number.isInteger(q?.correct)?q.correct:Number.isInteger(q?.answer)?q.answer:0;
    return{
      q:cleanStoryText(q?.q||q?.question,`Question ${idx+1}: What happens in the story?`),
      zh_q:cleanStoryText(q?.zh_q||q?.zh_question,""),
      choices:safeChoices,
      correct:Math.min(Math.max(correct,0),safeChoices.length-1),
      explain:cleanStoryText(q?.explain||q?.explanation,"答案可以從故事內容找到。"),
    };
  });
  while(questions.length<3){
    questions.push({
      q:"What is this story mainly about?",
      choices:[petName,"A bus","A game score","A rainy day"],
      correct:0,
      explain:`故事主角是 ${petName}。`,
    });
  }

  return{
    title:cleanStoryText(raw?.title,`${petName}'s ${themeName} Story`),
    zh_title:cleanStoryText(raw?.zh_title,`${petName}的${themeName}故事`),
    level_label:cleanStoryText(raw?.level_label,profile.label),
    summary:cleanStoryText(raw?.summary,`一個適合${profile.label}的${themeName}故事。`),
    pages,
    questions,
  };
}

function StoryMode({lv,onBack,apiKey,pets,c,onXp,trackWeak,onOpenSettings}){
  const[step,setStep]=useState("setup");// setup | loading | reading | quiz | done
  const[selectedPet,setSelectedPet]=useState(pets[0]||null);
  const[theme,setTheme]=useState("adventure");
  const[story,setStory]=useState(null);// {title, zh_title, pages[], questions[]}
  const[pageIdx,setPageIdx]=useState(0);
  const[quizIdx,setQuizIdx]=useState(0);
  const[quizAnswered,setQuizAnswered]=useState(null);
  const[quizScore,setQuizScore]=useState(0);
  const[showApiKeyInput,setShowApiKeyInput]=useState(false);
  const[error,setError]=useState("");

  const themes=[
    {id:"adventure",icon:"🗺️",name:"冒險",desc:"勇闖神秘地方"},
    {id:"friendship",icon:"💖",name:"友情",desc:"交新朋友的故事"},
    {id:"food",icon:"🍰",name:"美食",desc:"吃遍各種食物"},
    {id:"magic",icon:"✨",name:"魔法",desc:"學會神奇魔法"},
    {id:"school",icon:"🏫",name:"學校",desc:"校園生活故事"},
    {id:"space",icon:"🚀",name:"太空",desc:"太空探索之旅"},
  ];
  const storyProfile=STORY_LEVEL_PROFILES[lv]||STORY_LEVEL_PROFILES.elem;

  const genStory=async()=>{
    if(!apiKey){onOpenSettings?.();setShowApiKeyInput(true);return}
    if(!selectedPet){setError("請先擁有一隻寵物！去扭蛋機抽一隻吧");return}
    setStep("loading");setError("");
    const petName=PETS[selectedPet.rarity].find(p=>p.id===selectedPet.petId)?.name||"寵物";
    const themeObj=themes.find(t=>t.id===theme);
    const levelProfile=storyProfile;
    const prompt=`Create an engaging, school-safe English story for a Taiwanese ${levelProfile.promptName} student.

Main character: A pet named "${petName}" (${selectedPet.petId}).
Theme: ${themeObj.name} (${themeObj.desc}).
Level rules for ${levelProfile.promptName}:
- ${levelProfile.pageRule}
- ${levelProfile.languageRule}
- Keep English and Chinese aligned page by page.
- Avoid violence, romance, horror, politics, adult topics, and scary endings.
- Each page must have one focus word that appears in that page's English text.

After the story, create 3 comprehension questions with 4 choices each. ${levelProfile.quizRule}

The "pages" array must contain exactly ${levelProfile.pages} page objects.

Return STRICT JSON only (no markdown, no explanations):
{
  "title": "Story Title in English",
  "zh_title": "中文標題",
  "level_label": "${levelProfile.label}",
  "summary": "一行中文故事大綱",
  "pages": [
    {"en": "English text", "zh": "中文翻譯", "word": "focus word", "meaning": "中文意思", "keywords": ["focus word", "useful word"]},
    {"en": "...", "zh": "...", "word": "focus word", "meaning": "...", "keywords": [...]},
    {"en": "...", "zh": "...", "word": "focus word", "meaning": "...", "keywords": [...]},
    {"en": "...", "zh": "...", "word": "focus word", "meaning": "...", "keywords": [...]}
  ],
  "questions": [
    {"q": "Question in English", "zh_q": "中文題目", "choices": ["A", "B", "C", "D"], "correct": 0, "explain": "中文解釋"},
    {"q": "...", "zh_q": "...", "choices": [...], "correct": 0, "explain": "..."},
    {"q": "...", "zh_q": "...", "choices": [...], "correct": 0, "explain": "..."}
  ]
}`;
    try{
      // Try main model first, fall back to lite if overloaded
      const models=["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.0-flash"];
      let lastErr=null,parsed=null;

      outer:for(const model of models){
        // Up to 3 retries per model with exponential backoff
        for(let attempt=0;attempt<3;attempt++){
          try{
            const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{
              method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({
                contents:[{parts:[{text:prompt}]}],
                generationConfig:{maxOutputTokens:2500,temperature:0.85,responseMimeType:"application/json"},
              }),
            });
            const data=await res.json();

            // Handle overload explicitly
            if(data?.error){
              const msg=data.error.message||"";
              if(msg.includes("high demand")||msg.includes("overloaded")||data.error.code===503||data.error.code===429){
                lastErr=new Error("模型忙碌中");
                // Wait before retry: 1s, 2s, 4s
                await new Promise(r=>setTimeout(r,1000*Math.pow(2,attempt)));
                continue;// retry same model
              }
              // Other errors (invalid key, quota) → throw to outer
              lastErr=new Error(msg);
              break;
            }

            let text=data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if(!text){lastErr=new Error("AI 沒回傳內容");break}

            // Extract JSON from response (handles ```json blocks, prefix text, etc)
            text=text.trim();
            // Remove ```json or ``` wrappers
            text=text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"");
            // Find first { and last } to extract JSON
            const s=text.indexOf("{");const e=text.lastIndexOf("}");
            if(s>=0&&e>s)text=text.slice(s,e+1);

            try{
              parsed=JSON.parse(text);
            }catch(je){
              lastErr=new Error("AI 回傳格式有問題，重試中...");
              await new Promise(r=>setTimeout(r,1500));
              continue;// retry same model
            }

            if(!parsed.pages||!parsed.questions||!Array.isArray(parsed.pages)){
              lastErr=new Error("故事內容不完整");
              await new Promise(r=>setTimeout(r,1500));
              continue;
            }

            parsed=normalizeStoryPayload(parsed,{lv,petName,themeName:themeObj.name});

            // Success - break out of both loops
            break outer;
          }catch(fetchErr){
            lastErr=fetchErr;
            await new Promise(r=>setTimeout(r,1000));
          }
        }
      }

      if(!parsed)throw lastErr||new Error("生成失敗");

      setStory(parsed);
      setPageIdx(0);setQuizIdx(0);setQuizAnswered(null);setQuizScore(0);
      setStep("reading");
    }catch(e){
      const msg=e.message||"";
      let userMsg="故事生成失敗";
      if(msg.includes("忙碌")||msg.includes("demand")||msg.includes("overloaded")){
        userMsg="AI 目前很忙，請稍後再試一次\n（已自動重試多次和切換模型）";
      }else if(msg.includes("API")||msg.includes("key")||msg.includes("403")){
        userMsg="API Key 無效，請檢查設定";
      }else{
        userMsg="故事生成失敗："+msg+"\n請再試一次";
      }
      setError(userMsg);
      setStep("setup");
    }
  };

  const nextPage=()=>{
    if(pageIdx<story.pages.length-1)setPageIdx(pageIdx+1);
    else setStep("quiz");
  };

  const answerQuiz=(idx)=>{
    if(quizAnswered!==null)return;
    setQuizAnswered(idx);
    const correct=idx===story.questions[quizIdx].correct;
    if(correct){setQuizScore(s=>s+1);onXp&&onXp(10)}
    else{trackWeak&&trackWeak(story.questions[quizIdx].q.split(" ")[0])}
  };

  const nextQuiz=()=>{
    if(quizIdx<story.questions.length-1){setQuizIdx(quizIdx+1);setQuizAnswered(null)}
    else setStep("done");
  };

  // API Key input
  if(showApiKeyInput){
    return(<div><Hdr t="🔑 設定 Gemini API" onBack={()=>setShowApiKeyInput(false)} cl={c.cl}/>
      <div style={{...S.card,padding:"20px"}}>
        <div style={{fontSize:13,color:S.t2,lineHeight:1.7,marginBottom:14}}>
          故事模式共用全站 Gemini API Key。請到統一設定頁輸入或更新，回來後即可開始產生故事。<br/>
          也可以到 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style={{color:c.cl}}>Google AI Studio</a> 建立 API Key。
        </div>
        <button onClick={()=>onOpenSettings?.()} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:14,marginTop:12}}>前往 Key 設定</button>
      </div>
    </div>);
  }

  // Setup: choose pet + theme
  if(step==="setup"){
    if(pets.length===0){
      return(<div><Hdr t="📖 AI 故事" onBack={onBack} cl={c.cl}/>
        <div style={{...S.card,padding:"32px 20px",textAlign:"center"}}>
          <div style={{fontSize:56}}>🐾</div>
          <div style={{fontSize:16,fontWeight:600,color:S.t1,marginTop:8}}>還沒有寵物</div>
          <div style={{fontSize:13,color:S.t2,marginTop:4}}>要先擁有一隻寵物才能當故事主角喔！</div>
          <div style={{fontSize:12,color:S.t3,marginTop:12}}>去「🎰 扭蛋機」抽一隻寵物吧</div>
        </div>
      </div>);
    }
    return(<div><Hdr t="📖 AI 故事" onBack={onBack} cl={c.cl}/>
      <div style={{...S.card,padding:"14px 16px",marginBottom:12,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
        <div style={{fontSize:14,fontWeight:700,color:S.t1}}>📖 用你的寵物創造英文故事</div>
        <div style={{fontSize:12,color:S.t2,marginTop:4,lineHeight:1.6}}>AI 會產生英中對照、重點單字與閱讀測驗</div>
        <div style={{fontSize:11,color:S.t3,marginTop:4,lineHeight:1.55}}>系統會依目前年級調整篇幅、句型和單字難度，故事讀完後再做 3 題理解測驗。</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
          {[storyProfile.label,`${storyProfile.pages} 頁故事`,"3 題測驗"].map(item=><span key={item} style={{fontSize:10,fontWeight:800,color:c.cl,background:"var(--color-background-primary,#fff)",border:`1px solid ${c.cl}33`,borderRadius:999,padding:"4px 8px"}}>{item}</span>)}
        </div>
      </div>

      {/* Pet selector */}
      <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:600,color:S.t1,marginBottom:10}}>🐾 選主角</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(104px,1fr))",gap:8}}>
          {pets.map(p=>{const pd=PETS[p.rarity].find(x=>x.id===p.petId);if(!pd)return null;const ri=RARITY_INFO[p.rarity];const sel=selectedPet?.petId===p.petId;return(<div key={p.petId} onClick={()=>setSelectedPet(p)} style={{padding:"10px 6px",border:sel?`2px solid ${c.cl}`:`1px solid ${S.bd}`,borderRadius:10,textAlign:"center",cursor:"pointer",background:sel?`${c.cl}11`:"transparent"}}>
            <div style={{display:"flex",justifyContent:"center"}}><PixelPet petId={p.petId} stage={getPetStage(p)} size={44} animate={false}/></div>
            <div style={{fontSize:11,fontWeight:600,color:S.t1,marginTop:4}}>{pd.name}</div>
            <div style={{fontSize:9,color:ri.color}}>Lv.{p.level}</div>
          </div>)})}
        </div>
      </div>

      {/* Theme selector */}
      <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:600,color:S.t1,marginBottom:10}}>🎨 選主題</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8}}>
          {themes.map(t=>(<div key={t.id} onClick={()=>setTheme(t.id)} style={{padding:"10px",border:theme===t.id?`2px solid ${c.cl}`:`1px solid ${S.bd}`,borderRadius:10,cursor:"pointer",background:theme===t.id?`${c.cl}11`:"transparent"}}>
            <div style={{fontSize:22}}>{t.icon}</div>
            <div style={{fontSize:13,fontWeight:600,color:S.t1,marginTop:2}}>{t.name}</div>
            <div style={{fontSize:10,color:S.t3}}>{t.desc}</div>
          </div>))}
        </div>
      </div>

      {error&&<div style={{padding:"10px 14px",background:"#FCEBEB",border:"1px solid #E24B4A",borderRadius:10,color:"#A32D2D",fontSize:12,marginBottom:12,whiteSpace:"pre-wrap"}}>❌ {error}</div>}

      <button onClick={genStory} style={{...S.btn,background:`linear-gradient(135deg,${c.cl},${c.ac})`,color:"#fff",width:"100%",padding:"16px",fontSize:15,boxShadow:`0 4px 12px ${c.cl}44`}}>✨ 開始生成故事</button>

      <div style={{fontSize:11,color:S.t3,textAlign:"center",marginTop:8}}>
        {apiKey?"✓ API Key 已設定":<button onClick={()=>onOpenSettings?.()} style={{background:"none",border:"none",color:c.cl,fontSize:11,textDecoration:"underline",cursor:"pointer"}}>前往 Key 設定</button>}
      </div>
    </div>);
  }

  // Loading
  if(step==="loading"){
    return(<div><Hdr t="✨ 創作中..." onBack={()=>setStep("setup")} cl={c.cl}/>
      <div style={{...S.card,padding:"48px 20px",textAlign:"center"}}>
        <div style={{display:"flex",justifyContent:"center",animation:"emojiBounce 1s ease-in-out infinite"}}>{selectedPet&&<PixelPet petId={selectedPet.petId} stage={getPetStage(selectedPet)} size={96}/>}</div>
        <div style={{fontSize:16,color:S.t1,fontWeight:600,marginTop:16}}>正在為你創作故事</div>
        <div style={{fontSize:12,color:S.t2,marginTop:6}}>AI 正在編寫專屬於你的冒險...</div>
        <div style={{fontSize:11,color:S.t3,marginTop:4}}>（如果 AI 忙碌，會自動重試，請稍候 10-30 秒）</div>
        <div style={{width:120,height:4,background:S.bg2,borderRadius:2,margin:"16px auto",overflow:"hidden"}}>
          <div style={{width:"60%",height:"100%",background:`linear-gradient(90deg,${c.cl},${c.ac})`,animation:"pulse 1s infinite"}}/>
        </div>
      </div>
    </div>);
  }

  // Reading story pages
  if(step==="reading"&&story){
    const page=story.pages[pageIdx];
    return(<StoryReader story={story} pageIdx={pageIdx} setPageIdx={setPageIdx} selectedPet={selectedPet} c={c} onNext={nextPage} onExit={()=>setStep("setup")}/>);
  }

  // Quiz
  if(step==="quiz"&&story){
    const q=story.questions[quizIdx];
    return(<div><Hdr t="📝 閱讀測驗" onBack={()=>setStep("setup")} cl={c.cl}/>
      <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:12}}>
        {story.questions.map((_,i)=>(<div key={i} style={{width:24,height:4,background:i<=quizIdx?c.cl:S.bg2,borderRadius:2}}/>))}
      </div>

      <div style={{...S.card,padding:"18px 16px",marginBottom:12}}>
        <div style={{fontSize:10,color:c.cl,fontWeight:700,letterSpacing:1}}>問題 {quizIdx+1} / {story.questions.length}</div>
        <div style={{fontSize:16,fontWeight:600,color:S.t1,marginTop:6,lineHeight:1.5}}>{q.q}</div>
        {q.zh_q&&<div style={{fontSize:13,color:S.t2,lineHeight:1.6,marginTop:6,padding:"8px 10px",background:S.bg2,borderRadius:10}}>{q.zh_q}</div>}
      </div>

      <div style={{display:"grid",gap:8,marginBottom:12}}>
        {q.choices.map((ch,i)=>{
          const chosen=quizAnswered===i;
          const correct=quizAnswered!==null&&i===q.correct;
          const wrong=chosen&&i!==q.correct;
          let bg=S.bg1,bd=`1px solid ${S.bd}`,color=S.t1;
          if(correct){bg="#E1F5EE";bd="2px solid #1D9E75";color="#0F6E56"}
          else if(wrong){bg="#FCEBEB";bd="2px solid #E24B4A";color="#A32D2D"}
          return(<button key={i} onClick={()=>answerQuiz(i)} disabled={quizAnswered!==null} style={{padding:"14px 16px",borderRadius:12,background:bg,border:bd,fontSize:14,textAlign:"left",color,fontFamily:"inherit",fontWeight:500,cursor:quizAnswered===null?"pointer":"default",transition:"all .2s"}}>
            {String.fromCharCode(65+i)}. {ch} {correct&&"✓"}{wrong&&"✗"}
          </button>);
        })}
      </div>

      {quizAnswered!==null&&<div style={{...S.card,padding:"14px 16px",marginBottom:12,background:quizAnswered===q.correct?"#E1F5EE":"#FFF3CD"}}>
        <div style={{fontSize:13,fontWeight:700,color:S.t1,marginBottom:4}}>{quizAnswered===q.correct?"✅ 答對了！":"❌ 不太對"}</div>
        <div style={{fontSize:12,color:S.t2,lineHeight:1.6}}>{q.explain}</div>
      </div>}

      {quizAnswered!==null&&<button onClick={nextQuiz} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:14}}>{quizIdx<story.questions.length-1?"下一題 →":"🏁 查看結果"}</button>}
    </div>);
  }

  // Done
  if(step==="done"&&story){
    const pct=Math.round((quizScore/story.questions.length)*100);
    return(<div><Hdr t="🏁 故事完成！" onBack={onBack} cl={c.cl}/>
      <div style={{...S.card,padding:"28px 20px",textAlign:"center",background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`,border:`3px solid ${c.cl}`}}>
        <div style={{fontSize:56,animation:"emojiBounce 1s ease-in-out infinite"}}>{pct>=80?"🏆":pct>=50?"🎉":"💪"}</div>
        <div style={{fontSize:20,fontWeight:700,color:S.t1,marginTop:8}}>閱讀完成！</div>
        <div style={{fontSize:13,color:S.t2,marginTop:4}}>答對 {quizScore} / {story.questions.length} 題 · {pct}%</div>
        <div style={{margin:"20px 0",fontSize:12,color:S.t3,lineHeight:1.7}}>
          {pct>=80?"🌟 太棒了！完全理解這個故事":pct>=50?"👍 不錯喔！再多讀幾個就更熟了":"📚 別灰心，多看幾次會更好"}
        </div>
        <div style={{padding:"10px 12px",background:S.bg2,borderRadius:10,fontSize:12,color:S.t1}}>
          📖 <b>{story.zh_title}</b><br/>
          <span style={{color:S.t3,fontSize:11}}>{story.title}</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
        <button onClick={()=>{setStep("reading");setPageIdx(0)}} style={{...S.btn,background:S.bg2,color:S.t1,padding:"14px",fontSize:13}}>🔁 重讀故事</button>
        <button onClick={()=>setStep("setup")} style={{...S.btn,background:c.cl,color:"#fff",padding:"14px",fontSize:13}}>✨ 來個新故事</button>
      </div>
    </div>);
  }

  return null;
}

// ═══ WRONG ANSWER REVIEW (錯題本) ═══════════════════════════════════
function WeakPage({onBack,weakWords,setWeakWords,c,lv}){
  const sorted=[...weakWords].sort((a,b)=>b.n-a.n);
  const[mode,setMode]=useState("list");// list, review
  const[ri,setRi]=useState(0);const[flip,setFlip]=useState(false);
  const[cloudData,setCloudData]=useState({});
  // Try to fetch full word data for weak words
  useEffect(()=>{let active=true;(async()=>{
    const sb=await getSb();if(!sb)return;
    const wanted=sorted.slice(0,20).map(w=>w.w).filter(w=>w&&!cloudData[w]);
    if(!wanted.length)return;
    try{
      const{data}=await sb.from('word_bank').select(WORD_SELECT).eq('level',lv).in('word',wanted);
      if(!active||!data?.length)return;
      const next={};
      data.forEach(row=>{next[row.word]={m:row.meaning,p:row.pos,ph:row.phonetic,ex:row.example,ez:row.example_zh}});
      setCloudData(d=>({...d,...next}));
    }catch{}
  })();return()=>{active=false}},[weakWords]);

  const removeWord=(w)=>setWeakWords(ws=>ws.filter(x=>x.w!==w));
  const[confirmClear,setConfirmClear]=useState(false);
  const clearAll=()=>{if(confirmClear){setWeakWords([]);setConfirmClear(false)}else setConfirmClear(true)};

  if(sorted.length===0)return(<div><Hdr t="📕 錯題本" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px 16px"}}><div style={{fontSize:48,marginBottom:8}}>🎉</div><div style={{fontSize:16,fontWeight:600,color:S.t1}}>太棒了！沒有錯題</div><div style={{fontSize:13,color:S.t2,marginTop:4}}>繼續加油，保持零錯題！</div></div></div>);

  if(mode==="review"){
    const w=sorted[ri];const info=cloudData[w?.w]||{};
    if(!w)return(<div><Hdr t="📕 複習完成" onBack={()=>setMode("list")} cl={c.cl}/><div style={{textAlign:"center",padding:"32px"}}><div style={{fontSize:48}}>✅</div><div style={{fontSize:16,fontWeight:600,color:S.t1,marginTop:8}}>錯題複習完成！</div></div></div>);
    return(<div><Hdr t="📕 錯題複習" onBack={()=>setMode("list")} cl={c.cl}/>
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8,fontSize:12}}><div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${(ri/sorted.length)*100}%`,background:c.cl,borderRadius:3,transition:"width .3s"}}/></div><span style={{color:S.t3}}>{ri+1}/{sorted.length}</span></div>
      <div onClick={()=>setFlip(!flip)} style={{...S.card,padding:"28px 20px",textAlign:"center",minHeight:200,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",animation:"cardFlip .3s ease-out"}}>
        {!flip?(<>
          <div style={{fontSize:14,color:"#E24B4A",fontWeight:600,marginBottom:4}}>❌ 答錯 {w.n} 次</div>
          <div style={{fontSize:36,fontWeight:700,color:S.t1}}>{w.w}</div>
          {info.ph&&<div style={{fontSize:14,color:S.t3,marginTop:4}}>{info.ph}</div>}
          <button onClick={e=>{e.stopPropagation();speak(w.w)}} style={{background:"none",border:"none",fontSize:28,cursor:"pointer",marginTop:8,padding:"4px"}}>🔊</button>
          <div style={{fontSize:12,color:c.cl,marginTop:12,padding:"6px 16px",background:c.bg,borderRadius:16}}>👆 點擊看答案</div>
        </>):(<>
          <div style={{fontSize:28,fontWeight:700,color:c.cl}}>{w.w}</div>
          <div style={{fontSize:22,fontWeight:600,color:S.t1,marginTop:4}}>{info.m||"（查詢中...）"}</div>
          {info.p&&<div style={{fontSize:13,color:S.t3,marginTop:2}}>{info.p}</div>}
          {info.ex&&<div style={{fontSize:14,color:S.t1,fontStyle:"italic",marginTop:10,padding:"8px 12px",background:S.bg2,borderRadius:8,width:"100%",textAlign:"left"}}>"{info.ex}"<button onClick={e=>{e.stopPropagation();speak(info.ex)}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",marginLeft:4,padding:"2px"}}>🔊</button>{info.ez&&<div style={{fontSize:12,color:S.t3,fontStyle:"normal",marginTop:2}}>{info.ez}</div>}</div>}
        </>)}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:10}}>
        <button onClick={()=>{setRi(r=>r+1);setFlip(false)}} style={{...S.btn,background:c.cl,color:"#fff",padding:"10px 20px",fontSize:14,minHeight:44}}>{ri+1>=sorted.length?"✅ 完成":`▶ 下一個 (${ri+2}/${sorted.length})`}</button>
        <button onClick={()=>{removeWord(w.w);setFlip(false)}} style={{...S.btn,background:"#E1F5EE",color:"#0F6E56",padding:"10px 16px",fontSize:13,minHeight:44}}>✓ 已記住</button>
      </div>
    </div>);
  }

  return(<div><Hdr t="📕 錯題本" onBack={onBack} cl={c.cl} extra={<div style={{display:"flex",gap:4}}><button onClick={()=>{setRi(0);setFlip(false);setMode("review")}} style={{...S.btn,background:c.cl,color:"#fff",padding:"4px 12px",fontSize:12}}>📖 開始複習</button></div>}/>
    <div style={{...S.card,padding:"12px 16px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:14,fontWeight:600,color:S.t1}}>共 {sorted.length} 個弱點單字</div>
        <button onClick={clearAll} style={{background:confirmClear?"#E24B4A":"none",border:confirmClear?"none":`1px solid #E24B4A`,borderRadius:8,padding:"4px 10px",fontSize:12,color:confirmClear?"#fff":"#E24B4A",cursor:"pointer",transition:"all .2s"}}>{confirmClear?"⚠️ 確定清空？再點一次":"🗑️ 清空"}</button>
      </div>
    </div>
    <div style={{display:"grid",gap:6}}>
      {sorted.map((w,i)=>{const info=cloudData[w.w]||{};return(<div key={w.w} style={{...S.card,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:28,height:28,borderRadius:"50%",background:"#FCEBEB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#E24B4A",flexShrink:0}}>{w.n}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:700,color:S.t1}}>{w.w} <button onClick={()=>speak(w.w)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",padding:"2px"}}>🔊</button></div>
          <div style={{fontSize:13,color:S.t2}}>{info.m||""}{info.p?` · ${info.p}`:""}</div>
        </div>
        <button onClick={()=>removeWord(w.w)} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",padding:"4px",flexShrink:0}}>✅</button>
      </div>)})}
    </div>
  </div>);
}
// ═══ DASHBOARD (學習報告) ═══════════════════════════════════════════
function Dashboard({onBack,c,xp,streak,stats,daily,weakWords,history,achUnlocked,lv}){
  const shareText=`🏆 我的 EnglishGo 學習成績！\n\n⭐ ${xp} XP · 🔥 連續 ${streak} 天\n📊 SRS ${stats.srsRounds} 輪完成\n💯 測驗滿分 ${stats.perfectQuiz} 次\n🏅 成就 ${achUnlocked.length} 個\n\n一起來學英文 👇\nhttps://englishgo-vevan.netlify.app`;
  const shareToLine=()=>{shareLine(shareText,"https://englishgo-vevan.netlify.app")};
  const shareCopy=()=>{navigator.clipboard?.writeText(shareText).then(()=>{const d=document.createElement("div");d.textContent="✅ 已複製！";d.style.cssText="position:fixed;top:20%;left:50%;transform:translateX(-50%);background:#1D9E75;color:#fff;padding:10px 24px;border-radius:20px;font-size:14px;font-weight:600;z-index:9999;animation:fadeUp .3s";document.body.appendChild(d);setTimeout(()=>d.remove(),1500)}).catch(()=>{})};

  // Compute stats
  const totalWords=stats.srsRounds*20;
  const todayPct=Math.round((daily.done/daily.target)*100);
  const level=xp<100?"🌱 新手":xp<300?"📗 學徒":xp<600?"📘 達人":xp<1000?"🎓 學霸":"👑 大師";
  const weekData=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const ds=d.toDateString();const h=history.find(x=>x.date===ds);return{day:["日","一","二","三","四","五","六"][d.getDay()],done:h?.done||0,today:ds===new Date().toDateString()}});
  const maxDone=Math.max(...weekData.map(d=>d.done),1);

  return(<div><Hdr t="📊 學習報告" onBack={onBack} cl={c.cl}/>
    {/* Level & Share */}
    <div style={{...S.card,padding:"20px",marginBottom:10,textAlign:"center"}}>
      <div style={{fontSize:14,color:S.t3}}>你的等級</div>
      <div style={{fontSize:28,fontWeight:700,color:S.t1,marginTop:4}}>{level}</div>
      <div style={{fontSize:14,color:c.cl,fontWeight:600,marginTop:2}}>⭐ {xp} XP</div>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
        <button onClick={shareToLine} style={{...S.btn,background:"#06C755",color:"#fff",padding:"8px 16px",fontSize:13,borderRadius:20,minHeight:40}}>📤 分享到 LINE</button>
        <button onClick={shareCopy} style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 16px",fontSize:13,borderRadius:20,minHeight:40}}>📋 複製</button>
      </div>
    </div>

    {/* Key Stats Grid */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:10}}>
      {[
        {icon:"🔥",label:"連續天數",value:streak,sub:"天"},
        {icon:"🃏",label:"SRS 總輪數",value:stats.srsRounds,sub:"輪"},
        {icon:"💯",label:"測驗滿分",value:stats.perfectQuiz,sub:"次"},
        {icon:"🎧",label:"聽寫完成",value:stats.dictDone,sub:"次"},
        {icon:"🧩",label:"重組完成",value:stats.scramDone,sub:"次"},
        {icon:"📕",label:"弱點單字",value:weakWords.length,sub:"字"},
        {icon:"🏅",label:"成就解鎖",value:`${achUnlocked.length}/${ACH_DEFS.length}`,sub:""},
        {icon:"📊",label:"今日進度",value:`${todayPct}%`,sub:""},
      ].map((s,i)=>(<div key={i} style={{...S.card,padding:"14px 12px",textAlign:"center"}}>
        <div style={{fontSize:22}}>{s.icon}</div>
        <div style={{fontSize:20,fontWeight:700,color:S.t1,marginTop:2}}>{s.value}{s.sub&&<span style={{fontSize:12,fontWeight:400,color:S.t3}}> {s.sub}</span>}</div>
        <div style={{fontSize:11,color:S.t2,marginTop:1}}>{s.label}</div>
      </div>))}
    </div>

    {/* Weekly Activity Chart */}
    <div style={{...S.card,padding:"16px",marginBottom:10}}>
      <div style={{fontSize:14,fontWeight:600,color:S.t1,marginBottom:10}}>📅 本週學習紀錄</div>
      <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100}}>
        {weekData.map((d,i)=>(<div key={i} style={{flex:1,textAlign:"center"}}>
          <div style={{height:70,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
            <div style={{fontSize:10,color:d.done>0?c.cl:S.t3,fontWeight:600,marginBottom:2}}>{d.done||""}</div>
            <div style={{height:`${Math.max((d.done/maxDone)*60,d.done>0?8:2)}px`,background:d.today?`linear-gradient(180deg,${c.cl},${c.ac})`:d.done>0?c.bg:S.bg2,borderRadius:4,transition:"height .3s",minHeight:2}}/>
          </div>
          <div style={{fontSize:11,color:d.today?c.cl:S.t3,fontWeight:d.today?700:400,marginTop:4}}>{d.day}</div>
        </div>))}
      </div>
    </div>

    {/* Weak Words Top 5 */}
    {weakWords.length>0&&<div style={{...S.card,padding:"16px",marginBottom:10}}>
      <div style={{fontSize:14,fontWeight:600,color:S.t1,marginBottom:8}}>📕 最常答錯的字</div>
      {[...weakWords].sort((a,b)=>b.n-a.n).slice(0,5).map((w,i)=>(<div key={w.w} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:i<4?`1px solid ${S.bd}`:"none"}}>
        <div style={{fontSize:14,fontWeight:700,color:"#E24B4A",width:24,textAlign:"center"}}>{w.n}</div>
        <div style={{flex:1,fontSize:14,fontWeight:600,color:S.t1}}>{w.w}</div>
        <div style={{width:`${Math.min((w.n/Math.max(...weakWords.map(x=>x.n),1))*80,80)}px`,height:8,background:"linear-gradient(90deg,#E24B4A,#EF9F27)",borderRadius:4}}/>
      </div>))}
    </div>}

    {/* Encouragement */}
    <div style={{...S.card,padding:"16px",textAlign:"center",marginBottom:10}}>
      <div style={{fontSize:14,color:S.t2,lineHeight:1.8}}>
        {streak>=7?"🔥 連續 "+streak+" 天學習，你太厲害了！":
         streak>=3?"💪 已經連續 "+streak+" 天，繼續保持！":
         xp>=100?"⭐ 累積了 "+xp+" XP，進步很快！":
         "🌱 每天 10 分鐘，英文就能慢慢進步！"}
      </div>
    </div>
  </div>);
}
// ═══ GACHA CEREMONY (扭蛋抽卡儀式 - P0-3 視覺優化) ═════════════════
// 三段式戲劇化動畫（總共 1.8 秒）：
//   0.0s ─ 蛋從上方落下（彈性）
//   0.5s ─ 蛋震動 + 對應稀有度光柱（顏色提早洩漏稀有度）
//   1.2s ─ 持續發光直到自動進結果頁
// SSR 級加上全屏金色閃光與多顆光點四散
const LazyPixelPet=lazy(()=>import("./components/PixelPet.jsx"));
function PixelPetFallback({size=180}){return <span style={{display:"inline-block",width:size,height:size,borderRadius:12,background:"linear-gradient(135deg,var(--color-background-secondary,#f3f2ee),var(--color-background-primary,#fff))"}}/>}
function PixelPet(props){return <Suspense fallback={<PixelPetFallback size={props.size}/>}> <LazyPixelPet {...props}/> </Suspense>}

const LazyPetAdventurePage=lazy(()=>import("./features/PetsModule.jsx").then(m=>({default:m.PetAdventurePage})));
const LazyGachaPage=lazy(()=>import("./features/PetsModule.jsx").then(m=>({default:m.GachaPage})));
const LazyPetsGuard=lazy(()=>import("./features/PetsModule.jsx").then(m=>({default:m.PetsGuard})));
function getPetsModuleDeps(){return {ACTION_PROMPTS:ACTION_PROMPTS,BOND_MILESTONES:BOND_MILESTONES,DAILY_TASK_DEFS:DAILY_TASK_DEFS,DUPLICATE_EGG_PROGRESS:DUPLICATE_EGG_PROGRESS,DUPLICATE_PET_REWARD:DUPLICATE_PET_REWARD,EGG_COST:EGG_COST,EGG_HATCH_TASKS:EGG_HATCH_TASKS,GACHA_SR_PITY:GACHA_SR_PITY,Hdr:Hdr,MAX_STAT:MAX_STAT,PETS:PETS,PET_ACTIONS:PET_ACTIONS,PET_ADVENTURE_BOSS_REQUIRED_CLEARS:PET_ADVENTURE_BOSS_REQUIRED_CLEARS,PET_ADVENTURE_ENEMY_ICONS:PET_ADVENTURE_ENEMY_ICONS,PET_ADVENTURE_SKILLS:PET_ADVENTURE_SKILLS,PET_ADVENTURE_SKILL_UNLOCKS:PET_ADVENTURE_SKILL_UNLOCKS,PET_ADVENTURE_SKILL_VISUALS:PET_ADVENTURE_SKILL_VISUALS,PET_CULTIVATION_ACTIONS:PET_CULTIVATION_ACTIONS,PET_EVENTS:PET_EVENTS,PET_FOODS:PET_FOODS,RARITY_INFO:RARITY_INFO,RARITY_ORDER:RARITY_ORDER,S:S,STAGE_NAMES:STAGE_NAMES,STAGE_SAYINGS:STAGE_SAYINGS,TIME_GREETINGS:TIME_GREETINGS,applyDuplicatePetReward:applyDuplicatePetReward,buildPetAdventureStages:buildPetAdventureStages,calcDecay:calcDecay,choosePetFoodForNeed:choosePetFoodForNeed,completePetAdventureProgress:completePetAdventureProgress,createPetAdventureBgm:createPetAdventureBgm,getAdventureAnswerLine:getAdventureAnswerLine,getAdventureCorrectSpeech:getAdventureCorrectSpeech,getAdventurePetDef:getAdventurePetDef,getAdventureQuestionMeta:getAdventureQuestionMeta,getAdventureQuestionSpeech:getAdventureQuestionSpeech,getBondLevel:getBondLevel,getCareCount:getCareCount,getDuplicateEnergyInfo:getDuplicateEnergyInfo,getDuplicatePetReward:getDuplicatePetReward,getEventCenter:getEventCenter,getNextPetAdventureSkillCard:getNextPetAdventureSkillCard,getPetAdventureDifficulty:getPetAdventureDifficulty,getPetAdventureFatigue:getPetAdventureFatigue,getPetAdventurePower:getPetAdventurePower,getPetAdventureProgress:getPetAdventureProgress,getPetAdventureScore:getPetAdventureScore,getPetAdventureSkill:getPetAdventureSkill,getPetAdventureSkillCards:getPetAdventureSkillCards,getPetCareAverage:getPetCareAverage,getPetCareSuggestion:getPetCareSuggestion,getPetCultivationPlan:getPetCultivationPlan,getPetDailyCultivation:getPetDailyCultivation,getPetMood:getPetMood,getPetReadiness:getPetReadiness,getPetSize:getPetSize,getPetStage:getPetStage,getPetUrgentNeed:getPetUrgentNeed,getSelectedPetAdventureSkill:getSelectedPetAdventureSkill,getTeamAdventureMorale:getTeamAdventureMorale,getTimeOfDay:getTimeOfDay,hashPin:hashPin,improvePetAfterAdventure:improvePetAfterAdventure,isPetAdventureBossReady:isPetAdventureBossReady,isPetSleeping:isPetSleeping,levelUpPet:levelUpPet,loadPetAdventureQuestions:loadPetAdventureQuestions,petCloudLogin:petCloudLogin,petCloudSignup:petCloudSignup,playPetAdventureSkillSound:playPetAdventureSkillSound,playSound:playSound,randomPet:randomPet,rollRarity:rollRarity,savePetAdventureProgress:savePetAdventureProgress,speak:speak,triggerRewardBurst:triggerRewardBurst,useLS:useLS}}
function PetFeatureFallback(){return <div style={{textAlign:"center",padding:"48px 16px",color:S.t3}}>Loading pets...</div>}
function PetAdventurePage(props){return <Suspense fallback={<PetFeatureFallback/>}><LazyPetAdventurePage {...props} deps={getPetsModuleDeps()}/></Suspense>}
function GachaPage(props){return <Suspense fallback={<PetFeatureFallback/>}><LazyGachaPage {...props} deps={getPetsModuleDeps()}/></Suspense>}
function PetsGuard(props){return <Suspense fallback={<PetFeatureFallback/>}><LazyPetsGuard {...props} deps={getPetsModuleDeps()}/></Suspense>}

function SponsorPage({onBack,c,sponsor,setSponsor}){
  const[name,setName]=useState(sponsor.name&&sponsor.name!=="支持者"?sponsor.name:"");
  const[note,setNote]=useState("");
  const[msg,setMsg]=useState(null);
  const[copied,setCopied]=useState("");
  const[busy,setBusy]=useState(false);
  const bankRows=[
    {label:"戶名",value:"陳韋安",copy:"陳韋安"},
    {label:"銀行",value:"華南銀行",meta:"代號 008",copy:"008"},
    {label:"帳號",value:"1132 0096 8044",copy:"113200968044",mono:true},
  ];
  const tiers=[
    {amt:"NT$50",label:"小小鼓勵"},
    {amt:"NT$100",label:"一份早餐"},
    {amt:"NT$300",label:"營運支援"},
    {amt:"自由決定",label:"量力而為"},
  ];
  const copyBank=async(text,label)=>{
    try{
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setMsg({type:"ok",text:`已複製${label}`});
      playSound("done");
      window.setTimeout(()=>setCopied(v=>v===label?"":v),1600);
    }catch{
      setMsg({type:"warn",text:`${label}：${text}`});
    }
  };
  const copyAll=()=>copyBank("戶名：陳韋安\n銀行：華南銀行（代號 008）\n帳號：113200968044","全部資訊");
  const submit=async(e)=>{
    e?.preventDefault?.();
    if(busy)return;
    const cleanName=name.trim();
    if(!cleanName){
      setMsg({type:"err",text:"請先輸入姓名"});
      return;
    }
    setBusy(true);
    setMsg(null);
    const r=await submitSponsorMessage(cleanName,note);
    setBusy(false);
    if(r.ok){
      setSponsor({active:true,name:cleanName,date:new Date().toISOString()});
      setNote("");
      setMsg({type:"ok",text:"已收到您的姓名與留言，謝謝支持。"});
      playSound("done");
    }else{
      setMsg({type:"err",text:r.err});
      playSound("bad");
    }
  };
  const resetSupporter=()=>{setSponsor({active:false,name:""});setMsg(null);setName("");setNote("")};
  const msgColor=msg?.type==="err"?"#D83A34":msg?.type==="warn"?"#9A6400":"#0F7A5D";

  return(<div className="sponsor-page">
    <style>{`
      .sponsor-page{--accent:${c.cl};--support-bg:${c.bg};}
      .support-hero{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--accent) 28%,#d8d8d8);border-top:4px solid var(--accent);border-radius:18px;padding:22px;background:linear-gradient(135deg,var(--support-bg),var(--color-background-primary,#fff) 62%);box-shadow:0 16px 38px rgba(15,110,86,.10);margin-bottom:14px}
      .support-hero h2{font-size:26px;line-height:1.15;margin:0 0 8px;color:${S.t1}}
      .support-hero p{font-size:14px;line-height:1.75;color:${S.t2};margin:0;max-width:620px}
      .support-pill-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
      .support-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(15,110,86,.18);background:rgba(29,158,117,.10);color:#0F6E56;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:800}
      .support-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(280px,.95fr);gap:14px;align-items:start}
      .support-card{border:1px solid ${S.bd};border-radius:16px;background:${S.bg1};padding:16px}
      .support-card-title{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:16px;font-weight:900;color:${S.t1};margin-bottom:12px}
      .support-copy-all{border:1px solid rgba(15,110,86,.22);background:rgba(29,158,117,.10);color:var(--accent);border-radius:10px;padding:8px 10px;font-size:12px;font-weight:900;font-family:inherit;cursor:pointer}
      .support-copy-all.is-copied{background:var(--accent);border-color:var(--accent);color:white}
      .support-bank-row{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid ${S.bd};border-radius:12px;background:${S.bg2};margin-bottom:8px}
      .support-bank-label{font-size:12px;color:${S.t3};font-weight:900}
      .support-bank-value{min-width:0;color:${S.t1};font-size:16px;font-weight:900;word-break:break-word}
      .support-bank-meta{display:block;font-size:11px;color:${S.t3};font-weight:700;margin-top:2px}
      .support-mono{font-family:"SFMono-Regular","Consolas",monospace;letter-spacing:.04em}
      .support-copy-btn{border:1px solid ${S.bd};background:${S.bg1};color:var(--accent);border-radius:9px;padding:7px 9px;font-size:12px;font-weight:900;font-family:inherit;cursor:pointer;white-space:nowrap}
      .support-copy-btn.is-copied{background:var(--accent);border-color:var(--accent);color:white}
      .support-note{border-radius:12px;background:rgba(239,159,39,.10);border:1px solid rgba(239,159,39,.24);padding:11px 12px;color:#7A5200;font-size:12px;line-height:1.7;margin-top:10px}
      .support-tier-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
      .support-tier{border:1px solid ${S.bd};border-radius:12px;background:${S.bg2};padding:11px 8px;text-align:center}
      .support-tier strong{display:block;color:var(--accent);font-size:14px;margin-bottom:2px}
      .support-tier span{font-size:11px;color:${S.t3};font-weight:800}
      .support-form{display:grid;gap:11px}
      .support-field{display:grid;gap:6px;font-size:12px;color:${S.t2};font-weight:900}
      .support-input{width:100%;border:1px solid ${S.bd};border-radius:12px;background:${S.bg2};color:${S.t1};font:inherit;font-size:14px;padding:12px 13px;outline:none}
      .support-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(29,158,117,.12);background:${S.bg1}}
      .support-submit{border:0;border-radius:12px;background:var(--accent);color:white;font:inherit;font-size:14px;font-weight:900;padding:13px 16px;cursor:pointer}
      .support-submit:disabled{opacity:.48;cursor:not-allowed}
      .support-status{border-radius:12px;padding:10px 12px;font-size:13px;font-weight:900;text-align:center;background:rgba(29,158,117,.10)}
      .support-thanks{border:1px solid rgba(239,159,39,.28);background:linear-gradient(135deg,#FFF5D8,#fff);border-radius:16px;padding:15px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .support-thanks b{display:block;color:#7A5200;font-size:16px}
      .support-thanks span{font-size:12px;color:#856404}
      .support-privacy{margin-top:14px;border:1px solid ${S.bd};border-radius:14px;background:${S.bg2};padding:12px 14px;color:${S.t3};font-size:12px;line-height:1.8}
      @media(max-width:760px){
        .support-hero{padding:18px 16px;border-radius:16px}
        .support-hero h2{font-size:22px}
        .support-grid{grid-template-columns:1fr}
        .support-bank-row{grid-template-columns:54px minmax(0,1fr) auto;padding:10px}
        .support-bank-value{font-size:14px}
        .support-tier-grid{grid-template-columns:repeat(2,1fr)}
        .support-thanks{align-items:flex-start;flex-direction:column}
      }
    `}</style>
    <Hdr t="☕ 支持我們" onBack={onBack} cl={c.cl} extra={<a href="/learn/sponsor.html" target="_blank" rel="noreferrer" style={{fontSize:12,color:c.cl,textDecoration:"none",fontWeight:800,padding:"6px 8px",border:`1px solid ${S.bd}`,borderRadius:8}}>說明頁</a>}/>

    <section className="support-hero">
      <h2>支持 EnglishGo 持續免費</h2>
      <p>EnglishGo 目前維持無廣告、無付費牆。若這個網站對你或孩子有幫助，可以用銀行轉帳支持營運；不需要寄信、不需要上傳匯款證明，也不用留下帳號資訊。</p>
      <div className="support-pill-row">
        <span className="support-pill">無廣告承諾</span>
        <span className="support-pill">銀行轉帳即可</span>
        <span className="support-pill">只記錄姓名與留言</span>
      </div>
    </section>

    {sponsor.active&&(<section className="support-thanks">
      <div>
        <b>謝謝您的支持</b>
        <span>{sponsor.name?`${sponsor.name}，`:''}您的留言已記錄，可以隨時重新填寫。</span>
      </div>
      <button type="button" onClick={resetSupporter} className="support-copy-btn">重新填寫</button>
    </section>)}

    <div className="support-grid">
      <section className="support-card">
        <div className="support-card-title">
          <span>銀行轉帳資訊</span>
          <button type="button" onClick={copyAll} className={`support-copy-all ${copied==="全部資訊"?"is-copied":""}`}>{copied==="全部資訊"?"已複製":"複製全部"}</button>
        </div>
        {bankRows.map(row=><div key={row.label} className="support-bank-row">
          <div className="support-bank-label">{row.label}</div>
          <div className={`support-bank-value ${row.mono?"support-mono":""}`}>
            {row.value}
            {row.meta&&<span className="support-bank-meta">{row.meta}</span>}
          </div>
          <button type="button" onClick={()=>copyBank(row.copy,row.label)} className={`support-copy-btn ${copied===row.label?"is-copied":""}`}>{copied===row.label?"已複製":"複製"}</button>
        </div>)}
        <div className="support-note">轉帳完成後不用通知我。若願意讓我知道是誰支持，可以在右側留下姓名與一句話。</div>
        <div className="support-tier-grid">
          {tiers.map(tier=><div key={tier.amt} className="support-tier"><strong>{tier.amt}</strong><span>{tier.label}</span></div>)}
        </div>
      </section>

      <section className="support-card">
        <div className="support-card-title"><span>留下姓名與留言</span></div>
        <form onSubmit={submit} className="support-form">
          <label className="support-field">你的姓名（必填）
            <input className="support-input" value={name} onChange={e=>setName(e.target.value)} maxLength={60} placeholder="例如：陳小明、某某家長"/>
          </label>
          <label className="support-field">想對我說的話（選填）
            <textarea className="support-input" value={note} onChange={e=>setNote(e.target.value)} maxLength={500} rows={5} placeholder="可以留下鼓勵、建議，或希望 EnglishGo 增加的功能。" style={{resize:"vertical",lineHeight:1.65}}/>
          </label>
          <div style={{fontSize:11,color:S.t3,textAlign:"right"}}>{note.length}/500</div>
          <button className="support-submit" type="submit" disabled={busy||!name.trim()}>{busy?"送出中...":"送出留言"}</button>
        </form>
        {msg&&<div className="support-status" style={{color:msgColor,marginTop:12}}>{msg.text}</div>}
      </section>
    </div>

    <div className="support-privacy">
      <b>資料說明：</b>系統只記錄你填寫的姓名與留言，用來知道誰支持 EnglishGo。請不要填寫匯款帳號、Email、電話或其他敏感資訊。
    </div>
  </div>);
}

function Hdr({t,onBack,cl,extra}){return(<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:8}}><button onClick={onBack} style={{background:"none",border:"none",fontSize:12,color:cl,cursor:"pointer",fontWeight:600,fontFamily:"inherit",padding:"6px 8px",minHeight:36,borderRadius:8,WebkitTapHighlightColor:"transparent"}}>← 返回</button><h2 style={{fontSize:16,fontWeight:700,color:S.t1,margin:0,flex:1}}>{t}</h2>{extra}</div>)}
function PB({v,mx,cl}){return(<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,fontSize:12}}><div style={{flex:1,height:4,background:S.bg2,borderRadius:2}}><div style={{height:"100%",width:`${(v/mx)*100}%`,background:cl,borderRadius:2,transition:"width .3s"}}/></div><span style={{color:S.t3}}>{v+1}/{mx}</span></div>)}
