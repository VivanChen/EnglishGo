import { useMemo, useState } from 'react';
import { ARCHIVE_CARDS, CARDS } from '../data/cards.js';
import { ACTS, zoneOf } from '../data/enemies.js';
import { DAILY_BLESSINGS, DAILY_TRIALS, MAX_SILENCE, TRIALS, TRIAL_IDS, dailyBonus, dailyChallenge, dateKey, previousDateKey, silenceRules, trialBonus } from '../data/challenges.js';
import { HEROES, HERO_IDS, heroUnlocked } from '../data/heroes.js';
import { DIFFICULTIES } from '../engine/engine.js';
import { PULL_COST } from '../archive.js';
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

function ArchiveLinks({ collection, onGacha, onCodex }) {
  const owned = ARCHIVE_CARDS.filter(id => collection.owned[id] > 0).length;
  return <div className="ea-archive-links">
    <button type="button" className="ea-archive-link is-gacha" onClick={onGacha}>
      <Glyph name="gem" size={26}/><span><b>書頁扭蛋</b><small>{collection.notice?.kind === 'foilRefund' ? `閃卡規則更新 · 退還 ${collection.notice.shards} 墨晶` : collection.welcomed ? `召喚新卡牌 · 擁有 ${collection.shards} 墨晶` : '初次見面禮：100 墨晶！'}</small></span>
      {(!collection.welcomed || collection.notice || collection.shards >= PULL_COST) && <i className="ea-dot" aria-label="可以抽卡"/>}
    </button>
    <button type="button" className="ea-archive-link" onClick={onCodex}>
      <Glyph name="book" size={26}/><span><b>卡牌圖鑑</b><small>扭蛋卡 {owned} / {ARCHIVE_CARDS.length}</small></span>
    </button>
  </div>;
}

const outcomeText = result => (result.outcome === 'victory' ? '通關成功！' : result.outcome === 'abandon' ? `中途放棄 · 第 ${result.floor} 層` : `倒在 Act ${ACTS[result.act]?.roman || 'I'} · 第 ${result.floor} 層`);

// Today's challenge: same map, blessing, trial and featured card for the
// whole day; one attempt, with a streak bonus for playing on consecutive days.
function DailyCard({ meta, saved, onDaily, onContinue }) {
  const today = dateKey();
  const challenge = useMemo(() => dailyChallenge(today), [today]);
  const [confirm, setConfirm] = useState(false);
  const blessing = DAILY_BLESSINGS[challenge.blessing], trial = DAILY_TRIALS[challenge.trial], card = CARDS[challenge.card];
  const state = meta.daily?.date === today ? meta.daily : null;
  const live = saved?.daily?.date === today;
  const streak = state ? state.streak : meta.daily?.date === previousDateKey(today) ? meta.daily.streak : 0;
  const nextStreak = state ? state.streak : streak + 1;
  const [, month, day] = today.split('-');
  return <article className={`ea-daily ${state?.result ? 'is-done' : ''}`} aria-labelledby="ea-daily-title">
    <header>
      <span className="ea-daily-date" aria-hidden="true"><b>{Number(day)}</b><small>{Number(month)} 月</small></span>
      <div><span className="ea-eyebrow" lang="en">DAILY CHALLENGE</span><h2 id="ea-daily-title">每日挑戰</h2></div>
      {streak > 0 && <span className="ea-daily-streak" aria-label={`連續 ${streak} 天`}><Glyph name="flame" size={16}/>{streak}</span>}
    </header>
    <ul className="ea-daily-mods">
      <li className="is-blessing" data-tip={blessing.text}><Glyph name={blessing.glyph} size={20}/><span><small>祝福</small><b>{blessing.zh}</b><em>{blessing.text}</em></span></li>
      <li className="is-trial" data-tip={trial.text}><Glyph name={trial.glyph} size={20}/><span><small>試煉</small><b>{trial.zh}</b><em>{trial.text}</em></span></li>
      <li className="is-card"><Glyph name={card.glyph} size={20}/><span><small>今日卡牌</small><b lang="en">{card.en}</b><em>{card.zh}，開局就放在牌組裡</em></span></li>
    </ul>
    <footer>
      {state?.result ? <p className="ea-daily-result"><b>{outcomeText(state.result)}</b><small>今天的挑戰完成了，明天會有新的書庫。</small></p>
        : live ? <button type="button" className="ea-btn is-gold" onClick={onContinue}>繼續今日挑戰 →</button>
        : state ? <p className="ea-daily-result"><b>今天已經挑戰過了</b><small>明天會有新的書庫。</small></p>
        : <>
          <small className="ea-daily-reward">{HEROES[heroUnlocked(challenge.hero, meta) ? challenge.hero : 'scribe'].zh} · 標準難度 · 墨晶 ×1.5 · 完成再 +{dailyBonus(nextStreak)}</small>
          {saved && confirm ? <button type="button" className="ea-btn is-danger" onClick={onDaily}>放棄目前進度並開始？</button>
            : <button type="button" className="ea-btn is-gold" onClick={() => (saved ? setConfirm(true) : onDaily())}>接受挑戰 →</button>}
        </>}
    </footer>
  </article>;
}

function SilencePicker({ top, level, setLevel }) {
  const max = Math.min(MAX_SILENCE, top + 1);
  if (max < 1) return <p className="ea-silence is-locked"><Glyph name="crown" size={18}/><span>以英雄難度通關一次，就能解鎖「靜默層級」：共 {MAX_SILENCE} 級，每一級多一條限制，墨晶也更多。</span></p>;
  const rules = silenceRules(level);
  return <div className="ea-silence">
    <div className="ea-silence-head">
      <span><b>靜默層級</b><small>已解鎖到 {max} 級{top >= 0 ? ` · 最高通關 ${top} 級` : ''}</small></span>
      <div className="ea-silence-step">
        <button type="button" onClick={() => setLevel(Math.max(0, level - 1))} disabled={level <= 0} aria-label="降低靜默層級">‹</button>
        <output aria-live="polite" aria-label={`靜默層級 ${level}`}>{level}</output>
        <button type="button" onClick={() => setLevel(Math.min(max, level + 1))} disabled={level >= max} aria-label="提高靜默層級">›</button>
      </div>
    </div>
    {rules.length ? <ol className="ea-silence-rules">{rules.map(rule => <li key={rule.level} className={rule.level === level ? 'is-new' : ''}><i>{rule.level}</i><b>{rule.zh}</b><span>{rule.text}</span></li>)}</ol>
      : <p className="ea-silence-note">第 0 級：一般的英雄難度。</p>}
    <small className="ea-silence-reward">墨晶 ×{(1.5 + level * 0.1).toFixed(1)}{level > top ? ' · 首次通關再 +40' : ''}</small>
  </div>;
}

// Optional trials for any run but the daily one: each adds a rule and more shards.
function TrialPicker({ trials, setTrials }) {
  const bonus = trialBonus(trials);
  const toggle = id => setTrials(list => (list.includes(id) ? list.filter(item => item !== id) : [...list, id]));
  return <details className="ea-trials" open={trials.length > 0}>
    <summary><Glyph name="crown" size={18}/><span><b>自選試煉</b><small>{trials.length ? `已選 ${trials.length} 項 · 墨晶 +${bonus}%` : '想要更難？勾選限制，換更多墨晶'}</small></span></summary>
    <div className="ea-trial-list" role="group" aria-label="自選試煉">
      {TRIAL_IDS.map(id => {
        const trial = TRIALS[id], on = trials.includes(id);
        return <button type="button" key={id} role="checkbox" aria-checked={on} className={`ea-trial ${on ? 'is-on' : ''}`} onClick={() => toggle(id)}>
          <Glyph name={trial.glyph} size={20}/>
          <span><b>{trial.zh}<i>+{trial.bonus}%</i></b><small>{trial.text}</small></span>
        </button>;
      })}
    </div>
    {trials.length > 0 && <button type="button" className="ea-link" onClick={() => setTrials([])}>全部取消</button>}
  </details>;
}

function HeroPicker({ meta, hero, setHero }) {
  return <div className="ea-hero-pick" role="radiogroup" aria-label="選擇角色">
    {HERO_IDS.map(id => {
      const info = HEROES[id], open = heroUnlocked(id, meta);
      return <button type="button" key={id} role="radio" aria-checked={hero === id} disabled={!open} className={`ea-hero-option is-${id} ${open ? '' : 'is-locked'}`} onClick={() => setHero(id)}
        aria-label={`${info.en} ${info.zh}，${open ? info.style : `尚未解鎖：${info.unlock}`}`}>
        <span className="ea-hero-portrait" aria-hidden="true"><HeroArt hero={id}/>{!open && <i className="ea-hero-lock"><Glyph name="key" size={16}/></i>}</span>
        <span className="ea-hero-copy"><b lang="en">{info.en}</b><i>{info.zh} · {info.style}</i>
          {open ? <small>{info.text}</small> : <small className="ea-hero-goal"><Glyph name="crown" size={13}/>解鎖條件：{info.unlock}{info.goal ? `（${info.goal.how}）` : ''}</small>}
        </span>
      </button>;
    })}
  </div>;
}

export default function TitleScreen({ saved, meta, onContinue, onNew, onDaily, onBack, onGacha, onCodex, onHistory }) {
  const [picking, setPicking] = useState(false);
  const [difficulty, setDifficulty] = useState(meta.lastDifficulty || 'story');
  const [hero, setHero] = useState(() => (heroUnlocked(meta.lastHero, meta) && HEROES[meta.lastHero] ? meta.lastHero : 'scribe'));
  const top = meta.silenceTop ?? -1;
  const [silence, setSilence] = useState(() => Math.max(0, Math.min(meta.lastSilence || 0, top + 1, MAX_SILENCE)));
  const [trials, setTrials] = useState(() => (meta.lastTrials || []).filter(id => TRIALS[id]));
  const winRate = meta.runs ? Math.round((meta.wins / meta.runs) * 100) : 0;
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
        </div> : <div className="ea-difficulty">
          <HeroPicker meta={meta} hero={hero} setHero={setHero}/>
          <div className="ea-diff-row" role="radiogroup" aria-label="選擇難度">
            {Object.entries(DIFFICULTIES).map(([id, item]) => <button type="button" key={id} role="radio" aria-checked={difficulty === id} className={`ea-diff is-${id}`} onClick={() => setDifficulty(id)}>
              <b lang="en">{item.en}</b><span>{item.zh}</span><small>{item.text}</small><i>♥ {item.heroHp + HEROES[hero].hp}</i>
            </button>)}
          </div>
          {difficulty === 'heroic' && <SilencePicker top={top} level={silence} setLevel={setSilence}/>}
          <TrialPicker trials={trials} setTrials={setTrials}/>
          <div className="ea-difficulty-actions">
            <button type="button" className="ea-btn is-quiet" onClick={() => setPicking(false)}>返回</button>
            <button type="button" className="ea-btn is-gold" onClick={() => onNew(difficulty, difficulty === 'heroic' ? silence : 0, hero, trials)}>{saved ? '放棄目前進度，出發 →' : '出發 →'}</button>
          </div>
        </div>}
        {!picking && meta.collection && <ArchiveLinks collection={meta.collection} onGacha={onGacha} onCodex={onCodex}/>}
        {!picking && meta.runs > 0 && <button type="button" className="ea-records" onClick={onHistory} aria-label="打開遠征紀錄">
          <dl>
            <div><dt>遠征</dt><dd>{meta.runs}</dd></div>
            <div><dt>通關</dt><dd>{meta.wins}</dd></div>
            <div><dt>勝率</dt><dd>{winRate}%</dd></div>
            <div><dt>最遠</dt><dd lang="en">Act {ACTS[Math.max(1, meta.bestAct)]?.roman || 'I'}</dd></div>
            {top >= 0 && <div><dt>靜默</dt><dd>{top}</dd></div>}
          </dl>
          <span className="ea-records-more">遠征紀錄 ›</span>
        </button>}
      </div>
      <div className="ea-title-side">
        <div className="ea-title-art" aria-hidden="true">
          <div className="ea-title-tower"><EnemyArt art="tome" className="ea-title-boss"/></div>
          <HeroArt hero={picking ? hero : meta.lastHero}/>
        </div>
        {!picking && meta.runs > 0 && <DailyCard meta={meta} saved={saved} onDaily={onDaily} onContinue={onContinue}/>}
      </div>
    </div>
    <details className="ea-howto" open={meta.runs === 0}>
      <summary>怎麼玩？</summary>
      <ol>{HOW_TO.map(([icon, text]) => <li key={text}><Glyph name={icon === 'energy' ? 'surge' : icon} size={22}/><span>{text}</span></li>)}</ol>
      <p>鍵盤：數字鍵選牌、再按一次打出；<kbd>E</kbd> 結束回合；<kbd>Esc</kbd> 取消。也可以直接把牌拖到敵人身上。</p>
    </details>
  </section>;
}

export function RunSummary({ run, earned, shards, onAgain, onTitle, onGacha, speak }) {
  const won = run.screen === 'victory';
  const s = run.stats;
  const words = [...s.words].reverse();
  const stats = [
    ['抵達', `Act ${ACTS[run.act].roman}${run.zone ? ` ${ACTS[zoneOf(run)].zh}` : ''} · 第 ${run.floor} 層`],
    ['擊倒敵人', s.kills], ['菁英', s.elites], ['首領', s.bosses],
    ['打出卡牌', s.cards], ['造成傷害', s.damage],
    ['詠唱成功', `${s.chantsOk} / ${s.chants}`], ['牌組', `${run.hero.deck.length} 張`],
  ];
  return <section className={`ea-summary ${won ? 'is-won' : 'is-lost'}`} aria-labelledby="ea-summary-title">
    <Backdrop act={zoneOf(run)}/>
    <div className="ea-summary-panel">
      <span className="ea-eyebrow" lang="en">{run.trueEnding ? 'THE LAST PAGE IS WRITTEN' : won ? 'THE ARCHIVE REMEMBERS' : 'THE SILENCE FALLS'}</span>
      <h1 id="ea-summary-title">{run.trueEnding ? '你寫下了最後一頁' : won ? '話語回來了！' : '這次的遠征結束了'}</h1>
      <p className="ea-summary-mode">{[HEROES[run.hero.id || 'scribe'].zh, run.daily ? `每日挑戰 · ${run.daily.date}` : run.silence > 0 ? `英雄難度 · 靜默層級 ${run.silence}` : DIFFICULTIES[run.difficulty]?.zh, run.trials?.length ? `試煉：${run.trials.map(id => TRIALS[id]?.zh).filter(Boolean).join('、')}` : null].filter(Boolean).join(' · ')}</p>
      <p className="ea-room-lead">{run.trueEnding
        ? '終焉寂靜化成千萬個字，飄回書庫裡的每一本書。三把鑰匙闔上了最後一頁——這是真正的結局。'
        : won ? `${zoneOf(run) === 'observatory' ? '星辰天文台的星光重新亮起，' : '無言之主消散，'}書庫重新響起千萬個聲音。${run.keys && Object.values(run.keys).some(Boolean) ? '不過……你手上的鑰匙似乎還能打開什麼。' : '你是書庫真正的守護者。'}`
        : '寂靜暫時贏了。帶著這次的經驗，下一次會走得更遠。'}</p>
      {(earned?.heroes || []).map(id => <div key={id} className={`ea-unlock is-hero is-${id}`} role="status">
        <span className="ea-unlock-hero" aria-hidden="true"><HeroArt hero={id}/></span>
        <span><b>新角色解鎖：{HEROES[id].zh}（{HEROES[id].en}）！</b><small>{HEROES[id].style} · {HEROES[id].text}</small></span>
      </div>)}
      {earned?.unlocked && <div className="ea-unlock" role="status"><Glyph name="crown" size={28}/><span><b>解鎖靜默層級 {earned.unlocked}！</b><small>{silenceRules(earned.unlocked).at(-1).zh}：{silenceRules(earned.unlocked).at(-1).text}</small></span></div>}
      <dl className="ea-summary-stats">{stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {earned && <div className="ea-earned">
        <Glyph name="gem" size={30}/>
        <span><b>+{earned.total} 墨晶</b><small>{earned.parts.map(([label, amount]) => `${label} ${amount}`).join(' · ')}{earned.mult > 1 ? ` · ${run.daily ? '每日' : '難度'} ×${earned.mult}` : ''}{(earned.bonus || []).map(([label, amount]) => ` · ${label} +${amount}`).join('')}</small></span>
        <button type="button" className="ea-btn is-gold" onClick={onGacha}>去書頁扭蛋（{shards}）</button>
      </div>}
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
