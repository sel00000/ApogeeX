import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { projectRoot } from './paths.mjs';
export async function pythonCandidates(root = projectRoot) {
  if (process.env.SPHEREX_PYTHON) return [{ executable: process.env.SPHEREX_PYTHON, args: [] }];
  const result = [];
  for (const env of ['.venv-science', '.venv-asteroid']) {
    const file = join(root, env, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    if (await access(file).then(() => true, () => false)) result.push({ executable: file, args: [] });
  }
  if (process.platform === 'win32') result.push({ executable: 'py', args: ['-3'] });
  return [...result, { executable: 'python', args: [] }, { executable: 'python3', args: [] }];
}
export async function findPython({ imports = [], root = projectRoot } = {}) {
  for (const candidate of await pythonCandidates(root)) {
    const ok = await new Promise(resolve => {
      const child = spawn(candidate.executable, [...candidate.args, '-B', '-c', `import sys; assert sys.version_info >= (3,11); ${imports.length ? 'import ' + imports.join(',') : 'pass'}`], { windowsHide: true, stdio: 'ignore' });
      const timer = setTimeout(() => { child.kill(); resolve(false); }, 30000);
      child.once('error', () => { clearTimeout(timer); resolve(false); });
      child.once('exit', code => { clearTimeout(timer); resolve(code === 0); });
    });
    if (ok) return candidate;
  }
  return null;
}
