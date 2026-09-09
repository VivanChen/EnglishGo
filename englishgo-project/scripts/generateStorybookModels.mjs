// Original, reproducible implicit-surface animal sculptures. No third-party models.
import { mkdir, writeFile } from 'node:fs/promises';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { MeshStandardMaterial, Color, Vector3 } from 'three';

const root = new URL('../public/models/storybook/', import.meta.url);
await mkdir(root, { recursive: true });
const forms = {
  fox: [[0,.72,-.12,.3,.36,.65],[0,.92,.4,.24,.36,.3],[0,1.18,.67,.27,.25,.3],[0,1.08,.96,.15,.13,.3],[-.18,1.46,.62,.10,.3,.12],[.18,1.46,.62,.10,.3,.12],[-.21,.35,.35,.085,.37,.105],[.21,.35,.35,.085,.37,.105],[-.22,.34,-.52,.10,.33,.14],[.22,.34,-.52,.10,.33,.14],[-.21,.07,.43,.1,.065,.17],[.21,.07,.43,.1,.065,.17],[-.22,.07,-.46,.1,.065,.15],[.22,.07,-.46,.1,.065,.15],[.13,.56,-.78,.21,.25,.38],[.27,.38,-1.12,.24,.24,.35],[.36,.28,-1.4,.17,.16,.3]],
  rabbit: [[0,.48,-.15,.35,.42,.46],[0,.75,.24,.25,.3,.25],[0,.93,.43,.24,.23,.24],[0,.83,.64,.15,.12,.15],[-.12,1.28,.38,.085,.38,.09],[.13,1.29,.36,.085,.4,.09],[-.21,.12,.21,.09,.15,.22],[.21,.12,.21,.09,.15,.22],[-.27,.16,-.27,.16,.18,.32],[.27,.16,-.27,.16,.18,.32],[0,.48,-.59,.16,.17,.17]],
  bear: [[0,.77,-.15,.47,.5,.64],[0,1.02,.42,.37,.38,.4],[0,1.21,.71,.34,.31,.32],[0,1.09,.96,.22,.18,.24],[-.26,1.48,.61,.13,.15,.12],[.26,1.48,.61,.13,.15,.12],[-.32,.3,.4,.16,.37,.2],[.32,.3,.4,.16,.37,.2],[-.34,.28,-.6,.18,.34,.2],[.34,.28,-.6,.18,.34,.2],[-.32,.08,.52,.17,.1,.24],[.32,.08,.52,.17,.1,.24],[-.34,.08,-.5,.19,.1,.24],[.34,.08,-.5,.19,.1,.24],[0,.72,-.77,.13,.14,.15]],
};
let seed = 173;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function coat(kind,x,y,z){
  let hex=kind==='fox'?'#a94e1f':kind==='bear'?'#69503b':'#8c8073';
  if(kind==='fox'){
    if((y<.24&&z>-.75)||(y>1.47))hex='#352b25';
    else if(z< -1.31 || (z>.46&&y<1.12&&Math.abs(x)<.18))hex='#ddd2b7';
    else if(y>.9&&z<.2)hex='#754427';
  }
  if(kind==='bear'&&z>.9)hex='#a68b65';
  if(kind==='rabbit'&&((z>.47&&y<.87)||z<-.55))hex='#d7cebf';
  const color=new Color(hex);color.multiplyScalar(.88+random()*.24);return color.toArray();
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
  const json={asset:{version:'2.0',generator:'EnglishGo original implicit woodland sculptures'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:meshes}],materials:[{name:'Matte natural coat',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.96}},{name:'Fine fur',doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:1}}],buffers:[{byteLength:offset}],bufferViews:views,accessors};
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
  const fur={pos:[],norm:[],col:[],fur:true};
  for(let i=0;i<14000;i++){
    const tri=Math.floor(random()*mc.count/3)*9,u=random(),v=random()*(1-u),w=1-u-v;
    const p=new Vector3(),n=new Vector3();for(let axis=0;axis<3;axis++){p.setComponent(axis,pos[tri+axis]*u+pos[tri+3+axis]*v+pos[tri+6+axis]*w);n.setComponent(axis,norm[tri+axis]*u+norm[tri+3+axis]*v+norm[tri+6+axis]*w);}n.normalize();
    if(p.y<.10)continue;
    const tangent=new Vector3().crossVectors(n,new Vector3(.1,1,.3)).normalize().multiplyScalar(.003);
    const tip=p.clone().addScaledVector(n,.017+random()*.028);tip.z-=.013;tip.y-=.008;
    const c=coat(kind,p.x,p.y,p.z);fur.pos.push(...p.clone().add(tangent).toArray(),...p.clone().sub(tangent).toArray(),...tip.toArray());for(let j=0;j<3;j++){fur.norm.push(...n.toArray());fur.col.push(...c);}
  }
  const glb=exportGlb([{pos,norm,col},fur]);await writeFile(new URL(`${kind}.glb`,root),glb);console.log(`${kind}: ${mc.count/3} surface triangles, ${(glb.length/1024/1024).toFixed(2)} MB`);mc.geometry.dispose();mc.material.dispose();
}
