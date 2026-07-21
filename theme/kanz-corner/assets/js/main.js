/*
 * KANZ CORNER TRADING — front-end interactions
 * Framework-free vanilla JS. In the WordPress theme this file is enqueued by
 * inc/setup.php. The quote-cart calls in this file post to
 * inc/quote-system.php's AJAX endpoints on the live site; in the static
 * /preview build (no PHP backend) they fall back to localStorage only, see
 * the `hasBackend` check below.
 */
(function () {
  'use strict';

  var hasBackend = typeof window.kcAjax !== 'undefined';

  /* ---------------- Sticky header shadow ---------------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- Mobile nav ---------------- */
  var navToggle = document.querySelector('.mobile-nav-toggle');
  var mainNav = document.querySelector('.main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      var open = mainNav.classList.toggle('is-open-mobile');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------------- Drawer helper (cart / quote list) ---------------- */
  function bindDrawer(triggerSelector, drawerId) {
    var drawer = document.getElementById(drawerId);
    if (!drawer) return;
    var overlay = drawer.parentElement.querySelector('.drawer-overlay') || document.querySelector('.drawer-overlay[data-for="' + drawerId + '"]');
    var closeBtns = drawer.querySelectorAll('[data-drawer-close]');
    var triggers = document.querySelectorAll(triggerSelector);

    function open() {
      drawer.classList.add('is-open');
      if (overlay) overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      drawer.classList.remove('is-open');
      if (overlay) overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    }
    triggers.forEach(function (t) { t.addEventListener('click', function (e) { e.preventDefault(); open(); }); });
    closeBtns.forEach(function (b) { b.addEventListener('click', close); });
    if (overlay) overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
  bindDrawer('[data-open-quote-drawer]', 'quote-drawer');
  bindDrawer('[data-open-cart-drawer]', 'cart-drawer');

  /* ---------------- Quote list (localStorage-backed for preview) ---------------- */
  var QUOTE_KEY = 'kc_quote_list';

  function getQuoteList() {
    try { return JSON.parse(localStorage.getItem(QUOTE_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveQuoteList(list) {
    localStorage.setItem(QUOTE_KEY, JSON.stringify(list));
    updateQuoteCount();
  }
  function updateQuoteCount() {
    var count = getQuoteList().length;
    document.querySelectorAll('.js-quote-count').forEach(function (el) {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  }
  function addToQuote(product) {
    var list = getQuoteList();
    if (!list.some(function (p) { return p.id === product.id; })) {
      list.push(product);
      saveQuoteList(list);
    }
    renderQuoteDrawer();
  }
  function removeFromQuote(id) {
    saveQuoteList(getQuoteList().filter(function (p) { return p.id !== id; }));
    renderQuoteDrawer();
  }
  function renderQuoteDrawer() {
    var body = document.querySelector('#quote-drawer .drawer-body');
    if (!body) return;
    var list = getQuoteList();
    if (!list.length) {
      body.innerHTML = '<p style="color:var(--text-muted)">No items added yet. Browse products and tap "Request Quote" to add them here.</p>';
      return;
    }
    body.innerHTML = list.map(function (p) {
      return '<div style="display:flex;gap:12px;align-items:center;padding-block:12px;border-bottom:1px solid var(--border)">' +
        '<div style="width:56px;height:56px;background:var(--bg-subtle);border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden">' +
        (p.image ? '<img src="' + p.image + '" alt="" style="width:70%;height:70%;object-fit:contain">' : '') +
        '</div>' +
        '<div style="flex:1"><strong style="font-size:14px">' + p.name + '</strong><div style="font-size:12px;color:var(--text-muted)">' + (p.category || '') + '</div></div>' +
        '<button aria-label="Remove" data-remove="' + p.id + '" style="background:none;border:none;color:var(--text-muted);font-size:18px;line-height:1">&times;</button>' +
        '</div>';
    }).join('');
    body.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () { removeFromQuote(btn.getAttribute('data-remove')); });
    });
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add-to-quote]');
    if (!btn) return;
    e.preventDefault();
    addToQuote({
      id: btn.getAttribute('data-id'),
      name: btn.getAttribute('data-name'),
      category: btn.getAttribute('data-category'),
      image: btn.getAttribute('data-image')
    });
    var drawer = document.getElementById('quote-drawer');
    if (drawer) {
      drawer.classList.add('is-open');
      var overlay = document.querySelector('.drawer-overlay[data-for="quote-drawer"]');
      if (overlay) overlay.classList.add('is-open');
    }
    btn.textContent = btn.getAttribute('data-added-label') || 'Added ✓';
    setTimeout(function () {
      btn.textContent = btn.getAttribute('data-default-label') || 'Request Quote';
    }, 1800);
  });
  updateQuoteCount();
  renderQuoteDrawer();

  /* ---------------- Qty stepper ---------------- */
  document.querySelectorAll('.qty-stepper').forEach(function (stepper) {
    var input = stepper.querySelector('input');
    var minus = stepper.querySelector('[data-step="-1"]');
    var plus = stepper.querySelector('[data-step="1"]');
    function clamp(v) {
      var min = parseInt(input.min || '1', 10);
      return Math.max(min, v);
    }
    if (minus) minus.addEventListener('click', function () { input.value = clamp((parseInt(input.value, 10) || 1) - 1); });
    if (plus) plus.addEventListener('click', function () { input.value = clamp((parseInt(input.value, 10) || 1) + 1); });
  });

  /* ---------------- Product tabs ---------------- */
  document.querySelectorAll('.tabs').forEach(function (tabs) {
    var buttons = tabs.querySelectorAll('.tab-list button');
    var panels = tabs.querySelectorAll('.tab-panel');
    buttons.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('is-active'); });
        panels.forEach(function (p) { p.hidden = true; });
        btn.classList.add('is-active');
        panels[i].hidden = false;
      });
    });
  });

  /* ---------------- Language switch (visual only in preview) ---------------- */
  document.querySelectorAll('.lang-switch button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.hasAttribute('data-href')) {
        window.location.href = btn.getAttribute('data-href');
        return;
      }
      document.querySelectorAll('.lang-switch button').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var isAr = btn.getAttribute('data-lang') === 'ar';
      document.documentElement.setAttribute('dir', isAr ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', isAr ? 'ar' : 'en');
    });
  });
})();
