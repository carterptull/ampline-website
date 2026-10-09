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
const port = Number(process.env.PORT) || 4173;

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(normalize(ROOT))) { res.writeHead(403).end(); return; }
  for (const { key, value } of globalHeaders) res.setHeader(key, value);
  try {
    const target = (await stat(file).catch(() => null))?.isFile() ? file
      : (await stat(file + '.html').catch(() => null))?.isFile() ? file + '.html' : null;
    if (!target) { res.writeHead(404, { 'content-type': TYPES['.html'] }); res.end(await readFile(join(ROOT, '404.html'))); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(target));
  } catch { res.writeHead(500).end(); }
}).listen(port, () => console.log(`ampline-website dev server: http://localhost:${port} (production headers applied)`));
