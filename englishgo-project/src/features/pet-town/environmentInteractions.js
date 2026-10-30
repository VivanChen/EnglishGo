import { FURNITURE } from './worldData.js';
import { findTownPath } from './townNavigation.js';

const actions = {
  bowl: ['吃一口點心', 'eat', '正低頭享用碗裡的點心。'],
  cushion: ['在軟墊小歇', 'sleep', '在軟墊上舒舒服服地趴下了。'],
  rug: ['在地毯伸懶腰', 'stretch', '踩踩柔軟的地毯，伸了一個大懶腰。'],
  picnic: ['一起坐坐', 'settle', '找了一個舒服的野餐位子。'],
  planter: ['聞聞小花', 'sniff', '湊近聞聞葉子，耳朵也動了起來。'],
  tree: ['看看小樹', 'listen', '抬頭看看樹葉間的小動靜。'],
  shells: ['碰碰貝殼', 'play', '輕輕碰了一下貝殼，好像發現了寶物。'],
  basket: ['聞聞野餐籃', 'sniff', '好奇地聞聞籃子裡的香氣。'],
  chime: ['聽聽風鈴', 'listen', '歪著頭，留意風鈴輕輕晃動。'],
  fountain: ['看看水波', 'curious', '看著水面的小小波紋。'],
  mailbox: ['查看信箱', 'sniff', '湊近信箱，像在等一封新來的信。'],
  lantern: ['看看燈光', 'curious', '好奇地看著暖暖的小燈。'],
  telescope: ['陪你看星星', 'curious', '陪你一起仰望天空。'],
  bench: ['在長椅旁坐坐', 'settle', '靠著長椅，享受一小段安靜時光。'],
  stool: ['繞著小凳看看', 'curious', '歪著頭研究這個小凳子。'],
  table: ['聞聞茶桌', 'sniff', '來到茶桌旁，好奇地聞了聞。'],
  wateringCan: ['看看澆水壺', 'curious', '碰碰澆水壺，像在提醒你照顧花草。'],
  fence: ['看看圍欄外', 'curious', '站在圍欄邊，看看外面的風景。'],
};
const flat = new Set(['rug', 'picnic', 'cushion', 'shells']);
export function getEnvironmentInteraction(placement) {
  const item = FURNITURE.find(f => f.id === placement?.itemId), action = actions[item?.kind];
  return action ? { placement, item, label: action[0], clip: action[1], text: action[2], duration: item.kind === 'cushion' ? 8 : 6 } : null;
}

// Match the navigation grid's inflated furniture footprints, including rotation.
function clearPoint(point, placements) {
  if (point.x < -4.5 || point.x > 4.5 || point.z < -1.3 || point.z > 3.5) return false;
  return placements.every(p => {
    const f = FURNITURE.find(item => item.id === p.itemId);
    if (!f || flat.has(f.kind)) return true;
    const turned = Math.abs(Math.sin(p.rotation || 0)) > .5;
    return Math.abs(point.x - p.x) >= (turned ? f.size.z : f.size.x) / 2 + .22 ||
      Math.abs(point.z - p.z) >= (turned ? f.size.x : f.size.z) / 2 + .22;
  });
}
export function findEnvironmentApproach(start, placement, placements) {
  const interaction = getEnvironmentInteraction(placement);
  if (!interaction) return null;
  const { item } = interaction, angle = placement.rotation || 0;
  const x = item.size.x / 2 + .4, z = item.size.z / 2 + .4;
  const local = flat.has(item.kind) ? [{ x: 0, z: 0 }] : [
    { x: 0, z }, { x, z: 0 }, { x: -x, z: 0 }, { x: 0, z: -z },
    { x, z }, { x: -x, z }, { x, z: -z }, { x: -x, z: -z },
  ];
  const candidates = local.map(p => ({ x: placement.x + p.x * Math.cos(angle) + p.z * Math.sin(angle), z: placement.z - p.x * Math.sin(angle) + p.z * Math.cos(angle) }))
    .sort((a,b) => Math.hypot(a.x-start.x,a.z-start.z)-Math.hypot(b.x-start.x,b.z-start.z));
  for (const candidate of candidates) {
    // Snap before checking: a clear point can otherwise round into an obstacle.
    const point = { x: -4.5 + Math.round((candidate.x + 4.5) / .3) * .3, z: -1.3 + Math.round((candidate.z + 1.3) / .3) * .3 };
    if (!clearPoint(point, placements)) continue;
    const path = findTownPath(start, point, placements, FURNITURE);
    if (path.length || Math.hypot(start.x - point.x, start.z - point.z) < .23) return { ...interaction, path, point };
  }
  return null;
}
export function nearbyEnvironment(point, placements) {
  return placements.map(p => {
    const interaction = getEnvironmentInteraction(p);
    if (!interaction) return null;
    const a = -(p.rotation || 0), dx = point.x-p.x, dz = point.z-p.z;
    const x = dx*Math.cos(a)+dz*Math.sin(a), z = -dx*Math.sin(a)+dz*Math.cos(a);
    const distance = Math.hypot(Math.max(0,Math.abs(x)-interaction.item.size.x/2), Math.max(0,Math.abs(z)-interaction.item.size.z/2));
    return { placement:p, distance };
  }).filter(v => v && v.distance < .4).sort((a,b)=>a.distance-b.distance)[0]?.placement || null;
}
