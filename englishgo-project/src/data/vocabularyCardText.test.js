import { describe, expect, it } from 'vitest';
import { isPlaceholderExample, normalizeCardExample, parseVocabularyCSV } from './vocabularyCardText.js';

describe('vocabulary card text quality', () => {
  it.each([
    ['carry', 'He carries a heavy bag to school.'],
    ['cry', 'The baby cries when he is hungry.'],
    ['fry', 'We fried the egg on low heat.'],
    ['strawberry', 'We pick strawberries on the class trip.'],
    ['tshirt', 'My T-shirt has a green turtle on it.'],
    ["jack-o'-lantern", 'We put a candle inside a jack-o’-lantern.'],
    ['run', 'She ran to school this morning.'],
  ])('keeps the natural %s example without requiring AI', (word, example) => {
    expect(isPlaceholderExample(example, word)).toBe(false);
  });

  it('rejects placeholders, unrelated sentences and malformed or untranslated cache entries', () => {
    expect(isPlaceholderExample('Example: lantern.', 'lantern')).toBe(true);
    expect(isPlaceholderExample('We went to a party.', 'art')).toBe(true);
    for (const item of [null, 'broken', {en: []}, {en: 'We carry a lantern at night.', zh: 'A lantern.'}, {en: 'My dog likes running.', zh: '我的狗喜歡跑步。'}]) {
      expect(normalizeCardExample(item, 'lantern')).toBeNull();
    }
    expect(normalizeCardExample({en: ' We carry a lantern at night. ', zh: ' 我們在夜裡提著燈籠。 '}, 'lantern'))
      .toEqual({en: 'We carry a lantern at night.', zh: '我們在夜裡提著燈籠。'});
  });
});

describe('vocabulary CSV import', () => {
  it('reads a BOM, reordered bilingual headers, commas, escaped quotes and multiline examples', () => {
    const csv = '\uFEFF中文意思,單字,詞性,英文例句,例句翻譯,音標\r\n"蘋果,一種水果",apple,n.,"I say ""apple""\nand smile.","我說蘋果，並微笑。",/æpəl/';
    expect(parseVocabularyCSV(csv)).toEqual([{w:'apple',m:'蘋果,一種水果',p:'n.',ex:'I say "apple"\nand smile.',ez:'我說蘋果，並微笑。',ph:'/æpəl/',f:[],c:[]}]);
  });
  it('keeps the first headerless word, supports the old two-column format and removes duplicate or incomplete rows', () => {
    expect(parseVocabularyCSV('apple,(n.) 蘋果\r\nApple,蘋果\r\ndog,狗\r\ncat,\r\n,空白').map(({w,m,p})=>({w,m,p})))
      .toEqual([{w:'apple',m:'蘋果',p:'n.'},{w:'dog',m:'狗',p:''}]);
    expect(parseVocabularyCSV('word,meaning\napple,"unterminated')).toEqual([]);
  });
});
