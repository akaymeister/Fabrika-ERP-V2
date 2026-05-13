/**
 * Fabrika ERP V2 — Patch Runner
 *
 * Amaç:
 *   - database/patch-*.js dosyalarını doğal/alfanumerik sıraya göre çalıştırır.
 *   - Her başarılı patch'i schema_migrations tablosuna kaydeder.
 *   - Daha önce çalışmış patch'leri tekrar çalıştırmaz (idempotent runner).
 *   - Hata olursa migration'ı durdurur ve hangi patch'in patladığını net yazar.
 *
 * Kullanım:
 *   node database/run-patches.js              -> bekleyen tüm patch'leri çalıştır
 *   node database/run-patches.js --status     -> uygulanmış / bekleyen patch listesi
 *   node database/run-patches.js --only=patch-006.js
 *   node database/run-patches.js --redo=patch-006.js   (kayıttan siler + yeniden çalıştırır)
 *   node database/run-patches.js --dry-run    -> sadece hangi patch'lerin çalışacağını yazar
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PATCH_DIR = __dirname;
const PATCH_PATTERN = /^patch-\d{3}[a-z]?-?.*\.js$/i;
const TAG = '[patches]';

function parseArgs(argv) {
  const args = { status: false, dryRun: false, only: null, redo: null };
  for (const raw of argv.slice(2)) {
    if (raw === '--status') args.status = true;
    else if (raw === '--dry-run') args.dryRun = true;
    else if (raw.startsWith('--only=')) args.only = raw.slice('--only='.length);
    else if (raw.startsWith('--redo=')) args.redo = raw.slice('--redo='.length);
    else {
      console.error(`${TAG} bilinmeyen argüman: ${raw}`);
      process.exit(2);
    }
  }
  return args;
}

function discoverPatches() {
  const files = fs
    .readdirSync(PATCH_DIR)
    .filter((f) => PATCH_PATTERN.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return files.map((filename) => {
    const fullPath = path.join(PATCH_DIR, filename);
    const buf = fs.readFileSync(fullPath);
    const checksum = crypto.createHash('sha256').update(buf).digest('hex');
    return { filename, fullPath, checksum };
  });
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      filename VARCHAR(190) NOT NULL,
      checksum CHAR(64) NOT NULL,
      duration_ms INT UNSIGNED NULL,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_schema_migrations_filename (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function loadAppliedMap(conn) {
  const [rows] = await conn.query(
    'SELECT filename, checksum, executed_at FROM schema_migrations'
  );
  const map = new Map();
  for (const r of rows) map.set(r.filename, r);
  return map;
}

function runPatchProcess(fullPath) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [fullPath], {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..'),
  });
  return {
    code: result.status,
    signal: result.signal,
    error: result.error,
    durationMs: Date.now() - started,
  };
}

async function recordSuccess(conn, patch, durationMs) {
  await conn.query(
    `INSERT INTO schema_migrations (filename, checksum, duration_ms)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE checksum = VALUES(checksum),
                             duration_ms = VALUES(duration_ms),
                             executed_at = CURRENT_TIMESTAMP`,
    [patch.filename, patch.checksum, durationMs]
  );
}

async function deleteRecord(conn, filename) {
  const [r] = await conn.query('DELETE FROM schema_migrations WHERE filename = ?', [filename]);
  return r.affectedRows || 0;
}

function printStatus(patches, applied) {
  console.log(`${TAG} Toplam patch: ${patches.length}`);
  console.log(`${TAG} Uygulanmış   : ${applied.size}`);
  console.log(`${TAG} Bekleyen     : ${patches.filter((p) => !applied.has(p.filename)).length}`);
  console.log('');
  for (const p of patches) {
    const rec = applied.get(p.filename);
    if (!rec) {
      console.log(`  [ ] ${p.filename}`);
    } else {
      const drift = rec.checksum !== p.checksum ? '  (!) checksum değişmiş' : '';
      const when = rec.executed_at instanceof Date ? rec.executed_at.toISOString() : String(rec.executed_at);
      console.log(`  [x] ${p.filename}  @ ${when}${drift}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (!process.env.DB_NAME) {
    console.error(`${TAG} HATA: .env içinde DB_NAME tanımlı değil.`);
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    await ensureMigrationsTable(conn);

    const allPatches = discoverPatches();

    if (allPatches.length === 0) {
      console.log(`${TAG} ${PATCH_DIR} altında patch-*.js bulunamadı.`);
      return;
    }

    const applied = await loadAppliedMap(conn);

    if (args.status) {
      printStatus(allPatches, applied);
      return;
    }

    if (args.redo) {
      const target = allPatches.find((p) => p.filename === args.redo);
      if (!target) {
        console.error(`${TAG} HATA: --redo için patch bulunamadı: ${args.redo}`);
        process.exit(1);
      }
      const removed = await deleteRecord(conn, target.filename);
      console.log(`${TAG} ${target.filename} kaydı silindi (${removed} satır). Yeniden çalıştırılıyor...`);
      applied.delete(target.filename);
    }

    let candidates = allPatches;
    if (args.only) {
      candidates = allPatches.filter((p) => p.filename === args.only);
      if (candidates.length === 0) {
        console.error(`${TAG} HATA: --only için patch bulunamadı: ${args.only}`);
        process.exit(1);
      }
    } else if (args.redo) {
      candidates = [allPatches.find((p) => p.filename === args.redo)];
    }

    const pending = candidates.filter((p) => !applied.has(p.filename));

    if (pending.length === 0) {
      console.log(`${TAG} Bekleyen patch yok. (toplam: ${allPatches.length}, uygulanmış: ${applied.size})`);
      return;
    }

    console.log(`${TAG} ${pending.length} patch çalıştırılacak (toplam: ${allPatches.length}, uygulanmış: ${applied.size}).`);

    if (args.dryRun) {
      for (const p of pending) console.log(`  → ${p.filename}`);
      console.log(`${TAG} --dry-run: hiçbir şey çalıştırılmadı.`);
      return;
    }

    const startedAll = Date.now();

    for (let i = 0; i < pending.length; i += 1) {
      const p = pending[i];
      console.log('');
      console.log(`${TAG} (${i + 1}/${pending.length}) → ${p.filename}`);

      const out = runPatchProcess(p.fullPath);

      if (out.error) {
        console.error(`${TAG} SPAWN HATA: ${p.filename} -> ${out.error.message}`);
        process.exit(1);
      }
      if (out.signal) {
        console.error(`${TAG} HATA: ${p.filename} sinyalle sonlandı (${out.signal}). Durduruluyor.`);
        process.exit(1);
      }
      if (out.code !== 0) {
        console.error('');
        console.error('============================================================');
        console.error(`${TAG} HATA: ${p.filename} exit code ${out.code}.`);
        console.error(`${TAG} Migration durduruldu. Düzeltip tekrar 'npm run db:migrate' çalıştırın.`);
        console.error('============================================================');
        process.exit(1);
      }

      await recordSuccess(conn, p, out.durationMs);
      console.log(`${TAG} OK: ${p.filename} (${out.durationMs} ms)`);
    }

    console.log('');
    console.log(`${TAG} Tüm patch'ler uygulandı (${pending.length} adet, toplam ${Date.now() - startedAll} ms).`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(`${TAG} Beklenmedik hata:`, e && e.stack ? e.stack : e);
  process.exit(1);
});
