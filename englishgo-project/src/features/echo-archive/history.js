// Run chronicle: a compact record of each finished or abandoned run, kept in
// the meta save so the title screen can show recent expeditions.
export const HISTORY_LIMIT = 20;

export const runKey = run => `${run.seed}-${run.startedAt || 0}`;

export function runRecord(run, outcome, shards = 0, now = Date.now()) {
  const c = run.combat;
  const foes = outcome !== 'victory' && c ? [...new Set(c.enemies.filter(enemy => !enemy.dead).map(enemy => enemy.id))] : [];
  const counts = new Map();
  run.hero.deck.forEach(card => {
    const key = `${card.id}${card.up ? '+' : ''}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const s = run.stats;
  return {
    key: runKey(run), at: now, outcome,
    hero: run.hero.id || 'scribe', trueEnding: Boolean(run.trueEnding),
    difficulty: run.difficulty, silence: run.silence || 0, trials: run.trials || [],
    daily: run.daily ? { date: run.daily.date, blessing: run.daily.blessing, trial: run.daily.trial } : null,
    act: run.act, zone: run.zone || null, floor: run.floor, hp: Math.max(0, run.hero.hp), maxHp: run.hero.maxHp,
    foes, foeKind: foes.length ? c.kind : null,
    deck: [...counts], relics: [...run.hero.relics],
    kills: s.kills, damage: s.damage, cards: s.cards, chants: s.chants, chantsOk: s.chantsOk, shards,
    minutes: run.startedAt ? Math.max(1, Math.round((now - run.startedAt) / 60000)) : null,
  };
}

export function addRecord(history, record) {
  const list = Array.isArray(history) ? history : [];
  return [record, ...list.filter(item => item.key !== record.key)].slice(0, HISTORY_LIMIT);
}

// Deck entries are stored as ["slash+", 2]; rebuild card instances for the
// deck viewer.
export function recordDeck(record) {
  const cards = [];
  record.deck.forEach(([key, count]) => {
    const up = key.endsWith('+');
    const id = up ? key.slice(0, -1) : key;
    for (let i = 0; i < count; i++) cards.push({ uid: `${key}-${i}`, id, up });
  });
  return cards;
}
