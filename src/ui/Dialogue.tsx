import { useEffect, useState } from 'react';
import { useUI } from '@/game/state/ui';
import { getGame } from '@/game/Game';

/** Dialogue box with a typewriter reveal; choices appear when the line is done. */
export function DialogueBox() {
  const d = useUI((s) => s.dialogue);
  const peephole = useUI((s) => s.peephole);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    if (!d) return;
    const id = setInterval(() => setShown((n) => (n >= d.text.length ? (clearInterval(id), n) : n + 2)), 28);
    return () => clearInterval(id);
  }, [d?.text, d]);
  if (!d || peephole || (!d.text && !d.choices.length)) return null;
  const done = shown >= d.text.length;
  const g = getGame();
  return (
    <div className={`dialogue ${d.muffled ? 'muffled' : ''}`} onClick={() => (!done ? setShown(d.text.length) : d.canContinue && g?.dialogueAdvance())}>
      {d.speaker && (
        <div className="speaker">
          {d.speaker}
          {d.muffled && <span className="tag">за дверью</span>}
        </div>
      )}
      <div className="text">{d.text.slice(0, shown)}</div>
      {done && d.choices.length > 0 && (
        <div className="choices">
          {d.choices.map((c) => (
            <button
              key={c.id}
              className={c.text.startsWith('[Открыть') || c.text.startsWith('[Не открывать') ? 'decisive' : ''}
              onClick={(e) => {
                e.stopPropagation();
                g?.dialogueChoose(c.id);
              }}
            >
              {c.text}
            </button>
          ))}
        </div>
      )}
      {done && d.canContinue && <span className="cont">ДАЛЬШЕ ▸</span>}
    </div>
  );
}
