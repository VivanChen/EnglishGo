// Keep the supplied story and scene objects; bring every paper prop into the visible stage.
Object.values(POPS).forEach(scene=>scene.forEach(o=>{o.x=Math.round(o.x*.8+20);}));
// A clear foreground path lets the owl and basket remain separately tappable.
POPS.forest=[
 {x:35,y:.8,h:A.tree(105),tag:'tree'},
 {x:170,y:.75,h:A.tree(100),tag:'tree'},
 {x:530,y:.85,h:A.tree(110),tag:'tree'},
 {x:230,y:.1,h:A.fox(140),tag:'fox'},
 {x:420,y:.12,h:A.star(90),tag:'lamp',bob:1},
 {x:540,y:.48,h:A.owl(100),tag:'owl',bob:1}
];
POPS.walk=[
 {x:45,y:.8,h:A.tree(100),tag:'tree'},
 {x:530,y:.8,h:A.tree(110),tag:'tree'},
 {x:240,y:.1,h:A.fox(145),tag:'fox'},
 {x:440,y:.1,h:A.basket(110),tag:'basket'},
 {x:465,y:.5,h:A.star(75),tag:'star',tagTop:-62,bob:1},
 {x:65,y:.08,h:A.bush(100),tag:'grass'}
];
