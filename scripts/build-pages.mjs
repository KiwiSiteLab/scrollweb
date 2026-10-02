import {copyFile, mkdir, rm, stat, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=resolve(root,'dist-pages');
if(dirname(output)!==root)throw new Error('Unexpected publish directory');
const files=[
  'index.html','style.css','app.js','backgroundvideo-scrub.mp4',
  '7604b7bb0f20ae9bf97023755a9269e2.jpg','assets/favicon.svg',
  'assets/web/poster.jpg','assets/web/return-exterior.mp4',
  ...['exterior','living','kitchen'].flatMap(scene=>
    ['840','1260'].map(size=>`assets/web/${scene}-buffered-${size}.mp4`)),
  ...['exterior','living','dining'].map(scene=>`assets/work/${scene}.webp`),
];
await rm(output,{recursive:true,force:true});
let total=0;
for(const relative of files){
  const source=resolve(root,relative),destination=resolve(output,relative);
  if(!source.startsWith(root+'\\')&&!source.startsWith(root+'/'))throw new Error(`Unexpected source: ${relative}`);
  if(!destination.startsWith(output+'\\')&&!destination.startsWith(output+'/'))throw new Error(`Unexpected destination: ${relative}`);
  await mkdir(dirname(destination),{recursive:true});
  await copyFile(source,destination);
  total+=(await stat(destination)).size;
}
await writeFile(join(output,'.nojekyll'),'');
console.log(`Pages bundle: ${files.length} files, ${(total/1024/1024).toFixed(1)} MiB`);
