const form = document.getElementById('loginForm');
const err = document.getElementById('loginError');
const btn = document.getElementById('loginBtn');

function t(k) {
  return window.i18n && window.i18n.t ? window.i18n.t(k) : k;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.style.display = 'none';
  btn.disabled = true;

  const body = {
    username: document.getElementById('username').value.trim(),
    password: document.getElementById('password').value,
  };

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      err.textContent =
        window.i18n && window.i18n.apiErrorText ? window.i18n.apiErrorText(data) : data.message || t('login.fail');
      err.style.display = 'block';
      return;
    }
    const u = data.user;
    if (u && u.mustChangePassword) {
      window.location.href = '/my-profile.html?mustChangePassword=1';
      return;
    }
    window.location.href = '/';
  } catch {
    err.textContent = t('login.network');
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
});
