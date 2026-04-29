/**
 * Personel Telegram alanları + kullanıcı ilk giriş şifre değişimi bayrağı
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasCol(conn, table, col) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, col]
  );
  return Number(r[0] && r[0].c) > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    if (!(await hasCol(conn, 'employees', 'telegram_username'))) {
      await conn.query('ALTER TABLE employees ADD COLUMN telegram_username VARCHAR(100) NULL');
    }
    if (!(await hasCol(conn, 'employees', 'telegram_chat_id'))) {
      await conn.query('ALTER TABLE employees ADD COLUMN telegram_chat_id VARCHAR(100) NULL');
    }
    if (!(await hasCol(conn, 'employees', 'telegram_notify_enabled'))) {
      await conn.query(
        'ALTER TABLE employees ADD COLUMN telegram_notify_enabled TINYINT(1) NOT NULL DEFAULT 1'
      );
    }
    if (!(await hasCol(conn, 'users', 'must_change_password'))) {
      await conn.query(
        'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0'
      );
    }
    // eslint-disable-next-line no-console
    console.log('[patch-021] Telegram / must_change_password tamamlandi.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-021]', e);
  process.exit(1);
});
