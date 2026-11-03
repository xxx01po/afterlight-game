import type { Dialogue, DialogueChoice } from '@/game/dialogue/types';

const G = 'Галина Петровна';

/** Shared final choices: the decision of the chapter. */
const decide = (extra: DialogueChoice[] = []): DialogueChoice[] => [
  ...extra,
  {
    id: 'open',
    text: '[Открыть дверь]',
    next: 'n_open',
    record: 'Вы открыли дверь.',
    effect: (c) => {
      c.setFlag('door', 'opened');
      c.relation('galina', 1);
    },
  },
  {
    id: 'refuse',
    text: '[Не открывать]',
    next: 'n_refuse',
    record: 'Вы не открыли дверь.',
    effect: (c) => {
      c.setFlag('door', 'closed');
      c.relation('galina', -1);
    },
  },
];

const deadChoice: DialogueChoice = {
  id: 'dead',
  text: '«Вы же… умерли. В марте».',
  next: 'n_dead',
  cond: (c) => c.knows('galinaDead') && !c.flag('dlg.door.dead'),
  record: 'Вы сказали голосу, что Галина Петровна умерла.',
  effect: (c) => c.learn('voiceChanged'),
};

/** Impulsive opening — available from the very first line. */
const openNow: DialogueChoice = {
  id: 'open',
  text: '[Открыть дверь]',
  next: 'n_open',
  record: 'Вы открыли дверь, не дослушав.',
  effect: (c) => c.setFlag('door', 'opened'),
};

const lastChoice: DialogueChoice = {
  id: 'last',
  text: '«Какой ещё прошлый раз?»',
  next: 'n_last',
  cond: (c) => !c.flag('dlg.door.last'),
};

/**
 * The voice behind the door. Muffled lines are rendered as unintelligible
 * speech-like sound; the words exist only in the subtitles.
 */
export const dialogueDoor: Dialogue = {
  id: 'door',
  start: 'n_start',
  nodes: {
    n_start: {
      id: 'n_start',
      speaker: G,
      muffled: true,
      text: 'Владик? Владик, ты не спишь? Это я, Галина Петровна. Из сорок шестой.',
      onEnter: (c) => c.emit('voice', { dur: 3.4 }),
      choices: [
        { id: 'what', text: '«Галина Петровна? Что случилось?»', next: 'n_what', effect: (c) => c.relation('galina', 1) },
        { id: 'silent', text: '[Промолчать]', next: 'n_silent' },
        { id: 'peep1', text: '[Посмотреть в глазок]', next: 'n_peep' },
        openNow,
      ],
    },
    n_silent: {
      id: 'n_silent',
      speaker: G,
      muffled: true,
      text: 'Владик, я же слышу, что ты там. Половица скрипнула.',
      onEnter: (c) => c.emit('voice', { dur: 2.6 }),
      auto: 3.6,
      next: 'n_what2',
    },
    n_what2: {
      id: 'n_what2',
      speaker: G,
      muffled: true,
      text: 'У меня свет пропал. Во всём стояке. А в сорок восьмой… ходит кто-то. Мне страшно одной.',
      onEnter: (c) => c.emit('voice', { dur: 4 }),
      choices: [
        { id: 'empty48', text: '«В сорок восьмой никто не живёт».', next: 'n_48', effect: (c) => c.learn('galina48') },
        { id: 'sergey', text: '«Позвоните Сергею Ильичу».', next: 'n_si' },
        { id: 'peep2', text: '[Посмотреть в глазок]', next: 'n_peep', cond: (c) => !c.flag('peeped') },
        openNow,
      ],
    },
    n_what: {
      id: 'n_what',
      speaker: G,
      muffled: true,
      text: 'Свет пропал, Владик. Во всём стояке. А в сорок восьмой… ходит кто-то. Я боюсь одна.',
      onEnter: (c) => c.emit('voice', { dur: 4 }),
      choices: [
        { id: 'empty48', text: '«В сорок восьмой никто не живёт».', next: 'n_48', effect: (c) => c.learn('galina48') },
        { id: 'sergey', text: '«Позвоните Сергею Ильичу».', next: 'n_si' },
        { id: 'peep2', text: '[Посмотреть в глазок]', next: 'n_peep', cond: (c) => !c.flag('peeped') },
        openNow,
      ],
    },
    n_48: {
      id: 'n_48',
      speaker: G,
      muffled: true,
      text: 'Как это не живёт? Алиночка же… Ой. Ну да. Ну да, Владик. Год уже.',
      onEnter: (c) => c.emit('voice', { dur: 3.6 }),
      auto: 4.4,
      next: 'n_ask',
    },
    n_si: {
      id: 'n_si',
      speaker: G,
      muffled: true,
      text: 'Звонила. Не берёт. Он ночью никогда не берёт — сам знаешь почему.',
      onEnter: (c) => {
        c.emit('voice', { dur: 3.2 });
        c.learn('sergeyNight');
      },
      auto: 4,
      next: 'n_ask',
    },
    n_peep: {
      id: 'n_peep',
      text: '',
      onEnter: (c) => {
        c.setFlag('peeped', true);
        c.emit('peephole');
      },
      // the game resumes the dialogue at n_after_peep when the peephole closes
      choices: [{ id: 'back', text: '…', next: 'n_after_peep' }],
    },
    n_after_peep: {
      id: 'n_after_peep',
      speaker: G,
      muffled: true,
      text: 'Ну что ты в глазок смотришь, Владик? Я же тут стою. Прямо перед тобой.',
      onEnter: (c) => {
        c.emit('voice', { dur: 3.4 });
        c.learn('peepEmpty');
      },
      auto: 4.2,
      next: 'n_ask',
    },
    n_ask: {
      id: 'n_ask',
      speaker: G,
      muffled: true,
      text: (c) => (c.flag('answeredCall') ? 'Открой, а? Ты ж мне сам только что звонил. Я посижу у тебя до утра. Как в прошлый раз.' : 'Открой, Владик. Я только посижу у тебя до утра. Как в прошлый раз.'),
      onEnter: (c) => {
        c.emit('voice', { dur: 3.8 });
        c.emit('deadMessage');
      },
      choices: decide([lastChoice, deadChoice]),
    },
    n_last: {
      id: 'n_last',
      speaker: G,
      muffled: true,
      text: 'Ну как же. Год назад. Ты мне сам открыл, мы чай пили, пока у Алиночки полиция ходила. Ты всё плакал. Говорил — это ты виноват.',
      onEnter: (c) => {
        c.emit('voice', { dur: 5.5 });
        c.learn('lastTime');
      },
      choices: decide([deadChoice]),
    },
    n_dead: {
      id: 'n_dead',
      speaker: G,
      muffled: true,
      text: '…',
      onEnter: (c) => c.emit('silence'),
      auto: 3.2,
      next: 'n_dead2',
    },
    n_dead2: {
      id: 'n_dead2',
      speaker: 'Голос',
      muffled: true,
      text: '(Голос за дверью опускается ниже. Становится похож на мой.)\nОткрой. Ты же в прошлый раз открыл.',
      onEnter: (c) => c.emit('voiceChange'),
      choices: decide(),
    },
    n_open: { id: 'n_open', text: '', end: 'open' },
    n_refuse: {
      id: 'n_refuse',
      speaker: 'Влад',
      text: '«Я не открою. Уходите».',
      next: 'n_refuse2',
    },
    n_refuse2: {
      id: 'n_refuse2',
      speaker: G,
      muffled: true,
      text: '…Ну как знаешь, Владик. Как знаешь.',
      onEnter: (c) => c.emit('voice', { dur: 2.2, low: true }),
      auto: 3.2,
      next: 'n_closed',
    },
    n_closed: { id: 'n_closed', text: '', end: 'closed' },
  },
};
