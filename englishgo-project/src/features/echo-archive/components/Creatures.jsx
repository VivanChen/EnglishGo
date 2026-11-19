import { useId } from 'react';

// Hand-built SVG creatures. Each one stands on y≈190 inside a 200×200 box and
// shares the same language: dark ink bodies, a cool rim light, glowing eyes.
function useIds() {
  const base = useId().replace(/[^a-zA-Z0-9]/g, '');
  return name => `${base}${name}`;
}

const Shadow = ({ w = 70, y = 190 }) => <ellipse cx="100" cy={y} rx={w} ry={w * 0.13} fill="#000" opacity=".35"/>;
function Eyes({ x1, x2, y, r = 5, color = '#8ef3ff', id }) {
  return <g filter={`url(#${id})`}><circle cx={x1} cy={y} r={r} fill={color}/><circle cx={x2} cy={y} r={r} fill={color}/><circle cx={x1 + r * 0.3} cy={y - r * 0.3} r={r * 0.35} fill="#fff"/><circle cx={x2 + r * 0.3} cy={y - r * 0.3} r={r * 0.35} fill="#fff"/></g>;
}
function Defs({ id, from, to, glow = 3 }) {
  return <defs>
    <linearGradient id={id('body')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={from}/><stop offset="1" stopColor={to}/></linearGradient>
    <radialGradient id={id('sheen')} cx=".35" cy=".25" r=".7"><stop offset="0" stopColor="#fff" stopOpacity=".35"/><stop offset=".6" stopColor="#fff" stopOpacity="0"/></radialGradient>
    <filter id={id('glow')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={glow} result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>;
}

const ART = {
  inkling: id => <>
    <Defs id={id} from="#3b4386" to="#11132c"/>
    <Shadow w={52}/>
    <path d="M52 182C38 182 34 166 42 154C30 140 36 104 64 94C70 70 96 62 112 74C134 66 160 86 156 112C172 126 166 160 150 168C160 178 150 188 138 182C128 192 112 186 106 180C96 190 78 190 72 180C64 188 54 188 52 182Z" fill={`url(#${id('body')})`}/>
    <path d="M52 182C38 182 34 166 42 154C30 140 36 104 64 94C70 70 96 62 112 74C134 66 160 86 156 112" fill={`url(#${id('sheen')})`}/>
    <path d="M64 96C74 84 94 80 104 86" stroke="#9aa6ff" strokeOpacity=".5" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <Eyes x1={84} x2={122} y={128} r={9} id={id('glow')}/>
    <path d="M90 152Q104 160 118 152" stroke="#8ef3ff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".7"/>
    <circle cx="160" cy="176" r="5" fill="#2a2f62"/><circle cx="36" cy="172" r="4" fill="#2a2f62"/>
  </>,
  moth: id => <>
    <Defs id={id} from="#fbf1d6" to="#c7b38c"/>
    <Shadow w={44}/>
    <g className="ea-flap-l"><path d="M96 98C70 50 22 52 18 78C14 104 50 118 92 112Z" fill={`url(#${id('body')})`} stroke="#8a7550" strokeWidth="2"/><path d="M90 112C60 120 34 140 44 160C56 176 84 154 96 122Z" fill="#e9dcbc" stroke="#8a7550" strokeWidth="2"/><path d="M34 72H72M30 82H78M36 92H82" stroke="#8a7550" strokeOpacity=".5" strokeWidth="2"/></g>
    <g className="ea-flap-r"><path d="M104 98C130 50 178 52 182 78C186 104 150 118 108 112Z" fill={`url(#${id('body')})`} stroke="#8a7550" strokeWidth="2"/><path d="M110 112C140 120 166 140 156 160C144 176 116 154 104 122Z" fill="#e9dcbc" stroke="#8a7550" strokeWidth="2"/><path d="M128 72H166M122 82H170M118 92H164" stroke="#8a7550" strokeOpacity=".5" strokeWidth="2"/></g>
    <ellipse cx="100" cy="122" rx="12" ry="40" fill="#2d2440"/>
    <path d="M94 86C86 66 80 60 72 58M106 86C114 66 120 60 128 58" stroke="#2d2440" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <Eyes x1={93} x2={107} y={96} r={5} color="#ffbe55" id={id('glow')}/>
  </>,
  wisp: id => <>
    <Defs id={id} from="#fff4c4" to="#e0a958" glow={6}/>
    <path d="M100 168C80 160 76 140 86 128" stroke="#f3d79a" strokeOpacity=".5" strokeWidth="10" fill="none" strokeLinecap="round"/>
    <g filter={`url(#${id('glow')})`}><circle cx="100" cy="112" r="30" fill={`url(#${id('body')})`} opacity=".9"/></g>
    <circle cx="100" cy="112" r="38" fill="#ffe7a6" opacity=".15"/>
    <circle cx="66" cy="84" r="4" fill="#ffe7a6"/><circle cx="138" cy="92" r="3" fill="#ffe7a6"/><circle cx="130" cy="146" r="5" fill="#ffe7a6" opacity=".7"/><circle cx="70" cy="142" r="3" fill="#ffe7a6"/>
    <circle cx="90" cy="110" r="4.5" fill="#5a3b15"/><circle cx="110" cy="110" r="4.5" fill="#5a3b15"/>
  </>,
  worm: id => <>
    <Defs id={id} from="#8e6aa8" to="#3d2752"/>
    <Shadow w={72}/>
    <path d="M30 186L100 168L170 186L100 196Z" fill="#6b4a2a"/><path d="M34 182L100 164V190ZM166 182L100 164V190Z" fill="#efe1c0" stroke="#b39a6e"/>
    {[[100, 150, 30], [92, 120, 27], [96, 92, 24], [110, 68, 22]].map(([x, y, r], i) => <g key={i}><circle cx={x} cy={y} r={r} fill={`url(#${id('body')})`}/><path d={`M${x - r + 4} ${y}Q${x} ${y + 8} ${x + r - 4} ${y}`} stroke="#c9a6ff" strokeOpacity=".35" strokeWidth="2" fill="none"/></g>)}
    <path d="M100 56L90 40M120 56L130 42" stroke="#3d2752" strokeWidth="5" strokeLinecap="round"/>
    <Eyes x1={102} x2={120} y={64} r={5} color="#ff9b6b" id={id('glow')}/>
    <path d="M100 78L106 86L112 78L118 86" stroke="#f2e7ff" strokeWidth="2.5" fill="none"/>
  </>,
  knight: id => <>
    <Defs id={id} from="#5d6987" to="#1d2236"/>
    <Shadow w={64}/>
    <path d="M150 20C120 40 108 80 104 120" stroke="#f1e6c8" strokeWidth="4"/><path d="M168 8C140 14 118 40 116 80C132 66 150 44 168 8Z" fill="#efe1c0"/>
    <path d="M60 188L66 120H136L142 188Z" fill={`url(#${id('body')})`}/>
    <path d="M56 120C56 98 72 88 100 88S144 98 144 120Z" fill="#2a3150"/>
    <path d="M72 92C72 60 84 46 100 46S128 60 128 92Z" fill={`url(#${id('body')})`}/>
    <path d="M100 46C96 30 90 18 76 12C86 28 88 38 92 48Z" fill="#c64b5a"/>
    <rect x="78" y="70" width="44" height="6" rx="3" fill="#0b0d18"/>
    <g filter={`url(#${id('glow')})`}><rect x="84" y="71" width="12" height="4" rx="2" fill="#ff5468"/><rect x="104" y="71" width="12" height="4" rx="2" fill="#ff5468"/></g>
    <path d="M82 130H118M78 150H122" stroke="#8e9bc0" strokeOpacity=".4" strokeWidth="3"/>
    <path d="M38 98L60 188" stroke="#1b1d2a" strokeWidth="8" strokeLinecap="round"/><path d="M28 70L44 104L36 110Z" fill="#1b1d2a"/>
  </>,
  librarian: id => <>
    <Defs id={id} from="#2f6a62" to="#0e2423"/>
    <Shadow w={56}/>
    <path d="M58 190C64 140 70 110 84 96H116C130 110 136 140 142 190Z" fill={`url(#${id('body')})`}/>
    <path d="M90 96V70" stroke="#d9cdb3" strokeWidth="10"/>
    <ellipse cx="96" cy="56" rx="22" ry="26" fill="#d9cdb3"/>
    <path d="M74 50C74 30 92 24 106 30C116 34 120 44 118 56C110 46 92 42 74 50Z" fill="#3a3a48"/>
    <g filter={`url(#${id('glow')})`}><circle cx="88" cy="58" r="8" fill="none" stroke="#9ff7e6" strokeWidth="3"/><circle cx="108" cy="58" r="8" fill="none" stroke="#9ff7e6" strokeWidth="3"/><path d="M96 58H100" stroke="#9ff7e6" strokeWidth="3"/></g>
    <path d="M100 74V86" stroke="#7b3a3a" strokeWidth="3" strokeLinecap="round"/><path d="M104 78C116 78 120 70 120 64" stroke="#d9cdb3" strokeWidth="7" strokeLinecap="round" fill="none"/>
    <path d="M58 140L46 150L66 166L84 150Z" fill="#7a2f3a"/><path d="M48 150L66 164" stroke="#f1d38a" strokeWidth="2"/>
  </>,
  tome: id => <>
    <Defs id={id} from="#4b2d6e" to="#1a0f29" glow={5}/>
    <Shadow w={80} y={192}/>
    <g className="ea-float">
      <path d="M100 60C70 44 36 46 14 54V160C36 152 70 150 100 166C130 150 164 152 186 160V54C164 46 130 44 100 60Z" fill={`url(#${id('body')})`}/>
      <path d="M100 66C74 54 44 54 24 60V150C44 144 74 144 100 156C126 144 156 144 176 150V60C156 54 126 54 100 66Z" fill="#efe4c6"/>
      <path d="M100 66V156" stroke="#b39a6e" strokeWidth="3"/>
      <path d="M36 80H84M36 92H80M36 104H86M120 80H164M124 92H164M118 104H162" stroke="#b39a6e" strokeOpacity=".45" strokeWidth="2.5"/>
      <ellipse cx="100" cy="112" rx="34" ry="20" fill="#14091f"/>
      <g filter={`url(#${id('glow')})`}><circle cx="100" cy="112" r="13" fill="#c98bff"/><ellipse cx="100" cy="112" rx="4" ry="11" fill="#14091f"/></g>
      <path d="M40 160C30 178 44 184 36 196M80 160C78 176 92 180 84 196M126 160C130 176 116 182 122 196M164 160C176 176 160 184 168 196" stroke="#2b1840" strokeWidth="7" strokeLinecap="round" fill="none"/>
      <path d="M14 54C36 46 70 44 100 60C130 44 164 46 186 54" stroke="#e8c47a" strokeWidth="3" fill="none"/>
    </g>
  </>,
  rat: id => <>
    <Defs id={id} from="#a07a4a" to="#4b3622"/>
    <Shadow w={60}/>
    <path d="M160 168C182 168 186 150 172 142" stroke="#c08b8b" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <ellipse cx="108" cy="150" rx="56" ry="36" fill={`url(#${id('body')})`}/>
    <g className="ea-spin" style={{ transformOrigin: '118px 134px' }}><circle cx="118" cy="134" r="20" fill="none" stroke="#d6a648" strokeWidth="8" strokeDasharray="7 5"/><circle cx="118" cy="134" r="10" fill="#d6a648"/></g>
    <path d="M62 132C46 132 34 142 30 152C40 158 56 158 70 150Z" fill="#8b6a40"/>
    <circle cx="66" cy="120" r="14" fill="#b08860"/><circle cx="66" cy="120" r="8" fill="#d9a4a4"/>
    <Eyes x1={44} x2={56} y={142} r={3.5} color="#ffe36b" id={id('glow')}/>
    <circle cx="30" cy="152" r="4" fill="#2a1a12"/>
    <path d="M80 184V190M130 184V190" stroke="#4b3622" strokeWidth="6" strokeLinecap="round"/>
  </>,
  sentinel: id => <>
    <Defs id={id} from="#3d6b72" to="#152a2e"/>
    <Shadow w={50}/>
    <path d="M72 186L64 196M128 186L136 196" stroke="#1f3439" strokeWidth="8" strokeLinecap="round"/>
    <rect x="66" y="64" width="68" height="124" rx="10" fill={`url(#${id('body')})`}/>
    <path d="M60 64L100 30L140 64Z" fill="#b58b44"/><circle cx="100" cy="26" r="6" fill="#e8c47a"/>
    <circle cx="100" cy="104" r="26" fill="#efe4c6" stroke="#b58b44" strokeWidth="5"/>
    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => <line key={i} x1="100" y1="82" x2="100" y2="86" stroke="#4a3a20" strokeWidth="2" transform={`rotate(${i * 30} 100 104)`}/>)}
    <g filter={`url(#${id('glow')})`}><circle cx="100" cy="104" r="7" fill="#5cf2c6"/></g>
    <path d="M100 104L100 86M100 104L114 110" stroke="#4a3a20" strokeWidth="3" strokeLinecap="round"/>
    <path d="M76 146H124M76 160H124" stroke="#9fd1d4" strokeOpacity=".35" strokeWidth="3"/>
  </>,
  pendulum: id => <>
    <Defs id={id} from="#c79a52" to="#5e4320"/>
    <path d="M60 8H140" stroke="#5e4320" strokeWidth="8" strokeLinecap="round"/>
    <g className="ea-swing" style={{ transformOrigin: '100px 10px' }}>
      <path d="M100 10V118" stroke="#a88544" strokeWidth="6"/>
      <circle cx="100" cy="148" r="36" fill={`url(#${id('body')})`}/>
      <path d="M64 148A36 36 0 0 0 136 148Z" fill="#3a2a14" opacity=".35"/>
      <path d="M62 160L100 196L138 160" fill="#d9dde6" stroke="#8892a6" strokeWidth="2"/>
      <Eyes x1={88} x2={112} y={142} r={6} color="#ff7a45" id={id('glow')}/>
    </g>
  </>,
  mite: id => <>
    <Defs id={id} from="#d0743a" to="#6b2e14"/>
    <Shadow w={44}/>
    <path d="M62 170L46 186M80 176L72 192M120 176L128 192M138 170L154 186" stroke="#3a1a0e" strokeWidth="5" strokeLinecap="round"/>
    <ellipse cx="100" cy="150" rx="48" ry="32" fill={`url(#${id('body')})`}/>
    <path d="M100 118V182" stroke="#3a1a0e" strokeWidth="3"/>
    <circle cx="80" cy="140" r="5" fill="#8a3a18"/><circle cx="122" cy="152" r="6" fill="#8a3a18"/><circle cx="112" cy="134" r="3" fill="#8a3a18"/>
    <ellipse cx="100" cy="120" rx="22" ry="14" fill="#3a1a0e"/>
    <path d="M86 110L74 96M114 110L126 96" stroke="#3a1a0e" strokeWidth="4" strokeLinecap="round"/>
    <Eyes x1={92} x2={108} y={118} r={4} color="#ffd36b" id={id('glow')}/>
  </>,
  golem: id => <>
    <Defs id={id} from="#c99a4e" to="#5b3d18" glow={6}/>
    <Shadow w={84}/>
    <rect x="44" y="150" width="34" height="40" rx="6" fill="#6e4b20"/><rect x="122" y="150" width="34" height="40" rx="6" fill="#6e4b20"/>
    <path d="M36 72H164L154 160H46Z" fill={`url(#${id('body')})`}/>
    <rect x="16" y="76" width="30" height="88" rx="14" fill="#a87a38"/><rect x="154" y="76" width="30" height="88" rx="14" fill="#a87a38"/>
    <circle cx="31" cy="164" r="16" fill="#6e4b20"/><circle cx="169" cy="164" r="16" fill="#6e4b20"/>
    <g filter={`url(#${id('glow')})`}><rect x="80" y="100" width="40" height="34" rx="8" fill="#ff8a3d"/><rect x="88" y="108" width="24" height="18" rx="5" fill="#ffd27a"/></g>
    <path d="M80 100V134M92 100V134M108 100V134M120 100V134" stroke="#5b3d18" strokeWidth="3"/>
    <rect x="76" y="40" width="48" height="36" rx="8" fill="#b88a45"/>
    <rect x="84" y="54" width="32" height="8" rx="4" fill="#2a1a08"/>
    <g filter={`url(#${id('glow')})`}><circle cx="92" cy="58" r="3.5" fill="#ffd27a"/><circle cx="108" cy="58" r="3.5" fill="#ffd27a"/></g>
    {[[48, 84], [152, 84], [60, 146], [140, 146]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="4" fill="#e8c47a"/>)}
  </>,
  gear: id => <>
    <Defs id={id} from="#9aa7b8" to="#3b4452"/>
    <Shadow w={52}/>
    <g className="ea-spin" style={{ transformOrigin: '100px 118px' }}>
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x="92" y="50" width="16" height="22" rx="3" fill="#7c8798" transform={`rotate(${i * 36} 100 118)`}/>)}
      <circle cx="100" cy="118" r="54" fill={`url(#${id('body')})`}/>
      <circle cx="100" cy="118" r="44" fill="none" stroke="#c9d3df" strokeOpacity=".4" strokeWidth="3"/>
    </g>
    <circle cx="100" cy="118" r="30" fill="#232933"/>
    <Eyes x1={89} x2={111} y={114} r={6} color="#7af0ff" id={id('glow')}/>
    <path d="M88 132H112" stroke="#7af0ff" strokeWidth="3" strokeLinecap="round" opacity=".7"/>
  </>,
  clock: id => <>
    <Defs id={id} from="#2f4f5a" to="#0d1a1f" glow={5}/>
    <Shadow w={86} y={192}/>
    <g className="ea-spin-slow" style={{ transformOrigin: '150px 60px' }}><circle cx="150" cy="60" r="38" fill="none" stroke="#7a5a2a" strokeWidth="12" strokeDasharray="10 7"/></g>
    <g className="ea-spin-rev" style={{ transformOrigin: '46px 70px' }}><circle cx="46" cy="70" r="28" fill="none" stroke="#7a5a2a" strokeWidth="10" strokeDasharray="8 6"/></g>
    <path d="M40 190C44 150 56 130 70 124H130C144 130 156 150 160 190Z" fill={`url(#${id('body')})`}/>
    <circle cx="100" cy="92" r="62" fill="#1a2b31" stroke="#c99a4e" strokeWidth="7"/>
    <circle cx="100" cy="92" r="52" fill="#efe4c6"/>
    {['XII', 'III', 'VI', 'IX'].map((n, i) => <text key={n} x={100 + Math.sin(i * Math.PI / 2) * 40} y={98 - Math.cos(i * Math.PI / 2) * 40} textAnchor="middle" fontSize="13" fontFamily="Georgia,serif" fill="#4a3a20" fontWeight="700">{n}</text>)}
    <g className="ea-spin-hand" style={{ transformOrigin: '100px 92px' }}><path d="M100 92V48" stroke="#2a1f10" strokeWidth="5" strokeLinecap="round"/></g>
    <path d="M100 92L128 104" stroke="#2a1f10" strokeWidth="6" strokeLinecap="round"/>
    <g filter={`url(#${id('glow')})`}><circle cx="78" cy="80" r="7" fill="#ff5d5d"/><circle cx="122" cy="80" r="7" fill="#ff5d5d"/></g>
    <circle cx="100" cy="92" r="6" fill="#c99a4e"/>
  </>,
  wraith: id => <>
    <Defs id={id} from="#b9b3e8" to="#3f3870" glow={4}/>
    <g className="ea-float">
      <path d="M100 30C66 30 52 58 52 96C52 130 46 160 34 184C52 176 60 186 72 178C82 188 92 180 100 190C108 180 118 188 128 178C140 186 148 176 166 184C154 160 148 130 148 96C148 58 134 30 100 30Z" fill={`url(#${id('body')})`} opacity=".92"/>
      <path d="M76 60C74 82 80 100 100 104C120 100 126 82 124 60C116 48 84 48 76 60Z" fill="#14112b"/>
      <Eyes x1={88} x2={112} y={74} r={5.5} color="#e2d8ff" id={id('glow')}/>
      <path d="M90 92H110M94 88V96M100 88V96M106 88V96" stroke="#e2d8ff" strokeWidth="2" opacity=".75"/>
      <path d="M52 110C34 118 28 138 32 150M148 110C166 118 172 138 168 150" stroke="#8f86c9" strokeWidth="8" strokeLinecap="round" fill="none" opacity=".7"/>
    </g>
  </>,
  shade: id => <>
    <Defs id={id} from="#3a2a5e" to="#0d0a1c" glow={4}/>
    <Shadow w={44}/>
    <g opacity=".9">
      <path d="M100 40C84 40 76 52 76 66C76 78 82 86 88 90C68 98 58 116 56 150L66 190H134L144 150C142 116 132 98 112 90C118 86 124 78 124 66C124 52 116 40 100 40Z" fill={`url(#${id('body')})`} stroke="#b28bff" strokeOpacity=".6" strokeWidth="2.5"/>
      <path d="M64 120C52 130 46 146 48 160M136 120C148 130 154 146 152 160" stroke="#b28bff" strokeOpacity=".4" strokeWidth="2" fill="none"/>
      <Eyes x1={92} x2={108} y={66} r={4} color="#d2b8ff" id={id('glow')}/>
      <path d="M150 54L162 30M156 58L178 44" stroke="#d2b8ff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round"/>
    </g>
  </>,
  gargoyle: id => <>
    <Defs id={id} from="#8e939e" to="#3c3f48"/>
    <Shadow w={74}/>
    <path d="M60 96C30 70 14 76 10 94C26 92 34 100 40 112ZM140 96C170 70 186 76 190 94C174 92 166 100 160 112Z" fill="#5d616c"/>
    <path d="M56 188C50 150 58 118 76 104H124C142 118 150 150 144 188Z" fill={`url(#${id('body')})`}/>
    <path d="M66 188L58 196M134 188L142 196" stroke="#3c3f48" strokeWidth="8" strokeLinecap="round"/>
    <path d="M74 104C70 70 84 52 100 52S130 70 126 104Z" fill={`url(#${id('body')})`}/>
    <path d="M78 64L66 38L88 56M122 64L134 38L112 56" fill="#5d616c"/>
    <Eyes x1={88} x2={112} y={78} r={5} color="#ffb86b" id={id('glow')}/>
    <path d="M86 96H114" stroke="#26282e" strokeWidth="4" strokeLinecap="round"/>
    <path d="M80 130L96 140L88 160M120 128L108 146L118 164" stroke="#26282e" strokeOpacity=".5" strokeWidth="2.5" fill="none"/>
  </>,
  oracle: id => <>
    <Defs id={id} from="#e7d9b4" to="#7a6a46" glow={5}/>
    <Shadow w={60}/>
    <g filter={`url(#${id('glow')})`}><circle cx="100" cy="64" r="44" fill="none" stroke="#f2c76b" strokeWidth="3" opacity=".8"/></g>
    <path d="M52 190C56 140 66 100 100 96C134 100 144 140 148 190Z" fill="#2b2146"/>
    <path d="M70 110C62 60 80 30 100 30S138 60 130 110C120 122 80 122 70 110Z" fill={`url(#${id('body')})`}/>
    <path d="M76 60H124M74 76H126M76 92H124" stroke="#7a6a46" strokeOpacity=".4" strokeWidth="2"/>
    <g filter={`url(#${id('glow')})`}>{[[88, 60], [112, 60], [100, 78], [84, 92], [116, 92]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="6" ry="3.5" fill="#7a2fd6"/>)}</g>
    <path d="M60 140C44 146 40 160 46 168M140 140C156 146 160 160 154 168" stroke="#e7d9b4" strokeWidth="7" strokeLinecap="round" fill="none"/>
  </>,
  silentKnight: id => <>
    <Defs id={id} from="#33384a" to="#0a0b12" glow={5}/>
    <Shadow w={70}/>
    <path d="M150 196L162 40" stroke="#9aa6c0" strokeWidth="9" strokeLinecap="round"/><path d="M140 70H180" stroke="#5a6278" strokeWidth="7" strokeLinecap="round"/>
    <path d="M54 190L60 112H140L146 190Z" fill={`url(#${id('body')})`}/>
    <path d="M44 116C44 96 64 84 100 84S156 96 156 116Z" fill="#1c1f2b"/>
    <path d="M70 88C70 52 82 36 100 36S130 52 130 88Z" fill={`url(#${id('body')})`}/>
    <path d="M100 36V88" stroke="#4b5268" strokeWidth="3"/>
    <g filter={`url(#${id('glow')})`}><path d="M80 62L94 66M120 62L106 66" stroke="#6fd6ff" strokeWidth="5" strokeLinecap="round"/></g>
    <path d="M70 130H130M66 152H134" stroke="#4b5268" strokeWidth="3"/>
    <path d="M86 36C86 20 100 12 100 12S114 20 114 36" fill="#1c1f2b"/>
  </>,
  unspoken: id => <>
    <defs>
      <radialGradient id={id('void')} cx=".5" cy=".4" r=".6"><stop offset="0" stopColor="#3a1f6e"/><stop offset=".7" stopColor="#120826"/><stop offset="1" stopColor="#05020c"/></radialGradient>
      <filter id={id('glow')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <Shadow w={90} y={194}/>
    <g className="ea-float">
      <path d="M100 52C58 52 40 84 36 124C32 158 20 178 10 194H190C180 178 168 158 164 124C160 84 142 52 100 52Z" fill={`url(#${id('void')})`}/>
      {[[70, 130], [124, 150], [98, 172], [140, 112], [60, 168], [112, 120]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.6 : 2.4} fill="#e2d8ff" opacity=".85"/>)}
      <ellipse cx="100" cy="88" rx="30" ry="34" fill="#e9e3f5"/>
      <g filter={`url(#${id('glow')})`}><path d="M84 84L92 88M116 84L108 88" stroke="#7a2fd6" strokeWidth="5" strokeLinecap="round"/></g>
      <path d="M90 106H110" stroke="#c8bedc" strokeWidth="2"/>
      <path d="M66 58L74 26L88 46L100 16L112 46L126 26L134 58Z" fill="#e8c47a"/>
      <circle cx="100" cy="36" r="5" fill="#b77bff"/>
      <path d="M36 124C14 116 8 96 14 80M164 124C186 116 192 96 186 80" stroke="#2a1650" strokeWidth="10" strokeLinecap="round" fill="none"/>
    </g>
  </>,

  // ── Wave 3 ──
  imp: id => <>
    <Defs id={id} from="#f6ecd2" to="#b89a6a" glow={5}/>
    <Shadow w={40}/>
    <path d="M74 150L56 138M126 150L144 136" stroke="#b89a6a" strokeWidth="6" strokeLinecap="round"/>
    <path d="M74 188V110C74 104 80 100 86 102C92 96 108 96 114 102C120 100 126 104 126 110V188Z" fill={`url(#${id('body')})`}/>
    <path d="M82 104C82 124 86 132 86 144M118 106C118 120 116 128 118 136" stroke="#fffaf0" strokeWidth="5" strokeLinecap="round" opacity=".75"/>
    <path d="M74 176H126" stroke="#8a7550" strokeWidth="3" opacity=".5"/>
    <g filter={`url(#${id('glow')})`} className="ea-flicker">
      <path d="M100 22C116 44 132 56 128 80C124 98 112 104 100 104C86 104 72 96 72 80C72 64 86 56 90 40C94 50 98 56 98 62C106 52 104 38 100 22Z" fill="#ffb347"/>
      <path d="M100 56C108 66 112 74 110 84C108 92 104 96 100 96C94 96 90 92 90 84C90 76 96 70 98 64Z" fill="#fff1a8"/>
    </g>
    <circle cx="92" cy="80" r="4" fill="#5a2a0a"/><circle cx="108" cy="80" r="4" fill="#5a2a0a"/>
    <path d="M94 90Q100 95 106 90" stroke="#5a2a0a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </>,
  serpent: id => <>
    <Defs id={id} from="#e0697a" to="#7a2436"/>
    <Shadow w={66}/>
    <path d="M30 182C50 182 54 160 76 160C98 160 96 186 122 186C146 186 150 166 150 150C150 122 138 106 122 98" stroke={`url(#${id('body')})`} strokeWidth="20" fill="none" strokeLinecap="round"/>
    <path d="M30 182C50 182 54 160 76 160C98 160 96 186 122 186C146 186 150 166 150 150" stroke="#ffd1d8" strokeWidth="3" strokeDasharray="6 10" fill="none" opacity=".55"/>
    <path d="M96 72C96 58 108 50 122 52C138 54 146 66 142 80C138 94 120 100 106 94C98 90 96 82 96 72Z" fill="#c84358"/>
    <path d="M98 76C110 82 128 82 142 78" stroke="#7a2436" strokeWidth="3" fill="none"/>
    <Eyes x1={112} x2={130} y={66} r={4.5} color="#ffe36b" id={id('glow')}/>
    <path d="M98 84L84 90L90 82L82 80Z" fill="#ff8fa3"/>
    <path d="M30 182L18 166M30 182L12 186M30 182L22 197" stroke="#e8c47a" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="30" cy="182" r="6" fill="#e8c47a"/>
  </>,
  spider: id => <>
    <Defs id={id} from="#3a2f6e" to="#0f0b24"/>
    <path d="M100 4V70M20 26L100 72L180 26M8 88L100 72L192 88" stroke="#d9d2f0" strokeWidth="1.5" opacity=".3"/>
    <Shadow w={78}/>
    {[-1, 1].flatMap(s => [0, 1, 2, 3].map(i => <path key={`${s}${i}`} d={`M${100 + s * 26} ${116 + i * 9}Q${100 + s * (66 + i * 6)} ${68 + i * 18} ${100 + s * (78 + i * 5)} 188`} stroke="#1b1538" strokeWidth="6" fill="none" strokeLinecap="round"/>))}
    <ellipse cx="100" cy="134" rx="44" ry="38" fill={`url(#${id('body')})`}/>
    <ellipse cx="100" cy="134" rx="44" ry="38" fill={`url(#${id('sheen')})`}/>
    <path d="M86 120L100 134L114 120M86 150L100 134L114 150" stroke="#c39bff" strokeWidth="3" fill="none" opacity=".7"/>
    <circle cx="100" cy="94" r="20" fill="#1b1538"/>
    <g filter={`url(#${id('glow')})`}>{[[91, 90, 5], [109, 90, 5], [84, 98, 3], [116, 98, 3]].map(([x, y, r]) => <circle key={x} cx={x} cy={y} r={r} fill="#ff5d8f"/>)}</g>
    <path d="M94 108L90 116M106 108L110 116" stroke="#c39bff" strokeWidth="3" strokeLinecap="round"/>
  </>,
  jack: id => <>
    <Defs id={id} from="#e05a4f" to="#7a2a24"/>
    <Shadow w={52}/>
    <rect x="58" y="140" width="84" height="50" rx="6" fill="#5e4320" stroke="#c99a4e" strokeWidth="4"/>
    <path d="M58 154H142M100 154V190" stroke="#c99a4e" strokeWidth="3"/>
    <g className="ea-bob">
      <path d="M100 140C84 136 116 128 100 124C84 120 116 112 100 108C84 104 116 96 100 92" stroke="#c9d3df" strokeWidth="6" fill="none" strokeLinecap="round"/>
      <circle cx="100" cy="66" r="28" fill="#f3e6c8"/>
      <path d="M72 58C66 30 84 22 96 40L100 24L104 40C116 22 134 30 128 58Z" fill={`url(#${id('body')})`}/>
      <circle cx="70" cy="34" r="6" fill="#e8c47a"/><circle cx="130" cy="34" r="6" fill="#e8c47a"/><circle cx="100" cy="20" r="5" fill="#e8c47a"/>
      <Eyes x1={90} x2={110} y={68} r={4.5} color="#3a7bd5" id={id('glow')}/>
      <path d="M86 82Q100 94 114 82" stroke="#7a2a24" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <circle cx="80" cy="78" r="5" fill="#ff8fa3" opacity=".6"/><circle cx="120" cy="78" r="5" fill="#ff8fa3" opacity=".6"/>
    </g>
  </>,
  slick: id => <>
    <Defs id={id} from="#3a3a48" to="#06060a"/>
    <ellipse cx="100" cy="184" rx="80" ry="12" fill="#0b0b12"/>
    <path d="M34 184C40 160 56 156 62 136C70 108 78 80 100 80C122 80 130 108 138 136C144 156 160 160 166 184Z" fill={`url(#${id('body')})`}/>
    <path d="M74 120C88 112 112 112 126 120" stroke="#ffe36b" strokeWidth="3" fill="none" opacity=".35"/>
    <path d="M60 150C80 138 120 138 140 150" stroke="#7af0ff" strokeWidth="3" fill="none" opacity=".45"/>
    <path d="M66 162C84 152 116 152 134 162" stroke="#ff7ad9" strokeWidth="3" fill="none" opacity=".4"/>
    <path d="M86 88C90 84 96 82 100 82" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".5"/>
    <Eyes x1={88} x2={112} y={106} r={6} color="#ffb347" id={id('glow')}/>
    <circle cx="44" cy="176" r="6" fill="#1a1a24"/><circle cx="158" cy="172" r="5" fill="#1a1a24"/>
  </>,
  duelist: id => <>
    <Defs id={id} from="#d6a648" to="#6b4a1e"/>
    <Shadow w={56}/>
    <path d="M86 186L90 140M114 186L110 140" stroke="#6b4a1e" strokeWidth="8" strokeLinecap="round"/>
    <path d="M78 140L84 84H116L122 140Z" fill={`url(#${id('body')})`}/>
    <g className="ea-spin" style={{ transformOrigin: '100px 108px' }}><circle cx="100" cy="108" r="13" fill="none" stroke="#3a2a14" strokeWidth="5" strokeDasharray="5 4"/></g>
    <circle cx="100" cy="108" r="5" fill="#3a2a14"/>
    <path d="M84 92L60 120L70 128" stroke="#a87a38" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M116 92L146 112" stroke="#a87a38" strokeWidth="7" strokeLinecap="round"/>
    <path d="M146 112L192 58" stroke="#d9dde6" strokeWidth="3"/><path d="M138 106L154 120" stroke="#e8c47a" strokeWidth="5" strokeLinecap="round"/>
    <rect x="84" y="46" width="32" height="38" rx="10" fill={`url(#${id('body')})`}/>
    <rect x="88" y="58" width="24" height="8" rx="4" fill="#1a1208"/>
    <g filter={`url(#${id('glow')})`}><circle cx="95" cy="62" r="2.6" fill="#7af0ff"/><circle cx="105" cy="62" r="2.6" fill="#7af0ff"/></g>
    <path d="M90 46L100 28L110 46Z" fill="#c64b5a"/>
  </>,
  bell: id => <>
    <Defs id={id} from="#8e939e" to="#2f3240"/>
    <Shadow w={60}/>
    <path d="M100 22V40" stroke="#5d616c" strokeWidth="8" strokeLinecap="round"/>
    <circle cx="100" cy="180" r="11" fill="#5d616c"/>
    <path d="M100 40C66 40 58 70 56 110C54 140 44 156 34 168H166C156 156 146 140 144 110C142 70 134 40 100 40Z" fill={`url(#${id('body')})`}/>
    <path d="M100 40C66 40 58 70 56 110" fill="none" stroke="#c9d3df" strokeOpacity=".35" strokeWidth="4"/>
    <path d="M34 168H166" stroke="#c9d3df" strokeOpacity=".4" strokeWidth="4"/>
    <path d="M50 120C80 132 120 132 150 120L152 138C120 150 80 150 48 138Z" fill="#e9e3f5" opacity=".85"/>
    <path d="M58 129C80 138 120 138 142 129" stroke="#b9b3e8" strokeWidth="2" fill="none" opacity=".7"/>
    <Eyes x1={84} x2={116} y={92} r={6} color="#c39bff" id={id('glow')}/>
  </>,
  scribe: id => <>
    <Defs id={id} from="#6a7a9a" to="#1a2033" glow={4}/>
    <Shadow w={54}/>
    <g className="ea-float">
      <path d="M100 36C76 36 66 56 64 84C62 120 56 156 46 186H154C144 156 138 120 136 84C134 56 124 36 100 36Z" fill={`url(#${id('body')})`} opacity=".92"/>
      <path d="M78 66C78 52 88 46 100 46S122 52 122 66C122 82 112 92 100 92S78 82 78 66Z" fill="#0d1020"/>
      <Eyes x1={92} x2={108} y={68} r={4} color="#e2d8ff" id={id('glow')}/>
      <path d="M64 120C80 128 104 128 124 118" stroke="#9aa6c0" strokeWidth="8" strokeLinecap="round" fill="none"/>
      <path d="M120 120L162 84" stroke="#efe1c0" strokeWidth="3"/><path d="M170 68C156 72 146 82 142 96C152 92 162 84 170 68Z" fill="#f6ecd2"/>
    </g>
    <g opacity=".85">
      <g transform="rotate(-10 38 78)"><path d="M24 68H50V92H24Z" fill="#efe4c6"/><path d="M28 74H46M28 80H44M28 86H40" stroke="#b39a6e" strokeWidth="1.5"/></g>
      <g transform="rotate(8 166 140)"><path d="M154 128H178V150H154Z" fill="#efe4c6"/><path d="M158 134H174M158 140H172" stroke="#b39a6e" strokeWidth="1.5"/></g>
    </g>
  </>,
  choir: id => <>
    <Defs id={id} from="#efe8ff" to="#6b5fa8" glow={4}/>
    <Shadow w={84}/>
    {[[54, 114, 0.78], [146, 114, 0.78], [100, 96, 1]].map(([x, y, s]) => <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -60C-24 -60 -32 -36 -32 -10C-32 30 -38 60 -44 84H44C38 60 32 30 32 -10C32 -36 24 -60 0 -60Z" fill={`url(#${id('body')})`} opacity=".92"/>
      <ellipse cx="0" cy="-26" rx="18" ry="20" fill="#14112b"/>
      <g filter={`url(#${id('glow')})`}><circle cx="-7" cy="-30" r="3" fill="#e2d8ff"/><circle cx="7" cy="-30" r="3" fill="#e2d8ff"/></g>
      <ellipse cx="0" cy="-15" rx="5" ry="7" fill="#000" stroke="#c39bff" strokeWidth="1.5"/>
    </g>)}
    <path d="M28 44Q34 34 40 44M160 40Q166 30 172 40M94 14Q100 4 106 14" stroke="#e2d8ff" strokeWidth="2" fill="none" opacity=".6"/>
  </>,
  gate: id => <>
    <Defs id={id} from="#c9c2b0" to="#5a5446" glow={6}/>
    <Shadow w={86}/>
    <path d="M30 190V80C30 40 62 16 100 16S170 40 170 80V190H140V90C140 62 122 46 100 46S60 62 60 90V190Z" fill={`url(#${id('body')})`}/>
    <path d="M30 80C30 40 62 16 100 16S170 40 170 80" fill="none" stroke="#efe4c6" strokeOpacity=".5" strokeWidth="4"/>
    {[[45, 100], [45, 130], [45, 160], [155, 100], [155, 130], [155, 160]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x - 12} ${y}H${x + 12}`} stroke="#3c382e" strokeWidth="3"/>)}
    <path d="M60 190V90C60 62 78 46 100 46S140 62 140 90V190Z" fill="#0d0b1a"/>
    <g filter={`url(#${id('glow')})`}><circle cx="100" cy="98" r="14" fill="#e8c47a"/><path d="M94 106L100 140L106 106Z" fill="#e8c47a"/></g>
    <circle cx="100" cy="98" r="6" fill="#0d0b1a"/>
    <g filter={`url(#${id('glow')})`}><circle cx="78" cy="32" r="6" fill="#ff5d8f"/><circle cx="122" cy="32" r="6" fill="#ff5d8f"/></g>
    <path d="M60 154C80 164 120 164 140 154M60 174C80 184 120 184 140 174" stroke="#8a8270" strokeWidth="5" strokeDasharray="8 5" fill="none"/>
  </>,
  silence: id => <>
    <defs>
      <radialGradient id={id('void')} cx=".5" cy=".45" r=".55"><stop offset="0" stopColor="#000"/><stop offset=".7" stopColor="#120826"/><stop offset="1" stopColor="#3a1f6e" stopOpacity="0"/></radialGradient>
      <linearGradient id={id('page')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbf7ec"/><stop offset="1" stopColor="#a99cc9"/></linearGradient>
      <filter id={id('glow')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <Shadow w={92} y={194}/>
    <g className="ea-float">
      <path d="M30 84C10 70 6 46 18 30M170 84C190 70 194 46 182 30" stroke="#bdb2d6" strokeWidth="8" strokeLinecap="round" fill="none"/>
      <path d="M100 14C60 14 34 40 30 84C26 128 18 162 8 194H192C182 162 174 128 170 84C166 40 140 14 100 14Z" fill={`url(#${id('page')})`}/>
      <path d="M8 194L22 184L34 194L48 182L62 194L76 184L90 194L104 182L118 194L132 184L146 194L160 182L174 194H192" fill="#e9e3f5"/>
      <ellipse cx="100" cy="96" rx="46" ry="58" fill={`url(#${id('void')})`}/>
      <g filter={`url(#${id('glow')})`}><path d="M80 84L94 90M120 84L106 90" stroke="#b77bff" strokeWidth="5" strokeLinecap="round"/></g>
      {['A', 'e', 's', 'W', 'o', 'r'].map((ch, i) => <text key={ch} x={[44, 156, 52, 146, 72, 130][i]} y={[64, 72, 152, 142, 34, 38][i]} fontSize={[16, 14, 12, 15, 11, 12][i]} fontFamily="Georgia,serif" fill="#6b5fa8" opacity={0.3 + (i % 3) * 0.15}>{ch}</text>)}
    </g>
  </>,
};

export const ENEMY_ART = Object.keys(ART);

export function EnemyArt({ art, className = '' }) {
  const id = useIds();
  return <svg viewBox="0 0 200 200" className={`ea-creature ${className}`} aria-hidden="true">{(ART[art] || ART.inkling)(id)}</svg>;
}

// The Inkcaller: a hooded summoner with a spirit jar.
function CallerArt({ id }) {
  return <>
    <defs>
      <linearGradient id={id('robe')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5b3d8f"/><stop offset="1" stopColor="#1a1030"/></linearGradient>
      <radialGradient id={id('aura')} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#c39bff" stopOpacity=".7"/><stop offset="1" stopColor="#c39bff" stopOpacity="0"/></radialGradient>
      <filter id={id('glow')} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <ellipse cx="96" cy="210" rx="60" ry="8" fill="#000" opacity=".35"/>
    <circle cx="44" cy="150" r="38" fill={`url(#${id('aura')})`}/>
    <path d="M96 38C68 38 56 62 56 90C56 124 46 164 34 206H158C146 164 136 124 136 90C136 62 124 38 96 38Z" fill={`url(#${id('robe')})`}/>
    <path d="M96 38C68 38 56 62 56 90C56 124 46 164 34 206H60C64 168 70 128 76 100Z" fill="#120a22" opacity=".5"/>
    <path d="M70 98L96 120L122 98" stroke="#e8c47a" strokeWidth="4" fill="none"/>
    <path d="M96 120V204" stroke="#e8c47a" strokeWidth="3" opacity=".55"/>
    <path d="M66 70C66 48 80 36 96 36S126 48 126 70C126 86 114 96 96 96S66 86 66 70Z" fill="#120a22"/>
    <path d="M64 72C58 54 70 34 96 30C110 28 122 34 128 46" stroke="#7a5ab8" strokeWidth="4" fill="none" opacity=".6"/>
    <ellipse cx="96" cy="74" rx="15" ry="13" fill="#e9d5c4"/>
    <path d="M82 66C88 60 104 60 110 66" stroke="#120a22" strokeWidth="5" fill="none"/>
    <circle cx="90" cy="76" r="2.4" fill="#2a1a3a"/><circle cx="102" cy="76" r="2.4" fill="#2a1a3a"/>
    <path d="M93 83Q96 85 99 83" stroke="#a46a5a" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M72 132C60 136 54 142 50 150" stroke="#e9d5c4" strokeWidth="9" strokeLinecap="round" fill="none"/>
    <g className="ea-bob">
      <path d="M32 144H56V150C62 154 64 160 64 166C64 176 56 182 44 182S24 176 24 166C24 160 26 154 32 150Z" fill="#3a2a5e" stroke="#e8c47a" strokeWidth="2.5"/>
      <g filter={`url(#${id('glow')})`}><circle cx="44" cy="166" r="9" fill="#c39bff"/></g>
      <path d="M44 142C40 128 48 120 44 106" stroke="#c39bff" strokeWidth="3" fill="none" opacity=".7" strokeLinecap="round"/>
    </g>
    <path d="M122 120C140 126 150 140 152 156" stroke="#e9d5c4" strokeWidth="9" strokeLinecap="round" fill="none"/>
    <g filter={`url(#${id('glow')})`}><circle cx="154" cy="162" r="5" fill="#8ef3ff"/></g>
  </>;
}

// The Inkcaller's ink spirit. Its size grows a little with its stacks.
export function FamiliarArt({ className = '' }) {
  const id = useIds();
  return <svg viewBox="0 0 100 100" className={`ea-familiar-art ${className}`} aria-hidden="true">
    <defs>
      <radialGradient id={id('body')} cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#8a6ad0"/><stop offset="1" stopColor="#1a0f33"/></radialGradient>
      <filter id={id('glow')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <ellipse cx="50" cy="95" rx="22" ry="4" fill="#000" opacity=".3"/>
    <path d="M18 50C8 46 6 36 10 30M82 50C92 46 94 36 90 30" stroke="#3a2a5e" strokeWidth="5" strokeLinecap="round" fill="none"/>
    <path d="M50 12C70 12 80 28 80 48C80 66 74 78 64 86C62 80 58 80 56 86C54 80 46 80 44 86C42 80 38 80 36 86C26 78 20 66 20 48C20 28 30 12 50 12Z" fill={`url(#${id('body')})`}/>
    <path d="M34 26C40 18 52 16 60 20" stroke="#c39bff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".6"/>
    <g filter={`url(#${id('glow')})`}><ellipse cx="40" cy="46" rx="6" ry="7" fill="#e2d8ff"/><ellipse cx="60" cy="46" rx="6" ry="7" fill="#e2d8ff"/></g>
    <circle cx="41" cy="47" r="2.6" fill="#1a0f33"/><circle cx="61" cy="47" r="2.6" fill="#1a0f33"/>
    <path d="M44 60Q50 64 56 60" stroke="#e2d8ff" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </svg>;
}

export function HeroArt({ className = '', hero = 'scribe' }) {
  const id = useIds();
  if (hero === 'caller') return <svg viewBox="0 0 200 220" className={`ea-creature ea-hero-art is-caller ${className}`} aria-hidden="true"><CallerArt id={id}/></svg>;
  return <svg viewBox="0 0 200 220" className={`ea-creature ea-hero-art ${className}`} aria-hidden="true">
    <defs>
      <linearGradient id={id('cloak')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34508f"/><stop offset="1" stopColor="#121a3a"/></linearGradient>
      <radialGradient id={id('lamp')} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ffe9a8" stopOpacity=".9"/><stop offset="1" stopColor="#ffe9a8" stopOpacity="0"/></radialGradient>
      <filter id={id('glow')} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <ellipse cx="96" cy="210" rx="60" ry="8" fill="#000" opacity=".35"/>
    <circle cx="150" cy="128" r="40" fill={`url(#${id('lamp')})`}/>
    <path d="M96 40C70 40 58 62 58 88C58 120 50 160 38 206H154C142 160 134 120 134 88C134 62 122 40 96 40Z" fill={`url(#${id('cloak')})`}/>
    <path d="M58 88C58 120 50 160 38 206H64C66 170 70 130 76 100Z" fill="#0d1430" opacity=".5"/>
    <path d="M72 96C82 104 110 104 120 96L124 108C110 118 82 118 68 108Z" fill="#e8c47a"/>
    <path d="M118 108L132 150L120 152L112 112Z" fill="#d4ae5e"/>
    <path d="M70 70C70 50 82 40 96 40S122 50 122 70C122 84 112 92 96 92S70 84 70 70Z" fill="#0b1026"/>
    <ellipse cx="96" cy="74" rx="16" ry="14" fill="#f2d9bf"/>
    <path d="M80 66C86 58 106 56 114 66" stroke="#0b1026" strokeWidth="6" fill="none"/>
    <circle cx="90" cy="76" r="2.4" fill="#22263a"/><circle cx="102" cy="76" r="2.4" fill="#22263a"/>
    <path d="M93 83Q96 85 99 83" stroke="#a46a5a" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M66 140C88 134 104 138 120 128" stroke="#f2d9bf" strokeWidth="9" strokeLinecap="round" fill="none"/>
    <g className="ea-bob">
      <path d="M118 114L170 66" stroke="#efe1c0" strokeWidth="3"/>
      <path d="M176 52C160 56 148 66 144 82C156 78 168 70 176 52Z" fill="#f6ecd2"/>
      <g filter={`url(#${id('glow')})`}><circle cx="118" cy="114" r="5" fill="#8ef3ff"/></g>
    </g>
    <g className="ea-orbit" style={{ transformOrigin: '96px 120px' }}>
      <g transform="translate(28 128) rotate(-12)"><path d="M0 0C-10-6-22-6-30-4V18C-22 16-10 16 0 22C10 16 22 16 30 18V-4C22-6 10-6 0 0Z" fill="#6a3c8f"/><path d="M0 3C-8-1-18-1-26 1V16C-18 14-8 14 0 18C8 14 18 14 26 16V1C18-1 8-1 0 3Z" fill="#f4ead2"/><path d="M0 3V18" stroke="#b39a6e"/></g>
    </g>
  </svg>;
}

export function PotionArt({ color = '#ff6a3d', size = 34, empty = false }) {
  const id = useIds();
  return <svg viewBox="0 0 40 48" width={size} height={size * 1.2} aria-hidden="true" className="ea-potion-art">
    <defs><linearGradient id={id('liq')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".95"/><stop offset="1" stopColor={color} stopOpacity=".6"/></linearGradient></defs>
    <path d="M15 4H25V14C33 17 37 23 37 30C37 40 29 46 20 46S3 40 3 30C3 23 7 17 15 14Z" fill={empty ? 'none' : '#ffffff14'} stroke={empty ? '#ffffff40' : '#f3e6c8'} strokeWidth="2" strokeDasharray={empty ? '3 3' : undefined}/>
    {!empty && <path d="M5.5 28C10 26 15 30 20 28S30 26 34.5 28C35 38 28 43.5 20 43.5S5 38 5.5 28Z" fill={`url(#${id('liq')})`}/>}
    {!empty && <><rect x="14" y="1" width="12" height="5" rx="2" fill="#a8763e"/><circle cx="13" cy="32" r="2" fill="#fff" opacity=".6"/></>}
  </svg>;
}

export function Backdrop({ act = 1 }) {
  const id = useIds();
  const palettes = {
    1: ['#1b2048', '#0b0d1f', '#2b3266'],
    2: ['#3a2a1c', '#120c08', '#5e4320'],
    3: ['#2a1146', '#07040f', '#451f6e'],
    4: ['#2e2540', '#08060e', '#e8c47a'],
  };
  const [top, bottom, accent] = palettes[act] || palettes[1];
  const glow = { 2: '#ffb45c', 3: '#b77bff', 4: '#ffe7a6' }[act] || '#7ea2ff';
  return <svg className="ea-backdrop" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top}/><stop offset="1" stopColor={bottom}/></linearGradient>
      <radialGradient id={id('light')} cx=".5" cy=".35" r=".55"><stop offset="0" stopColor={glow} stopOpacity=".28"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient>
    </defs>
    <rect width="1200" height="600" fill={`url(#${id('sky')})`}/>
    <rect width="1200" height="600" fill={`url(#${id('light')})`}/>
    {act === 1 && <g opacity=".55">
      {[0, 1, 2, 3, 4].map(i => <g key={i} transform={`translate(${i < 2 ? i * 120 : 840 + (i - 2) * 120} 60)`}>
        <rect width="110" height="460" fill={accent}/>
        {[0, 1, 2, 3, 4, 5].map(row => <g key={row} transform={`translate(8 ${16 + row * 74})`}>
          <rect y="58" width="94" height="6" fill="#0b0d1f"/>
          {Array.from({ length: 7 }, (_, b) => <rect key={b} x={b * 13} y={14 + ((b * 7 + row * 3 + i) % 4) * 4} width="11" height={44 - ((b * 7 + row * 3 + i) % 4) * 4} rx="1.5" fill={['#3a4a8a', '#5a3a6e', '#2f5a6a', '#6a5a3a'][(b + row + i) % 4]}/>)}
        </g>)}
      </g>)}
      <path d="M360 600V200Q600 40 840 200V600" fill="none" stroke={accent} strokeWidth="26"/>
    </g>}
    {act === 2 && <g opacity=".5">
      {[[180, 160, 120], [1020, 120, 150], [600, 60, 90], [880, 420, 110], [320, 460, 90]].map(([x, y, r], i) => <g key={i} className={i % 2 ? 'ea-spin-slow' : 'ea-spin-rev'} style={{ transformOrigin: `${x}px ${y}px` }}>
        <circle cx={x} cy={y} r={r} fill="none" stroke={accent} strokeWidth={r * 0.22} strokeDasharray={`${r * 0.28} ${r * 0.2}`}/>
        <circle cx={x} cy={y} r={r * 0.62} fill="none" stroke={accent} strokeWidth="10"/>
      </g>)}
      <path d="M0 600V420H140V340H260V420H420V600ZM780 600V400H900V300H1020V400H1200V600Z" fill="#1b130c"/>
    </g>}
    {act === 3 && <g>
      {Array.from({ length: 60 }, (_, i) => <circle key={i} cx={(i * 197) % 1200} cy={(i * 89) % 420} r={i % 5 === 0 ? 2 : 1} fill="#e2d8ff" opacity={0.25 + (i % 4) * 0.15}/>)}
      <g opacity=".5" fill={accent}>
        <path d="M80 600V260L120 230L160 260V600Z"/><path d="M220 600V340L250 320L280 340V600Z"/>
        <path d="M1040 600V250L1080 220L1120 250V600Z"/><path d="M920 600V360L948 340L976 360V600Z"/>
        <path d="M520 600V300C520 230 680 230 680 300V600Z" opacity=".55"/>
      </g>
    </g>}
    {act === 4 && <g>
      <path d="M600 0L360 600H840Z" fill="#fff6dc" opacity=".05"/>
      <path d="M600 0L520 600H680Z" fill="#fff6dc" opacity=".07"/>
      {Array.from({ length: 16 }, (_, i) => {
        const x = (i * 173) % 1150, y = (i * 97) % 430;
        return <rect key={i} x={x} y={y} width="34" height="44" rx="3" fill="#f6ecd2" opacity={0.07 + (i % 4) * 0.05} transform={`rotate(${((i * 37) % 60) - 30} ${x + 17} ${y + 22})`}/>;
      })}
    </g>}
    <rect y="470" width="1200" height="130" fill="#000" opacity=".35"/>
    <path d="M0 470H1200" stroke="#ffffff" strokeOpacity=".08" strokeWidth="2"/>
  </svg>;
}

export function SceneArt({ kind }) {
  // Large illustration for rooms (rest, shop, treasure, events).
  const id = useIds();
  return <svg viewBox="0 0 240 180" className="ea-scene-art" aria-hidden="true">
    <defs>
      <radialGradient id={id('halo')} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ffd98a" stopOpacity=".55"/><stop offset="1" stopColor="#ffd98a" stopOpacity="0"/></radialGradient>
      <filter id={id('glow')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="120" cy="96" r="80" fill={`url(#${id('halo')})`}/>
    {kind === 'rest' && <g>
      <path d="M60 170H180" stroke="#6b4a2a" strokeWidth="6" strokeLinecap="round"/>
      <path d="M96 60H144L152 140H88Z" fill="#2a2440" stroke="#e8c47a" strokeWidth="4"/>
      <path d="M104 50H136M120 30V50" stroke="#e8c47a" strokeWidth="4" strokeLinecap="round"/>
      <g filter={`url(#${id('glow')})`} className="ea-flicker"><path d="M120 76C128 90 136 98 134 112C132 124 126 128 120 128C112 128 106 122 106 112C106 102 114 96 116 86C118 92 120 96 120 100C124 94 122 84 120 76Z" fill="#ffc35c"/></g>
      <path d="M150 166C170 150 190 156 196 166M40 166C52 154 70 154 80 166" stroke="#3a4a8a" strokeWidth="10" strokeLinecap="round" fill="none"/>
    </g>}
    {kind === 'shop' && <g>
      <path d="M40 176V120H200V176" fill="#2a1d14" stroke="#e8c47a" strokeWidth="3"/>
      <path d="M86 120C86 70 100 50 120 50S154 70 154 120Z" fill="#30245a"/>
      <path d="M96 66C96 50 106 40 120 40S144 50 144 66C144 78 134 86 120 86S96 78 96 66Z" fill="#14102a"/>
      <g filter={`url(#${id('glow')})`}><circle cx="112" cy="66" r="3" fill="#ffd36b"/><circle cx="128" cy="66" r="3" fill="#ffd36b"/></g>
      <path d="M100 32L120 8L140 32Z" fill="#30245a"/>
      {[[60, 108, '#ff6a3d'], [76, 104, '#6fe0b4'], [168, 106, '#9b7bff'], [184, 108, '#ffd35c']].map(([x, y, c]) => <g key={x}><path d={`M${x - 6} ${y - 14}H${x + 6}V${y - 6}C${x + 12} ${y - 4} ${x + 12} ${y + 10} ${x} ${y + 12}C${x - 12} ${y + 10} ${x - 12} ${y - 4} ${x - 6} ${y - 6}Z`} fill={c} opacity=".85"/></g>)}
      <circle cx="120" cy="150" r="10" fill="#e8c47a"/><circle cx="104" cy="156" r="8" fill="#c99a4e"/><circle cx="136" cy="156" r="8" fill="#c99a4e"/>
    </g>}
    {kind === 'treasure' && <g>
      <path d="M50 100H190V166H50Z" fill="#5b3a1c" stroke="#e8c47a" strokeWidth="4"/>
      <path d="M50 100C50 66 80 56 120 56S190 66 190 100Z" fill="#7a4e24" stroke="#e8c47a" strokeWidth="4"/>
      <path d="M50 120H190M120 56V166" stroke="#e8c47a" strokeWidth="4"/>
      <rect x="108" y="104" width="24" height="28" rx="4" fill="#e8c47a"/><circle cx="120" cy="116" r="4" fill="#2a1a08"/>
    </g>}
    {!['rest', 'shop', 'treasure'].includes(kind) && <g filter={`url(#${id('glow')})`}>
      <circle cx="120" cy="96" r="54" fill="none" stroke="#e8c47a" strokeWidth="2" strokeDasharray="4 6" className="ea-spin-slow" style={{ transformOrigin: '120px 96px' }}/>
    </g>}
  </svg>;
}
