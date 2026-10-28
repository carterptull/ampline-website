import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';

const SERVE = fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url));
const port = 20000 + Math.floor(Math.random() * 30000);
let child;
let out = '';

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
  child = spawn(process.execPath, [SERVE], { env: { ...process.env, PORT: String(port), HOST: '' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    child.once('exit', (code) => reject(new Error(`dev server exited early (${code})`)));
    child.stdout.on('data', (d) => { out += String(d); if (out.includes('dev server')) resolve(); });
  });
});

after(() => { child?.kill(); });

test('every response carries the explicit HSTS header, without includeSubDomains or preload (D20)', async () => {
  for (const p of ['/', '/nope']) {
    const r = await get(p);
    assert.equal(r.headers['strict-transport-security'], 'max-age=31536000', p);
  }
});

test('GET / is 200 with the CSP header', async () => {
  const r = await get('/');
  assert.equal(r.status, 200);
  assert.ok(r.headers['content-security-policy']);
  assert.equal(r.headers['cache-control'], 'no-store');
});

test('GET / lets only the portfolio frame the site', async () => {
  const csp = (await get('/')).headers['content-security-policy'];
  assert.ok(csp.includes('frame-ancestors https://cartertull.com https://www.cartertull.com'));
  assert.ok(!csp.includes("frame-ancestors 'none'"));
});

test('path-specific vercel.json cache headers apply (fonts immutable, icons a day)', async () => {
  const font = await get('/assets/fonts/mono-400.v2.woff2');
  assert.equal(font.status, 200);
  assert.equal(font.headers['cache-control'], 'public, max-age=31536000, immutable');
  assert.ok(font.headers['content-security-policy']);
  for (const p of ['/og.png', '/favicon.ico', '/icon.svg', '/apple-touch-icon.png']) {
    const r = await get(p);
    assert.equal(r.status, 200, p);
    assert.equal(r.headers['cache-control'], 'public, max-age=86400', p);
  }
  assert.equal((await get('/js/main.js')).headers['cache-control'], 'no-store');
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

test('binds to localhost by default and says so in the log line', () => {
  assert.ok(out.includes(`http://127.0.0.1:${port}`), out);
  assert.ok(out.includes('(production headers applied)'), out);
});
