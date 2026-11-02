"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const {chromium} = require("playwright");
const origin = "https://julieowens.me";
const root = path.resolve(__dirname, "../dist");

async function localRoute(route) {
  const url = new URL(route.request().url());
  let decoded = decodeURIComponent(url.pathname);
  if (decoded.endsWith("/")) decoded += "index.html";
  const name = path.resolve(root, "." + decoded);
  if (!name.startsWith(root + path.sep)) return route.fulfill({status:404,body:"Not found"});
  try {
    const data = await fs.readFile(name);
    const types = {".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",
      ".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".mjs":"application/javascript; charset=utf-8"};
    return route.fulfill({status:200,contentType:types[path.extname(name)]||"application/octet-stream",body:data});
  } catch (_) { return route.fulfill({status:404,body:"Not found"}); }
}
async function main(){
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext();
    const tagRequests=[];
    const pageErrors=[];
    await context.route("https://julieowens.me/**",localRoute);
    await context.route("https://www.googletagmanager.com/**",route=>{
      tagRequests.push(route.request().url());
      return route.fulfill({status:200,contentType:"application/javascript",body:""});
    });
    await context.route("https://www.google-analytics.com/**",route=>route.fulfill({status:204,body:""}));
    const page=await context.newPage();
    page.on("pageerror",error=>pageErrors.push(error.message));
    await page.goto(origin+"/",{waitUntil:"load"});
    assert(await page.locator("#portfolio-analytics-choices").isVisible(),"Anonymous visitor sees optional analytics choice");
    assert.equal(tagRequests.length,0,"No Google tag/network request before opt-in");
    await page.locator("#portfolio-analytics-decline").click();
    assert.equal(await page.evaluate(()=>localStorage.getItem("julieowens.analytics.choice.v1")),"deny");
    assert.equal(tagRequests.length,0,"Decline never calls Google");
    await page.goto(origin+"/projects/",{waitUntil:"load"});
    assert(!await page.locator("#portfolio-analytics-choices").isVisible(),"Choice respected across pages");
    await page.getByRole("button",{name:"Analytics preferences"}).click();
    assert(await page.locator("#portfolio-analytics-choices").isVisible(),"Preference can be reopened from footer");
    await page.locator("#portfolio-analytics-allow").click();
    await page.waitForFunction(()=>!!document.querySelector("#portfolio-google-tag"));
    assert.equal(tagRequests.length,1,"One Google tag request following consent on production");
    const flags=await page.evaluate(()=>({
      disabled:window["ga-disable-G-LMS6LWDK63"],
      data:window.dataLayer.map(x=>Array.from(x).slice(0,3)),
      storage:localStorage.getItem("julieowens.analytics.choice.v1")
    }));
    assert.equal(flags.disabled,false);
    assert.equal(flags.storage,"allow");
    const config=flags.data.find(x=>x[0]==="config");
    assert.equal(config[1],"G-LMS6LWDK63");
    assert.equal(config[2].page_location,origin+"/projects/","No query strings or hashes in analytics page location");
    await page.goto(origin+"/projects/shows/",{waitUntil:"load"});
    await page.waitForFunction(()=>!!document.querySelector("#portfolio-google-tag"));
    assert.equal(tagRequests.length,2,"Stored opt-in applies to other portfolio routes");
    await page.getByRole("button",{name:"Analytics preferences"}).click();
    await page.locator("#portfolio-analytics-decline").click();
    assert.equal(await page.evaluate(()=>window["ga-disable-G-LMS6LWDK63"]),true,"Withdrawal stops GA");
    await page.reload({waitUntil:"load"});
    assert.equal(tagRequests.length,2,"No Google tag after withdrawal and reload");
    assert(!await page.locator("#portfolio-analytics-choices").isVisible());

    // Verify changing one's mind again without reloading reinits analytics.
    await page.getByRole("button",{name:"Analytics preferences"}).click();
    await page.locator("#portfolio-analytics-allow").click();
    await page.waitForFunction(()=>!!document.querySelector("#portfolio-google-tag"));
    assert.equal(tagRequests.length,3);
    await page.getByRole("button",{name:"Analytics preferences"}).click();
    await page.locator("#portfolio-analytics-decline").click();
    await page.getByRole("button",{name:"Analytics preferences"}).click();
    await page.locator("#portfolio-analytics-allow").click();
    const reEnabled=await page.evaluate(()=>window["ga-disable-G-LMS6LWDK63"]);
    assert.equal(reEnabled,false,"Re-enable following withdrawal on the same page");
    assert.equal(tagRequests.length,3,"No second vendor script injected when re-granting");
    assert.deepEqual(pageErrors,[],"No portfolio or consent script page errors");
    await context.close();

    const privacyContext=await browser.newContext();
    const privacyRequests=[];
    await privacyContext.addInitScript(()=>{
      Object.defineProperty(navigator,"globalPrivacyControl",{value:true,configurable:true});
      localStorage.setItem("julieowens.analytics.choice.v1","allow");
    });
    await privacyContext.route("https://julieowens.me/**",localRoute);
    await privacyContext.route("https://www.googletagmanager.com/**",route=>{
      privacyRequests.push(route.request().url());
      return route.fulfill({status:200,contentType:"application/javascript",body:""});
    });
    const privatePage=await privacyContext.newPage();
    await privatePage.goto(origin+"/",{waitUntil:"load"});
    assert.equal(privacyRequests.length,0,"GPC overrides previously stored consent");
    assert(!await privatePage.locator("#portfolio-analytics-choices").isVisible(),"No forced banner with privacy signal");
    await privatePage.getByRole("button",{name:"Analytics preferences"}).click();
    assert(await privatePage.locator("#portfolio-analytics-allow").isHidden(),"No misleading opt-in when GPC is active");
    assert.match(await privatePage.locator("#portfolio-analytics-status").innerText(),/browser requests no tracking/i);
    await privacyContext.close();
    console.log("PASS — GA4 consent across nine-page portfolio, opt-in only, withdrawal/regrant and global privacy control");
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
