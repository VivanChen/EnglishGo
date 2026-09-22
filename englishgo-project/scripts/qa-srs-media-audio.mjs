import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = path.resolve('.superpowers/qa/srs-media-audio');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const results = [];
try {
  // Use one real cached production MP3 without generating speech for the test deck.
  const audio = await fetch('https://englishgo-vevan.netlify.app/.netlify/functions/elevenlabs-tts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25000),
    body: JSON.stringify({ text: 'apple', lang: 'en-US', voiceId: '21m00Tcm4TlvDq8ikWAM', speed: 1 }),
  });
  if (!audio.ok) throw Error(`Production TTS returned ${audio.status}`);
  const mp3 = Buffer.from(await audio.arrayBuffer());
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => failed.push(request.url()));
    await page.route('**/.netlify/functions/elevenlabs-tts', route => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: mp3 }));
    await page.addInitScript(() => {
      window.qaSpeech = { native: 0, cloud: 0 };
      const nativeSpeak = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = utterance => { window.qaSpeech.native++; return nativeSpeak(utterance); };
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        return play.call(this).then(() => { if (this.src.startsWith('blob:') && !this.muted) window.qaSpeech.cloud++; });
      };
      Math.random = () => .999999;
      localStorage.setItem('eg_loginBonus', JSON.stringify({ lastDate: new Date().toDateString(), streak: 1, claimed: true }));
    });
    await page.goto(process.env.QA_URL || 'http://localhost:5190/');
    await page.getByText('Elementary', { exact: true }).click();
    await page.getByRole('button', { name: /約 5 分鐘 單字卡/ }).click();
    await page.getByRole('button', { name: /全部單字，\d+ 個單字/ }).click();
    const media = page.getByTestId('srs-front-media');
    await media.getByText('手繪插畫').waitFor();
    const img = media.locator('img');
    await img.evaluate(image => image.decode());
    if (!(await img.getAttribute('src')).includes('/apple-01-v1.webp')) throw Error('Expected apple hand-drawn fallback');
    await page.getByRole('button', { name: '播放單字 apple', exact: true }).click();
    await page.waitForFunction(() => window.qaSpeech.cloud > 0);
    const speech = await page.evaluate(() => window.qaSpeech);
    if (speech.native) throw Error('Word unexpectedly used device speech');
    results.push({ width, speech });
    const inspect = async name => {
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        brokenImages: [...document.images].filter(img => img.currentSrc && img.complete && !img.naturalWidth).map(img => img.currentSrc),
      }));
      if (state.overflow || state.brokenImages.length) throw Error(JSON.stringify({ width, name, ...state }));
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true });
      results.push({ width, name, ...state });
    };
    await inspect('front');
    await page.getByRole('button', { name: '點卡片看答案' }).click();
    await page.getByTestId('srs-back-illustrations').locator('img').first().evaluate(image => image.decode());
    await inspect('back');
    await page.getByTestId('srs-dictionary-action').click();
    await page.getByTestId('srs-local-dictionary').waitFor();
    await inspect('dictionary');
    results.push({ width, errors, failed });
    if (errors.length || failed.length) throw Error(JSON.stringify({ width, errors, failed }));
    await context.close();
  }
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
