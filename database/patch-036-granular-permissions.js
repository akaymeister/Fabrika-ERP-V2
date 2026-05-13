/**
 * patch-036 — Faz 3: Granular permission anahtarları + geriye uyumlu backfill.
 *
 * Kullanıcı planı:
 *   - module.X (kaba modül) izinleri korunur — eski kullanıcılar kırılmasın.
 *   - Sayfa/kart/buton/API seviyesinde yeni granular anahtarlar (view + aksiyon).
 *   - Backfill: role_permissions ve position_permissions içinde module.X olan
 *     konulara YALNIZCA *.view izinleri otomatik eklenir. create/edit/approve/
 *     price_edit/unlock gibi aksiyon izinleri otomatik VERİLMEZ (manuel verilir).
 *
 * Idempotent:
 *   - Tüm INSERT'ler IGNORE ile; tekrar çalıştırınca 0 satır eklenir.
 *   - Mevcut permission/role_permissions/position_permissions kayıtlarına dokunulmaz.
 *
 * npm run db:migrate zincirinde çalıştırılır.
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * Yeni izin kataloğu (perm_key, name, description).
 * Kullanıcının 36 izin listesinden bazıları DB'de zaten kayıtlı; INSERT IGNORE
 * mevcutları atlar.
 */
const NEW_PERMS = [
  // STOCK (10)
  ['stock.hub.view', 'Stok özet (hub) görüntüleme', 'Stok ana sayfası ve modül kartı görünürlüğü'],
  ['stock.products.view', 'Stok ürünleri görüntüleme', 'Ürünler listesi/sayfası görünürlüğü'],
  ['stock.brands.view', 'Stok markaları görüntüleme', 'Markalar listesi görünürlüğü'],
  ['stock.warehouses.view', 'Depolar görüntüleme', 'Depolar listesi görünürlüğü'],
  ['stock.in.view', 'Stok giriş görüntüleme', 'Stok giriş sayfası ve geçmişi görünürlüğü'],
  ['stock.in.create', 'Stok giriş oluşturma', 'Stok girişi kaydetme yetkisi'],
  ['stock.out.view', 'Stok çıkış görüntüleme', 'Stok çıkış sayfası ve geçmişi görünürlüğü'],
  ['stock.out.create', 'Stok çıkış oluşturma', 'Stok çıkışı kaydetme yetkisi'],
  ['stock.movements.view', 'Stok hareketleri görüntüleme', 'Hareketler listesi görünürlüğü'],
  ['stock.reports.view', 'Stok raporları görüntüleme', 'Stok raporlarına erişim'],

  // PURCHASING (10)
  ['purchasing.hub.view', 'Satınalma özet görüntüleme', 'Satınalma hub sayfası ve modül kartı görünürlüğü'],
  ['purchasing.request.view', 'Satınalma talepleri görüntüleme', 'Talepler listesi/detayı görünürlüğü'],
  ['purchasing.request.create', 'Satınalma talebi oluşturma', 'Yeni talep aç / gönder yetkisi'],
  ['purchasing.request.approve', 'Satınalma talebini onaylama', 'Talep onay/ret yetkisi'],
  ['purchasing.processing.view', 'Satınalma işleme görüntüleme', 'Sipariş işleme sayfası görünürlüğü'],
  ['purchasing.order.view', 'Satınalma siparişleri görüntüleme', 'Siparişler listesi görünürlüğü'],
  ['purchasing.order.price_edit', 'Sipariş fiyat düzenleme', 'Fiyat girme/güncelleme yetkisi'],
  ['purchasing.receipt.view', 'Mal kabul görüntüleme', 'Mal kabul sayfası görünürlüğü'],
  ['purchasing.receipt.create', 'Mal kabul oluşturma', 'Mal kabul kaydetme yetkisi'],
  ['purchasing.suppliers.view', 'Tedarikçiler görüntüleme', 'Tedarikçi listesi görünürlüğü'],

  // PROJECTS (1 yeni — diğerleri zaten DB'de)
  ['projects.hub.view', 'Proje özet görüntüleme', 'Projeler hub sayfası ve modül kartı görünürlüğü'],

  // HR (4 yeni — diğerleri zaten DB'de)
  ['hr.hub.view', 'İK özet görüntüleme', 'İK hub sayfası ve modül kartı görünürlüğü'],
  ['hr.employees.view', 'Personel görüntüleme', 'Personel listesi/detayı görünürlüğü'],
  ['hr.employees.edit', 'Personel düzenleme', 'Personel kartı düzenleme yetkisi'],
  ['hr.attendance.view', 'Puantaj görüntüleme', 'Puantaj sayfası/aylık liste görünürlüğü'],
];

/**
 * Backfill kuralı: kaba modül izni → otomatik view izinleri.
 * Aksiyon izinleri (create/edit/approve/price_edit/unlock/delete) ASLA otomatik
 * verilmez — kullanıcı kuralı.
 *
 * Format: { source: 'eski_perm', targets: ['yeni_view_1', ...] }
 */
const BACKFILL_RULES = [
  {
    source: 'module.stock',
    targets: [
      'stock.hub.view',
      'stock.products.view',
      'stock.brands.view',
      'stock.warehouses.view',
      'stock.in.view',
      'stock.out.view',
      'stock.movements.view',
      'stock.reports.view',
    ],
  },
  {
    source: 'module.purchasing',
    targets: [
      'purchasing.hub.view',
      'purchasing.request.view',
      'purchasing.processing.view',
      'purchasing.order.view',
      'purchasing.receipt.view',
      'purchasing.suppliers.view',
    ],
  },
  {
    source: 'module.purchasing.request',
    targets: ['purchasing.request.view'],
  },
  {
    source: 'module.purchasing.receipt',
    targets: ['purchasing.receipt.view'],
  },
  {
    source: 'module.hr',
    targets: ['hr.hub.view', 'hr.employees.view', 'hr.attendance.view', 'hr.payroll.view'],
  },
  {
    source: 'module.projects',
    targets: ['projects.hub.view', 'projects.control.view'],
  },
];

async function getPermIdByKey(conn, key) {
  const [rows] = await conn.query('SELECT id FROM permissions WHERE perm_key = ? LIMIT 1', [key]);
  return rows.length ? rows[0].id : null;
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
    // 1) Yeni perm anahtarlarını ekle (idempotent).
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
    console.log(`[patch-036] permissions ekleme: yeni=${inserted}, mevcut=${skipped}`);

    // 2) Backfill — role_permissions + position_permissions için view izinlerini otomatik ekle.
    const backfillRapor = [];
    for (const rule of BACKFILL_RULES) {
      const sourceId = await getPermIdByKey(conn, rule.source);
      if (!sourceId) {
        backfillRapor.push({ source: rule.source, durum: 'atlandi', sebep: 'kaynak_perm_yok' });
        continue;
      }
      for (const targetKey of rule.targets) {
        const targetId = await getPermIdByKey(conn, targetKey);
        if (!targetId) {
          backfillRapor.push({
            source: rule.source,
            target: targetKey,
            durum: 'atlandi',
            sebep: 'hedef_perm_yok',
          });
          continue;
        }

        // role_permissions backfill
        const [rpRes] = await conn.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id)
           SELECT role_id, ? AS permission_id
             FROM role_permissions
            WHERE permission_id = ?`,
          [targetId, sourceId]
        );

        // position_permissions backfill
        const [ppRes] = await conn.query(
          `INSERT IGNORE INTO position_permissions (position_id, permission_id)
           SELECT position_id, ? AS permission_id
             FROM position_permissions
            WHERE permission_id = ?`,
          [targetId, sourceId]
        );

        backfillRapor.push({
          source: rule.source,
          target: targetKey,
          role_eklendi: rpRes.affectedRows || 0,
          position_eklendi: ppRes.affectedRows || 0,
        });
      }
    }

    // eslint-disable-next-line no-console
    console.log('[patch-036] backfill özeti:');
    for (const row of backfillRapor) {
      // eslint-disable-next-line no-console
      console.log('  -', JSON.stringify(row));
    }

    // 3) Doğrulama: yeni perm sayısı + toplam.
    const [[{ c: totalPerms }]] = await conn.query('SELECT COUNT(*) AS c FROM permissions');
    // eslint-disable-next-line no-console
    console.log(`[patch-036] permissions toplam: ${totalPerms}`);

    // eslint-disable-next-line no-console
    console.log('[patch-036] tamam');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-036]', e);
  process.exit(1);
});
