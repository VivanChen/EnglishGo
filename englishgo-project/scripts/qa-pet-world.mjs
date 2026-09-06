import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PET_ADVENTURE_QUESTIONS, PET_ADVENTURE_EXTRA_QUESTIONS } from '../src/data/petAdventureQuestions.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve(process.env.QA_DARK_ONLY?'.superpowers/qa/pet-world-dark':'.superpowers/qa/pet-world');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
const foodNames={apple:'蘋果',banana:'香蕉',fish:'魚',meat:'肉',milk:'牛奶',bread:'麵包',cake:'蛋糕',carrot:'胡蘿蔔'};
try{
for(const width of (process.env.QA_WIDTHS||'1440,390,320').split(',').map(Number)){
  const context=await browser.newContext({viewport:{width,height:width>900?1000:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[],unavailableServices=[];
  page.setDefaultTimeout(15000);
  results.push({width,errors,unavailableServices});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){if(m.location().url.includes('/.netlify/functions/'))unavailableServices.push(m.text());else errors.push(m.text())}});
  await page.addInitScript(()=>{
    if(sessionStorage.getItem('pet-qa-seeded'))return;
    sessionStorage.setItem('pet-qa-seeded','1');
    const now=new Date().toISOString();
    const fixtures={pets:[{petId:'bunny',rarity:'N',level:2,exp:20,bond:380,hunger:40,clean:85,energy:85,lastUpdate:now,journey:{marks:2,path:'kind'}}],eggs:[{id:'qa-egg',petId:'chick',rarity:'N',progress:10,date:now}],coins:1200,inv:{apple:8,fish:5},quiet:true,calm:true};
    for(const [key,value] of Object.entries(fixtures))localStorage.setItem(`eg_${key}`,JSON.stringify(value));
    localStorage.setItem('englishgo_pet_adventure_audio','off');
  });
  const inspect=async name=>{
    console.log(`${width}px ${name}`);await page.waitForTimeout(200);
    const data=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,wide:[...document.querySelectorAll('main button, main section, main input')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<-2||r.right>innerWidth+2)}).map(e=>({text:e.textContent.slice(0,65),className:e.className})),brokenImages:[...document.images].filter(i=>i.currentSrc&&i.complete&&!i.naturalWidth).map(i=>i.currentSrc)}));
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:path.join(output,`${width}-${name}.png`),fullPage:true,animations:'disabled'});results.push({width,name,...data});
  };
  const local=async()=>{await page.locator('.module-pets .pet-world').first().waitFor();const entry=page.getByRole('button',{name:'先在這台裝置養寵物 →'});if(await entry.count())await entry.click();await page.locator('.pet-home').waitFor()};
  const home=async()=>{await page.getByRole('button',{name:'回到學習首頁'}).click();await page.locator('[data-group-id="pet"]').click()};
  const open=async id=>{await page.locator(`[data-module-id="${id}"]`).click();await page.locator('.pet-world').first().waitFor()};
  await page.goto(process.env.QA_URL||'http://localhost:5190/');await page.getByText('Elementary',{exact:true}).click();await page.locator('[data-group-id="pet"]').click();await open('pets');await inspect('welcome');await local();await inspect('home');
  if(process.env.QA_DARK_ONLY){
    await page.getByRole('button',{name:'切換為深色模式'}).click();await inspect('home-dark');await page.getByRole('button',{name:'陪陪我的夥伴 →'}).click();await inspect('care-dark');await page.getByText('查看每日培養計畫與詳細狀態',{exact:true}).click();await inspect('care-expanded-dark');await home();await open('gacha');await inspect('gacha-dark');await context.close();continue;
  }
  await page.getByRole('button',{name:'陪陪我的夥伴 →'}).click();await inspect('care');await page.getByTestId('pet-primary-care-action').click();await inspect('care-lesson');await page.getByTestId('pet-action-complete').click();await page.getByTestId('pet-care-result').waitFor();
  const grown=await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_pets'))[0]);if(grown.journey.marks!==3)throw new Error('Care did not grant one growth stamp');
  await page.getByText('培育方向與家園佈置',{exact:true}).click();await page.getByRole('button',{name:/好奇學者/}).click();await page.getByRole('button',{name:/荷葉池畔/}).click();await inspect('growth-unlocked');if(await page.getByRole('button',{name:/星光營地/}).isEnabled())throw new Error('Locked habitat was selectable');
  await page.getByRole('button',{name:'去遊樂園',exact:true}).click();await inspect('play-lobby');
  for(const mode of ['picnic','memory']){
    if(mode==='memory')await page.getByRole('button',{name:/記憶尋寶/}).click();
    const levels=width===390?3:1;
    for(let level=1;level<=levels;level++){
      if(level>1)await page.getByRole('button',{name:/看看下一關/}).click();
      await page.getByRole('button',{name:'帶夥伴出發 →'}).click();await inspect(`${mode}-${level}-start`);
      if(level===1){await page.getByRole('button',{name:'Ⅱ 暫停'}).click();await inspect(`${mode}-paused`);await page.getByRole('button',{name:'繼續一起玩'}).click()}
      for(let round=0;round<3;round++){
        if(mode==='memory'){
          const route=await page.locator('.pet-memory-preview b').allTextContents();await page.getByRole('button',{name:'我記住了，開始尋寶'}).click();
          if(round===0){await inspect(`${mode}-${level}-hidden`);if(await page.locator('.pet-memory-preview').count())throw new Error('Memory route remains exposed')}
          for(const word of route)await page.locator(`[data-food="${word}"]`).click();
        }else{
          const request=await page.locator('.pet-play-puzzle h2').textContent(),word=Object.keys(foodNames).find(id=>request.includes(`「${foodNames[id]}」`));
          if(!word)throw new Error(`Unknown food request: ${request}`);
          if(round===0&&level===1){const wrong=page.locator(`[data-food]:not([data-food="${word}"])`).first();await wrong.click();await page.getByRole('button',{name:'給我一個提示'}).click();await inspect('picnic-retry-hint')}
          await page.locator(`[data-food="${word}"]`).click();
        }
        await page.getByRole('button',{name:round===2?'完成野餐，看看成果 →':'前往下一回合 →'}).click();
      }
      await inspect(`${mode}-${level}-result`);
    }
    await page.getByRole('button',{name:'回遊樂園',exact:true}).click();
  }
  await page.getByRole('button',{name:'← 返回',exact:true}).click();await page.getByRole('button',{name:'← 返回',exact:true}).click();
  await page.getByRole('button',{name:/孵化小屋/}).click();await inspect('nursery');await page.getByRole('button',{name:/可以孵化了/}).click();await page.waitForTimeout(1400);await inspect('hatching');
  const hatch=page.locator('[data-hatch]');if(await hatch.count())await hatch.click();await page.getByTestId('pet-growth-panel').waitFor();await inspect('hatched-care');
  const saved=await page.evaluate(()=>({pets:JSON.parse(localStorage.getItem('eg_pets')),eggs:JSON.parse(localStorage.getItem('eg_eggs'))}));if(saved.pets.filter(p=>p.petId==='chick').length!==1||saved.eggs.length)throw new Error('Hatching did not settle once');
  await home();await open('gacha');await inspect('gacha');const coinsBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_coins')));await page.getByRole('button',{name:/轉出一顆蛋/}).click();await page.getByRole('heading',{name:'把這份相遇帶回家'}).waitFor();await inspect('gacha-result');
  const coinsAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_coins')));if(coinsBefore-coinsAfter!==50)throw new Error('Incorrect gacha charge');await page.reload();await page.getByRole('heading',{name:'把這份相遇帶回家'}).waitFor();await inspect('gacha-restored');await page.getByRole('button',{name:'帶回家，看看蛋倉 →'}).click();await local();await page.getByRole('heading',{name:'讓英文，暖暖這顆蛋'}).waitFor();await inspect('gacha-to-nursery');
  await home();await open('petAdventure');await inspect('adventure-lobby');await page.getByRole('button',{name:'推薦隊伍',exact:true}).click();await page.getByRole('button',{name:/^開始冒險/}).click();await page.locator('[data-adventure-question-prompt]').waitFor();await inspect('adventure-battle');
  let camps=0,answers=0;
  while(await page.locator('[data-adventure-question-prompt]').count()){
    if(answers++>65)throw new Error('Adventure did not end');
    const prompt=(await page.locator('[data-adventure-question-prompt]').textContent()).trim();const choices=await page.locator('[data-adventure-answers] button').allTextContents();const question=[...PET_ADVENTURE_QUESTIONS.elementary,...PET_ADVENTURE_EXTRA_QUESTIONS.elementary].find(q=>q.q===prompt&&choices.includes(q.choices[q.answer]));
    if(!question)throw new Error(`Unknown adventure question: ${prompt}`);
    await page.locator('[data-adventure-answers]').getByRole('button',{name:question.choices[question.answer],exact:true}).click();
    const result=page.getByRole('button',{name:'查看冒險成果 →'}),camp=page.getByRole('button',{name:'前往營地補給 →'});
    if(await result.count()){await result.click();break}
    if(await camp.count()){await camp.click();await inspect(`camp-${++camps}`);if(await page.locator('[data-pet-adventure-layout]').isVisible())throw new Error('Battle overlaps the camp');await page.locator(`[data-camp-choice="${camps===1?'focus':'guard'}"]`).click()}
    else await page.getByRole('button',{name:'下一題',exact:true}).click();
  }
  if(camps!==2)throw new Error('Expected two deliberate camp choices');await inspect('adventure-result');
  await home();await page.locator('[data-group-id="game"]').click();await page.locator('[data-module-id="petMonopoly"]').click();await page.getByTestId('pet-monopoly-setup').waitFor();await inspect('monopoly-lobby');
  const beforeBoard=await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_pets'))[0].bond);
  // A reproducible first dice roll lands on an English tile; answers still go through the visible UI.
  await page.evaluate(()=>{crypto.getRandomValues=array=>{array[0]=0;return array}});
  await page.getByTestId('pet-monopoly-setup-cpu-1').click();await page.getByTestId('pet-monopoly-start').click();await page.getByTestId('pet-monopoly-roll').click();await page.getByTestId('pet-monopoly-choice-correct').waitFor();await inspect('monopoly-question');await page.getByTestId('pet-monopoly-choice-correct').click();
  const afterBoard=await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_pets'))[0]);if(afterBoard.bond<beforeBoard||!afterBoard.journey.today.includes('monopoly'))throw new Error('Monopoly lost bond or failed to leave a stamp');await inspect('monopoly-answer');
  await home();await open('pets');await local();await page.getByRole('button',{name:'切換為深色模式'}).click();await inspect('home-dark');await page.getByRole('button',{name:'陪陪我的夥伴 →'}).click();await inspect('care-dark');
  await context.close();
}
}finally{await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(results,null,2))}
const issues=results.filter(r=>r.overflow||r.wide?.length||r.brokenImages?.length||r.errors?.length);console.log(JSON.stringify({screens:results.filter(r=>r.name).length,issues},null,2));if(issues.length)process.exitCode=1;
