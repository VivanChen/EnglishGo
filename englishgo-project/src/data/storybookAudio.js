import { PIP_PAGES, PIP_VOCAB } from './pipBook.js';
import { MILO_PAGES, MILO_VOCAB } from './miloBook.js';
import { DORI_PAGES, DORI_VOCAB } from './doriBook.js';
import { makeNovelAudioItem, makeNovelAudioAssetId } from './novelAudio.js';

export const STORYBOOKS_AUDIO = [
 {key:'pip',id:'picture-book-pip-lost-star',pages:PIP_PAGES,vocab:PIP_VOCAB},
 {key:'milo',id:'picture-book-milo-little-storm',pages:MILO_PAGES,vocab:MILO_VOCAB},
 {key:'dori',id:'picture-book-dori-echo-mist',pages:DORI_PAGES,vocab:DORI_VOCAB}
];
const sceneWords=['tree','bush','rock','garden','sky'];
export function bookWords(book){
 return [...new Set([...book.pages.flatMap(p=>(p.x.match(/[A-Za-z']+/g)||[]).map(w=>w.toLowerCase().replace(/^'|'$/g,''))),...Object.keys(book.vocab),...sceneWords])].filter(Boolean).sort();
}
export function wordAudioItem(word){
 const text=({i:'I',pip:'Pip',milo:'Milo',ruby:'Ruby',dori:'Dori'})[word]||word;
 const id=makeNovelAudioAssetId({novelId:'picture-book-vocabulary',chapterNo:1,lang:'en-US',text});
 return {text,lang:'en-US',audioUrl:`/audio/picture-books/words/${id}.mp3`};
}
export function storybookAudioBundle(book){
 return {
  pages:book.pages.map((p,i)=>{
   const input={novelId:book.id,chapterNo:i+1,lang:'en-US',text:p.x};
   const item=makeNovelAudioItem(input);
   return {...item,apiAudioUrl:item.audioUrl,audioUrl:`/audio/picture-books/pages/${makeNovelAudioAssetId(input)}.mp3`};
  }),
  words:Object.fromEntries(bookWords(book).map(word=>[word,wordAudioItem(word)]))
 };
}
export function allStorybookAudio(){
 const unique=new Map();
 STORYBOOKS_AUDIO.forEach(book=>{const bundle=storybookAudioBundle(book);[...bundle.pages,...Object.values(bundle.words)].forEach(item=>unique.set(item.audioUrl,item));});
 return [...unique.values()];
}
