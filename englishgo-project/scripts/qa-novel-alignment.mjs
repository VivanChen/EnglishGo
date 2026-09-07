import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { NOVELS } from '../src/data/novels.js';
import { novelBlockPairs } from '../src/data/novelAudio.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/novel-alignment');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
const check = (value, message) => { if (!value) throw new Error(message); };
const targets = {
  elementary: { 4: [57, 89, 90, 103], 6: [45, 47, 128, 171], 7: [22, 29, 30, 31, 32, 38, 101, 140, 153, 164], 8: [19, 39, 40, 123] },
  junior: { 13: [16, 17, 18, 144, 145, 146], 14: [109, 110, 111, 112, 113, 114, 115, 116], 16: [54] },
};
try {
  for (const width of [1440, 320]) for (const [level, label] of [['elementary', 'Elementary'], ['junior', 'Junior High']]) {
    const novel = NOVELS[level][0];
    const context = await browser.newContext({ viewport: { width, height: width > 560 ? 1000 : 740 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.location().url.includes('/.netlify/functions/')) errors.push(message.text()); });
    await context.route('**/.netlify/functions/elevenlabs-tts*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Local QA: voice service unavailable"}' }));
    const marks = Object.entries(targets[level]).flatMap(([chapterNo, indices]) => indices.map(blockIndex => ({ chapterNo: Number(chapterNo), blockIndex, contentVersion: 2, createdAt: 123 })));
    if (level === 'elementary') {
      // The screenshot's old block 28 becomes original English block 29.
      const mark = marks.find(mark => mark.chapterNo === 7 && mark.blockIndex === 29);
      delete mark.contentVersion; mark.blockIndex = 28;
    }
    await page.addInitScript(({ id, marks }) => {
      localStorage.setItem('eg_quiet', 'true'); localStorage.setItem('eg_calm', 'true');
      localStorage.setItem('eg_novelBookmarks', JSON.stringify({ [id]: marks }));
    }, { id: novel.id, marks });
    const click = name => page.getByRole('button', { name, exact: true }).click();
    const settled = async () => {
      await page.getByTestId('novel-page-turn').waitFor({ state: 'detached' });
      await page.waitForTimeout(160);
    };
    const inspect = async (chapter, name, target) => {
      await settled();
      const expected = novelBlockPairs(chapter.en, chapter.zh);
      const state = await page.evaluate(() => {
        const blocks = [...document.querySelectorAll('[data-testid="novel-page-content"] [data-reader-block]')].map(element => ({
          index: Number(element.dataset.readerBlock),
          en: element.querySelector('[lang="en"]').textContent,
          zh: element.querySelector('[lang="zh-Hant"] > span').textContent,
        }));
        const actions = document.querySelector('[data-testid="novel-page-actions"]').getBoundingClientRect();
        return { blocks, overflow: document.documentElement.scrollWidth > innerWidth + 1,
          mobileControls: actions.top >= 0 && actions.bottom <= innerHeight + 1,
          documentScroll: scrollY,
          brokenImages: [...document.images].filter(img => img.complete && img.currentSrc && !img.naturalWidth).map(img => img.currentSrc) };
      });
      for (const block of state.blocks) {
        check(block.en === expected[block.index]?.en && block.zh === expected[block.index]?.zh, `${novel.id}/${chapter.no}/${block.index}: displayed pair differs from reviewed source`);
      }
      check(state.blocks.length > 0, 'Empty reading page');
      if (target != null) check(state.blocks.some(block => block.index === target), `${name}: target paragraph missing`);
      check(!state.overflow && !state.brokenImages.length && !errors.length, `${level} ${width}px ${name}: ${JSON.stringify({ ...state, errors })}`);
      if (width <= 560) check(state.mobileControls && state.documentScroll === 0, `${name}: mobile controls/document escaped viewport`);
      report.push({ width, level, chapter: chapter.no, name, ...state, errors: [...errors] });
    };
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5192/');
    await page.getByText(label, { exact: true }).click(); await click('回到學習首頁');
    await page.locator('[data-group-id="read"]').click(); await page.locator('[data-module-id="novels"]').click();
    for (const chapter of novel.chapters) {
      await page.getByTestId(`novel-chapter-card-${chapter.no}`).click();
      await page.getByTestId('novel-reader-panel').waitFor();
      await inspect(chapter, 'first-page', 0);
      const allRenderedPairs = await page.getByTestId('novel-measurement-layer').locator('section').evaluateAll(elements => elements.map(element => ({
        en: element.querySelector('[lang="en"]').textContent,
        zh: element.querySelector('[lang="zh-Hant"] > span').textContent,
      })));
      check(JSON.stringify(allRenderedPairs) === JSON.stringify(novelBlockPairs(chapter.en, chapter.zh).map(({ en, zh }) => ({ en, zh }))), 'Reader measurement data lost or changed a paragraph');
      for (const index of targets[level][chapter.no] || []) {
        await click('☷ 目錄與書籤'); await click(`前往書籤 第 ${chapter.no} 章第 ${index + 1} 段`);
        await inspect(chapter, `paragraph-${index + 1}`, index);
        if ((level === 'elementary' && chapter.no === 7 && [29, 31].includes(index)) || (level === 'junior' && chapter.no === 14 && index === 111)) {
          await page.screenshot({ path: path.join(output, `${width}-${level}-${chapter.no}-${index + 1}.png`), fullPage: width > 560 });
        }
      }
      const jump = page.getByRole('combobox', { name: '跳到頁面' });
      await jump.selectOption(await jump.locator('option').last().getAttribute('value'));
      await inspect(chapter, 'last-page', allRenderedPairs.length - 1);
      console.log(`${width}px ${level} chapter ${chapter.no}: ${allRenderedPairs.length} pairs checked, first/last and corrected passages displayed`);
      await click(width <= 560 ? '返回章節列表' : '章節列表');
    }
    await context.close();
  }
} catch (error) { report.push({ error: error.stack }); throw error; }
finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ checks: report.length, failures: report.filter(row => row.error || row.errors?.length) }, null, 2));
