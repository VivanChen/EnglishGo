// Story-specific island art for Nova; the shared pop-up engine stays unchanged.
const NOVA_RATIO={nova:.403,grandpa:.475,lighthouse:.532,boat:1.72,radio:1.22,toolbox:1.25,battery:1.395,notebook:1.48};
const novaArt=(name,w,dim=false)=>{const h=Math.round(w/NOVA_RATIO[name]);return `<svg width="${w}" viewBox="0 0 ${w} ${h}"><image href="/images/picture-books/nova/${name}.webp" width="${w}" height="${h}" preserveAspectRatio="xMidYMax meet"${dim?' style="filter:brightness(.5) saturate(.6)"':''}/></svg>`;};
// The beam sits at lamp height, so the pop-up stands beside the tower with empty space below it.
const novaBeam=()=>`<svg width="250" viewBox="0 0 250 230"><defs><linearGradient id="novaBeamGlow" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="#fff7cf" stop-opacity=".95"/><stop offset="1" stop-color="#fff7cf" stop-opacity="0"/></linearGradient></defs><path d="M250 34 L0 2 L0 96 Z" fill="url(#novaBeamGlow)"/></svg>`;
const novaSky=[['#1d2b3a',.05],['#1d2b3a',.28],['#0d1626',.55],['#0d1626',.5],['#0d1626',.45],['#0d1626',.32],['#1d2b3a',.2],['#fff1d6',.22]];
const novaScenes=[
 [{x:30,y:.75,h:novaArt('lighthouse',115),tag:'lighthouse'},{x:200,y:.15,h:novaArt('nova',78),tag:'Nova'},{x:320,y:.2,h:novaArt('grandpa',95),tag:'grandpa'},{x:480,y:.05,h:novaArt('notebook',150),tag:'notebook'}],
 [{x:40,y:.2,h:novaArt('grandpa',95),tag:'grandpa'},{x:250,y:.1,h:novaArt('radio',140),tag:'radio'},{x:500,y:.8,h:novaArt('lighthouse',110),tag:'lighthouse'}],
 [{x:60,y:.15,h:novaArt('nova',78),tag:'Nova'},{x:190,y:.22,h:novaArt('grandpa',95),tag:'grandpa'},{x:430,y:.55,h:novaArt('lighthouse',125,true),tag:'lighthouse'}],
 [{x:40,y:.55,h:novaArt('lighthouse',115),tag:'lighthouse'},{x:230,y:.15,h:novaArt('nova',78),tag:'Nova'},{x:380,y:.08,h:novaArt('toolbox',140),tag:'toolbox'}],
 [{x:60,y:.15,h:novaArt('nova',78),tag:'Nova'},{x:240,y:.08,h:novaArt('battery',150),tag:'battery'},{x:470,y:.3,h:novaArt('toolbox',115),tag:'toolbox'}],
 [{x:40,y:.1,h:novaArt('radio',130),tag:'radio'},{x:170,y:.5,h:novaBeam(),tag:'beam',bob:1,float:1},{x:470,y:.5,h:novaArt('lighthouse',120),tag:'lighthouse'}],
 [{x:30,y:.25,h:A.rock(150),tag:'rocks'},{x:250,y:.2,h:novaArt('boat',220),tag:'boat'},{x:520,y:.75,h:novaArt('lighthouse',105),tag:'lighthouse'}],
 [{x:60,y:.15,h:novaArt('nova',78),tag:'Nova'},{x:200,y:.2,h:novaArt('grandpa',95),tag:'grandpa'},{x:420,y:.05,h:novaArt('notebook',150),tag:'notebook'}]
];
PAGES.forEach((p,i)=>{
 const [tint,amount]=novaSky[i];
 BACK[p.s]=()=>`<svg viewBox="0 0 732 376"><image href="/images/picture-books/nova/coast.webp" width="732" height="376" preserveAspectRatio="xMidYMid slice"/><rect width="732" height="376" fill="${tint}" opacity="${amount}"/>${i===2?'<path d="M540 18l-34 74h24l-30 76" stroke="#fffbe0" stroke-width="5" fill="none" stroke-linejoin="round" opacity=".9"/>':''}</svg>`;
 FLOOR[p.s]=i===7?'#93aaa4':'#6f8a8c';
 POPS[p.s]=novaScenes[i];
});
coverArt=function(){document.getElementById('coverArt').innerHTML=`<image href="/images/picture-books/nova/coast.webp" width="420" height="280" preserveAspectRatio="xMidYMid slice"/><rect width="420" height="280" fill="#0d1626" opacity=".22"/><g transform="translate(275,20)">${novaArt('lighthouse',118)}</g><g transform="translate(70,88)">${novaArt('nova',76)}</g><g transform="translate(150,100)">${novaArt('grandpa',90)}</g>`;};
