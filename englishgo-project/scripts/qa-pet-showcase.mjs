import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});const report=[];
await fs.mkdir('.superpowers/qa/pet-showcase',{recursive:true});
try{for(const width of (process.env.QA_WIDTHS||'1440,390,320').split(',').map(Number)){
 const page=await browser.newPage({viewport:{width,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('/.netlify/'))errors.push(m.text())});
 await page.addInitScript(()=>{const now=new Date().toISOString();for(const [k,v] of Object.entries({pets:['kitty','bunny','puppy'].map((petId,i)=>({petId,rarity:'N',level:3+i,exp:20,bond:200-i*10,hunger:30,clean:40,energy:85,lastUpdate:now})),inv:{apple:3},eggs:[],coins:200,quiet:true,loginBonus:{lastDate:new Date().toDateString(),claimed:true,streak:1}}))localStorage.setItem('eg_'+k,JSON.stringify(v));localStorage.setItem('eg_petLocalMode','true')});
 await page.goto(process.env.QA_URL||'http://127.0.0.1:5196');await page.getByText('Elementary',{exact:true}).click();await page.locator('[data-group-id="pet"]').click();await page.locator('[data-module-id="pets"]').click();await page.getByRole('button',{name:'陪陪我的夥伴 →'}).click();
 await page.locator('.showcase-center [data-renderer="ready"]').waitFor();
 const inspect=async name=>{await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:`.superpowers/qa/pet-showcase/${width}-${name}.png`,fullPage:true});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow||errors.length)throw Error(JSON.stringify({name,overflow,errors}));report.push({width,name,overflow,errors:[...errors]})};
 await inspect('kitty');await page.getByRole('button',{name:'向左旋轉寵物'}).click();await page.getByRole('button',{name:'摸摸寵物',exact:true}).click();await page.getByText('♡ 靠近一點，我喜歡你的陪伴。').waitFor();await page.getByRole('button',{name:'重設寵物視角'}).click();
 await page.getByRole('button',{name:'夥伴故事',exact:true}).click();await inspect('story');await page.getByRole('button',{name:'屬性總覽',exact:true}).click();
 for(const index of [1,2]){await page.locator('.showcase-roster button').nth(index).click();await page.locator('.showcase-center [data-renderer="ready"]').waitFor();await inspect(index===1?'bunny':'puppy')}
 await page.locator('.showcase-actions button').filter({hasText:'餵食'}).click();await inspect('food-selection');await page.getByRole('button',{name:/選這份食物/}).click();await page.locator('.pc-stage [data-renderer="ready"]').waitFor();await inspect('feeding-start');if(await page.locator('.showcase-roster button:not([disabled])').count())throw Error('Companion switch available during care');for(let n=0;n<3;n++){await page.locator('.pc-food').click();await page.getByRole('button',{name:'餵一口'}).click()};await inspect('feed');await page.getByTestId('pet-action-complete').click();
 const inv=await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_inv')));if(inv.apple!==2)throw Error('Inventory not settled once');
 await page.locator('.showcase-actions button').filter({hasText:'洗澡'}).click();await inspect('clean-start');for(const n of [3,1,4,2])await page.getByRole('button',{name:`擦洗第 ${n} 處髒污`}).click();await page.getByTestId('pet-action-complete').click();
 await page.getByRole('button',{name:'切換為深色模式'}).click();await inspect('dark');await page.close();console.log('PASS',width);
}}finally{await browser.close();await fs.writeFile('.superpowers/qa/pet-showcase/report.json',JSON.stringify(report,null,2))}
