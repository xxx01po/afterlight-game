import { ITEMS, MAX_SLOTS, type ItemId } from './items';

export interface InvState { items: Partial<Record<ItemId, number>>; selected: ItemId | null }

/**
 * Inventory rules (pure, unit-tested): limited slots for consumables/tools,
 * keys and documents don't take slots, stacks have caps.
 */
export class Inventory {
  items: Partial<Record<ItemId, number>> = {};
  selected: ItemId | null = null;
  onChange?: () => void;

  count(id: ItemId) {
    return this.items[id] ?? 0;
  }
  has(id: ItemId) {
    return this.count(id) > 0;
  }
  slotsUsed() {
    return (Object.keys(this.items) as ItemId[]).filter((k) => ITEMS[k].slot && this.count(k) > 0).length;
  }
  /** Returns how many were actually added (0 = no room). */
  add(id: ItemId, n = 1): number {
    const def = ITEMS[id];
    const cur = this.count(id);
    if (def.slot && cur === 0 && this.slotsUsed() >= MAX_SLOTS) return 0;
    const added = Math.max(0, Math.min(n, def.stack - cur));
    if (added > 0) {
      this.items[id] = cur + added;
      if (!this.selected && def.usable) this.selected = id;
      this.onChange?.();
    }
    return added;
  }
  canAdd(id: ItemId) {
    const def = ITEMS[id];
    const cur = this.count(id);
    if (cur >= def.stack) return false;
    return !(def.slot && cur === 0 && this.slotsUsed() >= MAX_SLOTS);
  }
  remove(id: ItemId, n = 1) {
    const cur = this.count(id);
    if (cur < n) return false;
    if (cur - n <= 0) {
      delete this.items[id];
      if (this.selected === id) this.selected = this.firstUsable();
    } else this.items[id] = cur - n;
    this.onChange?.();
    return true;
  }
  firstUsable(): ItemId | null {
    return ((Object.keys(this.items) as ItemId[]).find((k) => ITEMS[k].usable && this.count(k) > 0) ?? null) as ItemId | null;
  }
  select(id: ItemId | null) {
    if (id && !this.has(id)) return;
    this.selected = id;
    this.onChange?.();
  }
  /** Ordered list for the UI. */
  list(): { id: ItemId; n: number }[] {
    return (Object.keys(this.items) as ItemId[]).filter((k) => this.count(k) > 0).map((id) => ({ id, n: this.count(id) }));
  }
  serialize(): InvState {
    return { items: { ...this.items }, selected: this.selected };
  }
  load(s: InvState) {
    this.items = {};
    for (const [k, v] of Object.entries(s.items ?? {})) if (k in ITEMS && typeof v === 'number' && v > 0) this.items[k as ItemId] = Math.min(v, ITEMS[k as ItemId].stack);
    this.selected = s.selected && this.has(s.selected) ? s.selected : this.firstUsable();
    this.onChange?.();
  }
}
