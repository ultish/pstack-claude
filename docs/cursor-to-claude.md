# Cursor → Claude Code translation glossary

Reference for porting any `cursor/plugins/pstack` (or `cursor-team-kit`) skill into this
plugin. Verified against the current Claude Code tool schemas and skills docs
(`https://code.claude.com/docs/en/skills.md`) on 2026-08-22, not copied from a prior port.

## Frontmatter — mostly unchanged

`disable-model-invocation: true` is a real, current Claude Code field with the same name
and meaning Cursor uses: the skill is reachable via `/skill-name` but never auto-triggered
by the model. **Keep it as-is.** Do not rewrite it to `user-invocable: false` —
`user-invocable` is a different, real field meaning "only Claude may invoke this, not the
user," which is close to the opposite of what these skills want. No `commands/<name>.md`
wrapper is needed to make a `disable-model-invocation` skill reachable — the slash command
exists automatically.

Recognized fields (Claude Code, 2026-08-22): `name`, `description`, `when_to_use`,
`argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`,
`allowed-tools`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`,
`hooks`, `paths`, `shell`, `metadata`, `license`, `compatibility`.

`name:` — use the kebab-case directory name (`poteto-mode`, not `Poteto Mode`). Cursor's
title-case names and `mode: true`/`icon:`/`color:`/`reminder:` fields aren't Claude Code
fields; drop them.

## Tool names

| Cursor | Claude Code |
|---|---|
| `Task` tool | `Agent` tool |
| `AskQuestion` tool | `AskUserQuestion` tool |
| `subagent_type: generalPurpose` | `subagent_type: "general-purpose"` |
| Cursor's built-in `create-skill` skill | `plugin-dev:skill-development` skill |
| Cursor's built-in `babysit` skill | no Claude Code built-in equivalent; pstack has no top-level babysit skill either (only the `poteto-mode` playbook) |
| `readonly` agent flag | no such flag on `Agent`. Pick a `subagent_type` by what it needs: `Explore` for read-only search, `general-purpose` for full tool + MCP access. State the requirement ("needs MCP access for X") instead of a boolean. |
| `run_in_background: true` on `Task` | not a real `Agent` parameter. Every `Agent` call is inherently async — it returns immediately and the result arrives later as a task notification. Don't tell agents to "set" background mode; it's the default behavior. |
| `environment: "cloud"` | `isolation: "remote"` is the nearest analog (always runs in a remote cloud environment) — but this needs real design work, not renaming. Left to `TODO.md` for the playbooks that use it. |
| `environment` field generally | `isolation: "worktree"` is the local analog for parallel-mutation isolation (expensive, use only when agents would otherwise conflict). |

Real `Agent` tool parameters today: `description`, `prompt`, `subagent_type`, `model`,
`isolation` (`"worktree"` or `"remote"`). No `readonly`, `environment`, or
`run_in_background` fields exist — don't invent them when translating a skill that names
one.

Real available `subagent_type` values depend on what's installed, but the stable built-ins
are `general-purpose` (full tools), `Explore` (fast read-only search, no Edit/Write),
`Plan` (architecture/planning, no Edit/Write). A skill that needs a *specific* dedicated
agent (like `pstack:poteto-agent`) names it by its `plugin-name:agent-name` form.

## Paths

| Cursor | Claude Code |
|---|---|
| `~/.cursor/rules/*.mdc` (always-applied rule) | No equivalent auto-applied-rule mechanism exists. Use a plain file (e.g. `~/.claude/pstack-models.md`) plus an explicit `@~/.claude/pstack-models.md` include line the user adds to their `CLAUDE.md`. |
| `.cursor/skills/<name>/SKILL.md` (project-local) | `.claude/skills/<name>/SKILL.md` |
| `~/.cursor/skills/<name>/` (user-local) | `~/.claude/skills/<name>/` |
| `~/.cursor/projects/<slug>/agent-transcripts/<uuid>/<uuid>.jsonl` | `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`, where `<encoded-cwd>` is the working directory with `/` → `-` (leading dash kept, e.g. `/Users/x/proj` → `-Users-x-proj`). One file per session; every line is one JSON chat-message event. |
| Glob within one workspace's transcripts | `ls -t ~/.claude/projects/<encoded-cwd>/*.jsonl` — never glob across `~/.claude/projects/*/`, that crosses workspace boundaries into unrelated private chats. |
| Cursor "available-tools map" / `mcps/` directory for enumerating MCP servers | The tool list at the top of the system prompt (every MCP tool appears prefixed `mcp__<server>__<name>`), or `.mcp.json` in the project/plugin, or `claude mcp list`. |

## Model slugs

Verified current as of 2026-09-26: Opus 5.5 (`claude-opus-5-5`), Opus 5 (`claude-opus-5`),
Opus 4.8 (`claude-opus-4-8`), Opus 4.6 (`claude-opus-4-6`), Fable 5.1 (`claude-fable-5-1`),
Sonnet 5 (`claude-sonnet-5`), Sonnet 4.6 (`claude-sonnet-4-6`), Haiku 4.5
(`claude-haiku-4-5-20251001`). These will drift — `setup-pstack` is the skill responsible
for re-detecting what's actually available in a live session rather than trusting this
list. Where a skill needs one hardcoded default, use `claude-opus-5-5`. Where a skill needs
a multi-model panel, use the three `claude-opus-5-5`, `claude-fable-5-1`, `claude-sonnet-5`
(upstream cut its panels from four to three on 2026-09-22, dropping the older Opus entry;
this mirrors that).

In the 2026-09-26 session, the `Agent` tool's `model` parameter accepted only family aliases
(`opus`, `sonnet`, `haiku`, `fable`), not full slugs. The routed skills therefore carry
upstream's fallback: if the `Agent` tool rejects a slug, use the default; if it rejects the
default, use the closest valid value of the same family from the error message.

Cursor's `inherit-parent` / `auto` role values (omit `model`, run on the parent model) map
to the literal sheet value `no model override`. Every skill that reads
`~/.claude/pstack-models.md` leaves `model` unset for it.

Cursor's reasoning-effort suffixes (`-max`, `-xhigh`, `-high`, ...) have no per-call
equivalent: the `Agent` tool takes no effort parameter. Effort is set only in agent or skill
frontmatter (`effort:`), so upstream's per-role budget ask in `setup-pstack` is not ported.

Drop Cursor-only slugs entirely (`gpt-5.6-sol-max`, `grok-4.6-fast-xhigh`, `grok-4.7-xhigh-fast`, `claude-opus-5-5-max`,
`claude-fable-5-1-thinking-max`, `claude-opus-5-thinking-xhigh` are Cursor's own
model-router aliases, not real Claude Code model IDs).

## Git hosting: gh vs glab

pstack skills that shell out to `gh pr ...` / `gh api ...` assume GitHub. Don't hardcode
that. Detect the host and dispatch to the matching CLI — see `docs/gitlab-support.md` for
the exact detection snippet and the skills that need it.

## Prose-level Cursor references to catch on a pass over any file

Grep for these; each needs a real decision, not a blind swap:
`Cursor`, `cursor`, `Bugbot` (Cursor's PR bot — no Claude Code equivalent; generalize to
"an automated PR-review bot"), `Graphite`/`gt ` (see `TODO.md`), `.cursor/`, `.mdc`,
`AskQuestion` (must become `AskUserQuestion`), `generalPurpose`, `Task tool`,
`~/.cursor`, "Cursor cloud agent".
