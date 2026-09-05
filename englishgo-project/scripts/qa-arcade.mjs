import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { EXTRA_WORDS } from '../src/data/extraWords.js';
import { shortMeaning } from '../src/data/arcade.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
// Read the same authored curriculum to supply real answers through the UI.
const app = await fs.readFile('src/App.jsx', 'utf8');
const V = vm.runInNewContext(app.slice(app.indexOf('const V = {'), app.indexOf('let _extraWordsPromise')) + ';V');
const SCRAM = vm.runInNewContext(app.slice(app.indexOf('const SCRAM = {'), app.indexOf('// ═══ ACHIEVEMENTS')) + ';SCRAM');
const words = [...V.elementary, ...EXTRA_WORDS.elementary];
const output = path.resolve('.superpowers/qa/arcade');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel:'msedge', headless:true });
const results = [];
for (const width of process.env.QA_WIDTHS ? process.env.QA_WIDTHS.split(',').map(Number) : [1440,390,320]) {
  const context = await browser.newContext({ viewport:{width,height:width>900?1000:844}, serviceWorkers:'block' });
  const page = await context.newPage(), errors = [], unavailableServices = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'){if(message.location().url.includes('/.netlify/functions/'))unavailableServices.push(message.text());else errors.push(message.text())}});
  const inspect = async name => {
    console.log(`${width}px ${name}`);
    await page.waitForTimeout(160);
    const data = await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,wide:[...document.querySelectorAll('main button, main input, main section')].filter(element=>{const r=element.getBoundingClientRect();return r.width&&(r.left<-1||r.right>innerWidth+1)}).map(element=>element.textContent.slice(0,70)),brokenImages:[...document.images].filter(image=>image.currentSrc&&image.complete&&!image.naturalWidth).map(image=>image.currentSrc)}));
    const position=await page.evaluate(()=>scrollY);
    if(await page.locator('.arcade-hud').count()){
      const overlap=await page.evaluate(()=>{window.scrollTo({top:600,behavior:'instant'});return document.querySelector('.arcade-hud').getBoundingClientRect().top<document.querySelector('.eg-app-nav').getBoundingClientRect().bottom-1});
      if(overlap)throw new Error(`Game HUD hidden behind navigation at ${width}px`);
    }
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:path.join(output,`${width}-${name}.png`),fullPage:true,animations:'disabled'});
    await page.evaluate(top=>window.scrollTo({top,behavior:'instant'}),position);
    results.push({width,name,...data});
  };
  await page.goto(process.env.QA_URL||'http://localhost:5190/');
  await page.getByText('Elementary',{exact:true}).click();
  await page.locator('[data-group-id="game"]').click();
  await inspect('island');
  for (const game of ['whack','match','bomb','scramble']) {
    await page.locator(`[data-module-id="${game}"]`).click();
    await page.getByRole('button',{name:'開始第 1 關 →',exact:true}).waitFor();
    await inspect(`${game}-lobby`);
    if(await page.getByTestId('arcade-clock').count())throw new Error('Game started before pressing start');
    await page.getByRole('button',{name:'開始第 1 關 →',exact:true}).click();
    await page.getByTestId('arcade-clock').waitFor();
    await inspect(`${game}-playing`);
    const stages=width===390?3:1;
    for(let stage=1;stage<=stages;stage++) {
      if(stage>1){await page.getByRole('button',{name:`前往第 ${stage} 關 →`,exact:true}).click();await inspect(`${game}-stage-${stage}`)}
      if(game==='match'){
        let pairs=0;
        while(await page.locator('.arcade-memory').count()){
          if(pairs++>6)throw new Error('Memory did not finish');
          const first=page.locator('.arcade-memory-card:not(.is-matched)').filter({has:page.locator('small',{hasText:'ENGLISH'})}).first();
          const word=await first.locator('strong').textContent();
          const meanings=[...new Set(words.filter(item=>item.w.toLowerCase()===word).map(item=>shortMeaning(item.m)))];
          let partner;
          for(const meaning of meanings){const candidate=page.getByRole('button',{name:`中文：${meaning}`,exact:true});if(await candidate.count()){partner=candidate;break}}
          if(!partner)throw new Error(`Missing curriculum meaning for ${word}`);
          await first.click();await partner.click();
          await page.waitForTimeout(650);
        }
      }else{
        let count=0;
        while(!await page.getByRole('heading',{name:'冒險完成！',exact:true}).count()){
          if(count++>5)throw new Error(`${game} did not finish`);
          const clue=await page.locator('.arcade-clue h3').textContent();
          if(game==='whack'){
            const choices=await page.locator('.arcade-mole-word').allTextContents();
            const target=words.find(item=>item.m===clue&&choices.includes(item.w.toLowerCase()));
            if(!target)throw new Error(`Missing whack word: ${clue}`);
            await page.locator('.arcade-mole').filter({has:page.getByText(target.w.toLowerCase(),{exact:true})}).click();
          }else if(game==='bomb'){
            const letters=await page.locator('.arcade-letter-bank button').allTextContents();
            const length=await page.locator('.arcade-letter-slots>span').count();
            const target=words.find(item=>item.m===clue&&item.w.length===length&&[...item.w].every(letter=>[...item.w].filter(c=>c===letter).length<=letters.filter(c=>c===letter).length));
            if(!target)throw new Error(`Missing spelling word: ${clue}`);
            if(count===1){for(const letter of target.w){await page.getByRole('button',{name:`字母 ${letter}`,exact:true}).and(page.locator(':not([disabled])')).first().click()}await inspect(`bomb-stage-${stage}-assembled`)}
            else await page.getByRole('textbox',{name:'拼出英文單字'}).fill(target.w);
            await page.getByRole('button',{name:'發射能量 ↗',exact:true}).click();
          }else{
            const target=SCRAM.elementary.find(item=>item.h===clue);
            if(!target)throw new Error(`Missing sentence: ${clue}`);
            for(const word of target.s.split(' ')){await page.locator('.arcade-token-bank').getByRole('button',{name:word,exact:true}).and(page.locator(':not([disabled])')).first().click()}
            if(count===1)await inspect(`scramble-stage-${stage}-assembled`);
            await page.getByRole('button',{name:'火車出發 →',exact:true}).click();
          }
          await page.getByRole('button',{name:/^(下一個任務|看看冒險成果) →$/}).click();
        }
      }
      await page.getByRole('heading',{name:'冒險完成！',exact:true}).waitFor();
      if(!await page.getByRole('button',{name:'關卡地圖',exact:true}).isVisible())throw new Error('Missing completion exit');
      await inspect(`${game}-stage-${stage}-won`);
    }
    if(width===390){
      await page.getByRole('button',{name:'關卡地圖',exact:true}).click();
      await page.getByRole('button',{name:/挑戰模式/}).click();
      await page.getByRole('button',{name:'開始第 1 關 →',exact:true}).click();
      if(game==='match')await page.waitForTimeout(3100);
      await inspect(`${game}-challenge`);
      await page.getByRole('button',{name:'Ⅱ 暫停',exact:true}).click();
      const paused=await page.getByTestId('arcade-clock').textContent();
      await page.waitForTimeout(1100);
      if(await page.getByTestId('arcade-clock').textContent()!==paused)throw new Error('Pause did not stop countdown');
      await page.screenshot({path:path.join(output,`${width}-${game}-pause.png`)});
      await page.getByRole('button',{name:'繼續冒險',exact:true}).click();
      await page.waitForTimeout(1100);
      if(await page.getByTestId('arcade-clock').textContent()===paused)throw new Error('Resume did not restart countdown');
      await page.getByRole('button',{name:'切換為深色模式'}).click();
      await inspect(`${game}-dark`);
      await page.getByRole('button',{name:'切換為淺色模式'}).click();
    }
    await page.getByRole('button',{name:'回到學習首頁',exact:true}).click();
    await page.locator('[data-group-id="game"]').click();
  }
  await page.reload();
  await page.getByRole('button',{name:/輕鬆練習 · .*顆星/}).first().waitFor();
  await inspect('saved-island');
  results.push({width,name:'runtime',errors,unavailableServices});
  await context.close();
}
await browser.close();
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(results,null,2));
const issues=results.filter(result=>result.overflow||result.wide?.length||result.brokenImages?.length||result.errors?.length);
console.log(JSON.stringify({screens:results.filter(result=>'overflow'in result).length,issues},null,2));
if(issues.length)process.exitCode=1;
