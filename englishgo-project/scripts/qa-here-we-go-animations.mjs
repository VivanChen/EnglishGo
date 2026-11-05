import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.QA_URL||'http://127.0.0.1:5201';
const output=path.resolve('tmp/here-we-go-book1/browser');
await fs.mkdir(output,{recursive:true});
const audio=await fs.readFile('public/audio/pet-town/water.wav');
const courses=JSON.parse(await fs.readFile('src/data/hanlinHereWeGoCourses.json','utf8'));
const results=[];
const browser=await chromium.launch({headless:true,channel:'msedge'});
const assert=(condition,message)=>{if(!condition)throw Error(message)};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
  for(const width of [1440,390,320]){
    const context=await browser.newContext({viewport:{width,height:width>900?1000:844},serviceWorkers:'block',reducedMotion:'no-preference'});
    const page=await context.newPage();page.setDefaultTimeout(30000);
    const errors=[],failed=[],externalMedia=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    page.on('requestfailed',request=>{if(request.failure()?.errorText!=='net::ERR_ABORTED')failed.push({url:request.url(),error:request.failure()?.errorText})});
    page.on('request',request=>{if(/api\.openai\.com|giphy|tenor/i.test(request.url()))externalMedia.push(request.url())});
    await context.route('**/.netlify/functions/*tts*',route=>route.fulfill({status:200,contentType:'audio/wav',body:audio}));
    await context.addInitScript(()=>{
      if(!sessionStorage.getItem('book1-animation-qa')){
        sessionStorage.setItem('book1-animation-qa','1');
        localStorage.setItem('eg_progress_version','seabreeze-20261030');
        localStorage.setItem('eg_quiet','true');localStorage.setItem('eg_calm','true');
        localStorage.setItem('eg_loginBonus',JSON.stringify({lastDate:new Date().toDateString(),streak:1,claimed:true}));
      }
      Math.random=()=>.999999;
    });
    const inspect=async name=>{
      const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,
        brokenImages:[...document.images].filter(image=>image.currentSrc&&image.complete&&!image.naturalWidth).map(image=>image.currentSrc)}));
      assert(!state.overflow&&!state.brokenImages.length,JSON.stringify({width,name,...state}));
      await page.screenshot({path:path.join(output,`${width}-${name}.png`),fullPage:true,animations:'disabled'});
      results.push({width,name,...state});console.log(`${width}px ${name}: passed`);
    };
    let visit=0;
    const enterBrowser=async()=>{
      // Distinct URLs start a new history entry instead of restoring the prior SRS session.
      await page.goto(`${base}/?animationQa=${++visit}`);await page.getByText('Elementary',{exact:true}).click();
      await page.getByRole('button',{name:/約 5 分鐘 單字卡/}).click();
      await page.getByText('依範圍挑字練習／預覽單字',{exact:true}).click();
    };
    const start=async(word,book=1)=>{
      await page.getByLabel('Here We Go 冊次',{exact:true}).selectOption(`hanlin-here-we-go-${book}`);
      await page.getByLabel('Here We Go 練習範圍',{exact:true}).selectOption('all');
      await page.getByLabel('搜尋 Here We Go 單字',{exact:true}).fill(word);
      await page.getByRole('button',{name:'練習目前範圍',exact:true}).click();
      await page.getByTestId('srs-front-media').waitFor();
    };
    const gif='/images/vocabulary/here-we-go-book-1-gifs/dog.gif';
    const poster='/images/vocabulary/hanlin-watercolor/dog.webp';
    await enterBrowser();
    await page.getByLabel('搜尋 Here We Go 單字',{exact:true}).fill('dog');
    await inspect('book1-preview');
    const gifRequests=[];page.on('request',request=>{if(request.url().endsWith(gif))gifRequests.push(request.url())});
    await start('dog');
    const front=page.getByTestId('srs-front-media').locator('img');await front.evaluate(image=>image.decode());
    assert(await front.getAttribute('src')===poster,'Book 1 front did not retain its original image');
    assert(!gifRequests.length,'The animation was fetched before reveal');await inspect('front-image');
    await page.getByRole('button',{name:'點卡片看答案',exact:true}).click();
    const art=page.getByTestId('srs-back-illustrations').locator('img');await art.evaluate(image=>image.decode());
    assert(await art.getAttribute('src')===gif,'Revealed card did not use its GIF');
    const frame=hash(await art.screenshot());let moved=false;
    for(let i=0;i<4&&!moved;i++){await page.waitForTimeout(230);moved=hash(await art.screenshot())!==frame;}
    assert(moved,'The browser displayed a static frame instead of playing the animation');
    await inspect('back-animation');
    await page.getByRole('button',{name:'暫停 dog 動畫',exact:true}).click();
    assert(await art.getAttribute('src')===poster,'Pause did not restore the poster');await inspect('paused');
    await page.getByRole('button',{name:'播放 dog 動畫',exact:true}).click();
    assert(await art.getAttribute('src')===gif,'Animation did not resume');
    await page.getByTestId('srs-dictionary-action').click();await page.getByTestId('srs-local-dictionary').waitFor();
    await inspect('dictionary');await page.getByRole('button',{name:'Close dictionary',exact:true}).click();
    await page.getByRole('button',{name:/翻回/}).click();
    assert(await front.getAttribute('src')===poster,'Flip-back did not restore the original image');
    await inspect('flip-back-image');
    await context.route(`**${gif}`,route=>route.fulfill({status:200,contentType:'image/gif',body:'intentionally-invalid-image-for-fallback-qa'}));
    // A fresh document avoids reusing Chromium's already-decoded GIF in memory.
    await page.reload();await page.getByTestId('srs-front-media').waitFor();
    await page.getByRole('button',{name:'點卡片看答案',exact:true}).click();
    await page.getByText('目前顯示原圖',{exact:true}).waitFor();
    assert(await art.getAttribute('src')===poster,'Failed GIF did not fall back to the original image');
    await inspect('failed-animation-fallback');
    await page.getByTestId('srs-rating-bar').scrollIntoViewIfNeeded();
    const rating=await page.getByTestId('srs-rating-bar').evaluate(element=>{const r=element.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight}});
    assert(rating.top>=0&&rating.bottom<=rating.height+1,'Rating buttons were clipped');
    await enterBrowser();await start(courses[1].words[0],2);
    await page.getByRole('button',{name:'點卡片看答案',exact:true}).click();
    assert(await page.locator('img[data-media-kind="animation"]').count()===0,'Another book unexpectedly received a Book 1 animation');
    await inspect('book2-static');
    await enterBrowser();await page.emulateMedia({reducedMotion:'reduce'});await start('dog');
    await page.getByRole('button',{name:'點卡片看答案',exact:true}).click();
    assert(await art.getAttribute('src')===poster,'Reduced-motion preference was ignored');
    await inspect('reduced-motion');
    assert(!errors.length&&!failed.length&&!externalMedia.length,JSON.stringify({width,errors,failed,externalMedia}));
    results.push({width,animationPlayed:true,noGifBeforeReveal:true,errors,failed,externalMedia});
    await context.close();
  }
}finally{
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
  await browser.close();
}
console.log(`Passed ${results.filter(result=>result.name).length} responsive screen checks.`);
