import * as T from 'three';

// Original, reproducible model sources. The body and limbs use continuous lofted
// surfaces; articulation is baked into the exported GLB node hierarchy.
export const TOWN_SPECIES = ['harbor-cat', 'sunny-dog', 'garden-rabbit'];
export const TOWN_ANIMATIONS = ['idle', 'walk', 'run', 'happy', 'curious', 'pet', 'eat', 'wash', 'play', 'sleep', 'wake', 'sniff', 'scrub', 'rinse', 'dry', 'shake', 'pounce', 'settle', 'stretch', 'greet', 'groom', 'hop', 'listen', 'yawn'];
export const MODEL_REVISION = 3;

const palettes = {
  'harbor-cat': { fur: '#e9b57f', cream: '#fff1db', dark: '#c78b5a', pink: '#d3a1a0', ribbon: '#789e9b' },
  'sunny-dog': { fur: '#cfa076', cream: '#fff0d7', dark: '#92664d', pink: '#d49c93', ribbon: '#ba7765' },
  'garden-rabbit': { fur: '#eeeae1', cream: '#fff7eb', dark: '#a8b6b7', pink: '#d9b8b2', ribbon: '#a7b17d' },
};
const quaternion = (x = 0, y = 0, z = 0) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z)).toArray();

/** Smooth elliptical loft with bespoke cross sections, aligned vertically. */
export function loftGeometry(sections, segments = 32) {
  const vertices = [], indices = [], uv = [];
  // Interpolate the profile with Catmull-Rom to avoid hard rings at joints.
  const profile = new T.CatmullRomCurve3(sections.map(([y, rx, rz]) => new T.Vector3(rx, y, rz)));
  const rings = Math.max(24, sections.length * 5);
  for (let r = 0; r <= rings; r++) {
    const p = profile.getPoint(r / rings);
    for (let s = 0; s <= segments; s++) {
      const a = s / segments * Math.PI * 2;
      vertices.push(Math.cos(a) * Math.max(.001, p.x), p.y, Math.sin(a) * Math.max(.001, p.z));
      uv.push(s / segments, r / rings);
      if (r < rings && s < segments) {
        const i = r * (segments + 1) + s;
        indices.push(i, i + segments + 1, i + 1, i + 1, i + segments + 1, i + segments + 2);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}

function headGeometry(kind) {
  const g = new T.SphereGeometry(1, 48, 32), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cheek = 1 + .1 * Math.exp(-((y + .3) ** 2) / .13);
    const jaw = y < -.35 ? 1 - (-y - .35) * .22 : 1;
    p.setXYZ(i, x * (kind === 'rabbit' ? .30 : .34) * cheek * jaw,
      y * (kind === 'dog' ? .30 : .315), z * (kind === 'dog' ? .30 : .28) + Math.max(0, z) * Math.max(0, -.1 - y) * .07);
  }
  g.computeVertexNormals(); return g;
}

function leafGeometry(width, height, depth, bent = 0) {
  const sections = [[0, width * .3, depth * .4], [height * .15, width * .8, depth], [height * .45, width, depth], [height * .8, width * .65, depth * .6], [height, .002, .002]];
  const geometry = loftGeometry(sections, 24);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + bent * (p.getY(i) / height) ** 2);
  geometry.computeVertexNormals(); return geometry;
}

export function createTownCompanion(speciesId) {
  if (!TOWN_SPECIES.includes(speciesId)) throw new Error(`Unknown town species: ${speciesId}`);
  const kind = speciesId === 'harbor-cat' ? 'cat' : speciesId === 'sunny-dog' ? 'dog' : 'rabbit';
  const p = palettes[speciesId];
  const materials = Object.fromEntries(Object.entries(p).map(([key, color]) => [key, new T.MeshStandardMaterial({ name: key, color, roughness: .83, metalness: 0 })]));
  materials.eye = new T.MeshStandardMaterial({ name: 'deep chestnut eyes', color: '#2e3030', roughness: .23 });
  materials.sparkle = new T.MeshBasicMaterial({ name: 'eye light', color: '#fffdf4' });
  materials.nose = new T.MeshStandardMaterial({ name: 'velvet nose', color: kind === 'dog' ? '#4e3b35' : p.pink, roughness: .5 });
  const root = new T.Group(); root.name = speciesId;
  const body = new T.Group(); body.name = 'Body'; root.add(body);
  const add = (parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], name) => {
    const mesh = new T.Mesh(geometry, materials[material] || material);
    mesh.position.set(...position); mesh.scale.set(...scale); mesh.name = name || material;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const ellipsoid = (parent, material, position, scale, name) => add(parent, new T.SphereGeometry(1, 32, 24), material, position, scale, name);
  const joint = (parent, name, position) => { const b = new T.Bone(); b.name = name; b.position.set(...position); parent.add(b); return b; };
  const chest = kind === 'rabbit' ? .39 : kind === 'dog' ? .35 : .29;
  const torso = add(body, loftGeometry([[.24, .05, .07], [.31, chest * .65, .32], [.48, chest, .47], [.65, chest * .98, .43], [.80, chest * .77, .33], [.92, chest * .45, .20], [.96, .01, .01]], 40), 'fur', [0, 0, -.13], [1, kind === 'cat' ? 1.04 : 1, 1], 'Torso');
  // Cream chest follows the continuous body silhouette as a slightly inset oval.
  ellipsoid(body, 'cream', [0, .66, .205], [chest * .67, .26, .095], 'Chest');
  const neck = joint(body, 'Neck', [0, .91, .30]);
  const head = joint(neck, 'Head', [0, .13, .06]);
  add(head, headGeometry(kind), 'fur', [0, 0, 0], [1, 1, 1], 'Face');
  const muzzleZ = kind === 'dog' ? .26 : .245;
  if (kind === 'dog') {
    ellipsoid(head, 'cream', [0, -.105, muzzleZ], [.205, .135, .15], 'Muzzle');
    ellipsoid(head, 'cream', [0, .085, .267], [.063, .18, .035], 'Forehead blaze');
  } else {
    for (const side of [-1, 1]) ellipsoid(head, 'cream', [side * .082, -.11, muzzleZ], [kind === 'rabbit' ? .102 : .105, .075, .05], `Muzzle_${side}`);
  }
  const eyeX = kind === 'rabbit' ? .155 : .15, eyeY = .035, eyeZ = .25;
  for (const side of [-1, 1]) {
    const eye = joint(head, side < 0 ? 'EyeL' : 'EyeR', [side * eyeX, eyeY, eyeZ]);
    ellipsoid(eye, 'eye', [0, 0, 0], [.043, .055, .026], 'Eye');
    ellipsoid(eye, 'sparkle', [-.011, .017, .021], [.012, .014, .006], 'Catchlight');
    ellipsoid(head, 'pink', [side * .218, -.075, .221], [.048, .021, .008], 'Cheek blush');
    if (kind === 'cat') {
      for (let row = 0; row < 3; row++) {
        const line = new T.CatmullRomCurve3([new T.Vector3(side * .15, -.11 - row * .018, .275), new T.Vector3(side * .26, -.10 - row * .026, .29), new T.Vector3(side * .37, -.085 - row * .035, .27)]);
        add(head, new T.TubeGeometry(line, 12, .003, 5, false), 'dark', [0, 0, 0], [1, 1, 1], 'Whisker');
      }
    }
  }
  ellipsoid(head, 'nose', [0, -.085, muzzleZ + (kind === 'dog' ? .15 : .052)], [kind === 'dog' ? .072 : .036, kind === 'dog' ? .046 : .026, .025], 'Nose');
  const mouth = new T.CatmullRomCurve3([new T.Vector3(-.055, -.162, muzzleZ + .035), new T.Vector3(0, -.18, muzzleZ + .045), new T.Vector3(.055, -.162, muzzleZ + .035)]);
  add(head, new T.TubeGeometry(mouth, 16, .005, 6, false), 'dark', [0, 0, 0], [1, 1, 1], 'Smile');
  for (const side of [-1, 1]) {
    const ear = joint(head, side < 0 ? 'EarL' : 'EarR', [side * (kind === 'dog' ? .27 : .16), kind === 'dog' ? .17 : .22, -.02]);
    if (kind === 'rabbit') {
      add(ear, leafGeometry(.095, .55, .055, -.06), 'dark', [0, 0, 0]);
      add(ear, leafGeometry(.055, .43, .009, -.05), 'pink', [0, .05, .052]);
      ear.rotation.z = side * -.12;
    } else if (kind === 'dog') {
      add(ear, leafGeometry(.135, .44, .065, .04), 'dark', [0, 0, 0]);
      ear.rotation.z = side * .23; ear.rotation.x = Math.PI;
    } else {
      add(ear, leafGeometry(.125, .27, .065, -.04), 'fur');
      add(ear, leafGeometry(.07, .18, .012, -.02), 'pink', [0, .035, .056]);
      ear.rotation.z = side * -.18;
    }
  }
  if (kind === 'cat') {
    // Forehead and tail bands distinguish the harbor cat from a recoloured dog.
    for (const side of [-1, 0, 1]) ellipsoid(head, 'dark', [side * .105, .22, .175], [.028, .073, .018], 'Forehead marking');
  }
  const legs = [];
  for (const side of [-1, 1]) for (const front of [true, false]) {
    const name = `${front ? 'Front' : 'Back'}${side < 0 ? 'L' : 'R'}`;
    const rabbitBack = kind === 'rabbit' && !front;
    const leg = joint(body, name, [side * (front ? .21 : .255), rabbitBack ? .40 : .46, front ? .18 : -.40]);
    const length = rabbitBack ? .30 : .37;
    add(leg, loftGeometry([[-length, .055, .065], [-length * .82, .075, .08], [-length * .35, rabbitBack ? .15 : .085, rabbitBack ? .17 : .10], [0, rabbitBack ? .16 : .10, rabbitBack ? .15 : .11], [.035, .005, .005]], 24), 'fur', [0, 0, 0], [1, 1, 1], `${name} limb`);
    ellipsoid(leg, 'cream', [0, -length + .015, rabbitBack ? .08 : .035], [rabbitBack ? .105 : .088, .066, rabbitBack ? .22 : .13], `${name} paw`);
    legs.push(leg);
  }
  const tail = joint(body, 'Tail', [0, .56, -.54]);
  if (kind === 'rabbit') ellipsoid(tail, 'cream', [0, 0, -.055], [.145, .14, .14], 'Cotton tail');
  else {
    const curve = new T.CatmullRomCurve3(kind === 'cat'
      ? [[0, 0, 0], [.09, .11, -.24], [.17, .35, -.40], [.13, .66, -.43], [.04, .74, -.36]].map(v => new T.Vector3(...v))
      : [[0, 0, 0], [.04, .15, -.16], [.08, .28, -.26], [.13, .34, -.30]].map(v => new T.Vector3(...v)));
    add(tail, new T.TubeGeometry(curve, 36, kind === 'cat' ? .057 : .076, 12, false), 'fur', [0, 0, 0], [1, 1, 1], 'Tail curve');
    const end = curve.getPoint(1); ellipsoid(tail, 'cream', end.toArray(), [.06, .06, .06], 'Tail tip');
  }
  const ribbon = add(body, new T.TorusGeometry(.205, .025, 8, 40), 'ribbon', [0, .87, .265], [1, .82, 1], 'Collar'); ribbon.rotation.x = Math.PI / 2;
  const scarf = new T.Shape(); scarf.moveTo(-.13, 0); scarf.lineTo(.13, 0); scarf.lineTo(.025, -.22); scarf.closePath();
  const scarfMesh = add(body, new T.ExtrudeGeometry(scarf, { depth: .018, bevelEnabled: true, bevelSize: .01, bevelThickness: .008, bevelSegments: 2, steps: 1 }), 'ribbon', [0, .83, .43], [1, 1, 1], 'Scarf');
  ellipsoid(scarfMesh, new T.MeshStandardMaterial({ color: '#e9d19b', roughness: .4, metalness: .25 }), [0, -.045, .03], [.025, .025, .012], 'Name tag');
  root.userData = { speciesId, revision: MODEL_REVISION, source: 'EnglishGo original continuous loft sculpture', baseHeight: kind === 'rabbit' ? 1.85 : 1.6 };
  const neutral = {};
  root.traverse(n => { if (n.isBone) neutral[n.name] = n.quaternion.toArray(); });
  const animations = buildAnimations(kind, neutral);
  root.animations = animations;
  return { root, animations, kind, body, head, legs, torso };
}

function buildAnimations(kind, neutral) {
  const clips = [];
  const qTrack = (name, times, values) => new T.QuaternionKeyframeTrack(`${name}.quaternion`, times, values.flatMap(v => {
    const base = new T.Quaternion().fromArray(neutral[name] || [0, 0, 0, 1]);
    return base.multiply(new T.Quaternion().fromArray(quaternion(...v))).toArray();
  }));
  const pTrack = (name, times, values) => new T.VectorKeyframeTrack(`${name}.position`, times, values.flat());
  const make = (name, duration, tracks) => clips.push(new T.AnimationClip(name, duration, tracks));
  const times = [0, 1, 2, 3, 4];
  const idleTracks = [qTrack('Head', times, [[0, 0, 0], [.015, .04, -.025], [0, 0, 0], [-.01, -.04, .015], [0, 0, 0]]), qTrack('Tail', times, [[0, -.08, 0], [0, .1, .03], [0, -.08, 0], [0, .1, -.03], [0, -.08, 0]]), pTrack('Body', times, [[0, 0, 0], [0, .008, 0], [0, 0, 0], [0, .008, 0], [0, 0, 0]])];
  for (const eye of ['EyeL', 'EyeR']) idleTracks.push(new T.VectorKeyframeTrack(`${eye}.scale`, [0, 1.8, 1.88, 2.02, 2.12, 4], [1, 1, 1, 1, 1, 1, 1, .12, 1, 1, .12, 1, 1, 1, 1, 1, 1, 1]));
  make('idle', 4, idleTracks);
  for (const [name, duration, stride] of [['walk', kind === 'rabbit' ? .72 : 1.1, .32], ['run', .58, .65]]) {
    const t = [0, duration / 4, duration / 2, duration * .75, duration];
    const tracks = [];
    for (const leg of ['FrontL', 'FrontR', 'BackL', 'BackR']) {
      const phase = kind === 'rabbit' ? (leg.startsWith('Front') ? 1 : -1) : (['FrontL', 'BackR'].includes(leg) ? 1 : -1);
      tracks.push(qTrack(leg, t, [[stride * phase, 0, 0], [0, 0, 0], [-stride * phase, 0, 0], [0, 0, 0], [stride * phase, 0, 0]]));
    }
    const lift = kind === 'rabbit' ? .13 : name === 'run' ? .055 : .018;
    tracks.push(pTrack('Body', t, [[0, 0, 0], [0, lift, 0], [0, 0, 0], [0, lift, 0], [0, 0, 0]]));
    tracks.push(qTrack('Tail', t, [[0, -.18, 0], [0, .18, 0], [0, -.18, 0], [0, .18, 0], [0, -.18, 0]]));
    make(name, duration, tracks);
  }
  make('curious', 3, [qTrack('Head', [0, .7, 1.5, 2.3, 3], [[0, 0, 0], [-.12, -.3, -.18], [-.1, .25, .16], [-.06, 0, -.1], [0, 0, 0]]), qTrack('EarL', [0, 1.5, 3], [[0, 0, 0], [.13, 0, -.12], [0, 0, 0]])]);
  make('happy', 1.6, [pTrack('Body', [0, .35, .7, 1.05, 1.6], [[0, 0, 0], [0, .14, 0], [0, 0, 0], [0, .10, 0], [0, 0, 0]]), qTrack('Head', [0, .8, 1.6], [[0, 0, 0], [-.16, 0, .08], [0, 0, 0]]), qTrack('Tail', [0, .4, .8, 1.2, 1.6], [[0, -.3, 0], [0, .3, 0], [0, -.3, 0], [0, .3, 0], [0, -.3, 0]])]);
  make('pet', 2.6, [qTrack('Head', [0, .6, 1.3, 2, 2.6], [[0, 0, 0], [-.12, 0, -.13], [-.2, .1, .14], [-.12, 0, -.1], [0, 0, 0]]), qTrack('EarL', [0, 1.3, 2.6], [[0, 0, 0], [.17, 0, -.13], [0, 0, 0]]), qTrack('EarR', [0, 1.3, 2.6], [[0, 0, 0], [.17, 0, .13], [0, 0, 0]])]);
  make('eat', 2, [qTrack('Neck', [0, .5, 1, 1.5, 2], [[.15, 0, 0], [.45, 0, 0], [.34, .04, 0], [.45, -.04, 0], [.15, 0, 0]]), qTrack('Head', [0, .5, 1, 1.5, 2], [[0, 0, 0], [.12, 0, 0], [.05, 0, 0], [.12, 0, 0], [0, 0, 0]])]);
  make('wash', 2.4, [qTrack('Head', [0, .3, .6, .9, 1.2, 1.8, 2.4], [[0, 0, 0], [0, -.22, 0], [0, .22, 0], [0, -.22, 0], [0, .22, 0], [0, 0, 0], [0, 0, 0]]), qTrack('Body', [0, .6, 1.2, 1.8, 2.4], [[0, 0, 0], [0, 0, -.04], [0, 0, .04], [0, 0, -.02], [0, 0, 0]])]);
  make('play', 2, [qTrack('Neck', [0, .5, 1, 1.5, 2], [[0, 0, 0], [.22, -.2, -.1], [-.16, .2, .1], [.22, -.15, -.1], [0, 0, 0]]), qTrack('FrontL', [0, .5, 1, 1.5, 2], [[0, 0, 0], [-.6, 0, -.12], [0, 0, 0], [-.45, 0, -.08], [0, 0, 0]]), pTrack('Body', [0, .5, 1, 1.5, 2], [[0, 0, 0], [0, .035, .04], [0, .08, -.04], [0, .035, .04], [0, 0, 0]])]);
  const sleepTracks = [pTrack('Body', [0, 1, 2, 3, 4], [[0, -.16, 0], [0, -.15, 0], [0, -.16, 0], [0, -.15, 0], [0, -.16, 0]]), qTrack('Neck', [0, 4], [[.25, -.12, 0], [.25, -.12, 0]])];
  for (const leg of ['FrontL', 'FrontR', 'BackL', 'BackR']) sleepTracks.push(qTrack(leg, [0, 4], [[-.7, 0, 0], [-.7, 0, 0]]));
  for (const eye of ['EyeL', 'EyeR']) sleepTracks.push(new T.VectorKeyframeTrack(`${eye}.scale`, [0, 4], [1, .12, 1, 1, .12, 1]));
  make('sleep', 4, sleepTracks);
  make('wake', 2.5, [qTrack('Neck', [0, .8, 1.7, 2.5], [[.2, 0, 0], [-.28, 0, 0], [-.1, -.15, 0], [0, 0, 0]]), pTrack('Body', [0, .8, 1.7, 2.5], [[0, -.12, 0], [0, .04, 0], [0, .02, 0], [0, 0, 0]])]);
  // Dedicated care beats: anticipation, relaxed scrubbing, rinsing, towel rub,
  // species-specific shake and pounce, then a gradual lie-down.
  const t = [0, .3, .6, .9, 1.2];
  const wag = kind === 'dog' ? .65 : kind === 'cat' ? .25 : .12;
  make('sniff', 1.2, [qTrack('Neck', t, [[0,0,0],[-.12,0,0],[.12,0,0],[-.08,0,0],[0,0,0]]), qTrack('Head', t, [[0,0,0],[0,.15,-.1],[0,-.15,.1],[0,.1,0],[0,0,0]]), qTrack('Tail', t, [[0,-wag,0],[0,wag,0],[0,-wag,0],[0,wag,0],[0,-wag,0]])]);
  const eyes = (duration, squint) => ['EyeL','EyeR'].map(eye => new T.VectorKeyframeTrack(`${eye}.scale`, [0,duration/2,duration], [1,.9,1,1,squint,1,1,.9,1]));
  make('scrub', 1.2, [qTrack('Body', t, [[0,0,0],[0,0,.06],[0,0,0],[0,0,-.06],[0,0,0]]), qTrack('Head', t, [[-.1,0,0],[-.15,.1,-.12],[-.1,0,0],[-.15,-.1,.12],[-.1,0,0]]), ...eyes(1.2,.2)]);
  make('rinse', 1.2, [qTrack('Neck', t, [[-.12,0,0],[-.2,0,0],[-.12,0,0],[-.2,0,0],[-.12,0,0]]), qTrack('EarL', t, [[0,0,0],[.3,0,-.2],[.1,0,0],[.3,0,-.2],[0,0,0]]), qTrack('EarR', t, [[0,0,0],[.3,0,.2],[.1,0,0],[.3,0,.2],[0,0,0]]), ...eyes(1.2,.12)]);
  make('dry', 1.2, [qTrack('Head', t, [[0,0,0],[0,0,-.2],[-.1,0,0],[0,0,.2],[0,0,0]]), qTrack('Body', t, [[0,0,0],[0,0,.04],[0,0,0],[0,0,-.04],[0,0,0]]), ...eyes(1.2,.25)]);
  const shakeT = [0,.15,.3,.45,.6,.75,.9,1.2];
  make('shake', 1.2, [qTrack('Body', shakeT, [0,1,-1,1,-1,.7,-.4,0].map(v=>[0,v*.16,v*(kind==='rabbit'?.06:.12)])), qTrack('Head', shakeT, [0,-1,1,-1,1,-.7,.4,0].map(v=>[0,v*.32,0])), qTrack('EarL', shakeT, [0,1,-1,1,-1,.7,-.4,0].map(v=>[v*.25,0,v*.3])), qTrack('EarR', shakeT, [0,-1,1,-1,1,-.7,.4,0].map(v=>[v*.25,0,v*.3]))]);
  make('pounce', 1.2, [pTrack('Body', t, [[0,0,0],[0,-.12,-.12],[0,kind==='rabbit'?.35:.22,.22],[0,.04,.12],[0,0,0]]), qTrack('FrontL',t,[[0,0,0],[.3,0,0],[-.7,0,-.1],[-.2,0,0],[0,0,0]]), qTrack('FrontR',t,[[0,0,0],[.3,0,0],[-.7,0,.1],[-.2,0,0],[0,0,0]]), qTrack('Tail',t,[[0,-wag,0],[0,wag,0],[0,-wag,0],[0,wag,0],[0,-wag,0]])]);
  make('settle', 2, [pTrack('Body',[0,1,2],[[0,0,0],[0,-.08,0],[0,-.16,0]]), qTrack('Neck',[0,1,2],[[0,0,0],[.12,0,0],[.25,-.12,0]]), ...['FrontL','FrontR','BackL','BackR'].map(leg=>qTrack(leg,[0,1,2],[[0,0,0],[-.35,0,0],[-.7,0,0]]))]);
  const beat = [0, .6, 1.2, 1.8, 2.4];
  make('stretch', 2.4, [pTrack('Body', beat, [[0,0,0],[0,-.08,.04],[0,-.12,.09],[0,-.06,.04],[0,0,0]]), qTrack('Body', beat, [[0,0,0],[.1,0,0],[.18,0,0],[.08,0,0],[0,0,0]]), ...['FrontL','FrontR'].map(leg => qTrack(leg,beat,[[0,0,0],[-.5,0,0],[-.8,0,0],[-.4,0,0],[0,0,0]])), qTrack('Neck',beat,[[0,0,0],[-.15,0,0],[-.25,0,0],[-.1,0,0],[0,0,0]])]);
  make('greet', 2.4, [qTrack('FrontL',beat,[[0,0,0],[-.9,0,-.3],[-.65,0,.1],[-.9,0,-.3],[0,0,0]]), qTrack('Head',beat,[[0,0,0],[-.1,0,-.15],[-.1,0,.1],[-.1,0,-.1],[0,0,0]]), qTrack('Tail',beat,[[0,0,0],[0,wag,0],[0,-wag,0],[0,wag,0],[0,0,0]])]);
  make('groom', 2.4, [qTrack('FrontR',beat,[[0,0,0],[-1.1,0,.2],[-.8,0,-.1],[-1.1,0,.2],[0,0,0]]), qTrack('Neck',beat,[[0,0,0],[.35,-.2,.1],[.2,-.1,0],[.35,-.2,.1],[0,0,0]]), ...eyes(2.4,.25)]);
  make('hop', 1.2, [pTrack('Body',t,[[0,0,0],[0,-.08,0],[0,kind==='rabbit'?.42:.25,0],[0,.04,0],[0,0,0]]), ...['FrontL','FrontR','BackL','BackR'].map(leg=>qTrack(leg,t,[[0,0,0],[.2,0,0],[-.45,0,0],[.1,0,0],[0,0,0]])), qTrack('EarL',t,[[0,0,0],[.12,0,0],[-.2,0,-.15],[.1,0,0],[0,0,0]])]);
  make('listen', 2.4, [qTrack('Head',beat,[[0,0,0],[-.12,-.2,-.2],[-.1,.2,.2],[-.1,0,-.1],[0,0,0]]), qTrack('EarL',beat,[[0,0,0],[-.18,0,-.15],[.1,0,0],[-.15,0,0],[0,0,0]]), qTrack('EarR',beat,[[0,0,0],[.1,0,0],[-.18,0,.15],[0,0,0],[0,0,0]])]);
  make('yawn', 2.4, [qTrack('Neck',beat,[[0,0,0],[-.15,0,0],[-.3,0,0],[-.1,0,0],[0,0,0]]), ...eyes(2.4,.08), qTrack('EarL',beat,[[0,0,0],[.1,0,0],[.25,0,-.1],[.1,0,0],[0,0,0]])]);
  return clips;
}

export function applyGrowthAppearance(root, exp = 0) {
  const stage = exp >= 300 ? 'mature' : exp >= 120 ? 'growing' : 'baby';
  const scale = stage === 'mature' ? 1.12 : stage === 'growing' ? 1 : .86;
  root.scale.setScalar(scale);
  const head = root.getObjectByName('Head'); if (head) head.scale.setScalar(stage === 'baby' ? 1.12 : stage === 'growing' ? 1.05 : 1);
  const torso = root.getObjectByName('Torso'); if (torso) torso.scale.y = stage === 'baby' ? .91 : stage === 'mature' ? 1.05 : 1;
  const scarf = root.getObjectByName('Scarf'); if (scarf) scarf.visible = stage !== 'baby';
  root.userData.growthStage = stage;
  return stage;
}
