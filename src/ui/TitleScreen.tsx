import { useEffect, useRef, useState } from 'react';
import { SettingsPanel } from './Settings';
import { saves } from '@/game/save/SaveSystem';
import { IcHeadphones } from './icons';
import { formatClock } from '@/utils/math';

export function TitleScreen({ onStart, onContinue }: { onStart: () => void; onContinue: () => void }) {
  const [sheet, setSheet] = useState<'none' | 'settings' | 'about' | 'confirm'>('none');
  const meta = saves.meta();
  const canvas = useRef<HTMLCanvasElement>(null);

  // slow rain on dark glass behind the logo
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const drops = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), v: 0.15 + Math.random() * 0.5, l: 8 + Math.random() * 18 }));
    const resize = () => {
      c.width = innerWidth * Math.min(devicePixelRatio, 2);
      c.height = innerHeight * Math.min(devicePixelRatio, 2);
    };
    resize();
    addEventListener('resize', resize);
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.strokeStyle = 'rgba(160,175,190,0.35)';
      ctx.lineWidth = 1;
      for (const d of drops) {
        d.y += d.v * dt;
        if (d.y > 1.05) {
          d.y = -0.05;
          d.x = Math.random();
        }
        ctx.beginPath();
        ctx.moveTo(d.x * c.width, d.y * c.height);
        ctx.lineTo(d.x * c.width - 1, d.y * c.height + d.l);
        ctx.stroke();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="title">
      <canvas ref={canvas} className="rain" />
      <div className="window-glow" />
      <div className="hint-phones">
        <IcHeadphones /> лучше в наушниках
      </div>
      <div className="center">
        <h1 className="logo">
          <span className="flick">AFTERLIGHT</span>
          <span className="after" aria-hidden>
            AFTERLIGHT
          </span>
        </h1>
        <div className="subtitle">ГЛАВА 1 · 03:17</div>
      </div>
      <nav className="menu">
        <button className="primary" onClick={() => (meta ? setSheet('confirm') : onStart())}>
          Начать
        </button>
        <button disabled={!meta} onClick={onContinue}>
          Продолжить{meta ? ` · ${formatClock(meta.clock)}` : ''}
        </button>
        <button onClick={() => setSheet('settings')}>Настройки</button>
        <button onClick={() => setSheet('about')}>Об игре</button>
      </nav>
      {sheet !== 'none' && (
        <div className="sheet-wrap" onClick={(e) => e.target === e.currentTarget && setSheet('none')}>
          <div className="sheet">
            {sheet === 'settings' && (
              <>
                <h2>Настройки</h2>
                <SettingsPanel />
              </>
            )}
            {sheet === 'about' && <About />}
            {sheet === 'confirm' && (
              <>
                <h2>Начать заново?</h2>
                <p>Сохранённый прогресс главы будет перезаписан.</p>
                <div className="sheet-actions">
                  <button className="btn" onClick={() => setSheet('none')}>
                    Отмена
                  </button>
                  <button className="btn primary" onClick={onStart}>
                    Начать
                  </button>
                </div>
              </>
            )}
            {sheet !== 'confirm' && (
              <div className="sheet-actions">
                <button className="btn" onClick={() => setSheet('none')}>
                  Закрыть
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function About() {
  return (
    <>
      <h2>Об игре</h2>
      <p>
        <b>AFTERLIGHT</b> — психологический хоррор от первого лица. Ночь, дождь, обычная съёмная квартира в панельном доме. В 03:17 Владу приходит сообщение с его собственного номера.
      </p>
      <p className="muted">Демоверсия: Глава 1 «03:17», 15–25 минут. Два финала главы. Решения сохраняются для следующих глав.</p>
      <p className="muted">
        Управление на телефоне: левая половина экрана — идти, правая — смотреть, круглая кнопка — взаимодействие. На компьютере: WASD, мышь, E — действие, Q — телефон, F — фонарик, Esc — пауза.
      </p>
      <p className="muted">Весь звук и все текстуры синтезируются процедурно прямо в браузере (Web Audio API, Canvas). Записанных аудиофайлов и фотографий в игре нет.</p>
      <p className="muted">Все персонажи и события вымышлены. Сделано на Three.js, React и TypeScript.</p>
    </>
  );
}
