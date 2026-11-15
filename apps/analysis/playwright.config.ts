import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5191',
    viewport: { width: 1440, height: 900 },
    // English became the default language by the user's instruction (spec D1). These suites check the
    // Korean texts, so they start with the shared language key set to Korean, as a Korean visitor would.
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:5191', localStorage: [{ name: 'spherex-lang', value: 'ko' }] }] },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npx vite --port 5191 --strictPort',
    url: 'http://localhost:5191',
    reuseExistingServer: false,
  },
})
