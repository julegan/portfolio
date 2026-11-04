"use strict";
/* Regression: all approved future source events should be discoverable even
   when the organizer supplies non-Music categories or no verified genre. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
(async()=>{
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try {
    const page=await browser.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    const response=await page.goto("http://127.0.0.1:4173/projects/shows/",{waitUntil:"domcontentloaded"});
    assert.equal(response.status(),200);
    const from="2026-11-03";
    const data=await page.evaluate(from=>{
      const all=window.SHOWS_EVENTS||[];
      const future=all.filter(e=>e.startsAt.slice(0,10)>=from);
      const excluded=e=>/^(?:closed|closure|venue closed|no events?)\\b/i.test(String(e.title||"").trim()) ||
        (e.category==="Markets"&&/farmers? markets?|produce market|farm stand/.test([e.title,e.subtitle,...(e.tags||[])].join(" ").toLowerCase()));
      return {
        total:all.length, future:future.length, eligible:future.filter(e=>!excluded(e)).length,
        categoryExamples:["Other","Performance","Workshops"].map(category=>future.find(e=>e.category===category&&!excluded(e))?.title||null),
        excludedFarmers:future.some(e=>e.category==="Markets"&&/farmers? markets?/i.test(e.title)),
        closures:future.filter(e=>/^(?:closed|closure|venue closed|no events?)\\b/i.test(String(e.title||"").trim())).length
      };
    },from);
    assert(data.eligible>0,"Sample calendar has upcoming approved records");
    assert(data.categoryExamples.every(Boolean),"Snapshot includes non-music classifications");
    await page.locator("#fromDate").fill(from);
    const summary=await page.locator("#summary").innerText();
    assert(summary.startsWith(data.eligible+" matching event listing"),"Default feed must count all source-listed categories: "+JSON.stringify(data)+" / "+summary);
    assert(data.eligible>data.future/2,"Default feed cannot exclude most future records by classification");
    for(const title of data.categoryExamples){
      await page.locator("#search").fill(title);
      assert((await page.locator("#results [data-event]").count())>0,"Sourced event hidden solely by category: "+title);
    }
    await page.locator("#search").fill("");
    await page.locator("#search").fill("PSU Farmers Market");
    assert.equal(await page.locator("#results [data-event]").count(),0,"Explicitly excluded routine farmers markets stay outside default");
    await page.locator("#search").fill("Closed Merry Christmas");
    assert.equal(await page.locator("#results [data-event]").count(),0,"Mistagged closure notice cannot appear as music");
    assert.deepEqual(errors,[],"No SHOWS browser errors");
    console.log("PASS — source-first SHOWS includes non-Music events, omits farmers markets and closure notices; "+data.eligible+"/"+data.future+" future records shown");
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
