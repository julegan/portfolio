"use strict";
/* Guard the actual published SHOWS route against native date-input intrinsic
   width causing a horizontally scrolling page on narrow mobile screens. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const origin="http://127.0.0.1:4173";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,375,390,430,680]){
   const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   const response=await page.goto(origin+"/projects/shows/",{waitUntil:"domcontentloaded"});
   assert.equal(response.status(),200,"SHOWS production calendar loads");
   const measurements=await page.evaluate(()=>{
    const input=document.querySelector("#fromDate");
    const label=document.querySelector("#fromDateLabel");
    const container=document.querySelector(".preview-filters");
    const frame=document.querySelector("main");
    const box=el=>{const x=el.getBoundingClientRect();return {left:x.left,right:x.right,width:x.width}};
    return {
     viewport:document.documentElement.clientWidth,
     documentWidth:document.documentElement.scrollWidth,
     bodyWidth:document.body.scrollWidth,
     input:box(input),label:box(label),container:box(container),frame:box(frame),
     dateMinWidth:getComputedStyle(input).minWidth,
     dateValue:input.value
    };
   });
   const msg=width+"px: "+JSON.stringify(measurements);
   assert(measurements.input.width>40,"Native date control stays usable: "+msg);
   assert(measurements.input.left>=measurements.frame.left-1,"Date control remains inside content left edge: "+msg);
   assert(measurements.input.right<=measurements.frame.right+1,"Date control remains inside content right edge: "+msg);
   assert(measurements.label.right<=measurements.frame.right+1,"Date label remains inside content: "+msg);
   assert(measurements.container.right<=measurements.frame.right+1,"Filter row remains inside content: "+msg);
   assert(measurements.documentWidth<=measurements.viewport+1,"No page-level horizontal overflow: "+msg);
   assert(measurements.bodyWidth<=measurements.viewport+1,"No body-level horizontal overflow: "+msg);
   assert(/^\d{4}-\d{2}-\d{2}$/.test(measurements.dateValue),"Native date picker keeps valid value");
   await page.locator("#fromDate").fill("2026-11-07");
   assert.equal(await page.locator("#fromDate").inputValue(),"2026-11-07","Date remains keyboard/picker accessible");
   assert.deepEqual(errors,[],"No browser errors at "+width+"px");
   await page.close();
   console.log("PASS SHOWS mobile date width at "+width+"px");
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
