# FactoryOS V3 — Finance Tracking Data Contract

**Belge türü:** Gate 0 platform / domain sözleşmesi  
**Modül adı:** **Finans Kontrol** / **Operational Finance Control**  
**Operasyonel tanım (Gate 0 otorite):** [09-finance-operational-control-blueprint.md](./09-finance-operational-control-blueprint.md)  
**Durum:** ☑ **Gate 0 KABUL (PASS adayı)** | ☐ FROZEN  
**Versiyon:** 1.2.0  
**Son güncelleme:** 19.05.2026 (Gate 0 kapanış; operasyonel finans kararları)  
**Uygulama gate:** Gate 5 (kod); Gate 0 yalnızca sözleşme  
**Ürün:** FactoryOS V3 · V2 referans only (kod kopyalanmaz)

**Önemli:** Bu modül **resmi muhasebe defteri değildir**. Operasyonel kasa, banka, kart, nakit, gayri resmi kasa, avans, ödeme onayı, proje gideri, genel gider ve kur kontrol modülüdür. İleride resmi muhasebe entegrasyonu için veri sözleşmesi kurar.

**Platform bağımlılıkları:**

- [05-country-currency-language.md](./05-country-currency-language.md) — Money, snapshot
- [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) — FIFO, pending_cost, cost redaction
- [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) — PO, fatura, P2/P3
- [06-hr-full-blueprint.md](./06-hr-full-blueprint.md) — employee_advances, party link
- [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) — redaction
- [03-migration-module-registry.md](./03-migration-module-registry.md)
- [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md)

---

## 1. Amaç

FactoryOS V3 **Finance Tracking** şunları kapsar:

| Alan | Açıklama |
|------|----------|
| Cari (parties) | Tedarikçi, müşteri, personel, iç cari |
| Faturalar | Satınalma / manuel / proje kaynaklı |
| Ödemeler & tahsilatlar | Nakit/banka hareketleri |
| Tahsis (allocation) | Ödeme ↔ fatura eşleme |
| Avanslar | Personel avans hazırlığı (HR) |
| Pending cost | Stok maliyeti çözümü |
| Price finalization | PO ↔ fatura farkı |
| Borç / alacak | Operasyonel bakiye |
| Dashboard | Vade, pending cost, para birimi özetleri |

**Değildir:** TFRS/UFRS defter, e-defter, vergi beyanı, tam çift taraflı muhasebe fişi (Gate 0 kapsam dışı).

**Gate 0 çıktısı:** Bu belge FROZEN olmadan Gate 5 finance migration ve API **yazılmaz**.

### 1.1 Gate 0 operasyonel kararlar (özet)

Tam metin: [09-finance-operational-control-blueprint.md](./09-finance-operational-control-blueprint.md).

| Karar | Özet |
|--------|------|
| Satınalma → finans | Satınalma tamamlanınca kasa düşmez; ödeme yükümlülüğü/talep; Finance onayı → `finance_transaction` |
| Hesap türleri | Resmi banka/kasa, gayri resmi nakit, kart, petty cash, avans kasası, proje küçük gider kasası — ayrı |
| Ödeme vs gider | Ödeme yöntemi ≠ gider nedeni |
| Landed cost | İthalat kalemleri ayrı bağlantı; nakitleştirme komisyonu ayrı hareket |
| Kur | İşlem snapshot; dashboard bilgi amaçlı |
| Ay kapanışı | Operasyonel kilitleme; kapanmış aya sessiz düzeltme yok; adjustment sonraki ay |

---

## 2. Kapsam

| # | Alan | Gate |
|---|------|------|
| 1 | Parties / cari kartlar | Gate 5 MVP |
| 2 | Supplier bağlantısı | Gate 5 |
| 3 | Customer bağlantısı | Gate 5 |
| 4 | Employee party hazırlığı | Gate 5 / HR |
| 5 | Invoices + lines | Gate 5 |
| 6 | Payments | Gate 5 |
| 7 | Payments (OUT) / Tahsilat (IN) | Gate 5 MVP — `payment_direction` |
| 8 | Payment allocations | Gate 5 |
| 9 | Employee advances (basit) | **Gate 5 MVP** (F5) |
| 9b | Bank / kasa hesapları (minimal) | **Gate 5 MVP** (F6) |
| 10 | Purchase invoice matching | Gate 5 |
| 11 | Price finalization | Gate 5 |
| 12 | Pending cost resolution | Gate 5 |
| 13 | Supplier balance | Gate 5 |
| 14 | Project finance link | Hazırlık |
| 15 | Currency snapshot | Tüm belgeler |
| 16 | Audit log | Platform |
| 17 | Permission / redaction | Gate 1 seed |
| 18 | Finance dashboard | Gate 5 |

### 2.1 Kapsam dışı (yazılı)

- Resmi muhasebe defteri, yevmiye, mizan
- E-fatura / e-arşiv entegrasyonu (ileride)
- Gelişmiş çek/senet portföyü
- Vergi beyannamesi üretimi
- Banka mutabakatı / otomatik banka entegrasyonu (F6 sonrası — MVP yalnızca hesap seçimi)

---

## 3. Ana ayrım

| Katman | Tanım |
|--------|--------|
| **Finance tracking** | Operasyonel borç/alacak, fatura, ödeme, pending cost |
| **Resmi muhasebe** | Gate 0 **dışı** — harici sistem veya ileride modül |

| İlke | Detay |
|------|--------|
| Her finansal kayıt | Orijinal + local + base + FX snapshot |
| Stok maliyeti | FIFO katmanı ([07](./07-stock-full-blueprint.md)) |
| Satınalma fiyatı | PO satırı ([08](./08-purchasing-full-blueprint.md)) |
| Fatura fiyatı | Finance belgesi — son operasyonel kesinleşme adayı |

**Karıştırma yasak:** Fiyat kaydetme (satınalma) ≠ finansal kesinleşme ≠ resmi muhasebe kaydı.

---

## 4. [05] Currency belgesiyle uyum

Her finansal hareket ve belge satırı **Money** sözleşmesine uyar:

| Alan | Açıklama |
|------|----------|
| `amount_transaction` | Orijinal tutar |
| `transaction_currency` | ISO 4217 — **ezilmez** |
| `fx_rate_to_local` | İşlem anı |
| `amount_local` | `local_currency` snapshot |
| `fx_rate_to_base` | İşlem anı |
| `amount_base` | `base_reporting_currency` snapshot |
| `fx_snapshot_at` | DATETIME |

| Kural | Detay |
|-------|--------|
| USD fatura | `transaction_currency = USD` kalır |
| UZS ödeme | UZS kalır |
| Hesaplama | Backend **FinanceEngine** / MoneyService |
| Frontend | Finans aritmetiği **yasak** (FT-17) |

---

## 5. Entity sözleşmeleri (Gate 0 kontrat)

Tam SQL Gate 5 migration’da.

### 5.1 `parties`

Bkz. §6.

### 5.2 `party_contacts`

| Alan | Tip |
|------|-----|
| id | PK |
| party_id | FK |
| name, phone, email, role | |
| is_primary | bool |

### 5.3 `supplier_accounts` (opsiyonel alt tablo)

| Alan | Not |
|------|-----|
| supplier_id | FK → [08](./08-purchasing-full-blueprint.md) suppliers |
| party_id | FK → parties |
| payment_terms | |
| credit_limit | opsiyonel |

### 5.4 `customer_accounts`

| Alan | Not |
|------|-----|
| customer_id | FK (proje/satış hazırlık) |
| party_id | FK |

### 5.5 `invoices`

Bkz. §8.

### 5.6 `invoice_lines`

| Alan | Tip |
|------|-----|
| id | PK |
| invoice_id | FK |
| description | string |
| quantity | decimal? |
| unit_code | string? |
| amount_transaction | decimal |
| transaction_currency | char(3) |
| amount_local, amount_base | decimal |
| source_line_type, source_line_id | PO line, GR line, … |

### 5.7 `payments`

Bkz. §11.

### 5.8 `payment_allocations`

| Alan | Tip |
|------|-----|
| id | PK |
| payment_id | FK |
| invoice_id | FK |
| allocated_amount_transaction | decimal |
| transaction_currency | char(3) |
| amount_local, amount_base | snapshot |
| allocated_at | datetime |

### 5.9 `advances` (Gate 5 MVP — F5)

| Alan | Tip |
|------|-----|
| id | PK |
| employee_id | FK |
| party_id | FK? |
| advance_date | date |
| amount_transaction | decimal |
| transaction_currency | char(3) |
| amount_local, amount_base | |
| status | draft / approved / paid / settled |
| source_type | HR_ADVANCE |
| audit | |

HR: [06](./06-hr-full-blueprint.md) §5.12. Tam maaş ödeme / muhasebe entegrasyonu **sonraki faz**.

### 5.10 `finance_movements` (operasyonel ledger — F1)

Bkz. §14.

### 5.11 `pending_costs` (finance görünümü)

Stok/satınalma ile paylaşımlı veya senkron view:

| Alan | Not |
|------|-----|
| order_line_id, goods_receipt_line_id | |
| cost_layer_id | |
| status | open / resolved |
| resolution_type | price_entered / finalization / correction |
| resolved_by, resolved_at | |

### 5.12 `price_finalizations` (F4 — iki aşamalı)

| Alan | Tip |
|------|-----|
| id | PK |
| source_type | PURCHASE_ORDER, INVOICE, … |
| source_id | |
| party_id | FK |
| previous_amount_transaction | |
| finalized_amount_transaction | |
| transaction_currency | |
| variance_amount | |
| status | draft / pending_finance_approval / finalized / rejected |
| initiated_by | FK user (Gate 4 satınalma) |
| approved_by | FK user (Gate 5 finance) |
| finalized_at | datetime |
| triggers_correction | bool |

### 5.13 `bank_accounts` (Gate 5 MVP — F6)

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| account_code | string | UNIQUE |
| account_name | string | Kasa / banka adı |
| account_type | cash / bank | |
| currency_code | char(3) | Hesap para birimi |
| is_active | bool | |
| audit | timestamps | |

**MVP:** Ödeme/tahsilat kaydında `bank_account_id` seçimi. Mutabakat / API entegrasyonu **sonra**.

### 5.14 `finance_settings`

| Anahtar | Örnek |
|---------|--------|
| default_payment_terms_days | 30 |
| overdue_warning_days | 7 |
| auto_allocate_payment | false |
| pending_cost_purchasing_can_resolve | true (F3) |
| final_cost_requires_finance_approve | true (F3) |

---

## 6. Parties / cari kartlar

### 6.1 `party_type`

| Değer | Kullanım |
|-------|----------|
| supplier | Tedarikçi cari |
| customer | Müşteri cari |
| employee | Personel cari |
| internal | İç şirket / kasa |
| other | Diğer |

### 6.2 Alanlar

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| party_code | string | UNIQUE |
| party_type | enum | |
| display_name | string | toUpperTr |
| tax_id | string? | |
| country_code | char(2) | [05](./05-country-currency-language.md) |
| phone, email, address | | |
| is_active | bool | |
| audit | timestamps | |

### 6.3 Marka / tedarikçi ayrımı

[07](./07-stock-full-blueprint.md) S1, [08](./08-purchasing-full-blueprint.md) §17:

- **brand** = ürün markası  
- **supplier** = satın alınan firma (operasyonel)  
- **party** = finansal cari  

**FT-21** ile supplier-party ayrımı doğrulanır.

---

## 7. Supplier finance link

| Katman | Entity | Rol |
|--------|--------|-----|
| Operasyonel | `suppliers` ([08](./08-purchasing-full-blueprint.md)) | Sipariş, mal kabul |
| Finansal | `parties` (type=supplier) | Borç/alacak, fatura, ödeme |

| Kural | Detay |
|-------|--------|
| Bağlantı | `suppliers.party_id` → `parties.id` |
| Borç/alacak | **party** üzerinden `finance_movements` |
| Oluşturma | Supplier create sırasında veya sonra party bağlama |

**FT-01, FT-02**

---

## 8. Invoice model

### 8.1 `invoices` header

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| invoice_no | string | UNIQUE |
| party_id | FK | |
| source_type | enum | §8.2 |
| source_id | bigint? | |
| invoice_date | date | |
| due_date | date? | |
| status | draft / posted / paid / partial / cancelled | |
| amount_transaction | decimal | Header toplam |
| transaction_currency | char(3) | |
| amount_local, amount_base | decimal | |
| fx_rate_to_local, fx_rate_to_base | decimal | |
| fx_snapshot_at | datetime | |
| notes | string? | |
| audit | | |

### 8.2 `source_type`

| Değer | Kaynak |
|-------|--------|
| PURCHASE_ORDER | PO referans |
| PURCHASE_RECEIPT | Mal kabul referans |
| MANUAL | Elle fatura |
| PROJECT | Proje gideri |
| OTHER | |

### 8.3 İş kuralları (F1)

| Kural | Detay |
|-------|--------|
| **Invoice = belge** | Fatura kaydı `invoices` + `invoice_lines` |
| **Posted** | `status → posted` olunca **`finance_movement` üretilir** (AP borç veya AR alacak) |
| finance_movements | Operasyonel borç/alacak özeti — fatura silinmez, hareket terslenir |
| Silme | Void/cancel — fiziksel silme yok |
| Düzeltme | Ters `finance_movement` veya correction |

```text
invoice.create → draft
invoice.post   → finance_movement (source_type=INVOICE, source_id)
payment        → finance_movement (source_type=PAYMENT)
```

**FT-03, FT-04, FT-05**

---

## 9. Purchase invoice matching

Satınalma ↔ finance üçlü gerçeklik:

| Adım | Modül | Gerçeklik |
|------|--------|-----------|
| PO fiyatı | Satınalma | Sipariş fiyatı |
| Mal kabul | Stok | Fiziksel miktar |
| Fatura | Finance | Son finansal belge (operasyonel) |

| Kural | Detay |
|-------|--------|
| Fatura ≠ PO fiyatı | İzin verilir → `price_finalization` / revision |
| Depocu | Fiyat **değiştirmez** ([08](./08-purchasing-full-blueprint.md) PT-18) |
| İşleyen (F4) | Gate 4: satınalma **başlatır**; Gate 5: finance **onay/finalize** |
| Stok katmanı | Final cost kesinleşince correction (P2) |

**FT-16**

---

## 10. Pending cost resolution (F3)

[07](./07-stock-full-blueprint.md) §14, [08](./08-purchasing-full-blueprint.md) §15, **P2** ile uyumlu:

```text
Mal kabul (fiyatsız) → stock_cost_layer.pending_cost = true
  → Basit PO fiyat tamamlama (henüz final değil) → satınalma: auditli layer UPDATE
  → Final cost kesinleşmesi → finance onayı + price_finalization
  → Kesinleşmiş fiyat değişimi → CORRECTION record
```

### 10.1 F3 — Kim ne çözer?

| Durum | Sorumlu | Permission |
|-------|---------|------------|
| **pending cost** (fiyat henüz operasyonel tamamlanmış, final değil) | **Satınalma** | `purchasing.order.price.edit` + stok pending flag |
| **final cost** (tutar kesinleşiyor, finance onayı) | **Finance** | `finance.pending_cost.resolve` + onay |
| Liste / dashboard | Finance + satınalma | `finance.pending_cost.view` |

| Kural | Detay |
|-------|--------|
| pending cost | Satınalma çözebilir (PO fiyat kaydet / basit tamamlama) |
| final cost | **Finance onayı gerekir** |
| Ayar | `final_cost_requires_finance_approve = true` |

**FT-08, FT-09, FT-10**

---

## 11. Payment & collection model (F2)

Tek tablo: `payments`. Tahsilat ayrı entity **değil**.

### 11.1 `payments`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| party_id | FK | |
| payment_direction | enum | **OUT** = ödeme (tedarikçi), **IN** = tahsilat (müşteri) — F2 |
| payment_date | date | |
| method | cash / bank_transfer / card / other | |
| bank_account_id | FK | → `bank_accounts` (F6 MVP) |
| amount_transaction | decimal | |
| transaction_currency | char(3) | |
| amount_local, amount_base | decimal | |
| fx_rate_to_local, fx_rate_to_base | | |
| fx_snapshot_at | datetime | |
| source_type | MANUAL, ADVANCE, … | |
| source_id | | |
| notes | string? | |
| audit | | |

### 11.2 `payment_allocations`

| Kural | Detay |
|-------|--------|
| Kısmi ödeme | Birden fazla faturaya veya kısmi tutar |
| Kalan bakiye | `invoice` açık tutar güncellenir |
| Snapshot | Allocation anı FX |

**FT-06, FT-07, FT-13**

---

## 12. UI: Ödeme vs Tahsilat (F2)

| UI menü | `payment_direction` | party_type tipik |
|---------|---------------------|------------------|
| Ödemeler | OUT | supplier |
| Tahsilatlar | IN | customer |

Aynı `payments` tablosu; registry’de ayrı sayfa (`finance.payments` / `finance.collections`) — kullanıcı deneyimi ayrı, veri modeli birleşik.

**Permission:** `finance.payments.*` (OUT), `finance.collections.*` (IN) — API aynı endpoint filtreli.

---

## 13. Employee advances (F5 — Gate 5 MVP)

| İlke | Detay |
|------|--------|
| Kapsam | **Basit employee advance** Gate 5 MVP’de |
| HR | [06](./06-hr-full-blueprint.md) `employee_advances` |
| Party | `employees` → `parties` (type=employee) |
| Akış | Talep → onay → ödeme (`payment_direction=OUT`, source=ADVANCE) |
| Sonra | Tam maaş ödeme, bordro entegrasyonu, resmi muhasebe |

**FT-15**

---

## 14. Finance movements ledger (F1)

**Invoice ile ayrı entity.** Fatura = belge; `finance_movements` = operasyonel borç/alacak hareketi.

**Operasyonel defter** — resmi muhasebe fişi değil.

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| movement_type | AP_INVOICE, AP_PAYMENT, AR_INVOICE, AR_COLLECTION, ADJUSTMENT, … | |
| party_id | FK | |
| debit_amount_transaction | decimal? | Politika: tek tutar + sign da olabilir |
| credit_amount_transaction | decimal? | |
| amount_transaction | decimal | Net (tercih edilen basit model) |
| transaction_currency | char(3) | |
| amount_local, amount_base | | |
| source_type, source_id | invoice, payment, … | |
| movement_date | date | |
| audit | | |

| Kural | Detay |
|-------|--------|
| Çift taraflı TFRS | Gate 0 **zorunlu değil** |
| Supplier balance | SUM açık hareketler party bazlı |
| Immutable | Düzeltme = ters hareket |
| F1 üretim | `invoice.posted` → `movement_type` AP_INVOICE veya AR_INVOICE |

---

## 15. Dashboard / reports

| Widget / rapor | Permission |
|----------------|------------|
| Tedarikçi borçları (AP) | `finance.reports.view` + sensitive |
| Müşteri alacakları (AR) | |
| Vadesi yaklaşan faturalar | |
| Pending cost toplamı | `finance.pending_cost.view` |
| Para birimi bazlı özet | |
| Local / base toplamlar | `finance.sensitive_amounts.view` |
| Proje bazlı finans (hazırlık) | `project_id` on invoice/movement |

**FT-12, FT-14**

---

## 16. Permissions

### 16.1 Modül kapısı

| perm_key | Not |
|----------|-----|
| module.finance | Menü — hassas tutar için **yeterli değil** |

### 16.2 Örnek manifest

| perm_key | Açıklama |
|----------|----------|
| finance.hub.view | Hub |
| finance.parties.view / .create / .edit | Cari |
| finance.invoices.view / .create / .edit | Fatura |
| finance.payments.view / .create | Ödeme |
| finance.collections.view / .create | Tahsilat |
| finance.pending_cost.view / .resolve | Pending cost |
| finance.price_finalization.view / .create | Kesinleşme |
| finance.reports.view | Raporlar |
| finance.sensitive_amounts.view | Tutarlar, toplamlar, bakiye |
| finance.settings.view / .edit | Ayarlar |
| finance.bank_accounts.view / .edit | Kasa/banka hesabı (F6) |
| finance.price_finalization.approve | Finalize onay (F4) |

### 16.3 Redaction

`finance.sensitive_amounts.view` **yoksa:**

- `amount_*`, bakiye, borç/alacak toplamları → omit / `_redacted`
- Dashboard KPI tutarları gizlenir

**FT-11, FT-12** — [01](./01-permission-role-position-blueprint.md) §14 ile aynı felsefe.

---

## 17. UI / modal flows

[00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md): açık tema, kompakt tablo, AppShell, hero yok.

| flowId | Açıklama |
|--------|----------|
| finance.party.create | Cari kart |
| finance.party.edit | |
| finance.invoice.create | Fatura |
| finance.invoice.matchPurchase | PO/GR eşleme |
| finance.payment.create | Ödeme |
| finance.payment.allocate | Faturaya tahsis |
| finance.collection.create | Tahsilat |
| finance.pendingCost.resolve | Pending cost kapat |
| finance.priceFinalization.create | Fiyat kesinleşme |
| finance.report.filter | Rapor filtre |

### 17.1 Sayfa kayıtları (registry örnek)

| page_key | Açıklama |
|----------|----------|
| finance.hub | Modül giriş |
| finance.parties | Cari listesi |
| finance.invoices | Faturalar |
| finance.payments | Ödemeler |
| finance.pending_cost | Bekleyen maliyetler |
| finance.reports | Raporlar |
| finance.payments | Ödemeler (OUT) |
| finance.collections | Tahsilatlar (IN) — aynı `payments` tablosu |
| finance.bank_accounts | Kasa/banka tanımı |

---

## 18. V2 referans noktaları

V2’de tam finance modülü **yok**; hook ve teknik borç:

| Konu | V2 referans |
|------|-------------|
| Satınalma fiyat / FX | `purchasingService.js` — satır currency, `recalculateCostLayersForOrderId` |
| Pending cost ihtiyacı | GR + cost layer — m² model ([07](./07-stock-full-blueprint.md) ters örnek) |
| HR payroll snapshot | `employee_month_payroll_snapshot` — finans ödeme hazırlığı |
| Proje maliyet gösterimi | `project` ekranları — UZS/USD format |
| Dashboard | `dashboardService.js` — hardcoded FIFO m² değerleme |
| Para formatlama | Frontend — V3: backend snapshot + i18n display |

**Sıfırdan** finance entity’leri; iş kuralları 07/08/05/06 belgelerinden türetilir.

---

## 19. V2’den taşınmayacaklar

| V2 / anti-pattern | V3 |
|-------------------|-----|
| Hardcoded UZS/USD hesap | MoneyService + config |
| Frontend finans hesabı | FinanceEngine backend |
| Fiyat kaydet = kesinleşme | Ayrı price_finalization |
| Stok maliyeti = fatura aynı işlem | Katman + belge ayrımı |
| Eksik fx snapshot | Zorunlu alanlar §4 |
| `module.finance` geniş yetki | `finance.sensitive_amounts.view` |
| m² FIFO değerleme | Unit-cost ([07](./07-stock-full-blueprint.md)) |
| `SYSTEM` currency | Kaldırıldı ([05](./05-country-currency-language.md)) |

---

## 20. Test / doğrulama senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| FT-01 | Supplier party | party_type=supplier |
| FT-02 | supplier.party_id | Bağlantı |
| FT-03 | USD fatura | currency USD korunur |
| FT-04 | UZS fatura | UZS korunur |
| FT-05 | Fatura snapshot | local + base dolu |
| FT-06 | Payment allocate | invoice bakiye düşer |
| FT-07 | Partial payment | Kalan > 0 |
| FT-08 | Pending cost list | open kayıtlar |
| FT-09 | Fiyat gelince çözüm | pending_cost resolved |
| FT-10 | Kesinleşmiş fiyat değişimi | correction zorunlu |
| FT-11 | Finance perm yok | Redaction |
| FT-12 | sensitive_amounts yok | Toplamlar gizli |
| FT-13 | Supplier balance | party SUM doğru |
| FT-14 | Overdue invoice | Raporda |
| FT-15 | Employee advance | HR employee_id link |
| FT-16 | Fatura ≠ PO | price_finalization |
| FT-17 | Frontend hesap | Yok |
| FT-18 | Responsive | 1366/1024/768 |

---

## 21. Riskler

| Risk | Azaltma |
|------|---------|
| Resmi muhasebe gibi tasarım | §3, §2.1; scope disiplini |
| FX snapshot eksik | §4 zorunlu alan; FT-05 |
| Pending cost takılı | §10; FT-08–10; [08](./08-purchasing-full-blueprint.md) P2 |
| Fatura vs PO karışımı | §9; FT-16 |
| Sensitive sızıntı | §16.3; FT-11/12 |
| Frontend hesap | FT-17; lint |
| Gate 5 şişmesi | F5, F6 fazlama; MVP kesimi |

---

## 22. Açık kararlar

| # | Karar | Durum | Önerilen karar |
|---|--------|--------|----------------|
| **F1** | Invoice vs finance_movements | **ÖNERİLDİ** | **Ayrı.** Invoice = belge; `finance_movements` = operasyonel hareket. Fatura **posted** olunca movement üretilir (§8.3, §14) |
| **F2** | Collection modeli | **ÖNERİLDİ** | `payments` + `payment_direction`: **OUT** ödeme, **IN** tahsilat. UI’da ayrı menü (§11, §12) |
| **F3** | pending_cost onayı | **ÖNERİLDİ** | **pending cost** → satınalma çözebilir; **final cost** → finance onayı (§10) |
| **F4** | price_finalization | **ÖNERİLDİ** | İki aşamalı: Gate 4 satınalma başlatır; Gate 5 finance onay/finalize (§5.12, §9) |
| **F5** | employee_advances | **ÖNERİLDİ** | **Basit avans Gate 5 MVP**; tam maaş ödeme sonraya (§13) |
| **F6** | bank_accounts | **ÖNERİLDİ** | **Minimal Gate 5 MVP** — hesap seçimi; mutabakat/entegrasyon sonra (§5.13) |

Resmi kapanış: FROZEN öncesi inceleme onayı.

**Çapraz:** [08](./08-purchasing-full-blueprint.md) P2/P3 ile uyumlu.

---

## 23. Kabul kriterleri (Gate 0)

**Gate 0 PASS adayı (19.05.2026):** Operasyonel finans kararları [09-finance-operational-control-blueprint.md](./09-finance-operational-control-blueprint.md) §2–§7 ile kapatıldı. **FROZEN** kullanıcı onayı bekleniyor.

- [x] Finance tracking’in **resmi muhasebe olmadığı** onaylandı (§1, §3; operasyonel blueprint §1)
- [ ] Money model transaction/local/base onaylandı (§4, [05](./05-country-currency-language.md))
- [ ] Party modeli onaylandı (§6)
- [ ] Supplier–party bağlantısı onaylandı (§7)
- [ ] Invoice / payment / allocation modeli onaylandı (§8, §11)
- [ ] Pending cost resolution onaylandı (§10, [07](./07-stock-full-blueprint.md), [08](./08-purchasing-full-blueprint.md))
- [ ] Price finalization modeli onaylandı (§5.13, §9)
- [ ] Sensitive amount redaction onaylandı (§16)
- [ ] FT-01…FT-18 test planına aktarıldı
- [ ] F1–F6 önerilen kararlar inceleme onayı (§22)
- [ ] Invoice posted → finance_movement kuralı onaylandı (§8.3)
- [ ] payment_direction OUT/IN modeli onaylandı (§11–12)
- [ ] F3 pending vs final cost ayrımı onaylandı (§10)
- [ ] F4 iki aşamalı price finalization onaylandı (§5.12)
- [ ] F5 basit avans Gate 5 MVP onaylandı (§13)
- [ ] F6 minimal bank_accounts Gate 5 MVP onaylandı (§5.13)
- [ ] **Durum: FROZEN** (kullanıcı nihai onayı bekleniyor)

**Gate 0 kuralı:** Bu belge **FROZEN** olmadan finance modül kodu **yazılmaz**.

---

## 24. Belge durumu

**Durum: Gate 0 KABUL (PASS adayı)** — Henüz **FROZEN değil**. Operasyonel kararlar: [09-finance-operational-control-blueprint.md](./09-finance-operational-control-blueprint.md).

**Sonraki önerilen spec:** [11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md) (entegrasyon: [10](./10-integration-map.md))
