const assert = require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const axePath=require.resolve('axe-core/axe.min.js');
const fs=require('node:fs');
const origin='http://127.0.0.1:4173';
const choices=['b','a','b','a','b','a','a','a','b','a','b','both','a','b','a','b'];
async function audit(page,label){
  await page.addScriptTag({path:axePath});
  const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
  assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],label);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' fits viewport');
}
async function pixels(page){return page.evaluate(()=>['portrait-a','portrait-b'].map(id=>{const c=document.getElementById(id).getContext('2d');return [...c.getImageData(400,300,100,100).data,...c.getImageData(450,730,40,30).data];}));}
async function choose(page,value){await page.locator('#show-b').click();await page.locator(`[data-answer="${value}"]`).click();await page.locator('#next').click();}
async function openSource(page){if(await page.locator('#source-tools').getAttribute('open')===null)await page.locator('#source-tools>summary').click();}
async function comparisonChecks(browser,name,width){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();const errors=[],unexpected=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(u.origin!==origin||r.method()!=='GET'||u.pathname.startsWith('/projects/color-lab/'))unexpected.push(r.url());});
 try{
  await page.goto(origin+'/projects/draping-mirror/');await page.waitForFunction(()=>document.getElementById('source-tag').textContent==='Illustrated sample');
  assert.equal(await page.title(),'Draping mirror — Julie Owens');assert.equal(await page.locator('header a').getAttribute('href'),'/projects/');
  assert.equal(await page.locator('input[type=color]').count(),0);await audit(page,name+' prepare '+width);
  await page.locator('#begin').click();assert(await page.locator('#next').isDisabled());
  const original=await pixels(page);assert.deepEqual(original[0],original[1]);
  await page.locator('#show-b').click();assert.deepEqual((await pixels(page))[0],original[0],'drape swaps leave portrait pixels unchanged');
  await page.locator('#help').click();assert(await page.locator('#guidance').isVisible());await audit(page,name+' guided '+width);await page.locator('#help').click();
  await page.locator('#save-shown').click();await page.locator('#save-shown').click();
  await page.locator('#saved>summary').click();assert.equal(await page.locator('.palette-chip').count(),1);
  const pd=page.waitForEvent('download');await page.locator('#download-palette').click();const exported=JSON.parse(fs.readFileSync(await(await pd).path(),'utf8'));
  assert.equal(exported.format,'draping-mirror-palette');assert.deepEqual(Object.keys(exported).sort(),['colors','format','version']);assert.equal(exported.colors.length,1);
  const shotDownload=page.waitForEvent('download');await page.locator('#download-comparison').click();const shot=fs.readFileSync(await(await shotDownload).path());assert.equal(shot.readUInt32BE(16),1920);assert.equal(shot.readUInt32BE(20),1320);
  // Changing a reviewed early observation clears later evidence instead of
  // applying a new branch to old answers.
  await choose(page,'b');await page.locator('#show-b').click();await page.locator('[data-answer="a"]').click();await page.locator('#back').click();
  await page.locator('#show-b').click();await page.locator('[data-answer="a"]').click();await page.locator('#next').click();
  assert.equal(await page.locator('[data-answer][aria-pressed=true]').count(),0);
  await page.locator('#back').click();
  for(let i=0;i<choices.length;i++){
    if(i===6){
      await page.locator('#help').click();await page.locator('#stronger').click();assert(await page.locator('#practice-tag').isVisible());assert(await page.locator('#next').isDisabled());
      await page.locator('#show-b').click();assert(await page.locator('[data-answer="a"]').isDisabled());await page.locator('#exit-practice').click();await page.locator('#help').click();
    }
    if(i===14)assert.match(await page.locator('#finish-current').innerText(),/Metallic preview/);
    await choose(page,choices[i]);
  }
  assert.equal(await page.locator('#result-title').innerText(),'True Winter');assert.match(await page.locator('#result-kicker').innerText(),/PRACTICE RESULT/);assert.match(await page.locator('#result-description').innerText(),/not your own coloring/);
  assert.equal(await page.locator('#wardrobe button').count(),8);await page.locator('#wardrobe button').first().click();await page.locator('#save-shown').click();assert.equal(await page.locator('.palette-chip').count(),2);
  await audit(page,name+' results '+width);
  // Local decoding, transparent image backing and session reset on a new source.
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=800;const x=c.getContext('2d');x.fillStyle='#567891';x.fillRect(0,0,640,800);x.fillStyle='#B29278';x.fillRect(200,160,240,430);x.clearRect(0,600,640,200);return c.toDataURL('image/png').split(',')[1];});
  await page.locator('#photo').setInputFiles({name:'synthetic-test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>document.getElementById('source-tag').textContent.includes('Your photo'));
  assert(await page.locator('#prepare').isVisible());assert(await page.locator('#results').isHidden());
  await page.waitForFunction(()=>/No single face found|Face framing is active|Automatic framing is unavailable/.test(document.getElementById('tracking-status').textContent),null,{timeout:60000});
  await page.locator('#begin').click();const uploaded=await pixels(page);await page.locator('#show-b').click();assert.deepEqual((await pixels(page))[0],uploaded[0]);assert.deepEqual(uploaded[0],uploaded[1]);
  const storage=await page.evaluate(async()=>({local:{...localStorage},session:{...sessionStorage},databases:typeof indexedDB.databases==='function'?(await indexedDB.databases()).length:null}));
  assert.deepEqual(Object.keys(storage.local),['julieowens.draping-mirror.palette.v1']);assert(!JSON.stringify(storage).includes('data:image'));assert.deepEqual(storage.session,{});if(storage.databases!==null)assert.equal(storage.databases,0);
  const savedColors=JSON.parse(Object.values(storage.local)[0]);assert.equal(savedColors.length,2);assert(savedColors.every(color=>typeof color==='string'&&/^#[0-9A-F]{6}$/.test(color)));assert.equal(savedColors[0],exported.colors[0]);
  await openSource(page);await page.locator('#clear').click();assert.equal(await page.locator('#source-tag').innerText(),'No portrait');assert(await page.locator('#begin').isDisabled());assert(await page.locator('#download-comparison').isDisabled());assert.equal(await page.locator('.palette-chip').count(),2);
  await page.reload();await page.waitForFunction(()=>document.getElementById('source-tag').textContent==='Illustrated sample');assert.equal(await page.locator('.palette-chip').count(),2);assert(await page.locator('#prepare').isVisible());assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  console.log('PASS '+name+' guided session, evidence revision, learning mode, pixels, local images, exports, privacy and accessibility '+width);
 }finally{await context.close();}
}
async function cameraChecks(browser){
 const context=await browser.newContext();await context.addInitScript(()=>{
  window.testCamera={stops:0,requests:[]};Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async constraints=>{
   testCamera.requests.push(constraints);const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');const draw=()=>{x.fillStyle='#8A7362';x.fillRect(0,0,640,480);};draw();const timer=setInterval(draw,60);const stream=c.captureStream(15);
   for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);testCamera.stops++;stop();};}return stream;
  }});
 });const page=await context.newPage();
 try{
  await page.goto(origin+'/projects/draping-mirror/');await page.locator('#start-camera').click();await page.waitForFunction(()=>!document.getElementById('freeze').disabled);assert(await page.locator('#download-comparison').isDisabled());assert.equal(await page.evaluate(()=>testCamera.requests[0].audio),false);
  await page.locator('#begin').click();assert.match(await page.locator('#source-tag').innerText(),/camera off/);assert.equal(await page.evaluate(()=>testCamera.stops),1);assert.deepEqual(...await pixels(page));
  await openSource(page);await page.locator('#start-camera').click();await page.waitForFunction(()=>!document.getElementById('freeze').disabled);assert(await page.locator('#prepare').isVisible());await page.locator('#clear').click();assert.equal(await page.evaluate(()=>testCamera.stops),2);
  await page.locator('#start-camera').click();await page.waitForFunction(()=>!document.getElementById('freeze').disabled);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));assert.equal(await page.evaluate(()=>testCamera.stops),3);
  console.log('PASS camera freeze-before-comparison and track cleanup');
 }finally{await context.close();}
}
async function fallbackChecks(browser){
 const context=await browser.newContext();await context.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('Storage blocked');}});Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{throw new DOMException('Denied','NotAllowedError');}});});const page=await context.newPage();
 try{
  await page.goto(origin+'/projects/draping-mirror/');await page.waitForFunction(()=>!document.getElementById('begin').disabled);await page.locator('#begin').click();await page.locator('#save-shown').click();assert.match(await page.locator('#palette-status').innerText(),/unavailable/);
  for(let i=0;i<16;i++)await choose(page,'unsure');assert.equal(await page.locator('#result-title').innerText(),'Still exploring');assert.match(await page.locator('#flow-description').innerText(),/remains open/);
  await openSource(page);await page.locator('#start-camera').click();await page.waitForFunction(()=>document.getElementById('source-status').textContent.includes('not granted'));assert(await page.locator('#start-camera').isEnabled());
  console.log('PASS all-uncertain results, blocked storage and camera-denial fallback');
 }finally{await context.close();}
}
(async()=>{for(const[name,type]of[['Chromium',chromium],['WebKit',webkit]]){const browser=await type.launch();try{for(const width of[1440,390,320])await comparisonChecks(browser,name,width);await fallbackChecks(browser);if(name==='Chromium')await cameraChecks(browser);}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
