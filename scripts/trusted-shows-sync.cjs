"use strict";
// SHOWS source of truth is its reviewed canonical main branch. Only a small,
// additive trusted-original delta may bypass a second manual portfolio merge.
// All other changes go through the existing bot-authored review PR.
const fs=require("node:fs"),vm=require("node:vm");
const allowed=new Set(["jack-london-revue","alberta-rose-theatre"]);
function parse(code){
 if(typeof code!=="string"||!code.startsWith("window.SHOWS_DATASET")||code.length>6000000)
  throw Error("Missing or oversized SHOWS snapshot");
 const sandbox={window:{}};
 vm.runInNewContext(code,sandbox,{timeout:2500});
 const events=sandbox.window.SHOWS_EVENTS,meta=sandbox.window.SHOWS_DATASET;
 if(!Array.isArray(events)||!meta||meta.totalOccurrences!==events.length||events.length<1)
  throw Error("Unverified SHOWS event array");
 const ids=new Set();
 for(const e of events){
  if(typeof e?.id!=="string"||ids.has(e.id)||typeof e.title!=="string"||
   typeof e.venue!=="string"||!/^https:\/\//.test(e.url||"")||
   !/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d-0[78]:00$/.test(e.startsAt||""))
   throw Error("Invalid event identity or date in canonical SHOWS snapshot");
  ids.add(e.id);
 }
 return {events,meta};
}
function examine({current,canonical,max=12}){
 const older=parse(current),newer=parse(canonical);
 if(!Number.isInteger(max)||max<1||max>30)throw Error("Unreviewed maximum sync size");
 const byId=new Map(newer.events.map(e=>[e.id,e])),additions=[];
 for(const former of older.events){
  const latest=byId.get(former.id);
  if(!latest)return {safe:false,reason:"Approved listing was removed; manual review required",count:0};
  if(JSON.stringify(latest)!==JSON.stringify(former))
   return {safe:false,reason:"Approved listing was modified; manual review required",count:0};
 }
 const had=new Set(older.events.map(e=>e.id));
 for(const e of newer.events)if(!had.has(e.id))additions.push(e);
 if(!additions.length)return {safe:false,reason:"No new trusted original records",count:0};
 if(additions.length>max)return {safe:false,reason:"Trusted additions exceed conservative per-sync cap",count:additions.length};
 for(const e of additions){
  const trust=e.trustPublication;
  if(trust?.policyVersion!==1||trust.mode!=="trusted-original-addition"||
   !allowed.has(trust.sourceId)||trust.sourceId!==e.discovery?.sourceId||
   e.startTimeKind!=="show"||e.artwork||e.sourceArtworkUrl||
   e.free!==null||e.age!=="Not published"||
   !Array.isArray(e.sources)||e.sources.length!==1)
   return {safe:false,reason:"New event lacks trusted original proof or carries unresolved rights/details",count:additions.length};
 }
 return {safe:true,reason:"Only new original-source trusted records; all existing portfolio listings unchanged",count:additions.length};
}
function cli(){
 if(process.argv.length!==5)throw Error("Expected current snapshot, canonical snapshot and decision output paths");
 const result=examine({current:fs.readFileSync(process.argv[2],"utf8"),
  canonical:fs.readFileSync(process.argv[3],"utf8")});
 fs.writeFileSync(process.argv[4],JSON.stringify(result,null,2)+"\n");
 console.log("PORTFOLIO TRUSTED SHOWS SYNC "+JSON.stringify(result));
}
if(require.main===module)try{cli()}catch(e){console.error("TRUSTED PORTFOLIO SYNC FAILED CLOSED: "+e.message);process.exitCode=1;}
module.exports={parse,examine};