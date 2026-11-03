import type { Beat } from '@/game/narrative/Director';
import type { Game } from '@/game/Game';
import { useUI } from '@/game/state/ui';
import * as S from '@/game/audio/synth';
import { T } from './texts';
import { strange } from './progress';
import { dialogueDoor } from '@/data/chapter01/dialogueDoor';
import { MY_NUMBER } from '@/data/chapter01/initialState';
import * as THREE from 'three';

export const CLOCK_0317 = 3 * 60 + 17;

/** Player isn't busy with a modal (reading, dialogue, call, peephole, cutscene). */
export const free = () => {
  const u = useUI.getState();
  return !u.dialogue && !u.reader && !u.incomingCall && !u.peephole && !u.cutscene && !u.paused;
};
const inApt = (g: Game) => ['hall', 'room', 'kitchen', 'bath', 'closet'].includes(g.room());
const unreadMe = (g: Game) => g.s.phone.threads.find((t) => t.id === 'me')!.unread;
const pos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

export const MSG1 = 'Влад, если ты это читаешь, значит, всё началось заново.';
export const MSG2 = 'На этот раз, пожалуйста, не открывай дверь.';

export const beats: Beat<Game>[] = [
  // =================================================== STAGE 0 — ordinary night
  {
    id: 'b0_intro',
    stage: 0,
    when: () => true,
    run: async (g) => {
      await g.fade(0, 2600);
      g.say(T.intro[0], 2.2);
      await g.wait(2.4);
      g.say(T.intro[1], 3);
      await g.wait(3.2);
      g.objective(T.objective0);
      g.checkpoint();
    },
  },
  {
    id: 'b0_end',
    stage: 0,
    when: (g) => {
      const n = Number(g.flag('routineCount') || 0);
      const t = g.director.stageTime;
      return free() && ((!!g.flag('drank') && n >= 3 && t > 70) || (n >= 5 && t > 50) || t > 240);
    },
    run: async (g) => {
      g.s.setStage(1);
      g.objective(null);
      g.setWorld('mirrorLag', 0.6);
      g.checkpoint();
    },
  },

  // =================================================== STAGE 1 — first strangeness
  {
    id: 'b1_clock',
    stage: 1,
    when: () => true,
    run: (g) => g.unseen('microwave', '0317', pos(g.apt.props.microwave)),
  },
  {
    id: 'b1_wall',
    stage: 1,
    when: (g) => g.director.stageTime > 8 && free() && ['room', 'bath', 'hall'].includes(g.room()),
    run: async (g) => {
      const a = g.apt.anchors.wall48;
      g.sfx(a, (e, d) => S.drag(e, d, 1.8), 4);
      await g.wait(2.2);
      g.sfx(a, (e, d) => S.thump(e, d, 1), 3);
      await g.wait(0.7);
      g.sfx(a, (e, d) => S.thump(e, d, 0.8), 3);
      await g.wait(1.6);
      g.say(T.wallSounds, 4.5);
      g.learn('sounds48');
      strange(g, 'wall');
      g.objective(T.objective1);
    },
  },
  {
    id: 'b1_photo',
    stage: 1,
    when: (g) => g.director.stageTime > 25,
    run: (g) => g.unseen('photoFaceDown', true, pos(g.apt.photoFrame)),
  },
  {
    id: 'b1_tv',
    stage: 1,
    when: (g) => g.director.stageTime > 45 && free() && g.room() === 'room' && !g.looking(g.apt.anchors.tv, 6, 0.6),
    run: async (g) => {
      g.sfx(g.apt.anchors.tv, (e, d) => S.click(e, d, 0.7));
      g.setWorld('tv', g.engine.preset.tvLive ? 'live' : 'static');
      // wait until the player turns to see it, then let it play
      for (let i = 0; i < 40 && !g.looking(g.apt.anchors.tv, 4, 0.85); i++) await g.wait(0.5);
      await g.wait(1.2);
      if (g.looking(g.apt.anchors.tv, 4.5, 0.8)) {
        g.say(T.tvLive, 5);
        strange(g, 'tv');
        g.learn('tvLive');
      }
      await g.wait(5);
      g.setWorld('tv', 'static');
      await g.wait(3);
      g.sfx(g.apt.anchors.tv, (e, d) => S.click(e, d, 0.7));
      g.setWorld('tv', 'off');
    },
  },
  {
    id: 'b1_polaroid',
    stage: 1,
    when: (g) => g.director.stageTime > 75 || !!g.flag('strange.mirror'),
    run: (g) => g.unseen('polaroid', 'door', pos(g.apt.polaroid)),
  },
  {
    id: 'b1_closet',
    stage: 1,
    when: (g) => g.director.stageTime > 100,
    run: async (g) => {
      g.unseen('closetAjar', true, pos(g.apt.doors.closet.leaf));
      for (let i = 0; i < 400; i++) {
        await g.wait(0.5);
        if (g.world('closetAjar') && !g.apt.doors.closet.open && g.looking(pos(g.apt.doors.closet.leaf), 4.5, 0.85) && free()) {
          g.say(T.closetAjar, 4);
          strange(g, 'closet');
          return;
        }
        if (g.s.stage !== 1) return;
      }
    },
  },
  {
    id: 'b1_upstairs',
    stage: 1,
    when: (g) => g.director.stageTime > 60 && inApt(g),
    run: async (g) => {
      for (let i = 0; i < 6; i++) {
        g.sfx({ x: 1.0 + i * 0.5, y: 3.6, z: 3 + i * 0.3 }, (e, d) => S.thump(e, d, 0.35), 2);
        await g.wait(0.7);
      }
    },
  },
  {
    id: 'b1_end',
    stage: 1,
    when: (g) => free() && ((Number(g.flag('strangeCount') || 0) >= 3 && g.director.stageTime > 80) || g.director.stageTime > 260),
    run: async (g) => {
      g.setWorld('mirrorLag', 0);
      g.s.setStage(2);
      g.checkpoint();
    },
  },

  // =================================================== STAGE 2 — 03:17
  {
    id: 'b2_msg1',
    stage: 2,
    when: () => free(),
    run: async (g) => {
      g.setClock(CLOCK_0317);
      g.setFlag('clockFrozen', true);
      g.setFlag('silentWorld', true);
      g.receive('me', MSG1);
      g.objective(T.objective2);
    },
  },
  {
    id: 'b2_msg1_read',
    stage: 2,
    when: (g) => g.director.fired('b2_msg1') && g.director.since('b2_msg1') > 0.5 && unreadMe(g) === 0,
    run: async (g) => {
      await g.wait(0.8);
      g.say(T.phoneMine, 3);
      g.learn('ownNumber');
      g.music((e, d) => S.drone(e, d, 22, 55));
    },
  },
  {
    id: 'b2_msg2',
    stage: 2,
    when: (g) => g.director.since('b2_msg1_read') > 6 || g.director.since('b2_msg1') > 50,
    run: async (g) => {
      g.receive('me', MSG2);
      g.learn('dontOpen');
      g.objective(null);
    },
  },
  {
    id: 'b2_recording',
    stage: 2,
    when: (g) => g.director.since('b2_msg2') > 14,
    run: (g) => {
      g.s.addCall({ contact: MY_NUMBER, dir: 'out', time: '03:17', duration: '0:47' });
      g.s.addRecording({
        id: 'r_self',
        title: 'Новая запись',
        date: 'сегодня, 03:17',
        duration: 47,
        kind: 'self',
        isNew: true,
        transcript: [
          { t: 0, text: '[дождь, шорох ткани]' },
          { t: 3, text: '— …если ты это слушаешь — значит, опять четырнадцатое.' },
          { t: 9, text: '— Не верь голосу за дверью. Он знает, как нас зовут.' },
          { t: 16, text: '— В прошлый раз я открыл.' },
          { t: 20, text: '[неразборчиво]' },
          { t: 24, text: '— …она тоже стучала. Три раза. Год назад.' },
          { t: 31, text: '— Я тогда не открыл. Тогда — не открыл.' },
          { t: 37, text: '[три удара]' },
          { t: 41, text: '— …они все слышали. Весь этаж. И все молчат.' },
          { t: 46, text: '[запись обрывается]' },
        ],
      });
      const dreams = g.s.phone.notes.find((n) => n.id === 'n_dreams')!;
      g.s.updateNote('n_dreams', { body: dreams.body + '\n\n4. сегодня.' });
      g.learn('recording');
    },
  },
  {
    id: 'b2_note',
    stage: 2,
    when: (g) => g.director.since('b2_msg2') > 26 && free(),
    run: async (g) => {
      g.sfx(g.apt.anchors.frontDoorIn, (e, d) => S.paperSlide(e, d), 3);
      g.setWorld('noteDoor', 'v1');
      await g.wait(1.2);
      g.say(g.room() === 'hall' ? T.noteSound : 'В прихожей что-то зашуршало.', 3);
    },
  },
  {
    id: 'b2_noteChange',
    when: (g) => !!g.flag('readNote') && g.s.stage <= 3,
    run: (g) => g.unseen('noteDoor', 'v2', g.apt.noteDoor.position),
  },
  {
    id: 'b2_bulb',
    stage: 2,
    when: (g) => g.director.since('b2_note') > 10 && (!!g.flag('readNote') || g.director.since('b2_note') > 40) && free(),
    run: async (g) => {
      const l = g.lamps.hall;
      if (g.world('light.hall')) {
        l.flicker = 1;
        g.sound?.level('lampBuzz', 0.05, 0.1);
        await g.wait(2.6);
        g.sound?.level('lampBuzz', 0, 0.05);
        g.sfx({ x: 3.8, y: 2.45, z: 1.5 }, (e, d) => S.bulbPop(e, d));
        l.flicker = 0;
      }
      g.setWorld('hallDead', true);
      await g.wait(1);
      if (g.room() === 'hall' || g.world('light.hall')) g.say(T.bulb, 2.5);
      if (!useUI.getState().flashlight) {
        await g.wait(3);
        g.say(T.flashlightHint, 3);
      }
    },
  },
  {
    id: 'b2_call',
    stage: 2,
    when: (g) => g.director.since('b2_bulb') > 14 && free(),
    run: async (g) => {
      const r = await g.incomingCall('Скрытый номер', 'Номер скрыт');
      if (r === 'answered') {
        g.setFlag('answeredCall', true);
        g.s.record('ch1.call', 'Вы ответили на звонок со скрытого номера.');
        g.sfx(null, (e, d) => S.breathing(e, d, 9), 10);
        g.sound?.level('tv', 0.08, 0.5);
        for (const line of T.callAnswered) {
          g.say(line, 2.8);
          await g.wait(2.9);
        }
        g.sound?.level('tv', 0, 0.2);
        g.hangUp();
        g.sfx(null, (e, d) => S.uiTick(e, d, 500));
        g.learn('callerTV');
      } else {
        g.setFlag('declinedCall', true);
        g.s.record('ch1.call', 'Вы не ответили на звонок со скрытого номера.');
        await g.wait(2.5);
        g.receive('me', 'Правильно. Не отвечай ему.');
      }
      g.director.mark('callDone');
    },
  },
  {
    id: 'b2_intercom',
    stage: 2,
    when: (g) => g.director.since('callDone') > 14 && free(),
    run: async (g) => {
      g.setFlag('intercomRinging', true);
      const a = g.apt.anchors.intercom;
      for (let i = 0; i < 9 && !g.flag('intercomPicked'); i++) {
        g.sfx(a, (e, d) => S.intercomBuzz(e, d, 1.1), 2);
        await g.wait(2.6);
      }
      g.setFlag('intercomRinging', false);
      if (g.flag('intercomPicked')) {
        g.sfx(a, (e, d) => S.doorLatch(e, d), 2);
        g.sfx(null, (e, d) => S.breathing(e, d, 5), 6);
        for (const l of T.intercomAnswered) {
          g.say(l, 3);
          await g.wait(3);
        }
        g.s.record('ch1.intercom', 'Вы сняли трубку домофона.');
        g.learn('intercom47');
      }
      g.director.mark('intercomDone');
    },
  },
  {
    id: 'b2_elevator',
    stage: 2,
    when: (g) => g.director.since('intercomDone') > 6,
    run: async (g) => {
      g.sfx({ x: 8.5, y: -9, z: -2 }, (e, d) => S.doorSlam(e, d), 3); // entrance door, far below
      await g.wait(4);
      g.sfx(g.land.anchors.elevatorShaft, (e, d) => S.elevatorRun(e, d, 7, true), 12);
      await g.wait(8.2);
      g.setWorld('elevator', 'here');
      g.say(T.elevatorArrive, 3);
      await g.wait(4);
      g.say(T.noSteps, 2.5);
    },
  },
  {
    id: 'b2_end',
    stage: 2,
    when: (g) => g.director.since('b2_elevator') > 16 && free(),
    run: (g) => {
      g.s.setStage(3);
      g.checkpoint();
    },
  },

  // =================================================== STAGE 3 — the door
  {
    id: 'b3_start',
    stage: 3,
    when: () => free(),
    run: async (g) => {
      g.setWorld('rain', 0); // the rain stops mid-drop
      g.setWorld('elevator', 'away');
      await g.wait(3);
      g.knock(g.apt.anchors.frontDoorOut, 3, 1);
      await g.wait(2.4);
      g.say(T.knocks, 2.5);
      g.objective(T.objective3);
    },
  },
  {
    id: 'b3_dialogue',
    stage: 3,
    when: (g) => g.director.since('b3_start') > 3 && free() && (!!g.flag('approachDoor') || (g.room() === 'hall' && g.dist(g.apt.anchors.frontDoorIn) < 1.55)),
    run: async (g) => {
      g.setFlag('dlgStarted', true);
      g.objective(null);
      await g.cutsceneLook({ x: 3.8, y: 1.5, z: 0 }, 1.2, { x: 3.8, z: 0.95 });
      useUI.setState({ cutscene: true });
      const out = g.apt.anchors.frontDoorOut;
      const outcome = await g.runDialogue(dialogueDoor, (ev, payload) => {
        const p = (payload ?? {}) as { dur?: number; low?: boolean };
        if (ev === 'voice') g.sfx(out, (e, d) => S.murmur(e, d, p.dur ?? 3, p.low ? 180 : 225, 900, 0.55), (p.dur ?? 3) + 2);
        if (ev === 'voiceChange') {
          g.music((e, d) => S.sting(e, d));
          g.sfx(out, (e, d) => S.murmur(e, d, 3.4, 118, 700, 0.7), 6);
        }
        if (ev === 'deadMessage' && !g.flag('deadMsg')) {
          g.setFlag('deadMsg', true);
          setTimeout(() => {
            g.receive('me', 'Галина Петровна умерла в марте. Ты нёс венок.');
            g.learn('galinaDead');
            g.refreshDialogue();
          }, 1800);
        }
        if (ev === 'peephole') {
          setTimeout(async () => {
            useUI.setState({ cutscene: false });
            await g.peephole();
            useUI.setState({ cutscene: true });
            g.dialogueChoose('back');
          }, 60);
        }
      });
      useUI.setState({ cutscene: false });
      g.s.setStage(4);
      g.setFlag('door', outcome === 'open' ? 'opened' : 'closed');
      g.s.setCharacter('voice', { met: true, status: g.knows('voiceChanged') ? 'not-galina' : 'unknown' });
    },
  },

  // =================================================== STAGE 4A — the door stays closed
  {
    id: 'a_neighbour',
    stage: 4,
    when: (g) => g.flag('door') === 'closed',
    run: async (g) => {
      await g.wait(2);
      for (let i = 0; i < 6; i++) {
        const x = 3.8 + (i / 5) * 2.2;
        g.sfx({ x, y: 0.1, z: -0.8 }, (e, d) => S.footstep(e, d, 'concrete', 0.8), 2);
        await g.wait(0.62);
      }
      await g.wait(1.5);
      g.knock(g.land.anchors.door46, 3, 0.85);
      await g.wait(4);
      g.sfx(g.land.anchors.door46, (e, d) => S.doorLatch(e, d, true), 3);
      g.sfx(g.land.anchors.door46, (e, d) => S.creak(e, d, 1.2, 0.7), 3);
      await g.wait(1.2);
      g.sfx(g.land.anchors.door46, (e, d) => S.murmur(e, d, 2.2, 230, 800, 0.45), 4);
      g.say('…Ой. Это ты? А я думала…', 3.2, 'Галина Петровна');
      await g.wait(3);
      g.sfx(g.land.anchors.door46, (e, d) => S.doorSlam(e, d), 3);
      g.s.record('ch1.46', 'Дверь сорок шестой открылась. Опечатанная дверь.');
      await g.wait(5);
      g.sfx(null, (e, d) => S.powerDown(e, d));
      g.setWorld('power', false);
      await g.wait(1.5);
      g.say(T.powerOut, 3);
      if (!useUI.getState().flashlight) {
        await g.wait(3.2);
        g.say(T.flashlightHint, 3);
      }
      await g.wait(4);
      g.receive('me', 'Спасибо. В этот раз открыла она.');
      g.objective(T.objectiveA);
      g.unseen('polaroid', 'neighbor', pos(g.apt.polaroid));
      g.unseen('jacket', false, pos(g.apt.jacket.children[0]));
      for (let i = 0; i < 50 && unreadMe(g) > 0; i++) await g.wait(0.5);
      await g.wait(6);
      g.sfx(g.apt.anchors.frontDoorIn, (e, d) => S.doorLatch(e, d), 3);
      g.say(T.lockClick, 3);
      g.objective(null);
      g.checkpoint();
    },
  },
  {
    id: 'a_end',
    stage: 4,
    when: (g) => g.flag('door') === 'closed' && g.director.since('a_neighbour') > 30 && (!!g.flag('sawNoJacket') || g.director.since('a_neighbour') > 200) && free(),
    run: async (g) => {
      await g.wait(2.5);
      await g.fade(1, 3000);
      g.end('closed');
    },
  },

  // =================================================== STAGE 4B — the door is opened
  {
    id: 'b_open',
    stage: 4,
    when: (g) => g.flag('door') === 'opened',
    run: async (g) => {
      g.sfx(g.apt.anchors.frontDoorIn, (e, d) => S.doorLatch(e, d, true), 3);
      g.sfx(g.apt.anchors.frontDoorIn, (e, d) => S.creak(e, d, 1.4, 0.6), 3);
      g.setWorld('door.front', true);
      g.setWorld('footprints', true);
      await g.wait(2);
      g.say(T.never, 2.5);
      await g.wait(3);
      g.objective(T.objectiveB);
      g.checkpoint();
    },
  },
  {
    id: 'b_elevator',
    stage: 4,
    when: (g) => g.flag('door') === 'opened' && g.director.since('b_open') > 4 && (g.room() === 'landing' || !!g.flag('calledElevator') || g.director.since('b_open') > 45),
    run: async (g) => {
      await g.wait(g.flag('calledElevator') ? 0.5 : 5);
      g.setWorld('elevator', 'coming');
      g.sfx(g.land.anchors.elevatorShaft, (e, d) => S.elevatorRun(e, d, 6, true), 10);
      await g.wait(7.2);
      g.setWorld('elevator', 'open');
      await g.wait(1.5);
      g.say('Лифт. Приехал сам.', 2.5);
    },
  },
  {
    id: 'b_48voice',
    stage: 4,
    when: (g) => g.room() === 'apt48',
    run: async (g) => {
      await g.wait(2.5);
      g.sfx({ x: -1.0, y: 1.3, z: 3.4 }, (e, d) => S.murmur(e, d, 1.2, 250, 1100, 0.35), 3);
      await g.wait(1.4);
      g.say('…Влад?', 2.4, '???');
      g.learn('voiceIn48');
      g.s.record('ch1.voice48', 'В квартире 48 кто-то назвал вас по имени.');
      await g.wait(3.5);
      g.setWorld('light.apt48', false);
    },
  },
  {
    id: 'b_end',
    stage: 4,
    when: (g) => g.flag('door') === 'opened' && g.world('elevator') === 'open' && g.room() === 'elevator' && g.player.z < -3.35 && free(),
    run: async (g) => {
      g.setWorld('elevator', 'inside');
      g.s.record('ch1.elevator', 'Вы вошли в лифт.');
      await g.wait(2);
      g.sfx(g.land.anchors.elevator, (e, d) => S.elevatorRun(e, d, 9, false), 12);
      const disp = g.land.elevator.display;
      for (const f of ['4', '3', '2', '1', '0', '-1', '—']) {
        disp.draw((c, w, h) => {
          c.fillStyle = '#050505';
          c.fillRect(0, 0, w, h);
          c.fillStyle = '#ff6a2a';
          c.font = `bold ${Math.floor(h * 0.7)}px monospace`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(f, w / 2, h / 2);
        });
        await g.wait(f === '0' ? 2.2 : 1.3);
      }
      await g.fade(1, 1500);
      // the doors open onto… home
      g.setWorld('elevator', 'away');
      g.setWorld('door.front', false);
      g.setWorld('footprints', false);
      g.setWorld('light.hall', false);
      g.setWorld('light.room', false);
      g.setWorld('light.kitchen', false);
      g.setWorld('light.desk', false);
      g.player.place(3.8, 1.6, 0, 0);
      await g.wait(1.5);
      await g.fade(0, 2200);
      await g.wait(1.5);
      g.knock(g.apt.anchors.frontDoorOut, 3, 1);
      await g.wait(3);
      g.say('Три удара. Снова.', 3);
      await g.wait(2);
      g.receive('me', 'Ты опять открыл.');
      await g.wait(5);
      await g.fade(1, 3000);
      g.end('opened');
    },
  },
];
