const session = require('express-session');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

function createSessionMiddleware() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET en az 32 karakter ve production için zorunludur.');
    }
    // eslint-disable-next-line no-console
    console.warn('[session] UYARI: SESSION_SECRET kısa veya eksik. .env dosyasını doldurun.');
  }

  // Production + düz HTTP (ör. şirket içi ağ): tarayıcı Secure çerezleri göndermez.
  // Gerekirse .env: SESSION_COOKIE_SECURE=false (sadece HTTPS yokken)
  const secureDefault = process.env.NODE_ENV === 'production';
  const secureEnv = process.env.SESSION_COOKIE_SECURE;
  const secure =
    secureEnv != null && secureEnv !== ''
      ? !/^(0|false|no|off)$/i.test(String(secureEnv).trim())
      : secureDefault;

  return session({
    name: 'fabrika.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-never-use-in-prod-........',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
      secure,
    },
  });
}

module.exports = { createSessionMiddleware };
