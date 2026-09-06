import { useEffect, useMemo, useRef, useState } from 'react';
import PracticeArt from '../components/PracticeArt.jsx';
import { achievementProgress, nextAchievement } from '../data/studyProgress.js';
import { useWorkshopStorage } from './workshopStorage.js';

export default function AchievementGarden({ onBack, onOpen, onQuickStart, unlocked, values, deps }) {
  const { definitions, Hdr, c } = deps;
  const { book: featured, save, saveError } = useWorkshopStorage('eg_featured_badge', '', value => typeof value === 'string' ? value : null);
  const [filter, setFilter] = useState('all'), [selected, setSelected] = useState(null), [notice, setNotice] = useState('');
  const detail = useRef(null), rows = useMemo(() => achievementProgress(definitions, unlocked, values), [definitions, unlocked, values]);
  const earned = rows.filter(row => row.earned), next = nextAchievement(rows), chosen = rows.find(row => row.id === selected);
  const pinned = earned.find(row => row.id === featured) || earned[0];
  const visible = rows.filter(row => filter === 'all' || (filter === 'earned' ? row.earned : !row.earned));
  useEffect(() => { if (chosen) { detail.current?.focus({ preventScroll: true }); detail.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' }); } }, [selected]);
  const practice = row => row.module === 'srs' ? onQuickStart() : onOpen(row.module, row.group);
  return <div className="practice-world achievement-garden">
    <Hdr t="🏆 成就徽章" onBack={onBack} cl={c.cl} />
    <section className="practice-intro"><PracticeArt kind="review" complete={earned.length > 0} /><div><span className="practice-eyebrow">努力，都值得被記住</span><h2>慢慢收集自己的進步</h2><p>已收藏 {earned.length} / {rows.length} 枚徽章。不用跟別人比，照自己的步調前進。</p>{pinned && <div className="badge-featured"><span aria-hidden="true">{pinned.icon}</span><div><small>我的展示徽章</small><b>{pinned.name}</b></div></div>}</div></section>
    {next ? <section className="practice-resume"><div><span className="practice-eyebrow">下一個小目標</span><h3>{next.name}</h3><p>{next.desc} · 還差 {next.remaining} {next.unit}</p><progress max={next.target} value={Math.min(next.current, next.target)} aria-label={`${next.name}進度`} /></div><button className="practice-primary" onClick={() => practice(next)}>{next.action}</button></section> : <section className="practice-resume"><div><h3>目前的徽章都收藏到了！</h3><p>可以回到喜歡的練習，也可以好好休息一下。</p></div><button onClick={onBack}>回去看看</button></section>}
    <div className="practice-choice-row badge-filters" role="group" aria-label="顯示哪些徽章">{[['all', '全部徽章'], ['earned', '已收藏'], ['next', '還在路上']].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => { setFilter(id); setSelected(null); }}>{label} · {id === 'all' ? rows.length : id === 'earned' ? earned.length : rows.length - earned.length}</button>)}</div>
    {chosen && <section className="badge-detail practice-config" aria-label={`${chosen.name}的收藏說明`}>
      <h3 ref={detail} tabIndex={-1}>{chosen.icon} {chosen.name}</h3><p>{chosen.desc}</p><p>{chosen.earned ? '這枚徽章已經收藏，會一直留在這裡。' : `目前 ${Math.min(chosen.current, chosen.target)} / ${chosen.target} ${chosen.unit}，還差 ${chosen.remaining} ${chosen.unit}。`}</p><div className="practice-actions">{chosen.earned ? <button className="practice-primary" onClick={() => { save(chosen.id); setNotice(`已展示「${chosen.name}」。`); }} disabled={pinned?.id === chosen.id}>{pinned?.id === chosen.id ? '正在展示這一枚' : '展示這枚徽章'}</button> : <button className="practice-primary" onClick={() => practice(chosen)}>{chosen.action}</button>}<button onClick={() => { const id = selected; setSelected(null); document.getElementById(`badge-${id}`)?.focus(); }}>收起說明</button></div>
    </section>}
    <div className="badge-grid">{visible.map(row => <button id={`badge-${row.id}`} key={row.id} className={`badge-card ${row.earned ? 'is-earned' : ''}`} aria-expanded={row.id === selected} aria-label={`${row.name}，${row.earned ? '已收藏' : `還差 ${row.remaining} ${row.unit}`}`} onClick={() => { setSelected(row.id === selected ? null : row.id); setNotice(''); }}><span className="badge-illustration" aria-hidden="true"><span>{row.icon}</span></span><strong>{row.name}</strong><span className="badge-description">{row.desc}</span>{row.earned ? <span className="badge-state">✓ {pinned?.id === row.id ? '已收藏 · 展示中' : '已收藏'}</span> : <><progress value={Math.min(row.current, row.target)} max={row.target} aria-label={`${row.name}達成進度`} /><span className="badge-state">{Math.min(row.current, row.target)} / {row.target} {row.unit}</span></>}</button>)}</div>
    {!visible.length && <section className="practice-config"><h3>{filter === 'earned' ? '第一枚徽章正在等你' : '這裡的目標都完成了'}</h3><p>{filter === 'earned' ? '先做一輪小練習，完成後就會留下新的足跡。' : '選「已收藏」，看看自己累積的努力。'}</p><button className="practice-primary" onClick={onQuickStart}>開始 5 張單字小任務</button></section>}
    {(notice || saveError) && <p role="status" className="practice-save-note">{saveError ? '展示設定暫時無法保存，下次可以再選一次。' : notice}</p>}<p className="practice-save-note">徽章累積這台裝置所有年級的紀錄；已收藏的徽章不會因為休息而消失。</p>
  </div>;
}
