import {STORYBOOKS_AUDIO,storybookAudioBundle,allStorybookAudio} from '../src/data/storybookAudio.js';
import {DORI_PAGES,DORI_VOCAB} from '../src/data/doriBook.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {PIP_PAGES,PIP_VOCAB} from '../src/data/pipBook.js';
import {MILO_PAGES,MILO_VOCAB} from '../src/data/miloBook.js';
import {makeNovelAudioItem} from '../src/data/novelAudio.js';
const root = new URL('../', import.meta.url);
let html=await readFile(new URL('src/content/pip-and-the-lost-star.html',root),'utf8');
html=html.replace('width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no','width=device-width, initial-scale=1');
html=html.replace('</head>','<link rel="stylesheet" href="/picture-books/pip-enhancements.css">\n<link rel="stylesheet" href="/picture-books/storybook-layout.css">\n</head>');
html=html.replace('<script>','<script src="/elevenlabs-tts-patch.js"></script>\n<script>',1);
html=html.replace("addEventListener('keydown',e=>{if(e.key", "addEventListener('keydown',e=>{if(e.target.closest('button,[role=button]')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key");
html=html.replace('<body>','<body class="storybook-layout">');
// Preserve the original SVG interfaces and scene positions, replacing only artwork.
html=html.replace('const POPS = {',`for (const name of ['fox','tree','basket','owl','house','bush','rock','star','cloud']) {
  A[name] = (w=150) => {
    const h = name==='star'?150:['bush','rock','cloud'].includes(name)?95:['house','basket'].includes(name)?140:190;
    return '<svg width="'+w+'" viewBox="0 0 150 '+h+'"><image href="/images/picture-books/'+name+'-paper.png" width="150" height="'+h+'" preserveAspectRatio="xMidYMax meet"/></svg>';
  };
}
const POPS = {`);
const items=PIP_PAGES.map((p,i)=>makeNovelAudioItem({novelId:'picture-book-pip-lost-star',chapterNo:i+1,lang:'en-US',text:p.x}));
html=html.replace('</body>','<script src="/picture-books/pip-audio-items.js"></script>\n<script src="/picture-books/pip-enhancements.js"></script>\n</body>');
await mkdir(new URL('public/picture-books/',root),{recursive:true});
const pip=html.replace('/* ================= STATE ================= */',await readFile(new URL('src/content/pip-scenes.js',root),'utf8')+'\n/* ================= STATE ================= */');
await writeFile(new URL('public/picture-books/pip-and-the-lost-star.html',root),pip);
await writeFile(new URL('public/picture-books/pip-audio-items.js',root),'window.PIP_AUDIO_ITEMS = '+JSON.stringify(items,null,2)+';\n');
console.log(`Preserved Pip: ${PIP_PAGES.length} pages, ${Object.keys(PIP_VOCAB).length} original vocabulary cards.`);

// Reuse the supplied physical-book engine, with independent story data and scenes.
let milo=html.replace('<body class="storybook-layout">','<body class="storybook-layout milo-book">').replace(/Pip and the Lost Star/g,'Prince Milo and the Little Storm')
 .replace('Pip and the<br>Lost Star','Prince Milo and<br>the Little Storm').replace('皮皮與迷路的小星星','米洛王子的小風暴')
 .replace('🦊⭐','👑💛').replace('Pip counted the stars. One star winked back.','Stop, breathe, and use your words.')
 .replace(/const VOCAB = [\s\S]*?(?=\/\* ================= SVG ART)/,
   'const VOCAB = '+JSON.stringify(MILO_VOCAB)+';\nconst PAGES = '+JSON.stringify(MILO_PAGES)+';\n')
 .replace('/picture-books/pip-audio-items.js','/picture-books/milo-audio-items.js')
 .replace('/* ================= STATE ================= */',await readFile(new URL('src/content/milo-scenes.js',root),'utf8')+'\n/* ================= STATE ================= */');
const miloItems=MILO_PAGES.map((p,i)=>makeNovelAudioItem({novelId:'picture-book-milo-little-storm',chapterNo:i+1,lang:'en-US',text:p.x}));
await writeFile(new URL('public/picture-books/milo-and-the-little-storm.html',root),milo);
await writeFile(new URL('public/picture-books/milo-audio-items.js',root),'window.PIP_AUDIO_ITEMS = '+JSON.stringify(miloItems,null,2)+';\n');
console.log(`Original Milo: ${MILO_PAGES.length} pages, ${Object.keys(MILO_VOCAB).length} vocabulary cards.`);

const dori=html.replace('<body class="storybook-layout">','<body class="storybook-layout dori-book">')
 .replace(/Pip and the Lost Star/g,'Dori and the Echo in the Mist')
 .replace('Pip and the<br>Lost Star','Dori and the<br>Echo in the Mist')
 .replace('一本互動立體童書','國小五～六年級閱讀').replace('皮皮與迷路的小星星','小恐龍朵里尋找媽媽')
 .replace('🦊⭐','🦕🌿').replace('Pip counted the stars. One star winked back.','Pause, check the clues, and ask for help.')
 .replace(/const VOCAB = [\s\S]*?(?=\/\* ================= SVG ART)/,'const VOCAB = '+JSON.stringify(DORI_VOCAB)+';\nconst PAGES = '+JSON.stringify(DORI_PAGES)+';\n')
 .replace('/picture-books/pip-audio-items.js','/picture-books/dori-audio-items.js')
 .replace('/* ================= STATE ================= */',await readFile(new URL('src/content/dori-scenes.js',root),'utf8')+'\n/* ================= STATE ================= */');
const doriItems=DORI_PAGES.map((p,i)=>makeNovelAudioItem({novelId:'picture-book-dori-echo-mist',chapterNo:i+1,lang:'en-US',text:p.x}));
await writeFile(new URL('public/picture-books/dori-and-the-echo-in-the-mist.html',root),dori);
await writeFile(new URL('public/picture-books/dori-audio-items.js',root),'window.PIP_AUDIO_ITEMS = '+JSON.stringify(doriItems,null,2)+';\n');
console.log(`Original Dori: ${DORI_PAGES.length} pages, ${Object.keys(DORI_VOCAB).length} vocabulary cards.`);

for(const book of STORYBOOKS_AUDIO){
 const {pages,words}=storybookAudioBundle(book);
 await writeFile(new URL(`public/picture-books/${book.key}-audio-items.js`,root),
  'window.PIP_AUDIO_ITEMS = '+JSON.stringify(pages.map(({apiAudioUrl,...item})=>item),null,2)+';\nwindow.PIP_WORD_AUDIO_ITEMS = '+JSON.stringify(words,null,2)+';\n');
}
// A deploy must never publish a manifest whose prerecorded files are missing.
for(const item of allStorybookAudio()){
 const bytes=await readFile(new URL('public'+item.audioUrl,root));
 if(bytes.length<100||!(bytes.subarray(0,3).toString()==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224)))throw new Error('Invalid storybook audio: '+item.audioUrl);
}
