import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/vevanchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const [batchArg, mode = 'local'] = process.argv.slice(2);
if (!/^\d+$/.test(batchArg || '') || !['local', 'production'].includes(mode)) throw Error('Usage: node scripts/qaSeniorWordIllustrationBatch.mjs BATCH [local|production]');
const suffix = String(Number(batchArg)).padStart(3, '0');
const manifest = JSON.parse(await fs.readFile(`.superpowers/word-art/senior-batch-${suffix}-staged.json`, 'utf8'));
const output = `.superpowers/word-art/senior-qa-${suffix}`;
await fs.mkdir(output, { recursive: true });
const longest = field => manifest.records.reduce((best, item, i, all) => item[field].length > all[best][field].length ? i : best, 0);
const candidates = [0, longest('word'), longest('example'), Math.floor((manifest.records.length - 1) / 2), manifest.records.length - 1, Math.floor((manifest.records.length - 1) / 4), Math.floor(3 * (manifest.records.length - 1) / 4)];
const indices = [...new Set(candidates)].slice(0, Math.min(5, manifest.records.length));
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const reports = [];
try {
  for (const width of mode === 'production' ? [1440, 390] : [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push({ message: message.text(), location: message.location().url }); });
    if (mode === 'local') {
      const wav = Buffer.alloc(1644); wav.write('RIFF', 0); wav.writeUInt32LE(1636, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(1600, 40);
      await page.route('**/.netlify/functions/elevenlabs-tts', route => route.fulfill({ status: 200, contentType: 'audio/wav', body: wav }));
    }
    await page.addInitScript(() => { localStorage.setItem('eg_loginBonus', JSON.stringify({ lastDate: new Date().toDateString(), streak: 1, claimed: true })); });
    const selected = mode === 'production' ? [width === 1440 ? indices[0] : indices.at(-1)] : indices;
    for (const index of selected) {
      const item = manifest.records[index];
      const origin = mode === 'production' ? 'https://englishgo-vevan.netlify.app/' : 'http://127.0.0.1:5192/';
      await page.goto(origin + '?lv=senior&word=' + encodeURIComponent(item.word), { waitUntil: 'domcontentloaded' });
      if (mode === 'local') {
        const heading = page.locator('.srs-front-word .srs-headword');
        await heading.filter({ hasText: item.word }).waitFor();
        const frontFits = await heading.evaluate(el => {
          const text = el.getBoundingClientRect(), card = el.closest('[data-testid="srs-card"]').getBoundingClientRect();
          return text.left >= card.left && text.right <= card.right && el.scrollWidth <= el.clientWidth + 1;
        });
        if (!frontFits) throw Error('Front headword is clipped: ' + item.word);
      }
      await page.getByRole('button', { name: '點卡片看答案' }).click();
      if (mode === 'local') {
        const backFits = await page.locator('.srs-back-word .srs-headword').evaluate(el => {
          const text = el.getBoundingClientRect(), card = el.closest('[data-testid="srs-card"]'), bounds = card.getBoundingClientRect(), mascot = card.firstElementChild.getBoundingClientRect();
          return text.left >= bounds.left && text.right <= bounds.right && el.scrollWidth <= el.clientWidth + 1 && text.top >= mascot.bottom;
        });
        if (!backFits) throw Error('Back headword is clipped or overlaps mascot: ' + item.word);
      }
      const gallery = page.getByTestId('srs-back-illustrations');
      await gallery.getByText(item.example, { exact: true }).waitFor();
      await gallery.getByText(item.example_zh, { exact: true }).waitFor();
      await gallery.locator('img').evaluate(img => img.decode());
      await gallery.locator('figcaption').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const state = await gallery.evaluate(section => {
        const img = section.querySelector('img'), image = img.getBoundingClientRect(), caption = section.querySelector('figcaption').getBoundingClientRect();
        const rating = document.querySelector('[data-testid="srs-rating-bar"]')?.getBoundingClientRect();
        return { src: img.currentSrc, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1, imageWithinViewport: image.left >= 0 && image.right <= innerWidth + 1, captionTop: caption.top, captionBottom: caption.bottom, ratingTop: rating?.top ?? innerHeight };
      });
      if (state.src !== item.image_url || state.naturalWidth !== 768 || state.naturalHeight !== 768 || state.overflow || !state.imageWithinViewport || state.captionBottom > state.ratingTop + 1 || errors.length) throw Error(JSON.stringify({ width, word: item.word, ...state, errors }));
      await page.screenshot({ path: path.join(output, `${mode}-${width}-${item.word}.png`), fullPage: true });
      reports.push({ width, word: item.word, ...state, errors: [...errors] });
      console.log(JSON.stringify({ mode, width, word: item.word, status: 'passed' }));
    }
    await context.close();
  }
  await fs.writeFile(path.join(output, mode === 'production' ? 'production-results.json' : 'results.json'), JSON.stringify(reports, null, 2) + '\n');
} finally { await browser.close(); }
