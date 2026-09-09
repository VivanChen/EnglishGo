// Run against a local Vite server. Optional: QA_URL, QA_WIDTHS, PLAYWRIGHT_MODULE.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.QA_URL || 'http://127.0.0.1:5196';
const entry = `.qa-dash-${process.pid}`;
const files = [`${entry}.html`, `${entry}.jsx`];
const output = '.superpowers/qa/independent-runners';
let browser;
try {
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(files[0], `<!doctype html><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="root"></div><script type="module" src="/${files[1]}"></script>`);
  await fs.writeFile(files[1], `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import * as THREE from 'three'; import WordDash from './src/features/WordDash.jsx';
    const add = THREE.Scene.prototype.add;
    THREE.Scene.prototype.add = function(...args) { window.qaScene = this; return add.apply(this,args); };
    const lookAt = THREE.PerspectiveCamera.prototype.lookAt;
    THREE.PerspectiveCamera.prototype.lookAt = function(...args) { window.qaCamera = this; return lookAt.apply(this,args); };
    const words = [{w:'apple',m:'蘋果'},{w:'cat',m:'貓'},{w:'dog',m:'狗'},{w:'book',m:'書'},{w:'fish',m:'魚'}];
    const deps = { V:{elementary:words}, speak:w=>window.qaWord=w, stopSpeech:()=>{}, playSound:()=>{}, loadExtraWords:async()=>({}), fetchCloudVocab:async()=>[] };
    createRoot(document.getElementById('root')).render(<WordDash lv="elementary" deps={deps} onBack={()=>{}} onXp={()=>{}}/>);
  `);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  for (const width of (process.env.QA_WIDTHS || '1440,320').split(',').map(Number)) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${message.location().url}: ${message.text()}`); });
    // Accelerate the simulation while preserving the real Three renderer and collisions.
    await page.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = callback => raf(time => callback(time * 4)); });
    console.log(`${width}: opening race`);
    await page.goto(`${base}/${files[0]}`);
    await page.getByRole('button', { name: /開始衝衝/ }).click();
    await page.locator('.dash-lanes').waitFor();
    console.log(`${width}: running collisions`);
    await page.evaluate(() => {
      window.qaSamples = [];
      window.qaProbe = setInterval(() => {
        const scene = window.qaScene, camera = window.qaCamera;
        const runners = ['dash-player', ...Array.from({ length: 6 }, (_, i) => `dash-rival-${i}`)].map(name => scene?.getObjectByName(name));
        if (camera && runners.every(Boolean)) window.qaSamples.push({ positions: runners.map(runner => -runner.position.z), camera: camera.position.toArray(), fov: camera.fov });
        const dots = [...document.querySelectorAll('.dash-race-progress i')];
        const allFinished = dots.length === 7 && dots.slice(0, 6).every(dot => Number(dot.dataset.distance) >= 157);
        const meaning = { apple:'蘋果', cat:'貓', dog:'狗', book:'書', fish:'魚' }[window.qaWord];
        const buttons = [...document.querySelectorAll('.dash-lanes button')];
        const button = buttons.find(button => allFinished ? button.querySelector('b').textContent === meaning : button.querySelector('b').textContent !== meaning);
        button?.click();
      }, 40);
    });
    await page.waitForFunction(() => window.qaSamples.some((sample, i, all) => i && sample.positions.slice(1).some((value, j) => value < all[i - 1].positions[j + 1] - .05)), null, { timeout: 90000 });
    await page.screenshot({ path: path.join(output, `${width}-collision.png`), fullPage: true, timeout: 15000 });
    console.log(`${width}: checking pause`);
    await page.getByRole('button', { name: 'Ⅱ 暫停' }).click();
    const paused = await page.evaluate(() => window.qaSamples.at(-1).positions);
    await page.waitForTimeout(350);
    const still = await page.evaluate(() => window.qaSamples.at(-1).positions);
    assert.deepEqual(still, paused, 'Pause must freeze all runners');
    await page.getByRole('button', { name: /繼續比賽/ }).click();
    console.log(`${width}: racing to finish`);
    await page.getByRole('heading', { name: '這次未奪冠，再挑戰！' }).waitFor({ timeout: 180000 });
    const result = await page.evaluate(() => {
      clearInterval(window.qaProbe);
      const samples = window.qaSamples;
      let isolatedBotRecoil = 0, isolatedPlayerRecoil = 0, cameraReversed = 0;
      const collidedBots = new Set();
      samples.forEach((sample, i) => {
        if (!i) return;
        const prev = samples[i - 1], changes = sample.positions.map((position, j) => position - prev.positions[j]);
        changes.slice(1).forEach((delta, j) => { if (delta < -.05) collidedBots.add(j); });
        if (changes.slice(1).some(delta => delta < -.05) && changes.slice(1).some(delta => delta > .05)) isolatedBotRecoil++;
        if (changes[0] < -.05 && changes.slice(1).some(delta => delta > .05)) isolatedPlayerRecoil++;
        if (sample.camera[2] > prev.camera[2] + .001) cameraReversed++;
      });
      return { rank: document.querySelector('.dash-placement').textContent, isolatedBotRecoil, isolatedPlayerRecoil, collidedBots: [...collidedBots], cameraReversed, fixedFov: samples.every(sample => sample.fov === 48), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(result.isolatedBotRecoil > 0 && result.isolatedPlayerRecoil > 0);
    assert.ok(result.collidedBots.length >= 2);
    assert.equal(result.cameraReversed, 0);
    assert.equal(result.fixedFov, true);
    assert.equal(result.overflow, false);
    assert.match(result.rank, /第 7 名/);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, `${width}-loss.png`), fullPage: true, timeout: 15000 });
    results.push({ width, ...result, errors });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await Promise.all(files.map(file => fs.rm(file, { force: true })));
}
