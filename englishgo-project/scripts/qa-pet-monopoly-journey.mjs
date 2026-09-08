import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve(process.env.QA_OUTPUT||'.superpowers/qa/pet-monopoly-journey');await fs.mkdir(output,{recursive:true});
console.log('Launching browser');
const browser=await chromium.launch({channel:'msedge',headless:true,timeout:30000}),report=[];let activePage;console.log('Browser ready');
try{
  for(const width of (process.env.QA_WIDTHS||'1440,390,320').split(',').map(Number)){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[],services=[];activePage=page;page.setDefaultTimeout(30000);report.push({width,errors,services});console.log(`${width} opening app`);
    page.on('pageerror',error=>errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error'){if(msg.location().url.includes('/.netlify/functions/'))services.push(msg.text());else errors.push(msg.text())}});
    await page.addInitScript(()=>{
      const date=new Date().toDateString(),now=new Date().toISOString();
      const fixtures={coins:0,pets:[{petId:'bunny',rarity:'N',level:2,exp:20,bond:380,hunger:80,clean:85,energy:85,lastUpdate:now},{petId:'chick',rarity:'N',level:1,exp:0,bond:0,hunger:85,clean:85,energy:85,lastUpdate:now}],petTasks:{date,counts:{playToday:2}},quiet:true,calm:true,loginBonus:{lastDate:date,streak:1,claimed:true}};
      for(const [key,value] of Object.entries(fixtures))localStorage.setItem(`eg_${key}`,JSON.stringify(value));localStorage.setItem('eg_petLocalMode','true');
      const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=array=>{if(array instanceof Uint32Array&&array.length===1){array[0]=0;return array}return original(array)};
    });
    const inspect=async name=>{
      await page.waitForTimeout(180);await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      const data=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,wide:[...document.querySelectorAll('.pet-island-journey button,.pet-island-journey section,.pet-island-journey dialog[open]')].filter(element=>{if(element.closest('dialog:not([open]),details:not([open])'))return false;const rect=element.getBoundingClientRect();return rect.width>0&&(rect.left<-2||rect.right>innerWidth+2)}).map(element=>({text:element.textContent.slice(0,65),className:element.className})),broken:[...document.images].filter(image=>image.currentSrc&&image.complete&&!image.naturalWidth).map(image=>image.currentSrc)}));
      await page.screenshot({path:path.join(output,`${width}-${name}.png`),fullPage:true,animations:'disabled'});report.push({width,name,...data});console.log(`${width} ${name}`);
    };
    const waitForAction=async()=>{try{await page.waitForFunction(()=>document.querySelector('[data-testid="pet-monopoly-result"]')||document.querySelector('[data-testid="pet-monopoly-rent-confirm"]')||document.querySelector('[data-testid="pet-monopoly-roll"]:not(:disabled)'))}catch(error){await inspect('failure-state');console.log(await page.locator('.pet-island-journey').innerText());throw error}};
    await page.goto(process.env.QA_URL||'http://127.0.0.1:5194/',{waitUntil:'domcontentloaded'});console.log('App document loaded');await page.getByText('Elementary',{exact:true}).click();await page.locator('[data-group-id="game"]').click();await page.locator('[data-module-id="petMonopoly"]').click();await page.getByTestId('pet-monopoly-setup').waitFor();await inspect('setup');
    await page.getByRole('button',{name:'10 回合 · 深度探索'}).click();await inspect('setup-ten');await page.getByRole('button',{name:'6 回合 · 輕鬆散步'}).click();
    const readPlayCount=()=>page.evaluate(()=>Number(JSON.parse(localStorage.getItem('eg_petTasks')||'null')?.counts?.playToday)||0);
    const playCountBefore=await readPlayCount();
    await page.getByTestId('pet-monopoly-start').click();await inspect('board-ready');if(await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_coins')))!==0)throw new Error('Game charged wallet on start');
    await page.getByRole('button',{name:'擲骰',exact:true}).click();await page.getByRole('button',{name:'← 返回',exact:true}).click();await page.getByRole('dialog',{name:'學習島遊戲已暫停'}).waitFor();await inspect('exit-paused');await page.waitForTimeout(1000);if(await page.getByTestId('pet-monopoly-choice-correct').count())throw new Error('Move progressed during pause');await page.getByRole('button',{name:'繼續旅行'}).click();
    for(let round=0;round<6;round++){
      console.log(`round ${round+1}`);
      if(round>0)await page.getByRole('button',{name:'擲骰',exact:true}).click();
      await page.getByTestId('pet-monopoly-choice-correct').waitFor();if(round===0)await inspect('question');
      if(round===1){await page.locator('.pm-choice:not([data-testid])').first().click();await page.getByTestId('pet-monopoly-review-next').waitFor();await inspect('answer-review');await page.getByTestId('pet-monopoly-review-next').click()}
      else await page.getByTestId('pet-monopoly-choice-correct').click();
      if(await page.getByTestId('pet-monopoly-buy').count()){if(round===0)await inspect('property-choice');await page.getByTestId('pet-monopoly-skip-buy').click()}
      await waitForAction();
      for(let step=0;step<5&&await page.getByTestId('pet-monopoly-rent-confirm').count();step++){await page.getByTestId('pet-monopoly-rent-confirm').click();await waitForAction()}
      if(round<5&&await readPlayCount()!==playCountBefore)throw new Error('Play task incremented before the game was complete');
    }
    await page.getByTestId('pet-monopoly-result').waitFor();await inspect('result');if(await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_coins')))!==22)throw new Error('Game completion payout should be 12 + 5 correct × 2');
    const playCountAfterCompletion=await readPlayCount();if(playCountAfterCompletion!==playCountBefore+1)throw new Error(`Play task should increase once: ${playCountBefore} → ${playCountAfterCompletion}`);
    await page.getByRole('button',{name:'切換為深色模式'}).click();await inspect('result-dark');await page.getByRole('button',{name:'再選一趟旅程'}).click();await inspect('setup-dark');await page.getByTestId('pet-monopoly-start').click();await page.getByRole('button',{name:'擲骰',exact:true}).click();await page.getByTestId('pet-monopoly-choice-correct').waitFor();await inspect('question-dark');
    await page.getByRole('button',{name:'← 返回',exact:true}).click();await page.getByRole('button',{name:'結束這局，回準備頁'}).click();if(await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_coins')))!==22)throw new Error('Abandoning second run changed wallet');const playCountAfterAbandon=await readPlayCount();if(playCountAfterAbandon!==playCountAfterCompletion)throw new Error('Abandoning an unfinished game incremented the play task');report.push({width,check:'playToday increments once on completion and stays unchanged on abandon',before:playCountBefore,afterCompletion:playCountAfterCompletion,afterAbandon:playCountAfterAbandon});await context.close();
  }
}catch(error){await activePage?.screenshot({path:path.join(output,'failure.png'),fullPage:true});console.log(await activePage?.locator('.pet-island-journey').innerText());throw error}finally{await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2))}
const issues=report.filter(row=>row.overflow||row.wide?.length||row.broken?.length||row.errors?.length);console.log(JSON.stringify({screens:report.filter(row=>row.name).length,issues},null,2));if(issues.length)process.exitCode=1;
