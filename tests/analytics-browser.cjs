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
    async function scenario(label, init, host, shouldLoad) {
      const context=await browser.newContext();
      try {
        const requests=[];
        const errors=[];
        if(init) await context.addInitScript(init);
        await context.route(host+"/**",localRoute);
        await context.route("https://www.googletagmanager.com/**",route=>{
          requests.push(route.request().url());
          return route.fulfill({status:200,contentType:"application/javascript",body:""});
        });
        await context.route("https://www.google-analytics.com/**",route=>route.fulfill({status:204,body:""}));
        const page=await context.newPage();
        page.on("pageerror",error=>errors.push(error.message));
        for(const route of ["/?private=test#fragment","/projects/shows/"]){
          const before=requests.length;
          const tag=shouldLoad?page.waitForResponse(r=>r.url().startsWith("https://www.googletagmanager.com/gtag/js?id=")&&r.status()===200):null;
          await page.goto(host+route,{waitUntil:"load"});
          if(tag) await tag;
          assert.equal(requests.length,before+(shouldLoad?1:0),label+" vendor requests");
          assert.equal(await page.locator("#portfolio-google-tag").count(),shouldLoad?1:0);
          assert.equal(await page.getByRole("button",{name:"Analytics preferences"}).count(),0);
          assert.equal(await page.locator("#portfolio-analytics-choices").count(),0);
          assert.equal(await page.locator(".portfolio-analytics-notice").count(),1);
          const flags=await page.evaluate(()=>({
            disabled:window["ga-disable-G-LMS6LWDK63"],
            data:(window.dataLayer||[]).map(x=>Array.from(x)),
          }));
          assert.equal(flags.disabled,!shouldLoad);
          if(shouldLoad){
            const config=flags.data.find(x=>x[0]==="config");
            assert.equal(config[1],"G-LMS6LWDK63");
            assert.equal(config[2].page_location,host+route.split("?")[0]);
            assert.equal(config[2].allow_google_signals,false);
            assert.equal(config[2].allow_ad_personalization_signals,false);
            const consent=flags.data.find(x=>x[0]==="consent");
            for(const key of ["ad_storage","ad_user_data","ad_personalization"]) assert.equal(consent[2][key],"denied");
          }
        }
        assert.deepEqual(errors,[],label+" page errors");
      }finally{await context.close();}
    }
    await scenario("Fresh visit",null,origin,true);
    await scenario("Previously allowed",()=>localStorage.setItem("julieowens.analytics.choice.v1","allow"),origin,true);
    await scenario("Previously declined",()=>localStorage.setItem("julieowens.analytics.choice.v1","deny"),origin,false);
    await scenario("GPC",()=>Object.defineProperty(navigator,"globalPrivacyControl",{value:true,configurable:true}),origin,false);
    await scenario("DNT",()=>Object.defineProperty(navigator,"doNotTrack",{value:"1",configurable:true}),origin,false);
    await scenario("Unavailable storage",()=>{const get=Storage.prototype.getItem;Object.defineProperty(Storage.prototype,"getItem",{value(key){if(key==="julieowens.analytics.choice.v1")throw Error("blocked");return get.call(this,key)},configurable:true})},origin,false);
    await scenario("Preview",null,"https://preview.example.test",false);
    console.log("PASS — GA4 default loading, no consent controls, prior refusals, GPC, DNT and production-only guard");
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
