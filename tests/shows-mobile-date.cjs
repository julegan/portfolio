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
    const visible=document.querySelector("#fromDateDisplay");
    const container=document.querySelector(".preview-filters");
    const frame=document.querySelector("main");
    const box=el=>{const x=el.getBoundingClientRect();return {left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height}};
    return {
     viewport:document.documentElement.clientWidth,
     documentWidth:document.documentElement.scrollWidth,
     bodyWidth:document.body.scrollWidth,
     input:box(input),wrap:box(wrap),visible:box(visible),label:box(label),container:box(container),frame:box(frame),
     dateVisible:visible.textContent,
     dateVisibleHidden:visible.getAttribute("aria-hidden"),
     nativeOpacity:getComputedStyle(input).opacity,
     nativePosition:getComputedStyle(input).position,
     wrapperAlign:getComputedStyle(wrap).alignItems,
     dateAppearance:getComputedStyle(input).appearance,
     dateDisplay:getComputedStyle(input).display,
     dateVerticalAlign:getComputedStyle(input).verticalAlign,
     wrapperDisplay:getComputedStyle(wrap).display,
     inputHeight:getComputedStyle(input).height,
     wrapperLineHeight:getComputedStyle(wrap).lineHeight,
     datePadding:getComputedStyle(input).paddingLeft,
     wrapperPadding:getComputedStyle(wrap).paddingLeft,
     dateMinWidth:getComputedStyle(input).minWidth,
     dateValue:input.value
    };
   });
   const msg=engine+" "+width+"px: "+JSON.stringify(measurements);
   assert.equal(measurements.dateAppearance,"none","Native date control retains predictable dimensions: "+msg);
   assert.equal(measurements.wrapperDisplay,"flex","Date display wrapper is flex centered: "+msg);
   assert.equal(measurements.wrapperAlign,"center","Date text is vertically centered: "+msg);
   assert.equal(measurements.nativeOpacity,"0","Safari's native date glyphs are hidden: "+msg);
   assert.equal(measurements.nativePosition,"absolute","Native control overlays the visible date: "+msg);
   assert.equal(measurements.dateVisibleHidden,"true","Do not duplicate native value for screen readers: "+msg);
   assert(Math.abs((measurements.visible.top+measurements.visible.bottom)/2-
     (measurements.wrap.top+measurements.wrap.bottom)/2)<1,"Date text center matches wrapper center: "+msg);
   assert(Math.abs(measurements.input.height-measurements.wrap.height)<1 &&
     Math.abs(measurements.input.width-measurements.wrap.width)<1,"Picker fills whole 44px field: "+msg);
   assert(measurements.dateVisible.length>5,"Date display loads from state: "+msg);
   assert.equal(measurements.datePadding,"0px","Keep iOS overflow workaround: "+msg);
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
   assert.equal(await page.locator("#fromDateDisplay").textContent(),"Nov 7, 2026","Displayed date updates when picker changes");
   await page.locator("#fromDate").focus();
   const outline=await page.locator(".preview-date-field").evaluate(el=>getComputedStyle(el).outlineStyle);
   assert.equal(outline,"solid","Date picker focus remains clearly visible");
   await page.locator("#jumpToday").click();
   assert.equal(await page.locator("#fromDate").inputValue(),measurements.dateValue,"Start today resets native date value");
   assert.equal(await page.locator("#fromDateDisplay").textContent(),measurements.dateVisible,"Start today resets visible date");
   assert.deepEqual(errors,[],"No browser errors at "+width+"px");
   await page.close();
   console.log("PASS SHOWS mobile date width for "+engine+" at "+width+"px");
  }
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
