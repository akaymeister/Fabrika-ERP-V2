/**
 * patch-037 — Faz 6: stock.products.edit izni.
 *
 * Sebep:
 *   Faz 3'te stok modülü için granular view ve in/out create izinleri
 *   eklendi ancak ürün ekleme/düzenleme/silme için özel bir aksiyon izni
 *   yoktu. Faz 6 buton gating'inde bu izin gereklidir.
 *
 * Kural:
 *   - Aksiyon izinleri (create/edit/approve/...) ASLA otomatik backfill
 *     edilmez (kullanıcı kuralı, patch-036 ile aynı politika).
 *   - Mevcut `module.stock` (kaba modül izinli) kullanıcıların buton
 *     gating'inde geriye uyumluluğu frontend tarafında sağlanır:
 *       data-perm-any="module.stock stock.products.edit"
 *   - Bu sayede bu patch yalnız perm kataloguna ekler; rol/pozisyon
 *     atamasına dokunmaz.
 *
 * Idempotent: INSERT IGNORE.
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const NEW_PERMS = [
  ['stock.products.edit', 'Stok ürün düzenleme', 'Ürün ekleme / düzenleme / silme yetkisi'],
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    let inserted = 0;
    let skipped = 0;
    for (const [key, name, desc] of NEW_PERMS) {
      const [r] = await conn.query(
        'INSERT IGNORE INTO permissions (perm_key, name, description) VALUES (?, ?, ?)',
        [key, name, desc]
      );
      if (r.affectedRows > 0) inserted += 1;
      else skipped += 1;
    }
    // eslint-disable-next-line no-console
    console.log(`[patch-037] permissions ekleme: yeni=${inserted}, mevcut=${skipped}`);
    // eslint-disable-next-line no-console
    console.log('[patch-037] tamam — backfill yok (aksiyon izni)');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-037]', e);
  process.exit(1);
});
