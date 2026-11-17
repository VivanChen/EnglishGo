import { createContext, useContext } from 'react';
import { CARDS, CARD_TYPES, KEYWORDS, RARITIES, baseCost, cardKeywords, describeCard } from '../data/cards.js';
import Glyph from './Glyph.jsx';

// Card ids the player owns as foils (duplicates from the Archive Gacha).
export const FoilContext = createContext(new Set());

export function CardText({ lines }) {
  return <>{lines.map((line, index) => <span key={index} className="ea-card-line">{line.map((seg, i) => {
    if (typeof seg === 'string') return <span key={i}>{seg}</span>;
    if (seg.kw) return <b key={i} className={`ea-kw ea-kw-${seg.kw}`} lang="en">{KEYWORDS[seg.kw].en}</b>;
    return <b key={i} className={`ea-num ${seg.tone ? `is-${seg.tone}` : ''}`}>{seg.n}</b>;
  })}</span>)}</>;
}

export default function CardFace({ inst, cost, ctx, playable = true, className = '', compact = false, foil }) {
  const foils = useContext(FoilContext);
  const card = CARDS[inst.id];
  const shownCost = cost === undefined ? baseCost(card, inst.up) : cost;
  const printed = baseCost(card, inst.up);
  const length = card.en.length + (inst.up ? 1 : 0);
  const shiny = foil ?? foils.has(inst.id);
  return <div className={`ea-card ea-type-${card.type} ea-rarity-${card.rarity} ${inst.up ? 'is-upgraded' : ''} ${playable ? '' : 'is-unplayable'} ${compact ? 'is-compact' : ''} ${shiny ? 'is-foil' : ''} ${className}`} style={{ '--title-size': length > 10 ? '8.6cqw' : length > 8 ? '9.6cqw' : '10.6cqw' }}>
    <div className="ea-card-frame">
      {shownCost !== null && <span className={`ea-card-cost ${typeof shownCost === 'number' && typeof printed === 'number' && shownCost < printed ? 'is-cheaper' : ''}`}>{shownCost}</span>}
      <div className="ea-card-title"><strong lang="en">{card.en}{inst.up ? '+' : ''}</strong><small>{card.zh}</small></div>
      <div className="ea-card-art"><Glyph name={card.glyph} size={64}/>{card.chant && <span className="ea-card-chant" title="Chant 詠唱">✦</span>}{inst.bonus > 0 && <span className="ea-card-bonus" lang="en">+{inst.bonus}</span>}</div>
      <div className="ea-card-type"><span lang="en">{CARD_TYPES[card.type].en}</span>{card.rarity !== 'starter' && card.rarity !== 'special' && <i>{RARITIES[card.rarity].zh}</i>}</div>
      <div className="ea-card-text"><CardText lines={describeCard(inst, ctx)}/></div>
    </div>
  </div>;
}

// Face-down card used for locked codex entries and unrevealed gacha pulls.
export function CardBack({ rarity = 'common', label, className = '' }) {
  return <div className={`ea-card ea-card-back ea-rarity-${rarity} ${className}`}>
    <div className="ea-card-frame">
      <span className="ea-card-back-sigil" aria-hidden="true"><Glyph name="book" size={64}/></span>
      {label && <span className="ea-card-back-label">{label}</span>}
    </div>
  </div>;
}

export function KeywordList({ inst, extra = [] }) {
  const ids = [...new Set([...cardKeywords(inst), ...extra])];
  if (!ids.length) return null;
  return <ul className="ea-keywords">{ids.map(id => <li key={id}><b lang="en">{KEYWORDS[id].en}</b><span>{KEYWORDS[id].zh}</span><p>{KEYWORDS[id].text}</p></li>)}</ul>;
}
