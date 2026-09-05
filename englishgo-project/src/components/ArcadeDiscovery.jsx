import { useState } from 'react';
import ArcadeScene from './ArcadeArt.jsx';
import { ARCADE_GAMES, readArcadeProgress, stageRecords } from '../data/arcade.js';

export default function ArcadeDiscovery({ lv, onSelect }) {
  const [progress] = useState(readArcadeProgress);
  const earned = Object.keys(ARCADE_GAMES).reduce((sum, game) => sum + ['practice', 'challenge'].reduce((total, mode) => total + Object.values(stageRecords(progress, lv, game, mode)).reduce((n, record) => n + (Number(record?.stars) || 0), 0), 0), 0);
  return <div className="arcade-discovery">
    <div className="arcade-island-heading"><div><b>歡迎來到遊戲探索島</b><p>先選一個世界。每次冒險，都能帶回一點英文。</p></div><span aria-label={`已收集 ${earned} 顆星`}>✦ {earned}</span></div>
    <div className="arcade-game-grid">{Object.entries(ARCADE_GAMES).map(([id, game]) => {
      const stars = Object.values(stageRecords(progress, lv, id, 'practice')).reduce((sum, record) => sum + (Number(record?.stars) || 0), 0);
      return <button type="button" key={id} data-module-id={id} className="arcade-game-card" style={{ '--arcade-accent': game.color }} onClick={() => onSelect(id, 'game')}><ArcadeScene game={id}/><div className="arcade-game-card-copy"><span>{game.subtitle} · 3 段關卡</span><h3>{game.title}</h3><p>{game.description}</p><div className="arcade-game-card-footer"><span>{stars ? `輕鬆練習 · ${stars}/9 顆星` : '輕鬆練習 / 挑戰模式'}</span><b>去冒險 →</b></div></div></button>;
    })}</div>
    <button type="button" className="arcade-boardgame-link" data-module-id="petMonopoly" onClick={() => onSelect('petMonopoly', 'game')}><span aria-hidden="true">🎲</span><span><b>寵物大富翁</b><small>想來一場長冒險？帶著寵物逛學習島，和電腦玩家比策略。</small></span><span aria-hidden="true">→</span></button>
  </div>;
}
