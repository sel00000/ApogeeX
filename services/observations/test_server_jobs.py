"""Offline regression checks for queue, failure semantics and service boundary."""
import json
import os
import queue
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch
from http.server import ThreadingHTTPServer
import server as api


class PatchJobs(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        for target, value in [('PATCH_DIR', Path(self.tmp.name)), ('CACHE_DIR', Path(self.tmp.name) / 'cache'), ('last_pruned', time.time()), ('jobs', {}), ('work', queue.Queue(maxsize=2))]:
            helper = patch.object(api, target, value)
            helper.start()
            self.addCleanup(helper.stop)
        helper = patch.object(api, 'missing_dependencies', return_value=[])
        helper.start()
        self.addCleanup(helper.stop)
        self.coords = (222.86602, -11.90753, .125)
        self.pid = api.patch_id(*self.coords)

    def write_meta(self, status, visits=None, age=0):
        path = api.PATCH_DIR / self.pid / 'meta.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(dict(status=status, visits=visits or [], status_detail='upstream timeout')), encoding='utf-8')
        os.utime(path, (time.time() - age, time.time() - age))

    def test_failed_job_remains_terminal_until_retry(self):
        api.jobs[self.pid] = dict(status='failed', message='IRSA timeout')
        self.assertEqual(api.patch_status(*self.coords)['status'], 'failed')
        self.assertTrue(api.work.empty())
        self.assertEqual(api.patch_status(*self.coords, retry=True)['status'], 'queued')
        self.assertEqual(api.work.qsize(), 1)
        self.assertEqual(api.patch_status(*self.coords, retry=True)['status'], 'queued')
        self.assertEqual(api.work.qsize(), 1)

    def test_cached_download_failure_is_not_no_data(self):
        self.write_meta('fetch_failed')
        result = api.patch_status(*self.coords)
        self.assertEqual(result['status'], 'fetch_failed')
        self.assertEqual(result['message'], 'upstream timeout')
        self.assertTrue(api.work.empty())

    def test_expired_no_data_is_refreshed(self):
        self.write_meta('no_data', age=api.EMPTY_TTL + 2)
        self.assertEqual(api.patch_status(*self.coords)['status'], 'queued')

    def test_fresh_success_reuses_complete_generation(self):
        self.write_meta('done', visits=[dict(f32='generations/abc/frames/v00.f32')])
        self.assertEqual(api.patch_status(*self.coords)['status'], 'done')
        self.assertTrue(api.work.empty())

    def test_queue_is_bounded_without_orphan_job(self):
        api.patch_status(1, 1, .1)
        api.patch_status(2, 1, .1)
        with self.assertRaises(api.JobError) as caught:
            api.patch_status(3, 1, .1)
        self.assertEqual(caught.exception.status, 429)
        self.assertEqual(len(api.jobs), 2)

    def test_invalid_coordinates_and_fields_rejected(self):
        for data in [dict(ra=float('nan'), dec=0), dict(ra=360, dec=0), dict(ra=True, dec=0), dict(ra=0, dec=91), dict(ra=0, dec=0, fov=.01)]:
            with self.subTest(data=data), self.assertRaises(api.JobError):
                api.validate_input(data)
        self.assertEqual(api.validate_input(dict(ra=0, dec=90, fov=.125)), (0, 90, .125))

    def test_different_field_widths_have_different_cache_keys(self):
        self.assertNotEqual(api.patch_id(1, 1, .125), api.patch_id(1, 1, .126))

    def test_cancelled_queued_job_does_not_load_science_pipeline(self):
        api.patch_status(*self.coords)
        api.cancel_job(self.pid)
        api.run_job(api.work.get_nowait())
        self.assertEqual(api.jobs[self.pid]['status'], 'cancelled')

    def test_retention_removes_old_inactive_data_and_preserves_active_jobs(self):
        self.write_meta('done', visits=[dict(f32='frames/v00.f32')], age=api.RETENTION_SECONDS + 2)
        folder = api.PATCH_DIR / self.pid
        old_time = time.time() - api.RETENTION_SECONDS - 2
        os.utime(folder, (old_time, old_time))
        api.jobs[self.pid] = dict(status='running')
        api.prune_runtime()
        self.assertTrue(folder.exists())
        api.jobs[self.pid] = dict(status='done')
        api.prune_runtime()
        self.assertFalse(folder.exists())

    def test_http_health_and_post_without_scientific_downloads(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), api.Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            with urllib.request.urlopen(base + '/api/observations/health') as response:
                self.assertTrue(json.load(response)['available'])
                self.assertIsNone(response.headers.get('Access-Control-Allow-Origin'))
            request = urllib.request.Request(base + '/api/observations/patch', data=json.dumps(dict(ra=1, dec=2, fov=.125)).encode(), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(request) as response:
                value = json.load(response)
                self.assertEqual(value['status'], 'queued')
                self.assertTrue(value['url'].startswith('/api/observations/data/patches/'))
            for suffix in ['/api/observations/data/patches/../secret.json', '/api/observations/data/patches/.private.json']:
                with self.assertRaises(urllib.error.HTTPError) as failure:
                    urllib.request.urlopen(base + suffix)
                self.assertEqual(failure.exception.code, 403)
            request = urllib.request.Request(base + '/api/health', headers={'Origin': 'https://untrusted.invalid'})
            with self.assertRaises(urllib.error.HTTPError) as failure:
                urllib.request.urlopen(request)
            self.assertEqual(failure.exception.code, 403)
        finally:
            server.shutdown()
            server.server_close()
            worker.join(timeout=2)


if __name__ == '__main__':
    unittest.main()
