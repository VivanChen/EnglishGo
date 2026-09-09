// Story-specific art; retain the supplied physical-book engine.
const doriArt=(name,w=210,h=145)=>`<svg width="${w}" viewBox="0 0 ${w} ${h}"><image href="/images/picture-books/dori/${name}.png" width="${w}" height="${h}" preserveAspectRatio="xMidYMax meet"/></svg>`;
PAGES.forEach((p,i)=>{
 BACK[p.s]=()=>`<svg viewBox="0 0 732 376"><image href="/images/picture-books/dori/valley.png" width="732" height="376" preserveAspectRatio="xMidYMid slice"/><rect width="732" height="376" fill="#dbe5df" opacity="${i===0||i===7?.04:i===1?.42:.23}"/></svg>`;
 FLOOR[p.s]=i>=4&&i<=6?'#9aa68a':'#b1aa8c';
 const family=i===0||i===7;
 POPS[p.s]=[
  {x:family?90:180,y:.12,h:doriArt(i===1||i===2||i===3||i===5?'dori-listening':'dori-alert',family?180:220,family?125:150),tag:'triceratops'},
  ...(family?[{x:340,y:.25,h:doriArt('mother',285,195),tag:'mother'}]:[]),
  ...(!family?[{x:30,y:.8,h:doriArt('fern',145,225),tag:'fern'}]:[]),
  ...(i===2?[{x:465,y:.05,h:doriArt('footprints',175,115),tag:'footprints'}]:[]),
  ...(i===1||i===4?[{x:490,y:.15,h:A.rock(125),tag:'stone'}]:[]),
  ...(i===3||i===5?[{x:485,y:.55,h:A.cloud(140),tag:i===3?'echo':'signal',bob:1}]:[]),
  ...(i===6?[{x:415,y:.35,h:doriArt('mother',220,150),tag:'mother'}]:[])
 ];
});
coverArt=function(){document.getElementById('coverArt').innerHTML=`<image href="/images/picture-books/dori/valley.png" width="420" height="280" preserveAspectRatio="xMidYMid slice"/><g transform="translate(20,70)">${doriArt('dori-alert',165,110)}</g><g transform="translate(185,35)">${doriArt('mother',225,155)}</g>`;};
