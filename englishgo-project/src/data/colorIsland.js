import { shuffleArcade } from './arcade.js';

export const ISLAND_COLORS = [
  { id: 'red', zh: '紅色', hex: '#ed536b', ink: '#47132a', symbol: '●' },
  { id: 'blue', zh: '藍色', hex: '#529eed', ink: '#102a58', symbol: '◆' },
  { id: 'yellow', zh: '黃色', hex: '#ffe06a', ink: '#62461b', symbol: '★' },
  { id: 'green', zh: '綠色', hex: '#6ed39a', ink: '#134c35', symbol: '▲' },
  { id: 'purple', zh: '紫色', hex: '#b399ed', ink: '#3d245d', symbol: '✚' },
  { id: 'orange', zh: '橘色', hex: '#ffa35c', ink: '#633419', symbol: '■' },
  { id: 'pink', zh: '粉紅色', hex: '#f6abd5', ink: '#642947', symbol: '♥' },
  { id: 'white', zh: '白色', hex: '#f5f7ff', ink: '#414b6f', symbol: '✦' },
];
export const ISLAND_MODES = [
  { id: 'warmup', title: '暖身小島', colors: 4, rounds: 5, seconds: 8, description: '先熟悉紅、藍、黃、綠，慢慢找安全格。' },
  { id: 'rainbow', title: '彩虹派對', colors: 6, rounds: 7, seconds: 6.5, description: '紫色與橘色也來了，聽清楚再出發！' },
  { id: 'survival', title: '生存挑戰', colors: 8, rounds: 8, seconds: 5, description: '八種顏色、五秒倒數，挑戰你的反應。' },
];
export const islandColor = id => ISLAND_COLORS.find(color => color.id === id);
export const islandInstruction = id => `Stand on ${id}!`;
export const islandTilePosition = index => ({ x: index % 4, z: Math.floor(index / 4) });
export function islandStandingTile(position) {
  const x = Math.round(position.x), z = Math.round(position.z);
  return x >= 0 && x < 4 && z >= 0 && z < 4 && Math.abs(position.x - x) <= .46 && Math.abs(position.z - z) <= .46 ? z * 4 + x : -1;
}
export function makeIslandRounds(mode, random = Math.random) {
  const colors = shuffleArcade(ISLAND_COLORS.slice(0, mode.colors), random);
  return Array.from({ length: mode.rounds }, (_, index) => ({
    target: colors[index % colors.length].id,
    tiles: shuffleArcade(Array.from({ length: 16 }, (_, cell) => colors[(cell + index) % colors.length].id), random),
  }));
}
export function startIsland(mode, rounds) {
  return { mode, rounds, phase: 'ready', readyMs: 3000, index: 0, position: islandTilePosition(5), targetTile: 5, remainingMs: mode.seconds * 1000, resolveMs: 1700, lives: 3, passed: null, earned: 0, completed: 0, mistakes: 0 };
}
export function colorIslandReducer(state, action) {
  if (action.type === 'START') return startIsland(action.mode, action.rounds);
  if (action.type === 'LOBBY') return null;
  if (!state) return state;
  if (action.type === 'UNAVAILABLE') return { ...state, phase: 'unavailable' };
  if (action.type === 'PAUSE' && ['ready', 'playing', 'resolving'].includes(state.phase)) return { ...state, resumePhase: state.phase, phase: 'paused' };
  if (action.type === 'RESUME' && state.phase === 'paused') return { ...state, phase: state.resumePhase };
  if (state.phase === 'playing') {
    if (action.type === 'SELECT' && Number.isInteger(action.index) && action.index >= 0 && action.index < 16) return { ...state, targetTile: action.index };
    if (action.type === 'MOVE') {
      const target = islandTilePosition(state.targetTile);
      const x = Math.max(0, Math.min(3, target.x + action.dx)), z = Math.max(0, Math.min(3, target.z + action.dz));
      return { ...state, targetTile: z * 4 + x };
    }
  }
  if (action.type !== 'TICK' || !Number.isFinite(action.ms) || action.ms <= 0) return state;
  if (state.phase === 'ready') {
    const readyMs = Math.max(0, state.readyMs - action.ms);
    return { ...state, readyMs, phase: readyMs ? 'ready' : 'playing' };
  }
  if (state.phase === 'resolving') {
    const resolveMs = Math.max(0, state.resolveMs - action.ms);
    if (resolveMs) return { ...state, resolveMs };
    if (state.lives === 0) return { ...state, resolveMs, phase: 'lost' };
    if (state.completed === state.rounds.length) return { ...state, resolveMs, phase: 'won' };
    const position = state.passed ? islandTilePosition(islandStandingTile(state.position)) : islandTilePosition(5);
    return { ...state, phase: 'playing', index: state.index + (state.passed ? 1 : 0), position, targetTile: position.z * 4 + position.x, remainingMs: state.mode.seconds * 1000, resolveMs: 1700, passed: null };
  }
  if (state.phase !== 'playing') return state;
  // Movement is resolved before the deadline check, using only time remaining in this round.
  const ms = Math.min(action.ms, state.remainingMs), target = islandTilePosition(state.targetTile);
  const dx = target.x - state.position.x, dz = target.z - state.position.z, distance = Math.hypot(dx, dz);
  const fraction = distance ? Math.min(1, ms / 1000 * 4.5 / distance) : 0;
  const position = { x: state.position.x + dx * fraction, z: state.position.z + dz * fraction };
  const remainingMs = Math.max(0, state.remainingMs - action.ms);
  if (remainingMs) return { ...state, position, remainingMs };
  const tile = islandStandingTile(position), passed = state.rounds[state.index].tiles[tile] === state.rounds[state.index].target;
  return { ...state, position, remainingMs, phase: 'resolving', resolveMs: 1700, passed, lives: state.lives - (passed ? 0 : 1), completed: state.completed + (passed ? 1 : 0), earned: state.earned + (passed ? 10 : 0), mistakes: state.mistakes + (passed ? 0 : 1) };
}
