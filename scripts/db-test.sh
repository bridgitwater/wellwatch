#!/usr/bin/env bash
# Applies the migrations + seed to a throwaway local Postgres database and runs the RLS tests.
# Requires a local Postgres (not Supabase). Configure with PGHOST/PGPORT/PGUSER as usual.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${WELLWATCH_TEST_DB:-wellwatch_test}"
dropdb --if-exists "$DB"
createdb "$DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/test/00_local_shim.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/seed.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/test/rls.test.sql | tail -1
