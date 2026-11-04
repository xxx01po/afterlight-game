import { ZeroError } from './errors.js';

/**
 * Usage control per module:
 *  - token bucket (ratePerMinute) smooths bursts — protects free API tiers
 *    (GitHub unauthenticated = 60 req/hour!),
 *  - sessionQuota is a hard cap for the lifetime of the server process.
 * Counters are in-memory on purpose: nothing is persisted, nothing to leak.
 */
export class UsageMeter {
  private buckets = new Map<string, { tokens: number; updated: number }>();
  private totals = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  consume(module: string, ratePerMinute?: number, sessionQuota?: number): void {
    const used = this.totals.get(module) ?? 0;
    if (sessionQuota !== undefined && used >= sessionQuota) {
      throw new ZeroError('RATE_LIMITED', `Session quota for module "${module}" exhausted (${sessionQuota} calls)`, 'Restart the session or raise modules.<name>.sessionQuota');
    }
    if (ratePerMinute !== undefined) {
      const t = this.now();
      const b = this.buckets.get(module) ?? { tokens: ratePerMinute, updated: t };
      const refill = ((t - b.updated) / 60_000) * ratePerMinute;
      b.tokens = Math.min(ratePerMinute, b.tokens + refill);
      b.updated = t;
      if (b.tokens < 1) {
        this.buckets.set(module, b);
        const waitS = Math.ceil(((1 - b.tokens) / ratePerMinute) * 60);
        throw new ZeroError('RATE_LIMITED', `Rate limit for module "${module}" reached (${ratePerMinute}/min)`, `Retry in ~${waitS}s`);
      }
      b.tokens -= 1;
      this.buckets.set(module, b);
    }
    this.totals.set(module, used + 1);
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.totals);
  }
}
