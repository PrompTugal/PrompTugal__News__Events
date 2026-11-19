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
node scripts/test-workflow.mjs
# The security checks run from the anchor's copy: the newest commit GitHub's own record shows was deployed to
# github-pages by a passing run (security@'s fourth ruling, Website 948820a7e; read here from the live version.json). Tags
# are not used. No anchor, an anchor that is not an ancestor of HEAD, or a missing checker fails: there is no fallback.
anchor() {
  # Locally, the live site's /version.json names the same commit as GitHub's deployment record: only a passing CI run can
  # deploy it, so a push alone cannot write it (the public API is rate-limited from shared hosts). CI reads the deployment record.
  node -e '
    fetch("https://events.promptugal.news/version.json", { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
      .then((v) => { if (typeof v.commit !== "string" || !/^[0-9a-f]{40}$/.test(v.commit)) process.exit(1); console.log(v.commit); })
      .catch(() => process.exit(1));'
}
trusted_check() {
  local a d rc=0; a=$(anchor) || { echo "no successful github-pages deployment to anchor on" >&2; return 1; }
  git cat-file -e "$a^{commit}" 2>/dev/null || { echo "the anchor $a is not in this history (git fetch)" >&2; return 1; }
  git merge-base --is-ancestor "$a" HEAD || { echo "the anchor $a is not an ancestor of HEAD" >&2; return 1; }
  d=$(mktemp -d)
  for f in check-signatures.mjs check-commits.mjs leak-scan.mjs; do
    git cat-file -e "$a:scripts/$f" 2>/dev/null || { echo "no copy of scripts/$f in the anchor $a" >&2; rm -rf "$d"; return 1; }
    git show "$a:scripts/$f" > "$d/$f"
  done
  node "$d/leak-scan.mjs" && node "$d/check-commits.mjs" "$a" HEAD && node "$d/check-signatures.mjs" HEAD || rc=1
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
