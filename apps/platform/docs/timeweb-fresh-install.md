# Timeweb fresh installation

This deployment preserves the old UI and routes on an isolated database. It is not a restoration of the old Neon/Yandex history.

- Docker builds all 98 existing file-based API routes, with native PostgreSQL transport and TLS verification.
- No Yandex shadow writes, cron jobs, automatic source imports, legacy employee seeds or demo-auth bypass.
- The acceptance instance is read-only except login/logout. Only separately transferred existing administrators are enabled; a 1C employee record never creates an account or grants access.
- Run `node script/timeweb-bootstrap.mjs` only against an empty isolated `tandoor_lk` database. Applied SQL migrations are journalled. Legacy data-only backfills and fixed employee assignments are excluded.
- `script/timeweb-fetch-1c.mjs` reads explicitly named 1C files into a private temporary directory. It does not import or upload to FTP.
- `MIGRATION_OPERATOR_TOKEN` temporarily protects exact allowlisted source-file downloads. Remove it and the staged files when the migration is finished. Never publish this token, source data or credentials in the repository.
- `script/timeweb-import-approved.mjs` requires a specific reviewed normalized snapshot and its SHA256; refuses nonempty databases and wraps inserts in a transaction. Do not substitute an older RF snapshot for a changed current FTP export.
- Prices, stocks, prior comments, tasks and distribution are not restored by this process. Missing source values must not be reported as verified zero business activity.
- Domain cutover is blocked until actual authentication, client/outlet counts, current source hashes and catalog/media checks pass.

Local verification performed so far: existing frontend build; 98-route server build; isolated schema bootstrap; synthetic import; auth, bootstrap, clients, scope and catalog endpoint smoke. The repository's complete historical TypeScript/test baseline is not asserted clean.
