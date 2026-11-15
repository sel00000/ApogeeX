import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

for (const id of ['barnard', 'eps_indi_b', 'wise0855', 'rw_aur', 'r_dra']) {
  test(`${id}: real wide frames and overlays at all four fields of view`, async ({ page }) => {
    test.slow()
    const m = JSON.parse(readFileSync(`public/data/${id}/meta.json`, 'utf8'))
    expect(m.wide).toBeTruthy()
    await page.goto(`/?target=${id}`)
    const frame = page.getByTestId('blink-frame')
    await expect(frame).toBeVisible()
    await expect(frame).toHaveAttribute('data-frame-size', String(m.wide.size_px[0]))
    await expect(page.getByTestId('wide-context')).toBeVisible()
    await expect(page.getByText('영상 불러오는 중…', { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('fetch-failed')).toHaveCount(0)
    const pred = m.visits[0].pred_px
    for (const zoom of [1, 3, 6, 12]) {
      await page.getByTestId(`zoom-${zoom}`).click()
      const o = Number(await frame.getAttribute('data-offset'))
      const x0 = Number(await frame.getAttribute('data-window-x'))
      const y0 = Number(await frame.getAttribute('data-window-y'))
      const width = Number(await frame.getAttribute('data-window-width'))
      const circle = frame.locator('svg circle').first()
      expect(Number(await circle.getAttribute('cx'))).toBeCloseTo((pred[0] + o - x0) * 420 / width, 7)
      expect(Number(await circle.getAttribute('cy'))).toBeCloseTo((pred[1] + o - y0) * 420 / width, 7)
    }
    await page.getByTestId('zoom-1').click()
    await page.getByTestId('view-diff').click()
    await expect(page.locator('.diff-key')).toContainText('잔차')
    await page.screenshot({ path: `docs/screenshots/${id}-wide-diff.png` })
  })
}

test('a failed wide-frame request is shown without a stretched small-image substitute', async ({ page }) => {
  test.slow()
  await page.route('**/frames/w*.f32', route => route.abort())
  await page.goto('/?target=barnard')
  await expect(page.getByTestId('fetch-failed')).toContainText('영상 데이터를 불러오지 못함')
})
