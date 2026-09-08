import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve(process.env.QA_OUTPUT||'.superpowers/qa/pet-island-gameplay');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),report=[];
let activePage;
try{
  for(const width of (process.env.QA_WIDTHS||'1440,390,320').split(',').map(Number)){
    const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];activePage=page;page.setDefaultTimeout(30000);
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!message.location().url.includes('/.netlify/'))errors.push(message.text())});
    await page.addInitScript(()=>{
      const date=new Date().toDateString(),now=new Date().toISOString();
      const values={quiet:false,calm:false,coins:0,petTasks:{date,counts:{playToday:0}},loginBonus:{lastDate:date,streak:1,claimed:true},pets:[{petId:'bunny',rarity:'N',level:2,bond:180,exp:20,hunger:80,energy:80,lastUpdate:now}]};
      Object.entries(values).forEach(([key,value])=>localStorage.setItem(`eg_${key}`,JSON.stringify(value)));
      // Keep the first route at one step for a reproducible construction journey.
      window.__islandAudio=[];window.__islandNotes=0;const Native=window.AudioContext;
      if(Native)window.AudioContext=class extends Native{constructor(...args){super(...args);window.__islandAudio.push(this)}createOscillator(){const node=super.createOscillator(),start=node.start.bind(node);node.start=(...args)=>{window.__islandNotes++;return start(...args)};return node}};
      const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=array=>{if(array instanceof Uint32Array&&array.length===1){array[0]=0;return array}return original(array)};
    });
    const capture=async(name,expectedRenderer='ready')=>{
      await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(250);
      const check=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,broken:[...document.images].filter(i=>i.currentSrc&&i.complete&&!i.naturalWidth).map(i=>i.currentSrc),renderer:document.querySelector('[data-testid="pet-island-scene"]')?.dataset.renderer,drawCalls:document.querySelector('.p3-canvas')?.dataset.drawCalls}));
      await page.screenshot({path:path.join(output,`${width}-${name}.png`),fullPage:true,animations:'disabled'});report.push({width,name,expectedRenderer,...check});console.log(`${width} ${name}: ${check.renderer}`);
    };
    await page.goto(process.env.QA_URL||'http://127.0.0.1:5195/');await page.getByText('Elementary',{exact:true}).click();await page.locator('[data-group-id="game"]').click();await page.locator('[data-module-id="petMonopoly"]').click();await page.getByTestId('pet-monopoly-setup').waitFor();
    await page.waitForFunction(()=>document.querySelector('[data-testid="pet-island-scene"]')?.dataset.renderer==='ready');await capture('setup');
    if(process.env.QA_SMOKE_ONLY){
      await page.getByRole('checkbox').check();await page.getByTestId('pet-monopoly-start').click();await page.locator('.p3-tool-shop summary').click();await capture('shop');
      await page.getByTestId('pet-island-shop-control').click();if(await page.getByTestId('pet-monopoly-player-cash').innerText()!=='90')throw new Error('Tool price mismatch');
      await page.getByTestId('pet-monopoly-card-control').click();await page.getByTestId('pet-monopoly-roll').click();if(await page.locator('[data-testid^="pet-island-route-"]').count()!==6)throw new Error('Remote die choices missing');await capture('remote-die');
      await page.getByTestId('pet-island-route-0').click();await page.getByTestId('pet-monopoly-buy').waitFor();await page.getByTestId('pet-monopoly-skip-buy').click();await page.waitForFunction(()=>document.querySelector('[data-testid="pet-monopoly-roll"]:not(:disabled)'));
      const cash=await page.getByTestId('pet-monopoly-player-cash').innerText();await page.getByTestId('pet-island-learning').click();await capture('optional-English');await page.locator('.pm-choice:not([data-testid])').first().click();if(await page.getByTestId('pet-monopoly-player-cash').innerText()!==cash)throw new Error('Wrong English answer changed game cash');
      await page.getByRole('button',{name:'減少動畫',exact:true}).click();await page.getByTestId('pet-monopoly-card-shield').click();if(await page.getByTestId('pet-island-fx').isVisible())throw new Error('Reduced motion still shows effect');await capture('calm');
      await page.getByRole('button',{name:'切換為深色模式'}).click();await capture('dark-calm');report.push({width,errors,complete:true,check:'shop cost, six routes, optional English, reduced motion'});await context.close();continue;
    }
    if(process.env.QA_SHOTS_ONLY){await page.getByRole('button',{name:'切換為深色模式'}).click();await capture('setup-dark');await context.close();continue}
    await page.getByTestId('pet-monopoly-start').click();await capture('ready');
    await page.getByTestId('pet-monopoly-card-rent').click();if(!await page.getByTestId('pet-island-fx').count())throw new Error('No visual effect for tool use');await capture('tool-effect');
    if(width===1440){
      const canvas=page.locator('.p3-canvas canvas'),bounds=await canvas.boundingBox();
      const initialPlace=await page.locator('.p3-inspect h3').innerText();
      await canvas.click({position:{x:bounds.width*.2,y:bounds.height*.56}});
      const pickedPlace=await page.locator('.p3-inspect h3').innerText();
      if(initialPlace===pickedPlace)throw new Error('Clicking a 3D building did not select its place');
      const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
      const before=hash(await canvas.screenshot());
      await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.52,{steps:12});await page.mouse.up();await page.waitForTimeout(700);
      if(before===hash(await canvas.screenshot()))throw new Error('Dragging did not rotate the island');
      await capture('rotated');await page.getByRole('button',{name:'重設棋盤視角'}).click();await page.getByRole('button',{name:'拉近棋盤'}).click();await capture('zoomed');await page.getByRole('button',{name:'重設棋盤視角'}).click();
      report.push({width,check:'3D ray picking, orbit rotation, zoom and reset',initialPlace,pickedPlace});
    }
    await page.getByTestId('pet-monopoly-roll').click();await capture('routes');
    const target=await page.getByTestId('pet-island-route-0').innerText();await page.getByRole('button',{name:'暫停遊戲'}).click();await capture('paused');await page.getByRole('button',{name:'繼續旅行'}).click();if(await page.getByTestId('pet-island-route-0').innerText()!==target)throw new Error('Pausing changed route choices');
    const waitForTurn=async()=>{
      for(let i=0;i<12;i++){
        await page.waitForFunction(()=>document.querySelector('[data-testid="pet-monopoly-rent-confirm"]')||document.querySelector('[data-testid="pet-monopoly-roll"]:not(:disabled)')||document.querySelector('[data-testid="pet-monopoly-result"]'));
        if(await page.getByTestId('pet-monopoly-rent-confirm').count()){await page.getByTestId('pet-monopoly-rent-confirm').click();continue}return;
      }throw new Error('Turn did not finish');
    };
    for(let round=0;round<6;round++){
      if(round>0)await page.getByTestId('pet-monopoly-roll').click();
      await page.getByTestId('pet-island-route-0').click();await page.waitForFunction(()=>document.querySelector('[data-testid="pet-monopoly-buy"]')||document.querySelector('[data-testid="pet-island-event-card"]')||document.querySelector('[data-testid="pet-monopoly-rent-confirm"]'));
      if(await page.getByTestId('pet-monopoly-choice-correct').count())throw new Error('English blocked gameplay');
      if(await page.getByTestId('pet-island-event-card').count()){await capture(`event-${round}`);await page.locator('[data-testid^="pet-island-event-option-"]:enabled').first().click()}
      if(await page.getByTestId('pet-monopoly-buy').count()){
        if(round===0)await capture('offer');
        const buy=page.getByTestId('pet-monopoly-buy');await (await buy.isEnabled()?buy:page.getByTestId('pet-monopoly-skip-buy')).click();
      }
      await waitForTurn();
      if(round===0){
        await page.getByRole('button',{name:/升級 30 旅費/}).click();await capture('upgraded');
        if(await page.getByTestId('pet-monopoly-tile-word-market').getAttribute('data-owner-level')!=='2')throw new Error('Upgrade did not update ownership');
      }
    }
    await page.getByTestId('pet-monopoly-result').waitFor();await capture('result');
    const saved=await page.evaluate(()=>({coins:JSON.parse(localStorage.getItem('eg_coins')),tasks:JSON.parse(localStorage.getItem('eg_petTasks'))}));
    const resultText=await page.getByTestId('pet-monopoly-result').innerText();const expected=12+(resultText.includes('冠軍 6')?6:0)+(resultText.includes('島主挑戰 8')?8:0);if(saved.coins!==expected||saved.tasks.counts.playToday!==1)throw new Error(`Incorrect gameplay payout: ${JSON.stringify(saved)}`);
    const audio=await page.evaluate(()=>({notes:window.__islandNotes,states:window.__islandAudio.map(a=>a.state)}));if(!audio.notes||!audio.states.includes('running'))throw new Error('No real Web Audio effects');report.push({width,check:'audio synthesis and no-English game completion',...audio,saved});
    await page.getByRole('button',{name:'切換為深色模式'}).click();await capture('result-dark');
    await page.getByRole('button',{name:'再選一趟旅程'}).click();await capture('setup-dark');
    await page.getByTestId('pet-monopoly-start').click();await page.getByTestId('pet-monopoly-roll').click();await page.getByTestId('pet-island-route-1').click();await page.getByTestId('pet-monopoly-buy').waitFor();await capture('offer-dark');
    if(width===1440||width===320){
      const question=await page.getByTestId('pet-monopoly-deal').innerText();
      await page.locator('.p3-canvas canvas').evaluate(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
      await page.getByRole('button',{name:'重新載入立體島嶼'}).waitFor();await capture('webgl-fallback','fallback');
      if(await page.getByTestId('pet-monopoly-deal').innerText()!==question)throw new Error('Context loss reset the game');
      await page.getByRole('button',{name:'重新載入立體島嶼'}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="pet-island-scene"]')?.dataset.renderer==='ready');await capture('webgl-restored');
    }
    await page.getByTestId('pet-monopoly-skip-buy').click();await waitForTurn();
    await page.getByTestId('pet-monopoly-card-control').click();await page.getByTestId('pet-monopoly-roll').click();await page.getByTestId('pet-island-route-2').click();await page.getByTestId('pet-island-event-card').waitFor();if(!await page.getByTestId('pet-island-event-card').innerText().then(t=>t.includes('FATE')))throw new Error('Expected fate deck at tile 9');await capture('fate');await page.locator('[data-testid^="pet-island-event-option-"]:enabled').first().click();await waitForTurn();
    await page.getByRole('button',{name:'♪ 音效開啟',exact:true}).click();const notes=await page.evaluate(()=>window.__islandNotes);await page.getByTestId('pet-monopoly-roll').click();await page.waitForTimeout(200);if(await page.evaluate(()=>window.__islandNotes)!==notes)throw new Error('Sound continued after muting');
    report.push({width,check:'mute stops new notes; fate reachable through remote die'});
    await page.getByRole('button',{name:'← 返回',exact:true}).click();await page.getByRole('button',{name:'結束這局，回準備頁'}).click();
    if(await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_coins')))!==expected)throw new Error('Leaving duplicated a reward');
    report.push({width,errors,complete:true});await context.close();
  }
}catch(error){await activePage?.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error}finally{await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2))}
const issues=report.filter(row=>row.overflow||row.broken?.length||row.errors?.length||row.renderer&&row.renderer!==row.expectedRenderer);console.log(JSON.stringify({screens:report.filter(row=>row.name).length,issues},null,2));if(issues.length)process.exitCode=1;
