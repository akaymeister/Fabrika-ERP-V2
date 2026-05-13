/**
 * patch-035 — roles.is_assignable bayrağı + legacy operasyonel rollerin pasifleştirilmesi.
 *
 * Amaç (kullanıcı planı):
 *   - roles tablosu = teknik roller (super_admin, admin, staff).
 *   - positions tablosu = operasyonel roller (Depocu, Satın almacı, vb.).
 *   - depocu / yonetici / satin_almaci rolleri "legacy" sayılır: yeni kullanıcıya
 *     atanamaz, ama silinmez ve mevcut izin atamaları (role_permissions) korunur.
 *
 * Idempotent:
 *   - Kolon yoksa eklenir, varsa atlanır.
 *   - UPDATE çalıştırması her zaman güvenli (etki yoksa 0 satır).
 *   - Mevcut roller veya role_permissions kayıtlarına dokunulmaz.
 *
 * npm run db:migrate zincirinde çalıştırılır.
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const LEGACY_OPERATIONAL_SLUGS = ['depocu', 'yonetici', 'satin_almaci'];

async function hasColumn(conn, tableName, columnName) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [tableName, columnName]
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
    if (!(await hasColumn(conn, 'roles', 'is_assignable'))) {
      await conn.query(
        "ALTER TABLE roles ADD COLUMN is_assignable TINYINT(1) NOT NULL DEFAULT 1 AFTER slug"
      );
      // eslint-disable-next-line no-console
      console.log('[patch-035] roles.is_assignable kolonu eklendi (default 1).');
    } else {
      // eslint-disable-next-line no-console
      console.log('[patch-035] roles.is_assignable zaten var, ALTER atlandı.');
    }

    const [legacyUpd] = await conn.query(
      "UPDATE roles SET is_assignable = 0 WHERE slug IN (?, ?, ?)",
      LEGACY_OPERATIONAL_SLUGS
    );
    // eslint-disable-next-line no-console
    console.log(
      `[patch-035] legacy operasyonel roller is_assignable=0 işaretlendi: ${legacyUpd.affectedRows} satır`
    );

    const [techUpd] = await conn.query(
      "UPDATE roles SET is_assignable = 1 WHERE slug IN ('super_admin', 'admin', 'staff')"
    );
    // eslint-disable-next-line no-console
    console.log(
      `[patch-035] teknik roller is_assignable=1 doğrulandı: ${techUpd.affectedRows} satır`
    );

    const [snapshot] = await conn.query(
      "SELECT id, slug, name, is_assignable FROM roles ORDER BY is_assignable DESC, slug"
    );
    // eslint-disable-next-line no-console
    console.log('[patch-035] roller (özet):');
    for (const r of snapshot) {
      const tag = r.is_assignable ? 'AKTİF' : 'LEGACY';
      // eslint-disable-next-line no-console
      console.log(`  - [${tag}] ${r.slug}  (${r.name})  id=${r.id}`);
    }

    // eslint-disable-next-line no-console
    console.log('[patch-035] tamam');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-035]', e);
  process.exit(1);
});
