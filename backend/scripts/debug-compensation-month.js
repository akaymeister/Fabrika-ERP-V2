/**
 * Geçici debug: employee_id + month_key için maaş history / band / listMonthlyAttendance kaynağı.
 * Veri değiştirmez. Sadece rapor.
 *
 * Kullanım (repo kökünden):
 *   node backend/scripts/debug-compensation-month.js <employee_id> <month_key>
 * Örnek:
 *   node backend/scripts/debug-compensation-month.js 1 2026-05
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { pool } = require('../config/database');
const {
  getEmployeeById,
  getCompensationBandForMonth,
  listMonthlyAttendance,
} = require('../services/hrService');

function normalizeMonthKey(v) {
  const s = String(v || '').trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : null;
}

function monthKeyToLastDayIso(mk) {
  const s = normalizeMonthKey(mk);
  if (!s) return null;
  const [ys, ms] = s.split('-');
  const y = parseInt(ys, 10);
  const mo = parseInt(ms, 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  const d = new Date(y, mo, 0);
  const dd = String(d.getDate()).padStart(2, '0');
  return `${s}-${dd}`;
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const eidRaw = process.argv[2];
  const mkRaw = process.argv[3];
  const eid = parseInt(String(eidRaw || '').trim(), 10);
  const mk = normalizeMonthKey(mkRaw);

  if (!Number.isFinite(eid) || eid <= 0 || !mk) {
    console.error('Kullanım: node backend/scripts/debug-compensation-month.js <employee_id> <month_key>');
    console.error('Örnek: node backend/scripts/debug-compensation-month.js 1 2026-05');
    process.exit(1);
  }

  const monthEndIso = monthKeyToLastDayIso(mk);
  section('Girdi');
  console.log(JSON.stringify({ employee_id: eid, month_key: mk, month_end_iso: monthEndIso }, null, 2));

  section('1) employees — mevcut maaş cache');
  const empOut = await getEmployeeById(eid);
  if (empOut.error) {
    console.log('Hata:', empOut.error, empOut.messageKey || '');
    process.exit(1);
  }
  const e = empOut.employee || {};
  const cache = {
    salary_currency: e.salary_currency,
    salary_amount: e.salary_amount,
    official_salary_amount: e.official_salary_amount,
    unofficial_salary_amount: e.unofficial_salary_amount,
    official_salary_currency: e.official_salary_currency,
    official_salary_fx_rate: e.official_salary_fx_rate,
  };
  console.log(JSON.stringify(cache, null, 2));

  let historyRows = [];
  let tableMissing = false;
  try {
    const [rows] = await pool.query(
      `SELECT id, employee_id, effective_from, effective_to,
              salary_currency, salary_amount, official_salary_amount, unofficial_salary_amount,
              official_salary_currency, official_salary_fx_rate, reason
       FROM employee_compensation_history
       WHERE employee_id = ?
       ORDER BY effective_from ASC, id ASC`,
      [eid]
    );
    historyRows = rows || [];
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      tableMissing = true;
      historyRows = [];
    } else {
      throw err;
    }
  }

  section('2) employee_compensation_history — tüm satırlar');
  if (tableMissing) {
    console.log('(tablo yok: ER_NO_SUCH_TABLE)');
  } else {
    console.log(`satır sayısı: ${historyRows.length}`);
    console.log(JSON.stringify(historyRows, null, 2));
  }

  section('3) Ay sonu (month_key → ISO)');
  console.log(monthEndIso);

  section('4) getCompensationBandForMonth');
  const band = await getCompensationBandForMonth(eid, mk);
  if (band.error) {
    console.log(JSON.stringify(band, null, 2));
  } else {
    console.log(JSON.stringify(band, null, 2));
  }

  section('5) listMonthlyAttendance — compensation_source (super_admin viewer, aynı ay + personel)');
  const viewer = { id: 1, role: { slug: 'super_admin' } };
  const att = await listMonthlyAttendance(
    {
      month: mk,
      employeeId: eid,
    },
    viewer
  );
  if (att.error) {
    console.log('listMonthlyAttendance hata:', att.error, att.messageKey || '');
  } else {
    const sum = (att.summary || []).find((s) => Number(s.employee_id) === eid);
    console.log(
      JSON.stringify(
        {
          compensation_debug: att.compensation_debug || null,
          summary_row_found: !!sum,
          compensation_source: sum ? sum.compensation_source : null,
          note: sum
            ? null
            : 'Bu ay için bu personelde özet satırı yok (puantaj kaydı yok veya filtre dışı). Kaynak yine history SQL ile türetilebilir.',
        },
        null,
        2
      )
    );
  }

  section('6) effective_to IS NULL — açık satır sayısı');
  let openNullCount = 0;
  if (!tableMissing) {
    const [[r]] = await pool.query(
      `SELECT COUNT(*) AS c FROM employee_compensation_history WHERE employee_id = ? AND effective_to IS NULL`,
      [eid]
    );
    openNullCount = Number(r && r.c) || 0;
  }
  console.log(String(openNullCount));

  section('7) Overlap (tarih aralığı çakışması, aynı employee)');
  let overlapPairs = [];
  if (!tableMissing) {
    const [pairs] = await pool.query(
      `SELECT h1.id AS id1, h1.effective_from AS from1, h1.effective_to AS to1,
              h2.id AS id2, h2.effective_from AS from2, h2.effective_to AS to2
       FROM employee_compensation_history h1
       INNER JOIN employee_compensation_history h2
         ON h1.employee_id = h2.employee_id AND h1.id < h2.id
       WHERE h1.employee_id = ?
         AND h1.effective_from <= IFNULL(h2.effective_to, '9999-12-31')
         AND IFNULL(h1.effective_to, '9999-12-31') >= h2.effective_from`,
      [eid]
    );
    overlapPairs = pairs || [];
  }
  console.log(`çakışan çift sayısı: ${overlapPairs.length}`);
  if (overlapPairs.length) console.log(JSON.stringify(overlapPairs.slice(0, 20), null, 2));

  section('8) Sonuç yorumu (heuristik)');
  const reasons = [];
  const bandRow = band && !band.error ? band.row : null;
  const sumRow = att && !att.error ? (att.summary || []).find((s) => Number(s.employee_id) === eid) : null;
  const src = sumRow && sumRow.compensation_source;

  if (tableMissing) {
    reasons.push('employee_compensation_history tablosu yok (migrasyon).');
  } else if (historyRows.length === 0) {
    reasons.push('History satırı yok → büyük olasılıkla backfill eksik (patch-032).');
  } else if (!bandRow) {
    const futureOnly = historyRows.every((h) => String(h.effective_from).slice(0, 10) > monthEndIso);
    if (futureOnly) {
      reasons.push('Ay sonundan sonra başlayan kayıtlar var; bu ay için band yok (effective_from gelecekte / ay dışı).');
    } else {
      reasons.push(
        'History var ama getCompensationBandForMonth satır döndürmedi → effective_to yanlış kapanmış veya ay sonu bandını dışlayan aralıklar olabilir; satırları inceleyin.'
      );
    }
  } else {
    reasons.push('Ay sonu için history bandı bulundu (getCompensationBandForMonth row dolu).');
  }

  if (!tableMissing && openNullCount > 1) {
    reasons.push(`Birden fazla açık uç (effective_to IS NULL: ${openNullCount}) — veri tutarsızlığı.`);
  }
  if (overlapPairs.length > 0) {
    reasons.push('Aralık çakışması tespit edildi (overlap sorgusu).');
  }

  if (sumRow) {
    if (src === 'employees_fallback') {
      reasons.push('listMonthlyAttendance bu personel için employees_fallback kullanıyor (history sorgusu ay sonu bandı döndürmedi veya özet öncesi eşleşme yok).');
    } else if (src === 'history') {
      reasons.push('listMonthlyAttendance: compensation_source = history (beklenen).');
    }
  } else if (att && !att.error) {
    reasons.push('Özet satırı yok — bordro satırı puantaj özetine bağlı; sadece band analizi için (4) ve (2) yeterli.');
  }

  if (bandRow && sumRow && src === 'employees_fallback') {
    reasons.push('UYARI: Band dolu ama özet fallback — özet boş/yanlış employee_id veya listMonthlyAttendance ile band SQL farkı araştırılmalı (nadir).');
  }

  console.log(reasons.map((x) => ` - ${x}`).join('\n'));
  console.log('\n(Bitti — veri değiştirilmedi.)\n');

  try {
    await pool.end();
  } catch (_) {
    /* ignore */
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
