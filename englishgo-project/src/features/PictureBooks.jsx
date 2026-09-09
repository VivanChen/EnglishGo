import { useEffect, useRef, useState } from 'react';
import { PIP_VOCAB } from '../data/pipBook.js';
import './pip-book-host.css';

export default function PictureBooks({ onBack, stopSpeech }) {
  const frame = useRef(null);
  const [height, setHeight] = useState(700);
  useEffect(() => {
    stopSpeech?.();
    function receive(event) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'pip:height' && Number.isFinite(event.data.height)) setHeight(Math.max(300, Math.min(2200, event.data.height)));
    }
    window.addEventListener('message', receive);
    const node = frame.current;
    const child = node?.contentWindow;
    return () => { window.removeEventListener('message', receive); if (node?.isConnected) child?.postMessage({ type: 'pip:stop' }, window.location.origin); stopSpeech?.(); };
  }, [stopSpeech]);
  function word(key) { frame.current?.contentWindow?.postMessage({ type: 'pip:word', word: key }, window.location.origin); }
  return <section className="pip-book-host" aria-label="互動童書">
    <header><button onClick={onBack}>← 返回學習</button><div><h1>Pip and the Lost Star</h1><p>皮皮與迷路的小星星 · 8 頁互動立體童書</p></div></header>
    <iframe ref={frame} src="/picture-books/pip-and-the-lost-star.html" title="Pip and the Lost Star 互動立體童書" style={{ height }} allow="autoplay"/>
    <p className="pip-book-note">每個英文單字都能點讀；有底線的重點單字會顯示中英單字卡。API 語音依播放進度帶讀，黃色高亮為估算位置。</p>
    <details className="pip-vocabulary"><summary>故事單字表 · {Object.keys(PIP_VOCAB).length} 個重點單字</summary><div>{Object.entries(PIP_VOCAB).map(([key,[icon,zh]]) => <button key={key} onClick={() => word(key)} aria-label={`朗讀 ${key} ${zh}`}><span aria-hidden="true">{icon}</span><strong lang="en">{key}</strong><span>{zh}</span></button>)}</div></details>
  </section>;
}
