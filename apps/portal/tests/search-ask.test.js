// The search box's language-model fallback seen from the portal: the disclosure in the credits dialog and the
// way the portal hands the configured address to the search package.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import en from '../i18n/en.js';
import ko from '../i18n/ko.js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('credits dialog discloses the search fallback in both languages with the agreed texts', () => {
  assert.equal(en['credits.p5'], 'Search: names and coordinates are handled by our own search engine inside your browser. Only when it cannot understand a sentence, and only if this site is configured with a helper address, the sentence is sent to a small language model (Llama 3.1 8B on Cloudflare Workers AI) that returns a search plan and nothing else. The model never supplies objects, positions or numbers; SIMBAD supplies them. Results found this way are labelled as AI-interpreted candidates.');
  assert.equal(ko['credits.p5'], "검색: 이름과 좌표는 브라우저 안의 자체 검색엔진이 처리합니다. 자체 엔진이 문장을 이해하지 못하고 이 사이트에 도우미 주소가 설정되어 있을 때만, 그 문장을 작은 언어 모델(Llama 3.1 8B, Cloudflare Workers AI)에 보내 검색 계획만 돌려받습니다. 모델은 천체·위치·숫자를 말하지 않으며, 그것들은 SIMBAD가 줍니다. 이렇게 찾은 결과에는 'AI 해석 후보' 표시가 붙습니다.");
  const dialog = /<dialog id="credits-dialog">[\s\S]*?<\/dialog>/.exec(html)?.[0] ?? '';
  assert.ok(dialog.includes(`<p data-i18n="credits.p5">${en['credits.p5']}</p>`), 'first paint is the English text, inside the credits dialog');
  assert.equal(html.split('data-i18n="credits.p5"').length, 2, 'one paragraph only');
});

test('the portal reads config.json once and passes askUrl to mountSearch only when it is a non-empty string', async () => {
  const body = /function readSearchConfig\(\)\{([\s\S]*?)\n\}/.exec(app)?.[1];
  assert.ok(body, 'readSearchConfig exists');
  assert.match(app, /const \[\{mountSearch\},askOption\]=await Promise\.all\(\[searchLoading,readSearchConfig\(\)\]\);/);
  assert.match(app, /mountSearch\(host,\{onSelect:selectedSearch,indexUrl:[^}]*\.\.\.askOption\}\)/);
  // Run the helper body against fake fetches: the same code the page runs.
  const run = async (fetchImpl) => {
    let calls = 0;
    const fetch = async (...args) => { calls++; return fetchImpl(...args); };
    const make = new Function('fetch', 'document', `let searchConfig=null;function readSearchConfig(){${body}\n}return readSearchConfig;`);
    const read = make(fetch, {baseURI: 'https://site.example/'});
    const first = await read(); const second = await read();
    assert.strictEqual(first, second);
    return {value: first, calls};
  };
  const response = (value, ok = true) => ({ok, json: async () => value});
  assert.deepEqual(await run(async () => response({askUrl: 'https://ask.example/api/ask'})), {value: {askUrl: 'https://ask.example/api/ask'}, calls: 1});
  for (const config of [{askUrl: ''}, {askUrl: '   '}, {}, {askUrl: 42}, {askUrl: null}, null]) {
    assert.deepEqual(await run(async () => response(config)), {value: {}, calls: 1}, JSON.stringify(config));
  }
  assert.deepEqual(await run(async () => response({askUrl: 'https://ask.example/api/ask'}, false)), {value: {}, calls: 1});
  assert.deepEqual(await run(async () => { throw new TypeError('offline'); }), {value: {}, calls: 1});
  assert.deepEqual(await run(async () => ({ok: true, json: async () => { throw new SyntaxError('bad'); }})), {value: {}, calls: 1});
});
