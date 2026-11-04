#!/usr/bin/env node
// ZERO PreToolUse guard for Bash. Dependency-free on purpose (runs before every shell command).
// deny  → command is blocked, reason is shown to Claude.
// ask   → user must confirm (irreversible or outward-facing actions).
// none  → normal permission flow continues.
// Docs: https://code.claude.com/docs/en/hooks (PreToolUse, hookSpecificOutput.permissionDecision)

/** @type {{ id: string, decision: 'deny' | 'ask', re: RegExp, reason: string }[]} */
export const RULES = [
  { id: 'rm-root', decision: 'deny', re: /\brm\s+(?:-[A-Za-z]*\s+)*-[A-Za-z]*[rR][A-Za-z]*\s+(?:-[A-Za-z-]+\s+)*(?:\/|\/\*|~\/?|\$HOME\/?|\$\{HOME\}\/?|\.\.?\/?)(?:\s|$|;|&)/, reason: 'Recursive delete of /, ~, $HOME or the current/parent directory' },
  { id: 'no-preserve-root', decision: 'deny', re: /--no-preserve-root/, reason: 'rm --no-preserve-root' },
  { id: 'pipe-to-shell', decision: 'deny', re: /\b(?:curl|wget|fetch|iwr)\b[^|;&]*\|\s*(?:sudo\s+)?(?:ba|z|da|k)?sh\b|\b(?:curl|wget)\b[^|;&]*\|\s*(?:sudo\s+)?(?:python3?|node|perl|ruby)\b/, reason: 'Piping a download straight into an interpreter executes unreviewed code' },
  { id: 'disk-wipe', decision: 'deny', re: /\b(?:mkfs(?:\.\w+)?|wipefs)\b|\bdd\b[^;&|]*\bof=\/dev\/(?:sd|nvme|disk|hd)/, reason: 'Filesystem/disk destruction' },
  { id: 'fork-bomb', decision: 'deny', re: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, reason: 'Fork bomb' },
  { id: 'chmod-777-root', decision: 'deny', re: /\bchmod\s+(?:-R\s+)?0?777\s+(?:\/|~|\$HOME)(?:\s|$)/, reason: 'World-writable permissions on / or home' },
  { id: 'tls-off', decision: 'deny', re: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*0|\bgit\s+config\b[^;&|]*http\.sslVerify\s+false|\bcurl\b[^;&|]*\s(?:-k|--insecure)\b|PYTHONHTTPSVERIFY\s*=\s*0/, reason: 'Disabling TLS verification' },
  { id: 'git-force-push', decision: 'ask', re: /\bgit\s+push\b(?=[^;&|]*(?:\s--force(?!-with-lease)\b|\s-f\b|\s\+\S))/, reason: 'Force push rewrites remote history' },
  { id: 'git-push-default', decision: 'ask', re: /\bgit\s+push\b[^;&|]*\s(?:origin\s+)?(?:main|master)(?:\s|$)/, reason: 'Direct push to main/master' },
  { id: 'git-destructive', decision: 'ask', re: /\bgit\s+(?:reset\s+--hard|clean\s+-[A-Za-z]*f|checkout\s+--\s+\.|branch\s+-D|filter-branch|filter-repo)\b/, reason: 'Discards local work or rewrites history' },
  { id: 'git-no-verify', decision: 'ask', re: /\bgit\s+(?:commit|push)\b[^;&|]*--no-verify\b/, reason: 'Skips repository hooks/checks' },
  { id: 'publish', decision: 'ask', re: /\b(?:npm|pnpm|yarn|bun)\s+(?:npm\s+)?publish\b|\btwine\s+upload\b|\bcargo\s+publish\b|\bgh\s+release\s+create\b/, reason: 'Publishing a package/release is public and hard to undo' },
  { id: 'sudo', decision: 'ask', re: /(?:^|[;&|]\s*)sudo\s/, reason: 'Privilege escalation' },
  { id: 'env-dump', decision: 'ask', re: /(?:^|[;&|]\s*)(?:printenv|env|set)\s*(?:$|[;&|])|\becho\s+[^;&|]*\$\{?[A-Z_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Z_]*\}?|\bcat\s+[^;&|]*\.env(?:\.[\w-]+)?(?:\s|$)/, reason: 'May print secrets into the transcript' },
  { id: 'remote-exec', decision: 'ask', re: /\b(?:npx|bunx|pnpx|uvx)\s+(?:-y\s+|--yes\s+)?(?:@[^\s/]+\/)?[^\s@]+@latest\b/, reason: 'Runs the latest, unreviewed version of a package — pin a version' },
];

/** @param {string} command */
export function evaluateCommand(command) {
  if (typeof command !== 'string' || !command.trim()) return null;
  // Normalise line continuations so rules see one logical command.
  const cmd = command.replace(/\\\n/g, ' ');
  const hits = RULES.filter((r) => r.re.test(cmd));
  if (!hits.length) return null;
  const deny = hits.find((h) => h.decision === 'deny');
  const top = deny ?? hits[0];
  return {
    decision: top.decision,
    ruleIds: hits.map((h) => h.id),
    reason: `ZERO guard [${hits.map((h) => h.id).join(', ')}]: ${hits.map((h) => h.reason).join('; ')}.` + (deny ? ' Blocked. If this is truly intended, the user can run it manually.' : ' Needs explicit user confirmation.'),
  };
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    process.exit(0); // malformed input: do not interfere
  }
  if (input?.tool_name !== 'Bash') process.exit(0);
  const verdict = evaluateCommand(input?.tool_input?.command);
  if (!verdict) process.exit(0);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: verdict.decision, permissionDecisionReason: verdict.reason } }));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
