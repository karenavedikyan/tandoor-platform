import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Writable } from 'node:stream';
import { Client } from 'basic-ftp';

// Manual, read-only FTP fetch. No database writes or FTP writeback.
const dir='/tmp/tandoor-lk-source';
const files=[
  ['clients.json','clients/all_clients.json',32*1024*1024],
  ['employees.json','clients/all_employees.json',32*1024*1024],
  ['groups.json','catalog/groups/data.json',32*1024*1024],
  ['groups.xml','catalog/groups/data.xml',32*1024*1024],
  ['sections.xml','catalog/section/data.xml',32*1024*1024],
  ['products.xml','catalog/products/data.xml',64*1024*1024],
];
const c=new Client(120000);
try{
  if(!process.env.FTP_USER||!process.env.FTP_PASSWORD)throw Error('FTP_CREDENTIALS_REQUIRED');
  await c.access({host:process.env.FTP_HOST,port:Number(process.env.FTP_PORT||21),
    user:process.env.FTP_USER,password:process.env.FTP_PASSWORD,secure:process.env.FTP_SECURE==='1'});
  await c.cd(process.env.FTP_BASE_PATH||'/LC');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const manifest=[];
  for(const [name,remote,limit] of files){
    const before=await c.size(remote);if(before>limit)throw Error('SOURCE_LIMIT');
    const chunks=[];let size=0;
    await c.downloadTo(new Writable({write(b,_e,cb){size+=b.length;if(size>limit)return cb(Error('SOURCE_LIMIT'));chunks.push(b);cb();}}),remote);
    const after=await c.size(remote);if(before!==after||size!==after)throw Error('SOURCE_CHANGED');
    const data=Buffer.concat(chunks);
    fs.writeFileSync(path.join(dir,name),data,{mode:0o600});
    manifest.push({name,bytes:size,sha256:crypto.createHash('sha256').update(data).digest('hex')});
  }
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),files:manifest}),{mode:0o600});
  console.log(JSON.stringify({readOnly:true,files:manifest}));
}catch(e){console.error(JSON.stringify({code:e.code||'FETCH_FAILED',type:e.name}));process.exitCode=1;}
finally{c.close();}
