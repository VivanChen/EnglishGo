import { useEffect, useRef, useState } from 'react';
import ArcadeDiscovery from './ArcadeDiscovery.jsx';

const paths = {
  home: <><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></>,
  learn: <><rect x="5" y="3" width="15" height="18" rx="3"/><path d="M5 17h15M9 7h7M9 11h4M2 6v12"/></>,
  read: <><path d="M12 5C9 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-2-1-7-2-10 1Zm0 0v16"/></>,
  game: <><path d="M7 7h10c3 0 5 11 3 12-2 1-4-3-5-3H9c-1 0-3 4-5 3C2 18 4 7 7 7Z"/><path d="M8 9v5m-2-2h4m6-1h.01m2 2h.01M12 7V3"/></>,
  pet: <><ellipse cx="7" cy="6" rx="2" ry="3"/><ellipse cx="17" cy="6" rx="2" ry="3"/><ellipse cx="3" cy="12" rx="2" ry="2.5"/><ellipse cx="21" cy="12" rx="2" ry="2.5"/><path d="M6 19c-1-3 2-8 6-8s7 5 6 8c-1 4-4 1-6 1s-5 3-6-1Z"/></>,
  tools: <><path d="M12 3 3 7v6c0 4 5 7 9 9 4-2 9-5 9-9V7Z"/><path d="m8 12 3 3 5-6"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  sound: <><path d="M11 4 5 9H2v6h3l6 5ZM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></>,
  star: <path d="m12 2 3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
  motion: <><path d="M3 7h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 17h5"/></>,
};

export function LearningIcon({ name = 'learn', size = 22, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.learn}</svg>;
}

// A small, local vector companion: crisp at any size, with no remote asset dependency.
export function SproutFriend({ small = false }) {
  return <svg className={`eg-sprout ${small ? 'is-small' : ''}`} viewBox="0 0 340 270" fill="none" aria-hidden="true">
    <ellipse cx="170" cy="242" rx="106" ry="13" fill="#ADC4A4" opacity=".3"/>
    <g className="eg-sprout-wave"><path d="M248 153c33-39 51-20 29 7l-20 18" fill="#80B877" stroke="#437C50" strokeWidth="3"/></g>
    <path d="M99 157c-39-26-47-2-18 20l24 10" fill="#80B877" stroke="#437C50" strokeWidth="3"/>
    <path d="M129 220v20c0 11 30 9 32 0v-18m24-1v19c0 11 30 9 31-1v-20" fill="#599663" stroke="#437C50" strokeWidth="3"/>
    <path d="M174 65c-27-36-48-28-55-22-2 26 21 38 51 28" fill="#599663"/>
    <path d="M174 68c5-34 28-39 47-30 2 27-26 42-47 30" fill="#9CC779"/>
    <path d="M174 68v16" stroke="#437C50" strokeWidth="5" strokeLinecap="round"/>
    <rect x="90" y="77" width="168" height="158" rx="66" fill="#86B97B" stroke="#437C50" strokeWidth="3"/>
    <path d="M103 182c0-50 143-50 143 0v11c0 56-143 56-143 0Z" fill="#DCE9BD"/>
    <ellipse cx="139" cy="136" rx="7" ry="10" fill="#254A37"/><ellipse cx="209" cy="136" rx="7" ry="10" fill="#254A37"/>
    <circle cx="126" cy="154" r="12" fill="#F0ACA0" opacity=".85"/><circle cx="222" cy="154" r="12" fill="#F0ACA0" opacity=".85"/>
    <path d="M160 152q14 19 28 0" stroke="#254A37" strokeWidth="4" strokeLinecap="round"/>
    <path d="m126 185 48 10 48-10v42l-48 10-48-10Z" fill="#FFF8E9" stroke="#437C50" strokeWidth="3"/>
    <path d="M174 195v42m-36-37 24 5m-24 6 24 5m24-11 24-5m-24 16 24-5" stroke="#B1BA98" strokeWidth="3" strokeLinecap="round"/>
    <g fill="#E6B957"><path d="m64 82 4 10 11 4-11 4-4 11-4-11-11-4 11-4Z"/><path d="m286 58 3 7 8 3-8 3-3 8-3-8-8-3 8-3Z"/></g>
    <circle cx="57" cy="189" r="5" fill="#A8CBA5"/><circle cx="275" cy="211" r="4" fill="#E6B957"/>
  </svg>;
}

export function Brand({ onClick }) {
  const content = <><span className="eg-brand-mark"><LearningIcon name="read" size={24}/></span><span>EnglishGo<small>每天一點點，進步多一點</small></span></>;
  return onClick ? <button type="button" className="eg-brand" onClick={onClick} aria-label="回到學習首頁">{content}</button> : <div className="eg-brand">{content}</div>;
}

export function ComfortControls({ dark, setDark, calm, setCalm, quiet, setQuiet }) {
  return <div className="eg-comfort">
    <button type="button" className="eg-icon-control" onClick={()=>setQuiet(!quiet)} aria-pressed={quiet} aria-label={quiet?'開啟遊戲音效':'關閉遊戲音效'} title={quiet?'開啟遊戲音效':'關閉遊戲音效'}><LearningIcon name="sound"/>{quiet&&<span className="eg-muted-dot"/>}</button>
    <button type="button" className="eg-icon-control" onClick={()=>setCalm(!calm)} aria-pressed={calm} aria-label="減少動畫" title="減少動畫"><LearningIcon name="motion"/></button>
    <button type="button" className="eg-icon-control" onClick={()=>setDark(!dark)} aria-label={dark?'切換為淺色模式':'切換為深色模式'} title={dark?'白天模式':'夜晚模式'}><LearningIcon name="sun"/></button>
  </div>;
}

export function WelcomeScreen({ levels, counts, formatCount, onSelect, comfort, lastLevel }) {
  return <div className="eg-welcome">
    <a className="eg-skip" href="#choose-level">跳到學習階段</a>
    <header className="eg-welcome-top"><Brand/><ComfortControls {...comfort}/></header>
    <main className="eg-welcome-main">
      <section className="eg-welcome-hero">
        <div><span className="eg-eyebrow"><span className="eg-live-dot"/> 給每個好奇的小小學習家</span><h1>讓好奇心發芽，<br/>一起<span>玩出英文力。</span></h1><p>聽一聽、說一說，和小夥伴探索英文。<br/>從一個單字開始，每一小步都算數。</p><a href="#choose-level" className="eg-primary">開始我的學習旅程 <LearningIcon name="arrow" size={19}/></a><div className="eg-welcome-note">免費學習 <span>·</span> 沒有廣告 <span>·</span> 照自己的步調</div></div>
        <div className="eg-welcome-garden"><span className="eg-garden-tag tag-hello">Hello, little explorer!</span><SproutFriend/><span className="eg-garden-tag tag-grow"><LearningIcon name="star" size={17}/> 今天也長大了一點</span><span className="eg-garden-orbit"/></div>
      </section>
      <section id="choose-level" className="eg-level-section"><div className="eg-section-heading"><div><span className="eg-eyebrow">LET’S GET STARTED</span><h2>選一個適合你的起點</h2></div><p>之後隨時可以換，慢慢來就好。</p></div>
        <div className="eg-levels">{Object.entries(levels).map(([key,level],i)=><button className={`eg-level-choice tone-${i}`} type="button" onClick={()=>onSelect(key)} key={key}><span className="eg-level-symbol"><LearningIcon name={['learn','read','star'][i]} size={30}/></span><span className="eg-level-choice-title">{level.l}<small>{level.en}</small></span><p>{['從生活單字出發，快樂打好基礎','讀故事、練表達，一步步更有信心','拓展詞彙，探索更大的英文世界'][i]}</p><span className="eg-level-choice-bottom"><span className="eg-level-badge">{formatCount(counts?.[key],counts!==null)}</span><LearningIcon name="arrow" size={20}/></span>{lastLevel===key&&<span className="eg-last-level">上次的起點</span>}</button>)}</div>
      </section>
      <section className="eg-how"><div><span>01</span><h3>聽聽看，認識新單字</h3><p>有發音、有例句，不懂也沒關係。</p></div><div><span>02</span><h3>動動手，把英文玩起來</h3><p>配對、故事、歌曲，選你喜歡的方式。</p></div><div><span>03</span><h3>看看自己，又進步一點</h3><p>留下學習足跡，陪寵物一起長大。</p></div></section>
      <details className="eg-grownup"><summary><LearningIcon name="tools" size={20}/> 給家長與老師 <span>學習資源與進階設定</span></summary><p>基本單字、遊戲和內建內容可以直接開始。AI 與動圖屬於選用功能，可由大人協助設定。</p><div><a href="/learn/srs-method.html">單字記憶方法 ↗</a><a href="/learn/speaking-tips.html">口說練習指南 ↗</a><a href="/learn/api-keys.html">API Key 教學 ↗</a><a href="/learn/gif-guide.html">單字動圖效果 ↗</a></div></details>
    </main><footer className="eg-welcome-footer"><span>EnglishGo · 讓學習，成為每天的小美好。</span><small>GIFs powered by <b>GIPHY</b> · Natural narration by ElevenLabs</small></footer>
  </div>;
}

const modulePresentation = {
  srs:['learn','單字小花園','認識新朋友，把單字慢慢記起來。','約 5 分鐘'],
  exam:['learn','複習小幫手','把課本範圍變成自己的單字卡。','自訂範圍'],
  wordsearch:['learn','找找單字','輸入中文或英文，一起找答案。','隨時查詢'],
  quiz:['star','小小挑戰','選一選，看看記住了哪些單字。','選擇練習'],
  grammar:['learn','句型積木','用簡單的規則，把句子搭起來。','一步一步'],
  speak:['sound','勇敢說出口','先聽再說，每次開口都算進步。','需要麥克風'],
  ai:['star','問問小老師','有英文問題？讓小老師陪你想。','請大人設定'],
  translate:['read','句子的旅行','看看中英文，聽懂句子的意思。','每分鐘 1 次'],
  reading:['read','短文探險','讀一小篇，發現故事裡的線索。','讀一讀'],
  novels:['read','故事小森林','翻開故事，跟著角色去冒險。','有聲閱讀'],
  songs:['sound','音樂小舞台','跟著旋律，唱出喜歡的英文。','聽聽唱唱'],
  dictation:['sound','小耳朵練習','仔細聽一聽，再試著寫下來。','聽力練習'],
  story:['star','我的故事工坊','和小夥伴，一起創造新故事。','請大人設定'],
  whack:['game','聽音找字','聽清楚、找對字，幫地鼠種滿花園。','3 段關卡'],
  match:['game','配對翻牌','幫英文和中文找到彼此，點亮星座。','3 段關卡'],
  bomb:['game','拼字挑戰','解開字母謎題，讓火箭飛向下一站。','3 段關卡'],
  scramble:['learn','句子重組','排好單字車廂，讓英文小火車出發。','3 段關卡'],
  petMonopoly:['game','一起玩桌遊','走一格、學一點，和寵物逛世界。','自選遊戲'],
  gacha:['pet','迎接新夥伴','用學習累積的金幣，迎接寵物蛋。','50 金幣／次'],
  pets:['pet','我的小夥伴','照顧、陪伴，看著夥伴慢慢長大。','照顧與收藏'],
  petAdventure:['pet','夥伴出任務','帶上寵物，一起解開英文挑戰。','組隊冒險'],
  achievements:['star','成長收藏冊','每一個徽章，都是努力的紀念。','我的成就'],
  weak:['learn','再練一下就會了','把還不熟的單字，再認識一次。','溫柔複習'],
  dashboard:['star','我的成長足跡','看看每天累積了哪些小進步。','學習報告'],
  settings:['tools','家長與老師設定','設定 AI、動圖和進階學習工具。','大人協助'],
};

export function LearningDashboard({ c, lv, modules, groups, activeGroup, onGroupChange, onSelect, todayWord, onSpeak, daily, xp, coins, streak, pets, eggs, weakWords, onQuickStart, lastActivity, rewardContent, showRewards, setShowRewards, loginGift, claimGift }) {
  const [search,setSearch]=useState('');
  const [compact,setCompact]=useState(()=>window.matchMedia?.('(max-width: 860px)').matches||false);
  const panelRef=useRef(null),tabsRef=useRef(null),searchRef=useRef(null),scrollFrame=useRef(null);
  useEffect(()=>{
    const query=window.matchMedia?.('(max-width: 860px)');
    const update=()=>setCompact(query?.matches||false);
    update();query?.addEventListener('change',update);
    return()=>{query?.removeEventListener('change',update);if(scrollFrame.current!==null)cancelAnimationFrame(scrollFrame.current)};
  },[]);
  const target=Math.max(1,Number(daily.target)||10),done=Math.max(0,Number(daily.done)||0),pct=Math.min(100,Math.round(done/target*100));
  const visible=modules.filter(m=>(search.trim()?`${m.t} ${m.d} ${modulePresentation[m.id]?.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()):m.group===activeGroup));
  const group=groups.find(g=>g.id===activeGroup)||groups[0];
  const changeGroup=(id,focusPanel=false)=>{
    setSearch('');onGroupChange(id);
    if(scrollFrame.current!==null)cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current=requestAnimationFrame(()=>{panelRef.current?.scrollIntoView({behavior:'instant',block:'start'});if(focusPanel)panelRef.current?.focus({preventScroll:true})});
  };
  const clearSearch=()=>{setSearch('');searchRef.current?.focus()};
  const recent=lastActivity?.lv===lv?modules.find(m=>m.id===lastActivity.id):null;
  const friendlyGroups={learn:'學習小花園',read:'故事與音樂',game:'遊戲練習場',pet:'寵物小天地',tools:'我的工具箱'};
  return <div className="eg-hub">
    <aside className="eg-hub-sidebar"><div className="eg-sidebar-caption">我的學習世界</div>
      <div ref={tabsRef} className="eg-hub-tabs" role="tablist" aria-label="功能分類，五項皆可直接點選" aria-orientation={compact?"horizontal":"vertical"}>{groups.map((g,index)=><button key={g.id} id={`eg-tab-${g.id}`} role="tab" type="button" tabIndex={g.id===activeGroup?0:-1} aria-selected={g.id===activeGroup} aria-controls="eg-learning-panel" data-group-id={g.id} onClick={event=>changeGroup(g.id,event.detail>0)} onKeyDown={e=>{if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?groups.length-1:(index+(['ArrowDown','ArrowRight'].includes(e.key)?1:-1)+groups.length)%groups.length;changeGroup(groups[next].id);document.getElementById(`eg-tab-${groups[next].id}`)?.focus()}}} className={g.id===activeGroup?'is-active':''}><LearningIcon name={g.id}/><span>{g.t}<small>{friendlyGroups[g.id]}</small></span>{g.id===activeGroup&&<span className="eg-tab-dot"/>}</button>)}</div>
      <div className="eg-sidebar-note"><SproutFriend small/><b>不用一次學會全部。</b><p>今天的一小步，<br/>就是很棒的開始！</p></div><span className="eg-category-note">5 項都可直接點選</span>
    </aside>
    <div className="eg-hub-main">
      <div className="eg-hub-heading"><div><span className="eg-eyebrow">MY LEARNING GARDEN</span><h1>嗨，小小探索家 <span className="eg-hello">✦</span></h1><p>今天想發現什麼呢？一起慢慢來。</p></div><span className="eg-grade-pill">{c.ic} {c.l}學習</span></div>
      <div className="eg-hub-overview"><section className="eg-mission" aria-label="今天的小任務"><div><span className="eg-mission-label"><LearningIcon name="star" size={17}/> 今天的小任務</span><h2>{pct>=100?<>今天的努力，<br/>已經開花了！</>:<>每天一點點，<br/>英文長大一點點。</>}</h2><p>{pct>=100?'可以休息一下，也可以自由探索。':'先認識 5 個單字，給好奇心澆澆水。'}</p><button type="button" className="eg-primary" onClick={pct>=100?()=>{changeGroup('read');document.getElementById('eg-learning-panel')?.scrollIntoView({behavior:'auto',block:'start'})}:onQuickStart}>{pct>=100?'探索故事與音樂':'開始 5 張單字小任務'}<LearningIcon name="arrow" size={18}/></button><span className="eg-mission-foot">{pct>=100?'每一份努力，都值得被記住。':'約 3–5 分鐘 · 可以隨時休息'}</span></div><div className="eg-mission-friend"><span>Hello!</span><SproutFriend/></div></section>
        <section className="eg-today"><div className="eg-today-heading"><b>我的小進步</b><LearningIcon name="star" size={20}/></div><div className="eg-daily-ring" style={{'--daily-progress':`${pct}%`}} role="progressbar" aria-label="今日學習進度" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(done,target)}><div><strong>{Math.min(done,target)}<small> / {target}</small></strong><span>今日練習</span></div></div><p>{done===0?'準備好了就出發吧！':pct>=100?'今天的目標完成了！':'每次練習，都在慢慢進步。'}</p><div className="eg-today-stats"><span><b>{streak}</b> 天連續學習</span><span><b>{xp}</b> <span className="eg-menu-stat-label">XP</span></span></div></section></div>
      {loginGift&&<div className="eg-gift-inline" role="status"><span>🎁 歡迎回來！有一份小禮物等你領取。</span><button type="button" onClick={claimGift}>領取獎勵</button></div>}
      <div className="eg-discovery-row"><section className="eg-word-discovery"><span className="eg-word-icon"><LearningIcon name="learn" size={25}/></span><div><span className="eg-small-label">每天認識一個新朋友</span><div className="eg-word-inline"><strong>{todayWord.w}</strong><span>{todayWord.m}</span></div></div><button type="button" className="eg-icon-control" onClick={onSpeak} aria-label="朗讀今日單字"><LearningIcon name="sound"/></button></section><button type="button" className="eg-companion-link" onClick={()=>onSelect('pets','pet')}><span className="eg-companion-icon"><LearningIcon name="pet" size={25}/></span><span><b>和小夥伴打聲招呼</b><small>{pets.length?`${pets.length} 隻寵物等你來陪伴`:eggs.length?`${eggs.length} 顆蛋，等著和你一起成長`:'認識陪你一起學英文的朋友'}</small></span><LearningIcon name="arrow" size={18}/></button></div>
      <section id="eg-learning-panel" ref={panelRef} tabIndex={-1} className="eg-learning-panel" role="tabpanel" aria-labelledby={`eg-tab-${activeGroup}`}><button type="button" className="eg-category-return" onClick={()=>{tabsRef.current?.scrollIntoView({behavior:'instant',block:'start'});document.getElementById(`eg-tab-${activeGroup}`)?.focus({preventScroll:true})}}>↑ 換個分類</button><div className="eg-section-heading"><div><h2>{search?'找到的學習活動':friendlyGroups[activeGroup]}</h2><p>{search?'選一個喜歡的，開始探索。':group.d+'，選自己喜歡的方式。'}</p></div><label className="eg-activity-search"><span aria-hidden="true">⌕</span><input ref={searchRef} aria-label="尋找學習活動" placeholder="找找想學的…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" onClick={clearSearch} aria-label="清除活動搜尋">×</button>}</label></div>
        {search.trim()&&<p className="eg-search-count" role="status">找到 {visible.length} 個學習活動</p>}
        {recent&&!search&&<button type="button" className="eg-recent" onClick={()=>onSelect(recent.id,recent.group)}>上次探索：{recent.t}<span>再去看看 →</span></button>}
        {activeGroup==='game'&&!search.trim()?<ArcadeDiscovery lv={lv} onSelect={onSelect}/>:<div className="eg-activities">{visible.map(m=>{const [icon,title,desc,tag]=modulePresentation[m.id]||['learn',m.t,m.d,m.tag];return <button key={m.id} type="button" className={`eg-activity eg-menu-module activity-${m.group}`} data-module-id={m.id} onClick={()=>onSelect(m.id,m.group)}><span className="eg-activity-top"><span className="eg-activity-icon"><LearningIcon name={icon} size={26}/></span><span className="eg-activity-tag">{tag}</span></span><h3>{m.t}</h3><span className="eg-activity-nickname">{title}</span><p>{desc}</p><span className="eg-activity-bottom"><span>{m.id==='srs'?m.d:'一起試試看'}</span><LearningIcon name="arrow" size={18}/></span></button>})}</div>}
        {!visible.length&&<div className="eg-empty"><LearningIcon name="learn" size={34}/><h3>還沒找到這個活動</h3><p>試試「單字」、「故事」或「歌曲」。</p><button type="button" className="eg-secondary" onClick={clearSearch}>看看全部活動</button></div>}
      </section>
      <div className="eg-hub-bottom"><span>🌱 {weakWords.length?`${weakWords.length} 個單字還在發芽，慢慢複習就好。`:'每個人的步調都不一樣，找到你的就好。'}</span><div><button type="button" className="eg-menu-stat" onClick={()=>setShowRewards(!showRewards)} aria-expanded={showRewards} aria-controls="eg-menu-reward-center"><span className="eg-menu-stat-label">金幣</span> {coins}</button><button type="button" className="eg-menu-stat" onClick={()=>onSelect('pets','pet')}><span className="eg-menu-stat-label">寵物</span> {pets.length}</button>{weakWords.length>0&&<button type="button" onClick={()=>onSelect('weak','tools')}>再練一次 →</button>}</div></div>
      {rewardContent}
    </div>
  </div>;
}
