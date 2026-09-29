const {chromium}=require('C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const p=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 await p.goto('http://127.0.0.1:4173');await p.waitForFunction(()=>document.querySelector('video').readyState>=2);
 assert((await p.locator('video').getAttribute('src')).includes('mobile'));
 const frames=await p.evaluate(async()=>{
  document.documentElement.style.scrollBehavior='auto';let seeks=0;const v=document.querySelector('video');v.addEventListener('seeked',()=>seeks++);
  await new Promise(resolve=>{const start=performance.now();function run(t){const k=Math.min(1,(t-start)/3000);scrollTo(0,k*(document.documentElement.scrollHeight-innerHeight));if(k<1)requestAnimationFrame(run);else resolve();}requestAnimationFrame(run);});
  return seeks;
 });
 await p.waitForTimeout(800);assert(frames>20,`Too few seek completions: ${frames}`);
 assert.equal(await p.locator('#progress-text').textContent(),'100%');
 await p.screenshot({path:'inspection/mobile-contact-final.png'});
 const contact=await p.locator('.contact-layout').boundingBox();assert(contact.y>=90);
 const card=await p.locator('#show-card').boundingBox();const footer=await p.locator('footer').boundingBox();assert(card.y+card.height<footer.y);
 await p.locator('#show-card').click();await p.screenshot({path:'inspection/mobile-card.png'});await p.locator('#close-card').click();
 const fallback=await browser.newPage();await fallback.route('**/*.mp4',r=>r.abort());await fallback.goto('http://127.0.0.1:4173');await fallback.waitForFunction(()=>document.querySelector('#media-status').textContent.includes('暂不可用'));assert(await fallback.locator('h1').isVisible());
 fs.writeFileSync('inspection/edge-cases.json',JSON.stringify({mobileSeekCompletionsIn3Seconds:frames,mobileSource:true,contactBelowHeader:true,contactAboveFooter:true,videoFailureFallback:true},null,2));
 console.log({frames,contact,card,footer,passed:true});await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
