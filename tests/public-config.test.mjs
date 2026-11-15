import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publicConfig, publicAskUrl, serviceAddress } from '../scripts/public-config.mjs';

test('public service settings keep deployment prefixes and exclude secrets', () => {
  assert.equal(serviceAddress(' https://api.example.org/skylab/ ', 'apiBase'), 'https://api.example.org/skylab');
  assert.equal(serviceAddress('/backend/', 'apiBase'), '/backend');
  assert.equal(serviceAddress('http://127.0.0.1:4173', 'apiBase'), 'http://127.0.0.1:4173');
  for (const value of ['https://user:secret@example.org', 'https://example.org/?token=secret', 'http://example.org', '//example.org', 'javascript:alert(1)']) {
    assert.throws(() => serviceAddress(value, 'apiBase'));
  }
});

test('checked-in endpoints are used and environment overrides do not enable local services', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spherex-config-'));
  try {
    await mkdir(join(dir, 'deployment'));
    await writeFile(join(dir, 'deployment/public.json'), JSON.stringify({ apiBase: 'https://api.example.org' }));
    const config = await publicConfig(dir, { SPHEREX_API_BASE: 'https://test.example.org/service/' });
    assert.equal(config.apiBase, 'https://test.example.org/service');
    assert.equal('experienceUrl' in config, false, 'the removed experience module has no address');
    assert.equal(config.localServices, false);
    await writeFile(join(dir, 'deployment/public.json'), '{invalid');
    await assert.rejects(publicConfig(dir, {}), SyntaxError);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the search helper address is optional, validated like the other services and overridden by SPHEREX_ASK_URL', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spherex-config-'));
  try {
    await mkdir(join(dir, 'deployment'));
    await writeFile(join(dir, 'deployment/public.json'), JSON.stringify({ apiBase: '' }));
    assert.equal((await publicConfig(dir, {})).askUrl, '');
    assert.equal(await publicAskUrl(dir, {}), '');
    await writeFile(join(dir, 'deployment/public.json'), JSON.stringify({ askUrl: '' }));
    assert.equal((await publicConfig(dir, {})).askUrl, '');
    await writeFile(join(dir, 'deployment/public.json'), JSON.stringify({ askUrl: 'https://ask.example.org/api/ask/' }));
    assert.equal((await publicConfig(dir, {})).askUrl, 'https://ask.example.org/api/ask');
    assert.equal(await publicAskUrl(dir, {}), 'https://ask.example.org/api/ask');
    const env = { SPHEREX_ASK_URL: 'http://127.0.0.1:4391/api/ask' };
    assert.equal((await publicConfig(dir, env)).askUrl, 'http://127.0.0.1:4391/api/ask');
    assert.equal(await publicAskUrl(dir, env), 'http://127.0.0.1:4391/api/ask');
    assert.equal((await publicConfig(dir, { SPHEREX_ASK_URL: '' })).askUrl, '', 'an empty variable switches the fallback off');
    for (const bad of ['http://ask.example.org/api/ask', 'https://ask.example.org/api/ask?key=secret', 'https://u:p@ask.example.org/api/ask', 42]) {
      await assert.rejects(publicConfig(dir, { SPHEREX_ASK_URL: bad }), /askUrl/);
      await assert.rejects(publicAskUrl(dir, { SPHEREX_ASK_URL: bad }), /askUrl/);
    }
    await writeFile(join(dir, 'deployment/public.json'), JSON.stringify({ askUrl: 'javascript:alert(1)' }));
    await assert.rejects(publicConfig(dir, {}), /askUrl/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the checked-in deployment file points the search helper at the team ask function', async () => {
  const saved = JSON.parse(await readFile(new URL('../deployment/public.json', import.meta.url), 'utf8'));
  assert.equal(saved.askUrl, 'https://trueblink.pages.dev/api/ask');
  assert.equal(serviceAddress(saved.askUrl, 'askUrl'), 'https://trueblink.pages.dev/api/ask');
});
