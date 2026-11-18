// Line-art icon set shared by cards, relics, statuses, intents and the map.
// Everything is drawn on a 64×64 grid with currentColor so CSS controls tint.
const F = { fill: 'currentColor', stroke: 'none' };
const soft = { fill: 'currentColor', fillOpacity: 0.22 };

const star4 = (x, y, r) => `M${x} ${y - r}L${x + r * 0.22} ${y - r * 0.22}L${x + r} ${y}L${x + r * 0.22} ${y + r * 0.22}L${x} ${y + r}L${x - r * 0.22} ${y + r * 0.22}L${x - r} ${y}L${x - r * 0.22} ${y - r * 0.22}Z`;
const FLAME = 'M32 6C40 18 50 24 48 39C46 51 38 57 32 57C24 57 16 51 16 41C16 31 23 27 25 17C29 23 31 27 31 31C35 25 34 15 32 6Z';
const SHIELD = 'M32 7L52 15V30C52 44 43 52 32 57C21 52 12 44 12 30V15Z';

const GLYPHS = {
  slash: <><path d="M12 52Q28 36 52 10" strokeWidth="6"/><path d="M8 42Q22 30 38 12" opacity=".45"/><path d={star4(50, 46, 7)} {...F}/></>,
  shield: <><path d={SHIELD} {...soft}/><path d="M32 16V48M20 22C26 26 38 26 44 22" opacity=".7"/></>,
  bolt: <path d="M37 5L15 36H30L25 59L49 25H34Z" {...F}/>,
  arc: <><path d="M6 42Q32 2 58 42" strokeWidth="6"/><path d="M14 50Q32 22 50 50" opacity=".5"/></>,
  fangs: <><path d="M14 12Q20 38 26 54Q30 34 32 12Z" {...F}/><path d="M34 12Q36 34 40 54Q46 38 50 12Z" {...F} fillOpacity=".65"/></>,
  dash: <><path d="M8 32H48" strokeWidth="5"/><path d="M38 20L54 32L38 44" strokeWidth="5"/><path d="M6 20H22M10 44H24" opacity=".5"/></>,
  flame: <><path d={FLAME} {...F}/><path d="M32 34C36 40 38 44 36 49C34 52 30 52 28 49C26 45 30 40 32 34Z" fill="#fff" fillOpacity=".55" stroke="none"/></>,
  riposte: <><path d="M12 12L52 52M52 12L12 52" strokeWidth="5"/><path d="M20 30L30 20M34 44L44 34M44 30L34 20M20 34L30 44" opacity=".6"/></>,
  rune: <><path d="M32 5L54 32L32 59L10 32Z" {...soft}/><path d="M32 18V46M24 26L40 36M24 38L40 28" strokeWidth="3.5"/></>,
  spark: <path d={star4(32, 32, 26)} {...F}/>,
  comet: <><circle cx="44" cy="20" r="9" {...F}/><path d="M37 27L10 54M40 32L20 52M32 24L14 42" opacity=".6"/></>,
  rebound: <><path d={SHIELD} {...soft}/><path d="M22 40C22 28 30 22 42 22" strokeWidth="4"/><path d="M36 15L44 22L36 29"/></>,
  barrier: <><path d="M6 52Q32 0 58 52Z" {...soft}/><path d="M16 52Q32 18 48 52" opacity=".6"/><path d="M4 52H60"/></>,
  parry: <><path d="M20 54L44 10" strokeWidth="5"/><path d="M16 40L28 48"/><path d="M40 52C52 44 56 30 50 20" opacity=".6"/></>,
  eye: <><path d="M5 32Q32 6 59 32Q32 58 5 32Z" {...soft}/><circle cx="32" cy="32" r="9" {...F}/><circle cx="35" cy="29" r="3" fill="#fff" stroke="none"/></>,
  smoke: <><path d="M14 44C6 44 6 32 14 32C14 24 26 22 28 28C30 20 44 20 44 30C54 28 56 44 46 44Z" {...soft}/><path d="M20 52H44M26 58H38" opacity=".6"/></>,
  leaf: <><path d="M12 52C12 26 32 10 54 10C54 34 38 52 12 52Z" {...soft}/><path d="M12 52L42 22"/></>,
  hex: <><circle cx="32" cy="32" r="25" opacity=".5"/><path d="M32 8L46 52L9 25H55L18 52Z"/></>,
  spark2: <><path d={star4(32, 32, 18)} {...F}/><path d="M32 4V10M32 54V60M4 32H10M54 32H60" opacity=".55"/></>,
  whirl: <path d="M32 32C32 28 38 28 38 33C38 40 26 40 26 31C26 20 44 20 44 33C44 47 20 47 20 31C20 14 50 14 52 32" strokeWidth="4"/>,
  inferno: <><path d="M20 58C10 52 10 40 16 32C18 38 22 40 24 40C22 30 28 20 34 14C34 24 42 28 44 36C46 32 48 30 50 26C56 36 56 52 44 58Z" {...F}/><path d="M28 58C26 52 28 48 32 44C34 50 38 52 36 58Z" fill="#fff" fillOpacity=".5" stroke="none"/></>,
  shatter: <><path d="M14 14L30 10L28 28L12 30Z" {...F}/><path d="M36 10L54 16L46 30L34 26Z" {...F} fillOpacity=".7"/><path d="M14 36L30 34L26 54L10 50Z" {...F} fillOpacity=".7"/><path d="M36 32L52 36L50 54L32 50Z" {...F}/></>,
  pierce: <><path d="M10 54L46 18" strokeWidth="4"/><path d="M40 12L56 8L52 24Z" {...F}/><path d="M10 40L18 46" opacity=".6"/></>,
  stars: <><path d={star4(20, 20, 12)} {...F}/><path d={star4(44, 30, 14)} {...F}/><path d={star4(24, 48, 9)} {...F} fillOpacity=".7"/></>,
  echo: <><circle cx="16" cy="32" r="6" {...F}/><path d="M28 20Q36 32 28 44M38 13Q50 32 38 51M48 6Q64 32 48 58" strokeWidth="3.5"/></>,
  tower: <><path d="M18 58V22H46V58Z" {...soft}/><path d="M14 22V10H22V16H28V10H36V16H42V10H50V22Z" {...F}/><path d="M28 58V44Q32 38 36 44V58"/></>,
  kindle: <><path d={FLAME} {...soft}/><path d="M32 52V24M22 34L32 24L42 34" strokeWidth="4"/></>,
  siphon: <><path d="M32 6C42 20 48 30 48 40A16 16 0 0 1 16 40C16 30 22 20 32 6Z" {...soft}/><path d="M24 40C24 34 32 32 34 38C36 44 44 42 42 34"/></>,
  horn: <><path d="M10 40C24 40 40 30 48 12L54 16C50 38 36 52 14 52Z" {...soft}/><path d="M10 40V52M48 12L54 16"/><path d="M56 30L62 28M54 40L60 42" opacity=".6"/></>,
  hourglass: <><path d="M16 6H48M16 58H48"/><path d="M20 6C20 24 44 24 44 32C44 40 20 40 20 58M44 6C44 24 20 24 20 32C20 40 44 40 44 58"/><path d="M24 54L32 44L40 54Z" {...F}/></>,
  surge: <><circle cx="32" cy="32" r="25" {...soft}/><path d="M36 12L22 34H32L28 52L44 28H34Z" {...F}/></>,
  runeShield: <><path d={SHIELD} {...soft}/><path d="M32 18L40 32L32 46L24 32Z" {...F}/></>,
  rewind: <><path d="M16 22A20 20 0 1 1 14 38" strokeWidth="4"/><path d="M6 14L16 24L26 16" strokeWidth="4"/><path d="M32 22V33L40 38"/></>,
  stone: <><path d="M32 56L8 30C2 20 10 8 20 8C26 8 30 12 32 16C34 12 38 8 44 8C54 8 62 20 56 30Z" {...F}/><path d="M20 16L28 28L22 38M42 18L36 30L44 40" stroke="#000" strokeOpacity=".35"/></>,
  wrath: <><path d={FLAME} {...F}/><path d="M24 38L30 41M40 38L34 41" stroke="#000" strokeOpacity=".55" strokeWidth="3.5"/></>,
  thorn: <><path d="M10 54C22 44 26 26 54 10" strokeWidth="4"/><path d="M20 44L12 38M26 34L32 26M34 26L28 18M40 20L48 24M46 16L44 8" strokeWidth="3"/></>,
  feather: <><path d="M14 56C14 30 30 10 54 8C52 32 36 50 14 56Z" {...soft}/><path d="M8 62L44 20M24 42L16 38M32 34L24 28M38 28L34 20"/></>,
  wave: <path d="M4 32C12 16 20 16 28 32S44 48 52 32S60 22 62 26M4 46C12 36 20 36 28 46M36 18C42 10 50 10 58 18" strokeWidth="3.5"/>,
  finale: <><path d="M40 8A24 24 0 1 0 56 44A20 20 0 1 1 40 8Z" {...F}/><path d={star4(46, 22, 9)} fill="#fff" stroke="none"/></>,
  maw: <><path d="M6 24Q32 6 58 24Q58 50 32 56Q6 50 6 24Z" {...soft}/><path d="M12 26L18 36L24 26L30 36L36 26L42 36L48 26L54 34M14 46L20 38L26 46L32 38L38 46L44 38L50 46" strokeWidth="2.5"/></>,
  storm: <><path d="M14 30C6 30 6 18 14 18C16 8 32 6 36 14C44 8 56 14 52 24C60 26 58 36 50 36H14Z" {...soft}/><path d="M24 36L18 48H26L22 60M42 36L36 46H44L40 56" strokeWidth="3.5"/></>,
  sanctum: <><path d="M6 24L32 6L58 24Z" {...F}/><path d="M12 28V52M24 28V52M40 28V52M52 28V52M6 56H58" strokeWidth="4"/></>,
  wildfire: <><path d="M6 56C2 46 8 38 12 34C14 40 18 42 20 40C18 32 24 22 30 18C30 28 36 32 38 38C40 34 42 30 46 28C50 32 52 26 52 20C60 30 62 50 52 56Z" {...F}/></>,
  moon: <path d="M40 6A26 26 0 1 0 58 42A22 22 0 1 1 40 6Z" {...F}/>,
  crown: <><path d="M8 48L12 18L24 32L32 12L40 32L52 18L56 48Z" {...F}/><path d="M8 54H56" strokeWidth="4"/></>,
  book: <><path d="M32 16C24 10 14 10 6 12V52C14 50 24 50 32 56C40 50 50 50 58 52V12C50 10 40 10 32 16Z" {...soft}/><path d="M32 16V56M12 22H24M12 30H24M40 22H52M40 30H52" opacity=".75"/></>,
  blot: <path d="M30 10C38 8 40 18 46 16C54 14 56 26 50 30C58 34 54 46 46 44C46 54 34 56 32 48C26 56 14 52 18 44C8 44 8 32 16 30C10 22 20 14 26 20C24 14 26 11 30 10Z" {...F}/>,
  dust: <><circle cx="20" cy="22" r="4" {...F}/><circle cx="38" cy="16" r="3" {...F}/><circle cx="46" cy="34" r="5" {...F}/><circle cx="24" cy="42" r="6" {...F} fillOpacity=".6"/><circle cx="40" cy="50" r="3" {...F}/></>,
  regret: <><path d="M32 56L8 30C2 20 10 8 20 8C26 8 30 12 32 16C34 12 38 8 44 8C54 8 62 20 56 30Z" {...soft}/><path d="M32 16L26 28L36 36L28 48" strokeWidth="3.5"/></>,
  doubt: <><path d="M20 22C20 12 30 8 36 10C46 12 46 26 36 30C32 32 32 36 32 42" strokeWidth="5"/><circle cx="32" cy="52" r="4" {...F}/></>,

  // relics
  inkwell: <><path d="M16 28H48L52 54H12Z" {...soft}/><path d="M24 28V18H40V28M16 28H48L52 54H12Z"/><path d="M38 18L54 4" strokeWidth="3.5"/></>,
  lantern: <><path d="M22 18H42L46 48H18Z" {...soft}/><path d="M22 18H42L46 48H18ZM26 12H38M32 6V12M16 52H48"/><path d={FLAME} transform="translate(20 20) scale(.38)" {...F}/></>,
  bookmark: <><path d="M18 6H46V58L32 46L18 58Z" {...F}/><path d="M24 16H40" stroke="#fff" strokeOpacity=".6"/></>,
  whetstone: <><path d="M8 40L24 24H56L40 40Z" {...soft}/><path d="M8 40L24 24H56L40 40ZM8 40V48H40L56 32V24M40 40V48"/></>,
  anchor: <><circle cx="32" cy="12" r="6"/><path d="M32 18V56M20 28H44M10 38C12 50 22 56 32 56C42 56 52 50 54 38" strokeWidth="4"/></>,
  gem: <><path d="M12 22L22 10H42L52 22L32 56Z" {...F}/><path d="M12 22H52M22 10L28 22L32 56L36 22L42 10" stroke="#fff" strokeOpacity=".45"/></>,
  peach: <><path d="M32 18C18 10 6 22 10 38C14 52 28 58 32 52C36 58 50 52 54 38C58 22 46 10 32 18Z" {...F}/><path d="M32 18C30 26 30 34 32 50" stroke="#000" strokeOpacity=".2"/><path d="M32 18C36 10 42 6 50 8" strokeWidth="3"/></>,
  coin: <><circle cx="32" cy="32" r="24" {...soft}/><circle cx="32" cy="32" r="24"/><path d="M32 18V46M24 24H38A6 6 0 0 1 38 34H26A6 6 0 0 0 26 44H40"/></>,
  thread: <><circle cx="24" cy="38" r="16" {...soft}/><path d="M12 30C20 34 30 34 38 30M10 40C20 44 30 44 40 40M40 30C46 20 52 14 58 8" strokeWidth="3"/></>,
  ring: <><circle cx="32" cy="38" r="18" strokeWidth="6"/><path d="M24 20L32 8L40 20" {...F}/><path d="M14 26L8 22M50 26L56 22M12 46L6 50M52 46L58 50" opacity=".7"/></>,
  quill: <><path d="M54 6C30 10 18 28 14 50C26 44 44 32 54 6Z" {...F}/><path d="M8 58L30 32" strokeWidth="3"/></>,
  shard: <><path d="M26 4L48 18L40 60L14 40Z" {...soft}/><path d="M26 4L48 18L40 60L14 40ZM26 4L32 34L40 60M32 34L48 18"/></>,
  tea: <><path d="M10 26H46V36C46 48 38 54 28 54C18 54 10 48 10 36Z" {...soft}/><path d="M10 26H46V36C46 48 38 54 28 54C18 54 10 48 10 36ZM46 30H52A6 6 0 0 1 52 42H45M20 18C20 12 24 12 24 6M32 18C32 12 36 12 36 6"/></>,
  nib: <><path d="M32 4L50 26L38 58H26L14 26Z" {...F}/><path d="M32 30V58" stroke="#000" strokeOpacity=".45"/><circle cx="32" cy="28" r="4" fill="#000" fillOpacity=".45" stroke="none"/></>,
  phoenix: <><path d="M32 54C22 46 12 40 6 24C16 28 22 32 26 38C24 26 26 16 32 8C38 16 40 26 38 38C42 32 48 28 58 24C52 40 42 46 32 54Z" {...F}/></>,
  oil: <><path d="M20 22H44V56H20Z" {...soft}/><path d="M20 22H44V56H20ZM26 22V12H38V22M22 8H42"/><path d="M32 30C36 36 38 40 36 44C34 48 30 48 28 44C26 40 28 36 32 30Z" {...F}/></>,
  heart: <><path d="M32 56L8 30C2 20 10 8 20 8C26 8 30 12 32 16C34 12 38 8 44 8C54 8 62 20 56 30Z" {...F}/><path d="M32 24L38 34L32 44L26 34Z" fill="#fff" fillOpacity=".55" stroke="none"/></>,

  // map & intents
  monster: <><path d="M12 30C12 16 22 8 32 8S52 16 52 30C52 40 46 44 46 50H18C18 44 12 40 12 30Z" {...soft}/><path d="M22 28L28 32M42 28L36 32" strokeWidth="4"/><path d="M24 44L28 40L32 44L36 40L40 44"/></>,
  elite: <><path d="M12 30C12 16 22 10 32 10S52 16 52 30C52 40 46 44 46 52H18C18 44 12 40 12 30Z" {...F}/><path d="M14 18L6 4L22 12M50 18L58 4L42 12" strokeWidth="3.5"/><path d="M22 28L28 32M42 28L36 32" stroke="#000" strokeOpacity=".6" strokeWidth="4"/></>,
  rest: <><path d="M22 18H42L46 48H18Z" {...soft}/><path d="M22 18H42L46 48H18ZM26 12H38M32 6V12M14 52H50"/><path d={FLAME} transform="translate(20 20) scale(.38)" {...F}/></>,
  shop: <><path d="M14 26H50L46 58H18Z" {...soft}/><path d="M14 26H50L46 58H18ZM24 26C24 14 40 14 40 26"/><path d="M32 34V50M27 38H35A3 3 0 0 1 35 44H29A3 3 0 0 0 29 50H37" strokeWidth="2.5"/></>,
  event: <><circle cx="32" cy="32" r="26" {...soft}/><path d="M22 24C22 14 32 12 36 14C44 16 44 28 36 30C32 32 32 34 32 40" strokeWidth="4.5"/><circle cx="32" cy="49" r="3.5" {...F}/></>,
  treasure: <><path d="M8 28H56V54H8Z" {...soft}/><path d="M8 28C8 14 20 10 32 10S56 14 56 28M8 28H56V54H8ZM28 28V38H36V28" strokeWidth="3"/></>,
  boss: <><path d="M8 48L12 18L24 32L32 12L40 32L52 18L56 48Z" {...F}/><path d="M8 54H56" strokeWidth="4"/></>,
  attack: <><path d="M12 52L44 20" strokeWidth="6"/><path d="M40 12L54 10L52 24Z" {...F}/><path d="M10 40L24 54" strokeWidth="4"/></>,
  defend: <path d={SHIELD} {...F}/>,
  buff: <><path d="M32 8L52 30H40V56H24V30H12Z" {...F}/></>,
  debuff: <><path d="M32 6C42 20 48 30 48 40A16 16 0 0 1 16 40C16 30 22 20 32 6Z" {...F}/><path d="M26 40L38 40" stroke="#000" strokeOpacity=".4" strokeWidth="4"/></>,
  unknown: <><circle cx="32" cy="32" r="24" {...soft}/><path d="M24 26C24 18 32 16 36 18C42 20 42 30 36 32C32 34 32 36 32 40" strokeWidth="4.5"/><circle cx="32" cy="48" r="3" {...F}/></>,
  heartFill: <path d="M32 56L8 30C2 20 10 8 20 8C26 8 30 12 32 16C34 12 38 8 44 8C54 8 62 20 56 30Z" {...F}/>,
  gold: <><circle cx="32" cy="32" r="22" {...F}/><circle cx="32" cy="32" r="14" stroke="#000" strokeOpacity=".25"/></>,
  deck: <><path d="M14 14H40V54H14Z" {...soft}/><path d="M14 14H40V54H14ZM22 8H48V48"/></>,
  gear: <><circle cx="32" cy="32" r="9"/><path d="M32 6V14M32 50V58M6 32H14M50 32H58M14 14L20 20M44 44L50 50M50 14L44 20M14 50L20 44" strokeWidth="5"/><circle cx="32" cy="32" r="18"/></>,

  // status icons
  might: <><path d={FLAME} {...F}/></>,
  grace: <><path d="M14 56C14 30 30 10 54 8C52 32 36 50 14 56Z" {...F}/></>,
  weak: <><path d="M14 50L50 14" strokeWidth="5"/><path d="M28 30L38 40" stroke="#000" strokeOpacity=".5" strokeWidth="5"/><path d="M10 40L24 54" strokeWidth="4"/></>,
  exposed: <><path d={SHIELD} {...soft}/><path d="M30 8L36 24L26 34L36 46L30 56" strokeWidth="4"/></>,
  frail: <><path d={SHIELD} {...soft}/><path d="M20 20L44 44M44 20L20 44" strokeWidth="4"/></>,
  burn: <path d={FLAME} {...F}/>,
  spikes: <path d="M8 56L16 30L24 56L32 20L40 56L48 30L56 56Z" {...F}/>,
  ritual: <path d={star4(32, 32, 24)} {...F}/>,
};

Object.assign(GLYPHS, {
  // Archive expansion
  fireball: <><circle cx="40" cy="24" r="14" {...F}/><path d="M30 34L8 56M34 40L18 58M26 30L6 46" strokeWidth="4" opacity=".6"/><circle cx="44" cy="20" r="5" fill="#fff" fillOpacity=".6" stroke="none"/></>,
  burst: <><path d="M32 4L37 22L54 12L44 28L62 34L44 38L52 56L36 44L32 62L28 44L12 56L20 38L2 34L20 28L10 12L27 22Z" {...F}/><circle cx="32" cy="33" r="7" fill="#fff" fillOpacity=".55" stroke="none"/></>,
  sun: <><circle cx="32" cy="32" r="13" {...F}/><path d="M32 4V12M32 52V60M4 32H12M52 32H60M12 12L18 18M46 46L52 52M52 12L46 18M12 52L18 46" strokeWidth="4"/></>,
  flameShield: <><path d={SHIELD} {...soft}/><path d="M32 20C37 27 41 31 40 38C39 44 35 46 32 46C28 46 24 43 24 38C24 33 28 31 29 26C31 29 32 31 32 33C34 30 33 25 32 20Z" {...F}/></>,
  shieldBash: <><path d={SHIELD} {...soft}/><path d="M32 7L52 15V30C52 44 43 52 32 57" strokeWidth="4"/><path d="M4 24L14 30M2 36L14 38M6 48L16 44" strokeWidth="3.5"/></>,
  helm: <><path d="M12 40C12 20 20 8 32 8S52 20 52 40V54H40V42H24V54H12Z" {...soft}/><path d="M12 40C12 20 20 8 32 8S52 20 52 40V54H40V42H24V54H12ZM32 8V30M20 30H44"/></>,
  aegis: <><path d={SHIELD} {...F}/><path d="M32 16L36 28H48L38 35L42 47L32 40L22 47L26 35L16 28H28Z" fill="#fff" fillOpacity=".7" stroke="none"/></>,
  fist: <><path d="M16 26C16 20 22 18 26 22C26 16 34 16 34 22C36 16 44 18 42 24C48 22 52 28 48 34L44 48H22L16 38Z" {...soft}/><path d="M16 26C16 20 22 18 26 22C26 16 34 16 34 22C36 16 44 18 42 24C48 22 52 28 48 34L44 48H22L16 38ZM22 48V58H44V48"/><path d="M52 10L58 4M56 20L62 18M46 6L46 0" opacity=".6"/></>,
  pages: <><path d="M10 14L30 10L34 34L14 38Z" {...soft}/><path d="M10 14L30 10L34 34L14 38Z"/><path d="M34 20L54 22L50 46L30 44Z" {...F} fillOpacity=".55"/><path d="M20 44L38 50L32 62L14 56Z" {...soft}/><path d="M16 20L26 18M18 26L28 24" opacity=".7"/></>,
  cuts: <><path d="M8 50L44 14M18 56L54 20M28 60L60 28" strokeWidth="4"/><path d="M40 10L48 6L46 16Z" {...F}/></>,
  hat: <><path d="M32 4L46 44H18Z" {...F}/><path d="M6 46C6 40 58 40 58 46C58 54 6 54 6 46Z" {...F}/><path d={star4(30, 26, 6)} fill="#fff" fillOpacity=".7" stroke="none"/></>,
  livingInk: <><path d="M30 10C38 8 40 18 46 16C54 14 56 26 50 30C58 34 54 46 46 44C46 54 34 56 32 48C26 56 14 52 18 44C8 44 8 32 16 30C10 22 20 14 26 20C24 14 26 11 30 10Z" {...F}/><circle cx="26" cy="32" r="4" fill="#fff" stroke="none"/><circle cx="40" cy="32" r="4" fill="#fff" stroke="none"/><path d="M26 42Q33 46 40 42" stroke="#fff" strokeWidth="2.5"/></>,
});
Object.assign(GLYPHS, {
  // Wave 2
  recall: <><path d="M16 18H40V56H16Z" {...soft}/><path d="M16 18H40V56H16Z"/><path d="M48 44V14M40 22L48 12L56 22" strokeWidth="4"/></>,
  sift: <><path d="M8 10H56L36 34V54L28 58V34Z" {...soft}/><path d="M8 10H56L36 34V54L28 58V34Z"/><circle cx="22" cy="18" r="2.5" {...F}/><circle cx="34" cy="16" r="2.5" {...F}/><circle cx="44" cy="20" r="2.5" {...F}/></>,
  crystal: <><circle cx="32" cy="28" r="20" {...soft}/><circle cx="32" cy="28" r="20"/><path d="M14 56H50L44 46H20Z" {...F}/><path d={star4(26, 22, 6)} fill="#fff" fillOpacity=".75" stroke="none"/></>,
  whetblade: <><path d="M14 52L46 14" strokeWidth="6"/><path d="M42 10L54 6L50 18Z" {...F}/><path d="M10 40L22 52" strokeWidth="4"/><path d={star4(48, 42, 9)} {...F}/></>,
  leech: <><path d="M32 6C42 20 48 30 48 40A16 16 0 0 1 16 40C16 30 22 20 32 6Z" {...F}/><path d="M24 40L28 46L32 40L36 46L40 40" stroke="#fff" strokeOpacity=".7" strokeWidth="2.5"/></>,
  thunderclap: <><path d="M36 6L18 34H30L26 58L46 28H34Z" {...F}/><path d="M8 32A24 24 0 0 1 14 16M56 32A24 24 0 0 0 50 16M8 40A24 24 0 0 0 14 52M56 40A24 24 0 0 1 50 52" strokeWidth="3"/></>,
  patience: <><path d={SHIELD} {...soft}/><path d="M24 16H40M24 48H40M26 16C26 28 38 28 38 32C38 36 26 36 26 48M38 16C38 28 26 28 26 32C26 36 38 36 38 48"/></>,
  wordflood: <><path d="M4 44C12 34 20 34 28 44S44 54 52 44S60 38 62 40" strokeWidth="4"/><path d="M12 30L16 14L20 30M13.5 24H18.5M28 14V30H36M42 14H50L44 30H52" strokeWidth="3"/></>,
  offering: <><path d="M8 44C16 44 24 48 32 48S48 44 56 44V52C48 56 16 56 8 52Z" {...F}/><path d="M32 8C38 16 42 22 40 30C38 36 34 38 32 38C28 38 24 34 24 30C24 24 28 22 30 16C31 20 32 22 32 24C34 20 34 14 32 8Z" {...F}/></>,
  paperCut: <><path d="M12 10H40L52 22V54H12Z" {...soft}/><path d="M12 10H40L52 22V54H12ZM40 10V22H52"/><path d="M6 58L58 6" strokeWidth="4"/></>,
  emberRain: <><path d="M16 22C10 22 10 12 18 12C20 4 34 4 36 12C44 8 52 14 48 22Z" {...soft}/><path d="M16 22C10 22 10 12 18 12C20 4 34 4 36 12C44 8 52 14 48 22Z"/><path d="M20 30C23 35 22 38 20 40C18 38 17 35 20 30ZM34 34C37 39 36 42 34 44C32 42 31 39 34 34ZM46 30C49 35 48 38 46 40C44 38 43 35 46 30ZM26 46C29 51 28 54 26 56C24 54 23 51 26 46Z" {...F}/></>,
  bookwall: <><path d="M8 54H56" strokeWidth="4"/><path d="M10 54V20H20V54M22 54V12H32V54M34 54V24H44V54M46 54V16H56V54" {...soft}/><path d="M10 54V20H20V54M22 54V12H32V54M34 54V24H44V54M46 54V16H56V54"/></>,
  palimpsest: <><path d="M14 8H42C48 8 50 12 50 16V56H18C14 56 12 52 14 48Z" {...soft}/><path d="M14 8H42C48 8 50 12 50 16V56H18C14 56 12 52 14 48ZM20 20H40M20 28H36" opacity=".8"/><path d="M58 18L34 46L30 50L32 44Z" {...F}/></>,
  library: <><path d="M6 58V18L32 4L58 18V58Z" {...soft}/><path d="M6 58V18L32 4L58 18V58ZM6 30H58M6 44H58"/><path d="M12 30V20M18 30V22M24 30V19M40 44V34M46 44V36M52 44V33M14 58V48M22 58V47" strokeWidth="3"/></>,
});

// Status and power icons share the card art.
Object.assign(GLYPHS, { charge: GLYPHS.surge, bastion: GLYPHS.helm, momentum: GLYPHS.dash, thousandCuts: GLYPHS.cuts, archmage: GLYPHS.hat, inscribe: GLYPHS.rune, shard: GLYPHS.shard });

GLYPHS.stoneheart = GLYPHS.stone;
GLYPHS.clarity = GLYPHS.moon;
GLYPHS.resonance = GLYPHS.wave;
GLYPHS.scholar = GLYPHS.book;
GLYPHS.ascend = GLYPHS.crown;

export default function Glyph({ name, size = 24, className = '', title, ...rest }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`ea-glyph ${className}`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined} {...rest}>
      {title && <title>{title}</title>}
      {GLYPHS[name] || GLYPHS.unknown}
    </svg>
  );
}

export const hasGlyph = name => Boolean(GLYPHS[name]);
