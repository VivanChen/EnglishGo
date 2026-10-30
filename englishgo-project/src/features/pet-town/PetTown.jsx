import { useEffect, useRef, useState } from 'react';
import TownScene, { PetPortrait } from './TownScene.jsx';
import { PETS, FURNITURE, REGIONS, CHAPTERS } from './worldData.js';
import { getPetStage } from './worldState.js';
import { hashPin, legacyPinHash, requestPetAccount } from './cloudAccount.js';
import useTownWorld from './useTownWorld.js';
import { createTownAmbience } from './townAmbience.js';
import './pet-town.css';
import FurnishingArt from './FurnishingArt.jsx';
import { getEnvironmentInteraction } from './environmentInteractions.js';

const LEVELS = { elementary: '國小', junior: '國中', senior: '高中' };
import CareInteraction, { CARE, careStage } from './CareInteraction.jsx';

const STATUS = { local: '已存本機', loading: '讀取雲端中', pending: '已存本機・等待同步', syncing: '同步中', synced: '已同步', error: '待重試' };

export function TownIcon({ name, size = 20, ...props }) {
  const paths = {
    home: <><path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-7h6v7"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/></>,
    decor: <><path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3M5 17v3m14-3v3"/><rect x="2" y="10" width="20" height="7" rx="2"/><path d="M6 10v4h12v-4"/></>,
    paw: <><ellipse cx="8" cy="6" rx="2" ry="3"/><ellipse cx="16" cy="6" rx="2" ry="3"/><ellipse cx="3" cy="12" rx="2" ry="2.5"/><ellipse cx="21" cy="12" rx="2" ry="2.5"/><path d="M6 20c-4-4 3-10 6-10s10 6 6 10c-2 2-4-1-6-1s-4 3-6 1Z"/></>,
    heart: <path d="M20 5c-3-3-7-1-8 2-1-3-5-5-8-2-5 5 3 11 8 15 5-4 13-10 8-15Z"/>,
    bowl: <><path d="M3 11h18c-1 6-4 9-9 9s-8-3-9-9ZM6 6h.01M12 4v3M18 6h.01"/></>,
    drop: <path d="M12 2C8 8 4 11 4 15a8 8 0 0 0 16 0c0-4-4-7-8-13ZM8 15c0 2 1 3 3 3"/>,
    ball: <><circle cx="12" cy="12" r="9"/><path d="M4 7c6 0 8 7 5 13m6-16c-3 5 0 11 6 12"/></>,
    moon: <path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    back: <path d="M20 12H4m6-6-6 6 6 6"/>,
    sound: <><path d="M11 4 5 9H2v6h3l6 5ZM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 4 2 2v4l4 3 3-1 3 1 4-3v-4l2-2-2-4-3-1-1-3Z"/></>,
    book: <><path d="M12 5C8 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-2-1-7-2-10 1Zm0 0v16"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    coin: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M12 8v8"/></>,
    leaf: <><path d="M20 3C5 1 1 10 7 17S23 15 20 3ZM4 21 16 8"/></>,
  };
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.paw}</svg>;
}
function Dialog({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => { const focus = document.activeElement; ref.current?.showModal?.(); return () => { ref.current?.close?.(); focus?.focus?.(); }; }, []);
  return <dialog ref={ref} className="town-dialog" aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }}><div className="town-dialog-heading"><h2>{title}</h2><button className="town-icon-button" aria-label="關閉" onClick={onClose}><TownIcon name="close"/></button></div>{children}</dialog>;
}
function Meter({ label, value, icon }) {
  return <div className="town-meter"><span><TownIcon name={icon} size={16}/>{label}</span><div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value ?? 80)}><i style={{ width: `${Math.max(0, Math.min(100, value ?? 80))}%` }}/></div><small>{Math.round(value ?? 80)}</small></div>;
}
export default function PetTown({ lv = 'elementary', onBack, onNavigate, coins = 0, setCoins, petAccount, setPetAccount, speak, stopSpeech, onXp, quiet = false, calm = false }) {
  const { world, dispatch, status, notice, setNotice, connect, logout, retrySync } = useTownWorld({ coins, setCoins, account: petAccount, setAccount: setPetAccount, onChapterComplete: () => onXp?.(15) });
  const [tab, setTab] = useState('home'), [preview, setPreview] = useState(PETS[0].id), [care, setCare] = useState(null), [activity, setActivity] = useState(null);
  const [chapterId, setChapterId] = useState(null), [level, setLevel] = useState(lv), [feedback, setFeedback] = useState(null), [showTranslation, setShowTranslation] = useState(false);
  const [modal, setModal] = useState(null), [decorFilter, setDecorFilter] = useState('all'), [draft, setDraft] = useState(null), [renderer, setRenderer] = useState('loading');
  const [authMode, setAuthMode] = useState('login'), [username, setUsername] = useState(''), [pin, setPin] = useState(''), [authBusy, setAuthBusy] = useState(false), [authError, setAuthError] = useState(''), [authConflict, setAuthConflict] = useState(null);
  const authRequest = useRef(0), careLock = useRef(false), ambience = useRef(null);
  const [soundPlaying,setSoundPlaying] = useState(false);
  const pets = world.ownedPets || [], selected = pets.find(p => p.id === world.activePetId) || pets[0];
  const def = PETS.find(p => p.id === (selected?.speciesId || preview)) || PETS[0];
  const stage = selected ? getPetStage(selected) : null;
  const chapter = CHAPTERS.find(c => c.id === chapterId), chapterText = chapter?.levels[level];
  const progress = chapter ? world.chapterProgress[`${chapter.id}:${level}`] : null;
  const step = progress?.step || 0, challenge = chapterText?.challenges[step];
  const completed = world.completedChapters || [], nextChapter = CHAPTERS.find(c => !completed.includes(c.id));
  const availableFriends = PETS.filter(p => !pets.some(owned => owned.speciesId === p.id));
  const canAdopt = pets.length > 0 && pets.length < Math.min(3, 1 + (completed.length >= 3 ? 1 : 0) + (completed.length >= 6 ? 1 : 0));
  const displayPets = pets.length ? pets : [{ id: 'preview', speciesId: preview, exp: 0, bond: 0 }];
  const placements = draft ? [...world.placements.filter(p => p.id !== draft.id), draft] : world.placements;
  const changeTab = id => { setTab(id); setChapterId(null); setFeedback(null); careRef.current = null; setCare(null); setActivity(null); setDraft(null); stopSpeech?.(); };
  useEffect(() => { setLevel(lv); }, [lv]);
  useEffect(() => () => { authRequest.current++; stopSpeech?.(); }, []);
  useEffect(() => () => ambience.current?.dispose(), []);
  useEffect(() => { if (quiet) { ambience.current?.pause(); setSoundPlaying(false); } }, [quiet]);
  useEffect(() => { const hide = () => { if(document.hidden) { ambience.current?.pause(); setSoundPlaying(false); } }; document.addEventListener('visibilitychange',hide); return () => document.removeEventListener('visibilitychange',hide); }, []);
  const toggleSound = async () => {
    if(soundPlaying) { ambience.current?.pause(); setSoundPlaying(false); dispatch({type:'SETTINGS',patch:{sound:false}}); return; }
    if(quiet) { setNotice('先開啟頁首的遊戲音效，再聽聽小島的海浪。'); return; }
    ambience.current ||= createTownAmbience();
    try { const playing=await ambience.current.start(); setSoundPlaying(playing); dispatch({type:'SETTINGS',patch:{sound:playing}}); if(!playing)setNotice('這個瀏覽器暫時無法播放環境音。'); } catch { setNotice('環境音暫時無法播放，其他功能仍可使用。'); }
  };
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6500); return () => clearTimeout(timer); }, [notice, setNotice]);

  const careRef = useRef(null), careNonce = useRef(0), careAim = useRef({ x: .5, y: .55 });
  const [moment, setMoment] = useState(null), [environment, setEnvironment] = useState(null);
  const environmentItems = world.placements.map(getEnvironmentInteraction).filter(Boolean);
  const sleeping = !care && activity?.resting && activity.petId === selected?.id;
  useEffect(() => { if (!moment) return; const timer = setTimeout(() => setMoment(null), 6000); return () => clearTimeout(timer); }, [moment]);
  useEffect(() => { setMoment(null); setEnvironment(null); }, [selected?.id, tab]);
  const companionAction = type => {
    if (!selected || careRef.current) return;
    setEnvironment(null); setActivity({ type, petId: selected.id, nonce: ++careNonce.current });
    setMoment({ text: type === 'come' ? `${def.name}聽見你了！想和你再靠近一點。` : '伸個懶腰，今天還有好多事想和你一起做。' });
  };
  const visitEnvironment = id => {
    if (!selected || careRef.current || tab !== 'home') return;
    const interaction = environmentItems.find(item => item.placement.id === id);
    if (!interaction) return;
    setEnvironment({ id, phase: 'walking' });
    setMoment({ text: `${def.name}想去${interaction.item.name}旁看看。` });
    setActivity({ type: 'environment', placementId: id, petId: selected.id, nonce: ++careNonce.current });
    requestAnimationFrame(() => document.querySelector('.town-scene-wrap')?.scrollIntoView?.({ block: 'center', behavior: calm ? 'instant' : 'smooth' }));
  };
  const environmentEvent = event => {
    if (event.petId !== selected?.id || tab !== 'home' || careRef.current) return;
    if (event.phase === 'arrived') { setEnvironment({ id: event.placementId, phase: 'interacting' }); setMoment({ text: `${def.name}${event.text}` }); }
    else if (event.phase === 'blocked') { setEnvironment(null); setActivity(null); setMoment({ text: '這裡暫時走不過去，試著在布置裡挪出一點空間。' }); }
    else if (event.phase === 'finished') { setEnvironment(null); setActivity(null); }
  };
  const stopEnvironment = () => { setEnvironment(null); setMoment(null); setActivity(null); };
  const needs = selected ? [
    { value: selected.hunger, type: 'feed', text: '肚子有一點空空的，一起吃點心吧。', label: '準備點心' },
    { value: selected.clean, type: 'wash', text: '玩了一整天，想洗個舒服的澡。', label: '一起洗澡' },
    { value: selected.energy, type: 'sleep', text: '有一點睏了，想靠著你休息。', label: '陪牠休息' },
  ].filter(n => n.value < 75).sort((a,b) => a.value - b.value)[0] : null;
  useEffect(() => { if ((careRef.current && careRef.current.petId !== selected?.id) || (activity?.petId && activity.petId !== selected?.id)) { careRef.current = null; setCare(null); setActivity(null); } }, [selected?.id]);
  const cancelCare = () => { careRef.current = null; setCare(null); setActivity(null); };
  const startCare = type => {
    if (!selected) return;
    careLock.current = false; setMoment(null); setEnvironment(null); careAim.current = { x: .5, y: .55 };
    const next = { type, step: 0, count: 0, petId: selected.id };
    careRef.current = next; setCare(next);
    setActivity({ ...next, phase: careStage(next).animation, sustained: true, nonce: ++careNonce.current });
    requestAnimationFrame(() => document.querySelector('.town-care-surface')?.scrollIntoView?.({ block: 'center', behavior: calm ? 'instant' : 'smooth' }));
  };
  const advanceCare = point => {
    const current = careRef.current;
    if (!current || careLock.current || current.petId !== selected?.id) return;
    const rule = CARE.find(c => c.id === current.type), stage = careStage(current);
    const count = current.count + 1, done = count >= stage.hits;
    const final = done && current.step + 1 >= rule.stages.length;
    setActivity({ type: current.type, petId: current.petId, phase: final ? rule.finish : stage.animation,
      progress: count / stage.hits, point, sustained: !final, resting: final && current.type === 'sleep', nonce: ++careNonce.current });
    if (final) {
      careLock.current = true; careRef.current = null;
      dispatch({ type: 'CARE', careType: current.type, petId: current.petId }); setCare(null); setMoment({ text: `${def.name}：${rule.reply}` });
    } else {
      const next = { ...current, count: done ? 0 : count, step: current.step + (done ? 1 : 0) };
      careRef.current = next; setCare(next);
    }
  };
  const openChapter = item => { if (completed.includes(item.id) && world.chapterProgress[`${item.id}:${level}`]?.settled) dispatch({ type: 'REPLAY_CHAPTER', chapterId: item.id, level }); setChapterId(item.id); setFeedback(null); setShowTranslation(false); setActivity({ type: 'curious', petId: selected.id, nonce: Date.now() }); stopSpeech?.(); };
  const changeStoryLevel = next => { if (chapter && completed.includes(chapter.id) && world.chapterProgress[`${chapter.id}:${next}`]?.settled) dispatch({type:'REPLAY_CHAPTER',chapterId:chapter.id,level:next}); setLevel(next); setFeedback(null); stopSpeech?.(); };
  const answer = index => {
    if (feedback?.correct) return;
    const correct = index === challenge.answer;
    dispatch({ type: 'STORY_PROGRESS', chapterId, level, step, answer: index });
    setFeedback({ correct, index, challenge });
    setActivity({ type: correct ? 'happy' : 'curious', petId: selected.id, nonce: Date.now() });
  };
  const finishChapter = () => {
    dispatch({ type: 'COMPLETE_CHAPTER', chapterId, level });
    setChapterId(null); setFeedback(null); setActivity({ type: 'happy', petId: selected.id, nonce: Date.now() });
  };
  const login = async () => {
    if (authBusy || !username.trim() || !/^\d{4,6}$/.test(pin)) { setAuthError('請輸入暱稱與 4–6 位數字 PIN。'); return; }
    const request = ++authRequest.current; setAuthBusy(true); setAuthError('');
    try {
      let credentials = { username: username.trim(), pinHash: await hashPin(pin) };
      if (request !== authRequest.current) return;
      let response = await requestPetAccount(authMode, { credentials, ...(authMode === 'signup' ? { snapshot: { worldState: world, coins } } : {}) });
      if (request !== authRequest.current) return;
      // Older browsers created numeric hashes; only an explicit failed login
      // tries that existing credential format. New accounts always use SHA-256.
      if (authMode === 'login' && response.code === 'unauthorized') {
        const legacyCredentials = { ...credentials, pinHash: legacyPinHash(pin) };
        response = await requestPetAccount('login', { credentials: legacyCredentials });
        if (response.ok) credentials = legacyCredentials;
      }
      if (request !== authRequest.current) return;
      if (!response.ok) { setAuthError(response.error); return; }
      if (authMode === 'login' && pets.length && response.snapshot?.worldState?.ownedPets?.length) setAuthConflict({ credentials, response });
      else { connect(credentials, response, authMode === 'signup' || !response.snapshot?.worldState); setModal(null); setPin(''); }
    } catch { if (request === authRequest.current) setAuthError('暫時無法連線，請稍後再試。'); }
    finally { if (request === authRequest.current) setAuthBusy(false); }
  };
  const closeModal = () => { authRequest.current++; setAuthBusy(false); setModal(null); setAuthConflict(null); setPin(''); };
  const chapterRegion = chapter ? REGIONS.find(r => r.id === chapter.regionId) : null;
  const chapterReady = item => item.order <= 1 || completed.includes(CHAPTERS.find(c => c.order === item.order - 1)?.id);

  return <section className="pet-town" data-testid="pet-town" data-town-tab={tab}>
    <header className="town-header"><button className="town-back" onClick={onBack}><TownIcon name="back" size={17}/><span>學習首頁</span></button><div className="town-wordmark"><span className="town-wordmark-icon"><TownIcon name="paw" size={22}/></span><span>SEABREEZE<small>海 風 小 鎮</small></span></div><div className="town-header-tools"><span className="town-wallet" aria-label={`${coins} 金幣`}><TownIcon name="coin" size={17}/>{coins.toLocaleString()}</span><button className="town-icon-button" aria-label="小鎮設定" onClick={() => setModal('settings')}><TownIcon name="settings"/></button></div></header>
    <div className="town-intro"><div><span className="town-eyebrow">A LITTLE ISLAND. A BIG FRIENDSHIP.</span><h1>{chapter ? chapter.title : tab === 'explore' ? '故事，從下一個轉角開始。' : tab === 'decorate' ? '把喜歡的日子，布置成家。' : tab === 'companions' ? '三種個性，一樣喜歡你。' : pets.length ? '海風剛好，今天也有你。' : '你的小島，正等著第一位朋友。'}</h1><p>{chapter ? chapter.enTitle : '陪牠慢慢長大，和牠一起發現英文裡的小世界。'}</p></div><button className={`town-save-state ${status === 'error' ? 'is-error' : ''}`} onClick={() => status === 'error' ? retrySync() : setModal('account')}><span/>{STATUS[status]}</button></div>
    {notice && <div className="town-toast" role="status"><TownIcon name="check" size={18}/><span>{notice}</span><button aria-label="關閉通知" onClick={() => setNotice('')}><TownIcon name="close" size={16}/></button></div>}
    <nav className="town-tabs" aria-label="海風小鎮導覽">{[['home','home','家園'],['explore','compass','出遊'],['decorate','decor','布置'],['companions','paw','夥伴']].map(([id,icon,label]) => <button key={id} aria-current={tab === id ? 'page' : undefined} disabled={!pets.length && id !== 'home'} onClick={() => changeTab(id)}><TownIcon name={icon}/><span>{label}</span>{id === 'companions' && canAdopt && <i/>}</button>)}</nav>
    {(tab === 'home' || tab === 'decorate' || chapter) && <div className={`town-live-layout ${chapter ? 'is-story' : ''}`}>
      <div className="town-scene-wrap"><TownScene pets={displayPets} activePetId={selected?.id || 'preview'} placements={placements} activity={activity} careAim={careAim} environmentEnabled={tab === 'home' && !!selected} onEnvironment={environmentEvent} onMove={() => { setEnvironment(null); setMoment(null); setActivity(null); }} motion={!calm && world.settings.motion} quality={world.settings.quality} scene={chapter?.regionId || 'home'} storyMoment={chapter ? { chapterId, step, complete: step >= 2 } : null} onPet={id => { if (careRef.current || tab !== 'home') return; if(id && id !== selected?.id) { dispatch({type: 'SELECT_PET',petId:id}); cancelCare(); return; } sleeping ? companionAction('wake') : startCare('pet'); }} onStatus={setRenderer} onPlacementSelect={id => tab === 'decorate' ? setDraft(world.placements.find(p => p.id === id)) : visitEnvironment(id)}/>{care && <CareInteraction care={care} name={def.name} onInteract={advanceCare} onAim={point => { careAim.current = point; }} onCancel={cancelCare} motion={!calm && world.settings.motion}/>}{!care && tab === 'home' && (sleeping || moment) && <div className={`town-companion-bubble ${sleeping ? 'is-sleeping' : ''}`} role="status"><TownIcon name={sleeping ? 'moon' : 'heart'} size={20}/><span>{sleeping ? `${def.name}睡著了，陪牠安靜待一會兒。` : moment.text}</span>{sleeping && <button className="town-text-button" onClick={() => companionAction('wake')}>輕輕叫醒</button>}</div>}<div className="town-scene-label"><span className="town-live-dot"/><b>{chapterRegion?.name || '海邊小屋'}</b><span className="town-scene-caption">{chapter ? '故事進行中' : 'HOME SWEET HOME'}</span></div><div className="town-scene-bottom"><span><TownIcon name="sun" size={16}/>{chapter ? `第 ${chapter.order} 章 · ${LEVELS[level]}` : '慢慢來，這裡沒有倒數計時。'}</span><small>{renderer === 'fallback' ? '輕量模式・所有操作仍可使用' : '點地面散步 · 點家具互動 · 拖曳轉動'}</small></div></div>
      <aside className="town-side-panel">
        {!pets.length ? <><span className="town-eyebrow">OUR FIRST HELLO</span><h2>你好，我們可以當朋友嗎？</h2><p className="town-muted">選一位一起搬進小屋。旅途中，另外兩位也會來到你身邊。</p><div className="town-starter-list">{PETS.map(p => <button key={p.id} aria-pressed={preview === p.id} onClick={() => setPreview(p.id)}><PetPortrait speciesId={p.id} size={64}/><span><strong>{p.name}</strong><small>{p.trait}</small></span><span className="town-choice-circle">{preview === p.id && <TownIcon name="check" size={14}/>}</span></button>)}</div><button className="town-primary" onClick={() => dispatch({ type: 'ADOPT_STARTER', speciesId: preview })}>和{def.name}一起回家<TownIcon name="arrow" size={18}/></button><small className="town-footnote">免費領養 · 可以隨時照顧 · 沒有抽取機率</small></>
        : chapter ? <>
          <div className="town-story-kicker"><span>{chapterRegion?.name}</span><label>英文程度<select aria-label="故事英文程度" value={level} onChange={e => changeStoryLevel(e.target.value)}>{Object.entries(LEVELS).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label></div>
          <div className="town-story-steps">{[0,1].map(n => <i key={n} className={step > n ? 'is-complete' : ''}/>)}<small>{Math.min(step,2)} / 2</small></div>
          {feedback?.correct ? <div className="town-story-feedback is-correct"><span className="town-round-icon"><TownIcon name="check" size={25}/></span><h2>小島有了新的變化。</h2><p>{feedback.challenge.explanation?.en}</p><p className="town-muted">{feedback.challenge.explanation?.zh}</p><button className="town-primary" onClick={() => setFeedback(null)}>{step >= 2 ? '看看這段旅程的收穫' : '繼續往前走'}<TownIcon name="arrow" size={18}/></button></div>
          : step >= 2 ? <div className="town-story-complete"><span className="town-eyebrow">A MEMORY TO KEEP</span><h2>又多了一段一起的回憶。</h2><PetPortrait speciesId={selected.speciesId} size={120}/><p>{chapterText?.outro?.zh || chapter.summary}</p><div className="town-reward-note">{completed.includes(chapterId) ? '不重複領家具；每日首次重溫，夥伴可以再累積 10 XP。' : '學習 XP +15 · 金幣 +5 · 夥伴成長與紀念家具'}</div><button className="town-primary" onClick={finishChapter}>完成旅程，收進回憶<TownIcon name="check" size={18}/></button></div>
          : <><p className="town-story-intro">{typeof chapterText?.intro === 'string' ? chapterText.intro : chapterText?.intro?.en || chapter.summary}</p><button className="town-text-button town-listen-story" onClick={() => speak?.(chapterText?.intro?.en)}><TownIcon name="sound" size={16}/>聽這段故事</button><span className="town-eyebrow">{step === 0 ? '01 · LOOK & DISCOVER' : '02 · LISTEN & HELP'}</span><h2 className="town-challenge-prompt">{challenge?.prompt}</h2><div className="town-story-tools"><button className="town-text-button" onClick={() => speak?.(challenge.prompt)}><TownIcon name="sound" size={16}/>聽一聽</button><button className="town-text-button" onClick={() => setShowTranslation(!showTranslation)}>{showTranslation ? '收起中文提示' : '看看中文提示'}</button></div>{showTranslation && <p className="town-translation">{chapterText?.intro?.zh}<br/>{challenge?.zh}</p>}<div className="town-answer-options">{challenge?.options.map((option,index) => <button key={`${chapterId}-${step}-${index}`} onClick={() => answer(index)}><span>{String.fromCharCode(65 + index)}</span><div><strong>{option.en}</strong>{showTranslation && <small>{option.zh}</small>}</div><TownIcon name="arrow" size={16}/></button>)}</div>{feedback && !feedback.correct && <p className="town-gentle-feedback" role="status">再看看線索，{feedback.challenge.explanation?.zh || '不用急，可以再試一次。'}</p>}</>}
          <button className="town-text-button town-story-leave" onClick={() => { setChapterId(null); setFeedback(null); stopSpeech?.(); }}>先回地圖，進度會保留</button>
        </> : tab === 'decorate' ? <><span className="town-eyebrow">MAKE YOURSELF AT HOME</span><h2>{draft ? '找到剛剛好的位置' : '留一個你喜歡的角落'}</h2><p className="town-muted">從下方選家具，再調整位置。步道會保持暢通，讓夥伴自在走動。</p>{draft ? <><div className="town-draft-card"><FurnishingArt item={FURNITURE.find(f => f.id === draft.itemId) || {}}/><strong>{FURNITURE.find(f => f.id === draft.itemId)?.name}</strong></div><label className="town-slider">左右位置<input aria-label="家具左右位置" type="range" min="-3.5" max="3.5" step="0.5" value={draft.x} onChange={e => setDraft({ ...draft, x: +e.target.value })}/></label><label className="town-slider">前後位置<input aria-label="家具前後位置" type="range" min="-1.5" max="3.5" step="0.5" value={draft.z} onChange={e => setDraft({ ...draft, z: +e.target.value })}/></label><button className="town-secondary" onClick={() => setDraft({ ...draft, rotation: (draft.rotation + Math.PI / 2) % (Math.PI * 2) })}>旋轉 90°</button><button className="town-primary" onClick={() => { const result = dispatch({ type: 'PLACE_DECOR', placement: draft }); if (result.world !== world) setDraft(null); }}>確認放置<TownIcon name="check" size={18}/></button><div className="town-inline-actions"><button className="town-text-button" onClick={() => setDraft(null)}>取消調整</button>{world.placements.some(p => p.id === draft.id) && <button className="town-text-button" onClick={() => { dispatch({ type: 'REMOVE_DECOR', placementId: draft.id }); setDraft(null); }}>收回倉庫</button>}</div></> : <div className="town-decor-help"><TownIcon name="decor" size={40}/><strong>{world.placements.length} 件家具，正在陪你生活</strong><span>點選場景裡的家具，也能重新擺放。</span></div>}</>
        : <><div className="town-companion-heading"><div><span className="town-eyebrow">YOUR LITTLE COMPANION</span><h2>{def.name}<span>{def.enName}</span></h2></div><PetPortrait speciesId={def.id} size={80}/></div><p className="town-character-trait">{def.trait} <span>·</span> {stage?.label || '幼年夥伴'}</p><div className="town-meters"><Meter label="飽足" value={selected.hunger} icon="bowl"/><Meter label="清爽" value={selected.clean} icon="drop"/><Meter label="精神" value={selected.energy} icon="sun"/></div>{care ? <div className="town-care-session"><span className="town-eyebrow">A LITTLE MOMENT TOGETHER</span><h3>{CARE.find(c => c.id === care.type).text}</h3><div className="town-care-dots">{CARE.find(c => c.id === care.type).stages.map((_,i) => <i key={i} className={i <= care.step ? 'is-active' : ''}/>)}</div><p className="town-muted">{careStage(care).hint}。也可以使用下方按鈕或鍵盤，慢慢完成。</p><button className="town-primary" aria-label={careStage(care).label} onClick={() => advanceCare()}>{careStage(care).label}<span>{care.count} / {careStage(care).hits}</span></button><button className="town-text-button" onClick={cancelCare}>稍後再做</button></div> : <><div className="town-care-actions">{CARE.map(item => <button key={item.id} onClick={() => startCare(item.id)}><TownIcon name={item.icon} size={23}/><span>{item.label}</span></button>)}</div><div className="town-companion-actions"><button className="town-secondary" onClick={() => companionAction(sleeping ? 'wake' : 'come')}><TownIcon name={sleeping ? 'sun' : 'paw'} size={17}/>{sleeping ? '起床伸懶腰' : `叫${def.name}過來`}</button>{!sleeping && <button className="town-secondary" onClick={() => companionAction('wake')}>伸個懶腰</button>}</div>{needs && !sleeping && <div className="town-needs"><p>{needs.text}</p><button className="town-text-button" onClick={() => startCare(needs.type)}>{needs.label}<TownIcon name="arrow" size={14}/></button></div>}<div className="town-bond"><TownIcon name="heart" size={17}/><span>一起累積的親密</span><strong>{selected.bond}</strong></div><button className="town-primary" onClick={() => changeTab('explore')}>一起去小鎮走走<TownIcon name="compass" size={18}/></button></>}<div className="town-pet-switcher" aria-label="選擇陪伴夥伴">{pets.map(p => <button key={p.id} aria-label={`陪伴${PETS.find(d => d.id === p.speciesId)?.name}`} aria-pressed={p.id === selected.id} onClick={() => { dispatch({ type: 'SELECT_PET', petId: p.id }); cancelCare(); }}><PetPortrait speciesId={p.speciesId} size={42}/></button>)}{canAdopt && <button className="town-new-friend" aria-label="迎接新夥伴" onClick={() => setModal('adopt')}>＋</button>}</div></>}
      </aside>
    </div>}

    {tab === 'home' && selected && !care && <section className="town-environment" aria-label="家園物件互動"><div><span className="town-eyebrow">LITTLE THINGS TO DISCOVER</span><h2>走近一點，發現小驚喜。</h2><p>點場景中的家具，或選下面的物件。走到附近，也會停下來看看。</p></div><div className="town-environment-options">{environmentItems.map(item => <button key={item.placement.id} className="town-environment-item" aria-label={`去${item.item.name}：${item.label}`} disabled={renderer !== 'ready'} aria-pressed={environment?.id === item.placement.id} onClick={() => visitEnvironment(item.placement.id)}><FurnishingArt item={item.item}/><span><strong>{item.item.name}</strong><small>{item.label}</small></span><TownIcon name="arrow" size={15}/></button>)}</div>{environment && <button className="town-text-button" onClick={stopEnvironment}>停止這次互動</button>}{renderer === 'fallback' && <p>目前使用平面場景，可以繼續用照顧按鈕陪伴夥伴。</p>}</section>}
    {tab === 'home' && pets.length > 0 && <div className="town-home-notes"><button className="town-next-story" onClick={() => { changeTab('explore'); if (nextChapter) openChapter(nextChapter); }}><span className="town-round-icon"><TownIcon name="book" size={25}/></span><span><small>下一段小小旅程</small><strong>{nextChapter?.title || '九段故事，收藏了一整座小島。'}</strong><span>{nextChapter ? '約 3–5 分鐘 · 帶一點英文，一起出門' : '回到喜歡的地方，再讀一次也很好。'}</span></span><TownIcon name="arrow"/></button><div className="town-island-note"><TownIcon name="leaf" size={26}/><p>照自己的步調。<br/><span>今天只是來摸摸牠，也很好。</span></p><span className="town-note-stamp">SLOW<br/>DAYS</span></div></div>}

    {tab === 'explore' && !chapter && <div className="town-explore"><div className="town-explore-summary"><span><TownIcon name="compass"/> 小島旅行手帳</span><strong>{completed.length}<small> / 9 段回憶</small></strong></div>{REGIONS.map((region,ri) => <section className={`town-region region-${region.id}`} key={region.id}><div className="town-region-art"><div className="town-region-sun"/><div className="town-region-hill hill-one"/><div className="town-region-hill hill-two"/><div className="town-region-building"><span/><i/></div><span className="town-region-number">0{ri + 1}</span><div><small>{region.enName || ['THE HARBOR','THE ORCHARD','THE STARLIGHT'][ri]}</small><h2>{region.name}</h2><p>{region.description || ['把第一聲 hello，送給海邊的朋友。','聽見葉子，也聽懂生活的小事情。','帶著一路上的回憶，去看看星星。'][ri]}</p></div></div><div className="town-chapter-list">{CHAPTERS.filter(c => c.regionId === region.id).map(item => { const done = completed.includes(item.id), unlocked = chapterReady(item), saved = world.chapterProgress[`${item.id}:${level}`]?.step; return <button key={item.id} disabled={!unlocked} onClick={() => openChapter(item)}><span className={`town-chapter-index ${done ? 'is-done' : ''}`}>{done ? <TownIcon name="check" size={18}/> : unlocked ? String(item.order).padStart(2,'0') : <TownIcon name="lock" size={17}/>}</span><span><strong>{item.title}</strong><small>{item.enTitle}</small><em>{done ? '回憶已收藏 · 可以再玩' : unlocked ? saved ? '旅程進行中 · 繼續故事' : '兩個英文互動 · 約 3–5 分鐘' : '完成前一章後出發'}</em></span>{unlocked && <TownIcon name="arrow" size={18}/>}</button>; })}</div></section>)}<p className="town-footnote">不需要麥克風或 AI 金鑰。答錯可以再試，旅程不會催促你。</p></div>}

    {tab === 'decorate' && <section className="town-catalog"><div className="town-section-heading"><div><span className="town-eyebrow">LITTLE THINGS, LOVELY DAYS</span><h2>小島生活選物</h2></div><div className="town-filter-pills">{[['all','全部'],['owned','已擁有'],['harbor','海風'],['orchard','果園'],['starlight','星光']].map(([id,label]) => <button key={id} aria-pressed={decorFilter === id} onClick={() => setDecorFilter(id)}>{label}</button>)}</div></div><div className="town-furniture-grid">{FURNITURE.filter(item => decorFilter === 'all' || decorFilter === 'owned' ? decorFilter !== 'owned' || world.ownedDecorations.includes(item.id) : item.setId === decorFilter).map(item => { const owned = world.ownedDecorations.includes(item.id), placed = world.placements.find(p => p.itemId === item.id), locked = (item.unlockChapterId && !completed.includes(item.unlockChapterId)) || (item.setId === 'orchard' && completed.length < 3) || (item.setId === 'starlight' && completed.length < 6); return <article key={item.id}><div className="town-furniture-picture"><FurnishingArt item={item}/><span>{owned ? placed ? '在家裡' : '已擁有' : locked ? '故事解鎖' : `${item.price} 金幣`}</span></div><h3>{item.name}</h3><p>{item.enName || item.description || '讓日常多一點喜歡。'}</p><button className={owned ? 'town-secondary' : 'town-primary'} disabled={!owned && (locked || coins < item.price)} onClick={() => owned ? setDraft(placed || { id: `place-${item.id}`, itemId: item.id, x: 2.5, z: 2.5, rotation: 0 }) : dispatch({ type: 'BUY_DECOR', itemId: item.id })}>{owned ? placed ? '調整位置' : '放進小家' : locked ? '繼續故事來解鎖' : coins < item.price ? `還差 ${item.price - coins} 金幣` : '帶回小家'}</button></article>; })}</div></section>}

    {tab === 'companions' && <><div className="town-friends-grid">{PETS.map(p => { const owned = pets.find(item => item.speciesId === p.id), growth = owned && getPetStage(owned); return <article key={p.id} className={`town-friend-card ${owned ? '' : 'is-waiting'}`}><div className="town-friend-portrait" style={{ '--pet-color': p.color || '#d9b38a' }}><PetPortrait speciesId={p.id} size={190}/><span>{owned ? growth.label : '島上的新朋友'}</span></div><span className="town-eyebrow">{p.enName}</span><h2>{p.name}</h2><p className="town-character-trait">{p.trait}</p><p>{p.description}</p>{owned ? <><div className="town-growth-track"><span>一起成長<strong>{owned.exp} XP</strong></span><div><i style={{ width: `${Math.min(100, (owned.exp / 300) * 100)}%` }}/></div><small>初次見面 → 慢慢長大 → 成熟夥伴</small></div><div className="town-friend-facts"><span>親密 <strong>{owned.bond}</strong></span><span>階段 <strong>{growth.label}</strong></span></div><button className="town-primary" onClick={() => { dispatch({ type: 'SELECT_PET', petId: owned.id }); changeTab('home'); }}>回家陪{p.name}<TownIcon name="heart" size={17}/></button></> : <button className="town-secondary" disabled={!canAdopt} onClick={() => { dispatch({ type: 'ADOPT_FRIEND', speciesId: p.id }); changeTab('home'); }}>{canAdopt ? '邀請牠搬進小家' : `完成第 ${pets.length < 2 ? 3 : 6} 章後迎接`}</button>}</article>; })}</div><section className="town-memory-book"><div className="town-section-heading"><div><span className="town-eyebrow">OUR LITTLE MEMORIES</span><h2>一起留下的回憶</h2></div><TownIcon name="book" size={30}/></div>{completed.length ? <div className="town-memory-grid">{CHAPTERS.filter(item => completed.includes(item.id)).map(item => <article className="town-memory-card" key={item.id}><span>POSTCARD {String(item.order).padStart(2,"0")}</span><strong>{item.title}</strong><small>{item.enTitle}</small></article>)}</div> : <p className="town-muted">第一封明信片、第一次野餐……完成故事後，都會好好收在這裡。</p>}</section></>}

    <footer className="town-footer"><span>SEABREEZE · ENGLISHGO</span><p>小小的陪伴，大大的世界。</p><span>{pets.length} / 3 位夥伴 · {completed.length} 段回憶</span></footer>

    {modal === 'settings' && <Dialog title="讓小島更舒服" onClose={closeModal}><label className="town-setting">畫面品質<select value={world.settings.quality} onChange={e => dispatch({ type: 'SETTINGS', patch: { quality: e.target.value } })}><option value="auto">自動平衡</option><option value="high">細緻光影</option><option value="low">流暢優先</option></select></label><label className="town-setting">夥伴與環境動畫<input type="checkbox" checked={world.settings.motion} onChange={e => dispatch({ type: 'SETTINGS', patch: { motion: e.target.checked } })}/></label><label className="town-setting">海浪環境音<input type="checkbox" checked={soundPlaying} onChange={toggleSound}/></label><p className="town-muted">系統的減少動態效果也會生效。英文朗讀隨時可以手動播放。</p><button className="town-secondary" onClick={() => setModal('account')}>{petAccount ? `${petAccount.username} · 帳號與同步` : '登入或建立小鎮帳號'}</button><button className="town-primary" onClick={closeModal}>設定好了</button></Dialog>}
    {modal === 'account' && <Dialog title={petAccount ? '你的小鎮帳號' : '把小島帶到另一台裝置'} onClose={closeModal}>{petAccount ? <><p>目前登入：<strong>{petAccount.username}</strong></p><p className="town-muted">{STATUS[status]}。離線時會先保存到這台裝置，回到網路後繼續同步。</p><button className="town-primary" onClick={retrySync}>重新同步</button><button className="town-secondary" onClick={() => { logout(); closeModal(); }}>登出並回到本機小島</button></> : authConflict ? <><p>雲端和這台裝置都有新小島，選擇這次要繼續的進度。本機小島會另行保留。</p><button className="town-primary" onClick={() => { connect(authConflict.credentials, authConflict.response); closeModal(); }}>繼續雲端小島</button><button className="town-secondary" onClick={() => { connect(authConflict.credentials, authConflict.response, true); closeModal(); }}>使用本機家園配置與進度</button><p className="town-muted">登入後使用帳號的金幣餘額，不合併兩邊錢包。</p></> : <><div className="town-filter-pills">{[['login','登入'],['signup','建立帳號']].map(([id,label]) => <button key={id} disabled={authBusy} aria-pressed={authMode === id} onClick={() => { setAuthMode(id); setAuthError(''); }}>{label}</button>)}</div><label className="town-field">暱稱<input disabled={authBusy} value={username} autoComplete="username" maxLength={20} onChange={e => setUsername(e.target.value)} placeholder="2–20 個字"/></label><label className="town-field">PIN<input disabled={authBusy} value={pin} type="password" inputMode="numeric" autoComplete="off" maxLength={6} onChange={e => setPin(e.target.value.replace(/\D/g,''))} placeholder="4–6 位數字"/></label>{authError && <p className="town-form-error" role="alert">{authError}</p>}<button className="town-primary" disabled={authBusy} onClick={login}>{authBusy ? '正在連線…' : authMode === 'login' ? '回到我的小島' : '建立小鎮帳號'}</button><p className="town-footnote">請記住暱稱與 PIN，目前沒有電子郵件找回功能。不登入也可以在這台裝置完整遊玩。</p></>}</Dialog>}
    {modal === 'adopt' && <Dialog title="有位朋友，想搬來和你一起住。" onClose={closeModal}><div className="town-adopt-options">{availableFriends.map(p => <button key={p.id} onClick={() => { dispatch({ type: 'ADOPT_FRIEND', speciesId: p.id }); closeModal(); }}><PetPortrait speciesId={p.id} size={120}/><strong>{p.name}</strong><span>{p.trait}</span><small>邀請牠回家 →</small></button>)}</div></Dialog>}
  </section>;
}
