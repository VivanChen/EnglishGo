import { randInt, rnd, shuffle, weighted } from './rng.js';

export const MAP_COLS = 7;
export const MAP_ROWS = 8;
export const TREASURE_ROW = 4;
const PATHS = 6;

export const ROOM_TYPES = {
  monster: { en: 'Enemy', zh: '敵人' },
  elite: { en: 'Elite', zh: '菁英' },
  rest: { en: 'Rest', zh: '燈下休憩' },
  shop: { en: 'Merchant', zh: '墨商' },
  event: { en: 'Unknown', zh: '未知事件' },
  treasure: { en: 'Treasure', zh: '寶箱' },
  boss: { en: 'Boss', zh: '首領' },
};

const id = (row, col) => `${row}-${col}`;

function crosses(edges, row, from, to) {
  if (from === to) return false;
  return edges.some(edge => edge.row === row && edge.from === to && edge.to === from);
}

function roomFor(holder, node, parents, act) {
  if (node.row === 0) return 'monster';
  if (node.row === TREASURE_ROW) return 'treasure';
  if (node.row === MAP_ROWS - 1) return 'rest';
  const early = node.row < 2;
  const parentTypes = new Set(parents.map(parent => parent.type));
  const table = [
    ['monster', 46],
    ['event', 24],
    ['elite', early ? 0 : Math.round((act === 1 ? 10 : 13) * (holder.mods?.eliteRooms || 1))],
    ['rest', early || node.row === MAP_ROWS - 2 ? 0 : 10],
    ['shop', early ? 0 : 9],
  ].filter(([type, weight]) => weight > 0 && !(type !== 'monster' && type !== 'event' && parentTypes.has(type)));
  return weighted(holder, table);
}

export function generateMap(holder, act) {
  const nodes = {}, edges = [];
  const ensure = (row, col) => (nodes[id(row, col)] ||= { id: id(row, col), row, col, type: null, next: [], dx: 0, dy: 0 });
  const starts = [];
  for (let path = 0; path < PATHS; path++) {
    let col = randInt(holder, 0, MAP_COLS - 1);
    if (path === 1) while (col === starts[0]) col = randInt(holder, 0, MAP_COLS - 1);
    starts.push(col);
    ensure(0, col);
    for (let row = 0; row < MAP_ROWS - 1; row++) {
      const options = shuffle(holder, [col - 1, col, col + 1].filter(next => next >= 0 && next < MAP_COLS));
      const next = options.find(candidate => !crosses(edges, row, col, candidate)) ?? col;
      const from = ensure(row, col), to = ensure(row + 1, next);
      if (!from.next.includes(to.id)) { from.next.push(to.id); edges.push({ row, from: col, to: next }); }
      col = next;
    }
  }
  const list = Object.values(nodes).sort((a, b) => a.row - b.row || a.col - b.col);
  for (const node of list) {
    const parents = list.filter(other => other.next.includes(node.id));
    node.type = roomFor(holder, node, parents, act);
    node.dx = Math.round((rnd(holder) - 0.5) * 36) / 100 || 0;
    node.dy = Math.round((rnd(holder) - 0.5) * 30) / 100 || 0;
  }
  list.filter(node => node.row === MAP_ROWS - 1).forEach(node => { node.next = ['boss']; });
  nodes.boss = { id: 'boss', row: MAP_ROWS, col: (MAP_COLS - 1) / 2, type: 'boss', next: [], dx: 0, dy: 0 };
  return { act, nodes };
}

export function availableNodes(run) {
  const { nodes } = run.map;
  if (!run.pos) return Object.values(nodes).filter(node => node.row === 0).map(node => node.id);
  return nodes[run.pos]?.next || [];
}
