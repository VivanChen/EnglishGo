import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/practice');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true }), results = [];
try {
  for (const width of (process.env.QA_WIDTHS || '1440,390,320').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: width > 900 ? 1000 : 844 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], unavailableServices = [];
    page.setDefaultTimeout(15000);
    results.push({ width, errors, unavailableServices });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      (message.location().url.includes('/.netlify/functions/') ? unavailableServices : errors).push(message.text());
    });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('practice-qa-seeded')) return;
      sessionStorage.setItem('practice-qa-seeded', 'true');
      localStorage.setItem('eg_quiet', 'true'); localStorage.setItem('eg_calm', 'true');
      localStorage.setItem('eg_weak', JSON.stringify([{ w: 'apple', n: 4, level: 'elementary' }, { w: 'dog', n: 3, level: 'elementary' }, { w: 'book', n: 2, level: 'elementary' }, { w: 'unlistedword', n: 1, level: 'elementary' }, { w: 'station', n: 4, level: 'junior' }]));
    });
    const inspect = async name => {
      console.log(`${width}px ${name}`); await page.waitForTimeout(200);
      const data = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        wide: [...document.querySelectorAll('main button,main input,main textarea,main section')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.left < -2 || r.right > innerWidth + 2); }).map(e => e.textContent.slice(0, 90)),
        brokenImages: [...document.images].filter(i => i.currentSrc && i.complete && !i.naturalWidth).map(i => i.currentSrc),
      }));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true, animations: 'disabled' });
      results.push({ width, name, ...data });
    };
    const open = async (group, id) => { await page.getByRole('button', { name: '回到學習首頁' }).click(); await page.locator(`[data-group-id="${group}"]`).click(); await page.locator(`[data-module-id="${id}"]`).click(); await page.locator('.practice-world').waitFor(); };
    const read = kind => page.evaluate(kind => JSON.parse(localStorage.getItem(`eg_practice_${kind}_elementary`)), kind);
    const xp = () => page.evaluate(() => Number(localStorage.getItem('eg_xp') || 0));
    const start = () => page.getByRole('button', { name: '開始新的小任務 →' }).click();
    const next = () => page.getByRole('button', { name: /下一題|看看這次的收穫/ }).click();
    const quizAnswer = async correct => {
      const state = await read('quiz'), question = state.questions[state.queue[state.index]];
      const option = correct ? question.answer : question.options.find(o => o !== question.answer);
      await page.locator('.practice-answer-options').getByText(option, { exact: true }).click();
    };
    await page.goto(process.env.QA_URL || 'http://localhost:5190/');
    await page.getByText('Elementary', { exact: true }).click();
    await open('learn', 'quiz'); await inspect('quiz-lobby'); await start(); await inspect('quiz-question');
    await quizAnswer(false); await inspect('quiz-retry'); await page.getByRole('button', { name: '再試一次', exact: true }).click(); await quizAnswer(true);
    const paid = await xp();
    await page.reload(); await page.getByRole('button', { name: '繼續上次練習' }).click();
    if (await xp() !== paid) throw new Error('Reload repeated quiz reward');
    await inspect('quiz-restored'); await next();
    for (let i = 1; i < 5; i++) { await quizAnswer(true); await next(); }
    await inspect('quiz-results'); const quizXp = await xp();
    await page.getByRole('button', { name: '只練需要再看的 1 題' }).click(); await quizAnswer(true); await next();
    if (await xp() !== quizXp) throw new Error('Quiz review repeated reward');
    await inspect('quiz-targeted-review');
    await page.getByRole('button', { name: '用單字卡慢慢複習 →' }).click(); await page.getByTestId('srs-card').waitFor(); await inspect('quiz-to-cards');
    if (width === 390) {
      for (const mode of ['看中文，選英文', '兩種交替練習']) {
        await open('learn', 'quiz'); await page.getByRole('button', { name: mode, exact: true }).click(); await start(); await quizAnswer(true); await inspect(mode === '看中文，選英文' ? 'quiz-reverse' : 'quiz-mixed');
      }
    }
    await open('read', 'dictation'); await inspect('listening-lobby'); await start(); await inspect('listening-tiles');
    await page.getByRole('button', { name: '▶ 聽這個句子' }).click(); await page.getByRole('button', { name: 'Ⅱ 先休息一下' }).click(); await inspect('listening-paused'); await page.getByRole('button', { name: '繼續上次練習' }).click();
    for (let i = 0; i < 3; i++) {
      const state = await read('listening'), question = state.questions[state.queue[state.index]], tiles = [...question.tiles].sort((a, b) => a.id - b.id);
      if (i === 0) { await page.getByRole('button', { name: '看句子提示', exact: true }).click(); await inspect('listening-hint'); }
      for (const tile of tiles) await page.locator('.practice-tile-bank button').nth(question.tiles.findIndex(t => t.id === tile.id)).click();
      await page.getByRole('button', { name: '看看我的答案' }).click();
      if (i === 0) await inspect('listening-answer'); await next();
    }
    await inspect('listening-results'); const listeningXp = await xp();
    await page.getByRole('button', { name: '只練需要再看的 1 題' }).click();
    const replay = await read('listening');
    for (const tile of [...replay.questions[replay.queue[0]].tiles].sort((a, b) => a.id - b.id)) await page.locator('.practice-tile-bank button').nth(replay.questions[replay.queue[0]].tiles.findIndex(t => t.id === tile.id)).click();
    await page.getByRole('button', { name: '看看我的答案' }).click(); await next();
    if (await xp() !== listeningXp) throw new Error('Listening review repeated reward');
    await page.getByRole('button', { name: '換個小任務' }).click(); await page.getByRole('button', { name: '自己打字挑戰' }).click(); await start();
    await page.getByRole('textbox', { name: '你聽到了什麼？' }).fill('I heard something'); await page.reload();
    await page.getByRole('button', { name: '繼續上次練習' }).click();
    if (await page.getByRole('textbox').inputValue() !== 'I heard something') throw new Error('Typed answer not restored');
    const typing = await read('listening'), sentence = typing.questions[0].answer;
    await page.getByRole('textbox').fill(sentence.split(' ').slice(1).join(' '));
    await page.getByRole('button', { name: '看看我的答案' }).click(); await inspect('listening-word-feedback');
    await page.getByRole('button', { name: '再試一次', exact: true }).click(); await page.getByRole('textbox').fill(sentence.toUpperCase().replaceAll(' ', '   '));
    await page.getByRole('button', { name: '看看我的答案' }).click(); await inspect('listening-typing-correct');
    await page.getByRole('button', { name: '切換為深色模式' }).click(); await inspect('listening-dark'); await page.getByRole('button', { name: '切換為淺色模式' }).click();
    await open('tools', 'weak'); await inspect('review-list');
    await page.getByRole('searchbox', { name: '找一個想練的單字' }).fill('蘋果'); await inspect('review-search');
    if (await page.locator('.practice-review-list>div').count() !== 1) throw new Error('Local Chinese review search unavailable');
    await page.getByRole('searchbox').fill(''); await page.getByRole('button', { name: /^先複習/ }).click(); await inspect('review-front');
    const firstWord = await page.locator('.practice-review-card h2').textContent();
    await page.getByRole('button', { name: '翻開看看意思' }).click(); await inspect('review-back'); await page.getByRole('button', { name: '記住了，移出清單' }).click();
    if (await page.locator('.practice-review-card h2').textContent() === firstWord) throw new Error('Review queue did not advance');
    await page.getByRole('button', { name: '復原剛才的移除' }).click(); await inspect('review-undo');
    while (await page.getByRole('button', { name: '還想再練，留著' }).count()) await page.getByRole('button', { name: '還想再練，留著' }).click();
    await inspect('review-complete'); await page.getByRole('button', { name: '回到複習清單' }).click();
    await page.getByRole('button', { name: '複習 unlistedword', exact: true }).click(); await page.getByRole('button', { name: '翻開看看意思' }).click(); await inspect('review-missing-meaning');
    await page.getByRole('button', { name: '回複習清單', exact: true }).click(); await page.getByRole('button', { name: '切換為深色模式' }).click(); await inspect('review-dark');
    await open('learn', 'quiz'); await inspect('quiz-dark');
    await context.close();
  }
} finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(results, null, 2)); }
const issues = results.filter(r => r.overflow || r.wide?.length || r.brokenImages?.length || r.errors?.length);
console.log(JSON.stringify({ screens: results.filter(r => r.name).length, issues }, null, 2));
if (issues.length) process.exitCode = 1;
