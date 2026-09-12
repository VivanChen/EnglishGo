import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('.superpowers/qa/pet-redesign');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),report=[];
const url=process.env.QA_URL||'http://127.0.0.1:5194/';
try{
  for(const width of (process.env.QA_WIDTHS||'1440,390,320').split(',').map(Number)){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[],services=[];
    page.setDefaultTimeout(12000);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'){if(m.location().url.includes('/.netlify/functions/'))services.push(m.text());else errors.push(m.text())}});
    report.push({width,errors,services});
    await page.addInitScript(()=>{
      if(sessionStorage.getItem('redesign-seeded'))return;sessionStorage.setItem('redesign-seeded','yes');
      const now=new Date().toISOString(),today=new Date().toDateString();
      const fixtures={pets:[{petId:'bunny',rarity:'N',level:2,exp:20,bond:380,hunger:30,clean:50,energy:40,lastUpdate:now}],eggs:[{id:'ready-chick',petId:'chick',rarity:'N',progress:10,date:now},{id:'waiting-puppy',petId:'puppy',rarity:'N',progress:4,date:now}],coins:1200,inv:{apple:2,fish:1},quiet:true,calm:true,petTasks:{date:today,counts:{srsToday:5}},claimedTasks:{date:today,ids:[]},loginBonus:{lastDate:today,streak:1,claimed:true}};
      Object.entries(fixtures).forEach(([key,value])=>localStorage.setItem(`eg_${key}`,JSON.stringify(value)));
      localStorage.setItem('eg_petLocalMode','true');localStorage.setItem('englishgo_pet_adventure_audio','off');
    });
    const inspect=async name=>{
      await page.waitForTimeout(150);
      const data=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,wide:[...document.querySelectorAll('main button,main section,main input,main select,main dialog[open]')].filter(e=>{if(e.closest('dialog:not([open])'))return false;const r=e.getBoundingClientRect();return r.width>0&&(r.left<-2||r.right>innerWidth+2)}).map(e=>({text:e.textContent.slice(0,80),class:e.className})),broken:[...document.images].filter(i=>i.currentSrc&&i.complete&&!i.naturalWidth).map(i=>i.currentSrc)}));
      await page.screenshot({path:path.join(output,`${width}-${name}.png`),fullPage:true,animations:'disabled'});report.push({width,name,...data});console.log(`${width} ${name}`);
    };
    const tab=async label=>{await page.getByRole('navigation',{name:'家園分頁'}).getByRole('button',{name:new RegExp(label)}).click()};
    await page.goto(url);await page.getByText('Elementary',{exact:true}).click();await page.locator('[data-group-id="pet"]').click();await page.locator('[data-module-id="pets"]').click();await page.getByTestId('pet-sanctuary').waitFor();await inspect('home');
    await tab('每日任務');await inspect('tasks');const money=await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_coins')));await page.getByRole('button',{name:'🎁 領取',exact:true}).click();if(await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_coins')))!==money+24)throw new Error('Task bonus not settled');
    await tab('我的夥伴');await page.getByRole('button',{name:/小兔兔.*有點餓了/}).click();await inspect('care');await page.getByTestId('pet-primary-care-action').click();await inspect('food-choice');await page.getByRole('button',{name:/選這份食物/}).first().click();await inspect('care-dialog');for(let bite=0;bite<3;bite++){await page.locator('.pc-food').click();await page.getByRole('button',{name:'餵一口'}).click();}await page.getByTestId('pet-action-complete').click();await inspect('care-result');
    const saved=await page.evaluate(()=>({pets:JSON.parse(localStorage.getItem('eg_pets')),inv:JSON.parse(localStorage.getItem('eg_inv'))}));if(saved.inv.apple!==1||saved.pets[0].journey.marks!==1)throw new Error('Care did not consume one food and award one stamp');
    await page.getByRole('button',{name:'補給商店',exact:true}).click();await inspect('shop');const buy=page.getByRole('button',{name:/買 1 份/}).first();await buy.click();await inspect('shop-bought');await page.getByRole('button',{name:'回去陪夥伴',exact:true}).click();await page.getByRole('button',{name:'← 返回',exact:true}).click();
    await tab('孵化小屋');await inspect('nursery');await page.getByRole('button',{name:'🎉 可以孵化了！點我'}).click();await inspect('hatch-result');await page.locator('[data-hatch]').click();await page.getByTestId('pet-growth-panel').waitFor();await inspect('new-friend');await page.getByRole('button',{name:'← 返回',exact:true}).click();
    await tab('夥伴圖鑑');await inspect('collection');await page.getByRole('combobox',{name:'收藏狀態'}).selectOption('egg');if(await page.locator('.ps-friend').count()!==1)throw new Error('Collection egg filter incorrect');await inspect('collection-filter');
    await tab('一起出遊');await inspect('activities');await page.getByRole('button',{name:'去選遊戲 →'}).click();await inspect('play-lobby');await page.getByRole('button',{name:'帶夥伴出發 →'}).click();await inspect('play-round');await page.getByRole('button',{name:'← 返回',exact:true}).click();await page.getByRole('dialog',{name:'離開這一局'}).waitFor();await inspect('play-exit');await page.getByRole('button',{name:'繼續一起玩'}).click();await page.getByRole('button',{name:'Ⅱ 暫停'}).click();await page.getByRole('button',{name:'結束這局，回遊樂園'}).click();await page.getByRole('button',{name:'← 返回',exact:true}).click();
    await tab('小家園');await page.getByRole('button',{name:'切換為深色模式'}).click();await inspect('home-dark');await page.getByRole('button',{name:'陪陪我的夥伴 →'}).click();await inspect('care-dark');await page.getByRole('button',{name:'補給商店',exact:true}).click();await inspect('shop-dark');
    await context.close();
  }
}finally{await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2))}
const issues=report.filter(r=>r.overflow||r.wide?.length||r.broken?.length||r.errors?.length);console.log(JSON.stringify({screens:report.filter(r=>r.name).length,issues},null,2));if(issues.length)process.exitCode=1;
