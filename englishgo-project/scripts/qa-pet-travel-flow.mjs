import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {PROGRESS_VERSION,PROGRESS_VERSION_KEY} from '../src/data/progressReset.js';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/vevanchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({channel:'msedge',headless:true}),out='.superpowers/qa/pet-travel-flow';await fs.mkdir(out,{recursive:true});
try{
  for(const width of [1440,360]){
    const page=await browser.newPage({viewport:{width,height:width===360?640:900},isMobile:width===360,hasTouch:width===360,serviceWorkers:'block'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await page.addInitScript(({key,version})=>{localStorage.setItem(key,version);localStorage.setItem('eg_quiet','true');},{key:PROGRESS_VERSION_KEY,version:PROGRESS_VERSION});
    await page.goto((process.env.QA_URL||'http://127.0.0.1:5202/')+'?view=pets&lv=elementary',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'和凪凪一起回家',exact:true}).click();
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('eg_pet_world_v2:guest')));
    const before=await saved();
    await page.getByRole('navigation',{name:'海風小鎮導覽'}).getByRole('button',{name:'出遊',exact:true}).click();
    await page.getByRole('button',{name:'繼續探索：潮汐灣',exact:true}).click();
    await page.locator('[data-renderer="ready"]').waitFor({timeout:60000});
    for(const [label,clip] of [['打招呼','greet'],['伸懶腰','stretch'],['開心跳','hop']]){
      await page.getByRole('button',{name:label,exact:true}).click();
      await page.waitForFunction(clip=>document.querySelector('.town-scene canvas')?.dataset.petAction===clip,clip);
      await page.locator('.town-outing-caption').waitFor();
    }
    await page.locator('.town-scene-wrap').screenshot({path:`${out}/${width}-companion.png`});
    await page.locator('.town-discovery-actions button').nth(1).click();
    await page.getByRole('button',{name:'停止前往物件',exact:true}).click();
    await page.locator('.town-scene-wrap').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.querySelector('.town-scene canvas')?.dataset.petMoving==='false');
    await page.waitForTimeout(1800);assert.equal(await page.locator('.town-discovery-clue').count(),0);
    assert.deepEqual((await saved()).worldState.receipts,before.worldState.receipts);
    await page.locator('.town-discovery-actions button').first().click();
    await page.getByRole('button',{name:'查看英文線索 ↓',exact:true}).waitFor({timeout:25000});
    const clue=page.getByRole('button',{name:'查看英文線索 ↓',exact:true});await clue.scrollIntoViewIfNeeded();const start=await clue.boundingBox();
    await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();await page.waitForTimeout(250);const pressed=await clue.boundingBox();
    assert.ok(Math.abs(pressed.x-start.x)<2&&Math.abs(pressed.y-start.y)<2,'Holding the clue button must not move it away from the pointer');await page.mouse.up();
    assert.equal(await page.locator('.town-discovery-panel').evaluate(el=>document.activeElement===el),true);
    const panel=await page.locator('.town-discovery-panel').boundingBox(),nav=await page.locator('.town-tabs').boundingBox();assert.ok(panel.y>=nav.y+nav.height);
    await page.locator('.town-discovery-answers button').nth(0).click();
    assert.equal(await page.locator('.is-answer-retry').count(),1);
    await page.locator('.town-discovery-answers button').nth(1).click();
    assert.equal(await page.locator('.is-answer-correct').evaluate(el=>getComputedStyle(el).opacity),'1');
    await page.locator('.town-discovery-next').screenshot({path:`${out}/${width}-next.png`});
    await page.getByRole('button',{name:'探索下一個：海邊歇腳',exact:true}).click();
    await page.locator('.town-discovery-clue').waitFor({state:'attached',timeout:25000});
    await page.locator('.town-discovery-answers button').nth(2).click();
    await page.getByRole('button',{name:'下一站：花語草地',exact:true}).click();
    await page.locator('[data-scene="meadow"][data-renderer="ready"]').waitFor({timeout:60000});
    await page.getByRole('button',{name:'返回地圖',exact:true}).click();
    await page.locator('.town-world-map').screenshot({path:`${out}/${width}-map.png`});
    const pin=page.locator('[data-place="tidepool"]');await pin.scrollIntoViewIfNeeded();const pinStart=await pin.boundingBox();
    await page.mouse.move(pinStart.x+pinStart.width/2,pinStart.y+pinStart.height/2);await page.mouse.down();await page.waitForTimeout(250);const pinPressed=await pin.boundingBox();
    assert.ok(Math.abs(pinStart.x+pinStart.width/2-pinPressed.x-pinPressed.width/2)<2&&Math.abs(pinStart.y+pinStart.height/2-pinPressed.y-pinPressed.height/2)<2,'Map pins must stay under the pointer while held');await page.mouse.move(0,0);await page.mouse.up();
    assert.equal(await page.locator('[data-place="tidepool"]').getAttribute('class'),'town-map-stop is-complete');
    await page.locator('.town-travel-journal summary').click();
    assert.equal(await page.locator('.town-stamp-grid .is-collected').count(),2);
    await page.locator('.town-travel-journal').screenshot({path:`${out}/${width}-journal.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('button',{name:'重遊潮汐灣：尋找貝殼',exact:true}).click();
    await page.locator('[data-scene="tidepool"][data-renderer="ready"]').waitFor({timeout:60000});
    const after=await saved();assert.equal(after.coins,before.coins);assert.deepEqual(after.worldState.ownedPets,before.worldState.ownedPets);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('navigation',{name:'海風小鎮導覽'}).getByRole('button',{name:'出遊',exact:true}).click();
    await page.getByRole('button',{name:'繼續探索：花語草地',exact:true}).waitFor();await page.getByLabel('旅行印記 2 / 12').waitFor();
    assert.deepEqual(errors,[]);console.log(`${width}: chained exploration, clue focus, journal, revisit and reload passed`);await page.close();
  }
}finally{await browser.close();}
