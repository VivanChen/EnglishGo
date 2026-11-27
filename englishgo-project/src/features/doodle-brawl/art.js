// Sprite paths. Every picture is a transparent WebP generated for this game
// (see scripts/generateDoodleBrawlArt.py); the arena falls back to simple
// shapes and the menus to a letter tile while one is still loading.
export const ART_ROOT = '/images/doodle-brawl';

export const heroArt = id => `${ART_ROOT}/heroes/${id}.webp`;
export const weaponArt = id => `${ART_ROOT}/weapons/${id}.webp`;
export const itemArt = id => `${ART_ROOT}/items/${id}.webp`;
export const enemyArt = id => `${ART_ROOT}/enemies/${id}.webp`;
export const pickupArt = id => `${ART_ROOT}/pickups/${id}.webp`;
export const TITLE_ART = `${ART_ROOT}/title.webp`;

const cache = new Map();

// Returns { img, white } once the image has decoded, otherwise null (and
// starts loading it).
export function loadSprite(src) {
  if (typeof Image === 'undefined') return null;
  let entry = cache.get(src);
  if (!entry) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    entry = { img, white: null };
    cache.set(src, entry);
  }
  return entry.img.complete && entry.img.naturalWidth > 0 ? entry : null;
}

// A white silhouette of a sprite, drawn over it for the hit flash.
export function whiteSprite(entry) {
  if (!entry.white && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = entry.img.naturalWidth;
    canvas.height = entry.img.naturalHeight;
    const g = canvas.getContext('2d');
    if (!g) return null;
    g.drawImage(entry.img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    entry.white = canvas;
  }
  return entry.white;
}
