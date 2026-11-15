import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeViewState, portalShareUrl } from '../src/view-state.js';

test('shared view retains explicit off layers, reverse playback and nested deployment', () => {
  const state = {lat:'37.5665',lon:'126.978',place:'seoul',frame:'equatorial',view:'sky',time:'2026-11-15T00:00:00Z',speed:'-10',fov:'12.1',yaw:'-179',pitch:'40',layers:''};
  const clean = sanitizeViewState(state);
  assert.equal(clean.get('layers'), ''); assert.equal(clean.get('speed'), '-10');
  const url = new URL(portalShareUrl(clean, 'https://example.test/project/planetarium/?embed=1'));
  assert.equal(url.pathname, '/project/'); assert.ok(url.hash.startsWith('#planetarium?'));
  const restored = sanitizeViewState(url.hash.slice('#planetarium?'.length));
  assert.equal(restored.toString(), clean.toString());
});

test('invalid coordinates never become origin, arbitrary configuration is ignored', () => {
  const clean = sanitizeViewState({ra:'',dec:'0',lat:'91',lon:'0',speed:'Infinity',time:'not a date',frame:'__proto__',layers:'dss,not-a-layer',src:'https://example.test/evil'});
  assert.equal(clean.toString(), 'layers=dss');
  assert.equal(sanitizeViewState({ra:'360',dec:'90'}).get('ra'), '0');
  assert.equal(sanitizeViewState({ra:'2'}).has('ra'), false);
});
