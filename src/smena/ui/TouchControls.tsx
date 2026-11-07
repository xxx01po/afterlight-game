import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useGame } from '@/smena/state/game';
import { useSettings } from '@/smena/state/settings';
import { Icon, type IconName } from './icons';
import { ITEMS } from '@/smena/gameplay/items';
import type { Game } from '@/smena/Game';
import type { Action } from '@/smena/core/Input';

/**
 * On-screen controls. Buttons react on pointerdown (no 300 ms click delay) and
 * stop propagation, so a button press never starts a camera swipe; the joystick
 * floats wherever the thumb lands in the left zone.
 */
function TB({ icon, label, cls, style, onPress, active, count, aria }: { icon: IconName; label?: string; cls: string; style: CSSProperties; onPress: () => void; active?: boolean; count?: number; aria: string }) {
  const [down, setDown] = useState(false);
  return (
    <button
      className={`tbtn ${cls}${down ? ' down' : ''}${active ? ' on' : ''}`}
      style={style}
      aria-label={aria}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setDown(true);
        onPress();
      }}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
    >
      {Icon[icon]}
      {label && <span>{label}</span>}
      {count !== undefined && count > 0 && <span className="cnt">{count}</span>}
    </button>
  );
}

export function TouchControls({ game }: { game: Game }) {
  const knob = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const [joyOn, setJoyOn] = useState(false);
  const prompt = useGame((s) => s.prompt);
  const holding = useGame((s) => s.holding);
  const on = useGame((s) => s.flashlightOn);
  const owned = useGame((s) => s.flashlightOwned);
  const crouch = useGame((s) => s.crouching);
  const sprint = useGame((s) => s.sprinting);
  const selected = useGame((s) => s.selected);
  const inv = useGame((s) => s.inventory);
  const lefty = useSettings((s) => s.leftHanded);
  useEffect(() => {
    game.input.onJoy = (j) => {
      setJoyOn(j.active);
      if (base.current) {
        base.current.style.left = j.ox + 'px';
        base.current.style.top = j.oy + 'px';
      }
      if (knob.current) knob.current.style.transform = `translate(${j.x * 46}px, ${j.y * 46}px)`;
    };
    return () => {
      game.input.onJoy = undefined;
    };
  }, [game]);
  const press = (a: Action) => () => game.input.press(a);
  const side = (r: number): CSSProperties => (lefty ? { left: `calc(${r}px + var(--safe-l))` } : { right: `calc(${r}px + var(--safe-r))` });
  const selIcon = (selected ? ITEMS[selected].icon : 'hand') as IconName;
  const selCount = selected === 'flaregun' ? inv.find((i) => i.id === 'flare')?.n ?? 0 : inv.find((i) => i.id === selected)?.n;
  return (
    <div className="layer touch-layer" style={{ pointerEvents: 'none' }}>
      {!joyOn && <div className="joy-hint" style={lefty ? { left: 'auto', right: 'calc(9vw + var(--safe-r))' } : undefined} />}
      <div ref={base} className="joy-base" style={{ display: joyOn ? 'block' : 'none' }}>
        <div ref={knob} className="joy-knob" />
      </div>
      <TB icon={holding ? 'take' : 'hand'} cls={'big' + (prompt ? ' ready' : '')} aria="Действие" style={{ ...side(26), bottom: 'calc(30px + var(--safe-b))' }} onPress={press('interact')} />
      {(holding || selected) && <TB icon={holding ? 'use' : selIcon} cls="mid" aria={holding ? 'Бросить' : 'Использовать предмет'} label={holding ? 'бросок' : undefined} count={holding ? undefined : selCount} style={{ ...side(120), bottom: 'calc(22px + var(--safe-b))' }} onPress={press('use')} />}
      <TB icon="run" cls="mid" aria="Бег" active={sprint || game.input.sprintToggle} style={{ ...side(34), bottom: 'calc(124px + var(--safe-b))' }} onPress={() => (game.input.sprintToggle = !game.input.sprintToggle)} />
      <TB icon="crouch" cls="sm" aria="Присесть" active={crouch} style={{ ...side(112), bottom: 'calc(100px + var(--safe-b))' }} onPress={press('crouch')} />
      {owned && <TB icon="flashlight" cls="sm" aria="Фонарь" active={on} style={{ ...side(150), top: 'calc(64px + var(--safe-t))' }} onPress={press('flashlight')} />}
      <TB icon="bag" cls="sm" aria="Рюкзак" style={{ ...side(96), top: 'calc(64px + var(--safe-t))' }} onPress={press('inventory')} />
      <TB icon="journal" cls="sm" aria="Журнал" style={{ ...side(42), top: 'calc(64px + var(--safe-t))' }} onPress={press('journal')} />
    </div>
  );
}
