(function () {
  'use strict';
  var header = document.querySelector('.site-header');
  var nav = header && header.querySelector('.main-nav');
  if (!nav) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var lens = nav.querySelector('.nav-lens');
  var hover = null;
  var pointer = null;
  var lensLevel = 0;
  var lensState = null;
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
    var target = horizontal ? 1 : Math.max(hover ? .86 : 0, carried, t * t * (3 - 2 * t));
    var dt = last ? Math.min(time - last, 40) : 16;
    last = time;
    if (reduced.matches) progress = horizontal || hover || t > .25 ? 1 : carried;
    else {
      progress += (target - progress) * (1 - Math.exp(-dt / 54));
      if (Math.abs(progress - target) < .0025) progress = target;
    }
    header.style.setProperty('--glass-presence', progress.toFixed(4));
    var lensMoving = drawLens(dt);
    if (lensMoving || (!reduced.matches && progress !== target)) queue();
    else last = 0;
  }

  function queue() {
    if (!frame) frame = window.requestAnimationFrame(render);
  }

  function drawLens(dt) {
    if (!lens) return false;
    var visible = hover && pointer ? 1 : 0;
    var eased = reduced.matches ? 1 : 1 - Math.exp(-dt / 38);
    function approach(value, goal, tolerance) {
      return Math.abs(value - goal) < tolerance ? goal : value + (goal - value) * eased;
    }
    var moving = false;
    if (visible) {
      var base = nav.getBoundingClientRect();
      var rect = hover.getBoundingClientRect();
      var localX = pointer.x - base.left;
      var width = Math.min(base.width, Math.max(35, rect.width - 2));
      var center = reduced.matches ? rect.left + rect.width / 2 - base.left : localX;
      var next = { x: Math.max(0, Math.min(base.width - width, center - width / 2)), y: rect.top - base.top + (rect.height - 34) / 2, w: width };
      if (!lensState || !lensLevel) lensState = next;
      else {
        lensState.x = approach(lensState.x, next.x, .15);
        lensState.y = approach(lensState.y, next.y, .15);
        lensState.w = approach(lensState.w, next.w, .15);
      }
      moving = lensState.x !== next.x || lensState.y !== next.y || lensState.w !== next.w;
      lens.style.setProperty('--lens-x', lensState.x.toFixed(2) + 'px');
      lens.style.setProperty('--lens-y', lensState.y.toFixed(2) + 'px');
      lens.style.setProperty('--lens-width', lensState.w.toFixed(2) + 'px');
      var light = Math.max(14, Math.min(86, (localX - lensState.x) / lensState.w * 100));
      lens.style.setProperty('--lens-light', light.toFixed(1) + '%');
    }
    lensLevel = approach(lensLevel, visible, .007);
    lens.style.setProperty('--lens-opacity', lensLevel.toFixed(3));
    return moving || lensLevel !== visible;
  }

  function clearHover() {
    if (hover) hover.removeAttribute('data-lens-target');
    hover = pointer = null;
    queue();
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

  header.querySelectorAll('.main-nav a, .wordmark').forEach(function (link) {
    link.addEventListener('click', saveGlassForDestination);
  });
  nav.addEventListener('pointermove', function (event) {
    if (event.pointerType !== 'mouse') return;
    var link = event.target.closest('a') || hover;
    if (!link || !nav.contains(link)) return;
    pointer = { x: event.clientX };
    if (hover !== link) {
      if (hover) hover.removeAttribute('data-lens-target');
      hover = link;
      hover.setAttribute('data-lens-target', '');
    }
    queue();
  }, { passive: true });
  nav.addEventListener('pointerleave', clearHover);
  window.addEventListener('blur', clearHover);
  window.addEventListener('scroll', function () {
    if (Math.abs(window.scrollX - previousX) >= 2) revealOnSidewaysMotion();
    previousX = window.scrollX;
    queue();
  }, { passive: true });
  window.addEventListener('pageshow', queue);
  if (reduced.addEventListener) reduced.addEventListener('change', queue);
  window.addEventListener('resize', queue, { passive: true });
  header.querySelectorAll('[data-language]').forEach(function (button) {
    button.addEventListener('click', queue);
  });
  if (document.fonts) document.fonts.ready.then(queue);
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
