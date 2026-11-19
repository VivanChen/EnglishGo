import { useEffect, useMemo, useRef, useState } from 'react';
import { ARCHETYPES, CARDS, archOf } from '../data/cards.js';
import { POTIONS, RELICS } from '../data/relics.js';
import { KEYS } from '../data/enemies.js';
import { SKIP_CARD_HP, canUpgrade, eventChoices, eventDef, meetsReq, restHealAmount, hasRelic } from '../engine/engine.js';
import CardFace, { KeywordList } from '../components/CardFace.jsx';
import Glyph from '../components/Glyph.jsx';
import { PotionArt, SceneArt } from '../components/Creatures.jsx';
import { sfx } from '../sound.js';

const TYPE_ORDER = { attack: 0, skill: 1, power: 2, status: 3, curse: 4 };
export const sortCards = cards => [...cards].sort((a, b) => TYPE_ORDER[CARDS[a.id].type] - TYPE_ORDER[CARDS[b.id].type] || CARDS[a.id].en.localeCompare(CARDS[b.id].en) || Number(a.up) - Number(b.up));

export function RelicIcon({ id, size = 26, showName = false }) {
  const relic = RELICS[id];
  const tip = `${relic.en}（${relic.zh}）：${relic.text}`;
  return <span className={`ea-relic is-${relic.tier}`} style={{ '--relic': relic.color }} tabIndex={0} data-tip={tip} aria-label={tip}>
    <Glyph name={relic.glyph} size={size}/>
    {showName && <span className="ea-relic-name"><b lang="en">{relic.en}</b><small>{relic.zh}</small></span>}
  </span>;
}

export function Modal({ title, kicker, onClose, children, wide = false, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    if (!onClose) return undefined;
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="ea-modal-shade" onClick={event => { if (event.target === event.currentTarget && onClose) onClose(); }}>
    <div ref={ref} tabIndex={-1} className={`ea-modal ${wide ? 'is-wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="ea-modal-head">
        <div>{kicker && <span className="ea-eyebrow" lang="en">{kicker}</span>}<h2>{title}</h2></div>
        {onClose && <button type="button" className="ea-modal-close" onClick={onClose} aria-label="關閉">×</button>}
      </header>
      {children}
    </div>
  </div>;
}

export function DeckViewer({ title, kicker, cards, onClose, note, extra }) {
  const grid = list => <div className="ea-card-grid">{sortCards(list).map(card => <div key={card.uid} className="ea-grid-card"><CardFace inst={card}/></div>)}</div>;
  return <Modal title={title} kicker={kicker} onClose={onClose} wide>
    {note && <p className="ea-modal-note">{note}</p>}
    {cards.length ? grid(cards) : <p className="ea-empty">這裡目前沒有牌。</p>}
    {extra?.cards.length > 0 && <section className="ea-viewer-extra" aria-label={extra.title}>
      <h3>{extra.title}</h3>
      {extra.note && <p className="ea-modal-note">{extra.note}</p>}
      {grid(extra.cards)}
    </section>}
  </Modal>;
}

export function CardPicker({ run, dispatch }) {
  const pending = run.pending;
  const [chosen, setChosen] = useState(null);
  const cards = useMemo(() => sortCards(pending.kind === 'upgrade' ? run.hero.deck.filter(canUpgrade) : run.hero.deck), [pending.kind, run.hero.deck]);
  const pick = cards.find(card => card.uid === chosen);
  const upgrade = pending.kind === 'upgrade';
  const cost = pending.source === 'shop' ? run.removeCost : 0;
  const copy = {
    upgrade: { title: '銘刻：選一張牌升級', kicker: 'INSCRIBE', note: '升級後的牌名稱會加上「+」，數值更強或費用更低。', action: id => `升級 ${id}` },
    remove: { title: '選一張牌移出牌組', kicker: 'REMOVE A CARD', note: `精簡牌組能讓好牌更常出現。${cost ? `需要 ${cost} 金幣。` : ''}`, action: id => `移除 ${id}${cost ? `（${cost} 金幣）` : ''}` },
    duplicate: { title: '選一張牌複製', kicker: 'COPY A CARD', note: '複製出的牌會保留升級狀態。', action: id => `複製 ${id}` },
    transform: { title: '選一張牌獻給祭壇', kicker: 'TRANSFORM', note: '這張牌會燒成灰，換成一張隨機的牌，比較容易是稀有卡。', action: id => `獻上 ${id}` },
  }[pending.kind] || {};
  return <Modal title={copy.title} kicker={copy.kicker} onClose={pending.cancellable ? () => dispatch({ type: 'CANCEL_PICK' }) : null} wide>
    <p className="ea-modal-note">{copy.note}</p>
    <div className="ea-card-grid">{cards.map(card => <button type="button" key={card.uid} className={`ea-grid-card ${chosen === card.uid ? 'is-chosen' : ''}`} aria-pressed={chosen === card.uid} onClick={() => { setChosen(card.uid); sfx.select(); }}><CardFace inst={card}/></button>)}</div>
    {pick && <div className="ea-picker-bar">
      {upgrade && <div className="ea-upgrade-preview"><CardFace inst={pick}/><span aria-hidden="true">→</span><CardFace inst={{ ...pick, up: true }}/></div>}
      <button type="button" className="ea-btn is-gold" onClick={() => { sfx.buff(); dispatch({ type: 'PICK_CARD', uid: pick.uid }); }}>{copy.action(CARDS[pick.id].en)}</button>
    </div>}
  </Modal>;
}

export function RewardScreen({ run, dispatch }) {
  const { reward } = run;
  const cardIndex = reward.items.findIndex(item => item.kind === 'cards');
  const [choosing, setChoosing] = useState(reward.kind === 'event' ? cardIndex : null);
  const slotsFull = !run.hero.potions.includes(null);
  const title = { treasure: '寶箱裡的收穫', event: '新的咒語', boss: '首領倒下了！', elite: '菁英戰利品' }[reward.kind] || '戰利品';
  const take = index => {
    const item = reward.items[index];
    if (item.kind === 'cards') { setChoosing(index); return; }
    if (item.kind === 'gold') sfx.coin(); else sfx.buff();
    dispatch({ type: 'TAKE_REWARD', index });
  };
  const pending = reward.items.some(item => !item.taken && (item.kind !== 'potion' || !slotsFull));
  const choice = choosing !== null ? reward.items[choosing] : null;
  return <section className="ea-room ea-reward" aria-label="戰利品">
    <div className="ea-room-panel">
      <span className="ea-eyebrow" lang="en">{reward.kind === 'treasure' ? 'TREASURE' : 'SPOILS'}</span>
      <h2>{title}</h2>
      <div className="ea-reward-list">{reward.items.map((item, index) => {
        const blocked = item.kind === 'potion' && slotsFull && !item.taken;
        return <button type="button" key={index} className={`ea-reward-item is-${item.kind} ${item.taken ? 'is-taken' : ''}`} disabled={item.taken || blocked} onClick={() => take(index)}>
          {item.kind === 'gold' && <><span className="ea-reward-icon is-gold"><Glyph name="gold" size={28}/></span><span><b>{item.amount} 金幣</b><small lang="en">Gold</small></span></>}
          {item.kind === 'potion' && <><span className="ea-reward-icon"><PotionArt color={POTIONS[item.id].color} size={26}/></span><span><b lang="en">{POTIONS[item.id].en}</b><small>{POTIONS[item.id].zh} · {blocked ? '藥劑欄已滿，先使用或丟棄一瓶' : POTIONS[item.id].text}</small></span></>}
          {item.kind === 'relic' && <><span className="ea-reward-icon"><RelicIcon id={item.id} size={30}/></span><span><b lang="en">{RELICS[item.id].en}</b><small>{item.skipped ? '你選擇了鑰匙' : `${RELICS[item.id].zh} · ${RELICS[item.id].text}`}</small></span></>}
          {item.kind === 'key' && <><span className="ea-reward-icon is-key" style={{ '--key': KEYS[item.key].color }}><Glyph name="key" size={28}/></span><span><b>{KEYS[item.key].zh}</b><small>{item.skipped ? '你選擇了遺物' : `${KEYS[item.key].en} · ${item.or != null ? '和遺物只能二選一' : '集齊三把鑰匙，第三章之後還有路'}`}</small></span></>}
          {item.kind === 'cards' && <><span className="ea-reward-icon is-cards"><Glyph name="deck" size={28}/></span><span><b>{item.taken ? (item.chosen ? `已加入 ${CARDS[item.chosen].en}` : `已略過卡牌 · 最大生命 +${SKIP_CARD_HP}`) : '選擇一張牌加入牌組'}</b><small>{item.focus && !item.taken ? `其中一張配合你的${ARCHETYPES[item.focus].zh}` : <span lang="en">Add a card to your deck</span>}</small></span></>}
          {item.taken && <i className="ea-check" aria-hidden="true">✓</i>}
        </button>;
      })}</div>
      <button type="button" className={`ea-btn ${pending ? '' : 'is-gold'}`} onClick={() => dispatch({ type: 'LEAVE_REWARD' })}>{reward.after === 'boss' ? '前往首領寶庫 →' : pending ? '略過剩下的獎勵 →' : '繼續前進 →'}</button>
    </div>
    {choice && !choice.taken && <Modal title="選擇一張牌" kicker="CHOOSE A CARD" onClose={() => setChoosing(null)} wide className="ea-choice-modal">
      {choice.focus && <p className="ea-modal-note">你的牌組偏向 <b>{ARCHETYPES[choice.focus].zh}</b>，所以至少有一張選項會配合它。</p>}
      <div className="ea-choice-row">{choice.options.map((id, i) => {
        const fits = choice.focus && archOf(id) === choice.focus;
        return <button type="button" key={id} className={`ea-choice-card ${fits ? 'is-fit' : ''}`} aria-label={`${CARDS[id].en} ${CARDS[id].zh}${fits ? `，配合你的${ARCHETYPES[choice.focus].zh}` : ''}`} onClick={() => { sfx.card(); dispatch({ type: 'TAKE_REWARD', index: choosing, choice: i }); setChoosing(null); }}>
          {fits && <span className="ea-fit-tag">配合你的{ARCHETYPES[choice.focus].zh}</span>}
          <CardFace inst={{ id, up: false }}/>
          <KeywordList inst={{ id, up: false }}/>
        </button>;
      })}</div>
      <button type="button" className="ea-btn is-quiet" onClick={() => { dispatch({ type: 'TAKE_REWARD', index: choosing, choice: null }); setChoosing(null); }}>不拿卡牌，最大生命 +{SKIP_CARD_HP}（Skip）</button>
    </Modal>}
  </section>;
}

export function RestScreen({ run, dispatch }) {
  const amount = restHealAmount(run);
  const rest = run.rest;
  const canInscribe = run.hero.deck.some(canUpgrade);
  return <section className="ea-room ea-rest" aria-label="燈下休憩">
    <div className="ea-room-panel">
      <SceneArt kind="rest"/>
      <span className="ea-eyebrow" lang="en">REST SITE</span>
      <h2>燈下休憩</h2>
      {!rest.done ? <>
        <p className="ea-room-lead">提燈的光暈很溫暖。你只來得及做一件事。</p>
        <div className="ea-room-choices">
          <button type="button" className="ea-choice" disabled={!amount || run.hero.hp >= run.hero.maxHp} onClick={() => { sfx.heal(); dispatch({ type: 'REST_HEAL' }); }}>
            <Glyph name="heartFill" size={30}/><span><b lang="en">Rest</b><small>休息：回復 {amount} 生命{hasRelic(run, 'midnightOil') ? '（午夜燈油讓你無法入睡）' : ''}</small></span>
          </button>
          <button type="button" className="ea-choice" disabled={!canInscribe} onClick={() => dispatch({ type: 'REST_UPGRADE' })}>
            <Glyph name="quill" size={30}/><span><b lang="en">Inscribe</b><small>銘刻：升級 1 張牌{canInscribe ? '' : '（沒有可升級的牌）'}</small></span>
          </button>
          {run.keys && !run.keys.flame && run.act <= 3 && <button type="button" className="ea-choice is-key" style={{ '--key': KEYS.flame.color }} onClick={() => { sfx.buff(); dispatch({ type: 'REST_KEY' }); }}>
            <Glyph name="key" size={30}/><span><b lang="en">Recall</b><small>取下燭火之鑰：放棄休息與銘刻，帶走三把鑰匙之一</small></span>
          </button>}
        </div>
        <button type="button" className="ea-btn is-quiet ea-rest-skip" onClick={() => dispatch({ type: 'LEAVE_ROOM' })}>什麼都不做，繼續前進</button>
      </> : <>
        <p className="ea-room-lead">{rest.key ? '你從提燈裡取出燭火之鑰，它在掌心發著溫暖的光。' : rest.healed ? `你睡了一場好覺，回復 ${rest.healed} 生命。` : rest.upgraded ? `你在燈下重寫了 ${CARDS[rest.upgraded].en}，它變得更強了。` : '你稍作休息。'}</p>
        <button type="button" className="ea-btn is-gold" onClick={() => dispatch({ type: 'LEAVE_ROOM' })}>繼續前進 →</button>
      </>}
    </div>
  </section>;
}

export function ShopScreen({ run, dispatch }) {
  const { shop } = run;
  const gold = run.hero.gold;
  const slotsFull = !run.hero.potions.includes(null);
  const buy = (kind, index) => { sfx.coin(); dispatch({ type: 'SHOP_BUY', kind, index }); };
  return <section className="ea-room ea-shop" aria-label="墨商的攤位">
    <div className="ea-shop-head">
      <SceneArt kind="shop"/>
      <div>
        <span className="ea-eyebrow" lang="en">THE INK MERCHANT</span>
        <h2>墨商的攤位</h2>
        <p className="ea-quote"><span lang="en">“Words for coins, coins for words. Take your time.”</span><small>「用金幣換文字，用文字換金幣。慢慢挑吧。」</small></p>
      </div>
    </div>
    <div className="ea-shop-section">
      <h3><span lang="en">Cards</span> 卡牌</h3>
      <div className="ea-shop-cards">{shop.cards.map((item, index) => <button type="button" key={index} className={`ea-shop-item ${item.sold ? 'is-sold' : ''}`} disabled={item.sold || gold < item.price} onClick={() => buy('cards', index)} aria-label={`${CARDS[item.id].en} ${CARDS[item.id].zh}，${item.price} 金幣${item.sold ? '，已售出' : ''}`}>
        <CardFace inst={{ id: item.id, up: false }}/>
        <span className={`ea-price ${gold < item.price ? 'is-short' : ''} ${item.sale ? 'is-sale' : ''}`}>{item.sold ? '已售出' : <><Glyph name="gold" size={14}/>{item.price}{item.sale && <i>特價</i>}</>}</span>
      </button>)}</div>
    </div>
    <div className="ea-shop-row">
      <div className="ea-shop-section">
        <h3><span lang="en">Relics</span> 遺物</h3>
        <div className="ea-shop-list">{shop.relics.map((item, index) => <button type="button" key={index} className={`ea-shop-line ${item.sold ? 'is-sold' : ''}`} disabled={item.sold || gold < item.price} onClick={() => buy('relics', index)}>
          <RelicIcon id={item.id} size={30}/><span><b lang="en">{RELICS[item.id].en}</b><small>{RELICS[item.id].zh} · {RELICS[item.id].text}</small></span>
          <span className={`ea-price ${gold < item.price ? 'is-short' : ''}`}>{item.sold ? '已售出' : <><Glyph name="gold" size={14}/>{item.price}</>}</span>
        </button>)}</div>
      </div>
      <div className="ea-shop-section">
        <h3><span lang="en">Tonics</span> 藥劑</h3>
        <div className="ea-shop-list">{shop.potions.map((item, index) => <button type="button" key={index} className={`ea-shop-line ${item.sold ? 'is-sold' : ''}`} disabled={item.sold || gold < item.price || slotsFull} onClick={() => buy('potions', index)}>
          <PotionArt color={POTIONS[item.id].color} size={24}/><span><b lang="en">{POTIONS[item.id].en}</b><small>{POTIONS[item.id].zh} · {POTIONS[item.id].text}</small></span>
          <span className={`ea-price ${gold < item.price ? 'is-short' : ''}`}>{item.sold ? '已售出' : slotsFull ? '欄位已滿' : <><Glyph name="gold" size={14}/>{item.price}</>}</span>
        </button>)}</div>
        <h3><span lang="en">Service</span> 服務</h3>
        <button type="button" className={`ea-shop-line ${shop.removed ? 'is-sold' : ''}`} disabled={shop.removed || gold < run.removeCost} onClick={() => dispatch({ type: 'SHOP_REMOVE' })}>
          <Glyph name="blot" size={26}/><span><b lang="en">Erase a Card</b><small>移除牌組中的 1 張牌</small></span>
          <span className={`ea-price ${gold < run.removeCost ? 'is-short' : ''}`}>{shop.removed ? '已使用' : <><Glyph name="gold" size={14}/>{run.removeCost}</>}</span>
        </button>
      </div>
    </div>
    <button type="button" className="ea-btn is-gold ea-leave" onClick={() => dispatch({ type: 'LEAVE_ROOM' })}>離開攤位 →</button>
  </section>;
}

const EVENT_GLYPHS = {
  lantern: 'lantern', mirror: 'shard', fountain: 'wave', door: 'event', lute: 'echo', statue: 'crown', binder: 'thread',
  candle: 'flame', guardian: 'stone', page: 'pages', quill: 'quill', well: 'coin', scholar: 'book', altar: 'emberHeart', gear: 'metronome', choir: 'bell',
};

function Gain({ gain }) {
  if (gain.type === 'relic') return <span className="ea-gain"><RelicIcon id={gain.id} size={18}/>{RELICS[gain.id].en}</span>;
  if (gain.type === 'potion') return <span className="ea-gain"><PotionArt color={POTIONS[gain.id].color} size={14}/>{POTIONS[gain.id].en}</span>;
  if (gain.type === 'gold') return <span className="ea-gain"><Glyph name="gold" size={14}/>+{gain.amount}</span>;
  if (gain.type === 'lostPotion') return <span className="ea-gain is-removed"><PotionArt color={POTIONS[gain.id].color} size={14}/>失去 {POTIONS[gain.id].en}</span>;
  const prefix = { card: '獲得', upgrade: '升級', removed: '移除' }[gain.type];
  return <span className={`ea-gain is-${gain.type}`}>{prefix} <b lang="en">{CARDS[gain.id].en}</b></span>;
}

export function EventScreen({ run, dispatch, speak, voice }) {
  const ev = run.event;
  const def = eventDef(ev.id);
  const [showZh, setShowZh] = useState(!def.riddle);
  const choices = eventChoices(run);
  const riddle = def.riddle ? def.riddles[ev.riddle] : null;
  const choose = (choice, index) => {
    const line = choice.effects?.find(effect => effect.op === 'speak');
    if (line) speak(line.text);
    if (def.riddle && index < riddle.options.length) { if (riddle.options[index].ok) sfx.chantOk(); else sfx.chantMiss(); }
    dispatch({ type: 'EVENT_CHOOSE', index });
  };
  return <section className="ea-room ea-event" aria-label={def.title.zh}>
    <div className="ea-room-panel is-event">
      <div className="ea-event-art"><Glyph name={EVENT_GLYPHS[def.art] || 'book'} size={64}/></div>
      <span className="ea-eyebrow" lang="en">{ev.id === 'keeper' ? 'PROLOGUE' : 'EVENT'}</span>
      <h2><span lang="en">{def.title.en}</span><small>{def.title.zh}</small></h2>
      <div className="ea-story">
        <p lang="en">{def.body.en}<button type="button" className="ea-speak" onClick={() => speak(def.body.en)} aria-label="朗讀英文">♪</button></p>
        <p className="ea-zh">{def.body.zh}</p>
        {riddle && <div className="ea-riddle">
          <p lang="en"><b>{riddle.q.en}</b><button type="button" className="ea-speak" onClick={() => speak(riddle.q.en)} aria-label="朗讀謎題">♪</button></p>
          {showZh ? <p className="ea-zh">{riddle.q.zh}</p> : <button type="button" className="ea-link" onClick={() => setShowZh(true)}>需要中文提示嗎？</button>}
        </div>}
      </div>
      {!ev.result ? <div className="ea-event-choices">{choices.map((choice, index) => {
        const ok = meetsReq(run, choice.req);
        return <button type="button" key={index} className="ea-choice" disabled={!ok} onClick={() => choose(choice, index)}>
          <span className="ea-choice-mark" aria-hidden="true">{index + 1}</span>
          <span><b lang="en">{choice.en}</b>{(showZh || !riddle || index === choices.length - 1) && <small>{choice.zh}{choice.note ? ` — ${choice.note}` : ''}</small>}</span>
        </button>;
      })}</div> : <div className="ea-event-result">
        <p lang="en">{ev.result.en}</p><p className="ea-zh">{ev.result.zh}</p>
        {ev.gains?.length > 0 && <div className="ea-gains">{ev.gains.map((gain, index) => <Gain key={index} gain={gain}/>)}</div>}
        <button type="button" className="ea-btn is-gold" disabled={Boolean(run.pending)} onClick={() => dispatch({ type: 'EVENT_CONTINUE' })}>{ev.id === 'keeper' ? '踏入書庫 →' : '繼續前進 →'}</button>
      </div>}
    </div>
  </section>;
}

export function TreasureScreen({ dispatch }) {
  return <section className="ea-room ea-treasure" aria-label="寶箱">
    <div className="ea-room-panel">
      <span className="ea-eyebrow" lang="en">TREASURE</span>
      <h2>塵封的寶箱</h2>
      <button type="button" className="ea-chest" onClick={() => { sfx.coin(); dispatch({ type: 'OPEN_CHEST' }); }} aria-label="打開寶箱"><SceneArt kind="treasure"/></button>
      <p className="ea-room-lead">鎖已經鏽掉了。輕輕一推，蓋子就會打開。</p>
      <button type="button" className="ea-btn is-gold" onClick={() => { sfx.coin(); dispatch({ type: 'OPEN_CHEST' }); }}>打開寶箱</button>
    </div>
  </section>;
}

export function BossRelicScreen({ run, dispatch }) {
  return <section className="ea-room ea-boss-relic" aria-label="首領寶庫">
    <div className="ea-room-panel is-wide">
      <span className="ea-eyebrow" lang="en">BOSS RELIC</span>
      <h2>首領寶庫：選一件強大遺物</h2>
      <p className="ea-room-lead">強大的力量往往附帶代價，仔細讀一讀。</p>
      <div className="ea-boss-relics">{run.bossRelics.map(id => <button type="button" key={id} className="ea-boss-relic-card" style={{ '--relic': RELICS[id].color }} onClick={() => { sfx.chantOk(); dispatch({ type: 'BOSS_RELIC', id }); }}>
        <Glyph name={RELICS[id].glyph} size={54}/><b lang="en">{RELICS[id].en}</b><small>{RELICS[id].zh}</small><p>{RELICS[id].text}</p>
      </button>)}</div>
      <button type="button" className="ea-btn is-quiet" onClick={() => dispatch({ type: 'BOSS_RELIC', id: null })}>都不要，直接前進</button>
    </div>
  </section>;
}
