const assert = require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const axePath=require.resolve('axe-core/axe.min.js');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const origin='http://127.0.0.1:4173';
const choices=['b','a','b','a','b','a','a','b','a','a','b','both','a','b','a','b'];
async function audit(page,label){
  await page.addScriptTag({path:axePath});
  const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
  assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],label);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' fits viewport');
}
async function pixels(page,ids=['portrait-a','portrait-b']){
 // ResizeObserver paints on the next animation frame. Do not sample an old
 // setup bitmap while its CSS frame has already entered comparison mode.
 await page.waitForFunction(ids=>ids.every(id=>{
  const c=document.getElementById(id),reference=c.getClientRects().length?c:document.getElementById('portrait-a'),r=reference.getBoundingClientRect(),s=getComputedStyle(reference);
  const w=r.width-parseFloat(s.borderLeftWidth)-parseFloat(s.borderRightWidth),h=r.height-parseFloat(s.borderTopWidth)-parseFloat(s.borderBottomWidth),density=Math.min(2,4096/Math.max(w,h));
  return c.width===Math.round(w*density)&&c.height===Math.round(h*density);
 }),ids);
 const samples=await page.evaluate(ids=>ids.map(id=>{
 const canvas=document.getElementById(id),ctx=canvas.getContext('2d'),b=JSON.parse(canvas.dataset.portraitBounds);
 // Check the face and lower transparent-image backing at their actual size.
 return [[.45,.3,.12,.1],[.48,.9,.06,.03]].flatMap(([x,y,w,h])=>[...ctx.getImageData(Math.round(b.x+x*b.width),Math.round(b.y+y*b.height),Math.max(1,Math.round(w*b.width)),Math.max(1,Math.round(h*b.height))).data]);
 }),ids);
 // Hash the complete pixel samples so a failure stays readable in CI logs.
 return samples.map(data=>createHash('sha256').update(Uint8Array.from(data)).digest('hex'));
}
async function answer(page,value){if(!await page.locator('#response-sheet').isVisible())await page.locator('#decide').click();await page.locator(`[data-answer="${value}"]`).click();}
async function choose(page,value){await page.locator('#show-b').click();await answer(page,value);await page.locator('#next').click();}
async function enter(page) {
  await page.goto(origin+'/projects/draping-mirror/');
  await page.waitForFunction(()=>document.getElementById('source-tag').textContent==='Sample portrait');
  await page.locator('#start-analysis').click();
}
async function openTools(page){if(!await page.locator('#session-tools').isVisible())await page.locator(await page.locator('#question-tools').isVisible()?'#question-tools':'#open-tools').click();}
async function openSource(page){if(!await page.locator('#source-tools').isVisible()){await openTools(page);await page.locator('#change-portrait').click();}if(await page.locator('#source-tools').getAttribute('open')===null)await page.locator('#source-tools>summary').click();}
async function phoneTaskFits(page,width){
 if(width>760)return;
 const rects=await page.evaluate(()=>Object.fromEntries(['question-title','portrait-a','drape-switch','decide','focus-mirror'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}];})));
 const viewport=page.viewportSize();
 for(const[id,r]of Object.entries(rects)){assert(r.top>=-1&&r.bottom<=viewport.height+1,`${id} stays on the phone screen ${width}: ${JSON.stringify(r)}`);assert(r.left>=-1&&r.right<=width+1);}
 assert(rects['portrait-a'].height>=viewport.height*.4,'mirror stays large while its controls remain outside');

}
function separated(a,b){return a.bottom<=b.top+1||b.bottom<=a.top+1||a.right<=b.left+1||b.right<=a.left+1;}
async function protectedSurface(page,canvasId,controls){
 const data=await page.evaluate(({canvasId,controls})=>{const r=document.getElementById(canvasId).getBoundingClientRect();return {canvas:r.toJSON(),fit:getComputedStyle(document.getElementById(canvasId)).objectFit,controls:controls.map(id=>({id,rect:document.getElementById(id).getBoundingClientRect().toJSON()}))};},{canvasId,controls});
 assert.equal(data.fit,'contain','whole portrait and drape remain visible');
 for(const control of data.controls)assert(separated(data.canvas,control.rect),control.id+' stays outside the image');
}
async function edgeToEdge(page,canvasId,colored=true){
 await page.waitForFunction(id=>{
  const c=document.getElementById(id),r=c.getBoundingClientRect(),s=getComputedStyle(c),w=r.width-parseFloat(s.borderLeftWidth)-parseFloat(s.borderRightWidth),h=r.height-parseFloat(s.borderTopWidth)-parseFloat(s.borderBottomWidth);
  const density=Math.min(2,4096/Math.max(w,h));
  return c.width===Math.round(w*density)&&c.height===Math.round(h*density);
 },canvasId);
 const d=await page.locator('#'+canvasId).evaluate(c=>{
  const b=JSON.parse(c.dataset.portraitBounds),ctx=c.getContext('2d');
  const points=[.002,.5,.998].map(x=>[...ctx.getImageData(Math.min(c.width-1,Math.floor(c.width*x)),c.height-2,1,1).data]);
  return {w:c.width,h:c.height,b,points};
 });
 assert(d.b.x>=0&&d.b.y>=0&&d.b.x+d.b.width<=d.w+1&&d.b.y+d.b.height<=d.h+1,'whole proportional portrait fits the frame');
 assert(Math.abs(d.b.width/d.b.height-360/476)<.003,'portrait keeps its proportions');
 for(const p of d.points){assert.equal(p[3],255);assert(Math.max(...p.slice(0,3).map((v,i)=>Math.abs(v-d.points[1][i])))<=25,'fabric reaches both edges without gray gutters: '+JSON.stringify(d.points));}
 if(colored)assert(d.points.some(p=>Math.max(...p.slice(0,3))-Math.min(...p.slice(0,3))>30),'regression uses a colored drape, not the neutral backing');
}
async function explorerChecks(page,name,width){
 await page.locator('#browse-results').click();
 assert.equal(await page.locator('#palette-family').inputValue(),'winter');assert.equal(await page.locator('#palette-flow').inputValue(),'balanced');
 assert.equal(await page.locator('#drape-family').inputValue(),'reds');assert.equal(await page.locator('#wardrobe button').count(),12);
 await page.locator('#wardrobe button').first().click();const first=await page.locator('#explore-caption').innerText();
 assert.match(await page.locator('#explore-a').getAttribute('aria-label'),/pinned reference/);assert(await page.locator('#explore-b').isDisabled());
 await edgeToEdge(page,'portrait-explorer');
 // One tap launches related seasonal variants; the starting drape stays A.
 assert(await page.locator('#season-start').isVisible());
 const anchored=await page.locator('#explore-a').getAttribute('aria-label');
 const initial=await page.locator('#explore-caption').innerText();
 await page.locator('#season-start').click();
 assert(await page.locator('#season-cycle').isVisible());
 assert.match(await page.locator('#season-position').innerText(),/2 of 24/);
 assert.equal(await page.locator('#explore-a').getAttribute('aria-label'),anchored);
 const firstVariant=await page.locator('#explore-caption').innerText();
 assert.notEqual(firstVariant,initial);
 await page.locator('#season-next').click();await page.locator('#season-previous').click();
 assert.equal(await page.locator('#explore-caption').innerText(),firstVariant,'previous retraces the same swatch');
 await page.locator('#focus-explorer').click();await page.locator('#viewer-next').click();
 assert.match(await page.locator('#viewer-caption').innerText(),/·/);
 await page.locator('#close-viewer').click();
 await page.locator('#season-exit').click();
 assert.equal(await page.locator('#explore-caption').innerText(),initial,'exit returns to starting color');
 assert(await page.locator('#season-start').isVisible());
 const before=await pixels(page,['portrait-explorer']);
 await page.locator('#collection-picker').click();await page.locator('#palette-flow').selectOption('thermal');await page.locator('#apply-collection').click();await page.locator('#wardrobe button').nth(1).click();
 assert.match(await page.locator('#explore-caption').innerText(),/Cool Winter/);
 assert.deepEqual(await pixels(page,['portrait-explorer']),before);
 await page.locator('#explore-a').click();assert.equal(await page.locator('#explore-caption').innerText(),first,'reference survives collection changes');
 await page.locator('#explore-b').click();const candidate=await page.locator('#explore-caption').innerText();await page.locator('#pin-reference').click();
 assert.equal((await page.locator('#explore-caption').innerText()).slice(4),candidate.slice(4),'explicit pin keeps the chosen drape');assert.equal(await page.locator('#explore-a').getAttribute('aria-pressed'),'true');
 const anchor=await page.locator('#explore-a').getAttribute('aria-label');
 await page.locator('#drape-family').selectOption('blues');assert.equal(await page.locator('#wardrobe button').count(),9);await page.locator('#wardrobe button').first().click();assert.equal(await page.locator('#explore-a').getAttribute('aria-label'),anchor,'browsing never replaces A');
 await page.locator('#drape-family').selectOption('neutrals');assert.equal(await page.locator('#wardrobe button').count(),12);await page.locator('#wardrobe button').first().click();assert(await page.locator('#season-start').isHidden());
 await page.locator('#drape-family').selectOption('metals');assert.equal(await page.locator('#wardrobe button').count(),8);await page.locator('#wardrobe button').first().click();assert.match(await page.locator('#explore-caption').innerText(),/metallic preview/);assert(await page.locator('#season-start').isHidden());
 const surfaceBefore=await page.locator('#portrait-explorer').boundingBox();
 await page.locator('#explore-save').click();assert.match(await page.locator('#explore-status').innerText(),/saved/);assert.equal(await page.locator('.palette-chip').count(),2);assert.deepEqual(await page.locator('#portrait-explorer').boundingBox(),surfaceBefore,'save feedback does not resize the mirror');
 await page.locator('#explore-rest').click();assert.match(await page.locator('#explore-caption').innerText(),/Neutral cape/);await page.locator('#explore-a').click();assert.equal(await page.locator('#explore-a').getAttribute('aria-label'),anchor);
 await protectedSurface(page,'portrait-explorer',['explore-a','explore-b','pin-reference','explore-rest','explore-save','comparison-purpose','explore-status','focus-explorer']);
 await page.locator('#drape-family').selectOption('all');assert.equal(await page.locator('#wardrobe button').count(),66);
 const layout=await page.evaluate(()=>{const w=document.getElementById('wardrobe'),p=document.getElementById('portrait-explorer').getBoundingClientRect(),buttons=[...w.querySelectorAll('button')].map(b=>b.getBoundingClientRect());return{height:innerHeight,scrollHeight:w.scrollHeight,clientHeight:w.clientHeight,scrollWidth:w.scrollWidth,clientWidth:w.clientWidth,portrait:p.toJSON(),first:buttons[0].toJSON(),next:buttons[4].toJSON()};});
 if(width<=760){assert(layout.first.height>=76);assert(layout.clientHeight>=76);assert(layout.scrollWidth>layout.clientWidth);assert(layout.next.left>=layout.first.right);}
 else {assert(layout.first.height>=100);assert(layout.next.top>=layout.first.bottom);assert(layout.scrollHeight>layout.clientHeight);}
 assert(layout.portrait.top>=0&&layout.portrait.bottom<=layout.height);assert(layout.portrait.height>=layout.height*.36);
 await page.locator('#collection-picker').click();await page.locator('#palette-flow').selectOption('depth');await page.locator('.palette-adjustments summary').click();await page.locator('[data-adjust="intensity"][data-value="-1"]').click();await page.locator('#apply-collection').click();await page.locator('#wardrobe button').first().click();assert.match(await page.locator('#explore-caption').innerText(),/Deep Winter.*softer/);
 await page.locator('#focus-explorer').click();assert(await page.locator('#portrait-viewer').isVisible());await edgeToEdge(page,'portrait-viewer');await page.locator('#viewer-next').click();await audit(page,name+' expanded mirror '+width);await page.locator('#close-viewer').click();
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
 await page.locator('.framing>summary').click();await page.getByRole('button',{name:'Zoom in',exact:true}).focus();
 await page.waitForFunction(()=>{const p=document.getElementById('portrait-a').getBoundingClientRect(),s=document.querySelector('[aria-label="Zoom in"]').getBoundingClientRect();return p.top>=-1&&p.bottom<=innerHeight+1&&s.top>=p.bottom-1&&s.bottom<=innerHeight+1;},null,{timeout:3000});
 const data=await page.evaluate(()=>({height:innerHeight,preview:document.getElementById('portrait-a').getBoundingClientRect().toJSON(),slider:document.querySelector('[aria-label="Zoom in"]').getBoundingClientRect().toJSON()}));
 assert(data.preview.top>=-1&&data.preview.bottom<=data.height+1,'preview stays visible while framing');
 assert(separated(data.preview,data.slider),'framing controls do not cover the preview');assert(data.slider.top>=data.preview.bottom-1&&data.slider.bottom<=data.height+1,'focused framing control stays below the visible preview: '+JSON.stringify(data));
 await page.getByRole('button',{name:'Zoom in',exact:true}).press('Enter');await page.locator('.framing>summary').click();
}
async function comparisonChecks(browser,name,width){
 const context=await browser.newContext({viewport:{width,height:width===320?568:width===390?744:900}}),page=await context.newPage();const errors=[],unexpected=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(u.origin!==origin||r.method()!=='GET'||u.pathname.startsWith('/projects/color-lab/'))unexpected.push(r.url());});
 try{
  await enter(page);
  assert.equal(await page.title(),'DRAPER — Personal color studio');assert.equal(await page.locator('header a').getAttribute('href'),'/projects/');
  assert.equal(await page.locator('input[type=color]').count(),0);await setupOrder(page,width);await edgeToEdge(page,'portrait-a',false);await audit(page,name+' prepare '+width);
  await page.locator('#begin').click();assert(await page.locator('#next').isDisabled());await phoneTaskFits(page,width);await protectedSurface(page,'portrait-a',['drape-switch','focus-mirror','question-title','decide']);await audit(page,name+' comparing '+width);
  await edgeToEdge(page,'portrait-a');
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
    if(i===8) await page.locator('#primary-choose').click();
    if(i===8){
      await page.locator('#help').click();await page.locator('#stronger').click();assert(await page.locator('#practice-tag').isVisible());assert(await page.locator('#next').isDisabled());
      await page.locator('#show-b').click();assert(await page.locator('[data-answer="a"]').isDisabled());await page.locator('#exit-practice').click();
    }
    if(i===14)assert.match(await page.locator('#finish-current').innerText(),/Metallic preview/);
    await phoneTaskFits(page,width);await choose(page,choices[i]);
  }
  assert.equal(await page.locator('#result-title').innerText(),'True Winter');assert.match(await page.locator('#result-kicker').innerText(),/Practice result/i);assert.match(await page.locator('#result-description').innerText(),/sample portrait/);
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
  await page.reload();await page.waitForFunction(()=>document.getElementById('source-tag').textContent==='Sample portrait');assert.equal(await page.locator('.palette-chip').count(),2);assert(await page.locator('#welcome').isVisible());assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  console.log('PASS '+name+' guided session, evidence revision, learning mode, pixels, local images, exports, privacy and accessibility '+width);
 }finally{await context.close();}
}
async function reflowChecks(browser,name){
 const context=await browser.newContext({viewport:{width:256,height:440}}),page=await context.newPage();
 try{
  await enter(page);await page.locator('#begin').click();
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
  await enter(page);await page.locator('#start-camera').click();await page.waitForFunction(()=>!document.getElementById('freeze').disabled);assert(await page.locator('#download-comparison').isDisabled());assert.equal(await page.evaluate(()=>testCamera.requests[0].audio),false);await setupOrder(page,390);assert.match(await page.locator('#mirror-context').innerText(),/Live preview/);
  await page.locator('#begin').click();assert.match(await page.locator('#source-tag').innerText(),/camera off/);assert.equal(await page.evaluate(()=>testCamera.stops),1);assert.deepEqual(...await pixels(page));
  await openSource(page);await page.locator('#start-camera').click();await page.waitForFunction(()=>!document.getElementById('freeze').disabled);assert(await page.locator('#prepare').isVisible());await page.locator('#clear').click();assert.equal(await page.evaluate(()=>testCamera.stops),2);
  await page.locator('#start-camera').click();await page.waitForFunction(()=>!document.getElementById('freeze').disabled);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));assert.equal(await page.evaluate(()=>testCamera.stops),3);
  console.log('PASS camera freeze-before-comparison and track cleanup');
 }finally{await context.close();}
}
async function fallbackChecks(browser){
 const context=await browser.newContext();await context.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('Storage blocked');}});Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{throw new DOMException('Denied','NotAllowedError');}});});const page=await context.newPage();
 try{
  await enter(page);await page.locator('#begin').click();await openTools(page);await page.locator('#save-shown').click();assert(await page.locator('#mirror-note').isVisible());assert.match(await page.locator('#mirror-note').innerText(),/storage is unavailable/);await page.locator('#close-tools').click();
  for(let i=0;i<8;i++)await choose(page,'unsure');
  assert.match(await page.locator('#primary-evidence').innerText(),/leave more than one season open/);
  await page.locator('#primary-skip').click();
  for(let i=0;i<5;i++)await choose(page,'unsure');
  assert.equal(await page.locator('#result-title').innerText(),'Still exploring');
  await openSource(page);await page.locator('#start-camera').click();await page.waitForFunction(()=>document.getElementById('source-status').textContent.includes('not granted'));assert(await page.locator('#start-camera').isEnabled());
  console.log('PASS all-uncertain results, blocked storage and camera-denial fallback');
 }finally{await context.close();}
}
async function resizeChecks(browser,name){
 const context=await browser.newContext({viewport:{width:390,height:744}}),page=await context.newPage();
 try{
  await enter(page);
  await page.locator('#browse-before').click();await page.locator('#wardrobe button').first().click();
  for(const [width,height]of[[900,500],[1440,900],[320,568],[390,844]]){await page.setViewportSize({width,height});await edgeToEdge(page,'portrait-explorer');}
  await page.locator('#focus-explorer').click();
  for(const [width,height]of[[844,390],[390,844]]){await page.setViewportSize({width,height});await edgeToEdge(page,'portrait-viewer');await protectedSurface(page,'portrait-viewer',['close-viewer','viewer-next','viewer-caption']);}
  await page.locator('#close-viewer').click();await page.locator('#close-explorer').click();await page.locator('#begin').click();
  await openTools(page);await page.locator('#compare-view').click();
  for(const [width,height]of[[1440,900],[390,744],[744,390]]){await page.setViewportSize({width,height});await edgeToEdge(page,'portrait-a');await edgeToEdge(page,'portrait-b');assert.deepEqual(...await pixels(page),'paired portraits remain identical after resizing');}
  console.log('PASS '+name+' edge-to-edge setup, exploration, fullscreen, side-by-side and rotation');
 }finally{await context.close();}
}
async function v2Checks(browser,name) {
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage();
 try {
  await page.goto(origin+'/projects/draping-mirror/');
  await audit(page,name+' welcome');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Skip to main content');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
  await page.locator('#setup-assistance').press('Enter');
  await page.locator('#color-access').selectOption('blue-yellow');
  await page.locator('#large-controls').check();
  await page.locator('#paired-view').check();
  await page.locator('#assistance-next').press('Enter');
  await page.getByRole('radio',{name:/Assisted/}).check();
  await audit(page,name+' assistance');
  await page.locator('#assistance-save').press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'setup-assistance');
  assert.equal(await page.locator('html').getAttribute('data-large'),'true');
  await page.locator('#start-analysis').press('Enter');
  await page.waitForFunction(()=>!document.getElementById('begin').disabled);

  const still=(await pixels(page))[0];
  await page.locator('#preferences').press('Enter');
  await page.locator('#interface-theme').selectOption('light');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  // Audit a completed repaint after changing both the theme and backdrop.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await audit(page,name+' light theme appearance');
  assert.equal((await pixels(page))[0],still);
  const corner=()=>page.locator('#portrait-a').evaluate(canvas=>Array.from(canvas.getContext('2d').getImageData(2,2,1,1).data));
  const pale=await corner();
  await page.locator('#mirror-surround').selectOption('charcoal');
  assert.notDeepEqual(await corner(),pale);
  assert.equal((await pixels(page))[0],still);
  await page.emulateMedia({colorScheme:'dark'});
  // WebKit can apply the emulated device preference asynchronously. Confirm
  // the browser media query settled before testing DRAPER's system theme.
  await page.waitForFunction(()=>matchMedia('(prefers-color-scheme: dark)').matches);
  await page.locator('#interface-theme').selectOption('system');
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.locator('#close-appearance').press('Enter');

  await page.locator('#framing summary').press('Enter');
  await page.locator('#keyboard-frame').press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'portrait-a');
  await page.keyboard.press('+');
  await page.keyboard.press(']');
  assert.notEqual((await pixels(page))[0],still);
  const zoomed=(await pixels(page))[0];
  await page.locator('#portrait-a').scrollIntoViewIfNeeded();
  const box=await page.locator('#portrait-a').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+22,box.y+box.height/2+12,{steps:3});
  await page.mouse.up();
  assert.notEqual((await pixels(page))[0],zoomed,'dragging pans the framed portrait');
  await page.locator('#reset-frame').press('Enter');
  assert.equal((await pixels(page))[0],still);
  await page.locator('#portrait-a').scrollIntoViewIfNeeded();
  const {x,y,width,height}=await page.locator('#portrait-a').boundingBox();
  if (name==='Chromium') {
   const cdp=await context.newCDPSession(page);
   const sample=(dx,dy,id)=>({x:x+width/2+dx,y:y+height/2+dy,id});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[sample(-25,0,1),sample(25,0,2)]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[sample(-47,-18,1),sample(47,18,2)]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.notEqual((await pixels(page))[0],still,'pinch and turn changes framing on a touch viewport');
   await page.locator('#reset-frame').press('Enter');
  }
  await page.locator('#framing summary').press('Enter');
  await page.locator('#contrast-prepare').press('Enter');
  assert(await page.locator('#grayscale').isChecked());
  for(const slot of [0,1,2]) {
   await page.locator('[data-tone-slot="'+slot+'"]').press('Enter');
   await page.locator('#tone-measure').press('Enter');
  }
  assert.match(await page.locator('#tone-spread').innerText(),/percentage points/);
  const before=await page.locator('#tone-spread').innerText();
  await page.locator('#grayscale').uncheck();
  await page.locator('[data-tone-example="high"]').press('Enter');
  assert.match(await page.locator('#tone-example p').innerText(),/High/);
  assert.equal(await page.locator('#tone-spread').innerText(),before);
  await page.locator('#keep-reading').press('Enter');
  await audit(page,name+' Contrast Finder');
  await page.locator('#close-contrast').press('Enter');

  await page.locator('#begin').press('Enter');
  assert(await page.locator('#guided-cue').isVisible());
  assert(await page.locator('#face-target').isVisible());
  assert(await page.locator('#second-view').isVisible());
  assert.match(await page.locator('#color-description').innerText(),/mid-tone/);
  assert(await page.locator('#face-target').evaluate(el=>parseFloat(getComputedStyle(el).animationDuration)<.001));
  await page.locator('[data-region="eyes"]').press('Enter');
  assert.match(await page.locator('#seek-tip').innerText(),/eyelid or brow/);
  await openTools(page);await page.locator('#save-session-pair').press('Enter');await page.locator('#close-tools').press('Enter');
  for(const choice of choices.slice(0,8)) await choose(page,choice);
  assert.match(await page.locator('#primary-evidence').innerText(),/Winter/);
  assert.equal(await page.locator('#question').isVisible(),false);
  assert.equal(await page.locator('#primary-flags button i').count(),86*4);
  const winter=(await pixels(page))[0];
  await page.locator('#primary-next').press('Enter');
  assert.match(await page.locator('#primary-flag-status').innerText(),/Spring/);
  assert.equal((await pixels(page))[0],winter,'whole palettes keep the same photo');
  await page.locator('#primary-prev').press('Enter');
  await page.locator('#focus-mirror').press('Enter');
  await page.locator('#viewer-next').press('Enter');
  assert.equal(await page.locator('#viewer-caption').innerText(),'Spring');
  await page.locator('#viewer-previous').press('Enter');
  await page.locator('#close-viewer').press('Enter');
  await audit(page,name+' primary seasons');
  await page.locator('#primary-choose').press('Enter');
  for (const choice of choices.slice(8)) await choose(page,choice);
  assert.equal(await page.locator('#result-title').innerText(),'True Winter');
  assert.match(await page.locator('#report-details').innerText(),/Lipstick[\s\S]+Makeup palette[\s\S]+Measured from the photo[\s\S]+Saved comparisons/);
  await page.locator('#session-notes').fill('Recheck in window light.');
  await page.evaluate(()=>{ window.print=()=>{window.printCalled=true;}; });
  await page.locator('#report-pdf').press('Enter');
  assert(await page.evaluate(()=>window.printCalled));
  assert.match(await page.locator('#print-report').textContent(),/Recheck in window light/);
  if(name==='Chromium'){
   const pdf=await page.pdf({format:'A4',printBackground:true,tagged:true});
   assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  }
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  const pngEvent=page.waitForEvent('download');await page.locator('#report-png').press('Enter');
  const png=fs.readFileSync(await(await pngEvent).path());
  assert.equal(png.readUInt32BE(16),1200);
  const jsonEvent=page.waitForEvent('download');await page.locator('#report-json').press('Enter');
  const json=fs.readFileSync(await(await jsonEvent).path()), data=JSON.parse(json);
  assert.equal(data.practice,true);assert.equal(data.primary,'winter');assert.equal(data.comparisons.length,1);
  assert.equal(data.contrast.length,3);assert.equal(data.notes,'Recheck in window light.');
  assert(!json.includes('data:image')&&!Object.hasOwn(data,'portrait'));
  await page.locator('#home').press('Enter');
  await page.locator('#analysis-input').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":0}')});
  await page.waitForFunction(()=>document.getElementById('import-status').textContent.includes('Choose a DRAPER analysis'));
  await page.locator('#analysis-input').setInputFiles({name:'draper-analysis.json',mimeType:'application/json',buffer:json});
  await page.waitForFunction(()=>document.getElementById('result-title').textContent==='True Winter');
  assert(await page.locator('#resume-analysis').isVisible());
  assert.equal(await page.locator('#session-notes').inputValue(),data.notes);
  assert(await page.getByRole('button',{name:/Review this pair/}).isVisible());
  await page.locator('#resume-analysis').press('Enter');
  await page.waitForFunction(()=>!document.getElementById('begin').disabled);
  await page.locator('#begin').press('Enter');
  assert.equal(await page.locator('#result-title').innerText(),'True Winter');
  await audit(page,name+' imported results');
  console.log('PASS '+name+' keyboard and assisted comparisons, reduced motion, framing, themes, flags, tonal samples, and report export/import');
 } finally { await context.close(); }
}

async function bridgeChecks(browser,name) {
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(origin+'/')) requests.push(r.url());});
 const outside=()=>page.locator('#portrait-explorer').evaluate(canvas=>{
   const ctx=canvas.getContext('2d');
   return [[2,2],[canvas.width-3,2],[2,canvas.height-3],[canvas.width-3,canvas.height-3]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));
 });
 try {
  await enter(page);await page.locator('#browse-before').click();
  await page.locator('#wardrobe button').first().click();
  const base=await outside();assert(base.every(p=>JSON.stringify(p)===JSON.stringify(base[0])),'single drape fills every corner');
  await page.locator('#focus-explorer').click();
  const wide=await page.locator('#portrait-viewer').evaluate(c=>{
   const ctx=c.getContext('2d');return[...ctx.getImageData(2,2,1,1).data];
  });
  assert.deepEqual(wide,base[0]);await page.locator('#close-viewer').click();
  const pinned=await page.locator('#explore-a').getAttribute('aria-label');
  for(const family of ['light-neutral','soft-neutral','bright-neutral','deep-neutral']) {
   await page.locator('#collection-picker').press('Enter');
   await page.locator('#palette-family').selectOption(family);
   assert(await page.locator('#flow-field').isHidden());
   assert.equal(await page.locator('.palette-adjustments').getAttribute('open'),null);
   assert(await page.locator('#bridge-note').isVisible());
   await audit(page,name+' '+family+' chooser');
   await page.locator('#apply-collection').press('Enter');
   await page.locator('#drape-family').selectOption('all');assert.equal(await page.locator('#wardrobe button').count(),66);
   await page.locator('#wardrobe button').first().click();
   assert.equal(await page.locator('#explore-a').getAttribute('aria-label'),pinned);
   const candidate = await pixels(page,['portrait-explorer']);
   await page.locator('#explore-a').press('Enter');
   assert.deepEqual(await pixels(page,['portrait-explorer']),candidate,'pinned original and bridge share portrait pixels in the same responsive frame');
   await page.locator('#explore-b').press('Enter');
   const surface=await outside();assert(surface.every(p=>JSON.stringify(p)===JSON.stringify(surface[0])));
   for(const [group,count] of [['neutrals',12],['metals',8]]){
    await page.locator('#drape-family').selectOption(group);assert.equal(await page.locator('#wardrobe button').count(),count);
   }
  }
  await page.locator('#drape-family').selectOption('all');await page.locator('#wardrobe button').first().click();
  const initial=await page.locator('#explore-caption').innerText();
  await page.locator('#season-start').press('Enter');assert.match(await page.locator('#season-position').innerText(),/Deep Autumn.*2 of 24/);
  await page.locator('#season-previous').press('Enter');assert.equal((await page.locator('#explore-caption').innerText()).slice(4),initial.slice(4));
  await page.locator('#season-exit').press('Enter');
  await page.locator('#explore-save').press('Enter');
  await page.locator('#wardrobe button').nth(1).click();await page.locator('#save-explore-pair').press('Enter');
  await page.locator('#flags-explorer').press('Enter');
  assert.equal(await page.locator('#flag-range').inputValue(),'bridges');
  assert.equal(await page.locator('#flag-options button').count(),4);
  assert.match(await page.locator('#flag-status').innerText(),/Deep Neutral/);
  const flagCorners=await page.locator('#portrait-flags').evaluate(c=>{const x=c.getContext('2d');return[...x.getImageData(2,2,1,1).data];});
  assert(flagCorners[0]!==flagCorners[1]||flagCorners[1]!==flagCorners[2],'flag reaches the top edge');
  await page.locator('#flag-range').selectOption('primary');
  assert.equal(await page.locator('#flag-options button').count(),4);
  await page.locator('#flag-range').selectOption('bridges');
  await audit(page,name+' bridge flags');
  await page.locator('#try-flag').press('Enter');
  await page.locator('#close-explorer').press('Enter');
  await page.locator('#preferences').press('Enter');
  assert.equal(await page.locator('#mirror-surround').inputValue(),'drape');
  await page.locator('#mirror-surround').selectOption('middle');
  await page.locator('#close-appearance').press('Enter');
  await page.locator('#browse-before').press('Enter');
  const neutral=await outside();assert(neutral.every(p=>JSON.stringify(p)===JSON.stringify([150,150,150,255])),'neutral option fills the whole background');
  await page.locator('#close-explorer').press('Enter');
  await page.locator('#open-tools').press('Enter');
  const downloaded=page.waitForEvent('download');await page.locator('#download-analysis-tools').press('Enter');
  const json=fs.readFileSync(await(await downloaded).path());
  const data=JSON.parse(json);assert.equal(data.primary,null);assert.equal(data.collection.family,'deep-neutral');
  assert.equal(data.comparisons.length,1);assert(!json.includes('data:image'));
  await page.locator('#close-tools').press('Enter');
  await page.locator('#analysis-input').setInputFiles({name:'analysis.json',mimeType:'application/json',buffer:json});
  await page.waitForFunction(()=>!document.getElementById('results').hidden);
  assert.equal(await page.locator('#result-title').innerText(),'Still exploring');
  assert.match(await page.locator('#report-details').innerText(),/Palette explored.*Deep Neutral/s);
  assert.match(await page.locator('#report-details').innerText(),/Deep Neutral.*Palette explored/s);
  await page.evaluate(()=>{window.print=()=>{};});await page.locator('#report-pdf').press('Enter');
  assert.match(await page.locator('#print-report').innerText(),/Palette explored.*Deep Neutral/s);
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  await page.locator('#browse-results').press('Enter');
  assert.equal(await page.locator('#palette-family').inputValue(),'deep-neutral');
  await page.locator('#close-explorer').press('Enter');
  await audit(page,name+' bridge result');assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('PASS '+name+' full mirror fill, neutral bridge palettes, original pins, flag navigation, and portable results');
 } finally {await context.close();}
}

(async()=>{for(const[name,type]of[['Chromium',chromium],['WebKit',webkit]]){const browser=await type.launch();try{for(const width of[1440,390,320])await comparisonChecks(browser,name,width);await resizeChecks(browser,name);await fallbackChecks(browser);await reflowChecks(browser,name);await v2Checks(browser,name);await bridgeChecks(browser,name);if(name==='Chromium')await cameraChecks(browser);}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
