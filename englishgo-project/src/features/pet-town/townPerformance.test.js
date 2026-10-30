import { describe, expect, it } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { batchTownScenery, smoothFactor } from './townPerformance.js';

describe('town render optimization', () => {
  it('batches scenery without moving it or modifying clickable/animated objects', () => {
    const root = new Group(), nested = new Group(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
    root.position.set(7,2,-3); root.rotation.y = .4; nested.position.set(2,0,1); root.add(nested);
    const first = new Mesh(geometry,material), second = new Mesh(geometry,material), interactive = new Mesh(geometry,material);
    first.position.set(1,.5,-1); second.position.set(-2,1,2); interactive.position.set(5,0,0);
    interactive.userData.placementId = 'keep-me'; nested.add(first,second); root.add(interactive);
    // Compare actual transformed vertices: rotating an aggregate AABB overestimates its bounds.
    const before = new Box3().setFromObject(root, true), original = [...geometry.attributes.position.array], registered=[];
    expect(batchTownScenery(root,new Set([interactive]),g=>registered.push(g))).toBe(1);
    const after = new Box3().setFromObject(root, true);
    expect(after.min.distanceTo(before.min)).toBeLessThan(.00001); expect(after.max.distanceTo(before.max)).toBeLessThan(.00001);
    expect(interactive.parent).toBe(root); expect(interactive.userData.placementId).toBe('keep-me');
    expect([...geometry.attributes.position.array]).toEqual(original);
    registered.forEach(g=>g.dispose()); geometry.dispose(); material.dispose();
  });
  it('preserves distinct shadow behavior instead of combining incompatible meshes', () => {
    const root=new Group(), geometry=new BoxGeometry(), material=new MeshStandardMaterial();
    const a=new Mesh(geometry,material), b=new Mesh(geometry,material); a.castShadow=true; root.add(a,b);
    expect(batchTownScenery(root,new Set(),()=>{})).toBe(0);
    expect(a.parent).toBe(root); expect(b.castShadow).toBe(false);
    geometry.dispose(); material.dispose();
  });
  it('retains mesh parents of interactive children and leaves hidden subtrees hidden', () => {
    const root = new Group(), geometry = new BoxGeometry(), material = new MeshStandardMaterial(), registered = [];
    const parent = new Mesh(geometry, material), child = new Mesh(geometry, material), hidden = new Group();
    parent.add(child); hidden.visible = false;
    hidden.add(new Mesh(geometry, material), new Mesh(geometry, material));
    root.add(parent, hidden, new Mesh(geometry, material), new Mesh(geometry, material));
    expect(batchTownScenery(root, new Set([child]), g => registered.push(g))).toBe(1);
    expect(parent.parent).toBe(root); expect(child.parent).toBe(parent);
    expect(hidden.children).toHaveLength(2); expect(hidden.visible).toBe(false);
    registered.forEach(g => g.dispose()); geometry.dispose(); material.dispose();
  });
  it('keeps camera settling consistent across 30, 60 and 120 Hz', () => {
    const positions=[30,60,120].map(fps=>{let position=0;for(let i=0;i<fps/2;i++)position+=(10-position)*smoothFactor(10,1/fps);return position;});
    expect(positions[0]).toBeCloseTo(positions[1],10); expect(positions[1]).toBeCloseTo(positions[2],10);
    expect(positions[0]).toBeGreaterThan(9.9);
  });
});
