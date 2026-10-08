#!/usr/bin/env bash
# Доказ, що pre-commit hook блокує «брудний» коміт (C-01..C-04 у standards/checks.md).
# Створює файл із порушенням лінтера, намагається закомітити, очікує ВІДМОВУ, прибирає за собою.
set -u
cd "$(git rev-parse --show-toplevel)"
DIRTY=src/__hook_demo_dirty.ts
trap 'git reset -q -- "$DIRTY" 2>/dev/null; rm -f "$DIRTY"' EXIT

printf 'const unused = process.env.SECRET\nexport const x = 1\n' > "$DIRTY"
git add "$DIRTY"
echo ">>> Пробую закомітити файл з порушеннями (unused var, process.env поза config)..."
if git commit -q -m "demo: dirty commit" ; then
  git reset -q --soft HEAD~1
  echo "FAIL: hook ПРОПУСТИВ брудний коміт"
  exit 1
fi
echo "OK: hook заблокував брудний коміт (exit != 0), історія не змінилась"
