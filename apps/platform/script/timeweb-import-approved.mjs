import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';

// Explicit, one-time installation into an EMPTY isolated database.
// Never reads/writes RF, never fetches FTP, and never grants roster-derived rights.
const file=process.argv[2];
const expected=process.argv[3];
if(!file || !/^[a-f0-9]{64}$/.test(expected||'')) throw Error('SNAPSHOT_AND_SHA_REQUIRED');
const bytes=fs.readFileSync(file);
if(crypto.createHash('sha256').update(bytes).digest('hex')!==expected) throw Error('SNAPSHOT_SHA_MISMATCH');
const d=JSON.parse(bytes);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nullableGuid=v=>v && uuid.test(v) && v!=='00000000-0000-0000-0000-000000000000'?v:null;
for(const rows of [d.clients,d.outlets,d.products,d.sections,d.groups,d.admins]) if(!Array.isArray(rows))throw Error('INVALID_SOURCE');
const clients=new Map(d.clients.map(c=>[c.guid_client,c]));
if(clients.size!==d.clients.length || d.clients.some(c=>!uuid.test(c.guid_client)||c.baseline_status!=='active')) throw Error('INVALID_CLIENTS');
if(d.outlets.some(o=>!uuid.test(o.guid_store)||!clients.has(o.guid_client)||typeof o.is_closed!=='boolean'))throw Error('INVALID_OUTLETS');
if(d.products.some(p=>!uuid.test(p.code))||d.product_properties.some(p=>!uuid.test(p.property_code)))throw Error('INVALID_CATALOG');
if(d.admins.some(a=>a.role!=='admin'||a.status!=='active'||!a.password_hash?.startsWith('$2')))throw Error('INVALID_ADMIN');
const url=new URL(process.env.DATABASE_URL||'');
if(!['/tandoor_lk','/lk_migration_test'].includes(url.pathname))throw Error('ISOLATED_DATABASE_ONLY');
const test=url.hostname==='127.0.0.1' && url.pathname==='/lk_migration_test';
const c=new pg.Client({connectionString:url.toString(),ssl:test?false:{rejectUnauthorized:true,
  ca:process.env.PG_SSL_ROOT_CERT,servername:process.env.PG_TLS_SERVERNAME||url.hostname},statement_timeout:120000});
await c.connect();
async function insert(table,cols,rows){
  if(!rows.length)return;
  for(let i=0;i<rows.length;i+=1000){
    const batch=rows.slice(i,i+1000);
    const values=batch.flatMap(r=>cols.map(k=>r[k]??null));
    const slots=batch.map((_,j)=>'('+cols.map((_,k)=>'$'+(j*cols.length+k+1)).join(',')+')').join(',');
    await c.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${slots}`,values);
  }
  console.log(JSON.stringify({table,inserted:rows.length}));
}
try{
  await c.query('BEGIN');
  await c.query("SELECT pg_advisory_xact_lock(hashtext('timeweb-fresh-wholesale'))");
  for(const table of ['users','dealers','trade_points','catalog_products','exchange_legals_raw']){
    if(Number((await c.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n))throw Error('DATABASE_NOT_EMPTY');
  }
  await insert('users',['id','email','phone','full_name','role','status','password_hash','must_change_password'],
    d.admins.map(a=>({...a,must_change_password:false})));
  await insert('dealers',['id','external_key','name','release_code','status','is_active','is_closed','holding','manager_name','release_address','source'],
    d.clients.map(r=>({id:r.guid_client,external_key:'client-'+r.guid_client,name:r.name_client,release_code:r.guid_client,
      status:'активный',is_active:true,is_closed:false,holding:r.name_holding,manager_name:r.name_manager,release_address:r.address,source:'1c-wholesale'})));
  await insert('exchange_legals_raw',['id_1c','name','phone','responsible_manager_1c','responsible_manager_name',
    'regional_manager_1c','regional_manager_name','furniture_manager_1c','furniture_manager_name','parent_1c','source_file'],
    d.clients.map(r=>({id_1c:r.guid_client,name:r.name_client,phone:r.telephone,
      responsible_manager_1c:nullableGuid(r.guid_manager),responsible_manager_name:r.name_manager,
      regional_manager_1c:nullableGuid(r.guid_regional_manager),regional_manager_name:r.name_regional_manager,
      furniture_manager_1c:nullableGuid(r.guid_hardware_manager),furniture_manager_name:r.name_hardware_manager,
      parent_1c:clients.has(r.guid_holding)?r.guid_holding:null,source_file:'all_clients.json#'+r.source_sha256})));
  const outletDetails=new Map();
  for(const r of d.clients)for(const o of r.extended_snapshot?.currentRetailOutlets||[])if(o.guidStore)outletDetails.set(o.guidStore,o);
  await insert('trade_points',['id','external_key','dealer_id','name','address','is_active','source'],
    d.outlets.map(r=>{const o=outletDetails.get(r.guid_store);if(!o)throw Error('OUTLET_DETAILS_MISSING');
      return {id:r.guid_store,external_key:r.guid_store,dealer_id:r.guid_client,
        name:o.holdingName?.trim()||o.address?.storeAddress?.trim()||`ТТ ${r.guid_store}`,
        address:o.address?.storeAddress||null,is_active:!r.is_closed,source:'1c-wholesale'};}));
  await insert('exchange_stores_raw',['id_1c','name','address','legal_entity_1c','manager_1c','manager_name','source_file',
    'status','linked_trade_point_id','linked_at'],
    d.outlets.map(r=>{const o=outletDetails.get(r.guid_store);
      return {id_1c:r.guid_store,name:o.holdingName?.trim()||o.address?.storeAddress?.trim()||`ТТ ${r.guid_store}`,
        address:o.address?.storeAddress||null,legal_entity_1c:r.guid_client,manager_1c:nullableGuid(o.managers?.manager?.guid),
        manager_name:o.managers?.manager?.name,source_file:'all_clients.json#'+r.last_source_sha256,
        status:r.is_closed?'ignored':'linked',linked_trade_point_id:r.guid_store,linked_at:new Date()};}));
  await insert('wholesale_client_metadata',['guid_client','source_sha256','holding_link_state','pending_holding_guid','manager_roster_state','raw'],
    d.clients.map(r=>({guid_client:r.guid_client,source_sha256:r.source_sha256,holding_link_state:r.holding_link_state,
      pending_holding_guid:r.guid_holding_pending,manager_roster_state:r.manager_roster_state,raw:JSON.stringify(r)})));
  await insert('wholesale_outlet_metadata',['guid_store','guid_client','closed','source_sha256','raw'],
    d.outlets.map(r=>({guid_store:r.guid_store,guid_client:r.guid_client,closed:r.is_closed,
      source_sha256:r.last_source_sha256,raw:JSON.stringify(outletDetails.get(r.guid_store))})));
  await insert('catalog_categories',['id','name','parent_id'],d.sections.map(r=>({id:r.code,name:r.name,parent_id:null})));
  for(const r of d.sections)if(nullableGuid(r.parent_code))await c.query('UPDATE catalog_categories SET parent_id=$1 WHERE id=$2',[r.parent_code,r.code]);
  await insert('catalog_groups',['id','parent_id'],d.groups.map(r=>({id:r.code,parent_id:nullableGuid(r.parent_code)})));
  await insert('catalog_products',['id','group_id','name','active','is_on_site'],
    d.products.map(r=>({id:r.code,group_id:nullableGuid(r.group_code),name:r.name,active:r.activity===true,is_on_site:true})));
  await insert('catalog_product_properties',['product_id','property_code','name','value'],
    d.product_properties.map(r=>({product_id:r.product_code,property_code:r.property_code,name:r.property_name,value:r.property_value})));
  await insert('catalog_product_categories',['product_id','category_id'],
    d.product_sections.map(r=>({product_id:r.product_code,category_id:r.section_code})));
  await insert('catalog_product_images',['product_id','path','sort_order'],
    d.product_images.map(r=>({product_id:r.product_code,path:r.image_path,sort_order:r.sort_order})));
  await c.query(`UPDATE catalog_products p SET brand=(SELECT value FROM catalog_product_properties v
    WHERE v.product_id=p.id AND lower(v.name)='бренд' LIMIT 1)`);
  await c.query('REFRESH MATERIALIZED VIEW mv_stores_1c');
  await c.query('REFRESH MATERIALIZED VIEW mv_clients_1c');
  await c.query(`INSERT INTO wholesale_source_snapshots(source_kind,source_sha256,raw) VALUES($1,$2,$3::jsonb)`,
    [d.origin,expected,JSON.stringify({capturedAt:d.capturedAt,clientsSourceHashes:[...new Set(d.clients.map(r=>r.source_sha256))],
      catalogVersion:d.catalogVersion,clients:d.clients.length,outlets:d.outlets.length,products:d.products.length,
      commercialStatus:'not_imported',historyStatus:'not_restored',employeeAccounts:'existing_admin_only'})]);
  await c.query('COMMIT');
  console.log(JSON.stringify({committed:true,clients:d.clients.length,outlets:d.outlets.length,products:d.products.length,admins:d.admins.length}));
}catch(e){await c.query('ROLLBACK');throw Error('IMPORT_FAILED_'+(e.code||e.message));}
finally{await c.end();}
