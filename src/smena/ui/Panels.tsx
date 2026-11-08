import { useState } from 'react';
import { useGame } from '@/smena/state/game';
import { DOCS } from '@/smena/story/texts';
import { ITEMS, MAX_SLOTS, type ItemId } from '@/smena/gameplay/items';
import { Icon, type IconName } from './icons';
import type { Game } from '@/smena/Game';

const stop = (e: React.PointerEvent) => e.stopPropagation();

export function Reader({ game }: { game: Game }) {
  const id = useGame((s) => s.reading);
  if (!id) return null;
  const d = DOCS[id];
  if (!d) return null;
  return (
    <div className="scrim" onPointerDown={stop} onClick={() => game.closeDoc()}>
      <div className={'paper' + (d.kind === 'photo' ? ' photo' : '')} role="dialog" aria-label={d.title} onClick={(e) => e.stopPropagation()}>
        <h3>{d.title}</h3>
        <pre>{d.body}</pre>
        <button className="close" onClick={() => game.closeDoc()}>
          Закрыть
        </button>
      </div>
    </div>
  );
}

export function Inventory({ game }: { game: Game }) {
  const open = useGame((s) => s.invOpen);
  const journal = useGame((s) => s.journalOpen);
  const items = useGame((s) => s.inventory);
  const selected = useGame((s) => s.selected);
  const docs = useGame((s) => s.docsRead);
  const [focus, setFocus] = useState<ItemId | null>(null);
  if (!open && !journal) return null;
  const slots = items.filter((i) => ITEMS[i.id].slot);
  const keys = items.filter((i) => !ITEMS[i.id].slot);
  const f = focus && items.find((i) => i.id === focus) ? ITEMS[focus] : selected ? ITEMS[selected] : null;
  const close = () => game.toggleInventory(false);
  return (
    <div className="scrim" onPointerDown={stop} onClick={close}>
      <div className="panel inv" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="tabs">
          <button className={'tab' + (!journal ? ' on' : '')} onClick={() => game.toggleInventory(true)}>
            Рюкзак {slots.length}/{MAX_SLOTS}
          </button>
          <button className={'tab' + (journal ? ' on' : '')} onClick={() => game.toggleInventory(true, true)}>
            Журнал · {docs.length}
          </button>
        </div>
        {!journal ? (
          <>
            <div className="inv-grid">
              {Array.from({ length: MAX_SLOTS }).map((_, i) => {
                const it = slots[i];
                if (!it) return <div key={i} className="slot empty" />;
                const def = ITEMS[it.id];
                return (
                  <button key={i} className={'slot' + (selected === it.id ? ' sel' : '')} aria-label={def.name} onClick={() => (setFocus(it.id), def.usable && game.inv.select(it.id), game.syncInventoryUI())}>
                    {Icon[def.icon as IconName]}
                    {it.n > 1 && <span className="n">×{it.n}</span>}
                  </button>
                );
              })}
            </div>
            <div className="inv-desc">
              {f ? (
                <>
                  <b>{f.name}</b>
                  {f.desc}
                </>
              ) : (
                'Пусто. Ценные вещи — в будке, на складе, в домах.'
              )}
            </div>
            {keys.length > 0 && (
              <div className="keyring">
                {keys.map((k) => (
                  <span key={k.id} onClick={() => setFocus(k.id)}>
                    {ITEMS[k.id].name}
                  </span>
                ))}
              </div>
            )}
            <div className="panel-actions">
              {f && f.usable && game.inv.has(f.id) && (
                <button
                  className="btn primary"
                  onClick={() => {
                    game.toggleInventory(false);
                    game.inv.select(f.id);
                    if (f.id !== 'flaregun') game.useItem(f.id);
                    game.syncInventoryUI();
                  }}
                >
                  {f.id === 'flaregun' ? 'Взять в руку' : 'Использовать'}
                </button>
              )}
              <button className="btn" onClick={close}>
                Закрыть
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="doclist">
              {docs.length === 0 && <p>Пока ничего. Записки, документы и фотографии появятся здесь.</p>}
              {docs.map((id) => (
                <button key={id} onClick={() => (game.toggleInventory(false), game.readDoc(id))}>
                  {DOCS[id]?.title}
                  <small>{DOCS[id]?.kind === 'photo' ? 'фотография' : DOCS[id]?.kind === 'note' ? 'записка' : 'документ'}</small>
                </button>
              ))}
            </div>
            <div className="panel-actions">
              <button className="btn" onClick={close}>
                Закрыть
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
