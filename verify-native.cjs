const {chromium}=require('C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:800},recordVideo:{dir:'inspection/native-recording',size:{width:1440,height:800}}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(()=>{const v=document.querySelector('#opening-video');return v.readyState>=2&&!v.paused;});
  await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
  await page.locator('#immersion-toggle').click();
  assert.equal(await page.locator('canvas').count(),0);
  const opening=await page.evaluate(async()=>{
    const v=document.querySelector('#opening-video');let frames=0,wraps=0,previous=v.currentTime;let active=true;
    function count(){if(!active)return;frames++;if(v.currentTime<previous)wraps++;previous=v.currentTime;v.requestVideoFrameCallback(count);}
    v.requestVideoFrameCallback(count);await new Promise(r=>setTimeout(r,3100));active=false;
    return {frames,wraps,duration:v.duration,width:v.videoWidth,height:v.videoHeight,scroll:scrollY,src:v.getAttribute('src')};
  });
  assert(opening.frames>45&&opening.wraps>=1);assert.equal(opening.scroll,0);
  await page.screenshot({path:'inspection/native-opening-a.png'});await page.waitForTimeout(460);await page.screenshot({path:'inspection/native-opening-b.png'});
  await page.locator('#motion-toggle').click();const paused=await page.locator('#opening-video').evaluate(v=>v.currentTime);await page.waitForTimeout(400);assert.equal(await page.locator('#opening-video').evaluate(v=>v.currentTime),paused);await page.locator('#motion-toggle').click();
  await page.evaluate(()=>scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*.5));await page.waitForTimeout(1200);
  assert(await page.locator('#opening-video').evaluate(v=>v.paused));assert.equal(await page.locator('#opening-video').evaluate(v=>v.style.opacity),'0');
  const middle=await page.locator('#scene-video').evaluate(v=>({time:v.currentTime,duration:v.duration}));assert(Math.abs(middle.time-middle.duration*.5)<.03);
  await page.screenshot({path:'inspection/native-middle.png'});
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.waitForFunction(()=>{const v=document.querySelector('#interior-video');return v.readyState>=2&&!v.paused;});await page.waitForTimeout(1000);
  await page.screenshot({path:'inspection/native-interior.png'});assert.equal(await page.locator('body').getAttribute('data-scene'),'interior');
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(1000);assert(!(await page.locator('#opening-video').evaluate(v=>v.paused)));
  await page.locator('#immersion-toggle').click();await page.screenshot({path:'inspection/native-home.png'});
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.goto('http://127.0.0.1:4173');await mobile.waitForFunction(()=>!document.querySelector('#opening-video').paused);assert((await mobile.locator('#opening-video').getAttribute('src')).includes('mobile'));assert(await mobile.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  await mobile.screenshot({path:'inspection/native-mobile.png'});await mobile.emulateMedia({reducedMotion:'reduce'});await mobile.reload();for(const id of ['scene-video','opening-video','interior-video'])assert.equal(await mobile.locator('#'+id).getAttribute('src'),null);
  assert.equal(errors.length,0);fs.writeFileSync('inspection/native-verification.json',JSON.stringify({opening,middle,errors,checked:['native idle playback','loop seam','pause/resume','scroll transition','return to exterior','mobile source','reduced motion']},null,2));console.log({opening,middle,errors});
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
