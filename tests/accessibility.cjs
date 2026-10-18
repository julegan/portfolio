"use strict";
const assert=require("node:assert/strict");
const { chromium }=require("playwright");
const axePath=require.resolve("axe-core/axe.min.js");
const isPortfolio=process.env.SHOWS_PORTFOLIO==="1";
const origin="http://127.0.0.1:4173";
const standards=["wcag2a","wcag2aa","wcag21a","wcag21aa"];
async function audit(page,label){
  await page.addScriptTag({path:axePath});
  const results=await page.evaluate(tags=>window.axe.run(document,{
    runOnly:{type:"tag",values:tags},
    rules:{"color-contrast":{enabled:true}}
  }),standards);
  const violations=results.violations.map(v=>({
    id:v.id,impact:v.impact,help:v.help,where:v.nodes.map(n=>n.target.join(" ")).slice(0,12)
  }));
  console.log(JSON.stringify({view:label,violations,passes:results.passes.length}));
  return violations.map(v=>({view:label,...v}));
}
async function assertFavicon(page,label){
  const href=await page.locator('link[rel="icon"]').getAttribute("href");
  assert(href, label+" must declare a favicon");
  const result=await page.evaluate(async url=>{
    const response=await fetch(url,{cache:"no-store"});
    return {ok:response.ok,status:response.status,text:await response.text()};
  },new URL(href,page.url()).href);
  assert(result.ok&&result.text.includes("<svg"),label+" favicon resource must load as an SVG");
}
async function showsViews(browser,viewport){
  const page=await browser.newPage({viewport});
  const errors=[];
  await page.goto(origin+(isPortfolio?"/projects/shows/":"/"),{waitUntil:"networkidle"});
  errors.push(...await audit(page,"SHOWS month "+viewport.width));
  if(isPortfolio)await assertFavicon(page,"SHOWS");
  await page.locator('[data-view="agenda"]').click();
  errors.push(...await audit(page,"SHOWS list "+viewport.width));
  const event=page.locator("button.event-card").first();
  if(await event.count()){
    const artwork=event.locator(".show-art");
    const dimensions=await artwork.boundingBox();
    assert(dimensions?.width>100&&dimensions?.height>35,"SHOWS event thumbnails must be rendered visibly in List view");
    assert.equal(await artwork.locator(".show-art-title").textContent(),await event.locator("h3").textContent(),"Thumbnail should identify the same event as the card");
  }
  if(await event.count()){
    await event.click();
    assert(await page.locator("#eventDialog").evaluate(el=>el.open),"Event detail dialog must open");
    assert(await page.locator("#eventDialog .show-art--large").isVisible(),"SHOWS detail dialog thumbnail should be visible");
    errors.push(...await audit(page,"SHOWS event detail "+viewport.width));
    await page.locator("[data-close]").click();
  } else console.log("No events in displayed month; event dialog scan skipped");
  await page.locator('[data-view="places"]').click();
  errors.push(...await audit(page,"SHOWS places "+viewport.width));
  await page.close();
  return errors;
}
async function main(){
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const issues=[];
 try{
  if(isPortfolio){
   for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    await page.goto(origin+"/",{waitUntil:"networkidle"});
    issues.push(...await audit(page,"Portfolio home "+viewport.width));
    await assertFavicon(page,"Portfolio home");
    await page.goto(origin+"/projects/",{waitUntil:"networkidle"});
    issues.push(...await audit(page,"Portfolio projects "+viewport.width));
    await assertFavicon(page,"Projects");
    await page.close();
   }
  }
  for(const viewport of [{width:1440,height:900},{width:390,height:844}])issues.push(...await showsViews(browser,viewport));
 }finally{await browser.close();}
 if(issues.length){
  console.error("WCAG 2.1 AA automated scan: "+issues.length+" violation types across states.");
  process.exitCode=1;
 }else console.log("WCAG 2.1 AA automated scan passed in all tested pages and states.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
