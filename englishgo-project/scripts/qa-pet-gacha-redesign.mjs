import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/pet-gacha-redesign');
await fs.mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'msedge', headless: true});
const report = [];
try {
  for (const width of (process.env.QA_WIDTHS || '1440,390,320').split(',').map(Number)) {
    const context = await browser.newContext({viewport: {width, height: 900}, serviceWorkers: 'block'});
    const page = await context.newPage(), errors = [], unavailableServices = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if (message.type() === 'error') (message.location().url.includes('/.netlify/functions/') ? unavailableServices : errors).push(message.text());});
    report.push({width, errors, unavailableServices});
    await page.addInitScript(() => {
      if (sessionStorage.getItem('gacha-qa-seeded')) return;
      sessionStorage.setItem('gacha-qa-seeded', 'true');
      const now = new Date().toISOString(), today = new Date().toDateString();
      const fixtures = {pets: [{petId: 'bunny', rarity: 'N', level: 2, exp: 20, bond: 30, hunger: 80, clean: 80, energy: 80, lastUpdate: now}], eggs: [], coins: 1200, quiet: true, calm: false, petLocalMode: true, loginBonus: {lastDate: today, streak: 1, claimed: true}};
      for (const [key, value] of Object.entries(fixtures)) localStorage.setItem(`eg_${key}`, JSON.stringify(value));
    });
    const inspect = async name => {
      await page.waitForTimeout(120);
      const result = await page.evaluate(() => ({overflow: document.documentElement.scrollWidth > innerWidth + 1, wide: [...document.querySelectorAll('.eg-gacha button,.eg-gacha article,.eg-gacha section')].filter(element => {const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.left < -2 || rect.right > innerWidth + 2);}).map(element => ({text: element.textContent.slice(0, 70), className: element.className})), broken: [...document.images].filter(image => image.currentSrc && image.complete && !image.naturalWidth).map(image => image.currentSrc)}));
      await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
      await page.screenshot({path: path.join(output, `${width}-${name}.png`), fullPage: true, animations: 'disabled'});
      report.push({width, name, ...result});
      console.log(`${width}px ${name}`);
    };
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5194/');
    await page.getByText('Elementary', {exact: true}).click();
    await page.locator('[data-group-id="pet"]').click();
    await page.locator('[data-module-id="gacha"]').click();
    await page.getByTestId('pet-gacha-studio').waitFor();
    await inspect('lobby');
    await page.getByRole('button', {name: '十顆蛋 500 金幣'}).click();
    await inspect('ten-choice');
    await page.getByRole('button', {name: /轉出十顆蛋/}).click();
    await page.getByRole('button', {name: '直接看結果'}).click();
    await page.getByRole('heading', {name: '把這份相遇帶回家'}).waitFor();
    await inspect('ten-result');
    const settlement = await page.evaluate(() => ({coins: JSON.parse(localStorage.getItem('eg_coins')), receipt: JSON.parse(localStorage.getItem('eg_gachaReceipt')), pity: JSON.parse(localStorage.getItem('eg_gachaPity'))}));
    if (settlement.coins !== 700 || settlement.receipt.items.length !== 10 || settlement.pity.total !== 10) throw new Error('Ten-pull settlement is incorrect');
    await page.reload();
    await page.getByRole('heading', {name: '把這份相遇帶回家'}).waitFor();
    await inspect('restored-result');
    if (await page.evaluate(() => JSON.parse(localStorage.getItem('eg_coins'))) !== 700) throw new Error('Restoring a receipt charged again');
    await page.getByRole('button', {name: '收下結果'}).click();
    await inspect('acknowledged');
    await page.getByRole('button', {name: '查看上次結果 →'}).click();
    await page.getByRole('heading', {name: '把這份相遇帶回家'}).waitFor();
    await page.getByRole('button', {name: '收下結果'}).click();
    await page.evaluate(() => localStorage.setItem('eg_coins', '0'));
    await page.reload();
    await page.getByRole('button', {name: /轉出一顆蛋/}).waitFor();
    if (await page.getByRole('button', {name: /轉出一顆蛋/}).isEnabled()) throw new Error('Insufficient balance can still purchase');
    await inspect('insufficient');
    await page.getByRole('button', {name: '切換為深色模式'}).click();
    await page.getByText('機率、保底與重複夥伴的說明', {exact: true}).click();
    await inspect('dark-rules');
    await page.getByRole('button', {name: '去做任務，賺金幣 →'}).click();
    await page.getByTestId('pet-sanctuary').waitFor();
    if (await page.getByRole('navigation', {name: '家園分頁'}).getByRole('button', {name: /每日任務/}).getAttribute('aria-current') !== 'page') {
      const selected = await page.getByRole('navigation', {name: '家園分頁'}).getByRole('button', {name: /每日任務/}).getAttribute('aria-pressed');
      if (selected !== 'true') throw new Error('The earn-coins shortcut did not open tasks');
    }
    await context.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
const issues = report.filter(item => item.overflow || item.wide?.length || item.broken?.length || item.errors?.length);
console.log(JSON.stringify({screens: report.filter(item => item.name).length, issues}, null, 2));
if (issues.length) process.exitCode = 1;
