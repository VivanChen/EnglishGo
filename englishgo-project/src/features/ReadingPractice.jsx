import { useEffect, useMemo, useRef, useState } from 'react';

// Ignore saved answers when the source text or questions have changed.
function readRecord(notebook, article) {
  const signature = JSON.stringify([article.tx, article.qs]);
  const saved = notebook?.articles?.[article.t];
  if (saved?.signature !== signature) return { signature, answers: {}, earned: {} };
  const answers = {}, earned = {};
  article.qs.forEach((question, index) => {
    const answer = saved.answers?.[index];
    if (Number.isInteger(answer) && answer >= 0 && answer < question.o.length) answers[index] = answer;
    if (saved.earned?.[index] === true) earned[index] = true;
  });
  return { signature, answers, earned };
}

export default function ReadingPractice({ lv, onBack, onXp, deps }) {
  const { articles, translations, useLS, splitReadingSentences, readingKeywords, readingWords, readingEvidence, speak, speakStory, preloadTts, playSound, Hdr, c } = deps;
  const [notebook, setNotebook] = useLS(`reading_${lv}`, { selected: articles[0].t, articles: {} });
  const [largeText, setLargeText] = useLS('readingLargeText', false);
  const notebookRef = useRef(notebook);
  const articleHandle = useRef(null), articleHeading = useRef(null), questionRefs = useRef([]);
  const [focus, setFocus] = useState(-1), [playing, setPlaying] = useState(false), [showZh, setShowZh] = useState(false);
  const ai = Math.max(0, articles.findIndex(article => article.t === notebook?.selected));
  const article = articles[ai], zh = translations[article.t] || {};
  const record = readRecord(notebook, article), answers = record.answers;
  const sentences = useMemo(() => splitReadingSentences(article.tx), [article, splitReadingSentences]);
  const keywords = useMemo(() => readingKeywords(article, lv), [article, lv, readingKeywords]);
  const score = article.qs.filter((q, index) => answers[index] === q.a).length;
  const answered = Object.keys(answers).length, done = answered === article.qs.length;
  const doneCount = articles.filter(item => Object.keys(readRecord(notebook, item).answers).length === item.qs.length).length;

  const save = next => { notebookRef.current = next; setNotebook(next); };
  const saveRecord = next => save({ ...notebookRef.current, selected: article.t, articles: { ...notebookRef.current?.articles, [article.t]: next } });
  const stop = () => { articleHandle.current?.cancel(); articleHandle.current = null; setPlaying(false); setFocus(-1); };
  const play = () => {
    stop(); setPlaying(true);
    articleHandle.current = speakStory(sentences, {
      rate: 0.86, onSentence: setFocus,
      onFinish: () => { articleHandle.current = null; setPlaying(false); setFocus(-1); },
      oncancel: () => { articleHandle.current = null; setPlaying(false); setFocus(-1); },
    });
  };
  useEffect(() => {
    preloadTts([article.tx, ...sentences, ...article.qs.map(q => q.q), ...article.qs.map(q => q.o[q.a])], { limit: 8, concurrency: 2 });
    return () => { articleHandle.current?.cancel(); articleHandle.current = null; };
  }, [article, sentences, preloadTts]);
  useEffect(() => { if (done) setShowZh(true); }, [done, article]);

  const chooseArticle = index => {
    stop(); setShowZh(false);
    save({ ...notebookRef.current, selected: articles[index].t });
    articleHeading.current?.focus({ preventScroll: true });
    articleHeading.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  };
  const pick = (qi, oi) => {
    const current = readRecord(notebookRef.current, article);
    if (current.answers[qi] !== undefined) return;
    const correct = oi === article.qs[qi].a;
    const award = correct && !current.earned[qi];
    saveRecord({ ...current, answers: { ...current.answers, [qi]: oi }, earned: { ...current.earned, ...(correct ? { [qi]: true } : {}) } });
    playSound(correct ? 'good' : 'flip');
    if (award) onXp?.(5);
  };
  const retry = qi => {
    const current = readRecord(notebookRef.current, article), nextAnswers = { ...current.answers };
    delete nextAnswers[qi];
    saveRecord({ ...current, answers: nextAnswers });
    questionRefs.current[qi]?.focus({ preventScroll: true });
  };
  const resetArticle = () => {
    stop(); saveRecord({ ...readRecord(notebookRef.current, article), answers: {} });
    questionRefs.current[0]?.focus({ preventScroll: true });
    questionRefs.current[0]?.scrollIntoView({ behavior: 'instant', block: 'start' });
  };

  return <div className={`eg-reading ${largeText ? 'is-large-text' : ''}`}>
    <Hdr t="📖 閱讀理解" onBack={onBack} cl={c.cl}/>
    <div className="eg-reading-progress">
      <progress aria-label="短文完成進度" max={articles.length} value={doneCount}/>
      <span>完成 {doneCount}/{articles.length}</span>
    </div>
    <label className="eg-reading-picker"><span>今天想讀哪一篇？</span><select aria-label="選擇短文" value={ai} onChange={event => chooseArticle(Number(event.target.value))}>{articles.map((item, index) => <option key={item.t} value={index}>{index + 1}. {item.t}{Object.keys(readRecord(notebook, item).answers).length === item.qs.length ? ' ✓' : ''}</option>)}</select></label>
    <p className="eg-reading-save-note">🌱 作答進度會留在這個瀏覽器，下次可以接著讀。</p>

    <section className="eg-reading-story" aria-labelledby="eg-reading-title">
      <div className="eg-reading-story-heading"><div><h3 id="eg-reading-title" ref={articleHeading} tabIndex={-1}>{article.t}</h3><span>{readingWords(article.tx).length} words · 約 {Math.max(1, Math.ceil(readingWords(article.tx).length / 120))} 分鐘</span></div><span className="eg-reading-count">已練習 {answered}/{article.qs.length} 題</span></div>
      <div className="eg-reading-tools" role="group" aria-label="閱讀小幫手">
        <button type="button" onClick={playing ? stop : play}>{playing ? '⏹ 停止朗讀' : '🔊 朗讀全文'}</button>
        <button type="button" aria-pressed={largeText} onClick={() => setLargeText(!largeText)}>大字閱讀</button>
        {zh.tx && <button type="button" aria-expanded={showZh} aria-controls="eg-reading-translation" onClick={() => setShowZh(!showZh)}>{showZh ? '收起中文提示' : '看中文提示'}</button>}
      </div>
      <p className="eg-reading-hint">點一句就能聽，也可以看中文提示。準備好了，再往下找線索。</p>
      <div className="eg-reading-sentences">{sentences.map((sentence, index) => <button type="button" key={index} className={focus === index ? 'is-current' : ''} onClick={() => { stop(); setFocus(index); speak(sentence, 'en-US', 0.85); }}><span className="eg-reading-sentence-number" aria-hidden="true">{index + 1}</span><span lang="en">{sentence}</span><span className="eg-reading-listen" aria-hidden="true">♪</span></button>)}</div>
      {showZh && zh.tx && <div id="eg-reading-translation" className="eg-reading-translation"><div><b>中文提示</b><button type="button" onClick={() => { stop(); speak(zh.tx, 'zh-TW', 1); }}>🔊 聽中文</button></div><p>{zh.tx}</p></div>}
      {keywords.length > 0 && <details className="eg-reading-keywords"><summary>認識這篇的單字 · {keywords.length} 個</summary><div>{keywords.map(keyword => <button type="button" key={keyword.word} onClick={() => { stop(); speak(keyword.word); }}><b lang="en">{keyword.word}</b>{keyword.info?.m ? ` · ${keyword.info.m}` : ''}</button>)}</div></details>}
    </section>

    <div className="eg-reading-question-intro"><h3>找找故事裡的線索</h3><p>不確定時，回去讀一讀就好。</p></div>
    {article.qs.map((question, qi) => {
      const selected = answers[qi], hasAnswer = selected !== undefined, correct = selected === question.a;
      return <section key={`${article.t}-${qi}`} className={`eg-reading-question ${hasAnswer ? correct ? 'is-correct' : 'needs-practice' : ''}`} aria-labelledby={`eg-reading-q-${qi}`}>
        <h4 id={`eg-reading-q-${qi}`} ref={element => { questionRefs.current[qi] = element; }} tabIndex={-1}><span>{qi + 1}</span><span lang="en">{question.q}</span></h4>
        {showZh && zh.qs?.[qi] && <p className="eg-reading-question-zh">{zh.qs[qi]}</p>}
        <div className="eg-reading-options">{question.o.map((option, oi) => <button type="button" key={oi} disabled={hasAnswer} className={hasAnswer && oi === question.a ? 'is-answer' : selected === oi ? 'is-picked' : ''} onClick={() => pick(qi, oi)}><span lang="en">{option}</span>{hasAnswer && oi === question.a && <span aria-label="正確答案">✓</span>}{selected === oi && oi !== question.a && <span aria-label="你的選擇">↻</span>}</button>)}</div>
        {hasAnswer && <div className="eg-reading-feedback"><div role="status"><b>{correct ? '找到線索了！' : '再找找線索，你可以再試一次。'}</b><p>答案是：<span lang="en">{question.o[question.a]}</span></p></div><blockquote lang="en">{readingEvidence(article.tx, question)}</blockquote>{!correct && <button type="button" onClick={() => retry(qi)}>再試一次</button>}</div>}
      </section>;
    })}
    {done && <section className="eg-reading-complete" aria-label="短文練習完成"><span aria-hidden="true">🌱</span><h3>本篇完成</h3><p>每一題都練習過了！{score === article.qs.length ? '你找到了所有線索。' : '還不熟的地方，可以慢慢再看一次。'}</p><div><button type="button" onClick={resetArticle}>重做本篇</button><button type="button" className="eg-primary" onClick={() => chooseArticle((ai + 1) % articles.length)}>{ai + 1 === articles.length ? '回第一篇' : '下一篇'}</button><button type="button" onClick={onBack}>休息一下，回首頁</button></div></section>}
  </div>;
}
