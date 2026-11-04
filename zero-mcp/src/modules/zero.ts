import * as z from 'zod';
import type { ZeroModule } from '../core/module.js';
import { VERSION } from '../version.js';

export const zeroModule: ZeroModule = {
  name: 'zero',
  description: 'Self-introspection: configuration, module/dependency status, usage counters and the action journal.',
  defaultEnabled: true,
  tools: [
    {
      name: 'zero_status',
      title: 'ZERO status & dependency check',
      description:
        'Report ZERO version, where the config was loaded from, every module with status (ok | degraded | blocked | disabled) and the reason, registered tools, filesystem roots, network allowlist and per-module usage counters. Call this first when a ZERO tool fails or to see what is available.',
      input: z.object({}),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      async handler(_args, ctx) {
        const deps = ctx.registry.dependencyReport(ctx.policy, ctx.loaded);
        return {
          version: VERSION,
          configSource: ctx.loaded.source,
          projectDir: ctx.loaded.projectDir,
          modules: ctx.registry.modules.map((m) => ({
            name: m.name,
            description: m.description,
            ...deps.find((d) => d.module === m.name),
            tools: m.tools.map((t) => t.name),
            limits: { ratePerMinute: ctx.loaded.config.modules[m.name]?.ratePerMinute ?? null, sessionQuota: ctx.loaded.config.modules[m.name]?.sessionQuota ?? null },
          })),
          registeredTools: ctx.registry.toolNames,
          filesystem: { allowedRoots: ctx.policy.allowedRoots, denySegments: ctx.loaded.config.filesystem.denySegments },
          network: { enabled: ctx.loaded.config.network.enabled, allowedHosts: ctx.loaded.config.network.allowedHosts },
          usage: ctx.usage.snapshot(),
          auditLog: ctx.audit.filePath ?? 'disabled',
        };
      },
    },
    {
      name: 'zero_audit_tail',
      title: 'Recent ZERO actions',
      description: 'Return the most recent ZERO tool calls from this session (arguments already redacted): tool, outcome, duration, error code. Use to explain what was done or to debug failures.',
      input: z.object({ limit: z.number().int().min(1).max(200).default(20) }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      async handler({ limit }, ctx) {
        return { entries: ctx.audit.tail(limit) };
      },
    },
  ],
};
