import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/pet-playground'); await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true }), report = [];
const names = { apple: '蘋果', banana: '香蕉', fish: '魚', meat: '肉', milk: '牛奶', bread: '麵包', cake: '蛋糕', carrot: '胡蘿蔔' };
const levelNames = ['小小起步', '默契練習', '最佳拍檔'];
try {
  for (const width of (process.env.QA_WIDTHS || '1440,390,320').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' }), page = await context.newPage(), errors = [], services = [];
    page.setDefaultTimeout(15000); report.push({ width, errors, services });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') (message.location().url.includes('/.netlify/functions/') ? services : errors).push(message.text()); });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('playground-qa-seeded')) return;
      sessionStorage.setItem('playground-qa-seeded', '1');
      const now = new Date().toISOString(), today = new Date().toDateString();
      const data = { pets: [{ petId: 'bunny', rarity: 'N', level: 2, exp: 20, bond: 100, hunger: 80, clean: 80, energy: 80, lastUpdate: now }, { petId: 'chick', rarity: 'N', level: 2, exp: 20, bond: 100, hunger: 80, clean: 80, energy: 80, lastUpdate: now }], eggs: [], coins: 100, inv: { apple: 2 }, quiet: true, calm: true, loginBonus: { lastDate: today, streak: 1, claimed: true } };
      Object.entries(data).forEach(([key, value]) => localStorage.setItem(`eg_${key}`, JSON.stringify(value)));
      localStorage.setItem('eg_petLocalMode', 'true');
    });
    const inspect = async name => {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      const data = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, wide: [...document.querySelectorAll('[data-testid="pet-playground"] button,[data-testid="pet-playground"] section,[data-testid="pet-playground"] dialog[open]')].filter(element => { if (element.closest('dialog:not([open])')) return false; const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.left < -2 || rect.right > innerWidth + 2); }).map(element => ({ text: element.textContent.slice(0, 65), class: element.className })), broken: [...document.images].filter(image => image.currentSrc && image.complete && !image.naturalWidth).map(image => image.currentSrc) }));
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true, animations: 'disabled' }); report.push({ width, name, ...data }); console.log(`${width} ${name}`);
    };
    const saved = () => page.evaluate(() => ({ coins: JSON.parse(localStorage.getItem('eg_coins')), pets: JSON.parse(localStorage.getItem('eg_pets')) }));
    const runGame = async (mode, level, { exercise = false, prefix = `${mode}-${level}`, fresh = false } = {}) => {
      const before = await saved();
      await page.getByRole('button', { name: '帶夥伴出發 →' }).click();
      await page.locator('.pet-play-puzzle h2').waitFor(); await inspect(`${prefix}-start`);
      for (let round = 0; round < 3; round++) {
        const hud = await page.locator('.pet-play-hud').textContent();
        if (!hud.includes(`回合 ${round + 1}/3`)) throw new Error(`Incorrect round progress: ${hud}`);
        let route;
        if (mode === 'memory') {
          route = await page.locator('.pet-memory-preview b').allTextContents();
          if (route.length !== level + 1) throw new Error(`Memory level ${level} has ${route.length} sequence items`);
        }
        if (round === 0 && exercise) {
          const beforePause = await page.locator('.pet-play-puzzle').textContent();
          await page.getByRole('button', { name: 'Ⅱ 暫停' }).click();
          await page.getByRole('dialog', { name: '遊戲已暫停' }).waitFor(); await inspect(`${prefix}-pause`);
          if (await page.locator('.pet-play-puzzle').getAttribute('inert') === null) throw new Error('Paused game remains interactive');
          await page.getByRole('button', { name: '繼續一起玩' }).click();
          if (await page.locator('.pet-play-puzzle').textContent() !== beforePause) throw new Error('Pause changed the active question');
        }
        if (mode === 'memory') {
          await page.getByRole('button', { name: '我記住了，開始尋寶' }).click();
          if (await page.locator('.pet-memory-preview').count()) throw new Error('Memory answer sequence remains exposed');
          if (await page.locator('[data-food]').count() !== level + 2) throw new Error('Incorrect memory option count');
          if (round === 0 && exercise) {
            await page.locator(`[data-food]:not([data-food="${route[0]}"])`).first().click();
            if (!(await page.locator('.pet-play-feedback').textContent()).includes('從第一個重新找')) throw new Error('Memory mistake has no retry explanation');
            await inspect(`${prefix}-retry`);
            await page.getByRole('button', { name: '再看一次路線' }).click();
            if (JSON.stringify(await page.locator('.pet-memory-preview b').allTextContents()) !== JSON.stringify(route)) throw new Error('Memory hint changed the original route');
            await inspect(`${prefix}-hint`);
            await page.getByRole('button', { name: '我記住了，開始尋寶' }).click();
          }
          for (const food of route) await page.locator(`[data-food="${food}"]`).click();
        } else {
          if (await page.locator('[data-food]').count() !== level + 2) throw new Error('Incorrect picnic option count');
          const prompt = await page.locator('.pet-play-puzzle h2').textContent(), answer = Object.keys(names).find(key => prompt.includes(`「${names[key]}」`));
          if (!answer) throw new Error(`Unknown picnic prompt: ${prompt}`);
          if (round === 0 && exercise) {
            await page.locator(`[data-food]:not([data-food="${answer}"])`).first().click();
            if (!(await page.locator('.pet-play-feedback').textContent()).includes('再想一想')) throw new Error('Picnic mistake has no retry explanation');
            await inspect(`${prefix}-retry`);
            await page.getByRole('button', { name: '給我一個提示' }).click();
            if (!(await page.locator('.pet-word-hint').textContent()).includes(answer)) throw new Error('Picnic hint does not show its answer');
            await inspect(`${prefix}-hint`);
          }
          await page.locator(`[data-food="${answer}"]`).click();
        }
        if (!(await page.locator('.pet-play-feedback').textContent()).includes('找到了')) throw new Error('Round did not complete');
        if ((await saved()).coins !== before.coins) throw new Error('Rewards were paid before three rounds completed');
        await inspect(`${prefix}-round-${round + 1}`);
        await page.getByRole('button', { name: round === 2 ? '完成野餐，看看成果 →' : '前往下一回合 →' }).click();
      }
      await page.getByRole('heading', { name: '三回合完成！我們做到了' }).waitFor(); await inspect(`${prefix}-result`);
      const after = await saved();
      if (after.coins !== before.coins + (fresh ? 8 : 0)) throw new Error(`Incorrect ${mode}:${level} coin award: ${before.coins} -> ${after.coins}, fresh=${fresh}`);
      for (let index = 0; index < after.pets.length; index++) {
        const old = before.pets[index], pet = after.pets[index];
        if (pet.exp !== old.exp + (fresh ? 18 : 0) || pet.bond !== old.bond + (fresh ? 8 : 0) || pet.energy !== old.energy - (fresh ? 4 : 0)) throw new Error(`Incorrect daily growth for ${pet.petId}, ${mode}:${level}`);
        if (pet.playRecords?.[`${mode}:${level}`] < (exercise ? 2 : 3)) throw new Error('Best star record not saved');
      }
      report.push({ width, verification: `${prefix}-rewards`, beforeCoins: before.coins, afterCoins: after.coins, firstDailyCompletion: fresh, rounds: 3 });
      if (level < 3 && !(await page.getByRole('button', { name: '看看下一關 →' }).isEnabled())) throw new Error('Next level action unavailable');
      return after;
    };
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5194/');
    await page.getByText('Elementary', { exact: true }).click(); await page.locator('[data-group-id="pet"]').click();
    await page.locator('[data-module-id="pets"]').click(); await page.getByTestId('pet-sanctuary').waitFor();
    await page.getByRole('navigation', { name: '家園分頁' }).getByRole('button', { name: /一起出遊/ }).click();
    await page.getByRole('button', { name: '去選遊戲 →' }).click(); await page.getByTestId('pet-playground').waitFor(); await inspect('lobby');
    if (await page.getByRole('button', { name: /默契練習/ }).isEnabled() || await page.getByRole('button', { name: /最佳拍檔/ }).isEnabled()) throw new Error('Later levels are initially unlocked');
    for (const mode of ['picnic', 'memory']) {
      await page.getByRole('button', { name: mode === 'picnic' ? /野餐接力.*看懂/ : /記憶尋寶.*記住/ }).click();
      const levels = width === 390 ? 3 : 1;
      for (let level = 1; level <= levels; level++) {
        if (level > 1) {
          await page.getByRole('button', { name: '看看下一關 →' }).click();
          if (!(await page.getByRole('button', { name: new RegExp(levelNames[level - 1]) }).isEnabled())) throw new Error('Finished stage did not unlock its next stage');
          await inspect(`${mode}-${level}-unlocked`);
        }
        await runGame(mode, level, { exercise: level === 1, fresh: level === 1 });
      }
      await page.getByRole('button', { name: '回遊樂園', exact: true }).click();
      await page.getByRole('button', { name: /小小起步/ }).click();
      await runGame(mode, 1, { prefix: `${mode}-repeat`, fresh: false });
      if (!(await page.locator('.pet-game-earned').textContent()).includes('今天的成長獎勵已領過')) throw new Error('Repeat game lacks clear reward explanation');
      await page.getByRole('button', { name: '回遊樂園', exact: true }).click();
    }
    await page.getByRole('button', { name: '切換為深色模式' }).click(); await inspect('lobby-dark');
    await page.getByRole('button', { name: /小小起步/ }).click();
    await runGame('memory', 1, { prefix: 'memory-dark', exercise: true, fresh: false });
    await context.close();
  }
} finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
const issues = report.filter(row => row.overflow || row.wide?.length || row.broken?.length || row.errors?.length);
console.log(JSON.stringify({ screens: report.filter(row => row.name).length, completedRuns: report.filter(row => row.verification).length, issues }, null, 2));
if (issues.length) process.exitCode = 1;
