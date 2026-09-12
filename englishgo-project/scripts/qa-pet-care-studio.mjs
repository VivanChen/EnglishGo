import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
await fs.mkdir('.superpowers/qa/pet-care',{recursive:true});
try { for(const width of [1440,390,320]) {
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const now=new Date().toISOString();for(const [k,v] of Object.entries({pets:[{petId:'bunny',rarity:'N',level:2,exp:0,bond:0,hunger:30,clean:10,energy:40,lastUpdate:now}],inv:{apple:2},coins:100,quiet:true,loginBonus:{lastDate:new Date().toDateString(),claimed:true,streak:1}}))localStorage.setItem('eg_'+k,JSON.stringify(v));localStorage.setItem('eg_petLocalMode','true')});
 await page.goto(process.env.QA_URL||'http://127.0.0.1:5196');await page.getByText('Elementary',{exact:true}).click();await page.locator('[data-group-id="pet"]').click();await page.locator('[data-module-id="pets"]').click();await page.getByRole('button',{name:'陪陪我的夥伴 →'}).click();await page.getByTestId('pet-primary-care-action').click();await page.getByRole('button',{name:/選這份食物/}).click();
 await page.locator('.pc-canvas canvas').waitFor();
 if(!await page.getByTestId('pet-action-complete').isDisabled())throw Error('Premature completion');
 if(width===1440){for(let i=0;i<3;i++){const a=await page.locator('.pc-food').boundingBox(),b=await page.locator('.pc-mouth').boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();}}else{for(let i=0;i<3;i++){await page.locator('.pc-food').click();await page.getByRole('button',{name:'餵一口'}).click();}}
 await page.screenshot({path:`.superpowers/qa/pet-care/${width}-feed.png`,fullPage:true});await page.getByTestId('pet-action-complete').click();
 if(await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_inv')).apple)!==1)throw Error('Inventory');
 await page.locator('.ps-care-actions button').filter({hasText:'洗澡'}).click();await page.locator('.pc-canvas canvas').waitFor();
 for(const n of [4,2,1,3])await page.getByRole('button',{name:`擦洗第 ${n} 處髒污`}).click();
 await page.screenshot({path:`.superpowers/qa/pet-care/${width}-clean.png`,fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow||errors.length)throw Error(JSON.stringify({overflow,errors}));
 await page.getByTestId('pet-action-complete').click(); console.log('PASS',width,errors);await page.close();
}} finally {await browser.close()}
