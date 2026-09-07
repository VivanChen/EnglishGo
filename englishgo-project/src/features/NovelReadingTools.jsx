export function NovelJourney({ novel, chapterNo, completed, progress, bookmarks, onJump, onRemove }) {
  return <div className="novel-journey">
    <p className="novel-tool-hint">回到喜歡的地方，或打開下一章。閱讀位置和書籤會保存在這個瀏覽器。</p>
    <h3>我的書籤 <span>{bookmarks.length}</span></h3>
    {bookmarks.length ? <ul className="novel-bookmarks">{bookmarks.map(mark => <li key={`${mark.chapterNo}:${mark.blockIndex}`}>
      <button className="novel-bookmark-jump" onClick={() => onJump(mark.chapterIndex, mark.blockIndex)} aria-label={`前往書籤 第 ${mark.chapterNo} 章第 ${mark.blockIndex + 1} 段`}>
        <small>第 {mark.chapterNo} 章 · 段落 {mark.blockIndex + 1}</small>
        <span lang="en">{mark.block.en}</span>
        <small>{mark.chapter.zhTitle}</small>
      </button>
      <button className="novel-bookmark-remove" onClick={() => onRemove(mark)} aria-label={`移除書籤 第 ${mark.chapterNo} 章第 ${mark.blockIndex + 1} 段`}>移除</button>
    </li>)}</ul> : <div className="novel-bookmark-empty"><span aria-hidden="true">♧</span><strong>把喜歡的段落留下來</strong><p>點段落旁的「⋯」留下書籤，下次就能從這裡回去重讀。</p></div>}
    <h3>故事目錄 <span>{completed.length} / {novel.chapters.length} 完成</span></h3>
    <nav aria-label="故事章節"><ol className="novel-contents">{novel.chapters.map((chapter, index) => {
      const saved = progress?.chapterNo === chapter.no ? progress : null;
      return <li key={chapter.no}><button onClick={() => onJump(index, saved?.blockIndex ?? 0)} aria-current={chapter.no === chapterNo ? 'location' : undefined}>
        <b>{String(chapter.no).padStart(2, '0')}</b><span><strong>{chapter.zhTitle}</strong><small lang="en">{chapter.title}</small><small>{chapter.no === chapterNo ? '正在閱讀' : completed.includes(chapter.no) ? '已完成 ✓' : saved ? `接著段落 ${saved.blockIndex + 1} 讀` : '打開這一章'}</small></span>
      </button></li>;
    })}</ol></nav>
  </div>;
}

export function NovelPreferences({ prefs, onChange }) {
  const size=Math.max(14,Math.min(22,Number(prefs.fontSize)||18));
  const spacious=Number(prefs.lineHeight)>=1.9;
  return <div className="novel-preferences">
    <p className="novel-tool-hint">選你讀起來舒服的樣子，下次會自動記住。</p>
    <fieldset><legend>文字大小</legend><div className="novel-font-controls"><button aria-label="A-" onClick={()=>onChange({fontSize:Math.max(14,size-2)})} disabled={size<=14}>A−</button><output>{size} px</output><button aria-label="A+" onClick={()=>onChange({fontSize:Math.min(22,size+2)})} disabled={size>=22}>A＋</button></div></fieldset>
    <fieldset><legend>行與行的距離</legend><div className="novel-choice-row"><button aria-label="一般行距" aria-pressed={!spacious} onClick={()=>onChange({lineHeight:1.66})}>剛剛好</button><button aria-label="寬行距" aria-pressed={spacious} onClick={()=>onChange({lineHeight:1.95})}>寬鬆一點</button></div></fieldset>
    <fieldset><legend>書頁顏色</legend><div className="novel-choice-row">{[['paper', '暖白', '◯'], ['leaf', '柔綠', '♧'], ['night', '夜讀', '☾']].map(([value, label, icon]) => <button key={value} onClick={() => onChange({ tone: value })} aria-pressed={(prefs.tone || 'paper') === value}><span aria-hidden="true">{icon}</span>{label}</button>)}</div></fieldset>
    <fieldset><legend>英文字體</legend><div className="novel-choice-row">{[['book', '故事書字體'], ['clear', '清楚字體']].map(([value, label]) => <button key={value} onClick={() => onChange({ fontFamily: value })} aria-pressed={(prefs.fontFamily || 'book') === value}>{label}</button>)}</div></fieldset>
    <fieldset><legend>中文怎麼看</legend><div className="novel-choice-row"><button onClick={() => onChange({ showZh: true })} aria-pressed={prefs.showZh !== false}>英中一起看</button><button onClick={() => onChange({ showZh: false })} aria-pressed={prefs.showZh === false}>先讀英文</button></div><p className="novel-tool-hint">先讀英文時，也能只打開某一段的中文。</p></fieldset>
    <div className="novel-font-preview" lang="en" style={{ fontFamily: prefs.fontFamily === 'clear' ? 'Arial, sans-serif' : 'Georgia, serif' }}>A little story.<br/>A big adventure.</div>
  </div>;
}
