import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {ISLAND_COLORS,islandPosition,createModelKit,makePetModel,makeBuilding,addIslandScenery} from './petIslandModels.js';

export default function PetIslandScene({tiles,position=0,owned={},computers=[],petId='bunny',routes=[],selected=null,onSelect,paused=false,preview=false,moving=false}){
  const host=useRef(null),runtime=useRef(null),latest=useRef(null),[status,setStatus]=useState('loading'),[retry,setRetry]=useState(0);
  latest.current={tiles,position,owned,computers,petId,routes,selected,onSelect,paused,preview,moving};
  useEffect(()=>{
    const element=host.current;
    if(!element||typeof window.WebGL2RenderingContext==='undefined'){setStatus('fallback');return}
    element.dataset.rendered='false';
    delete element.dataset.drawCalls;
    let renderer,disposed=false,frame=0,contextUnavailable=false,observer,visibilityObserver;
    const kit=createModelKit(),scene=new THREE.Scene(),textures=[],pickable=[],buildings=[],tokens=new Map();
    const camera=new THREE.OrthographicCamera(-7,7,6,-6,.1,80);
    camera.position.set(11,13,16);camera.lookAt(0,.2,0);
    try{
      const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'low-power'});
      if(!context){kit.dispose();setStatus('fallback');return}
      renderer=new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:false,powerPreference:'low-power'});
    }catch{kit.dispose();setStatus('fallback');return}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<600?1.25:1.7));
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
    renderer.domElement.setAttribute('aria-label','立體寵物島；拖曳旋轉，點選建築查看資訊');
    renderer.domElement.setAttribute('role','img');element.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(0,.3,0);controls.enableDamping=true;controls.dampingFactor=.075;controls.enablePan=false;
    controls.minPolarAngle=.3;controls.maxPolarAngle=1.1;controls.minZoom=.8;controls.maxZoom=1.8;controls.enableZoom=false;
    // One finger rotates; zoom buttons preserve normal page scrolling and browser zoom.
    controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
    const hemisphere=new THREE.HemisphereLight('#fff5dd','#76a5a5',1.9);scene.add(hemisphere);
    const sun=new THREE.DirectionalLight('#fff0ce',2.25);sun.position.set(-5,12,8);sun.castShadow=true;
    Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:35});sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.04;scene.add(sun);
    const fill=new THREE.DirectionalLight('#adcfe8',1.4);fill.position.set(8,5,-6);scene.add(fill);
    const world=new THREE.Group();scene.add(world);
    const water=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#9ac5cc',roughness:.68,metalness:.02}));water.rotation.x=-Math.PI/2;water.position.y=-.8;water.receiveShadow=true;scene.add(water);
    const sceneryGroup=new THREE.Group();world.add(sceneryGroup);
    const scenery=addIslandScenery(kit,sceneryGroup);
    sceneryGroup.remove(scenery.boat,scenery.balloon);world.add(scenery.boat,scenery.balloon);kit.pack(sceneryGroup);
    const textureLabel=(value,color)=>{
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,128,128);ctx.fillStyle=color;ctx.font='600 58px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,64,68);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);return texture;
    };
    tiles.forEach((tile,index)=>{
      const group=new THREE.Group(),pos=islandPosition(index);group.position.copy(pos);group.position.y=.32;group.userData.tile=index;
      const tileBase=new THREE.Mesh(new RoundedBoxGeometry(1.22,.22,1.22,2,.09),new THREE.MeshStandardMaterial({color:'#f5ebd0',roughness:.85}));
      tileBase.receiveShadow=true;tileBase.castShadow=true;tileBase.userData.tile=index;group.add(tileBase);pickable.push(tileBase);
      const edge=kit.box(group,ISLAND_COLORS[tile.type],0,.127,-.51,1.02,.035,.13);
      const home=makeBuilding(kit,tile.type,1);home.position.set(0,.11,-.15);home.scale.setScalar(.93);home.traverse(object=>{object.userData.tile=index;if(object.isMesh)pickable.push(object)});group.add(home);
      const label=new THREE.Mesh(new THREE.PlaneGeometry(.25,.25),new THREE.MeshBasicMaterial({map:textureLabel(String(index+1).padStart(2,'0'),'#627674'),transparent:true,depthWrite:false}));label.rotation.x=-Math.PI/2;label.position.set(-.39,.126,.37);group.add(label);
      const ring=new THREE.Mesh(new THREE.RingGeometry(.42,.48,40),new THREE.MeshBasicMaterial({color:'#f4c569',side:THREE.DoubleSide,transparent:true,opacity:.95,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.13;ring.visible=false;group.add(ring);
      world.add(group);buildings.push({group,base:tileBase,home,edge,ring,key:'none:1',level:1});
    });
    const makeToken=(id,species,color,index)=>{const object=makePetModel(kit,species,color);object.scale.setScalar(id==='player'?.98:.84);object.position.copy(islandPosition(index));object.position.y=.47;world.add(object);tokens.set(id,{object,index,from:object.position.clone(),to:object.position.clone(),time:0,species})};
    makeToken('player',petId,'#e3976d',position);
    let lastTime=0,visible=true,lastState='',motionOff=false,dark=false;
    const theme=()=>{
      dark=document.documentElement.dataset.egTheme==='dark'||document.documentElement.dataset.theme==='dark'||document.documentElement.getAttribute('data-eg-dark')==='true'||document.body.classList.contains('dark');
      motionOff=document.documentElement.dataset.egCalm==='true'||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scene.background=new THREE.Color(dark?'#233d4c':'#bed9d7');scene.fog=new THREE.Fog(dark?'#233d4c':'#bed9d7',24,62);
      water.material.color.set(dark?'#315663':'#a8ccd0');hemisphere.intensity=dark?1.5:1.9;sun.intensity=dark?1.7:2.25;
    };
    theme();observer=new MutationObserver(theme);observer.observe(document.documentElement,{attributes:true});observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    const resize=()=>{const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;const aspect=w/h,half=aspect<1?8.8:7;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(w,h,false)};
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(element);resize();
    if(window.IntersectionObserver){visibilityObserver=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting});visibilityObserver.observe(element)}
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
    const pointerDown=event=>{down={x:event.clientX,y:event.clientY}};
    const pointerUp=event=>{
      if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>7)return;
      const bounds=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);raycaster.setFromCamera(pointer,camera);
      const hit=raycaster.intersectObjects(pickable,false).find(item=>item.object.parent);if(hit)latest.current.onSelect?.(hit.object.userData.tile);
    };
    renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
    const contextLost=event=>{event.preventDefault();contextUnavailable=true;setStatus('fallback')};renderer.domElement.addEventListener('webglcontextlost',contextLost);
    runtime.current={reset:()=>{camera.position.set(11,13,16);camera.zoom=1;camera.updateProjectionMatrix();controls.target.set(0,.3,0);controls.update()},zoom:delta=>{camera.zoom=THREE.MathUtils.clamp(camera.zoom+delta,.8,1.8);camera.updateProjectionMatrix()}};
    const animate=time=>{
      if(disposed)return;frame=requestAnimationFrame(animate);
      if(contextUnavailable||time-lastTime<32||!visible||document.hidden)return;lastTime=time;
      const state=latest.current;
      const signature=JSON.stringify([state.owned,state.computers.map(c=>[c.id,c.owned,c.active]),state.selected,state.routes,state.position,state.preview]);
      if(signature!==lastState){
        lastState=signature;
        buildings.forEach((building,i)=>{
          const tile=tiles[i],property=state.owned[tile.id],cpu=state.computers.find(c=>c.active!==false&&c.owned?.includes(tile.id));
          const owner=property?'player':cpu?.id||'none',level=property?.level||1,key=`${owner}:${level}`;
          const route=state.routes.some(r=>r.index===i),active=state.position===i&&!state.preview;
          building.ring.visible=route||active||state.selected===i;building.ring.material.color.set(route?'#efb744':state.selected===i?'#ffffff':'#e88e68');
          building.base.material.color.set(route?'#ffedaf':property?'#dce8c6':cpu?'#dce6f1':'#f5ebd0');
          if(building.key!==key){
            const old=building.home;old.traverse(node=>{const k=pickable.indexOf(node);if(k>=0)pickable.splice(k,1)});building.group.remove(old);
            const home=makeBuilding(kit,tile.type,level,property?'#74a288':cpu?cpu.color:ISLAND_COLORS[tile.type]);home.position.set(0,.11,-.15);home.scale.setScalar(.93);home.traverse(node=>{node.userData.tile=i;if(node.isMesh)pickable.push(node)});building.group.add(home);building.home=home;building.key=key;building.level=level;
          }
        });
      }
      const actors=[{id:'player',position:state.position,petId:state.petId,color:'#e3976d'},...state.computers.filter(c=>c.active!==false).map((cpu,i)=>({...cpu,petId:['cat','puppy','bunny'][i]}))];
      tokens.forEach((entry,id)=>{entry.object.visible=actors.some(a=>a.id===id)});
      actors.forEach(actor=>{
        if(!tokens.has(actor.id))makeToken(actor.id,actor.petId,actor.color,actor.position);
        let token=tokens.get(actor.id);
        if(token.species!==actor.petId){world.remove(token.object);makeToken(actor.id,actor.petId,actor.color,actor.position);token=tokens.get(actor.id)}
        if(token.index!==actor.position){token.from.copy(token.object.position);token.to.copy(islandPosition(actor.position));token.to.y=.47;token.index=actor.position;token.time=time;}
        const t=state.paused?0:Math.min(1,(time-token.time)/175);
        if(!state.paused){const ease=t*t*(3-2*t);token.object.position.lerpVectors(token.from,token.to,ease);token.object.position.y=.47+(motionOff?0:Math.sin(t*Math.PI)*.22);}
        token.object.rotation.y=.45;
      });
      if(!state.paused&&!motionOff){scenery.balloon.position.y=3.2+Math.sin(time*.0006)*.14;scenery.boat.rotation.z=Math.sin(time*.001)*.035;}
      controls.enabled=!state.paused;controls.update();renderer.render(scene,camera);
      if(element.dataset.rendered!=='true'){element.dataset.rendered='true';setStatus('ready')}
      element.dataset.drawCalls=String(renderer.info.render.calls);
    };
    frame=requestAnimationFrame(animate);
    return()=>{
      disposed=true;cancelAnimationFrame(frame);observer?.disconnect();visibilityObserver?.disconnect();resizeObserver.disconnect();controls.dispose();runtime.current=null;
      renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('webglcontextlost',contextLost);
      const geometries=new Set(),materials=new Set();scene.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.material)(Array.isArray(node.material)?node.material:[node.material]).forEach(m=>materials.add(m))});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());kit.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    };
  },[retry]);
  return <div className="p3-scene" data-testid="pet-island-scene" data-renderer={status}>
    <div ref={host} className="p3-canvas" aria-hidden={status==='fallback'}/>
    <div className="p3-map-title"><span>THE LITTLE ISLAND</span><b>海風小鎮 <i>01</i></b></div>
    {status==='loading'&&<div className="p3-scene-loading" role="status">正在準備你的小島…</div>}
    {status==='fallback'&&<div className="p3-fallback"><p>使用平面地圖繼續玩</p><div>{tiles.map((tile,i)=><button key={tile.id} className={position===i?'is-current':''} onClick={()=>onSelect?.(i)} style={{borderColor:ISLAND_COLORS[tile.type]}}>{i+1}<span>{tile.icon}</span><small>{tile.name}</small></button>)}</div><button onClick={()=>{setStatus('loading');setRetry(v=>v+1)}}>重新載入立體島嶼</button></div>}
    {status==='ready'&&<><div className="p3-camera-tools" aria-label="棋盤視角"><button aria-label="拉近棋盤" onClick={()=>runtime.current?.zoom(.15)}>＋</button><button aria-label="拉遠棋盤" onClick={()=>runtime.current?.zoom(-.15)}>−</button><button aria-label="重設棋盤視角" onClick={()=>runtime.current?.reset()}>⌂</button></div><p className="p3-map-help">拖曳旋轉 · 點建築查看 <span>↻</span></p></>}
  </div>;
}
