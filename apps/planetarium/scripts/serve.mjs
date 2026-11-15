import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = resolve(projectRoot, 'dist');
const args = process.argv.slice(2);
const portAt = args.indexOf('--port');
const port = Number(portAt === -1 ? (process.env.PORT || 4173) : args[portAt + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use --port with an integer from 1 to 65535.');
await stat(resolve(webRoot, 'index.html')).catch(() => { throw new Error('dist/index.html is missing. Run npm run build first.'); });

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.gz': 'application/gzip', '.zip': 'application/zip', '.xml': 'application/xml',
  '.csv': 'text/csv; charset=utf-8', '.yml': 'text/plain; charset=utf-8',
  '.yaml': 'text/plain; charset=utf-8', '.ps1': 'text/plain; charset=utf-8',
  '.c': 'text/plain; charset=utf-8', '.h': 'text/plain; charset=utf-8',
  '.cpp': 'text/plain; charset=utf-8', '.py': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method not allowed');
  }
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.includes('\0') || decoded.includes('\\')) throw Object.assign(new Error('Invalid path'), { statusCode: 400 });
    const relative = decoded.replace(/^\/+/, '');
    let path = resolve(webRoot, relative);
    if (path !== webRoot && !path.startsWith(webRoot + sep)) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    let info = await stat(path);
    if (info.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        res.writeHead(308, { Location: url.pathname + '/' + url.search });
        return res.end();
      }
      path = resolve(path, 'index.html');
      info = await stat(path);
    }
    if (!info.isFile()) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
    const type = types[extname(path).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(path).on('error', () => res.destroy()).pipe(res);
  } catch (error) {
    const code = error.statusCode || (['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : error instanceof URIError ? 400 : 500);
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(code === 404 ? 'Not found' : code === 400 ? 'Bad request' : code === 403 ? 'Forbidden' : 'Server error');
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Try npm run preview -- --port ${port + 1}` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`Local: ${url}\nPress Ctrl+C to stop.`);
  if (args.includes('--open')) {
    const executable = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const commandArgs = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
    const child = spawn(executable, commandArgs, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => console.log(`Open ${url} in your browser.`));
    child.unref();
  }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
