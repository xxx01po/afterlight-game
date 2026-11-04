import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/core/config.js';
import { Policy } from '../src/core/permissions.js';
import { ZeroError } from '../src/core/errors.js';

function setup(cfg: unknown = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'zero-perm-'));
  mkdirSync(path.join(dir, 'src'));
  writeFileSync(path.join(dir, 'src', 'a.ts'), 'x');
  mkdirSync(path.join(dir, '.git'));
  return { dir, policy: new Policy(parseConfig(cfg, 'test'), dir) };
}
const code = (fn: () => unknown) => {
  try {
    fn();
    return 'OK';
  } catch (e) {
    return (e as ZeroError).code;
  }
};

describe('filesystem scope', () => {
  it('allows paths inside the project', () => {
    const { policy, dir } = setup();
    expect(policy.resolvePath('src/a.ts')).toBe(path.join(dir, 'src', 'a.ts'));
  });
  it('refuses traversal and absolute escapes', () => {
    const { policy } = setup();
    expect(code(() => policy.resolvePath('../../etc/passwd'))).toBe('PERMISSION_DENIED');
    expect(code(() => policy.resolvePath('/etc/passwd'))).toBe('PERMISSION_DENIED');
  });
  it('refuses symlinks pointing outside', () => {
    const { policy, dir } = setup();
    symlinkSync('/etc', path.join(dir, 'link'));
    expect(code(() => policy.resolvePath('link/passwd'))).toBe('PERMISSION_DENIED');
  });
  it('refuses denied segments like .git', () => {
    const { policy } = setup();
    expect(code(() => policy.resolvePath('.git/config'))).toBe('PERMISSION_DENIED');
  });
  it('rejects NUL bytes and empty paths', () => {
    const { policy } = setup();
    expect(code(() => policy.resolvePath('a\0b'))).toBe('INVALID_INPUT');
    expect(code(() => policy.resolvePath(''))).toBe('INVALID_INPUT');
  });
  it('does not treat a sibling with a shared prefix as inside', () => {
    const { dir } = setup();
    mkdirSync(dir + '-evil', { recursive: true });
    const policy = new Policy(parseConfig({}, 't'), dir);
    expect(code(() => policy.resolvePath(dir + '-evil'))).toBe('PERMISSION_DENIED');
  });
});

describe('network scope', () => {
  it('allows https on allowlisted hosts only', () => {
    const { policy } = setup();
    expect(code(() => policy.assertUrl('https://api.github.com/repos/a/b'))).toBe('OK');
    expect(code(() => policy.assertUrl('http://api.github.com/'))).toBe('PERMISSION_DENIED');
    expect(code(() => policy.assertUrl('https://evil.example.com/'))).toBe('PERMISSION_DENIED');
    expect(code(() => policy.assertUrl('https://user:pw@api.github.com/'))).toBe('PERMISSION_DENIED');
    expect(code(() => policy.assertUrl('https://api.github.com.evil.com/'))).toBe('PERMISSION_DENIED');
  });
  it('supports wildcard subdomains and global disable', () => {
    const { policy } = setup({ network: { allowedHosts: ['*.example.org'] } });
    expect(code(() => policy.assertUrl('https://docs.example.org/x'))).toBe('OK');
    const off = setup({ network: { enabled: false } }).policy;
    expect(code(() => off.assertUrl('https://api.github.com/'))).toBe('PERMISSION_DENIED');
  });
});

describe('module/tool policy', () => {
  it('honours enabled flags and per-tool deny', () => {
    const { policy } = setup({ modules: { github: { enabled: false }, security: { tools: { security_scan_secrets: 'deny' } } } });
    expect(code(() => policy.assertTool('github', 'github_repo_health', true))).toBe('PERMISSION_DENIED');
    expect(code(() => policy.assertTool('security', 'security_scan_secrets', true))).toBe('PERMISSION_DENIED');
    expect(code(() => policy.assertTool('security', 'security_lint_mcp_config', true))).toBe('OK');
  });
  it('rejects invalid config with a readable message', () => {
    expect(code(() => parseConfig({ filesystem: { allowedRoots: [] } }, 'bad.json'))).toBe('INVALID_INPUT');
  });
});
