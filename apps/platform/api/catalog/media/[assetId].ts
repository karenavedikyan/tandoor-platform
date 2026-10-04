import type {VercelRequest,VercelResponse} from '@vercel/node';
import {createHash} from 'node:crypto';
import {getPool,resolveCurrentUser,vercelHeaders} from '../../../shared/admin/admin-auth.js';

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='GET' && req.method!=='HEAD'){res.status(405).end();return;}
  const pool=getPool();
  if(!pool){res.status(503).end();return;}
  const user=await resolveCurrentUser(pool,vercelHeaders(req));
  if(!user || user.status!=='active'){res.status(401).end();return;}
  const id=typeof req.query.assetId==='string'?req.query.assetId:'';
  if(!/^[a-f0-9]{64}$/.test(id)){res.status(404).end();return;}
  const r=await pool.query<{preview:Buffer;preview_sha256:string}>(
    'SELECT preview,preview_sha256 FROM wholesale_catalog_media WHERE asset_id=$1',[id]);
  const asset=r.rows[0];
  if(!asset || createHash('sha256').update(asset.preview).digest('hex')!==asset.preview_sha256){
    res.status(404).end();return;
  }
  res.setHeader('Content-Type','image/webp');
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Length',asset.preview.length);
  res.status(200).end(req.method==='HEAD'?undefined:asset.preview);
}
