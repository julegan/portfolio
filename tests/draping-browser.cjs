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
async function answer(page,value){if(!await page.locator('#response-sheet').isVisible())await page.locator('#decide').click();await page.locator(`[data-answer="${value}"]`).click();}
async function choose(page,value){await page.locator('#show-b').click();await answer(page,value);await page.locator('#next').click();}
async function openTools(page){if(!await page.locator('#session-tools').isVisible())await page.locator(await page.locator('#question-tools').isVisible()?'#question-tools':'#open-tools').click();}
async function openSource(page){if(!await page.locator('#source-tools').isVisible()){await openTools(page);await page.locator('#change-portrait').click();}if(await page.locator('#source-tools').getAttribute('open')===null)await page.locator('#source-tools>summary').click();}
async function phoneTaskFits(page,width){
 if(width>760)return;
 const rects=await page.evaluate(()=>Object.fromEntries(['question-title','portrait-a','drape-switch','decide','focus-mirror'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}];})));
 const viewport=page.viewportSize();
 for(const[id,r]of Object.entries(rects)){assert(r.top>=-1&&r.bottom<=viewport.height+1,`${id} stays on the phone screen ${width}: ${JSON.stringify(r)}`);assert(r.left>=-1&&r.right<=width+1);}
 assert(rects['portrait-a'].height>=viewport.height*.4,'mirror stays large while its controls remain outside');
 assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'comparison needs no vertical page scrolling');
}
function separated(a,b){return a.bottom<=b.top+1||b.bottom<=a.top+1||a.right<=b.left+1||b.right<=a.left+1;}
async function protectedSurface(page,canvasId,controls){
 const data=await page.evaluate(({canvasId,controls})=>{const r=document.getElementById(canvasId).getBoundingClientRect();return {canvas:r.toJSON(),fit:getComputedStyle(document.getElementById(canvasId)).objectFit,controls:controls.map(id=>({id,rect:document.getElementById(id).getBoundingClientRect().toJSON()}))};},{canvasId,controls});
 assert.equal(data.fit,'contain','whole portrait and drape remain visible');
 for(const control of data.controls)assert(separated(data.canvas,control.rect),control.id+' stays outside the image');
}
async function explorerChecks(page,name,width){
 await page.locator('#browse-results').click();
 assert.equal(await page.locator('#palette-family').inputValue(),'winter');assert.equal(await page.locator('#palette-flow').inputValue(),'balanced');
 assert.equal(await page.locator('#drape-family').inputValue(),'reds');assert.equal(await page.locator('#wardrobe button').count(),12);
 await page.locator('#wardrobe button').first().click();const first=await page.locator('#explore-caption').innerText();
 assert.match(await page.locator('#explore-a').getAttribute('aria-label'),/pinned reference/);assert(await page.locator('#explore-b').isDisabled());
 const before=await page.locator('#portrait-explorer').evaluate(c=>[...c.getContext('2d').getImageData(400,300,100,100).data]);
 await page.locator('#collection-picker').click();await page.locator('#palette-flow').selectOption('thermal');await page.locator('#apply-collection').click();await page.locator('#wardrobe button').nth(1).click();
 assert.match(await page.locator('#explore-caption').innerText(),/Cool Winter/);
 assert.deepEqual(await page.locator('#portrait-explorer').evaluate(c=>[...c.getContext('2d').getImageData(400,300,100,100).data]),before);
 await page.locator('#explore-a').click();assert.equal(await page.locator('#explore-caption').innerText(),first,'reference survives collection changes');
 await page.locator('#explore-b').click();const candidate=await page.locator('#explore-caption').innerText();await page.locator('#pin-reference').click();
 assert.equal((await page.locator('#explore-caption').innerText()).slice(4),candidate.slice(4),'explicit pin keeps the chosen drape');assert.equal(await page.locator('#explore-a').getAttribute('aria-pressed'),'true');
 const anchor=await page.locator('#explore-a').getAttribute('aria-label');
 await page.locator('#drape-family').selectOption('blues');assert.equal(await page.locator('#wardrobe button').count(),9);await page.locator('#wardrobe button').first().click();assert.equal(await page.locator('#explore-a').getAttribute('aria-label'),anchor,'browsing never replaces A');
 await page.locator('#drape-family').selectOption('neutrals');assert.equal(await page.locator('#wardrobe button').count(),12);await page.locator('#wardrobe button').first().click();
 await page.locator('#drape-family').selectOption('metals');assert.equal(await page.locator('#wardrobe button').count(),8);await page.locator('#wardrobe button').first().click();assert.match(await page.locator('#explore-caption').innerText(),/metallic preview/);
 const surfaceBefore=await page.locator('#portrait-explorer').boundingBox();
 await page.locator('#explore-save').click();assert.match(await page.locator('#explore-status').innerText(),/saved/);assert.equal(await page.locator('.palette-chip').count(),2);assert.deepEqual(await page.locator('#portrait-explorer').boundingBox(),surfaceBefore,'save feedback does not resize the mirror');
 await page.locator('#explore-rest').click();assert.match(await page.locator('#explore-caption').innerText(),/Neutral cape/);await page.locator('#explore-a').click();assert.equal(await page.locator('#explore-a').getAttribute('aria-label'),anchor);
 await protectedSurface(page,'portrait-explorer',['explore-a','explore-b','pin-reference','explore-rest','explore-save','comparison-purpose','explore-status','focus-explorer']);
 await page.locator('#drape-family').selectOption('all');assert.equal(await page.locator('#wardrobe button').count(),66);
 const layout=await page.evaluate(()=>{const w=document.getElementById('wardrobe'),p=document.getElementById('portrait-explorer').getBoundingClientRect(),buttons=[...w.querySelectorAll('button')].map(b=>b.getBoundingClientRect());return{height:innerHeight,scrollHeight:w.scrollHeight,clientHeight:w.clientHeight,scrollWidth:w.scrollWidth,clientWidth:w.clientWidth,portrait:p.toJSON(),first:buttons[0].toJSON(),next:buttons[4].toJSON()};});
 if(width<=760){assert(layout.first.height>=76);assert(layout.clientHeight>=76);assert(layout.scrollWidth>layout.clientWidth);assert(layout.next.left>=layout.first.right);}
 else {assert(layout.first.height>=100);assert(layout.next.top>=layout.first.bottom);assert(layout.scrollHeight>layout.clientHeight);}
 assert(layout.portrait.top>=0&&layout.portrait.bottom<=layout.height);assert(layout.portrait.height>=layout.height*.4);
 await page.locator('#collection-picker').click();await page.locator('#palette-flow').selectOption('depth');await page.locator('[data-adjust="intensity"][data-value="-1"]').click();await page.locator('#apply-collection').click();await page.locator('#wardrobe button').first().click();assert.match(await page.locator('#explore-caption').innerText(),/Deep Winter.*softer/);
 await page.locator('#focus-explorer').click();assert(await page.locator('#portrait-viewer').isVisible());await page.locator('#viewer-next').click();await audit(page,name+' expanded mirror '+width);await page.locator('#close-viewer').click();
 await page.locator('#wardrobe button').last().focus();await audit(page,name+' explorer '+width);
 await page.locator('#close-explorer').click();assert.equal(await page.locator('#result-title').innerText(),'True Winter','browsing does not reclassify');
}
async function setupOrder(page,width){
 if(width>760)return;
 const data=await page.evaluate(()=>{const c=document.getElementById('portrait-a').getBoundingClientRect(),s=document.getElementById('source-tools').getBoundingClientRect(),camera=document.getElementById('start-camera').getBoundingClientRect(),photo=document.getElementById('photo').getBoundingClientRect();return{height:innerHeight,c:c.toJSON(),s:s.toJSON(),camera:camera.toJSON(),photo:photo.toJSON()};});
 assert(data.c.top>=0&&data.c.bottom<=data.height,'setup preview is on screen');
 assert(data.c.bottom<=data.s.top+1,'mirror precedes camera/photo options');
 assert(data.camera.bottom<=data.height+1&&data.photo.bottom<=data.height+1,'primary capture choices share the screen with preview');
}
async function framingKeepsPreview(page,width){
 if(width>760)return;
 await page.locator('.framing>summary').click();await page.locator('#frame-scale').focus();
 const data=await page.evaluate(()=>({height:innerHeight,preview:document.getElementById('portrait-a').getBoundingClientRect().toJSON(),slider:document.getElementById('frame-scale').getBoundingClientRect().toJSON()}));
 assert(data.preview.top>=-1&&data.preview.bottom<=data.height+1,'preview stays visible while framing');
 assert(separated(data.preview,data.slider),'framing controls do not cover the preview');assert(data.slider.top>=data.preview.bottom-1&&data.slider.bottom<=data.height+1,'focused framing control stays below the visible preview');
 await page.locator('#frame-scale').press('ArrowRight');await page.locator('.framing>summary').click();
}
async function comparisonChecks(browser,name,width){
 const context=await browser.newContext({viewport:{width,height:width===320?568:width===390?744:900}}),page=await context.newPage();const errors=[],unexpected=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(u.origin!==origin||r.method()!=='GET'||u.pathname.startsWith('/projects/color-lab/'))unexpected.push(r.url());});
 try{
  await page.goto(origin+'/projects/draping-mirror/');await page.waitForFunction(()=>document.getElementById('source-tag').textContent==='Illustrated sample');
  assert.equal(await page.title(),'Draping mirror — Julie Owens');assert.equal(await page.locator('header a').getAttribute('href'),'/projects/');
  assert.equal(await page.locator('input[type=color]').count(),0);await setupOrder(page,width);await audit(page,name+' prepare '+width);
  await page.locator('#begin').click();assert(await page.locator('#next').isDisabled());await phoneTaskFits(page,width);await protectedSurface(page,'portrait-a',['drape-switch','focus-mirror','question-title','decide']);await audit(page,name+' comparing '+width);
  const original=await pixels(page);assert.deepEqual(original[0],original[1]);
  await page.locator('#show-b').click();assert.deepEqual((await pixels(page))[0],original[0],'drape swaps leave portrait pixels unchanged');
  await page.locator('#help').click();assert(await page.locator('#guidance').isVisible());await audit(page,name+' guided '+width);await page.locator('#close-help').click();
  await openTools(page);
  await page.locator('#save-shown').click();await page.locator('#save-shown').click();
  await page.locator('#saved>summary').click();assert.equal(await page.locator('.palette-chip').count(),1);
  const pd=page.waitForEvent('download');await page.locator('#download-palette').click();const exported=JSON.parse(fs.readFileSync(await(await pd).path(),'utf8'));
  assert.equal(exported.format,'draping-mirror-palette');assert.deepEqual(Object.keys(exported).sort(),['colors','format','version']);assert.equal(exported.colors.length,1);
  const shotDownload=page.waitForEvent('download');await page.locator('#download-comparison').click();const shot=fs.readFileSync(await(await shotDownload).path());assert.equal(shot.readUInt32BE(16),1920);assert.equal(shot.readUInt32BE(20),1320);await page.locator('#close-tools').click();
  // Changing a reviewed early observation clears later evidence instead of
  // applying a new branch to old answers.
  await choose(page,'b');await page.locator('#show-b').click();await answer(page,'a');await page.locator('#close-response').click();await page.locator('#back').click();
  await page.locator('#show-b').click();await answer(page,'a');await page.locator('#next').click();
  assert.equal(await page.locator('[data-answer][aria-pressed=true]').count(),0);
  await page.locator('#back').click();
  for(let i=0;i<choices.length;i++){
    if(i===6){
      await page.locator('#help').click();await page.locator('#stronger').click();assert(await page.locator('#practice-tag').isVisible());assert(await page.locator('#next').isDisabled());
      await page.locator('#show-b').click();assert(await page.locator('[data-answer="a"]').isDisabled());await page.locator('#exit-practice').click();
    }
    if(i===14)assert.match(await page.locator('#finish-current').innerText(),/Metallic preview/);
    await phoneTaskFits(page,width);await choose(page,choices[i]);
  }
  assert.equal(await page.locator('#result-title').innerText(),'True Winter');assert.match(await page.locator('#result-kicker').innerText(),/PRACTICE RESULT/);assert.match(await page.locator('#result-description').innerText(),/not your own coloring/);
  await explorerChecks(page,name,width);
  await audit(page,name+' results '+width);
  // Local decoding, transparent image backing and session reset on a new source.
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=800;const x=c.getContext('2d');x.fillStyle='#567891';x.fillRect(0,0,640,800);x.fillStyle='#B29278';x.fillRect(200,160,240,430);x.clearRect(0,600,640,200);return c.toDataURL('image/png').split(',')[1];});
  await openSource(page);await page.locator('#photo').setInputFiles({name:'synthetic-test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>document.getElementById('source-tag').textContent.includes('Your photo'));
  assert(await page.locator('#prepare').isVisible());assert(await page.locator('#results').isHidden());
  await page.waitForFunction(()=>/No single face found|Face framing is active|Automatic framing is unavailable/.test(document.getElementById('tracking-status').textContent),null,{timeout:60000});
  await framingKeepsPreview(page,width);await page.locator('#begin').click();const uploaded=await pixels(page);await page.locator('#show-b').click();assert.deepEqual((await pixels(page))[0],uploaded[0]);assert.deepEqual(uploaded[0],uploaded[1]);
  const storage=await page.evaluate(async()=>({local:{...localStorage},session:{...sessionStorage},databases:typeof indexedDB.databases==='function'?(await indexedDB.databases()).length:null}));
  assert.deepEqual(Object.keys(storage.local),['julieowens.draping-mirror.palette.v1']);assert(!JSON.stringify(storage).includes('data:image'));assert.deepEqual(storage.session,{});if(storage.databases!==null)assert.equal(storage.databases,0);
  const savedColors=JSON.parse(Object.values(storage.local)[0]);assert.equal(savedColors.length,2);assert(savedColors.every(color=>typeof color==='string'&&/^#[0-9A-F]{6}$/.test(color)));assert.equal(savedColors[0],exported.colors[0]);
  await openSource(page);await page.locator('#clear').click();assert.equal(await page.locator('#source-tag').innerText(),'No portrait');assert(await page.locator('#begin').isDisabled());assert(await page.locator('#download-comparison').isDisabled());assert.equal(await page.locator('.palette-chip').count(),2);
  await page.reload();await page.waitForFunction(()=>document.getElementById('source-tag').textContent==='Illustrated sample');assert.equal(await page.locator('.palette-chip').count(),2);assert(await page.locator('#prepare').isVisible());assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  console.log('PASS '+name+' guided session, evidence revision, learning mode, pixels, local images, exports, privacy and accessibility '+width);
 }finally{await context.close();}
}
async function reflowChecks(browser,name){
 const context=await browser.newContext({viewport:{width:256,height:440}}),page=await context.newPage();
 try{
  await page.goto(origin+'/projects/draping-mirror/');await page.waitForFunction(()=>!document.getElementById('begin').disabled);await page.locator('#begin').click();
  await page.locator('#show-b').click();await answer(page,'unsure');await page.locator('#next').click();await audit(page,name+' short/zoomed comparison');
  await openSource(page);await page.locator('#browse-before').click();await page.locator('#drape-family').selectOption('all');await page.locator('#wardrobe button').last().click();
  assert.match(await page.locator('#explore-caption').innerText(),/Mint cream/);await audit(page,name+' short/zoomed explorer');
  assert(await page.evaluate(()=>{const d=document.getElementById('palette-explorer');return d.clientHeight<=innerHeight&&d.scrollHeight>d.clientHeight;}),'short or zoomed explorer can scroll instead of clipping');
  await page.locator('#close-explorer').click();assert(await page.locator('#prepare').isVisible());
  console.log('PASS '+name+' short/zoomed view reflows without trapping controls');
 }finally{await context.close();}
}
async function cameraChecks(browser){
 const context=await browser.newContext({viewport:{width:390,height:744}});await context.addInitScript(()=>{
  window.testCamera={stops:0,requests:[]};Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async constraints=>{
   testCamera.requests.push(constraints);const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');const draw=()=>{x.fillStyle='#8A7362';x.fillRect(0,0,640,480);};draw();const timer=setInterval(draw,60);const stream=c.captureStream(15);
   for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);testCamera.stops++;stop();};}return stream;
  }});
 });const page=await context.newPage();
 try{
  await page.goto(origin+'/projects/draping-mirror/');await page.locator('#start-camera').click();await page.waitForFunction(()=>!document.getElementById('freeze').disabled);assert(await page.locator('#download-comparison').isDisabled());assert.equal(await page.evaluate(()=>testCamera.requests[0].audio),false);await setupOrder(page,390);assert.match(await page.locator('#mirror-context').innerText(),/Live preview/);
  await page.locator('#begin').click();assert.match(await page.locator('#source-tag').innerText(),/camera off/);assert.equal(await page.evaluate(()=>testCamera.stops),1);assert.deepEqual(...await pixels(page));
  await openSource(page);await page.locator('#start-camera').click();await page.waitForFunction(()=>!document.getElementById('freeze').disabled);assert(await page.locator('#prepare').isVisible());await page.locator('#clear').click();assert.equal(await page.evaluate(()=>testCamera.stops),2);
  await page.locator('#start-camera').click();await page.waitForFunction(()=>!document.getElementById('freeze').disabled);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));assert.equal(await page.evaluate(()=>testCamera.stops),3);
  console.log('PASS camera freeze-before-comparison and track cleanup');
 }finally{await context.close();}
}
async function fallbackChecks(browser){
 const context=await browser.newContext();await context.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('Storage blocked');}});Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{throw new DOMException('Denied','NotAllowedError');}});});const page=await context.newPage();
 try{
  await page.goto(origin+'/projects/draping-mirror/');await page.waitForFunction(()=>!document.getElementById('begin').disabled);await page.locator('#begin').click();await openTools(page);await page.locator('#save-shown').click();assert(await page.locator('#mirror-note').isVisible());assert.match(await page.locator('#mirror-note').innerText(),/storage is unavailable/);await page.locator('#close-tools').click();
  for(let i=0;i<16;i++)await choose(page,'unsure');assert.equal(await page.locator('#result-title').innerText(),'Still exploring');assert.match(await page.locator('#flow-description').innerText(),/remains open/);
  await openSource(page);await page.locator('#start-camera').click();await page.waitForFunction(()=>document.getElementById('source-status').textContent.includes('not granted'));assert(await page.locator('#start-camera').isEnabled());
  console.log('PASS all-uncertain results, blocked storage and camera-denial fallback');
 }finally{await context.close();}
}
(async()=>{for(const[name,type]of[['Chromium',chromium],['WebKit',webkit]]){const browser=await type.launch();try{for(const width of[1440,390,320])await comparisonChecks(browser,name,width);await fallbackChecks(browser);await reflowChecks(browser,name);if(name==='Chromium')await cameraChecks(browser);}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
