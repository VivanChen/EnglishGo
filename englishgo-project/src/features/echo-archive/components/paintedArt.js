// Painted sprites for Echo Archive. Each file is a 512×512 WebP with a
// transparent background, the figure standing on the bottom edge like the SVG
// drawings do (small foes leave more empty space, bosses fill the square).
// A creature or hero not listed here keeps its hand-drawn SVG, which is also
// the fallback if an image fails to load.
const ROOT = '/images/echo-archive';

export const PAINTED_CREATURES = new Set([
  // Act I
  'inkling', 'moth', 'wisp', 'worm', 'knight', 'librarian', 'tome', 'imp', 'serpent', 'spider', 'tentacle', 'kraken',
  // Act II
  'rat', 'sentinel', 'pendulum', 'mite', 'golem', 'gear', 'clock', 'jack', 'slick', 'duelist', 'twinTick', 'twinTock',
  // Act III
  'wraith', 'shade', 'gargoyle', 'oracle', 'silentKnight', 'unspoken', 'bell', 'scribe', 'choir', 'thief',
  // Act IV
  'gate', 'silence',
]);
export const PAINTED_HEROES = new Set(['scribe', 'caller']);

// Rare and mythic cards carry a painted illustration in the art window; other
// cards keep their glyph, which also shows until a painting has loaded.
export const PAINTED_CARDS = new Set([
  // Rare
  'finale', 'devour', 'storm', 'sanctum', 'wildfire', 'clarity', 'ascend', 'scholar', 'ironWill', 'mirrorImage',
  'runeStorm', 'quillDance', 'wordflood', 'palimpsest', 'legion', 'unboundSpirit', 'inkStorm', 'lastLight', 'twinSpirit',
  'finalFold', 'eternalFlame', 'epic', 'mountainCleaver', 'flashpoint', 'mirrorWall', 'finisher', 'eloquence', 'blackout',
  'origamiWorkshop', 'spiritSurge',
  // Mythic
  'sunfall', 'aegis', 'thousandCuts', 'archmage', 'livingInk', 'grandLibrary', 'inkSovereign', 'thousandCranes',
  'afterimage', 'swordSaint', 'hellfire', 'colossus', 'perpetualMotion', 'runeChoir', 'abyssalInk', 'paperDragon', 'eternalSpirit',
]);

export const cardImage = id => (PAINTED_CARDS.has(id) ? `${ROOT}/cards/${id}.webp` : null);
export const creatureImage = art => (PAINTED_CREATURES.has(art) ? `${ROOT}/creatures/${art}.webp` : null);
export const heroImage = hero => (PAINTED_HEROES.has(hero) ? `${ROOT}/heroes/${hero}.webp` : null);
export const FAMILIAR_IMAGE = `${ROOT}/heroes/familiar.webp`;

// Warm the browser cache so a creature never pops in blank on its first fight.
const warmed = new Set();
export function preloadImages(srcs) {
  if (typeof Image === 'undefined') return;
  srcs.filter(Boolean).forEach(src => {
    if (warmed.has(src)) return;
    warmed.add(src);
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  });
}

// Every creature an act can show: its encounters, bosses and their summons.
export function actCreatureImages(act, ENCOUNTERS, ENEMIES) {
  const table = ENCOUNTERS[act] || {};
  const ids = new Set([...(table.easy || []), ...(table.normal || []), ...(table.elite || []), ...(table.bosses || [])].flat());
  [...ids].forEach(id => Object.values(ENEMIES[id]?.moves || {}).forEach(move => (move.summon || []).forEach(item => ids.add(item.id))));
  return [...ids].map(id => creatureImage(ENEMIES[id]?.art));
}
