import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('.superpowers/qa/service-flows');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),report=[];
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const story={title:'Bunny Reads',zh_title:'小兔讀書',pages:Array.from({length:4},()=>({en:'Bunny reads a book.',zh:'小兔讀一本書。',word:'book',meaning:'書'})),questions:Array.from({length:3},(_,i)=>({q:`Question ${i+1}: What does Bunny read?`,zh_q:'小兔讀什麼？',choices:['A book','A ball','A box','A bag'],correct:0,explain:'小兔讀的是一本書。'}))};
const translation={sourceLanguage:'en-US',targetLanguage:'zh-TW',safe:true,reason:'safe to translate',translation:'你好，學生們。',explanation:'這句是向學生打招呼。',keyPhrases:[{english:'Hello students',meaning:'學生們好'}],pronunciationSegments:[{text:'Hello students',stressedWords:['Hello','students']}]};
try{
  for(const width of (process.env.QA_WIDTHS||'1440,390,320').split(',').map(Number)){
    const context=await browser.newContext({viewport:{width,height:width>900?1000:844},serviceWorkers:'block'}),page=await context.newPage();
    page.setDefaultTimeout(18000);const errors=[],simulatedErrors=[],unavailableServices=[];let mode='story',release,requests=0;
    report.push({width,name:'runtime',errors,simulatedErrors,unavailableServices});
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')(message.location().url.includes('generativelanguage.googleapis.com')?simulatedErrors:message.location().url.includes('/.netlify/functions/')?unavailableServices:errors).push(message.text());});
    await context.addInitScript(()=>{
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.qaCopy=text;}}});
      if(!sessionStorage.getItem('service-flows-seeded')){
        sessionStorage.setItem('service-flows-seeded','1');localStorage.setItem('eg_pets',JSON.stringify([{petId:'bunny',rarity:'N',level:3,exp:0,bond:8}]));localStorage.setItem('eg_quiet','true');localStorage.setItem('eg_calm','true');
      }
    });
    await context.route('https://generativelanguage.googleapis.com/**',async route=>{
      requests++;const requestMode=mode;if(requestMode.endsWith('hold'))await new Promise(resolve=>{release=resolve;});
      try{
        if(requestMode==='translation-error')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:503,message:'Simulated busy provider'}})});
        else{
          const payload=requestMode==='invalid'?{title:'Incomplete'}:requestMode.startsWith('translation')?translation:requestMode==='story-hold'?{...story,zh_title:'已取消的舊故事'}:story;
          await route.fulfill({contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(payload)}]}}]})});
        }
      }catch{/* Aborted requests may already be closed. */}
    });
    const click=name=>page.getByRole('button',{name,exact:true}).click();
    const open=async(group,module)=>{await click('回到學習首頁');await page.locator(`[data-group-id="${group}"]`).click();await page.locator(`[data-module-id="${module}"]`).click();};
    const inspect=async name=>{
      console.log(`${width}px ${name}`);await page.waitForTimeout(100);
      const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,wide:[...document.querySelectorAll('main button,main input,main textarea,main section')].filter(element=>{const r=element.getBoundingClientRect();return r.width&&(r.left < -2||r.right>innerWidth+2);}).map(element=>element.textContent.slice(0,60)),brokenImages:[...document.images].filter(img=>img.currentSrc&&img.complete&&!img.naturalWidth).map(img=>img.currentSrc)}));
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:path.join(output,`${width}-${name}.png`),fullPage:true,animations:'disabled'});report.push({width,name,...layout});
    };
    await page.goto(process.env.QA_URL||'http://127.0.0.1:5192/');await page.getByText('Elementary',{exact:true}).click();
    await open('tools','settings');
    // Password inputs are identified by their label, not the textbox role.
    const gemInput=page.getByLabel('Gemini API Key',{exact:true});await gemInput.fill('  qa-stub-key  ');await click('儲存 Gemini Key');
    await page.getByLabel('Giphy API Key',{exact:true}).fill(' qa-gif-key ');await click('儲存 Giphy Key');await page.reload();
    assert(await gemInput.inputValue()==='qa-stub-key','Gemini key did not trim or persist');assert(await page.getByLabel('Giphy API Key',{exact:true}).inputValue()==='qa-gif-key','Giphy key did not persist');
    assert(await gemInput.getAttribute('type')==='password','Stored key was revealed by default');await inspect('settings-restored');
    const gifPanel=page.locator('section').filter({has:page.getByLabel('Giphy API Key',{exact:true})});await gifPanel.getByRole('button',{name:'清除',exact:true}).click();
    assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('eg_gifkey')||'null'))==='', 'Giphy key was not removed');
    for(const link of await page.locator('a[href^="/learn/"]').evaluateAll(links=>links.map(link=>link.getAttribute('href'))))assert((await page.request.get(new URL(link,page.url()).href)).ok(),`Missing settings guide: ${link}`);
    await open('read','story');mode='story-hold';await click('✨ 開始生成故事');await page.getByText('正在為你創作故事',{exact:true}).waitFor();
    for(let i=0;i<40&&!release;i++)await page.waitForTimeout(50);assert(release,'Story request did not start');await click('← 返回');
    mode='story';await click('✨ 開始生成故事');await page.getByText('Bunny reads a book.',{exact:true}).waitFor();release();release=null;await page.waitForTimeout(200);
    assert(await page.getByRole('heading',{name:/已取消的舊故事/}).count()===0,'Cancelled story replaced the new story');await inspect('story-cancel-and-retry');
    if(await page.getByRole('button',{name:'⏹️ 停止',exact:true}).count())await click('⏹️ 停止');
    // Exercise narration callbacks without spending cloud TTS credits or claiming live voice quality.
    await page.evaluate(()=>{window.qaNarration=[];Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],addEventListener(){},removeEventListener(){},resume(){},cancel(){},speak(utterance){window.qaNarration.push(utterance);}}});});
    await click('🎙️ 整本朗讀');
    for(let i=0;i<4;i++){
      await page.getByText(`第 ${i+1} 頁 / 共 4 頁`,{exact:true}).waitFor();
      assert(await page.evaluate(()=>window.qaNarration.length)===i+1,'Whole-story narration duplicated or skipped a page');
      await page.evaluate(index=>window.qaNarration[index].onend(),i);
    }
    await page.getByRole('button',{name:'🎙️ 整本朗讀',exact:true}).waitFor();await inspect('story-narrated-all-pages');
    let completedXp;
    for(let round=0;round<2;round++){
      if(round)for(let i=0;i<3;i++)await click('下一頁 →');await click('📝 開始測驗');
      for(let i=0;i<3;i++){
        await page.getByText(`Question ${i+1}: What does Bunny read?`,{exact:true}).waitFor();assert(await page.getByRole('button',{name:'A. A book',exact:true}).isEnabled(),'Replayed answer was locked');
        if(i===0)await inspect(round?'story-replay-first-question':'story-first-question');await click('A. A book');await click(i<2?'下一題 →':'🏁 查看結果');
      }
      await page.getByText('答對 3 / 3 題 · 100%',{exact:true}).waitFor();const xp=await page.evaluate(()=>localStorage.getItem('eg_xp'));
      if(round===0){completedXp=xp;await inspect('story-complete');await click('🔁 重讀故事');}else assert(xp===completedXp,'Rereading duplicated XP');
    }
    await click('✨ 來個新故事');mode='invalid';await click('✨ 開始生成故事');await page.getByRole('alert').filter({hasText:'故事內容不完整'}).waitFor();await inspect('story-incomplete-recoverable');
    mode='story';await click('✨ 開始生成故事');await page.getByText('Bunny reads a book.',{exact:true}).waitFor();await click('切換為深色模式');await inspect('story-dark');await click('切換為淺色模式');
    await open('learn','translate');mode='translation';const input=page.getByLabel('輸入要翻譯的句子',{exact:true});await input.fill('Hello students');await click('AI 翻譯與檢核');
    await page.getByTestId('translation-result-panel').getByText('你好，學生們。',{exact:true}).waitFor();await click('複製翻譯');assert(await page.evaluate(()=>window.qaCopy)==='你好，學生們。','Translation copy failed');await inspect('translation-success');
    await page.reload();assert(await page.getByRole('button',{name:/請等待 \d+ 秒/}).isDisabled(),'Translation cooldown did not persist');await inspect('translation-cooldown-restored');
    const expireCooldown=async()=>{await page.evaluate(()=>localStorage.setItem('eg_translation_last_request_at',String(Date.now()-61000)));await page.reload();};
    await expireCooldown();mode='translation-hold';await input.fill('Hello students');await click('AI 翻譯與檢核');await page.getByText('翻譯中...',{exact:true}).waitFor();
    for(let i=0;i<40&&!release;i++)await page.waitForTimeout(50);assert(release,'Translation request did not start');await click('清除');release();release=null;await page.waitForTimeout(200);
    assert(await page.getByTestId('translation-results').count()===0,'Cleared translation reappeared');assert(await input.inputValue()==='','Clear left source text');await inspect('translation-cancelled');
    await expireCooldown();mode='translation-error';await input.fill('Hello students');await click('AI 翻譯與檢核');await page.getByRole('alert').filter({hasText:'AI 翻譯暫時無法使用'}).waitFor();await inspect('translation-provider-error');
    await expireCooldown();mode='translation';await input.fill('Hello students');await click('AI 翻譯與檢核');await page.getByTestId('translation-results').waitFor();await click('切換為深色模式');await inspect('translation-retry-dark');await click('切換為淺色模式');
    await open('tools','settings');await page.locator('section').filter({has:gemInput}).getByRole('button',{name:'清除',exact:true}).click();await page.reload();assert(await gemInput.inputValue()==='','Cleared Gemini key came back');
    await open('learn','translate');await click('前往 Key 設定');await gemInput.waitFor();await inspect('keyless-settings-link');assert(errors.length===0,`Runtime errors: ${errors.join('; ')}`);await context.close();
  }
}catch(error){report.push({error:error.stack});throw error;}
finally{await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
const failures=report.filter(row=>row.error||row.errors?.length||row.overflow||row.wide?.length||row.brokenImages?.length);
console.log(JSON.stringify({checks:report.length,failures},null,2));if(failures.length)process.exitCode=1;
