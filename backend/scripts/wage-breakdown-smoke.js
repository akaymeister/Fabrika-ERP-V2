/**
 * Quick smoke test: computeWageBreakdown 8 senaryosu.
 * Çalıştırma: node backend/scripts/wage-breakdown-smoke.js
 */
const { computeWageBreakdown } = require('../services/hrService');

function fmt(b) {
  return JSON.stringify(
    {
      ok: b.isValid,
      err: (b.errors || []).map((e) => e.code).join('|') || null,
      unofficial: b.unofficial_salary_amount,
      unofficial_currency: b.unofficial_salary_currency,
      total_uzs: b.total_salary_uzs,
      total_usd: b.total_salary_usd,
      official_uzs: b.official_salary_uzs,
      official_usd: b.official_salary_usd,
      unof_uzs: b.unofficial_salary_uzs,
      unof_usd: b.unofficial_salary_usd,
      fx_used: b.fx_used,
    },
    null,
    2
  );
}

const cases = [
  {
    name: '1. USD + USD (kur 1)',
    in: {
      total_salary_amount: 5000,
      total_salary_currency: 'USD',
      official_salary_amount: 1500,
      official_salary_currency: 'USD',
      official_salary_fx_rate: 1,
    },
  },
  {
    name: '2. UZS + UZS (kur 1)',
    in: {
      total_salary_amount: 50_000_000,
      total_salary_currency: 'UZS',
      official_salary_amount: 12_500_000,
      official_salary_currency: 'UZS',
      official_salary_fx_rate: 1,
    },
  },
  {
    name: '3. USD + UZS (kur 12500)',
    in: {
      total_salary_amount: 5000,
      total_salary_currency: 'USD',
      official_salary_amount: 12_500_000,
      official_salary_currency: 'UZS',
      official_salary_fx_rate: 12500,
    },
  },
  {
    name: '4. UZS + USD (kur 12500)',
    in: {
      total_salary_amount: 50_000_000,
      total_salary_currency: 'UZS',
      official_salary_amount: 1500,
      official_salary_currency: 'USD',
      official_salary_fx_rate: 12500,
    },
  },
  {
    name: '5. Farklı currency + kur boş -> hata',
    in: {
      total_salary_amount: 5000,
      total_salary_currency: 'USD',
      official_salary_amount: 12_500_000,
      official_salary_currency: 'UZS',
      official_salary_fx_rate: '',
    },
  },
  {
    name: '6. Farklı currency + kur 0 -> hata',
    in: {
      total_salary_amount: 5000,
      total_salary_currency: 'USD',
      official_salary_amount: 12_500_000,
      official_salary_currency: 'UZS',
      official_salary_fx_rate: 0,
    },
  },
  {
    name: '7. Resmi maaş kura göre toplamı aşıyor -> negatif unofficial',
    in: {
      total_salary_amount: 1000,
      total_salary_currency: 'USD',
      official_salary_amount: 50_000_000,
      official_salary_currency: 'UZS',
      official_salary_fx_rate: 12500,
    },
  },
  {
    name: '8. Eski kayıt (USD+USD), official_currency null gelirse fallback',
    in: {
      total_salary_amount: 4000,
      total_salary_currency: 'USD',
      official_salary_amount: 1000,
      official_salary_currency: null,
      official_salary_fx_rate: null,
    },
  },
];

let allPass = true;
for (const c of cases) {
  const b = computeWageBreakdown(c.in);
  console.log('=====================================');
  console.log(c.name);
  console.log(fmt(b));

  // Beklentiler
  if (c.name.startsWith('1.')) {
    if (!b.isValid || b.unofficial_salary_amount !== 3500) { allPass = false; console.log('FAIL'); }
    if (b.total_salary_usd !== 5000 || b.total_salary_uzs !== null) { allPass = false; console.log('FAIL norm'); }
  }
  if (c.name.startsWith('2.')) {
    if (!b.isValid || b.unofficial_salary_amount !== 37_500_000) { allPass = false; console.log('FAIL'); }
    if (b.total_salary_uzs !== 50_000_000 || b.total_salary_usd !== null) { allPass = false; console.log('FAIL norm'); }
  }
  if (c.name.startsWith('3.')) {
    // unofficial USD = 5000 - 12_500_000/12500 = 5000 - 1000 = 4000
    if (!b.isValid || b.unofficial_salary_amount !== 4000) { allPass = false; console.log('FAIL'); }
    if (b.total_salary_usd !== 5000 || b.total_salary_uzs !== 62_500_000) { allPass = false; console.log('FAIL t_norm'); }
    if (b.official_salary_uzs !== 12_500_000 || b.official_salary_usd !== 1000) { allPass = false; console.log('FAIL o_norm'); }
  }
  if (c.name.startsWith('4.')) {
    // unofficial UZS = 50_000_000 - 1500*12500 = 50_000_000 - 18_750_000 = 31_250_000
    if (!b.isValid || b.unofficial_salary_amount !== 31_250_000) { allPass = false; console.log('FAIL'); }
  }
  if (c.name.startsWith('5.')) {
    if (b.isValid || (b.errors[0] || {}).code !== 'salary_fx_required') { allPass = false; console.log('FAIL'); }
  }
  if (c.name.startsWith('6.')) {
    if (b.isValid || (b.errors[0] || {}).code !== 'salary_fx_invalid') { allPass = false; console.log('FAIL'); }
  }
  if (c.name.startsWith('7.')) {
    // unofficial USD = 1000 - 50_000_000/12500 = 1000 - 4000 = -3000 -> negatif
    if (b.isValid || !b.errors.some((e) => e.code === 'salary_unofficial_negative')) {
      allPass = false; console.log('FAIL');
    }
  }
  if (c.name.startsWith('8.')) {
    if (!b.isValid || b.unofficial_salary_amount !== 3000) { allPass = false; console.log('FAIL'); }
  }
}
console.log('=====================================');
console.log(allPass ? 'TÜM SENARYOLAR GEÇTİ ✓' : 'EN AZ BİR SENARYO BAŞARISIZ ✗');
process.exit(allPass ? 0 : 1);
