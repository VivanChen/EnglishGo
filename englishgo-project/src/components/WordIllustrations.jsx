import { useEffect, useRef, useState } from 'react';
import { getLocalWordIllustrations, normalizeWordIllustrations } from '../data/wordIllustrations.js';
import './word-illustrations.css';

function IllustrationImage({ item }) {
  const [source, setSource] = useState(item.image_url);
  const [failed, setFailed] = useState(false);
  return failed ? <div className="word-art-unavailable" role="status">{item.alt_zh}<span>圖片暫時無法載入，可以先讀下面的例句。</span></div>
    : <img src={source} alt={item.alt_zh} width="1024" height="1024" decoding="async" onError={() => {
      if (item.local_path && source !== item.local_path) setSource(item.local_path);
      else setFailed(true);
    }} />;
}

export function useWordIllustrations(level, word, fetchIllustrations) {
  const [result, setResult] = useState(null);
  const key = `${level}:${word}`;
  useEffect(() => {
    let current = true;
    setResult(null);
    if (word && typeof fetchIllustrations === 'function' && level === 'elementary') {
      Promise.resolve().then(() => fetchIllustrations(level, word)).then(rows => {
        const valid = normalizeWordIllustrations(rows, level, word);
        if (current && valid.length) setResult({ key, items: valid });
      }).catch(() => { /* The bundled illustrations remain available offline. */ });
    }
    return () => { current = false; };
  }, [level, word, key, fetchIllustrations]);
  return result?.key === key ? result.items : getLocalWordIllustrations(level, word);
}

export default function WordIllustrations({ level, word, fetchIllustrations, speak }) {
  const items = useWordIllustrations(level, word, fetchIllustrations);
  return <WordIllustrationGallery key={`${level}:${word}`} word={word} items={items} speak={speak}/>;
}

export function WordIllustrationGallery({ word, items, speak }) {
  const [active, setActive] = useState(0);
  const track = useRef(null);
  if (!items.length) return null;
  const select = index => {
    const next = Math.max(0, Math.min(items.length - 1, index));
    setActive(next);
    const container = track.current;
    const figure = container?.children[next];
    if (figure) container.scrollTo({ left: figure.offsetLeft - container.children[0].offsetLeft, behavior: 'auto' });
  };
  return <section className="word-art" aria-label={`${word} 的繪本插畫`} data-testid="srs-back-illustrations">
    <div className="word-art-heading"><strong>看圖記單字</strong><span>{items.length > 1 ? '不同情境，相同意思' : '把畫面和意思連在一起'}</span></div>
    <div className="word-art-track" ref={track} style={{ '--art-count': items.length }} onScroll={() => {
      const container = track.current;
      if (!container || container.scrollWidth <= container.clientWidth + 1) return;
      const width = container.children[1]?.offsetLeft - container.children[0]?.offsetLeft;
      if (width > 0) setActive(Math.min(items.length - 1, Math.round(container.scrollLeft / width)));
    }}>
      {items.map(item => <figure className="word-art-scene" key={`${item.id}:${item.image_url}`}>
        <IllustrationImage item={item} />
        <figcaption><div className="word-art-en"><span>{item.example}</span>{speak && <button type="button" className="srs-sound-btn" aria-label={`朗讀插畫例句：${item.example}`} onClick={() => speak(item.example)}>🔊</button>}</div><p>{item.example_zh}</p></figcaption>
      </figure>)}
    </div>
    {items.length > 1 && <nav className="word-art-navigation" aria-label="切換插畫">
      <button type="button" onClick={() => select(active - 1)} disabled={active === 0} aria-label="上一張插畫">←</button>
      <span aria-live="polite">{active + 1} / {items.length}</span>
      <button type="button" onClick={() => select(active + 1)} disabled={active === items.length - 1} aria-label="下一張插畫">→</button>
    </nav>}
  </section>;
}
