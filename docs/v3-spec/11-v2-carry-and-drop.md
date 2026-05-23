# FactoryOS V3 — V2 Carry & Drop (Taşın / Bırak / Referans)

**Belge türü:** Gate 0 çapraz kesen spec  
**Durum:** ☐ TASLAK | ☑ İNCELEME | ☐ FROZEN  
**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026  
**Ürün:** FactoryOS V3 · Fabrika ERP V2 = referans only

**İlişkili belgeler:**

- [10-integration-map.md](./10-integration-map.md) — port, sahiplik, gate sırası
- [06-hr-full-blueprint.md](./06-hr-full-blueprint.md) · [07-stock](./07-stock-full-blueprint.md) · [08-purchasing](./08-purchasing-full-blueprint.md) · [09-finance](./09-finance-data-contract.md)
- [v2-reference-index.md](./v2-reference-index.md) — dosya yolları
- [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) — UI FROZEN mockup’lar

---

## 1. Amaç

Bu belge, **Fabrika ERP V2**’nin **FactoryOS V3** için nasıl kullanılacağını tanımlar. V2 küçültülmez; çalışan iş kuralları korunurken **teknik borç taşınmaz**.

### 1.1 V2’nin rolü

| Rol | Açıklama |
|-----|----------|
| **Referans sistem** | “Şu an üretimde ne yapıyor?” |
| **UAT davranış kaynağı** | Kabul testi senaryoları |
| **İş kuralı doğrulama** | Gate belgeleriyle karşılaştırma |
| **Test senaryosu üretimi** | HT / ST / PT / FT vektörleri |

### 1.2 V2’nin rolü değildir

| Değil | Neden |
|-------|--------|
| Kod kopyalama kaynağı | V3 sıfırdan temiz mimari |
| UI/CSS kopyalama | UI FROZEN mockup’lar |
| Patch zinciri taşıma | SQL migration runner |
| V3 içine gömülecek proje | Ayrı repo `FactoryOS-V3` |

---

## 2. Ana kural

| Kural | Detay |
|-------|--------|
| **V3 sıfırdan** | Temiz proje; V2 içine yazılmaz |
| **V2 klasörü** | Yalnızca `docs/v3-spec` hazırlığı + referans inceleme |
| **Repo yolları** | V2: `F:\Fabrika-ERP-V2` · V3 (Gate 0 PASS sonrası): `F:\FactoryOS-V3` |
| **Gate 0** | Tüm carry/drop kararları yazılı; kod **yok** |

---

## 3. V2’den taşınacaklar — iş kuralı olarak

### 3.1 HR

| İş kuralı | V3 karşılığı |
|-----------|--------------|
| Detaylı personel profili | [06](./06-hr-full-blueprint.md) §6 |
| `first_name` / `last_name` ayrımı | Korunur; `toUpperTr` |
| `employee_no` otomatik (`PRS-###`) | Korunur |
| Departman / pozisyon | HR yapı + `position_permissions` |
| `salary_currency` korunumu (USD/UZS) | [05](./05-country-currency-language.md) |
| Resmi / gayri resmi maaş ayrımı | WageEngine |
| `employee_compensation_history` | Revision API |
| Günlük / aylık puantaj | AttendanceEngine; dakika birincil |
| Ay kilidi + `payroll_snapshots` | Donmuş bordro |
| Maaş redaction (granular perm) | `hr.salary.*` |

### 3.2 Stock

| İş kuralı | V3 karşılığı |
|-----------|--------------|
| Ürün kodu üretimi | `product_code` seri |
| Marka / kategori / birim ayrımı | Master entity’ler |
| Depo bazlı stok ihtiyacı | `product_stock_balances` |
| Negatif stok engeli | İşlem öncesi kontrol |
| Stok hareket audit | `stock_movements` + activity_logs |
| FIFO tüketim fikri | Unit-cost katmanlar |
| Mal kabul ≠ stok UI karışımı | Mal kabul → StockPort |
| Void / replace felsefesi | Hareket silinmez; ters kayıt |

### 3.3 Purchasing

| İş kuralı | V3 karşılığı |
|-----------|--------------|
| Purchase request | Talep yaşam döngüsü |
| Onay workflow | `purchasing.request.approve` |
| Onay sonrası PO | Otomatik veya manuel |
| Buyer processing | `buyer_state` ayrı eksen |
| **Fiyat kaydet ≠ complete** | Ayrı aksiyonlar |
| Supplier / price / `fx_rate` satır bazlı | PO lines Money model |
| Partial receipt | Kısmi mal kabul |
| Placeholder supplier → complete yasak | Validation |
| `receipt_status` / `buyer_state` ayrımı | §18 status model |

### 3.4 Admin / Permission

| İş kuralı | V3 karşılığı |
|-----------|--------------|
| Granular permission | `perm_key` manifest |
| Rol / permission | `role_permissions` |
| Kullanıcı istisna | `user_permissions` |
| Admin panel ihtiyacı | [02](./02-admin-control-system.md) |
| Hassas alan redaction | API seviyesi |

### 3.5 UI (mantık only)

| İş kuralı | V3 |
|-----------|-----|
| Modal / popup akış sırası | `flowId` envanteri ([12](./12-modal-flow-inventory.md)) |
| Onay diyalogları | ConfirmDialog |
| **Görsel tasarım** | **Kopyalanmaz** — mockup FROZEN |

---

## 4. V2’den taşınmayacaklar — teknik borç

Aşağıdakiler **kesinlikle** FactoryOS V3’e taşınmaz:

| # | Teknik borç |
|---|-------------|
| 1 | `frontend/public` klasörünün tamamı (sayfa HTML/JS) |
| 2 | `style.css` monolith (~10k+ satır CSS borcu) |
| 3 | Sayfa bazlı dağınık JS yapısı |
| 4 | `database/patch-*.js` zinciri ve patch kültürü |
| 5 | `backend/services/*.js` birebir kopyası (`hrService.js` vb.) |
| 6 | `navigation.js` hardcoded menü |
| 7 | Frontend-only permission kontrolü |
| 8 | Raw i18n key UI’da görünmesi |
| 9 | Sayfa-özel format helper’lar |
| 10 | Hardcoded `UZS` / `USD` / `SYSTEM` currency |
| 11 | m² tabanlı eski FIFO (`cost_uzs_per_m2`, `qty_m2_remaining`) |
| 12 | Maaş hesabının frontend’de yapılması |
| 13 | Fiyat kaydetme ile sipariş complete karışıklığı |
| 14 | Admin permission panel V2 kırık davranışları |
| 15 | Global-only stok (depo bazlı bakiye yok) |
| 16 | `window.prompt` / `alert` iş akışları |
| 17 | `app.js` hardcoded page permission map |
| 18 | List-price fallback dashboard değerleme |

---

## 5. V2’den sadece referans alınacaklar

**Davranış / mantık incelenir; kod kopyalanmaz.**

| Alan | V2 referans | V3 hedef |
|------|-------------|----------|
| Maaş motoru | `hrService.js` → `computeWageBreakdown` | `WageEngine` |
| Puantaj dakika | `timeToMinutesAny`, `safeEndMinutes` | `AttendanceEngine` (C+B) |
| Stok hareket | `stockMovementService.js` | `StockMovementService` |
| FIFO katman | `stockCostLayerService.js` | `CostEngine` (unit-cost) |
| Satınalma status | `purchasingService.js` normalize | Ayrı eksenler |
| Permission çözüm | `accessService.js` | `PermissionPort` |
| i18n key kapsamı | `frontend/public/i18n/*.json` | V3 key isimleri yeniden |
| Admin kullanıcı/perm UI | `admin-*.html` deneyimi | Registry + merkezi UI |
| Mal kabul | `postGoodsReceipt` | `StockPort.recordIn` |
| Proje maliyet gösterim | Proje ekranları UZS/USD | Gate 6+ |

Detay yollar: [v2-reference-index.md](./v2-reference-index.md).

---

## 6. V2’den port edilecekler — yöntem

```text
1. V2 davranışı incelenir (UAT / kod okuma)
2. İlgili V3 Gate belgesi kuralı ile karşılaştırılır
3. Teknik borç ayrıştırılır (bu belge §4)
4. V3 için temiz domain service + port tasarlanır
5. Test vektörü yazılır (fixtures/*.json)
6. Kod yalnızca ilgili Gate başladığında yazılır
```

| Kural | |
|-------|--|
| **Copy-paste port** | **Yasak** |
| **Behavior port** | **Serbest** |

---

## 7. Modül bazlı carry/drop tablosu

| Alan | V2 durumu | V3 kararı | Taşı / Ref / Bırak | Not |
|------|-----------|-----------|-------------------|-----|
| HR personel profili | Çalışıyor | Tam profil | **Taşı** | [06](./06-hr-full-blueprint.md) |
| HR salary split | Çalışıyor | WageEngine | **Taşı** | |
| HR payroll snapshot | Çalışıyor | Ay kilidi dondurma | **Taşı** | |
| HR shift / gece aşan | Kısıtlı (safeEndMinutes) | C+B vardiya + datetime | **Yeniden** | H1 önerildi |
| Stock product master | Çalışıyor | Popup + import | **Taşı** | Ürünler ≠ stok takip |
| Stock m² legacy FIFO | Üretimde | Unit-cost FIFO | **Bırak** | `cost_uzs_per_m2` yok |
| Stock negatif koruma | Var | Korunur | **Taşı** | |
| Stock void/replace | Var | Korunur | **Taşı** | |
| Purchasing PR/PO | Çalışıyor | Status ayrımı | **Taşı** | |
| Purchasing price save | Bazen karışık | ≠ complete | **Taşı** + düzelt |
| Purchasing goods receipt | Çalışıyor | StockPort | **Taşı** | |
| Finance hooks | Kısmi / yok | Sıfırdan contract | **Yeniden** | [09](./09-finance-data-contract.md) |
| Admin permission | Çalışıyor (UI sorunlu) | 4 katman + API | **Taşı** | Panel yeniden |
| Navigation | Hardcoded | Registry | **Bırak** | |
| UI / CSS | Monolith | Mockup FROZEN | **Bırak** | |
| Migration / patch | patch-*.js | SQL runner | **Bırak** | |
| i18n | 4 dil dosyası | Aynı diller, yeni key | **Ref** | |
| Currency | Hardcoded + satır fx | Money snapshot | **Taşı** fikir, **Bırak** impl |

---

## 8. UI carry/drop

### 8.1 Taşınmayacak

- V2 `frontend/public/*.html`, sayfa JS, `style.css`
- Hero, landing, glass/glow, büyük tipografi

### 8.2 V3 UI referansı (FROZEN)

| Dosya | İçerik |
|-------|--------|
| [../mockups/factoryos-v3-home-preview.html](../mockups/factoryos-v3-home-preview.html) | Hub, modül kartları |
| [../mockups/factoryos-v3-design-preview.html](../mockups/factoryos-v3-design-preview.html) | Stok hareketleri örneği |
| [../mockups/factoryos-v3-admin-preview.html](../mockups/factoryos-v3-admin-preview.html) | Yönetim paneli |

### 8.3 V3 UI kararları

| Karar | |
|-------|--|
| Açık tema, kurumsal ERP/admin | |
| Küçük typography, DM Sans | |
| Sidebar + topbar AppShell | |
| Kompakt tablo/kart | |
| Hero / landing / glow **yok** | |

### 8.4 V2’den alınabilir (mantık)

Yalnızca **modal/popup akış mantığı** → [12-modal-flow-inventory.md](./12-modal-flow-inventory.md).

---

## 9. Database carry/drop

| V2 | V3 |
|----|-----|
| `database/patch-*.js` | **Taşınmaz** |
| Eksik kolon savunma kodları | Forward-fix migration |
| Schema drift workaround | Tek `schema_migrations` |
| m² legacy kolonlar | Unit-cost şema |
| `SYSTEM` currency | Kaldırıldı |
| Karışık patch zinciri | Checksum + fail-stop |

| V3 ([03](./03-migration-module-registry.md)) | |
|-----------------------------------------------|--|
| `schema_migrations`, `migration_runs` | |
| SQL dosyaları, checksum | |
| `seeds/` ayrı | |
| `modules:register` manifest | |

**V2 veritabanı dump’ı** canlı migrasyon için ayrı proje fazı (Gate 0 dışı).

---

## 10. Permission carry/drop

### 10.1 Taşınacak fikir

- Granular `perm_key`
- API `requirePermission`
- Maaş / stok maliyet / finans **redaction**

### 10.2 Taşınmayacak

- `module.*` ile hassas veri erişimi
- Frontend-only permission
- Boş perm listesiyle gevşek UI
- V2 permission panel kırıkları

### 10.3 V3 ([01](./01-permission-role-position-blueprint.md))

```text
super_admin → role → position → user_permissions (istisna only)
Backend requirePermission (asıl güvenlik)
PermissionGate (UI only)
Registry pasif → menü gizli + API 403
```

---

## 11. Currency carry/drop

### 11.1 Taşınacak ihtiyaç

- UZS + USD birlikte raporlama
- Satınalma satır `currency` + `fx_rate`
- HR maaş orijinal currency

### 11.2 Taşınmayacak

- Hardcoded para birimi
- `SYSTEM` alias
- Frontend kur/tutar hesabı
- Transaction currency ezilmesi

### 11.3 V3 ([05](./05-country-currency-language.md))

- `transaction` / `local` / `base`
- `fx_snapshot_at`
- Backend `MoneyService`
- `local_currency` Gate 1 read-only config

---

## 12. HR carry/drop

| | |
|--|--|
| **Taşı** | Profil, salary split, compensation history, puantaj, payroll snapshot, redaction |
| **Yeniden tasarla** | Vardiya (C+B), `start_datetime`/`end_datetime`, AttendanceEngine, WageEngine, test vectors |
| **Bırak** | Frontend wage math, `module.hr` maaş görünürlüğü, 100’lük saat, eksik `termination_date` |

---

## 13. Stock carry/drop

| | |
|--|--|
| **Taşı** | Product master, marka/kategori/birim, depo, hareketler, negatif engel, FIFO fikri, mal kabul ayrımı |
| **Yeniden tasarla** | Unit-cost FIFO, Stok Kontrol ekranı, manuel talep+onay (P5-C), envanter/zimmet ayrımı |
| **Bırak** | m² ana maliyet, ürün sayfasında stok, list price fallback, `cost_uzs_per_m2`, `qty_m2_remaining` |

---

## 14. Purchasing carry/drop

| | |
|--|--|
| **Taşı** | PR/PO, onay, price≠complete, satır supplier/price/fx, partial receipt, GR |
| **Yeniden tasarla** | Status eksenleri, pending cost, price revision/finalization, product popup perm (P6) |
| **Bırak** | Placeholder complete, status karışımı, `module.purchasing` onay, fiyat→stok artışı |

---

## 15. Finance carry/drop

V2’de **tam finance modülü yok** → V3 finance **sıfırdan** ([09](./09-finance-data-contract.md)).

| Kaynak (V2 parçaları) | V3 kullanım |
|------------------------|-------------|
| Purchasing price / fx | Invoice matching, finalization |
| Stock pending cost | CostPort / finance list |
| HR payroll snapshot | Employee advance (F5) |
| Proje UZS/USD gösterim | Raporlama ihtiyacı |

| Bırak | |
|-------|--|
| Frontend finance math | |
| Hardcoded dashboard totals | |
| Resmi muhasebe kapsamı Gate 0’da | |

---

## 16. Test stratejisi

Her taşınan iş kuralı için:

| Adım | Çıktı |
|------|--------|
| V2 davranış gözlemi | UAT notu / ekran kaydı |
| V3 expected behavior | Domain spec + bu belge |
| Test vektör | `docs/v3-spec/fixtures/*.json` |
| Gate test case | HT / ST / PT / FT / IT |

| Örnek fixture | Modül |
|---------------|--------|
| `hr-wage-vectors.json` | HR WageEngine |
| `hr-attendance-vectors.json` | AttendanceEngine (C+B) |
| `stock-fifo-vectors.json` | Stock FIFO |
| `purchasing-complete-vectors.json` | PO complete validation |
| `pending-cost-vectors.json` | Pending / final cost |
| `permission-redaction-vectors.json` | API redaction |

---

## 17. Anti-pattern / yasaklar

| # | Yasak |
|---|--------|
| 1 | V2 dosyasını komple kopyalama |
| 2 | “Önce kopyala sonra temizleriz” |
| 3 | `style.css` taşıma |
| 4 | `patch-*.js` zinciri taşıma |
| 5 | Frontend hesap motoru taşıma |
| 6 | Hardcoded navigation taşıma |
| 7 | V2 bug’ını feature sanma |
| 8 | V2 workaround’ını V3 mimarisi yapma |
| 9 | Gate belgesi FROZEN olmadan kod yazma |
| 10 | V2 repo içine V3 kodu yazma |
| 11 | Integration Map portlarını bypass eden direct SQL |

---

## 18. Açık kararlar

| # | Karar | Durum |
|---|--------|--------|
| **V2C1** | Hangi test verileri V2’den alınacak? | Açık |
| **V2C2** | Hangi V2 ekranları UAT referansı? | ÖNERİLDİ — [v2-reference-index](./v2-reference-index.md) §12 (gate bazlı UAT listesi) |
| **V2C3** | V2 canlı + V3 paralel karşılaştırma | Açık |
| **V2C4** | Demo seed V2’den taşınır mı? | Açık |
| **V2C5** | V2 bug listesi → “do not port” listesi | Öneri: evet, ayrı takip |

---

## 19. Kabul kriterleri (Gate 0)

- [ ] V2’nin **referans** rolü onaylandı (§1)
- [ ] V2 kodunun **kopyalanmayacağı** onaylandı (§2, §4)
- [ ] Carry/drop tablosu onaylandı (§7)
- [ ] UI/CSS taşıma **yasağı** onaylandı (§8)
- [ ] Patch taşıma **yasağı** onaylandı (§9)
- [ ] m² legacy taşıma **yasağı** onaylandı (§4, §13)
- [ ] Permission / currency / frontend hesap borçları **taşınmaz** (§10, §11, §4)
- [ ] Modül bazlı port stratejisi onaylandı (§6, §12–15)
- [ ] Test stratejisi onaylandı (§16)
- [ ] Açık kararlar V2C1–V2C5 işaretlendi (§18)
- [ ] [10-integration-map.md](./10-integration-map.md) ile çelişki yok
- [ ] **Durum: FROZEN** (henüz değil)

**Gate 0 kuralı:** Bu belge + Gate 0 PASS olmadan **`F:\FactoryOS-V3` repo açılmaz** ve V3 kodu yazılmaz.

---

## 20. Belge durumu

**Durum: TASLAK / İNCELEME** — Henüz FROZEN değil.

**Sonraki önerilen adım:** [v2-reference-index.md](./v2-reference-index.md) ✓ — HR fixture / Gate 0 PASS
