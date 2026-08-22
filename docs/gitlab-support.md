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
`review-and-ship`, `pr-review-canvas` (cursor-team-kit; GitHub-only today,
see its own skill file), and `poteto-mode`'s `opening-a-pr.md` / `babysit.md`
playbooks (pstack).

`weekly-review`, `what-did-i-get-done`, `verify-this`, and
`check-compiler-errors` don't call a host CLI at all (pure git log / local
test runs), so they aren't in this list.

## The watch-pr tool

`poteto-mode`'s structured PR/MR watcher (`scripts/watch-pr/watch-pr`, driven
by `babysit.md`) is a TypeScript tool, not a markdown skill, so it can't lean
on `git-host.sh` and a command-mapping table the way the skills above do —
its reads are typed and parsed, and a loose `gh`/`glab` dispatch would only
surface a shape mismatch at runtime. It re-detects the host itself
(`cli.ts`'s `detectHost`, same order as `git-host.sh`) and picks between two
full reader implementations:

- `github.ts` — shells to `gh`, queries GitHub's GraphQL API.
- `gitlab.ts` — shells to `glab api graphql`, queries GitLab's GraphQL API.

The two hosts' merge-readiness models aren't symmetric. GitHub's
`mergeStateStatus: BLOCKED` is ambiguous on its own (it can mean "actually
blocked" or "a required check hasn't reported a conclusive result yet"),
so `policy.ts` cross-checks the commit rollup before deciding. GitLab's
`detailedMergeStatus` doesn't have that ambiguity — it already names the
reason (`CONFLICT`, `CI_MUST_PASS`, `NOT_APPROVED`, `DRAFT_STATUS`, ...) —
so `gitlab.ts` resolves the common reasons directly into the same
conflict/review/draft/CI signals `policy.ts` already understands, and
never produces a GitHub-style `BLOCKED`. A `detailedMergeStatus` value with
no equivalent in this model (locked paths, Jira association, merge trains,
and similar enterprise-tier gates) makes the reader fail closed — a
`BLOCKER: status-query` verdict naming the exact GitLab status — rather
than risk reporting a merge request ready when GitLab itself is still
holding it back. `babysit.md` names the manual `glab mr view` / `glab ci
status` fallback for exactly that verdict.
