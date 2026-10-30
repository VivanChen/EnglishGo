import { describe, expect, it } from 'vitest';
import { findTownPath } from './townNavigation.js';

const catalog = [{ id: 'bench', kind: 'bench', size: { x: 1.6, z: .7 } }, { id: 'rug', kind: 'rug', size: { x: 1, z: 1 } }];
describe('garden walking routes', () => {
  it('walks around furniture instead of through it', () => {
    const path = findTownPath({ x: -2, z: 1 }, { x: 2, z: 1 }, [{ id: 'b', itemId: 'bench', x: 0, z: 1, rotation: 0 }], catalog);
    expect(path.length).toBeGreaterThan(2);
    expect(path.some(p => Math.abs(p.z - 1) >= .57)).toBe(true);
    expect(path.at(-1).x).toBeCloseTo(2.1);
  });
  it('does not send a pet into a blocked target', () => {
    expect(findTownPath({ x: -2, z: 1 }, { x: 0, z: 1 }, [{ id: 'b', itemId: 'bench', x: 0, z: 1 }], catalog)).toEqual([]);
  });
  it('allows walking across a rug', () => {
    const path = findTownPath({ x: -2, z: 1 }, { x: 0, z: 1 }, [{ id: 'r', itemId: 'rug', x: 0, z: 1 }], catalog);
    expect(path.length).toBeGreaterThan(0);
  });
});
