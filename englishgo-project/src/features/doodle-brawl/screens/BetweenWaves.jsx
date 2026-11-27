import { useEffect, useMemo, useRef, useState } from 'react';
import { makeChant } from '../../echo-archive/chant.js';
import { ELITE_WAVES, ENEMIES, WAVE_COUNT } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { STATS, formatStat } from '../data/stats.js';
import { MAX_WEAPONS, TIERS, WEAPONS } from '../data/weapons.js';
import { computeStats, recycleValue, rerollCost, weaponSellValue } from '../engine/build.js';
import { addWeapon, combinePartner } from '../engine/run.js';
import { itemArt, pickupArt, weaponArt } from '../art.js';
import { play } from '../sound.js';
import { Art, Modal, StarIcon, Stars, StatSheet, ThingText, TierTag, thingName } from './parts.jsx';

function Header({ run, kicker, title, children }) {
  return <header className="db-between-head">
    <div><span className="db-kicker" lang="en">{kicker}</span><h2>{title}</h2>{children}</div>
    <Stars value={run.stars} className="is-big"/>
  </header>;
}

export function LevelUpScreen({ run, dispatch }) {
  const stats = useMemo(() => computeStats(run), [run]);
  const cost = rerollCost(run.wave, run.levelRerolls);
  const levelNumber = run.level - run.pendingLevels + 1;
  return <section className="db-between db-levelup" aria-labelledby="db-levelup-title">
    <Header run={run} kicker="LEVEL UP!" title={<span id="db-levelup-title">升到 {levelNumber} 級！選一項能力</span>}>
      <p>{run.pendingLevels > 1 ? `這一波升了好幾級，還有 ${run.pendingLevels - 1} 次可以選。` : '每升一級，最大生命也會 +1。'}</p>
    </Header>
    <div className="db-choice-grid">
      {run.levelOffer.map((choice, index) => {
        const def = STATS[choice.stat];
        const current = Math.round(stats[choice.stat] * 10) / 10;
        return <button type="button" key={`${choice.stat}-${index}`} className="db-choice" style={{ '--tier': TIERS[choice.tier].color }} onClick={() => { play('levelup'); dispatch({ type: 'PICK_LEVEL', index }); }}>
          <TierTag tier={choice.tier}/>
          <strong>{formatStat(choice.stat, choice.value)}</strong>
          <b lang="en">{def.en}</b>
          <span>{def.zh}</span>
          <small>目前 {choice.stat === 'maxHp' ? current : formatStat(choice.stat, current)}</small>
        </button>;
      })}
    </div>
    <div className="db-between-actions">
      <button type="button" className="db-btn" disabled={run.stars < cost} onClick={() => { play('reroll'); dispatch({ type: 'REROLL_LEVEL' }); }}>重抽選項 <StarIcon size={16}/>{cost}</button>
    </div>
  </section>;
}

export function CrateScreen({ run, dispatch, pool, wordsOn, speak, onWord }) {
  const recent = run.words.slice(-12).map(word => word.w);
  const [question] = useState(() => (wordsOn ? makeChant(pool, recent) : null));
  const [picked, setPicked] = useState(null);
  const timer = useRef(0);
  // Say the word once, when the box first appears.
  const firstWord = useRef(question?.direction === 'en' && !run.crate ? question.word : null);
  useEffect(() => {
    if (firstWord.current) { speak?.(firstWord.current); firstWord.current = null; }
    return () => window.clearTimeout(timer.current);
  }, [speak]);

  if (run.crate) {
    const id = run.crate.item;
    const item = ITEMS[id];
    const value = recycleValue(id, run.wave);
    return <section className="db-between db-crate is-open" aria-labelledby="db-crate-title">
      <Header run={run} kicker="MYSTERY BOX" title={<span id="db-crate-title">{run.crate.ok ? '密語正確，寶箱升級了！' : '寶箱打開了！'}</span>}>
        {run.crates > 1 && <p>還有 {run.crates - 1} 個寶箱。</p>}
      </Header>
      <article className={`db-reveal ${run.crate.ok ? 'is-boosted' : ''}`} style={{ '--tier': TIERS[item.tier].color }}>
        <Art src={itemArt(id)} label={item.en} size={120}/>
        <div>
          <TierTag tier={item.tier}/>
          <h3><b lang="en">{item.en}</b><span>{item.zh}</span></h3>
          <ThingText kind="item" id={id} tier={item.tier}/>
        </div>
      </article>
      <div className="db-between-actions">
        <button type="button" className="db-btn" onClick={() => { play('buy'); dispatch({ type: 'RECYCLE_CRATE' }); }}>回收 <StarIcon size={16}/>+{value}</button>
        <button type="button" className="db-btn is-primary" autoFocus onClick={() => { play('crate'); dispatch({ type: 'TAKE_CRATE' }); }}>收下</button>
      </div>
    </section>;
  }

  const open = (ok, word) => dispatch({ type: 'OPEN_CRATE', ok, word });
  const choose = index => {
    if (picked !== null) return;
    const ok = question.options[index].ok;
    setPicked(index);
    play(ok ? 'right' : 'wrong');
    onWord?.(question.word, ok);
    timer.current = window.setTimeout(() => open(ok, { w: question.word, m: question.meaning }), ok ? 650 : 1500);
  };
  const correct = question?.options.findIndex(option => option.ok);
  return <section className="db-between db-crate" aria-labelledby="db-crate-title">
    <Header run={run} kicker="MYSTERY BOX" title={<span id="db-crate-title">你撿到了神秘寶箱！</span>}>
      <p>{question ? '答對密語，寶箱裡的東西會升級一級。答錯或跳過也照樣能打開。' : '打開看看裡面有什麼！'}</p>
    </Header>
    <div className="db-crate-stage">
      <Art src={pickupArt('crate')} label="Box" size={110} className={picked !== null ? 'is-shaking' : 'is-bobbing'}/>
      {question && <div className="db-word-card">
        <span className="db-kicker">{question.direction === 'en' ? '這個英文是什麼意思？' : '這個意思的英文是？'}</span>
        <div className="db-word-row">
          <strong lang={question.direction === 'en' ? 'en' : 'zh-Hant'}>{question.direction === 'en' ? question.word : question.meaning}</strong>
          {question.direction === 'en' && <button type="button" className="db-speak" onClick={() => speak?.(question.word)} aria-label={`再聽一次 ${question.word}`}>🔊</button>}
        </div>
        <div className="db-word-options">
          {question.options.map((option, index) => {
            const state = picked === null ? '' : index === correct ? 'is-right' : index === picked ? 'is-wrong' : 'is-dim';
            return <button type="button" key={option.label} className={`db-word-option ${state}`} lang={question.direction === 'en' ? 'zh-Hant' : 'en'} disabled={picked !== null} onClick={() => choose(index)}>{option.label}</button>;
          })}
        </div>
        {picked !== null && !question.options[picked].ok && <p className="db-word-answer" role="status"><b lang="en">{question.word}</b> = {question.meaning}</p>}
      </div>}
    </div>
    <div className="db-between-actions">
      {question
        ? <button type="button" className="db-btn is-quiet" disabled={picked !== null} onClick={() => open(null, null)}>跳過，直接打開</button>
        : <button type="button" className="db-btn is-primary" autoFocus onClick={() => { play('crate'); open(null, null); }}>打開寶箱</button>}
    </div>
  </section>;
}

function OfferCard({ run, slot, index, dispatch }) {
  const { en, zh, art, label } = thingName(slot.kind, slot.id);
  if (slot.sold) return <div className="db-offer is-sold" aria-label="已售出"><span>已買下 ✓</span></div>;
  const afford = run.stars >= slot.price;
  const merged = slot.kind === 'weapon' && run.weapons.length >= MAX_WEAPONS ? addWeapon(run.weapons, slot) : null;
  const full = slot.kind === 'weapon' && run.weapons.length >= MAX_WEAPONS && !merged;
  const owned = slot.kind === 'item' ? run.items[slot.id] || 0 : run.weapons.filter(w => w.id === slot.id && w.tier === slot.tier).length;
  return <article className={`db-offer ${slot.locked ? 'is-locked' : ''}`} style={{ '--tier': TIERS[slot.tier].color }}>
    <div className="db-offer-top">
      <TierTag tier={slot.tier}/>
      <button type="button" className={`db-lock ${slot.locked ? 'is-on' : ''}`} aria-pressed={Boolean(slot.locked)} aria-label={slot.locked ? `解除鎖定 ${en}` : `鎖定 ${en}，下次重抽時保留`} onClick={() => { play('select'); dispatch({ type: 'LOCK', slot: index }); }}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d={slot.locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.6-1.7'} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>
      </button>
    </div>
    <Art src={art} label={en} size={84}/>
    <h3><b lang="en">{en}</b><span>{zh}</span></h3>
    <small className="db-offer-kind">{label}{owned ? ` · 已有 ${owned}` : ''}</small>
    <ThingText kind={slot.kind} id={slot.id} tier={slot.tier}/>
    {merged && <p className="db-offer-note">武器欄已滿，買下會直接合成升級！</p>}
    <button type="button" className="db-buy" disabled={!afford || full} onClick={() => { play('buy'); dispatch({ type: 'BUY', slot: index }); }} aria-label={`買下 ${en}，${slot.price} 顆星星`}>
      {full ? '武器欄已滿' : <><StarIcon size={18}/>{slot.price}</>}
    </button>
  </article>;
}

export function ShopScreen({ run, dispatch, onNext }) {
  const stats = useMemo(() => computeStats(run), [run]);
  const [picked, setPicked] = useState(null);
  const [sheet, setSheet] = useState(false);
  const cost = rerollCost(run.wave, run.shop.rerolls);
  const nextWave = run.wave + 1;
  const elite = ELITE_WAVES[nextWave];
  const weapon = picked !== null ? run.weapons[picked] : null;
  const partner = picked !== null ? combinePartner(run.weapons, picked) : -1;
  const itemList = Object.entries(run.items).filter(([, count]) => count > 0);
  return <section className="db-between db-shop" aria-labelledby="db-shop-title">
    <Header run={run} kicker={`WAVE ${run.wave} CLEAR`} title={<span id="db-shop-title">文具小舖 <small lang="en">Shop</small></span>}>
      <p>{run.lastHarvest > 0 ? `收穫 +${run.lastHarvest} 顆星星。` : ''}用星星買武器和道具。兩把同階的相同武器可以合成升級。</p>
    </Header>
    <div className="db-shop-body">
      <div className="db-shop-main">
        <div className="db-offers">{run.shop.slots.map((slot, index) => <OfferCard key={slot.key} run={run} slot={slot} index={index} dispatch={dispatch}/>)}</div>
        <div className="db-shop-tools">
          <button type="button" className="db-btn" disabled={run.stars < cost} onClick={() => { play('reroll'); dispatch({ type: 'REROLL_SHOP' }); }}>重抽商品 <StarIcon size={16}/>{cost}</button>
          <span className="db-shop-tip">🔒 鎖住的商品重抽時會留下來</span>
        </div>
      </div>
      <aside className="db-build" aria-label="你的配備">
        <div className="db-build-head"><h3>武器 <small>{run.weapons.length} / {MAX_WEAPONS}</small></h3><button type="button" className="db-link" onClick={() => setSheet(true)}>查看能力值</button></div>
        <div className="db-weapon-slots">
          {Array.from({ length: MAX_WEAPONS }, (_, index) => {
            const w = run.weapons[index];
            if (!w) return <span key={index} className="db-slot is-empty" aria-hidden="true"/>;
            const canCombine = combinePartner(run.weapons, index) >= 0;
            return <button type="button" key={index} className={`db-slot ${canCombine ? 'can-combine' : ''}`} style={{ '--tier': TIERS[w.tier].color }} onClick={() => { play('select'); setPicked(index); }} aria-label={`${WEAPONS[w.id].en} ${TIERS[w.tier].roman} 階${canCombine ? '，可以合成' : ''}`}>
              <Art src={weaponArt(w.id)} label={WEAPONS[w.id].en} size={44}/><b lang="en">{TIERS[w.tier].roman}</b>{canCombine && <i aria-hidden="true">⇧</i>}
            </button>;
          })}
        </div>
        <h3>道具 <small>{itemList.reduce((sum, [, count]) => sum + count, 0)}</small></h3>
        {itemList.length ? <div className="db-item-list">{itemList.map(([id, count]) => <span key={id} className="db-item-chip" title={`${ITEMS[id].en} ${ITEMS[id].zh}`} style={{ '--tier': TIERS[ITEMS[id].tier].color }}>
          <Art src={itemArt(id)} label={ITEMS[id].en} size={36}/>{count > 1 && <b>×{count}</b>}
        </span>)}</div> : <p className="db-empty">還沒有道具。道具的效果可以疊加！</p>}
      </aside>
    </div>
    <div className="db-shop-go">
      {(elite || nextWave >= WAVE_COUNT) && <p className="db-warning">⚠ {nextWave >= WAVE_COUNT ? '最後一波：墨水大王！' : `下一波會出現精英怪 ${ENEMIES[elite].en}（${ENEMIES[elite].zh}）`}</p>}
      <button type="button" className="db-btn is-primary is-big" onClick={() => { play('go'); onNext(); }}>{nextWave >= WAVE_COUNT ? '挑戰墨水大王 →' : `開始第 ${nextWave} 波 →`}</button>
    </div>

    {weapon && <Modal title={`${WEAPONS[weapon.id].zh} ${TIERS[weapon.tier].roman}`} kicker={WEAPONS[weapon.id].en} onClose={() => setPicked(null)} className="db-weapon-modal">
      <div className="db-weapon-detail" style={{ '--tier': TIERS[weapon.tier].color }}><Art src={weaponArt(weapon.id)} label={WEAPONS[weapon.id].en} size={88}/><ThingText kind="weapon" id={weapon.id} tier={weapon.tier}/></div>
      {partner < 0 && weapon.tier < 3 && <p className="db-modal-note">再拿到一把 {TIERS[weapon.tier].roman} 階的{WEAPONS[weapon.id].zh}就能合成升級。</p>}
      <div className="db-modal-actions">
        <button type="button" className="db-btn is-danger" disabled={run.weapons.length <= 1} onClick={() => { play('buy'); dispatch({ type: 'SELL', index: picked }); setPicked(null); }}>賣出 <StarIcon size={16}/>+{weaponSellValue(weapon, run.wave)}</button>
        <button type="button" className="db-btn is-primary" disabled={partner < 0} onClick={() => { play('levelup'); dispatch({ type: 'COMBINE', index: picked }); setPicked(null); }}>合成升級 → {TIERS[Math.min(3, weapon.tier + 1)].roman}</button>
      </div>
    </Modal>}
    {sheet && <Modal title="能力值" kicker="STATS" onClose={() => setSheet(false)} className="db-sheet-modal">
      <StatSheet stats={stats}/>
      <div className="db-modal-actions"><button type="button" className="db-btn is-primary" onClick={() => setSheet(false)}>關閉</button></div>
    </Modal>}
  </section>;
}
