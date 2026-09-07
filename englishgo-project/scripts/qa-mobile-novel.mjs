import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
await fs.mkdir('.superpowers/qa/mobile-novel',{recursive:true});
const check=(condition,message)=>{if(!condition)throw new Error(message)};
try {
  for(const [width,height] of (process.env.QA_SIZES?process.env.QA_SIZES.split(',').map(size=>size.split('x').map(Number)):[[320,568],[360,640],[375,667],[390,844],[412,915],[844,390],[1440,900]])){
    const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
    const mobile=width<1000,click=name=>page.getByRole('button',{name,exact:true}).click();
    await page.goto(process.env.QA_URL||'http://127.0.0.1:5192/');await page.getByText('Elementary',{exact:true}).click();await click('回到學習首頁');
    await page.locator('[data-group-id="read"]').click();await page.locator('[data-module-id="novels"]').click();await page.getByTestId('novel-chapter-card-1').click();await page.getByTestId('novel-reader-panel').waitFor();
    const inspect=async(name,allowTextScroll=false)=>{
      await page.getByTestId('novel-page-turn').waitFor({state:'detached'});await page.waitForTimeout(300);
      const layout=await page.evaluate(()=>{
        const bounds=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}};
        return {height:innerHeight,scrollY,overflow:document.documentElement.scrollWidth>innerWidth+1,
          actions:bounds(document.querySelector('[data-testid="novel-page-actions"]')),
          textSizes:[...document.querySelectorAll('[data-testid="novel-page-content"]')].map(e=>({scroll:e.scrollHeight,client:e.clientHeight})),
          clippedText:[...document.querySelectorAll('[data-testid="novel-page-content"]')].some(e=>e.scrollHeight>e.clientHeight+2),
          locked:document.documentElement.classList.contains('novel-mobile-reading')};
      });
      await page.screenshot({path:`.superpowers/qa/mobile-novel/${width}x${height}-${name}.png`,fullPage:!mobile});
      check(!layout.overflow,`${width} ${name}: horizontal overflow`);
      if(mobile){check(layout.locked&&layout.scrollY===0,`${width} ${name}: document scrolled`);check(layout.actions.bottom<=layout.height&&layout.actions.top>=0,`${width} ${name}: page controls outside viewport`);if(!allowTextScroll)check(!layout.clippedText,`${width} ${name}: ordinary paragraph needs scrolling ${JSON.stringify(layout.textSizes)}`);}
      await page.screenshot({path:`.superpowers/qa/mobile-novel/${width}x${height}-${name}.png`,fullPage:!mobile});results.push({width,height,name,...layout,errors});console.log(`${width}x${height} ${name}`);return layout;
    };
    const start=await inspect('reading');
    if(mobile){await page.mouse.wheel(0,600);await inspect('wheel');await click('展開閱讀工具');const expanded=await inspect('tools');check(Math.abs(expanded.actions.bottom-start.actions.bottom)<1,'Opening tools moved page controls');await click('關閉工具面板');await click('閱讀偏好');await click('先讀英文');await click('關閉工具面板');await inspect('english');
      await click('閱讀偏好');for(let i=0;i<3&&await page.getByRole('button',{name:'A+',exact:true}).isEnabled();i++)await click('A+');await click('寬行距');await click('關閉工具面板');await inspect('large-type',true);
      await click('下一頁');await inspect('next-page',true);
      const anchor=await page.getByTestId('novel-reader-text').first().textContent();await page.setViewportSize({width:height,height:width});await page.waitForTimeout(400);check((await page.getByTestId('novel-reader-text').allTextContents()).includes(anchor),'Rotation lost reading location');await page.setViewportSize({width,height});await inspect('rotated-back',true);
      await click('☷ 目錄與書籤');const jump=page.getByRole('combobox',{name:'跳到頁面'});await jump.selectOption(await jump.locator('option').last().getAttribute('value'));await inspect('last-page',true);await click('故事小測驗');await page.getByRole('dialog').waitFor();await click('關閉工具面板');await inspect('quiz-closed',true);
      await click('返回章節列表');check(!await page.evaluate(()=>document.documentElement.classList.contains('novel-mobile-reading')),'Reader scroll lock leaked to library');await page.mouse.wheel(0,600);await page.waitForTimeout(150);check(await page.evaluate(()=>scrollY>0),'Library cannot scroll after leaving reader');results.push({width,height,name:'library-scroll-restored',errors});
    }
    check(!errors.length,errors.join('\n'));await context.close();
  }
}catch(error){results.push({error:error.stack});throw error}
finally{await browser.close();await fs.writeFile('.superpowers/qa/mobile-novel/report.json',JSON.stringify(results,null,2));}
console.log(JSON.stringify({checks:results.length,failures:results.filter(r=>r.error||r.errors?.length)},null,2));
