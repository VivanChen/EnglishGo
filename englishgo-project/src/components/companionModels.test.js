import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { PET_APPEARANCES } from '../data/petAppearance.js';
import { createCompanionModel, fitCompanionCamera } from './companionModels.js';

describe('companion silhouettes and care targets', () => {
  it.each(Object.keys(PET_APPEARANCES).flatMap(id => ['baby', 'adult', 'evolved'].map(stage => [id, stage])))('%s %s stays in frame during rotation on narrow and wide stages', (id, stage) => {
    const model = createCompanionModel(id, stage);
    try {
      for (const aspect of [.45, .7, 1.5, 3.5]) {
        const { target, distance } = fitCompanionCamera(model.bounds, aspect);
        const camera = new T.PerspectiveCamera(31, aspect, .1, 30);
        camera.position.set(0, target.y + distance * .085, distance);
        camera.lookAt(0, target.y, 0); camera.updateMatrixWorld();
        for (const angle of [0, .18, Math.PI / 4, Math.PI / 2, Math.PI]) {
          model.root.rotation.y = angle; model.root.updateMatrixWorld(true);
          const bounds = new T.Box3().setFromObject(model.root);
          for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
            const point = new T.Vector3(x, y, z).project(camera);
            expect(Math.abs(point.x), `${id}: horizontal crop at ${aspect}/${angle}`).toBeLessThan(1);
            expect(Math.abs(point.y), `${id}: vertical crop at ${aspect}/${angle}`).toBeLessThan(1);
            expect(point.z).toBeGreaterThan(-1); expect(point.z).toBeLessThan(1);
          }
        }
        model.root.rotation.y = .18; model.head.rotation.z = .07; model.root.updateMatrixWorld(true);
        const mouth = model.mouth.getWorldPosition(new T.Vector3()).project(camera);
        expect(Math.abs(mouth.x)).toBeLessThan(.8);
        expect(Math.abs(mouth.y)).toBeLessThan(.8);
        expect(mouth.z).toBeGreaterThan(-1); expect(mouth.z).toBeLessThan(1);
      }
    } finally { model.dispose(); }
  });

  it('restores open eyes after affectionate and sleeping expressions, including reduced motion', () => {
    const model = createCompanionModel('bunny', 'evolved');
    try {
      model.setExpression({ happy: true });
      expect(model.eyes.every(eye => !eye.visible)).toBe(true);
      model.setExpression({ sleeping: true });
      expect(model.eyes.every(eye => !eye.visible)).toBe(true);
      model.setExpression({ blink: .15 });
      expect(model.eyes.every(eye => eye.visible && eye.scale.y === .15)).toBe(true);
      model.setExpression();
      expect(model.eyes.every(eye => eye.visible && eye.scale.y === 1)).toBe(true);
    } finally { model.dispose(); }
  });

  it('releases every shared geometry and material once when switching companions', () => {
    const model = createCompanionModel('celestial', 'evolved'), resources = new Set();
    model.root.traverse(node => {
      if (node.geometry) resources.add(node.geometry);
      if (node.material) resources.add(node.material);
    });
    const listeners = [...resources].map(resource => {
      const listener = vi.fn(); resource.addEventListener('dispose', listener); return listener;
    });
    model.dispose();
    for (const listener of listeners) expect(listener).toHaveBeenCalledOnce();
  });
});
