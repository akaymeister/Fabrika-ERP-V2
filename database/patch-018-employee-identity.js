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

async function addCol(conn, table, ddl, added) {
  const m = ddl.match(/^`?([a-zA-Z0-9_]+)`?/);
  const col = m && m[1];
  if (!col) throw new Error('Kolon adı çözümlenemedi');
  if (await hasCol(conn, table, col)) return;
  await conn.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  added.push(`${table}.${col}`);
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  try {
    const added = [];
    await addCol(conn, 'employees', 'birth_date DATE NULL AFTER nationality', added);
    await addCol(conn, 'employees', "gender ENUM('male','female','other') NULL AFTER birth_date", added);
    await addCol(conn, 'employees', 'phone_secondary VARCHAR(64) NULL AFTER phone', added);
    await addCol(conn, 'employees', 'identity_no VARCHAR(64) NULL AFTER phone_secondary', added);
    await addCol(conn, 'employees', 'passport_no VARCHAR(64) NULL AFTER identity_no', added);
    // eslint-disable-next-line no-console
    console.log('[patch-018] tamamlandı. Eklenen:', added.join(', ') || 'yok');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-018]', e);
  process.exit(1);
});
