// A classic deferred entry keeps this shared guide outside the analysis bundle.
// Relative module URLs also work when the entire site is hosted under a project subpath.
(function () {
  'use strict';
  const script = document.currentScript;
  if (!script) return;
  const page = script.dataset.tutorialPage;
  if (!['home', 'planetarium', 'analysis', 'asteroids'].includes(page)) return;
  const uiUrl = new URL('./tutorial.js', script.src).href;
  const hostUrl = new URL('./host.js', script.src).href;
  let controller = null;
  let loading = null;
  let requested = false;
  // Language contract D1: only a stored 'ko' means Korean; anything else, or a storage error, means English.
  const lang = () => { try { return localStorage.getItem('spherex-lang') === 'ko' ? 'ko' : 'en'; } catch { return 'en'; } };
  const TEXT = {
    ko: { failed: '튜토리얼을 불러오지 못했습니다. 프로그램은 계속 사용할 수 있습니다.', retry: '다시 불러오기', close: '닫기' },
    en: { failed: 'The tutorial could not be loaded. You can keep using the site.', retry: 'Try again', close: 'Close' },
  };

  function failed() {
    if (document.getElementById('sky-tutorial-load-error')) return;
    const box = document.createElement('div');
    box.id = 'sky-tutorial-load-error';
    box.setAttribute('role', 'status');
    box.style.cssText = 'position:fixed;z-index:99999;top:78px;right:16px;max-width:min(380px,calc(100vw - 32px));padding:16px;border:1px solid #7895a8;border-radius:12px;background:#101c2d;color:#f3f0e8;font:14px/1.6 system-ui;box-shadow:0 8px 32px #0008';
    const text = document.createElement('p');
    const words = TEXT[lang()];
    box.lang = lang();
    text.textContent = words.failed;
    const retry = document.createElement('button');
    retry.type = 'button'; retry.textContent = words.retry;
    retry.addEventListener('click', () => { box.remove(); requested = true; void load(); });
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = words.close;
    close.addEventListener('click', () => box.remove());
    box.append(text, retry, close);
    document.body.append(box);
  }

  function load() {
    if (loading) return loading;
    loading = Promise.all([import(hostUrl), import(uiUrl)]).then(([host, ui]) => {
      host.installTutorialHost(window, document, page);
      const embedded = window.self !== window.top;
      controller = ui.mountTutorial({ page, autoOpen: !requested && !embedded, embedded });
      if (requested) controller.open();
      requested = false;
      document.getElementById('sky-tutorial-load-error')?.remove();
      return controller;
    }).catch((error) => {
      loading = null;
      console.warn('Tutorial could not load:', error);
      failed();
      return null;
    });
    return loading;
  }

  // A quick click while the modules are loading must still open the requested chooser.
  document.addEventListener('click', (event) => {
    if (controller || !(event.target instanceof Element) || !event.target.closest('[data-sky-tutorial-open]')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    requested = true;
    void load();
  }, true);
  void load();
})();
