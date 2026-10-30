import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createTownCompanion, TOWN_SPECIES, TOWN_ANIMATIONS, MODEL_REVISION } from '../src/features/pet-town/townModels.js';

// GLTFExporter uses this browser primitive only to turn its binary Blob into data.
globalThis.FileReader = class FileReader {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};
const output = new URL('../public/models/pet-town/', import.meta.url);
await mkdir(output, { recursive: true });
const manifest = { revision: MODEL_REVISION, license: 'Original EnglishGo assets; no third-party model or texture', animationNames: TOWN_ANIMATIONS, models: [] };
for (const speciesId of TOWN_SPECIES) {
  const { root, animations } = createTownCompanion(speciesId);
  const binary = await new GLTFExporter().parseAsync(root, { binary: true, animations, onlyVisible: false, maxTextureSize: 1024 });
  await writeFile(new URL(`${speciesId}.glb`, output), Buffer.from(binary));
  manifest.models.push({ speciesId, file: `${speciesId}.glb`, bytes: binary.byteLength, animations: animations.length });
  const geometries = new Set(), materials = new Set();
  root.traverse(n => { if (n.geometry) geometries.add(n.geometry); if (n.material) materials.add(n.material); });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  console.log(`${speciesId}: ${(binary.byteLength / 1024).toFixed(0)} KiB, ${animations.length} animation clips`);
}
await writeFile(new URL('manifest.json', output), JSON.stringify(manifest, null, 2) + '\n');
