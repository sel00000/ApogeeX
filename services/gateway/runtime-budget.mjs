import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Runtime files only. Never follow a symlink/junction into source or user files. */
export async function runtimeBytes(root, stopAt = Infinity) {
  let total = 0, entries = 0;
  async function visit(path) {
    const info = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!info || info.isSymbolicLink()) return;
    if (info.isFile()) { total += info.size; return; }
    if (!info.isDirectory()) return;
    for (const child of await readdir(path)) {
      if (++entries > 100_000) throw Object.assign(Error('Runtime storage contains too many files.'), { status:507, code:'storage_limit' });
      await visit(join(path, child));
      if (total > stopAt) return;
    }
  }
  await visit(root); return total;
}

export async function requireRuntimeSpace(root, limit) {
  if (await runtimeBytes(root, limit) > limit) throw Object.assign(Error('This test server has reached its temporary storage limit. Wait for old results to expire and try again.'), { status:507, code:'storage_limit' });
}
