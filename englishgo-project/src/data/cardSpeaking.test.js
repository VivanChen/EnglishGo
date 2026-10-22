import { describe, expect, it } from 'vitest';
import { cardPracticeStorageKey, readCardPractice, readSrsSession, speakingPhrases } from './cardSpeaking.js';

describe('card speaking handoff',()=>{
  it('keeps the selected bilingual pair and separates levels, words and examples',()=>{
    const seed={word:' dog ',meaning:'狗',en:' My dog runs. ',zh:' 我的狗跑起來。 ',type:'sentence'};
    const item=readCardPractice(seed);
    expect(item).toEqual({...seed,word:'dog',en:'My dog runs.',zh:'我的狗跑起來。'});
    expect(readCardPractice({...seed,en:''})).toBeNull();
    expect(readCardPractice({...seed,type:'unknown'})).toBeNull();
    expect(cardPracticeStorageKey('junior',item)).not.toBe(cardPracticeStorageKey('elementary',item));
    expect(cardPracticeStorageKey('junior',item)).not.toBe(cardPracticeStorageKey('junior',{...item,en:'My dog sleeps.'}));
  });
  it('preserves sentence words and punctuation when splitting for slow listening',()=>{
    const sentence='After school, I walk my dog to the park. We play together!';
    const parts=speakingPhrases(sentence);
    expect(parts.join(' ')).toBe(sentence);
    expect(parts.every(part=>part.split(' ').length<=5)).toBe(true);
    expect(parts[0]).toBe('After school,');
  });
  it('balances long clauses without leaving one word at the end and keeps short examples manageable',()=>{
    expect(speakingPhrases('Please drink more water.')).toEqual(['Please drink','more water.']);
    expect(speakingPhrases('I like to eat apples.')).toEqual(['I like to','eat apples.']);
    expect(speakingPhrases('We like playing in the park.')).toEqual(['We like playing','in the park.']);
    for(let length=4;length<=30;length++) {
      const text=Array.from({length},(_,index)=>`word${index}`).join(' ');
      const phrases=speakingPhrases(text);
      expect(phrases.join(' ')).toBe(text);
      expect(phrases.every(part=>part.split(' ').length>=2&&part.split(' ').length<=5)).toBe(true);
    }
  });
  it('keeps titles, contractions and repeated words intact without inventing or dropping text',()=>{
    const text="Dr. Chen said, \"Don't give up!\" We try and try again.";
    expect(speakingPhrases(text).join(' ')).toBe(text);
    expect(speakingPhrases(text)[0]).toBe('Dr. Chen said,');
    expect(speakingPhrases('  Hello,\nmy friend!  ')).toEqual(['Hello,','my friend!']);
    expect(speakingPhrases('An apple.')).toEqual(['An apple.']);
    expect(speakingPhrases('')).toEqual([]);
  });
  it('rejects stale or malformed card rounds rather than restoring invalid queues',()=>{
    const session={version:1,level:'elementary',cards:[{w:'apple'},{w:'dog'}],selectedTopic:'direct',flip:true,deck:{total:2,queue:[1],rm:[0],stats:{again:1,hard:0,good:1,easy:0}}};
    expect(readSrsSession(session,'elementary').deck).toEqual(session.deck);
    expect(readSrsSession(session,'junior')).toBeNull();
    expect(readSrsSession({...session,deck:{...session.deck,queue:[2]}},'elementary')).toBeNull();
    expect(readSrsSession({...session,deck:{...session.deck,queue:[0]}},'elementary')).toBeNull();
  });
});
