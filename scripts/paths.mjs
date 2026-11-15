import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function insideRoot(...parts) {
  const path = resolve(projectRoot, ...parts);
  if (!path.startsWith(projectRoot + sep)) throw new Error('Path must remain inside the project.');
  return path;
}
