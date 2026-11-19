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
# The security checks run from the last release tag's copy, never this tree's, and fail if it is missing (security@'s
# controls 7 and 8, Website fae9649db). The functional gates (data, build, validate) run from this tree.
git fetch -q --tags origin
trusted_check() {
  local last d rc=0; last=$(git describe --tags --abbrev=0 --match 'v*' origin/dev 2>/dev/null || true)
  [ -n "$last" ] || { echo "no release tag to take the checks from" >&2; return 1; }
  d=$(mktemp -d)
  for f in check-signatures.mjs check-commits.mjs leak-scan.mjs; do
    git cat-file -e "$last:scripts/$f" 2>/dev/null || { echo "no released copy of scripts/$f in $last" >&2; rm -rf "$d"; return 1; }
    git show "$last:scripts/$f" > "$d/$f"
  done
  node "$d/leak-scan.mjs" && node "$d/check-commits.mjs" origin/dev HEAD && node "$d/check-signatures.mjs" HEAD || rc=1
  rm -rf "$d"; return $rc
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
