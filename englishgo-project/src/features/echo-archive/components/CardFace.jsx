import { createContext, useContext, useState } from 'react';
import { CARDS, CARD_TYPES, KEYWORDS, RARITIES, baseCost, cardKeywords, describeCard } from '../data/cards.js';
import Glyph from './Glyph.jsx';
import { cardImage } from './paintedArt.js';

// Card ids the player owns as foils (duplicates from the Archive Gacha).
export const FoilContext = createContext(new Set());

// Each card gets its own hue for the art backdrop, so cards of the same
// type still look distinct in hand.
function hueOf(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % 360;
}

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
  const lines = describeCard(inst, ctx);
  // Shrink rules text for wordy cards so it always fits the parchment.
  const textLength = lines.flat().reduce((sum, seg) => sum + (typeof seg === 'string' ? seg.length : seg.kw ? 4 : String(seg.n).length), 0);
  const textSize = textLength > 64 ? '5.9cqw' : textLength > 50 ? '6.4cqw' : textLength > 36 ? '6.9cqw' : '7.3cqw';
  const style = { '--title-size': length > 10 ? '8.2cqw' : length > 8 ? '9.2cqw' : '10.2cqw', '--hue': hueOf(inst.id), '--text-size': textSize };
  // The glyph stays until the painting has loaded, and for good if it fails.
  // Keyed by src so a reused card face never shows a previous card's state.
  const painting = cardImage(inst.id);
  const [paintState, setPaintState] = useState(null);
  const painted = Boolean(painting) && paintState === `ok:${painting}`;
  const paintFailed = paintState === `x:${painting}`;
  return <div className={`ea-card ea-type-${card.type} ea-rarity-${card.rarity} ${inst.up ? 'is-upgraded' : ''} ${playable ? '' : 'is-unplayable'} ${compact ? 'is-compact' : ''} ${shiny ? 'is-foil' : ''} ${className}`} style={style}>
    <div className="ea-card-frame">
      <i className="ea-card-orn" aria-hidden="true"/>
      {shownCost !== null && <span className={`ea-card-cost ${typeof shownCost === 'number' && typeof printed === 'number' && shownCost < printed ? 'is-cheaper' : ''}`}><b>{shownCost}</b></span>}
      <div className="ea-card-title"><strong lang="en">{card.en}{inst.up ? '+' : ''}</strong><small>{card.zh}</small></div>
      <div className="ea-card-art">
        <div className={`ea-card-art-inner ${painted ? 'is-painted' : ''}`}>
          {painting && !paintFailed && <img className="ea-card-painting" src={painting} alt="" loading="lazy" decoding="async" draggable={false}
            onLoad={() => setPaintState(`ok:${painting}`)} onError={() => setPaintState(`x:${painting}`)}/>}
          <Glyph name={card.glyph} size={64}/>
          {card.chant && <span className="ea-card-chant" title="Chant 詠唱">✦</span>}
          {inst.bonus > 0 && <span className="ea-card-bonus" lang="en">+{inst.bonus}</span>}
        </div>
      </div>
      <div className="ea-card-type"><span lang="en">{CARD_TYPES[card.type].en}</span>{card.rarity !== 'starter' && card.rarity !== 'special' && <i>{RARITIES[card.rarity].zh}</i>}{shiny && <b className="ea-foil-chip" title="閃卡：在遠征中拿到時就是升級版">閃</b>}</div>
      <div className="ea-card-text"><CardText lines={lines}/></div>
      <i className="ea-card-gem" aria-hidden="true"/>
      <i className="ea-card-glare" aria-hidden="true"/>
    </div>
  </div>;
}

// Face-down card used for locked codex entries and unrevealed gacha pulls.
export function CardBack({ rarity = 'common', label, className = '' }) {
  return <div className={`ea-card ea-card-back ea-rarity-${rarity} ${className}`}>
    <div className="ea-card-frame">
      <span className="ea-card-back-sigil" aria-hidden="true"><Glyph name="book" size={64}/></span>
      {label && <span className="ea-card-back-label">{label}</span>}
      <i className="ea-card-gem" aria-hidden="true"/>
    </div>
  </div>;
}

export function KeywordList({ inst, extra = [] }) {
  const ids = [...new Set([...cardKeywords(inst), ...extra])];
  if (!ids.length) return null;
  return <ul className="ea-keywords">{ids.map(id => <li key={id}><b lang="en">{KEYWORDS[id].en}</b><span>{KEYWORDS[id].zh}</span><p>{KEYWORDS[id].text}</p></li>)}</ul>;
}
