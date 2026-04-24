const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DELETE_ORDER = [
  'goods_receipt_items',
  'goods_receipts',
  'stock_cost_layers',
  'stock_movements',
  'purchase_order_items',
  'purchase_orders',
  'purchase_request_items',
  'purchase_requests',
];

const PRODUCT_STOCK_COLUMNS = ['stock_qty', 'stock_m2', 'stock_pieces', 'stock_m3'];

function parseArgs(argv) {
  const args = {
    execute: false,
    backupFile: '',
  };
  for (const raw of argv) {
    if (raw === '--execute') {
      args.execute = true;
      continue;
    }
    if (raw.startsWith('--backup-file=')) {
      args.backupFile = raw.slice('--backup-file='.length).trim();
    }
  }
  return args;
}

async function tableExists(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return Number(rows[0].c) > 0;
}

async function existingColumns(conn, tableName, columns) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  const existing = new Set(rows.map((row) => row.COLUMN_NAME));
  return columns.filter((col) => existing.has(col));
}

async function countTable(conn, tableName) {
  if (!(await tableExists(conn, tableName))) {
    return { exists: false, count: 0 };
  }
  const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${tableName}\``);
  return { exists: true, count: Number(rows[0].c) || 0 };
}

async function countProductsToReset(conn) {
  const cols = await existingColumns(conn, 'products', PRODUCT_STOCK_COLUMNS);
  if (!cols.length) {
    return { exists: true, count: 0, columns: [] };
  }
  const where = cols.map((col) => `COALESCE(\`${col}\`, 0) <> 0`).join(' OR ');
  const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM \`products\` WHERE ${where}`);
  return { exists: true, count: Number(rows[0].c) || 0, columns: cols };
}

function printReport(counts, backupVerified, backupFile) {
  console.log('=== Operational Cleanup Report ===');
  console.log(`Backup verified: ${backupVerified ? 'YES' : 'NO'}`);
  if (backupFile) {
    console.log(`Backup file: ${backupFile}`);
  }
  console.log('');
  for (const tableName of DELETE_ORDER) {
    const info = counts.tables[tableName];
    if (!info.exists) {
      console.log(`- ${tableName}: table not found`);
      continue;
    }
    console.log(`- ${tableName}: ${info.count} row(s)`);
  }
  if (counts.products.columns.length) {
    console.log(
      `- products stock reset (${counts.products.columns.join(', ')}): ${counts.products.count} row(s) currently non-zero`
    );
  } else {
    console.log('- products stock reset: target stock columns not found');
  }
  console.log('');
  console.log('No deletion is performed unless you pass --execute.');
}

async function runCleanup(conn, counts) {
  const deleted = {};
  for (const tableName of DELETE_ORDER) {
    const info = counts.tables[tableName];
    if (!info.exists) {
      deleted[tableName] = 0;
      continue;
    }
    const [result] = await conn.query(`DELETE FROM \`${tableName}\``);
    deleted[tableName] = Number(result.affectedRows) || 0;
  }

  let resetProducts = 0;
  if (counts.products.columns.length) {
    const setClause = counts.products.columns.map((col) => `\`${col}\` = 0`).join(', ');
    const [result] = await conn.query(`UPDATE \`products\` SET ${setClause}`);
    resetProducts = Number(result.affectedRows) || 0;
  }

  return { deleted, resetProducts };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backupFile = args.backupFile ? path.resolve(args.backupFile) : '';
  const backupVerified = backupFile ? fs.existsSync(backupFile) : false;

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false,
  });

  try {
    const counts = { tables: {}, products: { exists: true, count: 0, columns: [] } };
    for (const tableName of DELETE_ORDER) {
      counts.tables[tableName] = await countTable(conn, tableName);
    }
    counts.products = await countProductsToReset(conn);

    printReport(counts, backupVerified, backupFile);

    if (!args.execute) {
      console.log('');
      console.log('Dry run complete. To execute after confirming backup:');
      console.log('node database/cleanup-operational-data.js --backup-file="C:\\path\\to\\backup.sql" --execute');
      return;
    }

    if (!backupVerified) {
      throw new Error('Execution blocked: verified backup file is required. Use --backup-file="C:\\path\\to\\backup.sql".');
    }

    await conn.beginTransaction();
    const result = await runCleanup(conn, counts);
    await conn.commit();

    console.log('');
    console.log('=== Cleanup Completed ===');
    for (const tableName of DELETE_ORDER) {
      console.log(`- ${tableName}: deleted ${result.deleted[tableName]} row(s)`);
    }
    console.log(`- products stock fields reset: ${result.resetProducts} row(s)`);
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      /* ignore rollback error */
    }
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error('[cleanup-operational-data]', error.message || error);
  process.exit(1);
});
