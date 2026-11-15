# Use of AI ("Super Intelligence") in TrueBlink

This file is the disclosure of AI use required by NASA Space Apps 2026. It covers the code, the data files and the documents in this repository.

On 2026-11-14 the Space Apps organisers told the team that using AI to propose solution ideas is allowed, as long as the use is disclosed accurately. This file describes what actually happened.

## 1. Which tool, and when

Anthropic's Claude, used through the Claude Code command-line tool, during the hackathon window (2026-11-14 to 2026-11-15, KST). Several Claude agents worked in parallel on separate modules, coordinated by scripted workflows.

Team to confirm: AI-assisted work on this project began on ______, and nothing was prepared before the hackathon window opened: ______

## 2. What the AI did

These statements describe the AI's part. They are true of the repository as it stands.

- **Research.** Claude read the SPHEREx Explanatory Supplement, the IRSA documentation and tutorials, the challenge pages, the papers we cite and other public SPHEREx projects, and checked their statements against the real archive. It wrote and ran analysis scripts that read real SPHEREx Level-2 files from the public S3 bucket and queried IRSA, CDS and IMCCE services.
- **Shaping and choosing the design.** Claude helped shape and choose the design of the tool, including the two ideas at its centre: the like-with-like blink (each frame of a visit built from the same spectral channels, labelled with date and wavelength) and the cold-object filter (4.2-4.8 µm minus scaled 3.82-4.05 µm, so ordinary stars cancel and methane-absorbing cold objects remain).
- **Architecture.** Claude designed the architecture: the module layout, the data types in `src/core/types.ts` and the contracts between modules (`docs/ARCHITECTURE.md`).
- **Code and tests.** Claude wrote nearly all of the TypeScript code, the unit tests and the headless-browser checks, ran them, and fixed the failures it found. Every source file starts with the line `// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.`
- **Data files.** The tables in `public/data/`, the asteroid measurements in `public/data/asteroids/`, and the exposure lists and pixel bundles in `public/presets/` were produced by scripts Claude wrote, from public archive files. Sources are named inside each file and in `THIRD_PARTY_NOTICES.md`.
- **Science checks.** Claude ran the measurement code on real data (`scripts/measure-check.ts`) and the like-with-like experiment (`scripts/audit/like-with-like.ts`), and wrote the numbers in `docs/SCIENCE.md` from those runs.
- **Documents.** Claude drafted the README, the science explainer, the architecture and deployment guides, the Korean guides and the text for the project page.
- **A separate planning effort.** A second AI-assisted planning session produced `docs/VISION_PLAN.md` and the design notes it links to: a roadmap for a later analysis engine. That engine is not built and is not part of what this submission claims to do.

## 3. What the team did (team to fill in)

Only the team can write this section. Each line should say who did what and when. Leave out anything that did not happen.

- Goals and constraints, set in the team's planning meetings (a blink tool, public and researcher modes, spectra, moving objects, a sky map, three.js, low running cost): who set them, and when: ______
- Who reviewed the AI's proposals and decided what to keep, with examples: ______
- Who reviewed which parts of the code or the documents: ______
- Who tested the five targets in the browser, on which devices, and what they checked: ______
- Who deployed the site: ______
- Who recorded the demo, wrote or edited the project page, and presents: ______

## 4. What was not AI-generated

- **No AI-generated images, video or audio.** Every picture in the tool is real SPHEREx data, or a real AllWISE image in "Then and now". Screenshots and the demo video are screen captures of the real tool. No AI-generated pictures, video, voice or music are used.
- **No NASA branding was generated.** No logos, insignia, flags or mission identifiers were created by AI.
- **No invented results.** The numbers the tool shows are measured from real data when you use it. Synthetic data exists only for development and tests and carries a visible DEMO label.

## 5. How the use is marked

- The first line of every TypeScript, JavaScript and CSS source file (see section 2).
- The About dialog in the tool has an "AI assistance" section. It says the AI was used throughout the hackathon: to research the archive, to help shape the design, and to write and test nearly all of the code and text; that AI_USE.md sets out what the AI and the team did; and that no image shown is AI-generated. Section 2 above gives the detail behind that sentence.
- The project page's "Use of Super Intelligence" field (text in `docs/SUBMISSION.md`).
- Team to confirm: commits made with the assistant carry a `Co-Authored-By: Claude` trailer: ______
