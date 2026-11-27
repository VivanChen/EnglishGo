import { useState } from 'react';
import { WAVE_COUNT } from '../data/enemies.js';
import { DIFFICULTIES, HEROES, HERO_IDS, heroUnlocked } from '../data/heroes.js';
import { ITEMS } from '../data/items.js';
import { TIERS, WEAPONS } from '../data/weapons.js';
import { TITLE_ART, heroArt, itemArt, weaponArt } from '../art.js';
import { hasHaptics, play } from '../sound.js';
import { Art, StarIcon, Toggle } from './parts.jsx';

export function TitleScreen({ saved, meta, onContinue, onNew, onBack, onSetting }) {
  const [confirmNew, setConfirmNew] = useState(false);
  const settings = meta.settings;
  return <section className="db-title" aria-labelledby="db-title-name">
    <button type="button" className="db-back" onClick={onBack}>← 遊戲島</button>
    <div className="db-hero-banner">
      <img src={TITLE_ART} alt="" className="db-hero-banner-art" draggable="false"/>
      <div className="db-hero-banner-copy">
        <span className="db-kicker" lang="en">ARENA SURVIVAL · 12 WAVES</span>
        <h1 id="db-title-name">塗鴉大亂鬥</h1>
        <em lang="en">Doodle Brawl</em>
        <p>墨水怪從筆記本裡跑出來了！帶著文具武器撐過 12 波攻勢，打倒墨水大王。</p>
      </div>
    </div>
    <div className="db-title-actions">
      {saved && <button type="button" className="db-btn is-primary is-big" onClick={() => { play('go'); onContinue(); }}>
        繼續：{saved.phase === 'wave' ? `第 ${saved.wave} 波（本波重新開始）` : `第 ${saved.wave} 波結束後`} · {HEROES[saved.hero]?.zh}
      </button>}
      {!saved || !confirmNew
        ? <button type="button" className={`db-btn is-big ${saved ? '' : 'is-primary'}`} onClick={() => { play('select'); if (saved) setConfirmNew(true); else onNew(); }}>開始新遊戲</button>
        : <button type="button" className="db-btn is-big is-danger" onClick={onNew}>確定？目前的進度會被取代</button>}
    </div>
    <ol className="db-howto">
      <li><b>① 移動閃避</b><span>電腦用 WASD／方向鍵，手機按住畫面拖曳。碰到墨水怪會受傷！</span></li>
      <li><b>② 自動攻擊</b><span>武器會自己瞄準最近的敵人。撿星星升級、存錢。</span></li>
      <li><b>③ 商店變強</b><span>每波結束去文具小舖買武器和道具，相同武器可以合成升級。</span></li>
    </ol>
    <div className="db-records" aria-label="紀錄">
      <span><small>最佳紀錄</small><b>{meta.bestWave >= WAVE_COUNT ? '通關！' : `第 ${meta.bestWave} 波`}</b></span>
      <span><small>打倒大王</small><b>{meta.wins} 次</b></span>
      <span><small>遊玩</small><b>{meta.runs} 局</b></span>
    </div>
    <div className="db-settings">
      <Toggle label="音效" hint="射擊、撿星星和升級的聲音" checked={settings.sfx} onChange={value => onSetting('sfx', value)}/>
      <Toggle label="寶箱密語" hint="開寶箱前可以回答一個英文單字題，答對寶物升級" checked={settings.words} onChange={value => onSetting('words', value)}/>
      <Toggle label="單字發音" hint="寶箱密語出現時唸出英文" checked={settings.voice} onChange={value => onSetting('voice', value)}/>
      {hasHaptics() && <Toggle label="震動" hint="受傷時手機會輕輕震動" checked={settings.haptics} onChange={value => onSetting('haptics', value)}/>}
    </div>
  </section>;
}

export function NewRunScreen({ meta, onStart, onBack }) {
  const firstUnlocked = heroUnlocked(meta.lastHero, meta) ? meta.lastHero : 'sketch';
  const [hero, setHero] = useState(firstUnlocked);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[meta.lastDifficulty] ? meta.lastDifficulty : 'easy');
  return <section className="db-newrun" aria-labelledby="db-newrun-title">
    <button type="button" className="db-back" onClick={onBack}>← 返回</button>
    <h2 id="db-newrun-title">選一位塗鴉英雄</h2>
    <div className="db-hero-grid" role="radiogroup" aria-label="英雄">
      {HERO_IDS.map(id => {
        const def = HEROES[id];
        const open = heroUnlocked(id, meta);
        const weapon = WEAPONS[def.weapon];
        return <button type="button" role="radio" aria-checked={hero === id} key={id} disabled={!open} className={`db-hero-card ${hero === id ? 'is-picked' : ''} ${open ? '' : 'is-locked'}`} style={{ '--hero': def.color, '--accent': def.accent }} onClick={() => { play('select'); setHero(id); }}>
          <Art src={heroArt(id)} label={def.en} size={96}/>
          <b lang="en">{def.en}</b>
          <span>{def.zh}</span>
          {open ? <>
            <small>{def.perk}</small>
            <em><Art src={weaponArt(def.weapon)} label={weapon.en} size={26}/>起始武器：<span lang="en">{weapon.en}</span> {weapon.zh}</em>
          </> : <small className="db-lock-note">🔒 {def.unlock.text}</small>}
        </button>;
      })}
    </div>
    <h3>難度</h3>
    <div className="db-difficulty" role="radiogroup" aria-label="難度">
      {Object.entries(DIFFICULTIES).map(([id, def]) => <button type="button" role="radio" aria-checked={difficulty === id} key={id} className={difficulty === id ? 'is-picked' : ''} onClick={() => { play('select'); setDifficulty(id); }}>
        <b lang="en">{def.en}</b><span>{def.zh}</span><small>{def.text}</small>
      </button>)}
    </div>
    <div className="db-newrun-go">
      <button type="button" className="db-btn is-primary is-big" onClick={() => onStart(hero, difficulty)}>出發！</button>
    </div>
  </section>;
}

export function SummaryScreen({ run, unlocked = [], speak, onAgain, onTitle }) {
  const won = run.phase === 'victory';
  const hero = HEROES[run.hero];
  const items = Object.entries(run.items).filter(([, count]) => count > 0);
  const minutes = run.endedAt && run.startedAt ? Math.max(1, Math.round((run.endedAt - run.startedAt) / 60000)) : null;
  return <section className={`db-summary ${won ? 'is-win' : 'is-lose'}`} aria-labelledby="db-summary-title">
    <div className="db-summary-head">
      <Art src={heroArt(run.hero)} label={hero.en} size={120} className={won ? 'is-bobbing' : 'is-sad'}/>
      <div>
        <span className="db-kicker" lang="en">{won ? 'VICTORY!' : 'GAME OVER'}</span>
        <h2 id="db-summary-title">{won ? '打倒墨水大王，筆記本得救了！' : `在第 ${run.wave} 波倒下了`}</h2>
        <p>{won ? `${hero.zh}成功撐過全部 ${WAVE_COUNT} 波！` : '別灰心，換個武器組合再試一次！'}</p>
      </div>
    </div>
    {unlocked.map(id => <p key={id} className="db-unlock">🎉 新英雄解鎖：<b lang="en">{HEROES[id].en}</b> {HEROES[id].zh}！</p>)}
    <div className="db-records">
      <span><small>波數</small><b>{won ? WAVE_COUNT : run.wave - 1} / {WAVE_COUNT}</b></span>
      <span><small>打倒墨水怪</small><b>{run.kills}</b></span>
      <span><small>等級</small><b>{run.level}</b></span>
      <span><small>總傷害</small><b>{run.damage.toLocaleString()}</b></span>
      {minutes && <span><small>時間</small><b>{minutes} 分鐘</b></span>}
    </div>
    <div className="db-summary-build">
      <h3>最後的配備</h3>
      <div className="db-summary-icons">
        {run.weapons.map((w, i) => <span key={`w${i}`} className="db-item-chip" style={{ '--tier': TIERS[w.tier].color }} title={`${WEAPONS[w.id].en} ${TIERS[w.tier].roman}`}><Art src={weaponArt(w.id)} label={WEAPONS[w.id].en} size={40}/></span>)}
        {items.map(([id, count]) => <span key={id} className="db-item-chip" style={{ '--tier': TIERS[ITEMS[id].tier].color }} title={`${ITEMS[id].en} ${ITEMS[id].zh}`}><Art src={itemArt(id)} label={ITEMS[id].en} size={40}/>{count > 1 && <b>×{count}</b>}</span>)}
      </div>
    </div>
    {run.words.length > 0 && <div className="db-word-review">
      <h3>寶箱密語回顧 <small>答對 {run.words.filter(word => word.ok).length} / {run.words.length}</small></h3>
      <ul>{run.words.map((word, index) => <li key={`${word.w}-${index}`} className={word.ok ? 'is-right' : 'is-wrong'}>
        <button type="button" onClick={() => speak?.(word.w)} aria-label={`聽 ${word.w}`}>🔊</button>
        <b lang="en">{word.w}</b><span>{word.m}</span><i aria-label={word.ok ? '答對' : '再練習'}>{word.ok ? '✓' : '↺'}</i>
      </li>)}</ul>
    </div>}
    <div className="db-between-actions">
      <button type="button" className="db-btn" onClick={onTitle}>回到標題</button>
      <button type="button" className="db-btn is-primary" autoFocus onClick={onAgain}>再玩一次 <StarIcon size={16}/></button>
    </div>
  </section>;
}
