#!/usr/bin/env bash
set -u
root=$(cd "$(dirname "$0")/.." && pwd)
export CLAUDE_PLUGIN_ROOT="$root/plugins/pstack"
cmd=$(jq -r '.hooks.SessionStart[0].hooks[0].command' "$CLAUDE_PLUGIN_ROOT/hooks/hooks.json")
run() { env -u PSTACK_DISABLE_SESSION_HOOK -u PSTACK_ENABLE_ARENA -u PSTACK_DISABLE_WORKTREES -u PSTACK_SESSION_HOOK_FILE "$@" bash -c "$cmd"; }
fail=0
check() { if [ "$2" = ok ]; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }

base=$(run)
wt=$(run PSTACK_DISABLE_WORKTREES=1)
case "$wt" in *'Do not create git worktrees'*'isolation "worktree"'*'current checkout and branch'*'overrides any playbook or skill'*) r=ok;; *) r=no;; esac
check "DISABLE_WORKTREES=1 prints the override line" $r
case "$base" in *worktree*isolation*) r=no;; *) r=ok;; esac
check "unset: no worktree line" $r
[ "$(run PSTACK_DISABLE_WORKTREES=0)" = "$base" ] && r=ok || r=no
check "=0 leaves output unchanged" $r
[ "${wt#"$base"}" != "$wt" ] && r=ok || r=no
check "override only appends to default output" $r
[ -z "$(run PSTACK_DISABLE_SESSION_HOOK=1 PSTACK_DISABLE_WORKTREES=1)" ] && r=ok || r=no
check "DISABLE_SESSION_HOOK=1 silences everything" $r
case "$(run PSTACK_ENABLE_ARENA=1 PSTACK_DISABLE_WORKTREES=1)" in *'Do not start the arena'*) r=no;; *'Do not create git worktrees'*) r=ok;; *) r=no;; esac
check "composes with ENABLE_ARENA=1" $r
exit $fail
