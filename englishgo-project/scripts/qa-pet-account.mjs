import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/pet-account');
await fs.mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'msedge', headless: true});
const report = [];
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({viewport: {width, height: 900}, serviceWorkers: 'block'});
    const page = await context.newPage(), errors = [], blockedAccountRequests = [];
    page.setDefaultTimeout(15000);
    await context.route('**/rest/v1/pet_users**', route => {blockedAccountRequests.push({method: route.request().method(), path: new URL(route.request().url()).pathname}); return route.abort();});
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    report.push({width, errors, blockedAccountRequests});
    await page.addInitScript(() => {
      if (sessionStorage.getItem('pet-account-qa-seeded')) return;
      sessionStorage.setItem('pet-account-qa-seeded', 'true');
      const now = new Date().toISOString(), today = new Date().toDateString();
      const fixtures = {pets: [{petId: 'bunny', rarity: 'N', level: 2, exp: 20, bond: 30, hunger: 80, clean: 80, energy: 80, lastUpdate: now}], eggs: [], coins: 120, inv: {apple: 3}, quiet: true, calm: true, loginBonus: {lastDate: today, streak: 1, claimed: true}};
      for (const [key, value] of Object.entries(fixtures)) localStorage.setItem(`eg_${key}`, JSON.stringify(value));
    });
    const inspect = async name => {
      await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
      await page.waitForTimeout(100);
      const result = await page.evaluate(() => ({overflow: document.documentElement.scrollWidth > innerWidth + 1, wide: [...document.querySelectorAll('.pet-access button,.pet-access input,.pet-access section,.pet-sanctuary fieldset')].filter(element => {const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.left < -2 || rect.right > innerWidth + 2);}).map(element => ({text: element.textContent.slice(0, 70), className: element.className})), broken: [...document.images].filter(image => image.currentSrc && image.complete && !image.naturalWidth).map(image => image.currentSrc)}));
      await page.screenshot({path: path.join(output, `${width}-${name}.png`), fullPage: true, animations: 'disabled'});
      report.push({width, name, ...result}); console.log(`${width}px ${name}`);
    };
    const back = () => page.getByRole('button', {name: '← 返回', exact: true}).click();
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5194/');
    await page.getByText('Elementary', {exact: true}).click();
    await page.locator('[data-group-id="pet"]').click();
    await page.locator('[data-module-id="pets"]').click();
    await page.getByRole('heading', {name: '歡迎來到寵物樂園！'}).waitFor();
    await inspect('welcome');
    await page.getByRole('button', {name: '登入小帳號', exact: true}).click();
    await inspect('login-empty');
    await page.getByLabel('暱稱', {exact: true}).fill('畫面檢查');
    await page.getByLabel('PIN', {exact: true}).fill('123');
    await page.getByRole('button', {name: '🔑 登入', exact: true}).click();
    await page.getByText('❌ 請輸入 4–6 位數字 PIN', {exact: true}).waitFor();
    await inspect('login-invalid-pin');
    await back();
    await page.getByRole('button', {name: '建立小帳號', exact: true}).click();
    await inspect('signup');
    await back();
    await page.getByRole('button', {name: '先在這台裝置養寵物 →', exact: true}).click();
    await page.getByTestId('pet-sanctuary').waitFor();
    await inspect('back-local');
    await page.getByRole('button', {name: '設定', exact: true}).click();
    await inspect('settings');
    await page.getByRole('button', {name: '登入或建立雲端小帳號', exact: true}).click();
    await page.getByRole('heading', {name: '歡迎來到寵物樂園！'}).waitFor();
    await inspect('account-from-settings');
    if (width < 500) {
      await page.getByRole('button', {name: '切換為深色模式', exact: true}).click();
      await page.getByRole('button', {name: '登入小帳號', exact: true}).click();
      await inspect('login-dark');
      await back();
      await page.getByRole('button', {name: '建立小帳號', exact: true}).click();
      await inspect('signup-dark');
      await back();
    }
    await page.getByRole('button', {name: '先在這台裝置養寵物 →', exact: true}).click();
    await page.getByTestId('pet-sanctuary').waitFor();
    const saved = await page.evaluate(() => ({pets: JSON.parse(localStorage.getItem('eg_pets')), eggs: JSON.parse(localStorage.getItem('eg_eggs')), coins: JSON.parse(localStorage.getItem('eg_coins')), inventory: JSON.parse(localStorage.getItem('eg_inv')), account: JSON.parse(localStorage.getItem('eg_petAcc') || 'null')}));
    if (saved.pets.length !== 1 || saved.pets[0].petId !== 'bunny' || saved.eggs.length || saved.coins !== 120 || saved.inventory.apple !== 3 || saved.account) throw new Error('The account navigation changed local assets');
    await context.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
const issues = report.filter(item => item.overflow || item.wide?.length || item.broken?.length || item.errors?.length || item.blockedAccountRequests?.length);
console.log(JSON.stringify({screens: report.filter(item => item.name).length, issues}, null, 2));
if (issues.length) process.exitCode = 1;
