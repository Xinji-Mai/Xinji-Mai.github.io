(function () {
  'use strict';
  var header = document.querySelector('.site-header');
  var nav = header && header.querySelector('.main-nav');
  if (!nav) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var current = nav.querySelector('[aria-current]');
  var indicator = nav.querySelector('.nav-indicator');
  var hover = null;
  var root = document.documentElement;
  var carried = Number(root.dataset.navArrival) || 0;
  var progress = carried;
  var last = 0;
  var frame = 0;
  var horizontalUntil = 0;
  var horizontalTimer = 0;
  var previousX = window.scrollX;
  var swipe = null;

  function render(time) {
    frame = 0;
    // Ease the glass in over the first part of the scroll, not just at a breakpoint.
    var t = Math.max(0, Math.min(1, (window.scrollY - 8) / 84));
    var horizontal = time < horizontalUntil;
    var target = horizontal ? 1 : Math.max(carried, t * t * (3 - 2 * t));
    var dt = last ? Math.min(time - last, 40) : 16;
    last = time;
    if (reduced.matches) progress = horizontal || t > .25 ? 1 : carried;
    else {
      progress += (target - progress) * (1 - Math.exp(-dt / 54));
      if (Math.abs(progress - target) < .0025) progress = target;
    }
    header.style.setProperty('--glass-presence', progress.toFixed(4));
    if (!reduced.matches && progress !== target) queue();
    else last = 0;
  }

  function queue() {
    if (!frame) frame = window.requestAnimationFrame(render);
  }

  function saveGlassForDestination(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.currentTarget;
    if (link.target && link.target !== '_self' || link.hasAttribute('download')) return;
    var next = new URL(link.href, window.location.href);
    if (next.origin !== window.location.origin || next.pathname === window.location.pathname || progress < .015) return;
    try {
      sessionStorage.setItem('site-nav-arrival', JSON.stringify({ path: next.pathname, level: progress, at: Date.now() }));
    } catch (e) {}
  }

  function revealOnSidewaysMotion() {
    // Keep momentum events in the same reveal, then let the existing easing settle.
    horizontalUntil = window.performance.now() + 240;
    window.clearTimeout(horizontalTimer);
    horizontalTimer = window.setTimeout(queue, 245);
    queue();
  }

  function sideways(dx, dy) {
    return Math.abs(dx) >= 2 && Math.abs(dx) >= Math.abs(dy) * 1.15;
  }

  window.addEventListener('wheel', function (event) {
    if (event.ctrlKey || event.metaKey) return; // Leave pinch-to-zoom alone.
    var shiftWheel = event.shiftKey && !event.deltaX;
    if (sideways(shiftWheel ? event.deltaY : event.deltaX, shiftWheel ? 0 : event.deltaY)) {
      revealOnSidewaysMotion();
    }
  }, { passive: true });

  window.addEventListener('touchstart', function (event) {
    var touch = event.touches.length === 1 && event.touches[0];
    swipe = touch ? { x: touch.clientX, y: touch.clientY, id: touch.identifier, sideways: null } : null;
  }, { passive: true });
  window.addEventListener('touchmove', function (event) {
    if (!swipe || event.touches.length !== 1) { swipe = null; return; }
    var touch = event.touches[0];
    if (touch.identifier !== swipe.id) { swipe = null; return; }
    var dx = touch.clientX - swipe.x;
    var dy = touch.clientY - swipe.y;
    if (swipe.sideways === null && Math.max(Math.abs(dx), Math.abs(dy)) >= 10) {
      swipe.sideways = sideways(dx, dy);
    }
    if (swipe.sideways && Math.abs(dx) >= 2) {
      revealOnSidewaysMotion();
      swipe.x = touch.clientX;
      swipe.y = touch.clientY;
    }
  }, { passive: true });
  window.addEventListener('touchend', function () { swipe = null; }, { passive: true });
  window.addEventListener('touchcancel', function () { swipe = null; }, { passive: true });

  function place(animate) {
    var focus = document.activeElement;
    var link = hover || (nav.contains(focus) && focus.matches('a:focus-visible') ? focus : current);
    if (!link || !indicator) {
      nav.removeAttribute('data-indicator');
      return;
    }
    var base = nav.getBoundingClientRect();
    var rect = link.getBoundingClientRect();
    var label = link.querySelector(document.documentElement.dataset.lang === 'zh' ? '.i18n-zh' : '.i18n-en');
    var width = label ? Math.max(15, label.getBoundingClientRect().width * .72) : 24;
    nav.toggleAttribute('data-indicator-motion', !!animate);
    indicator.style.setProperty('--indicator-x', (rect.left - base.left + (rect.width - 24) / 2) + 'px');
    indicator.style.setProperty('--indicator-y', (rect.bottom - base.top - 5) + 'px');
    indicator.style.setProperty('--indicator-width', String(width / 24));
    nav.setAttribute('data-indicator', '');
  }

  header.querySelectorAll('.main-nav a, .wordmark').forEach(function (link) {
    link.addEventListener('click', saveGlassForDestination);
  });
  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('pointerenter', function (event) {
      if (event.pointerType === 'mouse') { hover = link; place(true); }
    });
  });
  nav.addEventListener('pointerleave', function () { hover = null; place(true); });
  nav.addEventListener('focusin', function () { place(true); });
  nav.addEventListener('focusout', function () { window.requestAnimationFrame(function () { place(true); }); });
  window.addEventListener('scroll', function () {
    if (Math.abs(window.scrollX - previousX) >= 2) revealOnSidewaysMotion();
    previousX = window.scrollX;
    queue();
  }, { passive: true });
  window.addEventListener('pageshow', queue);
  if (reduced.addEventListener) reduced.addEventListener('change', queue);
  window.addEventListener('resize', function () { place(false); }, { passive: true });
  header.querySelectorAll('[data-language]').forEach(function (button) {
    button.addEventListener('click', function () { window.requestAnimationFrame(function () { place(false); }); });
  });
  if (document.fonts) document.fonts.ready.then(function () { place(false); });
  place(false);
  if (carried) {
    // Keep the carried surface through the destination's first painted frame.
    header.style.setProperty('--glass-presence', String(carried));
    delete root.dataset.navArrival;
    root.style.removeProperty('--nav-arrival-presence');
    window.requestAnimationFrame(function () {
      window.setTimeout(function () {
        carried = 0;
        queue();
      }, 130);
    });
  }
  queue();
}());
