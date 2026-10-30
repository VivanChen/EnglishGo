import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTownCompanion, applyGrowthAppearance, TOWN_SPECIES, TOWN_ANIMATIONS } from './townModels.js';

function readGlb(id) {
  const file = readFileSync(resolve(process.cwd(), `public/models/pet-town/${id}.glb`));
  expect(file.readUInt32LE(0)).toBe(0x46546c67);
  expect(file.readUInt32LE(4)).toBe(2);
  expect(file.readUInt32LE(8)).toBe(file.byteLength);
  return JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString('utf8'));
}

describe('original seaside companions', () => {
  it.each(TOWN_SPECIES)('%s ships complete, articulated animation assets', id => {
    const gltf = readGlb(id);
    expect(gltf.animations.map(a => a.name).sort()).toEqual([...TOWN_ANIMATIONS].sort());
    expect(gltf.nodes.map(n => n.name)).toEqual(expect.arrayContaining(['Head', 'Neck', 'EarL', 'EarR', 'FrontL', 'FrontR', 'BackL', 'BackR', 'Tail']));
    for (const clip of gltf.animations) {
      expect(clip.channels.length).toBeGreaterThan(0);
      for (const channel of clip.channels) {
        expect(gltf.nodes[channel.target.node]).toBeTruthy();
        expect(['rotation', 'translation', 'scale']).toContain(channel.target.path);
        const sampler = clip.samplers[channel.sampler];
        expect(gltf.accessors[sampler.input].count).toBeGreaterThanOrEqual(2);
        expect(gltf.accessors[sampler.output].count).toBe(gltf.accessors[sampler.input].count);
      }
    }
    // Assets remain small enough to lazy-load the three actors on a phone.
    expect(gltf.buffers[0].byteLength).toBeLessThan(1_500_000);
  });

  it('rabbit and cat have different gaits, silhouettes and facial features', () => {
    const rabbit = createTownCompanion('garden-rabbit'), cat = createTownCompanion('harbor-cat'), dog = createTownCompanion('sunny-dog');
    const walk = model => model.animations.find(a => a.name === 'walk');
    expect(walk(rabbit).duration).not.toBe(walk(cat).duration);
    expect([...walk(rabbit).tracks[1].values]).not.toEqual([...walk(cat).tracks[1].values]);
    expect(cat.root.getObjectByName('Whisker')).toBeTruthy();
    expect(dog.root.getObjectByName('Forehead blaze')).toBeTruthy();
    expect(rabbit.root.getObjectByName('Cotton tail')).toBeTruthy();
    expect(dog.root.getObjectByName('EarL').rotation.x).toBeCloseTo(Math.PI);
    for (const model of [rabbit, cat, dog]) model.root.traverse(n => { n.geometry?.dispose(); n.material?.dispose(); });
  });

  it('growth changes proportions and accessories at the same progression thresholds', () => {
    const { root } = createTownCompanion('harbor-cat');
    expect(applyGrowthAppearance(root, 0)).toBe('baby');
    const babyHead = root.getObjectByName('Head').scale.x, babyBody = root.getObjectByName('Torso').scale.y;
    expect(root.getObjectByName('Scarf').visible).toBe(false);
    expect(applyGrowthAppearance(root, 120)).toBe('growing');
    expect(root.getObjectByName('Scarf').visible).toBe(true);
    expect(applyGrowthAppearance(root, 300)).toBe('mature');
    expect(root.getObjectByName('Head').scale.x).toBeLessThan(babyHead);
    expect(root.getObjectByName('Torso').scale.y).toBeGreaterThan(babyBody);
    root.traverse(n => { n.geometry?.dispose(); n.material?.dispose(); });
  });
});
