import { useEffect, useRef, useState } from 'react';
import PracticeArt from '../components/PracticeArt.jsx';
import { deskRequest, readExplorer, wordIdentity } from '../data/learningDesk.js';
import { useWorkshopStorage } from './workshopStorage.js';

export default function WordExplorer({ lv, onBack, onOpenCard, onReviewCards, deps }) {
  const { Hdr, c, levels, searchCloudWords, searchAnyWords, mergeWordResults, speakWebSpeech, stopSpeech } = deps;
  const { book, live, save, saveError } = useWorkshopStorage(`eg_word_explorer_${lv}`, readExplorer({}), readExplorer);
  const [results, setResults] = useState([]), [loading, setLoading] = useState(false), [searched, setSearched] = useState(false);
  const [notice, setNotice] = useState(''), [sourceNote, setSourceNote] = useState(''), [page, setPage] = useState(0), [undo, setUndo] = useState(null);
  const request = useRef(null), debounce = useRef(null), detail = useRef(null), mounted = useRef(false), speech = useRef(0);
  const stop = () => { clearTimeout(debounce.current); request.current?.abort(); request.current = null; };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop(); speech.current++; stopSpeech(); }; }, [stopSpeech]);
  const run = async (query = live.current.query, scope = live.current.scope) => {
    stop(); setSourceNote(''); setPage(0);
    if (!query.trim()) { setResults([]); setLoading(false); setSearched(false); return; }
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setSearched(true); setResults([]);
    const pieces = []; let unavailable = 0;
    const load = async fn => {
      try {
        const words = await deskRequest(() => fn(lv, query, 22, scope), { signal: controller.signal, timeout: 6000 });
        if (request.current !== controller || !mounted.current) return;
        pieces.push(...(Array.isArray(words) ? words : [])); setResults(mergeWordResults(pieces, 22, lv));
      } catch (error) { if (error.name !== 'AbortError') unavailable++; }
    };
    await Promise.all([load(searchAnyWords), load(searchCloudWords)]);
    if (request.current !== controller || !mounted.current) return;
    request.current = null; setLoading(false);
    if (unavailable) setSourceNote('部分字庫暫時連不上，先看已找到的內容，也可以重新搜尋。');
  };
  useEffect(() => {
    if (book.tab === 'saved') return;
    debounce.current = setTimeout(() => run(book.query, book.scope), 260);
    return stop;
  }, [book.query, book.scope, book.tab]);
  const edit = query => { const unchanged = query === live.current.query && live.current.tab === 'search'; stop(); setLoading(false); setSearched(false); setResults([]); setPage(0); setSourceNote(''); save({ ...live.current, query, selected: null, tab: 'search' }); if (unchanged) run(query); };
  const select = word => { save({ ...live.current, selected: word, recent: [word.w, ...live.current.recent.filter(item => item !== word.w)].slice(0, 8) }); setNotice(''); };
  useEffect(() => { if (book.selected) { detail.current?.focus({ preventScroll: true }); detail.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' }); } }, [book.selected?.w, book.selected?.level]);
  const favorite = word => {
    const current = live.current, key = wordIdentity(word), exists = current.favorites.find(item => wordIdentity(item) === key);
    if (exists) { setUndo(exists); save({ ...current, favorites: current.favorites.filter(item => wordIdentity(item) !== key) }); setNotice(`已移出「${word.w}」，可以還原。`); }
    else if (current.favorites.length >= 50) setNotice('已收藏 50 個單字，先移出已經很熟的字，再放入新單字。');
    else { save({ ...current, favorites: [...current.favorites, word] }); setNotice(`已收藏「${word.w}」。`); }
  };
  const restore = () => {
    if (live.current.favorites.length >= 50) { setNotice('收藏已滿，這個單字仍顯示在還原提示裡。'); return; }
    if (!live.current.favorites.some(item => wordIdentity(item) === wordIdentity(undo))) save({ ...live.current, favorites: [...live.current.favorites, undo] });
    setUndo(null); setNotice('已放回收藏。');
  };
  const listen = text => {
    const token = ++speech.current; stopSpeech(); setNotice('');
    const result = speakWebSpeech(text, 'en-US', .8, { onerror: () => { if (mounted.current && token === speech.current) setNotice('目前無法朗讀，可以先看看文字，稍後再試。'); } });
    if (!result) setNotice('這個瀏覽器目前無法朗讀，仍可以閱讀和收藏。');
  };
  const leave = action => { stop(); speech.current++; stopSpeech(); action(); };
  const rows = book.tab === 'saved' ? book.favorites : results, pages = Math.max(1, Math.ceil(rows.length / 8)), currentPage = Math.min(page, pages - 1);
  const selected = book.selected;
  const examples = lv === 'elementary' ? ['apple', '媽媽', 'school', 'little', 'running'] : lv === 'junior' ? ['practice', '負責', 'experience', 'environment'] : ['sustainable', '機會', 'phenomenon', 'responsible'];
  const isSaved = word => book.favorites.some(item => wordIdentity(item) === wordIdentity(word));
  return <div className="practice-world word-explorer">
    <Hdr t="🔎 單字探索室" onBack={() => leave(onBack)} cl={c.cl} />
    <section className="practice-intro"><PracticeArt kind="explore" /><div><span className="practice-eyebrow">一個好奇，認識一個新朋友</span><h2>找到單字，也看懂怎麼用</h2><p>輸入英文或中文，先聽一聽、看例句，再收藏想練的字。</p></div></section>
    <div className="practice-choice-row desk-tabs" role="group" aria-label="單字探索分類">{[['search', '找單字'], ['saved', `我的收藏 · ${book.favorites.length}`]].map(([id, label]) => <button key={id} aria-pressed={book.tab === id} onClick={() => { stop(); setLoading(false); setPage(0); save({ ...live.current, tab: id, selected: null }); }}>{label}</button>)}</div>
    {book.tab === 'search' ? <section className="practice-config"><form onSubmit={event => { event.preventDefault(); run(); }}><label htmlFor="explorer-query">查詢英文或中文單字</label><div className="desk-search"><input id="explorer-query" maxLength={80} value={book.query} onChange={event => edit(event.target.value)} placeholder="例如 apple / 蘋果" /><button className="practice-primary" type="submit" disabled={!book.query.trim()}>搜尋</button></div></form><div className="practice-choice-row desk-scopes">{[['all', '全部年級'], ['current', levels[lv].l]].map(([id, label]) => <button key={id} aria-pressed={book.scope === id} onClick={() => { stop(); setResults([]); setSearched(false); save({ ...live.current, scope: id, selected: null }); }}>{label}</button>)}</div><p className="practice-save-note">可以查中文意思，也能試試 running、books 等變化形。</p><div className="desk-chips" aria-label="試試這些單字">{examples.map(word => <button key={word} onClick={() => edit(word)}>{word}</button>)}</div>{book.recent.length > 0 && <details className="desk-recent"><summary>最近看過</summary><div className="desk-chips">{book.recent.map(word => <button key={word} onClick={() => edit(word)}>{word}</button>)}</div><button onClick={() => save({ ...live.current, recent: [] })}>清除最近看過</button></details>}</section> : <section className="practice-resume"><div><h3>讓喜歡的字，再見一次面</h3><p>已收藏 {book.favorites.length} / 50 個。先選前 5 個有字義的字，慢慢練一輪。</p></div><button className="practice-primary" disabled={!book.favorites.some(word => word.m.trim())} onClick={() => leave(() => onReviewCards(book.favorites.filter(word => word.m.trim()).slice(0, 5)))}>用收藏練 5 張單字卡</button></section>}
    {selected && <section className={`practice-config explorer-detail ${book.large ? 'is-large' : ''}`} aria-label={`${selected.w} 的單字說明`}>
      <span className="practice-eyebrow">{levels[selected.level]?.l || c.l} · {selected.source || '收藏單字'}</span><h3 ref={detail} tabIndex={-1} lang="en">{selected.w}</h3>{selected.ph && <p>{selected.ph}</p>}<p className="explorer-meaning">{selected.p} {selected.m}</p>
      <div className="practice-actions"><button onClick={() => listen(selected.w)}>♫ 聽單字</button><button aria-pressed={book.large} onClick={() => save({ ...live.current, large: !live.current.large })}>大字閱讀</button><button onClick={() => favorite(selected)}>{isSaved(selected) ? '移出收藏' : '收藏這個字'}</button></div>
      {selected.ex ? <blockquote><h4>放進句子裡看看</h4><p lang="en">{selected.ex}</p>{selected.ez && <p>{selected.ez}</p>}<button onClick={() => listen(selected.ex)}>♫ 聽例句</button></blockquote> : <p>這個字還沒有附上例句，可以先記住字義。</p>}
      <div className="practice-actions"><button className="practice-primary" onClick={() => leave(() => onOpenCard(selected.w, selected.level || lv))}>到單字卡</button><button onClick={() => { const key = wordIdentity(selected); save({ ...live.current, selected: null }); document.getElementById(`explorer-${key}`)?.focus(); }}>收起說明</button></div>
    </section>}
    {loading && <p role="status" className="practice-hint">正在找單字…{results.length > 0 ? '已找到的內容可以先看。' : ''}<button onClick={() => { stop(); setLoading(false); setSourceNote('已停止查詢，輸入的文字還在。'); }}>停止查詢</button></p>}
    {sourceNote && <p role="status" className="practice-hint">{sourceNote}</p>}
    {rows.length > 0 && <><p>{book.tab === 'saved' ? '收藏' : '找到'} {rows.length} 個單字 · 第 {currentPage + 1} / {pages} 頁</p><div className="explorer-results">{rows.slice(currentPage * 8, currentPage * 8 + 8).map(word => <article key={wordIdentity(word)}><button id={`explorer-${wordIdentity(word)}`} className="explorer-open" aria-label={`看看 ${word.w} 的意思與例句`} aria-expanded={wordIdentity(selected) === wordIdentity(word)} onClick={() => select(word)}><span lang="en">{word.w}</span><span>{word.m}</span><small>{levels[word.level]?.l || c.l} · 看看例句 →</small></button><button className="explorer-star" aria-label={`${isSaved(word) ? '移出收藏' : '收藏'} ${word.w}`} aria-pressed={isSaved(word)} onClick={() => favorite(word)}>{isSaved(word) ? '★' : '☆'}</button></article>)}</div>{pages > 1 && <nav className="practice-actions desk-pagination" aria-label="單字結果換頁"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一頁</button><span>{currentPage + 1} / {pages}</span><button disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>下一頁</button></nav>}</>}
    {!loading && !rows.length && (book.tab === 'saved' || searched) && <section className="practice-config"><h3>{book.tab === 'saved' ? '先收藏一個好奇的字' : '還沒找到這個單字'}</h3><p>{book.tab === 'saved' ? '查到單字後，按星星就能收進這裡。' : '換個中文意思、縮短關鍵字，或用 run 查詢 running。'}</p><button onClick={() => edit(examples[0])}>試試 {examples[0]}</button></section>}
    {undo && <div className="practice-undo" role="status"><span>剛才移出的單字：{undo.w}</span><button onClick={restore}>還原收藏</button></div>}{notice && <p role="status" className="practice-hint">{notice}</p>}
    <p className="practice-save-note">{saveError ? '目前無法保存收藏，請先保留需要的單字。' : '搜尋與收藏保存在這台裝置，依目前學習年級分開收好。收藏不會增加學習獎勵。'}</p>
  </div>;
}
