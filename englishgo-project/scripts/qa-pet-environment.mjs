import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { PerspectiveCamera, Vector3 } from 'three';
import { PROGRESS_VERSION, PROGRESS_VERSION_KEY } from '../src/data/progressReset.js';

const runtime = process.env.PLAYWRIGHT_MODULE || 'C:/Users/vevanchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const output = path.resolve('.superpowers/qa/pet-environment'); await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true }), report = [];
try {
  for (const width of [1440,390,360]) {
    const context = await browser.newContext({ viewport: { width, height: width > 900 ? 1000 : 844 }, hasTouch: width < 900, isMobile: width < 900, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*.supabase.co/**', r => r.fulfill({ status:200, contentType:'application/json', body:'[]' }));
    await page.addInitScript(({key,version}) => { localStorage.setItem(key,version); localStorage.setItem('eg_quiet','true'); }, { key:PROGRESS_VERSION_KEY, version:PROGRESS_VERSION });
    await page.goto((process.env.QA_URL || 'http://127.0.0.1:5202/')+'?view=pets&lv=elementary', { waitUntil:'domcontentloaded', timeout:60000 });
    await page.getByRole('button', { name:'和凪凪一起回家', exact:true }).click();
    await page.locator('[data-renderer="ready"]').waitFor({ timeout:45000 });
    const canvas = page.locator('.town-scene canvas');
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('eg_pet_world_v2:guest')).worldState);
    const before = await saved();
    const shot = async label => {
      await page.locator('.town-scene-wrap').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
      assert.deepEqual(errors, []);
      await page.locator('.town-scene-wrap').screenshot({ path:path.join(output,`${width}-${label}.png`) });
      report.push({ width,label }); console.log(`${width}: ${label}`);
    };
    const arrive = async (id,clip) => {
      await page.waitForFunction(({id,clip}) => { const c = document.querySelector('.town-scene canvas'); return c?.dataset.environmentTarget === id && c.dataset.petMoving === 'false' && c.dataset.petAction === clip; }, {id,clip}, { timeout:25000 });
    };
    // Project known world coordinates through the initial camera to exercise real raycasts.
    const sceneClick = async (point, initial = false) => {
      await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
      const camera = new PerspectiveCamera(36,box.width/box.height,.1,100), target = new Vector3(0,.6,-.3);
      const scale = initial && box.width < 600 ? 1.35 : 1;
      camera.position.set(10*scale,8.5*scale,12.5*scale);
      const distance = camera.position.distanceTo(target);
      if (distance > 22) camera.position.sub(target).setLength(22).add(target);
      camera.lookAt(target); camera.updateMatrixWorld();
      const p = new Vector3(...point).project(camera), x = box.x+(p.x+1)*box.width/2, y = box.y+(1-p.y)*box.height/2;
      if (width < 900) await page.touchscreen.tap(x,y); else await page.mouse.click(x,y);
    };
    // Phones now start close to their companion; explicitly use the overview for coordinate picking.
    const startsFocused=width<=760;
    if(startsFocused){await page.getByRole('button',{name:'看小鎮',exact:true}).click();await page.waitForTimeout(500);}
    await sceneClick([-2.5,.275,1.4],!startsFocused);
    await arrive('placement-harbor-bowl','eat'); await shot('scene-bowl');
    await page.getByRole('button',{name:'停止這次互動',exact:true}).click();
    for (const [name,id,clip] of [['海鹽軟墊','placement-harbor-cushion','sleep'],['窗邊綠盆栽','placement-harbor-planter','sniff']]) {
      await page.getByRole('button',{name:new RegExp(`^去${name}：`)}).click();
      await arrive(id,clip); await shot(id);
      await page.getByRole('button',{name:'停止這次互動',exact:true}).click();
    }
    // Return to a fixed camera, then click bare ground adjacent to the bowl.
    await page.getByRole('button',{name:'看小鎮',exact:true}).click(); await page.waitForTimeout(500);
    await sceneClick([-1.85,.08,1.4]);
    await arrive('placement-harbor-bowl','eat'); await shot('nearby-ground');
    await page.waitForFunction(() => document.querySelector('.town-scene canvas')?.dataset.environmentTarget === '', null, { timeout:12000 });
    assert.equal(await page.getByRole('button',{name:'停止這次互動',exact:true}).count(),0);
    assert.deepEqual(await saved(),before);
    // Cancel during travel and ensure the old destination cannot trigger later.
    await page.getByRole('button',{name:/^去窗邊綠盆栽：/}).click();
    await page.getByRole('button',{name:'停止這次互動',exact:true}).click();
    await page.locator('.town-scene-wrap').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.town-scene canvas')?.dataset.environmentTarget === '');
    await page.emulateMedia({ reducedMotion:'reduce' });
    await page.getByRole('button',{name:/^去海鹽軟墊：/}).click(); await arrive('placement-harbor-cushion','sleep'); await shot('reduced-motion');
    await page.getByRole('button',{name:'停止這次互動',exact:true}).click();
    await page.getByRole('navigation',{name:'海風小鎮導覽'}).getByRole('button',{name:'布置',exact:true}).click();
    assert.equal(await page.getByRole('region',{name:'家園物件互動'}).count(),0);
    await page.getByRole('button',{name:'看小鎮',exact:true}).click(); await page.waitForTimeout(500);
    await sceneClick([2.6,.35,0]);
    await page.getByRole('button',{name:'確認放置',exact:true}).waitFor();
    await shot('decorate-still-edits');
    await page.getByRole('button',{name:'取消調整',exact:true}).click();
    assert.deepEqual(await saved(),before); assert.deepEqual(errors,[]);
    await context.close();
  }
} finally { await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)); await browser.close(); }
console.log(`Environment QA passed: ${report.length} scene checks.`);
