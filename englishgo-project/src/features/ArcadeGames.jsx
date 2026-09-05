import { useEffect, useReducer, useRef, useState } from 'react';
import ArcadeScene, { MoleFriend } from '../components/ArcadeArt.jsx';
import { ARCADE_GAMES, arcadeReducer, arcadeStars, arcadeWords, buildArcadeRound, readArcadeProgress, saveArcadeProgress, stageRecords } from '../data/arcade.js';

function PauseDialog({ onResume, onLeave }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); return () => dialog.close?.(); }, []);
  return <dialog ref={ref} className="arcade-pause" aria-labelledby="arcade-pause-title" onCancel={event => { event.preventDefault(); onResume(); }}><span aria-hidden="true">☁</span><h2 id="arcade-pause-title">休息一下，冒險等你</h2><p>遊戲和倒數都已暫停，準備好再繼續。</p><button type="button" className="arcade-primary" autoFocus onClick={onResume}>繼續冒險</button><button type="button" onClick={onLeave}>回到關卡地圖</button></dialog>;
}

function MatchBoard({ state, dispatch }) {
  return <div className="arcade-memory" aria-label="星空配對牌">
    {state.board.map((card, index) => {
      const matched = state.matched.includes(card.pair), open = state.mode === 'practice' || state.peekMs > 0 || state.flipped.includes(index) || matched;
      const disabled = matched || state.flipped.includes(index) || state.pendingMs > 0 || state.peekMs > 0;
      return <button type="button" key={index} className={`arcade-memory-card ${open ? 'is-open' : ''} ${matched ? 'is-matched' : ''} ${state.flipped.includes(index) ? 'is-selected' : ''}`} aria-label={open ? `${card.type === 'en' ? '英文' : '中文'}：${card.text}${matched ? '，已配對' : ''}` : `翻開第 ${index + 1} 張牌`} disabled={disabled} onClick={() => dispatch({ type: 'FLIP', index })}>
        {open ? <><small>{matched ? '連上了 ✓' : card.type === 'en' ? 'ENGLISH' : '中文'}</small><strong lang={card.type === 'en' ? 'en' : 'zh-Hant'}>{card.text}</strong></> : <><span className="arcade-card-star" aria-hidden="true">✦</span><small>{String(index + 1).padStart(2, '0')}</small></>}
      </button>;
    })}
  </div>;
}

function WordBoard({ state, dispatch, speak }) {
  const current = state.rounds[state.index], listening = state.game === 'whack' && state.mode === 'challenge' && state.stage === 3 && !state.hinted && !state.answered;
  return <>
    <div className="arcade-clue"><div><span>{listening ? '小耳朵挑戰' : '這次的任務'}</span><h3>{listening ? '聽聽看，是哪個單字？' : current.m}</h3>{state.game === 'bomb' && <p>{current.w.length} 個字母 · {state.stage > 1 ? '有多餘字母，仔細挑選' : '把字母裝進能量槽'}</p>}</div><button type="button" className="arcade-listen" onClick={() => speak(current.w)} aria-label="聽這個單字">🔊<small>再聽一次</small></button></div>
    {state.game === 'whack' ? <div className="arcade-mole-field" aria-label="找出正確英文的地鼠">{current.choices.map((choice, index) => <button type="button" key={`${state.index}-${index}`} className={`arcade-mole ${state.rejected.includes(index) ? 'is-resting' : ''} ${state.hinted && choice.w === current.w ? 'is-hinted' : ''} ${state.answered && choice.w === current.w ? 'is-found' : ''}`} style={{ '--mole-delay': `${index * 70}ms` }} disabled={state.answered || state.rejected.includes(index)} onClick={() => dispatch({ type: 'CHOOSE', index })}><MoleFriend variant={index}/><span className="arcade-mole-word" lang="en">{choice.w}</span><small>{state.answered && choice.w === current.w ? '種下花朵 ✓' : `${index + 1}`}</small></button>)}</div> : <>
      <div className="arcade-letter-slots" aria-label="拼字能量槽">{[...current.w].map((letter, index) => <span key={index} className={`${state.input[index] ? 'is-filled' : ''} ${state.feedback?.kind === 'retry' && state.input[index] !== letter ? 'needs-fix' : ''}`}>{state.input[index] || <span aria-hidden="true">·</span>}</span>)}</div>
      <label className="arcade-keyboard-label"><span>也可以用鍵盤拼字</span><input aria-label="拼出英文單字" value={state.input} disabled={state.answered} onChange={event => dispatch({ type: 'INPUT', value: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); dispatch({ type: 'CHECK' }); } }} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="點下方字母，或在這裡輸入"/></label>
      <div className="arcade-letter-bank" aria-label="可用的字母">{current.letters.map((letter, index) => {
        const ordinal = current.letters.slice(0, index + 1).filter(item => item === letter).length, used = [...state.input].filter(item => item === letter).length >= ordinal;
        return <button type="button" key={index} disabled={state.answered || used || state.input.length === current.w.length} onClick={() => dispatch({ type: 'LETTER', letter })} aria-label={`字母 ${letter}`}>{letter}</button>;
      })}</div>
      {!state.answered && <div className="arcade-actions"><button type="button" disabled={!state.input} onClick={() => dispatch({ type: 'UNDO' })}>← 退一個字母</button><button type="button" className="arcade-primary" disabled={state.input.length !== current.w.length} onClick={() => dispatch({ type: 'CHECK' })}>發射能量 ↗</button></div>}
    </>}
  </>;
}

function TrainBoard({ state, dispatch, speak }) {
  const current = state.rounds[state.index];
  return <><div className="arcade-clue"><div><span>把這句話送到下一站</span><h3>{current.h}</h3><p>{current.tokens.length} 節車廂{state.stage === 3 ? ' · 有多餘車廂，選對再出發' : ' · 點單字排好隊，點車廂可拿回'}</p></div><button type="button" className="arcade-listen" aria-label="聽這個句子" onClick={() => speak(current.s)}>🔊<small>聽句子</small></button></div>
    <div className="arcade-train-track" aria-label="你的句子車廂"><span className="arcade-engine" aria-hidden="true">🚂</span>{current.tokens.map((token, index) => {
      const id = state.selected[index], tile = current.tiles.find(item => item.id === id), wrong = state.feedback?.kind === 'retry' && tile?.text.toLowerCase() !== token.toLowerCase();
      return tile ? <button type="button" key={index} className={`arcade-carriage ${wrong ? 'needs-fix' : ''}`} disabled={state.answered} onClick={() => dispatch({ type: 'TOKEN', id })} aria-label={`取回車廂 ${tile.text}`}><small>{index + 1}</small><span lang="en">{tile.text}</span></button> : <span key={index} className="arcade-carriage is-empty"><small>{index + 1}</small><span>＋</span></span>;
    })}</div>
    <div className="arcade-token-bank" aria-label="候車區單字">{current.tiles.map(tile => <button type="button" key={tile.id} lang="en" disabled={state.answered || state.selected.includes(tile.id) || state.selected.length === current.tokens.length} onClick={() => dispatch({ type: 'TOKEN', id: tile.id })}>{tile.text}</button>)}</div>
    {!state.answered && <div className="arcade-actions"><button type="button" disabled={!state.selected.length} onClick={() => dispatch({ type: 'UNDO' })}>← 退回最後一節</button><button type="button" className="arcade-primary" disabled={state.selected.length !== current.tokens.length} onClick={() => dispatch({ type: 'CHECK' })}>火車出發 →</button></div>}
  </>;
}

export default function ArcadeGames({ game, lv, onBack, onXp, onDone, deps }) {
  const { V, SCRAM, loadExtraWords, fetchCloudVocab, speak, stopSpeech, playSound, Hdr, LV } = deps;
  const meta = ARCADE_GAMES[game];
  const [pool, setPool] = useState(() => arcadeWords(V[lv]));
  const [screen, setScreen] = useState('lobby'), [stage, setStage] = useState(1), [mode, setMode] = useState('practice');
  const [progress, setProgress] = useState(readArcadeProgress), [state, dispatch] = useReducer(arcadeReducer, null);
  const paid = useRef(0), settled = useRef(false), previous = useRef([]), callbacks = useRef({ onXp, onDone });
  callbacks.current = { onXp, onDone };
  const heading = useRef(null), root = useRef(null);
  useEffect(() => {
    const nav = document.querySelector('.eg-app-nav');
    if (!nav) return;
    const resize = () => root.current?.style.setProperty('--arcade-nav-height', `${nav.getBoundingClientRect().height}px`);
    resize();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(nav); window.addEventListener('resize', resize);
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, []);
  useEffect(() => {
    let active = true;
    Promise.allSettled([loadExtraWords(), fetchCloudVocab(lv, 80)]).then(([extra, cloud]) => {
      if (!active) return;
      setPool(arcadeWords([...(V[lv] || []), ...(extra.status === 'fulfilled' ? extra.value?.[lv] || [] : []), ...(cloud.status === 'fulfilled' ? cloud.value || [] : [])]));
    });
    return () => { active = false; stopSpeech(); };
  }, [lv, V, loadExtraWords, fetchCloudVocab, stopSpeech]);
  const ticking = screen === 'game' && state?.phase === 'playing' && ((!state.answered && state.mode === 'challenge') || state.pendingMs > 0 || state.peekMs > 0);
  useEffect(() => {
    if (!ticking) return;
    let previousTime = Date.now();
    const timer = setInterval(() => { const now = Date.now(); dispatch({ type: 'TICK', ms: now - previousTime }); previousTime = now; }, 250);
    return () => clearInterval(timer);
  }, [ticking]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) { dispatch({ type: 'PAUSE' }); stopSpeech(); } };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [stopSpeech]);
  useEffect(() => {
    if (!state || screen !== 'game') return;
    const delta = state.earned - paid.current;
    if (delta > 0) { paid.current = state.earned; callbacks.current.onXp?.(delta); playSound('good'); }
    if (state.phase === 'won' && !settled.current) {
      settled.current = true;
      const next = saveArcadeProgress(readArcadeProgress(), lv, state);
      try { localStorage.setItem('eg_arcade_progress', JSON.stringify(next)); } catch { /* Play remains available if storage is full. */ }
      setProgress(next); if (game === 'scramble') callbacks.current.onDone?.(); playSound('done');
    }
  }, [state?.earned, state?.phase, screen, game, lv, playSound]);
  useEffect(() => { if (screen === 'game' && state?.phase === 'playing' && state.game === 'whack') speak(state.rounds[state.index]?.w); }, [screen, state?.index, state?.game, state?.phase, speak]);
  useEffect(() => {
    const keyboard = event => {
      if (screen !== 'game' || state?.phase !== 'playing' || state.answered || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target?.closest?.('input,textarea,select,button,a,[contenteditable=true]')) return;
      if (game === 'whack' && /^[1-4]$/.test(event.key)) dispatch({ type: 'CHOOSE', index: Number(event.key) - 1 });
      if (game === 'bomb') {
        if (/^[a-z]$/i.test(event.key)) dispatch({ type: 'LETTER', letter: event.key.toLowerCase() });
        if (event.key === 'Backspace') { event.preventDefault(); dispatch({ type: 'UNDO' }); }
        if (event.key === 'Enter') { event.preventDefault(); dispatch({ type: 'CHECK' }); }
      }
    };
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, [screen, state?.phase, state?.answered, game]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [screen, state?.phase === 'won', state?.phase === 'timeout']);

  const records = stageRecords(progress, lv, game, mode);
  const start = (nextStage = stage) => {
    const next = buildArcadeRound({ game, stage: nextStage, mode, lv, words: pool, sentences: SCRAM[lv], previous: previous.current });
    previous.current = next.rounds.map(item => item.w || item.s); paid.current = 0; settled.current = false;
    stopSpeech(); setStage(nextStage); dispatch({ type: 'START', state: next }); setScreen('game');
    if (typeof window.scrollTo === 'function' && !/jsdom/i.test(navigator.userAgent)) window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const leave = () => { stopSpeech(); setScreen('lobby'); };
  const pause = () => { stopSpeech(); dispatch({ type: 'PAUSE' }); };
  const total = state?.rounds.length || 1;
  return <div ref={root} className={`arcade-page arcade-${game}`} style={{ '--arcade-accent': meta.color }}>
    <Hdr t={`${meta.icon} ${meta.title}`} onBack={screen === 'lobby' ? onBack : leave} cl={LV[lv].cl}/>
    {screen === 'lobby' ? <>
      <section className="arcade-lobby-hero"><div><span className="arcade-eyebrow">ENGLISHGO PLAY CLUB · {meta.subtitle}</span><h1 ref={heading} tabIndex={-1}>{meta.title}<span>今天，來一場小冒險。</span></h1><p>{meta.description}</p><div className="arcade-lobby-tags"><span>3 段關卡</span><span>約 3–5 分鐘</span><span>可隨時暫停</span></div></div><ArcadeScene game={game}/></section>
      <div className="arcade-lobby-grid"><section className="arcade-mode-panel"><h2>用你的步調玩</h2><div className="arcade-modes" role="group" aria-label="遊戲模式"><button type="button" aria-pressed={mode === 'practice'} onClick={() => { setMode('practice'); setStage(1); }}><span>🌱</span><b>輕鬆練習</b><small>{game === 'match' ? '牌面全開，慢慢配對' : '不計時，放心試試看'}</small></button><button type="button" aria-pressed={mode === 'challenge'} onClick={() => { setMode('challenge'); setStage(1); }}><span>⚡</span><b>挑戰模式</b><small>{game === 'match' ? '翻牌記憶，挑戰倒數' : '限時任務，挑戰自己'}</small></button></div><ol className="arcade-instructions">{meta.instructions.map(text => <li key={text}>{text}</li>)}</ol></section>
        <section className="arcade-stage-panel"><h2>選一站，出發吧</h2><div className="arcade-stage-map">{meta.stages.map((name, index) => {
          const number = index + 1, locked = number > 1 && !(records[number - 1]?.stars > 0), stars = Number(records[number]?.stars) || 0;
          return <button type="button" key={name} disabled={locked} aria-pressed={stage === number} onClick={() => setStage(number)} className={`arcade-stage ${stage === number ? 'is-current' : ''}`}><span className="arcade-stage-number">{locked ? '🔒' : number}</span><span><b>{name}</b><small>{locked ? `完成第 ${number - 1} 關後開啟` : stars ? `${'★'.repeat(stars)}${'☆'.repeat(3-stars)} · 最佳 ${records[number].points} 分` : '還沒探索，準備出發'}</small></span></button>;
        })}</div><button type="button" className="arcade-primary arcade-start" onClick={() => start()}>開始第 {stage} 關 <span>→</span></button><p className="arcade-small-note">完成就有一顆星，少失誤、自己解開可以多得星星。</p></section></div>
    </> : state.phase === 'empty' ? <section className="arcade-result"><h2>這裡的教材還在準備</h2><button type="button" onClick={leave}>回到關卡地圖</button></section> : ['won', 'timeout'].includes(state.phase) ? <section className="arcade-result">
      <ArcadeScene game={game} progress={state.completed / total}/><span className="arcade-eyebrow">第 {stage} 關 · {meta.stages[stage - 1]}</span><h1 ref={heading} tabIndex={-1}>{state.phase === 'won' ? '冒險完成！' : '先補給一下，再出發'}</h1><div className="arcade-result-stars" aria-label={`本關獲得 ${arcadeStars(state)} 顆星`}>{[1,2,3].map(star => <span key={star} className={star <= arcadeStars(state) ? 'is-earned' : ''}>★</span>)}</div><p>{state.phase === 'won' ? '每一個找到的答案，都成為了你的新本領。' : '時間到了，已學會的單字和獲得的獎勵都會留下。'}</p><div className="arcade-result-stats"><div><b>{state.points}</b><span>冒險得分</span></div><div><b>{state.completed}/{total}</b><span>{game === 'match' ? '成功配對' : '完成任務'}</span></div><div><b>{state.bestCombo}</b><span>最高連續成功</span></div></div>
      <div className="arcade-result-actions">{state.phase === 'won' && stage < 3 && <button type="button" className="arcade-primary" onClick={() => start(stage + 1)}>前往第 {stage + 1} 關 →</button>}<button type="button" onClick={() => start()}>{state.phase === 'won' ? '再玩一次' : '重新挑戰這一關'}</button><button type="button" onClick={leave}>關卡地圖</button><button type="button" onClick={onBack}>休息一下，回首頁</button></div><details className="arcade-review"><summary>把這一關的英文帶回家</summary><div>{state.rounds.map((item, index) => <button type="button" key={index} onClick={() => speak(item.w || item.s)}><strong lang="en">{item.w || item.s}</strong><span>{item.m || item.h} · 🔊</span></button>)}</div></details>
    </section> : <>
      <div className="arcade-hud"><div><small>正在探索</small><b>第 {stage} 關</b></div><div><small>冒險得分</small><b>{state.points}</b></div><div><small>{mode === 'practice' ? '照你的步調' : '補給倒數'}</small><b data-testid="arcade-clock">{mode === 'practice' ? '不計時' : `${Math.ceil(state.remainingMs / 1000)} 秒`}</b></div><button type="button" onClick={pause}>Ⅱ 暫停</button></div>
      <section className="arcade-play-area" aria-label={`${meta.title}遊戲區`}><ArcadeScene game={game} progress={state.completed / total} className="arcade-play-scene"/><div className="arcade-route" aria-label={`完成 ${state.completed}/${total}`}>{Array.from({ length: total }, (_, index) => <span key={index} className={index < state.completed ? 'is-complete' : ''}>{index < state.completed ? (game==='whack'?'✿':'✦') : index + 1}</span>)}<b>{state.completed}/{total}</b></div>
        <div className="arcade-board" aria-label="目前任務">{game === 'match' ? <><div className="arcade-board-heading"><h2 ref={heading} tabIndex={-1}>把英文和中文連起來</h2><p>{state.peekMs > 0 ? `觀察星空… ${Math.ceil(state.peekMs / 1000)} 秒後收起` : mode === 'practice' ? '選兩張意思相同的牌，點亮一顆星。' : '翻兩張牌，看看誰和誰是夥伴。'}</p></div><MatchBoard state={state} dispatch={dispatch}/></> : game === 'scramble' ? <TrainBoard state={state} dispatch={dispatch} speak={speak}/> : <WordBoard state={state} dispatch={dispatch} speak={speak}/>}
          <div className={`arcade-feedback ${state.feedback?.kind || ''}`} role="status">{state.feedback?.text || (game === 'whack' ? '點地鼠也可以按鍵盤 1–4。找到了就種下一朵花！' : '準備好了就試試看，小幫手也在這裡。')}{state.combo >= 2 && <span className="arcade-combo">✦ 連續成功 {state.combo} 次</span>}</div>
          <div className="arcade-bottom-actions">{state.answered ? <button type="button" className="arcade-primary" onClick={() => { stopSpeech(); dispatch({ type: 'NEXT' }); }}>{state.completed === total ? '看看冒險成果 →' : '下一個任務 →'}</button> : <button type="button" disabled={state.phase !== 'playing' || state.peekMs > 0 || state.pendingMs > 0} onClick={() => dispatch({ type: 'HINT' })}>✧ 小幫手提示</button>}<span>{state.hints ? `小幫手陪你想了 ${state.hints} 次` : '放心嘗試，答錯不會扣學習金幣。'}</span></div>
        </div>
      </section>{state.phase === 'paused' && <PauseDialog onResume={() => dispatch({ type: 'RESUME' })} onLeave={leave}/>}
    </>}
  </div>;
}
