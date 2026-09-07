import { novelBlockPairs } from '../data/novelAudio.js';
import { resolveReadingBlock } from './novelReading.js';

export default function NovelLibrary({novels,novel,index,onSelect,onBack,onOpen,completed,progress,quizAnswers,readingWords}) {
  const saved=progress?.[novel.id];
  const resumeIndex=novel.chapters.findIndex(chapter=>chapter.no===saved?.chapterNo);
  const resumeChapter=novel.chapters[resumeIndex];
  const resumeBlock=resolveReadingBlock(novel.id,saved);
  const nextIndex=Math.max(0,novel.chapters.findIndex(chapter=>!completed.includes(chapter.no)));
  const openIndex=resumeChapter?resumeIndex:nextIndex;
  const imageBase=novel.imageBase||'/images/novels/secret-forest';
  const excerpt=resumeChapter?novelBlockPairs(resumeChapter.en,resumeChapter.zh)[resumeBlock??0]?.en:null;
  return <div className="novel-library">
    <header className="novel-library-heading"><button className="novel-soft-button" onClick={onBack}>← 返回</button><div><span className="novel-eyebrow">STORY TIME</span><h1>我的故事書架</h1></div><span className="novel-library-label">讀一點，想像多一點。</span></header>
    {novels.length>1&&<nav className="novel-book-picker" aria-label="選一本故事書">{novels.map((book,i)=><button key={book.id} onClick={()=>onSelect(i)} aria-pressed={i===index}>{book.title}</button>)}</nav>}
    <section className="novel-library-feature" aria-label={novel.title}>
      <div className="novel-library-cover"><img src={`${imageBase}/cover.jpg`} alt={`${novel.title} cover`}/><span>一本書，一場小冒險</span></div>
      <div className="novel-library-intro"><div className="novel-book-meta"><span>{novel.level}</span><span>{novel.chapters.length} 章故事</span><span>英中對照・有聲閱讀</span></div><h2 lang="en">{novel.title}</h2><p className="novel-book-subtitle">{novel.zhTitle}</p><p className="novel-library-description">找個舒服的位置，和故事裡的朋友一起出發。可以自己讀，也可以聽著讀。</p>
        <div className="novel-library-progress"><span>已完成 {completed.length} / {novel.chapters.length} 章</span><div><i style={{width:`${completed.length/novel.chapters.length*100}%`}}/></div></div>
        <button className="novel-primary-button novel-start-reading" onClick={()=>onOpen(openIndex,resumeChapter?Number(saved.page)||0:0,resumeChapter?resumeBlock:null)}>{resumeChapter?'繼續閱讀':'開始閱讀'} <span aria-hidden="true">↗</span></button>
        {resumeChapter&&<div className="novel-resume-card"><span>接著第 {resumeChapter.no} 章讀</span><strong>{resumeChapter.zhTitle}</strong><p className="novel-resume-excerpt" lang="en">{excerpt}</p></div>}
      </div>
    </section>
    <div className="novel-library-section-heading"><div><span className="novel-eyebrow">YOUR NEXT ADVENTURE</span><h2>故事，一章一章展開</h2></div><p>每一章都可以直接打開</p></div>
    <div className="novel-chapter-grid">{novel.chapters.map((chapter,i)=>{
      const chapterProgress=saved?.chapterNo===chapter.no?saved:null;
      const isDone=completed.includes(chapter.no);
      const answered=(chapter.quiz||[]).filter((_,qi)=>quizAnswers[`${novel.id}:${chapter.no}`]?.[qi]!=null).length;
      return <button className="novel-chapter-card" key={chapter.no} data-testid={`novel-chapter-card-${chapter.no}`} aria-label={`閱讀第 ${chapter.no} 章 ${chapter.title}`} onClick={()=>onOpen(i,Number(chapterProgress?.page)||0,resolveReadingBlock(novel.id,chapterProgress))}>
        <div className="novel-chapter-image"><img src={`${imageBase}/chapter-${chapter.no}-thumb.jpg`} loading="lazy" alt=""/><span>{String(chapter.no).padStart(2,'0')}</span></div>
        <div className="novel-chapter-copy"><div className="novel-chapter-state">{isDone?'✓ 已完成':chapterProgress?'正在閱讀':'等待出發'}</div><h3 lang="en">{chapter.title}</h3><p>{chapter.zhTitle}</p><small>約 {Math.max(1,Math.ceil(readingWords(chapter.en).length/100))} 分鐘{answered?`・小測驗 ${answered}/${chapter.quiz.length}`:''}</small></div><span className="novel-chapter-arrow" aria-hidden="true">↗</span>
      </button>;
    })}</div>
  </div>;
}
