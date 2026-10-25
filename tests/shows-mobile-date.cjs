"use strict";
/* Guard the actual published SHOWS route against native date-input intrinsic
   width causing a horizontally scrolling page on narrow mobile screens. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const origin="http://127.0.0.1:4173";
(async()=>{
 for(const [engine,launch,widths] of [["Chromium",()=>chromium.launch({headless:true,args:["--no-sandbox"]}),[320,375,390,430,680]],["WebKit",()=>webkit.launch({headless:true}),[320,375,390,430]]]){
  const browser=await launch();
  try{
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   const response=await page.goto(origin+"/projects/shows/",{waitUntil:"domcontentloaded"});
   assert.equal(response.status(),200,"SHOWS production calendar loads");
   const measurements=await page.evaluate(()=>{
    const input=document.querySelector("#fromDate");
    const label=document.querySelector("#fromDateLabel");
    const wrap=document.querySelector(".preview-date-field");
    const container=document.querySelector(".preview-filters");
    const frame=document.querySelector("main");
    const box=el=>{const x=el.getBoundingClientRect();return {left:x.left,right:x.right,width:x.width}};
    return {
     viewport:document.documentElement.clientWidth,
     documentWidth:document.documentElement.scrollWidth,
     bodyWidth:document.body.scrollWidth,
     input:box(input),wrap:box(wrap),label:box(label),container:box(container),frame:box(frame),
     dateAppearance:getComputedStyle(input).appearance,
     datePadding:getComputedStyle(input).paddingLeft,
     wrapperPadding:getComputedStyle(wrap).paddingLeft,
     dateMinWidth:getComputedStyle(input).minWidth,
     dateValue:input.value
    };
   });
   const msg=engine+" "+width+"px: "+JSON.stringify(measurements);
   assert.equal(measurements.dateAppearance,"none","WebKit native date must not override CSS dimensions: "+msg);
   assert.equal(measurements.datePadding,"0px","Move date input padding into wrapper to avoid iOS WebKit width bug: "+msg);
   assert(measurements.wrapperPadding!=="0px","Wrapper preserves comfortable touch spacing: "+msg);
   assert(measurements.input.width>40,"Native date control stays usable: "+msg);
   assert(measurements.input.left>=measurements.frame.left-1,"Date control remains inside content left edge: "+msg);
   assert(measurements.input.right<=measurements.frame.right+1,"Date control remains inside content right edge: "+msg);
   assert(measurements.input.right<=measurements.wrap.right+1,"Date input remains inside bounded wrapper: "+msg);
   assert(measurements.wrap.right<=measurements.frame.right+1,"Date wrapper stays within content: "+msg);
   assert(measurements.label.right<=measurements.frame.right+1,"Date label remains inside content: "+msg);
   assert(measurements.container.right<=measurements.frame.right+1,"Filter row remains inside content: "+msg);
   assert(measurements.documentWidth<=measurements.viewport+1,"No page-level horizontal overflow: "+msg);
   assert(measurements.bodyWidth<=measurements.viewport+1,"No body-level horizontal overflow: "+msg);
   assert(/^\d{4}-\d{2}-\d{2}$/.test(measurements.dateValue),"Native date picker keeps valid value");
   await page.locator("#fromDate").fill("2026-11-07");
   assert.equal(await page.locator("#fromDate").inputValue(),"2026-11-07","Date remains keyboard/picker accessible");
   await page.locator("#fromDate").focus();
   const outline=await page.locator(".preview-date-field").evaluate(el=>getComputedStyle(el).outlineStyle);
   assert.equal(outline,"solid","Date picker focus remains clearly visible");
   assert.deepEqual(errors,[],"No browser errors at "+width+"px");
   await page.close();
   console.log("PASS SHOWS mobile date width for "+engine+" at "+width+"px");
  }
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
