import { useEffect, useRef, useState } from 'react';
import PictureBookArt from './PictureBookArt.jsx';
import './picture-book-paper.css';

const actions = { fox: 'hop', rabbit: 'hop', bear: 'wave', bird: 'fly', star: 'spin', moon: 'glow', rainbow: 'glow', tree: 'sway', flower: 'sway', basket: 'rock', apple: 'hop', bread: 'rock', home: 'glow' };
const sizes = { fox: 190, bear: 190, rabbit: 145, tree: 200, home: 190, rainbow: 200, moon: 95, star: 90, bird: 90, flower: 110, basket: 125, apple: 85, bread: 110 };

export default function PictureBookStage({ book, page, index, onPick, selected, spokenWord, motion, view, cameraReset, interaction }) {
  const slot = useRef(null), previous = useRef(index);
  const [scale, setScale] = useState(.8), [flip, setFlip] = useState(null);
  const [pulse, setPulse] = useState({ word: '', serial: 0 });
  useEffect(() => {
    const resize = () => { if (slot.current) setScale(Math.min(slot.current.clientWidth / 800, slot.current.clientHeight / 720)); };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(slot.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (previous.current === index) return;
    setFlip({ direction: index > previous.current ? 'forward' : 'back', key: Date.now() });
    previous.current = index;
    const timer = setTimeout(() => setFlip(null), 950);
    return () => clearTimeout(timer);
  }, [index]);
  useEffect(() => { if (interaction?.word) setPulse(interaction); }, [interaction]);
  function pick(entry) { setPulse(p => ({ word: entry.word, serial: p.serial + 1 })); onPick(entry); }
  const word = spokenWord?.replace(/[^a-z]/gi, '').toLowerCase();
  return <div className={`pb-paper-world ${book.theme} ${motion ? '' : 'paper-calm'}`}>
    <div className="pb-desk-light" aria-hidden="true"/>
    <div className="pb-paper-slot" ref={slot}>
      <div className="pb-paper-scale" style={{ '--paper-scale': scale }}>
        <div className="pb-paper-book" style={{ '--paper-view': `${view * 3}deg` }} key={`view-${cameraReset}`}>
          <div className="pb-paper-board far"/><div className="pb-paper-board near"/>
          <div className="pb-paper-leaf far">
            <div className="pb-printed-forest"><span>{book.title}</span><i>✦</i></div>
          </div>
          <div className="pb-paper-leaf near">
            <div className="pb-paper-ground" aria-hidden="true"><span/><i/><b/></div>
            <span className="pb-paper-folio">ENGLISHGO · {String(index + 1).padStart(2, '0')}</span>
            <div className="pb-paper-cast" key={`${book.id}-${index}`}>
              {page.objects.map((entry, i) => {
                const floating = ['moon', 'star', 'rainbow', 'bird'].includes(entry.word);
                const isActive = selected === entry.word || word === entry.word;
                return <div key={entry.word} className={`pb-paper-pop ${floating ? 'floating' : ''}`} style={{ left: `${16 + i * 30}%`, bottom: `${floating ? 62 : 17 + (i % 2) * 7}%`, width: sizes[entry.word], '--pop-order': i }}>
                  <button className={`pb-cutout ${isActive ? 'active' : ''}`} aria-label={`場景 ${entry.word}（${entry.zh}）`} onClick={() => pick(entry)}>
                    <span key={pulse.word === entry.word ? pulse.serial : 'still'} className={`pb-cutout-art ${pulse.word === entry.word ? `react-${actions[entry.word]}` : ''}`}><PictureBookArt word={entry.word}/></span>
                    <span className="pb-paper-tag" lang="en">{entry.word}</span>
                  </button>
                  <span className="pb-fold-tab" aria-hidden="true"/>
                </div>;
              })}
            </div>
          </div>
          {flip && <div key={flip.key} className={`pb-paper-sheet ${flip.direction}`} aria-hidden="true"><i/><b/></div>}
          <div className="pb-ribbon" aria-hidden="true"/>
        </div>
      </div>
    </div>
  </div>;
}
