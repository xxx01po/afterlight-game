import type { Game } from '@/game/Game';

/** Count distinct "normal life" actions (drives Stage 0 → 1). */
export function routine(g: Game, id: string) {
  if (g.flag(`routine.${id}`)) return;
  g.setFlag(`routine.${id}`, true);
  g.s.inc('routineCount');
}

/** Count distinct strange things the player actually noticed (Stage 1 → 2). */
export function strange(g: Game, id: string) {
  if (g.flag(`strange.${id}`)) return;
  g.setFlag(`strange.${id}`, true);
  g.s.inc('strangeCount');
}
