# pstack-claude

A Claude Code port of poteto's [`pstack`](https://github.com/cursor/plugins) and the `cursor-team-kit` skills it depends on. Both come from Cursor's open-source [`cursor/plugins`](https://github.com/cursor/plugins) repo. The skills are theirs, so read the upstream repo for what `pstack` is and why you'd want it. This repo only makes it run in Claude Code.

Last synced through upstream commit [`f713f14`](https://github.com/cursor/plugins/commit/f713f14203cd6420cec13cd7c55c32d598dbab68) on 2026-10-16. `docs/upstream-sync.md` has the details.

## Install

```
/plugin marketplace add ultish/pstack-claude
/plugin install pstack@pstack-claude
/plugin install cursor-team-kit@pstack-claude
```

For a local clone, pass the path on disk to `/plugin marketplace add`.

## Session hook and options

pstack-claude's `pstack` plugin ships a `SessionStart` hook that upstream doesn't have. It tells each new session to run engineering work (code, design docs, plans, reviews) through `poteto-mode`, and to answer questions about existing code with `how` or `why`. The hook is on by default, and so is a second instruction that stops the model from starting `arena` on its own. Arena fans out several parallel attempts, which is costly. It still runs when you type `/arena` or say "arena this".

Set these under `env` in `~/.claude/settings.json` or `.claude/settings.json`.

| Variable | Effect |
| --- | --- |
| `PSTACK_DISABLE_SESSION_HOOK=1` | Turns the hook off. The rest of the plugin still works. Wins over the other two. |
| `PSTACK_ENABLE_ARENA=1` | Drops the "don't start arena" line, so upstream behavior returns. |
| `PSTACK_SESSION_HOOK_FILE` | Absolute path to a file whose text is injected instead of the bundled text. Falls back to the bundled text if unset or unreadable. `~` is not expanded. |

To edit the wording, copy [`session-start-context.md`](plugins/pstack/hooks/session-start-context.md) and point `PSTACK_SESSION_HOOK_FILE` at your copy. The arena line is added after your file's text.

The arena line is an instruction to the model, not a hard block. Skills and playbooks stay as upstream.

## Differences from upstream

- GitHub and GitLab both work. Skills that call a PR host detect `gh` or `glab` first, and the `babysit` watcher reads GitLab directly. See `docs/gitlab-support.md`.
- `reflect` reads Claude Code's transcript format instead of Cursor's.
- `docs/index.html` is a browsable map of every skill, playbook, and agent.
- Four playbooks are not ported (`orchestrate`, `autopilot-full`, `autopilot-stack`, `shipping`). They rely on Cursor background agents and Graphite. `TODO.md` covers what a port would take.

## Docs

- `docs/cursor-to-claude.md` maps Cursor's tool names, frontmatter, model slugs, and paths to Claude Code's.
- `docs/gitlab-support.md` describes `gh`/`glab` detection.
- `docs/upstream-sync.md` records the last upstream comparison and how to run the next one.
