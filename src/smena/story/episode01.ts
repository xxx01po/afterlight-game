import * as THREE from 'three';
import type { Game } from '@/smena/Game';
import type { Beat } from './Director';
import * as S from '@/smena/audio/synth';
import { toast, useGame } from '@/smena/state/game';
import { PATROLS } from '@/smena/ai/navmap';
import { heightAt } from '@/smena/world/layout';

export interface Episode {
  beats: Beat<Game>[];
  reset: () => void;
  applyFlags: () => void;
  onRead?: (docId: string) => void;
}

const near = (g: Game, o: THREE.Object3D | THREE.Vector3, r: number) => {
  const p = o instanceof THREE.Vector3 ? o : o.getWorldPosition(new THREE.Vector3());
  return Math.hypot(p.x - g.player.pos.x, p.z - g.player.pos.z) < r;
};

/**
 * Episode 01 «Ночная смена № 01». Six scenes:
 * 1 start at the booth → 2 first round (generator, storage, cameras) →
 * 3 the man on camera 3 → 4 the relay in the village → 5 something in the forest →
 * (complex, the journal, the hunt) → 6 back at base: «Ты уверен, что сегодня твоя первая смена?»
 */
export function buildEpisode(g: Game): Episode {
  const ctx = g.world.ctx;
  const sp = ctx.spots;
  const levers = [0, 1, 2].map((i) => sp.breakers.getObjectByName('lever' + i)!);
  const passLed = sp.passReader.getObjectByName('led') as THREE.Mesh;
  const radioLed = sp.radio.getObjectByName('led') as THREE.Mesh;
  const canisterId = () => g.ph?.props.find((p) => p.mesh === sp.canister);

  const openGates = () => {
    for (const id of ['northGateL', 'northGateR']) {
      const d = g.door(id);
      d.setLocked(false);
    }
  };

  // ------------------------------------------------------------ story objects
  g.interact.add({
    id: 'generator',
    targets: [sp.generator],
    verb: () => 'use',
    label: () => {
      if (g.flag('genOn')) return 'Генератор работает';
      if (!g.flag('genFueled')) return g.grab?.held === canisterId() && canisterId() ? 'Залить топливо' : 'Осмотреть генератор';
      return 'Запустить генератор';
    },
    use: () => {
      if (g.flag('genOn')) return;
      const c = canisterId();
      if (!g.flag('genFueled')) {
        if (c && g.grab?.held === c) {
          g.grab.drop();
          c.body.setEnabled(false);
          c.mesh.visible = false;
          g.setFlag('genFueled');
          g.sfx((d) => S.creak(g.audio, d, 0.4, 2), sp.generator.position.clone());
          toast('Бак заправлен');
          if (g.stage < 4) g.setStage(4);
          return;
        }
        if (!g.flag('genEmpty')) {
          g.setFlag('genEmpty');
          if (g.stage <= 2) g.setStage(3);
          void g.say('genEmpty');
        } else toast('Нужна канистра с топливом — возьмите её руками и принесите');
        return;
      }
      // start: the first pull fails, the second catches
      const tries = g.flag('genTries');
      g.setFlag('genTries', tries + 1);
      const ok = tries >= 1;
      g.sfx((d) => S.generatorStart(g.audio, d, ok), sp.generator.position.clone());
      g.noise(sp.generator.position, 18);
      if (!ok) return toast('Не схватился. Ещё раз.');
      g.setFlag('genOn');
      setTimeout(() => {
        g.power('base', true);
        g.sfx((d) => S.powerUp(g.audio, d));
      }, 1200);
      void g.director.wait(2.5).then(() => g.say('genStarted')).then(() => g.setStage(5));
    },
  });

  g.interact.add({
    id: 'cctv',
    targets: [sp.cctvScreen],
    verb: () => 'look',
    range: 2.6,
    label: () => (g.world.pool.powered.base ? `Переключить камеру (${feedName(g.cctv.currentFeed(sp.cctvScreen))})` : 'Монитор — нет питания'),
    use: () => {
      if (!g.world.pool.powered.base) return;
      g.sfx((d) => S.click(g.audio, d, 0.7));
      g.cctv.next(sp.cctvScreen);
    },
  });
  const feedName = (id: string | null) => ({ cam1: 'КАМ 1', cam2: 'КАМ 2', cam3: 'КАМ 3', cam4: 'КАМ 4' })[id ?? ''] ?? '—';
  g.cctv.onFeed = (id) => {
    if (id === 'cam3' && g.stage === 5 && !g.flag('camSeen')) g.director.fire('camMan');
  };

  g.interact.add({
    id: 'radio',
    targets: [sp.radio],
    verb: () => 'talk',
    label: () => (g.stage === 13 ? 'Вызвать диспетчера' : 'Рация диспетчера (канал 3)'),
    use: () => {
      if (g.stage === 13) return g.director.fire('final');
      g.sfx((d) => S.radioSquelch(g.audio, d, 0.6), sp.radio.position.clone());
      toast(g.stage < 12 ? 'Диспетчер на связи по портативной рации' : '…шипение…');
    },
  });

  g.interact.add({
    id: 'relay',
    targets: [sp.relayBox],
    verb: () => 'use',
    label: () => {
      if (g.flag('relayFixed')) return 'Щиток ретранслятора — работает';
      if (!g.flag('relayOpen')) return g.inv.has('screwdriver') ? 'Открутить панель щитка' : 'Щиток ретранслятора (на болтах)';
      return g.inv.has('fuse') ? 'Вставить предохранитель и включить' : 'Нет предохранителя';
    },
    use: () => {
      if (g.flag('relayFixed')) return;
      if (g.stage < 8) g.setStage(8);
      if (!g.flag('relayOpen')) {
        if (!g.inv.has('screwdriver')) {
          g.refreshObjective(true);
          return void g.say('relayNeedTools');
        }
        g.setFlag('relayOpen');
        g.sfx((d) => S.creak(g.audio, d, 0.3, 2.5), sp.relayBox.position.clone());
        toast('Панель снята');
        g.refreshObjective();
        return;
      }
      if (!g.inv.has('fuse')) return void g.say('needFuse');
      g.inv.remove('fuse');
      g.setFlag('fuseUsed');
      g.syncInventoryUI();
      g.sfx((d) => S.breaker(g.audio, d), sp.relayBox.position.clone());
      g.director.fire('relayFixed');
    },
  });

  g.interact.add({
    id: 'villageRadio',
    targets: [sp.villageRadio],
    verb: () => 'use',
    label: () => 'Покрутить настройку приёмника',
    use: () => {
      g.sfx((d) => S.radioSquelch(g.audio, d, 1.2), sp.villageRadio.position.clone());
      if (g.flag('relayFixed') && !g.flag('villageRadioEcho')) {
        g.setFlag('villageRadioEcho');
        void g.say([{ who: 'echo', text: 'Никого. Только следы. Длинные. Это не сапоги.' }, { who: 'echo', text: 'Ноль ноль сорок. Дождь, лес и шлагбаум.' }]);
      }
    },
  });

  g.interact.add({
    id: 'breakers',
    targets: [sp.breakers],
    verb: () => 'use',
    label: () => (g.flag('cxPower') ? 'Рубильники включены' : 'Включить рубильники'),
    use: () => {
      if (g.flag('cxPower') || g.flag('huntStarted')) return;
      g.director.fire('breakers');
    },
  });

  g.interact.add({
    id: 'passReader',
    targets: [sp.passReader],
    verb: () => 'use',
    label: () => (g.door('cxEntrance').locked ? 'Приложить пропуск' : 'Считыватель: доступ открыт'),
    use: () => g.door('cxEntrance').locked && passCheck(),
  });
  const passCheck = () => {
    const d = g.door('cxEntrance');
    if (!g.inv.has('pass')) {
      g.sfx((x) => S.buzzer(g.audio, x, false), sp.passReader.position.clone());
      void g.say('needPass');
      return true;
    }
    g.sfx((x) => S.buzzer(g.audio, x, true), sp.passReader.position.clone());
    passLed.material = g.world.M.greenLed;
    d.setLocked(false);
    setTimeout(() => d.setOpen(true), 400);
    toast('Доступ разрешён. Громов И. А.');
    return true;
  };
  g.doorHooks.set('cxEntrance', (d) => (d.locked ? passCheck() : false));
  g.doorHooks.set('cxElectric', (d) => {
    if (d.locked && !g.inv.has('fusebox_key')) {
      d.toggle(() => false);
      void g.say('needKey');
      g.refreshObjective();
      return true;
    }
    return false;
  });
  g.doorHooks.set('cxCell', () => {
    g.sfx((x) => S.metalBang(g.audio, x, 0.5), g.door('cxCell').center());
    toast('Дверь заварена. Изнутри — царапины.');
    return true;
  });
  for (const id of ['northGateL', 'northGateR']) {
    g.doorHooks.set(id, (d) => {
      if (d.locked) {
        d.toggle(() => false);
        toast(g.stage < 6 ? 'Ворота на замке. Ключ — у диспетчера.' : 'Заперто');
        return true;
      }
      const open = !d.open;
      for (const o of ['northGateL', 'northGateR']) g.door(o).setOpen(open);
      g.noise(d.center(), 12);
      return true;
    });
  }

  g.interact.add({
    id: 'cxScreen',
    targets: [sp.cxScreen],
    verb: () => 'look',
    range: 2.4,
    enabled: () => g.world.pool.powered.complex,
    label: () => 'Смотреть монитор',
    use: () => {
      if (!g.flag('cxMonitorSeen')) {
        g.setFlag('cxMonitorSeen');
        void g.say('cxMonitor');
      }
    },
  });

  // ------------------------------------------------------------ beats
  const beats: Beat<Game>[] = [
    { id: 'intro', when: (x) => x.mode === 'play' && x.stage === 0, run: async (x) => {
      await x.director.wait(1.5);
      await x.say('intro');
      if (!x.flashlight.owned) toast(x.input.usingTouch ? 'Слева — ходьба, справа — обзор. Кнопка «рука» — взаимодействие' : 'WASD — ходьба, мышь — обзор, E — взаимодействие', 5);
    } },
    { id: 'briefing', when: (x) => x.stage === 0 && x.flashlight.owned && x.flag('walkie') > 0, run: async (x) => {
      x.setStage(1, false);
      await x.director.wait(1.2);
      await x.say('briefing');
      x.setStage(2);
    } },
    { id: 'camMan', when: () => false, run: async (x) => {
      x.setFlag('camSeen');
      x.figures.place(x.figures.cctvMan, -0.6, heightAt(-0.6, -22.5), -22.5, 3.8, -16.2);
      x.cctv.glitch = 1;
      x.sfx((d) => S.sting(x.audio, d, 0.5));
      await x.director.wait(2);
      await x.say('camMan');
      openGates();
      x.setStage(6);
    } },
    { id: 'manVanish', when: (x) => x.stage >= 6 && x.flag('camSeen') > 0 && x.world.indoorAt(x.player.pos)?.name !== 'guard', run: (x) => {
      x.figures.cctvMan.root.visible = false;
      ctx.dynamic.tracksGate.visible = true;
      x.setFlag('manVanish');
    } },
    { id: 'gateEmpty', when: (x) => x.stage === 6 && x.player.pos.z < -17.2 && Math.abs(x.player.pos.x) < 5, run: async (x) => {
      x.setFlag('gateOpen');
      await x.say('gateEmpty');
      x.setStage(7);
    } },
    { id: 'roadStatic', when: (x) => x.stage === 7 && x.player.pos.z < -48, run: (x) => void x.say('roadStatic') },
    { id: 'creatureCross', when: (x) => x.stage >= 7 && x.stage <= 9 && !x.flag('creatureSeen') && near(x, sp.creatureCross, 26), run: async (x) => {
      const c = x.creature;
      if (!c) return;
      x.ambience.quiet = 1;
      await x.director.wait(2.5);
      const [sx, sz] = PATROLS.forestCross[0];
      c.spawn(sx, heightAt(sx, sz), sz, 'passive', PATROLS.forestCross);
      x.sfx((d) => S.branchSnap(x.audio, d), new THREE.Vector3(sx, 1, sz));
      let left = false;
      c.onLeave = () => (left = true);
      for (let i = 0; i < 40 && !left; i++) await x.director.wait(0.5);
      c.despawn();
      x.ambience.quiet = 0;
      x.setFlag('creatureSeen');
      await x.director.wait(1);
      await x.say('creatureSeen');
    } },
    { id: 'arriveRelay', when: (x) => x.stage === 7 && near(x, sp.relayBox, 9), run: (x) => x.setStage(8) },
    { id: 'relayFixed', when: () => false, run: async (x) => {
      x.setFlag('relayFixed');
      x.power('village', true);
      x.sfx((d) => S.powerUp(x.audio, d), sp.relayBox.position.clone());
      await x.director.wait(1.5);
      await x.say('relayFixed');
      x.setStage(9);
    } },
    { id: 'cxEnter', when: (x) => x.stage === 9 && x.world.indoorAt(x.player.pos)?.name === 'complex', run: (x) => {
      x.setFlag('cxEntered');
      x.setStage(10);
    } },
    { id: 'breakers', when: () => false, run: async (x) => {
      for (let i = 0; i < 3; i++) {
        levers[i].rotation.x = -0.6;
        x.sfx((d) => S.breaker(x.audio, d), sp.breakers.position.clone());
        await x.director.wait(0.45);
      }
      x.setFlag('cxPower');
      x.power('complex', true);
      x.sfx((d) => S.powerUp(x.audio, d));
      x.figures.place(x.figures.boothSitter, 5.95, 0.1, 14.5, 7.2, 14.5);
      await x.director.wait(1.5);
      await x.say('powerOn');
      x.setStage(11);
    } },
    { id: 'hunt', when: () => false, run: async (x) => {
      const c = x.creature;
      if (!c) return;
      x.setFlag('huntStarted');
      x.ambience.quiet = 1;
      await x.director.wait(1.2);
      // the lights die; the cell door is torn open
      x.sfx((d) => S.powerDown(x.audio, d));
      x.power('complex', false);
      await x.director.wait(1.6);
      x.sfx((d) => S.glassBreak(x.audio, d), new THREE.Vector3(45, 1.6, -168));
      x.sfx((d) => S.metalBang(x.audio, d, 1), g.door('cxCell').center());
      const cell = g.door('cxCell');
      cell.setLocked(false);
      cell.setOpen(true);
      x.setFlag('cellOpen');
      const cp = sp.cell.position;
      c.spawn(cp.x, cp.y, cp.z, 'hunt', PATROLS.hunt);
      c.awareness = 1;
      c.lastKnown.copy(x.player.pos);
      c.fsm.go('Chase');
      x.ambience.quiet = 0;
      x.setStage(12);
      await x.say('hunt');
      if (x.deaths >= 3) c.speedScale = 0.85; // assist after repeated deaths
    } },
    { id: 'huntTip', when: (x) => x.stage === 12 && x.zone() === 'forest', run: (x) => void x.say('huntTip') },
    { id: 'baseReached', when: (x) => x.stage === 12 && x.isSafeZone(x.player.pos.x, x.player.pos.z), run: async (x) => {
      x.setFlag('baseReached');
      for (const id of ['northGateL', 'northGateR']) {
        const d = g.door(id);
        d.setOpen(false);
        d.setLocked(true);
      }
      const c = x.creature;
      if (c) {
        // it stops at the edge of the light, watches, then is gone
        c.fsm.go('Search');
        await x.director.wait(6);
        c.despawn();
      }
      // the archive is open now
      const a = g.door('archiveDoor');
      a.setLocked(false);
      a.setOpen(true, true);
      await x.say('baseReached');
      x.setStage(13);
    } },
    { id: 'archiveSeen', when: (x) => x.stage === 13 && near(x, g.door('archiveDoor').center(), 4), run: (x) => void x.say('archiveOpen') },
    { id: 'final', when: () => false, run: async (x) => {
      x.player.frozen = true;
      x.player.lookAt(sp.radio.getWorldPosition(new THREE.Vector3()), 2.5);
      x.ambience.quiet = 1;
      x.ambience.rainLevel = 0.4;
      await x.say('final');
      x.fadeTo(1, 4);
      x.sfx((d) => S.drone(x.audio, d, 9, 41));
      await x.director.wait(4.5);
      x.setStage(14, false);
      x.endEpisode();
    } },
  ];

  return {
    beats,
    onRead: (docId) => {
      if (docId === 'shiftJournal' && g.stage === 11 && !g.flag('huntStarted')) {
        // the hunt starts once the player closes the journal
        const unsub = useGame.subscribe((s) => {
          if (!s.reading) {
            unsub();
            g.director.fire('hunt');
          }
        });
      }
    },
    reset: () => {
      g.figures.cctvMan.root.visible = false;
      g.figures.boothSitter.root.visible = false;
      g.figures.roadMan.root.visible = false;
      g.figures.windowMan.root.visible = false;
      ctx.dynamic.tracksGate.visible = false;
      levers.forEach((l) => (l.rotation.x = 0.6));
      passLed.material = g.world.M.redLed;
      g.ambience.quiet = 0;
      g.ambience.rainLevel = 1;
      void radioLed;
    },
    applyFlags: () => {
      if (g.flag('genOn')) g.power('base', true);
      if (g.flag('genFueled')) {
        const c = canisterId();
        if (c) {
          c.body.setEnabled(false);
          c.mesh.visible = false;
        }
      }
      if (g.flag('manVanish')) ctx.dynamic.tracksGate.visible = true;
      if (g.flag('relayFixed')) g.power('village', true);
      if (g.flag('cxPower') && !g.flag('huntStarted')) {
        g.power('complex', true);
        levers.forEach((l) => (l.rotation.x = -0.6));
        g.figures.place(g.figures.boothSitter, 5.95, 0.1, 14.5, 7.2, 14.5);
      }
      if (!g.door('cxEntrance').locked) passLed.material = g.world.M.greenLed;
      if (g.stage === 12 && g.creature) {
        // respawn the hunter far from the player, out of sight
        const p = g.player.pos;
        const pts = PATROLS.hunt.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z), z)).filter((v) => v.distanceTo(p) > 40);
        const s = pts[Math.floor(Math.random() * pts.length)] ?? new THREE.Vector3(34, 0, -144);
        g.creature.spawn(s.x, s.y, s.z, 'hunt', PATROLS.hunt);
        g.creature.fsm.go('Patrol');
        if (g.deaths >= 3) g.creature.speedScale = 0.85;
      }
    },
  };
}
