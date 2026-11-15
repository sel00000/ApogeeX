// English course text. The Korean course in content.js is the structure; this file supplies the words only.
// Every Korean text has exactly one English counterpart here (checked by i18n.test.mjs).
export const TUTORIAL_NOTE_EN = 'The characters’ lines are new explanations written for teaching, not quotations of anything they said. The practice diagrams use illustrative made-up data.';

export const CHARACTERS_EN = {
  spherex: { name: 'SPHEREx', role: 'Guide to the infrared sky' },
  feynman: { name: 'Richard Feynman', role: 'Testing ideas step by step' },
  doppler: { name: 'Christian Doppler', role: 'Reading wavelength and light' },
  einstein: { name: 'Albert Einstein', role: 'Thinking about coordinates and measurement' },
  kepler: { name: 'Johannes Kepler', role: 'Watching time and motion' },
  sagan: { name: 'Carl Sagan', role: 'Interpreting discoveries with care' },
};

export const TRACKS_EN = {
  beginner: { label: 'General course', description: 'From your first sky map to reading graphs of light. You can start without any difficult maths.' },
  research: { label: 'Researcher course', description: 'Check coordinates, raw pixels, wavelength response, uncertainties and a reproducible analysis workflow.' },
};

export const REFERENCES_EN = {
  mission: 'SPHEREx official guide · Survey coverage and 102 channels',
  products: 'IRSA · SPHEREx data and calibration products',
  intro: 'IRSA · Reading images, FLAGS and VARIANCE',
  psf: 'IRSA · Using the position-dependent ePSF',
  mosaic: 'IRSA · Mosaics and photometry by wavelength',
  source: 'IRSA · Extracting a spectrum at a source position',
  release: 'IRSA · Checking data releases',
};

/** Practice hints are shared by many steps; keyed by their Korean text. */
export const HINTS_EN = {
  '사용할 수 없는 도구는 화면의 준비 상태를 확인하세요. 실습하지 않고 안내를 계속 볼 수도 있어요.':
    'If a tool is not available, check the loading status on the screen. You can also continue the guide without practising.',
  '이 실습은 품질이 확인된 준비 예제를 엽니다. 임의 좌표 영역에서는 연구 탭이 지원되지 않을 수 있어요.':
    'This practice opens a prepared example whose quality has been checked. Research tabs may not be available for regions at arbitrary positions.',
};
/** Suffix for research practices: Korean '· 준비 예제로 열기'. */
export const PREPARED_SUFFIX_EN = ' (opens a prepared example)';

export const MODULES_EN = {
  sky: { title: 'Exploring the sky', description: 'Search, star information, coordinates and time, and choosing a square region' },
  analysis: { title: 'SPHEREx analysis tools', description: 'Preparing data, comparing dates, difference images and research tabs' },
  wavelength: { title: 'Reading wavelengths and graphs', description: 'µm, 102 channels, spectra and light curves' },
  quality: { title: 'Before you trust a result', description: 'Quality flags, uncertainty, data sources and saving' },
  asteroids: { title: 'Asteroid Analysis', description: '3D orbits, saved results and new Python analyses' },
};

const q = (question, choices, explanation) => ({ question, choices, explanation });

/** Steps keyed by step id: title, body paragraphs, practice label (without the prepared suffix), check. */
export const STEPS_EN = {
  'beginner-sky-1': {
    title: 'Set off for the sky from one menu',
    body: ['Use the top menu to move between SPHEREx Analysis, Sky View and Asteroid Analysis, or open this Tutorial again. On Home you can explore the story of the SPHEREx mission and the infrared sky.',
      'Find a star or another object with Search at the top. If there are several candidates, check which one you mean before opening it. You can skip the tutorial at any time and come back to just the topics you need.'],
    practice: 'Find an object with Search at the top',
  },
  'beginner-sky-2': {
    title: 'Looking up a star is not the same as analysing data',
    body: ['Click a star or constellation in the sky to see information about it. Drag the sky to change the direction you are looking.',
      'To look at SPHEREx data, use the analysis button to turn on square region selection, then click where you want. The square is the patch of sky to analyse. There may be observations even where no stars seem to be.'],
    practice: 'Find the SPHEREx data analysis button and region selection',
  },
  'beginner-sky-3': {
    title: 'Tell a sky address from a place on Earth',
    body: ['Latitude and longitude give the place on Earth you observe from. Right ascension and declination are the address for finding an object in the sky.',
      'Switching the display between horizontal and equatorial coordinates does not move the stars. It reads the same sky against a different reference.'],
    practice: 'Compare the coordinate display options',
    check: q('What do right ascension and declination describe?', ['A direction in the sky', 'A place on Earth to observe from'],
      'A place on Earth is given by latitude and longitude; a direction on the celestial sphere by right ascension and declination.'),
  },
  'beginner-sky-4': {
    title: 'The sky clock is not the date of an observation',
    body: ['The time controls calculate the sky for that moment. The current-time button brings you back, and you can change how fast time runs.',
      'Changing the clock does not make SPHEREx take a new picture on that day. The analysis screen shows the actual stored observation times separately.'],
    practice: 'Find the button that returns to the current time',
  },
  'research-sky-1': {
    title: 'Record the coordinate frame, epoch and observer together',
    body: ['RA and Dec numbers alone do not fully define an analysis direction. Check the coordinate frame, the reference epoch, whether proper motion has been applied, and the observer.',
      'Do not compare a catalogue position directly with the apparent position at a given time. Stars with large proper motion need positions matched to the observation epoch.'],
    practice: 'Check sky coordinates and object information',
  },
  'research-sky-2': {
    title: 'Check the analysis centre and region size',
    body: ['Square selection passes on a centre coordinate and an angular size. Keep screen pixel size, angle on the sky and FITS pixel size apart.',
      'Near edges and at the poles, take the projection into account. Compare the WCS of the observed image with the real positions of stars, and leave values outside the valid area out of measurements.'],
    practice: 'Check region selection and the coordinates it passes on',
  },
  'research-sky-3': {
    title: 'Moving objects need a position for each time',
    body: ['If search has only matched a moving object’s name, it cannot be analysed straight away at fixed coordinates. Link the object identifier, the exposure time and the predicted position with SPHEREx as the observer.',
      'An ordinary region query is an archive search at fixed coordinates. Keep it apart from tracking motion over time and from confirmed asteroid detections.'],
    practice: 'Check the object type in search results',
  },
  'research-sky-4': {
    title: 'Keep screen time and observation provenance separate',
    body: ['The time in the sky simulation, the time the data were taken and the time of a position prediction play different roles. Also check the time zone and the time scale, such as UTC or TDB.',
      'Share links are handy for reproducing a screen, but they do not replace keeping the full original data. Record the data source and processing conditions separately.'],
    practice: 'Tell sky time from actual observation time',
  },
  'beginner-analysis-1': {
    title: 'Start with a prepared target',
    body: ['Featured targets come with observation images and research data prepared in advance. Pick one first and read its dates and data status.',
      'For an arbitrary position, the server prepares the data. “Preparing”, “no data” and “failed to load” are different states. Arbitrary regions may not offer every research tool that featured targets have.'],
    practice: 'Check the target and its data status',
  },
  'beginner-analysis-2': {
    title: 'Change the date to compare',
    body: ['Change the observation date on the timeline and press play to step through the prepared images in order. Real observations may not be evenly spaced.',
      'In the 3D space-time view, height stands for time. Do not read it as a 3D map of the real distances to the stars.'],
    practice: 'Find the observation dates and playback controls',
  },
  'beginner-analysis-3': {
    title: 'A difference image is a tool for finding clues',
    body: ['An A−B difference image highlights where two images differ. Even if some places look brighter or fainter, that does not confirm a change in the object.',
      'Differences in wavelength, star shape, alignment errors and defects also leave residuals. Display colours and thresholds do not mean the same as a research detection probability.'],
    practice: 'Read the comparison conditions for images and difference images',
    check: q('If a bright spot appears in a difference image, is it a discovery?', ['No. Wavelength, quality and other checks are needed', 'Yes. If it shows in the difference image, it is confirmed'],
      'A difference image is a clue for exploring. Check the observing conditions and repeated measurements.'),
  },
  'beginner-analysis-4': {
    title: 'Choose the graph that fits your question',
    body: ['In the Analyse view you can see position measurements, the Spectrum lab and data provenance. Variability analysis opens for targets that support it.',
      'Read the axes and units together with excluded data and model assumptions. For targets without a tool, the site does not make up missing values to show you.'],
    practice: 'Open the Spectrum lab in the Analyse view',
  },
  'research-analysis-1': {
    title: 'Check the query scope and the prepared sample',
    body: ['Featured targets and region data at arbitrary positions differ in what they contain and which features they support. Record the period, visit grouping, wavelength and detector range, and exclusion criteria.',
      'A successful query does not mean the data are complete. Do not read an external error as “no observations”; check the failure state and the result of a retry.'],
    practice: 'Check the data type and its ready or failed state',
  },
  'research-analysis-2': {
    title: 'Verify the comparison conditions of a difference image',
    body: ['Differences between reprojected display images are not the same as quantitative photometry on the original pixels. Review the wavelength, background, PSF, alignment residuals and valid area.',
      'Difference images and colour filters are for exploration. Do not convert display thresholds into detection significance; confirm candidates with proper measurements and repeat observations.'],
    practice: 'Check the limits and observing conditions of difference images',
  },
  'research-analysis-3': {
    title: 'Tell position residuals from a real track',
    body: ['Position measurement looks at the difference between measured positions and positions predicted from a catalogue. Residuals are affected by measurement error and model assumptions.',
      'A 3D chart that shows time as height is a way of arranging observations. Do not read it as physical depth, independent detections or an orbit determination for a moving object.'],
    practice: 'Open the Positions tab',
  },
  'research-analysis-4': {
    title: 'Check the sample and trial period in the variability tool',
    body: ['In variability analysis, check the wavelength sample, quality exclusions, uncertainties and observation spacing. Mixing different wavelengths can make spectral differences look like variability.',
      'A trial period for phase folding is a hypothesis. Data lining up at a period the user chose does not by itself mean that a period has been detected.'],
    practice: 'Open variability analysis for RW Aur or R Dra',
  },
  'beginner-wavelength-1': {
    title: 'Wavelength is a length that tells kinds of light apart',
    body: ['Wavelength is the spacing at which the same shape repeats in a wave of light. µm means micrometre, and 1 µm is one millionth of a metre.',
      'SPHEREx looks at roughly 0.75–5 µm in 102 nominal channels. The colours on screen are there to tell infrared values apart; they are not the colours your eyes would see.'],
  },
  'beginner-wavelength-2': {
    title: 'Start with the horizontal axis of a spectrum',
    body: ['The horizontal axis is wavelength: further right means longer wavelength. The vertical axis shows how much light was measured at that wavelength.',
      'Flux density in mJy and pixel brightness in an image are not the same number. Read the axis units first. A point further right does not mean it was taken later, either.'],
    practice: 'Check the axes and units of the spectrum graph',
    check: q('What increases as you move right along a spectrum?', ['Observation date', 'Wavelength', 'Declination in the sky'],
      'Brightness over time is read from a light curve. The horizontal axis of a spectrum is wavelength.'),
  },
  'beginner-wavelength-3': {
    title: 'A different filter can give a different brightness',
    body: ['The wavelength a SPHEREx filter lets through depends on the position on the detector. If the same star is observed at a different position, a different kind of light is seen.',
      'If the brightness changes after you choose a wavelength, do not say straight away that the star changed over time. Read the D1–D6 detector labels together with the actual wavelength.'],
    practice: 'Check the wavelength and detector controls',
  },
  'beginner-wavelength-4': {
    title: 'Peaks and dips are clues to check',
    body: ['Rises and dips are clues for understanding an object. A single point cannot settle what it is made of or its temperature.',
      'Look at uncertainties, quality flags and repeat observations together. The curve below is not real data from an object; it is made-up data for practising graph reading.'],
    check: q('Can the practice curve tell us what a real object is made of?', ['No. It is a made-up example for learning to read graphs', 'Yes. It is a real observation'],
      'Real results are checked in the analysis screen, which shows the target and the data source.'),
  },
  'research-wavelength-1': {
    title: 'Tell channels from the actual wavelength response',
    body: ['A measurement has passed through a finite passband. Keep the central wavelength, bandwidth, nominal channel number and detector position apart.',
      'The same channel number does not guarantee an identical full response function. When comparing epochs, check the actual wavelength samples and differences in response.'],
  },
  'research-wavelength-2': {
    title: 'Tell Fν on a λ axis from image surface brightness',
    body: ['Even with µm on the horizontal axis, mJy on the vertical axis is Fν, flux density per unit frequency. Do not confuse it with Fλ and integrate the area under the graph as it is.',
      'MJy/sr is surface brightness. It means something different from mJy photometry, which has gone through aperture, background, pixel solid angle and calibration conditions. 1 Jy = 10⁻²⁶ W m⁻² Hz⁻¹.'],
    practice: 'Read the λ and Fν units of the spectrum graph',
  },
  'research-wavelength-3': {
    title: 'Blackbody curves and absorption depths are model comparisons',
    body: ['A blackbody curve and a temperature fit compare a fixed model with selected data. Do not treat the fitted temperature as an independently confirmed physical value.',
      'Check quality exclusions, uncertainties, continuum assumptions and the instrument response. An absorption depth summarises a candidate feature; it is not enough on its own to identify a substance.'],
    practice: 'Check model assumptions, quality exclusions and uncertainties',
  },
  'research-wavelength-4': {
    title: 'Exploring wavelengths does not measure velocity',
    body: ['Interpreting a line shift needs a review of the reference wavelength, instrument response, continuum and noise model. Selecting a wavelength is not an action that measures an observed velocity.',
      'The general wavelength explorer on this site does not replace a procedure for precise radial velocity or redshift estimation. A final interpretation needs validated models and independent observations.'],
    check: q('Does changing the wavelength selection measure a radial velocity?', ['No. It chooses which observed wavelength to display', 'Yes. The chosen wavelength is the velocity'],
      'Velocity needs a separate estimate that includes a reference feature and models of the response and noise.'),
  },
  'beginner-quality-1': {
    title: 'An empty value is not zero brightness',
    body: ['Edges, saturation and detector defects leave values that cannot be used. Replacing missing values with 0 can give the wrong brightness and the wrong amount of change.',
      'The hatching below is a made-up example of excluded areas. On the real screen, read the missing-data and quality notes and the number of excluded measurements. Not every screen uses the same hatching.'],
  },
  'beginner-quality-2': {
    title: 'Error bars are part of the result',
    body: ['Even repeated measurements can come out slightly different. Error bars help you read the uncertainty alongside the value.',
      'Do not confirm a change from a small difference in brightness alone. Check the wavelength, quality and repeat observations. “Processing complete” and “high confidence” mean different things.'],
    check: q('Once processing is complete, is the result certain?', ['No. Quality and uncertainty need checking separately', 'Yes. Complete means high confidence'],
      '“Complete” is a processing status. Data quality and model confidence are checked separately.'),
  },
  'beginner-quality-3': {
    title: 'Keep sources in your discovery notes',
    body: ['In the Provenance tab, check what was observed, when, and which data were used. You can compare again with the CSV and share link provided.',
      'Write down the target, date and wavelength, and what you could not check. That makes a better observation record than saving the picture alone.'],
    practice: 'Find data provenance and the exports provided',
  },
  'research-quality-1': {
    title: 'Check the quality mask and measurement method',
    body: ['Check the FLAGS exclusion criteria, the original variance, the background estimate and PSF assumptions. Also check that the quality criteria applied to image display and to photometry are consistent.',
      'Saturation, persistence, detector defects and crowding affect results. Do not assume every measurement is valid because the image looks clean.'],
    practice: 'Check quality exclusions and measurement status in the spectrum',
  },
  'research-quality-2': {
    title: 'Tell independent errors from shared errors',
    body: ['Averaging does not shrink every uncertainty at the same rate. Common calibration, background and normalisation references can correlate values.',
      'Keep apart the error components the current tool actually includes and the assumptions it does not. The example below explains the idea of shared error; it does not vouch for the error model of the whole program.'],
    check: q('Does a shared calibration error always shrink as 1/√N when averaged N times?', ['No. The shared part can remain', 'Yes. All errors shrink at the same rate'],
      'Correlated errors must be calculated with their covariance.'),
  },
  'research-quality-3': {
    title: 'Record the processing version and the basis for interpretation',
    body: ['Keep the original URI, release and processing version, target and period, quality exclusions, units and model settings. Re-running and comparing with other tools need these conditions.',
      'Data existing, processing complete, detection candidate, classification and physical interpretation are separate stages. If a result lacks data or depends heavily on the model, present it as undecided and give the reason.'],
    practice: 'Check sources, processing conditions and exports',
  },
  'beginner-asteroids-1': {
    title: 'Pick an asteroid to see its orbit and observations',
    body: ['Choose a target in the asteroid menu to see its prepared orbit, observation images and analysis results. Check that the number and the name refer to the same object.',
      'The 3D rock is an illustrative model to help you explore. Do not take it as the real surface shape reconstructed by SPHEREx or as true size ratios.'],
    practice: 'Choose an asteroid target',
  },
  'beginner-asteroids-2': {
    title: 'A new analysis and 3D preparation are separate steps',
    body: ['When the server’s analysis feature is available, you can enter a target and a period to request a new analysis, then follow its progress or cancel it.',
      'Even when analysis results are ready, the 3D orbit and images may be prepared separately. Tell “no data” from “failed”, and look at the saved results first, too.'],
    practice: 'Check the conditions for a new analysis and the server status',
  },
  'beginner-asteroids-3': {
    title: 'Read diameter and classification with their evidence',
    body: ['Diameters come in different kinds: thermal model estimates, statistical estimates, catalogue values and more. Do not read them as one number; check the name and source.',
      'Even after processing finishes, confidence may be low or the verdict may be left undecided. For mass and density, also check which external data and assumptions they come from.'],
    practice: 'Read result types, confidence and why a verdict is undecided',
  },
  'research-asteroids-1': {
    title: 'Match identifier, time and observer',
    body: ['The same asteroid appears at different places in the sky depending on the time and the observer. Link the predicted position with SPHEREx as the observer to the exposure time.',
      'The heliocentric ecliptic coordinates of the 3D view and the right ascension and declination of the images are different representations. Check the coordinate frame, units and UTC/TDB together, and do not extrapolate beyond the range.'],
    practice: 'Check the orbit, observation times and spacecraft view',
  },
  'research-asteroids-2': {
    title: 'Tell measurements from estimates that use priors',
    body: ['Classification and thermal model results are affected by quality exclusions, solar analogue correction, separating reflected light from thermal emission, and prior distributions.',
      'Keep apart thermal model diameters, statistical diameters that use H and albedo priors, combined diameters and catalogue values. Do not present an estimate as a direct measurement or reuse it as independent validation data.'],
    practice: 'Check results by method, with sources and uncertainties',
  },
  'research-asteroids-3': {
    title: 'A finished job is not scientific validation',
    body: ['Keep the target identifier and the analysis run ID apart, so that results with different periods and settings are stored separately. Also check the versions of the analysis originals, the web results and the 3D data.',
      '“Complete” is a processing status and does not guarantee high classification confidence. Tell failed external queries, too few observations and undecided results apart, and review the evidence in the report.'],
    practice: 'Check job status, period and the run ID of results',
  },
};
