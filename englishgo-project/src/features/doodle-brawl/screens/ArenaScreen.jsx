import { useEffect, useRef, useState } from 'react';
import { ELITE_WAVES, ENEMIES, WAVE_COUNT } from '../data/enemies.js';
import { xpForLevel } from '../engine/build.js';
import { STEP, createWorld, stepWorld, timeLeft } from '../engine/sim.js';
import { createRenderer } from '../render/draw.js';
import { play } from '../sound.js';
import { StarIcon } from './parts.jsx';

const KEYS = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};
const STICK = 58;
const isTest = () => typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

function snapshot(world) {
  const p = world.player, boss = world.boss;
  return {
    hp: Math.ceil(p.hp), maxHp: p.maxHp, level: world.level, xp: world.xp, need: xpForLevel(world.level),
    stars: world.stars, crates: world.crates, time: timeLeft(world), phase: world.phase, outcome: world.outcome,
    boss: boss ? { hp: Math.max(0, Math.ceil(boss.hp)), maxHp: boss.maxHp } : null,
  };
}

function waveTitle(wave) {
  if (wave >= WAVE_COUNT) return { en: 'Final Wave', zh: '墨水大王來了！打倒牠就贏了。' };
  const elite = ELITE_WAVES[wave];
  if (elite) return { en: `Wave ${wave}`, zh: `小心！精英怪 ${ENEMIES[elite].en}（${ENEMIES[elite].zh}）會出現。` };
  return { en: `Wave ${wave}`, zh: wave === 1 ? '撐到倒數結束，武器會自動攻擊！' : '撐到倒數結束！' };
}

export default function ArenaScreen({ run, paused, onPause, onDone, firstTime }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const inputRef = useRef({ x: 0, y: 0 });
  const keysRef = useRef(new Set());
  const stickRef = useRef(null);
  const pausedRef = useRef(paused);
  const doneRef = useRef(onDone);
  const pauseRef = useRef(onPause);
  const worldRef = useRef(null);
  pausedRef.current = paused;
  doneRef.current = onDone;
  pauseRef.current = onPause;
  if (!worldRef.current) worldRef.current = createWorld(run);
  const [hud, setHud] = useState(() => snapshot(worldRef.current));
  const [stick, setStick] = useState(null);
  const [intro, setIntro] = useState(true);
  const [hint, setHint] = useState(firstTime);
  const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), 2200);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!hint) return undefined;
    const timer = window.setTimeout(() => setHint(false), 7000);
    return () => window.clearTimeout(timer);
  }, [hint]);

  // The game loop: fixed simulation steps, one draw per frame, HUD at 10 fps.
  useEffect(() => {
    const world = worldRef.current;
    const canvas = canvasRef.current;
    const ctx = isTest() ? null : canvas?.getContext?.('2d');
    const draw = createRenderer();
    const raf = window.requestAnimationFrame?.bind(window) || (cb => window.setTimeout(() => cb(performance.now()), 16));
    const cancel = window.cancelAnimationFrame?.bind(window) || window.clearTimeout;
    let frameId = 0, last = performance.now(), acc = 0, hudAt = 0, reported = false;
    let size = { width: 0, height: 0, dpr: 1 };
    const resize = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect || !canvas) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = { width: rect.width, height: rect.height, dpr };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (observer && wrapRef.current) observer.observe(wrapRef.current);
    window.addEventListener('resize', resize);
    const frame = now => {
      frameId = raf(frame);
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      if (!pausedRef.current && !world.done) {
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 6) { stepWorld(world, inputRef.current, STEP); acc -= STEP; steps += 1; }
        if (steps === 6) acc = 0;
      }
      if (world.events.length) {
        const heard = new Set(world.events);
        world.events.length = 0;
        heard.forEach(play);
      }
      if (ctx && size.width) draw(ctx, world, { ...size, time: now / 1000 });
      if (now - hudAt > 100 || world.done) { hudAt = now; setHud(snapshot(world)); }
      if (world.done && !reported) { reported = true; doneRef.current?.(world.result); }
    };
    frameId = raf(frame);
    return () => { cancel(frameId); observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, []);

  // Keyboard: WASD or arrows to move, Esc or P to pause.
  useEffect(() => {
    const update = () => {
      let x = 0, y = 0;
      keysRef.current.forEach(code => { x += KEYS[code][0]; y += KEYS[code][1]; });
      if (!stickRef.current) inputRef.current = { x, y };
      if (x || y) setHint(false);
    };
    const down = event => {
      if (event.code === 'Escape' || event.code === 'KeyP') { event.preventDefault(); pauseRef.current?.(); return; }
      if (!KEYS[event.code] || event.target?.closest?.('input, textarea')) return;
      event.preventDefault();
      keysRef.current.add(event.code);
      update();
    };
    const up = event => { if (KEYS[event.code]) { keysRef.current.delete(event.code); update(); } };
    const clear = () => { keysRef.current.clear(); update(); };
    const hide = () => { if (document.hidden) { clear(); pauseRef.current?.(); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);

  // Touch (or mouse drag): a floating joystick wherever the finger lands.
  const pointerDown = event => {
    if (event.button > 0 || event.target.closest('button')) return;
    const rect = wrapRef.current.getBoundingClientRect();
    stickRef.current = { id: event.pointerId, ox: event.clientX - rect.left, oy: event.clientY - rect.top };
    try { wrapRef.current.setPointerCapture?.(event.pointerId); } catch { /* the pointer was already released */ }
    setStick({ ox: stickRef.current.ox, oy: stickRef.current.oy, kx: 0, ky: 0 });
    setHint(false);
  };
  const pointerMove = event => {
    const s = stickRef.current;
    if (!s || event.pointerId !== s.id) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const dx = event.clientX - rect.left - s.ox, dy = event.clientY - rect.top - s.oy;
    const length = Math.hypot(dx, dy);
    const strength = Math.min(1, length / (STICK * 0.6));
    inputRef.current = length > 5 ? { x: (dx / length) * strength, y: (dy / length) * strength } : { x: 0, y: 0 };
    const k = length > STICK ? STICK / length : 1;
    setStick({ ox: s.ox, oy: s.oy, kx: dx * k, ky: dy * k });
  };
  const pointerUp = event => {
    if (!stickRef.current || event.pointerId !== stickRef.current.id) return;
    stickRef.current = null;
    setStick(null);
    let x = 0, y = 0;
    keysRef.current.forEach(code => { x += KEYS[code][0]; y += KEYS[code][1]; });
    inputRef.current = { x, y };
  };

  const title = waveTitle(run.wave);
  const hpRatio = Math.max(0, hud.hp / hud.maxHp);
  const lowHp = hpRatio < 0.35;
  return <div className="db-arena">
    <div ref={wrapRef} className="db-arena-stage" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
      <canvas ref={canvasRef} className="db-canvas" aria-label={`第 ${run.wave} 波戰場`}/>
      {stick && <div className="db-stick" style={{ left: stick.ox, top: stick.oy }} aria-hidden="true"><i style={{ transform: `translate(${stick.kx}px, ${stick.ky}px)` }}/></div>}
    </div>

    <div className="db-hud">
      <div className="db-hud-left">
        <div className={`db-bar is-hp ${lowHp ? 'is-low' : ''}`} role="meter" aria-label="生命" aria-valuemin={0} aria-valuemax={hud.maxHp} aria-valuenow={hud.hp}>
          <span style={{ width: `${hpRatio * 100}%` }}/><b>{hud.hp} / {hud.maxHp}</b>
        </div>
        <div className="db-bar is-xp" role="meter" aria-label={`等級 ${hud.level}`} aria-valuemin={0} aria-valuemax={hud.need} aria-valuenow={hud.xp}>
          <span style={{ width: `${(hud.xp / hud.need) * 100}%` }}/><b lang="en">LV {hud.level}</b>
        </div>
      </div>
      <div className="db-hud-center">
        <small lang="en">{run.wave >= WAVE_COUNT ? 'FINAL WAVE' : `WAVE ${run.wave} / ${WAVE_COUNT}`}</small>
        {hud.time !== null && <strong className={hud.time <= 5 && hud.phase === 'fight' ? 'is-ending' : ''} aria-live="off">{hud.time}</strong>}
        {hud.boss && <div className="db-boss-bar" role="meter" aria-label="墨水大王的生命" aria-valuemin={0} aria-valuemax={hud.boss.maxHp} aria-valuenow={hud.boss.hp}>
          <span style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }}/><b lang="en">The Ink King</b>
        </div>}
      </div>
      <div className="db-hud-right">
        <span className="db-hud-stars" aria-label={`星星 ${run.stars + hud.stars}`}><StarIcon size={20}/><b>{run.stars + hud.stars}</b></span>
        {hud.crates > 0 && <span className="db-hud-crates" aria-label={`寶箱 ${hud.crates}`}>🎁<b>{hud.crates}</b></span>}
        <button type="button" className="db-pause-btn" onClick={onPause} aria-label="暫停">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/></svg>
        </button>
      </div>
    </div>

    {intro && hud.phase === 'fight' && <div className="db-banner is-intro" aria-live="polite"><b lang="en">{title.en}</b><span>{title.zh}</span></div>}
    {hud.phase === 'outro' && <div className="db-banner is-clear" aria-live="polite"><b lang="en">{hud.outcome === 'victory' ? 'You Win!' : 'Wave Clear!'}</b><span>{hud.outcome === 'victory' ? '筆記本得救了！' : '星星收集中…'}</span></div>}
    {hud.phase === 'dead' && <div className="db-banner is-dead" aria-live="polite"><b lang="en">Oh no!</b><span>被墨水淹沒了…</span></div>}
    {hint && !intro && <div className="db-hint">{coarse ? '按住畫面任何地方拖曳來移動' : '用 WASD 或方向鍵移動（也可以按住滑鼠拖曳）'}<small>武器會自動瞄準最近的墨水怪</small></div>}
  </div>;
}
