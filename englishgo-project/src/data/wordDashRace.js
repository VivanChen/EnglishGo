import { dashObstacleHit } from './wordDash.js';

export const DASH_RECOIL_SECONDS = .6;
export function dashRecoilDistance(from, remaining, amount = 3) {
  return from - amount * (1 - (Math.max(0, remaining) / DASH_RECOIL_SECONDS) ** 3);
}

export function createDashRival(id, course) {
  return { id, x: (id % 3 - 1) * 4.65, distance: -2 - id * 1.2,
    speed: course.speed * (1.04 - id * .025), delay: id * .18,
    recoil: 0, recoilFrom: 0, hits: new Set(), impacts: 0,
    gateIndex: 0, gateWait: 0, gatePassed: -1, jumpTime: -1, jumpHeight: 0 };
}

// Each rival owns its position, hit history, recoil and door delay. No player state is used.
export function stepDashRival(state, dt, obstacles, total, correctLanes = []) {
  if (!(dt > 0) || state.distance >= total * 32 - 3) return state;
  const next = { ...state, gatePassed: -1 };
  if (next.delay > 0) return { ...next, delay: Math.max(0, next.delay - dt) };
  if (next.recoil > 0) {
    next.recoil = Math.max(0, next.recoil - dt);
    next.distance = dashRecoilDistance(next.recoilFrom, next.recoil);
    return next;
  }
  if (next.gateWait > 0) {
    next.gateWait = Math.max(0, next.gateWait - dt);
    if (!next.gateWait) next.gatePassed = next.gateIndex - 1;
    return next;
  }
  const gateDistance = next.gateIndex * 32 + 21;
  const lane = correctLanes[next.gateIndex] ?? (next.id + next.gateIndex) % 3;
  if (next.distance > gateDistance - 7) next.x += ((lane - 1) * 4.65 - next.x) * Math.min(1, dt * 10);

  // Some runners anticipate an obstacle; others hit it and recover independently.
  const upcoming = obstacles.findIndex(obstacle => !next.hits.has(obstacle) && -obstacle.z - next.distance > .8 && -obstacle.z - next.distance < 2.2);
  if (next.jumpTime < 0 && upcoming >= 0 && (next.id + upcoming) % 3 === 0) next.jumpTime = 0;
  if (next.jumpTime >= 0) { next.jumpTime += dt; if (next.jumpTime >= .95) next.jumpTime = -1; }
  next.jumpHeight = next.jumpTime < 0 ? 0 : Math.sin(next.jumpTime / .95 * Math.PI) * 2.8;
  next.distance = Math.min(total * 32 - 3, next.distance + next.speed * dt);
  const collision = obstacles.find(obstacle => !next.hits.has(obstacle) && dashObstacleHit(obstacle, next.x, -next.distance, next.jumpHeight));
  if (collision) {
    next.hits = new Set(next.hits).add(collision);
    next.impacts++;
    next.recoilFrom = next.distance;
    next.recoil = DASH_RECOIL_SECONDS;
    next.jumpTime = -1; next.jumpHeight = 0;
  } else if (next.gateIndex < total && next.distance >= gateDistance) {
    next.distance = gateDistance;
    next.gateWait = .65 + next.id * .1;
    next.gateIndex++;
  }
  return next;
}
