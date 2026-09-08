(function () {
  'use strict';
  var root = document.documentElement;
  var buttons = document.querySelectorAll('[data-language]');
  function setLanguage(lang) {
    if (lang !== 'zh' && lang !== 'en') return;
    root.dataset.lang = lang;
    root.lang = lang === 'zh' ? 'zh-CN' : 'en';
    buttons.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.language === lang)); });
    try { localStorage.setItem('site-language', lang); } catch (e) {}
  }
  buttons.forEach(function (button) { button.addEventListener('click', function () { setLanguage(button.dataset.language); }); });
  setLanguage(root.dataset.lang || 'en');
  var themeButton = document.querySelector('.theme-switch');
  if (themeButton) {
    themeButton.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
    themeButton.addEventListener('click', function () {
      var dark = root.dataset.theme !== 'dark';
      root.dataset.theme = dark ? 'dark' : 'light';
      themeButton.setAttribute('aria-pressed', String(dark));
      try { localStorage.setItem('site-theme', dark ? 'dark' : 'light'); } catch (e) {}
    });
  }
}());
