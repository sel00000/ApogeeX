# README figures
Sources for docs/readme/architecture.*.png and pipeline.*.png. Shared style and connector code: figure.css, figure.js.
Each page reads the language from the hash (#en or #ko) and draws connectors after fonts load (window.figReady).
Render one: node /home/sel/work/apogee-final/tools/fig.mjs architecture.html ../architecture.en.png --lang en
Repeat for --lang ko and for pipeline.html; the JSON output must show empty "overflow" and "errors".
