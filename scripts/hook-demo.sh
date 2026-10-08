#!/usr/bin/env bash
# Prove that the installed pre-commit hook rejects an ESLint violation.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

dirty=src/__hook_demo_dirty.ts
before=$(git rev-parse --verify HEAD)
hooks_path=$(git config --get core.hooksPath || true)

if [[ -n $(git status --porcelain) ]]; then
  echo "FAIL: the working tree must be clean before the hook demo" >&2
  exit 1
fi
if [[ -e "$dirty" ]]; then
  echo "FAIL: demo target already exists: $dirty" >&2
  exit 1
fi
if [[ "$hooks_path" != ".husky/_" || ! -f .husky/_/pre-commit || "${HUSKY:-}" == "0" ]]; then
  echo "FAIL: the Husky pre-commit hook is not active" >&2
  exit 1
fi

cleanup() {
  if [[ $(git rev-parse HEAD) == "$before" ]]; then
    git restore --staged -- "$dirty" >/dev/null 2>&1 || true
    rm -f -- "$dirty"
  fi
}
trap cleanup EXIT

printf 'const unused = process.env.SECRET\nexport const x = 1\n' > "$dirty"
git add -- "$dirty"
echo ">>> Attempting a commit with an ESLint violation..."
if output=$(git commit -m "demo: dirty commit" 2>&1); then
  echo "$output"
  echo "FAIL: the hook allowed the dirty commit; history was not rolled back" >&2
  exit 1
fi
echo "$output"
if [[ $(git rev-parse HEAD) != "$before" ]]; then
  echo "FAIL: HEAD changed despite the rejected commit" >&2
  exit 1
fi
if [[ "$output" != *"no-unused-vars"* && "$output" != *"no-restricted-properties"* ]]; then
  echo "FAIL: commit failed for a reason other than the expected ESLint violation" >&2
  exit 1
fi
echo "OK: the pre-commit hook rejected the ESLint violation; history is unchanged"
