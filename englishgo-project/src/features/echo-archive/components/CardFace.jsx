import { CARDS, CARD_TYPES, KEYWORDS, RARITIES, baseCost, cardKeywords, describeCard } from '../data/cards.js';
import Glyph from './Glyph.jsx';

export function CardText({ lines }) {
  return <>{lines.map((line, index) => <span key={index} className="ea-card-line">{line.map((seg, i) => {
    if (typeof seg === 'string') return <span key={i}>{seg}</span>;
    if (seg.kw) return <b key={i} className={`ea-kw ea-kw-${seg.kw}`} lang="en">{KEYWORDS[seg.kw].en}</b>;
    return <b key={i} className={`ea-num ${seg.tone ? `is-${seg.tone}` : ''}`}>{seg.n}</b>;
  })}</span>)}</>;
}

export default function CardFace({ inst, cost, ctx, playable = true, className = '', compact = false }) {
  const card = CARDS[inst.id];
  const shownCost = cost === undefined ? baseCost(card, inst.up) : cost;
  const printed = baseCost(card, inst.up);
  const length = card.en.length + (inst.up ? 1 : 0);
  return <div className={`ea-card ea-type-${card.type} ea-rarity-${card.rarity} ${inst.up ? 'is-upgraded' : ''} ${playable ? '' : 'is-unplayable'} ${compact ? 'is-compact' : ''} ${className}`} style={{ '--title-size': length > 10 ? '8.6cqw' : length > 8 ? '9.6cqw' : '10.6cqw' }}>
    <div className="ea-card-frame">
      {shownCost !== null && <span className={`ea-card-cost ${typeof shownCost === 'number' && typeof printed === 'number' && shownCost < printed ? 'is-cheaper' : ''}`}>{shownCost}</span>}
      <div className="ea-card-title"><strong lang="en">{card.en}{inst.up ? '+' : ''}</strong><small>{card.zh}</small></div>
      <div className="ea-card-art"><Glyph name={card.glyph} size={64}/>{card.chant && <span className="ea-card-chant" title="Chant 詠唱">✦</span>}</div>
      <div className="ea-card-type"><span lang="en">{CARD_TYPES[card.type].en}</span>{card.rarity !== 'starter' && card.rarity !== 'special' && <i>{RARITIES[card.rarity].zh}</i>}</div>
      <div className="ea-card-text"><CardText lines={describeCard(inst, ctx)}/></div>
    </div>
  </div>;
}

export function KeywordList({ inst, extra = [] }) {
  const ids = [...new Set([...cardKeywords(inst), ...extra])];
  if (!ids.length) return null;
  return <ul className="ea-keywords">{ids.map(id => <li key={id}><b lang="en">{KEYWORDS[id].en}</b><span>{KEYWORDS[id].zh}</span><p>{KEYWORDS[id].text}</p></li>)}</ul>;
}
