import { useState } from 'react';
import { useUI } from '@/game/state/ui';
import { useStory } from '@/game/state/storyStore';
import { getGame } from '@/game/Game';
import { audio } from '@/game/audio';
import { SettingsPanel } from './Settings';
import { KNOWLEDGE, ITEMS } from '@/data/chapter01/knowledge';
import { formatClock } from '@/utils/math';

export function PauseMenu({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<'notes' | 'settings' | 'exit'>('notes');
  const objective = useUI((s) => s.objective);
  const inv = useStory((s) => s.inventory);
  const knowledge = useStory((s) => s.knowledge);
  const clock = useStory((s) => formatClock(s.clockMin));
  const g = getGame();
  const resume = () => {
    audio.resume(); // gesture: safe to resume after background
    g?.togglePause(false);
  };
  return (
    <div className="pause-menu">
      <nav>
        <div className="t">ПАУЗА · {clock}</div>
        <button className="on" onClick={resume}>
          Продолжить
        </button>
        <button onClick={() => g?.save(true)}>Сохранить</button>
        <button className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>
          Записи
        </button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
          Настройки
        </button>
        <button className={tab === 'exit' ? 'on' : ''} onClick={() => setTab('exit')}>
          В главное меню
        </button>
      </nav>
      <div className="panel">
        {tab === 'notes' && (
          <>
            <h3>Мысли</h3>
            <div className="thought">{objective ?? 'Тихо. Слишком тихо для этого дома.'}</div>
            {inv.length > 0 && (
              <>
                <h3>Карманы</h3>
                <div className="items">
                  {inv.map((i) => (
                    <div key={i} className="item">
                      {ITEMS[i]?.name ?? i}
                      <small>{ITEMS[i]?.desc}</small>
                    </div>
                  ))}
                </div>
              </>
            )}
            <h3>
              Фрагменты · {knowledge.filter((k) => KNOWLEDGE[k]).length}/{Object.keys(KNOWLEDGE).length}
            </h3>
            <div className="items">
              {knowledge.filter((k) => KNOWLEDGE[k]).length === 0 && <div className="item">Пока ничего. Осмотрись.</div>}
              {[...knowledge].reverse().filter((k) => KNOWLEDGE[k]).map((k) => (
                <div key={k} className="item">
                  {KNOWLEDGE[k]}
                </div>
              ))}
            </div>
          </>
        )}
        {tab === 'settings' && <SettingsPanel />}
        {tab === 'exit' && (
          <>
            <h3>Выйти в главное меню?</h3>
            <p style={{ color: 'var(--ink-dim)', lineHeight: 1.5 }}>Игра сохраняется автоматически на контрольных точках. Несохранённые действия после последней точки будут потеряны.</p>
            <div className="sheet-actions" style={{ justifyContent: 'flex-start' }}>
              <button
                className="btn primary"
                onClick={() => {
                  g?.save(false);
                  onExit();
                }}
              >
                Сохранить и выйти
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
