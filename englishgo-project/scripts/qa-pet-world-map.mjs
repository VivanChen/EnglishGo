import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PerspectiveCamera,Vector3} from 'three';
import {pathToFileURL} from 'node:url';
import {EXPLORATION_PLACES} from '../src/features/pet-town/explorationData.js';
import {PROGRESS_VERSION,PROGRESS_VERSION_KEY} from '../src/data/progressReset.js';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/vevanchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({channel:'msedge',headless:true}),out='.superpowers/qa/pet-world-map';
await fs.mkdir(out,{recursive:true});let encounters=0;
try{
  for(const width of (process.env.QA_WIDTHS?.split(',').map(Number)||[1440,390,360])){
    const page=await browser.newPage({viewport:{width,height:width===360?640:900},isMobile:width<760,hasTouch:width<760,serviceWorkers:'block'}),errors=[],failed=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&/\.(glb|png|mp3|js|css)(\?|$)/.test(r.url()))failed.push(r.url());});
    await page.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await page.addInitScript(({key,version})=>{localStorage.setItem(key,version);localStorage.setItem('eg_quiet','true');},{key:PROGRESS_VERSION_KEY,version:PROGRESS_VERSION});
    const url=(process.env.QA_URL||'http://127.0.0.1:5202/')+'?view=pets&lv=elementary';
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'和凪凪一起回家',exact:true}).click();
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('eg_pet_world_v2:guest')));
    const before=await saved();
    await page.getByRole('navigation',{name:'海風小鎮導覽'}).getByRole('button',{name:'出遊',exact:true}).click();
    const close=page.getByRole('button',{name:'關閉通知',exact:true});if(await close.count())await close.click();
    await page.locator('.town-world-map').screenshot({path:`${out}/${width}-map.png`});
    let count=0;
    for(const p of EXPLORATION_PLACES.filter(p=>!process.env.QA_PLACES||process.env.QA_PLACES.split(',').includes(p.id))){
      await page.getByRole('button',{name:`前往${p.name}`,exact:true}).click();
      await page.locator(`[data-scene="${p.id}"][data-renderer="ready"]`).waitFor({timeout:60000});
      // Selecting the current pin must not put the loaded scene back into a loading state.
      await page.getByRole('button',{name:`前往${p.name}`,exact:true}).click();
      await page.locator('.town-scene-wrap').scrollIntoViewIfNeeded();
      await page.locator('.town-scene-wrap').screenshot({path:`${out}/${width}-${p.id}.png`});
      for(const [i,t] of p.tasks.entries()){
        if(width===390&&p.id==='meadow'&&i===0){
          const canvas=page.locator('.town-scene canvas');await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();
          const camera=new PerspectiveCamera(36,b.width/b.height,.1,100),target=new Vector3(0,.6,-.3);
          camera.position.set(13.5,11.475,16.875);camera.position.sub(target).setLength(22).add(target);camera.lookAt(target);camera.updateMatrixWorld();
          const point=new Vector3(-2.4,.7,1.2).project(camera);
          await page.touchscreen.tap(b.x+(point.x+1)*b.width/2,b.y+(1-point.y)*b.height/2);
        }else await page.locator('.town-discovery-actions button').nth(i).click();
        if(width===360&&p.id==='camp'&&i===0){await page.waitForTimeout(100);await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));}
        await page.locator('.town-discovery-clue').waitFor({state:'attached',timeout:25000}).catch(async error=>{console.log(p.id,t.id,await page.locator('.town-discovery-panel').innerText(),await page.locator('.town-scene canvas').evaluate(c=>({...c.dataset})));await page.screenshot({path:`${out}/${width}-failure.png`,fullPage:true});throw error;});
        await page.locator('.town-discovery-answers button').nth((t.answer+1)%3).click();
        assert.equal((await saved()).worldState.receipts.filter(r=>r.startsWith('explore:')).length,count);
        await page.locator('.town-discovery-answers button').nth(t.answer).click();count++;encounters++;
        await page.getByLabel(`旅行印記 ${count} / 12`).waitFor();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      }
      await page.locator('.town-discovery-panel').screenshot({path:`${out}/${width}-${p.id}-clue.png`});
      console.log(`${width}: ${p.id} complete`);
    }
    const after=await saved();assert.equal(after.coins,before.coins);assert.deepEqual(after.worldState.ownedPets,before.worldState.ownedPets);assert.deepEqual(after.worldState.completedChapters,[]);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('navigation',{name:'海風小鎮導覽'}).getByRole('button',{name:'出遊',exact:true}).click();
    await page.getByLabel(`旅行印記 ${count} / 12`).waitFor();
    // Existing story remains available alongside free exploration.
    await page.getByRole('button',{name:/抵達小島的午後/}).click();
    await page.getByText('Which bag is yours?',{exact:true}).waitFor();
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await page.close();
  }
  console.log(`World map QA passed: ${encounters} encounters, persistence and existing story.`);
}finally{await browser.close();}
