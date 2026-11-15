"""Serve the verified static build without npm; binds only to localhost."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import functools, webbrowser, sys
class FreshBuildHandler(SimpleHTTPRequestHandler):
 def do_GET(self):
  # A rebuild can replace index.html within the browser's cache lifetime.
  if 'If-Modified-Since' in self.headers: del self.headers['If-Modified-Since']
  super().do_GET()
 def end_headers(self):
  self.send_header('Cache-Control','no-store')
  super().end_headers()
root=Path(__file__).resolve().parents[1]/'dist'
if not (root/'index.html').exists(): raise SystemExit('먼저 npm ci && npm run build를 실행하세요.')
for port in range(8710,8730):
 try:
  server=ThreadingHTTPServer(('127.0.0.1',port),functools.partial(FreshBuildHandler,directory=str(root)));break
 except OSError: continue
else: raise SystemExit('사용 가능한 로컬 포트가 없습니다.')
url=f'http://127.0.0.1:{port}/';print(url,flush=True)
if '--no-open' not in sys.argv:webbrowser.open(url)
try: server.serve_forever()
except KeyboardInterrupt: server.server_close()
