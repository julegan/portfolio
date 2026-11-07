import assert from "node:assert/strict";
import {test} from "node:test";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {parse,examine}=require("../scripts/trusted-shows-sync.cjs");
const simple=(id,title)=>({
 id,title,venue:"Jack London Revue",startsAt:"2026-11-14T20:00:00-08:00",
 url:"https://www.jacklondonrevue.com/tm-event/"+id+"/",category:"Music",
 startTimeKind:"show",musicStyles:["Jazz"],age:"Not published",free:null,
 sources:[{name:"Jack London Revue",url:"https://www.jacklondonrevue.com/tm-event/"+id+"/"}],
 discovery:{sourceId:"jack-london-revue"},
 trustPublication:{policyVersion:1,mode:"trusted-original-addition",sourceId:"jack-london-revue"}
});
const old=simple("old","Old published show"),newer=simple("new","New corroborated show");
function snapshot(events){
 return "window.SHOWS_DATASET = "+JSON.stringify({totalOccurrences:events.length})+";\n"+
 "window.SHOWS_EVENTS = "+JSON.stringify(events)+";\n";
}
test("Exact additive trusted originals can deploy without another manual merge",()=>{
 const result=examine({current:snapshot([old]),canonical:snapshot([old,newer])});
 assert.equal(result.safe,true);assert.equal(result.count,1);
 assert.equal(parse(snapshot([old,newer])).events.length,2);
});
test("Previously published edits, removals and replaced IDs always require review",()=>{
 for(const canonical of [[{...old,title:"Changed title"},newer],[newer],[
  {...old,startsAt:"2026-11-15T20:00:00-08:00"},newer]]){
  assert.equal(examine({current:snapshot([old]),canonical:snapshot(canonical)}).safe,false);
 }
});
test("No unverified source is ever auto-published to the portfolio",()=>{
 const cases=[
  {...newer,trustPublication:undefined},
  {...newer,trustPublication:{policyVersion:2,mode:"trusted-original-addition",sourceId:"jack-london-revue"}},
  {...newer,trustPublication:{policyVersion:1,mode:"trusted-original-addition",sourceId:"black-water"}},
  {...newer,discovery:{sourceId:"other"}},
  {...newer,startTimeKind:"listed"},
  {...newer,artwork:{url:"https://example.org/unknown.jpg",usageApproved:null}},
  {...newer,free:true},
  {...newer,age:"All ages"},
  {...newer,sources:[]},
 ];
 for(const candidate of cases){
  const result=examine({current:snapshot([old]),canonical:snapshot([old,candidate])});
  assert.equal(result.safe,false,result.reason);
 }
});
test("Large catch-up batches, empty deltas and conflicting IDs fail closed",()=>{
 const many=Array.from({length:13},(_,i)=>simple("n"+i,"Show "+i));
 assert.equal(examine({current:snapshot([old]),canonical:snapshot([old,...many])}).safe,false);
 assert.equal(examine({current:snapshot([old]),canonical:snapshot([old])}).safe,false);
 assert.throws(()=>examine({current:snapshot([old]),canonical:snapshot([old,old])}),/Invalid event identity/);
});
