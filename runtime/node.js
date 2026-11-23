// Node server runtime: one tiny HTTP server that serves the api and the frontend.
// Zero dependencies: only node:http, node:fs and node:path.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createBackendR, instantiate, createBackend, MemoryStore, setRequestContext, ctxFromHeaders } from './core.js';

// Each request runs in its own context, so one user's AI key can never leak into another request.
const requestStore = new AsyncLocalStorage();
setRequestContext({ run: (ctx, fn) => requestStore.run(ctx, fn), get: () => requestStore.getStore() || null });

export class FileStore extends MemoryStore {
  constructor(name, M, file, root) {
    super(name, M);
    this.file = path.resolve(root, file);
    if (fs.existsSync(this.file)) {
      try { this.load(JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
      catch (e) { throw new Error(`Could not load ${file} for store ${name}: ${e.message}. Fix the file, or move it away to start empty.`); }
    }
  }
  async persist() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify([...this.items.values()], null, 2));
    fs.renameSync(tmp, this.file);
  }
}

// Reads .env. Real environment variables win over .env, as in most tools.
// Supports `export KEY=value`, quotes, and `# comments` after unquoted values.
export function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    const q = v.match(/^(["'])(.*)\1$/);
    if (q) v = q[2];
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]] = v;
  }
  return out;
}
export function loadEnv(root) {
  const file = path.join(root, '.env');
  const fromFile = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
  return { ...fromFile, ...process.env };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const CSP = "default-src 'self'; img-src 'self' data: https:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const MAX_BODY = 1_000_000; // bytes

export async function startServer({ root, dist, port, dev = false, quiet = false, buildId = String(Date.now()) }) {
  const env = loadEnv(root);
  const settings = {};
  const R = createBackendR({ env, settings });
  const prog = instantiate(fs.readFileSync(path.join(dist, 'server.js'), 'utf8'), R);
  Object.assign(settings, prog.app.settings);
  const backend = createBackend(prog, R, {
    dev,
    fetchImpl: globalThis.fetch,
    storeFactory: (name, M, file) => (file ? new FileStore(name, M, file, root) : new MemoryStore(name, M)),
    onError: (e, where) => console.error(`${c('31')}✗ ${where}: ${e.message}${c('0')}${dev && e.stack && !e.status ? '\n' + e.stack.split('\n').slice(1, 4).join('\n') : ''}`),
  });
  // Load file stores now, so a broken data file stops startup with a clear message
  // instead of failing every request later.
  for (const name of Object.keys(prog.stores)) backend.get(name);

  const reloadClients = new Set();
  const publicDir = path.join(dist, 'public');

  const server = http.createServer(async (req, res) => {
    const t0 = Date.now();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    let url, pathname;
    try { url = new URL(req.url, 'http://localhost'); pathname = decodeURIComponent(url.pathname); }
    catch { send(res, 400, { error: { code: 'bad_url', message: 'The request address is not valid.' } }); return; }
    const cleanPath = url.pathname.replace(/\/+$/, '') || '/';

    if (backend.routes.some((r) => r.re.test(cleanPath))) {
      let body = null;
      if (!['GET', 'HEAD', 'DELETE'].includes(req.method)) {
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY) { send(res, 413, { error: { code: 'too_large', message: 'Request body is larger than 1 MB.' } }); req.destroy(); return; }
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString('utf8');
        if (raw) {
          // JSON only: browsers can't send this content type cross-site without
          // permission (CORS preflight), which blocks cross-site request forgery.
          if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
            send(res, 415, { error: { code: 'bad_content_type', message: 'Send the request body as JSON with the header Content-Type: application/json.' } }); return;
          }
          try { body = JSON.parse(raw); } catch { send(res, 400, { error: { code: 'bad_json', message: 'Request body must be valid JSON.' } }); return; }
        }
      }
      const r = await backend.dispatch(req.method, url.pathname + url.search, body, ctxFromHeaders(req.headers));
      send(res, r.status, r.body);
      if (!quiet) console.log(`${color(r.status)}${req.method} ${url.pathname} ${r.status}${c('0')} ${c('2')}${Date.now() - t0}ms${c('0')}`);
      return;
    }
    if (dev && url.pathname === '/_cluub/reload') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      // Each build has an id; a browser that reconnects and sees a new id reloads.
      res.write(`data: ${buildId}\n\n`);
      reloadClients.add(res);
      req.on('close', () => reloadClients.delete(res));
      return;
    }
    let file = path.normalize(path.join(publicDir, pathname));
    if (!file.startsWith(publicDir)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(publicDir, 'index.html');
    const headers = { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': dev ? 'no-store' : 'public, max-age=300' };
    if (file.endsWith('.html')) headers['content-security-policy'] = CSP;
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });

  port = Number(port || settings.port || 3000);
  await new Promise((resolve, reject) => {
    server.once('error', (e) => reject(e.code === 'EADDRINUSE' ? new Error(`Port ${port} is already in use. Stop the other program or run with --port ${port + 1}.`) : e));
    server.listen(port, resolve);
  });
  return {
    server, port,
    close() { for (const cl of reloadClients) cl.end(); server.closeAllConnections?.(); return new Promise((r) => server.close(r)); },
  };
}

function send(res, status, body) {
  if (status === 204) { res.writeHead(204); res.end(); return; }
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
// Terminal colours, off when NO_COLOR is set or output is not a terminal.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
function c(code) { return useColor ? `\x1b[${code}m` : ''; }
function color(s) { return c(s >= 500 ? '31' : s >= 400 ? '33' : '32'); }
