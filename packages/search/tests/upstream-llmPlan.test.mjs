// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// @ts-nocheck -- ported from the reference suite, which was plain JavaScript (node:test); the typed API is checked through the app code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_PROMPT, extractJson, validateModelPlan, parseCheckedPlan } from '../dist/core/llmPlan.js';
import { TYPES } from '../dist/core/plan.js';

test('prompt lists exactly the type keys of TYPES', () => {
  const m = /exactly one of these keys\):\n(.*)\n/.exec(SYSTEM_PROMPT);
  assert.ok(m);
  assert.deepEqual(m[1].split(', '), Object.keys(TYPES));
});

test('extractJson: plain, fenced, think block, text around, object passthrough, junk', () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJson('```json\n{"a":{"b":"}"}}\n```'), { a: { b: '}' } });
  assert.deepEqual(extractJson('<think>{"x":1}</think> sure: {"a":2} done'), { a: 2 });
  const o = { kind: 'none' };
  assert.equal(extractJson(o), o);
  for (const bad of ['', null, undefined, 'no braces', '{"a":', '{not json}']) assert.equal(extractJson(bad), null, String(bad));
});

test('validateModelPlan: each kind', () => {
  assert.deepEqual(validateModelPlan('{"kind":"name","name":" M 42 "}'), { ok: true, plan: { kind: 'name', name: 'M 42' } });
  assert.deepEqual(validateModelPlan({ kind: 'sso', name: '1P/Halley' }), { ok: true, plan: { kind: 'sso', name: '1P/Halley' } });
  assert.deepEqual(validateModelPlan('{"kind":"none","name":null}'), { ok: true, plan: { kind: 'none' } });
  const r = validateModelPlan('```json\n{"kind":"list","type":"white_dwarf","sort":"nearest","near":null,"limit":99}\n```');
  assert.deepEqual(r, { ok: true, plan: { kind: 'list', plan: { kind: 'list', type: 'white_dwarf', sort: 'nearest', near: null, limit: 20 } } });
  const n = validateModelPlan({ kind: 'list', type: 'globular_cluster', sort: 'weird', near: 'Sgr A*', limit: 'x' });
  assert.equal(n.ok, true);
  assert.deepEqual(n.plan.plan, { kind: 'list', type: 'globular_cluster', sort: 'famous', near: 'Sgr A*', limit: 10 });
});

test('validateModelPlan: rejections never echo model text', () => {
  const bad = [
    null, '', 'Roses are red, violets are blue', '[1,2]', '{"kind":"poem"}', '{"kind":"list","type":"pizza"}',
    '{"kind":"list","type":null}', '{"kind":"name","name":"M 42; DROP TABLE"}', '{"kind":"name","name":"안드로메다"}',
    { kind: 'name', name: 42 }, { kind: 'name', name: 'x'.repeat(61) }, { kind: 'list', type: 'star', near: "a'b\"; --" },
    { kind: 'list', type: '__proto__' }, { kind: 'list', type: 'toString' },
  ];
  for (const b of bad) {
    const r = validateModelPlan(b);
    assert.equal(r.ok, false, JSON.stringify(b));
    assert.ok(!/pizza|poem|DROP|Roses/.test(r.why));
  }
});

test('parseCheckedPlan accepts checked shapes only', () => {
  assert.deepEqual(parseCheckedPlan({ kind: 'name', name: 'Vega' }), { kind: 'name', name: 'Vega' });
  assert.equal(parseCheckedPlan({ kind: 'list', plan: { kind: 'list', type: 'nope' } }), null);
  assert.equal(parseCheckedPlan({ kind: 'name', name: '<script>' }), null);
  assert.equal(parseCheckedPlan('x'), null);
});

// E6: unused fields are null in the prompt, so a null limit must mean "not given".
test('validateModelPlan: limit null, undefined, zero, negative, non-finite or empty means the default of 10; a real number is clamped to 1..20', () => {
  const lim = (v, has = true) => {
    const q = { kind: 'list', type: 'galaxy', sort: 'famous', near: null };
    if (has) q.limit = v;
    const r = validateModelPlan(q);
    assert.equal(r.ok, true);
    return r.plan.plan.limit;
  };
  for (const v of [null, 0, -3, NaN, Infinity, -Infinity, '', ' ', 'x', false, true, [], {}, '0', '-2']) assert.equal(lim(v), 10, String(v));
  assert.equal(lim(undefined, false), 10);
  assert.equal(lim(1), 1);
  assert.equal(lim(0.4), 1);
  assert.equal(lim(7), 7);
  assert.equal(lim('5'), 5);
  assert.equal(lim(20), 20);
  assert.equal(lim(99), 20);
  const j = validateModelPlan('{"kind":"list","name":null,"type":"galaxy","sort":"famous","near":null,"limit":null}');
  assert.equal(j.plan.plan.limit, 10);
  assert.equal(parseCheckedPlan({ kind: 'list', plan: { kind: 'list', type: 'galaxy', sort: 'famous', near: null, limit: null } }).plan.limit, 10);
});
