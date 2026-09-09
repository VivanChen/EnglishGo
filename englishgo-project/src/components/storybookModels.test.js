import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('shipped storybook animal models', () => {
  for (const animal of ['fox', 'bear', 'rabbit']) it(`${animal} is a complete local GLB with geometry and fur`, () => {
    const file=readFileSync(path.join(process.cwd(),'public','models','storybook',`${animal}.glb`));
    expect(file.readUInt32LE(0)).toBe(0x46546c67);
    expect(file.readUInt32LE(8)).toBe(file.length);
    const length=file.readUInt32LE(12),gltf=JSON.parse(file.subarray(20,20+length).toString());
    expect(gltf.asset.version).toBe('2.0');
    expect(gltf.meshes[0].primitives).toHaveLength(2);
    expect(gltf.buffers[0].uri).toBeUndefined();
    for(const primitive of gltf.meshes[0].primitives){
      const position=gltf.accessors[primitive.attributes.POSITION];
      expect(position.count).toBeGreaterThan(1000);
      expect(position.min.every(Number.isFinite)).toBe(true);
      expect(position.max[1]-position.min[1]).toBeGreaterThan(1);
      expect(gltf.accessors[primitive.attributes.NORMAL].count).toBe(position.count);
    }
    for(const view of gltf.bufferViews)expect(view.byteOffset+view.byteLength).toBeLessThanOrEqual(gltf.buffers[0].byteLength);
  });
});
