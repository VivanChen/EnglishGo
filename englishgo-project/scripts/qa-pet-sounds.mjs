import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PROGRESS_VERSION, PROGRESS_VERSION_KEY } from '../src/data/progressReset.js';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || 'C:/Users/vevanchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser = await chromium.launch({channel:'msedge',headless:true});
await fs.mkdir('.superpowers/qa/pet-sounds',{recursive:true});
try {
  for (const width of [1440,390,360]) {
    const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<900,serviceWorkers:'block'}), errors=[], failed=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().includes('/audio/pet-town/')&&!r.ok())failed.push(r.status());});
    await page.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await page.addInitScript(({key,version})=>{
      localStorage.setItem(key,version);localStorage.setItem('eg_quiet','false');
      window.petSoundStarts=0;window.petDecoded=0;window.petSoundActive=0;
      const start=AudioBufferSourceNode.prototype.start, decode=AudioContext.prototype.decodeAudioData;
      AudioBufferSourceNode.prototype.start=function(...args){if(!this.loop){window.petSoundStarts++;window.petSoundActive++;this.addEventListener('ended',()=>window.petSoundActive--);}return start.apply(this,args);};
      AudioContext.prototype.decodeAudioData=async function(...args){const buffer=await decode.apply(this,args);window.petDecoded++;return buffer;};
    },{key:PROGRESS_VERSION_KEY,version:PROGRESS_VERSION});
    await page.goto((process.env.QA_URL||'http://127.0.0.1:5202/')+'?view=pets&lv=elementary',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'和凪凪一起回家',exact:true}).click();
    await page.locator('[data-renderer="ready"]').waitFor({timeout:60000});
    assert.equal(await page.evaluate(()=>window.petSoundStarts),0);
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).click();
    await page.waitForFunction(()=>window.petDecoded===10);
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
    await page.getByRole('button',{name:'關閉小鎮音效',exact:true}).click();
    await page.waitForFunction(()=>window.petSoundActive===0);
    const muted=await page.evaluate(()=>window.petSoundStarts);
    await page.getByRole('button',{name:'打招呼',exact:true}).click(); await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>window.petSoundStarts),muted);
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).click();
    await page.getByRole('button',{name:'關閉遊戲音效',exact:true}).click();
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).waitFor();
    await page.waitForFunction(()=>window.petSoundActive===0);
    await page.getByRole('button',{name:'開啟遊戲音效',exact:true}).click();
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).click();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).waitFor();
    await page.waitForFunction(()=>window.petSoundActive===0);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).scrollIntoViewIfNeeded();
    const clipped=await page.getByRole('button',{name:'開啟小鎮音效',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.pet-town').getBoundingClientRect();return r.left<p.left||r.right>p.right;});
    assert.equal(clipped,false); assert.deepEqual(errors,[]); assert.deepEqual(failed,[]);
    await page.screenshot({path:`.superpowers/qa/pet-sounds/${width}-header.png`});
    console.log(`${width}: four animations, decoded audio, playback, local/global mute, visibility pause, unchanged rewards, layout passed`); await page.close();
  }
}finally{await browser.close();}
