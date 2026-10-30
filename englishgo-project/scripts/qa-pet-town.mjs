import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { CHAPTERS } from '../src/features/pet-town/worldData.js';
import { PROGRESS_VERSION, PROGRESS_VERSION_KEY } from '../src/data/progressReset.js';

const runtime = process.env.PLAYWRIGHT_MODULE || 'C:/Users/vevanchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const output = path.resolve('.superpowers/qa/pet-town'); await fs.mkdir(output, { recursive: true });
console.log('Launching browser');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
console.log('Browser ready');
const report = [];
try {
  // Exercise the actual bootstrap, including clearing an already-played v2 world.
  const upgrade = await browser.newPage({serviceWorkers:'block'});
  const upgradeErrors=[]; upgrade.on('pageerror', e=>upgradeErrors.push(e.message));
  await upgrade.route('**/*.supabase.co/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await upgrade.addInitScript(() => {
    if(localStorage.getItem('upgrade-seeded'))return;
    for(const key of ['eg_coins','eg_xp','eg_srs_elementary','eg_novelDone','eg_ach','eg_pet_world_v2:guest','eg_pet_legacy_backup:guest'])localStorage.setItem(key,'999');
    localStorage.setItem('eg_pets','[{"petId":"dragon"}]');
    localStorage.setItem('eg_quiet','true'); localStorage.setItem('upgrade-seeded','true');
  });
  await upgrade.goto((process.env.QA_URL || 'http://127.0.0.1:5198/')+'?view=pets&lv=elementary',{waitUntil:'domcontentloaded',timeout:60000});
  await upgrade.getByTestId('pet-town').waitFor({timeout:45000});
  let cleared=await upgrade.evaluate(()=>({coins:localStorage.getItem('eg_coins'),xp:localStorage.getItem('eg_xp'),world:JSON.parse(localStorage.getItem('eg_pet_world_v2:guest')),backup:localStorage.getItem('eg_pet_legacy_backup:guest'),srs:localStorage.getItem('eg_srs_elementary'),novel:localStorage.getItem('eg_novelDone')}));
  assert.equal(cleared.coins,'0'); assert.equal(cleared.xp,'0');
  assert.deepEqual(cleared.world.worldState.ownedPets,[]); assert.equal(cleared.backup,null); assert.equal(cleared.srs,null); assert.equal(cleared.novel,null);
  await upgrade.getByRole('button',{name:/和凪凪一起回家/}).click();
  await upgrade.reload({waitUntil:'domcontentloaded'}); await upgrade.getByTestId('pet-town').waitFor();
  assert.equal(await upgrade.evaluate(()=>JSON.parse(localStorage.getItem('eg_pet_world_v2:guest')).worldState.ownedPets.length),1);
  assert.deepEqual(upgradeErrors,[]); await upgrade.close();
  console.log('One-time reset and subsequent reload: passed');
  const sizes = process.env.QA_WIDTHS ? process.env.QA_WIDTHS.split(',').map(Number).map(w => [w, w > 900 ? 1000 : 844]) : [[1440,1000],[390,844],[360,780]];
  for (const [width,height] of sizes) {
    const page = await browser.newPage({ viewport: { width,height }, serviceWorkers: 'block' });
    console.log(`${width}: page ready`);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(60000);
    await page.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(({version,key}) => {
      if (!localStorage.getItem('townQaInitialized')) {
        localStorage.setItem(key,version);
        localStorage.setItem('eg_coins','400');
        localStorage.setItem('eg_quiet','true');
        localStorage.setItem('eg_xp','123');
        localStorage.setItem('eg_loginBonus',JSON.stringify({lastDate:new Date().toDateString(),claimed:true,streak:1}));
        localStorage.setItem('townQaInitialized','true');
      }
      history.replaceState({ englishGoNavigation: { lv:'elementary',mod:'pets',menuGroup:'pet',depth:0 } },'',location.href);
    },{version:PROGRESS_VERSION,key:PROGRESS_VERSION_KEY});
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('eg_pet_world_v2:guest')));
    const inspect = async name => {
      console.log(`${width}: ${name}`);
      await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
      await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve,2000))]));
      const layout = await page.getByTestId('pet-town').evaluate(root => ({ overflow: root.scrollWidth > root.clientWidth + 2, wide: [...root.querySelectorAll('button,article,input,select')].filter(e => { const r=e.getBoundingClientRect(); return r.width>0 && (r.left < -2 || r.right > innerWidth+2); }).map(e=>e.textContent.slice(0,50)), broken: [...root.querySelectorAll('img')].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src) }));
      report.push({width,height,name,...layout,errors:[...errors]});
      await page.screenshot({ path:path.join(output,`${width}-${name}.png`),fullPage:true });
      assert(!layout.overflow && !layout.wide.length && !layout.broken.length, JSON.stringify(layout));
      assert.deepEqual(errors,[]);
    };
    try {
      console.log(`${width}: opening town`);
      await page.goto(process.env.QA_URL || 'http://127.0.0.1:5198/', {waitUntil:'domcontentloaded'});
      await page.getByTestId('pet-town').waitFor();
      await page.locator('[data-testid="town-scene"][data-renderer="ready"]').waitFor({timeout:45000});
      await inspect('welcome');
      await page.getByRole('button',{name:/和凪凪一起回家/}).click();
      await page.getByRole('button',{name:'餵食',exact:true}).waitFor();
      assert.equal((await saved()).worldState.ownedPets[0].speciesId,'harbor-cat');
      assert.equal(await page.evaluate(()=>localStorage.getItem('eg_xp')),'123');
      assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_pets'))),[]);
      await inspect('home');
      await page.getByRole('button',{name:'看夥伴',exact:true}).click();
      await page.waitForTimeout(1200);
      await inspect('companion-close');
      await page.getByRole('button',{name:'洗澡',exact:true}).click();
      for (const [action, hits] of [['打出泡泡',5],['輕輕搓洗',6],['沖掉泡泡',5],['擦乾毛毛',4]]) for(let n=0;n<hits;n++) await page.getByRole('button',{name:action,exact:true}).click();
      assert.equal((await saved()).worldState.ownedPets[0].clean,100);
      await page.getByRole('navigation',{name:'海風小鎮導覽'}).getByRole('button',{name:'出遊',exact:true}).click();
      await inspect('map');
      const chapters = width > 900 ? CHAPTERS : CHAPTERS.slice(0,1);
      for (const chapter of chapters) {
        await page.getByRole('button',{name:new RegExp(chapter.title)}).click();
        if (chapter.order === 1) await inspect('story');
        for (const q of chapter.levels.elementary.challenges) {
          await page.getByRole('button',{name:new RegExp(q.options[q.answer].en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click();
          await page.getByRole('button',{name:/繼續往前走|看看這段旅程的收穫/}).click();
        }
        await page.getByRole('button',{name:'完成旅程，收進回憶'}).click();
      }
      assert.equal((await saved()).worldState.completedChapters.length,chapters.length);
      assert.equal((await saved()).coins,400 + chapters.length * 5);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_coins'))),400 + chapters.length * 5);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_xp'))),123 + chapters.length * 15);
      await page.getByRole('navigation',{name:'海風小鎮導覽'}).getByRole('button',{name:'夥伴',exact:true}).click();
      if (width > 900) {
        for (let i=0;i<2;i++) {
          await page.getByRole('button',{name:'邀請牠搬進小家',exact:true}).first().click();
          await page.getByRole('navigation',{name:'海風小鎮導覽'}).getByRole('button',{name:'夥伴',exact:true}).click();
        }
        assert.equal((await saved()).worldState.ownedPets.length,3);
      }
      await inspect('friends');
      await page.getByRole('navigation',{name:'海風小鎮導覽'}).getByRole('button',{name:'布置',exact:true}).click();
      await inspect('decorate');
      const balance = await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_coins')));
      await page.getByRole('button',{name:'帶回小家',exact:true}).first().click();
      assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_coins')))) < balance);
      await page.getByRole('button',{name:'放進小家',exact:true}).first().click();
      await inspect('placement');
      await page.getByRole('button',{name:'確認放置',exact:true}).click();
      await page.getByRole('button',{name:'小鎮設定',exact:true}).click(); await inspect('settings');
      await page.getByRole('button',{name:'設定好了',exact:true}).click();
      const beforeReload = (await saved()).worldState;
      await page.reload({waitUntil:'domcontentloaded'}); await page.getByTestId('pet-town').waitFor();
      assert.equal((await saved()).worldState.ownedPets.length,beforeReload.ownedPets.length);
      assert.deepEqual((await saved()).worldState.completedChapters,beforeReload.completedChapters);
      await inspect('restored');
    } catch (error) {
      await page.screenshot({path:path.join(output,`${width}-failure.png`),fullPage:true}).catch(()=>{});
      console.error(JSON.stringify({width,error:error.message,errors})); throw error;
    } finally { await page.close(); }
  }
} finally { await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)); await browser.close(); }
console.log(JSON.stringify({ok:true,screens:report.length,output},null,2));
