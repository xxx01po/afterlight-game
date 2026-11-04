import type { McpServer, ToolAnnotations } from '@modelcontextprotocol/server';
import type * as z from 'zod';
import type { AuditLog } from './audit.js';
import type { LoadedConfig } from './config.js';
import { toZeroError, ZeroError } from './errors.js';
import type { HttpClient } from './http.js';
import type { Policy } from './permissions.js';
import type { UsageMeter } from './ratelimit.js';

/** Everything a tool may use. Tools get NO direct access to process.env or fs outside Policy. */
export interface ToolContext {
  policy: Policy;
  http: HttpClient;
  loaded: LoadedConfig;
  audit: AuditLog;
  usage: UsageMeter;
  /** Only the env vars the owning module declared in `requires.env`. */
  env: Readonly<Record<string, string | undefined>>;
  registry: ModuleRegistry;
}

export interface ToolDef<S extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  /** Written for the model: what it does, when to use it, what it returns. */
  description: string;
  input: S;
  annotations: ToolAnnotations;
  handler: (args: z.infer<S>, ctx: ToolContext) => Promise<unknown>;
}

export interface EnvRequirement {
  name: string;
  optional: boolean;
  purpose: string;
}

export interface ZeroModule {
  name: string;
  description: string;
  defaultEnabled: boolean;
  requires?: { env?: EnvRequirement[]; hosts?: string[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: ToolDef<any>[];
}

export interface DependencyReport {
  module: string;
  status: 'ok' | 'degraded' | 'blocked' | 'disabled';
  problems: string[];
}

export class ModuleRegistry {
  readonly modules: ZeroModule[];
  private readonly registeredTools = new Set<string>();
  private env: NodeJS.ProcessEnv = {};

  constructor(modules: ZeroModule[]) {
    const seen = new Set<string>();
    for (const m of modules) {
      if (seen.has(m.name)) throw new ZeroError('INTERNAL', `Duplicate module name ${m.name}`);
      seen.add(m.name);
      for (const t of m.tools) {
        if (!/^[a-z][a-z0-9_]{2,63}$/.test(t.name)) throw new ZeroError('INTERNAL', `Bad tool name ${t.name}`);
        if (!t.name.startsWith(`${m.name}_`)) throw new ZeroError('INTERNAL', `Tool ${t.name} must be prefixed with its module name "${m.name}_"`);
      }
    }
    this.modules = modules;
  }

  get toolNames(): string[] {
    return [...this.registeredTools];
  }

  /** Dependency check: env vars + network hosts the module needs. */
  checkDependencies(policy: Policy, loaded: LoadedConfig, env: NodeJS.ProcessEnv): DependencyReport[] {
    return this.modules.map((m) => {
      if (!policy.isModuleEnabled(m.name, m.defaultEnabled)) return { module: m.name, status: 'disabled', problems: [] };
      const problems: string[] = [];
      let blocked = false;
      for (const req of m.requires?.env ?? []) {
        const v = env[req.name];
        if (!v || v.includes('${')) {
          problems.push(`${req.optional ? 'optional' : 'REQUIRED'} env ${req.name} not set — ${req.purpose}`);
          if (!req.optional) blocked = true;
        }
      }
      for (const host of m.requires?.hosts ?? []) {
        try {
          policy.assertUrl(`https://${host}/`);
        } catch (e) {
          problems.push(`host ${host} not reachable by policy: ${(e as Error).message}`);
          blocked = true;
        }
      }
      void loaded;
      return { module: m.name, status: blocked ? 'blocked' : problems.length ? 'degraded' : 'ok', problems };
    });
  }

  /** Dependency report against the environment the server was started with. */
  dependencyReport(policy: Policy, loaded: LoadedConfig): DependencyReport[] {
    return this.checkDependencies(policy, loaded, this.env);
  }

  registerAll(server: McpServer, base: Omit<ToolContext, 'env' | 'registry'>, processEnv: NodeJS.ProcessEnv): void {
    this.env = processEnv;
    for (const m of this.modules) {
      if (!base.policy.isModuleEnabled(m.name, m.defaultEnabled)) continue;
      const env: Record<string, string | undefined> = {};
      for (const req of m.requires?.env ?? []) {
        const v = processEnv[req.name];
        env[req.name] = v && !v.includes('${') ? v : undefined;
      }
      const ctx: ToolContext = { ...base, env, registry: this };
      const settings = base.loaded.config.modules[m.name];

      for (const tool of m.tools) {
        if (settings?.tools[tool.name] === 'deny') continue; // hidden entirely: saves context, removes temptation
        this.registeredTools.add(tool.name);
        const wrapped = async (args: unknown) => this.invoke(m, tool, args, ctx);
        // The SDK validates `args` against `inputSchema` before calling us.
        server.registerTool(
          tool.name,
          { title: tool.title, description: tool.description, inputSchema: tool.input, annotations: { title: tool.title, ...tool.annotations } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          wrapped as any,
        );
      }
    }
  }

  /** The single execution pipeline: policy → usage → handler → audit → error mapping. */
  async invoke(m: ZeroModule, tool: ToolDef, args: unknown, ctx: ToolContext) {
    const started = Date.now();
    const settings = ctx.loaded.config.modules[m.name];
    try {
      ctx.policy.assertTool(m.name, tool.name, m.defaultEnabled);
      ctx.usage.consume(m.name, settings?.ratePerMinute, settings?.sessionQuota);
      // args were already validated against tool.input by the SDK; re-parse to apply defaults
      // even when invoke() is called directly (tests, future transports).
      const parsed = tool.input.safeParse(args ?? {});
      if (!parsed.success) throw new ZeroError('INVALID_INPUT', parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '));
      const result = await tool.handler(parsed.data as Record<string, unknown>, ctx);
      ctx.audit.record({ module: m.name, tool: tool.name, outcome: 'ok', durationMs: Date.now() - started, args });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (raw) {
      const err = toZeroError(raw);
      const outcome = err.code === 'PERMISSION_DENIED' ? 'denied' : err.code === 'RATE_LIMITED' ? 'rate_limited' : 'error';
      ctx.audit.record({ module: m.name, tool: tool.name, outcome, durationMs: Date.now() - started, args, errorCode: err.code, message: err.message });
      if (err.code === 'INTERNAL') process.stderr.write(`[zero] internal error in ${tool.name}: ${(raw as Error)?.stack ?? err.message}\n`);
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `[${err.code}] ${err.message}${err.hint ? `\nHint: ${err.hint}` : ''}` }],
      };
    }
  }
}
