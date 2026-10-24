import importlib.util
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

spec = importlib.util.spec_from_file_location('integration_copy', Path(__file__).parents[1] / 'scripts/prepare-integration-copy.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class IntegrationCopyTests(unittest.TestCase):
    def test_consistent_copy_includes_wal_and_never_overwrites_source_or_target(self):
        with tempfile.TemporaryDirectory() as directory:
            source, target = Path(directory) / 'source.db', Path(directory) / 'copy.db'
            with closing(sqlite3.connect(source)) as db:
                db.execute('PRAGMA journal_mode=WAL')
                db.execute('CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT)')
                db.execute("INSERT INTO sample VALUES (1, 'before')")
                db.commit()
                report = module.prepare_copy(source, target)
                self.assertEqual(report['tables']['sample']['rows'], 1)
                self.assertEqual(report['integrity'], ['ok'])
                with closing(sqlite3.connect(target)) as copied:
                    copied.execute("UPDATE sample SET value='copy only'")
                    copied.commit()
                self.assertEqual(db.execute('SELECT value FROM sample').fetchone()[0], 'before')
                with self.assertRaises(FileExistsError):
                    module.prepare_copy(source, target)
                with self.assertRaises(ValueError):
                    module.prepare_copy(source, source)


if __name__ == '__main__':
    unittest.main()
