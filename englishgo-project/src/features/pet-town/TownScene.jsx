import { useEffect, useRef, useState } from 'react';
import { buildExplorationScenery } from './explorationScenery.js';
import { FURNITURE } from './worldData.js';
import { findTownPath } from './townNavigation.js';
import { findEnvironmentApproach, nearbyEnvironment } from './environmentInteractions.js';

const names = { 'harbor-cat': '小貓', 'sunny-dog': '小狗', 'garden-rabbit': '小兔' };
const knownSpecies = Object.keys(names);

/** Small, consistent, accessible portraits never allocate another WebGL context. */
export function PetPortrait({ speciesId = 'harbor-cat', size = 96, className, style, ...props }) {
  const kind = speciesId === 'sunny-dog' ? 'dog' : speciesId === 'garden-rabbit' ? 'rabbit' : 'cat';
  const fur = kind === 'cat' ? '#e9b57f' : kind === 'dog' ? '#cfa076' : '#f4f0e6';
  const shade = kind === 'cat' ? '#c78b5a' : kind === 'dog' ? '#92664d' : '#a8b6b7';
  return <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label={names[speciesId] || '夥伴'} className={className} style={style} {...props}>
    <ellipse cx="80" cy="144" rx="43" ry="8" fill="#638e8e" opacity=".13"/>
    {kind === 'cat' && <path d="M110 126C151 129 145 77 132 88C120 99 144 112 109 113" fill="none" stroke={fur} strokeWidth="13" strokeLinecap="round"/>}
    <path d="M50 113C48 84 109 84 112 113L119 138Q113 148 98 141L63 141Q46 148 42 138Z" fill={fur}/>
    <ellipse cx="80" cy="119" rx="20" ry="23" fill="#fff1db"/>
    {kind === 'rabbit' ? <><path d="M56 61C35 9 53-2 67 48L70 65Z" fill={shade}/><path d="M91 61C91 6 113 0 109 55L105 68Z" fill={shade}/><path d="M58 50Q49 14 55 18L65 54" fill="#dfb6b1"/><path d="M98 52Q99 17 105 18L102 55" fill="#dfb6b1"/></>
      : kind === 'cat' ? <><path d="M43 73L42 31Q60 32 72 62Z" fill={fur}/><path d="M88 60Q104 30 119 32L117 77Z" fill={fur}/><path d="M49 59L48 40L63 59Z" fill="#dfa8a1"/><path d="M99 59L113 40L112 64Z" fill="#dfa8a1"/></>
      : <><path d="M49 52Q22 51 27 94Q40 113 52 82" fill={shade}/><path d="M109 52Q140 50 134 95Q120 113 109 82" fill={shade}/></>}
    <path d="M39 83Q34 45 79 44Q125 43 123 85Q122 115 80 118Q40 115 39 83" fill={fur}/>
    {kind === 'cat' && <><path d="M66 48L69 62M80 46V60M94 48L91 62" stroke={shade} strokeWidth="6" strokeLinecap="round"/></>}
    {kind === 'dog' && <path d="M73 47L86 47L88 87L72 87Z" fill="#fff1db"/>}
    <ellipse cx="61" cy="82" rx="6" ry="8" fill="#303833"/><ellipse cx="99" cy="82" rx="6" ry="8" fill="#303833"/>
    <circle cx="59" cy="79" r="2" fill="white"/><circle cx="97" cy="79" r="2" fill="white"/>
    <ellipse cx="51" cy="97" rx="8" ry="3" fill="#d69e93" opacity=".6"/><ellipse cx="109" cy="97" rx="8" ry="3" fill="#d69e93" opacity=".6"/>
    <ellipse cx="80" cy="101" rx={kind === 'dog' ? 21 : 17} ry="12" fill="#fff1db"/>
    <path d="M75 96Q80 93 85 96L80 101Z" fill={kind === 'dog' ? '#4e3b35' : '#cd9994'}/>
    <path d="M71 105Q76 110 80 105Q84 110 89 105" fill="none" stroke="#86695a" strokeWidth="1.5" strokeLinecap="round"/>
    {kind === 'cat' && <path d="M55 100L34 97M55 105L33 108M105 100L127 97M105 105L127 108" fill="none" stroke="#b18b70" strokeWidth="1.2"/>}
    <path d="M60 117Q80 125 101 117L85 139Z" fill={kind === 'cat' ? '#789e9b' : kind === 'dog' ? '#ba7765' : '#a7b17d'}/>
    <circle cx="81" cy="125" r="3" fill="#f1d4a1"/>
    <ellipse cx="55" cy="140" rx="12" ry="6" fill="#fff1db"/><ellipse cx="106" cy="140" rx="12" ry="6" fill="#fff1db"/>
  </svg>;
}

function FlatTown({ pets }) {
  return <div aria-label="海風小鎮的平面備援場景" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(#d9eef1 0%,#e7f1e5 60%,#a4c9a9 60%)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
    <svg viewBox="0 0 800 500" style={{ position: 'absolute', width: '100%', height: '100%' }} aria-hidden="true"><circle cx="660" cy="80" r="37" fill="#fff1c3"/><path d="M0 230Q200 170 450 240T800 220V500H0Z" fill="#7cb5c2"/><ellipse cx="400" cy="385" rx="325" ry="84" fill="#e7d8b5"/><ellipse cx="400" cy="367" rx="300" ry="78" fill="#a9c496"/><path d="M220 305V160L380 106L532 166V310Z" fill="#f7e9cf"/><path d="M192 172L376 79L558 172L535 185L376 116L218 187Z" fill="#6a9296"/><path d="M335 309V229Q375 193 416 229V309Z" fill="#b98d70"/><path d="M248 211H304V263H248Z M445 211H500V263H445Z" fill="#b9d8d8"/><path d="M276 211V263M473 211V263" stroke="#fff3dc" strokeWidth="6"/><path d="M348 315L426 315L485 436H289Z" fill="#dfd9c3"/><path d="M123 347V260M650 347V255" stroke="#a68263" strokeWidth="18"/><ellipse cx="123" cy="247" rx="67" ry="67" fill="#82aa86"/><ellipse cx="650" cy="247" rx="67" ry="67" fill="#82aa86"/></svg>
    <div className="town-flat-pets" style={{ position: 'absolute', bottom: '12%', display: 'flex', gap: 16 }}>{(pets.length ? pets : [{ speciesId: 'harbor-cat' }]).map((p, i) => <PetPortrait key={p.id || i} speciesId={p.speciesId} size={100}/>)}</div>
  </div>;
}

export default function TownScene({ pets = [], activePetId, placements = [], activity, careAim, onSound, environmentEnabled = false, onEnvironment, storyMoment, motion = true, quality = 'auto', scene = 'home', onPet, onStatus, onMove, onPlacementSelect }) {
  const host = useRef(null), runtime = useRef(null), latest = useRef({}), previousScene = useRef(scene);
  latest.current = { pets, activePetId, placements, activity, careAim, onSound, environmentEnabled, onEnvironment, storyMoment, motion, onPet, onStatus, onMove, onPlacementSelect };
  const [status, setStatus] = useState('loading'), [night, setNight] = useState(() => ['camp','observatory'].includes(scene)), [focus, setFocus] = useState(() => scene === 'home' && window.matchMedia?.('(max-width: 760px)').matches);
  useEffect(() => { onStatus?.(status); }, [status, onStatus]);
  useEffect(() => { runtime.current?.setPets(pets, activePetId); }, [pets, activePetId]);
  useEffect(() => { runtime.current?.setPlacements(placements); }, [placements]);
  useEffect(() => { runtime.current?.perform(activity); }, [activity]);
  useEffect(() => { runtime.current?.setStoryMoment(storyMoment); }, [storyMoment]);
  useEffect(() => { runtime.current?.focus(focus); }, [focus]);

  useEffect(() => {
    let disposed = false, failed = false, destroy = () => {};
    const changedScene = previousScene.current !== scene;
    previousScene.current = scene;
    const initialFocus = changedScene ? scene === 'home' && window.matchMedia?.('(max-width: 760px)').matches : focus;
    if (changedScene) setFocus(initialFocus);
    setStatus('loading');
    if (/jsdom/i.test(navigator.userAgent)) { setStatus('fallback'); return; }
    Promise.all([import('three'), import('three/addons/controls/OrbitControls.js'), import('three/addons/loaders/GLTFLoader.js'), import('./townModels.js'), import('./townPerformance.js'), import('./environmentMotion.js')]).then(async ([T, { OrbitControls }, { GLTFLoader }, { applyGrowthAppearance }, { batchTownScenery, smoothFactor }, { bindEnvironmentMotion, environmentFollowup }]) => {
      if (disposed || !host.current) return;
      let renderer;
      try { renderer = new T.WebGLRenderer({ antialias: quality !== 'low', alpha: false, powerPreference: 'low-power' }); }
      catch { setStatus('fallback'); return; }
      const container = host.current, stage = new T.Scene();
      stage.background = new T.Color(night ? '#364f72' : '#d8eceb');
      stage.fog = new T.Fog(night ? '#364f72' : '#d8eceb', 25, 65);
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'low' ? 1 : quality === 'high' ? 1.5 : 1.25));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = night ? 1.1 : 1.03;
      renderer.shadowMap.enabled = quality !== 'low'; renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;';
      renderer.domElement.setAttribute('aria-label', '可拖曳旋轉的 3D 海風小鎮');
      container.appendChild(renderer.domElement);
      const camera = new T.PerspectiveCamera(36, 1, .1, 100);
      camera.position.set(10, 8.5, 12.5);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, .6, -.3); controls.enableDamping = true; controls.dampingFactor = .075;
      controls.minDistance = 5; controls.maxDistance = 22; controls.minPolarAngle = .35; controls.maxPolarAngle = 1.32;
      controls.enablePan = false; controls.rotateSpeed = .55; controls.zoomSpeed = .65;
      const geometrySet = new Set(), materialSet = new Set(), textures = new Set(), temporaryMaterials = new Set(), timers = new Set();
      destroy = () => { controls.dispose(); geometrySet.forEach(g => g.dispose()); materialSet.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
      const matCache = new Map();
      const material = (color, opts = {}) => {
        const key = `${color}:${JSON.stringify(opts)}`;
        if (!matCache.has(key)) { const m = new T.MeshStandardMaterial({ color, roughness: .86, ...opts }); matCache.set(key, m); materialSet.add(m); }
        return matCache.get(key);
      };
      const add = (parent, geometry, color, position = [0, 0, 0], scale = [1, 1, 1], opts = {}) => {
        geometrySet.add(geometry);
        const m = color?.isMaterial ? color : material(color, opts);
        const mesh = new T.Mesh(geometry, m); mesh.position.set(...position); mesh.scale.set(...scale);
        mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
      };
      const box = (parent, color, pos, size, opts) => add(parent, new T.BoxGeometry(...size), color, pos, [1, 1, 1], opts);
      const ball = (parent, color, pos, size) => add(parent, new T.SphereGeometry(1, 20, 14), color, pos, size);
      const cylinder = (parent, color, pos, top, bottom, height, sides = 24, opts) => add(parent, new T.CylinderGeometry(top, bottom, height, sides), color, pos, [1, 1, 1], opts);
      const group = (parent, pos = [0, 0, 0]) => { const g = new T.Group(); g.position.set(...pos); parent.add(g); return g; };
      const world = group(stage), decorGroup = group(world), actorsGroup = group(world), effectGroup = group(world), storyGroup = group(world);
      let effectSignature = '';
      const clearVisuals = parent => {
        if (parent === effectGroup) effectSignature = '';
        parent.traverse(node => {
          if (node.geometry && geometrySet.has(node.geometry)) { node.geometry.dispose(); geometrySet.delete(node.geometry); }
          for (const m of node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []) if (temporaryMaterials.has(m)) { m.dispose(); temporaryMaterials.delete(m); materialSet.delete(m); }
        });
        while (parent.children.length) parent.remove(parent.children[0]);
      };
      stage.add(new T.HemisphereLight(night ? '#b9d5ff' : '#fff7df', night ? '#6f8e94' : '#7d9e93', night ? 1.4 : 1.65));
      const sun = new T.DirectionalLight(night ? '#c5dbff' : '#fff0d2', night ? 2 : 2.8); sun.position.set(-6, 11, 8); sun.castShadow = true;
      sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
      Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: .5, far: 35 });
      sun.shadow.normalBias = .04; sun.shadow.bias = -.0002; stage.add(sun);
      const rim = new T.DirectionalLight('#c1e6ef', .8); rim.position.set(6, 5, -5); stage.add(rim);

      // A compact, handcrafted island with an actual shoreline and readable paths.
      const sea = add(world, new T.PlaneGeometry(150, 150), night ? '#527f9b' : '#85b9c4', [0, -.47, 0], [1, 1, 1], { roughness: .32, metalness: .08 }); sea.rotation.x = -Math.PI / 2; sea.receiveShadow = false;
      const sand = cylinder(world, '#e8dbc1', [0, -.28, -.1], 8.3, 8, .45, 96); sand.scale.z = .80;
      const lawn = cylinder(world, night ? '#87a58e' : '#b1c899', [0, -.045, -.6], 6.7, 6.9, .16, 96); lawn.scale.z = .80;
      const waveRings = [];
      for (let i = 0; i < 3; i++) {
        const ring = add(world, new T.RingGeometry(8.35 + i * .55, 8.38 + i * .55, 96), material('#d9f0e9', { transparent: true, opacity: .35 - i * .07, side: T.DoubleSide }), [0, -.44 + i * .005, -.1]);
        ring.rotation.x = -Math.PI / 2; ring.scale.y = .8; ring.castShadow = false; waveRings.push(ring);
      }
      for (let i = 0; i < 4; i++) {
        const distant = group(world, [-20 + i * 15, -.5, -28 - i % 2 * 8]);
        ball(distant, night ? '#688ca0' : '#a2c5b9', [0, 0, 0], [5 + i % 2, 2 + i % 3, 3]);
      }
      box(world, '#dbd8bf', [0, .045, 1.1], [1.35, .06, 6.4]);
      for (let i = 0; i < 11; i++) box(world, '#c8cbb2', [0, .079, -1.7 + i * .56], [1.33, .008, .018]);
      // Curved, irregular stepping stones branch toward the garden furniture.
      for (let i = 0; i < 5; i++) { const stone = cylinder(world, '#d5d8c3', [1 + i * .66, .085, 2.4 - i * .25], .26, .29, .06, 12); stone.scale.z = .7; stone.rotation.y = i * .4; }

      function roof(parent, width, depth, height, color) {
        const shape = new T.Shape(); shape.moveTo(-width / 2, 0); shape.lineTo(0, height); shape.lineTo(width / 2, 0); shape.closePath();
        return add(parent, new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .055, bevelThickness: .055, bevelSegments: 2, steps: 1 }), color, [0, 0, -depth / 2]);
      }
      function windowAt(parent, x, y, z) {
        box(parent, '#f2e4c9', [x, y, z], [.86, .97, .12]);
        box(parent, night ? '#f3cc83' : '#a8c9cb', [x, y, z + .07], [.68, .79, .025], { emissive: night ? '#e8ae55' : '#000000', emissiveIntensity: .45 });
        box(parent, '#f8edd8', [x, y, z + .09], [.045, .82, .04]); box(parent, '#f8edd8', [x, y, z + .09], [.7, .045, .04]);
        box(parent, '#b7a382', [x, y - .57, z + .12], [1.04, .15, .28]);
        for (let i = 0; i < 5; i++) ball(parent, i % 2 ? '#d9b3ab' : '#88a98a', [x - .4 + i * .2, y - .44, z + .15], [.15, .12, .13]);
      }
      const cottage = group(world, [-.4, .06, -3.15]);
      box(cottage, '#cbbda5', [0, .11, 0], [4.8, .22, 2.9]);
      box(cottage, '#f1e4ca', [0, 1.34, 0], [4.3, 2.5, 2.45]);
      for (let i = 0; i < 8; i++) box(cottage, '#e4d6ba', [0, .32 + i * .28, 1.23], [4.3, .014, .018]);
      const roofGroup = group(cottage, [0, 2.56, 0]); roof(roofGroup, 5, 3.1, 1.35, '#6b9296');
      for (let side of [-1, 1]) for (let i = 0; i < 10; i++) {
        const batten = box(roofGroup, '#60878d', [side * (i * .245 + .12), 1.34 - (i * .245 + .12) * .54, 0], [.028, .045, 3.16]); batten.rotation.z = side * -.49;
      }
      box(cottage, '#f0e5d1', [1.38, 3.3, -.57], [.48, 1.3, .51]); box(cottage, '#c4a89a', [1.38, 3.97, -.57], [.61, .16, .65]);
      const doorShape = new T.Shape(); doorShape.moveTo(-.42, 0); doorShape.lineTo(-.42, 1.38); doorShape.quadraticCurveTo(0, 1.78, .42, 1.38); doorShape.lineTo(.42, 0); doorShape.closePath();
      add(cottage, new T.ExtrudeGeometry(doorShape, { depth: .09, bevelEnabled: true, bevelSize: .035, bevelThickness: .025, bevelSegments: 2 }), '#ac8c72', [0, .2, 1.25]);
      ball(cottage, '#e5cc99', [.29, .95, 1.39], [.043, .043, .035]);
      for (let i = 0; i < 3; i++) box(cottage, '#d4c5ac', [0, .1 - i * .028, 1.55 + i * .24], [1.22 + i * .18, .12, .3]);
      windowAt(cottage, -1.33, 1.46, 1.25); windowAt(cottage, 1.33, 1.46, 1.25);
      // Small hanging shop sign and fabric awning give the cottage a lived-in scale.
      box(cottage, '#b39373', [-2.35, 1.95, 1.38], [.12, 1.6, .12]);
      box(cottage, '#b39373', [-2.65, 2.5, 1.38], [.68, .09, .09]);
      box(cottage, '#f7ecd6', [-2.65, 2.14, 1.38], [.55, .45, .10]);
      const sign = new T.Shape(); sign.moveTo(0, -.1); sign.bezierCurveTo(-.23, .04, -.07, .2, 0, .1); sign.bezierCurveTo(.07, .2, .23, .04, 0, -.1);
      add(cottage, new T.ShapeGeometry(sign), '#83a59a', [-2.65, 2.12, 1.441]);

      function tree(parent, x, z, scale = 1, blossom = false) {
        const g = group(parent, [x, 0, z]); g.scale.setScalar(scale);
        cylinder(g, '#a68b6b', [0, .65, 0], .11, .18, 1.3, 12);
        const branch = cylinder(g, '#a68b6b', [.19, 1.04, 0], .055, .07, .58, 10); branch.rotation.z = -.6;
        const color = blossom ? '#d8bfb5' : '#86aa84';
        ball(g, color, [0, 1.65, 0], [.74, .77, .66]); ball(g, blossom ? '#ead0c4' : '#99b78f', [-.35, 1.5, .12], [.47, .5, .5]); ball(g, blossom ? '#e9c8bf' : '#a6bf91', [.32, 1.8, .13], [.44, .46, .46]);
        if (!blossom) for (let j = 0; j < 4; j++) ball(g, '#dbb277', [Math.sin(j * 2) * .54, 1.5 + j * .12, Math.cos(j * 2) * .53], [.075, .075, .075]);
        return g;
      }
      tree(world, -4.9, -2.8, 1.3); tree(world, 4.7, -3.6, 1.22); tree(world, 5.35, -.7, .98, true); tree(world, -5.5, 1.2, 1.03, true);
      for (let side of [-1, 1]) for (let i = 0; i < 5; i++) {
        const x = side * (1.35 + i * .68), z = 4.04 - Math.abs(x) * .06;
        box(world, '#e3ddc4', [x, .34, z], [.13, .7, .13]);
        box(world, '#eee5cb', [x + side * .33, .49, z], [.66, .085, .085]); box(world, '#eee5cb', [x + side * .33, .23, z], [.66, .085, .085]);
      }
      // Reed tufts and individually coloured flowers avoid a flat lawn.
      for (let i = 0; i < 42; i++) {
        const a = i * 2.39996, r = 4.5 + (i % 4) * .36, x = Math.sin(a) * r, z = Math.cos(a) * r * .73 - .3;
        if (z < -2.1 || Math.abs(x) < .9) continue;
        for (let blade = 0; blade < 3; blade++) { const stem = box(world, '#739b73', [x + blade * .06, .13, z], [.025, .23 + blade * .04, .025]); stem.rotation.z = (blade - 1) * .2; }
        if (i % 3 === 0) { cylinder(world, '#83a17a', [x, .18, z], .012, .012, .35, 5); for (let p = 0; p < 5; p++) ball(world, i % 2 ? '#f3d7a8' : '#dfb7b1', [x + Math.sin(p * 1.256) * .055, .36, z + Math.cos(p * 1.256) * .055], [.045, .025, .045]); }
      }
      // String lights provide a warm visual anchor at night.
      const wirePoints = [new T.Vector3(-4.2, 2.5, .2), new T.Vector3(0, 2.15, -.05), new T.Vector3(4.2, 2.5, .2)];
      const wire = new T.CatmullRomCurve3(wirePoints);
      add(world, new T.TubeGeometry(wire, 40, .012, 6, false), '#8c8b79');
      for (let i = 0; i < 11; i++) { const p = wire.getPoint(i / 10); const lamp = ball(world, '#ffe4ac', [p.x, p.y - .10, p.z], [.055, .075, .055]); lamp.material = material('#ffe4ac', { emissive: '#ffc66e', emissiveIntensity: night ? 1.8 : .35 }); }
      for (const x of [-4.2, 4.2]) cylinder(world, '#b09573', [x, 1.24, .2], .04, .06, 2.5, 10);
      if (night) { const warm = new T.PointLight('#ffd38b', 8, 7, 2); warm.position.set(0, 2.1, 1); stage.add(warm); }

      // Story regions retain the same gentle visual language with distinct landmarks.
      if (scene === 'harbor') {
        const pier = group(world, [5.7, -.05, 1]);
        for (let i = 0; i < 10; i++) box(pier, i % 2 ? '#b99e7e' : '#c9ad89', [i * .35, 0, 0], [.32, .12, 1.35]);
        for (const x of [0, 1.7, 3.2]) for (const z of [-.6, .6]) cylinder(pier, '#927c61', [x, -.2, z], .07, .09, .8, 10);
        const boat = group(world, [8.6, -.24, 2.6]); ball(boat, '#f3e4c8', [0, .12, 0], [1.15, .3, .42]); cylinder(boat, '#ad9677', [0, 1.1, 0], .035, .035, 2, 8);
        const sail = new T.Shape(); sail.moveTo(0, 0); sail.lineTo(.9, 0); sail.lineTo(0, 1.5); sail.closePath(); add(boat, new T.ShapeGeometry(sail), material('#f8f2de', { side: T.DoubleSide }), [.05, .6, 0]);
      } else if (scene === 'orchard') {
        for (let i = 0; i < 3; i++) { const bed = group(world, [2 + i * 1.1, .13, 2]); box(bed, '#ab8965', [0, 0, 0], [.9, .22, 1.55]); box(bed, '#826e52', [0, .13, 0], [.76, .035, 1.4]); for (let j = 0; j < 4; j++) ball(bed, '#99b982', [0, .28, -.5 + j * .32], [.18, .15, .16]); }
      } else if (scene === 'starlight') {
        const lightHouse = group(world, [4.9, .05, -1.8]); cylinder(lightHouse, '#efe6d1', [0, 1.4, 0], .42, .7, 2.8, 32); cylinder(lightHouse, '#9eb6b4', [0, 2.1, 0], .49, .52, .4, 32); cylinder(lightHouse, '#f2d79c', [0, 3, 0], .43, .43, .58, 16, { emissive: '#e0ac5a', emissiveIntensity: .6 }); cylinder(lightHouse, '#6f8d9b', [0, 3.43, 0], 0, .66, .40, 32); cylinder(lightHouse, '#d8cfb6', [0, 2.72, 0], .67, .67, .13, 32);
      }

      if (buildExplorationScenery(scene, world, { group, box, ball, cylinder, roof, tree })) cottage.visible = false;
      let storySignature = '', storyTransition = 1;
      const setStoryMoment = moment => {
        const signature = JSON.stringify(moment);
        if (signature === storySignature) return;
        storySignature = signature; storyTransition = 0; clearVisuals(storyGroup);
        if (!moment) return;
        const step = moment.complete ? 2 : Number(moment.step) || 0;
        if (scene === 'harbor') {
          const envelope = group(storyGroup, [step === 0 ? 1.8 : step === 1 ? .4 : -.4, .8, step === 2 ? -1.65 : 1.1]);
          box(envelope, '#f9f0d7', [0, 0, 0], [.65, .43, .055]);
          const flap = new T.Shape(); flap.moveTo(-.3, .18); flap.lineTo(0, -.04); flap.lineTo(.3, .18);
          add(envelope, new T.ShapeGeometry(flap), material('#ddc6a7', { side: T.DoubleSide }), [0, 0, .03]);
          box(envelope, '#a4beb1', [.22, .09, .033], [.10, .12, .008]);
          envelope.userData.storyFloat = true;
          if (step === 2) for (let i = 0; i < 7; i++) {
            const flag = box(storyGroup, i % 2 ? '#e8c6aa' : '#b0c9c3', [-1.7 + i * .55, 1.7 + Math.sin(i) * .10, -.8], [.25, .28, .025]); flag.rotation.z = Math.sin(i) * .12;
          }
        } else if (scene === 'orchard') {
          const flowers = group(storyGroup, [2.3, .15, .5]);
          for (let i = 0; i < 6; i++) {
            const x = (i % 3) * .42, z = Math.floor(i / 3) * .5;
            cylinder(flowers, '#9b8062', [x, .05, z], .17, .15, .1, 12);
            if (step > 0) {
              cylinder(flowers, '#84a67d', [x, .2, z], .015, .02, .35, 6);
              ball(flowers, '#98b583', [x + .065, .23, z], [.10, .035, .05]);
              if (step === 2) for (let j = 0; j < 5; j++) ball(flowers, i % 2 ? '#efd2a3' : '#dbb8b0', [x + Math.sin(j * 1.256) * .075, .39, z + Math.cos(j * 1.256) * .075], [.06, .035, .06]);
            }
          }
          if (step > 0) { const wateringCan = furniture({ id: 'story-water', itemId: 'orchard-watering-can', x: 2, z: 1.6, rotation: -.5 }); storyGroup.add(wateringCan); }
        } else if (scene === 'starlight') {
          for (let i = 0; i < 3; i++) {
            const lantern = furniture({ id: `story-light-${i}`, itemId: 'starlight-lantern', x: -2 + i * 1.8, z: 2.8, rotation: 0 });
            lantern.traverse(node => { if (node.isMesh && node.material.emissive && step > 0) { const m = node.material.clone(); materialSet.add(m); temporaryMaterials.add(m); m.emissive.set('#f6ca75'); m.emissiveIntensity = .9; node.material = m; } });
            storyGroup.add(lantern);
          }
          if (step === 2) {
            const beam = add(storyGroup, new T.ConeGeometry(.85, 5, 24, 1, true), material('#f8e2a7', { transparent: true, opacity: .14, side: T.DoubleSide, depthWrite: false }), [4.9, 5.3, -1.8]); beam.rotation.z = -.35;
            for (let i = 0; i < 9; i++) ball(storyGroup, '#fff1bf', [-3.4 + i * .75, 4.7 + Math.sin(i * 2) * .7, -4], [.035, .035, .035]);
          }
        }
      };

      function furniture(item) {
        const catalog = FURNITURE.find(f => f.id === item.itemId);
        const kind = catalog?.kind || item.itemId.split('-').slice(1).join('-');
        const color = catalog?.color || '#9ab3a2', accent = catalog?.accent || '#e7d8b5';
        const g = new T.Group(); g.userData.placementId = item.id;
        const leg = (x, z, h = .45) => box(g, '#ae9676', [x, h / 2, z], [.085, h, .085]);
        if (kind === 'cushion') {
          const cushion = cylinder(g, color, [0, .13, 0], .42, .43, .22, 40); cushion.scale.z = .8;
          const top = ball(g, accent, [0, .23, 0], [.32, .065, .25]);
          const trim = add(g, new T.TorusGeometry(.38, .018, 6, 40), accent, [0, .23, 0]); trim.rotation.x = Math.PI / 2; trim.scale.y = .8;
        } else if (kind === 'bowl') {
          cylinder(g, color, [0, .10, 0], .24, .19, .18, 32); cylinder(g, '#8a7258', [0, .195, 0], .19, .19, .01, 24);
          for (let i = 0; i < 7; i++) ball(g, '#c89963', [Math.sin(i * 2.4) * .11, .21, Math.cos(i * 2.4) * .11], [.035, .025, .035]);
        } else if (kind === 'bench') {
          for (const x of [-.48, .48]) for (const z of [-.2, .2]) leg(x, z);
          for (let i = 0; i < 3; i++) box(g, color, [0, .45, -.21 + i * .20], [1.2, .09, .17]);
          for (const x of [-.49, .49]) box(g, '#ae9676', [x, .69, -.25], [.07, .57, .07]);
          box(g, color, [0, .82, -.25], [1.18, .23, .065]);
        } else if (kind === 'lantern') {
          cylinder(g, accent, [0, .04, 0], .21, .24, .08, 16); cylinder(g, color, [0, .32, 0], .18, .18, .48, 8, { emissive: '#e7bd76', emissiveIntensity: night ? .8 : .1 }); cylinder(g, accent, [0, .59, 0], .23, .20, .08, 8);
          for (const x of [-.14, .14]) for (const z of [-.14, .14]) box(g, accent, [x, .33, z], [.025, .5, .025]);
        } else if (kind === 'mailbox') {
          box(g, '#ad9779', [0, .5, 0], [.13, 1, .13]); box(g, color, [0, 1.03, 0], [.5, .39, .45]); const door = group(g, [0, .84, .24]); door.userData.environmentRole = 'door'; box(door, accent, [0, .18, 0], [.43, .34, .025]); box(g, '#667d72', [0, 1.03, .228], [.39, .28, .008]); const letter = group(g, [0, 1.03, .27]); box(letter, '#fff2cf', [0, 0, 0], [.32, .18, .012]); box(letter, '#bd8d79', [0, 0, .01], [.045, .045, .008]).rotation.z = Math.PI / 4; letter.userData.environmentRole = 'letter'; letter.visible = false; roof(group(g, [0, 1.22, 0]), .6, .5, .17, accent);
        } else if (kind === 'shells') {
          for (let i = 0; i < 5; i++) { const shell = ball(g, i % 2 ? color : accent, [Math.sin(i * 2.4) * .25, .08, Math.cos(i * 2.4) * .25], [.11, .07, .14]); shell.rotation.y = i; }
        } else if (kind === 'planter') {
          cylinder(g, color, [0, .22, 0], .29, .23, .44, 24); cylinder(g, '#7f765e', [0, .445, 0], .24, .24, .02, 24);
          for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ball(g, '#90ad82', [Math.sin(a) * .16, .57, Math.cos(a) * .16], [.13, .18, .11]); ball(g, i % 2 ? accent : '#edcfac', [Math.sin(a) * .20, .74, Math.cos(a) * .20], [.07, .055, .07]); }
        } else if (kind === 'table') {
          for (const x of [-.42, .42]) for (const z of [-.28, .28]) leg(x, z, .66);
          box(g, color, [0, .68, 0], [1.12, .10, .83]); cylinder(g, '#f1e7cd', [.15, .78, 0], .12, .1, .12, 20);
        } else if (kind === 'rug') {
          const rug = cylinder(g, color, [0, .025, 0], .65, .65, .035, 48); rug.scale.z = .7;
          const trim = add(g, new T.RingGeometry(.56, .60, 48), material(accent, { side: T.DoubleSide }), [0, .046, 0]); trim.rotation.x = -Math.PI / 2; trim.scale.y = .7;
        } else if (kind === 'stool') {
          for (const a of [0, 2.094, 4.188]) leg(Math.sin(a) * .18, Math.cos(a) * .18, .42);
          cylinder(g, color, [0, .44, 0], .3, .3, .09, 24);
        } else if (kind === 'wateringCan' || kind === 'watering-can') {
          cylinder(g, color, [0, .22, 0], .19, .22, .4, 24);
          const spout = cylinder(g, color, [.28, .24, 0], .035, .06, .40, 12); spout.rotation.z = -.9;
          const handle = add(g, new T.TorusGeometry(.22, .025, 6, 24), accent, [-.12, .37, 0]);
        } else if (kind === 'tree') tree(g, 0, 0, .8, item.itemId.startsWith('starlight'));
        else if (kind === 'picnic') {
          box(g, color, [0, .035, 0], [1.45, .04, 1.1]);
          for (let i = 0; i < 5; i++) box(g, accent, [-.57 + i * .28, .058, 0], [.10, .005, 1.1]);
          cylinder(g, '#f8f0dc', [.3, .08, .1], .18, .18, .025, 24); ball(g, '#d9a36c', [.3, .16, .1], [.09, .07, .07]);
        } else if (kind === 'basket') {
          cylinder(g, color, [0, .2, 0], .33, .28, .38, 20);
          const h = add(g, new T.TorusGeometry(.30, .035, 6, 32, Math.PI), accent, [0, .37, 0]);
          for (let i = 0; i < 3; i++) ball(g, i % 2 ? '#93b17e' : '#d9aa7c', [-.16 + i * .16, .39, 0], [.10, .08, .10]);
        } else if (kind === 'fence') {
          for (const x of [-.45, .45]) box(g, color, [x, .36, 0], [.10, .72, .10]);
          for (const y of [.23, .53]) box(g, accent, [0, y, 0], [.95, .09, .08]);
        } else if (kind === 'telescope') {
          for (const a of [0, 2.094, 4.188]) { const leg = cylinder(g, '#aa9474', [Math.sin(a) * .14, .4, Math.cos(a) * .14], .025, .035, .8, 8); leg.rotation.z = Math.cos(a) * .32; leg.rotation.x = Math.sin(a) * .32; }
          const tube = cylinder(g, color, [0, .88, 0], .12, .10, .65, 24); tube.rotation.z = -.55;
          ball(g, '#6b8da4', [.17, 1.16, 0], [.12, .03, .12]).rotation.z = -.55;
        } else if (kind === 'chime') {
          box(g, '#ac9678', [0, .7, 0], [.07, 1.4, .07]); box(g, '#ac9678', [.19, 1.4, 0], [.45, .06, .06]);
          ball(g, color, [.34, 1.17, 0], [.16, .15, .16]).userData.envChime = true; box(g, accent, [.34, .89, 0], [.09, .25, .008]).userData.envChime = true;
        } else if (kind === 'fountain') {
          cylinder(g, accent, [0, .10, 0], .55, .6, .19, 40); cylinder(g, '#a7c8ca', [0, .20, 0], .45, .45, .035, 40, { roughness: .2 }); cylinder(g, color, [0, .43, 0], .11, .16, .52, 24); cylinder(g, accent, [0, .70, 0], .28, .22, .08, 32);
          for (let i = 0; i < 3; i++) { const ripple = add(g, new T.RingGeometry(.24, .255, 32), material('#eaf9f5', { transparent: true, opacity: .2, depthWrite: false, side: T.DoubleSide }), [0, .223 + i * .001, 0]); ripple.rotation.x = -Math.PI / 2; ripple.castShadow = false; ripple.userData.environmentRole = 'ripple'; }
        } else box(g, color, [0, .2, 0], [.5, .4, .5]);
        g.userData.environmentKind = kind;
        g.userData.environmentMotion = bindEnvironmentMotion(g, kind, m => { materialSet.add(m); temporaryMaterials.add(m); });
        g.position.set(item.x, .06, item.z); g.rotation.y = item.rotation || 0;
        g.traverse(n => { n.userData.placementId = item.id; });
        return g;
      }
      let placementSignature = '';
      const setPlacements = items => {
        const signature = JSON.stringify(items);
        if (signature === placementSignature) return;
        placementSignature = signature;
        if (environmentVisit) {
          const actor = actors.get(environmentVisit.petId);
          if (actor) { actor.path = []; actor.target = null; play(actor, 'idle'); actor.root.position.y = groundHeight(actor.root.position.x, actor.root.position.z); }
          effectDeadline = 0; clearVisuals(effectGroup); finishVisit('blocked');
        }
        clearVisuals(decorGroup);
        items.forEach(item => decorGroup.add(furniture(item)));
      };
      const actors = new Map(), loader = new GLTFLoader(), pending = new Map();
      const groundHeight = (x, z) => Math.abs(x) < .70 && z >= -2.1 && z <= 4.3 ? .04 : 0;
      const target = new T.Vector3(), raycaster = new T.Raycaster(), pointer = new T.Vector2();
      const floorPlane = new T.Plane(new T.Vector3(0, 1, 0), -.08);
      let active = activePetId, sceneVisible = true, previousTime = 0, frame = 0, elapsed = 0;
      let focusWanted = initialFocus, effectDeadline = 0, lastActivityKey = '', effectActor = null, effectStart = 0, environmentVisit = null;
      const loadedMaterials = new Set(), loadedGeometry = new Set();
      const releaseModel = model => {
        const geometries = new Set(), materials = new Set();
        model.traverse(n => { if (n.geometry) geometries.add(n.geometry); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => materials.add(m)); });
        geometries.forEach(g => { g.dispose(); loadedGeometry.delete(g); });
        materials.forEach(m => { m.dispose(); loadedMaterials.delete(m); });
      };
      const releaseActor = actor => { actor.mixer.stopAllAction(); actor.mixer.uncacheRoot(actor.model); actorsGroup.remove(actor.root); releaseModel(actor.model); };
      const play = (actor, name, restart = false) => {
        if ((!restart && actor.clip === name) || !actor.actions[name]) return;
        if (actor.clip === name) { actor.actions[name].reset().play(); return; }
        actor.actions[actor.clip]?.fadeOut(.14);
        actor.actions[name].reset().fadeIn(.14).play(); actor.clip = name;
      };
      const setPets = (items, selectedId) => {
        active = selectedId;
        const display = items.length ? items : knownSpecies.map((speciesId, i) => ({ id: `preview-${i}`, speciesId, exp: 120 }));
        const wanted = new Map(display.map(p => [p.id, p.speciesId]));
        for (const [id, actor] of actors) if (wanted.get(id) !== actor.speciesId) { releaseActor(actor); actors.delete(id); }
        for (const [id, request] of pending) if (wanted.get(id) !== request.speciesId) pending.delete(id);
        display.forEach((pet, index) => {
          if (!knownSpecies.includes(pet.speciesId)) return;
          if (actors.has(pet.id)) { applyGrowthAppearance(actors.get(pet.id).model, pet.exp || 0); return; }
          if (pending.get(pet.id)?.speciesId === pet.speciesId) return;
          const request = { speciesId: pet.speciesId }; pending.set(pet.id, request); setStatus('loading');
          loader.load(`${import.meta.env.BASE_URL}models/pet-town/${pet.speciesId}.glb`, gltf => {
            if (disposed || failed || pending.get(pet.id) !== request) { releaseModel(gltf.scene); return; }
            pending.delete(pet.id);
            const actorX = index === 0 ? -.5 : index === 1 ? 1.2 : -2, actorZ = index === 0 ? 1.2 : 1.6;
            const actorRoot = group(actorsGroup, [actorX, groundHeight(actorX, actorZ), actorZ]);
            const model = gltf.scene; actorRoot.add(model); actorRoot.rotation.y = .1 + index * -.2;
            model.traverse(n => { n.userData.petId = pet.id; if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; loadedGeometry.add(n.geometry); (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => loadedMaterials.add(m)); } });
            const currentPet = latest.current.pets.find(p => p.id === pet.id && p.speciesId === pet.speciesId) || pet;
            applyGrowthAppearance(model, currentPet.exp || 0);
            const mixer = new T.AnimationMixer(model), actions = Object.fromEntries(gltf.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
            actions.walk?.setEffectiveTimeScale(1.6); actions.run?.setEffectiveTimeScale(1.3);
            for (const name of ['shake', 'pounce', 'settle', 'wake', 'stretch', 'greet', 'groom', 'hop', 'listen', 'yawn']) if (actions[name]) { actions[name].setLoop(T.LoopOnce, 1); actions[name].clampWhenFinished = true; }
            const actor = { root: actorRoot, model, mixer, actions, clip: '', target: null, path: [], speciesId: pet.speciesId, idleUntil: elapsed + 8 + index * 4 };
            actors.set(pet.id, actor); play(actor, 'idle');
            if (!pending.size) setStatus('ready');
            if (latest.current.activity) perform(latest.current.activity);
          }, undefined, () => {
            if (pending.get(pet.id) !== request) return;
            pending.delete(pet.id);
            if (!disposed && !failed) setStatus(pending.size ? 'loading' : actors.size ? 'ready' : 'fallback');
          });
        });
      };
      const restoreEnvironment = () => { decorGroup.children.forEach(g => g.userData.environmentMotion?.restore()); };
      const audioPosition = new T.Vector3();
      const soundAt = (name, volume, position) => { audioPosition.copy(position).project(camera); latest.current.onSound?.(name, volume, Math.max(-.8, Math.min(.8, audioPosition.x))); };
      const finishVisit = phase => {
        restoreEnvironment();
        const visit = environmentVisit; environmentVisit = null;
        if (visit) latest.current.onEnvironment?.({ phase, petId: visit.petId, placementId: visit.placement.id, text: visit.text });
      };
      const arriveAtObject = actor => {
        const visit = environmentVisit;
        if (!visit || !latest.current.placements.some(p => p.id === visit.placement.id && p.x === visit.placement.x && p.z === visit.placement.z && p.rotation === visit.placement.rotation && p.itemId === visit.placement.itemId)) { finishVisit('blocked'); return; }
        actor.target = null; actor.path = []; actor.arrival = null; actor.reactionUntil = 0;
        actor.root.rotation.y = Math.atan2(visit.placement.x - actor.root.position.x, visit.placement.z - actor.root.position.z);
        if (visit.item.kind === 'cushion') { actor.root.rotation.y = visit.placement.rotation || 0; actor.root.position.y = .15; }
        visit.arrivedAt = elapsed; visit.responded = false; effectStart = elapsed;
        soundAt(({ chime: 'chime', fountain: 'water', wateringCan: 'water', shells: 'toy', bowl: 'rustle' })[visit.item.kind] || 'rustle', .25, actor.root.position);
        play(actor, visit.clip, true); effectDeadline = elapsed + visit.duration;
        if (!latest.current.motion || matchMedia('(prefers-reduced-motion: reduce)').matches) actor.mixer.update(.6);
        latest.current.onEnvironment?.({ phase: 'arrived', petId: visit.petId, placementId: visit.placement.id, text: visit.text });
      };
      const updateCareProps = value => {
        const foam = value.phase === 'dry' || value.phase === 'shake' ? 0 : value.phase === 'rinse' ? Math.round(14 * (1 - (value.progress || 0))) : 6 + Math.round(8 * (value.progress || 0));
        for (const node of effectGroup.children) {
          if (node.userData.float !== undefined) node.visible = node.userData.float < foam;
          if (node.userData.toy) { node.userData.direction = ((value.point?.x ?? .75) - .5) * 2; node.userData.depth = ((value.point?.y ?? .5) - .5) * 1.5; }
        }
      };
      const perform = value => {
        if (value && `${value.nonce || value.id || ''}:${value.type}:${value.petId || active}` === lastActivityKey) return;
        if (environmentVisit) {
          restoreEnvironment();
          const previous = actors.get(environmentVisit.petId);
          if (previous) { previous.path = []; previous.target = null; previous.root.position.y = groundHeight(previous.root.position.x, previous.root.position.z); play(previous, 'idle'); }
          environmentVisit = null;
        }
        if (!value) { controls.enabled = true; effectActor = null; effectDeadline = 0; lastActivityKey = ''; clearVisuals(effectGroup); actors.forEach(actor => { if (actor.arrival) { actor.arrival = null; actor.target = null; actor.path = []; } if (!actor.target) play(actor, 'idle'); }); return; }
        const key = `${value.nonce || value.id || ''}:${value.type}:${value.petId || active}`;
        if (key === lastActivityKey) return;
        const actor = actors.get(value.petId || active) || actors.values().next().value;
        if (!actor) return;
        lastActivityKey = key;
        if (['feed', 'wash', 'clean', 'play', 'sleep', 'pet', 'wake', 'greet', 'stretch', 'groom', 'hop'].includes(value.type)) { focusWanted = true; setFocus(true); }
        controls.enabled = !value.sustained;
        actor.target = null; actor.path = []; actor.arrival = null; effectActor = actor; effectStart = elapsed;
        if (value.sustained) actor.root.rotation.y = .55;
        const map = { stretch: 'stretch', greet: 'greet', groom: 'groom', hop: 'hop', feed: 'eat', wash: 'wash', clean: 'wash', play: 'play', sleep: 'sleep', pet: 'pet', wake: 'wake', happy: 'happy', curious: 'curious' };
        const clip = value.phase || map[value.type] || 'happy';
        // Continuous strokes should not rewind the animation before it can react.
        play(actor, clip, !value.sustained || !actor.actions[clip]?.isRunning());
        effectDeadline = value.sustained || value.resting ? Infinity : elapsed + (value.type === 'sleep' ? 12 : 3);
        if (!latest.current.motion || matchMedia('(prefers-reduced-motion: reduce)').matches) actor.mixer.update(.45);
        const signature = `${value.petId || active}:${value.type}:${value.phase || ''}`;
        if (effectSignature === signature && ['feed','wash','play','sleep'].includes(value.type)) { updateCareProps(value); return; }
        clearVisuals(effectGroup); effectSignature = signature;
        if (value.type === 'environment' && latest.current.environmentEnabled) {
          const placement = latest.current.placements.find(p => p.id === value.placementId);
          const approach = placement && findEnvironmentApproach(actor.root.position, placement, latest.current.placements);
          if (!approach) { latest.current.onEnvironment?.({ phase: 'blocked', petId: value.petId, placementId: value.placementId }); return; }
          environmentVisit = { ...approach, petId: value.petId };
          focusWanted = true; setFocus(true);
          const marker = add(effectGroup, new T.RingGeometry(.48, .53, 40), '#d4ba7a', [approach.point.x, .09, approach.point.z]); marker.rotation.x = -Math.PI / 2;
          effectDeadline = Infinity;
          if (!latest.current.motion || matchMedia('(prefers-reduced-motion: reduce)').matches || !approach.path.length) {
            actor.root.position.set(approach.point.x, groundHeight(approach.point.x, approach.point.z), approach.point.z); arriveAtObject(actor);
          } else { actor.path = approach.path.map(p => new T.Vector3(p.x, groundHeight(p.x,p.z), p.z)); actor.target = actor.path.shift(); play(actor, 'walk'); }
          return;
        }
        if (value.type === 'come') {
          focusWanted = true; setFocus(true);
          const path = findTownPath(actor.root.position, { x: 0, z: 2.8 }, latest.current.placements, FURNITURE);
          if (latest.current.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches && path.length) {
            actor.path = path.map(p => new T.Vector3(p.x, groundHeight(p.x, p.z), p.z)); actor.target = actor.path.shift(); actor.arrival = 'happy';
            effectDeadline = 0; play(actor, 'run');
          } else { play(actor, 'happy', true); }
        }
        if (value.type === 'feed' && value.phase !== 'happy') {
          const bowl = furniture({ id: 'care-bowl', itemId: 'harbor-bowl', x: 0, z: 0, rotation: 0 }); bowl.position.copy(actor.root.position).add(new T.Vector3(0, 0, .7).applyAxisAngle(new T.Vector3(0, 1, 0), actor.root.rotation.y)); effectGroup.add(bowl);
        } else if (value.type === 'wash') {
          const tub = group(effectGroup, [actor.root.position.x, .10, actor.root.position.z]);
          const profile = [new T.Vector2(.36, 0), new T.Vector2(.53, .03), new T.Vector2(.63, .21), new T.Vector2(.63, .29), new T.Vector2(.58, .32), new T.Vector2(.54, .27), new T.Vector2(.48, .08)];
          const bath = add(tub, new T.LatheGeometry(profile, 48), '#f2e6d0'); bath.scale.z = 1.35;
          const water = cylinder(tub, '#afd1d2', [0, .15, 0], .54, .54, .02, 40, { transparent: true, opacity: .64, roughness: .17 }); water.scale.z = 1.35;
          const towel = box(tub, '#b4c5af', [.52, .25, .2], [.14, .09, .42]); towel.rotation.z = -.2;
          for (let i = 0; i < 14; i++) { const bubble = add(effectGroup, new T.SphereGeometry(.04 + i % 3 * .025, 12, 8), material('#e8f4ec', { transparent: true, opacity: .55, roughness: .16 }), [actor.root.position.x + Math.sin(i * 2.4) * .6, .5 + i * .075, actor.root.position.z + Math.cos(i * 2.4) * .5]); bubble.userData.float = i; bubble.userData.baseY = bubble.position.y; }
          if (value.phase === 'rinse' || value.phase === 'shake') {
            for (let i = 0; i < 22; i++) {
              const drop = ball(effectGroup, '#86c7e0', [actor.root.position.x + Math.sin(i * 2.4) * .55, .6 + (i % 7) * .16, actor.root.position.z + Math.cos(i * 2.4) * .5], [.025, .07, .025]);
              drop.userData.water = i; drop.userData.baseY = drop.position.y;
            }
          }
          if (value.phase === 'dry') { const cloth = box(effectGroup, '#e7c39a', [actor.root.position.x, .85, actor.root.position.z], [.55,.06,.42]); cloth.userData.cloth = true; cloth.userData.baseX = cloth.position.x; }
        } else if (value.type === 'play') {
          const ballToy = ball(effectGroup, actor.speciesId === 'garden-rabbit' ? '#d9a474' : '#bdd3b3', [actor.root.position.x + .5, .22, actor.root.position.z + .7], [.14, .14, .14]); ballToy.userData.toy = true; ballToy.userData.baseX = ballToy.position.x; ballToy.userData.baseZ = ballToy.position.z; ballToy.userData.direction = ((value.point?.x ?? .75) - .5) * 2; ballToy.userData.depth = ((value.point?.y ?? .5) - .5) * 1.5; actor.root.rotation.y = .55 + ballToy.userData.direction * .45;
          if (actor.speciesId === 'harbor-cat') { const wand = cylinder(effectGroup, '#bb9d78', [actor.root.position.x + .7, .65, actor.root.position.z + .6], .018, .018, .85, 8); wand.rotation.z = -.5; }
        } else if (value.type === 'sleep') {
          const cushion = furniture({ id: 'care-bed', itemId: 'harbor-cushion', x: actor.root.position.x, z: actor.root.position.z, rotation: 0 }); cushion.scale.set(1.45, .55, 1.9); effectGroup.add(cushion);
        }
        updateCareProps(value);
      };
      // One small particle batch adds drifting seeds / fireflies without per-frame allocation.
      const moteGeometry = new T.BufferGeometry(), motePositions = new Float32Array(48);
      moteGeometry.setAttribute('position', new T.BufferAttribute(motePositions, 3)); geometrySet.add(moteGeometry);
      const moteCanvas = document.createElement('canvas'); moteCanvas.width = moteCanvas.height = 32;
      const moteContext = moteCanvas.getContext('2d'), glow = moteContext.createRadialGradient(16,16,0,16,16,16);
      glow.addColorStop(0, '#fff8cf'); glow.addColorStop(.3, '#fff8cfb0'); glow.addColorStop(1, '#fff8cf00');
      moteContext.fillStyle = glow; moteContext.fillRect(0,0,32,32);
      const moteTexture = new T.CanvasTexture(moteCanvas); textures.add(moteTexture);
      const moteMaterial = new T.PointsMaterial({ map: moteTexture, color: night ? '#ffe9a5' : '#fff8e9', size: night ? .11 : .07, transparent: true, opacity: night ? .7 : .42, depthWrite: false }); materialSet.add(moteMaterial);
      const ambientMotes = new T.Points(moteGeometry, moteMaterial); ambientMotes.frustumCulled = false; world.add(ambientMotes);
      let nextWindChime = 12;
      batchTownScenery(world, new Set([actorsGroup, decorGroup, effectGroup, storyGroup, ...waveRings]), g => geometrySet.add(g));
      runtime.current = { setPets, setPlacements, perform, setStoryMoment, focus: value => { focusWanted = value; }, reset: () => { focusWanted = false; controls.target.set(0, .6, -.3); camera.position.set(10, 8.5, 12.5); controls.update(); } };
      setPets(latest.current.pets, latest.current.activePetId); setPlacements(latest.current.placements); setStoryMoment(latest.current.storyMoment);
      let down = null;
      const pointerDown = e => { down = { x: e.clientX, y: e.clientY }; };
      const pointerCancel = () => { down = null; };
      const pointerUp = e => {
        if (latest.current.activity?.sustained) { down = null; return; }
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) { down = null; return; }
        down = null;
        const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects([...actorsGroup.children, ...decorGroup.children], true);
        if (hits[0]?.object.userData.petId) { latest.current.onPet?.(hits[0].object.userData.petId); return; }
        if (hits[0]?.object.userData.placementId) { latest.current.onPlacementSelect?.(hits[0].object.userData.placementId); return; }
        if (latest.current.activity?.resting) return;
        if (raycaster.ray.intersectPlane(floorPlane, target) && Math.abs(target.x) < 4.5 && target.z > -1.3 && target.z < 3.6) {
          const actor = actors.get(active) || actors.values().next().value;
          if (actor) {
            const nearby = latest.current.environmentEnabled && nearbyEnvironment(target, latest.current.placements);
            if (nearby) { latest.current.onPlacementSelect?.(nearby.id); return; }
            const path = findTownPath(actor.root.position, target, latest.current.placements, FURNITURE);
            if (!path.length) return;
            restoreEnvironment(); environmentVisit = null; actor.reactionUntil = 0; effectDeadline = 0; clearVisuals(effectGroup);
            if (!latest.current.motion || reduced.matches) {
              const end = path.at(-1); actor.root.position.set(end.x, groundHeight(end.x, end.z), end.z); actor.path = []; actor.target = null; play(actor, 'idle'); latest.current.onMove?.({ x: target.x, z: target.z }); return;
            }
            actor.arrival = null; actor.path = path.map(p => new T.Vector3(p.x, groundHeight(p.x, p.z), p.z));
            actor.target = actor.path.shift(); effectDeadline = 0; clearVisuals(effectGroup); play(actor, 'walk'); latest.current.onMove?.({ x: target.x, z: target.z });
          }
        }
      };
      const contextLost = e => { e.preventDefault(); failed = true; setStatus('fallback'); destroy(); };
      renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointerup', pointerUp); renderer.domElement.addEventListener('pointercancel', pointerCancel); renderer.domElement.addEventListener('webglcontextlost', contextLost);
      const resize = () => {
        const width = container.clientWidth, height = container.clientHeight;
        if (!width || !height) return;
        camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
        if (!focusWanted) { const distance = width < 600 ? 1.35 : 1; camera.position.set(10 * distance, 8.5 * distance, 12.5 * distance); }
      };
      const observer = new ResizeObserver(resize); observer.observe(container); resize();
      const visibilityObserver = new IntersectionObserver(entries => { sceneVisible = entries[0]?.isIntersecting ?? true; }); visibilityObserver.observe(container);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
      const direction = new T.Vector3(), desiredCamera = new T.Vector3(), cameraCenter = new T.Vector3();
      function draw(time) {
        if (disposed || failed) return;
        frame = requestAnimationFrame(draw);
        // A started visit must settle even when its activity buttons scroll the canvas off screen.
        // Keep the short simulation alive, while still skipping off-screen GPU rendering.
        if (document.hidden || (!sceneVisible && !environmentVisit)) { previousTime = 0; return; }
        const dt = previousTime ? Math.min(.12, (time - previousTime) / 1000) : 1 / 60; previousTime = time; elapsed += dt;
        const moving = latest.current.motion && !reduced.matches;
        for (const [id, actor] of actors) {
          if (moving) actor.mixer.update(dt);
          if (moving && actor === effectActor && latest.current.activity?.sustained && latest.current.activity.type !== 'sleep') {
            const aim = latest.current.careAim?.current || { x: .5 };
            const facing = .55 + (aim.x - .5) * (latest.current.activity.type === 'play' ? .9 : .35);
            actor.root.rotation.y += (facing - actor.root.rotation.y) * Math.min(1, dt * 8);
          }
          if (actor.target && !moving) { if (environmentVisit?.petId === id) { const end = environmentVisit.point; actor.root.position.set(end.x,groundHeight(end.x,end.z),end.z); arriveAtObject(actor); } else { actor.target = null; actor.path = []; play(actor, 'idle'); } }
          if (actor.target) {
            if (moving && id === active && elapsed >= (actor.nextStep || 0)) { actor.nextStep = elapsed + (actor.arrival ? .26 : .36); soundAt('step', .12, actor.root.position); }
            direction.subVectors(actor.target, actor.root.position); direction.y = 0;
            if (direction.length() < .08) { actor.target = actor.path.shift() || null; if (!actor.target) { if (environmentVisit?.petId === id) arriveAtObject(actor); else { play(actor, actor.arrival || 'idle'); actor.arrival = null; actor.reactionUntil = elapsed + 2; actor.idleUntil = elapsed + 10; } } }
            else { const distance = direction.length(), angle = Math.atan2(direction.x, direction.z); actor.root.rotation.y += Math.atan2(Math.sin(angle - actor.root.rotation.y), Math.cos(angle - actor.root.rotation.y)) * smoothFactor(18, dt); actor.root.position.addScaledVector(direction.normalize(), Math.min(distance, dt * (actor.arrival ? 2.7 : 1.65))); actor.root.position.y += (groundHeight(actor.root.position.x, actor.root.position.z) - actor.root.position.y) * smoothFactor(18, dt); if (moving) play(actor, actor.arrival ? 'run' : 'walk'); }
          } else if (actor.reactionUntil && elapsed > actor.reactionUntil && !effectDeadline) { actor.reactionUntil = 0; play(actor, 'idle'); }
          else if (effectDeadline && elapsed > effectDeadline && actor === effectActor) { play(actor, 'idle'); }
          else if (!(effectDeadline && effectActor === actor) && moving && elapsed > actor.idleUntil) {
            actor.idleUntil = elapsed + 12 + (id.length % 4);
            if (id !== active && !id.startsWith('preview') && latest.current.pets.length > 1) {
              const choice = Math.floor(elapsed / 12 + id.length) % 4;
              const destinations = [{ x: -3.2, z: 2.7 }, { x: 2.7, z: 1.8 }, { x: 1.3, z: -.2 }, { x: -1.5, z: 1.4 }];
              const path = findTownPath(actor.root.position, destinations[choice], latest.current.placements, FURNITURE);
              actor.path = path.map(p => new T.Vector3(p.x, groundHeight(p.x, p.z), p.z)); actor.target = actor.path.shift() || null;
              play(actor, actor.target ? 'walk' : 'curious');
            } else {
              const habits = actor.speciesId === 'sunny-dog' ? ['greet','stretch','listen','yawn'] : actor.speciesId === 'garden-rabbit' ? ['listen','hop','groom','yawn'] : ['groom','stretch','listen','yawn'];
              play(actor, habits[Math.floor(elapsed / 12) % habits.length]);
              const timer = setTimeout(() => { timers.delete(timer); if (!disposed && !failed && actors.get(id) === actor && !actor.target && !(effectDeadline && effectActor === actor)) play(actor, 'idle'); }, 3000); timers.add(timer);
            }
          }
        }
        if (effectDeadline && elapsed > effectDeadline) { if (effectActor) { effectActor.root.position.y = groundHeight(effectActor.root.position.x, effectActor.root.position.z); effectActor.idleUntil = elapsed + 8; } effectDeadline = 0; effectActor = null; controls.enabled = true; clearVisuals(effectGroup); finishVisit('finished'); }
        const contactAge = environmentVisit?.arrivedAt == null ? null : elapsed - environmentVisit.arrivedAt;
        decorGroup.children.forEach(g => g.userData.environmentMotion?.update(elapsed, g.userData.placementId === environmentVisit?.placement.id ? contactAge : null, moving, environmentVisit?.duration));
        if (moving && contactAge > 1.8 && !environmentVisit.responded) {
          environmentVisit.responded = true;
          const next = environmentFollowup(environmentVisit.item.kind), actor = actors.get(environmentVisit.petId);
          if (next && actor) {
            play(actor, next[0], true);
            latest.current.onEnvironment?.({ phase: 'responding', petId: environmentVisit.petId, placementId: environmentVisit.placement.id, text: next[1] });
            if (['chime', 'fountain', 'shells', 'mailbox'].includes(environmentVisit.item.kind)) soundAt(environmentVisit.item.kind === 'fountain' ? 'water' : environmentVisit.item.kind === 'chime' ? 'chime' : 'rustle', .17, actor.root.position);
          }
        }
        ambientMotes.visible = moving;
        if (moving) {
          for (let i=0;i<16;i++) { motePositions[i*3] = Math.sin(i*2.4)*4.8 + Math.sin(elapsed*.22+i)*.3; motePositions[i*3+1] = .5 + (i%5)*.25 + Math.sin(elapsed*.5+i)*.16; motePositions[i*3+2] = Math.cos(i*2.4)*3 + .4 + Math.cos(elapsed*.17+i)*.2; }
          moteGeometry.attributes.position.needsUpdate = true;
          if (elapsed > nextWindChime) { nextWindChime = elapsed + 18; const chime = decorGroup.children.find(g => g.userData.environmentKind === 'chime'); if (chime && !environmentVisit && !latest.current.activity?.sustained && !latest.current.activity?.resting) soundAt('chime', .07, chime.position); }
          waveRings.forEach((r, i) => { const scale = 1 + Math.sin(elapsed * .55 - i) * .018; r.scale.set(scale, .8 * scale, 1); });
          effectGroup.children.forEach(n => {
            const age = elapsed - effectStart;
            if (n.userData.float !== undefined) n.position.y = n.userData.baseY + Math.sin(age * 1.5 + n.userData.float) * .08;
            if (n.userData.water !== undefined) n.position.y = .3 + ((n.userData.baseY - age * 1.8) % 1.2 + 1.2) % 1.2;
            if (n.userData.cloth) n.position.x = n.userData.baseX + ((latest.current.careAim?.current?.x ?? .5) - .5) * .6 + Math.sin(age * 8) * .08;
            if (n.userData.toy) { n.position.y = .22 + Math.abs(Math.sin(Math.min(age, 1.2) / 1.2 * Math.PI)) * .9; n.position.x = n.userData.baseX + Math.sin(Math.min(age, 1.2) / 1.2 * Math.PI) * n.userData.direction * 1.3; n.position.z = n.userData.baseZ + Math.sin(Math.min(age, 1.2) / 1.2 * Math.PI) * n.userData.depth; n.rotation.x += dt * 4; }
          });
          storyTransition = Math.min(1, storyTransition + dt * 1.8); storyGroup.scale.setScalar(.8 + storyTransition * .2);
          storyGroup.children.forEach(n => { if (n.userData.storyFloat) n.rotation.z = Math.sin(elapsed * 1.8) * .09; });
        }
        if (focusWanted) {
          const actor = actors.get(active) || actors.values().next().value;
          if (actor) { cameraCenter.copy(actor.root.position); cameraCenter.y += .8; if (environmentVisit) { cameraCenter.x += (environmentVisit.placement.x - cameraCenter.x) * .32; cameraCenter.z += (environmentVisit.placement.z - cameraCenter.z) * .32; } controls.target.lerp(cameraCenter, moving ? smoothFactor(12, dt) : 1); desiredCamera.copy(cameraCenter); desiredCamera.x += 3.2; desiredCamera.y += 2.5; desiredCamera.z += 5; camera.position.lerp(desiredCamera, moving ? smoothFactor(10, dt) : 1); }
        }
        const companion = actors.get(active);
        const diagnostics = renderer.domElement.dataset, action = companion?.clip || 'loading', targetId = environmentVisit?.placement.id || '', traveling = companion?.target ? 'true' : 'false';
        if (diagnostics.petAction !== action) diagnostics.petAction = action;
        if (diagnostics.environmentTarget !== targetId) diagnostics.environmentTarget = targetId;
        if (diagnostics.petMoving !== traveling) diagnostics.petMoving = traveling;
        const phase = environmentVisit ? environmentVisit.arrivedAt == null ? 'approaching' : environmentVisit.responded ? 'response' : 'contact' : '';
        if (diagnostics.environmentPhase !== phase) diagnostics.environmentPhase = phase;
        controls.update(); if (sceneVisible) renderer.render(stage, camera);
      }
      frame = requestAnimationFrame(draw);
      let cleaned = false;
      destroy = () => {
        if (cleaned) return; cleaned = true;
        cancelAnimationFrame(frame); observer.disconnect(); visibilityObserver.disconnect(); controls.dispose(); runtime.current = null;
        timers.forEach(timer => clearTimeout(timer)); timers.clear(); pending.clear();
        renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('pointercancel', pointerCancel); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
        actors.forEach(a => { a.mixer.stopAllAction(); a.mixer.uncacheRoot(a.model); });
        geometrySet.forEach(g => g.dispose()); materialSet.forEach(m => m.dispose()); loadedGeometry.forEach(g => g.dispose()); loadedMaterials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      };
    }).catch(() => { destroy(); if (!disposed) setStatus('fallback'); });
    return () => { disposed = true; destroy(); };
  }, [scene, quality, night]);

  const controlStyle = { border: '1px solid rgba(255,255,255,.72)', background: 'rgba(255,253,245,.9)', color: '#40696b', borderRadius: 12, minHeight: 44, minWidth: 44, padding: '8px 11px', font: 'inherit', fontSize: 12, cursor: 'pointer', boxShadow: '0 3px 12px #456c7520' };
  return <div className="town-scene" data-testid="town-scene" data-renderer={status} data-scene={scene} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 280, overflow: 'hidden', background: '#d9eae7', isolation: 'isolate' }}>
    <div ref={host} style={{ position: 'absolute', inset: 0, visibility: status === 'fallback' ? 'hidden' : 'visible' }}/>
    {status === 'fallback' && <FlatTown pets={pets}/>}
    {status === 'loading' && <div role="status" style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '10px 16px', borderRadius: 20, background: '#fffcf0e8', fontSize: 13, color: '#537b76', whiteSpace: 'nowrap' }}>正在打開海邊的小家…</div>}
    <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 6, zIndex: 2 }}>
      <button type="button" style={controlStyle} onClick={() => setNight(v => !v)} disabled={status === 'fallback'} aria-label={night ? '切換白天' : '切換夜晚'}>{night ? '☀ 白天' : '☾ 夜晚'}</button>
      <button type="button" style={controlStyle} onClick={() => { const next = !focus; setFocus(next); if (!next) runtime.current?.reset(); }} disabled={status !== 'ready'} aria-pressed={focus}>{focus ? '看小鎮' : '看夥伴'}</button>
    </div>
    {status === 'ready' && <span className="town-scene-hint" style={{ position: 'absolute', left: 15, bottom: 13, padding: '6px 10px', borderRadius: 12, color: '#496f68', background: '#f9faeed9', fontSize: 11, pointerEvents: 'none' }}>拖曳看風景 · 點地面散步 · 點夥伴摸摸</span>}
    {status === 'fallback' && <span role="status" style={{ position: 'absolute', bottom: 10, left: 12, right: 12, textAlign: 'center', color: '#456c65', background: '#fffcf0de', borderRadius: 12, padding: 8, fontSize: 12 }}>目前使用輕量場景，照顧、布置與探險仍可使用。</span>}
  </div>;
}
