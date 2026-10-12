"""Create an isolated, consistent SQLite rehearsal copy; never migrate in place."""
import argparse
import hashlib
import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path


def prepare_copy(source, destination):
    source = Path(source).resolve(strict=True)
    destination = Path(destination).resolve()
    if destination == source or source in destination.parents:
        raise ValueError('La copia debe tener una ruta distinta de la base original.')
    # Exclusive creation: a repeated run must not overwrite another rehearsal.
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('xb'):
        pass
    report = {'source': str(source), 'copy': str(destination),
              'createdAtUtc': datetime.now(timezone.utc).isoformat(),
              'status': 'incomplete', 'tables': {}}
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as original:
        original.execute('PRAGMA query_only=ON')
        with closing(sqlite3.connect(destination)) as copied:
            original.backup(copied)
            integrity = copied.execute('PRAGMA integrity_check').fetchall()
            violations = copied.execute('PRAGMA foreign_key_check').fetchall()
            report['integrity'] = [row[0] for row in integrity]
            report['foreignKeyViolations'] = len(violations)
            if integrity != [('ok',)] or violations:
                raise ValueError('La copia no pasó la verificación de integridad; no importar.')
            tables = copied.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()
            for (table,) in tables:
                quoted = '"' + table.replace('"', '""') + '"'
                report['tables'][table] = {
                    'rows': copied.execute(f'SELECT COUNT(*) FROM {quoted}').fetchone()[0],
                    'columns': [row[1] for row in copied.execute(f'PRAGMA table_info({quoted})')]
                }
    with destination.open('rb') as snapshot:
        report['sha256'] = hashlib.file_digest(snapshot, 'sha256').hexdigest()
    report['status'] = 'verified-copy-not-connected'
    with destination.with_suffix('.manifest.json').open('x', encoding='utf-8') as output:
        json.dump(report, output, ensure_ascii=False, indent=2)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    print(json.dumps(prepare_copy(args.source, args.destination), ensure_ascii=False, indent=2))
