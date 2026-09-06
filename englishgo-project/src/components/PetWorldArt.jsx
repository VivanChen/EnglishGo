import { useId } from 'react';
import PetCompanion from './PetCompanion.jsx';
import { getPetJourney } from '../data/petJourney.js';

export function PetLandscape({theme='meadow'}) {
  const id=useId(),night=theme==='camp',pond=theme==='pond';
  return <svg className="pet-landscape" viewBox="0 0 900 430" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id={id} x2="0" y2="1"><stop stopColor={night?'#263b62':'#c8e9e9'}/><stop offset="1" stopColor={night?'#7799a6':'#f6f4db'}/></linearGradient></defs>
    <path fill={`url(#${id})`} d="M0 0h900v430H0z"/>
    {night?<g fill="#fff1bc"><path d="M720 35a33 33 0 1 0 38 44 31 31 0 0 1-38-44"/>{[70,175,310,440,560,665,818,860].map((x,i)=><path key={x} d={`M${x} ${35+i%3*27}v10m-5-5h10`} stroke="#fff4ce" strokeWidth="2"/>)}</g>:<circle cx="718" cy="81" r="42" fill="#f9d788"/>}
    <g fill={night?'#a9bdc6':'#fffdf1'} opacity=".8"><path d="M72 91c-6-24 21-38 37-22 14-26 53-13 49 12 25-6 40 23 21 28H80c-15 0-20-13-8-18"/><path d="M393 61c-4-19 17-30 30-17 14-20 42-10 38 11 21-5 34 19 17 24h-75c-12 0-17-12-10-18"/></g>
    <path d="M0 261Q160 91 330 246T650 230Q800 112 900 216v214H0" fill={night?'#668c87':'#a7c9a2'}/>
    <path d="M0 316Q260 191 510 285t390-18v163H0" fill={night?'#4e7972':'#7bab81'}/>
    <path d="M0 350Q260 280 450 350t450-17v97H0" fill={night?'#355f60':'#cee0a4'}/>
    <path d="M326 430q-46-70 123-97t-51-46q-16-5-38-4 120 29 142 47 55 42-63 100" fill={night?'#a7a180':'#f0dbb1'}/>
    <g stroke={night?'#294e4d':'#659369'} strokeWidth="9" strokeLinecap="round"><path d="M102 318V173m686 139V142"/></g>
    <g fill={night?'#3b716a':'#5e966c'}><ellipse cx="102" cy="199" rx="58" ry="73"/><ellipse cx="788" cy="176" rx="67" ry="84"/></g>
    <g fill={night?'#56877a':'#8db67b'}><ellipse cx="89" cy="177" rx="40" ry="50"/><ellipse cx="771" cy="148" rx="48" ry="54"/></g>
    {pond?<g><ellipse cx="650" cy="361" rx="160" ry="44" fill="#7bb9bc"/><path d="M535 353h75m34 30h100m-35-39h49" stroke="#c3e4d8" strokeWidth="4" strokeLinecap="round"/><path d="M563 368a23 10 0 1 1-3-10l-13 11" fill="#548964"/><path d="m568 354-8-8-7 10 9 2z" fill="#f2bdc4"/></g>:night?<g><path d="m588 310 71-85 78 85z" fill="#efba74"/><path d="m588 310 71-85-1 85z" fill="#d89961"/><path d="m629 310 31-55 30 55" fill="#765650"/><path d="m627 371 41-11m-39 0 37 13" stroke="#bc916b" strokeWidth="7" strokeLinecap="round"/><path d="M641 360q-13-15 6-38 1 17 11 18 8 12-4 22" fill="#f6c77e"/></g>:<g><path d="m606 332 97-1 26 54-129 1z" fill="#f2c7ac"/><path d="m615 348h96m-8-17 12 53m-59-52-3 53" stroke="#fff2d3" strokeWidth="5"/><path d="M646 343v-13q18-19 35 0v14" fill="#bd906c" stroke="#947354" strokeWidth="4"/><ellipse cx="663" cy="344" rx="21" ry="6" fill="#e0b585"/></g>}
    <g fill={night?'#cfbb91':'#f9e7ab'}>{[157,205,738,813,75,520].map((x,i)=><g key={x} transform={`translate(${x} ${347+i%3*18})`}><path d="M0 0v12" stroke="#649375" strokeWidth="3"/><circle cx="0" cy="0" r="5"/><circle cx="-5" cy="3" r="4"/><circle cx="5" cy="3" r="4"/></g>)}</g>
    <g fill="none" stroke={night?'#7e9f88':'#8bb178'} strokeWidth="3" strokeLinecap="round"><path d="m62 400-5-7m5 7 6-10m694 17-5-8m5 8 6-12m-522 8-4-6m4 6 4-7"/></g>
  </svg>;
}

export function PetHabitatScene({pets=[],theme,caption,celebrate=false,compact=false}) {
  const selected=theme||getPetJourney(pets[0]).habitat;
  return <div className={`pet-habitat ${compact?'is-compact':''} ${celebrate?'is-celebrating':''}`} data-theme={selected}>
    <PetLandscape theme={selected}/>
    {caption&&<div className="pet-scene-caption">{caption}</div>}
    <div className="pet-scene-friends">{pets.slice(0,3).map((pet,i)=><div className="pet-scene-friend" key={pet.petId||i}><PetCompanion petId={pet.petId||'bunny'} stage={(pet.level||1)>=10?'evolved':(pet.level||1)>=4?'adult':'baby'} size={compact?90:180}/>{pet.nickname&&<span>{pet.nickname}</span>}</div>)}</div>
    {celebrate&&<div className="pet-scene-sparkles" aria-hidden="true">✦<span>♡</span>✧</div>}
  </div>;
}

export function GachaMachineArt({rolling=false}) {
  const id=useId();
  return <svg className={`pet-gacha-art ${rolling?'is-rolling':''}`} viewBox="0 0 420 420" role="img" aria-label="森林裡的彩蛋扭蛋機">
    <defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="#effbfa"/><stop offset="1" stopColor="#bde1d7"/></linearGradient></defs>
    <ellipse cx="213" cy="386" rx="126" ry="16" fill="#d6ddbb"/>
    <path d="M107 132q-9-92 102-92t108 92v107H107z" fill={`url(#${id})`} stroke="#4e7a66" strokeWidth="9"/>
    <g className="pet-machine-eggs">{[[150,173,'#f5cf7d',-20],[208,195,'#eabbbb',15],[270,174,'#aac6e2',30],[183,124,'#c6b8db',-10],[248,115,'#edddac',20]].map(([x,y,fill,rotate])=><g key={x} transform={`translate(${x} ${y}) rotate(${rotate})`}><path d="M-26 0c0-25 11-44 26-44S26-25 26 0C26 34-26 34-26 0" fill={fill} stroke="#fffaf0" strokeWidth="3"/><path d="m-12-4 9-5 8 8 12-8" fill="none" stroke="#fffaf0" strokeWidth="4" strokeLinecap="round"/></g>)}</g>
    <path d="M88 231h244l-17 130q-2 17-22 17H126q-22 0-23-18z" fill="#669a7e" stroke="#4e7a66" strokeWidth="7"/>
    <path d="M84 228q124-19 254 0v23H84z" fill="#f2d695" stroke="#4e7a66" strokeWidth="6"/>
    <rect x="164" y="262" width="92" height="83" rx="24" fill="#416a57"/>
    <path d="M176 318q35-22 68 0v16h-68z" fill="#e6c794"/>
    <circle cx="210" cy="281" r="22" fill="#faf0d6" stroke="#d8bf86" strokeWidth="4"/>
    <rect className="pet-machine-handle" x="194" y="276" width="32" height="10" rx="5" fill="#b58a59"/>
    <rect x="139" y="35" width="143" height="40" rx="17" fill="#faf0d6" stroke="#4e7a66" strokeWidth="5"/>
    <g fill="#b48755"><circle cx="198" cy="52" r="4"/><circle cx="213" cy="50" r="4"/><circle cx="226" cy="53" r="4"/><ellipse cx="212" cy="61" rx="10" ry="6"/></g>
    <g fill="#9fbc88"><path d="M88 368q-36-51-50-21 28 0 39 30-42-28-42 2 27-8 53 12z"/><path d="M337 367q34-57 49-26-27 3-37 33 38-23 42 3-33-8-54 15z"/></g>
    <g fill="#e8bf77"><path d="m53 104 4-11 4 11 11 4-11 4-4 11-4-11-11-4z"/><path d="m358 191 4-11 4 11 11 4-11 4-4 11-4-11-11-4z"/></g>
  </svg>;
}
