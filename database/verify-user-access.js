/**
 * Bir kullanıcının yetki çözümlemesini tablo halinde gösterir.
 *
 * Kullanım:
 *   node database/verify-user-access.js <username>
 *   npm run db:verify-user -- <username>
 *
 * Çıktı:
 *   - kullanıcı + rol + bağlı personel + pozisyon
 *   - must_change_password, is_active, mustChangePassword tuzağı uyarısı
 *   - role_permissions (rolden gelen izinler)
 *   - position_permissions (pozisyondan gelen izinler)
 *   - user_permissions (kullanıcıya özel ek)
 *   - effective_permissions (birleşim, listUserPermissionKeys mantığıyla aynı)
 */

const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TAG = '[verify-user-access]';

function header(text) {
  console.log('');
  console.log('============================================================');
  console.log(text);
  console.log('============================================================');
}

function printList(rows, picker) {
  if (!rows || !rows.length) {
    console.log('  (kayıt yok)');
    return;
  }
  for (const r of rows) console.log('  - ' + picker(r));
}

async function main() {
  const username = String(process.argv[2] || '').trim();
  if (!username) {
    console.error(`${TAG} Kullanım: node database/verify-user-access.js <username>`);
    process.exit(2);
  }
  if (!process.env.DB_NAME) {
    console.error(`${TAG} HATA: .env içinde DB_NAME yok.`);
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // roles.is_assignable kolonu patch-035 ile eklenir; kolon yoksa COALESCE 1 verir.
    const [hasIsAssignableRows] = await conn.query(
      "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'is_assignable'"
    );
    const hasIsAssignable = Number(hasIsAssignableRows[0]?.c) > 0;
    const roleAssignableSelect = hasIsAssignable
      ? 'COALESCE(r.is_assignable, 1) AS role_is_assignable'
      : '1 AS role_is_assignable';

    const [userRows] = await conn.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.must_change_password,
              u.role_id, r.name AS role_name, r.slug AS role_slug,
              ${roleAssignableSelect},
              e.id AS employee_id, e.employee_no, e.first_name, e.last_name,
              e.position_id, p.name AS position_name, p.code AS position_code, p.is_active AS position_active
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN employees e ON e.user_id = u.id
       LEFT JOIN positions p ON p.id = e.position_id
       WHERE u.username = ?
       LIMIT 1`,
      [username]
    );

    if (!userRows.length) {
      console.log(`${TAG} Kullanıcı bulunamadı: ${username}`);
      return;
    }
    const u = userRows[0];

    header('KULLANICI');
    console.log(`  id            : ${u.id}`);
    console.log(`  username      : ${u.username}`);
    console.log(`  full_name     : ${u.full_name}`);
    console.log(`  email         : ${u.email || '-'}`);
    console.log(`  is_active     : ${u.is_active ? 'evet' : 'HAYIR (giriş yapamaz!)'}`);
    console.log(`  must_change_password : ${u.must_change_password ? 'EVET → tüm sayfalar /my-profile.html\'e redirect' : 'hayır'}`);
    const legacyRoleTag = Number(u.role_is_assignable) === 0 ? '  ⚠ [LEGACY ROLE — yeni atama yapılamaz]' : '';
    console.log(`  role          : ${u.role_name || '-'} (${u.role_slug || '-'})  [role_id=${u.role_id}]${legacyRoleTag}`);
    if (u.employee_id) {
      console.log(`  personel      : #${u.employee_id} - ${u.employee_no || '-'}  ${[u.first_name, u.last_name].filter(Boolean).join(' ')}`);
      console.log(`  pozisyon      : ${u.position_name || '-'} (${u.position_code || '-'})  [position_id=${u.position_id || '-'}, aktif=${u.position_active ? 'evet' : 'hayır'}]`);
    } else {
      console.log('  personel      : YOK (employees.user_id bağlı değil → position_permissions çalışmaz)');
    }

    if (u.must_change_password) {
      header('UYARI: mustChangePassword TUZAĞI');
      console.log('  Bu kullanıcı şifresini değiştirmediği sürece');
      console.log('  HİÇBİR sayfayı açamaz — yetkileri olsa bile.');
      console.log('  Kullanıcı /my-profile.html ekranından şifreyi değiştirmeli.');
    }

    if (!u.is_active) {
      header('UYARI: PASİF KULLANICI');
      console.log('  Bu kullanıcı login olamaz.');
    }

    const isSuper = String(u.role_slug || '').toLowerCase() === 'super_admin';

    header('ROLDEN GELEN İZİNLER (role_permissions)');
    if (isSuper) {
      console.log('  (super_admin → permissions tablosundaki TÜM anahtarlar varsayılır)');
    } else if (!u.role_id) {
      console.log('  (rol yok)');
    } else {
      const [rolePerms] = await conn.query(
        `SELECT p.perm_key, p.name
         FROM role_permissions rp
         INNER JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = ?
         ORDER BY p.perm_key`,
        [u.role_id]
      );
      printList(rolePerms, (r) => `${r.perm_key.padEnd(40)} ${r.name || ''}`);
    }

    header('POZİSYONDAN GELEN İZİNLER (position_permissions)');
    if (!u.position_id) {
      console.log('  (pozisyon yok)');
    } else {
      const [posPerms] = await conn.query(
        `SELECT p.perm_key, p.name
         FROM position_permissions pp
         INNER JOIN permissions p ON p.id = pp.permission_id
         WHERE pp.position_id = ?
         ORDER BY p.perm_key`,
        [u.position_id]
      );
      printList(posPerms, (r) => `${r.perm_key.padEnd(40)} ${r.name || ''}`);
    }

    header('KULLANICI ÖZEL İZİNLER (user_permissions)');
    const [userPerms] = await conn.query(
      `SELECT p.perm_key, p.name
       FROM user_permissions up
       INNER JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = ?
       ORDER BY p.perm_key`,
      [u.id]
    );
    printList(userPerms, (r) => `${r.perm_key.padEnd(40)} ${r.name || ''}`);

    header('EFFECTIVE PERMISSIONS (birleşim — listUserPermissionKeys ile aynı sonuç)');
    let effective = [];
    if (isSuper) {
      const [all] = await conn.query('SELECT perm_key FROM permissions ORDER BY perm_key');
      effective = all.map((r) => r.perm_key);
    } else {
      // NOT: bu script createConnection'ı namedPlaceholders olmadan açıyor;
      // bu yüzden pozisyonel ? kullanıyoruz (backend pool'undan farkı budur).
      const [rows] = await conn.query(
        `SELECT DISTINCT p.perm_key
         FROM permissions p
         INNER JOIN (
           SELECT rp.permission_id AS pid
           FROM users u
           INNER JOIN role_permissions rp ON rp.role_id = u.role_id
           WHERE u.id = ?
           UNION
           SELECT pp.permission_id
           FROM employees e
           INNER JOIN position_permissions pp ON pp.position_id = e.position_id
           WHERE e.user_id = ?
           UNION
           SELECT permission_id AS pid FROM user_permissions WHERE user_id = ?
         ) src ON src.pid = p.id
         ORDER BY p.perm_key`,
        [u.id, u.id, u.id]
      );
      effective = rows.map((r) => r.perm_key);
    }
    if (!effective.length) {
      console.log('  (HİÇ İZİN YOK — sidebar boş kalır, modül sayfaları /?err=forbidden\'a redirect olur)');
    } else {
      console.log(`  Toplam: ${effective.length} izin`);
      for (const k of effective) console.log('  - ' + k);
    }

    header('MODÜL ERİŞİM ÖZETİ (Faz 3 granular)');
    // Modül kartının görünmesi için: kaba modül izni VEYA herhangi granular alt izin.
    // Aşağıdaki gruplar navigation.js + app.js'teki guard listeleriyle birebir uyumludur.
    const moduleGroups = [
      {
        title: 'Stok modülü',
        anyOf: [
          'module.stock',
          'stock.hub.view',
          'stock.products.view',
          'stock.brands.view',
          'stock.warehouses.view',
          'stock.in.view',
          'stock.out.view',
          'stock.movements.view',
          'stock.reports.view',
        ],
        leaves: [
          ['stock.hub.view', '  ↳ hub (özet)'],
          ['stock.products.view', '  ↳ ürünler'],
          ['stock.brands.view', '  ↳ markalar'],
          ['stock.warehouses.view', '  ↳ depolar'],
          ['stock.in.view', '  ↳ stok giriş (görüntüle)'],
          ['stock.in.create', '  ↳ stok giriş (kaydet)'],
          ['stock.out.view', '  ↳ stok çıkış (görüntüle)'],
          ['stock.out.create', '  ↳ stok çıkış (kaydet)'],
          ['stock.movements.view', '  ↳ hareketler'],
          ['stock.reports.view', '  ↳ raporlar'],
        ],
      },
      {
        title: 'Satınalma modülü',
        anyOf: [
          'module.purchasing',
          'module.purchasing.request',
          'module.purchasing.approve',
          'module.purchasing.receipt',
          'purchasing.hub.view',
          'purchasing.request.view',
          'purchasing.request.create',
          'purchasing.request.approve',
          'purchasing.processing.view',
          'purchasing.order.view',
          'purchasing.receipt.view',
          'purchasing.suppliers.view',
        ],
        leaves: [
          ['purchasing.hub.view', '  ↳ hub'],
          ['purchasing.request.view', '  ↳ talepler (görüntüle)'],
          ['purchasing.request.create', '  ↳ talep aç'],
          ['purchasing.request.approve', '  ↳ talep onayla'],
          ['purchasing.processing.view', '  ↳ sipariş işleme'],
          ['purchasing.order.view', '  ↳ siparişler (görüntüle)'],
          ['purchasing.order.price_edit', '  ↳ fiyat düzenleme'],
          ['purchasing.receipt.view', '  ↳ mal kabul (görüntüle)'],
          ['purchasing.receipt.create', '  ↳ mal kabul (kaydet)'],
          ['purchasing.suppliers.view', '  ↳ tedarikçiler'],
        ],
      },
      {
        title: 'Proje modülü',
        anyOf: ['module.projects', 'projects.hub.view', 'projects.control.view'],
        leaves: [
          ['projects.hub.view', '  ↳ hub'],
          ['projects.control.view', '  ↳ kontrol'],
        ],
      },
      {
        title: 'İK modülü',
        anyOf: [
          'module.hr',
          'hr.hub.view',
          'hr.employees.view',
          'hr.attendance.view',
          'hr.payroll.view',
          'hr.compensation.view',
        ],
        leaves: [
          ['hr.hub.view', '  ↳ hub'],
          ['hr.employees.view', '  ↳ personel (görüntüle)'],
          ['hr.employees.edit', '  ↳ personel (düzenle)'],
          ['hr.attendance.view', '  ↳ puantaj (görüntüle)'],
          ['hr.attendance.edit', '  ↳ puantaj (düzenle)'],
          ['hr.attendance.unlock', '  ↳ puantaj kilit aç'],
          ['hr.payroll.view', '  ↳ bordro (görüntüle)'],
          ['hr.payroll.edit', '  ↳ bordro (düzenle)'],
          ['hr.compensation.view', '  ↳ ücret değerlendirme'],
          ['hr.salary.edit', '  ↳ maaş düzenleme'],
        ],
      },
    ];
    const set = new Set(effective);
    const hasKey = (k) => isSuper || set.has(k);
    for (const g of moduleGroups) {
      const moduleOpen = g.anyOf.some((k) => hasKey(k));
      console.log(`  ${moduleOpen ? '[OK]' : '[--]'} ${g.title.padEnd(34)} (${g.anyOf.length} izinden en az 1 gerek)`);
      for (const [k, label] of g.leaves) {
        console.log(`    ${hasKey(k) ? '[OK]' : '[--]'} ${label.padEnd(32)} ${k}`);
      }
    }

    console.log('');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(`${TAG} Hata:`, e && e.stack ? e.stack : e);
  process.exit(1);
});
