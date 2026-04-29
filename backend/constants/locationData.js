const { toUpperTr } = require('../utils/textNormalize');

/** @type {string[]} */
const TR_PROVINCES_RAW = [
  'Adana',
  'Adıyaman',
  'Afyonkarahisar',
  'Ağrı',
  'Amasya',
  'Ankara',
  'Antalya',
  'Artvin',
  'Aydın',
  'Balıkesir',
  'Bilecik',
  'Bingöl',
  'Bitlis',
  'Bolu',
  'Burdur',
  'Bursa',
  'Çanakkale',
  'Çankırı',
  'Çorum',
  'Denizli',
  'Diyarbakır',
  'Edirne',
  'Elazığ',
  'Erzincan',
  'Erzurum',
  'Eskişehir',
  'Gaziantep',
  'Giresun',
  'Gümüşhane',
  'Hakkâri',
  'Hatay',
  'Isparta',
  'Mersin',
  'İstanbul',
  'İzmir',
  'Kars',
  'Kastamonu',
  'Kayseri',
  'Kırklareli',
  'Kırşehir',
  'Kocaeli',
  'Konya',
  'Kütahya',
  'Malatya',
  'Manisa',
  'Kahramanmaraş',
  'Mardin',
  'Muğla',
  'Muş',
  'Nevşehir',
  'Niğde',
  'Ordu',
  'Rize',
  'Sakarya',
  'Samsun',
  'Siirt',
  'Sinop',
  'Sivas',
  'Tekirdağ',
  'Tokat',
  'Trabzon',
  'Tunceli',
  'Şanlıurfa',
  'Uşak',
  'Van',
  'Yozgat',
  'Zonguldak',
  'Aksaray',
  'Bayburt',
  'Karaman',
  'Kırıkkale',
  'Batman',
  'Şırnak',
  'Bartın',
  'Ardahan',
  'Iğdır',
  'Yalova',
  'Karabük',
  'Kilis',
  'Osmaniye',
  'Düzce',
];

/** Özbekistan: 12 viloyat + Karakalpakistan + Taşkent şehri */
const UZ_REGIONS_RAW = [
  'Andican ili',
  'Buhara ili',
  'Fergana ili',
  'Cizzah ili',
  'Kashkadar ili',
  'Navoi ili',
  'Namangan ili',
  'Semerkand ili',
  'Surhanderya ili',
  'Sirderya ili',
  'Taşkent ili',
  'Harezm ili',
  'Karakalpakistan',
  'Taşkent şehri',
];

const TR_PROVINCE_SET = new Set(TR_PROVINCES_RAW.map((s) => toUpperTr(s)));
const UZ_REGION_SET = new Set(UZ_REGIONS_RAW.map((s) => toUpperTr(s)));

function normalizeCountryCode(v) {
  const s = toUpperTr(v);
  if (!s) return null;
  if (s === 'TR' || s === 'TÜRKİYE' || s === 'TURKEY') return 'TR';
  if (s === 'UZ' || s === 'ÖZBEKİSTAN' || s === 'UZBEKISTAN') return 'UZ';
  return null;
}

function isValidRegionForCountry(countryCode, regionRaw) {
  const cc = normalizeCountryCode(countryCode);
  if (!cc) return false;
  const r = toUpperTr(regionRaw);
  if (!r) return false;
  if (cc === 'TR') return TR_PROVINCE_SET.has(r);
  if (cc === 'UZ') return UZ_REGION_SET.has(r);
  return false;
}

module.exports = {
  TR_PROVINCES: TR_PROVINCES_RAW.map((s) => toUpperTr(s)),
  UZ_REGIONS: UZ_REGIONS_RAW.map((s) => toUpperTr(s)),
  TR_PROVINCES_RAW,
  UZ_REGIONS_RAW,
  normalizeCountryCode,
  isValidRegionForCountry,
};
