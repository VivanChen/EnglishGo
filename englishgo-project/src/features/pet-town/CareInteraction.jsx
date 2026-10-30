import { useRef, useState } from 'react';

const stage = (label, hint, animation, tool, hits, gesture = 'tap') => ({ label, hint, animation, tool, hits, gesture });
export const CARE = [
  { id: 'feed', label: '餵食', icon: 'bowl', text: '聞一聞，再一口一口慢慢吃。', finish: 'happy', reply: '好好吃！再陪我一下吧。', stages: [stage('準備好點心', '點點心，讓牠聞聞香氣', 'sniff', '🥕', 2), stage('餵第一口', '點點心，送到牠嘴邊', 'eat', '🍪', 3), stage('餵最後一口', '把剩下的點心餵完', 'eat', '🍎', 2)] },
  { id: 'wash', label: '洗澡', icon: 'drop', text: '泡泡、溫水，還有蓬鬆的小毛巾。', finish: 'shake', reply: '甩甩水，變得香香的了！', stages: [stage('打出泡泡', '按住海綿，在夥伴身上來回移動', 'scrub', '🧽', 5, 'stroke'), stage('輕輕搓洗', '來回搓洗，幫牠揉揉背', 'scrub', '🫧', 6, 'stroke'), stage('沖掉泡泡', '移動蓮蓬頭，沖掉身上的泡沫', 'rinse', '🚿', 5, 'stroke'), stage('擦乾毛毛', '用毛巾輕輕來回擦乾', 'dry', '🧺', 4, 'stroke')] },
  { id: 'play', label: '玩耍', icon: 'ball', text: '你拋、牠接，再開心地撲一下。', finish: 'happy', reply: '接到了！和你玩最開心。', stages: [stage('拿出最愛的玩具', '點玩具，吸引牠的注意', 'sniff', '🎾', 2), stage('再玩一次', '點不同位置，讓玩具跳過去', 'pounce', '🎾', 4), stage('把玩具收好', '最後再接一次，和牠擊掌', 'play', '🐾', 2)] },
  { id: 'sleep', label: '休息', icon: 'moon', text: '伸個懶腰，陪牠慢慢進入夢鄉。', finish: 'sleep', reply: '晚安，有你在就很安心。', stages: [stage('鋪好小毯子', '輕點小毯子，讓牠舒舒服服躺下', 'settle', '🛏️', 2), stage('輕聲說晚安', '輕點月亮，陪牠閉上眼睛', 'sleep', '🌙', 3)] },
  { id: 'pet', label: '摸摸', icon: 'heart', text: '順著毛毛摸，牠會靠過來撒嬌。', finish: 'happy', reply: '好舒服，我最喜歡你了。', stages: [stage('輕輕摸摸', '按住小手，慢慢來回摸摸', 'pet', '🤚', 6, 'stroke')] },
];
export const careStage = care => CARE.find(c => c.id === care.type).stages[care.step];

/** The scene stays visible underneath; captured gestures never orbit or walk the pet. */
export default function CareInteraction({ care, name, onInteract, onCancel, motion }) {
  const drag = useRef(null), last = useRef(0);
  const [point, setPoint] = useState({ x: .5, y: .55 }), [pulse, setPulse] = useState(0);
  const current = careStage(care), rule = CARE.find(c => c.id === care.type);
  const position = event => {
    const r = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(.12, Math.min(.88, (event.clientX - r.left) / r.width)), y: Math.max(.22, Math.min(.78, (event.clientY - r.top) / r.height)) };
  };
  const hit = p => { setPulse(v => v + 1); onInteract(p); };
  return <div className={`town-care-overlay ${motion ? '' : 'is-still'}`} data-care-phase={current.animation}>
    <div className="town-care-caption" aria-live="polite"><small>{rule.label} · {care.step + 1} / {rule.stages.length}</small><strong>{current.label}</strong><span>{current.hint}</span></div>
    <button type="button" className="town-care-surface" aria-label={`${name}的${current.label}互動區`} aria-describedby="town-care-instruction"
      onPointerDown={e => { if (e.button !== 0 || drag.current) return; e.currentTarget.setPointerCapture?.(e.pointerId); const p = position(e); drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; setPoint(p); last.current = performance.now(); hit(p); }}
      onPointerMove={e => { const d = drag.current; if (!d || d.id !== e.pointerId) return; const p = position(e); setPoint(p); if (current.gesture === 'stroke' && Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 24 && performance.now() - last.current >= 90) { drag.current = { id: d.id, x: e.clientX, y: e.clientY }; last.current = performance.now(); hit(p); } }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onClick={e => { if (e.detail === 0) hit(point); }}>
      <span className="town-care-tool" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-hidden="true">{current.tool}</span>
      {pulse > 0 && <span key={pulse} className="town-care-spark" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-hidden="true">{care.type === 'wash' ? '✧' : '♥'}</span>}
    </button>
    <div className="town-care-hud"><p id="town-care-instruction">{current.gesture === 'stroke' ? '按住來回移動，或輕點互動區' : '輕點互動區'} · 鍵盤 Enter／空白鍵也可以</p><div role="progressbar" aria-label="照顧進度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((care.step + care.count / current.hits) / rule.stages.length * 100)}><i style={{ width: `${(care.step + care.count / current.hits) / rule.stages.length * 100}%` }}/></div><button type="button" onClick={onCancel}>結束這次陪伴</button></div>
  </div>;
}
