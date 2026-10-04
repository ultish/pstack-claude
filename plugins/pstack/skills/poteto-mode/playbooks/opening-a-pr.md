### Opening a PR

Invoked at the end of every other playbook.

**Worktree.** Work from a git worktree off main; subagents inherit it. Multiple `Agent` calls on the same branch each get their own worktree, or `git fetch && git reset --hard origin/<branch>` between them. Dirty branch with unrelated work: patch out, fresh worktree, apply. Snarled worktree: reset from main, redo minimally.

**Commits.** Commit liberally; rebase into small, ordered commits before opening PRs/MRs. Each commit is a future PR/MR: landable, ordered to tell the story. Amend when the fix belongs in a just-made commit; new commit when separable.

**PRs.** Run `/deslop` from `cursor-team-kit` over the diff before commit. Run `/no-comments` before review. Write every PR title, PR description, and commit body with `/technical-writing`, then apply `/unslop`. Apply every technical-writing layer except Diátaxis. Use one word for each action, keep articles, and avoid `-ing` when a plain verb works.

**Titles.** Use Conventional Commits in the form `type(scope): subject`. Use `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, or `perf` as the type. Use the changed area, such as `pstack` or `poteto-mode`, as the scope. Keep the subject short and imperative. Apply the same `/technical-writing` and `/unslop` pass as the body. Name a real symbol when one carries the change. For example, `fix(pstack): retarget opening-a-pr babysit trigger`. Do not add a trailing period.

**Descriptions.** The PR body is a briefing, not the lab notebook. A reviewer who has the diff should learn why the change exists, what it leaves out, what it could break, and how you proved it works, in under a minute. Write short, simple sentences with few identifiers. Do not write walls of text. Put each section under a `##` heading, not a bold lead-in, so the sections stand apart. Use these sections in order. Drop a section when it is empty.

- `## Why` gives the problem and the approach in one to three short sentences.
- `## What changed` has one to three short bullets. Name a real symbol or path only when it carries the change. Name both sides of a rename or retarget.
- `## Scope` always names what the PR covers and what it deliberately leaves out, for example a related follow-up or a known gap. Use one to three short items. Do not list symbols or paths, and do not write a file-by-file essay.
- `## Tradeoffs` states real choices only. Skip this section when there are none.
- `## Blast Radius` gives one or two sentences on who or what the change touches and why that is safe or risky. If main is red without the fix, name the continuing cost.
- `## Verification` has one to three bullets. Each bullet names a real run path, such as `control-cli`, `control-ui`, or the targeted tests, and its outcome. For a performance change, report one primary number with its unit in `before → after` form, and link the artifact that holds the remaining evidence.

After these sections, attach videos or screenshots when they prove a claim. Do not use `## Summary` or `## Test plan` boilerplate. A commit body does not restate its subject.

**Size and stacks.** Prefer five narrow PRs to one large PR. Stack follow-ups with Graphite (`gt`) when it's installed, and keep the ordered stack visible to reviewers. Branch from main only for independent work. Rebase on `main` before substantial stack work.

**Readiness.** Open every PR/MR ready, never as a draft. Automated PR-creation tools sometimes default to draft, so set `draft: false` on every PR creation call (GitLab's `glab mr create` has no draft default to fight; it opens ready unless `--draft` is passed). If a PR still opens as a draft, run the host's ready command. Detect the host CLI first — `bash "$CLAUDE_PLUGIN_ROOT/scripts/git-host.sh"` prints `gh` or `glab` (see `docs/gitlab-support.md` in the repo root). Then:

- `gh`: `gh pr ready <number>` to un-draft; `gh pr view <number>` before referring to PR status.
- `glab`: `glab mr update <number> --ready` to un-draft; `glab mr view <number>` before referring to MR status.

**Babysit.** Opening a PR does not start a babysit. Post the URL and keep building. Finish the phase or stack first. Run a separate babysit pass only when the user asks for one after the whole stack exists. A babysit for each new PR stalls the build and spends checks on commits that later waves restart. Push back when feedback drifts from intent.

A subagent that opens a PR runs `interrogate`, `/deslop`, and `/no-comments`. It returns the URL and does not babysit. Return to the parent.
