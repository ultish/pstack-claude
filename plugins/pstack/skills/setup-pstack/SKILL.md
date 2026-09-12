---
name: setup-pstack
description: Configure which models pstack uses per role. Detects your available Claude models and writes a per-role override file that the user includes from their CLAUDE.md. Use for /setup-pstack, "configure pstack models", or changing pstack's model choices.
---

# Setup pstack

Write `~/.claude/pstack-models.md`, a per-role model override sheet that pstack's skills read. Each pstack skill names a default model inline in its own SKILL.md; the override sheet is a layer on top that lets a role's model be changed without editing skill files, and skills fall back to their inline default when a role's line is absent or the sheet doesn't exist yet.

Claude Code has no equivalent of Cursor's always-applied `.mdc` rules, so the override sheet is not auto-loaded on its own. Step 6 below wires it in with an explicit `@`-include line in the user's `CLAUDE.md`.

## Steps

### 1. Detect available models

Enumerate the model slugs available to this session's `Agent` tool `model` parameter — that is the dependable source. Claude family currently known: Opus 5 (`claude-opus-5`), Opus 4.8 (`claude-opus-4-8`), Opus 4.6 (`claude-opus-4-6`), Fable 5.1 (`claude-fable-5-1`), Sonnet 5 (`claude-sonnet-5`), Sonnet 4.6 (`claude-sonnet-4-6`), Haiku 4.5 (`claude-haiku-4-5-20251001`). Treat that list as a starting point to confirm, not a guarantee — model availability changes over time and by account. If detection surfaces additional or different slugs, prefer what the session actually reports. If nothing can be detected, ask the user to paste the slugs they have access to. Never write a slug that hasn't been confirmed available.

Omitting the `model` parameter on an `Agent` call is itself a valid choice: the agent then runs on its own agent-definition default, or the parent session's model if the definition doesn't set one. There's no alias slug for this (Cursor's `inherit-parent`/`auto` don't have a Claude Code equivalent) — document it as "no model override" directly in the sheet instead of a named value.

### 2. Load current state

The default role-to-model mapping is the shape shown in step 5. If `~/.claude/pstack-models.md` already exists, read it and treat its values as the current choices. Otherwise start from those defaults.

### 3. Map and confirm

Show every role with its current model, marking any whose model isn't in the detected set as needing a choice. Ask whether to accept as-is or change specific roles, offering the detected models as options. Prefer `AskUserQuestion` over free text.

For panel roles (how critics, arena runners, architect runners, interrogate reviewers) the value is a list, and one subagent runs per entry, so the list length sets the panel size. `arena cross-judge pool` is also a list, but arena selects one model from it whose family differs from the parent's when possible. `swarm workers` is the default model for every worker unless a race or comparison assigns another model per arm.

### 4. Validate

Every slug written must be in the detected set. If a chosen slug isn't available, stop and ask again. An override sheet pointing at a model the user can't use breaks every delegation that reads it.

### 5. Write the override sheet

Write `~/.claude/pstack-models.md` with the shape below. Overwrite the whole file so re-runs stay idempotent.

```markdown
# pstack model configuration

Per-role model overrides for pstack skills. Each pstack SKILL.md names a default model
inline; the values here override those defaults. Delete a line to fall back to the skill
default. A role with no override runs on its skill's own default model.

feature, refactoring: claude-opus-5
bug-fix: claude-opus-5
perf-issue: claude-opus-5
hillclimb: claude-opus-5
judgment and prose: claude-opus-5
hardest tasks: claude-opus-5
how explorer: claude-opus-5
how explainer: claude-opus-5
how critics: claude-opus-5, claude-fable-5-1, claude-opus-4-6, claude-sonnet-5
why investigators: claude-opus-5
why synthesizer: claude-opus-5
reflect tooling: claude-opus-5
reflect judgment, divergent, synthesizer: claude-opus-5
arena runners: claude-opus-5, claude-fable-5-1, claude-opus-4-6, claude-sonnet-5
arena cross-judge pool: claude-opus-5, claude-fable-5-1, claude-sonnet-5
swarm workers: claude-opus-5
architect runners: claude-opus-5, claude-fable-5-1, claude-opus-4-6, claude-sonnet-5
interrogate reviewers: claude-opus-5, claude-fable-5-1, claude-opus-4-6, claude-sonnet-5
```

### 6. Wire it in

Check whether `~/.claude/CLAUDE.md` already includes the line `@~/.claude/pstack-models.md`. If not, append it, so the sheet loads as context for every session. If the user prefers project scope instead of user scope, add the same include line to the project's `CLAUDE.md` and write the sheet at a project-relative path they confirm, instead of `~/.claude/pstack-models.md`.

### 7. Confirm

Tell the user where the override sheet was written and how it loads (the `@` include in CLAUDE.md). Re-running this skill updates the sheet in place.

### 8. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /create-verification-skill." On yes, invoke `/create-verification-skill`. On no, move on without pushing.
