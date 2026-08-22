# Deferred: Cursor-native orchestration playbooks

Four `poteto-mode` playbooks from upstream `cursor/plugins/pstack` are **not** ported
in this repo. They assume machinery Claude Code doesn't have a direct equivalent for:
Cursor's background *cloud agents*, and an `/goal`-style standing-directive primitive
that keeps a coordinator chat alive across turns pursuing one objective.

- `orchestrate.md` — a standing coordinator chat that fans out to dozens/hundreds of
  cloud-agent workers and sub-coordinators over a multi-day program, tracked in a
  `orchestrate/<project-slug>/` store (`units.tsv`, `frontier.json`, `preferences.md`).
- `autopilot-full.md` — a queue of independent PRs, one Cursor cloud agent owning each
  PR end to end (build → merge), gated by root swarm-verification before each merge.
- `autopilot-stack.md` — same owner loop as autopilot-full, but appends to one linear
  Graphite stack for the operator to land herself instead of auto-merging.
- `shipping.md` — independently verifies each PR in a stack, then lands the contiguous
  verified run via `gt submit --merge-when-ready`.

All four also assume Graphite (`gt`) for stack topology and merge-when-ready semantics.

## Why deferred rather than translated

These aren't a vocabulary swap like `Task` → `Agent` or `AskQuestion` → `AskUserQuestion`.
They're a different execution model:

- Claude Code's `Agent` tool can run in the background (`run_in_background: true`) and
  in an isolated worktree, but there's no first-class "cloud agent" that keeps running
  after the parent session ends, and no built-in standing-directive primitive that
  survives across turns the way Cursor's `/goal` does. `ScheduleWakeup` and cron-based
  autonomous loops are the nearest analogs, but the semantics (what happens on
  disconnect, how a worker resumes) aren't the same and need real design, not renaming.
- Whether to keep the Graphite (`gt`) stack-landing mechanics or rewrite them around
  plain `git`/`gh`/`glab` is itself a decision (see `docs/gitlab-support.md`), and it
  gates how these playbooks would even work.

## If picked back up later

1. Decide the Claude Code equivalent of a standing multi-turn coordinator: likely built
   on `ScheduleWakeup` (dynamic re-firing) or `CronCreate` (fixed cadence) plus a
   durable store the coordinator re-reads each wake, rather than a single unbroken chat.
2. Decide worker placement: which steps genuinely need `environment: cloud`-style
   isolation (a fresh worktree per PR) versus what the local `Agent` tool with
   `isolation: "worktree"` already covers.
3. Decide Graphite: keep `gt`-based landing assuming the user has it installed, or
   rewrite the stack/merge-frontier logic around plain git + the `gh`/`glab` abstraction
   used elsewhere in this plugin.
4. Re-derive `orchestrate.md`, `autopilot-full.md`, `autopilot-stack.md`, `shipping.md`
   from `https://github.com/cursor/plugins/tree/main/pstack/skills/poteto-mode/playbooks`
   against those decisions — don't just rename Cursor terms in the existing prose.

`babysit.md` and `opening-a-pr.md` also reference `gt` and Cursor cloud agents but are
kept (opening-a-pr runs at the end of every other playbook, and babysit is a named
routing target), with those references translated per `docs/gitlab-support.md` and the
plain-git assumption above rather than dropped.
