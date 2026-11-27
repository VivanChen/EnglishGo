// Canvas renderer for the arena: a sheet of notebook paper on a desk, with
// sticker sprites, hand-drawn effects and floating numbers. It reads the world
// and keeps no game state of its own.
import { ENEMIES } from '../data/enemies.js';
import { HEROES } from '../data/heroes.js';
import { ARENA } from '../engine/sim.js';
import { enemyArt, heroArt, itemArt, loadSprite, pickupArt, weaponArt, whiteSprite } from '../art.js';

const TAU = Math.PI * 2;
const INK = '#2b2d42';
const LINE_GAP = 46;
const MARGIN_X = 74;
const CRAYON = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419'];
const FONT = "800 {size}px 'Arial Rounded MT Bold', 'Nunito', 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif";

// How many screen pixels one arena unit takes. Phones held upright zoom in a
// little so the doodles stay readable; wide screens show more of the page.
export function viewScale(width, height) {
  const scale = height > width ? width / 490 : height / 560;
  return Math.max(0.5, Math.min(1.25, scale));
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Faint pencil doodles in the margins of the page, different every wave.
function makeDoodles(wave) {
  const random = mulberry(wave * 977 + 13);
  return Array.from({ length: 16 }, () => ({
    kind: ['spiral', 'star', 'heart', 'cloud', 'zigzag', 'sun'][Math.floor(random() * 6)],
    x: 60 + random() * (ARENA.w - 120), y: 60 + random() * (ARENA.h - 120),
    size: 18 + random() * 26, rot: random() * TAU, color: ['#9aa5b8', '#a0b4d6', '#d8a7b1', '#a3c4a8'][Math.floor(random() * 4)],
  }));
}

function drawDoodle(ctx, d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.rot);
  ctx.strokeStyle = d.color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const s = d.size;
  if (d.kind === 'spiral') { for (let a = 0; a < TAU * 2.5; a += 0.2) { const r = (a / (TAU * 2.5)) * s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } }
  else if (d.kind === 'star') { for (let i = 0; i <= 10; i++) { const r = i % 2 ? s * 0.42 : s; const a = (i / 10) * TAU - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } }
  else if (d.kind === 'heart') { ctx.moveTo(0, s * 0.35); ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.4, -s, 0, -s * 0.35); ctx.bezierCurveTo(s * 0.4, -s, s, -s * 0.3, 0, s * 0.35); }
  else if (d.kind === 'cloud') { ctx.arc(-s * 0.4, 0, s * 0.35, Math.PI * 0.6, Math.PI * 1.8); ctx.arc(0, -s * 0.2, s * 0.42, Math.PI, TAU); ctx.arc(s * 0.45, 0, s * 0.32, Math.PI * 1.3, Math.PI * 0.4); ctx.closePath(); }
  else if (d.kind === 'zigzag') { for (let i = 0; i <= 6; i++) ctx.lineTo(-s + (i / 6) * s * 2, i % 2 ? -s * 0.25 : s * 0.25); }
  else { ctx.arc(0, 0, s * 0.35, 0, TAU); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.moveTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5); ctx.lineTo(Math.cos(a) * s * 0.8, Math.sin(a) * s * 0.8); } }
  ctx.stroke();
  ctx.restore();
}

function blob(ctx, x, y, r, seed, lobes = 7) {
  const random = mulberry(seed);
  ctx.beginPath();
  for (let i = 0; i <= lobes * 2; i++) {
    const a = (i / (lobes * 2)) * TAU;
    const rr = r * (i % 2 ? 0.7 + random() * 0.15 : 0.95 + random() * 0.3);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.quadraticCurveTo(x + Math.cos(a - 0.2) * rr * 1.05, y + Math.sin(a - 0.2) * rr * 1.05, px, py);
  }
  ctx.closePath();
}

function star(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.46 : r;
    const a = rot + (i / 10) * TAU - Math.PI / 2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function shadow(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(43, 45, 66, .14)';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.34, 0, 0, TAU);
  ctx.fill();
}

// Draws a sprite centred at (x, y) with a given size; falls back to a circle.
function sprite(ctx, src, x, y, size, { rot = 0, flipX = false, flipY = false, squash = 1, flash = 0, alpha = 1, fallback = '#888' } = {}) {
  const entry = loadSprite(src);
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(flipX ? -1 : 1, flipY ? -squash : squash);
  ctx.globalAlpha = alpha;
  if (entry) {
    ctx.drawImage(entry.img, -size / 2, -size / 2, size, size);
    if (flash > 0) {
      const white = whiteSprite(entry);
      if (white) { ctx.globalAlpha = alpha * Math.min(1, flash * 10); ctx.drawImage(white, -size / 2, -size / 2, size, size); }
    }
  } else {
    ctx.fillStyle = flash > 0 ? '#ffffff' : fallback;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.36, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function createRenderer() {
  let doodles = null, doodleWave = 0;
  return function draw(ctx, world, view) {
    const { width, height, dpr, time } = view;
    const scale = viewScale(width, height);
    const p = world.player;
    const halfW = width / scale / 2, halfH = height / scale / 2;
    const camX = halfW * 2 >= ARENA.w + 80 ? ARENA.w / 2 : Math.max(halfW - 40, Math.min(ARENA.w - halfW + 40, p.x));
    const camY = halfH * 2 >= ARENA.h + 80 ? ARENA.h / 2 : Math.max(halfH - 40, Math.min(ARENA.h - halfH + 40, p.y));
    const shake = world.shake > 0 ? world.shake : 0;
    const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    if (doodleWave !== world.wave || !doodles) { doodles = makeDoodles(world.wave); doodleWave = world.wave; }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Desk
    ctx.fillStyle = '#e9dcc3';
    ctx.fillRect(0, 0, width, height);
    ctx.translate(width / 2 + sx, height / 2 + sy);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);
    const left = camX - halfW - 10, right = camX + halfW + 10, top = camY - halfH - 10, bottom = camY + halfH + 10;

    // Paper sheet
    ctx.fillStyle = 'rgba(80, 60, 30, .18)';
    ctx.fillRect(8, 12, ARENA.w, ARENA.h);
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, ARENA.w, ARENA.h);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#cfe0f5';
    ctx.beginPath();
    for (let y = LINE_GAP * 2; y < ARENA.h; y += LINE_GAP) {
      if (y < top || y > bottom) continue;
      ctx.moveTo(Math.max(0, left), y); ctx.lineTo(Math.min(ARENA.w, right), y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#f4a6a6';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(MARGIN_X, 0); ctx.lineTo(MARGIN_X, ARENA.h); ctx.stroke();
    ctx.fillStyle = '#e9dcc3';
    for (let y = 160; y < ARENA.h; y += 340) { ctx.beginPath(); ctx.arc(30, y, 11, 0, TAU); ctx.fill(); }
    for (const d of doodles) if (d.x > left - 60 && d.x < right + 60 && d.y > top - 60 && d.y < bottom + 60) drawDoodle(ctx, d);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(0, 0, ARENA.w, ARENA.h);
    ctx.globalAlpha = 1;

    // Ink splats left by defeated monsters
    for (const s of world.fx.splats) {
      if (s.x < left - 80 || s.x > right + 80 || s.y < top - 80 || s.y > bottom + 80) continue;
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.16;
      blob(ctx, s.x, s.y, s.r, s.seed);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Glue puddles
    for (const pd of world.puddles) {
      const fade = Math.min(1, pd.life / 0.5);
      ctx.globalAlpha = 0.45 * fade;
      ctx.fillStyle = '#9be36b';
      blob(ctx, pd.x, pd.y, pd.r, Math.floor(pd.x + pd.y), 6);
      ctx.fill();
      ctx.globalAlpha = 0.7 * fade;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(pd.x - pd.r * 0.3, pd.y - pd.r * 0.3, pd.r * 0.18, pd.r * 0.1, -0.5, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Spawn warnings: red pen crosses
    for (const mark of world.telegraphs) {
      const k = mark.t / mark.dur;
      const big = ENEMIES[mark.type].boss || ENEMIES[mark.type].elite;
      const r = (big ? 40 : 13) * (0.6 + 0.4 * Math.min(1, k * 2));
      ctx.strokeStyle = '#ef4444';
      ctx.globalAlpha = 0.45 + 0.45 * Math.abs(Math.sin(time * 10));
      ctx.lineWidth = big ? 6 : 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(mark.x - r, mark.y - r); ctx.lineTo(mark.x + r, mark.y + r);
      ctx.moveTo(mark.x + r, mark.y - r); ctx.lineTo(mark.x - r, mark.y + r);
      ctx.stroke();
      if (big) { ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(mark.x, mark.y, r * 1.8, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    }
    ctx.globalAlpha = 1;

    // Pickups
    for (const pk of world.pickups) {
      const bob = Math.sin(pk.t * 5) * 3;
      if (pk.kind === 'star') {
        const r = pk.value > 1 ? 10 : 8;
        shadow(ctx, pk.x, pk.y + 9, r * 0.8);
        star(ctx, pk.x, pk.y + bob, r, Math.sin(pk.t * 3) * 0.3);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#c47f00';
        ctx.stroke();
      } else {
        const size = pk.kind === 'crate' ? 44 : 30;
        shadow(ctx, pk.x, pk.y + size * 0.42, size * 0.4);
        if (pk.kind === 'crate') {
          ctx.globalAlpha = 0.35 + 0.25 * Math.sin(pk.t * 6);
          ctx.fillStyle = '#ffe066';
          ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, size * 0.7, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
        }
        sprite(ctx, pickupArt(pk.kind), pk.x, pk.y + bob, size, { fallback: pk.kind === 'crate' ? '#c8873a' : '#d9a066' });
      }
    }

    // Turrets
    for (const t of world.turrets) {
      shadow(ctx, t.x, t.y + 18, 16);
      sprite(ctx, itemArt('robot'), t.x - Math.cos(t.angle) * t.recoil * 30, t.y - Math.sin(t.angle) * t.recoil * 30, 44, { flipX: Math.cos(t.angle) < 0, fallback: '#b0b7c3' });
    }

    // Monsters and the hero, back to front
    const actors = world.enemies.filter(e => e.x > left - 120 && e.x < right + 120 && e.y > top - 120 && e.y < bottom + 120);
    actors.push(p);
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) {
      if (a === p) { drawHero(ctx, world, time); continue; }
      const def = ENEMIES[a.type];
      const grow = Math.min(1, a.born / 0.3);
      const size = def.size * grow;
      const winding = a.state === 'windup';
      const jx = winding ? (Math.random() - 0.5) * 4 : 0;
      shadow(ctx, a.x, a.y + def.r * 0.85, def.r * 0.9);
      if (winding && (def.ai === 'charge' || def.ai === 'chain' || a.next === 'charge')) {
        ctx.strokeStyle = '#ef4444';
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = def.r * 0.9;
        ctx.setLineDash([14, 12]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + a.dirX * 240, a.y + a.dirY * 240); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if (a.slowT > 0) { ctx.fillStyle = 'rgba(155, 227, 107, .45)'; ctx.beginPath(); ctx.ellipse(a.x, a.y + def.r * 0.8, def.r * 1.1, def.r * 0.4, 0, 0, TAU); ctx.fill(); }
      const squash = 1 + Math.sin(a.t * 9 + a.wob) * 0.05 + (winding ? 0.08 : 0);
      sprite(ctx, enemyArt(def.sprite || a.type), a.x + jx, a.y - def.size * 0.12, size, { rot: Math.sin(a.t * 5 + a.wob) * 0.06, flipX: a.face > 0 && !def.boss, squash, flash: a.flash, fallback: def.ink });
      if (winding) {
        ctx.font = FONT.replace('{size}', '26');
        ctx.textAlign = 'center';
        ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ef4444';
        ctx.strokeText('!', a.x, a.y - def.size * 0.62); ctx.fillText('!', a.x, a.y - def.size * 0.62);
      }
      if (def.elite) {
        const w = def.size * 0.8;
        ctx.fillStyle = 'rgba(43,45,66,.55)';
        ctx.fillRect(a.x - w / 2, a.y - def.size * 0.7, w, 7);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(a.x - w / 2, a.y - def.size * 0.7, w * Math.max(0, a.hp / a.maxHp), 7);
      }
    }

    // Kites
    for (const kite of world.kites) {
      sprite(ctx, itemArt('kite'), kite.x, kite.y, 50, { rot: kite.angle + Math.PI / 2, fallback: '#ef4444' });
    }

    // Projectiles
    for (const s of world.shots) {
      const angle = Math.atan2(s.vy, s.vx);
      if (s.weapon === 'pencil' || s.weapon === 'turret') sprite(ctx, weaponArt('pencil'), s.x, s.y, s.weapon === 'turret' ? 22 : 28, { rot: angle });
      else if (s.weapon === 'plane') sprite(ctx, weaponArt('plane'), s.x, s.y, 34, { rot: angle });
      else if (s.weapon === 'stapler') {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(angle);
        ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, -5); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.stroke();
        ctx.restore();
      } else if (s.weapon === 'crayon') {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(angle);
        ctx.fillStyle = CRAYON[s.hue || 0]; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-7, -4, 14, 8, 3) : ctx.rect(-7, -4, 14, 8); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else if (s.weapon === 'glue') {
        ctx.fillStyle = '#9be36b'; ctx.strokeStyle = '#3c8a2e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, TAU); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = '#9ca3af'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    for (const s of world.foeShots) {
      ctx.fillStyle = '#5b3fa8'; ctx.strokeStyle = '#2b1b5c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.arc(s.x - s.r * 0.35, s.y - s.r * 0.35, s.r * 0.28, 0, TAU); ctx.fill();
    }

    // Attack strokes
    for (const st of world.fx.strokes) {
      const k = st.life / st.max;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      if (st.kind === 'beam') {
        ctx.strokeStyle = '#fff35c'; ctx.lineCap = 'square'; ctx.lineWidth = st.width * 1.7;
        ctx.globalAlpha = 0.7 * k;
        ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.lineTo(st.x2, st.y2); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = st.width * 0.4;
        ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.lineTo(st.x2, st.y2); ctx.stroke();
      } else if (st.kind === 'thrust') {
        ctx.strokeStyle = '#8fd3ff'; ctx.lineCap = 'round'; ctx.lineWidth = st.width;
        ctx.globalAlpha = 0.5 * k;
        ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.lineTo(st.x2, st.y2); ctx.stroke();
      } else if (st.kind === 'snip') {
        ctx.strokeStyle = '#b197fc'; ctx.lineWidth = 7 * k + 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, st.angle - st.arc / 2, st.angle + st.arc / 2); ctx.stroke();
      } else if (st.kind === 'smash') {
        ctx.strokeStyle = '#ff8fab'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r * (1.2 - k * 0.4), 0, TAU); ctx.stroke();
      } else if (st.kind === 'boom') {
        ctx.fillStyle = '#ffa94d';
        ctx.globalAlpha = 0.5 * k;
        star(ctx, st.x, st.y, st.r * (1.3 - k * 0.5), k);
        ctx.fill();
      }
      ctx.restore();
    }

    // Particles
    for (const pt of world.fx.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Floating numbers
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const t of world.fx.texts) {
      const k = t.life / t.max;
      const size = (t.big ? 24 : 16) / scale * Math.min(1.25, Math.max(0.85, scale));
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = FONT.replace('{size}', size.toFixed(1));
      ctx.lineWidth = size * 0.26;
      ctx.strokeStyle = INK;
      ctx.strokeText(t.value, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.value, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // Screen space: pointers to big monsters off screen, low-health glow.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const e of world.enemies) {
      const def = ENEMIES[e.type];
      if (!def.elite && !def.boss) continue;
      const ex = (e.x - camX) * scale + width / 2, ey = (e.y - camY) * scale + height / 2;
      if (ex > 0 && ex < width && ey > 0 && ey < height) continue;
      const angle = Math.atan2(ey - height / 2, ex - width / 2);
      const px = Math.max(26, Math.min(width - 26, ex)), py = Math.max(80, Math.min(height - 26, ey));
      ctx.save();
      ctx.translate(px, py); ctx.rotate(angle);
      ctx.fillStyle = '#ef4444'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
    }
    const low = p.hp / p.maxHp;
    if (world.phase === 'fight' && low < 0.35) {
      const pulse = 0.25 + 0.15 * Math.sin(time * 6);
      const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.7);
      g.addColorStop(0, 'rgba(239,68,68,0)');
      g.addColorStop(1, `rgba(239,68,68,${pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    if (p.inv > 0.3 && world.phase === 'fight') {
      ctx.fillStyle = `rgba(239, 68, 68, ${(p.inv - 0.3) * 0.5})`;
      ctx.fillRect(0, 0, width, height);
    }
  };

  function drawHero(ctx, world, time) {
    const p = world.player;
    const hero = HEROES[world.heroId] || HEROES.sketch;
    const bob = p.moving ? Math.abs(Math.sin(p.walk)) * 5 : Math.sin(time * 2.4) * 1.5;
    const blink = p.inv > 0 && Math.floor(time * 14) % 2 === 0;
    shadow(ctx, p.x, p.y + 20, 20);
    // Weapons behind the hero when aiming up
    const weapons = world.weapons.map(w => ({ w, behind: Math.sin(w.angle) < -0.3 && w.y < p.y }));
    weapons.filter(item => item.behind).forEach(item => drawWeapon(ctx, item.w));
    sprite(ctx, heroArt(world.heroId || 'sketch'), p.x, p.y - 8 - bob, 62, {
      flipX: p.face < 0, squash: p.moving ? 1 - Math.abs(Math.sin(p.walk)) * 0.05 : 1, alpha: blink ? 0.45 : 1, fallback: hero.color,
    });
    weapons.filter(item => !item.behind).forEach(item => drawWeapon(ctx, item.w));
  }

  function drawWeapon(ctx, w) {
    const left = Math.cos(w.angle) < 0;
    let x = w.x, y = w.y;
    if (w.lunge > 0) {
      const k = Math.sin((1 - w.lunge / 0.16) * Math.PI);
      x += Math.cos(w.angle) * w.reach * k;
      y += Math.sin(w.angle) * w.reach * k;
    }
    sprite(ctx, weaponArt(w.id), x, y, 34 + w.tier * 3, { rot: w.angle, flipY: left, fallback: '#ffd23f' });
  }
}
