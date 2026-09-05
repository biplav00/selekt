#!/usr/bin/env bash
set -euo pipefail

# push.sh — build, test, and push to git remote
# Usage: ./scripts/push.sh [commit-message] [branch]
# Example: ./scripts/push.sh "feat: add manual locator" main

MSG="${1:-chore: update}"
BRANCH="${2:-main}"
REMOTE="${REMOTE:-origin}"

echo "→ Running checks..."
npm run lint || { echo "✗ lint failed"; exit 1; }
npm run typecheck 2>&1 || npm run compile || { echo "✗ typecheck failed"; exit 1; }
npm run test || { echo "✗ tests failed"; exit 1; }
npm run build || { echo "✗ build failed"; exit 1; }

echo "→ Staging..."
git add -A
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$MSG"
  echo "✓ Committed: $MSG"
fi

echo "→ Pushing to $REMOTE/$BRANCH..."
git push "$REMOTE" "$BRANCH" || {
  echo "No remote configured. To set one:"
  echo "  git remote add origin <your-github-url>"
  echo "  git push -u origin $BRANCH"
  exit 1
}

echo "✓ Pushed to $REMOTE/$BRANCH"
echo "→ CI will run at https://github.com/<user>/<repo>/actions"
