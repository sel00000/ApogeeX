# Use of AI ("Super Intelligence") in TrueBlink

This file is the disclosure of AI use required by NASA Space Apps 2026. It covers the code, the data files and the documents in this repository.

On 2026-11-14 the Space Apps organisers told the team that using AI to propose solution ideas is allowed, as long as the use is disclosed accurately. This file describes what actually happened.

In short, AI was used in four ways:

1. An AI assistant (Claude, by Anthropic) researched the archive, shaped the design, and wrote and tested nearly all code and text under the team's direction (sections 1 to 3).
2. The demo video's narration is AI-generated audio, made with the Piper text-to-speech program (section 4).
3. At run time, the search box may ask a small language model (Llama 3.1 8B on Cloudflare Workers AI) to read a sentence; such results are labelled "Interpreted by AI" and open only on a click (section 6).
4. The 14 small cartoon pictures of the guide characters were made with an AI image tool and carry a visible "AI" mark, and the note under each explanation says the character is drawn with AI (section 7).

No sky image and no video is AI-generated; the only AI-generated pictures shown are the 14 guide characters of section 7. Every astronomical image is real SPHEREx data or a real AllWISE or 2MASS image; the ground and skyline under the sky map are drawn by code for orientation, are not data, and are labelled as a drawing (an "Illustration" note under the map).

## 1. Which tool, and when

Anthropic's Claude, used through the Claude Code command-line tool, during the hackathon window (2026-11-14 to 2026-11-15, KST). Several Claude agents worked in parallel on separate modules, coordinated by scripted workflows.

Team to confirm: AI-assisted work on this project began on ______, and nothing was prepared before the hackathon window opened: ______

## 2. What the AI did

These statements describe the AI's part. They are true of the repository as it stands.

- **Research.** Claude read the SPHEREx Explanatory Supplement, the IRSA documentation and tutorials, the challenge pages, the papers we cite and other public SPHEREx projects, and checked their statements against the real archive. It wrote and ran analysis scripts that read real SPHEREx Level-2 files from the public S3 bucket and queried IRSA, CDS and IMCCE services.
- **Shaping and choosing the design.** Claude helped shape and choose the design of the tool, including the two ideas at its centre: the like-with-like blink (each frame of a visit built from the same spectral channels, labelled with date and wavelength) and the cold-object filter (4.2-4.8 µm minus scaled 3.82-4.05 µm, so ordinary stars cancel and methane-absorbing cold objects remain).
- **Architecture.** Claude designed the architecture: the module layout, the data types in `src/core/types.ts` and the contracts between modules (`docs/ARCHITECTURE.md`).
- **Code and tests.** Claude wrote nearly all of the TypeScript code, the unit tests and the headless-browser checks, ran them, and fixed the failures it found. Every source file starts with the line `// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.`
- **Data files.** The tables in `public/data/`, the asteroid measurements in `public/data/asteroids/`, the exposure lists and pixel bundles in `public/presets/`, and the search box's name index in `public/search/` were produced by scripts Claude wrote, from public archive files and public databases (SIMBAD, Wikidata). Sources are named inside each file and in `THIRD_PARTY_NOTICES.md`.
- **Science checks.** Claude ran the measurement code on real data (`scripts/measure-check.ts`) and the like-with-like experiment (`scripts/audit/like-with-like.ts`), and wrote the numbers in `docs/SCIENCE.md` from those runs.
- **Documents.** Claude drafted the README, the science explainer, the architecture and deployment guides, the Korean guides and the text for the project page.
- **Design, wave 7 (2026-11-14).** AI agents (Claude, Anthropic) studied the two reference sites (SENTRY and SOJOURNER by artificial.isabel) in a headless browser and read the public SENTRY repository for concepts only (it carries no licence, so nothing was reused). An AI design lead wrote the design brief: the visual tokens, the Archive log and the "Above Seoul now" card. The code was written with AI assistance under the team's direction, as described in this section. The Archive log lists only events the app really performed; the "Above Seoul now" positions come from catalogue coordinates and standard horizon formulas, not from a model.
- **The Time series view (2026-11-15).** The fourth view, "Time series" (observation image, time bar and 3D space-time model for the five challenge targets), is the team's own viewer. A team member wrote it, with AI assistance, in their part of the team's repository (folder `한결/통합`, MIT licence); the commits that changed that folder carry a `Co-Authored-By: Claude` line. Its code and prepared data were moved into TrueBlink and adapted with AI assistance (Claude) on 2026-11-15: the host component, the shadow root, the key guard, the Korean wording, the error messages in two languages and the checks (`e2e/series.mjs`). Every moved file says so in its first line (`// From the team's SPHEREx time series viewer (한결/통합, MIT), adapted for TrueBlink. AI-assisted (Claude). ...`); what was changed is listed in `THIRD_PARTY_NOTICES.md`. Its pictures are real SPHEREx data (DR1 and QR3 Level-2 images, averaged per visit). Its 3D path and predicted positions are a computed model and are labelled "Computed · model" on screen; between two observations it holds the last real image and does not make up an image for the time between. [TEAM: confirm whether the script that prepared these data files (`bake.py`, named in each `meta.json`) was also written with AI assistance.]
- **The demo video.** The script that records the demo video from the live site (`e2e/demo-record.mjs`) and the text of its captions and narration were written with AI assistance.
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

- **No AI-generated sky image or video, apart from the guide characters (section 7); the demo video has an AI-generated voice-over.** Every astronomical image in the tool is real SPHEREx data, or a real AllWISE or 2MASS image in "Then and now"; the ground and skyline under the sky map are drawn by code (not by AI) for orientation and are labelled as a drawing: while the ground is shown, a note under the map tagged "Illustration" says "The skyline is drawn for orientation; it is not a photograph." Screenshots and the demo video are screen captures of the real tool. The narration of the demo video is AI-generated audio: a synthetic English voice made on the team's own computer with the Piper text-to-speech program (first-choice voice `en_US-ryan-high`), reading a script written with AI assistance. It is acknowledged on screen ("Narration: AI-generated voice"), in the video file's metadata and in the video's description. No AI-generated pictures are used other than the 14 guide-character pictures of section 7, which are not astronomical images; no AI-generated music is used.
- **No NASA branding was generated.** No logos, insignia, flags or mission identifiers were created by AI.
- **No invented results.** The numbers the tool shows are measured from real data when you use it, except values marked as catalogue values or as a computed model. In the Time series view the SPHEREx values were measured beforehand by the team's data script and are read from its data files, and each value carries a "SPHEREx measured", "External catalogue" or "Computed · model" badge. Synthetic data exists only for development and tests and carries a visible DEMO label.
- **No model in the measurements or the sky positions.** The measurements, the Archive log and the "Above Seoul now" card are computed by ordinary code. The only AI model the tool itself calls is the search box's sentence helper (section 6), and it never supplies objects, positions or numbers.

## 5. How the use is marked

- The first line of every TypeScript, JavaScript and CSS source file (see section 2). The files moved from the team's time series viewer carry their own first line, which also says "AI-assisted (Claude)" (see section 2, "The Time series view").
- The About dialog in the tool has an "AI assistance" section. It says the AI was used throughout the hackathon: to research the archive, to help shape the design, and to write and test nearly all of the code and text; that AI_USE.md sets out what the AI and the team did; and, in its last sentence, "No sky image shown here is AI-generated; the ground and skyline under the sky map are a drawing made by code, not data." A second paragraph says: "The search box can ask a small language model (Llama 3.1 8B on Cloudflare Workers AI) to read a sentence that nothing else understood or answered. Such results are labelled "Interpreted by AI" and open only when you click them." Section 2 above gives the detail behind the first sentence, section 6 behind the second. A further paragraph and a switch ("Guide characters: on/off") say that the guide characters are cartoon pictures made with an AI image tool, that each carries an AI mark, and that their texts are explanations, not quotations (section 7).
- The project page's "Use of Super Intelligence" field (text in `docs/SUBMISSION.md`).
- The demo video: the line "Narration: AI-generated voice" in its caption band, its MP4 metadata (`title`, `comment`, `description`) and the suggested video description.
- In the search box: the label "Interpreted by AI" on every result the model had a part in (section 6).
- On every guide character: a visible "AI" mark in the top-right corner of each picture file (and, in the 56 px picture of the low bar, the letters "AI" drawn again by the page), and under every explanation the note "Guide character drawn with AI. Our explanation, not a quotation." ("AI로 그린 안내 캐릭터예요. 인용이 아니라 우리가 쓴 설명이에요." in Korean) (section 7).
- Team to confirm: commits made with the assistant carry a `Co-Authored-By: Claude` trailer: ______

## 6. AI at run time: the search box's sentence helper

Sections 1 to 5 are about AI used to build the tool. One feature also calls an AI model while the tool runs: the search box.

- **Which model.** Meta's Llama 3.1 8B Instruct (`@cf/meta/llama-3.1-8b-instruct-fp8-fast`), run by Cloudflare Workers AI and called from the site's own function `functions/api/ask.ts`. It is not the assistant that wrote the code.
- **When it is asked.** Last. Coordinates and the five challenge targets open directly. Other text goes first to the search code that runs in the browser: a name index of 19,975 objects and a rule-based reader for requests such as "nearest brown dwarfs". That code uses no AI model. Next come the CDS and IMCCE name services. Only a sentence that none of these understood or answered is sent to the model (also when the name services could not be reached).
- **What it does.** It turns the sentence into a small plan chosen from closed lists: one object type out of 35, one ordering out of five (best known, nearest, brightest, fastest, largest) and optionally a place to search near, or one catalogue name. The function checks the plan in code and discards anything outside the lists. Text written by the model is never shown. The objects, positions and numbers in the results come from the SIMBAD database, the CDS name service, the site's name index or the IMCCE service, not from the model (the note under such results says "from SIMBAD or the CDS name service", or "from the IMCCE service" for Solar System bodies).
- **How it is marked.** Results the model had a part in carry the label "Interpreted by AI" ("AI 해석" in Korean) and a line that says what the model did. They are never opened automatically: the visitor has to click one.
- **What is sent.** The typed sentence, at most 200 characters, and nothing else about the visitor. The function writes no log. It keeps its answer in Cloudflare's cache under the request's address, which contains the sentence, for up to a day (five minutes for a sentence the model did not understand), so the same sentence is not sent to the model twice; the browser may keep the answer equally long. Cloudflare processes the sentence to run the model.
- **Who may ask.** Only the site's own page: a request that the browser marks as coming from another site (the `Sec-Fetch-Site` header says `cross-site` or `same-site`) is refused with status 403 and does not reach the model.
- **When it is not available.** Without the Workers AI binding, or when the free daily allowance is used up, the function answers "unavailable" and the search carries on without the model: the typed text is looked up as a plain name.
- **Known weakness.** The model can pick the wrong object type, or the wrong object, for a description. In our test of 25 sentences on 2026-11-14 it gave the intended plan for 22. This is why its results are offered only as marked choices.
- **Where the code is.** `src/core/search/llmPlan.ts` (the instructions given to the model and the check of its answer), `src/core/search/plan.ts` (the closed lists) and `functions/api/ask.ts`. This code was written with the AI assistance described in section 2.

## 7. AI-generated pictures: the guide characters

The site shows 14 small cartoon pictures, the "guide characters": 12 are named after scientists, one after a painter (Vermeer), and one stands for the SPHEREx telescope. A team member made them with OpenAI's GPT-6 image generation on 2026-11-14 (KST), during the event. They are the only AI-generated pictures on the site. No sky image is AI-generated; that stays true.

- **Where they are.** The shrunk files (192 x 192 px, WebP) are in `public/guide/`, one per character; the code that picks them is in `src/app/guide/`.
- **How they are marked.** Each picture file carries a visible "AI" mark in its top-right corner, and the note under each explanation says the character is drawn with AI ("Guide character drawn with AI. Our explanation, not a quotation."; "AI로 그린 안내 캐릭터예요. 인용이 아니라 우리가 쓴 설명이에요." in Korean). The About dialog says the same and has a switch that turns the characters off.
- **What they are used for.** When a visitor operates one of 15 analysis controls (for example the sequence picker, the wavelength group or an overlay), a character appears in the side column, or in a low bar at the bottom of the screen, with a short explanation of that control. The visitor can close it, and can switch all characters off in the card or in the About dialog.
- **Their texts.** The texts beside the pictures are explanations written with the same AI assistance as the rest of the tool (section 2). They are not quotations of the people the characters are named after, and the characters speak in no first person.
- **No NASA material.** The pictures contain no NASA logo, insignia or mission emblem. The SPHEREx character is not an official mascot, and nothing in the set is official NASA or SPHEREx artwork.
- Team to confirm: who generated the pictures and with which prompts: ______
