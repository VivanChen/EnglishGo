import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ═══ VOCAB DATA ══════════════════════════════════════════════════════
const VOCAB = {
  elementary: [
    { word:"apple",phonetic:"/ˈæp.əl/",pos:"n.",meaning:"蘋果",forms:[{w:"apples",p:"n.",n:"複數"}],col:["an apple a day 一天一蘋果","apple juice 蘋果汁"],ex:"I eat an apple every day.",exZh:"我每天吃一顆蘋果。",img:"🍎"},
    { word:"happy",phonetic:"/ˈhæp.i/",pos:"adj.",meaning:"開心的",forms:[{w:"happiness",p:"n.",n:"快樂"},{w:"happily",p:"adv.",n:"開心地"}],col:["happy birthday 生日快樂","feel happy 感到開心"],ex:"She feels very happy today.",exZh:"她今天很開心。",img:"😊"},
    { word:"school",phonetic:"/skuːl/",pos:"n.",meaning:"學校",forms:[],col:["go to school 去上學","after school 放學後"],ex:"I go to school every morning.",exZh:"我每天早上去上學。",img:"🏫"},
    { word:"water",phonetic:"/ˈwɔː.tər/",pos:"n.",meaning:"水",forms:[{w:"watery",p:"adj.",n:"水汪汪的"}],col:["drink water 喝水","hot water 熱水"],ex:"Please drink more water.",exZh:"請多喝水。",img:"💧"},
    { word:"friend",phonetic:"/frend/",pos:"n.",meaning:"朋友",forms:[{w:"friendly",p:"adj.",n:"友善的"},{w:"friendship",p:"n.",n:"友誼"}],col:["best friend 最好的朋友","make friends 交朋友"],ex:"She is my best friend.",exZh:"她是我最好的朋友。",img:"🤝"},
    { word:"run",phonetic:"/rʌn/",pos:"v.",meaning:"跑",forms:[{w:"runner",p:"n.",n:"跑者"},{w:"running",p:"n.",n:"跑步"}],col:["run fast 跑得快","run away 逃跑"],ex:"I like to run in the park.",exZh:"我喜歡在公園跑步。",img:"🏃"},
    { word:"book",phonetic:"/bʊk/",pos:"n.",meaning:"書",forms:[{w:"bookstore",p:"n.",n:"書店"}],col:["read a book 讀書","picture book 繪本"],ex:"I read a book before bed.",exZh:"我睡前讀一本書。",img:"📖"},
    { word:"eat",phonetic:"/iːt/",pos:"v.",meaning:"吃",forms:[{w:"ate",p:"v.",n:"過去式"},{w:"eaten",p:"v.",n:"過去分詞"}],col:["eat breakfast 吃早餐","eat out 外食"],ex:"We eat lunch at noon.",exZh:"我們中午吃午餐。",img:"🍽️"},
    { word:"big",phonetic:"/bɪɡ/",pos:"adj.",meaning:"大的",forms:[{w:"bigger",p:"adj.",n:"更大的"},{w:"biggest",p:"adj.",n:"最大的"}],col:["big city 大城市","big deal 大事"],ex:"The elephant is very big.",exZh:"那隻大象非常大。",img:"🐘"},
    { word:"play",phonetic:"/pleɪ/",pos:"v.",meaning:"玩；播放",forms:[{w:"player",p:"n.",n:"玩家"},{w:"playful",p:"adj.",n:"好玩的"}],col:["play games 玩遊戲","play music 播放音樂"],ex:"The children play in the park.",exZh:"孩子們在公園裡玩。",img:"⚽"},
  ],
  junior: [
    { word:"accomplish",phonetic:"/əˈkɑːm.plɪʃ/",pos:"v.",meaning:"完成；達成",forms:[{w:"accomplishment",p:"n.",n:"成就"}],col:["accomplish a goal 達成目標"],ex:"She accomplished her goal of reading 50 books.",exZh:"她達成了閱讀50本書的目標。"},
    { word:"environment",phonetic:"/ɪnˈvaɪ.rən.mənt/",pos:"n.",meaning:"環境",forms:[{w:"environmental",p:"adj.",n:"環境的"}],col:["protect the environment 保護環境"],ex:"We should protect the environment.",exZh:"我們應該保護環境。"},
    { word:"experience",phonetic:"/ɪkˈspɪr.i.əns/",pos:"n./v.",meaning:"經驗；經歷",forms:[{w:"experienced",p:"adj.",n:"有經驗的"}],col:["work experience 工作經驗"],ex:"Traveling is a great experience.",exZh:"旅行是很棒的經歷。"},
    { word:"communicate",phonetic:"/kəˈmjuː.nɪ.keɪt/",pos:"v.",meaning:"溝通",forms:[{w:"communication",p:"n.",n:"溝通"}],col:["communicate with 與…溝通"],ex:"It's important to communicate clearly.",exZh:"清楚溝通很重要。"},
    { word:"opportunity",phonetic:"/ˌɑː.pərˈtuː.nə.ti/",pos:"n.",meaning:"機會",forms:[],col:["job opportunity 工作機會","golden opportunity 黃金機會"],ex:"Don't miss this great opportunity.",exZh:"別錯過這個好機會。"},
    { word:"responsible",phonetic:"/rɪˈspɑːn.sə.bəl/",pos:"adj.",meaning:"負責任的",forms:[{w:"responsibility",p:"n.",n:"責任"}],col:["be responsible for 對…負責"],ex:"He is a responsible student.",exZh:"他是負責任的學生。"},
    { word:"influence",phonetic:"/ˈɪn.flu.əns/",pos:"n./v.",meaning:"影響",forms:[{w:"influential",p:"adj.",n:"有影響力的"}],col:["have influence on 對…有影響"],ex:"Music has a great influence on people.",exZh:"音樂對人有很大的影響。"},
    { word:"suggest",phonetic:"/səˈdʒest/",pos:"v.",meaning:"建議",forms:[{w:"suggestion",p:"n.",n:"建議"}],col:["suggest that 建議…"],ex:"I suggest that you study harder.",exZh:"我建議你更用功。"},
    { word:"participate",phonetic:"/pɑːrˈtɪs.ɪ.peɪt/",pos:"v.",meaning:"參與",forms:[{w:"participation",p:"n.",n:"參與"},{w:"participant",p:"n.",n:"參與者"}],col:["participate in 參加"],ex:"Students participate in various activities.",exZh:"學生們參與各種活動。"},
    { word:"improve",phonetic:"/ɪmˈpruːv/",pos:"v.",meaning:"改善；進步",forms:[{w:"improvement",p:"n.",n:"改善"}],col:["improve skills 提升技能"],ex:"Practice can improve your English.",exZh:"練習可以提升英文。"},
  ],
  senior: [
    { word:"comprehensive",phonetic:"/ˌkɑːm.prɪˈhen.sɪv/",pos:"adj.",meaning:"全面的",forms:[{w:"comprehension",p:"n.",n:"理解力"}],col:["comprehensive analysis 全面分析"],ex:"The report provides a comprehensive analysis.",exZh:"報告提供了全面分析。"},
    { word:"controversial",phonetic:"/ˌkɑːn.trəˈvɝː.ʃəl/",pos:"adj.",meaning:"有爭議的",forms:[{w:"controversy",p:"n.",n:"爭議"}],col:["controversial topic 爭議話題"],ex:"The policy is highly controversial.",exZh:"這項政策極具爭議。"},
    { word:"phenomenon",phonetic:"/fɪˈnɑː.mə.nɑːn/",pos:"n.",meaning:"現象",forms:[{w:"phenomena",p:"n.",n:"複數"},{w:"phenomenal",p:"adj.",n:"非凡的"}],col:["natural phenomenon 自然現象"],ex:"Climate change is a global phenomenon.",exZh:"氣候變遷是全球性現象。"},
    { word:"sophisticated",phonetic:"/səˈfɪs.tɪ.keɪ.tɪd/",pos:"adj.",meaning:"精密的；老練的",forms:[{w:"sophistication",p:"n.",n:"精密"}],col:["sophisticated technology 精密科技"],ex:"The system uses sophisticated technology.",exZh:"系統使用精密科技。"},
    { word:"alleviate",phonetic:"/əˈliː.vi.eɪt/",pos:"v.",meaning:"減輕；緩和",forms:[{w:"alleviation",p:"n.",n:"減輕"}],col:["alleviate pain 減輕疼痛"],ex:"This medicine can alleviate the pain.",exZh:"這種藥可以減輕疼痛。"},
    { word:"unprecedented",phonetic:"/ʌnˈpres.ə.den.tɪd/",pos:"adj.",meaning:"史無前例的",forms:[{w:"precedent",p:"n.",n:"先例"}],col:["unprecedented challenge 史無前例的挑戰"],ex:"The pandemic caused unprecedented challenges.",exZh:"疫情造成史無前例的挑戰。"},
    { word:"deteriorate",phonetic:"/dɪˈtɪr.i.ə.reɪt/",pos:"v.",meaning:"惡化",forms:[{w:"deterioration",p:"n.",n:"惡化"}],col:["health deteriorates 健康惡化"],ex:"His health began to deteriorate.",exZh:"他的健康開始惡化。"},
    { word:"sustainable",phonetic:"/səˈsteɪ.nə.bəl/",pos:"adj.",meaning:"可持續的",forms:[{w:"sustainability",p:"n.",n:"可持續性"},{w:"sustain",p:"v.",n:"維持"}],col:["sustainable development 永續發展"],ex:"We need sustainable energy solutions.",exZh:"我們需要可持續能源方案。"},
    { word:"ambiguous",phonetic:"/æmˈbɪɡ.ju.əs/",pos:"adj.",meaning:"模稜兩可的",forms:[{w:"ambiguity",p:"n.",n:"模糊性"}],col:["ambiguous meaning 模糊的意思"],ex:"The instructions were ambiguous.",exZh:"這些指示很模糊。"},
    { word:"facilitate",phonetic:"/fəˈsɪl.ɪ.teɪt/",pos:"v.",meaning:"促進",forms:[{w:"facilitation",p:"n.",n:"促進"},{w:"facilitator",p:"n.",n:"引導者"}],col:["facilitate learning 促進學習"],ex:"Technology can facilitate learning.",exZh:"科技可以促進學習。"},
  ],
};

// ═══ GRAMMAR DATA (6 per level) ═════════════════════════════════════
const GRAMMAR = {
  elementary: [
    {t:"Be 動詞",d:"I am / You are / He is",ex:"I am a student. She is happy.",q:{s:"She ___ a teacher.",o:["am","is","are","be"],a:1}},
    {t:"現在簡單式",d:"表示習慣與事實，第三人稱加 s/es",ex:"He goes to school every day.",q:{s:"She ___ breakfast at 7.",o:["eat","eats","eating","ate"],a:1}},
    {t:"現在進行式",d:"be + V-ing，表示正在做",ex:"I am reading a book now.",q:{s:"They ___ TV now.",o:["watch","watches","are watching","watched"],a:2}},
    {t:"There is / There are",d:"表示「有…」的存在句型",ex:"There are two cats on the sofa.",q:{s:"There ___ a dog in the yard.",o:["is","are","has","have"],a:0}},
    {t:"名詞單複數",d:"大部分加 s，特殊變化要記",ex:"one child → two children",q:{s:"I have three ___.",o:["box","boxs","boxes","boxies"],a:2}},
    {t:"代名詞（主格/受格）",d:"I/me, he/him, she/her, they/them",ex:"She likes him. He likes her.",q:{s:"Please give ___ the book.",o:["I","my","me","mine"],a:2}},
  ],
  junior: [
    {t:"現在完成式",d:"have/has + p.p.，表示經驗或持續",ex:"I have lived here for 5 years.",q:{s:"She ___ to Japan twice.",o:["has been","have been","was","went"],a:0}},
    {t:"被動語態",d:"be + p.p.，主詞是動作接受者",ex:"The window was broken by the boy.",q:{s:"The cake ___ by my mom.",o:["baked","was baked","is baking","bake"],a:1}},
    {t:"關係代名詞",d:"who/which/that 連接形容詞子句",ex:"The man who lives next door is a doctor.",q:{s:"The book ___ I read was great.",o:["who","which","what","where"],a:1}},
    {t:"不定詞 vs 動名詞",d:"to V / V-ing 當受詞的差異",ex:"I enjoy reading. I want to go.",q:{s:"She enjoys ___.",o:["swim","to swim","swimming","swam"],a:2}},
    {t:"連接詞 (because/although/if)",d:"連接兩個子句表示原因、讓步、條件",ex:"Although it rained, we went out.",q:{s:"___ he was tired, he kept working.",o:["Because","Although","If","So"],a:1}},
    {t:"比較級與最高級",d:"-er/-est 或 more/most + adj.",ex:"She is taller than her brother.",q:{s:"This is the ___ movie I've ever seen.",o:["good","better","best","most good"],a:2}},
  ],
  senior: [
    {t:"假設語氣（與現在事實相反）",d:"If + 過去式, S + would + V",ex:"If I were you, I would study harder.",q:{s:"If I ___ rich, I would travel.",o:["am","was","were","be"],a:2}},
    {t:"假設語氣（與過去事實相反）",d:"If + had p.p., S + would have p.p.",ex:"If I had studied, I would have passed.",q:{s:"If she ___ earlier, she wouldn't have missed it.",o:["comes","came","had come","has come"],a:2}},
    {t:"分詞構句",d:"V-ing / p.p. 開頭，簡化副詞子句",ex:"Walking along the street, I met a friend.",q:{s:"___ the letter, she cried.",o:["Reading","Read","To read","Reads"],a:0}},
    {t:"倒裝句",d:"否定副詞放句首，主詞動詞倒裝",ex:"Never have I seen such beauty.",q:{s:"Not only ___ hard, but he helped others.",o:["he worked","did he work","he did work","does he works"],a:1}},
    {t:"名詞子句 (that / whether / wh-)",d:"子句當主詞或受詞",ex:"What he said surprised everyone.",q:{s:"I don't know ___ she will come.",o:["that","whether","what","which"],a:1}},
    {t:"強調句型 It is...that",d:"It is/was + 強調部分 + that + 其餘",ex:"It was John that broke the window.",q:{s:"It was ___ that I met her.",o:["in Tokyo","Tokyo","at Tokyo is","Tokyo where"],a:0}},
  ],
};

// ═══ READING DATA (3 per level) ═════════════════════════════════════
const READING = {
  elementary: [
    {t:"My Pet Cat",tx:"I have a pet cat. Her name is Mimi. She is white and fluffy. Mimi likes to sleep on the sofa. She also likes to play with a ball. Every morning, I give her milk. Mimi is my best friend.",
     qs:[{q:"What is the cat's name?",o:["Nini","Mimi","Kiki","Lili"],a:1},{q:"What does Mimi like to do?",o:["Swim","Fly","Sleep on the sofa","Cook"],a:2}]},
    {t:"A Rainy Day",tx:"Today is a rainy day. I cannot go to the park. I stay at home and draw pictures. My mom makes hot chocolate for me. I draw a rainbow. My sister wants to play a card game. We play together and have a lot of fun.",
     qs:[{q:"Why can't the child go to the park?",o:["It's too hot","It's raining","The park is closed","Mom said no"],a:1},{q:"What does the child draw?",o:["A cat","A house","A rainbow","A car"],a:2}]},
    {t:"My Family",tx:"There are five people in my family. My father is a doctor. My mother is a teacher. I have one brother and one sister. My brother is older than me. My sister is the youngest. We live in a big house near the school. I love my family very much.",
     qs:[{q:"How many people are in the family?",o:["Three","Four","Five","Six"],a:2},{q:"What does the father do?",o:["Teacher","Doctor","Driver","Cook"],a:1}]},
  ],
  junior: [
    {t:"The Power of Reading",tx:"Reading is one of the most important skills a student can develop. When you read regularly, you not only improve your vocabulary but also strengthen your ability to think critically. Studies show that students who read for pleasure perform better in school. Whether it's a novel, a magazine, or even a comic book, every page you read helps your brain grow.",
     qs:[{q:"Reading helps improve what?",o:["Drawing","Vocabulary & thinking","Fitness","Cooking"],a:1},{q:"Who performs better in school?",o:["Students who exercise","Students who read for fun","Students who sleep more","Students who watch TV"],a:1}]},
    {t:"Social Media and Teens",tx:"Social media has become a big part of teenagers' lives. Many students spend more than three hours a day on platforms like Instagram and YouTube. While social media can help people stay connected, too much screen time may lead to sleep problems and difficulty concentrating. Experts suggest setting a daily time limit and taking breaks from screens.",
     qs:[{q:"How much time do many students spend on social media?",o:["30 minutes","1 hour","More than 3 hours","5 hours"],a:2},{q:"What do experts suggest?",o:["Use more social media","Delete all apps","Set a daily time limit","Only use computers"],a:2}]},
    {t:"The History of Bubble Tea",tx:"Bubble tea was invented in Taiwan in the 1980s. A teahouse owner had the idea of adding tapioca balls to iced tea. The drink quickly became popular across Taiwan and then spread to other countries in Asia. Today, bubble tea shops can be found all over the world. The drink comes in many flavors, from classic milk tea to fruit tea with various toppings.",
     qs:[{q:"Where was bubble tea invented?",o:["Japan","Korea","Taiwan","China"],a:2},{q:"When was bubble tea invented?",o:["1960s","1970s","1980s","1990s"],a:2}]},
  ],
  senior: [
    {t:"The Ethics of AI",tx:"As artificial intelligence becomes increasingly integrated into daily life, ethical questions arise that society must address. One significant concern is algorithmic bias — when AI systems perpetuate existing prejudices found in their training data. For instance, facial recognition technology has been shown to have higher error rates for certain demographics. Furthermore, the displacement of workers by automated systems presents an unprecedented economic challenge requiring thoughtful policy responses.",
     qs:[{q:"What is 'algorithmic bias'?",o:["A virus","AI perpetuating prejudices","A language","A product"],a:1},{q:"What challenge does automation present?",o:["Pollution","Worker displacement","Privacy","Energy"],a:1}]},
    {t:"The Psychology of Procrastination",tx:"Procrastination is not simply a matter of laziness or poor time management. Research in psychology suggests it is fundamentally an emotional regulation problem. When faced with tasks that trigger negative emotions — anxiety, boredom, or frustration — the brain seeks immediate relief through avoidance. Ironically, this short-term emotional relief leads to greater stress as deadlines approach. Cognitive behavioral strategies, such as breaking tasks into smaller steps and addressing the underlying emotional triggers, have proven effective in overcoming chronic procrastination.",
     qs:[{q:"According to the passage, procrastination is primarily what?",o:["A time management issue","A sign of laziness","An emotional regulation problem","A genetic condition"],a:2},{q:"What strategy helps overcome procrastination?",o:["Working longer hours","Ignoring deadlines","Breaking tasks into smaller steps","Sleeping more"],a:2}]},
    {t:"The Future of Renewable Energy",tx:"The transition to renewable energy sources represents one of the most consequential shifts in modern industrial history. Solar and wind power have experienced dramatic cost reductions over the past decade, making them increasingly competitive with fossil fuels. However, the intermittent nature of these sources presents significant challenges for grid stability. Energy storage technologies, particularly advanced battery systems, are crucial for addressing this limitation. Nations that invest strategically in renewable infrastructure today are positioning themselves for both environmental sustainability and long-term economic competitiveness.",
     qs:[{q:"What has happened to the cost of solar and wind power?",o:["Increased dramatically","Stayed the same","Decreased dramatically","Become unpredictable"],a:2},{q:"What is described as crucial for renewable energy?",o:["More fossil fuels","Energy storage technologies","Reducing electricity use","Building more power plants"],a:1}]},
  ],
};

// ═══ CONFIG ══════════════════════════════════════════════════════════
const LV = {
  elementary:{label:"小學",en:"Elementary",color:"#0F6E56",bg:"#E1F5EE",accent:"#1D9E75",icon:"🌱",words:"300 基礎單字"},
  junior:{label:"國中",en:"Junior High",color:"#534AB7",bg:"#EEEDFE",accent:"#7F77DD",icon:"📚",words:"1200 常用字"},
  senior:{label:"高中",en:"Senior High",color:"#993C1D",bg:"#FAECE7",accent:"#D85A30",icon:"🎓",words:"4500+ 進階字"},
};

function speak(t,l="en-US",r=0.85){if(!window.speechSynthesis)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang=l;u.rate=r;window.speechSynthesis.speak(u)}
function createDeck(c){return{queue:c.map((_,i)=>i),rm:[],stats:{again:0,hard:0,good:0,easy:0},total:c.length}}
function rateDeck(d,a){const n={...d,queue:[...d.queue],rm:[...d.rm],stats:{...d.stats}};const c=n.queue.shift();if(c===undefined)return n;n.stats[a]++;if(a==="again")n.queue.splice(Math.min(1,n.queue.length),0,c);else if(a==="hard")n.queue.splice(Math.floor(n.queue.length/2),0,c);else if(a==="good")n.queue.push(c);else n.rm.push(c);return n}
function parseCSV(t){return t.trim().split("\n").slice(1).map(l=>{const m=l.match(/^"?([^",]+)"?\s*,\s*"?([\s\S]*?)"?\s*$/);if(!m)return null;const w=m[1].trim(),b=m[2].trim(),p=b.match(/\(([a-z.\/]+)\)\s*(.+?)(?:\n|$)/),e=b.match(/[「【]例句[」】]\s*\n?(.+?)(?:\(|（)/);return{word:w,phonetic:"",pos:p?.[1]||"",meaning:p?.[2]?.trim()||b.split("\n")[0],forms:[],col:[],ex:e?.[1]?.trim()||"",exZh:""}}).filter(Boolean)}
const imgC={};function preImg(ws,s=0,n=3){for(let i=s;i<Math.min(s+n,ws.length);i++){const w=ws[i]?.word;if(w&&!imgC[w]){const img=new Image();img.src=`https://loremflickr.com/300/150/${encodeURIComponent(w)}?lock=${i}`;imgC[w]=img.src}}}

const S={btn:{padding:"10px 20px",borderRadius:12,border:"none",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"},
  card:{background:"var(--color-background-primary,#fff)",borderRadius:16,border:"1px solid var(--color-border-tertiary,#e0dfd9)"},
  t1:"var(--color-text-primary,#2c2c2a)",t2:"var(--color-text-secondary,#73726c)",t3:"var(--color-text-tertiary,#9c9a92)",
  bg1:"var(--color-background-primary,#fff)",bg2:"var(--color-background-secondary,#f3f2ee)",bg3:"var(--color-background-tertiary,#f8f7f4)",
  bd:"var(--color-border-tertiary,#e0dfd9)"};

// ═══ MAIN APP ═══════════════════════════════════════════════════════
export default function App(){
  const[lv,setLv]=useState(null),[mod,setMod]=useState(null),[xp,setXp]=useState(120),[streak]=useState(3),[daily,setDaily]=useState({target:10,done:4});
  const[geminiKey,setGeminiKey]=useState(()=>{try{return window.sessionStorage?.getItem?.("gemini_key")||""}catch{return""}});
  const addXp=(n=5)=>{setXp(x=>x+n);setDaily(d=>({...d,done:Math.min(d.done+1,d.target)}))};
  const saveKey=(k)=>{setGeminiKey(k);try{window.sessionStorage?.setItem?.("gemini_key",k)}catch{}};

  if(!lv)return <Landing onSelect={setLv}/>;
  const c=LV[lv],back=()=>setMod(null);

  return(
    <div style={{minHeight:"100vh",background:S.bg3,fontFamily:"'Noto Sans TC','Segoe UI',sans-serif"}}>
      <nav style={{background:S.bg1,borderBottom:`1px solid ${S.bd}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:100}}>
        <button onClick={()=>{setLv(null);setMod(null)}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer"}}>←</button>
        <span style={{fontSize:18}}>{c.icon}</span>
        <span style={{fontWeight:600,color:c.color,fontSize:14,flex:1}}>{c.label} {c.en}</span>
        <span style={{fontSize:11,color:S.t3}}>🔥{streak}</span>
        <span style={{fontSize:11,color:S.t3}}>⭐{xp}</span>
        <span style={{fontSize:11,color:S.t3}}>📊{daily.done}/{daily.target}</span>
      </nav>
      <div style={{maxWidth:760,margin:"0 auto",padding:"16px 14px"}}>
        {!mod?<Menu lv={lv} onSelect={setMod} daily={daily}/>:
         mod==="srs"?<SRS lv={lv} onBack={back} onXp={addXp}/>:
         mod==="quiz"?<QuizMod lv={lv} onBack={back} onXp={addXp}/>:
         mod==="grammar"?<GrammarMod lv={lv} onBack={back}/>:
         mod==="reading"?<ReadingMod lv={lv} onBack={back}/>:
         mod==="ai"?<AITutor lv={lv} onBack={back} apiKey={geminiKey} onSetKey={saveKey}/>:null}
      </div>
    </div>
  );
}

// ═══ LANDING ═════════════════════════════════════════════════════════
function Landing({onSelect}){
  const[hov,setHov]=useState(null);
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(150deg,#091825,#122a45 45%,#183a58 75%,#0d1f32)",color:"#fff",fontFamily:"'Noto Sans TC','Segoe UI',sans-serif"}}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}@keyframes float{0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-30px);opacity:.7}}`}</style>
      <div style={{position:"fixed",inset:0,pointerEvents:"none"}}>{[...Array(12)].map((_,i)=><div key={i} style={{position:"absolute",width:3+Math.random()*5,height:3+Math.random()*5,borderRadius:"50%",background:`rgba(255,255,255,${.03+Math.random()*.05})`,left:`${Math.random()*100}%`,top:`${Math.random()*100}%`,animation:`float ${8+Math.random()*10}s ease-in-out infinite ${Math.random()*5}s`}}/>)}</div>
      <div style={{position:"relative",zIndex:1,maxWidth:860,margin:"0 auto",padding:"52px 20px 36px",textAlign:"center"}}>
        <div style={{animation:"fadeUp .7s ease-out",display:"inline-flex",alignItems:"center",gap:10,background:"rgba(255,255,255,.06)",borderRadius:36,padding:"8px 22px",border:"1px solid rgba(255,255,255,.1)"}}>
          <span style={{fontSize:28}}>📘</span><span style={{fontSize:24,fontWeight:700,letterSpacing:1.5}}>EnglishGo</span>
        </div>
        <p style={{animation:"fadeUp .7s ease-out .15s both",color:"rgba(255,255,255,.5)",fontSize:13,marginTop:12}}>專為台灣學生設計 · AI 驅動英語學習平台</p>
        <h1 style={{animation:"fadeUp .7s ease-out .3s both",fontSize:"clamp(24px,5vw,38px)",fontWeight:700,margin:"18px 0 8px",lineHeight:1.35}}>
          <span style={{background:"linear-gradient(90deg,#5DCAA5,#85B7EB,#ED93B1)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>科學記憶 × 間隔重複 × AI 家教</span>
        </h1>
        <p style={{animation:"fadeUp .7s ease-out .45s both",color:"rgba(255,255,255,.4)",fontSize:12,maxWidth:420,margin:"0 auto 36px"}}>Anki SRS 演算法 · 鍵盤快捷鍵 · CSV 匯入 · Gemini AI 免費對話</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,animation:"fadeUp .7s ease-out .6s both"}}>
          {Object.entries(LV).map(([k,c])=>(
            <div key={k} onClick={()=>onSelect(k)} onMouseEnter={()=>setHov(k)} onMouseLeave={()=>setHov(null)}
              style={{cursor:"pointer",background:hov===k?"rgba(255,255,255,.12)":"rgba(255,255,255,.05)",border:`1px solid ${hov===k?"rgba(255,255,255,.2)":"rgba(255,255,255,.08)"}`,borderRadius:16,padding:"26px 16px 22px",transition:"all .25s",transform:hov===k?"translateY(-4px)":"none"}}>
              <div style={{fontSize:38,marginBottom:8}}>{c.icon}</div>
              <div style={{fontSize:19,fontWeight:700}}>{c.label}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginBottom:12}}>{c.en}</div>
              <div style={{fontSize:10,color:c.accent,background:`${c.accent}22`,borderRadius:14,padding:"3px 10px",display:"inline-block"}}>{c.words}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:44,display:"flex",flexWrap:"wrap",justifyContent:"center",gap:22,animation:"fadeUp .7s ease-out .8s both"}}>
          {[{i:"🃏",t:"SRS 間隔重複",d:"Anki 記憶演算法"},{i:"⌨️",t:"快捷鍵",d:"Space·1234·Enter"},{i:"🤖",t:"AI 家教",d:"Gemini 免費 API"},{i:"📥",t:"CSV 匯入",d:"自訂單字庫"}].map((f,i)=>(
            <div key={i} style={{textAlign:"center",width:110}}>
              <div style={{fontSize:24,marginBottom:4}}>{f.i}</div>
              <div style={{fontSize:12,fontWeight:600,marginBottom:1}}>{f.t}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══ MENU ════════════════════════════════════════════════════════════
function Menu({lv,onSelect,daily}){
  const c=LV[lv],pct=Math.round((daily.done/daily.target)*100);
  return(
    <div>
      <div style={{...S.card,padding:"14px 18px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontWeight:600,fontSize:13,color:S.t1}}>今日進度</span><span style={{fontSize:12,color:c.color,fontWeight:600}}>{pct}%</span></div>
        <div style={{height:6,background:S.bg2,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${c.accent},${c.color})`,borderRadius:3,transition:"width .4s"}}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
        {[{id:"srs",icon:"🃏",t:"SRS 單字卡",d:"Anki 間隔重複",cl:"#1D9E75"},{id:"quiz",icon:"📝",t:"單字測驗",d:"四選一即時回饋",cl:"#534AB7"},{id:"grammar",icon:"🧠",t:"文法學堂",d:`${GRAMMAR[lv].length} 個文法重點`,cl:"#D85A30"},{id:"reading",icon:"📖",t:"閱讀理解",d:`${READING[lv].length} 篇分級文章`,cl:"#185FA5"},{id:"ai",icon:"🤖",t:"AI 英語家教",d:"Gemini 免費對話",cl:"#993556"}].map(m=>(
          <div key={m.id} onClick={()=>onSelect(m.id)} style={{cursor:"pointer",...S.card,padding:"20px 14px",transition:"all .15s",overflow:"hidden"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 6px 18px ${m.cl}10`}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none"}}>
            <div style={{fontSize:26,marginBottom:6}}>{m.icon}</div>
            <div style={{fontWeight:600,fontSize:14,color:S.t1,marginBottom:2}}>{m.t}</div>
            <div style={{fontSize:11,color:S.t2}}>{m.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ SRS FLASHCARD ═══════════════════════════════════════════════════
function SRS({lv,onBack,onXp}){
  const built=VOCAB[lv];const[cards,setCards]=useState(built);const[deck,setDeck]=useState(()=>createDeck(built));const[flip,setFlip]=useState(false);const[info,setInfo]=useState(false);const c=LV[lv];const fileRef=useRef();
  const cur=deck.queue[0]!==undefined?cards[deck.queue[0]]:null;const left=deck.queue.length;const done=left===0;
  useEffect(()=>{if(cur)preImg(cards,deck.queue[0],3)},[deck.queue[0]]);
  useEffect(()=>{if(cur&&!flip)speak(cur.word)},[deck.queue[0],flip]);
  const rate=useCallback(a=>{if(a==="easy"||a==="good")onXp();setDeck(d=>rateDeck(d,a));setFlip(false)},[onXp]);
  useEffect(()=>{const h=e=>{if(done)return;if(e.code==="Space"){e.preventDefault();setFlip(f=>{if(!f&&cur?.ex)setTimeout(()=>speak(cur.ex),350);return!f})}if(flip){if(e.key==="1")rate("again");if(e.key==="2")rate("hard");if(e.key==="3")rate("good");if(e.key==="4")rate("easy")}if(e.key==="Enter"){e.preventDefault();if(cur)speak(flip?(cur.ex||cur.word):cur.word)}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[flip,done,cur,rate]);
  const handleCSV=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const p=parseCSV(ev.target.result);if(p.length){setCards(p);setDeck(createDeck(p));setFlip(false)}};r.readAsText(f,"utf-8")};

  if(done){const{stats,total}=deck;return(<div><Hdr t="SRS 單字卡" onBack={onBack} color={c.color}/><div style={{textAlign:"center",padding:"36px 16px"}}><div style={{fontSize:52,marginBottom:10}}>🎉</div><h2 style={{fontSize:20,fontWeight:700,color:S.t1,marginBottom:4}}>練習完成！</h2><p style={{color:S.t2,fontSize:13,marginBottom:20}}>共 {total} 張卡片</p><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,maxWidth:360,margin:"0 auto 24px"}}>{[["Again",stats.again,"#E24B4A"],["Hard",stats.hard,"#EF9F27"],["Good",stats.good,"#1D9E75"],["Easy",stats.easy,"#185FA5"]].map(([l,v,cl])=>(<div key={l} style={{...S.card,padding:"10px 6px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:cl}}>{v}</div><div style={{fontSize:10,color:S.t3}}>{l}</div></div>))}</div><button onClick={()=>{setDeck(createDeck(cards));setFlip(false)}} style={{...S.btn,background:c.color,color:"#fff",marginRight:8}}>重新開始</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1}}>返回</button></div></div>)}

  const pct=Math.round(((deck.total-left)/deck.total)*100);
  return(
    <div>
      <Hdr t="SRS 單字卡" onBack={onBack} color={c.color} extra={<div style={{display:"flex",gap:5}}><button onClick={()=>setInfo(!info)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"3px 7px",fontSize:11,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>ⓘ</button><label style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"3px 7px",fontSize:11,cursor:"pointer",color:S.t2,display:"flex",alignItems:"center",gap:3}}>📥 CSV<input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} style={{display:"none"}}/></label></div>}/>
      {info&&<div style={{...S.card,padding:"12px 16px",marginBottom:10,fontSize:12,color:S.t2,lineHeight:1.8}}><b style={{color:S.t1}}>快捷鍵</b><br/><b>Space</b> 翻牌 · <b>Enter</b> 朗讀 · <b>1</b> Again · <b>2</b> Hard · <b>3</b> Good · <b>4</b> Easy<div style={{marginTop:6,borderTop:`1px solid ${S.bd}`,paddingTop:6,fontSize:11}}><b>Again</b> 插入第2位 · <b>Hard</b> 插入中間 · <b>Good</b> 移到最後 · <b>Easy</b> 已掌握移除</div></div>}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,fontSize:11}}>
        <div style={{flex:1,height:4,background:S.bg2,borderRadius:2}}><div style={{height:"100%",width:`${pct}%`,background:c.color,borderRadius:2,transition:"width .3s"}}/></div>
        <span style={{color:S.t3}}>{left}/{deck.total}</span>
        {[["#E24B4A",deck.stats.again],["#EF9F27",deck.stats.hard],["#1D9E75",deck.stats.good],["#185FA5",deck.stats.easy]].map(([cl,v],i)=><span key={i} style={{color:cl,fontWeight:600,minWidth:14,textAlign:"center"}}>{v}</span>)}
      </div>
      <div onClick={()=>{if(!flip){setFlip(true);if(cur.ex)setTimeout(()=>speak(cur.ex),350)}}} style={{cursor:!flip?"pointer":"default",borderRadius:18,padding:flip?"16px 18px 20px":"44px 18px",textAlign:"center",minHeight:flip?260:200,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:flip?"flex-start":"center",background:flip?`linear-gradient(135deg,${c.bg},#fff)`:S.bg1,border:`2px solid ${flip?c.accent:S.bd}`,transition:"all .25s",boxShadow:flip?`0 8px 30px ${c.color}10`:"none"}}>
        {!flip?(<>
          {cur.img&&<div style={{fontSize:40,marginBottom:8}}>{cur.img}</div>}
          <div style={{fontSize:32,fontWeight:700,color:S.t1}}>{cur.word}<button onClick={e=>{e.stopPropagation();speak(cur.word)}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",marginLeft:6,verticalAlign:"middle"}}>🔊</button></div>
          {cur.phonetic&&<div style={{fontSize:12,color:S.t3,marginTop:4}}>{cur.phonetic}</div>}
          <div style={{fontSize:11,color:S.t3,marginTop:10}}>點擊翻牌 或按 Space</div>
        </>):(<>
          {imgC[cur.word]&&<img src={imgC[cur.word]} alt="" style={{width:"100%",maxWidth:280,height:130,objectFit:"cover",borderRadius:10,marginBottom:10}} onError={e=>e.target.style.display="none"}/>}
          <div style={{fontSize:20,fontWeight:700,color:c.color}}>{cur.word} <span style={{fontSize:12,fontWeight:400,color:S.t3}}>({cur.pos})</span></div>
          <div style={{fontSize:18,fontWeight:600,color:S.t1,margin:"3px 0 8px"}}>{cur.meaning}</div>
          {cur.forms?.length>0&&<div style={{fontSize:11,color:S.t2,marginBottom:6,width:"100%",padding:"5px 10px",background:`${c.accent}0a`,borderRadius:8,textAlign:"left"}}><span style={{fontWeight:600,color:c.color}}>詞性變化</span>{cur.forms.map((f,i)=><span key={i} style={{marginLeft:6}}>{f.w} ({f.p}) {f.n}</span>)}</div>}
          {cur.col?.length>0&&<div style={{fontSize:11,color:S.t2,marginBottom:6,width:"100%",padding:"5px 10px",background:`${c.accent}0a`,borderRadius:8,textAlign:"left"}}><span style={{fontWeight:600,color:c.color}}>搭配詞</span>{cur.col.map((x,i)=><div key={i} style={{marginLeft:10,marginTop:1}}>{x}</div>)}</div>}
          {cur.ex&&<div style={{fontSize:13,color:S.t1,fontStyle:"italic",width:"100%",padding:"7px 10px",background:S.bg2,borderRadius:8,textAlign:"left"}}>"{cur.ex}"<button onClick={e=>{e.stopPropagation();speak(cur.ex)}} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",marginLeft:4}}>🔊</button>{cur.exZh&&<div style={{fontSize:11,color:S.t3,fontStyle:"normal",marginTop:2}}>{cur.exZh}</div>}</div>}
        </>)}
      </div>
      {flip&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginTop:12}}>
        {[{k:"again",l:"Again",n:"1",cl:"#E24B4A",bg:"#FCEBEB"},{k:"hard",l:"Hard",n:"2",cl:"#BA7517",bg:"#FAEEDA"},{k:"good",l:"Good",n:"3",cl:"#0F6E56",bg:"#E1F5EE"},{k:"easy",l:"Easy",n:"4",cl:"#185FA5",bg:"#E6F1FB"}].map(b=>(
          <button key={b.k} onClick={()=>rate(b.k)} style={{...S.btn,background:b.bg,color:b.cl,padding:"12px 4px",fontSize:13,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>{b.l}<span style={{fontSize:9,opacity:.5}}>{b.n}</span></button>
        ))}
      </div>}
    </div>
  );
}

// ═══ QUIZ ════════════════════════════════════════════════════════════
function QuizMod({lv,onBack,onXp}){
  const words=VOCAB[lv];const[qi,setQi]=useState(0);const[score,setScore]=useState(0);const[sel,setSel]=useState(null);const[done,setDone]=useState(false);const c=LV[lv];
  const qs=useMemo(()=>words.map((w,i)=>{const wr=words.filter((_,j)=>j!==i).sort(()=>Math.random()-.5).slice(0,3);return{word:w.word,phonetic:w.phonetic,correct:w.meaning,opts:[...wr.map(x=>x.meaning),w.meaning].sort(()=>Math.random()-.5)}}).sort(()=>Math.random()-.5),[]);
  const pick=o=>{if(sel!==null)return;setSel(o);if(o===qs[qi].correct){setScore(s=>s+1);onXp()}setTimeout(()=>{setSel(null);qi+1>=qs.length?setDone(true):setQi(qi+1)},900)};
  if(done)return(<div style={{textAlign:"center",padding:"40px 16px"}}><Hdr t="單字測驗" onBack={onBack} color={c.color}/><div style={{fontSize:48}}>{score>=8?"🏆":score>=6?"👏":"💪"}</div><h2 style={{fontSize:18,fontWeight:700,color:S.t1,marginTop:8}}>{score}/{qs.length}</h2><p style={{color:S.t2,fontSize:13,marginBottom:18}}>{score>=8?"太棒了！":score>=6?"繼續加油":"多練習就會進步"}</p><button onClick={()=>{setQi(0);setScore(0);setSel(null);setDone(false)}} style={{...S.btn,background:c.color,color:"#fff",marginRight:8}}>再測一次</button><button onClick={onBack} style={{...S.btn,background:S.bg2,color:S.t1}}>返回</button></div>);
  const q=qs[qi];
  return(<div><Hdr t="單字測驗" onBack={onBack} color={c.color}/><PBar v={qi} mx={qs.length} cl={c.color}/><div style={{...S.card,padding:"24px 18px",textAlign:"center"}}><div style={{fontSize:10,color:S.t3,marginBottom:4}}>這個單字的中文意思是？</div><div style={{fontSize:28,fontWeight:700,color:S.t1}}>{q.word}</div><div style={{fontSize:11,color:S.t3,marginBottom:14}}>{q.phonetic}</div><button onClick={()=>speak(q.word)} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",marginBottom:12}}>🔊</button><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>{q.opts.map((o,i)=>{const ok=o===q.correct,pk=sel===o;let bg=S.bg2,bd=`1px solid ${S.bd}`;if(sel!==null){if(ok){bg="#EAF3DE";bd="2px solid #639922"}else if(pk){bg="#FCEBEB";bd="2px solid #E24B4A"}}return<button key={i} onClick={()=>pick(o)} style={{padding:"11px 8px",borderRadius:10,background:bg,border:bd,cursor:sel?"default":"pointer",fontSize:13,fontFamily:"inherit",color:S.t1}}>{o}</button>})}</div></div></div>);
}

// ═══ GRAMMAR (expanded) ═════════════════════════════════════════════
function GrammarMod({lv,onBack}){
  const rules=GRAMMAR[lv];const[sel,setSel]=useState(null);const[ans,setAns]=useState(null);const c=LV[lv];
  if(sel===null)return(<div><Hdr t="文法學堂" onBack={onBack} color={c.color}/><p style={{fontSize:12,color:S.t2,marginBottom:10}}>共 {rules.length} 個文法重點，點擊進入學習</p>{rules.map((r,i)=>(<div key={i} onClick={()=>{setSel(i);setAns(null)}} style={{cursor:"pointer",...S.card,padding:"16px",marginBottom:8,transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=c.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=S.bd}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:11,color:"#fff",background:c.color,borderRadius:12,padding:"2px 8px",fontWeight:600}}>{i+1}</span><div><div style={{fontWeight:600,fontSize:14,color:S.t1}}>{r.t}</div><div style={{fontSize:12,color:S.t2}}>{r.d}</div></div></div></div>))}</div>);
  const r=rules[sel];
  return(<div><Hdr t="文法學堂" onBack={onBack} color={c.color}/><button onClick={()=>setSel(null)} style={{background:"none",border:"none",fontSize:12,color:c.color,cursor:"pointer",marginBottom:10,fontFamily:"inherit"}}>← 返回列表</button><div style={{...S.card,padding:"22px 18px"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{fontSize:11,color:"#fff",background:c.color,borderRadius:12,padding:"2px 8px",fontWeight:600}}>{sel+1}/{rules.length}</span><h3 style={{fontSize:17,fontWeight:700,color:S.t1,margin:0}}>{r.t}</h3></div><div style={{fontSize:12,color:S.t2,padding:"5px 10px",background:c.bg,borderRadius:8,marginBottom:12}}>{r.d}</div><div style={{fontSize:13,fontStyle:"italic",color:S.t1,padding:"8px 12px",background:S.bg2,borderRadius:8,marginBottom:18}}>"{r.ex}" <button onClick={()=>speak(r.ex)} style={{background:"none",border:"none",fontSize:13,cursor:"pointer"}}>🔊</button></div><div style={{borderTop:`1px solid ${S.bd}`,paddingTop:14}}><div style={{fontWeight:600,fontSize:13,color:S.t1,marginBottom:8}}>小測驗</div><div style={{fontSize:13,color:S.t1,marginBottom:10}}>{r.q.s}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{r.q.o.map((o,i)=>{const ok=i===r.q.a,pk=ans===i;let bg=S.bg2,bd=`1px solid ${S.bd}`;if(ans!==null){if(ok){bg="#EAF3DE";bd="2px solid #639922"}else if(pk){bg="#FCEBEB";bd="2px solid #E24B4A"}}return<button key={i} onClick={()=>setAns(i)} style={{padding:"9px",borderRadius:8,background:bg,border:bd,cursor:ans!==null?"default":"pointer",fontSize:12,fontFamily:"inherit",color:S.t1}}>{o}</button>})}</div>{ans!==null&&<div style={{marginTop:8,fontSize:12,fontWeight:600,color:ans===r.q.a?"#3B6D11":"#A32D2D"}}>{ans===r.q.a?"✓ 正確！":`✗ 答案是「${r.q.o[r.q.a]}」`}</div>}</div></div><div style={{display:"flex",justifyContent:"space-between",marginTop:12}}><button onClick={()=>{setSel(Math.max(0,sel-1));setAns(null)}} disabled={sel===0} style={{...S.btn,background:S.bg2,color:S.t1,opacity:sel===0?.4:1,fontSize:12,padding:"8px 16px"}}>← 上一題</button><button onClick={()=>{setSel(Math.min(rules.length-1,sel+1));setAns(null)}} disabled={sel===rules.length-1} style={{...S.btn,background:c.color,color:"#fff",opacity:sel===rules.length-1?.4:1,fontSize:12,padding:"8px 16px"}}>下一題 →</button></div></div>);
}

// ═══ READING (expanded) ═════════════════════════════════════════════
function ReadingMod({lv,onBack}){
  const articles=READING[lv];const[ai,setAi]=useState(0);const[ans,setAns]=useState({});const c=LV[lv];const d=articles[ai];
  return(<div><Hdr t="閱讀理解" onBack={onBack} color={c.color}/>
    <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto"}}>{articles.map((a,i)=>(<button key={i} onClick={()=>{setAi(i);setAns({})}} style={{flexShrink:0,padding:"6px 14px",borderRadius:10,background:i===ai?c.color:S.bg2,color:i===ai?"#fff":S.t1,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{a.t}</button>))}</div>
    <div style={{...S.card,padding:"22px 18px",marginBottom:14}}>
      <h3 style={{fontSize:16,fontWeight:700,color:S.t1,marginBottom:10}}>{d.t}</h3>
      <div style={{fontSize:13,lineHeight:1.9,color:S.t1,padding:"12px 14px",background:S.bg2,borderRadius:10,borderLeft:`3px solid ${c.accent}`}}>{d.tx}</div>
      <button onClick={()=>speak(d.tx)} style={{marginTop:6,background:"none",border:"none",fontSize:11,color:c.color,cursor:"pointer",fontFamily:"inherit"}}>🔊 朗讀全文</button>
    </div>
    {d.qs.map((q,qi)=>(<div key={qi} style={{...S.card,padding:"14px",marginBottom:8}}><div style={{fontWeight:600,fontSize:12,color:S.t1,marginBottom:6}}>Q{qi+1}. {q.q}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>{q.o.map((o,oi)=>{const dn=ans[qi]!==undefined,ok=oi===q.a,pk=ans[qi]===oi;let bg=S.bg2,bd=`1px solid ${S.bd}`;if(dn){if(ok){bg="#EAF3DE";bd="2px solid #639922"}else if(pk){bg="#FCEBEB";bd="2px solid #E24B4A"}}return<button key={oi} onClick={()=>{if(!dn)setAns(a=>({...a,[qi]:oi}))}} style={{padding:"7px 5px",borderRadius:7,background:bg,border:bd,cursor:dn?"default":"pointer",fontSize:11,fontFamily:"inherit",color:S.t1,textAlign:"left"}}>{o}</button>})}</div></div>))}
    <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}><button onClick={()=>{setAi(Math.max(0,ai-1));setAns({})}} disabled={ai===0} style={{...S.btn,background:S.bg2,color:S.t1,opacity:ai===0?.4:1,fontSize:12,padding:"8px 16px"}}>← 上一篇</button><button onClick={()=>{setAi(Math.min(articles.length-1,ai+1));setAns({})}} disabled={ai===articles.length-1} style={{...S.btn,background:c.color,color:"#fff",opacity:ai===articles.length-1?.4:1,fontSize:12,padding:"8px 16px"}}>下一篇 →</button></div>
  </div>);
}

// ═══ AI TUTOR — Gemini API (free tier) ══════════════════════════════
function AITutor({lv,onBack,apiKey,onSetKey}){
  const c=LV[lv];
  const[msgs,setMsgs]=useState([
    {role:"a",content:`哈囉！我是你的 AI 英語家教 🤖\n\n問我任何英文問題：\n• 「accomplish 怎麼用？」\n• 「幫我解釋現在完成式」\n• 「Can we practice ordering food?」\n\n等級：${LV[lv].label}，我會配合你的程度！\n\n⚙️ 使用 Google Gemini API (免費方案)\n每天可免費對話約 1,000 次\n請先在下方輸入你的 API Key`}
  ]);
  const[inp,setInp]=useState("");const[busy,setBusy]=useState(false);const[showKey,setShowKey]=useState(!apiKey);const[keyInp,setKeyInp]=useState(apiKey);const btm=useRef(null);
  useEffect(()=>{btm.current?.scrollIntoView({behavior:"smooth"})},[msgs]);

  const send=async()=>{
    if(!inp.trim()||busy)return;
    if(!apiKey){setShowKey(true);return}
    const txt=inp.trim();setInp("");setMsgs(m=>[...m,{role:"u",content:txt}]);setBusy(true);
    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          systemInstruction:{parts:[{text:`You are a friendly, encouraging English tutor for a Taiwanese ${LV[lv].label} (${LV[lv].en}) student. Reply in Traditional Chinese mixed with English. For vocabulary: include pronunciation, Chinese meaning, word forms, collocations, examples. For grammar: clear explanations with examples. Gently correct mistakes. Be concise and fun. Use bullet points sparingly.`}]},
          contents:[{parts:[{text:txt}]}],
          generationConfig:{maxOutputTokens:800,temperature:0.7}
        })
      });
      const data=await res.json();
      const reply=data?.candidates?.[0]?.content?.parts?.[0]?.text||data?.error?.message||"抱歉，暫時無法回答。";
      setMsgs(m=>[...m,{role:"a",content:reply}]);
    }catch(e){setMsgs(m=>[...m,{role:"a",content:`⚠️ 連線失敗：${e.message}\n\n請確認：\n1. API Key 是否正確\n2. 是否已在 aistudio.google.com 啟用 API\n3. 免費方案每分鐘限 15 次請求`}])}
    setBusy(false);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 110px)"}}>
      <Hdr t="AI 英語家教" onBack={onBack} color={c.color} extra={
        <button onClick={()=>setShowKey(!showKey)} style={{background:"none",border:`1px solid ${S.bd}`,borderRadius:8,padding:"3px 7px",fontSize:11,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>{apiKey?"🔑 已設定":"⚙️ 設定 API Key"}</button>
      }/>

      {showKey&&(
        <div style={{...S.card,padding:"14px 16px",marginBottom:10,fontSize:12}}>
          <div style={{fontWeight:600,color:S.t1,marginBottom:6}}>Gemini API Key 設定</div>
          <div style={{color:S.t2,marginBottom:8,lineHeight:1.6}}>
            1. 到 <span style={{color:c.color,fontWeight:600}}>aistudio.google.com</span> 登入 Google 帳號<br/>
            2. 點左邊「Get API key」→ 建立 Key<br/>
            3. 複製貼到下方（免費，不需信用卡）
          </div>
          <div style={{display:"flex",gap:6}}>
            <input value={keyInp} onChange={e=>setKeyInp(e.target.value)} placeholder="貼上你的 Gemini API Key..." type="password"
              style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1px solid ${S.bd}`,fontSize:12,fontFamily:"inherit",background:S.bg1,color:S.t1,outline:"none"}}/>
            <button onClick={()=>{onSetKey(keyInp);setShowKey(false)}} style={{...S.btn,background:c.color,color:"#fff",padding:"8px 14px",fontSize:12}}>儲存</button>
          </div>
        </div>
      )}

      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,padding:"2px 0"}}>
        {msgs.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:m.role==="u"?"flex-end":"flex-start"}}><div style={{maxWidth:"82%",padding:"9px 13px",borderRadius:14,background:m.role==="u"?c.color:S.bg1,color:m.role==="u"?"#fff":S.t1,border:m.role==="u"?"none":`1px solid ${S.bd}`,fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{m.content}</div></div>))}
        {busy&&<div style={{padding:"9px 13px",borderRadius:14,background:S.bg1,border:`1px solid ${S.bd}`,fontSize:12,color:S.t3,alignSelf:"flex-start"}}>思考中...</div>}
        <div ref={btm}/>
      </div>
      <div style={{display:"flex",gap:5,overflowX:"auto",padding:"5px 0",flexShrink:0}}>
        {["教我一個新單字","Practice conversation","解釋文法","翻譯練習"].map((p,i)=>(<button key={i} onClick={()=>setInp(p)} style={{flexShrink:0,padding:"4px 10px",borderRadius:14,background:S.bg2,border:`1px solid ${S.bd}`,fontSize:10,cursor:"pointer",color:S.t2,fontFamily:"inherit"}}>{p}</button>))}
      </div>
      <div style={{display:"flex",gap:6,padding:"5px 0",flexShrink:0}}>
        <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={apiKey?"輸入訊息...":"請先設定 API Key ↑"} style={{flex:1,padding:"9px 12px",borderRadius:10,border:`1px solid ${S.bd}`,fontSize:13,outline:"none",fontFamily:"inherit",background:S.bg1,color:S.t1}}/>
        <button onClick={send} disabled={busy||!inp.trim()} style={{...S.btn,background:c.color,color:"#fff",padding:"9px 14px",opacity:busy||!inp.trim()?.5:1}}>發送</button>
      </div>
    </div>
  );
}

// ═══ SHARED ═════════════════════════════════════════════════════════
function Hdr({t,onBack,color,extra}){return(<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><button onClick={onBack} style={{background:"none",border:"none",fontSize:12,color,cursor:"pointer",fontWeight:600,fontFamily:"inherit"}}>← 返回</button><h2 style={{fontSize:16,fontWeight:700,color:S.t1,margin:0,flex:1}}>{t}</h2>{extra}</div>)}
function PBar({v,mx,cl}){return(<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,fontSize:11}}><div style={{flex:1,height:4,background:S.bg2,borderRadius:2}}><div style={{height:"100%",width:`${(v/mx)*100}%`,background:cl,borderRadius:2,transition:"width .3s"}}/></div><span style={{color:S.t3}}>{v+1}/{mx}</span></div>)}
