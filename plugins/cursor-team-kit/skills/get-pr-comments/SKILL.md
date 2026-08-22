---
name: get-pr-comments
description: Fetch and summarize review comments from the active pull request
---

# Get PR comments

## Trigger

Need a concise, actionable summary of feedback on the active pull request.

## Workflow

1. Detect the git host CLI:

   ```bash
   GIT_HOST_CLI=$(bash "$CLAUDE_PLUGIN_ROOT/scripts/git-host.sh") || exit 1
   ```

2. Resolve the active PR/MR for the current branch:

   ```bash
   if [ "$GIT_HOST_CLI" = "gh" ]; then
     gh pr view --json number,title,url,state
   else
     glab mr view
   fi
   ```

3. Fetch review comments and discussion comments:

   ```bash
   if [ "$GIT_HOST_CLI" = "gh" ]; then
     gh api repos/{owner}/{repo}/pulls/<PR>/comments   # inline, diff-line review comments
     gh pr view <PR> --json comments                    # general discussion comments
   else
     glab api "projects/:id/merge_requests/<MR>/discussions"
   fi
   ```

   GitHub splits PR feedback into two distinct kinds — inline review comments tied to a
   diff line (`pulls/{n}/comments`) and general discussion comments (`pr view --json
   comments`, or `issues/{n}/comments`). GitLab has no matching split: `merge_requests/{n}/
   discussions` returns every thread, general MR comments and diff-line notes alike, mixed
   together in one list. Distinguish the two kinds client-side by checking whether a note's
   `position` field is set (present only on diff notes) rather than expecting two separate
   calls.

4. Group feedback by severity and actionability.
5. Return a concise action list.

## Output

- Grouped feedback summary
- Action list ordered by priority
- Open questions that still need clarification
