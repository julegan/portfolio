"use strict";
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const axePath=require.resolve("axe-core/axe.min.js");
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
      assert.equal(Number(await page.locator("#graphic svg.chart rect").nth(1).getAttribute("x")),37+119*12,"First stitch is on the right of round 1 chart");
      await page.locator("#repeats").fill("11");
      await page.locator("#repeats").press("Tab");
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
      await page.waitForFunction(()=>document.getElementById("status").textContent.includes("opened"));
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
      await page.addScriptTag({path:axePath});
      const audit=await page.evaluate(()=>window.axe.run(document,{
        runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}
      }));
      const violations=audit.violations.map(v=>({id:v.id,where:v.nodes.map(n=>n.target.join(" ")).slice(0,5)}));
      assert.deepEqual(violations,[],"Tubes must pass baseline automated WCAG 2.1 AA axe checks");
      const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
      assert.equal(horizontalOverflow,false,"Page itself must not overflow viewport; chart can scroll internally.");
      assert.deepEqual(errors,[],"No uncaught browser errors");
      await page.close();
    }
    console.log("Tubes browser smoke tests passed.");
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});