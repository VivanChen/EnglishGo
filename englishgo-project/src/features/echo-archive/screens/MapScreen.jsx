import { useEffect, useRef } from 'react';
import { ACTS, ENCOUNTERS, ENEMIES, bossName, bossOf, zoneOf } from '../data/enemies.js';
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
  const cols = run.map.cols || MAP_COLS;
  // The Drowned Stacks dive: the entrance is at the top and the boss waits below.
  const dive = Boolean(run.map.dive);
  const height = (rows + 1) * ROW_H + 70;
  const rowY = row => (dive ? 46 + row * ROW_H : height - 46 - row * ROW_H);
  const point = node => (node.id === 'boss'
    ? { x: 50, y: dive ? height - 64 : 64 }
    : { x: ((node.col + 0.5 + node.dx) / cols) * 100, y: rowY(node.row) - (dive ? -1 : 1) * node.dy * 34 });
  const traveled = new Set(run.path.slice(1).map((id, index) => `${run.path[index]}>${id}`));
  const visited = new Set(run.path);
  const scroller = useRef(null);
  const encounter = actBoss(run);
  const boss = { ...bossName(encounter), art: ENEMIES[bossOf(encounter)].art };
  const zone = zoneOf(run);
  const actInfo = ACTS[zone];
  const legend = run.map.dive ? LEGEND.map(type => (type === 'shop' ? 'pearl' : type)) : LEGEND;
  // The Observatory floats as islands: the rows of each one sit on a cloud of stars.
  const islands = run.map.islands ? Array.from({ length: run.map.islands }, (_, i) => {
    const size = rows / run.map.islands;
    const top = rowY((i + 1) * size - 1) - 40, bottom = rowY(i * size) + 40;
    return { key: i, top, height: bottom - top };
  }) : [];

  // Fetch this region's creature paintings while the player studies the map.
  useEffect(() => { preloadImages(actCreatureImages(zone, ENCOUNTERS, ENEMIES)); }, [zone]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const row = run.pos ? nodes[run.pos].row : 0;
    el.scrollTop = dive ? Math.max(0, rowY(row) - el.clientHeight * 0.38) : Math.max(0, rowY(row) - el.clientHeight * 0.62);
  }, [run.pos, nodes, height]); // eslint-disable-line react-hooks/exhaustive-deps

  const enter = id => { sfx.map(); dispatch({ type: 'MAP_SELECT', id }); };

  return <section className={`ea-map zone-${zone} ${dive ? 'is-dive' : ''}`} aria-label="書庫地圖">
    <header className="ea-map-head">
      <span className="ea-eyebrow" lang="en">ACT {actInfo.roman} · FLOOR {run.floor}</span>
      <h2><span lang="en">{actInfo.en}</span><small>{actInfo.zh}</small></h2>
      <p>{available.size ? `選擇下一個房間。發光的路線可以前往。${dive ? '這裡要往下潛。' : run.map.islands ? '星門（★）可以直接跳到上一座浮島。' : ''}` : actInfo.mood}</p>
    </header>
    <div className="ea-map-scroll" ref={scroller}>
      <div className="ea-map-canvas" style={{ height }}>
        {islands.map(island => <div key={island.key} className="ea-map-island" style={{ top: island.top, height: island.height }} aria-hidden="true"/>)}
        <svg className="ea-map-lines" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {list.flatMap(node => node.next.map(nextId => {
            const a = point(node), b = point(nodes[nextId]);
            const key = `${node.id}>${nextId}`;
            const open = run.pos === node.id && available.has(nextId);
            const gate = node.gate === nextId;
            const state = traveled.has(key) ? 'is-traveled' : open ? 'is-open' : '';
            if (gate) {
              const bend = a.x < 50 ? -18 : 18;
              return <path key={key} d={`M${a.x} ${a.y}Q${(a.x + b.x) / 2 + bend} ${(a.y + b.y) / 2} ${b.x} ${b.y}`} vectorEffect="non-scaling-stroke" className={`is-gate ${state}`}/>;
            }
            return <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" className={state}/>;
          }))}
        </svg>
        {list.map(node => {
          const p = point(node);
          const isBoss = node.id === 'boss';
          const can = available.has(node.id);
          const echo = node.echo && !run.keys?.echo && !visited.has(node.id);
          const gateOpen = node.gate && run.pos === node.id && available.has(node.gate);
          const label = `${ROOM_TYPES[node.type].zh}${echo ? '（發出回聲：擊倒可得回聲之鑰）' : ''}${node.gate ? '（星門：可以直接跳到上一座浮島）' : ''}${isBoss ? `：${boss.zh}` : ''}${can ? '，可以前往' : visited.has(node.id) ? '，已走過' : ''}`;
          const tip = `${ROOM_TYPES[node.type].en} · ${ROOM_TYPES[node.type].zh}${echo ? ' · 回聲菁英：更強，但守著回聲之鑰' : ''}${node.type === 'event' ? ' · 多半是事件，偶爾是伏擊、寶箱或流浪墨商' : ''}${node.type === 'pearl' ? ' · 打開珍珠蚌，挑一顆珍珠' : ''}${node.gate ? ' · 星門：走過之後可以直接跳到上一座浮島' : ''}${node.gateIn ? ' · 星門的出口' : ''}`;
          return <button type="button" key={node.id}
            className={`ea-node is-${node.type} ${echo ? 'is-echo' : ''} ${node.gate ? 'has-gate' : ''} ${gateOpen ? 'is-gate-open' : ''} ${can ? 'is-available' : ''} ${visited.has(node.id) ? 'is-visited' : ''} ${run.pos === node.id ? 'is-current' : ''}`}
            style={{ left: `${p.x}%`, top: p.y }}
            disabled={!can}
            aria-label={label}
            data-tip={can || node.gate ? tip : undefined}
            onClick={() => enter(node.id)}>
            {isBoss ? <span className="ea-boss-portrait"><EnemyArt art={boss.art}/></span> : <Glyph name={node.type} size={26}/>}
            {echo && <i className="ea-node-key" aria-hidden="true"><Glyph name="key" size={13}/></i>}
            {node.gate && <i className="ea-node-gate" aria-hidden="true"><Glyph name="gate" size={14}/></i>}
            {isBoss && <span className="ea-boss-name"><b lang="en">{boss.en}</b><small>{boss.zh}</small></span>}
          </button>;
        })}
      </div>
    </div>
    <ul className="ea-map-legend" aria-label="圖例">
      {legend.map(type => <li key={type} className={`is-${type}`}><Glyph name={type} size={16}/><span lang="en">{ROOM_TYPES[type].en}</span><small>{ROOM_TYPES[type].zh}</small></li>)}
      {run.map.islands && <li className="is-gate"><Glyph name="gate" size={16}/><span lang="en">Star Gate</span><small>星門</small></li>}
    </ul>
  </section>;
}
