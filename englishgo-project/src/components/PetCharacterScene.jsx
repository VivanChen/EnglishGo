import {useEffect,useRef,useState} from 'react';
import PetCompanion from './PetCompanion.jsx';

// A shared live character renderer for the profile and care scenes.
export default function PetCharacterScene({petId,motion='full',interactive=false,reaction, activity, washed=[], foodId, bites=0, restStage=0, targetRef, onPet, onStatus}) {
 const host=useRef(null),runtime=useRef(null),latest=useRef({reaction,onPet,activity});latest.current={reaction,onPet,activity,targetRef,restStage,bites,foodId,washed};
 const [status,setStatus]=useState('loading');
 useEffect(()=>{onStatus?.(status)},[status,onStatus]);
 useEffect(()=>{
  let disposed=false,cleanup=()=>{};
  setStatus('loading');
  if(/jsdom/i.test(navigator.userAgent)){setStatus('fallback');return;}
  Promise.all([import('three'),import('three/addons/loaders/GLTFLoader.js'),import('./petIslandModels.js')]).then(async([T,{GLTFLoader},{createModelKit,makePetModel}])=>{
   if(disposed)return;
   let renderer;try{renderer=new T.WebGLRenderer({antialias:true,alpha:true})}catch{setStatus('fallback');return;}
   const scene=new T.Scene(),camera=new T.PerspectiveCamera(31,1,.1,30),kit=createModelKit(),actor=new T.Group();
   scene.add(actor);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
   host.current.appendChild(renderer.domElement);
   cleanup=()=>{renderer.dispose();renderer.domElement.remove();kit.dispose()};
   scene.add(new T.HemisphereLight('#d7eaff','#34445f',2.2));
   const light=new T.DirectionalLight('#fff1e2',3.2);light.position.set(-3,5,4);scene.add(light);
   const rim=new T.DirectionalLight('#91bdff',2.8);rim.position.set(2,3,-3);scene.add(rim);
   const ownedGeometries=new Set(),ownedMaterials=new Set();
   const mesh=(geometry,material,parent=actor)=>{ownedGeometries.add(geometry);ownedMaterials.add(material);const m=new T.Mesh(geometry,material);parent.add(m);return m};
   const sphere=(color,x,y,z,sx,sy=sx,sz=sx,gloss=false)=>{const m=mesh(new T.SphereGeometry(1,32,24),new T.MeshStandardMaterial({color,roughness:gloss?.12:.85,metalness:0}));m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m};
   let tail;const eyelids=[];
   const loadId=petId==='cat'?'kitty':petId;
   let loaded;
   if(['kitty','bunny','puppy'].includes(loadId)){
    try{loaded=await new GLTFLoader().loadAsync(`/models/companions/${loadId}.glb`)}catch{}
   }
   if(disposed){if(loaded)loaded.scene.traverse(n=>{n.geometry?.dispose();if(n.material)(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose())});renderer.dispose();renderer.domElement.remove();kit.dispose();return;}
   if(loaded){
    actor.add(loaded.scene);loaded.scene.traverse(n=>{if(n.geometry)ownedGeometries.add(n.geometry);if(n.material)ownedMaterials.add(n.material)});
    const y=loadId==='bunny'?1.035:loadId==='puppy'?1.08:1.115,z=loadId==='bunny'?.595:.613;
    for(const side of [-1,1]){
     const start=actor.children.length;
     const eye=sphere('#3b3349',side*.147,y,z,.076,.088,.038,true);eye.rotation.y=side*.29;
     sphere('#0c1425',side*.147,y,z+.028,.043,.057,.015,true);
     sphere('#ffffff',side*.147-.019,y+.026,z+.045,.021,.021,.012,true);
     sphere('#b0c3ef',side*.147+.019,y-.025,z+.043,.009,.009,.006,true);
     const lid=new T.Group();lid.position.y=y;actor.add(lid);for(const part of actor.children.slice(start,start+4))lid.attach(part);eyelids.push(lid);
     sphere('#e2b7c2',side*.208,y-.088,z-.013,.053,.025,.012);
    }
    const noseY=loadId==='bunny'?.935:loadId==='puppy'?.99:1.02;
    sphere(loadId==='puppy'?'#3c3544':'#cc8fa4',0,noseY,loadId==='puppy'?.802:.734,.037,.025,.025,true);
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.043,noseY-.037,.73),new T.Vector3(0,noseY-.049,.741),new T.Vector3(.043,noseY-.037,.73)]),16,.005,6,false),new T.MeshStandardMaterial({color:'#9c7589'}));
    if(loadId!=='bunny'){
     tail=new T.Group();tail.position.set(.12,.35,-.47);actor.add(tail);
     const curve=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.27,.02,-.23),new T.Vector3(.57,.20,-.32),new T.Vector3(.65,.50,-.22),new T.Vector3(.57,.67,-.12)]);
     mesh(new T.TubeGeometry(curve,36,loadId==='puppy'?.065:.105,14,false),new T.MeshStandardMaterial({color:loadId==='puppy'?'#c8a27c':'#edeaf1',roughness:.9}),tail);
    }
   }else{
    actor.add(makePetModel(kit,({froggy:'frog'})[petId]||petId,'#c6adc9'));actor.scale.setScalar(1.25);
   }
   const ring=mesh(new T.RingGeometry(1.08,1.087,100),new T.MeshBasicMaterial({color:'#d4cba0',transparent:true,opacity:.45,side:T.DoubleSide}),scene);ring.rotation.x=-Math.PI/2;ring.position.y=.005;
   // Soft contact shadow without external texture requests.
   const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d');const grad=ctx.createRadialGradient(64,64,3,64,64,64);grad.addColorStop(0,'rgba(0,5,20,.65)');grad.addColorStop(1,'rgba(0,5,20,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);const shadowTexture=new T.CanvasTexture(shadowCanvas);
   const shadow=mesh(new T.PlaneGeometry(2,1.65),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}),scene);shadow.rotation.x=-Math.PI/2;shadow.position.set(0,.006,0);
   const cushion=mesh(new T.CylinderGeometry(.72,.75,.10,48),new T.MeshStandardMaterial({color:'#7f8da9',roughness:1}),scene);cushion.position.y=-.015;cushion.scale.z=.85;cushion.visible=false;
   const blanket=mesh(new T.SphereGeometry(1,32,20),new T.MeshStandardMaterial({color:'#93b9c5',roughness:1}),actor);blanket.position.set(0,.20,.25);blanket.scale.set(.40,.16,.43);blanket.visible=false;
   const ball=mesh(new T.SphereGeometry(.075,24,16),new T.MeshStandardMaterial({color:'#c9e97e',roughness:.75}),scene);ball.visible=false;
   const book=new T.Group();scene.add(book);book.position.set(0,.18,.85);book.rotation.x=.12;
   for(const side of [-1,1]){const leaf=new T.Group();book.add(leaf);leaf.rotation.z=side*-.10;const cover=mesh(new T.BoxGeometry(.32,.035,.40),new T.MeshStandardMaterial({color:'#508f9a',roughness:.9}),leaf);cover.position.x=side*.16;const paper=mesh(new T.BoxGeometry(.30,.028,.37),new T.MeshStandardMaterial({color:'#fff0cb',roughness:1}),leaf);paper.position.set(side*.16,.03,0);for(let row=0;row<4;row++){const line=mesh(new T.BoxGeometry(.20,.003,.006),new T.MeshStandardMaterial({color:'#9aabac'}),leaf);line.position.set(side*.16,.047,-.10+row*.055)}}
   const bowl=new T.Group();scene.add(bowl);bowl.position.set(-.38,.12,.40);
   mesh(new T.CylinderGeometry(.23,.18,.12,40),new T.MeshStandardMaterial({color:'#8eafb9',roughness:.7}),bowl);
   const rimBowl=mesh(new T.TorusGeometry(.215,.027,12,40),new T.MeshStandardMaterial({color:'#e3e6d4',roughness:.65}),bowl);rimBowl.rotation.x=Math.PI/2;rimBowl.position.y=.065;
   const portions=[];for(let i=0;i<3;i++){const morsel=mesh(new T.SphereGeometry(.066,18,12),new T.MeshStandardMaterial({color:'#d99567',roughness:.9}),bowl);morsel.position.set(Math.cos(i*Math.PI*2/3)*.09,.09,Math.sin(i*Math.PI*2/3)*.09);portions.push(morsel)}
   const bathFoam=[];
   for(const [x,y,z] of [[-.28,.72,.38],[.28,.72,.38],[-.18,.28,.51],[.18,.28,.51]]){
    const patch=new T.Group();actor.add(patch);patch.position.set(x,y,z);
    for(let i=0;i<3;i++){const bubble=mesh(new T.SphereGeometry(.075+i*.014,18,12),new T.MeshStandardMaterial({color:i===1?'#cdeffa':'#edfaff',roughness:.2,transparent:true,opacity:.72,metalness:.05}),patch);bubble.position.set((i-1)*.065,i%2*.07,0)}
    bathFoam.push(patch);
   }
   let angle=.35,zoom=1,down=null,frame,last=0,petTime=-5000,visible=true;
   const resize=()=>{if(!host.current)return;const w=host.current.clientWidth,h=host.current.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.position.set(0,1.5,Math.max(loadId==='bunny'?4.2:3.7,2.4/camera.aspect)/zoom);camera.lookAt(0,loadId==='bunny'?.93:.85,0);camera.updateProjectionMatrix();renderer.setSize(w,h,false)};
   const observer=new ResizeObserver(resize);observer.observe(host.current);resize();
   const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting});visibility.observe(host.current);
   const pointerDown=e=>{if(!interactive)return;down={x:e.clientX,previous:e.clientX,moved:0};renderer.domElement.setPointerCapture(e.pointerId)};
   const pointerMove=e=>{if(!down)return;angle+=(e.clientX-down.previous)*.012;down.moved+=Math.abs(e.clientX-down.previous);down.previous=e.clientX};
   const pet=()=>{petTime=performance.now();latest.current.onPet?.()};
   const pointerUp=()=>{if(down&&down.moved<5)pet();down=null};
   const cancel=()=>{down=null};
   const lost=e=>{e.preventDefault();cancelAnimationFrame(frame);setStatus('fallback')};
   renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointercancel',cancel);renderer.domElement.addEventListener('webglcontextlost',lost);
   const reduce=matchMedia('(prefers-reduced-motion: reduce)');
   runtime.current={turn:d=>{angle+=d},zoom:d=>{zoom=T.MathUtils.clamp(zoom+d,.85,1.2);resize()},reset:()=>{angle=.35;zoom=1;resize()},pet};
   const draw=time=>{if(disposed)return;frame=requestAnimationFrame(draw);if(document.hidden||!visible||time-last<32)return;last=time;
    const moving=motion==='full'&&!reduce.matches;const response=Math.max(0,1-(time-Math.max(petTime,latest.current.reaction?.current||-5000))/(latest.current.activity==='play'?1200:850));
    actor.rotation.y=angle+(moving?Math.sin(time*.0005)*.04:0);actor.rotation.z=moving?Math.sin(response*Math.PI*3)*response*.035:0;actor.position.y=moving?Math.sin(time*.002)*.007:0;
    const resting=latest.current.activity==='sleep';const restStep=resting?latest.current.restStage:0;
    light.intensity=restStep>=1?1.5:3.2;rim.intensity=restStep>=1?1.3:2.8;cushion.visible=restStep>=1;blanket.visible=restStep>=2;
    const blink=restStep>=2?.08:moving&&time%4400>4250?Math.max(.08,Math.abs((time%4400-4325)/75)):1;eyelids.forEach(lid=>{lid.scale.y=blink});
    actor.rotation.x=moving&&latest.current.activity==='feed'?Math.sin(response*Math.PI*2)*response*.09:0;
    if(tail)tail.rotation.y=moving&&!resting?Math.sin(time*.002)*(response?.32:.14):0;
    const target=latest.current.targetRef?.current;
    if(target){actor.updateMatrixWorld(true);const mouth=new T.Vector3(0,loaded?(loadId==='bunny'?.895:loadId==='puppy'?.95:.98):.63,loaded?.77:.27).applyMatrix4(actor.matrixWorld).project(camera);target.style.left=`${(mouth.x+1)*50}%`;target.style.top=`${(1-mouth.y)*50}%`;}
    const fetching=latest.current.activity==='play'&&response>0;
    const phase=1-response;
    ball.visible=fetching;
    if(fetching){ball.position.set(moving?Math.sin(phase*Math.PI*2)*.72:0,.12+(moving?Math.abs(Math.sin(phase*Math.PI*3))*.4:0),1.1);actor.position.x=moving?Math.sin(phase*Math.PI*2)*.18:0;actor.rotation.y+=moving?Math.sin(phase*Math.PI*2)*.2:0;actor.position.y+=moving?Math.sin(phase*Math.PI)*.06:0;}
    else actor.position.x=0;
    if(resting){actor.rotation.z=0;actor.rotation.y=angle;actor.position.y=restStep>=2&&moving?Math.sin(time*.0012)*.005:0;}
    bowl.visible=latest.current.activity==='feed';portions.forEach((portion,i)=>{portion.visible=i>=latest.current.bites;portion.material.color.set(({apple:'#e25e65',banana:'#eed077',fish:'#91c5d1',meat:'#c88172',milk:'#f1ede1',bread:'#d3a570',cake:'#eab1c7',carrot:'#ec9453'})[latest.current.foodId]||'#d99567')});
    const bathing=latest.current.activity==='clean';bathFoam.forEach((patch,i)=>{patch.visible=bathing&&!latest.current.washed.includes(i);patch.scale.setScalar(moving?1+Math.sin(time*.002+i)*.05:1)});
    if(bathing){actor.rotation.y=.12;actor.rotation.z=moving?Math.sin(response*Math.PI*2)*response*.025:0;}
    book.visible=latest.current.activity==='study';
    if(book.visible){actor.rotation.y=.12;actor.rotation.x=moving?Math.sin(response*Math.PI)*.08:0;book.rotation.z=moving?Math.sin(response*Math.PI)*.035:0;}
    renderer.render(scene,camera);
   };frame=requestAnimationFrame(draw);setStatus('ready');
   cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();runtime.current=null;renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointercancel',cancel);renderer.domElement.removeEventListener('webglcontextlost',lost);ownedGeometries.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());shadowTexture.dispose();kit.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()};
  }).catch(()=>{cleanup();if(!disposed)setStatus('fallback')});
  return()=>{disposed=true;cleanup()};
 },[petId,motion,interactive]);
 return <div className={`pet-character ${interactive?'is-interactive':''}`} data-testid="pet-character" data-renderer={status}>
  <div ref={host} className="pet-character-canvas" aria-hidden="true" style={{visibility:status==='fallback'?'hidden':undefined}}/>
  {status==='loading'&&<span className="pet-character-loading" role="status">夥伴正在走過來…</span>}
  {status==='fallback'&&<div className="pet-character-fallback"><PetCompanion petId={petId} size={240}/><small>目前使用平面夥伴</small></div>}
  {interactive&&<div className="pet-character-tools" aria-label="寵物視角"><button aria-label="向左旋轉寵物" disabled={status!=='ready'} onClick={()=>runtime.current?.turn(-.4)}>↶</button><button aria-label="摸摸寵物" onClick={()=>status==='ready'?runtime.current?.pet():onPet?.()}>♡</button><button aria-label="向右旋轉寵物" disabled={status!=='ready'} onClick={()=>runtime.current?.turn(.4)}>↷</button><button aria-label="重設寵物視角" disabled={status!=='ready'} onClick={()=>runtime.current?.reset()}>⟳</button></div>}
 </div>;
}
