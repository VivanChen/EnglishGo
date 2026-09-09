import { useState } from 'react';

export default function BookReadingGuide({ questions, patterns }) {
 const [answers,setAnswers]=useState({});
 return <details className="book-reading-guide"><summary>讀後探索 · 4 題推理練習與 3 個句型</summary>
  <p>先讀故事，再用線索說明你的選擇。可以重試，也可以回到書裡找證據。</p>
  {questions.map((item,i)=><fieldset key={item.q}>
   <legend><span lang="en">{i+1}. {item.q}</span><small>{item.zh}</small></legend>
   <div className="book-answer-options">{item.options.map((option,j)=><button key={option} lang="en" aria-pressed={answers[i]===j} onClick={()=>setAnswers(old=>({...old,[i]:j}))}>{option}</button>)}</div>
   {answers[i]!==undefined && <p role="status" className="book-answer-feedback">{answers[i]===item.answer?'答對了。':'再看看故事中的線索。'} {item.explanation}</p>}
  </fieldset>)}
  <h2>把觀察說成完整的句子</h2>
  {patterns.map(([en,zh])=><blockquote key={en}><p lang="en">{en}</p><p>{zh}</p></blockquote>)}
 </details>;
}
