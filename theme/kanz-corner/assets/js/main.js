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

  /* ---------------- Mobile nav (off-canvas drawer) ---------------- */
  (function () {
    var navToggle = document.querySelector('.mobile-nav-toggle');
    var mainNav = document.querySelector('.main-nav');
    var backdrop = document.querySelector('.mobile-nav-backdrop');
    if (!navToggle || !mainNav) return;

    function setOpen(open) {
      mainNav.classList.toggle('is-open-mobile', open);
      if (backdrop) backdrop.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    }
    navToggle.addEventListener('click', function () {
      setOpen(!mainNav.classList.contains('is-open-mobile'));
    });
    document.querySelectorAll('[data-close-mobile-nav]').forEach(function (el) {
      el.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mainNav.classList.contains('is-open-mobile')) setOpen(false);
    });
    // On mobile, first tap on a mega-menu parent expands its sub-links
    mainNav.addEventListener('click', function (e) {
      if (!window.matchMedia('(max-width:960px)').matches) return;
      var parentLink = e.target.closest('.has-mega > a, .menu-item-has-children > a');
      if (!parentLink) return;
      var li = parentLink.parentElement;
      if (!li.classList.contains('is-expanded')) {
        e.preventDefault();
        li.classList.add('is-expanded');
      }
    });
    // Opening search from inside the mobile menu should close the menu
    mainNav.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-search]')) setOpen(false);
    });
  })();

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
  bindDrawer('[data-open-wish-drawer]', 'wish-drawer');

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

  /* ================= v1.1 STOREFRONT ENHANCEMENTS =================
   * Everything below only activates on the live WordPress site, where the
   * kcAjax object (localised in inc/setup.php) is present. In the static
   * /preview build these blocks no-op, so the preview keeps working. */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- Live search overlay ---------------- */
  (function () {
    var overlay = document.getElementById('kc-search-overlay');
    if (!overlay || !hasBackend) return;
    var input = document.getElementById('kc-search-input');
    var results = document.getElementById('kc-search-results');
    var triggers = document.querySelectorAll('[data-open-search]');
    var closers = overlay.querySelectorAll('[data-close-search]');
    var debounce, controller;

    function open(e) { if (e) e.preventDefault(); overlay.classList.add('is-open'); overlay.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; setTimeout(function () { input.focus(); }, 50); }
    function close() { overlay.classList.remove('is-open'); overlay.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }

    triggers.forEach(function (t) { t.addEventListener('click', open); });
    closers.forEach(function (c) { c.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('is-open')) close(); });

    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(debounce);
      if (q.length < 2) { results.innerHTML = ''; return; }
      results.innerHTML = '<p class="kc-search-status">' + esc(kcAjax.i18n.searching) + '</p>';
      debounce = setTimeout(function () {
        if (controller) controller.abort();
        controller = ('AbortController' in window) ? new AbortController() : null;
        var url = kcAjax.ajaxUrl + '?action=kc_search&nonce=' + encodeURIComponent(kcAjax.searchNonce) + '&q=' + encodeURIComponent(q);
        fetch(url, controller ? { signal: controller.signal } : {})
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.results || !data.results.length) { results.innerHTML = '<p class="kc-search-status">' + esc(kcAjax.i18n.noResults) + '</p>'; return; }
            results.innerHTML = data.results.map(function (p) {
              return '<a class="kc-search-item" href="' + esc(p.url) + '">' +
                '<span class="kc-search-thumb"><img src="' + esc(p.image) + '" alt="" loading="lazy"></span>' +
                '<span class="kc-search-meta"><span class="kc-search-cat">' + esc(p.category) + '</span>' +
                '<strong>' + esc(p.name) + '</strong><span class="kc-search-price">' + esc(p.price) + '</span></span></a>';
            }).join('') + '<a class="kc-search-all" href="' + esc(data.shopUrl) + '">' + esc('View all results') + ' →</a>';
          })
          .catch(function (err) { if (err && err.name === 'AbortError') return; results.innerHTML = '<p class="kc-search-status">' + esc(kcAjax.i18n.noResults) + '</p>'; });
      }, 260);
    });
  })();

  /* ---------------- Quick-view modal ---------------- */
  (function () {
    var modal = document.getElementById('kc-quickview-modal');
    if (!modal || !hasBackend) return;
    var content = document.getElementById('kc-quickview-content');
    var closers = modal.querySelectorAll('[data-close-modal]');

    function open() { modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
    function close() { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; content.innerHTML = ''; }

    closers.forEach(function (c) { c.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('is-open')) close(); });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-quickview]');
      if (!btn) return;
      e.preventDefault();
      var id = btn.getAttribute('data-quickview');
      content.innerHTML = '<p class="kc-modal-loading">' + esc(kcAjax.i18n.searching) + '</p>';
      open();
      fetch(kcAjax.ajaxUrl + '?action=kc_quickview&nonce=' + encodeURIComponent(kcAjax.quickvNonce) + '&id=' + encodeURIComponent(id))
        .then(function (r) { return r.json(); })
        .then(function (data) { if (data && data.success) { content.innerHTML = data.data.html; } else { close(); } })
        .catch(function () { close(); });
    });
  })();

  /* ---------------- Recently viewed ---------------- */
  (function () {
    var KEY = 'kc_recently_viewed';
    function get() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
    function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8))); } catch (e) {} }

    // Seed from the current product page.
    var seed = document.getElementById('kc-current-product');
    if (seed) {
      try {
        var p = JSON.parse(seed.textContent);
        var list = get().filter(function (x) { return String(x.id) !== String(p.id); });
        list.unshift(p);
        save(list);
      } catch (e) {}
    }

    // Render the strip (excluding the product currently being viewed).
    var mount = document.querySelector('.js-recently-viewed');
    var section = document.querySelector('.kc-recently-viewed');
    if (!mount || !section) return;
    var currentId = null;
    if (seed) { try { currentId = String(JSON.parse(seed.textContent).id); } catch (e) {} }
    var items = get().filter(function (x) { return String(x.id) !== currentId; });
    if (!items.length) return;

    mount.innerHTML = items.slice(0, 4).map(function (p) {
      return '<div class="product-card"><a href="' + esc(p.url) + '" class="thumb"><img src="' + esc(p.image) + '" alt="" loading="lazy"></a>' +
        '<div class="body"><span class="cat-label">' + esc(p.category) + '</span>' +
        '<h3><a href="' + esc(p.url) + '" style="color:inherit">' + esc(p.name) + '</a></h3>' +
        '<div class="price-row"><span class="price on-request">' + esc(p.price) + '</span>' +
        '<a href="' + esc(p.url) + '" class="btn btn-primary btn-sm cta">View</a></div></div></div>';
    }).join('');
    section.hidden = false;
  })();

  /* ================= v1.2 ================= */

  /* ---------------- Wishlist (localStorage) ---------------- */
  (function () {
    var KEY = 'kc_wishlist';
    function get() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
    function save(list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
      updateCount();
      renderDrawer();
      markButtons();
    }
    function has(id) { return get().some(function (p) { return String(p.id) === String(id); }); }
    function updateCount() {
      var n = get().length;
      document.querySelectorAll('.js-wish-count').forEach(function (el) {
        el.textContent = n;
        el.style.display = n > 0 ? 'flex' : 'none';
      });
    }
    function markButtons() {
      document.querySelectorAll('[data-wish]').forEach(function (btn) {
        btn.classList.toggle('is-active', has(btn.getAttribute('data-id')));
      });
    }
    function renderDrawer() {
      var body = document.querySelector('.js-wish-body');
      if (!body) return;
      var list = get();
      if (!list.length) {
        body.innerHTML = '<p style="color:var(--text-muted)">No saved items yet. Tap the heart on any product to save it here.</p>';
        return;
      }
      body.innerHTML = list.map(function (p) {
        return '<div style="display:flex;gap:12px;align-items:center;padding-block:12px;border-bottom:1px solid var(--border)">' +
          '<a href="' + esc(p.url) + '" style="width:56px;height:56px;background:var(--bg-subtle);border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden">' +
          (p.image ? '<img src="' + esc(p.image) + '" alt="" style="width:70%;height:70%;object-fit:contain">' : '') + '</a>' +
          '<div style="flex:1;min-width:0"><a href="' + esc(p.url) + '"><strong style="font-size:14px">' + esc(p.name) + '</strong></a>' +
          '<div style="font-size:12px;color:var(--text-muted)">' + esc(p.category || '') + '</div></div>' +
          '<button aria-label="Remove" data-wish-remove="' + esc(p.id) + '" style="background:none;border:none;color:var(--text-muted);font-size:18px;line-height:1;cursor:pointer">&times;</button></div>';
      }).join('');
      body.querySelectorAll('[data-wish-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          save(get().filter(function (p) { return String(p.id) !== String(btn.getAttribute('data-wish-remove')); }));
        });
      });
    }
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-wish]');
      if (!btn) return;
      e.preventDefault();
      var id = btn.getAttribute('data-id');
      if (has(id)) {
        save(get().filter(function (p) { return String(p.id) !== String(id); }));
      } else {
        var list = get();
        list.unshift({
          id: id,
          name: btn.getAttribute('data-name'),
          url: btn.getAttribute('data-url'),
          image: btn.getAttribute('data-image'),
          category: btn.getAttribute('data-category')
        });
        save(list);
      }
    });
    updateCount();
    renderDrawer();
    markButtons();
  })();

  /* ---------------- Banner carousel ---------------- */
  (function () {
    var track = document.querySelector('.kc-banner-track');
    if (!track) return;
    var slides = track.querySelectorAll('.kc-banner');
    if (slides.length < 2) return;
    var dotsWrap = document.querySelector('.kc-banner-dots');
    var idx = 0, timer;

    if (dotsWrap) {
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.setAttribute('aria-label', 'Banner ' + (i + 1));
        if (i === 0) b.classList.add('is-active');
        b.addEventListener('click', function () { goTo(i); restart(); });
        dotsWrap.appendChild(b);
      });
    }
    function setDots() {
      if (!dotsWrap) return;
      dotsWrap.querySelectorAll('button').forEach(function (b, i) {
        b.classList.toggle('is-active', i === idx);
      });
    }
    function goTo(i) {
      idx = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[idx].offsetLeft - track.offsetLeft, behavior: 'smooth' });
      setDots();
    }
    function restart() { clearInterval(timer); timer = setInterval(function () { goTo(idx + 1); }, 5000); }
    track.addEventListener('scroll', function () {
      clearTimeout(track._st);
      track._st = setTimeout(function () {
        var w = slides[0].offsetWidth + 16;
        idx = Math.round(track.scrollLeft / w);
        if (idx > slides.length - 1) idx = slides.length - 1;
        setDots();
      }, 80);
    }, { passive: true });
    restart();
  })();

  /* ---------------- Back to top ---------------- */
  (function () {
    var btn = document.querySelector('.kc-backtop');
    if (!btn) return;
    document.addEventListener('scroll', function () {
      btn.classList.toggle('is-visible', window.scrollY > 600);
    }, { passive: true });
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  })();

  /* ---------------- Share buttons ---------------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-share]');
    if (!btn) return;
    e.preventDefault();
    var kind = btn.getAttribute('data-share');
    var url = btn.getAttribute('data-url') || window.location.href;
    var title = btn.getAttribute('data-title') || document.title;
    if (kind === 'copy') {
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
        var old = btn.innerHTML;
        btn.innerHTML = '✓';
        setTimeout(function () { btn.innerHTML = old; }, 1500);
      }).catch(function () { window.prompt('Copy link:', url); });
    } else if (kind === 'native' && navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
    } else if (kind === 'whatsapp') {
      window.open('https://wa.me/?text=' + encodeURIComponent(title + ' ' + url), '_blank', 'noopener');
    } else if (kind === 'x') {
      window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(title) + '&url=' + encodeURIComponent(url), '_blank', 'noopener');
    }
  });
})();

/* ==========================================================================
   v1.3 — Antigravity motion pack
   Everything here is progressive enhancement: if any of it fails or the
   user prefers reduced motion, the page stays fully visible and usable.
   ========================================================================== */
(function () {
  try {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- Testimonials slider (works even with reduced motion — it's
       scroll-snap driven, auto-advance only added when motion is ok) ---- */
    (function () {
      var track = document.querySelector('.kc-testi-track');
      var dotsWrap = document.querySelector('.kc-testi-dots');
      if (!track) return;
      var slides = track.querySelectorAll('.kc-testi');
      if (slides.length < 2) return;
      var idx = 0, timer = null;
      function go(i, smooth) {
        idx = (i + slides.length) % slides.length;
        var target = slides[idx];
        track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: smooth === false ? 'auto' : 'smooth' });
        mark();
      }
      function mark() {
        if (!dotsWrap) return;
        dotsWrap.querySelectorAll('button').forEach(function (b, i) {
          b.classList.toggle('is-active', i === idx);
        });
      }
      if (dotsWrap) {
        slides.forEach(function (_, i) {
          var b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', 'Testimonial ' + (i + 1));
          b.addEventListener('click', function () { stop(); go(i); });
          dotsWrap.appendChild(b);
        });
        mark();
      }
      function start() {
        if (reduce) return;
        timer = setInterval(function () { go(idx + 1); }, 5500);
      }
      function stop() { if (timer) { clearInterval(timer); timer = null; } }
      track.addEventListener('pointerdown', stop);
      track.addEventListener('scroll', function () {
        // keep dots in sync with manual swipes
        var w = slides[0].offsetWidth + 24;
        var i = Math.round(track.scrollLeft / w);
        if (i !== idx && i >= 0 && i < slides.length) { idx = i; mark(); }
      }, { passive: true });
      start();
    })();

    if (reduce) return; // everything below is pure decoration

    document.documentElement.classList.add('kc-anim');

    /* ---- Scroll reveal: elements drift up + fade in ---- */
    var revealSel = '.section-head, .kc-photocat, ul.products li.product, .kc-certs, .quote-cta, .trust-item, .hero-stat, .kc-why-item, .kc-testi, .kc-faq-item, .kc-sector, .kc-subcat-tile';
    var revealEls = [].slice.call(document.querySelectorAll(revealSel));
    revealEls.forEach(function (el) {
      el.classList.add('kc-reveal');
      var sibs = el.parentElement
        ? [].slice.call(el.parentElement.children).filter(function (c) { return c.classList && c.classList.contains('kc-reveal'); })
        : [el];
      el.style.transitionDelay = Math.min(sibs.indexOf(el) * 65, 390) + 'ms';
    });
    function revealAll() {
      revealEls.forEach(function (el) { el.classList.add('kc-inview'); });
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('kc-inview'); io.unobserve(en.target); }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
      revealEls.forEach(function (el) { io.observe(el); });
      // Safety net: never leave content hidden, whatever happens.
      setTimeout(revealAll, 3000);
    } else {
      revealAll();
    }

    /* ---- Parallax drift on the banner carousel ---- */
    var banners = document.querySelector('.kc-banners');
    if (banners) {
      var pTick = false;
      addEventListener('scroll', function () {
        if (pTick) return;
        pTick = true;
        requestAnimationFrame(function () {
          pTick = false;
          var r = banners.getBoundingClientRect();
          if (r.bottom < 0 || r.top > innerHeight) return;
          var shift = Math.max(-18, Math.min(18, r.top * -0.06));
          banners.querySelectorAll('.kc-banner img').forEach(function (img) {
            img.style.transform = 'translateY(' + shift + 'px) scale(1.06)';
          });
        });
      }, { passive: true });
    }

    /* ---- 3D tilt on product cards (mouse/trackpad only) ---- */
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.addEventListener('pointermove', function (e) {
        var card = e.target.closest && e.target.closest('ul.products li.product');
        if (!card) return;
        var r = card.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
        card.style.transform = 'perspective(700px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-3px)';
      });
      document.addEventListener('pointerout', function (e) {
        var card = e.target.closest && e.target.closest('ul.products li.product');
        if (card && (!e.relatedTarget || !card.contains(e.relatedTarget))) {
          card.style.transform = '';
        }
      });
    }

    /* ---- Animated stat counters ---- */
    var stats = [].slice.call(document.querySelectorAll('.kc-stats-band .hero-stat b'));
    if (stats.length && 'IntersectionObserver' in window) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          cio.unobserve(en.target);
          var raw = en.target.textContent;
          var m = raw.match(/^([^0-9]*)([0-9][0-9,\.]*)(.*)$/);
          if (!m) return;
          var end = parseFloat(m[2].replace(/,/g, ''));
          if (!isFinite(end) || end <= 0) return;
          var hasComma = m[2].indexOf(',') !== -1;
          var t0 = null;
          function step(ts) {
            if (!t0) t0 = ts;
            var p = Math.min((ts - t0) / 1200, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            var val = Math.round(end * eased);
            var out = hasComma ? val.toLocaleString('en-US') : String(val);
            en.target.textContent = m[1] + out + m[3];
            if (p < 1) requestAnimationFrame(step);
            else en.target.textContent = raw;
          }
          requestAnimationFrame(step);
        });
      }, { threshold: 0.5 });
      stats.forEach(function (el) { cio.observe(el); });
    }

    /* ---- Fly-to-icon animation on add to cart / quote ---- */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.add_to_cart_button, .single_add_to_cart_button, [data-add-to-quote]');
      if (!btn) return;
      var scope = btn.closest('li.product') || btn.closest('.summary') || document;
      var img = scope.querySelector('img') || document.querySelector('.woocommerce-product-gallery img');
      var target = document.querySelector(btn.hasAttribute('data-add-to-quote') ? '[data-open-quote-drawer]' : '[data-open-cart-drawer]')
        || document.querySelector('.header-actions');
      if (!img || !target) return;
      var a = img.getBoundingClientRect(), b = target.getBoundingClientRect();
      if (!a.width || !b.width) return;
      var fly = img.cloneNode();
      fly.className = 'kc-fly-img';
      fly.style.cssText = 'left:' + a.left + 'px;top:' + a.top + 'px;width:' + a.width + 'px;height:' + a.height + 'px;';
      document.body.appendChild(fly);
      requestAnimationFrame(function () {
        fly.style.left = (b.left + b.width / 2 - 14) + 'px';
        fly.style.top = (b.top + b.height / 2 - 14) + 'px';
        fly.style.width = '28px';
        fly.style.height = '28px';
        fly.style.opacity = '0.25';
        fly.style.borderRadius = '50%';
      });
      setTimeout(function () { if (fly.parentNode) fly.parentNode.removeChild(fly); }, 900);
    });
  } catch (err) {
    // Decorative layer only — never let it break the page.
    document.documentElement.classList.remove('kc-anim');
  }
})();

/* ==========================================================================
   v1.4 — Electric-House-style header: mega menu, live search, row arrows
   ========================================================================== */
(function () {
  try {
    /* ---- Mega "Shop by Category" panel (desktop) ---- */
    var catToggle = document.querySelector('.kc-cat-toggle');
    var mega = document.getElementById('kc-mega');
    if (catToggle && mega) {
      function setMega(open) {
        mega.classList.toggle('is-open', open);
        mega.setAttribute('aria-hidden', open ? 'false' : 'true');
        catToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        catToggle.classList.toggle('is-open', open);
      }
      catToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        setMega(!mega.classList.contains('is-open'));
      });
      mega.addEventListener('click', function (e) { e.stopPropagation(); });
      document.addEventListener('click', function () { setMega(false); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setMega(false);
      });
      mega.querySelectorAll('.kc-mega-item').forEach(function (item) {
        function activate() {
          mega.querySelectorAll('.kc-mega-item').forEach(function (i) { i.classList.remove('is-active'); });
          mega.querySelectorAll('.kc-mega-pane').forEach(function (p) { p.classList.remove('is-active'); });
          item.classList.add('is-active');
          var pane = document.getElementById(item.getAttribute('data-pane'));
          if (pane) pane.classList.add('is-active');
        }
        item.addEventListener('mouseenter', activate);
        item.addEventListener('focusin', activate);
      });
    }

    /* ---- Header search: live suggestions ---- */
    var hs = document.querySelector('.kc-hsearch');
    if (hs && window.kcAjax) {
      var input = hs.querySelector('.kc-hsearch-input');
      var sugg = hs.querySelector('.kc-hsearch-sugg');
      var timer = null, lastQ = '';
      function hide() { if (sugg) { sugg.hidden = true; sugg.innerHTML = ''; } }
      if (input && sugg) {
        input.addEventListener('input', function () {
          clearTimeout(timer);
          var q = input.value.trim();
          if (q.length < 2) { hide(); return; }
          timer = setTimeout(function () {
            lastQ = q;
            fetch(kcAjax.ajaxUrl + '?action=kc_search&nonce=' + encodeURIComponent(kcAjax.searchNonce) + '&q=' + encodeURIComponent(q))
              .then(function (r) { return r.json(); })
              .then(function (data) {
                if (q !== lastQ || document.activeElement !== input) return;
                var items = (data && data.results) || [];
                if (!items.length) { hide(); return; }
                sugg.innerHTML = items.map(function (it) {
                  return '<a href="' + it.url + '"><img src="' + it.image + '" alt="" loading="lazy"><span><b>' + it.name + '</b><small>' + (it.category || '') + ' · ' + (it.price || '') + '</small></span></a>';
                }).join('') + '<button type="submit" class="kc-hsearch-all">See all results ›</button>';
                sugg.hidden = false;
              }).catch(function () { hide(); });
          }, 280);
        });
        document.addEventListener('click', function (e) {
          if (!hs.contains(e.target)) hide();
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') hide();
        });
      }
    }

    /* ---- Horizontal product rows: prev/next arrows ---- */
    document.querySelectorAll('.kc-hscroll').forEach(function (section) {
      var row = section.querySelector('ul.products');
      if (!row) return;
      var wrap = row.parentElement;
      if (!wrap || wrap.querySelector('.kc-row-nav')) return;
      wrap.classList.add('kc-row-wrap');
      ['prev', 'next'].forEach(function (dir) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'kc-row-nav kc-row-' + dir;
        b.setAttribute('aria-label', dir === 'prev' ? 'Scroll back' : 'Scroll forward');
        b.innerHTML = dir === 'prev'
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>'
          : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>';
        b.addEventListener('click', function () {
          var rtl = document.documentElement.getAttribute('dir') === 'rtl';
          var amt = Math.max(240, row.clientWidth * 0.8) * (dir === 'next' ? 1 : -1) * (rtl ? -1 : 1);
          row.scrollBy({ left: amt, behavior: 'smooth' });
        });
        wrap.appendChild(b);
      });
      function refresh() {
        var can = row.scrollWidth > row.clientWidth + 8;
        wrap.classList.toggle('kc-has-nav', can);
      }
      refresh();
      addEventListener('resize', refresh, { passive: true });
    });
  } catch (err) { /* header enhancements are decorative — never break the page */ }
})();
