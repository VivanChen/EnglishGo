import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import PictureBookArt from './PictureBookArt.jsx';

const BACKDROP = '/images/picture-books/woodland-v2.png';
const animalWords = ['fox', 'bear', 'rabbit'];
const positions = {
  night: [ [[1,0,.7],[3.1,3.45,-1.7],[3.2,0,-1.35]], [[2.05,1.7,.7],[3.55,0,.9],[.6,0,.75]], [[.5,0,.55],[3.25,0,.6],[2,2,.1]], [[2.2,3.3,-1],[3.3,0,-.65],[.65,0,.8]] ],
  day: [ [[.65,0,.45],[2.45,.15,1.1],[3.55,0,.45]], [[2.7,2.6,-.8],[3.2,0,-1.15],[.65,0,.65]], [[.5,0,.5],[2.2,.08,1.1],[3.45,0,.55]], [[2.1,3.1,-1.3],[.5,0,.6],[3.45,0,.65]] ],
};
function rng(seed = 11) { return () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }; }
function makeSurface(kind) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'), random = rng(37);
  ctx.fillStyle = kind === 'paper' ? '#e4d6b8' : kind === 'bark' ? '#5c4937' : '#b99478'; ctx.fillRect(0,0,256,256);
  for(let i=0;i<7000;i++) { const x=random()*256,y=random()*256; ctx.strokeStyle=`rgba(${kind==='bark'?'25,18,10':'90,68,44'},${random()*.2})`;ctx.lineWidth=.3+random()*.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(kind==='bark'?random()*3:random()*15),y+(kind==='bark'?random()*40:random()*2));ctx.stroke(); }
  if(kind==='fabric') { for(let i=0;i<256;i+=2){ctx.fillStyle=i%4?'#fff1d035':'#42271125';ctx.fillRect(i,0,1,256);ctx.fillRect(0,i,256,1);} for(let i=0;i<256;i+=64){ctx.fillStyle='#934d4066';ctx.fillRect(i,0,29,256);ctx.fillRect(0,i,256,29);} }
  const texture = new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(kind==='paper'?3:2,2);texture.anisotropy=4;return texture;
}
function OrganicBranch({ points, radius = .08, color = '#68513a' }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,radius,7,false),[points,radius]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={1}/></mesh>;
}
const treeBranches = [
  [[0,0,0],[.07,.7,0],[-.03,1.5,.04],[.12,2.4,.03],[.05,3,.02]],
  [[0,.9,0],[-.4,1.35,0],[-.85,1.65,.12],[-1.2,1.95,.17]],
  [[0,1.4,0],[.45,1.65,-.05],[.85,2.1,-.13]],
  [[.04,1.9,0],[-.45,2.25,-.12],[-.65,2.7,-.08]],
];
function WoodlandTree({ scale=1 }) {
  const ref=useRef();
  const leafGeometry=useMemo(()=>{const s=new THREE.Shape();s.moveTo(0,-.5);s.bezierCurveTo(-.35,-.15,-.22,.22,0,.5);s.bezierCurveTo(.22,.22,.35,-.15,0,-.5);return new THREE.ShapeGeometry(s,6);},[]);
  useEffect(()=>()=>leafGeometry.dispose(),[leafGeometry]);
  useEffect(()=>{
    const random=rng(72),dummy=new THREE.Object3D(),color=new THREE.Color();
    for(let i=0;i<500;i++){
      const angle=random()*Math.PI*2,radius=Math.sqrt(random())*1.2;
      dummy.position.set(Math.cos(angle)*radius,1.5+random()*1.4,Math.sin(angle)*radius*.6);
      dummy.rotation.set(random()*Math.PI,random()*Math.PI,random()*Math.PI);
      dummy.scale.set(.25+random()*.15,.35+random()*.16,1);dummy.updateMatrix();ref.current.setMatrixAt(i,dummy.matrix);ref.current.setColorAt(i,color.setHSL(.20+random()*.08,.25+random()*.3,.24+random()*.14,THREE.SRGBColorSpace));
    }
    ref.current.instanceMatrix.needsUpdate=true;
  },[]);
  return <group scale={scale}>{treeBranches.map((p,i)=><OrganicBranch key={i} points={p} radius={i===0?.09:.035}/>)}<instancedMesh ref={ref} args={[leafGeometry,null,500]} castShadow><meshStandardMaterial roughness={.98} side={THREE.DoubleSide}/></instancedMesh></group>;
}
function Ground({ night, textures }) {
  const grasses=useRef();
  const terrain=useMemo(()=>{
    const geometry=new THREE.RingGeometry(0,1,96,18),vertices=geometry.attributes.position;
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i),y=vertices.getY(i),angle=Math.atan2(y,x),r=Math.hypot(x,y);
      const edge=1+Math.sin(angle*11)*.025+Math.cos(angle*17)*.02;
      vertices.setXYZ(i,x*edge,y*edge,.025+Math.sin(x*19)*Math.cos(y*17)*.018+Math.sin(r*11)*.012);
    }geometry.computeVertexNormals();return geometry;
  },[]);
  useEffect(()=>()=>terrain.dispose(),[terrain]);
  const maps=useTexture(['/images/picture-books/forest-floor-color.jpg','/images/picture-books/forest-floor-normal.jpg']);
  useEffect(()=>{maps[0].colorSpace=THREE.SRGBColorSpace;maps.forEach(map=>{map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(2,2);map.needsUpdate=true;});},[maps]);
  useEffect(()=>{
    const random=rng(85),dummy=new THREE.Object3D(),color=new THREE.Color();
    for(let i=0;i<650;i++){
      const angle=random()*Math.PI*2,r=Math.sqrt(random());let x=1.2+Math.cos(angle)*3.15*r,z=Math.sin(angle)*2.15*r;
      // Keep the picnic blanket and the animals' feet clear.
      if(!night&&x>.2&&z>-.3&&z<1.5){x=-1-r;z=-1-r;}
      dummy.position.set(x,.13,z);dummy.rotation.set(.08,random()*Math.PI*2,(random()-.5)*.7);dummy.scale.set(.015+random()*.02,.09+random()*.12,.015);dummy.updateMatrix();grasses.current.setMatrixAt(i,dummy.matrix);grasses.current.setColorAt(i,color.setHSL(.19+random()*.1,.23+random()*.2,.17+random()*.16));
    }grasses.current.instanceMatrix.needsUpdate=true;
  },[night]);
  const pebbles=useMemo(()=>{const random=rng(99);return Array.from({length:32},()=>({x:-1.5+random()*5.5,z:-2+random()*4,s:.035+random()*.08}));},[]);
  return <group>
    <mesh geometry={terrain} position={[1.1,.045,0]} rotation={[-Math.PI/2,0,0]} scale={[3.15,2.15,1]} receiveShadow><meshStandardMaterial color="#a9b29a" roughness={1} map={maps[0]} normalMap={maps[1]} normalScale={[1,1]}/></mesh>
    <instancedMesh ref={grasses} args={[null,null,650]}><coneGeometry args={[1,1,3]}/><meshStandardMaterial roughness={1}/></instancedMesh>
    {pebbles.map((p,i)=><mesh key={i} position={[p.x,.015,p.z]} scale={[p.s*1.4,p.s*.5,p.s]}><dodecahedronGeometry args={[1,1]}/><meshStandardMaterial color={i%2?'#716b59':'#918473'} roughness={1}/></mesh>)}
    {!night&&<mesh rotation={[-Math.PI/2,0,-.08]} position={[2,.025,.5]} receiveShadow><planeGeometry args={[3.9,2.2]}/><meshStandardMaterial map={textures.fabric} roughness={1}/></mesh>}
  </group>;
}
function Book({ night, textures }) {
  return <group>
    <RoundedBox args={[9.7,.19,6.5]} radius={.09} position={[0,-.38,0]} receiveShadow castShadow><meshStandardMaterial color={night?'#34342d':'#66563e'} map={textures.bark} roughness={.9}/></RoundedBox>
    {[-1,1].map(side=><group key={side} position={[side*2.28,-.12,0]} rotation={[0,0,side*.025]}>
      <RoundedBox args={[4.52,.28,6.25]} radius={.035} receiveShadow castShadow><meshStandardMaterial map={textures.paper} roughness={1}/></RoundedBox>
      {Array.from({length:9},(_,i)=><mesh key={i} position={[0,-.105+i*.027,3.13]}><boxGeometry args={[4.46,.004,.003]}/><meshStandardMaterial color="#a99778" roughness={1}/></mesh>)}
    </group>)}
    <mesh position={[0,-.04,0]}><boxGeometry args={[.07,.08,6.3]}/><meshStandardMaterial color="#857057" roughness={1}/></mesh>
    <mesh position={[.05,-.34,3.55]} rotation={[0,0,-.08]}><boxGeometry args={[.22,.018,1.1]}/><meshStandardMaterial color="#964f3b" roughness={1}/></mesh>
  </group>;
}
function Animal({ kind }) {
  const { scene }=useGLTF(`/models/storybook/${kind}.glb`);
  const model=useMemo(()=>{const clone=scene.clone(true);clone.traverse(obj=>{if(obj.isMesh){obj.castShadow=obj.material.name!=='Fine fur';obj.receiveShadow=true;}});return clone;},[scene]);
  const y=kind==='rabbit'?.97:kind==='bear'?1.25:1.22,z=kind==='rabbit'?.60:kind==='bear'?.94:.88,x=kind==='bear'?.24:kind==='rabbit'?.17:.19;
  return <group>
    <primitive object={model} dispose={null}/>
    {[-1,1].map(side=><group key={side} position={[side*x,y,z]}><mesh scale={[1,1.1,.65]}><sphereGeometry args={[kind==='bear'?.039:.032,16,12]}/><meshPhysicalMaterial color="#100e09" roughness={.15} clearcoat={1}/></mesh><mesh position={[-.008,.01,.022]}><sphereGeometry args={[.007,8,6]}/><meshBasicMaterial color="#fff5dc"/></mesh></group>)}
    <mesh position={[0,kind==='rabbit'?.83:kind==='bear'?1.11:1.09,kind==='rabbit'?.78:kind==='bear'?1.17:1.23]} scale={[1.3,.8,.7]}><sphereGeometry args={[kind==='rabbit'?.031:.06,16,12]}/><meshStandardMaterial color={kind==='rabbit'?'#9d7467':'#24211b'} roughness={.45}/></mesh>
  </group>;
}
function Moon(){const shape=useMemo(()=>{const s=new THREE.Shape();s.absarc(0,0,.48,Math.PI*.3,Math.PI*1.7,false);s.quadraticCurveTo(-.05,0,Math.cos(Math.PI*.3)*.48,Math.sin(Math.PI*.3)*.48);return s;},[]);return <mesh><extrudeGeometry args={[shape,{depth:.06,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:3,steps:1}]}/><meshStandardMaterial color="#fff2c5" emissive="#e6b15a" emissiveIntensity={1.3} roughness={.65}/></mesh>;}
function Star(){const shape=useMemo(()=>{const s=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.18:.4;i?s.lineTo(Math.cos(a)*r,Math.sin(a)*r):s.moveTo(Math.cos(a)*r,Math.sin(a)*r);}s.closePath();return s;},[]);return <mesh><extrudeGeometry args={[shape,{depth:.06,bevelEnabled:true,bevelSize:.035,bevelThickness:.02,bevelSegments:3,steps:1}]}/><meshStandardMaterial color="#f7d691" emissive="#edac39" emissiveIntensity={.7} metalness={.45} roughness={.3}/></mesh>;}
function Prop({ word, textures }) {
  if(animalWords.includes(word))return <Animal kind={word}/>;
  if(word==='tree')return <WoodlandTree scale={.85}/>;
  if(word==='moon')return <Moon/>;
  if(word==='star')return <Star/>;
  if(word==='flower')return <group><OrganicBranch points={[[0,0,0],[.02,.4,0],[0,.8,0]]} radius={.018} color="#586d37"/>{Array.from({length:9},(_,i)=><mesh key={i} position={[Math.cos(i*6.28/9)*.17,.82+Math.sin(i*6.28/9)*.17,0]} rotation={[.15,0,-i*6.28/9]} scale={[.06,.18,.025]}><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color="#ebe3c9" roughness={.85}/></mesh>)}<mesh position={[0,.82,.025]}><sphereGeometry args={[.085,16,12]}/><meshStandardMaterial color="#a47c2c" roughness={1}/></mesh></group>;
  if(word==='apple')return <group><mesh position={[0,.3,0]} scale={[1,.94,.93]}><sphereGeometry args={[.29,32,24]}/><meshPhysicalMaterial color="#8c2922" roughness={.4} clearcoat={.3}/></mesh><OrganicBranch points={[[0,.56,0],[.015,.65,0],[.04,.7,0]]} radius={.018}/><mesh position={[.12,.66,0]} rotation={[.3,0,-.4]} scale={[.15,.045,.07]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color="#4c6434" roughness={1}/></mesh></group>;
  if(word==='basket')return <group>{Array.from({length:11},(_,i)=><mesh key={i} rotation={[Math.PI/2,0,0]} position={[0,.06+i*.045,0]} scale={[1, .8,1]}><torusGeometry args={[.31+i*.009,.023,6,40]}/><meshStandardMaterial map={textures.bark} color="#c2a575" roughness={1}/></mesh>)}{Array.from({length:22},(_,i)=><OrganicBranch key={i} points={[[Math.cos(i*6.28/22)*.31,.05,Math.sin(i*6.28/22)*.25],[Math.cos(i*6.28/22)*.4,.52,Math.sin(i*6.28/22)*.32]]} radius={.014} color="#ad8e5d"/>)}<mesh position={[0,.5,0]}><torusGeometry args={[.37,.034,8,40,Math.PI]}/><meshStandardMaterial color="#a58658" roughness={1}/></mesh></group>;
  if(word==='bread')return <group><RoundedBox args={[.85,.33,.48]} radius={.14} position={[0,.2,0]}><meshStandardMaterial color="#b78445" map={textures.paper} roughness={1}/></RoundedBox>{[-.22,0,.22].map(x=><mesh key={x} position={[x,.36,0]} rotation={[0,.35,0]}><boxGeometry args={[.035,.012,.3]}/><meshStandardMaterial color="#e6c892" roughness={1}/></mesh>)}</group>;
  if(word==='home')return <group><RoundedBox args={[1.3,.95,1.1]} radius={.035} position={[0,.48,0]}><meshStandardMaterial color="#9d8b6b" map={textures.paper} roughness={1}/></RoundedBox>{[-1,1].map(side=><mesh key={side} position={[side*.4,1.17,0]} rotation={[0,0,-side*.62]}><boxGeometry args={[1.05,.09,1.42]}/><meshStandardMaterial color="#675440" map={textures.bark} roughness={1}/></mesh>)}<mesh position={[0,.3,.566]}><boxGeometry args={[.32,.6,.03]}/><meshStandardMaterial color="#3c4437" map={textures.bark}/></mesh>{[-.43,.43].map(x=><mesh key={x} position={[x,.63,.57]}><boxGeometry args={[.23,.28,.03]}/><meshStandardMaterial color="#f7ce8e" emissive="#ffb74e" emissiveIntensity={1}/></mesh>)}</group>;
  if(word==='rainbow')return <group>{['#c48478','#ceaa68','#8fa47c','#7d9ca6','#a39ab0'].map((color,i)=><mesh key={color} position={[0,0,-i*.02]}><torusGeometry args={[1.25-i*.105,.044,8,64,Math.PI]}/><meshStandardMaterial color={color} transparent opacity={.7} emissive={color} emissiveIntensity={.3}/></mesh>)}</group>;
  if(word==='bird')return <group><mesh scale={[.25,.2,.4]}><sphereGeometry args={[1,24,16]}/><meshStandardMaterial color="#6b7868" roughness={1}/></mesh><mesh position={[0,.2,.25]}><sphereGeometry args={[.17,20,14]}/><meshStandardMaterial color="#7b846e" roughness={1}/></mesh><mesh position={[0,.16,.43]} rotation={[Math.PI/2,0,0]}><coneGeometry args={[.04,.16,12]}/><meshStandardMaterial color="#9e8760"/></mesh>{[-1,1].map(side=><mesh key={side} position={[side*.135,.22,.33]}><sphereGeometry args={[.023,12,8]}/><meshStandardMaterial color="#17170f"/></mesh>)}</group>;
  return null;
}
function Actor({ entry, position, motion, active, onPick, textures }) {
  const ref=useRef(),elapsed=useRef(0);const floating=['star','moon','rainbow','bird'].includes(entry.word);
  useFrame((_,delta)=>{if(!motion)return;elapsed.current+=Math.min(delta,.05);ref.current.position.y=position[1]+(floating?Math.sin(elapsed.current*1.2)*.05:0);});
  const animal=animalWords.includes(entry.word);
  return <group ref={ref} position={position} rotation={[0,animal?-.65:0,0]} scale={animal?1.25:1} onClick={event=>{if(event.delta>6)return;event.stopPropagation();onPick(entry);}}>
    <Prop word={entry.word} textures={textures}/>
    {active&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.015,0]}><ringGeometry args={[.62,.65,48]}/><meshBasicMaterial color="#efcf8d" transparent opacity={.85} side={THREE.DoubleSide}/></mesh>}
  </group>;
}
function View({ view, cameraReset, motion }) {
  const controls=useRef();const {camera,size,invalidate}=useThree();
  useEffect(()=>{const mobile=size.width/size.height<1.15;camera.position.set(mobile?1.1:0,mobile?6.1:5.3,mobile?15.5:10.7);camera.lookAt(mobile?1:0,1,0);camera.updateProjectionMatrix();if(controls.current){controls.current.target.set(mobile?1:0,1,0);controls.current.update();controls.current.saveState();}invalidate();},[size.width,size.height,cameraReset,camera,invalidate]);
  useEffect(()=>{if(!motion)invalidate();},[motion,view,invalidate]);
  return <OrbitControls ref={controls} makeDefault enableZoom={false} enablePan={false} enableDamping={motion} minPolarAngle={.82} maxPolarAngle={1.22} minAzimuthAngle={-.3} maxAzimuthAngle={.3} rotateSpeed={.4}/>;
}
function Scene(props) {
  const night=props.book.theme==='night';const textures=useMemo(()=>({paper:makeSurface('paper'),bark:makeSurface('bark'),fabric:makeSurface('fabric')}),[]);
  useEffect(()=>()=>Object.values(textures).forEach(t=>t.dispose()),[textures]);
  const invalidate=useThree(s=>s.invalidate);
  useFrame(()=>{if(props.motion)invalidate();});
  return <>
    <ambientLight intensity={night?.65:.85}/>
    <directionalLight position={[-3,7,5]} color="#ffe5bb" intensity={night?2:2.8} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-normalBias={.025}/>
    <directionalLight position={[4,3,-4]} color={night?'#b0d0dc':'#e1ebd8'} intensity={1.6}/>
    <Environment resolution={64} frames={1}><Lightformer intensity={2} color="#fff0d8" position={[-3,5,3]} scale={[6,5,1]} target={[0,0,0]}/><Lightformer intensity={.6} color="#afc8d2" position={[4,3,-3]} scale={[4,4,1]} target={[0,0,0]}/></Environment>
    <group rotation={[0,props.view*.13,0]}>
      <Book night={night} textures={textures}/><Ground night={night} textures={textures}/>
      <group position={[-2.65,0,-1.6]}><WoodlandTree scale={.85}/></group>
      {props.page.objects.map((entry,i)=><Actor key={entry.word} entry={entry} position={positions[props.book.theme][props.index][i]} textures={textures} motion={props.motion} active={props.selected===entry.word||props.spokenWord?.replace(/[^a-z]/gi,'').toLowerCase()===entry.word} onPick={props.onPick}/>)}
    </group>
    <ContactShadows key={props.view} position={[0,-.5,0]} opacity={.55} scale={17} blur={2.6} far={8} resolution={256} frames={1} color="#171c13"/>
    <View {...props}/>
  </>;
}
class SceneBoundary extends Component {
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}
export default function PictureBookStage(props) {
  const host=useRef();const [visible,setVisible]=useState(true),[calm,setCalm]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setCalm(media.matches||document.documentElement.dataset.egCalm==='true');update();media.addEventListener('change',update);const mutation=new MutationObserver(update);mutation.observe(document.documentElement,{attributes:true,attributeFilter:['data-eg-calm']});const io=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting&&!document.hidden));io.observe(host.current);const visibility=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',visibility);return()=>{media.removeEventListener('change',update);io.disconnect();mutation.disconnect();document.removeEventListener('visibilitychange',visibility);};},[]);
  const fallback=<div className="pb-scene-fallback" role="status"><p>立體場景暫時無法載入，仍可使用下方單字探索與朗讀。</p><button onClick={()=>setRetry(v=>v+1)}>重新載入場景</button><div>{props.page.objects.map(o=><PictureBookArt key={o.word} word={o.word}/>)}</div></div>;
  return <div ref={host} className={`pb-world pb-world-natural ${props.book.theme}`} style={{'--pb-woodland':`url(${BACKDROP})`}}>
    <div className="pb-forest-backdrop" aria-hidden="true"/>
    <SceneBoundary key={retry} fallback={fallback}><Suspense fallback={<div className="pb-scene-loading" role="status">正在打開森林裡的故事…</div>}>
      <Canvas className="pb-webgl" shadows={{type:THREE.PCFShadowMap}} frameloop={visible?'demand':'never'} dpr={[1,1.5]} camera={{fov:43,near:.1,far:50,position:[0,5.3,10.7]}} gl={{antialias:true,alpha:true,powerPreference:'low-power'}} fallback={fallback} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=.95;gl.shadowMap.type=THREE.PCFShadowMap;gl.domElement.setAttribute('role','img');gl.domElement.setAttribute('aria-label',`${props.book.zh}，第 ${props.index+1} 幕：可拖曳轉動的立體書場景`);}}>
        <Scene {...props} motion={props.motion&&!calm&&visible}/>
      </Canvas>
    </Suspense></SceneBoundary>
  </div>;
}
