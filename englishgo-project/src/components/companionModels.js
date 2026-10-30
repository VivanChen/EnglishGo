import * as T from 'three';
import { getPetAppearance } from '../data/petAppearance.js';

/** Original plush sculptures built locally. Shared geometry keeps all 29 species light. */
export function createCompanionModel(id, stage = 'baby') {
  const design = getPetAppearance(id), { shape, coat, shade, cream, accent } = design;
  const root = new T.Group(), head = new T.Group(), eyes = [], closedEyes = [], ears = [];
  const geometries = new Set(), materials = new Map();
  const own = geometry => { geometries.add(geometry); return geometry; };
  const round = own(new T.SphereGeometry(1, 32, 24));
  const material = (color, glossy = false) => {
    const key = `${color}:${glossy}`;
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness: glossy ? .28 : .92, metalness: 0 }));
    return materials.get(key);
  };
  const mesh = (parent, geometry, color, position, scale, glossy = false) => {
    const node = new T.Mesh(geometry, material(color, glossy));
    node.position.set(...position); node.scale.set(...scale); parent.add(node); return node;
  };
  const ball = (parent, color, x, y, z, sx, sy = sx, sz = sx, glossy = false) => mesh(parent, round, color, [x, y, z], [sx, sy, sz], glossy);
  const curve = (parent, color, points, radius = .012) => {
    const geometry = own(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 20, radius, 8, false));
    return mesh(parent, geometry, color, [0, 0, 0], [1, 1, 1]);
  };
  const cone = (parent, color, x, y, z, radius, height) => mesh(parent, own(new T.ConeGeometry(radius, height, 32)), color, [x, y, z], [1, 1, 1]);
  const starBadge = (parent, color, x, y, z, size = .06) => {
    const star = new T.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? size * .43 : size;
      if (i === 0) star.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
      else star.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    star.closePath();
    return mesh(parent, own(new T.ExtrudeGeometry(star, { depth: .008, bevelEnabled: true, bevelSize: .004, bevelThickness: .003, bevelSegments: 2, steps: 1 })), color, [x, y, z], [1, 1, 1]);
  };
  const ear = (side, y, sx, sy, rotation, outer = coat, direction = 1) => {
    const pivot = new T.Group(); pivot.position.set(side * .27, y, 0); pivot.rotation.z = side * rotation;
    ball(pivot, outer, 0, sy * .55 * direction, 0, sx, sy, .085);
    ball(pivot, shape === 'dog' ? shade : '#d9aaa8', 0, sy * .6 * direction, .072, sx * .55, sy * .66, .018);
    head.add(pivot); ears.push({ node: pivot, rest: pivot.rotation.z, side });
    return pivot;
  };
  const petFeature = name => { root.userData.features.push(name); };
  root.name = `companion-${id}`; root.userData.features = [];

  const aquatic = ['seal', 'whale'].includes(shape), bird = shape === 'bird';
  if (shape !== 'whale') ball(root, coat, 0, aquatic ? .31 : .43, -.04, aquatic ? .40 : .30, aquatic ? .30 : .36, aquatic ? .33 : .29);
  ball(root, cream, 0, shape === 'whale' ? .21 : aquatic ? .26 : .43, shape === 'whale' ? .295 : aquatic ? .276 : .226, aquatic ? .26 : .205, shape === 'whale' ? .14 : aquatic ? .20 : .25, .048);
  for (const side of [-1, 1]) {
    const pawColor = design.patches ? shade : bird ? accent : coat;
    if (!aquatic) {
      const paw = ball(root, pawColor, side * .19, .105, .16, .16, .095, .21);
      paw.rotation.y = side * -.12;
    }
    if (!bird) {
      const arm = ball(root, design.patches ? shade : coat, side * (aquatic ? .39 : .30), aquatic ? .24 : .43, .055, aquatic ? .19 : .105, aquatic ? .075 : .22, .12);
      arm.rotation.z = side * (aquatic ? -.22 : .22);
    }
    if (!bird && !aquatic) ball(root, cream, side * .19, .112, .352, .074, .043, .009);
  }
  // Rounded forehead and short muzzle replace the former long, narrow neck.
  head.position.set(0, shape === 'whale' ? .41 : aquatic ? .66 : .96, .035); root.add(head);
  if (shape === 'lion') {
    petFeature('mane');
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ball(head, shade, Math.cos(a) * .36, Math.sin(a) * .32, -.08, .14, .15, .13); }
  }
  ball(head, coat, 0, 0, 0, shape === 'whale' ? .49 : aquatic ? .38 : .41, shape === 'whale' ? .38 : aquatic ? .29 : .35, shape === 'whale' ? .35 : .32);
  if (design.wool) {
    petFeature('wool');
    for (let i = 0; i < 9; i++) { const a = i * Math.PI / 8; ball(head, cream, Math.cos(a) * .34, Math.sin(a) * .30, .015, .115); }
    for (const side of [-1, 1]) ball(root, cream, side * .26, .54, -.10, .13);
  }
  if (shape === 'rabbit') { petFeature('long-ears'); for (const side of [-1, 1]) ear(side, .27, .105, .32, side === -1 ? .19 : .12); }
  else if (['cat', 'fox'].includes(shape)) {
    petFeature('pointed-ears');
    for (const side of [-1, 1]) {
      const pivot = new T.Group(); pivot.position.set(side * .27, .24, -.015); pivot.rotation.z = side * -.18; head.add(pivot);
      const outline = new T.Shape(); outline.moveTo(-.12, -.07); outline.quadraticCurveTo(-.14, -.03, -.045, .20); outline.quadraticCurveTo(0, .30, .045, .20); outline.quadraticCurveTo(.14, -.03, .12, -.07); outline.closePath();
      const geometry = own(new T.ExtrudeGeometry(outline, { depth: .085, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .025, bevelThickness: .025, curveSegments: 12 }));
      mesh(pivot, geometry, coat, [0, 0, 0], [1, 1, 1]);
      mesh(pivot, geometry, '#dbaea8', [0, .014, .097], [.57, .60, .13]);
      ears.push({ node: pivot, rest: pivot.rotation.z, side });
    }
  } else if (shape === 'dog') {
    petFeature('floppy-ears');
    for (const side of [-1, 1]) {
      const floppy = ear(side, .14, .125, .25, side === 1 ? .20 : .13, shade, -1);
      floppy.position.x = side * .35;
      floppy.position.z = .025;
    }
  }
  else if (shape === 'frog') {
    petFeature('eye-bumps'); for (const side of [-1, 1]) ball(head, coat, side * .245, .25, .13, .17, .16, .15);
  } else if (shape === 'sheep') {
    petFeature('soft-ears');
    for (const side of [-1, 1]) {
      const soft = ear(side, .10, .16, .07, side === -1 ? .30 : .22, shade);
      soft.position.x = side * .36;
    }
  } else if (!bird && !aquatic && shape !== 'turtle') {
    petFeature('round-ears');
    for (const side of [-1, 1]) ear(side, .21, design.bigEars ? .19 : .13, shape === 'horse' ? .18 : .13, -.35, design.patches ? shade : coat);
  }
  if (design.tuft || design.crest) {
    petFeature('crest');
    for (let i = 0; i < 3; i++) { const tuft = ball(head, design.crest ? accent : coat, (i - 1) * .074, .34 + (i === 1 ? .04 : 0), -.025, .055, .13, .065); tuft.rotation.z = (i - 1) * -.3; }
  }
  if (design.faceDisk) {
    petFeature('face-patch'); for (const side of [-1, 1]) ball(head, cream, side * .145, -.018, .23, .19, .245, .105);
  }
  if (design.bib) { petFeature('face-patch'); ball(head, cream, 0, -.045, .23, .30, .26, .105); }
  if (design.patches) for (const side of [-1, 1]) {
    const patch = ball(head, shade, side * .152, .015, .287, .106, .12, .027); patch.rotation.z = side * -.27;
  }
  if (design.cheekPatches || shape === 'fox') for (const side of [-1, 1]) ball(head, cream, side * .20, -.12, .255, .165, .125, .070);
  if (!bird && !['frog', 'whale', 'turtle'].includes(shape)) for (const side of [-1, 1]) ball(head, cream, side * .072, -.119, .306, .092, .068, .061);
  if (design.stripes) {
    petFeature('tabby-stripes');
    for (let i = -1; i <= 1; i++) { const stripe = ball(head, shade, i * .10, .24 - Math.abs(i) * .016, .209, .025, .065, .017); stripe.rotation.z = i * -.12; }
    for (const side of [-1, 1]) for (let i = 0; i < 2; i++) ball(head, shade, side * .347, .03 - i * .06, .162, .029, .012, .034);
  }
  if (design.spots) for (const side of [-1, 1]) for (let i = 0; i < 3; i++) ball(head, cream, side * (.24 + i * .035), .12 - i * .045, .24 - i * .025, .022);

  const eyeY = shape === 'frog' ? .26 : shape === 'whale' ? .10 : .026, eyeX = shape === 'frog' ? .245 : shape === 'whale' ? .18 : .148, eyeZ = shape === 'frog' ? .268 : shape === 'whale' ? .33 : design.faceDisk || design.bib ? .335 : .300;
  for (const side of [-1, 1]) {
    const eye = new T.Group(); eye.position.set(side * eyeX, eyeY, eyeZ); eye.rotation.y = side * .18; head.add(eye); eyes.push(eye);
    ball(eye, '#4b3937', 0, 0, 0, .058, .074, .025, true);
    ball(eye, '#252b35', 0, .006, .015, .041, .054, .013, true);
    ball(eye, '#fff8eb', -.017, .030, .027, .017, .020, .006);
    ball(eye, '#c5dcd8', .019, -.023, .027, .007, .008, .004);
    const closed = new T.Group(); closed.position.copy(eye.position); closed.rotation.copy(eye.rotation); head.add(closed);
    curve(closed, '#4b3937', [[-.045, -.005, .02], [0, .023, .034], [.045, -.005, .02]], .009);
    closed.visible = false; closedEyes.push(closed);
    ball(head, '#deaaa3', side * .254, -.084, .251, .052, .023, .015);
  }
  const mouth = new T.Object3D(); mouth.name = 'feeding-target';
  mouth.position.set(0, bird ? -.11 : -.148, bird ? .41 : ['frog', 'whale', 'turtle'].includes(shape) ? .355 : .37); head.add(mouth);
  if (bird) {
    ball(head, accent, 0, -.104, .344, design.bill ? .11 : .072, .041, design.bill ? .10 : .065);
    curve(head, shade, [[-.04, -.12, .40], [0, -.124, .414], [.04, -.12, .40]], .004);
  } else if (shape === 'pig') {
    ball(head, '#d999a5', 0, -.10, .348, .106, .069, .055);
    for (const side of [-1, 1]) ball(head, '#9d6379', side * .036, -.094, .399, .013, .020, .006);
    curve(head, '#a66f77', [[-.04, -.175, .327], [0, -.19, .338], [.04, -.175, .327]], .006);
  } else if (['frog', 'whale', 'turtle'].includes(shape)) {
    curve(head, '#577264', [[-.083, -.115, shape === 'whale' ? .334 : .309], [0, -.148, shape === 'whale' ? .357 : .332], [.083, -.115, shape === 'whale' ? .334 : .309]], .008);
  } else {
    ball(head, design.bigNose ? '#53616c' : ['dog', 'seal', 'lion'].includes(shape) ? '#554545' : '#b98586', 0, -.088, .368, design.bigNose ? .069 : .034, design.bigNose ? .083 : .024, .022, true);
    for (const side of [-1, 1]) curve(head, '#98756b', [[0, -.11, .369], [side * .018, -.149, .369], [side * .054, -.143, .352]], .006);
    if (['cat', 'seal'].includes(shape)) for (const side of [-1, 1]) for (let i = 0; i < 2; i++) curve(head, '#a48d7e', [[side * .20, -.12 - i * .04, .284], [side * .28, -.12 - i * .04, .26], [side * .35, -.10 - i * .06, .22]], .003);
  }

  const tail = new T.Group(); tail.position.set(0, .28, -.23); root.add(tail);
  if (shape === 'rabbit') ball(tail, cream, 0, .04, -.18, .15);
  else if (design.fluffyTail) {
    petFeature('fluffy-tail');
    const puff = ball(tail, shade, .32, .23, -.13, .22, .40, .20); puff.rotation.z = -.55;
    ball(tail, cream, .49, .46, -.12, .14, .18, .145);
  } else if (shape === 'whale' || shape === 'seal') {
    petFeature('flippers');
    if (shape === 'whale') {
      curve(tail, coat, [[.20, -.05, -.08], [.48, -.02, -.15], [.57, .13, -.20]], .09);
      for (const side of [-1, 1]) { const fin = ball(tail, shade, .57 + side * .12, .16, -.20, .18, .07, .12); fin.rotation.z = side * .35; }
    } else for (const side of [-1, 1]) { const fin = ball(tail, shade, side * .14, -.18, -.23, .20, .065, .11); fin.rotation.y = side * .4; }
  } else if (shape === 'pig') curve(tail, shade, [[0, 0, 0], [.1, .04, -.12], [.15, .13, -.17], [.06, .17, -.16], [.03, .10, -.16]], .027);
  else if (design.lionTail || (!bird && shape !== 'frog' && shape !== 'turtle')) {
    curve(tail, shade, [[0, 0, 0], [.20, .04, -.16], [.38, .15, -.18], [.42, .32, -.12]], .055);
    if (design.lionTail) ball(tail, accent, .42, .32, -.12, .09);
  }
  if (design.flameTail) for (let i = -1; i <= 1; i++) { const feather = ball(tail, i ? shade : accent, i * .18, .20, -.19, .10, .34, .07); feather.rotation.z = -i * .45; }
  if (design.shell) {
    petFeature('shell'); ball(root, cream, 0, .46, -.16, .38, .37, .19);
    ball(root, shade, 0, .48, -.21, .36, .35, .24);
    for (const side of [-1, 1]) ball(root, coat, side * .16, .53, -.412, .12, .14, .034);
    curve(root, accent, [[0, .23, .253], [0, .43, .278], [0, .62, .259]], .006);
    for (const y of [.34, .49]) curve(root, accent, [[-.17, y, .25], [0, y - .018, .278], [.17, y, .25]], .006);
  }
  if (design.horn) { petFeature('horn'); cone(head, accent, 0, .43, .12, .064, .28); }
  if (design.horns || design.antlers) {
    petFeature(design.antlers ? 'antlers' : 'horns');
    for (const side of [-1, 1]) {
      curve(head, accent, [[side * .22, .25, -.04], [side * .22, .43, -.02], [side * .29, .52, 0]], .026);
      if (design.antlers) curve(head, accent, [[side * .22, .38, -.02], [side * .34, .42, 0], [side * .37, .47, 0]], .018);
    }
  }
  if (design.mane && shape === 'horse') {
    petFeature('mane');
    for (let i = 0; i < 3; i++) { const curl = ball(head, i === 1 ? accent : shade, (i - 1) * .10, .27, .10, .09, .14, .12); curl.rotation.z = -.45; }
  }
  if (design.wings || bird) {
    petFeature('wings');
    for (const side of [-1, 1]) for (let i = 0; i < (design.wings ? 3 : 1); i++) {
      const wing = ball(root, i === 1 || design.wingTips ? accent : shade, side * (.32 + i * .09), design.wings ? .51 + i * .09 : .43, design.wings ? -.12 : .065, design.wings ? .10 : .12, design.wings ? .26 - i * .03 : .23, .08);
      wing.rotation.z = side * (design.wings ? -.52 : .22);
    }
  }
  if (design.spikes) { petFeature('spikes'); for (let i = 0; i < 3; i++) cone(root, accent, 0, .57 - i * .12, -.30 - i * .03, .065, .13); }
  if (design.shellToy) {
    petFeature('shell-toy');
    for (let i = -2; i <= 2; i++) { const shell = ball(root, i % 2 ? accent : cream, i * .045, .38, .29, .035, .09, .027); shell.rotation.z = -i * .21; }
  }
  if (design.star || design.moon) {
    petFeature('celestial-mark');
    if (design.moon) {
      ball(head, accent, 0, .19, .266, .052, .06, .010);
      ball(head, coat, .024, .206, .278, .047, .052, .010);
    } else starBadge(head, accent, 0, .19, .266);
  }
  if (stage === 'adult' || stage === 'evolved') {
    petFeature('bandana');
    const scarf = new T.Group(); scarf.name = 'growth-bandana'; root.add(scarf);
    const y = shape === 'whale' ? .20 : aquatic ? .43 : .69, z = aquatic ? .32 : .28;
    const cloth = stage === 'evolved' ? '#d0a758' : accent;
    const collar = mesh(scarf, own(new T.TorusGeometry(aquatic ? .27 : .22, .033, 10, 48)), cloth, [0, y, .035], [1, 1, 1]);
    collar.rotation.x = Math.PI / 2;
    const outline = new T.Shape(); outline.moveTo(-.16, .02); outline.quadraticCurveTo(0, -.025, .16, .02); outline.lineTo(.03, -.16); outline.quadraticCurveTo(0, -.19, -.03, -.16); outline.closePath();
    mesh(scarf, own(new T.ExtrudeGeometry(outline, { depth: .014, bevelEnabled: true, bevelSize: .01, bevelThickness: .008, bevelSegments: 3, steps: 1 })), cloth, [0, y, z], [1, 1, 1]);
    if (stage === 'evolved') {
      petFeature('star-badge');
      starBadge(scarf, '#fff1c2', 0, y - .065, z + .032, .043).name = 'growth-star';
    }
  }
  root.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(root);
  return {
    root, head, eyes, ears, tail, mouth, bounds, design,
    setExpression({ blink = 1, happy = false, sleeping = false } = {}) {
      eyes.forEach(eye => { eye.visible = !happy && !sleeping; eye.scale.y = Math.max(.08, Math.min(1, blink)); });
      closedEyes.forEach(eye => { eye.visible = happy || sleeping; eye.scale.y = sleeping ? -.35 : 1; });
    },
    dispose() { geometries.forEach(geometry => geometry.dispose()); materials.forEach(value => value.dispose()); },
  };
}

/** Fit the actual silhouette on both short landscape and narrow portrait screens. */
export function fitCompanionCamera(bounds, aspect, fov = 31) {
  const size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
  const halfFov = T.MathUtils.degToRad(fov / 2);
  // Include the turning radius so tails and wings stay in frame during rotation.
  const turningWidth = 2 * Math.hypot(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)));
  const distance = Math.max(size.y / (2 * Math.tan(halfFov)), turningWidth / (2 * Math.tan(halfFov) * Math.max(.1, aspect))) * 1.18 + turningWidth * .5;
  return { target: center, distance };
}
