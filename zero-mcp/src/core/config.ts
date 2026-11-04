import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as z from 'zod';
import { ZeroError } from './errors.js';

/**
 * Single source of configuration for ZERO.
 *
 * Lookup order (first hit wins):
 *   1. $ZERO_CONFIG (absolute or relative to the project dir)
 *   2. <project>/zero.config.json
 *   3. <project>/.zero/config.json
 *   4. built-in defaults below (safe: read-only, project dir only, small budgets)
 *
 * <project> = $ZERO_PROJECT_DIR, else process.cwd().
 * Secrets are NEVER read from this file — only from environment variables, and only
 * the names listed in a module's `requires.env`.
 */

const ToolPolicy = z.enum(['allow', 'deny']);

const ModuleConfig = z.object({
  enabled: z.boolean().default(true),
  /** Per-tool override. Missing tool = allowed if module is enabled. */
  tools: z.record(z.string(), ToolPolicy).default({}),
  /** Calls per minute for this module (token bucket). */
  ratePerMinute: z.number().int().positive().max(10_000).optional(),
  /** Hard cap per server process lifetime (≈ per Claude Code session). */
  sessionQuota: z.number().int().positive().max(1_000_000).optional(),
});

export const ZeroConfigSchema = z.object({
  $schema: z.string().optional(),
  modules: z.record(z.string(), ModuleConfig).default({}),
  filesystem: z
    .object({
      /** Directories tools may read. Relative paths resolve against the project dir. */
      allowedRoots: z.array(z.string()).min(1).default(['.']),
      /** Glob-ish path fragments that are always refused, even inside allowed roots. */
      denySegments: z.array(z.string()).default(['.git', 'node_modules', '.ssh', '.gnupg', '.aws']),
      maxFileBytes: z.number().int().positive().max(20_000_000).default(1_000_000),
      maxFiles: z.number().int().positive().max(50_000).default(2_000),
    })
    .default({ allowedRoots: ['.'], denySegments: ['.git', 'node_modules', '.ssh', '.gnupg', '.aws'], maxFileBytes: 1_000_000, maxFiles: 2_000 }),
  network: z
    .object({
      enabled: z.boolean().default(true),
      allowedHosts: z.array(z.string()).default(['api.github.com', 'registry.npmjs.org']),
      timeoutMs: z.number().int().positive().max(120_000).default(15_000),
      maxResponseBytes: z.number().int().positive().max(50_000_000).default(5_000_000),
    })
    .default({ enabled: true, allowedHosts: ['api.github.com', 'registry.npmjs.org'], timeoutMs: 15_000, maxResponseBytes: 5_000_000 }),
  audit: z
    .object({
      enabled: z.boolean().default(true),
      /** JSONL file. Relative to project dir. */
      path: z.string().default('.zero/audit.jsonl'),
    })
    .default({ enabled: true, path: '.zero/audit.jsonl' }),
});

export type ZeroConfig = z.infer<typeof ZeroConfigSchema>;
export type ModuleSettings = z.infer<typeof ModuleConfig>;

export interface LoadedConfig {
  config: ZeroConfig;
  projectDir: string;
  /** Where the config came from — reported by zero_status for transparency. */
  source: string;
}

export function resolveProjectDir(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.ZERO_PROJECT_DIR;
  // Claude Code leaves "${VAR}" literally when a variable is unset — treat that as absent.
  if (raw && !raw.includes('${')) return path.resolve(raw);
  return process.cwd();
}

export function parseConfig(raw: unknown, source: string): ZeroConfig {
  const parsed = ZeroConfigSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new ZeroError('INVALID_INPUT', `Invalid ZERO config in ${source}: ${issues}`, 'Fix the file or delete it to use safe defaults');
  }
  return parsed.data;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): LoadedConfig {
  const projectDir = resolveProjectDir(env);
  const candidates: string[] = [];
  if (env.ZERO_CONFIG && !env.ZERO_CONFIG.includes('${')) candidates.push(path.resolve(projectDir, env.ZERO_CONFIG));
  candidates.push(path.join(projectDir, 'zero.config.json'), path.join(projectDir, '.zero', 'config.json'));

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      throw new ZeroError('INVALID_INPUT', `Cannot parse ${file}: ${(e as Error).message}`);
    }
    return { config: parseConfig(json, file), projectDir, source: file };
  }
  return { config: parseConfig({}, 'built-in defaults'), projectDir, source: 'built-in defaults' };
}
