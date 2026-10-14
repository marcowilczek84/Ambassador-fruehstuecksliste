# Ambassador Frühstück V4 — release candidate

Base: `9e9bc6b3a4fc5c164dfa8ff9610708a159f70b42`, the existing V4 iPad preview.
Branch: `breakfast-v4-final-readiness-20261014`.
Production remains `de5b310251e60fe7577166a29c82f31d67643524`.
No production database migration or deployment is authorized by this change.

## Scoped correction

The active `breakfast_service_action_v41` accepts only `Tisch 1` through
`Tisch 50`. The existing V4 interface already sends the distinct canonical
string `Roomservice`. PostgreSQL therefore rejects a positive Roomservice
check-in before writing. The prepared migration adds only that explicit value
to the existing validation. It preserves the RPC signature, permissions,
security-invoker execution, row lock, expected-state conflict checks, action
UUID deduplication, undo handling, all stored JSON and all other RPCs.

`Roomservice` is a service label, never a fabricated table number. Restaurant
selection remains 14 tables. Previously valid table numbers 15–50 remain valid
at the database boundary for historical records and older clients. Display
labels are translated without changing the stored canonical values.

Confirmed validation failures are displayed accurately. A rejected first
request unlocks the choice; an unresolved retry retains its original UUID.
The Roomservice picker makes the background inert. The legacy translation
adapter now follows the service language selector, preventing mixed-language
labels after DE/EN/VI switches. No broad visual redesign is included.

## Migration approval package

- Forward SQL: `sql/migrations/20261013_breakfast_roomservice_table_choice.sql`
- Rollback SQL: `sql/rollback/20261013_breakfast_roomservice_table_choice.sql`
- Expected current function MD5: `dda8c217b4008341fd49554fd46a1b28`
- Candidate function MD5: `55546fee9f035bb5c02101ebefa76dd5`

Both scripts run transactionally, check the exact function version before
replacement, and use bounded lock/statement timeouts. They contain no row
updates, deletes, table changes or permission changes. Stop if the version
guard fails; review any intervening change instead of bypassing the guard.

After explicit owner approval, during a quiet service window:

1. Re-read the current function, grants, table schema and production deployment.
2. Record a restorable database/schema backup and historical payload checksums.
3. Apply only the reviewed forward migration through the normal migration process.
4. Verify the function checksum, permissions and unchanged historical checksums.
5. Separately obtain authorization for the production application release.
6. Verify the first authorized operational Roomservice booking and its display.

If rollback is required, first stop new Roomservice submissions and reconcile
pending UUIDs against the saved action ledger. Restore the previous UI release
and apply the reviewed rollback SQL. Existing Roomservice records remain
readable and individually undoable; never convert them to fake table numbers,
delete them, or restore an old whole-day payload over newer service activity.
An unresolved request must not be blindly repeated with a new UUID.

Risk: the DDL takes a short function lock; a busy system can hit the configured
timeout, leaving the old function intact. Old clients still cannot create
Roomservice bookings, but retain normal table operations. The migration does
not remedy unrelated pre-existing database access-control concerns; those are
a separate production release gate in the owner handover.

## Isolated review preview

Vercel Preview builds route the live entry to `/qa-v4.html`, use a same-origin
connection policy and display an explicit test-data notice. The actual app
runs in an isolated iframe. Its requests execute the reviewed SQL functions
in PostgreSQL 17.5 (PGlite 0.3.14), persisted in a dedicated QA IndexedDB.
Only synthetic fixtures are seeded. No production rows or credentials are
copied into the test database. Production builds retain the normal entry.

The preview supports table/Roomservice checks, targeted undo, full reload,
offline simulation, a lost response after commit, and a second-client action.
The preview database belongs to that browser and origin; it is not the live
Supabase database and does not synchronize between physical devices. Use one
preview tab per browser. Database migration approval is still required before
production Roomservice can work.

## Reproducible verification

```sh
npm ci
VERCEL_ENV=preview npm run build
npm run typecheck
npm run lint
npm test
npx playwright install --with-deps chromium webkit
npm run test:browser
QA_BROWSER=webkit npm run test:browser
```

The GitHub workflow `V4 isolated production readiness` additionally runs the
actual SQL against a disposable PostgreSQL 17.6 service with three independent
database connections. It checks blocked row-lock contenders, stale-state
conflicts, UUID replay, concurrent different-room updates and data-preserving
rollback. It contains no production connection or deployment step.

Browser cases use 1194×834, 1024×768, 393×852 and 1440×1000, capture screenshots
and record touch target/dialog measurements, canonical persisted bookings,
signed events, unchanged unrelated rooms, reload, translations and polling.
PGlite tests also exercise the previous SQL suites, 45-room historical JSON,
unknown legacy fields, reception edits and safe import. Existing Mews parser
tests retain their 25 synthetic cases.

Evidence is written to `qa-evidence/` and archived by CI. Native iPad/iPhone
Safari and a real two-device Supabase session are distinct final operational
checks; browser viewport tests do not claim physical-device certification.
