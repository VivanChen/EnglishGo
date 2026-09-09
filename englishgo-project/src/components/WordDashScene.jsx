import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DASH_COURSES, dashCourseObstacle, dashObstacleHit, dashRivalDistances, dashRaceRank, dashCameraDistance } from '../data/wordDash.js';

const COLORS = ['#ff58b3', '#3ed9ef', '#ffd84f'];
export default function WordDashScene(props) {
  const host = useRef(null), latest = useRef(props), [failed, setFailed] = useState(false);
  latest.current = props;
  useEffect(() => {
    const element = host.current;
    const course = latest.current.course || DASH_COURSES[0];
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); } catch { setFailed(true); latest.current.onUnavailable?.(); return; }
    const mobileDevice = window.innerWidth < 600;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobileDevice ? 1.25 : 1.7));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(course.sky);
    renderer.domElement.setAttribute('aria-label', `${course.title}：圓滾角色在立體障礙賽道上奔跑`);
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(course.sky, 55, 155);
    const camera = new THREE.PerspectiveCamera(48, 1, .1, 240);
    scene.add(new THREE.HemisphereLight('#ffffff', '#7a65ca', 2.6));
    const sun = new THREE.DirectionalLight('#fff5dc', 3); sun.position.set(-14, 25, 10); sun.castShadow = true;
    sun.shadow.mapSize.set(mobileDevice ? 512 : 1024, mobileDevice ? 512 : 1024); Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 30, bottom: -30, near: .1, far: 100 }); sun.shadow.normalBias = .035; scene.add(sun); scene.add(sun.target);
    const resources = new Set(), materials = new Map(), geometries = new Map(), gates = [], obstacles = [], confetti = [], particles = [];
    const geometryFor = (key, factory) => { if (!geometries.has(key)) geometries.set(key, factory()); return geometries.get(key); };
    function mesh(geometry, color, parent = scene, x = 0, y = 0, z = 0) {
      if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .35, metalness: .03 }));
      const material = materials.get(color);
      const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); resources.add(geometry); resources.add(material); return object;
    }
    const box = (w, h, d, color, parent, x, y, z) => mesh(geometryFor(`box:${w},${h},${d}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * .18)), color, parent, x, y, z);
    const ball = (r, color, parent, x, y, z) => mesh(geometryFor(`sphere:${r}`, () => new THREE.SphereGeometry(r, 20, 14)), color, parent, x, y, z);
    function bean(color) {
      const root = new THREE.Group(); scene.add(root);
      mesh(new THREE.CapsuleGeometry(.5, .65, 5, 16), color, root, 0, 1.05, 0);
      const face = ball(.44, '#fff9ed', root, 0, 1.28, -.38); face.scale.set(1, .86, .32);
      [-.14, .14].forEach(x => { const eye = ball(.055, '#28214d', root, x, 1.3, -.516); eye.scale.y = 1.65; });
      const arms = [-1, 1].map(side => { const arm = mesh(new THREE.CapsuleGeometry(.16, .4, 4, 10), color, root, side * .6, .94, 0); arm.rotation.z = side * .4; return arm; });
      const feet = [-.25, .25].map(x => { const foot = ball(.24, '#6143b5', root, x, .2, -.12); foot.scale.set(1, .65, 1.45); return foot; });
      // A little crown of antennae makes the runner an original EnglishGo character.
      [-.22, .22].forEach(x => { box(.08, .26, .08, color, root, x, 2.02, 0); ball(.1, '#fff183', root, x, 2.2, 0); });
      return { root, arms, feet };
    }
    const player = bean('#b57cff'); player.root.scale.setScalar(1.15);
    const playerMaterial = materials.get('#b57cff').clone(); resources.add(playerMaterial);
    player.root.traverse(object => { if (object.material === materials.get('#b57cff')) object.material = playerMaterial; });
    const marker = mesh(new THREE.ConeGeometry(.2, .35, 3), '#ffffff', player.root, 0, 2.8, 0); marker.rotation.z = Math.PI;
    const bots = Array.from({ length: 6 }, (_, i) => ({ ...bean(['#ff739b', '#ffca45', '#47dace', '#79a8ff', '#fa9b51', '#e685ee'][i]), offset: i }));
    const length = 32, total = latest.current.total;
    for (let r = 0; r < total; r++) {
      const z = -r * length;
      box(15, 1.2, 32, course.floors[r % course.floors.length], scene, 0, -.65, z - 10);
      [-7.4, 7.4].forEach(x => { box(.5, .8, 31.5, course.rail, scene, x, .25, z - 10); for (let t = 0; t < 5; t++) ball(.36, '#fff0aa', scene, x, .85, z + 3 - t * 6); });
      [-2.3, 2.3].forEach(x => box(.1, .02, 28, '#b9f4fa', scene, x, .015, z - 9));
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 4.65, group = new THREE.Group(); group.position.set(x, 0, z - 22); scene.add(group);
        [-2, 2].forEach(dx => box(.52, 4.6, 1, COLORS[i], group, dx, 2.3, 0));
        box(4.5, .7, 1.05, COLORS[i], group, 0, 4.55, 0);
        const panel = new THREE.Group(); group.add(panel);
        box(3.45, 3.7, .3, COLORS[i], panel, 0, 1.88, 0);
        for (let s = 0; s < 5; s++) { const stripe = box(.4, 3.4, .05, '#fff5fc', panel, -1.3 + s * .65, 1.85, .19); stripe.rotation.z = -.12; }
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160;
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; resources.add(texture);
        const signMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true }); resources.add(signMaterial);
        const geometry = new THREE.PlaneGeometry(3.7, 1.16); resources.add(geometry);
        const sign = new THREE.Mesh(geometry, signMaterial); sign.position.set(0, 3, .26); panel.add(sign);
        gates.push({ group, panel, canvas, texture, round: r, lane: i, hitAt: -10, opened: false });
      }
      const obstacleType = dashCourseObstacle(course, r);
      if (obstacleType === 'bar') {
        const spinner = new THREE.Group(); spinner.position.set(0, .65, z - 10); scene.add(spinner);
        box(13, .55, .6, '#ff6db4', spinner, 0, 0, 0); ball(.65, '#ffdd55', spinner, 0, 0, 0);
        const ring = mesh(new THREE.TorusGeometry(1.1, .18, 8, 30), '#fff6aa', spinner, 0, .2, 0); ring.rotation.x = Math.PI / 2;
        obstacles.push({ type: 'bar', root: spinner, round: r, x: 0, z: z - 10, angle: 0 });
      } else if (obstacleType === 'ball') {
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * 4.65, root = new THREE.Group(); root.position.set(x, 1, z - 9 - i * 1.4); scene.add(root);
          ball(.95, COLORS[i], root, 0, 0, 0);
          const ring = mesh(new THREE.TorusGeometry(.95, .08, 8, 24), '#fffaf1', root); ring.rotation.x = Math.PI / 2;
          box(2.5, .15, 2.5, '#fff1ad', scene, x, .1, root.position.z);
          obstacles.push({ type: 'ball', root, round: r, x, z: root.position.z, y: 1, radius: .95, offset: i * 1.9 });
        }
      } else if (obstacleType === 'roller') {
        for (let i = 0; i < 2; i++) {
          const root = new THREE.Group(); root.position.set(0, 1.1, z - 7 - i * 6); scene.add(root);
          ball(1.1, COLORS[(r + i) % 3], root);
          const ring = mesh(new THREE.TorusGeometry(1.1, .1, 8, 24), '#fffaf1', root); ring.rotation.x = Math.PI / 2;
          [-5, 0, 5].forEach(x => box(1.2, .025, .16, '#fff8ba', scene, x, .03, root.position.z));
          obstacles.push({ type: 'roller', root, round: r, x: 0, z: root.position.z, y: 1.1, radius: 1.1, offset: i * Math.PI + r * .5 });
        }
      } else if (obstacleType === 'piston') {
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * 4.65, root = new THREE.Group(); root.position.set(x, -1.6, z - 10 - i * .6); scene.add(root);
          box(2.5, 1.8, 2.5, COLORS[i], root, 0, 0, 0);
          box(2.25, .15, 2.25, '#fff6e3', root, 0, .84, 0);
          const button = ball(.38, COLORS[i], root, 0, 1, 0); button.scale.y = .3;
          const rim = mesh(new THREE.TorusGeometry(1.6, .1, 8, 24), '#ffe18c', scene, x, .06, root.position.z); rim.rotation.x = Math.PI / 2;
          obstacles.push({ type: 'piston', root, rim, round: r, x, z: root.position.z, y: -1.6, width: 2.5, height: 1.8, depth: 2.5, offset: i * Math.PI * 2 / 3 });
        }
      }
      for (let k = 0; k < 3; k++) { const chevron = box(1.4, .025, .45, '#fff6ae', scene, 0, .03, z + 1 - k * 1.4); chevron.rotation.y = .5; }
    }
    box(15, 1, 12, '#ffc94a', scene, 0, -.5, -total * length + 6);
    for (let x = -6; x <= 6; x += 2) for (let z = 0; z < 4; z++) box(2, .03, 1.4, (x / 2 + z) % 2 ? '#ffffff' : '#7751be', scene, x, .04, -total * length + 9 - z * 1.4);
    const finishZ = -total * length + 3, crown = new THREE.Group(); crown.position.set(0, 6, finishZ); scene.add(crown);
    box(3.4, .8, .65, '#ffcd38', crown, 0, 0, 0);
    [-1.3, 0, 1.3].forEach(x => { const point = mesh(new THREE.ConeGeometry(.65, 1.5, 4), '#ffe86a', crown, x, 1, 0); point.rotation.y = Math.PI / 4; ball(.17, '#fffbe0', crown, x, 1.9, 0); });
    [-6.7, 6.7].forEach(x => box(.7, 7, .7, '#9f6dea', scene, x, 3.5, finishZ));
    box(14, .7, .7, '#ffd647', scene, 0, 7, finishZ);
    for (let i = 0; i < Math.ceil(total * length / 8) + 5; i++) {
      const cloud = new THREE.Group(); scene.add(cloud); cloud.position.set((i % 2 ? 1 : -1) * (15 + i % 4 * 5), -3 + i % 3 * 4, 15 - i * 8);
      if (course.id === 'starlight') {
        const star = mesh(new THREE.OctahedronGeometry(.8), '#fff4ac', cloud); star.castShadow = false; star.rotation.z = i;
        if (i % 3 === 0) {
          const planet = ball(2.2, COLORS[i % 3], cloud, 0, 6, 0); planet.castShadow = false;
          const ring = mesh(new THREE.TorusGeometry(3.1, .18, 8, 32), '#ecd6ff', cloud, 0, 6, 0); ring.rotation.x = 1.15; ring.rotation.y = .35; ring.castShadow = false;
        }
      } else {
        for (let j = 0; j < 3; j++) { const puff = ball(2.6, '#f1fcff', cloud, j * 2, 0, 0); puff.scale.y = .65; puff.castShadow = false; puff.receiveShadow = false; }
        if (i % 3 === 0) { const balloon = ball(2, COLORS[i % 3], scene, cloud.position.x, 9 + i % 5, cloud.position.z); balloon.scale.y = 1.3; balloon.castShadow = false; }
      }
    }
    for (let i = 0; i < 55; i++) { const piece = box(.15, .3, .05, COLORS[i % 3], scene, 0, -10, 0); piece.visible = false; piece.castShadow = false; confetti.push(piece); }
    for (let i = 0; i < 30; i++) { const piece = box(.22, .26, .14, COLORS[i % 3], scene); piece.visible = false; piece.castShadow = false; particles.push({ root: piece, life: 0, velocity: new THREE.Vector3() }); }
    function burst(x, z) { particles.forEach((piece, i) => { piece.root.visible = true; piece.root.position.set(x, 1.5, z); piece.life = .9 + (i % 5) * .08; piece.velocity.set(Math.sin(i * 4.1) * 5, 2 + (i % 4), Math.cos(i * 4.1) * 4); }); }
    const cameraTarget = new THREE.Vector3(), lookTarget = new THREE.Vector3(0, .6, -9), cameraAim = new THREE.Vector3();
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const hitObstacles = new Set();
    let frame, last = performance.now(), t = 0, distance = -2, jumpTime = -1, lastJump = 0, lastRound = -1, stagger = 0;
    let raceSeconds = 0, lastRank = 0, lastRaceUpdate = -1, cameraDistance = -2;
    let boost = 0, recoil = 0, recoilFrom = 0, lastProgress = -1, cameraReady = false, finished = false, landing = 0, redraw = true, outfit;
    function resize() { const w = element.clientWidth, h = element.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); redraw = true; }
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const lost = event => { event.preventDefault(); setFailed(true); latest.current.onUnavailable?.(); };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    function animate(now) {
      frame = requestAnimationFrame(animate); const dt = Math.min((now - last) / 1000, .08); last = now;
      const p = latest.current, active = p.phase === 'playing', idle = p.phase === 'lobby', finishing = p.phase === 'finishing';
      const calm = document.documentElement.dataset.egCalm === 'true' || motionQuery?.matches;
      if (document.hidden || p.phase === 'unavailable' || p.phase === 'paused' && !redraw) return;
      const moving = active || finishing || (idle || p.phase === 'won') && !calm;
      if (moving) t += dt;
      if (outfit !== p.color) { outfit = p.color; playerMaterial.color.set(outfit || '#b57cff'); }
      if (moving) obstacles.forEach(obstacle => {
        if (obstacle.type === 'bar') { obstacle.angle = t * (1.15 + obstacle.round * .13) * course.tempo + obstacle.round; obstacle.root.rotation.y = obstacle.angle; }
        else if (obstacle.type === 'roller') { obstacle.x = Math.sin(t * 1.1 * course.tempo + obstacle.offset) * 5.6; obstacle.root.position.x = obstacle.x; obstacle.root.rotation.z = -obstacle.x / obstacle.radius; }
        else if (obstacle.type === 'piston') { const lift = Math.max(0, Math.sin(t * 1.8 * course.tempo + obstacle.offset)); obstacle.y = -1.6 + lift * 2.6; obstacle.root.position.y = obstacle.y; obstacle.rim.scale.setScalar(1 + lift * .12); }
        else { obstacle.y = 1.05 + Math.abs(Math.sin(t * 1.75 * course.tempo + obstacle.offset)) * 2.5; obstacle.root.position.y = obstacle.y; obstacle.root.rotation.z = Math.sin(t + obstacle.offset) * .2; }
      });
      if (p.round !== lastRound || (gates[0] && !gates[0].painted)) {
        lastRound = p.round;
        gates.forEach(gate => {
          if (gate.round < p.round) return;
          const ctx = gate.canvas.getContext('2d'); ctx.clearRect(0, 0, 512, 160); ctx.fillStyle = '#fffdfb'; ctx.beginPath(); ctx.roundRect(4, 4, 504, 152, 28); ctx.fill();
          const label = gate.round === p.round && p.choices ? p.choices[gate.lane].m : ['READY', 'SET', 'GO!'][gate.lane];
          ctx.fillStyle = '#473069'; ctx.font = `900 ${Math.min(64, 430 / Math.max(3, label.length))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 256, 83); gate.texture.needsUpdate = true; gate.painted = true;
        });
      }
      if (active || finishing) raceSeconds += dt;
      const rivalDistances = dashRivalDistances(raceSeconds, course, total);
      if (active) {
        if (p.jump !== lastJump) { lastJump = p.jump; if (jumpTime < 0) jumpTime = 0; }
        if (jumpTime >= 0) { jumpTime += dt; if (jumpTime > .95) { jumpTime = -1; landing = 1; } }
        stagger = Math.max(0, stagger - dt);
        boost = Math.max(0, boost - dt);
        if (recoil > 0) { recoil = Math.max(0, recoil - dt); const amount = 1 - recoil / .6; distance = recoilFrom - 6 * (1 - (1 - amount) ** 3); }
        else distance += dt * (stagger ? 1.2 : boost ? course.speed + 2.1 : course.speed);
        const jumpHeight = jumpTime < 0 ? 0 : Math.sin(jumpTime / .95 * Math.PI) * 2.8;
        const collision = !recoil && obstacles.find(obstacle => obstacle.round === p.round && !hitObstacles.has(obstacle) && dashObstacleHit(obstacle, player.root.position.x, -distance, jumpHeight));
        if (collision) { hitObstacles.add(collision); stagger = .9; boost = 0; p.onBump(); }
        if (!recoil && distance >= p.round * length + 21) {
          const selected = Math.max(0, Math.min(2, Math.round(player.root.position.x / 4.65 + 1)));
          const gate = gates.find(item => item.round === p.round && item.lane === selected);
          gate.hitAt = t;
          if (p.onGate(selected)) { gate.opened = true; boost = 1.8; burst(player.root.position.x, -distance - 1); distance += .3; }
          else { recoilFrom = distance; recoil = .6; stagger = 1; boost = 0; jumpTime = -1; }
        }
      }
      if (finishing && !finished) {
        jumpTime = -1;
        distance = Math.min(total * length - 3, distance + dt * 6);
        if (distance >= total * length - 3) { finished = true; p.onFinish?.(dashRaceRank(distance, rivalDistances, total * length - 3)); }
      }
      if (active || finishing) {
        const value = Math.max(0, Math.min(100, Math.round((distance + 2) / (total * length - 1) * 100)));
        if (value !== lastProgress) { lastProgress = value; p.onProgress?.(value); }
      }
      if (active || finishing) {
        const rank = dashRaceRank(distance, rivalDistances, total * length - 3);
        if (rank !== lastRank) { lastRank = rank; p.onRank?.(rank); }
        if (raceSeconds - lastRaceUpdate >= .1 || finished) {
          lastRaceUpdate = raceSeconds;
          p.onRace?.({ player: distance, rivals: rivalDistances, finish: total * length - 3 });
        }
      }
      const targetX = idle ? 2.8 : finishing || p.phase === 'won' ? 0 : (p.lane - 1) * 4.65;
      if (p.phase !== 'paused') {
        landing = Math.max(0, landing - dt * 5);
        player.root.position.x += (targetX - player.root.position.x) * Math.min(1, dt * 10);
        player.root.position.z = -distance;
        player.root.position.y = jumpTime >= 0 ? Math.sin(jumpTime / .95 * Math.PI) * 2.8 : calm ? 0 : Math.abs(Math.sin(t * 10)) * (active || finishing ? .12 : .04);
        const size = idle ? 1.65 : 1.15;
        player.root.scale.set(size * (1 + landing * .15), size * (jumpTime >= 0 ? 1.07 : 1 - landing * .2), size * (1 + landing * .15));
        player.root.rotation.y = idle || p.phase === 'won' ? Math.PI + .35 : (targetX - player.root.position.x) * -.08;
        player.root.rotation.z = !calm && stagger ? Math.sin(t * 22) * .22 : (targetX - player.root.position.x) * -.06;
        player.root.rotation.x = recoil && !calm ? -.4 * Math.sin(recoil / .6 * Math.PI) : 0;
        player.arms.forEach((arm, i) => { arm.rotation.x = calm ? 0 : Math.sin(t * 10 + i * Math.PI) * .55; arm.rotation.z = (i ? 1 : -1) * (jumpTime >= 0 || p.phase === 'won' ? 1.5 : .4); });
        player.feet.forEach((foot, i) => foot.position.z = calm ? -.12 : Math.sin(t * 10 + i * Math.PI) * .22);
        marker.position.y = 2.8 + (calm ? 0 : Math.sin(t * 3) * .08);
        bots.forEach((bot, i) => { bot.root.position.set((i % 3 - 1) * 4.4 + .7, calm ? 0 : Math.abs(Math.sin(t * 9 + i)) * .18, idle ? 4.5 - Math.floor(i / 3) * 2 : -rivalDistances[i]); bot.arms.forEach((arm, j) => arm.rotation.x = calm ? 0 : Math.sin(t * 9 + i + j * Math.PI) * .6); });
        gates.forEach(gate => {
          const age = Math.max(0, t - gate.hitAt);
          if (gate.opened) { gate.panel.rotation.x = -Math.min(Math.PI / 2, age * 6); gate.panel.scale.setScalar(Math.max(0, 1 - age * .85)); gate.panel.visible = age < 1.2; }
          else gate.group.rotation.z = calm ? 0 : Math.sin(age * 32) * Math.exp(-age * 8) * .13;
        });
        particles.forEach(piece => { if (piece.life <= 0) return; piece.life -= dt; piece.root.visible = piece.life > 0 && !calm; piece.velocity.y -= dt * 10; piece.root.position.addScaledVector(piece.velocity, dt); piece.root.rotation.x += dt * 5; piece.root.rotation.z += dt * 3; });
        crown.rotation.y = calm ? 0 : Math.sin(t * 1.2) * .25;
      }
      const mobile = camera.aspect < .8;
      if (idle) { camera.position.set(19, 16, 23); camera.lookAt(0, 1, -12); }
      else if (p.phase !== 'paused') {
        cameraDistance = dashCameraDistance(cameraDistance, distance);
        cameraTarget.set(player.root.position.x * .22, mobile ? 14 : 9.5, -cameraDistance + (mobile ? 22 : 16));
        if (!cameraReady || calm) { camera.position.copy(cameraTarget); lookTarget.set(0, .6, -cameraDistance - 11); cameraReady = true; }
        else { camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 8)); lookTarget.lerp(cameraAim.set(0, .6, -cameraDistance - 11), 1 - Math.exp(-dt * 8)); }
        camera.lookAt(lookTarget);
        camera.fov += ((boost && !calm ? 52 : 48) - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
      }
      sun.position.set(-14, 25, -distance + 10); sun.target.position.set(0, 0, -distance - 8);
      if (p.phase === 'won' && lastRank === 1) confetti.forEach((piece, i) => { piece.visible = !calm; piece.position.set(Math.sin(i * 7) * 8, 2 + (12 - (t * 3 + i * .4) % 12), -distance + Math.cos(i * 5) * 6); piece.rotation.set(t + i, t * 2, i); });
      renderer.render(scene, camera);
      redraw = false;
    }
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('webglcontextlost', lost); resources.forEach(resource => resource.dispose()); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  return <><div className="dash-scene" ref={host}/>{failed && <div className="dash-render-error" role="alert">這台裝置無法顯示 3D 賽道。請開啟瀏覽器硬體加速後重新進入遊戲。</div>}</>;
}
