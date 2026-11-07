import { useEffect, useRef, useState } from 'react';
import { Game } from '@/smena/Game';
import { useGame } from '@/smena/state/game';
import { useSettings } from '@/smena/state/settings';
import { saves } from '@/smena/save/SaveSystem';
import { telegram } from '@/smena/platform/telegram';
import { device } from '@/smena/platform/device';
import { HUD } from '@/smena/ui/HUD';
import { TouchControls } from '@/smena/ui/TouchControls';
import { Inventory, Reader } from '@/smena/ui/Panels';
import { SettingsPanel } from '@/smena/ui/Settings';
import { Icon } from '@/smena/ui/icons';

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function About({ onClose }: { onClose: () => void }) {
  return (
    <div className="scrim" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel" role="dialog" aria-label="Об игре">
        <h2>Об игре</h2>
        <p>
          <b>ПОСЛЕДНЯЯ СМЕНА</b> — психологический survival horror от первого лица. Эпизод 1: «Ночная смена № 01», 10–20 минут.
        </p>
        <p>Ты — ночной охранник объекта 17 у заброшенной деревни Сосновка. Дождь, лес, рация и генератор, который нельзя глушить. Сегодня твоя первая смена. Наверное.</p>
        <p>Играйте в наушниках: звук здесь — часть игрового процесса. Тишина тоже.</p>
        <p style={{ fontSize: 12 }}>
          Вся графика и весь звук создаются процедурно, прямо в браузере. Three.js, Rapier, Web Audio, React. Сохранения — локально на устройстве. Все персонажи и события вымышлены.
        </p>
        <div className="panel-actions">
          <button className="btn primary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [panel, setPanel] = useState<'settings' | 'about' | 'confirm' | null>(null);
  const screen = useGame((s) => s.screen);
  const ready = useGame((s) => s.physicsReady);
  const hasSave = useGame((s) => s.hasSave);
  const loadingText = useGame((s) => s.loadingText);
  const stats = useGame((s) => s.stats);
  const reading = useGame((s) => s.reading);
  const invOpen = useGame((s) => s.invOpen || s.journalOpen);
  const touch = device().touch;
  const quality = useSettings((s) => s.quality);

  useEffect(() => {
    let g: Game | null = null;
    let cancelled = false;
    (async () => {
      await Promise.all([useSettings.getState().hydrate(), telegram.init()]);
      if (cancelled || !stageRef.current) return;
      try {
        g = new Game(stageRef.current);
      } catch (e) {
        console.error(e);
        useGame.getState().set({ screen: 'menu', loadingText: 'WebGL недоступен на этом устройстве.' });
        return;
      }
      (window as unknown as { __smena: unknown }).__smena = g.debug;
      setGame(g);
      const s = await saves.latest();
      useGame.getState().set({ screen: 'menu', hasSave: !!s });
    })();
    // pause when the app goes to background (Telegram minimised, tab switched)
    const vis = () => {
      if (!g) return;
      if (document.hidden) {
        if (useGame.getState().screen === 'playing') g.pause(true);
        g.audio.suspend();
      } else g.audio.resume();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', vis);
      g?.dispose();
    };
  }, []);

  // live quality switching from the settings panel
  useEffect(() => {
    if (!game) return;
    const q = quality === 'auto' ? device().suggested : quality;
    game.engine.applyQuality(q);
  }, [quality, game]);

  const newGame = async () => {
    if (!game) return;
    setPanel(null);
    await saves.clear();
    await game.begin(null);
  };
  const cont = async () => {
    if (!game) return;
    const s = await saves.latest();
    await game.begin(s);
  };

  return (
    <div className={'smena-root' + (touch ? ' touch' : '')}>
      <div className="stage" ref={stageRef} />
      {game && screen === 'playing' && (
        <>
          <HUD game={game} touch={touch} />
          {touch && !reading && !invOpen && <TouchControls game={game} />}
          <Inventory game={game} />
          <Reader game={game} />
        </>
      )}
      {screen === 'menu' && (
        <div className="menu">
          <div className="menu-col">
            <div className="brand-kicker">Объект 17 · 14.11.1986</div>
            <h1 className="brand">
              Последняя
              <br />
              смена
              <span>Ночная смена № 01</span>
            </h1>
            <div className="ep">{loadingText || 'психологический хоррор · ~15 минут · наушники'}</div>
            <button className="mbtn" disabled={!game} onClick={() => (hasSave ? setPanel('confirm') : void newGame())}>
              Новая игра
              {!ready && game && (
                <small>
                  <span className="loading-dot" />
                  загрузка физики…
                </small>
              )}
            </button>
            <button className="mbtn" disabled={!game || !hasSave} onClick={() => void cont()}>
              Продолжить
              {!hasSave && <small>нет сохранений</small>}
            </button>
            <button className="mbtn" onClick={() => setPanel('settings')}>
              Настройки
            </button>
            <button className="mbtn" onClick={() => setPanel('about')}>
              Об игре
            </button>
          </div>
          <div className="menu-foot">{telegram.app ? `Telegram · ${telegram.userName ?? 'гость'}` : 'v1.0 · эпизод 1'}</div>
        </div>
      )}
      {screen === 'paused' && game && (
        <div className="scrim" onPointerDown={(e) => e.stopPropagation()}>
          <div className="panel" style={{ width: 'min(420px,100%)' }}>
            <h2>Пауза</h2>
            <div className="pause-list">
              <button className="mbtn" onClick={() => game.pause(false)}>
                Продолжить
              </button>
              <button className="mbtn" onClick={() => void game.save('manual')}>
                Сохранить
              </button>
              <button className="mbtn" onClick={() => setPanel('settings')}>
                Настройки
              </button>
              <button className="mbtn" onClick={() => (void game.save('auto'), game.toMenu())}>
                В главное меню
              </button>
            </div>
          </div>
        </div>
      )}
      {screen === 'dead' && game && (
        <div className="dead">
          <h2>Смена прервана</h2>
          <p>Темнота забрала тебя. Но ночь ещё не закончилась — она никогда не заканчивается.</p>
          <div className="panel-actions" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => void game.continueFromCheckpoint()}>
              С контрольной точки
            </button>
            <button className="btn" onClick={() => game.toMenu()}>
              В меню
            </button>
          </div>
        </div>
      )}
      {screen === 'end' && game && (
        <div className="end">
          <div className="brand-kicker">конец эпизода</div>
          <h2>Ночная смена № 01</h2>
          <p>В 05:58 началась процедура обнуления. В 00:40 смену принял Громов И. Замечаний нет.</p>
          <div className="stats">
            <div>
              <b>{fmt(stats.playTime)}</b>время
            </div>
            <div>
              <b>
                {stats.docs}/{stats.docsTotal}
              </b>
              документы
            </div>
            <div>
              <b>{stats.deaths}</b>смерти
            </div>
          </div>
          <p style={{ fontSize: 12 }}>Продолжение следует: «Ночная смена № 02».</p>
          <div className="panel-actions" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => game.toMenu()}>
              В главное меню
            </button>
          </div>
        </div>
      )}
      {screen === 'boot' && <div className="end" style={{ background: '#050607' }}><div className="brand-kicker">загрузка</div></div>}
      {panel === 'settings' && <SettingsPanel onClose={() => setPanel(null)} />}
      {panel === 'about' && <About onClose={() => setPanel(null)} />}
      {panel === 'confirm' && (
        <div className="scrim" onPointerDown={(e) => e.stopPropagation()}>
          <div className="panel" style={{ width: 'min(420px,100%)' }}>
            <h2>Новая смена?</h2>
            <p>Текущее сохранение будет удалено.</p>
            <div className="panel-actions">
              <button className="btn danger" onClick={() => void newGame()}>
                Начать заново
              </button>
              <button className="btn" onClick={() => setPanel(null)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="rotate">
        {Icon.rotate}
        <p>Поверните устройство горизонтально</p>
      </div>
    </div>
  );
}
