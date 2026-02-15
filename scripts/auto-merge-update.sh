#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TARGET_BRANCH="${1:-}"
REMOTE="${2:-origin}"
BASE_BRANCH="${3:-main}"

if [[ -z "$TARGET_BRANCH" ]]; then
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$CURRENT_BRANCH" != "HEAD" && "$CURRENT_BRANCH" != "$BASE_BRANCH" ]]; then
    TARGET_BRANCH="$CURRENT_BRANCH"
  else
    TARGET_BRANCH="$(git for-each-ref --sort=-committerdate --format='%(refname:short)' refs/remotes/${REMOTE}/codex/* | sed "s#^${REMOTE}/##" | head -n1)"
  fi
fi

if [[ -z "$TARGET_BRANCH" ]]; then
  echo "❌ Could not determine target branch automatically."
  echo "Usage: scripts/auto-merge-update.sh <pr-branch> [remote] [base-branch]"
  exit 1
fi

if ! git show-ref --verify --quiet "refs/remotes/${REMOTE}/${TARGET_BRANCH}"; then
  echo "❌ Remote branch not found: ${REMOTE}/${TARGET_BRANCH}"
  echo "Available codex branches:"
  git for-each-ref --sort=-committerdate --format='  %(refname:short)' "refs/remotes/${REMOTE}/codex/*" || true
  exit 1
fi

echo "==> Fetching ${REMOTE}"
git fetch "$REMOTE"

echo "==> Checking out ${TARGET_BRANCH}"
git checkout -B "$TARGET_BRANCH" "${REMOTE}/${TARGET_BRANCH}"

echo "==> Auto-merging ${REMOTE}/${BASE_BRANCH} into ${TARGET_BRANCH} (keep branch versions for conflicts)"
git merge -X ours "${REMOTE}/${BASE_BRANCH}" || {
  echo "==> Merge reported conflicts, auto-resolving by keeping ${TARGET_BRANCH} versions"
  git checkout --ours .
  git add -A
  git commit -m "Auto-resolve merge conflicts keeping ${TARGET_BRANCH} changes"
}

echo "==> Pushing ${TARGET_BRANCH}"
git push -u "$REMOTE" "$TARGET_BRANCH"

echo "✅ Done. Branch ${TARGET_BRANCH} is updated and pushed."
