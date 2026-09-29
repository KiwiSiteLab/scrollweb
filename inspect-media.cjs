const {chromium}=require('C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://127.0.0.1:4173');
 fs.mkdirSync('inspection',{recursive:true});fs.mkdirSync('assets',{recursive:true});
 for(const [name,file] of [['reference','Website demonstration effect.mp4'],['background','backgroundvideo.mp4']]){
  const info=await page.evaluate(async(file)=>{document.body.innerHTML='';const v=document.createElement('video');v.muted=true;v.preload='auto';v.src='/'+encodeURIComponent(file);document.body.append(v);await new Promise((r,j)=>{v.onloadeddata=r;v.onerror=j});return {duration:v.duration,width:v.videoWidth,height:v.videoHeight};},file);
  console.log(name,info);
  for(let i=0;i<5;i++){
   const data=await page.evaluate(async(time)=>{const v=document.querySelector('video');if(time>0){v.currentTime=time;await new Promise(r=>v.onseeked=r);}const c=document.createElement('canvas');const ratio=Math.min(1,1200/v.videoWidth);c.width=v.videoWidth*ratio;c.height=v.videoHeight*ratio;c.getContext('2d').drawImage(v,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.88).split(',')[1];},i*(info.duration-.1)/4);
   fs.writeFileSync(`inspection/${name}-${i}.jpg`,Buffer.from(data,'base64'));
   if(name==='background'&&i===0)fs.writeFileSync('assets/poster.jpg',Buffer.from(data,'base64'));
  }
 }
 await browser.close();
})();
