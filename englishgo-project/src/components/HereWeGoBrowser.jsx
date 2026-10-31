import { useMemo, useState } from 'react';
import { HERE_WE_GO_DECKS, HERE_WE_GO_FILTERS, getHereWeGoCards, hereWeGoSelectionId } from '../data/hanlinHereWeGoWords.js';

const PAGE_SIZE = 12;
export default function HereWeGoBrowser({ onStart }) {
  const [book, setBook] = useState(HERE_WE_GO_DECKS[0].id);
  const [filter, setFilter] = useState('words');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const id = hereWeGoSelectionId(book, filter, query);
  const cards = useMemo(() => getHereWeGoCards(id), [id]);
  const pages = Math.ceil(cards.length / PAGE_SIZE);
  const change = setter => event => { setter(event.target.value); setPage(0); };
  return <details className="hwg-browser">
    <summary>依範圍挑字練習／預覽單字</summary>
    <p>選擇冊次與字詞類型，也可以搜尋英文或中文。開始練習會使用目前篩選結果。</p>
    <div className="hwg-browser-controls">
      <label>冊次<select value={book} onChange={change(setBook)} aria-label="Here We Go 冊次">{HERE_WE_GO_DECKS.map(deck => <option key={deck.id} value={deck.id}>{deck.label}</option>)}</select></label>
      <label>練習範圍<select value={filter} onChange={change(setFilter)} aria-label="Here We Go 練習範圍">{HERE_WE_GO_FILTERS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label className="hwg-browser-search">搜尋<input type="search" value={query} maxLength={80} onChange={change(setQuery)} placeholder="英文或中文，例如 apple、蘋果" aria-label="搜尋 Here We Go 單字"/></label>
    </div>
    <div className="hwg-browser-actions"><span role="status">找到 {cards.length} 個字詞{cards.length > 0 ? `，本輪練 ${Math.min(20, cards.length)} 張` : ''}</span><button type="button" disabled={!cards.length} onClick={() => onStart(id)}>練習目前範圍</button></div>
    {cards.length === 0 ? <p>這個範圍沒有符合的字詞，請更換冊次、範圍或搜尋內容。</p> : <ul className="hwg-browser-list">{cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(card => <li key={card.w}>
      <img src={card.img} alt={card.illustration.alt_zh} loading="lazy" width="64" height="64"/>
      <div><strong>{card.w}</strong><p>{card.m}</p><small>{[...new Set(card.curriculumReferences.map(ref => ref.unit))].join(' · ') || '主題字詞'}</small>
        <details><summary>例句與來源</summary><p lang="en">{card.ex}</p><p>{card.ez}</p><a href={card.curriculumSource} target="_blank" rel="noreferrer">查看公開來源 ↗</a></details>
      </div>
    </li>)}</ul>}
    {pages > 1 && <nav className="hwg-browser-pages" aria-label="Here We Go 單字預覽分頁"><button type="button" onClick={() => setPage(value => value - 1)} disabled={page === 0}>上一頁</button><span>第 {page + 1}／{pages} 頁</span><button type="button" onClick={() => setPage(value => value + 1)} disabled={page >= pages - 1}>下一頁</button></nav>}
    <style>{`
      .hwg-browser{margin-top:14px;border:1px solid var(--topic-border);border-radius:12px;padding:12px;color:var(--topic-text);font-size:13px;line-height:1.6}
      .hwg-browser summary{cursor:pointer;font-weight:700}.hwg-browser p{margin:6px 0;overflow-wrap:anywhere}
      .hwg-browser-controls{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}.hwg-browser-controls label{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1 1 150px}.hwg-browser-controls .hwg-browser-search{flex:2 1 220px}
      .hwg-browser input,.hwg-browser select{width:100%;box-sizing:border-box;min-height:42px;min-width:0;border:1px solid var(--topic-border);border-radius:8px;background:var(--topic-card);color:var(--topic-text);padding:8px;font:inherit}
      .hwg-browser button{min-height:42px;padding:8px 14px;border:1px solid var(--topic-border);border-radius:9px;background:var(--topic-card);color:var(--topic-text);font:inherit;cursor:pointer}.hwg-browser button:disabled{opacity:.5;cursor:not-allowed}
      .hwg-browser :is(button,input,select,summary,a):focus-visible{outline:3px solid var(--topic-accent);outline-offset:2px}
      .hwg-browser-actions,.hwg-browser-pages{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}.hwg-browser-actions button{background:var(--topic-accent);color:white;font-weight:700}
      .hwg-browser-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0;list-style:none;margin:14px 0}.hwg-browser-list li{display:flex;align-items:flex-start;gap:10px;min-width:0;padding:10px;background:var(--topic-card);border:1px solid var(--topic-border);border-radius:10px}.hwg-browser-list img{flex-shrink:0;object-fit:contain;border-radius:8px;background:white}.hwg-browser-list li>div{min-width:0;flex:1;overflow-wrap:anywhere}.hwg-browser-list strong{font-size:16px}.hwg-browser-list small{color:var(--topic-muted)}.hwg-browser-list details{margin-top:6px}.hwg-browser-list a{color:var(--topic-accent)}.hwg-browser-pages{justify-content:center}
      @media(max-width:600px){.hwg-browser-list{grid-template-columns:minmax(0,1fr)}.hwg-browser-actions button{width:100%}.hwg-browser-list img{width:52px;height:52px}}
    `}</style>
  </details>;
}
