/**
 * employee_compensation_history manuel stabilizasyon / rapor scripti.
 *
 * Varsayılan: dry-run (veri değiştirmez).
 * --apply: tek transaction içinde güncelleme; hata olursa rollback.
 *
 * Kullanım (repo kökünden):
 *   node backend/scripts/fix-compensation-history-manual.js
 *   node backend/scripts/fix-compensation-history-manual.js --employee-id=1
 *   node backend/scripts/fix-compensation-history-manual.js --apply --employee-id=1
 *   node backend/scripts/fix-compensation-history-manual.js --apply
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { pool } = require('../config/database');
const { derivePersistableWage, computeWageBreakdown } = require('../services/hrService');

const EPS = 0.02;
const INF_END = '9999-12-31';

function parseArgs(argv) {
  const out = { apply: false, employeeId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') {
      out.apply = true;
      continue;
    }
    if (a.startsWith('--employee-id=')) {
      const v = a.split('=')[1];
      const n = parseInt(String(v || '').trim(), 10);
      if (Number.isFinite(n) && n > 0) out.employeeId = n;
      continue;
    }
    if (a === '--employee-id') {
      const n = parseInt(String(argv[i + 1] || '').trim(), 10);
      if (Number.isFinite(n) && n > 0) {
        out.employeeId = n;
        i++;
      }
    }
  }
  return out;
}

function dayBeforeYmd(ymd) {
  const s = String(ymd || '').slice(0, 10);
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function coalesceEnd(toVal) {
  if (toVal == null || String(toVal).trim() === '') return INF_END;
  return String(toVal).slice(0, 10);
}

function cmpYmd(a, b) {
  const sa = String(a).slice(0, 10);
  const sb = String(b).slice(0, 10);
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

function moneyClose(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) <= EPS;
}

function persistClose(a, b) {
  return (
    String(a.salary_currency || '').toUpperCase() === String(b.salary_currency || '').toUpperCase() &&
    moneyClose(a.salary_amount, b.salary_amount) &&
    moneyClose(a.official_salary_amount, b.official_salary_amount) &&
    moneyClose(a.unofficial_salary_amount, b.unofficial_salary_amount) &&
    String(a.official_salary_currency || '').toUpperCase() === String(b.official_salary_currency || '').toUpperCase() &&
    moneyClose(Number(a.official_salary_fx_rate ?? 1), Number(b.official_salary_fx_rate ?? 1))
  );
}

function intervalsOverlap(from1, to1, from2, to2) {
  const e1 = coalesceEnd(to1);
  const e2 = coalesceEnd(to2);
  const f1 = String(from1).slice(0, 10);
  const f2 = String(from2).slice(0, 10);
  return cmpYmd(f1, e2) <= 0 && cmpYmd(e1, f2) >= 0;
}

function detectOverlaps(rows) {
  const pairs = [];
  const list = rows || [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (intervalsOverlap(a.effective_from, a.effective_to, b.effective_from, b.effective_to)) {
        pairs.push({ id1: a.id, id2: b.id, from1: a.effective_from, to1: a.effective_to, from2: b.effective_from, to2: b.effective_to });
      }
    }
  }
  return pairs;
}

function validateDateRange(row) {
  const issues = [];
  const from = String(row.effective_from || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    issues.push('effective_from_gecersiz');
  }
  if (row.effective_to != null && String(row.effective_to).trim() !== '') {
    const to = String(row.effective_to).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      issues.push('effective_to_gecersiz');
    } else if (issues.length === 0 && cmpYmd(from, to) > 0) {
      issues.push('effective_from_effective_to_sonrasi');
    }
  }
  return issues;
}

async function loadEmployeeIds(conn, singleId) {
  if (singleId != null) {
    const [[r]] = await conn.query(`SELECT id FROM employees WHERE id = :id LIMIT 1`, { id: singleId });
    if (!r) return [];
    return [singleId];
  }
  const [rows] = await conn.query(`SELECT id FROM employees ORDER BY id ASC`);
  return (rows || []).map((x) => Number(x.id));
}

async function loadHistory(conn, employeeId) {
  const [rows] = await conn.query(
    `SELECT id, employee_id, effective_from, effective_to,
            salary_currency, salary_amount, official_salary_amount, unofficial_salary_amount,
            official_salary_currency, official_salary_fx_rate, reason
     FROM employee_compensation_history
     WHERE employee_id = :eid
     ORDER BY effective_from ASC, id ASC`,
    { eid: employeeId }
  );
  return rows || [];
}

async function loadEmployeeSalary(conn, employeeId) {
  const [[r]] = await conn.query(
    `SELECT id, salary_currency, salary_amount, official_salary_amount, unofficial_salary_amount,
            official_salary_currency, official_salary_fx_rate
     FROM employees WHERE id = :id LIMIT 1`,
    { id: employeeId }
  );
  return r || null;
}

function buildChainEndFixes(sortedRows) {
  /** @type {{ id: number, employee_id: number, old_to: *, new_to: string, reason: string }[]} */
  const fixes = [];
  const risky = [];
  const n = sortedRows.length;
  for (let i = 0; i < n - 1; i++) {
    const cur = sortedRows[i];
    const nxt = sortedRows[i + 1];
    const nextFrom = String(nxt.effective_from).slice(0, 10);
    const cap = dayBeforeYmd(nextFrom);
    if (!cap || cmpYmd(cap, String(cur.effective_from).slice(0, 10)) < 0) {
      risky.push({
        history_id: cur.id,
        code: 'zincir_tarih_cap_gecersiz',
        detail: { cur_from: cur.effective_from, next_from: nextFrom },
      });
      continue;
    }
    const curEnd = coalesceEnd(cur.effective_to);
    if (cmpYmd(curEnd, nextFrom) >= 0) {
      const oldTo = cur.effective_to;
      if (String(oldTo || '') !== cap) {
        fixes.push({
          id: cur.id,
          employee_id: cur.employee_id,
          old_to: oldTo,
          new_to: cap,
          reason: 'overlap_zincir_kapatma',
        });
      }
    }
  }
  return { fixes, risky };
}

function buildWagePersistFixes(rows) {
  /** @type {{ id: number, employee_id: number, before: object, after: object, reason: string }[]} */
  const fixes = [];
  /** @type {{ history_id: number, codes: string[] }[]} */
  const risky = [];
  for (const row of rows) {
    const wageOut = derivePersistableWage({
      total_salary_amount: row.salary_amount,
      total_salary_currency: row.salary_currency || 'UZS',
      official_salary_amount: row.official_salary_amount,
      official_salary_currency: row.official_salary_currency,
      official_salary_fx_rate: row.official_salary_fx_rate,
    });
    if (wageOut && wageOut.error) {
      risky.push({
        history_id: row.id,
        codes: ['derivePersistableWage_basarisiz', String(wageOut.messageKey || wageOut.error || 'unknown')],
      });
      continue;
    }
    const p = wageOut.persist;
    const before = {
      salary_currency: row.salary_currency,
      salary_amount: Number(row.salary_amount),
      official_salary_amount: Number(row.official_salary_amount),
      unofficial_salary_amount: Number(row.unofficial_salary_amount),
      official_salary_currency: row.official_salary_currency,
      official_salary_fx_rate: row.official_salary_fx_rate,
    };
    const after = {
      salary_currency: p.salary_currency,
      salary_amount: Number(p.salary_amount),
      official_salary_amount: Number(p.official_salary_amount),
      unofficial_salary_amount: Number(p.unofficial_salary_amount),
      official_salary_currency: p.official_salary_currency,
      official_salary_fx_rate: p.official_salary_fx_rate,
    };
    if (!persistClose(before, after)) {
      fixes.push({
        id: row.id,
        employee_id: row.employee_id,
        before,
        after,
        reason: 'maaş_alanlari_normalize',
      });
    }
  }
  return { fixes, risky };
}

function buildEmployeesAlignFix(openRow, empPersist) {
  if (!openRow || !empPersist) return null;
  const cur = {
    salary_currency: openRow.salary_currency,
    salary_amount: Number(openRow.salary_amount),
    official_salary_amount: Number(openRow.official_salary_amount),
    unofficial_salary_amount: Number(openRow.unofficial_salary_amount),
    official_salary_currency: openRow.official_salary_currency,
    official_salary_fx_rate: openRow.official_salary_fx_rate,
  };
  if (persistClose(cur, empPersist)) return null;
  return {
    id: openRow.id,
    employee_id: openRow.employee_id,
    before: cur,
    after: { ...empPersist },
    reason: 'acik_satir_employees_ile_hizala',
  };
}

function pickOpenRowAfterFixes(sortedRows, plannedEffectiveToById) {
  const effective = sortedRows.map((r) => ({
    ...r,
    _to: plannedEffectiveToById.has(r.id) ? plannedEffectiveToById.get(r.id) : r.effective_to,
  }));
  const open = effective.filter((r) => r._to == null || String(r._to).trim() === '');
  if (open.length === 0) return { row: null, openCount: 0 };
  open.sort((a, b) => {
    const c = cmpYmd(b.effective_from, a.effective_from);
    if (c !== 0) return c;
    return Number(b.id) - Number(a.id);
  });
  return { row: open[0], openCount: open.length };
}

function aggregateCurrencyReport(rows) {
  const bySalaryCur = { USD: 0, UZS: 0, OTHER: 0 };
  const byOfficialCur = { USD: 0, UZS: 0, OTHER: 0, EMPTY: 0 };
  let sumOfficialUsd = 0;
  let sumUnofficialUsd = 0;
  let sumOfficialUzs = 0;
  let sumUnofficialUzs = 0;
  let breakdownValidRows = 0;

  for (const row of rows) {
    const sc = String(row.salary_currency || '').trim().toUpperCase();
    if (sc === 'USD') bySalaryCur.USD++;
    else if (sc === 'UZS') bySalaryCur.UZS++;
    else bySalaryCur.OTHER++;

    const oc = String(row.official_salary_currency || '').trim().toUpperCase();
    if (!oc) byOfficialCur.EMPTY++;
    else if (oc === 'USD') byOfficialCur.USD++;
    else if (oc === 'UZS') byOfficialCur.UZS++;
    else byOfficialCur.OTHER++;

    const b = computeWageBreakdown({
      total_salary_amount: row.salary_amount,
      total_salary_currency: row.salary_currency || 'UZS',
      official_salary_amount: row.official_salary_amount,
      official_salary_currency: row.official_salary_currency,
      official_salary_fx_rate: row.official_salary_fx_rate,
    });
    if (b.isValid) {
      breakdownValidRows++;
      if (b.official_salary_usd != null) sumOfficialUsd += Number(b.official_salary_usd);
      if (b.unofficial_salary_usd != null) sumUnofficialUsd += Number(b.unofficial_salary_usd);
      if (b.official_salary_uzs != null) sumOfficialUzs += Number(b.official_salary_uzs);
      if (b.unofficial_salary_uzs != null) sumUnofficialUzs += Number(b.unofficial_salary_uzs);
    }
  }

  return {
    satir_sayisi: rows.length,
    salary_currency_dagilim: bySalaryCur,
    official_salary_currency_dagilim: byOfficialCur,
    breakdown_gecerli_satir: breakdownValidRows,
    toplam_resmi_usd_satir_bazli: Math.round(sumOfficialUsd * 100) / 100,
    toplam_resmi_disi_usd_satir_bazli: Math.round(sumUnofficialUsd * 100) / 100,
    toplam_resmi_uzs_satir_bazli: Math.round(sumOfficialUzs * 100) / 100,
    toplam_resmi_disi_uzs_satir_bazli: Math.round(sumUnofficialUzs * 100) / 100,
  };
}

async function main() {
  const { apply, employeeId } = parseArgs(process.argv.slice(2));

  console.log(
    JSON.stringify(
      {
        mod: apply ? 'apply' : 'dry-run',
        employee_id: employeeId,
        uyari: apply
          ? 'Veritabanı güncellenecek (tek transaction).'
          : 'Dry-run: sorgu ve plan üretilir, UPDATE çalıştırılmaz.',
      },
      null,
      2
    )
  );

  const conn = await pool.getConnection();
  /** @type {any[]} */
  const toFixLog = [];
  /** @type {any[]} */
  const skippedLog = [];
  /** @type {any[]} */
  const riskyLog = [];
  /** @type {any[]} */
  const employeesHistoryCompare = [];

  const globalUsdUzsReport = {
    tum_calisanlar: employeeId == null,
    salary_currency: { USD: 0, UZS: 0, OTHER: 0 },
    official_salary_currency: { USD: 0, UZS: 0, OTHER: 0, EMPTY: 0 },
    breakdown_gecerli_satir: 0,
    toplam_resmi_usd: 0,
    toplam_resmi_disi_usd: 0,
    toplam_resmi_uzs: 0,
    toplam_resmi_disi_uzs: 0,
  };

  try {
    let tableMissing = false;
    try {
      await conn.query(`SELECT 1 FROM employee_compensation_history LIMIT 1`);
    } catch (e) {
      if (e.code === 'ER_NO_SUCH_TABLE') {
        tableMissing = true;
      } else {
        throw e;
      }
    }
    if (tableMissing) {
      console.log(JSON.stringify({ hata: 'employee_compensation_history tablosu yok' }, null, 2));
      process.exitCode = 1;
      return;
    }

    const employeeIds = await loadEmployeeIds(conn, employeeId);
    if (employeeId != null && employeeIds.length === 0) {
      console.log(JSON.stringify({ hata: 'employees tablosunda personel bulunamadi', employee_id: employeeId }, null, 2));
      process.exitCode = 1;
      return;
    }

    /** @type {{ sql: string, params: object }[]} */
    const pendingSql = [];

    for (const eid of employeeIds) {
      const historyRows = await loadHistory(conn, eid);
      const emp = await loadEmployeeSalary(conn, eid);

      const rep = aggregateCurrencyReport(historyRows);
      for (const k of ['USD', 'UZS', 'OTHER']) {
        globalUsdUzsReport.salary_currency[k] += rep.salary_currency_dagilim[k];
      }
      for (const k of ['USD', 'UZS', 'OTHER', 'EMPTY']) {
        globalUsdUzsReport.official_salary_currency[k] += rep.official_salary_currency_dagilim[k];
      }
      globalUsdUzsReport.breakdown_gecerli_satir += rep.breakdown_gecerli_satir;
      globalUsdUzsReport.toplam_resmi_usd += rep.toplam_resmi_usd_satir_bazli;
      globalUsdUzsReport.toplam_resmi_disi_usd += rep.toplam_resmi_disi_usd_satir_bazli;
      globalUsdUzsReport.toplam_resmi_uzs += rep.toplam_resmi_uzs_satir_bazli;
      globalUsdUzsReport.toplam_resmi_disi_uzs += rep.toplam_resmi_disi_uzs_satir_bazli;

      if (historyRows.length === 0) {
        riskyLog.push({
          employee_id: eid,
          kod: 'history_yok',
          aciklama: 'employee_compensation_history bos; employees ile karsilastirma yapilamadi.',
          employees_snapshot: emp,
        });
        continue;
      }

      const overlapsBefore = detectOverlaps(historyRows);
      if (overlapsBefore.length) {
        riskyLog.push({
          employee_id: eid,
          kod: 'overlap_tespit_oncesi',
          cift_sayisi: overlapsBefore.length,
          ornek: overlapsBefore.slice(0, 5),
        });
      }

      let openNullCount = 0;
      for (const r of historyRows) {
        if (r.effective_to == null || String(r.effective_to).trim() === '') openNullCount++;
      }
      if (openNullCount > 1) {
        riskyLog.push({
          employee_id: eid,
          kod: 'birden_fazla_acik_uç',
          effective_to_null_sayisi: openNullCount,
        });
      }

      for (const r of historyRows) {
        const dr = validateDateRange(r);
        if (dr.length) {
          riskyLog.push({ employee_id: eid, history_id: r.id, kod: 'tarih_araligi', sorunlar: dr });
        }
      }

      const chain = buildChainEndFixes(historyRows);
      for (const x of chain.risky) {
        riskyLog.push({ employee_id: eid, ...x });
      }

      const plannedTo = new Map();
      for (const f of chain.fixes) {
        plannedTo.set(f.id, f.new_to);
      }

      const wageFix = buildWagePersistFixes(historyRows);
      for (const x of wageFix.risky) {
        riskyLog.push({ employee_id: eid, ...x });
      }

      let empPersist = null;
      if (emp) {
        const empW = derivePersistableWage({
          total_salary_amount: emp.salary_amount,
          total_salary_currency: emp.salary_currency || 'UZS',
          official_salary_amount: emp.official_salary_amount,
          official_salary_currency: emp.official_salary_currency,
          official_salary_fx_rate: emp.official_salary_fx_rate,
        });
        if (empW && empW.error) {
          riskyLog.push({
            employee_id: eid,
            kod: 'employees_maas_derive_basarisiz',
            messageKey: empW.messageKey,
          });
        } else {
          empPersist = empW.persist;
        }
      }

      const { row: openRowPick, openCount: openAfterSim } = pickOpenRowAfterFixes(historyRows, plannedTo);
      let alignFix = null;
      if (empPersist && openAfterSim === 1) {
        alignFix = buildEmployeesAlignFix(openRowPick, empPersist);
      } else if (empPersist && openAfterSim === 0) {
        riskyLog.push({
          employee_id: eid,
          kod: 'acik_history_satiri_yok',
          aciklama: 'Zincir düzeltmesi sonrası effective_to bos satir kalmadi; employees ile hizalama atlandi.',
        });
      } else if (empPersist && openAfterSim > 1) {
        riskyLog.push({
          employee_id: eid,
          kod: 'plan_sonrasi_hala_coklu_acik_uç',
          effective_to_null_sayisi_plan: openAfterSim,
          aciklama: 'employees ile hizalama atlandi (tek acik satir belirsiz).',
        });
      }

      const officialNegative = historyRows.filter(
        (r) => Number(r.official_salary_amount) < 0 || Number(r.unofficial_salary_amount) < 0 || Number(r.salary_amount) < 0
      );
      if (officialNegative.length) {
        riskyLog.push({
          employee_id: eid,
          kod: 'negatif_tutar',
          history_ids: officialNegative.map((r) => r.id),
        });
      }

      for (const f of chain.fixes) {
        toFixLog.push({ employee_id: eid, tur: 'effective_to', ...f });
        pendingSql.push({
          sql: `UPDATE employee_compensation_history
                SET effective_to = :to, updated_at = CURRENT_TIMESTAMP
                WHERE id = :id AND employee_id = :eid`,
          params: { to: f.new_to, id: f.id, eid },
        });
      }

      for (const f of wageFix.fixes) {
        if (alignFix && f.id === alignFix.id) {
          skippedLog.push({
            employee_id: eid,
            history_id: f.id,
            not: 'maaş_normalize_acik_satir_employees_hizalama_ile_supersede',
          });
          continue;
        }
        toFixLog.push({ employee_id: eid, tur: 'maaş_normalize', ...f });
        pendingSql.push({
          sql: `UPDATE employee_compensation_history
                SET salary_currency = :sc,
                    salary_amount = :sa,
                    official_salary_amount = :osa,
                    unofficial_salary_amount = :usa,
                    official_salary_currency = :osc,
                    official_salary_fx_rate = :osfx,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id AND employee_id = :eid`,
          params: {
            sc: f.after.salary_currency,
            sa: f.after.salary_amount,
            osa: f.after.official_salary_amount,
            usa: f.after.unofficial_salary_amount,
            osc: f.after.official_salary_currency,
            osfx: f.after.official_salary_fx_rate,
            id: f.id,
            eid,
          },
        });
      }

      if (alignFix) {
        toFixLog.push({ employee_id: eid, tur: 'employees_hizala', ...alignFix });
        pendingSql.push({
          sql: `UPDATE employee_compensation_history
                SET salary_currency = :sc,
                    salary_amount = :sa,
                    official_salary_amount = :osa,
                    unofficial_salary_amount = :usa,
                    official_salary_currency = :osc,
                    official_salary_fx_rate = :osfx,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id AND employee_id = :eid`,
          params: {
            sc: alignFix.after.salary_currency,
            sa: alignFix.after.salary_amount,
            osa: alignFix.after.official_salary_amount,
            usa: alignFix.after.unofficial_salary_amount,
            osc: alignFix.after.official_salary_currency,
            osfx: alignFix.after.official_salary_fx_rate,
            id: alignFix.id,
            eid,
          },
        });
      }

      const touchedIds = new Set([
        ...chain.fixes.map((x) => x.id),
        ...wageFix.fixes.map((x) => x.id),
        ...(alignFix ? [alignFix.id] : []),
      ]);
      for (const r of historyRows) {
        if (!touchedIds.has(r.id)) {
          skippedLog.push({
            employee_id: eid,
            history_id: r.id,
            effective_from: r.effective_from,
            effective_to: r.effective_to,
            not: 'plan_disinda_degistirilecek_alan_yok',
          });
        }
      }

      const simRows = historyRows.map((r) => {
        const to = plannedTo.has(r.id) ? plannedTo.get(r.id) : r.effective_to;
        return { ...r, effective_to: to };
      });
      const overlapsAfter = detectOverlaps(simRows);
      if (overlapsAfter.length) {
        riskyLog.push({
          employee_id: eid,
          kod: 'overlap_plan_sonrasi_hala_var',
          cift_sayisi: overlapsAfter.length,
          ornek: overlapsAfter.slice(0, 5),
        });
      }

      if (empPersist && openRowPick) {
        const hCur = {
          salary_currency: openRowPick.salary_currency,
          salary_amount: Number(openRowPick.salary_amount),
          official_salary_amount: Number(openRowPick.official_salary_amount),
          unofficial_salary_amount: Number(openRowPick.unofficial_salary_amount),
          official_salary_currency: openRowPick.official_salary_currency,
          official_salary_fx_rate: openRowPick.official_salary_fx_rate,
        };
        employeesHistoryCompare.push({
          employee_id: eid,
          history_id: openRowPick.id,
          plan_sonrasi_acik_satir_sayisi: openAfterSim,
          employees_persist: empPersist,
          history_acik_satir: hCur,
          normalize_alanlari_eslesiyor: persistClose(hCur, empPersist),
          employees_hizalama_planda: !!alignFix,
        });
      } else if (emp && historyRows.length) {
        employeesHistoryCompare.push({
          employee_id: eid,
          plan_sonrasi_acik_satir_sayisi: openAfterSim,
          not: 'karsilastirma_icin_tek_acik_satir_veya_gecerli_employees_persist_yok',
        });
      }
    }

    console.log('\n=== employees ↔ history (tek acik satir / plan) ===');
    console.log(JSON.stringify(employeesHistoryCompare, null, 2));

    console.log('\n=== USD / UZS raporu (history satirlari, breakdown toplamlari) ===');
    console.log(
      JSON.stringify(
        {
          ...globalUsdUzsReport,
          not: 'USD/UZS toplamlari yalnizca computeWageBreakdown.isValid satirlarda anlamli toplanir.',
        },
        null,
        2
      )
    );

    console.log('\n=== Ozet ===');
    console.log(
      JSON.stringify(
        {
          duzeltilecek_islem_sayisi: pendingSql.length,
          duzeltilecek_kayit_ozeti: toFixLog.length,
          atlanan_satir_ozeti: skippedLog.length,
          riskli_kayit: riskyLog.length,
        },
        null,
        2
      )
    );

    console.log('\n=== Duzeltilecek (detay, ilk 80) ===');
    console.log(JSON.stringify(toFixLog.slice(0, 80), null, 2));

    console.log('\n=== Riskli (tam liste) ===');
    console.log(JSON.stringify(riskyLog, null, 2));

    console.log('\n=== Atlanan (ilk 50) ===');
    console.log(JSON.stringify(skippedLog.slice(0, 50), null, 2));

    if (apply) {
      if (riskyLog.length) {
        console.log(
          '\n[UYARI] Riskli kayitlar varken --apply calistirildi; yine de transaction denenecek. Isterseniz once riskleri giderin.\n'
        );
      }
      await conn.beginTransaction();
      try {
        for (const q of pendingSql) {
          await conn.query(q.sql, q.params);
        }
        await conn.commit();
        console.log('\n=== APPLY tamamlandi (commit). ===\n');
      } catch (e) {
        await conn.rollback();
        console.error('\n=== APPLY hata — rollback ===\n', e);
        process.exitCode = 1;
      }
    } else {
      console.log('\n=== Dry-run: SQL ornek (ilk 15) ===');
      for (let i = 0; i < Math.min(15, pendingSql.length); i++) {
        console.log(JSON.stringify(pendingSql[i], null, 2));
      }
      console.log('\n(Dry-run bitti — veri degistirilmedi.)\n');
    }
  } finally {
    conn.release();
    try {
      await pool.end();
    } catch (_) {
      /* ignore */
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
