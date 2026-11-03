import { useStory } from '@/game/state/storyStore';
import { KNOWLEDGE } from '@/data/chapter01/knowledge';

const TITLES: Record<string, { title: string; tag: string }> = {
  closed: { title: 'Закрытая дверь', tag: 'В этот раз открыла она.' },
  opened: { title: 'Открытая дверь', tag: 'Всё началось заново.' },
};

export function EndScreen({ onTitle, onReplay }: { onTitle: () => void; onReplay: () => void }) {
  const ending = useStory((s) => String(s.flags.ended ?? 'closed'));
  const choices = useStory((s) => s.choices);
  const allKnowledge = useStory((s) => s.knowledge);
  const knowledge = allKnowledge.filter((k) => KNOWLEDGE[k]);
  const playTime = useStory((s) => s.playTime);
  const t = TITLES[ending] ?? TITLES.closed;
  const seen = new Set<string>();
  const list = choices.filter((c) => (seen.has(c.label) ? false : (seen.add(c.label), true)));
  return (
    <div className="ending">
      <div className="inner">
        <div className="ch">AFTERLIGHT · ГЛАВА 1 · 03:17</div>
        <h1>{t.title}</h1>
        <div className="tag">{t.tag}</div>
        <ul>
          {list.map((c) => (
            <li key={c.id}>{c.label}</li>
          ))}
        </ul>
        <div className="frag">
          Найдено фрагментов: {knowledge.length} из {Object.keys(KNOWLEDGE).length} · время в игре: {Math.round(playTime / 60)} мин
        </div>
        <div className="next">
          Ваши решения сохранены и будут учтены в следующей главе.
          <br />
          Глава 2 — «Соседи» — в разработке.
          <br />
          Некоторые вопросы этой ночи имеют ответ. Попробуйте пройти главу иначе.
        </div>
        <div className="sheet-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn primary" onClick={onReplay}>
            Пройти заново
          </button>
          <button className="btn" onClick={onTitle}>
            Главное меню
          </button>
        </div>
      </div>
    </div>
  );
}
