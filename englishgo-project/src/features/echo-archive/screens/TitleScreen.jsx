import { useState } from 'react';
import { ACTS } from '../data/enemies.js';
import { DIFFICULTIES } from '../engine/engine.js';
import Glyph from '../components/Glyph.jsx';
import { Backdrop, EnemyArt, HeroArt } from '../components/Creatures.jsx';
import { RelicIcon } from './RoomScreens.jsx';

const HOW_TO = [
  ['energy', '每回合有 3 點能量，卡牌左上角的數字是費用。'],
  ['attack', '看清敵人頭上的意圖：劍代表攻擊，盾代表防禦。'],
  ['defend', '用 Ward（護盾）擋下傷害，Ward 會在你的回合開始時歸零。'],
  ['rune', '帶有 ✦ 的 Chant 牌可以詠唱：讀懂符文單字就能強化效果，也可以直接略過。'],
  ['monster', '在地圖上選擇路線：戰鬥拿卡牌，休息回血，商店與事件帶來驚喜。'],
  ['boss', '登上三層書庫，打倒每一層的首領，就能奪回寂靜偷走的話語。'],
];

export default function TitleScreen({ saved, meta, onContinue, onNew, onBack }) {
  const [picking, setPicking] = useState(false);
  const [difficulty, setDifficulty] = useState(meta.lastDifficulty || 'story');
  return <section className="ea-title" aria-labelledby="ea-title-heading">
    <Backdrop act={1}/>
    <button type="button" className="ea-back-link" onClick={onBack}>‹ 回到 EnglishGo</button>
    <div className="ea-title-inner">
      <div className="ea-title-copy">
        <span className="ea-eyebrow" lang="en">A DECKBUILDING ADVENTURE</span>
        <h1 id="ea-title-heading"><span lang="en">Echo Archive</span><b>回聲書庫</b></h1>
        <p className="ea-title-lead">寂靜正在吞噬古老書庫裡的每一個字。帶上一副牌與一盞燈，攀上三層高塔，奪回被偷走的話語。</p>
        {!picking ? <div className="ea-title-actions">
          {saved && <button type="button" className="ea-btn is-gold is-big" onClick={onContinue}>
            <span>繼續遠征</span><small lang="en">Act {ACTS[saved.act].roman} · Floor {saved.floor} · ♥ {saved.hero.hp}/{saved.hero.maxHp}</small>
          </button>}
          <button type="button" className={`ea-btn is-big ${saved ? '' : 'is-gold'}`} onClick={() => setPicking(true)}><span>{saved ? '開始新的遠征' : '開始遠征'}</span><small lang="en">New Run</small></button>
        </div> : <div className="ea-difficulty" role="radiogroup" aria-label="選擇難度">
          {Object.entries(DIFFICULTIES).map(([id, item]) => <button type="button" key={id} role="radio" aria-checked={difficulty === id} className={`ea-diff is-${id}`} onClick={() => setDifficulty(id)}>
            <b lang="en">{item.en}</b><span>{item.zh}</span><small>{item.text}</small><i>♥ {item.heroHp}</i>
          </button>)}
          <div className="ea-difficulty-actions">
            <button type="button" className="ea-btn is-quiet" onClick={() => setPicking(false)}>返回</button>
            <button type="button" className="ea-btn is-gold" onClick={() => onNew(difficulty)}>{saved ? '放棄目前進度，出發 →' : '出發 →'}</button>
          </div>
        </div>}
        {meta.runs > 0 && <dl className="ea-records">
          <div><dt>遠征</dt><dd>{meta.runs}</dd></div>
          <div><dt>通關</dt><dd>{meta.wins}</dd></div>
          <div><dt>最遠</dt><dd lang="en">Act {ACTS[Math.max(1, meta.bestAct)]?.roman || 'I'}</dd></div>
        </dl>}
      </div>
      <div className="ea-title-art" aria-hidden="true">
        <div className="ea-title-tower"><EnemyArt art="tome" className="ea-title-boss"/></div>
        <HeroArt/>
      </div>
    </div>
    <details className="ea-howto" open={meta.runs === 0}>
      <summary>怎麼玩？</summary>
      <ol>{HOW_TO.map(([icon, text]) => <li key={text}><Glyph name={icon === 'energy' ? 'surge' : icon} size={22}/><span>{text}</span></li>)}</ol>
      <p>鍵盤：數字鍵選牌、再按一次打出；<kbd>E</kbd> 結束回合；<kbd>Esc</kbd> 取消。也可以直接把牌拖到敵人身上。</p>
    </details>
  </section>;
}

export function RunSummary({ run, onAgain, onTitle, speak }) {
  const won = run.screen === 'victory';
  const s = run.stats;
  const words = [...s.words].reverse();
  const stats = [
    ['抵達', `Act ${ACTS[run.act].roman} · 第 ${run.floor} 層`],
    ['擊倒敵人', s.kills], ['菁英', s.elites], ['首領', s.bosses],
    ['打出卡牌', s.cards], ['造成傷害', s.damage],
    ['詠唱成功', `${s.chantsOk} / ${s.chants}`], ['牌組', `${run.hero.deck.length} 張`],
  ];
  return <section className={`ea-summary ${won ? 'is-won' : 'is-lost'}`} aria-labelledby="ea-summary-title">
    <Backdrop act={run.act}/>
    <div className="ea-summary-panel">
      <span className="ea-eyebrow" lang="en">{won ? 'THE ARCHIVE REMEMBERS' : 'THE SILENCE FALLS'}</span>
      <h1 id="ea-summary-title">{won ? '話語回來了！' : '這次的遠征結束了'}</h1>
      <p className="ea-room-lead">{won ? '無言之主消散，書庫重新響起千萬個聲音。你是真正的詞術師。' : '寂靜暫時贏了。帶著這次的經驗，下一次會走得更遠。'}</p>
      <dl className="ea-summary-stats">{stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {run.hero.relics.length > 0 && <div className="ea-summary-relics">{run.hero.relics.map(id => <RelicIcon key={id} id={id} size={26}/>)}</div>}
      {words.length > 0 && <details className="ea-summary-words" open={words.length <= 12}>
        <summary>這趟旅程詠唱過的符文（{words.length}）</summary>
        {words.some(word => !word.ok) && <p className="ea-summary-note">標 ↻ 的單字已加入「弱點單字」，可以在單字卡再複習一次。</p>}
        <div>{words.map(word => <button type="button" key={word.w} className={word.ok ? 'is-ok' : 'is-miss'} onClick={() => speak(word.w)}><b lang="en">{word.w}</b><small>{word.m}</small><i aria-label={word.ok ? '答對' : '再複習'}>{word.ok ? '✓' : '↻'}</i></button>)}</div>
      </details>}
      <div className="ea-summary-actions">
        <button type="button" className="ea-btn is-gold" onClick={onAgain}>再遠征一次</button>
        <button type="button" className="ea-btn" onClick={onTitle}>回到標題</button>
      </div>
    </div>
  </section>;
}
