import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const index = JSON.parse(readFileSync('public/data/targets.json', 'utf8'))
const targets: { id: string; display_name: string; status: string }[] = index.targets.filter((t: { status: string }) => t.status === 'ok')
const SHOTS = 'docs/screenshots'

for (const t of targets) {
  test(`${t.display_name}: tab, blink, sync, line-of-sight match`, async ({ page }) => {
    test.slow()
    // research mode with the position tab: the target facts card lives there
    await page.goto(`/?target=${t.id}&mode=research&tab=motion`)

    // (a) tab switching
    await page.getByTestId(`tab-${t.id}`).click()
    await expect(page.getByTestId(`tab-${t.id}`)).toHaveAttribute('aria-selected', 'true')

    const frame = page.getByTestId('blink-frame')
    await expect(frame).toBeVisible()
    await expect(frame).toHaveAttribute('data-visit', '0')
    await expect(page.getByTestId('target-card')).toContainText(t.display_name)

    // circle / arrow markers toggle independently
    await expect(page.getByTestId('mark-circle')).toHaveClass(/active/)
    await page.getByTestId('mark-arrow').click()
    await expect(page.getByTestId('mark-arrow')).not.toHaveClass(/active/)
    await page.getByTestId('mark-arrow').click()
    await expect(page.getByTestId('ab-caption')).toContainText('일 간격')
    // spectra now live in the right-hand spectrum lab (the old bottom panel was removed)
    await expect(page.getByTestId('photometry')).toHaveCount(0)
    await page.getByRole('tab', { name: '분광 실험실' }).click()
    await expect(page.getByTestId('spectrum-lab')).toBeVisible()
    await page.getByRole('tab', { name: ['rw_aur', 'r_dra'].includes(t.id) ? '변광 분석실' : '위치 측정' }).click()
    // A−B difference view renders from the raw frames
    await page.getByTestId('view-diff').click()
    await expect(page.locator('.diff-key')).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/${t.id}-diff.png` })
    await page.getByRole('button', { name: '영상', exact: true }).click()

    // (b) blink playback advances the visit
    await page.getByRole('button', { name: '▶ Blink' }).click()
    await expect(frame).not.toHaveAttribute('data-visit', '0', { timeout: 5000 })
    await page.getByRole('button', { name: '■ 정지' }).first().click()

    // (c) timeline → both sides follow the shared time
    const markers = page.getByRole('button', { name: /관측 \d+로 이동/ })
    const n = await markers.count()
    await markers.nth(n - 1).click()
    await expect(frame).toHaveAttribute('data-visit', String(n - 1))
    await expect(page.getByTestId('timeline')).toContainText(`관측 ${n}/${n}`)
    // scrub between two visits: Blink holds the previous frame and says so
    const track = page.locator('.tl-track')
    const box = (await track.boundingBox())!
    // middle of the widest gap between consecutive visits
    const xs: number[] = []
    for (let i = 0; i < n; i++) {
      const b = await markers.nth(i).boundingBox()
      xs.push(b!.x)
    }
    let g = 0
    for (let i = 1; i < n - 1; i++) if (xs[i + 1] - xs[i] > xs[g + 1] - xs[g]) g = i
    await page.mouse.click((xs[g] + xs[g + 1]) / 2 + 5, box.y + box.height / 2)
    await expect(page.getByTestId('between')).toBeVisible()
    await expect(page.getByTestId('between')).toContainText('다음 관측까지')
    await expect(frame).toHaveAttribute('data-visit', String(g))
    await page.getByTestId('los-btn').click()
    await expect(page.getByTestId('los-error')).toContainText('관측 사이', { timeout: 8000 })
    await page.getByRole('button', { name: '← 3D로 돌아가기' }).click()
    await page.screenshot({ path: `${SHOTS}/${t.id}-overview.png` })

    // (d) line-of-sight view matches pred_px for the selected visit
    await markers.nth(n - 1).click()
    await page.getByTestId('los-btn').click()
    const readout = page.getByTestId('los-error')
    await expect(readout).toContainText('SPHEREx 시선과 일치', { timeout: 8000 })
    const err = Number((await readout.textContent())!.match(/오차 ([\d.]+) px/)![1])
    expect(err).toBeLessThan(0.5)
    await page.screenshot({ path: `${SHOTS}/${t.id}-los.png` })
    // the SPHEREx frame can be laid under the model for a direct comparison
    await page.getByText('SPHEREx 영상 겹치기').click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SHOTS}/${t.id}-los-image.png` })
  })
}

test('data failure is shown, not replaced', async ({ page }) => {
  await page.route('**/data/**', (r) => r.abort())
  await page.goto('/')
  await expect(page.getByTestId('fetch-failed')).toBeVisible()
  await expect(page.getByTestId('fetch-failed')).toContainText('대체 데이터는 표시하지 않습니다')
  await expect(page.getByTestId('blink-frame')).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}/fetch-failed.png` })
})

test('mock mode is always labelled', async ({ page }) => {
  await page.goto('/?mock=1')
  await expect(page.getByTestId('mock-banner')).toBeVisible()
})

test('coordinate search: URL coordinates open a sky patch (server mocked)', async ({ page }) => {
  // the real server bakes from IRSA (minutes); here it answers with an already-baked frame set
  const wise = JSON.parse(readFileSync('public/data/wise0855/meta.json', 'utf8'))
  const patch = { ...wise, id: 'test_patch', kind: 'patch', display_name: 'RA 133.7951°, Dec -7.2451°', base: './data/wise0855/', fov_deg: 0.1,
    visits: wise.visits.map((v: Record<string, unknown>) => ({ ...v, pred_px: null, meas_px: null, masked_frac: 0.01 })) }
  await page.route('**/api/patch**', (r) => r.fulfill({ json: { id: 'test_patch', url: 'data/patches/test_patch/meta.json', status: 'done' } }))
  await page.route('**/data/patches/test_patch/meta.json', (r) => r.fulfill({ json: patch }))
  await page.goto('/?ra=08h55m10.831s&dec=-07d14m42.53s&fov=0.1')
  await expect(page.getByTestId('tab-patch')).toContainText('RA 133.7951')
  await expect(page.getByTestId('near-target')).toContainText('WISE 0855')
  await expect(page.getByTestId('patch-info')).toBeVisible()
  await expect(page.getByTestId('patch-visits').locator('tbody tr')).toHaveCount(wise.visits.length)
  await expect(page.getByTestId('blink-frame')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/patch.png` })
})

test('coordinate search: server failure is shown, not replaced', async ({ page }) => {
  await page.route('**/api/patch**', (r) => r.abort())
  await page.goto('/?ra=10&dec=20')
  await expect(page.getByTestId('fetch-failed')).toContainText('대체 데이터는 표시하지 않습니다')
})

test('target switching preserves measured provenance and selected data policy', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/?target=barnard&mode=research')
  await expect(page.getByTestId('measurement-coverage')).toContainText('14/17')
  for (const id of ['r_dra', 'wise0855', 'barnard', 'r_dra']) {
    await page.getByTestId(`tab-${id}`).click()
    await expect(page.getByTestId(`tab-${id}`)).toHaveAttribute('aria-selected', 'true')
    const m = JSON.parse(readFileSync(`public/data/${id}/meta.json`, 'utf8'))
    await expect(page.getByTestId('measurement-coverage')).toContainText(`위치 측정 ${m.visits.filter((v: {meas_px: unknown}) => v.meas_px).length}/${m.visits.length}회`)
  }
  // the target facts card lives in the research mode position tab
  await page.getByTestId('atab-motion').click()
  await expect(page.getByTestId('data-coverage')).toContainText('2493장')
  await expect(page.getByTestId('target-card')).toContainText('전체 노출을 모두 사용한 자료가 아닙니다')
  await expect(page.getByText('영상 불러오는 중…', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('fetch-failed')).toHaveCount(0)
  expect(errors).toEqual([])
})
