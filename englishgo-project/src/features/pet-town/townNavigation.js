// A small bounded grid is sufficient for the cottage garden. Every neighbour is
// checked against furniture footprints, including diagonals at tight corners.
export function findTownPath(start, destination, placements, catalog) {
  const cell = .30, minX = -4.5, maxX = 4.5, minZ = -1.3, maxZ = 3.6;
  const width = Math.floor((maxX - minX) / cell) + 1, depth = Math.floor((maxZ - minZ) / cell) + 1;
  const center = ([x, z]) => ({ x: minX + x * cell, z: minZ + z * cell });
  const tile = p => [Math.max(0, Math.min(width - 1, Math.round((p.x - minX) / cell))), Math.max(0, Math.min(depth - 1, Math.round((p.z - minZ) / cell)))];
  const key = p => p.join(':');
  const obstacles = placements.map(p => {
    const def = catalog.find(item => item.id === p.itemId);
    if (!def || ['rug', 'picnic', 'cushion', 'shells'].includes(def.kind)) return null;
    const turned = Math.abs(Math.sin(p.rotation || 0)) > .5;
    return { x: p.x, z: p.z, halfX: (turned ? def.size.z : def.size.x) / 2 + .22, halfZ: (turned ? def.size.x : def.size.z) / 2 + .22 };
  }).filter(Boolean);
  const blocked = p => {
    if (p[0] < 0 || p[0] >= width || p[1] < 0 || p[1] >= depth) return true;
    const point = center(p);
    return obstacles.some(o => Math.abs(point.x - o.x) < o.halfX && Math.abs(point.z - o.z) < o.halfZ);
  };
  const source = tile(start), goal = tile(destination);
  if (blocked(goal)) return [];
  const open = [source], cameFrom = new Map(), cost = new Map([[key(source), 0]]), closed = new Set();
  const distance = p => Math.hypot(p[0] - goal[0], p[1] - goal[1]);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (open.length) {
    open.sort((a, b) => (cost.get(key(a)) + distance(a)) - (cost.get(key(b)) + distance(b)));
    const current = open.shift(), currentKey = key(current);
    if (currentKey === key(goal)) {
      const path = [current]; let cursor = currentKey;
      while (cameFrom.has(cursor)) { const previous = cameFrom.get(cursor); path.push(previous); cursor = key(previous); }
      path.reverse();
      // Keep turns, omit intermediate collinear tiles so gaits stay natural.
      const points = path.filter((p, i) => i === 0 || i === path.length - 1 ||
        (p[0] - path[i - 1][0]) !== (path[i + 1][0] - p[0]) ||
        (p[1] - path[i - 1][1]) !== (path[i + 1][1] - p[1])).map(center);
      return points.slice(1);
    }
    closed.add(currentKey);
    for (const [dx, dz] of directions) {
      const next = [current[0] + dx, current[1] + dz], nextKey = key(next);
      if (closed.has(nextKey) || blocked(next) || (dx && dz && (blocked([current[0] + dx, current[1]]) || blocked([current[0], current[1] + dz])))) continue;
      const nextCost = cost.get(currentKey) + Math.hypot(dx, dz);
      if (nextCost >= (cost.get(nextKey) ?? Infinity)) continue;
      cameFrom.set(nextKey, current); cost.set(nextKey, nextCost);
      if (!open.some(p => key(p) === nextKey)) open.push(next);
    }
  }
  return [];
}
