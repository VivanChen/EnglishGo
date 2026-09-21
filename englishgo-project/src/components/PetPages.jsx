import { Children, useEffect, useState } from 'react';

/** Explicit pages keep every card reachable without making the pet room scroll. */
export default function PetPages({ children, className = '', label = '內容', columns = 1 }) {
  const items = Children.toArray(children).filter(Boolean);
  const [page, setPage] = useState(0);
  const [wide, setWide] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const resize = () => setWide(window.innerWidth >= 900);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const size = wide ? columns : 1;
  const total = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, total - 1);
  useEffect(() => setPage(p => Math.min(p, total - 1)), [total]);
  return <section className="pet-pages" aria-label={label}>
    <div className={`pet-page-content ${className}`} style={{ '--page-columns': Math.min(size, items.length) || 1 }}>
      {items.slice(current * size, (current + 1) * size)}
    </div>
    {total > 1 && <nav className="pet-page-controls" aria-label={`${label}分頁`}>
      <button disabled={current === 0} onClick={() => setPage(current - 1)} aria-label={`${label}上一頁`}>←</button>
      <span aria-live="polite">{current + 1} / {total}</span>
      <button disabled={current === total - 1} onClick={() => setPage(current + 1)} aria-label={`${label}下一頁`}>→</button>
    </nav>}
  </section>;
}
