# ApogeeX brand files

Source: `apogeex-logo-original.png`, an unchanged copy of the team logo `ApogeeX_logo.png` (2172x724).
The delivered file is fully opaque (navy `#002841` artwork on white), so `make-brand.py` first turns the
white into transparency (alpha from the distance to white, pixels painted in the same navy).

| File | What it is |
|---|---|
| `apogeex-logo.png` | Emblem + word "ApogeeX", cropped to the artwork, 1200 px wide, transparent. Header and footer use it as a CSS mask. |
| `apogeex-mark.png` | The emblem alone (telescope, orbit ring, star), square 512x512, transparent. Header mask on phone widths. |
| `apogeex-favicon.png` | 192x192 favicon: rounded square `#080d13` (old mark background), emblem in `--text` `#f4f2ee`. |
| `apogeex-favicon-32.png` | The same at 32x32. |

Regenerate (needs Pillow): `/mnt/c/S_N/최종_수정하기/Apogee/.venv-science/bin/python apps/portal/assets/brand/make-brand.py`
