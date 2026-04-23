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

  return session({
    name: 'fabrika.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-never-use-in-prod-........',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
      secure: process.env.NODE_ENV === 'production',
    },
  });
}

module.exports = { createSessionMiddleware };
