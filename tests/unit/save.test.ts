import { describe, it, expect } from 'vitest';
import { SaveSystem } from '@/game/save/SaveSystem';
import { createStoryStore, snapshot, SAVE_VERSION } from '@/game/state/story';
import { chapter01Initial } from '@/data/chapter01/initialState';

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe('story store + save system', () => {
  it('round-trips the full story state', () => {
    const st = createStoryStore(chapter01Initial());
    const s = st.getState();
    s.setFlag('door', 'closed');
    s.addItem('key48');
    s.learn('galinaDead');
    s.setWorld('power', false);
    s.pushMessage('me', { from: 'them', text: 'hi' });
    s.queueUnseen({ key: 'jacket', value: false, pos: [1, 2, 3] });
    const io = mem();
    const saves = new SaveSystem(io);
    expect(saves.save(snapshot(st))).toBe(true);
    const f = saves.load()!;
    expect(f.state.flags.door).toBe('closed');
    expect(f.state.inventory).toContain('key48');
    expect(f.state.world.power).toBe(false);
    expect(f.state.pending[0].key).toBe('jacket');
    expect(f.state.phone.threads.find((t) => t.id === 'me')!.messages).toHaveLength(1);
    expect(f.meta.chapter).toBe('ch1');
  });

  it('ignores saves from another version and corrupt data', () => {
    const io = mem();
    const saves = new SaveSystem(io);
    io.setItem('afterlight.save.slot1', JSON.stringify({ meta: {}, state: { saveVersion: SAVE_VERSION - 1 } }));
    expect(saves.load()).toBeNull();
    io.setItem('afterlight.save.slot1', '{oops');
    expect(saves.load()).toBeNull();
  });

  it('works without storage (private mode)', () => {
    const saves = new SaveSystem(null);
    expect(saves.save(chapter01Initial())).toBe(false);
    expect(saves.load()).toBeNull();
  });

  it('unseen world changes apply only when resolved', () => {
    const st = createStoryStore(chapter01Initial());
    const s = st.getState();
    s.queueUnseen({ key: 'photoFaceDown', value: true, pos: [0, 0, 0] });
    expect(st.getState().world.photoFaceDown).toBe(false);
    st.getState().resolvePending('photoFaceDown');
    expect(st.getState().world.photoFaceDown).toBe(true);
    expect(st.getState().pending).toHaveLength(0);
  });

  it('messages to own number are marked unread and counted', () => {
    const st = createStoryStore(chapter01Initial());
    st.getState().pushMessage('me', { from: 'them', text: 'x' });
    expect(st.getState().phone.threads.find((t) => t.id === 'me')!.unread).toBe(1);
    st.getState().markRead('me');
    expect(st.getState().phone.threads.find((t) => t.id === 'me')!.unread).toBe(0);
  });
});
