import { useEffect, useMemo, useRef, useState } from 'react';
import { ARCHETYPES, ARCHIVE_CARDS, CARDS, RARITIES, REWARD_POOL, STARTER_DECK, archOf } from '../data/cards.js';
import { HEROES } from '../data/heroes.js';
import { FOIL_CHANCE, MYTHIC_PITY, PULL_COST, RARE_PITY, TEN_PULL_COST, WELCOME_SHARDS, odds } from '../archive.js';
import CardFace, { CardBack, KeywordList } from '../components/CardFace.jsx';
import Glyph from '../components/Glyph.jsx';
import { Backdrop } from '../components/Creatures.jsx';
import { Modal } from './RoomScreens.jsx';
import { sfx } from '../sound.js';

const RARITY_ORDER = { starter: 0, common: 1, uncommon: 2, rare: 3, mythic: 4 };
const ARCH_ORDER = ['blade', 'burn', 'ward', 'combo', 'chant', 'ink', 'fold', 'familiar', 'steam', 'twilight'];
export const CODEX_CARDS = [...new Set([...STARTER_DECK, ...Object.values(HEROES).flatMap(hero => hero.deck), ...REWARD_POOL])]
  .sort((a, b) => ARCH_ORDER.indexOf(archOf(a)) - ARCH_ORDER.indexOf(archOf(b)) || RARITY_ORDER[CARDS[a].rarity] - RARITY_ORDER[CARDS[b].rarity] || CARDS[a].en.localeCompare(CARDS[b].en));
const isOwned = (id, collection) => !CARDS[id].pack || collection.owned[id] > 0;

export function ShardBadge({ amount }) {
  return <span className="ea-shards" aria-label={`墨晶 ${amount}`}><Glyph name="gem" size={16}/><b>{amount}</b></span>;
}

function TomeMachine({ charging }) {
  return <svg viewBox="0 0 320 240" className={`ea-tome-machine ${charging ? 'is-charging' : ''}`} aria-hidden="true">
    <defs>
      <radialGradient id="eaTomeGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ffe7a6" stopOpacity=".85"/><stop offset=".55" stopColor="#b294ff" stopOpacity=".25"/><stop offset="1" stopColor="#b294ff" stopOpacity="0"/></radialGradient>
      <linearGradient id="eaTomeCover" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a3486"/><stop offset="1" stopColor="#231238"/></linearGradient>
    </defs>
    <circle className="ea-tome-halo" cx="160" cy="112" r="110" fill="url(#eaTomeGlow)"/>
    <g className="ea-tome-ring"><circle cx="160" cy="112" r="96" fill="none" stroke="#e8c47a" strokeOpacity=".45" strokeWidth="1.5" strokeDasharray="4 10"/><path d="M160 22L238 157H82Z M160 202L82 67H238Z" fill="none" stroke="#e8c47a" strokeOpacity=".25" strokeWidth="1.2"/></g>
    <g className="ea-tome-book">
      <path d="M160 92C130 76 96 76 70 84V178C96 170 130 170 160 186C190 170 224 170 250 178V84C224 76 190 76 160 92Z" fill="url(#eaTomeCover)" stroke="#e8c47a" strokeWidth="3"/>
      <path d="M160 98C134 86 104 86 82 92V170C104 164 134 164 160 176C186 164 216 164 238 170V92C216 86 186 86 160 98Z" fill="#f4ead2"/>
      <path d="M160 98V176" stroke="#b39a6e" strokeWidth="2.5"/>
      <path d="M94 110H144M94 122H140M94 134H146M176 110H226M180 122H226M174 134H222" stroke="#b39a6e" strokeOpacity=".5" strokeWidth="2.5"/>
      <g className="ea-tome-page"><path d="M160 98C186 86 216 86 238 92V170C216 164 186 164 160 176Z" fill="#fff8e6" opacity=".9"/></g>
      <circle cx="160" cy="146" r="10" fill="#b294ff"/><circle cx="160" cy="146" r="4" fill="#fff"/>
    </g>
    {[[64, 40], [262, 52], [40, 170], [282, 182], [160, 14]].map(([x, y], i) => <circle key={i} className="ea-tome-mote" style={{ animationDelay: `${i * 0.4}s` }} cx={x} cy={y} r="3" fill="#ffe7a6"/>)}
  </svg>;
}

export function GachaScreen({ collection, onPull, onClaim, onBack, onCodex, onDismissNotice }) {
  const [phase, setPhase] = useState('idle');
  const [results, setResults] = useState([]);
  const [revealed, setRevealed] = useState(0);
  const [showOdds, setShowOdds] = useState(false);
  const stage = useRef(null);
  const ownedCount = ARCHIVE_CARDS.filter(id => collection.owned[id] > 0).length;

  const pull = count => {
    const res = onPull(count);
    if (!res) { sfx.deny(); return; }
    setResults(res);
    setRevealed(0);
    setPhase('charging');
    sfx.buff();
  };
  useEffect(() => {
    if (phase !== 'charging') return undefined;
    const t = window.setTimeout(() => setPhase('reveal'), 1300);
    return () => window.clearTimeout(t);
  }, [phase]);
  useEffect(() => {
    if (phase === 'reveal') stage.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [phase]);
  useEffect(() => {
    if (phase !== 'reveal' || revealed >= results.length) return undefined;
    const t = window.setTimeout(() => {
      const item = results[revealed];
      if (item.rarity === 'mythic') sfx.victory(); else if (item.rarity === 'rare') sfx.chantOk(); else sfx.card();
      setRevealed(value => value + 1);
    }, revealed === 0 ? 150 : 260);
    return () => window.clearTimeout(t);
  }, [phase, revealed, results]);

  const done = phase === 'reveal' && revealed >= results.length;
  const rareIn = RARE_PITY - collection.sinceRare;
  const mythicIn = MYTHIC_PITY - collection.sinceMythic;

  return <section className="ea-gacha" aria-labelledby="ea-gacha-title">
    <Backdrop act={3}/>
    <header className="ea-archive-head">
      <button type="button" className="ea-back-link is-inline" onClick={onBack}>‹ 回到標題</button>
      <div><span className="ea-eyebrow" lang="en">ARCHIVE GACHA</span><h1 id="ea-gacha-title">書頁扭蛋</h1></div>
      <ShardBadge amount={collection.shards}/>
    </header>

    {collection.notice?.kind === 'foilRefund' && <div className="ea-welcome is-notice" role="status">
      <Glyph name="gem" size={30}/>
      <span><b>閃卡規則更新</b><small>閃卡變得更稀有，但在遠征中拿到時就是升級版（+）。你原本的 {collection.notice.count} 張閃卡已換成 {collection.notice.shards} 墨晶。</small></span>
      <button type="button" className="ea-btn" onClick={onDismissNotice}>知道了</button>
    </div>}
    {!collection.welcomed && <div className="ea-welcome" role="status">
      <Glyph name="gem" size={30}/>
      <span><b>初次見面禮</b><small>送你 {WELCOME_SHARDS} 墨晶，足夠抽 {WELCOME_SHARDS / PULL_COST} 次！</small></span>
      <button type="button" className="ea-btn is-gold" onClick={() => { sfx.coin(); onClaim(); }}>領取</button>
    </div>}

    <div className="ea-gacha-stage" ref={stage}>
      {phase !== 'reveal' && <TomeMachine charging={phase === 'charging'}/>}
      {phase === 'idle' && <p className="ea-gacha-lead">打開古老的書頁，召喚新的咒語。抽到的牌會加入之後每一場遠征的卡池。</p>}
      {phase === 'reveal' && results.length > 0 && <div className={`ea-gacha-results count-${results.length}`}>
        {results.map((item, index) => <div key={index} className={`ea-gacha-slot glow-${item.rarity} ${index < revealed ? 'is-revealed' : ''}`} style={{ '--i': index }}>
          {index < revealed ? <>
            <CardFace inst={{ id: item.id, up: item.outcome === 'foil' }} foil={item.outcome === 'foil' || undefined}/>
            <span className={`ea-gacha-tag is-${item.outcome}`}>{item.outcome === 'new' ? 'NEW' : item.outcome === 'foil' ? '閃卡！天生升級' : `+${item.refund} 墨晶`}</span>
          </> : <CardBack rarity={item.rarity}/>}
        </div>)}
      </div>}
    </div>

    <div className="ea-gacha-controls">
      {phase === 'reveal' && !done && <button type="button" className="ea-btn" onClick={() => setRevealed(results.length)}>全部翻開</button>}
      {(phase === 'idle' || done) && <>
        <button type="button" className="ea-btn is-big" disabled={collection.shards < PULL_COST} onClick={() => pull(1)}><span>單抽</span><small><Glyph name="gem" size={12}/> {PULL_COST} 墨晶</small></button>
        <button type="button" className="ea-btn is-big is-gold" disabled={collection.shards < TEN_PULL_COST} onClick={() => pull(10)}><span>十連抽</span><small><Glyph name="gem" size={12}/> {TEN_PULL_COST} 墨晶 · 保底傳說</small></button>
      </>}
    </div>

    <div className="ea-gacha-info">
      <p>{rareIn <= 1 ? '下一抽必出「傳說」以上！' : `再 ${rareIn} 抽必出「傳說」以上`} · {mythicIn <= 1 ? '下一抽必出「神話」！' : `${mythicIn} 抽內必出「神話」`}</p>
      <p>已收集 <b>{ownedCount} / {ARCHIVE_CARDS.length}</b> 張扭蛋卡 · <button type="button" className="ea-link" onClick={onCodex}>打開卡牌圖鑑</button> · <button type="button" className="ea-link" onClick={() => setShowOdds(true)}>機率說明</button></p>
      <p className="ea-gacha-earn">墨晶只能在遊戲裡獲得：每次遠征結束（不論輸贏），依抵達樓層、擊倒的敵人、菁英、首領和詠唱成功次數發放，難度越高拿得越多。</p>
    </div>

    {showOdds && <Modal title="機率說明" kicker="DROP RATES" onClose={() => setShowOdds(false)}>
      <table className="ea-odds">
        <thead><tr><th>稀有度</th><th>機率</th><th>卡片數</th></tr></thead>
        <tbody>{odds.map(item => <tr key={item.rarity} className={`is-${item.rarity}`}><td>{RARITIES[item.rarity].zh} <small lang="en">{RARITIES[item.rarity].en}</small></td><td>{item.percent}%</td><td>{item.cards} 張</td></tr>)}</tbody>
      </table>
      <ul className="ea-odds-notes">
        <li>每連續 {RARE_PITY} 抽，至少會出現 1 張「傳說」或「神話」，所以十連抽必定保底。</li>
        <li>連續 {MYTHIC_PITY} 抽沒出現「神話」，下一抽必定是「神話」。</li>
        <li>抽到已經擁有的卡時，有 {FOIL_CHANCE}% 機率變成「閃卡」，其餘會轉回部分墨晶（普通 4、稀有 7、傳說 12、神話 25）。</li>
        <li>閃卡在遠征中拿到時就已經升級（+）：費用更低或數值更強，休息點的升級可以留給別張牌。</li>
        <li>扭蛋卡會加入遠征的卡池；墨晶不能用金幣或現金購買。</li>
      </ul>
    </Modal>}
  </section>;
}

export function CodexScreen({ collection, onBack, onGacha }) {
  const [filter, setFilter] = useState('all');
  const [focus, setFocus] = useState(null);
  const foils = useMemo(() => new Set(collection.foils), [collection.foils]);
  const ownedTotal = CODEX_CARDS.filter(id => isOwned(id, collection)).length;
  const list = CODEX_CARDS.filter(id => (filter === 'all' ? true : filter === 'locked' ? !isOwned(id, collection) : archOf(id) === filter));
  const tabs = [['all', '全部'], ...ARCH_ORDER.map(id => [id, ARCHETYPES[id].zh]), ['locked', '未解鎖']];
  const focusOwned = focus && isOwned(focus, collection);
  return <section className="ea-codex" aria-labelledby="ea-codex-title">
    <header className="ea-archive-head">
      <button type="button" className="ea-back-link is-inline" onClick={onBack}>‹ 回到標題</button>
      <div><span className="ea-eyebrow" lang="en">CARD CODEX</span><h1 id="ea-codex-title">卡牌圖鑑</h1></div>
      <span className="ea-codex-progress"><span><b>{ownedTotal}</b> / {CODEX_CARDS.length}</span><small>已收集</small></span>
    </header>
    <div className="ea-codex-tabs" role="tablist" aria-label="依流派篩選">{tabs.map(([id, label]) => <button type="button" key={id} role="tab" aria-selected={filter === id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div>
    {filter !== 'all' && filter !== 'locked' && <p className="ea-codex-arch"><b lang="en">{ARCHETYPES[filter].en}</b> {ARCHETYPES[filter].text}</p>}
    <div className="ea-card-grid ea-codex-grid">{list.map(id => {
      const owned = isOwned(id, collection);
      return <button type="button" key={id} className={`ea-grid-card ${owned ? '' : 'is-locked'}`} onClick={() => setFocus(id)} aria-label={owned ? `${CARDS[id].en} ${CARDS[id].zh}` : `未解鎖的${RARITIES[CARDS[id].rarity].zh}卡`}>
        {owned ? <CardFace inst={{ id, up: false }} foil={foils.has(id)}/> : <CardBack rarity={CARDS[id].rarity} label="?"/>}
        {CARDS[id].pack && owned && collection.owned[id] > 1 && <span className="ea-codex-count">×{collection.owned[id]}</span>}
      </button>;
    })}</div>
    {!list.length && <p className="ea-empty">這一類的牌都收集完了！</p>}
    {focus && <Modal title={focusOwned ? `${CARDS[focus].en} · ${CARDS[focus].zh}` : '尚未解鎖'} kicker={`${ARCHETYPES[archOf(focus)].zh} · ${RARITIES[CARDS[focus].rarity].zh}`} onClose={() => setFocus(null)} wide={focusOwned}>
      {focusOwned ? <>
        <div className="ea-codex-detail">
          <div className="ea-upgrade-preview"><CardFace inst={{ id: focus, up: false }} foil={foils.has(focus)}/><span aria-hidden="true">→</span><CardFace inst={{ id: focus, up: true }} foil={foils.has(focus)}/></div>
          <KeywordList inst={{ id: focus, up: false }}/>
        </div>
        <p className="ea-modal-note">{CARDS[focus].pack ? (foils.has(focus) ? '閃卡：在遠征中拿到這張牌時，就已經是右邊的升級版。' : `扭蛋卡。已解鎖，會出現在遠征的獎勵與商店中。重複抽到時有 ${FOIL_CHANCE}% 機率變成閃卡。`) : '基本收藏：一開始就會出現在遠征中。'}</p>
      </> : <>
        <div className="ea-codex-locked"><CardBack rarity={CARDS[focus].rarity} label="?"/></div>
        <p className="ea-modal-note">這是一張「{RARITIES[CARDS[focus].rarity].zh}」的{ARCHETYPES[archOf(focus)].zh}卡。到書頁扭蛋召喚它，就能在遠征中遇見它。</p>
        <div className="ea-modal-actions"><button type="button" className="ea-btn is-gold" onClick={() => { setFocus(null); onGacha(); }}>前往書頁扭蛋</button></div>
      </>}
    </Modal>}
  </section>;
}
