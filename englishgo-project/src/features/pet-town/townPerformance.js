import { Mesh, Matrix4 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const smoothFactor = (rate, seconds) => 1 - Math.exp(-rate * seconds);

/** Batch only static scenery. Pets, clickable furniture and animated water stay separate. */
export function batchTownScenery(root, excluded, registerGeometry) {
  root.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(root.matrixWorld).invert(), groups = new Map();
  const visit = node => {
    if (excluded.has(node) || !node.visible) return;
    if (node.isMesh && !node.children.length && !Array.isArray(node.material) && !node.geometry.morphAttributes.position) {
      const attributes = Object.keys(node.geometry.attributes).sort().map(k => `${k}:${node.geometry.attributes[k].itemSize}:${node.geometry.attributes[k].normalized}`).join(',');
      const key = `${node.material.uuid}:${node.castShadow}:${node.receiveShadow}:${!!node.geometry.index}:${attributes}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(node);
    }
    node.children.forEach(visit);
  };
  root.children.forEach(visit);
  let removed = 0;
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const copies = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)));
    const geometry = mergeGeometries(copies, false);
    copies.forEach(copy => copy.dispose());
    if (!geometry) continue;
    const combined = new Mesh(geometry, meshes[0].material);
    combined.castShadow = meshes[0].castShadow; combined.receiveShadow = meshes[0].receiveShadow;
    combined.name = 'Static town scenery'; geometry.computeBoundingSphere();
    registerGeometry(geometry); root.add(combined);
    meshes.forEach(mesh => mesh.removeFromParent()); removed += meshes.length - 1;
  }
  return removed;
}
