import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const ISLAND_COLORS={start:'#efbc57',word:'#729bde',grammar:'#b28bcf',event:'#efbd60',shop:'#ea927c',training:'#80b599',boss:'#847cb7'};
export const ISLAND_GRID=[[6,6],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,5],[0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5]];
export function islandPosition(index){const [x,z]=ISLAND_GRID[index%24]||ISLAND_GRID[0];return new THREE.Vector3((x-3)*1.32,.56,(z-3)*1.32)}

export function createModelKit(){
  const materials=new Map(),geometries=new Map(),batches=new Set();
  const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.82}));return materials.get(color)};
  const geometry=(key,make)=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key)};
  const mesh=(parent,geo,color,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{
    const node=new THREE.Mesh(geo,material(color));node.position.set(x,y,z);node.scale.set(sx,sy,sz);node.castShadow=true;node.receiveShadow=true;parent.add(node);return node;
  };
  const box=(parent,color,x,y,z,w,h,d)=>mesh(parent,geometry('box',()=>new THREE.BoxGeometry(1,1,1)),color,x,y,z,w,h,d);
  const ball=(parent,color,x,y,z,w,h=w,d=w)=>mesh(parent,geometry('sphere',()=>new THREE.SphereGeometry(1,16,12)),color,x,y,z,w,h,d);
  const cylinder=(parent,color,x,y,z,r,h,top=r)=>mesh(parent,geometry(`cylinder:${top/r}`,()=>new THREE.CylinderGeometry(top/r,1,1,16)),color,x,y,z,r,h,r);
  const cone=(parent,color,x,y,z,r,h,sides=8)=>mesh(parent,geometry(`cone:${sides}`,()=>new THREE.ConeGeometry(1,1,sides)),color,x,y,z,r,h,r);
  const pack=group=>{
    group.updateMatrixWorld(true);
    const colors=new Map(),inverse=group.matrixWorld.clone().invert();
    group.traverse(node=>{if(!node.isMesh)return;const list=colors.get(node.material)||[];list.push(node.geometry.clone().applyMatrix4(inverse.clone().multiply(node.matrixWorld)));colors.set(node.material,list)});
    group.clear();
    colors.forEach((parts,mat)=>{const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());if(!geometry)return;const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);batches.add(geometry)});
    return group;
  };
  const dispose=()=>{materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());batches.forEach(g=>g.dispose())};
  return {box,ball,cylinder,cone,mesh,material,pack,dispose};
}

export function makePetModel(kit,id='bunny',accent='#ee916f'){
  const {ball,box,cone,cylinder}=kit,group=new THREE.Group();
  const fur=id==='panda'?'#f5efe1':id==='chick'?'#ffdf81':id==='puppy'?'#c49773':id==='frog'?'#91b99a':id==='cat'?'#e9baa1':'#f7e9cd';
  cylinder(group,accent,0,.05,0,.34,.09);
  ball(group,fur,0,.38,0,.25,.29,.22);ball(group,fur,0,.69,.02,.29,.25,.24);
  ball(group,fur,-.16,.17,.1,.13,.085,.16);ball(group,fur,.16,.17,.1,.13,.085,.16);
  if(id==='bunny'){
    for(const x of [-.13,.13]){ball(group,fur,x,1.01,0,.082,.27,.065);ball(group,'#dfa99e',x,1.015,.051,.039,.18,.014)}
  }else if(id==='cat'||id==='fox'){
    for(const x of [-.2,.2])cone(group,fur,x,.94,0,.115,.24,4);
  }else if(id!=='chick'&&id!=='frog'){
    for(const x of [-.24,.24])ball(group,id==='panda'?'#4d5555':fur,x,.83,0,.13,id==='puppy'?.21:.13,.1);
  }
  for(const x of [-.105,.105]){ball(group,'#344a4b',x,.72,.236,.032);ball(group,'#ffffff',x-.008,.733,.261,.009);ball(group,'#e8ad9d',x*1.65,.635,.218,.051,.031,.014)}
  ball(group,id==='chick'?'#e49b55':'#ad7d6c',0,.64,.27,.033,.021,.025);
  box(group,accent,0,.49,.16,.36,.07,.15);box(group,accent,.12,.39,.21,.08,.2,.05);
  return kit.pack(group);
}

export function makeBuilding(kit,type='word',level=1,color=ISLAND_COLORS[type]){
  const {box,cylinder,cone,ball}=kit,g=new THREE.Group();
  const h=.33+(level-1)*.23;
  if(type==='event'){
    box(g,'#bf865c',0,.16,0,.5,.3,.34);box(g,'#f2c66d',0,.32,0,.53,.1,.38);box(g,'#f5de9b',0,.2,.18,.07,.15,.025);
  }else if(type==='start'){
    box(g,'#fbefce',0,.08,0,.66,.14,.52);cylinder(g,'#a2835f',-.23,.53,0,.025,.8);box(g,'#e6a96b',-.06,.8,0,.32,.18,.025);
  }else if(type==='boss'){
    box(g,'#f0e6d5',0,.29,0,.58,.55,.5);cone(g,color,0,.73,0,.46,.4,4).rotation.y=Math.PI/4;
    for(const x of [-.31,.31]){cylinder(g,'#ded6c4',x,.35,.12,.12,.66);cone(g,color,x,.78,.12,.18,.24,8)}
    box(g,'#646275',0,.17,.26,.13,.24,.02);
  }else{
    box(g,'#f4e6ca',0,h/2,0,.52,h,.46);
    if(type==='training'){
      cone(g,color,0,h+.18,0,.47,.4,4).rotation.y=Math.PI/4;
      box(g,'#fff4dc',0,h+.22,.35,.12,.17,.015);
    }else if(type==='shop'){
      box(g,color,0,h+.03,0,.62,.09,.56);
      for(let i=0;i<5;i++)box(g,i%2?'#f6e8d0':color,(i-2)*.115,h-.065,.31,.112,.06,.27);
    }else if(type==='grammar'){
      cone(g,color,0,h+.23,0,.39,.48,4).rotation.y=Math.PI/4;
      cylinder(g,'#f8eccf',0,h+.5,0,.028,.16);
    }else{
      const roof=cone(g,color,0,h+.13,0,.43,.32,4);roof.rotation.y=Math.PI/4;roof.scale.z*=.9;
    }
    box(g,'#7b8f8d',.12,.115,.239,.12,.22,.018);
    for(let j=0;j<level;j++)for(const x of [-.13,.12])box(g,'#849eac',x,.24+j*.22,.236,.095,.105,.012);
    if(level>=2)box(g,color,0,.31,.285,.58,.05,.16);
    if(level===3)ball(g,'#e4b853',0,h+.49,0,.065);
  }
  return kit.pack(g);
}

export function addIslandScenery(kit,world){
  const {box,ball,cylinder,cone}=kit;
  // Terraced island with rounded, hand-built edges and a sheltered central village.
  cylinder(world,'#d7c9a2',0,-.42,0,5.72,.65,5.62).scale.z=.96;
  box(world,'#ecdfb8',0,-.05,0,9.35,.32,9.35);
  box(world,'#a7bdaa',0,.16,0,8.94,.25,8.94);
  box(world,'#f2e6c5',0,.3,0,6.72,.13,6.72);
  box(world,'#b9c99e',0,.38,0,6.4,.13,6.4);
  const tree=(x,z,s=1)=>{const t=new THREE.Group();cylinder(t,'#9c8060',0,.25,0,.07,.5);ball(t,'#709d85',0,.75,0,.39,.56,.39);ball(t,'#95b399',-.12,.95,.04,.26,.32,.27);t.position.set(x,.4,z);t.scale.setScalar(s);world.add(t)};
  [[-2.6,-2.5,1.2],[-1.8,-2.6,.8],[2.5,-2.3,1],[2.5,2.4,1.2],[-2.6,1.9,1],[-2,2.7,.8],[2,-2.7,.7]].forEach(a=>tree(...a));
  box(world,'#d6caad',0,.47,1.25,3.5,.05,.62);
  box(world,'#d6caad',.1,.47,0,.6,.05,4.1);
  const hall=new THREE.Group();box(hall,'#fff0d2',0,.72,0,1.48,1.4,.94);cone(hall,'#d78672',0,1.64,0,1.16,.8,4).rotation.y=Math.PI/4;
  box(hall,'#fff0d2',0,1.91,0,.46,.65,.46);cone(hall,'#699a91',0,2.41,0,.47,.46,4).rotation.y=Math.PI/4;
  cylinder(hall,'#f6e7bf',0,2.09,.245,.145,.035).rotation.x=Math.PI/2;
  box(hall,'#6a8783',0,2.13,.271,.014,.13,.01);box(hall,'#6a8783',.04,2.085,.271,.085,.014,.01);
  box(hall,'#738f8b',0,.34,.485,.28,.65,.02);
  for(const x of [-.49,.49]){box(hall,'#82a4ae',x,.86,.485,.25,.36,.02);box(hall,'#f0ddaa',x,.86,.499,.025,.38,.02)}
  hall.position.set(-.6,.43,-1.08);hall.rotation.y=.2;world.add(hall);
  // Fountain, hedges, flower planters, park bench.
  cylinder(world,'#e4d8ba',1.3,.5,1.2,.68,.17);cylinder(world,'#8cc6ce',1.3,.6,1.2,.57,.05);
  cylinder(world,'#f0e8ce',1.3,.81,1.2,.12,.44);ball(world,'#a8dce1',1.3,1.14,1.2,.19,.24,.19);
  for(let i=0;i<6;i++)ball(world,'#90b080',-2.3+i*.3,.65,.3,.2,.22,.21);
  for(const x of [-1.8,-1.35,-.9]){box(world,'#bc8b69',x,.53,2.2,.3,.18,.28);ball(world,'#d99485',x,.7,2.2,.17,.12,.16)}
  box(world,'#c89b70',-.8,.7,1.8,.9,.1,.32);box(world,'#c89b70',-.8,.9,1.65,.9,.3,.05);
  // Lighthouse, pier and a small sailboat on the surrounding water.
  cylinder(world,'#f3e9d4',-4.85,.12,-3.9,.3,1.5,.23);cylinder(world,'#d68b78',-4.85,.48,-3.9,.275,.25,.26);
  cylinder(world,'#718f98',-4.85,1,-3.9,.29,.32);cone(world,'#cf8b75',-4.85,1.3,-3.9,.38,.28);
  for(let i=0;i<7;i++)box(world,'#bda384',4.9+i*.16,-.16,1.8,.13,.08,.65);
  const boat=new THREE.Group();ball(boat,'#f1e4c9',0,0,0,.52,.13,.21);cylinder(boat,'#937960',0,.52,0,.022,1.04);
  const sail=cone(boat,'#faf0d3',.18,.62,0,.36,.66,3);sail.scale.z=.055;sail.rotation.y=Math.PI/2;
  boat.position.set(5.25,-.39,-2.2);boat.rotation.y=-.35;world.add(boat);
  const balloon=new THREE.Group();ball(balloon,'#e8b67b',0,0,0,.39,.49,.39);ball(balloon,'#f8dc9f',.15,.04,.07,.25,.39,.25);box(balloon,'#ae8563',0,-.66,0,.2,.15,.2);
  for(const x of [-.075,.075])cylinder(balloon,'#c4b79c',x,-.47,0,.008,.32);
  balloon.position.set(2.8,3.2,-2.1);world.add(balloon);
  return {boat,balloon};
}
