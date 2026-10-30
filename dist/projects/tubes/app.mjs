import {WEIGHTS,PALETTES,DEFAULTS,dimensions,makeGrid,newProject,normalizeProject,sanitizeSettings,patternMarkdown,maxFloat} from "./engine.mjs";
const $=id=>document.getElementById(id);
const form=$("controls");
let project=newProject(),model=makeGrid(project.settings),view="chart",undo=[],redo=[];
const key="tubes-saved-v1";
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const filename=()=>project.settings.name.toLowerCase().replace(/[^a-z0-9-_]+/g,"-").replace(/^-+|-+$/g,"").slice(0,50)||"tubes-pattern";
const status=msg=>{$("status").textContent=msg;};
function historyPush(){undo.push(JSON.stringify(project));if(undo.length>40)undo.shift();redo=[];}
function snapshot(){return JSON.parse(JSON.stringify(project));}
function update(next,record=true){
  try{
    const normalized=normalizeProject(next);
    const computed=makeGrid(normalized.settings,normalized.overrides);
    if(record)historyPush();
    project=normalized;model=computed;
    render();
    return true;
  }catch(err){status(err.message);return false;}
}
function hydrate(){
  for(const [name,val] of Object.entries(project.settings)){
    if(!form.elements[name])continue;
    if(name==="texture")form.elements[name].checked=val;
    else form.elements[name].value=val;
  }
}
function applyControl(id,value){
  const prev=snapshot();
  const s={...prev.settings,[id]:value};
  if(id==="weight"){
    s.stitches4=WEIGHTS[value].st;
    s.rounds4=WEIGHTS[value].rows;
  }
  try{
    const clean=sanitizeSettings(s);
    const dims=dimensions(clean);
    prev.settings=clean;
    prev.overrides=prev.overrides.filter(o=>o.r<dims.rounds&&o.c<dims.stitches&&o.color<clean.colors);
    if(update(prev))status("Pattern updated. Changes can be undone.");
    else hydrate();
    if(id==="weight")hydrate();
  }catch(err){status(err.message);hydrate();}
}
for(const field of form.querySelectorAll("input,select")){
  const id=field.id;
  if(!Object.hasOwn(DEFAULTS,id))continue;
  const evt=(field.type==="range"||field.type==="checkbox"||field.tagName==="SELECT")?"input":"change";
  field.addEventListener(evt,()=>applyControl(id,field.type==="checkbox"?field.checked:field.value));
}
$("generate").addEventListener("click",()=>{
  const next=snapshot();
  next.settings.seed=crypto.getRandomValues(new Uint32Array(1))[0]>>>1;
  next.overrides=[];
  if(update(next))status("New design generated. Undo returns to the previous pattern.");
});
function goHistory(source,target){
  if(!source.length)return;
  target.push(JSON.stringify(project));
  const next=JSON.parse(source.pop());
  if(update(next,false)){hydrate();status("Design restored.");}
}
$("undo").addEventListener("click",()=>goHistory(undo,redo));
$("redo").addEventListener("click",()=>goHistory(redo,undo));
function chartSVG(p,m,opts={}){
  const s=p.settings,d=m.dimensions,colors=PALETTES[s.palette];
  const r0=opts.r0??0,r1=opts.r1??d.rounds,c0=opts.c0??0,c1=opts.c1??d.stitches;
  const nC=c1-c0,nR=r1-r0,unit=12,left=37,top=12,bottom=22;
  const W=left+nC*unit+7,H=top+nR*unit+bottom;
  const parts=['<svg class="chart" xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" data-r0="'+r0+'" data-c0="'+c0+'" data-unit="'+unit+'" data-left="'+left+'" data-top="'+top+'">','<title>Stitch chart for '+escapeHTML(s.name)+', rounds '+(r0+1)+' through '+r1+', stitches '+(c0+1)+' through '+c1+'</title>','<rect width="100%" height="100%" fill="#eeeaf0"/>'];
  for(let r=r0;r<r1;r++){
    const y=top+(r1-r-1)*unit;
    for(let c=c0;c<c1;c++){
      const cell=m.grid[r][c],x=left+(c1-c-1)*unit;
      parts.push('<rect x="'+x+'" y="'+y+'" width="'+unit+'" height="'+unit+'" fill="'+colors[cell.color]+'" stroke="#282334" stroke-opacity=".36" stroke-width=".5"/>');
      if(cell.stitch==="p")parts.push('<circle cx="'+(x+6)+'" cy="'+(y+6)+'" r="2.5" fill="#ffffff" stroke="#121217" stroke-width="1"/>');
    }
    if(nR<=34||r%5===0||r===0)parts.push('<text x="'+(left-5)+'" y="'+(y+8.8)+'" text-anchor="end" font-size="9" fill="#272332" font-family="monospace">'+(r+1)+'</text>');
  }
  for(let c=c0;c<c1;c++)if(nC<=42||c%5===0||c===0)parts.push('<text x="'+(left+(c1-c-1)*unit+5)+'" y="'+(top+nR*unit+12)+'" text-anchor="middle" font-size="8" fill="#292334" font-family="monospace">'+(c+1)+'</text>');
  parts.push('</svg>');
  return parts.join("");
}
function tubeSVG(p,m){
  const s=p.settings,d=m.dimensions,colors=PALETTES[s.palette];
  const w=520,h=Math.max(280,Math.min(660,d.rounds*6)),yTop=33,bodyH=h-66,center=w/2,radius=190;
  let html='<svg class="tube" xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><title>Illustrated cylindrical projection of the front half of '+escapeHTML(s.name)+'</title><defs><linearGradient id="shade" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0" stop-color="#080711" stop-opacity=".68"/><stop offset=".22" stop-color="#080711" stop-opacity="0"/><stop offset=".77" stop-color="#080711" stop-opacity="0"/><stop offset="1" stop-color="#080711" stop-opacity=".68"/></linearGradient></defs><rect width="100%" height="100%" fill="#15131b"/>';
  const a=Math.floor(d.stitches*.25),b=Math.ceil(d.stitches*.75);
  const X=c=>center-radius*Math.sin((c/d.stitches-.5)*Math.PI*2);
  const Y=r=>yTop+bodyH*(1-r/d.rounds);
  for(let r=0;r<d.rounds;r++){
    for(let c=a;c<b;c++){
      const x0=X(c),x1=X(c+1),y0=Y(r+1),y1=Y(r);
      const cell=m.grid[r][c];
      html+='<path d="M'+x0.toFixed(2)+' '+y0.toFixed(2)+'H'+x1.toFixed(2)+'V'+y1.toFixed(2)+'H'+x0.toFixed(2)+'Z" fill="'+colors[cell.color]+'"/>';
      if(cell.stitch==="p"&&(x1-x0)>2)html+='<circle cx="'+((x0+x1)/2).toFixed(2)+'" cy="'+((y0+y1)/2).toFixed(2)+'" r="1.2" fill="#fff" stroke="#111" stroke-width=".4"/>';
    }
  }
  html+='<rect x="'+(center-radius)+'" y="'+yTop+'" width="'+(radius*2)+'" height="'+bodyH+'" fill="url(#shade)"/>';
  html+='<ellipse cx="'+center+'" cy="'+yTop+'" rx="'+radius+'" ry="23" fill="#101017" stroke="#b5aebb" stroke-width="3"/>';
  html+='<path d="M'+(center-radius)+' '+(yTop+bodyH)+' A'+radius+' 23 0 0 0 '+(center+radius)+' '+(yTop+bodyH)+'" fill="none" stroke="#a6a0b0" stroke-width="2"/>';
  html+='</svg>';
  return html;
}
function render(){
  const s=project.settings,d=model.dimensions,colors=PALETTES[s.palette];
  $("seedTag").textContent="SEED "+s.seed;
  $("stitchCount").textContent=d.stitches.toLocaleString();
  $("roundCount").textContent=d.rounds.toLocaleString();
  $("finishedSize").textContent=d.actualCircumference.toFixed(1)+" × "+d.actualHeight.toFixed(1)+" in";
  $("complexityOutput").textContent=s.complexity+" / 4";
  $("colorsOutput").textContent=s.colors;
  $("repeatHint").textContent=s.arrangement==="repeat"
    ?"Repeating sets the cast-on count. Changing repeats changes the finished circumference (which can differ from the target)."
    :"One continuous wraparound design uses target circumference and gauge to calculate cast-on stitches.";
  $("motifWidth").disabled=s.arrangement!=="repeat";
  $("repeats").disabled=s.arrangement!=="repeat";
  $("colorLegend").innerHTML=colors.slice(0,s.colors).map((c,i)=>'<span class="key"><span class="swatch" style="background:'+c+'"></span>C'+(i+1)+' '+c+'</span>').join("");
  $("editColor").innerHTML=colors.slice(0,s.colors).map((c,i)=>'<option value="'+i+'">C'+(i+1)+' · '+c+'</option>').join("");
  $("editRound").max=d.rounds;$("editStitch").max=d.stitches;
  if(+$("editRound").value>d.rounds)$("editRound").value=d.rounds;
  if(+$("editStitch").value>d.stitches)$("editStitch").value=d.stitches;
  $("chartTab").setAttribute("aria-pressed",String(view==="chart"));
  $("tubeTab").setAttribute("aria-pressed",String(view==="tube"));
  $("graphic").innerHTML=view==="chart"?chartSVG(project,model):tubeSVG(project,model);
  $("graphic").setAttribute("aria-label",view==="chart"?"Stitch chart: "+d.stitches+" stitches across, "+d.rounds+" rounds, bottom up":"Schematic cylinder showing the front half of the generated pattern");
  $("graphicCaption").textContent=view==="chart"
    ?"Flat chart / Round 1 at bottom. Read each round right-to-left. Scroll to inspect stitches. Click a square to cycle its yarn color."
    :"Schematic cylinder / front half of the actual chart, shaded for depth. Not a photograph or a stitch-accurate fabric simulation.";
  $("floatNote").textContent=s.colors>1
    ?"Longest unused-color span in a round: "+maxFloat(model.grid,s.colors)+" stitches. Check strand management and catch long floats where needed."
    :"Single-color design: use the purl markers (white dots) if texture is enabled.";
  $("undo").disabled=undo.length===0;$("redo").disabled=redo.length===0;
  $("heroTiles").innerHTML=Array.from({length:18*8},(_,i)=>{
    const x=i%18,y=Math.floor(i/18),idx=(Math.abs(x-8-y)%4);
    return '<i style="background:'+colors[idx%s.colors]+'"></i>';
  }).join("");
}
function editStitch(r,c,color,stitch){
  const next=snapshot(),cell=model.grid[r]?.[c];
  if(!cell){status("Choose an existing round and stitch number.");return;}
  const map=new Map(next.overrides.map(o=>[o.r+":"+o.c,o]));
  map.set(r+":"+c,{r,c,color,stitch});
  next.overrides=[...map.values()];
  if(update(next))status("Stitch "+(c+1)+" on round "+(r+1)+" updated.");
}
$("graphic").addEventListener("click",event=>{
  if(view!=="chart")return;
  const svg=event.target.closest("svg.chart");if(!svg)return;
  const rect=svg.getBoundingClientRect(),scale=svg.viewBox.baseVal.width/rect.width;
  const x=(event.clientX-rect.left)*scale,y=(event.clientY-rect.top)*scale;
  const c=model.dimensions.stitches-1-Math.floor((x-37)/12),displayR=Math.floor((y-12)/12),r=model.dimensions.rounds-displayR-1;
  if(c<0||c>=model.dimensions.stitches||r<0||r>=model.dimensions.rounds)return;
  const old=model.grid[r][c];
  editStitch(r,c,(old.color+1)%project.settings.colors,old.stitch);
});
$("applyEdit").addEventListener("click",()=>{
  const r=Number($("editRound").value)-1,c=Number($("editStitch").value)-1;
  if(!Number.isInteger(r)||!Number.isInteger(c)||r<0||r>=model.dimensions.rounds||c<0||c>=model.dimensions.stitches){
    status("Round or stitch is out of range.");return;
  }
  editStitch(r,c,Number($("editColor").value),$("editType").value);
});
$("chartTab").addEventListener("click",()=>{view="chart";render();});
$("tubeTab").addEventListener("click",()=>{view="tube";render();});
function download(content,name,type){
  const blob=content instanceof Blob?content:new Blob([content],{type});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function saved(){
  try{const v=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(v)?v.slice(0,25):[];}catch{return [];}
}
function populateSaved(){
  const list=saved();$("savedList").innerHTML='<option value="">Choose a saved pattern…</option>'+
    list.map((o,i)=>'<option value="'+i+'">'+escapeHTML(o.name)+" · "+escapeHTML(o.date)+'</option>').join("");
}
$("saveLocal").addEventListener("click",()=>{
  try{
    const list=saved(),entry={name:project.settings.name,date:new Date().toLocaleDateString(),project:snapshot()};
    list.unshift(entry);localStorage.setItem(key,JSON.stringify(list.slice(0,20)));populateSaved();
    status("Saved in this browser. Download a project file for a durable backup.");
  }catch{status("Browser storage is unavailable or full. Download the editable project file instead.");}
});
$("savedList").addEventListener("change",event=>{
  const i=Number(event.target.value),list=saved();
  if(event.target.value===""||!list[i])return;
  if(update(list[i].project)){hydrate();status("Saved design opened.");}
  event.target.value="";
});
$("downloadProject").addEventListener("click",()=>{
  download(JSON.stringify(snapshot(),null,2),filename()+".tubes.json","application/json");status("Editable Tubes project downloaded.");
});
$("openProject").addEventListener("change",async event=>{
  const file=event.target.files?.[0];
  event.target.value="";
  if(!file)return;
  if(file.size>1024*1024){status("Project file must be smaller than 1 MB.");return;}
  try{
    const data=JSON.parse(await file.text());
    if(update(data)){hydrate();status("Editable Tubes project opened. All saved stitch edits restored.");}
  }catch(err){status("Could not open project: "+err.message);}
});
function selectedSVG(){return $("exportView").value==="tube"?tubeSVG(project,model):chartSVG(project,model);}
function exportBase(){return filename()+($("exportView").value==="tube"?"-tube":"-chart");}
$("downloadSvg").addEventListener("click",()=>{
  download(selectedSVG(),exportBase()+".svg","image/svg+xml;charset=utf-8");status("SVG graphic downloaded.");
});
$("downloadMd").addEventListener("click",()=>{
  download(patternMarkdown(project,model),filename()+".md","text/markdown;charset=utf-8");status("Markdown instructions downloaded. Export the chart separately for a visual companion.");
});
$("downloadPng").addEventListener("click",async()=>{
  const button=$("downloadPng");button.disabled=true;
  const blob=new Blob([selectedSVG()],{type:"image/svg+xml;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  try{
    const img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
    const size=Math.min(2,12000/Math.max(img.width,img.height));
    const canvas=document.createElement("canvas");canvas.width=Math.round(img.width*size);canvas.height=Math.round(img.height*size);
    const ctx=canvas.getContext("2d");if(!ctx)throw Error("Canvas is unavailable.");
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const png=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("PNG conversion failed.")),"image/png"));
    download(png,exportBase()+".png","image/png");status("PNG graphic downloaded.");
  }catch(err){status("PNG export failed: "+err.message);}finally{URL.revokeObjectURL(url);button.disabled=false;}
});
function printHTML(){
  const s=project.settings,d=model.dimensions,colors=PALETTES[s.palette];
  let chunks="";
  for(let r0=0;r0<d.rounds;r0+=30){
    for(let c0=0;c0<d.stitches;c0+=40){
      const r1=Math.min(d.rounds,r0+30),c1=Math.min(d.stitches,c0+40);
      chunks+='<section class="sheet"><h2>Chart · Rounds '+(r0+1)+'–'+r1+' / stitches '+(c0+1)+'–'+c1+'</h2><p>Round 1 at bottom of full pattern. Read every round from right to left.</p>'+chartSVG(project,model,{r0,r1,c0,c1})+'</section>';
    }
  }
  const md=patternMarkdown(project,model);
  const keyHtml=colors.slice(0,s.colors).map((color,i)=>'<span><b style="background:'+color+'"></b>C'+(i+1)+' '+color+'</span>').join(" ");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>'+escapeHTML(s.name)+' — Tubes printable pattern</title>'+
    '<style>@page{size:letter portrait;margin:13mm}body{font:12px/1.5 Arial,sans-serif;color:#15131b}h1{font-size:24px}h2{font-size:17px;margin-bottom:3px}.sheet{break-before:page;page-break-before:always}.sheet svg{display:block;max-width:100%;height:auto;max-height:230mm}pre{font:11px/1.65 monospace;white-space:pre-wrap;overflow-wrap:anywhere}p{margin:6px 0 14px}.key span{display:inline-flex;align-items:center;margin:6px 12px 6px 0}.key b{display:inline-block;width:19px;height:19px;border:1px solid #888;margin-right:6px}.sheet h2{margin-top:4px}.first{break-after:page;page-break-after:always}</style></head><body>'+
    '<section class="first"><h1>'+escapeHTML(s.name)+'</h1><p>Worked in the round · '+d.stitches+' stitches · '+d.rounds+' rounds · est. '+d.actualCircumference.toFixed(1)+' in around × '+d.actualHeight.toFixed(1)+' in tall</p><p>Measured gauge: '+s.stitches4+' stitches and '+s.rounds4+' rounds / 4 in. Swatch before knitting.</p><div class="key">'+keyHtml+'</div><p>K = knit; P = purl; number indicates color. White dots on charts indicate purl stitches.</p><p>Charts are divided into numbered stitch and round ranges to keep the squares readable. Follow rounds bottom-up, reading each row right to left.</p><p>This is a generated, untested pattern. Check floats, gauge, and fit.</p></section>'+
    chunks+'<section class="sheet"><h2>Written round instructions</h2><pre>'+escapeHTML(md)+'</pre></section></body></html>';
}
$("downloadPdf").addEventListener("click",()=>{
  const win=window.open("","_blank");
  if(!win){status("Allow a print window for PDF export, then choose Save as PDF.");return;}
  win.document.open();win.document.write(printHTML());win.document.close();
  win.addEventListener("load",()=>{win.focus();win.print();},{once:true});
  status("Print view opened. Choose Save as PDF in the print dialog.");
});
populateSaved();hydrate();render();
