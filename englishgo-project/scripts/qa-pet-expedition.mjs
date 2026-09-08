import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PET_ADVENTURE_QUESTIONS, PET_ADVENTURE_EXTRA_QUESTIONS } from '../src/data/petAdventureQuestions.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/pet-expedition');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true }), report = [];
try {
  for (const width of (process.env.QA_WIDTHS || '1440,390,320').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' }), page = await context.newPage(), errors = [], services = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') (message.location().url.includes('/.netlify/functions/') ? services : errors).push(message.text()); });
    report.push({ width, errors, services });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('expedition-seeded')) return;
      sessionStorage.setItem('expedition-seeded', '1');
      const now = new Date().toISOString();
      const data = { pets: [{ petId: 'bunny', rarity: 'N', level: 3, exp: 0, bond: 150, hunger: 45, clean: 35, energy: 80, lastUpdate: now }, { petId: 'chick', rarity: 'N', level: 2, exp: 0, bond: 50, hunger: 85, clean: 90, energy: 90, lastUpdate: now }, { petId: 'puppy', rarity: 'N', level: 2, exp: 0, bond: 40, hunger: 80, clean: 80, energy: 80, lastUpdate: now }], eggs: [], coins: 100, inv: { apple: 3, fish: 3 }, quiet: true, calm: true };
      for (const [key, value] of Object.entries(data)) localStorage.setItem(`eg_${key}`, JSON.stringify(value));
      localStorage.setItem('eg_petLocalMode', 'true');
      localStorage.setItem('englishgo_expedition_music', 'false');
    });
    const inspect = async name => {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      const data = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, wide: [...document.querySelectorAll('.pet-expedition button,.pet-expedition section,.pet-expedition aside')].filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.left < -2 || rect.right > innerWidth + 2); }).map(element => ({ text: element.textContent.slice(0, 55), class: element.className })), broken: [...document.images].filter(image => image.currentSrc && image.complete && !image.naturalWidth).map(image => image.currentSrc) }));
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true, animations: 'disabled' });
      report.push({ width, name, ...data }); console.log(`${width} ${name}`);
    };
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5194/');
    await page.getByText('Elementary', { exact: true }).click();
    await page.locator('[data-group-id="pet"]').click();
    await page.locator('[data-module-id="petAdventure"]').click();
    await page.getByRole('heading', { name: '和夥伴，走進森林' }).waitFor(); await inspect('team');
    await page.getByRole('button', { name: '幫我選隊' }).click();
    await page.getByRole('button', { name: '選好夥伴，下一步 →' }).click(); await inspect('prepare');
    await page.getByRole('button', { name: '餵食與清潔' }).click(); await inspect('prepared');
    const energy = await page.evaluate(() => JSON.parse(localStorage.getItem('eg_pets'))[0].energy);
    if (energy !== 80) throw new Error('Preparation changed daily energy');
    await page.getByRole('button', { name: '出發，探索森林 →' }).click();
    await page.locator('[data-adventure-question-prompt]').waitFor(); await inspect('battle');
    await page.getByRole('button', { name: '← 返回', exact: true }).click(); await inspect('paused');
    await page.getByRole('button', { name: '保存進度，回樂園' }).click();
    await page.locator('[data-module-id="petAdventure"]').click();
    await page.locator('[data-adventure-question-prompt]').waitFor(); await inspect('restored');
    let answers = 0, camps = 0;
    while (await page.locator('[data-adventure-question-prompt]').count()) {
      if (++answers > 70) throw new Error('Expedition failed to finish');
      const prompt = (await page.locator('[data-adventure-question-prompt]').textContent()).trim();
      const choices = await page.locator('[data-adventure-answers] button>b').allTextContents();
      const question = [...PET_ADVENTURE_QUESTIONS.elementary, ...PET_ADVENTURE_EXTRA_QUESTIONS.elementary].find(item => item.q === prompt && choices.includes(item.choices[item.answer]));
      if (!question) throw new Error(`Unknown question: ${prompt}`);
      const index = choices.indexOf(question.choices[question.answer]);
      await page.locator('[data-adventure-answers] button').nth(index).click();
      if (answers === 1) await inspect('feedback');
      if (await page.getByRole('button', { name: '查看冒險成果 →' }).count()) { await page.getByRole('button', { name: '查看冒險成果 →' }).click(); break; }
      if (await page.getByRole('button', { name: '前往營地補給 →' }).count()) {
        await page.getByRole('button', { name: '前往營地補給 →' }).click(); await inspect(`camp-${++camps}`);
        if (await page.locator('[data-adventure-question]').count()) throw new Error('Battle content overlaps camp');
        await page.locator(`[data-camp-choice="${camps === 1 ? 'focus' : 'guard'}"]`).click();
      } else await page.getByRole('button', { name: '下一題 →', exact: true }).click();
    }
    if (camps !== 2) throw new Error(`Expected two camps, saw ${camps}`);
    await page.getByRole('heading', { name: '一起走完森林了！' }).waitFor(); await inspect('result');
    const finalCoins = await page.evaluate(() => JSON.parse(localStorage.getItem('eg_coins')));
    if (finalCoins <= 100) throw new Error('Winning reward missing');
    await page.reload(); await page.getByRole('heading', { name: '一起走完森林了！' }).waitFor(); await inspect('result-restored');
    if (await page.evaluate(() => JSON.parse(localStorage.getItem('eg_coins'))) !== finalCoins) throw new Error('Result reload replayed rewards');
    await page.getByRole('button', { name: '切換為深色模式' }).click(); await inspect('result-dark');
    await page.getByRole('button', { name: '重新選隊' }).click(); await inspect('team-dark');
    await page.getByRole('button', { name: '選好夥伴，下一步 →' }).click(); await inspect('prepare-dark');
    await page.getByRole('button', { name: '出發，探索森林 →' }).click(); await page.locator('[data-adventure-question-prompt]').waitFor(); await inspect('battle-dark');
    await context.close();
  }
} finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
const issues = report.filter(item => item.overflow || item.wide?.length || item.broken?.length || item.errors?.length);
console.log(JSON.stringify({ screens: report.filter(item => item.name).length, issues }, null, 2));
if (issues.length) process.exitCode = 1;
