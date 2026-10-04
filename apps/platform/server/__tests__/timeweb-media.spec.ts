import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {sourceImagePath,makePreview,sha256} from '../../shared/timeweb-media.mjs';
describe('Timeweb private previews',()=>{
 it('confines source paths to the supplied image directory',()=>{
  expect(sourceImagePath('20260522\\R\\door.jpg')).toBe('/s3/IMG/20260522/R/door.jpg');
  for(const path of ['../a.jpg','20260522/../a.jpg','/20260522/a.jpg','https://x/a.jpg','20260522//a.jpg','20260522/a.svg']){
   expect(()=>sourceImagePath(path)).toThrow();
  }
 });
 it('decodes and creates bounded WebP; rejects corrupt input',async()=>{
  const input=await sharp({create:{width:1600,height:900,channels:3,background:'#123456'}}).png().toBuffer();
  const result=await makePreview(input),meta=await sharp(result).metadata();
  expect(meta.format).toBe('webp');expect(meta.width).toBe(1200);expect(sha256(result)).toMatch(/^[a-f0-9]{64}$/);
  await expect(makePreview(Buffer.from('not a photo'))).rejects.toThrow();
 });
});
