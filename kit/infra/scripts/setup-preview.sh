#!/usr/bin/env bash
# One-time setup for isolated preview deployments.
#
# Preview deployments (every non-main branch) bind whatever wrangler.toml
# says. If that's the PRODUCTION D1 and R2, then combined with the dev-token
# login bypass any preview URL is a door into real data. This script gives
# previews their own world:
#
#   1. creates a preview D1 database (and R2 bucket, if BUCKET is set)
#   2. applies the schema and copies the content tables from production -
#      content only, never users, sessions, or per-user data
#   3. writes [env.preview] bindings + DEV_AUTH=allow into wrangler.toml
#
# Run it locally where wrangler is authenticated (`wrangler login`), then
# commit the wrangler.toml changes it makes. Re-running is safe; to refresh
# preview content later, just re-run (step 2 re-imports).
#
# Seams: everything in the block below.

set -euo pipefail
cd "$(dirname "$0")/.."

PROD_DB=myapp-db
DB_NAME=myapp-db-preview
BUCKET=                       # e.g. myapp-media-preview; empty = no R2
BUCKET_BINDING=MEDIA
SCHEMAS=(schema.sql)          # applied in order; ALTER TABLE lines may fail on re-run, that's fine
CONTENT_TABLES=(items)        # copied from production; NEVER users/sessions
WRANGLER_TOMLS=(wrangler.toml)

command -v wrangler >/dev/null 2>&1 || { echo "wrangler not found - npm i -g wrangler"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "python3 not found"; exit 1; }

# Don't swallow create errors with `|| echo "already exists"` - the free plan
# caps an account at 10 D1 databases, and a masked "limit reached" makes this
# script fail one line later with a confusing "couldn't find DB". Check for
# existence explicitly; let a real create failure stop the run.
echo "== Preview D1 database ($DB_NAME)"
if wrangler d1 info "$DB_NAME" --json >/dev/null 2>&1; then
  echo "   already exists"
else
  wrangler d1 create "$DB_NAME" || {
    echo
    echo "Could not create $DB_NAME. If the error above says 'databases per"
    echo "account (10)', the account is at the free-plan D1 cap: delete an"
    echo "unused database (wrangler d1 list / wrangler d1 delete <name>) or"
    echo "upgrade to Workers Paid, then re-run."
    exit 1
  }
fi
DB_ID=$(wrangler d1 info "$DB_NAME" --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('uuid') or d.get('id'))")
echo "   database_id: $DB_ID"

if [ -n "$BUCKET" ]; then
  echo "== Preview R2 bucket ($BUCKET)"
  if wrangler r2 bucket list 2>/dev/null | grep -qx "name: *$BUCKET"; then
    echo "   already exists"
  else
    wrangler r2 bucket create "$BUCKET"
  fi
fi

echo "== Applying schema"
for s in "${SCHEMAS[@]}"; do
  wrangler d1 execute "$DB_NAME" --remote --yes --file "$s" || echo "   $s: already applied (ALTER TABLE is not idempotent)"
done

echo "== Copying content tables from production (no user data)"
TMP=$(mktemp -d)
for t in "${CONTENT_TABLES[@]}"; do
  echo "   $t"
  wrangler d1 export "$PROD_DB" --remote --table "$t" --no-schema --output "$TMP/$t.sql"
  wrangler d1 execute "$DB_NAME" --remote --yes --file "$TMP/$t.sql" || echo "   ($t rows already present)"
done
rm -rf "$TMP"

echo "== Writing [env.preview] bindings into wrangler.toml files"
python3 - "$DB_ID" "$DB_NAME" "$BUCKET" "$BUCKET_BINDING" "${WRANGLER_TOMLS[@]}" <<'PYEOF'
import sys
db_id, db_name, bucket, binding, *tomls = sys.argv[1:]
block = f'''
# Preview deployments (non-main branches) get an isolated world: their own D1
# and R2 plus the dev-token login bypass. Managed by scripts/setup-preview.sh.
[env.preview.vars]
DEV_AUTH = "allow"

[[env.preview.d1_databases]]
binding = "DB"
database_name = "{db_name}"
database_id = "{db_id}"
'''
if bucket:
    block += f'''
[[env.preview.r2_buckets]]
binding = "{binding}"
bucket_name = "{bucket}"
'''
for path in tomls:
    content = open(path).read()
    if "env.preview" in content:
        print(f"   {path}: [env.preview] already present, skipping")
        continue
    open(path, "a").write(block)
    print(f"   {path}: added [env.preview] bindings")
PYEOF

echo
echo "Done. Review and commit the wrangler.toml changes:"
echo "  git diff ${WRANGLER_TOMLS[*]}"
