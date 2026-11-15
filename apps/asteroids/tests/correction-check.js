async (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("http://127.0.0.1:8710");
  await page.waitForFunction(() => window.__app?.metrics().fixedSky);
  await page.screenshot({ path: "docs/correction-system.png" });
  const initial = await page.evaluate(() => window.__app.metrics());
  await page.getByRole("button", { name: "SPHEREx 시점", exact: true }).click();
  await page.waitForFunction(() => !window.__app.metrics().scheduled);
  await page.screenshot({ path: "docs/correction-overlay.png" });
  const modes = {};
  for (const mode of ["photo", "model", "blend"]) {
    await page.locator(`[data-composite=${mode}]`).click();
    modes[mode] = await page.locator("#image").evaluate((c) => c.toDataURL());
  }
  if (new Set(Object.values(modes)).size !== 3)
    throw Error("Comparison modes render identical images");
  const first = await page.evaluate(() => window.__app.metrics().predicted);
  await page.locator("#sequence-play").click();
  await page.waitForFunction(
    (id) => window.__app.metrics().observation !== id,
    initial.observation,
  );
  const second = await page.evaluate(() => window.__app.metrics());
  if (
    Math.hypot(second.predicted[0] - first[0], second.predicted[1] - first[1]) <
    0.01
  )
    throw Error("Asteroid recentered instead of moving");
  await page.locator("#sequence-play").click();
  await page.locator("[data-view=system]").click();
  await page.getByRole("button", { name: "재생", exact: true }).click();
  const timings = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let prev = 0,
          v = [];
        const tick = (t) => {
          if (prev) v.push(t - prev);
          prev = t;
          if (v.length < 180) requestAnimationFrame(tick);
          else {
            v.sort((a, b) => a - b);
            resolve({ median: v[90], p95: v[171] });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.waitForFunction(() => !window.__app.metrics().scheduled);
  const playingMetrics = await page.evaluate(() => window.__app.metrics());
  for (const id of ["16", "2045", "236", "913", "433"]) {
    await page.evaluate((id) => window.__app.choose(id), id);
    await page.waitForFunction(
      () =>
        !document
          .querySelector("#image-status")
          .textContent.includes("여는 중"),
    );
  }
  await page.evaluate(async () => {
    for (let i = 0; i < 24; i++) await window.__app.showObservation(i % 6);
  });
  const cache = await page.evaluate(() => window.__app.metrics());
  if (cache.cachedImages > 8 || cache.bytes > 8 * 128 * 256 * 4)
    throw Error("Unbounded frame cache");
  await page.evaluate(() => {
    for (let i = 0; i < 40; i++) window.__app.choose(i % 2 ? "433" : "16");
  });
  await page.waitForFunction(
    () =>
      window.__app.metrics().fixedSky &&
      !document.querySelector("#image-status").textContent.includes("여는 중"),
  );
  if ((await page.evaluate(() => window.__app.metrics())).selected !== "433")
    throw Error("Selection race");
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    )
  )
    throw Error("Horizontal overflow");
  await page.screenshot({ path: "docs/correction-mobile.png", fullPage: true });
  if (errors.length) throw Error(errors.join("\n"));
  await page.evaluate((result) => (window.__correction = result), {
    initial,
    second,
    timings,
    playingMetrics,
    cache,
    errors,
  });
}
