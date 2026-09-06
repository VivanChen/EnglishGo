export const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
export function localDay(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dailyProgress(daily) {
  const target = Math.max(1, nonnegative(daily?.target) || 10);
  const done = Math.min(nonnegative(daily?.done), target);
  return { date: daily?.date || '', done, target, percent: Math.round(done / target * 100) };
}
export function archiveStudyDay(history = [], daily) {
  const byDay = new Map();
  for (const entry of [...(Array.isArray(history) ? history : []), daily]) {
    const key = localDay(entry?.date);
    if (!key) continue;
    const normalized = dailyProgress(entry), old = byDay.get(key);
    if (!old || normalized.done >= old.done) byDay.set(key, normalized);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-60).map(([, entry]) => entry);
}
export function learningStreak(streak, daily, now = new Date()) {
  if (localDay(daily?.date) !== localDay(now)) return 0;
  return dailyProgress(daily).done > 0 ? Math.max(1, nonnegative(streak)) : Math.max(0, nonnegative(streak) - 1);
}
export function studyWeek(history, daily, now = new Date()) {
  const byDay = new Map(archiveStudyDay(history, daily).map(entry => [localDay(entry.date), entry]));
  if (localDay(daily?.date) === localDay(now)) byDay.set(localDay(now), dailyProgress(daily));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - 6 + index);
    const key = localDay(date), record = byDay.get(key), done = record?.done || 0;
    return { key, label: `${date.getMonth() + 1}/${date.getDate()}`, weekday: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()], today: key === localDay(now), done, target: record?.target || 10 };
  });
}
export function achievementProgress(definitions, unlocked, values) {
  const earned = new Set(Array.isArray(unlocked) ? unlocked : []);
  return definitions.map(definition => {
    const current = nonnegative(values?.[definition.metric]), target = Math.max(1, definition.target);
    return { ...definition, current, target, earned: earned.has(definition.id), remaining: Math.max(0, target - current), percent: Math.min(100, Math.round(current / target * 100)) };
  });
}
export function nextAchievement(rows) {
  return rows.filter(row => !row.earned).sort((a, b) => b.percent - a.percent)[0] || null;
}
