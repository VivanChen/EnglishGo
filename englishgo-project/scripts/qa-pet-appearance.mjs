import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { PET_APPEARANCES, getPetStage } from '../src/data/petAppearance.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve(process.env.QA_OUTPUT || '.superpowers/qa/pet-appearance');
const level = Number(process.env.QA_LEVEL || 3);
const outputUrl = path.relative(process.cwd(), output).replaceAll('\\', '/');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [], errors = [];
const ids = Object.keys(PET_APPEARANCES);
const base = process.env.QA_URL || 'http://127.0.0.1:5197';
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.location().url.includes('/.netlify/functions/')) errors.push(message.text()); });
  await page.addInitScript(({ ids, level }) => {
    const now = new Date().toISOString(), today = new Date().toDateString();
    const fixtures = {
      pets: ids.map((petId, i) => ({ petId, rarity: i < 10 ? 'N' : i < 19 ? 'R' : i < 25 ? 'SR' : 'SSR', level, exp: 0, bond: 180, hunger: 30, clean: 70, energy: 80, lastUpdate: now })),
      coins: 100, inv: { apple: 3 }, quiet: true, calm: true,
      loginBonus: { lastDate: today, claimed: true, streak: 1 },
    };
    Object.entries(fixtures).forEach(([key, value]) => localStorage.setItem(`eg_${key}`, JSON.stringify(value)));
    localStorage.setItem('eg_petLocalMode', 'true');
  }, { ids, level });
  await page.goto(base);
  await page.getByText('Elementary', { exact: true }).click();
  await page.locator('[data-group-id="pet"]').click();
  await page.locator('[data-module-id="pets"]').click();
  for (const width of process.env.QA_CARE_ONLY ? [] : [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : width === 320 ? 568 : 844 });
    const samples = width === 1440 ? ids : ['bunny', 'puppy', 'froggy', 'whale', 'dragon', 'moonlion', 'aurorafox'];
    for (const id of samples) {
      await page.getByRole('combobox', { name: '選擇陪伴夥伴' }).selectOption(id);
      await page.locator('.showcase-center [data-renderer="ready"]').waitFor({ timeout: 30000 });
      assert.equal(await page.locator('.showcase-center .pet-character').getAttribute('data-stage'), getPetStage({level}));
      await page.waitForTimeout(180);
      const overflow = await page.locator('.pet-simple').evaluate(root => root.scrollWidth > root.clientWidth + 2);
      assert(!overflow, `Horizontal overflow: ${width} ${id}`);
      await page.locator('.showcase-center').screenshot({ path: path.join(output, `${width}-${id}.png`) });
      report.push({ width, id, renderer: 'ready', overflow });
    }
  }
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 568 });
    for (const [id, label, action] of [['bunny', '餵食', 'feed'], ['whale', '洗澡', 'clean'], ['moonlion', '休息', 'sleep'], ['phoenix', '玩耍', 'play'], ['seaotter', '讀書', 'study']]) {
      await page.getByRole('combobox', { name: '選擇陪伴夥伴' }).selectOption(id);
      await page.getByRole('button', { name: label, exact: true }).click();
      if (action === 'feed') await page.getByRole('button', { name: '選這份食物：蘋果' }).click();
      await page.locator('.pc-stage [data-renderer="ready"]').waitFor({ timeout: 30000 });
      await page.waitForTimeout(160);
      assert(!(await page.locator('.pet-simple').evaluate(root => root.scrollWidth > root.clientWidth + 2)), `${width} ${action} overflow`);
      await page.locator('.showcase-center').screenshot({ path: path.join(output, `${width}-care-${action}.png`) });
      if (action === 'feed') {
        for (let bite = 0; bite < 3; bite++) {
          // Use the moving mouth target with a real drag, not a synthetic click.
          await page.locator('.pc-food').scrollIntoViewIfNeeded();
          const food = await page.locator('.pc-food').boundingBox(), mouth = await page.locator('.pc-mouth').boundingBox();
          await page.mouse.move(food.x + food.width / 2, food.y + food.height / 2); await page.mouse.down();
          await page.mouse.move(mouth.x + mouth.width / 2, mouth.y + mouth.height / 2, { steps: 10 }); await page.mouse.up();
          assert.equal(await page.locator('.pc-progress progress').getAttribute('value'), String(bite + 1));
        }
      } else if (action === 'clean') {
        for (let n = 1; n <= 4; n++) await page.getByRole('button', { name: `擦洗第 ${n} 處髒污` }).click();
      } else if (action === 'sleep') {
        for (const name of ['調暗小夜燈', '蓋好小被被', '輕聲說晚安']) await page.getByRole('button', { name, exact: true }).click();
        await page.locator('.showcase-center').screenshot({ path: path.join(output, `${width}-care-sleep-finished.png`) });
      } else if (action === 'play') {
        for (let n = 0; n < 3; n++) { await page.getByRole('button', { name: '🎾 丟球給夥伴' }).click(); await page.waitForTimeout(1250); }
      } else {
        for (let n = 0; n < 3; n++) await page.getByRole('button', { name: n < 2 ? '這頁讀好了，翻下一頁' : '這頁讀好了，夾上書籤' }).click();
      }
      // click waits for the parent to receive the care component's completion effect.
      await page.getByTestId('pet-action-complete').click();
      report.push({ width, id, action, completed: true });
    }
  }
  await page.getByRole('button', { name: '向左旋轉寵物' }).click();
  await page.getByRole('button', { name: '向右旋轉寵物' }).click();
  await page.getByRole('button', { name: '重設寵物視角' }).click();
  await page.getByRole('button', { name: '摸摸寵物' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.showcase-center').screenshot({ path: path.join(output, '320-reduced-motion.png') });
  // Exercise the real WebGL loss path; the same original artwork must stay usable.
  await page.locator('.showcase-center canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.locator('[data-renderer="fallback"]').waitFor();
  assert.equal(await page.locator('.pet-character-fallback svg.pet-companion').count(), 1);
  await page.locator('.showcase-center').screenshot({ path: path.join(output, '320-fallback.png') });
  await page.getByRole('button', { name: '摸摸寵物' }).click();
  assert.equal(errors.length, 0, errors.join('\n'));
  if (!process.env.QA_CARE_ONLY) {
  // Contact sheets retain the actual live-scene screenshots for visual review.
  const cards = ids.map(id => `<figure><img src="1440-${id}.png"><figcaption>${id}</figcaption></figure>`).join('');
  await fs.writeFile(path.join(output, 'gallery.html'), `<html><head><link rel="icon" href="data:,"></head><style>body{margin:0;padding:24px;background:#e8e7e2;font:18px sans-serif;display:grid;grid-template-columns:repeat(5,1fr);gap:14px}figure{margin:0;background:#12253b;border-radius:16px;overflow:hidden}img{width:100%;display:block}figcaption{text-align:center;color:#fff4dd;padding:6px}</style>${cards}</html>`);
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto(`${base}/${outputUrl}/gallery.html`);
  await page.screenshot({ path: path.join(output, 'gallery.png'), fullPage: true });
  await fs.writeFile(path.join(output, 'portraits.html'), `<html><head><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import PetCompanion from '/src/components/PetCompanion.jsx';const ids=${JSON.stringify(ids)};createRoot(document.getElementById('root')).render(React.createElement('main',{style:{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:16,background:'#f8f4e8',padding:24}},ids.map(id=>React.createElement('figure',{key:id,style:{textAlign:'center',margin:0}},React.createElement(PetCompanion,{petId:id,stage:${JSON.stringify(getPetStage({level}))},size:160}),React.createElement('figcaption',{},id)))));</script></body></html>`);
  await page.goto(`${base}/${outputUrl}/portraits.html`);
  await page.locator('svg').nth(ids.length - 1).waitFor();
  await page.screenshot({ path: path.join(output, 'portraits.png'), fullPage: true });
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(`${report.length} live model/care checks, rotation, petting, reduced motion and fallback passed${process.env.QA_CARE_ONLY ? '' : '; all portraits rendered'}`);
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, process.env.QA_CARE_ONLY ? 'care-report.json' : 'report.json'), JSON.stringify({ samples: report, errors }, null, 2));
}
