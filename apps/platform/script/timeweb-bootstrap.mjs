import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url=new URL(process.env.DATABASE_URL || '');
if(!['/lk_migration_test','/tandoor_lk'].includes(url.pathname)) throw Error('FRESH_DATABASE_ONLY');
const test=url.hostname==='127.0.0.1' && url.pathname==='/lk_migration_test';
const client=new pg.Client({connectionString:url.toString(),ssl:test?false:{
  rejectUnauthorized:true,ca:process.env.PG_SSL_ROOT_CERT,servername:process.env.PG_TLS_SERVERNAME||url.hostname},statement_timeout:60000});
await client.connect();
try {
  const hasUsers=(await client.query("SELECT to_regclass('public.users') AS t")).rows[0].t;
  if(hasUsers && Number((await client.query('SELECT count(*) AS n FROM users')).rows[0].n)>0) throw Error('DATABASE_NOT_EMPTY');
  await client.query(fs.readFileSync('server/db-migrate/yandex-schema.sql','utf8'));
  // Dealer metadata is created after the historical schema tables exist.
  const freshSql=fs.readFileSync('script/timeweb-fresh-schema.sql','utf8');
  await client.query(freshSql.split('CREATE TABLE IF NOT EXISTS wholesale_client_metadata')[0]);
  await client.query(`CREATE TABLE IF NOT EXISTS timeweb_fresh_migrations
    (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const alreadyApplied=new Set((await client.query('SELECT filename FROM timeweb_fresh_migrations')).rows.map(r=>r.filename));
  const skip=new Set([
    '2026_06_02_seed_rop_rm_assignments.sql',
    // Data-only legacy trash backfill has no rows to reconcile on a fresh installation.
    '2026_06_20_trade_point_trash_cascade_backfill.sql',
    '2026_06_24_effective_scope_foundation.sql',
    '2026_06_24_effective_scope_hotfix.sql',
    '2026_06_24_effective_scope_hotfix2_rop_via_team.sql',
    '2026_06_24_effective_scope_hotfix3_rop_grants.sql',
  ]);
  const prisma=fs.readdirSync('prisma/migrations').sort().map(n=>path.join('prisma/migrations',n,'migration.sql')).filter(fs.existsSync);
  let pending=[...prisma,...fs.readdirSync('server/migrations').filter(n=>n.endsWith('.sql')&&!skip.has(n)).sort().map(n=>'server/migrations/'+n)];
  pending=pending.filter(n=>!alreadyApplied.has(n));
  const applied=[]; const errors=new Map();
  for(let pass=0;pass<5 && pending.length;pass++){
    const next=[];
    for(const file of pending){
      const sql=fs.readFileSync(file,'utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm,'');
      try{
        await client.query('BEGIN'); await client.query(sql);
        await client.query('INSERT INTO timeweb_fresh_migrations(filename) VALUES($1)',[file]);
        await client.query('COMMIT');
        applied.push(file); errors.delete(file);
      }catch(e){
        await client.query('ROLLBACK'); next.push(file);errors.set(file,{code:e.code,message:e.message});
      }
    }
    if(next.length===pending.length){pending=next;break;} pending=next;
  }
  if(pending.length) {
    console.log(JSON.stringify({applied:applied.length,pending:pending.map(file=>({file,...errors.get(file)}))},null,2));
    process.exitCode=1;
  }else{
    await client.query(freshSql);
    await client.query(`CREATE OR REPLACE VIEW effective_scope AS
      SELECT ra.user_id::text AS user_id,d.id::text AS dealer_id,d.external_key AS dealer_external_key,
      ra.responsible_role,'responsibility_assignments'::text AS source
      FROM responsibility_assignments ra JOIN dealers d ON d.external_key=ra.scope_key
      WHERE ra.scope_kind='dealer'`);
    console.log(JSON.stringify({applied:applied.length,skippedLegacyDataMigrations:[...skip],fresh:true}));
  }
} finally {await client.end();}
