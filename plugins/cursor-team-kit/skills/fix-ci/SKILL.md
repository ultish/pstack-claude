---
name: fix-ci
description: Find failing PR checks, inspect logs or external check links, and apply focused fixes
---

# Fix CI

## Trigger

Branch or PR CI is failing and needs a fast, iterative path to green checks.

## Workflow

1. Source `$CLAUDE_PLUGIN_ROOT/scripts/git-host.sh` to set `GIT_HOST_CLI` (`gh` or `glab`), then resolve the active PR/MR and inspect its checks:
   - `gh`: `gh pr checks --json name,bucket,state,workflow,link`.
   - `glab`: `glab ci status` for the current pipeline's per-job status, or `glab mr view` for the pipeline summary.
2. Inspect failed jobs and extract the first actionable error.
   - `gh`: use GitHub Actions logs when available (`gh run view <run-id> --log-failed`); otherwise use the check link to identify the failing command or service.
   - `glab`: use `glab ci trace` for the failing job's log; otherwise use the check link to identify the failing command or service.
   - Either host: fall back to the raw API (`gh api ...` or `glab api ...`) when the CLI's built-in views don't surface enough detail. GitLab's REST shape differs from GitHub's, not just the host — don't reuse GitHub paths against `glab api`.
3. Apply the smallest safe fix.
4. Push, re-check the PR/MR check set, and repeat until green.

## Guardrails

- Fix one actionable failure at a time.
- Prefer minimal, low-risk changes before broader refactors.
- Keep `gh pr checks` (or `glab ci status`/`glab mr view` on GitLab) as the source of truth for overall PR/MR CI state.

## Output

- Primary failing job and root error
- Fixes applied in iteration order
- Current CI status and next action
