import { useEffect, useState } from 'react';
import { useUI } from '@/game/state/ui';
import { getGame } from '@/game/Game';
import { IcCall, IcHang } from './icons';

export function CallOverlay() {
  const incoming = useUI((s) => s.incomingCall);
  const active = useUI((s) => s.activeCall);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [active]);
  if (!incoming && !active) return null;
  const g = getGame();
  const secs = active ? Math.floor((performance.now() - active.startedAt) / 1000) : 0;
  return (
    <div className="call">
      <div className="phone" style={{ height: 'min(92%, 640px)' }}>
        <div className="scr">
          <div className="island" />
          <div className="inner">
            <div className="who">
              <div className="n">{incoming?.name ?? active?.name}</div>
              <div className="s">{incoming ? incoming.number : 'идёт разговор'}</div>
              {active && <div className="timer">{`0:${String(secs).padStart(2, '0')}`}</div>}
            </div>
            {incoming ? (
              <div className="acts">
                <div>
                  <button className="round red" aria-label="Отклонить" onClick={() => g?.endCall('declined')}>
                    <IcHang />
                  </button>
                  Отклонить
                </div>
                <div>
                  <button className="round green" aria-label="Ответить" onClick={() => g?.endCall('answered')}>
                    <IcCall />
                  </button>
                  Ответить
                </div>
              </div>
            ) : (
              <div className="acts">
                <div style={{ opacity: 0.5 }}>
                  <span className="round red">
                    <IcHang />
                  </span>
                  Слушать…
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
