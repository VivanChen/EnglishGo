// Try the requested spelling across all pools before considering inflected forms.
export function findVocabularyWord(built, extra, levels, candidates) {
  for (const candidate of candidates) {
    for (const level of levels) {
      for (const [pool, source] of [[built, '本地單字卡'], [extra, '補充重點單字']]) {
        const hit = (pool[level] || []).find(card => String(card.w).toLowerCase() === candidate);
        if (hit) return { ...hit, level, source };
      }
    }
  }
  return null;
}
