import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { STORYBOOK_QUESTS } from './storybookQuests.js';
import { STORYBOOKS_AUDIO, bookWords } from './storybookAudio.js';

const BOOK_KEYS = { 'pip-and-the-lost-star': 'pip', 'milo-and-the-little-storm': 'milo', 'dori-and-the-echo-in-the-mist': 'dori', 'otto-and-the-lantern-boat': 'otto', 'nova-and-the-silent-lighthouse': 'nova' };
const built = id => readFileSync(path.join(process.cwd(), `public/picture-books/${id}.html`), 'utf8');
function bookScenes(id) {
  const html = built(id);
  const code = html.slice(html.indexOf('const VOCAB ='), html.indexOf('/* ================= STATE'));
  return vm.runInNewContext(`${code};({pages:PAGES,pops:POPS,quests:QUESTS,vocab:VOCAB})`, {});
}

describe('storybook "find it" challenges', () => {
  it('gives every page one labelled pop-up target with a prerecorded word', () => {
    Object.entries(STORYBOOK_QUESTS).forEach(([id, quests]) => {
      const scenes = bookScenes(id);
      const audioBook = STORYBOOKS_AUDIO.find(book => book.key === BOOK_KEYS[id]);
      const words = new Set(bookWords(audioBook));
      expect(scenes.quests).toEqual(quests);
      expect(quests).toHaveLength(scenes.pages.length);
      quests.forEach((word, page) => {
        expect(scenes.pops[scenes.pages[page].s].filter(pop => pop.tag === word), `${id} page ${page + 1}`).toHaveLength(1);
        expect(words.has(word), `${word} has word audio`).toBe(true);
      });
    });
  });

  it('serves web-sized artwork that exists for every book', () => {
    Object.keys(STORYBOOK_QUESTS).forEach(id => {
      const html = built(id);
      expect(html, id).toMatch(/\/images\/picture-books\/[^"'`]*\.webp|-paper\.webp/);
      expect(html, id).not.toMatch(/\.png["'`]/);
    });
    const art = ['fox-paper', 'tree-paper', 'basket-paper', 'owl-paper', 'house-paper', 'bush-paper', 'rock-paper', 'star-paper', 'cloud-paper',
      'milo/bridge', 'milo/castle', 'milo/fallen-blocks', 'milo/milo-angry', 'milo/milo-breathe', 'milo/milo-welcome', 'milo/ruby-ribbon',
      'dori/dori-alert', 'dori/dori-listening', 'dori/fern', 'dori/footprints', 'dori/mother', 'dori/valley',
      'otto/pond', 'otto/otto', 'otto/boat', 'otto/lantern', 'otto/duckling', 'otto/mother-duck', 'otto/frog', 'otto/fish', 'otto/reeds',
      'nova/coast', 'nova/nova', 'nova/grandpa', 'nova/lighthouse', 'nova/boat', 'nova/radio', 'nova/toolbox', 'nova/battery', 'nova/notebook'];
    art.forEach(name => {
      const file = path.join(process.cwd(), `public/images/picture-books/${name}.webp`);
      expect(existsSync(file), name).toBe(true);
      expect(statSync(file).size, name).toBeLessThan(400 * 1024);
    });
  });
});
