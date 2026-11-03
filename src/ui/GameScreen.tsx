import { useEffect, useRef, useState } from 'react';
import { Game, getGame } from '@/game/Game';
import { chapter01 } from '@/scenes/chapter-01';
import { useUI } from '@/game/state/ui';
import type { StoryState } from '@/game/state/types';
import { HUD } from './HUD';
import { Phone } from './Phone';
import { DialogueBox } from './Dialogue';
import { Reader } from './Reader';
import { CallOverlay } from './CallOverlay';
import { PauseMenu } from './PauseMenu';

declare global {
  interface Window {
    __afterlight?: { game: () => Game | null; ui: typeof useUI };
  }
}

export function GameScreen({ initial, onExit }: { initial: StoryState; onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = useUI((s) => s.paused);
  const fade = useUI((s) => s.fade);
  const fadeMs = useUI((s) => s.fadeMs);

  useEffect(() => {
    let g: Game | null = null;
    let cancelled = false;
    useUI.setState({ loading: true });
    const id = setTimeout(() => {
      if (cancelled) return;
      try {
        g = new Game(host.current!, chapter01, initial);
        g.startAudio();
        g.start();
        window.__afterlight = { game: getGame, ui: useUI };
        setReady(true);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        useUI.setState({ loading: false });
      }
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(id);
      g?.dispose();
    };
  }, [initial]);

  return (
    <div className="game-root">
      <div ref={host} className="layer" style={{ pointerEvents: 'auto' }} />
      {ready && !paused && <HUD />}
      {ready && <Phone />}
      {ready && <DialogueBox />}
      {ready && <Reader />}
      {ready && <CallOverlay />}
      <div className="fade" style={{ opacity: fade, transitionDuration: `${fadeMs}ms` }} />
      {ready && paused && <PauseMenu onExit={onExit} />}
      {!ready && !error && (
        <div className="loading">
          <span>02:51</span>
        </div>
      )}
      {error && (
        <div className="loading" style={{ padding: 24, textAlign: 'center', letterSpacing: '.05em', lineHeight: 1.6 }}>
          Не удалось запустить WebGL: {error}
          <br />
          Попробуйте обновить страницу или выбрать низкое качество графики.
        </div>
      )}
    </div>
  );
}
