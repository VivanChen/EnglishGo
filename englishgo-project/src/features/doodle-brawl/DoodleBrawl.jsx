import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { buildRunePool } from '../echo-archive/chant.js';
import { HERO_IDS, heroUnlocked } from './data/heroes.js';
import { SAVE_VERSION, runReducer } from './engine/run.js';
import { makeSeed } from './engine/rng.js';
import { play, setHapticsEnabled, setSoundEnabled } from './sound.js';
import ArenaScreen from './screens/ArenaScreen.jsx';
import { CrateScreen, LevelUpScreen, ShopScreen } from './screens/BetweenWaves.jsx';
import { NewRunScreen, SummaryScreen, TitleScreen } from './screens/Menus.jsx';
import { Modal, Toggle } from './screens/parts.jsx';
import './doodle-brawl.css';

const RUN_KEY = 'eg_doodle_brawl_run';
const META_KEY = 'eg_doodle_brawl_meta';
const ENDED = ['victory', 'defeat'];
const DEFAULT_META = { runs: 0, wins: 0, bestWave: 0, played: false, lastHero: 'sketch', lastDifficulty: 'easy', settings: { sfx: true, voice: true, words: true, haptics: true } };

function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function writeJSON(key, value) {
  try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: the run still plays */ }
}
function loadRun() {
  const saved = readJSON(RUN_KEY);
  return saved && saved.version === SAVE_VERSION && saved.hero && Array.isArray(saved.weapons) && !ENDED.includes(saved.phase) ? saved : null;
}
function loadMeta() {
  const saved = readJSON(META_KEY) || {};
  return { ...DEFAULT_META, ...saved, settings: { ...DEFAULT_META.settings, ...(saved.settings || {}) } };
}

export default function DoodleBrawl({ lv = 'elementary', onBack, onXp, trackWeak, deps = {} }) {
  const { V, speak = () => {}, stopSpeech = () => {}, loadExtraWords, fetchCloudVocab } = deps;
  const [run, dispatch] = useReducer(runReducer, null, loadRun);
  const [view, setView] = useState('title');
  const [meta, setMeta] = useState(loadMeta);
  const [pool, setPool] = useState(() => buildRunePool(V?.[lv] || []));
  const [menu, setMenu] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [unlocked, setUnlocked] = useState([]);
  const root = useRef(null);
  const runRef = useRef(run);
  const metaRef = useRef(meta);
  runRef.current = run;
  metaRef.current = meta;
  const settings = meta.settings;

  useEffect(() => { setSoundEnabled(settings.sfx); }, [settings.sfx]);
  useEffect(() => { setHapticsEnabled(settings.haptics); }, [settings.haptics]);
  useEffect(() => { writeJSON(META_KEY, meta); }, [meta]);
  useEffect(() => { writeJSON(RUN_KEY, run && !ENDED.includes(run.phase) ? run : null); }, [run]);

  // Crate words come from the learner's level, plus any extra and cloud lists.
  useEffect(() => {
    let active = true;
    Promise.allSettled([loadExtraWords?.(), fetchCloudVocab?.(lv, 120)]).then(([extra, cloud]) => {
      if (!active) return;
      setPool(buildRunePool([...(V?.[lv] || []), ...(extra.status === 'fulfilled' ? extra.value?.[lv] || [] : []), ...(cloud.status === 'fulfilled' ? cloud.value || [] : [])]));
    });
    return () => { active = false; stopSpeech(); };
  }, [lv, V, loadExtraWords, fetchCloudVocab, stopSpeech]);

  const say = useCallback(text => { if (settings.voice && text) speak(text, 'en-US', 0.9); }, [settings.voice, speak]);
  const sayAlways = useCallback(text => { if (text) speak(text, 'en-US', 0.9); }, [speak]);
  // Missed crate words go to the app's weak-word review; remembered ones ease off.
  const recordWord = useCallback((word, ok) => {
    trackWeak?.(word, ok ? -1 : 1);
    if (ok) onXp?.(1);
  }, [trackWeak, onXp]);

  const inWave = view === 'run' && run?.phase === 'wave';
  // Keep the game framed under the app's navigation bar.
  useEffect(() => {
    const el = root.current;
    if (!el || /jsdom/i.test(navigator.userAgent)) return;
    const nav = document.querySelector('.eg-app-nav')?.getBoundingClientRect().height || 0;
    el.style.setProperty('--db-nav', `${nav}px`);
    const top = el.getBoundingClientRect().top + window.scrollY - nav - 8;
    if (Math.abs(window.scrollY - top) > 4) window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
  }, [view, run?.phase, run?.wave]);
  // On phones the arena fills the screen and the page must not scroll under a finger.
  useEffect(() => {
    if (!inWave || typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 720px)').matches) return undefined;
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = previous; };
  }, [inWave]);

  const startRun = (hero, difficulty) => {
    setMeta(previous => ({ ...previous, runs: previous.runs + 1, lastHero: hero, lastDifficulty: difficulty }));
    setUnlocked([]);
    setMenu(false);
    dispatch({ type: 'NEW_RUN', seed: makeSeed(), hero, difficulty, startedAt: Date.now() });
    setView('run');
    play('go');
  };

  const waveDone = useCallback(result => {
    const current = runRef.current;
    if (!current || current.phase !== 'wave') return;
    dispatch({ type: 'WAVE_DONE', result, at: Date.now() });
    if (result.outcome !== 'dead') onXp?.(result.outcome === 'victory' ? 25 : 3);
    const cleared = result.outcome === 'dead' ? current.wave - 1 : current.wave;
    const before = metaRef.current;
    const after = { ...before, played: true, bestWave: Math.max(before.bestWave, cleared), wins: before.wins + (result.outcome === 'victory' ? 1 : 0) };
    const fresh = HERO_IDS.filter(id => !heroUnlocked(id, before) && heroUnlocked(id, after));
    if (fresh.length) setUnlocked(list => [...new Set([...list, ...fresh])]);
    setMeta(previous => ({ ...previous, played: true, bestWave: Math.max(previous.bestWave, cleared), wins: previous.wins + (result.outcome === 'victory' ? 1 : 0) }));
  }, [onXp]);

  const setSetting = (key, value) => setMeta(previous => ({ ...previous, settings: { ...previous.settings, [key]: value } }));
  const toTitle = () => { setMenu(false); setConfirmQuit(false); setView('title'); stopSpeech(); };
  const quitRun = () => { dispatch({ type: 'CLEAR' }); toTitle(); };

  if (view === 'newrun') {
    return <div ref={root} className="db-root is-menu">
      <NewRunScreen meta={meta} onStart={startRun} onBack={() => setView('title')}/>
    </div>;
  }
  if (view === 'title' || !run) {
    return <div ref={root} className="db-root is-menu">
      <TitleScreen saved={run && !ENDED.includes(run.phase) ? run : null} meta={meta} onContinue={() => { setMenu(false); setView('run'); }} onNew={() => setView('newrun')} onBack={onBack} onSetting={setSetting}/>
    </div>;
  }
  if (ENDED.includes(run.phase)) {
    return <div ref={root} className="db-root is-menu">
      <SummaryScreen run={run} unlocked={unlocked} speak={sayAlways} onAgain={() => { dispatch({ type: 'CLEAR' }); setView('newrun'); }} onTitle={() => { dispatch({ type: 'CLEAR' }); setView('title'); }}/>
    </div>;
  }

  let screen = null;
  if (run.phase === 'wave') screen = <ArenaScreen key={`${run.seed}-${run.wave}`} run={run} paused={menu} onPause={() => setMenu(true)} onDone={waveDone} firstTime={!meta.played && run.wave === 1}/>;
  else if (run.phase === 'levelup') screen = <LevelUpScreen run={run} dispatch={dispatch}/>;
  else if (run.phase === 'crate') screen = <CrateScreen key={`${run.wave}-${run.crates}`} run={run} dispatch={dispatch} pool={pool} wordsOn={settings.words} speak={say} onWord={recordWord}/>;
  else if (run.phase === 'shop') screen = <ShopScreen run={run} dispatch={dispatch} onNext={() => dispatch({ type: 'NEXT_WAVE' })}/>;

  return <div ref={root} className={`db-root ${inWave ? 'is-arena' : 'is-between'}`}>
    {!inWave && <button type="button" className="db-menu-btn" onClick={() => setMenu(true)} aria-label="選單與設定">☰</button>}
    {screen}
    {menu && <Modal title={inWave ? '暫停中' : '選單'} kicker={inWave ? 'PAUSED' : 'MENU'} onClose={() => setMenu(false)} className="db-menu-modal">
      <div className="db-settings">
        <Toggle label="音效" hint="射擊、撿星星和升級的聲音" checked={settings.sfx} onChange={value => setSetting('sfx', value)}/>
        <Toggle label="寶箱密語" hint="開寶箱前的英文單字題" checked={settings.words} onChange={value => setSetting('words', value)}/>
        <Toggle label="單字發音" hint="寶箱密語出現時唸出英文" checked={settings.voice} onChange={value => setSetting('voice', value)}/>
      </div>
      <p className="db-modal-note">{inWave ? '離開的話，這一波會從頭開始；之前的進度都會保留。' : '進度會自動保存。'}</p>
      <div className="db-modal-actions is-stack">
        <button type="button" className="db-btn is-primary" autoFocus onClick={() => setMenu(false)}>{inWave ? '繼續戰鬥' : '繼續'}</button>
        <button type="button" className="db-btn" onClick={toTitle}>回到標題（保留進度）</button>
        {!confirmQuit
          ? <button type="button" className="db-btn is-danger" onClick={() => setConfirmQuit(true)}>放棄這一局</button>
          : <button type="button" className="db-btn is-danger" onClick={quitRun}>確定放棄？這局會結束</button>}
      </div>
    </Modal>}
  </div>;
}
