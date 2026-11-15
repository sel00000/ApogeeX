import { it, expect, vi, afterEach } from "vitest";
import { fetchImage } from "../src/observations";
afterEach(() => vi.unstubAllGlobals());
it("recovers one transient connection failure", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("connection reset"))
    .mockResolvedValue(new Response("png"));
  vi.stubGlobal("fetch", fetch);
  expect(
    await (await fetchImage("/image", new AbortController().signal)).text(),
  ).toBe("png");
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("never retries a cancelled selection", async () => {
  const c = new AbortController();
  c.abort();
  const fetch = vi
    .fn()
    .mockRejectedValue(new DOMException("aborted", "AbortError"));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchImage("/image", c.signal)).rejects.toThrow();
  expect(fetch.mock.calls.length).toBeLessThanOrEqual(1);
});
