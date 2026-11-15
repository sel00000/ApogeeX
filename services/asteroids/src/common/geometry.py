"""Small spherical-geometry helpers (degrees)."""
from __future__ import annotations

import numpy as np


def angular_separation_deg(ra1, dec1, ra2, dec2):
    """Vincenty formula, numerically stable for small and large separations."""
    ra1, dec1, ra2, dec2 = map(np.radians, (ra1, dec1, ra2, dec2))
    dra = ra2 - ra1
    num = np.hypot(np.cos(dec2) * np.sin(dra),
                   np.cos(dec1) * np.sin(dec2) - np.sin(dec1) * np.cos(dec2) * np.cos(dra))
    den = np.sin(dec1) * np.sin(dec2) + np.cos(dec1) * np.cos(dec2) * np.cos(dra)
    return np.degrees(np.arctan2(num, den))


def gnomonic(ra, dec, ra0, dec0):
    """Project (ra, dec) onto the tangent plane at (ra0, dec0). Returns xi, eta in degrees."""
    ra, dec, ra0, dec0 = map(np.radians, (ra, dec, ra0, dec0))
    cosc = np.sin(dec0) * np.sin(dec) + np.cos(dec0) * np.cos(dec) * np.cos(ra - ra0)
    xi = np.cos(dec) * np.sin(ra - ra0) / cosc
    eta = (np.cos(dec0) * np.sin(dec) - np.sin(dec0) * np.cos(dec) * np.cos(ra - ra0)) / cosc
    return np.degrees(xi), np.degrees(eta)


def point_in_polygon(ra, dec, poly_ra, poly_dec) -> bool:
    """Point-in-polygon on the sky using a gnomonic projection about the polygon centre.
    Valid for polygons much smaller than a hemisphere (SPHEREx detector footprints)."""
    poly_ra = np.asarray(poly_ra, float)
    poly_dec = np.asarray(poly_dec, float)
    # centre: mean unit vector
    v = np.array([np.cos(np.radians(poly_dec)) * np.cos(np.radians(poly_ra)),
                  np.cos(np.radians(poly_dec)) * np.sin(np.radians(poly_ra)),
                  np.sin(np.radians(poly_dec))]).mean(axis=1)
    ra0 = np.degrees(np.arctan2(v[1], v[0])) % 360
    dec0 = np.degrees(np.arcsin(v[2] / np.linalg.norm(v)))
    if angular_separation_deg(ra, dec, ra0, dec0) > 60:
        return False
    px, py = gnomonic(poly_ra, poly_dec, ra0, dec0)
    x, y = gnomonic(ra, dec, ra0, dec0)
    inside = False
    n = len(px)
    j = n - 1
    for i in range(n):
        if ((py[i] > y) != (py[j] > y)) and (x < (px[j] - px[i]) * (y - py[i]) / (py[j] - py[i]) + px[i]):
            inside = not inside
        j = i
    return bool(inside)


def parse_stc_polygon(s_region: str):
    """Parse 'POLYGON ICRS ra1 dec1 ra2 dec2 ...' into two arrays."""
    toks = s_region.replace("POLYGON", "").replace("ICRS", "").split()
    vals = np.array([float(t) for t in toks])
    return vals[0::2], vals[1::2]
