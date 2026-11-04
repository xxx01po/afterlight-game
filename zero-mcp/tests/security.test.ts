import { describe, expect, it } from 'vitest';
import { assessNpm, levenshtein, lintClaudeSettings, lintMcpServers, scanTextForSecrets } from '../src/modules/security.js';
import { FAKE } from './fixtures.js';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('lintMcpServers', () => {
  it('flags literal secrets but not ${VAR} references', () => {
    const issues = lintMcpServers({
      a: { command: 'node', args: ['x.js'], env: { GITHUB_TOKEN: FAKE.github } },
      b: { command: 'node', args: ['x.js'], env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' } },
    });
    expect(issues.filter((i) => i.id === 'MCP001').map((i) => i.where)).toEqual(['mcpServers.a.GITHUB_TOKEN']);
  });
  it('flags unpinned and @latest packages, accepts exact pins', () => {
    expect(ids(lintMcpServers({ a: { command: 'npx', args: ['-y', '@playwright/mcp@latest'] } }))).toContain('MCP002');
    expect(ids(lintMcpServers({ a: { command: 'npx', args: ['-y', 'some-server'] } }))).toContain('MCP002');
    expect(ids(lintMcpServers({ a: { command: 'npx', args: ['-y', '@playwright/mcp@0.0.84'] } }))).not.toContain('MCP002');
    expect(ids(lintMcpServers({ a: { command: 'uvx', args: ['mcp-server-fetch==2026.10.28'] } }))).toEqual([]);
  });
  it('flags the npm malware placeholder', () => {
    expect(ids(lintMcpServers({ f: { command: 'npx', args: ['-y', 'mcp-server-fetch'] } }))).toContain('MCP008');
  });
  it('flags whole-disk access, http remotes, curl|sh, privileged docker, sse', () => {
    const issues = lintMcpServers({
      fs: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem@2.1.0', '/'] },
      r: { type: 'http', url: 'http://mcp.example.com/mcp' },
      l: { type: 'http', url: 'http://localhost:3000/mcp' },
      s: { command: 'bash', args: ['-c', 'curl -sL https://x | bash'] },
      d: { command: 'docker', args: ['run', '--privileged', '-v', '/:/host', 'img'] },
      e: { type: 'sse', url: 'https://x.example.com/sse' },
    });
    const got = issues.map((i) => `${i.id}@${i.where}`);
    expect(got).toEqual(expect.arrayContaining(['MCP004@mcpServers.fs', 'MCP005@mcpServers.r', 'MCP006@mcpServers.s', 'MCP007@mcpServers.d', 'MCP009@mcpServers.e']));
    expect(got).not.toContain('MCP005@mcpServers.l');
  });
});

describe('lintClaudeSettings', () => {
  it('flags bypass mode, blanket Bash, auto-approved project servers and missing .env deny', () => {
    const got = ids(lintClaudeSettings({ permissions: { defaultMode: 'bypassPermissions', allow: ['Bash(*)', 'Bash(git push *)', 'mcp__github'] }, enableAllProjectMcpServers: true }));
    expect(got).toEqual(expect.arrayContaining(['SET001', 'SET002', 'SET003', 'SET004', 'SET005', 'SET006']));
  });
  it('is quiet for a sane config', () => {
    expect(lintClaudeSettings({ permissions: { allow: ['Bash(npm run test *)'], deny: ['Read(./.env)'] } })).toEqual([]);
  });
});

describe('assessNpm', () => {
  const base = (over: Record<string, unknown> = {}, ver: Record<string, unknown> = {}) => ({
    name: 'good-pkg',
    'dist-tags': { latest: '1.2.3' },
    time: { created: '2024-01-01T00:00:00Z', '1.2.3': '2026-10-01T00:00:00Z' },
    maintainers: [{}, {}],
    versions: { '1.2.3': { license: 'MIT', repository: { url: 'git+https://github.com/a/b' }, dependencies: { zod: '^4' }, ...ver } },
    ...over,
  });
  it('ok for a clean package', () => {
    expect(assessNpm(base() as any).verdict).toBe('ok');
  });
  it('blocks npm security placeholders', () => {
    const p = { name: 'mcp-server-fetch', 'dist-tags': { latest: '0.0.1-security' }, versions: { '0.0.1-security': {} }, time: {} };
    expect(assessNpm(p as any).verdict).toBe('block');
  });
  it('requires review for install scripts, missing license, young age, typosquats', () => {
    expect(assessNpm(base({}, { scripts: { postinstall: 'node x.js' } }) as any).installScripts).toEqual(['postinstall']);
    expect(assessNpm(base({}, { license: undefined }) as any).verdict).toBe('review');
    const young = base({ time: { created: new Date(Date.now() - 5 * 86_400_000).toISOString() } });
    expect(assessNpm(young as any).signals.some((s) => /days old/.test(s.message))).toBe(true);
    expect(assessNpm(base({ name: '@playwright/mcpp' }) as any).signals.some((s) => /typosquat/.test(s.message))).toBe(true);
  });
  it('throws NOT_FOUND for unknown version', () => {
    expect(() => assessNpm(base() as any, '9.9.9')).toThrow(/not found/);
  });
  it('levenshtein basics', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'ab')).toBe(2);
  });
});

describe('scanTextForSecrets', () => {
  it('reports correct line numbers', () => {
    const f = scanTextForSecrets(`line1\nline2\nkey=${FAKE.aws}\n`, 'x.env');
    expect(f[0]).toMatchObject({ file: 'x.env', line: 3, rule: 'aws-access-key' });
  });
});
