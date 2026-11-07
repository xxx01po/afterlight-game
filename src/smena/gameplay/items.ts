/** Item definitions. Every item has a purpose in the episode. */
export type ItemId =
  | 'flashlight'
  | 'walkie'
  | 'battery'
  | 'medkit'
  | 'key_storage'
  | 'key_archive'
  | 'fuse'
  | 'screwdriver'
  | 'pass'
  | 'flaregun'
  | 'flare'
  | 'canister'
  | 'fusebox_key';

export interface ItemDef {
  id: ItemId;
  name: string;
  desc: string;
  /** Takes an inventory slot (keys/docs are on the key ring / in the journal). */
  slot: boolean;
  stack: number;
  /** Can be "used" from the inventory or the USE button. */
  usable: boolean;
  icon: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  flashlight: { id: 'flashlight', name: 'Фонарь', desc: 'Старый армейский фонарь. Садит батарейки быстрее, чем хотелось бы.', slot: false, stack: 1, usable: false, icon: 'flashlight' },
  walkie: { id: 'walkie', name: 'Рация', desc: 'Портативная рация, канал 3 — диспетчер.', slot: false, stack: 1, usable: false, icon: 'radio' },
  battery: { id: 'battery', name: 'Батарейки', desc: 'Комплект батареек для фонаря. Полный заряд.', slot: true, stack: 4, usable: true, icon: 'battery' },
  medkit: { id: 'medkit', name: 'Аптечка', desc: 'Бинт, жгут, перекись. Восстанавливает здоровье.', slot: true, stack: 3, usable: true, icon: 'medkit' },
  key_storage: { id: 'key_storage', name: 'Ключ от склада', desc: 'Бирка: «СКЛАД №2».', slot: false, stack: 1, usable: false, icon: 'key' },
  key_archive: { id: 'key_archive', name: 'Ключ от архива', desc: 'Бирка: «АРХИВ. НЕ ВХОДИТЬ».', slot: false, stack: 1, usable: false, icon: 'key' },
  fusebox_key: { id: 'fusebox_key', name: 'Ключ-трёхгранник', desc: 'Открывает шкафы электрощитовых.', slot: false, stack: 1, usable: false, icon: 'key' },
  fuse: { id: 'fuse', name: 'Предохранитель', desc: 'Керамический предохранитель на 63 А. Для щитка ретранслятора.', slot: true, stack: 2, usable: false, icon: 'fuse' },
  screwdriver: { id: 'screwdriver', name: 'Отвёртка', desc: 'Крестовая, с изолентой на ручке.', slot: true, stack: 1, usable: false, icon: 'tool' },
  pass: { id: 'pass', name: 'Пропуск «Кедр-7»', desc: 'Магнитный пропуск. На фото — ты. Дата выдачи: 14.11.1986.', slot: false, stack: 1, usable: false, icon: 'card' },
  flaregun: { id: 'flaregun', name: 'Ракетница', desc: 'Сигнальный пистолет. Яркая вспышка отпугивает… что угодно.', slot: true, stack: 1, usable: true, icon: 'gun' },
  flare: { id: 'flare', name: 'Сигнальные патроны', desc: 'Патроны для ракетницы.', slot: true, stack: 6, usable: false, icon: 'ammo' },
  canister: { id: 'canister', name: 'Канистра', desc: 'Дизель.', slot: false, stack: 1, usable: false, icon: 'canister' },
};

export const MAX_SLOTS = 6;
