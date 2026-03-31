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

async function fetchCloudVocab(level, count = 20) {
  const sb = await getSb();
  if (!sb) return null;
  try {
    const { data: allIds } = await sb.from('word_bank').select('id').eq('level', level);
    if (!allIds?.length) return null;
    const ids = allIds.sort(() => Math.random() - 0.5).slice(0, count).map(r => r.id);
    const { data } = await sb.from('word_bank').select('*').in('id', ids);
    if (!data) return null;
    return data.sort(() => Math.random() - 0.5).map(r => ({
      w: r.word, ph: r.phonetic || '', p: r.pos || '', m: r.meaning,
      f: typeof r.forms === 'string' ? JSON.parse(r.forms || '[]') : (r.forms || []),
      c: typeof r.collocations === 'string' ? JSON.parse(r.collocations || '[]') : (r.collocations || []),
      ex: r.example || '', ez: r.example_zh || '', img: ''
    }));
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
let _voiceUri = null; // selected voice URI
function getVoices(){return window.speechSynthesis?.getVoices()?.filter(v=>/^en/i.test(v.lang))||[]}
function speak(t,l="en-US",r=0.85){if(!window.speechSynthesis)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang=l;u.rate=r;if(_voiceUri){const v=window.speechSynthesis.getVoices().find(x=>x.voiceURI===_voiceUri);if(v){u.voice=v;u.lang=v.lang}}window.speechSynthesis.speak(u)}
function VoicePicker(){const[voices,setVoices]=useState([]);const[cur,setCur]=useState(_voiceUri||"");useEffect(()=>{const load=()=>{const v=getVoices();if(v.length)setVoices(v)};load();window.speechSynthesis?.addEventListener?.("voiceschanged",load);return()=>window.speechSynthesis?.removeEventListener?.("voiceschanged",load)},[]);if(!voices.length)return null;return(<select value={cur} onChange={e=>{_voiceUri=e.target.value||null;setCur(e.target.value);if(e.target.value){const v=voices.find(x=>x.voiceURI===e.target.value);if(v)speak("Hello!","en-US",0.85)}}} style={{padding:"3px 4px",borderRadius:6,border:`1px solid var(--color-border-tertiary,#e0dfd9)`,fontSize:9,background:"var(--color-background-primary,#fff)",color:"var(--color-text-secondary,#73726c)",maxWidth:110,fontFamily:"inherit"}}><option value="">預設語音</option>{voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name.replace(/Microsoft |Google |Apple /,"").slice(0,18)}{v.lang.includes("GB")?" 🇬🇧":v.lang.includes("AU")?" 🇦🇺":v.lang.includes("US")?" 🇺🇸":""}</option>)}</select>)}
function createDeck(c){return{queue:c.map((_,i)=>i),rm:[],stats:{again:0,hard:0,good:0,easy:0},total:c.length}}
function rateDeck(d,a){const n={...d,queue:[...d.queue],rm:[...d.rm],stats:{...d.stats}};const c=n.queue.shift();if(c===undefined)return n;n.stats[a]++;if(a==="again")n.queue.splice(Math.min(1,n.queue.length),0,c);else if(a==="hard")n.queue.splice(Math.floor(n.queue.length/2),0,c);else if(a==="good")n.queue.push(c);else n.rm.push(c);return n}
function parseCSV(t){return t.trim().split("\n").slice(1).map(l=>{const m=l.match(/^"?([^",]+)"?\s*,\s*"?([\s\S]*?)"?\s*$/);if(!m)return null;const w=m[1].trim(),b=m[2].trim(),p=b.match(/\(([a-z.\/]+)\)\s*(.+?)(?:\n|$)/);return{w,ph:"",p:p?.[1]||"",m:p?.[2]?.trim()||b.split("\n")[0],f:[],c:[],ex:"",ez:""}}).filter(Boolean)}
const imgC={};function preImg(ws,s=0,n=3){for(let i=s;i<Math.min(s+n,ws.length);i++){const w=ws[i]?.w;if(w&&!imgC[w]){const img=new Image();img.src=`https://loremflickr.com/300/150/${encodeURIComponent(w)}?lock=${i}`;imgC[w]=img.src}}}
// ─── Markdown renderer ──────────────────────────────────────────────
function Md({text,color}){if(!text)return null;return text.split("\n").map((line,li)=>{if(!line.trim())return <br key={li}/>;const isB=/^\s*[\*\-•]\s+/.test(line);const cl=isB?line.replace(/^\s*[\*\-•]\s+/,""):line;const parts=[];let rem=cl,k=0;while(rem.length>0){const m=rem.match(/\*\*(.+?)\*\*/);if(m){const idx=rem.indexOf(m[0]);if(idx>0)parts.push(<span key={k++}>{rem.slice(0,idx)}</span>);const isEn=/^[a-zA-Z]/.test(m[1]);parts.push(<strong key={k++} style={{fontWeight:700,cursor:isEn?"pointer":"default",color:isEn?color:"inherit",textDecoration:isEn?"underline dotted":"none",textUnderlineOffset:"3px"}} onClick={()=>isEn&&speak(m[1])}>{m[1]}</strong>);rem=rem.slice(idx+m[0].length)}else{parts.push(<span key={k++}>{rem}</span>);break}}return<div key={li} style={{marginBottom:2,paddingLeft:isB?16:0,position:"relative"}}>{isB&&<span style={{position:"absolute",left:0}}>•</span>}{parts}</div>})}
function speakMx(text,rate=0.85){if(!window.speechSynthesis)return;window.speechSynthesis.cancel();const cl=text.replace(/\*\*/g,"").replace(/[#•\-]/g," ");const segs=cl.split(/([a-zA-Z][a-zA-Z\s\-',.!?;:()]+)/g).filter(s=>s.trim());let d=0;segs.forEach(s=>{const en=/^[a-zA-Z]/.test(s.trim());const u=new SpeechSynthesisUtterance(s.trim());u.lang=en?"en-US":"zh-TW";u.rate=en?rate:rate+.15;if(en&&_voiceUri){const v=window.speechSynthesis.getVoices().find(x=>x.voiceURI===_voiceUri);if(v){u.voice=v;u.lang=v.lang}}setTimeout(()=>window.speechSynthesis.speak(u),d);d+=s.length*(en?55:80)})}

const S={btn:{padding:"10px 20px",borderRadius:12,border:"none",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"},
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
  const[weakWords,setWeakWords]=useLS("weak",[]);
  const[showAch,setShowAch]=useState(null);

  // Check streak & daily reset
  useEffect(()=>{const today=new Date().toDateString();if(daily.date!==today){const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);if(daily.date===yesterday.toDateString()&&daily.done>0)setStreak(s=>s+1);else setStreak(1);setDaily({target:10,done:0,date:today})}},[]);

  // Check achievements
  useEffect(()=>{const s={xp,streak,...stats};ACH_DEFS.forEach(a=>{if(!achUnlocked.includes(a.id)&&a.check(s)){setAchUnlocked(u=>[...u,a.id]);setShowAch(a)}});},[xp,streak,stats]);

  const addXp=(n=5)=>{setXp(x=>x+n);setDaily(d=>({...d,done:Math.min(d.done+1,d.target)}))};
  const trackWeak=(word)=>{setWeakWords(w=>{const e=w.find(x=>x.w===word);if(e)return w.map(x=>x.w===word?{...x,n:x.n+1}:x);return[...w,{w:word,n:1}].slice(-50)})};

  useEffect(()=>{const r=document.documentElement.style;r.colorScheme=dark?"dark":"light";if(dark){r.setProperty('--color-background-primary','#1a1a2e');r.setProperty('--color-background-secondary','#16213e');r.setProperty('--color-background-tertiary','#0f0f23');r.setProperty('--color-text-primary','#e0e0e0');r.setProperty('--color-text-secondary','#a0a0a0');r.setProperty('--color-text-tertiary','#707070');r.setProperty('--color-border-tertiary','#2a2a4a')}else{['--color-background-primary','--color-background-secondary','--color-background-tertiary','--color-text-primary','--color-text-secondary','--color-text-tertiary','--color-border-tertiary'].forEach(p=>r.removeProperty(p))}},[dark]);

  if(!lv)return<Landing onSelect={setLv} dark={dark} setDark={setDark}/>;
  const c=LV[lv],back=()=>setMod(null);

  return(
    <div style={{minHeight:"100vh",background:S.bg3,fontFamily:"'Noto Sans TC','Segoe UI',sans-serif"}}>
      {/* Achievement popup */}
      {showAch&&<div onClick={()=>setShowAch(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><div style={{...S.card,padding:"32px 40px",textAlign:"center",animation:"fadeUp .4s ease-out"}}><div style={{fontSize:56}}>{showAch.icon}</div><div style={{fontSize:18,fontWeight:700,color:S.t1,marginTop:8}}>成就解鎖！</div><div style={{fontSize:16,fontWeight:600,color:c.cl,marginTop:4}}>{showAch.name}</div><div style={{fontSize:13,color:S.t2,marginTop:4}}>{showAch.desc}</div><div style={{fontSize:11,color:S.t3,marginTop:12}}>點擊關閉</div></div></div>}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <nav style={{background:S.bg1,borderBottom:`1px solid ${S.bd}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:8,position:"sticky",top:0,zIndex:100}}>
        <button onClick={()=>{setLv(null);setMod(null)}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer"}}>←</button>
        <span style={{fontSize:16}}>{c.ic}</span>
        <span style={{fontWeight:600,color:c.cl,fontSize:13,flex:1}}>{c.l}</span>
        <span style={{fontSize:11,color:S.t3}}>🔥{streak}</span>
        <span style={{fontSize:11,color:S.t3}}>⭐{xp}</span>
        <span style={{fontSize:11,color:S.t3}}>📊{daily.done}/{daily.target}</span>
        <VoicePicker/>
        <button onClick={()=>setDark(!dark)} style={{background:"none",border:"none",fontSize:14,cursor:"pointer"}}>{dark?"☀️":"🌙"}</button>
      </nav>
      <div style={{maxWidth:760,margin:"0 auto",padding:"16px 14px"}}>
        {!mod?<Menu lv={lv} onSelect={setMod} daily={daily} c={c} xp={xp} streak={streak} achUnlocked={achUnlocked} weakWords={weakWords}/>:
         mod==="srs"?<SRS lv={lv} onBack={back} onXp={addXp} onDone={()=>setStats(s=>({...s,srsRounds:s.srsRounds+1}))} trackWeak={trackWeak}/>:
         mod==="quiz"?<QuizM lv={lv} onBack={back} onXp={addXp} onPerfect={()=>setStats(s=>({...s,perfectQuiz:s.perfectQuiz+1}))} trackWeak={trackWeak}/>:
         mod==="grammar"?<GrammarM lv={lv} onBack={back}/>:
         mod==="reading"?<ReadingM lv={lv} onBack={back}/>:
         mod==="dictation"?<DictM lv={lv} onBack={back} onXp={addXp} onDone={()=>setStats(s=>({...s,dictDone:s.dictDone+1}))}/>:
         mod==="scramble"?<ScramM lv={lv} onBack={back} onXp={addXp} onDone={()=>setStats(s=>({...s,scramDone:s.scramDone+1}))}/>:
         mod==="ai"?<AIT lv={lv} onBack={back} apiKey={gemKey} onSetKey={setGemKey}/>:
         mod==="achievements"?<AchPage onBack={back} unlocked={achUnlocked} c={c}/>:null}
      </div>
    </div>
  );
}

// ═══ LANDING ════════════════════════════════════════════════════════
function Landing({onSelect,dark,setDark}){
  const[hov,setHov]=useState(null);
  return(<div style={{minHeight:"100vh",background:"linear-gradient(150deg,#091825,#122a45 45%,#183a58 75%,#0d1f32)",color:"#fff",fontFamily:"'Noto Sans TC','Segoe UI',sans-serif"}}>
    <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}`}</style>
    <div style={{position:"relative",zIndex:1,maxWidth:860,margin:"0 auto",padding:"48px 20px 36px",textAlign:"center"}}>
      <div style={{position:"absolute",top:20,right:20}}><button onClick={()=>setDark(!dark)} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:20,padding:"6px 12px",fontSize:12,color:"#fff",cursor:"pointer"}}>{dark?"☀️ 淺色":"🌙 深色"}</button></div>
      <div style={{animation:"fadeUp .7s",display:"inline-flex",alignItems:"center",gap:10,background:"rgba(255,255,255,.06)",borderRadius:36,padding:"8px 22px",border:"1px solid rgba(255,255,255,.1)"}}><span style={{fontSize:28}}>📘</span><span style={{fontSize:24,fontWeight:700,letterSpacing:1.5}}>EnglishGo</span></div>
      <p style={{animation:"fadeUp .7s .15s both",color:"rgba(255,255,255,.5)",fontSize:13,marginTop:12}}>專為台灣學生設計 · AI 驅動英語學習平台</p>
      <h1 style={{animation:"fadeUp .7s .3s both",fontSize:"clamp(22px,5vw,36px)",fontWeight:700,margin:"16px 0 8px",lineHeight:1.35}}><span style={{background:"linear-gradient(90deg,#5DCAA5,#85B7EB,#ED93B1)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>科學記憶 × 間隔重複 × AI 家教</span></h1>
      <p style={{animation:"fadeUp .7s .45s both",color:"rgba(255,255,255,.4)",fontSize:12,maxWidth:400,margin:"0 auto 32px"}}>SRS 演算法 · 聽寫訓練 · 句子重組 · Gemini AI 免費對話</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14,animation:"fadeUp .7s .6s both"}}>
        {Object.entries(LV).map(([k,c])=>(<div key={k} onClick={()=>onSelect(k)} onMouseEnter={()=>setHov(k)} onMouseLeave={()=>setHov(null)} style={{cursor:"pointer",background:hov===k?"rgba(255,255,255,.12)":"rgba(255,255,255,.05)",border:`1px solid ${hov===k?"rgba(255,255,255,.2)":"rgba(255,255,255,.08)"}`,borderRadius:16,padding:"24px 16px 20px",transition:"all .25s",transform:hov===k?"translateY(-4px)":"none"}}><div style={{fontSize:36,marginBottom:6}}>{c.ic}</div><div style={{fontSize:18,fontWeight:700}}>{c.l}</div><div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginBottom:10}}>{c.en}</div><div style={{fontSize:10,color:c.ac,background:`${c.ac}22`,borderRadius:14,padding:"3px 10px",display:"inline-block"}}>{c.wd}</div></div>))}
      </div>
      <div style={{marginTop:40,display:"flex",flexWrap:"wrap",justifyContent:"center",gap:20,animation:"fadeUp .7s .8s both"}}>
        {[{i:"🃏",t:"SRS 記憶",d:"Anki 演算法"},{i:"🎧",t:"聽寫訓練",d:"聽力最弱救星"},{i:"🧩",t:"句子重組",d:"語感養成"},{i:"🤖",t:"AI 家教",d:"Gemini 免費"},{i:"🏆",t:"成就系統",d:"徽章收集"},{i:"🌙",t:"深色模式",d:"護眼學習"}].map((f,i)=>(<div key={i} style={{textAlign:"center",width:95}}><div style={{fontSize:22,marginBottom:3}}>{f.i}</div><div style={{fontSize:11,fontWeight:600}}>{f.t}</div><div style={{fontSize:9,color:"rgba(255,255,255,.35)"}}>{f.d}</div></div>))}
      </div>
    </div>
  </div>);
}

// ═══ MENU ═══════════════════════════════════════════════════════════
function Menu({lv,onSelect,daily,c,xp,streak,achUnlocked,weakWords}){
  const pct=Math.round((daily.done/daily.target)*100);
  const todayWord=V[lv][new Date().getDate()%V[lv].length];
  const[cloudCount,setCloudCount]=useState(0);
  useEffect(()=>{fetchCloudCount(lv).then(n=>setCloudCount(n||0))},[lv]);
  return(<div>
    {/* Daily word card */}
    <div style={{...S.card,padding:"16px 18px",marginBottom:12,background:`linear-gradient(135deg,${c.bg},var(--color-background-primary,#fff))`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:11,color:c.cl,fontWeight:600,marginBottom:4}}>今日推薦單字</div><div style={{fontSize:24,fontWeight:700,color:S.t1}}>{todayWord.w} <button onClick={()=>speak(todayWord.w)} style={{background:"none",border:"none",fontSize:16,cursor:"pointer"}}>🔊</button></div><div style={{fontSize:12,color:S.t2}}>{todayWord.m} · {todayWord.p}</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:11,color:S.t3}}>進度 {pct}%</div><div style={{width:80,height:5,background:S.bg2,borderRadius:3,marginTop:4}}><div style={{height:"100%",width:`${pct}%`,background:c.cl,borderRadius:3,transition:"width .4s"}}/></div></div>
      </div>
    </div>
    {/* Weak words reminder */}
    {weakWords.length>0&&<div style={{...S.card,padding:"10px 14px",marginBottom:12,fontSize:12}}>
      <span style={{fontWeight:600,color:"#E24B4A"}}>需加強：</span>
      {weakWords.sort((a,b)=>b.n-a.n).slice(0,5).map((w,i)=><span key={i} style={{marginLeft:6,color:S.t2}}>{w.w}({w.n})</span>)}
    </div>}
    {/* Modules */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
      {[
        {id:"srs",icon:"🃏",t:"SRS 單字卡",d:cloudCount?`雲端 ${cloudCount} 字`:"Anki 間隔重複"},
        {id:"quiz",icon:"📝",t:"單字測驗",d:"四選一回饋"},
        {id:"dictation",icon:"🎧",t:"聽寫訓練",d:"聽力養成"},
        {id:"scramble",icon:"🧩",t:"句子重組",d:"語序訓練"},
        {id:"grammar",icon:"🧠",t:"文法學堂",d:`${G[lv].length} 個重點`},
        {id:"reading",icon:"📖",t:"閱讀理解",d:`${R[lv].length} 篇文章`},
        {id:"ai",icon:"🤖",t:"AI 家教",d:"Gemini 對話"},
        {id:"achievements",icon:"🏆",t:"成就徽章",d:`${achUnlocked.length}/${ACH_DEFS.length} 已解鎖`},
      ].map(m=>(<div key={m.id} onClick={()=>onSelect(m.id)} style={{cursor:"pointer",...S.card,padding:"18px 12px",transition:"all .15s"}}
        onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 4px 14px ${c.cl}10`}}
        onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none"}}>
        <div style={{fontSize:24,marginBottom:5}}>{m.icon}</div>
        <div style={{fontWeight:600,fontSize:13,color:S.t1,marginBottom:2}}>{m.t}</div>
        <div style={{fontSize:10,color:S.t2}}>{m.d}</div>
      </div>))}
    </div>
  </div>);
}

// ═══ SRS FLASHCARD ══════════════════════════════════════════════════
function SRS({lv,onBack,onXp,onDone,trackWeak}){
  const built=V[lv];const[cards,setCards]=useState(built);const[deck,setDeck]=useState(()=>createDeck(built));const[flip,setFlip]=useState(false);const[info,setInfo]=useState(false);const[loading,setLoading]=useState(true);const[src,setSrc]=useState("built-in");const c=LV[lv];const fr=useRef();
  // Try cloud fetch on mount
  useEffect(()=>{(async()=>{setLoading(true);const cloud=await fetchCloudVocab(lv,20);if(cloud&&cloud.length>0){setCards(cloud);setDeck(createDeck(cloud));setSrc(`cloud (${cloud.length}字)`);}else setSrc("built-in ("+built.length+"字)");setLoading(false)})()},[lv]);
  const cur=deck.queue[0]!==undefined?cards[deck.queue[0]]:null;const left=deck.queue.length;const done=left===0;
  useEffect(()=>{if(cur)preImg(cards,deck.queue[0],3)},[deck.queue[0]]);
  useEffect(()=>{if(cur&&!flip&&!loading)speak(cur.w)},[cur?.w,flip,loading]);
  const rate=useCallback(a=>{if(a==="again"&&cur)trackWeak(cur.w);if(a==="easy"||a==="good")onXp();setDeck(d=>rateDeck(d,a));setFlip(false)},[onXp,cur,trackWeak]);
  useEffect(()=>{const h=e=>{if(done)return;if(e.code==="Space"){e.preventDefault();setFlip(f=>{if(!f&&cur?.ex)setTimeout(()=>speak(cur.ex),350);return!f})}if(flip){if(e.key==="1")rate("again");if(e.key==="2")rate("hard");if(e.key==="3")rate("good");if(e.key==="4")rate("easy")}if(e.key==="Enter"){e.preventDefault();if(cur)speak(flip?(cur.ex||cur.w):cur.w)}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[flip,done,cur,rate]);
  // Touch swipe for mobile rating
  const touchStart=useRef(null);
  const onTouchStart=e=>{touchStart.current={x:e.touches[0].clientX,y:e.touches[0].clientY}};
  const onTouchEnd=e=>{if(!touchStart.current||!flip)return;const dx=e.changedTouches[0].clientX-touchStart.current.x;const dy=e.changedTouches[0].clientY-touchStart.current.y;touchStart.current=null;if(Math.abs(dx)<40&&Math.abs(dy)<40)return;if(Math.abs(dx)>Math.abs(dy)){if(dx>0)rate("good");else rate("again")}else{if(dy<0)rate("easy");else rate("hard")}};
  const handleCardTap=()=>{if(!flip){setFlip(true);if(cur.ex)setTimeout(()=>speak(cur.ex),350)}};
  const handleCSV=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const p=parseCSV(ev.target.result);if(p.length){setCards(p);setDeck(createDeck(p));setFlip(false)}};r.readAsText(f,"utf-8")};
  useEffect(()=>{if(done&&!loading)onDone()},[done,loading]);
  if(loading)return(<div><Hdr t="SRS 單字卡" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px 16px",color:S.t3,fontSize:14}}>載入單字庫中...</div></div>);
  if(done){const{stats,total}=deck;return(<div><Hdr t="SRS 單字卡" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"32px 16px"}}><div style={{fontSize:48}}>🎉</div><h2 style={{fontSize:18,fontWeight:700,color:S.t1,marginTop:8}}>練習完成！共 {total} 張</h2><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,maxWidth:320,margin:"16px auto"}}>{[["Again",stats.again,"#E24B4A"],["Hard",stats.hard,"#EF9F27"],["Good",stats.good,"#1D9E75"],["Easy",stats.easy,"#185FA5"]].map(([l,v,cl])=>(<div key={l} style={{...S.card,padding:"8px 4px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:cl}}>{v}</div><div style={{fontSize:9,color:S.t3}}>{l}</div></div>))}</div><button onClick={async()=>{setLoading(true);const cloud=await fetchCloudVocab(lv,20);if(cloud?.length){setCards(cloud);setDeck(createDeck(cloud))}else setDeck(createDeck(cards));setFlip(false);setLoading(false)}} style={{...S.btn,background:c.cl,color:"#fff",marginRight:8,fontSize:13}}>新一輪</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:13}}>返回</button></div></div>)}
  const pct=Math.round(((deck.total-left)/deck.total)*100);
  return(<div><Hdr t="SRS 單字卡" onBack={onBack} cl={c.cl} extra={<div style={{display:"flex",gap:4}}><button onClick={()=>setInfo(!info)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"2px 6px",fontSize:10,cursor:"pointer",color:S.t2}}>ⓘ</button><label style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"2px 6px",fontSize:10,cursor:"pointer",color:S.t2}}>📥<input ref={fr} type="file" accept=".csv" onChange={handleCSV} style={{display:"none"}}/></label></div>}/>
    {info&&<div style={{...S.card,padding:"10px 14px",marginBottom:8,fontSize:11,color:S.t2,lineHeight:1.7}}>💻 <b>Space</b> 翻牌 · <b>Enter</b> 朗讀 · <b>1</b>Again <b>2</b>Hard <b>3</b>Good <b>4</b>Easy<br/>📱 <b>點擊</b>翻牌 · <b>滑動</b>評分（←Again →Good ↑Easy ↓Hard）<div style={{marginTop:4,fontSize:10,color:S.t3}}>來源：{src}</div></div>}
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8,fontSize:10}}><div style={{flex:1,height:4,background:S.bg2,borderRadius:2}}><div style={{height:"100%",width:`${pct}%`,background:c.cl,borderRadius:2,transition:"width .3s"}}/></div><span style={{color:S.t3}}>{left}/{deck.total}</span>{[["#E24B4A",deck.stats.again],["#EF9F27",deck.stats.hard],["#1D9E75",deck.stats.good],["#185FA5",deck.stats.easy]].map(([cl,v],i)=><span key={i} style={{color:cl,fontWeight:600}}>{v}</span>)}</div>
    <div onClick={handleCardTap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{cursor:!flip?"pointer":"default",borderRadius:16,padding:flip?"14px 16px 18px":"40px 16px",textAlign:"center",minHeight:flip?240:180,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:flip?"flex-start":"center",background:flip?`linear-gradient(135deg,${c.bg},#fff)`:S.bg1,border:`2px solid ${flip?c.ac:S.bd}`,transition:"all .25s",userSelect:"none",WebkitUserSelect:"none"}}>
      {!flip?(<>{cur.img&&<div style={{fontSize:36,marginBottom:6}}>{cur.img}</div>}<div style={{fontSize:28,fontWeight:700,color:S.t1}}>{cur.w}<button onClick={e=>{e.stopPropagation();speak(cur.w)}} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",marginLeft:4}}>🔊</button></div>{cur.ph&&<div style={{fontSize:11,color:S.t3,marginTop:3}}>{cur.ph}</div>}<div style={{fontSize:11,color:c.cl,marginTop:12,padding:"6px 16px",background:c.bg,borderRadius:20,fontWeight:600}}>👆 點擊翻牌</div><div style={{fontSize:9,color:S.t3,marginTop:4}}>電腦可按 Space</div></>):(<>
        {imgC[cur.w]&&<img src={imgC[cur.w]} alt="" style={{width:"100%",maxWidth:260,height:120,objectFit:"cover",borderRadius:10,marginBottom:8}} onError={e=>e.target.style.display="none"}/>}
        <div style={{fontSize:18,fontWeight:700,color:c.cl}}>{cur.w} <span style={{fontSize:11,fontWeight:400,color:S.t3}}>({cur.p})</span></div>
        <div style={{fontSize:16,fontWeight:600,color:S.t1,margin:"2px 0 6px"}}>{cur.m}</div>
        {cur.f?.length>0&&<div style={{fontSize:10,color:S.t2,marginBottom:4,width:"100%",padding:"4px 8px",background:`${c.ac}0a`,borderRadius:6,textAlign:"left"}}><b style={{color:c.cl}}>詞性</b>{cur.f.map((f,i)=><span key={i} style={{marginLeft:4}}>{f.w}({f.p}){f.n}</span>)}</div>}
        {cur.c?.length>0&&<div style={{fontSize:10,color:S.t2,marginBottom:4,width:"100%",padding:"4px 8px",background:`${c.ac}0a`,borderRadius:6,textAlign:"left"}}><b style={{color:c.cl}}>搭配</b>{cur.c.map((x,i)=><div key={i} style={{marginLeft:8}}>{x}</div>)}</div>}
        {cur.ex&&<div style={{fontSize:12,color:S.t1,fontStyle:"italic",width:"100%",padding:"6px 8px",background:S.bg2,borderRadius:6,textAlign:"left"}}>"{cur.ex}"<button onClick={e=>{e.stopPropagation();speak(cur.ex)}} style={{background:"none",border:"none",fontSize:12,cursor:"pointer",marginLeft:3}}>🔊</button>{cur.ez&&<div style={{fontSize:10,color:S.t3,fontStyle:"normal",marginTop:1}}>{cur.ez}</div>}</div>}
      </>)}
    </div>
    {flip&&<><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginTop:10}}>{[{k:"again",l:"Again",n:"1",cl:"#E24B4A",bg:"#FCEBEB"},{k:"hard",l:"Hard",n:"2",cl:"#BA7517",bg:"#FAEEDA"},{k:"good",l:"Good",n:"3",cl:"#0F6E56",bg:"#E1F5EE"},{k:"easy",l:"Easy",n:"4",cl:"#185FA5",bg:"#E6F1FB"}].map(b=>(<button key={b.k} onClick={()=>rate(b.k)} style={{...S.btn,background:b.bg,color:b.cl,padding:"10px 2px",fontSize:12,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>{b.l}<span style={{fontSize:8,opacity:.5}}>{b.n}</span></button>))}</div><div style={{textAlign:"center",fontSize:9,color:S.t3,marginTop:4}}>📱 也可滑動：← Again · → Good · ↑ Easy · ↓ Hard</div></>}
  </div>);
}
// ═══ QUIZ ═══════════════════════════════════════════════════════════
function QuizM({lv,onBack,onXp,onPerfect,trackWeak}){
  const built=V[lv];const[words,setWords]=useState(built);const[loading,setLoading]=useState(true);const[qi,setQi]=useState(0);const[score,setScore]=useState(0);const[sel,setSel]=useState(null);const[done,setDone]=useState(false);const c=LV[lv];
  useEffect(()=>{(async()=>{const cloud=await fetchCloudVocab(lv,20);if(cloud?.length)setWords(cloud);setLoading(false)})()},[lv]);
  const qs=useMemo(()=>words.map((w,i)=>{const wr=words.filter((_,j)=>j!==i).sort(()=>Math.random()-.5).slice(0,3);return{word:w.w,ph:w.ph,correct:w.m,opts:[...wr.map(x=>x.m),w.m].sort(()=>Math.random()-.5)}}).sort(()=>Math.random()-.5),[words]);
  const pick=o=>{if(sel!==null)return;setSel(o);const ok=o===qs[qi].correct;if(ok){setScore(s=>s+1);onXp()}else trackWeak(qs[qi].word);setTimeout(()=>{setSel(null);qi+1>=qs.length?setDone(true):setQi(qi+1)},800)};
  useEffect(()=>{if(done&&score===qs.length)onPerfect()},[done]);
  if(loading)return(<div><Hdr t="單字測驗" onBack={onBack} cl={c.cl}/><div style={{textAlign:"center",padding:"48px 16px",color:S.t3,fontSize:14}}>載入中...</div></div>);
  if(done){return(<div style={{textAlign:"center",padding:"36px 16px"}}><Hdr t="單字測驗" onBack={onBack} cl={c.cl}/><div style={{fontSize:44}}>{score>=8?"🏆":score>=6?"👏":"💪"}</div><h2 style={{fontSize:17,fontWeight:700,color:S.t1,marginTop:6}}>{score}/{qs.length}</h2><button onClick={()=>{setQi(0);setScore(0);setSel(null);setDone(false)}} style={{...S.btn,background:c.cl,color:"#fff",marginTop:16,marginRight:8,fontSize:12}}>再測</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:12}}>返回</button></div>)}
  const q=qs[qi];
  return(<div><Hdr t="單字測驗" onBack={onBack} cl={c.cl}/><PB v={qi} mx={qs.length} cl={c.cl}/><div style={{...S.card,padding:"22px 16px",textAlign:"center"}}><div style={{fontSize:26,fontWeight:700,color:S.t1}}>{q.word}</div><div style={{fontSize:10,color:S.t3,marginBottom:12}}>{q.ph}</div><button onClick={()=>speak(q.word)} style={{background:"none",border:"none",fontSize:15,cursor:"pointer",marginBottom:10}}>🔊</button><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{q.opts.map((o,i)=>{const ok=o===q.correct,pk=sel===o;let bg=S.bg2,bd=`1px solid ${S.bd}`;if(sel!==null){if(ok){bg="#EAF3DE";bd="2px solid #639922"}else if(pk){bg="#FCEBEB";bd="2px solid #E24B4A"}}return<button key={i} onClick={()=>pick(o)} style={{padding:"10px 6px",borderRadius:10,background:bg,border:bd,cursor:sel?"default":"pointer",fontSize:12,fontFamily:"inherit",color:S.t1}}>{o}</button>})}</div></div></div>);
}
// ═══ DICTATION ══════════════════════════════════════════════════════
function DictM({lv,onBack,onXp,onDone}){
  const sents=DICT[lv];const c=LV[lv];
  const[qi,setQi]=useState(0);const[inp,setInp]=useState("");const[result,setResult]=useState(null);const[score,setScore]=useState(0);const[done,setDone]=useState(false);
  const current=sents[qi];
  useEffect(()=>{if(!done&&!result)setTimeout(()=>speak(current,undefined,0.75),300)},[qi,result]);
  const check=()=>{if(!inp.trim())return;const clean=s=>s.toLowerCase().replace(/[^a-z0-9\s]/g,"").trim();const correct=clean(current)===clean(inp);if(correct){setScore(s=>s+1);onXp(10)}setResult(correct)};
  const next=()=>{setResult(null);setInp("");if(qi+1>=sents.length){setDone(true);onDone()}else setQi(qi+1)};
  if(done)return(<div style={{textAlign:"center",padding:"36px 16px"}}><Hdr t="聽寫訓練" onBack={onBack} cl={c.cl}/><div style={{fontSize:44}}>🎧</div><h2 style={{fontSize:17,fontWeight:700,color:S.t1,marginTop:6}}>{score}/{sents.length} 正確</h2><button onClick={()=>{setQi(0);setInp("");setResult(null);setScore(0);setDone(false)}} style={{...S.btn,background:c.cl,color:"#fff",marginTop:16,marginRight:8,fontSize:12}}>再練</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:12}}>返回</button></div>);
  return(<div><Hdr t="聽寫訓練" onBack={onBack} cl={c.cl}/><PB v={qi} mx={sents.length} cl={c.cl}/>
    <div style={{...S.card,padding:"24px 18px",textAlign:"center"}}>
      <div style={{fontSize:12,color:S.t3,marginBottom:12}}>仔細聽，然後打出你聽到的英文句子</div>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16}}>
        <button onClick={()=>speak(current,"en-US",0.6)} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:12,padding:"8px 14px"}}>🐢 慢速</button>
        <button onClick={()=>speak(current,"en-US",0.85)} style={{...S.btn,background:c.cl,color:"#fff",fontSize:12,padding:"8px 14px"}}>🔊 正常</button>
        <button onClick={()=>speak(current,"en-US",1.1)} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:12,padding:"8px 14px"}}>🐇 快速</button>
      </div>
      <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(result===null?check():next())} placeholder="在這裡打出你聽到的..." disabled={result!==null} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`2px solid ${result===null?S.bd:result?"#639922":"#E24B4A"}`,fontSize:14,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none",textAlign:"center"}}/>
      {result===null?
        <button onClick={check} disabled={!inp.trim()} style={{...S.btn,background:c.cl,color:"#fff",marginTop:12,opacity:inp.trim()?1:.5}}>送出答案</button>:
        <div style={{marginTop:12}}>
          <div style={{fontSize:14,fontWeight:600,color:result?"#3B6D11":"#A32D2D"}}>{result?"✓ 正確！":"✗ 不太對"}</div>
          {!result&&<div style={{fontSize:13,color:S.t1,marginTop:6,padding:"8px 12px",background:"#EAF3DE",borderRadius:8}}>正確答案：{current}</div>}
          <button onClick={next} style={{...S.btn,background:c.cl,color:"#fff",marginTop:10,fontSize:12}}>下一題 →</button>
        </div>
      }
    </div>
  </div>);
}
// ═══ SENTENCE SCRAMBLE ═════════════════════════════════════════════
function ScramM({lv,onBack,onXp,onDone}){
  const data=SCRAM[lv];const c=LV[lv];
  const[qi,setQi]=useState(0);const[selected,setSelected]=useState([]);const[pool,setPool]=useState([]);const[result,setResult]=useState(null);const[score,setScore]=useState(0);const[done,setDone]=useState(false);
  useEffect(()=>{if(qi<data.length){const words=data[qi].s.split(" ");setPool(words.map((w,i)=>({w,id:i})).sort(()=>Math.random()-.5));setSelected([]);setResult(null)}},[qi]);
  const tapPool=(item)=>{if(result!==null)return;setPool(p=>p.filter(x=>x.id!==item.id));setSelected(s=>[...s,item])};
  const tapSel=(item)=>{if(result!==null)return;setSelected(s=>s.filter(x=>x.id!==item.id));setPool(p=>[...p,item])};
  const check=()=>{const ans=selected.map(x=>x.w).join(" ");const ok=ans.toLowerCase()===data[qi].s.toLowerCase();if(ok){setScore(s=>s+1);onXp(10)}setResult(ok)};
  const next=()=>{if(qi+1>=data.length){setDone(true);onDone()}else setQi(qi+1)};
  if(done)return(<div style={{textAlign:"center",padding:"36px 16px"}}><Hdr t="句子重組" onBack={onBack} cl={c.cl}/><div style={{fontSize:44}}>🧩</div><h2 style={{fontSize:17,fontWeight:700,color:S.t1,marginTop:6}}>{score}/{data.length} 正確</h2><button onClick={()=>{setQi(0);setScore(0);setDone(false)}} style={{...S.btn,background:c.cl,color:"#fff",marginTop:16,marginRight:8,fontSize:12}}>再練</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1,fontSize:12}}>返回</button></div>);
  return(<div><Hdr t="句子重組" onBack={onBack} cl={c.cl}/><PB v={qi} mx={data.length} cl={c.cl}/>
    <div style={{...S.card,padding:"22px 16px"}}>
      <div style={{fontSize:12,color:S.t3,marginBottom:4,textAlign:"center"}}>把單字排成正確的句子</div>
      <div style={{fontSize:13,color:c.cl,textAlign:"center",marginBottom:14,fontWeight:600}}>💡 {data[qi].h}</div>
      {/* Selected area */}
      <div style={{minHeight:48,padding:"10px 8px",background:result===null?S.bg2:result?"#EAF3DE":"#FCEBEB",borderRadius:12,display:"flex",flexWrap:"wrap",gap:6,marginBottom:12,border:`2px dashed ${result===null?S.bd:result?"#639922":"#E24B4A"}`,transition:"all .2s"}}>
        {selected.length===0&&<span style={{color:S.t3,fontSize:12}}>點擊下方單字拼出句子...</span>}
        {selected.map(item=>(<button key={item.id} onClick={()=>tapSel(item)} style={{padding:"6px 12px",borderRadius:8,background:c.cl,color:"#fff",border:"none",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{item.w}</button>))}
      </div>
      {/* Word pool */}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginBottom:14}}>
        {pool.map(item=>(<button key={item.id} onClick={()=>tapPool(item)} style={{padding:"6px 12px",borderRadius:8,background:S.bg2,color:S.t1,border:`1px solid ${S.bd}`,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{item.w}</button>))}
      </div>
      {result===null?
        <div style={{textAlign:"center"}}><button onClick={check} disabled={pool.length>0} style={{...S.btn,background:c.cl,color:"#fff",opacity:pool.length>0?.4:1,fontSize:12}}>檢查答案</button></div>:
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:600,color:result?"#3B6D11":"#A32D2D",marginBottom:4}}>{result?"✓ 正確！":"✗ 順序不對"}</div>
          {!result&&<div style={{fontSize:12,color:S.t1,padding:"6px 10px",background:"#EAF3DE",borderRadius:8,display:"inline-block"}}>{data[qi].s}</div>}
          <div><button onClick={next} style={{...S.btn,background:c.cl,color:"#fff",marginTop:8,fontSize:12}}>下一題 →</button></div>
        </div>
      }
    </div>
  </div>);
}
// ═══ GRAMMAR ════════════════════════════════════════════════════════
function GrammarM({lv,onBack}){
  const rules=G[lv];const[sel,setSel]=useState(null);const[ans,setAns]=useState(null);const c=LV[lv];
  if(sel===null)return(<div><Hdr t="文法學堂" onBack={onBack} cl={c.cl}/>{rules.map((r,i)=>(<div key={i} onClick={()=>{setSel(i);setAns(null)}} style={{cursor:"pointer",...S.card,padding:"14px",marginBottom:7}} onMouseEnter={e=>e.currentTarget.style.borderColor=c.ac} onMouseLeave={e=>e.currentTarget.style.borderColor=S.bd}><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:10,color:"#fff",background:c.cl,borderRadius:10,padding:"2px 7px",fontWeight:600}}>{i+1}</span><div><div style={{fontWeight:600,fontSize:13,color:S.t1}}>{r.t}</div><div style={{fontSize:11,color:S.t2}}>{r.d}</div></div></div></div>))}</div>);
  const r=rules[sel];
  return(<div><Hdr t="文法學堂" onBack={onBack} cl={c.cl}/><button onClick={()=>setSel(null)} style={{background:"none",border:"none",fontSize:11,color:c.cl,cursor:"pointer",marginBottom:8}}>← 列表</button><div style={{...S.card,padding:"20px 16px"}}><h3 style={{fontSize:16,fontWeight:700,color:S.t1,margin:"0 0 6px"}}>{r.t}</h3><div style={{fontSize:11,color:S.t2,padding:"4px 8px",background:c.bg,borderRadius:6,marginBottom:10}}>{r.d}</div><div style={{fontSize:12,fontStyle:"italic",color:S.t1,padding:"6px 10px",background:S.bg2,borderRadius:8,marginBottom:14}}>"{r.ex}" <button onClick={()=>speak(r.ex)} style={{background:"none",border:"none",fontSize:12,cursor:"pointer"}}>🔊</button></div><div style={{borderTop:`1px solid ${S.bd}`,paddingTop:12}}><div style={{fontWeight:600,fontSize:12,color:S.t1,marginBottom:6}}>小測驗</div><div style={{fontSize:12,color:S.t1,marginBottom:8}}>{r.q.s}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>{r.q.o.map((o,i)=>{const ok=i===r.q.a,pk=ans===i;let bg=S.bg2,bd=`1px solid ${S.bd}`;if(ans!==null){if(ok){bg="#EAF3DE";bd="2px solid #639922"}else if(pk){bg="#FCEBEB";bd="2px solid #E24B4A"}}return<button key={i} onClick={()=>setAns(i)} style={{padding:"8px",borderRadius:8,background:bg,border:bd,cursor:ans!==null?"default":"pointer",fontSize:11,fontFamily:"inherit",color:S.t1}}>{o}</button>})}</div>{ans!==null&&<div style={{marginTop:6,fontSize:11,fontWeight:600,color:ans===r.q.a?"#3B6D11":"#A32D2D"}}>{ans===r.q.a?"✓ 正確！":`✗ 答案：${r.q.o[r.q.a]}`}</div>}</div></div><div style={{display:"flex",justifyContent:"space-between",marginTop:10}}><button onClick={()=>{setSel(Math.max(0,sel-1));setAns(null)}} disabled={sel===0} style={{...S.btn,background:S.bg2,color:S.t1,opacity:sel===0?.4:1,fontSize:11,padding:"6px 14px"}}>←上一題</button><button onClick={()=>{setSel(Math.min(rules.length-1,sel+1));setAns(null)}} disabled={sel===rules.length-1} style={{...S.btn,background:c.cl,color:"#fff",opacity:sel===rules.length-1?.4:1,fontSize:11,padding:"6px 14px"}}>下一題→</button></div></div>);
}
// ═══ READING ════════════════════════════════════════════════════════
function ReadingM({lv,onBack}){
  const articles=R[lv];const[ai,setAi]=useState(0);const[ans,setAns]=useState({});const c=LV[lv];const d=articles[ai];
  return(<div><Hdr t="閱讀理解" onBack={onBack} cl={c.cl}/><div style={{display:"flex",gap:5,marginBottom:10,overflowX:"auto"}}>{articles.map((a,i)=>(<button key={i} onClick={()=>{setAi(i);setAns({})}} style={{flexShrink:0,padding:"5px 12px",borderRadius:8,background:i===ai?c.cl:S.bg2,color:i===ai?"#fff":S.t1,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{a.t}</button>))}</div>
    <div style={{...S.card,padding:"18px 16px",marginBottom:12}}><h3 style={{fontSize:15,fontWeight:700,color:S.t1,marginBottom:8}}>{d.t}</h3><div style={{fontSize:12,lineHeight:1.9,color:S.t1,padding:"10px 12px",background:S.bg2,borderRadius:10,borderLeft:`3px solid ${c.ac}`}}>{d.tx}</div><button onClick={()=>speak(d.tx)} style={{marginTop:5,background:"none",border:"none",fontSize:10,color:c.cl,cursor:"pointer"}}>🔊 朗讀</button></div>
    {d.qs.map((q,qi)=>(<div key={qi} style={{...S.card,padding:"12px",marginBottom:7}}><div style={{fontWeight:600,fontSize:11,color:S.t1,marginBottom:5}}>Q{qi+1}. {q.q}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>{q.o.map((o,oi)=>{const dn=ans[qi]!==undefined,ok=oi===q.a,pk=ans[qi]===oi;let bg=S.bg2,bd=`1px solid ${S.bd}`;if(dn){if(ok){bg="#EAF3DE";bd="2px solid #639922"}else if(pk){bg="#FCEBEB";bd="2px solid #E24B4A"}}return<button key={oi} onClick={()=>{if(!dn)setAns(a=>({...a,[qi]:oi}))}} style={{padding:"6px 4px",borderRadius:6,background:bg,border:bd,cursor:dn?"default":"pointer",fontSize:10,fontFamily:"inherit",color:S.t1,textAlign:"left"}}>{o}</button>})}</div></div>))}
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
    <Hdr t="AI 英語家教" onBack={onBack} cl={c.cl} extra={<div style={{display:"flex",gap:3}}><button onClick={()=>setRi(r=>(r+1)%3)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"2px 6px",fontSize:10,cursor:"pointer",color:S.t2}}>{RATES[ri].i}{RATES[ri].l}</button><button onClick={()=>setShowKey(!showKey)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"2px 6px",fontSize:10,cursor:"pointer",color:S.t2}}>{apiKey?"🔑":"⚙️"}</button></div>}/>
    {showKey&&<div style={{...S.card,padding:"12px 14px",marginBottom:8,fontSize:11}}><div style={{fontWeight:600,color:S.t1,marginBottom:4}}>Gemini API Key</div><div style={{color:S.t2,marginBottom:6,lineHeight:1.5}}>1. <b>aistudio.google.com</b> 登入<br/>2. Get API key → 建立<br/>3. 貼到下方（免費）</div><div style={{display:"flex",gap:5}}><input value={keyInp} onChange={e=>setKeyInp(e.target.value)} placeholder="API Key..." type="password" style={{flex:1,padding:"6px 8px",borderRadius:6,border:`1px solid ${S.bd}`,fontSize:11,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none"}}/><button onClick={()=>{onSetKey(keyInp);setShowKey(false)}} style={{...S.btn,background:c.cl,color:"#fff",padding:"6px 12px",fontSize:11}}>存</button></div></div>}
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:7,padding:"2px 0"}}>
      {msgs.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:m.role==="u"?"flex-end":"flex-start",gap:3,alignItems:"flex-end"}}><div style={{maxWidth:"82%",padding:"9px 12px",borderRadius:14,background:m.role==="u"?c.cl:S.bg1,color:m.role==="u"?"#fff":S.t1,border:m.role==="u"?"none":`1px solid ${S.bd}`,fontSize:12,lineHeight:1.7}}>{m.role==="u"?m.content:<Md text={m.content} color={c.cl}/>}</div>{m.role==="a"&&i>0&&<button onClick={()=>doSpeak(m.content,i)} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",padding:"1px",flexShrink:0,opacity:pi===i?1:.4}}>{pi===i?"⏹":"🔊"}</button>}</div>))}
      {busy&&<div style={{padding:"8px 12px",borderRadius:14,background:S.bg1,border:`1px solid ${S.bd}`,fontSize:11,color:S.t3,alignSelf:"flex-start"}}><span style={{animation:"pulse 1.2s ease-in-out infinite"}}>思考中...</span><style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style></div>}
      <div ref={btm}/>
    </div>
    <div style={{flexShrink:0,padding:"3px 0 0"}}><div style={{display:"flex",gap:3,marginBottom:3}}>{pgs.map((g,i)=>(<button key={i} onClick={()=>setPt(i)} style={{padding:"2px 8px",borderRadius:8,background:pt===i?c.cl:S.bg2,color:pt===i?"#fff":S.t2,border:"none",fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{g.l}</button>))}</div><div style={{display:"flex",gap:3,overflowX:"auto",paddingBottom:3}}>{pgs[pt].items.map((p,i)=>(<button key={i} onClick={()=>send(p)} style={{flexShrink:0,padding:"3px 8px",borderRadius:12,background:S.bg2,border:`1px solid ${S.bd}`,fontSize:9,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>{p}</button>))}</div></div>
    <div style={{display:"flex",gap:5,padding:"3px 0 1px",flexShrink:0}}><input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={apiKey?"輸入訊息...":"設定 API Key ↑"} style={{flex:1,padding:"8px 10px",borderRadius:10,border:`1px solid ${S.bd}`,fontSize:12,outline:"none",fontFamily:"inherit",background:S.bg1,color:S.t1}}/><button onClick={()=>send()} disabled={busy||!inp.trim()} style={{...S.btn,background:c.cl,color:"#fff",padding:"8px 12px",opacity:(busy||!inp.trim())?0.5:1,fontSize:12}}>發送</button></div>
  </div>);
}
// ═══ ACHIEVEMENTS PAGE ══════════════════════════════════════════════
function AchPage({onBack,unlocked,c}){
  return(<div><Hdr t="成就徽章" onBack={onBack} cl={c.cl}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
      {ACH_DEFS.map(a=>{const ok=unlocked.includes(a.id);return(
        <div key={a.id} style={{...S.card,padding:"18px 12px",textAlign:"center",opacity:ok?1:.4,transition:"all .2s"}}>
          <div style={{fontSize:36,marginBottom:6,filter:ok?"none":"grayscale(1)"}}>{a.icon}</div>
          <div style={{fontWeight:600,fontSize:13,color:ok?S.t1:S.t3}}>{a.name}</div>
          <div style={{fontSize:10,color:S.t2,marginTop:2}}>{a.desc}</div>
          {ok&&<div style={{fontSize:9,color:c.cl,marginTop:4,fontWeight:600}}>已解鎖 ✓</div>}
        </div>
      )})}
    </div>
  </div>);
}
// ═══ SHARED ════════════════════════════════════════════════════════
function Hdr({t,onBack,cl,extra}){return(<div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}><button onClick={onBack} style={{background:"none",border:"none",fontSize:11,color:cl,cursor:"pointer",fontWeight:600,fontFamily:"inherit"}}>← 返回</button><h2 style={{fontSize:15,fontWeight:700,color:S.t1,margin:0,flex:1}}>{t}</h2>{extra}</div>)}
function PB({v,mx,cl}){return(<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,fontSize:10}}><div style={{flex:1,height:4,background:S.bg2,borderRadius:2}}><div style={{height:"100%",width:`${(v/mx)*100}%`,background:cl,borderRadius:2,transition:"width .3s"}}/></div><span style={{color:S.t3}}>{v+1}/{mx}</span></div>)}
