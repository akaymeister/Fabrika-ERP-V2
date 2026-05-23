# FactoryOS V3 — Purchasing Full Blueprint (Satınalma)

**Belge türü:** Gate 0 domain spec  
**Durum:** ☐ TASLAK | ☑ İNCELEME | ☐ FROZEN  
**Versiyon:** 1.1.0  
**Son güncelleme:** 19.05.2026 (P1–P6 önerilen kararlar)  
**V2 çalışma oranı (referans):** ~%95 iş kuralı korunur  
**Ürün:** FactoryOS V3 · V2 referans only (kod kopyalanmaz)

**İlişkili domain belgeleri:**

- [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) — mal kabul, FIFO, ürün popup, P5
- [05-country-currency-language.md](./05-country-currency-language.md) — satır bazlı Money
- [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) — approval, redaction
- [03-migration-module-registry.md](./03-migration-module-registry.md) — migration
- [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) — AppShell, modal
- [09-finance-data-contract.md](./09-finance-data-contract.md) — fatura / ödeme hazırlığı (Gate 0 devam)
- [12-modal-flow-inventory.md](./12-modal-flow-inventory.md) — flowId

---

## 1. Amaç

FactoryOS V3 **Satınalma** modülü “mini satınalma” veya yalnızca sipariş listesi **değildir**. Modül şunları kapsar:

| Süreç | Açıklama |
|--------|----------|
| Satınalma talebi | İhtiyaç bildirimi |
| Onay | Yetkili onay / red / revizyon |
| Sipariş (PO) | Tedarikçi, fiyat, para birimi |
| İşleme | Satınalmacı fiyatlandırma |
| Mal kabul bağlantısı | Fiziksel stok — **stok modülü** |
| Partial delivery | Kısmi teslim |
| Pending cost | Fiyatsız kabul |
| Fiyat revizyonu | Auditli düzeltme |
| Tedarikçi | Supplier master |
| Raporlama | Durum dashboard |

**İki gerçeklik (değişmez):**

| Gerçeklik | Modül | Ne tutar |
|-----------|--------|----------|
| **Finansal / sipariş** | Satınalma | Tedarikçi, fiyat, currency, sipariş durumu |
| **Fiziksel stok** | Stok (mal kabul) | Miktar, depo, hareket, FIFO katmanı |

Bu iki gerçeklik **karıştırılmaz**.

**Gate 0 çıktısı:** Bu belge FROZEN olmadan Gate 4 satınalma migration, API ve UI **yazılmaz**.

---

## 2. Kapsam

| # | Alan | Gate |
|---|------|------|
| 1 | Purchase Requests | Gate 4 MVP |
| 2 | Purchase Request Items | Gate 4 |
| 3 | Approval workflow | Gate 4 |
| 4 | Purchase Orders | Gate 4 |
| 5 | Purchase Order Lines | Gate 4 |
| 6 | Supplier selection | Gate 4 |
| 7 | Price entry | Gate 4 |
| 8 | Currency / fx_rate | Gate 4 + [05](./05-country-currency-language.md) |
| 9 | Buyer processing state | Gate 4 |
| 10 | Goods receipt integration | Gate 4 + [07](./07-stock-full-blueprint.md) |
| 11 | Partial delivery | Gate 4 |
| 12 | Over / under receive approval | Gate 4 |
| 13 | Pending cost | Gate 4 |
| 14 | Price revision | Gate 4 |
| 15 | Supplier management | Gate 4 |
| 16 | Product popup integration | Gate 4 + Gate 3 |
| 17 | Manual product create from purchasing | Gate 4 |
| 18 | Permission / redaction | Gate 1 seed |
| 19 | Audit log | Platform |
| 20 | Reporting / status dashboard | Gate 4 |

---

## 3. Ana ayrım (Satınalma ↔ Stok)

**Bu bölüm Gate 0’da zorunlu onay maddesidir.**

### 3.1 Satınalma siparişi

> **Satınalma siparişi = finansal / tedarikçi / fiyat kaydıdır.**

### 3.2 Mal kabul

> **Mal kabul = fiziksel stok hareketidir.**  
> Stok **yalnızca** mal kabul ile artar ([07](./07-stock-full-blueprint.md) §10).

### 3.3 Stok artmaz

| Olay | Stok artar mı? |
|------|----------------|
| Talep açılınca | **Hayır** |
| Talep onaylanınca | **Hayır** |
| PO oluşunca | **Hayır** |
| Fiyat girilince | **Hayır** |
| Buyer completed olunca | **Hayır** |
| Mal kabul (accepted qty) | **Evet** |

### 3.4 Çapraz kurallar ([07](./07-stock-full-blueprint.md) ile uyum)

| Kural | Kaynak |
|-------|--------|
| Ürünler sayfası stok takip değil | Stock §3 |
| Stok Kontrol ayrı ekran | Stock §13 |
| Rejected/damaged stok artırmaz | Stock §10, bu belge §14 |
| Manuel stok talep + onay (P5-C) | Stock §11 |
| Ürün çıkış `project_id` zorunlu | Stock §12 |
| FIFO unit-cost ana birim | Stock §14 |
| m²/m³ helper stok ana hesabı değil | Stock §4, §7 |
| Maliyet `stock.cost.view` | Stock §13, §22 |

---

## 4. V2’den korunacak iş kuralları

| Kural | Detay |
|-------|--------|
| Purchase request | Kullanıcı talep açar |
| Onay | Yetkili onaylar / reddeder |
| PO oluşumu | Onay sonrası sipariş |
| Satınalmacı işleme | `start-processing` benzeri |
| Tedarikçi + fiyat | Satır bazında |
| Fiyat kaydet ≠ tamamla | **Ayrı aksiyon** (V3 zorunlu) |
| Currency / fx | Satır bazında saklanır |
| Partial delivery | Çoklu mal kabul |
| Mal kabul ↔ PO | Fiş/satıra bağlı |
| pending_cost | Fiyatsız kabul |
| Fiyat sonrası | Cost layer auditli güncelleme / correction |
| Rejected/damaged | Stok artmaz |
| Mal kabul buyer completed gerektirmez | V2 düzeltmesi korunur |

---

## 5. V2’den taşınmayacaklar

| V2 sorun | V3 |
|----------|-----|
| Fiyat kaydetmenin siparişi tamamlaması | Ayrı `complete` aksiyonu |
| `buyer_state` ile `receipt_status` karışımı | Ayrı eksenler (§18) |
| Placeholder supplier ile complete | **Yasak** |
| Hardcoded `UZS` / `SYSTEM` | [05](./05-country-currency-language.md) |
| Frontend fiyat/kur hesabı | **PricingEngine** backend |
| Mal kabul = fiyatlandırma UI | Ayrı ekranlar / roller |
| Stok artışı fiyat girişine bağlı | Yalnızca mal kabul |
| Permission fallback ile onay | Explicit `purchasing.request.approve` |
| `window.prompt` GR düzenleme | Merkezi ConfirmDialog |
| İki ayrı onay UI | Tek ApprovalService |

---

## 6. Veri modeli taslağı (Gate 0 kontrat)

Tam SQL Gate 4 migration’da.

### 6.1 `purchase_requests`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| request_code | string | UNIQUE |
| requested_by | FK user | |
| department_id | FK? | |
| project_id | FK? | **Önerilen P1:** request seviyesinde opsiyonel |
| request_status | enum | §18 |
| priority | enum? | low/normal/high |
| needed_date | date? | |
| notes | string? | |
| created_at, updated_at | audit | |
| created_by, updated_by | FK | |

### 6.2 `purchase_request_items`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| request_id | FK | |
| product_id | FK | |
| product_name_snapshot | string | Onay anı |
| unit_code | string | Ana birim |
| requested_quantity | decimal | |
| description | string? | |
| project_id | FK? | **Önerilen P1:** item opsiyonel; varsa PO/satıra taşınır |
| notes | string? | |
| line_status | enum? | active/cancelled |

### 6.3 `purchase_request_approvals`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| request_id | FK | |
| approver_user_id | FK | |
| decision | approved/rejected/revision_requested |
| comment | string? |
| decided_at | datetime | |

### 6.4 `purchase_orders`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| order_code | string | UNIQUE |
| request_id | FK? | |
| supplier_id | FK | Header default; satır override olabilir |
| buyer_user_id | FK | |
| order_status | enum | §18 |
| buyer_state | enum | §18 — **ayrı** |
| receipt_status | enum | §18 — **ayrı** |
| price_status | enum | §18 — **ayrı** |
| currency_summary | string? | Raporlama |
| order_date, delivery_date | date | |
| notes | string? | |
| audit | timestamps | |

### 6.5 `purchase_order_lines` (V2: `purchase_order_items`)

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| order_id | FK | |
| product_id | FK | |
| request_item_id | FK? | |
| ordered_quantity | decimal | |
| received_quantity | decimal | |
| remaining_quantity | decimal | türetilmiş veya saklı |
| unit_code | string | Ürün ana birimi |
| supplier_id | FK | Satır tedarikçi |
| unit_price | decimal? | |
| currency_code | char(3) | Orijinal |
| fx_rate_to_local | decimal | |
| fx_rate_to_base | decimal | |
| line_total_transaction | decimal | |
| line_total_local | decimal | Snapshot |
| line_total_base | decimal | Snapshot |
| price_status | enum | missing/priced |
| pending_cost | bool | |
| receipt_status | enum? | satır düzeyi (opsiyonel) |
| notes | string? | |

### 6.6 `purchase_order_price_revisions`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| order_line_id | FK | |
| previous_unit_price | decimal | |
| new_unit_price | decimal | |
| currency_code | char(3) | |
| reason | string | |
| revised_by | FK user | |
| revised_at | datetime | |
| affects_cost_layer | bool | |

### 6.7 `suppliers`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| supplier_code | string? | |
| name | string | toUpperTr |
| tax_id | string? | |
| is_active | bool | |
| is_placeholder | bool | **false** for complete |
| audit | timestamps | |

### 6.8 `supplier_contacts`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| supplier_id | FK | |
| name, phone, email | | |
| is_primary | bool | |

### 6.9 `goods_receipts`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| receipt_code | string | |
| purchase_order_id | FK | |
| warehouse_id | FK | |
| received_by | FK user | |
| received_at | datetime | |
| waybill_number | string? | |
| notes | string? | |
| status | enum? | posted/draft |

### 6.10 `goods_receipt_lines`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| goods_receipt_id | FK | |
| order_line_id | FK | |
| qty_accepted | decimal | Stok artışı |
| qty_rejected | decimal | Stok **yok** |
| qty_damaged | decimal | Stok **yok** |
| serial_numbers | JSON? | Envanter — mal kabulde |
| stock_movement_id | FK? | Stok modülü |
| notes | string? | |

### 6.11 `pending_costs` (view veya tablo)

| Alan | Not |
|------|-----|
| order_line_id | |
| goods_receipt_line_id | |
| flagged_at | |
| resolved_at | |
| resolution_type | price_entered / revision / correction |

### 6.12 `purchasing_settings`

| Anahtar | Örnek |
|---------|--------|
| over_receive_tolerance_pct | P4 — varsayılan **0** |
| default_warehouse_id | |
| require_project_on_request | **false** (P1 önerisi) |
| under_receive_approver_roles | P5 — satınalma / talep sahibi / manager |

---

## 7. Purchase request

### 7.1 Talep yaşam döngüsü

```text
draft → submitted → approved | rejected | revision_requested
                  → cancelled
approved → PO oluşturma (sistem veya satınalmacı)
```

### 7.2 İş kuralları

| Kural | Detay |
|-------|--------|
| Onaylı olmayan talep | PO oluşturulamaz |
| Stok | Talep aşamasında **etkilenmez** |
| Audit | Durum değişimi loglanır |

**PT-01, PT-02**

---

## 8. Product popup integration

[07-stock-full-blueprint.md](./07-stock-full-blueprint.md) §4, §5 ile uyumlu.

| Durum | Davranış |
|-------|----------|
| Ürün bulunamadı | Yetki varsa `purchasing.product.createPopup` |
| Yeni ürün | Yalnızca **product master** |
| Stok | **Oluşmaz** (PT-22) |
| m²/m³ helper | Master bilgisi; stok/FIFO ana birim değil |
| Duplicate | `stock.product.duplicateReview` paylaşımlı |

**Önerilen P6:** `purchasing.product.create` — `purchasing.request.create` **tek başına yeterli değil**.

---

## 9. Approval workflow

### 9.1 `request_status` geçişleri

| Durum | Açıklama |
|-------|----------|
| draft | Taslak |
| submitted | Onaya gönderildi |
| approved | Onaylandı |
| rejected | Reddedildi |
| revision_requested | Düzeltme istendi |
| cancelled | İptal |

### 9.2 Permissions

| perm_key | Aksiyon |
|----------|---------|
| purchasing.request.create | Talep oluştur |
| purchasing.request.approve | Onayla |
| purchasing.request.reject | Reddet |
| purchasing.request.cancel | İptal |

| İlke | Detay |
|------|--------|
| Onay | Yalnızca yetkili kullanıcı |
| `module.purchasing` | Onay için **yeterli değil** (PT-19) |
| Audit | Her karar `purchase_request_approvals` + activity_logs |

**PT-02, PT-19**

---

## 10. Purchase order

PO, onaylı request’ten oluşur (manuel veya otomatik).

### 10.1 Header alanları

Bkz. §6.4 — özellikle **üç ayrı eksen:**

| Eksen | Soru |
|-------|------|
| `order_status` | Sipariş yaşam döngüsü (open/completed/…) |
| `buyer_state` | Satınalmacı işleme durumu |
| `receipt_status` | Fiziksel teslim durumu |
| `price_status` | Fiyatlandırma tamamlık |

**Karıştırma yasak** — liste filtreleri eksen bazlı.

**PT-03**

---

## 11. Purchase order lines

Satır bazlı Money modeli ([05](./05-country-currency-language.md)):

| Alan | Kural |
|------|--------|
| `unit_price` + `currency_code` | Orijinal işlem |
| `fx_rate_to_local`, `fx_rate_to_base` | > 0 (priced satır) |
| `line_total_*` | Backend **PricingEngine** hesaplar |
| `unit_code` | Ürün ana birimi — m² helper değil |

**PT-09, PT-10**

---

## 12. Fiyat kaydetme

> **Fiyat kaydetmek siparişi tamamlamaz.**

Fiyat kaydetme (`PUT .../pricing` veya eşdeğeri) yalnızca günceller:

- `supplier_id` (satır)
- `unit_price`
- `currency_code`
- `fx_rate_to_local`, `fx_rate_to_base`
- `line_total_*`
- `price_status` (partial/completed)
- `buyer_state` → `in_progress` / `prices_saved` (fiyat kaydedildi, **complete değil**)

| Yasak | |
|-------|--|
| Fiyat kaydet → `order_status = completed` | |
| Fiyat kaydet → stok hareketi | |
| Fiyat kaydet → `receipt_status = fully_received` | |

**PT-04**

---

## 13. Sipariş tamamlama

Ayrı aksiyon: `purchasing.order.complete` — `POST .../buyer-action/complete` benzeri.

### 13.1 Tamamlama önkoşulları

| Kontrol | Zorunlu |
|---------|---------|
| Aktif satırda `supplier_id` | Evet |
| Placeholder supplier | **Hayır** (PT-06) |
| `unit_price` | Evet (PT-07) |
| `currency_code` | Evet |
| `fx_rate_to_local` > 0 | Evet (PT-08) |
| Validation | Tüm aktif satırlar |

Eksik varsa **400** — tamamlanamaz.

### 13.2 Tamamlama sonrası

| Eksen | Değer |
|-------|--------|
| `buyer_state` | `completed_by_buyer` |
| `order_status` | `completed` (veya `open` + receipt bekliyor — politika) |
| Stok | **Hâlâ artmaz** — mal kabul beklenir |

**PT-05, PT-06, PT-07, PT-08**

---

## 14. Mal kabul entegrasyonu

[07-stock-full-blueprint.md](./07-stock-full-blueprint.md) §10, §17 ile birebir uyum.

### 14.1 Akış

```text
Depocu → aktif PO seçer → satır bazlı kabul
  → qty_accepted → StockPort.recordIn(...)
  → qty_rejected / qty_damaged → stok yok
  → partial → remaining_quantity güncelle
  → over receive → tolerans (P4 varsayılan %0) üstü onay
  → under close → P5: depocu tek başına değil; satınalma / talep sahibi / manager onayı
```

### 14.2 Kurallar

| Kural | Detay |
|-------|--------|
| Bağlantı | PO / order_line |
| Stok hareketi | **Stok modülü** oluşturur |
| Fiyat değiştirme | Depocu **yapamaz** (PT-18) |
| Seri no | Mal kabulde; PO’da değil |
| Buyer completed | Mal kabul için **gerekmez** |
| Partial | Desteklenir |

### 14.3 StockPort sözleşmesi

```text
StockPort.recordIn({
  source: 'PURCHASE_RECEIPT',
  purchaseOrderId,
  goodsReceiptId,
  warehouseId,
  lines: [{
    orderLineId,
    productId,
    quantityAccepted,
    unitCode,
    unitCostTransaction?,   // varsa
    transactionCurrency?,
    pendingCost?: boolean,
    serialNumbers?: string[]
  }]
})
```

**PT-11, PT-12, PT-13, PT-14, PT-15, PT-18**

---

## 15. Pending cost

Fiyat yokken mal kabul yapılabilir (operasyonel ihtiyaç).

| Adım | Davranış |
|------|----------|
| GR fiyatsız / unit_price null | `pending_cost = true` cost layer |
| Fiziksel stok | **Artabilir** (accepted qty) |
| Dashboard | Pending cost uyarısı |
| Fiyat girilince (P2) | Henüz kesinleşmemiş layer → **auditli update**; kesinleşmiş fiyat → **correction record** |

[07](./07-stock-full-blueprint.md) §14, §17 ile uyumlu.

**PT-16, PT-17**

---

## 16. Price revision

| Rol | Yetki |
|-----|--------|
| Gate 4: satınalma (P3) | `purchasing.price_revision.create` |
| Gate 5: finance | Onay / finalize katmanı eklenecek |
| Depocu | **Yok** |

| Kural | Detay |
|-------|--------|
| Kayıt | `purchase_order_price_revisions` |
| Audit | Zorunlu |
| Stok | Geçmiş hareket **silinmez**; P2: update vs correction (§15, [09](./09-finance-data-contract.md)) |
| pending_cost | Çözüm işaretlenir |

**PT-17**

---

## 17. Supplier management

[07-stock-full-blueprint.md](./07-stock-full-blueprint.md) **S1** ile uyumlu:

| Entity | Örnek |
|--------|--------|
| `brands` | Blum |
| `suppliers` | A Firması, B Firması |
| `supplier_brands` | İleride (opsiyonel) |

Aynı markalı ürün farklı tedarikçilerden alınabilir → **marka ≠ supplier**.

| Kural | Detay |
|-------|--------|
| `is_placeholder` | Complete’te **false** zorunlu |
| Gate 5 | `parties.supplier_id` link hazırlığı |

**PT-21**

---

## 18. Status modeli

**Statüler birbirine karıştırılmaz.** UI ve API ayrı alanlar kullanır.

### 18.1 `request_status`

`draft` | `submitted` | `approved` | `rejected` | `revision_requested` | `cancelled`

### 18.2 `order_status`

`draft` | `open` | `in_progress` | `completed` | `cancelled`

### 18.3 `price_status` (sipariş veya satır)

`missing` | `partial` | `completed`

### 18.4 `receipt_status`

`awaiting_receipt` | `partially_received` | `fully_received` | `closed_under_received` | `cancelled`

### 18.5 `buyer_state`

`not_started` | `in_progress` | `completed_by_buyer`

(V2 `prices_saved` → V3’te `in_progress` alt durumu veya `price_status=partial` ile ifade edilir; tek “completed” anlamı `completed_by_buyer`.)

### 18.6 Eksen matrisi (örnek)

| Olay | order_status | buyer_state | price_status | receipt_status | Stok |
|------|--------------|-------------|--------------|----------------|------|
| PO oluştu | open | not_started | missing | awaiting_receipt | — |
| Fiyat kaydedildi | open | in_progress | partial | awaiting_receipt | — |
| Buyer complete | completed | completed_by_buyer | completed | awaiting_receipt | — |
| Mal kabul %50 | completed | completed_by_buyer | completed | partially_received | +qty |
| Tam teslim | completed | completed_by_buyer | completed | fully_received | +qty |

---

## 19. Permissions

### 19.1 Modül kapısı

| perm_key | Not |
|----------|-----|
| module.purchasing | Menü — fiyat/onay için **yeterli değil** |

### 19.2 Örnek manifest

| perm_key | Açıklama |
|----------|----------|
| purchasing.hub.view | Hub |
| purchasing.request.view / .create / .edit | Talep |
| purchasing.request.approve / .reject | Onay |
| purchasing.order.view / .create | PO |
| purchasing.order.process | İşleme başlat |
| purchasing.order.price.view | Fiyat görüntüle |
| purchasing.order.price.edit | Fiyat kaydet |
| purchasing.order.complete | Sipariş tamamla |
| purchasing.receipt.view / .create | Mal kabul listesi / oluştur |
| purchasing.receipt.over_receive_approve | Fazla kabul |
| purchasing.receipt.under_receive_close_approve | Eksik kapatma |
| purchasing.supplier.view / .create / .edit | Tedarikçi |
| purchasing.price_revision.create | Fiyat revizyonu |
| purchasing.reports.view | Raporlar |
| purchasing.product.create | Popup ürün (P6) |

### 19.3 Fiyat redaction

`purchasing.order.price.view` yoksa:

- `unit_price`, `line_total_*`, `fx_rate` → omit veya `_redacted`
- V2 `hidePrice` davranışı → explicit permission (PT-20)

---

## 20. UI / modal flows

[00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md): açık tema, kompakt tablo, AppShell, hero yok, merkezi Modal/ConfirmDialog.

| flowId | Açıklama |
|--------|----------|
| purchasing.request.create | Yeni talep |
| purchasing.request.approveConfirm | Onay |
| purchasing.request.rejectConfirm | Red |
| purchasing.order.createFromRequest | PO oluştur |
| purchasing.order.process | İşleme al |
| purchasing.order.priceEntry | Fiyat satır girişi |
| purchasing.order.completeConfirm | Tamamlama onayı |
| purchasing.receipt.selectOrder | Mal kabul PO seçimi |
| purchasing.receipt.receive | Satır kabul |
| purchasing.receipt.overReceiveApproval | Fazla miktar |
| purchasing.receipt.underReceiveCloseApproval | Eksik kapatma |
| purchasing.product.createPopup | Ürün popup |
| purchasing.supplier.create | Tedarikçi |
| purchasing.priceRevision.create | Revizyon |

### 20.1 Sayfa kayıtları (registry örnek)

| page_key | V2 referans |
|----------|-------------|
| purchasing.hub | purchasing.html |
| purchasing.requests | purchase-requests.html |
| purchasing.processing | purchase-processing.html |
| purchasing.receipts | goods-receipt.html |
| purchasing.suppliers | (yeni) |
| purchasing.reports | (yeni) |

---

## 21. V2 referans noktaları

| Konu | V2 dosya |
|------|----------|
| Domain servis | `backend/services/purchasingService.js` |
| Workflow | `backend/services/purchaseWorkflow.js` (varsa) |
| API | `backend/controllers/purchasingController.js`, `backend/routes/purchasingRoutes.js` |
| Şema | `database/schema/006_purchasing_module.sql`, patch 006b–014 |
| Fiyat vs complete | `savePricing` / `buyer-action` — ayrım doğrula |
| Mal kabul | `postGoodsReceipt`, `goods_receipt_*` |
| pending_cost / recalc | `recalculateCostLayersForOrderId` |
| buyer_state / receipt_status | normalize fonksiyonları |
| Placeholder supplier | complete validation |
| hidePrice | frontend purchasing JS |
| Stok entegrasyon | `stockMovementService` + GR |

**Kod birebir kopyalanmaz** — iş kuralları port edilir.

---

## 22. Test / doğrulama senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| PT-01 | Purchase request oluştur | draft/submitted |
| PT-02 | Request onay | approved + audit |
| PT-03 | Onay sonrası PO | PO kaydı |
| PT-04 | Fiyat kaydet | PO **tamamlanmaz** |
| PT-05 | Eksik supplier complete | 400 |
| PT-06 | Placeholder supplier complete | 400 |
| PT-07 | Eksik unit_price complete | 400 |
| PT-08 | Eksik fx_rate complete | 400 |
| PT-09 | USD satır | currency USD |
| PT-10 | UZS satır | currency UZS |
| PT-11 | Mal kabul | StockPort IN |
| PT-12 | Rejected qty | Stok artmaz |
| PT-13 | Partial receipt | remaining güncellenir |
| PT-14 | Over receive | Onay gerekir |
| PT-15 | Under receive close | Onay gerekir |
| PT-16 | Fiyatsız GR | pending_cost |
| PT-17 | Price revision | Layer/correction + audit |
| PT-18 | Depocu fiyat değiştirme | 403 |
| PT-19 | module.purchasing approve | 403 |
| PT-20 | price.view yok | Redaction |
| PT-21 | Supplier ≠ brand | Ayrı entity |
| PT-22 | Product popup | Stok oluşmaz |
| PT-23 | Responsive | 1366/1024/768 |

---

## 23. Riskler

| Risk | Azaltma |
|------|---------|
| Fiyat kaydet = complete | §12, PT-04; code review |
| Mal kabul = fiyat | §3, §14; rol ayrımı |
| Statü karışımı | §18; ayrı kolonlar |
| pending_cost yok | §15; PT-16 |
| FX eksik | §13; PT-08 |
| Geniş module.purchasing | Granular perm; PT-19/20 |
| Brand=supplier | §17, S1; PT-21 |
| Erken stok artışı | §3 tablo; integration test |

---

## 24. Açık kararlar

| # | Karar | Durum | Önerilen karar |
|---|--------|--------|----------------|
| **P1** | `project_id` request/item | **ÖNERİLDİ** | Request: **opsiyonel**; item: **opsiyonel**, varsa PO/satıra taşınır. Stok çıkış `project_id` **zorunlu** kalır ([07](./07-stock-full-blueprint.md) §12) |
| **P2** | pending_cost çözümü | **ÖNERİLDİ** | Fiyat sonradan: kesinleşmemiş layer → auditli **update**; kesinleşmiş → **correction record** ([09](./09-finance-data-contract.md) §10) |
| **P3** | Price revision yetkisi | **ÖNERİLDİ** | Gate 4: satınalma; Gate 5: finance onay/finalize |
| **P4** | Over receive tolerans | **ÖNERİLDİ** | Admin ayarı; varsayılan **%0**; üstü onay |
| **P5** | Under receive close | **ÖNERİLDİ** | Depocu **tek başına yapamaz**; satınalma sorumlusu / talep sahibi / yetkili manager |
| **P6** | Product popup | **ÖNERİLDİ** | Ayrı `purchasing.product.create`; `request.create` yeterli değil |

Resmi kapanış: FROZEN öncesi inceleme onayı.

---

## 25. Kabul kriterleri (Gate 0)

- [ ] Satınalma kapsamı mini değil **tam** onaylandı (§2)
- [ ] Talep / sipariş / mal kabul **ayrımı** onaylandı (§3)
- [ ] Fiyat kaydetme ≠ sipariş tamamlama onaylandı (§12, §13)
- [ ] Status modeli (ayrı eksenler) onaylandı (§18)
- [ ] Currency/fx **satır bazlı** onaylandı (§11, [05](./05-country-currency-language.md))
- [ ] Pending cost modeli onaylandı (§15)
- [ ] Mal kabul stok entegrasyonu onaylandı (§14, [07](./07-stock-full-blueprint.md))
- [ ] Supplier / brand ayrımı onaylandı (§17)
- [ ] Permission / redaction onaylandı (§19)
- [ ] [07-stock](./07-stock-full-blueprint.md) çapraz kurallar hizalandı (§3.4)
- [ ] PT-01…PT-23 test planına aktarıldı
- [ ] P1–P6 önerilen kararlar inceleme onayı (§24)
- [ ] **Durum: FROZEN** (henüz değil)

**Gate 0 kuralı:** Bu belge **FROZEN** olmadan satınalma modül kodu **yazılmaz**.

---

## 26. Belge durumu

**Durum: TASLAK / İNCELEME** — Henüz FROZEN değil.

**Sonraki önerilen spec:** [10-integration-map.md](./10-integration-map.md) (finance: [09](./09-finance-data-contract.md))
