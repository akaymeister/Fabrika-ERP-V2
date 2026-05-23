# FactoryOS V3 — Country / Currency / Language Blueprint

**Belge türü:** Gate 0 platform spec  
**Durum:** ☐ TASLAK | ☑ İNCELEME | ☐ FROZEN  
**Versiyon:** 1.1.0  
**Son güncelleme:** 21.05.2026  
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
| Hardcoded para/ülke yok | `UZS salary`, `USD only` gibi ifadeler **yasak**; `local_currency` / `reporting_currency` |
| Orijinal işlem parası korunur | `transaction_currency` + `amount_transaction` kaynak doğru |
| FX snapshot | İşlem anı kuru dondurulur; dashboard kuru geçmişi **değiştirmez** |
| Tek config API | [02-admin](./02-admin-control-system.md) system settings + `GET /api/public/config` |
| Tek dil zinciri | tr / en / ru / uz — ham i18n key yok |
| Veri girişi Latin | Cyrillic giriş backend’de **engellenir** |
| Merkezi format | `formatMoney` / `formatNumber` — modül bazlı format yasak |
| Ülke profili | Admin’den seçilir; UZ, TR seed; genişletilebilir |

**Gate 0 çıktısı:** Bu belge FROZEN olmadan Gate 1 `country_profiles`, `CurrencyField`, `Money` value object ve `public/config` **yazılmaz**.

---

## 2. Ana kavramlar

| Kavram | Tip / örnek | Açıklama |
|--------|-------------|----------|
| `country_code` | `CHAR(2)` ISO 3166-1 | Aktif operasyon ülkesi (`UZ`, `TR`) |
| `default_locale` | `tr` \| `en` \| `ru` \| `uz` | Sistem varsayılan UI dili |
| `supported_locales` | JSON dizi | İzin verilen UI dilleri |
| `local_currency` | `CHAR(3)` ISO 4217 | **Operasyonel yerel para birimi** — sistem ayarlarından; ülke önerir, Admin değiştirebilir (C1) |
| `reporting_currency` | `CHAR(3)` | **Yönetim raporlama para birimi** — ayrı seçilir; şema alanı: `base_reporting_currency` (C1) |
| `transaction_currency` | `CHAR(3)` | İşlemin **orijinal** para birimi |
| `fx_rate` | `DECIMAL(18,8)` | İşlem anı: 1 birim `transaction_currency` = X `local_currency` |
| `fx_rate_to_base` | `DECIMAL(18,8)` | İşlem anı: 1 birim `local` veya `transaction` → `base` (politika §4) |
| `amount_transaction` | `DECIMAL(18,4)` | Orijinal tutar |
| `amount_local` | `DECIMAL(18,4)` | `local_currency` cinsinden snapshot |
| `amount_base` | `DECIMAL(18,4)` | `reporting_currency` (`base_reporting_currency`) cinsinden snapshot |
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

### 3.4 C1 — Local currency / reporting currency (Gate 0 KABUL)

| Karar | Politika |
|-------|----------|
| Ülke seçimi | [02-admin](./02-admin-control-system.md) **System Settings** — `active_country_code` |
| Local currency önerisi | Ülke profili `country_profiles.local_currency` **önerir** (ör. UZ→UZS, TR→TRY) |
| Local currency değişimi | **Süper Yönetim / Admin** onayı ile değiştirilebilir; canlı değişim runbook + audit (§13.2) |
| Local currency tanımı | Sistemin **operasyonel yerel** para birimi; günlük işlem, maaş yerel kırılımı, stok local snapshot |
| Reporting currency | Yönetim raporları için **ayrı** seçilir; `reporting_currency` (DB: `base_reporting_currency`) |
| İlk faz seçenekleri | Sınırlı liste yeterli (ör. USD, EUR, TRY); yapı **genişletilebilir** (`allowed_reporting_currencies` JSON) |
| Modül dili | “UZS maaş” **yasak** → “yerel para birimi maaşı” / `amount_local` + `local_currency` |
| Hard-code | Kaynak kod, i18n, API response’da `UZS`/`USD` **sabit etiket yok** — config’ten gelir |

**Uygulama Gate’i:** Gate 1 — `country_profiles`, admin UI, `public/config`; politika Gate 0 **KABUL**.

**Test:** CT-01, CT-15, CT-16, CT-17.

### 3.5 Yasak

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

**Gate 0 KABUL — dönüşüm zinciri (tek yol):**

```text
amount_local  = convert(amount_transaction, transaction_currency → local_currency, fx_snapshot_at)
amount_base   = convert(amount_local, local_currency → reporting_currency, fx_snapshot_at)
```

`transaction → reporting` doğrudan atlanmaz; tutarlılık ve audit için **local üzerinden** reporting üretilir.

### 4.3 C2 — FX / kur mantığı (Gate 0 KABUL)

| Kavram | Davranış |
|--------|----------|
| **Dashboard güncel kur** | Gösterilebilir (Google veya başka kaynak); **yalnızca bilgilendirme** |
| **İşlem kuru** | Maaş, satınalma, muhasebe, stok maliyeti — **manuel tablo veya onaylı snapshot** |
| Geçmiş işlem | Dashboard kuru değişince **güncellenmez** |
| Her finansal kayıt | `fx_rate_to_local`, `fx_rate_to_base`, `fx_snapshot_at`, `fx_source` zorunlu set |
| Kur değişikliği | Admin `fx_rates` INSERT/UPDATE → **audit log** (`FX_RATE_CHANGE` veya eşdeğer) |
| Otomatik feed → işlem | **Yasak** — feed yalnızca dashboard / öneri; posting ayrı onay |
| Eksik kur (yeni işlem) | Varsayılan: kayıt **blok**; istisna: son **manuel** kur + uyarı + yüksek yetki (Gate 1 UI) |

| Kaynak | Rol | Gate |
|--------|-----|------|
| `fx_rates` (manuel) | İşlem / bordro / mal kabul snapshot | Gate 1 |
| Harici API (Google vb.) | Dashboard bilgi; isteğe bağlı “önerilen kur” | Gate 1–2 |
| Bordro kilit kuru | Dönem snapshot — [06-hr](./06-hr-full-blueprint.md) §15B | Gate 2 |

**İzin verilen işlem paraları (eski C2 alt kararı — KABUL):** `allowed_transaction_currencies` — country profile + admin; ilk faz ör. UZS, USD, TRY; liste genişletilebilir.

**Uygulama Gate’i:** Gate 1 `fx_rates` + `MoneyService`; dashboard feed Gate 1–2.

**Test:** CT-13, CT-18, CT-19, CT-20, CT-21.

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

### 10.0 C3 — Dil / alfabe / i18n (Gate 0 KABUL)

| Karar | Politika |
|-------|----------|
| Sistem native / default dil | **Türkçe (`tr`)** — `country_profiles.default_locale` veya system settings |
| Kullanıcı dili | Login sonrası seçilen dil **tüm sayfalarda** (AppShell + modüller) |
| Desteklenen UI dilleri | `tr`, `en`, `ru`, `uz` |
| i18n | Merkezi `i18n/*.json` + `i18n.js`; modül namespace; **ham key kullanıcıya gösterilmez** |
| Font | Seçilen dil ve ülke karakterlerini destekler (Latin + Türkçe + Kiril **görüntüleme** RU için) |
| **Veri girişi alfabesi** | **Latin** zorunlu — ad, adres, ürün adı, not vb. |
| Cyrillic giriş | **Backend’de reddedilir** (`textNormalize` / validation); API 400 |
| Görüntüleme vs kayıt | UI RU olabilir; kayıt metni Latin standardında kalır |
| Persist | `users.preferred_locale` veya eşdeğer; oturum boyunca tutarlı |

**Uygulama Gate’i:** Gate 1 locale zinciri + validation middleware; Gate 2 modül formları.

**Test:** CT-08, CT-09, CT-10, CT-22, CT-23.

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
| `base_reporting_currency` | Şema adı; politika: `reporting_currency` (C1) |
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

**Aktif profil (C1/C4 — KABUL):** `system_settings.active_country_code` — tek tenant; çoklu ülke eşzamanlı operasyon Gate 2+.

---

## 12. Tarih, sayı ve format kuralları

### 12.1 C4 — Sayı, para, format ve hassasiyet (Gate 0 KABUL)

| Karar | Politika |
|-------|----------|
| Merkezi formatter | `formatMoney`, `formatNumber`, `formatDate` — `@factoryos/ui` veya `MoneyFormatService` |
| Ülke/dil/currency | `country_profiles.number_locale`, `moneyFormat` config (§13.3) |
| Örnek gösterim (UZ) | `1.000.000,00` + `local_currency` sembolü (config’ten) |
| Örnek gösterim (USD rapor) | `1,000.00` veya locale’e göre `1.000,00` + reporting sembolü |
| Hesaplama hassasiyeti | DB: kur ve birim maliyet **`DECIMAL(18,6)`** veya eşdeğer **6 ondalık** saklama |
| Ekran gösterimi | Genelde **2 ondalık**; modül özel istisna yok (yuvarlama tek servis) |
| Frontend ↔ backend | Aynı `MoneyService.round` politikası; client **format** yapar, **hesaplamaz** |
| Yasak | Modül içi `toFixed`, hard-code `$` / `soʻm`, sayfa bazlı para formatı |
| Yuvarlama | half-up (veya tek politika dokümante); modül başına farklı kural **yok** |

**Uygulama Gate’i:** Gate 1 shared format helpers; Gate 2 modül ekranları migrate.

**Test:** CT-11, CT-12, CT-24, CT-25.

### 12.2 Genel kurallar

| Konu | Kural |
|------|--------|
| DB tarih | `DATE` / `DATETIME` ISO; timezone UTC veya tenant TZ (tek politika) |
| UI tarih | `formatDate(value, locale)` |
| DB sayı / para | `DECIMAL`; float **yasak** |
| UI sayı | `formatNumber(value, locale)` |
| UI para | `formatMoney(amount, currencyCode, locale)` — sembol `moneyFormat` config’ten |

**Frontend:** Yalnızca helper çağırır; kur çarpımı yapmaz (CT-13).

---

## 13. Admin panel ayarları

### 13.1 Görüntülenebilir ayarlar

| Ayar | Düzenlenebilir Gate 1 | Not |
|------|------------------------|-----|
| `default_locale` | Evet (kontrollü) | Oturum + config yenile |
| `supported_locales` | Evet | |
| `active_country_code` | Süper Yönetim / Admin (kontrollü) | C1: ülke seçimi; audit + migrasyon runbook |
| `local_currency` | Admin değiştirilebilir (C1) | Ülke önerisi; canlı değişim riski §13.2 |
| `reporting_currency` | Admin seçilebilir (C1) | İlk faz sınırlı liste; genişletilebilir yapı |
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
  "reportingCurrency": "USD",
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
| Cyrillic veri girişi | Latin + backend validation (C3) |
| Modül bazlı para formatı | Merkezi formatter (C4) |

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
| CT-16 | Ülke seçimi → local öneri | TR seçilince TRY önerilir; Admin override edebilir |
| CT-17 | Hard-code etiket taraması | Kaynakta `UZS salary` / sabit USD yok |
| CT-18 | Dashboard kur değişimi | Geçmiş `fx_snapshot` değişmez |
| CT-19 | Yeni maaş kaydı | Manuel/snapshot kur; dashboard feed kullanılmaz |
| CT-20 | FX rate admin değişimi | Audit log satırı |
| CT-21 | Eksik kur yeni işlem | Blok veya yetkili istisna; sessiz son kur yok (varsayılan politika) |
| CT-22 | Cyrillic veri girişi | API 400; Latin kabul |
| CT-23 | Login sonrası dil | Tüm sayfalar seçili locale |
| CT-24 | 6 ondalık saklama | Kur/maliyet DB; ekran 2 ondalık |
| CT-25 | formatMoney merkezi | Modül içi duplicate formatter yok |

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
| Dashboard kur → posting | Yanlış geçmiş bordro | C2: feed bilgi only |
| Cyrillic kayıt | Arama/rapor bozulması | C3: backend red |
| 6 vs 2 ondalık karışımı | Tutarsız toplam | C4: tek MoneyService |

---

## 19. Kabul kriterleri (Gate 0)

- [ ] Currency kavramları (§2) onaylandı
- [ ] **C1 KABUL** — local_currency + reporting_currency; ülke önerisi; Admin override; hard-code yok (§3.4)
- [ ] **C2 KABUL** — FX snapshot; dashboard bilgi; geçmiş değişmez; audit (§4.3)
- [ ] **C3 KABUL** — TR default; login sonrası dil; Latin giriş; Cyrillic red (§10.0)
- [ ] **C4 KABUL** — merkezi format; 6 ondalık saklama; 2 ondalık gösterim (§12.1)
- [ ] local → reporting dönüşüm zinciri (§4.2) onaylandı
- [ ] transaction_currency korunumu (§4–§5) onaylandı
- [ ] HR / satınalma / stok / finance currency (§6–§9) onaylandı
- [ ] Country profile UZ + TR (§11) onaylandı
- [ ] System settings ülke ve para birimi (§13) onaylandı
- [ ] CT-01…CT-25 Gate 1 test planına aktarıldı
- [ ] V2 taşınmayacaklar (§16) onaylandı
- [ ] Terminoloji [06-hr](./06-hr-full-blueprint.md), [07-stock](./07-stock-full-blueprint.md) ile uyumlu
- [ ] **Durum: FROZEN** (henüz değil — kullanıcı onayı bekler)

**Gate 0 kuralı:** Bu belge **FROZEN** olmadan Gate 1 currency / config / `Money` kodu **yazılmayacak**.

---

## 20. Açık kararlar — C1–C4 kapanışı

Gate 0’da **KABUL**; “daha sonra bakılacak” yok. Uygulama Gate 1/2/3 ayrıdır.

| # | Gate 0 karar (özet) | Uygulama Gate | Bölüm |
|---|---------------------|---------------|--------|
| **C1** | **KABUL** — System settings ülke seçimi; `local_currency` operasyonel (ülke önerir, Admin değiştirir); `reporting_currency` ayrı seçilir; modül hard-code yok | Gate 1 admin + config | §3.4 |
| **C2** | **KABUL** — Dashboard kur bilgi; işlem manuel/snapshot; geçmiş değişmez; FX audit; yeni işlemde eksik kur blok (istisna yetkili) | Gate 1–2 `fx_rates`, dashboard | §4.3 |
| **C3** | **KABUL** — Native `tr`; login sonrası dil tüm sayfalarda; TR/EN/RU/UZ i18n; Latin veri girişi; Cyrillic backend red | Gate 1 locale + validation | §10.0 |
| **C4** | **KABUL** — Merkezi formatMoney/Number; ülke/dil config; 6 ondalık hesap saklama; 2 ondalık UI; modül format yasak | Gate 1 shared UI util | §12.1 |

### 20.1 Eski alt kararlar (C1–C4 kapsamında kapatıldı)

| Eski konu | Gate 0 kapanış |
|-----------|----------------|
| `amount_base` yolu | **KABUL:** `transaction → local → reporting` (§4.2) |
| İzin verilen işlem paraları | **KABUL:** `allowed_transaction_currencies` — profile + admin; genişletilebilir (§4.3) |
| FX eksikte davranış | **KABUL:** yeni işlem blok; dashboard feed posting’e girmez (§4.3) |
| Aktif ülke değiştirme | **KABUL:** tek tenant `active_country_code`; çoklu ülke Gate 2+ (§11, §13) |

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

**Versiyon:** 1.1.0 (21.05.2026)

**Önceki:** 1.0.0 — platform currency/dil taslağı.

**Bu sürüm:** C1–C4 Gate 0 **KABUL**; local/reporting currency; FX snapshot vs dashboard; Latin giriş / Cyrillic red; merkezi format ve hassasiyet; CT-16…CT-25.

**Durum: İNCELEMEDE** — Henüz FROZEN değil (FROZEN kararı kullanıcıya aittir).

Gate 0 ülke/para birimi/dil kararları C1–C4 ile netleştirildi; hard-code yasağı, FX snapshot ve merkezi format politikası kilitlendi. **FROZEN** proje onayı sonrası.

**Sonraki önerilen spec:** [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) (satınalma currency / pending_cost hizalama)

### Uygulama Gate özeti (karar KABUL — kod sonra)

| Konu | Gate |
|------|------|
| `country_profiles`, `public/config` | Gate 1 |
| `MoneyService`, `fx_rates`, snapshot | Gate 1 |
| Dashboard kur feed (bilgi) | Gate 1–2 |
| Latin validation middleware | Gate 1 |
| `formatMoney` / `formatNumber` paket | Gate 1 |
| Modül ekran migrate | Gate 2–3 |
