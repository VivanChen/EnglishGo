import { useState } from 'react';
import { ACTS, ENEMIES } from '../data/enemies.js';
import { DAILY_BLESSINGS, DAILY_TRIALS, dateKey, previousDateKey } from '../data/challenges.js';
import { DIFFICULTIES } from '../engine/engine.js';
import { HEROES } from '../data/heroes.js';
import { recordDeck } from '../history.js';
import Glyph from '../components/Glyph.jsx';
import { EnemyArt } from '../components/Creatures.jsx';
import { DeckViewer, RelicIcon } from './RoomScreens.jsx';

const pad = n => String(n).padStart(2, '0');
function when(at) {
  const date = new Date(at);
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function headline(record) {
  if (record.trueEnding) return '真結局：寫下最後一頁';
  if (record.outcome === 'victory') return '通關成功';
  if (record.outcome === 'abandon' && !record.floor) return '出發前就放棄了';
  const place = `Act ${ACTS[record.act]?.roman || 'I'} · 第 ${record.floor} 層`;
  return record.outcome === 'abandon' ? `中途放棄 · ${place}` : `倒在 ${place}`;
}

function modeLabel(record) {
  const hero = record.hero && record.hero !== 'scribe' ? `${HEROES[record.hero]?.zh} · ` : '';
  if (record.daily) return `${hero}每日 ${record.daily.date.slice(5).replace('-', '/')}`;
  const diff = DIFFICULTIES[record.difficulty]?.zh || '標準';
  return `${hero}${record.silence > 0 ? `${diff} · 靜默 ${record.silence}` : diff}${record.trials?.length ? ` · 試煉 ${record.trials.length}` : ''}`;
}

function Medal({ record }) {
  const foe = record.foes?.[0] && ENEMIES[record.foes[0]];
  if (record.outcome === 'victory') return <span className="ea-history-medal is-victory" aria-hidden="true"><Glyph name="crown" size={30}/></span>;
  if (foe) return <span className={`ea-history-medal is-foe ${record.outcome === 'abandon' ? 'is-abandon' : ''}`} aria-hidden="true"><EnemyArt art={foe.art}/></span>;
  return <span className="ea-history-medal is-abandon" aria-hidden="true"><Glyph name="unknown" size={28}/></span>;
}

function Row({ record, onDeck }) {
  const foes = (record.foes || []).map(id => ENEMIES[id]?.zh).filter(Boolean);
  const size = record.deck.reduce((sum, [, count]) => sum + count, 0);
  const relics = record.relics.slice(0, 6);
  const daily = record.daily && [DAILY_BLESSINGS[record.daily.blessing]?.zh, DAILY_TRIALS[record.daily.trial]?.zh].filter(Boolean).join(' × ');
  return <li className={`ea-history-row is-${record.outcome}`}>
    <Medal record={record}/>
    <div className="ea-history-main">
      <div className="ea-history-title">
        <b>{headline(record)}</b>
        <span className={`ea-history-mode ${record.daily ? 'is-daily' : `is-${record.difficulty}`}`}>{modeLabel(record)}</span>
      </div>
      <p className="ea-history-sub">
        {record.outcome === 'defeat' && foes.length > 0 && <span>被 {foes.join('、')} 擊倒</span>}
        {record.outcome === 'abandon' && foes.length > 0 && <span>正與 {foes.join('、')} 交戰</span>}
        {daily && <span>{daily}</span>}
        <span>擊倒 {record.kills} · 傷害 {record.damage}</span>
        {record.chants > 0 && <span>詠唱 {record.chantsOk}/{record.chants}</span>}
      </p>
      <div className="ea-history-meta">
        <time dateTime={new Date(record.at).toISOString()}>{when(record.at)}</time>
        {record.minutes && <span>{record.minutes} 分鐘</span>}
        {record.shards > 0 && <span className="is-shards"><Glyph name="gem" size={13}/>+{record.shards}</span>}
      </div>
    </div>
    <div className="ea-history-side">
      <div className="ea-history-relics">{relics.map(id => <RelicIcon key={id} id={id} size={20}/>)}{record.relics.length > relics.length && <small>+{record.relics.length - relics.length}</small>}</div>
      <button type="button" className="ea-btn is-quiet is-small" onClick={() => onDeck(record)} aria-label={`查看這次的牌組，共 ${size} 張`}><Glyph name="deck" size={16}/>{size} 張</button>
    </div>
  </li>;
}

export default function HistoryScreen({ meta, onBack }) {
  const [deckOf, setDeckOf] = useState(null);
  const history = meta.history || [];
  const today = dateKey();
  const streak = meta.daily && (meta.daily.date === today || meta.daily.date === previousDateKey(today)) ? meta.daily.streak : 0;
  const winRate = meta.runs ? Math.round((meta.wins / meta.runs) * 100) : 0;
  const stats = [
    ['遠征', meta.runs], ['通關', meta.wins], ['勝率', `${winRate}%`],
    ['最遠', `Act ${ACTS[Math.max(1, meta.bestAct)]?.roman || 'I'}`],
    ['最高靜默', (meta.silenceTop ?? -1) >= 0 ? meta.silenceTop : '—'],
    ['每日連續', streak ? `${streak} 天` : '—'],
    ...(meta.trueEndings ? [['真結局', meta.trueEndings]] : []),
  ];
  return <section className="ea-history" aria-labelledby="ea-history-title">
    <header className="ea-archive-head">
      <button type="button" className="ea-back-link is-inline" onClick={onBack}>‹ 回到標題</button>
      <div><span className="ea-eyebrow" lang="en">CHRONICLE</span><h1 id="ea-history-title">遠征紀錄</h1></div>
      <span className="ea-history-spacer" aria-hidden="true"/>
    </header>
    <dl className="ea-history-stats">{stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {history.length ? <>
      <p className="ea-history-note">最近 {history.length} 次遠征（最多保留 20 次）</p>
      <ol className="ea-history-list">{history.map(record => <Row key={record.key} record={record} onDeck={setDeckOf}/>)}</ol>
    </> : <p className="ea-empty">完成或放棄一次遠征後，紀錄就會出現在這裡。</p>}
    {deckOf && <DeckViewer title={`${headline(deckOf)}的牌組`} kicker={modeLabel(deckOf)} cards={recordDeck(deckOf)} onClose={() => setDeckOf(null)}/>}
  </section>;
}
