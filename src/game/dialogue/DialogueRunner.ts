import type { Dialogue, DialogueContext, DialogueNode, DialogueChoice } from './types';

export interface DialogueViewModel {
  nodeId: string;
  speaker: string;
  text: string;
  muffled: boolean;
  choices: { id: string; text: string }[];
  canContinue: boolean;
}

/**
 * Pure state machine over a dialogue graph. UI-agnostic and unit tested:
 * the game binds `onView` to the UI store and calls `choose` / `advance`.
 */
export class DialogueRunner {
  node: DialogueNode | null = null;
  outcome: string | null = null;
  readonly visited: string[] = [];
  private autoTimer = 0;
  onView?: (v: DialogueViewModel | null) => void;
  onEnd?: (outcome: string) => void;

  constructor(readonly dlg: Dialogue, private ctx: DialogueContext) {}

  start() {
    this.go(this.dlg.start);
    return this;
  }

  private go(id: string) {
    const n = this.dlg.nodes[id];
    if (!n) throw new Error(`Dialogue ${this.dlg.id}: missing node "${id}"`);
    this.node = n;
    this.visited.push(id);
    n.onEnter?.(this.ctx);
    this.autoTimer = n.auto ?? 0;
    if (n.end) {
      this.outcome = n.end;
      this.ctx.setFlag(`dlg.${this.dlg.id}.outcome`, n.end);
      this.onView?.(null);
      this.onEnd?.(n.end);
      this.node = null;
      return;
    }
    this.onView?.(this.view());
  }

  availableChoices(): DialogueChoice[] {
    return (this.node?.choices ?? []).filter((c) => !c.cond || c.cond(this.ctx));
  }

  view(): DialogueViewModel | null {
    const n = this.node;
    if (!n) return null;
    const choices = this.availableChoices().map((c) => ({ id: c.id, text: c.text }));
    return {
      nodeId: n.id,
      speaker: n.speaker ?? '',
      text: typeof n.text === 'function' ? n.text(this.ctx) : n.text,
      muffled: !!n.muffled,
      choices,
      canContinue: choices.length === 0 && !!n.next && !n.auto,
    };
  }

  choose(choiceId: string) {
    const c = this.availableChoices().find((x) => x.id === choiceId);
    if (!c) return false;
    this.ctx.setFlag(`dlg.${this.dlg.id}.${c.id}`, true);
    if (c.record) this.ctx.record(`${this.dlg.id}.${c.id}`, c.record);
    c.effect?.(this.ctx);
    this.go(c.next);
    return true;
  }

  advance() {
    const n = this.node;
    if (!n || (n.choices && this.availableChoices().length)) return false;
    if (n.next) {
      this.go(n.next);
      return true;
    }
    return false;
  }

  /** Drive auto-advancing nodes. */
  tick(dt: number) {
    if (!this.node || !this.node.auto) return;
    this.autoTimer -= dt;
    if (this.autoTimer <= 0 && this.node.next) this.go(this.node.next);
  }

  get done() {
    return this.outcome !== null;
  }
}
