import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';
import {STORYBOOKS_AUDIO,bookWords,storybookAudioBundle,allStorybookAudio} from './storybookAudio.js';
describe('complete prerecorded book packs',()=>{
 it('covers every clickable token, vocabulary card, and page with a real MP3',()=>{
  for(const book of STORYBOOKS_AUDIO){
   const pack=storybookAudioBundle(book);
   expect(pack.pages).toHaveLength(book.pages.length);
   for(const word of bookWords(book))expect(pack.words[word].audioUrl).toMatch(/^\/audio\/picture-books\/words\/.+\.mp3$/);
   for(const page of book.pages)for(const token of page.x.match(/[A-Za-z']+/g)||[])expect(pack.words[token.toLowerCase().replace(/^'|'$/g,'')]).toBeDefined();
  }
  const items=allStorybookAudio();expect(new Set(items.map(x=>x.audioUrl)).size).toBe(items.length);
  for(const item of items){const bytes=readFileSync(resolve('public'+item.audioUrl));expect(bytes.length).toBeGreaterThan(100);expect(bytes.subarray(0,3).toString()==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224)).toBe(true);}
 });
});
