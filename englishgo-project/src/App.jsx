import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { getElementaryExample } from "./data/elementaryExamples.js";

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
      const mod = await import('https://esm.sh/@supabase/supabase-js@2');
      _sb = mod.createClient(url, key);
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
    {t:"Be 動詞",d:"I am / You are / He is",ex:"I am a student.",q:{s:"She ___ a teacher.",o:["am","is","are","be"],a:1}},
    {t:"現在簡單式",d:"第三人稱加 s/es",ex:"He goes to school every day.",q:{s:"She ___ breakfast at 7.",o:["eat","eats","eating","ate"],a:1}},
    {t:"現在進行式",d:"be + V-ing 正在做",ex:"I am reading a book now.",q:{s:"They ___ TV now.",o:["watch","watches","are watching","watched"],a:2}},
    {t:"There is / There are",d:"表示「有…」",ex:"There are two cats.",q:{s:"There ___ a dog.",o:["is","are","has","have"],a:0}},
    {t:"名詞單複數",d:"大部分加 s，特殊變化要記",ex:"one child → two children",q:{s:"I have three ___.",o:["box","boxs","boxes","boxies"],a:2}},
    {t:"代名詞",d:"I/me, he/him, she/her",ex:"She likes him.",q:{s:"Give ___ the book.",o:["I","my","me","mine"],a:2}},
  ],
  junior: [
    {t:"現在完成式",d:"have/has + p.p.",ex:"I have lived here for 5 years.",q:{s:"She ___ to Japan twice.",o:["has been","have been","was","went"],a:0}},
    {t:"被動語態",d:"be + p.p.",ex:"The window was broken.",q:{s:"The cake ___ by mom.",o:["baked","was baked","is baking","bake"],a:1}},
    {t:"關係代名詞",d:"who/which/that",ex:"The man who lives next door is a doctor.",q:{s:"The book ___ I read was great.",o:["who","which","what","where"],a:1}},
    {t:"不定詞 vs 動名詞",d:"to V / V-ing",ex:"I enjoy reading. I want to go.",q:{s:"She enjoys ___.",o:["swim","to swim","swimming","swam"],a:2}},
    {t:"連接詞",d:"because/although/if",ex:"Although it rained, we went out.",q:{s:"___ he was tired, he kept working.",o:["Because","Although","If","So"],a:1}},
    {t:"比較級與最高級",d:"-er/-est 或 more/most",ex:"She is taller than her brother.",q:{s:"This is the ___ movie ever.",o:["good","better","best","most good"],a:2}},
  ],
  senior: [
    {t:"假設語氣（現在）",d:"If + 過去式, would + V",ex:"If I were you, I would study harder.",q:{s:"If I ___ rich, I would travel.",o:["am","was","were","be"],a:2}},
    {t:"假設語氣（過去）",d:"If + had p.p., would have p.p.",ex:"If I had studied, I would have passed.",q:{s:"If she ___ earlier, she wouldn't have missed it.",o:["comes","came","had come","has come"],a:2}},
    {t:"分詞構句",d:"V-ing 開頭簡化子句",ex:"Walking along the street, I met a friend.",q:{s:"___ the letter, she cried.",o:["Reading","Read","To read","Reads"],a:0}},
    {t:"倒裝句",d:"否定副詞放句首",ex:"Never have I seen such beauty.",q:{s:"Not only ___ hard, but he helped others.",o:["he worked","did he work","he did work","does he works"],a:1}},
    {t:"名詞子句",d:"that / whether / wh-",ex:"What he said surprised everyone.",q:{s:"I don't know ___ she will come.",o:["that","whether","what","which"],a:1}},
    {t:"強調句型",d:"It is/was...that",ex:"It was John that broke the window.",q:{s:"It was ___ that I met her.",o:["in Tokyo","Tokyo","at Tokyo is","Tokyo where"],a:0}},
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
  junior: [],
  senior: [],
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

const PET_ADVENTURE_QUESTIONS={
  elementary:[
    {q:"Which word means 「小的」?",zh:"哪一個單字是「小的」？",choices:["little","loud","late","long"],answer:0,tip:"little = 小的"},
    {q:"Choose the best sentence.",zh:"選出最自然的句子。",choices:["I am happy today.","I happy today.","I is happy today.","Me am happy today."],answer:0,tip:"I am + adjective."},
    {q:"What can a bird do?",zh:"鳥會做什麼？",choices:["fly","swim in a cup","drive","cook"],answer:0,tip:"A bird can fly."},
    {q:"Which one is food?",zh:"哪一個是食物？",choices:["bread","chair","river","clock"],answer:0,tip:"bread = 麵包"},
    {q:"Complete: I ___ my face in the morning.",zh:"完成句子：早上我洗臉。",choices:["wash","jump","open","sleep"],answer:0,tip:"wash my face = 洗臉"},
    {q:"Which answer fits: How are you?",zh:"哪個回答適合 How are you?",choices:["I am fine.","It is a cat.","At school.","Blue."],answer:0,tip:"I am fine. = 我很好。"},
    {q:"Choose the action word.",zh:"選出動作單字。",choices:["run","green","small","happy"],answer:0,tip:"run 是動詞。"},
    {q:"Complete: She ___ a book.",zh:"完成句子：她讀一本書。",choices:["reads","read","reading","to read"],answer:0,tip:"She reads..."},
    {q:"Which word means 「朋友」?",zh:"哪一個單字是「朋友」？",choices:["friend","flower","forest","food"],answer:0,tip:"friend = 朋友"},
  ],
  junior:[
    {q:"Choose the correct sentence.",zh:"選出正確句子。",choices:["He has already finished his homework.","He already finish his homework.","He has already finish his homework.","He is already finished homework."],answer:0,tip:"has + past participle"},
    {q:"Which word is closest to 'brave'?",zh:"哪個字最接近 brave？",choices:["courageous","careless","silent","ordinary"],answer:0,tip:"brave = courageous"},
    {q:"Complete: If it rains, we ___ inside.",zh:"完成條件句。",choices:["will stay","stayed","staying","stay will"],answer:0,tip:"If + present, will + V."},
    {q:"Which sentence uses an adverb correctly?",zh:"哪句副詞用法正確？",choices:["She speaks clearly.","She speaks clear.","She clear speaks.","Clearly she speaks English good."],answer:0,tip:"clearly 修飾 speaks"},
    {q:"What does 'discover' mean?",zh:"discover 是什麼意思？",choices:["find something new","hide something","forget a plan","break a rule"],answer:0,tip:"discover = 發現"},
    {q:"Choose the best question.",zh:"選出最自然的問句。",choices:["How long have you lived here?","How long you have lived here?","How long do you lived here?","How long did you living here?"],answer:0,tip:"How long have you + p.p.?"},
    {q:"Which word means 「責任」?",zh:"哪個字是「責任」？",choices:["responsibility","reflection","repetition","reduction"],answer:0,tip:"responsibility = 責任"},
    {q:"Complete: The story was ___ interesting that I read it twice.",zh:"完成 so...that 句型。",choices:["so","too","very","such"],answer:0,tip:"so + adj. + that"},
    {q:"Which word is a noun?",zh:"哪個字是名詞？",choices:["decision","decide","quickly","careful"],answer:0,tip:"decision 是名詞。"},
  ],
  senior:[
    {q:"Choose the best transition.",zh:"選出最合適的轉折語。",choices:["However","Therefore","For example","In addition"],answer:0,tip:"However 表示轉折。"},
    {q:"Which sentence is grammatically correct?",zh:"哪句文法正確？",choices:["Had I known the truth, I would have acted differently.","Had I knew the truth, I would act differently.","If I had know the truth, I will act differently.","Knowing the truth, I would have differently acted."],answer:0,tip:"倒裝假設語氣：Had I known..."},
    {q:"What does 'inevitable' mean?",zh:"inevitable 是什麼意思？",choices:["impossible to avoid","easy to forget","hard to explain","ready to use"],answer:0,tip:"inevitable = 無法避免的"},
    {q:"Choose the more academic word for 'show'.",zh:"show 較正式的同義字是？",choices:["demonstrate","hide","guess","repeat"],answer:0,tip:"demonstrate = 展示、證明"},
    {q:"Complete: The result depends ___ several factors.",zh:"完成片語。",choices:["on","in","at","for"],answer:0,tip:"depend on"},
    {q:"Which sentence has a reduced relative clause?",zh:"哪句有關係子句簡化？",choices:["The book written by Mina won a prize.","The book which Mina wrote it won a prize.","Mina written the book won a prize.","The written by Mina book won a prize."],answer:0,tip:"written by Mina = which was written by Mina"},
  ],
};

const PET_ADVENTURE_EXTRA_QUESTIONS={
  elementary:[
    {id:"el-go-school",q:"Complete: I ___ to school every day.",zh:"完成句子：我每天去上學。",choices:["go","goes","going","went"],answer:0,tip:"I go to school."},
    {id:"el-big",q:"Which word means big?",zh:"哪一個字是「大的」？",choices:["big","thin","short","cold"],answer:0,tip:"big = 大的"},
    {id:"el-hot-opposite",q:"What is the opposite of hot?",zh:"hot 的相反詞是什麼？",choices:["cold","warm","sunny","dry"],answer:0,tip:"hot / cold"},
    {id:"el-pencil",q:"Choose the correct sentence.",zh:"選出正確句子。",choices:["This is my pencil.","This my pencil.","This are my pencil.","This is I pencil."],answer:0,tip:"This is my..."},
    {id:"el-has-dog",q:"Complete: He ___ a dog.",zh:"完成句子：他有一隻狗。",choices:["has","have","having","to have"],answer:0,tip:"He has..."},
    {id:"el-animal",q:"Which word is an animal?",zh:"哪一個字是動物？",choices:["rabbit","window","breakfast","pencil"],answer:0,tip:"rabbit = 兔子"},
    {id:"el-eat-apples",q:"Complete: I like to ___ apples.",zh:"完成句子：我喜歡吃蘋果。",choices:["eat","sleep","open","write"],answer:0,tip:"eat apples"},
    {id:"el-morning",q:"Which word means morning?",zh:"哪一個字是「早上」？",choices:["morning","evening","winter","minute"],answer:0,tip:"morning = 早上"},
    {id:"el-there-are",q:"Complete: There ___ three books.",zh:"完成句子：有三本書。",choices:["are","is","am","be"],answer:0,tip:"There are + plural noun."},
    {id:"el-good-night",q:"What do you say before sleep?",zh:"睡覺前可以說什麼？",choices:["Good night.","Good morning.","Thank you.","See you at school."],answer:0,tip:"Good night. = 晚安。"},
    {id:"el-listen",q:"Which word means listen?",zh:"哪一個字是「聽」？",choices:["listen","draw","climb","carry"],answer:0,tip:"listen = 聽"},
    {id:"el-can-run",q:"Complete: She can ___ fast.",zh:"完成句子：她可以跑很快。",choices:["run","runs","running","ran"],answer:0,tip:"can + base verb"},
    {id:"el-they-are",q:"Choose the correct sentence.",zh:"選出正確句子。",choices:["They are my friends.","They is my friends.","They my friends are.","They am my friends."],answer:0,tip:"They are..."},
    {id:"el-color",q:"Which word is a color?",zh:"哪一個字是顏色？",choices:["yellow","family","music","river"],answer:0,tip:"yellow = 黃色"},
    {id:"el-under",q:"Complete: The cat is ___ the chair.",zh:"完成句子：貓在椅子下面。",choices:["under","sing","hungry","teacher"],answer:0,tip:"under = 在下面"},
    {id:"el-family",q:"Which word means family?",zh:"哪一個字是「家庭」？",choices:["family","forest","flower","fairy"],answer:0,tip:"family = 家庭"},
    {id:"el-water",q:"What can you drink?",zh:"哪一個可以喝？",choices:["water","chair","stone","clock"],answer:0,tip:"drink water"},
    {id:"el-study",q:"Complete: I ___ English after school.",zh:"完成句子：我放學後學英文。",choices:["study","studies","studying","student"],answer:0,tip:"I study English."},
    {id:"el-teacher",q:"Which word means teacher?",zh:"哪一個字是「老師」？",choices:["teacher","kitchen","garden","shadow"],answer:0,tip:"teacher = 老師"},
    {id:"el-name-question",q:"Which is a question?",zh:"哪一句是問句？",choices:["What is your name?","My name is Lily.","I am fine.","This is a book."],answer:0,tip:"Question sentences often use ?"},
    {id:"el-place",q:"Which one is a place?",zh:"哪一個是地點？",choices:["school","happy","slowly","blue"],answer:0,tip:"school = 學校"},
    {id:"el-tall",q:"Complete: My brother is ___.",zh:"完成句子：我的哥哥很高。",choices:["tall","table","run","eat"],answer:0,tip:"tall = 高的"},
    {id:"el-small",q:"Which word means small?",zh:"哪一個字是「小的」？",choices:["small","strong","sunny","sweet"],answer:0,tip:"small = 小的"},
    {id:"el-we-are",q:"Complete: We ___ happy.",zh:"完成句子：我們很開心。",choices:["are","is","am","be"],answer:0,tip:"We are..."},
    {id:"el-every-day",q:"Which phrase means every day?",zh:"哪個片語是「每天」？",choices:["every day","last night","next year","one time"],answer:0,tip:"every day = 每天"},
  ],
  junior:[
    {id:"jr-while-reading",q:"Choose the correct sentence.",zh:"選出正確句子。",choices:["I was reading when he called.","I read when he was called.","I was read when he called.","I reading when he called."],answer:0,tip:"was/were + V-ing"},
    {id:"jr-because",q:"Complete: I stayed home ___ I was sick.",zh:"完成句子：我待在家，因為我生病了。",choices:["because","but","although","before"],answer:0,tip:"because gives a reason."},
    {id:"jr-passive",q:"Choose the passive sentence.",zh:"選出被動語態句子。",choices:["The window was broken by the wind.","The wind broke the window.","The window breaks the wind.","The wind was window broken."],answer:0,tip:"be + past participle"},
    {id:"jr-relative",q:"Complete: The boy ___ sits near me is Tom.",zh:"完成句子：坐在我附近的男孩是 Tom。",choices:["who","where","when","what"],answer:0,tip:"who describes a person."},
    {id:"jr-used-to",q:"Complete: I ___ play soccer after school.",zh:"完成句子：我以前放學後常踢足球。",choices:["used to","use to","am used","was used"],answer:0,tip:"used to + base verb"},
    {id:"jr-have-to",q:"Which sentence means a rule or duty?",zh:"哪一句表示規定或責任？",choices:["We have to wear uniforms.","We can wear uniforms.","We like uniforms.","We wore uniforms yesterday."],answer:0,tip:"have to = 必須"},
    {id:"jr-enough",q:"Complete: The box is light ___ to carry.",zh:"完成句子：這箱子夠輕，可以搬。",choices:["enough","too","very","so"],answer:0,tip:"adjective + enough"},
    {id:"jr-too-to",q:"Complete: The tea is too hot ___ drink.",zh:"完成句子：茶太燙，不能喝。",choices:["to","for","with","at"],answer:0,tip:"too + adj. + to"},
    {id:"jr-since",q:"Complete: I have known her ___ 2024.",zh:"完成句子：我從 2024 年就認識她。",choices:["since","for","during","until"],answer:0,tip:"since + starting point"},
    {id:"jr-for-two-years",q:"Complete: They have lived here ___ two years.",zh:"完成句子：他們住在這裡兩年了。",choices:["for","since","ago","during"],answer:0,tip:"for + length of time"},
    {id:"jr-adjective",q:"Which word is an adjective?",zh:"哪一個字是形容詞？",choices:["careful","carefully","care","caringly"],answer:0,tip:"careful describes a noun."},
    {id:"jr-comparative",q:"Complete: This road is ___ than that one.",zh:"完成句子：這條路比那條路長。",choices:["longer","long","longest","more long"],answer:0,tip:"longer than"},
    {id:"jr-superlative",q:"Complete: Mina is the ___ student in class.",zh:"完成句子：Mina 是班上最高的學生。",choices:["tallest","taller","tall","more tall"],answer:0,tip:"the + superlative"},
    {id:"jr-although",q:"Complete: ___ it was raining, we went out.",zh:"完成句子：雖然下雨，我們還是出門。",choices:["Although","Because","So","When"],answer:0,tip:"Although shows contrast."},
    {id:"jr-vocab-whisper",q:"What does whisper mean?",zh:"whisper 是什麼意思？",choices:["speak very quietly","run very quickly","look very angry","sleep very late"],answer:0,tip:"whisper = 低聲說"},
    {id:"jr-vocab-shadow",q:"Which word is closest to shadow?",zh:"哪個字最接近 shadow？",choices:["dark shape","bright light","loud voice","warm fire"],answer:0,tip:"shadow = 影子"},
    {id:"jr-vocab-ancient",q:"What does ancient mean?",zh:"ancient 是什麼意思？",choices:["very old","very fast","very clean","very simple"],answer:0,tip:"ancient = 古老的"},
    {id:"jr-vocab-guide",q:"Complete: A map can ___ travelers.",zh:"完成句子：地圖可以引導旅人。",choices:["guide","borrow","hide","drop"],answer:0,tip:"guide = 引導"},
    {id:"jr-gerund",q:"Complete: She enjoys ___ stories.",zh:"完成句子：她喜歡讀故事。",choices:["reading","read","to reads","reads"],answer:0,tip:"enjoy + V-ing"},
    {id:"jr-infinitive",q:"Complete: I want ___ English songs.",zh:"完成句子：我想唱英文歌。",choices:["to sing","singing","sang","sings"],answer:0,tip:"want + to V"},
  ],
  senior:[
    {id:"sr-despite",q:"Choose the best connector.",zh:"選出最適合的連接詞。",choices:["Despite the rain, the game continued.","Because the rain, the game continued.","Although the rain, the game continued.","However the rain, the game continued."],answer:0,tip:"Despite + noun phrase"},
    {id:"sr-emphasis",q:"Which phrase means especially important?",zh:"哪個片語表示特別重要？",choices:["of great importance","out of place","in a hurry","by mistake"],answer:0,tip:"of great importance = very important"},
    {id:"sr-causative",q:"Complete: The teacher had us ___ the essay again.",zh:"完成句子：老師要我們再寫一次作文。",choices:["write","wrote","writing","to write"],answer:0,tip:"have + object + base verb"},
    {id:"sr-participle",q:"Choose the correct sentence.",zh:"選出正確句子。",choices:["Feeling tired, Kevin went home early.","Felt tired, Kevin went home early.","Feel tired, Kevin went home early.","To feeling tired, Kevin went home early."],answer:0,tip:"V-ing phrase can show reason."},
    {id:"sr-inference",q:"What does infer mean?",zh:"infer 是什麼意思？",choices:["guess from evidence","copy every word","refuse an idea","repeat loudly"],answer:0,tip:"infer = 推論"},
    {id:"sr-contrast",q:"Choose a word that shows contrast.",zh:"選出表示對比的字。",choices:["nevertheless","therefore","similarly","meanwhile"],answer:0,tip:"nevertheless = 然而"},
    {id:"sr-condition",q:"Complete: Unless you practice, you ___ improve.",zh:"完成句子：除非你練習，否則不會進步。",choices:["will not","would not have","did not","are not"],answer:0,tip:"Unless + present, will..."},
    {id:"sr-noun-clause",q:"Choose the correct sentence.",zh:"選出正確句子。",choices:["I do not know what he wants.","I do not know what does he want.","I do not know what wants he.","I do not know he what wants."],answer:0,tip:"Noun clause uses statement word order."},
    {id:"sr-concise",q:"Which word is closest to concise?",zh:"哪個字最接近 concise？",choices:["brief and clear","long and confusing","loud and funny","slow and careful"],answer:0,tip:"concise = 簡潔的"},
    {id:"sr-assumption",q:"What does assumption mean?",zh:"assumption 是什麼意思？",choices:["something believed without proof","a finished project","a kind answer","a public event"],answer:0,tip:"assumption = 假設"},
  ],
};

const PET_ADVENTURE_RECENT_QUESTION_KEY="englishgo_pet_adventure_recent_questions";
const PET_ADVENTURE_PROGRESS_KEY="englishgo_pet_adventure_progress";
const PET_ADVENTURE_BOSS_REQUIRED_CLEARS=3;

function getAdventureQuestionSource(lv){
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

function drawAdventureQuestions(lv,count,usedKeys=new Set(),pickedKeys=[]){
  const source=uniqueAdventureQuestions(getAdventureQuestionSource(lv));
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

function buildPetAdventureStages(teamPets,lv,{bossReady=false,difficultyLevel=1}={}){
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
      questions:drawAdventureQuestions(lv,6,usedQuestions,pickedQuestionKeys),
      maxHp,
      attack:Math.round((14+i*7+teamPower*.035)*attackScale),
      difficultyLevel,
    };
  });
  const adventureStages=bossReady?[
    ...normalStages,
    {
      ...PET_ADVENTURE_BOSS,
      questions:drawAdventureQuestions(lv,10,usedQuestions,pickedQuestionKeys),
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

const S={btn:{padding:"12px 24px",borderRadius:12,border:"none",fontWeight:600,fontSize:16,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"},
  card:{background:"var(--color-background-primary,#fff)",borderRadius:16,border:"1px solid var(--color-border-tertiary,#e0dfd9)"},
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
  const isSponsor=sponsor.active;

  // Deep link: detect ?word=xxx&lv=xxx from shared URL
  useEffect(()=>{
    const p=new URLSearchParams(window.location.search);
    const w=p.get("word"),l=p.get("lv"),support=p.get("support");
    if(w&&l&&LV[l]){setLv(l);setMod("srs");setSharedWord(w)}
    if(support){setLv(LV[l]?l:"elementary");setMod("sponsor")}
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

  useEffect(()=>{const r=document.documentElement.style;r.colorScheme=dark?"dark":"light";if(dark){r.setProperty('--color-background-primary','#1a1a2e');r.setProperty('--color-background-secondary','#16213e');r.setProperty('--color-background-tertiary','#0f0f23');r.setProperty('--color-text-primary','#e0e0e0');r.setProperty('--color-text-secondary','#a0a0a0');r.setProperty('--color-text-tertiary','#707070');r.setProperty('--color-border-tertiary','#2a2a4a')}else{['--color-background-primary','--color-background-secondary','--color-background-tertiary','--color-text-primary','--color-text-secondary','--color-text-tertiary','--color-border-tertiary'].forEach(p=>r.removeProperty(p))}},[dark]);

  if(!lv)return<Landing onSelect={setLv} dark={dark} setDark={setDark}/>;
  const c=LV[lv],back=()=>setMod(null);

  return(
    <div style={{minHeight:"100vh",background:S.bg3,fontFamily:"'Noto Sans TC','Segoe UI',sans-serif"}}>
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
      <nav style={{background:S.bg1,borderBottom:`1px solid ${S.bd}`,padding:"8px 12px",paddingTop:"calc(8px + env(safe-area-inset-top, 0px))",display:"flex",alignItems:"center",gap:6,position:"sticky",top:0,zIndex:100}}>
        <button onClick={()=>{setLv(null);setMod(null)}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",padding:"4px",minWidth:32,minHeight:32,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
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
      <div style={{maxWidth:!mod?940:mod==="petAdventure"?1280:760,margin:"0 auto",padding:mod==="petAdventure"?"14px 18px calc(20px + env(safe-area-inset-bottom, 0px))":"12px 12px calc(16px + env(safe-area-inset-bottom, 0px))"}}>
        {!mod?<MenuV2 lv={lv} onSelect={m=>{setSharedWord(null);setMod(m)}} daily={daily} c={c} xp={xp} coins={coins} streak={streak} achUnlocked={achUnlocked} weakWords={weakWords} isSponsor={isSponsor} pets={pets} eggs={eggs}/>:
         mod==="wordsearch"?<WordSearchM lv={lv} onBack={back} onOpenCard={(word,level)=>{setLv(level||lv);setSharedWord(word);setMod("srs")}}/>:
         mod==="srs"?<SRS lv={lv} onBack={back} onXp={n=>addXpWithTask(n,"srsToday")} onDone={()=>setStats(s=>({...s,srsRounds:s.srsRounds+1}))} trackWeak={trackWeak} gifKey={gifKey} onSetGifKey={setGifKey} sharedWord={sharedWord} apiKey={gemKey} onSetApiKey={setGemKey} weakWords={weakWords}/>:
         mod==="quiz"?<QuizM lv={lv} onBack={back} onXp={n=>addXpWithTask(n,"quizToday")} onPerfect={()=>setStats(s=>({...s,perfectQuiz:s.perfectQuiz+1}))} trackWeak={trackWeak}/>:
         mod==="speak"?<SpeakM lv={lv} onBack={back} onXp={n=>addXpWithTask(n,"speakToday")}/>:
         mod==="whack"?<WhackM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="match"?<MatchM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="bomb"?<BombM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="grammar"?<GrammarM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="reading"?<ReadingM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="novels"?<NovelM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="songs"?<SongsM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="dictation"?<DictM lv={lv} onBack={back} onXp={addXp} onDone={()=>setStats(s=>({...s,dictDone:s.dictDone+1}))}/>:
         mod==="scramble"?<ScramM lv={lv} onBack={back} onXp={addXp} onDone={()=>setStats(s=>({...s,scramDone:s.scramDone+1}))}/>:
         mod==="ai"?<AIT lv={lv} onBack={back} apiKey={gemKey} onSetKey={setGemKey}/>:
         mod==="story"?<StoryMode lv={lv} onBack={back} apiKey={gemKey} onSetKey={setGemKey} pets={pets} c={c} onXp={addXp} trackWeak={trackWeak}/>:
         mod==="achievements"?<AchPage onBack={back} unlocked={achUnlocked} c={c}/>:
         mod==="weak"?<WeakPage onBack={back} weakWords={weakWords} setWeakWords={setWeakWords} c={c} lv={lv}/>:
         mod==="dashboard"?<Dashboard onBack={back} c={c} xp={xp} streak={streak} stats={stats} daily={daily} weakWords={weakWords} history={history} achUnlocked={achUnlocked} lv={lv} isSponsor={isSponsor}/>:
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
          <div style={{marginBottom:8}}><a href="/learn/api-keys.html" style={{color:c.cl,textDecoration:"underline"}}>🔑 API Key 申請教學</a> · <a href="/learn/gif-guide.html" style={{color:c.cl,textDecoration:"underline"}}>🖼️ 單字動圖說明</a> · <button onClick={()=>setMod("sponsor")} style={{background:"none",border:"none",padding:0,color:c.cl,textDecoration:"underline",font:"inherit",cursor:"pointer"}}>☕ 支持我們</button></div>
          <div style={{display:"inline-block",fontSize:10,color:"#1D9E75",fontWeight:600,padding:"3px 10px",background:"#E1F5EE",borderRadius:10,marginBottom:6}}>✨ 100% 無廣告 · 純淨學習空間</div>
          <div>AI Tutor powered by <b>Gemini</b> · Speech by <b>Web Speech API</b></div>
          <div>© {new Date().getFullYear()} EnglishGo · 專為台灣學生設計</div>
        </div>
      </footer>
    </div>
  );
}

// ═══ LANDING ════════════════════════════════════════════════════════
function Landing({onSelect,dark,setDark}){
  const[hov,setHov]=useState(null);
  return(<div style={{minHeight:"100vh",background:"linear-gradient(150deg,#091825,#122a45 45%,#183a58 75%,#0d1f32)",color:"#fff",fontFamily:"'Noto Sans TC','Segoe UI',sans-serif"}}>
    <div style={{position:"relative",zIndex:1,maxWidth:860,margin:"0 auto",padding:"48px 20px 36px",textAlign:"center"}}>
      <div style={{position:"absolute",top:20,right:20}}><button onClick={()=>setDark(!dark)} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:20,padding:"6px 12px",fontSize:12,color:"#fff",cursor:"pointer"}}>{dark?"☀️ 淺色":"🌙 深色"}</button></div>
      <div style={{animation:"fadeUp .7s",display:"inline-flex",alignItems:"center",gap:10,background:"rgba(255,255,255,.06)",borderRadius:36,padding:"8px 22px",border:"1px solid rgba(255,255,255,.1)"}}><span style={{fontSize:28}}>📘</span><span style={{fontSize:24,fontWeight:700,letterSpacing:1.5}}>EnglishGo</span></div>
      <p style={{animation:"fadeUp .7s .15s both",color:"rgba(255,255,255,.5)",fontSize:13,marginTop:12}}>專為台灣學生設計 · AI 驅動英語學習平台</p>
      <h1 style={{animation:"fadeUp .7s .3s both",fontSize:"clamp(22px,5vw,36px)",fontWeight:700,margin:"16px 0 8px",lineHeight:1.35}}><span style={{background:"linear-gradient(90deg,#5DCAA5,#85B7EB,#ED93B1)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>科學記憶 × 間隔重複 × AI 家教</span></h1>
      <p style={{animation:"fadeUp .7s .45s both",color:"rgba(255,255,255,.4)",fontSize:14,maxWidth:420,margin:"0 auto 32px"}}>SRS 演算法 · 聽寫訓練 · 句子重組 · Gemini AI 免費對話</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14,animation:"fadeUp .7s .6s both"}}>
        {Object.entries(LV).map(([k,c])=>(<div key={k} onClick={()=>onSelect(k)} onMouseEnter={()=>setHov(k)} onMouseLeave={()=>setHov(null)} style={{cursor:"pointer",background:hov===k?"rgba(255,255,255,.12)":"rgba(255,255,255,.05)",border:`1px solid ${hov===k?"rgba(255,255,255,.2)":"rgba(255,255,255,.08)"}`,borderRadius:16,padding:"24px 16px 20px",transition:"all .25s",transform:hov===k?"translateY(-4px)":"none"}}><div style={{fontSize:36,marginBottom:6}}>{c.ic}</div><div style={{fontSize:22,fontWeight:700}}>{c.l}</div><div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginBottom:10}}>{c.en}</div><div style={{fontSize:12,color:c.ac,background:`${c.ac}22`,borderRadius:14,padding:"3px 10px",display:"inline-block"}}>{c.wd}</div></div>))}
      </div>
      <div style={{marginTop:40,display:"flex",flexWrap:"wrap",justifyContent:"center",gap:20,animation:"fadeUp .7s .8s both"}}>
        {[{i:"🃏",t:"SRS 記憶",d:"Anki 演算法"},{i:"🎧",t:"聽寫訓練",d:"聽力最弱救星"},{i:"🧩",t:"句子重組",d:"語感養成"},{i:"🤖",t:"AI 家教",d:"Gemini 免費"},{i:"🏆",t:"成就系統",d:"徽章收集"},{i:"🌙",t:"深色模式",d:"護眼學習"}].map((f,i)=>(<div key={i} style={{textAlign:"center",width:95}}><div style={{fontSize:22,marginBottom:3}}>{f.i}</div><div style={{fontSize:11,fontWeight:600}}>{f.t}</div><div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{f.d}</div></div>))}
      </div>
      {/* Learning Articles */}
      <div style={{marginTop:40,animation:"fadeUp .7s 1s both"}}>
        <div style={{fontSize:14,fontWeight:600,color:"rgba(255,255,255,.6)",marginBottom:14,textAlign:"center"}}>📖 學習資源</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
          {[{href:"/learn/srs-method.html",t:"什麼是 SRS 間隔重複記憶法？",d:"科學證實最有效的單字記憶方法",ic:"🧠"},
            {href:"/learn/speaking-tips.html",t:"如何提升英文口說能力？",d:"5 個不用出國也能練好的方法",ic:"🗣️"},
            {href:"/learn/vocabulary-guide.html",t:"國中會考單字準備攻略",d:"1,200 字怎麼背最有效？",ic:"📚"},
            {href:"/learn/api-keys.html",t:"API Key 申請教學",d:"Gemini 與 Giphy Key 設定",ic:"🔑"},
            {href:"/learn/gif-guide.html",t:"單字動圖效果介紹",d:"看申請前後差異與線上測試",ic:"🖼️"},
            {href:"/?support=1",t:"支持 EnglishGo",d:"銀行轉帳與留言支持",ic:"☕"}
          ].map((a,i)=>(<a key={i} href={a.href} style={{display:"block",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:"16px",textDecoration:"none",color:"#fff",transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.1)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.05)"}><div style={{fontSize:20,marginBottom:4}}>{a.ic}</div><div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{a.t}</div><div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{a.d}</div></a>))}
        </div>
      </div>
      {/* Landing Footer */}
      <footer style={{textAlign:"center",padding:"40px 20px 56px",fontSize:11,color:"rgba(255,255,255,.35)",lineHeight:1.8,borderTop:"1px solid rgba(255,255,255,.08)",marginTop:32}}>
        <div style={{maxWidth:480,margin:"0 auto"}}>
          <div style={{fontWeight:600,fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:6}}>📘 如何使用</div>
          <div style={{marginBottom:10}}>選擇你的等級，透過 SRS 單字卡、口說練習、遊戲等多種模式學英文。AI 家教隨時回答問題。每天只要 10 分鐘！</div>
          <div style={{display:"inline-block",fontSize:10,color:"#7FD1AE",fontWeight:600,padding:"4px 12px",background:"rgba(127,209,174,.1)",border:"1px solid rgba(127,209,174,.3)",borderRadius:12,marginBottom:10}}>✨ 100% 無廣告 · 純淨學習空間</div>
          <div>AI Tutor powered by <b>Gemini</b> · Speech by <b>Web Speech API</b></div>
          <div>© {new Date().getFullYear()} EnglishGo · 專為台灣學生設計</div>
        </div>
      </footer>
    </div>
  </div>);
}

function MenuV2({lv,onSelect,daily,c,xp,coins,streak,achUnlocked,weakWords,isSponsor,pets,eggs}){
  const target=Math.max(1,daily?.target||1);
  const pct=Math.min(100,Math.round(((daily?.done||0)/target)*100));
  const todayKey=dateKey();
  const vocab=V[lv]||[];
  const fallbackToday=vocab[hashText(`${todayKey}:${lv}:fallback`)%Math.max(1,vocab.length)]||{w:"learn",m:"學習",p:"v."};
  const[todayWord,setTodayWord]=useState(fallbackToday);
  const[cloudCount,setCloudCount]=useState(0);
  const[activeGroup,setActiveGroup]=useState("learn");
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
    {id:"gacha",group:"pet",icon:"G",t:"扭蛋機",d:`${coins} 金幣可使用`,tag:"取得寵物"},
    {id:"pets",group:"pet",icon:"P",t:"寵物圖鑑",d:`${pets.length} 隻寵物 · ${eggs.length} 顆蛋`,tag:"培養照顧"},
    {id:"petAdventure",group:"pet",icon:"A",t:"寵物冒險",d:pets.length?`${pets.length} 隻可組隊戰鬥`:"先取得寵物再挑戰",tag:"英文戰鬥"},
    {id:"achievements",group:"tools",icon:"★",t:"成就牆",d:`${achUnlocked.length}/${ACH_DEFS.length} 個已解鎖`,tag:"學習成果"},
    {id:"weak",group:"tools",icon:"!",t:"弱點單字",d:weakWords.length?`${weakWords.length} 個需要複習`:"目前沒有弱點紀錄",tag:"補強清單"},
    {id:"dashboard",group:"tools",icon:"▤",t:"學習報告",d:"查看 XP、連續天數與紀錄",tag:"進度分析"},
    {id:"sponsor",group:"tools",icon:"♡",t:isSponsor?"支持紀錄":"支持我們",d:isSponsor?"已留下支持資訊":"銀行轉帳與留言",tag:"支持專案"},
  ];
  const groups=[
    {id:"learn",icon:"▣",t:"學習",d:"單字、文法、口說",color:c.cl},
    {id:"read",icon:"R",t:"閱讀聽力",d:"短文、小說、歌曲",color:"#185FA5"},
    {id:"game",icon:"▶",t:"遊戲",d:"用遊戲加強反應",color:"#D97706"},
    {id:"pet",icon:"P",t:"寵物",d:"扭蛋、培養、冒險",color:"#DB2777"},
    {id:"tools",icon:"▤",t:"工具",d:"報告、弱點、支持",color:"#7C3AED"},
  ];
  const activeGroupData=groups.find(g=>g.id===activeGroup)||groups[0];
  const activeModules=modules.filter(m=>m.group===activeGroup);
  const recommendedIds=["srs",weakWords.length?"weak":"wordsearch",pets.length?"petAdventure":"quiz"];
  const recommendedModules=recommendedIds.map(id=>modules.find(m=>m.id===id)).filter(Boolean);
  const statItems=[
    {label:"連續",value:`${streak} 天`,hint:"保持節奏",tone:"#E24B4A"},
    {label:"XP",value:xp,hint:"累積學習量",tone:"#D97706"},
    {label:"金幣",value:coins,hint:"可用於寵物",tone:"#C47A12",action:"gacha"},
    {label:"寵物",value:pets.length,hint:eggs.length?`${eggs.length} 顆蛋待孵化`:"培養夥伴",tone:c.cl,action:"pets"},
  ];
  const ModuleCard=({m})=>{
    const group=groups.find(g=>g.id===m.group)||groups[0];
    return(
      <button type="button" className="eg-menu-module" onClick={()=>onSelect(m.id)} style={{"--module-color":group.color}}>
        <span className="eg-menu-module-icon">{m.icon}</span>
        <span className="eg-menu-module-body">
          <span className="eg-menu-module-title">{m.t}</span>
          <span className="eg-menu-module-desc">{m.d}</span>
          <span className="eg-menu-module-tag">{m.tag}</span>
        </span>
      </button>
    );
  };

  return(
    <div className="eg-menu" style={{"--accent":c.cl,"--accent-2":c.ac,"--accent-soft":c.bg,"--card":S.bg1,"--surface":S.bg2,"--page":S.bg3,"--border":S.bd,"--text":S.t1,"--muted":S.t2,"--faint":S.t3}}>
      <style>{`
        .eg-menu{display:grid;gap:16px}
        .eg-menu button{font-family:inherit}
        .eg-menu-hero{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--accent) 24%,var(--border));border-radius:24px;background:linear-gradient(135deg,var(--accent-soft),var(--card) 58%);box-shadow:0 18px 40px rgba(15,110,86,.08);padding:18px;display:grid;grid-template-columns:minmax(0,1fr) 278px;gap:16px}
        .eg-menu-hero:after{content:"";position:absolute;right:-110px;top:-120px;width:280px;height:280px;border-radius:999px;background:color-mix(in srgb,var(--accent) 12%,transparent);pointer-events:none}
        .eg-menu-eyebrow{display:inline-flex;align-items:center;gap:8px;width:max-content;max-width:100%;padding:6px 10px;border-radius:999px;border:1px solid color-mix(in srgb,var(--accent) 22%,transparent);background:color-mix(in srgb,var(--accent) 8%,var(--card));color:var(--accent);font-size:12px;font-weight:900}
        .eg-menu-word-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}
        .eg-menu-word{font-size:clamp(30px,7vw,46px);font-weight:1000;line-height:1;color:var(--text);letter-spacing:0}
        .eg-menu-sound{width:42px;height:42px;border-radius:14px;border:1px solid color-mix(in srgb,var(--accent) 24%,var(--border));background:var(--card);color:var(--accent);font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 8px 18px color-mix(in srgb,var(--accent) 10%,transparent)}
        .eg-menu-word-meta{font-size:14px;color:var(--muted);margin-top:8px;line-height:1.55}
        .eg-menu-progress{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;margin-top:18px}
        .eg-menu-track{height:10px;border-radius:999px;background:rgba(0,0,0,.07);overflow:hidden}
        .eg-menu-fill{height:100%;width:var(--progress);border-radius:999px;background:linear-gradient(90deg,var(--accent),var(--accent-2));transition:width .25s ease}
        .eg-menu-progress-label{font-size:12px;font-weight:1000;color:var(--accent)}
        .eg-menu-note{font-size:12px;color:var(--faint);line-height:1.6;margin-top:8px}
        .eg-menu-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;position:relative;z-index:1}
        .eg-menu-stat{border:1px solid color-mix(in srgb,var(--tone) 18%,var(--border));border-radius:18px;background:linear-gradient(135deg,color-mix(in srgb,var(--tone) 9%,var(--card)),var(--card));padding:13px;text-align:left;min-height:92px;cursor:default}
        .eg-menu-stat.has-action{cursor:pointer}
        .eg-menu-stat-label{display:block;font-size:11px;color:var(--tone);font-weight:1000}
        .eg-menu-stat-value{display:block;font-size:22px;color:var(--text);font-weight:1000;margin-top:8px;line-height:1.05}
        .eg-menu-stat-hint{display:block;font-size:11px;color:var(--faint);margin-top:6px;line-height:1.35}
        .eg-menu-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:2px 2px 10px}
        .eg-menu-section-title{font-size:16px;font-weight:1000;color:var(--text)}
        .eg-menu-section-sub{font-size:12px;color:var(--faint);margin-top:3px;line-height:1.45}
        .eg-menu-recommended{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .eg-menu-groups{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
        .eg-menu-group{border:1px solid transparent;border-radius:18px;background:var(--surface);padding:12px 10px;text-align:left;cursor:pointer;min-height:78px;color:var(--text);transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease}
        .eg-menu-group:hover,.eg-menu-module:hover{transform:translateY(-2px)}
        .eg-menu-group.is-active{border-color:color-mix(in srgb,var(--group-color) 58%,var(--border));background:linear-gradient(135deg,color-mix(in srgb,var(--group-color) 12%,var(--card)),var(--card));box-shadow:0 10px 24px color-mix(in srgb,var(--group-color) 12%,transparent)}
        .eg-menu-group-top{display:flex;align-items:center;gap:8px}
        .eg-menu-group-icon{width:28px;height:28px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--group-color) 12%,var(--card));color:var(--group-color);font-weight:1000;font-size:13px}
        .eg-menu-group-title{font-size:13px;font-weight:1000;color:var(--text)}
        .eg-menu-group-desc{display:block;font-size:11px;color:var(--faint);line-height:1.35;margin-top:7px}
        .eg-menu-panel{border:1px solid color-mix(in srgb,var(--active-color) 18%,var(--border));border-radius:22px;background:linear-gradient(135deg,color-mix(in srgb,var(--active-color) 7%,var(--card)),var(--card));padding:14px}
        .eg-menu-module-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:10px}
        .eg-menu-module{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--module-color) 18%,var(--border));border-radius:18px;background:var(--card);padding:14px;text-align:left;display:flex;gap:11px;min-height:106px;cursor:pointer;color:var(--text);transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease}
        .eg-menu-module:hover{box-shadow:0 12px 24px color-mix(in srgb,var(--module-color) 12%,transparent);border-color:color-mix(in srgb,var(--module-color) 45%,var(--border))}
        .eg-menu-module:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--module-color);opacity:.8}
        .eg-menu-module-icon{width:38px;height:38px;border-radius:13px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--module-color) 12%,var(--card));color:var(--module-color);font-size:15px;font-weight:1000;flex:0 0 auto}
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
          .eg-menu-recommended{grid-template-columns:1fr}
          .eg-menu-groups{display:flex;overflow-x:auto;padding-bottom:2px}
          .eg-menu-group{min-width:112px;min-height:64px;padding:10px}
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
        </div>
        <div className="eg-menu-stats">
          {statItems.map(item=>(
            <button key={item.label} type="button" disabled={!item.action} onClick={()=>item.action&&onSelect(item.action)} className={`eg-menu-stat ${item.action?"has-action":""}`} style={{"--tone":item.tone}}>
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
          <button type="button" className="eg-menu-alert-action" onClick={()=>onSelect("weak")}>開始複習</button>
        </section>
      )}

      <section>
        <div className="eg-menu-section-head">
          <div>
            <div className="eg-menu-section-title">建議下一步</div>
            <div className="eg-menu-section-sub">依照目前進度挑出最常用的入口。</div>
          </div>
        </div>
        <div className="eg-menu-recommended">
          {recommendedModules.map(m=><ModuleCard key={`rec-${m.id}`} m={m}/>)}
        </div>
      </section>

      <section className="eg-menu-groups" aria-label="功能分類">
        {groups.map(g=>{
          const active=g.id===activeGroup;
          return(
            <button key={g.id} type="button" className={`eg-menu-group ${active?"is-active":""}`} onClick={()=>setActiveGroup(g.id)} style={{"--group-color":g.color}}>
              <span className="eg-menu-group-top">
                <span className="eg-menu-group-icon">{g.icon}</span>
                <span className="eg-menu-group-title">{g.t}</span>
              </span>
              <span className="eg-menu-group-desc">{g.d}</span>
            </button>
          );
        })}
      </section>

      <section className="eg-menu-panel" style={{"--active-color":activeGroupData.color}}>
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
async function fetchGif(word,apiKey){
  if(!apiKey)return null;
  const k=word.toLowerCase();
  if(_gifCache[k]!==undefined)return _gifCache[k];
  try{
    const res=await fetch(`https://api.giphy.com/v1/gifs/translate?api_key=${apiKey}&s=${encodeURIComponent(k)}&rating=g&lang=en`);
    const data=await res.json();
    const url=data?.data?.images?.fixed_height_small?.url||data?.data?.images?.fixed_height?.url||null;
    _gifCache[k]=url;
    return url;
  }catch{_gifCache[k]=null;return null}
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

function SRS({lv,onBack,onXp,onDone,trackWeak,gifKey,onSetGifKey,sharedWord,apiKey,onSetApiKey,weakWords=[]}){
  const built=V[lv];const[cards,setCards]=useState(built);const[deck,setDeck]=useState(()=>createDeck(built));const[flip,setFlip]=useState(false);const[info,setInfo]=useState(false);const[loading,setLoading]=useState(true);const[src,setSrc]=useState("built-in");const c=LV[lv];const fr=useRef();const completedRef=useRef(false);
  const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);const[comboAnim,setComboAnim]=useState(false);const[showConfetti,setShowConfetti]=useState(false);const[flipAnim,setFlipAnim]=useState(false);const[mascotMood,setMascotMood]=useState("idle");
  const[gifUrl,setGifUrl]=useState(null);const[gifLoading,setGifLoading]=useState(false);const[gifKeyInp,setGifKeyInp]=useState(gifKey||"");
  const[imgUrl,setImgUrl]=useState(null);
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
    {info&&<div style={{...S.card,padding:"12px 16px",marginBottom:10,fontSize:13,color:S.t2,lineHeight:1.7}}>💻 <b>Space</b> 翻牌/翻回 · <b>Enter</b> 朗讀 · <b>1</b>Again <b>2</b>Hard <b>3</b>Good <b>4</b>Easy<br/>📱 <b>點擊</b>翻牌 · 點 <b>🔙翻回</b> · <b>按鈕</b>評分<div style={{marginTop:4,fontSize:11,color:S.t3}}>來源：{src} {gifKey?"· 🖼️ GIF 已啟用":""}</div>
      <div style={{borderTop:`1px solid ${S.bd}`,marginTop:8,paddingTop:8}}>
        <div style={{fontWeight:700,fontSize:12,color:S.t1,marginBottom:4}}>🖼️ 單字動圖 (Giphy，可選)</div>
        <div style={{fontSize:11,color:S.t3,marginBottom:6,lineHeight:1.7}}>未設定也能使用內建圖片與表情符號；貼上 Giphy API Key 後，單字卡會依目前單字自動顯示相關 GIF。<a href="/learn/gif-guide.html" target="_blank" rel="noreferrer" style={{color:c.cl,fontWeight:700}}>看效果與申請教學</a></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:6,marginBottom:7}}>
          <div style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:8,padding:"7px 8px",fontSize:11,color:S.t2}}><b style={{color:S.t1}}>未啟用</b><br/>顯示內建圖片 / emoji</div>
          <div style={{background:c.bg,border:`1px solid ${c.cl}33`,borderRadius:8,padding:"7px 8px",fontSize:11,color:S.t2}}><b style={{color:c.cl}}>啟用後</b><br/>依單字搜尋 GIF 動圖</div>
        </div>
        <div style={{display:"flex",gap:5}}><input value={gifKeyInp} onChange={e=>setGifKeyInp(e.target.value)} placeholder="貼上 Giphy API Key，可留空關閉" type="password" style={{flex:1,padding:"6px 8px",borderRadius:6,border:`1px solid ${S.bd}`,fontSize:12,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",minWidth:0}}/><button onClick={()=>onSetGifKey(gifKeyInp.trim())} style={{...S.btn,background:c.cl,color:"#fff",padding:"6px 12px",fontSize:12}}>存</button></div>
      </div>
    </div>}
    {!(gifKey||"").trim()&&<div style={{...S.card,padding:"10px 12px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",fontSize:12,lineHeight:1.5}}>
      <div style={{color:S.t2,flex:"1 1 220px"}}><b style={{color:S.t1}}>🖼️ 單字動圖尚未啟用</b><br/>目前使用內建圖片；申請 Giphy Key 後可自動顯示單字相關 GIF。</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><a href="/learn/gif-guide.html" target="_blank" rel="noreferrer" style={{...S.btn,background:S.bg2,color:c.cl,padding:"8px 12px",fontSize:12,textDecoration:"none"}}>看效果</a><button onClick={()=>setInfo(true)} style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 12px",fontSize:12}}>設定動圖</button></div>
    </div>}
    {comboLabel&&<div style={{textAlign:"center",fontSize:combo>=7?16:13,fontWeight:700,color:"#EF9F27",marginBottom:4,animation:comboAnim?"comboFlash .5s ease-out":"none"}}>{comboLabel}</div>}
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8,fontSize:12}}><div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3,transition:"width .3s"}}/></div><span style={{color:S.t3}}>{left}/{deck.total}</span>{[["#E24B4A",deck.stats.again],["#EF9F27",deck.stats.hard],["#1D9E75",deck.stats.good],["#185FA5",deck.stats.easy]].map(([cl,v],i)=><span key={i} style={{color:cl,fontWeight:600}}>{v}</span>)}</div>
    <div onClick={handleCardTap} style={{cursor:!flip?"pointer":"default",borderRadius:16,padding:flip?"18px 20px 22px":"48px 20px",textAlign:"center",minHeight:flip?280:220,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:flip?"flex-start":"center",background:flip?`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`:S.bg1,border:`2px solid ${flip?c.ac:S.bd}`,transition:"all .3s",userSelect:"none",WebkitUserSelect:"none",animation:flipAnim?"cardFlip .35s ease-out":"none",position:"relative",overflow:"hidden"}}>
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
              <button onClick={(e)=>{e.stopPropagation();const k=prompt("請輸入 Gemini API Key 以自動生成優質例句：\n（免費申請：https://aistudio.google.com/apikey）");if(k){onSetApiKey(k.trim());}}} style={{background:"none",border:`1px solid ${c.cl}`,color:c.cl,padding:"4px 12px",fontSize:11,borderRadius:8,marginTop:6,cursor:"pointer",fontFamily:"inherit"}}>🔑 設定 API Key 自動生成</button>
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

function speakPassThreshold(item){return item?.type==="word"?80:70}
function SpeakM({lv,onBack,onXp}){
  const c=LV[lv];
  const[items,setItems]=useState([]);const[loading,setLoading]=useState(true);
  const[si,setSi]=useState(0);const[phase,setPhase]=useState("ready");
  const[listening,setListening]=useState(false);const[spoken,setSpoken]=useState("");const[interim,setInterim]=useState("");
  const[comparison,setComparison]=useState(null);const[records,setRecords]=useState({});
  const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);
  const[showConfetti,setShowConfetti]=useState(false);const[showSuccess,setShowSuccess]=useState(false);
  const[noSupport,setNoSupport]=useState(false);const[tip,setTip]=useState("");
  const recogRef=useRef(null);const finalRef=useRef("");const interimRef=useRef("");const rewardedRef=useRef(new Set());

  const loadItems=useCallback(async()=>{
    setLoading(true);stopSpeech();
    try{recogRef.current?.abort?.()}catch{}
    const r=await fetchSpeakItems(lv,12);
    setItems(r);setSi(0);setPhase("ready");setSpoken("");setInterim("");setComparison(null);setRecords({});setCombo(0);setMaxCombo(0);setTip("");rewardedRef.current=new Set();setLoading(false);
  },[lv]);
  useEffect(()=>{loadItems()},[loadItems]);

  const cur=items[si];const currentRecord=records[si];const score=Object.values(records).filter(r=>r.passed).length;const attemptsTotal=Object.values(records).reduce((n,r)=>n+(r.attempts||0),0);

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
  const retryAndListen=()=>{retry();speechTimer(startListening,120)};
  const nextItem=()=>{
    if(si+1>=items.length){playSound("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500);setPhase("done");return}
    setSi(s=>s+1);setPhase("ready");setSpoken("");setInterim("");setComparison(null);setTip("");
  };
  const retry=()=>{setPhase("ready");setSpoken("");setInterim("");setComparison(null);setTip("")};
  const restart=()=>loadItems();
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
        {cur.keyword&&<div style={{fontSize:11,color:S.t3,marginTop:5}}>重點單字：<b style={{color:c.cl}}>{cur.keyword}</b></div>}
        {isSentence&&<div style={{display:"flex",gap:5,justifyContent:"center",flexWrap:"wrap",marginTop:10}}>{normalizeText(cur.en).split(" ").map(w=><span key={w} style={{fontSize:12,color:S.t2,background:S.bg2,borderRadius:999,padding:"4px 8px"}}>{w}</span>)}</div>}
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
function grammarGuide(rule){return GRAMMAR_GUIDES[rule?.t]||{zh:rule?.d||"",pattern:rule?.d||"",tips:["先找主詞和時間","再看句型","最後檢查答案是否自然"],mistake:"選完後把句子完整讀一次，通常能發現不自然的地方。"}}
function grammarCloze(sentence,fill,cl){
  const parts=String(sentence||"").split("___");
  return parts.map((p,i)=><span key={i}>{p}{i<parts.length-1&&<span style={{display:"inline-block",minWidth:76,borderBottom:`3px solid ${cl}`,textAlign:"center",fontWeight:800,color:cl,padding:"0 6px",margin:"0 2px"}}>{fill||"？"}</span>}</span>);
}
function GrammarM({lv,onBack,onXp}){
  const rules=G[lv];const c=LV[lv];
  const[sel,setSel]=useState(null);const[answers,setAnswers]=useState({});const[showResult,setShowResult]=useState(false);const[showHint,setShowHint]=useState(false);
  const rewarded=useRef(new Set());
  useEffect(()=>{setSel(null);setAnswers({});setShowResult(false);setShowHint(false);rewarded.current=new Set()},[lv]);
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
  const clearCurrentAnswer=()=>{setAnswers(a=>{const next={...a};delete next[sel];return next});setShowHint(true)};
  const goNext=()=>{setShowHint(false);if(sel<rules.length-1)setSel(sel+1);else setShowResult(true)};
  const goPrev=()=>{setShowHint(false);if(sel>0)setSel(sel-1)};

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

  const r=rules[sel];const guide=grammarGuide(r);const current=answers[sel];const progress=(sel+1)/rules.length*100;const fill=current?r.q.o[current.choice]:"";const fillColor=current?(current.correct?"#1D9E75":"#E24B4A"):c.cl;
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

      <div style={{background:S.bg2,borderRadius:14,padding:"13px 14px",marginBottom:15}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:5}}><div style={{fontSize:12,fontWeight:800,color:S.t2}}>範例</div><button onClick={()=>speak(r.ex)} style={{background:S.bg1,border:`1px solid ${S.bd}`,borderRadius:10,padding:"4px 8px",fontSize:12,cursor:"pointer",color:c.cl,fontFamily:"inherit"}}>🔊 發音</button></div>
        <div style={{fontSize:16,color:S.t1,fontStyle:"italic",lineHeight:1.65}}>"{r.ex}"</div>
      </div>

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
const NOVEL_PAGE_SIZE=5;
const LazyNovelIllustration=lazy(()=>import("./components/NovelIllustration.jsx"));
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
function NovelM({lv,onBack,onXp}){
  const c=LV[lv];const[novelData,setNovelData]=useState(null);const[ni,setNi]=useState(0);const[ci,setCi]=useState(null);const[page,setPage]=useState(0);const[activeBlock,setActiveBlock]=useState(null);const[activeVocab,setActiveVocab]=useState(null);const[showZh,setShowZh]=useState(true);const[done,setDone]=useLS("novelDone",{});const[quizAns,setQuizAns]=useLS("novelQuiz",{});const rewarded=useRef({});const novelSpeechRef=useRef(null);const novelPanelRef=useRef(null);const novelBlockRefs=useRef({});
  useEffect(()=>{let active=true;import("./data/novels.js").then(m=>{if(active)setNovelData(m.NOVELS)}).catch(()=>{if(active)setNovelData({elementary:[]})});return()=>{active=false}},[]);
  useEffect(()=>()=>novelSpeechRef.current?.cancel?.(),[]);
  useEffect(()=>{setPage(0);setActiveBlock(null);setActiveVocab(null);novelBlockRefs.current={};novelPanelRef.current?.scrollTo({top:0})},[ci,ni]);
  const novels=novelData?(novelData[lv]?.length?novelData[lv]:novelData.elementary):[];
  const novel=novels[ni];const completed=done[novel?.id]||[];const chapter=ci==null?null:novel.chapters[ci];const blockPairs=useMemo(()=>novelBlockPairs(chapter?.en,chapter?.zh),[chapter]);const enBlocks=useMemo(()=>blockPairs.map(b=>b.en),[blockPairs]);const zhBlocks=useMemo(()=>blockPairs.map(b=>b.zh),[blockPairs]);const words=chapter?readingWords(chapter.en).length:0;const pct=novel?Math.round((completed.length/novel.chapters.length)*100):0;
  const novelImageBase=novel?.imageBase||"/images/novels/secret-forest";
  useEffect(()=>{if(typeof Image==="undefined"||!novel)return;const max=novel.chapters.length;const nums=ci==null?[1,2,3,4].filter(n=>n<=max):[ci+1,ci+2].filter(n=>n>=1&&n<=max);if(ci==null){const cover=new Image();cover.src=`${novelImageBase}/cover.jpg`}nums.forEach(n=>{const img=new Image();img.src=`${novelImageBase}/chapter-${n}${ci==null?"-thumb":""}.jpg`})},[ci,novel,novelImageBase]);
  const pages=useMemo(()=>{const out=[];for(let i=0;i<blockPairs.length;i+=NOVEL_PAGE_SIZE)out.push(blockPairs.slice(i,i+NOVEL_PAGE_SIZE).map((b,j)=>({...b,i:i+j})));return out},[blockPairs]);
  const pageNow=Math.min(page,Math.max(0,pages.length-1));const pageBlocks=pages[pageNow]||[];const pageStart=pageNow*NOVEL_PAGE_SIZE;
  useEffect(()=>{if(activeBlock!=null)scrollChildIntoPanel(novelPanelRef.current,novelBlockRefs.current[activeBlock],{align:.36})},[activeBlock,pageNow,showZh]);
  const quiz=chapter?chapter.quiz||[]:[];const quizKey=chapter?`${novel.id}:${chapter.no}`:"";const quizState=quizAns[quizKey]||{};const quizDone=!quiz.length||quiz.every((_,i)=>quizState[i]!=null);
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
  const goChapter=i=>{stopNovelSpeech();setCi(i);window.scrollTo({top:0,behavior:"smooth"})};
  const backToList=()=>{stopNovelSpeech();setCi(null)};
  if(!novelData)return(<div><Hdr t="📘 英文小說" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入小說中...</div></div>);
  if(!novel)return(<div><Hdr t="📘 英文小說" onBack={onBack} cl={c.cl}/><div style={{...S.card,padding:"28px 18px",textAlign:"center",color:S.t2}}>這個年級的小說準備中</div></div>);
  if(ci==null)return(<div><Hdr t="📘 英文小說" onBack={onBack} cl={c.cl}/>
    <div style={{...S.card,padding:0,overflow:"hidden",marginBottom:12,borderTop:`4px solid ${c.cl}`}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:0,background:"linear-gradient(135deg,#0C382E,#175B48 48%,#7ECBA9)",color:"#fff"}}>
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
    {novels.length>1&&<div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:10}}>{novels.map((n,i)=><button key={n.id} onClick={()=>{setNi(i);setCi(null)}} style={{flexShrink:0,padding:"8px 12px",border:"none",borderRadius:12,background:i===ni?c.cl:S.bg2,color:i===ni?"#fff":S.t1,fontWeight:700,fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>{n.title}</button>)}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(158px,1fr))",gap:10}}>
      {novel.chapters.map((ch,i)=>{const isDone=completed.includes(ch.no);return(<div key={ch.no} onClick={()=>goChapter(i)} style={{...S.card,padding:0,overflow:"hidden",cursor:"pointer",border:`1px solid ${isDone?"#1D9E75":S.bd}`}}>
        <div style={{position:"relative",color:"#fff"}}>
          <NovelIllustration chapter={ch.no} small imageBase={novelImageBase} title={novel.title}/>
          <div style={{position:"absolute",top:8,left:8,width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,.9)",color:c.cl,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900}}>{ch.no}</div>
          {isDone&&<div style={{position:"absolute",top:8,right:8,borderRadius:999,background:"#E1F5EE",color:"#1D9E75",padding:"3px 8px",fontSize:11,fontWeight:800}}>已讀</div>}
        </div>
        <div style={{padding:"12px 12px 13px"}}>
          <div style={{fontSize:14,fontWeight:800,color:S.t1,lineHeight:1.35}}>{ch.title}</div>
          <div style={{fontSize:12,color:S.t2,marginTop:4}}>{ch.zhTitle}</div>
          <div style={{fontSize:11,color:S.t3,marginTop:8}}>{readingWords(ch.en).length} words · {ch.vocab.length} key words</div>
        </div>
      </div>)})}
    </div>
  </div>);
  const next=ci+1<novel.chapters.length?ci+1:null;const prev=ci>0?ci-1:null;const isDone=completed.includes(chapter.no);const canPrevPage=pageNow>0;const canNextPage=pageNow+1<pages.length;const quizScore=quiz.reduce((n,q,i)=>n+(quizState[i]===q.a?1:0),0);
  const turnPage=p=>{stopNovelSpeech();setActiveBlock(null);setPage(Math.max(0,Math.min(p,pages.length-1)));novelPanelRef.current?.scrollTo({top:0,behavior:"smooth"})};
  const finishAndGo=()=>{completeChapter();if(quizDone){next!=null?goChapter(next):backToList()}};
  return(<div><Hdr t="📘 英文小說" onBack={backToList} cl={c.cl} extra={<button onClick={()=>setShowZh(z=>!z)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 8px",fontSize:12,color:c.cl,cursor:"pointer",fontFamily:"inherit"}}>{showZh?"隱藏中文":"顯示中文"}</button>}/>
    <div style={{...S.card,padding:0,overflow:"hidden",marginBottom:10,borderTop:`4px solid ${c.cl}`,background:"#FFFDF7"}}>
      <NovelIllustration chapter={chapter.no} imageBase={novelImageBase} title={novel.title}/>
      <div style={{padding:"15px 16px 16px"}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}><div style={{width:42,height:42,borderRadius:"50%",background:c.cl,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,flexShrink:0}}> {chapter.no}</div><div style={{flex:1}}><div style={{fontSize:12,color:c.cl,fontWeight:900}}>Chapter {chapter.no}</div><div style={{fontSize:22,fontWeight:900,color:S.t1,lineHeight:1.2}}>{chapter.title}</div><div style={{fontSize:13,color:S.t2,marginTop:3}}>{chapter.zhTitle} · {words} words · Page {pageNow+1}/{pages.length}</div></div></div>
        <div style={{display:"flex",gap:6,marginTop:13,flexWrap:"wrap"}}><button onClick={readBilingualChapter} disabled={!zhBlocks.length} style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 12px",fontSize:12,flex:"1 1 132px",opacity:zhBlocks.length?1:.45}}>🎧 英中整章</button><button onClick={readBilingualPage} disabled={!pageBlocks.some(b=>b.zh)} style={{...S.btn,background:c.bg,color:c.cl,padding:"8px 12px",fontSize:12,flex:"1 1 120px",opacity:pageBlocks.some(b=>b.zh)?1:.45}}>🎧 英中本頁</button><button onClick={readChapter} style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 12px",fontSize:12,flex:"1 1 112px"}}>🔊 英文整章</button><button onClick={readPage} style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 12px",fontSize:12,flex:"1 1 104px"}}>🔊 英文本頁</button><button onClick={readChapterZh} disabled={!zhBlocks.length} style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 12px",fontSize:12,flex:"1 1 112px",opacity:zhBlocks.length?1:.45}}>🔈 中文整章</button><button onClick={readPageZh} disabled={!pageBlocks.some(b=>b.zh)} style={{...S.btn,background:S.bg2,color:S.t1,padding:"8px 12px",fontSize:12,flex:"1 1 104px",opacity:pageBlocks.some(b=>b.zh)?1:.45}}>🔈 中文本頁</button><button onClick={completeChapter} disabled={isDone||!quizDone} style={{...S.btn,background:isDone?"#E1F5EE":quizDone?c.cl:S.bg2,color:isDone?"#1D9E75":quizDone?"#fff":S.t3,padding:"8px 12px",fontSize:12,flex:"1 1 130px",opacity:(!quizDone&&!isDone)?0.62:1}}>{isDone?"已完成":quizDone?"完成 +15XP":"先完成測驗"}</button></div>
      </div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,fontSize:12}}><button onClick={()=>prev!=null&&goChapter(prev)} disabled={prev==null} style={{...S.btn,background:S.bg2,color:S.t1,padding:"7px 10px",opacity:prev==null?0.35:1,fontSize:12}}>← 上一章</button><div style={{flex:1,height:6,background:S.bg2,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${((chapter.no-1)+(pageNow+1)/pages.length)/novel.chapters.length*100}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3}}/></div><button onClick={()=>next!=null&&goChapter(next)} disabled={next==null} style={{...S.btn,background:S.bg2,color:S.t1,padding:"7px 10px",opacity:next==null?0.35:1,fontSize:12}}>下一章 →</button></div>
    <div ref={novelPanelRef} style={{height:"clamp(360px, calc(100vh - 430px), 680px)",minHeight:0,overflowY:"auto",overscrollBehavior:"contain",scrollBehavior:"smooth",padding:"0 4px 12px",border:`1px solid ${S.bd}`,borderRadius:12,background:"rgba(255,255,255,.42)"}}>
    <article style={{background:"#FFFDF7",border:`1px solid ${S.bd}`,borderRadius:8,padding:"14px 13px 16px",boxShadow:"0 8px 22px rgba(64,43,20,.08)",position:"relative"}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:6,background:"linear-gradient(180deg,#E8D9B7,#F8F0D6)"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:10,paddingLeft:4}}><div style={{fontSize:12,fontWeight:900,color:c.cl}}>Page {pageNow+1}</div><div style={{display:"flex",gap:3,alignItems:"center"}}>{pages.map((_,i)=><span key={i} style={{width:i===pageNow?16:5,height:5,borderRadius:999,background:i===pageNow?c.cl:S.bd,display:"block",transition:"all .15s"}}/>)}</div></div>
      <div style={{display:"grid",gap:6}}>
        {pageBlocks.map(b=><section key={b.i} ref={el=>{if(el)novelBlockRefs.current[b.i]=el}} onClick={()=>speakNovelText(b.en,"en-US",0.78,b.i)} style={{padding:"9px 10px",borderRadius:8,background:activeBlock===b.i?"#E6F7F0":"transparent",border:`1px solid ${activeBlock===b.i?c.cl:"transparent"}`,transition:"all .18s",cursor:"pointer"}}>
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}><p style={{flex:1,margin:0,fontSize:16,lineHeight:1.66,color:S.t1,fontWeight:/^“|^[A-Z][a-z]+[?!]?$/.test(b.en)?800:650,whiteSpace:"pre-line"}}>{b.en}</p><button onClick={e=>{e.stopPropagation();e.currentTarget.blur();speakNovelText(b.en,"en-US",0.78,b.i)}} style={{width:34,height:34,border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:10,padding:0,fontSize:13,cursor:"pointer",fontFamily:"inherit",color:c.cl,flexShrink:0}}>🔊</button></div>
          {showZh&&b.zh&&<div style={{marginTop:7,padding:"7px 9px",background:"#FFF7E6",border:"1px solid #F0D59A",borderRadius:8,fontSize:13,lineHeight:1.58,color:S.t2,whiteSpace:"pre-line",display:"flex",gap:8,alignItems:"flex-start"}}><span style={{flex:1}}>{b.zh}</span><button onClick={e=>{e.stopPropagation();e.currentTarget.blur();speakNovelText(b.zh,"zh-TW",1,b.i)}} title="朗讀中文" style={{width:30,height:30,background:"#fff",border:"1px solid #F0D59A",borderRadius:9,fontSize:14,cursor:"pointer",flexShrink:0}}>🔈</button></div>}
        </section>)}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:14}}><button onClick={()=>turnPage(pageNow-1)} disabled={!canPrevPage} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,padding:"10px",fontSize:13,opacity:canPrevPage?1:.4}}>上一頁</button><div style={{fontSize:12,color:S.t3,fontWeight:700}}>{pageNow+1}/{pages.length}</div><button onClick={()=>turnPage(pageNow+1)} disabled={!canNextPage} style={{...S.btn,background:c.cl,color:"#fff",flex:1,padding:"10px",fontSize:13,opacity:canNextPage?1:.4}}>下一頁</button></div>
    </article>
    <div style={{...S.card,padding:"14px 16px",marginTop:10,fontSize:12,color:S.t2,lineHeight:1.7}}><div style={{fontWeight:800,color:S.t1,marginBottom:7}}>重點單字</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{chapter.vocab.map(w=>{const on=activeVocab===w;return <button key={w} onClick={e=>{e.currentTarget.blur();speakNovelVocab(w)}} style={{border:`1px solid ${on?c.cl:S.bd}`,background:on?"#E6F7F0":S.bg1,borderRadius:999,padding:"6px 10px",fontSize:12,color:c.cl,cursor:"pointer",fontWeight:800,fontFamily:"inherit",boxShadow:on?`0 0 0 2px ${c.cl}22`:"none"}}>{w} 🔊</button>})}</div></div>
    <div style={{...S.card,padding:"14px 16px",marginTop:10}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:10}}><div style={{fontWeight:900,color:S.t1}}>章節小測驗</div><div style={{fontSize:12,color:quizDone?c.cl:S.t3,fontWeight:800}}>{quizDone?`已作答 · ${quizScore}/${quiz.length}`:`${Object.keys(quizState).length}/${quiz.length}`}</div></div>
      <div style={{display:"grid",gap:10}}>{quiz.map((q,qi)=>{const picked=quizState[qi];return(<div key={q.q} style={{border:`1px solid ${S.bd}`,borderRadius:8,padding:"11px",background:S.bg1}}><div style={{fontSize:14,fontWeight:800,color:S.t1,lineHeight:1.45}}>{qi+1}. {q.q}</div>{showZh&&<div style={{fontSize:12,color:S.t2,marginTop:2}}>{q.zh}</div>}<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:6,marginTop:9}}>{q.o.map((o,oi)=>{const selected=picked===oi;const correct=oi===q.a;const answered=picked!=null;return <button key={o} onClick={()=>chooseQuiz(qi,oi)} style={{border:`1px solid ${answered&&correct?c.cl:selected?"#D45757":S.bd}`,background:answered&&correct?"#E6F7F0":selected?"#FFF0F0":S.bg2,color:answered&&correct?c.cl:S.t1,borderRadius:8,padding:"9px 8px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>{o}</button>})}</div>{picked!=null&&<div style={{fontSize:12,color:picked===q.a?c.cl:"#B54848",fontWeight:800,marginTop:7}}>{picked===q.a?"答對了":"答錯了，正確答案已標示"}</div>}</div>)})}</div>
    </div>
    <div style={{display:"flex",gap:8,marginTop:10}}><button onClick={backToList} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,padding:"11px",fontSize:13}}>章節列表</button><button onClick={finishAndGo} disabled={!quizDone} style={{...S.btn,background:c.cl,color:"#fff",flex:1,padding:"11px",fontSize:13,opacity:quizDone?1:.45}}>{next!=null?"完成並下一章":"完成並返回"}</button></div>
    </div>
  </div>);
}
// ═══ SONGS (英文歌曲練習) ═════════════════════════════════════════════
function SongsM({lv,onBack,onXp}){
  const songs=SONGS[lv]||[];const c=LV[lv];const[si,setSi]=useState(0);const[time,setTime]=useState(0);const[dur,setDur]=useState(0);const[playing,setPlaying]=useState(false);const[showZh,setShowZh]=useState(true);const[view,setView]=useState("lyrics");const[speed,setSpeed]=useState(1);const[practice,setPractice]=useState({idx:0,pick:null,score:0,done:false});const audioRef=useRef(null);const lineRefs=useRef({});const songPanelRef=useRef(null);const rewarded=useRef({});
  const song=songs[si];const lyricLines=useMemo(()=>song?song.lines.map((l,i)=>({...l,i})).filter(l=>l.en):[],[song]);
  const hasAudio=!!song?.audio;
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
  useEffect(()=>{setPractice({idx:0,pick:null,score:0,done:false});lineRefs.current={};setView("lyrics");songPanelRef.current?.scrollTo({top:0})},[song?.id]);
  useEffect(()=>{if(view!=="lyrics")songPanelRef.current?.scrollTo({top:0})},[view]);
  useEffect(()=>{const a=audioRef.current;if(a)a.playbackRate=speed},[speed,song?.id]);
  useEffect(()=>{const a=audioRef.current;if(!a)return;const onTime=()=>setTime(a.currentTime||0);const onMeta=()=>setDur(a.duration||0);const onPlay=()=>setPlaying(true);const onPause=()=>setPlaying(false);const onEnd=()=>{setPlaying(false);if(song&&!rewarded.current[song.id]){rewarded.current[song.id]=true;onXp?.(10)}};a.addEventListener("timeupdate",onTime);a.addEventListener("loadedmetadata",onMeta);a.addEventListener("play",onPlay);a.addEventListener("pause",onPause);a.addEventListener("ended",onEnd);return()=>{a.pause();a.removeEventListener("timeupdate",onTime);a.removeEventListener("loadedmetadata",onMeta);a.removeEventListener("play",onPlay);a.removeEventListener("pause",onPause);a.removeEventListener("ended",onEnd)}},[song?.id]);
  useEffect(()=>{if(view==="lyrics"&&activeLine>=0)scrollChildIntoPanel(songPanelRef.current,lineRefs.current[activeLine],{align:.42})},[activeLine,view,showZh,song?.id]);
  if(!song)return(<div><Hdr t="🎵 英文歌曲" onBack={onBack} cl={c.cl}/><div style={{...S.card,padding:"28px 18px",textAlign:"center"}}><div style={{fontSize:42,marginBottom:8}}>🎧</div><div style={{fontSize:16,fontWeight:700,color:S.t1}}>這個年級的歌曲準備中</div><div style={{fontSize:13,color:S.t2,marginTop:6}}>先從小學歌曲開始驗證流程，之後可逐步加入更多歌曲。</div></div></div>);
  const fmt=s=>`${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,"0")}`;
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
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}><div style={{width:58,height:58,borderRadius:14,background:`linear-gradient(135deg,${c.cl},${c.ac})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,color:"#fff",flexShrink:0}}>🎵</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:21,fontWeight:900,color:S.t1,lineHeight:1.2}}>{song.title}</div><div style={{fontSize:12,color:S.t2,marginTop:3}}>{song.zhTitle} · {song.theme} · {song.level}</div></div></div>
      {hasAudio?<><audio ref={audioRef} src={song.audio} preload="metadata"/>
      <div style={{padding:"12px",borderRadius:14,background:S.bg1,border:`1px solid ${S.bd}`,marginBottom:10}}><div style={{fontSize:11,fontWeight:800,color:c.cl,marginBottom:5}}>現在播放</div><div style={{fontSize:16,fontWeight:900,color:S.t1,lineHeight:1.45,minHeight:24}}>{activeLyric?.en||"點播放開始，或點任一句歌詞重播。"}</div>{showZh&&activeLyric?.zh&&<div style={{fontSize:12,color:S.t2,lineHeight:1.5,marginTop:2}}>{activeLyric.zh}</div>}<div style={{height:4,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:9}}><div style={{height:"100%",width:`${linePct}%`,background:c.cl,borderRadius:999}}/></div></div>
      <div onClick={e=>{const r=e.currentTarget.getBoundingClientRect();seekTo((e.clientX-r.left)/Math.max(1,r.width)*(dur||0),false)}} style={{height:10,background:S.bg2,borderRadius:999,overflow:"hidden",cursor:"pointer",marginBottom:8}}><div style={{height:"100%",width:`${dur?Math.min(100,time/dur*100):0}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:999}}/></div>
      <div style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:S.t3,marginBottom:10}}><span>{fmt(time)}</span><span style={{flex:1,textAlign:"center"}}>{playing?"播放中":"已暫停"}</span><span>{fmt(dur||0)}</span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:8}}><button onClick={()=>jumpLine(-1)} style={{...S.btn,padding:"9px 0",fontSize:12,background:S.bg2,color:S.t1}}>上一句</button><button onClick={()=>seekTo(time-5)} style={{...S.btn,padding:"9px 0",fontSize:12,background:S.bg2,color:S.t1}}>-5秒</button><button onClick={toggle} style={{...S.btn,padding:"9px 0",fontSize:13,background:c.cl,color:"#fff"}}>{playing?"暫停":"播放"}</button><button onClick={()=>seekTo(time+5)} style={{...S.btn,padding:"9px 0",fontSize:12,background:S.bg2,color:S.t1}}>+5秒</button><button onClick={()=>jumpLine(1)} style={{...S.btn,padding:"9px 0",fontSize:12,background:S.bg2,color:S.t1}}>下一句</button></div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{[.85,1,1.15].map(v=><button key={v} onClick={()=>setSpeed(v)} style={{border:`1px solid ${speed===v?c.cl:S.bd}`,background:speed===v?c.bg:S.bg1,color:speed===v?c.cl:S.t2,borderRadius:999,padding:"6px 10px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{v===.85?"慢聽":v===1?"原速":"快聽"} {v}x</button>)}<button onClick={()=>activeLyric&&seekLine(activeLyric,true)} disabled={!activeLyric} style={{border:`1px solid ${S.bd}`,background:S.bg1,color:S.t2,borderRadius:999,padding:"6px 10px",fontSize:12,fontWeight:800,cursor:activeLyric?"pointer":"default",fontFamily:"inherit",opacity:activeLyric?1:.5}}>重播本句</button></div>
      </>:<div style={{padding:"11px 12px",border:`1px dashed ${c.cl}66`,borderRadius:12,background:S.bg1,fontSize:12,color:S.t2,lineHeight:1.6}}>音檔準備中。可以先閱讀歌詞與重點單字，產出 mp3 後再補上同步時間。</div>}
    </div>
    <div style={{display:"flex",gap:6,marginBottom:10}}><button onClick={()=>setView("lyrics")} style={tabStyle("lyrics")}>歌詞同步</button><button onClick={()=>setView("practice")} style={tabStyle("practice")}>歌詞填空</button></div>
    <div ref={songPanelRef} style={{height:"clamp(340px, calc(100vh - 430px), 680px)",minHeight:0,overflowY:"auto",overscrollBehavior:"contain",scrollBehavior:"smooth",padding:"0 4px 12px",border:`1px solid ${S.bd}`,borderRadius:12,background:"rgba(255,255,255,.42)"}}>
    {view==="lyrics"?<div style={{...S.card,padding:"14px 12px",marginBottom:10}}>
      {song.lines.map((line,i)=>line.sec?<div key={i} style={{fontSize:12,fontWeight:900,color:c.cl,margin:"16px 4px 7px",letterSpacing:0}}>{line.sec}</div>:<div ref={el=>{if(el)lineRefs.current[i]=el}} key={i} onClick={()=>hasAudio&&seekLine({...line,i},true)} style={{padding:"11px 12px",borderRadius:12,background:activeLine===i?c.bg:S.bg2,border:`1px solid ${activeLine===i?c.cl:S.bd}`,marginBottom:7,cursor:hasAudio?"pointer":"default",transition:"all .15s",boxShadow:activeLine===i?"0 8px 20px rgba(15,110,86,.12)":"none"}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-start"}}><div style={{fontSize:11,color:activeLine===i?c.cl:S.t3,fontWeight:800,minWidth:34,paddingTop:3}}>{Number.isFinite(Number(line.t))?fmt(line.t):""}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,lineHeight:1.5,fontWeight:activeLine===i?900:700,color:S.t1}}>{line.en}</div>{showZh&&<div style={{fontSize:12,color:S.t2,marginTop:3,lineHeight:1.5}}>{line.zh}</div>}</div><button onClick={e=>{e.stopPropagation();seekLine({...line,i},true)}} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:999,padding:"5px 8px",fontSize:11,color:c.cl,cursor:"pointer",fontFamily:"inherit",fontWeight:800,flexShrink:0}}>重播</button></div>
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
function AIT({lv,onBack,apiKey,onSetKey}){
  const c=LV[lv];const RATES=[{l:"慢速",i:"🐢",v:0.6},{l:"正常",i:"🎯",v:0.85},{l:"快速",i:"🐇",v:1.15}];
  const initialMsg=useMemo(()=>({role:"a",content:`哈囉！我是你的 AI 英語家教。\n\n我可以陪你練 **vocabulary**、**grammar**、**translation** 和英文造句。\n\n你可以直接問問題，也可以點下面的練習按鈕開始。`}),[]);
  const[msgs,setMsgs]=useState(()=>[initialMsg]);
  const[inp,setInp]=useState("");const[busy,setBusy]=useState(false);const[showKey,setShowKey]=useState(!apiKey);const[keyInp,setKeyInp]=useState(apiKey);const[ri,setRi]=useState(1);const[pi,setPi]=useState(-1);const[pt,setPt]=useState(0);const[copied,setCopied]=useState(-1);const btm=useRef(null);const reqRef=useRef(null);const speakPollRef=useRef(null);
  useEffect(()=>{btm.current?.scrollIntoView({behavior:"smooth"})},[msgs,busy]);
  useEffect(()=>{setKeyInp(apiKey)},[apiKey]);
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
    if(!apiKey?.trim()){setShowKey(true);return}
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
  return(<div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 110px)"}}>
    <Hdr t="AI 英語家教" onBack={onBack} cl={c.cl} extra={<div style={{display:"flex",gap:4,alignItems:"center"}}><button onClick={()=>setRi(r=>(r+1)%3)} title="調整朗讀速度" style={{background:S.bg1,border:`1px solid ${S.bd}`,borderRadius:8,padding:"5px 8px",fontSize:12,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>{RATES[ri].i}{RATES[ri].l}</button><button onClick={resetChat} title="清空對話" style={{background:S.bg1,border:`1px solid ${S.bd}`,borderRadius:8,padding:"5px 8px",fontSize:12,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>清空</button><button onClick={()=>setShowKey(!showKey)} title="設定 API Key" style={{background:S.bg1,border:`1px solid ${S.bd}`,borderRadius:8,padding:"5px 8px",fontSize:12,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>{apiKey?"🔑":"⚙️"}</button></div>}/>
    {showKey&&<div style={{...S.card,padding:"12px 14px",marginBottom:8,fontSize:12,boxShadow:"0 8px 22px rgba(15,110,86,.06)"}}><div style={{fontWeight:700,color:S.t1,marginBottom:4}}>Gemini API Key</div><div style={{color:S.t2,marginBottom:8,lineHeight:1.6}}>到 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style={{color:c.cl,fontWeight:700}}>Google AI Studio</a> 建立 API Key，貼上後會儲存在本機瀏覽器。</div><div style={{display:"flex",gap:6}}><input value={keyInp} onChange={e=>setKeyInp(e.target.value)} placeholder="API Key..." type="password" style={{flex:1,padding:"9px 10px",borderRadius:8,border:`1px solid ${S.bd}`,fontSize:12,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",minWidth:0}}/><button onClick={()=>{const k=keyInp.trim();onSetKey(k);setShowKey(!k)}} style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 14px",fontSize:12}}>儲存</button></div></div>}
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:9,padding:"2px 0 6px"}}>
      {msgs.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:m.role==="u"?"flex-end":"flex-start",gap:6,alignItems:"flex-start"}}><div style={{maxWidth:"86%",padding:"10px 12px",borderRadius:m.role==="u"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.role==="u"?c.cl:S.bg1,color:m.role==="u"?"#fff":S.t1,border:m.role==="u"?"none":`1px solid ${S.bd}`,fontSize:13,lineHeight:1.75,whiteSpace:"pre-wrap",boxShadow:m.role==="u"?"none":"0 6px 18px rgba(0,0,0,.04)"}}>{m.role==="u"?m.content:<><Md text={m.content} color={c.cl}/><div style={{display:"flex",gap:5,marginTop:8,justifyContent:"flex-end"}}><button onClick={()=>doSpeak(m.content,i)} style={{border:`1px solid ${S.bd}`,background:pi===i?c.bg:S.bg2,color:pi===i?c.cl:S.t2,borderRadius:999,padding:"4px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{pi===i?"停止":"朗讀"}</button><button onClick={()=>copyMsg(m.content,i)} style={{border:`1px solid ${S.bd}`,background:S.bg2,color:S.t2,borderRadius:999,padding:"4px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{copied===i?"已複製":"複製"}</button></div></>}</div></div>))}
      {busy&&<div style={{padding:"10px 12px",borderRadius:14,background:S.bg1,border:`1px solid ${S.bd}`,fontSize:12,color:S.t2,alignSelf:"flex-start",display:"flex",alignItems:"center",gap:8}}><span style={{animation:"pulse 1.2s ease-in-out infinite"}}>AI 家教思考中...</span><button onClick={cancelSend} style={{border:`1px solid ${S.bd}`,background:S.bg2,color:S.t2,borderRadius:999,padding:"4px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>停止</button></div>}
      <div ref={btm}/>
    </div>
    <div style={{flexShrink:0,padding:"4px 0 0",borderTop:`1px solid ${S.bd}`}}><div style={{display:"flex",gap:4,marginBottom:5,paddingTop:6}}>{promptGroups.map((g,i)=>(<button key={i} onClick={()=>setPt(i)} style={{padding:"5px 10px",borderRadius:999,background:pt===i?c.cl:S.bg2,color:pt===i?"#fff":S.t2,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{g.l}</button>))}</div><div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:5}}>{promptGroups[pt].items.map((p,i)=>(<button key={i} onClick={()=>send(p.prompt)} disabled={busy} style={{flexShrink:0,padding:"6px 10px",borderRadius:999,background:S.bg2,border:`1px solid ${S.bd}`,fontSize:12,cursor:busy?"default":"pointer",color:S.t2,fontFamily:"inherit",opacity:busy?0.55:1}}>{p.label}</button>))}</div></div>
    <div style={{display:"flex",gap:6,padding:"4px 0 1px",flexShrink:0,alignItems:"flex-end"}}><textarea value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} rows={1} placeholder={apiKey?"輸入英文問題、句子或想練習的主題...":"先設定 API Key ↑"} style={{flex:1,padding:"10px 11px",borderRadius:12,border:`1px solid ${S.bd}`,fontSize:13,outline:"none",fontFamily:"inherit",background:S.bg1,color:S.t1,resize:"none",minHeight:42,maxHeight:100,lineHeight:1.5,boxSizing:"border-box"}}/><button onClick={()=>send()} disabled={busy||!inp.trim()} style={{...S.btn,background:c.cl,color:"#fff",padding:"11px 16px",opacity:(busy||!inp.trim())?0.5:1,fontSize:13,borderRadius:12}}>發送</button></div>
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

  return(<div><Hdr t={`📖 ${story.zh_title}`} onBack={()=>{stopPlay();onExit()}} cl={c.cl} extra={<button onClick={playAllStory} disabled={playing&&!playingAll} style={{background:playingAll?c.cl:"none",border:`1px solid ${c.cl}`,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:playing&&!playingAll?"default":"pointer",color:playingAll?"#fff":c.cl,opacity:playing&&!playingAll?.4:1}}>{playingAll?"📖 朗讀中...":"🎙️ 整本朗讀"}</button>}/>
    {/* Progress dots */}
    <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:12}}>
      {story.pages.map((_,i)=>(<div key={i} style={{width:24,height:4,background:i<=pageIdx?c.cl:S.bg2,borderRadius:2,transition:"background .3s"}}/>))}
    </div>

    {/* Story card */}
    <div style={{...S.card,padding:"20px 18px",marginBottom:12,minHeight:280,background:`linear-gradient(135deg,${c.bg}66,var(--color-background-primary,#fff))`,border:`2px solid ${c.cl}33`,position:"relative"}}>
      {/* Playing indicator */}
      {playing&&<div style={{position:"absolute",top:10,right:10,background:c.cl,color:"#fff",borderRadius:10,padding:"3px 8px",fontSize:10,fontWeight:700,animation:"emojiPulse 1s infinite"}}>🎙️ 朗讀中</div>}

      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
        <PixelPet petId={selectedPet.petId} stage={getPetStage(selectedPet)} size={96} animate={playing}/>
      </div>

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

    <div style={{textAlign:"center",fontSize:11,color:S.t3,marginTop:8}}>第 {pageIdx+1} 頁 / 共 {story.pages.length} 頁</div>
  </div>);
}

// ═══ AI STORY MODE (AI 故事模式 - 用你的寵物做主角) ═══════════════════
function StoryMode({lv,onBack,apiKey,onSetKey,pets,c,onXp,trackWeak}){
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

  const lvDesc={elem:"elementary school (A1)",junior:"junior high school (A2-B1)",senior:"senior high school (B1-B2)"};

  const genStory=async()=>{
    if(!apiKey){setShowApiKeyInput(true);return}
    if(!selectedPet){setError("請先擁有一隻寵物！去扭蛋機抽一隻吧");return}
    setStep("loading");setError("");
    const petName=PETS[selectedPet.rarity].find(p=>p.id===selectedPet.petId)?.name||"寵物";
    const themeObj=themes.find(t=>t.id===theme);
    const prompt=`Create an engaging short English story for a Taiwanese ${lvDesc[lv]||"elementary"} student.

Main character: A pet named "${petName}" (${selectedPet.petId})
Theme: ${themeObj.name} (${themeObj.desc})
Story length: 4 pages, each page is 2-3 short simple sentences
Level: Simple vocabulary suitable for the student's level

After the story, create 3 comprehension questions (multiple choice, 4 options each).

Return STRICT JSON only (no markdown, no explanations):
{
  "title": "Story Title in English",
  "zh_title": "中文標題",
  "pages": [
    {"en": "English text", "zh": "中文翻譯", "keywords": ["key_word1", "key_word2"]},
    {"en": "...", "zh": "...", "keywords": [...]},
    {"en": "...", "zh": "...", "keywords": [...]},
    {"en": "...", "zh": "...", "keywords": [...]}
  ],
  "questions": [
    {"q": "Question in English", "choices": ["A", "B", "C", "D"], "correct": 0, "explain": "中文解釋"},
    {"q": "...", "choices": [...], "correct": 0, "explain": "..."},
    {"q": "...", "choices": [...], "correct": 0, "explain": "..."}
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
                generationConfig:{maxOutputTokens:2500,temperature:0.9},
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

  const saveKey=(k)=>{onSetKey(k);setShowApiKeyInput(false)};

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
    const[tmpKey,setTmpKey]=[null,null];// inline
    return(<div><Hdr t="🔑 設定 Gemini API" onBack={()=>setShowApiKeyInput(false)} cl={c.cl}/>
      <div style={{...S.card,padding:"20px"}}>
        <div style={{fontSize:13,color:S.t2,lineHeight:1.7,marginBottom:14}}>
          故事模式需要 Google Gemini API Key（免費申請）。<br/>
          請到 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style={{color:c.cl}}>Google AI Studio</a> 免費取得 API Key，貼到下方：
        </div>
        <input type="password" placeholder="貼上你的 API Key..." defaultValue={apiKey} onChange={e=>onSetKey(e.target.value)} style={{width:"100%",padding:"12px",fontSize:14,border:`2px solid ${S.bd}`,borderRadius:10,fontFamily:"monospace",boxSizing:"border-box",background:S.bg1,color:S.t1}}/>
        <button onClick={()=>{setShowApiKeyInput(false);if(apiKey)genStory()}} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:14,marginTop:12}}>✓ 儲存並開始故事</button>
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
        <div style={{fontSize:12,color:S.t2,marginTop:4,lineHeight:1.6}}>選一隻寵物 + 主題 → AI 會為你生成 4 頁小故事 + 3 題測驗</div>
      </div>

      {/* Pet selector */}
      <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:600,color:S.t1,marginBottom:10}}>🐾 選主角</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
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
        {apiKey?"✓ API Key 已設定":<button onClick={()=>setShowApiKeyInput(true)} style={{background:"none",border:"none",color:c.cl,fontSize:11,textDecoration:"underline",cursor:"pointer"}}>設定 API Key</button>}
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
function GachaCeremony({rarity,mode}){
  // 不同稀有度的視覺差異
  const config={
    N: {beam:"rgba(255,255,255,0.7)", beamW:80, eggBg:"linear-gradient(135deg,#FFF8DC,#F5DEB3)", glow:"rgba(255,255,255,0.4)", shake:"gc_eggShake_n", orbColors:[]},
    R: {beam:"rgba(74,144,226,0.9)", beamW:100, eggBg:"linear-gradient(135deg,#E6F1FB,#C5DBEC)", glow:"rgba(74,144,226,0.6)", shake:"gc_eggShake_r", orbColors:["#4A90E2","#4A90E2","#6BA4E5"]},
    SR: {beam:"rgba(123,97,255,0.95)", beamW:120, eggBg:"linear-gradient(135deg,#EDE9FE,#C4B5FD)", glow:"rgba(123,97,255,0.7)", shake:"gc_eggShake_sr", orbColors:["#7B61FF","#9F8FFF","#7B61FF","#9F8FFF","#A78BFA"]},
    SSR:{beam:"rgba(255,215,0,1)", beamW:160, eggBg:"linear-gradient(135deg,#FFF3CD,#FFD700)", glow:"rgba(255,215,0,0.9)", shake:"gc_eggShake_ssr", orbColors:["#FFD700","#FFA500","#FFD700","#FFEC8B","#FFD700","#FFA500"]},
  }[rarity||"N"];
  const isSSR=rarity==="SSR";

  const styleSheet=`
@keyframes gc_eggDrop { 0%{transform:translate(-50%,-180px) scale(0.3);opacity:0} 60%{transform:translate(-50%,40px) scale(1.15);opacity:1} 80%{transform:translate(-50%,30px) scale(0.95)} 100%{transform:translate(-50%,40px) scale(1);opacity:1} }
@keyframes gc_eggShake_n { 0%,100%{transform:translate(-50%,40px) rotate(0deg)} 25%{transform:translate(-51%,40px) rotate(-2deg)} 75%{transform:translate(-49%,40px) rotate(2deg)} }
@keyframes gc_eggShake_r { 0%,100%{transform:translate(-50%,40px) rotate(0deg)} 25%{transform:translate(-52%,40px) rotate(-4deg)} 75%{transform:translate(-48%,40px) rotate(4deg)} }
@keyframes gc_eggShake_sr { 0%,100%{transform:translate(-50%,40px) rotate(0deg)} 25%{transform:translate(-53%,38px) rotate(-7deg)} 75%{transform:translate(-47%,38px) rotate(7deg)} }
@keyframes gc_eggShake_ssr { 0%,100%{transform:translate(-50%,40px) rotate(0deg)} 20%{transform:translate(-54%,36px) rotate(-12deg)} 60%{transform:translate(-46%,36px) rotate(12deg)} 80%{transform:translate(-50%,32px) rotate(0deg)} }
@keyframes gc_lightBeam { 0%{opacity:0;height:0} 30%{opacity:0.85;height:280px} 90%{opacity:0.85;height:280px} 100%{opacity:0;height:300px} }
@keyframes gc_screenFlash { 0%,100%{opacity:0} 50%{opacity:0.5} }
@keyframes gc_orb { 0%{transform:translate(0,0) scale(0);opacity:0} 30%{opacity:1;transform:translate(0,0) scale(1)} 100%{transform:translate(var(--gx),var(--gy)) scale(0.3);opacity:0} }
@keyframes gc_label { 0%{transform:translate(-50%,-20px);opacity:0} 30%,100%{transform:translate(-50%,0);opacity:1} }
@media (prefers-reduced-motion: reduce) { [data-gacha-ceremony] *{animation-duration:0.3s !important} }
`;

  const labelTxt=mode==="multi"?"十連抽中...":"抽獎中...";
  const rarityLabel=rarity?{N:"普通",R:"稀有",SR:"超稀有",SSR:"傳說 ✨"}[rarity]:"";

  // 為 SR/SSR 產生光點四散位置
  const orbs=config.orbColors.map((color,i)=>{
    const angle=(i*360/config.orbColors.length)+(i%2?15:-15);
    const distance=isSSR?160+Math.random()*40:120+Math.random()*30;
    return{
      color,
      gx:`${Math.cos(angle*Math.PI/180)*distance}px`,
      gy:`-${Math.abs(Math.sin(angle*Math.PI/180)*distance)+80}px`,
      delay:0.5+i*0.12,
      size:isSSR?10+Math.random()*4:6+Math.random()*4,
    };
  });

  return(<div data-gacha-ceremony style={{
    position:"relative",
    height:340,
    background:isSSR?"linear-gradient(180deg,#3d2817,#1a0f08)":"linear-gradient(180deg,#1a1a2e,#0a0a1f)",
    borderRadius:14,
    overflow:"hidden",
    marginBottom:12,
    boxShadow:`inset 0 0 40px ${config.glow}`,
  }}>
    <style>{styleSheet}</style>

    {/* SSR 全屏閃光 */}
    {isSSR&&<div style={{position:"absolute",inset:0,background:"#FFD700",animation:"gc_screenFlash 1.8s ease-in-out forwards",zIndex:1}}/>}

    {/* 標題標籤 */}
    <div style={{
      position:"absolute",top:16,left:"50%",
      animation:"gc_label 0.5s ease-out forwards",
      fontSize:13,fontWeight:700,
      color:isSSR?"#FFD700":(rarity==="SR"?"#C8B6FF":(rarity==="R"?"#87CEEB":"#fff")),
      background:isSSR?"rgba(255,215,0,0.15)":"rgba(0,0,0,0.4)",
      padding:"4px 14px",borderRadius:14,
      letterSpacing:1.5,zIndex:8,
      boxShadow:isSSR?"0 0 20px rgba(255,215,0,0.6)":"none",
    }}>{rarityLabel||labelTxt}</div>

    {/* 光柱（背景） */}
    <div style={{
      position:"absolute",bottom:60,left:"50%",
      width:config.beamW,
      transform:"translateX(-50%)",
      borderRadius:`${config.beamW/2}px ${config.beamW/2}px 0 0`,
      background:`linear-gradient(180deg,${config.beam},transparent)`,
      animation:"gc_lightBeam 1.5s 0.5s ease-in-out forwards",
      mixBlendMode:"screen",
      zIndex:2,
      filter:isSSR?"blur(2px)":"none",
    }}/>

    {/* SSR 內層更亮的白光柱 */}
    {isSSR&&<div style={{
      position:"absolute",bottom:60,left:"50%",
      width:60,
      transform:"translateX(-50%)",
      borderRadius:"30px 30px 0 0",
      background:"linear-gradient(180deg,rgba(255,255,255,0.95),transparent)",
      animation:"gc_lightBeam 1.5s 0.5s ease-in-out forwards",
      mixBlendMode:"screen",
      zIndex:3,
    }}/>}

    {/* 四散的光點（R/SR/SSR 才有） */}
    {orbs.map((orb,i)=>(<div key={i} style={{
      position:"absolute",bottom:140,left:"50%",
      width:orb.size,height:orb.size,borderRadius:"50%",
      background:orb.color,
      boxShadow:`0 0 ${orb.size*1.5}px ${orb.color}`,
      "--gx":orb.gx,"--gy":orb.gy,
      animation:`gc_orb 1.3s ${orb.delay}s ease-out forwards`,
      zIndex:4,
    }}/>))}

    {/* 蛋本體 */}
    <div style={{
      position:"absolute",top:0,left:"50%",
      width:80,height:100,
      borderRadius:"50% 50% 50% 50% / 60% 60% 40% 40%",
      background:config.eggBg,
      boxShadow:`inset -8px -8px 16px rgba(0,0,0,0.2), 0 0 ${isSSR?50:30}px ${config.glow}`,
      animation:`gc_eggDrop 0.8s ease-out forwards, ${config.shake} 0.15s ease-in-out 0.8s infinite`,
      zIndex:5,
    }}/>

    {/* 蛋上的小裝飾紋路 */}
    <div style={{
      position:"absolute",top:30,left:"50%",
      transform:"translateX(-50%)",
      width:30,height:8,
      borderRadius:"50%",
      background:"rgba(255,255,255,0.5)",
      animation:`gc_eggDrop 0.8s ease-out forwards, ${config.shake} 0.15s ease-in-out 0.8s infinite`,
      zIndex:6,
      pointerEvents:"none",
    }}/>
  </div>);
}

// ═══ GACHA MACHINE (扭蛋機) ═══════════════════════════════════════
function PetAdventurePage({lv,onBack,c,pets,setPets,eggs,setEggs,coins,setCoins,inventory,setInventory}){
  const[selectedIds,setSelectedIds]=useState([]);
  const[run,setRun]=useState(null);
  const[battle,setBattle]=useState(null);
  const[feedback,setFeedback]=useState(null);
  const[outcome,setOutcome]=useState(null);
  const[skillLoadout,setSkillLoadout]=useState({});
  const[battleSkillId,setBattleSkillId]=useState(null);
  const[adventureProgress,setAdventureProgress]=useState(()=>getPetAdventureProgress(lv));
  const[prepNotice,setPrepNotice]=useState(null);
  const bgmRef=useRef(null);
  const[battleAudioOn,setBattleAudioOn]=useState(()=>{try{return localStorage.getItem("englishgo_pet_adventure_audio")!=="off"}catch{return true}});
  const stopBattleBgm=useCallback(()=>{
    bgmRef.current?.stop?.();
    bgmRef.current=null;
  },[]);
  const startBattleBgm=useCallback((boss=false,difficulty=1)=>{
    stopBattleBgm();
    if(!battleAudioOn)return;
    bgmRef.current=createPetAdventureBgm({boss,difficulty});
  },[battleAudioOn,stopBattleBgm]);
  useEffect(()=>setAdventureProgress(getPetAdventureProgress(lv)),[lv]);
  useEffect(()=>{
    try{localStorage.setItem("englishgo_pet_adventure_audio",battleAudioOn?"on":"off")}catch{}
    if(!battleAudioOn)stopBattleBgm();
  },[battleAudioOn,stopBattleBgm]);
  useEffect(()=>()=>stopBattleBgm(),[stopBattleBgm]);
  useEffect(()=>{
    if(!run||!battle||!battleAudioOn)return;
    const stage=run.stages[battle.stageIndex];
    const boss=!!stage?.boss;
    if(bgmRef.current?.boss!==boss)startBattleBgm(boss,run.difficultyLevel||1);
  },[run,battle?.stageIndex,battleAudioOn,startBattleBgm]);
  const availablePets=useMemo(()=>pets.map(p=>({pet:p,def:getAdventurePetDef(p),power:getPetAdventurePower(p),skill:getPetAdventureSkill(p)})).filter(x=>x.def),[pets]);
  const selectedPets=availablePets.filter(x=>selectedIds.includes(x.pet.petId)).map(x=>x.pet);
  const teamPower=selectedPets.reduce((sum,p)=>sum+getPetAdventurePower(p),0);
  const teamMoralePreview=getTeamAdventureMorale(selectedPets);
  const teamPrepPlan=useMemo(()=>{
    const inv={...inventory};
    let feed=0,clean=0,rest=0,needsFood=0;
    selectedPets.forEach(p=>{
      const food=choosePetFoodForNeed(p,inv);
      if((p.hunger??80)<80){
        if(food){inv[food.id]=Math.max(0,(inv[food.id]||0)-1);feed++}
        else needsFood++;
      }
      if((p.poops||[]).length>0||(p.clean??80)<75)clean++;
      if((p.energy??80)<65)rest++;
    });
    return{feed,clean,rest,needsFood,total:feed+clean+rest};
  },[selectedPets,inventory]);
  const bestTeamIds=useMemo(()=>[...availablePets].sort((a,b)=>getPetAdventureScore(b.pet)-getPetAdventureScore(a.pet)).slice(0,3).map(x=>x.pet.petId),[availablePets]);
  const lowCareCount=selectedPets.filter(p=>(((p.hunger??80)+(p.clean??80)+(p.energy??80))/3)<55).length;
  const bossReady=isPetAdventureBossReady(adventureProgress);
  const difficultyLevel=getPetAdventureDifficulty(adventureProgress,bossReady);
  const clearsToBoss=Math.max(0,PET_ADVENTURE_BOSS_REQUIRED_CLEARS-(adventureProgress.bossCharge||0));
  const togglePet=(petId)=>{
    setOutcome(null);
    setPrepNotice(null);
    setSelectedIds(ids=>{
      if(ids.includes(petId))return ids.filter(id=>id!==petId);
      if(ids.length>=3)return ids;
      return [...ids,petId];
    });
  };
  const prepareSelectedTeam=()=>{
    if(!selectedPets.length)return;
    const inv={...inventory};
    const selected=new Set(selectedIds);
    const now=new Date().toISOString();
    let fed=0,cleaned=0,rested=0,needsFood=0,changed=0;
    const nextPets=pets.map(p=>{
      if(!selected.has(p.petId))return p;
      let updated={...p};
      let touched=false;
      const food=choosePetFoodForNeed(updated,inv);
      if((updated.hunger??80)<80){
        if(food){
          inv[food.id]=Math.max(0,(inv[food.id]||0)-1);
          updated.hunger=Math.min(MAX_STAT,(updated.hunger??80)+food.feed);
          updated.bond=(updated.bond||0)+1;
          fed++;
          touched=true;
        }else needsFood++;
      }
      if((updated.poops||[]).length>0||(updated.clean??80)<75){
        updated.poops=[];
        updated.clean=MAX_STAT;
        updated.bond=(updated.bond||0)+2;
        cleaned++;
        touched=true;
      }
      if((updated.energy??80)<65){
        updated.energy=MAX_STAT;
        rested++;
        touched=true;
      }
      if(!touched)return p;
      changed++;
      return{...updated,lastUpdate:now};
    });
    if(changed){
      setPets(nextPets);
      setInventory(inv);
      playSound?.("combo");
      setPrepNotice({ok:true,text:`整備完成：餵食 ${fed}、清潔 ${cleaned}、休息 ${rested}${needsFood?`；${needsFood} 隻仍缺食物`:""}`});
    }else{
      playSound?.("good");
      setPrepNotice({ok:needsFood===0,text:needsFood?`${needsFood} 隻寵物需要食物，食物庫存不足。`:"隊伍狀態良好，可以出戰。"});
    }
  };
  const startAdventure=()=>{
    const team=availablePets.filter(x=>selectedIds.includes(x.pet.petId)).map(x=>x.pet);
    if(!team.length)return;
    const progress=getPetAdventureProgress(lv);
    const ready=isPetAdventureBossReady(progress);
    const difficulty=getPetAdventureDifficulty(progress,ready);
    const stages=buildPetAdventureStages(team,lv,{bossReady:ready,difficultyLevel:difficulty});
    const power=team.reduce((sum,p)=>sum+getPetAdventurePower(p),0);
    const morale=getTeamAdventureMorale(team);
    const maxTeamHp=Math.round((150+power*.85)*morale.hpMult);
    const loadout=Object.fromEntries(team.map(p=>[p.petId,getSelectedPetAdventureSkill(p,skillLoadout).id]));
    setRun({stages,teamIds:selectedIds,teamPower:power,skillLoadout:loadout,hasBoss:ready,difficultyLevel:difficulty,progress,morale});
    setBattle({stageIndex:0,questionIndex:0,teamHp:maxTeamHp,maxTeamHp,enemyHp:stages[0].maxHp,answered:0,correct:0,miss:0});
    setFeedback(null);
    setOutcome(null);
    setBattleSkillId(null);
    startBattleBgm(!!stages[0]?.boss,difficulty);
    playSound?.("flip");
  };
  const finishAdventure=(won,finalHp)=>{
    stopBattleBgm();
    const hadBoss=!!run?.hasBoss;
    const runDifficulty=run?.difficultyLevel||difficultyLevel||1;
    const bossWin=won&&hadBoss;
    const rewardMult=won?(run?.morale?.rewardMult||1):1;
    const baseCoins=won?(bossWin?260+runDifficulty*45+selectedIds.length*25:90+runDifficulty*18+selectedIds.length*12):18;
    const baseExp=won?(bossWin?170:105):25;
    const rewardFood=PET_FOODS[Math.floor(Math.random()*PET_FOODS.length)];
    const bonusFood=bossWin?PET_FOODS.filter(f=>f.id!==rewardFood.id)[Math.floor(Math.random()*Math.max(1,PET_FOODS.length-1))]:null;
    const unlockedSkill=won&&!bossWin&&Math.random()<0.35?Object.values(PET_ADVENTURE_SKILLS)[Math.floor(Math.random()*Object.values(PET_ADVENTURE_SKILLS).length)]:null;
    const fatigue=getPetAdventureFatigue({won,bossWin});
    const skillReceiver=won&&unlockedSkill?pets.find(p=>selectedIds.includes(p.petId)&&!(p.skills||[]).includes(unlockedSkill.id)):null;
    const reward={
      won,
      bossWin,
      difficultyLevel:runDifficulty,
      coins:Math.round(baseCoins*rewardMult),
      food:rewardFood,
      foodCount:won?(bossWin?6+Math.min(4,Math.floor(runDifficulty/2)):3):1,
      bonusFood,
      bonusFoodCount:bossWin?3+Math.min(3,Math.floor(runDifficulty/3)):0,
      exp:Math.round(baseExp*rewardMult),
      bond:won?(bossWin?32:18):4,
      skill:unlockedSkill,
      skillReceiverName:skillReceiver?(getAdventurePetDef(skillReceiver)?.name||skillReceiver.petId):null,
      fatigue,
      finalHp,
    };
    const updateAdventurePet=p=>improvePetAfterAdventure(p,{
      exp:reward.exp,
      bond:reward.bond,
      skillId:skillReceiver&&p.petId===skillReceiver.petId?unlockedSkill.id:null,
      fatigue,
    });
    reward.growth=pets
      .filter(p=>selectedIds.includes(p.petId))
      .map(p=>{
        const next=updateAdventurePet(p);
        const readiness=getPetReadiness(next);
        return{
          petId:p.petId,
          name:getAdventurePetDef(p)?.name||p.petId,
          fromLevel:p.level||1,
          toLevel:next.level||1,
          exp:reward.exp,
          bond:reward.bond,
          skill:skillReceiver&&p.petId===skillReceiver.petId?unlockedSkill:null,
          readiness,
        };
      });
    setCoins(co=>co+reward.coins);
    setInventory(inv=>{
      const next={...inv,[rewardFood.id]:(inv[rewardFood.id]||0)+reward.foodCount};
      if(bonusFood&&reward.bonusFoodCount)next[bonusFood.id]=(next[bonusFood.id]||0)+reward.bonusFoodCount;
      return next;
    });
    const nextProgress=completePetAdventureProgress(run?.progress||getPetAdventureProgress(lv),won,hadBoss);
    savePetAdventureProgress(lv,nextProgress);
    setAdventureProgress(nextProgress);
    setPets(ps=>ps.map(p=>selectedIds.includes(p.petId)?updateAdventurePet(p):p));
    setOutcome(reward);
    setRun(null);
    setBattle(null);
    setFeedback(null);
    setBattleSkillId(null);
    playSound?.(won?"combo":"good");
  };
  const getBattleSkill=(pet,loadout=run?.skillLoadout,preferredId=battleSkillId)=>{
    const cards=getPetAdventureSkillCards(pet);
    const preferred=cards.find(card=>card.unlocked&&card.skill.id===preferredId);
    return preferred?.skill||getSelectedPetAdventureSkill(pet,loadout||{});
  };
  const getSkillAdvice=(skill,q,turnIndex=0)=>{
    const text=`${q?.q||""} ${q?.zh||""}`;
    if(skill.id==="wordSpark"&&/word|means|單字|意思/i.test(text))return"推薦：這是單字題，傷害提高";
    if(skill.id==="quickStep"&&turnIndex===0)return"推薦：每關第一回合加速攻擊";
    if(skill.id==="melodyHeal")return"穩定：答對後回復隊伍 HP";
    if(skill.id==="braveGuard")return"防守：答錯時降低反擊傷害";
    if(skill.id==="magicLeaf")return"穩定：魔法加傷";
    return"一般技能";
  };
  const isRecommendedSkill=(skill,q,turnIndex=0)=>{
    const text=`${q?.q||""} ${q?.zh||""}`;
    return (skill.id==="wordSpark"&&/word|means|單字|意思/i.test(text))||
      (skill.id==="quickStep"&&turnIndex===0)||
      skill.id==="magicLeaf";
  };
  const answerQuestion=(choiceIndex)=>{
    if(!run||!battle||feedback)return;
    const stage=run.stages[battle.stageIndex];
    const q=stage.questions[battle.questionIndex%stage.questions.length];
    const correct=choiceIndex===q.answer;
    const attacker=selectedPets[(battle.answered||0)%Math.max(1,selectedPets.length)]||selectedPets[0];
    const attackerDef=getAdventurePetDef(attacker);
    const activeSkill=getBattleSkill(attacker,run.skillLoadout,battleSkillId);
    const skillVisual=PET_ADVENTURE_SKILL_VISUALS[activeSkill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
    const skills=selectedPets.map(p=>p.petId===attacker?.petId?activeSkill:getSelectedPetAdventureSkill(p,run.skillLoadout));
    const skillPower=skills.reduce((sum,s)=>sum+(s?.power||0),0);
    const answerSpeech=getAdventureCorrectSpeech(q);
    const answerLine=getAdventureAnswerLine(q);
    if(correct){
      const openingBonus=activeSkill.id==="quickStep"&&battle.questionIndex===0?14:0;
      const wordBonus=activeSkill.id==="wordSpark"&&/word|means|單字|意思/i.test(`${q.q} ${q.zh}`)?12:0;
      const magicBonus=activeSkill.id==="magicLeaf"?8:0;
      const moraleBonus=run.morale?.damageBonus||0;
      const damage=Math.max(12,Math.round(30+run.teamPower*.18+skillPower*.45+activeSkill.power*1.7+openingBonus+wordBonus+magicBonus+moraleBonus+Math.random()*10));
      const heal=skills.some(s=>s?.id==="melodyHeal")?18:10;
      const nextEnemyHp=Math.max(0,battle.enemyHp-damage);
      const nextHp=Math.min(battle.maxTeamHp,battle.teamHp+heal);
      const stageClear=nextEnemyHp<=0;
      const last=battle.stageIndex>=run.stages.length-1;
      setFeedback({
        correct:true,choiceIndex,stageClear,last,damage,heal,tip:q.tip,nextQuestionIndex:battle.questionIndex+1,
        answerSpeech,answerLine,
        attackerId:attacker?.petId,attackerName:attackerDef?.name||attacker?.petId||"Pet",
        skill:activeSkill,skillVisual,
        message:`${attackerDef?.name||"Pet"} used ${activeSkill.name}! ${stage.enemy} took ${damage} damage.`,
        effectKey:Date.now(),
      });
      setBattle(b=>({...b,teamHp:nextHp,enemyHp:nextEnemyHp,answered:b.answered+1,correct:b.correct+1}));
      playPetAdventureSkillSound(activeSkill.id,true);
      window.setTimeout(()=>speak?.(answerSpeech),420);
      if(stageClear&&last){
        window.setTimeout(()=>finishAdventure(true,nextHp),900);
      }
      return;
    }
    const guard=skills.some(s=>s?.id==="braveGuard")?8:0;
    const damage=Math.max(6,stage.attack-guard);
    const nextHp=Math.max(0,battle.teamHp-damage);
    setBattle(b=>({...b,teamHp:nextHp,answered:b.answered+1,miss:b.miss+1}));
    setFeedback({
      correct:false,choiceIndex,stageClear:false,last:false,damage,tip:q.tip,nextQuestionIndex:battle.questionIndex+1,
      answerSpeech,answerLine,
      attackerId:attacker?.petId,attackerName:attackerDef?.name||attacker?.petId||"Pet",
      skill:activeSkill,skillVisual,
      message:`${stage.enemy} counterattacked! Team took ${damage} damage.${guard?" Brave Guard reduced the hit.":""}`,
      effectKey:Date.now(),
    });
    playPetAdventureSkillSound(activeSkill.id,false);
    if(nextHp<=0){
      window.setTimeout(()=>finishAdventure(false,0),900);
    }
  };
  const continueBattle=()=>{
    if(!battle||!feedback)return;
    setBattle(b=>({...b,questionIndex:feedback.nextQuestionIndex||b.questionIndex+1}));
    setFeedback(null);
    setBattleSkillId(null);
  };
  const nextStage=()=>{
    if(!run||!battle)return;
    const nextIndex=battle.stageIndex+1;
    const next=run.stages[nextIndex];
    setBattle(b=>({...b,stageIndex:nextIndex,questionIndex:0,enemyHp:next.maxHp}));
    setFeedback(null);
    setBattleSkillId(null);
    playSound?.("good");
  };
  const resetAdventure=()=>{
    stopBattleBgm();
    setRun(null);setBattle(null);setFeedback(null);setOutcome(null);
    setBattleSkillId(null);
  };
  const hpBar=(value,max,color)=>(
    <div style={{height:10,background:S.bg2,borderRadius:999,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.max(0,Math.min(100,(value/max)*100))}%`,background:color,borderRadius:999,transition:"width .25s"}}/>
    </div>
  );
  if(!availablePets.length){
    return(<div><Hdr t="🗺️ 寵物冒險" onBack={onBack} cl={c.cl}/>
      <div style={{...S.card,padding:"28px 20px",textAlign:"center"}}>
        <div style={{fontSize:46,marginBottom:8}}>🥚</div>
        <div style={{fontSize:20,fontWeight:900,color:S.t1}}>還沒有可出戰的寵物</div>
        <div style={{fontSize:13,color:S.t2,lineHeight:1.7,marginTop:8}}>先到扭蛋機取得寵物，再帶牠們挑戰英文冒險。</div>
      </div>
    </div>);
  }
  if(outcome){
    return(<div><Hdr t="🗺️ 冒險結果" onBack={onBack} cl={c.cl}/>
      <div style={{...S.card,padding:"24px 18px",textAlign:"center",background:`linear-gradient(135deg,${outcome.won?c.bg:"#FFF3CD"},var(--color-background-primary,#fff))`,border:`2px solid ${outcome.won?c.cl:"#EF9F27"}`}}>
        <div style={{fontSize:50,marginBottom:6}}>{outcome.won?"🏆":"🌤️"}</div>
        <div style={{fontSize:24,fontWeight:900,color:S.t1}}>{outcome.won?"冒險勝利！":"這次先撤退"}</div>
        <div style={{fontSize:13,color:S.t2,marginTop:6,lineHeight:1.7}}>{outcome.won?"寵物隊伍完成 3 關英文戰鬥，獲得更多培養資源。":"隊伍仍然獲得練習獎勵，下次可以帶等級更高或照顧狀態更好的寵物。"}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginTop:16,textAlign:"left"}}>
          <div style={{...S.card,padding:"12px",background:S.bg1}}><div style={{fontSize:12,color:S.t3}}>金幣</div><div style={{fontSize:20,fontWeight:900,color:"#EF9F27"}}>+{outcome.coins}</div></div>
          <div style={{...S.card,padding:"12px",background:S.bg1}}><div style={{fontSize:12,color:S.t3}}>道具</div><div style={{fontSize:18,fontWeight:900,color:S.t1}}>{outcome.food.emoji} {outcome.food.name} ×{outcome.foodCount}</div></div>
          {outcome.bonusFood&&<div style={{...S.card,padding:"12px",background:"linear-gradient(135deg,#FFF3CD,var(--color-background-primary,#fff))",border:"2px solid #EF9F27"}}><div style={{fontSize:12,color:S.t3}}>Boss Bonus</div><div style={{fontSize:17,fontWeight:1000,color:"#A05A00"}}>{outcome.bonusFood.emoji} {outcome.bonusFood.name} ×{outcome.bonusFoodCount}</div><div style={{fontSize:11,color:S.t2,marginTop:4}}>魔王獎勵改為金幣與培養道具。</div></div>}
          <div style={{...S.card,padding:"12px",background:S.bg1}}><div style={{fontSize:12,color:S.t3}}>寵物成長</div><div style={{fontSize:18,fontWeight:900,color:c.cl}}>XP +{outcome.exp} · 親密 +{outcome.bond}</div></div>
          {outcome.won&&outcome.skill&&<div style={{...S.card,padding:"12px",background:S.bg1}}><div style={{fontSize:12,color:S.t3}}>可能解鎖技能</div><div style={{fontSize:17,fontWeight:900,color:c.cl}}>{outcome.skill.emoji} {outcome.skill.zh}</div><div style={{fontSize:11,color:S.t2,marginTop:4}}>{outcome.skillReceiverName?`${outcome.skillReceiverName} 已學會。`:"隊伍已會此技能時，保留原有技能。"}</div></div>}
          {outcome.won&&!outcome.bossWin&&<div style={{...S.card,padding:"12px",background:S.bg1}}><div style={{fontSize:12,color:S.t3}}>Boss Progress</div><div style={{fontSize:18,fontWeight:900,color:c.cl}}>{Math.min(PET_ADVENTURE_BOSS_REQUIRED_CLEARS,adventureProgress.bossCharge||0)}/{PET_ADVENTURE_BOSS_REQUIRED_CLEARS}</div><div style={{fontSize:11,color:S.t2,marginTop:4}}>{isPetAdventureBossReady(adventureProgress)?"下一輪會出現魔王。":"繼續完成冒險來累積魔王挑戰。"}</div></div>}
        </div>
        {outcome.growth?.length>0&&<div style={{border:`1px solid ${S.bd}`,borderRadius:14,padding:"12px",marginTop:14,textAlign:"left",background:"rgba(255,255,255,.72)"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
            <div style={{fontSize:16,fontWeight:900,color:S.t1}}>戰後狀態</div>
            <div style={{fontSize:12,fontWeight:800,color:S.t2}}>{outcome.fatigue?.label||"冒險消耗"}：飽食 -{outcome.fatigue?.hunger||0}、清潔 -{outcome.fatigue?.clean||0}、體力 -{outcome.fatigue?.energy||0}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}>
            {outcome.growth.map((g,i)=><div key={`${g.petId}-${i}`} style={{border:`1px solid ${S.bd}`,borderRadius:12,padding:"10px",background:S.bg1}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
                <div style={{fontWeight:900,color:S.t1}}>{g.name}</div>
                <div style={{fontSize:12,fontWeight:900,color:g.readiness.color}}>{g.readiness.emoji} {g.readiness.label}</div>
              </div>
              <div style={{fontSize:12,color:S.t2,marginTop:5}}>Lv.{g.fromLevel}{g.toLevel>g.fromLevel?` → Lv.${g.toLevel}`:""} · XP +{g.exp} · 親密 +{g.bond}</div>
              {g.skill&&<div style={{fontSize:12,color:c.cl,fontWeight:900,marginTop:5}}>新技能：{g.skill.emoji} {g.skill.zh}</div>}
            </div>)}
          </div>
        </div>}
        <div style={{display:"flex",gap:8,marginTop:18}}>
          <button onClick={resetAdventure} style={{...S.btn,background:S.bg2,color:S.t1,flex:1}}>重新組隊</button>
          <button onClick={startAdventure} style={{...S.btn,background:c.cl,color:"#fff",flex:1}}>再冒險</button>
        </div>
      </div>
    </div>);
  }
  if(run&&battle){
    const stage=run.stages[battle.stageIndex];
    const q=stage.questions[battle.questionIndex%stage.questions.length];
    const isBoss=!!stage.boss;
    const activePet=feedback?.attackerId?selectedPets.find(p=>p.petId===feedback.attackerId):(selectedPets[(battle.answered||0)%Math.max(1,selectedPets.length)]||selectedPets[0]);
    const activeDef=getAdventurePetDef(activePet);
    const activeSkill=feedback?.skill||getBattleSkill(activePet,run.skillLoadout,battleSkillId);
    const activeVisual=feedback?.skillVisual||PET_ADVENTURE_SKILL_VISUALS[activeSkill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
    const enemyIcon=PET_ADVENTURE_ENEMY_ICONS[stage.id]||"🌑";
    const activeSkillCards=getPetAdventureSkillCards(activePet);
    const qMeta=getAdventureQuestionMeta(q);
    const questionSpeech=getAdventureQuestionSpeech(q);
    return(<div><Hdr t="🗺️ 寵物冒險" onBack={()=>{stopBattleBgm();setRun(null);setBattle(null);setFeedback(null);setBattleSkillId(null)}} cl={c.cl}/>
      <style>{`
@keyframes advPetReady {0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes advSkillFly {0%{transform:translate(-80px,42px) scale(.4) rotate(-12deg);opacity:0}25%{opacity:1}70%{transform:translate(34px,-16px) scale(1.35) rotate(8deg);opacity:1}100%{transform:translate(74px,-36px) scale(.6) rotate(18deg);opacity:0}}
@keyframes advEnemyHit {0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(7px)}60%{transform:translateX(-4px)}}
@keyframes advDamagePop {0%{transform:translateY(10px) scale(.85);opacity:0}35%{opacity:1}100%{transform:translateY(-18px) scale(1.05);opacity:0}}
@keyframes advDialog {0%{transform:translateY(6px);opacity:.4}100%{transform:translateY(0);opacity:1}}
@keyframes advSkillAura {0%{transform:scale(.7);opacity:.15}55%{transform:scale(1.18);opacity:.65}100%{transform:scale(1.45);opacity:0}}
@keyframes advScreenFlash {0%{opacity:0}20%{opacity:.62}100%{opacity:0}}
@keyframes advCardPulse {0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
[data-pet-adventure-layout]{display:grid;grid-template-columns:minmax(640px,1fr) minmax(300px,360px);gap:14px;align-items:start}
[data-pet-adventure-arena]{min-height:520px !important;margin-bottom:0 !important}
[data-pet-adventure-controls]{display:grid;gap:10px}
[data-adventure-party]{margin-top:6px!important}
[data-adventure-skill-hand],[data-adventure-status],[data-adventure-question]{margin-bottom:0 !important}
[data-adventure-status]{display:none!important}
[data-adventure-question]{position:absolute;left:18px;right:auto;top:64px;width:min(390px,42%);z-index:7;background:rgba(255,255,255,.76)!important;backdrop-filter:blur(14px);box-shadow:0 14px 34px rgba(0,0,0,.18)}
[data-adventure-question]{max-height:none;overflow:visible;border:1px solid rgba(255,255,255,.72)!important}
[data-adventure-question-title]{display:none!important}
[data-adventure-question-prompt]{font-size:16px!important;line-height:1.28!important}
[data-adventure-question-zh]{font-size:11px!important;margin-top:3px!important;opacity:.72}
[data-adventure-question-audio]{position:absolute;top:8px;right:8px;margin-top:0!important;min-height:30px!important;width:32px!important;padding:0!important;font-size:14px!important;background:rgba(255,255,255,.82)!important}
[data-adventure-answers]{display:grid!important;grid-template-columns:1fr 1fr;gap:6px!important;margin-top:8px!important}
[data-adventure-answers] button{min-height:36px!important;padding:8px 10px!important;font-size:13px!important}
[data-adventure-feedback]{margin-top:8px!important;padding:8px 9px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center}
[data-adventure-feedback-result]{font-size:13px!important;line-height:1.25!important}
[data-adventure-feedback-tip]{display:none!important}
[data-adventure-answer-line]{grid-column:1/-1!important;margin-top:0!important}
[data-adventure-answer-line] [data-adventure-answer-text]{font-size:12px!important;line-height:1.25!important}
[data-adventure-answer-line] button{min-height:30px!important;padding:6px 9px!important}
[data-adventure-feedback-action]{grid-column:1/-1!important}
[data-adventure-feedback] button{margin-top:0!important;min-height:34px!important;padding:8px 13px!important;font-size:12px!important;white-space:nowrap}
[data-adventure-answer-line] button{min-height:30px!important;padding:6px 9px!important;font-size:12px!important}
[data-adventure-skill-hand] button{min-height:72px!important;padding:9px 10px!important}
[data-adventure-skill-hand] button div:first-of-type{font-size:16px!important;margin-bottom:2px!important}
[data-adventure-skill-hand] button div:nth-of-type(3){display:none!important}
[data-adventure-skill-hand] > div:first-child{margin-bottom:8px!important}
[data-adventure-skill-hand] > div:first-child > div:first-child > div:first-child{font-size:14px!important}
[data-pet-adventure-controls]{position:sticky;top:10px}
@media (max-width: 820px){
  [data-pet-adventure-layout]{display:grid;grid-template-columns:1fr;grid-template-rows:1fr;position:relative}
  [data-pet-adventure-arena]{grid-area:1/1;min-height:calc(100dvh - 118px) !important;margin-bottom:0 !important}
  [data-pet-adventure-controls]{position:relative;top:auto;grid-area:1/1;align-self:end;z-index:8;padding:8px;gap:6px;max-height:44dvh;overflow:auto;overscroll-behavior:contain}
  [data-adventure-enemy]{right:10px!important;top:12px!important;width:46%!important;max-width:188px!important}
  [data-adventure-enemy] > div:first-child{padding:7px 9px!important}
  [data-adventure-enemy] > div:nth-child(2){font-size:52px!important;margin-top:3px!important}
  [data-adventure-team]{left:10px!important;bottom:132px!important;width:47%!important;max-width:190px!important}
  [data-adventure-team] > div:first-child{min-height:72px!important}
  [data-adventure-team] > div:first-child > div{flex-basis:54px!important}
  [data-adventure-team] > div:nth-child(2){padding:7px 9px!important}
  [data-adventure-dialog]{left:8px!important;right:8px!important;bottom:80px!important;padding:7px 9px!important;font-size:11px!important;border-width:2px!important;opacity:.92}
  [data-adventure-dialog] div{display:none}
  [data-adventure-skill-hand]{padding:8px!important;background:rgba(255,255,255,.92)!important;backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,.12)}
  [data-adventure-skill-hand] > div:first-child{margin-bottom:6px!important}
  [data-adventure-skill-hand] > div:last-child{display:flex!important;gap:7px!important;overflow-x:auto;padding-bottom:2px;scroll-snap-type:x mandatory}
  [data-adventure-skill-hand] button{flex:0 0 116px;min-height:54px!important;padding:7px 8px!important;scroll-snap-align:start}
  [data-adventure-skill-hand] button div:first-of-type{font-size:15px!important;margin-bottom:1px!important}
  [data-adventure-skill-hand] button div:nth-of-type(3){display:none}
  [data-adventure-question]{left:8px!important;right:8px!important;top:124px!important;bottom:auto!important;width:auto!important;max-height:none!important;overflow:visible!important;transform:none!important;padding:9px 10px!important;background:rgba(255,255,255,.88)!important;backdrop-filter:blur(14px);box-shadow:0 10px 28px rgba(0,0,0,.18)}
  [data-adventure-question-title]{font-size:11px!important;margin-bottom:3px!important}
  [data-adventure-question-prompt]{font-size:14px!important;line-height:1.24!important;padding-right:40px!important}
  [data-adventure-question-zh]{font-size:11px!important;margin-top:2px!important}
  [data-adventure-question-audio]{top:8px!important;right:8px!important;padding:0!important;font-size:13px!important;min-height:28px!important;width:30px!important}
  [data-adventure-answers]{gap:5px!important;margin-top:7px!important}
  [data-adventure-answers] button{min-height:34px!important;padding:7px 8px!important;font-size:12px!important}
  [data-adventure-feedback]{margin-top:7px!important;padding:7px 8px!important;grid-template-columns:minmax(0,1fr) auto!important}
  [data-adventure-feedback-result]{font-size:12px!important}
  [data-adventure-answer-line] [data-adventure-answer-text]{font-size:11px!important}
  [data-adventure-feedback] button{min-height:31px!important;padding:7px 10px!important;font-size:11px!important}
}
@media (max-width: 520px){
  [data-pet-adventure-arena]{min-height:calc(100dvh - 108px) !important}
  [data-pet-adventure-controls]{gap:8px}
  [data-adventure-question]{top:118px!important}
  [data-adventure-enemy]{width:44%!important;max-width:168px!important}
  [data-adventure-enemy] > div:nth-child(2){font-size:48px!important}
  [data-adventure-team]{bottom:126px!important;width:48%!important}
  [data-adventure-party]{margin-top:6px!important;grid-template-columns:repeat(3,minmax(0,1fr))!important}
  [data-adventure-party] > div{padding:7px!important;gap:5px!important}
  [data-adventure-party] > div > div:first-child{transform:scale(.78);transform-origin:left center}
  [data-adventure-party] > div > div:last-child div:first-child{font-size:10px!important}
  [data-adventure-party] > div > div:last-child div:last-child{font-size:9px!important}
}
@media (prefers-reduced-motion: reduce) { [data-pet-adventure-battle] *{animation:none !important} }
`}</style>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        {run.stages.map((s,i)=><div key={s.id} title={s.boss?"Boss":"Stage"} style={{flex:s.boss?1.4:1,height:s.boss?11:8,borderRadius:999,background:i<=battle.stageIndex?(s.boss?"linear-gradient(90deg,#7C2D12,#DC2626,#F59E0B)":c.cl):S.bg2,opacity:i===battle.stageIndex?1:.55,boxShadow:s.boss&&i<=battle.stageIndex?"0 0 12px rgba(220,38,38,.45)":"none"}}/> )}
      </div>
      <div data-pet-adventure-layout>
      <div data-pet-adventure-battle data-pet-adventure-arena style={{position:"relative",minHeight:isBoss?304:276,borderRadius:18,overflow:"hidden",marginBottom:10,border:`2px solid ${isBoss?"#DC2626":S.bd}`,background:isBoss?"linear-gradient(160deg,#230812 0%,#3B0A16 42%,#111827 100%)":`linear-gradient(160deg,${c.bg} 0%,var(--color-background-primary,#fff) 42%,#E1F5EE 100%)`,boxShadow:isBoss?"0 18px 40px rgba(220,38,38,.24)":"0 12px 28px rgba(15,110,86,.10)"}}>
        <div style={{position:"absolute",inset:0,background:isBoss?"radial-gradient(circle at 72% 24%, rgba(248,113,113,.35), transparent 30%), radial-gradient(circle at 22% 78%, rgba(124,58,237,.22), transparent 36%)":"radial-gradient(circle at 74% 24%, rgba(255,255,255,.85), transparent 28%), radial-gradient(circle at 20% 76%, rgba(15,110,86,.12), transparent 32%)"}}/>
        {isBoss&&<div style={{position:"absolute",left:14,top:12,zIndex:1,display:"flex",gap:7,alignItems:"center",fontSize:12,fontWeight:1000,color:"#FDE68A",background:"rgba(127,29,29,.78)",border:"1px solid rgba(253,230,138,.45)",borderRadius:999,padding:"6px 10px",boxShadow:"0 0 18px rgba(220,38,38,.35)"}}>👑 BOSS APPEARED · 連勝 3 關後出現</div>}
        {feedback&&<div key={`flash-${feedback.effectKey}`} style={{position:"absolute",inset:0,background:`radial-gradient(circle at 60% 42%, ${activeVisual.glow}, transparent 42%)`,animation:"advScreenFlash .5s ease-out forwards",pointerEvents:"none"}}/>}
        <div data-adventure-enemy style={{position:"absolute",right:18,top:18,width:"42%",maxWidth:260}}>
          <div style={{...S.card,padding:"10px 12px",background:isBoss?"rgba(254,242,242,.94)":"rgba(255,255,255,.88)",border:`2px solid ${isBoss?"#DC2626":S.bd}`}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",fontSize:12,fontWeight:900,color:S.t1}}>
              <span>{stage.enemy}</span><span>Lv.{Math.max(5,8+battle.stageIndex*7)}</span>
            </div>
            <div style={{marginTop:6}}>{hpBar(battle.enemyHp,stage.maxHp,"#E24B4A")}</div>
          </div>
          <div key={`enemy-${feedback?.effectKey||battle.stageIndex}`} style={{fontSize:isBoss?96:70,textAlign:"center",marginTop:isBoss?14:8,filter:isBoss?"drop-shadow(0 0 20px rgba(248,113,113,.72)) drop-shadow(0 16px 14px rgba(0,0,0,.38))":"drop-shadow(0 12px 10px rgba(0,0,0,.16))",animation:feedback?.correct?"advEnemyHit .38s ease-in-out":"none"}}>{enemyIcon}</div>
          {feedback?.correct&&<div key={`dmg-${feedback.effectKey}`} style={{position:"absolute",right:"38%",top:82,fontSize:20,fontWeight:1000,color:"#E24B4A",textShadow:"0 2px 0 #fff",animation:"advDamagePop .8s ease-out forwards"}}>-{feedback.damage}</div>}
        </div>
        <div data-adventure-team style={{position:"absolute",left:14,bottom:74,width:"50%",maxWidth:320}}>
          <div style={{display:"flex",alignItems:"flex-end",gap:4,minHeight:100}}>
            {selectedPets.map((p,i)=>{
              const isActive=p.petId===activePet?.petId;
              return(<div key={p.petId} style={{flex:"0 1 82px",textAlign:"center",opacity:isActive?1:.65,transform:isActive?"scale(1.08)":"scale(.92)",transition:"all .2s",animation:isActive&&!feedback?"advPetReady 1.2s ease-in-out infinite":"none"}}>
                <PixelPet petId={p.petId} stage={getPetStage(p)} size={isActive?74:56} animate={false}/>
                {isActive&&<div style={{height:5,margin:"2px auto 0",width:42,borderRadius:999,background:activeVisual.color}}/>}
              </div>);
            })}
          </div>
          <div style={{...S.card,padding:"10px 12px",background:"rgba(255,255,255,.9)",border:`1px solid ${S.bd}`}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",fontSize:12,fontWeight:900,color:S.t1}}>
              <span>{activeDef?.name||"Team"}</span><span>Team HP</span>
            </div>
            <div style={{marginTop:6}}>{hpBar(battle.teamHp,battle.maxTeamHp,c.cl)}</div>
          </div>
        </div>
        {feedback&&<>
          <div key={`aura-${feedback.effectKey}`} style={{position:"absolute",left:"38%",top:"50%",width:90,height:90,borderRadius:"50%",background:activeVisual.glow,animation:"advSkillAura .72s ease-out forwards",pointerEvents:"none"}}/>
          <div key={`skill-${feedback.effectKey}`} style={{position:"absolute",left:"46%",top:"42%",fontSize:58,color:activeVisual.color,filter:"drop-shadow(0 8px 10px rgba(0,0,0,.2))",animation:"advSkillFly .75s ease-out forwards",pointerEvents:"none"}}>{feedback.correct?activeVisual.effect:"💥"}</div>
        </>}
        <div data-adventure-dialog style={{position:"absolute",left:12,right:12,bottom:10,padding:"12px 14px",borderRadius:14,background:isBoss?"#3B0A16":"#123047",color:"#fff",border:`3px solid ${isBoss?"#FDE68A":"rgba(255,255,255,.9)"}`,boxShadow:"0 6px 16px rgba(0,0,0,.18)",fontSize:14,fontWeight:900,lineHeight:1.5,animation:"advDialog .2s ease-out"}}>
          {feedback?feedback.message:"選技能，答題攻擊。"}
        </div>
        <div data-adventure-question style={{...S.card,padding:"12px 13px",marginBottom:10}}>
          <div data-adventure-question-title style={{fontSize:12,color:c.cl,fontWeight:900,marginBottom:6}}>English Challenge</div>
          <div data-adventure-question-meta style={{display:"inline-flex",alignItems:"center",gap:5,marginBottom:6,padding:"3px 8px",borderRadius:999,background:qMeta.bg,border:`1px solid ${qMeta.color}33`,color:qMeta.color,fontSize:10,fontWeight:1000}}>
            <span>{qMeta.label}</span><span style={{opacity:.72}}>· {qMeta.zh}</span>
          </div>
          <div data-adventure-question-prompt style={{fontSize:17,fontWeight:900,color:S.t1,lineHeight:1.4}}>{q.q}</div>
          <div data-adventure-question-zh style={{fontSize:13,color:S.t2,marginTop:5}}>{q.zh}</div>
          <button data-adventure-question-audio aria-label="朗讀完整題目" title="朗讀完整題目" onClick={()=>speak(questionSpeech)} style={{marginTop:10,border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:999,padding:"7px 12px",fontSize:12,color:S.t2,cursor:"pointer",fontFamily:"inherit"}}>🔊</button>
          <div data-adventure-answers style={{display:"grid",gap:7,marginTop:10}}>
            {q.choices.map((choice,i)=>{
              const locked=!!feedback;
              const isCorrect=i===q.answer;
              const isPicked=feedback?.choiceIndex===i;
              const bg=locked&&isCorrect?"#E1F5EE":locked&&isPicked&&!isCorrect?"#FCEBEB":S.bg2;
              const border=locked&&isCorrect?"2px solid #1D9E75":locked&&isPicked&&!isCorrect?"2px solid #E24B4A":`1px solid ${S.bd}`;
              return(<button key={choice} onClick={()=>answerQuestion(i)} disabled={locked} style={{padding:"10px 12px",borderRadius:12,border,background:bg,textAlign:"left",fontSize:14,fontWeight:800,color:S.t1,cursor:locked?"default":"pointer",fontFamily:"inherit"}}>{choice}</button>);
            })}
          </div>
          {feedback&&<div data-adventure-feedback style={{marginTop:14,padding:"13px 14px",borderRadius:12,background:feedback.correct?"#E1F5EE":"#FFF3CD",border:`1px solid ${feedback.correct?"#1D9E75":"#EF9F27"}55`}}>
            <div data-adventure-feedback-result style={{fontSize:15,fontWeight:900,color:feedback.correct?"#0F6E56":"#856404"}}>{feedback.correct?`答對！造成 ${feedback.damage} 傷害，隊伍回復 ${feedback.heal} HP。`:`答錯了，敵人反擊造成 ${feedback.damage} 傷害。`}</div>
            <div data-adventure-feedback-tip style={{fontSize:12,color:S.t2,marginTop:5}}>重點：{feedback.tip}</div>
            {feedback.answerLine&&<div data-adventure-answer-line style={{marginTop:8,padding:"9px 10px",borderRadius:10,background:"rgba(255,255,255,.72)",border:`1px solid ${feedback.correct?"#1D9E7544":"#EF9F2744"}`,display:"flex",gap:8,alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,color:S.t3,fontWeight:900}}>完整正解</div>
                <div data-adventure-answer-text style={{fontSize:13,color:S.t1,fontWeight:900,lineHeight:1.4,marginTop:2}}>{feedback.answerLine}</div>
              </div>
              <button onClick={()=>speak(feedback.answerSpeech||feedback.answerLine)} aria-label="朗讀完整正解" title="朗讀完整正解" style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:999,padding:"6px 9px",fontSize:12,color:S.t2,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>🔊</button>
            </div>}
            {!feedback.stageClear&&battle.teamHp>0&&<button data-adventure-feedback-action onClick={continueBattle} style={{...S.btn,background:c.cl,color:"#fff",marginTop:10,fontSize:13}}>下一題</button>}
            {feedback.stageClear&&!feedback.last&&<button data-adventure-feedback-action onClick={nextStage} style={{...S.btn,background:c.cl,color:"#fff",marginTop:10,fontSize:13}}>前往下一關</button>}
          </div>}
        </div>
      </div>
      <div data-pet-adventure-controls>
      <div data-adventure-skill-hand style={{...S.card,padding:"12px 14px",marginBottom:10,border:`1px solid ${activeVisual.color}33`,background:`linear-gradient(135deg,${activeVisual.bg},var(--color-background-primary,#fff))`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:9}}>
          <div>
            <div style={{fontSize:13,fontWeight:1000,color:S.t1}}>技能</div>
            {run.morale&&<div style={{fontSize:10,color:run.morale.color,fontWeight:900,marginTop:2}}>{run.morale.emoji} {run.morale.label} · {run.morale.battleText}</div>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <button onClick={()=>setBattleAudioOn(v=>!v)} title={battleAudioOn?"關閉戰鬥音樂":"開啟戰鬥音樂"} style={{border:`1px solid ${battleAudioOn?activeVisual.color:S.bd}`,background:battleAudioOn?activeVisual.bg:S.bg2,borderRadius:999,padding:"5px 8px",fontSize:11,fontWeight:1000,color:battleAudioOn?activeVisual.color:S.t3,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>♪ {battleAudioOn?"ON":"OFF"}</button>
            <div style={{fontSize:12,fontWeight:1000,color:activeVisual.color,whiteSpace:"nowrap"}}>{activeSkill.emoji} {activeSkill.zh}</div>
          </div>
        </div>
        <div data-adventure-skill-grid style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(138px,1fr))",gap:8}}>
          {activeSkillCards.map(card=>{
            const visual=PET_ADVENTURE_SKILL_VISUALS[card.skill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
            const chosen=activeSkill.id===card.skill.id;
            const recommended=card.unlocked&&isRecommendedSkill(card.skill,q,battle.questionIndex);
            return(<button key={card.skill.id} disabled={!!feedback||!card.unlocked} onClick={()=>setBattleSkillId(card.skill.id)} style={{
              position:"relative",
              textAlign:"left",
              minHeight:86,
              padding:"10px 10px",
              borderRadius:12,
              border:`2px solid ${chosen?visual.color:recommended?"#EF9F27":S.bd}`,
              background:chosen?visual.bg:card.unlocked?S.bg1:"#f3f3f0",
              boxShadow:chosen?`0 8px 18px ${visual.glow}`:recommended?"0 6px 14px rgba(239,159,39,.18)":"none",
              opacity:card.unlocked?1:.5,
              cursor:feedback||!card.unlocked?"default":"pointer",
              fontFamily:"inherit",
              overflow:"hidden",
            }}>
              {recommended&&!chosen&&<span style={{position:"absolute",top:6,right:7,fontSize:10,fontWeight:1000,color:"#856404",background:"#FFF3CD",borderRadius:999,padding:"2px 6px"}}>推薦</span>}
              {chosen&&<span style={{position:"absolute",top:6,right:7,fontSize:10,fontWeight:1000,color:"#fff",background:visual.color,borderRadius:999,padding:"2px 6px"}}>已選</span>}
              <div style={{fontSize:18,marginBottom:3}}>{card.skill.emoji}</div>
              <div style={{fontSize:12,fontWeight:1000,color:card.unlocked?visual.color:S.t3}}>{card.skill.name}</div>
              <div style={{fontSize:11,color:S.t2,lineHeight:1.35,marginTop:3,paddingRight:chosen?34:0}}>{card.unlocked?getSkillAdvice(card.skill,q,battle.questionIndex):card.rule.learn}</div>
            </button>);
          })}
        </div>
      </div>
      <div data-adventure-status style={{...S.card,padding:"12px 14px",marginBottom:10,background:isBoss?"linear-gradient(135deg,#FEF2F2,var(--color-background-primary,#fff))":`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`,borderTop:`4px solid ${isBoss?"#DC2626":c.cl}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:12,color:isBoss?"#DC2626":c.cl,fontWeight:900}}>{isBoss?"BOSS":"Stage"} {isBoss?"":`${battle.stageIndex+1}/3`} · Turn {battle.questionIndex+1} · {stage.zh}</div>
            <div style={{fontSize:18,fontWeight:900,color:S.t1}}>{stage.emoji} {stage.name}</div>
            <div style={{fontSize:12,color:S.t2,marginTop:3}}>Enemy: {stage.enemy}（{stage.enemyZh}）</div>
          </div>
          <button onClick={()=>speak(stage.hint)} style={{...S.btn,background:S.bg1,color:c.cl,fontSize:12}}>朗讀提示</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
          <div><div style={{fontSize:12,fontWeight:900,color:S.t2,marginBottom:4}}>Team HP {battle.teamHp}/{battle.maxTeamHp}</div>{hpBar(battle.teamHp,battle.maxTeamHp,c.cl)}</div>
          <div><div style={{fontSize:12,fontWeight:900,color:S.t2,marginBottom:4}}>Enemy HP {battle.enemyHp}/{stage.maxHp}</div>{hpBar(battle.enemyHp,stage.maxHp,"#E24B4A")}</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10,fontSize:11,fontWeight:900}}>
          <span style={{padding:"4px 8px",borderRadius:999,background:S.bg1,color:S.t2}}>已答 {battle.answered}</span>
          <span style={{padding:"4px 8px",borderRadius:999,background:"#E1F5EE",color:"#0F6E56"}}>答對 {battle.correct}</span>
          <span style={{padding:"4px 8px",borderRadius:999,background:"#FCEBEB",color:"#B42318"}}>失誤 {battle.miss}</span>
        </div>
      </div>
      </div>
      </div>
      <div data-adventure-party style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginTop:10}}>
        {selectedPets.map(p=>{const def=getAdventurePetDef(p);const skill=getSelectedPetAdventureSkill(p,run.skillLoadout);const visual=PET_ADVENTURE_SKILL_VISUALS[skill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;const active=p.petId===activePet?.petId;return(<div key={p.petId} style={{...S.card,padding:"10px",display:"flex",alignItems:"center",gap:8,border:`2px solid ${active?visual.color:S.bd}`,background:active?visual.bg:S.bg1,animation:active&&!feedback?"advCardPulse 1.1s ease-in-out infinite":"none"}}>
          <PixelPet petId={p.petId} stage={getPetStage(p)} size={48} animate={false}/>
          <div style={{minWidth:0}}><div style={{fontSize:12,fontWeight:900,color:S.t1}}>{def?.name||p.petId}</div><div style={{fontSize:11,color:visual.color,fontWeight:900}}>{skill.emoji} {skill.name}</div></div>
        </div>)})}
      </div>
    </div>);
  }
  return(<div><Hdr t="🗺️ 寵物冒險" onBack={onBack} cl={c.cl}/>
    <div style={{...S.card,padding:"16px",marginBottom:12,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`,borderTop:`4px solid ${c.cl}`}}>
      <div style={{fontSize:24,fontWeight:900,color:S.t1}}>帶 3 隻寵物挑戰英文關卡</div>
      <div style={{fontSize:13,color:S.t2,lineHeight:1.7,marginTop:6}}>寵物的等級、親密度、照顧狀態與技能會影響戰力。每次冒險先挑戰 3 個隨機英文關卡，連續打贏後會出現大魔王；擊敗 Boss 可獲得培養道具、技能，還有特殊寵物蛋。</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
        <button onClick={()=>setSelectedIds(bestTeamIds)} style={{...S.btn,background:c.cl,color:"#fff",fontSize:13}}>推薦隊伍</button>
        <button onClick={()=>setSelectedIds([])} style={{...S.btn,background:S.bg1,color:S.t2,fontSize:13}}>清空選擇</button>
        {lowCareCount>0&&<span style={{alignSelf:"center",fontSize:12,fontWeight:800,color:"#B42318",background:"#FCEBEB",borderRadius:999,padding:"6px 10px"}}>{lowCareCount} 隻狀態偏低，戰力會受影響</span>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginTop:14}}>
        <div style={{...S.card,padding:"10px",background:S.bg1}}><div style={{fontSize:11,color:S.t3}}>隊伍</div><div style={{fontSize:18,fontWeight:900,color:c.cl}}>{selectedIds.length}/3</div></div>
        <div style={{...S.card,padding:"10px",background:S.bg1}}><div style={{fontSize:11,color:S.t3}}>總戰力</div><div style={{fontSize:18,fontWeight:900,color:S.t1}}>{teamPower}</div></div>
        <div style={{...S.card,padding:"10px",background:S.bg1}}><div style={{fontSize:11,color:S.t3}}>持有金幣</div><div style={{fontSize:18,fontWeight:900,color:"#EF9F27"}}>{coins}</div></div>
      </div>
    </div>
    <div style={{...S.card,padding:"14px 16px",marginBottom:12,border:`1px solid ${c.cl}33`,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
      <div style={{fontSize:14,fontWeight:900,color:S.t1}}>技能怎麼學？</div>
      <div style={{fontSize:12,color:S.t2,lineHeight:1.7,marginTop:5}}>每隻寵物都有天生技能；照顧、學習與冒險會讓寵物升級，達到等級後可裝備新技能。冒險勝利也可能掉落技能卡，會直接記錄到寵物身上。</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:9}}>
        {Object.values(PET_ADVENTURE_SKILLS).map(skill=>{const visual=PET_ADVENTURE_SKILL_VISUALS[skill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;const rule=PET_ADVENTURE_SKILL_UNLOCKS[skill.id];return(<span key={skill.id} style={{fontSize:11,fontWeight:900,color:visual.color,background:visual.bg,border:`1px solid ${visual.color}33`,borderRadius:999,padding:"5px 8px"}}>{skill.emoji} {skill.zh} · {rule.label}</span>)})}
      </div>
    </div>
    {selectedPets.length>0&&<div style={{...S.card,padding:"11px 14px",marginBottom:10,border:`1px solid ${teamMoralePreview.color}55`,background:`linear-gradient(135deg,${teamMoralePreview.color}12,var(--color-background-primary,#fff))`,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{fontSize:24}}>{teamMoralePreview.emoji}</div>
      <div style={{flex:1,minWidth:190}}>
        <div style={{fontSize:13,fontWeight:1000,color:teamMoralePreview.color}}>隊伍士氣：{teamMoralePreview.label} · 平均照顧 {teamMoralePreview.avg}/100</div>
        <div style={{fontSize:11,color:S.t2,marginTop:2}}>{teamMoralePreview.battleText}</div>
      </div>
    </div>}
    {selectedPets.length>0&&<div style={{...S.card,padding:"11px 14px",marginBottom:10,border:`1px solid ${(teamPrepPlan.total||teamPrepPlan.needsFood)?"#EF9F27":S.bd}`,background:(teamPrepPlan.total||teamPrepPlan.needsFood)?"linear-gradient(135deg,#FFF3CD,var(--color-background-primary,#fff))":S.bg1,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{fontSize:23}}>🎒</div>
      <div style={{flex:1,minWidth:190}}>
        <div style={{fontSize:13,fontWeight:1000,color:(teamPrepPlan.total||teamPrepPlan.needsFood)?"#856404":S.t1}}>出戰整備</div>
        <div style={{fontSize:11,color:S.t2,lineHeight:1.5,marginTop:2}}>
          {(teamPrepPlan.total||teamPrepPlan.needsFood)?`建議處理：餵食 ${teamPrepPlan.feed}、清潔 ${teamPrepPlan.clean}、休息 ${teamPrepPlan.rest}${teamPrepPlan.needsFood?`；缺食物 ${teamPrepPlan.needsFood}`:""}。`:"隊伍照顧狀態良好。"}
        </div>
        {prepNotice&&<div style={{fontSize:11,fontWeight:900,color:prepNotice.ok?"#0F6E56":"#B42318",marginTop:4}}>{prepNotice.text}</div>}
      </div>
      <button onClick={prepareSelectedTeam} style={{...S.btn,background:(teamPrepPlan.total||teamPrepPlan.needsFood)?"#EF9F27":S.bg2,color:(teamPrepPlan.total||teamPrepPlan.needsFood)?"#fff":S.t1,fontSize:12,padding:"9px 12px"}}>{teamPrepPlan.total?"整備隊伍":teamPrepPlan.needsFood?"檢查庫存":"再次檢查"}</button>
    </div>}
    {selectedPets.length>0&&<div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:10}}>
        <div><div style={{fontSize:14,fontWeight:900,color:S.t1}}>出戰卡牌與技能</div><div style={{fontSize:12,color:S.t3,marginTop:2}}>點技能卡可指定這隻寵物在戰鬥中使用的技能。</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:10}}>
        {selectedPets.map(p=>{
          const def=getAdventurePetDef(p);
          const selectedSkill=getSelectedPetAdventureSkill(p,skillLoadout);
          const power=getPetAdventurePower(p);
          return(<div key={p.petId} style={{border:`1px solid ${S.bd}`,borderRadius:14,padding:12,background:S.bg1}}>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
              <div style={{width:76,height:76,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",background:`linear-gradient(135deg,${c.bg},#fff)`,border:`2px solid ${c.cl}33`}}><PixelPet petId={p.petId} stage={getPetStage(p)} size={62} animate={false}/></div>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:15,fontWeight:1000,color:S.t1}}>{def?.name||p.petId}</div>
                <div style={{fontSize:11,color:S.t3,marginTop:2}}>Lv.{p.level||1} · 親密 {p.bond||0} · 戰力 {power}</div>
                <div style={{fontSize:11,color:c.cl,fontWeight:900,marginTop:4}}>裝備：{selectedSkill.emoji} {selectedSkill.zh}</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7}}>
              {getPetAdventureSkillCards(p).map(card=>{
                const visual=PET_ADVENTURE_SKILL_VISUALS[card.skill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
                const chosen=selectedSkill.id===card.skill.id;
                return(<button key={card.skill.id} disabled={!card.unlocked} onClick={()=>setSkillLoadout(loadout=>({...loadout,[p.petId]:card.skill.id}))} style={{textAlign:"left",padding:"8px 9px",borderRadius:10,border:`2px solid ${chosen?visual.color:S.bd}`,background:chosen?visual.bg:card.unlocked?S.bg2:"#f3f3f0",opacity:card.unlocked?1:.52,cursor:card.unlocked?"pointer":"not-allowed",fontFamily:"inherit",minHeight:70}}>
                  <div style={{fontSize:12,fontWeight:1000,color:card.unlocked?visual.color:S.t3}}>{card.skill.emoji} {card.skill.zh}</div>
                  <div style={{fontSize:10,color:S.t3,lineHeight:1.35,marginTop:3}}>{card.unlocked?card.source:card.rule.learn}</div>
                </button>);
              })}
            </div>
          </div>);
        })}
      </div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:10,marginBottom:14}}>
      {availablePets.map(({pet,def,power,skill})=>{
        const selected=selectedIds.includes(pet.petId);
        const ri=RARITY_INFO[pet.rarity]||RARITY_INFO.N;
        const careAvg=getPetCareAverage(pet);
        const readiness=getPetReadiness(pet);
        const adventureScore=getPetAdventureScore(pet);
        const equipped=getSelectedPetAdventureSkill(pet,skillLoadout);
        const equippedVisual=PET_ADVENTURE_SKILL_VISUALS[equipped.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
        return(<button key={pet.petId} onClick={()=>togglePet(pet.petId)} style={{...S.card,padding:"13px",textAlign:"left",border:`2px solid ${selected?equippedVisual.color:S.bd}`,background:selected?`linear-gradient(145deg,${equippedVisual.bg},var(--color-background-primary,#fff))`:S.bg1,cursor:"pointer",fontFamily:"inherit",color:S.t1,position:"relative",overflow:"hidden",boxShadow:selected?`0 10px 24px ${equippedVisual.glow}`:"none"}}>
          {selected&&<div style={{position:"absolute",top:8,right:8,fontSize:11,fontWeight:1000,color:"#fff",background:equippedVisual.color,borderRadius:999,padding:"3px 8px"}}>出戰</div>}
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{width:72,height:72,borderRadius:16,background:`radial-gradient(circle,${equippedVisual.glow},transparent 62%)`,display:"flex",alignItems:"center",justifyContent:"center"}}><PixelPet petId={pet.petId} stage={getPetStage(pet)} size={62} animate={false}/></div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:15,fontWeight:900,color:S.t1}}>{def.name}</div>
              <div style={{fontSize:11,color:ri.color,fontWeight:900}}>{ri.label} · Lv.{pet.level||1}</div>
              <div style={{fontSize:11,color:S.t3,marginTop:3}}>親密 {pet.bond||0} · 狀態 {careAvg}% · 戰力 {power}</div>
              <div style={{fontSize:11,color:readiness.color,fontWeight:900,marginTop:3}}>{readiness.emoji} {readiness.label} · 推薦 {adventureScore}</div>
              <div style={{fontSize:11,color:equippedVisual.color,fontWeight:1000,marginTop:4}}>{equipped.emoji} {equipped.zh}</div>
            </div>
          </div>
          <div style={{marginTop:10,padding:"8px 9px",borderRadius:10,background:S.bg2,fontSize:12,color:S.t2,lineHeight:1.45}}>
            <b style={{color:c.cl}}>{skill.emoji} {skill.zh}</b><br/>{skill.name}: {skill.desc}
          </div>
        </button>);
      })}
    </div>
    <button onClick={startAdventure} disabled={!selectedIds.length} style={{...S.btn,background:selectedIds.length?(bossReady?"#7C2D12":c.cl):S.bg2,color:selectedIds.length?"#fff":S.t3,width:"100%",padding:"15px",fontSize:16,cursor:selectedIds.length?"pointer":"not-allowed"}}>{bossReady?"挑戰魔王":"開始冒險"} · Lv.{difficultyLevel}{!bossReady?` · 魔王還差 ${clearsToBoss} 輪`:""}</button>
  </div>);
}

function GachaPage({onBack,c,coins,setCoins,eggs,setEggs,pets,setPets}){
  const[rolling,setRolling]=useState(false);
  const[rollingRarity,setRollingRarity]=useState(null);// (P0-3) 抽蛋動畫期間的稀有度，給光柱動畫用
  const[rollingMode,setRollingMode]=useState(null);// (P0-3) 'single' | 'multi'，給動畫文字用
  const[result,setResult]=useState(null);
  const[showResult,setShowResult]=useState(false);
  const[pity,setPity]=useLS("gachaPity",{sinceSR:0,total:0});
  const countByRarity=list=>Object.keys(RARITY_INFO).reduce((acc,k)=>({...acc,[k]:list.filter(x=>x.rarity===k).length}),{});
  const buildPulls=(count,guaranteeR=false)=>{
    let since=Number(pity?.sinceSR||0);
    const pulls=[];
    for(let i=0;i<count;i++){
      let rarity=rollRarity();
      const pityHit=since>=GACHA_SR_PITY-1;
      if(pityHit&&RARITY_ORDER[rarity]<RARITY_ORDER.SR)rarity="SR";
      const pet=randomPet(rarity);
      pulls.push({rarity,pet,i,pityHit});
      since=RARITY_ORDER[rarity]>=RARITY_ORDER.SR?0:since+1;
    }
    if(guaranteeR&&!pulls.some(p=>RARITY_ORDER[p.rarity]>=RARITY_ORDER.R)){
      const last=pulls[pulls.length-1];
      const pet=randomPet("R");
      pulls[pulls.length-1]={...last,rarity:"R",pet,guarantee:true};
    }
    return{pulls,nextPity:{sinceSR:since,total:Number(pity?.total||0)+count}};
  };
  const settlePulls=(pulls)=>{
    const now=new Date().toISOString();
    const ownedPetIds=new Set(pets.map(p=>p.petId));
    const virtualEggs=new Map(eggs.map(e=>[e.petId,{...e,existing:true}]));
    const eggProgress=new Map();
    const newEggs=[];
    const petRewards={};
    const resolved=pulls.map((pull,i)=>{
      const petId=pull.pet.id;
      if(ownedPetIds.has(petId)){
        const reward=getDuplicatePetReward(pull.rarity);
        petRewards[petId]=petRewards[petId]?{exp:petRewards[petId].exp+reward.exp,bond:petRewards[petId].bond+reward.bond,dupes:petRewards[petId].dupes+reward.dupes}:reward;
        return{...pull,id:`dupe_${Date.now()}_${i}`,petId,resultType:"petBoost",isNew:false,dupeExp:reward.exp,dupeBond:reward.bond};
      }
      const target=virtualEggs.get(petId);
      if(target){
        const gain=DUPLICATE_EGG_PROGRESS[pull.rarity]||DUPLICATE_EGG_PROGRESS.N;
        const needed=EGG_HATCH_TASKS[target.rarity]||EGG_HATCH_TASKS[pull.rarity];
        target.progress=Math.min(needed,(target.progress||0)+gain);
        if(target.existing)eggProgress.set(target.id,target.progress);
        else{
          const newEgg=newEggs.find(e=>e.id===target.id);
          if(newEgg)newEgg.progress=target.progress;
        }
        return{...pull,id:`merge_${Date.now()}_${i}`,petId,resultType:"eggMerge",isNew:false,progressGain:gain,targetEggId:target.id,targetProgress:target.progress,targetNeeded:needed};
      }
      const egg={id:`egg_${Date.now()}_${i}`,rarity:pull.rarity,petId,progress:0,date:now};
      virtualEggs.set(petId,{...egg,existing:false});
      newEggs.push(egg);
      return{...pull,id:egg.id,petId,resultType:"newEgg",egg,isNew:true};
    });
    if(Object.keys(petRewards).length&&setPets){
      setPets(ps=>ps.map(p=>petRewards[p.petId]?applyDuplicatePetReward(p,petRewards[p.petId],now):p));
    }
    if(eggProgress.size||newEggs.length){
      setEggs(es=>[
        ...es.map(e=>eggProgress.has(e.id)?{...e,progress:eggProgress.get(e.id),date:e.date||now,updatedAt:now}:e),
        ...newEggs,
      ]);
    }
    return resolved;
  };
  const runCelebration=(items)=>{
    const hasSSR=items.some(r=>r.rarity==="SSR");
    const hasSR=items.some(r=>r.rarity==="SR");
    if(hasSSR&&typeof triggerRewardBurst==="function"){
      triggerRewardBurst({emoji:"✨",count:14,fromX:window.innerWidth/2,fromY:window.innerHeight*0.4,size:30,duration:1700});
      triggerRewardBurst({emoji:"🌟",count:10,fromX:window.innerWidth/2,fromY:window.innerHeight*0.4,size:26,duration:1900});
      triggerRewardBurst({text:items.length>1?"出 SSR！":"傳說稀有！",fromX:window.innerWidth/2,fromY:"38%",textColor:"#FFD700",textSize:items.length>1?44:40,duration:1800});
    }else if(hasSR&&typeof triggerRewardBurst==="function"){
      triggerRewardBurst({emoji:"✨",count:6,fromX:window.innerWidth/2,fromY:window.innerHeight*0.4,size:22,duration:1300});
    }
  };

  const roll=()=>{
    if(coins<EGG_COST||rolling)return;
    // (P0-3) 提早決定稀有度，讓動畫可以根據結果秀對應光柱
    const{pulls,nextPity}=buildPulls(1,false);
    const{rarity}=pulls[0];
    setRolling(true);
    setRollingRarity(rarity);
    setRollingMode("single");
    setCoins(co=>co-EGG_COST);
    setPity(nextPity);
    playSound("flip");
    setTimeout(()=>{
      const settled=settlePulls(pulls);
      setResult(settled[0]);
      setShowResult(true);
      setRolling(false);
      setRollingRarity(null);
      setRollingMode(null);
      if(rarity==="SSR"||rarity==="SR")playSound("combo");else playSound("good");
      runCelebration(settled);
    },1800);
  };

  const roll10=()=>{
    if(coins<EGG_COST*10||rolling)return;
    // (P0-3) 提早決定 10 個稀有度，動畫顯示最高的那個
    const{pulls:preResults,nextPity}=buildPulls(10,true);
    // 找到最高稀有度作為動畫顯示
    const highest=preResults.reduce((a,b)=>RARITY_ORDER[b.rarity]>RARITY_ORDER[a.rarity]?b:a);
    setRolling(true);
    setRollingRarity(highest.rarity);
    setRollingMode("multi");
    setCoins(co=>co-EGG_COST*10);
    setPity(nextPity);
    playSound("flip");
    setTimeout(()=>{
      const results=settlePulls(preResults);
      setResult({multi:results});
      setShowResult(true);
      setRolling(false);
      setRollingRarity(null);
      setRollingMode(null);
      const hasRare=results.some(r=>r.rarity==="SSR"||r.rarity==="SR");
      if(hasRare)playSound("combo");else playSound("good");
      runCelebration(results);
    },1800);
  };

  if(showResult&&result){
    if(result.multi){
      const summary=countByRarity(result.multi);
      const best=result.multi.reduce((a,b)=>RARITY_ORDER[b.rarity]>RARITY_ORDER[a.rarity]?b:a,result.multi[0]);
      const newCount=result.multi.filter(r=>r.isNew).length;
      const mergedCount=result.multi.filter(r=>r.resultType==="eggMerge").length;
      const boostedCount=result.multi.filter(r=>r.resultType==="petBoost").length;
      return(<div><Hdr t="🎰 扭蛋結果" onBack={()=>{setShowResult(false);setResult(null)}} cl={c.cl}/>
        <div style={{...S.card,padding:"16px",marginBottom:12,borderTop:`4px solid ${RARITY_INFO[best.rarity].color}`,background:`linear-gradient(135deg,${RARITY_INFO[best.rarity].bg},var(--color-background-primary,#fff))`}}>
          <div style={{fontSize:18,fontWeight:900,color:S.t1}}>🎉 十連抽結果</div>
          <div style={{fontSize:12,color:S.t2,marginTop:4,lineHeight:1.7}}>最高稀有度：<b style={{color:RARITY_INFO[best.rarity].color}}>{RARITY_INFO[best.rarity].label}</b> · 新蛋 {newCount} 顆 · 融合 {mergedCount} 顆 · 成長能量 {boostedCount} 次</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>{Object.entries(RARITY_INFO).map(([k,v])=><div key={k} style={{padding:"5px 9px",borderRadius:999,background:v.bg,border:`1px solid ${v.color}33`,fontSize:11,fontWeight:800,color:v.color}}>{v.label} × {summary[k]||0}</div>)}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(108px,1fr))",gap:8}}>
          {result.multi.map((r,i)=>{const ri=RARITY_INFO[r.rarity];return(<div key={r.id} style={{...S.card,padding:"14px 8px",textAlign:"center",background:ri.bg,border:`2px solid ${ri.color}`,animation:`bounceIn .4s ${i*0.08}s both`}}>
            <div style={{display:"flex",justifyContent:"center",gap:4,alignItems:"center",minHeight:18}}><span style={{fontSize:10,fontWeight:800,color:ri.color}}>{ri.stars} {ri.label}</span></div>
            <div style={{display:"flex",justifyContent:"center",margin:"4px auto"}}><PixelPet petId={r.petId} stage={r.resultType==="petBoost"?"adult":"egg"} size={48} animate={false}/></div>
            <div style={{fontSize:12,fontWeight:800,color:S.t1}}>{r.pet.name}</div>
            <div style={{fontSize:10,color:r.isNew?c.cl:r.resultType==="eggMerge"?ri.color:S.t3,fontWeight:800,marginTop:3}}>{r.resultType==="newEgg"?"NEW":r.resultType==="eggMerge"?`融合 +${r.progressGain}`:`XP +${r.dupeExp}`}</div>
            {r.resultType==="petBoost"&&<div style={{fontSize:9,color:S.t3,fontWeight:800,marginTop:2}}>親密度 +{r.dupeBond}</div>}
            {(r.pityHit||r.guarantee)&&<div style={{fontSize:9,color:ri.color,fontWeight:800,marginTop:2}}>{r.pityHit?"SR 保底":"十連保底"}</div>}
          </div>)})}
        </div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button onClick={()=>{setShowResult(false);setResult(null)}} style={{...S.btn,background:c.cl,color:"#fff",fontSize:14,flex:1}}>收下結果</button>
          <button onClick={()=>{setShowResult(false);setResult(null);setTimeout(roll10,200)}} disabled={coins<EGG_COST*10} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14,flex:1,opacity:coins<EGG_COST*10?0.45:1}}>再十連</button>
        </div>
      </div>);
    }
    const ri=RARITY_INFO[result.rarity];
    const title=result.resultType==="newEgg"?`獲得 ${result.pet.name} 蛋！`:result.resultType==="eggMerge"?`${result.pet.name} 蛋已融合！`:`${result.pet.name} 轉成成長能量！`;
    return(<div><Hdr t="🎰 扭蛋結果" onBack={()=>{setShowResult(false);setResult(null)}} cl={c.cl}/>
      <div style={{...S.card,padding:"32px 20px",textAlign:"center",background:`linear-gradient(135deg,${ri.bg},var(--color-background-primary,#fff))`,border:`3px solid ${ri.color}`,animation:"bounceIn .5s ease-out"}}>
        <div style={{fontSize:14,fontWeight:700,color:ri.color,marginBottom:8}}>{ri.stars} {ri.label}</div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:12,animation:"emojiBounce 1.5s ease-in-out infinite"}}><PixelPet petId={result.pet.id} stage={result.resultType==="petBoost"?"adult":"egg"} size={128}/></div>
        <div style={{fontSize:22,fontWeight:700,color:S.t1}}>{title}</div>
        <div style={{fontSize:12,color:result.resultType==="newEgg"?c.cl:ri.color,fontWeight:900,marginTop:4}}>{result.resultType==="newEgg"?"NEW · 已放入蛋倉":result.resultType==="eggMerge"?`重複蛋自動融合 · 孵化進度 +${result.progressGain}`:`已擁有寵物 · XP +${result.dupeExp} · 親密度 +${result.dupeBond}`}</div>
        <div style={{fontSize:13,color:S.t2,marginTop:6}}>預覽：{result.pet.emoji} {result.pet.name}</div>
        <div style={{fontSize:12,color:S.t3,marginTop:8,fontStyle:"italic"}}>{result.pet.story}</div>
        {result.pityHit&&<div style={{marginTop:12,padding:"8px 12px",background:"#FFF3CD",border:"1px solid #EF9F27",borderRadius:10,fontSize:12,color:"#856404",fontWeight:800}}>SR 保底觸發，這次至少超稀有！</div>}
        <div style={{marginTop:16,padding:"10px 14px",background:S.bg2,borderRadius:10,fontSize:13,color:S.t2}}>
          {result.resultType==="newEgg"?`💡 繼續學習 ${EGG_HATCH_TASKS[result.rarity]} 題英文來孵化這顆蛋！`:result.resultType==="eggMerge"?`💡 到蛋倉查看進度：${result.targetProgress}/${result.targetNeeded}`:"💡 到寵物圖鑑查看寵物成長。"}
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button onClick={()=>{setShowResult(false);setResult(null)}} style={{...S.btn,background:c.cl,color:"#fff",fontSize:14,flex:1}}>收下結果</button>
        <button onClick={()=>{setShowResult(false);setResult(null);setTimeout(roll,200)}} disabled={coins<EGG_COST} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14,flex:1,opacity:coins<EGG_COST?0.45:1}}>再抽一次</button>
      </div>
    </div>);
  }

  const totalPets=Object.values(PETS).reduce((a,list)=>a+list.length,0);
  const collectedIds=new Set(pets.map(p=>p.petId));
  const collectedPct=Math.round((collectedIds.size/totalPets)*100);
  const duplicateEnergyTotal=pets.reduce((sum,p)=>sum+(p.dupes||0),0);
  const duplicatePowerBonus=pets.reduce((sum,p)=>sum+getDuplicateEnergyInfo(p).adventureBonus,0);
  const singlePulls=Math.floor(coins/EGG_COST);
  const tenReady=coins>=EGG_COST*10;
  const readyEggs=eggs.filter(e=>e.progress>=EGG_HATCH_TASKS[e.rarity]).length;
  const eggCounts=countByRarity(eggs);
  const srPityLeft=Math.max(1,GACHA_SR_PITY-Number(pity?.sinceSR||0));
  const coinNeed=coins<EGG_COST?EGG_COST-coins:coins<EGG_COST*10?EGG_COST*10-coins:0;

  return(<div><Hdr t="🎰 扭蛋機" onBack={onBack} cl={c.cl}/>
    {/* Coins display */}
    <div style={{...S.card,padding:"16px",marginBottom:12,background:`linear-gradient(135deg,#FFF3CD,#FFE066)`,border:"2px solid #EF9F27"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div><div style={{fontSize:32,fontWeight:900,color:"#EF9F27",lineHeight:1}}>🪙 {coins}</div><div style={{fontSize:12,color:"#856404",marginTop:4}}>可抽 {singlePulls} 次 · 答題可獲得金幣</div></div>
        <div style={{minWidth:150,flex:"1 1 180px"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#856404",fontWeight:800,marginBottom:4}}><span>十連進度</span><span>{Math.min(100,Math.floor(coins/(EGG_COST*10)*100))}%</span></div>
          <div style={{height:8,background:"rgba(255,255,255,.55)",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,coins/(EGG_COST*10)*100)}%`,background:"#EF9F27",borderRadius:999}}/></div>
          <div style={{fontSize:11,color:"#856404",marginTop:4}}>{tenReady?"可以十連抽了":`再 ${coinNeed} 金幣可${coins<EGG_COST?"單抽":"十連抽"}`}</div>
        </div>
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8,marginBottom:12}}>
      <div style={{...S.card,padding:"12px",background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}><div style={{fontSize:12,color:S.t2,fontWeight:700}}>收藏進度</div><div style={{fontSize:20,fontWeight:900,color:c.cl,marginTop:2}}>{collectedIds.size}/{totalPets}</div><div style={{height:6,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${collectedPct}%`,background:c.cl}}/></div></div>
      <div style={{...S.card,padding:"12px"}}><div style={{fontSize:12,color:S.t2,fontWeight:700}}>蛋倉狀態</div><div style={{fontSize:20,fontWeight:900,color:S.t1,marginTop:2}}>🥚 {eggs.length}</div><div style={{fontSize:11,color:readyEggs?c.cl:S.t3,marginTop:4,fontWeight:800}}>{readyEggs?`${readyEggs} 顆可以孵化`:"完成學習任務來孵蛋"}</div></div>
      <div style={{...S.card,padding:"12px",border:`1px solid ${srPityLeft<=3?"#EF9F27":S.bd}`}}><div style={{fontSize:12,color:S.t2,fontWeight:700}}>SR 保底</div><div style={{fontSize:20,fontWeight:900,color:srPityLeft<=3?"#EF9F27":S.t1,marginTop:2}}>最多 {srPityLeft} 抽</div><div style={{fontSize:11,color:S.t3,marginTop:4}}>沒有 SR/SSR 時會累積</div></div>
    </div>

    {/* Rarity rates */}
    <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:8}}><div style={{fontSize:13,fontWeight:800,color:S.t1}}>🎲 抽獎機率</div><div style={{fontSize:11,color:c.cl,fontWeight:800}}>十連至少 1 顆稀有以上</div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(76px,1fr))",gap:6}}>
        {Object.entries(RARITY_INFO).map(([k,v])=>(<div key={k} style={{flex:"1 1 60px",textAlign:"center",padding:"6px 8px",background:v.bg,borderRadius:8,border:`1px solid ${v.color}33`}}>
          <div style={{fontSize:10,fontWeight:700,color:v.color}}>{v.stars}</div>
          <div style={{fontSize:14,fontWeight:700,color:v.color}}>{v.rate}%</div>
          <div style={{fontSize:10,color:S.t3}}>{v.label}</div>
        </div>))}
      </div>
    </div>

    {/* Roll buttons */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
      <button onClick={roll} disabled={coins<EGG_COST||rolling} style={{...S.btn,background:`linear-gradient(135deg,${c.cl},${c.ac})`,color:"#fff",padding:"18px 12px",fontSize:15,opacity:coins<EGG_COST||rolling?0.45:1,boxShadow:`0 4px 12px ${c.cl}40`,display:"flex",flexDirection:"column",gap:3,animation:rolling?"emojiPulse .5s infinite":"none"}}>
        <span style={{fontSize:24}}>🎰</span>
        <span>單抽</span>
        <span style={{fontSize:11,opacity:.9}}>🪙 {EGG_COST}</span>
      </button>
      <button onClick={roll10} disabled={coins<EGG_COST*10||rolling} style={{...S.btn,background:`linear-gradient(135deg,#7B61FF,#9F8FFF)`,color:"#fff",padding:"18px 12px",fontSize:15,opacity:coins<EGG_COST*10||rolling?0.45:1,boxShadow:"0 4px 12px #7B61FF40",display:"flex",flexDirection:"column",gap:3,animation:rolling?"emojiPulse .5s infinite":"none"}}>
        <span style={{fontSize:24}}>✨</span>
        <span>十連抽</span>
        <span style={{fontSize:11,opacity:.9}}>🪙 {EGG_COST*10} · R+ 保底</span>
      </button>
    </div>

    {/* (P0-3) 三段戲劇化抽蛋動畫：落下 → 震動發光 → 自動進結果頁 */}
    {rolling&&<GachaCeremony rarity={rollingRarity} mode={rollingMode}/>}

    {/* Collection stats */}
    <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:800,color:S.t1,marginBottom:8}}>📚 我的收藏與蛋倉</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(76px,1fr))",gap:6}}>
        {Object.entries(RARITY_INFO).map(([k,v])=>{const total=PETS[k].length;const got=pets.filter(p=>p.rarity===k).length;return(<div key={k} style={{flex:"1 1 60px",textAlign:"center",padding:"6px",background:S.bg2,borderRadius:8}}>
          <div style={{fontSize:10,color:v.color,fontWeight:600}}>{v.label}</div>
          <div style={{fontSize:14,fontWeight:700,color:S.t1}}>{got}/{total}</div>
          <div style={{fontSize:10,color:S.t3,marginTop:1}}>蛋 {eggCounts[k]||0}</div>
        </div>)})}
      </div>
      <div style={{marginTop:10,padding:"9px 10px",borderRadius:12,background:"linear-gradient(135deg,#FFF3CD,var(--color-background-primary,#fff))",border:"1px solid #EF9F2744",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div style={{fontSize:22}}>✨</div>
        <div style={{flex:1,minWidth:170}}>
          <div style={{fontSize:12,fontWeight:900,color:"#856404"}}>重複成長能量：{duplicateEnergyTotal}</div>
          <div style={{fontSize:11,color:"#856404",lineHeight:1.5,marginTop:2}}>已轉成冒險戰力 +{duplicatePowerBonus}，同時保留 XP 與親密度補償。</div>
        </div>
      </div>
    </div>

    <div style={{...S.card,padding:"14px 16px",marginBottom:12,border:"1px solid #EF9F2744",background:"linear-gradient(135deg,#FFF9E6,var(--color-background-primary,#fff))"}}>
      <div style={{fontSize:13,fontWeight:900,color:S.t1,marginBottom:8}}>🔁 重複寵物怎麼處理</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:7}}>
        {Object.entries(RARITY_INFO).map(([rarity,info])=>{
          const petReward=DUPLICATE_PET_REWARD[rarity]||DUPLICATE_PET_REWARD.N;
          const eggGain=DUPLICATE_EGG_PROGRESS[rarity]||DUPLICATE_EGG_PROGRESS.N;
          return(<div key={rarity} style={{padding:"8px 9px",borderRadius:11,background:info.bg,border:`1px solid ${info.color}33`}}>
            <div style={{fontSize:11,fontWeight:900,color:info.color}}>{info.stars} {info.label}</div>
            <div style={{fontSize:11,color:S.t2,lineHeight:1.5,marginTop:4}}>已擁有：XP +{petReward.exp} · 親密 +{petReward.bond}</div>
            <div style={{fontSize:11,color:S.t2,lineHeight:1.5}}>重複蛋：孵化 +{eggGain}</div>
          </div>);
        })}
      </div>
    </div>

    {/* How to earn coins */}
    <div style={{...S.card,padding:"14px 16px"}}>
      <div style={{fontSize:13,fontWeight:800,color:S.t1,marginBottom:6}}>💰 如何獲得金幣</div>
      <div style={{fontSize:12,color:S.t2,lineHeight:1.8}}>
        • 每答對 1 題 → 獲得 1-5 🪙<br/>
        • 完成 SRS 輪次 → 額外獎勵<br/>
        • Combo 連擊 → 額外獎勵<br/>
        • 每日目標達成 → 大量金幣<br/>
        • 抽到重複蛋 → 自動融合成孵化進度<br/>
        • 抽到已擁有寵物 → 轉成 XP 與親密度<br/>
        <span style={{color:c.cl,fontWeight:800}}>這裡只使用學習金幣，不需要任何付費抽蛋。</span>
      </div>
    </div>
  </div>);
}


// ═══ PET SOUNDS (寵物叫聲 v2 - 真實聲音模擬) ═════════════════════════════
// Helper: create one "note" with frequency sweep, vibrato, ADSR envelope
function playNote(ctx,opts){
  const{freq,freqEnd,dur,type="sine",volume=0.2,attack=0.01,decay=0.05,start=0,vibrato=0,vibratoSpeed=6,filterFreq=null,filterQ=1,detune=0}=opts;
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  osc.type=type;
  osc.frequency.value=freq;
  if(detune)osc.detune.value=detune;
  const when=ctx.currentTime+start;
  // Frequency sweep (makes sound alive - like real animal vocalization)
  if(freqEnd!==undefined){
    osc.frequency.setValueAtTime(freq,when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20,freqEnd),when+dur);
  }
  // Vibrato (warbling effect for cuter sounds)
  let vibOsc=null,vibGain=null;
  if(vibrato>0){
    vibOsc=ctx.createOscillator();
    vibGain=ctx.createGain();
    vibOsc.frequency.value=vibratoSpeed;
    vibGain.gain.value=vibrato;
    vibOsc.connect(vibGain);
    vibGain.connect(osc.frequency);
    vibOsc.start(when);
    vibOsc.stop(when+dur);
  }
  // ADSR envelope
  gain.gain.setValueAtTime(0,when);
  gain.gain.linearRampToValueAtTime(volume,when+attack);
  gain.gain.linearRampToValueAtTime(volume*0.7,when+attack+decay);
  gain.gain.exponentialRampToValueAtTime(0.0001,when+dur);
  // Optional lowpass filter (makes sound warmer/mufflred)
  let node=gain;
  if(filterFreq){
    const filter=ctx.createBiquadFilter();
    filter.type="lowpass";
    filter.frequency.value=filterFreq;
    filter.Q.value=filterQ;
    gain.connect(filter);
    node=filter;
  }
  osc.connect(gain);
  node.connect(ctx.destination);
  osc.start(when);
  osc.stop(when+dur);
  return osc;
}

// Helper: create noise burst (for consonants, air sounds)
function playNoise(ctx,opts){
  const{dur,volume=0.1,start=0,filterFreq=2000,filterType="bandpass",filterQ=5}=opts;
  const bufferSize=ctx.sampleRate*dur;
  const buffer=ctx.createBuffer(1,bufferSize,ctx.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++)data[i]=Math.random()*2-1;
  const src=ctx.createBufferSource();
  src.buffer=buffer;
  const filter=ctx.createBiquadFilter();
  filter.type=filterType;
  filter.frequency.value=filterFreq;
  filter.Q.value=filterQ;
  const gain=ctx.createGain();
  const when=ctx.currentTime+start;
  gain.gain.setValueAtTime(0,when);
  gain.gain.linearRampToValueAtTime(volume,when+0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001,when+dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(when);
  src.stop(when+dur);
}

function playPetSound(petId){
  if(!window.AudioContext&&!window.webkitAudioContext)return;
  let ctx;
  try{ctx=new (window.AudioContext||window.webkitAudioContext)()}catch{return}

  // Detailed sound recipes per pet species
  const recipes={
    // N tier - everyday cute animals
    bunny:()=>{
      // Soft squeak "mew mew" - two short rising chirps
      playNote(ctx,{freq:720,freqEnd:1100,dur:0.08,type:"sine",volume:0.12,vibrato:15,vibratoSpeed:20,filterFreq:3000,attack:0.005});
      playNote(ctx,{freq:800,freqEnd:1200,dur:0.09,type:"sine",volume:0.12,vibrato:15,vibratoSpeed:20,filterFreq:3000,start:0.12,attack:0.005});
    },
    chick:()=>{
      // "Cheep cheep cheep!" - three quick high chirps
      [0,0.13,0.26].forEach(t=>{
        playNote(ctx,{freq:2400,freqEnd:1800,dur:0.06,type:"triangle",volume:0.08,vibrato:40,vibratoSpeed:30,filterFreq:5000,start:t,attack:0.003});
      });
    },
    puppy:()=>{
      // Playful "yip!" - quick bark with slight growl
      playNote(ctx,{freq:180,freqEnd:220,dur:0.04,type:"sawtooth",volume:0.1,filterFreq:800,filterQ:2,attack:0.002});
      playNote(ctx,{freq:500,freqEnd:350,dur:0.14,type:"sawtooth",volume:0.15,filterFreq:1200,start:0.03,attack:0.005});
      playNoise(ctx,{dur:0.05,volume:0.04,filterFreq:3000,filterType:"highpass"});
    },
    kitty:()=>{
      // "Meow" - warm descending purr-like sound
      playNote(ctx,{freq:800,freqEnd:400,dur:0.35,type:"triangle",volume:0.13,vibrato:8,vibratoSpeed:5,filterFreq:1500,filterQ:2,attack:0.03,decay:0.1});
      playNote(ctx,{freq:1200,freqEnd:600,dur:0.3,type:"sine",volume:0.05,vibrato:8,vibratoSpeed:5,filterFreq:2000,start:0.02});
    },
    piggy:()=>{
      // "Oink oink!" - two grunts
      [0,0.18].forEach(t=>{
        playNote(ctx,{freq:220,freqEnd:180,dur:0.12,type:"sawtooth",volume:0.13,filterFreq:900,filterQ:3,start:t,attack:0.005});
        playNoise(ctx,{dur:0.1,volume:0.05,filterFreq:1500,filterType:"bandpass",filterQ:3,start:t});
      });
    },
    froggy:()=>{
      // "Ribbit!" - low warble with throat resonance
      playNote(ctx,{freq:180,freqEnd:240,dur:0.1,type:"square",volume:0.1,filterFreq:600,filterQ:4,attack:0.003});
      playNote(ctx,{freq:240,freqEnd:180,dur:0.15,type:"square",volume:0.11,filterFreq:600,filterQ:4,vibrato:30,vibratoSpeed:25,start:0.1});
    },
    // R tier
    panda:()=>{
      // Cute bleat-like sound
      playNote(ctx,{freq:280,freqEnd:320,dur:0.15,type:"sine",volume:0.13,vibrato:20,vibratoSpeed:15,filterFreq:1200,attack:0.02});
      playNote(ctx,{freq:320,freqEnd:260,dur:0.2,type:"sine",volume:0.12,vibrato:20,vibratoSpeed:15,filterFreq:1200,start:0.17});
    },
    koala:()=>{
      // Low grunt-bellow
      playNote(ctx,{freq:130,freqEnd:100,dur:0.3,type:"sawtooth",volume:0.14,filterFreq:500,filterQ:5,attack:0.05,decay:0.1});
      playNote(ctx,{freq:260,freqEnd:200,dur:0.25,type:"triangle",volume:0.06,filterFreq:800,start:0.05});
    },
    fox:()=>{
      // High "yip-yip!" - sharp and quick
      [0,0.12].forEach(t=>{
        playNote(ctx,{freq:900,freqEnd:600,dur:0.08,type:"triangle",volume:0.13,vibrato:20,filterFreq:2500,start:t,attack:0.003});
      });
    },
    owl:()=>{
      // "Hoo hoo" - two deep hoots with wide vibrato
      [0,0.35].forEach(t=>{
        playNote(ctx,{freq:400,freqEnd:380,dur:0.3,type:"sine",volume:0.1,vibrato:15,vibratoSpeed:8,filterFreq:1000,filterQ:3,attack:0.08,decay:0.05,start:t});
      });
    },
    penguin:()=>{
      // Honking bray
      playNote(ctx,{freq:500,freqEnd:700,dur:0.12,type:"sawtooth",volume:0.12,filterFreq:1500,filterQ:3,attack:0.01});
      playNote(ctx,{freq:700,freqEnd:400,dur:0.15,type:"sawtooth",volume:0.13,filterFreq:1500,filterQ:3,start:0.1});
    },
    // SR tier - magical creatures
    unicorn:()=>{
      // Magical sparkle + gentle whinny
      playNote(ctx,{freq:800,freqEnd:1400,dur:0.15,type:"triangle",volume:0.09,vibrato:30,vibratoSpeed:12,filterFreq:3000,attack:0.02});
      playNote(ctx,{freq:1600,freqEnd:2400,dur:0.2,type:"sine",volume:0.06,filterFreq:4000,start:0.08,attack:0.02});
      playNote(ctx,{freq:2400,freqEnd:3600,dur:0.25,type:"sine",volume:0.04,start:0.15,attack:0.03});
    },
    dragon:()=>{
      // Deep growl + flame whoosh
      playNote(ctx,{freq:80,freqEnd:60,dur:0.4,type:"sawtooth",volume:0.15,filterFreq:400,filterQ:6,vibrato:5,attack:0.05});
      playNote(ctx,{freq:160,freqEnd:120,dur:0.35,type:"square",volume:0.1,filterFreq:600,start:0.02});
      playNoise(ctx,{dur:0.3,volume:0.08,filterFreq:800,filterType:"lowpass",start:0.1});
    },
    whale:()=>{
      // Deep haunting song with wave modulation
      playNote(ctx,{freq:150,freqEnd:110,dur:0.8,type:"sine",volume:0.14,vibrato:10,vibratoSpeed:3,filterFreq:500,filterQ:2,attack:0.1,decay:0.15});
      playNote(ctx,{freq:110,freqEnd:170,dur:0.7,type:"sine",volume:0.1,vibrato:8,vibratoSpeed:2,filterFreq:600,start:0.4,attack:0.1});
    },
    // SSR tier - legendary
    phoenix:()=>{
      // Majestic bird call with flame crackle
      playNote(ctx,{freq:1400,freqEnd:2200,dur:0.25,type:"triangle",volume:0.12,vibrato:40,vibratoSpeed:18,filterFreq:4000,attack:0.01});
      playNote(ctx,{freq:2200,freqEnd:1800,dur:0.2,type:"triangle",volume:0.1,vibrato:30,vibratoSpeed:15,filterFreq:4000,start:0.22});
      playNote(ctx,{freq:1800,freqEnd:2600,dur:0.15,type:"sine",volume:0.08,filterFreq:5000,start:0.4});
      playNoise(ctx,{dur:0.5,volume:0.03,filterFreq:3000,filterType:"bandpass",filterQ:8});
    },
    celestial:()=>{
      // Ethereal chord with shimmer
      [0,0.05,0.1].forEach((t,i)=>{
        playNote(ctx,{freq:[880,1100,1320][i],dur:0.5,type:"sine",volume:0.07,vibrato:15,vibratoSpeed:6,filterFreq:3000,attack:0.1,decay:0.1,start:t});
      });
      playNote(ctx,{freq:1760,dur:0.4,type:"sine",volume:0.04,vibrato:30,vibratoSpeed:10,start:0.2,attack:0.1});
      playNote(ctx,{freq:2640,freqEnd:3520,dur:0.3,type:"sine",volume:0.03,start:0.3,attack:0.1});
    },
  };

  const recipe=recipes[petId]||recipes[PET_VARIANT_BASE[petId]]||recipes.puppy;
  try{recipe()}catch{}
}

// Action-specific sound effects (when feeding, playing, etc)
function playActionSound(action){
  if(!window.AudioContext&&!window.webkitAudioContext)return;
  let ctx;
  try{ctx=new (window.AudioContext||window.webkitAudioContext)()}catch{return}
  const recipes={
    feed:()=>{
      // Munch munch!
      [0,0.15,0.3].forEach(t=>{
        playNoise(ctx,{dur:0.08,volume:0.1,filterFreq:800,filterType:"lowpass",start:t});
        playNote(ctx,{freq:200,freqEnd:150,dur:0.1,type:"square",volume:0.05,filterFreq:500,start:t});
      });
    },
    clean:()=>{
      // Splashing water
      playNoise(ctx,{dur:0.4,volume:0.08,filterFreq:1500,filterType:"bandpass",filterQ:2});
      playNote(ctx,{freq:600,freqEnd:1200,dur:0.2,type:"sine",volume:0.06,vibrato:50,vibratoSpeed:15,start:0.1});
      playNote(ctx,{freq:1200,freqEnd:800,dur:0.15,type:"sine",volume:0.05,start:0.25});
    },
    play:()=>{
      // Happy bounce
      [0,0.1,0.2,0.3].forEach((t,i)=>{
        const freq=[800,1000,1200,1500][i];
        playNote(ctx,{freq,dur:0.08,type:"triangle",volume:0.1,filterFreq:3000,start:t,attack:0.01});
      });
    },
    sleep:()=>{
      // Sleepy yawn
      playNote(ctx,{freq:400,freqEnd:200,dur:0.6,type:"sine",volume:0.12,vibrato:10,vibratoSpeed:3,filterFreq:1000,filterQ:2,attack:0.1,decay:0.2});
    },
    study:()=>{
      // Cute "aha!" moment (ding)
      playNote(ctx,{freq:1200,dur:0.1,type:"sine",volume:0.1,filterFreq:3000,attack:0.005});
      playNote(ctx,{freq:1800,dur:0.15,type:"sine",volume:0.08,start:0.08});
      playNote(ctx,{freq:2400,dur:0.2,type:"sine",volume:0.06,start:0.16});
    },
    levelUp:()=>{
      // Triumphant fanfare
      [523,659,784,1047].forEach((f,i)=>{
        playNote(ctx,{freq:f,dur:0.15,type:"triangle",volume:0.1,filterFreq:3000,start:i*0.08,attack:0.005});
      });
    },
    heart:()=>{
      // Heart pop sound
      playNote(ctx,{freq:1200,freqEnd:1800,dur:0.1,type:"sine",volume:0.08,attack:0.003});
      playNote(ctx,{freq:1500,freqEnd:2200,dur:0.15,type:"triangle",volume:0.06,start:0.05});
    },
  };
  const recipe=recipes[action];
  if(recipe){try{recipe()}catch{}}
}

// Pet home environments
const PET_HOMES={
  bunny:{bg:"linear-gradient(180deg,#B8E6FF 0%,#E8F5E9 50%,#9CDFA8 100%)",ground:"🌱🌱🌱🌱🌱🌱🌱🌱",items:["🥕","🌷","🌼","🦋"],name:"綠草地"},
  chick:{bg:"linear-gradient(180deg,#FFF4D6 0%,#FFE699 50%,#D4A574 100%)",ground:"🟡🟡🟡🟡🟡🟡🟡🟡",items:["🌾","🥚","🏠","🌻"],name:"農場"},
  puppy:{bg:"linear-gradient(180deg,#B8E6FF 0%,#E8F5E9 50%,#9CDFA8 100%)",ground:"🌳🌱🌳🌱🌳🌱🌳🌱",items:["🦴","⚾","🎾","🐾"],name:"公園"},
  kitty:{bg:"linear-gradient(180deg,#FFD6E8 0%,#FFE8F0 50%,#F5C6E0 100%)",ground:"🏠🏠🏠🏠🏠🏠🏠🏠",items:["🧶","🐟","🥛","🪑"],name:"溫馨的家"},
  piggy:{bg:"linear-gradient(180deg,#FFE0B2 0%,#FFCC80 50%,#BCAAA4 100%)",ground:"🟫🟫🟫🟫🟫🟫🟫🟫",items:["🌽","🥕","🍎","🌾"],name:"泥巴農場"},
  froggy:{bg:"linear-gradient(180deg,#A8E6CF 0%,#7FD1AE 50%,#4A9B7F 100%)",ground:"💧💧💧💧💧💧💧💧",items:["🌿","🍃","🪷","🐛"],name:"池塘"},
  hamster:{bg:"linear-gradient(180deg,#FFF7D6 0%,#FCE7B2 50%,#D8B47A 100%)",ground:"🌾🌾🌾🌾🌾🌾🌾🌾",items:["🌻","🌰","🥜","⚙️"],name:"倉鼠小屋"},
  turtle:{bg:"linear-gradient(180deg,#C8F7DC 0%,#8ED8B3 50%,#4F9F78 100%)",ground:"🌿💧🌿💧🌿💧🌿💧",items:["🪷","🌿","🐚","💧"],name:"綠水池"},
  duckling:{bg:"linear-gradient(180deg,#B8E6FF 0%,#FFF4A8 50%,#8FD3B3 100%)",ground:"💧🌾💧🌾💧🌾💧🌾",items:["🌾","💧","🪷","🌼"],name:"小鴨湖"},
  lamb:{bg:"linear-gradient(180deg,#D8F8FF 0%,#E8F5E9 50%,#BEE6A8 100%)",ground:"🌱🌼🌱🌼🌱🌼🌱🌼",items:["🌼","☁️","🌿","🌷"],name:"柔軟草原"},
  panda:{bg:"linear-gradient(180deg,#E1F5E1 0%,#C8E6C9 50%,#A5D6A7 100%)",ground:"🎋🎋🎋🎋🎋🎋🎋🎋",items:["🎋","🍃","🌿","⛰️"],name:"竹林"},
  koala:{bg:"linear-gradient(180deg,#FFF3E0 0%,#FFE0B2 50%,#BCAAA4 100%)",ground:"🌳🌳🌳🌳🌳🌳🌳🌳",items:["🌿","🍃","☀️","🌳"],name:"尤加利樹林"},
  fox:{bg:"linear-gradient(180deg,#FFE0B2 0%,#FFCC80 50%,#D7CCC8 100%)",ground:"🍂🍂🍂🍂🍂🍂🍂🍂",items:["🍂","🍄","🌰","🦊"],name:"秋天森林"},
  owl:{bg:"linear-gradient(180deg,#1A237E 0%,#3949AB 50%,#5C6BC0 100%)",ground:"🌳🌲🌳🌲🌳🌲🌳🌲",items:["🌙","⭐","🦇","🪐"],name:"夜空"},
  penguin:{bg:"linear-gradient(180deg,#B3E5FC 0%,#81D4FA 50%,#E1F5FE 100%)",ground:"❄️❄️❄️❄️❄️❄️❄️❄️",items:["🧊","❄️","🐟","⛄"],name:"冰原"},
  deer:{bg:"linear-gradient(180deg,#DFF7E4 0%,#B8DFB4 50%,#7AA56D 100%)",ground:"🌲🌿🌲🌿🌲🌿🌲🌿",items:["🍃","🌿","🌰","🌳"],name:"寧靜森林"},
  seal:{bg:"linear-gradient(180deg,#D8F3FF 0%,#A8D8F0 50%,#E9F8FF 100%)",ground:"🧊❄️🧊❄️🧊❄️🧊❄️",items:["🐟","🧊","❄️","🌊"],name:"冰海岸"},
  parrot:{bg:"linear-gradient(180deg,#C8F7DC 0%,#8CD67E 50%,#3C8D57 100%)",ground:"🌴🌿🌴🌿🌴🌿🌴🌿",items:["🌺","🍌","🌴","🪶"],name:"熱帶樹屋"},
  squirrel:{bg:"linear-gradient(180deg,#FFE8C2 0%,#D8A15D 50%,#8B5E34 100%)",ground:"🍂🌰🍂🌰🍂🌰🍂🌰",items:["🌰","🍄","🍂","🌳"],name:"堅果森林"},
  unicorn:{bg:"linear-gradient(180deg,#FFD1DC 0%,#E1BEE7 50%,#B39DDB 100%)",ground:"🌈🌈🌈🌈🌈🌈🌈🌈",items:["⭐","✨","🌈","💫"],name:"彩虹國度"},
  dragon:{bg:"linear-gradient(180deg,#FF6F00 0%,#D84315 50%,#BF360C 100%)",ground:"🔥🔥🔥🔥🔥🔥🔥🔥",items:["🔥","⚔️","💎","🏔️"],name:"火山洞穴"},
  whale:{bg:"linear-gradient(180deg,#01579B 0%,#0288D1 50%,#4FC3F7 100%)",ground:"🌊🌊🌊🌊🌊🌊🌊🌊",items:["🐚","🐠","🪸","🌊"],name:"深藍海洋"},
  pegasus:{bg:"linear-gradient(180deg,#DFF3FF 0%,#E9D8FF 50%,#B6C7FF 100%)",ground:"☁️☁️☁️☁️☁️☁️☁️☁️",items:["☁️","✨","🌈","🪽"],name:"雲端牧場"},
  griffin:{bg:"linear-gradient(180deg,#2F3A56 0%,#6B5B45 50%,#B88A44 100%)",ground:"⛰️⛰️⛰️⛰️⛰️⛰️⛰️⛰️",items:["🪶","⚔️","💎","🌟"],name:"高山神殿"},
  seaotter:{bg:"linear-gradient(180deg,#006D8F 0%,#20A4B8 50%,#7BDDE2 100%)",ground:"🌊🪸🌊🪸🌊🪸🌊🪸",items:["🐚","🪸","🌊","🦪"],name:"海草森林"},
  phoenix:{bg:"linear-gradient(180deg,#FFD700 0%,#FF8F00 50%,#E65100 100%)",ground:"🔥🔥🔥🔥🔥🔥🔥🔥",items:["🔥","⚡","✨","☀️"],name:"火焰聖地"},
  celestial:{bg:"linear-gradient(180deg,#4A148C 0%,#7B1FA2 50%,#9C27B0 100%)",ground:"✨✨✨✨✨✨✨✨",items:["✨","💫","⭐","🌟"],name:"神聖空間"},
  moonlion:{bg:"linear-gradient(180deg,#111827 0%,#26345C 50%,#6B7280 100%)",ground:"🌙✨🌙✨🌙✨🌙✨",items:["🌙","✨","🪐","⭐"],name:"月光王座"},
  aurorafox:{bg:"linear-gradient(180deg,#0B1736 0%,#1F7A8C 45%,#A7F3D0 100%)",ground:"❄️✨❄️✨❄️✨❄️✨",items:["✨","🌌","❄️","💫"],name:"極光雪原"},
};

const PET_VARIANT_BASE={
  hamster:"bunny",turtle:"froggy",duckling:"chick",lamb:"bunny",
  deer:"fox",seal:"penguin",parrot:"chick",squirrel:"fox",
  pegasus:"unicorn",griffin:"phoenix",seaotter:"whale",
  moonlion:"celestial",aurorafox:"fox",
};

// Random happy sayings (shown as speech bubbles)
const PET_SAYINGS=["Hello!","Love you!","Play with me!","I'm hungry...","Thank you!","I'm happy!","Good friend!","English is fun!","Teach me more!","Cuddle time!"];

// ═══ PETS GUARD (登入/註冊守門) ══════════════════════════════════════
function PetsGuard(props){
  const{c,petAccount,setPetAccount,setPets,setEggs,setInventory,setCoins,pets,eggs,inventory,coins}=props;
  const[mode,setMode]=useState(petAccount?"in":"welcome");// welcome | login | signup | in
  const[username,setUsername]=useState("");
  const[pin,setPin]=useState("");
  const[pin2,setPin2]=useState("");
  const[err,setErr]=useState("");
  const[loading,setLoading]=useState(false);
  const[mergeChoice,setMergeChoice]=useState(null);// for login conflict

  // If already logged in, show pets page directly
  if(mode==="in"&&petAccount){return<PetsPage {...props}/>}

  const doLogin=async()=>{
    setErr("");setLoading(true);
    const r=await petCloudLogin(username,pin);
    setLoading(false);
    if(!r.ok){setErr(r.err);return}
    // Check if local has unsaved data that would be lost
    const cloudData=r.data;
    const hasLocalData=(pets.length>0||eggs.length>0||coins>0);
    const hasCloudData=(cloudData.pets?.length>0||cloudData.eggs?.length>0||cloudData.coins>0);
    const pinHash=await hashPin(pin);
    if(hasLocalData&&hasCloudData){
      // Conflict: ask user how to merge
      setMergeChoice({cloudData,pinHash});
      return;
    }
    // No conflict: load cloud data (or keep local if cloud empty)
    if(hasCloudData){
      setPets(cloudData.pets||[]);
      setEggs(cloudData.eggs||[]);
      setInventory(cloudData.inventory||{});
      setCoins(cloudData.coins||0);
    }
    // else: keep local data, will sync up
    setPetAccount({username:cloudData.username,pinHash,lastSync:new Date().toISOString()});
    playSound("done");
    setMode("in");
  };

  const resolveMerge=(choice)=>{
    if(!mergeChoice)return;
    const{cloudData,pinHash}=mergeChoice;
    if(choice==="cloud"){
      setPets(cloudData.pets||[]);
      setEggs(cloudData.eggs||[]);
      setInventory(cloudData.inventory||{});
      setCoins(cloudData.coins||0);
    }else if(choice==="local"){
      // Keep local, will push up via auto-sync
    }else if(choice==="merge"){
      // Merge pets by petId (keep higher level/exp), sum coins
      const byId={};
      [...(cloudData.pets||[]),...pets].forEach(p=>{
        const ex=byId[p.petId];
        if(!ex||(p.level||1)>ex.level||((p.level||1)===ex.level&&(p.exp||0)>(ex.exp||0))){
          byId[p.petId]=p;
        }
      });
      setPets(Object.values(byId));
      // Merge eggs (keep all unique)
      const eggsById={};
      [...(cloudData.eggs||[]),...eggs].forEach(e=>{eggsById[e.id]=e});
      setEggs(Object.values(eggsById));
      // Sum inventory
      const inv={...(cloudData.inventory||{})};
      Object.keys(inventory).forEach(k=>{inv[k]=(inv[k]||0)+(inventory[k]||0)});
      setInventory(inv);
      setCoins((cloudData.coins||0)+coins);
    }
    setPetAccount({username:mergeChoice.cloudData.username,pinHash,lastSync:new Date().toISOString()});
    setMergeChoice(null);
    playSound("done");
    setMode("in");
  };

  const doSignup=async()=>{
    setErr("");
    if(pin!==pin2){setErr("兩次 PIN 不一致");return}
    setLoading(true);
    // Upload existing local pets/eggs/inventory/coins to preserve them
    const r=await petCloudSignup(username,pin,{pets,eggs,inventory,coins});
    setLoading(false);
    if(!r.ok){setErr(r.err);return}
    const pinHash=await hashPin(pin);
    setPetAccount({username:r.data.username,pinHash,lastSync:new Date().toISOString()});
    playSound("done");
    setMode("in");
  };

  // Merge conflict dialog
  if(mergeChoice){
    const cloud=mergeChoice.cloudData;
    return(<div><Hdr t="⚠️ 資料衝突" onBack={()=>setMergeChoice(null)} cl={c.cl}/>
      <div style={{...S.card,padding:"20px"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:48}}>⚠️</div>
          <div style={{fontSize:16,fontWeight:700,color:S.t1,marginTop:8}}>本機和雲端都有寵物資料</div>
          <div style={{fontSize:13,color:S.t2,marginTop:4}}>請選擇要如何處理</div>
        </div>

        {/* Comparison table */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          <div style={{...S.card,padding:"12px",textAlign:"center",background:S.bg2}}>
            <div style={{fontSize:13,fontWeight:700,color:S.t1,marginBottom:6}}>📱 本機</div>
            <div style={{fontSize:11,color:S.t2,lineHeight:1.8}}>
              🐾 {pets.length} 隻寵物<br/>
              🥚 {eggs.length} 顆蛋<br/>
              🪙 {coins} 金幣
            </div>
          </div>
          <div style={{...S.card,padding:"12px",textAlign:"center",background:c.bg}}>
            <div style={{fontSize:13,fontWeight:700,color:S.t1,marginBottom:6}}>☁️ 雲端</div>
            <div style={{fontSize:11,color:S.t2,lineHeight:1.8}}>
              🐾 {(cloud.pets||[]).length} 隻寵物<br/>
              🥚 {(cloud.eggs||[]).length} 顆蛋<br/>
              🪙 {cloud.coins||0} 金幣
            </div>
          </div>
        </div>

        <button onClick={()=>resolveMerge("merge")} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:14,marginBottom:8}}>✨ 合併（推薦）<div style={{fontSize:11,opacity:.9,marginTop:2}}>保留所有寵物和蛋，金幣相加</div></button>
        <button onClick={()=>resolveMerge("cloud")} style={{...S.btn,background:S.bg2,color:S.t1,width:"100%",padding:"12px",fontSize:13,marginBottom:8}}>☁️ 只用雲端資料（本機會清空）</button>
        <button onClick={()=>resolveMerge("local")} style={{...S.btn,background:S.bg2,color:S.t1,width:"100%",padding:"12px",fontSize:13}}>📱 只用本機資料（雲端會覆蓋）</button>
      </div>
    </div>);
  }

  // Welcome screen
  if(mode==="welcome"){
    return(<div><Hdr t="🐾 寵物樂園" onBack={props.onBack} cl={c.cl}/>
      <div style={{...S.card,padding:"32px 24px",textAlign:"center",background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
        <div style={{fontSize:64,marginBottom:12,animation:"emojiBounce 1.5s ease-in-out infinite"}}>🐾</div>
        <div style={{fontSize:22,fontWeight:700,color:S.t1,marginBottom:8}}>歡迎來到寵物樂園！</div>
        <div style={{fontSize:14,color:S.t2,lineHeight:1.8,marginBottom:20}}>
          建立小帳號讓寵物跨裝置同步<br/>
          在手機、平板都能看到你的寵物！
        </div>
        <div style={{...S.card,padding:"14px",marginBottom:16,background:"#FFF3CD",border:"1px solid #EF9F27",textAlign:"left"}}>
          <div style={{fontSize:13,fontWeight:600,color:"#856404",marginBottom:6}}>💡 關於小帳號</div>
          <div style={{fontSize:12,color:"#856404",lineHeight:1.8}}>
            • 只要「暱稱」+「4-6 位 PIN」<br/>
            • <b>不需要 Email 也不用密碼</b><br/>
            • 只有寵物資料會上雲端<br/>
            • 其他功能（單字卡、遊戲）繼續免登入
          </div>
        </div>
        <button onClick={()=>{setMode("signup");setUsername("");setPin("");setPin2("");setErr("")}} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:15,marginBottom:8}}>✨ 建立新帳號</button>
        <button onClick={()=>{setMode("login");setUsername("");setPin("");setErr("")}} style={{...S.btn,background:S.bg2,color:S.t1,width:"100%",padding:"14px",fontSize:14}}>🔑 已有帳號？登入</button>
      </div>
    </div>);
  }

  // Signup form
  if(mode==="signup"){
    return(<div><Hdr t="✨ 建立新帳號" onBack={()=>setMode("welcome")} cl={c.cl}/>
      <div style={{...S.card,padding:"24px 20px"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:48}}>🐾</div>
          <div style={{fontSize:14,color:S.t2,marginTop:8}}>取個好記的暱稱吧！</div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>📛 暱稱（2-20 字）</label>
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="例如：小明、貓咪控" maxLength={20} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:16,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>🔢 設定 PIN（4-6 位數字）</label>
          <input value={pin} onChange={e=>setPin(e.target.value.replace(/\\D/g,"").slice(0,6))} placeholder="輸入 4-6 位數字" type="tel" inputMode="numeric" maxLength={6} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:20,fontFamily:"monospace",letterSpacing:4,textAlign:"center",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>🔢 再輸入一次 PIN</label>
          <input value={pin2} onChange={e=>setPin2(e.target.value.replace(/\\D/g,"").slice(0,6))} placeholder="再輸入一次確認" type="tel" inputMode="numeric" maxLength={6} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:20,fontFamily:"monospace",letterSpacing:4,textAlign:"center",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        {err&&<div style={{padding:"10px 14px",background:"#FCEBEB",border:"1px solid #E24B4A",borderRadius:10,color:"#A32D2D",fontSize:13,marginBottom:12,textAlign:"center",fontWeight:600}}>❌ {err}</div>}

        {/* Local data preview */}
        {(pets.length>0||eggs.length>0||coins>0)&&<div style={{padding:"10px 14px",background:"#E1F5EE",border:"1px solid #1D9E75",borderRadius:10,fontSize:12,color:"#0F6E56",marginBottom:12,lineHeight:1.7}}>
          ✅ 你目前的本機資料會一起上傳：🐾 {pets.length} 寵物 · 🥚 {eggs.length} 蛋 · 🪙 {coins} 金幣
        </div>}

        <button onClick={doSignup} disabled={loading||!username.trim()||!pin||!pin2} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:15,opacity:(loading||!username.trim()||!pin||!pin2)?.4:1}}>{loading?"建立中...":"✨ 建立帳號"}</button>

        <div style={{...S.card,padding:"12px",marginTop:16,fontSize:12,color:S.t2,lineHeight:1.7,background:"#FFF3CD",border:"1px solid #EF9F27"}}>
          ⚠️ <b>請記住你的暱稱和 PIN！</b><br/>
          忘記就無法找回寵物了（沒有 Email 備援）
        </div>
      </div>
    </div>);
  }

  // Login form
  if(mode==="login"){
    return(<div><Hdr t="🔑 登入帳號" onBack={()=>setMode("welcome")} cl={c.cl}/>
      <div style={{...S.card,padding:"24px 20px"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:48}}>🔑</div>
          <div style={{fontSize:14,color:S.t2,marginTop:8}}>輸入你的暱稱和 PIN</div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>📛 暱稱</label>
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="你之前建立的暱稱" maxLength={20} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:16,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:S.t1,display:"block",marginBottom:6}}>🔢 PIN</label>
          <input value={pin} onChange={e=>setPin(e.target.value.replace(/\\D/g,"").slice(0,6))} placeholder="4-6 位數字" type="tel" inputMode="numeric" maxLength={6} onKeyDown={e=>{if(e.key==="Enter")doLogin()}} style={{width:"100%",padding:"14px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:20,fontFamily:"monospace",letterSpacing:4,textAlign:"center",background:S.bg1,color:S.t1,outline:"none",boxSizing:"border-box"}}/>
        </div>

        {err&&<div style={{padding:"10px 14px",background:"#FCEBEB",border:"1px solid #E24B4A",borderRadius:10,color:"#A32D2D",fontSize:13,marginBottom:12,textAlign:"center",fontWeight:600}}>❌ {err}</div>}

        <button onClick={doLogin} disabled={loading||!username.trim()||!pin} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:15,opacity:(loading||!username.trim()||!pin)?.4:1}}>{loading?"登入中...":"🔑 登入"}</button>
      </div>
    </div>);
  }

  return null;
}


// ═══ PIXEL PET SYSTEM (像素風寵物 - Tamagotchi 風格) ═══════════════════
// Each pet has 4 growth stage sprites encoded as 16x14 character grids
// Characters map to colors (see PIXEL_COLORS). '.' means transparent.

const PIXEL_COLORS={
  '.':'transparent',
  '_':'#2c2c2a',  // black outline
  '#':'#2c2c2a',  // black
  'W':'#FFF8F0',  // white
  'B':'#ffffff',  // bright white
  'Y':'#FFE066',  // yellow
  'o':'#FFD700',  // gold
  'O':'#FFA500',  // orange
  'R':'#FF6B6B',  // red
  'P':'#FFC8D0',  // pink
  'p':'#FF9BB3',  // deep pink
  'n':'#FFB6C1',  // nose pink
  'c':'#E8D4F2',  // light purple
  'C':'#B794F4',  // purple
  'v':'#9D7BD8',  // dark purple
  'G':'#7FD1AE',  // green
  'g':'#4A9B7F',  // dark green
  'L':'#C5E8D1',  // light green
  'S':'#7EE8FA',  // sky cyan
  's':'#4A90E2',  // blue
  'I':'#2458A8',  // dark blue
  'T':'#D2B48C',  // tan
  't':'#A0522D',  // brown
  'M':'#5D3317',  // dark brown
  'K':'#E8E8E8',  // gray
  'k':'#A8A8A8',  // dark gray
  'E':'#FFE8D6',  // egg light
  'e':'#FFD4B0',  // egg mid
  'd':'#FFB48A',  // egg dark
  'F':'#FF8A00',  // flame orange
  'f':'#DC143C',  // flame red
  'x':'#C41E00',  // dark red
};

// Shared egg sprite (used for all pets in egg stage, with color variations later)
const EGG_SPRITE=[
  '......EEEE......',
  '....EEDDDDEE....',
  '...EDDDDDDDDE...',
  '..EDDDdDDDDDDE..',
  '..EDDdddDDDDDE..',
  '..DDDdddDDDDDD..',
  '.DDDdddddDDDDDD.',
  '.DDdddddddDDDD.',
  '.DdddddddddddDD.',
  '.DdddddddddddDD.',
  '..DdddddddddDDD.',
  '..DDDdddddDDDD..',
  '...DDDdddDDDD...',
  '....DDDDDDD.....',
];

// Pet sprites: each pet has {baby, adult, evolved} stages. All 16x14 grid.
const PIXEL_PETS={
  bunny:{
    baby:[
      '..WW........WW..',
      '.WPW........WPW.',
      '.WPW........WPW.',
      '.WWWWWWWWWWWWWW.',
      '.WWW_WWWW_WWWWW.',
      'WWWW_WWnn_WWWWWW',
      'WPWWWWWnnnWWWPW.',
      '.WWWWWW##WWWWWW.',
      '..WWWWWWWWWWWWW.',
      '..WW.WWWW.WW....',
      '..WW.WWWW.WW....',
      '................',
      '................',
      '................',
    ],
    adult:[
      'WW...........WW.',
      'WPW.........WPW.',
      'WPW.........WPW.',
      'WPW.........WPW.',
      'WWWWWWWWWWWWWW..',
      'WWWW_WWWW_WWWW..',
      'WWWW_WWnn_WWWW..',
      'WWWWWWnnnnnWWWW.',
      'WPWWWWW###WWWWPW',
      '.WWWWWWWWWWWWWW.',
      '.WWWWWWWWWWWWWW.',
      '.WWWWWWWWWWWWWW.',
      '.WW..WWWWWW..WW.',
      '.WW..WWWWWW..WW.',
    ],
    evolved:[
      '....o.o.o.o.....',
      '.WWooooooooooWW.',
      'WPW.........WPW.',
      'WPW.........WPW.',
      'WWWWWWWWWWWWWW..',
      'WWWW_SWWWS_WWWW.',
      'WWWW_WnnnnW_WWW.',
      'WWWWWWnnnnnWWWW.',
      'WPWWWWW###WWWWPW',
      '.WWWWWWWWWWWWWW.',
      '.WWWWWWWWWWWWWW.',
      '.WWWWWWWWWWWWWW.',
      '.WW..WWWWWW..WW.',
      '.WW..WWWWWW..WW.',
    ],
  },
  chick:{
    baby:[
      '................',
      '.....YYYYYY.....',
      '....YYYYYYYY....',
      '...YY_YYYY_YY...',
      '...YYY_YY_YYY...',
      '...YYYYOOYYYY...',
      '....YYYYYYYY....',
      '...YYYYYYYYYY...',
      '..YYYYYYYYYYYY..',
      '..YYYYYYYYYYYY..',
      '..YYYYYYYYYYYY..',
      '...YYYYYYYYYY...',
      '....OO....OO....',
      '....OO....OO....',
    ],
    adult:[
      '.......Y........',
      '....YYYYYYYY....',
      '...YYYYYYYYYY...',
      '..YY_YYYYYY_YY..',
      '..YYY_YYYY_YYY..',
      '..YYYYOOOOYYYY..',
      '..YYYYYOOYYYYY..',
      '.YYYYYYYYYYYYY..',
      'YYYYYYYYYYYYYYYY',
      'YYYYYYYYYYYYYYYY',
      'YYYYYYYYYYYYYYYY',
      '.YYYYYYYYYYYYYY.',
      '..OO........OO..',
      '..OO........OO..',
    ],
    evolved:[
      '....ooooooo.....',
      '...oYYYYYYYo....',
      '..oYYYYYYYYYo...',
      '.YY_YYYYYY_YY...',
      '.YYY_YYYY_YYY...',
      '.YYYYOOOOYYYY...',
      '.YYYYYOOYYYYY...',
      'YYYYYYYYYYYYYY..',
      'YYYYYoYYYYoYYYY.',
      'YYYYYYYYYYYYYYYY',
      'YYYYYYYYYYYYYYYY',
      '.YYYYYYYYYYYYYY.',
      '..OO........OO..',
      '..OO........OO..',
    ],
  },
  puppy:{
    baby:[
      '..tt........tt..',
      '.tttt......tttt.',
      '.ttTT......TTtt.',
      '..TTTTTTTTTTTT..',
      '.TTTTTTTTTTTTTT.',
      'TTTT_TTTT_TTTTTT',
      'TTTT_TT##_TTTTTT',
      '.TTTTT####TTTTT.',
      '.TTTTTTTTTTTTTT.',
      '..TTTTTTTTTTTT..',
      '..TT..TTTT..TT..',
      '..TT..TTTT..TT..',
      '................',
      '................',
    ],
    adult:[
      '..tt..........tt',
      '.tttt........ttt',
      '.ttTT........TTt',
      '.TTTTTTTTTTTTTT.',
      'TTTTTTTTTTTTTTTT',
      'TTTT_TTTT_TTTTTT',
      'TTTT_TT##_TTTTTT',
      'TTTTTT####TTTTTT',
      'TTTTTTTTTTTTTTT.',
      'TTTTTTTTTTTTTTT.',
      '.TTTTTTTTTTTTTT.',
      '.TT...TTTT...TT.',
      '.TT...TTTT...TT.',
      '................',
    ],
    evolved:[
      '....o.o.o.......',
      '.ttoooooootttttt',
      '.tttt........ttt',
      '.ttTT........TTt',
      '.TTTTTTTTTTTTTT.',
      'TTTTSSTTTTSSTTTT',
      'TTTT_TTTT_TTTTTT',
      'TTTT_TT##_TTTTTT',
      'TTTTTT####TTTTTT',
      'TTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTT',
      '.TTTTTTTTTTTTTT.',
      '.TT...TTTT...TT.',
      '.TT...TTTT...TT.',
    ],
  },
  kitty:{
    baby:[
      '.KK..........KK.',
      'KKKK........KKKK',
      'KPKK........KKPK',
      '.KKKKKKKKKKKKKK.',
      '.KKKK_KKKK_KKKK.',
      'KKKKK_KnnnKKKKKK',
      'KKKKKKKnnKKKKKKK',
      '_KKKKKKK##KKKKK_',
      '.KKKKKKKKKKKKKK.',
      '..KKKKKKKKKKKK..',
      '..KKKKKKKKKKKK..',
      '..KK..KKKK..KK..',
      '..KK..KKKK..KK..',
      '................',
    ],
    adult:[
      '.KK..........KK.',
      'KKKK........KKKK',
      'KPKK........KKPK',
      '.KKKKKKKKKKKKKK.',
      '.KKKK_KKKK_KKKK.',
      'KKKKK_KnnnKKKKKK',
      '_KKKKKKK##KKKKK_',
      'KKKKKKKKKKKKKKKK',
      'KKKKKKKKKKKKKKKK',
      '.KKKKKKKKKKKKKK.',
      '.KKKKKKKKKKKKKK.',
      '.KK..KKKKKK..KK.',
      '.KK..KKKKKK..KK.',
      '...........KKK..',
    ],
    evolved:[
      '....o.o.o.......',
      '.KKoooooooooKKK.',
      'KPKK........KKPK',
      '.KKKKKKKKKKKKKK.',
      '.KKKS_KKKK_SKKK.',
      'KKKKK_KnnnKKKKKK',
      '_KKKKKKK##KKKKK_',
      'KKKKKKKKKKKKKKKK',
      'KKKKKKKKKKKKKKKK',
      '.KKKKKKKKKKKKKK.',
      '.KKKKKKKKKKKKKK.',
      '.KK..KKKKKK..KK.',
      '.KK..KKKKKK..KK.',
      '...........KKKK.',
    ],
  },
  piggy:{
    baby:[
      '..PP........PP..',
      '.PPpP........PPp',
      '.PPPPPPPPPPPPPP.',
      '.PPP_PPPP_PPPPP.',
      'PPPPP_PPPP_PPPPP',
      'PPPPPppnnppPPPPP',
      'PPPPP#pnnp#PPPPP',
      'PPPPPPP##PPPPPPP',
      '.PPPPPPPPPPPPPP.',
      '..PPPPPPPPPPPP..',
      '..PP..PPPP..PP..',
      '..PP..PPPP..PP..',
      '................',
      '................',
    ],
    adult:[
      '..PP........PP..',
      '.PPpP........PPp',
      '.PPPPPPPPPPPPPP.',
      '.PPPP_PPPP_PPPP.',
      'PPPPP_PPPP_PPPPP',
      'PPPPPppnnppPPPPP',
      'PPPPP#pnnp#PPPPP',
      'PPPPPPP##PPPPPPP',
      'PPPPPPPPPPPPPPPP',
      '.PPPPPPPPPPPPPP.',
      '.PPPPPPPPPPPPPP.',
      '.PP..PPPPPP..PP.',
      '.PP..PPPPPP..PP.',
      '................',
    ],
    evolved:[
      '....o.o.o.o.....',
      '.PPoooooooooopPP',
      '.PPPPPPPPPPPPPP.',
      '.PPPS_PPPP_SPPP.',
      'PPPPP_PPPP_PPPPP',
      'PPPPPppnnppPPPPP',
      'PPPPP#pnnp#PPPPP',
      'PPPPPPP##PPPPPPP',
      'PPPPPPPPPPPPPPPP',
      '.PPPPPPPPPPPPPP.',
      '.PPPPPPPPPPPPPP.',
      '.PP..PPPPPP..PP.',
      '.PP..PPPPPP..PP.',
      '................',
    ],
  },
  froggy:{
    baby:[
      '................',
      '....gg....gg....',
      '..GGGgGGGGgGGG..',
      '.GGGG_GGGG_GGGG.',
      '.GGGGGGGGGGGGGG.',
      'GGGGGGGGGGGGGGGG',
      'GGGGGG####GGGGGG',
      'GGGGG######GGGGG',
      'GGGGGGGGGGGGGGGG',
      '.GGGGGGGGGGGGGG.',
      '.gGGGGGGGGGGGGg.',
      'gg...gGGGGg...gg',
      '................',
      '................',
    ],
    adult:[
      '................',
      '....BB....BB....',
      '...BWWB..BWWB...',
      '...B_WB..BW_B...',
      '..GGGGGGGGGGGG..',
      'GGGGGGGGGGGGGGGG',
      'GGGGGGGGGGGGGGGG',
      'GGGGG######GGGGG',
      'GGGGGGGGGGGGGGGG',
      '.GGGGGGGGGGGGGG.',
      '.GGGGGGGGGGGGGG.',
      'gGGGGgGGGGgGGGGg',
      'gg...gGGGGg...gg',
      '................',
    ],
    evolved:[
      '....o.o.o.o.....',
      '.BBoooooooooBB..',
      '..BWWB..BWWB....',
      '..B_WB..BW_B....',
      '.GGGGGGGGGGGGGG.',
      'GGGGGGGGGGGGGGGG',
      'GGGGGSSSSSSSGGGG',
      'GGGGG######GGGGG',
      'GGGGGGGGGGGGGGGG',
      '.GGGGGGGGGGGGGG.',
      '.GGGGGGGGGGGGGG.',
      'gGGGGgGGGGgGGGGg',
      'gg...gGGGGg...gg',
      '................',
    ],
  },
  panda:{
    baby:[
      '..##........##..',
      '.####......####.',
      '..WWWWWWWWWWWW..',
      '.WWWWWWWWWWWWWW.',
      'W###WWWWWW###WWW',
      'W#W#WWWWWW#W#WWW',
      'W###WW##WW###WWW',
      'WWWW########WWWW',
      '.WWWWW####WWWWW.',
      '.WW##WWWW##WWWW.',
      '.WW##WWWW##WWWW.',
      '.WW##WWWW##WWWW.',
      '.WW..##WW..WW...',
      '................',
    ],
    adult:[
      '.##..........##.',
      '####........####',
      '.#WWWWWWWWWWWW#.',
      'WWWWWWWWWWWWWWWW',
      '###WWWWWWWW###WW',
      '#W#WWWWWWWW#W#WW',
      '###WW####W####WW',
      'WWWW########WWWW',
      'WWWWWW####WWWWWW',
      '#WWWWWWWWWWWWWW#',
      '#WWWWWWWWWWWWWW#',
      '##WWWWWWWWWWWW##',
      '##.#WWWWWW#.##.',
      '##.#WWWWWW#.##.',
    ],
    evolved:[
      '##..o.o.o.o...##',
      '####oooooooo####',
      '.#WWWWWWWWWWWW#.',
      'WWWWWWWWWWWWWWWW',
      '###WWSSSSSSW###W',
      '#W#WSWWWWWWS#W#W',
      '###WW####W####WW',
      'WWWW########WWWW',
      'WWWWWW####WWWWWW',
      '#WWWWWWWWWWWWWW#',
      '#WWWWWWWWWWWWWW#',
      '##WWWWWWWWWWWW##',
      '##.#WWWWWW#.##..',
      '##.#WWWWWW#.##..',
    ],
  },
  koala:{
    baby:[
      'kkk..........kkk',
      'kKKk........kKKk',
      'KKWW........WWKK',
      'KKKKKKKKKKKKKKKK',
      'KKKK_KKKKK_KKKKK',
      'KKKK_KK##K_KKKKK',
      'KKKKKK####KKKKKK',
      'KKKKKKK##KKKKKKK',
      '.KKKKKKKKKKKKKK.',
      '.KKKKKKKKKKKKKK.',
      '..KK.KKKKKK.KK..',
      '..KK.KKKKKK.KK..',
      '................',
      '................',
    ],
    adult:[
      'kkk..........kkk',
      'kKKk........kKKk',
      'KKWW........WWKK',
      'KKKKKKKKKKKKKKKK',
      'KKKK_KKKKK_KKKKK',
      'KKKK_KK##K_KKKKK',
      'KKKKKK####KKKKKK',
      'KKKKKKK##KKKKKKK',
      'KKKKKKKKKKKKKKKK',
      '.KKKKKKKKKKKKKK.',
      '.KKKKKKKKKKKKKK.',
      '.KK..KKKKKK..KK.',
      '.KK..KKKKKK..KK.',
      '................',
    ],
    evolved:[
      'kkk.o.o.o.o..kkk',
      'kKKkooooooookKKk',
      'KKWW........WWKK',
      'KKKKKKKKKKKKKKKK',
      'KKKKS_KKKKK_SKKK',
      'KKKK_KK##K_KKKKK',
      'KKKKKK####KKKKKK',
      'KKKKKKK##KKKKKKK',
      'KKKKKKKKKKKKKKKK',
      '.KKKKKKKKKKKKKK.',
      '.KKKKKKKKKKKKKK.',
      '.KK..KKKKKK..KK.',
      '.KK..KKKKKK..KK.',
      '................',
    ],
  },
  fox:{
    baby:[
      '.OO..........OO.',
      'OOOO........OOOO',
      'OWWO........OWWO',
      '.OOOOOOOOOOOOOO.',
      '.OOOO_OOOO_OOOO.',
      'OOOOO_OO##_OOOOO',
      'WWWWWWWW##WWWWWW',
      'WWWWWWWW##WWWWWW',
      'WWWWWWWWWWWWWWWW',
      '.WWWWWWWWWWWWWW.',
      '.OO..OOOOOO..OO.',
      '................',
      '................',
      '................',
    ],
    adult:[
      'OO...........OO.',
      'OOOO........OOOO',
      'OWWO........OWWO',
      '.OOOOOOOOOOOOOO.',
      '.OOOO_OOOO_OOOO.',
      'OOOOO_OO##_OOOOO',
      'WWWWWWWW##WWWWWWO',
      'WWWWWWWW##WWWWWWO',
      'WWWWWWWWWWWWWWWO',
      'WWWWWWWWWWWWWWWO',
      '.WWWWWWWWWWWWWWO',
      '.OO..OOOOOO..OOW',
      '.OO..OOOOOO..OOW',
      '............OOWW',
    ],
    evolved:[
      'OO..o.o.o.o..OO.',
      'OOoooooooooooOOO',
      'OWWo.........WWO',
      '.OOOOOOOOOOOOOO.',
      '.OOOSSOOOOOOSSO.',
      'OOOOO_OO##_OOOOO',
      'WWWWWWWW##WWWWWWO',
      'WWWWWWWW##WWWWWWO',
      'WWWWWWWWWWWWWWWO',
      '.WWWWWWWWWWWWWWO',
      '.OO..OOOOOO..OOW',
      '.OO..OOOOOO..OOW',
      '............OOWW',
      '................',
    ],
  },
  owl:{
    baby:[
      '.tt..........tt.',
      'tMtt........tMtt',
      'ttttttttttttttt.',
      'ttBBBBBttBBBBBtt',
      'ttBYYBBttBBYYBtt',
      'ttBY_BBttBB_YBtt',
      'tttBBBttttBBBttt',
      'ttttttOOOOttttt.',
      'ttttttttttttttt.',
      '.ttttttttttttt..',
      '.ttt.ttttttt.tt.',
      '..O..........O..',
      '..O..........O..',
      '................',
    ],
    adult:[
      '.tt..........tt.',
      'tMtt........tMtt',
      'tttttttttttttttM',
      'tBBBBBttttBBBBBt',
      'tBYYBBttttBBYYBt',
      'tBY_BBttttBB_YBt',
      'ttBBBtttttttBBBt',
      'tttttOOOOOOOttttM',
      'tttttttttttttttM',
      'ttttttttttttttt.',
      '.ttttttttttttt..',
      '..OOOO....OOOO..',
      '..OOOO....OOOO..',
      '................',
    ],
    evolved:[
      'tt..o.o.o.o..tt.',
      'tMtooooooooootMt',
      'tBBBBBSSttBBBBBt',
      'tBYYBBttttBBYYBt',
      'tBYoBBttttBBoYBt',
      'tBY_BBttttBB_YBt',
      'ttBBBtttttttBBBt',
      'tttttOOOOOOttttM',
      'tttttttttttttttM',
      'ttttttttttttttt.',
      '.ttttttttttttt..',
      '..OOOO....OOOO..',
      '..OOOO....OOOO..',
      '................',
    ],
  },
  penguin:{
    baby:[
      '....########....',
      '...###WWWW###...',
      '..###WWWWWW###..',
      '.###WW_WW_WW###.',
      '.##WW_WWWW_WW##.',
      '.##WWWWOOWWWWW##',
      '.##WWWWOOWWWWW##',
      '###WWWWWWWWWW###',
      '###WWWWWWWWWW###',
      '###WWWWWWWWWW###',
      '###WWWWWWWWWW###',
      '.##WWWWWWWWWW##.',
      '..OO........OO..',
      '..OO........OO..',
    ],
    adult:[
      '....########....',
      '...###WWWW###...',
      '..###WWWWWW###..',
      '.###WW_WW_WW###.',
      '.##WW_WWWW_WW##.',
      '.##WWWWOOWWWWW##',
      '##WWWWWWWWWWWW##',
      '##WWWWWWWWWWWW##',
      '##WWWWWWWWWWWW##',
      '##WWWWWWWWWWWW##',
      '##WWWWWWWWWWWW##',
      '##WWWWWWWWWWWW##',
      '.##WWWWWWWWWW##.',
      '..OO........OO..',
    ],
    evolved:[
      '....########....',
      '...#Sooooo#S...',
      '..###WWWWWW###..',
      '.###WW_WW_WW###.',
      '.##WW_WWWW_WW##.',
      '.##WWWWOOWWWWW##',
      '##WWWWWWWWWWWW##',
      '##WWWWWWWWWWWW##',
      '##WSWWWWWWWWSW##',
      '##WWWWWWWWWWWW##',
      '##WWWWWWWWWWWW##',
      '##WWWWWWWWWWWW##',
      '.##WWWWWWWWWW##.',
      '..OO........OO..',
    ],
  },
  unicorn:{
    baby:[
      '......ooo.......',
      '.....ooooo......',
      'WW...ooooo...WW.',
      'WPW..BBBBB..WPW.',
      'WPW.BBBBBBB.WPW.',
      'WWWWWWWWWWWWWW..',
      'WWWWC_WWWW_CWWW.',
      'WWWWW_WnnnWWWWW.',
      'WWWWWWWWWWWWWWS.',
      'WWCWWWWWWWWWSSW.',
      '.WWWWWWWWWWWWW..',
      '..WW.WWWWWW.WW..',
      '..WW.WWWWWW.WW..',
      '................',
    ],
    adult:[
      '......ooo.......',
      '.....ooooo......',
      'WW...ooooo...WW.',
      'WPW..BBBBB..WPW.',
      'WPW.BBBBBBB.WPW.',
      'WWWWWWWWWWWWWW..',
      'WWWWC_WWWW_CWWW.',
      'WWWWW_WnnnWWWWW.',
      'WWWWWWWWWWWWWWS.',
      'WWCWWWWWWWWWSSW.',
      '.WWWWWWWWWWWWW..',
      '..WW.WWWWWW.WW..',
      '..WW.WWWWWW.WW..',
      '...............W',
    ],
    evolved:[
      '......oRo.......',
      '.....oRORo......',
      'WW...oROoo...WW.',
      'WPW..CCSSC..WPW.',
      'WPW.CCSSCCC.WPW.',
      'WWWWWWWWWWWWWW..',
      'WWWWC_SSSS_CWWW.',
      'WWWWW_WnnnWWWWW.',
      'WWWWWWWWWWWWWWSS',
      'WWCWWWWWWWWWSSCW',
      'WWWWWWWWWWWWWWW.',
      '.WW.WWWWWWWW.WW.',
      '.WW.WWWWWWWW.WW.',
      '................',
    ],
  },
  dragon:{
    baby:[
      '..xf........xf..',
      '.xffx......xffx.',
      '.xffffffffffffx.',
      'xfffRRRRRRRRfffx',
      'xffRR_RRRR_RRffx',
      'xffRRoRRRRoRRffx',
      'xffRRRRooooRRRffx',
      'xffRRRRRooRRRffx',
      'xxffffffffffffxx',
      'xxffffffffffffxx',
      'x..xfffffxxxffx.',
      'xx.xfffffx.xffxx',
      '.x..xxxxxx..xx..',
      '................',
    ],
    adult:[
      '..xf........xf..',
      '.xffx......xffx.',
      'x..xffffffff.xxx',
      'xfffRRRRRRRRfffx',
      'xffRR_RRRR_RRffx',
      'xffRRoRRRRoRRffx',
      'xffRRRRooooRRRffx',
      'xffRRRR####RRRffx',
      'xxffffffffffffxx',
      'xxffffffffffffxx',
      'xffxffffffxxffx.',
      'xffx.fffff.xffx.',
      '.xx..xxxxxx..xx.',
      '................',
    ],
    evolved:[
      '.oxo.o.o.o.o.oxo',
      '.xffxooooooxffx.',
      '..xffffffffffxx.',
      'xfffRSSSSSSRfffx',
      'xffRR_RRRR_RRffx',
      'xffRRoRRRRoRRffx',
      'xffRRRRooooRRRffx',
      'xffRRRR####RRRffx',
      'xxffffffffffffxx',
      'xxffffffffffffxx',
      'xffxffffffxxffx.',
      'xffx.fffff.xffx.',
      '.xx..xxxxxx..xx.',
      '................',
    ],
  },
  whale:{
    baby:[
      '...SS...........',
      '....SSS.........',
      '.....sss........',
      '..IIsssssssssII.',
      '.IssssssssssssII',
      'IssSsssssssssssI',
      'IsSssssss#sssssI',
      'IssssssSssssss.I',
      'IssssssSsssssII.',
      '.IssssssssssII..',
      '..IIIIIIIIIII..I',
      '...........III..',
      '................',
      '................',
    ],
    adult:[
      '...SS.S.........',
      '....SSSS........',
      '.....sssS.......',
      '..IIsssssssssIII',
      '.IsssssssssssssI',
      'IssSssssssssssssI',
      'IsSssss#ssssssssI',
      'IssssssSssssssssI',
      'IssssssSsssssssII',
      '.IsssssssssssII..',
      '..IIIIIIIIIIII..I',
      '............III.',
      '................',
      '................',
    ],
    evolved:[
      '.o.SoSoS.oooo...',
      '..ooSSSS........',
      '.....sssSooo....',
      '..IIsssssssssIII',
      '.IsSSSsssssssssI',
      'IssSssssssssssssI',
      'IsSssss#ssssssssI',
      'IssssssSssssssssI',
      'IsSSSssSsssssssII',
      '.IsssssssssssII..',
      '..IIIIIIIIIIII..I',
      '............III.',
      '................',
      '................',
    ],
  },
  phoenix:{
    baby:[
      '......FFF.......',
      'F....FFOOOFF...F',
      'FF..FFOOROOFF.FF',
      'FFFFFOROOROFFFFFF',
      'FFFOOOO__OO_OOFFF',
      'FFOOO_OOOO_OOOOFF',
      'FFOOOOOnnOOOOOFFF',
      'FFOOOO####OOOOFFF',
      'FFFFOOOOOOOOFFFFF',
      'FFFFFFOOOOFFFFFFF',
      'FF.FFFOOOOFFF.FFF',
      'FF..FFFFFFFFF.FFF',
      '..FF..OOOO..FF..',
      '..FF........FF..',
    ],
    adult:[
      '.F....FFF....F..',
      'FF...FFOOOFF..FF',
      'FF..FFOOROOFF.FF',
      'FFFFOROOROFFFFFF',
      'FFFOOOO__OOOO_FFF',
      'FFOOO_OOOO_OOOOFF',
      'FFOOOOOnnOOOOOFFF',
      'FFOOOO####OOOOFFF',
      'FFFFOOOOOOOOFFFFF',
      'FFFFFFOOOOFFFFFFF',
      'FF.FFFOOOOFFF.FF.',
      'FF..FFFFFFFFF.FF.',
      '..FF..OOOO..FF..',
      '..FF........FF..',
    ],
    evolved:[
      'oFoooFoFFFoFooooF',
      'FFoooFFOOOFFooFFF',
      'FF..FFOOROOFF.FF.',
      'FFFFOROOROFFFFFF.',
      'FFFSoOO__OOSoFFFF',
      'FFOOO_OOOO_OOOOFF',
      'FFOOOSSnnSSOOOFFF',
      'FFOOOO####OOOOFFF',
      'FFFFSOOOOOOSFFFFF',
      'FFFFFFOOOOFFFFFFF',
      'FFoFFFOOOOFFF.FF.',
      'FFooFFFFFFFFFoFF.',
      '..FF..OOOO..FF..',
      '..FF........FF..',
    ],
  },
  celestial:{
    baby:[
      '.......o........',
      '......ooo.......',
      '.....ooCoo......',
      '....cCCCCCc.....',
      '...cCCSSSCCCc...',
      '..cCCCSSCSCCCCc.',
      '.cCCC_CCCC_CCCc.',
      '.cCCC_CCCC_CCCc.',
      '.cCCCCC__CCCCCc.',
      '..cCCCCCCCCCCc..',
      '...cCCCCCCCCc...',
      '....ccCCCCcc....',
      '.....cc..cc.....',
      '................',
    ],
    adult:[
      '.......o........',
      '......ooo.......',
      '...o.ooCoo.o....',
      '....cCCCCCc.....',
      '...cCCSSSCCCc...',
      '..cCCCSSCSCCCCc.',
      'o.cCCC_CCCC_CCCc.',
      '.cCCC_CCCC_CCCco',
      '.cCCCCC__CCCCCc.',
      'o.cCCCCCCCCCCc..',
      '...cCCCCCCCCc.o.',
      '....ccCCCCcc....',
      '.....cc..cc.....',
      '................',
    ],
    evolved:[
      '.o..o..o.o..o.o.',
      '.oo.oo.ooo.oo.o.',
      '...oooooCooooo..',
      '..cccCCCCCCCcc..',
      '..cCCSSSSSCCCcc.',
      '.cCCCSSCSCCCCCc.',
      'ocCCo_CCCC_oCCCco',
      'ocCCo_CCCC_oCCCco',
      '.cCCCCC__CCCCCc.',
      'o.cCCCCCCCCCCc.o',
      '..ccCCCCCCCCcc..',
      '...ccccCCCcccc..',
      '....cc....cc....',
      '.o.............o',
    ],
  },
};

// Render a pixel sprite
function PixelPet({petId,stage="adult",size=180,animate=true}){
  // Eggs use shared egg sprite with rarity-based tint
  if(stage==="egg")return(<PixelSprite grid={EGG_SPRITE} size={size} animate={animate}/>);
  const petData=PIXEL_PETS[petId]||PIXEL_PETS[PET_VARIANT_BASE[petId]];
  if(!petData)return(<PixelSprite grid={EGG_SPRITE} size={size} animate={animate}/>);
  const grid=petData[stage]||petData.adult;
  return(<PixelSprite grid={grid} size={size} animate={animate}/>);
}

function PixelSprite({grid,size=180,animate=true}){
  const cellSize=size/16;
  return(<div style={{display:"inline-block",imageRendering:"pixelated",animation:animate?"pixelBreathe 1.6s steps(2) infinite":"none"}}>
    <style>{`@keyframes pixelBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04) translateY(-2px)}}`}</style>
    <div style={{display:"grid",gridTemplateColumns:`repeat(16,${cellSize}px)`,gap:0,lineHeight:0}}>
      {grid.flatMap((row,rowIdx)=>row.split("").map((ch,colIdx)=>(<div key={`${rowIdx}-${colIdx}`} style={{width:cellSize,height:cellSize,background:PIXEL_COLORS[ch]||"transparent"}}/>)))}
    </div>
  </div>);
}


// ═══ PET HOME SCENE (寵物的家 - 沉浸式場景) ═══════════════════════
function PetHomeScene({pet,petDef,ri,mood,c,onCleanPoop}){
  const home=PET_HOMES[petDef.id]||PET_HOMES[PET_VARIANT_BASE[petDef.id]]||PET_HOMES.puppy;
  const stage=getPetStage(pet);
  const petFontSize=getPetSize(stage);
  const stageSayings=STAGE_SAYINGS[stage]||PET_SAYINGS;
  const sleeping=isPetSleeping();
  const poops=pet.poops||[];
  const[bubble,setBubble]=useState(null);
  const[petPos,setPetPos]=useState({x:50,y:50,bouncing:false});
  const[floatingItems,setFloatingItems]=useState([]);

  // Auto-wander: pet moves slowly around
  useEffect(()=>{
    const t=setInterval(()=>{
      setPetPos(p=>({
        x:Math.max(25,Math.min(75,p.x+(Math.random()-.5)*20)),
        y:Math.max(40,Math.min(65,p.y+(Math.random()-.5)*8)),
        bouncing:false,
      }));
    },3500);
    return()=>clearInterval(t);
  },[]);

  // Random sayings every 8-15 seconds (mix time greetings with stage sayings)
  useEffect(()=>{
    const showBubble=()=>{
      const useTime=Math.random()<0.4;// 40% chance of time-based greeting
      const timeKey=getTimeOfDay();
      const timeSayings=TIME_GREETINGS[timeKey]||TIME_GREETINGS.afternoon;
      const pool=useTime?timeSayings:stageSayings;
      const say=pool[Math.floor(Math.random()*pool.length)];
      setBubble(say);
      setTimeout(()=>setBubble(null),3000);
    };
    // Show greeting right away on mount
    const initial=setTimeout(showBubble,500);
    const t=setInterval(showBubble,8000+Math.random()*7000);
    return()=>{clearTimeout(initial);clearInterval(t)};
  },[]);

  // Floating ambient items
  useEffect(()=>{
    const spawn=()=>{
      const item=home.items[Math.floor(Math.random()*home.items.length)];
      const id=Date.now()+Math.random();
      setFloatingItems(f=>[...f,{id,emoji:item,x:Math.random()*90+5,startY:100,duration:6+Math.random()*4}]);
      setTimeout(()=>setFloatingItems(f=>f.filter(x=>x.id!==id)),10000);
    };
    spawn();
    const t=setInterval(spawn,3000);
    return()=>clearInterval(t);
  },[]);

  // Interaction: tap pet
  const tapCountRef=useRef(0);
  const tapResetRef=useRef(null);

  const tapPet=()=>{
    // Track rapid tapping for combo effect
    tapCountRef.current++;
    clearTimeout(tapResetRef.current);
    tapResetRef.current=setTimeout(()=>{tapCountRef.current=0},1500);
    const comboCount=tapCountRef.current;

    // Don't disturb sleeping pet (just a sleepy grumble)
    if(sleeping){
      const id=Date.now();
      setFloatingItems(f=>[...f,{id,emoji:"💤",x:petPos.x,startY:petPos.y,duration:2,isHeart:true}]);
      setTimeout(()=>setFloatingItems(f=>f.filter(x=>x.id!==id)),2000);
      setBubble("Zzz... don't wake me...");
      setTimeout(()=>setBubble(null),2000);
      return;
    }

    playPetSound(petDef.id);
    // Pet bounces
    setPetPos(p=>({...p,bouncing:true}));
    setTimeout(()=>setPetPos(p=>({...p,bouncing:false})),600);

    // Show random saying (or combo reaction for rapid taps)
    let say;
    if(comboCount>=5){
      say=["So much love!","Hehe, stop it!","You're the best!","Tickle tickle!"][Math.floor(Math.random()*4)];
    }else if(comboCount>=3){
      say=["Haha!","More please!","That tickles!","You like me?"][Math.floor(Math.random()*4)];
    }else{
      say=stageSayings[Math.floor(Math.random()*stageSayings.length)];
    }
    setBubble(say);
    setTimeout(()=>setBubble(null),2500);
    // Speak English greeting
    speak(say);

    // Multi-particle emission - more cute!
    const particles=comboCount>=5?["💖","✨","💕","⭐","🌟"]:comboCount>=3?["💖","💕","✨"]:["💖"];
    const count=Math.min(3+comboCount,8);
    for(let i=0;i<count;i++){
      const id=Date.now()+Math.random();
      const emoji=particles[Math.floor(Math.random()*particles.length)];
      const offsetX=(Math.random()-0.5)*30;
      setFloatingItems(f=>[...f,{id,emoji,x:petPos.x+offsetX,startY:petPos.y,duration:2+Math.random(),isHeart:true}]);
      setTimeout(()=>setFloatingItems(f=>f.filter(x=>x.id!==id)),2500);
    }

    // Action heart sound for feedback
    if(comboCount>=3)playActionSound("heart");
  };

  // Cleanup tap timer
  useEffect(()=>()=>clearTimeout(tapResetRef.current),[]);

  const urgentNeed=pet.hunger<30?{icon:"🍖",text:"好餓..."}:pet.clean<30?{icon:"💦",text:"好髒..."}:pet.energy<30?{icon:"😴",text:"好累..."}:null;

  return(<div style={{position:"relative",width:"100%",height:380,borderRadius:20,overflow:"hidden",marginBottom:12,background:home.bg,boxShadow:"0 6px 20px rgba(0,0,0,.15)",border:`3px solid ${ri.color}`}}>
    <style>{`
      @keyframes petBreathe{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.05)}}
      @keyframes petBounce{0%{transform:translate(-50%,-50%) scale(1)}25%{transform:translate(-50%,-90%) scale(1.15)}50%{transform:translate(-50%,-50%) scale(0.95)}75%{transform:translate(-50%,-70%) scale(1.1)}100%{transform:translate(-50%,-50%) scale(1)}}
      @keyframes petShake{0%,100%{transform:translate(-50%,-50%) rotate(0)}25%{transform:translate(-52%,-50%) rotate(-5deg)}75%{transform:translate(-48%,-50%) rotate(5deg)}}
      @keyframes petSleep{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-48%) scale(1.02)}}
      @keyframes zzzFloat{0%{transform:translate(-50%,-50%) translateY(0);opacity:1}50%{opacity:.6}100%{transform:translate(-50%,-50%) translateY(-30px);opacity:0}}
      @keyframes poopWiggle{0%,100%{transform:translateX(-50%) rotate(-3deg)}50%{transform:translateX(-50%) rotate(3deg)}}
      @keyframes floatUp{0%{transform:translateY(0) rotate(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-350px) rotate(360deg);opacity:0}}
      @keyframes heartFloat{0%{transform:translate(-50%,-50%) scale(0);opacity:1}50%{transform:translate(-50%,-120%) scale(1.5);opacity:1}100%{transform:translate(-50%,-200%) scale(0.5);opacity:0}}
      @keyframes bubbleIn{0%{transform:scale(0) translateY(10px);opacity:0}60%{transform:scale(1.1) translateY(0);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}
      @keyframes cloudDrift{0%{transform:translateX(-20px)}100%{transform:translateX(calc(100vw + 20px))}}
      @keyframes cloudDriftBack{0%{transform:translateX(calc(100vw + 20px))}100%{transform:translateX(-100px)}}
      @keyframes rarityGlow{0%,100%{box-shadow:0 0 12px ${ri.color}55,inset 0 0 20px ${ri.color}22}50%{box-shadow:0 0 24px ${ri.color}88,inset 0 0 30px ${ri.color}44}}
      @keyframes starTwinkle{0%,100%{opacity:0.3;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
      @keyframes moonGlow{0%,100%{filter:drop-shadow(0 0 6px rgba(255,255,224,0.5))}50%{filter:drop-shadow(0 0 14px rgba(255,255,224,0.9))}}
    `}</style>

    {/* (P2-1) 時段光線濾鏡 - 晝夜變化 */}
    {(()=>{
      const t=getTimeOfDay();
      if(t==="morning")return<div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(255,200,150,0.18),transparent 40%)",pointerEvents:"none",zIndex:1}}/>;
      if(t==="evening")return<div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(255,140,60,0.22),rgba(180,80,40,0.12) 60%)",pointerEvents:"none",zIndex:1}}/>;
      if(t==="night"||t==="sleeping")return<div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(20,30,90,0.45),rgba(10,20,60,0.3))",pointerEvents:"none",zIndex:1}}/>;
      return null;
    })()}

    {/* Rarity glow overlay for SR/SSR */}
    {(pet.rarity==="SR"||pet.rarity==="SSR")&&<div style={{position:"absolute",inset:0,borderRadius:17,animation:"rarityGlow 2.5s ease-in-out infinite",pointerEvents:"none",zIndex:1}}/>}

    {/* (P2-1) Sky decorations - 多層視差雲朵 + 晝夜元素 */}
    {(()=>{
      const t=getTimeOfDay();
      if(t==="night"||t==="sleeping"){
        // 夜晚：月亮 + 星星閃爍
        return(<>
          <div style={{position:"absolute",top:14,right:30,fontSize:32,zIndex:2,animation:"moonGlow 4s ease-in-out infinite"}}>🌙</div>
          <div style={{position:"absolute",top:24,left:"22%",fontSize:10,zIndex:2,animation:"starTwinkle 2s ease-in-out infinite"}}>⭐</div>
          <div style={{position:"absolute",top:42,left:"38%",fontSize:8,zIndex:2,animation:"starTwinkle 3s 0.5s ease-in-out infinite"}}>⭐</div>
          <div style={{position:"absolute",top:18,left:"58%",fontSize:9,zIndex:2,animation:"starTwinkle 2.5s 1s ease-in-out infinite"}}>✨</div>
          <div style={{position:"absolute",top:54,left:"15%",fontSize:7,zIndex:2,animation:"starTwinkle 2.8s 1.5s ease-in-out infinite"}}>⭐</div>
          <div style={{position:"absolute",top:66,left:"72%",fontSize:9,zIndex:2,animation:"starTwinkle 2.2s 0.8s ease-in-out infinite"}}>✨</div>
          <div style={{position:"absolute",top:32,left:"85%",fontSize:7,zIndex:2,animation:"starTwinkle 3.2s 0.3s ease-in-out infinite"}}>⭐</div>
        </>);
      }
      if(t==="morning"){
        return(<>
          <div style={{position:"absolute",top:8,right:20,fontSize:28,zIndex:2,opacity:0.85,filter:"drop-shadow(0 0 8px rgba(255,200,100,0.6))"}}>☀️</div>
          {/* 遠景雲（小、淡、慢） */}
          <div style={{position:"absolute",top:24,left:0,fontSize:14,opacity:.3,zIndex:2,animation:"cloudDrift 80s linear infinite"}}>☁️</div>
          <div style={{position:"absolute",top:38,left:0,fontSize:12,opacity:.25,zIndex:2,animation:"cloudDriftBack 100s linear infinite",animationDelay:"-50s"}}>☁️</div>
          {/* 中景雲（中、中速） */}
          <div style={{position:"absolute",top:14,left:0,fontSize:22,opacity:.5,zIndex:3,animation:"cloudDrift 50s linear infinite",animationDelay:"-15s"}}>☁️</div>
          {/* 近景雲（大、快） */}
          <div style={{position:"absolute",top:48,left:0,fontSize:28,opacity:.6,zIndex:4,animation:"cloudDrift 30s linear infinite",animationDelay:"-8s"}}>☁️</div>
        </>);
      }
      // 預設（中午、下午、傍晚）：三層視差雲朵
      return(<>
        <div style={{position:"absolute",top:24,left:0,fontSize:14,opacity:.3,zIndex:2,animation:"cloudDrift 80s linear infinite"}}>☁️</div>
        <div style={{position:"absolute",top:38,left:0,fontSize:12,opacity:.25,zIndex:2,animation:"cloudDriftBack 100s linear infinite",animationDelay:"-50s"}}>☁️</div>
        <div style={{position:"absolute",top:14,left:0,fontSize:22,opacity:.5,zIndex:3,animation:"cloudDrift 50s linear infinite",animationDelay:"-15s"}}>☁️</div>
        <div style={{position:"absolute",top:48,left:0,fontSize:28,opacity:.6,zIndex:4,animation:"cloudDrift 30s linear infinite",animationDelay:"-8s"}}>☁️</div>
      </>);
    })()}

    {/* Rarity badge top-left */}
    <div style={{position:"absolute",top:10,left:10,background:"rgba(255,255,255,.85)",backdropFilter:"blur(4px)",borderRadius:14,padding:"4px 10px",zIndex:10}}>
      <span style={{fontSize:11,fontWeight:700,color:ri.color}}>{ri.stars} {ri.label}</span>
      <span style={{fontSize:10,color:S.t3,marginLeft:6}}>· {STAGE_NAMES[stage]}</span>
    </div>

    {/* Mood indicator top-right */}
    <div style={{position:"absolute",top:10,right:10,background:"rgba(255,255,255,.85)",backdropFilter:"blur(4px)",borderRadius:14,padding:"4px 10px",zIndex:10}}>
      <span style={{fontSize:13}}>{sleeping?"💤":mood.emoji} </span><span style={{fontSize:11,fontWeight:600,color:sleeping?"#7EB5F0":mood.color}}>{sleeping?"睡覺中":mood.text}</span>
    </div>

    {/* Poop counter (only when poops exist) */}
    {poops.length>0&&<div style={{position:"absolute",top:46,right:10,background:"rgba(139,69,19,.9)",color:"#fff",borderRadius:14,padding:"4px 10px",zIndex:10,fontSize:11,fontWeight:600,animation:"emojiPulse 1.2s infinite"}}>
      💩 {poops.length} 個要清
    </div>}

    {/* Urgent need alert (below poop if both exist) */}
    {urgentNeed&&<div style={{position:"absolute",top:poops.length>0?82:46,right:10,background:"rgba(226,75,74,.9)",color:"#fff",borderRadius:14,padding:"4px 10px",zIndex:10,fontSize:11,fontWeight:600,animation:"emojiPulse 1s infinite"}}>
      {urgentNeed.icon} {urgentNeed.text}
    </div>}

    {/* Floating ambient items */}
    {floatingItems.map(item=>(<div key={item.id} style={{position:"absolute",left:`${item.x}%`,bottom:"-20px",fontSize:item.isHeart?28:20,animation:item.isHeart?"heartFloat 2.5s ease-out forwards":`floatUp ${item.duration}s linear forwards`,zIndex:3,pointerEvents:"none"}}>{item.emoji}</div>))}

    {/* Pet speech bubble */}
    {bubble&&<div style={{position:"absolute",left:`${petPos.x}%`,top:`${petPos.y-18}%`,transform:"translate(-50%,-100%)",background:"#fff",border:`2px solid ${ri.color}`,borderRadius:16,padding:"8px 14px",fontSize:13,fontWeight:700,color:S.t1,zIndex:8,animation:"bubbleIn .35s ease-out",whiteSpace:"nowrap",boxShadow:"0 3px 10px rgba(0,0,0,.15)"}}>
      {bubble}
      <div style={{position:"absolute",bottom:-8,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"8px solid transparent",borderRight:"8px solid transparent",borderTop:`8px solid ${ri.color}`}}/>
      <div style={{position:"absolute",bottom:-5,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:"6px solid #fff"}}/>
    </div>}

    {/* THE PET! Big and interactive - SVG illustration */}
    <button onClick={tapPet} style={{
      position:"absolute",
      left:`${petPos.x}%`,top:`${petPos.y}%`,
      transform:"translate(-50%,-50%)",
      background:"none",border:"none",cursor:"pointer",
      WebkitTapHighlightColor:"transparent",padding:0,
      animation:petPos.bouncing?"petBounce .6s ease-out":sleeping?"petSleep 3s ease-in-out infinite":urgentNeed?"petShake 1.2s ease-in-out infinite":"petBreathe 2.5s ease-in-out infinite",
      transition:"left 2s ease-in-out, top 2s ease-in-out",
      filter:urgentNeed?"grayscale(.3)":sleeping?"brightness(.7)":"none",
      zIndex:5,
      lineHeight:1,
      userSelect:"none",
    }}>
      <PixelPet petId={petDef.id} stage={stage} size={petFontSize*1.6} animate={!sleeping}/>
    </button>

    {/* Sleep ZZZ indicator */}
    {sleeping&&<div style={{position:"absolute",left:`${petPos.x+10}%`,top:`${petPos.y-15}%`,transform:"translate(-50%,-50%)",fontSize:32,animation:"zzzFloat 2s ease-in-out infinite",zIndex:6,pointerEvents:"none",color:"#7EB5F0",fontWeight:700,fontFamily:"monospace"}}>💤</div>}

    {/* Poops on the ground - clickable to clean */}
    {poops.map(poop=>(<button key={poop.id} onClick={(e)=>{e.stopPropagation();if(onCleanPoop)onCleanPoop(poop.id)}} style={{position:"absolute",left:`${poop.x}%`,bottom:42,transform:"translateX(-50%)",fontSize:28,background:"none",border:"none",cursor:"pointer",zIndex:4,WebkitTapHighlightColor:"transparent",padding:0,animation:"poopWiggle 2s ease-in-out infinite",lineHeight:1}} title="點我清理！">💩</button>))}

    {/* Night overlay */}
    {sleeping&&<div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 50% 30%, rgba(30,30,60,.2), rgba(20,20,40,.5))",pointerEvents:"none",zIndex:3}}/>}

    {/* Ground line with items */}
    <div style={{position:"absolute",bottom:0,left:0,right:0,height:40,background:`linear-gradient(180deg,transparent,rgba(0,0,0,.15))`,display:"flex",alignItems:"flex-end",justifyContent:"space-around",padding:"0 10px",fontSize:20,opacity:.65,letterSpacing:2,zIndex:2}}>
      {home.ground}
    </div>

    {/* Tap hint */}
    <div style={{position:"absolute",bottom:6,left:"50%",transform:"translateX(-50%)",background:"rgba(255,255,255,.85)",backdropFilter:"blur(4px)",borderRadius:12,padding:"4px 12px",fontSize:11,color:S.t2,fontWeight:600,zIndex:10}}>
      👆 點我互動！· {home.name}
    </div>

    {/* Pet name overlay */}
    <div style={{position:"absolute",bottom:30,right:10,background:"rgba(255,255,255,.9)",backdropFilter:"blur(4px)",borderRadius:14,padding:"6px 12px",zIndex:10}}>
      <div style={{fontSize:14,fontWeight:700,color:S.t1}}>{petDef.name}</div>
    </div>
  </div>);
}

// ═══ ACTION CELEBRATION (互動動作粒子動畫 - P0-2 視覺優化) ═════════
// 在寵物詳情頁的 PetHomeScene 上方覆蓋一層粒子動畫
// 餵食/洗澡/玩耍/睡覺/讀書 各有獨特粒子效果 + 數值跳動
function ActionCelebration({data}){
  const{actionKey,statText,statColor,foodEmoji,bonusText}=data;
  // 為了給 inline style 用 CSS variable，每個粒子放在獨立 div 裡
  const styleSheet=`
@keyframes ac_dropIn { 0%{transform:translate(-50%,-200px) rotate(0deg);opacity:0} 30%{opacity:1} 80%{transform:translate(-50%,40px) rotate(360deg);opacity:1} 100%{transform:translate(-50%,40px) rotate(360deg);opacity:0} }
@keyframes ac_bubbleUp { 0%{transform:translate(0,0) scale(0.4);opacity:0} 30%{opacity:1} 100%{transform:translate(var(--dx,20px),-120px) scale(1);opacity:0} }
@keyframes ac_heartBurst { 0%{transform:translate(-50%,0) scale(0.3);opacity:0} 30%{opacity:1} 100%{transform:translate(calc(-50% + var(--dx,40px)),var(--dy,-60px)) scale(1.2) rotate(var(--rot,20deg));opacity:0} }
@keyframes ac_zRise { 0%{transform:translate(-50%,0) scale(0.5);opacity:0} 30%{opacity:1} 100%{transform:translate(-50%,-100px) scale(1.6);opacity:0} }
@keyframes ac_starOrbit { 0%{transform:translate(0,0) scale(0.5);opacity:0} 25%{opacity:1} 100%{transform:translate(var(--dx,30px),var(--dy,-50px)) scale(1.1) rotate(var(--rot,180deg));opacity:0} }
@keyframes ac_statPop { 0%{transform:translate(-50%,0) scale(0.5);opacity:0} 20%{transform:translate(-50%,-15px) scale(1.3);opacity:1} 60%{transform:translate(-50%,-35px) scale(1);opacity:1} 100%{transform:translate(-50%,-65px) scale(0.9);opacity:0} }
@keyframes ac_flash { 0%,100%{opacity:0} 40%{opacity:0.35} 60%{opacity:0.35} }
@media (prefers-reduced-motion: reduce) { [data-action-celebration] *{animation-duration:0.1s !important;animation-iteration-count:1 !important} }
`;

  const renderParticles=()=>{
    if(actionKey==="feed"){
      return(<>
        <div style={{position:"absolute",top:0,left:"50%",fontSize:36,animation:"ac_dropIn 1.2s ease-in forwards",pointerEvents:"none"}}>{foodEmoji||"🍖"}</div>
      </>);
    }
    if(actionKey==="clean"){
      const bubbles=[
        {l:"30%",dx:"-15px",delay:"0s",size:24},
        {l:"45%",dx:"5px",delay:"0.15s",size:28},
        {l:"60%",dx:"15px",delay:"0.3s",size:22},
        {l:"40%",dx:"-5px",delay:"0.45s",size:18},
        {l:"55%",dx:"10px",delay:"0.6s",size:20},
        {l:"50%",dx:"0px",delay:"0.75s",size:16},
      ];
      return(<>
        <div style={{position:"absolute",inset:0,background:"#4A90E2",animation:"ac_flash 1.2s ease-in-out forwards",pointerEvents:"none"}}/>
        {bubbles.map((b,i)=>(<div key={i} style={{position:"absolute",bottom:"35%",left:b.l,fontSize:b.size,"--dx":b.dx,animation:`ac_bubbleUp 1.4s ${b.delay} ease-out forwards`,pointerEvents:"none"}}>💧</div>))}
      </>);
    }
    if(actionKey==="play"){
      const hearts=[
        {dx:"-50px",dy:"-40px",rot:"-30deg",delay:"0s",emo:"❤️",size:28},
        {dx:"50px",dy:"-40px",rot:"30deg",delay:"0.1s",emo:"❤️",size:28},
        {dx:"-30px",dy:"-70px",rot:"-15deg",delay:"0.25s",emo:"💕",size:22},
        {dx:"30px",dy:"-70px",rot:"15deg",delay:"0.4s",emo:"💕",size:22},
        {dx:"0px",dy:"-90px",rot:"0deg",delay:"0.55s",emo:"💖",size:24},
      ];
      return(<>
        {hearts.map((h,i)=>(<div key={i} style={{position:"absolute",bottom:"45%",left:"50%",fontSize:h.size,"--dx":h.dx,"--dy":h.dy,"--rot":h.rot,animation:`ac_heartBurst 1.4s ${h.delay} ease-out forwards`,pointerEvents:"none"}}>{h.emo}</div>))}
      </>);
    }
    if(actionKey==="sleep"){
      return(<>
        <div style={{position:"absolute",inset:0,background:"#7B61FF",animation:"ac_flash 1.2s ease-in-out forwards",opacity:0.2,pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:"50%",left:"50%",fontSize:36,fontWeight:700,color:"#fff",textShadow:"0 0 6px rgba(0,0,0,.4)",animation:"ac_zRise 1.6s 0s ease-out forwards",pointerEvents:"none"}}>Z</div>
        <div style={{position:"absolute",bottom:"50%",left:"50%",fontSize:28,fontWeight:700,color:"#fff",textShadow:"0 0 6px rgba(0,0,0,.4)",animation:"ac_zRise 1.6s 0.4s ease-out forwards",pointerEvents:"none"}}>z</div>
        <div style={{position:"absolute",bottom:"50%",left:"50%",fontSize:20,fontWeight:700,color:"#fff",textShadow:"0 0 6px rgba(0,0,0,.4)",animation:"ac_zRise 1.6s 0.8s ease-out forwards",pointerEvents:"none"}}>z</div>
      </>);
    }
    if(actionKey==="study"){
      const items=[
        {dx:"-60px",dy:"-30px",rot:"-180deg",delay:"0s",emo:"✨",size:26},
        {dx:"60px",dy:"-30px",rot:"180deg",delay:"0.15s",emo:"📚",size:26},
        {dx:"-40px",dy:"-70px",rot:"-90deg",delay:"0.3s",emo:"⭐",size:20},
        {dx:"40px",dy:"-70px",rot:"90deg",delay:"0.45s",emo:"📖",size:20},
        {dx:"0px",dy:"-90px",rot:"0deg",delay:"0.6s",emo:"✨",size:22},
      ];
      return(<>
        {items.map((it,i)=>(<div key={i} style={{position:"absolute",bottom:"45%",left:"50%",fontSize:it.size,"--dx":it.dx,"--dy":it.dy,"--rot":it.rot,animation:`ac_starOrbit 1.4s ${it.delay} ease-out forwards`,pointerEvents:"none"}}>{it.emo}</div>))}
      </>);
    }
    return null;
  };

  return(<div data-action-celebration style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:50,overflow:"hidden",borderRadius:"inherit"}}>
    <style>{styleSheet}</style>
    {renderParticles()}
    {statText&&<div style={{position:"absolute",top:"38%",left:"50%",fontSize:16,fontWeight:700,color:"#fff",background:statColor,padding:"6px 14px",borderRadius:14,boxShadow:"0 3px 10px rgba(0,0,0,.25)",animation:"ac_statPop 1.4s ease-out forwards",whiteSpace:"nowrap"}}>{statText}</div>}
    {bonusText&&<div style={{position:"absolute",top:"52%",left:"50%",transform:"translateX(-50%)",fontSize:12,fontWeight:900,color:"#856404",background:"#FFF3CD",border:"1px solid #EF9F27",padding:"7px 12px",borderRadius:12,boxShadow:"0 3px 10px rgba(0,0,0,.18)",animation:"ac_statPop 1.4s .08s ease-out forwards",whiteSpace:"nowrap"}}>{bonusText}</div>}
  </div>);
}

// ═══ LEVEL UP CELEBRATION (升級慶祝畫面 - P1-3 視覺優化) ════════════
// 全螢幕煙火 overlay：寵物放大、金光放射、LEVEL UP 大字落下、金幣彈出
// 進化階段（Lv 3 → Lv 4 = 成體; Lv 9 → Lv 10 = 完全體）會更盛大
function LevelUpCelebration({pet,petDef,fromLevel,toLevel,onClose}){
  const isEvolution=(fromLevel<4&&toLevel>=4)||(fromLevel<10&&toLevel>=10);
  // 自動 4 秒後關閉
  useEffect(()=>{
    const t=setTimeout(()=>onClose&&onClose(),isEvolution?5000:3500);
    return()=>clearTimeout(t);
  },[]);// eslint-disable-line

  const styleSheet=`
@keyframes lu_overlayIn { 0%{opacity:0} 100%{opacity:1} }
@keyframes lu_radial { 0%{transform:translate(-50%,-50%) scale(0) rotate(0deg);opacity:0} 30%{opacity:1} 100%{transform:translate(-50%,-50%) scale(2.2) rotate(180deg);opacity:0} }
@keyframes lu_petRise { 0%{transform:translate(-50%,-50%) scale(0.3);opacity:0} 30%{transform:translate(-50%,-50%) scale(1.3);opacity:1} 60%{transform:translate(-50%,-50%) scale(1.8);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.6);opacity:1} }
@keyframes lu_titleDrop { 0%{transform:translate(-50%,-100px) scale(0.5);opacity:0} 50%{transform:translate(-50%,0) scale(1.2);opacity:1} 70%{transform:translate(-50%,0) scale(0.95);opacity:1} 100%{transform:translate(-50%,0) scale(1);opacity:1} }
@keyframes lu_subText { 0%{transform:translate(-50%,15px);opacity:0} 100%{transform:translate(-50%,0);opacity:1} }
@keyframes lu_coinPop { 0%{transform:translate(0,0) scale(0);opacity:0} 30%{opacity:1} 100%{transform:translate(var(--cx),var(--cy)) scale(1) rotate(720deg);opacity:0} }
@keyframes lu_firework { 0%{transform:translate(0,0) scale(0);opacity:0} 30%{opacity:1} 100%{transform:translate(var(--fx),var(--fy)) scale(0.8);opacity:0} }
@keyframes lu_evolutionGlow { 0%{filter:brightness(1)} 50%{filter:brightness(1.8) saturate(1.5)} 100%{filter:brightness(1)} }
@media (prefers-reduced-motion: reduce) { [data-levelup] *{animation-duration:0.5s !important} }
`;

  // 散開的金幣
  const coins=Array.from({length:isEvolution?12:8},(_,i)=>{
    const angle=(i*360/(isEvolution?12:8))+(Math.random()*30-15);
    const dist=120+Math.random()*60;
    return{
      cx:`${Math.cos(angle*Math.PI/180)*dist}px`,
      cy:`${Math.sin(angle*Math.PI/180)*dist}px`,
      delay:0.4+i*0.05,
      size:isEvolution?28:24,
    };
  });

  // 煙火粒子
  const fireworks=Array.from({length:isEvolution?20:12},(_,i)=>{
    const angle=Math.random()*360;
    const dist=80+Math.random()*180;
    const colors=isEvolution?["#FFD700","#FF69B4","#FFA500","#FFEC8B","#FF1493"]:["#FFD700","#FFA500","#FFEC8B"];
    return{
      fx:`${Math.cos(angle*Math.PI/180)*dist}px`,
      fy:`${Math.sin(angle*Math.PI/180)*dist}px`,
      delay:0.6+Math.random()*0.6,
      color:colors[i%colors.length],
      size:5+Math.random()*4,
    };
  });

  return(<div data-levelup onClick={onClose} style={{
    position:"fixed",inset:0,
    background:isEvolution?"radial-gradient(circle,rgba(255,215,0,0.4),rgba(20,10,0,0.85))":"radial-gradient(circle,rgba(255,215,0,0.3),rgba(0,0,0,0.75))",
    zIndex:9999,
    cursor:"pointer",
    animation:"lu_overlayIn 0.3s ease-out forwards",
    overflow:"hidden",
    backdropFilter:"blur(2px)",
    WebkitBackdropFilter:"blur(2px)",
  }}>
    <style>{styleSheet}</style>

    {/* 放射光線（背景） */}
    <div style={{
      position:"absolute",top:"50%",left:"50%",
      width:600,height:600,
      background:`conic-gradient(from 0deg,transparent 0deg,${isEvolution?"#FFD700":"#FFA500"}99 30deg,transparent 60deg,transparent 90deg,${isEvolution?"#FFD700":"#FFA500"}99 120deg,transparent 150deg,transparent 180deg,${isEvolution?"#FFD700":"#FFA500"}99 210deg,transparent 240deg,transparent 270deg,${isEvolution?"#FFD700":"#FFA500"}99 300deg,transparent 330deg,transparent)`,
      animation:"lu_radial 2s ease-out forwards",
      mixBlendMode:"screen",
      opacity:0.7,
    }}/>

    {/* 寵物本體（放大居中） */}
    <div style={{
      position:"absolute",top:"50%",left:"50%",
      transform:"translate(-50%,-50%)",
      animation:`lu_petRise 1s 0.2s ease-out forwards${isEvolution?", lu_evolutionGlow 1.5s 1s ease-in-out infinite":""}`,
      opacity:0,
      zIndex:5,
    }}>
      <PixelPet petId={petDef.id} stage={getPetStage(pet)} size={120} animate={false}/>
    </div>

    {/* LEVEL UP 大字 */}
    <div style={{
      position:"absolute",top:"22%",left:"50%",
      animation:"lu_titleDrop 0.8s 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
      opacity:0,
      fontSize:isEvolution?44:36,fontWeight:900,
      color:"#FFD700",
      textShadow:"0 0 16px rgba(255,215,0,0.9), 3px 3px 0 #FF6B00, 6px 6px 12px rgba(0,0,0,0.5)",
      letterSpacing:isEvolution?4:2,
      whiteSpace:"nowrap",
      zIndex:10,
    }}>
      {isEvolution?"✨ 進化！ ✨":"LEVEL UP！"}
    </div>

    {/* 副文字：等級資訊 */}
    <div style={{
      position:"absolute",top:"34%",left:"50%",
      animation:"lu_subText 0.6s 1.1s ease-out forwards",
      opacity:0,
      fontSize:18,fontWeight:700,
      color:"#fff",
      textShadow:"0 2px 8px rgba(0,0,0,0.6)",
      whiteSpace:"nowrap",
      zIndex:10,
    }}>
      Lv.{fromLevel} → Lv.{toLevel}
    </div>

    {/* 寵物名稱 */}
    <div style={{
      position:"absolute",top:"72%",left:"50%",
      animation:"lu_subText 0.6s 1.3s ease-out forwards",
      opacity:0,
      fontSize:16,fontWeight:600,
      color:"#fff",
      textShadow:"0 2px 6px rgba(0,0,0,0.6)",
      whiteSpace:"nowrap",
      zIndex:10,
    }}>
      {petDef.name} 升級了！
    </div>

    {/* 點任意處關閉提示 */}
    <div style={{
      position:"absolute",bottom:32,left:"50%",
      animation:"lu_subText 0.6s 2s ease-out forwards",
      opacity:0,
      fontSize:11,
      color:"rgba(255,255,255,0.7)",
      whiteSpace:"nowrap",
      zIndex:10,
    }}>
      點任意處關閉
    </div>

    {/* 金幣彈出 */}
    {coins.map((coin,i)=>(<div key={`c${i}`} style={{
      position:"absolute",top:"50%",left:"50%",
      fontSize:coin.size,
      "--cx":coin.cx,"--cy":coin.cy,
      animation:`lu_coinPop 1.5s ${coin.delay}s ease-out forwards`,
      opacity:0,
      zIndex:8,
    }}>🪙</div>))}

    {/* 煙火粒子 */}
    {fireworks.map((fw,i)=>(<div key={`f${i}`} style={{
      position:"absolute",top:"50%",left:"50%",
      width:fw.size,height:fw.size,
      borderRadius:"50%",
      background:fw.color,
      boxShadow:`0 0 ${fw.size*2}px ${fw.color}`,
      "--fx":fw.fx,"--fy":fw.fy,
      animation:`lu_firework 1.8s ${fw.delay}s ease-out forwards`,
      opacity:0,
      zIndex:7,
    }}/>))}
  </div>);
}

// ═══ HATCH ANIMATION (孵化動畫 - V19) ═══════════════════════════════
// 蛋震動 → 裂開 → 寵物從中跳出
function HatchAnimation({data,onClose}){
  const{egg,petDef,ri}=data;
  const[stage,setStage]=useState(0);// 0: 震動 1: 裂開 2: 寵物出現

  useEffect(()=>{
    const t1=setTimeout(()=>setStage(1),700);
    const t2=setTimeout(()=>setStage(2),1100);
    const t3=setTimeout(()=>onClose&&onClose(),2400);
    return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3)};
  },[]);// eslint-disable-line

  const styleSheet=`
@keyframes ha_overlay { 0%{opacity:0} 100%{opacity:1} }
@keyframes ha_eggShake { 0%,100%{transform:translate(-50%,-50%) rotate(0deg)} 25%{transform:translate(-53%,-50%) rotate(-8deg)} 75%{transform:translate(-47%,-50%) rotate(8deg)} }
@keyframes ha_eggCrack { 0%{transform:translate(-50%,-50%) scale(1);opacity:1} 50%{transform:translate(-50%,-50%) scale(1.3);opacity:1} 100%{transform:translate(-50%,-50%) scale(2.5);opacity:0} }
@keyframes ha_petBurst { 0%{transform:translate(-50%,-50%) scale(0.2);opacity:0} 30%{transform:translate(-50%,-50%) scale(1.4);opacity:1} 60%{transform:translate(-50%,-50%) scale(0.9);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.2);opacity:1} }
@keyframes ha_shellPiece { 0%{transform:translate(0,0) rotate(0deg);opacity:1} 100%{transform:translate(var(--sx),var(--sy)) rotate(var(--sr));opacity:0} }
@keyframes ha_textRise { 0%{transform:translate(-50%,30px);opacity:0} 100%{transform:translate(-50%,0);opacity:1} }
@keyframes ha_glow { 0%,100%{box-shadow:0 0 30px ${ri.color}77} 50%{box-shadow:0 0 60px ${ri.color}, 0 0 100px ${ri.color}88} }
@media (prefers-reduced-motion: reduce) { [data-hatch] *{animation-duration:0.4s !important} }
`;

  // 蛋殼碎片
  const shells=Array.from({length:8},(_,i)=>{
    const angle=i*45+Math.random()*15;
    const dist=80+Math.random()*60;
    return{
      sx:`${Math.cos(angle*Math.PI/180)*dist}px`,
      sy:`${Math.sin(angle*Math.PI/180)*dist}px`,
      sr:`${(Math.random()*720-360)}deg`,
      delay:0.05+Math.random()*0.1,
    };
  });

  return(<div data-hatch onClick={onClose} style={{
    position:"fixed",inset:0,
    background:`radial-gradient(circle,${ri.color}33,rgba(0,0,0,0.85))`,
    zIndex:9999,
    cursor:"pointer",
    animation:"ha_overlay 0.3s ease-out forwards",
    backdropFilter:"blur(2px)",
    WebkitBackdropFilter:"blur(2px)",
  }}>
    <style>{styleSheet}</style>

    {/* 階段 0/1：蛋本體（震動 → 裂開消失） */}
    {stage<2&&<div style={{
      position:"absolute",top:"50%",left:"50%",
      width:120,height:150,
      borderRadius:"50% 50% 50% 50% / 60% 60% 40% 40%",
      background:`linear-gradient(135deg,#FFF8DC,${ri.color}66)`,
      boxShadow:`inset -10px -10px 20px rgba(0,0,0,0.2)`,
      animation:stage===0?"ha_eggShake 0.18s ease-in-out infinite, ha_glow 1.4s ease-in-out infinite":"ha_eggCrack 0.5s ease-out forwards",
      zIndex:5,
    }}/>}

    {/* 階段 1：蛋殼碎片散開 */}
    {stage>=1&&shells.map((sh,i)=>(<div key={`sh${i}`} style={{
      position:"absolute",top:"50%",left:"50%",
      width:14,height:18,
      background:"#FFF8DC",
      borderRadius:"50% 50% 0 0",
      "--sx":sh.sx,"--sy":sh.sy,"--sr":sh.sr,
      animation:`ha_shellPiece 0.8s ${sh.delay}s ease-out forwards`,
      opacity:0,
      zIndex:6,
      boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
    }}/>))}

    {/* 階段 2：寵物從蛋中跳出 */}
    {stage>=2&&<div style={{
      position:"absolute",top:"50%",left:"50%",
      animation:"ha_petBurst 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards",
      opacity:0,
      zIndex:7,
    }}>
      <PixelPet petId={petDef.id} stage="egg" size={120} animate={false}/>
    </div>}

    {/* 文字 */}
    {stage>=2&&<div style={{
      position:"absolute",top:"22%",left:"50%",
      animation:"ha_textRise 0.5s 0.3s ease-out forwards",
      opacity:0,
      fontSize:28,fontWeight:700,
      color:ri.color,
      textShadow:`0 0 16px ${ri.color}, 2px 2px 6px rgba(0,0,0,0.5)`,
      whiteSpace:"nowrap",
      zIndex:10,
    }}>
      🎉 孵化成功！
    </div>}
    {stage>=2&&<div style={{
      position:"absolute",top:"73%",left:"50%",
      animation:"ha_textRise 0.5s 0.5s ease-out forwards",
      opacity:0,
      fontSize:18,fontWeight:600,
      color:"#fff",
      textShadow:"0 2px 6px rgba(0,0,0,0.6)",
      whiteSpace:"nowrap",
      zIndex:10,
    }}>
      {ri.stars} {petDef.name}
    </div>}
  </div>);
}

// ═══ PLAYGROUND VIEW (寵物玩耍場 - P3-1) ════════════════════════════
// 兩隻寵物在草地上互動、英文對話，答對任務後才給獎勵
function PlaygroundView({pets,setPets,setCoins,c,onBack,incrTask}){
  // 隨機選兩隻寵物（不同的）
  const[selected,setSelected]=useState(()=>{
    if(pets.length<2)return[null,null];
    const idx1=Math.floor(Math.random()*pets.length);
    let idx2=Math.floor(Math.random()*pets.length);
    while(idx2===idx1)idx2=Math.floor(Math.random()*pets.length);
    return[idx1,idx2];
  });
  const[bubbleIdx,setBubbleIdx]=useState(0);
  const[played,setPlayed]=useState(false);
  const[answer,setAnswer]=useState(null);

  const PLAY_DIALOGUES=[
    {a:"Hi!",b:"Hello!",tip:"打招呼"},
    {a:"Let's play!",b:"OK!",tip:"一起玩吧"},
    {a:"You are cute!",b:"Thank you!",tip:"你好可愛"},
    {a:"I'm happy!",b:"Me too!",tip:"我很開心"},
    {a:"Want to play?",b:"Yes please!",tip:"想玩嗎？"},
    {a:"Good friend!",b:"Best friend!",tip:"好朋友"},
    {a:"Let's run!",b:"Wait for me!",tip:"一起跑！"},
    {a:"I love you!",b:"Love you too!",tip:"我愛你"},
  ];
  const dialogue=PLAY_DIALOGUES[bubbleIdx%PLAY_DIALOGUES.length];
  const PLAY_CHALLENGES=[
    {q:"Which sentence means「我們是好朋友」?",choices:["We are best friends!","I am hungry.","Good night."],answer:0,speak:"We are best friends!"},
    {q:"Choose the friendly answer to 'Let's play!'",choices:["OK!","No food.","Sleep tight."],answer:0,speak:"OK!"},
    {q:"Which word means「可愛的」?",choices:["cute","tired","dirty"],answer:0,speak:"cute"},
    {q:"Complete: My pet is ___.",choices:["happy","book","run"],answer:0,speak:"My pet is happy."},
  ];
  const challenge=PLAY_CHALLENGES[bubbleIdx%PLAY_CHALLENGES.length];

  useEffect(()=>{
    if(selected[0]===null)return;
    if(played||answer===challenge.answer)return;
    const t=setInterval(()=>{setBubbleIdx(i=>i+1);setAnswer(null)},5000);
    return()=>clearInterval(t);
  },[selected,played,answer,challenge.answer]);

  const playTogether=()=>{
    if(played||selected[0]===null)return;
    if(answer!==challenge.answer){
      setAnswer(answer===null?-1:answer);
      playSound("bad");
      return;
    }
    setPets(ps=>ps.map((p,i)=>{
      if(i===selected[0]||i===selected[1]){
        return levelUpPet({
          ...p,
          bond:(p.bond||0)+8,
          exp:(p.exp||0)+12,
          energy:Math.max(0,(p.energy||0)-4),
          lastUpdate:new Date().toISOString(),
        });
      }
      return p;
    }));
    setCoins?.(co=>co+8);
    incrTask?.("playToday");
    setPlayed(true);
    playSound("combo");
    if(typeof speak==="function")speak(challenge.speak);
  };

  const reroll=()=>{
    if(pets.length<2)return;
    let idx1=Math.floor(Math.random()*pets.length);
    let idx2=Math.floor(Math.random()*pets.length);
    while(idx2===idx1)idx2=Math.floor(Math.random()*pets.length);
    setSelected([idx1,idx2]);
    setBubbleIdx(0);
    setPlayed(false);
    setAnswer(null);
  };

  if(selected[0]===null)return(<div><Hdr t="🎪 玩耍場" onBack={onBack} cl={c.cl}/>
    <div style={{textAlign:"center",padding:"48px 16px"}}>
      <div style={{fontSize:48}}>🐣</div>
      <div style={{fontSize:14,color:S.t2,marginTop:12}}>需要至少 2 隻寵物才能玩耍喔！</div>
    </div>
  </div>);

  const p1=pets[selected[0]],p2=pets[selected[1]];
  const def1=PETS[p1.rarity].find(p=>p.id===p1.petId);
  const def2=PETS[p2.rarity].find(p=>p.id===p2.petId);
  if(!def1||!def2)return null;
  const ri1=RARITY_INFO[p1.rarity];
  const ri2=RARITY_INFO[p2.rarity];

  const styleSheet=`
@keyframes pg_walk1 { 0%,100%{transform:translateX(0) scaleY(1)} 25%{transform:translateX(-3px) scaleY(0.97)} 75%{transform:translateX(3px) scaleY(0.97)} }
@keyframes pg_walk2 { 0%,100%{transform:translateX(0) scaleY(1)} 25%{transform:translateX(3px) scaleY(0.97)} 75%{transform:translateX(-3px) scaleY(0.97)} }
@keyframes pg_bubble { 0%{transform:scale(0) translateY(8px);opacity:0} 30%{transform:scale(1.1) translateY(0);opacity:1} 90%{transform:scale(1) translateY(0);opacity:1} 100%{transform:scale(0.9) translateY(-5px);opacity:0} }
@keyframes pg_heart { 0%{transform:translate(0,0) scale(0);opacity:0} 30%{opacity:1;transform:translate(0,0) scale(1)} 100%{transform:translate(var(--hx),var(--hy)) scale(0.6);opacity:0} }
@keyframes pg_bg { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
@media (prefers-reduced-motion: reduce) { [data-playground] *{animation-duration:0.5s !important;animation-iteration-count:1 !important} }
`;

  return(<div data-playground><Hdr t="🎪 玩耍場" onBack={onBack} cl={c.cl} extra={<button onClick={reroll} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",color:S.t2}}>🎲 換組合</button>}/>
    <style>{styleSheet}</style>

    {/* 場景 */}
    <div style={{
      position:"relative",
      width:"100%",
      height:300,
      borderRadius:18,
      overflow:"hidden",
      marginBottom:14,
      background:"linear-gradient(135deg,#B8E6FF,#E8F5E9 50%,#9CDFA8)",
      backgroundSize:"200% 200%",
      animation:"pg_bg 12s ease infinite",
      boxShadow:"0 4px 16px rgba(0,0,0,0.12)",
      border:"3px solid #E91E63",
    }}>
      {/* 背景裝飾 */}
      <div style={{position:"absolute",top:14,left:20,fontSize:20,opacity:0.5}}>☁️</div>
      <div style={{position:"absolute",top:30,right:30,fontSize:24,opacity:0.6}}>☀️</div>
      <div style={{position:"absolute",top:24,left:"60%",fontSize:14,opacity:0.4}}>☁️</div>

      {/* 寵物 1 - 左側 */}
      <div style={{
        position:"absolute",bottom:60,left:"22%",
        animation:"pg_walk1 1.6s ease-in-out infinite",
      }}>
        <PixelPet petId={def1.id} stage={getPetStage(p1)} size={72} animate={false}/>
        {/* 對話氣泡 */}
        <div key={`b1-${bubbleIdx}`} style={{
          position:"absolute",bottom:"100%",left:"50%",
          transform:"translateX(-50%)",
          marginBottom:8,
          background:"#fff",
          border:`2px solid ${ri1.color}`,
          borderRadius:14,
          padding:"6px 14px",
          fontSize:14,fontWeight:700,
          color:S.t1,
          whiteSpace:"nowrap",
          animation:"pg_bubble 2.8s ease-in-out forwards",
          boxShadow:"0 3px 8px rgba(0,0,0,0.15)",
          zIndex:5,
        }}>
          {dialogue.a}
          <div style={{position:"absolute",bottom:-7,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:`7px solid ${ri1.color}`}}/>
        </div>
      </div>

      {/* 寵物 2 - 右側 */}
      <div style={{
        position:"absolute",bottom:60,right:"22%",
        animation:"pg_walk2 1.6s ease-in-out infinite",
      }}>
        <PixelPet petId={def2.id} stage={getPetStage(p2)} size={72} animate={false}/>
        <div key={`b2-${bubbleIdx}`} style={{
          position:"absolute",bottom:"100%",left:"50%",
          transform:"translateX(-50%)",
          marginBottom:8,
          background:"#fff",
          border:`2px solid ${ri2.color}`,
          borderRadius:14,
          padding:"6px 14px",
          fontSize:14,fontWeight:700,
          color:S.t1,
          whiteSpace:"nowrap",
          animation:"pg_bubble 2.8s 1.2s ease-in-out forwards",
          opacity:0,
          boxShadow:"0 3px 8px rgba(0,0,0,0.15)",
          zIndex:5,
        }}>
          {dialogue.b}
          <div style={{position:"absolute",bottom:-7,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:`7px solid ${ri2.color}`}}/>
        </div>
      </div>

      {/* 已玩耍：愛心爆裂 */}
      {played&&Array.from({length:8}).map((_,i)=>{
        const angle=i*45;
        const dist=60+Math.random()*30;
        return(<div key={`h${i}`} style={{
          position:"absolute",top:"50%",left:"50%",
          fontSize:22,
          "--hx":`${Math.cos(angle*Math.PI/180)*dist}px`,
          "--hy":`${Math.sin(angle*Math.PI/180)*dist-20}px`,
          animation:`pg_heart 1.6s ${i*0.05}s ease-out forwards`,
          opacity:0,
          zIndex:8,
          pointerEvents:"none",
        }}>{i%2?"❤️":"💖"}</div>);
      })}

      {/* 地面 */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:48,background:"linear-gradient(180deg,transparent,#9CDFA8 20%,#7FB28D)",zIndex:1}}/>
      <div style={{position:"absolute",bottom:6,left:0,right:0,textAlign:"center",fontSize:14,letterSpacing:3,zIndex:2}}>🌱🌷🌱🌼🌱🌷🌱🌼🌱</div>
    </div>

    {/* 中文翻譯 */}
    <div style={{...S.card,padding:"14px 18px",marginBottom:12,textAlign:"center",background:`linear-gradient(135deg,#FFE0F0,var(--color-background-primary,#fff))`,border:"2px solid #E91E63"}}>
      <div style={{fontSize:11,color:"#AD1457",fontWeight:600,marginBottom:4}}>💬 牠們在說什麼？</div>
      <div style={{fontSize:15,fontWeight:700,color:S.t1,marginBottom:2}}>"{dialogue.a}" + "{dialogue.b}"</div>
      <div style={{fontSize:12,color:S.t2}}>意思：{dialogue.tip}</div>
    </div>

    <div style={{...S.card,padding:"14px 16px",marginBottom:12,border:"1px solid #E91E6355",background:"linear-gradient(135deg,#FFF7FB,var(--color-background-primary,#fff))"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:8}}>
        <div style={{fontSize:12,fontWeight:1000,color:"#C2185B"}}>English Play Mission</div>
        <button onClick={()=>speak(challenge.q)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:999,padding:"5px 9px",fontSize:11,color:S.t2,cursor:"pointer",fontFamily:"inherit"}}>🔊</button>
      </div>
      <div style={{fontSize:15,fontWeight:900,color:S.t1,lineHeight:1.45,marginBottom:9}}>{challenge.q}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:7}}>
        {challenge.choices.map((choice,i)=>{
          const picked=answer===i;
          const wrong=picked&&i!==challenge.answer;
          const correct=picked&&i===challenge.answer;
          return(<button key={choice} onClick={()=>{setAnswer(i);playSound(i===challenge.answer?"good":"bad");if(i===challenge.answer)speak(challenge.speak)}} disabled={played} style={{padding:"10px 11px",borderRadius:12,border:`2px solid ${correct?"#1D9E75":wrong?"#E24B4A":S.bd}`,background:correct?"#E1F5EE":wrong?"#FCEBEB":S.bg1,color:S.t1,fontSize:13,fontWeight:900,textAlign:"left",cursor:played?"default":"pointer",fontFamily:"inherit"}}>{choice}</button>);
        })}
      </div>
      {answer!==null&&answer!==challenge.answer&&<div style={{fontSize:11,color:"#B42318",fontWeight:800,marginTop:7}}>先選出正確英文，再讓寵物一起玩。</div>}
      {answer===challenge.answer&&<div style={{fontSize:11,color:"#0F6E56",fontWeight:900,marginTop:7}}>答對了，可以開始遊戲獎勵。</div>}
    </div>

    {/* 寵物資訊 */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
      {[{p:p1,def:def1,ri:ri1},{p:p2,def:def2,ri:ri2}].map(({p,def,ri},i)=>(
        <div key={i} style={{...S.card,padding:"10px 12px",textAlign:"center",background:ri.bg,border:`2px solid ${ri.color}`}}>
          <div style={{fontSize:13,fontWeight:700,color:S.t1}}>{def.name}</div>
          <div style={{fontSize:10,color:S.t3,marginTop:2}}>Lv.{p.level} · 💖{p.bond||0}{played?<span style={{color:"#E91E63",fontWeight:700}}> +8 · XP +12</span>:""}</div>
        </div>
      ))}
    </div>

    {/* 主要操作按鈕 */}
    {!played?<button onClick={playTogether} style={{
      ...S.btn,
      width:"100%",
      padding:"16px",
      fontSize:16,
      background:"linear-gradient(135deg,#E91E63,#F06292)",
      color:"#fff",
      boxShadow:"0 4px 12px rgba(233,30,99,0.3)",
    }}>{answer===challenge.answer?"🎉 一起玩耍！(+8 親密度 / XP +12 / 金幣 +8)":"先完成英文任務"}</button>:
    <div style={{textAlign:"center",padding:"14px",background:"#FFE0F0",borderRadius:14,fontSize:14,color:"#C2185B",fontWeight:700,border:"2px solid #E91E63"}}>
      ✨ 玩得很開心！親密度 +8、XP +12、金幣 +8
    </div>}

    <div style={{...S.card,padding:"12px 16px",marginTop:12,background:S.bg2,fontSize:11,color:S.t3,textAlign:"center",lineHeight:1.7}}>
      💡 玩耍會消耗一點體力，但能大大增加親密度！<br/>
      點右上「🎲 換組合」可以選不同的寵物來互動
    </div>
  </div>);
}

// ═══ PETS PAGE (寵物圖鑑 v2 - 養成系統) ════════════════════════════
function PetsPage({onBack,c,pets,setPets,eggs,setEggs,coins,setCoins,inventory,setInventory,petAccount,setPetAccount,petTasks,setPetTasks,incrTask}){
  const[tab,setTab]=useState("tasks");
  const[selectedPet,setSelectedPet]=useState(null);
  const[actionModal,setActionModal]=useState(null);// {pet,action}
  const[shopOpen,setShopOpen]=useState(false);
  const[eventModal,setEventModal]=useState(null);// {pet,event}
  const[milestoneShown,setMilestoneShown]=useState(null);// celebration popup
  const[toast,setToast]=useState(null);// {msg, icon, type}
  const[confirmModal,setConfirmModal]=useState(null);// {msg, onConfirm}
  const[actionCelebration,setActionCelebration]=useState(null);// {actionKey, statText, statColor} (P0-2 視覺優化)
  const[levelUpShown,setLevelUpShown]=useState(null);// {pet, fromLevel, toLevel} (P1-3 升級慶祝)
  const[settingsOpen,setSettingsOpen]=useState(false);// (P2-3 無障礙設定 modal)
  const[animLevel,setAnimLevel]=useLS("eg_animLevel","full");// (P2-3) "full" | "lite" | "off"
  const[playgroundOpen,setPlaygroundOpen]=useState(false);// (P3-1 寵物玩耍場)
  const[hatchAnim,setHatchAnim]=useState(null);// (V19 孵化動畫) {pet, petDef, ri}
  const[petQuery,setPetQuery]=useState("");
  const[petRarity,setPetRarity]=useState("all");
  const[petSort,setPetSort]=useState("need");
  const[eggSort,setEggSort]=useState("ready");
  const[dexQuery,setDexQuery]=useState("");
  const[dexMode,setDexMode]=useState("all");
  const[dexRarity,setDexRarity]=useState("all");

  // (P2-3) 把動畫強度套用到 body class，全域 CSS 控制
  useEffect(()=>{
    if(typeof document==="undefined")return;
    document.body.classList.remove("eg-anim-full","eg-anim-lite","eg-anim-off");
    document.body.classList.add(`eg-anim-${animLevel}`);
  },[animLevel]);

  const showToast=(msg,icon="💬",type="info")=>{
    setToast({msg,icon,type});
    setTimeout(()=>setToast(null),2800);
  };

  // Today's task progress
  const today=new Date().toDateString();
  const taskCounts=petTasks?.date===today?(petTasks.counts||{}):{};
  const[claimedTasks,setClaimedTasks]=useLS("claimedTasks",{date:"",ids:[]});
  const claimedToday=claimedTasks?.date===today?(claimedTasks.ids||[]):[];
  const getPetDef=pet=>PETS[pet.rarity]?.find(p=>p.id===pet.petId);
  const totalPetKinds=Object.values(PETS).reduce((a,list)=>a+list.length,0);
  const ownedIds=useMemo(()=>new Set(pets.map(p=>p.petId)),[pets]);
  const readyEggCount=eggs.filter(e=>e.progress>=EGG_HATCH_TASKS[e.rarity]).length;
  const careNeedCount=pets.reduce((sum,p)=>sum+getCareCount(p),0);
  const bestBond=Math.max(0,...pets.map(p=>p.bond||0));
  const visiblePets=useMemo(()=>{
    const q=petQuery.trim().toLowerCase();
    const rows=pets.map((pet,idx)=>({pet,idx,def:PETS[pet.rarity]?.find(p=>p.id===pet.petId)})).filter(x=>x.def);
    return rows.filter(({pet,def})=>{
      if(petRarity!=="all"&&pet.rarity!==petRarity)return false;
      if(!q)return true;
      return [def.name,def.id,def.story,pet.rarity,...(def.words||[])].some(v=>String(v||"").toLowerCase().includes(q));
    }).sort((a,b)=>{
      if(petSort==="need")return getCareCount(b.pet)-getCareCount(a.pet)||RARITY_ORDER[b.pet.rarity]-RARITY_ORDER[a.pet.rarity]||b.pet.level-a.pet.level;
      if(petSort==="level")return (b.pet.level||1)-(a.pet.level||1)||RARITY_ORDER[b.pet.rarity]-RARITY_ORDER[a.pet.rarity];
      if(petSort==="bond")return (b.pet.bond||0)-(a.pet.bond||0);
      if(petSort==="rarity")return RARITY_ORDER[b.pet.rarity]-RARITY_ORDER[a.pet.rarity]||a.def.name.localeCompare(b.def.name,"zh-Hant");
      return a.idx-b.idx;
    });
  },[pets,petQuery,petRarity,petSort]);
  const visibleEggs=useMemo(()=>{
    return eggs.map((egg,idx)=>({egg,idx,def:PETS[egg.rarity]?.find(p=>p.id===egg.petId)})).filter(x=>x.def).sort((a,b)=>{
      const an=EGG_HATCH_TASKS[a.egg.rarity],bn=EGG_HATCH_TASKS[b.egg.rarity];
      const ar=a.egg.progress>=an,br=b.egg.progress>=bn;
      if(eggSort==="ready")return Number(br)-Number(ar)||RARITY_ORDER[b.egg.rarity]-RARITY_ORDER[a.egg.rarity]||(b.egg.progress/bn)-(a.egg.progress/an);
      if(eggSort==="rarity")return RARITY_ORDER[b.egg.rarity]-RARITY_ORDER[a.egg.rarity]||Number(br)-Number(ar);
      return new Date(b.egg.date||0)-new Date(a.egg.date||0);
    });
  },[eggs,eggSort]);
  const duplicateEggIssueCount=useMemo(()=>{
    const seen=new Set();
    return eggs.reduce((count,egg)=>{
      if(ownedIds.has(egg.petId)||seen.has(egg.petId))return count+1;
      seen.add(egg.petId);
      return count;
    },0);
  },[eggs,ownedIds]);
  const collectionStats=useMemo(()=>{
    const eggIds=new Set(eggs.map(e=>e.petId));
    const eggOnlyIds=[...eggIds].filter(id=>!ownedIds.has(id));
    const missingIds=Object.values(PETS).flat().map(p=>p.id).filter(id=>!ownedIds.has(id));
    const dupeTotal=pets.reduce((sum,p)=>sum+(p.dupes||0),0);
    const resonanceLeader=[...pets].sort((a,b)=>(b.dupes||0)-(a.dupes||0))[0]||null;
    const closestEgg=eggs
      .map(egg=>{
        const needed=EGG_HATCH_TASKS[egg.rarity]||1;
        const def=PETS[egg.rarity]?.find(p=>p.id===egg.petId);
        return{egg,def,needed,pct:Math.min(100,Math.round(((egg.progress||0)/needed)*100)),left:Math.max(0,needed-(egg.progress||0))};
      })
      .filter(x=>x.def)
      .sort((a,b)=>Number(b.egg.progress>=b.needed)-Number(a.egg.progress>=a.needed)||b.pct-a.pct||RARITY_ORDER[b.egg.rarity]-RARITY_ORDER[a.egg.rarity])[0]||null;
    return{eggOnlyCount:eggOnlyIds.length,missingCount:missingIds.length,dupeTotal,resonanceLeader,closestEgg};
  },[eggs,pets,ownedIds]);
  const quickCarePlan=useMemo(()=>{
    const inv={...inventory};
    let feed=0,clean=0,sleep=0,needsFood=0;
    pets.forEach(p=>{
      const food=choosePetFoodForNeed(p,inv);
      if((p.hunger??80)<75){
        if(food){inv[food.id]=Math.max(0,(inv[food.id]||0)-1);feed++}
        else needsFood++;
      }
      if((p.poops||[]).length>0||(p.clean??80)<70)clean++;
      if((p.energy??80)<55)sleep++;
    });
    return{feed,clean,sleep,needsFood,total:feed+clean+sleep};
  },[pets,inventory]);
  const mergeDuplicateEggs=()=>{
    if(!duplicateEggIssueCount)return;
    const now=new Date().toISOString();
    const kept=new Map();
    const rewards={};
    let merged=0,boosted=0;
    eggs.forEach(egg=>{
      if(ownedIds.has(egg.petId)){
        const r=getDuplicatePetReward(egg.rarity);
        rewards[egg.petId]=rewards[egg.petId]?{exp:rewards[egg.petId].exp+r.exp,bond:rewards[egg.petId].bond+r.bond,dupes:rewards[egg.petId].dupes+r.dupes}:r;
        boosted++;
        return;
      }
      const old=kept.get(egg.petId);
      if(!old){kept.set(egg.petId,{...egg});return}
      const gain=Math.max(DUPLICATE_EGG_PROGRESS[egg.rarity]||DUPLICATE_EGG_PROGRESS.N,egg.progress||0);
      const needed=EGG_HATCH_TASKS[old.rarity]||EGG_HATCH_TASKS[egg.rarity];
      old.progress=Math.min(needed,(old.progress||0)+gain);
      old.updatedAt=now;
      merged++;
    });
    if(Object.keys(rewards).length){
      setPets(ps=>ps.map(p=>rewards[p.petId]?applyDuplicatePetReward(p,rewards[p.petId],now):p));
    }
    setEggs([...kept.values()]);
    playSound("combo");
    showToast(`已整理重複蛋：融合 ${merged} 顆，轉成成長能量 ${boosted} 顆`,"✨","info");
  };

  const quickCareAll=()=>{
    const inv={...inventory};
    const now=new Date().toISOString();
    let fed=0,cleaned=0,rested=0,changed=0,needsFood=0;
    const nextPets=pets.map(p=>{
      let updated={...p};
      let touched=false;
      const food=choosePetFoodForNeed(updated,inv);
      if((updated.hunger??80)<75){
        if(food){
          inv[food.id]=Math.max(0,(inv[food.id]||0)-1);
          updated.hunger=Math.min(MAX_STAT,(updated.hunger??80)+food.feed);
          updated.bond=(updated.bond||0)+1;
          fed++;
          touched=true;
        }else{
          needsFood++;
        }
      }
      if((updated.poops||[]).length>0||(updated.clean??80)<70){
        updated.poops=[];
        updated.clean=MAX_STAT;
        updated.bond=(updated.bond||0)+2;
        cleaned++;
        touched=true;
      }
      if((updated.energy??80)<55){
        updated.energy=MAX_STAT;
        rested++;
        touched=true;
      }
      if(!touched)return p;
      changed++;
      return{...updated,lastUpdate:now};
    });
    if(!changed){
      if(needsFood){setShopOpen(true);showToast("有寵物想吃東西，但食物不夠。","🏪","info")}
      else showToast("目前沒有需要快速照顧的寵物。","👍","info");
      return;
    }
    setPets(nextPets);
    setInventory(inv);
    if(selectedPet){
      const refreshed=nextPets.find(p=>p.petId===selectedPet.petId);
      if(refreshed)setSelectedPet(refreshed);
    }
    if(fed)incrTask?.("feedToday",fed);
    if(cleaned)incrTask?.("cleanToday",cleaned);
    playSound("combo");
    showToast(`快速照顧完成：餵食 ${fed}、清潔 ${cleaned}、休息 ${rested}`,"✨","info");
    if(needsFood>0)window.setTimeout(()=>showToast(`${needsFood} 隻寵物還需要食物，記得補貨。`,"🏪","info"),900);
  };

  const claimTask=(task,event)=>{
    if(claimedToday.includes(task.id))return;
    const count=taskCounts[task.statKey]||0;
    if(count<task.target)return;
    // Bond multiplier bonus (if any pet is good friends)
    const maxBond=Math.max(0,...pets.map(p=>p.bond||0));
    const bonus=maxBond>=150?1.2:1;
    const finalCoins=Math.floor(task.reward.coins*bonus);
    setCoins(co=>co+finalCoins);
    // Give exp to highest-bond pet (most cared for)
    if(pets.length>0){
      const topIdx=pets.reduce((best,p,i)=>(p.bond||0)>(pets[best].bond||0)?i:best,0);
      setPets(ps=>{
        const updated=[...ps];
        const p={...updated[topIdx]};
        p.exp=(p.exp||0)+Math.floor(task.reward.exp*bonus);
        updated[topIdx]=levelUpPet(p);
        return updated;
      });
    }
    setClaimedTasks({date:today,ids:[...claimedToday,task.id]});
    playSound("combo");

    // (V20) 從按鈕位置噴金幣 + 中央顯示獎勵文字
    if(typeof triggerRewardBurst==="function"&&event){
      const center=getEventCenter(event);
      triggerRewardBurst({
        emoji:"🪙",count:Math.min(8,finalCoins),
        fromX:center.x,fromY:center.y,
        size:24,duration:1300,
      });
      triggerRewardBurst({
        text:`+${finalCoins} 🪙`,
        fromX:window.innerWidth/2,fromY:"35%",
        textColor:"#FFD700",textSize:36,
        duration:1400,
      });
    }
  };

  // Apply decay on mount
  useEffect(()=>{
    setPets(ps=>ps.map(p=>calcDecay(p)));
  },[]);

  const hatchEgg=(egg)=>{
    const petDef=PETS[egg.rarity].find(p=>p.id===egg.petId);
    if(!petDef)return;
    const ri=RARITY_INFO[egg.rarity];
    // (V19) 觸發孵化動畫
    setHatchAnim({egg,petDef,ri});
    playSound("flip");
    // 動畫播完才實際更新資料
    setTimeout(()=>{
      const now=new Date().toISOString();
      const existingIdx=pets.findIndex(p=>p.petId===egg.petId);
      if(existingIdx>=0){
        const reward=getDuplicatePetReward(egg.rarity);
        setPets(ps=>ps.map(p=>p.petId===egg.petId?applyDuplicatePetReward(p,reward,now):p));
        setSelectedPet(cur=>cur?.petId===egg.petId?applyDuplicatePetReward(cur,reward,now):cur);
        showToast(`${petDef.name} 已擁有，轉成 XP +${reward.exp}、親密 +${reward.bond}`,"✨","info");
      }else{
        setPets(ps=>[...ps,{
          petId:egg.petId,rarity:egg.rarity,level:1,exp:0,dupes:0,
          hunger:100,clean:100,energy:100,bond:0,
          hatchDate:now,lastUpdate:now,
        }]);
      }
      setEggs(es=>es.filter(e=>e.id!==egg.id));
      playSound("done");
    },1200);
  };

  const buyFood=(food,event)=>{
    if(coins<food.cost)return;
    setCoins(co=>co-food.cost);
    setInventory(inv=>({...inv,[food.id]:(inv[food.id]||0)+1}));
    playSound("good");
    // (V20) 食物粒子動畫
    if(typeof triggerRewardBurst==="function"&&event){
      const center=getEventCenter(event);
      triggerRewardBurst({
        emoji:food.emoji,count:5,
        fromX:center.x,fromY:center.y,
        size:28,duration:1100,
      });
    }
  };

  const performAction=(pet,actionKey,foodId=null)=>{
    // Don't let user disturb sleeping pet (except feed which is OK if really hungry)
    if(isPetSleeping()&&actionKey!=="feed"&&actionKey!=="sleep"){
      showToast("Zzz... 寵物正在睡覺，別吵醒他！","💤","sleep");
      return;
    }
    const action=PET_ACTIONS[actionKey];
    const prompts=ACTION_PROMPTS[actionKey];
    const prompt=prompts[Math.floor(Math.random()*prompts.length)];
    setActionModal({pet,actionKey,action,prompt,foodId,step:"learn"});
  };

  const completeAction=(actionKey,foodId)=>{
    const pet=actionModal.pet;
    const petIdx=pets.findIndex(p=>p.petId===pet.petId);
    if(petIdx<0)return;
    let updated={...pets[petIdx]};
    const prevBond=updated.bond||0;

    // 計算狀態變化文字（給粒子動畫的數值跳動用） (P0-2)
    let statText="",statColor="#1D9E75";

    if(actionKey==="feed"&&foodId){
      const food=PET_FOODS.find(f=>f.id===foodId);
      if(food){
        updated.hunger=Math.min(MAX_STAT,(updated.hunger||0)+food.feed);
        setInventory(inv=>({...inv,[foodId]:Math.max(0,(inv[foodId]||0)-1)}));
        statText=`🍖 +${food.feed}`;statColor="#EF9F27";
      }
      incrTask&&incrTask("feedToday");
    }else if(actionKey==="clean"){
      updated.clean=MAX_STAT;
      statText="✨ 滿格";statColor="#4A90E2";
      incrTask&&incrTask("cleanToday");
    }else if(actionKey==="play"){
      updated.bond=(updated.bond||0)+10;
      updated.energy=Math.max(0,(updated.energy||0)-5);
      statText="💖 +10";statColor="#E91E63";
      incrTask&&incrTask("playToday");
    }else if(actionKey==="sleep"){
      updated.energy=MAX_STAT;
      statText="⚡ 滿格";statColor="#7B61FF";
    }else if(actionKey==="study"){
      updated.bond=(updated.bond||0)+15;
      updated.exp=(updated.exp||0)+20;
      statText="XP +30";statColor="#1D9E75";
    }

    const dailyBefore=getPetDailyCultivation(updated);
    const dailyActions=[...new Set([...dailyBefore.actions,actionKey])];
    const cultivationBonus=dailyActions.length>=3&&!dailyBefore.comboClaimed?{exp:30,bond:10,coins:20}:null;
    if(cultivationBonus){
      updated.exp=(updated.exp||0)+cultivationBonus.exp;
      updated.bond=(updated.bond||0)+cultivationBonus.bond;
    }
    updated.careLog={date:dailyBefore.date,actions:dailyActions,comboClaimed:dailyBefore.comboClaimed||!!cultivationBonus};
    updated.exp=(updated.exp||0)+10;
    updated.lastUpdate=new Date().toISOString();
    const prevPetLevel=updated.level;// (P1-3 升級偵測)
    updated=levelUpPet(updated);
    const leveledUp=updated.level>prevPetLevel;// (P1-3)

    // Check for bond milestone crossing
    const prevLevel=getBondLevel(prevBond);
    const newLevel=getBondLevel(updated.bond||0);
    if(newLevel>prevLevel&&newLevel<=BOND_MILESTONES.length){
      setMilestoneShown({milestone:BOND_MILESTONES[newLevel-1],pet:updated});
      playSound("combo");
    }

    setPets(ps=>ps.map((p,i)=>i===petIdx?updated:p));
    setCoins(co=>co+5+(cultivationBonus?.coins||0));// reward for caring
    // Play action sound + pet's own voice for personality
    playActionSound(actionKey);
    setTimeout(()=>playPetSound(pet.petId),400);// pet reacts happily after action

    // 觸發粒子慶祝動畫 (P0-2 視覺優化)
    setActionModal(null);
    if(selectedPet&&selectedPet.petId===pet.petId)setSelectedPet(updated);
    setActionCelebration({actionKey,statText,statColor,bonusText:cultivationBonus?`今日培養完成：XP +${cultivationBonus.exp}、親密 +${cultivationBonus.bond}、金幣 +${cultivationBonus.coins}`:null,foodEmoji:foodId?(PET_FOODS.find(f=>f.id===foodId)?.emoji||"🍖"):null});
    setTimeout(()=>setActionCelebration(null),1400);

    // (P1-3) 升級慶祝：在動作粒子之後顯示
    if(leveledUp){
      setTimeout(()=>{
        setLevelUpShown({pet:updated,fromLevel:prevPetLevel,toLevel:updated.level});
        playSound("combo");
      },1500);
    }
  };

  // Pet Event (random English dialogue) - triggered when opening a pet
  const triggerEvent=(pet)=>{
    // 30% chance per pet selection
    if(Math.random()>0.3)return;
    const ev=PET_EVENTS[Math.floor(Math.random()*PET_EVENTS.length)];
    setEventModal({pet,event:ev,answered:null});
  };

  const answerEvent=(idx)=>{
    if(!eventModal||eventModal.answered!==null)return;
    const correct=idx===eventModal.event.correct;
    setEventModal(m=>({...m,answered:idx}));
    if(correct){
      setCoins(co=>co+eventModal.event.reward.coins);
      setPets(ps=>ps.map(p=>p.petId===eventModal.pet.petId?{...p,bond:(p.bond||0)+eventModal.event.reward.bond,lastUpdate:new Date().toISOString()}:p));
      playSound("combo");
      speak(eventModal.event.choices[eventModal.event.correct]);
    }else{
      playSound("bad");
    }
    setTimeout(()=>setEventModal(null),2500);
  };

  // Bond milestone celebration
  if(milestoneShown){
    const{milestone,pet}=milestoneShown;
    const petDef=PETS[pet.rarity].find(p=>p.id===pet.petId);
    return(<div><Hdr t="🎊 親密度里程碑" onBack={()=>setMilestoneShown(null)} cl={c.cl}/>
      <div style={{...S.card,padding:"32px 20px",textAlign:"center",background:`linear-gradient(135deg,${milestone.color}33,var(--color-background-primary,#fff))`,border:`3px solid ${milestone.color}`,animation:"bounceIn .5s"}}>
        <div style={{fontSize:72,marginBottom:8,animation:"emojiBounce 1s ease-in-out infinite"}}>{milestone.icon}</div>
        <div style={{fontSize:14,color:milestone.color,fontWeight:700,marginBottom:4}}>💖 {pet.bond||0} 親密度</div>
        <div style={{fontSize:24,fontWeight:700,color:S.t1}}>{milestone.title}</div>
        <div style={{fontSize:14,color:S.t2,marginTop:6}}>你和 {petDef.name} 已達到</div>
        <div style={{padding:"12px 16px",background:S.bg2,borderRadius:12,marginTop:14,fontSize:14,color:S.t1,lineHeight:1.6}}>
          🎁 <b style={{color:milestone.color}}>解鎖獎勵</b><br/>
          {milestone.desc}
        </div>
        <button onClick={()=>setMilestoneShown(null)} style={{...S.btn,background:milestone.color,color:"#fff",marginTop:18,padding:"14px 30px",fontSize:15}}>✨ 太棒了！</button>
      </div>
    </div>);
  }

  // (P1-3) 升級慶祝 overlay — 全螢幕煙火效果
  const levelUpOverlay=levelUpShown?(()=>{
    const{pet,fromLevel,toLevel}=levelUpShown;
    const petDef=PETS[pet.rarity].find(p=>p.id===pet.petId);
    if(!petDef)return null;
    return(<LevelUpCelebration pet={pet} petDef={petDef} fromLevel={fromLevel} toLevel={toLevel} onClose={()=>setLevelUpShown(null)}/>);
  })():null;

  // Pet event dialogue modal
  if(eventModal){
    const{pet,event,answered}=eventModal;
    const petDef=PETS[pet.rarity].find(p=>p.id===pet.petId);
    const correct=answered===event.correct;
    return(<div><Hdr t={`💭 ${petDef.name}問你`} onBack={()=>setEventModal(null)} cl={c.cl}/>
      <div style={{...S.card,padding:"24px 20px"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"center",animation:"emojiBounce 1s ease-in-out infinite"}}><PixelPet petId={petDef.id} stage={getPetStage(pet)} size={120}/></div>
          <div style={{marginTop:12,padding:"14px 18px",background:c.bg,borderRadius:16,display:"inline-block",border:`2px solid ${c.cl}`,fontSize:15,fontWeight:600,color:S.t1}}>
            💭 {event.q}
          </div>
        </div>

        <div style={{display:"grid",gap:8}}>
          {event.choices.map((ch,i)=>{
            const isChosen=answered===i;
            const isCorrect=i===event.correct;
            let bg=S.bg1,bd=`1px solid ${S.bd}`;
            if(answered!==null){
              if(isCorrect){bg="#E1F5EE";bd="2px solid #1D9E75"}
              else if(isChosen){bg="#FCEBEB";bd="2px solid #E24B4A"}
            }
            return(<button key={i} onClick={()=>answerEvent(i)} disabled={answered!==null} style={{padding:"14px 16px",borderRadius:12,background:bg,border:bd,textAlign:"left",fontSize:15,fontWeight:500,cursor:answered===null?"pointer":"default",fontFamily:"inherit",color:S.t1,transition:"all .2s",minHeight:52}}>
              {ch} {answered!==null&&isCorrect&&"✅"}{answered!==null&&isChosen&&!isCorrect&&"❌"}
            </button>);
          })}
        </div>

        {answered!==null&&<div style={{marginTop:16,padding:"14px 16px",borderRadius:12,background:correct?"#E1F5EE":"#FFF3CD",textAlign:"center"}}>
          {correct?(<>
            <div style={{fontSize:20,fontWeight:700,color:"#1D9E75"}}>✅ 答對了！</div>
            <div style={{fontSize:13,color:S.t2,marginTop:4}}>🪙 +{event.reward.coins} · 💖 +{event.reward.bond}</div>
          </>):(<>
            <div style={{fontSize:18,fontWeight:700,color:"#EF9F27"}}>❌ 不太對</div>
            <div style={{fontSize:13,color:S.t1,marginTop:4}}>正確答案：<b style={{color:"#1D9E75"}}>{event.choices[event.correct]}</b></div>
          </>)}
        </div>}
      </div>
    </div>);
  }

  // (P3-1) Playground Modal - 兩隻寵物互動
  if(playgroundOpen){
    return(<PlaygroundView pets={pets} setPets={setPets} setCoins={setCoins} c={c} onBack={()=>setPlaygroundOpen(false)} incrTask={incrTask}/>);
  }

  // (P2-3) Settings Modal - 無障礙與省電設定
  if(settingsOpen){
    return(<div><Hdr t="⚙️ 寵物頁設定" onBack={()=>setSettingsOpen(false)} cl={c.cl}/>
      <div style={{...S.card,padding:"18px 18px 22px",marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:700,color:S.t1,marginBottom:6}}>🎬 動畫效果強度</div>
        <div style={{fontSize:12,color:S.t3,lineHeight:1.7,marginBottom:14}}>
          調整寵物互動的動畫強度。如果手機溫度偏高、電池快沒電、或想要更安靜的體驗，可以選擇較低強度。
        </div>
        {[
          {v:"full",icon:"✨",title:"完整效果",desc:"所有粒子、光柱、煙火、震動全部播放"},
          {v:"lite",icon:"🌿",title:"輕量效果",desc:"基本動畫，省略大型粒子與全螢幕特效"},
          {v:"off",icon:"⚡",title:"關閉動畫",desc:"幾乎沒有動畫，最省電、最安靜"},
        ].map(opt=>(<button key={opt.v} onClick={()=>setAnimLevel(opt.v)} style={{
          width:"100%",
          textAlign:"left",
          padding:"14px 16px",
          marginBottom:8,
          background:animLevel===opt.v?`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`:S.bg2,
          border:`2px solid ${animLevel===opt.v?c.cl:S.bd}`,
          borderRadius:14,
          cursor:"pointer",
          fontFamily:"inherit",
          display:"flex",alignItems:"center",gap:12,
          transition:"all .2s",
        }}>
          <span style={{fontSize:28}}>{opt.icon}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:animLevel===opt.v?c.cl:S.t1}}>
              {opt.title}{animLevel===opt.v&&<span style={{marginLeft:6,fontSize:12}}>✓ 使用中</span>}
            </div>
            <div style={{fontSize:11,color:S.t3,marginTop:2,lineHeight:1.5}}>{opt.desc}</div>
          </div>
        </button>))}

        <div style={{marginTop:18,padding:"12px 14px",background:S.bg2,borderRadius:10,fontSize:11,color:S.t3,lineHeight:1.7}}>
          💡 提示：如果系統開啟了「減少動態效果」，動畫也會自動降級。<br/>
          設定會自動儲存，下次打開仍然有效。
        </div>
      </div>

      <button onClick={()=>setSettingsOpen(false)} style={{...S.btn,background:c.cl,color:"#fff",width:"100%",padding:"14px",fontSize:15}}>✓ 完成</button>
    </div>);
  }

  // Action Modal (mini English challenge)
  if(actionModal){
    const{pet,actionKey,action,prompt,foodId}=actionModal;
    const petDef=PETS[pet.rarity].find(p=>p.id===pet.petId);
    return(<div><Hdr t={`${action.icon} ${action.name} ${petDef.emoji}`} onBack={()=>setActionModal(null)} cl={c.cl}/>
      <div style={{...S.card,padding:"28px 20px",textAlign:"center",background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
        <div style={{display:"flex",justifyContent:"center",animation:"emojiBounce 1s ease-in-out infinite"}}><PixelPet petId={petDef.id} stage={getPetStage(pet)} size={96}/></div>
        <div style={{fontSize:14,color:c.cl,fontWeight:600,marginTop:8}}>念出這句話來{action.name}！</div>
        <div style={{...S.card,padding:"18px 14px",marginTop:14,background:"var(--color-background-primary,#fff)"}}>
          <div style={{fontSize:22,fontWeight:700,color:S.t1}}>"{prompt}"</div>
          <button onClick={()=>speak(prompt)} style={{background:"none",border:"none",fontSize:28,cursor:"pointer",marginTop:8,padding:"4px"}}>🔊</button>
        </div>
        <div style={{fontSize:12,color:S.t3,marginTop:12,lineHeight:1.7}}>
          💡 用英文念出這句話給{petDef.name}聽！<br/>
          按「完成」來{action.name}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:16}}>
          <button onClick={()=>setActionModal(null)} style={{...S.btn,background:S.bg2,color:S.t2,fontSize:14}}>取消</button>
          <button onClick={()=>completeAction(actionKey,foodId)} style={{...S.btn,background:c.cl,color:"#fff",fontSize:14}}>✅ 我念完了！</button>
        </div>
      </div>
    </div>);
  }

  // Shop view
  if(shopOpen){
    return(<div><Hdr t="🏪 寵物商店" onBack={()=>setShopOpen(false)} cl={c.cl}/>
      <div style={{...S.card,padding:"14px 18px",marginBottom:12,textAlign:"center",background:"linear-gradient(135deg,#FFF3CD,#FFE066)",border:"2px solid #EF9F27"}}>
        <div style={{fontSize:28,fontWeight:700,color:"#EF9F27"}}>🪙 {coins}</div>
        <div style={{fontSize:11,color:"#856404",marginTop:2}}>購買食物餵食寵物</div>
      </div>
      <div style={{fontSize:13,color:S.t2,marginBottom:10,padding:"0 4px"}}>🍽️ 食物 — 點擊購買（同時學單字！）</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10}}>
        {PET_FOODS.map(food=>{const owned=inventory[food.id]||0;const canBuy=coins>=food.cost;return(<div key={food.id} style={{...S.card,padding:"14px 10px",textAlign:"center",border:canBuy?`1px solid ${S.bd}`:`1px solid ${S.bd}`,opacity:canBuy?1:.5,position:"relative"}}>
          {owned>0&&<div style={{position:"absolute",top:4,right:4,background:c.cl,color:"#fff",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:700}}>×{owned}</div>}
          <div style={{fontSize:40}}>{food.emoji}</div>
          <div style={{fontSize:13,fontWeight:600,color:S.t1,marginTop:4}}>{food.name}</div>
          <div style={{fontSize:11,color:S.t3}}>{food.word} · 🍖+{food.feed}</div>
          <button onClick={(e)=>{buyFood(food,e);speak(food.word)}} disabled={!canBuy} style={{...S.btn,background:canBuy?c.cl:S.bg2,color:canBuy?"#fff":S.t3,marginTop:8,fontSize:12,padding:"6px 12px",width:"100%",cursor:canBuy?"pointer":"not-allowed"}}>🪙 {food.cost}</button>
        </div>)})}
      </div>
      <div style={{...S.card,padding:"12px 16px",marginTop:12,fontSize:12,color:S.t2,lineHeight:1.8}}>
        💡 <b>小提示</b>：點食物按鈕會唸出英文單字，一邊買一邊學！
      </div>
    </div>);
  }

  // Single pet detail view (care page)
  if(selectedPet){
    const petDef=PETS[selectedPet.rarity].find(p=>p.id===selectedPet.petId);
    const ri=RARITY_INFO[selectedPet.rarity];
    const mood=getPetMood(selectedPet);
    const expNeeded=selectedPet.level*100;
    const foodsOwned=PET_FOODS.filter(f=>(inventory[f.id]||0)>0);
    const suggestedFood=choosePetFoodForNeed(selectedPet,inventory);
    const careSuggestion=getPetCareSuggestion(selectedPet,inventory);
    const cultivationPlan=getPetCultivationPlan(selectedPet,inventory);
    const readiness=getPetReadiness(selectedPet);
    const adventureSkill=getPetAdventureSkill(selectedPet);
    const adventureSkillVisual=PET_ADVENTURE_SKILL_VISUALS[adventureSkill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
    const adventureSkillCards=getPetAdventureSkillCards(selectedPet);
    const nextAdventureSkill=getNextPetAdventureSkillCard(selectedPet);
    const duplicateEnergy=getDuplicateEnergyInfo(selectedPet);
    const startSuggestedCare=()=>{
      if(!careSuggestion)return;
      if(careSuggestion.shop){setShopOpen(true);return}
      performAction(selectedPet,careSuggestion.actionKey,careSuggestion.foodId||null);
    };
    const runCultivationAction=action=>{
      if(!action)return;
      if(action.shop){setShopOpen(true);return}
      performAction(selectedPet,action.actionKey,action.foodId||null);
    };

    return(<div>
      {levelUpOverlay}
      <Hdr t={`${petDef.emoji} ${petDef.name}`} onBack={()=>setSelectedPet(null)} cl={c.cl} extra={<button onClick={()=>setShopOpen(true)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",color:S.t2}}>🏪 商店</button>}/>

      {/* Pet Home Scene - immersive environment */}
      <div style={{position:"relative"}}>
      <PetHomeScene pet={selectedPet} petDef={petDef} ri={ri} mood={mood} c={c} onCleanPoop={(poopId)=>{
        const updated={...selectedPet,poops:(selectedPet.poops||[]).filter(p=>p.id!==poopId),clean:Math.min(MAX_STAT,(selectedPet.clean||0)+5),bond:(selectedPet.bond||0)+2,lastUpdate:new Date().toISOString()};
        setPets(ps=>ps.map(p=>p.petId===selectedPet.petId?updated:p));
        setSelectedPet(updated);
        setCoins(co=>co+2);
        playSound("good");
        speak("Clean up!");
      }}/>
      {actionCelebration&&<ActionCelebration data={actionCelebration}/>}
      </div>

      {/* Level + Exp under the home */}
      <div style={{...S.card,padding:"12px 16px",marginBottom:12,textAlign:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:700,color:c.cl}}>Lv.{selectedPet.level}</span>
          <div style={{flex:1,height:8,background:S.bg2,borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${(selectedPet.exp/expNeeded)*100}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,transition:"width .3s"}}/>
          </div>
          <span style={{fontSize:11,color:S.t3}}>{selectedPet.exp}/{expNeeded}</span>
        </div>
      </div>

      <div style={{...S.card,padding:"14px 16px",marginBottom:12,border:`1px solid ${c.cl}33`,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",flexWrap:"wrap",marginBottom:10}}>
          <div>
            <div style={{fontSize:14,fontWeight:1000,color:S.t1}}>今日培養計畫</div>
            <div style={{fontSize:11,color:S.t2,marginTop:2,lineHeight:1.5}}>{cultivationPlan.primary.desc}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:S.t3,fontWeight:800}}>成長力</div>
            <div style={{fontSize:22,fontWeight:1000,color:c.cl}}>{cultivationPlan.score}</div>
          </div>
        </div>
        <div style={{padding:"10px 11px",borderRadius:12,background:S.bg1,border:`1px solid ${c.cl}22`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
          <div style={{flex:1,minWidth:170}}>
            <div style={{fontSize:13,fontWeight:1000,color:c.cl}}>{cultivationPlan.primary.title}</div>
            <div style={{display:"flex",gap:5,marginTop:7,alignItems:"center",flexWrap:"wrap"}}>
              {PET_CULTIVATION_ACTIONS.map(a=>{
                const done=cultivationPlan.daily.actions.includes(a.key);
                return(<span key={a.key} title={a.label} style={{width:26,height:26,borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,border:`1px solid ${done?c.cl:S.bd}`,background:done?c.cl:S.bg2,color:done?"#fff":S.t3}}>{done?"✓":a.short}</span>);
              })}
              <span style={{fontSize:11,color:S.t2,fontWeight:900,marginLeft:2}}>{cultivationPlan.daily.count}/{cultivationPlan.daily.target} 種培養</span>
            </div>
          </div>
          <button onClick={()=>runCultivationAction(cultivationPlan.primary.action)} style={{...S.btn,background:c.cl,color:"#fff",fontSize:12,padding:"10px 13px"}}>{cultivationPlan.primary.action?.label||"開始培養"}</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:10}}>
          <div style={{padding:"9px 10px",borderRadius:12,background:S.bg1,border:`1px solid ${S.bd}`}}>
            <div style={{fontSize:11,color:S.t3,fontWeight:800}}>進化</div>
            <div style={{fontSize:13,fontWeight:900,color:S.t1,marginTop:3}}>{cultivationPlan.evolution.currentLabel} → {cultivationPlan.evolution.nextLabel}</div>
            <div style={{height:6,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${cultivationPlan.evolution.pct}%`,background:c.cl,borderRadius:999}}/></div>
            <div style={{fontSize:10,color:S.t3,marginTop:4}}>{cultivationPlan.evolution.targetLevel?`還差約 ${cultivationPlan.evolution.expLeft} XP`:"已達最終型態"}</div>
          </div>
          <div style={{padding:"9px 10px",borderRadius:12,background:S.bg1,border:`1px solid ${S.bd}`}}>
            <div style={{fontSize:11,color:S.t3,fontWeight:800}}>羈絆</div>
            <div style={{fontSize:13,fontWeight:900,color:S.t1,marginTop:3}}>{cultivationPlan.bond.next?cultivationPlan.bond.next.title:"羈絆滿級"}</div>
            <div style={{height:6,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${cultivationPlan.bond.pct}%`,background:"#E91E63",borderRadius:999}}/></div>
            <div style={{fontSize:10,color:S.t3,marginTop:4}}>{cultivationPlan.bond.next?`還差 ${cultivationPlan.bond.left} 親密度`: "已解鎖全部里程碑"}</div>
          </div>
          <div style={{padding:"9px 10px",borderRadius:12,background:S.bg1,border:`1px solid ${S.bd}`}}>
            <div style={{fontSize:11,color:S.t3,fontWeight:800}}>技能</div>
            <div style={{fontSize:13,fontWeight:900,color:S.t1,marginTop:3}}>{cultivationPlan.nextSkill?`${cultivationPlan.nextSkill.skill.emoji} ${cultivationPlan.nextSkill.skill.zh}`:"技能已完整"}</div>
            <div style={{height:6,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${cultivationPlan.nextSkill?Math.min(100,((selectedPet.level||1)/(cultivationPlan.nextSkill.rule.level||1))*100):100}%`,background:adventureSkillVisual.color,borderRadius:999}}/></div>
            <div style={{fontSize:10,color:S.t3,marginTop:4}}>{cultivationPlan.nextSkill?cultivationPlan.nextSkill.rule.label:"可專心提升等級與羈絆"}</div>
          </div>
        </div>
        {!cultivationPlan.daily.comboClaimed&&<div style={{fontSize:11,color:"#856404",background:"#FFF3CD",border:"1px solid #EF9F2744",borderRadius:10,padding:"7px 9px",lineHeight:1.5,marginBottom:9}}>一天完成 3 種不同培養可得額外 XP +30、親密 +10、金幣 +20。</div>}
        {cultivationPlan.daily.comboClaimed&&<div style={{fontSize:11,color:"#0F6E56",background:"#E1F5EE",border:"1px solid #1D9E7544",borderRadius:10,padding:"7px 9px",lineHeight:1.5,marginBottom:9}}>今日培養獎勵已完成，明天可再次累積。</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(92px,1fr))",gap:7}}>
          {cultivationPlan.actions.map(action=><button key={action.key} onClick={()=>runCultivationAction(action)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:12,padding:"9px 8px",fontSize:12,fontWeight:900,color:S.t1,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <span>{action.emoji}</span><span>{action.label}</span>
          </button>)}
        </div>
      </div>

      {careSuggestion&&<div style={{...S.card,padding:"12px 14px",marginBottom:12,border:`1px solid ${readiness.color}55`,background:`linear-gradient(135deg,${readiness.color}12,var(--color-background-primary,#fff))`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{fontSize:24}}>{careSuggestion.emoji}</div>
        <div style={{flex:1,minWidth:180}}>
          <div style={{fontSize:13,fontWeight:900,color:readiness.color}}>冒險狀態：{readiness.label} · {readiness.avg}/100</div>
          <div style={{fontSize:11,color:S.t2,lineHeight:1.5,marginTop:2}}>{careSuggestion.reason}</div>
        </div>
        <button onClick={startSuggestedCare} style={{...S.btn,background:readiness.color,color:"#fff",fontSize:12,padding:"9px 12px"}}>{careSuggestion.label}</button>
      </div>}

      {/* Status bars (P1-2 液體感狀態條) */}
      <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
        <style>{`
@keyframes statbar_pulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.3)} }
@keyframes statbar_shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
@keyframes statbar_full { 0%,100%{box-shadow:0 0 0 rgba(255,215,0,0)} 50%{box-shadow:0 0 12px rgba(255,215,0,0.7)} }
@keyframes statbar_zzz { 0%{transform:translate(0,0);opacity:0} 30%{opacity:1} 100%{transform:translate(8px,-14px);opacity:0} }
@media (prefers-reduced-motion: reduce) { [data-statbar] *{animation:none !important} }
`}</style>
        <div style={{fontSize:13,fontWeight:600,color:S.t1,marginBottom:10}}>📊 寵物狀態</div>
        {[
          {key:"hunger",label:"🍖 飢餓度",val:selectedPet.hunger||0,color:"#EF9F27",dangerColor:"#E24B4A",icon:"🍖"},
          {key:"clean",label:"✨ 乾淨度",val:selectedPet.clean||0,color:"#4A90E2",dangerColor:"#9CA3AF",icon:"💦"},
          {key:"energy",label:"⚡ 體力",val:selectedPet.energy||0,color:"#1D9E75",dangerColor:"#7B61FF",icon:"⚡"},
          {key:"bond",label:"💖 親密度",val:selectedPet.bond||0,color:"#E91E63",dangerColor:null,icon:"💖"},
        ].map(s=>{
          const pct=Math.round(s.val);
          const isBond=s.key==="bond";
          const displayPct=isBond?Math.min(100,pct):pct;
          const urgent=!isBond&&pct<30;
          const critical=!isBond&&pct<20;
          const full=!isBond&&pct>=100;
          // 漸層色：緊急時偏向 dangerColor
          const barColor=urgent&&s.dangerColor?`linear-gradient(90deg,${s.dangerColor},${s.color})`:`linear-gradient(90deg,${s.color},${s.color}dd,${s.color})`;
          return(<div key={s.key} data-statbar style={{marginBottom:8,position:"relative"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3,alignItems:"center"}}>
              <span style={{color:S.t1,fontWeight:500,display:"flex",alignItems:"center",gap:4}}>
                {s.label}
                {/* 體力低時顯示打瞌睡 */}
                {s.key==="energy"&&pct<30&&!critical&&<span style={{fontSize:10,color:"#7B61FF",animation:"statbar_zzz 1.4s ease-out infinite",display:"inline-block"}}>z</span>}
              </span>
              <span style={{color:critical?"#E24B4A":urgent?"#856404":S.t2,fontWeight:600,display:"flex",alignItems:"center",gap:3}}>
                {pct}{isBond?"":"/100"}
                {critical&&<span style={{animation:"statbar_pulse 0.6s ease-in-out infinite"}}>⚠️</span>}
                {urgent&&!critical&&"⚠️"}
                {full&&<span style={{color:"#FFD700"}}>✨</span>}
              </span>
            </div>
            <div style={{
              height:10,
              background:S.bg2,
              borderRadius:5,
              overflow:"hidden",
              position:"relative",
              boxShadow:critical?"inset 0 0 0 1.5px rgba(226,75,74,0.4)":"inset 0 1px 2px rgba(0,0,0,0.08)",
              animation:full?"statbar_full 1.8s ease-in-out infinite":"none",
            }}>
              <div style={{
                height:"100%",
                width:`${Math.min(100,displayPct)}%`,
                background:barColor,
                borderRadius:5,
                transition:"width .5s cubic-bezier(0.34,1.56,0.64,1), background .3s",
                position:"relative",
                animation:critical?"statbar_pulse 0.8s ease-in-out infinite":"none",
                overflow:"hidden",
              }}>
                {/* 液體流光效果（高於 30 時顯示） */}
                {pct>30&&!isBond&&<div style={{
                  position:"absolute",top:0,left:0,
                  width:"40%",height:"100%",
                  background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)",
                  animation:"statbar_shimmer 2.5s ease-in-out infinite",
                }}/>}
                {/* 親密度條一直閃光 */}
                {isBond&&pct>10&&<div style={{
                  position:"absolute",top:0,left:0,
                  width:"30%",height:"100%",
                  background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)",
                  animation:"statbar_shimmer 3s ease-in-out infinite",
                }}/>}
              </div>
            </div>
          </div>);
        })}
      </div>

      {/* Action buttons */}
      <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:600,color:S.t1,marginBottom:10}}>🎮 互動（每次獲得 🪙 5）</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:8}}>
          {/* Feed — needs food */}
          <button onClick={()=>{if(!suggestedFood){setShopOpen(true)}else{performAction(selectedPet,"feed",suggestedFood.id)}}} style={{...S.btn,background:suggestedFood?"#FFF3CD":S.bg2,color:suggestedFood?"#856404":S.t3,padding:"14px 6px",fontSize:12,display:"flex",flexDirection:"column",gap:2,border:`1px solid ${suggestedFood?"#EF9F27":S.bd}`}}>
            <span style={{fontSize:24}}>🍖</span>
            <span>餵食</span>
            <span style={{fontSize:9,opacity:.7}}>{suggestedFood?`${suggestedFood.word} +${suggestedFood.feed}`:"去商店買"}</span>
          </button>
          <button onClick={()=>performAction(selectedPet,"clean")} style={{...S.btn,background:"#E6F1FB",color:"#185FA5",padding:"14px 6px",fontSize:12,display:"flex",flexDirection:"column",gap:2,border:"1px solid #4A90E2"}}>
            <span style={{fontSize:24}}>🛁</span>
            <span>洗澡</span>
            <span style={{fontSize:9,opacity:.7}}>wash</span>
          </button>
          <button onClick={()=>performAction(selectedPet,"play")} style={{...S.btn,background:"#E1F5EE",color:"#0F6E56",padding:"14px 6px",fontSize:12,display:"flex",flexDirection:"column",gap:2,border:"1px solid #1D9E75"}}>
            <span style={{fontSize:24}}>🎾</span>
            <span>玩耍</span>
            <span style={{fontSize:9,opacity:.7}}>play</span>
          </button>
          <button onClick={()=>performAction(selectedPet,"sleep")} style={{...S.btn,background:"#EDE9FE",color:"#7B61FF",padding:"14px 6px",fontSize:12,display:"flex",flexDirection:"column",gap:2,border:"1px solid #7B61FF"}}>
            <span style={{fontSize:24}}>😴</span>
            <span>睡覺</span>
            <span style={{fontSize:9,opacity:.7}}>sleep</span>
          </button>
          <button onClick={()=>performAction(selectedPet,"study")} style={{...S.btn,background:"#FCEBEB",color:"#E24B4A",padding:"14px 6px",fontSize:12,display:"flex",flexDirection:"column",gap:2,border:"1px solid #E24B4A"}}>
            <span style={{fontSize:24}}>📚</span>
            <span>讀書</span>
            <span style={{fontSize:9,opacity:.7}}>study</span>
          </button>
        </div>
      </div>

      <div style={{...S.card,padding:"14px 16px",marginBottom:12,border:"1px solid #EF9F2744",background:"linear-gradient(135deg,#FFF7D6,var(--color-background-primary,#fff))"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:9}}>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:S.t1}}>重複成長能量</div>
            <div style={{fontSize:11,color:S.t2,marginTop:2}}>抽到或孵到已擁有寵物時，會轉成 XP、親密度與冒險加成。</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:20,fontWeight:1000,color:"#EF9F27"}}>+{duplicateEnergy.dupes}</div>
            <div style={{fontSize:10,color:S.t3,fontWeight:800}}>能量</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
          <div style={{padding:"9px 10px",borderRadius:11,background:S.bg1,border:`1px solid ${S.bd}`}}>
            <div style={{fontSize:11,color:S.t3,fontWeight:800}}>共鳴階段</div>
            <div style={{fontSize:14,fontWeight:1000,color:"#856404",marginTop:3}}>{duplicateEnergy.label}</div>
          </div>
          <div style={{padding:"9px 10px",borderRadius:11,background:S.bg1,border:`1px solid ${S.bd}`}}>
            <div style={{fontSize:11,color:S.t3,fontWeight:800}}>冒險加成</div>
            <div style={{fontSize:14,fontWeight:1000,color:c.cl,marginTop:3}}>戰力 +{duplicateEnergy.adventureBonus}</div>
          </div>
          <div style={{padding:"9px 10px",borderRadius:11,background:S.bg1,border:`1px solid ${S.bd}`}}>
            <div style={{fontSize:11,color:S.t3,fontWeight:800}}>已獲得次數</div>
            <div style={{fontSize:14,fontWeight:1000,color:S.t1,marginTop:3}}>{duplicateEnergy.copies} 次</div>
          </div>
        </div>
        <div style={{marginTop:10}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:S.t3,fontWeight:800,marginBottom:4}}>
            <span>{duplicateEnergy.next?`下一階段需要 ${duplicateEnergy.next} 能量`:"已達最高能量階段"}</span>
            <span>{duplicateEnergy.next?`${duplicateEnergy.dupes}/${duplicateEnergy.next}`:"MAX"}</span>
          </div>
          <div style={{height:7,background:"rgba(0,0,0,.08)",borderRadius:999,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${duplicateEnergy.pct}%`,background:"#EF9F27",borderRadius:999,transition:"width .3s"}}/>
          </div>
        </div>
      </div>

      <div style={{...S.card,padding:"14px 16px",marginBottom:12,border:`1px solid ${adventureSkillVisual.color}44`,background:`linear-gradient(135deg,${adventureSkillVisual.bg},var(--color-background-primary,#fff))`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:S.t1}}>冒險技能</div>
            <div style={{fontSize:11,color:S.t2,marginTop:2}}>照顧、學習與冒險勝利會讓寵物更快解鎖技能。</div>
          </div>
          <button onClick={()=>speak(adventureSkill.words.join(", "))} style={{border:`1px solid ${adventureSkillVisual.color}55`,background:S.bg1,borderRadius:999,padding:"6px 10px",fontSize:11,fontWeight:900,color:adventureSkillVisual.color,cursor:"pointer",fontFamily:"inherit"}}>朗讀技能字</button>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",padding:"10px 11px",borderRadius:12,background:S.bg1,border:`1px solid ${adventureSkillVisual.color}33`,marginBottom:10}}>
          <div style={{fontSize:28}}>{adventureSkill.emoji}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:1000,color:adventureSkillVisual.color}}>{adventureSkill.name} · {adventureSkill.zh}</div>
            <div style={{fontSize:11,color:S.t2,lineHeight:1.5,marginTop:2}}>{adventureSkill.desc}</div>
          </div>
          <div style={{fontSize:12,fontWeight:1000,color:adventureSkillVisual.color}}>Power {adventureSkill.power}</div>
        </div>
        {nextAdventureSkill?<div style={{padding:"9px 10px",borderRadius:12,background:"#FFF3CD",border:"1px solid #EF9F2744",marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:900,color:"#856404"}}>下一個技能：{nextAdventureSkill.skill.emoji} {nextAdventureSkill.skill.zh}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
            <div style={{flex:1,height:7,background:"rgba(0,0,0,.08)",borderRadius:999,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(100,((selectedPet.level||1)/(nextAdventureSkill.rule.level||1))*100)}%`,background:"#EF9F27",borderRadius:999}}/>
            </div>
            <span style={{fontSize:11,color:"#856404",fontWeight:900}}>Lv.{selectedPet.level||1}/{nextAdventureSkill.rule.level}</span>
          </div>
          <div style={{fontSize:11,color:"#856404",marginTop:5,lineHeight:1.5}}>{nextAdventureSkill.rule.learn}</div>
        </div>:<div style={{padding:"9px 10px",borderRadius:12,background:"#E1F5EE",border:"1px solid #1D9E7544",fontSize:12,fontWeight:900,color:"#0F6E56",marginBottom:10}}>已開放目前所有技能，之後可透過冒險勝利繼續累積成長。</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(112px,1fr))",gap:7}}>
          {adventureSkillCards.map(card=>{
            const visual=PET_ADVENTURE_SKILL_VISUALS[card.skill.id]||PET_ADVENTURE_SKILL_VISUALS.wordSpark;
            const pct=card.unlocked?100:Math.min(100,((selectedPet.level||1)/(card.rule.level||1))*100);
            return(<div key={card.skill.id} style={{padding:"8px 9px",borderRadius:11,border:`1px solid ${card.unlocked?visual.color:S.bd}`,background:card.unlocked?visual.bg:S.bg2,opacity:card.unlocked?1:.72}}>
              <div style={{fontSize:12,fontWeight:1000,color:card.unlocked?visual.color:S.t3}}>{card.skill.emoji} {card.skill.zh}</div>
              <div style={{fontSize:10,color:S.t3,marginTop:3}}>{card.unlocked?card.source:`Lv.${card.rule.level}`}</div>
              <div style={{height:5,background:"rgba(0,0,0,.08)",borderRadius:999,overflow:"hidden",marginTop:6}}>
                <div style={{height:"100%",width:`${pct}%`,background:card.unlocked?visual.color:S.t3,borderRadius:999}}/>
              </div>
            </div>);
          })}
        </div>
      </div>

      {/* Pet's words */}
      <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:600,color:S.t1,marginBottom:6}}>📚 {petDef.name}的專屬單字</div>
        <div style={{fontSize:11,color:S.t3,marginBottom:8,lineHeight:1.6}}>{petDef.story}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {petDef.words.map((w,i)=>(<div key={i} style={{padding:"6px 12px",background:S.bg2,borderRadius:10,fontSize:13,fontWeight:600,color:S.t1,cursor:"pointer"}} onClick={()=>speak(w)}>
            {w} 🔊
          </div>))}
        </div>
      </div>

      {selectedPet.dupes>0&&<div style={{textAlign:"center",fontSize:11,color:S.t3,marginTop:8}}>🎊 此寵物已獲得 {selectedPet.dupes+1} 次，重複能量會提高冒險表現。</div>}
    </div>);
  }

  // Tab views
  return(<div>
    {hatchAnim&&<HatchAnimation data={hatchAnim} onClose={()=>setHatchAnim(null)}/>}
    <Hdr t="🐾 寵物圖鑑" onBack={onBack} cl={c.cl} extra={<div style={{display:"flex",gap:4}}><button onClick={()=>setSettingsOpen(true)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 10px",fontSize:13,cursor:"pointer",color:S.t2}} title="設定">⚙️</button><button onClick={()=>setShopOpen(true)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",color:S.t2}}>🏪 商店</button></div>}/>
    <style>{`
/* (P2-3) 動畫強度全域控制 */
body.eg-anim-lite [data-action-celebration],
body.eg-anim-lite [data-levelup],
body.eg-anim-lite [data-gacha-ceremony] *:not(div) { animation-duration: 0.6s !important; animation-iteration-count: 1 !important; }
body.eg-anim-lite [data-pet-card] *,
body.eg-anim-lite [data-statbar] * { animation-duration: 4s !important; }
body.eg-anim-off [data-action-celebration],
body.eg-anim-off [data-levelup] { display: none !important; }
body.eg-anim-off [data-gacha-ceremony] *,
body.eg-anim-off [data-pet-card] *,
body.eg-anim-off [data-statbar] * { animation: none !important; transition: none !important; }
body.eg-anim-off [data-pet-card] { animation: none !important; }
`}</style>

    {/* Toast notification (cute, auto-dismiss) */}
    {toast&&<div style={{position:"fixed",bottom:30,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:toast.type==="sleep"?"linear-gradient(135deg,#5C6BC0,#3949AB)":"linear-gradient(135deg,"+c.cl+","+c.ac+")",color:"#fff",padding:"14px 22px",borderRadius:24,fontSize:14,fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,.3)",animation:"toastIn .3s ease-out, toastOut .3s ease-in 2.5s forwards",display:"flex",alignItems:"center",gap:10,maxWidth:"calc(100% - 40px)"}}>
      <style>{`
        @keyframes toastIn{from{transform:translateX(-50%) translateY(60px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
        @keyframes toastOut{to{transform:translateX(-50%) translateY(60px);opacity:0}}
      `}</style>
      <span style={{fontSize:22}}>{toast.icon}</span>
      <span>{toast.msg}</span>
    </div>}

    {/* Custom Confirm Modal (replaces window.confirm) */}
    {confirmModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeUp .25s"}} onClick={()=>setConfirmModal(null)}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--color-background-primary,#fff)",borderRadius:20,padding:"24px 22px",maxWidth:340,width:"100%",textAlign:"center",border:`2px solid ${c.cl}`,boxShadow:`0 12px 32px ${c.cl}33`,animation:"bounceIn .35s ease-out"}}>
        <div style={{fontSize:48,marginBottom:8}}>{confirmModal.icon}</div>
        <div style={{fontSize:14,color:S.t1,lineHeight:1.7,marginBottom:20,whiteSpace:"pre-line"}}>{confirmModal.msg}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <button onClick={()=>setConfirmModal(null)} style={{...S.btn,background:S.bg2,color:S.t1,padding:"12px",fontSize:13}}>取消</button>
          <button onClick={()=>{const fn=confirmModal.onConfirm;setConfirmModal(null);fn&&fn()}} style={{...S.btn,background:c.cl,color:"#fff",padding:"12px",fontSize:13}}>確定</button>
        </div>
      </div>
    </div>}
    {/* Account bar */}
    {petAccount&&<div style={{...S.card,padding:"8px 14px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",background:`${c.cl}08`}}>
      <div style={{fontSize:12,color:S.t2}}>👤 <b style={{color:c.cl}}>{petAccount.username}</b> <span style={{color:S.t3,marginLeft:4}}>· 已同步雲端 ☁️</span></div>
      <button onClick={()=>setConfirmModal({msg:"登出帳號？\n\n本地寵物資料將保留，但不會再同步到雲端。",icon:"👋",onConfirm:()=>setPetAccount(null)})} style={{background:"none",border:"none",fontSize:11,color:S.t3,cursor:"pointer",padding:"4px 8px",textDecoration:"underline"}}>登出</button>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:12}}>
      <button onClick={()=>setTab("dex")} style={{...S.card,padding:"12px",textAlign:"left",cursor:"pointer",fontFamily:"inherit",background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
        <div style={{fontSize:11,color:S.t2,fontWeight:800}}>收藏完成度</div>
        <div style={{fontSize:20,fontWeight:900,color:c.cl,marginTop:2}}>{ownedIds.size}/{totalPetKinds}</div>
        <div style={{height:6,background:S.bg2,borderRadius:999,overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${Math.round(ownedIds.size/totalPetKinds*100)}%`,background:c.cl,borderRadius:999}}/></div>
      </button>
      <button onClick={()=>setTab("eggs")} style={{...S.card,padding:"12px",textAlign:"left",cursor:"pointer",fontFamily:"inherit",background:S.bg1}}>
        <div style={{fontSize:11,color:S.t2,fontWeight:800}}>蛋倉</div>
        <div style={{fontSize:20,fontWeight:900,color:S.t1,marginTop:2}}>🥚 {eggs.length}</div>
        <div style={{fontSize:11,color:readyEggCount?c.cl:S.t3,fontWeight:800,marginTop:3}}>{readyEggCount?`${readyEggCount} 顆可孵化`:collectionStats.eggOnlyCount?`${collectionStats.eggOnlyCount} 種新寵物蛋中`:"完成學習來孵蛋"}</div>
      </button>
      <button onClick={()=>setTab("pets")} style={{...S.card,padding:"12px",textAlign:"left",cursor:"pointer",fontFamily:"inherit",background:S.bg1,border:careNeedCount?`1px solid #EF9F27`:`1px solid ${S.bd}`}}>
        <div style={{fontSize:11,color:S.t2,fontWeight:800}}>照顧提醒</div>
        <div style={{fontSize:20,fontWeight:900,color:careNeedCount?"#EF9F27":S.t1,marginTop:2}}>{careNeedCount}</div>
        <div style={{fontSize:11,color:S.t3,fontWeight:800,marginTop:3}}>最高羈絆 {bestBond}</div>
      </button>
      <button onClick={()=>setTab("pets")} style={{...S.card,padding:"12px",textAlign:"left",cursor:"pointer",fontFamily:"inherit",background:"linear-gradient(135deg,#FFF3CD,var(--color-background-primary,#fff))",border:"1px solid #EF9F2744"}}>
        <div style={{fontSize:11,color:"#856404",fontWeight:800}}>重複能量</div>
        <div style={{fontSize:20,fontWeight:900,color:"#EF9F27",marginTop:2}}>✨ {collectionStats.dupeTotal}</div>
        <div style={{fontSize:11,color:"#856404",fontWeight:800,marginTop:3}}>{collectionStats.resonanceLeader?`最高 ${getDuplicateEnergyInfo(collectionStats.resonanceLeader).label}`:"抽到重複會成長"}</div>
      </button>
    </div>
    <div style={{...S.card,padding:"11px 14px",marginBottom:12,border:`1px solid ${collectionStats.closestEgg?.egg?.progress>=collectionStats.closestEgg?.needed?c.cl:S.bd}`,background:collectionStats.closestEgg?"linear-gradient(135deg,#F7FBFF,var(--color-background-primary,#fff))":S.bg1,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{fontSize:24}}>{readyEggCount?"🎉":collectionStats.closestEgg?"🥚":"📖"}</div>
      <div style={{flex:1,minWidth:190}}>
        <div style={{fontSize:12,fontWeight:900,color:S.t1}}>下一步建議</div>
        <div style={{fontSize:11,color:S.t2,lineHeight:1.5,marginTop:2}}>
          {readyEggCount?`有 ${readyEggCount} 顆蛋可以孵化，先去蛋倉看看。`:collectionStats.closestEgg?`${collectionStats.closestEgg.def.name} 蛋最接近孵化，還差 ${collectionStats.closestEgg.left} 題英文。`:collectionStats.missingCount?`圖鑑還缺 ${collectionStats.missingCount} 種寵物，可以透過扭蛋與冒險獎勵慢慢收集。`:"圖鑑已收齊，接下來可以培養親密度與重複能量。"}
        </div>
      </div>
      <button onClick={()=>setTab(readyEggCount||collectionStats.closestEgg?"eggs":"dex")} style={{...S.btn,background:c.cl,color:"#fff",fontSize:12,padding:"9px 12px"}}>{readyEggCount||collectionStats.closestEgg?"去蛋倉":"看圖鑑"}</button>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto"}}>
      <button onClick={()=>setTab("tasks")} style={{flex:"1 1 auto",padding:"10px 6px",borderRadius:12,background:tab==="tasks"?c.cl:S.bg2,color:tab==="tasks"?"#fff":S.t1,border:tab==="tasks"?"none":`1px solid ${S.bd}`,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>📋 任務 ({DAILY_TASK_DEFS.filter(t=>!claimedToday.includes(t.id)&&(taskCounts[t.statKey]||0)>=t.target).length})</button>
      <button onClick={()=>setTab("eggs")} style={{flex:"1 1 auto",padding:"10px 6px",borderRadius:12,background:tab==="eggs"?c.cl:S.bg2,color:tab==="eggs"?"#fff":S.t1,border:tab==="eggs"?"none":`1px solid ${S.bd}`,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>🥚 蛋 ({eggs.length})</button>
      <button onClick={()=>setTab("pets")} style={{flex:"1 1 auto",padding:"10px 6px",borderRadius:12,background:tab==="pets"?c.cl:S.bg2,color:tab==="pets"?"#fff":S.t1,border:tab==="pets"?"none":`1px solid ${S.bd}`,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>🐾 寵物 ({pets.length})</button>
      <button onClick={()=>setTab("dex")} style={{flex:"1 1 auto",padding:"10px 6px",borderRadius:12,background:tab==="dex"?c.cl:S.bg2,color:tab==="dex"?"#fff":S.t1,border:tab==="dex"?"none":`1px solid ${S.bd}`,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>📖 圖鑑</button>
    </div>

    {tab==="tasks"?(<div>
      {/* Daily tasks intro */}
      <div style={{...S.card,padding:"14px 16px",marginBottom:12,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
        <div style={{fontSize:14,fontWeight:700,color:S.t1,marginBottom:4}}>📋 每日英文任務</div>
        <div style={{fontSize:12,color:S.t2,lineHeight:1.7}}>
          完成任務拿獎勵！獎勵會給你最親密的寵物。<br/>
          {pets.length>0&&Math.max(...pets.map(p=>p.bond||0))>=150&&<span style={{color:"#1D9E75",fontWeight:600}}>💖 親密寵物加成：獎勵 +20%</span>}
        </div>
        <div style={{marginTop:8,display:"flex",gap:4,alignItems:"center",fontSize:11,color:S.t3}}>
          <span>📅 {today}</span>
          <span style={{marginLeft:"auto"}}>已完成 {claimedToday.length}/{DAILY_TASK_DEFS.length}</span>
        </div>
      </div>

      {/* Task list */}
      <div style={{display:"grid",gap:10}}>
        {DAILY_TASK_DEFS.map(task=>{
          const count=taskCounts[task.statKey]||0;
          const done=count>=task.target;
          const claimed=claimedToday.includes(task.id);
          const pct=Math.min(100,(count/task.target)*100);
          return(<div key={task.id} style={{...S.card,padding:"14px 16px",border:claimed?`2px solid ${S.bd}`:done?`2px solid #1D9E75`:`1px solid ${S.bd}`,opacity:claimed?.6:1,transition:"all .2s"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:32,opacity:claimed?.5:1}}>{task.icon}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14,fontWeight:600,color:S.t1}}>{task.name}</span>
                  {claimed&&<span style={{fontSize:11,color:"#1D9E75",fontWeight:700}}>✓ 已領取</span>}
                </div>
                <div style={{fontSize:11,color:S.t3,marginTop:2}}>{task.desc}</div>
                {/* Progress bar */}
                <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
                  <div style={{flex:1,height:6,background:S.bg2,borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:done?`linear-gradient(90deg,#1D9E75,${c.ac})`:c.cl,transition:"width .3s"}}/>
                  </div>
                  <span style={{fontSize:11,color:S.t2,fontWeight:600,minWidth:40,textAlign:"right"}}>{count}/{task.target}</span>
                </div>
                <div style={{fontSize:11,color:S.t3,marginTop:4}}>獎勵：🪙 {task.reward.coins} · ⭐ {task.reward.exp} Exp</div>
              </div>
              {done&&!claimed&&<button onClick={(e)=>claimTask(task,e)} style={{...S.btn,background:`linear-gradient(135deg,#1D9E75,${c.ac})`,color:"#fff",padding:"10px 14px",fontSize:13,animation:"emojiPulse 1.2s infinite"}}>🎁 領取</button>}
            </div>
          </div>);
        })}
      </div>

      {/* Bond rewards showcase */}
      {pets.length>0&&<div style={{...S.card,padding:"14px 16px",marginTop:12}}>
        <div style={{fontSize:13,fontWeight:600,color:S.t1,marginBottom:8}}>💖 羈絆等級（最高親密度寵物）</div>
        {(()=>{const maxBond=Math.max(0,...pets.map(p=>p.bond||0));const curLevel=getBondLevel(maxBond);return(<>
          <div style={{fontSize:11,color:S.t2,marginBottom:6}}>目前：💖 {maxBond} / 下一級 {curLevel<BOND_MILESTONES.length?BOND_MILESTONES[curLevel].bond:"MAX"}</div>
          <div style={{display:"grid",gap:4}}>
            {BOND_MILESTONES.map((m,i)=>{const unlocked=maxBond>=m.bond;return(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:8,background:unlocked?`${m.color}22`:S.bg2,border:unlocked?`1px solid ${m.color}`:`1px solid ${S.bd}`,opacity:unlocked?1:.5}}>
              <span style={{fontSize:18}}>{m.icon}</span>
              <span style={{flex:1,fontSize:12,fontWeight:600,color:S.t1}}>{m.title}</span>
              <span style={{fontSize:11,color:S.t2}}>{m.bond}</span>
              {unlocked&&<span style={{fontSize:10,color:m.color,fontWeight:700}}>✓</span>}
            </div>)})}
          </div>
        </>)})()}
      </div>}
    </div>):tab==="eggs"?(eggs.length===0?(<div style={{textAlign:"center",padding:"48px 16px"}}>
      <div style={{fontSize:48,marginBottom:8}}>🥚</div>
      <div style={{fontSize:16,fontWeight:600,color:S.t1}}>還沒有蛋！</div>
      <div style={{fontSize:13,color:S.t2,marginTop:4}}>去扭蛋機抽一顆吧！</div>
    </div>):(
    <>
    <div style={{...S.card,padding:"10px 12px",marginBottom:10,display:"flex",gap:8,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
      <div style={{fontSize:12,color:S.t2,fontWeight:800}}>蛋倉排序</div>
      <div style={{display:"flex",gap:5}}>
        {[{k:"ready",l:"可孵化優先"},{k:"rarity",l:"稀有度"},{k:"new",l:"最新"}].map(o=><button key={o.k} onClick={()=>setEggSort(o.k)} style={{border:`1px solid ${eggSort===o.k?c.cl:S.bd}`,background:eggSort===o.k?c.bg:S.bg1,color:eggSort===o.k?c.cl:S.t2,borderRadius:999,padding:"6px 9px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{o.l}</button>)}
      </div>
    </div>
    {duplicateEggIssueCount>0&&<div style={{...S.card,padding:"12px",marginBottom:10,border:"1px solid #EF9F27",background:"#FFF3CD",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:180}}><div style={{fontSize:13,fontWeight:900,color:"#856404"}}>偵測到 {duplicateEggIssueCount} 顆重複蛋</div><div style={{fontSize:11,color:"#856404",marginTop:2}}>重複蛋可融合成孵化進度；已擁有寵物的蛋會轉成 XP 與親密度。</div></div>
      <button onClick={mergeDuplicateEggs} style={{...S.btn,background:"#EF9F27",color:"#fff",padding:"9px 12px",fontSize:12}}>整理重複蛋</button>
    </div>}
    <div style={{display:"grid",gap:10}}>
      {visibleEggs.map(({egg})=>{
        const petDef=PETS[egg.rarity].find(p=>p.id===egg.petId);
        if(!petDef)return null;
        const ri=RARITY_INFO[egg.rarity];
        const needed=EGG_HATCH_TASKS[egg.rarity];
        const ready=egg.progress>=needed;
        const ownedAlready=ownedIds.has(egg.petId);
        const duplicateReward=getDuplicatePetReward(egg.rarity);
        return(<div key={egg.id} style={{...S.card,padding:"16px",border:`2px solid ${ri.color}`,background:ready?`linear-gradient(135deg,${ri.bg},var(--color-background-primary,#fff))`:"var(--color-background-primary,#fff)"}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",animation:ready?"emojiBounce 1s infinite":"none"}}><PixelPet petId={egg.petId} stage="egg" size={56}/></div>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:10,fontWeight:700,color:ri.color,background:ri.bg,padding:"2px 8px",borderRadius:10}}>{ri.stars} {ri.label}</span>
                <span style={{fontSize:10,fontWeight:900,color:ownedAlready?"#856404":"#0F6E56",background:ownedAlready?"#FFF3CD":"#E1F5EE",border:`1px solid ${ownedAlready?"#EF9F2744":"#1D9E7544"}`,padding:"2px 7px",borderRadius:999}}>{ownedAlready?"已擁有 · 轉能量":"新寵物蛋"}</span>
              </div>
              <div style={{fontSize:15,fontWeight:700,color:S.t1,marginTop:4}}>{petDef.name} 蛋</div>
              <div style={{fontSize:11,color:S.t3,fontStyle:"italic"}}>{petDef.story}</div>
              {ownedAlready&&<div style={{fontSize:11,color:"#856404",fontWeight:800,marginTop:4}}>孵化後轉成 XP +{duplicateReward.exp}、親密 +{duplicateReward.bond}、能量 +1</div>}
              <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
                <div style={{flex:1,height:8,background:S.bg2,borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,(egg.progress/needed)*100)}%`,background:`linear-gradient(90deg,${ri.color},${c.ac})`,transition:"width .3s"}}/>
                </div>
                <span style={{fontSize:11,color:S.t2,fontWeight:600,minWidth:48,textAlign:"right"}}>{egg.progress}/{needed}</span>
              </div>
            </div>
          </div>
          {ready&&<button onClick={()=>hatchEgg(egg)} style={{...S.btn,background:`linear-gradient(135deg,${ri.color},${c.ac})`,color:"#fff",width:"100%",marginTop:12,padding:"12px",fontSize:15,animation:"emojiPulse 1s infinite"}}>{ownedAlready?"✨ 孵化轉成長能量":"🎉 可以孵化了！點我"}</button>}
          {!ready&&<div style={{marginTop:10,fontSize:12,color:S.t3,textAlign:"center"}}>{ownedAlready?"✨ 可先用「整理重複蛋」轉成能量":"💪 再答對 "+(needed-egg.progress)+" 題就能孵化！"}</div>}
        </div>);
      })}
    </div>
    </>)):tab==="pets"?(
    pets.length===0?(<div style={{textAlign:"center",padding:"48px 16px"}}>
      <div style={{fontSize:48,marginBottom:8}}>🐣</div>
      <div style={{fontSize:16,fontWeight:600,color:S.t1}}>還沒有寵物！</div>
      <div style={{fontSize:13,color:S.t2,marginTop:4}}>先去扭蛋機獲得蛋，然後學習孵化吧！</div>
    </div>):(
    <>
    <style>{`
@keyframes pet_urgentRing { 0%,100%{box-shadow:0 0 0 0 rgba(226,75,74,.55)} 50%{box-shadow:0 0 0 6px rgba(226,75,74,0)} }
@keyframes pet_moodBob { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-3px) rotate(4deg)} }
@keyframes pet_sleepZ { 0%{transform:translate(0,0) scale(.8);opacity:0} 20%{opacity:.9} 100%{transform:translate(10px,-18px) scale(1.3);opacity:0} }
@keyframes pet_badgePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
@keyframes pet_breatheHappy { 0%,100%{transform:scaleY(1) translateY(0)} 50%{transform:scaleY(1.04) translateY(-2px)} }
@keyframes pet_breatheTired { 0%,100%{transform:scaleY(1) translateY(0)} 50%{transform:scaleY(0.97) translateY(1px)} }
@keyframes pet_breatheUrgent { 0%,100%{transform:translateX(0) scaleY(1)} 25%{transform:translateX(-1px) scaleY(0.98)} 75%{transform:translateX(1px) scaleY(0.98)} }
@keyframes pet_breatheSleep { 0%,100%{transform:scaleY(1) translateY(0)} 50%{transform:scaleY(1.06) translateY(-1px)} }
@media (prefers-reduced-motion: reduce) { [data-pet-card] *{animation:none !important} }
`}</style>
    {(quickCarePlan.total>0||quickCarePlan.needsFood>0)&&<div style={{...S.card,padding:"12px 14px",marginBottom:10,border:"1px solid #EF9F27",background:"linear-gradient(135deg,#FFF3CD,var(--color-background-primary,#fff))",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{fontSize:25}}>🧺</div>
      <div style={{flex:1,minWidth:190}}>
        <div style={{fontSize:13,fontWeight:900,color:"#856404"}}>照顧提醒</div>
        <div style={{fontSize:11,color:"#856404",lineHeight:1.5,marginTop:2}}>可快速處理：餵食 {quickCarePlan.feed}、清潔 {quickCarePlan.clean}、休息 {quickCarePlan.sleep}{quickCarePlan.needsFood?`；另有 ${quickCarePlan.needsFood} 隻缺食物`:""}。</div>
      </div>
      <button onClick={quickCareAll} style={{...S.btn,background:"#EF9F27",color:"#fff",fontSize:12,padding:"9px 12px"}}>{quickCarePlan.total>0?"一鍵照顧":"去補食物"}</button>
    </div>}
    <div style={{...S.card,padding:"12px",marginBottom:10,display:"grid",gap:8}}>
      <input value={petQuery} onChange={e=>setPetQuery(e.target.value)} placeholder="搜尋寵物、單字、故事..." style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:10,border:`1px solid ${S.bd}`,background:S.bg1,color:S.t1,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
        {[{k:"all",l:"全部"},{k:"N",l:"普通"},{k:"R",l:"稀有"},{k:"SR",l:"超稀有"},{k:"SSR",l:"極稀有"}].map(o=><button key={o.k} onClick={()=>setPetRarity(o.k)} style={{flexShrink:0,border:`1px solid ${petRarity===o.k?c.cl:S.bd}`,background:petRarity===o.k?c.bg:S.bg1,color:petRarity===o.k?c.cl:S.t2,borderRadius:999,padding:"6px 10px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{o.l}</button>)}
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
        <div style={{fontSize:11,color:S.t3,fontWeight:800}}>顯示 {visiblePets.length}/{pets.length} 隻</div>
        <select value={petSort} onChange={e=>setPetSort(e.target.value)} style={{padding:"7px 10px",borderRadius:9,border:`1px solid ${S.bd}`,background:S.bg1,color:S.t1,fontSize:12,fontFamily:"inherit",fontWeight:700}}>
          <option value="need">最需要照顧</option>
          <option value="level">等級高到低</option>
          <option value="bond">親密度高到低</option>
          <option value="rarity">稀有度高到低</option>
          <option value="new">取得順序</option>
        </select>
      </div>
    </div>
    {/* (P3-1) 玩耍場入口（多隻寵物時才顯示） */}
    {pets.length>=2&&<button onClick={()=>setPlaygroundOpen(true)} style={{
      width:"100%",
      padding:"14px 16px",
      marginBottom:12,
      background:`linear-gradient(135deg,#FFE0F0,#FFD1DC,#E1BEE7)`,
      border:"2px solid #E91E63",
      borderRadius:14,
      cursor:"pointer",
      fontFamily:"inherit",
      display:"flex",alignItems:"center",justifyContent:"center",gap:10,
      boxShadow:"0 3px 10px rgba(233,30,99,0.2)",
      transition:"transform .15s",
    }} onTouchStart={e=>e.currentTarget.style.transform="scale(0.97)"} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
      <span style={{fontSize:24}}>🎪</span>
      <div style={{textAlign:"left",flex:1}}>
        <div style={{fontSize:14,fontWeight:700,color:"#C2185B"}}>一起玩耍場</div>
        <div style={{fontSize:11,color:"#AD1457",marginTop:2}}>完成英文小任務，再讓兩隻寵物一起玩並拿獎勵。</div>
      </div>
      <span style={{fontSize:18,color:"#C2185B"}}>→</span>
    </button>}
    {visiblePets.length===0&&<div style={{...S.card,padding:"26px 16px",textAlign:"center",fontSize:13,color:S.t2,marginBottom:10}}>找不到符合條件的寵物。</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10}}>
      {visiblePets.map(({pet,def:petDef},i)=>{
        if(!petDef)return null;
        const ri=RARITY_INFO[pet.rarity];
        const need=getPetUrgentNeed(pet);
        const careCount=getCareCount(pet);
        const sleeping=isPetSleeping();
        const stats=[
          {v:pet.hunger??80,c:"#EF9F27"},
          {v:pet.clean??80,c:"#4A90E2"},
          {v:pet.energy??80,c:"#1D9E75"},
          {v:Math.min(100,(pet.bond||0)/3),c:"#E91E63"},
        ];
        const isUrgent=need.urgency===2;
        const duplicateInfo=getDuplicateEnergyInfo(pet);
        return(
        <div key={i} data-pet-card onClick={()=>{setSelectedPet(pet);triggerEvent(pet)}}
          style={{
            ...S.card,
            padding:"10px 8px 8px",
            textAlign:"center",
            border:`2px solid ${isUrgent?"#E24B4A":need.urgency===1?"#EF9F27":ri.color}`,
            background:ri.bg,
            cursor:"pointer",
            transition:"transform .15s",
            position:"relative",
            overflow:"hidden",
            animation:isUrgent?"pet_urgentRing 1.4s ease-in-out infinite":"none",
            boxShadow:duplicateInfo.dupes>0?`0 6px 18px rgba(239,159,39,${Math.min(.32,.12+duplicateInfo.dupes*.025)})`:undefined,
          }}
          onTouchStart={e=>e.currentTarget.style.transform="scale(0.95)"}
          onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}
        >
          {/* 心情氣泡 - 左上 */}
          <div style={{
            position:"absolute",top:6,left:6,
            background:"#fff",borderRadius:14,
            padding:"2px 7px 2px 5px",
            fontSize:11,fontWeight:600,
            color:isUrgent?"#E24B4A":need.urgency===1?"#856404":"#5F5E5A",
            boxShadow:"0 1px 3px rgba(0,0,0,.12)",
            display:"flex",alignItems:"center",gap:3,
            zIndex:3,
            animation:need.urgency>0?"pet_moodBob 1.6s ease-in-out infinite":"none",
          }}>
            <span style={{fontSize:13}}>{need.emoji}</span>
            <span style={{fontSize:9,letterSpacing:.5}}>{need.label}</span>
          </div>

          {/* 待辦徽章 - 右上 */}
          {careCount>0&&<div style={{
            position:"absolute",top:-6,right:-6,
            background:"#E24B4A",color:"#fff",
            borderRadius:"50%",width:24,height:24,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,fontWeight:700,
            boxShadow:"0 2px 6px rgba(226,75,74,.4)",
            animation:"pet_badgePulse 1s ease-in-out infinite",
            zIndex:4,
          }}>{careCount}</div>}

          {/* 稀有度星星 */}
          <div style={{fontSize:10,fontWeight:700,color:ri.color,marginTop:14}}>{ri.stars}</div>

          {/* 寵物本體（依心情切換動畫節奏） (P1-1) */}
          <div style={{
            margin:"4px auto",
            display:"flex",justifyContent:"center",
            position:"relative",
            animation:sleeping?"pet_breatheSleep 4s ease-in-out infinite":(isUrgent?"pet_breatheUrgent 0.8s ease-in-out infinite":(need.urgency===1?"pet_breatheTired 3.5s ease-in-out infinite":"pet_breatheHappy 2.4s ease-in-out infinite")),
            animationDelay:`${i*0.2}s`,
            opacity:sleeping?0.65:1,
            filter:sleeping?"saturate(0.7)":"none",
            transition:"opacity .3s, filter .3s",
          }}>
            <PixelPet petId={petDef.id} stage={getPetStage(pet)} size={56} animate={false}/>
            {sleeping&&<>
              <span style={{position:"absolute",top:-4,right:8,fontSize:11,color:"#7B61FF",fontWeight:700,animation:"pet_sleepZ 2s ease-out infinite"}}>z</span>
              <span style={{position:"absolute",top:-4,right:8,fontSize:11,color:"#7B61FF",fontWeight:700,animation:"pet_sleepZ 2s ease-out infinite",animationDelay:"0.7s"}}>Z</span>
            </>}
          </div>

          {/* 寵物名稱 */}
          <div style={{fontSize:12,fontWeight:600,color:S.t1}}>{petDef.name}</div>

          {/* 等級 */}
          <div style={{fontSize:10,color:c.cl,fontWeight:600,marginBottom:6}}>Lv.{pet.level}</div>

          {/* 重複成長能量 */}
          {duplicateInfo.dupes>0&&<div style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:9,color:"#856404",background:"#FFF3CD",border:"1px solid #EF9F2744",borderRadius:999,padding:"2px 6px",marginTop:-4,marginBottom:5,fontWeight:900}}>
            <span>✨</span><span>能量 +{duplicateInfo.dupes}</span>
          </div>}

          {/* 4 條微狀態條 - 卡片底部 */}
          <div style={{display:"flex",gap:2,padding:"0 2px"}}>
            {stats.map((s,si)=>(
              <div key={si} style={{flex:1,height:3,background:"rgba(0,0,0,.08)",borderRadius:2,overflow:"hidden"}}>
                <div style={{
                  height:"100%",
                  width:`${Math.max(4,Math.min(100,s.v))}%`,
                  background:s.c,
                  transition:"width .4s",
                  animation:s.v<20?"pet_badgePulse 1s ease-in-out infinite":"none",
                }}/>
              </div>
            ))}
          </div>
        </div>);
      })}
    </div>
    </>)):tab==="dex"?(
    <div>
      {(()=>{
        // 計算總完成度
        const allRarities=["N","R","SR","SSR"];
        const totalAll=allRarities.reduce((a,r)=>a+PETS[r].length,0);
        const gotAll=allRarities.reduce((a,r)=>a+pets.filter(p=>p.rarity===r).length,0);
        const allPct=Math.round((gotAll/totalAll)*100);
        return(<>
          {/* 總進度卡 */}
          <div style={{...S.card,padding:"16px 18px",marginBottom:12,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`,border:`2px solid ${c.cl}`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:14,fontWeight:700,color:S.t1}}>📖 圖鑑完成度</div>
              <div style={{fontSize:18,fontWeight:700,color:c.cl}}>{gotAll}/{totalAll}</div>
            </div>
            <div style={{height:10,background:S.bg2,borderRadius:5,overflow:"hidden",marginBottom:6}}>
              <div style={{height:"100%",width:`${allPct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,transition:"width .5s",borderRadius:5,boxShadow:`0 0 8px ${c.cl}66`}}/>
            </div>
            <div style={{fontSize:11,color:S.t3,textAlign:"center"}}>
              {allPct===100?"🏆 大師！全部寵物都收齊了！":allPct>=75?"✨ 快收齊了！繼續加油！":allPct>=50?"🌱 收藏一半囉！":"💪 繼續抽蛋探索吧！"}
            </div>
          </div>
          <div style={{...S.card,padding:"12px",marginBottom:12,display:"grid",gap:8}}>
            <input value={dexQuery} onChange={e=>setDexQuery(e.target.value)} placeholder="搜尋圖鑑：名稱、英文單字、故事..." style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:10,border:`1px solid ${S.bd}`,background:S.bg1,color:S.t1,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
              {[{k:"all",l:"全部"},{k:"owned",l:"已收集"},{k:"missing",l:"未收集"}].map(o=><button key={o.k} onClick={()=>setDexMode(o.k)} style={{flexShrink:0,border:`1px solid ${dexMode===o.k?c.cl:S.bd}`,background:dexMode===o.k?c.bg:S.bg1,color:dexMode===o.k?c.cl:S.t2,borderRadius:999,padding:"6px 10px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{o.l}</button>)}
              <span style={{width:1,background:S.bd,margin:"2px 2px",flexShrink:0}}/>
              {[{k:"all",l:"全部稀有度"},{k:"N",l:"普通"},{k:"R",l:"稀有"},{k:"SR",l:"超稀有"},{k:"SSR",l:"極稀有"}].map(o=><button key={o.k} onClick={()=>setDexRarity(o.k)} style={{flexShrink:0,border:`1px solid ${dexRarity===o.k?c.cl:S.bd}`,background:dexRarity===o.k?c.bg:S.bg1,color:dexRarity===o.k?c.cl:S.t2,borderRadius:999,padding:"6px 10px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{o.l}</button>)}
            </div>
          </div>

          {/* 各稀有度區塊 */}
          {allRarities.map(rarity=>{
            if(dexRarity!=="all"&&dexRarity!==rarity)return null;
            const ri=RARITY_INFO[rarity];
            const list=PETS[rarity];
            const got=list.filter(petDef=>pets.some(p=>p.petId===petDef.id));
            const pct=Math.round((got.length/list.length)*100);
            const q=dexQuery.trim().toLowerCase();
            const filteredList=list.filter(petDef=>{
              const owned=pets.some(p=>p.petId===petDef.id);
              if(dexMode==="owned"&&!owned)return false;
              if(dexMode==="missing"&&owned)return false;
              if(!q)return true;
              return [petDef.name,petDef.id,petDef.story,...(petDef.words||[])].some(v=>String(v||"").toLowerCase().includes(q));
            });
            if(filteredList.length===0)return null;
            return(<div key={rarity} style={{...S.card,padding:"14px 16px",marginBottom:12,background:ri.bg,border:`2px solid ${ri.color}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:ri.color}}>{ri.stars} {ri.label}</div>
                  <div style={{fontSize:10,color:S.t3,marginTop:1}}>機率 {ri.rate}%</div>
                </div>
                <div style={{fontSize:14,fontWeight:700,color:ri.color}}>{got.length}/{list.length}</div>
              </div>
              <div style={{height:6,background:"rgba(255,255,255,0.6)",borderRadius:3,overflow:"hidden",marginBottom:10}}>
                <div style={{height:"100%",width:`${pct}%`,background:ri.color,transition:"width .5s",borderRadius:3}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(92px,1fr))",gap:7}}>
                {filteredList.map(petDef=>{
                  const myPet=pets.find(p=>p.petId===petDef.id);
                  const owned=!!myPet;
                  const eggForPet=eggs.filter(e=>e.petId===petDef.id).sort((a,b)=>(b.progress||0)-(a.progress||0))[0];
                  const eggOwned=!!eggForPet;
                  const eggNeeded=eggForPet?(EGG_HATCH_TASKS[eggForPet.rarity]||1):1;
                  const duplicateInfo=owned?getDuplicateEnergyInfo(myPet):null;
                  return(<div key={petDef.id}
                    onClick={()=>{if(owned){setSelectedPet(myPet);triggerEvent(myPet)}else if(eggOwned){setTab("eggs")}}}
                    style={{
                      background:owned?"rgba(255,255,255,0.9)":eggOwned?"#FFF9E6":"rgba(0,0,0,0.06)",
                      borderRadius:10,
                      padding:"8px 5px",
                      textAlign:"center",
                      cursor:(owned||eggOwned)?"pointer":"default",
                      position:"relative",
                      transition:"transform .15s",
                      border:owned?`1.5px solid ${ri.color}`:eggOwned?"1.5px solid #EF9F27":"1.5px dashed rgba(0,0,0,0.15)",
                    }}
                    onTouchStart={e=>{if(owned||eggOwned)e.currentTarget.style.transform="scale(0.95)"}}
                    onTouchEnd={e=>{if(owned||eggOwned)e.currentTarget.style.transform="scale(1)"}}
                  >
                    <div style={{position:"absolute",top:5,right:5,fontSize:8,fontWeight:900,color:owned?ri.color:eggOwned?"#856404":S.t3,background:owned?ri.bg:eggOwned?"#FFF3CD":"rgba(255,255,255,.75)",borderRadius:999,padding:"1px 5px"}}>
                      {owned?"已收集":eggOwned?"蛋中":"未遇見"}
                    </div>
                    <div style={{
                      display:"flex",justifyContent:"center",margin:"12px auto 2px",
                      filter:(owned||eggOwned)?"none":"brightness(0.15) saturate(0)",
                      opacity:owned?1:eggOwned?0.95:0.4,
                    }}>
                      <PixelPet petId={petDef.id} stage={owned?getPetStage(myPet):(eggOwned?"egg":"adult")} size={42} animate={false}/>
                    </div>
                    {!owned&&!eggOwned&&<div style={{
                      position:"absolute",top:"50%",left:"50%",
                      transform:"translate(-50%,-30%)",
                      fontSize:18,fontWeight:700,
                      color:"rgba(0,0,0,0.45)",
                      pointerEvents:"none",
                    }}>?</div>}
                    <div style={{fontSize:10,fontWeight:600,color:(owned||eggOwned)?S.t1:S.t3,marginTop:2}}>
                      {owned||eggOwned?petDef.name:"???"}
                    </div>
                    {owned&&<div style={{fontSize:8,color:c.cl,fontWeight:600}}>Lv.{myPet.level||1}</div>}
                    {owned&&duplicateInfo.dupes>0&&<div style={{fontSize:8,color:"#856404",fontWeight:900,marginTop:1}}>能量 +{duplicateInfo.dupes}</div>}
                    {!owned&&eggOwned&&<div style={{fontSize:8,color:"#856404",fontWeight:900,marginTop:1}}>孵化 {eggForPet.progress||0}/{eggNeeded}</div>}
                  </div>);
                })}
              </div>
            </div>);
          })}

          <div style={{...S.card,padding:"12px 16px",marginTop:8,background:S.bg2,fontSize:11,color:S.t3,textAlign:"center",lineHeight:1.7}}>
            💡 在「🎰 扭蛋機」抽蛋來收集更多寵物！<br/>
            稀有度越高越難遇到，但也越特別 ✨
          </div>
        </>);
      })()}
    </div>
    ):null}
  </div>);
}

// ═══ SPONSOR PAGE (支持頁面 - 銀行轉帳與留言) ══════════════════════
function SponsorPage({onBack,c,sponsor,setSponsor}){
  const[name,setName]=useState(sponsor.name&&sponsor.name!=="支持者"?sponsor.name:"");
  const[note,setNote]=useState("");
  const[msg,setMsg]=useState("");
  const[busy,setBusy]=useState(false);
  const copyBank=async(text,label)=>{
    try{
      await navigator.clipboard.writeText(text);
      setMsg(`已複製${label}`);
      playSound("done");
    }catch{
      setMsg(`${label}：${text}`);
    }
  };
  const submit=async(e)=>{
    e?.preventDefault?.();
    if(busy)return;
    setBusy(true);setMsg("");
    const r=await submitSponsorMessage(name,note);
    setBusy(false);
    if(r.ok){
      setSponsor({active:true,name:name.trim(),date:new Date().toISOString()});
      setNote("");
      setMsg("已收到您的姓名與留言，謝謝支持。");
      playSound("done");
    }else{
      setMsg(r.err);
      playSound("bad");
    }
  };
  const resetSupporter=()=>{setSponsor({active:false,name:""});setMsg("");setName("");setNote("")};

  return(<div><Hdr t="☕ 支持我們" onBack={onBack} cl={c.cl}/>
    <div style={{...S.card,padding:"20px",marginBottom:12,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`,border:`2px solid ${c.cl}33`,textAlign:"center"}}>
      <div style={{fontSize:44,marginBottom:8}}>☕</div>
      <div style={{fontSize:18,fontWeight:700,color:S.t1}}>EnglishGo 永遠免費</div>
      <div style={{fontSize:13,color:S.t2,marginTop:4,lineHeight:1.7}}>
        無廣告 · 無付費牆 · 量力而為即可
      </div>
      <div style={{display:"inline-block",marginTop:10,padding:"6px 14px",background:"#E1F5EE",color:"#0F6E56",borderRadius:14,fontSize:11,fontWeight:600,border:"1px solid #1D9E75"}}>
        ✨ 100% 無廣告承諾
      </div>
    </div>

    {sponsor.active&&(<div style={{...S.card,padding:"20px",textAlign:"center",marginBottom:12,background:`linear-gradient(135deg,#FFF4D6,var(--color-background-primary,#fff))`,border:`2px solid #EF9F27`}}>
      <div style={{fontSize:36}}>💛</div>
      <div style={{fontSize:18,fontWeight:700,color:"#856404"}}>謝謝您的支持！</div>
      <div style={{fontSize:13,color:"#856404",marginTop:4}}>{sponsor.name?`${sponsor.name}，`:''}您的留言已記錄</div>
      <button onClick={resetSupporter} style={{background:"none",border:"none",fontSize:11,color:S.t3,cursor:"pointer",marginTop:8,textDecoration:"underline"}}>重新填寫留言</button>
    </div>)}

    <div style={{...S.card,padding:"18px 16px",marginBottom:12}}>
      <div style={{fontSize:15,fontWeight:700,color:S.t1,marginBottom:10}}>🏦 銀行轉帳資訊</div>
      <div style={{display:"grid",gap:8}}>
        {[
          {label:"戶名",value:"陳韋安"},
          {label:"銀行",value:"華南銀行（代號 008）"},
          {label:"帳號",value:"113200968044"},
        ].map(row=><div key={row.label} style={{display:"flex",gap:10,alignItems:"center",padding:"11px 12px",border:`1px solid ${S.bd}`,borderRadius:10,background:S.bg2}}>
          <div style={{width:54,fontSize:12,color:S.t3,fontWeight:700}}>{row.label}</div>
          <div style={{flex:1,fontSize:14,color:S.t1,fontWeight:700,wordBreak:"break-all"}}>{row.value}</div>
          <button onClick={()=>copyBank(row.value,row.label)} style={{border:`1px solid ${S.bd}`,background:S.bg1,borderRadius:8,padding:"5px 8px",fontSize:11,color:c.cl,cursor:"pointer",fontFamily:"inherit"}}>複製</button>
        </div>)}
      </div>
      <div style={{fontSize:11,color:S.t3,lineHeight:1.7,marginTop:10,padding:"10px 12px",background:S.bg2,borderRadius:8}}>
        轉帳完成後不用寄信告知。若願意讓我知道是誰支持 EnglishGo，可以在下方留下姓名與想說的話。
      </div>
    </div>

    <div style={{...S.card,padding:"18px 16px",marginBottom:12}}>
      <div style={{fontSize:15,fontWeight:700,color:S.t1,marginBottom:6}}>💰 隨意贊助金額</div>
      <div style={{fontSize:12,color:S.t2,marginBottom:12,lineHeight:1.7}}>沒有固定金額，量力而為就好！</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
        {[
          {amt:"NT$50",label:"請喝奶茶",icon:"🧋"},
          {amt:"NT$100",label:"請喝咖啡",icon:"☕"},
          {amt:"NT$300",label:"請吃午餐",icon:"🍱"},
        ].map((tier,i)=>(<div key={i} style={{padding:"12px 8px",border:`1px solid ${S.bd}`,borderRadius:10,textAlign:"center",background:S.bg1}}>
          <div style={{fontSize:22}}>{tier.icon}</div>
          <div style={{fontSize:13,fontWeight:700,color:c.cl,marginTop:2}}>{tier.amt}</div>
          <div style={{fontSize:10,color:S.t3,marginTop:1}}>{tier.label}</div>
        </div>))}
      </div>
    </div>

    <div style={{...S.card,padding:"18px 16px",marginBottom:12}}>
      <div style={{fontSize:15,fontWeight:700,color:S.t1,marginBottom:10}}>💬 留下姓名與一句話</div>
      <form onSubmit={submit} style={{display:"grid",gap:10}}>
        <label style={{display:"grid",gap:5,fontSize:12,color:S.t2,fontWeight:700}}>姓名
          <input value={name} onChange={e=>setName(e.target.value)} maxLength={60} placeholder="例如：王小明" style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1px solid ${S.bd}`,fontSize:14,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none"}}/>
        </label>
        <label style={{display:"grid",gap:5,fontSize:12,color:S.t2,fontWeight:700}}>想對我說的話
          <textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} rows={4} placeholder="任何鼓勵、建議或想看的功能都可以寫在這裡。" style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1px solid ${S.bd}`,fontSize:14,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",resize:"vertical",lineHeight:1.6}}/>
        </label>
        <div style={{fontSize:11,color:S.t3,textAlign:"right"}}>{note.length}/500</div>
        <button type="submit" disabled={busy||!name.trim()} style={{...S.btn,background:c.cl,color:"#fff",padding:"12px 20px",fontSize:14,width:"100%",opacity:(busy||!name.trim()) ? .5 : 1}}>{busy?"送出中...":"送出留言"}</button>
      </form>
      {msg&&<div style={{marginTop:10,fontSize:13,fontWeight:600,color:msg.includes("失敗")||msg.includes("請")?"#E24B4A":"#1D9E75",textAlign:"center",animation:"fadeUp .3s"}}>{msg}</div>}
    </div>

    <div style={{...S.card,padding:"12px 14px",fontSize:11,color:S.t3,lineHeight:1.7}}>
      🔒 <b>隱私說明</b>：留言表單只會記錄您填寫的姓名與留言內容，不需要 Email，也不會要求匯款證明。<br/>
      無論是否支持，所有功能都完全免費開放使用。
    </div>
  </div>);
}
// ═══ SHARED ════════════════════════════════════════════════════════
function Hdr({t,onBack,cl,extra}){return(<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:8}}><button onClick={onBack} style={{background:"none",border:"none",fontSize:12,color:cl,cursor:"pointer",fontWeight:600,fontFamily:"inherit",padding:"6px 8px",minHeight:36,borderRadius:8,WebkitTapHighlightColor:"transparent"}}>← 返回</button><h2 style={{fontSize:16,fontWeight:700,color:S.t1,margin:0,flex:1}}>{t}</h2>{extra}</div>)}
function PB({v,mx,cl}){return(<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,fontSize:12}}><div style={{flex:1,height:4,background:S.bg2,borderRadius:2}}><div style={{height:"100%",width:`${(v/mx)*100}%`,background:cl,borderRadius:2,transition:"width .3s"}}/></div><span style={{color:S.t3}}>{v+1}/{mx}</span></div>)}
