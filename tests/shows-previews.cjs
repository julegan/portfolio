"use strict";
const assert = require("node:assert/strict");
const {chromium} = require("playwright");
const axePath = require.resolve("axe-core/axe.min.js");
const origin = "http://127.0.0.1:4173";
function portlandToday() {
  const parts = new Intl.DateTimeFormat("en-US", {timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get = k => parts.find(p=>p.type===k).value;
  return get("year")+"-"+get("month")+"-"+get("day");
}
async function audit(page,label) {
  await page.addScriptTag({path:axePath});
  const result = await page.evaluate(() => window.axe.run(document, {
    runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}
  }));
  const issues = result.violations.map(v=>v.id+" "+v.nodes.map(n=>n.target.join(" ")).join(", "));
  assert.deepEqual(issues,[],label+" WCAG checks");
}
async function test(browser,variant,width) {
  const page = await browser.newPage({viewport:{width,height:844}});
  const errors = [];
  page.on("pageerror",e=>errors.push(e.message));
  const base = origin+"/projects/shows/preview-"+variant+"/";
  const response = await page.goto(base,{waitUntil:"domcontentloaded"});
  assert.equal(response.status(),200,"Preview route must load");
  await page.locator("#summary").waitFor({state:"visible"});
  assert.equal(await page.locator("#fromDate").inputValue(),portlandToday(),"Starts on today's Portland date");
  assert.match(await page.locator("#summary").innerText(),/from \d{4}-\d{2}-\d{2} onward/);
  assert(!(await page.locator("#results").innerText()).includes("Lents Farmers Market"),"Recurring farmers markets should not crowd results");
  if(variant==="b"){
    assert.equal(await page.locator('[data-section="Music"]').getAttribute("aria-pressed"),"true");
    const labels = await page.locator(".preview-event .preview-eyebrow").allInnerTexts();
    assert(labels.every(t=>t.trim().toLowerCase().startsWith("music")),"Music-first preview should only show music initially");
    await page.locator('[data-section="Culture"]').click();
    assert.equal(await page.locator('[data-section="Culture"]').getAttribute("aria-pressed"),"true");
    await audit(page,"Preview B culture "+width);
    await page.locator('[data-section="Music"]').click();
  }
  await audit(page,"Preview "+variant+" dates "+width);
  const first=page.locator(".preview-event").first();
  if(await first.count()){
    await first.click();
    assert(await page.locator("#eventDialog").evaluate(el=>el.open),"Event details open");
    assert(await page.locator("#eventDialog .detail-actions a").count()>0,"Calendar and event actions exist");
    await audit(page,"Preview "+variant+" event "+width);
    await page.locator("[data-close]").click();
  }
  await page.locator('[data-view="places"]').click();
  assert.equal(await page.locator('[data-view="places"]').getAttribute("aria-pressed"),"true");
  await audit(page,"Preview "+variant+" places "+width);
  await page.locator('[data-view="dates"]').click();
  await page.locator("#search").fill("never--a--real--event--title--9876543");
  assert.match(await page.locator("#results").innerText(),/No listings found/,"Search empty state is informative");
  await page.locator("#clearFilters").click();
  assert.equal(await page.locator("#search").inputValue(),"");
  const overflow = await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1);
  assert(!overflow,"Preview should fit horizontally on "+width+"px");
  assert.deepEqual(errors,[],"No uncaught browser errors");
  console.log("PASS preview "+variant+" width="+width);
  await page.close();
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
    for(const variant of ["a","b"])for(const width of [390,1440])await test(browser,variant,width);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
