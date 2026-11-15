/** Bridge the standalone guide to existing page lifecycles, without changing observation state. */
export function installTutorialHost(win, doc, page) {
  let open = false;
  const sync = () => {
    doc.documentElement.dataset.skyTutorialActive = String(open);
    if (win.__spherexApp) win.__spherexApp.setTutorialActive(open);
    else if (page === 'home') win.__hero?.setActive(!open && !doc.hidden);
  };
  const onVisibility = (event) => { open = event.detail?.open === true; sync(); };
  win.addEventListener('sky-tutorial-visibility', onVisibility);
  win.addEventListener('pageshow', sync);
  win.addEventListener('spherex-route-ready', sync);
  doc.addEventListener('visibilitychange', sync);
  sync();
  return () => {
    win.removeEventListener('sky-tutorial-visibility', onVisibility);
    win.removeEventListener('pageshow', sync);
    win.removeEventListener('spherex-route-ready', sync);
    doc.removeEventListener('visibilitychange', sync);
    open = false;
    sync();
  };
}
