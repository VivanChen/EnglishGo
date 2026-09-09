// Generate through the existing approved TTS endpoint once; publish static MP3s.
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {allStorybookAudio,STORYBOOKS_AUDIO,bookWords} from '../src/data/storybookAudio.js';
const root=new URL('../public/',import.meta.url);
const base='https://englishgo-vevan.netlify.app';
const items=allStorybookAudio();
const valid=bytes=>bytes.length>100&&(bytes.subarray(0,3).toString()==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224));
let cursor=0,ready=0,failed=0;const results=[];
console.log(JSON.stringify({files:items.length,books:STORYBOOKS_AUDIO.map(b=>({book:b.key,pages:b.pages.length,words:bookWords(b).length}))}));
async function prepare(item){
 const target=fileURLToPath(new URL(item.audioUrl.slice(1),root));
 try{const bytes=await readFile(target);if(valid(bytes))return 'existing';}catch{}
 for(let attempt=0;attempt<4;attempt++){
  try{
   const post=()=>fetch(base+'/.netlify/functions/elevenlabs-tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:item.text,lang:'en-US',voiceId:'21m00Tcm4TlvDq8ikWAM',speed:.9}),signal:AbortSignal.timeout(60000)});
   let res=item.apiAudioUrl?await fetch(base+item.apiAudioUrl,{signal:AbortSignal.timeout(60000)}):await post();
   if(res.status===404&&item.apiAudioUrl)res=await post();
   if(!res.ok||!res.headers.get('content-type')?.startsWith('audio/'))throw Error(`HTTP ${res.status}`);
   const bytes=Buffer.from(await res.arrayBuffer());if(!valid(bytes))throw Error('Invalid MP3');
   await mkdir(dirname(target),{recursive:true});await writeFile(target+'.tmp',bytes);await rename(target+'.tmp',target);
   return res.headers.get('x-tts-source')||'audio';
  }catch(error){if(attempt===3)throw error;await new Promise(r=>setTimeout(r,2000*(attempt+1)));}
 }
}
await Promise.all([0,1,2].map(async()=>{while(cursor<items.length){const item=items[cursor++];try{const source=await prepare(item);ready++;results.push({file:item.audioUrl,source});if(ready%10===0)console.log(`${ready}/${items.length} ready`);}catch(error){failed++;console.error(`Failed ${item.text}: ${error.message}`);}}}));
await writeFile(new URL('audio/picture-books/generation-report.json',root),JSON.stringify({generatedAt:new Date().toISOString(),voiceId:'21m00Tcm4TlvDq8ikWAM',speed:.9,ready,failed,results},null,2));
console.log(JSON.stringify({ready,failed,total:items.length}));if(failed)process.exitCode=1;
