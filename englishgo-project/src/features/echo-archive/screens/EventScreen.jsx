import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CARDS } from '../data/cards.js';
import { POTIONS, RELICS } from '../data/relics.js';
import { BOONS, DUEL_MOVES } from '../data/events.js';
import { eventBody, eventChoices, eventDef, meetsReq } from '../engine/engine.js';
import { echoRound, pickRunes } from '../chant.js';
import Glyph from '../components/Glyph.jsx';
import { PotionArt } from '../components/Creatures.jsx';
import { eventImage } from '../components/paintedArt.js';
import { sfx } from '../sound.js';
import { RelicIcon } from './RoomScreens.jsx';

// Icons shown if an event's painting cannot load.
const EVENT_GLYPHS = {
  lantern: 'lantern', mirror: 'shard', fountain: 'wave', door: 'event', lute: 'echo', statue: 'crown', binder: 'thread',
  candle: 'flame', guardian: 'stone', page: 'pages', quill: 'quill', well: 'coin', scholar: 'book', altar: 'emberHeart', gear: 'metronome', choir: 'bell',
  tower: 'tower', matching: 'deck', echoHall: 'echo', fortuneTeller: 'stars', mimicChest: 'treasure', inkKitten: 'inkDrop',
  knightDuel: 'helm', clockworkTea: 'tea', fortuneWheel: 'coin', readingRoom: 'book', pearl: 'pearl', stars: 'stars',
};

const shuffle = list => { const copy = [...list]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };

function Gain({ gain }) {
  if (gain.type === 'relic') return <span className="ea-gain"><RelicIcon id={gain.id} size={18}/>{RELICS[gain.id].en}</span>;
  if (gain.type === 'potion') return <span className="ea-gain"><PotionArt color={POTIONS[gain.id].color} size={14}/>{POTIONS[gain.id].en}</span>;
  if (gain.type === 'gold') return <span className="ea-gain"><Glyph name="gold" size={14}/>+{gain.amount}</span>;
  if (gain.type === 'lostPotion') return <span className="ea-gain is-removed"><PotionArt color={POTIONS[gain.id].color} size={14}/>失去 {POTIONS[gain.id].en}</span>;
  if (gain.type === 'boon') {
    const boon = BOONS[gain.id];
    return <span className={`ea-gain is-boon ${boon.bad ? 'is-bad' : ''}`} data-tip={`${boon.zh}：${boon.text}`}><Glyph name={boon.glyph} size={14}/><b lang="en">{boon.en}</b> · {gain.fights} 場</span>;
  }
  const prefix = { card: '獲得', upgrade: '升級', removed: '移除' }[gain.type];
  return <span className={`ea-gain is-${gain.type}`}>{prefix} <b lang="en">{CARDS[gain.id].en}</b></span>;
}

function EventScene({ id, art }) {
  const src = eventImage(id);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="ea-event-art"><Glyph name={EVENT_GLYPHS[art] || 'book'} size={64}/></div>;
  return <div className="ea-event-scene"><img src={src} alt="" decoding="async" draggable={false} onError={() => setFailed(true)}/></div>;
}

// ── The Librarian's Card Game: match each word with its meaning ──
const MEMORY_PAIRS = 4, MEMORY_MISSES = 5;
function MemoryGame({ pool, speak, voice, onDone }) {
  const [words] = useState(() => pickRunes(pool, MEMORY_PAIRS));
  const [tiles] = useState(() => shuffle(words.flatMap(word => [{ pair: word.w, text: word.w, en: true }, { pair: word.w, text: word.meaning, en: false }])));
  const [open, setOpen] = useState([]);
  const [matched, setMatched] = useState([]);
  const [misses, setMisses] = useState(0);
  const done = matched.length === words.length || misses >= MEMORY_MISSES;
  const sent = useRef(false);
  useEffect(() => {
    if (!done || sent.current) return undefined;
    sent.current = true;
    const t = window.setTimeout(() => onDone(matched.length, words.map(word => ({ w: word.w, m: word.m, ok: matched.includes(word.w) }))), 900);
    return () => window.clearTimeout(t);
  }, [done, matched, words, onDone]);
  const flip = index => {
    const tile = tiles[index];
    if (done || open.length >= 2 || open.includes(index) || matched.includes(tile.pair)) return;
    if (tile.en && voice) speak(tile.text);
    sfx.select();
    const next = [...open, index];
    setOpen(next);
    if (next.length < 2) return;
    const [a, b] = next.map(i => tiles[i]);
    if (a.pair === b.pair) {
      sfx.chantOk();
      setMatched(list => [...list, a.pair]);
      setOpen([]);
    } else {
      sfx.chantMiss();
      window.setTimeout(() => { setOpen([]); setMisses(count => count + 1); }, 850);
    }
  };
  return <div className="ea-game ea-memory">
    <p className="ea-game-status"><span>配對 <b>{matched.length}</b> / {words.length}</span><span>翻錯 <b>{misses}</b> / {MEMORY_MISSES}</span></p>
    <div className="ea-memory-grid">{tiles.map((tile, index) => {
      const shown = open.includes(index) || matched.includes(tile.pair) || done;
      return <button type="button" key={index} className={`ea-memory-tile ${shown ? 'is-open' : ''} ${matched.includes(tile.pair) ? 'is-matched' : ''} ${tile.en ? 'is-en' : 'is-zh'}`}
        onClick={() => flip(index)} disabled={done} aria-label={shown ? tile.text : `第 ${index + 1} 張牌`}>
        {shown ? <span lang={tile.en ? 'en' : 'zh-Hant'}>{tile.text}</span> : <Glyph name="book" size={22}/>}
      </button>;
    })}</div>
    {done && <p className="ea-game-note">{matched.length === words.length ? '全部配對成功！' : '翻錯次數用完了。'}</p>}
  </div>;
}

// ── The Hall of Echoes: hear a word, pick it out of three ──
const ECHO_ROUNDS = 3;
function EchoGame({ pool, speak, onDone }) {
  const [rounds] = useState(() => {
    const used = [];
    return Array.from({ length: ECHO_ROUNDS }, () => { const round = echoRound(pool, used); used.push(round.word); return round; });
  });
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [results, setResults] = useState([]);
  const round = rounds[index];
  const listen = () => speak(round.word, { hideText: true });
  useEffect(() => { const t = window.setTimeout(listen, 350); return () => window.clearTimeout(t); }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const answer = option => {
    if (picked) return;
    const ok = option === round.word;
    if (ok) sfx.chantOk(); else sfx.chantMiss();
    setPicked(option);
    const next = [...results, { w: round.word, m: round.m, ok }];
    setResults(next);
    window.setTimeout(() => {
      if (index + 1 < rounds.length) { setIndex(index + 1); setPicked(null); }
      else onDone(next.filter(item => item.ok).length, next);
    }, 1400);
  };
  return <div className="ea-game ea-echo">
    <p className="ea-game-status"><span>第 <b>{index + 1}</b> / {rounds.length} 題</span><span>答對 <b>{results.filter(item => item.ok).length}</b></span></p>
    <button type="button" className="ea-echo-listen" onClick={listen}><Glyph name="echo" size={26}/><span>再聽一次</span></button>
    <div className="ea-echo-options">{round.options.map(option => <button type="button" key={option} lang="en" disabled={Boolean(picked)} onClick={() => answer(option)}
      className={picked ? (option === round.word ? 'is-right' : option === picked ? 'is-wrong' : 'is-faded') : ''}>{option}</button>)}</div>
    {picked && <p className="ea-game-note">{picked === round.word ? '答對了！' : '回聲說的是'} <b lang="en">{round.word}</b>（{round.meaning}）</p>}
  </div>;
}

// ── Sword, Shield, Scroll ──
function DuelGame({ game, onMove }) {
  const last = game.rounds?.at(-1);
  const count = game.rounds?.length || 0;
  useEffect(() => {
    if (!last) return;
    if (last.outcome === 'win') sfx.chantOk(); else if (last.outcome === 'lose') sfx.chantMiss(); else sfx.select();
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps
  const label = { win: '你贏了這局！', lose: '騎士贏了這局。', draw: '平手，再來一次！' };
  return <div className="ea-game ea-duel">
    <p className="ea-duel-score"><span>你 <b>{game.you || 0}</b></span><i>:</i><span><b>{game.foe || 0}</b> 騎士</span></p>
    {last && <p className={`ea-duel-last is-${last.outcome}`} key={count}>
      <span><Glyph name={DUEL_MOVES[last.you].glyph} size={22}/>{DUEL_MOVES[last.you].zh}</span><i>vs</i>
      <span><Glyph name={DUEL_MOVES[last.foe].glyph} size={22}/>{DUEL_MOVES[last.foe].zh}</span><b>{label[last.outcome]}</b>
    </p>}
    <div className="ea-duel-moves">{Object.entries(DUEL_MOVES).map(([id, move]) => <button type="button" key={id} onClick={() => onMove(id)}>
      <Glyph name={move.glyph} size={30}/><b lang="en">{move.en}</b><small>{move.zh}</small>
    </button>)}</div>
    <p className="ea-game-note">劍勝卷軸 · 卷軸勝盾 · 盾勝劍</p>
  </div>;
}

function ClimbMeter({ game, def }) {
  const levels = def.climb.loot.length;
  return <div className="ea-climb" aria-label={`高度 ${game.step} / ${levels}，戰利品 ${game.loot} 金幣`}>
    <ol>{Array.from({ length: levels }, (_, i) => <li key={i} className={i < game.step ? 'is-done' : i === game.step && !game.fell ? 'is-next' : ''}>{i === levels - 1 ? <Glyph name="treasure" size={14}/> : i + 1}</li>)}</ol>
    <p><Glyph name="gold" size={16}/>戰利品 <b>{game.loot}</b> 金幣</p>
  </div>;
}

// ── The Wheel of Wonders ──
const SLICE = 45;
function Wheel({ def, spins, onSpinning }) {
  const segments = def.wheel.segments;
  const angleFor = (segment, turns) => turns * 360 + (360 - (segment * SLICE + SLICE / 2));
  const [rotation, setRotation] = useState(() => (spins.length ? angleFor(spins.at(-1), 0) : 0));
  const [spinning, setSpinning] = useState(false);
  const seen = useRef(spins.length);
  // Layout effect: hide the outcome before the first paint, not one frame late.
  useLayoutEffect(() => {
    if (spins.length === seen.current) return undefined;
    seen.current = spins.length;
    const target = spins.at(-1);
    // Always spin forwards several full turns before landing.
    setRotation(previous => { const base = Math.ceil(previous / 360) * 360 + 360 * 4; return base + (360 - (target * SLICE + SLICE / 2)); });
    setSpinning(true);
    onSpinning(true);
    sfx.select();
    const t = window.setTimeout(() => { setSpinning(false); onSpinning(false); sfx.coin(); }, 2700);
    return () => window.clearTimeout(t);
  }, [spins, onSpinning]);
  const landed = spins.length && !spinning ? segments[spins.at(-1)] : null;
  const point = (angle, radius) => [100 + radius * Math.sin((angle * Math.PI) / 180), 100 - radius * Math.cos((angle * Math.PI) / 180)];
  return <div className="ea-wheel">
    <div className="ea-wheel-pointer" aria-hidden="true"/>
    <svg viewBox="0 0 200 200" className={`ea-wheel-disc ${spinning ? 'is-spinning' : ''}`} style={{ transform: `rotate(${rotation}deg)` }} aria-hidden="true">
      {segments.map((segment, i) => {
        const [x1, y1] = point(i * SLICE, 96), [x2, y2] = point((i + 1) * SLICE, 96), [gx, gy] = point(i * SLICE + SLICE / 2, 64);
        return <g key={i}>
          <path d={`M100 100 L${x1} ${y1} A96 96 0 0 1 ${x2} ${y2} Z`} fill={segment.color} stroke="rgba(20, 12, 30, .55)" strokeWidth="1.5"/>
          <Glyph name={segment.glyph} size={24} x={gx - 12} y={gy - 12} style={{ color: '#2a1838' }}/>
        </g>;
      })}
      <circle cx="100" cy="100" r="16" fill="#2a1838" stroke="#e8c47a" strokeWidth="3"/>
    </svg>
    <p className="ea-wheel-label" aria-live="polite">{spinning ? '轉盤轉動中……' : landed ? <>停在 <b>{landed.zh}</b>！</> : '每一格都有獎品……大概吧。'}</p>
  </div>;
}

export function EventScreen({ run, dispatch, speak, voice, pool = [], onWord }) {
  const ev = run.event;
  const def = eventDef(ev.id);
  const [showZh, setShowZh] = useState(!def.riddle);
  const [wheelBusy, setWheelBusy] = useState(false);
  const choices = eventChoices(run);
  const riddle = def.riddle ? def.riddles[ev.riddle] : null;
  const body = eventBody(run);
  const game = ev.game;
  const choose = (choice, index) => {
    const line = choice.effects?.find(effect => effect.op === 'speak');
    if (line) speak(line.text);
    if (def.riddle && index < riddle.options.length) { if (riddle.options[index].ok) sfx.chantOk(); else sfx.chantMiss(); }
    dispatch({ type: 'EVENT_CHOOSE', index });
  };
  const finishGame = (score, words) => {
    words.forEach(word => onWord?.(word.w, word.ok));
    dispatch({ type: 'EVENT_GAME', score, words });
  };
  const playing = game && ['memory', 'echo', 'duel'].includes(game.kind) && !ev.result;
  const hideChoices = wheelBusy;
  return <section className="ea-room ea-event" aria-label={def.title.zh}>
    <div className={`ea-room-panel is-event ${playing ? 'is-playing' : ''}`}>
      <EventScene id={ev.id} art={def.art}/>
      <span className="ea-eyebrow" lang="en">{ev.id === 'keeper' ? 'PROLOGUE' : 'EVENT'}</span>
      <h2><span lang="en">{def.title.en}</span><small>{def.title.zh}</small></h2>
      <div className="ea-story" key={ev.stage || 'start'}>
        <p lang="en">{body.en}<button type="button" className="ea-speak" onClick={() => speak(body.en)} aria-label="朗讀英文">♪</button></p>
        <p className="ea-zh">{body.zh}</p>
        {riddle && <div className="ea-riddle">
          <p lang="en"><b>{riddle.q.en}</b><button type="button" className="ea-speak" onClick={() => speak(riddle.q.en)} aria-label="朗讀謎題">♪</button></p>
          {showZh ? <p className="ea-zh">{riddle.q.zh}</p> : <button type="button" className="ea-link" onClick={() => setShowZh(true)}>需要中文提示嗎？</button>}
        </div>}
      </div>
      {game?.kind === 'climb' && <ClimbMeter game={game} def={def}/>}
      {game?.kind === 'wheel' && <Wheel def={def} spins={game.spins} onSpinning={setWheelBusy}/>}
      {playing && game.kind === 'memory' && <MemoryGame pool={pool} speak={speak} voice={voice} onDone={finishGame}/>}
      {playing && game.kind === 'echo' && <EchoGame pool={pool} speak={speak} onDone={finishGame}/>}
      {playing && game.kind === 'duel' && <DuelGame game={game} onMove={move => dispatch({ type: 'EVENT_DUEL', move })}/>}
      {!ev.result && !hideChoices && choices.length > 0 && <div className="ea-event-choices">{choices.map((choice, index) => {
        const ok = meetsReq(run, choice.req);
        return <button type="button" key={`${ev.stage || ''}${index}`} className="ea-choice" disabled={!ok} onClick={() => choose(choice, index)}>
          <span className="ea-choice-mark" aria-hidden="true">{index + 1}</span>
          <span><b lang="en">{choice.en}</b>{(showZh || !riddle || index === choices.length - 1) && <small>{choice.zh}{choice.note ? ` — ${choice.note}` : ''}</small>}</span>
        </button>;
      })}</div>}
      {!ev.result && !hideChoices && game?.kind === 'wheel' && ev.gains?.length > 0 && <div className="ea-gains">{ev.gains.map((gain, index) => <Gain key={index} gain={gain}/>)}</div>}
      {ev.result && !hideChoices && <div className="ea-event-result">
        <p lang="en">{ev.result.en}</p><p className="ea-zh">{ev.result.zh}</p>
        {ev.gains?.length > 0 && <div className="ea-gains">{ev.gains.map((gain, index) => <Gain key={index} gain={gain}/>)}</div>}
        <button type="button" className="ea-btn is-gold" disabled={Boolean(run.pending)} onClick={() => dispatch({ type: 'EVENT_CONTINUE' })}>{ev.id === 'keeper' ? '踏入書庫 →' : '繼續前進 →'}</button>
      </div>}
    </div>
  </section>;
}

export default EventScreen;
