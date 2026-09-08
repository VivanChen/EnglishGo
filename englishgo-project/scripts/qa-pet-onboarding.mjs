import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('.superpowers/qa/pet-onboarding');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),report=[];
try{
  for(const width of (process.env.QA_WIDTHS||'1440,390,320').split(',').map(Number)){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{localStorage.setItem('eg_quiet','true');localStorage.setItem('eg_calm','true');localStorage.setItem('eg_loginBonus',JSON.stringify({lastDate:new Date().toDateString(),streak:1,claimed:true}));});
    const inspect=async name=>{const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);await page.screenshot({path:path.join(output,`${width}-${name}.png`),fullPage:true,animations:'disabled'});report.push({width,name,overflow});console.log(`${width} ${name}`)};
    await page.goto(process.env.QA_URL||'http://127.0.0.1:5194/');await page.getByText('Elementary',{exact:true}).click();await page.locator('[data-group-id="pet"]').click();await page.locator('[data-module-id="pets"]').click();await page.getByRole('button',{name:'先在這台裝置養寵物 →'}).waitFor();await inspect('welcome');await page.getByRole('button',{name:'先在這台裝置養寵物 →'}).click();await inspect('first-home');await page.getByRole('button',{name:'迎接第一位夥伴 →'}).click();await inspect('adoption');await page.getByRole('button',{name:'領養這位夥伴的蛋 →'}).click();await inspect('starter-egg');
    const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_eggs')));if(before.length!==1||before[0].progress!==7)throw new Error('Starter egg not granted exactly once');
    await page.getByRole('button',{name:'學單字，陪蛋長大 →'}).click();await page.getByRole('button',{name:/全部單字，\d+ 個單字/}).click();await inspect('first-learning');
    for(let i=0;i<3;i++){
      await page.getByRole('button',{name:'點卡片看答案'}).click();
      // SRS rejects repeat ratings within 180 ms; allow time to read the card.
      await page.waitForTimeout(250);
      await page.getByRole('button',{name:/記住了.*Good/}).click();
      await page.waitForFunction(count=>JSON.parse(localStorage.getItem('eg_petTasks'))?.counts?.srsToday===count,i+1);
    }
    const learned=await page.evaluate(()=>({eggs:JSON.parse(localStorage.getItem('eg_eggs')),tasks:JSON.parse(localStorage.getItem('eg_petTasks'))}));if(learned.eggs[0].progress!==10||learned.tasks.counts.srsToday!==3)throw new Error(`Real learning did not advance starter egg: ${JSON.stringify(learned)}`);
    await page.getByRole('button',{name:'回到學習首頁'}).click();await page.locator('[data-group-id="pet"]').click();await page.locator('[data-module-id="pets"]').click();await page.getByRole('navigation',{name:'家園分頁'}).getByRole('button',{name:/孵化小屋/}).click();await page.getByRole('button',{name:'🎉 可以孵化了！點我'}).click();await inspect('first-hatch');await page.locator('[data-hatch]').click();await inspect('first-companion');
    await page.reload();await page.getByTestId('pet-sanctuary').waitFor();const saved=await page.evaluate(()=>({pets:JSON.parse(localStorage.getItem('eg_pets')),eggs:JSON.parse(localStorage.getItem('eg_eggs')),inv:JSON.parse(localStorage.getItem('eg_inv'))}));if(saved.pets.length!==1||saved.eggs.length||saved.inv.apple!==3)throw new Error('Onboarding save failed');
    report.push({width,errors,completed:true});await context.close();
  }
}finally{await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2))}
const issues=report.filter(row=>row.overflow||row.errors?.length);console.log(JSON.stringify({screens:report.filter(row=>row.name).length,issues},null,2));if(issues.length)process.exitCode=1;
