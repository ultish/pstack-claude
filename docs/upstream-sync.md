# Upstream sync tracking

This repo re-derives `plugins/pstack` and `plugins/cursor-team-kit` from
[`cursor/plugins`](https://github.com/cursor/plugins) (upstream: `pstack/` and
`cursor-team-kit/` at the repo root) as native Claude Code plugins. It is a
translation, not a subtree/vendor pull, so there is no single upstream commit
this repo is "pinned to" — instead we track the upstream commit SHA we last
diffed against, so the next comparison only has to cover what changed since.

## Last compared

- **Upstream commit:** `f5bdd6826fd0a0d9cbc4347134c3a74a200b9d9d` (2026-09-10)
- **Compared on:** 2026-09-12
- **Local commit at comparison time:** `681e1da` (fix: dispatch poteto-agent with
  plugin-namespaced subagent_type)
- **Prior sync point:** `68836dd` (2026-08-28), compared 2026-08-29. See the
  entry below this one for that comparison's own findings and baseline.

### Findings from this comparison (10 commits since `68836dd`, one skipped)

- **Skipped: `2b8ae2e` (feat(grok-voice): add Grok Voice plugin).** A brand-new,
  separate upstream plugin (`add-voice`, `add-dictation`, `add-read-aloud`,
  `debug-voice`), not part of `pstack`. Out of scope for this port.
- **Ported: `disable-model-invocation: true` on four skills** (`73f8be4`).
  Upstream added the field to `how`, `typescript-best-practices`, `unslop`,
  and `why` (plus `make-bot-ui`, not ported, still deferred). This repo's
  copies never had it because they predate that upstream commit. Added
  verbatim to all four here — the field's meaning is unchanged across
  Cursor/Claude Code per `docs/cursor-to-claude.md`.
- **New skill, ported: `principle-attack-the-premise`** (from `e8d856f`).
  Generic content, no Cursor-specific references, copied as-is except frontmatter:
  this repo's 21 existing `principle-*` skills all omit
  `disable-model-invocation` (upstream's have it) — a consistent, apparently
  deliberate divergence from the initial 2026-08-22 port, so the field was left
  off here too for consistency rather than re-introduced. Its
  `[text](../principle-x/SKILL.md)`-style cross-links were rewritten to this
  repo's own bold-name-plus-phrase style (see `typescript-best-practices` for
  the pattern), since no other principle skill here uses relative markdown links.
- **New skill, ported: `principle-test-behavior-not-implementation`** (from
  `e8d856f`). Generic, no translation needed, no cross-links to rewrite.
- **Ported: TypeScript schema-over-guards rule** (`23a56e2`, "prefer schemas at
  TypeScript boundaries"). Added a "Schemas before guards" row to
  `typescript-best-practices/SKILL.md`'s table and a matching "Schemas before
  hand-rolled guards" section to `references/patterns.md`, plus the
  "creation" → "the boundary" wording fix on Branded types in both files.
  Added `paths: ["**/*.ts", "**/*.tsx"]` to the skill's frontmatter to match
  upstream.
- **Updated: Fable 5 → Fable 5.1** (`23a56e2`, "route solo defaults to Fable
  5.1"). This repo's `docs/cursor-to-claude.md` and
  `setup-pstack/SKILL.md` still named `claude-fable-5` as the current slug;
  the live session for this comparison confirms `claude-fable-5-1` is what's
  actually available now, so both were updated (the model list in
  `cursor-to-claude.md` is a snapshot to be re-verified per session anyway,
  per its own text).
- **Ported: "every claim carries its evidence or its label"** (`f8abedd`).
  One-line addition to `poteto-mode/SKILL.md`'s Writing the reply list,
  copied verbatim (no translation needed).
- **Ported: status-tick wording fix** (`f5bdd68`, "operator-neutral pronouns +
  in-chat status tick"). Upstream's gendered-pronoun fixes only touch
  `autopilot-full.md`/`autopilot-stack.md` (deferred here, not touched) and
  already-neutral text in `poteto-mode/SKILL.md` (this repo already says "the
  user" and "their", not "she"/"her" — no-op here). The one substantive change,
  "send the operator a status message" → "post a status message to the
  operator in chat" (so a status update posts in the running chat, not to a
  named person or channel), was ported into `multi-phase-plan.md`'s tick
  prompt, translated to "the user" per this repo's convention.
- **Not ported, no action needed: `d7cde2b` and part of `e8d856f`**
  ("replace semicolons, em dashes, and connector colons..." / "density and
  mannered-prose pass"). Mechanical, wide prose-style passes across ~65
  upstream files. Em-dash and colon-overuse rules are already in this repo's
  own `unslop/SKILL.md` (rules 13-14); a semicolon rule was never actually
  added to upstream's `unslop/SKILL.md` either (checked — it's not there), so
  there's no persistent rule to port, only one-off wording tidied in files
  this repo independently authored. Skipped as noise, not drift.
- **Not ported, doesn't apply: `efa2a53` + `7314f72`** (plugin logo add +
  resize). Cursor's `.cursor-plugin/plugin.json` and marketplace UI support a
  logo asset; Claude Code's plugin.json schema (used by this repo's
  `.claude-plugin/plugin.json`) has no equivalent field today. Revisit if
  Claude Code's plugin manifest gains an icon/logo field.
- **Not ported, out of current scope: rest of `23a56e2`** ("forge-neutral
  playbooks", the `shipping.md`/`opening-a-pr.md` Origin-vs-GitHub rework).
  `shipping.md` doesn't exist in this repo yet (deliberately deferred, see
  `TODO.md`'s Graphite/RemoteTrigger note), and the changed parts of
  `opening-a-pr.md` are almost entirely about dispatching to "Origin" (a
  Cursor-specific forge CLI with no Claude Code analog) rather than the
  gh/glab split this repo already handles via `docs/gitlab-support.md`.
  Worth another look if/when `shipping.md` gets designed: upstream moved
  its merge strategy away from Graphite auto-drain to one-PR-at-a-time
  landing, which lines up with `TODO.md`'s own note that "the merge step can
  sidestep Graphite entirely here by merging one PR at a time."
- **`71ed0d1`** was just upstream's own version bump and doc skill-count sync;
  no content to port. This repo's `plugins/pstack` version is tracked
  independently of upstream's — bumped to `0.4.0` alongside this comparison's
  changes since two new skills were added.

## Prior comparison (2026-08-29, superseded by the entry above)

- **Upstream commit at that comparison:** `68836ddaf5697224520f1847d90cdb90ca8baba` (2026-08-28)
- **Local commit at that comparison:** `d379287` (chore: bump cursor-team-kit plugin.json to 0.1.1)
- **Baseline before that comparison:** the initial port, `568d611` (2026-08-22), which
  re-derived all 44 upstream `pstack` skills current as of that date.

Findings from that comparison:

- **New skill, not yet ported: `make-bot-ui`** (added upstream 2026-08-27,
  `799151d`/`6fecddb`). Builds a UI that wakes a Grok Bot over a Cursor webhook
  routine (`update_state` with `target: routine`) — Cursor-cloud-specific
  (routines, sender keys, Tailscale exposure via Cursor's own mechanism), needs
  a translation pass like the rest of `poteto-mode`'s deferred playbooks before
  it's portable, not a drop-in copy. Still not ported as of the 2026-09-12
  comparison above.
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
