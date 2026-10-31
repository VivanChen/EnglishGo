import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import hereWeGo from './hanlinHereWeGoWords.json';
import hooray from './hanlinHoorayWords.json';
import { getHereWeGoCards } from './hanlinHereWeGoWords.js';

describe('Hanlin watercolor artwork', () => {
  it('ships a real local watercolor image with a paired description for every sense', () => {
    const cards = [...hereWeGo, ...hooray, getHereWeGoCards('hanlin-here-we-go-6').find(c => c.w === 'cold')];
    const images = new Map();
    for (const card of cards) {
      expect(card.imageStyle, card.w).toBe('watercolor-pencil-v1');
      expect(card.imageAlt, card.w).toMatch(/[\u3400-\u9fff]/);
      expect(card.img, card.w).toMatch(/^\/images\/vocabulary\/hanlin-watercolor\/[a-z0-9-]+\.webp$/);
      if (!images.has(card.img)) images.set(card.img, readFileSync(`public${card.img}`));
    }
    expect(images.size).toBe(516);
    for (const [path, bytes] of images) {
      expect(bytes.toString('ascii', 0, 4), path).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 12), path).toBe('WEBP');
      expect(bytes.length, path).toBeGreaterThan(10000);
    }
  });

  it('gives all 15 personal names distinct illustrated scenarios rather than a shared avatar', () => {
    const names = hereWeGo.filter(c => c.m.includes('人名'));
    expect(names).toHaveLength(15);
    expect(new Set(names.map(c => c.ex.replace(c.w, '<name>'))).size).toBe(15);
    expect(new Set(names.map(c => createHash('sha256').update(readFileSync(`public${c.img}`)).digest('hex'))).size).toBe(15);
    expect(names.find(c => c.w === 'Eve').ex).toBe('Eve waters the flowers by the window.');
    expect(names.every(c => !c.img.endsWith('.svg'))).toBe(true);
  });
});
