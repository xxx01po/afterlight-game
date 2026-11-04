import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as z from 'zod';
import type { ZeroModule } from '../core/module.js';

const LOCKFILES: Record<string, string> = {
  'package-lock.json': 'npm',
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'bun.lock': 'bun',
  'bun.lockb': 'bun',
  'uv.lock': 'uv',
  'poetry.lock': 'poetry',
  'Cargo.lock': 'cargo',
  'go.sum': 'go',
};

export function inspectProject(dir: string) {
  const has = (f: string) => existsSync(path.join(dir, f));
  const read = (f: string) => {
    try {
      return readFileSync(path.join(dir, f), 'utf8');
    } catch {
      return undefined;
    }
  };
  const findings: string[] = [];
  const lockfiles = Object.keys(LOCKFILES).filter(has);
  const managers = [...new Set(lockfiles.map((l) => LOCKFILES[l]!))];
  if (lockfiles.length > 1 && managers.length > 1) findings.push(`Multiple package managers' lockfiles: ${lockfiles.join(', ')}`);

  let node: Record<string, unknown> | undefined;
  const pkgText = read('package.json');
  if (pkgText) {
    try {
      const pkg = JSON.parse(pkgText) as { name?: string; scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; engines?: Record<string, string>; type?: string; license?: string };
      const scripts = pkg.scripts ?? {};
      const risky = Object.entries(scripts).filter(([k]) => ['preinstall', 'install', 'postinstall', 'prepare'].includes(k));
      if (risky.length) findings.push(`Lifecycle scripts run on install: ${risky.map(([k, v]) => `${k}="${v}"`).join('; ')}`);
      const runner = managers.includes('pnpm') ? 'pnpm' : managers.includes('yarn') ? 'yarn' : managers.includes('bun') ? 'bun' : 'npm';
      const verify = ['typecheck', 'lint', 'test', 'build'].filter((s) => scripts[s]).map((s) => `${runner} run ${s}`);
      node = {
        name: pkg.name,
        type: pkg.type ?? 'commonjs',
        license: pkg.license ?? null,
        engines: pkg.engines ?? {},
        scripts,
        dependencies: Object.keys(pkg.dependencies ?? {}).length,
        devDependencies: Object.keys(pkg.devDependencies ?? {}).length,
        unpinnedRanges: Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).filter(([, v]) => v === '*' || v === 'latest').map(([k]) => k),
        suggestedVerification: verify,
        installCommand: lockfiles.length ? (runner === 'npm' ? 'npm ci' : `${runner} install --frozen-lockfile`) : `${runner} install`,
      };
      if (!lockfiles.length) findings.push('No lockfile: installs are not reproducible');
    } catch {
      findings.push('package.json is not valid JSON');
    }
  }
  const python = has('pyproject.toml') || has('requirements.txt') ? { pyproject: has('pyproject.toml'), requirements: has('requirements.txt') } : undefined;
  const workflows = has('.github/workflows') ? readdirSync(path.join(dir, '.github/workflows')).filter((f) => /\.ya?ml$/.test(f)) : [];
  const gitignore = read('.gitignore') ?? '';
  const envFiles = readdirSync(dir).filter((f) => /^\.env(\..+)?$/.test(f) && !/\.example$|\.sample$/.test(f));
  if (envFiles.length && !/^\.env/m.test(gitignore)) findings.push(`${envFiles.join(', ')} present but .gitignore has no .env rule`);
  const claude = { claudeMd: has('CLAUDE.md') || has('.claude/CLAUDE.md'), settings: has('.claude/settings.json'), mcpJson: has('.mcp.json'), skills: has('.claude/skills'), agents: has('.claude/agents') };
  if (claude.mcpJson) findings.push('.mcp.json present — run security_lint_mcp_config on it');
  return {
    root: dir,
    node,
    python,
    lockfiles,
    ci: workflows,
    license: has('LICENSE') || has('LICENSE.md') || has('LICENSE.txt'),
    readme: has('README.md'),
    tsconfig: has('tsconfig.json'),
    claude,
    findings,
  };
}

export const projectModule: ZeroModule = {
  name: 'project',
  description: 'Fast, read-only project reconnaissance for agents (stack, scripts, CI, Claude Code config, hygiene findings).',
  defaultEnabled: true,
  tools: [
    {
      name: 'project_inspect',
      title: 'Inspect a project',
      description:
        'Summarise a project directory (inside allowed roots) without running anything: package manager and lockfiles, npm scripts and the exact verification commands to run (typecheck/lint/test/build), dependency counts, install-time lifecycle scripts, CI workflows, license/readme presence, Claude Code config (.claude/, .mcp.json, CLAUDE.md) and hygiene findings such as an un-ignored .env. Use at the start of any coding or review task.',
      input: z.object({ path: z.string().default('.') }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      async handler({ path: p }, ctx) {
        const dir = ctx.policy.resolvePath(p);
        return inspectProject(dir);
      },
    },
  ],
};
