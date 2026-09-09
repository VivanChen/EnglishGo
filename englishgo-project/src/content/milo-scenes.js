// Scene adapters for the shared pop-up engine. Book-specific human characters with page-specific expressions.
const paper=(name,w=150)=>`<svg width="${w}" viewBox="0 0 150 190"><image href="/images/picture-books/${name}-paper.png" width="150" height="190" preserveAspectRatio="xMidYMax meet"/></svg>`;
const character=(name,w=165,h=230)=>`<svg width="${w}" viewBox="0 0 150 ${h}"><image href="/images/picture-books/milo/${name}.png" width="150" height="${h}" preserveAspectRatio="xMidYMax meet"/></svg>`;
const prince=(w=165,pose='welcome')=>character('milo-'+pose,w,pose==='breathe'?170:230);
const blocks=(fallen=false,bridge=false)=>`<svg width="210" viewBox="0 0 210 140"><image href="/images/picture-books/milo/${bridge?'bridge':fallen?'fallen-blocks':'castle'}.png" width="210" height="140" preserveAspectRatio="xMidYMax meet"/></svg>`;
const breath=()=>`<svg width="130" viewBox="0 0 150 120"><path d="M28 86C4 84 5 48 29 46 20 11 79 2 88 34 127 13 155 74 119 86Z" fill="#f2eee4" stroke="#b9c9c3" stroke-width="2"/><path d="M38 58q30-20 64 0M43 70q25-16 49 0" stroke="#829f96" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
PAGES.forEach((p,i)=>{
 BACK[p.s]=()=>`<svg viewBox="0 0 732 376"><defs><linearGradient id="day" x2="0" y2="1"><stop stop-color="${i===2?'#b5adb5':'#c6d9d1'}"/><stop offset="1" stop-color="#f1e5c9"/></linearGradient></defs><rect width="732" height="376" fill="url(#day)"/><circle cx="585" cy="78" r="38" fill="#f9edc8" opacity=".85"/><path d="M0 270Q160 175 360 260T732 230V376H0Z" fill="#a4b29a"/><path d="M0 320Q220 245 440 315T732 285V376H0Z" fill="#788f78"/>${i===3?'':`<image href="/images/picture-books/tree-paper.png" x="25" y="65" width="175" height="290"/>`}<image href="/images/picture-books/tree-paper.png" x="560" y="120" width="150" height="230"/></svg>`;
 FLOOR[p.s]='#b4b58f';
 POPS[p.s]=[{x:155,y:.12,h:prince(165,i===1||i===2?'angry':i===3||i===4?'breathe':'welcome'),tag:'prince'},{x:525,y:.3,h:character('ruby-ribbon',150),tag:'ruby'},
 ...(i===3?[{x:65,y:.8,h:paper('tree',150),tag:'tree'}]:i===4?[{x:355,y:.55,h:breath(),tag:'breathe',bob:1}]:[{x:320,y:.02,h:blocks(i>0&&i<6,i>=6),tag:i>0&&i<6?'blocks':i>=6?'bridge':'castle'}]),
 ...(i===2?[{x:300,y:.85,h:breath(),tag:'anger'}]:[])];
});
coverArt=function(){document.getElementById('coverArt').innerHTML=`<path d="M0 230Q180 170 420 230V280H0Z" fill="#a3ad88"/><g transform="translate(35,20)">${prince(165)}</g><g transform="translate(210,100)">${blocks()}</g>`;};
