#!/usr/bin/env python3
"""Bright stars for the home-page sky (crisp points over the SPHEREx all-sky map).

Reads the star tiles that ship with the planetarium (Stellarium Web Engine test sky data,
`planetarium-original/vendor/stellarium-web-engine/apps/test-skydata/stars`, Hipparcos/Gaia-based,
V <= 7) using the EPH format documented in src/eph-file.c and src/modules/stars.c, and writes
assets/sky/stars-v7.bin: float32 x4 per star = galactic l (deg), b (deg), V mag, B-V (NaN if none).
Positions are ICRS J2000 (proper motion ignored: < 0.1° for every star here).

Usage: python3 scripts/build_home_stars.py   (needs numpy + astropy)
"""
import struct, zlib, json
from pathlib import Path
import numpy as np
from astropy.coordinates import SkyCoord
import astropy.units as u

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "planetarium-original/vendor/stellarium-web-engine/apps/test-skydata/stars"
EPH_RAD = 1 << 16


def read_tile(buf: bytes):
    assert buf[:4] == b"EPHE" and struct.unpack_from("<i", buf, 4)[0] == 2
    ofs, out = 8, []
    while ofs < len(buf):
        typ = buf[ofs:ofs + 4]; size = struct.unpack_from("<i", buf, ofs + 4)[0]; data = buf[ofs + 8:ofs + 8 + size]
        ofs += 12 + size
        if typ not in (b"STAR", b"GAIA"):
            continue
        d = 12  # tile header: version + nuniq
        flags, row_size, n_col, n_row = struct.unpack_from("<4i", data, d); d += 16
        cols = {}
        for i in range(n_col):
            name = data[d:d + 4].rstrip(b"\0 ").decode(); ctype = chr(data[d + 4]); unit, start, csize = struct.unpack_from("<3i", data, d + 8)
            cols[name] = (ctype, unit, start, csize); d += 20
        raw_size, comp_size = struct.unpack_from("<2i", data, d); d += 8
        table = zlib.decompress(data[d:d + comp_size]); assert len(table) == raw_size
        arr = np.frombuffer(table, np.uint8)
        if flags & 1:  # bytes stored column-major (eph_shuffle_bytes)
            arr = arr.reshape(row_size, n_row).T.reshape(-1)
        rows = arr.reshape(n_row, row_size)
        def col(name):
            if name not in cols: return np.full(n_row, np.nan)
            ctype, unit, start, csize = cols[name]
            v = rows[:, start:start + 4].copy().view("<f4").ravel().astype(np.float64)
            if unit and (unit & 1):  # stored in degrees
                v = np.radians(v)
            return v
        vmag = col("vmag"); g = col("gmag"); vmag = np.where(np.isnan(vmag), g, vmag)
        out.append((col("ra"), col("de"), vmag, col("bv")))
    return out


def main():
    ra, de, mag, bv = [], [], [], []
    for p in sorted(SRC.rglob("*.eph")):
        for r, d, m, b in read_tile(p.read_bytes()):
            ra.append(r); de.append(d); mag.append(m); bv.append(b)
    ra, de, mag, bv = map(np.concatenate, (ra, de, mag, bv))
    keep = np.isfinite(ra) & np.isfinite(de) & np.isfinite(mag) & (mag <= 7.0)
    c = SkyCoord(ra=ra[keep] * u.rad, dec=de[keep] * u.rad, frame="icrs").galactic
    out = np.stack([c.l.deg, c.b.deg, mag[keep], bv[keep]], 1).astype("<f4")
    order = np.argsort(out[:, 2]); out = out[order]
    dst = ROOT / "assets/sky/stars-v7.bin"; dst.write_bytes(out.tobytes())
    (ROOT / "assets/sky/stars-v7.json").write_text(json.dumps({
        "count": int(len(out)), "layout": "float32 x4: galactic l deg, b deg, V mag, B-V", "max_vmag": 7.0,
        "source": "Stellarium Web Engine test sky data (Hipparcos/Gaia), planetarium-original/vendor/stellarium-web-engine/apps/test-skydata/stars",
        "frame": "ICRS J2000 -> galactic (astropy)",
        "check": {"Sirius_l_b": [round(float(x), 3) for x in out[0, :2]], "brightest_mag": round(float(out[0, 2]), 2)}}, indent=1))
    print(len(out), "stars ->", dst, "brightest", out[0])


if __name__ == "__main__":
    main()
