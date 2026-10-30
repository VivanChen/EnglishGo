// This release starts a new progression once, without archiving old saves.
// Shared by the client and the server boundary so stale clients cannot restore it.
export const PROGRESS_VERSION = 'seabreeze-20261030';
export const PROGRESS_VERSION_KEY = 'eg_progress_version';
const PREFERENCES = new Set([
  PROGRESS_VERSION_KEY, 'eg_petAcc', 'eg_dark', 'eg_calm', 'eg_quiet',
  'eg_gemkey', 'eg_gifkey', 'eg_voice', 'eg_gemini_model', 'eg_lastLevel',
  'eg_installDismissed', 'eg_novelReadingPrefs', 'eg_readingLargeText',
]);
const isProgress = key => key.startsWith('eg_') && !PREFERENCES.has(key)
  && !['eg_tts_', 'eg_openai_', 'eg_elevenlabs_'].some(prefix => key.startsWith(prefix));

export function resetProgressOnce(storage, session = null, history = null) {
  if (storage.getItem(PROGRESS_VERSION_KEY) === PROGRESS_VERSION) return false;
  for (const target of [storage, session].filter(Boolean)) {
    // Snapshot the keys before removal so adjacent entries cannot be skipped.
    const keys = Array.from({ length: target.length }, (_, i) => target.key(i));
    for (const key of keys) if (key && isProgress(key)) target.removeItem(key);
  }
  if (history?.state?.englishGoNavigation) {
    const { lv, mod, menuGroup } = history.state.englishGoNavigation;
    history.replaceState({ ...history.state, englishGoNavigation: { lv, mod, menuGroup, depth: 0 } }, '');
  }
  // Mark only after all removals succeeded. Subsequent launches keep new progress.
  storage.setItem(PROGRESS_VERSION_KEY, PROGRESS_VERSION);
  return true;
}
