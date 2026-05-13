/**
 * Tek seferlik: 2026-04 payroll snapshot backfill (yalnızca employee_month_payroll_snapshot INSERT).
 * Çalıştırma: node backend/scripts/backfill-payroll-snapshot-2026-04.js
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { pool } = require('../config/database');
const hr = require('../services/hrService');

const MONTH_KEY = '2026-04';
const EXPECTED_LOCK_ID = 4;
const EXPECTED_FX = 12100;
const EMPLOYEE_IDS = [4, 5];

function wageInputFromSalaryRow(r) {
  if (!r) return null;
  return {
    total_salary_amount: r.salary_amount,
    total_salary_currency: r.salary_currency || 'UZS',
    official_salary_amount: r.official_salary_amount,
    official_salary_currency: r.official_salary_currency,
    official_salary_fx_rate: r.official_salary_fx_rate,
  };
}

async function main() {
  const viewer = { id: 1, role: { slug: 'super_admin' } };
  const conn = await pool.getConnection();

  const report = {
    month_key: MONTH_KEY,
    transaction: 'rolled_back',
    inserted: 0,
    skipped_total: 0,
    skipped_existing_generation_1: 0,
    skipped_no_history: 0,
    skipped_invalid_breakdown: 0,
    skipped_no_wage_input: 0,
    employees_fallback_used: false,
    errors: [],
  };

  try {
    await conn.beginTransaction();

    const [[lock]] = await conn.query(
      `SELECT id, month_key, payroll_usd_uzs_rate, is_locked
       FROM attendance_month_locks
       WHERE month_key = :mk
       LIMIT 1`,
      { mk: MONTH_KEY }
    );
    if (!lock) {
      throw new Error('attendance_month_locks: 2026-04 kaydı yok');
    }
    if (Number(lock.id) !== EXPECTED_LOCK_ID) {
      throw new Error(`lock_id beklenen ${EXPECTED_LOCK_ID}, gelen ${lock.id}`);
    }
    const rateNum = lock.payroll_usd_uzs_rate != null ? Number(lock.payroll_usd_uzs_rate) : null;
    if (rateNum !== EXPECTED_FX) {
      throw new Error(`payroll_usd_uzs_rate beklenen ${EXPECTED_FX}, gelen ${rateNum}`);
    }

    for (const eid of EMPLOYEE_IDS) {
      const [[exists]] = await conn.query(
        `SELECT 1 AS x FROM employee_month_payroll_snapshot
         WHERE month_key = :mk AND employee_id = :eid AND generation = 1
         LIMIT 1`,
        { mk: MONTH_KEY, eid }
      );
      if (exists && exists.x) {
        report.skipped_existing_generation_1 += 1;
        report.skipped_total += 1;
        continue;
      }

      const band = await hr.getCompensationBandForMonth(eid, MONTH_KEY, conn);
      if (band.error) {
        throw new Error(`getCompensationBandForMonth(${eid}): ${JSON.stringify(band)}`);
      }

      const salaryRow = band.row || null;
      if (!salaryRow) {
        report.skipped_no_history += 1;
        report.skipped_total += 1;
        continue;
      }

      const wageInput = wageInputFromSalaryRow(salaryRow);
      if (!wageInput) {
        report.skipped_no_wage_input += 1;
        report.skipped_total += 1;
        continue;
      }

      const breakdown = hr.computeWageBreakdown(wageInput);
      if (!breakdown.isValid) {
        report.skipped_invalid_breakdown += 1;
        report.skipped_total += 1;
        continue;
      }

      const compensationHistoryId = salaryRow.id != null ? Number(salaryRow.id) : null;
      const effectiveFrom = salaryRow.effective_from || null;
      const effectiveTo = salaryRow.effective_to != null ? salaryRow.effective_to : null;
      const breakdownJson = JSON.stringify(breakdown);

      await conn.query(
        `INSERT INTO employee_month_payroll_snapshot (
           month_key, employee_id, generation, attendance_lock_id,
           compensation_history_id, effective_from, effective_to,
           salary_currency, salary_amount, official_salary_amount, unofficial_salary_amount,
           official_salary_currency, official_salary_fx_rate,
           payroll_usd_uzs_rate_used, breakdown_json, input_fingerprint,
           frozen_by_user_id, freeze_reason
         ) VALUES (
           :month_key, :employee_id, 1, :attendance_lock_id,
           :compensation_history_id, :effective_from, :effective_to,
           :salary_currency, :salary_amount, :official_salary_amount, :unofficial_salary_amount,
           :official_salary_currency, :official_salary_fx_rate,
           :payroll_usd_uzs_rate_used, CAST(:breakdown_json AS JSON), NULL,
           NULL, :freeze_reason
         )`,
        {
          month_key: MONTH_KEY,
          employee_id: eid,
          attendance_lock_id: EXPECTED_LOCK_ID,
          compensation_history_id: compensationHistoryId,
          effective_from: effectiveFrom,
          effective_to: effectiveTo,
          salary_currency: breakdown.total_salary_currency,
          salary_amount: breakdown.total_salary_amount,
          official_salary_amount: breakdown.official_salary_amount,
          unofficial_salary_amount: breakdown.unofficial_salary_amount,
          official_salary_currency: breakdown.official_salary_currency,
          official_salary_fx_rate: breakdown.official_salary_fx_rate,
          payroll_usd_uzs_rate_used: EXPECTED_FX,
          breakdown_json: breakdownJson,
          freeze_reason: 'snapshot_backfill',
        }
      );
      report.inserted += 1;
    }

    await conn.commit();
    report.transaction = 'committed';
  } catch (e) {
    await conn.rollback();
    report.transaction = 'rolled_back';
    report.errors.push(String(e && e.message ? e.message : e));
    throw e;
  } finally {
    conn.release();
  }

  const validation = await hr.validatePayrollSnapshotConsistency(MONTH_KEY, viewer);
  const monthly = await hr.listMonthlyAttendance({ month: MONTH_KEY }, viewer);

  report.post_validate = {
    critical_mismatches_count: (validation.critical_mismatches || []).length,
    critical_mismatches: validation.critical_mismatches || [],
    warnings_count: (validation.warnings || []).length,
    audit_snapshot_row_count: validation.audit && validation.audit.snapshot_row_count,
  };
  report.post_list = {
    payroll_snapshot_read: monthly.payroll_snapshot_read || null,
    compensation_distribution: (monthly.summary || []).reduce((acc, s) => {
      const k = s.compensation_source || '?';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(() => pool.end())
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    pool.end().finally(() => process.exit(1));
  });
