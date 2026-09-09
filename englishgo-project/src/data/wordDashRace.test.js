import { describe, expect, it } from 'vitest';
import { DASH_COURSES, dashRaceRank } from './wordDash.js';
import { createDashRival, stepDashRival, dashRecoilDistance } from './wordDashRace.js';

const course = DASH_COURSES[0];
const obstacles = [
  { type: 'bar', x: 0, z: -10, angle: Math.PI / 2 },
  { type: 'ball', x: 0, z: -10, y: 1, radius: .95 },
  { type: 'roller', x: 0, z: -10, y: 1.1, radius: 1.1 },
  { type: 'piston', x: 0, z: -10, y: 1, width: 2.5, depth: 2.5, height: 1.8 },
];
const nearObstacle = (id, x) => ({ ...createDashRival(id, course), distance: 9.5, x, delay: 0 });

describe('independent race collisions', () => {
  it.each(obstacles)('only knocks back the runner touching a $type', obstacle => {
    const hit = nearObstacle(1, 0), safe = nearObstacle(2, 4.65);
    const afterHit = stepDashRival(hit, .016, [obstacle], 5);
    const afterSafe = stepDashRival(safe, .016, [obstacle], 5);
    expect(afterHit.impacts).toBe(1); expect(afterSafe.impacts).toBe(0);
    expect(hit.hits.size).toBe(0); expect(safe.hits.size).toBe(0);
    const recoiled = stepDashRival(afterHit, .3, [obstacle], 5);
    const advanced = stepDashRival(afterSafe, .3, [obstacle], 5);
    expect(recoiled.distance).toBeLessThan(afterHit.distance);
    expect(advanced.distance).toBeGreaterThan(afterSafe.distance);
    expect(dashRaceRank(recoiled.distance, [advanced.distance], 157)).toBe(2);
  });
  it('does not consume another runner’s collision with the same obstacle', () => {
    const first = stepDashRival(nearObstacle(1, 0), .016, [obstacles[1]], 5);
    const second = stepDashRival(nearObstacle(2, 0), .016, [obstacles[1]], 5);
    expect(first.impacts).toBe(1); expect(second.impacts).toBe(1);
    expect(first.hits).not.toBe(second.hits);
  });
  it('allows jumping over an obstacle and passing a retracted piston', () => {
    const jumper = { ...nearObstacle(1, 0), jumpTime: .45 };
    expect(stepDashRival(jumper, .016, [obstacles[0]], 5).impacts).toBe(0);
    expect(stepDashRival(nearObstacle(1, 0), .016, [{ ...obstacles[3], y: -1.6 }], 5).impacts).toBe(0);
  });
  it('freezes each runner during pause and resets collision history on replay', () => {
    const hit = stepDashRival(nearObstacle(1, 0), .016, [obstacles[1]], 5);
    expect(stepDashRival(hit, 0, obstacles, 5)).toBe(hit);
    expect(createDashRival(1, course).hits.size).toBe(0);
    expect(createDashRival(1, course).recoil).toBe(0);
  });
  it('uses the same bounded recoil curve for player and rivals', () => {
    expect(dashRecoilDistance(10, .6)).toBe(10);
    expect(dashRecoilDistance(10, 0)).toBe(7);
    expect(dashRecoilDistance(21, 0, 6)).toBe(15);
  });
  it.each(DASH_COURSES)('lets every rival recover and finish $title without player progress', selected => {
    let runners = Array.from({ length: 6 }, (_, i) => createDashRival(i, selected));
    const courseObstacles = Array.from({ length: selected.rounds }, (_, i) => ({ ...obstacles[1], z: -10 - i * 32 }));
    for (let frame = 0; frame < 12000; frame++) runners = runners.map(runner => stepDashRival(runner, .016, courseObstacles, selected.rounds, Array(selected.rounds).fill(1)));
    expect(runners.every(runner => runner.distance === selected.rounds * 32 - 3)).toBe(true);
    expect(runners.some(runner => runner.impacts > 0)).toBe(true);
    expect(dashRaceRank(selected.rounds * 32 - 3, runners.map(runner => runner.distance), selected.rounds * 32 - 3)).toBe(7);
  });
});
