import { useEffect, useRef, useState } from 'react';
import { useUI } from '@/game/state/ui';
import { useSettings } from '@/game/state/settings';
import { useStory } from '@/game/state/storyStore';
import { getGame } from '@/game/Game';
import { IcHand, IcPause, IcPhone, IcTorch, IcRotate } from './icons';

/** Touch controls & cinematic overlay. No health bars, no stats. */
export function HUD() {
  const prompt = useUI((s) => s.prompt);
  const flashlight = useUI((s) => s.flashlight);
  const vibrating = useUI((s) => s.phoneVibrating);
  const phoneOpen = useUI((s) => s.phoneOpen);
  const dialogue = useUI((s) => s.dialogue);
  const reader = useUI((s) => s.reader);
  const peephole = useUI((s) => s.peephole);
  const cutscene = useUI((s) => s.cutscene);
  const call = useUI((s) => s.incomingCall);
  const unread = useStory((s) => s.phone.threads.reduce((a, t) => a + t.unread, 0) + s.phone.recordings.filter((r) => r.isNew).length);
  const modal = phoneOpen || !!dialogue || !!reader || peephole || !!call;
  const g = getGame();

  return (
    <div className="hud">
      <Joystick hidden={modal || cutscene} />
      {!modal && <div className={`crosshair ${prompt ? 'on' : ''}`} />}
      <Subtitles />
      <Objective />
      <Toast />
      {!modal && !cutscene && (
        <>
          <button className="btn-round pause" aria-label="Пауза" onClick={() => g?.togglePause(true)}>
            <IcPause />
          </button>
          <button className={`btn-round phone-btn ${vibrating ? 'vibrating' : ''}`} aria-label="Телефон" onClick={() => g?.togglePhone(true)}>
            <IcPhone />
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>
          <button className={`btn-round torch ${flashlight ? 'on' : ''}`} aria-label="Фонарик" onClick={() => g?.toggleFlashlight()}>
            <IcTorch />
          </button>
          {prompt && (
            <button className="interact" onClick={() => g?.interact()}>
              <span className="hand">
                <IcHand />
              </span>
              <span className="label">{prompt.label}</span>
            </button>
          )}
        </>
      )}
      {peephole && (
        <div className="peephole-ui">
          <button onClick={() => useUI.setState({ peephole: false })}>Отойти от двери</button>
        </div>
      )}
      <Tutorial />
      <Fps />
      <RotateHint />
    </div>
  );
}

function Joystick({ hidden }: { hidden: boolean }) {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    const g = getGame();
    if (!g) return;
    g.input.onJoy = (j) => {
      const b = base.current, k = knob.current;
      if (!b || !k) return;
      b.style.opacity = k.style.opacity = j.active ? '1' : '0';
      b.style.left = j.ox + 'px';
      b.style.top = j.oy + 'px';
      k.style.left = j.ox + j.x * 56 + 'px';
      k.style.top = j.oy + j.y * 56 + 'px';
      if (j.active) setTouched(true);
    };
    return () => {
      g.input.onJoy = undefined;
    };
  }, []);
  const isTouch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  return (
    <div style={{ display: hidden ? 'none' : undefined }}>
      {isTouch && <div className="joy-ghost" style={{ opacity: touched ? 0 : 1 }} />}
      <div ref={base} className="joy-base" />
      <div ref={knob} className="joy-knob" />
    </div>
  );
}

function Subtitles() {
  const subs = useUI((s) => s.subtitles);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const u = useUI.getState();
      if (u.subtitles.some((x) => x.until < now)) useUI.setState({ subtitles: u.subtitles.filter((x) => x.until >= now) });
      tick((n) => n + 1);
    }, 250);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="subs" aria-live="polite">
      {subs.map((s) => (
        <div key={s.id} className="line">
          {s.speaker && <b>{s.speaker}</b>}
          {s.text}
        </div>
      ))}
    </div>
  );
}

function Objective() {
  const text = useUI((s) => s.objective);
  const at = useUI((s) => s.objectiveFlash);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (!text) return setVis(false);
    setVis(true);
    const id = setTimeout(() => setVis(false), 7000);
    return () => clearTimeout(id);
  }, [text, at]);
  return text ? <div className="objective" style={{ opacity: vis ? 1 : 0 }}>{text}</div> : null;
}

function Toast() {
  const t = useUI((s) => s.toast);
  return t ? <div className="toast">{t}</div> : null;
}

function Tutorial() {
  const [vis, setVis] = useState(() => {
    try {
      return !sessionStorage.getItem('al.tut');
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (!vis) return;
    const id = setTimeout(() => {
      setVis(false);
      try {
        sessionStorage.setItem('al.tut', '1');
      } catch {
        /* ignore */
      }
    }, 9000);
    return () => clearTimeout(id);
  }, [vis]);
  if (!vis) return null;
  const touch = matchMedia('(pointer: coarse)').matches;
  return touch ? (
    <div className="tutorial">
      <div>Палец слева —<br />идти</div>
      <div>Свайп справа —<br />осмотреться</div>
    </div>
  ) : (
    <div className="tutorial">
      <div>WASD — идти<br />мышь — смотреть (клик — захват)</div>
      <div>E — действие · Q — телефон<br />F — фонарик · Esc — пауза</div>
    </div>
  );
}

function Fps() {
  const show = useSettings((s) => s.showFps);
  const [v, setV] = useState('');
  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => {
      const g = getGame();
      if (g) setV(`${g.engine.fps.toFixed(0)} fps · ${g.engine.quality} · ${g.engine.renderer.info.render.calls} dc`);
    }, 1000);
    return () => clearInterval(id);
  }, [show]);
  return show ? <div className="fps">{v}</div> : null;
}

function RotateHint() {
  const [portrait, setPortrait] = useState(() => innerHeight > innerWidth);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const f = () => setPortrait(innerHeight > innerWidth);
    addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  }, []);
  if (!portrait || dismissed || !matchMedia('(pointer: coarse)').matches) return null;
  return (
    <div className="rotate-hint">
      <IcRotate />
      <p>Поверните телефон горизонтально —<br />так видно больше.</p>
      <button onClick={() => setDismissed(true)}>Играть вертикально</button>
    </div>
  );
}
