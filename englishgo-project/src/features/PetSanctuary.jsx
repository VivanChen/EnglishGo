import { useEffect, useRef, useState } from 'react';
import PetCompanion from '../components/PetCompanion.jsx';
import { PetHabitatScene } from '../components/PetWorldArt.jsx';
import { PetGrowthPanel } from '../components/PetJourneyPanels.jsx';
import PetPlayground from './PetPlayground.jsx';
import { CARE_CHOICES, completePetCare, petNeed } from '../data/petCare.js';
import { getPetJourney } from '../data/petJourney.js';
import './pet-sanctuary.css';

const TABS=[['home','小家園','⌂'],['pets','我的夥伴','♡'],['activities','一起出遊','⚑'],['eggs','孵化小屋','◒'],['tasks','每日任務','✓'],['dex','夥伴圖鑑','▦']];
const LEARN_ROUTES={srs_5:'srs',quiz_3:'quiz',speak_1:'speak'};
function SectionTitle({eyebrow,title,children}){return <div className="ps-section-title"><span className="pet-eyebrow">{eyebrow}</span><h2>{title}</h2>{children&&<p>{children}</p>}</div>}
function Meter({value,max=100,label}){return <div className="ps-progress"><div role="progressbar" aria-label={label} aria-valuenow={Math.min(max,Math.max(0,value))} aria-valuemin={0} aria-valuemax={max}><i style={{width:`${Math.min(100,Math.max(0,value/max*100))}%`}}/></div><span>{Math.min(max,Math.max(0,value))}/{max}</span></div>}
function Dialog({title,children,onClose}){const ref=useRef(null);useEffect(()=>{ref.current?.showModal?.();return()=>ref.current?.close?.()},[]);return <dialog ref={ref} className="ps-dialog" aria-label={title} onCancel={e=>{e.preventDefault();onClose()}}><button className="ps-dialog-close" aria-label="關閉" onClick={onClose}>×</button><h2>{title}</h2>{children}</dialog>}

export default function PetSanctuary({onBack,onNavigate,onAccount,initialTab='home',c,pets,setPets,eggs,setEggs,coins,setCoins,inventory,setInventory,petAccount,setPetAccount,petTasks,incrTask,api}){
  const {Hdr,useLS,PETS,EGG_HATCH_TASKS,RARITY_INFO,DAILY_TASK_DEFS,PET_FOODS,ACTION_PROMPTS,levelUpPet,calcDecay,speak,stopSpeech,playSound,applyDuplicatePetReward,getDuplicatePetReward}=api;
  const [tab,setTab]=useState(initialTab),[selectedId,setSelectedId]=useState(null),[view,setView]=useState(null),[care,setCare]=useState(null),[result,setResult]=useState(null),[hatched,setHatched]=useState(null),[notice,setNotice]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[starter,setStarter]=useState('bunny');
  const [starterClaimed,setStarterClaimed]=useLS('petStarterClaimed',false),[claimed,setClaimed]=useLS('claimedTasks',{date:'',ids:[]}),[animLevel,setAnimLevel]=useLS('eg_animLevel','full');
  const locks=useRef(new Set()),balance=useRef(coins),stock=useRef(inventory);
  balance.current=coins;stock.current=inventory;
  const today=new Date().toDateString(),counts=petTasks?.date===today?petTasks.counts||{}:{},claimedIds=claimed.date===today?claimed.ids||[]:[];
  const getDef=p=>PETS[p.rarity]?.find(d=>d.id===p.petId),selected=pets.find(p=>p.petId===selectedId),ready=eggs.filter(e=>(e.progress||0)>=EGG_HATCH_TASKS[e.rarity]);
  const claimable=DAILY_TASK_DEFS.filter(t=>(counts[t.statKey]||0)>=t.target&&!claimedIds.includes(t.id));
  const allDefs=Object.entries(PETS).flatMap(([rarity,items])=>items.map(item=>({...item,rarity}))),starters=(PETS.N||[]).slice(0,3);
  const favorite=selected||[...pets].sort((a,b)=>(b.bond||0)-(a.bond||0))[0],focus=[...pets].sort((a,b)=>Math.min(a.hunger??80,a.clean??80,a.energy??80)-Math.min(b.hunger??80,b.clean??80,b.energy??80))[0];
  useEffect(()=>{setPets(previous=>previous.map(p=>calcDecay(p)))},[]);
  useEffect(()=>{if(!/jsdom/i.test(navigator.userAgent))window.scrollTo({top:0,behavior:'instant'});stopSpeech?.()},[tab,selectedId,view]);
  useEffect(()=>()=>stopSpeech?.(),[]);
  useEffect(()=>{document.body.classList.remove('eg-anim-full','eg-anim-lite','eg-anim-off');document.body.classList.add(`eg-anim-${animLevel}`)},[animLevel]);
  const goTab=id=>{setTab(id);setSelectedId(null);setView(null);setQuery('');setFilter('all');setNotice('')};
  const visit=p=>{setSelectedId(p.petId);setResult(null)};
  const adopt=()=>{
    if(starterClaimed||pets.length||eggs.length||locks.current.has('starter'))return;
    const def=starters.find(p=>p.id===starter)||starters[0];if(!def)return;
    locks.current.add('starter');setStarterClaimed(true);
    setEggs(previous=>[...previous,{id:`starter_${Date.now()}`,petId:def.id,rarity:'N',progress:Math.max(0,EGG_HATCH_TASKS.N-3),date:new Date().toISOString(),starter:true}]);
    setInventory(previous=>({...previous,apple:(previous.apple||0)+3}));goTab('eggs');setNotice('領養蛋與 3 份蘋果已放進小家。再完成 3 次學習，就能見面！');
  };
  const hatch=egg=>{
    if(locks.current.has(egg.id)||!eggs.some(e=>e.id===egg.id)||(egg.progress||0)<EGG_HATCH_TASKS[egg.rarity])return;
    const def=getDef(egg);if(!def)return;locks.current.add(egg.id);
    if(pets.some(p=>p.hatchedEggIds?.includes(egg.id))){setEggs(previous=>previous.filter(e=>e.id!==egg.id));setNotice('這顆蛋已經孵化過，已移除重複紀錄，夥伴與獎勵都保留。');return;}
    const now=new Date().toISOString(),owned=pets.some(p=>p.petId===egg.petId);
    setPets(previous=>{
      const old=previous.find(p=>p.petId===egg.petId);
      let friend=old?applyDuplicatePetReward(old,getDuplicatePetReward(egg.rarity),now):{petId:egg.petId,rarity:egg.rarity,level:1,exp:0,dupes:0,bond:0,hunger:100,clean:100,energy:100,hatchDate:now,lastUpdate:now};
      if(egg.pendingDuplicateReward?.dupes>0)friend=applyDuplicatePetReward(friend,egg.pendingDuplicateReward,now);
      friend={...friend,hatchedEggIds:[...new Set([...(friend.hatchedEggIds||[]),egg.id])]};
      return old?previous.map(p=>p.petId===friend.petId?friend:p):[...previous,friend];
    });
    setEggs(previous=>previous.filter(e=>e.id!==egg.id));setHatched({def,owned});playSound?.('done');
  };
  const startCare=(action,foodId)=>{
    if(!selected)return;
    if(action==='feed'&&!foodId){setView('food');return;}
    const prompts=ACTION_PROMPTS[action]||['Let’s learn together.'];
    setCare({action,foodId,prompt:prompts[Math.floor(Math.random()*prompts.length)]});locks.current.delete('care');
  };
  const finishCare=()=>{
    if(!care||!selected||locks.current.has('care'))return;
    const food=PET_FOODS.find(f=>f.id===care.foodId);
    if(care.action==='feed'&&(!food||!(stock.current[food.id]>0)))return;
    locks.current.add('care');const completed=completePetCare(selected,care.action,food);if(!completed)return;
    if(food){stock.current={...stock.current,[food.id]:stock.current[food.id]-1};setInventory(stock.current);}
    const updated=levelUpPet(completed.pet);setPets(previous=>previous.map(p=>p.petId===selected.petId?updated:p));
    if(completed.rewards.coins)setCoins(previous=>previous+completed.rewards.coins);
    const stat={feed:'feedToday',clean:'cleanToday',play:'playToday'}[care.action];if(stat)incrTask?.(stat);
    setResult({...completed,action:care.action});setCare(null);setView(null);playSound?.('good');
  };
  const buy=food=>{
    if(balance.current<food.cost)return;
    balance.current-=food.cost;stock.current={...stock.current,[food.id]:(stock.current[food.id]||0)+1};
    setCoins(balance.current);setInventory(stock.current);setNotice(`已買入 ${food.name} 1 份 · 花費 ${food.cost} 金幣`);playSound?.('good');
  };
  const claimTask=task=>{
    const lock=`task:${today}:${task.id}`;
    if(locks.current.has(lock)||claimedIds.includes(task.id)||(counts[task.statKey]||0)<task.target)return;
    locks.current.add(lock);const bonus=Math.max(0,...pets.map(p=>p.bond||0))>=150?1.2:1;
    const money=Math.floor(task.reward.coins*bonus),xp=Math.floor(task.reward.exp*bonus),recipient=favorite;
    setCoins(previous=>previous+money);if(recipient)setPets(previous=>previous.map(p=>p.petId===recipient.petId?levelUpPet({...p,exp:(p.exp||0)+xp}):p));
    setClaimed(previous=>({date:today,ids:[...new Set([...(previous.date===today?previous.ids||[]:[]),task.id])]}));setNotice(`已領取 ${money} 金幣${recipient?` · ${getDef(recipient)?.name} XP +${xp}`:''}`);playSound?.('good');
  };
  const taskAction=task=>{if(LEARN_ROUTES[task.id])onNavigate?.(LEARN_ROUTES[task.id]);else if(pets.length){visit(focus||pets[0])}else goTab('eggs')};
  const activityCards=[{icon:'🧺',name:'夥伴遊樂園',tag:'輕鬆玩 · 2–4 分鐘',text:'野餐接力、記憶尋寶。三回合慢慢想，一位夥伴就能玩。',button:'去選遊戲',action:()=>setView('play')},{icon:'⛺',name:'森林遠征',tag:'英文闖關 · 約 5–10 分鐘',text:'最多三位夥伴組隊，答題、使用技能，在營地補給。',button:'準備探險',action:()=>onNavigate?.('petAdventure')},{icon:'🎲',name:'寵物大富翁',tag:'策略遊戲 · 較長的陪伴',text:'沿著學習島走走，練英文，也練習規劃旅費。',button:'前往學習島',action:()=>onNavigate?.('petMonopoly')}];
  const activities=<div className="ps-activity-grid">{activityCards.map((item,i)=><article key={item.name} className={`ps-activity ps-tone-${i}`}><span className="ps-activity-icon">{item.icon}</span><small>{item.tag}</small><h3>{item.name}</h3><p>{item.text}</p><button className="pet-secondary" disabled={!pets.length} onClick={item.action}>{pets.length?`${item.button} →`:'先孵出一位夥伴'}</button></article>)}</div>;
  if(view==='play')return <PetPlayground {...{pets,setPets,setCoins,c,incrTask,levelUpPet,Hdr,speak,stopSpeech,playSound}} foods={PET_FOODS} getDef={getDef} onBack={()=>setView(null)}/>;
  return <div className="pet-world pet-home pet-sanctuary" data-testid="pet-sanctuary">
    <Hdr t="🐾 寵物小家園" cl={c.cl} onBack={view?()=>{setView(null);setNotice('')}:selected?()=>setSelectedId(null):onBack} extra={<span className="ps-wallet" aria-label={`${coins} 學習金幣`}>🪙 {coins}</span>}/>
    <div className="ps-topline"><span>{petAccount?`${petAccount.username} 的小家 · 已開啟雲端同步`:'這台裝置上的小家'}</span><div><button className="pet-link" onClick={()=>{setView('shop');setNotice('')}}>補給商店</button><button className="pet-link" onClick={()=>setView('settings')}>設定</button></div></div>
    {!selected&&!view&&<nav className="ps-tabs pet-tabs" aria-label="家園分頁">{TABS.map(([id,label,icon])=><button key={id} aria-pressed={tab===id} onClick={()=>goTab(id)}><span aria-hidden="true">{icon}</span>{label}{id==='eggs'&&ready.length>0&&<i>{ready.length}</i>}{id==='tasks'&&claimable.length>0&&<i>{claimable.length}</i>}</button>)}</nav>}
    {notice&&<div className="ps-notice" role="status">✓ {notice}<button aria-label="關閉通知" onClick={()=>setNotice('')}>×</button></div>}
    {view==='settings'?<section className="ps-panel"><SectionTitle eyebrow="讓陪伴更舒服" title="小家設定"/><fieldset><legend>動畫效果</legend>{[['full','完整效果'],['lite','輕量效果'],['off','關閉動畫']].map(([id,label])=><label className="ps-option" key={id}><input type="radio" name="animation" value={id} checked={animLevel===id} onChange={()=>setAnimLevel(id)}/>{label}</label>)}</fieldset><p className="pet-note">設定會自動保存。系統的減少動態效果也會生效。</p>{!petAccount&&onAccount&&<button className="pet-secondary" onClick={onAccount}>登入或建立雲端小帳號</button>}{petAccount&&<button className="pet-secondary" onClick={()=>{setPetAccount(null);setView(null);setNotice('已登出，這台裝置的寵物資料仍保留。')}}>登出 {petAccount.username}</button>}<button className="pet-primary" onClick={()=>setView(null)}>完成</button></section>
    :view==='shop'||view==='food'?<>
      <SectionTitle eyebrow={view==='food'?'照顧 · 第 1 步':'小家補給站'} title={view==='food'?'今天想吃什麼？':'把喜歡的食物帶回家'}>{view==='food'?'先選一份食物，再和夥伴說一句英文。':'庫存與補充效果一起看。買好後回去餵食，英文發音可以另外點選。'}</SectionTitle>
      {view==='food'&&!PET_FOODS.some(f=>inventory[f.id]>0)&&<div className="ps-empty"><h3>食物盒空了</h3><p>到補給商店買一份，或完成學習任務賺取金幣。</p><button className="pet-primary" onClick={()=>setView('shop')}>去補食物 →</button></div>}
      <div className="ps-food-grid">{PET_FOODS.filter(f=>view==='shop'||inventory[f.id]>0).map(food=><article key={food.id} className="ps-food"><span className="ps-stock">庫存 {inventory[food.id]||0}</span><span className="ps-food-icon">{food.emoji}</span><h3>{food.name}</h3><button className="pet-link" onClick={()=>speak?.(food.word)} aria-label={`朗讀 ${food.word}`}>{food.word} ♫</button><p>飽食 +{food.feed}</p><button className="pet-primary" disabled={view==='shop'&&coins<food.cost} onClick={()=>view==='food'?startCare('feed',food.id):buy(food)}>{view==='food'?'選這份食物':coins<food.cost?`還差 ${food.cost-coins} 金幣`:`買 1 份 · ${food.cost} 金幣`}</button></article>)}</div>
      <div className="pet-button-row"><button className="pet-secondary" onClick={()=>setView(null)}>{selected?'回去陪夥伴':'回小家園'}</button>{view==='shop'&&onNavigate&&<button className="pet-secondary" onClick={()=>goTab('tasks')}>去任務賺金幣 →</button>}</div>
    </>:selected?<>
      <div className="ps-care-header"><div><span className="pet-eyebrow">MY LITTLE COMPANION</span><h2>{getDef(selected)?.name}的陪伴時光</h2><p>{petNeed(selected).label}</p></div><span className="ps-tag">{RARITY_INFO[selected.rarity]?.label} · Lv.{selected.level||1}</span></div>
      <div className="ps-care-layout"><PetHabitatScene pets={[selected]} caption={`${getDef(selected)?.name}的小天地`}/><section className="ps-care-actions"><h3>一起做件小事</h3><p>每種照顧每天首次有成長獎勵；完成三種，再得一份陪伴獎勵。</p><div>{CARE_CHOICES.map(action=><button key={action.id} onClick={()=>startCare(action.id)}><span>{action.icon}</span><div><b>{action.name}</b><small>{getPetJourney(selected).today.includes(action.id)?'今天已完成 · 可再陪伴':action.hint}</small></div><i>{getPetJourney(selected).today.includes(action.id)?'✓':'→'}</i></button>)}</div></section></div>
      {result&&<section className="ps-notice ps-care-result" role="status" data-testid="pet-care-result"><div><b>照顧完成 · {CARE_CHOICES.find(a=>a.id===result.action)?.name}</b><p>{result.first?`金幣 +${result.rewards.coins} · XP +${result.rewards.exp}${result.rewards.bond?` · 親密 +${result.rewards.bond}`:''}`:'今天這項成長獎勵已領過，這次保留照顧效果。'}{result.combo?' · 三種陪伴獎勵已一起入帳':''}</p><small>今日培養 {Math.min(3,result.pet.careLog.actions.length)}/3</small></div></section>}
      <PetGrowthPanel pet={selected} onChange={updated=>setPets(previous=>previous.map(p=>p.petId===updated.petId?updated:p))} onCare={()=>startCare(petNeed(selected).action)} careLabel={CARE_CHOICES.find(a=>a.id===petNeed(selected).action)?.name} onPlay={()=>setView('play')}/>
      <details className="ps-panel ps-details"><summary>夥伴故事、學習單字與成長能量</summary><p>{getDef(selected)?.story}</p><div className="pet-button-row">{(getDef(selected)?.words||[]).map(word=><button className="pet-secondary" key={word} onClick={()=>speak?.(word)}>{word} ♫</button>)}</div><p>成長能量 {selected.dupes||0} · 遇到重複夥伴時增加 XP、親密與遠征能力。原有技能與成長紀錄都保留。</p></details>
    </>:<>
      {tab==='home'&&<>
        <section className="ps-hero"><div className="ps-hero-copy"><span className="pet-eyebrow">A LITTLE ENGLISH, A LITTLE CLOSER</span><h2>{pets.length?<>今天，也一起<br/>長大一點點。</>:<>你好，小夥伴。<br/>我們一起出發吧。</>}</h2><p>{pets.length?`${getDef(favorite)?.name||'小夥伴'}在等你。學一點英文，留一段回憶，陪伴不需要趕進度。`:'領養第一顆蛋，用三次英文學習迎接牠。照顧、玩耍和冒險，就從這裡開始。'}</p><button className="pet-primary" onClick={()=>pets.length?visit(favorite):goTab('eggs')}>{pets.length?'陪陪我的夥伴 →':'迎接第一位夥伴 →'}</button></div><PetHabitatScene pets={pets.length?[favorite]:[]} caption={pets.length?'一點陪伴，就是今天的小幸福':'一顆蛋，一段新友誼'}/></section>
        <section className="ps-today" data-testid="pet-care-center"><div className="ps-section-inline"><h3>今天，先做這件事</h3><button className="pet-link" onClick={()=>goTab('tasks')}>所有任務 →</button></div><div className="ps-today-grid"><button onClick={()=>ready.length?goTab('eggs'):claimable.length?goTab('tasks'):focus?visit(focus):goTab('eggs')}><span>{ready.length?'🥚':claimable.length?'✓':focus?petNeed(focus).icon:'🌱'}</span><div><b>{ready.length?'蛋可孵化':claimable.length?'任務可領':focus?'優先照顧':'認識第一位夥伴'}</b><p>{ready.length?`${ready.length} 顆蛋準備好和你見面`:claimable.length?`${claimable.length} 份學習獎勵等你領取`:focus?`${getDef(focus)?.name} · ${petNeed(focus).label}`:'免費領養，不需要先抽扭蛋'}</p></div><i>→</i></button><button onClick={()=>goTab('tasks')}><span>📖</span><div><b>學習，讓小家長大</b><p>累積金幣 · 蛋一起增加孵化進度</p></div><i>→</i></button></div></section>
        <div className="ps-section-inline"><SectionTitle eyebrow="有空的時候，一起玩" title="選一段今天的冒險"/><button className="pet-link" onClick={()=>goTab('activities')}>所有活動 →</button></div>{activities}
      </>}
      {tab==='activities'&&<><SectionTitle eyebrow="PLAY TOGETHER" title="今天想去哪裡？">先看玩法和時間，選一個剛好的活動。每款遊戲都有準備、進行與成果。</SectionTitle>{!pets.length&&<p className="ps-notice">先到孵化小屋迎接一位夥伴，就能一起出遊。<button className="pet-link" onClick={()=>goTab('eggs')}>去孵化小屋 →</button></p>}{activities}</>}
      {tab==='eggs'&&<>
        <SectionTitle eyebrow="NURSERY · 從遇見到陪伴" title="讓英文，暖暖這顆蛋">完成有獲得學習 XP 的活動，所有蛋一起增加 1 點進度。集滿後，自己按下孵化。</SectionTitle>
        <ol className="ps-steps"><li><span>01</span><b>領養或抽蛋</b><small>先把蛋帶回家</small></li><li><span>02</span><b>一起學英文</b><small>所有蛋一起成長</small></li><li><span>03</span><b>迎接新夥伴</b><small>集滿進度再孵化</small></li></ol>
        {!pets.length&&!eggs.length&&!starterClaimed&&<section className="ps-adoption"><div><span className="pet-eyebrow">第一份見面禮 · 免費</span><h3>想和誰成為朋友？</h3><p>選一顆領養蛋，附送 3 份蘋果。再完成 3 次學習就能孵化。</p></div><div className="ps-starters">{starters.map(def=><button key={def.id} aria-pressed={starter===def.id} onClick={()=>setStarter(def.id)}><PetCompanion petId={def.id} stage="baby" size={80} animate={false}/><b>{def.name}</b></button>)}</div><button className="pet-primary" onClick={adopt}>領養這位夥伴的蛋 →</button></section>}
        {eggs.length>0&&<div className="ps-egg-grid">{[...eggs].sort((a,b)=>Number((b.progress||0)>=EGG_HATCH_TASKS[b.rarity])-Number((a.progress||0)>=EGG_HATCH_TASKS[a.rarity])).map(egg=>{const def=getDef(egg);if(!def)return null;const needed=EGG_HATCH_TASKS[egg.rarity],done=(egg.progress||0)>=needed;return <article key={egg.id} className={`ps-egg ${done?'is-ready':''}`}><div className="ps-egg-top"><span className="ps-tag">{egg.starter?'領養蛋':RARITY_INFO[egg.rarity]?.label}</span><b>{done?'可以見面了':'正在成長'}</b></div><PetCompanion petId={egg.petId} stage="egg" size={105} animate={false}/><h3>{def.name} 蛋</h3><Meter label={`${def.name}孵化進度`} value={egg.progress||0} max={needed}/><p>{done?'學習的溫度夠了，來打個招呼吧。':`還需要 ${needed-(egg.progress||0)} 次學習進度`}</p>{egg.pendingDuplicateReward?.dupes>0&&<small>孵化時另有 {egg.pendingDuplicateReward.dupes} 份重複成長獎勵</small>}<button className={done?'pet-primary':'pet-secondary'} onClick={()=>done?hatch(egg):onNavigate?.('srs')}>{done?'🎉 可以孵化了！點我':'學單字，陪蛋長大 →'}</button></article>})}</div>}
        {!eggs.length&&(pets.length>0||starterClaimed)&&<div className="ps-empty"><h3>小屋裡暫時沒有蛋</h3><p>到扭蛋屋遇見新朋友，再一起學習孵化。</p></div>}
        <div className="ps-next"><div><b>想認識更多夥伴？</b><p>扭蛋使用學習金幣，每顆 50 金幣。抽取前可以查看完整機率。</p></div><button className="pet-secondary" onClick={()=>onNavigate?.('gacha')}>前往扭蛋屋 →</button></div>
      </>}
      {tab==='tasks'&&<><SectionTitle eyebrow="TODAY’S LITTLE STEPS" title="學一點，陪伴多一點">金幣可買食物或抽蛋；寵物 XP 送給目前最親密的夥伴。任務每天重新計算，進度不必連續完成。</SectionTitle><div className="ps-task-head"><span>{new Intl.DateTimeFormat('zh-TW',{month:'long',day:'numeric',weekday:'short'}).format(new Date())}</span><b>{claimedIds.length}/{DAILY_TASK_DEFS.length} 份已領取</b></div><div className="ps-task-list">{DAILY_TASK_DEFS.map(task=>{const done=(counts[task.statKey]||0)>=task.target,paid=claimedIds.includes(task.id),bonus=Math.max(0,...pets.map(p=>p.bond||0))>=150?1.2:1;return <article className={`ps-task ${paid?'is-claimed':''}`} key={task.id}><span className="ps-task-icon">{task.icon}</span><div><h3>{task.name}</h3><p>{task.id==='quiz_3'?'累計答對 3 題，不需要連續答對':task.desc}</p><Meter label={task.name} value={counts[task.statKey]||0} max={task.target}/><small>金幣 +{Math.floor(task.reward.coins*bonus)}{pets.length?` · 寵物 XP +${Math.floor(task.reward.exp*bonus)}`:' · 孵出夥伴後才有寵物 XP'}{bonus>1?'（含親密加成）':''}</small></div><button className={done&&!paid?'pet-primary':'pet-secondary'} disabled={paid} onClick={()=>done?claimTask(task):taskAction(task)}>{paid?'✓ 已領取':done?'🎁 領取':'前往完成 →'}</button></article>})}</div></>}
      {(tab==='pets'||tab==='dex')&&<><SectionTitle eyebrow={tab==='pets'?'OUR COMPANIONS':'COLLECTION JOURNAL'} title={tab==='pets'?'每一位，都是好朋友':'把相遇收藏起來'}>{tab==='pets'?'選一位夥伴照顧，看看今天需要什麼。':'已收集、孵化中、未遇見，各有自己的下一步。稀有度不限制參與活動。'}</SectionTitle><div className="ps-filters"><input aria-label="搜尋夥伴" placeholder="找夥伴的名字或英文單字…" value={query} onChange={e=>setQuery(e.target.value)}/>{tab==='dex'&&<select aria-label="收藏狀態" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">全部 {allDefs.length} 種</option><option value="owned">已收集 {pets.length} 種</option><option value="egg">孵化中</option><option value="missing">未遇見</option></select>}</div><div className="ps-friend-grid">{allDefs.filter(def=>{const owned=pets.some(p=>p.petId===def.id),egg=eggs.some(e=>e.petId===def.id);return (tab!=='pets'||owned)&&(filter==='all'||filter==='owned'&&owned||filter==='egg'&&!owned&&egg||filter==='missing'&&!owned&&!egg)&&[def.name,def.id,...def.words||[]].some(text=>text.toLowerCase().includes(query.toLowerCase().trim()))}).map(def=>{const pet=pets.find(p=>p.petId===def.id),egg=eggs.find(e=>e.petId===def.id);return <button className="ps-friend" key={def.id} data-pet-card="true" onClick={()=>pet?visit(pet):egg?goTab('eggs'):onNavigate?.('gacha')}><span className="ps-tag">{pet?'已收集':egg?'孵化中':'未遇見'} · {RARITY_INFO[def.rarity]?.label}</span><PetCompanion petId={def.id} stage={pet?(pet.level>=4?'adult':'baby'):egg?'egg':'baby'} size={92} animate={false}/><h3>{def.name}</h3><p>{pet?petNeed(pet).label:egg?'去孵化小屋看看':'到扭蛋屋查看相遇機率'}</p><b>{pet?`Lv.${pet.level||1} · 去陪伴 →`:egg?'查看進度 →':'認識新朋友 →'}</b></button>})}</div>{tab==='pets'&&!pets.length&&<div className="ps-empty"><h3>第一位夥伴正在等你</h3><p>到孵化小屋，從一顆蛋開始。</p><button className="pet-primary" onClick={()=>goTab('eggs')}>去孵化小屋 →</button></div>}{query&&<button className="pet-link" onClick={()=>setQuery('')}>清除搜尋</button>}</>}
    </>}
    {care&&<Dialog title={`${CARE_CHOICES.find(a=>a.id===care.action)?.name} · 說一句英文`} onClose={()=>{stopSpeech?.();setCare(null)}}><PetCompanion petId={selected?.petId} stage="baby" size={100} animate={false}/><p>聽一遍，再試著念給夥伴聽。不需要開啟麥克風。</p><blockquote>{care.prompt}</blockquote><button className="pet-secondary" onClick={()=>speak?.(care.prompt)}>♫ 聽聽怎麼念</button><p className="pet-note">{getPetJourney(selected).today.includes(care.action)?'今天這項成長獎勵已領取；餵食仍會使用 1 份食物。':'首次完成可得金幣 +5 與陪伴印記 +1。'}{care.action==='sleep'?'休息每天第一次恢復 25 體力，離線時也會慢慢恢復。':''}</p><div className="pet-button-row"><button className="pet-primary" data-testid="pet-action-complete" onClick={finishCare}>我念完了，完成陪伴 ✓</button><button className="pet-secondary" onClick={()=>{stopSpeech?.();setCare(null)}}>稍後再做</button></div></Dialog>}
    {hatched&&<Dialog title={hatched.owned?'夥伴收到成長能量':'你好，新夥伴！'} onClose={()=>{setHatched(null);setSelectedId(hatched.def.id)}}><PetCompanion petId={hatched.def.id} stage="baby" size={160} animate={false}/><h3>{hatched.def.name}</h3><p>{hatched.def.story}</p><p className="pet-note">{hatched.owned?'重複蛋已轉成成長獎勵，原有紀錄保留。':'已加入你的夥伴。先看看牠，再一起做件小事。'}</p><button className="pet-primary" data-hatch="true" onClick={()=>{setSelectedId(hatched.def.id);setHatched(null)}}>帶回小家，認識你 →</button></Dialog>}
  </div>;
}
