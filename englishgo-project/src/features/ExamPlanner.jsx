import { serviceErrorMessage } from '../lib/serviceErrors.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import PracticeArt from '../components/PracticeArt.jsx';
import { examSignature, parseExamDraft, readExamReview, readExamWorkspace, resolveExamCards } from '../data/examPlanner.js';
import { useWorkshopStorage } from './workshopStorage.js';

function initialWorkspace(lv) {
  let text = ''; try { const old = JSON.parse(localStorage.getItem(`eg_exam_${lv}`)); if (typeof old === 'string') text = old; } catch {}
  return readExamWorkspace({ text });
}
export default function ExamPlanner({ lv, onBack, onStart, apiKey, onOpenSettings, deps }) {
  const { Hdr, c, useLS, terms, counts, defaultTerm, generateWords, fetchCloudWord, findAnyWord, orderCards } = deps;
  const { book, live, save, saveError } = useWorkshopStorage(`eg_exam_planner_${lv}`, initialWorkspace(lv), readExamWorkspace);
  const [step, setStep] = useState('draft'), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [notice, setNotice] = useState('');
  const [meaning, setMeaning] = useState({}), [undo, setUndo] = useState(null), [aiBusy, setAiBusy] = useState(false), [suggestions, setSuggestions] = useState([]), [aiError, setAiError] = useState('');
  const [term, setTerm] = useLS(`exam_ai_term_${lv}`, defaultTerm(lv)), [count, setCount] = useLS(`exam_ai_count_${lv}`, 10);
  const job = useRef(null), aiRequest = useRef(0), launch = useRef(false), title = useRef(null);
  const parsed = useMemo(() => parseExamDraft(book.text), [book.text]), review = readExamReview(book.review, parsed.words);
  const levelTerms = terms.filter(([id]) => id.startsWith(`${lv}-`)), effectiveTerm = levelTerms.some(([id]) => id === term) ? term : defaultTerm(lv);
  const selectedCards = review?.cards.filter(card => card.m.trim() && !review.excluded.includes(card.w)) || [];
  const sample = lv === 'elementary' ? 'apple school water happy run' : lv === 'junior' ? 'environment experience communicate opportunity improve' : 'comprehensive phenomenon sustainable ambiguous facilitate';
  const stop = () => { job.current?.abort(); job.current = null; setBusy(false); aiRequest.current++; setAiBusy(false); };
  useEffect(() => () => { job.current?.abort(); aiRequest.current++; }, []);
  useEffect(() => { title.current?.focus({ preventScroll: true }); title.current?.closest('.practice-world')?.scrollIntoView?.({ block: 'start', behavior: 'instant' }); }, [step]);
  const edit = text => { stop(); save({ ...live.current, text, review: null }); setSuggestions([]); setNotice(''); setStep('draft'); };
  const prepare = async () => {
    if (job.current || !parsed.words.length) return;
    const controller = new AbortController(); job.current = controller;
    const snapshot = [...parsed.words]; setBusy(true); setProgress(0); setNotice('');
    try {
      const cards = await resolveExamCards(snapshot, { lookupCloud: word => fetchCloudWord(lv, word), lookupLocal: word => findAnyWord(lv, word), signal: controller.signal, onProgress: done => setProgress(done) });
      if (controller.signal.aborted) return;
      save({ ...live.current, review: { signature: examSignature(snapshot), cards, excluded: cards.filter(card => !card.m.trim()).map(card => card.w) } });
      launch.current = false; setMeaning({}); setStep('review');
    } catch { if (!controller.signal.aborted) setNotice('整理暫時沒有完成，範圍還在，可以再試一次。'); }
    finally { if (job.current === controller) { job.current = null; setBusy(false); } }
  };
  const updateReview = change => { const current = readExamReview(live.current.review, parseExamDraft(live.current.text).words); if (current) save({ ...live.current, review: change(current) }); };
  const toggle = word => updateReview(current => ({ ...current, excluded: current.excluded.includes(word) ? current.excluded.filter(w => w !== word) : [...current.excluded, word] }));
  const fillMeaning = word => {
    const value = (meaning[word] || '').trim(); if (!value) return;
    updateReview(current => ({ ...current, cards: current.cards.map(card => card.w === word ? { ...card, m: value, customMissing: false, source: '自填字義' } : card), excluded: current.excluded.filter(w => w !== word) }));
  };
  const start = () => {
    if (launch.current) return;
    const current = live.current, checked = readExamReview(current.review, parseExamDraft(current.text).words);
    const available = checked?.cards.filter(card => card.m.trim() && !checked.excluded.includes(card.w)) || [];
    if (!available.length) return;
    launch.current = true;
    const cards = orderCards(available, lv).slice(0, current.size);
    onStart?.({ cards, missing: [], source: `考試範圍 (${cards.length}字)${current.name.trim() ? ` · ${current.name.trim()}` : ''}` });
  };
  const storeList = () => {
    const current = live.current; if (!parseExamDraft(current.text).words.length) return;
    const existing = current.lists.find(item => item.id === current.selected);
    if (!existing && current.lists.length >= 12) { setNotice('已收藏 12 份範圍。可以更新現有的一份，或移除暫時用不到的範圍。'); return; }
    const id = existing?.id || (globalThis.crypto?.randomUUID?.() || `exam-${Date.now()}`);
    const name = current.name.trim() || existing?.name || `我的範圍 ${current.lists.length + 1}`;
    const item = { id, name, text: current.text, review: current.review, updatedAt: Date.now() };
    save({ ...current, name, selected: id, lists: existing ? current.lists.map(old => old.id === id ? item : old) : [...current.lists, item] }); setNotice(`已收藏「${name}」，下次可以直接打開。`);
  };
  const loadList = item => { stop(); save({ ...live.current, selected: item.id, name: item.name, text: item.text, review: item.review || null }); setNotice(`已打開「${item.name}」。`); setSuggestions([]); setStep('draft'); };
  const removeList = item => { setUndo({ type: 'list', item, wasSelected: live.current.selected === item.id }); save({ ...live.current, selected: live.current.selected === item.id ? null : live.current.selected, lists: live.current.lists.filter(old => old.id !== item.id) }); };
  const clearDraft = fresh => {
    const current = live.current; stop();
    setUndo({ type: 'draft', draft: { text: current.text, name: current.name, selected: current.selected, review: current.review } });
    save({ ...current, text: '', review: null, ...(fresh ? { name: '', selected: null } : {}) });
    setSuggestions([]); setStep('draft'); setNotice('');
  };
  const restore = () => {
    const current = live.current;
    if (undo?.type === 'list') {
      const lists = current.lists.filter(item => item.id !== undo.item.id);
      if (lists.length >= 12) { setNotice('收藏已滿，先移除一份暫時用不到的範圍，才能放回這份。'); return; }
      save({ ...current, lists: [...lists, undo.item], selected: undo.wasSelected && !current.selected && current.text === undo.item.text && current.name === undo.item.name ? undo.item.id : current.selected });
    }
    else if (undo?.type === 'draft') { stop(); save({ ...current, ...undo.draft, selected: current.lists.some(item => item.id === undo.draft.selected) ? undo.draft.selected : null }); setStep('draft'); }
    setUndo(null);
  };
  const generate = async () => {
    if (aiBusy) return;
    if (!apiKey?.trim()) { setAiError('請大人先設定 AI，或直接貼上老師的單字範圍。'); onOpenSettings?.(); return; }
    const token = ++aiRequest.current; setAiBusy(true); setAiError(''); setSuggestions([]);
    try { const words = await generateWords({ term: effectiveTerm, lv, apiKey, count: counts.includes(Number(count)) ? Number(count) : 10 }); if (token === aiRequest.current) setSuggestions(parseExamDraft(words.join(' ')).words); }
    catch (error) { if (token === aiRequest.current) setAiError(serviceErrorMessage(error, 'AI 建議暫時沒有回來，你原本的範圍仍然保留著。')); }
    finally { if (token === aiRequest.current) setAiBusy(false); }
  };
  return <div className="practice-world exam-planner">
    <Hdr t="📝 考試範圍複習" onBack={() => { stop(); onBack(); }} cl={c.cl} />
    <section className="practice-intro"><PracticeArt /><div><span className="practice-eyebrow">考前準備，一小份就好</span><h2 ref={title} tabIndex={-1}>{step === 'draft' ? '把範圍放好，再慢慢練' : '看過字義，再出發'}</h2><p>整理範圍 → 確認字義 → 選幾個練習</p><p>每次可以只練 5 個，不用一次做完。</p></div></section>
    <div className="workshop-stepper" aria-label="考前準備步驟"><button aria-current={step === 'draft' ? 'step' : undefined} onClick={() => { stop(); setStep('draft'); }}>1　放入範圍</button><button disabled={!review} aria-current={step === 'review' ? 'step' : undefined} onClick={() => { launch.current = false; setStep('review'); }}>2　確認與練習</button></div>
    {step === 'draft' ? <section className="practice-config exam-draft">
      <h3>貼上老師指定的單字範圍</h3><p>用空格、逗號或換行分開單字，重複的字會自動合併。</p>
      <label htmlFor="exam-range">這次要練的英文單字</label><textarea id="exam-range" value={book.text} onChange={e => edit(e.target.value)} placeholder={sample} disabled={busy} />
      <div className="exam-count"><b>{parsed.words.length}</b><span>個單字 · 每份最多 80 個</span></div>
      {parsed.ignored > 0 && <p className="practice-save-note">已合併/忽略 {parsed.ignored} 筆重複或無效內容</p>}
      {parsed.overflow > 0 && <p className="practice-hint" role="status">還有 {parsed.overflow} 個超過本份上限，仍保留在輸入框。這次先整理前 80 個，剩下的可以另存一份。</p>}
      <div className="practice-actions"><button className="practice-primary" disabled={busy || !parsed.words.length} onClick={prepare}>{busy ? `正在確認 ${progress} / ${parsed.words.length}` : '先確認單字與字義 →'}</button>{busy ? <button onClick={() => { stop(); setNotice('已停止整理，輸入的範圍還在。'); }}>停止整理</button> : <><button onClick={() => edit(sample)}>填入範例</button>{book.text && <button onClick={() => clearDraft(false)}>清空範圍</button>}</>}</div>
      {review && <div className="practice-resume"><div><b>這份字義已經整理好了</b><p>可以接著確認勾選的單字。</p></div><button onClick={() => { launch.current = false; setStep('review'); }}>繼續上次整理 →</button></div>}
      {parsed.words.length > 0 && <div className="exam-word-chips" aria-label="範圍中的單字">{parsed.words.map(word => <button key={word} aria-label={`移除 ${word}`} disabled={busy} onClick={() => edit(parsed.allWords.filter(w => w !== word).join(' '))}><span lang="en">{word}</span><span aria-hidden="true">×</span></button>)}</div>}
      <details className="workshop-extra"><summary>還沒有範圍？看看 AI 單字建議</summary><h3>依學年、學期與數量填入單字範圍</h3><p>AI 提供程度相近的練習建議，實際考試範圍請以老師指定的內容為準。</p><div className="exam-ai-controls"><label>學年與學期<select data-testid="exam-ai-term" value={effectiveTerm} onChange={e => { aiRequest.current++; setAiBusy(false); setSuggestions([]); setTerm(e.target.value); }}>{levelTerms.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>建議數量<select data-testid="exam-ai-count" value={count} onChange={e => { aiRequest.current++; setAiBusy(false); setSuggestions([]); setCount(Number(e.target.value)); }}>{counts.map(n => <option key={n} value={n}>{n} 字</option>)}</select></label></div><button onClick={generate} disabled={aiBusy || busy}>{aiBusy ? '正在整理建議…' : 'AI 產生單字'}</button>{aiError && <div role="status"><p>{aiError}</p><button onClick={()=>onOpenSettings?.()}>API Key 設定</button></div>}{suggestions.length > 0 && <div className="practice-hint"><b>先看看這 {suggestions.length} 個建議</b><p lang="en">{suggestions.join(' · ')}</p><div className="practice-actions"><button onClick={() => edit(suggestions.join(' '))}>用這份建議</button><button onClick={() => edit(`${live.current.text}\n${suggestions.join(' ')}`)}>加入目前範圍</button></div></div>}</details>
    </section> : review && <section className="practice-config">
      <h3>這次想練哪幾個？</h3><p>已勾選 {selectedCards.length} 個。字義待確認的單字仍保留在範圍裡，補上字義後再加入。</p>
      <div className="exam-review-list">{review.cards.map(card => <div key={card.w} className={`exam-review-row ${!card.m.trim() ? 'is-pending' : ''}`}><label><input type="checkbox" checked={!!card.m.trim() && !review.excluded.includes(card.w)} disabled={!card.m.trim()} onChange={() => toggle(card.w)} /><span><b lang="en">{card.w}</b><span>{card.m || '字義待確認'}</span>{card.source === '自填字義' && <small>自填字義</small>}</span></label>{!card.m.trim() && <div className="exam-meaning"><label htmlFor={`meaning-${card.w}`}>請大人幫忙填寫「{card.w}」的字義</label><input id={`meaning-${card.w}`} value={meaning[card.w] || ''} onChange={e => setMeaning({ ...meaning, [card.w]: e.target.value })} maxLength={120} /><button disabled={!(meaning[card.w] || '').trim()} onClick={() => fillMeaning(card.w)}>存下 {card.w} 的字義</button></div>}</div>)}</div>
      <fieldset><legend>這輪想練多少？</legend><div className="practice-choice-row">{[5, 10, 80].map(size => <button key={size} aria-pressed={book.size === size} onClick={() => save({ ...live.current, size })}>{size === 80 ? '全部已勾選的字' : `${size} 個小練習`}</button>)}</div></fieldset><p>這輪會練 {Math.min(book.size, selectedCards.length)} 個，順序會打散。其他單字仍在這份範圍裡。</p><div className="practice-actions"><button className="practice-primary" disabled={!selectedCards.length} onClick={start}>開始這輪複習</button><button onClick={() => setStep('draft')}>回去修改範圍</button></div>
    </section>}
    <section className="practice-config exam-library"><h3>把這份範圍收好</h3><label htmlFor="exam-name">範圍名稱</label><input id="exam-name" maxLength={50} value={book.name} onChange={e => save({ ...live.current, name: e.target.value })} placeholder="例如：星期五小考" /><div className="practice-actions"><button onClick={storeList} disabled={!parsed.words.length || busy}>{book.selected ? '更新這份收藏' : '收藏這份範圍'}</button><button onClick={() => clearDraft(true)}>準備另一份範圍</button></div><details><summary>已收藏的範圍 · {book.lists.length} / 12</summary>{book.lists.length ? book.lists.map(item => <div className="exam-saved-row" key={item.id}><button onClick={() => loadList(item)}><b>{item.name}</b><small>{parseExamDraft(item.text).words.length} 個單字</small></button><button aria-label={`移除收藏 ${item.name}`} onClick={() => removeList(item)}>移除</button></div>) : <p>收藏後，下次不用再貼一次。</p>}</details></section>
    {undo && <div className="practice-undo" role="status"><span>{undo.type === 'list' ? `已移除收藏「${undo.item.name}」` : '剛才的範圍已清空'}</span><button onClick={restore}>還原</button></div>}{notice && <p className="practice-hint" role="status">{notice}</p>}<p className="practice-save-note">{saveError ? '這台裝置暫時無法保存，請先保留原本的單字清單。' : '範圍、字義與勾選進度只保存在這台裝置；開始練習後才累積學習獎勵。'}</p>
  </div>;
}
