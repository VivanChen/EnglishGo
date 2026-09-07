import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { NOVELS } from '../src/data/novels.js';
import { novelBlockPairs } from '../src/data/novelAudio.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/novel-reading'); await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true }), report = [];
const assert = (value, message) => { if (!value) throw new Error(message); };
try {
  for (const width of (process.env.QA_WIDTHS || '1440,390,320').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: width > 900 ? 1000 : 844 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], offlineAudio = []; page.setDefaultTimeout(18000);
    report.push({ width, name: 'runtime', errors, offlineAudio });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') (message.location().url.includes('/.netlify/functions/') ? offlineAudio : errors).push(message.text()); });
    // Local preview has no Netlify voice functions. Make the unavailable service deterministic.
    await context.route('**/.netlify/functions/elevenlabs-tts*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"QA offline audio"}' }));
    await page.addInitScript(() => {
      window.qaVoice = [];
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speaking: false, getVoices: () => [], resume() {}, pause() {}, cancel() { this.speaking = false; }, addEventListener() {}, removeEventListener() {}, speak(utterance) { this.speaking = true; window.qaVoice.push(utterance.text); } } });
      localStorage.setItem('eg_quiet', 'true'); localStorage.setItem('eg_calm', 'true');
    });
    const click = name => page.getByRole('button', { name, exact: true }).click();
    const tools = async () => { if (width <= 560 && await page.getByRole('button', { name: '展開閱讀工具', exact: true }).count()) await click('展開閱讀工具'); };
    const settled = async () => { await page.getByTestId('novel-page-turn').waitFor({ state: 'detached' }); await page.waitForTimeout(300); };
    const inspect = async name => {
      await settled(); console.log(`${width}px ${name}`);
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
        wide: [...document.querySelectorAll('.novel-reading button,.novel-reading select,.novel-reading [data-reader-block]')].filter(element => !element.closest('[aria-hidden="true"]')).filter(element => { const r = element.getBoundingClientRect(); return r.width && (r.left < -2 || r.right > innerWidth + 2); }).map(element => element.textContent.slice(0, 80)),
        brokenImages: [...document.images].filter(img => img.currentSrc && img.complete && !img.naturalWidth).map(img => img.currentSrc),
        unreadableOverflow: [...document.querySelectorAll('[data-testid="novel-page-content"]')].filter(element => !element.closest('[aria-hidden="true"]')).filter(element => element.scrollHeight > element.clientHeight + 1 && !['auto', 'scroll'].includes(getComputedStyle(element).overflowY)).length }));
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true, animations: 'disabled' }); report.push({ width, name, ...layout });
    };
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5192/'); await page.getByText('Elementary', { exact: true }).click();
    await click('回到學習首頁'); await page.locator('[data-group-id="read"]').click(); await page.locator('[data-module-id="novels"]').click();
    await page.getByTestId('novel-chapter-card-1').waitFor(); await inspect('library');
    await page.getByTestId('novel-chapter-card-1').focus(); await page.keyboard.press('Enter'); await page.getByTestId('novel-reader-panel').waitFor(); await inspect('reader');
    const voiceCount = await page.evaluate(() => window.qaVoice.length); await page.getByTestId('novel-reader-text').first().click(); assert(await page.evaluate(() => window.qaVoice.length) === voiceCount, 'Reading text started unwanted audio');
    await click('下一頁'); await settled();
    const block = page.locator('[data-testid="novel-page-content"] [data-reader-block]').first(), index = Number(await block.getAttribute('data-reader-block'));
    const excerpt = await block.getByTestId('novel-reader-text').textContent(); await click(`收藏段落 ${index + 1}`); await inspect('bookmark-saved');
    await click('☷ 目錄與書籤'); await inspect('journey'); await click(`移除書籤 第 1 章第 ${index + 1} 段`); await click('還原書籤'); await inspect('bookmark-undo'); await click('關閉工具面板');
    await tools(); await click('閱讀偏好'); await click('先讀英文'); await click('清楚字體'); await click('柔綠'); await inspect('preferences'); await click('關閉工具面板');
    assert(await page.getByTestId('novel-reader-translation').count() === 0, 'English-first preference ignored');
    const peek = page.getByRole('button', { name: /^看看段落 \d+ 的中文$/ }).first(); await peek.click(); assert(await page.getByTestId('novel-reader-translation').count() === 1, 'Paragraph peek revealed unrelated translations'); await inspect('single-translation');
    await tools(); await click('閱讀偏好'); await click('夜讀'); await click('關閉工具面板'); await inspect('night');
    await page.reload(); await click('繼續閱讀'); await settled(); assert(await page.getByTestId('novel-reader-translation').count() === 0, 'Temporary peek survived reload');
    assert(await page.getByTestId('novel-reader-panel').evaluate(element => getComputedStyle(element).backgroundColor) === 'rgb(20, 33, 35)', 'Night preference was lost'); await inspect('restored');
    await click('☷ 目錄與書籤'); await click(`前往書籤 第 1 章第 ${index + 1} 段`); await settled();
    assert(await page.locator(`[data-reader-block="${index}"]`).getByTestId('novel-reader-text').textContent() === excerpt, 'Bookmark restored a different paragraph');
    assert(await page.locator(`[data-reader-block="${index}"]`).evaluate(element => element === document.activeElement), 'Bookmark focus did not reach saved paragraph'); await inspect('bookmark-return');
    await tools(); await click('A+'); await click('A+'); await click('A+'); await click('寬行距'); await inspect('large-type'); await click('切換為深色模式'); await inspect('night-with-dark-app'); await click('切換為淺色模式');
    await click('☷ 目錄與書籤'); await page.getByRole('navigation', { name: '故事章節' }).getByRole('button', { name: new RegExp(NOVELS.elementary[0].chapters[1].title) }).click(); await settled();
    assert((await page.getByTestId('novel-reader-text').first().textContent()) === novelBlockPairs(NOVELS.elementary[0].chapters[1].en, NOVELS.elementary[0].chapters[1].zh)[0].en, 'Chapter inherited old text or pagination'); await inspect('next-chapter');
    await click('☷ 目錄與書籤'); await click(`前往書籤 第 1 章第 ${index + 1} 段`); await settled();
    const jump = page.getByRole('combobox', { name: '跳到頁面' }); await jump.selectOption(await jump.locator('option').last().getAttribute('value')); await settled(); await inspect('chapter-end');
    await click('來試試故事小測驗'); await inspect('quiz');
    for (const question of NOVELS.elementary[0].chapters[0].quiz) await click(question.o[question.a]);
    await inspect('quiz-answered'); await click('關閉工具面板'); const xp = await page.evaluate(() => JSON.parse(localStorage.getItem('eg_xp')) || 0); await click('完成並下一章'); await settled();
    assert((await page.evaluate(() => JSON.parse(localStorage.getItem('eg_xp')) || 0)) === xp + 15, 'Chapter completion did not award exactly 15 XP');
    await click('章節列表'); await page.reload(); await page.getByText(NOVELS.elementary[0].zhTitle, { exact: true }).waitFor(); await inspect('library-restored');
    await context.close();
  }
  for (const [level, label] of [['junior', 'Junior High'], ['senior', 'Senior High']]) {
    const context=await browser.newContext({viewport:{width:320,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5192/'); await page.getByText(label,{exact:true}).click();
    await page.getByRole('button',{name:'回到學習首頁',exact:true}).click(); await page.locator('[data-group-id="read"]').click(); await page.locator('[data-module-id="novels"]').click();
    await page.getByTestId('novel-chapter-card-1').click(); await page.getByTestId('novel-reader-panel').waitFor();
    const expected=(NOVELS[level].length?NOVELS[level]:NOVELS.elementary)[0].chapters[0];
    assert((await page.getByTestId('novel-reader-text').first().textContent())===novelBlockPairs(expected.en,expected.zh)[0].en,'Grade reader used unexpected content');
    await page.screenshot({path:path.join(output,`${level}-reader.png`),fullPage:true});
    report.push({level,name:'grade-reader',overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),errors}); await context.close();
  }
} catch (error) { report.push({ error: error.stack }); throw error; }
finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
const failures = report.filter(row => row.error || row.overflow || row.wide?.length || row.brokenImages?.length || row.unreadableOverflow || row.errors?.length);
console.log(JSON.stringify({ checks: report.length, failures }, null, 2)); if (failures.length) process.exitCode = 1;
