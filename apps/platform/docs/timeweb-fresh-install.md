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
# Live acceptance update, 2026-10-04

The latest FTP source was downloaded as a bounded read-only snapshot. It is not the older RF database snapshot.
The isolated `tandoor_lk` database received 3,087 clients, 473 identified open outlets, 42 employee-directory records
(not accounts), 4,372 products, 229 sections and 1,120 unique named groups.
The 3,783 group rows contain 2,663 byte-equivalent duplicate records; conflicting group IDs are rejected.
The previous single invalid holding relationship is corrected in the latest file; no client was quarantined.
471 unresolved holding references remain visible in source metadata under the agreed tolerant policy.
24 products reference 8 missing group GUIDs; these original GUIDs are retained.
Only the existing active administrator account was transferred; there are no automatic employee grants.

Photo source: FTP `/s3/IMG`, with each relative path taken from the validated product XML.
Run `node script/timeweb-image-sync.mjs --apply` manually in the isolated app only.
The sync verifies bounded source bytes, decodes via sharp, generates bounded WebP previews and atomically
stores each preview and its authenticated application URL in the isolated PostgreSQL database.
It does not use Vercel, a public bucket, a new paid resource or a scheduler.
The media route checks an active session and validates the preview hash before serving.
Images are private/no-store. Missing or invalid images remain placeholders, never fabricated photos.
Limits: 4,000 attempted files/run, 2 GiB actual source bytes/run, 16 MiB/source file, 40 million pixels,
20-second sharp timeout, 1,200-pixel previews and 2 MiB per preview.
Database storage is within the existing approved 20-GB database, not an additional service.
