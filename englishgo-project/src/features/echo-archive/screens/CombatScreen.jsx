import { useCallback, useEffect, useRef, useState } from 'react';
import { CARDS, KEYWORDS, POWER_TEXT } from '../data/cards.js';
import { ELITE_AFFIXES, ENEMIES, affixText, zoneOf } from '../data/enemies.js';
import { POTIONS } from '../data/relics.js';
import { HEROES, heroOf } from '../data/heroes.js';
import { OVERHEAT_AT, OVERHEAT_HP, canPlay, cardContext, cardCost, hasRelic, intentOf, isDay, isGuarded, isNight, living } from '../engine/engine.js';
import CardFace, { KeywordList } from '../components/CardFace.jsx';
import Glyph from '../components/Glyph.jsx';
import { Backdrop, EnemyArt, FamiliarArt, HeroArt } from '../components/Creatures.jsx';
import { makeChant } from '../chant.js';
import { haptic, sfx } from '../sound.js';
import { duckMusic } from '../music.js';

const DEBUFFS = new Set(['weak', 'exposed', 'frail', 'burn']);
const plain = segs => segs.map(seg => (typeof seg === 'string' ? seg : seg.kw ? KEYWORDS[seg.kw].en : seg.sky ? (seg.sky === 'day' ? '☀' : '☾') : seg.n)).join('');

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

// What the enemies will hit for this round against the Ward you will have
// when they attack (Stoneheart and Owl Feather add theirs at end of turn).
export function incomingDamage(run) {
  const c = run.combat;
  if (!c || c.phase !== 'player') return null;
  const stone = c.player.pw.stoneheart || 0;
  const block = c.player.ward + stone + (hasRelic(run, 'owlFeather') && c.player.ward + stone === 0 ? 6 : 0);
  // Walk the enemies in order: a Ward thief empties the Ward before its hits.
  let attack = 0, left = block, loss = 0, stolen = false;
  if (fogged(run)) return null;
  living(c).forEach(enemy => {
    const intent = intentOf(run, enemy);
    if (!intent) return;
    if (intent.move.stealWard && left > 0) { left = 0; stolen = true; }
    for (let i = 0; i < (intent.dmg != null ? intent.hits : 0); i++) {
      const absorbed = Math.min(left, intent.dmg);
      left -= absorbed; loss += intent.dmg - absorbed; attack += intent.dmg;
    }
  });
  return { attack, block, loss, stolen };
}

function Incoming({ run }) {
  const info = incomingDamage(run);
  if (!info || !info.attack) return null;
  const tip = `敵人這輪預計造成 ${info.attack} 傷害，你會有 ${info.block} Ward${info.stolen ? '（但會被偷走）' : ''}，${info.loss ? `將失去 ${info.loss} 生命` : '可以全部擋下'}。`;
  return <div className={`ea-incoming ${info.loss ? 'is-hurt' : 'is-safe'}`} tabIndex={0} data-tip={tip} aria-label={tip}>
    <Glyph name="attack" size={13}/><b>{info.attack}</b>
    <Glyph name="defend" size={13}/><b>{info.block}</b>
    <span>{info.loss ? `−${info.loss}` : '擋得住'}</span>
  </div>;
}

function HpBar({ hp, max, ward }) {
  const width = `${Math.max(0, Math.min(100, (hp / max) * 100))}%`;
  return <div className={`ea-hp ${ward > 0 ? 'has-ward' : ''}`}>
    <div className="ea-hp-lag" style={{ width }}/>
    <div className="ea-hp-fill" style={{ width }}/>
    {ward > 0 && <span className="ea-ward-badge" aria-label={`Ward ${ward}`}><Glyph name="defend" size={13}/>{ward}</span>}
    <span className="ea-hp-text">{hp} / {max}</span>
  </div>;
}

function Floaters({ items }) {
  return <div className="ea-floaters" aria-hidden="true">{items.map(item => <span key={item.key} className={`ea-floater is-${item.kind}`} style={{ animationDelay: `${item.delay}ms`, '--fx': `${item.jitter}px` }}>{item.text}</span>)}</div>;
}

// Short-lived visual effects drawn on top of a hero or enemy.
const range = n => Array.from({ length: n }, (_, i) => i);
function Impacts({ items }) {
  return <div className="ea-impacts" aria-hidden="true">{items.map(item => (
    <span key={item.key} className={`ea-impact is-${item.kind}`} style={{ '--rot': `${item.rot}deg`, animationDelay: `${item.delay}ms` }}>
      {item.kind === 'slash' && <svg viewBox="0 0 100 100"><path d="M8 84Q46 52 94 10"/><path d="M18 92Q52 62 96 26" opacity=".55"/></svg>}
      {(item.kind === 'claw' || item.kind === 'spirit') && <svg viewBox="0 0 100 100"><path d="M20 10Q30 50 18 92M44 6Q54 50 42 94M68 10Q78 50 66 92"/></svg>}
      {item.kind === 'summon' && range(10).map(i => <i key={i} style={{ '--a': `${i * 36}deg`, '--t': `${i * 40}ms` }}/>)}
      {item.kind === 'death' && range(12).map(i => <i key={i} style={{ '--a': `${i * 30}deg`, '--d': `${46 + (i % 3) * 16}px`, '--s': `${6 + (i % 4) * 2}px` }}/>)}
      {(item.kind === 'heal' || item.kind === 'burn') && range(6).map(i => <i key={i} style={{ '--x': `${(i - 2.5) * 15}px`, '--t': `${i * 55}ms` }}/>)}
    </span>
  ))}</div>;
}

function describeIntent(intent) {
  const { move, dmg, hits } = intent;
  const parts = [];
  if (move.stealWard) parts.push('先偷走你全部的 Ward（一半變成牠的）');
  if (dmg != null) parts.push(`攻擊 ${dmg}${hits > 1 ? ` × ${hits}` : ''} 傷害`);
  if (move.ward) parts.push('獲得 Ward');
  if (move.allyWard) parts.push('為同伴加上 Ward');
  if (move.might) parts.push(`獲得 ${move.might} 層 Might`);
  if (move.heal) parts.push(`回復 ${move.heal} 生命`);
  (move.summon || []).forEach(item => parts.push(`召喚 ${item.n} 隻 ${ENEMIES[item.id].en}（${ENEMIES[item.id].zh}）`));
  ['weak', 'exposed', 'frail', 'burn'].forEach(st => { if (move[st]) parts.push(`施加 ${move[st]} 層 ${KEYWORDS[st].en}`); });
  (move.cards || []).forEach(card => parts.push(`把 ${card.n} 張 ${CARDS[card.id].en} 放進你的棄牌堆`));
  return `${move.en}（${move.zh}）：${parts.join('，') || '正在醞釀什麼…'}`;
}

// Ink Fog trial: no intents on the first turn of a fight.
const fogged = run => Boolean(run.mods?.fog && run.combat?.round === 1 && run.combat.phase === 'player');

function Intent({ run, enemy }) {
  if (fogged(run)) return <div className="ea-intent-wrap"><div className="ea-intent is-fog" tabIndex={0} data-tip="墨霧：第一回合看不到敵人的意圖。" aria-label="墨霧遮住了意圖"><Glyph name="smoke" size={22}/><b>?</b></div></div>;
  const intent = intentOf(run, enemy);
  if (!intent) return <div className="ea-intent is-empty"/>;
  const main = intent.kinds[0] || 'unknown';
  const def = ENEMIES[enemy.id];
  const countdown = def.countdown ? def.countdown.every - 1 - (enemy.turns % def.countdown.every) : null;
  return <div className="ea-intent-wrap" key={`${enemy.move}-${enemy.turns}`}>
    <div className={`ea-intent is-${main}`} tabIndex={0} data-tip={describeIntent(intent)} aria-label={describeIntent(intent)}>
      {intent.kinds.length ? intent.kinds.map(kind => <Glyph key={kind} name={kind} size={kind === main ? 24 : 16}/>) : <Glyph name="unknown" size={22}/>}
      {intent.dmg != null && <b>{intent.dmg}{intent.hits > 1 && <small>×{intent.hits}</small>}</b>}
    </div>
    {countdown > 0 && <span className="ea-countdown" data-tip={def.countdown.tip}><span lang="en">{def.countdown.en}</span> {countdown}</span>}
  </div>;
}

// The Tinker's boiler: ten segments, red once the next end of turn would overheat.
function SteamGauge({ steam, mark }) {
  const hot = steam >= OVERHEAT_AT;
  const tip = `${KEYWORDS.steam.en}（${KEYWORDS.steam.zh}）${steam}：${KEYWORDS.steam.text}`;
  return <div className={`ea-steam ${hot ? 'is-hot' : steam >= OVERHEAT_AT - 3 ? 'is-warm' : ''} ${mark ? `is-${mark}` : ''}`} tabIndex={0} data-tip={tip} aria-label={`Steam ${steam} / ${OVERHEAT_AT}${hot ? '，回合結束時會過熱！' : ''}`}>
    <span className="ea-steam-bar" aria-hidden="true">{Array.from({ length: OVERHEAT_AT }, (_, i) => <i key={i} className={i < steam ? 'is-on' : ''}/>)}</span>
    <b><Glyph name="steam" size={14}/>{steam}</b>
    {hot && <small>過熱!</small>}
  </div>;
}

// The Twilight Knight's sky: Day, Night, or both under a Total Eclipse.
function SkyBadge({ c, mark }) {
  const day = isDay(c), night = isNight(c);
  const name = day && night ? '全蝕' : day ? '白晝' : '黑夜';
  // What the next turn will be: the sky flips each turn unless Solstice holds it.
  const next = c.player.holdSky ? c.player.sky : c.player.sky === 'day' ? 'night' : 'day';
  const tip = `${name}：${day && night ? '白晝與黑夜的效果都會生效。' : day ? KEYWORDS.day.text : KEYWORDS.night.text}下回合是${next === 'day' ? '白晝 ☀' : '黑夜 ☾'}${c.player.holdSky ? '（至日：不會交替）' : ''}。`;
  return <div className={`ea-sky ${day ? 'is-day' : ''} ${night ? 'is-night' : ''} ${mark ? `is-${mark}` : ''}`} tabIndex={0} data-tip={tip} aria-label={tip}>
    <Glyph name={day && night ? 'eclipse' : day ? 'sun' : 'moon'} size={20}/><b>{name}</b>
    <small className="ea-sky-next" aria-hidden="true">{c.player.holdSky ? '⏸' : '→'}{next === 'day' ? '☀' : '☾'}</small>
  </div>;
}

// Whether a card's Day or Night bonus is live this turn (the card glows).
function skyLit(card, c) {
  if (!c.player.sky) return null;
  const has = key => Boolean(card[key === 'day' ? 'onDay' : 'onNight']) || card.fx.some(effect => effect[key]);
  if (has('day') && isDay(c)) return 'day';
  if (has('night') && isNight(c)) return 'night';
  return null;
}

function Enemy({ run, enemy, targetable, over, mark, floaters, impacts, onClick }) {
  const def = ENEMIES[enemy.id];
  return <div
    className={`ea-enemy ${def.boss ? 'is-boss' : def.elite ? 'is-elite' : ''} ${enemy.phased ? 'is-phased' : ''} ${enemy.affixes?.length ? 'has-affixes' : ''} ${enemy.dead ? 'is-dead' : ''} ${targetable ? 'is-targetable' : ''} ${over ? 'is-over' : ''} ${mark ? `is-${mark}` : ''}`}
    data-enemy={enemy.dead ? undefined : enemy.uid}
    role="button" tabIndex={enemy.dead ? -1 : 0}
    aria-label={`${def.en} ${def.zh}，生命 ${enemy.hp}/${enemy.maxHp}${enemy.ward ? `，Ward ${enemy.ward}` : ''}${targetable ? '，點選作為目標' : ''}`}
    onClick={event => { event.currentTarget.blur(); if (!enemy.dead) onClick(enemy.uid); }}
    onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && !enemy.dead) { event.preventDefault(); onClick(enemy.uid); } }}
  >
    {!enemy.dead && run.combat.phase !== 'won' && <Intent run={run} enemy={enemy}/>}
    <div className="ea-enemy-body"><EnemyArt art={def.art}/><Impacts items={impacts}/><Floaters items={floaters}/></div>
    <div className="ea-unit-info">
      <div className="ea-unit-name"><b lang="en">{def.en}</b><span>{def.zh}</span></div>
      {(enemy.affixes?.length > 0 || enemy.phased || isGuarded(run.combat, enemy)) && !enemy.dead && <div className="ea-affixes">
        {isGuarded(run.combat, enemy) && <span className="ea-affix is-guard" tabIndex={0} data-tip={`${ENEMIES[def.guard].zh}還在：${def.zh}受到的傷害減半。先打倒${ENEMIES[def.guard].zh}！`}><Glyph name="anchor" size={12}/>傷害減半</span>}
        {(enemy.affixes || []).map(id => <span key={id} className={`ea-affix is-${id}`} tabIndex={0} data-tip={`${ELITE_AFFIXES[id].en}（${ELITE_AFFIXES[id].zh}）：${affixText(id, run.act)}`} aria-label={`${ELITE_AFFIXES[id].zh}：${affixText(id, run.act)}`}><Glyph name={ELITE_AFFIXES[id].glyph} size={12}/>{ELITE_AFFIXES[id].zh}</span>)}
        {enemy.phased && <span className="ea-affix is-phase" tabIndex={0} data-tip={`${def.phase2.en}（${def.phase2.zh}）：${def.phase2.text}`}><Glyph name="wrath" size={12}/>第二階段</span>}
      </div>}
      <HpBar hp={enemy.hp} max={enemy.maxHp} ward={enemy.ward}/>
      <Statuses st={enemy.st}/>
    </div>
  </div>;
}

function ChantOverlay({ chant, onDone, speak, voice, strict = false }) {
  const [picked, setPicked] = useState(null);
  const { q } = chant;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => { if (voice && q.direction === 'en') speak(q.word); }, [q, voice, speak]);
  // Keep the rune word clear over the music while the chant is open.
  useEffect(() => { duckMusic(true); return () => duckMusic(false); }, []);
  const answer = useCallback(index => {
    if (picked !== null) return;
    setPicked(index);
    const ok = q.options[index].ok;
    if (ok) sfx.chantOk(); else sfx.chantMiss();
    if (voice) speak(q.word);
    window.setTimeout(() => doneRef.current(ok), ok ? 700 : 1300);
  }, [picked, q, voice, speak]);
  useEffect(() => {
    const onKey = event => { if (/^[1-3]$/.test(event.key)) answer(Number(event.key) - 1); if (event.key === 'Escape' && picked === null && !strict) doneRef.current(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, picked, strict]);
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
      {picked === null && (strict ? <p className="ea-chant-strict">試煉「嚴格詠唱」：一定要作答，答錯會失去 2 生命。</p>
        : <button type="button" className="ea-chant-skip" onClick={() => onDone(null)}>略過，直接施放</button>)}
    </div>
  </div>;
}

const CHOICE_TITLES = {
  toHand: { discard: '從棄牌堆挑 1 張牌回到手中', top: '挑 1 張牌加入手中，其餘放進棄牌堆' },
  discard: '挑 1 張要丟掉的牌',
  fade: '挑 1 張牌獻祭（消逝），換取能量',
  upgrade: '挑 1 張牌升級（本場戰鬥）',
  inscribe: '挑 1 張牌永久銘刻',
};

function ChoicePanel({ run, onChoose }) {
  const c = run.combat, choice = c.choice;
  const title = typeof CHOICE_TITLES[choice.action] === 'string' ? CHOICE_TITLES[choice.action] : CHOICE_TITLES[choice.action][choice.from];
  return <div className="ea-choice-panel" role="dialog" aria-modal="true" aria-labelledby="ea-choice-title">
    <div className="ea-choice-sheet">
      <span className="ea-eyebrow" lang="en">CHOOSE A CARD</span>
      <h2 id="ea-choice-title">{title}</h2>
      <div className="ea-choice-cards">{choice.options.map((uid, index) => {
        const inst = c.cards[uid];
        const preview = choice.action === 'upgrade' ? { ...inst, up: true } : choice.action === 'inscribe' ? { ...inst, bonus: (inst.bonus || 0) + choice.v } : inst;
        return <button type="button" key={uid} className="ea-choice-option" style={{ '--i': index }} onClick={() => { sfx.select(); onChoose(uid); }} aria-label={`${CARDS[inst.id].en} ${CARDS[inst.id].zh}`}>
          <CardFace inst={preview} ctx={cardContext(run)}/>
        </button>;
      })}</div>
    </div>
  </div>;
}

function EnemySheet({ run, enemy, onClose }) {
  const def = ENEMIES[enemy.id], intent = intentOf(run, enemy);
  return <div className="ea-sheet" role="dialog" aria-label={`${def.en} 資訊`}>
    <button type="button" className="ea-sheet-close" onClick={onClose} aria-label="關閉">×</button>
    <h3><span lang="en">{def.en}</span><small>{def.zh}{def.boss ? ' · Boss' : def.elite ? ' · Elite' : ''}</small></h3>
    {intent && !fogged(run) && <p className="ea-sheet-intent"><b>下一步</b>{describeIntent(intent)}</p>}
    {def.passive && <p className="ea-sheet-intent"><b>特性</b>{def.passive}</p>}
    {(enemy.affixes || []).map(id => <p key={id} className="ea-sheet-intent"><b>{ELITE_AFFIXES[id].zh}</b>{affixText(id, run.act)}</p>)}
    {def.phase2 && <p className="ea-sheet-intent"><b>{enemy.phased ? '第二階段' : '半血時'}</b>{def.phase2.text}</p>}
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
  const [impacts, setImpacts] = useState([]);
  const [shake, setShake] = useState(0);
  const [discarding, setDiscarding] = useState(false);
  const fieldRef = useRef(null);
  const flightRef = useRef(null);
  // A combat restored from a save should not replay its last animations.
  const seen = useRef({ id: c.id, fx: resumed ? c.fxSeq : 0 });
  const recent = useRef([]);
  const handRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClick = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const later = useCallback((fn, ms) => window.setTimeout(() => { if (alive.current) fn(); }, ms), []);

  // Turn engine events into floating numbers, shakes, banners and sounds.
  useEffect(() => {
    if (seen.current.id !== c.id) seen.current = { id: c.id, fx: 0 };
    const fresh = c.fx.filter(item => item.id > seen.current.fx);
    if (!fresh.length) return;
    seen.current.fx = Math.max(...fresh.map(item => item.id));
    const spawn = [], nextMarks = {}, bursts = [];
    let heavy = false, hurt = false, quake = 0;
    const burst = (to, kind) => bursts.push({ to, kind, rot: Math.round((Math.random() - 0.5) * 50), delay: bursts.filter(item => item.to === to).length * 90 });
    for (const f of fresh) {
      switch (f.kind) {
        case 'hit': case 'thorns': case 'sever':
          spawn.push({ to: f.to, text: f.amount > 0 ? `-${f.amount}` : 'Blocked', kind: f.amount > 0 ? 'dmg' : 'blocked' });
          if (f.amount > 0) {
            nextMarks[f.to] = 'hit';
            burst(f.to, f.to === 'player' ? 'claw' : 'slash');
            if (f.to === 'player') { hurt = true; quake = Math.max(quake, f.amount >= 12 ? 2 : 1); }
            if (f.amount >= 15) heavy = true;
            if (f.to !== 'player' && f.amount >= 20) quake = Math.max(quake, 1);
          } else { sfx.block(); burst(f.to, 'shield'); }
          break;
        case 'burn': spawn.push({ to: f.to, text: `-${f.amount}`, kind: 'burn' }); nextMarks[f.to] = 'hit'; burst(f.to, 'burn'); sfx.burn(); break;
        case 'loss': spawn.push({ to: f.to, text: `-${f.amount}`, kind: 'dmg' }); break;
        case 'strict': if (f.amount > 0) { spawn.push({ to: f.to, text: `-${f.amount}`, kind: 'dmg' }); nextMarks[f.to] = 'hit'; hurt = true; } break;
        case 'phase': {
          const phase = ENEMIES[f.enemy]?.phase2;
          if (phase) {
            setBanner({ key: `phase-${f.id}`, en: phase.en, zh: `第二階段 · ${phase.zh}` });
            setNotice({ key: `phase-note-${f.id}`, text: phase.text, ms: 4200 });
          }
          nextMarks[f.to] = 'summoned'; burst(f.to, 'summon'); quake = Math.max(quake, 2); sfx.phase();
          break;
        }
        case 'ward': if (f.amount > 0) { spawn.push({ to: f.to, text: `+${f.amount}`, kind: 'ward' }); burst(f.to, 'shield'); sfx.block(); } break;
        case 'heal': spawn.push({ to: f.to, text: `+${f.amount}`, kind: 'heal' }); burst(f.to, 'heal'); sfx.heal(); break;
        case 'death': burst(f.to, 'death'); break;
        case 'maxhp': spawn.push({ to: 'player', text: `Max HP +${f.amount}`, kind: 'heal' }); break;
        case 'revive': spawn.push({ to: 'player', text: 'Phoenix!', kind: 'heal' }); sfx.heal(); break;
        case 'status': spawn.push({ to: f.to, text: KEYWORDS[f.st]?.en || f.st, kind: 'debuff' }); burst(f.to, 'debuff'); sfx.debuff(); break;
        case 'buff': spawn.push({ to: f.to, text: f.st === 'upgrade' ? 'Upgrade!' : KEYWORDS[f.st]?.en || POWER_TEXT[f.st]?.en || f.st, kind: 'buff' }); burst(f.to, 'buff'); sfx.buff(); break;
        case 'chosen': sfx.card(); break;
        case 'cards': spawn.push({ to: 'player', text: `+${f.amount} ${CARDS[f.card].en}`, kind: 'debuff' }); break;
        case 'echo': spawn.push({ to: 'player', text: 'Echo!', kind: 'buff' }); break;
        case 'conjure': spawn.push({ to: 'player', text: `+${f.amount > 1 ? f.amount : ''} ${CARDS[f.card].en}`, kind: 'buff' }); break;
        case 'burst': spawn.push({ to: 'player', text: `Burst ×${f.amount}`, kind: 'buff' }); break;
        case 'abyss': spawn.push({ to: 'player', text: 'Abyss!', kind: 'buff' }); break;
        case 'colossus': spawn.push({ to: 'player', text: 'Colossus!', kind: 'buff' }); break;
        case 'steal': spawn.push({ to: 'player', text: `−${f.amount} Ward`, kind: 'debuff' }, { to: f.to, text: `+${f.kept ?? f.amount} Ward`, kind: 'ward' }); setNotice({ key: f.id, text: `Ward 被偷走了 ${f.amount} 點！` }); sfx.debuff(); break;
        case 'act': nextMarks[f.from] = 'act'; break;
        case 'steam': spawn.push({ to: 'player', text: `${f.amount > 0 ? '+' : ''}${f.amount} Steam`, kind: f.amount > 0 ? 'buff' : 'ward' }); nextMarks.steam = 'pulse'; break;
        case 'vent': spawn.push({ to: 'player', text: `Vent −${f.amount}`, kind: 'ward' }); nextMarks.steam = 'vent'; burst('player', 'shield'); sfx.block(); break;
        case 'overheat': setNotice({ key: f.id, text: c.player.pw.safetyValve ? '過熱！安全閥把蒸汽噴向所有敵人！' : `過熱！失去 ${OVERHEAT_HP} 生命，Steam 歸零。`, ms: 2200 }); nextMarks.steam = 'overheat'; quake = Math.max(quake, 1); break;
        case 'sky': if (f.sky === 'both' || f.sky === 'hold') setNotice({ key: f.id, text: f.sky === 'both' ? '全蝕：這回合同時是白晝與黑夜！' : '至日：下回合維持現在的晝夜。' }); else setBanner({ key: `sky-${f.id}`, en: f.sky === 'day' ? 'Day ☀' : 'Night ☾', zh: f.sky === 'day' ? '白晝：攻擊的時刻' : '黑夜：防守的時刻' }); nextMarks.sky = 'flip'; sfx.buff(); break;
        case 'familiar': nextMarks.familiar = 'strike'; burst(f.to, 'spirit'); if (f.all) living(c).forEach(enemy => { if (enemy.uid !== f.to) burst(enemy.uid, 'spirit'); }); break;
        case 'feed': spawn.push({ to: 'familiar', text: f.amount > 0 ? `+${f.amount}` : `${f.amount}`, kind: 'buff' }); nextMarks.familiar = nextMarks.familiar || 'grow'; sfx.buff(); break;
        case 'summon': burst(f.to, 'summon'); nextMarks[f.to] = 'summoned'; setNotice({ key: f.id, text: `${ENEMIES[f.enemy].en} · ${ENEMIES[f.enemy].zh} 加入戰鬥！` }); break;
        case 'play': {
          const flight = flightRef.current?.uid === f.uid ? flightRef.current : null;
          flightRef.current = null;
          setGhost({ key: `${c.id}-${f.id}`, inst: { id: f.card, up: f.up }, empowered: f.empowered, flight }); sfx.card();
          const guardLeft = c.hand.some(uid => c.cards[uid].id === 'guard');
          setCoach(step => (step === 'play' ? (guardLeft && f.card !== 'guard' ? 'ward' : 'end') : step === 'ward' && CARDS[f.card].type === 'skill' ? 'end' : step));
          break;
        }
        case 'turn': setBanner({ key: `t${c.id}-${f.id}`, en: 'Your Turn', zh: `第 ${f.round} 回合 · ${c.player.sky ? (isDay(c) ? '☀ 白晝：攻擊的時刻' : '☾ 黑夜：防守的時刻') : '你的行動'}` }); sfx.turn(); break;
        case 'shuffle': setNotice({ key: f.id, text: '棄牌堆洗回抽牌堆' }); break;
        case 'potion': setNotice({ key: f.id, text: `${POTIONS[f.potion].en} · ${POTIONS[f.potion].zh}` }); break;
        default: break;
      }
    }
    if (hurt) { sfx.hurt(); haptic.hurt(); } else if (Object.values(nextMarks).includes('hit')) { sfx.hit(heavy); if (heavy) haptic.heavy(); }
    if (spawn.length) {
      const items = spawn.map((item, index) => ({ ...item, key: `f${++floaterSeq}`, delay: index * 110, jitter: Math.round((Math.random() - 0.5) * 40) }));
      setFloaters(list => [...list, ...items].slice(-30));
      later(() => setFloaters(list => list.filter(item => !items.includes(item))), 1500 + items.length * 110);
    }
    if (Object.keys(nextMarks).length) {
      setMarks(previous => ({ ...previous, ...nextMarks }));
      later(() => setMarks(previous => { const next = { ...previous }; Object.keys(nextMarks).forEach(key => { if (next[key] === nextMarks[key]) delete next[key]; }); return next; }), 460);
    }
    if (bursts.length) {
      const items = bursts.map(item => ({ ...item, key: `i${++floaterSeq}` }));
      setImpacts(list => [...list, ...items].slice(-24));
      later(() => setImpacts(list => list.filter(item => !items.includes(item))), 900);
    }
    if (quake) {
      setShake(quake);
      later(() => setShake(0), 420);
    }
  }, [c.id, c.fxSeq, c.fx, later]);

  // Remember where a played card starts and where it lands, for the fly animation.
  const rememberFlight = useCallback((uid, targetUid) => {
    const field = fieldRef.current?.closest('.ea-combat')?.getBoundingClientRect();
    const from = document.querySelector(`[data-hand-uid="${uid}"]`)?.getBoundingClientRect();
    if (!field || !from) { flightRef.current = null; return; }
    const card = CARDS[c.cards[uid].id];
    const goal = targetUid ? document.querySelector(`[data-enemy="${targetUid}"] .ea-enemy-body`)
      : card.type === 'attack' ? document.querySelector('.ea-enemies')
      : document.querySelector('.ea-hero-body');
    const to = goal?.getBoundingClientRect();
    const center = rect => ({ x: rect.left + rect.width / 2 - field.left, y: rect.top + rect.height / 2 - field.top });
    flightRef.current = { uid, from: center(from), to: to ? center(to) : { x: field.width / 2, y: field.height * 0.4 } };
  }, [c.cards]);

  useEffect(() => { if (!banner) return undefined; const t = window.setTimeout(() => setBanner(null), 1150); return () => window.clearTimeout(t); }, [banner]);
  useEffect(() => { if (!ghost) return undefined; const t = window.setTimeout(() => setGhost(null), 700); return () => window.clearTimeout(t); }, [ghost]);
  useEffect(() => { if (!notice) return undefined; const t = window.setTimeout(() => setNotice(null), notice.ms || 1600); return () => window.clearTimeout(t); }, [notice]);
  // A boss with a special rule explains it once when the fight begins; an
  // unknown room that turned out to be an ambush says so.
  useEffect(() => {
    if (!resumed && c.ambush && c.round === 1) { setNotice({ key: `ambush-${c.id}`, text: '伏擊！敵人從書架後衝了出來！', ms: 2600 }); return; }
    if (resumed || c.kind !== 'boss' || c.round !== 1) return;
    const def = living(c).map(enemy => ENEMIES[enemy.id]).find(item => item.boss && item.passive);
    if (def) setNotice({ key: `boss-${c.id}`, text: `${(def.title || def).zh}：${def.passive}`, ms: 5200 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Enemies act one by one so each attack reads clearly.
  useEffect(() => {
    if (c.phase !== 'enemy') return undefined;
    const t = window.setTimeout(() => dispatch({ type: 'ENEMY_STEP' }), 640);
    return () => window.clearTimeout(t);
  }, [c.phase, c.queue.length, dispatch]);

  useEffect(() => {
    if (c.phase !== 'won' && c.phase !== 'lost') { setShowEnd(false); return undefined; }
    if (c.phase === 'won') { sfx.victory(); haptic.victory(); } else sfx.defeat();
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
    if (card.chant && (settings.chant || run.mods?.strictChant)) {
      const q = makeChant(pool, recent.current);
      recent.current = [...recent.current, q.word].slice(-12);
      setChant({ uid, target, card: inst.id, q });
      return;
    }
    rememberFlight(uid, target);
    dispatch({ type: 'PLAY_CARD', uid, target });
  }, [c, run, settings.chant, pool, dispatch, rememberFlight]);

  // Read the open chant from a ref: a state updater must stay pure (React may
  // run it twice), so the card is played and the word recorded exactly once.
  const chantRef = useRef(null);
  chantRef.current = chant;
  const finishChant = useCallback(ok => {
    const current = chantRef.current;
    if (!current) return;
    chantRef.current = null;
    setChant(null);
    rememberFlight(current.uid, current.target);
    dispatch({ type: 'PLAY_CARD', uid: current.uid, target: current.target, chant: ok === null ? null : { word: current.q.word, meaning: current.q.meaning, ok } });
    if (ok !== null) onWord?.(current.q.word, ok);
  }, [dispatch, onWord, rememberFlight]);

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

  // Ending a turn with playable cards left asks once more (unless switched off).
  const [confirmEnd, setConfirmEnd] = useState(false);
  useEffect(() => { setConfirmEnd(false); }, [c.energy, c.hand.length, c.phase]);

  // The hand sweeps toward the discard pile before the enemy phase starts.
  const endTurn = useCallback(() => {
    if (c.phase !== 'player' || chant || c.choice || discarding) return;
    const playable = c.hand.filter(uid => canPlay(run, uid)).length;
    // A full boiler always gets a warning: ending the turn now would overheat it.
    const steam = c.player.steam || 0;
    const willOverheat = steam >= OVERHEAT_AT && !c.player.pw.safetyValve && !c.player.pw.steamTitan;
    if ((willOverheat || (playable && settings.endWarn !== false)) && !confirmEnd && !coach) {
      setConfirmEnd(true);
      setNotice(willOverheat
        ? { key: Date.now(), text: `Steam 已經 ${steam}！現在結束回合會過熱、失去 ${OVERHEAT_HP} 生命。可以先打洩壓的牌，或再按一次結束回合`, ms: 3600 }
        : { key: Date.now(), text: `還有 ${playable} 張牌可以打出，再按一次就結束回合` });
      sfx.select();
      return;
    }
    setConfirmEnd(false);
    setSelected(null); setInspect(null); setPotionAim(null);
    const sweep = c.hand.some(uid => !CARDS[c.cards[uid].id].keep);
    setDiscarding(sweep);
    later(() => {
      setDiscarding(false);
      setBanner({ key: `e${Date.now()}`, en: 'Enemy Turn', zh: '敵人的回合' });
      dispatch({ type: 'END_TURN' });
    }, sweep ? 300 : 0);
  }, [c.phase, c.choice, c.hand, c.cards, run, chant, discarding, confirmEnd, coach, settings.endWarn, dispatch, setPotionAim, later]);

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
  // Fold can fill the hand, so a full hand squeezes until it fits a phone.
  const overlap = n > 1 ? Math.min(cardW * 0.7, Math.max(0, (n * cardW - (handWidth - 28)) / (n - 1))) : 0;
  const focus = drag?.uid || selected || hovered;
  const aimedEnemy = c.enemies.find(enemy => enemy.uid === (drag?.over || null));
  const ctx = cardContext(run);
  const targeting = (selected && CARDS[c.cards[selected]?.id]?.target === 'enemy') || potionAim !== null || (drag && CARDS[c.cards[drag.uid]?.id]?.target === 'enemy');

  const heroId = heroOf(run);
  const hero = HEROES[heroId];
  const familiar = c.player.familiar || 0;
  const coachAt = coach && coach !== 'wait' && !chant ? COACH[coach].at : null;
  return <section className={`ea-combat act-${run.act} zone-${zoneOf(run)} ${c.player.sky ? `sky-${isDay(c) && isNight(c) ? 'both' : c.player.sky}` : ''} ${targeting ? 'is-targeting' : ''} ${coachAt ? `coach-${coachAt}` : ''}`} aria-label="戰鬥">
    <div className={`ea-field ${shake ? `is-shaking shake-${shake}` : ''}`} ref={fieldRef}>
      <Backdrop act={zoneOf(run)}/>
      <div className="ea-stage">
        <div className={`ea-hero ${marks.player ? `is-${marks.player}` : ''}`}>
          <div className="ea-hero-body">
            <HeroArt hero={heroId}/>
            {(heroId === 'caller' || familiar > 0) && <div className={`ea-familiar ${familiar > 0 ? '' : 'is-dormant'} ${marks.familiar ? `is-${marks.familiar}` : ''}`} style={{ '--grow': Math.min(1.35, 0.85 + familiar * 0.025) }} tabIndex={0}
              data-tip={`${KEYWORDS.familiar.en}（${KEYWORDS.familiar.zh}）${familiar}：${KEYWORDS.familiar.text}`} aria-label={`墨靈 ${familiar} 層。${KEYWORDS.familiar.text}`}>
              <FamiliarArt/>
              <b>{familiar}</b>
              <Floaters items={floaters.filter(item => item.to === 'familiar')}/>
            </div>}
            {c.player.steam != null && <SteamGauge steam={c.player.steam} mark={marks.steam}/>}
            {c.player.sky && <SkyBadge c={c} mark={marks.sky}/>}
            <Impacts items={impacts.filter(item => item.to === 'player')}/><Floaters items={floaters.filter(item => item.to === 'player')}/>
          </div>
          <div className="ea-unit-info">
            <div className="ea-unit-name"><b lang="en">{hero.en}</b><span>{hero.zh}</span></div>
            <HpBar hp={run.hero.hp} max={run.hero.maxHp} ward={c.player.ward}/>
            <Incoming run={run}/>
            <Statuses st={c.player.st} pw={c.player.pw}/>
            {c.echo > 0 && <span className="ea-echo-chip" lang="en">Echo ×{c.echo}</span>}
          </div>
        </div>
        <div className={`ea-enemies count-${c.enemies.length}`}>
          {c.enemies.map(enemy => <Enemy key={enemy.uid} run={run} enemy={enemy} targetable={targeting && !enemy.dead} over={drag?.over === enemy.uid} mark={marks[enemy.uid]} floaters={floaters.filter(item => item.to === enemy.uid)} impacts={impacts.filter(item => item.to === enemy.uid)} onClick={clickEnemy}/>)}
        </div>
      </div>
      {banner && <div key={banner.key} className="ea-banner"><b lang="en">{banner.en}</b><span>{banner.zh}</span></div>}
      {ghost && !ghost.flight && <div key={ghost.key} className={`ea-ghost ${ghost.empowered ? 'is-empowered' : ''}`} aria-hidden="true"><CardFace inst={ghost.inst}/></div>}
      {notice && <div key={notice.key} className="ea-notice" role="status">{notice.text}</div>}
      {!chant && focus && c.cards[focus] && <aside className="ea-keyword-panel" aria-live="polite"><KeywordList inst={c.cards[focus]}/>{selected === focus && <p className="ea-play-hint">{CARDS[c.cards[focus].id].target === 'enemy' && living(c).length > 1 ? '點選敵人，或把牌拖到敵人身上' : '再點一次打出，或向上拖曳'}</p>}</aside>}
      {coach && coach !== 'wait' && !chant && c.phase === 'player' && <Coach step={coach} multi={living(c).length > 1} onSkip={finishCoach} onNext={() => (coach === 'after' ? finishCoach() : setCoach(COACH_NEXT[coach] || coach))}/>}
      {potionAim !== null && <div className="ea-aim-hint" role="status">選擇藥劑的目標<button type="button" onClick={() => setPotionAim(null)}>取消</button></div>}
      {inspect && c.enemies.find(enemy => enemy.uid === inspect && !enemy.dead) && <EnemySheet run={run} enemy={c.enemies.find(enemy => enemy.uid === inspect)} onClose={() => setInspect(null)}/>}
    </div>

    <div className="ea-tray">
      <div className="ea-tray-side">
        <div className={`ea-energy ${c.energy === 0 ? 'is-empty' : ''}`} aria-label={`能量 ${c.energy} / ${c.maxEnergy}`}><b key={c.energy}>{c.energy}</b><small>/{c.maxEnergy}</small><i lang="en">Energy</i></div>
        <button type="button" className="ea-pile" onClick={() => onShowPile('draw')} aria-label={`抽牌堆 ${c.draw.length} 張`}><Glyph name="deck" size={22}/><b>{c.draw.length}</b><small>抽牌堆</small></button>
      </div>
      <div className={`ea-hand ${discarding ? 'is-discarding' : ''}`} ref={handRef} style={{ '--card-w': `${cardW}px` }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { dragRef.current = null; setDrag(null); }}>
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
            className={`ea-hand-card ${lifted ? 'is-selected' : ''} ${isDrag ? 'is-dragging' : ''} ${isDrag && drag.zone && CARDS[inst.id].target !== 'enemy' ? 'is-armed' : ''} ${CARDS[inst.id].keep ? 'is-kept' : ''} ${skyLit(CARDS[inst.id], c) ? `is-sky-${skyLit(CARDS[inst.id], c)}` : ''}`}
            style={{ ...style, '--i': index }}
            data-hand-uid={uid}
            onMouseMove={event => {
              const rect = event.currentTarget.getBoundingClientRect();
              const px = (event.clientX - rect.left) / rect.width, py = (event.clientY - rect.top) / rect.height;
              event.currentTarget.style.setProperty('--tx', `${(px - 0.5) * 16}deg`);
              event.currentTarget.style.setProperty('--ty', `${(0.5 - py) * 12}deg`);
              event.currentTarget.style.setProperty('--gx', `${px * 100}%`);
              event.currentTarget.style.setProperty('--gy', `${py * 100}%`);
            }}
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
        <button type="button" className={`ea-end-turn ${c.phase === 'player' && !c.hand.some(uid => canPlay(run, uid)) ? 'is-ready' : ''} ${confirmEnd ? 'is-confirm' : ''}`} disabled={c.phase !== 'player' || Boolean(chant) || Boolean(c.choice)} onClick={endTurn}
          aria-label={c.phase === 'enemy' ? 'Enemy 敵人行動中' : confirmEnd ? 'Sure? 再按一次結束回合' : 'End Turn 結束回合 (E)'}>
          <span lang="en">{c.phase === 'enemy' ? 'Enemy…' : confirmEnd ? 'Sure?' : 'End Turn'}</span><small>{c.phase === 'enemy' ? '敵人行動中' : confirmEnd ? '再按一次結束回合' : '結束回合 (E)'}</small>
        </button>
      </div>

    </div>
      {ghost?.flight && <div key={ghost.key} className={`ea-ghost is-flying ${ghost.empowered ? 'is-empowered' : ''}`} aria-hidden="true"
        style={{ '--x0': `${ghost.flight.from.x}px`, '--y0': `${ghost.flight.from.y}px`, '--x1': `${ghost.flight.to.x}px`, '--y1': `${ghost.flight.to.y}px` }}><CardFace inst={ghost.inst}/></div>}
      {chant && <ChantOverlay chant={chant} onDone={finishChant} speak={speak} voice={settings.voice} strict={Boolean(run.mods?.strictChant)}/>}
      {c.choice && c.phase === 'player' && !chant && <ChoicePanel run={run} onChoose={uid => dispatch({ type: 'CHOOSE_CARD', uid })}/>}
      {showEnd && (c.phase === 'won'
        ? <div className="ea-combat-end is-won"><span lang="en">VICTORY</span><h2>戰鬥勝利</h2><p>寂靜退散了，戰利品在等著你。</p><button type="button" className="ea-btn is-gold" autoFocus onClick={() => dispatch({ type: 'FINISH_COMBAT' })}>收集戰利品 →</button></div>
        : <div className="ea-combat-end is-lost"><span lang="en">THE SILENCE WINS</span><h2>你倒下了</h2><p>但每一次遠征，都讓下一次更強。</p><button type="button" className="ea-btn" autoFocus onClick={() => dispatch({ type: 'FINISH_COMBAT' })}>查看這趟旅程</button></div>)}
  </section>;
}
