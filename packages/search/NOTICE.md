# Search provenance

The eleven modules under `src/core` are extracted from `추가/경보/trueblink-live/src/core/search` in the supplied v5.0.0 source snapshot. Their Apache-2.0 license and AI-use notice are retained. The old application's store, rendering, archive and analysis pipeline are not used.

The sky index comes from the supplied `public/search` catalogue. See `sky-index.meta.json` for extraction dates and sources. This research has made use of the SIMBAD database, operated at CDS, Strasbourg, France. Korean names include Wikidata CC0 data and the source project's checked supplements.

`bodies-index.json` contains only identifiers and names extracted from the supplied asteroid 3D dataset. It contains no current coordinates. Named Solar System objects must be resolved for a time and observer before fixed-position analysis.

Integration changes validate index data, compare spherical positions across the RA seam, retain J2000 catalogue positions, distinguish the Epsilon Indi B companion from Epsilon Indi b, and provide cancellable browser UI adapters. A shared search result does not claim a new SPHEREx observation or scientific detection.
