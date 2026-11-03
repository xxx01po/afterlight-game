import * as THREE from 'three';
import type { ChapterModule, Game } from '@/game/Game';
import { beats, CLOCK_0317 } from './beats';
import { chapter01Interactables } from './interactables';
import { applyWorld, drawMicrowave } from './worldView';
import { REFLECTION_LAYER } from '@/game/world/Mirror';
import { useUI } from '@/game/state/ui';
import * as S from '@/game/audio/synth';
import { T } from './texts';
import { rng } from '@/utils/math';
import { strange } from './progress';

const CAP = [3 * 60 + 4, 3 * 60 + 16, CLOCK_0317, CLOCK_0317, CLOCK_0317];

interface Ch1Runtime {
  nextCar: number;
  nextPipe: number;
  car: number;
  knockTimer: number;
  knocks: number;
  tvFrame: number;
  tvCam?: THREE.PerspectiveCamera;
  tvRT?: THREE.WebGLRenderTarget;
  tvMode: string;
  r: () => number;
  saidStill: boolean;
  saidCalls: boolean;
  mirrorLook: number;
  mirrorDone: boolean;
}
const RT = new WeakMap<Game, Ch1Runtime>();

function rt(g: Game): Ch1Runtime {
  let r = RT.get(g);
  if (!r) {
    r = { nextCar: 25, nextPipe: 40, car: -1, knockTimer: 0, knocks: 0, tvFrame: 0, tvMode: '', r: rng(317), saidStill: false, saidCalls: false, mirrorLook: 0, mirrorDone: false };
    RT.set(g, r);
  }
  return r;
}

/** Per-frame chapter logic that isn't a discrete beat. */
function update(g: Game, dt: number, t: number) {
  const r = rt(g);
  const st = g.s.stage;
  // ---- story clock: runs (slowly) until 03:17, then stops for good
  if (!g.flag('clockFrozen')) {
    const cap = CAP[st] ?? CLOCK_0317;
    const next = Math.min(cap, g.s.clockMin + dt / 22);
    if (Math.floor(next) !== Math.floor(g.s.clockMin)) g.setClock(next);
    else g.s.clockMin = next; // sub-minute drift without re-render storms
  }
  drawMicrowave(g);

  // ---- life of the house (stops after 03:17 — a broken pattern you can hear)
  const silent = !!g.flag('silentWorld');
  r.nextCar -= dt;
  r.nextPipe -= dt;
  if (!silent && r.nextCar <= 0) {
    r.nextCar = 70 + r.r() * 50;
    r.car = 0;
    g.sfx({ x: -6, y: -9, z: 14 }, (e, d) => S.carPass(e, d, 6), 8);
  }
  if (!silent && r.nextPipe <= 0) {
    r.nextPipe = 45 + r.r() * 45;
    const a = g.apt.anchors.pipes;
    if (r.r() < 0.5) g.sfx(a, (e, d) => S.pipeKnock(e, d, 0.8));
    else g.sfx(a, (e, d) => S.gurgle(e, d, 2.2));
  }
  // headlights sweeping the ceiling
  const hl = g.apt.headlight;
  const hm = hl.material as THREE.MeshBasicMaterial;
  if (r.car >= 0) {
    r.car += dt;
    const k = r.car / 5;
    hl.position.x = -0.5 + k * 4;
    hm.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.18;
    if (k >= 1) r.car = -1;
  } else hm.opacity = 0;

  // ---- TV screen
  drawTV(g, r, t);

  // ---- mirror moment (stage 1): the reflection is late
  if (st === 1 && !r.mirrorDone && g.room() === 'bath' && g.looking(g.apt.anchors.mirror, 2.2, 0.8)) {
    r.mirrorLook += dt;
    if (r.mirrorLook > 1.3) {
      r.mirrorDone = true;
      void mirrorMoment(g);
    }
  }

  // ---- stage 3: if the player hides, the knocking returns
  if (st === 3 && g.director.fired('b3_start') && !g.flag('dlgStarted') && g.director.since('b3_start') > 6) {
    r.knockTimer += dt;
    if (r.knockTimer > 26 && r.knocks < 6) {
      r.knockTimer = 0;
      r.knocks++;
      g.knock(g.apt.anchors.frontDoorOut, 3, 1 + r.knocks * 0.12);
      if (r.knocks >= 2) setTimeout(() => g.sfx(g.apt.anchors.frontDoorOut, (e, d) => S.murmur(e, d, 1.1, 225, 900, 0.5), 3), 2600);
      if (r.knocks === 2) setTimeout(() => g.say('«Владик?..»', 2.5, 'За дверью'), 2700);
    }
  }

  // ---- phone discoveries
  const u = useUI.getState();
  if (u.phoneOpen && g.flag('clockFrozen') && !r.saidStill && g.director.since('b2_msg1') > 150) {
    r.saidStill = true;
    g.say(T.stillTime, 2.5);
  }
  if (u.phoneOpen && !r.saidCalls && g.director.fired('b2_recording') && (u.phoneApp === 'calls' || u.phoneApp === 'recorder')) {
    r.saidCalls = true;
    setTimeout(() => g.say(T.recordingFound, 4), 600);
  }
}

async function mirrorMoment(g: Game) {
  g.mirror.lag = 2.2;
  g.mirror.stare = true;
  g.music((e, d) => S.sting(e, d));
  await g.wait(1.6);
  g.say(T.mirror, 4);
  g.learn('mirror');
  strange(g, 'mirror');
  await g.wait(3);
  g.mirror.stare = false;
  g.setWorld('mirrorLag', 0);
  g.mirror.lag = 0;
}

function drawTV(g: Game, r: Ch1Runtime, t: number) {
  const mode = String(g.world('tv'));
  const on = mode !== 'off' && !!g.world('power');
  const scr = g.apt.props.tvScreen as THREE.Mesh;
  const mat = scr.material as THREE.MeshBasicMaterial;
  if (!on) {
    r.tvMode = 'off';
    return;
  }
  if (mode === 'live' && g.engine.preset.tvLive) {
    if (!r.tvCam) {
      r.tvCam = new THREE.PerspectiveCamera(70, 128 / 96, 0.05, 20);
      r.tvCam.position.set(2.6, 1.15, 5.1);
      r.tvCam.rotation.set(-0.08, Math.PI / 2, 0, 'YXZ');
      r.tvCam.layers.enable(REFLECTION_LAYER);
      r.tvRT = new THREE.WebGLRenderTarget(160, 120);
    }
    if (r.tvMode !== 'live') {
      r.tvMode = 'live';
      mat.map = r.tvRT!.texture;
      mat.needsUpdate = true;
    }
    if (++r.tvFrame % 3 === 0) {
      scr.visible = false;
      const ren = g.engine.renderer;
      ren.setRenderTarget(r.tvRT!);
      ren.render(g.engine.scene, r.tvCam);
      ren.setRenderTarget(null);
      scr.visible = true;
    }
    return;
  }
  if (r.tvMode === 'live' || mat.map !== g.apt.tv.tex) {
    mat.map = g.apt.tv.tex;
    mat.needsUpdate = true;
  }
  r.tvMode = mode;
  if (++r.tvFrame % 4) return;
  g.apt.tv.draw((c, w, h) => {
    if (mode === 'static') {
      const img = c.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 200;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    } else {
      // night broadcast pause card (original design)
      const bars = ['#9a9a9a', '#9a9a5a', '#5a9a9a', '#5a9a5a', '#9a5a9a', '#9a5a5a', '#5a5a9a'];
      bars.forEach((b, i) => {
        c.fillStyle = b;
        c.fillRect((i * w) / 7, 0, w / 7 + 1, h * 0.62);
      });
      c.fillStyle = '#111';
      c.fillRect(0, h * 0.62, w, h * 0.38);
      c.fillStyle = '#ddd';
      c.font = 'bold 11px sans-serif';
      c.textAlign = 'center';
      c.fillText('ТЕХНИЧЕСКИЙ ПЕРЕРЫВ', w / 2, h * 0.78);
      c.font = '10px monospace';
      c.fillText(g.clock + (Math.floor(t) % 2 ? ' ' : ':'), w / 2, h * 0.93);
    }
  });
}

export const chapter01: ChapterModule = {
  beats,
  interactables: chapter01Interactables,
  applyWorld,
  update,
};
