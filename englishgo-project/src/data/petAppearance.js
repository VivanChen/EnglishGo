// One palette and silhouette for portraits, live companions, and their fallback.
const look = (shape, coat, shade, cream, accent, features = {}) => ({ shape, coat, shade, cream, accent, ...features });
export const PET_GROWTH_STAGES = [
  { id: 'baby', name: '幼寵', level: 1, detail: '小小的初次相遇' },
  { id: 'adult', name: '成寵', level: 4, detail: '戴上專屬小領巾' },
  { id: 'evolved', name: '進化形態', level: 10, detail: '金色領巾與星星徽章' },
];

export function getPetStage(pet) {
  return pet?.level >= 10 ? 'evolved' : pet?.level >= 4 ? 'adult' : 'baby';
}

export const PET_APPEARANCES = {
  bunny: look('rabbit', '#f5e9dc', '#ddc4ad', '#fff6e9', '#dca7a2'),
  chick: look('bird', '#f5d575', '#dca24e', '#fff0bd', '#dc9858', { tuft: true }),
  puppy: look('dog', '#d7ac80', '#946849', '#fae9cc', '#9ebfaa'),
  kitty: look('cat', '#e7be94', '#b38160', '#fff0da', '#c395af', { stripes: true }),
  piggy: look('pig', '#edbdc1', '#cc909f', '#fce0db', '#a6bea0'),
  froggy: look('frog', '#a8c99a', '#719d7c', '#e2e9ba', '#e3b58c'),
  hamster: look('round', '#dbad79', '#b48761', '#fff0d7', '#bb9dbe', { cheekPatches: true }),
  turtle: look('turtle', '#9dba87', '#637e60', '#e7dca8', '#bd996b', { shell: true }),
  duckling: look('bird', '#f0dc91', '#dcb36a', '#fff1c9', '#dd9a54', { bill: true }),
  lamb: look('sheep', '#eee8dd', '#c9baaa', '#fff8ec', '#aaa4c7', { wool: true }),
  panda: look('round', '#f2eadc', '#525961', '#fff8eb', '#92b29b', { patches: true }),
  koala: look('round', '#b3c3c5', '#7b969e', '#edf0e5', '#dab495', { bigEars: true, bigNose: true }),
  fox: look('fox', '#dba073', '#b97a58', '#fff0d8', '#9eb7a2', { fluffyTail: true }),
  owl: look('bird', '#b49e8e', '#88746d', '#f9e8ce', '#c9ab7b', { faceDisk: true }),
  penguin: look('bird', '#647b8d', '#435b70', '#f6eee0', '#d8a26a', { bib: true }),
  deer: look('deer', '#cfa882', '#a57a57', '#f5e5c9', '#b3bc9a', { antlers: true, spots: true }),
  seal: look('seal', '#cbd7d6', '#99b3ba', '#f8f5e8', '#d2afa4'),
  parrot: look('bird', '#9fbea2', '#5f958b', '#f1d695', '#deaa87', { crest: true, wingTips: true }),
  squirrel: look('round', '#c59d7d', '#9e705b', '#f9e6c9', '#c0b27d', { fluffyTail: true, cheekPatches: true }),
  unicorn: look('horse', '#eee3ec', '#b4a0c5', '#fff4e8', '#d8b878', { horn: true, mane: true }),
  dragon: look('dragon', '#a9c4bb', '#739d96', '#f4e2bc', '#cead80', { wings: true, horns: true, spikes: true }),
  whale: look('whale', '#9dbdce', '#698eaf', '#e6f0ee', '#b5a4ca'),
  pegasus: look('horse', '#e9e7df', '#b3c6cc', '#fff8ed', '#d3be85', { wings: true, mane: true }),
  griffin: look('bird', '#dbbb87', '#a38166', '#fff0cf', '#bd9bb7', { wings: true, crest: true, lionTail: true }),
  seaotter: look('round', '#bda28a', '#8f7565', '#f9e8d0', '#a5c6bf', { shellToy: true }),
  phoenix: look('bird', '#e3ad8c', '#c67e73', '#ffe3b5', '#dfbe79', { wings: true, crest: true, flameTail: true }),
  celestial: look('cat', '#d5cde5', '#a69abd', '#fff1db', '#dec17d', { horns: true, wings: true, star: true }),
  moonlion: look('lion', '#d3c7db', '#9c98bb', '#fff0dc', '#d6bd84', { mane: true, lionTail: true, moon: true }),
  aurorafox: look('fox', '#bed8d2', '#90a8c6', '#f8f0e6', '#b4a1c9', { fluffyTail: true, star: true }),
};

export function getPetAppearance(id) {
  return PET_APPEARANCES[({ cat: 'kitty', frog: 'froggy' })[id] || id] || PET_APPEARANCES.bunny;
}
