import { serviceErrorMessage } from '../lib/serviceErrors.js';
import { useEffect, useRef, useState } from 'react';
import PracticeArt from '../components/PracticeArt.jsx';
import { grammarBuildSentences, grammarMixedQuestions, grammarRecord, grammarStep } from '../data/learningWorkshops.js';
import { useWorkshopStorage } from './workshopStorage.js';
import { GrammarCloze, SentenceBuilder } from './grammarPieces.jsx';
import GrammarMixedReview from './GrammarMixedReview.jsx';

const STEPS = ['認識句型', '選選看', '組組看', '小挑戰'];
const MIXED_COUNT = 8;

export default function GrammarWorkshop({ lv, onBack, onXp, apiKey, onOpenSettings, deps }) {
  const { rules, grammarGuide, grammarDrills, generateGrammarAiExplanation, speak, stopSpeech, playSound, Hdr, c } = deps;
  const { book, live, save, saveError } = useWorkshopStorage(`eg_grammar_workshop_${lv}`);
  const [selected, setSelected] = useState(null), [step, setStep] = useState(0), [result, setResult] = useState(false);
  const [hint, setHint] = useState(false), [ai, setAi] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [mixed, setMixed] = useState(null), [buildIndex, setBuildIndex] = useState(0);
  const request = useRef(0), title = useRef(null);
  useEffect(() => () => { request.current++; stopSpeech(); }, [stopSpeech]);
  useEffect(() => { title.current?.focus({ preventScroll: true }); title.current?.closest('.practice-world')?.scrollIntoView?.({ block: 'start', behavior: 'instant' }); }, [selected, step, result, mixed]);
  const sentencesFor = rule => grammarBuildSentences(grammarGuide(rule).examples);
  const recordFor = (rule, source = book) => grammarRecord(source, rule, grammarDrills(rule), sentencesFor(rule));
  const stepFor = (rule, record) => grammarStep(record, grammarDrills(rule).length, sentencesFor(rule).length);
  const completed = rules.filter(rule => recordFor(rule).answer !== null).length;
  const open = index => {
    request.current++; stopSpeech(); setAi(null); setBusy(false); setError(''); setHint(false); setResult(false); setMixed(null); setSelected(index);
    const rule = rules[index], record = recordFor(rule, live.current), sentences = sentencesFor(rule);
    setStep(stepFor(rule, record));
    setBuildIndex(Math.max(0, sentences.findIndex(s => !record.built.includes(s.en))));
    save({ ...live.current, selected: rule.t });
  };
  const home = () => { request.current++; stopSpeech(); setSelected(null); setResult(false); setMixed(null); };
  const leave = () => { request.current++; stopSpeech(); onBack(); };
  const startMixed = () => {
    const studied = rules.flatMap((rule, i) => recordFor(rule, live.current).studied ? [i] : []);
    stopSpeech(); setSelected(null); setResult(false);
    const questions = grammarMixedQuestions(rules, grammarDrills, { count: MIXED_COUNT, lessons: studied.length >= 3 ? studied : null })
      .map(q => q.e ? q : { ...q, e: grammarGuide(rules[q.lesson]).mistake });
    setMixed(current => ({ round: (current?.round || 0) + 1, questions }));
  };
  const header = <Hdr t="🧩 句型積木學堂" onBack={selected === null && mixed === null ? leave : home} cl={c.cl} />;
  const note = <p className="practice-save-note" role={saveError ? 'status' : undefined}>{saveError ? '這台裝置暫時無法保存，可以繼續完成這次練習。' : '學到哪裡都會留在這台裝置，每課的獎勵只領一次。'}</p>;

  if (mixed) return <GrammarMixedReview key={mixed.round} questions={mixed.questions} header={header} onAgain={startMixed} onLesson={open} onHome={home} onXp={onXp} playSound={playSound} speak={speak} />;

  if (selected === null) {
    const resume = rules.findIndex(rule => rule.t === book.selected);
    const studied = rules.filter(rule => recordFor(rule).studied).length;
    return <div className="practice-world grammar-workshop">{header}<section className="practice-intro"><PracticeArt /><div><span className="practice-eyebrow">每天搭好一個小句子</span><h2 ref={title} tabIndex={-1}>句型，一步一步就會了</h2><p>先看例句，再選一選、排積木，最後試一個小挑戰。</p><b>已完成 {completed} / {rules.length} 課</b><progress className="practice-progress grammar-map-progress" aria-label="句型地圖進度" max={rules.length} value={completed} /></div></section>
      {resume >= 0 && <div className="practice-resume"><div><b>上次學到：{rules[resume].t}</b><p>從上次的步驟繼續，或選一個想學的主題。</p></div><button className="practice-primary" onClick={() => open(resume)}>繼續上次這一課 →</button></div>}
      <div className="grammar-mixed-entry"><div><span className="practice-eyebrow">綜合挑戰</span><b>把句型混在一起考考看</b><p>{studied >= 3 ? `從你學過的 ${studied} 課隨機出 ${MIXED_COUNT} 題，答對一題 +2 XP。` : `隨機出 ${MIXED_COUNT} 題，看看能不能分辨每個句型。學過 3 課後，就只考學過的。`}</p></div><button className="practice-primary" onClick={startMixed}>開始綜合挑戰 →</button></div>
      <div className="workshop-topic-grid">{rules.map((rule, i) => {
        const record = recordFor(rule), drills = grammarDrills(rule), sentences = sentencesFor(rule);
        const marks = [record.studied, Object.keys(record.drills).length === drills.length, record.built.length >= sentences.length, record.answer !== null];
        const count = marks.filter(Boolean).length, mastered = record.answer === rule.q.a;
        return <button key={rule.t} className={`workshop-topic${mastered ? ' is-mastered' : ''}`} onClick={() => open(i)}><span className="practice-eyebrow">第 {String(i + 1).padStart(2, '0')} 課{mastered && <span className="grammar-topic-badge" aria-hidden="true">✓</span>}</span><b>{rule.t}</b><span className="grammar-topic-steps" aria-hidden="true">{marks.map((on, k) => <i key={k} className={on ? 'is-on' : ''} />)}</span><span>{mastered ? '已完成，可以再複習' : record.answer !== null ? '做過挑戰，再練一次會更熟' : count ? `${count} / 4 步，慢慢前進` : '看例句 → 選選看 → 組組看 → 小挑戰'}</span></button>;
      })}</div>{note}</div>;
  }

  const rule = rules[selected], drills = grammarDrills(rule), guide = grammarGuide(rule), sentences = sentencesFor(rule), record = recordFor(rule);
  const maxStep = record.answer !== null ? 3 : stepFor(rule, record);
  const update = change => {
    const current = recordFor(rule, live.current), next = change(current);
    if (next !== current) save({ ...live.current, selected: rule.t, lessons: { ...live.current.lessons, [rule.t]: next } });
  };
  const choose = (index, choice) => {
    const current = recordFor(rule, live.current);
    if (index === 'quiz') {
      if (current.answer !== null) return;
      const correct = choice === rule.q.a, award = correct && !current.earned;
      update(r => ({ ...r, answer: choice, earned: r.earned || correct }));
      if (award) onXp?.(5); playSound(correct ? 'good' : 'flip');
    } else {
      if (current.drills[index] !== undefined) return;
      update(r => ({ ...r, drills: { ...r.drills, [index]: choice } })); playSound(choice === drills[index].a ? 'good' : 'flip');
    }
  };
  const built = sentence => update(r => r.built.includes(sentence.en) ? r : ({ ...r, built: [...r.built, sentence.en] }));
  const explain = async () => {
    if (!apiKey?.trim()) { setError('請大人先設定 AI，就能補充這一課的講解。'); onOpenSettings?.(); return; }
    const token = ++request.current; setBusy(true); setError('');
    try { const explanation = await generateGrammarAiExplanation(rule, lv, apiKey); if (token === request.current) setAi(explanation); }
    catch (error) { if (token === request.current) setError(serviceErrorMessage(error, '講解暫時沒有回來，先看這一課的例句也可以。')); }
    finally { if (token === request.current) setBusy(false); }
  };
  const go = next => { stopSpeech(); setStep(next); };
  const correct = record.answer === rule.q.a;
  const answerClass = (chosen, i, right) => chosen === undefined || chosen === null ? '' : i === right ? 'is-correct' : i === chosen ? 'is-retry' : '';
  if (result) return <div className="practice-world grammar-workshop">{header}<section className="practice-complete" aria-label="這一課的收穫"><PracticeArt complete /><span className="practice-eyebrow">又多認識一種說法</span><h2 ref={title} tabIndex={-1}>{rule.t}，練習完成！</h2><p>{guide.pattern}</p><div className="workshop-takeaway" lang="en">{rule.q.s.replace('___', rule.q.o[rule.q.a])}</div><p>{correct ? '小挑戰答對了，試著把這個句型用在生活裡。' : '先記住這個例句，再試一次也很好。'}</p><div className="practice-actions"><button onClick={() => speak(rule.q.s.replace('___', rule.q.o[rule.q.a]))}>♫ 聽完整句子</button>{!correct && <button className="practice-primary" onClick={() => { update(r => ({ ...r, answer: null })); setResult(false); setHint(true); }}>再試小挑戰</button>}{selected + 1 < rules.length && <button className="practice-primary" onClick={() => open(selected + 1)}>下一課 →</button>}<button onClick={home}>回到句型地圖</button><button onClick={leave}>回首頁休息</button></div></section>{note}</div>;
  const sentence = sentences[Math.min(buildIndex, sentences.length - 1)];
  const allBuilt = sentences.every(s => record.built.includes(s.en));
  return <div className="practice-world grammar-workshop">{header}<div className="workshop-stepper" role="group" aria-label="這一課的步驟">{STEPS.map((label, i) => (i !== 2 || sentences.length > 0) && <button key={label} aria-current={step === i ? 'step' : undefined} disabled={i > maxStep} onClick={() => go(i)}>{i + 1}　{label}</button>)}</div><section className="practice-question workshop-lesson"><span className="practice-eyebrow">第 {selected + 1} 課 · 一次只專心一小步</span><h2 ref={title} tabIndex={-1}>{rule.t}</h2>
    {step === 0 && <><p>{guide.zh}</p><div className="workshop-pattern">{guide.pattern}</div><div className="workshop-tips">{guide.tips.map((tip, i) => <span key={i}>{i + 1}. {tip}</span>)}</div><h3>例句庫</h3><div className="workshop-examples">{guide.examples.map((example, i) => <div key={i}><button onClick={() => speak(example.en)} aria-label={`朗讀例句 ${i + 1}`}><span lang="en">{example.en}</span><span aria-hidden="true">♫</span></button>{example.zh && <p>{example.zh}</p>}</div>)}</div><div className="practice-actions"><button className="practice-primary" onClick={() => { update(r => ({ ...r, studied: true })); go(drills.length ? 1 : sentences.length ? 2 : 3); }}>看懂了，練練看 →</button></div></>}
    {step === 1 && <><h3>加強練習</h3><p>先看主詞與時間。答錯可以看解析，再試一次。</p>{drills.map((q, i) => <div className="workshop-drill" key={i}><h4 lang="en"><GrammarCloze text={q.s} fill={record.drills[i] !== undefined ? q.o[q.a] : ''} /></h4><div className="practice-answer-options">{q.o.map((option, oi) => <button key={oi} data-testid={`grammar-drill-${i}-option-${oi}`} disabled={record.drills[i] !== undefined} className={answerClass(record.drills[i], oi, q.a)} onClick={() => choose(i, oi)}>{option}</button>)}</div>{record.drills[i] !== undefined && <div className={`practice-feedback ${record.drills[i] === q.a ? 'is-correct' : ''}`} role="status"><b>{record.drills[i] === q.a ? '選對了！' : '一起看看線索'}</b><p>{q.e}</p>{record.drills[i] !== q.a && <button onClick={() => update(r => { const answers = { ...r.drills }; delete answers[i]; return { ...r, drills: answers }; })}>再試這一題</button>}</div>}</div>)}<button className="practice-primary" disabled={Object.keys(record.drills).length < drills.length} onClick={() => go(sentences.length ? 2 : 3)}>{sentences.length ? '下一步：組組看 →' : '準備好了，試試小挑戰 →'}</button></>}
    {step === 2 && sentence && <><h3>排排積木，組出句子</h3><p>照著中文意思，把英文積木排成正確的順序。</p><SentenceBuilder key={sentence.en} sentence={sentence} done={record.built.includes(sentence.en)} label={`第 ${Math.min(buildIndex, sentences.length - 1) + 1} / ${sentences.length} 句`} onDone={() => built(sentence)} speak={speak} playSound={playSound} />
      <div className="practice-actions">{buildIndex + 1 < sentences.length && <button className={record.built.includes(sentence.en) ? 'practice-primary' : ''} disabled={!record.built.includes(sentence.en)} onClick={() => { stopSpeech(); setBuildIndex(buildIndex + 1); }}>下一句 →</button>}{buildIndex > 0 && <button onClick={() => { stopSpeech(); setBuildIndex(buildIndex - 1); }}>← 上一句</button>}{(buildIndex + 1 >= sentences.length || allBuilt) && <button className="practice-primary" disabled={!allBuilt} onClick={() => go(3)}>準備好了，試試小挑戰 →</button>}</div></>}
    {step === 3 && <><p>把剛才學到的句型，放進這個句子。</p><div className="workshop-pattern" lang="en"><GrammarCloze text={rule.q.s} fill={record.answer !== null ? rule.q.o[rule.q.a] : ''} /></div><button aria-expanded={hint} onClick={() => setHint(!hint)}>看看判斷線索</button>{hint && <aside className="practice-hint">{guide.tips.join(' → ')}<p>{guide.pattern}</p></aside>}<div className="practice-answer-options">{rule.q.o.map((option, i) => <button data-testid={`grammar-quiz-option-${i}`} key={i} disabled={record.answer !== null} className={answerClass(record.answer, i, rule.q.a)} onClick={() => choose('quiz', i)}>{option}</button>)}</div>{record.answer !== null && <div className={`practice-feedback ${correct ? 'is-correct' : ''}`} role="status"><h3>{correct ? '答對了！' : '差一點，一起再看看'}</h3><p>{guide.mistake}</p><p lang="en">{rule.q.s.replace('___', rule.q.o[rule.q.a])}</p><div className="practice-actions">{!correct && <button onClick={() => { update(r => ({ ...r, answer: null })); setHint(true); }}>再試一次</button>}<button className="practice-primary" onClick={() => { stopSpeech(); setResult(true); }}>看看這一課的收穫 →</button></div></div>}</>}
    <details className="workshop-extra"><summary>需要多一點說明？</summary><p>{guide.mistake}</p><button onClick={explain} disabled={busy}>{busy ? '正在整理講解…' : 'AI 講解'}</button>{error && <div role="status"><p>{error}</p><button onClick={()=>onOpenSettings?.()}>API Key 設定</button></div>}{ai && <div className="practice-hint"><p>{ai.simple}</p>{ai.examples?.map((example, i) => <p key={i}><span lang="en">{example.en}</span><br />{example.zh}</p>)}{ai.practice && <div><b>AI 小練習</b><p>{ai.practice.prompt}</p><details><summary>想好了，看看答案</summary><p>{ai.practice.answer} · {ai.practice.explanation}</p></details></div>}</div>}</details></section>{note}</div>;
}
