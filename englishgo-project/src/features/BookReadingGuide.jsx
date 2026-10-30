import { useRef, useState } from 'react';

function readGuide(storageKey, signature, questions) {
 const empty={signature,answers:{},completed:false};
 if(!storageKey)return empty;
 try{
  const stored=JSON.parse(localStorage.getItem(storageKey));
  if(stored?.signature!==signature)return empty;
  const answers={};
  questions.forEach((question,index)=>{const choice=stored.answers?.[index];if(Number.isInteger(choice)&&choice>=0&&choice<question.options.length)answers[index]=choice;});
  return {signature,answers,completed:stored.completed===true};
 }catch{return empty;}
}

export default function BookReadingGuide({ questions, patterns=[], storageKey, onComplete }) {
 const signature=JSON.stringify(questions);
 const [record,setRecord]=useState(()=>readGuide(storageKey,signature,questions));
 const live=useRef(record),answers=record.answers;
 const choose=(index,choice)=>{
  const previous=live.current,nextAnswers={...previous.answers,[index]:choice};
  const justCompleted=!previous.completed&&questions.length>0&&questions.every((question,i)=>nextAnswers[i]===question.answer);
  const next={signature,answers:nextAnswers,completed:previous.completed||justCompleted};
  // Keep the receipt with the answers before the parent records the learning event.
  live.current=next;
  if(storageKey){try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{/* The stable parent event ID still prevents duplicate rewards. */}}
  setRecord(next);
  if(justCompleted)onComplete?.({questionCount:questions.length,correctCount:questions.length});
 };
 return <details className="book-reading-guide"><summary>讀後探索 · {questions.length} 題推理練習{patterns.length>0?`與 ${patterns.length} 個句型`:''}</summary>
  <p>先讀故事，再用線索說明你的選擇。可以重試，也可以回到書裡找證據。</p>
  {questions.map((item,i)=><fieldset key={item.q}>
   <legend><span lang="en">{i+1}. {item.q}</span><small>{item.zh}</small></legend>
   <div className="book-answer-options">{item.options.map((option,j)=><button key={option} lang="en" aria-pressed={answers[i]===j} onClick={()=>choose(i,j)}>{option}</button>)}</div>
   {answers[i]!==undefined && <p role="status" className="book-answer-feedback">{answers[i]===item.answer?'答對了。':'再看看故事中的線索。'} {item.explanation}</p>}
  </fieldset>)}
  {record.completed&&<p className="book-guide-complete">這份讀後探索已完成，重看或重試不會重複領取學習獎勵。</p>}
  {patterns.length>0&&<h2>把觀察說成完整的句子</h2>}
  {patterns.map(([en,zh])=><blockquote key={en}><p lang="en">{en}</p><p>{zh}</p></blockquote>)}
 </details>;
}
