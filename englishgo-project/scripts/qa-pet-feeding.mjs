import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});const report=[];const out=process.env.QA_GESTURES?'.superpowers/qa/pet-feeding-gestures':'.superpowers/qa/pet-feeding';await fs.mkdir(out,{recursive:true});
try{for(const mode of [{width:1440,petId:'bunny'},{width:390,petId:'kitty'},{width:320,petId:'puppy',reduce:true},{width:390,petId:'bunny',fallback:true}]){
 if(process.env.QA_WIDTH&&mode.width!==Number(process.env.QA_WIDTH))continue;
 const {width,reduce,fallback,petId}=mode;const page=await browser.newPage({viewport:{width,height:940},hasTouch:width<700,reducedMotion:reduce?'reduce':'no-preference'});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('/.netlify/')&&!(fallback&&m.text().includes('Error creating WebGL context')))errors.push(m.text())});
 await page.addInitScript(({fallback,petId})=>{if(fallback){const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).startsWith('webgl'))return null;return get.call(this,type,...args)}}const now=new Date().toISOString();for(const [k,v] of Object.entries({pets:[{petId,rarity:'N',level:3,exp:0,bond:0,hunger:80,clean:80,energy:80,lastUpdate:now}],inv:{apple:3},eggs:[],coins:200,quiet:true,loginBonus:{lastDate:new Date().toDateString(),claimed:true,streak:1}}))localStorage.setItem('eg_'+k,JSON.stringify(v));localStorage.setItem('eg_petLocalMode','true')}, {fallback,petId});
 const saved=()=>page.evaluate(()=>({pet:JSON.parse(localStorage.getItem('eg_pets'))[0],coins:JSON.parse(localStorage.getItem('eg_coins'))}));
 const click=async locator=>{if(process.env.QA_KEYBOARD){await locator.focus();await locator.press('Enter')}else if(width<700)await locator.tap();else await locator.click()};
 const inspect=async label=>{await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:`${out}/${width}${fallback?'-fallback':''}-${label}.png`,fullPage:true});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow||errors.length)throw Error(JSON.stringify({mode,label,overflow,errors}));report.push({...mode,label,overflow,errors:[...errors]})};
 await page.goto(process.env.QA_URL||'http://127.0.0.1:5196');await page.getByText('Elementary',{exact:true}).click();await page.locator('[data-group-id="pet"]').click();await page.locator('[data-module-id="pets"]').click();await page.getByRole('button',{name:'陪陪我的夥伴 →'}).click();
 const start=async()=>{await click(page.getByRole('button',{name:'餵食',exact:true}));await click(page.getByRole('button',{name:/選這份食物/}));await page.locator(`.pc-stage [data-renderer="${fallback?'fallback':'ready'}"]`).waitFor()};
 const inventory=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('eg_inv')).apple);
 const before=await saved(),stock=await inventory();await start();await inspect('ready');
 const progress=async n=>{await page.waitForFunction(expected=>document.querySelector('.pc-progress progress')?.value===expected,n,{timeout:5000})};
 if(width===1440){
  const food=page.locator('.pc-food'),mouth=page.getByRole('button',{name:'餵一口'});
  await food.scrollIntoViewIfNeeded();let f=await food.boundingBox();
  await page.mouse.move(f.x+f.width/2,f.y+f.height/2);await page.mouse.down();await page.mouse.move(f.x-55,f.y-70,{steps:8});await page.mouse.up();await progress(0);await page.getByText('差一點點！再把食物送到嘴邊吧。').waitFor();
  f=await food.boundingBox();await page.mouse.move(f.x+f.width/2,f.y+f.height/2);await page.mouse.down();let m=await mouth.boundingBox();await page.mouse.move(m.x+m.width/2,m.y+m.height/2,{steps:12});await page.mouse.up();await progress(1);if(await food.getAttribute('aria-pressed')!=='false')throw Error('Drag click picked up a second portion');
 }else if(process.env.QA_GESTURES){
  const client=await page.context().newCDPSession(page),food=page.locator('.pc-food'),mouth=page.getByRole('button',{name:'餵一口'});await food.scrollIntoViewIfNeeded();
  const f=await food.boundingBox(),x=f.x+f.width/2,y=f.y+f.height/2;
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-25}]});await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await progress(0);if(await food.getAttribute('aria-pressed')!=='false')throw Error('Cancelled touch retained food');

  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});const m=await mouth.boundingBox();for(let n=1;n<=10;n++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(m.x+m.width/2-x)*n/10,y:y+(m.y+m.height/2-y)*n/10}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await progress(1);if(await inventory()!==stock)throw Error('Gesture spent inventory');await inspect('touch-drag');await page.close();console.log('PASS touch gestures',JSON.stringify(mode));continue;
 }else{await click(page.locator('.pc-food'));await click(page.getByRole('button',{name:'餵一口'}));await progress(1)}
 await click(page.getByRole('button',{name:'稍後再做'}));if(await inventory()!==stock||JSON.stringify(await saved())!==JSON.stringify(before))throw Error('Cancelled feeding changed save');
 await start();for(let i=0;i<3;i++){
  if(width===1440){await page.locator('.pc-food').focus();await page.keyboard.press('Enter');if(!await page.getByRole('button',{name:'餵一口'}).evaluate(el=>el===document.activeElement))throw Error('Mouth did not get keyboard focus');await page.keyboard.press('Enter')}
  else{await click(page.locator('.pc-food'));await click(page.getByRole('button',{name:'餵一口'}))}
  await progress(i+1);if(await inventory()!==stock)throw Error('Inventory spent before confirmation');
 }
 await inspect('complete');await click(page.getByTestId('pet-action-complete'));if(await inventory()!==stock-1)throw Error('Inventory must spend exactly one food');
 await inspect('result');await page.close();console.log('PASS',JSON.stringify(mode));
}}catch(error){for(const page of browser.contexts().flatMap(c=>c.pages())){await page.screenshot({path:`${out}/failure.png`,fullPage:true});console.log((await page.locator('body').innerText()).slice(-6000))}throw error}finally{await browser.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2))}
