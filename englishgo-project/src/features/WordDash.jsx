import { useEffect, useRef, useState } from 'react';
import WordDashScene from '../components/WordDashScene.jsx';
import { DASH_COURSES, DASH_OBSTACLE_NAMES, dashCourseObstacle, makeDashRounds } from '../data/wordDash.js';
import './word-dash.css';

const OUTFITS = [{ color: '#b57cff', name: '葡萄紫' }, { color: '#ff739b', name: '草莓粉' }, { color: '#39d6c5', name: '薄荷綠' }, { color: '#ffca45', name: '奶油黃' }];
function PauseDialog({ onResume, onLeave, onCourses }) {
  const dialog = useRef(null);
  useEffect(() => { const node = dialog.current; if (node.showModal) node.showModal(); else node.setAttribute('open', ''); return () => node.close?.(); }, []);
  const trapFocus = event => {
    if (event.key !== 'Tab') return;
    const buttons = dialog.current.querySelectorAll('button'), first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <dialog ref={dialog} className="dash-modal dash-pause" aria-label="遊戲暫停" onKeyDown={trapFocus} onCancel={event => { event.preventDefault(); onResume(); }}><span>Ⅱ</span><h2>喘口氣，再衝！</h2><p>賽道與計時已暫停。</p><button autoFocus className="dash-primary" onClick={onResume}>繼續比賽 →</button><button onClick={onCourses}>重選賽道</button><button onClick={onLeave}>回遊戲大廳</button></dialog>;
}

export default function WordDash({ lv, onBack, onXp, deps }) {
  const { V, speak, stopSpeech, playSound, loadExtraWords, fetchCloudVocab } = deps;
  const [pool, setPool] = useState(V[lv] || []);
  const [courseId, setCourseId] = useState(DASH_COURSES[0].id);
  const course = DASH_COURSES.find(item => item.id === courseId) || DASH_COURSES[0];
  const nextCourse = DASH_COURSES[DASH_COURSES.indexOf(course) + 1];
  const [rounds, setRounds] = useState([]), [phase, setPhase] = useState('lobby');
  const [index, setIndex] = useState(0), [lane, setLane] = useState(1), [jump, setJump] = useState(0);
  const [mistakes, setMistakes] = useState(0), [seconds, setSeconds] = useState(0), [feedback, setFeedback] = useState('');
  const [run, setRun] = useState(0), [hint, setHint] = useState(false);
  const [rank, setRank] = useState(1), [race, setRace] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [countdown, setCountdown] = useState(3), [progress, setProgress] = useState(0), [combo, setCombo] = useState(0);
  const [impact, setImpact] = useState(''), [color, setColor] = useState(OUTFITS[0].color);
  const arena = useRef(null), picker = useRef(null), gesture = useRef(null), resumePhase = useRef('playing');
  const running = phase === 'playing' || phase === 'finishing';
  const pause = () => { resumePhase.current = phase; setPhase('paused'); stopSpeech(); };
  const resume = () => { setPhase(resumePhase.current); arena.current?.focus({ preventScroll: true }); };
  const guard = useRef(false), current = rounds[index];
  useEffect(() => {
    const target = phase === 'lobby' ? picker.current : ['countdown', 'playing'].includes(phase) ? arena.current : null;
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      const navHeight = document.querySelector('.eg-app-nav')?.getBoundingClientRect().height || 0;
      target.style.scrollMarginTop = `${navHeight + 12}px`;
      target.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [phase]);
  useEffect(() => {
    let active = true;
    Promise.allSettled([loadExtraWords(), fetchCloudVocab(lv, 80)]).then(([extra, cloud]) => {
      if (active) setPool([...(V[lv] || []), ...(extra.status === 'fulfilled' ? extra.value?.[lv] || [] : []), ...(cloud.status === 'fulfilled' ? cloud.value || [] : [])]);
    });
    return () => { active = false; stopSpeech(); };
  }, [lv, V, loadExtraWords, fetchCloudVocab, stopSpeech]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (phase !== 'countdown') return;
    const timer = setInterval(() => setCountdown(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => { if (phase === 'countdown' && countdown === 0) setPhase('playing'); }, [phase, countdown]);
  useEffect(() => {
    const hide = () => { if (document.hidden && (running || phase === 'countdown')) pause(); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [phase, running, stopSpeech]);
  useEffect(() => { if (!impact || phase === 'paused') return; const timer = setTimeout(() => setImpact(''), 1300); return () => clearTimeout(timer); }, [impact, index, mistakes, phase]);
  useEffect(() => { if (phase === 'playing' && current) speak(current.w); }, [index, phase, run, speak]);
  useEffect(() => {
    const key = event => {
      if (phase !== 'playing' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input,textarea,select,[contenteditable=true]')) return;
      if (['ArrowLeft', 'ArrowRight', ' ', '1', '2', '3'].includes(event.key)) event.preventDefault();
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') setLane(v => Math.max(0, v - 1));
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') setLane(v => Math.min(2, v + 1));
      if (/^[1-3]$/.test(event.key)) setLane(Number(event.key) - 1);
      if (event.key === ' ') setJump(v => v + 1);
      if (event.key === 'Escape') pause();
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [phase, stopSpeech]);
  function start(nextId) {
    const selected = DASH_COURSES.find(item => item.id === nextId) || course;
    const next = makeDashRounds(pool, Math.random, selected.rounds);
    if (!next.length) { setFeedback('至少需要 3 個不同意思的單字才能開賽，請稍後再試。'); return; }
    stopSpeech(); setCourseId(selected.id); setRounds(next); setIndex(0); setLane(1); setJump(0); setMistakes(0); setSeconds(0); setHint(false);
    setRank(1); setRace(null); setCombo(0); setProgress(0); setImpact(''); setCountdown(3); setFeedback(selected.tip);
    guard.current = false; setRun(v => v + 1); setPhase('countdown'); arena.current?.focus({ preventScroll: true });
  }
  function gate(selected) {
    if (phase !== 'playing' || guard.current || !current.choices[selected]) return false;
    if (current.choices[selected].w !== current.w) {
      setMistakes(v => v + 1); setCombo(0); setImpact('retry'); setFeedback('哎呀，彈回來了！換一扇門，再試一次。'); playSound('bad'); speak(current.w); return false;
    }
    guard.current = true; onXp?.(10); playSound('good'); setCombo(v => v + 1); setImpact('success');
    setFeedback(`${current.w} · ${current.m} — 衝門成功！+10 XP`);
    if (index + 1 === rounds.length) { setPhase('finishing'); stopSpeech(); }
    else { setIndex(v => v + 1); setHint(false); }
    return true;
  }
  useEffect(() => { guard.current = false; }, [index]);
  function finish(place = rank) { if (phase !== 'finishing') return; setRank(place); setProgress(100); setPhase('won'); playSound(place === 1 ? 'done' : 'bad'); }
  function showCourses() { stopSpeech(); setPhase('lobby'); setRounds([]); setIndex(0); setFeedback(''); setRun(value => value + 1); setUnavailable(false); }
  function swipe(event) {
    if (!gesture.current) return;
    const { x, y } = gesture.current; gesture.current = null;
    const dx = event.clientX - x, dy = event.clientY - y;
    if (phase === 'playing' && Math.abs(dx) > 32 && Math.abs(dx) > Math.abs(dy) * 1.25) setLane(value => Math.max(0, Math.min(2, value + Math.sign(dx))));
  }
  return <div className="dash-page">
    <header className="dash-header"><button onClick={() => { stopSpeech(); onBack(); }}>← 遊戲大廳</button><span>ENGLISHGO <b>PARTY RUN</b></span><span className="dash-live">原創 3D 闖關</span></header>
    {phase === 'lobby' && <section ref={picker} className="dash-course-picker" aria-label="選擇闖關賽道"><div className="dash-picker-heading"><h2>四座世界，今天衝哪一關？</h2><span>全部開放 · 自由挑戰</span></div><div className="dash-course-cards">{DASH_COURSES.map((item, i) => <button key={item.id} type="button" aria-pressed={courseId === item.id} style={{ '--course-sky': item.sky, '--course-floor': item.floors[0], '--course-rail': item.rail }} onClick={() => { setCourseId(item.id); setUnavailable(false); }}><span className="dash-course-mini" aria-hidden="true"><b>{String(i + 1).padStart(2, '0')}</b><i/><i/><i/></span><span className="dash-course-card-copy"><small>{item.difficulty} · {item.rounds} 道單字門</small><strong>{item.title}</strong><span>{item.subtitle}</span><em>{courseId === item.id ? '✓ 已選擇' : '選這一關 →'}</em></span></button>)}</div></section>}
    <section ref={arena} tabIndex={-1} className={`dash-arena ${phase === 'lobby' ? 'is-lobby' : ''}`} aria-label="單字衝衝 3D 賽道" onPointerDown={event => { if (phase === 'playing' && !event.target.closest('button')) gesture.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={swipe} onPointerCancel={() => { gesture.current = null; }}>
      <WordDashScene key={`${course.id}-${run}`} course={course} phase={phase} lane={lane} jump={jump} round={index} total={rounds.length || course.rounds} color={color} choices={current?.choices} rounds={rounds} onGate={gate} onFinish={finish} onRank={setRank} onRace={setRace} onProgress={setProgress} onUnavailable={() => { setUnavailable(true); setPhase('unavailable'); stopSpeech(); }} onBump={() => { setImpact('bump'); setFeedback('撞到障礙，被彈退了！對手會繼續跑，快追上！'); }}/>
      <div className="dash-course-tag">{phase === 'lobby' ? course.title : `${String(index + 1).padStart(2, '0')} / ${DASH_OBSTACLE_NAMES[dashCourseObstacle(course, index)]}`}<span>{phase === 'lobby' ? '單人 · 6 位電腦對手' : course.title}</span></div>
      {phase === 'lobby' ? <div className="dash-intro"><span className="dash-kicker">LISTEN. RUN. JUMP!</span><h1>單字<span>衝衝！</span></h1><p className="dash-course-description">{course.description}</p><div className="dash-pills"><span>{course.difficulty}</span><span>{course.rounds} 道單字門</span><span>最多 +{course.rounds * 10} XP</span></div><div className="dash-outfits" role="group" aria-label="選擇角色顏色"><span>你的衝衝豆</span>{OUTFITS.map(outfit => <button key={outfit.color} style={{ "--outfit": outfit.color }} aria-label={outfit.name} aria-pressed={color === outfit.color} onClick={() => setColor(outfit.color)}>{color === outfit.color ? "✓" : ""}</button>)}</div><button className="dash-primary" onClick={start}>開始衝衝 <span>➜</span></button><small>← → / A D 換道 · 空白鍵跳躍<br/>手機左右滑動，或點選跑道</small>{feedback && <p role="status">{feedback}</p>}</div> : <>
        <div className="dash-hud"><span>名次 <b>{rank} / 7</b></span><span>通關 <b>{phase === 'won' || phase === 'finishing' ? rounds.length : index} / {rounds.length}</b></span><span>時間 <b>{seconds}s</b></span><button onClick={pause} disabled={(!running && phase !== 'countdown') || unavailable}>Ⅱ 暫停</button></div>
        <div className="dash-race-progress" role="img" aria-label={`全體賽程：你目前第 ${rank} 名，${race?.rivals.filter(value => value >= race.finish).length || 0} 位對手已衝線`}>
          <span>起點</span><div>{[...(race?.rivals || Array(6).fill(-2)), race?.player ?? -2].map((distance, i) => <i key={i} className={`${i === 6 ? 'is-you' : ''} ${(i === 6 ? race?.playerRecoil : race?.recoiling?.[i]) ? 'is-hit' : ''}`} style={{ left: `${Math.max(0, Math.min(100, (distance + 2) / ((race?.finish || course.rounds * 32 - 3) + 2) * 100))}%`, top: `${i < 6 ? i * 3 : 17}px` }} title={i === 6 ? '你' : `對手 ${i + 1}`} data-distance={distance} data-impacts={i < 6 ? race?.impacts?.[i] || 0 : undefined}>{i === 6 ? '你' : ''}</i>)}</div><span>終點</span>
        </div>
        {impact && phase === 'playing' && <div key={`${index}-${mistakes}-${impact}`} className={`dash-impact ${impact}`} aria-hidden="true"><b>{impact === 'success' ? '衝門成功！' : impact === 'retry' ? 'BOING!' : '小心障礙！'}</b><span>{impact === 'success' ? `${combo > 1 ? `${combo} 連對 · ` : ''}加速前進 +10 XP` : impact === 'retry' ? '換一扇門，再試一次' : '跳躍 ↑ 或換道閃開'}</span></div>}
        {phase === 'countdown' && <div className="dash-countdown" role="status"><b key={countdown}>{countdown}</b><span>準備好了嗎？</span></div>}
        {phase === 'finishing' && <div className="dash-finish-banner"><b>最後衝刺！</b><span>單字門已通過，名次以衝線順序決定</span></div>}
        {phase === 'playing' && <><div className="dash-question"><span>LISTEN & CHOOSE · 第 {index + 1} 道門</span><div><button aria-label="再聽一次單字" onClick={() => speak(current.w)}>🔊</button><h2>{hint ? current.w : '聽聽看，跑向哪扇門？'}</h2><button className="dash-hint" onClick={() => setHint(v => !v)}>{hint ? '隱藏' : '看英文'}</button></div></div><div className="dash-bottom"><p role="status">{feedback}</p><div className="dash-controls"><div className="dash-lanes" aria-label="選擇跑道">{current.choices.map((choice, i) => <button key={`${index}-${i}`} aria-pressed={lane === i} onClick={() => setLane(i)}><small>{i + 1} {lane === i ? '▼ 你的跑道' : '選擇跑道'}</small><b>{choice.m}</b></button>)}</div><button className="dash-jump" onClick={() => setJump(v => v + 1)}>↑<span>跳躍</span></button></div></div></>}
        {phase === 'paused' && <PauseDialog onResume={resume} onCourses={showCourses} onLeave={() => { stopSpeech(); onBack(); }}/>}
        {phase === 'won' && <div className="dash-shade"><div className="dash-modal dash-result"><span>★</span><p>{course.title} · FINISH!</p><h2>{rank === 1 ? '冠軍！你贏了！' : '這次未奪冠，再挑戰！'}</h2><p className="dash-placement">第 {rank} 名 / 7 位選手</p><p>{rank === 1 ? '第一個抵達終點！' : `${rank - 1} 位對手比你先衝線。完成單字門的 XP 仍然保留。`}</p><div className="dash-stars">{'★'.repeat(mistakes === 0 ? 3 : mistakes < 4 ? 2 : 1)}</div><p>{seconds} 秒 · {mistakes} 次重試 · +{rounds.length * 10} XP</p><div className="dash-review">{rounds.map((word, i) => <button key={`${i}-${word.w}`} onClick={() => speak(word.w)}>{word.w}<small>{word.m} 🔊</small></button>)}</div>{nextCourse && <button className="dash-primary dash-next-course" onClick={() => start(nextCourse.id)}>下一關：{nextCourse.title} →</button>}<button className={nextCourse ? "dash-replay" : "dash-primary"} onClick={start}>再衝一次 ↗</button><button onClick={showCourses}>選擇其他賽道</button><button onClick={() => { stopSpeech(); onBack(); }}>回遊戲大廳</button></div></div>}
      </>}
    </section><p className="dash-footnote">自動向前跑；跳躍或換道閃避障礙，選錯門可以重試。每道門 +10 XP，選對就能加速前進！只有第一名贏得冠軍；每位選手各自碰撞、各自後退；橘色標記代表正在被彈退。</p>
  </div>;
}
