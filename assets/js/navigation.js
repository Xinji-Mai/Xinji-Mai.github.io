(function () {
  'use strict';
  var header = document.querySelector('.site-header');
  var nav = header && header.querySelector('.main-nav');
  if (!nav) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var current = nav.querySelector('[aria-current]');
  var indicator = nav.querySelector('.nav-indicator');
  var hover = null;
  var progress = 0;
  var last = 0;
  var frame = 0;

  function render(time) {
    frame = 0;
    // Ease the glass in over the first part of the scroll, not just at a breakpoint.
    var t = Math.max(0, Math.min(1, (window.scrollY - 8) / 84));
    var target = t * t * (3 - 2 * t);
    var dt = last ? Math.min(time - last, 40) : 16;
    last = time;
    if (reduced.matches) progress = t > .25 ? 1 : 0;
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

  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('pointerenter', function (event) {
      if (event.pointerType === 'mouse') { hover = link; place(true); }
    });
  });
  nav.addEventListener('pointerleave', function () { hover = null; place(true); });
  nav.addEventListener('focusin', function () { place(true); });
  nav.addEventListener('focusout', function () { window.requestAnimationFrame(function () { place(true); }); });
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('pageshow', queue);
  if (reduced.addEventListener) reduced.addEventListener('change', queue);
  window.addEventListener('resize', function () { place(false); }, { passive: true });
  header.querySelectorAll('[data-language]').forEach(function (button) {
    button.addEventListener('click', function () { window.requestAnimationFrame(function () { place(false); }); });
  });
  if (document.fonts) document.fonts.ready.then(function () { place(false); });
  place(false);
  queue();
}());
