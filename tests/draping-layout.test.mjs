import test from 'node:test';
import assert from 'node:assert/strict';
import { mirrorLayout } from '../dist/projects/draping-mirror/mirror-layout.mjs';

test('responsive mirror keeps a proportional, fully visible portrait in narrow, wide and tall frames', () => {
  for (const [width,height] of [[390,350],[320,280],[1440,700],[390,1500],[256,360],[195,550]]) {
    const {portrait:p,pixelWidth,pixelHeight}=mirrorLayout(width,height);
    assert(p.x>=0 && p.y>=0 && p.x+p.width<=width && p.y+p.height<=height);
    assert(Math.abs(p.width/p.height-360/476)<1e-12);
    assert(Math.abs(p.x+p.width/2-width/2)<1e-9);
    assert(Math.abs(pixelWidth/pixelHeight-width/height)<.003);
  }
});

test('print composition retains its original resolution and large screens bound bitmap memory', () => {
  const print=mirrorLayout(480,600);
  assert.equal(print.pixelWidth,960);assert.equal(print.pixelHeight,1200);
  assert.deepEqual(print.portrait,{x:60,y:10,width:360,height:476});
  const large=mirrorLayout(8000,4500);
  assert.equal(large.pixelWidth,4096);assert(large.pixelHeight<=4096);
});
