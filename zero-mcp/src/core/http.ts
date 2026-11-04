import type { ZeroConfig } from './config.js';
import { ZeroError } from './errors.js';
import type { Policy } from './permissions.js';

export interface HttpClientDeps {
  policy: Policy;
  config: ZeroConfig;
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}

/**
 * The only way ZERO talks to the network.
 *  - host allowlist + https enforced by Policy,
 *  - timeout and response-size cap,
 *  - redirects are followed manually and re-checked against the allowlist,
 *  - credentials are attached ONLY for their own host (GITHUB_TOKEN → api.github.com),
 *    so a token can never be sent to a third party.
 */
export class HttpClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly deps: HttpClientDeps) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
  }

  async getJson<T = unknown>(url: string, opts: { allow404?: boolean } = {}): Promise<{ status: number; data: T | null; headers: Headers }> {
    let current = this.deps.policy.assertUrl(url);
    for (let hop = 0; hop < 4; hop++) {
      const res = await this.fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        headers: this.headersFor(current),
        signal: AbortSignal.timeout(this.deps.config.network.timeoutMs),
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        current = this.deps.policy.assertUrl(new URL(res.headers.get('location')!, current).toString());
        continue;
      }
      if (res.status === 404 && opts.allow404) return { status: 404, data: null, headers: res.headers };
      if (res.status === 404) throw new ZeroError('NOT_FOUND', `Not found: ${current.pathname}`);
      if (res.status === 403 || res.status === 429) {
        const reset = res.headers.get('x-ratelimit-reset');
        const hint = reset ? `Upstream rate limit; resets at ${new Date(Number(reset) * 1000).toISOString()}` : 'Upstream refused the request (rate limit or permissions)';
        throw new ZeroError('RATE_LIMITED', `${current.host} returned ${res.status}`, hint + (current.host === 'api.github.com' && !this.deps.env.GITHUB_TOKEN ? '. Set GITHUB_TOKEN (read-only, no scopes) to raise the limit from 60 to 5000 req/h' : ''));
      }
      if (!res.ok) throw new ZeroError('UPSTREAM_ERROR', `${current.host} returned HTTP ${res.status}`);
      const text = await readCapped(res, this.deps.config.network.maxResponseBytes);
      try {
        return { status: res.status, data: JSON.parse(text) as T, headers: res.headers };
      } catch {
        throw new ZeroError('UPSTREAM_ERROR', `${current.host} returned non-JSON content`);
      }
    }
    throw new ZeroError('UPSTREAM_ERROR', 'Too many redirects');
  }

  private headersFor(u: URL): Record<string, string> {
    const h: Record<string, string> = { accept: 'application/json', 'user-agent': 'zero-mcp/0.1 (+https://modelcontextprotocol.io)' };
    if (u.hostname === 'api.github.com') {
      h.accept = 'application/vnd.github+json';
      h['x-github-api-version'] = '2022-11-28';
      const token = this.deps.env.GITHUB_TOKEN;
      if (token && !token.includes('${')) h.authorization = `Bearer ${token}`;
    }
    return h;
  }
}

async function readCapped(res: Response, max: number): Promise<string> {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > max) throw new ZeroError('UPSTREAM_ERROR', `Response too large (${declared} bytes > ${max})`);
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new ZeroError('UPSTREAM_ERROR', `Response exceeded ${max} bytes`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
