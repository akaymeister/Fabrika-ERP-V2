/**
 * Temel roller + ilk yönetici kullanıcı.
 * Parola: process.env.SEED_ADMIN_PASSWORD || '1234'
 */
const path = require('path');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const ROLES = [
  { name: 'Süper Yönetici', slug: 'super_admin' },
  { name: 'Admin', slug: 'admin' },
  { name: 'PERSONEL', slug: 'staff' },
  { name: 'Yönetici', slug: 'yonetici' },
  { name: 'Satın almacı', slug: 'satin_almaci' },
  { name: 'Depocu', slug: 'depocu' },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  for (const r of ROLES) {
    await conn.query('INSERT IGNORE INTO roles (name, slug) VALUES (?, ?)', [r.name, r.slug]);
  }

  const password = process.env.SEED_ADMIN_PASSWORD || '1234';
  const passwordHash = await bcrypt.hash(password, 10);
  const username = 'admin';

  const [rows] = await conn.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  if (rows.length) {
    await conn.query('UPDATE users SET password_hash = ? WHERE username = ?', [passwordHash, username]);
    // eslint-disable-next-line no-console
    console.log('[seed] "admin" parolası güncellendi (SEED veya varsayılan).');
  } else {
    const [[sr]] = await conn.query("SELECT id FROM roles WHERE slug = 'super_admin' LIMIT 1");
    const [[ar]] = await conn.query("SELECT id FROM roles WHERE slug = 'admin' LIMIT 1");
    const roleId = sr?.id || ar?.id;
    if (!roleId) {
      throw new Error('Rol yok: önce 001 ve 002 migrasyonlarını çalıştırın (super_admin veya admin).');
    }
    await conn.query(
      'INSERT INTO users (username, email, password_hash, full_name, role_id) VALUES (?,?,?,?,?)',
      [username, 'admin@local', passwordHash, 'Sistem Yöneticisi', roleId]
    );
    // eslint-disable-next-line no-console
    console.log('[seed] "admin" kullanıcısı oluşturuldu.');
  }

  const [[superRole]] = await conn.query("SELECT id FROM roles WHERE slug = 'super_admin' LIMIT 1");
  if (superRole) {
    await conn.query('UPDATE users SET role_id = ? WHERE username = ?', [superRole.id, username]);
  }

  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[seed] Tamamlandı. Giriş: kullanıcı admin / parola', process.env.SEED_ADMIN_PASSWORD ? '(SEED_ENV)' : '1234');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[seed] Hata:', e.message);
  process.exit(1);
});
