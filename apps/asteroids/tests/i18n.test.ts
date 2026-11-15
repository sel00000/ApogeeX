import {describe, it, expect, afterEach} from 'vitest';
import {TABLES, STATUS_PHRASES, bodyName, setLang, statusPhrase, t, LocalError} from '../src/i18n';
import observations from '../public/data/observations.json';
import comparisons from '../public/data/comparisons.json';
import sequences from '../public/data/sequences.json';
import bodies from '../public/data/bodies.json';

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
afterEach(() => setLang('en'));

describe('language tables', () => {
  it('have identical keys in English and Korean', () => {
    expect(Object.keys(TABLES.ko).sort()).toEqual(Object.keys(TABLES.en).sort());
  });
  it('use the same placeholders and no empty text', () => {
    for (const key of Object.keys(TABLES.en) as (keyof typeof TABLES.en)[]) {
      expect(vars(TABLES.ko[key]), key).toEqual(vars(TABLES.en[key]));
      expect(TABLES.en[key].length, key).toBeGreaterThan(0);
      expect(TABLES.ko[key].length, key).toBeGreaterThan(0);
    }
  });
  it('have no Hangul in English', () => {
    for (const [key, value] of Object.entries(TABLES.en)) expect(HANGUL.test(value), key).toBe(false);
  });
  it('default to English and switch to Korean', () => {
    expect(t('o.sky')).toBe('Milky Way background');
    setLang('ko');
    expect(t('o.sky')).toBe('은하수 배경');
    expect(t('ws.target', {t: '433'})).toBe('대상 433');
  });
  it('localised errors follow the current language', () => {
    const error = new LocalError('math.range');
    expect(error.message).toBe('Outside the ephemeris range');
    setLang('ko');
    expect(error.message).toBe('천체력 범위를 벗어났습니다');
  });
});

describe('status phrases from the data files', () => {
  const found = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
      if ((k === 'availabilityReason' || k === 'positionStatus') && typeof x === 'string' && HANGUL.test(x)) found.add(x);
      walk(x);
    }
  };
  walk(observations); walk(comparisons); walk(sequences);
  it('every Korean phrase in the data has a mapping', () => {
    expect(found.size).toBeGreaterThan(0);
    for (const phrase of found) expect(STATUS_PHRASES, phrase).toContain(phrase);
  });
  it('maps to English, keeps Korean as it is, passes unknown phrases unchanged', () => {
    expect(statusPhrase('측광 품질 WARN · 영상 미준비')).toBe('Photometry quality WARN · image not ready');
    expect(statusPhrase('대표 영상 선별 범위 밖')).toBe('Outside the representative image selection');
    expect(statusPhrase('측광 후보 · 독립 검출 확정 아님')).toBe('Photometry candidate · not a confirmed independent detection');
    for (const phrase of STATUS_PHRASES) expect(HANGUL.test(statusPhrase(phrase))).toBe(false);
    expect(statusPhrase('503 Server Error')).toBe('503 Server Error');
    setLang('ko');
    for (const phrase of STATUS_PHRASES) expect(statusPhrase(phrase)).toBe(phrase);
  });
});

describe('body names', () => {
  it('planets get English names, asteroid designations stay', () => {
    const planets = (bodies as {id: string; name: string; kind: string}[]).filter(b => b.kind === 'planet');
    expect(planets.map(bodyName)).toEqual(['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']);
    expect(bodyName({id: '10', name: '10 Hygiea', kind: 'asteroid'})).toBe('10 Hygiea');
    setLang('ko');
    expect(planets.map(bodyName)).toEqual(planets.map(b => b.name));
  });
});
