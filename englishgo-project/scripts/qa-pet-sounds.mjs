import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PROGRESS_VERSION, PROGRESS_VERSION_KEY } from '../src/data/progressReset.js';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || 'C:/Users/vevanchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser = await chromium.launch({channel:'msedge',headless:true});
// An isolated playback fixture; never written to the published audio pack.
const musicFixture=process.env.QA_MUSIC_FIXTURE==='1';
const pack=JSON.parse(await fs.readFile('public/audio/pet-town/manifest.json','utf8'));
const hasMusic=musicFixture||!!pack.music;
const initialDecodes=Object.keys(pack.files).length+(hasMusic?1:0);
await fs.mkdir('.superpowers/qa/pet-sounds',{recursive:true});
try {
  for (const width of [1440,360]) {
    const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<900,serviceWorkers:'block'}), errors=[], failed=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().includes('/audio/pet-town/')&&!r.ok())failed.push(r.status());});
    if(musicFixture) {
      await page.route('**/audio/pet-town/manifest.json',r=>r.fulfill({json:{...pack,music:{file:'testbgm.wav',volume:.12},scenes:{...pack.scenes,home:{file:'testbgm.wav',volume:.12}}}}));
      await page.route('**/audio/pet-town/testbgm.wav',r=>r.fulfill({path:'public/audio/pet-town/chime.wav',contentType:'audio/wav'}));
    }
    page.on('request',r=>{if(/api\.elevenlabs\.io|api\.openai\.com/.test(r.url()))failed.push('unexpected generation API call');});
    await page.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await page.addInitScript(({key,version})=>{
      localStorage.setItem(key,version);localStorage.setItem('eg_quiet','true');
      window.petVoiceBuffers=[];const bufferIds=new WeakMap();let bufferId=0;
      window.petSoundStarts=0;window.petDecoded=0;window.petSoundActive=0;
      window.petMusicActive=0;window.petMusicStarts=0;
      window.petMusicContexts=[];const musicSources=new WeakSet(),soundSources=new WeakSet();
      const connections=new WeakMap(),connect=AudioNode.prototype.connect;
      AudioNode.prototype.connect=function(destination,...args){const result=connect.call(this,destination,...args);connections.set(this,destination);return result;};
      const start=AudioBufferSourceNode.prototype.start, stop=AudioBufferSourceNode.prototype.stop, decode=AudioContext.prototype.decodeAudioData;
      const finishMusic=source=>{if(musicSources.delete(source))window.petMusicActive--;};
      const finishSound=source=>{if(soundSources.delete(source))window.petSoundActive--;};
      AudioBufferSourceNode.prototype.start=function(...args){if(!this.loop){if(!bufferIds.has(this.buffer))bufferIds.set(this.buffer,++bufferId);window.petVoiceBuffers.push(bufferIds.get(this.buffer));soundSources.add(this);window.petSoundStarts++;window.petSoundActive++;this.addEventListener('ended',()=>finishSound(this));}else if(this.buffer?.duration!==4){window.petMusicGain=connections.get(this)?.gain;musicSources.add(this);window.petMusicContexts.push(this.context);window.petMusicStarts++;window.petMusicActive++;this.addEventListener('ended',()=>finishMusic(this));}return start.apply(this,args);};
      // A suspended context can defer `ended`; also observe successful explicit stops.
      AudioBufferSourceNode.prototype.stop=function(...args){const result=stop.apply(this,args);finishMusic(this);finishSound(this);return result;};
      AudioContext.prototype.decodeAudioData=async function(...args){const buffer=await decode.apply(this,args);window.petDecoded++;return buffer;};
    },{key:PROGRESS_VERSION_KEY,version:PROGRESS_VERSION});
    await page.goto((process.env.QA_URL||'http://127.0.0.1:5202/')+'?view=pets&lv=elementary',{waitUntil:'domcontentloaded'});
    assert.equal(await page.evaluate(()=>window.petSoundStarts),0);
    for(const name of ['凪凪','晴晴','小麥']) {
      await page.locator('.town-starter-list button').filter({hasText:name}).click();
      const before=await page.evaluate(()=>window.petSoundStarts);
      await page.getByRole('button',{name:`試聽${name}的聲音`,exact:true}).click();
      await page.waitForFunction(before=>window.petSoundStarts>before,before);
      await page.getByRole('button',{name:'小鎮設定',exact:true}).click();
      const mood=page.getByRole('combobox',{name:'試聽聲音情境'});
      const voices=[];
      for(const choice of ['happy','happy','cuddle']){
        await mood.selectOption(choice);await page.waitForTimeout(2100);
        const count=await page.evaluate(()=>window.petVoiceBuffers.length);
        await page.getByRole('button',{name:'試聽這種心情',exact:true}).click();
        await page.waitForFunction(n=>window.petVoiceBuffers.length>n,count);
        voices.push(await page.evaluate(()=>window.petVoiceBuffers.at(-1)));
      }
      assert.equal(new Set(voices).size,3,`${name} should have two happy calls and an affectionate call`);
      await mood.selectOption('greet');await page.getByRole('button',{name:'設定好了',exact:true}).click();
      await page.getByRole('button',{name:'關閉小鎮音效',exact:true}).click();
      await page.waitForFunction(()=>window.petSoundActive===0&&window.petMusicActive===0);
    }
    await page.locator('.town-starter-list button').filter({hasText:'凪凪'}).click();
    await page.evaluate(()=>{window.petSoundStarts=0;window.petMusicStarts=0;});
    await page.getByRole('button',{name:'和凪凪一起回家',exact:true}).click();
    await page.locator('[data-renderer="ready"]').waitFor({timeout:60000});
    assert.equal(await page.evaluate(()=>window.petSoundStarts),0);
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).click();
    await page.waitForFunction(count=>window.petDecoded===count,initialDecodes);
    if(hasMusic) await page.waitForFunction(()=>window.petMusicActive===1);
    await page.getByRole('button',{name:'小鎮設定',exact:true}).click();
    await page.getByRole('slider',{name:'背景音樂音量',exact:true}).press('Home');
    if(hasMusic) await page.waitForFunction(()=>Math.abs(window.petMusicGain.value)<.001);
    await page.getByRole('slider',{name:'背景音樂音量',exact:true}).press('End');
    if(hasMusic) await page.waitForFunction(()=>Math.abs(window.petMusicGain.value-.2)<.002);
    await page.getByRole('slider',{name:'寵物與環境音量',exact:true}).press('Home');
    await page.getByRole('button',{name:'設定好了',exact:true}).click();
    const silent=await page.evaluate(()=>window.petSoundStarts);
    await page.getByRole('button',{name:'試聽凪凪的聲音',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.petSoundStarts),silent);
    const effects=page.getByRole('slider',{name:'寵物與環境音量',exact:true});
    await effects.press('End');for(let i=0;i<4;i++)await effects.press('ArrowLeft');
    await page.getByRole('dialog').screenshot({path:`.superpowers/qa/pet-sounds/${width}-mix.png`});
    await page.getByRole('button',{name:'設定好了',exact:true}).click();
    await page.getByRole('button',{name:'試聽凪凪的聲音',exact:true}).click();
    if(hasMusic){await page.waitForFunction(()=>window.petMusicGain.value<.1);await page.waitForFunction(()=>window.petMusicGain.value>.199);}
    const petBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_pet_world_v2:guest')).worldState.ownedPets);
    for(const [label,clip] of [['打招呼','greet'],['伸懶腰','stretch'],['整理毛毛','groom'],['開心蹦跳','hop']]) {
      const before=await page.evaluate(()=>window.petSoundStarts);
      await page.getByRole('button',{name:label,exact:true}).click();
      await page.locator('.town-scene-wrap').scrollIntoViewIfNeeded();
      await page.waitForFunction(clip=>document.querySelector('.town-scene canvas')?.dataset.petAction===clip,clip);
      await page.waitForFunction(before=>window.petSoundStarts>before,before);
      await page.waitForTimeout(650);
      await page.locator('.town-scene-wrap').screenshot({path:`.superpowers/qa/pet-sounds/${width}-${clip}.png`});
    }
    const petAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_pet_world_v2:guest')).worldState.ownedPets);
    assert.deepEqual(petAfter,petBefore);
    if(hasMusic) assert.equal(await page.evaluate(()=>window.petMusicActive),1);
    await page.getByRole('button',{name:'關閉小鎮音效',exact:true}).click();
    await page.waitForFunction(()=>window.petSoundActive===0);
    await page.waitForFunction(()=>window.petMusicActive===0&&window.petMusicContexts.every(c=>c.state!=='running'));
    const muted=await page.evaluate(()=>window.petSoundStarts);
    await page.getByRole('button',{name:'打招呼',exact:true}).click(); await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>window.petSoundStarts),muted);
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).click();
    if(hasMusic) await page.waitForFunction(count=>window.petMusicActive===1&&window.petMusicStarts===2&&window.petDecoded===count,initialDecodes);
    await page.getByRole('button',{name:'關閉遊戲音效',exact:true}).click();
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).waitFor();
    await page.waitForFunction(()=>window.petSoundActive===0);
    await page.waitForFunction(()=>window.petMusicActive===0&&window.petMusicContexts.every(c=>c.state!=='running'));
    await page.getByRole('button',{name:'開啟遊戲音效',exact:true}).click();
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).click();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).waitFor();
    await page.waitForFunction(()=>window.petSoundActive===0);
    await page.waitForFunction(()=>window.petMusicActive===0&&window.petMusicContexts.every(c=>c.state!=='running'));
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    // Hiding during resume must not leave the sound control permanently busy.
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).click();
    await page.getByRole('button',{name:'關閉小鎮音效',exact:true}).waitFor();
    if(hasMusic) await page.waitForFunction(()=>window.petMusicActive===1);
    await page.getByRole('button',{name:'關閉小鎮音效',exact:true}).click();
    await page.waitForFunction(()=>window.petMusicActive===0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).scrollIntoViewIfNeeded();
    const clipped=await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.pet-town').getBoundingClientRect();return r.left<p.left||r.right>p.right;});
    assert.equal(clipped,false); assert.deepEqual(errors,[]); assert.deepEqual(failed,[]);
    await page.screenshot({path:`.superpowers/qa/pet-sounds/${width}-header.png`});
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).click();
    await page.getByRole('navigation',{name:'海風小鎮導覽'}).getByRole('button',{name:'出遊',exact:true}).click();
    for(const name of ['潮汐灣','花語草地','映月池','海風市集','林間營地','山頂觀星台']){
      const starts=await page.evaluate(()=>window.petMusicStarts);
      await page.getByRole('button',{name:`前往${name}`,exact:true}).click();
      await page.waitForFunction(n=>window.petMusicStarts>n,starts);
      await page.waitForFunction(()=>window.petMusicGain.value>0);
    }
    const starts=await page.evaluate(()=>window.petMusicStarts);
    await page.getByRole('button',{name:'返回地圖',exact:true}).click();
    await page.waitForFunction(n=>window.petMusicStarts>n,starts);
    await page.getByRole('button',{name:'關閉小鎮音效',exact:true}).click();
    await page.getByRole('button',{name:'前往潮汐灣',exact:true}).click();await page.waitForTimeout(900);
    assert.equal(await page.evaluate(()=>window.petMusicActive),0);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'小鎮設定',exact:true}).click();
    assert.equal(await page.getByRole('slider',{name:'背景音樂音量',exact:true}).inputValue(),'100');
    assert.equal(await page.getByRole('slider',{name:'寵物與環境音量',exact:true}).inputValue(),'80');
    console.log(`${width}: six destination tracks, three species mood variants, saved volume controls, foreground duck/recovery, four animations, decoded audio, ${hasMusic?'cached music loop/resume, ':''}playback, local/global mute, visibility pause, unchanged rewards, layout passed${musicFixture?' (music uses test fixture)':''}`); await page.close();
  }
}finally{await browser.close();}
