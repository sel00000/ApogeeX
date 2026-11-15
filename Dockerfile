# syntax=docker/dockerfile:1
# Both stages use Debian Bookworm so the copied Node binary has matching libc.
ARG NODE_IMAGE=node:22-bookworm-slim
ARG PYTHON_IMAGE=python:3.12-slim-bookworm

FROM ${NODE_IMAGE} AS web-build
WORKDIR /app
COPY . .
# setup uses each application's committed package-lock.json with npm ci.
RUN node scripts/setup.mjs
RUN node scripts/build.mjs

FROM ${PYTHON_IMAGE} AS science-build
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/venv
COPY services/asteroids/requirements.txt /tmp/asteroid-requirements.txt
COPY services/observations/requirements.txt /tmp/observation-requirements.txt
# Keep the complete scientific dependencies; neither pipeline is replaced by a demo.
RUN /opt/venv/bin/python -m pip install --no-cache-dir --prefer-binary \
      -r /tmp/asteroid-requirements.txt -r /tmp/observation-requirements.txt \
    && /opt/venv/bin/python -m pip check \
    && /opt/venv/bin/python -m pip freeze > /opt/runtime-requirements.freeze

FROM ${PYTHON_IMAGE} AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libstdc++6 libgcc-s1 libatomic1 libgomp1 tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 spherex \
    && useradd --uid 10001 --gid spherex --create-home --shell /usr/sbin/nologin spherex
COPY --from=web-build /usr/local/bin/node /usr/local/bin/node
COPY --from=science-build /opt/venv /opt/venv
COPY --from=science-build /opt/runtime-requirements.freeze /opt/runtime-requirements.freeze
WORKDIR /app
COPY --from=web-build /app/dist ./dist
COPY --from=web-build /app/scripts ./scripts
COPY --from=web-build /app/deployment ./deployment
COPY --from=web-build /app/services ./services
COPY --from=web-build /app/apps/asteroids/scripts ./apps/asteroids/scripts
COPY --from=web-build /app/package.json ./package.json
RUN mkdir -p /app/apps/analysis/public /app/var/cache/matplotlib \
    && ln -s /app/dist/analysis/data /app/apps/analysis/public/data \
    && chown -R spherex:spherex /app/var \
    && node --version \
    && /opt/venv/bin/python --version
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000 \
    SPHEREX_PYTHON=/opt/venv/bin/python \
    PYTHONUTF8=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MPLBACKEND=Agg \
    MPLCONFIGDIR=/app/var/cache/matplotlib \
    XDG_CACHE_HOME=/app/var/cache \
    SPHEREX_MAX_RUNTIME_BYTES=536870912 \
    OPENBLAS_NUM_THREADS=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1
# Public mode is opt-in at deployment. The default local request checks stay enabled.
USER 10001:10001
# Catch missing shared libraries/import incompatibilities during the image build.
# This imports code only; it does not query an archive or run an analysis.
RUN /opt/venv/bin/python -c "import sys; sys.path.insert(0, '/app/services/asteroids'); import numpy, scipy, pandas, astropy, astroquery, matplotlib, sklearn, sbpy, synphot, yaml, requests, pyvo, PIL, reproject; from src.integration.pipeline import run_analysis; print('Scientific runtime imports ready')"
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health',{signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "scripts/serve.mjs"]
