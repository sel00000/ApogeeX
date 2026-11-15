import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Live services are mocked here so the tests are deterministic: VizieR (Gaia) answers with a real
// saved reply, Sesame with a minimal XML. HiPS tiles are served from IRSA when online; the test only
// requires the globe to mount and report its status (a failed tile is shown, never faked).
test.use({ viewport: { width: 1440, height: 1000 } })
const gaiaTsv = readFileSync('e2e/fixtures/gaia_eps_indi.tsv', 'utf8')
const watch = (page: Page) => { const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message)); return errors }
async function mockServices(page: Page) {
  await page.route(/asu-tsv\?-source=I\/355\/gaiadr3/, (r) => r.fulfill({ status: 200, contentType: 'text/tab-separated-values', body: gaiaTsv, headers: { 'access-control-allow-origin': '*' } }))
  await page.route(/nph-sesame/, (r) => r.fulfill({ status: 200, contentType: 'text/xml', headers: { 'access-control-allow-origin': '*' },
    body: '<?xml version="1.0"?><Sesame><Target><Resolver name="Simbad"><oname>* alf Ori</oname><jradeg>88.79293899</jradeg><jdedeg>7.407064</jdedeg></Resolver></Target></Sesame>' }))
}

test('sky globe: live SPHEREx all-sky map, find by name, pick, open a target', async ({ page }) => {
  const errors = watch(page)
  await mockServices(page)
  await page.goto('/?target=barnard')
  await page.getByTestId('stage-sky').click()
  await expect(page).toHaveURL(/view=sky/)
  await expect(page.getByTestId('sky-globe').locator('canvas')).toBeVisible()
  await expect(page.getByTestId('sky-status')).toContainText(/IRSA/)
  // wavelength slider moves through the 102-colour cube
  await page.getByTestId('sky-channel').fill('80')
  await expect(page.getByTestId('sky-panel')).toContainText('µm')
  // find by name (Sesame) → the view flies there and the position is picked
  await page.locator('#sky-q').fill('Betelgeuse')
  await page.getByRole('button', { name: '이동' }).click()
  await expect(page.getByTestId('sky-pick')).toContainText('alf Ori')
  await expect(page.getByTestId('sky-view')).toContainText('05h55m')
  // coordinates work without any service
  await page.locator('#sky-q').fill('269.45 +4.69')
  await page.getByRole('button', { name: '이동' }).click()
  await expect(page.getByTestId('sky-pick')).toContainText('17h57m')
  await expect(page.getByTestId('sky-open-target')).toContainText("Barnard's Star")
  await page.screenshot({ path: 'docs/screenshots/integrated-sky.png' })
  await page.getByTestId('sky-open-target').click()
  await expect(page.getByTestId('blink-frame')).toBeVisible()
  await expect(page.getByTestId('tab-barnard')).toHaveAttribute('aria-selected', 'true')
  expect(errors).toEqual([])
})

test('a picked spot far from targets asks the search server for SPHEREx images', async ({ page }) => {
  await mockServices(page)
  await page.route('**/api/patch**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'server down in this test' }) }))
  await page.goto('/?target=barnard&view=sky')
  await page.locator('#sky-q').fill('10 20')
  await page.getByRole('button', { name: '이동' }).click()
  await page.getByTestId('sky-analyse').click()
  await expect(page.getByTestId('tab-patch')).toContainText('RA 10.0000')
  await expect(page.getByTestId('fetch-failed')).toContainText('대체 데이터는 표시하지 않습니다')
})

test('Gaia DR3 overlay: stars drawn on the SPHEREx frame at the visit date', async ({ page }) => {
  const errors = watch(page)
  await mockServices(page)
  await page.goto('/?target=eps_indi_b')
  await expect(page.getByTestId('blink-frame')).toBeVisible()
  await page.getByTestId('mark-gaia').click()
  await expect(page.getByTestId('gaia-status')).toContainText('Gaia DR3 별 400개')
  expect(await page.getByTestId('gaia-overlay').locator('circle').count()).toBeGreaterThan(3)
  await page.screenshot({ path: 'docs/screenshots/integrated-gaia.png' })
  expect(errors).toEqual([])
})

test('Gaia service down: said so, nothing drawn in its place', async ({ page }) => {
  await page.route(/asu-tsv/, (r) => r.fulfill({ status: 500, body: 'down' }))
  await page.goto('/?target=barnard')
  await page.getByTestId('mark-gaia').click()
  await expect(page.getByTestId('gaia-status')).toContainText('Gaia 목록을 받지 못했습니다', { timeout: 60000 })
  await expect(page.getByTestId('gaia-overlay')).toHaveCount(0)
})

test('English switch: the whole workspace, missions and findings, kept in the link', async ({ page }) => {
  const errors = watch(page)
  await page.goto('/?target=wise0855')
  await page.getByTestId('lang-en').click()
  // English is the default now: the link carries no lang (a missing lang means English); the choice is kept in the shared key
  await expect(page).not.toHaveURL(/lang=/)
  expect(await page.evaluate(() => localStorage.getItem('spherex-lang'))).toBe('en')
  await expect(page.locator('h1')).toHaveText('Armchair Astronomer')
  await expect(page.getByTestId('mission-card')).toContainText('The coldest known brown dwarf')
  await expect(page.getByTestId('step-3')).toContainText('Turn on the cold-object filter')
  await expect(page.getByTestId('findings')).toContainText('What changed?')
  await page.getByTestId('step-3').click()
  await expect(page.getByTestId('cold-panel')).toContainText('Ordinary stars')
  await page.getByTestId('mode-research').click()
  await expect(page.getByRole('tab', { name: 'Spectrum lab' })).toBeVisible()
  await page.getByRole('tab', { name: 'Spectrum lab' }).click()
  await expect(page.getByTestId('spectrum-lab')).toContainText('What is missing from the light')
  // no Korean text left in the main UI (labels, buttons, headings)
  const korean = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.querySelector('.desk')!, NodeFilter.SHOW_TEXT)
    const hits: string[] = []
    while (walker.nextNode()) { const t = walker.currentNode.textContent ?? ''; if (/[가-힣]/.test(t) && !/경보/.test(t)) hits.push(t.trim()) }
    return hits
  })
  expect(korean).toEqual([])
  await page.screenshot({ path: 'docs/screenshots/integrated-english.png' })
  await page.reload()
  await expect(page.locator('h1')).toHaveText('Armchair Astronomer')
  expect(errors).toEqual([])
})
