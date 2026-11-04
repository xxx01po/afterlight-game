import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { redactDeep } from './secrets.js';

export interface AuditEntry {
  ts: string;
  module: string;
  tool: string;
  outcome: 'ok' | 'error' | 'denied' | 'rate_limited';
  durationMs: number;
  args: unknown;
  errorCode?: string;
  message?: string;
}

/**
 * Append-only action journal (JSONL). Arguments are deep-redacted before they are
 * written, so tokens passed by mistake never reach disk. A ring buffer keeps the
 * last entries in memory for the zero_audit_tail tool. Logging failures are
 * reported on stderr but never break the tool call itself.
 */
export class AuditLog {
  private readonly ring: AuditEntry[] = [];
  private readonly file?: string;
  private warned = false;

  constructor(opts: { enabled: boolean; path: string; projectDir: string; ringSize?: number }) {
    this.ringSize = opts.ringSize ?? 200;
    if (opts.enabled) this.file = path.resolve(opts.projectDir, opts.path);
  }

  private readonly ringSize: number;

  get filePath(): string | undefined {
    return this.file;
  }

  record(entry: Omit<AuditEntry, 'ts' | 'args'> & { args: unknown }): AuditEntry {
    const full: AuditEntry = { ts: new Date().toISOString(), ...entry, args: redactDeep(entry.args) };
    this.ring.push(full);
    if (this.ring.length > this.ringSize) this.ring.shift();
    if (this.file) {
      try {
        mkdirSync(path.dirname(this.file), { recursive: true });
        appendFileSync(this.file, JSON.stringify(full) + '\n', { encoding: 'utf8', mode: 0o600 });
      } catch (e) {
        if (!this.warned) {
          this.warned = true;
          process.stderr.write(`[zero] audit log write failed (${(e as Error).message}); continuing with in-memory log only\n`);
        }
      }
    }
    return full;
  }

  tail(n: number): AuditEntry[] {
    return this.ring.slice(-n);
  }
}
