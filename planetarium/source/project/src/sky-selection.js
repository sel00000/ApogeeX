/* SPDX-License-Identifier: AGPL-3.0-only */

/**
 * Select the rendered object at canvas-local CSS pixels without moving the view.
 *
 * The bundled engine does not export core_get_obj_at. Its exported mouse input
 * calls that same picker: visible labels (including constellations) first, then
 * rendered object shapes within 18 CSS pixels. Feed a complete stationary click
 * after the DOM gesture guard rather than relying on canvas.js sampling mouse
 * down on an animation frame, which can miss a short click.
 *
 * The caller must reject drags, multi-touch and analysis-mode clicks. Its native
 * click callback normally consumes those inputs. Temporarily bypass that callback
 * for this synchronous selection only, preserving the exact WASM function pointer
 * (the engine returns it as a hexadecimal string). The native picker owns object
 * retention/release; the returned selection is borrowed from engine.core.
 */
export function selectObjectAtPoint(engine, point) {
  if (!engine?.core || typeof engine._core_on_mouse !== 'function' ||
      !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
      point.x < 0 || point.y < 0) return null;

  const { x, y } = point;
  const rect = engine.canvas?.getBoundingClientRect?.();
  if (rect && (rect.width <= 0 || rect.height <= 0 || x > rect.width || y > rect.height)) return null;

  const previousClick = engine.core.on_click;
  try {
    engine.core.on_click = 0;
    try {
      engine._core_on_mouse(0, 1, x, y, 1);
    } finally {
      // Always release the synthetic contact, even if a native listener fails.
      engine._core_on_mouse(0, 0, x, y, 1);
    }
    return engine.core.selection ?? null;
  } finally {
    engine.core.on_click = previousClick ?? 0;
  }
}
