import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as z from 'zod';
import { ZeroError } from '../core/errors.js';
import type { ZeroModule } from '../core/module.js';

const Entry = z.object({
  id: z.string(),
  name: z.string(),
  repo: z.string().url(),
  category: z.enum(['CORE', 'DEVELOPMENT', 'RESEARCH', 'AUTOMATION', 'MEMORY', 'GITHUB', 'BROWSER', 'MEDIA', 'BUSINESS', 'SECURITY']),
  purpose: z.string(),
  decision: z.enum(['integrate', 'optional', 'defer', 'reject']),
  reason: z.string(),
  license: z.string(),
  cost: z.string(),
  secrets: z.array(z.object({ name: z.string().regex(/^[A-Z][A-Z0-9_]*$/), purpose: z.string() })),
  requires: z.array(z.string()),
  transport: z.enum(['stdio', 'http']),
  launch: z.object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    url: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
  }),
  risks: z.array(z.string()),
  hardening: z.array(z.string()),
  quality: z.number().min(0).max(10),
});
export type CatalogEntry = z.infer<typeof Entry>;

const Catalog = z.object({ verifiedAt: z.string(), entries: z.array(Entry) });

let cache: z.infer<typeof Catalog> | undefined;
export function loadCatalog(file = fileURLToPath(new URL('../../catalog/servers.json', import.meta.url))) {
  if (cache) return cache;
  const parsed = Catalog.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) throw new ZeroError('INTERNAL', `catalog/servers.json is invalid: ${parsed.error.issues[0]?.message}`);
  // Guard: a catalog entry must never carry a literal secret.
  for (const e of parsed.data.entries) {
    for (const v of [...Object.values(e.launch.env ?? {}), ...Object.values(e.launch.headers ?? {})]) {
      if (/(token|key|secret|bearer)/i.test(v) && !/\$\{[A-Z0-9_]+(:-[^}]*)?\}/.test(v)) throw new ZeroError('INTERNAL', `catalog entry ${e.id} contains a literal credential`);
    }
  }
  cache = parsed.data;
  return cache;
}

export function renderMcpJson(entries: CatalogEntry[]) {
  const mcpServers: Record<string, unknown> = {};
  for (const e of entries) {
    if (e.transport === 'http') mcpServers[e.id] = { type: 'http', url: e.launch.url, ...(e.launch.headers ? { headers: e.launch.headers } : {}) };
    else mcpServers[e.id] = { command: e.launch.command, args: e.launch.args ?? [], ...(e.launch.env ? { env: e.launch.env } : {}) };
  }
  return { mcpServers };
}

export const catalogModule: ZeroModule = {
  name: 'catalog',
  description: 'Vetted catalog of external MCP servers with pinned versions, decisions and hardening flags. Never installs anything.',
  defaultEnabled: true,
  tools: [
    {
      name: 'catalog_list',
      title: 'List vetted MCP servers',
      description:
        'Return ZERO\'s vetted catalog of external MCP servers: purpose, decision (integrate | optional | defer | reject) with reasons, license, cost, required secrets (names only), risks and hardening flags. Filter by category or decision. Use before suggesting any new MCP server to the user.',
      input: z.object({
        category: z.enum(['CORE', 'DEVELOPMENT', 'RESEARCH', 'AUTOMATION', 'MEMORY', 'GITHUB', 'BROWSER', 'MEDIA', 'BUSINESS', 'SECURITY']).optional(),
        decision: z.enum(['integrate', 'optional', 'defer', 'reject']).optional(),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      async handler({ category, decision }) {
        const c = loadCatalog();
        const entries = c.entries.filter((e) => (!category || e.category === category) && (!decision || e.decision === decision));
        return { verifiedAt: c.verifiedAt, count: entries.length, entries: entries.map(({ launch: _launch, ...rest }) => rest) };
      },
    },
    {
      name: 'catalog_render_mcp_json',
      title: 'Render .mcp.json for catalog servers',
      description:
        'Produce a ready-to-review .mcp.json snippet for selected catalog ids with pinned versions and hardening flags. Secrets appear only as ${VAR} placeholders that Claude Code expands from the user\'s environment. Returns text — it does NOT write any file; the user decides where to put it. Rejected entries are refused.',
      input: z.object({ ids: z.array(z.string()).min(1).max(20) }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      async handler({ ids }) {
        const c = loadCatalog();
        const chosen: CatalogEntry[] = [];
        const problems: string[] = [];
        for (const id of ids) {
          const e = c.entries.find((x) => x.id === id);
          if (!e) problems.push(`unknown id "${id}"`);
          else if (e.decision === 'reject') problems.push(`"${id}" is rejected: ${e.reason}`);
          else chosen.push(e);
        }
        if (!chosen.length) throw new ZeroError('INVALID_INPUT', problems.join('; '));
        return {
          mcpJson: renderMcpJson(chosen),
          requiredEnv: chosen.flatMap((e) => e.secrets.map((s) => ({ server: e.id, ...s }))),
          problems,
          nextSteps: [
            'Review the snippet, then merge it into .mcp.json (project) or add with `claude mcp add-json <name> \'<json>\' --scope user`.',
            'Export required env vars in your shell profile — never paste values into the JSON.',
            'Run security_lint_mcp_config on the final file.',
          ],
        };
      },
    },
  ],
};
