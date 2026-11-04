---
name: github-research
description: Systematically research and rank open-source tools for a capability (e.g. "best MCP server for browser automation", "memory for Claude Code"). Use when the user asks to find, compare or audit GitHub projects or MCP servers.
---

# GitHub capability research

Goal: a short, evidence-backed ranking. A long list sorted by stars is not the goal.

## Method

1. **Define the capability and the constraints.** Write down what the tool must do. Then note the constraints: local or hosted, budget, and whether secrets are allowed. Also check what the platform already gives you. Claude Code has built-in Read/Edit/Grep/Glob, Bash, WebFetch, WebSearch, subagents, skills and hooks. A server that only duplicates these is a **reject**.
2. **Cast a wide net.** Combine the sources below. Use at least two queries: one sorted by stars, and one filtered to recent pushes (`pushed:>YYYY-MM-DD`), so new projects are not drowned out.
   - GitHub search (`gh api search/repositories` if available, or the web UI)
   - the official MCP registry and `modelcontextprotocol/servers`
   - vendor-official servers (e.g. `github/github-mcp-server`, `microsoft/playwright-mcp`)
   - curated lists, as leads only
3. **Shortlist 3 to 6 candidates.** Prefer, in order: official vendor, then reference implementation, then well-maintained community. Popularity is a weak signal, because stars can be farmed. Six-figure star counts on very young repos deserve suspicion.
4. **Score with ZERO.** Run `github_compare_repos` on the shortlist and `security_check_npm_package` on each launch package.
5. **Verify in the source.** For the top two, read the README options, the LICENSE and the main entry file. Look for telemetry defaults, read-only modes and scope flags.
6. **Report the result:**
   - the ranking, with one-line reasons
   - the chosen option, with a pinned install line
   - the rejected options, each with its reason
   - what you could not verify

Keep facts and inferences separate. Mark anything you did not check yourself as **unverified**.
