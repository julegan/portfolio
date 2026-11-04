import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {spawnSync} from "node:child_process";
const text=readFileSync(new URL("../.github/workflows/sync-shows.yml",import.meta.url),"utf8");
const section=(name)=>{
  const start=text.indexOf("      - name: "+name);
  assert(start>=0,"Missing workflow step "+name);
  const next=text.indexOf("      - name: ",start+1);
  return text.slice(start,next<0?undefined:next);
};
test("SYNC polls approved canonical main and maintains one rolling PR",()=>{
  assert.match(text,/cron: '47 \*\/2 \* \* \*'/);
  assert.match(text,/https:\/\/raw\.githubusercontent\.com\/julegan\/shows\/main\/events\.js/);
  const s=section("Create or refresh the single rolling portfolio publication PR");
  for(const expected of ["--force-with-lease=","gh pr create --head","gh pr close \"$number\"","gh pr view \"$number\" --json files","Refusing to overwrite a non-bot authored PR","automation/shows-sync-","git show \"$old_sha:$dest\"","git add -- \"$dest\" dist/projects/shows/index.html"]){
    assert(s.includes(expected),"Missing safe rolling PR behavior: "+expected);
  }
  assert(!s.includes("gh pr merge"),"Publishing must require owner merge");
  assert(!s.includes("git push origin main"),"No direct publishing");
  assert(!s.includes("if: steps.pending.outputs.skip"),"Pending PRs should be refreshed, not skipped");
});
test("The rolling shell workflow is syntactically valid",()=>{
  const s=section("Create or refresh the single rolling portfolio publication PR");
  const offset=s.indexOf("        run: |\n");
  assert(offset>=0);
  const script=s.slice(offset+"        run: |\n".length).split("\n")
    .map(line=>line.startsWith("          ")?line.slice(10):line).join("\n");
  const check=spawnSync("bash",["-n"],{input:script,encoding:"utf8"});
  assert.equal(check.status,0,check.stderr);
});
