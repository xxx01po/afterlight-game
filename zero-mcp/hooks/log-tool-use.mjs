#!/usr/bin/env node
// ZERO PostToolUse journal: one JSONL line per Claude Code tool call, written to
// <project>/.zero/claude-actions.jsonl. Stores tool name + a short, redacted summary —
// never file contents or full outputs. Runs async so it never slows Claude down.
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { HIGH_CONFIDENCE } from './guard-write.mjs';

export function summarize(toolName, toolInput = {}) {
  let s;
  if (toolName === 'Bash') s = String(toolInput.command ?? '');
  else if (toolInput.file_path) s = String(toolInput.file_path);
  else if (toolInput.url) s = String(toolInput.url);
  else if (toolInput.pattern) s = `pattern=${toolInput.pattern}`;
  else s = Object.keys(toolInput).slice(0, 5).join(',');
  for (const [, re] of HIGH_CONFIDENCE) s = s.replace(new RegExp(re.source, 'g'), '[REDACTED]');
  s = s.replace(/((?:token|secret|password|api[_-]?key)\s*[=:]\s*)\S+/gi, '$1[REDACTED]');
  return s.length > 300 ? s.slice(0, 300) + '…' : s;
}

async function main() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  let input;
  try {
    input = JSON.parse(data);
  } catch {
    return;
  }
  const dir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const file = path.join(dir, '.zero', 'claude-actions.jsonl');
  const entry = {
    ts: new Date().toISOString(),
    session: input.session_id,
    agent: input.agent_type ?? 'main',
    tool: input.tool_name,
    summary: summarize(input.tool_name, input.tool_input),
    ok: input.tool_response?.is_error ? false : undefined,
  };
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, JSON.stringify(entry) + '\n', { mode: 0o600 });
  } catch {
    /* journaling must never break the session */
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
