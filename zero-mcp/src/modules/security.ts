import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import * as z from 'zod';
import { ZeroError } from '../core/errors.js';
import type { ToolContext, ZeroModule } from '../core/module.js';
import { findSecrets, SECRET_RULES } from '../core/secrets.js';

// ───────────────────────────── secret scanning ─────────────────────────────

interface FileFinding {
  file: string;
  line: number;
  rule: string;
  confidence: 'high' | 'medium';
  description: string;
  redacted: string;
}

function* walk(root: string, ctx: ToolContext, budget: { files: number }): Generator<string> {
  const st = statSync(root);
  if (st.isFile()) {
    yield root;
    return;
  }
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (!ctx.policy.isWalkable(full)) continue;
      if (e.isSymbolicLink()) continue; // never follow links while walking
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) {
        if (budget.files-- <= 0) return;
        yield full;
      }
    }
  }
}

export function scanTextForSecrets(text: string, file: string): FileFinding[] {
  const findings: FileFinding[] = [];
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lineStarts.push(i + 1);
  const lineOf = (idx: number) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid]! <= idx) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  for (const m of findSecrets(text)) {
    findings.push({ file, line: lineOf(m.index), rule: m.rule, confidence: m.confidence, description: m.description, redacted: m.redacted });
  }
  return findings;
}

// ───────────────────────────── config linting ─────────────────────────────

export interface LintIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  where: string;
  message: string;
  fix: string;
}

const KNOWN_BAD_NPM = new Map<string, string>([
  ['mcp-server-fetch', 'npm security placeholder (0.0.1-security) for removed malware; the real fetch server is the PyPI package'],
]);

const RUNNERS = new Set(['npx', 'bunx', 'pnpx', 'uvx', 'pipx']);
const isExpanded = (v: string) => /\$\{[A-Z0-9_]+(:-[^}]*)?\}/i.test(v);

function packageArg(args: string[]): string | undefined {
  // first arg that is not a flag (skip values of --from / -p which name the package explicitly)
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--from' || a === '-p' || a === '--package') return args[i + 1];
    if (a.startsWith('-')) continue;
    return a;
  }
  return undefined;
}

function isPinned(spec: string, runner: string): boolean {
  if (runner === 'uvx' || runner === 'pipx') return /==\d/.test(spec) || /@\d/.test(spec);
  const at = spec.lastIndexOf('@');
  if (at <= 0) return false; // "@scope/name" without version or "name"
  const version = spec.slice(at + 1);
  return /^\d+\.\d+\.\d+/.test(version);
}

export function lintMcpServers(servers: Record<string, unknown>): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const [name, raw] of Object.entries(servers)) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as { command?: string; args?: unknown[]; env?: Record<string, unknown>; url?: string; type?: string; headers?: Record<string, unknown> };
    const where = `mcpServers.${name}`;
    const args = (Array.isArray(s.args) ? s.args : []).map(String);
    const cmd = s.command ? path.basename(s.command) : '';

    for (const [k, v] of [...Object.entries(s.env ?? {}), ...Object.entries(s.headers ?? {})]) {
      if (typeof v !== 'string' || isExpanded(v)) continue;
      const looksSecret = findSecrets(v).length > 0 || (/(token|secret|key|password|authorization)/i.test(k) && v.length >= 8);
      if (looksSecret) issues.push({ id: 'MCP001', severity: 'high', where: `${where}.${k}`, message: 'Literal credential in config file', fix: `Replace the value with "\${${k.toUpperCase().replace(/[^A-Z0-9]/g, '_')}}" and export it in your shell` });
    }

    if (RUNNERS.has(cmd)) {
      const spec = packageArg(args);
      if (spec) {
        const bare = spec.replace(/@[^@/]*$/, '').replace(/==.*$/, '');
        const bad = KNOWN_BAD_NPM.get(bare);
        if (bad && cmd !== 'uvx' && cmd !== 'pipx') issues.push({ id: 'MCP008', severity: 'high', where, message: `Known-bad package "${bare}": ${bad}`, fix: 'Remove it; use the vetted alternative from catalog_list' });
        if (/@latest$/.test(spec) || !isPinned(spec, cmd)) {
          issues.push({ id: 'MCP002', severity: 'medium', where, message: `Unpinned package "${spec}" — every start may run new, unreviewed code`, fix: cmd === 'uvx' ? 'Pin with ==X.Y.Z' : 'Pin an exact version: name@X.Y.Z' });
        }
      }
    }

    if (['bash', 'sh', 'zsh', 'cmd', 'powershell', 'pwsh'].includes(cmd)) {
      const joined = args.join(' ');
      if (/(curl|wget|iwr|Invoke-WebRequest)[^|]*\|\s*(ba|z)?sh/i.test(joined)) issues.push({ id: 'MCP006', severity: 'high', where, message: 'Server launch pipes a download into a shell', fix: 'Install a pinned, reviewed package instead' });
      else issues.push({ id: 'MCP010', severity: 'low', where, message: 'Server is launched through a shell wrapper — harder to audit', fix: 'Call the binary directly with explicit args' });
    }

    if (cmd === 'docker' || cmd === 'podman') {
      const joined = args.join(' ');
      if (/--privileged/.test(joined)) issues.push({ id: 'MCP007', severity: 'high', where, message: 'Container runs --privileged', fix: 'Drop --privileged' });
      if (/-v\s+\/:|--volume[= ]\/:|\/var\/run\/docker\.sock/.test(joined)) issues.push({ id: 'MCP007', severity: 'high', where, message: 'Container mounts host root or the Docker socket', fix: 'Mount only the project directory, read-only if possible (:ro)' });
    }

    for (const a of args) {
      if (['/', '~', '$HOME', '${HOME}', 'C:\\', 'C:/'].includes(a.trim())) issues.push({ id: 'MCP004', severity: 'high', where, message: `Argument grants access to "${a}" (whole disk / home)`, fix: 'Pass the project directory only, e.g. "${CLAUDE_PROJECT_DIR:-.}"' });
    }

    if (s.url) {
      try {
        const u = new URL(s.url.replace(/\$\{[^}]+\}/g, 'x'));
        const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname);
        if (u.protocol === 'http:' && !local) issues.push({ id: 'MCP005', severity: 'high', where, message: 'Remote server over plain http — tokens travel unencrypted', fix: 'Use https' });
      } catch {
        issues.push({ id: 'MCP005', severity: 'medium', where, message: `Unparseable url "${s.url}"`, fix: 'Fix the URL' });
      }
    }
    if (s.type === 'sse') issues.push({ id: 'MCP009', severity: 'low', where, message: 'SSE transport is deprecated', fix: 'Use "type": "http" (streamable HTTP)' });
  }
  return issues;
}

export function lintClaudeSettings(settings: Record<string, unknown>): LintIssue[] {
  const issues: LintIssue[] = [];
  const perms = (settings.permissions ?? {}) as { allow?: unknown[]; deny?: unknown[]; defaultMode?: string };
  const allow = (perms.allow ?? []).map(String);
  const deny = (perms.deny ?? []).map(String);
  if (perms.defaultMode === 'bypassPermissions') issues.push({ id: 'SET001', severity: 'high', where: 'permissions.defaultMode', message: 'bypassPermissions disables all permission prompts', fix: 'Use "default" or "acceptEdits"; use sandboxing for autonomy' });
  for (const rule of allow) {
    if (rule === 'Bash' || rule === 'Bash(*)' || rule === 'Bash(:*)') issues.push({ id: 'SET002', severity: 'high', where: 'permissions.allow', message: `"${rule}" auto-approves every shell command`, fix: 'Allow specific commands: "Bash(npm run test *)"' });
    if (/^Bash\((curl|wget|sudo|rm|git push)\b/.test(rule)) issues.push({ id: 'SET005', severity: 'medium', where: 'permissions.allow', message: `"${rule}" auto-approves a high-impact command`, fix: 'Move it to "ask"' });
    if (/^mcp__[^_]+(__\*)?$/.test(rule)) issues.push({ id: 'SET006', severity: 'low', where: 'permissions.allow', message: `"${rule}" auto-approves a whole MCP server, including future tools`, fix: 'Allow individual read-only tools' });
  }
  if (settings.enableAllProjectMcpServers === true) issues.push({ id: 'SET003', severity: 'medium', where: 'enableAllProjectMcpServers', message: 'Any .mcp.json in any cloned repo is auto-approved', fix: 'Use enabledMcpjsonServers with explicit names' });
  if (!deny.some((d) => /\.env/.test(d))) issues.push({ id: 'SET004', severity: 'low', where: 'permissions.deny', message: 'No deny rule protects .env files', fix: 'Add "Read(./.env)" and "Read(./.env.*)" to permissions.deny' });
  return issues;
}

// ───────────────────────────── npm package vetting ─────────────────────────────

const OFFICIAL_NAMES = [
  '@modelcontextprotocol/sdk', '@modelcontextprotocol/server', '@modelcontextprotocol/client', '@modelcontextprotocol/inspector',
  '@modelcontextprotocol/server-filesystem', '@modelcontextprotocol/server-memory', '@playwright/mcp', 'chrome-devtools-mcp',
  '@upstash/context7-mcp', '@anthropic-ai/sdk', '@anthropic-ai/claude-code', '@anthropic-ai/sandbox-runtime', 'zod', 'react', 'typescript',
];

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length]![b.length]!;
}

interface NpmPackument {
  name: string;
  'dist-tags'?: Record<string, string>;
  time?: Record<string, string>;
  maintainers?: unknown[];
  license?: string;
  repository?: { url?: string } | string;
  versions?: Record<string, { license?: string; deprecated?: string; scripts?: Record<string, string>; dependencies?: Record<string, string>; hasInstallScript?: boolean; repository?: { url?: string } | string }>;
}

export function assessNpm(pkg: NpmPackument, requestedVersion?: string, now = Date.now()) {
  const latest = pkg['dist-tags']?.latest;
  const version = requestedVersion ?? latest;
  const signals: { level: 'block' | 'review' | 'info'; message: string }[] = [];
  if (!version || !pkg.versions?.[version]) throw new ZeroError('NOT_FOUND', `Version ${version ?? '(none)'} of ${pkg.name} not found`);
  const v = pkg.versions[version]!;

  if (/-security$/.test(version) || latest?.endsWith('-security')) signals.push({ level: 'block', message: 'npm security placeholder: the package was removed for malicious content' });
  if (v.deprecated) signals.push({ level: 'review', message: `Deprecated: ${v.deprecated}` });
  const install = ['preinstall', 'install', 'postinstall'].filter((s) => v.scripts?.[s]);
  if (install.length || v.hasInstallScript) signals.push({ level: 'review', message: `Runs install scripts (${install.map((s) => `${s}: ${v.scripts![s]}`).join('; ') || 'native build'}) — read them first or install with --ignore-scripts` });
  const license = v.license ?? pkg.license;
  if (!license) signals.push({ level: 'review', message: 'No license declared — legally unusable until clarified' });
  const repo = typeof v.repository === 'string' ? v.repository : v.repository?.url ?? (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url);
  if (!repo) signals.push({ level: 'review', message: 'No source repository linked — cannot review the code' });
  const created = pkg.time?.created ? Date.parse(pkg.time.created) : undefined;
  const ageDays = created ? Math.floor((now - created) / 86_400_000) : undefined;
  if (ageDays !== undefined && ageDays < 30) signals.push({ level: 'review', message: `Package is only ${ageDays} days old` });
  const published = pkg.time?.[version];
  const depCount = Object.keys(v.dependencies ?? {}).length;
  if (depCount > 40) signals.push({ level: 'info', message: `${depCount} direct dependencies — large supply-chain surface` });
  const maintainers = pkg.maintainers?.length ?? 0;
  if (maintainers === 1) signals.push({ level: 'info', message: 'Single maintainer (bus factor / account-takeover risk)' });
  for (const official of OFFICIAL_NAMES) {
    const d = levenshtein(pkg.name, official);
    if (d > 0 && d <= 2) signals.push({ level: 'review', message: `Name is ${d} edit(s) away from "${official}" — possible typosquat` });
  }
  const verdict = signals.some((s) => s.level === 'block') ? 'block' : signals.some((s) => s.level === 'review') ? 'review' : 'ok';
  return { name: pkg.name, version, latest, license: license ?? null, repository: repo ?? null, publishedAt: published ?? null, ageDays: ageDays ?? null, maintainers, directDependencies: depCount, installScripts: install, verdict, signals };
}

// ───────────────────────────── module ─────────────────────────────

export const securityModule: ZeroModule = {
  name: 'security',
  description: 'Secret scanning, MCP/Claude config linting and npm package vetting. All read-only.',
  defaultEnabled: true,
  requires: { hosts: ['registry.npmjs.org'] },
  tools: [
    {
      name: 'security_scan_secrets',
      title: 'Scan files for secrets',
      description:
        'Scan a file or directory (inside the allowed roots) for leaked credentials: GitHub/Anthropic/OpenAI/AWS/Google/Slack/Stripe/npm tokens, private keys, JWTs and hard-coded password assignments. Skips .git, node_modules, binaries and symlinks. Output never contains the secret itself, only a masked prefix. Use before committing or publishing.',
      input: z.object({
        path: z.string().default('.').describe('File or directory relative to the project root'),
        minConfidence: z.enum(['high', 'medium']).default('medium'),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      async handler({ path: p, minConfidence }, ctx) {
        const root = ctx.policy.resolvePath(p);
        const budget = { files: ctx.loaded.config.filesystem.maxFiles };
        const findings: FileFinding[] = [];
        let scanned = 0;
        let skipped = 0;
        for (const file of walk(root, ctx, budget)) {
          const size = statSync(file).size;
          if (size > ctx.loaded.config.filesystem.maxFileBytes) {
            skipped++;
            continue;
          }
          const buf = readFileSync(file);
          if (buf.subarray(0, 8000).includes(0)) {
            skipped++;
            continue;
          }
          scanned++;
          findings.push(...scanTextForSecrets(buf.toString('utf8'), path.relative(ctx.loaded.projectDir, file) || path.basename(file)));
        }
        const filtered = findings.filter((f) => minConfidence === 'medium' || f.confidence === 'high');
        return {
          scannedFiles: scanned,
          skippedFiles: skipped,
          truncated: budget.files < 0,
          findings: filtered.slice(0, 200),
          totalFindings: filtered.length,
          rules: SECRET_RULES.map((r) => r.id),
          next: filtered.length ? 'Rotate any real credential found (revoking is the only safe fix once committed), then remove it and use environment variables.' : 'No secrets found by pattern rules. Patterns cannot catch everything — still review diffs.',
        };
      },
    },
    {
      name: 'security_lint_mcp_config',
      title: 'Lint MCP / Claude Code config',
      description:
        'Audit a .mcp.json, ~/.claude.json-style mcpServers block, or a Claude Code settings.json for risky patterns: literal secrets, unpinned npx/uvx packages, known-malicious packages, whole-disk filesystem access, plain-http remotes, curl|sh launchers, privileged containers, bypassPermissions, blanket Bash allow rules, enableAllProjectMcpServers, missing .env deny rules. Pass either `path` (inside allowed roots) or raw `json`.',
      input: z.object({
        path: z.string().optional().describe('Path to .mcp.json or settings.json, relative to project root'),
        json: z.string().max(500_000).optional().describe('Raw JSON text instead of a path'),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      async handler({ path: p, json }, ctx) {
        if (!p && !json) throw new ZeroError('INVALID_INPUT', 'Provide `path` or `json`');
        const text = json ?? readFileSync(ctx.policy.resolvePath(p!), 'utf8');
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(text) as Record<string, unknown>;
        } catch (e) {
          throw new ZeroError('INVALID_INPUT', `Not valid JSON: ${(e as Error).message}`);
        }
        const issues: LintIssue[] = [];
        const kinds: string[] = [];
        if (data.mcpServers && typeof data.mcpServers === 'object') {
          kinds.push('mcpServers');
          issues.push(...lintMcpServers(data.mcpServers as Record<string, unknown>));
        }
        if ('permissions' in data || 'hooks' in data || 'enableAllProjectMcpServers' in data) {
          kinds.push('claude-settings');
          issues.push(...lintClaudeSettings(data));
        }
        if (!kinds.length) throw new ZeroError('INVALID_INPUT', 'JSON has neither "mcpServers" nor Claude Code settings keys');
        const order = { high: 0, medium: 1, low: 2 } as const;
        issues.sort((a, b) => order[a.severity] - order[b.severity]);
        return { detected: kinds, summary: { high: issues.filter((i) => i.severity === 'high').length, medium: issues.filter((i) => i.severity === 'medium').length, low: issues.filter((i) => i.severity === 'low').length }, issues };
      },
    },
    {
      name: 'security_check_npm_package',
      title: 'Vet an npm package before installing',
      description:
        'Look up an npm package on registry.npmjs.org WITHOUT installing it and report: install scripts (preinstall/install/postinstall), npm malware placeholders, deprecation, license, linked repository, age, maintainer count, dependency count and typosquat similarity to well-known MCP/Anthropic packages. Verdict: ok | review | block. Use before adding any MCP server launched with npx.',
      input: z.object({
        name: z.string().regex(/^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/, 'Not a valid npm package name').max(214),
        version: z.string().regex(/^\d+\.\d+\.\d+[0-9A-Za-z.+-]*$/).optional().describe('Exact version; default = latest'),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      async handler({ name, version }, ctx) {
        const url = `https://registry.npmjs.org/${name.replace('/', '%2f')}`;
        const { data } = await ctx.http.getJson<NpmPackument>(url);
        if (!data) throw new ZeroError('NOT_FOUND', `npm package ${name} not found`);
        return assessNpm(data, version);
      },
    },
  ],
};
