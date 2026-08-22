# gh / glab support

pstack skills ported from Cursor assume GitHub (`gh pr ...`, `gh api ...`). This repo's
skills must work against GitHub or GitLab, since the user works in both.

## Detection

Every skill that shells out to a PR/MR host uses `scripts/git-host.sh` (present in both
`plugins/pstack/scripts/` and `plugins/cursor-team-kit/scripts/` — small enough to
duplicate rather than fight cross-plugin path resolution). It:

1. Reads `git remote get-url origin`.
2. `github.com` in the URL → `gh`.
3. Otherwise, if `glab` is on `PATH` → `glab` (covers gitlab.com and self-hosted GitLab,
   which can't be detected from the URL alone).
4. Otherwise, if `gh` is on `PATH` → `gh` (covers GitHub Enterprise Server, whose URL
   doesn't contain `github.com` either).
5. Neither present, or the remote is unrecognized → stop and ask the user which CLI and
   host to use. Don't guess silently.

A skill sources it, then reads `$GIT_HOST_CLI` (`gh` or `glab`) for the rest of the run.

## Command mapping

GitLab's CLI mirrors `gh`'s shape closely but renames "pull request" to "merge request"
and splits a few things differently. Skills that call `gh pr ...` / `gh api ...` need the
matching `glab` form, not a literal string substitution:

| Concept | `gh` | `glab` |
|---|---|---|
| View a PR/MR | `gh pr view` | `glab mr view` |
| List PRs/MRs | `gh pr list` | `glab mr list` |
| Create a PR/MR | `gh pr create` | `glab mr create` |
| Comment on a PR/MR | `gh pr comment` | `glab mr note` |
| List review comments | `gh api repos/{owner}/{repo}/pulls/{n}/comments` | `glab api projects/:id/merge_requests/{n}/discussions` |
| PR/MR checks status | `gh pr checks` | `glab ci status` (per-pipeline) or `glab mr view` (shows pipeline summary) |
| Merge | `gh pr merge` | `glab mr merge` |
| Raw API call | `gh api ...` | `glab api ...` (GitLab REST API shape, not GitHub's — paths differ, not just the host) |

A skill that needs an operation without a clean `glab` equivalent (GitLab's review-thread
model differs structurally from GitHub's PR-comment model, for instance) states the gap
explicitly rather than faking a lossy translation.

## Skills that need this

`fix-ci`, `get-pr-comments`, `make-pr-easy-to-review`, `new-branch-and-pr`,
`review-and-ship`, `check-compiler-errors` (CI logs), `weekly-review`,
`what-did-i-get-done`, `verify-this`, `pr-review-canvas` (cursor-team-kit), and
`poteto-mode`'s `opening-a-pr.md` / `babysit.md` playbooks (pstack).
