import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';
import { parseConfig } from '../src/core/config.js';
import { buildServer } from '../src/server.js';
import { FAKE } from './fixtures.js';

type Text = { type: 'text'; text: string };
const text = (r: { content?: unknown }) => ((r.content as Text[])[0]?.text ?? '');
const json = (r: { content?: unknown }) => JSON.parse(text(r));

function project() {
  const dir = mkdtempSync(path.join(tmpdir(), 'zero-it-'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'vitest', build: 'tsc', postinstall: 'node evil.js' } }));
  writeFileSync(path.join(dir, 'package-lock.json'), '{}');
  mkdirSync(path.join(dir, 'src'));
  writeFileSync(path.join(dir, 'src', 'config.ts'), `export const token = "${FAKE.github}";\n`);
  writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { x: { command: 'npx', args: ['-y', 'some-mcp@latest'] } } }));
  return dir;
}

const clients: Client[] = [];
afterEach(async () => {
  while (clients.length) await clients.pop()!.close().catch(() => {});
});

async function connect(dir: string, cfg: unknown = {}, fetchImpl?: typeof fetch) {
  const loaded = { config: parseConfig(cfg, 'test'), projectDir: dir, source: 'test' };
  const { server } = buildServer({ loaded, env: {}, fetchImpl });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'zero-test', version: '0.0.0' });
  await client.connect(b);
  clients.push(client);
  return client;
}

describe('ZERO over MCP (in-memory transport)', () => {
  it('lists every tool with descriptions, schemas and read-only annotations', async () => {
    const c = await connect(project());
    const { tools } = await c.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'catalog_list', 'catalog_render_mcp_json', 'github_compare_repos', 'github_repo_health', 'project_inspect',
      'security_check_npm_package', 'security_lint_mcp_config', 'security_scan_secrets', 'zero_audit_tail', 'zero_status',
    ]);
    for (const t of tools) {
      expect(t.description!.length).toBeGreaterThan(60);
      expect(t.inputSchema.type).toBe('object');
      expect(t.annotations?.readOnlyHint).toBe(true);
    }
  });

  it('zero_status reports modules and dependency state', async () => {
    const s = json(await (await connect(project())).callTool({ name: 'zero_status', arguments: {} }));
    expect(s.modules.map((m: { name: string }) => m.name)).toEqual(['zero', 'project', 'security', 'github', 'catalog']);
    expect(s.modules.find((m: { name: string }) => m.name === 'github').status).toBe('degraded'); // optional token missing
  });

  it('project_inspect finds scripts, lifecycle hooks and .mcp.json', async () => {
    const r = json(await (await connect(project())).callTool({ name: 'project_inspect', arguments: {} }));
    expect(r.node.suggestedVerification).toEqual(['npm run test', 'npm run build']);
    expect(r.findings.join(' ')).toMatch(/postinstall/);
    expect(r.claude.mcpJson).toBe(true);
  });

  it('security_scan_secrets finds the token and never echoes it', async () => {
    const res = await (await connect(project())).callTool({ name: 'security_scan_secrets', arguments: { path: '.' } });
    expect(text(res)).not.toContain(FAKE.github);
    const r = JSON.parse(text(res));
    expect(r.findings[0]).toMatchObject({ file: path.join('src', 'config.ts'), line: 1, rule: 'github-token' });
  });

  it('security_lint_mcp_config lints a file by path', async () => {
    const r = json(await (await connect(project())).callTool({ name: 'security_lint_mcp_config', arguments: { path: '.mcp.json' } }));
    expect(r.issues.map((i: { id: string }) => i.id)).toContain('MCP002');
  });

  it('refuses paths outside the project with a typed error', async () => {
    const res = await (await connect(project())).callTool({ name: 'security_scan_secrets', arguments: { path: '/etc' } });
    expect(res.isError).toBe(true);
    expect(text(res)).toMatch(/^\[PERMISSION_DENIED\]/);
  });

  it('rejects invalid input via schema validation', async () => {
    const res = await (await connect(project())).callTool({ name: 'github_repo_health', arguments: { repo: 'not a slug' } });
    expect(res.isError).toBe(true);
  });

  it('hides disabled modules and denied tools entirely', async () => {
    const c = await connect(project(), { modules: { github: { enabled: false }, catalog: { tools: { catalog_render_mcp_json: 'deny' } } } });
    const names = (await c.listTools()).tools.map((t) => t.name);
    expect(names).not.toContain('github_repo_health');
    expect(names).not.toContain('catalog_render_mcp_json');
    expect(names).toContain('catalog_list');
  });

  it('github_repo_health works against a mocked API and sends no token to other hosts', async () => {
    const seen: { url: string; auth?: string }[] = [];
    const fakeFetch = (async (input: URL | string, init?: RequestInit) => {
      const url = String(input);
      seen.push({ url, auth: (init?.headers as Record<string, string>)?.authorization });
      if (url.endsWith('/releases/latest')) return new Response(JSON.stringify({ published_at: '2026-10-30T00:00:00Z' }), { status: 200 });
      if (url.endsWith('/community/profile')) return new Response(JSON.stringify({ health_percentage: 85 }), { status: 200 });
      return new Response(JSON.stringify({ full_name: 'microsoft/playwright-mcp', description: 'x', html_url: 'https://github.com/microsoft/playwright-mcp', stargazers_count: 39143, forks_count: 1, open_issues_count: 1, pushed_at: new Date().toISOString(), created_at: '2025-03-01T00:00:00Z', archived: false, fork: false, license: { spdx_id: 'Apache-2.0' }, language: 'TypeScript', default_branch: 'main' }), { status: 200 });
    }) as typeof fetch;
    const c = await connect(project(), {}, fakeFetch);
    const r = json(await c.callTool({ name: 'github_repo_health', arguments: { repo: 'microsoft/playwright-mcp' } }));
    expect(r.recommendation).toBe('integrate-candidate');
    expect(seen.every((s) => new URL(s.url).host === 'api.github.com')).toBe(true);
  });

  it('maps upstream rate limits to RATE_LIMITED with a hint', async () => {
    const fakeFetch = (async () => new Response('{}', { status: 403, headers: { 'x-ratelimit-reset': '1800000000' } })) as unknown as typeof fetch;
    const res = await (await connect(project(), {}, fakeFetch)).callTool({ name: 'github_repo_health', arguments: { repo: 'a/b' } });
    expect(text(res)).toMatch(/^\[RATE_LIMITED\]/);
    expect(text(res)).toMatch(/GITHUB_TOKEN/);
  });

  it('enforces the configured module rate limit', async () => {
    const c = await connect(project(), { modules: { catalog: { ratePerMinute: 1 } } });
    expect((await c.callTool({ name: 'catalog_list', arguments: {} })).isError).toBeFalsy();
    const second = await c.callTool({ name: 'catalog_list', arguments: {} });
    expect(text(second)).toMatch(/^\[RATE_LIMITED\]/);
  });

  it('writes a redacted audit journal', async () => {
    const dir = project();
    const c = await connect(dir);
    await c.callTool({ name: 'security_lint_mcp_config', arguments: { json: JSON.stringify({ mcpServers: { a: { command: 'node', env: { TOKEN: FAKE.github } } } }) } });
    const tail = json(await c.callTool({ name: 'zero_audit_tail', arguments: { limit: 5 } }));
    expect(tail.entries[0]).toMatchObject({ tool: 'security_lint_mcp_config', outcome: 'ok' });
    const file = path.join(dir, '.zero', 'audit.jsonl');
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).not.toContain(FAKE.github);
  });

  it('catalog_render_mcp_json refuses rejected entries and renders placeholders only', async () => {
    const c = await connect(project());
    const r = json(await c.callTool({ name: 'catalog_render_mcp_json', arguments: { ids: ['playwright', 'github', 'sequential-thinking'] } }));
    expect(Object.keys(r.mcpJson.mcpServers)).toEqual(['playwright', 'github']);
    expect(r.problems[0]).toMatch(/rejected/);
    expect(r.mcpJson.mcpServers.github.headers.Authorization).toBe('Bearer ${GITHUB_PAT}');
  });
});

describe('ZERO over stdio (built dist, like Claude Code launches it)', () => {
  const entry = path.resolve('dist/index.js');
  it.skipIf(!existsSync(entry))('starts, lists tools and answers a call', async () => {
    const dir = project();
    const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: { ZERO_PROJECT_DIR: dir, PATH: process.env.PATH ?? '' }, stderr: 'pipe' });
    const client = new Client({ name: 'zero-stdio-test', version: '0.0.0' });
    await client.connect(transport);
    clients.push(client);
    const { tools } = await client.listTools();
    expect(tools.length).toBe(10);
    const r = await client.callTool({ name: 'catalog_list', arguments: { decision: 'integrate' } });
    expect(JSON.parse(text(r)).entries.map((e: { id: string }) => e.id)).toEqual(['playwright', 'github']);
  });
});
