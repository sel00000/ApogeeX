# SPHEREx observation analysis

This frontend retains the approved 통합V2 analysis workspace and prepared NASA/IPAC
SPHEREx observations. The original project description is preserved in
`docs/UPSTREAM_README.md` as historical provenance, not current launch instructions.
Third-party notices and licenses remain in this directory.

Use the repository root `Start-Web.cmd` / `npm start` for the integrated site.
Frontend development alone uses `npm run dev`; production uses `npm run build`.
The dev proxy forwards `/api` to the loopback observations service on port 8000.
The service, requirements and data-generation utilities now live in
`../../services/observations/`; runtime patches are stored outside public assets.

The portal provides common search, navigation and tutorials. Embedded URLs use
`?embed=1&target=eps_indi_b&mode=research&tab=spectrum`. Fixed field links use
`ra`, `dec`, `fov` in degrees and preserve frame, coordinateEpoch, observationMjd,
predictionMjd, timeScale and observer. Names resolve to explicit J2000 ICRS
catalogue coordinates. Apparent moving-object directions are not silently used
as fixed archive coordinates. Arbitrary fields provide images and provenance;
target-specific photometry, spectral tools and predicted 3D tracks require a
prepared target.

## Data interpretation

- Prepared spectra reject defective, saturated, persistent, transient and
  unquantified measurements; unknown uncertainty is never replaced with zero.
- Blackbody fits and band depths are exploratory models. Cross-detector,
  aperture, PSF and temporal covariance are not fully calibrated; the interface
  does not report molecular-detection significance.
- Difference images are exploratory. Disjoint wavelength coverage or absent
  detector frames are withheld. Broad overlap does not prove per-pixel response
  matching, and orange/blue residuals do not prove motion.
- Network/download errors remain errors with retry. They are not relabelled
  “no observations” or replaced by invented data.
- Synthetic data is available only through an explicit `?mock=1` developer URL.

`npm test` covers source/data contracts and regression cases. Browser integration
is checked from the root portal rather than the retired standalone preview folder.
