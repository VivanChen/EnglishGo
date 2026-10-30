import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { getPetStage } from '../src/data/petAppearance.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/pet-growth');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const base = process.env.QA_URL || 'http://127.0.0.1:5197', report = [], errors = [];
try {
  for (const width of process.env.QA_WIDTHS ? process.env.QA_WIDTHS.split(',').map(Number) : [1440, 320]) for (const level of [3, 9]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1440 ? 900 : 568 }, serviceWorkers: 'block' });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.location().url.includes('/.netlify/functions/')) errors.push(message.text()); });
    await page.addInitScript(level => {
      const now = new Date().toISOString();
      const fixtures = {
        pets: [{ petId: 'bunny', rarity: 'N', level, exp: level * 100 - 10, bond: 180, hunger: 80, clean: 80, energy: 80, lastUpdate: now }],
        coins: 100, inv: { apple: 3 }, quiet: true, calm: true,
        loginBonus: { lastDate: new Date().toDateString(), claimed: true, streak: 1 },
      };
      Object.entries(fixtures).forEach(([key, value]) => localStorage.setItem(`eg_${key}`, JSON.stringify(value)));
      localStorage.setItem('eg_petLocalMode', 'true');
    }, level);
    if (process.env.QA_DARK) await page.addInitScript(() => localStorage.setItem('eg_dark', 'true'));
    await page.goto(base);
    await page.getByText('Elementary', { exact: true }).click();
    await page.locator('[data-group-id="pet"]').click();
    await page.locator('[data-module-id="pets"]').click();
    const before = getPetStage({ level }), after = getPetStage({ level: level + 1 });
    await page.locator(`.pet-character[data-stage="${before}"][data-renderer="ready"]`).waitFor();
    await page.waitForTimeout(150);
    await page.locator('.showcase-center').screenshot({ path: path.join(output, `${width}-${level===3?before:'before-evolution'}.png`) });
    await page.getByRole('button', { name: '讀書', exact: true }).click();
    await page.locator(`.pc-stage .pet-character[data-stage="${before}"][data-renderer="ready"]`).waitFor();
    for (let n = 0; n < 3; n++) await page.getByRole('button', { name: n < 2 ? '這頁讀好了，翻下一頁' : '這頁讀好了，夾上書籤' }).click();
    await page.getByTestId('pet-action-complete').click();
    await page.locator(`.pet-character[data-stage="${after}"][data-renderer="ready"]`).waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('eg_pets'))[0].level), level + 1);
    await page.waitForTimeout(150);
    await page.locator('.showcase-center').screenshot({ path: path.join(output, `${width}-${after}.png`) });
    await page.getByRole('button', { name: '夥伴詳情' }).click();
    const looks = page.getByRole('region', { name: '外觀成長' });
    assert.equal(await looks.locator('figure[aria-current] svg').getAttribute('data-stage'), after);
    assert.equal(await looks.getByRole('img').count(), 3);
    assert(!(await page.locator('.pet-simple').evaluate(root => root.scrollWidth > root.clientWidth + 2)), 'Growth panel overflows');
    await looks.screenshot({ path: path.join(output, `${width}-${after}-growth.png`) });
    await page.getByRole('button', { name: '回去陪夥伴', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '摸摸寵物' }).click();
    await page.locator('.showcase-center').screenshot({ path: path.join(output, `${width}-${after}-smile.png`) });
    await page.locator('.showcase-center canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.locator('[data-renderer="fallback"]').waitFor();
    assert.equal(await page.locator('.pet-character-fallback svg').getAttribute('data-stage'), after);
    await page.getByRole('navigation', { name: '家園分頁' }).getByRole('button', { name: '收藏' }).click();
    assert.equal(await page.locator('[data-pet-card] svg').getAttribute('data-stage'), after);
    report.push({ width, levelBefore: level, levelAfter: level + 1, stage: after, care: 'passed', fallback: 'passed', collection: 'passed' });
    await page.close();
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  const gallery = await browser.newPage({ viewport: { width: 1050, height: 550 } });
  await gallery.setContent(`<html><style>body{margin:0;padding:20px;background:#f4eee2;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;font:16px sans-serif}figure{margin:0;text-align:center}img{width:100%;border-radius:20px}figcaption{padding-top:10px;color:#495342}</style>${[['baby','幼寵'],['adult','Lv.4 · 成寵領巾'],['evolved','Lv.10 · 進化星章']].map(([stage,label])=>`<figure><img src="${base}/.superpowers/qa/pet-growth/320-${stage}.png"><figcaption>${label}</figcaption></figure>`).join('')}</html>`);
  await gallery.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await gallery.screenshot({ path: path.join(output, 'growth-preview.png'), fullPage: true });
  console.log(`Growth transitions passed at ${[...new Set(report.map(item => item.width))].join(', ')} px, including care, collection, reduced motion and fallback.`);
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, process.env.QA_DARK ? 'growth-dark-report.json' : 'growth-report.json'), JSON.stringify({ report, errors }, null, 2));
}
