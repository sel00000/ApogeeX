import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { projectRoot } from './paths.mjs';
import { findPython } from './python.mjs';
import { run } from './process.mjs';
let env = join(projectRoot, '.venv-science');
const legacy = join(projectRoot, '.venv-asteroid');
if (!(await access(env).then(() => true, () => false)) && await access(legacy).then(() => true, () => false)) env = legacy;
if (!(await access(env).then(() => true, () => false))) {
  const base = await findPython();
  if (!base) throw new Error('Install Python 3.11 or newer.');
  await run(base.executable, [...base.args, '-m', 'venv', env]);
}
const executable = join(env, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
await run(executable, ['-m', 'pip', 'install', '-r', join(projectRoot, 'services/asteroids/requirements.txt'), '-r', join(projectRoot, 'services/observations/requirements.txt')]);
console.log('Python analysis environment is ready.');
