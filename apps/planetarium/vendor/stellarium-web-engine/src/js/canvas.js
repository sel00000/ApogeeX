/* Stellarium Web Engine - Copyright (c) 2022 - Stellarium Labs SRL
 *
 * This program is licensed under the terms of the GNU AGPL v3, or
 * alternatively under a commercial licence.
 *
 * The terms of the AGPL v3 license can be found in the main directory of this
 * repository.
 */

Module.afterInit(function() {
  if (!Module.canvas) return;

  // XXX: remove this I guess.
  var mouseDown = false;
  var mouseButtons = 0;
  var mousePos;
  var renderRequest = null;
  var renderPaused = false;
  var activeTouches = Object.create(null);

  // Native state -2 cancels a contact without turning it into a sky click.
  function cancelContacts() {
    if (mouseDown && mousePos)
      Module._core_on_mouse(0, -2, mousePos.x, mousePos.y, mouseButtons);
    mouseDown = false;
    Object.keys(activeTouches).forEach(function(id) {
      var pos = activeTouches[id];
      Module._core_on_mouse(Number(id), -2, pos.x, pos.y, 1);
    });
    activeTouches = Object.create(null);
  }

  function scheduleRender() {
    if (!renderPaused && renderRequest === null)
      renderRequest = window.requestAnimationFrame(render);
  }

  // An embedded workbench can cover the sky completely. Keep its WebGL context,
  // selection and time controls, but do no sky work until it becomes visible.
  // core_update uses wall-clock elapsed time, so the selected time speed still
  // accounts for time spent covered when rendering resumes.
  Module['setRenderPaused'] = function(paused) {
    renderPaused = !!paused;
    if (renderPaused) {
      if (renderRequest !== null) window.cancelAnimationFrame(renderRequest);
      renderRequest = null;
      cancelContacts();
    } else {
      scheduleRender();
    }
  };

  // Function called at each frame
  var render = function(timestamp) {
    renderRequest = null;
    if (renderPaused) return;

    if (mouseDown)
      Module._core_on_mouse(0, 1, mousePos.x, mousePos.y, mouseButtons);

    // Check for canvas resize
    var canvas = Module.canvas;

    // Get the device pixel ratio, falling back to 1.
    var dpr = window.devicePixelRatio || 1;
    // Let embedded applications bound GPU cost on high-density displays.
    if (Module.maxPixelRatio > 0) dpr = Math.min(dpr, Module.maxPixelRatio);

    // Get the size of the canvas in CSS pixels.
    var rect = canvas.getBoundingClientRect();

    var displayWidth  = rect.width;
    var displayHeight = rect.height;
    // A collapsed canvas must not resize the drawing buffer or enter the native
    // renderer with a zero-sized viewport. It may become visible on a later frame.
    if (displayWidth <= 0 || displayHeight <= 0) {
      scheduleRender();
      return;
    }
    var targetWidth = Math.max(1, Math.round(displayWidth * dpr));
    var targetHeight = Math.max(1, Math.round(displayHeight * dpr));
    var sizeChanged = (canvas.width !== targetWidth) ||
                      (canvas.height !== targetHeight);

    if (sizeChanged) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    // TODO: manage paning and flicking here

    Module._core_update();
    if (renderPaused) return;
    Module._core_render(displayWidth, displayHeight, dpr);

    scheduleRender();
  }

  var fixPageXY = function(e) {
    if (e.pageX == null && e.clientX != null ) {
      var html = document.documentElement
      var body = document.body
      e.pageX = e.clientX + (html.scrollLeft || body && body.scrollLeft || 0)
      e.pageX -= html.clientLeft || 0
      e.pageY = e.clientY + (html.scrollTop || body && body.scrollTop || 0)
      e.pageY -= html.clientTop || 0
    }
  };

  var setupMouse = function() {
    var canvas = Module.canvas;
    function getMousePos(evt) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
      };
    }

    canvas.addEventListener('mousedown', function(e) {
      if (renderPaused) return;
      var that = this;
      e = e || event;
      fixPageXY(e);
      mouseDown = true;
      mousePos = getMousePos(e);
      mouseButtons = e.buttons;

      document.onmouseup = function(e) {
        if (!mouseDown) return;
        e = e || event;
        fixPageXY(e);
        mouseDown = false;
        mousePos = getMousePos(e);
        Module._core_on_mouse(0, 0, mousePos.x, mousePos.y, mouseButtons);
      };
      document.onmouseleave = function(e) {
        cancelContacts();
      };

      document.onmousemove = function(e) {
        e = e || event;
        fixPageXY(e);
        mousePos = getMousePos(e);
      }
    });

    canvas.addEventListener('touchstart', function(e) {
      if (renderPaused) return;
      var rect = canvas.getBoundingClientRect();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var id = e.changedTouches[i].identifier;
        var relX = e.changedTouches[i].clientX - rect.left;
        var relY = e.changedTouches[i].clientY - rect.top;
        activeTouches[id] = {x: relX, y: relY};
        Module._core_on_mouse(id, 1, relX, relY, 1);
      }
    }, {passive: true});
    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (renderPaused) return;
      var rect = canvas.getBoundingClientRect();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var id = e.changedTouches[i].identifier;
        if (!activeTouches[id]) continue;
        var relX = e.changedTouches[i].clientX - rect.left;
        var relY = e.changedTouches[i].clientY - rect.top;
        activeTouches[id] = {x: relX, y: relY};
        Module._core_on_mouse(id, -1, relX, relY, 1);
      }
    }, {passive: false});
    canvas.addEventListener('touchend', function(e) {
      var rect = canvas.getBoundingClientRect();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var id = e.changedTouches[i].identifier;
        if (!activeTouches[id]) continue;
        var relX = e.changedTouches[i].clientX - rect.left;
        var relY = e.changedTouches[i].clientY - rect.top;
        delete activeTouches[id];
        Module._core_on_mouse(id, 0, relX, relY, 1);
      }
    });
    canvas.addEventListener('touchcancel', cancelContacts);
    if (window.addEventListener) {
      window.addEventListener('pagehide', cancelContacts);
      window.addEventListener('blur', cancelContacts);
    }
    if (document.addEventListener) document.addEventListener('visibilitychange', function() {
      if (document.hidden) cancelContacts();
    });

    function getMouseWheelDelta(event) {
      var delta = 0;
      switch (event.type) {
        case 'DOMMouseScroll':
          delta = -event.detail;
          break;
        case 'mousewheel':
          delta = event.wheelDelta / 120;
          break;
        default:
          throw 'unrecognized mouse wheel event: ' + event.type;
      }
      return delta;
    }

    var onWheelEvent = function(e) {
      e.preventDefault();
      fixPageXY(e);
      var pos = getMousePos(e);
      var zoom_factor = 1.05;
      var delta = getMouseWheelDelta(e) * 2;
      Module._core_on_zoom(Math.pow(zoom_factor, delta), pos.x, pos.y);
      return false;
    };
    canvas.addEventListener('mousewheel', onWheelEvent, {passive: false});
    canvas.addEventListener('DOMMouseScroll', onWheelEvent, {passive: false});

    canvas.oncontextmenu = function(e) {
      e.preventDefault();
      e.stopPropagation();
    }

  };

  setupMouse();

  // Kickoff rendering at max FPS, normally 60 FPS on a browser.
  scheduleRender();
})
