import { useSettings, type Quality } from '@/game/state/settings';

export function SettingsPanel() {
  const s = useSettings();
  const slider = (key: 'master' | 'ambience' | 'sfx' | 'music', label: string) => (
    <div className="row">
      <label htmlFor={key}>{label}</label>
      <input id={key} type="range" min={0} max={1} step={0.05} value={s[key]} onChange={(e) => s.patch({ [key]: Number(e.target.value) })} />
    </div>
  );
  const toggle = (key: 'invertY' | 'subtitles' | 'autoQuality' | 'showFps', label: string) => (
    <div className="row">
      <label>{label}</label>
      <button className={`toggle ${s[key] ? 'on' : ''}`} aria-pressed={s[key]} aria-label={label} onClick={() => s.patch({ [key]: !s[key] })} />
    </div>
  );
  return (
    <div>
      {slider('master', 'Общая громкость')}
      {slider('ambience', 'Окружение')}
      {slider('sfx', 'Эффекты')}
      {slider('music', 'Музыка')}
      <div className="row">
        <label>Графика</label>
        <div className="seg">
          {(['low', 'medium', 'high'] as Quality[]).map((q) => (
            <button key={q} className={s.quality === q ? 'on' : ''} onClick={() => s.patch({ quality: q })}>
              {q === 'low' ? 'Низкая' : q === 'medium' ? 'Средняя' : 'Высокая'}
            </button>
          ))}
        </div>
      </div>
      {toggle('autoQuality', 'Авто-снижение при лагах')}
      <div className="row">
        <label htmlFor="sens">Чувствительность обзора</label>
        <input id="sens" type="range" min={0.4} max={2.2} step={0.05} value={s.lookSensitivity} onChange={(e) => s.patch({ lookSensitivity: Number(e.target.value) })} />
      </div>
      {toggle('invertY', 'Инверсия по вертикали')}
      {toggle('subtitles', 'Субтитры мыслей')}
      {toggle('showFps', 'Показывать FPS')}
    </div>
  );
}
