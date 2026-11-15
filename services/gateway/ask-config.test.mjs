import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSiteServer, listenOnAvailablePort } from './server.mjs';

async function configFrom(options) {
  const dir = await mkdtemp(join(tmpdir(), 'spherex-ask-config-'));
  await writeFile(join(dir, 'index.html'), '<!doctype html>');
  const server = createSiteServer({ webRoot: dir, ...options });
  try {
    const port = await listenOnAvailablePort(server, { port: 0 });
    const response = await fetch(`http://127.0.0.1:${port}/config.json`);
    assert.equal(response.status, 200);
    return await response.json();
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

test('local /config.json hands out an empty search helper address by default', async () => {
  const config = await configFrom({});
  assert.equal(config.askUrl, '');
});

test('local /config.json hands out the configured search helper address', async () => {
  const config = await configFrom({ askUrl: 'http://127.0.0.1:4391/api/ask' });
  assert.equal(config.askUrl, 'http://127.0.0.1:4391/api/ask');
  assert.equal(config.localServices, true);
});
