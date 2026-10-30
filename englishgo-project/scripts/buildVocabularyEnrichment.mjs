import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { PHRASE_AND_RARE_IPA, CONTEXT_IPA, REGIONAL_NAME_IPA } from './data/vocabularyPronunciationOverrides.mjs';
import { HIGH_FREQUENCY_COLLOCATIONS, EXAM_FOCUS_WORDS } from './data/highFrequencyCollocations.mjs';
import { reviewedForms } from './data/vocabularyFormPolicy.mjs';

const directory=process.env.VOCABULARY_ENRICHMENT_INPUT||'.superpowers/qa/vocabulary-enrichment';
const rows=JSON.parse(await fs.readFile(`${directory}/word-bank-before.json`,'utf8'));
const lexicalRows=JSON.parse(await fs.readFile(`${directory}/lexical-candidates.json`,'utf8'));
const lexical=new Map(lexicalRows.map(row=>[row.id,row]));
const ipaSource=await fs.readFile(`${directory}/sources/en_US.txt`,'utf8');
const ipa=new Map(ipaSource.trim().split(/\r?\n/).map(line=>{const [word,value]=line.split('\t');return[word.toLowerCase(),value]}));
const cleanWord=word=>String(word).trim().toLowerCase();
const output={},changes=[],pending=[];
const counts={words:rows.length,phoneticsAdded:0,formsAdded:0,formRecordsAdded:0,collocationsAdded:0,collocationPhrasesAdded:0,highFrequencyWords:0,highFrequencyWithoutCollocations:0};
const highFrequencyKeys=[],examFocusKeys=[];
const mergeForms=(a,b,row)=>{
  const result=a.map(form=>{
    if(typeof form==='string'&&row.word.toLowerCase()==='scissor')return{w:form,p:'n.',n:'常用複數；一把剪刀用 a pair of scissors'};
    if(typeof form!=='object'||!form.w)throw Error(`Unreviewed legacy form: ${row.word}`);
    return {...form};
  });
  for(const form of b){const old=result.find(item=>item.w.toLowerCase()===form.w.toLowerCase()&&item.p===form.p);if(!old)result.push({...form});else if(!old.n?.includes(form.n))old.n=old.n?`${old.n}；${form.n}`:form.n;}
  return result;
};
for(const row of rows){
  const word=cleanWord(row.word),info=lexical.get(row.id);if(!info)throw Error(`Missing lexical snapshot: ${row.id}`);
  const oldForms=Array.isArray(row.forms)?row.forms:[],oldCollocations=Array.isArray(row.collocations)?row.collocations:[];
  const pos=String(row.pos||'').split(/[./\s]+/).find(Boolean)?.toLowerCase();
  let pronunciation=String(row.phonetic||'').trim(),source='existing';
  if(!pronunciation){
    if(REGIONAL_NAME_IPA[word]){pronunciation=REGIONAL_NAME_IPA[word];source='reviewed-native-name';}
    else if(CONTEXT_IPA[word]?.[pos]){pronunciation=CONTEXT_IPA[word][pos];source='reviewed-context';}
    else if(PHRASE_AND_RARE_IPA[word]){pronunciation=PHRASE_AND_RARE_IPA[word];source='reviewed-phrase-or-rare';}
    else if(ipa.has(word)){pronunciation=ipa.get(word).split(', ')[0];source='ipa-dict-en-US';}
    else {pending.push({id:row.id,level:row.level,word:row.word,reason:'not-in-dictionary'});}
    if(pronunciation)counts.phoneticsAdded++;
  }
  if(pronunciation&&!/^\/[^/]+\/(?:, \/[^/]+\/)*$/.test(pronunciation)&&!['existing','reviewed-native-name'].includes(source))throw Error(`Invalid IPA: ${word}`);
  const forms=mergeForms(oldForms,reviewedForms(row,info),row);
  const additions=HIGH_FREQUENCY_COLLOCATIONS[word]||[];
  const collocations=[...new Set([...oldCollocations,...additions])];
  if(forms.length>oldForms.length||JSON.stringify(forms)!==JSON.stringify(oldForms)){counts.formsAdded++;counts.formRecordsAdded+=forms.length-oldForms.length;}
  if(collocations.length>oldCollocations.length){counts.collocationsAdded++;counts.collocationPhrasesAdded+=collocations.length-oldCollocations.length;}
  if(info.zipf>=5){
    counts.highFrequencyWords++;highFrequencyKeys.push(`${row.level}:${word}`);
    if(!collocations.length)counts.highFrequencyWithoutCollocations++;
    if(/\bv\./.test(row.pos)&&word!=='must'&&!forms.length)throw Error(`Missing high-frequency verb forms: ${word}`);
  }
  if(EXAM_FOCUS_WORDS.includes(word)){
    examFocusKeys.push(`${row.level}:${word}`);
    if(!collocations.length)throw Error(`Missing exam focus collocations: ${word}`);
  }
  output[`${row.level}:${word}`]={ph:pronunciation,p:row.pos,f:forms,c:collocations};
  if(pronunciation!==String(row.phonetic||'').trim()||JSON.stringify(forms)!==JSON.stringify(oldForms)||JSON.stringify(collocations)!==JSON.stringify(oldCollocations))changes.push({id:row.id,level:row.level,word:row.word,before:{phonetic:row.phonetic,forms:oldForms,collocations:oldCollocations},after:{phonetic:pronunciation,forms,collocations},source});
}
if(counts.highFrequencyWithoutCollocations)throw Error(`High frequency gaps: ${counts.highFrequencyWithoutCollocations}`);
await fs.writeFile('src/data/vocabularyEnrichment.json',JSON.stringify(output,null,2)+'\n');
await fs.writeFile(`${directory}/changes.json`,JSON.stringify(changes,null,2)+'\n');
const manifest={date:'2026-10-26',counts,pending,highFrequencyKeys,examFocusKeys,regionalNameReadings:Object.keys(REGIONAL_NAME_IPA),policy:{dialect:'General American where available; preserve existing IPA; 3 regional names explicitly label Mandarin citation forms',highFrequency:'wordfreq 3.1.1 English Zipf >= 5.0 plus project exam focus vocabulary',forms:'LemmInflect 0.2.3 dictionary only, POS constrained and reviewed exceptions; no OOV generation',collocations:'EnglishGo-authored bilingual learning phrases'},hashes:{snapshot:crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),ipaDictionary:crypto.createHash('sha256').update(ipaSource).digest('hex'),output:crypto.createHash('sha256').update(JSON.stringify(output)).digest('hex')}};
await fs.writeFile('docs/vocabulary-enrichment-2026-10-26.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({counts,pending},null,2));
