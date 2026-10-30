import catalog from './wordIllustrations.json';
import { getCuratedVocabularyExample } from './curatedVocabularyExamples.js';

export const ILLUSTRATION_STYLE = 'watercolor-pencil-v1';
export const normalizeIllustrationWord = word => String(word || '').trim().toLowerCase();
const BUNDLED_LOCAL_PATHS = new Set(catalog.map(row=>row.local_path).filter(Boolean));

function withCuratedExample(row) {
  const example=getCuratedVocabularyExample(row.level,row.word);
  return example ? {...row,example:example.ex,example_zh:example.ez,sense:example.m||row.sense} : row;
}

export function getLocalWordIllustrations(level, word) {
  const key = normalizeIllustrationWord(word);
  return catalog.filter(row => row.level === level && row.word === key)
    .sort((a, b) => a.sort_order - b.sort_order).map(withCuratedExample);
}

// Only image URLs belonging to an explicit illustration record are used on the back.
// The front's Giphy/static-image search never supplies a back illustration.
export function normalizeWordIllustrations(rows, level, word) {
  if (!Array.isArray(rows)) return [];
  const key = normalizeIllustrationWord(word);
  const safeImage = src => typeof src === 'string' && (/^\/images\/vocabulary\//.test(src) || /^https:\/\//.test(src));
  return rows.filter(row => row.level === level && normalizeIllustrationWord(row.word) === key
    && safeImage(row.image_url) && row.alt_zh && row.example && row.example_zh)
    .map(row => withCuratedExample({ ...row, local_path: safeImage(row.local_path) && BUNDLED_LOCAL_PATHS.has(row.local_path) ? row.local_path : '' }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function loadWordIllustrations(supabase, level, word) {
  const local = getLocalWordIllustrations(level, word);
  if (!supabase) return local;
  try {
    const { data, error } = await supabase.from('word_illustrations')
      .select('id,level,word,sense,image_url,local_path,alt_zh,example,example_zh,sort_order,style,version')
      .eq('level', level).eq('word', normalizeIllustrationWord(word)).order('sort_order');
    const cloud = error ? [] : normalizeWordIllustrations(data, level, word);
    return cloud.length ? cloud : local;
  } catch {
    return local;
  }
}
