import { useId } from 'react';

export function MoleFriend({ variant = 0 }) {
  return <svg viewBox="0 0 180 135" width="180" height="135" aria-hidden="true" className="arcade-mole-art">
    <ellipse cx="90" cy="118" rx="76" ry="15" fill="#345e45"/><ellipse cx="90" cy="117" rx="62" ry="9" fill="#1f4634"/>
    <g className="arcade-mole-body"><circle cx="48" cy="53" r="18" fill="#a57956"/><circle cx="132" cy="53" r="18" fill="#a57956"/><path d="M40 116V69c0-61 100-61 100 0v47" fill={variant % 2 ? '#cfa678' : '#bd926e'}/><ellipse cx="90" cy="83" rx="38" ry="28" fill="#f4d5af"/><ellipse cx="71" cy="67" rx="5" ry="7" fill="#3a3b39"/><ellipse cx="109" cy="67" rx="5" ry="7" fill="#3a3b39"/><ellipse cx="90" cy="82" rx="9" ry="6" fill="#885c50"/><path d="M79 91q11 12 22 0" fill="none" stroke="#885c50" strokeWidth="3" strokeLinecap="round"/><ellipse cx="59" cy="81" rx="8" ry="5" fill="#e99b8c"/><ellipse cx="121" cy="81" rx="8" ry="5" fill="#e99b8c"/><path d="M60 38q30-24 60 0" fill="none" stroke={['#eaac57','#71a595','#8e8cbc','#cf8279'][variant % 4]} strokeWidth="19" strokeLinecap="round"/><path d="M89 21q-17-15-21 0m23-1q3-20 19-16" fill="none" stroke="#609968" strokeWidth="7" strokeLinecap="round"/></g>
    <ellipse cx="42" cy="115" rx="15" ry="8" fill="#e1bb91"/><ellipse cx="138" cy="115" rx="15" ry="8" fill="#e1bb91"/>
  </svg>;
}

function Tree({ x, y, scale = 1, color = '#528974' }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M0 0v48" stroke="#96714d" strokeWidth="9"/><path d="M-31 14 0-51 31 14Z" fill={color}/><path d="M-24-8 0-63 24-8Z" fill={color}/></g>;
}
function Rocket({ x = 340, y = 125 }) {
  return <g transform={`translate(${x} ${y}) rotate(24)`}><g className="arcade-thrust"><path d="M-16 43Q0 110 16 43" fill="#edb55c"/><path d="M-8 43Q0 83 8 43" fill="#fff0a3"/></g><path d="M-23 8q-30 16-27 48l27-14M23 8q30 16 27 48L23 42" fill="#dc8d78"/><path d="M-25 43V-13Q-24-47 0-68 24-47 25-13v56Z" fill="#f8f0d9"/><path d="M-21-31Q-14-55 0-68 14-55 21-31" fill="#e69b86"/><circle cy="-9" r="16" fill="#8ebdcc" stroke="#537e9a" strokeWidth="6"/><path d="M-7-16q5-7 14-2" stroke="#e1f3ed" strokeWidth="4" fill="none" strokeLinecap="round"/><path d="M-21 40h42" stroke="#719dac" strokeWidth="9"/><path d="M0 14v43" stroke="#cd806a" strokeWidth="11" strokeLinecap="round"/></g>;
}
function Train({ x = 270, y = 145 }) {
  return <g transform={`translate(${x} ${y})`}><g fill="#fff" opacity=".7" className="arcade-train-smoke"><circle cx="-13" cy="-94" r="12"/><circle cx="8" cy="-112" r="17"/><circle cx="35" cy="-127" r="21"/></g><path d="M-65 37h240" stroke="#687f75" strokeWidth="6"/><rect x="70" y="-30" width="68" height="62" rx="9" fill="#e3b25a"/><rect x="83" y="-16" width="15" height="21" rx="3" fill="#fff0bd"/><rect x="108" y="-16" width="15" height="21" rx="3" fill="#fff0bd"/><rect x="148" y="-30" width="68" height="62" rx="9" fill="#d88b76"/><path d="M-57 27V-7h46v-53h63v87Z" fill="#478d80"/><path d="M-20-61h82" stroke="#336b64" strokeWidth="12" strokeLinecap="round"/><rect x="1" y="-47" width="35" height="26" rx="6" fill="#bfdfd3"/><path d="M-42-8v-41h18v41" fill="#dc9378"/><path d="M-47-51h29" stroke="#b97661" strokeWidth="9"/><path d="M-72 29h129" stroke="#dc9378" strokeWidth="12" strokeLinecap="round"/>{[-32,33,85,123,164,201].map(cx => <g key={cx}><circle cx={cx} cy="32" r="14" fill="#4c6462"/><circle cx={cx} cy="32" r="6" fill="#bad1b4"/></g>)}</g>;
}

export default function ArcadeScene({ game, progress = 0, className = '' }) {
  const id = useId().replace(/:/g, '');
  const palettes = { whack: ['#dcebd1','#a9ccac'], match: ['#33365e','#685981'], bomb: ['#cfE5e9','#93becb'], scramble: ['#f5e6c8','#d8dab9'] };
  const [top, bottom] = palettes[game] || palettes.whack;
  return <svg viewBox="0 0 640 260" preserveAspectRatio={className.includes('arcade-play-scene') ? 'xMidYMid meet' : 'xMidYMid slice'} style={{background:`linear-gradient(${top},${bottom})`}} className={`arcade-scene scene-${game} ${className}`} aria-hidden="true">
    <defs><linearGradient id={id} x2="0" y2="1"><stop stopColor={top}/><stop offset="1" stopColor={bottom}/></linearGradient></defs>
    <rect width="640" height="260" rx="24" fill={`url(#${id})`}/>
    {game === 'match' ? <>
      <circle cx="513" cy="67" r="36" fill="#f3dfab"/><circle cx="528" cy="55" r="32" fill="#494367"/>
      <path d="m81 83 83 52 99-68 79 89 93-34 108 61" stroke="#c4b6dc" strokeWidth="2" strokeDasharray="5 8" fill="none"/>
      {[[81,83],[164,135],[263,67],[342,156],[435,122],[543,183]].map(([x,y],i)=><g key={x} transform={`translate(${x} ${y})`} className={progress > i/6 ? 'arcade-star-lit' : ''}><path d="m0-15 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z" fill={progress > i/6 ? '#ffe1a2' : '#a9a0c6'}/><circle r="25" fill="none" stroke="#f1d9ac" opacity=".2"/></g>)}
      {[[51,36],[209,32],[390,44],[590,96],[97,208],[284,215],[602,223]].map(([cx,cy])=><circle key={cx} cx={cx} cy={cy} r="2.5" fill="#e6ddf2"/>)}<path d="M0 242q100-67 185-15t172 9 283-37v61H0Z" fill="#3d4264"/>
    </> : game === 'bomb' ? <>
      <circle cx="528" cy="84" r="46" fill="#e5b381"/><ellipse cx="528" cy="84" rx="75" ry="14" fill="none" stroke="#fff0d0" strokeWidth="7" transform="rotate(-24 528 84)"/><circle cx="104" cy="60" r="18" fill="#f4e4b8"/>
      <path d="M55 234q122-12 192-112" stroke="#fff" opacity=".65" strokeDasharray="7 10" strokeWidth="3" fill="none"/><Rocket x={285 + progress * 90} y={134 - progress * 35}/>
      {[[51,104],[157,126],[385,37],[576,177],[463,218]].map(([cx,cy])=><path key={cx} d={`M${cx-5} ${cy}h10m-5-5v10`} stroke="#fdf9e9" strokeWidth="3"/>)}<path d="M0 251q83-61 164 9H0" fill="#78a5b0"/>
    </> : <>
      <circle cx="512" cy="56" r="28" fill="#f4d687"/>
      <g fill="#fff" opacity=".6"><rect x="87" y="44" width="98" height="20" rx="10"/><ellipse cx="136" cy="46" rx="29" ry="18"/><rect x="383" y="80" width="95" height="15" rx="9"/></g>
      <path d="M0 169Q102 78 204 161T421 140 640 163V260H0Z" fill={game==='whack'?'#98bc95':'#c0c5a0'}/><path d="M0 206q123-70 252-9t388-21v84H0Z" fill={game==='whack'?'#7faa86':'#a4b48d'}/>
      <Tree x={64} y={143} scale={.95}/><Tree x={583} y={152} scale={1.25}/><Tree x={551} y={169} scale={.65} color="#6c9b7e"/>
      {game==='scramble'?<><path d="M0 218h640m-640 13h640" stroke="#eee5ce" strokeWidth="5"/>{Array.from({length:26},(_,i)=><path key={i} d={`M${i*26} 215v19`} stroke="#918e76" strokeWidth="4"/>)}<Train x={203 + progress*70} y={174}/></>:<><path d="M185 260q-19-57 68-81t54-45" stroke="#d1c59b" strokeWidth="26" fill="none"/><g transform="translate(270 77) scale(1.15)"><MoleFriend/></g>{[80,148,479,518].map((x,i)=><g key={x} transform={`translate(${x} ${218-i%2*15})`}><path d="M0 15V-9" stroke="#407f58" strokeWidth="4"/><path d="m0 5 11-7m-11 13-9-6" stroke="#407f58" strokeWidth="4"/>{[0,72,144,216,288].map(angle=><ellipse key={angle} cy="-14" rx="5" ry="9" fill={i%2?'#f4d68a':'#eab19b'} transform={`rotate(${angle} 0 -6)`}/>)}<circle cy="-6" r="5" fill="#f6e9b0"/></g>)}</>}
    </>}
  </svg>;
}
