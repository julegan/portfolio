"use strict";
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const base="http://127.0.0.1:4173/projects/tubes/";
(async()=>{
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
    for(const width of [1280,390]){
      const page=await browser.newPage({viewport:{width,height:850},acceptDownloads:true});
      const errors=[];page.on("pageerror",e=>errors.push(e.message));
      const response=await page.goto(base,{waitUntil:"networkidle"});
      assert.equal(response.status(),200);
      assert.equal(await page.locator("main h1").innerText(),"Tubes.");
      assert(await page.locator("#graphic svg.chart rect").count()>500,"Chart renders real stitch cells");
      assert.equal(await page.locator("#stitchCount").innerText(),"120");
      assert.equal(await page.locator("#roundCount").innerText(),"84");
      await page.locator("#repeats").fill("11");
      await page.locator("#repeats").dispatchEvent("change");
      assert.equal(await page.locator("#stitchCount").innerText(),"132","More repeats grows tube");
      await page.locator("#undo").click();
      assert.equal(await page.locator("#stitchCount").innerText(),"120");
      await page.locator("#tubeTab").click();
      assert(await page.locator("#graphic svg.tube path").count()>100);
      await page.locator("#chartTab").click();
      const projectPromise=page.waitForEvent("download");
      await page.locator("#downloadProject").click();
      const download=await projectPromise;
      assert.match(download.suggestedFilename(),/\.tubes\.json$/);
      const projectPath=await download.path();
      await page.locator("#openProject").setInputFiles(projectPath);
      assert.match(await page.locator("#status").innerText(),/opened/i);
      const markdownPromise=page.waitForEvent("download");
      await page.locator("#downloadMd").click();
      const md=await markdownPromise;
      assert.match(md.suggestedFilename(),/\.md$/);
      const svgPromise=page.waitForEvent("download");
      await page.locator("#downloadSvg").click();
      assert.match((await svgPromise).suggestedFilename(),/\.svg$/);
      const pngPromise=page.waitForEvent("download");
      await page.locator("#downloadPng").click();
      assert.match((await pngPromise).suggestedFilename(),/\.png$/);
      await page.locator("#saveLocal").click();
      assert(await page.locator("#savedList option").count()>1);
      await page.locator("#editRound").fill("1");
      await page.locator("#editStitch").fill("1");
      await page.locator("#editType").selectOption("p");
      await page.locator("#applyEdit").click();
      assert.match(await page.locator("#status").innerText(),/updated/);
      const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
      assert.equal(horizontalOverflow,false,"Page itself must not overflow viewport; chart can scroll internally.");
      assert.deepEqual(errors,[],"No uncaught browser errors");
      await page.close();
    }
    console.log("Tubes browser smoke tests passed.");
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});