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
  it('rejects stale or malformed card rounds rather than restoring invalid queues',()=>{
    const session={version:1,level:'elementary',cards:[{w:'apple'},{w:'dog'}],selectedTopic:'direct',flip:true,deck:{total:2,queue:[1],rm:[0],stats:{again:1,hard:0,good:1,easy:0}}};
    expect(readSrsSession(session,'elementary').deck).toEqual(session.deck);
    expect(readSrsSession(session,'junior')).toBeNull();
    expect(readSrsSession({...session,deck:{...session.deck,queue:[2]}},'elementary')).toBeNull();
    expect(readSrsSession({...session,deck:{...session.deck,queue:[0]}},'elementary')).toBeNull();
  });
});
