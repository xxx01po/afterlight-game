import { describe, expect, it } from 'vitest';
import { Inventory } from '@/smena/gameplay/Inventory';
import { MAX_SLOTS, ITEMS } from '@/smena/gameplay/items';
import { checksum, SaveSystem, validate, type SaveData } from '@/smena/save/SaveSystem';
import { MemoryKV } from '@/smena/save/idb';
import { Director } from '@/smena/story/Director';
import { DOCS, LINES, OBJECTIVES } from '@/smena/story/texts';
import { sanitize, DEFAULT_SETTINGS } from '@/smena/state/settings';
import { heightAt, roadDistance, ZONES } from '@/smena/world/layout';

describe('inventory', () => {
  it('limits slots, but keys and documents take none', () => {
    const inv = new Inventory();
    const slotItems = (Object.keys(ITEMS) as (keyof typeof ITEMS)[]).filter((k) => ITEMS[k].slot);
    let added = 0;
    for (const id of slotItems) added += inv.add(id) > 0 ? 1 : 0;
    expect(inv.slotsUsed()).toBe(Math.min(MAX_SLOTS, slotItems.length));
    expect(added).toBe(Math.min(MAX_SLOTS, slotItems.length));
    expect(inv.add('key_storage')).toBe(1);
    expect(inv.add('pass')).toBe(1);
  });
  it('caps stacks and keeps selection valid', () => {
    const inv = new Inventory();
    inv.add('medkit', 10);
    expect(inv.count('medkit')).toBe(ITEMS.medkit.stack);
    expect(inv.selected).toBe('medkit');
    while (inv.remove('medkit'));
    expect(inv.selected).toBe(null);
  });
  it('serializes and rejects garbage on load', () => {
    const inv = new Inventory();
    inv.add('battery', 2);
    const s = inv.serialize();
    const b = new Inventory();
    b.load({ items: { ...s.items, nonsense: 5 } as never, selected: 'nonsense' as never });
    expect(b.count('battery')).toBe(2);
    expect(b.selected).toBe('battery');
  });
});

function sample(): SaveData {
  return {
    v: 1, savedAt: 1, playTime: 12, seed: 42, stage: 7, flags: { genOn: 1 }, beats: ['intro'],
    player: { x: 1, y: 0, z: 2, yaw: 0.5, health: 80, stamina: 100, crouch: false },
    flashlight: { owned: true, on: false, battery: 55 },
    inv: { items: { fuse: 1 }, selected: null }, docs: ['rules'], taken: ['pk_fuse'], doors: { boothDoor: { open: true, locked: false } },
  };
}

describe('save system', () => {
  it('round-trips through storage with a checksum', async () => {
    const s = new SaveSystem(Promise.resolve(new MemoryKV()));
    await s.write('auto', sample());
    const d = await s.read('auto');
    expect(d?.stage).toBe(7);
    expect(d?.checksum).toBe(checksum(JSON.stringify({ ...d, checksum: undefined }).replace(',"checksum":undefined', '')) || d?.checksum);
  });
  it('detects tampering / corruption', async () => {
    const kv = new MemoryKV();
    const s = new SaveSystem(Promise.resolve(kv));
    await s.write('manual', sample());
    const raw = (await kv.get<SaveData>('save.manual'))!;
    raw.stage = 13;
    await kv.set('save.manual', raw);
    expect(await s.read('manual')).toBe(null);
  });
  it('rejects broken structures', () => {
    expect(validate(null)).toBe(false);
    expect(validate({ ...sample(), v: 99 })).toBe(false);
    expect(validate({ ...sample(), player: { ...sample().player, x: NaN } })).toBe(false);
    expect(validate({ ...sample(), player: { ...sample().player, health: 0 } })).toBe(false);
    expect(validate(sample())).toBe(true);
  });
  it('latest() picks the newest valid slot', async () => {
    const s = new SaveSystem(Promise.resolve(new MemoryKV()));
    await s.write('auto', { ...sample(), stage: 3 });
    await new Promise((r) => setTimeout(r, 5));
    await s.write('manual', { ...sample(), stage: 5 });
    expect((await s.latest())?.stage).toBe(5);
  });
});

describe('director', () => {
  it('fires beats once, waits in game time, and survives reset', async () => {
    const g = { x: 0, log: [] as string[] };
    const d = new Director(g, [
      { id: 'a', when: (s) => s.x > 0, run: async (s) => { s.log.push('a1'); await d.wait(1); s.log.push('a2'); } },
    ]);
    d.update(0.1);
    expect(g.log).toEqual([]);
    g.x = 1;
    d.update(0.1);
    d.update(0.5);
    await Promise.resolve();
    expect(g.log).toEqual(['a1']);
    d.update(0.6);
    await Promise.resolve();
    expect(g.log).toEqual(['a1', 'a2']);
    d.update(1);
    expect(g.log.length).toBe(2);
    d.reset([]);
    d.update(0.1);
    expect(g.log).toEqual(['a1', 'a2', 'a1']);
  });
});

describe('content', () => {
  it('every objective stage 0..14 has text and the final line is there', () => {
    for (let i = 0; i <= 14; i++) expect(OBJECTIVES[i]).toBeTruthy();
    expect(LINES.final.map((l) => l.text).join(' ')).toContain('Ты уверен, что сегодня твоя первая смена?');
  });
  it('documents are non-empty', () => {
    for (const d of Object.values(DOCS)) expect(d.body.length).toBeGreaterThan(40);
  });
});

describe('settings & layout', () => {
  it('sanitizes stored settings', () => {
    const s = sanitize({ master: 'x', lookSensitivity: 99, quality: 'ultra', invertY: true });
    expect(s.master).toBe(DEFAULT_SETTINGS.master);
    expect(s.lookSensitivity).toBe(3);
    expect(s.quality).toBe('auto');
    expect(s.invertY).toBe(true);
  });
  it('zones are flat and roads are drivable', () => {
    for (const z of Object.values(ZONES)) expect(Math.abs(heightAt(z.x, z.z))).toBeLessThan(1e-6);
    expect(roadDistance(-8, -50)).toBeLessThan(0);
  });
});
