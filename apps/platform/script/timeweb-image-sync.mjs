import fs from 'node:fs';
import pg from 'pg';
import {Client} from 'basic-ftp';
import {Writable} from 'node:stream';
import {sha256,sourceImagePath,makePreview} from '../shared/timeweb-media.mjs';
const url=new URL(process.env.DATABASE_URL||'');
if(url.pathname!=='/tandoor_lk')throw Error('ISOLATED_DATABASE_ONLY');
if(!process.argv.includes('--apply'))throw Error('MANUAL_APPLY_REQUIRED');
const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:true,
  ca:process.env.PG_SSL_ROOT_CERT,servername:process.env.PG_TLS_SERVERNAME||url.hostname}});
const ftp=new Client(30000);
const stats={attempted:0,ready:0,skipped:0,failed:0,sourceBytes:0,previewBytes:0,errors:{}};
const journal=()=>fs.writeFileSync('/tmp/tandoor-lk-images-status.json',JSON.stringify({at:new Date().toISOString(),...stats}),{mode:0o600});
try{
 await db.connect();
 const lock=await db.query("SELECT pg_try_advisory_lock(hashtext('lk-manual-images')) AS acquired");
 if(!lock.rows[0].acquired)throw Error('SYNC_ALREADY_RUNNING');
 await db.query(`CREATE TABLE IF NOT EXISTS wholesale_catalog_media(
   asset_id char(64) PRIMARY KEY, source_path text UNIQUE NOT NULL, source_sha256 char(64) NOT NULL,
   source_bytes bigint NOT NULL, preview bytea NOT NULL, preview_sha256 char(64) NOT NULL,
   created_at timestamptz NOT NULL DEFAULT now())`);
 const paths=await db.query('SELECT DISTINCT path FROM catalog_product_images ORDER BY path');
 await ftp.access({host:process.env.FTP_HOST,port:Number(process.env.FTP_PORT||21),
   user:process.env.FTP_USER,password:process.env.FTP_PASSWORD,secure:process.env.FTP_SECURE==='1'});
 for(const {path} of paths.rows){
  if(stats.sourceBytes>=2*1024**3 || stats.attempted>=4000)break;
  try{
   const remote=sourceImagePath(path),assetId=sha256(Buffer.from(path));
   const existing=await db.query('SELECT preview,preview_sha256 FROM wholesale_catalog_media WHERE asset_id=$1',[assetId]);
   if(existing.rows[0] && sha256(existing.rows[0].preview)===existing.rows[0].preview_sha256.trim()){
     stats.skipped++;continue;
   }
   stats.attempted++;
   const before=await ftp.size(remote);
   if(before>16*1024**2)throw Error('FILE_TOO_LARGE');
   if(stats.sourceBytes+before>2*1024**3)break;
   const chunks=[];let total=0;
   await ftp.downloadTo(new Writable({write(chunk,_e,cb){
     total+=chunk.length;stats.sourceBytes+=chunk.length;
     if(total>16*1024**2 || stats.sourceBytes>2*1024**3)return cb(Error('BYTE_BUDGET'));
     chunks.push(chunk);cb();
   }}),remote);
   if(before!==total || await ftp.size(remote)!==total)throw Error('SOURCE_CHANGED');
   const bytes=Buffer.concat(chunks),preview=await makePreview(bytes);
   await db.query('BEGIN');
   await db.query(`INSERT INTO wholesale_catalog_media(asset_id,source_path,source_sha256,source_bytes,preview,preview_sha256)
     VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(asset_id) DO UPDATE SET source_sha256=EXCLUDED.source_sha256,
     source_bytes=EXCLUDED.source_bytes,preview=EXCLUDED.preview,preview_sha256=EXCLUDED.preview_sha256`,
     [assetId,path,sha256(bytes),total,preview,sha256(preview)]);
   await db.query('UPDATE catalog_product_images SET blob_url=$1 WHERE path=$2',['/api/catalog/media/'+assetId,path]);
   await db.query('COMMIT');
   stats.ready++;stats.previewBytes+=preview.length;
  }catch(e){
   await db.query('ROLLBACK').catch(()=>{});
   const code=String(e.code||e.message||'IMAGE_FAILED').slice(0,60);
   stats.failed++;stats.errors[code]=(stats.errors[code]||0)+1;
   if(ftp.closed){await ftp.access({host:process.env.FTP_HOST,port:Number(process.env.FTP_PORT||21),
     user:process.env.FTP_USER,password:process.env.FTP_PASSWORD,secure:process.env.FTP_SECURE==='1'});}
  }
  if(stats.attempted%25===0)journal();
 }
 journal();console.log(JSON.stringify({completed:true,...stats}));
}catch(e){journal();console.error(JSON.stringify({completed:false,code:e.code||e.message}));process.exitCode=1;}
finally{ftp.close();await db.end();}
