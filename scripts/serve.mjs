import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../site/', import.meta.url));
const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const globalHeaders = vercel.headers.find((h) => h.source === '/(.*)').headers;
// Path-specific rules (the long cache on /assets/*, the day-long one on the icons), matched the way
// Vercel's path-to-regexp sources match: the source is a regex over the whole request path.
const pathRules = vercel.headers.filter((h) => h.source !== '/(.*)').map((h) => ({ re: new RegExp(`^${h.source}$`), headers: h.headers }));
const pathHeaders = (path) => Object.fromEntries(pathRules.filter((r) => r.re.test(path))
  .flatMap((r) => r.headers.map(({ key, value }) => [key.toLowerCase(), value])));
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || '127.0.0.1'; // localhost only unless HOST says otherwise

createServer(async (req, res) => {
  // Security headers go on every response, including 400/403/404/500.
  for (const { key, value } of globalHeaders) res.setHeader(key, value);
  try {
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(normalize(ROOT))) { res.writeHead(403).end(); return; }
    const target = (await stat(file).catch(() => null))?.isFile() ? file
      : (await stat(file + '.html').catch(() => null))?.isFile() ? file + '.html' : null;
    if (!target) {
      const body = await readFile(join(ROOT, '404.html')).catch(() => null);
      if (body) res.writeHead(404, { 'content-type': TYPES['.html'] }).end(body);
      else res.writeHead(404, { 'content-type': TYPES['.txt'] }).end('Not found');
      return;
    }
    const body = await readFile(target); // read first: a failure must not follow writeHead(200)
    // vercel.json's cache headers where it sets them; anything else is never cached while developing.
    res.writeHead(200, { 'content-type': TYPES[extname(target)] || 'application/octet-stream', 'cache-control': 'no-store', ...pathHeaders(path) }).end(body);
  } catch { if (!res.headersSent) res.writeHead(500).end(); else res.destroy(); }
}).listen(port, host, () => console.log(`ampline-website dev server: http://${host}:${port} (production headers applied)`));
