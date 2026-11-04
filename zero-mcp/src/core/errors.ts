/**
 * Typed errors. Every failure inside a tool is mapped to one of these codes so the
 * model gets a predictable, actionable message instead of a stack trace.
 */
export type ZeroErrorCode =
  | 'PERMISSION_DENIED' // policy forbids the action (module/tool disabled, path or host not allowed)
  | 'INVALID_INPUT' // arguments are well-typed but semantically wrong
  | 'RATE_LIMITED' // per-module usage budget exhausted
  | 'NOT_FOUND' // file / package / repo does not exist
  | 'UPSTREAM_ERROR' // remote API failed or returned garbage
  | 'TIMEOUT' // remote call exceeded its time budget
  | 'DEPENDENCY_MISSING' // required env var / binary / config is absent
  | 'INTERNAL'; // bug in ZERO itself

export class ZeroError extends Error {
  readonly code: ZeroErrorCode;
  readonly hint?: string;

  constructor(code: ZeroErrorCode, message: string, hint?: string) {
    super(message);
    this.name = 'ZeroError';
    this.code = code;
    this.hint = hint;
  }
}

export function toZeroError(err: unknown): ZeroError {
  if (err instanceof ZeroError) return err;
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return new ZeroError('TIMEOUT', 'Remote request timed out', 'Retry later or raise network.timeoutMs in zero.config.json');
    }
    return new ZeroError('INTERNAL', err.message);
  }
  return new ZeroError('INTERNAL', String(err));
}
