---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: true
---

# Swarm

Fan out N parallel workers. They may cover separate slices, race the same brief, or mix both. The parent waits, aggregates, and returns one report.

## Start

Open a todolist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Set N from the user or derive it from the shape. N is the number of workers this task needs, not a ceiling to fill.
4. Pick the worker model from `swarm workers` in `~/.claude/pstack-models.md` when present. Otherwise use `claude-opus-5`. For a model race, name each arm's model up front.
5. Give each worker its own writable output when it writes. Spawn it with `isolation: "worktree"` for an isolated git worktree, or use a plain branch or `/tmp/swarm-<slug>/worker-<n>/` when a worktree is overkill for the change size.

## Phase B: Fan out

Spawn all N workers in one message with `subagent_type: "general-purpose"` and the configured model. Every `Agent` call is already asynchronous — it runs in the background and reports back on its own, no flag needed. Pass `isolation: "remote"` when a worker doesn't need this machine's local state (files on disk, a running local service, an authenticated local tool); omit `isolation` when it does.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

Keep a compact result table, one-line evidenced issues, and explicit gaps or dropouts.

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.
