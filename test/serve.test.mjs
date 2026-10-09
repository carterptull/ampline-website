import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';

const SERVE = fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url));
const port = 20000 + Math.floor(Math.random() * 30000);
let child;

// Raw request so odd paths (e.g. "/%") reach the server exactly as written.
const get = (path) => new Promise((resolve, reject) => {
  const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
    res.resume();
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
  });
  req.on('error', reject);
  req.end();
});

before(async () => {
  child = spawn(process.execPath, [SERVE], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    child.once('exit', (code) => reject(new Error(`dev server exited early (${code})`)));
    child.stdout.on('data', (d) => { if (String(d).includes('dev server')) resolve(); });
  });
});

after(() => { child?.kill(); });

test('GET / is 200 with the CSP header', async () => {
  const r = await get('/');
  assert.equal(r.status, 200);
  assert.ok(r.headers['content-security-policy']);
  assert.equal(r.headers['cache-control'], 'no-store');
});

test('malformed percent-escape is a 400 with security headers', async () => {
  const r = await get('/%');
  assert.equal(r.status, 400);
  assert.ok(r.headers['content-security-policy']);
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
});

test('path traversal is a 403 with security headers', async () => {
  const paths = ['/..%2fpackage.json', '/..%2f..%2fpackage.json'];
  if (process.platform === 'win32') paths.push('/..%5cpackage.json');
  for (const p of paths) {
    const r = await get(p);
    assert.equal(r.status, 403, p);
    assert.ok(r.headers['content-security-policy'], p);
  }
});

test('unknown path is a 404 with security headers', async () => {
  const r = await get('/nope');
  assert.equal(r.status, 404);
  assert.ok(r.headers['content-security-policy']);
});

test('server survives all of the above', async () => {
  assert.equal(child.exitCode, null, 'dev server process died');
  const r = await get('/');
  assert.equal(r.status, 200);
});
