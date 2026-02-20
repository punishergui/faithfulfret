#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Checking hero asset references..."

forbidden_pattern="/img/hero/(country|worship|nu-metal)|/img/hero/[^'\"[:space:]]+\\.svg"
if rg -n "$forbidden_pattern" --glob '!scripts/check-hero.sh' .; then
  echo "ERROR: Forbidden hero references found."
  exit 1
fi

all_hero_refs=$(rg --no-filename -o "/img/hero/[^'\" ),]+" --glob '!scripts/check-hero.sh' . || true)
if [ -z "$all_hero_refs" ]; then
  echo "ERROR: No hero references found."
  exit 1
fi

unique_refs=$(printf '%s\n' "$all_hero_refs" | sed 's/[`,]$//' | sort -u)
expected_ref="/img/hero/djent.jpg"
if [ "$unique_refs" != "$expected_ref" ]; then
  echo "ERROR: Hero references are not locked to $expected_ref"
  printf '%s\n' "$unique_refs"
  exit 1
fi

if command -v curl >/dev/null 2>&1; then
  if curl -fsI "http://127.0.0.1:3000/img/hero/djent.jpg" >/dev/null 2>&1; then
    echo "OK: Local dev server serves /img/hero/djent.jpg"
  else
    echo "WARN: Skipping local curl check (dev server not reachable on 127.0.0.1:3000)"
  fi
fi

echo "OK: Only $expected_ref is referenced."
