const normalizeEnglish = (text, splitHyphens = false) => String(text || '').toLowerCase()
  .replace(/[’‘']/g, '').replace(/[-‐‑–]/g, splitHyphens ? ' ' : '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const IRREGULAR_FORMS = {
  be: ['am', 'is', 'are', 'was', 'were', 'been'], go: ['went', 'gone'],
  run: ['ran'], eat: ['ate', 'eaten'], see: ['saw', 'seen'], take: ['took', 'taken'],
  make: ['made'], have: ['has', 'had'], buy: ['bought'], bring: ['brought'],
  write: ['wrote', 'written'], speak: ['spoke', 'spoken'], child: ['children'],
  foot: ['feet'], tooth: ['teeth'], mouse: ['mice'], person: ['people'],
  arise: ['arose', 'arisen'], blow: ['blew', 'blown'], steal: ['stole', 'stolen'],
};

export function isPlaceholderExample(example, word) {
  if (typeof example !== 'string' || typeof word !== 'string') return true;
  const text = example.trim(), headword = normalizeEnglish(word), sentence = normalizeEnglish(text);
  if (!headword || text.length < 8 || /^(?:example\s*[:\-]|\(example\))/i.test(text)
    || sentence.split(' ').length < 3) return true;
  const forms = new Set([headword, `${headword}s`, `${headword}es`, `${headword}ed`, `${headword}ing`, `${headword}ly`, `${headword}er`, `${headword}est`, ...(IRREGULAR_FORMS[headword] || [])]);
  if (headword.endsWith('y')) for (const suffix of ['ies', 'ied', 'ier', 'iest']) forms.add(`${headword.slice(0, -1)}${suffix}`);
  if (headword.endsWith('e')) {
    for (const suffix of ['d', 'r', 'st']) forms.add(`${headword}${suffix}`);
    forms.add(`${headword.slice(0, -1)}ing`);
  }
  if (/[aeiou][b-df-hj-np-tv-z]$/.test(headword)) {
    forms.add(`${headword}${headword.at(-1)}ed`); forms.add(`${headword}${headword.at(-1)}ing`);
  }
  if (![...forms].some(form => [sentence, normalizeEnglish(text, true)].some(candidate => ` ${candidate} `.includes(` ${form} `)))) return true;
  return [/^(this|that)\s+is\s+\w+\.?$/i, /^\w+\s+is\s+(good|nice|great|bad)\.?$/i, /^see\s+\w+\.?$/i, /^the\s+\w+\.?$/i].some(pattern => pattern.test(text));
}

export function normalizeCardExample(value, word) {
  if (!value || typeof value.en !== 'string' || typeof value.zh !== 'string'
    || isPlaceholderExample(value.en, word) || !/[\u3400-\u9fff]/.test(value.zh)) return null;
  return { en: value.en.trim(), zh: value.zh.trim() };
}

// Read quoted commas, escaped quotes, CRLF and multiline fields before mapping columns.
export function parseVocabularyCSV(text) {
  const rows = []; let row = [], field = '', quoted = false;
  const input = String(text || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
      row.push(field.trim()); field = '';
      if (char !== ',') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (char === '\r' && input[index + 1] === '\n') index++;
      }
    } else field += char;
  }
  if (quoted) return [];
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return [];
  const aliases = {
    w: ['word', 'w', 'english', '單字', '英文'], m: ['meaning', 'm', 'chinese', '中文', '意思', '中文意思', '釋義'],
    p: ['pos', 'p', 'part of speech', '詞性'], ph: ['phonetic', 'ph', '音標'],
    ex: ['example', 'ex', 'english example', '例句', '英文例句'], ez: ['example_zh', 'ez', 'translation', '中文例句', '例句翻譯'],
  };
  const header = rows[0].map(value => value.toLowerCase());
  const columns = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, header.findIndex(value => names.includes(value))]));
  const hasHeader = columns.w >= 0 && columns.m >= 0;
  const seen = new Set();
  return rows.slice(hasHeader ? 1 : 0).map(fields => {
    const get = (key, fallback) => fields[hasHeader ? columns[key] : fallback] || '';
    const w = get('w', 0), rawMeaning = get('m', 1), key = w.toLowerCase();
    if (!/[a-z]/i.test(w) || !rawMeaning || seen.has(key)) return null;
    seen.add(key);
    const embeddedPos = rawMeaning.match(/^\(([a-z.\/ ]+)\)\s*([\s\S]+)$/i);
    return { w, m: embeddedPos?.[2]?.trim() || rawMeaning, p: get('p', 2) || embeddedPos?.[1] || '',
      ph: get('ph', 5), ex: get('ex', 3), ez: get('ez', 4), f: [], c: [] };
  }).filter(Boolean);
}
