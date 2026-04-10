import { useState, useEffect, useCallback, useRef, useMemo } from "react";

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

function mapWord(r){
  try{return{w:r.word,ph:r.phonetic||'',p:r.pos||'',m:r.meaning,
    f:typeof r.forms==='string'?JSON.parse(r.forms||'[]'):(r.forms||[]),
    c:typeof r.collocations==='string'?JSON.parse(r.collocations||'[]'):(r.collocations||[]),
    ex:r.example||'',ez:r.example_zh||'',img:''}}catch{return null}
}

async function fetchCloudVocab(level, count = 20) {
  const sb = await getSb();
  if (!sb) return null;
  try {
    const { data: allIds } = await sb.from('word_bank').select('id').eq('level', level);
    if (!allIds?.length) return null;
    const ids = allIds.sort(() => Math.random() - 0.5).slice(0, count).map(r => r.id);
    const { data } = await sb.from('word_bank').select('*').in('id', ids);
    if (!data) return null;
    return data.sort(() => Math.random() - 0.5).map(r => mapWord(r)).filter(Boolean);
  } catch { return null; }
}

async function fetchCloudCount(level) {
  const sb = await getSb();
  if (!sb) return 0;
  try {
    const { count } = await sb.from('word_bank').select('*', { count: 'exact', head: true }).eq('level', level);
    return count || 0;
  } catch { return 0; }
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
  ],
  junior: [
    {t:"The Power of Reading",tx:"Reading is one of the most important skills a student can develop. When you read regularly, you improve your vocabulary and strengthen critical thinking. Studies show that students who read for pleasure perform better in school.",qs:[{q:"Reading helps improve?",o:["Drawing","Vocabulary & thinking","Fitness","Cooking"],a:1},{q:"Who does better in school?",o:["Who exercise","Who read for fun","Who sleep more","Who watch TV"],a:1}]},
    {t:"Social Media and Teens",tx:"Social media has become a big part of teenagers' lives. Many students spend more than three hours a day on Instagram and YouTube. While social media helps people stay connected, too much screen time may lead to sleep problems. Experts suggest setting a daily time limit.",qs:[{q:"How much time on social media?",o:["30 min","1 hour","More than 3 hours","5 hours"],a:2},{q:"Experts suggest?",o:["Use more","Delete apps","Set time limit","Only use computers"],a:2}]},
    {t:"Bubble Tea History",tx:"Bubble tea was invented in Taiwan in the 1980s. A teahouse owner added tapioca balls to iced tea. The drink quickly became popular across Taiwan and spread to other countries. Today, bubble tea shops can be found all over the world.",qs:[{q:"Where was bubble tea invented?",o:["Japan","Korea","Taiwan","China"],a:2},{q:"When?",o:["1960s","1970s","1980s","1990s"],a:2}]},
  ],
  senior: [
    {t:"Ethics of AI",tx:"As AI becomes integrated into daily life, ethical questions arise. One concern is algorithmic bias — when AI perpetuates prejudices from training data. Furthermore, worker displacement by automated systems presents unprecedented economic challenges requiring thoughtful policy responses.",qs:[{q:"What is algorithmic bias?",o:["A virus","AI perpetuating prejudices","A language","A product"],a:1},{q:"Automation challenge?",o:["Pollution","Worker displacement","Privacy","Energy"],a:1}]},
    {t:"Procrastination Psychology",tx:"Procrastination is not simply laziness. Research suggests it is an emotional regulation problem. When tasks trigger negative emotions, the brain seeks relief through avoidance. Cognitive behavioral strategies, such as breaking tasks into smaller steps, have proven effective.",qs:[{q:"Procrastination is primarily?",o:["Time management","Laziness","Emotional regulation","Genetics"],a:2},{q:"What helps?",o:["Work longer","Ignore deadlines","Break into small steps","Sleep more"],a:2}]},
    {t:"Renewable Energy Future",tx:"The transition to renewable energy is one of the most consequential shifts in modern history. Solar and wind power costs have dropped dramatically. However, intermittent nature presents grid stability challenges. Energy storage technologies are crucial for addressing this limitation.",qs:[{q:"Solar/wind cost?",o:["Increased","Same","Decreased dramatically","Unpredictable"],a:2},{q:"What's crucial?",o:["More fossil fuels","Energy storage","Reduce use","More plants"],a:1}]},
  ],
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

// ═══ CONFIG ═════════════════════════════════════════════════════════
const LV={elementary:{l:"小學",en:"Elementary",cl:"#0F6E56",bg:"#E1F5EE",ac:"#1D9E75",ic:"🌱",wd:"300字"},junior:{l:"國中",en:"Junior High",cl:"#534AB7",bg:"#EEEDFE",ac:"#7F77DD",ic:"📚",wd:"1200字"},senior:{l:"高中",en:"Senior High",cl:"#993C1D",bg:"#FAECE7",ac:"#D85A30",ic:"🎓",wd:"4500+字"}};
let _voiceUri = null; // selected English voice URI
try{_voiceUri=localStorage.getItem("eg_voice")||null}catch{}
function getVoices(){return window.speechSynthesis?.getVoices()?.filter(v=>/^en/i.test(v.lang))||[]}
function getZhVoice(){
  const vs=window.speechSynthesis?.getVoices()||[];
  return vs.find(v=>/zh[-_]TW/i.test(v.lang)&&!/male/i.test(v.name))
    ||vs.find(v=>/zh[-_]TW/i.test(v.lang))
    ||vs.find(v=>/zh[-_]HK/i.test(v.lang))
    ||vs.find(v=>/zh/i.test(v.lang))||null;
}
function speak(t,l="en-US",r=0.85){
  if(!window.speechSynthesis)return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(t);u.lang=l;u.rate=r;
  const isZh=/^zh/i.test(l);
  if(isZh){
    const zhV=getZhVoice();
    if(zhV){u.voice=zhV;u.lang=zhV.lang}
  }else if(_voiceUri){
    const v=window.speechSynthesis.getVoices().find(x=>x.voiceURI===_voiceUri);
    if(v){u.voice=v;u.lang=v.lang}
  }
  window.speechSynthesis.speak(u);
}
function VoicePicker(){const[voices,setVoices]=useState([]);const[cur,setCur]=useState(_voiceUri||"");useEffect(()=>{const load=()=>{const v=getVoices();if(v.length)setVoices(v)};load();window.speechSynthesis?.addEventListener?.("voiceschanged",load);return()=>window.speechSynthesis?.removeEventListener?.("voiceschanged",load)},[]);if(!voices.length)return null;return(<select value={cur} onChange={e=>{_voiceUri=e.target.value||null;setCur(e.target.value);try{localStorage.setItem("eg_voice",e.target.value)}catch{};if(e.target.value){const v=voices.find(x=>x.voiceURI===e.target.value);if(v)speak("Hello!","en-US",0.85)}}} style={{padding:"3px 4px",borderRadius:6,border:`1px solid var(--color-border-tertiary,#e0dfd9)`,fontSize:11,background:"var(--color-background-primary,#fff)",color:"var(--color-text-secondary,#73726c)",maxWidth:110,fontFamily:"inherit"}}><option value="">預設語音</option>{voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name.replace(/Microsoft |Google |Apple /,"").slice(0,18)}{v.lang.includes("GB")?" 🇬🇧":v.lang.includes("AU")?" 🇦🇺":v.lang.includes("US")?" 🇺🇸":""}</option>)}</select>)}
function createDeck(c){return{queue:c.map((_,i)=>i),rm:[],stats:{again:0,hard:0,good:0,easy:0},total:c.length}}
function rateDeck(d,a){const n={...d,queue:[...d.queue],rm:[...d.rm],stats:{...d.stats}};const c=n.queue.shift();if(c===undefined)return n;n.stats[a]++;if(a==="again")n.queue.splice(Math.min(1,n.queue.length),0,c);else if(a==="hard")n.queue.splice(Math.floor(n.queue.length/2),0,c);else if(a==="good")n.queue.push(c);else n.rm.push(c);return n}
function parseCSV(t){return t.trim().split("\n").slice(1).map(l=>{const m=l.match(/^"?([^",]+)"?\s*,\s*"?([\s\S]*?)"?\s*$/);if(!m)return null;const w=m[1].trim(),b=m[2].trim(),p=b.match(/\(([a-z.\/]+)\)\s*(.+?)(?:\n|$)/);return{w,ph:"",p:p?.[1]||"",m:p?.[2]?.trim()||b.split("\n")[0],f:[],c:[],ex:"",ez:""}}).filter(Boolean)}
const imgC={};function preImg(ws,s=0,n=3){for(let i=s;i<Math.min(s+n,ws.length);i++){const w=ws[i]?.w;if(w&&!imgC[w]){const img=new Image();img.src=`https://loremflickr.com/300/150/${encodeURIComponent(w)}?lock=${i}`;imgC[w]=img.src}}}
// ─── Markdown renderer ──────────────────────────────────────────────
function Md({text,color}){if(!text)return null;return text.split("\n").map((line,li)=>{if(!line.trim())return <br key={li}/>;const isB=/^\s*[\*\-•]\s+/.test(line);const cl=isB?line.replace(/^\s*[\*\-•]\s+/,""):line;const parts=[];let rem=cl,k=0;while(rem.length>0){const m=rem.match(/\*\*(.+?)\*\*/);if(m){const idx=rem.indexOf(m[0]);if(idx>0)parts.push(<span key={k++}>{rem.slice(0,idx)}</span>);const isEn=/^[a-zA-Z]/.test(m[1]);parts.push(<strong key={k++} style={{fontWeight:700,cursor:isEn?"pointer":"default",color:isEn?color:"inherit",textDecoration:isEn?"underline dotted":"none",textUnderlineOffset:"3px"}} onClick={()=>isEn&&speak(m[1])}>{m[1]}</strong>);rem=rem.slice(idx+m[0].length)}else{parts.push(<span key={k++}>{rem}</span>);break}}return<div key={li} style={{marginBottom:2,paddingLeft:isB?16:0,position:"relative"}}>{isB&&<span style={{position:"absolute",left:0}}>•</span>}{parts}</div>})}
function speakMx(text,rate=0.85){if(!window.speechSynthesis)return;window.speechSynthesis.cancel();const cl=text.replace(/\*\*/g,"").replace(/[#•\-]/g," ");const segs=cl.split(/([a-zA-Z][a-zA-Z\s\-',.!?;:()]+)/g).filter(s=>s.trim());let d=0;segs.forEach(s=>{const en=/^[a-zA-Z]/.test(s.trim());const u=new SpeechSynthesisUtterance(s.trim());u.lang=en?"en-US":"zh-TW";u.rate=en?rate:rate+.15;if(en&&_voiceUri){const v=window.speechSynthesis.getVoices().find(x=>x.voiceURI===_voiceUri);if(v){u.voice=v;u.lang=v.lang}}else if(!en){const zhV=getZhVoice();if(zhV){u.voice=zhV;u.lang=zhV.lang}}setTimeout(()=>window.speechSynthesis.speak(u),d);d+=s.length*(en?55:80)})}
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

// ═══ MAIN APP ═══════════════════════════════════════════════════════
export default function App(){
  const[lv,setLv]=useState(null),[mod,setMod]=useState(null);
  const[xp,setXp]=useLS("xp",0);
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
    const w=p.get("word"),l=p.get("lv");
    if(w&&l&&LV[l]){setLv(l);setMod("srs");setSharedWord(w)}
    if(w)window.history.replaceState({},"",window.location.pathname);
  },[]);

  // Check streak & daily reset + log history
  useEffect(()=>{const today=new Date().toDateString();if(daily.date!==today){
    // Save yesterday's data to history
    if(daily.date&&daily.done>0)setHistory(h=>[...h,{date:daily.date,xp:daily.done*5,done:daily.done}].slice(-60));
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);if(daily.date===yesterday.toDateString()&&daily.done>0)setStreak(s=>s+1);else setStreak(1);setDaily({target:10,done:0,date:today})}},[]);

  // Check achievements
  useEffect(()=>{const s={xp,streak,...stats};ACH_DEFS.forEach(a=>{if(!achUnlocked.includes(a.id)&&a.check(s)){setAchUnlocked(u=>[...u,a.id]);setShowAch(a)}});},[xp,streak,stats]);

  const addXp=(n=5)=>{setXp(x=>x+n);setDaily(d=>({...d,done:Math.min(d.done+1,d.target)}))};
  const trackWeak=(word)=>{setWeakWords(w=>{const e=w.find(x=>x.w===word);if(e)return w.map(x=>x.w===word?{...x,n:x.n+1}:x);return[...w,{w:word,n:1}].slice(-50)})};

  useEffect(()=>{const r=document.documentElement.style;r.colorScheme=dark?"dark":"light";if(dark){r.setProperty('--color-background-primary','#1a1a2e');r.setProperty('--color-background-secondary','#16213e');r.setProperty('--color-background-tertiary','#0f0f23');r.setProperty('--color-text-primary','#e0e0e0');r.setProperty('--color-text-secondary','#a0a0a0');r.setProperty('--color-text-tertiary','#707070');r.setProperty('--color-border-tertiary','#2a2a4a')}else{['--color-background-primary','--color-background-secondary','--color-background-tertiary','--color-text-primary','--color-text-secondary','--color-text-tertiary','--color-border-tertiary'].forEach(p=>r.removeProperty(p))}},[dark]);

  if(!lv)return<Landing onSelect={setLv} dark={dark} setDark={setDark}/>;
  const c=LV[lv],back=()=>setMod(null);

  return(
    <div style={{minHeight:"100vh",background:S.bg3,fontFamily:"'Noto Sans TC','Segoe UI',sans-serif"}}>
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
      <div style={{maxWidth:760,margin:"0 auto",padding:"12px 12px calc(16px + env(safe-area-inset-bottom, 0px))"}}>
        {!mod?<Menu lv={lv} onSelect={setMod} daily={daily} c={c} xp={xp} streak={streak} achUnlocked={achUnlocked} weakWords={weakWords} isSponsor={isSponsor}/>:
         mod==="srs"?<SRS lv={lv} onBack={back} onXp={addXp} onDone={()=>setStats(s=>({...s,srsRounds:s.srsRounds+1}))} trackWeak={trackWeak} gifKey={gifKey} onSetGifKey={setGifKey} sharedWord={sharedWord}/>:
         mod==="quiz"?<QuizM lv={lv} onBack={back} onXp={addXp} onPerfect={()=>setStats(s=>({...s,perfectQuiz:s.perfectQuiz+1}))} trackWeak={trackWeak}/>:
         mod==="speak"?<SpeakM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="whack"?<WhackM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="match"?<MatchM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="bomb"?<BombM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="balloon"?<BalloonM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="grammar"?<GrammarM lv={lv} onBack={back} onXp={addXp}/>:
         mod==="reading"?<ReadingM lv={lv} onBack={back}/>:
         mod==="dictation"?<DictM lv={lv} onBack={back} onXp={addXp} onDone={()=>setStats(s=>({...s,dictDone:s.dictDone+1}))}/>:
         mod==="scramble"?<ScramM lv={lv} onBack={back} onXp={addXp} onDone={()=>setStats(s=>({...s,scramDone:s.scramDone+1}))}/>:
         mod==="ai"?<AIT lv={lv} onBack={back} apiKey={gemKey} onSetKey={setGemKey}/>:
         mod==="achievements"?<AchPage onBack={back} unlocked={achUnlocked} c={c}/>:
         mod==="weak"?<WeakPage onBack={back} weakWords={weakWords} setWeakWords={setWeakWords} c={c} lv={lv}/>:
         mod==="dashboard"?<Dashboard onBack={back} c={c} xp={xp} streak={streak} stats={stats} daily={daily} weakWords={weakWords} history={history} achUnlocked={achUnlocked} lv={lv} isSponsor={isSponsor}/>:
         mod==="sponsor"?<SponsorPage onBack={back} c={c} sponsor={sponsor} setSponsor={setSponsor}/>:null}
        {/* Ad Banner — hidden for sponsors */}
        {!isSponsor&&<AdBanner/>}
        {isSponsor&&<div style={{textAlign:"center",fontSize:11,color:c.cl,padding:"8px",opacity:.5}}>💎 感謝贊助！已為您移除廣告</div>}
      </div>
      {/* Footer */}
      <footer style={{textAlign:"center",padding:"20px 16px calc(28px + env(safe-area-inset-bottom, 0px))",fontSize:11,color:S.t3,lineHeight:1.8,borderTop:`1px solid ${S.bd}`,marginTop:16}}>
        <div style={{maxWidth:480,margin:"0 auto"}}>
          <div style={{fontWeight:600,fontSize:12,color:S.t2,marginBottom:6}}>📘 如何使用 EnglishGo</div>
          <div style={{marginBottom:8}}>選擇等級（小學／國中／高中）後，透過 SRS 單字卡記憶單字，搭配口說練習、打地鼠拼字、配對翻牌等遊戲強化學習。AI 家教可即時回答英文問題。每天練習 10 題即可累積經驗值與成就徽章！</div>
          <div style={{marginBottom:8}}><a href="/learn/api-keys.html" style={{color:c.cl,textDecoration:"underline"}}>🔑 API Key 申請教學</a> · <a href="/learn/sponsor.html" style={{color:c.cl,textDecoration:"underline"}}>💎 贊助我們</a></div>
          <div style={{fontSize:10,color:S.t3,marginBottom:6}}>本站使用 Google AdSense 投放廣告，並可能使用 Cookie 提供個人化廣告體驗。</div>
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
            {href:"/learn/api-keys.html",t:"API Key 申請教學",d:"解鎖 AI 家教 & 單字動圖",ic:"🔑"},
            {href:"/learn/sponsor.html",t:"贊助 EnglishGo",d:"移除廣告、支持免費教育",ic:"💎"}
          ].map((a,i)=>(<a key={i} href={a.href} style={{display:"block",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:"16px",textDecoration:"none",color:"#fff",transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.1)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.05)"}><div style={{fontSize:20,marginBottom:4}}>{a.ic}</div><div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{a.t}</div><div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{a.d}</div></a>))}
        </div>
      </div>
      {/* Landing Footer */}
      <footer style={{textAlign:"center",padding:"40px 20px 56px",fontSize:11,color:"rgba(255,255,255,.35)",lineHeight:1.8,borderTop:"1px solid rgba(255,255,255,.08)",marginTop:32}}>
        <div style={{maxWidth:480,margin:"0 auto"}}>
          <div style={{fontWeight:600,fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:6}}>📘 如何使用</div>
          <div style={{marginBottom:10}}>選擇你的等級，透過 SRS 單字卡、口說練習、遊戲等多種模式學英文。AI 家教隨時回答問題。每天只要 10 分鐘！</div>
          <div style={{fontSize:10,marginBottom:8}}>本站使用 Google AdSense 投放廣告，並可能使用 Cookie 提供個人化廣告體驗。</div>
          <div>AI Tutor powered by <b>Gemini</b> · Speech by <b>Web Speech API</b></div>
          <div>© {new Date().getFullYear()} EnglishGo · 專為台灣學生設計</div>
        </div>
      </footer>
    </div>
  </div>);
}

// ═══ MENU ═══════════════════════════════════════════════════════════
function Menu({lv,onSelect,daily,c,xp,streak,achUnlocked,weakWords,isSponsor}){
  const pct=Math.round((daily.done/daily.target)*100);
  const todayWord=V[lv][new Date().getDate()%V[lv].length];
  const[cloudCount,setCloudCount]=useState(0);
  useEffect(()=>{fetchCloudCount(lv).then(n=>setCloudCount(n||0))},[lv]);
  return(<div>
    {/* Stats bar */}
    <div style={{display:"flex",gap:8,marginBottom:12,padding:"10px 14px",...S.card}}>
      <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:S.t1}}>🔥 {streak}</div><div style={{fontSize:11,color:S.t3}}>連續天數</div></div>
      <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:S.t1}}>⭐ {xp}</div><div style={{fontSize:11,color:S.t3}}>經驗值</div></div>
      <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:S.t1}}>📊 {pct}%</div><div style={{fontSize:11,color:S.t3}}>今日進度</div></div>
      <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:S.t1}}>🏅 {achUnlocked.length}</div><div style={{fontSize:11,color:S.t3}}>成就</div></div>
    </div>
    {/* Daily word card */}
    <div style={{...S.card,padding:"16px 18px",marginBottom:12,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:12,color:c.cl,fontWeight:600,marginBottom:4}}>今日推薦單字</div><div style={{fontSize:28,fontWeight:700,color:S.t1}}>{todayWord.w} <button onClick={()=>speak(todayWord.w)} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",verticalAlign:"middle",padding:"4px"}}>🔊</button></div><div style={{fontSize:14,color:S.t2}}>{todayWord.m} · {todayWord.p}</div></div>
      </div>
    </div>
    {/* Weak words reminder */}
    {weakWords.length>0&&<div style={{...S.card,padding:"12px 16px",marginBottom:12,fontSize:14}}>
      <span style={{fontWeight:600,color:"#E24B4A"}}>需加強：</span>
      {weakWords.sort((a,b)=>b.n-a.n).slice(0,5).map((w,i)=><span key={i} style={{marginLeft:6,color:S.t2}}>{w.w}({w.n})</span>)}
    </div>}
    {/* Modules */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8}}>
      {[
        {id:"srs",icon:"🃏",t:"SRS 單字卡",d:cloudCount?`雲端 ${cloudCount} 字`:"間隔重複"},
        {id:"quiz",icon:"📝",t:"單字測驗",d:"四選一"},
        {id:"speak",icon:"🗣️",t:"口說練習",d:"唸出來！"},
        {id:"whack",icon:"🔨",t:"打地鼠拼字",d:"限時拼字"},
        {id:"match",icon:"🎴",t:"配對翻牌",d:"記憶遊戲"},
        {id:"bomb",icon:"💣",t:"拆彈拼字",d:"限時拆彈！"},
        {id:"balloon",icon:"🍉",t:"切水果",d:"水果忍者"},
        {id:"dictation",icon:"🎧",t:"聽寫訓練",d:"聽力養成"},
        {id:"scramble",icon:"🧩",t:"句子重組",d:"語序訓練"},
        {id:"grammar",icon:"🧠",t:"文法學堂",d:`${G[lv].length} 個重點`},
        {id:"reading",icon:"📖",t:"閱讀理解",d:`${R[lv].length} 篇文章`},
        {id:"ai",icon:"🤖",t:"AI 家教",d:"Gemini 對話"},
        {id:"achievements",icon:"🏆",t:"成就徽章",d:`${achUnlocked.length}/${ACH_DEFS.length} 已解鎖`},
        {id:"weak",icon:"📕",t:"錯題本",d:weakWords.length?`${weakWords.length} 字需加強`:"還沒有錯題"},
        {id:"dashboard",icon:"📊",t:"學習報告",d:"數據分析"},
        {id:"sponsor",icon:"💎",t:isSponsor?"贊助會員 ✓":"贊助我們",d:isSponsor?"已啟用無廣告":"移除廣告"},
      ].map(m=>(<div key={m.id} onClick={()=>onSelect(m.id)} style={{cursor:"pointer",...S.card,padding:"20px 14px",transition:"all .12s",WebkitTapHighlightColor:"transparent"}}
        onTouchStart={e=>e.currentTarget.style.transform="scale(0.96)"}
        onTouchEnd={e=>e.currentTarget.style.transform="none"}
        onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 4px 14px ${c.cl}10`}}
        onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none"}}>
        <div style={{fontSize:26,marginBottom:4}}>{m.icon}</div>
        <div style={{fontWeight:600,fontSize:14,color:S.t1,marginBottom:2}}>{m.t}</div>
        <div style={{fontSize:11,color:S.t2}}>{m.d}</div>
      </div>))}
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

function Confetti(){const ps=useMemo(()=>Array.from({length:40},(_,i)=>({id:i,x:Math.random()*100,d:Math.random()*3+2,c:["#E24B4A","#EF9F27","#1D9E75","#185FA5","#D85A30","#7F77DD","#FF69B4","#FFD700"][i%8],s:Math.random()*.4+.3,r:Math.random()*360})),[]);return(<div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>{ps.map(p=><div key={p.id} style={{position:"absolute",left:`${p.x}%`,top:0,width:8,height:8,background:p.c,borderRadius:p.id%3===0?"50%":"2px",animation:`confDrop ${p.d}s ${p.s}s ease-in forwards`,transform:`rotate(${p.r}deg)`}}/>)}</div>)}

function SRS({lv,onBack,onXp,onDone,trackWeak,gifKey,onSetGifKey,sharedWord}){
  const built=V[lv];const[cards,setCards]=useState(built);const[deck,setDeck]=useState(()=>createDeck(built));const[flip,setFlip]=useState(false);const[info,setInfo]=useState(false);const[loading,setLoading]=useState(true);const[src,setSrc]=useState("built-in");const c=LV[lv];const fr=useRef();
  const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);const[comboAnim,setComboAnim]=useState(false);const[showConfetti,setShowConfetti]=useState(false);const[flipAnim,setFlipAnim]=useState(false);const[mascotMood,setMascotMood]=useState("idle");
  const[gifUrl,setGifUrl]=useState(null);const[gifLoading,setGifLoading]=useState(false);const[gifKeyInp,setGifKeyInp]=useState(gifKey||"");
  useEffect(()=>{(async()=>{setLoading(true);const cloud=await fetchCloudVocab(lv,20);if(cloud&&cloud.length>0){
    // If sharedWord, put it first in the deck
    let ordered=cloud;
    if(sharedWord){const si=cloud.findIndex(w=>w.w.toLowerCase()===sharedWord.toLowerCase());if(si>0){ordered=[cloud[si],...cloud.slice(0,si),...cloud.slice(si+1)]}else if(si<0){
      // Word not in cloud batch, try to fetch it specifically
      try{const sb=await getSb();if(sb){const{data}=await sb.from('word_bank').select('*').ilike('word',sharedWord).limit(1);if(data?.[0]){const w=mapWord(data[0]);if(w)ordered=[w,...cloud.slice(0,19)]}}}catch{}
    }}
    setCards(ordered);setDeck(createDeck(ordered));setSrc(`cloud (${ordered.length}字)`);}else setSrc("built-in ("+built.length+"字)");setLoading(false)})()},[lv]);
  const cur=deck.queue[0]!==undefined?cards[deck.queue[0]]:null;const left=deck.queue.length;const done=left===0;
  // Fetch GIF for current word
  useEffect(()=>{if(!cur||!gifKey)return;setGifLoading(true);fetchGif(cur.w,gifKey).then(url=>{setGifUrl(url);setGifLoading(false)})},[cur?.w,gifKey]);
  useEffect(()=>{if(cur)preImg(cards,deck.queue[0],3)},[deck.queue[0]]);
  useEffect(()=>{if(cur&&!flip&&!loading)speak(cur.w)},[cur?.w,flip,loading]);
  const rate=useCallback(a=>{if(a==="again"&&cur)trackWeak(cur.w);if(a==="easy"||a==="good"){onXp();setMascotMood(a==="easy"?"great":"happy");setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));if(nc>=3){playSound("combo");setComboAnim(true);setTimeout(()=>setComboAnim(false),600)}else playSound("good");return nc})}else if(a==="again"){setCombo(0);setMascotMood("sad");playSound("bad")}else{setMascotMood("think");playSound("flip")}setTimeout(()=>setMascotMood("idle"),1500);setDeck(d=>rateDeck(d,a));setFlip(false);setFlipAnim(false)},[onXp,cur,trackWeak]);
  useEffect(()=>{const h=e=>{if(done)return;if(e.code==="Space"){e.preventDefault();if(!flip){setFlip(true);setFlipAnim(true);playSound("flip");if(cur?.ex)setTimeout(()=>speak(cur.ex),350)}else{setFlip(false);setFlipAnim(false)}}if(flip){if(e.key==="1")rate("again");if(e.key==="2")rate("hard");if(e.key==="3")rate("good");if(e.key==="4")rate("easy")}if(e.key==="Enter"){e.preventDefault();if(cur)speak(flip?(cur.ex||cur.w):cur.w)}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[flip,done,cur,rate]);
  const touchStart=useRef(null);
  const onTouchStart=e=>{touchStart.current={x:e.touches[0].clientX,y:e.touches[0].clientY}};
  const onTouchEnd=e=>{if(!touchStart.current||!flip)return;const dx=e.changedTouches[0].clientX-touchStart.current.x;const dy=e.changedTouches[0].clientY-touchStart.current.y;touchStart.current=null;if(Math.abs(dx)<40&&Math.abs(dy)<40)return;if(Math.abs(dx)>Math.abs(dy)){if(dx>0)rate("good");else rate("again")}else{if(dy<0)rate("easy");else rate("hard")}};
  const handleCardTap=()=>{if(!flip){setFlip(true);setFlipAnim(true);playSound("flip");if(cur.ex)setTimeout(()=>speak(cur.ex),350)}};
  const handleCSV=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const p=parseCSV(ev.target.result);if(p.length){setCards(p);setDeck(createDeck(p));setFlip(false)}};r.readAsText(f,"utf-8")};
  useEffect(()=>{if(done&&!loading){onDone();playSound("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500)}},[done,loading]);
  if(loading)return(<div><Hdr t="🃏 SRS 單字卡" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px 16px",color:S.t3,fontSize:14}}><div style={{fontSize:40,animation:"emojiBounce 1s infinite"}}>📚</div><div style={{marginTop:8}}>從雲端載入單字庫...</div><div style={{width:120,height:4,background:S.bg2,borderRadius:2,margin:"12px auto",overflow:"hidden"}}><div style={{width:"60%",height:"100%",background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:2,animation:"pulse 1s infinite"}}/></div></div></div>);
  if(done){const{stats,total}=deck;const goodPct=Math.round(((stats.good+stats.easy)/total)*100);return(<div>{showConfetti&&<Confetti/>}<Hdr t="🃏 SRS 單字卡" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{goodPct>=80?"🏆":goodPct>=60?"🎉":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>練習完成！共 {total} 張</h2>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,maxWidth:400,margin:"16px auto"}}>{[["😅 Again",stats.again,"#E24B4A"],["🤔 Hard",stats.hard,"#EF9F27"],["😊 Good",stats.good,"#1D9E75"],["🤩 Easy",stats.easy,"#185FA5"]].map(([l,v,cl])=>(<div key={l} style={{...S.card,padding:"12px 6px",textAlign:"center",borderTop:`3px solid ${cl}`}}><div style={{fontSize:26,fontWeight:700,color:cl}}>{v}</div><div style={{fontSize:11,color:S.t3,marginTop:2}}>{l}</div></div>))}</div><div style={{textAlign:"center",fontSize:13,color:S.t2,margin:"8px 0"}}>掌握率 {goodPct}% · 共用了 {deck.total} 張卡片</div><div style={{fontSize:14,color:S.t2,marginBottom:14}}>{goodPct>=80?"太厲害了！🌟":goodPct>=60?"表現不錯！繼續加油 💪":"多練習幾次會更好！📖"}</div><button onClick={async()=>{setLoading(true);setCombo(0);setMaxCombo(0);const cloud=await fetchCloudVocab(lv,20);if(cloud?.length){setCards(cloud);setDeck(createDeck(cloud))}else setDeck(createDeck(cards));setFlip(false);setLoading(false)}} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 新一輪</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}
  const pct=Math.round(((deck.total-left)/deck.total)*100);
  const rateTooltip=deck.total-left===0?"第一張卡片！加油 💪":"";const comboLabel=combo>=10?"🔥🔥🔥 UNSTOPPABLE!":combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";
  return(<div><Hdr t="🃏 SRS 單字卡" onBack={onBack} cl={c.cl} extra={<div style={{display:"flex",gap:4}}><button onClick={()=>setInfo(!info)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"2px 6px",fontSize:12,cursor:"pointer",color:S.t2}}>ⓘ</button><label style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"2px 6px",fontSize:12,cursor:"pointer",color:S.t2}}>📥<input ref={fr} type="file" accept=".csv" onChange={handleCSV} style={{display:"none"}}/></label></div>}/>
    {info&&<div style={{...S.card,padding:"12px 16px",marginBottom:10,fontSize:13,color:S.t2,lineHeight:1.7}}>💻 <b>Space</b> 翻牌/翻回 · <b>Enter</b> 朗讀 · <b>1</b>Again <b>2</b>Hard <b>3</b>Good <b>4</b>Easy<br/>📱 <b>點擊</b>翻牌 · 點 <b>🔙翻回</b> · <b>滑動</b>或按鈕評分<div style={{marginTop:4,fontSize:11,color:S.t3}}>來源：{src} {gifKey?"· 🖼️ GIF 已啟用":""}</div>
      <div style={{borderTop:`1px solid ${S.bd}`,marginTop:8,paddingTop:8}}>
        <div style={{fontWeight:600,fontSize:12,color:S.t1,marginBottom:4}}>🖼️ 單字動圖 (Giphy)</div>
        <div style={{fontSize:11,color:S.t3,marginBottom:4}}>1. <a href="https://developers.giphy.com/" target="_blank" rel="noreferrer" style={{color:c.cl}}>developers.giphy.com</a> → Create App → API Key<br/>2. 貼到下方（免費，顯示單字相關 GIF）</div>
        <div style={{display:"flex",gap:5}}><input value={gifKeyInp} onChange={e=>setGifKeyInp(e.target.value)} placeholder="Giphy API Key..." type="password" style={{flex:1,padding:"6px 8px",borderRadius:6,border:`1px solid ${S.bd}`,fontSize:12,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none"}}/><button onClick={()=>onSetGifKey(gifKeyInp)} style={{...S.btn,background:c.cl,color:"#fff",padding:"6px 12px",fontSize:12}}>存</button></div>
      </div>
    </div>}
    {comboLabel&&<div style={{textAlign:"center",fontSize:combo>=7?16:13,fontWeight:700,color:"#EF9F27",marginBottom:4,animation:comboAnim?"comboFlash .5s ease-out":"none"}}>{comboLabel}</div>}
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8,fontSize:12}}><div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3,transition:"width .3s"}}/></div><span style={{color:S.t3}}>{left}/{deck.total}</span>{[["#E24B4A",deck.stats.again],["#EF9F27",deck.stats.hard],["#1D9E75",deck.stats.good],["#185FA5",deck.stats.easy]].map(([cl,v],i)=><span key={i} style={{color:cl,fontWeight:600}}>{v}</span>)}</div>
    <div onClick={handleCardTap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{cursor:!flip?"pointer":"default",borderRadius:16,padding:flip?"18px 20px 22px":"48px 20px",textAlign:"center",minHeight:flip?280:220,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:flip?"flex-start":"center",background:flip?`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`:S.bg1,border:`2px solid ${flip?c.ac:S.bd}`,transition:"all .3s",userSelect:"none",WebkitUserSelect:"none",animation:flipAnim?"cardFlip .35s ease-out":"none",position:"relative",overflow:"hidden"}}>
      {/* Sparkles background */}
      {!flip&&<CardSparkles color={c.cl}/>}
      {/* Mascot */}
      <Mascot mood={mascotMood}/>
      {!flip?(()=>{const ea=cur?getWordEmoji(cur):null;return<>
        {/* GIF or animated emoji */}
        {gifUrl?<img src={gifUrl} alt={cur.w} style={{width:"90%",maxWidth:280,height:200,objectFit:"cover",borderRadius:18,marginBottom:12,position:"relative",zIndex:1,boxShadow:"0 6px 20px rgba(0,0,0,.15)"}} onError={e=>e.target.style.display="none"}/>:
         gifLoading&&gifKey?<div style={{fontSize:14,color:S.t3,marginBottom:8,position:"relative",zIndex:1,animation:"pulse 1s infinite"}}>載入動圖...</div>:
         ea&&<div style={{fontSize:64,marginBottom:10,animation:`${ea.anim} 1.5s ease-in-out infinite`,position:"relative",zIndex:1}}>{ea.emoji}</div>}
        <div style={{fontSize:38,fontWeight:700,color:S.t1,letterSpacing:1,position:"relative",zIndex:1}}>{cur.w}<button onClick={e=>{e.stopPropagation();speak(cur.w)}} style={{background:"none",border:"none",fontSize:28,cursor:"pointer",marginLeft:6,verticalAlign:"middle",padding:"4px",minWidth:40,minHeight:40}}>🔊</button></div>
        {cur.ph&&<div style={{fontSize:14,color:S.t3,marginTop:3,position:"relative",zIndex:1}}>{cur.ph}</div>}
        <div style={{fontSize:14,color:"#fff",marginTop:16,padding:"10px 24px",background:`linear-gradient(135deg,${c.cl},${c.ac})`,borderRadius:24,fontWeight:600,boxShadow:`0 2px 8px ${c.cl}40`,position:"relative",zIndex:1}}>👆 點擊翻牌</div>
        <div style={{fontSize:11,color:S.t3,marginTop:5,position:"relative",zIndex:1}}>電腦可按 Space</div>
      </>})():(<>
        {/* Back face GIF or emoji */}
        {gifUrl?<img src={gifUrl} alt={cur.w} style={{width:"85%",maxWidth:260,height:180,objectFit:"cover",borderRadius:16,marginBottom:10,boxShadow:"0 4px 16px rgba(0,0,0,.12)"}} onError={e=>e.target.style.display="none"}/>:
         (()=>{const ea=cur?getWordEmoji(cur):null;return ea?<div style={{fontSize:36,marginBottom:6,animation:`${ea.anim} 2s ease-in-out infinite`}}>{ea.emoji}</div>:null})()}
        {imgC[cur.w]&&<img src={imgC[cur.w]} alt="" style={{width:"100%",maxWidth:260,height:120,objectFit:"cover",borderRadius:10,marginBottom:8}} onError={e=>e.target.style.display="none"}/>}
        <div style={{fontSize:28,fontWeight:700,color:c.cl,letterSpacing:.5}}>{cur.w} <span style={{fontSize:13,fontWeight:400,color:S.t3}}>({cur.p})</span> <button onClick={e=>{e.stopPropagation();speak(cur.w)}} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",verticalAlign:"middle",padding:"4px",minWidth:36,minHeight:36}}>🔊</button></div>
        <div style={{fontSize:22,fontWeight:600,color:S.t1,margin:"4px 0 8px"}}>{cur.m} <button onClick={e=>{e.stopPropagation();speak(cur.m,"zh-TW",0.9)}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",verticalAlign:"middle",padding:"4px",minWidth:36,minHeight:36}}>🔈</button></div>
        {cur.f?.length>0&&<div style={{fontSize:13,color:S.t2,marginBottom:6,width:"100%",padding:"8px 12px",background:`${c.ac}0a`,borderRadius:10,textAlign:"left"}}><b style={{color:c.cl,fontSize:12}}>📝 詞性變化</b><div style={{marginTop:3,display:"flex",flexWrap:"wrap",gap:4}}>{cur.f.map((f,i)=><span key={i} style={{background:S.bg2,padding:"2px 8px",borderRadius:6,fontSize:12}}>{f.w} <span style={{color:S.t3}}>({f.p}) {f.n}</span></span>)}</div></div>}
        {cur.c?.length>0&&<div style={{fontSize:13,color:S.t2,marginBottom:6,width:"100%",padding:"8px 12px",background:`${c.ac}08`,borderRadius:10,textAlign:"left"}}><b style={{color:c.cl,fontSize:12}}>🔗 常見搭配</b><div style={{marginTop:3}}>{cur.c.map((x,i)=><div key={i} style={{fontSize:13,padding:"2px 0",borderBottom:i<cur.c.length-1?`1px solid ${S.bd}`:"none"}}>· {x}</div>)}</div></div>}
        {cur.ex&&<div style={{fontSize:14,color:S.t1,width:"100%",padding:"10px 14px",background:`linear-gradient(135deg,${S.bg2},${c.bg}22)`,borderRadius:12,textAlign:"left",borderLeft:`3px solid ${c.cl}`}}>📖 <i>"{cur.ex}"</i><button onClick={e=>{e.stopPropagation();speak(cur.ex)}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",marginLeft:4,verticalAlign:"middle",padding:"2px"}}>🔊</button>{cur.ez&&<div style={{fontSize:13,color:S.t3,fontStyle:"normal",marginTop:2}}>{cur.ez} <button onClick={e=>{e.stopPropagation();speak(cur.ez,"zh-TW",0.9)}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",verticalAlign:"middle",padding:"2px"}}>🔈</button></div>}</div>}
      </>)}
    </div>
    {flip&&<>
      <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:8}}>
        <button onClick={()=>{setFlip(false);setFlipAnim(false)}} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:14,padding:"10px 20px",fontSize:14,cursor:"pointer",color:S.t2,fontFamily:"inherit",minHeight:44}}>🔙 翻回</button>
        <button onClick={()=>{const url=`https://englishgo-vevan.netlify.app/?word=${encodeURIComponent(cur.w)}&lv=${lv}`;const t=`📘 今天學了一個英文單字！\n\n📝 ${cur.w}${cur.ph?` ${cur.ph}`:""}\n   ${cur.p} ${cur.m}\n${cur.ex?`\n📖 ${cur.ex}`:""}\n${cur.ez?`   ${cur.ez}`:""}\n\n一起來學英文 👇\n${url}`;shareLine(t,url)}} style={{background:"#06C755",border:"none",borderRadius:14,padding:"10px 16px",fontSize:14,cursor:"pointer",color:"#fff",fontFamily:"inherit",minHeight:44,fontWeight:600}}>📤 LINE</button>
        <button onClick={()=>{const url=`https://englishgo-vevan.netlify.app/?word=${encodeURIComponent(cur.w)}&lv=${lv}`;const t=`📘 ${cur.w}${cur.ph?` ${cur.ph}`:""} — ${cur.m}${cur.ex?`\n📖 ${cur.ex}`:""}${cur.ez?`\n   ${cur.ez}`:""}\n${url}`;navigator.clipboard?.writeText(t).then(()=>{const d=document.createElement("div");d.textContent="✅ 已複製！";d.style.cssText="position:fixed;top:20%;left:50%;transform:translateX(-50%);background:#1D9E75;color:#fff;padding:10px 24px;border-radius:20px;font-size:14px;font-weight:600;z-index:9999;animation:fadeUp .3s";document.body.appendChild(d);setTimeout(()=>d.remove(),1500)})}} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:14,padding:"10px 16px",fontSize:14,cursor:"pointer",color:S.t2,fontFamily:"inherit",minHeight:44}}>📋 複製</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginTop:8}}>{[{k:"again",l:"Again",n:"1",cl:"#E24B4A",bg:"#FCEBEB",em:"😅"},{k:"hard",l:"Hard",n:"2",cl:"#BA7517",bg:"#FAEEDA",em:"🤔"},{k:"good",l:"Good",n:"3",cl:"#0F6E56",bg:"#E1F5EE",em:"😊"},{k:"easy",l:"Easy",n:"4",cl:"#185FA5",bg:"#E6F1FB",em:"🤩"}].map(b=>(<button key={b.k} onClick={()=>rate(b.k)} style={{...S.btn,background:b.bg,color:b.cl,padding:"14px 4px",fontSize:14,display:"flex",flexDirection:"column",alignItems:"center",gap:2,transition:"transform .1s",minHeight:60,WebkitTapHighlightColor:"transparent"}} onTouchStart={e=>e.currentTarget.style.transform="scale(0.93)"} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"} onMouseDown={e=>e.currentTarget.style.transform="scale(0.95)"} onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}><span style={{fontSize:24}}>{b.em}</span>{b.l}<span style={{fontSize:10,opacity:.5}}>{b.n}</span></button>))}</div>
      {deck.total-left<3&&<div style={{textAlign:"center",fontSize:11,color:S.t3,marginTop:5,animation:"fadeUp .5s"}}>📱 也可滑動：← Again · → Good · ↑ Easy · ↓ Hard</div>}
    </>}
  </div>);
}
// ═══ SPEAK PRACTICE (口說練習 - BeeSpeaker style) ══════════════════
function normalizeText(t){return t.toLowerCase().replace(/[^a-z0-9\s']/g,"").replace(/\s+/g," ").trim()}
function compareWords(original,spoken){
  const ow=normalizeText(original).split(" ");
  const sw=normalizeText(spoken).split(" ");
  const result=ow.map(w=>{
    const found=sw.some(s=>s===w||(w.length>3&&s.length>3&&(s.includes(w.slice(0,-1))||w.includes(s.slice(0,-1)))));
    return{word:w,ok:found};
  });
  const correct=result.filter(r=>r.ok).length;
  return{result,correct,total:ow.length,pct:Math.round((correct/ow.length)*100)};
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

function SpeakM({lv,onBack,onXp}){
  const c=LV[lv];
  const[items,setItems]=useState([]);const[loading,setLoading]=useState(true);
  const[si,setSi]=useState(0);
  const[phase,setPhase]=useState("ready"); // ready -> listen -> result
  const[listening,setListening]=useState(false);
  const[spoken,setSpoken]=useState("");
  const[comparison,setComparison]=useState(null);
  const[score,setScore]=useState(0);
  const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);
  const[showConfetti,setShowConfetti]=useState(false);
  const[showSuccess,setShowSuccess]=useState(false);
  const[noSupport,setNoSupport]=useState(false);
  const recogRef=useRef(null);

  // Load items from cloud
  useEffect(()=>{(async()=>{setLoading(true);const r=await fetchSpeakItems(lv,12);setItems(r);setLoading(false)})()},[lv]);

  const cur=items[si];

  // Speech recognition setup
  useEffect(()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setNoSupport(true);return}
    const r=new SR();r.lang="en-US";r.interimResults=false;r.maxAlternatives=3;r.continuous=false;
    r.onresult=e=>{
      let best="";let bestConf=0;
      for(let i=0;i<e.results[0].length;i++){
        if(e.results[0][i].confidence>bestConf){bestConf=e.results[0][i].confidence;best=e.results[0][i].transcript}
      }
      setSpoken(best);setListening(false);
    };
    r.onerror=()=>{setListening(false);setPhase("ready");setSpoken("[沒有聽到聲音，再試一次]")};
    r.onend=()=>setListening(false);
    recogRef.current=r;
    return()=>{try{r.abort()}catch{}};
  },[]);

  // Auto-play on new item
  useEffect(()=>{if(phase==="ready"&&cur&&!loading)setTimeout(()=>speak(cur.en,"en-US",0.75),400)},[si,phase,loading]);

  // Compare when spoken
  useEffect(()=>{
    if(!spoken||spoken.startsWith("[")||!cur)return;
    const comp=compareWords(cur.en,spoken);
    setComparison(comp);
    if(comp.pct>=70){
      setScore(s=>s+1);onXp(comp.pct>=90?15:10);
      setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));return nc});
      setShowSuccess(true);
      if(comp.pct>=90)playSound("combo");else playSound("good");
      setTimeout(()=>setShowSuccess(false),1200);
    }else{setCombo(0);playSound("bad")}
    setPhase("result");
  },[spoken]);

  const startListening=()=>{
    if(!recogRef.current||listening)return;
    setSpoken("");setComparison(null);setPhase("listen");setListening(true);
    try{recogRef.current.start()}catch{recogRef.current.stop();setTimeout(()=>{try{recogRef.current.start()}catch{}},200)}
  };
  const stopListening=()=>{if(recogRef.current&&listening){try{recogRef.current.stop()}catch{}}};
  const nextItem=()=>{
    if(si+1>=items.length){playSound("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500);setPhase("done");return}
    setSi(s=>s+1);setPhase("ready");setSpoken("");setComparison(null);
  };
  const retry=()=>{setPhase("ready");setSpoken("");setComparison(null)};
  const restart=async()=>{setLoading(true);setSi(0);setPhase("ready");setSpoken("");setComparison(null);setScore(0);setCombo(0);setMaxCombo(0);const r=await fetchSpeakItems(lv,12);setItems(r);setLoading(false)};

  const comboLabel=combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";

  if(noSupport)return(<div><Hdr t="🗣️ 口說練習" onBack={onBack} cl={c.cl}/><div style={{...S.card,padding:"24px 16px",textAlign:"center"}}><div style={{fontSize:40,marginBottom:10}}>😔</div><div style={{fontSize:14,color:S.t1,fontWeight:600}}>瀏覽器不支援語音辨識</div><div style={{fontSize:12,color:S.t2,marginTop:6}}>請使用 Chrome 或 Edge 瀏覽器</div></div></div>);
  if(loading||!cur)return(<div><Hdr t="🗣️ 口說練習" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入中...</div></div>);

  if(phase==="done")return(<div>{showConfetti&&<Confetti/>}<Hdr t="🗣️ 口說練習" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{score>=items.length*0.8?"🏆":score>=items.length*0.5?"🎉":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>口說練習完成！</h2><div style={{fontSize:18,color:c.cl,fontWeight:600,marginTop:6}}>{score}/{items.length} 句通過</div>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{fontSize:14,color:S.t2,marginTop:8,marginBottom:16}}>{score>=items.length*0.8?"口說太棒了！🌟":"多說多練，越來越流利！💪"}</div><button onClick={restart} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 換一批</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>);

  const pct=Math.round((si/items.length)*100);
  return(<div><Hdr t="🗣️ 口說練習" onBack={onBack} cl={c.cl}/>
    {/* Progress */}
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6,fontSize:12}}><div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3,transition:"width .3s"}}/></div><span style={{color:S.t3}}>{si+1}/{items.length}</span><span style={{color:"#1D9E75",fontWeight:600}}>{score}✓</span></div>
    {comboLabel&&<div style={{textAlign:"center",fontSize:14,fontWeight:700,color:"#EF9F27",marginBottom:6,animation:"comboFlash .5s"}}>{comboLabel}</div>}

    {/* === MAIN CARD (BeeSpeaker style) === */}
    {/* Success banner */}
    {showSuccess&&<div style={{background:"linear-gradient(90deg,#2ECC71,#27AE60)",borderRadius:12,padding:"10px 16px",marginBottom:8,textAlign:"center",animation:"bounceIn .3s ease-out"}}><span style={{color:"#fff",fontWeight:700,fontSize:16}}>太棒了！🎉</span></div>}

    <div style={{...S.card,padding:0,overflow:"hidden",marginBottom:12}}>
      {/* Chinese meaning - prominent */}
      <div style={{background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`,padding:"22px 18px",textAlign:"center",borderBottom:`1px solid ${S.bd}`}}>
        <div style={{fontSize:15,color:S.t3,marginBottom:4}}>{cur.type==="word"?"唸出這個單字":"唸出這個句子"}</div>
        <div style={{fontSize:32,fontWeight:700,color:S.t1,lineHeight:1.4}}>{cur.zh}</div>
        {cur.pos&&<div style={{fontSize:11,color:S.t3,marginTop:2}}>({cur.pos})</div>}
      </div>
      {/* English - what to say */}
      <div style={{padding:"22px 18px",textAlign:"center"}}>
        <div style={{fontSize:cur.type==="word"?42:26,fontWeight:700,color:c.cl,lineHeight:1.5,letterSpacing:cur.type==="word"?1:0}}>{cur.en}</div>
        {cur.keyword&&<div style={{fontSize:11,color:S.t3,marginTop:4}}>重點單字：<b style={{color:c.cl}}>{cur.keyword}</b></div>}
      </div>
      {/* Listen button */}
      <div style={{padding:"0 16px 16px",textAlign:"center"}}>
        <button onClick={()=>speak(cur.en,"en-US",0.75)} style={{...S.btn,background:S.bg2,color:S.t2,padding:"10px 20px",fontSize:14}}>🔊 聽示範</button>
      </div>
    </div>

    {/* Mic button area */}
    {phase!=="result"&&<div style={{textAlign:"center",marginBottom:12}}>
      {!listening?(<button onClick={startListening} style={{width:88,height:88,borderRadius:"50%",border:"none",background:`linear-gradient(135deg,${c.cl},${c.ac})`,color:"#fff",fontSize:36,cursor:"pointer",boxShadow:`0 6px 24px ${c.cl}50`,transition:"transform .15s",WebkitTapHighlightColor:"transparent"}} onTouchStart={e=>e.currentTarget.style.transform="scale(0.88)"} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>🎤</button>):
      (<button onClick={stopListening} style={{width:88,height:88,borderRadius:"50%",border:"none",background:"#E24B4A",color:"#fff",fontSize:36,cursor:"pointer",animation:"micPulse 1.2s ease-in-out infinite"}}>⏹</button>)}
      <div style={{fontSize:13,color:listening?"#E24B4A":S.t3,marginTop:8,fontWeight:listening?700:400}}>{listening?"🎙️ 正在聽...大聲說！":"👆 按下開始說"}</div>
    </div>}

    {/* Result */}
    {phase==="result"&&comparison&&<div style={{...S.card,padding:"16px",marginBottom:12}}>
      {/* Score visualization */}
      <div style={{textAlign:"center",marginBottom:10}}>
        <div style={{fontSize:40}}>{comparison.pct>=90?"🌟":comparison.pct>=70?"👍":comparison.pct>=40?"🤔":"😅"}</div>
        <div style={{fontSize:14,fontWeight:700,color:comparison.pct>=70?"#1D9E75":"#E24B4A",marginTop:4}}>
          {comparison.pct>=90?"太棒了！":comparison.pct>=70?"不錯喔！":comparison.pct>=40?"再試一次！":"加油！"}
        </div>
        {/* Accuracy bar */}
        <div style={{margin:"8px auto",maxWidth:180}}>
          <div style={{height:8,background:S.bg2,borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${comparison.pct}%`,background:comparison.pct>=70?"linear-gradient(90deg,#1D9E75,#5DCAA5)":"linear-gradient(90deg,#E24B4A,#EF9F27)",borderRadius:4,transition:"width .5s"}}/>
          </div>
          <div style={{fontSize:11,color:S.t2,marginTop:3}}>準確度 {comparison.pct}%</div>
        </div>
      </div>
      {/* Word-by-word comparison */}
      <div style={{fontSize:17,lineHeight:2.2,textAlign:"center",margin:"8px 0"}}>
        {comparison.result.map((r,i)=><span key={i} style={{padding:"3px 5px",borderRadius:6,marginRight:3,fontWeight:600,background:r.ok?"#E1F5EE":"#FCEBEB",color:r.ok?"#1D9E75":"#E24B4A"}}>{r.word}</span>)}
      </div>
      {/* What was heard */}
      <div style={{fontSize:11,color:S.t2,textAlign:"center",padding:"6px 10px",background:S.bg2,borderRadius:8}}>🎙️ {spoken}</div>
      {/* Action buttons */}
      <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
        <button onClick={()=>speak(cur.en,"en-US",0.75)} style={{...S.btn,background:S.bg2,color:S.t1,padding:"10px 14px",fontSize:12,minHeight:44}}>🔊 再聽</button>
        <button onClick={retry} style={{...S.btn,background:"#FAEEDA",color:"#BA7517",padding:"10px 14px",fontSize:12,minHeight:44}}>🔄 重試</button>
        <button onClick={nextItem} style={{...S.btn,background:c.cl,color:"#fff",padding:"10px 14px",fontSize:12,minHeight:44}}>{si+1>=items.length?"🏁 完成":"▶ 下一個"}</button>
      </div>
    </div>}

    {/* Error state */}
    {spoken.startsWith("[")&&<div style={{...S.card,padding:"16px",textAlign:"center"}}><div style={{fontSize:13,color:"#EF9F27"}}>{spoken}</div><button onClick={retry} style={{...S.btn,background:c.bg,color:c.cl,padding:"8px 14px",fontSize:12,marginTop:8}}>🔄 再試一次</button></div>}
  </div>);
}
// ═══ WHACK-A-MOLE SPELLING (打地鼠拼字 v2) ══════════════════════════
function WhackM({lv,onBack,onXp}){
  const c=LV[lv];
  const[words,setWords]=useState(V[lv]);const[loading,setLoading]=useState(true);
  const[wi,setWi]=useState(0);const[typed,setTyped]=useState([]);const[holes,setHoles]=useState([]);
  const[score,setScore]=useState(0);const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);
  const[timeLeft,setTimeLeft]=useState(0);const[phase,setPhase]=useState("ready");
  const[shakeIdx,setShakeIdx]=useState(-1);const[showConfetti,setShowConfetti]=useState(false);
  const[lives,setLives]=useState(3);const[hitAnim,setHitAnim]=useState(-1);
  const timerRef=useRef(null);
  const ROUND_TIME=lv==="elementary"?18:lv==="junior"?14:11;
  const TOTAL_WORDS=10;

  useEffect(()=>{(async()=>{const cloud=await fetchCloudVocab(lv,TOTAL_WORDS);if(cloud?.length)setWords(cloud.slice(0,TOTAL_WORDS));setLoading(false)})()},[lv]);

  const cur=words[wi];
  const generateHoles=useCallback(()=>{
    if(!cur)return;
    const correct=cur.w.toLowerCase().split("");
    const extras="abcdefghijklmnopqrstuvwxyz".split("").filter(l=>!correct.includes(l));
    const shuffled=extras.sort(()=>Math.random()-.5);
    const pool=[...correct];
    const numExtra=Math.min(6,Math.max(4,9-correct.length));
    for(let i=0;i<numExtra;i++)pool.push(shuffled[i%shuffled.length]);
    const h=pool.sort(()=>Math.random()-.5).map((l,i)=>({id:i,letter:l,visible:true,correct:correct.includes(l),mole:["🐹","🐿️","🦔","🐰","🦊"][Math.floor(Math.random()*5)]}));
    setHoles(h);
  },[cur]);

  const startRound=()=>{setTyped([]);generateHoles();setTimeLeft(ROUND_TIME);setPhase("play");
    if(timerRef.current)clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{setTimeLeft(t=>{if(t<=1){clearInterval(timerRef.current);setPhase("fail");setCombo(0);setLives(l=>l-1);playSound("bad");return 0}return t-1})},1000);
  };

  useEffect(()=>{if(phase==="ready"&&!loading&&cur)startRound()},[wi,loading,phase]);
  useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current)},[]);

  const tapLetter=(hole,idx)=>{
    if(phase!=="play")return;
    const expected=cur.w.toLowerCase()[typed.length];
    if(hole.letter===expected){
      playSound("flip");
      setHitAnim(idx);setTimeout(()=>setHitAnim(-1),300);
      const newTyped=[...typed,hole.letter];
      setTyped(newTyped);
      setHoles(h=>h.map((x,i)=>i===idx?{...x,visible:false}:x));
      if(newTyped.length===cur.w.length){
        clearInterval(timerRef.current);
        setPhase("success");setScore(s=>s+1);onXp(10);
        setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));if(nc>=3)playSound("combo");else playSound("good");return nc});
        speak(cur.w);
      }
    }else{
      setShakeIdx(idx);setTimeout(()=>setShakeIdx(-1),300);
      playSound("bad");
    }
  };

  const nextWord=()=>{
    if(lives<=0&&phase==="fail"){playSound("done");setPhase("done");return}
    if(wi+1>=Math.min(words.length,TOTAL_WORDS)){
      playSound("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500);
      setPhase("done");return;
    }
    setWi(w=>w+1);setPhase("ready");
  };

  const restart=async()=>{if(timerRef.current)clearInterval(timerRef.current);setLoading(true);setWi(0);setScore(0);setCombo(0);setMaxCombo(0);setLives(3);setPhase("ready");const cloud=await fetchCloudVocab(lv,TOTAL_WORDS);if(cloud?.length)setWords(cloud.slice(0,TOTAL_WORDS));setLoading(false)};

  if(loading)return(<div><Hdr t="🔨 打地鼠拼字" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入中...</div></div>);

  if(phase==="done"){const total=Math.min(words.length,TOTAL_WORDS);return(<div>{showConfetti&&<Confetti/>}<Hdr t="🔨 打地鼠拼字" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{lives<=0?"💀":score>=total*0.8?"🏆":"🎉"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>{lives<=0?"遊戲結束！":"拼字完成！"}</h2><div style={{fontSize:18,color:c.cl,fontWeight:600,marginTop:6}}>{score}/{total} 答對</div>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{fontSize:14,color:S.t2,marginTop:8,marginBottom:16}}>{score>=total*0.8?"拼字高手！🌟":"多練幾次就會進步！📖"}</div><button onClick={restart} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 再玩一次</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}

  const pct=Math.round((wi/Math.min(words.length,TOTAL_WORDS))*100);
  const urgency=timeLeft<=3?"#E24B4A":timeLeft<=5?"#EF9F27":"#1D9E75";
  const comboLabel=combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";
  return(<div><Hdr t="🔨 打地鼠拼字" onBack={onBack} cl={c.cl}/>
    <style>{`@keyframes moleUp{0%{transform:translateY(80%) scale(0.7);opacity:0}60%{transform:translateY(-5%) scale(1.05)}100%{transform:translateY(0) scale(1);opacity:1}}@keyframes hammerHit{0%{transform:rotate(0) scale(1)}40%{transform:rotate(-15deg) scale(1.2)}100%{transform:rotate(0) scale(1)}}`}</style>
    {/* Progress + Lives */}
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6,fontSize:12}}>
      <div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3,transition:"width .3s"}}/></div>
      <span style={{color:S.t3}}>{wi+1}/{Math.min(words.length,TOTAL_WORDS)}</span>
      <span style={{fontSize:14}}>{"❤️".repeat(lives)}{"🖤".repeat(Math.max(0,3-lives))}</span>
    </div>
    {comboLabel&&<div style={{textAlign:"center",fontSize:14,fontWeight:700,color:"#EF9F27",marginBottom:4,animation:"comboFlash .5s"}}>{comboLabel}</div>}

    {/* Word info card */}
    <div style={{...S.card,padding:"14px 18px",textAlign:"center",marginBottom:10,position:"relative",overflow:"hidden"}}>
      <div style={{fontSize:13,color:c.cl,fontWeight:600}}>🔨 敲對的地鼠，拼出單字！</div>
      <div style={{fontSize:30,fontWeight:700,color:S.t1,marginTop:6}}>{cur.m}</div>
      <div style={{fontSize:13,color:S.t2,marginTop:2}}>{cur.p}</div>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:6}}>
        <button onClick={()=>speak(cur.w)} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:12,padding:"6px 14px",fontSize:13,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>🔊 聽發音</button>
      </div>
      {/* Timer bar */}
      <div style={{marginTop:8,position:"relative"}}>
        <div style={{height:8,background:S.bg2,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(timeLeft/ROUND_TIME)*100}%`,background:`linear-gradient(90deg,${urgency},${urgency}88)`,borderRadius:4,transition:"width .8s linear"}}/></div>
        {phase==="play"&&<div style={{position:"absolute",right:0,top:-2,fontSize:14,fontWeight:700,color:urgency,fontFamily:"monospace",animation:timeLeft<=3?"emojiPulse .4s infinite":"none"}}>{timeLeft}s</div>}
      </div>
    </div>

    {/* Typed progress — letter slots */}
    <div style={{display:"flex",justifyContent:"center",gap:5,marginBottom:12,flexWrap:"wrap"}}>
      {cur.w.split("").map((l,i)=>(<div key={i} style={{width:38,height:44,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,border:`2px solid ${i<typed.length?c.cl:i===typed.length?urgency:S.bd}`,background:i<typed.length?c.bg:i===typed.length?`${urgency}15`:S.bg2,color:i<typed.length?c.cl:S.t3,transition:"all .15s",animation:i===typed.length-1?"bounceIn .25s":"none",boxShadow:i===typed.length?`0 0 8px ${urgency}30`:"none"}}>{i<typed.length?typed[i].toUpperCase():"·"}</div>))}
    </div>

    {/* Mole grid */}
    {phase==="play"&&<div style={{display:"grid",gridTemplateColumns:`repeat(${holes.length<=6?3:4},1fr)`,gap:10,maxWidth:400,margin:"0 auto"}}>
      {holes.map((h,i)=>h.visible&&(<button key={h.id} onClick={()=>tapLetter(h,i)} style={{
        height:80,borderRadius:18,border:"none",
        background:"linear-gradient(180deg,#8B6914 0%,#6B4F12 40%,#4A3509 100%)",
        boxShadow:"inset 0 -4px 8px rgba(0,0,0,.2), 0 4px 8px rgba(0,0,0,.1)",
        cursor:"pointer",transition:"transform .1s",
        animation:shakeIdx===i?"moleShake .3s":hitAnim===i?"hammerHit .3s":"moleUp .3s ease-out",
        animationDelay:hitAnim!==i&&shakeIdx!==i?`${i*0.05}s`:"0s",
        animationFillMode:"both",
        WebkitTapHighlightColor:"transparent",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:0,
        position:"relative",overflow:"hidden"
      }} onTouchStart={e=>e.currentTarget.style.transform="scale(0.88)"} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
        {/* Grass top */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:10,background:"linear-gradient(180deg,#4CAF50,#388E3C)",borderRadius:"18px 18px 0 0"}}/>
        {/* Mole emoji */}
        <div style={{fontSize:24,marginTop:4,filter:hitAnim===i?"brightness(1.5)":"none",transition:"filter .1s"}}>{h.mole}</div>
        {/* Letter */}
        <div style={{fontSize:22,fontWeight:800,color:"#FFD700",textShadow:"0 1px 3px rgba(0,0,0,.5)",textTransform:"uppercase",lineHeight:1}}>{h.letter}</div>
        {/* Hit effect */}
        {hitAnim===i&&<div style={{position:"absolute",inset:0,background:"rgba(255,215,0,.3)",borderRadius:18,pointerEvents:"none"}}/>}
      </button>))}
    </div>}

    {/* Success/Fail */}
    {(phase==="success"||phase==="fail")&&<div style={{...S.card,padding:"24px 18px",textAlign:"center",marginTop:10,animation:"fadeUp .3s"}}>
      <div style={{fontSize:48,animation:phase==="success"?"bounceIn .3s":"moleShake .3s"}}>{phase==="success"?"🎯":"⏰"}</div>
      <div style={{fontSize:18,fontWeight:700,color:phase==="success"?"#1D9E75":"#E24B4A",marginTop:6}}>{phase==="success"?"答對了！":"時間到！"}</div>
      <div style={{fontSize:20,fontWeight:700,color:c.cl,marginTop:4}}>{cur.w}</div>
      {phase==="fail"&&<div style={{fontSize:13,color:S.t2,marginTop:2}}>正確拼法：<b>{cur.w}</b></div>}
      <button onClick={nextWord} style={{...S.btn,background:c.cl,color:"#fff",marginTop:12,fontSize:14,padding:"12px 24px"}}>{lives<=0&&phase==="fail"?"💀 遊戲結束":wi+1>=Math.min(words.length,TOTAL_WORDS)?"🏁 看成績":"▶ 下一隻地鼠"}</button>
    </div>}
  </div>);
}

// ═══ MEMORY MATCH (配對翻牌) ═══════════════════════════════════════
function MatchM({lv,onBack,onXp}){
  const c=LV[lv];
  const[words,setWords]=useState(V[lv]);const[loading,setLoading]=useState(true);
  const[cards,setCards]=useState([]);const[flipped,setFlipped]=useState([]);const[matched,setMatched]=useState([]);
  const[moves,setMoves]=useState(0);const[startTime,setStartTime]=useState(null);const[elapsed,setElapsed]=useState(0);
  const[phase,setPhase]=useState("ready");// ready,play,done
  const[showConfetti,setShowConfetti]=useState(false);
  const PAIRS=lv==="elementary"?6:lv==="junior"?6:6;

  useEffect(()=>{(async()=>{const cloud=await fetchCloudVocab(lv,PAIRS);if(cloud?.length)setWords(cloud.slice(0,PAIRS));setLoading(false)})()},[lv]);

  const initGame=useCallback(()=>{
    const chosen=[...words].sort(()=>Math.random()-.5).slice(0,PAIRS);
    const pairs=[];
    chosen.forEach((w,i)=>{
      pairs.push({id:`en-${i}`,pairId:i,type:"en",text:w.w,word:w});
      pairs.push({id:`zh-${i}`,pairId:i,type:"zh",text:w.m,word:w});
    });
    setCards(pairs.sort(()=>Math.random()-.5));
    setFlipped([]);setMatched([]);setMoves(0);setStartTime(Date.now());setPhase("play");
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
    if(flipped.length>=2)return;
    if(flipped.includes(idx))return;
    if(matched.includes(cards[idx].pairId))return;
    playSound("flip");
    const newFlipped=[...flipped,idx];
    setFlipped(newFlipped);

    if(newFlipped.length===2){
      setMoves(m=>m+1);
      const[a,b]=[cards[newFlipped[0]],cards[newFlipped[1]]];
      if(a.pairId===b.pairId&&a.type!==b.type){
        // Match!
        setTimeout(()=>{
          playSound("good");speak(a.word.w);
          setMatched(m=>{const nm=[...m,a.pairId];if(nm.length===PAIRS){setTimeout(()=>{playSound("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500);setPhase("done")},400);onXp(20)}else{onXp(5)}return nm});
          setFlipped([]);
        },400);
      }else{
        // No match
        setTimeout(()=>{playSound("bad");setFlipped([])},800);
      }
    }
  };

  const restart=()=>{initGame()};
  const isFlipped=(idx)=>flipped.includes(idx)||matched.includes(cards[idx]?.pairId);

  if(loading)return(<div><Hdr t="🎴 配對翻牌" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入中...</div></div>);

  if(phase==="done"){const stars=moves<=PAIRS*2?3:moves<=PAIRS*3?2:1;return(<div>{showConfetti&&<Confetti/>}<Hdr t="🎴 配對翻牌" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{stars===3?"🏆":stars===2?"🎉":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>全部配對成功！</h2><div style={{display:"flex",justifyContent:"center",gap:16,marginTop:12,marginBottom:8}}><div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:c.cl}}>{moves}</div><div style={{fontSize:11,color:S.t3}}>翻牌次數</div></div><div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:c.cl}}>{elapsed}s</div><div style={{fontSize:11,color:S.t3}}>花費時間</div></div><div style={{textAlign:"center"}}><div style={{fontSize:22}}>{"⭐".repeat(stars)}</div><div style={{fontSize:11,color:S.t3}}>評價</div></div></div><div style={{fontSize:14,color:S.t2,marginBottom:16}}>{stars===3?"完美記憶！太厲害了！🌟":stars===2?"記憶力不錯！💪":"多玩幾次會更快！📖"}</div><button onClick={restart} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 再玩一次</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}

  return(<div><Hdr t="🎴 配對翻牌" onBack={onBack} cl={c.cl}/>
    {/* Status bar */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,padding:"6px 10px",...S.card}}>
      <span style={{fontSize:13,color:S.t2}}>🃏 {matched.length}/{PAIRS} 配對</span>
      <span style={{fontSize:13,color:S.t2}}>👆 {moves} 次</span>
      <span style={{fontSize:13,color:S.t2}}>⏱ {elapsed}s</span>
    </div>
    {/* Card grid */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,maxWidth:440,margin:"0 auto"}}>
      {cards.map((card,idx)=>{const open=isFlipped(idx);const isMatched=matched.includes(card.pairId);
        return(<button key={card.id} onClick={()=>flipCard(idx)} disabled={open} style={{height:lv==="elementary"?72:68,borderRadius:12,border:isMatched?`2px solid ${c.cl}`:`2px solid ${S.bd}`,background:open?(isMatched?c.bg:S.bg1):`linear-gradient(135deg,${c.cl},${c.ac})`,cursor:open?"default":"pointer",fontSize:open?(card.type==="en"?16:15):24,fontWeight:open?600:400,color:open?S.t1:"#fff",padding:"4px 6px",fontFamily:"inherit",transition:"all .2s",opacity:isMatched?.7:1,animation:open&&!isMatched?"matchFlip .3s ease-out":"none",WebkitTapHighlightColor:"transparent",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",justifyContent:"center"}} onTouchStart={e=>{if(!open)e.currentTarget.style.transform="scale(0.92)"}} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
          {open?(<span>{card.text}{card.type==="en"&&isMatched?" ✓":""}</span>):"❓"}
        </button>)})}
    </div>
    {/* Hint */}
    <div style={{textAlign:"center",fontSize:11,color:S.t3,marginTop:10}}>
      翻兩張牌，找到英文和中文的配對！
    </div>
  </div>);
}

// ═══ BOMB DEFUSE SPELLING (拆彈拼字 v2) ═════════════════════════════
function BombM({lv,onBack,onXp}){
  const c=LV[lv];
  const[words,setWords]=useState(V[lv]);const[loading,setLoading]=useState(true);
  const[wi,setWi]=useState(0);const[input,setInput]=useState("");
  const[timeLeft,setTimeLeft]=useState(0);const[phase,setPhase]=useState("ready");
  const[score,setScore]=useState(0);const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);
  const[showConfetti,setShowConfetti]=useState(false);const[shake,setShake]=useState(false);
  const[hint,setHint]=useState(false);const[lives,setLives]=useState(3);
  const timerRef=useRef(null);const inputRef=useRef(null);
  const BOMB_TIME=lv==="elementary"?20:lv==="junior"?15:12;
  const TOTAL=10;

  useEffect(()=>{(async()=>{const cloud=await fetchCloudVocab(lv,TOTAL);if(cloud?.length)setWords(cloud.slice(0,TOTAL));setLoading(false)})()},[lv]);

  const cur=words[wi];
  const startRound=()=>{setInput("");setHint(false);setTimeLeft(BOMB_TIME);setPhase("play");
    if(timerRef.current)clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{setTimeLeft(t=>{if(t<=1){clearInterval(timerRef.current);setPhase("explode");setCombo(0);setLives(l=>l-1);playSound("bad");return 0}return t-1})},1000);
    setTimeout(()=>inputRef.current?.focus(),100);
  };
  useEffect(()=>{if(phase==="ready"&&!loading&&cur)startRound()},[wi,loading,phase]);
  useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current)},[]);

  const submit=()=>{
    if(phase!=="play"||!input.trim())return;
    if(input.trim().toLowerCase()===cur.w.toLowerCase()){
      clearInterval(timerRef.current);setPhase("defused");setScore(s=>s+1);onXp(10);
      setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));if(nc>=3)playSound("combo");else playSound("good");return nc});
    }else{setShake(true);setTimeout(()=>setShake(false),400);playSound("bad");setInput("")}
  };
  const showHintFn=()=>{if(!hint&&cur){setHint(true);speak(cur.w)}};
  const next=()=>{
    if(lives<=0&&phase==="explode"){playSound("done");setPhase("done");return}
    if(wi+1>=Math.min(words.length,TOTAL)){playSound("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500);setPhase("done");return}
    setWi(w=>w+1);setPhase("ready");
  };
  const restart=async()=>{if(timerRef.current)clearInterval(timerRef.current);setLoading(true);setWi(0);setScore(0);setCombo(0);setMaxCombo(0);setLives(3);setPhase("ready");const cloud=await fetchCloudVocab(lv,TOTAL);if(cloud?.length)setWords(cloud.slice(0,TOTAL));setLoading(false)};

  if(loading)return(<div><Hdr t="💣 拆彈拼字" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入中...</div></div>);

  if(phase==="done"){const total=Math.min(words.length,TOTAL);return(<div>{showConfetti&&<Confetti/>}<Hdr t="💣 拆彈拼字" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{lives<=0?"💀":score>=total*0.8?"🏆":"🎉"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>{lives<=0?"💀 任務失敗...":"🎖️ 任務完成！"}</h2><div style={{fontSize:18,color:c.cl,fontWeight:600,marginTop:6}}>成功拆彈 {score}/{total}</div>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{fontSize:14,color:S.t2,marginTop:8,marginBottom:16}}>{score>=total*0.8?"拆彈專家！🌟":"多練幾次就能全部拆除！💪"}</div><button onClick={restart} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 再玩一次</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}

  const pct=Math.round((wi/Math.min(words.length,TOTAL))*100);
  const urgency=timeLeft<=3?"#E24B4A":timeLeft<=6?"#EF9F27":"#1D9E75";
  const fusePercent=(timeLeft/BOMB_TIME)*100;
  const comboLabel=combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";

  return(<div><Hdr t="💣 拆彈拼字" onBack={onBack} cl={c.cl}/>
    <style>{`@keyframes fuseBurn{0%,100%{opacity:1;text-shadow:0 0 6px #ff6600}50%{opacity:.6;text-shadow:0 0 12px #ff3300}}@keyframes bombTick{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}@keyframes explodeShake{0%,100%{transform:translate(0)}10%{transform:translate(-8px,4px)}30%{transform:translate(6px,-4px)}50%{transform:translate(-4px,6px)}70%{transform:translate(4px,-2px)}}`}</style>
    {/* Progress + Lives */}
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6,fontSize:12}}>
      <div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3,transition:"width .3s"}}/></div>
      <span style={{color:S.t3}}>{wi+1}/{Math.min(words.length,TOTAL)}</span>
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

      <div style={{padding:"24px 20px",textAlign:"center"}}>
        {/* Bomb + Timer */}
        <div style={{fontSize:phase==="explode"?80:60,animation:phase==="play"&&timeLeft<=5?"bombTick .3s infinite":phase==="defused"?"bounceIn .5s":"none",transition:"font-size .3s"}}>{phase==="explode"?"💥":phase==="defused"?"✅":"💣"}</div>
        {phase==="play"&&<div style={{fontSize:40,fontWeight:700,color:urgency,fontFamily:"monospace",marginTop:4,animation:timeLeft<=3?"emojiPulse .4s infinite":"none"}}>{timeLeft}</div>}

        {/* Clue */}
        <div style={{fontSize:14,color:c.cl,fontWeight:600,marginTop:10}}>✂️ 拼出正確的字來剪斷導火線！</div>
        <div style={{fontSize:30,fontWeight:700,color:S.t1,marginTop:8}}>{cur.m}</div>
        <div style={{fontSize:14,color:S.t2,marginTop:2}}>{cur.p}</div>
        {/* Hint area */}
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8,flexWrap:"wrap"}}>
          <button onClick={()=>speak(cur.w)} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:12,padding:"6px 14px",fontSize:13,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>🔊 聽發音</button>
          {!hint&&phase==="play"&&<button onClick={showHintFn} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:12,padding:"6px 14px",fontSize:13,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>💡 提示</button>}
        </div>
        {hint&&phase==="play"&&<div style={{marginTop:6,fontSize:16,color:c.cl,fontWeight:600}}>首字母：<span style={{fontSize:22,background:c.bg,padding:"2px 10px",borderRadius:8}}>{cur.w[0].toUpperCase()}</span> 共 {cur.w.length} 個字母</div>}

        {/* Letter slots */}
        {phase==="play"&&<div style={{display:"flex",justifyContent:"center",gap:4,marginTop:10,flexWrap:"wrap"}}>
          {cur.w.split("").map((l,i)=>(<div key={i} style={{width:28,height:32,borderRadius:6,border:`2px solid ${i<input.length?c.cl:S.bd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:i<input.length?c.cl:S.t3,background:i<input.length?c.bg:S.bg2,transition:"all .15s"}}>{i<input.length?input[i].toUpperCase():"·"}</div>))}
        </div>}

        {/* Input */}
        {phase==="play"&&<div style={{marginTop:12}}>
          <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submit()}} placeholder="輸入英文單字..." autoComplete="off" autoCapitalize="off" spellCheck="false" style={{width:"100%",maxWidth:280,padding:"14px 16px",borderRadius:14,border:`2px solid ${urgency}`,fontSize:18,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",textAlign:"center",fontWeight:600,letterSpacing:1}}/>
          <div style={{marginTop:10}}><button onClick={submit} disabled={!input.trim()} style={{...S.btn,background:urgency,color:"#fff",padding:"12px 32px",fontSize:16,opacity:input.trim()?1:.4}}>✂️ 剪線拆彈！</button></div>
        </div>}

        {/* Result */}
        {phase==="defused"&&<div style={{marginTop:12,animation:"fadeUp .3s"}}><div style={{fontSize:20,fontWeight:700,color:"#1D9E75"}}>✅ 成功拆彈！</div><div style={{fontSize:18,color:c.cl,marginTop:4,fontWeight:600}}>{cur.w}</div></div>}
        {phase==="explode"&&<div style={{marginTop:12,animation:"fadeUp .3s"}}><div style={{fontSize:20,fontWeight:700,color:"#E24B4A"}}>💥 爆炸了！</div><div style={{fontSize:16,color:S.t1,marginTop:4}}>正確答案：<b style={{color:c.cl,fontSize:20}}>{cur.w}</b></div></div>}
      </div>
    </div>

    {(phase==="defused"||phase==="explode")&&<div style={{textAlign:"center"}}><button onClick={next} style={{...S.btn,background:c.cl,color:"#fff",padding:"12px 28px",fontSize:15}}>{lives<=0&&phase==="explode"?"💀 遊戲結束":wi+1>=Math.min(words.length,TOTAL)?"🏁 看成績":"▶ 下一顆炸彈"}</button></div>}
  </div>);
}

// ═══ FRUIT SLASH (切水果) ══════════════════════════════════════════
function BalloonM({lv,onBack,onXp}){
  const c=LV[lv];
  const[words,setWords]=useState(V[lv]);const[loading,setLoading]=useState(true);
  const[qi,setQi]=useState(0);const[score,setScore]=useState(0);const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);
  const[phase,setPhase]=useState("play");const[showConfetti,setShowConfetti]=useState(false);
  const[fruits,setFruits]=useState([]);const[slashed,setSlashed]=useState(null);const[lives,setLives]=useState(3);
  const[splats,setSplats]=useState([]);
  const TOTAL=10;
  const FRUIT_EMOJIS=["🍎","🍊","🍋","🍇","🍉","🍓","🍑","🥝","🍌","🫐","🍒","🥭"];

  useEffect(()=>{(async()=>{const cloud=await fetchCloudVocab(lv,TOTAL*3);if(cloud?.length)setWords(cloud);setLoading(false)})()},[lv]);

  const generateFruits=useCallback((correct)=>{
    if(!correct)return[];
    const wrongs=words.filter(w=>w.w!==correct.w).sort(()=>Math.random()-.5).slice(0,3);
    const opts=[correct,...wrongs].sort(()=>Math.random()-.5);
    return opts.map((w,i)=>({
      id:i,word:w,isCorrect:w.w===correct.w,
      emoji:FRUIT_EMOJIS[Math.floor(Math.random()*FRUIT_EMOJIS.length)],
      x:5+i*23+Math.random()*5,
      delay:i*0.5+Math.random()*0.3,
      speed:2.8+Math.random()*1.2,
      rotation:Math.random()*360
    }));
  },[words]);

  useEffect(()=>{if(!loading&&words[qi])setFruits(generateFruits(words[qi]))},[qi,loading,generateFruits]);

  const slash=(fruit)=>{
    if(phase!=="play"||slashed!==null)return;
    setSlashed(fruit.id);
    setSplats(s=>[...s,{id:Date.now(),x:fruit.x,emoji:fruit.emoji}]);
    setTimeout(()=>setSplats(s=>s.filter(x=>Date.now()-x.id<800)),1000);
    playSound("flip");
    if(fruit.isCorrect){
      setScore(s=>s+1);onXp(10);setPhase("correct");
      setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));if(nc>=3)playSound("combo");else playSound("good");return nc});
      speak(fruit.word.w);
    }else{
      setPhase("wrong");setCombo(0);setLives(l=>l-1);playSound("bad");
    }
    setTimeout(()=>{
      if(lives<=1&&!fruit.isCorrect){playSound("done");setPhase("done");return}
      if(qi+1>=Math.min(words.length,TOTAL)){playSound("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500);setPhase("done")}
      else{setQi(q=>q+1);setPhase("play");setSlashed(null)}
    },1200);
  };

  const restart=async()=>{setLoading(true);setQi(0);setScore(0);setCombo(0);setMaxCombo(0);setLives(3);setPhase("play");setSlashed(null);setSplats([]);const cloud=await fetchCloudVocab(lv,TOTAL*3);if(cloud?.length)setWords(cloud);setLoading(false)};
  const cur=words[qi];

  if(loading||!cur)return(<div><Hdr t="🍉 切水果" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px",color:S.t3}}>載入中...</div></div>);

  if(phase==="done"){const total=Math.min(words.length,TOTAL);return(<div>{showConfetti&&<Confetti/>}<Hdr t="🍉 切水果" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{lives<=0?"💀":score>=total*0.8?"🏆":"🎉"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>{lives<=0?"遊戲結束！":"切完了！"}</h2><div style={{fontSize:18,color:c.cl,fontWeight:600,marginTop:6}}>切中 {score} 個</div>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{fontSize:14,color:S.t2,marginTop:8,marginBottom:16}}>{score>=total*0.8?"水果忍者！🌟":"多練幾次反應會更快！💪"}</div><button onClick={restart} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 再玩一次</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}

  const pct=Math.round((qi/Math.min(words.length,TOTAL))*100);
  const comboLabel=combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";

  return(<div><Hdr t="🍉 切水果" onBack={onBack} cl={c.cl}/>
    <style>{`@keyframes fruitFly{0%{transform:translateY(100%) scale(0.5) rotate(0deg);opacity:0}15%{opacity:1;transform:translateY(20%) scale(1) rotate(45deg)}50%{transform:translateY(-80%) scale(1.05) rotate(180deg)}85%{opacity:1;transform:translateY(10%) scale(0.95) rotate(300deg)}100%{transform:translateY(110%) scale(0.5) rotate(360deg);opacity:0}}@keyframes fruitSlash{0%{transform:scale(1) rotate(0deg)}30%{transform:scale(1.3) rotate(20deg)}60%{transform:scale(0.3) rotate(-10deg);opacity:.3}100%{transform:scale(0) rotate(30deg);opacity:0}}@keyframes splatDrip{0%{transform:scale(0);opacity:1}40%{transform:scale(2);opacity:.8}100%{transform:scale(3);opacity:0}}@keyframes slashLine{0%{width:0;opacity:1}100%{width:120px;opacity:0}}`}</style>
    {/* Progress + Lives */}
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6,fontSize:12}}>
      <div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3,transition:"width .3s"}}/></div>
      <span style={{color:S.t3}}>{qi+1}/{Math.min(words.length,TOTAL)}</span>
      <span style={{fontSize:14}}>{"❤️".repeat(lives)}{"🖤".repeat(Math.max(0,3-lives))}</span>
    </div>
    {comboLabel&&<div style={{textAlign:"center",fontSize:14,fontWeight:700,color:"#EF9F27",marginBottom:4,animation:"comboFlash .5s"}}>{comboLabel}</div>}

    {/* Question */}
    <div style={{...S.card,padding:"16px 20px",textAlign:"center",marginBottom:10}}>
      <div style={{fontSize:13,color:c.cl,fontWeight:600}}>🔪 切中正確翻譯的水果！</div>
      <div style={{fontSize:34,fontWeight:700,color:S.t1,marginTop:4}}>{cur.w}</div>
      <div style={{fontSize:13,color:S.t2}}>{cur.ph} · {cur.p}</div>
      <button onClick={()=>speak(cur.w)} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",marginTop:2}}>🔊</button>
    </div>

    {/* Fruit arena */}
    <div style={{position:"relative",height:300,background:"linear-gradient(180deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)",borderRadius:20,overflow:"hidden",border:`1px solid ${S.bd}`}}>
      {/* Stars */}
      {Array.from({length:15},(_,i)=><div key={i} style={{position:"absolute",left:`${8+Math.random()*84}%`,top:`${5+Math.random()*40}%`,width:Math.random()>0.5?2:1,height:Math.random()>0.5?2:1,background:"#fff",borderRadius:"50%",opacity:.2+Math.random()*.4}}/>)}
      {/* Slash FX */}
      {slashed!==null&&<div style={{position:"absolute",top:"45%",left:"10%",height:3,background:"linear-gradient(90deg,transparent,#fff,transparent)",borderRadius:2,animation:"slashLine .3s ease-out forwards",transformOrigin:"left"}}/>}
      {/* Splat FX */}
      {splats.map(s=><div key={s.id} style={{position:"absolute",left:`${s.x+5}%`,top:"40%",fontSize:36,animation:"splatDrip .8s ease-out forwards",pointerEvents:"none"}}>{s.emoji}</div>)}

      {/* Fruits */}
      {fruits.map(f=>(
        <button key={`${qi}-${f.id}`} onClick={()=>slash(f)} disabled={phase!=="play"||slashed!==null} style={{
          position:"absolute",left:`${f.x}%`,bottom:0,
          width:100,height:110,background:"none",border:"none",
          cursor:phase==="play"&&slashed===null?"pointer":"default",
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
          animation:slashed===f.id?"fruitSlash .5s ease-out forwards":`fruitFly ${f.speed}s ${f.delay}s ease-in-out infinite`,
          WebkitTapHighlightColor:"transparent",padding:0,gap:4,
          filter:slashed!==null&&slashed!==f.id?"brightness(0.3)":"none",
          transition:"filter .3s"
        }}>
          <div style={{fontSize:48,transform:`rotate(${f.rotation}deg)`,textShadow:"0 4px 16px rgba(0,0,0,.4)"}}>{f.emoji}</div>
          <div style={{background:"rgba(0,0,0,.7)",color:"#fff",padding:"4px 12px",borderRadius:12,fontSize:14,fontWeight:600,maxWidth:96,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",backdropFilter:"blur(4px)",border:"1px solid rgba(255,255,255,.1)"}}>{f.word.m}</div>
        </button>
      ))}

      {/* Result overlay */}
      {phase==="correct"&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}><div style={{fontSize:64,animation:"bounceIn .3s",textShadow:"0 0 30px rgba(29,158,117,.6)"}}>⚔️</div></div>}
      {phase==="wrong"&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.4)",flexDirection:"column",pointerEvents:"none"}}><div style={{fontSize:56}}>❌</div><div style={{fontSize:18,fontWeight:700,color:"#fff",marginTop:6,textShadow:"0 2px 8px rgba(0,0,0,.5)"}}>正確：{cur?.m}</div></div>}
    </div>

    <div style={{textAlign:"center",fontSize:11,color:S.t3,marginTop:8}}>🔪 水果飛上來時，切中正確翻譯的水果！切錯扣 ❤️</div>
  </div>);
}

// ═══ QUIZ ═══════════════════════════════════════════════════════════
function QuizM({lv,onBack,onXp,onPerfect,trackWeak}){
  const built=V[lv];const[words,setWords]=useState(built);const[loading,setLoading]=useState(true);const[qi,setQi]=useState(0);const[score,setScore]=useState(0);const[sel,setSel]=useState(null);const[done,setDone]=useState(false);const c=LV[lv];
  const[combo,setCombo]=useState(0);const[maxCombo,setMaxCombo]=useState(0);const[showConfetti,setShowConfetti]=useState(false);
  useEffect(()=>{(async()=>{const cloud=await fetchCloudVocab(lv,20);if(cloud?.length)setWords(cloud);setLoading(false)})()},[lv]);
  const qs=useMemo(()=>words.map((w,i)=>{const wr=words.filter((_,j)=>j!==i).sort(()=>Math.random()-.5).slice(0,3);return{word:w.w,ph:w.ph,correct:w.m,opts:[...wr.map(x=>x.m),w.m].sort(()=>Math.random()-.5)}}).sort(()=>Math.random()-.5),[words]);
  const pick=o=>{if(sel!==null)return;setSel(o);const ok=o===qs[qi].correct;
    if(ok){setScore(s=>s+1);onXp();playSound("good");setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));return nc})}
    else{trackWeak(qs[qi].word);playSound("bad");setCombo(0)}
    setTimeout(()=>{setSel(null);if(qi+1>=qs.length){setDone(true);if(score+(ok?1:0)>=qs.length)onPerfect();playSound("done");setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500)}else setQi(qi+1)},900)};
  const comboLabel=combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";
  if(loading)return(<div><Hdr t="📝 單字測驗" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px 16px",color:S.t3,fontSize:14}}>載入中...</div></div>);
  if(done){const pct=Math.round((score/qs.length)*100);return(<div>{showConfetti&&<Confetti/>}<Hdr t="📝 單字測驗" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{pct>=90?"🏆":pct>=70?"🎉":pct>=50?"👏":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>測驗完成！</h2><div style={{fontSize:18,color:c.cl,fontWeight:600,marginTop:6}}>{score}/{qs.length} 答對 ({pct}%)</div>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{fontSize:14,color:S.t2,marginTop:8,marginBottom:16}}>{pct>=90?"太厲害了！🌟":pct>=70?"不錯！繼續加油 💪":"多複習再來挑戰！📖"}</div><button onClick={()=>{setQi(0);setScore(0);setSel(null);setDone(false);setCombo(0);setMaxCombo(0)}} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 再測一次</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}
  const q=qs[qi];
  return(<div><Hdr t="📝 單字測驗" onBack={onBack} cl={c.cl}/>
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6,fontSize:12}}><div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${(qi/qs.length)*100}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3,transition:"width .3s"}}/></div><span style={{color:S.t3}}>{qi+1}/{qs.length}</span><span style={{color:"#1D9E75",fontWeight:600}}>{score}✓</span></div>
    {comboLabel&&<div style={{textAlign:"center",fontSize:14,fontWeight:700,color:"#EF9F27",marginBottom:4,animation:"comboFlash .5s"}}>{comboLabel}</div>}
    <div style={{...S.card,padding:"28px 20px",textAlign:"center"}}>
      <div style={{fontSize:34,fontWeight:700,color:S.t1,animation:"fadeUp .3s"}}>{q.word}</div>
      <div style={{fontSize:13,color:S.t3,marginTop:4,marginBottom:8}}>{q.ph}</div>
      <button onClick={()=>speak(q.word)} style={{background:"none",border:"none",fontSize:26,cursor:"pointer",marginBottom:14,padding:"4px"}}>🔊</button>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{q.opts.map((o,i)=>{const ok=o===q.correct,pk=sel===o;let bg=S.bg2,bd=`1px solid ${S.bd}`,anim="";if(sel!==null){if(ok){bg="#E1F5EE";bd="2px solid #1D9E75";anim="bounceIn .3s"}else if(pk){bg="#FCEBEB";bd="2px solid #E24B4A";anim="moleShake .3s"}}return<button key={i} onClick={()=>pick(o)} style={{padding:"16px 10px",borderRadius:14,background:bg,border:bd,cursor:sel?"default":"pointer",fontSize:14,fontFamily:"inherit",color:S.t1,fontWeight:sel&&ok?700:400,transition:"all .15s",animation:anim,minHeight:52,WebkitTapHighlightColor:"transparent"}} onTouchStart={e=>{if(!sel)e.currentTarget.style.transform="scale(0.95)"}} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>{o}</button>})}</div>
    </div>
  </div>);
}
// ═══ DICTATION ══════════════════════════════════════════════════════
function DictM({lv,onBack,onXp,onDone}){
  const sents=DICT[lv];const c=LV[lv];
  const[qi,setQi]=useState(0);const[inp,setInp]=useState("");const[result,setResult]=useState(null);const[score,setScore]=useState(0);const[done,setDone]=useState(false);
  const current=sents[qi];
  useEffect(()=>{if(!done&&!result)setTimeout(()=>speak(current,undefined,0.75),300)},[qi,result]);
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
  const[showConfetti,setShowConfetti]=useState(false);const[hintUsed,setHintUsed]=useState(false);

  useEffect(()=>{if(qi<data.length){const words=data[qi].s.split(" ");setPool(words.map((w,i)=>({w,id:i})).sort(()=>Math.random()-.5));setSelected([]);setResult(null);setHintUsed(false)}},[qi]);

  const tapPool=(item)=>{if(result!==null)return;playSound("flip");setPool(p=>p.filter(x=>x.id!==item.id));setSelected(s=>[...s,item])};
  const tapSel=(item)=>{if(result!==null)return;setSelected(s=>s.filter(x=>x.id!==item.id));setPool(p=>[...p,item])};
  const clearAll=()=>{if(result!==null)return;setPool(p=>[...p,...selected]);setSelected([])};
  const showHint=()=>{
    if(hintUsed||result!==null)return;
    setHintUsed(true);
    // Show first word hint
    const firstWord=data[qi].s.split(" ")[0];
    const inPool=pool.find(x=>x.w===firstWord);
    if(inPool&&selected.length===0){tapPool(inPool)}
    speak(data[qi].s,"en-US",0.7);
  };

  const check=()=>{
    const ans=selected.map(x=>x.w).join(" ");
    const ok=ans.toLowerCase()===data[qi].s.toLowerCase();
    if(ok){
      setScore(s=>s+1);onXp(hintUsed?5:10);playSound("good");
      setCombo(cb=>{const nc=cb+1;setMaxCombo(mc=>Math.max(mc,nc));if(nc>=3)playSound("combo");return nc});
      speak(data[qi].s);
    }else{
      playSound("bad");setCombo(0);
    }
    setResult(ok);
  };

  const next=()=>{
    if(qi+1>=data.length){
      setDone(true);onDone();playSound("done");
      setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500);
    }else setQi(qi+1)};

  if(done){const pct=Math.round((score/data.length)*100);return(<div>{showConfetti&&<Confetti/>}<Hdr t="🧩 句子重組" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{pct>=80?"🏆":pct>=60?"🎉":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>重組完成！</h2><div style={{fontSize:18,color:c.cl,fontWeight:600,marginTop:6}}>{score}/{data.length} 正確 ({pct}%)</div>{maxCombo>=3&&<div style={{fontSize:13,color:"#EF9F27",fontWeight:600,marginTop:4}}>🔥 最高 {maxCombo} 連擊！</div>}<div style={{fontSize:14,color:S.t2,marginTop:8,marginBottom:16}}>{pct>=80?"語感很好！🌟":"多練幾次語序會更熟！💪"}</div><button onClick={()=>{setQi(0);setScore(0);setDone(false);setCombo(0);setMaxCombo(0)}} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 再練</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}

  const comboLabel=combo>=7?"🔥🔥 ON FIRE!":combo>=5?"🔥 COMBO x"+combo:combo>=3?"✨ "+combo+" 連擊！":"";
  const wordCount=data[qi].s.split(" ").length;

  return(<div><Hdr t="🧩 句子重組" onBack={onBack} cl={c.cl}/>
    {/* Progress */}
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6,fontSize:12}}>
      <div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${(qi/data.length)*100}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3,transition:"width .3s"}}/></div>
      <span style={{color:S.t3}}>{qi+1}/{data.length}</span>
      <span style={{color:"#1D9E75",fontWeight:600}}>{score}✓</span>
    </div>
    {comboLabel&&<div style={{textAlign:"center",fontSize:14,fontWeight:700,color:"#EF9F27",marginBottom:4,animation:"comboFlash .5s"}}>{comboLabel}</div>}

    <div style={{...S.card,padding:"22px 18px"}}>
      {/* Chinese hint */}
      <div style={{textAlign:"center",marginBottom:14}}>
        <div style={{fontSize:12,color:S.t3,marginBottom:4}}>把單字排成正確的英文句子</div>
        <div style={{fontSize:18,fontWeight:700,color:S.t1}}>💡 {data[qi].h}</div>
        <div style={{fontSize:12,color:S.t3,marginTop:4}}>共 {wordCount} 個單字</div>
      </div>

      {/* Sentence assembly area */}
      <div style={{minHeight:56,padding:"12px 10px",background:result===null?"linear-gradient(135deg,"+S.bg2+","+c.bg+"11)":result?"linear-gradient(135deg,#E1F5EE,#E8F5E9)":"linear-gradient(135deg,#FCEBEB,#FFF3CD)",borderRadius:16,display:"flex",flexWrap:"wrap",gap:6,marginBottom:4,border:`2px ${result===null?"dashed":"solid"} ${result===null?c.cl+"44":result?"#1D9E75":"#E24B4A"}`,transition:"all .3s",alignItems:"center",justifyContent:selected.length===0?"center":"flex-start"}}>
        {selected.length===0&&<span style={{color:S.t3,fontSize:13}}>👆 點擊下方單字開始組句</span>}
        {selected.map((item,i)=>(<button key={item.id} onClick={()=>tapSel(item)} style={{padding:"10px 16px",borderRadius:12,background:result===null?c.cl:result?"#1D9E75":"#E24B4A",color:"#fff",border:"none",fontSize:16,cursor:result?"default":"pointer",fontFamily:"inherit",fontWeight:600,animation:"fadeUp .2s",animationDelay:`${i*0.03}s`,animationFillMode:"both",boxShadow:`0 2px 6px ${c.cl}30`,WebkitTapHighlightColor:"transparent"}}>{item.w}</button>))}
      </div>

      {/* Clear button */}
      {selected.length>0&&result===null&&<div style={{textAlign:"right",marginBottom:8}}>
        <button onClick={clearAll} style={{background:"none",border:"none",fontSize:12,color:S.t3,cursor:"pointer",padding:"4px 8px"}}>🗑️ 清空重排</button>
      </div>}

      {/* Word pool */}
      <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:14,minHeight:pool.length>0?48:0,transition:"min-height .3s"}}>
        {pool.map(item=>(<button key={item.id} onClick={()=>tapPool(item)} style={{padding:"11px 18px",borderRadius:12,background:S.bg1,color:S.t1,border:`2px solid ${S.bd}`,fontSize:16,cursor:"pointer",fontFamily:"inherit",fontWeight:500,transition:"all .15s",boxShadow:"0 2px 4px rgba(0,0,0,.04)",WebkitTapHighlightColor:"transparent"}} onTouchStart={e=>e.currentTarget.style.transform="scale(0.92)"} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>{item.w}</button>))}
      </div>

      {/* Action buttons */}
      {result===null?(<div style={{display:"flex",gap:8,justifyContent:"center"}}>
        {!hintUsed&&<button onClick={showHint} style={{...S.btn,background:S.bg2,color:S.t2,padding:"10px 16px",fontSize:13,borderRadius:14}}>💡 提示</button>}
        <button onClick={check} disabled={pool.length>0} style={{...S.btn,background:c.cl,color:"#fff",padding:"10px 24px",fontSize:14,opacity:pool.length>0?.4:1,borderRadius:14}}>✅ 檢查答案</button>
      </div>):(
      <div style={{textAlign:"center",animation:"fadeUp .3s"}}>
        <div style={{fontSize:18,fontWeight:700,color:result?"#1D9E75":"#E24B4A",marginBottom:6,animation:result?"bounceIn .3s":"moleShake .3s"}}>{result?"✅ 完美！":"❌ 順序不對"}</div>
        {!result&&<div style={{marginBottom:8}}>
          <div style={{fontSize:12,color:S.t3,marginBottom:4}}>正確語序：</div>
          <div style={{fontSize:15,color:S.t1,padding:"10px 14px",background:"#E1F5EE",borderRadius:12,display:"inline-block",fontWeight:600}}>{data[qi].s}</div>
          <button onClick={()=>speak(data[qi].s)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",marginLeft:4,verticalAlign:"middle"}}>🔊</button>
        </div>}
        {result&&<div style={{marginBottom:8}}>
          <button onClick={()=>speak(data[qi].s)} style={{background:S.bg2,border:`1px solid ${S.bd}`,borderRadius:12,padding:"6px 16px",fontSize:13,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>🔊 聽整句發音</button>
        </div>}
        <button onClick={next} style={{...S.btn,background:c.cl,color:"#fff",fontSize:14,padding:"12px 28px",borderRadius:14}}>{qi+1>=data.length?"🏁 看成績":"▶ 下一題"}</button>
      </div>)}
    </div>
  </div>);
}
// ═══ GRAMMAR (文法學堂 v2) ═══════════════════════════════════════════
function GrammarM({lv,onBack,onXp}){
  const rules=G[lv];const[sel,setSel]=useState(null);const[ans,setAns]=useState(null);const c=LV[lv];
  const[score,setScore]=useState(0);const[completed,setCompleted]=useState([]);
  const[showResult,setShowResult]=useState(false);

  const handleAns=(i)=>{
    if(ans!==null)return;
    setAns(i);
    const r=rules[sel];
    if(i===r.q.a){setScore(s=>s+1);playSound("good");if(onXp)onXp(5)}
    else playSound("bad");
    if(!completed.includes(sel))setCompleted(c=>[...c,sel]);
  };

  const goNext=()=>{
    if(sel<rules.length-1){setSel(sel+1);setAns(null)}
    else setShowResult(true);
  };
  const goPrev=()=>{if(sel>0){setSel(sel-1);setAns(null)}};

  // Result screen
  if(showResult){const pct=Math.round((score/rules.length)*100);return(<div><Hdr t="🧠 文法學堂" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:56,animation:"bounceIn .5s ease-out"}}>{pct>=80?"🏆":pct>=60?"🎉":"💪"}</div><h2 style={{fontSize:22,fontWeight:700,color:S.t1,marginTop:8}}>文法學習完成！</h2><div style={{fontSize:18,color:c.cl,fontWeight:600,marginTop:6}}>{score}/{rules.length} 答對 ({pct}%)</div><div style={{fontSize:14,color:S.t2,marginTop:8,marginBottom:16}}>{pct>=80?"文法小天才！🌟":pct>=60?"不錯！回去複習錯的題目 💪":"多看幾次會更熟！📖"}</div><button onClick={()=>{setSel(null);setScore(0);setAns(null);setCompleted([]);setShowResult(false)}} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:14}}>🔄 重新學習</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:14}}>返回</button></div></div>)}

  // Topic list
  if(sel===null)return(<div><Hdr t="🧠 文法學堂" onBack={onBack} cl={c.cl}/>
    {/* Progress summary */}
    {completed.length>0&&<div style={{...S.card,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{fontSize:13,color:S.t2}}>已學 {completed.length}/{rules.length} · 答對 {score}</div>
      <div style={{height:6,flex:1,maxWidth:120,background:S.bg2,borderRadius:3,marginLeft:12}}><div style={{height:"100%",width:`${(completed.length/rules.length)*100}%`,background:c.cl,borderRadius:3,transition:"width .3s"}}/></div>
    </div>}
    <div style={{display:"grid",gap:8}}>
      {rules.map((r,i)=>{const done=completed.includes(i);return(<div key={i} onClick={()=>{setSel(i);setAns(null)}} style={{cursor:"pointer",...S.card,padding:"16px 18px",display:"flex",gap:12,alignItems:"center",borderLeft:`4px solid ${done?"#1D9E75":c.cl}`,transition:"all .15s"}} onTouchStart={e=>e.currentTarget.style.transform="scale(0.98)"} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
        <div style={{width:36,height:36,borderRadius:"50%",background:done?"#E1F5EE":c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:done?16:14,fontWeight:700,color:done?"#1D9E75":c.cl,flexShrink:0}}>{done?"✓":i+1}</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:15,color:S.t1}}>{r.t}</div>
          <div style={{fontSize:12,color:S.t2,marginTop:2}}>{r.d}</div>
        </div>
        <div style={{fontSize:18,opacity:.4}}>›</div>
      </div>)})}
    </div>
  </div>);

  // Detail view
  const r=rules[sel];
  const progress=(sel+1)/rules.length*100;
  return(<div><Hdr t="🧠 文法學堂" onBack={onBack} cl={c.cl}/>
    {/* Progress bar */}
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8,fontSize:12}}>
      <button onClick={()=>{setSel(null);setAns(null)}} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>📋 列表</button>
      <div style={{flex:1,height:6,background:S.bg2,borderRadius:3}}><div style={{height:"100%",width:`${progress}%`,background:`linear-gradient(90deg,${c.cl},${c.ac})`,borderRadius:3,transition:"width .3s"}}/></div>
      <span style={{color:S.t3}}>{sel+1}/{rules.length}</span>
    </div>

    {/* Topic card */}
    <div style={{...S.card,padding:"24px 20px",marginBottom:10}}>
      {/* Title */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{width:40,height:40,borderRadius:"50%",background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:c.cl,flexShrink:0}}>{sel+1}</div>
        <div>
          <h3 style={{fontSize:20,fontWeight:700,color:S.t1,margin:0}}>{r.t}</h3>
          <div style={{fontSize:13,color:c.cl,fontWeight:600,marginTop:2}}>{r.d}</div>
        </div>
      </div>

      {/* Rule explanation card */}
      <div style={{background:`linear-gradient(135deg,${c.bg}44,${S.bg2})`,borderRadius:14,padding:"16px",marginBottom:14,borderLeft:`4px solid ${c.cl}`}}>
        <div style={{fontSize:12,fontWeight:600,color:c.cl,marginBottom:6}}>📝 公式</div>
        <div style={{fontSize:15,fontWeight:600,color:S.t1,lineHeight:1.6}}>{r.d}</div>
      </div>

      {/* Example */}
      <div style={{background:S.bg2,borderRadius:14,padding:"14px 16px",marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:600,color:S.t2,marginBottom:6}}>📖 範例</div>
        <div style={{fontSize:16,color:S.t1,fontStyle:"italic",lineHeight:1.6}}>"{r.ex}"</div>
        <button onClick={()=>speak(r.ex)} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",marginTop:4}}>🔊</button>
      </div>

      {/* Quiz */}
      <div style={{borderTop:`2px solid ${S.bd}`,paddingTop:16}}>
        <div style={{fontSize:14,fontWeight:700,color:S.t1,marginBottom:10}}>🎯 小測驗</div>
        <div style={{fontSize:16,color:S.t1,marginBottom:12,lineHeight:1.6,fontWeight:500}}>{r.q.s.split("___").map((part,pi,arr)=>(<span key={pi}>{part}{pi<arr.length-1&&<span style={{display:"inline-block",minWidth:60,borderBottom:`3px solid ${ans===null?c.cl:ans===r.q.a?"#1D9E75":"#E24B4A"}`,textAlign:"center",fontWeight:700,color:ans!==null?(ans===r.q.a?"#1D9E75":"#E24B4A"):c.cl,padding:"0 4px",transition:"all .2s"}}>{ans!==null?r.q.o[r.q.a]:"？"}</span>}</span>))}</div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {r.q.o.map((o,i)=>{const ok=i===r.q.a,pk=ans===i;
            let bg=S.bg2,bd=`1px solid ${S.bd}`,anim="";
            if(ans!==null){
              if(ok){bg="#E1F5EE";bd="2px solid #1D9E75";anim="bounceIn .3s"}
              else if(pk){bg="#FCEBEB";bd="2px solid #E24B4A";anim="moleShake .3s"}
            }
            return<button key={i} onClick={()=>handleAns(i)} style={{padding:"14px 10px",borderRadius:14,background:bg,border:bd,cursor:ans!==null?"default":"pointer",fontSize:15,fontFamily:"inherit",color:S.t1,fontWeight:ans!==null&&ok?700:400,transition:"all .15s",animation:anim,minHeight:48,WebkitTapHighlightColor:"transparent"}} onTouchStart={e=>{if(ans===null)e.currentTarget.style.transform="scale(0.95)"}} onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>{o}</button>})}
        </div>

        {ans!==null&&<div style={{marginTop:12,padding:"12px 16px",borderRadius:12,background:ans===r.q.a?"#E1F5EE":"#FFF3CD",animation:"fadeUp .3s"}}>
          <div style={{fontSize:15,fontWeight:700,color:ans===r.q.a?"#1D9E75":"#E24B4A"}}>{ans===r.q.a?"✅ 正確！":"❌ 答錯了"}</div>
          {ans!==r.q.a&&<div style={{fontSize:13,color:S.t1,marginTop:4}}>正確答案：<b style={{color:"#1D9E75"}}>{r.q.o[r.q.a]}</b></div>}
          <div style={{fontSize:12,color:S.t2,marginTop:4}}>💡 {r.d}</div>
        </div>}
      </div>
    </div>

    {/* Navigation */}
    <div style={{display:"flex",gap:8}}>
      <button onClick={goPrev} disabled={sel===0} style={{...S.btn,background:S.bg2,color:S.t1,flex:1,opacity:sel===0?.3:1,fontSize:14,padding:"12px"}}>← 上一題</button>
      {ans!==null?<button onClick={goNext} style={{...S.btn,background:c.cl,color:"#fff",flex:1,fontSize:14,padding:"12px"}}>{sel>=rules.length-1?"🏁 看成績":"下一題 →"}</button>
      :<div style={{flex:1}}/>}
    </div>
  </div>);
}
// ═══ READING ════════════════════════════════════════════════════════
function ReadingM({lv,onBack}){
  const articles=R[lv];const[ai,setAi]=useState(0);const[ans,setAns]=useState({});const c=LV[lv];const d=articles[ai];
  return(<div><Hdr t="📖 閱讀理解" onBack={onBack} cl={c.cl}/><div style={{display:"flex",gap:5,marginBottom:10,overflowX:"auto"}}>{articles.map((a,i)=>(<button key={i} onClick={()=>{setAi(i);setAns({})}} style={{flexShrink:0,padding:"8px 14px",borderRadius:12,background:i===ai?c.cl:S.bg2,minHeight:36,color:i===ai?"#fff":S.t1,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{a.t}</button>))}</div>
    <div style={{...S.card,padding:"18px 16px",marginBottom:12}}><h3 style={{fontSize:18,fontWeight:700,color:S.t1,marginBottom:10}}>{d.t}</h3><div style={{fontSize:14,lineHeight:1.9,color:S.t1,padding:"10px 12px",background:S.bg2,borderRadius:10,borderLeft:`3px solid ${c.ac}`}}>{d.tx}</div><button onClick={()=>speak(d.tx)} style={{marginTop:6,background:"none",border:"none",fontSize:14,color:c.cl,cursor:"pointer",padding:"4px"}}>🔊 朗讀全文</button></div>
    {d.qs.map((q,qi)=>(<div key={qi} style={{...S.card,padding:"14px",marginBottom:8}}><div style={{fontWeight:600,fontSize:13,color:S.t1,marginBottom:6}}>Q{qi+1}. {q.q}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>{q.o.map((o,oi)=>{const dn=ans[qi]!==undefined,ok=oi===q.a,pk=ans[qi]===oi;let bg=S.bg2,bd=`1px solid ${S.bd}`;if(dn){if(ok){bg="#EAF3DE";bd="2px solid #639922"}else if(pk){bg="#FCEBEB";bd="2px solid #E24B4A"}}return<button key={oi} onClick={()=>{if(!dn)setAns(a=>({...a,[qi]:oi}))}} style={{padding:"8px 6px",borderRadius:8,background:bg,border:bd,cursor:dn?"default":"pointer",fontSize:12,fontFamily:"inherit",color:S.t1,textAlign:"left"}}>{o}</button>})}</div></div>))}
  </div>);
}
// ═══ AI TUTOR ═══════════════════════════════════════════════════════
function AIT({lv,onBack,apiKey,onSetKey}){
  const c=LV[lv];const RATES=[{l:"慢速",i:"🐢",v:0.6},{l:"正常",i:"🎯",v:0.85},{l:"快速",i:"🐇",v:1.15}];
  const[msgs,setMsgs]=useState([{role:"a",content:`哈囉！我是你的 AI 英語家教 🤖\n\n• 點擊 **粗體英文字** 可以聽發音\n• 每則回覆旁有 🔊 **朗讀按鈕**\n• 右上角可調 **語速**\n\n試試問我：「教我一個新單字」`}]);
  const[inp,setInp]=useState("");const[busy,setBusy]=useState(false);const[showKey,setShowKey]=useState(!apiKey);const[keyInp,setKeyInp]=useState(apiKey);const[ri,setRi]=useState(1);const[pi,setPi]=useState(-1);const[pt,setPt]=useState(0);const btm=useRef(null);
  useEffect(()=>{btm.current?.scrollIntoView({behavior:"smooth"})},[msgs]);
  const pgs=[{l:"學習",items:["教我一個新單字","解釋文法重點","翻譯練習","每日一句"]},{l:"情境",items:["練習餐廳點餐","練習問路","練習自我介紹","練習電話英語"]},{l:"批改",items:["幫我批改英文","中翻英練習","用單字造句","寫英文日記"]}];
  const send=async(ov)=>{const txt=(ov||inp).trim();if(!txt||busy)return;if(!apiKey){setShowKey(true);return}if(!ov)setInp("");setMsgs(m=>[...m,{role:"u",content:txt}]);setBusy(true);
    try{const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:`You are a friendly English tutor for a Taiwanese ${LV[lv].l} student. Reply in Traditional Chinese mixed with English. Use **bold** for English words. Include pronunciation, meaning, examples. Be concise.`}]},contents:[{parts:[{text:txt}]}],generationConfig:{maxOutputTokens:1000,temperature:0.7}})});const data=await res.json();setMsgs(m=>[...m,{role:"a",content:data?.candidates?.[0]?.content?.parts?.[0]?.text||data?.error?.message||"抱歉，暫時無法回答。"}])}catch(e){setMsgs(m=>[...m,{role:"a",content:`⚠️ 連線失敗\n請確認 API Key 是否正確`}])}setBusy(false)};
  const doSpeak=(text,idx)=>{if(pi===idx){window.speechSynthesis.cancel();setPi(-1);return}setPi(idx);speakMx(text,RATES[ri].v);const ck=setInterval(()=>{if(!window.speechSynthesis.speaking){setPi(-1);clearInterval(ck)}},300)};
  return(<div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 110px)"}}>
    <Hdr t="AI 英語家教" onBack={onBack} cl={c.cl} extra={<div style={{display:"flex",gap:3}}><button onClick={()=>setRi(r=>(r+1)%3)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"2px 6px",fontSize:12,cursor:"pointer",color:S.t2}}>{RATES[ri].i}{RATES[ri].l}</button><button onClick={()=>setShowKey(!showKey)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"2px 6px",fontSize:12,cursor:"pointer",color:S.t2}}>{apiKey?"🔑":"⚙️"}</button></div>}/>
    {showKey&&<div style={{...S.card,padding:"12px 14px",marginBottom:8,fontSize:11}}><div style={{fontWeight:600,color:S.t1,marginBottom:4}}>Gemini API Key</div><div style={{color:S.t2,marginBottom:6,lineHeight:1.5}}>1. <b>aistudio.google.com</b> 登入<br/>2. Get API key → 建立<br/>3. 貼到下方（免費）</div><div style={{display:"flex",gap:5}}><input value={keyInp} onChange={e=>setKeyInp(e.target.value)} placeholder="API Key..." type="password" style={{flex:1,padding:"6px 8px",borderRadius:6,border:`1px solid ${S.bd}`,fontSize:11,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none"}}/><button onClick={()=>{onSetKey(keyInp);setShowKey(false)}} style={{...S.btn,background:c.cl,color:"#fff",padding:"6px 12px",fontSize:11}}>存</button></div></div>}
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:7,padding:"2px 0"}}>
      {msgs.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:m.role==="u"?"flex-end":"flex-start",gap:3,alignItems:"flex-end"}}><div style={{maxWidth:"82%",padding:"9px 12px",borderRadius:14,background:m.role==="u"?c.cl:S.bg1,color:m.role==="u"?"#fff":S.t1,border:m.role==="u"?"none":`1px solid ${S.bd}`,fontSize:12,lineHeight:1.7}}>{m.role==="u"?m.content:<Md text={m.content} color={c.cl}/>}</div>{m.role==="a"&&i>0&&<button onClick={()=>doSpeak(m.content,i)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",padding:"2px",flexShrink:0,opacity:pi===i?1:.4}}>{pi===i?"⏹":"🔊"}</button>}</div>))}
      {busy&&<div style={{padding:"8px 12px",borderRadius:14,background:S.bg1,border:`1px solid ${S.bd}`,fontSize:11,color:S.t3,alignSelf:"flex-start"}}><span style={{animation:"pulse 1.2s ease-in-out infinite"}}>思考中...</span></div>}
      <div ref={btm}/>
    </div>
    <div style={{flexShrink:0,padding:"3px 0 0"}}><div style={{display:"flex",gap:3,marginBottom:3}}>{pgs.map((g,i)=>(<button key={i} onClick={()=>setPt(i)} style={{padding:"2px 8px",borderRadius:8,background:pt===i?c.cl:S.bg2,color:pt===i?"#fff":S.t2,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{g.l}</button>))}</div><div style={{display:"flex",gap:3,overflowX:"auto",paddingBottom:3}}>{pgs[pt].items.map((p,i)=>(<button key={i} onClick={()=>send(p)} style={{flexShrink:0,padding:"3px 8px",borderRadius:12,background:S.bg2,border:`1px solid ${S.bd}`,fontSize:11,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>{p}</button>))}</div></div>
    <div style={{display:"flex",gap:5,padding:"3px 0 1px",flexShrink:0}}><input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={apiKey?"輸入訊息...":"設定 API Key ↑"} style={{flex:1,padding:"8px 10px",borderRadius:10,border:`1px solid ${S.bd}`,fontSize:12,outline:"none",fontFamily:"inherit",background:S.bg1,color:S.t1}}/><button onClick={()=>send()} disabled={busy||!inp.trim()} style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 12px",opacity:(busy||!inp.trim())?0.5:1,fontSize:12}}>發送</button></div>
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
// ═══ WRONG ANSWER REVIEW (錯題本) ═══════════════════════════════════
function WeakPage({onBack,weakWords,setWeakWords,c,lv}){
  const sorted=[...weakWords].sort((a,b)=>b.n-a.n);
  const[mode,setMode]=useState("list");// list, review
  const[ri,setRi]=useState(0);const[flip,setFlip]=useState(false);
  const[cloudData,setCloudData]=useState({});
  // Try to fetch full word data for weak words
  useEffect(()=>{(async()=>{const sb=await getSb();if(!sb)return;for(const w of sorted.slice(0,20)){if(cloudData[w.w])continue;try{const{data}=await sb.from('word_bank').select('*').eq('word',w.w).limit(1);if(data?.[0])setCloudData(d=>({...d,[w.w]:{m:data[0].meaning,p:data[0].pos,ph:data[0].phonetic,ex:data[0].example,ez:data[0].example_zh}}))}catch{}}})()},[weakWords]);

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
// ═══ SPONSOR PAGE (贊助頁面) ═══════════════════════════════════════
// Code validation: format EG-XXXX, sum of charCodes % 73 === 0
function validateSponsorCode(code){
  if(!code||code.length<6)return false;
  const c=code.trim().toUpperCase();
  if(!c.startsWith("EG-"))return false;
  const payload=c.slice(3);
  const sum=payload.split("").reduce((a,ch)=>a+ch.charCodeAt(0),0);
  return sum%73===0;
}

function SponsorPage({onBack,c,sponsor,setSponsor}){
  const[codeInp,setCodeInp]=useState("");
  const[msg,setMsg]=useState("");
  const[showInput,setShowInput]=useState(false);

  const activate=()=>{
    const code=codeInp.trim().toUpperCase();
    if(validateSponsorCode(code)){
      setSponsor({code,active:true,name:"贊助者",date:new Date().toISOString()});
      setMsg("✅ 贊助碼驗證成功！已為您移除所有廣告 🎉");
      playSound("done");
    }else{
      setMsg("❌ 贊助碼無效，請確認後再試");
      playSound("bad");
    }
  };

  const deactivate=()=>{setSponsor({code:"",active:false,name:""});setMsg("已取消贊助狀態");setCodeInp("")};

  return(<div><Hdr t="💎 贊助我們" onBack={onBack} cl={c.cl}/>
    {/* Current status */}
    {sponsor.active?(<div style={{...S.card,padding:"24px 20px",textAlign:"center",marginBottom:12,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`,border:`2px solid ${c.cl}`}}>
      <div style={{fontSize:48,marginBottom:8}}>💎</div>
      <div style={{fontSize:20,fontWeight:700,color:c.cl}}>感謝您的贊助！</div>
      <div style={{fontSize:14,color:S.t2,marginTop:4}}>已為您移除所有廣告</div>
      <div style={{fontSize:12,color:S.t3,marginTop:6}}>贊助碼：{sponsor.code}</div>
      <button onClick={deactivate} style={{background:"none",border:"none",fontSize:12,color:S.t3,cursor:"pointer",marginTop:12,textDecoration:"underline"}}>取消贊助狀態</button>
    </div>):(
    <>
      {/* Why sponsor */}
      <div style={{...S.card,padding:"20px",marginBottom:12}}>
        <div style={{fontSize:18,fontWeight:700,color:S.t1,marginBottom:8}}>🙏 為什麼需要贊助？</div>
        <div style={{fontSize:14,color:S.t2,lineHeight:1.9}}>
          EnglishGo 是一個<b>完全免費</b>的英語學習平台，目前由個人開發者維護。您的贊助可以幫助：
        </div>
        <div style={{display:"grid",gap:8,marginTop:12}}>
          {[{icon:"🖥️",title:"伺服器費用",desc:"Supabase 資料庫 + Netlify 部署"},
            {icon:"📚",title:"單字庫擴充",desc:"持續新增到 6,000+ 字"},
            {icon:"🛠️",title:"功能開發",desc:"更多遊戲、更好的學習體驗"},
            {icon:"🤖",title:"AI 服務",desc:"維持 Gemini API 免費使用"}
          ].map((item,i)=>(<div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderBottom:i<3?`1px solid ${S.bd}`:"none"}}>
            <div style={{fontSize:24,flexShrink:0}}>{item.icon}</div>
            <div><div style={{fontSize:13,fontWeight:600,color:S.t1}}>{item.title}</div><div style={{fontSize:12,color:S.t3}}>{item.desc}</div></div>
          </div>))}
        </div>
      </div>

      {/* Sponsor benefits */}
      <div style={{...S.card,padding:"20px",marginBottom:12}}>
        <div style={{fontSize:18,fontWeight:700,color:S.t1,marginBottom:8}}>🎁 贊助者福利</div>
        <div style={{display:"grid",gap:10}}>
          {[{icon:"🚫",title:"移除所有廣告",desc:"乾淨的學習畫面，不再被廣告打斷"},
            {icon:"💎",title:"贊助者徽章",desc:"Menu 顯示專屬 💎 標誌"},
            {icon:"❤️",title:"支持開源教育",desc:"幫助更多台灣學生免費學英文"}
          ].map((item,i)=>(<div key={i} style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{fontSize:22,flexShrink:0}}>{item.icon}</div>
            <div><div style={{fontSize:13,fontWeight:600,color:S.t1}}>{item.title}</div><div style={{fontSize:12,color:S.t3}}>{item.desc}</div></div>
          </div>))}
        </div>
      </div>

      {/* How to sponsor */}
      <div style={{...S.card,padding:"20px",marginBottom:12}}>
        <div style={{fontSize:18,fontWeight:700,color:S.t1,marginBottom:8}}>💳 如何贊助</div>
        <div style={{fontSize:14,color:S.t2,lineHeight:1.9}}>
          詳細的贊助方式請參考：<br/>
          <a href="/learn/sponsor.html" style={{color:c.cl,fontWeight:600}} target="_blank" rel="noreferrer">👉 贊助說明頁面</a>
        </div>
        <div style={{fontSize:13,color:S.t3,marginTop:8,lineHeight:1.8}}>
          贊助完成後，您會收到一組<b>贊助碼</b>（格式：EG-XXXX），在下方輸入即可啟用。
        </div>
      </div>

      {/* Code input */}
      <div style={{...S.card,padding:"20px",marginBottom:12}}>
        <div style={{fontSize:16,fontWeight:700,color:S.t1,marginBottom:8}}>🔑 輸入贊助碼</div>
        {!showInput?(<button onClick={()=>setShowInput(true)} style={{...S.btn,background:c.cl,color:"#fff",padding:"12px 24px",fontSize:14,width:"100%"}}>我已經贊助，輸入贊助碼</button>):(
        <div>
          <input value={codeInp} onChange={e=>setCodeInp(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==="Enter")activate()}} placeholder="EG-XXXXXXXX" style={{width:"100%",padding:"14px 16px",borderRadius:12,border:`2px solid ${S.bd}`,fontSize:18,fontFamily:"monospace",background:S.bg1,color:S.t1,outline:"none",textAlign:"center",fontWeight:600,letterSpacing:2}}/>
          <button onClick={activate} disabled={!codeInp.trim()} style={{...S.btn,background:c.cl,color:"#fff",padding:"12px 24px",fontSize:14,width:"100%",marginTop:8,opacity:codeInp.trim()?1:.4}}>驗證贊助碼</button>
        </div>)}
        {msg&&<div style={{marginTop:10,fontSize:14,fontWeight:600,color:msg.startsWith("✅")?"#1D9E75":"#E24B4A",textAlign:"center",animation:"fadeUp .3s"}}>{msg}</div>}
      </div>
    </>)}

    {/* Privacy note */}
    <div style={{...S.card,padding:"14px 16px",fontSize:12,color:S.t3,lineHeight:1.8}}>
      🔒 <b>隱私說明</b>：贊助碼只存在您的瀏覽器中（localStorage），不會上傳到任何伺服器。清除瀏覽器資料時需要重新輸入。
    </div>
  </div>);
}
// ═══ SHARED ════════════════════════════════════════════════════════
function AdBanner(){
  const ref=useRef(null);
  useEffect(()=>{try{if(window.adsbygoogle&&ref.current)(window.adsbygoogle=window.adsbygoogle||[]).push({})}catch{}},[]);
  if(typeof window==="undefined"||!window.adsbygoogle)return null;
  return(<div style={{textAlign:"center",margin:"16px 0",minHeight:50}}><ins className="adsbygoogle" ref={ref} style={{display:"block"}} data-ad-format="auto" data-full-width-responsive="true"/></div>);
}
// ═══ SHARED ════════════════════════════════════════════════════════
function Hdr({t,onBack,cl,extra}){return(<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:8}}><button onClick={onBack} style={{background:"none",border:"none",fontSize:12,color:cl,cursor:"pointer",fontWeight:600,fontFamily:"inherit",padding:"6px 8px",minHeight:36,borderRadius:8,WebkitTapHighlightColor:"transparent"}}>← 返回</button><h2 style={{fontSize:16,fontWeight:700,color:S.t1,margin:0,flex:1}}>{t}</h2>{extra}</div>)}
function PB({v,mx,cl}){return(<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,fontSize:12}}><div style={{flex:1,height:4,background:S.bg2,borderRadius:2}}><div style={{height:"100%",width:`${(v/mx)*100}%`,background:cl,borderRadius:2,transition:"width .3s"}}/></div><span style={{color:S.t3}}>{v+1}/{mx}</span></div>)}
