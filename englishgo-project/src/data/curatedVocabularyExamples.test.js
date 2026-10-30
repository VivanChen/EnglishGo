import { describe, expect, it } from 'vitest';
import { CURATED_VOCABULARY_EXAMPLES, getCuratedVocabularyExample } from './curatedVocabularyExamples.js';
import { isPlaceholderExample } from './vocabularyCardText.js';
import { normalizeWordIllustrations } from './wordIllustrations.js';
import { EXTRA_WORDS } from './extraWords.js';

describe('reviewed bilingual vocabulary examples',()=>{
  it('provides a complete target-word sentence and Chinese translation for each reviewed entry',()=>{
    const ids=new Set();
    for(const item of CURATED_VOCABULARY_EXAMPLES){
      const id=`${item.level}:${item.word}`;
      expect(ids.has(id),id).toBe(false);ids.add(id);
      expect(isPlaceholderExample(item.ex,item.word),id).toBe(false);
      expect(item.ez,id).toMatch(/[\u3400-\u9fff]/);
      expect(item.ex,id).toMatch(/[.!?]$/);
    }
  });
  it('keeps the local card and cloud illustration captions on the same reviewed pair',()=>{
    const pair=getCuratedVocabularyExample('junior','comparison');
    const card=EXTRA_WORDS.junior.find(card=>card.w==='comparison');
    expect(card).toMatchObject(pair);
    const [image]=normalizeWordIllustrations([{id:'comparison',level:'junior',word:'comparison',image_url:'https://example.com/comparison.webp',alt_zh:'女孩比較蘋果與梨子。',example:'The girl compared the apple with the pear.',example_zh:'女孩比較蘋果和梨子。'}],'junior','comparison');
    expect(image).toMatchObject({example:pair.ex,example_zh:pair.ez});
    expect(getCuratedVocabularyExample('senior','comparison')).toBeNull();
  });
});
