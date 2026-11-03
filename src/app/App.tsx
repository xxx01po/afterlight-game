import { useState } from 'react';
import { useUI } from '@/game/state/ui';
import { TitleScreen } from '@/ui/TitleScreen';
import { GameScreen } from '@/ui/GameScreen';
import { EndScreen } from '@/ui/EndScreen';
import { audio } from '@/game/audio';
import { saves } from '@/game/save/SaveSystem';
import { chapter01Initial } from '@/data/chapter01/initialState';
import type { StoryState } from '@/game/state/types';

export function App() {
  const screen = useUI((s) => s.screen);
  const [session, setSession] = useState<{ key: number; state: StoryState } | null>(null);

  const begin = (state: StoryState) => {
    audio.unlock(); // inside the click: required by iOS
    useUI.setState({ screen: 'game', paused: false, ending: null, fade: 1, fadeMs: 0, dialogue: null, reader: null, phoneOpen: false, incomingCall: null, activeCall: null, subtitles: [], objective: null, peephole: false, cutscene: false, flashlight: false, prompt: null });
    setSession({ key: Date.now(), state });
  };
  const toTitle = () => {
    setSession(null);
    useUI.setState({ screen: 'title', paused: false, ending: null });
  };

  return (
    <>
      {screen === 'title' && (
        <TitleScreen
          onStart={() => {
            saves.clear();
            begin(chapter01Initial());
          }}
          onContinue={() => {
            const f = saves.load();
            if (f) begin(f.state);
          }}
        />
      )}
      {screen === 'game' && session && <GameScreen key={session.key} initial={session.state} onExit={toTitle} />}
      {screen === 'ending' && <EndScreen onTitle={toTitle} onReplay={() => { saves.clear(); begin(chapter01Initial()); }} />}
    </>
  );
}
