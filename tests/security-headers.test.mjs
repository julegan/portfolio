import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('static responses have a conservative global header rule', () => {
  const source = read('dist/_headers');
  const blocks = source.split(/\r?\n/);
  const start = blocks.findIndex((line) => line.trim() === '/*');
  assert.notEqual(start, -1, 'Missing global /* rule');
  const headers = new Map();
  for (const line of blocks.slice(start + 1)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) break; // next URL rule
    const match = line.match(/^\s+([A-Za-z][A-Za-z-]*):\s*(.+)$/);
    assert.ok(match, `Malformed header: ${line}`);
    assert.ok(!headers.has(match[1].toLowerCase()), `Duplicate header: ${match[1]}`);
    headers.set(match[1].toLowerCase(), match[2].trim());
  }

  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  const permissions = headers.get('permissions-policy') || '';
  for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
    assert.match(permissions, new RegExp(`(?:^|, )${feature}=\\(\\)(?:,|$)`));
  }
  assert.ok(!headers.has('strict-transport-security'), 'Do not set HSTS until HTTPS and domain aliases are audited');
  assert.ok(!headers.has('content-security-policy'), 'Add enforcing CSP only after reviewing inline scripts and project integrations');
});

test('third-party GitHub Actions must use immutable, full-length commit IDs', () => {
  const workflows = readdirSync(join(root, '.github/workflows'))
    .filter((name) => /\.ya?ml$/.test(name));
  assert.ok(workflows.includes('security.yml'));
  for (const name of workflows) {
    const content = read(`.github/workflows/${name}`);
    assert.match(content, /^permissions:/m, `Missing explicit token permissions: ${name}`);
    for (const match of content.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)) {
      const target = match[1];
      if (target.startsWith('./')) continue;
      assert.match(target, /^[-\w./]+@[a-f0-9]{40}$/, `Unpinned external Action in ${name}: ${target}`);
    }
  }
});

test('validation-only workflows use read-only repository access', () => {
  for (const name of ['accessibility.yml', 'tubes.yml', 'security.yml']) {
    assert.match(read(`.github/workflows/${name}`), /^permissions:\s*\n  contents: read$/m, `${name} should not have write access`);
  }
  const sync = read('.github/workflows/sync-shows.yml');
  assert.match(sync, /^  contents: write$/m, 'Sync needs write access to propose an editorial PR');
  assert.match(sync, /^  pull-requests: write$/m);
});
