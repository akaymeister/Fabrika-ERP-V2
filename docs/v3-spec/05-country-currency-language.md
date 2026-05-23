# FactoryOS V3 — Country / Currency / Language Blueprint

**Belge türü:** Gate 0 platform spec  
**Durum:** ☐ TASLAK | ☑ İNCELEME | ☐ FROZEN  
**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026  
**Ürün:** FactoryOS V3 · V2 referans only (kod kopyalanmaz)

**İlişkili belgeler:**

- [03-migration-module-registry.md](./03-migration-module-registry.md) — `GET /api/public/config`
- [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) — hassas alan redaction
- [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) — i18n zorunluluğu (UI FROZEN)
- Domain (Gate 0 devam): [06-hr](./06-hr-full-blueprint.md), [07-stock](./07-stock-full-blueprint.md), [08-purchasing](./08-purchasing-full-blueprint.md), [09-finance](./09-finance-data-contract.md)

---

## 1. Amaç

FactoryOS V3’te **ülke, para birimi, dil ve raporlama para birimi** kararları merkezidir. Tüm modüller aynı sözleşmeyi kullanır:

| Hedef | Açıklama |
|-------|----------|
| Hardcoded para yok | `UZS`, `USD`, `EUR` kaynak kodda sabitlenmez |
| Orijinal işlem parası korunur | USD maaş USD kalır; UZS ödeme UZS kalır |
| Raporlama snapshot | `local` ve `base` türev alanlar işlem anı kuru ile |
| Tek config API | Formlar, tablolar, raporlar `public/config` + domain servis |
| Tek dil zinciri | tr / en / ru / uz — hardcoded UI metni yok |
| Ülke profili | UZ, TR ile başlar; genişletilebilir |

**Gate 0 çıktısı:** Bu belge FROZEN olmadan Gate 1 `country_profiles`, `CurrencyField`, `Money` value object ve `public/config` **yazılmaz**.

---

## 2. Ana kavramlar

| Kavram | Tip / örnek | Açıklama |
|--------|-------------|----------|
| `country_code` | `CHAR(2)` ISO 3166-1 | Aktif operasyon ülkesi (`UZ`, `TR`) |
| `default_locale` | `tr` \| `en` \| `ru` \| `uz` | Sistem varsayılan UI dili |
| `supported_locales` | JSON dizi | İzin verilen UI dilleri |
| `local_currency` | `CHAR(3)` ISO 4217 | Ülke operasyon para birimi (ör. `UZS`, `TRY`) |
| `base_reporting_currency` | `CHAR(3)` | Konsolide raporlama (varsayılan `USD`) |
| `transaction_currency` | `CHAR(3)` | İşlemin **orijinal** para birimi |
| `fx_rate` | `DECIMAL(18,8)` | İşlem anı: 1 birim `transaction_currency` = X `local_currency` |
| `fx_rate_to_base` | `DECIMAL(18,8)` | İşlem anı: 1 birim `local` veya `transaction` → `base` (politika §4) |
| `amount_transaction` | `DECIMAL(18,4)` | Orijinal tutar |
| `amount_local` | `DECIMAL(18,4)` | `local_currency` cinsinden snapshot |
| `amount_base` | `DECIMAL(18,4)` | `base_reporting_currency` cinsinden snapshot |
| **currency snapshot** | Yukarıdaki alanların seti | Kayıt anında dondurulur; geçmiş rapor bozulmaz |

**Money value object (domain):**

```text
Money {
  amount_transaction,
  transaction_currency,
  fx_rate_to_local,
  amount_local,
  fx_rate_to_base,
  amount_base,
  snapshot_at   // DATETIME
}
```

Hesaplama **yalnızca** backend `MoneyService` / modül domain servisinde; frontend aritmetik yasak (§10, §12).

---

## 3. Varsayılan ülke ve para birimi

### 3.1 Başlangıç operasyonu (Özbekistan)

Sistem **ilk kurulumda** UZ profiline göre seed edilebilir; değerler **veritabanı / country_profiles** kaynağından gelir, koda gömülmez.

| Ayar | Başlangıç değeri (UZ seed) | Not |
|------|----------------------------|-----|
| `country_code` | `UZ` | |
| `default_locale` | `tr` | Ana operasyon dili Türkçe |
| `supported_locales` | `tr`, `en`, `ru`, `uz` | |
| `local_currency` | `UZS` | |
| `base_reporting_currency` | `USD` | |

### 3.2 Genişletilebilirlik (Türkiye ve diğerleri)

| Profil | `country_code` | `local_currency` | Örnek `default_locale` |
|--------|----------------|------------------|---------------------------|
| Özbekistan | `UZ` | `UZS` | `tr` |
| Türkiye | `TR` | `TRY` | `tr` |
| (ileride) | `XX` | … | … |

**Kural:** Yeni ülke = yeni `country_profiles` satırı + seed; kod değişikliği gerekmez.

### 3.3 Yasak

```javascript
// YASAK örnekler
if (currency === 'UZS') ...
const DEFAULT = 'USD';
alias SYSTEM → UZS  // V3'te SYSTEM yok
```

---

## 4. Currency model kararı

### 4.1 İlke: orijinal para korunur

Her finansal işlemde **transaction_currency** ve **amount_transaction** kaynak doğrudur:

| İşlem | transaction_currency | amount_transaction |
|-------|----------------------|-------------------|
| USD maaş | `USD` | brüt USD |
| UZS tedarikçi ödemesi | `UZS` | UZS tutar |
| USD satınalma satırı | `USD` | birim fiyat × miktar USD |

**Asla:** USD işlemi “sistem yerel UZS” diye tek kolonda UZS’ye ezilip USD bilgisinin kaybolması.

### 4.2 Snapshot alanları (zorunlu set)

Kayıt oluşturma / onay anında doldurulur:

| Alan | Açıklama |
|------|----------|
| `amount_transaction` | Kullanıcının girdiği tutar |
| `transaction_currency` | Kullanıcının seçtiği para |
| `fx_rate_to_local` | İşlem tarihindeki kur (yoksa 1.0 aynı para) |
| `amount_local` | `amount_transaction * fx_rate_to_local` (yuvarlama kuralı §12) |
| `fx_rate_to_base` | local→base veya transaction→base (tek politika) |
| `amount_base` | Raporlama tutarı |

**Önerilen politika (V3):**

```text
amount_local  = convert(amount_transaction, transaction_currency → local_currency, fx_date)
amount_base   = convert(amount_local, local_currency → base_reporting_currency, fx_date)
```

Alternatif: transaction→base doğrudan — domain spec’te tek yol seçilir; **karıştırılmaz**.

### 4.3 FX kaynağı

| Kaynak | Gate 1 | Gate 0 karar |
|--------|--------|----------------|
| `fx_rates` tablosu (tarih + currency_pair) | Manuel admin giriş | Onaylı |
| Harici API | Sonraki faz | Açık karar |
| Eksik kur | Kayıt **blok** veya onaylı “son bilinen kur” (risk dokümante) | Gate 1 |

---

## 5. USD kuralı

| Kural | Açıklama |
|-------|----------|
| USD sadece raporlama değil | Gerçek işlemler USD olabilir |
| Saklama | `transaction_currency = 'USD'` korunur |
| Local UZS olsa bile | USD işlem ayrıca `amount_local` / `amount_base` üretir; **USD orijinal kolonlar silinmez** |
| Otomatik dönüşüm yok | USD kayıt sonradan UZS’ye “migrate” edilmez |
| Form | CurrencyField USD seçilince submit `transaction_currency` = USD kalır |
| Liste / rapor | Hem transaction hem local/base gösterilebilir (yetkiye göre) |

**V2 gap:** `SYSTEM` alias → UZS normalize ([stockMovementService.js](../../backend/services/stockMovementService.js)) — **V3’te kaldırılır**.

---

## 6. HR maaş currency kuralı

### 6.1 Saklanan alanlar (orijinal)

| Alan | Açıklama |
|------|----------|
| `salary_amount` | Toplam maaş tutarı |
| `salary_currency` | Toplam para birimi |
| `official_salary_amount` | Resmi maaş |
| `official_salary_currency` | Resmi para |
| `unofficial_salary_amount` | Gayri resmi (varsa) |
| `unofficial_salary_currency` | |
| `official_salary_fx_rate` | Resmi döviz kuru (V2 uyumlu alan) |

**Kural:** Her tutar çifti kendi `*_currency` ile; karışık tek kolon yok.

### 6.2 Normalize / rapor alanları (türev)

Payroll snapshot veya dashboard için opsiyonel:

| Türev | Açıklama |
|-------|----------|
| `salary_amount_local` | Dönem sonu kuru ile |
| `salary_amount_base` | USD raporlama |
| `compensation_snapshot` | Aylık kapanış tablosunda dondurulmuş Money |

**Üretim yeri:** `hrService` / wage engine — **frontend hesaplamaz**.

### 6.3 Yetki

Maaş görünürlüğü [permission blueprint](./01-permission-role-position-blueprint.md) §14 — `module.hr` yetmez; `hr.salary.*` granular.

### 6.4 V2 referans

- `employees.salary_currency`, `employee_compensation_history`
- `meService.js` breakdown
- USD/UZS dağılım scriptleri

---

## 7. Satınalma currency kuralı

### 7.1 Satır alanları

| Alan | Açıklama |
|------|----------|
| `unit_price` | Birim fiyat (transaction cinsinden) |
| `currency_code` | Satır para birimi (`transaction_currency`) |
| `fx_rate` | İşlem kuru → local |
| `line_total_transaction` | `qty * unit_price` |
| `line_total_local` | Snapshot |
| `line_total_base` | Snapshot |

### 7.2 İş akışı ayrımı (fiyat ≠ tamamlama)

| Aşama | Currency davranışı |
|-------|-------------------|
| Sipariş oluşturma | Satır `currency_code` + fiyat opsiyonel |
| Fiyat kaydetme | `unit_price` + `currency_code` + `fx_rate` güncellenir; sipariş durumu ayrı |
| Mal kabul | Miktar kesin; fiyat yoksa **pending_cost** |
| pending_cost | Maliyet kesinleşince `currency_code` + tutar + fx snapshot yazılır |
| Finansal kesinleşme | `amount_*` snapshot kilitlenir |

**Kural:** Fiyat sonradan gelirse geçmiş mal kabul satırına retroaktif kur — **yalnız** domain kuralı ile (audit); sessiz toplu overwrite yok.

### 7.3 V2 referans

- `database/schema/006_purchasing_module.sql` — `currency`, `fx_rate`
- `purchasingService.js` — `SYSTEM` → UZS (taşınmaz)

---

## 8. Stok maliyeti currency kuralı

### 8.1 unit_cost (FIFO — birim bazlı)

Ana maliyet **ürün ana birimi** üzerinden (ADET, PLK, M2, KG — ürün `unit_code`):

| Alan | Açıklama |
|------|----------|
| `unit_cost_transaction` | Katman maliyeti orijinal para / birim |
| `transaction_currency` | Giriş para birimi |
| `unit_cost_local` | UZS (veya local) / birim snapshot |
| `unit_cost_base` | USD (veya base) / birim snapshot |
| `qty_remaining` | Ana birim miktarı (m² legacy adı değil) |

### 8.2 Taşınmayacak V2 borcu

| V2 | V3 |
|----|-----|
| `cost_uzs_per_m2` | **Yasak** hedef kolon |
| `qty_m2_remaining` zorunlu | `qty_remaining` + `unit_code` |
| m² varsayılan FIFO | Ürün birimine göre FIFO |

### 8.3 Stok hareketi girişi

Mal kabul / manuel giriş → cost layer oluştururken purchasing satırından veya manuel girişten **Money snapshot** kopyalanır.

**P5 notu:** Manuel stok girişi yetkisi [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) — currency kuralından bağımsız.

### 8.4 V2 referans

- `stockCostLayerService.js` — `cost_uzs_per_m2` (ters örnek)
- `stockMovementService.js` — `SYSTEM`, hardcoded UZS

---

## 9. Finance tracking currency kuralı

**Finance modülü resmi muhasebe değildir** — operasyonel nakit / cari / fatura takibi ([09-finance-data-contract.md](./09-finance-data-contract.md)).

Her hareket (cari, fatura, ödeme, tahsilat):

| Alan grubu | Alanlar |
|------------|---------|
| Orijinal | `amount_original`, `currency_original` |
| Local snapshot | `amount_local`, `fx_rate_to_local` |
| Base snapshot | `amount_base`, `fx_rate_to_base` |
| Meta | `fx_snapshot_at`, `fx_source` |

**Kural:** Ledger satırı immutable snapshot; kur değişince geçmiş satır güncellenmez.

---

## 10. Dil sistemi

### 10.1 Desteklenen diller

| Kod | Dil |
|-----|-----|
| `tr` | Türkçe (ana operasyon dili) |
| `en` | English |
| `ru` | Русский |
| `uz` | Oʻzbek |

### 10.2 i18n zorunluluğu

| Kural | Açıklama |
|-------|----------|
| Dosyalar | `i18n/tr.json`, `en.json`, `ru.json`, `uz.json` (modül namespace ile) |
| HTML | Hardcoded metin yok |
| Yeni key | Dört dil dosyasına ekleme checklist ([03-migration](./03-migration-module-registry.md) manifest) |
| Türkçe karakter | ç, ğ, ı, İ, ö, ş, ü — UTF-8 |

### 10.3 Locale zinciri (UI)

```text
1. Kullanıcı seçimi: localStorage['factoryos_locale'] (veya eşdeğer)
2. Yoksa: country_profiles.default_locale
3. Yoksa: 'tr'
```

**API:** `GET /api/public/config` → `defaultLocale`, `supportedLocales`.

### 10.4 Eksik çeviri fallback

| Sıra | Davranış |
|------|----------|
| 1 | Seçili dil dosyasında key |
| 2 | `default_locale` dosyasında key |
| 3 | Kontrollü placeholder: `[menu.stock]` veya key + log (Gate 1: dev’de uyarı, prod’da placeholder) |

**Yasak:** Ham `menu.stock.hub.title` kullanıcıya gösterilip sessiz kalınması (V2 arası sızıntı).

### 10.5 V2 referans

- `frontend/public/i18n/tr.json`, `en.json`, `ru.json`, `uz.json`
- `i18n.js` yükleme

---

## 11. Ülke / bölge ayarları

### 11.1 `country_profiles` tablosu (hedef)

| Kolon | Açıklama |
|-------|----------|
| `country_code` | PK `UZ`, `TR` |
| `name_i18n_key` | |
| `local_currency` | |
| `base_reporting_currency` | |
| `default_locale` | |
| `supported_locales` | JSON |
| `phone_country_code` | `+998`, `+90` |
| `date_format` | UI hint |
| `number_locale` | `uz-UZ`, `tr-TR` |
| `is_active` | |
| `tax_rules_ref` | Gate 5+ stub |

### 11.2 Kullanım alanları

| Alan | Ülke profiline bağlı |
|------|----------------------|
| Personel adres formatı | İl/ilçe listeleri seed |
| Telefon mask | `phone_country_code` |
| Varsayılan para | `local_currency` |
| Vergi / finans (ileride) | `tax_rules_ref` |

### 11.3 Başlangıç profilleri

| Profil | Durum Gate 0 |
|--------|----------------|
| `UZ` | Seed zorunlu |
| `TR` | Seed zorunlu |
| Diğer | Sonradan admin |

**Aktif profil:** `system_settings.active_country_code` veya tek satırlık tenant config — Gate 1 karar.

---

## 12. Tarih, sayı ve format kuralları

| Konu | Kural |
|------|--------|
| DB tarih | `DATE` / `DATETIME` ISO; timezone UTC veya tenant TZ (tek politika) |
| UI tarih | `Intl` / merkezi `formatDate(value, locale)` |
| DB sayı | `DECIMAL`; float yasak para için |
| UI sayı | `formatNumber(value, locale)` — `@factoryos/ui` veya shared util |
| UI para | `formatMoney(amount, currency, locale)` — sembol konumu locale’e göre |
| Yuvarlama | Banker’s / half-up — modül başına **tek** `MoneyService.round` |
| Yasak | Sayfa içi `toLocaleString` kopyası |

**Frontend:** Yalnızca helper çağırır; kur çarpımı yapmaz (CT-13).

---

## 13. Admin panel ayarları

### 13.1 Görüntülenebilir ayarlar

| Ayar | Düzenlenebilir Gate 1 | Not |
|------|------------------------|-----|
| `default_locale` | Evet (kontrollü) | Oturum + config yenile |
| `supported_locales` | Evet | |
| `active_country_code` | Hayır (Gate 1) / çok kontrollü | Veri migrasyonu gerekir |
| `local_currency` | **Hayır (Gate 1)** | Sadece kurulum / super_admin + runbook |
| `base_reporting_currency` | Hayır (Gate 1) | Finansal tarihsel bütünlük |
| `currency_list` | Salt okunur + izin verilen işlem paraları | |
| `fx_rate_source_policy` | Evet (manuel / gelecek API) | |

### 13.2 `local_currency` değiştirme riski

Canlı sistemde `UZS` → `TRY` değişimi:

- Geçmiş snapshot’lar eski local’de kalır (doğru)
- Yeni işlemler yeni local’de (doğru)
- Karışık dönem raporları yanıltıcı

**V3 Gate 1:** Admin UI’da `local_currency` **read-only**; değişim yalnız migration script + bakım penceresi.

### 13.3 public/config örneği

```json
{
  "countryCode": "UZ",
  "localCurrency": "UZS",
  "baseReportingCurrency": "USD",
  "defaultLocale": "tr",
  "supportedLocales": ["tr", "en", "ru", "uz"],
  "allowedTransactionCurrencies": ["UZS", "USD"],
  "moneyFormat": {
    "UZS": { "decimals": 0, "symbol": "soʻm" },
    "USD": { "decimals": 2, "symbol": "$" }
  },
  "fxRatePolicy": "manual_table"
}
```

---

## 14. Modül özeti tablosu

| Modül | transaction | Snapshot | Hesaplayan |
|-------|-------------|----------|------------|
| HR maaş | `salary_currency` | local/base opsiyonel | hrService |
| Satınalma | `currency_code` | line_total_* | purchasingService |
| Stok FIFO | `transaction_currency` | unit_cost_* | stockCostLayerService |
| Finance | `currency_original` | amount_local/base | financeService (Gate 5) |
| Raporlama | Okuma | `amount_base` öncelik | report queries |

---

## 15. V2 referans noktaları

| Konu | V2 dosya / davranış |
|------|---------------------|
| Sistem ayarları | `systemSettingsService.js`, `system_settings` |
| SYSTEM alias | `stockMovementService.js`, `purchasingService.js` |
| HR salary currency | `employees`, `employee_compensation_history`, `hrService.js` |
| Satınalma fx | `006_purchasing_module.sql`, `purchasingService.js` |
| Stok m² maliyet | `stockCostLayerService.js`, `004_product_currency_i18n_fifo.sql` |
| Proje maliyet UI | project modülü UZS/USD gösterimi (inceleme) |
| Frontend format | Dağınık `toFixed`, sayfa bazlı |
| i18n | `frontend/public/i18n/*.json`, `i18n.js` |
| default_locale | V2 seed var; zincir tam kullanılmıyor — V3 düzeltir |

---

## 16. V2’den taşınmayacaklar

| Öğe | V3 |
|-----|-----|
| Hardcoded `UZS` / `USD` | Config + country_profiles |
| `SYSTEM` currency alias | Kaldırıldı |
| Sayfa bazlı `formatMoney` | Merkezi helper |
| `cost_uzs_per_m2` FIFO | `unit_cost_*` + ürün birimi |
| Frontend maaş/kur hesabı | Backend only |
| Eksik i18n raw key | Fallback zinciri |
| USD → local sessiz overwrite | Snapshot + ayrı kolonlar |
| `default_currency` serbest metin | Enum + profil |

---

## 17. Test / doğrulama senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| CT-01 | Boş DB seed UZ | `local_currency` = UZS (config API) |
| CT-02 | USD maaş kaydı | `salary_currency` = USD; amount USD |
| CT-03 | UZS maaş kaydı | `salary_currency` = UZS |
| CT-04 | Satınalma USD satırı | `currency_code` USD; local/base snapshot dolu |
| CT-05 | Satınalma UZS satırı | transaction UZS korunur |
| CT-06 | Stok girişi | `unit_cost_transaction` + local/base |
| CT-07 | Finance USD fatura | original USD; rapor base |
| CT-08 | UI dil TR | Türkçe metin |
| CT-09 | UI dil EN | İngilizce metin |
| CT-10 | Eksik key `en` | fallback `tr` veya placeholder |
| CT-11 | Sayı format | `formatNumber` locale uyumlu |
| CT-12 | Para format | `formatMoney` sembol doğru |
| CT-13 | Frontend kur | API’den gelen snapshot; client çarpım yok |
| CT-14 | Admin local_currency edit | Gate 1: reddedilir veya disabled |
| CT-15 | UZ vs TR profil | Ayrı `country_profiles` satırları |

---

## 18. Riskler

| Risk | Etki | Azaltma |
|------|------|---------|
| Hardcoded currency | Yanlış rapor | Lint + code review |
| USD ezilmesi | Veri kaybı | transaction kolon zorunlu |
| Frontend hesap | Tutarsızlık | CT-13; API snapshot |
| i18n raw key | Kötü UX | Fallback + CI key scan |
| local_currency canlı değişim | Tarihsel rapor kafa karışıklığı | Read-only Gate 1 |
| Eksik FX | Blok kayıt | fx_rates zorunluluğu |
| m² legacy taşınması | Stok hatalı | 07-stock spec ile birlikte audit |

---

## 19. Kabul kriterleri (Gate 0)

- [ ] Currency kavramları (§2) onaylandı
- [ ] local / base / transaction ayrımı (§4) onaylandı
- [ ] USD kuralı (§5) onaylandı
- [ ] HR currency kuralı (§6) onaylandı
- [ ] Satınalma currency / fx / pending_cost (§7) onaylandı
- [ ] Stok unit_cost currency; m² legacy yok (§8) onaylandı
- [ ] Finance tracking currency (§9) onaylandı
- [ ] Dil ve fallback (§10) onaylandı
- [ ] Country profile UZ + TR (§11) onaylandı
- [ ] Format helper kuralları (§12) onaylandı
- [ ] Admin policy local_currency (§13) onaylandı
- [ ] CT-01…CT-15 Gate 1 test planına aktarıldı
- [ ] V2 taşınmayacaklar listesi (§16) onaylandı
- [ ] **Durum: FROZEN** (henüz değil — inceleme devam)

**Gate 0 kuralı:** Bu belge **FROZEN** olmadan Gate 1 currency / config / `Money` kodu **yazılmayacak**.

---

## 20. Açık kararlar (inceleme)

| # | Karar | Seçenekler |
|---|--------|------------|
| C1 | `amount_base` hesap yolu | local→base vs transaction→base |
| C2 | İzin verilen işlem paraları | UZS, USD, TRY, EUR? |
| C3 | FX eksikte davranış | Blok / son kur |
| C4 | Aktif ülke değiştirme | Tek tenant / çoklu (ileride) |

---

## 21. Onay

| Rol | İsim | Tarih |
|-----|------|-------|
| Proje lideri | | |
| Backend lead | | |
| Finance domain | | |
| İK domain | | |

---

## 22. Belge durumu

**Durum: TASLAK / İNCELEME** — Henüz FROZEN değil.

**Sonraki önerilen spec:** [02-admin-control-system.md](./02-admin-control-system.md) (detay genişletme) veya domain: [06-hr-full-blueprint.md](./06-hr-full-blueprint.md)
