// Tubes v1: deterministic, pure knitting-pattern model. Bottom round is index 0.
export const WEIGHTS = {
  lace:{label:"Lace",st:32,rows:44}, fingering:{label:"Fingering",st:28,rows:36},
  sport:{label:"Sport",st:24,rows:32}, dk:{label:"DK",st:22,rows:30},
  worsted:{label:"Worsted",st:20,rows:28}, bulky:{label:"Bulky",st:14,rows:20}
};
export const PALETTES = {
  electric:["#151a29","#efb84b","#ed5b95","#6de2d5","#a39cff","#f5e9d7"],
  garden:["#152923","#f1ce62","#e18d87","#79b39b","#c4a5dd","#f9f2df"],
  dusk:["#211c36","#a3b6fb","#f497b3","#f6c78b","#8ed1d8","#e7dff3"],
  graphic:["#141519","#faf9f1","#fa6a44","#6f93ff","#ffd755","#8dddca"]
};
export const DEFAULTS = {
  name:"My first tube", weight:"worsted", stitches4:20, rounds4:28,
  circumference:24, height:12, motifWidth:12, repeats:10,
  arrangement:"repeat", vertical:"repeat", design:"diamonds", complexity:2,
  colors:4, palette:"electric", texture:false, seed:20261029
};
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const int=(x,min,max,fallback)=>Number.isFinite(Number(x))?clamp(Math.round(Number(x)),min,max):fallback;
const num=(x,min,max,fallback)=>Number.isFinite(Number(x))?clamp(Number(x),min,max):fallback;
export function sanitizeSettings(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input)) throw Error("Invalid project settings.");
  const d=DEFAULTS;
  const pick=(x,options,def)=>options.includes(x)?x:def;
  return {
    name:typeof input.name==="string"?(input.name.trim().slice(0,80)||d.name):d.name,
    weight:pick(input.weight,Object.keys(WEIGHTS),d.weight),
    stitches4:num(input.stitches4,8,48,d.stitches4),
    rounds4:num(input.rounds4,10,65,d.rounds4),
    circumference:num(input.circumference,8,60,d.circumference),
    height:num(input.height,3,40,d.height),
    motifWidth:int(input.motifWidth,4,32,d.motifWidth),
    repeats:int(input.repeats,1,30,d.repeats),
    arrangement:pick(input.arrangement,["repeat","scene"],d.arrangement),
    vertical:pick(input.vertical,["repeat","once"],d.vertical),
    design:pick(input.design,["diamonds","chevrons","waves","speckles","landscape"],d.design),
    complexity:int(input.complexity,1,4,d.complexity),
    colors:int(input.colors,1,6,d.colors),
    palette:pick(input.palette,Object.keys(PALETTES),d.palette),
    texture:input.texture===true,
    seed:int(input.seed,0,2147483647,d.seed)
  };
}
export function dimensions(s){
  const stitches=s.arrangement==="repeat"
    ?s.motifWidth*s.repeats
    :Math.round(s.circumference*s.stitches4/4/2)*2;
  const rounds=clamp(Math.round(s.height*s.rounds4/4),6,400);
  if(stitches>240||rounds>200) throw Error("This design exceeds the v1 chart limit (240 stitches × 200 rounds). Reduce repeats, size, or gauge.");
  return {
    stitches,rounds,actualCircumference:stitches*4/s.stitches4,
    actualHeight:rounds*4/s.rounds4, repeatWidth:s.arrangement==="repeat"?s.motifWidth:stitches,
    repeatHeight:s.vertical==="repeat"?Math.min(rounds,12+s.complexity*4):rounds
  };
}
function hash(x,y,seed){
  let h=Math.imul(x+17,374761393)^Math.imul(y+53,668265263)^Math.imul(seed+1,1274126177);
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
}
function colorAt(s,d,x,r){
  if(s.colors===1)return 0;
  const w=d.repeatWidth, h=d.repeatHeight;
  const u=(x%w)/w,v=(r%h)/h;
  const complexity=s.complexity, jitter=hash(x,r,s.seed);
  let band=0;
  if(s.design==="diamonds"){
    const k=1+Math.floor(complexity/2);
    const a=Math.abs(((u*k)%1)*2-1),b=Math.abs(((v*k)%1)*2-1);
    band=Math.floor((a+b)*s.colors);
  }else if(s.design==="chevrons"){
    const a=Math.abs(((u*complexity+v*complexity*0.7)%1)*2-1);
    band=Math.floor(a*s.colors);
  }else if(s.design==="waves"){
    const wave=Math.sin((u*(1+complexity/2)+v*0.75)*Math.PI*2);
    band=Math.floor((wave+1)*s.colors/2);
  }else if(s.design==="speckles"){
    const scale=Math.max(1,5-complexity);
    band=Math.floor(hash(Math.floor(x/scale),Math.floor(r/scale),s.seed)*s.colors);
  }else{
    // Stylized wraparound landscape: hills, peaks, and stars, never a fake photo.
    const peak=.34+.16*Math.sin(u*2*Math.PI*2+0.5)+.07*Math.sin(u*2*Math.PI*5);
    if(v<peak)band=2;else if(v<peak+.1)band=1;
    else if(jitter>0.988)band=s.colors-1;
    else band=0;
  }
  if(s.design!=="landscape"&&complexity===4&&jitter>.96)band+=1;
  return ((band%s.colors)+s.colors)%s.colors;
}
export function makeGrid(s,overrides=[]){
  const d=dimensions(s),grid=[];
  for(let r=0;r<d.rounds;r++){
    const row=[];
    for(let c=0;c<d.stitches;c++){
      const x=s.arrangement==="repeat"?c%s.motifWidth:c;
      const rr=s.vertical==="repeat"?r%d.repeatHeight:r;
      const p=s.texture&&((Math.floor(x/Math.max(2,6-s.complexity))+
        Math.floor(rr/Math.max(2,6-s.complexity)))%3===0);
      row.push({color:colorAt(s,d,x,rr),stitch:p?"p":"k"});
    }
    grid.push(row);
  }
  for(const o of overrides){
    if(o&&Number.isInteger(o.r)&&Number.isInteger(o.c)&&o.r>=0&&o.r<d.rounds&&o.c>=0&&o.c<d.stitches){
      grid[o.r][o.c]={color:int(o.color,0,s.colors-1,0),stitch:o.stitch==="p"?"p":"k"};
    }
  }
  return {grid,dimensions:d};
}
export function newProject(){return {version:1,settings:{...DEFAULTS},overrides:[]};}
export function normalizeProject(data){
  if(!data||typeof data!=="object"||data.version!==1)throw Error("Not a supported Tubes v1 project.");
  const settings=sanitizeSettings(data.settings);
  const d=dimensions(settings);
  if(!Array.isArray(data.overrides)||data.overrides.length>20000)throw Error("Invalid stitch edits.");
  const edits=new Map();
  for(const o of data.overrides){
    if(!o||!Number.isInteger(o.r)||!Number.isInteger(o.c)||o.r<0||o.r>=d.rounds||o.c<0||o.c>=d.stitches
      ||!Number.isInteger(o.color)||o.color<0||o.color>=settings.colors||!["k","p"].includes(o.stitch))
      throw Error("Project contains an invalid stitch edit.");
    edits.set(o.r+":"+o.c,{r:o.r,c:o.c,color:o.color,stitch:o.stitch});
  }
  return {version:1,settings,overrides:[...edits.values()]};
}
export function summarizeRow(row){
  const out=[];
  for(const cell of row){
    const symbol=(cell.stitch==="p"?"P":"K")+(cell.color+1);
    if(out.length&&out[out.length-1].symbol===symbol)out[out.length-1].count++;
    else out.push({symbol,count:1});
  }
  return out.map(x=>x.count===1?x.symbol:x.symbol+" ×"+x.count).join(", ");
}
export function maxFloat(grid,colorCount){
  let max=0;
  for(const row of grid){
    for(let color=0;color<colorCount;color++){
      const used=[];
      for(let c=0;c<row.length;c++)if(row[c].color===color)used.push(c);
      if(used.length===0||used.length===row.length)continue;
      for(let i=0;i<used.length;i++){
        const a=used[i],b=used[(i+1)%used.length]+(i===used.length-1?row.length:0);
        max=Math.max(max,b-a-1);
      }
    }
  }
  return max;
}
export function patternMarkdown(project,model){
  const s=project.settings,d=model.dimensions,g=model.grid;
  const colors=PALETTES[s.palette].slice(0,s.colors);
  const rows=g.map((row,i)=>"Round "+(i+1)+": "+summarizeRow(row));
  return [
    "# "+s.name,"","Generated with Tubes v1 — worked in the round, bottom up.","",
    "## Gauge and size",
    "- Yarn category: "+WEIGHTS[s.weight].label+" (suggestion, not a substitute for a swatch)",
    "- Measured gauge: "+s.stitches4+" stitches and "+s.rounds4+" rounds / 4 in",
    "- Cast on: "+d.stitches+" stitches; join without twisting and mark beginning of round",
    "- Estimated finished circumference: "+d.actualCircumference.toFixed(2)+" in (target "+s.circumference+" in)",
    "- Estimated height: "+d.actualHeight.toFixed(2)+" in",
    "- Horizontal arrangement: "+(s.arrangement==="repeat"?s.repeats+" repeats of "+s.motifWidth+" stitches":"one continuous wraparound scene"),
    "- Vertical arrangement: "+(s.vertical==="repeat"?"repeating motif":"single design"),
    "","## Colors","",
    ...colors.map((color,i)=>"- C"+(i+1)+": "+color+" (choose your yarn equivalent)"),
    "","## Instructions","",
    "Cast on "+d.stitches+" stitches using your preferred stretchy method. Join for working in the round.",
    "Follow each round as listed below. K = knit, P = purl; number after K/P refers to color C1–C"+s.colors+".",
    "All rounds maintain the same stitch count. Bind off using a suitable stretchy method.",
    "","## Round-by-round","",...rows,"",
    "## Notes","",
    "- This is a generated design, not a gauge-tested pattern. Knit a swatch and check fit.",
    "- For stranded colorwork, manage long floats and yarn dominance. Longest computed unused-color span: "+maxFloat(g,s.colors)+" stitches.",
    "- No increases, decreases, cables, lace, shaping, or construction-specific finishing are included in v1.",
    "- Chart reads bottom-up, and every round reads right-to-left (Round 1 at bottom).",
    "- PNG/SVG charts are visual companions; the .tubes.json file is the editable source.",
    ""
  ].join("\n");
}
