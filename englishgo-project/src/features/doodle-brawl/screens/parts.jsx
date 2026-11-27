import { useState } from 'react';
import { ITEMS } from '../data/items.js';
import { STATS, formatStat, statLine } from '../data/stats.js';
import { KIND_LABEL, TIERS, WEAPONS, weaponSummary } from '../data/weapons.js';
import { itemArt, weaponArt } from '../art.js';

// A sprite in the menus. If the picture can't load, a letter tile stands in.
export function Art({ src, label = '', size = 56, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return <span className={`db-art is-fallback ${className}`} style={{ width: size, height: size }} aria-hidden="true">{label.slice(0, 1)}</span>;
  return <img className={`db-art ${className}`} src={src} alt="" width={size} height={size} draggable="false" onError={() => setFailed(true)}/>;
}

export function StarIcon({ size = 18 }) {
  return <svg className="db-star-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z" fill="#ffd23f" stroke="#c47f00" strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>;
}

export function Stars({ value, className = '' }) {
  return <span className={`db-stars ${className}`} aria-label={`${value} 顆星星`}><StarIcon/><b>{value}</b></span>;
}

export function TierTag({ tier }) {
  const info = TIERS[tier];
  return <span className="db-tier-tag" style={{ '--tier': info.color }}><b lang="en">{info.roman}</b>{info.zh}</span>;
}

// The description lines of a weapon or item, used by shop cards and crates.
export function ThingText({ kind, id, tier }) {
  if (kind === 'weapon') {
    const def = WEAPONS[id];
    return <div className="db-thing-text">
      <p>{def.text}</p>
      <ul>{weaponSummary(id, tier).map(line => <li key={line}>{line}</li>)}</ul>
    </div>;
  }
  const item = ITEMS[id];
  const lines = Object.entries(item.stats).map(([stat, value]) => statLine(stat, value));
  return <div className="db-thing-text">
    {item.text && <p>{item.text}</p>}
    <ul>{lines.map(line => <li key={line.stat} className={line.good ? 'is-good' : 'is-bad'}><b lang="en">{line.text}</b><small>{line.zh}</small></li>)}</ul>
  </div>;
}

export function thingName(kind, id) {
  const def = kind === 'weapon' ? WEAPONS[id] : ITEMS[id];
  return { en: def.en, zh: def.zh, art: kind === 'weapon' ? weaponArt(id) : itemArt(id), label: kind === 'weapon' ? `武器 · ${KIND_LABEL[def.kind]}` : '道具' };
}

export function StatSheet({ stats }) {
  return <dl className="db-stat-sheet">
    {Object.keys(STATS).filter(stat => stat !== 'critDmg' || stats.critDmg).map(stat => {
      const value = Math.round(stats[stat] * 10) / 10;
      return <div key={stat} className={value > 0 ? 'is-up' : value < 0 ? 'is-down' : ''}>
        <dt><b lang="en">{STATS[stat].en}</b><small>{STATS[stat].zh}</small></dt>
        <dd>{stat === 'maxHp' ? value : formatStat(stat, value)}{stat === 'dodge' && value > 60 ? '（上限 60%）' : ''}</dd>
      </div>;
    })}
  </dl>;
}

export function Toggle({ label, hint, checked, onChange }) {
  return <label className="db-toggle">
    <span><b>{label}</b><small>{hint}</small></span>
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/>
    <i aria-hidden="true"/>
  </label>;
}

export function Modal({ title, kicker, children, onClose, className = '' }) {
  return <div className="db-modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) onClose?.(); }}>
    <div className={`db-modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      {kicker && <span className="db-kicker" lang="en">{kicker}</span>}
      <h2>{title}</h2>
      {children}
    </div>
  </div>;
}
