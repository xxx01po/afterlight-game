import type { FlagValue } from '@/game/state/types';

/** Narrow view of game state that dialogue conditions/effects may use. */
export interface DialogueContext {
  flag(key: string): FlagValue | undefined;
  setFlag(key: string, v: FlagValue): void;
  has(item: string): boolean;
  knows(id: string): boolean;
  learn(id: string): void;
  relation(charId: string, delta: number): void;
  record(id: string, label: string): void;
  /** Free-form hook for side effects (sound, phone message...). */
  emit(event: string, payload?: unknown): void;
}

export interface DialogueChoice {
  id: string;
  text: string;
  next: string;
  cond?: (c: DialogueContext) => boolean;
  effect?: (c: DialogueContext) => void;
  /** Recorded in the choice log (shown on the chapter end screen). */
  record?: string;
}

export interface DialogueNode {
  id: string;
  speaker?: string;
  text: string | ((c: DialogueContext) => string);
  /** Muffled = heard through a door. */
  muffled?: boolean;
  choices?: DialogueChoice[];
  next?: string;
  /** Seconds before auto-advancing (voice through door keeps talking). */
  auto?: number;
  onEnter?: (c: DialogueContext) => void;
  /** Ending node: dialogue resolves with this outcome. */
  end?: string;
}

export interface Dialogue {
  id: string;
  start: string;
  nodes: Record<string, DialogueNode>;
}
