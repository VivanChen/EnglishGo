import { useEffect, useRef } from 'react';
import { ACTS, ENCOUNTERS, ENEMIES, bossName, bossOf } from '../data/enemies.js';
import { MAP_COLS, MAP_ROWS, ROOM_TYPES, availableNodes } from '../engine/map.js';
import { actBoss } from '../engine/engine.js';
import Glyph from '../components/Glyph.jsx';
import { EnemyArt } from '../components/Creatures.jsx';
import { actCreatureImages, preloadImages } from '../components/paintedArt.js';
import { sfx } from '../sound.js';

const ROW_H = 92;
const LEGEND = ['monster', 'elite', 'event', 'rest', 'shop', 'treasure'];

export default function MapScreen({ run, dispatch }) {
  const { nodes } = run.map;
  const list = Object.values(nodes);
  const available = new Set(availableNodes(run));
  const rows = run.map.rows || MAP_ROWS;
  const height = (rows + 1) * ROW_H + 70;
  const point = node => (node.id === 'boss'
    ? { x: 50, y: 64 }
    : { x: ((node.col + 0.5 + node.dx) / MAP_COLS) * 100, y: height - 46 - node.row * ROW_H - node.dy * 34 });
  const traveled = new Set(run.path.slice(1).map((id, index) => `${run.path[index]}>${id}`));
  const visited = new Set(run.path);
  const scroller = useRef(null);
  const encounter = actBoss(run);
  const boss = { ...bossName(encounter), art: ENEMIES[bossOf(encounter)].art };
  const actInfo = ACTS[run.act];

  // Fetch this act's creature paintings while the player studies the map.
  useEffect(() => { preloadImages(actCreatureImages(run.act, ENCOUNTERS, ENEMIES)); }, [run.act]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const row = run.pos ? nodes[run.pos].row : 0;
    el.scrollTop = Math.max(0, height - 46 - row * ROW_H - el.clientHeight * 0.62);
  }, [run.pos, nodes, height]);

  const enter = id => { sfx.map(); dispatch({ type: 'MAP_SELECT', id }); };

  return <section className="ea-map" aria-label="書庫地圖">
    <header className="ea-map-head">
      <span className="ea-eyebrow" lang="en">ACT {actInfo.roman} · FLOOR {run.floor}</span>
      <h2><span lang="en">{actInfo.en}</span><small>{actInfo.zh}</small></h2>
      <p>{available.size ? '選擇下一個房間。發光的路線可以前往。' : actInfo.mood}</p>
    </header>
    <div className="ea-map-scroll" ref={scroller}>
      <div className="ea-map-canvas" style={{ height }}>
        <svg className="ea-map-lines" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {list.flatMap(node => node.next.map(nextId => {
            const a = point(node), b = point(nodes[nextId]);
            const key = `${node.id}>${nextId}`;
            const open = run.pos === node.id && available.has(nextId);
            return <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" className={traveled.has(key) ? 'is-traveled' : open ? 'is-open' : ''}/>;
          }))}
        </svg>
        {list.map(node => {
          const p = point(node);
          const isBoss = node.id === 'boss';
          const can = available.has(node.id);
          const echo = node.echo && !run.keys?.echo && !visited.has(node.id);
          const label = `${ROOM_TYPES[node.type].zh}${echo ? '（發出回聲：擊倒可得回聲之鑰）' : ''}${isBoss ? `：${boss.zh}` : ''}${can ? '，可以前往' : visited.has(node.id) ? '，已走過' : ''}`;
          return <button type="button" key={node.id}
            className={`ea-node is-${node.type} ${echo ? 'is-echo' : ''} ${can ? 'is-available' : ''} ${visited.has(node.id) ? 'is-visited' : ''} ${run.pos === node.id ? 'is-current' : ''}`}
            style={{ left: `${p.x}%`, top: p.y }}
            disabled={!can}
            aria-label={label}
            data-tip={can ? `${ROOM_TYPES[node.type].en} · ${ROOM_TYPES[node.type].zh}${echo ? ' · 回聲菁英：更強，但守著回聲之鑰' : ''}${node.type === 'event' ? ' · 多半是事件，偶爾是伏擊、寶箱或流浪墨商' : ''}` : undefined}
            onClick={() => enter(node.id)}>
            {isBoss ? <span className="ea-boss-portrait"><EnemyArt art={boss.art}/></span> : <Glyph name={node.type} size={26}/>}
            {echo && <i className="ea-node-key" aria-hidden="true"><Glyph name="key" size={13}/></i>}
            {isBoss && <span className="ea-boss-name"><b lang="en">{boss.en}</b><small>{boss.zh}</small></span>}
          </button>;
        })}
      </div>
    </div>
    <ul className="ea-map-legend" aria-label="圖例">{LEGEND.map(type => <li key={type} className={`is-${type}`}><Glyph name={type} size={16}/><span lang="en">{ROOM_TYPES[type].en}</span><small>{ROOM_TYPES[type].zh}</small></li>)}</ul>
  </section>;
}
