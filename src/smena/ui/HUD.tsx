import { useEffect, useState } from 'react';
import { useGame } from '@/smena/state/game';
import { useSettings } from '@/smena/state/settings';
import { Icon } from './icons';
import type { Game } from '@/smena/Game';

const WHO: Record<string, string> = { disp: 'Рация', hero: '', echo: 'Рация', radio: '' };

export function HUD({ game, touch }: { game: Game; touch: boolean }) {
  const objective = useGame((s) => s.objective);
  const flash = useGame((s) => s.objectiveFlash);
  const health = useGame((s) => s.health);
  const battery = useGame((s) => s.battery);
  const stamina = useGame((s) => s.stamina);
  const noise = useGame((s) => s.noise);
  const owned = useGame((s) => s.flashlightOwned);
  const on = useGame((s) => s.flashlightOn);
  const prompt = useGame((s) => s.prompt);
  const subs = useGame((s) => s.subtitles);
  const toasts = useGame((s) => s.toasts);
  const fps = useGame((s) => s.fps);
  const showFps = useSettings((s) => s.showFps);
  const [dim, setDim] = useState(false);
  // the objective fades out after a while: the screen belongs to the world
  useEffect(() => {
    setDim(false);
    const t = setTimeout(() => setDim(true), 9000);
    return () => clearTimeout(t);
  }, [objective, flash]);
  const cells = Math.ceil(battery / 25);
  return (
    <div className="layer">
      {objective && (
        <div className={'hud-obj' + (dim ? ' dim' : '') + (flash ? ' flash' : '')} key={flash} onPointerDown={(e) => (e.stopPropagation(), setDim(false))}>
          <small>Задача</small>
          {objective}
        </div>
      )}
      <div className="hud-stat">
        {health < 100 && (
          <div className="meter" title="Здоровье">
            {Icon.heart}
            <div className={'bar' + (health < 35 ? ' low' : '')}>
              <i style={{ width: `${health}%` }} />
            </div>
          </div>
        )}
        {owned && (
          <div className="meter" title="Заряд фонаря" style={{ opacity: on ? 1 : 0.55 }}>
            {Icon.battery}
            <div className={'cells' + (battery < 18 ? ' low' : '')}>
              {[0, 1, 2, 3].map((i) => (
                <i key={i} className={i < cells ? 'f' : ''} />
              ))}
            </div>
          </div>
        )}
        {stamina < 99 && (
          <div className="meter" title="Выносливость">
            {Icon.stamina}
            <div className={'bar' + (stamina < 25 ? ' low' : '')}>
              <i style={{ width: `${stamina}%` }} />
            </div>
          </div>
        )}
        <div className="meter" title="Шум">
          {Icon.ear}
          <div className="noise">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} style={{ height: 3 + i * 1.6, background: noise > i / 5 ? (i > 2 ? '#c9483a' : '#d8d3c6') : undefined }} />
            ))}
          </div>
        </div>
      </div>
      <div className={'crosshair' + (prompt ? ' on' : '')} />
      {prompt && prompt.text && (
        <div className={'prompt' + (prompt.verb === 'locked' ? ' locked' : '')}>
          {!touch && <kbd>E</kbd>}
          {prompt.text}
        </div>
      )}
      <div className="subs" aria-live="polite">
        {subs.map((s) => (
          <div key={s.id} className={'sub ' + s.who}>
            {WHO[s.who] && <b>{WHO[s.who]}</b>}
            {s.text}
          </div>
        ))}
      </div>
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
      {showFps && <div className="fps">{fps.toFixed(0)} FPS · {game.engine.quality}</div>}
      <div className="hud-top-btns">
        <button className="icon-btn" aria-label="Пауза" onPointerDown={(e) => (e.stopPropagation(), e.preventDefault(), game.input.press('pause'))}>
          {Icon.pause}
        </button>
      </div>
    </div>
  );
}
