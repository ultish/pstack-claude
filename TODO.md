# Deferred: Cursor-native orchestration playbooks

Four `poteto-mode` playbooks from upstream `cursor/plugins/pstack` are **not** ported
in this repo: `orchestrate.md`, `autopilot-full.md`, `autopilot-stack.md`, `shipping.md`.
They assume Cursor's background *cloud agents* and an `/goal`-style standing-directive
primitive that keeps a coordinator chat alive across turns pursuing one objective —
none of which is a vocabulary swap like `Task` → `Agent`.

This isn't a uniform gap. Two of the four have a real way forward with primitives
Claude Code already has; the other two are specifically blocked on a Graphite (`gt`)
decision, independent of the coordinator/worker question.

## Have a real way forward

- **`orchestrate.md`** — a standing coordinator chat that fans out to dozens/hundreds
  of workers and sub-coordinators over a multi-day program, tracked in a
  `orchestrate/<project-slug>/` store (`units.tsv`, `frontier.json`, `preferences.md`).
  `RemoteTrigger`'s scheduled routines (durable, server-side, independent of any one
  local session staying alive) are the equivalent of the standing-coordinator tick that
  `/goal` provided. The `Workflow` tool's `pipeline`/`parallel`/`agent()` — with
  worktree isolation, resumable runs via `runId`, and built-in concurrency/budget
  tracking — covers most of what `orch.ts`/`store.ts` hand-rolled for tracking units
  and fanning out workers. Not Graphite-dependent in its own right.
- **`autopilot-full.md`** — a queue of independent PRs, one owner per PR end to end
  (build → merge), gated by root swarm-verification before each merge.
  `RemoteTrigger`'s webhook-fired routines (e.g. fire on a PR-opened event) are a clean
  fit for "one durable owner per PR." `Workflow`'s `parallel()` covers the swarm-verify
  gate. The merge step can sidestep Graphite entirely here by merging one PR at a time
  via plain `gh`/`glab` instead of stacking, if that's the chosen design.

## Still blocked — on Graphite specifically, not on a missing primitive

- **`autopilot-stack.md`** — same owner loop as autopilot-full, but appends to one
  linear Graphite stack for the operator to land herself instead of auto-merging. Its
  entire purpose *is* building that stack (`gt track`, `gt submit --stack`). Swapping
  the owner/worker mechanism for `RemoteTrigger`/`Workflow` doesn't touch this — without
  `gt` there's no plain-git equivalent for stack topology short of reimplementing a
  meaningful chunk of Graphite by hand.
- **`shipping.md`** — independently verifies each PR in a stack, then lands the
  contiguous verified run via `gt submit --merge-when-ready --always`. "Land the
  contiguous verified run" is Graphite's merge-frontier/patch-id-staleness logic. A
  plain-git version needs real design work (walk the PR dependency chain, detect
  staleness without `gt`'s bookkeeping), not a translation.

## The gating decision

Whether to keep `gt`-based landing (assuming the user has Graphite installed) or design
a plain-git replacement for stack topology and merge-frontier tracking is the one open
call that gates `autopilot-stack.md` and `shipping.md`. It doesn't gate `orchestrate.md`
or `autopilot-full.md`.

**Recommendation:** assume `gt` is installed. It's a real standalone CLI, and pinning
to it unblocks both stack-dependent playbooks with far less design work than
reimplementing stack topology and staleness detection over plain git.

## If picked back up later

1. `orchestrate.md`: design the coordinator as a `RemoteTrigger` scheduled routine that
   re-reads a durable store each fire (`orch.ts`/`store.ts`'s shape is a reasonable
   starting point, though `Workflow`'s built-in tracking may replace parts of it) rather
   than a single unbroken chat. `ScheduleWakeup`/`CronCreate` are session-local and not
   durable (7-day cap, gone if the session ends) — fine for a live coordinator's
   in-session heartbeat, wrong as the sole mechanism for a multi-day standing program.
2. `autopilot-full.md`: design the per-PR owner as a `RemoteTrigger` webhook-fired
   routine (fires on PR-opened, or is fired programmatically when a queue item starts).
   Use `Workflow`'s `parallel()` for the swarm-verify gate before merge.
3. Decide Graphite for `autopilot-stack.md` and `shipping.md` per the recommendation
   above, then design their stack/landing mechanics against that decision — don't just
   rename Cursor terms in the existing prose.
4. Re-derive all four from
   `https://github.com/cursor/plugins/tree/main/pstack/skills/poteto-mode/playbooks`
   against the decisions above.

`babysit.md` and `opening-a-pr.md` also reference `gt` and cloud-agent-style dispatch
but are kept (opening-a-pr runs at the end of every other playbook, and babysit is a
named routing target), with those references translated per `docs/gitlab-support.md`
and the Graphite-is-assumed-installed stance above rather than dropped.
