import crypto from 'node:crypto';
import sharp from 'sharp';
// Bound decoder concurrency/cache on the approved 2-GB application instance.
sharp.concurrency(1);
sharp.cache({memory:16,files:0,items:10});
export const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
export function sourceImagePath(raw){
  if(typeof raw!=='string' || !raw || raw.length>1024 || /[\x00-\x1f:]/.test(raw))throw Error('INVALID_IMAGE_PATH');
  const path=raw.replaceAll('\\','/');
  if(path.startsWith('/')||path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('INVALID_IMAGE_PATH');
  if(!/^\d{8}\//.test(path)||!/\.(?:jpe?g|png|webp)$/i.test(path))throw Error('INVALID_IMAGE_PATH');
  return '/s3/IMG/'+path;
}
export async function makePreview(bytes){
  const image=sharp(bytes,{limitInputPixels:40_000_000,failOn:'error',animated:false})
    .timeout({seconds:20}).rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true})
    .webp({quality:78});
  const out=await image.toBuffer();
  if(out.length>2*1024*1024)throw Error('PREVIEW_TOO_LARGE');
  const meta=await sharp(out).metadata();
  if(meta.format!=='webp')throw Error('PREVIEW_INVALID');
  return out;
}
