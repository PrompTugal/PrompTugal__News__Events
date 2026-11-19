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
# this workflow's latest successful push run on dev (security@'s sixth ruling, Website 0ba439611). Tags
# are not used. No anchor, an anchor that is not an ancestor of HEAD, or a missing checker fails: there is no fallback.
anchor() {
  # The head commit of the latest successful push run of this workflow on dev (security@'s sixth ruling), from GitHub's API;
  # if the API is rate-limited from this shared host, the live /version.json, which only a passing run deploys. CI is the authority.
  node -e '
    const q = "https://api.github.com/repos/PrompTugal/PrompTugal__News__Events/actions/workflows/pages.yml/runs?branch=dev&event=push&status=success&per_page=1";
    const ok = (sha) => typeof sha === "string" && /^[0-9a-f]{40}$/.test(sha);
    fetch(q, { headers: { "user-agent": "events-release-check", accept: "application/vnd.github+json" }, redirect: "error", signal: AbortSignal.timeout(20000) })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
      .then((d) => { const r = d.workflow_runs && d.workflow_runs[0]; if (!r || r.path !== ".github/workflows/pages.yml" || r.head_branch !== "dev" || r.event !== "push" || r.conclusion !== "success" || !ok(r.head_sha)) process.exit(1); console.log(r.head_sha); })
      .catch(() => fetch("https://events.promptugal.news/version.json", { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) })
        .then((r) => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
        .then((v) => { if (!ok(v.commit)) process.exit(1); console.error("(the API is rate-limited here: anchoring on the live version.json)"); console.log(v.commit); }))
      .catch(() => process.exit(1));'
}
trusted_check() {
  local a d rc=0; a=$(anchor) || { echo "no successful push run of this workflow on dev to anchor on" >&2; return 1; }
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
