import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/workshops');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true }), report = process.env.QA_GRADES_ONLY === '1' ? JSON.parse(await fs.readFile(path.join(output, 'report.json'), 'utf8')).filter(r => !r.grade) : [];
try {
  for (const width of (process.env.QA_GRADES_ONLY === '1' ? [] : (process.env.QA_WIDTHS || '1440,390,320').split(',').map(Number))) {
    const context = await browser.newContext({ viewport: { width, height: width > 900 ? 1000 : 844 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], unavailableServices = [];
    report.push({ width, errors, unavailableServices });
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') (m.location().url.includes('/.netlify/functions/') ? unavailableServices : errors).push(m.text()); });
    await page.addInitScript(() => {
      localStorage.setItem('eg_quiet', 'true'); localStorage.setItem('eg_calm', 'true');
      window.qaRecognitions = [];
      window.SpeechRecognition = class {
        constructor() { window.qaRecognitions.push(this); }
        start() { this.started = true; }
        stop() { this.onend?.(); }
        abort() { this.aborted = true; }
        answer(text) { const row = Object.assign([{ transcript: text, confidence: 1 }], { isFinal: true }); this.onresult?.({ resultIndex: 0, results: [row] }); this.onend?.(); }
      };
    });
    const click = name => page.getByRole('button', { name, exact: true }).click();
    const inspect = async name => {
      console.log(`${width}px ${name}`); await page.waitForTimeout(150);
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
        wide: [...document.querySelectorAll('main button,main input,main section')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.left < -2 || r.right > innerWidth + 2); }).map(e => e.textContent.slice(0, 70)),
        brokenImages: [...document.images].filter(i => i.currentSrc && i.complete && !i.naturalWidth).map(i => i.currentSrc) }));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true, animations: 'disabled' }); report.push({ width, name, ...layout });
    };
    const open = async (group, id) => { await click('回到學習首頁'); await page.locator(`[data-group-id="${group}"]`).click(); await page.locator(`[data-module-id="${id}"]`).click(); await page.locator('.practice-world').waitFor(); };
    const xp = () => page.evaluate(() => localStorage.getItem('eg_xp'));
    await page.goto(process.env.QA_URL || 'http://localhost:5190/'); await page.getByText('Elementary', { exact: true }).click();
    await open('learn', 'grammar'); await inspect('grammar-map'); await page.locator('.workshop-topic').filter({ hasText: 'Be 動詞' }).click();
    await inspect('grammar-examples'); await click('看懂了，練練看 →');
    await page.getByTestId('grammar-drill-0-option-0').click(); await inspect('grammar-retry'); await click('再試這一題');
    await page.getByTestId('grammar-drill-0-option-2').click(); await page.getByTestId('grammar-drill-1-option-0').click(); await click('準備好了，試試小挑戰 →');
    await page.getByTestId('grammar-quiz-option-1').click(); const grammarXp = await xp(); await page.reload(); await click('繼續上次這一課 →');
    if (!(await page.getByTestId('grammar-quiz-option-1').isDisabled()) || await xp() !== grammarXp) throw new Error('Grammar progress/reward was not restored');
    await inspect('grammar-restored'); await click('看看這一課的收穫 →'); await inspect('grammar-complete');
    if (width === 390) { await click('切換為深色模式'); await inspect('grammar-dark'); await click('切換為淺色模式'); }
    await click('下一課 →'); await inspect('grammar-next-lesson');
    await open('learn', 'speak'); await inspect('speech-lobby'); await click('開始口說小練習 →'); await inspect('speech-ready');
    if (await page.evaluate(() => window.qaRecognitions.length)) throw new Error('Recognition started without a gesture');
    await click('🎤 直接開說'); await page.evaluate(() => window.qaRecognitions.at(-1).onend()); await inspect('speech-no-sound');
    await click('🎤 直接開說'); await page.evaluate(() => { const r = window.qaRecognitions.at(-1), late = r.onend; r.onerror({ error: 'not-allowed' }); late(); });
    await inspect('speech-permission'); await click('🎤 直接開說'); await inspect('speech-listening');
    await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('eg_speaking_studio_elementary')); window.qaRecognitions.at(-1).answer(r.items[r.queue[r.index]].en); });
    await page.getByRole('heading', { name: '通過', exact: true }).waitFor(); const speechXp = await xp(); await inspect('speech-passed');
    await page.reload(); await click('繼續上次練習'); if (await xp() !== speechXp) throw new Error('Speech awarded twice on reload');
    await inspect('speech-restored'); await click('下一個');
    await click('🎤 直接開說'); await page.evaluate(() => window.qaRecognitions.at(-1).answer('something else')); await inspect('speech-retry'); await click('下一個');
    await page.getByText('今天想先跟讀，不用麥克風', { exact: true }).click(); await click('我跟讀過了，繼續 →'); await inspect('speech-complete');
    await click('只練還想加強的'); await inspect('speech-targeted-review'); await click('Ⅱ 先休息一下'); await inspect('speech-paused');
    if (width === 390) { await click('繼續上次練習'); await click('切換為深色模式'); await inspect('speech-dark'); await click('切換為淺色模式'); }
    await open('read', 'songs'); await page.waitForFunction(() => document.querySelector('audio')?.duration > 1); await inspect('song-player');
    if (!(await page.locator('audio').evaluate(a => a.paused))) throw new Error('Song autoplayed');
    await click('播放'); await page.waitForFunction(() => { const a = document.querySelector('audio'); return !a.paused && a.currentTime > .3; }); await click('暫停');
    await click('逐句跟唱'); const sing = page.getByRole('region', { name: '逐句跟唱', exact: true }); await inspect('song-sing-ready');
    await sing.getByRole('button', { name: '♫ 聽這一句', exact: true }).click();
    await page.waitForFunction(() => { const a = document.querySelector('audio'); return a.paused && a.currentTime >= 9.95 && a.currentTime <= 10.1; });
    report.push({ width, name: 'actual-audio-phrase-stop', ...await page.locator('audio').evaluate(a => ({ paused: a.paused, time: a.currentTime, duration: a.duration, src: a.currentSrc })) });
    await sing.getByRole('button', { name: '循環這一句', exact: true }).click(); await page.locator('audio').evaluate(a => { a.currentTime = 9.9; });
    await page.waitForFunction(() => { const a = document.querySelector('audio'); return !a.paused && a.currentTime < 9.5; }); await inspect('song-loop');
    await sing.getByRole('button', { name: '停止循環', exact: true }).click();
    for (let i = 0; i < 3; i++) { await sing.getByRole('button', { name: '我跟唱過了 ✓', exact: true }).click(); if (i < 2) await sing.getByRole('button', { name: '下一句', exact: true }).click(); }
    await inspect('song-three-phrases'); await click('慢聽 0.85x'); await click('隱藏中文');
    await page.getByRole('slider', { name: '歌曲播放位置' }).fill('22'); await page.reload(); await page.waitForFunction(() => document.querySelector('audio')?.duration > 1);
    const restored = await page.locator('audio').evaluate(a => ({ time: a.currentTime, paused: a.paused, rate: a.playbackRate }));
    if (Math.abs(restored.time - 22) > .2 || !restored.paused || restored.rate !== .85) throw new Error(`Song resume failed: ${JSON.stringify(restored)}`);
    await inspect('song-restored'); await click('顯示中文'); await click('歌詞填空');
    const options = page.locator('.song-panel button').filter({ hasText: /^(ready|read|write|practice|learn|strong|listen|speak|mistake|again)$/ });
    const wrong = (await options.allTextContents()).find(t => t !== 'ready'); await page.locator('.song-panel').getByRole('button', { name: wrong, exact: true }).first().click();
    await inspect('song-fill-retry'); await click('再試一次'); await page.locator('.song-panel').getByRole('button', { name: 'ready', exact: true }).first().click();
    const songXp = await xp(); await page.reload(); await click('歌詞填空'); if (await xp() !== songXp) throw new Error('Song fill reward repeated'); await inspect('song-fill-restored');
    await click('逐句跟唱'); await inspect('song-goal-restored');
    if (width === 390) { await click('切換為深色模式'); await inspect('song-dark'); await click('切換為淺色模式'); }
    await sing.getByRole('button', { name: '循環這一句', exact: true }).click(); const audioHandle = await page.locator('audio').elementHandle(); await click('回到學習首頁');
    if (!(await audioHandle.evaluate(a => a.paused))) throw new Error('Song kept playing after navigation');
    await context.close();
  }
  for (const [grade, label] of [['elementary', 'Elementary'], ['junior', 'Junior High'], ['senior', 'Senior High']]) {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], unavailableServices = [];
    report.push({ grade, width: 320, errors, unavailableServices });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') (m.location().url.includes('/.netlify/functions/') ? unavailableServices : errors).push(m.text()); });
    await page.addInitScript(() => { localStorage.setItem('eg_quiet', 'true'); window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
    const click = name => page.getByRole('button', { name, exact: true }).click();
    const open = async (group, id) => { await click('回到學習首頁'); await page.locator(`[data-group-id="${group}"]`).click(); await page.locator(`[data-module-id="${id}"]`).click(); };
    const inspect = async name => {
      console.log(`${grade} ${name}`); await page.evaluate(() => window.scrollTo(0, 0));
      const data = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, brokenImages: [...document.images].filter(i => i.currentSrc && i.complete && !i.naturalWidth).map(i => i.currentSrc) }));
      report.push({ grade, name, ...data }); await page.screenshot({ path: path.join(output, `${grade}-${name}.png`), fullPage: true });
    };
    await page.goto(process.env.QA_URL || 'http://localhost:5190/'); await page.getByText(label, { exact: true }).click();
    await open('learn', 'grammar'); await page.locator('.workshop-topic').first().click(); await inspect('grammar-examples'); await click('看懂了，練練看 →'); await inspect('grammar-drills');
    await open('learn', 'speak'); await click('句子練習'); await click('開始口說小練習 →'); await inspect('speaking-unsupported');
    await page.getByText('今天想先跟讀，不用麥克風', { exact: true }).click(); await click('我跟讀過了，繼續 →'); await inspect('speaking-self-practice');
    await open('read', 'songs'); await page.locator('audio').waitFor({ state: 'attached' });
    const library = page.locator('.songs-studio > div').nth(1).locator(':scope > button[aria-pressed]'), count = await library.count();
    for (let i = 0; i < Math.max(1, count); i++) {
      if (count) await library.nth(i).click(); await page.waitForFunction(() => document.querySelector('audio')?.duration > 1);
      await inspect(`song-${i}`);
      report.push({ grade, name: `song-${i}-media`, ...await page.locator('audio').evaluate(a => ({ src: a.currentSrc, duration: a.duration, paused: a.paused })) });
      if (await page.getByRole('slider', { name: '歌曲播放位置' }).isDisabled()) throw new Error('Current-song selection cleared metadata');
    }
    const selected = await page.locator('audio').evaluate(a => a.currentSrc);
    await page.reload(); await page.waitForFunction(() => document.querySelector('audio')?.duration > 1);
    if (await page.locator('audio').evaluate(a => a.currentSrc) !== selected) throw new Error('Selected song was lost');
    await click('逐句跟唱'); await inspect('song-sing'); await click('切換為深色模式'); await inspect('song-dark');
    await context.close();
  }
} finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
if (report.some(r => r.errors?.length || r.overflow || r.wide?.length || r.brokenImages?.length)) throw new Error('Workshop browser QA found layout or runtime issues; inspect report.json');
console.log(`Passed ${report.filter(r => r.name).length} checks.`);
