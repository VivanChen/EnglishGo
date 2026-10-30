import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PROGRESS_VERSION, PROGRESS_VERSION_KEY } from '../src/data/progressReset.js';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || 'C:/Users/vevanchen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser = await chromium.launch({channel:'msedge',headless:true}), results=[];
try {
  for (const width of [1440,390]) {
    const page = await browser.newPage({viewport:{width,height:900},deviceScaleFactor:width<900?2:1,serviceWorkers:'block'});
    await page.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await page.addInitScript(({key,version})=>{
      localStorage.setItem(key,version); localStorage.setItem('eg_quiet','true');
      window.petDraws=0;
      const getContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(...args){
        const gl=getContext.apply(this,args);
        if(gl && /^webgl/.test(args[0]) && !gl.petMeter){
          gl.petMeter=true;
          for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) {
            const original=gl[name]; if(original) gl[name]=function(...values){window.petDraws++;return original.apply(this,values);};
          }
        }
        return gl;
      };
    },{key:PROGRESS_VERSION_KEY,version:PROGRESS_VERSION});
    await page.goto((process.env.QA_URL||'http://127.0.0.1:5202/')+'?view=pets&lv=elementary',{waitUntil:'domcontentloaded',timeout:60000});
    await page.getByRole('button',{name:'和凪凪一起回家',exact:true}).click();
    await page.locator('[data-renderer="ready"]').waitFor({timeout:60000});
    await page.locator('.town-scene-wrap').scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
    const frames=await page.evaluate(()=>new Promise(resolve=>{
      const times=[],calls=[]; let last=window.petDraws,start=performance.now();
      function sample(time){
        const count=window.petDraws-last;last=window.petDraws;
        if(count){times.push(time);calls.push(count);}
        if(time-start<5000)requestAnimationFrame(sample);
        else {const gaps=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);resolve({fps:(times.length-1)*1000/(times.at(-1)-times[0]),p95FrameMs:gaps[Math.floor(gaps.length*.95)],drawCallsPerFrame:calls.reduce((a,b)=>a+b,0)/calls.length});}
      }requestAnimationFrame(sample);
    }));
    const start=Date.now(); await page.getByRole('button',{name:/^去窗邊綠盆栽：/}).click();
    await page.waitForFunction(()=>{const c=document.querySelector('.town-scene canvas');return c?.dataset.environmentTarget==='placement-harbor-planter'&&c.dataset.petAction==='sniff'&&c.dataset.petMoving==='false';},null,{timeout:30000});
    results.push({width,...frames,walkToPlanterMs:Date.now()-start}); await page.close();
  }
} finally {await browser.close();}
await fs.mkdir('.superpowers/qa/pet-performance',{recursive:true});
await fs.writeFile(`.superpowers/qa/pet-performance/${process.env.BENCH_LABEL||'latest'}.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
