import { useEffect, useRef, useState } from 'react';
import PracticeArt from '../components/PracticeArt.jsx';
import { GrammarCloze } from './grammarPieces.jsx';

// A short mixed round across lessons. The lesson name stays hidden until the answer,
// because spotting which rule applies is the skill being practised.
export default function GrammarMixedReview({ questions, header, onAgain, onLesson, onHome, onXp, playSound, speak }) {
  const [index, setIndex] = useState(0), [answers, setAnswers] = useState([]), [done, setDone] = useState(false);
  const title = useRef(null), feedback = useRef(null);
  const question = questions[index], chosen = answers[index], answered = chosen !== undefined;
  useEffect(() => { title.current?.focus({ preventScroll: true }); title.current?.closest('.practice-world')?.scrollIntoView?.({ block: 'start', behavior: 'instant' }); }, [index, done]);
  useEffect(() => { if (answered) feedback.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, [answered]);
  const given = useRef([]);
  const choose = option => {
    if (done || given.current[index] !== undefined) return;
    const correct = option === question.a;
    given.current = [...given.current]; given.current[index] = option;
    setAnswers(given.current);
    playSound?.(correct ? 'good' : 'flip');
    if (correct) onXp?.(2);
  };
  const next = () => { if (!answered) return; if (index + 1 < questions.length) setIndex(index + 1); else { setDone(true); playSound?.('done'); } };
  const keys = useRef(null);
  keys.current = event => {
    if (done || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (!answered && /^[1-4]$/.test(event.key) && question.o[Number(event.key) - 1] !== undefined) { event.preventDefault(); choose(Number(event.key) - 1); }
    else if (answered && event.key === 'Enter' && !event.repeat && !event.target?.closest?.('button:not(:disabled), a')) { event.preventDefault(); next(); }
  };
  useEffect(() => { const onKey = event => keys.current?.(event); window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);

  const score = answers.filter((a, i) => a === questions[i].a).length;
  if (done) {
    const missed = [...new Map(questions.flatMap((q, i) => answers[i] === q.a ? [] : [[q.lesson, q]])).values()];
    return <div className="practice-world grammar-workshop">{header}<section className="practice-complete" aria-label="綜合挑戰成果"><PracticeArt complete /><span className="practice-eyebrow">句型混在一起也認得出來</span><h2 ref={title} tabIndex={-1}>綜合挑戰完成！</h2><div className="practice-metrics"><div><b>{questions.length}</b><span>挑戰題數</span></div><div><b>{score}</b><span>答對</span></div><div><b>{score * 2}</b><span>獲得 XP</span></div></div>
      <p>{score === questions.length ? '全部答對，每個句型都分得清清楚楚！' : '答錯的句型，回到那一課再看一次例句就會更熟。'}</p>
      {missed.length > 0 && <div className="grammar-mixed-missed"><h3>可以再複習的句型</h3>{missed.map(q => <button key={q.lesson} onClick={() => onLesson(q.lesson)}><span>第 {String(q.lesson + 1).padStart(2, '0')} 課</span><b>{q.topic}</b><span aria-hidden="true">→</span></button>)}</div>}
      <div className="practice-actions"><button className="practice-primary" onClick={onAgain}>再來一輪</button><button onClick={onHome}>回到句型地圖</button></div></section></div>;
  }
  const correct = chosen === question.a, filled = question.s.replace('___', question.o[question.a]);
  return <div className="practice-world grammar-workshop">{header}
    <div className="practice-toolbar"><span>綜合挑戰 · {index + 1} / {questions.length}</span><span className="grammar-mixed-score">答對 {score}</span></div>
    <progress className="practice-progress" aria-label="綜合挑戰進度" max={questions.length} value={index + Number(answered)} />
    <section className="practice-question workshop-lesson grammar-mixed" aria-label="目前題目"><span className="practice-eyebrow">想一想：這句用的是哪個句型？</span>
      <h2 ref={title} tabIndex={-1} lang="en" className="grammar-mixed-sentence"><GrammarCloze text={question.s} fill={answered ? question.o[question.a] : ''} /></h2>
      <div className="practice-answer-options">{question.o.map((option, i) => <button key={i} data-testid={`grammar-mixed-option-${i}`} disabled={answered} className={answered ? i === question.a ? 'is-correct' : i === chosen ? 'is-retry' : '' : ''} onClick={() => choose(i)}><span aria-hidden="true">{i + 1}</span><b lang="en">{option}</b></button>)}</div>
      <p className="practice-keys" aria-hidden="true">鍵盤：按 1–4 選答案，Enter 下一題</p>
      {answered && <div ref={feedback} className={`practice-feedback ${correct ? 'is-correct' : ''}`} role="status"><h3>{correct ? '答對了！' : '差一點，一起看看'}</h3><p className="grammar-mixed-topic">這題考的是：<b>{question.topic}</b></p>{question.e && <p>{question.e}</p>}<p lang="en">{filled} <button className="grammar-inline-listen" aria-label="朗讀這個句子" onClick={() => speak?.(filled)}>♫</button></p>
        <div className="practice-actions"><button className="practice-primary" onClick={next}>{index + 1 < questions.length ? '下一題 →' : '看看成果 →'}</button>{!correct && <button onClick={() => onLesson(question.lesson)}>回到這一課</button>}</div></div>}
    </section></div>;
}
