import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1200 } })

async function csvOf(page: Page) {
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: '분석 CSV 내려받기' }).click()
  const d = await dl
  const chunks: Buffer[] = []
  for await (const c of (await d.createReadStream())!) chunks.push(c as Buffer)
  return { name: d.suggestedFilename(), text: Buffer.concat(chunks).toString('utf8') }
}

for (const id of ['rw_aur', 'r_dra']) {
  test(`${id}: variable analysis, honest quality filtering, actual A/B and export`, async ({ page }) => {
    test.slow()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`/?target=${id}&mode=research`)
    await expect(page.getByTestId('variable-lab')).toBeVisible()
    await expect(page.getByRole('img', { name: '좁은 파장 구간 광도 곡선', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '선택 자료의 밝음·어두움 찾기' }).click()
    await expect(page.getByTestId('variable-compare')).toContainText('B/A')
    const csv = await csvOf(page)
    expect(csv.name).toContain(id)
    if (id === 'r_dra') {
      await page.getByRole('button', { name: '주기로 접어 보기' }).click()
      await expect(page.getByTestId('phase-controls')).toContainText('245.6일')
      await expect(page.getByRole('img', { name: '위상 접기 광도 곡선' })).toBeVisible()
      await page.screenshot({ path: `docs/screenshots/${id}-variable-lab.png` })
      await page.getByLabel('변광 측정값').selectOption('flux')
      await page.getByLabel('변광 검출기').selectOption('6')
      await expect(page.getByTestId('variable-empty')).toContainText('대체 자료는 만들지 않습니다')
    }
    if (id === 'rw_aur') await page.screenshot({ path: `docs/screenshots/${id}-variable-lab.png` })
    // strictest quality filter: either honest "no data" or a summary built only from what is left
    await page.getByLabel('품질 필터').selectOption('clean')
    if (await page.getByTestId('variable-empty').count() === 0) await expect(page.getByTestId('variable-summary')).toContainText('0')
    expect(errors).toEqual([])
  })

  test(`${id}: time × wavelength map → visit spectrum → band time series`, async ({ page }) => {
    test.slow()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`/?target=${id}&mode=research`)
    const lab = page.getByTestId('variable-lab')
    await expect(lab).toBeVisible()

    // A. counts from all records down to visit summaries, raw ↔ median
    const funnel = page.getByTestId('data-funnel')
    await expect(funnel).toContainText('전체 측광 기록')
    await expect(funnel).toContainText('관측 요약점')
    await expect(lab).toContainText('원본 노출점')
    const nums = (await funnel.locator('b').allTextContents()).map(Number)
    expect(nums[0]).toBeGreaterThanOrEqual(nums[1])
    expect(nums[1]).toBeGreaterThanOrEqual(nums[2])
    const raw = await csvOf(page)
    expect(raw.name).toContain('_raw.csv')
    expect(raw.text.split('\n').filter((l) => !l.startsWith('#')).length - 1).toBe(nums[3]) // one row per selected exposure
    await page.getByRole('button', { name: '관측별 중앙값', exact: true }).click()
    await expect(lab).toContainText(`관측별 중앙값 ${nums[4]}개`)
    const med = await csvOf(page)
    expect(med.name).toContain('_median.csv')
    expect(med.text).toContain('not a measurement error')
    expect(med.text.split('\n').filter((l) => !l.startsWith('#')).length - 1).toBe(nums[4])

    // B. the map: picking a visit moves the shared time (left image follows)
    await expect(page.getByRole('img', { name: '전체 시간·파장 관측 지도' })).toBeVisible()
    await page.getByRole('button', { name: /지도에서 관측 3 선택/ }).click()
    await expect(page.getByTestId('blink-frame')).toHaveAttribute('data-visit', '2')
    await expect(lab).toContainText('관측 3의 스펙트럼')

    // C. spectrum of that visit, D. clicking a point selects its band for the time series
    const spectrum = page.getByTestId('visit-spectrum')
    const point = spectrum.getByRole('button').first()
    if (await point.count()) {
      const before = await page.getByTestId('band-range').textContent()
      await spectrum.getByRole('button').last().click()
      await expect(page.getByTestId('band-range')).toContainText('실제 선택 노출 파장')
      const after = await page.getByTestId('band-range').textContent()
      expect(after).not.toBeNull()
      expect(before === after || after!.includes('µm')).toBe(true)
    } else {
      await expect(page.getByTestId('spectrum-empty')).toContainText('대체 자료는 만들지 않습니다')
    }
    await page.screenshot({ path: `docs/screenshots/${id}-time-wavelength.png`, fullPage: false })

    // state survives a tab round trip and a target switch
    await page.getByRole('tab', { name: '위치 측정' }).click()
    await page.getByRole('tab', { name: '변광 분석실' }).click()
    await expect(page.getByRole('button', { name: '관측별 중앙값', exact: true })).toHaveClass(/active/)
    await page.getByTestId('tab-barnard').click()
    await page.getByTestId(`tab-${id}`).click()
    await expect(page.getByRole('button', { name: '관측별 중앙값', exact: true })).toHaveClass(/active/)
    expect(errors).toEqual([])
  })
}

test('r_dra: flux spectrum of a saturated visit says why there is no value', async ({ page }) => {
  await page.goto('/?target=r_dra&mode=research')
  await expect(page.getByTestId('variable-lab')).toBeVisible()
  await page.getByLabel('변광 측정값').selectOption('flux')
  await page.getByRole('button', { name: /지도에서 관측 1 선택/ }).click()
  await expect(page.getByTestId('spectrum-empty')).toContainText('포화')
})
