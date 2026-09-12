import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});const report=[];const out=process.env.QA_KEYBOARD?'.superpowers/qa/pet-reading-keyboard':'.superpowers/qa/pet-reading';await fs.mkdir(out,{recursive:true});
try{for(const mode of [{width:1440,petId:'bunny'},{width:390,petId:'kitty'},{width:320,petId:'puppy',reduce:true},{width:390,petId:'bunny',fallback:true}]){
 if(process.env.QA_KEYBOARD&&mode.width!==1440)continue;
 const {width,reduce,fallback,petId}=mode;const page=await browser.newPage({viewport:{width,height:940},hasTouch:width<700,reducedMotion:reduce?'reduce':'no-preference'});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('/.netlify/')&&!(fallback&&m.text().includes('Error creating WebGL context')))errors.push(m.text())});
 await page.addInitScript(({fallback,petId})=>{if(fallback){const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).startsWith('webgl'))return null;return get.call(this,type,...args)}}const now=new Date().toISOString();for(const [k,v] of Object.entries({pets:[{petId,rarity:'N',level:3,exp:0,bond:0,hunger:80,clean:80,energy:80,lastUpdate:now}],inv:{apple:3},eggs:[],coins:200,quiet:true,loginBonus:{lastDate:new Date().toDateString(),claimed:true,streak:1}}))localStorage.setItem('eg_'+k,JSON.stringify(v));localStorage.setItem('eg_petLocalMode','true')}, {fallback,petId});
 const saved=()=>page.evaluate(()=>({pet:JSON.parse(localStorage.getItem('eg_pets'))[0],coins:JSON.parse(localStorage.getItem('eg_coins'))}));
 const click=async locator=>{if(process.env.QA_KEYBOARD){await locator.focus();await locator.press('Enter')}else if(width<700)await locator.tap();else await locator.click()};
 const inspect=async label=>{await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:`${out}/${width}${fallback?'-fallback':''}-${label}.png`,fullPage:true});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow||errors.length)throw Error(JSON.stringify({mode,label,overflow,errors}));report.push({...mode,label,overflow,errors:[...errors]})};
 await page.goto(process.env.QA_URL||'http://127.0.0.1:5196');await page.getByText('Elementary',{exact:true}).click();await page.locator('[data-group-id="pet"]').click();await page.locator('[data-module-id="pets"]').click();await page.getByRole('button',{name:'陪陪我的夥伴 →'}).click();
 const start=async()=>{await click(page.getByRole('button',{name:'讀書',exact:true}));await page.locator(`.pc-stage [data-renderer="${fallback?'fallback':'ready'}"]`).waitFor()};
 const before=await saved();await start();await click(page.getByRole('button',{name:'這頁讀好了，翻下一頁'}));await click(page.getByRole('button',{name:'稍後再做'}));if(JSON.stringify(await saved())!==JSON.stringify(before))throw Error('Cancelled reading modified save');
 for(let repeat=0;repeat<2;repeat++){
  await start();if(!await page.getByTestId('pet-action-complete').isDisabled())throw Error('Premature completion');
  if(!repeat)await inspect('ready');
  for(const [n,name] of ['這頁讀好了，翻下一頁','這頁讀好了，翻下一頁','這頁讀好了，夾上書籤'].entries()){
   await click(page.getByRole('button',{name}));
   if(await page.locator('.pc-progress progress').getAttribute('value')!==String(n+1))throw Error('Reading progress incorrect');
   if(n===1&&!repeat)await inspect('second-page');
  }
  if(!repeat)await inspect('complete');await click(page.getByTestId('pet-action-complete'));
  const after=await saved();if(after.pet.exp!==before.pet.exp+30||after.pet.bond!==before.pet.bond+15||after.coins!==before.coins+5)throw Error('Reading reward duplicated or missing: '+JSON.stringify(after));
  await page.locator('.showcase-recent').getByText('讀書完成',{exact:true}).waitFor();
 }
 await inspect('result');await page.close();console.log('PASS',JSON.stringify(mode));
}}finally{await browser.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2))}
