// Story-specific pond art for Otto; the shared pop-up engine stays unchanged.
const OTTO_RATIO={otto:.9,boat:2.25,lantern:.739,duckling:.826,'mother-duck':1.3,frog:1.44,fish:1.49,reeds:.851};
const ottoArt=(name,w)=>{const h=Math.round(w/OTTO_RATIO[name]);return `<svg width="${w}" viewBox="0 0 ${w} ${h}"><image href="/images/picture-books/otto/${name}.webp" width="${w}" height="${h}" preserveAspectRatio="xMidYMax meet"/></svg>`;};
const ottoMoon=()=>`<svg width="104" viewBox="0 0 104 104"><circle cx="52" cy="52" r="50" fill="#fff3c4" opacity=".28"/><circle cx="52" cy="52" r="34" fill="#f6e3a4"/><circle cx="42" cy="44" r="6" fill="#e9cf8a"/><circle cx="62" cy="61" r="4.5" fill="#e9cf8a"/><circle cx="58" cy="38" r="3" fill="#e9cf8a"/></svg>`;
// The pond darkens from sunset to moonlight as the search goes on.
const ottoDusk=[0,.12,.26,.3,.36,.44,.4,.34];
const ottoScenes=[
 [{x:60,y:.7,h:ottoArt('reeds',125),tag:'reeds'},{x:230,y:.12,h:ottoArt('otto',150),tag:'otter'},{x:430,y:.08,h:ottoArt('boat',230),tag:'boat'}],
 [{x:90,y:.15,h:ottoArt('otto',150),tag:'otter'},{x:330,y:.35,h:ottoArt('lantern',110),tag:'lantern',bob:1},{x:470,y:.05,h:ottoArt('boat',210),tag:'boat'}],
 [{x:60,y:.25,h:ottoArt('otto',140),tag:'otter'},{x:340,y:.12,h:ottoArt('duckling',125),tag:'duck'},{x:560,y:.7,h:ottoArt('reeds',115),tag:'reeds'}],
 [{x:60,y:.08,h:ottoArt('boat',230),tag:'boat'},{x:300,y:.04,h:ottoArt('duckling',100),tag:'duck'},{x:450,y:.3,h:ottoArt('frog',180),tag:'frog'}],
 [{x:40,y:.08,h:ottoArt('boat',210),tag:'boat'},{x:330,y:.35,h:ottoArt('fish',200),tag:'fish',bob:1},{x:560,y:.75,h:ottoArt('frog',110),tag:'frog'}],
 [{x:40,y:.7,h:ottoArt('reeds',120),tag:'reeds'},{x:250,y:.25,h:ottoArt('fish',180),tag:'fish',bob:1},{x:520,y:.95,h:ottoMoon(),tag:'moon',bob:1,float:1}],
 [{x:40,y:.06,h:ottoArt('boat',200),tag:'boat'},{x:300,y:.14,h:ottoArt('duckling',105),tag:'duck'},{x:430,y:.3,h:ottoArt('mother-duck',190),tag:'mother'}],
 [{x:70,y:.15,h:ottoArt('otto',145),tag:'otter'},{x:260,y:.4,h:ottoArt('lantern',100),tag:'lantern',bob:1},{x:420,y:.5,h:A.house(190),tag:'home'}]
];
PAGES.forEach((p,i)=>{
 BACK[p.s]=()=>`<svg viewBox="0 0 732 376"><image href="/images/picture-books/otto/pond.webp" width="732" height="376" preserveAspectRatio="xMidYMid slice"/><rect width="732" height="376" fill="#1f2b52" opacity="${ottoDusk[i]}"/>${i>=6?'<circle cx="612" cy="68" r="24" fill="#fff4cc" opacity=".85"/>':''}</svg>`;
 FLOOR[p.s]='#86a7a4';
 POPS[p.s]=ottoScenes[i];
});
coverArt=function(){document.getElementById('coverArt').innerHTML=`<image href="/images/picture-books/otto/pond.webp" width="420" height="280" preserveAspectRatio="xMidYMid slice"/><rect width="420" height="280" fill="#1f2b52" opacity=".16"/><g transform="translate(205,150)">${ottoArt('boat',190)}</g><g transform="translate(45,92)">${ottoArt('otto',150)}</g><g transform="translate(262,52)">${ottoArt('lantern',72)}</g>`;};
