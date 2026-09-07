import { useEffect, useRef, useState } from 'react';
import PracticeArt from '../components/PracticeArt.jsx';
import { DESK_LIMITS, deskId, deskRequest, newTutorSession, readTutorBook, tutorContents, tutorError } from '../data/learningDesk.js';
import { useWorkshopStorage } from './workshopStorage.js';
import { requestTutor } from './tutorService.js';

function TutorText({ text, onSpeak }) {
  return <div className="tutor-answer-text">{text.split('\n').map((line, i) => <p key={i}>{line.split(/(\*\*.+?\*\*)/g).map((part, j) => part.startsWith('**') && part.endsWith('**') ? /^[A-Za-z]/.test(part.slice(2)) ? <button key={j} className="tutor-inline-word" aria-label={`朗讀 ${part.slice(2, -2)}`} onClick={() => onSpeak(part.slice(2, -2))}>{part.slice(2, -2)}</button> : <strong key={j}>{part.slice(2, -2)}</strong> : part)}</p>)}</div>;
}

export default function TutorStudio({ lv, onBack, apiKey, onOpenSettings, onOpenPractice, deps }) {
  const { Hdr, c, speakMx, stopSpeech, ask = requestTutor } = deps;
  const { book, live, save, saveError } = useWorkshopStorage(`eg_tutor_studio_${lv}`, readTutorBook({ sessions: [] }), readTutorBook);
  const current = book.sessions.find(session => session.id === book.activeId);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [speaking, setSpeaking] = useState(null);
  const [undo, setUndo] = useState(null), [undoDraft, setUndoDraft] = useState(null), [showEarlier, setShowEarlier] = useState(false);
  const job = useRef(null), audio = useRef(0), mounted = useRef(false), composer = useRef(null), latest = useRef(null);
  const updateSession = (id, change) => save({ ...live.current, sessions: live.current.sessions.map(session => session.id === id ? change(session) : session) });
  const silence = () => { audio.current++; stopSpeech(); setSpeaking(null); };
  const cancel = () => {
    const pending = job.current; job.current = null;
    if (pending) { pending.controller.abort(); updateSession(pending.sessionId, session => ({ ...session, turns: session.turns.map(turn => turn.id === pending.turnId ? { ...turn, status: 'stopped', error: '' } : turn) })); }
    setBusy(false);
  };
  useEffect(() => {
    mounted.current = true;
    const hide = () => { if (document.hidden) { audio.current++; stopSpeech(); setSpeaking(null); } };
    document.addEventListener('visibilitychange', hide);
    return () => { mounted.current = false; job.current?.controller.abort(); job.current = null; audio.current++; stopSpeech(); document.removeEventListener('visibilitychange', hide); };
  }, [stopSpeech]);
  const starters = [
    { id: 'sentence', title: '短句上手', icon: '01', desc: '看一句英文，試著換一個字', prompt: `請用${c.l}程度帶我練一句今天能用的英文。請先給一句英文和中文，再讓我替換一個單字。` },
    { id: 'talk', title: '生活對話', icon: '02', desc: '在校園、餐廳，一次練一句', prompt: '請陪我做一段英文情境對話。先給我 3 個情境選項，等我選好後，每次只問一句並幫我修正。' },
    { id: 'correct', title: '精準批改', icon: '03', desc: '看看怎麼改，再自己試一次', prompt: '我會貼一個英文句子。請用「原句、修正版、原因、再練一句」幫我批改，說明要簡短。' },
  ];
  const promptGroups = [
    ['學習', [
      ['新單字', `請依照${c.l}程度，教我今天可以用的英文單字。一次一個，包含中文意思、自然例句、中文翻譯和一題小練習。`],
      ['文法', `請用${c.l}學生聽得懂的方式，教我一個常用英文文法。請給句型、例句、常見錯誤和一題練習。`],
      ['每日一句', `請給我一句適合${c.l}學生的每日英文句子，包含中文意思、發音提醒、替換練習。`],
      ['小測驗', `請出${c.l}程度的英文小測驗，每次一題，等我回答後再批改。`],
    ]],
    ['情境', [
      ['自我介紹', '請陪我練習英文自我介紹，可以使用虛構名字。先給範例，再一次問一個問題，最後整理成一段英文。'],
      ['餐廳點餐', '請陪我練習在餐廳用英文點餐。你扮演店員，我扮演客人，每次只問一句，在我回答後給修正。'],
      ['問路', '請陪我練習英文問路。用簡單對話，一次一句，回答後幫我修正。'],
      ['學校生活', '請陪我練習學校生活英文對話，例如借鉛筆、問功課、和同學打招呼，一次只練一句。'],
    ]],
    ['批改', [
      ['批改句子', '我會輸入英文句子，請用原句、修正版、為什麼、再練一句的格式幫我批改。'],
      ['中翻英', '請出一句中文讓我翻成英文。等我回答後，請幫我批改並給更自然的說法。'],
      ['造句', '請給我一個英文單字讓我造句，等我回答後再幫我批改。'],
      ['日記', '請教我寫一篇 4 句英文小日記。先給架構，再讓我自己試寫，最後幫我修正。'],
    ]],
  ];
  const fill = (text, mode = current.mode) => {
    if (current.draft.trim() && current.draft !== text) setUndoDraft({ sessionId: current.id, text: current.draft });
    updateSession(current.id, session => ({ ...session, draft: text, mode }));
    composer.current?.focus(); composer.current?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
  };
  const send = async (retry = false) => {
    if (job.current) return;
    const session = live.current.sessions.find(item => item.id === live.current.activeId), last = session.turns.at(-1);
    const question = (retry ? last?.question : session.draft)?.trim();
    if (!question || (retry && last?.status === 'done')) return;
    if (!apiKey?.trim()) { setNotice('請大人先設定 AI，你寫的問題已保留。'); return; }
    if (!retry && session.turns.length >= DESK_LIMITS.turns) { setNotice('這本已經寫了 20 個問題，開一本新練習簿再繼續吧。'); return; }
    const turn = retry ? { ...last, status: 'pending', error: '' } : { id: deskId(), question, answer: '', status: 'pending', error: '' };
    const controller = new AbortController(), pending = { controller, sessionId: session.id, turnId: turn.id };
    job.current = pending; silence(); setBusy(true); setNotice(''); setUndoDraft(null);
    updateSession(session.id, item => ({ ...item, draft: retry ? item.draft : '', title: item.turns.length ? item.title : question.slice(0, 22), turns: retry ? [...item.turns.slice(0, -1), turn] : [...item.turns, turn] }));
    try {
      const answer = await deskRequest(() => ask({ level: c, apiKey, contents: tutorContents(retry ? session.turns.slice(0, -1) : session.turns, question), signal: controller.signal }), { signal: controller.signal, timeout: 45000 });
      if (!mounted.current || job.current !== pending) return;
      if (typeof answer !== 'string' || !answer.trim()) throw new Error('Empty answer');
      updateSession(session.id, item => ({ ...item, turns: item.turns.map(row => row.id === turn.id ? { ...row, answer: answer.slice(0, 10000), status: 'done' } : row) }));
      setNotice('回答準備好了，可以慢慢看，也可以請 AI 說簡單一點。');
    } catch (error) {
      if (!mounted.current || job.current !== pending) return;
      updateSession(session.id, item => ({ ...item, turns: item.turns.map(row => row.id === turn.id ? { ...row, status: error.name === 'AbortError' ? 'stopped' : 'failed', error: tutorError(error) } : row) }));
    } finally {
      controller.abort();
      if (mounted.current && job.current === pending) { job.current = null; setBusy(false); }
    }
  };
  const listen = (text, id) => {
    if (speaking === id && id) { silence(); return; }
    silence(); const token = ++audio.current; setSpeaking(id || 'word');
    const handle = speakMx(text, live.current.rate, {
      onend: () => { if (mounted.current && audio.current === token) setSpeaking(null); },
      onerror: () => { if (mounted.current && audio.current === token) { setSpeaking(null); setNotice('朗讀暫時無法播放，可以先看看文字。'); } },
    });
    if (!handle) { setSpeaking(null); setNotice('這個瀏覽器目前無法朗讀，可以先看看文字。'); }
  };
  const copy = async text => {
    try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(text); if (mounted.current) setNotice('已複製這段回答。'); }
    catch { if (mounted.current) setNotice('目前無法自動複製，可以直接選取回答中的文字。'); }
  };
  const collect = turn => {
    const key = `${current.id}:${turn.id}`;
    if (live.current.saved.some(item => item.id === key)) { setNotice('這段回答已經收好了。'); return; }
    if (live.current.saved.length >= DESK_LIMITS.saved) { setNotice('已收藏 24 段，先移除不需要的回答，再收藏新的內容。'); return; }
    save({ ...live.current, saved: [{ id: key, text: turn.answer, question: turn.question }, ...live.current.saved] }); setNotice('已收進「我的重點收藏」。');
  };
  const newSession = () => {
    if (live.current.sessions.length >= DESK_LIMITS.sessions) { setNotice('已有 8 本練習簿，先在「我的練習簿」移除不需要的一本。'); return; }
    cancel(); silence(); const session = newTutorSession(); save({ ...live.current, activeId: session.id, sessions: [session, ...live.current.sessions] }); setShowEarlier(false); setUndoDraft(null); setNotice('新的練習簿準備好了，原本的對話已收好。');
  };
  const switchSession = id => { cancel(); silence(); save({ ...live.current, activeId: id }); setShowEarlier(false); setUndoDraft(null); setNotice('已打開這本練習簿。'); };
  const removeSession = session => {
    cancel(); silence(); const snapshot = live.current.sessions.find(item => item.id === session.id);
    setUndo({ type: 'session', item: snapshot });
    const sessions = live.current.sessions.filter(item => item.id !== session.id);
    if (!sessions.length) sessions.push(newTutorSession());
    save({ ...live.current, sessions, activeId: live.current.activeId === session.id ? sessions[0].id : live.current.activeId }); setUndoDraft(null);
  };
  const restore = () => {
    const key = undo.type === 'session' ? 'sessions' : 'saved', cap = undo.type === 'session' ? DESK_LIMITS.sessions : DESK_LIMITS.saved;
    if (live.current[key].length >= cap) { setNotice('目前沒有空位，剛才移除的內容仍保留在還原提示裡。'); return; }
    save({ ...live.current, [key]: [undo.item, ...live.current[key].filter(item => item.id !== undo.item.id)] }); setUndo(null); setNotice('已還原。');
  };
  const turns = showEarlier ? current.turns : current.turns.slice(-4), full = current.turns.length >= DESK_LIMITS.turns;
  return <div className="practice-world tutor-studio">
    <Hdr t="AI 英語家教" cl={c.cl} onBack={() => { cancel(); silence(); onBack(); }} />
    <section className="practice-intro"><PracticeArt kind="tutor" /><div><span className="practice-eyebrow">一個問題，一次小練習</span><h2>家教練習室</h2><p>先選模式，再用聊天微調。</p><p>可朗讀、可複製，也能把有幫助的回答收好。</p><span className="desk-status">{c.l} · {apiKey?.trim() ? 'AI 設定已填入' : '請大人協助設定 AI'}</span></div></section>
    {!apiKey?.trim() && <section className="practice-resume"><div><h3>先把問題寫下來也可以</h3><p>AI 需要大人協助設定，問題會留在這本練習簿。</p></div><div className="practice-actions"><button onClick={onOpenSettings}>請大人設定 AI</button><button onClick={() => { cancel(); silence(); onOpenPractice?.(); }}>先練現有句型</button></div></section>}
    <section className="practice-config tutor-workbook"><div className="desk-section-title"><div><span className="practice-eyebrow">目前的練習簿</span><h3>{current.title}</h3><p>{current.turns.length} / 20 個問題 · 自動保存在這台裝置</p></div><button onClick={newSession}>開一本新練習簿</button></div>
      <details open={current.turns.length === 0 ? true : undefined} className="tutor-starters" data-testid="ai-tutor-starters"><summary>選一個小練習</summary><p>先放入問題框，準備好再送出。</p><div className="tutor-starter-grid">{starters.map(starter => <button key={starter.id} disabled={busy || full} onClick={() => fill(starter.prompt, starter.id)}><span>{starter.icon}</span><strong>{starter.title}</strong><small>{starter.desc}</small></button>)}</div></details>
      <details className="tutor-more-prompts"><summary>更多練習主題</summary>{promptGroups.map(([name, prompts]) => <fieldset key={name}><legend>{name}</legend><div className="desk-chips">{prompts.map(([label, prompt]) => <button key={label} disabled={busy || full} onClick={() => fill(prompt)}>{label}</button>)}</div></fieldset>)}</details>
      {current.turns.length > 4 && <button className="tutor-earlier" onClick={() => setShowEarlier(!showEarlier)}>{showEarlier ? '只看最近 4 個問題' : `看看更早的 ${current.turns.length - 4} 個問題`}</button>}
      <div className="tutor-transcript" aria-label="這本練習簿的對話">{turns.map((turn, index) => <article key={turn.id} className="tutor-turn"><div className="tutor-question"><span>我想問</span><p>{turn.question}</p></div><div className="tutor-response" ref={index === turns.length - 1 ? latest : undefined} tabIndex={-1}>
        {turn.status === 'done' ? <><span className="practice-eyebrow">AI 的回答</span><TutorText text={turn.answer} onSpeak={text => listen(text)} /><div className="practice-actions"><button onClick={() => listen(turn.answer, turn.id)}>{speaking === turn.id ? '停止朗讀' : '朗讀回答'}</button><button onClick={() => copy(turn.answer)}>複製回答</button><button disabled={book.saved.some(item => item.id === `${current.id}:${turn.id}`)} onClick={() => collect(turn)}>{book.saved.some(item => item.id === `${current.id}:${turn.id}`) ? '已收藏這段' : '收藏這段回答'}</button></div></> : turn.status === 'pending' ? <div role="status"><span className="tutor-thinking">正在整理這個問題…</span><button onClick={cancel}>停止回答</button></div> : <div><p role="status">{turn.status === 'stopped' ? '這次回答已停止，問題還在。' : turn.error || '暫時沒有回答，問題已保留。'}</p>{turn.id === current.turns.at(-1)?.id && <div className="practice-actions"><button disabled={busy} onClick={() => send(true)}>重試這個問題</button><button disabled={busy} onClick={() => fill(turn.question)}>放回問題框修改</button></div>}</div>}
      </div></article>)}</div>
      {current.turns.at(-1)?.status === 'done' && <div className="tutor-followups"><p>下一步想怎麼練？</p><div className="practice-actions">{['請說簡單一點', '給我一個提示', '讓我再試一題'].map(text => <button key={text} disabled={busy || full} onClick={() => fill(text)}>{text}</button>)}<button onClick={() => { latest.current?.focus({ preventScroll: true }); latest.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' }); }}>看最新回答 ↑</button></div></div>}
      <form className="tutor-composer" onSubmit={event => { event.preventDefault(); send(); }}><label htmlFor="tutor-question">想問什麼，或想試著回答什麼？</label><textarea id="tutor-question" ref={composer} value={current.draft} maxLength={DESK_LIMITS.question} onChange={event => updateSession(current.id, session => ({ ...session, draft: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing && !event.isComposing) { event.preventDefault(); send(); } }} placeholder="例如：這句英文可以怎麼說？" rows={4} /><div className="desk-compose-meta"><span>{current.draft.length} / {DESK_LIMITS.question} 字 · Enter 換行</span><button className="practice-primary" type="submit" disabled={busy || full || !current.draft.trim()}>送出問題 →</button></div>{full && <p>這本練習簿寫滿了，開一本新的繼續。原本的回答仍會保留。</p>}</form>
      {undoDraft?.sessionId === current.id && <div className="practice-undo"><span>剛才輸入的問題還在</span><button onClick={() => { updateSession(current.id, session => ({ ...session, draft: undoDraft.text })); setUndoDraft(null); }}>復原剛才輸入</button></div>}
      <label className="tutor-rate">朗讀速度<select value={book.rate} onChange={event => { silence(); save({ ...live.current, rate: Number(event.target.value) }); }}><option value={.6}>慢慢聽</option><option value={.85}>一般速度</option><option value={1.15}>快一點</option></select></label><div className="practice-actions">{speaking && <button onClick={silence}>停止所有朗讀</button>}<button onClick={() => { cancel(); silence(); onOpenSettings?.(); }}>請大人檢查 AI 設定</button></div>
    </section>
    <div className="desk-library-grid"><details className="practice-config tutor-library"><summary>我的練習簿 · {book.sessions.length} / 8</summary><p>每本對話分開保存，換練習簿時會停止正在產生的回答。</p>{book.sessions.map(session => <div className="desk-saved-row" key={session.id}><button aria-current={current.id === session.id ? 'true' : undefined} onClick={() => switchSession(session.id)}><b>{session.title}</b><small>{session.turns.length} 個問題{session.id === current.id ? ' · 目前這本' : ''}</small></button><button aria-label={`移除練習簿 ${session.title}`} onClick={() => removeSession(session)}>移除</button></div>)}</details>
    <details className="practice-config tutor-collection"><summary>我的重點收藏 · {book.saved.length} / 24</summary>{book.saved.length ? book.saved.map(item => <details className="tutor-saved-answer" key={item.id}><summary>{item.question?.slice(0, 60) || '收藏的回答'}</summary><TutorText text={item.text} onSpeak={text => listen(text)} /><div className="practice-actions"><button onClick={() => copy(item.text)}>複製收藏</button><button onClick={() => { setUndo({ type: 'answer', item }); save({ ...live.current, saved: live.current.saved.filter(saved => saved.id !== item.id) }); }}>移除這段收藏</button></div></details>) : <p>看到有幫助的說明，按「收藏這段回答」就能放進來。</p>}</details></div>
    {undo && <div className="practice-undo" role="status"><span>已移除{undo.type === 'session' ? `練習簿「${undo.item.title}」` : '一段收藏'}</span><button onClick={restore}>還原剛才移除</button></div>}{notice && <p role="status" className="practice-hint">{notice}</p>}
    <p className="practice-save-note">{saveError ? '這台裝置暫時無法保存，重要內容可以先複製下來。' : '對話、草稿與收藏只存在這台裝置，依年級分開保存；送出問題時才交給 AI 回答。'}</p><p className="practice-save-note">AI 陪你練習，重要用法可以和老師一起確認。聊天和收藏不會增加學習獎勵。</p>
  </div>;
}
