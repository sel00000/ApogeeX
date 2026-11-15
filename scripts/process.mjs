import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', windowsHide: true, ...options });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} failed (${code ?? signal}).`)));
  });
}
export const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
export function npm(args, options = {}) {
  const cli = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (existsSync(cli)) return run(process.execPath, [cli, ...args], options);
  return run(npmCommand, args, { shell: process.platform === 'win32', ...options });
}
