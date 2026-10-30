import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/pet-simple');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
const dark = Boolean(process.env.QA_DARK);
const sizes = process.env.QA_WIDTHS ? process.env.QA_WIDTHS.split(',').map(Number).map(width => [width, width === 320 ? 568 : width === 568 ? 320 : 844]) : [[1440, 900], [390, 844], [320, 568], [568, 320]];
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, serviceWorkers: 'block' });
    const errors = [], services = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') (message.location().url.includes('/.netlify/functions/') ? services : errors).push(message.text());
    });
    await page.addInitScript(() => {
      const now = new Date().toISOString(), today = new Date().toDateString();
      const pet = { rarity: 'N', level: 2, exp: 0, bond: 180, hunger: 30, clean: 70, energy: 80, lastUpdate: now };
      const fixtures = {
        pets: [{ ...pet, petId: 'bunny' }, { ...pet, petId: 'puppy', bond: 0 }],
        eggs: [{ id: 'ready-chick', petId: 'chick', rarity: 'N', progress: 10, date: now }],
        coins: 100, inv: { apple: 3 }, quiet: true, calm: true,
        petTasks: { date: today, counts: { srsToday: 5, quizToday: 3 } },
        claimedTasks: { date: today, ids: [] }, loginBonus: { lastDate: today, claimed: true, streak: 1 },
      };
      Object.entries(fixtures).forEach(([key, value]) => localStorage.setItem(`eg_${key}`, JSON.stringify(value)));
      localStorage.setItem('eg_petLocalMode', 'true');
    });
    if (dark) await page.addInitScript(() => localStorage.setItem('eg_dark', 'true'));
    const inspect = async name => {
      await page.evaluate(() => document.fonts.ready);
      const data = await page.locator('.pet-simple').evaluate(root => {
        const visible = element => {
          for (let node = element; node && node !== root; node = node.parentElement) {
            if (node.parentElement?.tagName === 'DETAILS' && !node.parentElement.open && node.tagName !== 'SUMMARY') return false;
            const style = getComputedStyle(node);
            if (style.visibility === 'hidden' || style.display === 'none') return false;
          }
          return element.getBoundingClientRect().width > 0;
        };
        return {
          overflow: root.scrollWidth > root.clientWidth + 2,
          wide: [...root.querySelectorAll('button, input, select, article, summary')].filter(visible).filter(element => {
            const rect = element.getBoundingClientRect();
            return rect.left < -2 || rect.right > innerWidth + 2;
          }).map(element => element.textContent.slice(0, 80)),
          broken: [...root.querySelectorAll('img')].filter(image => image.complete && image.currentSrc && !image.naturalWidth).map(image => image.currentSrc),
        };
      });
      report.push({ width, height, name, ...data });
      await page.screenshot({ path: path.join(output, `${width}-${name}${dark ? '-dark' : ''}.png`), animations: 'disabled' });
      assert(!data.overflow && !data.wide.length && !data.broken.length, JSON.stringify({ name, width, ...data }));
    };
    const nav = label => page.getByRole('navigation', { name: '家園分頁' }).getByRole('button', { name: new RegExp(label) }).click();
    const saved = () => page.evaluate(() => ({ pets: JSON.parse(localStorage.getItem('eg_pets')), coins: JSON.parse(localStorage.getItem('eg_coins')), inventory: JSON.parse(localStorage.getItem('eg_inv')) }));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5197');
    await page.getByText('Elementary', { exact: true }).click();
    await page.locator('[data-group-id="pet"]').click();
    await page.locator('[data-module-id="pets"]').click();
    await page.getByTestId('pet-showcase').waitFor();
    await page.locator('.showcase-center [data-renderer="ready"]').waitFor({ timeout: 30000 });
    assert.equal(await page.getByRole('navigation', { name: '家園分頁' }).getByRole('button').count(), 3);
    await inspect('home');
    await page.getByRole('combobox', { name: '選擇陪伴夥伴' }).selectOption('puppy');
    await nav('學習'); await inspect('learning');
    await page.getByRole('button', { name: '一鍵領取 2 份獎勵' }).click();
    assert.equal((await saved()).coins, 142);
    assert.equal((await saved()).pets[0].exp, 30);
    await nav('陪伴');
    assert.equal(await page.getByRole('combobox', { name: '選擇陪伴夥伴' }).inputValue(), 'puppy');
    await page.getByRole('combobox', { name: '選擇陪伴夥伴' }).selectOption('bunny');
    await page.getByRole('button', { name: '餵食', exact: true }).click();
    await inspect('food-choice');
    await page.getByRole('button', { name: '選這份食物：蘋果' }).click();
    await page.getByRole('button', { name: '稍後再做' }).click();
    assert.equal((await saved()).inventory.apple, 3);
    await page.getByRole('button', { name: '餵食', exact: true }).click();
    await page.getByRole('button', { name: '選這份食物：蘋果' }).click();
    await inspect('feeding');
    for (let bite = 0; bite < 3; bite++) {
      await page.getByRole('button', { name: /拿起蘋果|食物拿好了/ }).click();
      await page.getByRole('button', { name: '餵一口' }).click();
    }
    await page.getByTestId('pet-action-complete').click();
    assert.equal((await saved()).inventory.apple, 2);
    assert.equal(Math.round((await saved()).pets[0].hunger), 45);
    await inspect('care-result');
    await page.getByRole('button', { name: '夥伴詳情' }).click();
    await page.getByTestId('pet-growth-panel').waitFor(); await inspect('details');
    await page.getByRole('button', { name: '回去陪夥伴', exact: true }).click();
    await page.getByRole('button', { name: '補給商店', exact: true }).click();
    await inspect('shop');
    await page.getByRole('button', { name: /買 1 份/ }).first().click();
    await page.getByRole('button', { name: '回去陪夥伴', exact: true }).click();
    await nav('收藏'); await inspect('collection');
    await page.getByRole('button', { name: /孵化小屋/ }).click(); await inspect('eggs');
    await page.getByRole('button', { name: '🎉 可以孵化了！點我' }).click();
    await page.getByRole('button', { name: '帶回小家，認識你 →' }).click();
    assert.equal(await page.getByRole('combobox', { name: '選擇陪伴夥伴' }).inputValue(), 'chick');
    await nav('收藏');
    await page.getByRole('button', { name: '夥伴圖鑑', exact: true }).click();
    await page.getByRole('combobox', { name: '收藏狀態' }).selectOption('owned');
    assert.equal(await page.locator('[data-pet-card]').count(), 3); await inspect('dex');
    await nav('學習');
    await page.getByText('想玩一下？一起出遊', { exact: true }).click(); await inspect('activities');
    await page.getByRole('button', { name: '去選遊戲 →' }).click(); await inspect('play-ready');
    await page.getByRole('button', { name: '帶夥伴出發 →' }).click(); await inspect('play-round');
    for (let round = 0; round < 3; round++) {
      const prompt = await page.locator('.pet-play-puzzle h2').innerText();
      await page.locator('[data-food]').filter({ hasText: prompt.match(/「(.+)」/)[1] }).click();
      await page.getByRole('button', { name: round === 2 ? '完成野餐，看看成果 →' : '前往下一回合 →' }).click();
    }
    await inspect('play-result');
    report.push({ width, errors, services });
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`${width}x${height}: home, care, claims, collection, eggs, shop, games passed`);
    await page.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, dark ? 'report-dark.json' : 'report.json'), JSON.stringify(report, null, 2));
}
