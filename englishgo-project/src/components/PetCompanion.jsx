import { useId } from 'react';
import PixelPet from './PixelPet.jsx';
import { PET_APPEARANCES, getPetAppearance } from '../data/petAppearance.js';

// Portraits share the live model's species details and warm plush palette.
export default function PetCompanion({petId,stage='baby',size=132}) {
  const id=useId();
  if(stage==='egg'){
    const shades=['#d8e7c6','#f5d4aa','#ddcfeb','#c7dfdf'];
    const tint=shades[[...String(petId||'')].reduce((n,char)=>n+char.charCodeAt(0),0)%shades.length];
    return <svg className="pet-companion pet-egg-portrait" width={size} height={size} viewBox="0 0 180 180" role="img" data-stage={stage} aria-label={`${petId} egg`}>
      <defs><linearGradient id={id} x2=".7" y2="1"><stop stopColor="#fffbed"/><stop offset="1" stopColor={tint}/></linearGradient></defs>
      <ellipse cx="90" cy="160" rx="54" ry="10" fill="#46664b20"/>
      <path d="M37 107C37 61 65 17 90 17s53 44 53 90c0 65-106 65-106 0Z" fill={`url(#${id})`} stroke="#65765d" strokeWidth="3"/>
      <ellipse cx="65" cy="66" rx="10" ry="17" fill="#fffdf5" opacity=".85" transform="rotate(25 65 66)"/>
      <path d="m41 111 16-12 18 14 17-13 18 13 18-13 13 11" fill="none" stroke="#8eac7c" strokeWidth="6" strokeLinejoin="round" opacity=".6"/>
      <g fill="#8eac7c" opacity=".55"><circle cx="103" cy="65" r="8"/><circle cx="71" cy="132" r="7"/><circle cx="116" cy="130" r="5"/></g>
      <path d="m149 44 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#dfba71"/>
    </svg>;
  }
  if(!PET_APPEARANCES[petId])return <PixelPet {...{petId,stage,size}} animate={false}/>;
  const design=getPetAppearance(petId),{coat,shade,cream,accent,shape}=design,bird=shape==='bird',bunny=shape==='rabbit',cat=shape==='cat'||shape==='fox',dog=shape==='dog',frog=shape==='frog',aquatic=['seal','whale'].includes(shape),panda=design.patches;
  return <svg className="pet-companion" width={size} height={size} viewBox="0 0 180 180" role="img" data-stage={stage} aria-label={`${petId} ${stage}`}>
    <defs><linearGradient id={id} x1="0" y1="0" x2=".8" y2="1"><stop stopColor={coat}/><stop offset="1" stopColor={shade}/></linearGradient></defs>
    <ellipse cx="90" cy="163" rx="51" ry="9" fill="#244b3224"/>
    <g stroke="#766252" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      {design.fluffyTail&&<path d="M119 145c57 8 60-61 33-63-22-2-11 22-26 31 8-25 20-13 14 2-4 10-17 12-26 13" fill={shade}/>}
      {design.wings&&<><path d="M57 128C22 118 11 79 27 86l12 13C20 70 42 76 56 102" fill={accent}/><path d="M123 128c35-10 46-49 30-42l-12 13c19-29-3-23-17 3" fill={accent}/></>}
      {aquatic&&<path d="M118 142c28 5 26-23 36-18l9 10 10-8c11 17-25 39-44 29" fill={shade}/>}
      {design.shell&&<ellipse cx="90" cy="123" rx="53" ry="34" fill={shade}/>}
      {shape==='lion'&&<path d="M38 68 49 48 70 45 90 34l21 11 22 3 10 22 14 20-11 23-9 16-26 4-21 8-23-10-23-2-8-21-12-18Z" fill={shade}/>}
      {bunny?<><path d="M59 80Q29 1 54 8q20 10 21 68" fill={coat}/><path d="M106 74q2-70 23-65 17 9-7 73" fill={coat}/><path d="M60 62Q44 16 54 22q10 8 12 40m46 0q8-45 15-41 7 6-9 41" fill="#eebbc0" stroke="none"/></>:bird?(design.tuft||design.crest?<path d="M82 57q-19-27 0-22 0-23 11-18 10 8 1 29 18-18 24-9 4 10-19 20" fill={design.crest?accent:coat}/>:null):cat?<><path d="m43 86 1-49 38 25m21 0 33-26 1 49" fill={coat}/><path d="m53 59 2 19 17-12m42 2 15-11-1 24" stroke="#d29c92" strokeWidth="7"/></>:['seal','whale','turtle'].includes(shape)?null:frog?<><circle cx="61" cy="65" r="23" fill={coat}/><circle cx="119" cy="65" r="23" fill={coat}/></>:<><ellipse cx="45" cy="69" rx={dog?18:shape==='sheep'?24:design.bigEars?27:21} ry={dog?34:shape==='sheep'?10:design.bigEars?27:20} fill={panda?'#5b5b52':shade} transform="rotate(18 45 69)"/><ellipse cx="136" cy="69" rx={dog?18:shape==='sheep'?24:design.bigEars?27:21} ry={dog?34:shape==='sheep'?10:design.bigEars?27:20} fill={panda?'#5b5b52':shade} transform="rotate(-18 136 69)"/>{!dog&&shape!=='sheep'&&<><circle cx="46" cy="69" r="13" fill={panda?'#74726a':'#e2b4a9'} stroke="none"/><circle cx="135" cy="69" r="13" fill={panda?'#74726a':'#e2b4a9'} stroke="none"/></>}</>}
      <ellipse cx="90" cy="128" rx="43" ry="32" fill={`url(#${id})`}/><ellipse cx="90" cy="135" rx="25" ry="20" fill={cream} stroke="none"/>
      {!(bird&&design.wings)&&<><ellipse cx="52" cy="131" rx={aquatic?23:12} ry={aquatic?9:21} fill={panda?'#676255':bird?shade:coat} transform="rotate(26 52 131)"/><ellipse cx="129" cy="128" rx={aquatic?23:12} ry={aquatic?9:22} fill={panda?'#676255':bird?shade:coat} transform="rotate(-35 129 128)"/></>}
      {!aquatic&&<><ellipse cx="67" cy="158" rx="19" ry="10" fill={bird?'#dfa35c':coat}/><ellipse cx="115" cy="158" rx="19" ry="10" fill={bird?'#dfa35c':coat}/></>}
      <path d="M40 83q4-37 50-37t50 37q11 37-50 39T40 83" fill={`url(#${id})`}/>
      {design.faceDisk&&<><ellipse cx="69" cy="85" rx="24" ry="29" fill={cream} stroke="none"/><ellipse cx="111" cy="85" rx="24" ry="29" fill={cream} stroke="none"/></>}
      {design.bib&&<ellipse cx="90" cy="88" rx="38" ry="32" fill={cream} stroke="none"/>}
      {(design.cheekPatches||shape==='fox')&&<><ellipse cx="63" cy="101" rx="20" ry="14" fill={cream} stroke="none"/><ellipse cx="117" cy="101" rx="20" ry="14" fill={cream} stroke="none"/></>}
      {design.stripes&&<path d="m80 53 3 13m8-15v14m11-12-3 13m-51 14 11 5m-12 5 10 3m70-13-11 5m12 5-10 3" stroke={shade} strokeWidth="4"/>}
      {design.wool&&<g fill={cream}>{[46,61,78,96,114,131].map((x,i)=><circle key={x} cx={x} cy={57-Math.sin(i/5*Math.PI)*13} r="12"/>)}</g>}
      {design.horn&&<path d="m82 47 8-35 9 35Z" fill={accent}/>}
      {(design.horns||design.antlers)&&<path d="m63 53-6-24-7-8m7 15-13-4m73 21 6-24 7-8m-7 15 13-4" stroke={accent} strokeWidth="6" fill="none"/>}
      {design.mane&&shape==='horse'&&<path d="M65 55q18-29 38-14 29 16 3 31 3-18-16-16 2 18-15 19 4-11-10-20Z" fill={shade}/>}
      {design.spots&&<g fill={cream} stroke="none"><circle cx="54" cy="79" r="3"/><circle cx="60" cy="72" r="3"/><circle cx="126" cy="79" r="3"/><circle cx="120" cy="72" r="3"/></g>}
      {panda&&<><ellipse cx="67" cy="84" rx="14" ry="17" fill="#5c5c51" stroke="none" transform="rotate(20 67 84)"/><ellipse cx="113" cy="84" rx="14" ry="17" fill="#5c5c51" stroke="none" transform="rotate(-20 113 84)"/></>}
      <ellipse cx="55" cy="100" rx="10" ry="5" fill="#e9a8a4" opacity=".65" stroke="none"/><ellipse cx="125" cy="100" rx="10" ry="5" fill="#e9a8a4" opacity=".65" stroke="none"/>
      <g fill="#36343c" stroke="none"><ellipse cx="68" cy={frog?66:85} rx="7" ry="9"/><ellipse cx="112" cy={frog?66:85} rx="7" ry="9"/></g><g fill="#fffaf0" stroke="none"><circle cx="66" cy={frog?62:81} r="2.6"/><circle cx="110" cy={frog?62:81} r="2.6"/><circle cx="71" cy={frog?70:89} r="1.2"/><circle cx="115" cy={frog?70:89} r="1.2"/></g>
      {bird?(design.bill?<ellipse cx="90" cy="100" rx="13" ry="6" fill={accent}/>:<path d="m80 99 10-7 11 7-11 7z" fill={accent}/>):petId==='piggy'?<><ellipse cx="90" cy="101" rx="16" ry="11" fill="#e0a6ae"/><path d="M84 99v3m12-3v3"/></>:design.bigNose?<ellipse cx="90" cy="101" rx="10" ry="13" fill={shade}/>:frog||['whale','turtle'].includes(shape)?<path d="M77 98q13 11 26 0" fill="none"/>:<><path d="m85 96 5 4 6-4" fill="#b38177"/><path d="M90 100q0 9-8 6m8-6q0 9 8 6" fill="none"/></>}
      {cat&&<path d="m43 95 15 4m-16 5 15 1m66-6 14-4m-14 10 14-1" stroke="#a38466" strokeWidth="2"/>}
      {design.shell&&<path d="M90 118v34m-22-21 22 4 22-4m-22 10-20-3m20 3 20-3" stroke={accent} strokeWidth="1.5" fill="none"/>}
      {design.shellToy&&<path d="M73 137q-5-29 17-13 24-17 18 13l-17 9z" fill={accent}/>}
      {design.moon&&<path d="M99 52a12 12 0 1 0 4 17 11 11 0 0 1-4-17" fill={accent} stroke="none"/>}
      {design.star&&<path d="m90 51 3 7 8 1-6 5 1 8-6-4-6 4 1-8-6-5 8-1Z" fill={accent} stroke="none"/>}
      {stage!=='baby'&&<><path d="M60 117q30 10 60 0l-3 7q-27 9-54-1z" fill={stage==='evolved'?'#d0a758':accent}/><path d="M71 123q20 5 38 0l-15 21q-4 4-8 0z" fill={stage==='evolved'?'#d0a758':accent}/></>}
      {stage==='evolved'&&<path d="m90 128 2 5 6 1-4 4 1 5-5-2-5 2 1-5-4-4 6-1Z" fill="#fff1c2" stroke="none"/>}
    </g>
    {stage==='evolved'&&<path d="m144 27 4 11 12 2-10 7 2 11-10-6-10 6 2-11-9-7 12-2z" fill="#f2d88c" stroke="#bc9755" strokeWidth="2"/>}
  </svg>;
}
