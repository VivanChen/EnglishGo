export const GEMINI_MODEL_KEY = 'eg_gemini_model';
export const GEMINI_MODEL_OPTIONS = [
  { value: 'auto', label: '自動（依功能選擇）' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite（例句、翻譯）' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash（家教、故事）' },
];

export function getGeminiModelPreference() {
  try {
    const value = localStorage.getItem(GEMINI_MODEL_KEY);
    return GEMINI_MODEL_OPTIONS.some(option => option.value === value) ? value : 'auto';
  } catch { return 'auto'; }
}

export function saveGeminiModelPreference(value) {
  if (!GEMINI_MODEL_OPTIONS.some(option => option.value === value)) return false;
  try { localStorage.setItem(GEMINI_MODEL_KEY, value); return true; }
  catch { return false; }
}

export function getGeminiModels(preferFlash = false) {
  const selected = getGeminiModelPreference();
  if (selected !== 'auto') return [selected];
  return preferFlash
    ? ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
    : ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
}
