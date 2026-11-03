import { describe, it, expect } from 'vitest';
import { DialogueRunner } from '@/game/dialogue/DialogueRunner';
import type { DialogueContext } from '@/game/dialogue/types';
import { dialogueDoor } from '@/data/chapter01/dialogueDoor';
import type { FlagValue } from '@/game/state/types';

function ctx() {
  const flags: Record<string, FlagValue> = {};
  const knowledge = new Set<string>();
  const events: string[] = [];
  const records: string[] = [];
  const c: DialogueContext = {
    flag: (k) => flags[k],
    setFlag: (k, v) => (flags[k] = v),
    has: () => false,
    knows: (k) => knowledge.has(k),
    learn: (k) => knowledge.add(k),
    relation: () => {},
    record: (_id, label) => records.push(label),
    emit: (e) => events.push(e),
  };
  return { c, flags, knowledge, events, records };
}

describe('door dialogue (Chapter 01 decision)', () => {
  it('every node reference resolves', () => {
    for (const n of Object.values(dialogueDoor.nodes)) {
      if (n.next) expect(dialogueDoor.nodes[n.next], `${n.id}.next`).toBeDefined();
      for (const ch of n.choices ?? []) expect(dialogueDoor.nodes[ch.next], `${n.id} → ${ch.id}`).toBeDefined();
    }
  });

  it('refusing leads to the "closed" outcome and records the choice', () => {
    const t = ctx();
    const r = new DialogueRunner(dialogueDoor, t.c).start();
    expect(r.choose('what')).toBe(true);
    expect(r.choose('sergey')).toBe(true);
    expect(r.node?.id).toBe('n_si');
    r.tick(5); // auto-advance
    expect(r.node?.id).toBe('n_ask');
    expect(t.events).toContain('deadMessage');
    expect(r.choose('refuse')).toBe(true);
    r.advance();
    r.tick(5);
    expect(r.outcome).toBe('closed');
    expect(t.flags.door).toBe('closed');
    expect(t.records).toContain('Вы не открыли дверь.');
  });

  it('the "she died" option only appears after the message is known', () => {
    const t = ctx();
    const r = new DialogueRunner(dialogueDoor, t.c).start();
    r.choose('what');
    r.choose('empty48');
    r.tick(5);
    expect(r.view()!.choices.map((c) => c.id)).not.toContain('dead');
    t.knowledge.add('galinaDead');
    expect(r.view()!.choices.map((c) => c.id)).toContain('dead');
    r.choose('dead');
    r.tick(4);
    expect(r.node?.id).toBe('n_dead2');
    expect(r.view()!.speaker).toBe('Голос');
  });

  it('opening immediately is possible and ends with "open"', () => {
    const t = ctx();
    const r = new DialogueRunner(dialogueDoor, t.c).start();
    r.choose('open');
    expect(r.outcome).toBe('open');
    expect(t.flags['dlg.door.outcome']).toBe('open');
  });

  it('rejects unavailable choices', () => {
    const t = ctx();
    const r = new DialogueRunner(dialogueDoor, t.c).start();
    expect(r.choose('dead')).toBe(false);
  });
});
