import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {PROGRESS_VERSION,PROGRESS_VERSION_KEY} from '../src/data/progressReset.js';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/vevanchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({channel:'msedge',headless:true}),report=[];
const label=process.env.QA_STAGE_LABEL||'after';await fs.mkdir('.superpowers/qa/pet-mobile-stage',{recursive:true});
try {
  for(const [width,height] of (label==='before'?[[390,844]]:[[360,640],[390,844],[430,932],[1440,900]])){
    const page=await browser.newPage({viewport:{width,height},isMobile:width<760,hasTouch:width<760,serviceWorkers:'block'}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await page.addInitScript(({key,version})=>{localStorage.setItem(key,version);localStorage.setItem('eg_quiet','true');},{key:PROGRESS_VERSION_KEY,version:PROGRESS_VERSION});
    await page.goto((process.env.QA_URL||'http://127.0.0.1:5202/')+'?view=pets&lv=elementary',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'和凪凪一起回家',exact:true}).click();
    await page.locator('[data-renderer="ready"]').waitFor({timeout:60000});
    await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(750);
    const scene=page.locator('.town-scene-wrap'), box=await scene.boundingBox();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(label!=='before') {
      if(width<760){assert.ok(box.width>=width-2);assert.ok(box.height>=440);assert.ok(box.y<350);await page.getByRole('button',{name:'看小鎮',exact:true}).waitFor();}
      else await page.getByRole('button',{name:'看夥伴',exact:true}).waitFor();
    }
    await page.screenshot({path:`.superpowers/qa/pet-mobile-stage/${label}-${width}-viewport.png`});
    await scene.scrollIntoViewIfNeeded();await scene.screenshot({path:`.superpowers/qa/pet-mobile-stage/${label}-${width}-scene.png`});
    if(label!=='before'){
      await page.getByRole('button',{name:width<760?'看小鎮':'看夥伴',exact:true}).click();
      await page.getByRole('button',{name:width<760?'看夥伴':'看小鎮',exact:true}).click();
      await page.getByRole('button',{name:'洗澡',exact:true}).click();
      await page.waitForTimeout(800);
      const bounds=await scene.boundingBox(),hud=await page.locator('.town-care-hud').boundingBox();
      assert.ok(hud.y+hud.height<=bounds.y+bounds.height+1);
      if(width<760){
        const caption=await page.locator('.town-care-caption').boundingBox(),tabs=await page.locator('.town-tabs').boundingBox();
        assert.ok(caption.y>=tabs.y+tabs.height,'Care instructions must clear the sticky navigation');
        assert.ok(hud.y+hud.height<=height,'Care controls must fit on screen after automatic scrolling');
      }
      await scene.screenshot({path:`.superpowers/qa/pet-mobile-stage/${label}-${width}-bath.png`});
      await page.getByRole('button',{name:'稍後再做',exact:true}).click();
    }
    assert.deepEqual(errors,[]);report.push({width,height,scene:box,errors});await page.close();
  }
  await fs.writeFile(`.superpowers/qa/pet-mobile-stage/${label}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
