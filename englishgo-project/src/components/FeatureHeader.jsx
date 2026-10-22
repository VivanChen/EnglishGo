import { useEffect, useRef } from 'react';

export default function FeatureHeader({ title, onBack, children }) {
  const heading = useRef(null);

  // Lazy modules can mount after the app's navigation effect has already run.
  // Focus once on entry, leaving later input and playback controls undisturbed.
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  return <header className="eg-feature-header">
    <button type="button" onClick={onBack}>← 返回</button>
    <h2 ref={heading} tabIndex={-1}>{title}</h2>
    {children}
  </header>;
}
