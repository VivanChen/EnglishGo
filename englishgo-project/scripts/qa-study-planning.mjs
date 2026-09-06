import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/study-planning');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true }), report = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
try {
  for (const width of (process.env.QA_WIDTHS || '1440,390,320').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: width > 900 ? 1000 : 844 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], unavailableServices = [];
    report.push({ width, name: 'runtime', errors, unavailableServices }); page.setDefaultTimeout(18000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') (m.location().url.includes('/.netlify/functions/') ? unavailableServices : errors).push(m.text()); });
    await context.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ words: ['orange', 'school', 'happy', 'water', 'run'] }) }] } }] }) }));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.qaCopied = text; } } });
      if (sessionStorage.getItem('qa-study-seeded')) return;
      sessionStorage.setItem('qa-study-seeded', '1');
      const today = new Date(), yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
      const values = { quiet: true, calm: true, xp: 120, coins: 200, streak: 2, daily: { date: today.toDateString(), done: 4, target: 10 },
        hist: [{ date: yesterday.toDateString(), done: 3, target: 10 }, { date: yesterday.toDateString(), done: 2, target: 10 }],
        stats: { srsRounds: 2, perfectQuiz: 0, dictDone: 1, scramDone: 2 }, ach: ['first_card', 'xp100'], gemkey: 'qa-stub-key',
        weak: [{ w: 'apple', m: '蘋果', level: 'elementary', n: 3 }, { w: 'book', m: '書', level: 'elementary', n: 2 }, { w: 'station', m: '車站', level: 'junior', n: 9 }] };
      for (const [key, value] of Object.entries(values)) localStorage.setItem(`eg_${key}`, JSON.stringify(value));
    });
    const click = name => page.getByRole('button', { name, exact: true }).click();
    const inspect = async name => {
      console.log(`${width}px ${name}`); await page.waitForTimeout(100);
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
        wide: [...document.querySelectorAll('main button,main input,main textarea,main section')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.left < -2 || r.right > innerWidth + 2); }).map(e => e.textContent.slice(0, 70)),
        brokenImages: [...document.images].filter(i => i.currentSrc && i.complete && !i.naturalWidth).map(i => i.currentSrc) }));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true, animations: 'disabled' }); report.push({ width, name, ...layout });
    };
    const open = async (group, module) => { await click('回到學習首頁'); await page.locator(`[data-group-id="${group}"]`).click(); await page.locator(`[data-module-id="${module}"]`).click(); await page.locator('.practice-world').waitFor(); };
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('eg_exam_planner_elementary')));
    const xp = () => page.evaluate(() => localStorage.getItem('eg_xp'));
    await page.goto(process.env.QA_URL || 'http://localhost:5190/'); await page.getByText('Elementary', { exact: true }).click();
    await open('tools', 'dashboard'); await inspect('journal-today');
    await page.getByRole('button', { name: /今天，4 步$/ }).waitFor();
    assert(await page.locator('.journal-word-chips').innerText() === 'apple\nbook', 'Journal included a different grade');
    await page.getByRole('button', { name: /，3 步$/ }).click(); await inspect('journal-history');
    await page.getByText('把進步給家人看看', { exact: true }).click(); await click('複製學習紀錄');
    await page.getByText('已複製，可以貼給家人看。', { exact: true }).waitFor();
    assert((await page.evaluate(() => window.qaCopied)).includes('今天的小目標：4 / 10 步'), 'Copied report omitted live progress'); await inspect('journal-sharing');
    await click('看看複習清單'); await page.getByRole('heading', { name: '陪還不熟的單字長大', exact: true }).waitFor(); await inspect('journal-review-link');
    await open('tools', 'achievements'); await inspect('badges-all'); await click('已收藏 · 2'); await inspect('badges-collected');
    await click('經驗滿載，已收藏'); await click('展示這枚徽章');
    assert(await page.evaluate(() => JSON.parse(localStorage.getItem('eg_featured_badge'))) === 'xp100', 'Badge pin not saved');
    await inspect('badge-pinned'); await page.reload(); await page.locator('.badge-featured').getByText('經驗滿載', { exact: true }).waitFor();
    await click('還在路上 · 6'); await click('零失誤，還差 1 次'); await inspect('badge-goal'); await click('試試單字小測驗');
    await page.getByRole('heading', { name: '選一選，讓單字留下來', exact: true }).waitFor(); await inspect('badge-quiz-link');
    await open('tools', 'dashboard'); await page.locator('.journal-next-grid').getByText('⭐ 經驗滿載', { exact: true }).waitFor();
    await click('準備考試範圍'); await page.locator('.exam-planner').waitFor(); await inspect('exam-empty');
    const draft = page.getByRole('textbox', { name: '這次要練的英文單字', exact: true });
    await draft.fill('apple book cat dog sun school unknownzz apple'); await inspect('exam-draft'); const beforeXp = await xp();
    await click('先確認單字與字義 →'); await page.getByRole('heading', { name: '這次想練哪幾個？', exact: true }).waitFor();
    assert(await page.getByRole('checkbox', { name: /unknownzz/ }).isDisabled(), 'Unknown word was allowed without meaning'); await inspect('exam-review-missing');
    await page.getByRole('textbox', { name: '請大人幫忙填寫「unknownzz」的字義', exact: true }).fill('待確認的練習字'); await click('存下 unknownzz 的字義');
    await page.getByRole('checkbox', { name: /^book/ }).uncheck(); await page.getByRole('textbox', { name: '範圍名稱', exact: true }).fill('星期五小考'); await click('收藏這份範圍');
    await inspect('exam-reviewed'); await page.reload(); await click('繼續上次整理 →');
    assert(!await page.getByRole('checkbox', { name: /^book/ }).isChecked(), 'Exam selection was lost on reload');
    assert(await page.getByRole('checkbox', { name: /unknownzz/ }).isChecked(), 'Adult-supplied meaning was lost');
    await click('準備另一份範圍'); await click('還原'); await click('繼續上次整理 →');
    assert(!await page.getByRole('checkbox', { name: /^book/ }).isChecked(), 'Undo lost reviewed selection'); await inspect('exam-undo-draft');
    assert(await xp() === beforeXp, 'Preparing a range granted XP'); await click('開始這輪複習'); await page.getByTestId('srs-card').waitFor(); await inspect('exam-srs');
    assert(await xp() === beforeXp, 'Starting a range granted XP');
    const routeState = await page.evaluate(() => history.state);
    assert(routeState.customDeck?.cards?.length === 5 || JSON.stringify(routeState).includes('考試範圍 (5字)'), `Exam did not launch five cards: ${JSON.stringify(routeState)}`);
    await page.goBack(); await page.locator('.exam-planner').waitFor(); await click('繼續上次整理 →'); await inspect('exam-back-restored');
    await click('回去修改範圍'); await page.getByText('已收藏的範圍 · 1 / 12', { exact: true }).click(); await click('移除收藏 星期五小考'); await click('還原');
    await click('更新這份收藏'); assert((await saved()).lists.length === 1, 'Undo duplicated a saved range');
    await click('清空範圍'); await click('還原'); await click('繼續上次整理 →'); await click('回去修改範圍');
    await page.getByText('還沒有範圍？看看 AI 單字建議', { exact: true }).click(); const beforeAI = await draft.inputValue();
    await click('AI 產生單字'); await page.getByRole('button', { name: '加入目前範圍', exact: true }).waitFor(); assert(await draft.inputValue() === beforeAI, 'AI overwrote original draft'); await inspect('exam-ai-preview');
    await click('加入目前範圍'); assert((await draft.inputValue()).includes('unknownzz') && (await draft.inputValue()).includes('orange'), 'AI append discarded original content'); await inspect('exam-ai-applied');
    const oversized = Array.from({ length: 85 }, (_, n) => `word${String.fromCharCode(97 + Math.floor(n / 26))}${String.fromCharCode(97 + n % 26)}`);
    await draft.fill(oversized.join(' ')); await page.getByText(/還有 5 個超過本份上限/).waitFor(); await click(`移除 ${oversized[0]}`);
    assert((await draft.inputValue()).split(' ').length === 84, 'Removing a chip discarded overflow words'); await inspect('exam-overflow-preserved');
    await draft.fill(beforeAI); await click('先確認單字與字義 →'); await page.getByRole('heading', { name: '這次想練哪幾個？', exact: true }).waitFor();
    await click('切換為深色模式'); await inspect('exam-dark'); await open('tools', 'dashboard'); await inspect('journal-dark'); await open('tools', 'achievements'); await inspect('badges-dark');
    await context.close();
  }
  for (const [level, label] of [['junior', 'Junior High'], ['senior', 'Senior High']]) {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 }, serviceWorkers: 'block' }); const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); await page.addInitScript(() => { localStorage.setItem('eg_quiet', 'true'); localStorage.setItem('eg_calm', 'true'); });
    await page.goto(process.env.QA_URL || 'http://localhost:5190/'); await page.getByText(label, { exact: true }).click();
    for (const [group, module] of [['tools', 'dashboard'], ['tools', 'achievements'], ['learn', 'exam']]) {
      await page.getByRole('button', { name: '回到學習首頁', exact: true }).click(); await page.locator(`[data-group-id="${group}"]`).click(); await page.locator(`[data-module-id="${module}"]`).click(); await page.locator('.practice-world').waitFor();
      if (module === 'dashboard') await page.getByRole('button', { name: /今天，0 步$/ }).waitFor();
      if (module === 'achievements') { await page.getByRole('button', { name: '已收藏 · 0', exact: true }).click(); await page.getByRole('heading', { name: '第一枚徽章正在等你', exact: true }).waitFor(); }
      if (module === 'exam') { await page.getByText('還沒有範圍？看看 AI 單字建議', { exact: true }).click(); const options = await page.getByTestId('exam-ai-term').locator('option').evaluateAll(items => items.map(i => i.value)); assert(options.length === 6 && options.every(id => id.startsWith(level)), 'Exam terms included another grade'); }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(output, `${level}-${module}.png`), fullPage: true, animations: 'disabled' }); report.push({ level, module, overflow, errors });
    }
    await context.close();
  }
} catch (error) { report.push({ error: error.stack }); throw error; }
finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
const failures = report.filter(row => row.error || row.overflow || row.wide?.length || row.brokenImages?.length || row.errors?.length);
console.log(JSON.stringify({ checks: report.length, failures }, null, 2)); if (failures.length) process.exitCode = 1;
