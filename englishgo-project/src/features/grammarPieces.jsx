import { useMemo, useRef, useState } from 'react';
import { grammarBuildCheck, grammarTiles } from '../data/learningWorkshops.js';

// Renders "___" as a visible blank, filled in once the answer is known.
export function GrammarCloze({ text, fill = '' }) {
  const parts = String(text || '').split('___');
  return parts.map((part, i) => <span key={i}>{part}{i < parts.length - 1 && <span className={`practice-blank${fill ? ' is-filled' : ''}`}>{fill || <span className="practice-sr-only">空格</span>}</span>}</span>);
}

// One sentence of blocks. Parent re-mounts it per sentence (key), so local state never leaks between sentences.
export function SentenceBuilder({ sentence, done, label, onDone, speak, playSound }) {
  const tiles = useMemo(() => grammarTiles(sentence.en), [sentence.en]);
  const ordered = () => [...tiles].sort((a, b) => a.id - b.id).map(t => t.id);
  const [picked, setPicked] = useState(() => done ? ordered() : []);
  const [tries, setTries] = useState(0), [revealed, setRevealed] = useState(false);
  // Taps can land before React re-renders, so every handler builds on the live list.
  const live = useRef(picked);
  const text = id => tiles.find(t => t.id === id).text;
  const isSolved = list => list.length === tiles.length && grammarBuildCheck(sentence.en, list.map(text)).correct;
  const check = grammarBuildCheck(sentence.en, picked.map(text));
  const complete = picked.length === tiles.length, solved = done || (complete && check.correct);
  const place = change => {
    if (done || isSolved(live.current)) return;
    const next = change(live.current);
    if (next === live.current) return;
    live.current = next; setPicked(next);
    if (next.length !== tiles.length) return;
    if (isSolved(next)) { playSound?.('good'); onDone(); }
    else { setTries(n => n + 1); playSound?.('flip'); }
  };
  const reveal = () => { setRevealed(true); live.current = ordered(); setPicked(live.current); onDone(); };
  return <div className="grammar-builder" data-state={solved ? 'solved' : complete ? 'retry' : 'building'}>
    <div className="grammar-builder-head"><span className="practice-eyebrow">{label}</span><p>把積木排成這句英文：<b>{sentence.zh}</b></p></div>
    <div className="practice-sentence" aria-label="你排好的句子" lang="en">{picked.length ? picked.map((id, i) => <button key={id} disabled={solved} className={complete && !solved && !check.slots[i] ? 'is-off' : ''} aria-label={solved ? text(id) : `放回 ${text(id)}`} onClick={() => place(list => list.filter(x => x !== id))}>{text(id)}</button>) : <span>點下面的積木，一塊一塊排上來…</span>}</div>
    {!solved && !complete && <div className="practice-tile-bank" lang="en">{tiles.map(tile => <button key={tile.id} disabled={picked.includes(tile.id)} onClick={() => place(list => list.includes(tile.id) ? list : [...list, tile.id])}>{tile.text}</button>)}</div>}
    {complete && !solved && <div className="practice-feedback" role="status"><b>順序還差一點</b><p>虛線框的積木位置不對，點它放回去再排排看。先找主詞，再找動詞。</p><div className="practice-actions"><button onClick={() => { live.current = []; setPicked([]); }}>全部重排</button>{tries >= 2 && <button onClick={reveal}>看看正確順序</button>}</div></div>}
    {solved && <div className="practice-feedback is-correct" role="status"><b>{revealed ? '先記住這個順序，下次一定行！' : '組好了！句子很通順'}</b><p lang="en">{sentence.en}</p><button onClick={() => speak?.(sentence.en)}>♫ 聽一次</button></div>}
  </div>;
}
