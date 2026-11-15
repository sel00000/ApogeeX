"""Derive the ApogeeX brand files from apogeex-logo-original.png (run from any folder):
  python make-brand.py
Writes apogeex-logo.png, apogeex-mark.png, apogeex-favicon.png (192) and apogeex-favicon-32.png next to this script."""
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
BG = (0x08, 0x0D, 0x13, 255)      # background of the old assets/mark.svg
INK = (0xF4, 0xF2, 0xEE)          # styles.css --text

ARTWORK = (0, 40, 65)              # the logo's navy ink (most common non-white colour)

src = Image.open(HERE / 'apogeex-logo-original.png').convert('RGBA')
if src.getchannel('A').getextrema()[0] == 255:
    # The delivered file is fully opaque (white background, not transparent). Recover the alpha from how far
    # each pixel is from white towards the navy ink (anti-aliased edges become partial alpha) and paint the
    # pixels in that same navy: the artwork keeps its colour, the white becomes transparent.
    grey = src.convert('L')
    ink_l = round(0.299 * ARTWORK[0] + 0.587 * ARTWORK[1] + 0.114 * ARTWORK[2])
    alpha = grey.point(lambda v: max(0, min(255, round((255 - v) * 255 / (255 - ink_l)))))
    src = Image.new('RGBA', src.size, ARTWORK + (255,))
    src.putalpha(alpha)
alpha = src.getchannel('A')
full = src.crop(alpha.point(lambda v: 255 if v > 8 else 0).getbbox())

# (b) whole logo, cropped to its visible bounds, at most 1200 px wide
logo = full
if logo.width > 1200:
    logo = logo.resize((1200, round(logo.height * 1200 / logo.width)), Image.LANCZOS)
logo.save(HERE / 'apogeex-logo.png', optimize=True)

# (c) emblem: the left part up to the first wide empty column gap before the word
a = full.getchannel('A')
w, h = a.size
cols = [any(a.getpixel((x, y)) > 8 for y in range(0, h, 2)) for x in range(w)]
gap_needed, run, cut = max(20, w // 60), 0, w
seen_ink = False
for x, filled in enumerate(cols):
    if filled:
        if seen_ink and run >= gap_needed:
            cut = x - run
            break
        seen_ink, run = True, 0
    elif seen_ink:
        run += 1
emblem = full.crop((0, 0, cut, h))
emblem = emblem.crop(emblem.getchannel('A').getbbox())
side = max(emblem.size)
mark = Image.new('RGBA', (side, side), (0, 0, 0, 0))
mark.paste(emblem, ((side - emblem.width) // 2, (side - emblem.height) // 2))
if side > 512:
    mark = mark.resize((512, 512), Image.LANCZOS)
mark.save(HERE / 'apogeex-mark.png', optimize=True)

# (d) favicons: rounded square in BG with the emblem in the text colour
def favicon(size):
    big = size * 4
    canvas = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(canvas).rounded_rectangle((0, 0, big - 1, big - 1), radius=round(big * 0.22), fill=BG)
    inner = round(big * 0.74)
    shape = mark.getchannel('A').resize((inner, inner), Image.LANCZOS)
    ink = Image.new('RGBA', (inner, inner), INK + (255,))
    ink.putalpha(shape)
    off = (big - inner) // 2
    canvas.alpha_composite(ink, (off, off))
    return canvas.resize((size, size), Image.LANCZOS)

favicon(192).save(HERE / 'apogeex-favicon.png', optimize=True)
favicon(32).save(HERE / 'apogeex-favicon-32.png', optimize=True)
print('logo', logo.size, 'emblem cut at', cut, 'of', w, 'mark', mark.size)
