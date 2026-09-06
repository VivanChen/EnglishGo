import { useEffect, useMemo, useRef, useState } from 'react';
import PracticeArt from '../components/PracticeArt.jsx';
import { mergeReviewInfo, removeReviewWords, restoreReviewWords, wordKey } from '../data/practiceJourney.js';

export default function ReviewGarden({ lv, onBack, weakWords, allWeakWords = weakWords, setWeakWords, onCards, onSearch, deps }) {
  const { words, loadExtraWords, fetchWeakWords, speak, stopSpeech, Hdr, c, levelName } = deps;
  const [extras, setExtras] = useState([]), [query, setQuery] = useState('');
  const [round, setRound] = useState(null), live = useRef(null), [flipped, setFlipped] = useState(false), flipRef = useRef(false);
  const [undo, setUndo] = useState(null), [confirmClear, setConfirmClear] = useState(false), [audioError, setAudioError] = useState(false);
  const title = useRef(null), alive = useRef(true), speechToken = useRef(0);
  const key = weakWords.map(w => wordKey(w.w)).sort().join('|');
  useEffect(() => {
    let active = true;
    Promise.resolve(loadExtraWords()).then(data => { if (active && data?.[lv]?.length) setExtras(old => [...old, ...data[lv]]); }).catch(() => {});
    Promise.resolve(fetchWeakWords(lv, weakWords.map(w => w.w))).then(data => { if (active && data?.length) setExtras(old => [...old, ...data]); }).catch(() => {});
    return () => { active = false; };
  }, [lv, key, loadExtraWords, fetchWeakWords]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; speechToken.current++; stopSpeech(); }; }, [stopSpeech]);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    title.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }, [round?.index]);
  const rows = useMemo(() => mergeReviewInfo(weakWords, words, extras), [weakWords, words, extras]);
  const filtered = rows.filter(w => `${w.w} ${w.m || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const saveRound = next => { live.current = next; setRound(next); };
  const flip = value => { flipRef.current = value; setFlipped(value); };
  const stop = () => { speechToken.current++; stopSpeech(); };
  const listen = text => {
    stop(); setAudioError(false); const token = ++speechToken.current;
    const speech = speak(text, 'en-US', .8, { onerror: () => { if (alive.current && token === speechToken.current) setAudioError(true); } });
    if (!speech) setAudioError(true);
  };
  const remove = items => {
    const removed = allWeakWords.filter(w => (!w.level || w.level === lv) && items.some(item => wordKey(w.w) === wordKey(item.w)));
    setWeakWords(current => removeReviewWords(current, items, lv)); setUndo(removed); setConfirmClear(false);
  };
  const begin = () => {
    // Freeze this small queue: removing a remembered word must not skip the next one.
    const deck = filtered.slice(0, 5);
    if (deck.length) { stop(); flip(false); saveRound({ deck, index: 0, remembered: [] }); }
  };
  const decide = remembered => {
    const current = live.current;
    if (!current || current.index !== round.index || current.index >= current.deck.length || (remembered && !flipRef.current)) return;
    const item = current.deck[current.index];
    stop(); flip(false);
    saveRound({ ...current, index: current.index + 1, remembered: remembered ? [...current.remembered, item.w] : current.remembered });
    if (remembered) remove([item]);
  };
  const leave = () => { stop(); onBack(); };
  const returnToList = () => { stop(); saveRound(null); flip(false); };
  const undoBanner = undo?.length ? <div className="practice-undo" role="status"><span>已移出 {undo.length} 個單字，可以隨時加回。</span><button onClick={() => { setWeakWords(current => restoreReviewWords(current, undo)); if (live.current) saveRound({ ...live.current, remembered: live.current.remembered.filter(w => !undo.some(item => wordKey(item.w) === wordKey(w))) }); setUndo(null); }}>復原剛才的移除</button></div> : null;
  const header = <Hdr t="🌱 再練一次" onBack={round ? returnToList : leave} cl={c.cl} />;
  const audioNote = audioError ? <p role="status">目前無法播放，先看字義也可以繼續練習。</p> : null;
  if (round && round.index >= round.deck.length) return <div className="practice-world">{header}{undoBanner}<section className="practice-complete" aria-label="複習完成"><PracticeArt kind="review" complete /><h2 ref={title} tabIndex={-1}>又和這些單字更熟悉了！</h2><p>看過 {round.deck.length} 個單字，{round.remembered.length} 個已移出複習清單。</p><p>還沒記住的會留下來，下次慢慢練就好。</p><div className="practice-actions"><button className="practice-primary" onClick={returnToList}>回到複習清單</button><button onClick={leave}>回首頁休息</button></div></section></div>;
  if (round) {
    const original = round.deck[round.index], item = mergeReviewInfo([original], words, extras)[0];
    return <div className="practice-world">{header}{undoBanner}<div className="practice-toolbar"><span>陪單字長大 · {round.index + 1} / {round.deck.length}</span><button onClick={returnToList}>回複習清單</button></div><progress className="practice-progress" aria-label="複習進度" max={round.deck.length} value={round.index} /><section className="practice-question practice-review-card"><span className="practice-eyebrow">先想想它的意思，再翻開看看</span><h2 ref={title} tabIndex={-1} className="practice-word" lang="en">{item.w}</h2>{item.ph && <p>{item.ph}</p>}<button aria-label={`朗讀 ${item.w}`} onClick={() => listen(item.w)}>♫ 聽單字</button><button className="practice-flip" aria-expanded={flipped} onClick={() => flip(!flipped)}>{flipped ? '收起字義，再想一次' : '翻開看看意思'}</button>{flipped && <div className="practice-review-meaning">{item.m ? <><h3>{item.m}</h3>{item.p && <p>{item.p}</p>}{item.ex && <blockquote><p lang="en">{item.ex}</p>{item.ez && <p>{item.ez}</p>}<button aria-label={`朗讀例句 ${item.w}`} onClick={() => listen(item.ex)}>♫ 聽例句</button></blockquote>}</> : <><p>這個單字暫時沒有可用的字義，先留在清單，稍後再查。</p><button onClick={() => { stop(); onSearch(); }}>到單字搜尋 →</button></>}</div>}<div className="practice-actions"><button className="practice-primary" disabled={!flipped || !item.m} onClick={() => decide(true)}>記住了，移出清單</button><button onClick={() => decide(false)}>還想再練，留著</button></div>{!flipped && <p className="practice-save-note">先翻開核對意思，再決定有沒有記住。</p>}{audioNote}</section></div>;
  }
  return <div className="practice-world">{header}{undoBanner}<section className="practice-intro"><PracticeArt kind="review" /><div><span className="practice-eyebrow">每個單字都有自己的步調</span><h2 ref={title} tabIndex={-1}>{rows.length ? '陪還不熟的單字長大' : `太棒了！${levelName}沒有錯題`}</h2><p>{rows.length ? `${levelName} · 共 ${rows.length} 個正在練習的單字` : '不用急著挑戰，想學的時候再出發。'}</p>{rows.length > 0 ? <button className="practice-primary" onClick={begin} disabled={!filtered.length}>先複習 {Math.min(5, filtered.length)} 個 →</button> : <button className="practice-primary" onClick={leave}>回首頁看看</button>}</div></section>
    {rows.length > 0 && <><div className="practice-review-tools"><label htmlFor="practice-review-search">找一個想練的單字</label><input id="practice-review-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="輸入英文或中文意思" /><span role="status">找到 {filtered.length} 個</span>{filtered.some(w => w.m) && <button onClick={() => { stop(); onCards(filtered.filter(w => w.m).slice(0, 5)); }}>用單字卡練習 →</button>}</div><div className="practice-review-list">{filtered.map(item => <div key={wordKey(item.w)}><span className="practice-leaf" aria-hidden="true">♧</span><div><b lang="en">{item.w}</b><p>{item.m || '字義暫時無法取得，稍後再查也可以。'}</p></div><button aria-label={`朗讀 ${item.w}`} onClick={() => listen(item.w)}>♫</button><button aria-label={`複習 ${item.w}`} onClick={() => { flip(false); saveRound({ deck: [item], index: 0, remembered: [] }); }}>看看 →</button></div>)}{!filtered.length && <p>沒有找到這個單字，換個詞或清空搜尋再看看。</p>}</div><details className="practice-manage"><summary>管理這個年級的複習清單</summary><p>清空只會移除目前年級的複習單字。</p>{confirmClear ? <div className="practice-actions"><button onClick={() => remove(rows)}>確定清空這個年級的清單</button><button onClick={() => setConfirmClear(false)}>保留清單</button></div> : <button onClick={() => setConfirmClear(true)}>🗑️ 清空</button>}</details></>}{audioNote}</div>;
}
