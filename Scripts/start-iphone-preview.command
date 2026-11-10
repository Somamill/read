#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/Apps/iPhone"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo 'Install Node.js 24 LTS from https://nodejs.org, then run this again.'
  exit 1
fi
if [[ ! -d node_modules ]]; then npm ci; fi
exec npx expo start --go
