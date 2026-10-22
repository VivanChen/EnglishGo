import './listening-interactions.css';

export default function ListeningRadio({ state = 'idle', compact = false }) {
  return <div className={`listening-radio${compact ? ' is-compact' : ''}`} data-state={state} aria-hidden="true">
    <svg viewBox="0 0 240 110" fill="none">
      <path d="M78 26V15h77v11" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <rect x="42" y="26" width="155" height="74" rx="18" className="listening-radio-body" />
      <circle cx="85" cy="63" r="24" stroke="currentColor" strokeWidth="3" />
      <circle className="listening-radio-speaker" cx="85" cy="63" r="13" fill="currentColor" />
      <path d="M125 45h52M125 53h52" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <g className="listening-radio-bars" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
        {[10, 20, 28, 16, 24].map((height, i) => <path key={i} d={`M${127 + i * 11} ${82 - height}v${height}`} style={{ animationDelay: `${i * -0.16}s` }} />)}
      </g>
      <g className="listening-radio-notes" fill="currentColor"><path d="M20 38v18c-10-3-12 10-4 10 6 0 8-5 8-9V43l10-3v-7z" /><path d="M211 30v16c-9-2-10 9-3 9 5 0 7-4 7-8V34l9-3v-6z" /></g>
      <g className="listening-radio-stars" fill="currentColor"><path d="m21 22 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1zM219 65l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" /></g>
    </svg>
    <span>{state === 'playing' ? '♫ 小耳朵正在聽' : state === 'loading' ? '準備聲音中…' : state === 'complete' ? '每一小格，都接起來了！' : '按下播放，聽一聽'}</span>
  </div>;
}
