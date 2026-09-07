import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/learning-desk'); await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true }), report = [];
const assert = (value, message) => { if (!value) throw new Error(message); };
try {
  for (const width of (process.env.QA_WIDTHS || '1440,390,320').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: width > 900 ? 1000 : 844 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], unavailableServices = [], simulatedApiErrors = [], requests = [];
    let mode = 'success', release;
    report.push({ width, name: 'runtime', errors, unavailableServices, simulatedApiErrors }); page.setDefaultTimeout(18000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') (message.location().url.includes('/.netlify/functions/') ? unavailableServices : message.location().url.includes('generativelanguage.googleapis.com') ? simulatedApiErrors : errors).push(message.text()); });
    await context.route('https://generativelanguage.googleapis.com/**', async route => {
      requests.push(route.request().postDataJSON());
      const requestMode = mode;
      if (requestMode === 'hold') await new Promise(resolve => { release = resolve; });
      try {
        if (requestMode === 'fail') await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 503, message: 'Simulated busy provider' } }) });
        else await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: requestMode === 'hold' ? '這是已取消的舊回答。' : '**apple** 是蘋果。\n例句：An apple falls from the tree.\n一顆蘋果從樹上掉下來。\n小練習：你能用 apple 造一句話嗎？' }] } }] }) });
      } catch { /* An explicitly cancelled request may already be gone. */ }
    });
    await page.addInitScript(() => {
      window.qaVoice = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.qaCopy = text; } } });
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speaking: false, getVoices: () => [], resume() {}, pause() {}, cancel() { this.speaking = false; }, addEventListener() {}, removeEventListener() {}, speak(utterance) { this.speaking = true; window.qaVoice.push({ text: utterance.text, webOnly: utterance.__englishGoWebSpeechOnly === true }); setTimeout(() => { this.speaking = false; utterance.onend?.(); }, 80); } } });
      if (!sessionStorage.getItem('learning-desk-seeded')) { sessionStorage.setItem('learning-desk-seeded', '1'); localStorage.setItem('eg_gemkey', JSON.stringify('qa-stub-key')); localStorage.setItem('eg_quiet', 'true'); localStorage.setItem('eg_calm', 'true'); }
    });
    const click = name => page.getByRole('button', { name, exact: true }).click();
    const open = async module => { await click('回到學習首頁'); await page.locator('[data-group-id="learn"]').click(); await page.locator(`[data-module-id="${module}"]`).click(); await page.locator('.practice-world').waitFor(); };
    const inspect = async name => {
      console.log(`${width}px ${name}`); await page.waitForTimeout(120);
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
        wide: [...document.querySelectorAll('main button,main input,main textarea,main section')].filter(element => { const r = element.getBoundingClientRect(); return r.width && (r.left < -2 || r.right > innerWidth + 2); }).map(element => element.textContent.slice(0, 70)),
        brokenImages: [...document.images].filter(img => img.currentSrc && img.complete && !img.naturalWidth).map(img => img.currentSrc) }));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true, animations: 'disabled' }); report.push({ width, name, ...layout });
    };
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5192/'); await page.getByText('Elementary', { exact: true }).click();
    await open('wordsearch'); await inspect('explorer-empty'); const query = page.getByRole('textbox', { name: '查詢英文或中文單字', exact: true });
    await query.fill('apple'); await click('搜尋'); await click('看看 apple 的意思與例句'); await inspect('explorer-details');
    await click('♫ 聽單字'); await page.waitForFunction(() => window.qaVoice.some(item => item.text === 'apple'));
    assert(await page.evaluate(() => window.qaVoice.filter(item => item.text === 'apple').every(item => item.webOnly)), 'Dictionary audio did not use Web Speech only');
    await click('大字閱讀'); await click('收藏這個字'); await page.reload(); await page.getByRole('button', { name: '大字閱讀', exact: true }).waitFor();
    assert(await page.getByRole('button', { name: '大字閱讀', exact: true }).getAttribute('aria-pressed') === 'true', 'Reading size was lost'); await inspect('explorer-restored');
    await click('我的收藏 · 1'); await inspect('explorer-collection'); await click('移出收藏 apple'); await click('還原收藏');
    const xpBefore = await page.evaluate(() => localStorage.getItem('eg_xp')); await click('用收藏練 5 張單字卡'); await page.getByTestId('srs-card').waitFor(); await inspect('explorer-srs');
    assert(await page.evaluate(() => localStorage.getItem('eg_xp')) === xpBefore, 'Opening a collection granted XP'); await page.goBack(); await page.locator('.word-explorer').waitFor();
    await click('找單字'); await query.fill('zxqvnothing'); await click('搜尋'); await page.getByRole('heading', { name: '還沒找到這個單字', exact: true }).waitFor(); await inspect('explorer-no-results');
    await click('試試 apple'); await click('看看 apple 的意思與例句'); await click('收起說明');
    await query.fill('e'); await click('搜尋'); await page.getByRole('button', { name: '下一頁', exact: true }).waitFor(); await click('下一頁'); await inspect('explorer-pagination');
    await click('小學'); await inspect('explorer-grade-scope');
    await open('ai'); await inspect('tutor-empty'); const input = page.getByRole('textbox', { name: '想問什麼，或想試著回答什麼？', exact: true });
    await page.locator('.tutor-starter-grid button').filter({ hasText: '短句上手' }).click(); assert(requests.length === 0, 'A starter sent a request without preview'); await inspect('tutor-prompt-preview');
    await input.press('Enter'); assert(requests.length === 0, 'Plain Enter sent the draft'); await input.fill('我想學 apple 的用法'); await click('送出問題 →');
    await page.locator('.tutor-transcript').getByText('是蘋果。', { exact: false }).waitFor(); await inspect('tutor-answer');
    await click('複製回答'); assert((await page.evaluate(() => window.qaCopy)).includes('apple'), 'Copy action lost answer'); await click('收藏這段回答');
    await input.fill('這是下一個還沒送出的問題'); await page.reload(); await page.locator('.tutor-studio').waitFor(); assert(await input.inputValue() === '這是下一個還沒送出的問題', 'Next draft lost after reload');
    assert(requests.length === 1, 'Reload resent the question'); await inspect('tutor-restored');
    await page.getByText('更多練習主題', { exact: true }).click(); await click('餐廳點餐'); assert((await input.inputValue()).includes('店員'), 'Scenario prompt missing'); await click('復原剛才輸入'); assert(await input.inputValue() === '這是下一個還沒送出的問題', 'Prompt replacement cannot be undone'); await inspect('tutor-more-topics');
    await click('開一本新練習簿'); mode = 'fail'; await input.fill('這次測試失敗重試'); await click('送出問題 →'); await page.getByRole('button', { name: '重試這個問題', exact: true }).waitFor(); await inspect('tutor-retry');
    const failures = requests.length; mode = 'success'; await click('重試這個問題'); await page.locator('.tutor-transcript').getByText('是蘋果。', { exact: false }).waitFor();
    assert(requests[failures].contents.length === 1, 'Retry included provider error text or duplicate question'); await inspect('tutor-retry-complete');
    await click('開一本新練習簿'); mode = 'hold'; await input.fill('等候中的問題'); await click('送出問題 →'); await page.getByRole('button', { name: '停止回答', exact: true }).waitFor();
    await page.waitForTimeout(100); await click('停止回答'); release?.(); await page.waitForTimeout(200); assert(await page.getByText('這是已取消的舊回答。', { exact: true }).count() === 0, 'Cancelled answer appeared'); await inspect('tutor-stopped');
    mode = 'success'; await page.getByText('我的練習簿 · 3 / 8', { exact: true }).click(); await click('移除練習簿 等候中的問題'); await click('還原剛才移除'); await inspect('tutor-workbooks');
    await page.getByText('我的重點收藏 · 1 / 24', { exact: true }).click(); await page.locator('.tutor-collection').getByText('我想學 apple 的用法', { exact: true }).click(); await inspect('tutor-saved-answer');
    await click('移除這段收藏'); await click('還原剛才移除'); await click('切換為深色模式'); await inspect('tutor-dark'); await open('wordsearch'); await inspect('explorer-dark');
    await context.close();
  }
  for (const [level, label] of [['junior', 'Junior High'], ['senior', 'Senior High']]) {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 }, serviceWorkers: 'block' }), page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message)); await page.goto(process.env.QA_URL || 'http://127.0.0.1:5192/'); await page.getByText(label, { exact: true }).click();
    for (const module of ['wordsearch', 'ai']) {
      await page.getByRole('button', { name: '回到學習首頁', exact: true }).click(); await page.locator('[data-group-id="learn"]').click(); await page.locator(`[data-module-id="${module}"]`).click(); await page.locator('.practice-world').waitFor();
      if (module === 'ai') { await page.getByRole('button', { name: '請大人設定 AI', exact: true }).waitFor(); await page.getByRole('textbox', { name: '想問什麼，或想試著回答什麼？', exact: true }).fill('先保存這個問題'); await page.reload(); assert(await page.getByRole('textbox', { name: '想問什麼，或想試著回答什麼？', exact: true }).inputValue() === '先保存這個問題', 'Keyless draft lost'); }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.screenshot({ path: path.join(output, `${level}-${module}.png`), fullPage: true, animations: 'disabled' }); report.push({ level, module, overflow, errors });
    }
    await page.getByRole('button', { name: '先練現有句型', exact: true }).click(); await page.getByRole('heading', { name: '句型，一步一步就會了', exact: true }).waitFor(); report.push({ level, name: 'keyless-grammar-link', errors }); await context.close();
  }
} catch (error) { report.push({ error: error.stack }); throw error; }
finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
const failures = report.filter(row => row.error || row.overflow || row.wide?.length || row.brokenImages?.length || row.errors?.length);
console.log(JSON.stringify({ checks: report.length, failures }, null, 2)); if (failures.length) process.exitCode = 1;
