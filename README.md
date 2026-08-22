# pstack-claude

A Claude Code plugin marketplace, re-derived from
[`cursor/plugins/pstack`](https://github.com/cursor/plugins/tree/main/pstack) and the
subset of [`cursor/plugins/cursor-team-kit`](https://github.com/cursor/plugins/tree/main/cursor-team-kit)
that `pstack` depends on. Targets Claude Code only — no Codex support.

## Plugins

- **`plugins/pstack`** — poteto's playbook-driven agent style: concise responses,
  deliberate subagents, unslopped prose, simple code, and verified work. Entry point is
  the `poteto-mode` skill.
- **`plugins/cursor-team-kit`** — general-purpose dev-workflow skills (PR hygiene, CI
  triage, verification, code-quality review) that `pstack` depends on
  (`deslop`, `control-cli`, `control-ui`) plus other portable skills from the same
  upstream plugin.

## Install

Add this repo as a marketplace and enable both plugins:

```
/plugin marketplace add /Users/jxhui/Developer/pstack-claude
/plugin install pstack@pstack-claude
/plugin install cursor-team-kit@pstack-claude
```

## Notes on this port

- `docs/cursor-to-claude.md` — the translation glossary applied throughout: tool names,
  frontmatter fields, model slugs, transcript/config paths.
- `docs/gitlab-support.md` — the `gh`/`glab` detection and command-mapping pattern used
  by any skill that shells out to a PR/MR host.
- `TODO.md` — four `poteto-mode` playbooks (`orchestrate`, `autopilot-full`,
  `autopilot-stack`, `shipping`) are deliberately not ported; they assume Cursor cloud
  agents and Graphite (`gt`) machinery that needs real design work, not renaming.
