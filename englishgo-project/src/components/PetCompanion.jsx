import { useId } from 'react';
import PixelPet from './PixelPet.jsx';

// Soft portraits for familiar animals. Unmapped species retain their authored sprite.
const coats={bunny:['#fff9e5','#e2cda9'],chick:['#ffe89d','#e4b752'],puppy:['#dfb78a','#ad7951'],kitty:['#f4d7b0','#c2966e'],piggy:['#f4ccd0','#cc939e'],froggy:['#aed1a1','#6e9e78'],hamster:['#efc698','#bd9468'],panda:['#f5f0df','#c8c6b6'],koala:['#c6d2d0','#8ba19e']};
export default function PetCompanion({petId,stage='baby',size=132}) {
  const id=useId();if(!coats[petId]||stage==='egg')return <PixelPet {...{petId,stage,size}} animate={false}/>;
  const [coat,shade]=coats[petId],bird=petId==='chick',bunny=petId==='bunny',cat=petId==='kitty',dog=petId==='puppy',frog=petId==='froggy',panda=petId==='panda';
  return <svg className="pet-companion" width={size} height={size} viewBox="0 0 180 180" role="img" aria-label={`${petId} ${stage}`}>
    <defs><linearGradient id={id} x1="0" y1="0" x2=".8" y2="1"><stop stopColor={coat}/><stop offset="1" stopColor={shade}/></linearGradient></defs>
    <ellipse cx="90" cy="163" rx="51" ry="9" fill="#244b3224"/>
    <g stroke="#605646" strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round">
      {bunny?<><path d="M59 80Q29 1 54 8q20 10 21 68" fill={coat}/><path d="M106 74q2-70 23-65 17 9-7 73" fill={coat}/><path d="M60 62Q44 16 54 22q10 8 12 40m46 0q8-45 15-41 7 6-9 41" fill="#eebbc0" stroke="none"/></>:bird?<path d="M82 57q-19-27 0-22 0-23 11-18 10 8 1 29 18-18 24-9 4 10-19 20" fill={coat}/>:cat?<><path d="m43 86 1-49 38 25m21 0 33-26 1 49" fill={coat}/><path d="m53 59 2 19 17-12m42 2 15-11-1 24" stroke="#d29c92" strokeWidth="7"/></>:frog?<><circle cx="61" cy="65" r="23" fill={coat}/><circle cx="119" cy="65" r="23" fill={coat}/></>:<><ellipse cx="45" cy="69" rx={dog?18:23} ry={dog?34:23} fill={panda?'#5b5b52':shade} transform="rotate(18 45 69)"/><ellipse cx="136" cy="69" rx={dog?18:23} ry={dog?34:23} fill={panda?'#5b5b52':shade} transform="rotate(-18 136 69)"/>{!dog&&<><circle cx="46" cy="69" r="13" fill={panda?'#74726a':'#e2b4a9'} stroke="none"/><circle cx="135" cy="69" r="13" fill={panda?'#74726a':'#e2b4a9'} stroke="none"/></>}</>}
      <ellipse cx="90" cy="128" rx="43" ry="32" fill={`url(#${id})`}/><ellipse cx="90" cy="135" rx="25" ry="20" fill="#fff4d8" stroke="none"/>
      <ellipse cx="52" cy="131" rx="12" ry="21" fill={panda?'#676255':coat} transform="rotate(26 52 131)"/><ellipse cx="129" cy="128" rx="12" ry="22" fill={panda?'#676255':coat} transform="rotate(-35 129 128)"/>
      <ellipse cx="67" cy="158" rx="19" ry="10" fill={bird?'#dfa35c':coat}/><ellipse cx="115" cy="158" rx="19" ry="10" fill={bird?'#dfa35c':coat}/>
      <path d="M40 83q4-37 50-37t50 37q11 37-50 39T40 83" fill={`url(#${id})`}/>
      {panda&&<><ellipse cx="67" cy="84" rx="14" ry="17" fill="#5c5c51" stroke="none" transform="rotate(20 67 84)"/><ellipse cx="113" cy="84" rx="14" ry="17" fill="#5c5c51" stroke="none" transform="rotate(-20 113 84)"/></>}
      <ellipse cx="55" cy="100" rx="10" ry="5" fill="#e9a8a4" opacity=".65" stroke="none"/><ellipse cx="125" cy="100" rx="10" ry="5" fill="#e9a8a4" opacity=".65" stroke="none"/>
      <g fill="#3f4942" stroke="none"><ellipse cx="68" cy="85" rx="5" ry="7"/><ellipse cx="112" cy="85" rx="5" ry="7"/></g><g fill="#fff" stroke="none"><circle cx="69" cy="82" r="1.8"/><circle cx="113" cy="82" r="1.8"/></g>
      {bird?<path d="m80 99 10-7 11 7-11 7z" fill="#dca056"/>:petId==='piggy'?<><ellipse cx="90" cy="101" rx="16" ry="11" fill="#e0a6ae"/><path d="M84 99v3m12-3v3"/></>:frog?<path d="M77 98q13 11 26 0" fill="none"/>:<><path d="m85 96 5 4 6-4" fill="#b38177"/><path d="M90 100q0 9-8 6m8-6q0 9 8 6" fill="none"/></>}
      {cat&&<path d="m43 95 15 4m-16 5 15 1m66-6 14-4m-14 10 14-1" stroke="#a38466" strokeWidth="2"/>}
      {stage!=='baby'&&<><path d="M60 117q30 13 60 0l-4 12q-27 8-52-2z" fill={stage==='evolved'?'#d0a758':'#83aa92'}/><path d="m108 127 11 18 8-7-12-14" fill={stage==='evolved'?'#d0a758':'#83aa92'}/></>}
    </g>
    {stage==='evolved'&&<path d="m144 27 4 11 12 2-10 7 2 11-10-6-10 6 2-11-9-7 12-2z" fill="#f2d88c" stroke="#bc9755" strokeWidth="2"/>}
  </svg>;
}
