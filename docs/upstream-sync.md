# Upstream sync tracking

This repo re-derives `plugins/pstack` and `plugins/cursor-team-kit` from
[`cursor/plugins`](https://github.com/cursor/plugins) (upstream: `pstack/` and
`cursor-team-kit/` at the repo root) as native Claude Code plugins. It is a
translation, not a subtree/vendor pull, so there is no single upstream commit
this repo is "pinned to" — instead we track the upstream commit SHA we last
diffed against, so the next comparison only has to cover what changed since.

## Last compared

- **Upstream commit:** `68836ddaf5697224520f1847d90cdb90ca8baba` (2026-08-28)
- **Compared on:** 2026-08-29
- **Local commit at comparison time:** `d379287` (chore: bump cursor-team-kit plugin.json to 0.1.1)
- **Baseline (prior sync point):** the initial port, `568d611` (2026-08-22), which
  re-derived all 44 upstream `pstack` skills current as of that date. Nothing
  between 2026-08-22 and this sync's baseline had been diffed before.

### Findings from this comparison

- **New skill, not yet ported: `make-bot-ui`** (added upstream 2026-08-27,
  `799151d`/`6fecddb`). Builds a UI that wakes a Grok Bot over a Cursor webhook
  routine (`update_state` with `target: routine`) — Cursor-cloud-specific
  (routines, sender keys, Tailscale exposure via Cursor's own mechanism), needs
  a translation pass like the rest of `poteto-mode`'s deferred playbooks before
  it's portable, not a drop-in copy.
- **`poteto-mode/playbooks/multi-phase-plan.md` — ported.** Upstream reworked
  it on 2026-08-24 (`bdf7aa3`, "make the multi-PR plan a verified checklist")
  from a thin pointer at `references/plan.md` into a full checklist skeleton
  (arm the program, spawn owners, PR mechanics, verdict and merge, boot
  recipe, one section per PR) plus a new linter script `scripts/check-plan.mjs`
  that enforces the skeleton shape and verification wording. Ported into this
  repo on 2026-08-29: `references/plan.md` deleted (matching upstream),
  `check-plan.mjs` ported with the Cursor-only model slug
  (`grok-4.6-fast-xhigh`) generalized to "the swarm skill's worker model" and
  the `operator`/`Bugbot` terms swapped for `user`/"automated review bot" per
  `docs/cursor-to-claude.md`. The skeleton's "Arm the program" and "Boot
  recipe" sub-sections describe the standing-coordinator model (`/goal`, a
  per-lane cloud VM) that `orchestrate.md`/`autopilot-full.md`/
  `autopilot-stack.md`/`shipping.md` implement — those four stay deferred (see
  `TODO.md`), so the ported playbook flags that dependency inline and gives a
  manually-driven fallback (the user runs `/loop` and drives the checklist
  themselves) instead of inventing a design for the missing primitive.
  Self-tested by extracting the skeleton and running `check-plan.mjs` against
  it — 0 problems.
- Everything else in a raw recursive diff of `plugins/pstack/skills/` against
  upstream `pstack/skills/` is expected noise, not new drift:
  - Every ported `SKILL.md` differs byte-for-byte because the port is a
    translation (Cursor MDC frontmatter, tool names, etc.), not a copy — see
    `docs/cursor-to-claude.md`.
  - The four deliberately-deferred `poteto-mode` playbooks
    (`orchestrate.md`, `autopilot-full.md`, `autopilot-stack.md`,
    `shipping.md`) and their supporting scripts (`scripts/orch/`,
    `scripts/check-plan.mjs` prior to the 08-24 rework) are documented in
    `TODO.md`, not new.
  - `scripts/watch-pr/{gitlab.ts,gitlab.test.ts,reader-utils.ts}` are a local
    addition (GitLab support, `c590139`), not something missing from the port.

## How to compare next time

```bash
# 1. Update the upstream clone
git -C ~/Developer/pstack pull

# 2. List what changed upstream in pstack/ (and cursor-team-kit/ if relevant)
#    since the last-compared SHA above
git -C ~/Developer/pstack log --oneline <last-compared-sha>..HEAD -- pstack/ cursor-team-kit/

# 3. For each commit touching a path this repo actually ported, read the diff:
git -C ~/Developer/pstack show <commit> -- <path>

# 4. Update "Last compared" above with the new upstream SHA, date, and findings.
```

Prefer step 2's commit-range log over a raw recursive `diff` of the skill
directories — every `SKILL.md` differs from upstream by construction (it's a
translation), so a blind directory diff is mostly noise. The commit log
against the last-compared SHA is the actual signal.
