/* Enhancement layer over the supplied HTML: its story, scenes and vocabulary remain intact. */
(() => {
  let run = 0, loading = false, watchdog, turnTimer, sheetTimer, turning = false, exact = false;
  let preparingArt=false, active=true;
  // Progress arrives from the EnglishGo host; a standalone page simply starts fresh.
  let stars=new Set(), resumePage=0, completed=false, swipeHintShown=false;
  const QUEST_LIST=typeof QUESTS!=='undefined'&&Array.isArray(QUESTS)?QUESTS:[];
  const body=document.body;
  const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function post(type,data={}){try{parent.postMessage({...data,type},location.origin);}catch{/* Standalone or detached page. */}}
  const isReading=()=>$('coverOv').classList.contains('hide')&&$('endOv').classList.contains('hide');

  const artCache=new Map();
  function loadArt(src){
    if(artCache.has(src))return artCache.get(src);
    const job=new Promise((resolve,reject)=>{
      const img=new Image();
      const timer=setTimeout(()=>reject(new Error('Illustration timeout')),20000);
      img.onload=async()=>{try{await img.decode();clearTimeout(timer);resolve(img);}catch(error){clearTimeout(timer);reject(error);}};
      img.onerror=()=>{clearTimeout(timer);reject(new Error('Illustration unavailable'));};
      img.src=src;
    }).catch(error=>{artCache.delete(src);throw error;});
    artCache.set(src,job);return job;
  }
  function prepareArt(index){
    if(!PAGES[index])return Promise.resolve();
    const scene=PAGES[index].s;
    const markup=BACK[scene]()+POPS[scene].map(o=>o.h).join('');
    const urls=[...new Set([...markup.matchAll(/<image[^>]*href="([^"]+)"/g)].map(m=>m[1]))];
    return Promise.all(urls.map(loadArt));
  }
  async function readyToTurn(index){
    preparingArt=true;$('app').setAttribute('aria-busy','true');
    const notice=setTimeout(()=>toast('插畫準備中，請稍候…'),250);
    try{await prepareArt(index);return active;}
    catch{if(active)toast('插畫尚未載入，請再點一次翻頁重試');return false;}
    finally{clearTimeout(notice);preparingArt=false;$('app').removeAttribute('aria-busy');}
  }
  const extra = { tree:['🌳','樹'], bush:['🌿','灌木'], rock:['🪨','岩石'], garden:['🌷','花園'], sky:['🌌','天空'] };
  Object.assign(VOCAB, extra);

  /* ---------- narration (prerecorded API audio) ---------- */
  const oldButtons = setPlayBtn;
  setPlayBtn = function() { oldButtons(); if (loading) { $('playIcon').textContent='■'; $('playTxt').textContent='Cancel loading'; } };
  stopRead = function() { run++; clearTimeout(watchdog); S?.cancel(); loading=false; playing=false; paused=false; clearHl(); setPlayBtn(); };
  // Book recordings follow EnglishGo's one site-wide reading speed.
  function utterance(text) {
    const u=new SpeechSynthesisUtterance(text); u.lang='en-US'; u.rate=.9;
    u.__englishGoApiTts=true; u.__englishGoRequireApi=true; u.__englishGoTrackWords=true; u.__englishGoUseGlobalSpeed=true; u.__englishGoPlaybackRate=1;
    return u;
  }
  say = function(text, cb) {
    stopRead(); if (!S || !sound) return;
    const item=window.PIP_WORD_AUDIO_ITEMS?.[String(text).toLowerCase().replace(/^'|'$/g,'')];
    if(!item){toast('這個單字尚未備妥音檔。');return;}
    const u=utterance(item.text);u.__englishGoAudioUrl=item.audioUrl; u.onend=cb; u.onerror=()=>toast('語音暫時無法播放，請再試一次。'); S.speak(u); return u;
  };
  startRead = function() {
    stopRead(); if (!S || !sound) { toast('請開啟聲音，或選擇自己讀。'); return; }
    if (!isReading()) return;
    $('vocab').classList.remove('show');
    const id=run; exact=false; loading=true; setPlayBtn();
    const u=utterance(PAGES[page].x); utter=u;
    u.__englishGoAudioUrl=window.PIP_AUDIO_ITEMS?.[page]?.audioUrl;
    const valid=()=>run===id;
    const failed=()=>{if(!valid())return;stopRead();toast('聲音準備較久，請再按一次播放。');};
    watchdog=setTimeout(failed,25000);
    u.onstart=()=>{if(!valid())return;clearTimeout(watchdog);loading=false;playing=true;setPlayBtn();hl(0);};
    u.onboundary=e=>{if(!valid()||paused||(e.name&&e.name!=='word'))return;exact=true;const t=tokens.find(t=>e.charIndex>=t.start&&e.charIndex<t.end);if(t)hl(t.i);};
    u.onprogress=e=>{
      if(!valid()||!playing||paused||exact||!(e.duration>0))return;
      // Cloud narration uses an approximate word guide based on real playback time.
      const weights=tokens.map(t=>Math.max(2,t.w.length)), total=weights.reduce((a,b)=>a+b,0);
      let at=Math.min(1,e.currentTime/e.duration)*total, sum=0;
      const index=weights.findIndex(w=>(sum+=w)>at);hl(index<0?tokens.length-1:index);
    };
    u.onend=()=>{
      if(!valid())return;clearTimeout(watchdog);playing=false;loading=false;paused=false;clearHl();setPlayBtn();
      // The page's "find it" challenge follows the story, so listening comes first.
      if(quest.state==='idle'){const at=page;setTimeout(()=>{if(page===at&&isReading())startQuest();},450);return;}
      toast(page===PAGES.length-1?'Tap → to finish the book':'Tap → to turn the page');
    };
    u.onerror=failed;
    S.speak(u);
  };
  $('play').onclick=()=>{
    if(loading){stopRead();return;}
    if(playing&&!paused){S.pause();paused=true;setPlayBtn();return;}
    if(paused){S.resume();paused=false;setPlayBtn();return;}
    startRead();
  };

  // Audio is fetched as the story needs it: this page, the next page, and this page's key words.
  function warmAudio(index,{words=true}={}){
    const tts=window.EnglishGoTTS;if(typeof tts?.preloadMany!=='function'||!PAGES[index])return;
    const pages=window.PIP_AUDIO_ITEMS||[],wordItems=window.PIP_WORD_AUDIO_ITEMS||{};
    const keys=new Set();
    if(words){
      (PAGES[index].x.match(/[A-Za-z']+/g)||[]).forEach(w=>{const key=w.toLowerCase().replace(/^'|'$/g,'');if(VOCAB[key])keys.add(key);});
      if(QUEST_LIST[index])keys.add(QUEST_LIST[index]);
    }
    const list=[pages[index],pages[index+1],...[...keys].map(key=>wordItems[key])].filter(Boolean);
    if(list.length)Promise.resolve(tts.preloadMany(list,{limit:list.length,concurrency:2})).catch(()=>{});
  }

  /* ---------- vocabulary card ---------- */
  // Keep vocabulary readable until the learner dismisses it; place it near the tapped word.
  const vocabBox=$('vocab');
  vocabBox.setAttribute('role','dialog');vocabBox.setAttribute('aria-label','單字卡');
  const close=document.createElement('button');close.type='button';close.className='vocab-close';close.textContent='×';close.setAttribute('aria-label','關閉單字卡');
  close.onclick=e=>{e.stopPropagation();vocabBox.classList.remove('show');};vocabBox.append(close);
  const vocabActions=document.createElement('div');vocabActions.className='vocab-actions';
  const repeat=document.createElement('button');repeat.type='button';repeat.className='vocab-repeat';repeat.textContent='🔈 再聽';
  repeat.onclick=e=>{e.stopPropagation();say(vocabBox.querySelector('.en').textContent);};
  const review=document.createElement('button');review.type='button';review.className='vocab-review';
  review.onclick=e=>{
    e.stopPropagation();const word=vocabBox.dataset.key;if(!word||review.disabled)return;
    post('pip:review',{word});review.textContent='✓ 已加入';review.disabled=true;toast('已加入弱點單字複習');
  };
  vocabActions.append(repeat,review);vocabBox.append(vocabActions);
  showVocab=function(key,anchor,word){
    say(word||key);clearTimeout(vocabBox._t);
    const entry=VOCAB[key];if(!entry){vocabBox.classList.remove('show');return;}
    vocabBox.dataset.key=key;review.textContent='＋ 加入複習';review.disabled=false;
    vocabBox.querySelector('.pic').textContent=entry[0];vocabBox.querySelector('.en').textContent=word||key;vocabBox.querySelector('.zh').textContent=entry[1];
    const app=$('app'), width=230, height=300;
    if(body.classList.contains('immersive')&&innerWidth<=600){
      // On a phone the card floats over the pop-up scene, leaving the story text readable.
      vocabBox.style.left=Math.max(8,(app.offsetWidth-width)/2)+'px';vocabBox.style.top='58px';vocabBox.classList.add('show');return;
    }
    const rect=app.getBoundingClientRect(), scale=rect.width/app.offsetWidth;
    const target=anchor||document.querySelector('.w[data-w="'+key+'"]')||$('card');
    const point=target.getBoundingClientRect();
    let left=Math.max(12,Math.min(app.offsetWidth-width-12,(point.left-rect.left)/scale));
    let top=Math.max(isReading()?100:70,Math.min(app.scrollHeight-height-12,(point.top-rect.top)/scale-height-12));
    if(innerWidth>600&&!anchor&&isReading()){
      // On the wide canvas a story word's card opens beside the text card, never over the sentence.
      const card=$('card').getBoundingClientRect();
      left=Math.min(app.offsetWidth-width-12,(card.right-rect.left)/scale+16);
      top=Math.max(90,Math.min(app.offsetHeight-height-12,(point.top-rect.top)/scale-120));
    }
    vocabBox.style.left=left+'px';vocabBox.style.top=top+'px';vocabBox.classList.add('show');
    if(innerWidth<=600&&isReading())requestAnimationFrame(()=>vocabBox.scrollIntoView({block:'nearest',behavior:'smooth'}));
  };
  const originalHighlight=hl;
  hl=function(index){
    originalHighlight(index);
    const card=$('card'),word=card.querySelector('.w.hl');
    if(word&&card.scrollHeight>card.clientHeight){
      const box=card.getBoundingClientRect(),point=word.getBoundingClientRect();
      const scale=box.height/card.offsetHeight;
      if(point.bottom>box.bottom-20)card.scrollTop+=(point.bottom-box.bottom+40)/scale;
      else if(point.top<box.top+20)card.scrollTop-=(box.top-point.top+40)/scale;
    }
  };

  /* ---------- stars: one per page, earned in the "find it" challenge ---------- */
  drawStars=function(){
    [...sr.children].forEach((el,i)=>{el.classList.toggle('on',stars.has(i));el.classList.toggle('now',isReading()&&i===page);});
    sr.setAttribute('aria-label',`已收集 ${stars.size} / ${PAGES.length} 顆星星`);
  };
  sr.setAttribute('role','img');
  const questChip=document.createElement('button');questChip.id='quest';questChip.type='button';questChip.hidden=true;$('app').append(questChip);
  let quest={page:-1,target:'',state:'none',missed:false};
  function questTarget(index){
    const word=QUEST_LIST[index];if(!word||!PAGES[index])return '';
    return POPS[PAGES[index].s].filter(o=>o.tag===word).length===1?word:'';
  }
  function setQuest(state){
    quest.state=state;
    body.classList.toggle('quest-on',state==='active');
    body.classList.toggle('quest-hint',state==='active'&&quest.missed);
    const word=quest.target;
    questChip.hidden=!word||state==='none';questChip.className='quest-'+state;
    if(state==='idle'){questChip.innerHTML='<span class="q-star" aria-hidden="true">★</span><span>找找看</span>';questChip.setAttribute('aria-label','開始找找看：聽單字，找出圖中的東西');}
    else if(state==='active'){questChip.innerHTML=`<span class="q-ear" aria-hidden="true">🔈</span><span lang="en">Find the <b>${word}</b></span>`;questChip.setAttribute('aria-label',`再聽一次 ${word}，然後在圖中找到它`);}
    else if(state==='done'){questChip.innerHTML=`<span class="q-star" aria-hidden="true">★</span><span lang="en">${word}</span><span class="q-ok" aria-hidden="true">✓</span>`;questChip.setAttribute('aria-label',`已找到 ${word}，再聽一次`);}
  }
  function prepareQuest(){
    quest={page,target:questTarget(page),state:'none',missed:false};
    setQuest(!quest.target?'none':stars.has(page)?'done':'idle');
  }
  function startQuest(){
    if(!quest.target||quest.state!=='idle'||!isReading())return;
    $('vocab').classList.remove('show');setQuest('active');say(quest.target);
  }
  questChip.onclick=e=>{e.stopPropagation();if(quest.state==='idle')startQuest();else if(quest.target)say(quest.target);};
  function popEntry(pop){const index=[...$('pops').children].indexOf(pop);return POPS[PAGES[page].s][index]||{};}
  function animateArt(pop,frames,duration){
    if(reduceMotion())return;const art=pop.querySelector('svg');if(!art)return;
    art.getAnimations().forEach(a=>a.cancel());art.animate(frames,{duration,easing:'ease-in-out'});
  }
  function chime(){
    if(!sound)return;
    try{
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
      const ctx=chime.ctx||(chime.ctx=new Context()),t=ctx.currentTime;
      [880,1318.5,1760].forEach((freq,i)=>{
        const o=ctx.createOscillator(),g=ctx.createGain(),at=t+i*.09;
        o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.16,at+.02);g.gain.exponentialRampToValueAtTime(.0001,at+.55);
        o.connect(g).connect(ctx.destination);o.start(at);o.stop(at+.6);
      });
    }catch{/* A chime is decoration only. */}
  }
  function celebrate(pop){
    if(reduceMotion())return;
    const app=$('app'),rect=app.getBoundingClientRect(),scale=rect.width/app.offsetWidth||1;
    const from=pop.getBoundingClientRect(),slot=sr.children[page]?.getBoundingClientRect();
    const x=(from.left+from.width/2-rect.left)/scale,y=(from.top+from.height/3-rect.top)/scale;
    for(let i=0;i<10;i++){
      const d=document.createElement('div');d.className='sp';
      d.style.left=(x+Math.cos(i/10*Math.PI*2)*36)+'px';d.style.top=(y+Math.sin(i/10*Math.PI*2)*30)+'px';
      app.appendChild(d);setTimeout(()=>d.remove(),900);
    }
    if(!slot)return;
    const star=document.createElement('div');star.className='quest-burst';star.style.left=x+'px';star.style.top=y+'px';app.appendChild(star);
    const tx=(slot.left+slot.width/2-rect.left)/scale-x,ty=(slot.top+slot.height/2-rect.top)/scale-y;
    star.animate([{transform:'translate(0,0) scale(.4) rotate(0)',opacity:0},{transform:'translate(0,-30px) scale(1.5) rotate(90deg)',opacity:1,offset:.3},{transform:`translate(${tx}px,${ty}px) scale(.55) rotate(360deg)`,opacity:1}],{duration:900,easing:'cubic-bezier(.5,0,.3,1)'}).finished.finally(()=>star.remove());
  }
  function checkPick(pop){
    const tag=popEntry(pop).tag||'';
    if(tag===quest.target){
      const firstTry=!quest.missed,isNew=!stars.has(page);
      stars.add(page);setQuest('done');celebrate(pop);chime();
      animateArt(pop,[{transform:'translateY(0) scale(1)'},{transform:'translateY(-26px) scale(1.12)'},{transform:'translateY(0) scale(1)'}],700);
      setTimeout(()=>{drawStars();say(quest.target);},isNew&&!reduceMotion()?850:0);
      if(isNew)post('pip:star',{page,word:quest.target,firstTry});
      toast(firstTry?`★ You found the ${quest.target}!`:`★ Found it! ${quest.target} 已加入複習`);
      return;
    }
    animateArt(pop,[{transform:'translateX(0)'},{transform:'translateX(-9px) rotate(-4deg)'},{transform:'translateX(9px) rotate(4deg)'},{transform:'translateX(0)'}],380);
    if(!quest.missed){quest.missed=true;post('pip:miss',{page,word:quest.target});setQuest('active');}
    toast(tag?`That is the ${tag}. 再找找 ${quest.target}！`:`再找找 ${quest.target}！看看標籤提示`);
  }
  // During a challenge, a tap on the scene answers it instead of opening the word card.
  $('pops').addEventListener('pointerdown',e=>{
    if(quest.state!=='active')return;const pop=e.target.closest('.pop');if(!pop)return;
    e.stopPropagation();e.preventDefault();checkPick(pop);
  },true);
  $('pops').addEventListener('keydown',e=>{
    if(quest.state!=='active'||!(e.key==='Enter'||e.key===' '))return;const pop=e.target.closest('.pop');if(!pop)return;
    e.preventDefault();e.stopPropagation();checkPick(pop);
  },true);

  /* ---------- pages ---------- */
  const originalRender=render;
  render=function(dir){
    originalRender(dir);
    $('card').scrollTop=0;
    document.querySelectorAll('.w').forEach(w=>{w.tabIndex=0;w.setAttribute('role','button');w.setAttribute('aria-label','發音 '+w.textContent);});
    document.querySelectorAll('.pop').forEach((pop,i)=>{
      const entry=POPS[PAGES[page].s][i];
      if(Number.isFinite(entry.tagTop)&&pop.querySelector('.tag'))pop.querySelector('.tag').style.top=entry.tagTop+'px';
      if(entry.float)pop.querySelector('.shadow')?.remove(); // light and sky pieces cast no floor shadow
      pop.tabIndex=0;pop.setAttribute('role','button');pop.setAttribute('aria-label',entry.tag||'故事插畫');
      function respond(){
        const key=entry.tag||'';
        const frames=key==='breathe'?[{transform:'scale(1)'},{transform:'scale(1.2)'},{transform:'scale(1)'}]:['castle','blocks','bridge'].includes(key)?[{transform:'translateY(0)'},{transform:'translateY(-12px) rotate(-3deg)'},{transform:'translateY(0)'}]:['star','lamp'].includes(key)?[{transform:'rotate(0)'},{transform:'translateY(-30px) rotate(180deg)'},{transform:'rotate(360deg)'}]:key==='owl'?[{transform:'translate(0,0)'},{transform:'translate(-25px,-45px) rotate(-12deg)'},{transform:'translate(0,0)'}]:key==='fox'?[{transform:'translateY(0)'},{transform:'translateY(-32px) rotate(-5deg)'},{transform:'translateY(0)'}]:[{transform:'rotate(0)'},{transform:'rotate(-10deg)'},{transform:'rotate(10deg)'},{transform:'rotate(0)'}];
        animateArt(pop,frames,key==='breathe'?3600:850);
      }
      pop.addEventListener('pointerdown',respond);
      pop.addEventListener('click',e=>e.stopPropagation());
      pop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();respond();if(entry.tag)showVocab(entry.tag,pop);}});
    });
    prepareQuest();drawStars();
    if(isReading()){resumePage=page;post('pip:page',{page});warmAudio(page);}
    fit();
  };
  go=async function(n,dir){
    if(preparingArt||turning||!isReading()||n<0)return;
    stopRead();$('vocab').classList.remove('show');
    if(n>=PAGES.length){showEnd();return;}
    if(!await readyToTurn(n))return;
    turning=true;clearTimeout(sheetTimer);$('sheet').className='sheet';void $('sheet').offsetWidth;$('sheet').className='sheet go'+(dir<0?' back':'');sheetTimer=setTimeout(()=>{$('sheet').className='sheet';},950);$('card').classList.add('hide');
    setQuest('none');
    document.querySelectorAll('.pop').forEach(p=>p.classList.add('down'));
    turnTimer=setTimeout(()=>{page=n;render(dir);turning=false;prepareArt(page+1).catch(()=>{});if(mode==='read'&&autoRead)startRead();},480);
  };
  document.querySelector('#text').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const w=e.target.closest('.w');if(w){e.preventDefault();e.stopPropagation();showVocab(w.dataset.w,null,w.textContent);}}});
  // Block book shortcuts while an overlay or native button owns the keystroke.
  // One speed control, shared with the rest of EnglishGo: slow, normal, fast.
  const SPEEDS=[{value:.8,icon:'🐢',label:'慢速'},{value:1,icon:'1×',label:'正常'},{value:1.2,icon:'🐇',label:'快速'}];
  function currentSpeed(){
    const speed=Number(window.EnglishGoTTS?.getSettings?.().speed)||1;
    return SPEEDS.reduce((best,option)=>Math.abs(option.value-speed)<Math.abs(best.value-speed)?option:best);
  }
  function showSpeed(){
    const speed=currentSpeed(),button=$('btnSlow');
    button.textContent=speed.icon;button.classList.remove('off');button.classList.toggle('speed-normal',speed.value===1);
    button.title=`朗讀速度：${speed.label} ${speed.value}×`;button.setAttribute('aria-label',`朗讀速度：${speed.label} ${speed.value}×，點一下切換`);
  }
  $('btnSlow').onclick=()=>{
    const resume=playing||loading;stopRead();
    const next=SPEEDS[(SPEEDS.indexOf(currentSpeed())+1)%SPEEDS.length];
    window.EnglishGoTTS?.setSettings?.({speed:next.value});showSpeed();toast(`朗讀速度：${next.label} ${next.value}×`);
    if(resume)startRead();
  };
  addEventListener('englishgo:tts-settings-changed',showSpeed);addEventListener('englishgo:tts-installed',showSpeed);
  // "Read to me" names the big button; the mode switch says what each mode does.
  $('mRead').textContent='🎧 自動朗讀';$('mSelf').textContent='📖 自己讀';

  // Swipe across the scene or the story card to turn the page on touch screens.
  let touch=null;
  ['stage','card'].forEach(id=>{
    $(id).addEventListener('touchstart',e=>{const t=e.touches[0];touch=e.touches.length===1?{x:t.clientX,y:t.clientY,at:Date.now()}:null;},{passive:true});
    $(id).addEventListener('touchend',e=>{
      if(!touch||!isReading())return;
      const t=e.changedTouches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y,quick=Date.now()-touch.at<700;touch=null;
      if(quick&&Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.6)go(page+(dx<0?1:-1),dx<0?1:-1);
    },{passive:true});
  });

  /* ---------- layout: desktop canvas, phone reflow, phone full screen ---------- */
  const originalFit=fit;
  function sizeBook(){
    // The tilted book is about 665px tall at scale 1; its near edge may run past the sides.
    const stage=$('stage'),scale=Math.min((innerWidth-12)/640,(stage.clientHeight-8)/665);
    $('app').style.setProperty('--book-scale',Math.max(.3,scale).toFixed(3));
  }
  fit=function(){
    const narrow=innerWidth<=600,immersive=body.classList.contains('immersive');
    if(narrow){$('app').style.transform='none';if(immersive)sizeBook();}else originalFit();
    if(immersive)return; // The host sizes a full-screen book.
    const report=()=>post('pip:height',{height:narrow?$('app').scrollHeight:Math.min(760,innerWidth*660/1040)});
    // Report now, and again after the next paint has settled late layout changes.
    report();requestAnimationFrame(report);
  };
  addEventListener('resize',fit);
  new ResizeObserver(fit).observe($('card'));

  /* ---------- cover, close and ending ---------- */
  const cover=$('coverOv').querySelector('.cover'),openBtn=$('openBook');
  const coverProgress=document.createElement('div');coverProgress.className='cover-progress';cover.querySelector('.zh').after(coverProgress);
  const restart=document.createElement('button');restart.type='button';restart.className='start-over';restart.textContent='從頭開始';restart.hidden=true;cover.append(restart);
  function updateCover(){
    const resume=resumePage>0;
    openBtn.textContent=resume?'Keep reading ✨':completed?'Read again ✨':'Open the book ✨';
    openBtn.setAttribute('aria-label',resume?`從第 ${resumePage+1} 頁繼續閱讀`:completed?'再讀一次':'打開書本');
    restart.hidden=!resume;cover.classList.toggle('has-resume',resume);
    coverProgress.textContent=resume?`★ ${stars.size} / ${PAGES.length} · 讀到第 ${resumePage+1} 頁`:completed?`★ ${stars.size} / ${PAGES.length} · 已讀完`:stars.size?`★ ${stars.size} / ${PAGES.length}`:'';
  }
  function setReading(open){
    body.classList.toggle('reading',open);post('pip:reading',{open});fit();
  }
  async function openStory(start=0){
    if(preparingArt||turning)return;
    stopRead();if(!await readyToTurn(start))return;
    $('coverOv').classList.add('hide');$('endOv').classList.add('hide');page=start;
    setReading(true);render(1);prepareArt(page+1).catch(()=>{});
    // The host confirms full screen a moment after opening; teach the swipe once it has.
    setTimeout(()=>{if(body.classList.contains('immersive')&&isReading()&&!swipeHintShown){swipeHintShown=true;toast('左右滑動就能翻頁');}},900);
    if(mode==='read')startRead();
  }
  function closeBook(){
    stopRead();setQuest('none');$('vocab').classList.remove('show');
    if(!$('endOv').classList.contains('hide'))resumePage=0;
    $('endOv').classList.add('hide');$('coverOv').classList.remove('hide');$('card').classList.add('hide');
    drawStars();updateCover();setReading(false);
  }
  openBtn.onclick=()=>openStory(resumePage);
  restart.onclick=e=>{e.stopPropagation();resumePage=0;openStory(0);};
  const closeBtn=document.createElement('button');closeBtn.id='closeBook';closeBtn.type='button';closeBtn.textContent='✕';closeBtn.setAttribute('aria-label','收起書本');
  closeBtn.onclick=e=>{e.stopPropagation();closeBook();};$('app').append(closeBtn);

  const end=$('endOv').querySelector('.end'),again=$('again');
  const endStars=document.createElement('div');endStars.className='end-stars';
  const endSummary=document.createElement('p');endSummary.className='end-summary';
  const endReward=document.createElement('p');endReward.className='end-reward';endReward.setAttribute('role','status');
  const endActions=document.createElement('div');endActions.className='end-actions';
  const endGuide=document.createElement('button');endGuide.type='button';endGuide.className='end-btn';endGuide.textContent='✍️ 讀後探索';
  const endNext=document.createElement('button');endNext.type='button';endNext.className='end-btn';endNext.textContent='下一本 →';
  again.replaceWith(endActions);endActions.append(again,endGuide,endNext);
  end.insertBefore(endSummary,endActions);end.insertBefore(endReward,endActions);end.insertBefore(endStars,endSummary);
  function showEnd(){
    setQuest('none');$('endOv').classList.remove('hide');
    endStars.innerHTML=PAGES.map((_,i)=>`<i class="${stars.has(i)?'on':''}"></i>`).join('');
    endStars.setAttribute('aria-label',`找到 ${stars.size} / ${PAGES.length} 顆星星`);endStars.setAttribute('role','img');
    endSummary.textContent=stars.size===PAGES.length?`全部 ${PAGES.length} 顆星星都找到了！`:`你找到 ${stars.size} / ${PAGES.length} 顆星星`;
    endReward.textContent='';
    completed=true;resumePage=0;drawStars();post('pip:finish');fit();
  }
  again.onclick=()=>openStory(0);
  endGuide.onclick=e=>{e.stopPropagation();post('pip:guide');if(body.classList.contains('immersive'))closeBook();};
  endNext.onclick=e=>{e.stopPropagation();stopRead();post('pip:next-book');};

  addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(vocabBox.classList.contains('show')){vocabBox.classList.remove('show');return;}
    if(body.classList.contains('immersive')&&body.classList.contains('reading'))closeBook();
  });
  addEventListener('pagehide',()=>{active=false;clearTimeout(turnTimer);clearTimeout(sheetTimer);stopRead();});
  addEventListener('message',e=>{
    if(e.source!==parent||e.origin!==location.origin)return;
    const data=e.data||{};
    if(data.type==='pip:stop')stopRead();
    if(data.type==='pip:word'&&typeof data.word==='string'&&VOCAB[data.word])showVocab(data.word);
    if(data.type==='pip:immersive'){body.classList.toggle('immersive',data.active===true);fit();}
    if(data.type==='pip:reward'&&!$('endOv').classList.contains('hide')){
      endReward.textContent=data.xp>0?`+${data.xp} XP${data.first?' · 第一次讀完這本書！':''}`:data.first===false&&data.missing>0?`還有 ${data.missing} 頁沒讀過，讀完每一頁就能領取獎勵`:'';
    }
    if(data.type==='pip:init'){
      const valid=n=>Number.isInteger(n)&&n>=0&&n<PAGES.length;
      stars=new Set(Array.isArray(data.stars)?data.stars.filter(valid):[]);
      resumePage=valid(data.page)?data.page:0;completed=data.completed===true;
      drawStars();updateCover();
      if(data.autoOpen===true&&!isReading())openStory(0);
    }
  });

  /* ---------- offline audio pack ---------- */
  const status=document.createElement('button');status.id='audioStatus';status.type='button';status.setAttribute('aria-label','下載全本語音，離線也能播放');$('app').append(status);
  const pageItems=()=>window.PIP_AUDIO_ITEMS||[],wordList=()=>Object.values(window.PIP_WORD_AUDIO_ITEMS||{});
  async function refreshAudioStatus(){
    status.textContent='↓ 下載全本語音（離線用）';
    try{
      const cache=await caches.open('storybook-audio-v1');
      const saved=new Set((await cache.keys()).map(request=>new URL(request.url).pathname));
      const all=[...pageItems(),...wordList()];
      if(all.length&&all.every(item=>saved.has(item.audioUrl))){status.textContent='✓ 全本語音可離線播放';status.classList.add('ready');}
    }catch{/* Cache Storage is optional. */}
  }
  let downloading=false;
  async function preload(){
    if(downloading||typeof window.EnglishGoTTS?.preloadMany!=='function')return;
    downloading=true;status.disabled=true;status.classList.remove('ready');status.textContent=`↓ 正在下載 ${PAGES.length} 頁文章與單字音檔…`;
    const pages=pageItems(),words=wordList();
    let pageReady=0,wordReady=0;
    const show=()=>{status.textContent=`↓ 文章 ${pageReady}/${pages.length} · 單字 ${wordReady}/${words.length}`;};
    try{
      pageReady=await window.EnglishGoTTS.preloadMany(pages,{limit:pages.length,concurrency:3,onProgress:n=>{pageReady=n;show();}});
      wordReady=await window.EnglishGoTTS.preloadMany(words,{limit:words.length,concurrency:3,onProgress:n=>{wordReady=n;show();}});
      const done=pageReady===pages.length&&wordReady===words.length;
      status.textContent=done?'✓ 全本語音可離線播放':`↓ 點此重試 · 文章 ${pageReady}/${pages.length} · 單字 ${wordReady}/${words.length}`;status.classList.toggle('ready',done);
    }catch{status.textContent='音檔下載未完成 · 點此重試';}
    finally{downloading=false;status.disabled=false;}
  }
  status.onclick=e=>{e.stopPropagation();preload();};

  coverArt();render(1);$('card').classList.add('hide');updateCover();showSpeed();fit();prepareArt(0).catch(()=>{});
  warmAudio(0,{words:false});refreshAudioStatus();
  post('pip:ready');
})();
