"""Read committed asteroid inputs without changing the shared checkout.

The default prefix follows the v5 layout. Historical commits need an explicit
--prefix matching the layout at that commit.
"""
import argparse
import subprocess
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
PREFIX = 'data/prepared/asteroids/'

def source_prefix(value):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or '..' in path.parts or '\\' in value or ':' in value or not path.parts:
        raise ValueError('Source prefix must be a relative Git directory without traversal')
    return path.as_posix().rstrip('/') + '/'

def snapshot(ref, prefix=PREFIX, repo=REPO):
    prefix = source_prefix(prefix)
    def git(*args):
        return subprocess.check_output(['git', '-C', str(repo), *args])
    commit = git('rev-parse', '--verify', ref + '^{commit}').decode().strip()
    destination = ROOT / '.cache' / ('source-' + commit) / 'outputs'
    paths = git('ls-tree', '-rz', '--name-only', commit, '--', prefix).decode('utf-8').split('\0')
    if prefix + 'asteroids.sqlite' not in paths:
        raise ValueError('Source snapshot has no asteroid database at ' + prefix)
    for path in filter(None, paths):
        if not path.startswith(prefix):
            continue
        relative = Path(path.removeprefix(prefix))
        if len(relative.parts) > 2 or relative.name not in {
            'integrated_record.json', 'stage1_observations.csv',
            'stage2_spectrum.csv', 'asteroids.sqlite',
        }:
            continue
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(git('show', commit + ':' + path))
    if not (destination / 'asteroids.sqlite').is_file():
        raise ValueError('Source snapshot has no asteroid database')
    return commit, destination

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ref', help='Fetched Git commit or ref, for example origin/main')
    parser.add_argument('--prefix', default=PREFIX, help='Input directory inside the commit (default: %(default)s)')
    parser.add_argument('--repo', type=Path, default=REPO, help='Git checkout containing the fetched commit (default: project root)')
    args = parser.parse_args()
    commit, destination = snapshot(args.ref, args.prefix, args.repo)
    print(commit)
    print(destination)
