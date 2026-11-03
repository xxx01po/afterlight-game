import { useEffect, useRef } from 'react';
import { useUI } from '@/game/state/ui';
import { paint } from './painters';
import { IcClose } from './icons';
import { getGame } from '@/game/Game';
import * as S from '@/game/audio/synth';

/** Inspect overlay for notes, photos, flyers. Tap anywhere to put it back. */
export function Reader() {
  const r = useUI((s) => s.reader);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (r?.image && ref.current) paint(r.image, ref.current);
    if (r) getGame()?.sound?.local((e, d) => S.paper(e, d, 0.25), 'ui');
  }, [r]);
  if (!r) return null;
  const close = () => useUI.setState({ reader: null });
  const tall = r.style === 'polaroid' ? [288, 348] : r.style === 'flyer' ? [300, 428] : [300, 400];
  return (
    <div className={`reader ${r.style}`} onClick={close}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        {r.image && <canvas ref={ref} className="photo" width={tall[0]} height={tall[1]} />}
        <div className="paper">
          <h3>{r.title}</h3>
          <p>{r.body}</p>
        </div>
        <button className="close" aria-label="Закрыть" onClick={close}>
          <IcClose />
        </button>
      </div>
      <div className="tap">коснитесь, чтобы положить</div>
    </div>
  );
}
