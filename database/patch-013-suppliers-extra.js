/**
 * Suppliers tablosuna tedarikçi modülü için ek sütunlar:
 * phone, email, address, note, tax_number (tax_id'den kopya, daha yerleşik bir isim)
 * Idempotent.
 */
const { pool } = require('../backend/config/database');

async function hasColumn(table, column) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [table, column]
  );
  return rows && rows[0] && rows[0].c > 0;
}

async function addColumnIfMissing(table, column, ddl) {
  if (await hasColumn(table, column)) return false;
  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  return true;
}

async function run() {
  const added = [];
  if (await addColumnIfMissing('suppliers', 'phone', 'phone VARCHAR(64) NULL AFTER contact')) added.push('phone');
  if (await addColumnIfMissing('suppliers', 'email', 'email VARCHAR(191) NULL AFTER phone')) added.push('email');
  if (await addColumnIfMissing('suppliers', 'address', 'address VARCHAR(500) NULL AFTER email')) added.push('address');
  if (await addColumnIfMissing('suppliers', 'note', 'note TEXT NULL AFTER address')) added.push('note');
  if (await addColumnIfMissing('suppliers', 'tax_number', 'tax_number VARCHAR(64) NULL AFTER tax_id')) added.push('tax_number');
  console.log('[patch-013] suppliers sütunları:', added.length ? added.join(', ') : 'hepsi zaten var');
}

if (require.main === module) {
  run()
    .then(() => {
      console.log('[patch-013] tamam');
      process.exit(0);
    })
    .catch((e) => {
      console.error('[patch-013]', e);
      process.exit(1);
    });
}

module.exports = { run };
