import http from 'node:http';
import {createReadStream, statSync} from 'node:fs';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.mp4':'video/mp4','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
http.createServer((req,res)=>{
  let path;
  try {path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));} catch {res.writeHead(400).end();return;}
  if(path===resolve(root)) path=resolve(root,'index.html');
  if(!path.startsWith(resolve(root)+sep)){res.writeHead(403).end();return;}
  try {
    const stat=statSync(path); if(!stat.isFile()) throw Error();
    const headers={'Content-Type':types[extname(path)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
    const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    let start=0,end=stat.size-1,status=200;
    if(range){start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),end):end;status=206;if(start>end){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;}
    headers['Content-Length']=end-start+1;res.writeHead(status,headers);
    if(req.method==='HEAD')res.end();else createReadStream(path,{start,end}).pipe(res);
  }catch{res.writeHead(404).end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173'));
