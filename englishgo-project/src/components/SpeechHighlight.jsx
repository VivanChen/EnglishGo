import { Fragment } from 'react';
import { storyWords } from '../lib/speechTiming.js';
import './speech-highlight.css';

export default function SpeechHighlight({ text, playback }) {
  const ownText = playback?.text === text;
  const inContext = playback?.sourceText === text && Number.isInteger(playback?.wordOffset);
  const active = playback?.started && (ownText || inContext);
  if (!active) return <span className="speech-highlight" lang="en">{text}</span>;
  const words = storyWords(text), offset = ownText ? 0 : playback.wordOffset;
  const count = storyWords(playback.text).length;
  const tracked = Number.isInteger(playback.word) && playback.word >= 0 && playback.word < count;
  return <span className="speech-highlight is-reading" lang="en" data-timing={tracked ? playback.approximate ? 'approximate' : 'word' : 'phrase'}>
    {words.map((word, index) => <Fragment key={word.start}>
      {text.slice(index ? words[index - 1].end : 0, word.start)}<span className={`speech-highlight-word${tracked && index === offset + playback.word ? ' is-current' : !tracked && index >= offset && index < offset + count ? ' is-active-phrase' : ''}`}>{word.text}</span>
    </Fragment>)}{text.slice(words.at(-1)?.end || 0)}
  </span>;
}

export function SpeechHighlightNote({ playback }) {
  return playback?.started && playback?.approximate ? <p className="speech-highlight-note">高亮依播放進度估算，可以跟著聲音慢慢唸。</p> : null;
}
