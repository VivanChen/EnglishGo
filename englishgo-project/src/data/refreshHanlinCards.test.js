import { expect, it } from 'vitest';
import { refreshHanlinCards } from './refreshHanlinCards.js';
import { getHereWeGoCards, hereWeGoSelectionId } from './hanlinHereWeGoWords.js';
import { getHoorayCards } from './hanlinHoorayWords.js';

it('refreshes old Hanlin art and its paired example while preserving saved order and extra review fields', () => {
  for (const [topic, current] of [
    [hereWeGoSelectionId('hanlin-here-we-go-4', 'names', 'Eve'), getHereWeGoCards('hanlin-here-we-go-4').filter(c => c.w === 'Eve')],
    ['hanlin-hooray-am', getHoorayCards('hanlin-hooray-am').slice(0, 2).reverse()],
  ]) {
    const saved = current.map(c => ({ ...c, img: '/old.svg', ex: 'Old sentence.', illustration: { image_url: '/old.svg' }, reviewCount: 3 }));
    const refreshed = refreshHanlinCards(saved, topic);
    expect(refreshed.map(c => c.w)).toEqual(saved.map(c => c.w));
    refreshed.forEach((c, i) => {
      expect(c.img).toBe(current[i].img);
      expect(c.illustration).toEqual(current[i].illustration);
      expect(c.ex).toBe(current[i].ex);
      expect(c.reviewCount).toBe(3);
    });
    expect(saved[0].img).toBe('/old.svg');
    expect(refreshHanlinCards(saved, 'direct')).toBe(saved);
  }
});
