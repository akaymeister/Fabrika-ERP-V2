/**
 * Marka logosu yardımcısı.
 *
 * Kullanım:
 *   <script src="/js/brand.js" defer></script>
 *   <img data-brand-logo data-brand-fallback="AHK" alt="Logo" />
 *
 * Sayfa yüklenince `/api/public/config` üzerinden logoyu çeker ve
 * `[data-brand-logo]` özniteliği taşıyan tüm `<img>` öğelerinin `src` değerini günceller.
 * Logo tanımlı değilse `data-brand-fallback` metni `<img>` öğesinin yanındaki
 * `<span data-brand-fallback-target>` veya öğenin `alt` değerine yedeklenir.
 *
 * Programatik kullanım:
 *   const url = await window.brand.getLogoUrl();
 *   window.brand.applyLogo('#myLogo');
 */
(function () {
  let cachedUrlPromise = null;

  async function fetchLogoUrl(force) {
    if (!force && cachedUrlPromise) return cachedUrlPromise;
    cachedUrlPromise = (async () => {
      try {
        const r = await fetch('/api/public/config', { cache: 'no-store', credentials: 'same-origin' });
        if (!r.ok) return '';
        const d = await r.json().catch(() => ({}));
        const u = d && (d.brandLogoUrl || (d.data && d.data.brandLogoUrl));
        return typeof u === 'string' ? u : '';
      } catch (_) {
        return '';
      }
    })();
    return cachedUrlPromise;
  }

  function setImgSource(img, url) {
    if (!img) return;
    if (url) {
      img.src = url;
      img.hidden = false;
      img.removeAttribute('aria-hidden');
    } else {
      img.removeAttribute('src');
      img.hidden = true;
    }
  }

  async function applyLogo(target) {
    const url = await fetchLogoUrl();
    let nodes;
    if (!target) {
      nodes = document.querySelectorAll('img[data-brand-logo]');
    } else if (typeof target === 'string') {
      nodes = document.querySelectorAll(target);
    } else if (target instanceof Element) {
      nodes = [target];
    } else {
      nodes = [];
    }
    nodes.forEach((el) => {
      if (el && el.tagName === 'IMG') setImgSource(el, url);
    });
    return url;
  }

  function init() {
    if (document.querySelector('img[data-brand-logo]')) {
      applyLogo();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.brand = {
    getLogoUrl: (force) => fetchLogoUrl(!!force),
    applyLogo,
    refresh: () => {
      cachedUrlPromise = null;
      return applyLogo();
    },
  };
})();
