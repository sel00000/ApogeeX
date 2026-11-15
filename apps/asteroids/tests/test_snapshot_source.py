"""Source layout can change without changing historical commit reproduction."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

APP = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('snapshot_source', APP / 'scripts/snapshot_source.py')
snapshot_source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot_source)


class SnapshotSourceTests(unittest.TestCase):
    def setUp(self):
        work = APP / '.test-work'
        work.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=work)
        self.addCleanup(self.temp.cleanup)

    def check_layout(self, prefix, explicit):
        calls = []
        commit = 'a' * 40
        files = {
            prefix + 'asteroids.sqlite': b'database fixture',
            prefix + '433/integrated_record.json': b'{"asteroid_id":"433"}',
            prefix + '433/unneeded.csv': b'not part of the input snapshot',
        }

        def git(command):
            args = command[3:]
            calls.append(args)
            if args[0] == 'rev-parse':
                return commit.encode()
            if args[0] == 'ls-tree':
                self.assertEqual(args[-1], prefix)
                return ('\0'.join(files) + '\0').encode('utf-8')
            self.assertEqual(args[0], 'show')
            return files[args[1].split(':', 1)[1]]

        with patch.object(snapshot_source, 'ROOT', Path(self.temp.name)), patch.object(snapshot_source.subprocess, 'check_output', side_effect=git):
            options = {'prefix': prefix} if explicit else {}
            actual, destination = snapshot_source.snapshot('test-ref', **options)
        self.assertEqual(actual, commit)
        self.assertEqual((destination / 'asteroids.sqlite').read_bytes(), b'database fixture')
        self.assertTrue((destination / '433/integrated_record.json').is_file())
        self.assertFalse((destination / '433/unneeded.csv').exists())

    def test_default_uses_v5_layout(self):
        self.check_layout('data/prepared/asteroids/', False)

    def test_historical_layout_can_be_explicit(self):
        self.check_layout('지호/spherex-asteroid-analysis/outputs/', True)

    def test_rejects_non_relative_prefixes(self):
        for prefix in ('', '.', '../outputs/', '/outputs/', 'C:/outputs/', 'data\\outputs/'):
            with self.subTest(prefix=prefix), self.assertRaises(ValueError):
                snapshot_source.source_prefix(prefix)

    def test_missing_database_rejected_before_writing(self):
        with patch.object(snapshot_source, 'ROOT', Path(self.temp.name)), patch.object(snapshot_source.subprocess, 'check_output', side_effect=[b'a' * 40, b'data/prepared/asteroids/433/integrated_record.json\0']):
            with self.assertRaisesRegex(ValueError, 'no asteroid database'):
                snapshot_source.snapshot('test-ref')
        self.assertFalse((Path(self.temp.name) / '.cache').exists())


if __name__ == '__main__':
    unittest.main()
