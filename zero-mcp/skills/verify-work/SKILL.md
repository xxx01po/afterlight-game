---
name: verify-work
description: Run the project's real verification (install, typecheck, lint, tests, build) and report results honestly before claiming a task is done. Use before every commit/PR and whenever the user asks "does it work?".
---

# Verify before claiming

1. Call ZERO `project_inspect`. It returns the install command and the exact verification scripts for this repository.
2. Install dependencies. Use the lockfile-respecting command (`npm ci`, `pnpm install --frozen-lockfile`). If the project has lifecycle scripts you have not reviewed, prefer `--ignore-scripts` and say so.
3. Run each check in this order: typecheck, lint, test, build. Capture the exit code and the last relevant lines of output.
4. On failure:
   - reproduce it
   - fix the root cause
   - re-run the same check

   Never skip, disable or weaken a test to get a green result.
5. Report a table: check | command | result (pass/fail/not run) | evidence.

Rules:
- "Not run" is an honest answer. "Passed" without having run the check is not.
- Name the checks that were not possible (no browser, no network, no credentials) and why.
