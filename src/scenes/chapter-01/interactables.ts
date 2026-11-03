import * as THREE from 'three';
import type { Game } from '@/game/Game';
import type { Interactable } from '@/game/interactions/types';
import type { Door } from '@/game/world/Door';
import * as S from '@/game/audio/synth';
import { T } from './texts';
import { routine, strange } from './progress';
import { useUI } from '@/game/state/ui';

const v3 = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

/** All interactive objects of Chapter 01 and what they do. */
export function chapter01Interactables(g: Game): Interactable[] {
  const A = g.apt, L = g.land, w = (k: string) => g.world(k);
  const list: Interactable[] = [];
  const add = (i: Interactable) => list.push(i);

  // ------------------------------------------------------------- doors
  const door = (id: string, d: Door, nameOpen: string, nameClose: string, opts: { locked?: () => string | null; after?: (open: boolean) => void; label?: () => string | null } = {}) =>
    add({
      id: 'door_' + id,
      objects: [d.leaf],
      label: () => opts.label?.() ?? (opts.locked?.() ? 'Осмотреть' : d.open ? nameClose : nameOpen),
      act: () => {
        const why = opts.locked?.();
        if (why) {
          g.say(why);
          g.sfx(v3(d.leaf), (e, dd) => S.doorLatch(e, dd));
          return;
        }
        const open = !d.open;
        g.setWorld(`door.${id}`, open);
        if (id === 'closet') g.setWorld('closetAjar', false);
        const pos = v3(d.leaf);
        if (d.o.sound === 'cabinet') g.sfx(pos, (e, dd) => S.creak(e, dd, 0.4, 1.8));
        else {
          g.sfx(pos, (e, dd) => S.doorLatch(e, dd, d.o.sound === 'front'));
          if (open) g.sfx(pos, (e, dd) => S.creak(e, dd, 0.7, d.o.sound === 'front' ? 0.7 : 1));
        }
        opts.after?.(open);
      },
    });
  door('bath', A.doors.bath, 'Открыть', 'Закрыть');
  door('room', A.doors.room, 'Открыть', 'Закрыть');
  door('closet', A.doors.closet, 'Открыть кладовку', 'Закрыть кладовку', {
    label: () => (w('closetAjar') && !A.doors.closet.open ? 'Открыть кладовку' : null),
  });
  door('wardL', A.doors.wardL, 'Открыть шкаф', 'Закрыть шкаф', { after: (o) => o && g.say(T.wardrobe) });
  door('wardR', A.doors.wardR, 'Открыть шкаф', 'Закрыть шкаф');
  door('d48', L.doors.d48, 'Открыть ключом «48»', 'Закрыть', {
    locked: () => (g.s.inventory.includes('key48') ? null : T.door48Locked),
    label: () => (L.doors.d48.open ? null : g.s.inventory.includes('key48') ? 'Открыть ключом «48»' : 'Дверь 48'),
    after: (o) => {
      if (o) {
        g.setWorld('light.apt48', true);
        g.setFlag('entered48', true);
        g.s.record('ch1.enter48', 'Вы открыли квартиру 48 ключом из своего стола.');
      }
    },
  });

  // front door: the chapter's decision lives here
  add({
    id: 'front',
    objects: [A.doors.front.leaf],
    label: () => {
      const st = g.s.stage;
      if (A.doors.front.open) return st >= 4 ? null : 'Закрыть';
      if (g.flag('door') === 'opened') return 'Открыть';
      if (st === 3 && !g.flag('dlgStarted')) return 'Подойти к двери';
      return 'Дверь';
    },
    act: () => {
      const st = g.s.stage;
      if (g.flag('door') === 'opened') {
        g.setWorld('door.front', !A.doors.front.open);
        g.sfx(A.anchors.frontDoorIn, (e, d) => S.doorLatch(e, d, true));
        return;
      }
      if (st === 3 && !g.flag('dlgStarted')) {
        g.setFlag('approachDoor', true);
        return;
      }
      g.say(g.flag('door') === 'closed' ? T.frontDoorNo : T.frontDoorEarly);
      g.sfx(A.anchors.frontDoorIn, (e, d) => S.doorLatch(e, d));
    },
  });
  add({
    id: 'peephole',
    objects: [A.props.peephole],
    range: 1.4,
    label: () => (A.doors.front.open || g.flag('dlgStarted') ? null : 'Посмотреть в глазок'),
    act: async () => {
      g.director.mark('peepholeUsed');
      await g.peephole();
      if (g.s.stage === 3) g.learn('peepEmpty');
    },
  });

  // ---------------------------------------------------------- switches
  const sw = (id: string, obj: THREE.Object3D, name: string) =>
    add({
      id: 'sw_' + id,
      objects: [obj],
      range: 1.6,
      label: () => `${w(`light.${id}`) ? 'Выключить' : 'Включить'} свет: ${name}`,
      act: () => {
        g.sfx(v3(obj), (e, d) => S.click(e, d));
        g.setWorld(`light.${id}`, !w(`light.${id}`));
        if (!w('power')) g.say('Щёлк. Ничего. Света нет во всей квартире.');
        else if (id === 'hall' && w('hallDead')) g.say('Щёлк. Ничего. Лампочка перегорела.');
        routine(g, 'light');
      },
    });
  sw('hall', A.props.swHall, 'прихожая');
  sw('bath', A.props.swBath, 'ванная');
  sw('room', A.props.swRoom, 'комната');
  sw('kitchen', A.props.swKitchen, 'кухня');
  add({
    id: 'deskLamp',
    objects: [A.props.deskLamp],
    label: () => (w('light.desk') ? 'Выключить лампу' : 'Включить лампу'),
    act: () => {
      g.sfx(v3(A.props.deskLamp), (e, d) => S.click(e, d, 1.3));
      g.setWorld('light.desk', !w('light.desk'));
    },
  });

  // ------------------------------------------------------- kitchen life
  add({
    id: 'glass',
    objects: [A.props.glass],
    label: () => (g.s.inventory.includes('glass') ? null : 'Взять стакан'),
    act: () => {
      g.s.addItem('glass');
      A.props.glass.visible = false;
      g.sfx(v3(A.props.glass), (e, d) => S.mallet(e, d, 2600, e.now, 0.03, 0.2));
    },
  });
  add({
    id: 'tap',
    objects: [A.props.tap],
    label: () => (g.flag('drank') && g.s.stage > 0 ? 'Кран' : g.s.inventory.includes('glass') ? 'Налить воды и выпить' : 'Попить из-под крана'),
    act: async () => {
      if (g.flag('drank') && g.s.stage > 0) {
        g.say('Пить не хочется.');
        return;
      }
      g.sound?.level('tap', 0.35, 0.1);
      await g.wait(2.2);
      g.sound?.level('tap', 0, 0.2);
      g.setFlag('drank', true);
      routine(g, 'water');
      g.say(g.s.inventory.includes('glass') ? 'Вода холодная. Пахнет железом.' : 'Из-под крана. Как в общаге.');
    },
  });
  add({
    id: 'kettle',
    objects: [A.props.kettle],
    label: () => (g.flag('kettleOn') ? null : 'Поставить чайник'),
    act: async () => {
      g.setFlag('kettleOn', true);
      routine(g, 'kettle');
      g.sfx(A.anchors.kettle, (e, d) => S.click(e, d, 0.8));
      g.sound?.level('kettle', 0.05, 3);
      await g.wait(6);
      g.sound?.level('kettle', 0.22, 6);
      await g.wait(9);
      g.sound?.level('kettle', 0, 0.3);
      g.sfx(A.anchors.kettle, (e, d) => S.click(e, d, 0.6));
      await g.wait(20);
      g.setFlag('kettleOn', false);
    },
  });
  add({
    id: 'fridge',
    objects: [A.props.fridgeDoor],
    label: () => (w('fridge') ? 'Закрыть холодильник' : 'Открыть холодильник'),
    act: () => {
      const o = !w('fridge');
      g.setWorld('fridge', o);
      g.sfx(A.anchors.fridge, (e, d) => (o ? S.drawer(e, d, true) : S.doorLatch(e, d)));
      if (o) {
        g.say(T.fridge);
        routine(g, 'fridge');
      }
    },
  });
  add({
    id: 'microwave',
    objects: [A.props.microwave],
    label: () => 'Часы',
    act: () => {
      const phoneT = g.clock;
      if (g.director.fired('b2_msg1')) g.say(T.microwaveFrozen);
      else if (w('microwave') === '0317') {
        g.say(T.microwave0317(phoneT));
        strange(g, 'clock');
      } else g.say(T.microwaveSync(phoneT));
    },
  });
  add({ id: 'calendar', objects: [A.props.calendar], label: () => 'Календарь', act: () => (g.say(T.calendar, 5), g.learn('date14')) });
  add({
    id: 'polaroid',
    objects: [A.polaroid],
    label: () => 'Снимок на холодильнике',
    act: async () => {
      if (w('polaroid') === 'neighbor') {
        await g.read('Снимок', T.polaroidNeighbor, 'polaroid', 'polaroidNeighbor');
        g.learn('polaroidNeighbor');
      } else {
        await g.read('Снимок', T.polaroid, 'polaroid', 'polaroid');
        strange(g, 'polaroid');
        g.learn('polaroid');
      }
    },
  });

  // ------------------------------------------------------------- room
  add({
    id: 'photo',
    objects: [A.photoFrame],
    label: () => (w('photoFaceDown') ? 'Поднять фотографию' : 'Фотография'),
    act: async () => {
      if (w('photoFaceDown')) {
        await g.read('Фотография', T.photoDown, 'photo', 'shelfBack');
        strange(g, 'photo');
        g.learn('promise');
      } else {
        await g.read('Фотография', T.photo, 'photo', 'shelfPhoto');
        routine(g, 'photo');
        g.learn('girlPhoto');
      }
    },
  });
  add({
    id: 'tv',
    objects: [A.props.tv, A.props.tvScreen],
    label: () => (w('tv') === 'off' ? 'Включить телевизор' : 'Выключить телевизор'),
    act: () => {
      g.sfx(A.anchors.tv, (e, d) => S.click(e, d, 0.7));
      if (!w('power')) return g.say('Не включается. Света нет.');
      const next = w('tv') === 'off' ? 'broadcast' : 'off';
      g.setWorld('tv', next);
      routine(g, 'tv');
    },
  });
  add({ id: 'laptop', objects: [A.props.laptop], label: () => 'Ноутбук', act: () => g.say(T.laptop) });
  add({
    id: 'carpet',
    objects: [A.props.wallCarpet],
    label: () => 'Ковёр',
    act: () => g.say(T.wallCarpet, 5),
  });
  add({
    id: 'drawer',
    objects: [A.props.drawer],
    label: () => (w('drawer') ? (w('key48') ? 'Взять ключ' : 'Задвинуть ящик') : 'Открыть ящик'),
    act: () => {
      const pos = v3(A.props.drawer);
      if (!w('drawer')) {
        g.setWorld('drawer', true);
        g.sfx(pos, (e, d) => S.drawer(e, d, true));
        if (!w('key48')) g.say(T.drawerEmpty);
      } else if (w('key48')) {
        g.setWorld('key48', false);
        g.s.addItem('key48');
        g.learn('key48');
        g.s.record('ch1.key48', 'Вы нашли ключ от квартиры 48.');
        g.sfx(pos, (e, d) => S.mallet(e, d, 3200, e.now, 0.04, 0.15));
        g.say(T.key48, 5);
      } else {
        g.setWorld('drawer', false);
        g.sfx(pos, (e, d) => S.drawer(e, d, false));
      }
    },
  });
  // bed: the sofa
  const sofa = g.builder.root.children.find((o) => (o as THREE.Mesh).isMesh && Math.abs(o.position.x - 0.5) < 0.01 && Math.abs(o.position.z - 4.2) < 0.01 && Math.abs(o.position.y - 0.21) < 0.01);
  if (sofa)
    add({
      id: 'bed',
      objects: [sofa],
      label: () => (g.s.stage === 0 ? 'Попробовать уснуть' : 'Диван'),
      act: async () => {
        if (g.s.stage !== 0 || g.flag('triedSleep')) return g.say(T.bedLater);
        g.setFlag('triedSleep', true);
        useCut(g, true);
        await g.fade(1, 1400);
        g.setClock(g.s.clockMin + 6);
        await g.wait(1.5);
        await g.fade(0, 1400);
        useCut(g, false);
        g.say(T.bedTry, 5);
        routine(g, 'bed');
      },
    });

  // windows
  const look = (id: string, anchor: THREE.Vector3, stand: { x: number; z: number }) =>
    add({
      id,
      objects: g.builder.root.children.filter((o) => o.userData.windowGlass && Math.abs(o.position.x - anchor.x) < 0.1),
      label: () => 'Посмотреть в окно',
      act: async () => {
        const st = g.s.stage;
        const lines = st === 0 ? T.window0 : st === 1 ? T.window1 : st === 2 ? T.window2 : T.window3;
        const p = g.cutsceneLook({ x: anchor.x + 2, y: -6, z: 18 }, 2.2 + lines.length * 2.2, stand);
        for (const l of lines) {
          g.say(l, 2.4);
          await g.wait(2.3);
        }
        await p;
        routine(g, 'window');
        g.director.mark('window_' + st);
      },
    });
  look('windowRoom', A.anchors.windowRoom, { x: 1.6, z: 6.15 });
  look('windowKitchen', A.anchors.windowKitchen, { x: 6.1, z: 5.4 });

  // ------------------------------------------------------------- hall
  add({
    id: 'jacket',
    objects: [A.jacket],
    label: () => 'Куртка',
    act: () => {
      g.say(T.jacket, 4.5);
      g.learn('wetJacket');
    },
  });
  // empty hook (ending A trigger lives in beats via flag)
  const hook = g.builder.root.children.find((o) => Math.abs(o.position.x - 4.53) < 0.01 && Math.abs(o.position.y - 1.72) < 0.01);
  if (hook)
    add({
      id: 'hook',
      objects: [hook],
      range: 2,
      label: () => (w('jacket') ? null : 'Крючок'),
      act: () => {
        g.say(T.jacketGone, 4);
        g.setFlag('sawNoJacket', true);
      },
    });
  add({ id: 'mail', objects: [A.props.mail], label: () => 'Почта', act: () => (g.say(T.mail, 6), g.learn('mail48')) });
  add({
    id: 'intercom',
    objects: [A.props.intercom],
    range: 1.6,
    label: () => (g.flag('intercomRinging') ? 'Снять трубку' : 'Домофон'),
    act: () => {
      if (g.flag('intercomRinging')) {
        g.setFlag('intercomPicked', true);
        return;
      }
      g.say(g.s.stage < 2 ? 'Домофон. Трубка липкая. Им пользуются только курьеры.' : 'Тишина в трубке. Даже гудка нет.');
    },
  });
  add({
    id: 'noteDoor',
    objects: [A.noteDoor],
    range: 2.2,
    label: () => 'Поднять записку',
    act: async () => {
      g.sfx(A.anchors.frontDoorIn, (e, d) => S.paper(e, d));
      const n = w('noteDoor') === 'v2' ? T.noteV2 : T.noteV1;
      await g.read(n.title, n.body, 'paper');
      g.sfx(A.anchors.frontDoorIn, (e, d) => S.paper(e, d, 0.3));
      if (w('noteDoor') === 'v2') {
        g.learn('noteV2');
        g.setFlag('readNoteV2', true);
        g.s.record('ch1.noteV2', 'Вы прочли записку управдома дважды. Она изменилась.');
      } else {
        g.learn('noteV1');
        g.setFlag('readNote', true);
      }
    },
  });
  add({ id: 'box48', objects: [A.props.box48], label: () => 'Коробка', act: () => (g.say(T.box48, 6), g.learn('box48')) });
  // books (shelf)
  const shelf = g.builder.root.children.find((o) => Math.abs(o.position.x - 1.95) < 0.01 && Math.abs(o.position.z - 2.4) < 0.01);
  if (shelf) add({ id: 'books', objects: [shelf], label: () => 'Книги', act: () => (g.say(T.books, 5), g.learn('dropout')) });

  // ---------------------------------------------------------- landing
  add({ id: 'panel', objects: [L.props.panel], label: () => 'Щиток', act: () => (g.say(T.panel, 5), g.learn('meter48')) });
  add({ id: 'seal46', objects: [L.props.seal46, L.doors.d46.leaf], label: () => 'Дверь 46', act: () => (g.say(T.seal46, 5), g.learn('seal46')) });
  add({ id: 'stairs', objects: [L.props.stairs], range: 3, label: () => 'Лестница вниз', act: () => g.say(T.stairs) });
  add({ id: 'sheet48', objects: [L.props.sheet48], label: () => 'Зеркало', act: () => (g.say(T.sheet48, 5), g.learn('mirrorCovered')) });
  add({
    id: 'flyer',
    objects: [L.flyer],
    label: () => 'Листовка',
    act: async () => {
      await g.read(T.flyer.title, T.flyer.body, 'flyer', 'flyer');
      g.learn('alinaMissing');
      g.s.record('ch1.flyer', 'Вы нашли листовку о пропавшей Алине Ковалёвой.');
      g.setFlag('readFlyer', true);
    },
  });
  add({
    id: 'elevatorButton',
    objects: [L.props.elevatorButton],
    range: 1.5,
    label: () => (g.flag('door') === 'opened' ? (w('elevator') === 'open' ? null : 'Вызвать лифт') : null),
    act: () => {
      g.sfx(v3(L.props.elevatorButton), (e, d) => S.click(e, d, 0.9));
      g.setFlag('calledElevator', true);
    },
  });
  return list;
}

function useCut(_g: Game, v: boolean) {
  useUI.setState({ cutscene: v });
}
