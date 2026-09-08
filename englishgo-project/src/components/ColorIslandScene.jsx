import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ISLAND_COLORS, islandColor, islandTilePosition } from '../data/colorIsland.js';

export default function ColorIslandScene(props) {
  const host = useRef(null), latest = useRef(props), [failed, setFailed] = useState(false);
  latest.current = props;
  useEffect(() => {
    const element = host.current, resources = new Set(), materials = new Map(), geometries = new Map();
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setFailed(true); latest.current.onUnavailable(); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 600 ? 1.25 : 1.7));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor('#83d6ef'); renderer.domElement.setAttribute('aria-label', '十六塊彩色浮島；點平台移動，錯色平台會落下'); element.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 100), raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    scene.fog = new THREE.Fog('#83d6ef', 35, 75); camera.position.set(0, 14, 13); camera.lookAt(0, -.3, 0);
    scene.add(new THREE.HemisphereLight('#fff7e4', '#8099cb', 2.8));
    const sun = new THREE.DirectionalLight('#fff8ed', 2.7); sun.position.set(-8, 18, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(innerWidth < 600 ? 512 : 1024, innerWidth < 600 ? 512 : 1024); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sun.shadow.normalBias = .035; scene.add(sun);
    const geometryFor = (key, create) => { if (!geometries.has(key)) { const geometry = create(); geometries.set(key, geometry); resources.add(geometry); } return geometries.get(key); };
    const materialFor = color => { if (!materials.has(color)) { const material = new THREE.MeshStandardMaterial({ color, roughness: .4 }); materials.set(color, material); resources.add(material); } return materials.get(color); };
    function mesh(geometry, color, parent = scene, x = 0, y = 0, z = 0) { resources.add(geometry); const object = new THREE.Mesh(geometry, materialFor(color)); object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object; }
    const box = (w, h, d, color, parent, x, y, z) => mesh(geometryFor(`${w}:${h}:${d}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * .2)), color, parent, x, y, z);
    const ball = (radius, color, parent, x, y, z) => mesh(geometryFor(`ball:${radius}`, () => new THREE.SphereGeometry(radius, 20, 12)), color, parent, x, y, z);
    const labels = new Map();
    ISLAND_COLORS.forEach(color => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const context = canvas.getContext('2d'); context.fillStyle = color.ink; context.font = '72px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(color.symbol, 64, 67);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; resources.add(texture);
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }); resources.add(material); labels.set(color.id, material);
    });
    const tiles = [], pickable = [];
    for (let index = 0; index < 16; index++) {
      const group = new THREE.Group(), position = islandTilePosition(index); group.position.set((position.x - 1.5) * 2.1, 0, (position.z - 1.5) * 2.1); scene.add(group);
      box(2.02, .6, 2.02, '#fff8ed', group, 0, -.34, 0);
      const top = box(1.95, .15, 1.95, ISLAND_COLORS[index % 4].hex, group, 0, .02, 0); top.userData.tile = index; pickable.push(top);
      const label = new THREE.Mesh(geometryFor('label', () => new THREE.PlaneGeometry(.95, .95)), labels.get('red')); label.rotation.x = -Math.PI / 2; label.position.y = .11; group.add(label);
      tiles.push({ group, top, label });
    }
    const destination = mesh(new THREE.TorusGeometry(.78, .055, 8, 40), '#ffffff'); destination.rotation.x = -Math.PI / 2; destination.castShadow = false;
    const player = new THREE.Group(); scene.add(player);
    mesh(new THREE.CapsuleGeometry(.35, .48, 4, 16), '#a878df', player, 0, .79, 0);
    const face = ball(.32, '#fff8ec', player, 0, .93, .27); face.scale.set(1, .9, .28);
    [-.105, .105].forEach(x => { const eye = ball(.04, '#322650', player, x, .97, .365); eye.scale.y = 1.6; });
    const arms = [-1, 1].map(side => { const arm = mesh(new THREE.CapsuleGeometry(.12, .3, 4, 8), '#a878df', player, side * .43, .67, 0); arm.rotation.z = side * .4; return arm; });
    const feet = [-.19, .19].map(x => { const foot = ball(.19, '#613d9d', player, x, .18, .1); foot.scale.set(1, .7, 1.3); return foot; });
    [-.18, .18].forEach(x => { box(.06, .22, .06, '#a878df', player, x, 1.42, 0); ball(.075, '#ffe878', player, x, 1.56, 0); });
    const marker = mesh(new THREE.ConeGeometry(.17, .3, 3), '#ffffff', player, 0, 2.03, 0); marker.rotation.z = Math.PI;
    const ring = mesh(new THREE.TorusGeometry(.7, .18, 10, 28), '#ffb95b'); ring.rotation.x = Math.PI / 2; ring.visible = false;
    const outer = mesh(new THREE.TorusGeometry(6.4, .25, 10, 64), '#eec0e9', scene, 0, -1.1, 0); outer.rotation.x = Math.PI / 2;
    const water = mesh(new THREE.PlaneGeometry(150, 150), '#9ae1e5', scene, 0, -5, 0); water.rotation.x = -Math.PI / 2; water.castShadow = false;
    for (let i = 0; i < 8; i++) {
      const x = Math.cos(i * Math.PI / 4) * 11, z = Math.sin(i * Math.PI / 4) * 10;
      const cloud = new THREE.Group(); cloud.position.set(x, i % 2 ? 2.5 : -1, z); scene.add(cloud);
      for (let j = 0; j < 3; j++) { const puff = ball(1.3, '#f9fcff', cloud, j * 1.1, 0, 0); puff.scale.y = .55; puff.castShadow = false; }
      if (i % 2 === 0 && z < 1) { const balloon = ball(.8, ISLAND_COLORS[i].hex, scene, x * .7, 4, z * .7); balloon.scale.y = 1.3; balloon.castShadow = false; }
    }
    const confetti = Array.from({ length: 45 }, (_, i) => { const piece = box(.1, .2, .04, ISLAND_COLORS[i % 8].hex); piece.castShadow = false; piece.visible = false; return piece; });
    const modeColors = latest.current.mode?.colors || 4, preview = Array.from({ length: 16 }, (_, i) => ISLAND_COLORS[i % modeColors].id);
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let frame, last = performance.now(), t = 0, painted = null, down = null, dirty = true, renderedState;
    function resize() { const w = element.clientWidth, h = element.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.fov = camera.aspect < .8 ? 65 : 48; camera.setViewOffset(w, h, 0, 30, w, h); camera.updateProjectionMatrix(); dirty = true; }
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const pointerDown = event => { down = { x: event.clientX, y: event.clientY }; };
    const select = event => {
      const from = down; down = null;
      if (!from || Math.hypot(event.clientX - from.x, event.clientY - from.y) > 12 || latest.current.state?.phase !== 'playing') return;
      const bounds = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(pickable)[0]; if (hit) latest.current.onSelect(hit.object.userData.tile);
    };
    const cancel = () => { down = null; }, lost = event => { event.preventDefault(); setFailed(true); latest.current.onUnavailable(); };
    element.addEventListener('pointerdown', pointerDown); element.addEventListener('pointerup', select); element.addEventListener('pointercancel', cancel); renderer.domElement.addEventListener('webglcontextlost', lost);
    function animate(now) {
      frame = requestAnimationFrame(animate); const dt = Math.min(.08, (now - last) / 1000); last = now;
      const state = latest.current.state, phase = state?.phase || 'lobby', visual = phase === 'paused' ? state.resumePhase : phase;
      if (document.hidden || phase === 'unavailable' || phase === 'paused' && !dirty && renderedState === state) return;
      const calm = motion?.matches || document.documentElement.dataset.egCalm === 'true';
      if (phase !== 'paused') t += dt;
      const round = state?.rounds[state.index], board = round?.tiles || preview;
      if (painted !== board) { tiles.forEach((tile, index) => { const color = islandColor(board[index]); tile.top.material = materialFor(color.hex); tile.label.material = labels.get(color.id); }); painted = board; }
      const resolving = ['resolving', 'won', 'lost'].includes(visual), elapsed = state ? (1700 - state.resolveMs) / 1000 : 0;
      tiles.forEach((tile, index) => {
        const falls = resolving && board[index] !== round?.target, drop = Math.max(0, elapsed - index % 4 * .035);
        tile.group.position.y = falls ? -Math.min(7, drop * drop * 10) : 0;
        tile.group.rotation.z = falls && !calm ? Math.min(.3, drop * .3) * (index % 2 ? 1 : -1) : 0;
      });
      const position = state?.position || { x: 1, z: 1 };
      destination.visible = visual === 'playing';
      if (destination.visible) { const selected = islandTilePosition(state.targetTile); destination.position.set((selected.x - 1.5) * 2.1, .17, (selected.z - 1.5) * 2.1); destination.scale.setScalar(calm ? 1 : 1 + Math.sin(t * 5) * .04); }
      const moving = phase === 'playing' && Math.hypot(position.x - islandTilePosition(state.targetTile).x, position.z - islandTilePosition(state.targetTile).z) > .03;
      player.position.set((position.x - 1.5) * 2.1, resolving && state.passed === false ? -Math.min(3.2, elapsed * elapsed * 5) : !calm && moving ? Math.abs(Math.sin(t * 15)) * .09 : .08, (position.z - 1.5) * 2.1);
      player.rotation.z = resolving && state.passed === false && !calm ? Math.sin(elapsed * 5) * .2 : 0;
      arms.forEach((arm, index) => { arm.rotation.x = !calm && moving ? Math.sin(t * 14 + index * Math.PI) * .7 : 0; arm.rotation.z = (index ? -1 : 1) * (resolving && state.passed ? 1.4 : .35); });
      feet.forEach((foot, index) => { foot.position.z = !calm && moving ? Math.sin(t * 14 + index * Math.PI) * .15 : .1; });
      marker.position.y = 2.03 + (calm ? 0 : Math.sin(t * 3) * .07);
      ring.visible = resolving && state.passed === false; ring.position.set(player.position.x, player.position.y + .3, player.position.z);
      confetti.forEach((piece, index) => { piece.visible = phase === 'won' && !calm; if (piece.visible) { piece.position.set(Math.sin(index * 7) * 5, (index * .4 + t * 2) % 8, Math.cos(index * 9) * 5); piece.rotation.set(t, index, t * 2); } });
      renderer.render(scene, camera); dirty = false; renderedState = state;
    }
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); element.removeEventListener('pointerdown', pointerDown); element.removeEventListener('pointerup', select); element.removeEventListener('pointercancel', cancel); renderer.domElement.removeEventListener('webglcontextlost', lost); resources.forEach(resource => resource.dispose()); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  return <><div className="island-scene" ref={host}/>{failed && <div className="island-render-error" role="alert">這台裝置暫時無法顯示 3D 小島。請開啟瀏覽器硬體加速後，再重新進入遊戲。</div>}</>;
}
