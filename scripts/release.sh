#!/usr/bin/env bash
# Run every gate, then rebase on dev and push. Stops at the first failure. Never pipe a gate.
set -euo pipefail
cd "$(dirname "$0")/.."
# Refuse during a hold (finding 3), with uncommitted changes (finding 4: the gates must check what is
# pushed), and check every commit's Agent: trailer before the push, while it can still be amended (finding 5).
[ -e board/HOLD.md ] && { echo "board/HOLD.md exists: no release while it does" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "uncommitted changes: commit or stash them first" >&2; exit 1; }
git fetch -q origin dev
node scripts/check-data.mjs
node scripts/build.mjs
node scripts/validate.mjs
node scripts/leak-scan.mjs
node scripts/check-commits.mjs origin/dev HEAD
node scripts/test-check-signatures.mjs
node scripts/test-leak-scan.mjs
# The signature check runs from the last release tag's copy, never this tree's (videos.b@'s finding, 19 Nov 2026).
git fetch -q --tags origin
trusted_check() {
  local last; last=$(git describe --tags --abbrev=0 --match 'v*' origin/dev 2>/dev/null || true)
  [ -n "$last" ] && git cat-file -e "$last:scripts/check-signatures.mjs" 2>/dev/null || { echo "no released copy of the signature check" >&2; return 1; }
  local f; f=$(mktemp --suffix=.mjs); git show "$last:scripts/check-signatures.mjs" > "$f"; node "$f" HEAD || { rm -f "$f"; return 1; }; rm -f "$f"
}
trusted_check
for i in 1 2 3 4 5; do
  git fetch -q origin dev
  git rebase -q origin/dev
  # One gate per line: under set -e a failure inside an && chain does not stop the script (specialist.code@ finding 1).
  node scripts/check-data.mjs >/dev/null
  node scripts/build.mjs >/dev/null
  node scripts/validate.mjs >/dev/null
  node scripts/leak-scan.mjs >/dev/null
  node scripts/check-commits.mjs origin/dev HEAD >/dev/null
  trusted_check >/dev/null
  if git -c push.negotiate=true push -q origin HEAD:dev; then echo "released $(git rev-parse --short HEAD) to dev"; exit 0; fi
  sleep $((i * 3))
done
echo "release failed after 5 attempts" >&2; exit 1
