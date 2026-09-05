import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const modulePath=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(modulePath?pathToFileURL(modulePath).href:'playwright');
const output=path.resolve('.superpowers/qa/learning-experience');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
const results=[];
for(const width of [1440,390,320]){
  const ctx=await browser.newContext({viewport:{width,height:width>900?1000:844},serviceWorkers:'block'});
  const page=await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errors=[],failed=[],unavailableServices=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'){const location=m.location().url||'';if(location.includes('/.netlify/functions/'))unavailableServices.push({url:location,message:m.text()});else errors.push(m.text())}});
  page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
  const inspect=async(name)=>{
    console.log(`Checking ${width}px ${name}`);
    await page.waitForTimeout(250);
    const issues=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,wide:[...document.querySelectorAll('main button,main input,main section')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+2}).slice(0,8).map(e=>({text:e.textContent.slice(0,60),className:e.className})),brokenImages:[...document.images].filter(i=>i.currentSrc&&i.complete&&!i.naturalWidth).map(i=>i.currentSrc)}));
    await page.screenshot({path:path.join(output,`${width}-${name}.png`),fullPage:true});
    results.push({width,name,...issues});
  };
  await page.goto(process.env.QA_URL||'http://localhost:5190/');
  await page.getByText('Elementary',{exact:true}).waitFor();
  await inspect('welcome');
  await page.getByText('Elementary',{exact:true}).click();
  await page.getByRole('button',{name:'開始 5 張單字小任務'}).waitFor();
  await inspect('home');
  await page.getByRole('button',{name:'開始 5 張單字小任務'}).click();
  await page.getByTestId('srs-card').waitFor();
  await inspect('srs-front');
  await page.getByRole('button',{name:'點卡片看答案'}).click();
  await inspect('srs-back');
  const ratingPosition=await page.getByTestId('srs-rating-bar').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,viewportHeight:innerHeight}});
  results.push({width,name:'rating-visible',...ratingPosition});
  await page.getByTestId('srs-dictionary-action').click();
  await inspect('srs-dictionary');
  await page.getByRole('button',{name:'Close dictionary'}).click();
  for(let i=0;i<5;i++){
    if(i)await page.getByRole('button',{name:'點卡片看答案'}).click();
    await page.getByRole('button',{name:/記住了/}).click();
    await page.waitForTimeout(210);
  }
  await page.getByRole('heading',{name:'練習完成！共 5 張'}).waitFor();
  await inspect('mission-complete');
  await page.getByRole('button',{name:'回到學習首頁'}).click();
  for(const group of ['read','game','pet','tools']){
    await page.locator(`[data-group-id="${group}"]`).click();
    await page.waitForTimeout(100);
    const navigation=await page.locator('#eg-learning-panel [data-module-id]').first().evaluate(element=>{const r=element.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight}});
    if(navigation.top<70||navigation.top>navigation.height-100)throw new Error(`Category ${group} did not bring activities into view at ${width}px: ${JSON.stringify(navigation)}`);
    await inspect(`group-${group}`);
    if(width<860){
      await page.getByRole('button',{name:'↑ 換個分類',exact:true}).click();
      await page.locator(`[data-group-id="${group}"]`).evaluate(element=>{if(document.activeElement!==element)throw new Error('Category focus was not restored')});
    }
  }
  for(const [group,mod,name] of [['read','novels','novels'],['read','songs','songs'],['pet','pets','pets'],['tools','settings','settings'],['learn','wordsearch','dictionary'],['game','match','matching']]){
    await page.locator(`[data-group-id="${group}"]`).click();
    await page.locator(`[data-module-id="${mod}"]`).click();
    await page.waitForTimeout(600);
    await inspect(name);
    if(mod==='novels'){
      await page.getByText('The Whispering Tree',{exact:true}).click();
      await page.getByTestId('novel-immersive-shell').waitFor();
      await inspect('novel-reading');
      await page.getByRole('button',{name:'下一頁',exact:true}).click();
      await inspect('novel-next-page');
    }
    if(mod==='songs'){
      await page.getByRole('button',{name:'播放',exact:true}).click();
      await page.waitForFunction(()=>{const a=document.querySelector('audio');return a&&!a.paused&&a.currentTime>0});
      results.push({width,name:'song-playback',...await page.locator('audio').evaluate(a=>({currentTime:a.currentTime,duration:a.duration,paused:a.paused,src:a.currentSrc}))});
      await page.getByRole('button',{name:'暫停',exact:true}).click();
      await inspect('song-player');
    }
    await page.getByRole('button',{name:'回到學習首頁'}).click();
  }
  if(process.env.QA_FULL==='1'){
    const additionalModules={learn:['exam','quiz','grammar','speak','ai','translate'],read:['reading','dictation','story'],game:['whack','bomb','scramble','petMonopoly'],pet:['gacha','petAdventure'],tools:['achievements','weak','dashboard']};
    for(const [group,ids] of Object.entries(additionalModules))for(const id of ids){
      await page.locator(`[data-group-id="${group}"]`).click();
      await page.locator(`[data-module-id="${id}"]`).click();
      await page.waitForTimeout(450);
      await inspect(`module-${id}`);
      if(id==='reading'){
        await page.getByRole('combobox',{name:'選擇短文'}).selectOption('4');
        await page.getByRole('heading',{name:"Tom's New Bike",exact:true}).waitFor();
        await inspect('reading-select-article');
        await page.getByRole('button',{name:'看中文提示',exact:true}).click();
        await page.getByRole('button',{name:'大字閱讀',exact:true}).click();
        await inspect('reading-large-hints');
        await page.getByRole('button',{name:'Red',exact:true}).click();
        await inspect('reading-retry');
        await page.getByRole('button',{name:'再試一次',exact:true}).click();
        await page.getByRole('button',{name:'Blue',exact:true}).click();
        await page.reload();
        await page.getByRole('heading',{name:"Tom's New Bike",exact:true}).waitFor();
        if(!await page.getByRole('button',{name:/^Blue/}).isDisabled())throw new Error('Reading answer was lost after reload');
        if(await page.getByRole('button',{name:'大字閱讀',exact:true}).getAttribute('aria-pressed')!=='true')throw new Error('Reading preference was lost');
        await page.getByRole('button',{name:'For safety',exact:true}).click();
        await page.getByRole('region',{name:'短文練習完成'}).waitFor();
        await inspect('reading-complete');
        const xp=await page.evaluate(()=>localStorage.getItem('eg_xp'));
        await page.getByRole('button',{name:'重做本篇',exact:true}).click();
        await page.getByRole('button',{name:'Blue',exact:true}).click();
        await page.getByRole('button',{name:'For safety',exact:true}).click();
        if(await page.evaluate(()=>localStorage.getItem('eg_xp'))!==xp)throw new Error('Reading repeated a previously earned reward');
        await page.getByRole('button',{name:'切換為深色模式'}).click();
        await inspect('reading-dark');
        await page.getByRole('button',{name:'切換為淺色模式'}).click();
      }
      await page.getByRole('button',{name:'回到學習首頁'}).click();
    }
  }
  await page.getByRole('button',{name:'切換為深色模式'}).click();
  await inspect('dark');
  await page.getByRole('button',{name:'減少動畫',exact:true}).click();
  results.push({width,name:'reduced-motion',active:await page.locator('html').getAttribute('data-eg-calm')});
  results.push({width,name:'runtime',errors,failed,unavailableServices});
  await ctx.close();
}
await browser.close();
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.overflow||r.wide?.length||r.brokenImages?.length||r.errors?.length||(r.name==='rating-visible'&&(r.top<0||r.bottom>r.viewportHeight))))process.exitCode=1;
