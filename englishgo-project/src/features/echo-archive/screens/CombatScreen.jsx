import { useCallback, useEffect, useRef, useState } from 'react';
import { CARDS, KEYWORDS, POWER_TEXT } from '../data/cards.js';
import { ENEMIES } from '../data/enemies.js';
import { POTIONS } from '../data/relics.js';
import { canPlay, cardContext, cardCost, intentOf, living } from '../engine/engine.js';
import CardFace, { KeywordList } from '../components/CardFace.jsx';
import Glyph from '../components/Glyph.jsx';
import { Backdrop, EnemyArt, HeroArt } from '../components/Creatures.jsx';
import { makeChant } from '../chant.js';
import { sfx } from '../sound.js';

const DEBUFFS = new Set(['weak', 'exposed', 'frail', 'burn']);
const plain = segs => segs.map(seg => (typeof seg === 'string' ? seg : seg.kw ? KEYWORDS[seg.kw].en : seg.n)).join('');

function statusTip(key, value, power) {
  if (power) { const info = POWER_TEXT[key]; return `${info.en}（${info.zh}）：${plain(info.text(value))}`; }
  const info = KEYWORDS[key];
  return info ? `${info.en}（${info.zh}）：${info.text}` : key;
}

export function Statuses({ st = {}, pw = {} }) {
  const items = [...Object.entries(st).filter(([, value]) => value).map(([key, value]) => [key, value, false]), ...Object.entries(pw).map(([key, value]) => [key, value, true])];
  if (!items.length) return null;
  return <div className="ea-statuses">{items.map(([key, value, power]) => (
    <span key={key} tabIndex={0} className={`ea-status ${DEBUFFS.has(key) ? 'is-debuff' : 'is-buff'} ${power ? 'is-power' : ''}`} data-tip={statusTip(key, value, power)} aria-label={statusTip(key, value, power)}>
      <Glyph name={key} size={15}/><b>{value}</b>
    </span>
  ))}</div>;
}

function HpBar({ hp, max, ward }) {
  return <div className={`ea-hp ${ward > 0 ? 'has-ward' : ''}`}>
    <div className="ea-hp-fill" style={{ width: `${Math.max(0, Math.min(100, (hp / max) * 100))}%` }}/>
    {ward > 0 && <span className="ea-ward-badge" aria-label={`Ward ${ward}`}><Glyph name="defend" size={13}/>{ward}</span>}
    <span className="ea-hp-text">{hp} / {max}</span>
  </div>;
}

function Floaters({ items }) {
  return <div className="ea-floaters" aria-hidden="true">{items.map(item => <span key={item.key} className={`ea-floater is-${item.kind}`} style={{ animationDelay: `${item.delay}ms`, '--fx': `${item.jitter}px` }}>{item.text}</span>)}</div>;
}

function describeIntent(intent) {
  const { move, dmg, hits } = intent;
  const parts = [];
  if (dmg != null) parts.push(`攻擊 ${dmg}${hits > 1 ? ` × ${hits}` : ''} 傷害`);
  if (move.ward) parts.push('獲得 Ward');
  if (move.allyWard) parts.push('為同伴加上 Ward');
  if (move.might) parts.push(`獲得 ${move.might} 層 Might`);
  ['weak', 'exposed', 'frail', 'burn'].forEach(st => { if (move[st]) parts.push(`施加 ${move[st]} 層 ${KEYWORDS[st].en}`); });
  (move.cards || []).forEach(card => parts.push(`把 ${card.n} 張 ${CARDS[card.id].en} 放進你的棄牌堆`));
  return `${move.en}（${move.zh}）：${parts.join('，') || '正在醞釀什麼…'}`;
}

function Intent({ run, enemy }) {
  const intent = intentOf(run, enemy);
  if (!intent) return <div className="ea-intent is-empty"/>;
  const main = intent.kinds[0] || 'unknown';
  const def = ENEMIES[enemy.id];
  const countdown = def.countdown ? 3 - (enemy.turns % 4) : null;
  return <div className="ea-intent-wrap">
    <div className={`ea-intent is-${main}`} tabIndex={0} data-tip={describeIntent(intent)} aria-label={describeIntent(intent)}>
      {intent.kinds.length ? intent.kinds.map(kind => <Glyph key={kind} name={kind} size={kind === main ? 24 : 16}/>) : <Glyph name="unknown" size={22}/>}
      {intent.dmg != null && <b>{intent.dmg}{intent.hits > 1 && <small>×{intent.hits}</small>}</b>}
    </div>
    {countdown > 0 && <span className="ea-countdown" data-tip="午夜鐘響時會造成巨大傷害，記得提前準備 Ward！"><span lang="en">Midnight</span> {countdown}</span>}
  </div>;
}

function Enemy({ run, enemy, targetable, over, mark, floaters, onClick }) {
  const def = ENEMIES[enemy.id];
  return <div
    className={`ea-enemy ${def.boss ? 'is-boss' : def.elite ? 'is-elite' : ''} ${enemy.dead ? 'is-dead' : ''} ${targetable ? 'is-targetable' : ''} ${over ? 'is-over' : ''} ${mark ? `is-${mark}` : ''}`}
    data-enemy={enemy.dead ? undefined : enemy.uid}
    role="button" tabIndex={enemy.dead ? -1 : 0}
    aria-label={`${def.en} ${def.zh}，生命 ${enemy.hp}/${enemy.maxHp}${enemy.ward ? `，Ward ${enemy.ward}` : ''}${targetable ? '，點選作為目標' : ''}`}
    onClick={event => { event.currentTarget.blur(); if (!enemy.dead) onClick(enemy.uid); }}
    onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && !enemy.dead) { event.preventDefault(); onClick(enemy.uid); } }}
  >
    {!enemy.dead && run.combat.phase !== 'won' && <Intent run={run} enemy={enemy}/>}
    <div className="ea-enemy-body"><EnemyArt art={def.art}/><Floaters items={floaters}/></div>
    <div className="ea-unit-info">
      <div className="ea-unit-name"><b lang="en">{def.en}</b><span>{def.zh}</span></div>
      <HpBar hp={enemy.hp} max={enemy.maxHp} ward={enemy.ward}/>
      <Statuses st={enemy.st}/>
    </div>
  </div>;
}

function ChantOverlay({ chant, onDone, speak, voice }) {
  const [picked, setPicked] = useState(null);
  const { q } = chant;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => { if (voice && q.direction === 'en') speak(q.word); }, [q, voice, speak]);
  const answer = useCallback(index => {
    if (picked !== null) return;
    setPicked(index);
    const ok = q.options[index].ok;
    if (ok) sfx.chantOk(); else sfx.chantMiss();
    if (voice) speak(q.word);
    window.setTimeout(() => doneRef.current(ok), ok ? 700 : 1300);
  }, [picked, q, voice, speak]);
  useEffect(() => {
    const onKey = event => { if (/^[1-3]$/.test(event.key)) answer(Number(event.key) - 1); if (event.key === 'Escape' && picked === null) doneRef.current(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, picked]);
  const solved = picked !== null && q.options[picked].ok;
  return <div className="ea-chant" role="dialog" aria-modal="true" aria-labelledby="ea-chant-title">
    <div className={`ea-chant-sigil ${solved ? 'is-solved' : picked !== null ? 'is-missed' : ''}`}>
      <svg viewBox="0 0 200 200" className="ea-chant-ring" aria-hidden="true"><circle cx="100" cy="100" r="92"/><circle cx="100" cy="100" r="78" strokeDasharray="3 9"/><path d="M100 8L180 146H20Z"/><path d="M100 192L20 54H180Z"/></svg>
      <span className="ea-chant-kicker" lang="en">CHANT · 詠唱 {CARDS[chant.card].en}</span>
      <h2 id="ea-chant-title" lang={q.direction === 'en' ? 'en' : 'zh-Hant'}>{q.direction === 'en' ? q.word : q.meaning}</h2>
      {q.direction === 'en' && <button type="button" className="ea-chant-listen" onClick={() => speak(q.word)}>♪ 聽發音</button>}
      <p>{picked === null ? (q.direction === 'en' ? '讀懂這個符文，就能強化這張牌。' : '找出代表這個意思的英文符文。') : solved ? '符文共鳴！效果強化 ✦' : `正確答案是「${q.direction === 'en' ? q.meaning : q.word}」，卡牌仍正常施放。`}</p>
      <div className="ea-chant-options">{q.options.map((option, index) => (
        <button type="button" key={option.label} lang={q.direction === 'zh' ? 'en' : undefined} disabled={picked !== null}
          className={picked === null ? '' : option.ok ? 'is-right' : picked === index ? 'is-wrong' : 'is-faded'}
          onClick={() => answer(index)}><small>{index + 1}</small>{option.label}</button>
      ))}</div>
      {picked === null && <button type="button" className="ea-chant-skip" onClick={() => onDone(null)}>略過，直接施放</button>}
    </div>
  </div>;
}

function EnemySheet({ run, enemy, onClose }) {
  const def = ENEMIES[enemy.id], intent = intentOf(run, enemy);
  return <div className="ea-sheet" role="dialog" aria-label={`${def.en} 資訊`}>
    <button type="button" className="ea-sheet-close" onClick={onClose} aria-label="關閉">×</button>
    <h3><span lang="en">{def.en}</span><small>{def.zh}{def.boss ? ' · Boss' : def.elite ? ' · Elite' : ''}</small></h3>
    {intent && <p className="ea-sheet-intent"><b>下一步</b>{describeIntent(intent)}</p>}
    <ul>{Object.entries(enemy.st).map(([key, value]) => <li key={key}><b lang="en">{KEYWORDS[key]?.en} {value}</b>{KEYWORDS[key]?.text}</li>)}</ul>
    <p className="ea-sheet-moves"><b>招式</b>{Object.values(def.moves).map(move => <span key={move.en} lang="en">{move.en}<small>{move.zh}</small></span>)}</p>
  </div>;
}

// First-battle coach: a few short steps that point at the real UI.
const COACH = {
  energy: { at: 'energy', title: '能量 Energy', text: '每回合有 3 點能量。卡牌左上角的數字是費用，能量用完就不能再出牌了。', button: '下一步' },
  intent: { at: 'intent', title: '看懂敵人的意圖', text: '敵人頭上的圖示是牠下一步要做的事：紅色的劍是攻擊，旁邊的數字是傷害；藍色的盾是防禦。', button: '下一步' },
  play: { at: 'hand', title: '出牌攻擊', text: multi => (multi ? '點一下 Slash 選取它，再點一個敵人就能攻擊。也可以直接把牌拖到敵人身上。' : '點一下 Slash 選取它，再點一次就能攻擊。也可以把牌往上拖曳。') },
  ward: { at: 'hand', title: '用 Ward 擋傷害', text: '打得好！Guard 會給你 Ward（護盾），敵人攻擊時會先扣掉 Ward。試著打出一張 Guard。', button: '知道了' },
  end: { at: 'end', title: '結束回合', text: '能量用完，或不想再出牌時，按右下角的 End Turn，換敵人行動。' },
  after: { at: 'center', title: '你學會了！', text: 'Ward 會先擋下傷害，剩下的才扣生命。之後每回合都是：看意圖 → 出牌 → 結束回合。打倒所有敵人就能拿戰利品！', button: '開始戰鬥' },
};
const COACH_NEXT = { energy: 'intent', intent: 'play', ward: 'end' };

function Coach({ step, multi, onNext, onSkip }) {
  const info = COACH[step];
  return <div className={`ea-coach is-${info.at}`} role="dialog" aria-live="polite" aria-label={info.title}>
    <b>{info.title}</b>
    <p>{typeof info.text === 'function' ? info.text(multi) : info.text}</p>
    <div className="ea-coach-actions">
      {step !== 'after' && <button type="button" className="ea-coach-skip" onClick={onSkip}>跳過教學</button>}
      {info.button && <button type="button" className="ea-coach-next" onClick={onNext}>{info.button}</button>}
    </div>
  </div>;
}

let floaterSeq = 0;

export default function CombatScreen({ run, dispatch, settings, pool, speak, potionAim, setPotionAim, onShowPile, resumed = false, tutorial = false, onTutorialDone, onWord }) {
  const c = run.combat;
  const [coach, setCoach] = useState(tutorial ? 'energy' : null);
  const finishCoach = useCallback(() => { setCoach(null); onTutorialDone?.(); }, [onTutorialDone]);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [chant, setChant] = useState(null);
  const [floaters, setFloaters] = useState([]);
  const [marks, setMarks] = useState({});
  const [banner, setBanner] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [notice, setNotice] = useState(null);
  const [drag, setDrag] = useState(null);
  const [inspect, setInspect] = useState(null);
  const [showEnd, setShowEnd] = useState(false);
  const [handWidth, setHandWidth] = useState(720);
  // A combat restored from a save should not replay its last animations.
  const seen = useRef({ id: c.id, fx: resumed ? c.fxSeq : 0 });
  const recent = useRef([]);
  const handRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClick = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const later = useCallback((fn, ms) => window.setTimeout(() => { if (alive.current) fn(); }, ms), []);

  // Turn engine events into floating numbers, shakes, banners and sounds.
  useEffect(() => {
    if (seen.current.id !== c.id) seen.current = { id: c.id, fx: 0 };
    const fresh = c.fx.filter(item => item.id > seen.current.fx);
    if (!fresh.length) return;
    seen.current.fx = Math.max(...fresh.map(item => item.id));
    const spawn = [], nextMarks = {};
    let heavy = false, hurt = false;
    for (const f of fresh) {
      switch (f.kind) {
        case 'hit': case 'thorns':
          spawn.push({ to: f.to, text: f.amount > 0 ? `-${f.amount}` : 'Blocked', kind: f.amount > 0 ? 'dmg' : 'blocked' });
          if (f.amount > 0) { nextMarks[f.to] = 'hit'; if (f.to === 'player') hurt = true; if (f.amount >= 15) heavy = true; }
          else sfx.block();
          break;
        case 'burn': spawn.push({ to: f.to, text: `-${f.amount}`, kind: 'burn' }); nextMarks[f.to] = 'hit'; sfx.burn(); break;
        case 'loss': spawn.push({ to: f.to, text: `-${f.amount}`, kind: 'dmg' }); break;
        case 'ward': if (f.amount > 0) { spawn.push({ to: f.to, text: `+${f.amount}`, kind: 'ward' }); sfx.block(); } break;
        case 'heal': spawn.push({ to: f.to, text: `+${f.amount}`, kind: 'heal' }); sfx.heal(); break;
        case 'maxhp': spawn.push({ to: 'player', text: `Max HP +${f.amount}`, kind: 'heal' }); break;
        case 'revive': spawn.push({ to: 'player', text: 'Phoenix!', kind: 'heal' }); sfx.heal(); break;
        case 'status': spawn.push({ to: f.to, text: KEYWORDS[f.st]?.en || f.st, kind: 'debuff' }); sfx.debuff(); break;
        case 'buff': spawn.push({ to: f.to, text: KEYWORDS[f.st]?.en || POWER_TEXT[f.st]?.en || f.st, kind: 'buff' }); sfx.buff(); break;
        case 'cards': spawn.push({ to: 'player', text: `+${f.amount} ${CARDS[f.card].en}`, kind: 'debuff' }); break;
        case 'echo': spawn.push({ to: 'player', text: 'Echo!', kind: 'buff' }); break;
        case 'conjure': spawn.push({ to: 'player', text: `+ ${CARDS[f.card].en}`, kind: 'buff' }); break;
        case 'act': nextMarks[f.from] = 'act'; break;
        case 'play': {
          setGhost({ key: `${c.id}-${f.id}`, inst: { id: f.card, up: f.up }, empowered: f.empowered }); sfx.card();
          const guardLeft = c.hand.some(uid => c.cards[uid].id === 'guard');
          setCoach(step => (step === 'play' ? (guardLeft && f.card !== 'guard' ? 'ward' : 'end') : step === 'ward' && CARDS[f.card].type === 'skill' ? 'end' : step));
          break;
        }
        case 'turn': setBanner({ key: `t${c.id}-${f.id}`, en: 'Your Turn', zh: `第 ${f.round} 回合 · 你的行動` }); sfx.turn(); break;
        case 'shuffle': setNotice({ key: f.id, text: '棄牌堆洗回抽牌堆' }); break;
        case 'potion': setNotice({ key: f.id, text: `${POTIONS[f.potion].en} · ${POTIONS[f.potion].zh}` }); break;
        default: break;
      }
    }
    if (hurt) sfx.hurt(); else if (Object.values(nextMarks).includes('hit')) sfx.hit(heavy);
    if (spawn.length) {
      const items = spawn.map((item, index) => ({ ...item, key: `f${++floaterSeq}`, delay: index * 110, jitter: Math.round((Math.random() - 0.5) * 40) }));
      setFloaters(list => [...list, ...items].slice(-30));
      later(() => setFloaters(list => list.filter(item => !items.includes(item))), 1500 + items.length * 110);
    }
    if (Object.keys(nextMarks).length) {
      setMarks(previous => ({ ...previous, ...nextMarks }));
      later(() => setMarks(previous => { const next = { ...previous }; Object.keys(nextMarks).forEach(key => { if (next[key] === nextMarks[key]) delete next[key]; }); return next; }), 460);
    }
  }, [c.id, c.fxSeq, c.fx, later]);

  useEffect(() => { if (!banner) return undefined; const t = window.setTimeout(() => setBanner(null), 1150); return () => window.clearTimeout(t); }, [banner]);
  useEffect(() => { if (!ghost) return undefined; const t = window.setTimeout(() => setGhost(null), 700); return () => window.clearTimeout(t); }, [ghost]);
  useEffect(() => { if (!notice) return undefined; const t = window.setTimeout(() => setNotice(null), 1600); return () => window.clearTimeout(t); }, [notice]);

  // Enemies act one by one so each attack reads clearly.
  useEffect(() => {
    if (c.phase !== 'enemy') return undefined;
    const t = window.setTimeout(() => dispatch({ type: 'ENEMY_STEP' }), 640);
    return () => window.clearTimeout(t);
  }, [c.phase, c.queue.length, dispatch]);

  useEffect(() => {
    if (c.phase !== 'won' && c.phase !== 'lost') { setShowEnd(false); return undefined; }
    if (c.phase === 'won') sfx.victory(); else sfx.defeat();
    const t = window.setTimeout(() => setShowEnd(true), 750);
    return () => window.clearTimeout(t);
  }, [c.phase]);

  useEffect(() => {
    if (!coach) return;
    if (c.phase === 'won' || c.phase === 'lost') finishCoach();
    else if (c.phase === 'enemy' && coach !== 'wait' && coach !== 'after') setCoach('wait');
    else if (c.phase === 'player' && coach === 'wait') setCoach('after');
  }, [c.phase, coach, finishCoach]);

  useEffect(() => {
    const el = handRef.current;
    if (!el) return undefined;
    setHandWidth(el.clientWidth || 720);
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(() => setHandWidth(el.clientWidth || 720));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { if (selected && !c.hand.includes(selected)) setSelected(null); }, [c.hand, selected]);

  const tryPlay = useCallback((uid, targetUid) => {
    const inst = c.cards[uid];
    if (!canPlay(run, uid)) {
      setNotice({ key: Date.now(), text: cardCost(run, inst) === null ? '這張牌無法打出' : '能量不足' });
      sfx.deny();
      return;
    }
    const card = CARDS[inst.id];
    let target = targetUid;
    if (card.target === 'enemy' && !target) {
      const pool2 = living(c);
      if (pool2.length === 1) target = pool2[0].uid;
      else { setSelected(uid); setNotice({ key: Date.now(), text: '選擇一個目標' }); return; }
    }
    setSelected(null);
    setInspect(null);
    if (card.chant && settings.chant) {
      const q = makeChant(pool, recent.current);
      recent.current = [...recent.current, q.word].slice(-12);
      setChant({ uid, target, card: inst.id, q });
      return;
    }
    dispatch({ type: 'PLAY_CARD', uid, target });
  }, [c, run, settings.chant, pool, dispatch]);

  const finishChant = useCallback(ok => {
    setChant(current => {
      if (current) {
        dispatch({ type: 'PLAY_CARD', uid: current.uid, target: current.target, chant: ok === null ? null : { word: current.q.word, meaning: current.q.meaning, ok } });
        if (ok !== null) onWord?.(current.q.word, ok);
      }
      return null;
    });
  }, [dispatch, onWord]);

  const selectCard = useCallback(uid => {
    if (c.phase !== 'player' || chant) return;
    setPotionAim(null);
    if (selected === uid) tryPlay(uid);
    else { setSelected(uid); setInspect(null); sfx.select(); }
  }, [c.phase, chant, selected, tryPlay, setPotionAim]);

  const clickEnemy = uid => {
    if (c.phase !== 'player' || chant) return;
    if (potionAim !== null) { dispatch({ type: 'USE_POTION', slot: potionAim, target: uid }); setPotionAim(null); return; }
    if (selected && CARDS[c.cards[selected].id].target === 'enemy') { tryPlay(selected, uid); return; }
    setSelected(null);
    setInspect(previous => (previous === uid ? null : uid));
  };

  const endTurn = useCallback(() => {
    if (c.phase !== 'player' || chant) return;
    setSelected(null); setInspect(null); setPotionAim(null);
    setBanner({ key: `e${Date.now()}`, en: 'Enemy Turn', zh: '敵人的回合' });
    dispatch({ type: 'END_TURN' });
  }, [c.phase, chant, dispatch, setPotionAim]);

  useEffect(() => {
    const onKey = event => {
      if (chant || event.ctrlKey || event.metaKey || event.altKey || event.target?.closest?.('input,textarea,select,dialog')) return;
      if (c.phase !== 'player') return;
      if (/^[0-9]$/.test(event.key)) { const uid = c.hand[event.key === '0' ? 9 : Number(event.key) - 1]; if (uid) selectCard(uid); }
      else if (event.key === 'e' || event.key === 'E') endTurn();
      else if (event.key === 'Escape') { setSelected(null); setPotionAim(null); setInspect(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chant, c.phase, c.hand, selectCard, endTurn, setPotionAim]);

  // Pointer dragging: drop on an enemy, or drag upward for untargeted cards.
  const onPointerDown = (event, uid) => {
    if (c.phase !== 'player' || chant || event.button > 0) return;
    dragRef.current = { uid, x: event.clientX, y: event.clientY, moved: false, over: null, zone: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = event => {
    const d = dragRef.current;
    if (!d) return;
    const dx = event.clientX - d.x, dy = event.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 12) return;
    d.moved = true;
    const el = document.elementFromPoint?.(event.clientX, event.clientY);
    d.over = el?.closest?.('[data-enemy]')?.dataset.enemy || null;
    d.zone = event.clientY < (handRef.current?.getBoundingClientRect().top ?? 0) - 24;
    setDrag({ uid: d.uid, dx, dy, over: d.over, zone: d.zone });
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !d.moved) return;
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    setDrag(null);
    const card = CARDS[c.cards[d.uid].id];
    if (card.target === 'enemy') {
      if (d.over) tryPlay(d.uid, d.over);
      else if (d.zone && living(c).length === 1) tryPlay(d.uid, living(c)[0].uid);
    } else if (d.zone) tryPlay(d.uid);
  };

  const n = c.hand.length;
  const cardW = handWidth < 520 ? 84 : handWidth < 760 ? 112 : 132;
  const overlap = n > 1 ? Math.min(cardW * 0.62, Math.max(0, (n * cardW - (handWidth - 16)) / (n - 1))) : 0;
  const focus = drag?.uid || selected || hovered;
  const aimedEnemy = c.enemies.find(enemy => enemy.uid === (drag?.over || null));
  const ctx = cardContext(run);
  const targeting = (selected && CARDS[c.cards[selected]?.id]?.target === 'enemy') || potionAim !== null || (drag && CARDS[c.cards[drag.uid]?.id]?.target === 'enemy');

  const coachAt = coach && coach !== 'wait' && !chant ? COACH[coach].at : null;
  return <section className={`ea-combat act-${run.act} ${targeting ? 'is-targeting' : ''} ${coachAt ? `coach-${coachAt}` : ''}`} aria-label="戰鬥">
    <div className="ea-field">
      <Backdrop act={run.act}/>
      <div className="ea-stage">
        <div className={`ea-hero ${marks.player ? `is-${marks.player}` : ''}`}>
          <div className="ea-hero-body"><HeroArt/><Floaters items={floaters.filter(item => item.to === 'player')}/></div>
          <div className="ea-unit-info">
            <div className="ea-unit-name"><b lang="en">The Scribe</b><span>詞術師</span></div>
            <HpBar hp={run.hero.hp} max={run.hero.maxHp} ward={c.player.ward}/>
            <Statuses st={c.player.st} pw={c.player.pw}/>
            {c.echo > 0 && <span className="ea-echo-chip" lang="en">Echo ×{c.echo}</span>}
          </div>
        </div>
        <div className={`ea-enemies count-${c.enemies.length}`}>
          {c.enemies.map(enemy => <Enemy key={enemy.uid} run={run} enemy={enemy} targetable={targeting && !enemy.dead} over={drag?.over === enemy.uid} mark={marks[enemy.uid]} floaters={floaters.filter(item => item.to === enemy.uid)} onClick={clickEnemy}/>)}
        </div>
      </div>
      {banner && <div key={banner.key} className="ea-banner"><b lang="en">{banner.en}</b><span>{banner.zh}</span></div>}
      {ghost && <div key={ghost.key} className={`ea-ghost ${ghost.empowered ? 'is-empowered' : ''}`} aria-hidden="true"><CardFace inst={ghost.inst}/></div>}
      {notice && <div key={notice.key} className="ea-notice" role="status">{notice.text}</div>}
      {!chant && focus && c.cards[focus] && <aside className="ea-keyword-panel" aria-live="polite"><KeywordList inst={c.cards[focus]}/>{selected === focus && <p className="ea-play-hint">{CARDS[c.cards[focus].id].target === 'enemy' && living(c).length > 1 ? '點選敵人，或把牌拖到敵人身上' : '再點一次打出，或向上拖曳'}</p>}</aside>}
      {coach && coach !== 'wait' && !chant && c.phase === 'player' && <Coach step={coach} multi={living(c).length > 1} onSkip={finishCoach} onNext={() => (coach === 'after' ? finishCoach() : setCoach(COACH_NEXT[coach] || coach))}/>}
      {potionAim !== null && <div className="ea-aim-hint" role="status">選擇藥劑的目標<button type="button" onClick={() => setPotionAim(null)}>取消</button></div>}
      {inspect && c.enemies.find(enemy => enemy.uid === inspect && !enemy.dead) && <EnemySheet run={run} enemy={c.enemies.find(enemy => enemy.uid === inspect)} onClose={() => setInspect(null)}/>}
    </div>

    <div className="ea-tray">
      <div className="ea-tray-side">
        <div className={`ea-energy ${c.energy === 0 ? 'is-empty' : ''}`} aria-label={`能量 ${c.energy} / ${c.maxEnergy}`}><b>{c.energy}</b><small>/{c.maxEnergy}</small><i lang="en">Energy</i></div>
        <button type="button" className="ea-pile" onClick={() => onShowPile('draw')} aria-label={`抽牌堆 ${c.draw.length} 張`}><Glyph name="deck" size={22}/><b>{c.draw.length}</b><small>抽牌堆</small></button>
      </div>
      <div className="ea-hand" ref={handRef} style={{ '--card-w': `${cardW}px` }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { dragRef.current = null; setDrag(null); }}>
        {c.hand.map((uid, index) => {
          const inst = c.cards[uid];
          const offset = index - (n - 1) / 2;
          const playable = canPlay(run, uid);
          const isDrag = drag?.uid === uid;
          const lifted = selected === uid || isDrag;
          const style = {
            marginLeft: index ? -overlap : 0,
            zIndex: lifted ? 60 : hovered === uid ? 50 : index + 1,
            '--rot': `${offset * (n > 6 ? 2.2 : 3.6)}deg`,
            '--drop': `${Math.abs(offset) ** 2 * (n > 6 ? 1.6 : 2.6)}px`,
            '--delay': `${index * 45}ms`,
            ...(isDrag ? { '--dx': `${drag.dx}px`, '--dy': `${drag.dy}px` } : {}),
          };
          const cardCtx = isDrag && aimedEnemy ? { ...ctx, exposed: aimedEnemy.st.exposed } : ctx;
          return <button type="button" key={uid}
            className={`ea-hand-card ${lifted ? 'is-selected' : ''} ${isDrag ? 'is-dragging' : ''} ${isDrag && drag.zone && CARDS[inst.id].target !== 'enemy' ? 'is-armed' : ''}`}
            style={style}
            aria-label={`${CARDS[inst.id].en}${inst.up ? '+' : ''} ${CARDS[inst.id].zh}，費用 ${cardCost(run, inst) ?? '無'}${playable ? '' : '，現在無法打出'}${selected === uid ? '，再按一次打出' : ''}`}
            aria-pressed={selected === uid}
            onClick={() => { if (!suppressClick.current) selectCard(uid); }}
            onMouseEnter={() => setHovered(uid)} onMouseLeave={() => setHovered(current => (current === uid ? null : current))}
            onPointerDown={event => onPointerDown(event, uid)}
          >
            <CardFace inst={inst} cost={cardCost(run, inst)} ctx={cardCtx} playable={playable}/>
          </button>;
        })}
        {!n && c.phase === 'player' && <p className="ea-hand-empty">手牌空了，結束回合吧。</p>}
      </div>
      <div className="ea-tray-side is-right">
        <button type="button" className="ea-pile" onClick={() => onShowPile('discard')} aria-label={`棄牌堆 ${c.discard.length} 張`}><Glyph name="deck" size={22}/><b>{c.discard.length}</b><small>棄牌堆</small></button>
        <button type="button" className={`ea-end-turn ${c.phase === 'player' && !c.hand.some(uid => canPlay(run, uid)) ? 'is-ready' : ''}`} disabled={c.phase !== 'player' || Boolean(chant)} onClick={endTurn}>
          <span lang="en">{c.phase === 'enemy' ? 'Enemy…' : 'End Turn'}</span><small>{c.phase === 'enemy' ? '敵人行動中' : '結束回合 (E)'}</small>
        </button>
      </div>

    </div>
      {chant && <ChantOverlay chant={chant} onDone={finishChant} speak={speak} voice={settings.voice}/>}
      {showEnd && (c.phase === 'won'
        ? <div className="ea-combat-end is-won"><span lang="en">VICTORY</span><h2>戰鬥勝利</h2><p>寂靜退散了，戰利品在等著你。</p><button type="button" className="ea-btn is-gold" autoFocus onClick={() => dispatch({ type: 'FINISH_COMBAT' })}>收集戰利品 →</button></div>
        : <div className="ea-combat-end is-lost"><span lang="en">THE SILENCE WINS</span><h2>你倒下了</h2><p>但每一次遠征，都讓下一次更強。</p><button type="button" className="ea-btn" autoFocus onClick={() => dispatch({ type: 'FINISH_COMBAT' })}>查看這趟旅程</button></div>)}
  </section>;
}
