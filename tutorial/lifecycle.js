/** Publish state before events so consumers registered before the optional host bridge agree. */
export function publishVisibility(win, doc, open, phase) {
  doc.documentElement.dataset.skyTutorialActive=String(open);
  const EventType=win.CustomEvent ?? CustomEvent;
  win.dispatchEvent(new EventType('sky-tutorial-visibility',{detail:{open,phase}}));
}

/** Lock only page scrolling, leaving the dialog's own scroll areas usable. */
export function createScrollLock(win, doc) {
  let saved=null;
  return (locked) => {
    if(locked) {
      if(saved)return;
      const elements=[doc.documentElement,doc.body].filter(Boolean);
      saved={left:win.scrollX,top:win.scrollY,styles:elements.map(element=>({
        element,value:element.style.getPropertyValue('overflow'),priority:element.style.getPropertyPriority('overflow'),
      }))};
      for(const {element} of saved.styles)element.style.setProperty('overflow','hidden','important');
      return;
    }
    if(!saved)return;
    const restore=saved;saved=null;
    for(const {element,value,priority} of restore.styles) {
      if(value)element.style.setProperty('overflow',value,priority);
      else element.style.removeProperty('overflow');
    }
    if(win.scrollX!==restore.left || win.scrollY!==restore.top)win.scrollTo({left:restore.left,top:restore.top,behavior:'instant'});
  };
}
