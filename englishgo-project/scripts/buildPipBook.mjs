import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {PIP_PAGES,PIP_VOCAB} from '../src/data/pipBook.js';
import {makeNovelAudioItem} from '../src/data/novelAudio.js';
const root = new URL('../', import.meta.url);
let html=await readFile(new URL('src/content/pip-and-the-lost-star.html',root),'utf8');
html=html.replace('width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no','width=device-width, initial-scale=1');
html=html.replace('</head>','<link rel="stylesheet" href="/picture-books/pip-enhancements.css">\n</head>');
html=html.replace('<script>','<script src="/elevenlabs-tts-patch.js"></script>\n<script>',1);
html=html.replace("addEventListener('keydown',e=>{if(e.key", "addEventListener('keydown',e=>{if(e.target.closest('button,[role=button]')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key");
// Preserve the original SVG interfaces and scene positions, replacing only artwork.
html=html.replace('const POPS = {',`for (const name of ['fox','tree','basket','owl','house']) {
  A[name] = (w=150) => {
    const h = ['house','basket'].includes(name) ? 140 : 190;
    return '<svg width="'+w+'" viewBox="0 0 150 '+h+'"><image href="/images/picture-books/'+name+'-paper.png" width="150" height="'+h+'" preserveAspectRatio="xMidYMax meet"/></svg>';
  };
}
const POPS = {`);
const items=PIP_PAGES.map((p,i)=>makeNovelAudioItem({novelId:'picture-book-pip-lost-star',chapterNo:i+1,lang:'en-US',text:p.x}));
html=html.replace('</body>','<script src="/picture-books/pip-audio-items.js"></script>\n<script src="/picture-books/pip-enhancements.js"></script>\n</body>');
await mkdir(new URL('public/picture-books/',root),{recursive:true});
await writeFile(new URL('public/picture-books/pip-and-the-lost-star.html',root),html);
await writeFile(new URL('public/picture-books/pip-audio-items.js',root),'window.PIP_AUDIO_ITEMS = '+JSON.stringify(items,null,2)+';\n');
console.log(`Preserved Pip: ${PIP_PAGES.length} pages, ${Object.keys(PIP_VOCAB).length} original vocabulary cards.`);
