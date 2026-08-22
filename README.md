# pstack-claude

A Claude Code plugin marketplace that ports poteto's `pstack` agent style — and the
`cursor-team-kit` workflow skills it depends on — from Cursor to Claude Code. This isn't
a prompt-tweaking pack. It's an opinionated discipline for how an agent should approach
real engineering work: read before you write, type before you code, test before you
declare victory, and never hand back unverified claims.

## Why bring this to Claude Code

Left to its own judgment, an agent under time pressure tends to guess at shapes,
skip the failing-test step, and report success it hasn't actually checked. `pstack`
is poteto's answer to that: a set of skills, and a routing skill (`poteto-mode`) that
looks at what you're asking for and sends the work through the discipline that fits
it, instead of improvising. It was built for Cursor. This repo is a port of that
design — and the `cursor-team-kit` skills it depends on — so it works the same way
in Claude Code. None of the skills below are original to this repo; the value this
repo adds is the port itself, plus the additions and fixes in the changelog below.

- **`tdd`** — write the failing test first, watch it fail for the right reason, then
  make it pass.
- **`architect`** — sketch types, signatures, and module boundaries before code that
  crosses a function boundary, so the wrong shape doesn't get locked in.
- **`how`** / **`why`** — understand a subsystem's runtime behavior, or its design
  rationale, before changing it. `why` fans out across source control, tickets,
  docs, chat, observability, and error tracking in parallel and cites everything.
- **`arena`** / **`swarm`** — N independent attempts at a task, judged and merged,
  instead of committing to the first idea that seems plausible.
- **`interrogate`** — adversarial multi-model review that tries to break a change,
  not rubber-stamp it.
- **`blast-radius`** — proves a change is safe by running real code, not by asserting it.
- **`recall`** / **`reflect`** — reconstruct working context across sessions, and turn
  a transcript's friction points into concrete skill edits.
- **`show-me-your-work`** — a reviewable decision trail for autonomous or multi-phase
  runs, so a human can trust the result without re-doing it.

`cursor-team-kit` is the general-purpose layer underneath: PR hygiene, CI triage,
review-comment triage, merge-conflict resolution, code-quality passes — the everyday
mechanics that `poteto-mode`'s playbooks call out to.

## What's in the box

- **`plugins/pstack`** — poteto's playbook-driven agent style: concise responses,
  deliberate subagents, unslopped prose, simple code, verified work. Entry point is
  the `poteto-mode` skill, which routes to `tdd`, `architect`, `how`, `why`, `arena`,
  and `interrogate` depending on what you're asking for. Also ships a library of
  `principle-*` reference skills (root causes, idempotent operations, type-system
  discipline, and more) that the playbooks draw on.
- **`plugins/cursor-team-kit`** — the dev-workflow skills `pstack` depends on
  (`deslop`, `control-cli`, `control-ui`) plus the rest of the same upstream plugin:
  PR review, CI fixes, merge conflicts, weekly recaps.
- **`docs/index.html`** — a browsable reference map of every skill, playbook, and
  agent in both plugins and how they call into each other. Self-contained, works
  air-gapped.

## What changed from the Cursor original

**Added:**

- A `SessionStart` hook that injects the `poteto-mode` mandate automatically, so a
  fresh session already knows to route non-trivial engineering work through it —
  no manual invocation needed.
- The reference-map page above.
- Dual GitHub/GitLab support. Upstream `pstack` assumed `gh` unconditionally; every
  skill here that shells out to a PR/MR host detects `gh` vs `glab` first
  (`scripts/git-host.sh`) and uses the matching command shape — not a find-replace,
  since the two hosts' review-thread and CI-status models differ structurally. The
  structured PR/MR watcher (`scripts/watch-pr`, driven by the `babysit` playbook) now
  has a real GitLab reader too: it queries GitLab's GraphQL API directly and resolves
  GitLab's richer `detailedMergeStatus` into the same merge-readiness model GitHub
  uses, failing closed (never silently reporting a merge request "ready") on any
  GitLab-specific gate this watcher doesn't yet model. See `docs/gitlab-support.md`.
- A fix to `reflect`'s transcript parsing that was broken in the initial port.

**Removed / deferred:**

- Four `poteto-mode` playbooks — `orchestrate`, `autopilot-full`, `autopilot-stack`,
  `shipping` — are not ported. They assume Cursor's background cloud agents and
  Graphite (`gt`) stack-landing machinery that need real design work against Claude
  Code's primitives (`Workflow`, `RemoteTrigger`), not a vocabulary swap. The design
  options and the one open call (whether to keep assuming `gt` is installed) are
  written up in `TODO.md`.
- No Codex support. This port targets Claude Code only.

## Install

Add this repo as a marketplace and enable both plugins:

```
/plugin marketplace add ultish/pstack-claude
/plugin install pstack@pstack-claude
/plugin install cursor-team-kit@pstack-claude
```

Working from a local clone instead? Point at the path on disk:

```
/plugin marketplace add /path/to/pstack-claude
```

## Reference

- `docs/cursor-to-claude.md` — the translation glossary applied throughout: tool
  names, frontmatter fields, model slugs, transcript/config paths.
- `docs/gitlab-support.md` — the `gh`/`glab` detection and command-mapping pattern,
  plus how the structured `watch-pr` watcher picks between its GitHub and GitLab
  readers.
- `TODO.md` — the four playbooks not ported, and what porting them for real would
  take.
