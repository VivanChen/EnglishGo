// Original, reproducible implicit-surface animal sculptures. No third-party models.
import { mkdir, writeFile } from 'node:fs/promises';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { MeshStandardMaterial, Color, Vector3 } from 'three';

const root = new URL('../public/models/companions/', import.meta.url);
await mkdir(root, { recursive: true });
const forms = {
  kitty: [[0,.50,-.15,.32,.39,.46],[0,.80,.22,.23,.34,.25],[0,1.08,.37,.33,.30,.29],[0,.98,.61,.20,.12,.14],[-.22,1.36,.34,.095,.20,.10],[.22,1.36,.34,.095,.20,.10],[-.18,.25,.28,.082,.25,.095],[.18,.25,.28,.082,.25,.095],[-.24,.22,-.38,.15,.23,.22],[.24,.22,-.38,.15,.23,.22],[-.18,.065,.35,.11,.075,.16],[.18,.065,.35,.11,.075,.16]],
  bunny: [[0,.46,-.15,.34,.39,.43],[0,.73,.2,.24,.30,.24],[0,1.00,.38,.30,.28,.27],[0,.90,.61,.18,.11,.13],[-.14,1.38,.31,.085,.40,.085],[.14,1.40,.31,.085,.42,.085],[-.17,.19,.28,.09,.19,.12],[.17,.19,.28,.09,.19,.12],[-.26,.15,-.23,.17,.18,.27],[.26,.15,-.23,.17,.18,.27],[-.17,.065,.38,.10,.07,.17],[.17,.065,.38,.10,.07,.17],[0,.46,-.57,.17,.18,.17]],
  puppy: [[0,.51,-.15,.34,.39,.48],[0,.79,.22,.26,.30,.25],[0,1.05,.37,.32,.30,.30],[0,.95,.64,.21,.14,.17],[-.30,1.07,.30,.12,.30,.10],[.30,1.07,.30,.12,.30,.10],[-.19,.23,.28,.10,.24,.12],[.19,.23,.28,.10,.24,.12],[-.25,.22,-.38,.16,.23,.22],[.25,.22,-.38,.16,.23,.22],[-.19,.065,.37,.12,.07,.17],[.19,.065,.37,.12,.07,.17]]
};
let seed = 173;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function coat(kind,x,y,z){
  let hex=kind==='puppy'?'#c8a27c':'#edeaf1';
  if(kind==='puppy'&&Math.abs(x)>.27&&y>.8)hex='#8c6551';
  if(kind==='bunny'&&y>1.25&&z>.33&&Math.abs(x)>.08)hex='#d9aebc';
  if(kind==='kitty'&&y>1.32&&z>.35)hex='#d9aebc';
  const color=new Color(hex);color.multiplyScalar(.97+random()*.06);return color.toArray();
}
function exportGlb(primitives){
  const chunks=[],views=[],accessors=[];let offset=0;
  const meshes=primitives.map(({pos,norm,col,fur})=>{
    const attributes={};
    for(const [name,values] of [['POSITION',pos],['NORMAL',norm],['COLOR_0',col]]){
      const array=new Float32Array(values),data=Buffer.from(array.buffer);
      const view=views.push({buffer:0,byteOffset:offset,byteLength:data.length,target:34962})-1;chunks.push(data);offset+=data.length;
      const accessor={bufferView:view,componentType:5126,count:array.length/3,type:'VEC3'};
      if(name==='POSITION'){accessor.min=[Infinity,Infinity,Infinity];accessor.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<array.length;i++){const a=i%3;accessor.min[a]=Math.min(accessor.min[a],array[i]);accessor.max[a]=Math.max(accessor.max[a],array[i]);}}
      attributes[name]=accessors.push(accessor)-1;
    }
    return {attributes,material:fur?1:0,mode:4};
  });
  const json={asset:{version:'2.0',generator:'EnglishGo original companion sculptures'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:meshes}],materials:[{name:'Matte natural coat',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.96}},{name:'Fine fur',doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:1}}],buffers:[{byteLength:offset}],bufferViews:views,accessors};
  const raw=Buffer.from(JSON.stringify(json)),padding=(4-raw.length%4)%4,j=Buffer.concat([raw,Buffer.alloc(padding,32)]),bin=Buffer.concat(chunks);
  const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+j.length+8+bin.length,8);
  const jh=Buffer.alloc(8);jh.writeUInt32LE(j.length);jh.writeUInt32LE(0x4e4f534a,4);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,jh,j,bh,bin]);
}
for(const [kind,parts] of Object.entries(forms)){
  const resolution=88,mc=new MarchingCubes(resolution,new MeshStandardMaterial(),false,false,60000);mc.isolation=0;
  for(let iz=0;iz<resolution;iz++)for(let iy=0;iy<resolution;iy++)for(let ix=0;ix<resolution;ix++){
    const x=(ix/resolution*2-1)*1.8,y=(iy/resolution*2-1)*1.8+1,z=(iz/resolution*2-1)*1.8;
    let distance=10;
    for(const [cx,cy,cz,rx,ry,rz] of parts){const d=(Math.sqrt(((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2)-1)*Math.min(rx,ry,rz);const h=Math.max(.065-Math.abs(distance-d),0)/.065;distance=Math.min(distance,d)-h*h*.065*.25;}
    mc.field[iz*resolution*resolution+iy*resolution+ix]=-distance;
  }
  mc.update();
  const pos=[],norm=[],col=[],source=mc.geometry.attributes.position.array,ns=mc.geometry.attributes.normal.array;
  for(let i=0;i<mc.count;i++){const x=source[i*3]*1.8,y=source[i*3+1]*1.8+1,z=source[i*3+2]*1.8;pos.push(x,y,z);const n=new Vector3(ns[i*3],ns[i*3+1],ns[i*3+2]).normalize();norm.push(...n.toArray());col.push(...coat(kind,x,y,z));}
  const glb=exportGlb([{pos,norm,col}]);await writeFile(new URL(`${kind}.glb`,root),glb);console.log(`${kind}: ${mc.count/3} surface triangles, ${(glb.length/1024/1024).toFixed(2)} MB`);mc.geometry.dispose();mc.material.dispose();
}
