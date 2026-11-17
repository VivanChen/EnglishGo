import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ACTS } from './data/enemies.js';
import { POTIONS } from './data/relics.js';
import { SAVE_VERSION, living, runReducer } from './engine/engine.js';
import { makeSeed } from './engine/rng.js';
import { buildRunePool } from './chant.js';
import { claimWelcome, normalizeCollection, pullArchive, shardsForRun, unlockedCards } from './archive.js';
import { setSoundEnabled, sfx } from './sound.js';
import Glyph from './components/Glyph.jsx';
import { FoilContext } from './components/CardFace.jsx';
import { PotionArt } from './components/Creatures.jsx';
import CombatScreen from './screens/CombatScreen.jsx';
import MapScreen from './screens/MapScreen.jsx';
import { CodexScreen, GachaScreen } from './screens/ArchiveScreens.jsx';
import TitleScreen, { RunSummary } from './screens/TitleScreen.jsx';
import { BossRelicScreen, CardPicker, DeckViewer, EventScreen, Modal, RelicIcon, RestScreen, RewardScreen, ShopScreen, TreasureScreen } from './screens/RoomScreens.jsx';
import './echo-archive.css';

const RUN_KEY = 'eg_echo_archive_run';
const META_KEY = 'eg_echo_archive_meta';
const DEFAULT_META = { runs: 0, wins: 0, bestAct: 0, bestFloor: 0, lastDifficulty: 'story', settings: { sfx: true, voice: true, chant: true } };

function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function writeJSON(key, value) {
  try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be full or blocked; the run still plays. */ }
}
function loadRun() {
  const saved = readJSON(RUN_KEY);
  return saved && saved.version === SAVE_VERSION && saved.hero && saved.map && !['victory', 'defeat'].includes(saved.screen) ? saved : null;
}
function loadMeta() {
  const saved = readJSON(META_KEY) || {};
  return { ...DEFAULT_META, ...saved, settings: { ...DEFAULT_META.settings, ...(saved.settings || {}) }, collection: normalizeCollection(saved.collection) };
}

function TopBar({ run, potionAim, onPotion, onDeck, onMenu }) {
  const { hero } = run;
  const low = hero.hp <= hero.maxHp * 0.3;
  return <header className="ea-topbar">
    <div className={`ea-stat is-hp ${low ? 'is-low' : ''}`} aria-label={`生命 ${hero.hp} / ${hero.maxHp}`}><Glyph name="heartFill" size={18}/><b>{hero.hp}</b><small>/{hero.maxHp}</small></div>
    <div className="ea-stat is-gold" aria-label={`金幣 ${hero.gold}`}><Glyph name="gold" size={18}/><b>{hero.gold}</b></div>
    <div className="ea-potions" aria-label="藥劑欄">{hero.potions.map((id, slot) => <button type="button" key={slot} className={`ea-potion ${potionAim === slot ? 'is-aiming' : ''}`} disabled={!id} onClick={() => onPotion(slot)} data-tip={id ? `${POTIONS[id].en}（${POTIONS[id].zh}）：${POTIONS[id].text}` : undefined} aria-label={id ? `${POTIONS[id].zh}，點選使用` : '空的藥劑欄'}>
      <PotionArt color={id ? POTIONS[id].color : undefined} empty={!id} size={20}/>
    </button>)}</div>
    <div className="ea-floor"><b lang="en">Act {ACTS[run.act].roman}</b><small>第 {run.floor} 層</small></div>
    <div className="ea-relics" aria-label="遺物">{hero.relics.map(id => <RelicIcon key={id} id={id} size={22}/>)}</div>
    <div className="ea-topbar-actions">
      <button type="button" className="ea-icon-btn" onClick={onDeck} aria-label={`查看牌組，共 ${hero.deck.length} 張`}><Glyph name="deck" size={20}/><b>{hero.deck.length}</b></button>
      <button type="button" className="ea-icon-btn" onClick={onMenu} aria-label="選單與設定"><Glyph name="gear" size={20}/></button>
    </div>
  </header>;
}

// Touch screens have no hover, so tapping a relic or status shows its
// description in a small floating card instead.
function TipPopover({ tip, onClose }) {
  useEffect(() => {
    const close = () => onClose();
    const timer = window.setTimeout(close, 4500);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.clearTimeout(timer); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [tip, onClose]);
  const width = Math.min(260, window.innerWidth - 24);
  const left = Math.max(12, Math.min(tip.x - width / 2, window.innerWidth - width - 12));
  const below = tip.top < window.innerHeight * 0.55;
  const style = below ? { left, width, top: tip.bottom + 10 } : { left, width, bottom: window.innerHeight - tip.top + 10 };
  return <div className={`ea-tip-pop ${below ? 'is-below' : 'is-above'}`} style={style} role="tooltip" onClick={onClose}>{tip.text}</div>;
}

function isTouchTap(event) {
  const type = event.nativeEvent?.pointerType;
  if (type) return type !== 'mouse';
  return typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches;
}

function Toggle({ label, hint, checked, onChange }) {
  return <label className="ea-toggle"><span><b>{label}</b><small>{hint}</small></span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/><i aria-hidden="true"/></label>;
}

export default function EchoArchive({ lv = 'elementary', onBack, onXp, trackWeak, deps = {} }) {
  const { V, speak = () => {}, stopSpeech = () => {}, loadExtraWords, fetchCloudVocab } = deps;
  const [run, dispatch] = useReducer(runReducer, null, loadRun);
  const [view, setView] = useState('title');
  const [meta, setMeta] = useState(loadMeta);
  const [pool, setPool] = useState(() => buildRunePool(V?.[lv] || []));
  const [overlay, setOverlay] = useState(null);
  const [potionAim, setPotionAim] = useState(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [tip, setTip] = useState(null);
  const [earned, setEarned] = useState(null);
  const closeTip = useCallback(() => setTip(null), []);
  const foils = useMemo(() => new Set(meta.collection.foils), [meta.collection.foils]);
  const resumedCombat = useRef(null);
  const awarded = useRef(null);
  const recorded = useRef(null);
  const root = useRef(null);
  const settings = meta.settings;

  useEffect(() => { setSoundEnabled(settings.sfx); }, [settings.sfx]);
  useEffect(() => { writeJSON(META_KEY, meta); }, [meta]);
  useEffect(() => {
    if (!run) { writeJSON(RUN_KEY, null); return; }
    writeJSON(RUN_KEY, ['victory', 'defeat'].includes(run.screen) ? null : run);
  }, [run]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([loadExtraWords?.(), fetchCloudVocab?.(lv, 120)]).then(([extra, cloud]) => {
      if (!active) return;
      setPool(buildRunePool([...(V?.[lv] || []), ...(extra.status === 'fulfilled' ? extra.value?.[lv] || [] : []), ...(cloud.status === 'fulfilled' ? cloud.value || [] : [])]));
    });
    return () => { active = false; stopSpeech(); };
  }, [lv, V, loadExtraWords, fetchCloudVocab, stopSpeech]);

  const say = useCallback(text => { if (settings.voice && text) speak(text); }, [settings.voice, speak]);
  // Missed rune words flow into the app's weak-word review; recalled ones ease off.
  const recordWord = useCallback((word, ok) => { trackWeak?.(word, ok ? -1 : 1); }, [trackWeak]);
  const finishTutorial = useCallback(() => setMeta(previous => (previous.tutorialDone ? previous : { ...previous, tutorialDone: true })), []);
  const sayAlways = useCallback(text => { if (text) speak(text); }, [speak]);

  // Learning XP for the main app: small amounts for each victory.
  useEffect(() => {
    const c = run?.combat;
    if (c?.phase !== 'won') return;
    const key = `${run.seed}-${c.id}`;
    if (awarded.current === key) return;
    awarded.current = key;
    onXp?.(c.kind === 'boss' ? 15 : c.kind === 'elite' ? 8 : 4);
  }, [run?.combat?.phase, run?.combat?.id, run?.seed, run?.combat?.kind, onXp]);

  useEffect(() => {
    if (!run || !['victory', 'defeat'].includes(run.screen) || recorded.current === run.seed) return;
    recorded.current = run.seed;
    const shards = shardsForRun(run);
    setEarned(shards);
    setMeta(previous => ({
      ...previous,
      wins: previous.wins + (run.screen === 'victory' ? 1 : 0),
      bestAct: Math.max(previous.bestAct, run.act),
      bestFloor: Math.max(previous.bestFloor, run.floor),
      collection: { ...previous.collection, shards: previous.collection.shards + shards.total },
    }));
    if (run.screen === 'victory') onXp?.(30);
  }, [run, onXp]);

  // Keep the game framed under the app's navigation bar on screen changes.
  useEffect(() => {
    const el = root.current;
    if (!el || /jsdom/i.test(navigator.userAgent)) return;
    const nav = document.querySelector('.eg-app-nav')?.getBoundingClientRect().height || 0;
    el.style.setProperty('--ea-nav', `${nav}px`);
    const top = el.getBoundingClientRect().top + window.scrollY - nav - 8;
    if (Math.abs(window.scrollY - top) > 4) window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
  }, [view, run?.screen]);

  useEffect(() => { if (run?.screen !== 'combat') setPotionAim(null); }, [run?.screen]);

  // On phones a run fills the whole screen above the app's sticky bars, so
  // the hand and End Turn never sit under the browser edge or the nav.
  const immersive = view === 'run' && Boolean(run) && !['victory', 'defeat'].includes(run.screen);
  useEffect(() => {
    if (!immersive || typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 720px)').matches) return undefined;
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = previous; };
  }, [immersive]);

  const startRun = difficulty => {
    resumedCombat.current = null;
    awarded.current = null;
    setMeta(previous => ({ ...previous, runs: previous.runs + 1, lastDifficulty: difficulty }));
    dispatch({ type: 'NEW_RUN', seed: makeSeed(), difficulty, lv, unlocked: unlockedCards(meta.collection) });
    setView('run');
    sfx.chantOk();
  };
  const pullCards = count => {
    const result = pullArchive(meta.collection, count);
    if (!result) return null;
    setMeta(previous => ({ ...previous, collection: result.collection }));
    return result.results;
  };
  const claimGift = () => setMeta(previous => ({ ...previous, collection: claimWelcome(previous.collection) }));
  const continueRun = () => { resumedCombat.current = run?.combat?.id ?? null; setView('run'); };
  const toTitle = () => { setOverlay(null); setView('title'); stopSpeech(); };
  const setSetting = (key, value) => setMeta(previous => ({ ...previous, settings: { ...previous.settings, [key]: value } }));
  const showTip = event => {
    const el = event.target.closest?.('[data-tip]');
    if (!el || el.closest('button, .ea-enemy, .ea-hand') || !isTouchTap(event)) { if (tip) setTip(null); return; }
    const rect = el.getBoundingClientRect();
    setTip({ text: el.dataset.tip, x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom, key: Date.now() });
  };

  const drinkPotion = slot => {
    const id = run.hero.potions[slot];
    setOverlay(null);
    if (!id) return;
    const c = run.combat;
    if (c && POTIONS[id].target === 'enemy' && living(c).length > 1) { setPotionAim(slot); return; }
    dispatch({ type: 'USE_POTION', slot, target: c ? living(c)[0]?.uid : undefined });
  };

  const withFoils = node => <FoilContext.Provider value={foils}>{node}</FoilContext.Provider>;

  if (view === 'gacha') {
    return withFoils(<div ref={root} className="ea-root screen-gacha">
      <GachaScreen collection={meta.collection} onPull={pullCards} onClaim={claimGift} onBack={() => setView('title')} onCodex={() => setView('codex')}/>
    </div>);
  }
  if (view === 'codex') {
    return withFoils(<div ref={root} className="ea-root screen-codex">
      <CodexScreen collection={meta.collection} onBack={() => setView('title')} onGacha={() => setView('gacha')}/>
    </div>);
  }

  if (view === 'title' || !run) {
    return withFoils(<div ref={root} className="ea-root screen-title">
      <TitleScreen saved={run && !['victory', 'defeat'].includes(run.screen) ? run : null} meta={meta} onContinue={continueRun} onNew={startRun} onBack={onBack} onGacha={() => setView('gacha')} onCodex={() => setView('codex')}/>
    </div>);
  }

  if (run.screen === 'victory' || run.screen === 'defeat') {
    return withFoils(<div ref={root} className={`ea-root screen-${run.screen}`} onClick={showTip}>
      {tip && <TipPopover key={tip.key} tip={tip} onClose={closeTip}/>}
      <RunSummary run={run} earned={earned} shards={meta.collection.shards} speak={sayAlways} onGacha={() => { dispatch({ type: 'CLEAR' }); setView('gacha'); }} onAgain={() => setView('title')} onTitle={() => { dispatch({ type: 'CLEAR' }); setView('title'); }}/>
    </div>);
  }

  const c = run.combat;
  const potionId = overlay?.kind === 'potion' ? run.hero.potions[overlay.slot] : null;
  const potionUsable = potionId && ((c && c.phase === 'player') || (!c && potionId === 'healTonic'));
  let screen = null;
  switch (run.screen) {
    case 'map': screen = <MapScreen run={run} dispatch={dispatch}/>; break;
    case 'combat': screen = <CombatScreen key={c.id} run={run} dispatch={dispatch} settings={settings} pool={pool} speak={say} potionAim={potionAim} setPotionAim={setPotionAim} resumed={resumedCombat.current === c.id} tutorial={!meta.tutorialDone && meta.runs <= 1 && c.id === 1} onTutorialDone={finishTutorial} onWord={recordWord} onShowPile={kind => setOverlay({ kind })}/>; break;
    case 'event': screen = <EventScreen key={run.event?.id} run={run} dispatch={dispatch} speak={sayAlways}/>; break;
    case 'reward': screen = <RewardScreen run={run} dispatch={dispatch}/>; break;
    case 'rest': screen = <RestScreen run={run} dispatch={dispatch}/>; break;
    case 'shop': screen = <ShopScreen run={run} dispatch={dispatch}/>; break;
    case 'treasure': screen = <TreasureScreen dispatch={dispatch}/>; break;
    case 'bossRelic': screen = <BossRelicScreen run={run} dispatch={dispatch}/>; break;
    default: screen = null;
  }

  return withFoils(<div ref={root} className={`ea-root is-immersive screen-${run.screen} act-${run.act}`} onClick={showTip}>
    <TopBar run={run} potionAim={potionAim} onPotion={slot => setOverlay({ kind: 'potion', slot })} onDeck={() => setOverlay({ kind: 'deck' })} onMenu={() => { setConfirmAbandon(false); setOverlay({ kind: 'menu' }); }}/>
    <div className="ea-main">{screen}</div>

    {tip && <TipPopover key={tip.key} tip={tip} onClose={closeTip}/>}
    {run.pending && <CardPicker key={`${run.pending.kind}-${run.pending.source}`} run={run} dispatch={dispatch}/>}

    {run.screen === 'map' && run.actIntro && <div className="ea-act-intro" role="dialog" aria-modal="true" aria-labelledby="ea-act-title">
      <span className="ea-act-roman" lang="en">ACT {ACTS[run.act].roman}</span>
      <h2 id="ea-act-title"><span lang="en">{ACTS[run.act].en}</span><b>{ACTS[run.act].zh}</b></h2>
      <p>{ACTS[run.act].mood}</p>
      <button type="button" className="ea-btn is-gold" autoFocus onClick={() => dispatch({ type: 'ACK_ACT' })}>展開地圖 →</button>
    </div>}

    {overlay?.kind === 'deck' && <DeckViewer title={`你的牌組（${run.hero.deck.length}）`} kicker="DECK" cards={run.hero.deck} onClose={() => setOverlay(null)}/>}
    {overlay?.kind === 'draw' && c && <DeckViewer title={`抽牌堆（${c.draw.length}）`} kicker="DRAW PILE" note="順序已隱藏，依類型排列。" cards={c.draw.map(uid => c.cards[uid])} onClose={() => setOverlay(null)}/>}
    {overlay?.kind === 'discard' && c && <DeckViewer title={`棄牌堆（${c.discard.length}）`} kicker="DISCARD PILE" note={c.faded.length ? `另有 ${c.faded.length} 張牌已 Fade（消逝）。` : null} cards={c.discard.map(uid => c.cards[uid])} onClose={() => setOverlay(null)}/>}
    {overlay?.kind === 'potion' && potionId && <Modal title={POTIONS[potionId].zh} kicker={POTIONS[potionId].en} onClose={() => setOverlay(null)} className="ea-potion-modal">
      <div className="ea-potion-detail"><PotionArt color={POTIONS[potionId].color} size={48}/><p>{POTIONS[potionId].text}</p></div>
      {!potionUsable && <p className="ea-modal-note">{c ? '等到你的回合再使用。' : '藥劑只能在戰鬥中使用。'}</p>}
      <div className="ea-modal-actions">
        <button type="button" className="ea-btn is-quiet" onClick={() => { dispatch({ type: 'DISCARD_POTION', slot: overlay.slot }); setOverlay(null); }}>丟棄</button>
        <button type="button" className="ea-btn is-gold" disabled={!potionUsable} onClick={() => drinkPotion(overlay.slot)}>使用</button>
      </div>
    </Modal>}
    {overlay?.kind === 'menu' && <Modal title="暫停選單" kicker="MENU" onClose={() => setOverlay(null)} className="ea-menu-modal">
      <div className="ea-settings">
        <Toggle label="音效" hint="出牌、打擊與勝利的聲音" checked={settings.sfx} onChange={value => setSetting('sfx', value)}/>
        <Toggle label="單字發音" hint="詠唱時自動唸出英文符文" checked={settings.voice} onChange={value => setSetting('voice', value)}/>
        <Toggle label="詠唱題目" hint="關閉後 Chant 牌直接以基本效果施放" checked={settings.chant} onChange={value => setSetting('chant', value)}/>
      </div>
      <p className="ea-modal-note">進度會自動保存，隨時可以回來繼續。</p>
      <div className="ea-modal-actions is-stack">
        <button type="button" className="ea-btn is-gold" onClick={() => setOverlay(null)}>繼續遊戲</button>
        <button type="button" className="ea-btn" onClick={toTitle}>回到標題（保留進度）</button>
        {!confirmAbandon ? <button type="button" className="ea-btn is-danger" onClick={() => setConfirmAbandon(true)}>放棄這次遠征</button>
          : <button type="button" className="ea-btn is-danger" onClick={() => { dispatch({ type: 'CLEAR' }); setOverlay(null); setView('title'); }}>確定放棄？進度將無法復原</button>}
      </div>
    </Modal>}
  </div>);
}
