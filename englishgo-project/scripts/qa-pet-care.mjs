import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { PROGRESS_VERSION, PROGRESS_VERSION_KEY } from '../src/data/progressReset.js';

const runtime = process.env.PLAYWRIGHT_MODULE || 'C:/Users/vevanchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const output = path.resolve('.superpowers/qa/pet-care');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [width, name] of [[1440, '凪凪'], [390, '晴晴'], [360, '小麥']]) {
    const context = await browser.newContext({ viewport: { width, height: width > 900 ? 1000 : 844 }, hasTouch: width < 900, isMobile: width < 900, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], media = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('/models/pet-town/') && !response.ok()) media.push(response.url()); });
    await page.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(({ key, version }) => { localStorage.setItem(key, version); localStorage.setItem('eg_quiet', 'true'); }, { key: PROGRESS_VERSION_KEY, version: PROGRESS_VERSION });
    await page.goto((process.env.QA_URL || 'http://127.0.0.1:5201/') + '?view=pets&lv=elementary', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByTestId('pet-town').waitFor({ timeout: 45000 });
    await page.locator('.town-starter-list button').filter({ hasText: name }).click();
    await page.getByRole('button', { name: `和${name}一起回家`, exact: true }).click();
    await page.locator('[data-renderer="ready"]').waitFor({ timeout: 60000 });
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('eg_pet_world_v2:guest')).worldState.ownedPets[0]);
    const client = await context.newCDPSession(page);
    const surface = page.locator('.town-care-surface');
    const tap = async () => {
      await surface.scrollIntoViewIfNeeded();
      const box = await surface.boundingBox(), x = box.x + box.width * .55, y = box.y + box.height * .55;
      if (width < 900) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    };
    const stroke = async () => {
      await surface.scrollIntoViewIfNeeded();
      const box = await surface.boundingBox(), y = box.y + box.height * .55, x = box.x + box.width * .32;
      if (width < 900) await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      else { await page.mouse.move(x, y); await page.mouse.down(); }
      for (let i = 1; i <= 3; i++) {
        await page.waitForTimeout(120);
        if (width < 900) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 28, y }] });
        else await page.mouse.move(x + i * 28, y);
      }
      if (width < 900) await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
    };
    const inspect = async label => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
      assert.equal(overflow, false, `${width}: overflow`); assert.deepEqual(errors, []); assert.deepEqual(media, []);
      await page.locator('.town-scene-wrap').screenshot({ path: path.join(output, `${width}-${label}.png`) });
      report.push({ width, name, label, errors: [...errors], overflow });
      console.log(`${width}: ${label}`);
    };
    await page.getByRole('button', { name: '洗澡', exact: true }).click();
    await page.waitForTimeout(1000);
    await stroke();
    const scrubProgress = Number(await page.getByRole('progressbar', { name: '照顧進度' }).getAttribute('aria-valuenow'));
    assert(scrubProgress >= 10 && scrubProgress < 25, `drag must count movement beyond the initial touch: ${scrubProgress}`);
    assert.equal((await saved()).bond, 0);
    await inspect('lather-drag');
    for (const [label, shot] of [['打出泡泡','lather'], ['輕輕搓洗','scrub'], ['沖掉泡泡','rinse'], ['擦乾毛毛','towel']]) {
      let taps = 0;
      while (await surface.count() && (await surface.getAttribute('aria-label')).includes(label)) {
        await tap(); taps++;
        if (taps === 1) await inspect(shot);
        assert(taps <= 6, `${label} did not advance`);
      }
    }
    assert.equal(await surface.count(), 0);
    assert.equal((await saved()).clean, 100); assert.equal((await saved()).bond, 2);
    await inspect('shake');
    for (const [action, hits] of [['餵食', 7], ['玩耍', 8], ['休息', 5], ['摸摸', 6]]) {
      await page.getByRole('button', { name: action, exact: true }).click();
      for (let i = 0; i < hits; i++) { await tap(); if (i === Math.floor(hits / 2)) await inspect(action); }
      assert.equal(await surface.count(), 0);
    }
    assert.equal((await saved()).bond, 10);
    await page.getByRole('button', { name: '洗澡', exact: true }).click();
    await stroke(); await page.getByRole('button', { name: '結束這次陪伴', exact: true }).click();
    assert.equal((await saved()).bond, 10);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '摸摸', exact: true }).click();
    for (let i = 0; i < 6; i++) { await surface.focus(); await page.keyboard.press('Enter'); }
    assert.equal(await surface.count(), 0); assert.equal((await saved()).bond, 10);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '餵食', exact: true }).waitFor();
    assert.equal((await saved()).bond, 10);
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally { await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(`Care QA passed: ${report.length} desktop/mobile scene checks.`);
