import { describe, expect, it } from 'vitest'
import { errorText, pick } from './i18n'

const NO_SERVER = '현재 웹사이트에는 새 관측 자료를 처리하는 Python 분석 서버가 연결되어 있지 않습니다. 준비된 대상의 관측·분석 결과는 계속 볼 수 있습니다. 서버 연결 후 다시 시도하거나 로컬 프로그램에서 실행하세요.'

describe('errorText', () => {
  it('keeps the Korean message on a Korean screen', () => {
    expect(errorText(NO_SERVER, pick('ko'))).toBe(NO_SERVER)
  })
  it('gives English with no Korean letters on an English screen', () => {
    const en = errorText(NO_SERVER, pick('en'))
    expect(en).toMatch(/no Python analysis server/)
    expect(en).not.toMatch(/[가-힣]/)
  })
  it('carries the variable part through', () => {
    expect(errorText('서버 응답 HTTP 503', pick('en'))).toBe('Server response: HTTP 503')
    expect(errorText('관측 분석 서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요. (Failed to fetch)', pick('en'))).toBe('Could not reach the observation analysis server. Try again shortly. (Failed to fetch)')
  })
  it('leaves an unknown message as it is', () => {
    expect(errorText('IRSA TAP timeout', pick('en'))).toBe('IRSA TAP timeout')
  })
  it('covers every Korean message that lib/api.ts can throw', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync(new URL('./api.ts', import.meta.url), 'utf8')
    const literals = [...src.matchAll(/['`]([^'`\n]*[가-힣][^'`\n]*)['`]/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, '503'))
    expect(literals.length).toBeGreaterThan(5)
    for (const text of literals) expect(errorText(text, pick('en')), text).not.toMatch(/[가-힣]/)
  })
})
