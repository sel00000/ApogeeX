import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1100 } })

test('Epsilon Indi B: observe → theory → compare → measure → conclude', async ({ page }) => {
  test.slow()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?target=eps_indi_b&mode=research')
  await page.getByRole('tab', { name: '분광 실험실' }).click()
  const lab = page.getByTestId('spectrum-lab')
  await expect(lab.getByRole('img', { name: 'SPHEREx 스펙트럼과 이론 비교' })).toBeVisible()
  await expect(page.getByTestId('spectrum-guide')).toContainText('교육용 창작 대사')
  await expect(page.getByTestId('spec-lab-count')).toContainText('노출')
  await page.getByRole('button', { name: '다음 단계 →' }).click()
  await page.getByRole('button', { name: '가장 잘 맞는 온도' }).click()
  await expect(page.getByTestId('theory-panel')).toContainText('자동 맞춤')
  await page.getByRole('button', { name: '다음 단계 →' }).click()
  await expect(page.getByRole('img', { name: '측정 대 이론 잔차' })).toBeVisible()
  await page.getByRole('button', { name: '다음 단계 →' }).click()
  await expect(page.getByTestId('depth-table')).toContainText('CH₄ 3.3 µm')
  await expect(page.getByTestId('depth-table')).toContainText('흡수 경향')
  // hovering a band explains it
  await page.getByRole('button', { name: 'CH₄ 3.3 µm 설명' }).click()
  await expect(lab).toContainText('메탄의 가장 강한')
  await page.getByRole('button', { name: '다음 단계 →' }).click()
  await expect(page.getByTestId('research-note')).toContainText('[대안 설명]')
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: '측정·깊이 CSV' }).click()
  expect((await dl).suggestedFilename()).toBe('eps_indi_b_spectrum_lab.csv')
  await page.screenshot({ path: 'docs/screenshots/eps_indi_b-spectrum-lab.png' })
  // state survives a tab round trip
  await page.getByRole('tab', { name: '위치 측정' }).click()
  await page.getByRole('tab', { name: '분광 실험실' }).click()
  await expect(page.getByTestId('research-note')).toBeVisible()
  expect(errors).toEqual([])
})

test('R Draconis: saturated — the spectrum lab says why instead of drawing anything', async ({ page }) => {
  await page.goto('/?target=r_dra&mode=research')
  await page.getByRole('tab', { name: '분광 실험실' }).click()
  await expect(page.getByTestId('spectrum-unavailable')).toContainText('포화')
  await expect(page.getByTestId('spectrum-unavailable')).toContainText('가상의 스펙트럼은 만들지 않습니다')
})

test('RW Aurigae: spectrum follows the shared time (season of the current visit)', async ({ page }) => {
  await page.goto('/?target=rw_aur&mode=research')
  await page.getByRole('tab', { name: '분광 실험실' }).click()
  const count = page.getByTestId('spec-lab-count')
  const before = await count.textContent()
  await page.getByRole('button', { name: /관측 7로 이동/ }).click()
  await expect(count).not.toHaveText(before!)
})
