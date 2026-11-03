import type React from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useUI, type PhoneApp } from '@/game/state/ui';
import { useStory, story } from '@/game/state/storyStore';
import { getGame, recordingTime } from '@/game/Game';
import { formatClock } from '@/utils/math';
import { paint } from './painters';
import { IcMsg, IcCall, IcPhoto, IcMic, IcNote, IcPlay, IcStop, IcHang, IcSignal, IcBattery } from './icons';

const go = (app: PhoneApp, arg: string | null = null) => useUI.setState({ phoneApp: app, phoneArg: arg });

/** The protagonist's phone: messages, calls, photos, recorder, notes. */
export function Phone() {
  const open = useUI((s) => s.phoneOpen);
  const app = useUI((s) => s.phoneApp);
  const arg = useUI((s) => s.phoneArg);
  const clock = useStory((s) => formatClock(s.clockMin));
  if (!open) return null;
  const close = () => getGame()?.togglePhone(false);
  return (
    <div className="phone-wrap" onClick={(e) => e.target === e.currentTarget && close()}>
      <button className="phone-close" onClick={close}>
        Убрать
      </button>
      <div className="phone" onClick={(e) => e.stopPropagation()}>
        <div className="scr">
          <div className="island" />
          <div className="status">
            <span>{clock}</span>
            <span className="r">
              <IcSignal />
              <IcBattery level={0.23} />
            </span>
          </div>
          <div className="body">
            {app === 'home' && <Home clock={clock} />}
            {app === 'messages' && <Threads />}
            {app === 'thread' && arg && <Thread id={arg} />}
            {app === 'calls' && <Calls />}
            {app === 'photos' && <Photos />}
            {app === 'photo' && arg && <PhotoView id={arg} />}
            {app === 'recorder' && <Recorder />}
            {app === 'notes' && <Notes />}
            {app === 'note' && arg && <NoteView id={arg} />}
          </div>
          <div className="homebar">
            <button aria-label="Домой" onClick={() => go('home')} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Bar({ title, back }: { title: string; back: PhoneApp }) {
  return (
    <div className="bar">
      <button className="back" onClick={() => go(back)}>
        ‹ Назад
      </button>
      <div className="ttl">{title}</div>
    </div>
  );
}

function Home({ clock }: { clock: string }) {
  const unread = useStory((s) => s.phone.threads.reduce((a, t) => a + t.unread, 0));
  const newRec = useStory((s) => s.phone.recordings.filter((r) => r.isNew).length);
  const missed = useStory((s) => s.phone.calls.filter((c) => c.dir === 'missed').length);
  const apps: { id: PhoneApp; name: string; icon: React.ReactNode; color: string; badge?: number }[] = [
    { id: 'messages', name: 'Сообщения', icon: <IcMsg />, color: '#3e6b52', badge: unread },
    { id: 'calls', name: 'Телефон', icon: <IcCall />, color: '#3e6b52', badge: missed > 3 ? missed - 3 : 0 },
    { id: 'photos', name: 'Фото', icon: <IcPhoto />, color: '#5a5470' },
    { id: 'recorder', name: 'Диктофон', icon: <IcMic />, color: '#6b3e3e', badge: newRec },
    { id: 'notes', name: 'Заметки', icon: <IcNote />, color: '#7a6a3a' },
  ];
  return (
    <div className="home">
      <div className="clock-big">{clock}</div>
      <div className="date">вторник, 14 октября</div>
      <div className="apps">
        {apps.map((a) => (
          <button key={a.id} className="app" onClick={() => go(a.id)}>
            <span className="ic" style={{ background: a.color }}>
              {a.icon}
            </span>
            {a.name}
            {!!a.badge && <span className="badge">{a.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Threads() {
  const threads = useStory((s) => s.phone.threads);
  const sorted = [...threads].sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0) || (b.id === 'me' && b.messages.length ? 1 : 0) - (a.id === 'me' && a.messages.length ? 1 : 0));
  return (
    <>
      <Bar title="Сообщения" back="home" />
      <div className="list">
        {sorted
          .filter((t) => t.messages.length)
          .map((t) => {
            const last = t.messages[t.messages.length - 1];
            return (
              <button key={t.id} className="li" onClick={() => go('thread', t.id)}>
                <span className="av" style={{ background: t.color }}>
                  {t.id === 'me' ? '?' : t.name[0]}
                </span>
                <span className="mid">
                  <div className="nm">{t.name}</div>
                  <div className="pv">{last.text}</div>
                </span>
                <span className="tm">{last.time}</span>
                {t.unread > 0 && <span className="dot" />}
              </button>
            );
          })}
      </div>
    </>
  );
}

const REPLIES = ['Кто это?', 'Это шутка?', 'Какую дверь?'];

function Thread({ id }: { id: string }) {
  const t = useStory((s) => s.phone.threads.find((x) => x.id === id));
  const end = useRef<HTMLDivElement>(null);
  const [dial, setDial] = useState<string | null>(null);
  const repliedCount = t?.messages.filter((m) => m.from === 'me').length ?? 0;
  useEffect(() => {
    if (t?.unread) story.getState().markRead(id);
    end.current?.scrollIntoView({ block: 'end' });
  }, [t?.messages.length, t?.unread, id]);
  if (!t) return null;
  const call = async () => {
    setDial('Вызов…');
    const r = await getGame()!.dial(id);
    setTimeout(() => setDial(r), 1400);
    setTimeout(() => setDial(null), 4200);
  };
  return (
    <>
      <div className="bar">
        <button className="back" onClick={() => go('messages')}>
          ‹ Назад
        </button>
        <div className="ttl" style={{ marginRight: 0 }}>
          {t.name}
        </div>
        <button className="call-btn" aria-label="Позвонить" onClick={call}>
          <IcCall />
        </button>
      </div>
      <div className="thread">
        {id === 'me' && <div className="sys">Это ваш номер</div>}
        {t.messages.map((m) => (
          <div key={m.id} style={{ display: 'contents' }}>
            <div className={`bub ${m.from}`}>
              {m.text}
              <span className="t">{m.time}</span>
            </div>
            {m.status === 'failed' && <div className="failed">Не доставлено</div>}
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="composer">
        {id === 'me' && t.messages.some((m) => m.from === 'them') && repliedCount < 3 ? (
          REPLIES.filter((r) => !t.messages.some((m) => m.text === r)).map((r) => (
            <button key={r} onClick={() => getGame()?.reply(id, r)}>
              {r}
            </button>
          ))
        ) : (
          <span className="note">{id === 'me' ? 'Сообщения на этот номер не доставляются.' : 'Три часа ночи. Не буду писать.'}</span>
        )}
      </div>
      {dial && <Dialing who={t.name} status={dial} onEnd={() => setDial(null)} />}
    </>
  );
}

function Dialing({ who, status, onEnd }: { who: string; status: string; onEnd: () => void }) {
  return (
    <div className="dialing">
      <div>
        <div className="who">{who}</div>
        <div className="st">{status}</div>
      </div>
      <button className="round red" aria-label="Завершить" onClick={onEnd}>
        <IcHang />
      </button>
    </div>
  );
}

function Calls() {
  const calls = useStory((s) => s.phone.calls);
  const threads = useStory((s) => s.phone.threads);
  const [dial, setDial] = useState<{ who: string; st: string } | null>(null);
  const callBack = async (name: string) => {
    const th = threads.find((t) => t.name === name);
    if (!th) {
      setDial({ who: name, st: 'Номер скрыт. Перезвонить нельзя.' });
      setTimeout(() => setDial(null), 2600);
      return;
    }
    setDial({ who: name, st: 'Вызов…' });
    const r = await getGame()!.dial(th.id);
    setTimeout(() => setDial({ who: name, st: r }), 1400);
    setTimeout(() => setDial(null), 4200);
  };
  return (
    <>
      <Bar title="Недавние" back="home" />
      <div className="list">
        {calls.map((c) => (
          <button key={c.id} className={`li ${c.dir === 'missed' ? 'missed' : ''}`} onClick={() => callBack(c.contact)}>
            <span className="mid">
              <div className="nm">{c.contact}</div>
              <div className="pv">
                {c.dir === 'in' ? 'входящий' : c.dir === 'out' ? 'исходящий' : 'пропущенный'}
                {c.duration ? ` · ${c.duration}` : ''}
              </div>
            </span>
            <span className="tm">{c.time}</span>
          </button>
        ))}
      </div>
      {dial && <Dialing who={dial.who} status={dial.st} onEnd={() => setDial(null)} />}
    </>
  );
}

function Thumb({ painter, w = 160, h = 160 }: { painter: string; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paint(painter, ref.current);
  }, [painter]);
  return <canvas ref={ref} width={w} height={h} />;
}

function Photos() {
  const photos = useStory((s) => s.phone.photos);
  return (
    <>
      <Bar title="Фото" back="home" />
      <div className="grid">
        {photos.map((p) => (
          <button key={p.id} aria-label={p.title || p.date} onClick={() => go('photo', p.id)}>
            <Thumb painter={p.painter} />
          </button>
        ))}
      </div>
    </>
  );
}

function PhotoView({ id }: { id: string }) {
  const p = useStory((s) => s.phone.photos.find((x) => x.id === id));
  useEffect(() => {
    getGame()?.viewPhoto(id);
  }, [id]);
  if (!p) return null;
  return (
    <>
      <Bar title={p.title || 'Фото'} back="photos" />
      <div className="viewer">
        <Thumb painter={p.painter} w={360} h={480} />
        <div className="meta">{p.date}</div>
      </div>
    </>
  );
}

function useRecTime() {
  return useSyncExternalStore(
    (cb) => {
      recordingTime.listeners.add(cb);
      return () => recordingTime.listeners.delete(cb);
    },
    () => `${recordingTime.id}|${Math.floor(recordingTime.t * 4)}`,
  );
}

function Recorder() {
  const recs = useStory((s) => s.phone.recordings);
  const key = useRecTime();
  const [rid, tq] = key.split('|');
  const t = Number(tq) / 4;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return (
    <>
      <Bar title="Диктофон" back="home" />
      {recs.map((r) => {
        const playing = rid === r.id && t >= 0;
        const bars = 36;
        return (
          <div key={r.id} className="rec">
            <div className="top">
              <button
                className="play"
                aria-label={playing ? 'Стоп' : 'Слушать'}
                onClick={() => {
                  const g = getGame();
                  if (!g) return;
                  if (playing) g.stopRecording();
                  else {
                    if (r.isNew) story.setState((s) => ({ phone: { ...s.phone, recordings: s.phone.recordings.map((x) => (x.id === r.id ? { ...x, isNew: false } : x)) } }));
                    g.playRecording(r.id);
                  }
                }}
              >
                {playing ? <IcStop /> : <IcPlay />}
              </button>
              <div style={{ flex: 1 }}>
                <div className="nm" style={{ color: '#eee', fontWeight: 600 }}>
                  {r.title}
                  {r.isNew && <span className="new">новая</span>}
                </div>
                <div style={{ color: '#8d949b', fontSize: 12 }}>
                  {r.date} · {playing ? `${fmt(t)} / ` : ''}
                  {fmt(r.duration)}
                </div>
              </div>
            </div>
            {playing && (
              <>
                <div className="wave">
                  {Array.from({ length: bars }, (_, i) => (
                    <i key={i} className={i / bars < t / r.duration ? 'p' : ''} style={{ height: `${20 + Math.abs(Math.sin(i * 1.7 + r.duration)) * 80}%` }} />
                  ))}
                </div>
                <div className="tr">
                  {r.transcript
                    .filter((l) => l.t <= t)
                    .slice(-4)
                    .map((l) => (
                      <div key={l.t}>{l.text}</div>
                    ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

function Notes() {
  const notes = useStory((s) => s.phone.notes);
  return (
    <>
      <Bar title="Заметки" back="home" />
      <div className="list">
        {notes.map((n) => (
          <button key={n.id} className="li" onClick={() => go('note', n.id)}>
            <span className="mid">
              <div className="nm">{n.title}</div>
              <div className="pv">{n.body.split('\n')[0]}</div>
            </span>
            <span className="tm">{n.date}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function NoteView({ id }: { id: string }) {
  const n = useStory((s) => s.phone.notes.find((x) => x.id === id));
  useEffect(() => {
    if (id === 'n_dreams') getGame()?.learn('dreamsNote');
  }, [id]);
  if (!n) return null;
  return (
    <>
      <Bar title={n.title} back="notes" />
      <div className="note-body">{n.body}</div>
    </>
  );
}
