import { useEffect, useRef, useState } from 'react';
import ListeningRadio from '../components/ListeningRadio.jsx';
import { createListeningPuzzle, matchesListeningPiece } from '../data/listeningPuzzle.js';

export default function ListeningPuzzle({ sentence, playing, playbackError, onPlay, onStop, onExit }) {
  const [puzzle, setPuzzle] = useState(() => createListeningPuzzle(sentence));
  const [picked, setPicked] = useState([]), [feedback, setFeedback] = useState(null);
  const [hinted, setHinted] = useState(false);
  const heading = useRef(null), tileButtons = useRef(new Map()), playButton = useRef(null);
  const done = picked.length === puzzle.pieces.length;
  const nextPiece = puzzle.pieces[picked.length];
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.closest('.listening-puzzle')?.scrollIntoView?.({ block: 'start', behavior: 'instant' }); }, []);
  useEffect(() => {
    if (done) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.closest('.listening-puzzle')?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    }
  }, [done]);

  const choose = tile => {
    if (done || picked.includes(tile.id)) return;
    onStop();
    if (!matchesListeningPiece(nextPiece, tile.text)) {
      setFeedback({ wrong: tile.id, message: '這一格再聽聽看，可以重聽或用小提示。' });
      return;
    }
    const nextPicked = [...picked, tile.id];
    setPicked(nextPicked); setHinted(false);
    setFeedback({ message: nextPicked.length === puzzle.pieces.length ? '拼好了！再聽一次，也試著說說看。' : `接對了！繼續找第 ${nextPicked.length + 1} 格。` });
    // The selected button becomes disabled; keep keyboard focus in the bank.
    const available = puzzle.tiles.find(candidate => !nextPicked.includes(candidate.id));
    if (available) tileButtons.current.get(available.id)?.focus({ preventScroll: true });
  };
  const hint = () => {
    setHinted(true); setFeedback({ message: `下一格是「${nextPiece}」，可以在下面找找看。` });
    onPlay(nextPiece, .65, '拼句小提示');
  };
  const restart = () => {
    onStop(); setPuzzle(createListeningPuzzle(sentence)); setPicked([]); setFeedback(null); setHinted(false);
    playButton.current?.focus({ preventScroll: true });
  };

  return <section className="listening-puzzle" aria-label="聽音拼句">
    <div className="listening-puzzle-heading"><span>聽一聽 · 點一點</span><button type="button" onClick={onExit}>回到跟讀</button></div>
    <h3 ref={heading} tabIndex={-1}>{done ? '你把聲音接成一句話了！' : '聽音拼句'}</h3>
    <p>{done ? '拼句練好了，接著用自己的聲音說一次。' : `先聽例句，再依序點選${puzzle.unit}。點錯可以再試，不計時。`}</p>
    <ListeningRadio state={playing ? playing.started ? 'playing' : 'loading' : done ? 'complete' : 'idle'} />
    <div className="practice-actions listening-puzzle-audio">
      <button ref={playButton} type="button" className="practice-primary" onClick={() => playing ? onStop() : onPlay(sentence, .85, '拼句整句示範')}>{playing ? '■ 停止播放' : '▶ 聽完整例句'}</button>
      <button type="button" onClick={() => onPlay(sentence, .65, '拼句慢速示範')}>慢速重聽</button>
    </div>
    <p className="listening-puzzle-audio-status" aria-live="polite">{playing ? `${playing.started ? '正在播放' : '準備播放'} · ${playing.label}` : '可以重聽，也可以放慢聲音。'}</p>
    {playbackError && <p role="alert">聲音暫時無法播放，可以重試，或用小提示接句子。</p>}
    <div className="listening-puzzle-progress"><span>已接好 {picked.length} / {puzzle.pieces.length} 格</span><progress max={puzzle.pieces.length} value={picked.length} aria-label="拼句進度" /></div>
    {done ? <p className="listening-puzzle-sentence" lang="en">{sentence}</p> : <>
      <ol className="listening-puzzle-slots" aria-label="已接好的句子">{puzzle.pieces.map((piece, index) => <li key={index} className={index < picked.length ? 'is-filled' : ''} aria-current={index === picked.length ? 'step' : undefined}>
        {index < picked.length ? <span lang="en">{piece}</span> : <span aria-label={`第 ${index + 1} 格${index === picked.length ? '，接下來填這格' : ''}`}>{index === picked.length ? '？' : index + 1}</span>}
      </li>)}</ol>
      <div className="listening-puzzle-bank" role="group" aria-label={`可選的${puzzle.unit}`}>{puzzle.tiles.map(tile => <button key={tile.id} ref={element => { if (element) tileButtons.current.set(tile.id, element); else tileButtons.current.delete(tile.id); }} type="button" lang="en" disabled={picked.includes(tile.id)}
        className={feedback?.wrong === tile.id ? 'is-retry' : hinted && matchesListeningPiece(nextPiece, tile.text) ? 'is-hint' : ''} onClick={() => choose(tile)}>{tile.text}</button>)}</div>
    </>}
    <p className="listening-puzzle-feedback" role="status">{feedback?.message || '準備好了，從第 1 格開始。'}</p>
    <div className="practice-actions listening-puzzle-tools">
      {done ? <button type="button" className="practice-primary" onClick={onExit}>接著跟讀這一句 →</button> : <button type="button" onClick={hint}>給我下一格提示 ♫</button>}
      <button type="button" disabled={!picked.length && !feedback} onClick={restart}>{done ? '再拼一次' : '重新拼句'}</button>
    </div>
  </section>;
}
