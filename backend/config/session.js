const session = require('express-session');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const SESSION_COOKIE_NAME = 'fabrika.sid';

function computeCookieSecure() {
  const secureDefault = process.env.NODE_ENV === 'production';
  const secureEnv = process.env.SESSION_COOKIE_SECURE;
  return secureEnv != null && secureEnv !== ''
    ? !/^(0|false|no|off)$/i.test(String(secureEnv).trim())
    : secureDefault;
}

/**
 * Oturum çerezi ile clearCookie aynı path / httpOnly / sameSite / secure olmalı.
 * maxAge burada yok; setCookie tarafında express-session ekler.
 */
function sessionCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: computeCookieSecure(),
  };
}

function createSessionMiddleware() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET en az 32 karakter ve production için zorunludur.');
    }
    // eslint-disable-next-line no-console
    console.warn('[session] UYARI: SESSION_SECRET kısa veya eksik. .env dosyasını doldurun.');
  }

  return session({
    name: SESSION_COOKIE_NAME,
    secret: process.env.SESSION_SECRET || 'dev-only-never-use-in-prod-........',
    resave: false,
    saveUninitialized: false,
    cookie: {
      ...sessionCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
    },
  });
}

module.exports = {
  createSessionMiddleware,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
};
