import { useState } from 'react';
import ArcadeScene from './ArcadeArt.jsx';
import { ARCADE_GAMES, readArcadeProgress, stageRecords } from '../data/arcade.js';

export default function ArcadeDiscovery({ lv, onSelect }) {
  const [progress] = useState(readArcadeProgress);
  const earned = Object.keys(ARCADE_GAMES).reduce((sum, game) => sum + ['practice', 'challenge'].reduce((total, mode) => total + Object.values(stageRecords(progress, lv, game, mode)).reduce((n, record) => n + (Number(record?.stars) || 0), 0), 0), 0);
  return <div className="arcade-discovery">
    <div className="arcade-island-heading"><div><b>歡迎來到遊戲探索島</b><p>先選一個世界。每次冒險，都能帶回一點英文。</p></div><span aria-label={`已收集 ${earned} 顆星`}>✦ {earned}</span></div>
    <button type="button" className="arcade-dash-feature" data-module-id="wordDash" onClick={() => onSelect('wordDash', 'game')}><span className="arcade-dash-copy"><small>NEW · 3D PARTY RUN</small><strong>單字衝衝！</strong><span>聽英文、跳障礙，衝過正確的門。</span><b>前往天空賽道 →</b></span><svg viewBox="0 0 400 210" aria-hidden="true"><path d="M100 75h195l85 135H10Z" fill="#40c6e6"/><path d="M100 75 10 210m285-135 85 135" stroke="#ff87c8" strokeWidth="12"/><g strokeWidth="12" fill="#fff1fb"><path d="M90 108V35h65v73" stroke="#fc5baa"/><path d="M169 108V35h65v73" stroke="#8053d6"/><path d="M248 108V35h65v73" stroke="#ffd445"/></g><g transform="translate(187 112) rotate(-9)"><rect x="-24" y="0" width="48" height="65" rx="23" fill="#a575ec"/><ellipse cy="23" rx="18" ry="16" fill="#fffaf0"/><path d="M-7 20v6m14-6v6" stroke="#4c2a71" strokeWidth="4" strokeLinecap="round"/><path d="m-23 30-12 12m58-12 12 12M-12 62l-5 9m29-9 5 9" stroke="#a575ec" strokeWidth="12" strokeLinecap="round"/></g><path d="m43 39 4 11 12 1-9 8 3 12-10-7-10 7 3-12-9-8 12-1Z" fill="#fff27c"/></svg></button>
    <div className="arcade-game-grid">{Object.entries(ARCADE_GAMES).map(([id, game]) => {
      const stars = Object.values(stageRecords(progress, lv, id, 'practice')).reduce((sum, record) => sum + (Number(record?.stars) || 0), 0);
      return <button type="button" key={id} data-module-id={id} className="arcade-game-card" style={{ '--arcade-accent': game.color }} onClick={() => onSelect(id, 'game')}><ArcadeScene game={id}/><div className="arcade-game-card-copy"><span>{game.subtitle} · 3 段關卡</span><h3>{game.title}</h3><p>{game.description}</p><div className="arcade-game-card-footer"><span>{stars ? `輕鬆練習 · ${stars}/9 顆星` : '輕鬆練習 / 挑戰模式'}</span><b>去冒險 →</b></div></div></button>;
    })}</div>
    <button type="button" className="arcade-boardgame-link" data-module-id="petMonopoly" onClick={() => onSelect('petMonopoly', 'game')}><span aria-hidden="true">🎲</span><span><b>寵物大富翁</b><small>選路搶地、抽機會命運、出牌攻防，和夥伴一起爭奪小島。</small></span><span aria-hidden="true">→</span></button>
  </div>;
}
