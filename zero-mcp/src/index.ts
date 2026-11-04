#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './core/config.js';
import { Policy } from './core/permissions.js';
import { ModuleRegistry } from './core/module.js';
import { ALL_MODULES } from './modules/index.js';
import { buildServer } from './server.js';
import { VERSION } from './version.js';

// stdout belongs to the MCP protocol: all diagnostics go to stderr.
async function main() {
  if (process.argv.includes('--version')) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (process.argv.includes('--doctor')) {
    const loaded = loadConfig();
    const policy = new Policy(loaded.config, loaded.projectDir);
    const report = new ModuleRegistry(ALL_MODULES).checkDependencies(policy, loaded, process.env);
    process.stdout.write(JSON.stringify({ version: VERSION, node: process.version, config: loaded.source, projectDir: loaded.projectDir, allowedRoots: policy.allowedRoots, modules: report }, null, 2) + '\n');
    process.exitCode = report.some((r) => r.status === 'blocked') ? 1 : 0;
    return;
  }
  const { server } = buildServer();
  await server.connect(new StdioServerTransport());
  process.stderr.write(`[zero] v${VERSION} ready on stdio\n`);
}

main().catch((e) => {
  process.stderr.write(`[zero] fatal: ${(e as Error).message}\n`);
  process.exit(1);
});
