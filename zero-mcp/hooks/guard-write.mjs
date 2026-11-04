#!/usr/bin/env node
// ZERO PreToolUse guard for Edit/Write/MultiEdit/NotebookEdit.
// Blocks writing high-confidence credentials into files and editing .env files.
// High-confidence rules mirror src/core/secrets.ts (kept in sync by tests/hooks.test.ts).

export const HIGH_CONFIDENCE = [
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/],
  ['github-fine-grained', /\bgithub_pat_[A-Za-z0-9_]{60,255}\b/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['openai-key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['stripe-live-key', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/],
  ['npm-token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/],
];

const ENV_FILE = /(?:^|[\\/])\.env(?:\.(?!example$|sample$|template$)[\w.-]+)?$/;

/** @param {string} toolName @param {Record<string, unknown>} toolInput */
export function evaluateWrite(toolName, toolInput) {
  const file = String(toolInput?.file_path ?? toolInput?.notebook_path ?? '');
  if (ENV_FILE.test(file)) {
    return { decision: 'ask', reason: `ZERO guard [env-file]: ${file} usually holds secrets. Confirm that this edit is intended and that the file is git-ignored.` };
  }
  const texts = [];
  for (const k of ['content', 'new_string', 'new_source']) if (typeof toolInput?.[k] === 'string') texts.push(toolInput[k]);
  if (Array.isArray(toolInput?.edits)) for (const e of toolInput.edits) if (typeof e?.new_string === 'string') texts.push(e.new_string);
  const joined = texts.join('\n');
  const hits = HIGH_CONFIDENCE.filter(([, re]) => re.test(joined)).map(([id]) => id);
  if (hits.length) {
    return { decision: 'deny', reason: `ZERO guard [${hits.join(', ')}]: the new content contains what looks like a live credential. Read it from an environment variable instead (process.env.X / \${X}). If it is a test fixture, use an obviously fake value.` };
  }
  return null;
}

async function main() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  let input;
  try {
    input = JSON.parse(data);
  } catch {
    process.exit(0);
  }
  const verdict = evaluateWrite(input?.tool_name, input?.tool_input ?? {});
  if (!verdict) process.exit(0);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: verdict.decision, permissionDecisionReason: verdict.reason } }));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
