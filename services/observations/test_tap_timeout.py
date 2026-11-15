"""A silent TAP endpoint must not hold the only coordinate-job worker forever."""
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

import bake


class TapTimeout(unittest.TestCase):
    def test_pyvo_sync_query_respects_bounded_network_read(self):
        class SilentEndpoint(BaseHTTPRequestHandler):
            def do_POST(self):
                time.sleep(.3)
                self.send_response(200)
                self.end_headers()

            do_GET = do_POST

            def log_message(self, *args):
                pass

        host = ThreadingHTTPServer(('127.0.0.1', 0), SilentEndpoint)
        thread = threading.Thread(target=host.serve_forever, daemon=True)
        thread.start()
        try:
            with patch.object(bake, 'TAP_URL', f'http://127.0.0.1:{host.server_port}/tap'), patch.object(bake, 'TAP_HTTP_TIMEOUT', (.05, .05), create=True):
                started = time.monotonic()
                with self.assertRaisesRegex(Exception, '[Tt]ime.?out|[Tt]imed out'):
                    bake.tap().search('select 1 as value').to_table()
                self.assertLess(time.monotonic() - started, .25)
        finally:
            host.shutdown()
            host.server_close()
            thread.join(timeout=1)


if __name__ == '__main__':
    unittest.main()
