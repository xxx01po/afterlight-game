import * as THREE from 'three';
import type { Game } from '@/game/Game';
import { segClock } from '@/game/world/CanvasScreen';
import { formatClock } from '@/utils/math';

/**
 * Renders the apartment as a pure function of `story.world`.
 * Loading a save = applying the saved world; no replay needed.
 */
export function applyWorld(g: Game) {
  const w = g.s.world;
  const power = !!w.power;
  const A = g.apt, L = g.land;

  // lights
  const lit = (id: string) => !!w[`light.${id}`] && power;
  for (const id of ['room', 'kitchen', 'bath', 'desk']) g.lamps[id].target = lit(id) ? 1 : 0;
  g.lamps.hall.target = lit('hall') && !w.hallDead ? 1 : 0;
  g.lamps.landing.target = w['light.landing'] ? 1 : 0;
  g.lamps.landing.flicker = g.s.stage >= 3 ? 0.6 : 0.15;
  g.lamps.apt48.target = w['light.apt48'] ? 1 : 0;
  g.lamps.apt48.flicker = 0.3;
  for (const [id, sw] of [['hall', A.props.swHall], ['bath', A.props.swBath], ['room', A.props.swRoom], ['kitchen', A.props.swKitchen]] as const) {
    const key = sw.userData.key as THREE.Object3D;
    key.rotation.z = w[`light.${id}`] ? -0.15 : 0.15;
  }

  // doors
  for (const [id, door] of Object.entries({ ...A.doors, ...L.doors })) {
    const v = w[`door.${id}`];
    if (v === undefined) continue;
    if (id === 'closet' && !v && w.closetAjar) {
      if (door.targetAngle !== -0.45) door.setAjar(-0.45);
      continue;
    }
    if (!!v !== door.open || (door.open && Math.abs(door.targetAngle) < 0.5)) door.setOpen(!!v);
  }

  // props
  A.photoFrame.rotation.x = w.photoFaceDown ? -Math.PI / 2 + 0.02 : -0.12;
  A.photoFrame.position.y = w.photoFaceDown ? 1.215 + 0.01 : 1.33;
  A.polaroid.visible = w.polaroid !== 'none';
  if (w.polaroid === 'neighbor' && !A.polaroid.userData.neighbor) {
    A.polaroid.userData.neighbor = true;
    const mat = A.polaroid.material as THREE.MeshLambertMaterial;
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 116;
    const x = c.getContext('2d')!;
    x.fillStyle = '#e9e4d6';
    x.fillRect(0, 0, 96, 116);
    x.fillStyle = '#0d0c0b';
    x.fillRect(8, 8, 80, 80);
    x.fillStyle = '#4a4a40';
    x.fillRect(30, 18, 36, 70);
    x.fillStyle = '#1b2026';
    x.fillRect(44, 40, 12, 40);
    x.beginPath();
    x.arc(50, 36, 6, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#333';
    x.font = '11px monospace';
    x.fillText('03:17', 30, 106);
    mat.map = new THREE.CanvasTexture(c);
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.needsUpdate = true;
  }
  A.noteDoor.visible = w.noteDoor !== 'none' && !w.noteTaken;
  A.jacket.visible = !!w.jacket;
  A.footprints.visible = !!w.footprints;
  A.props.key48.visible = !!w.key48;
  (A.props.glass as THREE.Mesh).scale.y = 1;
  ((A.props.glass as THREE.Mesh).material as THREE.MeshPhongMaterial).color.set(w.glassFull ? 0x9fc0d0 : 0xc8dce0);
  // drawer & fridge
  A.props.drawer.position.z = w.drawer ? 6.43 - 0.3 : 6.43;
  A.props.fridgeDoor.rotation.y = w.fridge ? -1.5 : 0;
  (A.props.fridgeLight as unknown as THREE.PointLight).intensity = w.fridge && power ? 1.2 : 0;
  // screens
  drawMicrowave(g);
  const tvOn = power && w.tv !== 'off';
  const scr = A.props.tvScreen as THREE.Mesh;
  (scr.material as THREE.MeshBasicMaterial).color.set(tvOn ? 0xffffff : 0x000000);
  A.tvLight.intensity = tvOn ? 0.7 : 0;
  g.sound?.level('tv', tvOn && w.tv === 'static' ? 0.12 : tvOn ? 0.04 : 0, 0.15);
  // mirror
  g.mirror.lag = Number(w.mirrorLag) || 0;
  // sound world
  g.sound?.setPower(power);
  g.sound?.setRain(Number(w.rain ?? 1), w.rain === 0 ? 0.05 : 2);
  // elevator
  const el = L.elevator;
  el.target = w.elevator === 'open' ? 1 : 0;
  (el.light.material as THREE.MeshBasicMaterial).color.set(w.elevator === 'open' || w.elevator === 'inside' ? 0xd8e0d0 : 0x161616);
  ((L.props.elevatorButton as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(w.elevator === 'coming' ? 0xff7a3a : 0x331a10);
  if (w.elevator === 'away') el.display.draw((c, ww, hh) => ((c.fillStyle = '#050505'), c.fillRect(0, 0, ww, hh)));
  else if (w.elevator !== 'inside') el.display.draw((c, ww, hh) => segClock(c, ww, hh, '4', '#ff6a2a'));
}

export function drawMicrowave(g: Game) {
  const w = g.s.world;
  const t = w.microwave === '0317' ? '03:17' : formatClock(g.s.clockMin);
  const key = w.power ? t : 'off';
  if (g.apt.microwave.canvas.dataset.k === key) return;
  g.apt.microwave.canvas.dataset.k = key;
  g.apt.microwave.draw((c, ww, hh) => (w.power ? segClock(c, ww, hh, t, '#78ffb0') : ((c.fillStyle = '#050605'), c.fillRect(0, 0, ww, hh))));
}
