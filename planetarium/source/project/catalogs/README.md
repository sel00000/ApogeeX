# Hipparcos astrometry used by v2.4.0

The original upstream `apps/test-skydata/stars` example tiles contained heavily
rounded coordinates and zero proper-motion columns. v2.4.0 replaces their
astrometry for **all 15,527 stars in 44 tiles** with Hipparcos-2 values from
[VizieR I/311/hip2](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/311)
(F. van Leeuwen, 2007, A&A 474, 653). Every existing HIP identifier matched;
there are no unmatched HIP or non-HIP rows in this bundled sample.

`hipparcos2-astrometry.tsv.gz` contains only the 15,527 authoritative rows needed
for this application, with the original VizieR header and unit descriptions.
The query, original download hash, subset hashes, citation and attribution URL
are recorded in `hipparcos2-provenance.json`. Identity, names, magnitudes,
colours, other non-astrometric columns and tile membership remain unchanged.

The source positions are ICRS at **Julian epoch J1991.25**. Although the column
names are `RArad` and `DErad`, this VizieR TSV expresses them in **degrees**.
Parallaxes are in mas; proper motions are in mas per Julian year, with pmRA
already including cos(Dec). The tile generator encodes the corresponding
Besselian epoch expected by this native engine, **1991.2510906221546**, and
stores RA, Dec, parallax, proper motions and epoch in 64-bit float columns.
The native parser continues to support the old 32-bit columns too.

The native star model now retains angular proper motion when parallax is zero
or negative, without making up a distance or applying annual parallax. Positive
parallaxes below 2 mas are retained. This affects 95 and 1,004 bundled rows,
respectively. As in the original native model, radial velocity is assumed zero;
binary orbits and catalog uncertainties are not modeled.

Reproduce the data repair from the planetarium directory using standard Python:

```text
python scripts/update-hipparcos-catalog.py
```

The native engine must be built from the included patched C source before
reading these double-precision tiles. `scripts/build-engine.ps1` records the
required toolchain and rebuild command.

`hipparcos2-validation.json` is an independent PyERFA oracle for Vega, Sirius,
Polaris, and real zero/negative/small-positive-parallax HIP entries over three
dates. Regenerate it with Python plus Astropy/PyERFA:

```text
python scripts/generate-hipparcos-validation.py
```

The integration repository's `scripts/check-hipparcos.mjs` loads the actual
tiles through the shipped native WASM reader and checks all catalog columns,
selected-star coordinates and sky/all-sky clicks against that oracle. Its
reported numerical agreement is **not** a claim about the absolute measurement
uncertainty of Hipparcos or SPHEREx, nor a moving-object tracking solution.
