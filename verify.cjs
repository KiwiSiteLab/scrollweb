const {chromium}=require('C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
 await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
 const results=[];
 for(const p of [0,.25,.5,.75,1,.3,0]){
  await page.evaluate(p=>scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*p),p);
  await page.waitForTimeout(850);
  const info=await page.evaluate(()=>{const v=document.querySelector('video');return {scroll:scrollY/(document.documentElement.scrollHeight-innerHeight),time:v.currentTime,duration:v.duration,seeking:v.seeking,progress:document.querySelector('#progress-text').textContent,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert(Math.abs(info.time-info.duration*p)<.10,JSON.stringify(info));assert(!info.overflow);
  results.push({target:p,...info});
  if([0,.25,.5,1].includes(p))await page.screenshot({path:`inspection/desktop-${p}.png`});
 }
 await page.locator('a.contact-nav').click();await page.waitForTimeout(900);
 await page.locator('#show-card').click();assert(await page.locator('dialog').evaluate(x=>x.open));await page.screenshot({path:'inspection/card.png'});await page.keyboard.press('Escape');assert(!(await page.locator('dialog').evaluate(x=>x.open)));
 assert.equal(await page.locator('.contact-row').first().getAttribute('href'),'tel:+64210749792');
 await page.locator('#motion-toggle').click();assert(await page.locator('body').evaluate(x=>x.classList.contains('is-static')));
 await page.locator('#motion-toggle').click();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(900);await page.screenshot({path:'inspection/mobile-top.png'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(900);await page.screenshot({path:'inspection/mobile-contact.png'});
 assert(await page.locator('#show-card').isVisible());
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForTimeout(400);
 assert(await page.locator('body').evaluate(x=>x.classList.contains('is-static')));
 assert.equal(await page.locator('video').getAttribute('src'),null);
 await page.screenshot({path:'inspection/mobile-reduced-motion.png'});
 const nojs=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});await nojs.goto('http://127.0.0.1:4173');assert(await nojs.locator('h1').isVisible());assert(await nojs.locator('a[href="tel:+64210749792"]').count());
 assert.equal(errors.length,0,errors.join('\n'));
 fs.writeFileSync('inspection/verification.json',JSON.stringify({results,errors,checked:['forward/reverse seek','start/end','desktop/mobile layout','business card dialog and Escape','phone/email links','static toggle','reduced motion skips video','no-JS content']},null,2));
 console.log(JSON.stringify({results,errors,passed:true},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
