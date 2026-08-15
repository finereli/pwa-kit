#!/usr/bin/env bash
# Type-check and build the whole kit as one project. Run after any kit edit
# (the promote procedure requires it): sync.sh lays the items out the way an
# app would (shared/, functions/api, src), then svelte-check + vite build.
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm install --no-audit --no-fund
./sync.sh
npx svelte-check --tsconfig ./tsconfig.json
npx vite build --logLevel warn
echo "kit typecheck + build: ok"
