const {chromium}=require('C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:800},recordVideo:{dir:'inspection/living-recording',size:{width:1440,height:800}}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:4173');await page.waitForSelector('body.living-ready');
 await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
 await page.screenshot({path:'inspection/living-hero.png'});
 await page.locator('#immersion-toggle').click();
 const results=[];
 for(const p of [0,.5,.78,1]){
   await page.evaluate(p=>scrollTo(0,p*(document.documentElement.scrollHeight-innerHeight)),p);await page.waitForTimeout(1400);
   const start=await page.locator('video').evaluate(v=>v.currentTime);
   await page.screenshot({path:`inspection/living-${p}-a.png`});await page.waitForTimeout(1800);
   await page.screenshot({path:`inspection/living-${p}-b.png`});
   const end=await page.locator('video').evaluate(v=>v.currentTime);assert(Math.abs(end-start)<.001,'Camera moved while idle');
   results.push({p,start,end});
 }
 await page.locator('#motion-toggle').click();
 await page.waitForTimeout(150);await page.screenshot({path:'inspection/living-paused-a.png'});await page.waitForTimeout(600);await page.screenshot({path:'inspection/living-paused-b.png'});
 await page.locator('#motion-toggle').click();await page.locator('#immersion-toggle').click();await page.screenshot({path:'inspection/living-contact.png'});
 await page.locator('#show-card').click();assert(await page.locator('dialog').evaluate(d=>d.open));await page.keyboard.press('Escape');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.goto('http://127.0.0.1:4173');await mobile.waitForSelector('body.living-ready');await mobile.screenshot({path:'inspection/living-mobile.png'});assert(await mobile.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
 await mobile.emulateMedia({reducedMotion:'reduce'});await mobile.reload();assert.equal(await mobile.locator('video').getAttribute('src'),null);
 assert.equal(errors.length,0,errors.join('\n'));
 fs.writeFileSync('inspection/living-verification.json',JSON.stringify({results,errors},null,2));console.log({results,errors});await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
