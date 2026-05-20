#!/bin/bash
# Determine version bump type from conventional commit messages since last tag.
# feat! / BREAKING CHANGE → major
# feat: → minor
# everything else → patch

set -e

# Get commits since last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || true)
if [ -n "$LAST_TAG" ]; then
  COMMITS=$(git log "$LAST_TAG"..HEAD --format="%s")
else
  # No tags yet — use all commits
  COMMITS=$(git log --format="%s")
fi

BUMP="patch"

while IFS= read -r line; do
  # Major: feat! or BREAKING CHANGE in body
  if [[ "$line" =~ ^feat! || "$line" =~ ^feat\(.*\)! || "$line" =~ BREAKING\ CHANGE ]]; then
    BUMP="major"
    break
  fi
  # Minor: feat: or feat(scope):
  if [[ "$line" =~ ^feat: || "$line" =~ ^feat\(.*\): ]]; then
    if [[ "$BUMP" != "major" ]]; then
      BUMP="minor"
    fi
  fi
done <<< "$COMMITS"

echo "$BUMP"