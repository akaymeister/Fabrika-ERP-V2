const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const { userHasPermission } = require('./accessService');
const { err } = require('../utils/serviceError');
const { toUpperTr, optionalNoteUpperTr } = require('../utils/textNormalize');
const { normalizeCountryCode, isValidRegionForCountry } = require('../constants/locationData');
const { UPLOADS_ROOT } = require('../utils/paths');

const NATIONALITY_SET = new Set(['TR', 'UZ', 'RU', 'EN', 'OTHER']);
const HR_SETTING_KEYS = new Set([
  'standard_start_time',
  'standard_end_time',
  'break_1_start_time',
  'break_1_end_time',
  'break_2_start_time',
  'break_2_end_time',
  'break_3_start_time',
  'break_3_end_time',
  'break_4_start_time',
  'break_4_end_time',
  'lunch_start_time',
  'lunch_end_time',
  'overtime_start_time',
  'overtime_end_time',
  'monthly_work_days',
  'monthly_work_hours',
  'time_deduction_hours',
  'daily_start_time',
  'daily_end_time',
  'break_1_minutes',
  'break_2_minutes',
  'break_3_minutes',
  'lunch_minutes',
  'holiday_days',
  'weekly_work_hours',
  'daily_work_hours',
  'overtime_multiplier_1',
  'overtime_multiplier_2',
  'overtime_multiplier_3',
  'working_days',
  'sunday_workable',
  'sunday_paid',
  /** Bordro önizlemesi: 1 USD = X UZS (ay kilidinde sabitlenen kur önceliklidir). */
  'payroll_usd_uzs_rate',
]);

function normalizeNationality(v) {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'DİĞER' || s === 'DIGER') return 'OTHER';
  return NATIONALITY_SET.has(s) ? s : null;
}

function formatEmployeeLabel(e) {
  const name = [e.first_name, e.last_name].filter(Boolean).join(' ').trim() || String(e.full_name || '').trim();
  const no = String(e.employee_no || '').trim();
  return no ? `${no} - ${name}` : name;
}

function enrichEmployeeRow(e) {
  if (!e) return e;
  e.employee_display = formatEmployeeLabel(e);
  return e;
}

function parseMoney2(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** UZS / USD dışı değerleri UZS'ye düşür. Boş gelirse fallback kullanılır. */
function normalizeCurrencyOrFallback(v, fallback) {
  const c = String(v == null ? '' : v).trim().toUpperCase();
  if (c === 'USD' || c === 'UZS') return c;
  const fb = String(fallback || 'UZS').toUpperCase();
  return fb === 'USD' ? 'USD' : 'UZS';
}

/** Pozitif ondalıklı kur değeri; null/boş ise null döner (geçersiz/negatifse de null). */
function parseFxRate(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000000) / 1000000;
}

// ============================================================================
//  TEK MAAŞ HESAP MOTORU (computeWageBreakdown)
// ----------------------------------------------------------------------------
//  Sistemdeki tek formül kaynağı. Frontend / backend'de manuel
//  total - official benzeri hesaplar yapılmaz; tüm tüketiciler buraya bağlanır.
//  Kur standardı her zaman: 1 USD = X UZS.
// ============================================================================

const WAGE_CURRENCIES = new Set(['USD', 'UZS']);

function _wageNormCurrency(v, fallback) {
  const c = String(v == null ? '' : v).trim().toUpperCase();
  if (WAGE_CURRENCIES.has(c)) return c;
  const fb = String(fallback || 'UZS').trim().toUpperCase();
  return WAGE_CURRENCIES.has(fb) ? fb : 'UZS';
}

function _wageRound2(n) {
  if (n == null || n === '') return null;
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 100) / 100;
}

function _wageParseAmount(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return Math.round(n * 100) / 100;
}

function _wageParseFx(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000000) / 1000000;
}

function _wageHasFxInput(v) {
  return v != null && String(v).trim() !== '';
}

/**
 * Maaş kırılımını hesaplar; raw + normalize edilmiş 6 alanı + validation döner.
 *
 * input = {
 *   total_salary_amount, total_salary_currency,
 *   official_salary_amount, official_salary_currency,
 *   official_salary_fx_rate
 * }
 *
 * Kurallar:
 *   - aynı currency: fx = 1 (DB'ye 1 yazılır)
 *   - farklı currency: fx zorunlu, fx > 0
 *   - resmi olmayan maaş negatif olamaz
 *   - kur standardı: 1 USD = X UZS
 *   - Toplam USD iken resmi para birimi yalnızca açıkça UZS seçilmişse karma hesap (UZS normalizasyonu) yapılır;
 *     aksi halde kart USD–USD kabul edilir; bordro USD/UZS kuru taban maaşa uygulanmaz.
 *   - Toplam USD + kartta resmi UZS yazılı olsa bile tutarlar so'm (milyonlar) ölçeğinde değilse (tipik veri hatası)
 *     kart USD–USD sayılır; puantajda ru_uzs_nm / resmi UZS tahakkuku üretilmez.
 *   - Resmi tutar boş, 0 veya ≤0 ise resmi para birimi toplam maaş birimine zorlanır, kur 1 olur (karma maaş yok).
 *
 * Çıktı her zaman aynı şekilli: isValid bayrağı + (varsa) errors listesi.
 */
function computeWageBreakdown(input) {
  const errors = [];
  const totalCurrency = _wageNormCurrency(input?.total_salary_currency);
  const totalAmount = _wageParseAmount(input?.total_salary_amount);
  let officialAmount = _wageParseAmount(input?.official_salary_amount);
  const offAmtRaw = input?.official_salary_amount;
  const officialBlank = offAmtRaw == null || String(offAmtRaw).trim() === '';
  if (officialAmount == null && officialBlank) {
    officialAmount = 0;
  }
  const positiveOfficial = officialAmount != null && officialAmount > 0;
  const rawOfficial = positiveOfficial ? input?.official_salary_currency : null;

  const explicitUzs =
    rawOfficial != null &&
    String(rawOfficial).trim() !== '' &&
    _wageNormCurrency(rawOfficial) === 'UZS';

  let officialCurrency;
  if (totalCurrency === 'USD') {
    if (!explicitUzs) {
      officialCurrency = 'USD';
    } else if (
      totalAmount != null &&
      officialAmount != null &&
      totalAmount < 2_000_000 &&
      officialAmount < 500_000
    ) {
      // Resmi tutar gerçek bir aylık resmi UZS (genelde ≥ yüz binler / milyonlar) gibi değil → dolar rakamı yanlış etiketlenmiş.
      officialCurrency = 'USD';
    } else {
      officialCurrency = 'UZS';
    }
  } else {
    const eff =
      rawOfficial != null && String(rawOfficial).trim() !== ''
        ? rawOfficial
        : input?.total_salary_currency;
    officialCurrency = _wageNormCurrency(eff, totalCurrency);
  }

  const fxParsed = _wageParseFx(input?.official_salary_fx_rate);
  const fxProvided = _wageHasFxInput(input?.official_salary_fx_rate);

  if (totalAmount == null) {
    errors.push({ code: 'salary_amount_invalid', messageKey: 'api.hr.salary_amount_invalid' });
  }
  if (officialAmount == null) {
    errors.push({ code: 'official_salary_invalid', messageKey: 'api.hr.official_salary_invalid' });
  }

  const sameCurrency = totalCurrency === officialCurrency;
  const fxRequired = !sameCurrency;
  const fxApplicable = !sameCurrency;

  let fxUsed = null;
  if (sameCurrency) {
    fxUsed = 1;
  } else if (fxParsed != null) {
    fxUsed = fxParsed;
  } else if (!fxProvided) {
    errors.push({ code: 'salary_fx_required', messageKey: 'api.hr.salary_fx_required' });
  } else {
    errors.push({ code: 'salary_fx_invalid', messageKey: 'api.hr.salary_fx_invalid' });
  }

  // Hesaplama yapılamayacaksa kısa devre dön (alanlar null kalır).
  if (errors.length || totalAmount == null || officialAmount == null || fxUsed == null) {
    return {
      isValid: false,
      errors,
      fx_required: fxRequired,
      fx_applicable: fxApplicable,
      fx_used: sameCurrency ? 1 : (fxParsed || null),
      total_salary_amount: totalAmount,
      total_salary_currency: totalCurrency,
      official_salary_amount: officialAmount,
      official_salary_currency: officialCurrency,
      official_salary_fx_rate: sameCurrency ? 1 : (fxParsed || null),
      unofficial_salary_amount: null,
      unofficial_salary_currency: totalCurrency,
      total_salary_uzs: null,
      total_salary_usd: null,
      official_salary_uzs: null,
      official_salary_usd: null,
      unofficial_salary_uzs: null,
      unofficial_salary_usd: null,
    };
  }

  // Resmi olmayan maaş = total - (official official-currency'den total-currency'ye dönüştürülmüş)
  let unofficialAmount;
  if (sameCurrency) {
    unofficialAmount = totalAmount - officialAmount;
  } else if (totalCurrency === 'USD' && officialCurrency === 'UZS') {
    // unofficial USD = total USD - (official UZS / fx)
    unofficialAmount = totalAmount - officialAmount / fxUsed;
  } else {
    // totalCurrency === 'UZS' && officialCurrency === 'USD'
    // unofficial UZS = total UZS - (official USD * fx)
    unofficialAmount = totalAmount - officialAmount * fxUsed;
  }
  unofficialAmount = _wageRound2(unofficialAmount);

  if (unofficialAmount != null && unofficialAmount < 0) {
    errors.push({ code: 'salary_unofficial_negative', messageKey: 'api.hr.salary_unofficial_negative' });
  }

  // Normalize edilmiş 6 alan (rapor / KPI / muhasebe için).
  let totalUzs = null;
  let totalUsd = null;
  let officialUzs = null;
  let officialUsd = null;
  let unofficialUzs = null;
  let unofficialUsd = null;

  if (sameCurrency) {
    if (totalCurrency === 'UZS') {
      totalUzs = _wageRound2(totalAmount);
      officialUzs = _wageRound2(officialAmount);
      unofficialUzs = _wageRound2(unofficialAmount);
    } else {
      totalUsd = _wageRound2(totalAmount);
      officialUsd = _wageRound2(officialAmount);
      unofficialUsd = _wageRound2(unofficialAmount);
    }
    // Aynı currency'de "diğer" para birimine dönüş için kur tanımlı değil → null bırakılır.
  } else {
    if (totalCurrency === 'USD') {
      totalUsd = _wageRound2(totalAmount);
      totalUzs = _wageRound2(totalAmount * fxUsed);
      unofficialUsd = _wageRound2(unofficialAmount);
      unofficialUzs = _wageRound2(unofficialAmount * fxUsed);
    } else {
      totalUzs = _wageRound2(totalAmount);
      totalUsd = _wageRound2(totalAmount / fxUsed);
      unofficialUzs = _wageRound2(unofficialAmount);
      unofficialUsd = _wageRound2(unofficialAmount / fxUsed);
    }
    if (officialCurrency === 'USD') {
      officialUsd = _wageRound2(officialAmount);
      officialUzs = _wageRound2(officialAmount * fxUsed);
    } else {
      officialUzs = _wageRound2(officialAmount);
      officialUsd = _wageRound2(officialAmount / fxUsed);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    fx_required: fxRequired,
    fx_applicable: fxApplicable,
    fx_used: fxUsed,
    total_salary_amount: _wageRound2(totalAmount),
    total_salary_currency: totalCurrency,
    official_salary_amount: _wageRound2(officialAmount),
    official_salary_currency: officialCurrency,
    official_salary_fx_rate: fxUsed,
    unofficial_salary_amount: unofficialAmount,
    unofficial_salary_currency: totalCurrency,
    total_salary_uzs: totalUzs,
    total_salary_usd: totalUsd,
    official_salary_uzs: officialUzs,
    official_salary_usd: officialUsd,
    unofficial_salary_uzs: unofficialUzs,
    unofficial_salary_usd: unofficialUsd,
  };
}

/**
 * Sadece doğrulama yapar. Geçerliyse breakdown döner; değilse { error, messageKey }.
 */
function validateWagePayload(input) {
  const breakdown = computeWageBreakdown(input);
  if (!breakdown.isValid) {
    const first = breakdown.errors[0] || {};
    return err(first.messageKey || 'Maaş hesabı geçersiz', first.messageKey || 'api.hr.salary_amount_invalid');
  }
  return { breakdown };
}

/**
 * DB INSERT/UPDATE için kullanılacak normalize alanları üretir. Hatalıysa { error, messageKey }.
 */
function derivePersistableWage(input) {
  const out = validateWagePayload(input);
  if (out && out.error) return out;
  const b = out.breakdown;
  return {
    persist: {
      salary_currency: b.total_salary_currency,
      salary_amount: b.total_salary_amount,
      official_salary_amount: b.official_salary_amount,
      official_salary_currency: b.official_salary_currency,
      official_salary_fx_rate: b.official_salary_fx_rate,
      unofficial_salary_amount: b.unofficial_salary_amount,
    },
    breakdown: b,
  };
}

/**
 * DB satırından breakdown üretir (listeler / detay endpoint'leri için).
 * Eski kayıtlarda official_salary_currency veya fx_rate eksikse fallback uygular.
 */
function breakdownFromEmployeeRow(row) {
  if (!row) return null;
  return computeWageBreakdown({
    total_salary_amount: row.salary_amount,
    total_salary_currency: row.salary_currency,
    official_salary_amount: row.official_salary_amount,
    official_salary_currency: row.official_salary_currency,
    official_salary_fx_rate:
      row.official_salary_fx_rate != null && Number(row.official_salary_fx_rate) > 0
        ? row.official_salary_fx_rate
        : 1,
  });
}

/** Ay kaydında saklanan veya İK ayarındaki USD/UZS kuru; yoksa personel kartı kuru. */
function resolveMonthPayrollUsdUzsRate(lockRow, settingMap) {
  const frozen = lockRow && parseFxRate(lockRow.payroll_usd_uzs_rate);
  if (frozen != null) return { rate: frozen, source: 'month_locked' };
  const fromSet = settingMap && parseFxRate(settingMap.payroll_usd_uzs_rate);
  if (fromSet != null) return { rate: fromSet, source: 'settings' };
  return { rate: null, source: 'employee' };
}

/** listMonthlyAttendance: dönem bordrosunda kur önceliği ay sabiti > İK ayarı > personel (maaş satırı history veya employees cache olabilir). */
function breakdownFromEmployeeRowForPayroll(empRow, monthUsdUzsRate) {
  if (!empRow) return null;
  const totalCurrency = _wageNormCurrency(empRow.salary_currency);
  const rawOff = empRow.official_salary_currency;
  let offAmt = _wageParseAmount(empRow.official_salary_amount);
  const offBlank = empRow.official_salary_amount == null || String(empRow.official_salary_amount).trim() === '';
  if (offAmt == null && offBlank) offAmt = 0;
  const posOff = offAmt != null && offAmt > 0;
  const crossUsdUzs =
    posOff &&
    totalCurrency === 'USD' &&
    rawOff != null &&
    String(rawOff).trim() !== '' &&
    _wageNormCurrency(rawOff) === 'UZS';
  let fxArg = empRow.official_salary_fx_rate;
  if (crossUsdUzs) {
    const m = parseFxRate(monthUsdUzsRate);
    if (m != null) fxArg = m;
  }
  return computeWageBreakdown({
    total_salary_amount: empRow.salary_amount,
    total_salary_currency: empRow.salary_currency,
    official_salary_amount: empRow.official_salary_amount,
    official_salary_currency: rawOff,
    official_salary_fx_rate: fxArg,
  });
}

async function nextEmployeeNumber(conn) {
  const executor = conn || pool;
  const [rows] = await executor.query(
    `SELECT employee_no FROM employees WHERE employee_no IS NOT NULL AND employee_no LIKE 'PRS-%'`
  );
  let max = 0;
  for (const r of rows) {
    const m = String(r.employee_no || '').match(/^PRS-(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `PRS-${String(max + 1).padStart(3, '0')}`;
}

function applyEmployeeListFilters(filters, where, p) {
  const status = normalizeStatus(filters.status);
  if (status) {
    where.push('e.employment_status = :status');
    p.status = status;
  }
  if (filters.nationality != null && String(filters.nationality).trim() !== '') {
    const nat = normalizeNationality(filters.nationality);
    if (!nat) return err('Uyruk gecersiz', 'api.hr.nationality_invalid');
    where.push('e.nationality = :nationality');
    p.nationality = nat;
  }
  const ctry = filters.country != null && String(filters.country).trim() !== '' ? normalizeCountryCode(filters.country) : null;
  if (filters.country != null && String(filters.country).trim() !== '') {
    if (!ctry) return err('Ulke gecersiz', 'api.hr.country_invalid');
    where.push('e.country = :country');
    p.country = ctry;
  }
  if (filters.region_or_city != null && String(filters.region_or_city).trim() !== '') {
    where.push('e.region_or_city = :region_or_city');
    p.region_or_city = toUpperTr(filters.region_or_city);
  }
  const depId = parseId(filters.department_id);
  if (depId) {
    where.push('e.department_id = :department_id');
    p.department_id = depId;
  }
  const posId = parseId(filters.position_id);
  if (posId) {
    where.push('e.position_id = :position_id');
    p.position_id = posId;
  }
  if (filters.search != null && String(filters.search).trim() !== '') {
    where.push(
      '(e.full_name LIKE :q OR e.employee_no LIKE :q OR e.first_name LIKE :q OR e.last_name LIKE :q OR CONCAT(COALESCE(e.first_name,\'\'), \' \', COALESCE(e.last_name,\'\')) LIKE :q)'
    );
    p.q = `%${String(filters.search).trim()}%`;
  }
  return null;
}

function applyEmployeeAttendanceFilters(filters, where, p) {
  if (filters.nationality != null && String(filters.nationality).trim() !== '') {
    const nat = normalizeNationality(filters.nationality);
    if (!nat) return err('Uyruk gecersiz', 'api.hr.nationality_invalid');
    where.push('e.nationality = :nationality');
    p.nationality = nat;
  }
  const ctry = filters.country != null && String(filters.country).trim() !== '' ? normalizeCountryCode(filters.country) : null;
  if (filters.country != null && String(filters.country).trim() !== '') {
    if (!ctry) return err('Ulke gecersiz', 'api.hr.country_invalid');
    where.push('e.country = :country');
    p.country = ctry;
  }
  if (filters.region_or_city != null && String(filters.region_or_city).trim() !== '') {
    where.push('e.region_or_city = :region_or_city');
    p.region_or_city = toUpperTr(filters.region_or_city);
  }
  const depId = parseId(filters.department_id);
  if (depId) {
    where.push('e.department_id = :department_id');
    p.department_id = depId;
  }
  const posId = parseId(filters.position_id);
  if (posId) {
    where.push('e.position_id = :position_id');
    p.position_id = posId;
  }
  if (filters.search != null && String(filters.search).trim() !== '') {
    where.push(
      "(COALESCE(NULLIF(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')), ' '), e.full_name) LIKE :emp_search OR e.employee_no LIKE :emp_search)"
    );
    p.emp_search = `%${String(filters.search).trim()}%`;
  }
  return null;
}

function safeUnlinkUpload(relPath) {
  if (!relPath || String(relPath).includes('..')) return;
  const full = path.resolve(path.join(UPLOADS_ROOT, relPath));
  const root = path.resolve(UPLOADS_ROOT);
  if (!full.startsWith(root)) return;
  fs.unlink(full, () => {});
}

function parseId(v) {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeTelegramUsername(v) {
  if (v == null || String(v).trim() === '') return null;
  return String(v).trim().replace(/^@+/, '').slice(0, 100);
}

function normalizeTelegramChatId(v) {
  if (v == null || String(v).trim() === '') return null;
  return String(v).trim().slice(0, 100);
}

function normalizeTelegramNotifyEnabled(v) {
  if (v === 0 || v === '0' || v === false || v === 'false') return 0;
  return 1;
}

function normalizeOvertimeEligible(v) {
  if (v === 1 || v === '1' || v === true || v === 'true') return 1;
  return 0;
}

function isOvertimeEligible(v) {
  if (v === null || v === undefined || v === '') return true;
  return Number(v) === 1;
}

function normalizeStatus(v) {
  const s = String(v || '').trim().toLowerCase();
  return ['active', 'passive', 'terminated'].includes(s) ? s : null;
}

function normalizeWorkStatus(v) {
  return String(v || '').trim().toLowerCase() || null;
}

function normalizeWorkType(v) {
  return String(v || '').trim().toLowerCase() || null;
}

function normalizeMonthKey(v) {
  const s = String(v || '').trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : null;
}

/** month_key YYYY-MM → ayın son günü YYYY-MM-DD (puantaj/bordro maaş versiyonu asOf). */
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

/** Yerel sunucu saatiyle month_key (YYYY-MM) geçmiş ay mı (fallback uyarısı için). */
function isPastMonthKey(mk) {
  const key = normalizeMonthKey(mk);
  if (!key) return false;
  const d = new Date();
  const cur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return key < cur;
}

function normalizeTime(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/);
  if (!m) return null;
  return `${m[1]}:${m[2]}${m[3] || ':00'}`;
}

function normalizeCode(v) {
  const raw = String(v || '').trim().toLowerCase();
  const code = raw.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return code || null;
}

function parseNonNegNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseIntSafe(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseTimeMinutes(v) {
  const s = String(v || '').trim();
  const m = s.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function diffMinutes(start, end) {
  const s = parseTimeMinutes(start);
  const eRaw = parseTimeMinutes(end);
  if (s == null || eRaw == null) return 0;
  let e = eRaw;
  if (e < s) e += 24 * 60;
  return Math.max(0, e - s);
}

function parseDecimalLoose(v) {
  if (v == null) return 0;
  const n = Number(String(v).replace(',', '.').trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function computeStandardDailyHours(settings = {}) {
  const start = settings.standard_start_time || settings.daily_start_time || '';
  const end = settings.standard_end_time || settings.daily_end_time || '';
  const gross = diffMinutes(start, end);
  if (gross <= 0) return null;
  const break1 = diffMinutes(settings.break_1_start_time, settings.break_1_end_time);
  const break2 = diffMinutes(settings.break_2_start_time, settings.break_2_end_time);
  const lunch = diffMinutes(settings.lunch_start_time, settings.lunch_end_time);
  const timeDeduction = Math.round(parseDecimalLoose(settings.time_deduction_hours) * 60);
  const netMinutes = Math.max(0, gross - break1 - break2 - lunch - timeDeduction);
  return Math.round((netMinutes / 60) * 100) / 100;
}

const MONEY_INTERNAL_PREC = 1e6;

function roundInternal6(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * MONEY_INTERNAL_PREC) / MONEY_INTERNAL_PREC;
}

function divSafe6(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y) || y <= 0) return null;
  return roundInternal6(x / y);
}

function mulSafe6(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return Math.max(0, roundInternal6(x * y));
}

/** Aylık puantaj normal ücret: maaş × (toplam_normal_saat / monthly_work_hours) */
function monthlyNormalPayProportional(baseAmount, totalNormalHours, monthlyWorkHours) {
  const amt = Number(baseAmount);
  const nh = Number(totalNormalHours);
  const mw = Number(monthlyWorkHours);
  if (!Number.isFinite(mw) || mw <= 0) return null;
  if (!Number.isFinite(amt) || !Number.isFinite(nh)) return null;
  return roundInternal6((amt * nh) / mw);
}

function formatMoneyWithCurrency(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '-';
  const cc = String(currency || '').toUpperCase() === 'USD' ? 'USD' : 'UZS';
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cc}`;
}

function parseMultiplier(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

const SCHEMA_COL_CACHE = new Map();
async function hasColumnCached(tableName, columnName) {
  const key = `${tableName}.${columnName}`;
  if (SCHEMA_COL_CACHE.has(key)) return SCHEMA_COL_CACHE.get(key);
  const [r] = await pool.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c',
    { t: tableName, c: columnName }
  );
  const yes = Number(r[0] && r[0].c) > 0;
  SCHEMA_COL_CACHE.set(key, yes);
  return yes;
}

function validateHrSettingValue(key, value) {
  const s = value == null ? '' : String(value).trim();
  const TIME_KEYS = new Set([
    'standard_start_time',
    'standard_end_time',
    'break_1_start_time',
    'break_1_end_time',
    'break_2_start_time',
    'break_2_end_time',
    'break_3_start_time',
    'break_3_end_time',
    'break_4_start_time',
    'break_4_end_time',
    'lunch_start_time',
    'lunch_end_time',
    'overtime_start_time',
    'overtime_end_time',
    'daily_start_time',
    'daily_end_time',
  ]);
  if (key === 'working_days') {
    const allowed = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    const arr = s
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter((x) => allowed.has(x));
    if (!arr.length) return 'mon,tue,wed,thu,fri,sat';
    return [...new Set(arr)].join(',');
  }
  if (key === 'sunday_workable' || key === 'sunday_paid') {
    if (s === '1' || s.toLowerCase() === 'true') return '1';
    return '0';
  }
  if (TIME_KEYS.has(key)) {
    if (!s) return '';
    return normalizeTime(`${s}:00`.slice(0, 8)) ? s.slice(0, 5) : null;
  }
  if (key === 'holiday_days') {
    return s.slice(0, 200);
  }
  if (key.startsWith('overtime_multiplier_')) {
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return null;
    return String(Math.round(n * 1000) / 1000);
  }
  if (key === 'payroll_usd_uzs_rate') {
    const fx = parseFxRate(s);
    if (fx == null) return null;
    return String(Math.round(fx * 1000000) / 1000000);
  }
  const n = parseNonNegNumber(s);
  if (n == null) return null;
  return String(n);
}

async function getAllowedCodes(tableName, includeInactive = false) {
  const where = includeInactive ? '' : 'WHERE is_active = 1';
  const [rows] = await pool.query(`SELECT code FROM ${tableName} ${where}`);
  return new Set(rows.map((r) => String(r.code || '').trim().toLowerCase()).filter(Boolean));
}

async function ensureAllowedCode(tableName, code, message, messageKey) {
  const c = normalizeCode(code);
  if (!c) return err(message, messageKey);
  const allowed = await getAllowedCodes(tableName, true);
  return allowed.has(c) ? c : err(message, messageKey);
}

function validateAttendanceRule(workStatus, checkIn, checkOut) {
  const strictTime = workStatus === 'worked' || workStatus === 'half_day' || workStatus === 'overtime';
  if (strictTime) {
    if (!checkIn || !checkOut) return err('Giris ve cikis saati zorunlu', 'api.hr.attendance_time_required');
    // Cikis < giris ise gece tasmasi (ertesi gun) kabul edilir; esitlik hala gecersizdir.
    if (checkOut === checkIn) return err('Cikis saati giris saati ile ayni olamaz', 'api.hr.attendance_time_order_invalid');
    return null;
  }
  // absent / leave / sick_leave icin saatler opsiyonel; doluysa tutarli olmali
  if (checkIn && checkOut && checkOut === checkIn) {
    return err('Cikis saati giris saati ile ayni olamaz', 'api.hr.attendance_time_order_invalid');
  }
  return null;
}

function monthKeyFromDate(workDate) {
  const d = String(workDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d.slice(0, 7);
}

function computeTotalHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const cin = String(checkIn).slice(0, 8);
  const cout = String(checkOut).slice(0, 8);
  if (!cin || !cout) return 0;
  const s = cin.split(':').map((x) => Number(x) || 0);
  const e = cout.split(':').map((x) => Number(x) || 0);
  const m1 = s[0] * 60 + s[1];
  let m2 = e[0] * 60 + e[1];
  // Gece tasmasi: 08:00 -> 04:00 gibi cikis ertesi gun kabul edilir.
  if (m2 < m1) m2 += 24 * 60;
  return Math.round((Math.max(0, m2 - m1) / 60) * 100) / 100;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseWorkingDays(raw) {
  const list = String(raw || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter((x) => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(x));
  return list.length ? list : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
}

function timeToMinutesAny(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const hhmm = s.slice(0, 5);
  return parseTimeMinutes(hhmm);
}

function safeEndMinutes(startRaw, endRaw) {
  const start = timeToMinutesAny(startRaw);
  let end = timeToMinutesAny(endRaw);
  if (start == null || end == null) return null;
  if (end < start) end += 24 * 60;
  return { start, end };
}

function overlapMinutes(rangeStart, rangeEnd, itemStart, itemEnd) {
  const s = Math.max(rangeStart, itemStart);
  const e = Math.min(rangeEnd, itemEnd);
  return Math.max(0, e - s);
}

function breakOverlapMinutes(rangeStart, rangeEnd, breakStart, breakEnd) {
  const br = safeEndMinutes(breakStart, breakEnd);
  if (!br) return 0;
  return overlapMinutes(rangeStart, rangeEnd, br.start, br.end);
}

function dayKeyFromDateLocal(dateRaw) {
  const d = new Date(`${String(dateRaw || '').slice(0, 10)}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return '';
  return DAY_KEYS[d.getDay()] || '';
}

function toHours2(minutes) {
  return Math.round((Math.max(0, Number(minutes) || 0) / 60) * 100) / 100;
}

function computeStandardDailyMinutes(settings = {}) {
  const range = safeEndMinutes(settings.standard_start_time || settings.daily_start_time, settings.standard_end_time || settings.daily_end_time);
  if (!range) return 0;
  const b1 = breakOverlapMinutes(range.start, range.end, settings.break_1_start_time, settings.break_1_end_time);
  const b2 = breakOverlapMinutes(range.start, range.end, settings.break_2_start_time, settings.break_2_end_time);
  const lunch = breakOverlapMinutes(range.start, range.end, settings.lunch_start_time, settings.lunch_end_time);
  const deduction = Math.round(parseDecimalLoose(settings.time_deduction_hours) * 60);
  return Math.max(0, range.end - range.start - b1 - b2 - lunch - deduction);
}

function computeNormalDayMinutesByRules(checkIn, checkOut, settings = {}) {
  const range = safeEndMinutes(checkIn, checkOut);
  if (!range) return { normalMinutes: 0, overtimeMinutes: 0 };
  const stdEnd = timeToMinutesAny(settings.standard_end_time || settings.daily_end_time || '18:00') ?? 18 * 60;
  const normalEnd = Math.min(range.end, stdEnd);
  const normalBase = Math.max(0, normalEnd - range.start);
  const normalBreaks =
    breakOverlapMinutes(range.start, normalEnd, settings.break_1_start_time, settings.break_1_end_time) +
    breakOverlapMinutes(range.start, normalEnd, settings.break_2_start_time, settings.break_2_end_time) +
    breakOverlapMinutes(range.start, normalEnd, settings.lunch_start_time, settings.lunch_end_time);
  const deduction = Math.round(parseDecimalLoose(settings.time_deduction_hours) * 60);
  const normalMinutes = Math.max(0, normalBase - normalBreaks - deduction);
  const overtimeBase = Math.max(0, range.end - stdEnd);
  const break3Overtime = breakOverlapMinutes(stdEnd, range.end, settings.break_3_start_time, settings.break_3_end_time);
  const overtimeMinutes = Math.max(0, overtimeBase - break3Overtime);
  return { normalMinutes, overtimeMinutes };
}

function computeSundayOvertimeMinutesByRules(checkIn, checkOut, settings = {}) {
  const range = safeEndMinutes(checkIn, checkOut);
  if (!range) return 0;
  const totalBase = Math.max(0, range.end - range.start);
  const breaks =
    breakOverlapMinutes(range.start, range.end, settings.break_1_start_time, settings.break_1_end_time) +
    breakOverlapMinutes(range.start, range.end, settings.break_2_start_time, settings.break_2_end_time) +
    breakOverlapMinutes(range.start, range.end, settings.lunch_start_time, settings.lunch_end_time);
  let result = Math.max(0, totalBase - breaks);
  // Pazar çalışmasında da genel zaman kesintisi uygulanır.
  const deduction = Math.round(parseDecimalLoose(settings.time_deduction_hours) * 60);
  result = Math.max(0, result - deduction);
  const stdEnd = timeToMinutesAny(settings.standard_end_time || settings.daily_end_time || '18:00') ?? 18 * 60;
  if (range.end > stdEnd) {
    result = Math.max(0, result - breakOverlapMinutes(stdEnd, range.end, settings.break_3_start_time, settings.break_3_end_time));
  }
  return result;
}

function parseBool01Loose(v) {
  if (v === true || v === 1 || v === '1' || String(v || '').toLowerCase() === 'true') return true;
  if (v === false || v === 0 || v === '0' || String(v || '').toLowerCase() === 'false') return false;
  return null;
}

function computeDailyTotalHoursByRules({
  workDate,
  workStatus,
  checkIn,
  checkOut,
  settings = {},
  statusMultipliers = new Map(),
  sundayWorkableOverride = null,
  sundayPaidOverride = null,
} = {}) {
  const out = computeDailyHoursBreakdownByRules({
    workDate,
    workStatus,
    checkIn,
    checkOut,
    settings,
    statusMultipliers,
    sundayWorkableOverride,
    sundayPaidOverride,
  });
  return out.totalHours;
}

function computeDailyHoursBreakdownByRules({
  workDate,
  workStatus,
  checkIn,
  checkOut,
  settings = {},
  statusMultipliers = new Map(),
  sundayWorkableOverride = null,
  sundayPaidOverride = null,
} = {}) {
  const status = String(workStatus || '').trim().toLowerCase();
  const dayKey = dayKeyFromDateLocal(workDate);
  const isSunday = dayKey === 'sun';
  const workingDays = parseWorkingDays(settings.working_days);
  const sundayWorkableBase = String(settings.sunday_workable || '0') === '1' || workingDays.includes('sun');
  const sundayPaidBase = String(settings.sunday_paid || '0') === '1';
  const sundayWorkable = sundayWorkableOverride == null ? sundayWorkableBase : !!sundayWorkableOverride;
  const sundayPaid = sundayPaidOverride == null ? sundayPaidBase : !!sundayPaidOverride;
  const dayAllowed = workingDays.includes(dayKey);
  const disallowEntry = isSunday ? !sundayWorkable : !dayAllowed;
  if (disallowEntry) return { totalHours: 0, overtimeHours: 0 };
  if (status === 'absent' || status === 'unpaid_leave') return { totalHours: 0, overtimeHours: 0 };
  if (isSunday && !sundayPaid) return { totalHours: 0, overtimeHours: 0 };
  const mulRaw = Number(statusMultipliers.get(status));
  const multiplier = Number.isFinite(mulRaw) && mulRaw >= 0 ? mulRaw : 1;
  const standardDailyMinutes = computeStandardDailyMinutes(settings);
  if (!isSunday && status === 'paid_leave') return { totalHours: toHours2(standardDailyMinutes * multiplier), overtimeHours: 0 };
  if (isSunday) {
    const sundayOtMinutes =
      status === 'paid_leave' ? standardDailyMinutes : computeSundayOvertimeMinutesByRules(checkIn, checkOut, settings);
    return { totalHours: 0, overtimeHours: toHours2(sundayOtMinutes * multiplier) };
  }
  const calc = computeNormalDayMinutesByRules(checkIn, checkOut, settings);
  return {
    totalHours: toHours2(calc.normalMinutes * multiplier),
    overtimeHours: toHours2(calc.overtimeMinutes * multiplier),
  };
}

async function isAttendanceMonthLocked(monthKey) {
  const mk = normalizeMonthKey(monthKey);
  if (!mk) return false;
  const [rows] = await pool.query('SELECT is_locked FROM attendance_month_locks WHERE month_key = ? LIMIT 1', [mk]);
  if (!rows.length) return false;
  const v = rows[0].is_locked;
  if (v === true || v === 1 || v === '1') return true;
  const n = Number(v);
  return n === 1;
}

async function getScope() {
  return { canHr: true };
}

async function listDepartments() {
  const [rows] = await pool.query(
    `SELECT id, code, name, is_active, created_at, updated_at
     FROM departments
     ORDER BY is_active DESC, name ASC`
  );
  return { departments: rows };
}

async function createDepartment(input) {
  const name = toUpperTr(input?.name);
  if (!name) return err('Departman adı gerekli', 'api.hr.department_name_required');
  const code = input?.code == null || String(input.code).trim() === '' ? null : String(input.code).trim();
  const [r] = await pool.query(
    'INSERT INTO departments (code, name, is_active) VALUES (:code, :name, :is_active)',
    { code, name, is_active: input?.is_active === 0 ? 0 : 1 }
  );
  return { id: r.insertId };
}

async function updateDepartment(id, input) {
  const depId = parseId(id);
  if (!depId) return err('Gecersiz departman', 'api.hr.department_invalid');
  const fields = [];
  const p = { id: depId };
  if (input?.name != null) {
    const name = toUpperTr(input.name);
    if (!name) return err('Departman adi gerekli', 'api.hr.department_name_required');
    fields.push('name = :name');
    p.name = name;
  }
  if (input?.code !== undefined) {
    const code = input.code == null || String(input.code).trim() === '' ? null : String(input.code).trim();
    fields.push('code = :code');
    p.code = code;
  }
  if (input?.is_active != null) {
    fields.push('is_active = :is_active');
    p.is_active = input.is_active ? 1 : 0;
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  const [r] = await pool.query(`UPDATE departments SET ${fields.join(', ')} WHERE id = :id`, p);
  if (!r.affectedRows) return err('Departman bulunamadi', 'api.hr.department_not_found');
  return { ok: true };
}

async function listPositions() {
  const [rows] = await pool.query(
    `SELECT p.id, p.department_id, p.code, p.name, p.is_active, p.created_at, p.updated_at,
            d.name AS department_name
     FROM positions p
     INNER JOIN departments d ON d.id = p.department_id
     ORDER BY p.is_active DESC, d.name ASC, p.name ASC`
  );
  return { positions: rows };
}

async function createPosition(input) {
  const departmentId = parseId(input?.department_id);
  if (!departmentId) return err('Departman seçin', 'api.hr.department_required');
  const name = toUpperTr(input?.name);
  if (!name) return err('Pozisyon adı gerekli', 'api.hr.position_name_required');
  const code = input?.code == null || String(input.code).trim() === '' ? null : String(input.code).trim();
  const [r] = await pool.query(
    'INSERT INTO positions (department_id, code, name, is_active) VALUES (:department_id, :code, :name, :is_active)',
    { department_id: departmentId, code, name, is_active: input?.is_active === 0 ? 0 : 1 }
  );
  return { id: r.insertId };
}

async function updatePosition(id, input) {
  const posId = parseId(id);
  if (!posId) return err('Gecersiz pozisyon', 'api.hr.position_invalid');
  const fields = [];
  const p = { id: posId };
  if (input?.department_id != null) {
    const departmentId = parseId(input.department_id);
    if (!departmentId) return err('Departman secin', 'api.hr.department_required');
    fields.push('department_id = :department_id');
    p.department_id = departmentId;
  }
  if (input?.name != null) {
    const name = toUpperTr(input.name);
    if (!name) return err('Pozisyon adi gerekli', 'api.hr.position_name_required');
    fields.push('name = :name');
    p.name = name;
  }
  if (input?.code !== undefined) {
    const code = input.code == null || String(input.code).trim() === '' ? null : String(input.code).trim();
    fields.push('code = :code');
    p.code = code;
  }
  if (input?.is_active != null) {
    fields.push('is_active = :is_active');
    p.is_active = input.is_active ? 1 : 0;
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  const [r] = await pool.query(`UPDATE positions SET ${fields.join(', ')} WHERE id = :id`, p);
  if (!r.affectedRows) return err('Pozisyon bulunamadi', 'api.hr.position_not_found');
  return { ok: true };
}

async function listEmployees(filters = {}, viewer = null) {
  const where = [];
  const p = {};
  const fErr = applyEmployeeListFilters(filters, where, p);
  if (fErr) return fErr;
  const sql = `SELECT e.id, e.employee_no, e.full_name, e.first_name, e.last_name, e.nationality, e.birth_date, e.gender, e.marital_status, e.photo_path,
                      COALESCE(NULLIF(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')), ' '), e.full_name) AS person_name,
                      e.salary_currency, e.salary_amount, e.official_salary_amount, e.unofficial_salary_amount,
                      e.official_salary_currency, e.official_salary_fx_rate,
                      e.country, e.region_or_city, e.address_line,
                      e.phone, e.phone_secondary, e.identity_no, e.passport_no, e.email, e.hire_date, e.employment_status, e.overtime_eligible,
                      e.department_id, d.name AS department_name, e.position_id, pz.name AS position_name,
                      e.user_id, u.username AS user_username,
                      e.telegram_username, e.telegram_chat_id, e.telegram_notify_enabled,
                      e.note, e.created_at, e.updated_at
               FROM employees e
               LEFT JOIN departments d ON d.id = e.department_id
               LEFT JOIN positions pz ON pz.id = e.position_id
               LEFT JOIN users u ON u.id = e.user_id
               ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY e.id DESC`;
  const [rows] = await pool.query(sql, p);
  rows.forEach(enrichEmployeeRow);
  const canViewGroup = await userHasPermission(viewer?.id, viewer?.role?.slug, 'hr.salary.view_group');
  if (!canViewGroup) {
    rows.forEach((r) => {
      delete r.salary_currency;
      delete r.salary_amount;
      delete r.official_salary_amount;
      delete r.unofficial_salary_amount;
      delete r.official_salary_currency;
      delete r.official_salary_fx_rate;
    });
    return { employees: rows, salaryColumns: [] };
  }

  const [settingRows] = await pool.query(
    `SELECT setting_key, setting_value
     FROM hr_settings
     WHERE setting_key IN ('monthly_work_days', 'monthly_work_hours', 'standard_start_time', 'standard_end_time', 'daily_start_time', 'daily_end_time',
                           'break_1_start_time', 'break_1_end_time', 'break_2_start_time', 'break_2_end_time', 'lunch_start_time', 'lunch_end_time',
                           'time_deduction_hours')`
  );
  const settings = {};
  settingRows.forEach((r) => {
    settings[String(r.setting_key)] = r.setting_value;
  });
  const monthlyWorkDays = Number(settings.monthly_work_days || 0);
  const monthlyWorkHours = Number(settings.monthly_work_hours || 0);
  const standardDailyHours = computeStandardDailyHours(settings) || (monthlyWorkDays > 0 ? Math.round((monthlyWorkHours / monthlyWorkDays) * 100) / 100 : null);

  const columnPerms = [
    ['total', 'hr.salary.view_total'],
    ['rgu_uzs', 'hr.salary.view_rgu_uzs'],
    ['grgu_uzs', 'hr.salary.view_grgu_uzs'],
    ['gu_usd', 'hr.salary.view_gu_usd'],
    ['rsu', 'hr.salary.view_rsu'],
    ['grsu', 'hr.salary.view_grsu'],
    ['su', 'hr.salary.view_su'],
  ];
  const visible = {};
  for (const [k, perm] of columnPerms) {
    // eslint-disable-next-line no-await-in-loop
    visible[k] = await userHasPermission(viewer?.id, viewer?.role?.slug, perm);
  }
  const visibleColumns = columnPerms.filter(([k]) => visible[k]).map(([k]) => k);

  function divSafe(a, b) {
    const x = Number(a);
    const y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y) || y <= 0) return null;
    return Math.round((x / y) * 100) / 100;
  }

  rows.forEach((r) => {
    // Tüm maaş alanları TEK helper'dan üretilir; manuel hesap kalmadı.
    const breakdown = breakdownFromEmployeeRow(r) || {};
    const currency = breakdown.total_salary_currency || 'UZS';
    const totalSalaryAmount = breakdown.total_salary_amount != null ? Number(breakdown.total_salary_amount) : 0;
    const officialUzsForRow = breakdown.official_salary_uzs;
    const unofficialUzsForRow = breakdown.unofficial_salary_uzs;
    const unofficialUsdForRow = breakdown.unofficial_salary_usd;

    // Salary_columns hesaplarında UZS bazlı sütunlar için normalize UZS değerlerini,
    // USD bazlı sütun (gu_usd) için normalize USD değerini kullanıyoruz.
    const rgu = officialUzsForRow != null ? divSafe(officialUzsForRow, monthlyWorkDays) : null;
    const grgu = unofficialUzsForRow != null ? divSafe(unofficialUzsForRow, monthlyWorkDays) : null;
    const gu = unofficialUsdForRow != null ? divSafe(unofficialUsdForRow, monthlyWorkDays) : null;
    const rsu = rgu != null ? divSafe(rgu, standardDailyHours) : null;
    const grsu = grgu != null ? divSafe(grgu, standardDailyHours) : null;
    const su = gu != null ? divSafe(gu, standardDailyHours) : null;

    const salaryCols = {};
    if (visible.total) salaryCols.total = formatMoneyWithCurrency(totalSalaryAmount, currency);
    if (visible.rgu_uzs) salaryCols.rgu_uzs = rgu == null ? '-' : formatMoneyWithCurrency(rgu, 'UZS');
    if (visible.grgu_uzs) salaryCols.grgu_uzs = grgu == null ? '-' : formatMoneyWithCurrency(grgu, 'UZS');
    if (visible.gu_usd) salaryCols.gu_usd = gu == null ? '-' : formatMoneyWithCurrency(gu, 'USD');
    if (visible.rsu) salaryCols.rsu = rsu == null ? '-' : formatMoneyWithCurrency(rsu, 'UZS');
    if (visible.grsu) salaryCols.grsu = grsu == null ? '-' : formatMoneyWithCurrency(grsu, 'UZS');
    if (visible.su) salaryCols.su = su == null ? '-' : formatMoneyWithCurrency(su, 'USD');
    r.salary_columns = salaryCols;

    // Orijinal alanlar
    r.total_salary_amount = totalSalaryAmount;
    r.total_salary_currency = currency;
    r.official_salary_currency = breakdown.official_salary_currency;
    r.official_salary_fx_rate = breakdown.official_salary_fx_rate;
    r.unofficial_salary_currency = breakdown.unofficial_salary_currency;

    // Normalize edilmiş 6 alan (rapor / dashboard / KPI için)
    r.total_salary_uzs = breakdown.total_salary_uzs;
    r.total_salary_usd = breakdown.total_salary_usd;
    r.official_salary_uzs = breakdown.official_salary_uzs;
    r.official_salary_usd = breakdown.official_salary_usd;
    r.unofficial_salary_uzs = breakdown.unofficial_salary_uzs;
    r.unofficial_salary_usd = breakdown.unofficial_salary_usd;

    // API güvenliği: alt izin yoksa ham DB alanları sızmasın.
    delete r.salary_currency;
    delete r.salary_amount;
    delete r.official_salary_amount;
    delete r.unofficial_salary_amount;
  });
  return { employees: rows, salaryColumns: visibleColumns };
}

/**
 * Ücret değerlendirme ekranı: orijinal currency alanlarıyla birlikte normalize edilmiş
 * 6 rapor alanı (USD/UZS) döndürülür. Tüm hesap TEK helper'dan gelir.
 */
async function listCompensationEmployees(filters = {}, _viewer = null) {
  const where = [];
  const p = {};
  const fErr = applyEmployeeListFilters(filters, where, p);
  if (fErr) return fErr;

  const sql = `SELECT e.id, e.employee_no, e.photo_path,
      COALESCE(NULLIF(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')), ' '), e.full_name) AS person_name,
      e.salary_currency, e.salary_amount, e.official_salary_amount, e.unofficial_salary_amount,
      e.official_salary_currency, e.official_salary_fx_rate
      FROM employees e
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY e.full_name ASC, e.id ASC`;
  const [rows] = await pool.query(sql, p);

  const out = rows.map((r) => {
    const breakdown = breakdownFromEmployeeRow(r) || {};
    return {
      id: r.id,
      employee_no: r.employee_no,
      photo_path: r.photo_path || null,
      person_name: r.person_name,

      // ----- Orijinal kaydedilmiş para birimi alanları (kullanıcının girdiği gibi) -----
      total_salary_amount: breakdown.total_salary_amount,
      total_salary_currency: breakdown.total_salary_currency,
      official_salary_amount: breakdown.official_salary_amount,
      official_salary_currency: breakdown.official_salary_currency,
      official_salary_fx_rate: breakdown.official_salary_fx_rate,
      unofficial_salary_amount: breakdown.unofficial_salary_amount,
      unofficial_salary_currency: breakdown.unofficial_salary_currency,

      // ----- Normalize edilmiş rapor alanları (KPI / muhasebe için) -----
      total_salary_uzs: breakdown.total_salary_uzs,
      total_salary_usd: breakdown.total_salary_usd,
      official_salary_uzs: breakdown.official_salary_uzs,
      official_salary_usd: breakdown.official_salary_usd,
      unofficial_salary_uzs: breakdown.unofficial_salary_uzs,
      unofficial_salary_usd: breakdown.unofficial_salary_usd,
    };
  });

  return { rows: out };
}

async function createEmployee(input, actorUserId = null) {
  let firstName = toUpperTr(input?.first_name);
  let lastName = toUpperTr(input?.last_name);
  if ((!firstName || !lastName) && input?.full_name) {
    const raw = String(input.full_name).trim();
    const sp = raw.indexOf(' ');
    if (sp === -1) {
      firstName = firstName || toUpperTr(raw);
      lastName = lastName || '';
    } else {
      firstName = firstName || toUpperTr(raw.slice(0, sp));
      lastName = lastName || toUpperTr(raw.slice(sp + 1));
    }
  }
  if (!String(firstName || '').trim() || !String(lastName || '').trim()) {
    return err('Ad ve soyad gerekli', 'api.hr.employee_name_required');
  }

  const hireDate = String(input?.hire_date || '').trim();
  if (!hireDate) return err('Ise giris tarihi gerekli', 'api.hr.hire_date_required');
  const status = normalizeStatus(input?.employment_status) || 'active';
  const departmentId = parseId(input?.department_id);
  const positionId = parseId(input?.position_id);
  const userId = parseId(input?.user_id);
  const phone = input?.phone == null || String(input.phone).trim() === '' ? null : String(input.phone).trim();
  const phoneSecondary =
    input?.phone_secondary == null || String(input.phone_secondary).trim() === '' ? null : String(input.phone_secondary).trim();
  const identityNo =
    input?.identity_no == null || String(input.identity_no).trim() === '' ? null : toUpperTr(input.identity_no);
  const passportNo =
    input?.passport_no == null || String(input.passport_no).trim() === '' ? null : toUpperTr(input.passport_no);
  const birthDate = input?.birth_date == null || String(input.birth_date).trim() === '' ? null : String(input.birth_date).trim();
  const genderRaw = String(input?.gender || '').trim().toLowerCase();
  const gender = ['male', 'female', 'other'].includes(genderRaw) ? genderRaw : null;
  if (input?.gender != null && String(input.gender).trim() !== '' && !gender) {
    return err('Cinsiyet gecersiz', 'api.hr.gender_invalid');
  }
  const maritalRaw = String(input?.marital_status || '').trim().toLowerCase();
  const maritalStatus = ['single', 'married', 'divorced', 'widowed'].includes(maritalRaw) ? maritalRaw : null;
  if (input?.marital_status != null && String(input.marital_status).trim() !== '' && !maritalStatus) {
    return err('Medeni durum gecersiz', 'api.hr.marital_invalid');
  }
  const email = input?.email == null || String(input.email).trim() === '' ? null : String(input.email).trim();
  const note = optionalNoteUpperTr(input?.note);
  const telegramUsername = normalizeTelegramUsername(input?.telegram_username);
  const telegramChatId = normalizeTelegramChatId(input?.telegram_chat_id);
  const telegramNotifyEnabled = normalizeTelegramNotifyEnabled(input?.telegram_notify_enabled);

  const nationality = normalizeNationality(input?.nationality);
  if (input?.nationality != null && String(input.nationality).trim() !== '' && !nationality) {
    return err('Uyruk gecersiz', 'api.hr.nationality_invalid');
  }

  const country =
    input?.country != null && String(input.country).trim() !== '' ? normalizeCountryCode(input.country) : null;
  if (input?.country != null && String(input.country).trim() !== '' && !country) {
    return err('Ulke gecersiz', 'api.hr.country_invalid');
  }
  let regionOrCity = null;
  if (input?.region_or_city != null && String(input.region_or_city).trim() !== '') {
    regionOrCity = toUpperTr(input.region_or_city);
    if (country && !isValidRegionForCountry(country, regionOrCity)) {
      return err('Il / bolge bu ulke icin gecersiz', 'api.hr.region_invalid');
    }
  }
  const addressLine =
    input?.address_line == null || String(input.address_line).trim() === ''
      ? null
      : optionalNoteUpperTr(input.address_line);

  const wageOut = derivePersistableWage({
    total_salary_amount: input?.salary_amount,
    total_salary_currency: input?.salary_currency || 'UZS',
    official_salary_amount: input?.official_salary_amount,
    official_salary_currency: input?.official_salary_currency,
    official_salary_fx_rate: input?.official_salary_fx_rate,
  });
  if (wageOut.error) return wageOut;
  const wagePersist = wageOut.persist;

  const fullName = toUpperTr(`${firstName} ${lastName}`.trim());

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const employeeNo = await nextEmployeeNumber(conn);
    const [r] = await conn.query(
      `INSERT INTO employees
        (employee_no, full_name, first_name, last_name, nationality, birth_date, gender, marital_status, photo_path, salary_currency,
         salary_amount, official_salary_amount, unofficial_salary_amount, official_salary_currency, official_salary_fx_rate,
         country, region_or_city, address_line,
         phone, phone_secondary, identity_no, passport_no, email, hire_date, employment_status, overtime_eligible, department_id, position_id, user_id,
         telegram_username, telegram_chat_id, telegram_notify_enabled, note)
       VALUES
        (:employee_no, :full_name, :first_name, :last_name, :nationality, :birth_date, :gender, :marital_status, NULL, :salary_currency,
         :salary_amount, :official_salary_amount, :unofficial_salary_amount, :official_salary_currency, :official_salary_fx_rate,
         :country, :region_or_city, :address_line,
         :phone, :phone_secondary, :identity_no, :passport_no, :email, :hire_date, :employment_status, :overtime_eligible, :department_id, :position_id, :user_id,
         :telegram_username, :telegram_chat_id, :telegram_notify_enabled, :note)`,
      {
        employee_no: employeeNo,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        nationality,
        birth_date: birthDate,
        gender,
        marital_status: maritalStatus,
        salary_currency: wagePersist.salary_currency,
        salary_amount: wagePersist.salary_amount,
        official_salary_amount: wagePersist.official_salary_amount,
        unofficial_salary_amount: wagePersist.unofficial_salary_amount,
        official_salary_currency: wagePersist.official_salary_currency,
        official_salary_fx_rate: wagePersist.official_salary_fx_rate,
        country,
        region_or_city: regionOrCity,
        address_line: addressLine,
        phone,
        phone_secondary: phoneSecondary,
        identity_no: identityNo,
        passport_no: passportNo,
        email,
        hire_date: hireDate,
        employment_status: status,
        overtime_eligible: normalizeOvertimeEligible(input?.overtime_eligible),
        department_id: departmentId,
        position_id: positionId,
        user_id: userId,
        telegram_username: telegramUsername,
        telegram_chat_id: telegramChatId,
        telegram_notify_enabled: telegramNotifyEnabled,
        note,
      }
    );
    const newId = r.insertId;
    try {
      await conn.query(
        `INSERT INTO employee_compensation_history (
           employee_id, effective_from, effective_to,
           salary_currency, salary_amount, official_salary_amount, unofficial_salary_amount,
           official_salary_currency, official_salary_fx_rate,
           reason, created_by
         )
         SELECT
           e.id,
           COALESCE(DATE(e.hire_date), DATE(e.created_at), CURDATE()),
           NULL,
           e.salary_currency, e.salary_amount, e.official_salary_amount, e.unofficial_salary_amount,
           COALESCE(NULLIF(TRIM(e.official_salary_currency), ''), NULLIF(TRIM(e.salary_currency), ''), 'UZS'),
           COALESCE(e.official_salary_fx_rate, 1),
           'EMPLOYEE_CREATE_INITIAL',
           :actor
         FROM employees e
         WHERE e.id = :newId`,
        {
          newId,
          actor:
            actorUserId != null && Number.isFinite(Number(actorUserId)) && Number(actorUserId) > 0
              ? Number(actorUserId)
              : null,
        }
      );
    } catch (e) {
      if (e.code === 'ER_NO_SUCH_TABLE') {
        await conn.rollback();
        return err('Maaş geçmişi tablosu yok; migrasyon calistirin', 'api.hr.compensation_history_table_missing');
      }
      throw e;
    }
    await conn.commit();
    return { id: newId, employee_no: employeeNo };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getEmployeeById(id) {
  const empId = parseId(id);
  if (!empId) return err('Gecersiz personel', 'api.hr.employee_invalid');
  const [rows] = await pool.query(
    `SELECT e.id, e.employee_no, e.full_name, e.first_name, e.last_name, e.nationality, e.birth_date, e.gender, e.marital_status, e.photo_path,
            e.salary_currency, e.salary_amount, e.official_salary_amount, e.unofficial_salary_amount,
            e.official_salary_currency, e.official_salary_fx_rate,
            e.country, e.region_or_city, e.address_line,
            e.phone, e.phone_secondary, e.identity_no, e.passport_no, e.email, e.hire_date, e.employment_status, e.overtime_eligible,
            e.department_id, e.position_id, e.user_id,
            e.telegram_username, e.telegram_chat_id, e.telegram_notify_enabled, e.note
     FROM employees e
     WHERE e.id = :id
     LIMIT 1`,
    { id: empId }
  );
  if (!rows.length) return err('Personel bulunamadi', 'api.hr.employee_not_found');
  const emp = enrichEmployeeRow(rows[0]);
  // Resmi olmayan maaş ve normalize edilmiş 6 alan TEK helper'dan üretilir.
  const breakdown = breakdownFromEmployeeRow(emp);
  if (breakdown) {
    emp.unofficial_salary_amount = breakdown.unofficial_salary_amount;
    emp.unofficial_salary_currency = breakdown.unofficial_salary_currency;
    emp.total_salary_uzs = breakdown.total_salary_uzs;
    emp.total_salary_usd = breakdown.total_salary_usd;
    emp.official_salary_uzs = breakdown.official_salary_uzs;
    emp.official_salary_usd = breakdown.official_salary_usd;
    emp.unofficial_salary_uzs = breakdown.unofficial_salary_uzs;
    emp.unofficial_salary_usd = breakdown.unofficial_salary_usd;
    emp.wage_breakdown = breakdown;
  }
  return { employee: emp };
}

async function updateEmployee(id, input, viewer = null) {
  const empId = parseId(id);
  if (!empId) return err('Gecersiz personel', 'api.hr.employee_invalid');
  const [curRows] = await pool.query(
    `SELECT id, employee_no, full_name, first_name, last_name, nationality, birth_date, gender, marital_status, photo_path, salary_currency,
            salary_amount, official_salary_amount, unofficial_salary_amount,
            official_salary_currency, official_salary_fx_rate,
            country, region_or_city, address_line,
            phone, phone_secondary, identity_no, passport_no, email, hire_date, employment_status, overtime_eligible, department_id, position_id, user_id,
            telegram_username, telegram_chat_id, telegram_notify_enabled, note
     FROM employees WHERE id = :id LIMIT 1`,
    { id: empId }
  );
  if (!curRows.length) return err('Personel bulunamadi', 'api.hr.employee_not_found');
  const cur = curRows[0];

  const fields = [];
  const p = { id: empId };

  let firstName = cur.first_name;
  let lastName = cur.last_name;
  if (input?.first_name != null) {
    firstName = toUpperTr(input.first_name);
    if (!firstName) return err('Ad gerekli', 'api.hr.employee_first_name_required');
    fields.push('first_name = :first_name');
    p.first_name = firstName;
  }
  if (input?.last_name != null) {
    lastName = toUpperTr(input.last_name);
    if (!lastName) return err('Soyad gerekli', 'api.hr.employee_last_name_required');
    fields.push('last_name = :last_name');
    p.last_name = lastName;
  }
  if (input?.first_name != null || input?.last_name != null) {
    const fn = input?.first_name != null ? firstName : cur.first_name;
    const ln = input?.last_name != null ? lastName : cur.last_name;
    if (!String(fn || '').trim() || !String(ln || '').trim()) {
      return err('Ad ve soyad gerekli', 'api.hr.employee_name_required');
    }
    const mergedFull = toUpperTr(`${fn || ''} ${ln || ''}`.trim());
    fields.push('full_name = :full_name');
    p.full_name = mergedFull;
  } else if (input?.full_name != null) {
    // Geriye uyumluluk: sadece full_name gelirse ad/soyad üretip sakla.
    const fullRaw = String(input.full_name || '').trim();
    if (fullRaw) {
      const sp = fullRaw.indexOf(' ');
      const fn = sp === -1 ? toUpperTr(fullRaw) : toUpperTr(fullRaw.slice(0, sp));
      const ln = sp === -1 ? '' : toUpperTr(fullRaw.slice(sp + 1));
      if (!String(fn || '').trim() || !String(ln || '').trim()) {
        return err('Ad ve soyad gerekli', 'api.hr.employee_name_required');
      }
      fields.push('first_name = :first_name');
      fields.push('last_name = :last_name');
      fields.push('full_name = :full_name');
      p.first_name = fn;
      p.last_name = ln;
      p.full_name = toUpperTr(`${fn} ${ln}`.trim());
    }
  }

  if (input?.nationality !== undefined) {
    const nat = normalizeNationality(input.nationality);
    if (input.nationality != null && String(input.nationality).trim() !== '' && !nat) {
      return err('Uyruk gecersiz', 'api.hr.nationality_invalid');
    }
    fields.push('nationality = :nationality');
    p.nationality = nat;
  }
  if (input?.birth_date !== undefined) {
    p.birth_date = input.birth_date == null || String(input.birth_date).trim() === '' ? null : String(input.birth_date).trim();
    fields.push('birth_date = :birth_date');
  }
  if (input?.gender !== undefined) {
    const genderRaw = input.gender == null ? '' : String(input.gender).trim().toLowerCase();
    const gender = ['male', 'female', 'other'].includes(genderRaw) ? genderRaw : null;
    if (input.gender != null && String(input.gender).trim() !== '' && !gender) {
      return err('Cinsiyet gecersiz', 'api.hr.gender_invalid');
    }
    p.gender = gender;
    fields.push('gender = :gender');
  }
  if (input?.marital_status !== undefined) {
    const maritalRaw = input.marital_status == null ? '' : String(input.marital_status).trim().toLowerCase();
    const maritalStatus = ['single', 'married', 'divorced', 'widowed'].includes(maritalRaw) ? maritalRaw : null;
    if (input.marital_status != null && String(input.marital_status).trim() !== '' && !maritalStatus) {
      return err('Medeni durum gecersiz', 'api.hr.marital_invalid');
    }
    p.marital_status = maritalStatus;
    fields.push('marital_status = :marital_status');
  }

  if (input?.photo_path !== undefined) {
    const ph = input.photo_path == null || String(input.photo_path).trim() === '' ? null : String(input.photo_path).trim();
    fields.push('photo_path = :photo_path');
    p.photo_path = ph;
  }

  if (input?.country !== undefined) {
    const country =
      input.country == null || String(input.country).trim() === '' ? null : normalizeCountryCode(input.country);
    if (input.country != null && String(input.country).trim() !== '' && !country) {
      return err('Ulke gecersiz', 'api.hr.country_invalid');
    }
    fields.push('country = :country');
    p.country = country;
  }

  if (input?.region_or_city !== undefined) {
    const reg =
      input.region_or_city == null || String(input.region_or_city).trim() === '' ? null : toUpperTr(input.region_or_city);
    const effCountry =
      input.country !== undefined ? p.country : cur.country;
    if (reg && effCountry && !isValidRegionForCountry(effCountry, reg)) {
      return err('Il / bolge bu ulke icin gecersiz', 'api.hr.region_invalid');
    }
    fields.push('region_or_city = :region_or_city');
    p.region_or_city = reg;
  }

  if (input?.address_line !== undefined) {
    fields.push('address_line = :address_line');
    p.address_line =
      input.address_line == null || String(input.address_line).trim() === ''
        ? null
        : optionalNoteUpperTr(input.address_line);
  }

  // Faz 2A: Maaş alanları PATCH ile güncellenmez; POST .../compensation-revisions kullanılır.
  const wageTouched =
    input?.salary_amount !== undefined ||
    input?.salary_currency !== undefined ||
    input?.official_salary_amount !== undefined ||
    input?.official_salary_currency !== undefined ||
    input?.official_salary_fx_rate !== undefined ||
    input?.unofficial_salary_amount !== undefined;
  if (wageTouched) {
    const uid = viewer?.id;
    const slug = viewer?.role?.slug;
    const canEditSalary = uid != null && (await userHasPermission(uid, slug, 'hr.salary.edit'));
    if (!canEditSalary) {
      return err('Maaş düzenlemek için yetkiniz yok', 'api.hr.salary_edit_forbidden');
    }
    return err(
      'Maaş güncellemesi için POST /api/hr/employees/:id/compensation-revisions kullanin',
      'api.hr.salary_patch_forbidden_use_revision'
    );
  }

  if (input?.phone !== undefined) {
    p.phone = input.phone == null || String(input.phone).trim() === '' ? null : String(input.phone).trim();
    fields.push('phone = :phone');
  }
  if (input?.phone_secondary !== undefined) {
    p.phone_secondary =
      input.phone_secondary == null || String(input.phone_secondary).trim() === '' ? null : String(input.phone_secondary).trim();
    fields.push('phone_secondary = :phone_secondary');
  }
  if (input?.identity_no !== undefined) {
    p.identity_no = input.identity_no == null || String(input.identity_no).trim() === '' ? null : toUpperTr(input.identity_no);
    fields.push('identity_no = :identity_no');
  }
  if (input?.passport_no !== undefined) {
    p.passport_no = input.passport_no == null || String(input.passport_no).trim() === '' ? null : toUpperTr(input.passport_no);
    fields.push('passport_no = :passport_no');
  }
  if (input?.email !== undefined) {
    p.email = input.email == null || String(input.email).trim() === '' ? null : String(input.email).trim();
    fields.push('email = :email');
  }
  if (input?.hire_date != null) {
    const hireDate = String(input.hire_date || '').trim();
    if (!hireDate) return err('Ise giris tarihi gerekli', 'api.hr.hire_date_required');
    fields.push('hire_date = :hire_date');
    p.hire_date = hireDate;
  }
  if (input?.employment_status != null) {
    const status = normalizeStatus(input.employment_status);
    if (!status) return err('Personel durumu gecersiz', 'api.hr.employee_status_invalid');
    fields.push('employment_status = :employment_status');
    p.employment_status = status;
  }
  if (input?.overtime_eligible !== undefined) {
    fields.push('overtime_eligible = :overtime_eligible');
    p.overtime_eligible = normalizeOvertimeEligible(input.overtime_eligible);
  }
  if (input?.department_id !== undefined) {
    p.department_id = parseId(input.department_id);
    fields.push('department_id = :department_id');
  }
  if (input?.position_id !== undefined) {
    p.position_id = parseId(input.position_id);
    fields.push('position_id = :position_id');
  }
  if (input?.user_id !== undefined) {
    p.user_id = parseId(input.user_id);
    fields.push('user_id = :user_id');
  }
  if (input?.note !== undefined) {
    p.note = optionalNoteUpperTr(input.note);
    fields.push('note = :note');
  }
  if (input?.telegram_username !== undefined) {
    p.telegram_username = normalizeTelegramUsername(input.telegram_username);
    fields.push('telegram_username = :telegram_username');
  }
  if (input?.telegram_chat_id !== undefined) {
    p.telegram_chat_id = normalizeTelegramChatId(input.telegram_chat_id);
    fields.push('telegram_chat_id = :telegram_chat_id');
  }
  if (input?.telegram_notify_enabled !== undefined) {
    p.telegram_notify_enabled = normalizeTelegramNotifyEnabled(input.telegram_notify_enabled);
    fields.push('telegram_notify_enabled = :telegram_notify_enabled');
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  const [r] = await pool.query(`UPDATE employees SET ${fields.join(', ')} WHERE id = :id`, p);
  if (!r.affectedRows) return err('Personel bulunamadi', 'api.hr.employee_not_found');
  return { ok: true };
}

async function updateEmployeePhoto(employeeId, relativePathUnderUploads) {
  const empId = parseId(employeeId);
  if (!empId) return err('Gecersiz personel', 'api.hr.employee_invalid');
  const rel = String(relativePathUnderUploads || '').replace(/\\/g, '/');
  if (!rel || rel.includes('..')) return err('Gecersiz dosya yolu', 'api.hr.photo_path_invalid');

  const [rows] = await pool.query('SELECT id, photo_path FROM employees WHERE id = :id LIMIT 1', { id: empId });
  if (!rows.length) return err('Personel bulunamadi', 'api.hr.employee_not_found');
  const prev = rows[0].photo_path;
  await pool.query('UPDATE employees SET photo_path = :photo_path WHERE id = :id', { id: empId, photo_path: rel });
  if (prev && prev !== rel) safeUnlinkUpload(prev);
  return { ok: true, photo_path: rel };
}

async function listAssignableUsers(currentEmployeeId = null) {
  const employeeId = parseId(currentEmployeeId);
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.email, u.is_active,
            e.id AS linked_employee_id
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.id
     WHERE u.is_active = 1
       AND (e.id IS NULL OR e.id = :employee_id)
     ORDER BY u.username ASC`,
    { employee_id: employeeId || 0 }
  );
  return { users: rows };
}

async function listAttendance(filters = {}) {
  const where = [];
  const p = {};
  if (parseId(filters.employeeId)) {
    where.push('a.employee_id = :employee_id');
    p.employee_id = parseId(filters.employeeId);
  }
  const ws = normalizeWorkStatus(filters.status);
  if (ws) {
    where.push('a.work_status = :work_status');
    p.work_status = ws;
  }
  if (filters.from) {
    where.push('a.work_date >= :from_date');
    p.from_date = String(filters.from);
  }
  if (filters.to) {
    where.push('a.work_date <= :to_date');
    p.to_date = String(filters.to);
  }
  const sql = `SELECT a.id, a.employee_id, e.employee_no, e.first_name, e.last_name, e.full_name,
                      a.work_date, a.check_in_time, a.check_out_time,
                      a.work_status, a.overtime_hours, a.note, a.created_at, a.updated_at
               FROM employee_attendance a
               INNER JOIN employees e ON e.id = a.employee_id
               ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY a.work_date DESC, a.id DESC`;
  const [rows] = await pool.query(sql, p);
  rows.forEach((row) => {
    row.employee_name = formatEmployeeLabel(row);
  });
  return { attendance: rows };
}

async function createAttendance(input, actorId) {
  const employeeId = parseId(input?.employee_id);
  if (!employeeId) return err('Personel secin', 'api.hr.employee_required');
  const workDate = String(input?.work_date || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return err('Tarih gecersiz', 'api.hr.work_date_required');
  if (await isAttendanceMonthLocked(monthKeyFromDate(workDate))) {
    return err('Ay kilitli, puantaj degistirilemez', 'api.hr.attendance_month_locked');
  }
  const wsCheck = await ensureAllowedCode(
    'hr_work_statuses',
    input?.work_status,
    'Çalışma durumu geçersiz',
    'api.hr.work_status_invalid'
  );
  if (wsCheck && wsCheck.error) return wsCheck;
  const workStatus = wsCheck;

  const checkIn = normalizeTime(input?.check_in_time);
  const checkOut = normalizeTime(input?.check_out_time);
  const vErr = validateAttendanceRule(workStatus, checkIn, checkOut);
  if (vErr) return vErr;
  const overtime = Number(input?.overtime_hours);
  const rawOvertimeHours = Number.isFinite(overtime) && overtime >= 0 ? overtime : 0;
  const rawOvertimeMinutes = Math.max(0, Math.round(rawOvertimeHours * 60));
  const [empRows] = await pool.query('SELECT overtime_eligible FROM employees WHERE id = :id LIMIT 1', { id: employeeId });
  const overtimeEligible = isOvertimeEligible(empRows[0]?.overtime_eligible);
  const payableOvertimeMinutes = overtimeEligible ? rawOvertimeMinutes : 0;
  const overtimeHours = Math.round((payableOvertimeMinutes / 60) * 100) / 100;
  const note = optionalNoteUpperTr(input?.note);

  const [r] = await pool.query(
    `INSERT INTO employee_attendance
      (employee_id, work_date, check_in_time, check_out_time, work_status, overtime_hours, raw_overtime_minutes, payable_overtime_minutes, note, created_by, updated_by)
     VALUES
      (:employee_id, :work_date, :check_in_time, :check_out_time, :work_status, :overtime_hours, :raw_overtime_minutes, :payable_overtime_minutes, :note, :created_by, :updated_by)`,
    {
      employee_id: employeeId,
      work_date: workDate,
      check_in_time: checkIn,
      check_out_time: checkOut,
      work_status: workStatus,
      overtime_hours: overtimeHours,
      raw_overtime_minutes: rawOvertimeMinutes,
      payable_overtime_minutes: payableOvertimeMinutes,
      note,
      created_by: actorId || null,
      updated_by: actorId || null,
    }
  );
  return { id: r.insertId };
}

async function updateAttendance(id, input, actorId) {
  const attId = parseId(id);
  if (!attId) return err('Gecersiz puantaj kaydi', 'api.hr.attendance_invalid');

  const [rows] = await pool.query(
    `SELECT id, employee_id, work_date, check_in_time, check_out_time, work_status, overtime_hours, raw_overtime_minutes, payable_overtime_minutes, note
     FROM employee_attendance
     WHERE id = :id
     LIMIT 1`,
    { id: attId }
  );
  if (!rows.length) return err('Puantaj kaydi bulunamadi', 'api.hr.attendance_not_found');
  const current = rows[0];

  const nextWorkStatus =
    input?.work_status !== undefined
      ? await ensureAllowedCode('hr_work_statuses', input.work_status, 'Çalışma durumu geçersiz', 'api.hr.work_status_invalid')
      : current.work_status;
  if (nextWorkStatus && nextWorkStatus.error) return nextWorkStatus;

  const next = {
    employee_id: input?.employee_id !== undefined ? parseId(input.employee_id) : current.employee_id,
    work_date: input?.work_date !== undefined ? String(input.work_date || '').trim() : String(current.work_date || '').slice(0, 10),
    work_status: nextWorkStatus,
    check_in_time:
      input?.check_in_time !== undefined
        ? normalizeTime(input.check_in_time)
        : normalizeTime(String(current.check_in_time || '').slice(0, 8)),
    check_out_time:
      input?.check_out_time !== undefined
        ? normalizeTime(input.check_out_time)
        : normalizeTime(String(current.check_out_time || '').slice(0, 8)),
    overtime_hours:
      input?.overtime_hours !== undefined
        ? (() => {
            const n = Number(input.overtime_hours);
            return Number.isFinite(n) && n >= 0 ? n : null;
          })()
        : Number(current.overtime_hours || 0),
    note: input?.note !== undefined ? optionalNoteUpperTr(input.note) : current.note,
  };

  if (!next.employee_id) return err('Personel secin', 'api.hr.employee_required');
  const nextWd = String(next.work_date || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextWd)) return err('Tarih gecersiz', 'api.hr.work_date_required');
  next.work_date = nextWd;
  const curWd = String(current.work_date || '').slice(0, 10);
  if (await isAttendanceMonthLocked(monthKeyFromDate(curWd))) {
    return err('Ay kilitli, puantaj degistirilemez', 'api.hr.attendance_month_locked');
  }
  if (await isAttendanceMonthLocked(monthKeyFromDate(nextWd))) {
    return err('Ay kilitli, puantaj degistirilemez', 'api.hr.attendance_month_locked');
  }
  if (!next.work_status) return err('Çalışma durumu geçersiz', 'api.hr.work_status_invalid');
  if (next.overtime_hours == null) return err('Fazla mesai saati gecersiz', 'api.hr.overtime_invalid');

  const vErr = validateAttendanceRule(next.work_status, next.check_in_time, next.check_out_time);
  if (vErr) return vErr;

  const rawOvertimeMinutes = Math.max(0, Math.round((Number(next.overtime_hours || 0)) * 60));
  const [empRows] = await pool.query('SELECT overtime_eligible FROM employees WHERE id = :id LIMIT 1', { id: next.employee_id });
  const overtimeEligible = isOvertimeEligible(empRows[0]?.overtime_eligible);
  const payableOvertimeMinutes = overtimeEligible ? rawOvertimeMinutes : 0;
  const payableOvertimeHours = Math.round((payableOvertimeMinutes / 60) * 100) / 100;

  const [r] = await pool.query(
    `UPDATE employee_attendance
     SET employee_id = :employee_id,
         work_date = :work_date,
         check_in_time = :check_in_time,
         check_out_time = :check_out_time,
         work_status = :work_status,
        overtime_hours = :overtime_hours,
        raw_overtime_minutes = :raw_overtime_minutes,
        payable_overtime_minutes = :payable_overtime_minutes,
         note = :note,
         updated_by = :updated_by
     WHERE id = :id`,
    {
      id: attId,
      employee_id: next.employee_id,
      work_date: next.work_date,
      check_in_time: next.check_in_time,
      check_out_time: next.check_out_time,
      work_status: next.work_status,
      overtime_hours: payableOvertimeHours,
      raw_overtime_minutes: rawOvertimeMinutes,
      payable_overtime_minutes: payableOvertimeMinutes,
      note: next.note,
      updated_by: actorId || null,
    }
  );
  if (!r.affectedRows) return err('Puantaj kaydi bulunamadi', 'api.hr.attendance_not_found');
  return { ok: true };
}

async function updateMonthlyAttendanceRow(id, input, actorId) {
  const attId = parseId(id);
  if (!attId) return err('Gecersiz puantaj kaydi', 'api.hr.attendance_invalid');
  const [rows] = await pool.query(
    'SELECT id, employee_id, work_date, overtime_hours FROM employee_attendance WHERE id = :id LIMIT 1',
    { id: attId }
  );
  if (!rows.length) return err('Puantaj kaydi bulunamadi', 'api.hr.attendance_not_found');
  const rowWd = String(rows[0].work_date || '').slice(0, 10);
  if (await isAttendanceMonthLocked(monthKeyFromDate(rowWd))) {
    return err('Ay kilitli, puantaj degistirilemez', 'api.hr.attendance_month_locked');
  }

  const fields = [];
  const p = { id: attId, updated_by: actorId || null };

  if (input?.project_id !== undefined) {
    const pid = parseId(input.project_id);
    fields.push('project_id = :project_id');
    p.project_id = pid || null;
  }
  if (input?.work_status !== undefined) {
    const ws = await ensureAllowedCode('hr_work_statuses', input.work_status, 'Çalışma durumu geçersiz', 'api.hr.work_status_invalid');
    if (ws && ws.error) return ws;
    fields.push('work_status = :work_status');
    p.work_status = ws;
  }
  if (input?.work_type !== undefined) {
    const wt = await ensureAllowedCode('hr_work_types', input.work_type, 'Is tipi gecersiz', 'api.hr.work_type_invalid');
    if (wt && wt.error) return wt;
    fields.push('work_type = :work_type');
    p.work_type = wt;
  }
  if (input?.total_hours !== undefined) {
    const th = Number(input.total_hours);
    if (!Number.isFinite(th) || th < 0) return err('Toplam saat gecersiz', 'api.hr.total_hours_invalid');
    fields.push('total_hours = :total_hours');
    p.total_hours = th;
  }
  if (input?.overtime_hours !== undefined) {
    const oh = Number(input.overtime_hours);
    if (!Number.isFinite(oh) || oh < 0) return err('Fazla mesai saati gecersiz', 'api.hr.overtime_invalid');
    fields.push('overtime_hours = :overtime_hours');
    p._raw_overtime_minutes = Math.max(0, Math.round(oh * 60));
  } else {
    p._raw_overtime_minutes = Math.max(0, Math.round((Number(rows[0].overtime_hours || 0)) * 60));
  }
  if (input?.note !== undefined) {
    fields.push('note = :note');
    p.note = optionalNoteUpperTr(input.note);
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  if (fields.includes('overtime_hours = :overtime_hours')) {
    const [empRows] = await pool.query('SELECT overtime_eligible FROM employees WHERE id = :id LIMIT 1', { id: rows[0].employee_id });
    const overtimeEligible = isOvertimeEligible(empRows[0]?.overtime_eligible);
    const payableOvertimeMinutes = overtimeEligible ? p._raw_overtime_minutes : 0;
    p.overtime_hours = Math.round((payableOvertimeMinutes / 60) * 100) / 100;
    fields.push('raw_overtime_minutes = :raw_overtime_minutes');
    fields.push('payable_overtime_minutes = :payable_overtime_minutes');
    p.raw_overtime_minutes = p._raw_overtime_minutes;
    p.payable_overtime_minutes = payableOvertimeMinutes;
  }

  fields.push('updated_by = :updated_by');
  await pool.query(`UPDATE employee_attendance SET ${fields.join(', ')} WHERE id = :id`, p);
  return { ok: true };
}

async function listDailyAttendance(dateRaw, empFilters = {}) {
  const workDate = String(dateRaw || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return err('Tarih gecersiz', 'api.hr.work_date_required');
  const where = ['e.employment_status = \'active\''];
  const p = { work_date: workDate };
  const fErr = applyEmployeeAttendanceFilters(empFilters, where, p);
  if (fErr) return fErr;
  const [rows] = await pool.query(
    `SELECT e.id AS employee_id,
            e.employee_no,
            e.first_name,
            e.last_name,
            COALESCE(NULLIF(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')), ' '), e.full_name) AS full_name,
            e.department_id,
            d.name AS department_name,
            e.position_id,
            pz.name AS position_name,
            e.overtime_eligible,
            a.id AS attendance_id,
            a.project_id,
            prj.project_code,
            a.work_type,
            a.work_status,
            a.check_in_time,
            a.check_out_time,
            a.total_hours,
            a.overtime_hours,
            a.raw_overtime_minutes,
            a.payable_overtime_minutes,
            a.note
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN positions pz ON pz.id = e.position_id
     LEFT JOIN employee_attendance a ON a.employee_id = e.id AND a.work_date = :work_date
     LEFT JOIN projects prj ON prj.id = a.project_id
     WHERE ${where.join(' AND ')}
     ORDER BY e.first_name ASC, e.last_name ASC, e.full_name ASC`,
    p
  );
  rows.forEach((r) => {
    r.employee_display = formatEmployeeLabel(r);
  });
  return { date: workDate, rows, isLocked: await isAttendanceMonthLocked(monthKeyFromDate(workDate)) };
}

async function summarizeDailyAttendance(dateRaw, empFilters = {}) {
  const workDate = String(dateRaw || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return err('Tarih gecersiz', 'api.hr.work_date_required');
  const where = ['e.employment_status = \'active\''];
  const p = { work_date: workDate };
  const fErr = applyEmployeeAttendanceFilters(empFilters, where, p);
  if (fErr) return fErr;
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total_active,
            SUM(CASE WHEN a.work_status = 'absent' THEN 1 ELSE 0 END) AS absent,
            SUM(CASE WHEN a.work_status IN ('paid_leave','unpaid_leave','leave','sick_leave','half_day') THEN 1 ELSE 0 END) AS on_leave
     FROM employees e
     LEFT JOIN employee_attendance a ON a.employee_id = e.id AND a.work_date = :work_date
     WHERE ${where.join(' AND ')}`,
    p
  );
  const r = rows[0] || {};
  return {
    date: workDate,
    totalEmployees: Number(r.total_active) || 0,
    absent: Number(r.absent) || 0,
    onLeave: Number(r.on_leave) || 0,
    isLocked: await isAttendanceMonthLocked(monthKeyFromDate(workDate)),
  };
}

async function saveDailyAttendanceBulk({ workDate, entries } = {}, actorId) {
  const d = String(workDate || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return err('Tarih gecersiz', 'api.hr.work_date_required');
  if (await isAttendanceMonthLocked(monthKeyFromDate(d))) {
    return err('Ay kilitli, puantaj degistirilemez', 'api.hr.attendance_month_locked');
  }
  if (!Array.isArray(entries) || !entries.length) return err('Kayit satirlari gerekli', 'api.hr.daily_rows_required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let affected = 0;
    const allowedStatuses = await getAllowedCodes('hr_work_statuses', true);
    const allowedTypes = await getAllowedCodes('hr_work_types', true);
    const { settings: attendanceSettings, workStatuses } = await getHrSettingsBundle({ includeInactive: true });
    const statusMultipliers = new Map();
    (workStatuses || []).forEach((s) => {
      const key = String(s.code || '').trim().toLowerCase();
      if (!key) return;
      const mul = Number(s.multiplier);
      statusMultipliers.set(key, Number.isFinite(mul) && mul >= 0 ? mul : 1);
    });
    if (!statusMultipliers.has('paid_leave')) statusMultipliers.set('paid_leave', 1);
    if (!statusMultipliers.has('unpaid_leave')) statusMultipliers.set('unpaid_leave', 0);
    for (const row of entries) {
      const employeeId = parseId(row?.employee_id);
      if (!employeeId) continue;
      const workStatus = normalizeWorkStatus(row?.work_status);
      if (!workStatus || !allowedStatuses.has(workStatus)) {
        await conn.rollback();
        return err('Çalışma durumu geçersiz', 'api.hr.work_status_invalid');
      }
      const wtCandidate = normalizeWorkType(row?.work_type) || 'normal';
      if (!allowedTypes.has(wtCandidate)) {
        await conn.rollback();
        return err('Is tipi gecersiz', 'api.hr.work_type_invalid');
      }
      const workType = wtCandidate;
      const checkIn = normalizeTime(row?.check_in_time);
      const checkOut = normalizeTime(row?.check_out_time);
      const vErr = validateAttendanceRule(workStatus, checkIn, checkOut);
      if (vErr) {
        await conn.rollback();
        return vErr;
      }
      // Nihai kaynak backend hesap motoru olmalidir; frontend saat degerleri kabul edilmez.
      const sundayWorkableOverride = parseBool01Loose(row?.sunday_workable_override);
      const sundayPaidOverride = parseBool01Loose(row?.sunday_paid_override);
      const hourBreakdown = computeDailyHoursBreakdownByRules({
        workDate: d,
        workStatus,
        checkIn,
        checkOut,
        settings: attendanceSettings,
        statusMultipliers,
        sundayWorkableOverride,
        sundayPaidOverride,
      });
      const totalHours = Number(hourBreakdown?.totalHours || 0);
      const rawOvertimeHours = Number(hourBreakdown?.overtimeHours || 0);
      const rawOvertimeMinutes = Math.max(0, Math.round(rawOvertimeHours * 60));
      const [empRows] = await conn.query('SELECT overtime_eligible FROM employees WHERE id = :id LIMIT 1', { id: employeeId });
      const overtimeEligible = isOvertimeEligible(empRows[0]?.overtime_eligible);
      const payableOvertimeMinutes = overtimeEligible ? rawOvertimeMinutes : 0;
      const overtimeHours = Math.round((payableOvertimeMinutes / 60) * 100) / 100;
      const note = optionalNoteUpperTr(row?.note);
      const projectId = parseId(row?.project_id);
      await conn.query(
        `INSERT INTO employee_attendance
          (employee_id, work_date, project_id, work_type, check_in_time, check_out_time, work_status, total_hours, overtime_hours, raw_overtime_minutes, payable_overtime_minutes, note, created_by, updated_by)
         VALUES
          (:employee_id, :work_date, :project_id, :work_type, :check_in_time, :check_out_time, :work_status, :total_hours, :overtime_hours, :raw_overtime_minutes, :payable_overtime_minutes, :note, :created_by, :updated_by)
         ON DUPLICATE KEY UPDATE
           project_id = VALUES(project_id),
           work_type = VALUES(work_type),
           check_in_time = VALUES(check_in_time),
           check_out_time = VALUES(check_out_time),
           work_status = VALUES(work_status),
           total_hours = VALUES(total_hours),
          overtime_hours = VALUES(overtime_hours),
          raw_overtime_minutes = VALUES(raw_overtime_minutes),
          payable_overtime_minutes = VALUES(payable_overtime_minutes),
           note = VALUES(note),
           updated_by = VALUES(updated_by)`,
        {
          employee_id: employeeId,
          work_date: d,
          project_id: projectId,
          work_type: workType,
          check_in_time: checkIn,
          check_out_time: checkOut,
          work_status: workStatus,
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          raw_overtime_minutes: rawOvertimeMinutes,
          payable_overtime_minutes: payableOvertimeMinutes,
          note,
          created_by: actorId || null,
          updated_by: actorId || null,
        }
      );
      affected += 1;
    }
    await conn.commit();
    return { ok: true, affected };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listMonthlyAttendance({
  month,
  employeeId,
  projectId,
  nationality,
  country,
  region_or_city,
  department_id,
  position_id,
  search,
} = {}, viewer = null) {
  const mk = normalizeMonthKey(month);
  if (!mk) return err('Ay gecersiz', 'api.hr.month_required');
  const where = ["DATE_FORMAT(a.work_date, '%Y-%m') = :month_key"];
  const p = { month_key: mk };
  const eid = parseId(employeeId);
  if (eid) {
    where.push('a.employee_id = :employee_id');
    p.employee_id = eid;
  }
  const pid = parseId(projectId);
  if (pid) {
    where.push('a.project_id = :project_id');
    p.project_id = pid;
  }
  const fErr = applyEmployeeAttendanceFilters(
    { nationality, country, region_or_city, department_id, position_id, search },
    where,
    p
  );
  if (fErr) return fErr;
  const [rows] = await pool.query(
    `SELECT a.id, a.work_date, a.employee_id, e.employee_no, e.first_name, e.last_name,
            COALESCE(NULLIF(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')), ' '), e.full_name) AS full_name,
            a.project_id, prj.project_code, prj.name AS project_name, a.work_type, a.work_status,
            a.check_in_time, a.check_out_time, a.total_hours, a.overtime_hours, a.note
     FROM employee_attendance a
     INNER JOIN employees e ON e.id = a.employee_id
     LEFT JOIN projects prj ON prj.id = a.project_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.work_date ASC, e.first_name ASC, e.last_name ASC, e.full_name ASC`,
    p
  );
  rows.forEach((row) => {
    row.employee_name = formatEmployeeLabel(row);
  });
  const [summary] = await pool.query(
    `SELECT a.employee_id, e.employee_no, e.first_name, e.last_name,
            COALESCE(NULLIF(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')), ' '), e.full_name) AS full_name,
            SUM(a.total_hours) AS total_hours,
            SUM(a.overtime_hours) AS overtime_hours,
            SUM(CASE WHEN a.work_status = 'worked' THEN 1 ELSE 0 END) AS worked_days,
            SUM(CASE WHEN a.work_status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
            SUM(CASE WHEN a.work_status = 'leave' THEN 1 ELSE 0 END) AS leave_days,
            SUM(CASE WHEN a.work_status = 'sick_leave' THEN 1 ELSE 0 END) AS sick_leave_days,
            SUM(CASE WHEN a.work_status = 'half_day' THEN 1 ELSE 0 END) AS half_day_days,
            SUM(CASE WHEN a.work_status = 'overtime' THEN 1 ELSE 0 END) AS overtime_days
     FROM employee_attendance a
     INNER JOIN employees e ON e.id = a.employee_id
     WHERE ${where.join(' AND ')}
     GROUP BY a.employee_id, e.employee_no, e.first_name, e.last_name, e.full_name
     ORDER BY e.first_name ASC, e.last_name ASC, e.full_name ASC`,
    p
  );
  summary.forEach((row) => {
    row.employee_name = formatEmployeeLabel(row);
  });
  const canViewSalaryGroup = await userHasPermission(viewer?.id, viewer?.role?.slug, 'hr.salary.view_group');
  const salaryPerms = {
    rsu: canViewSalaryGroup && (await userHasPermission(viewer?.id, viewer?.role?.slug, 'hr.salary.view_rsu')),
    grsu: canViewSalaryGroup && (await userHasPermission(viewer?.id, viewer?.role?.slug, 'hr.salary.view_grsu')),
    su: canViewSalaryGroup && (await userHasPermission(viewer?.id, viewer?.role?.slug, 'hr.salary.view_su')),
  };

  const summaryTotals = {
    total_normal_hours: 0,
    total_overtime_hours: 0,
    total_gr_usd_nm: null,
    total_fm_usd: null,
    total_ru_uzs_nm: null,
    total_gr_uzs_nm: null,
    total_fm_uzs_nm: null,
    total_non_official_uzs: null,
    total_unofficial_usd: null,
  };

  summary.forEach((s) => {
    summaryTotals.total_normal_hours += Number(s.total_hours || 0);
    summaryTotals.total_overtime_hours += Number(s.overtime_hours || 0);
  });
  summaryTotals.total_normal_hours = Math.round(summaryTotals.total_normal_hours * 100) / 100;
  summaryTotals.total_overtime_hours = Math.round(summaryTotals.total_overtime_hours * 100) / 100;

  const [monthLockRowsForPayroll] = await pool.query(
    'SELECT month_key, is_locked, payroll_usd_uzs_rate FROM attendance_month_locks WHERE month_key = :mk LIMIT 1',
    { mk }
  );
  const monthLockRow = monthLockRowsForPayroll[0] || null;
  const isLocked =
    monthLockRow &&
    (monthLockRow.is_locked === true ||
      monthLockRow.is_locked === 1 ||
      monthLockRow.is_locked === '1' ||
      Number(monthLockRow.is_locked) === 1);
  const [payrollFxSettingRows] = await pool.query(
    `SELECT setting_value FROM hr_settings WHERE setting_key = 'payroll_usd_uzs_rate' LIMIT 1`
  );
  const payrollFxMiniMap = { payroll_usd_uzs_rate: payrollFxSettingRows[0]?.setting_value };
  const monthFxResolvedGlobal = resolveMonthPayrollUsdUzsRate(monthLockRow, payrollFxMiniMap);
  let payrollUsdUzsMeta = {
    effectiveRate: monthFxResolvedGlobal.rate,
    source: monthFxResolvedGlobal.source,
    monthStoredRate: monthLockRow?.payroll_usd_uzs_rate ?? null,
  };
  let monthPayrollRate = monthFxResolvedGlobal.rate;
  /** @type {{ missingHistoryEmployeeIds: number[], month_key: string, month_end_iso: string|null, past_month: boolean }|null} */
  let compensation_debug = null;

  if (canViewSalaryGroup && summary.length) {
    const empIds = summary.map((x) => Number(x.employee_id)).filter((x) => Number.isFinite(x) && x > 0);
    const monthEndIso = monthKeyToLastDayIso(mk);
    /** @type {Map<number, object>} employee_id → maaş satırı (employee_compensation_history veya employees) */
    const salaryByEmp = new Map();
    const historyMatchedEmployeeIds = new Set();

    if (empIds.length && monthEndIso) {
      const ph = empIds.map(() => '?').join(',');
      try {
        const [historyRows] = await pool.query(
          `SELECT h.employee_id,
                  h.salary_currency, h.salary_amount, h.official_salary_amount, h.unofficial_salary_amount,
                  h.official_salary_currency, h.official_salary_fx_rate
           FROM employee_compensation_history h
           INNER JOIN (
             SELECT employee_id, MAX(effective_from) AS mx
             FROM employee_compensation_history
             WHERE employee_id IN (${ph})
               AND effective_from <= ?
               AND (effective_to IS NULL OR effective_to >= ?)
             GROUP BY employee_id
           ) t ON t.employee_id = h.employee_id AND t.mx = h.effective_from`,
          [...empIds, monthEndIso, monthEndIso]
        );
        for (const r of historyRows || []) {
          const hid = Number(r.employee_id);
          salaryByEmp.set(hid, r);
          historyMatchedEmployeeIds.add(hid);
        }
      } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
          // TODO Faz 3B: employee_compensation_history yoksa migrasyon; şimdilik employees cache kullanılıyor.
          console.warn(`[PAYROLL_HISTORY_TABLE_MISSING] month=${mk} — tum personel employees fallback`);
        } else {
          throw e;
        }
      }
    }

    const missingHistoryEmployeeIds = empIds.filter((id) => !historyMatchedEmployeeIds.has(id));
    if (missingHistoryEmployeeIds.length) {
      const past = isPastMonthKey(mk);
      for (const fid of missingHistoryEmployeeIds) {
        if (past) {
          console.warn(`[PAYROLL_HISTORY_FALLBACK] employee_id=${fid} month=${mk}`);
        } else {
          console.warn(
            `[PAYROLL_HISTORY_FALLBACK] employee_id=${fid} month=${mk} scope=current_or_future reason=no_history_row_at_month_end`
          );
        }
      }
    }

    if (missingHistoryEmployeeIds.length) {
      // TODO Faz 3B: history backfill tamamlaninca fallback kaldirilabilir veya yalnizca acil mod.
      const [salaryRows] = await pool.query(
        `SELECT id, salary_currency, salary_amount, official_salary_amount, unofficial_salary_amount,
                official_salary_currency, official_salary_fx_rate
         FROM employees
         WHERE id IN (${missingHistoryEmployeeIds.map(() => '?').join(',')})`,
        missingHistoryEmployeeIds
      );
      for (const r of salaryRows || []) {
        salaryByEmp.set(Number(r.id), r);
      }
    }

    compensation_debug = {
      missingHistoryEmployeeIds: [...missingHistoryEmployeeIds],
      month_key: mk,
      month_end_iso: monthEndIso,
      past_month: isPastMonthKey(mk),
    };
    const [settingRows] = await pool.query(
      `SELECT setting_key, setting_value
       FROM hr_settings
       WHERE setting_key IN ('monthly_work_days', 'monthly_work_hours', 'standard_start_time', 'standard_end_time', 'daily_start_time', 'daily_end_time',
                             'break_1_start_time', 'break_1_end_time', 'break_2_start_time', 'break_2_end_time', 'lunch_start_time', 'lunch_end_time',
                             'time_deduction_hours', 'payroll_usd_uzs_rate')`
    );
    const settingMap = {};
    settingRows.forEach((r) => {
      settingMap[String(r.setting_key)] = r.setting_value;
    });
    const monthFxResolvedInner = resolveMonthPayrollUsdUzsRate(monthLockRow, settingMap);
    monthPayrollRate = monthFxResolvedInner.rate;
    payrollUsdUzsMeta = {
      effectiveRate: monthFxResolvedInner.rate,
      source: monthFxResolvedInner.source,
      monthStoredRate: monthLockRow?.payroll_usd_uzs_rate ?? null,
    };
    const monthlyWorkDays = Number(settingMap.monthly_work_days || 0);
    const monthlyWorkHours = Number(settingMap.monthly_work_hours || 0);
    const standardDailyHours =
      computeStandardDailyHours(settingMap) ||
      (monthlyWorkDays > 0 ? Math.round((monthlyWorkHours / monthlyWorkDays) * 100) / 100 : null);
    const canPropNormalPay = Number.isFinite(monthlyWorkHours) && monthlyWorkHours > 0;

    summaryTotals.total_gr_usd_nm = 0;
    summaryTotals.total_fm_usd = 0;
    summaryTotals.total_ru_uzs_nm = 0;
    summaryTotals.total_gr_uzs_nm = 0;
    summaryTotals.total_fm_uzs_nm = 0;
    summaryTotals.total_non_official_uzs = 0;
    summaryTotals.total_unofficial_usd = 0;

    summary.forEach((s) => {
      const eidSum = Number(s.employee_id);
      const sal = salaryByEmp.get(eidSum) || {};
      s.compensation_source = historyMatchedEmployeeIds.has(eidSum) ? 'history' : 'employees_fallback';
      // TODO Faz 3B+: Ay içinde birden fazla maaş versiyonu olursa gün bazlı prorate veya kilit anı snapshot gerekebilir.
      // Faz 3A: ay sonu (month_key son günü) itibarıyla geçerli tek history satırı; yoksa employees cache.
      // Tek hesap motoru: normalize edilmiş 6 alan üzerinden raporlama yapılır.
      const breakdown = breakdownFromEmployeeRowForPayroll(sal, monthPayrollRate) || {};
      const officialSalaryUzs = breakdown.official_salary_uzs;
      const unofficialSalaryUzs = breakdown.unofficial_salary_uzs;
      const unofficialSalaryUsd = breakdown.unofficial_salary_usd;

      const rguUzs =
        officialSalaryUzs != null && monthlyWorkDays > 0 ? divSafe6(officialSalaryUzs, monthlyWorkDays) : null;
      const grguUzs =
        unofficialSalaryUzs != null && monthlyWorkDays > 0 ? divSafe6(unofficialSalaryUzs, monthlyWorkDays) : null;
      const guUsd =
        unofficialSalaryUsd != null && monthlyWorkDays > 0 ? divSafe6(unofficialSalaryUsd, monthlyWorkDays) : null;

      const rsu =
        salaryPerms.rsu && rguUzs != null && standardDailyHours != null && standardDailyHours > 0
          ? divSafe6(rguUzs, standardDailyHours)
          : null;
      const grsu =
        salaryPerms.grsu && grguUzs != null && standardDailyHours != null && standardDailyHours > 0
          ? divSafe6(grguUzs, standardDailyHours)
          : null;
      const su =
        salaryPerms.su && guUsd != null && standardDailyHours != null && standardDailyHours > 0
          ? divSafe6(guUsd, standardDailyHours)
          : null;

      const totalNormalHours = Number(s.total_hours || 0);
      const totalOvertimeHours = Number(s.overtime_hours || 0);

      s.total_normal_hours = totalNormalHours;
      s.total_overtime_hours = totalOvertimeHours;
      s.rsu = rsu;
      s.grsu = grsu;
      s.su = su;
      s.ru_uzs_nm =
        !salaryPerms.rsu || !canPropNormalPay || officialSalaryUzs == null
          ? null
          : monthlyNormalPayProportional(officialSalaryUzs, totalNormalHours, monthlyWorkHours);
      s.gr_uzs_nm =
        !salaryPerms.grsu || !canPropNormalPay || unofficialSalaryUzs == null
          ? null
          : monthlyNormalPayProportional(unofficialSalaryUzs, totalNormalHours, monthlyWorkHours);
      s.gr_usd_nm =
        !salaryPerms.su || !canPropNormalPay || unofficialSalaryUsd == null
          ? null
          : monthlyNormalPayProportional(unofficialSalaryUsd, totalNormalHours, monthlyWorkHours);
      // FM UZS: resmi ve/veya gayri resmi saatlik oranların toplamı (yalnızca biri tanımlıysa diğeri 0 kabul edilir).
      // Eski hata: rsu veya grsu tek başına null iken tüm fm_uzs null dönüyordu; sadece resmi veya sadece gayri resmi maaşlı personelde tahakkuk kayboluyordu.
      const rsuN = rsu != null && Number.isFinite(Number(rsu)) ? Number(rsu) : 0;
      const grsuN = grsu != null && Number.isFinite(Number(grsu)) ? Number(grsu) : 0;
      const otRateUzs = rsuN + grsuN;
      s.fm_uzs =
        totalOvertimeHours > 0 && otRateUzs > 0 ? mulSafe6(totalOvertimeHours, otRateUzs) : null;
      s.fm_usd = su == null ? null : mulSafe6(totalOvertimeHours, su);

      // Normalize alanları satıra da ek olarak verelim (tüketici normalize'e geçince kullansın diye).
      s.total_salary_uzs = breakdown.total_salary_uzs;
      s.total_salary_usd = breakdown.total_salary_usd;
      s.official_salary_uzs = breakdown.official_salary_uzs;
      s.official_salary_usd = breakdown.official_salary_usd;
      s.unofficial_salary_uzs = breakdown.unofficial_salary_uzs;
      s.unofficial_salary_usd = breakdown.unofficial_salary_usd;

      if (s.gr_usd_nm != null) summaryTotals.total_gr_usd_nm += Number(s.gr_usd_nm || 0);
      if (s.fm_usd != null) summaryTotals.total_fm_usd += Number(s.fm_usd || 0);
      if (s.ru_uzs_nm != null) summaryTotals.total_ru_uzs_nm += Number(s.ru_uzs_nm || 0);
      if (s.gr_uzs_nm != null) summaryTotals.total_gr_uzs_nm += Number(s.gr_uzs_nm || 0);
      if (s.fm_uzs != null) summaryTotals.total_fm_uzs_nm += Number(s.fm_uzs || 0);
      if (s.gr_uzs_nm != null) summaryTotals.total_non_official_uzs += Number(s.gr_uzs_nm || 0);
      if (s.fm_uzs != null) summaryTotals.total_non_official_uzs += Number(s.fm_uzs || 0);
    });

    summaryTotals.total_gr_usd_nm = roundInternal6(summaryTotals.total_gr_usd_nm);
    summaryTotals.total_fm_usd = roundInternal6(summaryTotals.total_fm_usd);
    summaryTotals.total_ru_uzs_nm = roundInternal6(summaryTotals.total_ru_uzs_nm);
    summaryTotals.total_gr_uzs_nm = roundInternal6(summaryTotals.total_gr_uzs_nm);
    summaryTotals.total_fm_uzs_nm = roundInternal6(summaryTotals.total_fm_uzs_nm);
    summaryTotals.total_non_official_uzs = roundInternal6(summaryTotals.total_non_official_uzs);
    summaryTotals.total_unofficial_usd = roundInternal6(
      (summaryTotals.total_gr_usd_nm || 0) + (summaryTotals.total_fm_usd || 0)
    );
  } else {
    summary.forEach((s) => {
      s.total_normal_hours = Number(s.total_hours || 0);
      s.total_overtime_hours = Number(s.overtime_hours || 0);
      s.rsu = null;
      s.grsu = null;
      s.su = null;
      s.ru_uzs_nm = null;
      s.gr_uzs_nm = null;
      s.gr_usd_nm = null;
      s.fm_uzs = null;
      s.fm_usd = null;
    });
  }

  return {
    month: mk,
    rows,
    summary,
    summaryTotals,
    salaryVisibility: {
      group: canViewSalaryGroup,
      ...salaryPerms,
    },
    isLocked,
    payrollUsdUzs: payrollUsdUzsMeta,
    compensation_debug,
  };
}

async function listAttendanceLocks() {
  const [rows] = await pool.query(
    `SELECT l.id, l.month_key, l.is_locked, l.locked_at, l.unlocked_at, l.note, l.payroll_usd_uzs_rate,
            ul.username AS locked_by_username, uu.username AS unlocked_by_username
     FROM attendance_month_locks l
     LEFT JOIN users ul ON ul.id = l.locked_by
     LEFT JOIN users uu ON uu.id = l.unlocked_by
     ORDER BY l.month_key DESC`
  );
  return { locks: rows };
}

async function listAttendanceProjects() {
  const [rows] = await pool.query(
    `SELECT id, project_code, name
     FROM projects
     WHERE status = 'active'
     ORDER BY project_code ASC, id ASC`
  );
  return { projects: rows };
}

async function lockAttendanceMonth({ month, note, payroll_usd_uzs_rate } = {}, actorId) {
  const mk = normalizeMonthKey(month);
  if (!mk) return err('Ay gecersiz', 'api.hr.month_required');
  const fx = parseFxRate(payroll_usd_uzs_rate);
  if (fx == null) {
    return err('Puantaj kilidi için dönem USD/UZS kuru zorunlu (1 USD = … UZS)', 'api.hr.payroll_usd_uzs_rate_required');
  }
  await pool.query(
    `INSERT INTO attendance_month_locks (month_key, is_locked, locked_at, locked_by, unlocked_at, unlocked_by, note, payroll_usd_uzs_rate)
     VALUES (:month_key, 1, NOW(), :actor_id, NULL, NULL, :note, :fx)
     ON DUPLICATE KEY UPDATE is_locked = 1, locked_at = NOW(), locked_by = :actor_id, unlocked_at = NULL, unlocked_by = NULL, note = :note, payroll_usd_uzs_rate = :fx`,
    { month_key: mk, actor_id: actorId || null, note: optionalNoteUpperTr(note) || null, fx }
  );
  return { ok: true, month: mk, isLocked: true, payroll_usd_uzs_rate: fx };
}

async function unlockAttendanceMonth({ month, note } = {}, actorId) {
  const mk = normalizeMonthKey(month);
  if (!mk) return err('Ay gecersiz', 'api.hr.month_required');
  await pool.query(
    `INSERT INTO attendance_month_locks (month_key, is_locked, locked_at, locked_by, unlocked_at, unlocked_by, note)
     VALUES (:month_key, 0, NOW(), NULL, NOW(), :actor_id, :note)
     ON DUPLICATE KEY UPDATE is_locked = 0, unlocked_at = NOW(), unlocked_by = :actor_id, note = :note`,
    { month_key: mk, actor_id: actorId || null, note: optionalNoteUpperTr(note) || null }
  );
  return { ok: true, month: mk, isLocked: false };
}

async function getHrSettingsBundle({ includeInactive = false } = {}) {
  const [settingRows] = await pool.query(
    'SELECT setting_key, setting_value FROM hr_settings WHERE setting_key IS NOT NULL ORDER BY setting_key ASC'
  );
  const settings = {};
  settingRows.forEach((r) => {
    settings[String(r.setting_key)] = r.setting_value;
  });
  const [workTypes] = await pool.query(
    `SELECT id, code, name, is_active, sort_order
     FROM hr_work_types
     ${includeInactive ? '' : 'WHERE is_active = 1'}
     ORDER BY sort_order ASC, id ASC`
  );
  const hasMultiplier = await hasColumnCached('hr_work_statuses', 'multiplier');
  const [workStatuses] = await pool.query(
    `SELECT id, code, name, is_active, sort_order${hasMultiplier ? ', multiplier' : ', 1 AS multiplier'}
     FROM hr_work_statuses
     ${includeInactive ? '' : 'WHERE is_active = 1'}
     ORDER BY sort_order ASC, id ASC`
  );
  return { settings, workTypes, workStatuses };
}

async function saveHrSettingsBundle(input = {}) {
  const keys = Object.keys(input || {});
  if (!keys.length) return err('Ayar alanlari gerekli', 'api.hr.settings_required');
  for (const key of keys) {
    if (!HR_SETTING_KEYS.has(key)) return err('Gecersiz ayar anahtari', 'api.hr.settings_key_invalid');
    const normalized = validateHrSettingValue(key, input[key]);
    if (normalized == null) return err('Ayar degeri gecersiz', 'api.hr.settings_value_invalid');
    await pool.query(
      `INSERT INTO hr_settings (setting_key, setting_value)
       VALUES (:setting_key, :setting_value)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      { setting_key: key, setting_value: normalized }
    );
  }
  return { ok: true };
}

async function listWorkTypes({ includeInactive = false } = {}) {
  const [rows] = await pool.query(
    `SELECT id, code, name, is_active, sort_order
     FROM hr_work_types
     ${includeInactive ? '' : 'WHERE is_active = 1'}
     ORDER BY sort_order ASC, id ASC`
  );
  return { workTypes: rows };
}

async function createWorkType(input = {}) {
  const code = normalizeCode(input?.code);
  const name = toUpperTr(input?.name);
  const sortOrder = parseIntSafe(input?.sort_order) ?? 100;
  if (!code) return err('Is tipi kodu gerekli', 'api.hr.work_type_code_required');
  if (!name) return err('Is tipi adi gerekli', 'api.hr.work_type_name_required');
  const [r] = await pool.query(
    'INSERT INTO hr_work_types (code, name, is_active, sort_order) VALUES (:code, :name, :is_active, :sort_order)',
    { code, name, is_active: input?.is_active === 0 ? 0 : 1, sort_order: sortOrder }
  );
  return { id: r.insertId };
}

async function updateWorkType(id, input = {}) {
  const itemId = parseId(id);
  if (!itemId) return err('Gecersiz is tipi', 'api.hr.work_type_invalid');
  const fields = [];
  const p = { id: itemId };
  if (input?.code !== undefined) {
    const code = normalizeCode(input.code);
    if (!code) return err('Is tipi kodu gerekli', 'api.hr.work_type_code_required');
    fields.push('code = :code');
    p.code = code;
  }
  if (input?.name !== undefined) {
    const name = toUpperTr(input.name);
    if (!name) return err('Is tipi adi gerekli', 'api.hr.work_type_name_required');
    fields.push('name = :name');
    p.name = name;
  }
  if (input?.is_active !== undefined) {
    fields.push('is_active = :is_active');
    p.is_active = input.is_active ? 1 : 0;
  }
  if (input?.sort_order !== undefined) {
    const sortOrder = parseIntSafe(input.sort_order);
    if (sortOrder == null) return err('Sira degeri gecersiz', 'api.hr.sort_order_invalid');
    fields.push('sort_order = :sort_order');
    p.sort_order = sortOrder;
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  const [r] = await pool.query(`UPDATE hr_work_types SET ${fields.join(', ')} WHERE id = :id`, p);
  if (!r.affectedRows) return err('Is tipi bulunamadi', 'api.hr.work_type_not_found');
  return { ok: true };
}

async function deleteWorkType(id) {
  const itemId = parseId(id);
  if (!itemId) return err('Gecersiz is tipi', 'api.hr.work_type_invalid');
  const [rows] = await pool.query('SELECT code FROM hr_work_types WHERE id = :id LIMIT 1', { id: itemId });
  if (!rows.length) return err('Is tipi bulunamadi', 'api.hr.work_type_not_found');
  const code = String(rows[0].code || '').trim().toLowerCase();
  const [usage] = await pool.query('SELECT COUNT(*) AS c FROM employee_attendance WHERE work_type = :code', { code });
  if (Number(usage[0]?.c || 0) > 0) {
    return err('Kullanimda olan is tipi silinemez', 'api.hr.work_type_in_use');
  }
  await pool.query('DELETE FROM hr_work_types WHERE id = :id', { id: itemId });
  return { ok: true };
}

async function listWorkStatuses({ includeInactive = false } = {}) {
  const hasMultiplier = await hasColumnCached('hr_work_statuses', 'multiplier');
  const [rows] = await pool.query(
    `SELECT id, code, name, is_active, sort_order${hasMultiplier ? ', multiplier' : ', 1 AS multiplier'}
     FROM hr_work_statuses
     ${includeInactive ? '' : 'WHERE is_active = 1'}
     ORDER BY sort_order ASC, id ASC`
  );
  return { workStatuses: rows };
}

async function createWorkStatus(input = {}) {
  const code = normalizeCode(input?.code);
  const name = toUpperTr(input?.name);
  const sortOrder = parseIntSafe(input?.sort_order) ?? 100;
  const hasMultiplier = await hasColumnCached('hr_work_statuses', 'multiplier');
  const multiplier = parseMultiplier(input?.multiplier);
  if (!code) return err('Çalışma durumu kodu gerekli', 'api.hr.work_status_code_required');
  if (!name) return err('Çalışma durumu adı gerekli', 'api.hr.work_status_name_required');
  if (hasMultiplier && multiplier == null && input?.multiplier !== undefined) {
    return err('Çarpan değeri geçersiz', 'api.hr.settings_value_invalid');
  }
  const [r] = await pool.query(
    `INSERT INTO hr_work_statuses (code, name, is_active, sort_order${hasMultiplier ? ', multiplier' : ''})
     VALUES (:code, :name, :is_active, :sort_order${hasMultiplier ? ', :multiplier' : ''})`,
    { code, name, is_active: input?.is_active === 0 ? 0 : 1, sort_order: sortOrder, multiplier: multiplier ?? 1 }
  );
  return { id: r.insertId };
}

async function updateWorkStatus(id, input = {}) {
  const itemId = parseId(id);
  if (!itemId) return err('Gecersiz calisma durumu', 'api.hr.work_status_invalid');
  const hasMultiplier = await hasColumnCached('hr_work_statuses', 'multiplier');
  const fields = [];
  const p = { id: itemId };
  if (input?.code !== undefined) {
    const code = normalizeCode(input.code);
    if (!code) return err('Çalışma durumu kodu gerekli', 'api.hr.work_status_code_required');
    fields.push('code = :code');
    p.code = code;
  }
  if (input?.name !== undefined) {
    const name = toUpperTr(input.name);
    if (!name) return err('Çalışma durumu adı gerekli', 'api.hr.work_status_name_required');
    fields.push('name = :name');
    p.name = name;
  }
  if (input?.is_active !== undefined) {
    fields.push('is_active = :is_active');
    p.is_active = input.is_active ? 1 : 0;
  }
  if (input?.sort_order !== undefined) {
    const sortOrder = parseIntSafe(input.sort_order);
    if (sortOrder == null) return err('Sira degeri gecersiz', 'api.hr.sort_order_invalid');
    fields.push('sort_order = :sort_order');
    p.sort_order = sortOrder;
  }
  if (hasMultiplier && input?.multiplier !== undefined) {
    const multiplier = parseMultiplier(input.multiplier);
    if (multiplier == null) return err('Çarpan değeri geçersiz', 'api.hr.settings_value_invalid');
    fields.push('multiplier = :multiplier');
    p.multiplier = multiplier;
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  const [r] = await pool.query(`UPDATE hr_work_statuses SET ${fields.join(', ')} WHERE id = :id`, p);
  if (!r.affectedRows) return err('Çalışma durumu bulunamadı', 'api.hr.work_status_not_found');
  return { ok: true };
}

async function deleteWorkStatus(id) {
  const itemId = parseId(id);
  if (!itemId) return err('Gecersiz calisma durumu', 'api.hr.work_status_invalid');
  const [rows] = await pool.query('SELECT code FROM hr_work_statuses WHERE id = :id LIMIT 1', { id: itemId });
  if (!rows.length) return err('Çalışma durumu bulunamadı', 'api.hr.work_status_not_found');
  const code = String(rows[0].code || '').trim().toLowerCase();
  const [usage] = await pool.query('SELECT COUNT(*) AS c FROM employee_attendance WHERE work_status = :code', { code });
  if (Number(usage[0]?.c || 0) > 0) {
    return err('Kullanimda olan durum silinemez', 'api.hr.work_status_in_use');
  }
  await pool.query('DELETE FROM hr_work_statuses WHERE id = :id', { id: itemId });
  return { ok: true };
}

const PAYROLL_DISPUTE_TYPES = new Set(['overtime', 'workday', 'deduction', 'other']);
const PAYROLL_DISPUTE_STATUSES = new Set(['open', 'approved', 'rejected', 'resolved']);

/**
 * Karttaki toplam aylık maaş (tek tutar) → USD bütçe: resmi/gayri resmi dağılım veya mesai yok.
 * Öncelik: breakdown.total_salary_usd; yoksa total_salary_uzs / dönem kuru; yoksa total_salary_amount + para birimi.
 */
function rosterBudgetMonthlySalaryUsd(bd, fxNum) {
  if (!bd || bd.isValid === false) return { usd: null, needFx: false, skip: true };
  const totalCurNorm = String(bd.total_salary_currency || '').trim().toUpperCase();
  if (totalCurNorm === 'USD') {
    if (bd.total_salary_usd != null && Number.isFinite(Number(bd.total_salary_usd))) {
      const u = Number(bd.total_salary_usd);
      if (u === 0) return { usd: null, needFx: false, skip: true };
      return { usd: u, needFx: false, skip: false };
    }
    const amtUsd = bd.total_salary_amount != null ? Number(bd.total_salary_amount) : NaN;
    if (Number.isFinite(amtUsd) && amtUsd !== 0) {
      return { usd: amtUsd, needFx: false, skip: false };
    }
    return { usd: null, needFx: false, skip: true };
  }
  if (bd.total_salary_usd != null && Number.isFinite(Number(bd.total_salary_usd))) {
    const u = Number(bd.total_salary_usd);
    if (u === 0) return { usd: null, needFx: false, skip: true };
    return { usd: u, needFx: false, skip: false };
  }
  if (bd.total_salary_uzs != null && Number.isFinite(Number(bd.total_salary_uzs))) {
    const uz = Number(bd.total_salary_uzs);
    if (uz === 0) return { usd: null, needFx: false, skip: true };
    if (fxNum == null || !Number.isFinite(Number(fxNum)) || Number(fxNum) <= 0) {
      return { usd: null, needFx: true, skip: false };
    }
    return { usd: uz / Number(fxNum), needFx: false, skip: false };
  }
  const cur = String(bd.total_salary_currency || '').trim().toUpperCase();
  const amt = bd.total_salary_amount != null ? Number(bd.total_salary_amount) : NaN;
  if (!Number.isFinite(amt) || amt === 0) return { usd: null, needFx: false, skip: true };
  if (cur === 'USD') return { usd: amt, needFx: false, skip: false };
  if (cur === 'UZS') {
    if (fxNum == null || !Number.isFinite(Number(fxNum)) || Number(fxNum) <= 0) {
      return { usd: null, needFx: true, skip: false };
    }
    return { usd: amt / Number(fxNum), needFx: false, skip: false };
  }
  return { usd: null, needFx: false, skip: true };
}

/**
 * Personel listesiyle aynı: employment_status=active, bordro filtreleri (proje puantaja özeldir, dahil edilmez).
 * Toplam: yalnızca karttaki aylık toplam maaşın USD karşılıkları toplamı (bütçe bilgisi; tahakkuk/mesai dahil değil).
 */
async function computePayrollActiveRosterStats(filters = {}, payrollFxEffective, viewer = null) {
  const canViewSalaryGroup = await userHasPermission(viewer?.id, viewer?.role?.slug, 'hr.salary.view_group');
  const rosterFilters = { ...(filters || {}) };
  delete rosterFilters.projectId;
  delete rosterFilters.month;

  const where = ["e.employment_status = 'active'"];
  const p = {};
  const rosterEid = parseId(rosterFilters.employeeId);
  if (rosterEid) {
    where.push('e.id = :roster_employee_id');
    p.roster_employee_id = rosterEid;
  }
  const fErr = applyEmployeeAttendanceFilters(rosterFilters, where, p);
  if (fErr) return fErr;

  const [cntRows] = await pool.query(`SELECT COUNT(*) AS c FROM employees e WHERE ${where.join(' AND ')}`, p);
  const headcount = Number(cntRows[0]?.c || 0);

  const fxNum =
    payrollFxEffective != null &&
    String(payrollFxEffective).trim() !== '' &&
    Number.isFinite(Number(payrollFxEffective)) &&
    Number(payrollFxEffective) > 0
      ? Number(payrollFxEffective)
      : null;

  let totalSalaryUsd = null;
  let missingFx = false;

  if (canViewSalaryGroup && headcount > 0) {
    const [rows] = await pool.query(
      `SELECT e.id, e.salary_currency, e.salary_amount, e.official_salary_amount, e.unofficial_salary_amount,
              e.official_salary_currency, e.official_salary_fx_rate
       FROM employees e
       WHERE ${where.join(' AND ')}`,
      p
    );
    let sum = 0;
    let any = false;
    for (const emp of rows) {
      const bd = breakdownFromEmployeeRowForPayroll(emp, fxNum);
      const r = rosterBudgetMonthlySalaryUsd(bd, fxNum);
      if (r.skip) continue;
      if (r.needFx) {
        missingFx = true;
        continue;
      }
      if (r.usd != null && Number.isFinite(r.usd)) {
        sum += r.usd;
        any = true;
      }
    }
    if (missingFx) {
      totalSalaryUsd = null;
    } else {
      totalSalaryUsd = any ? roundInternal6(sum) : null;
    }
  }

  return {
    headcount,
    total_salary_usd: canViewSalaryGroup ? totalSalaryUsd : null,
    missing_fx: !!(canViewSalaryGroup && missingFx),
  };
}

/**
 * Aylık puantaj özeti + departman + bordro itirazları (payroll_disputes tablosu).
 */
async function listPayrollSnapshot(filters = {}, viewer = null) {
  const out = await listMonthlyAttendance(filters, viewer);
  if (out.error) return out;
  const mk = out.month;
  let disputeRows = [];
  try {
    const [dr] = await pool.query(
      `SELECT d.id, d.period_month, d.employee_id, d.dispute_date, d.request_type, d.description,
              d.status, d.resolution_note, d.created_at, d.updated_at,
              d.created_by, d.updated_by,
              e.employee_no, e.first_name, e.last_name, e.full_name,
              COALESCE(NULLIF(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')), ' '), e.full_name) AS employee_name
       FROM payroll_disputes d
       INNER JOIN employees e ON e.id = d.employee_id
       WHERE d.period_month = :mk
       ORDER BY d.created_at DESC`,
      { mk }
    );
    disputeRows = dr;
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      disputeRows = [];
    } else {
      throw e;
    }
  }
  disputeRows.forEach((row) => {
    const mkSafe = String(row.period_month || '').replace(/[^0-9]/g, '');
    row.request_no = mkSafe ? `ITZ-${mkSafe}-${String(row.id).padStart(5, '0')}` : `ITZ-${String(row.id).padStart(5, '0')}`;
    row.employee_display = formatEmployeeLabel(row);
  });
  let openCount = 0;
  const openByEmp = new Map();
  disputeRows.forEach((d) => {
    if (String(d.status || '').toLowerCase() === 'open') {
      openCount += 1;
      const eid = Number(d.employee_id);
      openByEmp.set(eid, (openByEmp.get(eid) || 0) + 1);
    }
  });
  const empIds = out.summary.map((s) => Number(s.employee_id)).filter((x) => Number.isFinite(x) && x > 0);
  let deptByEmp = new Map();
  if (empIds.length) {
    const [drows] = await pool.query(
      `SELECT e.id AS employee_id, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE e.id IN (${empIds.map(() => '?').join(',')})`,
      empIds
    );
    deptByEmp = new Map(drows.map((r) => [Number(r.employee_id), r.department_name]));
  }
  out.summary.forEach((s) => {
    const eid = Number(s.employee_id);
    s.department_name = deptByEmp.get(eid) || null;
    s.payroll_open_disputes = openByEmp.get(eid) || 0;
  });
  out.payroll_disputes = disputeRows;
  out.payroll_open_dispute_count = openCount;

  const rosterStats = await computePayrollActiveRosterStats(filters, out.payrollUsdUzs?.effectiveRate, viewer);
  if (rosterStats && rosterStats.error) return rosterStats;
  out.active_roster = rosterStats || { headcount: 0, total_salary_usd: null, missing_fx: false };

  return out;
}

async function createPayrollDispute(body = {}, actorId = null) {
  const mk = normalizeMonthKey(body?.period_month);
  if (!mk) return err('Ay gecersiz', 'api.hr.month_required');
  const employeeId = parseId(body?.employee_id);
  if (!employeeId) return err('Personel secimi gecersiz', 'api.hr.payroll_dispute_employee_invalid');
  const requestTypeRaw = String(body?.request_type || 'other').trim().toLowerCase();
  const requestType = PAYROLL_DISPUTE_TYPES.has(requestTypeRaw) ? requestTypeRaw : 'other';
  const descriptionRaw = String(body?.description || '').trim();
  if (!descriptionRaw || descriptionRaw.length < 3) {
    return err('Aciklama en az 3 karakter olmalidir', 'api.hr.payroll_dispute_desc_short');
  }
  const description = toUpperTr(descriptionRaw);
  let disputeDate = null;
  if (body?.dispute_date != null && String(body.dispute_date).trim() !== '') {
    const d = String(body.dispute_date).slice(0, 10);
    disputeDate = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  }
  const [[emp]] = await pool.query(
    `SELECT id, employment_status FROM employees WHERE id = :id LIMIT 1`,
    { id: employeeId }
  );
  if (!emp) return err('Personel bulunamadi', 'api.hr.employee_not_found');
  if (String(emp.employment_status || '') === 'terminated') {
    return err('Isten cikmis personel icin itiraz acilamaz', 'api.hr.payroll_dispute_terminated');
  }
  try {
    const [insRes] = await pool.query(
      `INSERT INTO payroll_disputes (period_month, employee_id, dispute_date, request_type, description, status, created_by, updated_by)
       VALUES (:period_month, :employee_id, :dispute_date, :request_type, :description, 'open', :created_by, :updated_by)`,
      {
        period_month: mk,
        employee_id: employeeId,
        dispute_date: disputeDate,
        request_type: requestType,
        description,
        created_by: actorId || null,
        updated_by: actorId || null,
      }
    );
    const newId = Number(insRes && insRes.insertId) || null;
    return { ok: true, id: newId };
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return err('payroll_disputes tablosu yok; migrasyon calistirin', 'api.hr.payroll_disputes_table_missing');
    }
    throw e;
  }
}

async function updatePayrollDispute(id, body = {}, actorId = null) {
  const did = parseId(id);
  if (!did) return err('Kayit gecersiz', 'api.hr.payroll_dispute_invalid');
  const fields = [];
  const p = { id: did, updated_by: actorId || null };
  if (body?.status !== undefined) {
    const st = String(body.status || '').trim().toLowerCase();
    if (!PAYROLL_DISPUTE_STATUSES.has(st)) return err('Durum gecersiz', 'api.hr.payroll_dispute_status_invalid');
    fields.push('status = :status');
    p.status = st;
  }
  if (body?.resolution_note !== undefined) {
    const note = optionalNoteUpperTr(body.resolution_note);
    fields.push('resolution_note = :resolution_note');
    p.resolution_note = note;
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  fields.push('updated_by = :updated_by');
  try {
    const [r] = await pool.query(`UPDATE payroll_disputes SET ${fields.join(', ')} WHERE id = :id`, p);
    if (!r.affectedRows) return err('Kayit bulunamadi', 'api.hr.payroll_dispute_not_found');
    return { ok: true };
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return err('payroll_disputes tablosu yok; migrasyon calistirin', 'api.hr.payroll_disputes_table_missing');
    }
    throw e;
  }
}

// =============================================================================
//  EMPLOYEE COMPENSATION HISTORY (Faz 1 okuma + Faz 2A revizyon; Faz 3A listMonthlyAttendance ay sonu history)
// =============================================================================

/**
 * Personelin tüm maaş geçmişi satırları (en yeni effective_from üstte).
 * @param {number|string} employeeId
 * @returns {Promise<{ rows: object[] }|{ error: string, messageKey?: string }>}
 */
async function listCompensationHistory(employeeId) {
  const eid = parseId(employeeId);
  if (!eid) return err('Gecersiz personel', 'api.hr.employee_invalid');
  try {
    const [rows] = await pool.query(
      `SELECT id, employee_id, effective_from, effective_to, salary_currency, salary_amount,
              official_salary_amount, unofficial_salary_amount, official_salary_currency, official_salary_fx_rate,
              reason, created_by, created_at, updated_at
       FROM employee_compensation_history
       WHERE employee_id = :eid
       ORDER BY effective_from DESC, id DESC`,
      { eid }
    );
    return { rows: rows || [] };
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return err('Maaş geçmişi tablosu yok; migrasyon calistirin', 'api.hr.compensation_history_table_missing');
    }
    throw e;
  }
}

/**
 * Belirli bir tarihte geçerli tek compensation satırı (yoksa null).
 * @param {number|string} employeeId
 * @param {string|Date|null} [asOfDate] YYYY-MM-DD; boşsa CURDATE()
 * @returns {Promise<{ row: object|null }|{ error: string, messageKey?: string }>}
 */
async function getCurrentCompensation(employeeId, asOfDate) {
  const eid = parseId(employeeId);
  if (!eid) return err('Gecersiz personel', 'api.hr.employee_invalid');
  let asof = null;
  if (asOfDate != null && String(asOfDate).trim() !== '') {
    const s = String(asOfDate).trim().slice(0, 10);
    asof = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  if (!asof) {
    const [drows] = await pool.query('SELECT CURDATE() AS d');
    asof = String(drows[0].d).slice(0, 10);
  }
  try {
    const [rows] = await pool.query(
      `SELECT id, employee_id, effective_from, effective_to, salary_currency, salary_amount,
              official_salary_amount, unofficial_salary_amount, official_salary_currency, official_salary_fx_rate,
              reason, created_by, created_at, updated_at
       FROM employee_compensation_history
       WHERE employee_id = :eid
         AND effective_from <= :asof
         AND (effective_to IS NULL OR effective_to >= :asof)
       ORDER BY effective_from DESC
       LIMIT 1`,
      { eid, asof }
    );
    return { row: rows && rows[0] ? rows[0] : null };
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return err('Maaş geçmişi tablosu yok; migrasyon calistirin', 'api.hr.compensation_history_table_missing');
    }
    throw e;
  }
}

/**
 * Faz 3A debug: month_key için ay sonu itibarıyla hangi history satırı seçilir (listMonthlyAttendance ile aynı mantık).
 *
 * @param {number|string} employeeId
 * @param {string} monthKey YYYY-MM
 * @returns {Promise<{ employee_id: number, month_key: string, as_of: string, row: object|null }|{ error: string, messageKey?: string }>}
 */
async function getCompensationBandForMonth(employeeId, monthKey) {
  const mk = normalizeMonthKey(monthKey);
  const eid = parseId(employeeId);
  if (!eid) return err('Gecersiz personel', 'api.hr.employee_invalid');
  if (!mk) return err('Ay gecersiz', 'api.hr.month_required');
  const asOf = monthKeyToLastDayIso(mk);
  if (!asOf) return err('Ay gecersiz', 'api.hr.month_required');
  const out = await getCurrentCompensation(eid, asOf);
  if (out.error) return out;
  return { employee_id: eid, month_key: mk, as_of: asOf, row: out.row || null };
}

/**
 * Geçmiş tarihli effective_from, puantajı kilitli bir ay ile çakışıyorsa revizyon engellenir (bugünden önceki tarihler).
 * @returns {null|{ error: string, messageKey?: string }}
 */
async function compensationEffectiveMonthLockedIfSo(executor, effectiveFromStr) {
  const [[{ td }]] = await executor.query(`SELECT CURDATE() AS td`);
  const todayStr = String(td).slice(0, 10);
  if (effectiveFromStr >= todayStr) return null;

  const mk = effectiveFromStr.slice(0, 7);
  const [rows] = await executor.query(
    `SELECT is_locked FROM attendance_month_locks WHERE month_key = :mk LIMIT 1`,
    { mk }
  );
  const row = rows[0];
  if (row && (Number(row.is_locked) === 1 || row.is_locked === true || row.is_locked === '1')) {
    return err(
      'Gecmis tarihli baslangic, kilitli bir ay ile cakisiyor; revizyon reddedildi',
      'api.hr.compensation_revision_locked_month'
    );
  }
  return null;
}

/**
 * Yeni maaş revizyonu: history INSERT, önceki açık satırın effective_to kapanması, employees cache güncellemesi.
 * Puantaj özeti (listMonthlyAttendance) ay sonu history kullanır; employees yalnızca cache / fallback.
 *
 * @param {number|string} employeeId
 * @param {object} payload effective_from, salary_*, official_*, reason (zorunlu)
 * @param {number|null} actorUserId
 */
async function createCompensationRevision(employeeId, payload, actorUserId = null) {
  const eid = parseId(employeeId);
  if (!eid) return err('Gecersiz personel', 'api.hr.employee_invalid');

  const rawFrom = payload?.effective_from;
  if (rawFrom == null || String(rawFrom).trim() === '') {
    return err('Gecerlilik baslangici zorunlu', 'api.hr.compensation_revision_effective_required');
  }
  const effectiveFromStr = String(rawFrom).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFromStr)) {
    return err('Gecerlilik baslangici gecersiz (YYYY-MM-DD)', 'api.hr.compensation_revision_effective_invalid');
  }

  const reasonRaw = payload?.reason;
  if (reasonRaw == null || String(reasonRaw).trim() === '') {
    return err('Gerekce zorunlu', 'api.hr.compensation_revision_reason_required');
  }
  const reason = toUpperTr(String(reasonRaw).trim());
  if (!reason || String(reason).trim().length < 3) {
    return err('Gerekce en az 3 karakter olmali', 'api.hr.compensation_revision_reason_short');
  }
  if (String(reason).length > 500) {
    return err('Gerekce en fazla 500 karakter olabilir', 'api.hr.compensation_revision_reason_too_long');
  }

  const wageOut = derivePersistableWage({
    total_salary_amount: payload?.salary_amount,
    total_salary_currency: payload?.salary_currency || 'UZS',
    official_salary_amount: payload?.official_salary_amount,
    official_salary_currency: payload?.official_salary_currency,
    official_salary_fx_rate: payload?.official_salary_fx_rate,
  });
  if (wageOut.error) return wageOut;
  const w = wageOut.persist;
  if (payload?.unofficial_salary_amount !== undefined && String(payload.unofficial_salary_amount).trim() !== '') {
    const pUn = parseMoney2(payload.unofficial_salary_amount);
    if (pUn == null) {
      return err('Resmi olmayan maaş gecersiz', 'api.hr.compensation_revision_unofficial_invalid');
    }
    const diff = Math.abs(pUn - Number(w.unofficial_salary_amount));
    if (diff > 0.02) {
      return err(
        'Resmi olmayan maaş toplam/resmi/kur ile uyusmuyor',
        'api.hr.compensation_revision_unofficial_mismatch'
      );
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[emp]] = await conn.query(`SELECT id FROM employees WHERE id = :id LIMIT 1`, { id: eid });
    if (!emp) {
      await conn.rollback();
      return err('Personel bulunamadi', 'api.hr.employee_not_found');
    }

    const lockErr = await compensationEffectiveMonthLockedIfSo(conn, effectiveFromStr);
    if (lockErr) {
      await conn.rollback();
      return lockErr;
    }

    const [[dup]] = await conn.query(
      `SELECT id FROM employee_compensation_history WHERE employee_id = :eid AND effective_from = :ef LIMIT 1`,
      { eid, ef: effectiveFromStr }
    );
    if (dup && dup.id != null) {
      await conn.rollback();
      return err('Bu baslangic tarihinde zaten kayit var', 'api.hr.compensation_revision_duplicate_effective');
    }

    const [[mx]] = await conn.query(
      `SELECT MAX(effective_from) AS mx FROM employee_compensation_history WHERE employee_id = :eid`,
      { eid }
    );
    const maxD = mx && mx.mx != null ? String(mx.mx).slice(0, 10) : null;
    if (maxD && effectiveFromStr <= maxD) {
      await conn.rollback();
      return err(
        'Yeni revizyon baslangici, mevcut son kayittan sonraki bir tarih olmalidir',
        'api.hr.compensation_revision_effective_after_latest'
      );
    }

    await conn.query(
      `UPDATE employee_compensation_history
       SET effective_to = DATE_SUB(:newFrom, INTERVAL 1 DAY), updated_at = CURRENT_TIMESTAMP
       WHERE employee_id = :eid
         AND effective_to IS NULL
         AND effective_from < :newFrom`,
      { eid, newFrom: effectiveFromStr }
    );

    const actId =
      actorUserId != null && Number.isFinite(Number(actorUserId)) && Number(actorUserId) > 0
        ? Number(actorUserId)
        : null;

    await conn.query(
      `INSERT INTO employee_compensation_history (
         employee_id, effective_from, effective_to,
         salary_currency, salary_amount, official_salary_amount, unofficial_salary_amount,
         official_salary_currency, official_salary_fx_rate,
         reason, created_by
       ) VALUES (
         :eid, :ef, NULL,
         :sc, :sa, :osa, :usa,
         :osc, :osfx,
         :reason, :created_by
       )`,
      {
        eid,
        ef: effectiveFromStr,
        sc: w.salary_currency,
        sa: w.salary_amount,
        osa: w.official_salary_amount,
        usa: w.unofficial_salary_amount,
        osc: w.official_salary_currency,
        osfx: w.official_salary_fx_rate,
        reason,
        created_by: actId,
      }
    );

    await conn.query(
      `UPDATE employees SET
         salary_currency = :sc,
         salary_amount = :sa,
         official_salary_amount = :osa,
         unofficial_salary_amount = :usa,
         official_salary_currency = :osc,
         official_salary_fx_rate = :osfx,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = :eid`,
      {
        eid,
        sc: w.salary_currency,
        sa: w.salary_amount,
        osa: w.official_salary_amount,
        usa: w.unofficial_salary_amount,
        osc: w.official_salary_currency,
        osfx: w.official_salary_fx_rate,
      }
    );

    const [[openRow]] = await conn.query(
      `SELECT COUNT(*) AS c FROM employee_compensation_history WHERE employee_id = :eid AND effective_to IS NULL`,
      { eid }
    );
    const openN = Number(openRow && openRow.c) || 0;
    if (openN > 1) {
      console.warn(
        `[COMPENSATION_HISTORY_MULTI_OPEN] employee_id=${eid} effective_to_null_rows=${openN} after_revision_effective_from=${effectiveFromStr}`
      );
      // TODO Faz 3B: veri onarımı / audit; tek açık uç (effective_to IS NULL) olmalı
    }

    await conn.commit();
    return { ok: true, employee_id: eid, effective_from: effectiveFromStr };
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') {
      return err('Bu baslangic tarihinde zaten kayit var', 'api.hr.compensation_revision_duplicate_effective');
    }
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return err('Maaş geçmişi tablosu yok; migrasyon calistirin', 'api.hr.compensation_history_table_missing');
    }
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  // Tek maaş hesap motoru (controller / diğer servisler bunu tüketir).
  computeWageBreakdown,
  validateWagePayload,
  derivePersistableWage,
  breakdownFromEmployeeRow,
  getScope,
  listDepartments,
  createDepartment,
  updateDepartment,
  listPositions,
  createPosition,
  updatePosition,
  listEmployees,
  listCompensationEmployees,
  createEmployee,
  getEmployeeById,
  getCurrentCompensation,
  getCompensationBandForMonth,
  listCompensationHistory,
  createCompensationRevision,
  updateEmployee,
  updateEmployeePhoto,
  listAssignableUsers,
  listAttendance,
  createAttendance,
  updateAttendance,
  updateMonthlyAttendanceRow,
  listDailyAttendance,
  summarizeDailyAttendance,
  saveDailyAttendanceBulk,
  listMonthlyAttendance,
  listAttendanceLocks,
  listAttendanceProjects,
  lockAttendanceMonth,
  unlockAttendanceMonth,
  getHrSettingsBundle,
  saveHrSettingsBundle,
  listWorkTypes,
  createWorkType,
  updateWorkType,
  deleteWorkType,
  listWorkStatuses,
  createWorkStatus,
  updateWorkStatus,
  deleteWorkStatus,
  listPayrollSnapshot,
  createPayrollDispute,
  updatePayrollDispute,
};
