/* Enhancement layer over the supplied HTML: its story, scenes and vocabulary remain intact. */
(() => {
  let run = 0, loading = false, watchdog, turnTimer, sheetTimer, turning = false, exact = false;
  const extra = { tree:['🌳','樹'], bush:['🌿','灌木'], rock:['🪨','岩石'], garden:['🌷','花園'], sky:['🌌','天空'] };
  Object.assign(VOCAB, extra);
  const oldButtons = setPlayBtn;
  setPlayBtn = function() { oldButtons(); if (loading) { $('playIcon').textContent='■'; $('playTxt').textContent='Cancel loading'; } };
  stopRead = function() { run++; clearTimeout(watchdog); S?.cancel(); loading=false; playing=false; paused=false; clearHl(); setPlayBtn(); };
  function utterance(text) {
    const u=new SpeechSynthesisUtterance(text); u.lang='en-US'; u.rate=slow?.7:.9;
    u.__englishGoApiTts=true; u.__englishGoRequireApi=true; u.__englishGoTrackWords=true; u.__englishGoPlaybackRate=slow?.8:1;
    return u;
  }
  say = function(text, cb) {
    stopRead(); if (!S || !sound) return;
    const u=utterance(text); u.onend=cb; u.onerror=()=>toast('語音暫時無法播放，請再試一次。'); S.speak(u); return u;
  };
  startRead = function() {
    stopRead(); if (!S || !sound) { toast('請開啟聲音，或選擇自己讀。'); return; }
    if (!$('coverOv').classList.contains('hide') || !$('endOv').classList.contains('hide')) return;
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
    u.onend=()=>{if(!valid())return;clearTimeout(watchdog);playing=false;loading=false;paused=false;clearHl();setPlayBtn();toast(page===7?'Tap → to finish the book':'Tap → to turn the page');};
    u.onerror=failed;
    S.speak(u);
  };
  $('play').onclick=()=>{
    if(loading){stopRead();return;}
    if(playing&&!paused){S.pause();paused=true;setPlayBtn();return;}
    if(paused){S.resume();paused=false;setPlayBtn();return;}
    startRead();
  };
  // Keep vocabulary readable until the learner dismisses it; place it near the tapped word.
  const vocabBox=$('vocab');
  vocabBox.setAttribute('role','dialog');vocabBox.setAttribute('aria-label','單字卡');
  const close=document.createElement('button');close.type='button';close.className='vocab-close';close.textContent='×';close.setAttribute('aria-label','關閉單字卡');
  close.onclick=e=>{e.stopPropagation();vocabBox.classList.remove('show');};vocabBox.append(close);
  const repeat=document.createElement('button');repeat.type='button';repeat.className='vocab-repeat';repeat.textContent='🔈 再聽一次';
  repeat.onclick=e=>{e.stopPropagation();say(vocabBox.querySelector('.en').textContent);};vocabBox.append(repeat);
  showVocab=function(key,anchor,word){
    say(word||key);clearTimeout(vocabBox._t);
    const entry=VOCAB[key];if(!entry){vocabBox.classList.remove('show');return;}
    vocabBox.querySelector('.pic').textContent=entry[0];vocabBox.querySelector('.en').textContent=word||key;vocabBox.querySelector('.zh').textContent=entry[1];
    const app=$('app'), rect=app.getBoundingClientRect(), scale=rect.width/app.offsetWidth;
    const target=anchor||document.querySelector('.w[data-w="'+key+'"]')||$('card');
    const point=target.getBoundingClientRect(), width=230, height=290;
    const left=Math.max(12,Math.min(app.offsetWidth-width-12,(point.left-rect.left)/scale));
    const top=Math.max(100,Math.min(app.scrollHeight-height-12,(point.top-rect.top)/scale-height-12));
    vocabBox.style.left=left+'px';vocabBox.style.top=top+'px';vocabBox.classList.add('show');
    if(innerWidth<=600)requestAnimationFrame(()=>vocabBox.scrollIntoView({block:'nearest',behavior:'smooth'}));
  };
  addEventListener('keydown',e=>{if(e.key==='Escape')vocabBox.classList.remove('show');});
  const originalRender=render;
  render=function(dir){
    originalRender(dir);
    document.querySelectorAll('.w').forEach(w=>{w.tabIndex=0;w.setAttribute('role','button');w.setAttribute('aria-label','發音 '+w.textContent);});
    document.querySelectorAll('.pop').forEach((pop,i)=>{
      const entry=POPS[PAGES[page].s][i];
      pop.tabIndex=0;pop.setAttribute('role','button');pop.setAttribute('aria-label',entry.tag||'故事插畫');
      function respond(){
        if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
        const art=pop.querySelector('svg');if(!art)return;
        art.getAnimations().forEach(a=>a.cancel());
        const key=entry.tag||'';
        const frames=['star','lamp'].includes(key)?[{transform:'rotate(0)'},{transform:'translateY(-30px) rotate(180deg)'},{transform:'rotate(360deg)'}]:key==='owl'?[{transform:'translate(0,0)'},{transform:'translate(-25px,-45px) rotate(-12deg)'},{transform:'translate(0,0)'}]:key==='fox'?[{transform:'translateY(0)'},{transform:'translateY(-32px) rotate(-5deg)'},{transform:'translateY(0)'}]:[{transform:'rotate(0)'},{transform:'rotate(-10deg)'},{transform:'rotate(10deg)'},{transform:'rotate(0)'}];
        art.animate(frames,{duration:850,easing:'ease-in-out'});
      }
      pop.addEventListener('pointerdown',respond);
      pop.addEventListener('click',e=>e.stopPropagation());
      pop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();respond();if(entry.tag)showVocab(entry.tag,pop);}});
    });
    fit();
  };
  go=function(n,dir){
    if(turning||!$('coverOv').classList.contains('hide')||!$('endOv').classList.contains('hide')||n<0)return;
    stopRead();$('vocab').classList.remove('show');
    if(n>=PAGES.length){$('endOv').classList.remove('hide');fit();return;}
    turning=true;clearTimeout(sheetTimer);$('sheet').className='sheet';void $('sheet').offsetWidth;$('sheet').className='sheet go'+(dir<0?' back':'');sheetTimer=setTimeout(()=>{$('sheet').className='sheet';},950);$('card').classList.add('hide');
    document.querySelectorAll('.pop').forEach(p=>p.classList.add('down'));
    turnTimer=setTimeout(()=>{page=n;render(dir);turning=false;if(mode==='read'&&autoRead)startRead();},480);
  };
  document.querySelector('#text').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const w=e.target.closest('.w');if(w){e.preventDefault();e.stopPropagation();showVocab(w.dataset.w,null,w.textContent);}}});
  // Block book shortcuts while an overlay or native button owns the keystroke.
  $('btnSlow').onclick=()=>{const resume=playing||loading;stopRead();slow=!slow;$('btnSlow').classList.toggle('off',!slow);toast(slow?'API 語音慢速播放 🐢':'正常速度');if(resume)startRead();};
  const originalFit=fit;
  fit=function(){
    if(innerWidth<=600){$('app').style.transform='none';}else originalFit();
    requestAnimationFrame(()=>parent.postMessage({type:'pip:height',height:innerWidth<=600?$('app').scrollHeight:Math.min(760,innerWidth*660/1040)},location.origin));
  };
  addEventListener('resize',fit);
  new ResizeObserver(fit).observe($('card'));
  $('openBook').onclick=()=>{stopRead();$('coverOv').classList.add('hide');page=0;render(1);if(mode==='read')startRead();};
  $('again').onclick=()=>{stopRead();$('endOv').classList.add('hide');page=0;render(1);if(mode==='read')startRead();};
  addEventListener('pagehide',()=>{clearTimeout(turnTimer);clearTimeout(sheetTimer);stopRead();});
  addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin)return;if(e.data?.type==='pip:stop')stopRead();if(e.data?.type==='pip:word'&&typeof e.data.word==='string'&&VOCAB[e.data.word])showVocab(e.data.word);});
  const status=document.createElement('button');status.id='audioStatus';status.type='button';status.setAttribute('aria-label','重新下載全本語音');$('app').append(status);
  let downloading=false;
  async function preload(){
    if(downloading)return;downloading=true;status.disabled=true;status.textContent='↓ 正在預下載 8 頁 API 語音…';
    const timeout=setTimeout(()=>{status.textContent='語音仍在背景下載中…';},30000);
    try{const ready=await window.EnglishGoTTS.preloadMany(window.PIP_AUDIO_ITEMS,{limit:8,concurrency:2});status.textContent=ready===8?'✓ 全本語音已準備好 · 8 / 8 頁':`↓ 語音已準備 ${ready} / 8 頁 · 點此重試`;}
    catch{status.textContent='語音下載未完成 · 點此重試';}
    finally{clearTimeout(timeout);downloading=false;status.disabled=false;}
  }
  status.onclick=preload;
  coverArt();render(1);$('card').classList.add('hide');fit();preload();
})();