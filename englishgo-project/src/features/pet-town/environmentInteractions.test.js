import { describe, expect, it } from 'vitest';
import { createWorld } from './worldState.js';
import { FURNITURE } from './worldData.js';
import { findEnvironmentApproach, getEnvironmentInteraction, nearbyEnvironment } from './environmentInteractions.js';

describe('environment interaction approach routes', () => {
  it('gives every furnished object an appropriate reaction', () => {
    for (const item of FURNITURE) expect(getEnvironmentInteraction({ itemId: item.id })?.clip).toBeTruthy();
    expect(getEnvironmentInteraction({ itemId: 'missing' })).toBeNull();
  });
  it('approaches the outside of the food bowl instead of walking through it', () => {
    const placements = createWorld().placements, bowl = placements[1];
    const result = findEnvironmentApproach({ x: -.5, z: 1.2 }, bowl, placements);
    expect(result.clip).toBe('eat'); expect(result.path.length).toBeGreaterThan(0);
    expect(Math.hypot(result.point.x-bowl.x, result.point.z-bowl.z)).toBeGreaterThan(.6);
    expect(Math.hypot(result.point.x-bowl.x, result.point.z-bowl.z)).toBeLessThan(.9);
    expect(result.path.at(-1)).toEqual(result.point);
  });
  it('uses the center of a soft cushion and accepts an already-arrived companion', () => {
    const placements = createWorld().placements, cushion = placements[0];
    const route = findEnvironmentApproach({ x: 0, z: 2 }, cushion, placements);
    expect(route.clip).toBe('sleep');
    expect(Math.hypot(route.point.x-cushion.x,route.point.z-cushion.z)).toBeLessThan(.23);
    const arrived = findEnvironmentApproach(route.point, cushion, placements);
    expect(arrived.path).toEqual([]);
  });
  it('does not claim arrival if every approach is blocked', () => {
    const target = { id: 'target', itemId: 'harbor-cushion', x: 0, z: 1, rotation: 0 };
    const blocker = { id: 'block', itemId: 'harbor-table', x: 0, z: 1, rotation: 0 };
    expect(findEnvironmentApproach({ x: -3, z: 1 }, target, [target, blocker])).toBeNull();
  });
  it('finds objects beside a ground destination, respecting rotated footprints', () => {
    const bench = { id: 'bench', itemId: 'harbor-bench', x: 2, z: 1, rotation: Math.PI/2 };
    expect(nearbyEnvironment({ x: 2, z: 2 }, [bench])).toEqual(bench);
    expect(nearbyEnvironment({ x: 3.2, z: 1 }, [bench])).toBeNull();
    expect(nearbyEnvironment({ x: -3, z: 3 }, createWorld().placements)).toBeNull();
  });
  it('keeps edge furniture routes within the navigable garden', () => {
    const item = { id: 'edge', itemId: 'harbor-bowl', x: 3.8, z: 3.2, rotation: Math.PI/2 };
    const result = findEnvironmentApproach({ x: 0, z: 1 }, item, [item]);
    expect(result).not.toBeNull();
    expect(result.path.every(p => p.x <= 4.5 && p.z <= 3.5)).toBe(true);
  });
});
