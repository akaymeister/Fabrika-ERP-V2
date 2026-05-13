/**
 * Fabrika ERP V2 — Auth Context (tek permission gerçeği)
 *
 * Tüm UI katmanları (navigation.js, stock-common.js, purchasing-common.js,
 * dashboard, sayfa-içi guard'lar) `/api/auth/me` çıktısını buradan okur.
 *
 * Tek bir HTTP isteği yapılır ve sonuç sayfa ömrü boyunca cache'lenir.
 * Permission kontrolü için backend'deki listUserPermissionKeys ile aynı
 * sonucu üretir: super_admin → tüm anahtarlar, aksi halde role+position+user
 * birleşimi (server hesaplar; biz sadece tüketiriz).
 *
 * API (window.authContext):
 *   await load(force?)        -> { user } veya null (oturum yok)
 *   user()                    -> son alınmış user nesnesi (veya null)
 *   permissions()             -> string[] (boş array hiç izin yok demektir)
 *   isSuperAdmin()            -> boolean
 *   has(key)                  -> boolean
 *   hasAny(keys)              -> boolean
 *   hasAll(keys)              -> boolean
 *   roleSlug()                -> string ('' eğer yoksa)
 *   mustChangePassword()      -> boolean
 *   reset()                   -> cache'i temizler (logout / şifre değişimi sonrası)
 */
(function initAuthContext() {
  let cachedUser = null;
  let inflight = null;

  async function fetchMe() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      return data && data.user ? data.user : null;
    } catch (_) {
      return null;
    }
  }

  async function load(force) {
    if (cachedUser && !force) return cachedUser;
    if (inflight && !force) return inflight;
    inflight = fetchMe()
      .then((u) => {
        cachedUser = u;
        return u;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  function user() {
    return cachedUser;
  }

  function permissions() {
    return Array.isArray(cachedUser && cachedUser.permissions) ? cachedUser.permissions : [];
  }

  function roleSlug() {
    return String((cachedUser && cachedUser.role && cachedUser.role.slug) || '');
  }

  function isSuperAdmin() {
    if (!cachedUser) return false;
    if (cachedUser.isSuperAdmin === true) return true;
    return roleSlug() === 'super_admin';
  }

  function mustChangePassword() {
    return !!(cachedUser && cachedUser.mustChangePassword);
  }

  function has(key) {
    if (!cachedUser || !key) return false;
    if (isSuperAdmin()) return true;
    return permissions().indexOf(String(key)) !== -1;
  }

  function hasAny(keys) {
    if (!cachedUser) return false;
    if (isSuperAdmin()) return true;
    if (!Array.isArray(keys) || keys.length === 0) return false;
    const list = permissions();
    for (const k of keys) {
      if (k && list.indexOf(String(k)) !== -1) return true;
    }
    return false;
  }

  function hasAll(keys) {
    if (!cachedUser) return false;
    if (isSuperAdmin()) return true;
    if (!Array.isArray(keys) || keys.length === 0) return true;
    const list = permissions();
    for (const k of keys) {
      if (!k || list.indexOf(String(k)) === -1) return false;
    }
    return true;
  }

  function reset() {
    cachedUser = null;
    inflight = null;
  }

  /**
   * DOM gating helper — Faz 6.
   *
   * `data-perm-any="key1 key2 ..."` taşıyan her elementi tarar; kullanıcı bu
   * izinlerden en az birine sahip değilse `hidden=true` yapar. Çağrı sonrası
   * `data-perm-resolved="1"` set edilir; bu sayede CSS başlangıçta gizlediği
   * elementleri yalnız resolve sonrası gösterir (flicker olmaz).
   *
   * Süper admin tüm elemanları görür (hasAny shortcut).
   *
   * @param {ParentNode} [root=document]
   * @returns {{ total:number, shown:number, hidden:number }}
   */
  function applyActionPermissionGating(root) {
    const scope = root || document;
    let total = 0;
    let shown = 0;
    let hidden = 0;
    const nodes = scope.querySelectorAll
      ? scope.querySelectorAll('[data-perm-any]')
      : [];
    nodes.forEach((el) => {
      total += 1;
      const raw = String(el.getAttribute('data-perm-any') || '').trim();
      const keys = raw ? raw.split(/\s+/).filter(Boolean) : [];
      const ok = keys.length === 0 ? true : hasAny(keys);
      if (ok) {
        el.hidden = false;
        if (el.hasAttribute('hidden')) {
          el.removeAttribute('hidden');
        }
        shown += 1;
      } else {
        el.hidden = true;
        hidden += 1;
      }
      el.setAttribute('data-perm-resolved', '1');
    });
    return { total, shown, hidden };
  }

  window.authContext = {
    load,
    user,
    permissions,
    roleSlug,
    isSuperAdmin,
    mustChangePassword,
    has,
    hasAny,
    hasAll,
    reset,
    applyActionPermissionGating,
  };
})();
