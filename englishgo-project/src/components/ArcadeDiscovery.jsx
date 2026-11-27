import { useState } from 'react';
import ArcadeScene from './ArcadeArt.jsx';
import { ARCADE_GAMES, readArcadeProgress, stageRecords } from '../data/arcade.js';

export default function ArcadeDiscovery({ lv, onSelect }) {
  const [progress] = useState(readArcadeProgress);
  const earned = Object.keys(ARCADE_GAMES).reduce((sum, game) => sum + ['practice', 'challenge'].reduce((total, mode) => total + Object.values(stageRecords(progress, lv, game, mode)).reduce((n, record) => n + (Number(record?.stars) || 0), 0), 0), 0);
  return <div className="arcade-discovery">
    <div className="arcade-island-heading"><div><b>歡迎來到遊戲探索島</b><p>先選一個世界。每次冒險，都能帶回一點英文。</p></div><span aria-label={`已收集 ${earned} 顆星`}>✦ {earned}</span></div>
    <button type="button" className="arcade-doodle-feature" data-module-id="doodleBrawl" onClick={() => onSelect('doodleBrawl', 'game')}>
      <span className="arcade-doodle-copy"><small>NEW · ARENA SURVIVAL</small><strong>塗鴉大亂鬥</strong><em lang="en">Doodle Brawl</em><span>墨水怪從筆記本裡跑出來了！拿起鉛筆、尺和紙飛機，撐過 12 波攻勢。</span><b>削好鉛筆出發 →</b></span>
      <img src="/images/doodle-brawl/title.webp" alt="" loading="lazy" draggable="false"/>
    </button>
    <button type="button" className="arcade-echo-feature" data-module-id="echoArchive" onClick={() => onSelect('echoArchive', 'game')}>
      <span className="arcade-echo-copy"><small>NEW · DECKBUILDING ADVENTURE</small><strong>回聲書庫</strong><em lang="en">Echo Archive</em><span>一副牌、一盞燈，登上被寂靜吞噬的三層書庫。組牌、選路線、打倒首領！</span><b>點亮提燈出發 →</b></span>
      <svg viewBox="0 0 360 220" aria-hidden="true">
        <defs><radialGradient id="arcadeEchoGlow" cx=".5" cy=".55" r=".5"><stop offset="0" stopColor="#ffe7a6" stopOpacity=".55"/><stop offset="1" stopColor="#ffe7a6" stopOpacity="0"/></radialGradient></defs>
        <circle cx="190" cy="120" r="110" fill="url(#arcadeEchoGlow)"/>
        {[[-22, '#7b2733', '#e08b72', 110], [0, '#1d5470', '#84d2e2', 180], [22, '#4f2f86', '#cfaeff', 250]].map(([rotate, fill, rim, x]) => <g key={x} transform={`translate(${x} 128) rotate(${rotate})`}><rect x="-38" y="-56" width="76" height="106" rx="9" fill={fill} stroke={rim} strokeWidth="3"/><rect x="-28" y="-30" width="56" height="38" rx="6" fill="#00000040"/><circle cx="-30" cy="-48" r="10" fill="#f0cf84" stroke="#2a1906" strokeWidth="2"/><path d="M-18 24h36M-14 34h28" stroke="#f6efdd" strokeOpacity=".6" strokeWidth="3" strokeLinecap="round"/></g>)}
        <path d="M180 92l6 14 15 1-11 10 4 15-14-8-14 8 4-15-11-10 15-1z" fill="#ffe7a6"/>
        <circle cx="62" cy="48" r="2.5" fill="#ffe7a6"/><circle cx="318" cy="64" r="2" fill="#ffe7a6"/><circle cx="300" cy="190" r="3" fill="#ffe7a6" opacity=".7"/>
      </svg>
    </button>
    <button type="button" className="arcade-dash-feature" data-module-id="wordDash" onClick={() => onSelect('wordDash', 'game')}><span className="arcade-dash-copy"><small>NEW · 3D PARTY RUN</small><strong>單字衝衝！</strong><span>聽英文、跳障礙，衝過正確的門。</span><b>前往天空賽道 →</b></span><svg viewBox="0 0 400 210" aria-hidden="true"><path d="M100 75h195l85 135H10Z" fill="#40c6e6"/><path d="M100 75 10 210m285-135 85 135" stroke="#ff87c8" strokeWidth="12"/><g strokeWidth="12" fill="#fff1fb"><path d="M90 108V35h65v73" stroke="#fc5baa"/><path d="M169 108V35h65v73" stroke="#8053d6"/><path d="M248 108V35h65v73" stroke="#ffd445"/></g><g transform="translate(187 112) rotate(-9)"><rect x="-24" y="0" width="48" height="65" rx="23" fill="#a575ec"/><ellipse cy="23" rx="18" ry="16" fill="#fffaf0"/><path d="M-7 20v6m14-6v6" stroke="#4c2a71" strokeWidth="4" strokeLinecap="round"/><path d="m-23 30-12 12m58-12 12 12M-12 62l-5 9m29-9 5 9" stroke="#a575ec" strokeWidth="12" strokeLinecap="round"/></g><path d="m43 39 4 11 12 1-9 8 3 12-10-7-10 7 3-12-9-8 12-1Z" fill="#fff27c"/></svg></button>
    <button type="button" className="arcade-island-feature" data-module-id="colorIsland" onClick={() => onSelect('colorIsland', 'game')}><span><small>NEW · 3D COLOR SURVIVAL</small><strong>顏色生存島</strong><span>聽英文指令，跑到安全色！三種難度、三個救生圈。</span><b>登上彩色浮島 →</b></span><span className="arcade-island-tiles" aria-hidden="true">{['#ed536b', '#529eed', '#ffe06a', '#6ed39a', '#b399ed', '#ffa35c', '#f6abd5', '#f5f7ff', '#529eed'].map((color, i) => <i key={i} style={{ background: color }}>{i === 4 ? '●' : '✦'}</i>)}</span></button>
    <div className="arcade-game-grid">{Object.entries(ARCADE_GAMES).map(([id, game]) => {
      const stars = Object.values(stageRecords(progress, lv, id, 'practice')).reduce((sum, record) => sum + (Number(record?.stars) || 0), 0);
      return <button type="button" key={id} data-module-id={id} className="arcade-game-card" style={{ '--arcade-accent': game.color }} onClick={() => onSelect(id, 'game')}><ArcadeScene game={id}/><div className="arcade-game-card-copy"><span>{game.subtitle} · 3 段關卡</span><h3>{game.title}</h3><p>{game.description}</p><div className="arcade-game-card-footer"><span>{stars ? `輕鬆練習 · ${stars}/9 顆星` : '輕鬆練習 / 挑戰模式'}</span><b>去冒險 →</b></div></div></button>;
    })}</div>
    <button type="button" className="arcade-boardgame-link" data-module-id="pets" onClick={() => onSelect('pets', 'pet')}><span aria-hidden="true">🐾</span><span><b>海風小鎮</b><small>和貓咪、小狗、小兔一起安家，走進九段英文故事。</small></span><span aria-hidden="true">→</span></button>
  </div>;
}
