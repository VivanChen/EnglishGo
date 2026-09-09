import { useEffect, useReducer, useRef, useState } from 'react';
import ColorIslandScene from '../components/ColorIslandScene.jsx';
import { ISLAND_COLORS, ISLAND_MODES, colorIslandReducer, islandColor, islandInstruction, islandStandingTile, makeIslandRounds } from '../data/colorIsland.js';
import './color-island.css';

function IslandPause({ onResume, onLeave }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); return () => dialog.close?.(); }, []);
  return <dialog ref={ref} className="island-modal" aria-label="顏色生存島已暫停" onCancel={event => { event.preventDefault(); onResume(); }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const buttons = ref.current.querySelectorAll('button'), first = buttons[0], last = buttons[buttons.length - 1];
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  }}><span>Ⅱ</span><h2>小島等你回來</h2><p>角色、平台和倒數都已暫停。</p><button autoFocus className="island-primary" onClick={onResume}>繼續挑戰</button><button onClick={onLeave}>回到選關</button></dialog>;
}

export default function ColorIsland({ onBack, onXp, deps }) {
  const { speak, stopSpeech, playSound } = deps;
  const [modeId, setModeId] = useState('warmup'), [state, dispatch] = useReducer(colorIslandReducer, null);
  const [hint, setHint] = useState(false), [run, setRun] = useState(0), [unavailable, setUnavailable] = useState(false);
  const mode = ISLAND_MODES.find(item => item.id === modeId), paid = useRef(0), arena = useRef(null), callbacks = useRef({ onXp });
  callbacks.current = { onXp };
  const phase = state?.phase || 'lobby', current = state?.rounds[state.index], active = ['ready', 'playing', 'resolving'].includes(phase);
  const visualPhase = phase === 'paused' ? state.resumePhase : phase;
  const target = current && islandColor(current.target), occupied = state && islandStandingTile(state.position);
  const standingColor = current && occupied >= 0 ? islandColor(current.tiles[occupied]) : null;
  const destination = current && islandColor(current.tiles[state.targetTile]);
  const arrived = state && Math.hypot(state.position.x - state.targetTile % 4, state.position.z - Math.floor(state.targetTile / 4)) < .03;
  const leave = () => { stopSpeech(); dispatch({ type: 'LOBBY' }); setRun(value => value + 1); };
  const pause = () => { stopSpeech(); dispatch({ type: 'PAUSE' }); };
  useEffect(() => () => stopSpeech(), [stopSpeech]);
  useEffect(() => {
    if (!active) return;
    let previous = Date.now();
    const timer = setInterval(() => { const now = Date.now(); dispatch({ type: 'TICK', ms: now - previous }); previous = now; }, 50);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    const hidden = () => { if (document.hidden && active) pause(); };
    document.addEventListener('visibilitychange', hidden); return () => document.removeEventListener('visibilitychange', hidden);
  }, [active, stopSpeech]);
  useEffect(() => { if (phase === 'playing') speak(islandInstruction(current.target)); else if (phase === 'resolving') stopSpeech(); }, [phase, state?.index, speak, stopSpeech]);
  useEffect(() => { setHint(false); }, [state?.index, run]);
  useEffect(() => {
    if (!state) return;
    const delta = state.earned - paid.current;
    if (delta > 0) { paid.current = state.earned; callbacks.current.onXp?.(delta); playSound('good'); }
  }, [state?.earned, playSound]);
  const soundedMistakes = useRef(0);
  useEffect(() => { if (state?.mistakes > soundedMistakes.current) { soundedMistakes.current = state.mistakes; playSound('bad'); } }, [state?.mistakes, playSound]);
  useEffect(() => { if (phase === 'won') playSound('done'); }, [phase, playSound]);
  useEffect(() => {
    if (!['lobby', 'ready'].includes(phase)) return;
    const frame = requestAnimationFrame(() => { if (!arena.current) return; arena.current.style.scrollMarginTop = `${(document.querySelector('.eg-app-nav')?.getBoundingClientRect().height || 0) + 12}px`; arena.current.scrollIntoView?.({ block: 'start', behavior: 'instant' }); });
    return () => cancelAnimationFrame(frame);
  }, [phase]);
  useEffect(() => {
    const keys = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] };
    const move = event => {
      if (phase !== 'playing' || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input,textarea,select,[contenteditable=true]')) return;
      const direction = keys[event.key] || keys[event.key.toLowerCase()];
      if (direction) { event.preventDefault(); dispatch({ type: 'MOVE', dx: direction[0], dz: direction[1] }); }
      if (event.key === 'Escape') pause();
    };
    window.addEventListener('keydown', move); return () => window.removeEventListener('keydown', move);
  }, [phase, stopSpeech]);
  function start() { if (unavailable) return; paid.current = 0; soundedMistakes.current = 0; stopSpeech(); setHint(false); setRun(value => value + 1); dispatch({ type: 'START', mode, rounds: makeIslandRounds(mode) }); arena.current?.focus({ preventScroll: true }); }
  return <div className="island-page">
    <header className="island-header"><button onClick={() => { stopSpeech(); onBack(); }}>← 遊戲大廳</button><span>ENGLISHGO <b>COLOR SURVIVAL</b></span></header>
    <section ref={arena} tabIndex={-1} className={`island-arena ${phase === 'lobby' ? 'is-lobby' : ''}`} aria-label="顏色生存島遊戲區">
      <ColorIslandScene key={`${modeId}-${run}`} mode={mode} state={state} onSelect={index => dispatch({ type: 'SELECT', index })} onUnavailable={() => { setUnavailable(true); dispatch({ type: 'UNAVAILABLE' }); stopSpeech(); }}/>
      <div className="island-tag">FLOATING COLOR CLUB<span>聽指令 · 找顏色 · 守住小島</span></div>
      {phase === 'lobby' ? <div className="island-intro"><span className="island-kicker">LISTEN. MOVE. STAY!</span><h1>顏色<span>生存島</span></h1><p>聽到「Stand on blue!」<br/>就跑上藍色格，守住你的小島！</p><div className="island-modes" role="group" aria-label="選擇生存島難度">{ISLAND_MODES.map(item => <button key={item.id} aria-pressed={modeId === item.id} onClick={() => setModeId(item.id)}><b>{item.title}</b><small>{item.colors} 色 · {item.seconds} 秒 · {item.rounds} 回合</small></button>)}</div><p className="island-mode-tip">{mode.description}</p><button className="island-primary" disabled={unavailable} onClick={start}>登島挑戰 →</button><small>點平台或下方小地圖移動，也能用方向鍵／WASD。<br/>三個救生圈，站錯可重試；守住一回合 +10 XP。</small></div> : <>
        <div className="island-hud"><span>守住 <b>{state.completed}/{state.rounds.length}</b></span><span aria-label={`剩餘 ${state.lives} 個救生圈`}>救生圈 <b>{'♥'.repeat(state.lives)}{'♡'.repeat(3 - state.lives)}</b></span><button disabled={!active} onClick={pause}>Ⅱ 暫停</button></div>
        {['ready', 'playing', 'resolving', 'paused'].includes(phase) && <>
          <div className="island-clue"><small>第 {state.index + 1} 回合 · {state.mode.title}</small><div><button aria-label="重播顏色指令" disabled={phase !== 'playing'} onClick={() => speak(islandInstruction(current.target))}>🔊</button><h2>{visualPhase === 'resolving' || hint ? islandInstruction(current.target) : '聽指令，找安全色！'}</h2><button className="island-hint" disabled={phase !== 'playing'} onClick={() => setHint(value => !value)}>{hint ? '收起提示' : '文字提示'}</button></div>{(hint || visualPhase === 'resolving') && <p>{target.symbol} 站到{target.zh}的平台！</p>}<div className="island-time" role="progressbar" aria-label="本回合剩餘時間" aria-valuenow={Math.ceil(state.remainingMs / 1000)} aria-valuemin={0} aria-valuemax={Math.ceil(state.mode.seconds)}><i style={{ width: `${state.remainingMs / (state.mode.seconds * 1000) * 100}%` }}/></div></div>
          {phase === 'ready' && <div className="island-countdown" role="status"><b>{Math.ceil(state.readyMs / 1000)}</b><span>先看清楚顏色，準備出發！</span></div>}
          {phase === 'playing' && <><div className={`island-clock ${state.remainingMs <= 2000 ? 'is-urgent' : ''}`} aria-label="倒數秒數">{Math.ceil(state.remainingMs / 1000)}<small>秒</small></div></>}
          <div className="island-bottom">{phase === 'playing' && (<div className={`island-travel ${arrived ? 'has-arrived' : ''}`} role="status">{arrived ? `◎ 已抵達 · 第 ${state.targetTile + 1} 格 ${destination.zh}` : `➜ 移動中 · 前往第 ${state.targetTile + 1} 格 ${destination.zh}`}<small>{standingColor ? `目前站在${standingColor.zh}` : '目前在平台間隙，快回到格子中央！'}</small><small>{state.remainingMs <= 2000 ? '平台即將落下！' : '確認和聽到的顏色相同'}</small></div>)}<p role="status">{visualPhase === 'resolving' ? state.passed ? `守住了！${target.id} = ${target.zh} · +10 XP` : `被救生圈接住了！安全色是${target.zh}，再聽一次。` : '白色箭頭是你 · 點小地圖，跑到安全格'}</p><div className="island-minimap" aria-label="顏色平台小地圖">{current.tiles.map((id, index) => { const color = islandColor(id), gone = visualPhase === 'resolving' && id !== current.target; return <button key={`${state.index}-${index}`} style={{ '--tile': color.hex, '--ink': color.ink }} aria-label={`第 ${index + 1} 格，${color.zh}${occupied === index ? '，你在這裡' : ''}${gone ? '，已落下' : ''}`} aria-pressed={state.targetTile === index} disabled={phase !== 'playing'} className={`${gone ? 'is-gone' : ''} ${occupied === index ? 'has-player' : ''} ${state.targetTile === index ? 'is-destination' : ''}`} onClick={() => dispatch({ type: 'SELECT', index })}><small>{index + 1}</small><b aria-hidden="true">{color.symbol}</b><span>{color.zh}</span>{occupied === index ? <em>你</em> : state.targetTile === index ? <em>目的地</em> : null}</button>; })}</div></div>
        </>}
        {phase === 'paused' && <IslandPause onResume={() => dispatch({ type: 'RESUME' })} onLeave={leave}/>}
        {['won', 'lost'].includes(phase) && <div className="island-result-shade"><div className="island-modal island-result"><span>{phase === 'won' ? '★' : '◉'}</span><p>{state.mode.title}</p><h2>{phase === 'won' ? '守住彩虹島！' : '補充救生圈，再出發'}</h2><p>守住 {state.completed}/{state.rounds.length} 回合 · {state.mistakes} 次落水 · +{state.earned} XP</p><div className="island-review">{ISLAND_COLORS.slice(0, state.mode.colors).map(color => <button key={color.id} onClick={() => speak(islandInstruction(color.id))}><i style={{ background: color.hex }}>{color.symbol}</i><b>{color.id}</b><small>{color.zh} 🔊</small></button>)}</div><button className="island-primary" onClick={start}>再挑戰一次 →</button><button onClick={leave}>選擇其他難度</button><button onClick={() => { stopSpeech(); onBack(); }}>回遊戲大廳</button></div></div>}
      </>}
    </section><p className="island-footnote">倒數結束時，以角色實際站立的位置判定。文字提示、中文標籤和獨立符號都能協助辨認顏色。</p>
  </div>;
}
