/**
 * Secret detection + redaction. Shared by:
 *  - the audit logger (so secrets never land in logs),
 *  - the security_scan_secrets tool,
 *  - the Claude Code write-guard hook (hooks/guard-write.mjs keeps a copy of the
 *    high-confidence rules so the hook stays dependency-free).
 *
 * Rules are deliberately conservative: each has a confidence level so that the
 * model can tell "this is certainly a live credential" from "this looks like one".
 */
export interface SecretRule {
  id: string;
  description: string;
  confidence: 'high' | 'medium';
  pattern: RegExp;
}

export const SECRET_RULES: readonly SecretRule[] = [
  { id: 'github-token', description: 'GitHub token (classic/OAuth/app)', confidence: 'high', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g },
  { id: 'github-fine-grained', description: 'GitHub fine-grained PAT', confidence: 'high', pattern: /\bgithub_pat_[A-Za-z0-9_]{60,255}\b/g },
  { id: 'anthropic-key', description: 'Anthropic API key', confidence: 'high', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { id: 'openai-key', description: 'OpenAI API key', confidence: 'high', pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/g },
  { id: 'aws-access-key', description: 'AWS access key id', confidence: 'high', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'google-api-key', description: 'Google API key', confidence: 'high', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'slack-token', description: 'Slack token', confidence: 'high', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: 'stripe-live-key', description: 'Stripe live secret/restricted key', confidence: 'high', pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/g },
  { id: 'npm-token', description: 'npm access token', confidence: 'high', pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { id: 'private-key', description: 'PEM private key block', confidence: 'high', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/g },
  { id: 'jwt', description: 'JSON Web Token', confidence: 'medium', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  {
    id: 'generic-assignment',
    description: 'Hard-coded credential assignment (password/secret/token/api_key = "...")',
    confidence: 'medium',
    pattern: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\b["']?\s*[:=]\s*["'][^"'\s$]{8,}["']/gi,
  },
];

export interface SecretMatch {
  rule: string;
  description: string;
  confidence: 'high' | 'medium';
  index: number;
  redacted: string;
}

/** Keep the first 4 chars so a human can recognise which key it is, hide the rest. */
export function maskValue(value: string): string {
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}…[REDACTED ${value.length - 4} chars]`;
}

export function findSecrets(text: string): SecretMatch[] {
  const out: SecretMatch[] = [];
  for (const rule of SECRET_RULES) {
    rule.pattern.lastIndex = 0;
    for (const m of text.matchAll(rule.pattern)) {
      out.push({ rule: rule.id, description: rule.description, confidence: rule.confidence, index: m.index ?? 0, redacted: maskValue(m[0]) });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

export function redactText(text: string): string {
  let result = text;
  for (const rule of SECRET_RULES) {
    result = result.replace(rule.pattern, (m) => maskValue(m));
  }
  return result;
}

const SENSITIVE_KEY = /(token|secret|password|passwd|api[_-]?key|authorization|cookie|credential)/i;

/** Deep-redact a value for logging: sensitive keys are masked entirely, strings are pattern-redacted. */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[…]';
  if (typeof value === 'string') {
    const r = redactText(value);
    return r.length > 2000 ? `${r.slice(0, 2000)}…[truncated]` : r;
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactDeep(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) && typeof v === 'string' ? maskValue(v) : redactDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}
