import { describe,expect,it } from 'vitest';
import catalog from './vocabularyEnrichment.json';
import manifest from '../../docs/vocabulary-enrichment-2026-10-26.json';
import { enrichVocabularyCard } from './vocabularyEnrichment.js';
import { HIGH_FREQUENCY_COLLOCATIONS } from '../../scripts/data/highFrequencyCollocations.mjs';

describe('vocabulary pronunciation and usage enrichment',()=>{
  it('has readable typed forms and bilingual collocations throughout the generated catalog',()=>{
    expect(Object.keys(catalog)).toHaveLength(5677);
    for(const [key,item]of Object.entries(catalog)){
      expect(typeof item.ph,key).toBe('string');
      expect(item.ph.trim(),key).not.toBe('');
      for(const form of item.f){expect(form,key).toEqual({w:expect.any(String),p:expect.any(String),n:expect.stringMatching(/[\u3400-\u9fff]/)});}
      for(const phrase of item.c){expect(phrase,key).toEqual(expect.stringMatching(/[a-z].*[\u3400-\u9fff]/i));}
    }
  });
  it('chooses the pronunciation used by the card meaning and distinguishes lie and read forms',()=>{
    for(const [word,ipa]of Object.entries({lead:'/liːd/',live:'/lɪv/',wind:'/wɪnd/',present:'/ˈprezənt/'})){
      expect(catalog[`elementary:${word}`].ph).toBe(ipa);
    }
    const lie=catalog['elementary:lie'].f;
    expect(lie).toContainEqual(expect.objectContaining({w:'lain',n:expect.stringContaining('躺')}));
    expect(lie).toContainEqual(expect.objectContaining({w:'lied',n:expect.stringContaining('說謊')}));
    expect(catalog['elementary:read'].f).toContainEqual(expect.objectContaining({w:'read',n:expect.stringContaining('/red/')}));
  });
  it('labels regional names as native-language readings instead of standard English IPA',()=>{
    for(const word of ['chia-pao kua','fong-ru tea','yen-ou'])expect(catalog[`elementary:${word}`].ph).toContain('華語');
  });
  it('does not invent regular forms for modals or ordinary plurals for mass nouns',()=>{
    expect(catalog['elementary:can'].f.some(f=>/canned|canning|cans/.test(f.w))).toBe(false);
    expect(catalog['elementary:can'].f).toContainEqual(expect.objectContaining({w:'could'}));
    for(const word of ['water','rice','homework','news']){
      expect(catalog[`elementary:${word}`].f.some(f=>f.p==='n.'&&f.w===`${word}s`),word).toBe(false);
    }
    expect(catalog['elementary:person'].f).toContainEqual(expect.objectContaining({w:'people'}));
    expect(catalog['elementary:sheep'].f).toContainEqual(expect.objectContaining({w:'sheep',n:expect.stringContaining('同形')}));
  });
  it('keeps authored deck fields while enriching an empty pronunciation, forms and usage',()=>{
    const card={w:'read',m:'閱讀',p:'v.',ph:'',ex:'I read in the garden.',ez:'我在花園裡閱讀。',f:[{w:'reader',p:'n.',n:'讀者'}],c:['read a map 看地圖']};
    const result=enrichVocabularyCard(card,'elementary');
    expect(result).toMatchObject({ex:card.ex,ez:card.ez,ph:'/riːd/'});
    expect(result.f).toContainEqual(card.f[0]);expect(result.c).toContain(card.c[0]);
    expect(card.ph).toBe('');expect(card.f).toHaveLength(1);
    expect(enrichVocabularyCard({...card,ph:'/custom/'},'elementary').ph).toBe('/custom/');
    expect(enrichVocabularyCard({...card,p:'n.'},'elementary').ph).toBe('');
    const again=enrichVocabularyCard(result,'elementary');expect(again).toEqual(result);
  });
  it('provides two authored bilingual phrases per target headword without a generic filler template',()=>{
    expect(Object.keys(HIGH_FREQUENCY_COLLOCATIONS).length).toBeGreaterThanOrEqual(589);
    for(const [word,phrases]of Object.entries(HIGH_FREQUENCY_COLLOCATIONS)){
      expect(phrases.length,word).toBeGreaterThanOrEqual(2);
      expect(new Set(phrases).size,word).toBe(phrases.length);
      expect(phrases.every(p=>/[\u3400-\u9fff]/.test(p)&&/[a-z]/i.test(p)),word).toBe(true);
    }
  });
  it('covers the entire frequency-selected set instead of only a handful of sample words',()=>{
    expect(manifest.highFrequencyKeys).toHaveLength(725);
    for(const key of manifest.highFrequencyKeys){
      expect(catalog[key].c.length,key).toBeGreaterThan(0);
      if(/\bv\./.test(catalog[key].p)&&!key.endsWith(':must'))expect(catalog[key].f.length,key).toBeGreaterThan(0);
    }
    for(const key of manifest.examFocusKeys)expect(catalog[key].c.length,key).toBeGreaterThan(0);
    expect(manifest.pending).toEqual([]);
  });
});
