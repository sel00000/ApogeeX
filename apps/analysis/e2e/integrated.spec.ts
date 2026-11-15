import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })
const meta = (id: string) => JSON.parse(readFileSync(`public/data/${id}/meta.json`, 'utf8'))
const coldVisits = (id: string) => {
  const m = meta(id)
  return m.visits.map((_: unknown, i: number) => i).filter((i: number) => m.wide?.visits[i]?.f32_det?.['5'] && m.wide?.visits[i]?.f32_det?.['6'])
}
const watch = (page: Page) => { const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message)); return errors }

test('explore mode: mission, findings, sky locator and guides around the shared stage', async ({ page }) => {
  const errors = watch(page)
  await page.goto('/?target=barnard')
  await expect(page.getByTestId('mode-explore')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('mission-card')).toContainText('바너드 별')
  await expect(page.getByTestId('blink-frame')).toBeVisible()
  await expect(page.getByTestId('space-time')).toBeVisible() // 3D and SPHEREx image side by side
  await expect(page.getByTestId('finding-motion')).toContainText('″/년')
  await expect(page.getByTestId('guides')).toContainText('왜 같은 파장끼리')
  await expect(page.getByTestId('analysis')).toHaveCount(0)
  // the sky map opens another target
  await page.getByRole('button', { name: 'RW Aurigae 열기' }).click()
  await expect(page.getByTestId('tab-rw_aur')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('finding-brightness')).toContainText('배')
  await page.screenshot({ path: 'docs/screenshots/integrated-explore.png' })
  expect(errors).toEqual([])
})

test('WISE 0855 mission: long wavelength, then the cold-object filter on real D5/D6 frames', async ({ page }) => {
  const errors = watch(page)
  await page.goto('/?target=wise0855')
  const frame = page.getByTestId('blink-frame')
  await page.getByTestId('step-2').click()
  await expect(page.getByTestId('det-6')).toHaveAttribute('aria-checked', 'true')
  await expect(frame.locator('.frame-tag')).toContainText('D6')
  await page.getByRole('button', { name: '■ 정지' }).first().click()
  await page.getByTestId('step-3').click()
  await expect(frame).toHaveAttribute('data-view', 'cold')
  await expect(page.getByTestId('cold-panel')).toContainText('D6 − k × D5')
  await expect(page.getByTestId('cold-panel')).toContainText(`${coldVisits('wise0855').length}/9회`)
  // blinking in filter mode only visits frames that have both arrays
  const seen = new Set<string>()
  for (let i = 0; i < 6; i++) { seen.add((await frame.getAttribute('data-visit'))!); await page.waitForTimeout(140) }
  await page.getByRole('button', { name: '■ 정지' }).first().click()
  for (const v of seen) expect(coldVisits('wise0855')).toContain(Number(v))
  await expect(page.getByTestId('no-frame-data')).toHaveCount(0)
  await page.screenshot({ path: 'docs/screenshots/integrated-wise0855-cold.png' })
  // a visit without both arrays says so instead of drawing something else
  const missing = meta('wise0855').visits.map((_: unknown, i: number) => i).find((i: number) => !coldVisits('wise0855').includes(i))
  await page.getByRole('button', { name: `관측 ${missing + 1}로 이동` }).click()
  await expect(page.getByTestId('cold-missing')).toBeVisible()
  await expect(page.getByTestId('no-frame-data')).toContainText('D5·D6')
  expect(errors).toEqual([])
})

test('Barnard mission step 4: SPHEREx line of sight with the same image in 3D', async ({ page }) => {
  const errors = watch(page)
  await page.goto('/?target=barnard')
  await page.getByTestId('step-4').click()
  await expect(page.getByTestId('los-error')).toContainText('SPHEREx 시선과 일치', { timeout: 8000 })
  await expect(page.getByLabel('SPHEREx 영상 겹치기', { exact: true })).toBeChecked()
  await expect(page.getByTestId('space-time')).toHaveAttribute('data-image-visible', 'true')
  await page.screenshot({ path: 'docs/screenshots/integrated-barnard-los.png' })
  expect(errors).toEqual([])
})

test('a mission step opens the research tool it needs, and the link reopens the same view', async ({ page }) => {
  const errors = watch(page)
  await page.goto('/?target=eps_indi_b')
  await page.getByTestId('step-4').click()
  await expect(page.getByTestId('mode-research')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('spectrum-lab')).toBeVisible()
  await expect(page).toHaveURL(/mode=research/)
  await expect(page).toHaveURL(/tab=spectrum/)
  // shared link with a visit
  await page.goto('/?target=rw_aur&mode=research&tab=spectrum&visit=3')
  await expect(page.getByTestId('blink-frame')).toHaveAttribute('data-visit', '2')
  await expect(page.getByTestId('spectrum-lab')).toBeVisible()
  await expect(page.getByTestId('atab-spectrum')).toHaveAttribute('aria-selected', 'true')
  // provenance tab: visit table and CSV
  await page.getByTestId('atab-provenance').click()
  await expect(page.getByTestId('provenance-panel')).toContainText('spherex_')
  const dl = page.waitForEvent('download')
  await page.getByTestId('visits-csv').click()
  expect((await dl).suggestedFilename()).toBe('rw_aur_visits.csv')
  // motion tab draws measured − predicted
  await page.getByTestId('atab-motion').click()
  await expect(page.getByTestId('residual-chart')).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/integrated-research.png', fullPage: true })
  expect(errors).toEqual([])
})

test('spectral ruler: absent arrays are marked per visit, picking one changes the frame', async ({ page }) => {
  await page.goto('/?target=rw_aur')
  const ruler = page.getByTestId('spectral-ruler')
  await expect(ruler.getByRole('radio')).toHaveCount(7)
  await expect(page.getByTestId('det-0')).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('det-6').click()
  await expect(page.getByTestId('det-6')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('blink-frame').locator('.frame-tag')).toContainText('D6')
})
