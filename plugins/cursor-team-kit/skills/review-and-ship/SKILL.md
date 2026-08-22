---
name: review-and-ship
description: Review the current branch for bugs, intent fit, and test coverage; run or write tests; commit focused work; open or update a PR/MR.
---

# Review and ship

## Trigger

Reviewing changes before shipping. Close key issues, verify behavior, and open or update a PR/MR.

## Workflow

1. Gather context: diff against base branch, uncommitted changes, recent commits, changed files, and user intent from recent relevant chats if useful.
2. Run targeted tests for changed behavior. If no focused tests exist, decide whether to add them or document the gap.
3. Review for correctness, regressions, security, and intent fit. Use parallel subagents for larger diffs.
4. Fix critical issues before finalizing and re-run affected tests.
5. Commit selective files with a concise message.
6. Push branch and open or update a PR/MR.

## Suggested Checks

Detect the host CLI first — `bash "$CLAUDE_PLUGIN_ROOT/scripts/git-host.sh"` prints `gh` or `glab` (see `docs/gitlab-support.md` in the repo root for the detection and command-mapping details).

```bash
git fetch origin main
git diff origin/main...HEAD
git status
# gh:
gh pr checks --json name,bucket,state,workflow,link
# glab:
glab ci status
```

## Guardrails

- Prioritize correctness, security, and regressions over style-only comments.
- Keep commits focused and avoid unrelated file changes.
- If pre-commit checks fail, fix the issues rather than bypassing hooks.
- Use the detected host CLI's check-status command (`gh pr checks` or `glab ci status`) instead of a CI-provider-specific command when judging PR/MR readiness.

## Output

- Findings summary (critical, warning, note)
- Tests run and outcomes
- PR/MR URL
