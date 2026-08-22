#!/usr/bin/env bash
# Detects which PR/MR host CLI to use and prints it on stdout: "gh" or "glab".
# Usage: GIT_HOST_CLI=$(bash "$CLAUDE_PLUGIN_ROOT/scripts/git-host.sh") || exit 1
set -euo pipefail

remote_url=$(git remote get-url origin 2>/dev/null || true)

if [[ "$remote_url" == *"github.com"* ]]; then
  echo "gh"
  exit 0
fi

if command -v glab >/dev/null 2>&1; then
  echo "glab"
  exit 0
fi

if command -v gh >/dev/null 2>&1; then
  echo "gh"
  exit 0
fi

echo "Could not detect a PR/MR host CLI. Remote: ${remote_url:-<none>}. Neither gh nor glab is on PATH." >&2
exit 1
