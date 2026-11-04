// ===== character models =====
// HERO: early 20s, messy blue-black hair with fringe, dark-teal hoodie with white drawstrings.
// GIRL: shoulder-length dark-auburn hair, mustard-yellow raincoat.
const HERO = {
  hair: [14, 16, 30], hoodie: [24, 52, 62], hoodieDark: [12, 26, 34], jeans: [24, 28, 44],
  skinNight: [86, 92, 128], skinLit: [214, 226, 255], skinWarm: [236, 186, 150], string: [220, 225, 235],
};
const GIRL = { hair: [70, 30, 26], coat: [232, 176, 46], coatDark: [170, 112, 20], skinWarm: [246, 196, 160], legs: [36, 30, 40] };

// ---------- profile head (facing right). origin = head centre, unit ~ 1px at s=1, head height ~120 ----------
function profileHeadPath(ctx, who) {
  ctx.beginPath();
  if (who === 'girl') {
    ctx.moveTo(-46, 10);
    ctx.bezierCurveTo(-52, -40, -20, -60, 10, -56);
    ctx.bezierCurveTo(36, -52, 48, -32, 48, -14);
    ctx.bezierCurveTo(50, -8, 52, -2, 56, 8);   // nose
    ctx.bezierCurveTo(58, 12, 54, 16, 49, 18);
    ctx.bezierCurveTo(51, 22, 51, 26, 49, 28);  // lips
    ctx.bezierCurveTo(51, 31, 50, 35, 47, 37);
    ctx.bezierCurveTo(46, 44, 42, 50, 32, 53);  // chin
    ctx.bezierCurveTo(22, 56, 12, 56, 8, 62);
    ctx.lineTo(4, 90); ctx.lineTo(-26, 90);
    ctx.bezierCurveTo(-26, 60, -40, 40, -46, 10);
  } else {
    ctx.moveTo(-50, 8);
    ctx.bezierCurveTo(-56, -44, -22, -64, 10, -60);
    ctx.bezierCurveTo(38, -56, 50, -36, 50, -16);
    ctx.bezierCurveTo(52, -10, 54, -4, 62, 10);  // nose
    ctx.bezierCurveTo(64, 15, 58, 19, 52, 20);
    ctx.bezierCurveTo(54, 25, 54, 28, 52, 31);   // lips
    ctx.bezierCurveTo(54, 34, 53, 38, 50, 40);
    ctx.bezierCurveTo(50, 50, 46, 56, 34, 60);   // chin
    ctx.bezierCurveTo(22, 64, 14, 64, 10, 70);
    ctx.lineTo(6, 100); ctx.lineTo(-30, 100);
    ctx.bezierCurveTo(-30, 64, -44, 44, -50, 8);
  }
  ctx.closePath();
}
function profileHairBack(ctx, who, t) {
  ctx.beginPath();
  if (who === 'girl') {
    const sw = Math.sin(t * 1.3) * 3;
    ctx.moveTo(30, -50);
    ctx.bezierCurveTo(0, -78, -60, -66, -62, -10);
    ctx.bezierCurveTo(-64, 30, -54 + sw, 80, -40 + sw, 110);
    ctx.bezierCurveTo(-20, 112, -14, 90, -12, 60);
    ctx.bezierCurveTo(-14, 30, -6, 0, 4, -20);
    ctx.bezierCurveTo(20, -30, 40, -30, 50, -22);
    ctx.bezierCurveTo(52, -36, 46, -46, 30, -50);
  } else {
    ctx.moveTo(52, -20);
    const sp = [[56, -34], [46, -44], [50, -56], [30, -64], [28, -74], [10, -72], [-2, -80], [-20, -74], [-36, -74], [-44, -62], [-58, -52], [-58, -34], [-64, -18], [-58, -6]];
    for (const q of sp) ctx.lineTo(q[0], q[1]);
    ctx.bezierCurveTo(-58, 14, -50, 30, -40, 40);
    ctx.bezierCurveTo(-36, 24, -28, 16, -16, 12);
    ctx.bezierCurveTo(-10, -6, 4, -18, 20, -24);
    // fringe spikes
    ctx.lineTo(30, -12); ctx.lineTo(34, -30); ctx.lineTo(44, -10); ctx.lineTo(46, -26);
    ctx.closePath();
  }
}
// opts: {who, fill, lit: {x,y,r,c,a} light in local coords, rim: [c,a], eye:'open'|'closed'|'happy', mouth:'neutral'|'smile'|'laugh', t}
function drawProfileHead(ctx, o) {
  const who = o.who;
  const skin = o.skin, hairC = o.hair;
  // rim pass (backlight)
  if (o.rim) {
    ctx.save();
    ctx.translate(-3, -2);
    ctx.fillStyle = col(o.rim[0], o.rim[1]);
    ctx.scale(1.04, 1.04);
    profileHeadPath(ctx, who); ctx.fill();
    profileHairBack(ctx, who, o.t || 0); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = col(skin);
  profileHeadPath(ctx, who); ctx.fill();
  // light on face
  if (o.lit) {
    ctx.save();
    profileHeadPath(ctx, who); ctx.clip();
    const l = o.lit;
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    g.addColorStop(0, col(l.c, l.a)); g.addColorStop(1, col(l.c, 0));
    ctx.fillStyle = g; ctx.fillRect(-80, -80, 200, 200);
    ctx.restore();
  }
  // ear
  ctx.fillStyle = col(skin.map(v => v * 0.85));
  ctx.beginPath(); ctx.ellipse(-8, 6, 9, 14, 0.2, 0, TAU); ctx.fill();
  // features
  ctx.strokeStyle = col(hairC, 0.9); ctx.lineCap = 'round';
  const ex = who === 'girl' ? 36 : 38, ey = who === 'girl' ? -10 : -10;
  // brow
  ctx.lineWidth = who === 'girl' ? 2.5 : 3.5;
  ctx.beginPath(); ctx.moveTo(ex - 10, ey - 12); ctx.quadraticCurveTo(ex, ey - 16, ex + 10, ey - 13); ctx.stroke();
  ctx.lineWidth = 2.6;
  if (o.eye === 'closed') {
    ctx.beginPath(); ctx.moveTo(ex - 8, ey); ctx.quadraticCurveTo(ex, ey + 5, ex + 7, ey + 1); ctx.stroke();
  } else if (o.eye === 'happy') {
    ctx.beginPath(); ctx.moveTo(ex - 8, ey + 2); ctx.quadraticCurveTo(ex, ey - 5, ex + 7, ey + 1); ctx.stroke();
  } else {
    ctx.fillStyle = col(hairC);
    ctx.beginPath(); ctx.moveTo(ex - 6, ey - 2); ctx.quadraticCurveTo(ex + 2, ey - 6, ex + 8, ey - 1); ctx.quadraticCurveTo(ex + 2, ey + 4, ex - 6, ey - 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(ex + 3, ey - 2, 1.2, 0, TAU); ctx.fill();
  }
  if (who === 'girl') { // lashes
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(ex + 6, ey - 1); ctx.lineTo(ex + 11, ey - 4); ctx.stroke();
  }
  // mouth
  ctx.strokeStyle = col(skin.map(v => v * 0.55)); ctx.lineWidth = 2;
  const mx = who === 'girl' ? 47 : 50, my = who === 'girl' ? 28 : 30;
  if (o.mouth === 'laugh') {
    ctx.fillStyle = col([90, 30, 40]);
    ctx.beginPath(); ctx.moveTo(mx - 12, my - 2); ctx.quadraticCurveTo(mx + 2, my - 3, mx + 3, my - 2); ctx.quadraticCurveTo(mx, my + 9, mx - 10, my + 3); ctx.closePath(); ctx.fill();
  } else if (o.mouth === 'smile') {
    ctx.beginPath(); ctx.moveTo(mx - 10, my - 1); ctx.quadraticCurveTo(mx - 3, my + 2, mx + 1, my - 1); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(mx - 9, my); ctx.lineTo(mx + 1, my); ctx.stroke();
  }
  // cheek blush (warm memories)
  if (o.blush) {
    glowDot(ctx, 30, 14, 18, [255, 120, 110], o.blush);
  }
  // hair
  ctx.fillStyle = col(hairC);
  profileHairBack(ctx, who, o.t || 0); ctx.fill();
  if (o.hairHi) {
    ctx.save(); profileHairBack(ctx, who, o.t || 0); ctx.clip();
    ctx.strokeStyle = col(o.hairHi[0], o.hairHi[1]); ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-6, -6, 54 + i * 4, -2.4 + i * 0.05, -1.2); ctx.stroke(); }
    ctx.restore();
  }
  // tear (profile)
  if (o.tear > 0) {
    const k = o.tear;
    ctx.strokeStyle = 'rgba(200,230,255,0.55)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(ex - 2, ey + 4); ctx.quadraticCurveTo(ex - 4, ey + 20 * k, ex - 2, ey + 34 * k); ctx.stroke();
  }
}

// ---------- hero sitting on the sill, side view facing right ----------
// pose: {x,y,s, head (rad, + = look down), phone (0..1 screen on), eyes:'open'|'closed', breathe, startle, arms:'phone'|'knees'}
function heroSideRig(t, p) {
  const br = Math.sin(t * 1.4) * 2.5 * (p.breathe ?? 1);
  const st = p.startle || 0;
  const J = {
    hip: [0, 0], knee: [150, -178], foot: [215, -6], knee2: [140, -165], foot2: [200, -4],
    sh: [-28 + st * 6, -252 - br - st * 8], neck: [-12 + st * 8, -292 - br - st * 10],
  };
  if (p.arms === 'knees') { J.elb = [70, -150 - br]; J.hand = [150, -200 - br]; J.phone = [145, -150]; }
  else { J.elb = [62, -150 - br * 0.5]; J.hand = [118, -222 - br * 0.6 - st * 10]; J.phone = [122, -232 - br * 0.6 - st * 10]; }
  return J;
}
function limb(ctx, a, b, c, w1, w2) {
  ctx.lineWidth = w1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  if (c) { ctx.lineWidth = w2; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
}
function drawHeroBody(ctx, J, p, pass, t) {
  // pass: 'rim' | 'body'
  const R = pass === 'rim' ? 7 : 0;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const dark = col(HERO.hoodieDark), hood = col(HERO.hoodie), jean = col(HERO.jeans);
  const set = (c) => { if (pass === 'body') { ctx.strokeStyle = c; ctx.fillStyle = c; } };
  // far leg
  set(col(HERO.jeans.map(v => v * 0.7)));
  limb(ctx, [J.hip[0] + 10, J.hip[1] - 12], J.knee2, J.foot2, 62 + R, 50 + R);
  // torso (hoodie bulk)
  set(dark);
  ctx.beginPath();
  ctx.moveTo(J.hip[0] - 50 - R, J.hip[1] + R);
  ctx.bezierCurveTo(J.hip[0] - 70 - R, -100, J.sh[0] - 60 - R, J.sh[1] + 40, J.sh[0] - 30 - R, J.sh[1] - 18 - R);
  ctx.bezierCurveTo(J.sh[0] + 10, J.sh[1] - 40 - R, J.sh[0] + 60 + R, J.sh[1] - 10, J.sh[0] + 70 + R, J.sh[1] + 40);
  ctx.bezierCurveTo(J.sh[0] + 90 + R, -120, J.hip[0] + 60 + R, -60, J.hip[0] + 50 + R, J.hip[1] + R);
  ctx.closePath(); ctx.fill();
  // near leg
  set(jean);
  limb(ctx, J.hip, J.knee, J.foot, 66 + R, 52 + R);
  // shoe
  set(col([200, 205, 215].map(v => v * 0.35)));
  ctx.lineWidth = 34 + R; ctx.beginPath(); ctx.moveTo(J.foot[0] - 10, J.foot[1] - 4); ctx.lineTo(J.foot[0] + 34, J.foot[1] - 2); ctx.stroke();
  // near arm
  set(hood);
  limb(ctx, J.sh, J.elb, J.hand, 46 + R, 38 + R);
  // hand
  set(col(HERO.skinNight));
  ctx.beginPath(); ctx.arc(J.hand[0] + 6, J.hand[1] - 4, 15 + R / 2, 0, TAU); ctx.fill();
  // hood bunched behind neck
  set(hood);
  ctx.beginPath(); ctx.ellipse(J.neck[0] - 30, J.neck[1] + 18, 46 + R, 30 + R, -0.5, 0, TAU); ctx.fill();
}
function drawHeroSide(ctx, t, p, L) {
  const J = heroSideRig(t, p);
  ctx.save();
  ctx.translate(p.x, p.y); ctx.scale(p.s, p.s);
  const dawn = L.dawn || 0;
  // backlight rim
  const rimA = 0.85;
  const rg = ctx.createLinearGradient(-120, -400, 250, 0);
  rg.addColorStop(0, col(mix3([255, 70, 190], [255, 200, 140], dawn), rimA));
  rg.addColorStop(1, col(mix3([90, 200, 255], [255, 220, 170], dawn), rimA));
  ctx.strokeStyle = rg; ctx.fillStyle = rg;
  drawHeroBody(ctx, J, p, 'rim', t);
  drawHeroBody(ctx, J, p, 'body', t);
  // drawstrings
  ctx.strokeStyle = col(HERO.string, 0.7); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(J.neck[0] + 14, J.neck[1] + 34); ctx.quadraticCurveTo(J.neck[0] + 22, J.neck[1] + 70, J.neck[0] + 18, J.neck[1] + 96); ctx.stroke();
  // phone
  const ph = p.phone || 0;
  ctx.save();
  if (p.noPhone) ctx.globalAlpha = 0;
  ctx.translate(J.phone[0], J.phone[1]); ctx.rotate(-1.1);
  ctx.fillStyle = '#07070c'; rrect(ctx, -20, -36, 40, 72, 7); ctx.fill();
  if (ph > 0) {
    ctx.fillStyle = col([200, 225, 255], ph); rrect(ctx, -17, -32, 34, 64, 5); ctx.fill();
  }
  ctx.restore();
  // thumb over phone
  if (!p.noPhone) ctx.fillStyle = col(HERO.skinNight); ctx.beginPath(); ctx.ellipse(J.hand[0] + 16, J.hand[1] - 14, 9, 6, -0.6, 0, TAU); ctx.fill();
  // head
  ctx.save();
  ctx.translate(J.neck[0] + 20, J.neck[1] - 52);
  ctx.rotate((p.head ?? 0.35) - (p.startle || 0) * 0.35);
  const phoneLocal = [J.phone[0] - J.neck[0] - 20, J.phone[1] - J.neck[1] + 52];
  drawProfileHead(ctx, {
    who: 'hero', t,
    skin: mix3(HERO.skinNight, [150, 110, 110], dawn),
    hair: HERO.hair,
    rim: [mix3([255, 90, 200], [255, 210, 160], dawn), 0.9],
    lit: ph > 0 ? { x: 70, y: 70, r: 120, c: HERO.skinLit, a: 0.75 * ph } : (dawn > 0 ? { x: 80, y: -20, r: 120, c: [255, 200, 150], a: 0.5 * dawn } : null),
    eye: p.eyes || 'open', mouth: 'neutral',
    hairHi: [mix3([120, 90, 200], [255, 190, 140], dawn), 0.5],
    tear: p.tear || 0,
  });
  ctx.restore();
  // phone glow cast
  if (ph > 0) {
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, J.phone[0] + 10, J.phone[1] - 20, 200, [120, 170, 255], 0.35 * ph);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

// ---------- hero face, front 3/4, used for MCU / CU / ECU ----------
// f: {cx,cy,s, look:[x,y], open 0..1, brow 0..1 (worry), mouth 0..1, tear 0..1, phone 0..1, warm 0..1, t, shake}
function faceShape(ctx) {
  ctx.beginPath();
  ctx.moveTo(-206, -150);
  ctx.bezierCurveTo(-214, -40, -210, 60, -186, 150);
  ctx.bezierCurveTo(-164, 222, -100, 286, -40, 304);
  ctx.bezierCurveTo(-14, 312, 14, 312, 40, 304);
  ctx.bezierCurveTo(100, 286, 164, 222, 186, 150);
  ctx.bezierCurveTo(210, 60, 214, -40, 206, -150);
  ctx.bezierCurveTo(200, -300, -200, -300, -206, -150);
  ctx.closePath();
}
function eyeShape(ctx, side, open) {
  // side -1 = viewer-left eye, +1 = viewer-right
  const ox = side * 98, w = 64, h = 30 * open;
  const inner = [ox - side * w * 0.95, 4], outer = [ox + side * w, -2];
  ctx.beginPath();
  ctx.moveTo(inner[0], inner[1]);
  ctx.bezierCurveTo(ox - side * w * 0.5, -h * 1.35, ox + side * w * 0.45, -h * 1.3, outer[0], outer[1]);
  ctx.bezierCurveTo(ox + side * w * 0.45, 2 + h * 0.75, ox - side * w * 0.5, 4 + h * 0.85, inner[0], inner[1]);
  ctx.closePath();
}
function drawEye(ctx, side, f, detail) {
  const open = clamp(f.open);
  const ox = side * 98;
  if (open < 0.06) {
    // closed lid line with lashes
    ctx.strokeStyle = col(HERO.hair); ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ox - side * 60, 4); ctx.quadraticCurveTo(ox, 18, ox + side * 64, 0); ctx.stroke();
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const u = 0.25 + i * 0.13; const x = lerp(ox - side * 60, ox + side * 64, u); const y = 4 + Math.sin(u * Math.PI) * 13 - (u > 0.7 ? (u - 0.7) * 10 : 0); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * 4, y + 9); ctx.stroke(); }
    return;
  }
  ctx.save();
  eyeShape(ctx, side, open);
  // sclera
  const scl = mix3([150, 165, 200], [235, 220, 210], f.warm || 0);
  ctx.fillStyle = col(scl);
  ctx.fill();
  ctx.clip();
  // lid shadow
  const sg = ctx.createLinearGradient(0, -40, 0, 20);
  sg.addColorStop(0, 'rgba(10,10,30,0.7)'); sg.addColorStop(1, 'rgba(10,10,30,0)');
  ctx.fillStyle = sg; ctx.fillRect(ox - 80, -50, 160, 80);
  // iris
  const ix = ox + f.look[0] * 26, iy = -2 + f.look[1] * 10;
  const ir = 27;
  const ig = ctx.createRadialGradient(ix, iy, 4, ix, iy, ir);
  ig.addColorStop(0, col([70, 54, 50])); ig.addColorStop(0.6, col([92, 70, 58])); ig.addColorStop(0.92, col([40, 30, 34])); ig.addColorStop(1, col([20, 16, 24]));
  ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy, ir, 0, TAU); ctx.fill();
  if (detail) {
    ctx.strokeStyle = 'rgba(160,130,110,0.35)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * 9, iy + Math.sin(a) * 9); ctx.lineTo(ix + Math.cos(a + 0.05) * (ir - 3), iy + Math.sin(a + 0.05) * (ir - 3)); ctx.stroke(); }
  }
  // pupil
  const pr = 10 * (f.pupil ?? 1);
  ctx.fillStyle = '#06060a'; ctx.beginPath(); ctx.arc(ix, iy, pr, 0, TAU); ctx.fill();
  // reflections: phone screen rectangle + catchlight
  const ph = f.phone ?? 1;
  if (ph > 0) {
    ctx.fillStyle = col(f.warm > 0.5 ? [255, 230, 200] : [210, 230, 255], 0.85 * ph);
    rrect(ctx, ix - 14, iy + 4, 11, 16, 2); ctx.fill();
    if (detail) { ctx.fillStyle = `rgba(80,140,255,${0.6 * ph})`; ctx.fillRect(ix - 12, iy + 9, 6, 2); ctx.fillRect(ix - 10, iy + 14, 5, 2); }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(ix + 9, iy - 9, 4.5, 0, TAU); ctx.fill();
  ctx.fillStyle = col(f.rimC || [255, 90, 200], 0.7); ctx.beginPath(); ctx.arc(ix + 16, iy + 2, 2.5, 0, TAU); ctx.fill();
  // wet lower rim
  ctx.restore();
  // upper lash line
  ctx.save();
  ctx.strokeStyle = col(HERO.hair); ctx.lineCap = 'round';
  const w = 64, h = 30 * open;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(ox - side * w * 0.95, 4);
  ctx.bezierCurveTo(ox - side * w * 0.5, -h * 1.35, ox + side * w * 0.45, -h * 1.3, ox + side * w, -2);
  ctx.lineTo(ox + side * (w + 10), -8);
  ctx.stroke();
  // crease
  ctx.lineWidth = 2.5; ctx.strokeStyle = col(HERO.hair, 0.45);
  ctx.beginPath(); ctx.moveTo(ox - side * w * 0.7, -h * 0.9 - 8); ctx.quadraticCurveTo(ox, -h * 1.5 - 16, ox + side * w * 0.9, -h * 0.7 - 10); ctx.stroke();
  // lower lid
  ctx.lineWidth = 2; ctx.strokeStyle = col(HERO.hair, 0.4);
  ctx.beginPath(); ctx.moveTo(ox - side * w * 0.8, 8); ctx.bezierCurveTo(ox - side * w * 0.4, 6 + h * 0.85, ox + side * w * 0.4, 4 + h * 0.8, ox + side * w * 0.95, 0); ctx.stroke();
  // wetness on lower lid when tearful
  if (f.wet) { ctx.strokeStyle = `rgba(220,240,255,${0.6 * f.wet})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(ox - side * w * 0.6, 8 + h * 0.5); ctx.quadraticCurveTo(ox, 8 + h * 0.95, ox + side * w * 0.7, 4 + h * 0.5); ctx.stroke(); }
  ctx.restore();
}
function drawHeroFace(ctx, f) {
  const t = f.t || 0;
  const warm = f.warm || 0;
  const skin = mix3(HERO.skinNight, [150, 110, 110], warm);
  const lightC = mix3(HERO.skinLit, HERO.skinWarm, warm);
  const rimC = f.rimC || mix3([255, 80, 190], [255, 200, 140], warm);
  f.rimC = rimC;
  ctx.save();
  ctx.translate(f.cx + (f.shake ? nz(t * 9, 4) * f.shake : 0), f.cy);
  ctx.scale(f.s, f.s);
  ctx.rotate(f.tilt || 0);
  const breathe = Math.sin(t * 1.4) * 3;
  // neck + hoodie
  ctx.save();
  ctx.translate(0, breathe * 0.6);
  ctx.fillStyle = col(skin.map(v => v * 0.6));
  ctx.beginPath(); ctx.moveTo(-100, 220); ctx.lineTo(-115, 640); ctx.lineTo(115, 640); ctx.lineTo(100, 220); ctx.closePath(); ctx.fill();
  // under-jaw shadow
  // hoodie body
  ctx.fillStyle = col(HERO.hoodie);
  ctx.beginPath();
  ctx.moveTo(-620, 1300); ctx.bezierCurveTo(-600, 700, -420, 560, -150, 470);
  ctx.bezierCurveTo(-60, 560, 60, 560, 150, 470);
  ctx.bezierCurveTo(420, 560, 600, 700, 620, 1300); ctx.closePath(); ctx.fill();
  // hood collar
  ctx.fillStyle = col(HERO.hoodieDark);
  ctx.beginPath(); ctx.moveTo(-250, 420); ctx.bezierCurveTo(-200, 640, 200, 640, 250, 420); ctx.bezierCurveTo(160, 560, -160, 560, -250, 420); ctx.fill();
  ctx.fillStyle = col(HERO.hoodie.map(v => v * 1.2));
  ctx.beginPath(); ctx.moveTo(-290, 400); ctx.bezierCurveTo(-330, 520, -230, 600, -120, 560); ctx.bezierCurveTo(-210, 520, -250, 470, -250, 400); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(290, 400); ctx.bezierCurveTo(330, 520, 230, 600, 120, 560); ctx.bezierCurveTo(210, 520, 250, 470, 250, 400); ctx.closePath(); ctx.fill();
  // drawstrings
  ctx.strokeStyle = col(HERO.string, 0.85); ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-60, 560); ctx.quadraticCurveTo(-70, 700, -55, 850); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(60, 560); ctx.quadraticCurveTo(75, 690, 62, 820); ctx.stroke();
  ctx.fillStyle = col([200, 205, 215]); rrect(ctx, -64, 845, 18, 40, 5); ctx.fill(); rrect(ctx, 54, 815, 18, 40, 5); ctx.fill();
  // phone uplight on hoodie
  if (f.phone > 0) {
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, 0, 1000, 600, mix3([60, 110, 220], [200, 130, 70], warm), 0.4 * f.phone);
    ctx.globalCompositeOperation = 'source-over';
  }
  // rim on shoulders
  ctx.strokeStyle = col(rimC, 0.6); ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(150, 470); ctx.bezierCurveTo(420, 560, 600, 700, 620, 1300); ctx.stroke();
  ctx.restore();
  // hair back mass
  ctx.fillStyle = col(HERO.hair);
  ctx.beginPath();
  ctx.moveTo(-240, 40); ctx.bezierCurveTo(-290, -200, -200, -380, 0, -390);
  ctx.bezierCurveTo(200, -385, 290, -200, 240, 40);
  ctx.lineTo(210, 60); ctx.lineTo(-210, 60); ctx.closePath(); ctx.fill();
  // ears
  ctx.fillStyle = col(skin.map(v => v * 0.8));
  ctx.beginPath(); ctx.ellipse(-208, 30, 26, 52, 0.15, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(208, 30, 26, 52, -0.15, 0, TAU); ctx.fill();
  // face
  ctx.fillStyle = col(skin);
  faceShape(ctx); ctx.fill();
  ctx.save();
  faceShape(ctx); ctx.clip();
  // phone light from below
  const ph = f.phone ?? 1;
  if (ph > 0) {
    const g = ctx.createRadialGradient(-20, 420, 40, -20, 260, 560);
    g.addColorStop(0, col(lightC, 0.85 * ph)); g.addColorStop(0.55, col(lightC, 0.35 * ph)); g.addColorStop(1, col(lightC, 0));
    ctx.fillStyle = g; ctx.fillRect(-260, -320, 520, 660);
  }
  // ambient/dawn key from side
  if (f.key) {
    const g = ctx.createRadialGradient(260, -60, 20, 260, -60, 420);
    g.addColorStop(0, col(f.key[0], f.key[1])); g.addColorStop(1, col(f.key[0], 0));
    ctx.fillStyle = g; ctx.fillRect(-260, -320, 520, 660);
  }
  // rim on right cheek (window behind-right)
  const rg = ctx.createLinearGradient(140, 0, 215, 0);
  rg.addColorStop(0, col(rimC, 0)); rg.addColorStop(1, col(rimC, 0.75));
  ctx.fillStyle = rg; ctx.fillRect(140, -320, 90, 660);
  // eye socket shade
  for (const sx of [-98, 98]) {
    ctx.save(); ctx.translate(sx, -20); ctx.scale(1, 0.55);
    const sg = ctx.createRadialGradient(0, 0, 10, 0, 0, 110);
    sg.addColorStop(0, 'rgba(10,12,35,0.2)'); sg.addColorStop(1, 'rgba(10,12,35,0)');
    ctx.fillStyle = sg; ctx.fillRect(-110, -110, 220, 220); ctx.restore();
  }
  // rain shadows sliding over face
  if (f.rainShadow) drawRainShadow(ctx, t, -260, -320, 520, 660, f.rainShadow, 1 / f.s);
  ctx.restore();
  // nose
  ctx.strokeStyle = col(skin.map(v => v * 0.55), 0.8); ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-18, 10); ctx.quadraticCurveTo(-30, 70, -26, 104); ctx.stroke();
  ctx.fillStyle = col(skin.map(v => v * 0.5), 0.7);
  ctx.beginPath(); ctx.moveTo(-36, 112); ctx.quadraticCurveTo(0, 132, 34, 112); ctx.quadraticCurveTo(0, 122, -36, 112); ctx.fill();
  ctx.fillStyle = col(lightC, 0.55 * (f.phone ?? 1));
  ctx.beginPath(); ctx.ellipse(0, 118, 22, 6, 0, 0, TAU); ctx.fill();  // uplit nose underside
  // mouth
  const mo = f.mouth || 0;
  ctx.strokeStyle = col(skin.map(v => v * 0.42)); ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-44, 186); ctx.quadraticCurveTo(0, 190 + (f.smile || 0) * 8, 44, 184); ctx.stroke();
  if (mo > 0.02) {
    ctx.fillStyle = col([40, 20, 34]);
    ctx.beginPath(); ctx.moveTo(-36, 186); ctx.quadraticCurveTo(0, 186 + 30 * mo, 36, 185); ctx.quadraticCurveTo(0, 184 - 4 * mo, -36, 186); ctx.fill();
  }
  ctx.fillStyle = col(lightC, 0.3 * (f.phone ?? 1));
  ctx.beginPath(); ctx.ellipse(0, 208 + 6 * mo, 30, 8, 0, 0, TAU); ctx.fill(); // lower lip light
  // eyes
  const blink = f.blink || 0;
  const op = (f.open ?? 1) * (1 - blink);
  const fe = Object.assign({}, f, { open: op });
  drawEye(ctx, -1, fe, f.s > 1.4);
  drawEye(ctx, 1, fe, f.s > 1.4);
  // brows (worry raises inner ends)
  const bw = f.brow || 0;
  ctx.strokeStyle = col(HERO.hair); ctx.lineWidth = 15; ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 40, -70 - bw * 20);
    ctx.quadraticCurveTo(side * 100, -100 - bw * 4, side * 160, -78 + bw * 6);
    ctx.stroke();
  }
  // tear
  if (f.tear > 0) drawTear(ctx, f.tear, t);
  // fringe over forehead
  ctx.fillStyle = col(HERO.hair);
  const locks = [[-230, -40, -150, -260], [-170, -60, -60, -300], [-90, -82, 30, -300], [-20, -66, 110, -300], [60, -84, 170, -280], [140, -50, 240, -220], [205, 10, 250, -160]];
  ctx.beginPath();
  ctx.moveTo(-240, -120);
  ctx.bezierCurveTo(-240, -330, 240, -340, 250, -110);
  for (let i = locks.length - 1; i >= 0; i--) {
    const [tx, ty, bx, by] = locks[i];
    const sw = Math.sin(t * 1.1 + i) * 2;
    ctx.quadraticCurveTo(bx - 10, by + 90, tx + sw, ty);
    ctx.quadraticCurveTo(tx - 20, ty - 60, bx - 80, by + 40);
  }
  ctx.closePath(); ctx.fill();
  // hair highlights (rim)
  ctx.save();
  ctx.strokeStyle = col(rimC, 0.55); ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(120, -330); ctx.quadraticCurveTo(250, -280, 262, -120); ctx.stroke();
  ctx.strokeStyle = col(mix3([140, 160, 255], [255, 210, 170], warm), 0.25); ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-160 + i * 60, -300); ctx.quadraticCurveTo(-120 + i * 60, -220, -150 + i * 62, -130); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}
function drawTear(ctx, k, t) {
  // path from inner-lower lid of viewer-left eye down cheek
  const pts = [[-70, 18], [-74, 70], [-82, 130], [-92, 190], [-96, 240]];
  const u = clamp(k) * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(u)), f = u - i;
  const hx = lerp(pts[i][0], pts[i + 1][0], f), hy = lerp(pts[i][1], pts[i + 1][1], f);
  ctx.save();
  ctx.strokeStyle = 'rgba(210,235,255,0.45)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let j = 1; j <= i; j++) ctx.lineTo(pts[j][0], pts[j][1]);
  ctx.lineTo(hx, hy); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.6; ctx.stroke();
  // droplet head
  ctx.fillStyle = 'rgba(200,225,255,0.75)';
  ctx.beginPath(); ctx.ellipse(hx, hy, 8, 11, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.arc(hx - 2.5, hy - 3, 3, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,210,0.6)';
  ctx.beginPath(); ctx.arc(hx + 3, hy + 4, 2, 0, TAU); ctx.fill();
  ctx.restore();
}
// moving shadows of rain drops on glass, projected onto surfaces
function drawRainShadow(ctx, t, x, y, w, h, a, unit = 1) {
  const r = mulberry32(99);
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const sx = x + r() * w, sp = 0.04 + r() * 0.1, ph = r();
    const rr = (10 + r() * 26) * unit * 2;
    const p = (ph + t * sp) % 1;
    const yy = y + p * h * 1.3 - h * 0.15;
    const g = ctx.createLinearGradient(0, yy - rr * 6, 0, yy + rr);
    g.addColorStop(0, 'rgba(0,0,20,0)'); g.addColorStop(0.85, `rgba(0,0,20,${0.18 * a})`); g.addColorStop(1, 'rgba(0,0,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(sx, yy - rr * 2.5, rr * 0.55, rr * 3.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(170,200,255,${0.1 * a})`;
    ctx.beginPath(); ctx.arc(sx - rr * 0.2, yy + rr * 0.4, rr * 0.3, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------- hands holding a phone (front view, used by phone close-ups) ----------
function handSkin(warm) { return mix3([118, 112, 146], HERO.skinWarm.map(v => v * 0.8), warm); }
function drawHandsBack(ctx, warm) {
  const sk = handSkin(warm);
  const g = (x0, x1) => { const gr = ctx.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, col(sk.map(v => v * 0.55))); gr.addColorStop(1, col(sk)); return gr; };
  ctx.fillStyle = g(-560, -330);
  ctx.beginPath(); ctx.moveTo(-560, 1000); ctx.bezierCurveTo(-520, 640, -430, 420, -372, 330); ctx.lineTo(-372, 820); ctx.bezierCurveTo(-380, 900, -400, 960, -420, 1000); ctx.closePath(); ctx.fill();
  ctx.fillStyle = g(560, 330);
  ctx.beginPath(); ctx.moveTo(560, 1000); ctx.bezierCurveTo(520, 660, 440, 460, 372, 360); ctx.lineTo(372, 820); ctx.bezierCurveTo(380, 900, 400, 960, 420, 1000); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col(HERO.hoodie);
  ctx.beginPath(); ctx.moveTo(-700, 1200); ctx.bezierCurveTo(-640, 900, -600, 820, -540, 780); ctx.lineTo(-360, 1050); ctx.lineTo(-380, 1200); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(700, 1200); ctx.bezierCurveTo(640, 900, 600, 820, 540, 800); ctx.lineTo(360, 1050); ctx.lineTo(380, 1200); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col(HERO.hoodieDark); ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(-540, 780); ctx.lineTo(-372, 1040); ctx.moveTo(540, 800); ctx.lineTo(372, 1040); ctx.stroke();
}
function fingerPath(ctx, x0, y0, x1, y1, w0, w1) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
  ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, a + Math.PI / 2, a - Math.PI / 2, true);
  ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.closePath();
}
function drawFingersFront(ctx, warm, lit, thumb) {
  const base = handSkin(warm);
  const litC = mix3(base, mix3([190, 200, 240], [255, 215, 185], warm), clamp(lit) * 0.45);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const y = (side < 0 ? 170 : 210) + i * 96;
      const gr = ctx.createLinearGradient(side * 392, 0, side * 318, 0);
      gr.addColorStop(0, col(base.map(v => v * 0.6))); gr.addColorStop(1, col(litC));
      ctx.fillStyle = gr;
      fingerPath(ctx, side * 396, y - 6, side * 336, y + 10, 50, 40);
      ctx.fill();
      ctx.strokeStyle = col(base.map(v => v * 0.4), 0.6); ctx.lineWidth = 2; ctx.stroke();
    }
  }
  if (thumb) {
    const [tx, ty, press] = thumb;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,10,0.5)'; ctx.shadowBlur = 34; ctx.shadowOffsetX = 10; ctx.shadowOffsetY = 22 - press * 10;
    const gr = ctx.createLinearGradient(tx, ty, 520, 1000);
    gr.addColorStop(0, col(litC)); gr.addColorStop(1, col(base.map(v => v * 0.7)));
    ctx.fillStyle = gr;
    fingerPath(ctx, 560, 1040, tx, ty, 150, 78 - press * 4);
    ctx.fill();
    ctx.restore();
    const a = Math.atan2(ty - 1040, tx - 560);
    ctx.save(); ctx.translate(tx - Math.cos(a) * 14, ty - Math.sin(a) * 14); ctx.rotate(a);
    ctx.fillStyle = col(mix3(litC, [255, 235, 235], 0.25), 0.85);
    rrect(ctx, -26, -22, 44, 44, 16); ctx.fill();
    ctx.strokeStyle = col(base.map(v => v * 0.5), 0.5); ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
}
