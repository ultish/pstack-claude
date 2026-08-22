---
name: new-branch-and-pr
description: Create a fresh branch, complete work, and open a pull request
---

# New branch and PR

## Trigger

Starting work that should be shipped through a clean branch and pull request workflow.

## Workflow

1. Ensure the working tree is clean or explicitly handled.
2. Create a descriptive branch from the latest main.
3. Complete implementation and tests.
4. Commit focused changes and push.
5. Create a concise PR/MR with summary and test notes:

   ```bash
   GIT_HOST_CLI=$(bash "$CLAUDE_PLUGIN_ROOT/scripts/git-host.sh") || exit 1

   if [ "$GIT_HOST_CLI" = "gh" ]; then
     gh pr create --title "<title>" --body "<summary + test notes>"
   else
     glab mr create --title "<title>" --description "<summary + test notes>"
   fi
   ```

   Both CLIs infer the source branch from the current checkout and the target branch from
   the repo default, and both support `--fill` to derive title/body from the branch's
   commits. The one mechanical difference is the body flag: gh's `--body` is glab's
   `--description`.

## Guardrails

- Keep branch scope focused on one change set.
- Include verification notes before requesting review.

## Output

- New branch name
- PR/MR summary and test notes
- PR/MR URL
