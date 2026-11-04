import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { ZeroConfig } from './config.js';
import { ZeroError } from './errors.js';

/**
 * Centralised permission checks. Every tool goes through the same three gates:
 *   1. module/tool policy  (is this capability switched on?)
 *   2. filesystem scope    (is the path inside an allowed root, not a denied segment?)
 *   3. network scope       (https + host on the allowlist?)
 * Tools never touch fs/network directly without asking this class first.
 */
export class Policy {
  private readonly roots: string[];

  constructor(
    private readonly config: ZeroConfig,
    private readonly projectDir: string,
  ) {
    this.roots = config.filesystem.allowedRoots.map((r) => safeRealpath(path.resolve(projectDir, r)));
  }

  get allowedRoots(): readonly string[] {
    return this.roots;
  }

  isModuleEnabled(moduleName: string, defaultEnabled: boolean): boolean {
    const m = this.config.modules[moduleName];
    return m ? m.enabled : defaultEnabled;
  }

  assertTool(moduleName: string, toolName: string, defaultEnabled: boolean): void {
    if (!this.isModuleEnabled(moduleName, defaultEnabled)) {
      throw new ZeroError('PERMISSION_DENIED', `Module "${moduleName}" is disabled`, `Enable it in zero.config.json → modules.${moduleName}.enabled`);
    }
    const policy = this.config.modules[moduleName]?.tools[toolName];
    if (policy === 'deny') {
      throw new ZeroError('PERMISSION_DENIED', `Tool "${toolName}" is denied by policy`, `See zero.config.json → modules.${moduleName}.tools`);
    }
  }

  /**
   * Resolve a user-supplied path and prove it stays inside an allowed root.
   * Symlinks are resolved first, so `allowed/link -> /etc` is refused.
   */
  resolvePath(input: string): string {
    if (typeof input !== 'string' || input.length === 0) throw new ZeroError('INVALID_INPUT', 'Path must be a non-empty string');
    if (input.includes('\0')) throw new ZeroError('INVALID_INPUT', 'Path contains a NUL byte');
    const abs = path.resolve(this.projectDir, input);
    const real = safeRealpath(abs);
    const inside = this.roots.some((root) => real === root || real.startsWith(root + path.sep));
    if (!inside) {
      throw new ZeroError('PERMISSION_DENIED', `Path is outside allowed roots: ${input}`, `Allowed roots: ${this.roots.join(', ')}`);
    }
    const segments = real.split(path.sep);
    const hit = this.config.filesystem.denySegments.find((d) => segments.includes(d));
    if (hit) throw new ZeroError('PERMISSION_DENIED', `Path crosses a denied segment "${hit}": ${input}`);
    return real;
  }

  /** True if a path (already resolved) passes denySegments — used while walking directories. */
  isWalkable(absPath: string): boolean {
    const segments = absPath.split(path.sep);
    return !this.config.filesystem.denySegments.some((d) => segments.includes(d));
  }

  assertUrl(url: string): URL {
    if (!this.config.network.enabled) throw new ZeroError('PERMISSION_DENIED', 'Network access is disabled', 'Set network.enabled=true in zero.config.json');
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      throw new ZeroError('INVALID_INPUT', `Invalid URL: ${url}`);
    }
    if (u.protocol !== 'https:') throw new ZeroError('PERMISSION_DENIED', `Only https is allowed (got ${u.protocol})`);
    if (u.username || u.password) throw new ZeroError('PERMISSION_DENIED', 'Credentials in URLs are not allowed');
    const host = u.hostname.toLowerCase();
    const ok = this.config.network.allowedHosts.some((h) => {
      const rule = h.toLowerCase();
      return rule.startsWith('*.') ? host.endsWith(rule.slice(1)) : host === rule;
    });
    if (!ok) throw new ZeroError('PERMISSION_DENIED', `Host not on allowlist: ${host}`, `Add it to network.allowedHosts in zero.config.json if you trust it`);
    return u;
  }
}

/** realpath that tolerates not-yet-existing leaf paths by resolving the nearest existing parent. */
export function safeRealpath(p: string): string {
  let current = p;
  const tail: string[] = [];
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return p;
    tail.unshift(path.basename(current));
    current = parent;
  }
  return path.join(realpathSync(current), ...tail);
}
