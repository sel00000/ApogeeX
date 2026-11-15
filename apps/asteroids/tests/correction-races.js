async (page) => {
  await page.goto("http://127.0.0.1:8710");
  await page.waitForFunction(() => window.__app?.metrics().fixedSky);
  await page.locator("[data-composite=model]").click();
  await page.evaluate(() => window.__app.choose("10"));
  await page.waitForFunction(
    () =>
      !document.querySelector("#image-status").textContent.includes("여는 중"),
  );
  const results = {};
  results.honestFallback = await page.evaluate(
    () =>
      document
        .querySelector("[data-composite=photo]")
        .classList.contains("active") &&
      window.__app.metrics().compositeMode === "photo",
  );
  await page.evaluate(() => window.__app.choose("433"));
  await page.waitForFunction(() => window.__app.metrics().fixedSky);
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route("**/data/images/fixed-16-*-atlas.png", async (route) => {
    await gate;
    await route.continue();
  });
  await page.evaluate(() => window.__app.choose("16"));
  results.selectionCleared = await page.evaluate(
    () =>
      !document.querySelector("#source").hasAttribute("href") &&
      document.querySelector("[data-view=observer]").disabled,
  );
  await page.evaluate(() => window.__app.setPlaying(true));
  release();
  await page.waitForFunction(
    () =>
      !document.querySelector("#image-status").textContent.includes("여는 중"),
  );
  results.playbackPreserved = await page.evaluate(
    () => window.__app.metrics().playing,
  );
  await page.evaluate(() => window.__app.setPlaying(false));
  await page.unrouteAll();
  await page.evaluate((r) => (window.__races = r), results);
  if (Object.values(results).some((v) => !v))
    throw Error(JSON.stringify(results));
}
