import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});const report=[];const out='.superpowers/qa/pet-landscape';await fs.mkdir(out,{recursive:true});
try{for(const mode of [{width:844,height:390,petId:'kitty'},{width:667,height:375,petId:'bunny'},{width:568,height:320,petId:'puppy'},{width:390,height:844,petId:'bunny',unsupported:true}]){
 const {width,height,petId,unsupported}=mode;const page=await browser.newPage({viewport:{width,height},hasTouch:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('/.netlify/'))errors.push(m.text())});
 await page.addInitScript(({petId,unsupported})=>{if(unsupported)Element.prototype.requestFullscreen=undefined;const now=new Date().toISOString();for(const [k,v] of Object.entries({pets:[{petId,rarity:'N',level:3,exp:0,bond:0,hunger:30,clean:40,energy:80,lastUpdate:now}],inv:{apple:3},eggs:[],coins:200,quiet:true,loginBonus:{lastDate:new Date().toDateString(),claimed:true,streak:1}}))localStorage.setItem('eg_'+k,JSON.stringify(v));localStorage.setItem('eg_petLocalMode','true')},{petId,unsupported});
 const saved=()=>page.evaluate(()=>({pet:JSON.parse(localStorage.getItem('eg_pets'))[0],coins:JSON.parse(localStorage.getItem('eg_coins'))}));
 const click=async locator=>locator.click();
 const inspect=async label=>{if(await page.evaluate(()=>innerWidth>innerHeight)){const contained=await page.evaluate(()=>{const root=document.querySelector('.pet-showcase').getBoundingClientRect(),center=document.querySelector('.showcase-center').getBoundingClientRect();return center.bottom<=root.bottom+1});if(!contained)throw Error('Character panel exceeds landscape viewport')} await page.getByTestId('pet-showcase').scrollIntoViewIfNeeded();await page.getByTestId('pet-showcase').screenshot({path:`${out}/${width}-${label}.png`});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow||errors.length)throw Error(JSON.stringify({mode,label,overflow,errors}));report.push({...mode,label,overflow,errors:[...errors]})};
 await page.goto(process.env.QA_URL||'http://127.0.0.1:5196');await page.getByText('Elementary',{exact:true}).click();await page.locator('[data-group-id="pet"]').click();await page.locator('[data-module-id="pets"]').click();await page.getByRole('button',{name:'陪陪我的夥伴 →'}).click();
 await page.locator('.showcase-center [data-renderer="ready"]').waitFor();await inspect('overview');
 await click(page.getByRole('button',{name:'橫向全螢幕'}));
 if(unsupported){await page.getByText(/目前瀏覽器不支援此全螢幕功能/).waitFor();await inspect('portrait-hint');await page.setViewportSize({width:844,height:390})}
 else{await page.waitForFunction(()=>!!document.fullscreenElement);await inspect('fullscreen');const contained=await page.evaluate(()=>{const panel=document.querySelector('.showcase-panel').getBoundingClientRect();return [...document.querySelectorAll('.showcase-actions button')].every(el=>{const r=el.getBoundingClientRect();return r.top>=panel.top&&r.bottom<=panel.bottom&&r.left>=panel.left&&r.right<=panel.right})});if(!contained)throw Error('Landscape care shortcuts are clipped');}
 for(const action of ['餵食','洗澡','玩耍','休息','讀書']){
  await click(page.getByRole('button',{name:action,exact:true}));if(action==='餵食')await click(page.getByRole('button',{name:/選這份食物/}));await page.locator('.pc-stage [data-renderer="ready"]').waitFor();await inspect(action);
  if(action==='餵食'){
   await click(page.locator('.pc-food'));await click(page.getByRole('button',{name:'餵一口'}));
   if(unsupported){await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.pc-progress progress')?.value===1);await page.setViewportSize({width:844,height:390})}
   for(let i=0;i<2;i++){await click(page.locator('.pc-food'));await click(page.getByRole('button',{name:'餵一口'}))}
  }else if(action==='洗澡'){for(let n=1;n<=4;n++)await click(page.getByRole('button',{name:`擦洗第 ${n} 處髒污`}))}
  else if(action==='玩耍'){for(let n=0;n<3;n++){await click(page.getByRole('button',{name:'🎾 丟球給夥伴'}));await page.waitForFunction(expected=>document.querySelector('.pc-progress progress')?.value===expected,n+1)}}
  else if(action==='休息'){for(const name of ['調暗小夜燈','蓋好小被被','輕聲說晚安'])await click(page.getByRole('button',{name}))}
  else{for(let n=0;n<2;n++)await click(page.getByRole('button',{name:'這頁讀好了，翻下一頁'}));await click(page.getByRole('button',{name:'這頁讀好了，夾上書籤'}))}
  await click(page.getByTestId('pet-action-complete'));await page.locator('.showcase-recent').waitFor();
 }
 if(!unsupported){await click(page.getByRole('button',{name:'退出全螢幕'}));await page.waitForFunction(()=>!document.fullscreenElement)}
 await inspect('result');await page.close();console.log('PASS',JSON.stringify(mode));
}}finally{await browser.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2))}
