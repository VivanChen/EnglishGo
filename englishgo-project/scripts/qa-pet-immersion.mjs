import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { FURNITURE } from '../src/features/pet-town/worldData.js';
import { PROGRESS_VERSION, PROGRESS_VERSION_KEY } from '../src/data/progressReset.js';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/vevanchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({channel:'msedge',headless:true});
await fs.mkdir('.superpowers/qa/pet-immersion',{recursive:true});
try{
  for(const width of [1440,390,360]){
    const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<900,serviceWorkers:'block'}), errors=[];
    page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await page.addInitScript(({key,version})=>{localStorage.setItem(key,version);localStorage.setItem('eg_quiet','true');},{key:PROGRESS_VERSION_KEY,version:PROGRESS_VERSION});
    await page.goto((process.env.QA_URL||'http://127.0.0.1:5202/')+'?view=pets&lv=elementary');
    await page.getByRole('button',{name:'和凪凪一起回家',exact:true}).click();
    for(const kind of ['mailbox','fountain','lantern','chime']){
      const item=FURNITURE.find(f=>f.kind===kind);
      await page.evaluate(item=>{const key='eg_pet_world_v2:guest',snapshot=JSON.parse(localStorage.getItem(key));snapshot.worldState.ownedDecorations.push(item.id);snapshot.worldState.placements=[{id:'immersion-target',itemId:item.id,x:2.6,z:0,rotation:0}];localStorage.setItem(key,JSON.stringify(snapshot));},item);
      await page.reload();await page.locator('[data-renderer="ready"]').waitFor({timeout:60000});
      const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_pet_world_v2:guest')).worldState);
      await page.getByRole('button',{name:new RegExp(`^去${item.name}：`)}).click();
      await page.waitForFunction(()=>document.querySelector('.town-scene canvas')?.dataset.environmentPhase==='contact');
      await page.waitForFunction(()=>document.querySelector('.town-scene canvas')?.dataset.environmentPhase==='response');
      await page.locator('.town-scene-wrap').screenshot({path:`.superpowers/qa/pet-immersion/${width}-${kind}.png`});
      await page.getByRole('button',{name:'停止這次互動',exact:true}).click();
      await page.locator('.town-scene-wrap').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>document.querySelector('.town-scene canvas')?.dataset.environmentPhase==='');
      assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_pet_world_v2:guest')).worldState),before);
      assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      console.log(`${width}: ${kind} contact, response, cancellation, no rewards passed`);
      if(kind==='lantern'){
        await page.getByRole('button',{name:'切換夜晚',exact:true}).click();
        await page.locator('[data-renderer="ready"]').waitFor({timeout:60000});
        await page.getByRole('button',{name:new RegExp(`^去${item.name}：`)}).click();
        await page.waitForFunction(()=>document.querySelector('.town-scene canvas')?.dataset.environmentPhase==='response');
        await page.locator('.town-scene-wrap').screenshot({path:`.superpowers/qa/pet-immersion/${width}-night.png`});
        await page.getByRole('button',{name:'停止這次互動',exact:true}).click();
      }
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.getByRole('button',{name:/^去晚風風鈴：/}).click();
    await page.waitForFunction(()=>document.querySelector('.town-scene canvas')?.dataset.environmentPhase==='contact');
    await page.waitForTimeout(2300);
    assert.equal(await page.locator('.town-scene canvas').getAttribute('data-environment-phase'),'contact');
    assert.deepEqual(errors,[]);await page.close();
  }
}finally{await browser.close();}
