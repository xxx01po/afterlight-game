import { useState } from 'react';
import { useSettings, type Settings } from '@/smena/state/settings';
import { device } from '@/smena/platform/device';

function Slider({ k, min = 0, max = 1, step = 0.05, label, hint }: { k: keyof Settings; min?: number; max?: number; step?: number; label: string; hint?: string }) {
  const v = useSettings((s) => s[k]) as number;
  const patch = useSettings((s) => s.patch);
  return (
    <div className="row">
      <label>
        {label}
        {hint && <span className="hint">{hint}</span>}
      </label>
      <input type="range" min={min} max={max} step={step} value={v} aria-label={label} onChange={(e) => patch({ [k]: Number(e.target.value) } as Partial<Settings>)} />
    </div>
  );
}

function Toggle({ k, label, hint }: { k: keyof Settings; label: string; hint?: string }) {
  const v = useSettings((s) => s[k]) as boolean;
  const patch = useSettings((s) => s.patch);
  return (
    <div className="row">
      <label>
        {label}
        {hint && <span className="hint">{hint}</span>}
      </label>
      <button className={'toggle' + (v ? ' on' : '')} role="switch" aria-checked={v} aria-label={label} onClick={() => patch({ [k]: !v } as Partial<Settings>)} />
    </div>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'audio' | 'video' | 'controls'>('controls');
  const q = useSettings((s) => s.quality);
  const patch = useSettings((s) => s.patch);
  return (
    <div className="scrim" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel" role="dialog" aria-label="Настройки">
        <h2>Настройки</h2>
        <div className="tabs">
          {(['controls', 'audio', 'video'] as const).map((t) => (
            <button key={t} className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
              {t === 'controls' ? 'Управление' : t === 'audio' ? 'Звук' : 'Графика'}
            </button>
          ))}
        </div>
        {tab === 'audio' && (
          <>
            <Slider k="master" label="Общая громкость" />
            <Slider k="ambience" label="Окружение" hint="дождь, ветер, лес" />
            <Slider k="sfx" label="Эффекты" />
            <Slider k="voice" label="Рация и голоса" />
            <Slider k="music" label="Тревожные мотивы" />
            <Toggle k="subtitles" label="Субтитры мыслей героя" hint="реплики рации показываются всегда" />
          </>
        )}
        {tab === 'video' && (
          <>
            <div className="row">
              <label>
                Качество
                <span className="hint">«Авто» сейчас: {device().suggested === 'low' ? 'низкое' : device().suggested === 'medium' ? 'среднее' : 'высокое'}, снижается при падении FPS</span>
              </label>
              <div className="seg">
                {(['auto', 'low', 'medium', 'high'] as const).map((x) => (
                  <button key={x} className={q === x ? 'on' : ''} onClick={() => patch({ quality: x })}>
                    {x === 'auto' ? 'Авто' : x === 'low' ? 'Низк' : x === 'medium' ? 'Сред' : 'Выс'}
                  </button>
                ))}
              </div>
            </div>
            <Slider k="fov" min={60} max={95} step={1} label="Поле зрения" />
            <Slider k="headBob" min={0} max={1} step={0.1} label="Покачивание камеры" hint="уменьшите, если укачивает" />
            <Toggle k="showFps" label="Показывать FPS" />
          </>
        )}
        {tab === 'controls' && (
          <>
            <Slider k="lookSensitivity" min={0.2} max={3} step={0.05} label="Чувствительность обзора" />
            <Toggle k="invertY" label="Инверсия по вертикали" />
            <Toggle k="leftHanded" label="Джойстик справа" hint="для левшей" />
            <Toggle k="haptics" label="Вибрация" hint="если устройство поддерживает" />
            <p style={{ marginTop: 12 }}>
              Телефон: левая часть экрана — движение (оттяните джойстик до упора — бег), правая — обзор. Кнопка «рука» — действие.
              <br />
              Клавиатура: WASD, Shift — бег, C — присесть, E — действие, F — фонарь, R/ЛКМ — предмет, Tab — рюкзак, J — журнал, Esc — пауза.
            </p>
          </>
        )}
        <div className="panel-actions">
          <button className="btn primary" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
