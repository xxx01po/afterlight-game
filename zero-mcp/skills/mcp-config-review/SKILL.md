---
name: mcp-config-review
description: Audit Claude Code and MCP configuration (.mcp.json, .claude/settings.json, ~/.claude/settings.json, plugin hooks) for secrets, over-broad permissions, unpinned servers and unsafe modes. Use when setting up a project, adding an MCP server, or when asked "is my setup safe?".
allowed-tools: Read Grep Glob
---

# MCP and Claude Code configuration review

1. **Locate the config:**
   - `.mcp.json` (project)
   - `.claude/settings.json` and `.claude/settings.local.json`
   - `~/.claude/settings.json`
   - plugin `hooks/hooks.json`

   Do not print the contents of `~/.claude.json`, because it can hold OAuth data. Lint it through ZERO instead.
2. **Run ZERO `security_lint_mcp_config`** on each file, either by `path` or with the JSON pasted in as `json`.
3. **Run ZERO `security_scan_secrets`** on the project root.
4. **Check by hand what the linter cannot know:**
   - Is every enabled MCP server actually used? Each one costs context tokens on every turn.
   - Do remote servers use the narrowest token? GitHub: fine-grained PAT, `X-MCP-Readonly: true`.
   - Is the project-level `.mcp.json` committed without secrets? Values must be `${VAR}`.
   - Are hooks scripts you have read? A hook runs with your full user permissions.
5. **Recommend a fix for every issue.** Give the exact JSON change, with the most severe issue first. Do not edit the user's global settings without asking.

Reference rules: permission rules are evaluated deny, then ask, then allow. `defaultMode: bypassPermissions` is honored only from user or managed settings. Use `Read(./.env)` deny rules, because `.claudeignore` has no effect.
