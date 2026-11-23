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
  event: { en: 'Unknown', zh: '未知' },
  treasure: { en: 'Treasure', zh: '寶箱' },
  pearl: { en: 'Pearl Clam', zh: '珍珠蚌' },
  boss: { en: 'Boss', zh: '首領' },
};

// Each region draws its map differently. The original acts climb a wide
// tower; the Drowned Stacks dive down a narrow trench (no merchant, but pearl
// clams); the Starlit Observatory floats as three islands joined by star
// bridges, with star gates that leap ahead to a higher island.
export const MAP_LAYOUTS = {
  tower: { cols: MAP_COLS, rows: MAP_ROWS, paths: PATHS, treasure: TREASURE_ROW, shop: 'shop' },
  drowned: { cols: 5, rows: 10, paths: 5, treasure: 5, shop: 'pearl', dive: true },
  observatory: { cols: 7, rows: 9, paths: 6, treasure: 5, shop: 'shop', islands: 3, gates: 2 },
};
export const layoutOf = zone => MAP_LAYOUTS[zone] || MAP_LAYOUTS.tower;

const id = (row, col) => `${row}-${col}`;

function crosses(edges, row, from, to) {
  if (from === to) return false;
  return edges.some(edge => edge.row === row && edge.from === to && edge.to === from);
}

function roomFor(holder, node, parents, act, layout) {
  const { rows } = layout;
  if (node.row === 0) return 'monster';
  if (node.row === layout.treasure) return 'treasure';
  if (node.row === rows - 1) return 'rest';
  const early = node.row < 2;
  const parentTypes = new Set(parents.map(parent => parent.type));
  const table = [
    ['monster', 46],
    ['event', 24],
    ['elite', early ? 0 : Math.round((act === 1 ? 10 : 13) * (holder.mods?.eliteRooms || 1))],
    ['rest', early || node.row === rows - 2 ? 0 : 10],
    [layout.shop, early ? 0 : layout.shop === 'pearl' ? 8 : 9],
  ].filter(([type, weight]) => weight > 0 && !(type !== 'monster' && type !== 'event' && parentTypes.has(type)));
  return weighted(holder, table);
}

// The hidden fourth act is a short, fixed climb: rest, merchant, the
// Gatekeeper, then the final boss.
function finalMap() {
  const col = (MAP_COLS - 1) / 2;
  const steps = ['rest', 'shop', 'elite'];
  const nodes = {};
  steps.forEach((type, row) => {
    nodes[id(row, col)] = { id: id(row, col), row, col, type, next: [row < steps.length - 1 ? id(row + 1, col) : 'boss'], dx: 0, dy: 0 };
  });
  nodes.boss = { id: 'boss', row: steps.length, col, type: 'boss', next: [], dx: 0, dy: 0 };
  return { act: 4, rows: steps.length, nodes };
}

// Star gates: a node on a lower island gets a second exit that leaps onto the
// next island up, skipping the rooms in between.
function addGates(holder, nodes, layout) {
  const size = layout.rows / layout.islands;
  const list = Object.values(nodes).filter(node => node.id !== 'boss');
  const made = [];
  for (let island = 0; island < layout.islands - 1 && made.length < layout.gates; island++) {
    const from = shuffle(holder, list.filter(node => node.row === island * size + 1 && ['monster', 'event'].includes(node.type)))[0];
    if (!from) continue;
    const landing = list.filter(node => node.row === (island + 1) * size + 1 && Math.abs(node.col - from.col) <= 3 && node.type !== 'elite');
    const to = shuffle(holder, landing)[0];
    if (!to || from.next.includes(to.id)) continue;
    from.next.push(to.id);
    from.gate = to.id;
    to.gateIn = true;
    made.push(from.id);
  }
}

export function generateMap(holder, act, zone = act) {
  if (act >= 4) return finalMap();
  const layout = layoutOf(zone);
  const { cols, rows } = layout;
  const nodes = {}, edges = [];
  const ensure = (row, col) => (nodes[id(row, col)] ||= { id: id(row, col), row, col, type: null, next: [], dx: 0, dy: 0 });
  const starts = [];
  for (let path = 0; path < layout.paths; path++) {
    let col = randInt(holder, 0, cols - 1);
    if (path === 1) while (col === starts[0]) col = randInt(holder, 0, cols - 1);
    starts.push(col);
    ensure(0, col);
    for (let row = 0; row < rows - 1; row++) {
      const options = shuffle(holder, [col - 1, col, col + 1].filter(next => next >= 0 && next < cols));
      const next = options.find(candidate => !crosses(edges, row, col, candidate)) ?? col;
      const from = ensure(row, col), to = ensure(row + 1, next);
      if (!from.next.includes(to.id)) { from.next.push(to.id); edges.push({ row, from: col, to: next }); }
      col = next;
    }
  }
  const list = Object.values(nodes).sort((a, b) => a.row - b.row || a.col - b.col);
  for (const node of list) {
    const parents = list.filter(other => other.next.includes(node.id));
    node.type = roomFor(holder, node, parents, act, layout);
    node.dx = Math.round((rnd(holder) - 0.5) * 36) / 100 || 0;
    node.dy = Math.round((rnd(holder) - 0.5) * 30) / 100 || 0;
  }
  list.filter(node => node.row === rows - 1).forEach(node => { node.next = ['boss']; });
  nodes.boss = { id: 'boss', row: rows, col: (cols - 1) / 2, type: 'boss', next: [], dx: 0, dy: 0 };
  const map = { act, nodes };
  if (zone !== act) Object.assign(map, { zone, cols, rows });
  if (layout.dive) map.dive = true;
  if (layout.islands) { map.islands = layout.islands; addGates(holder, nodes, layout); }
  return map;
}

export function availableNodes(run) {
  const { nodes } = run.map;
  if (!run.pos) return Object.values(nodes).filter(node => node.row === 0).map(node => node.id);
  return nodes[run.pos]?.next || [];
}
