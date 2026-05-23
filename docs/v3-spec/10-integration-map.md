# FactoryOS V3 — Integration Map (Modüller Arası Entegrasyon)

**Belge türü:** Gate 0 çapraz kesen spec  
**Durum:** ☐ TASLAK | ☑ İNCELEME | ☐ FROZEN  
**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026  
**Ürün:** FactoryOS V3 · V2 referans only (kod kopyalanmaz)

**Amaç:** Yeni özellik eklemek değil; **kavram karmaşasını temizlemek** — veri sahipliği, akış, sınır, port sözleşmeleri.

**İlişkili domain / platform belgeleri:**

| Belge | Konu |
|-------|------|
| [06-hr-full-blueprint.md](./06-hr-full-blueprint.md) | HR, AttendanceEngine, payroll |
| [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) | Stok, FIFO, mal kabul |
| [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) | Satınalma, PO, GR |
| [09-finance-data-contract.md](./09-finance-data-contract.md) | Finance F1–F6 |
| [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) | Permission, redaction |
| [02-admin-control-system.md](./02-admin-control-system.md) | Admin omurga |
| [03-migration-module-registry.md](./03-migration-module-registry.md) | Registry, migration |
| [05-country-currency-language.md](./05-country-currency-language.md) | Money |
| [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) | UI kit |
| [12-modal-flow-inventory.md](./12-modal-flow-inventory.md) | Modal flowId |

**Gate 0 kuralı:** Bu belge FROZEN olmadan modüller arası **entegrasyon kodu** (port implementasyonları, cross-module servis çağrıları) yazılmaz.

---

## 1. Amaç

FactoryOS V3’te **HR**, **Stock**, **Purchasing**, **Finance**, **Admin**, **Permission**, **Registry**, **Currency**, **Project** ve **UI** katmanları arasındaki:

| Netleştirilecek | Açıklama |
|-----------------|----------|
| Veri sahipliği | Hangi modül hangi tabloyu sahiplenir |
| Veri akışı | Kim kimi nasıl çağırır |
| Sınırlar | Kim ne **yapmaz** |
| Entegrasyon noktaları | Port / adaptor sözleşmeleri |
| Gate sırası | Hangi entegrasyon hangi gate’te |

---

## 2. Ana ilke

> **Modüller birbirinin iç tablolarını doğrudan değiştirmez.**  
> Entegrasyon **port / adaptor sözleşmeleri** (ve gerektiğinde domain event) ile yapılır.

| Yasak örnek | Doğru |
|-------------|--------|
| Purchasing → `INSERT stock_cost_layers` | `StockPort.recordIn(...)` |
| Finance → `INSERT stock_movements` | Stok modülü kendi API’si |
| Stock → `INSERT invoices` | `FinancePort.createInvoice(...)` |
| HR → `INSERT payments` | `FinancePort.recordPayment(...)` |
| Purchasing → `UPDATE employees` | HR API / read-only FK |

**Tercih (I5):** Gate 0–5 için **senkron servis portları** yeterli; event bus opsiyonel (ileride).

---

## 3. Modül sahiplik tablosu

**Sahip modül** = tek yazma otoritesi (CREATE/UPDATE/DELETE iş kuralları).

### 3.1 HR owns

| Entity / alan |
|---------------|
| `employees`, `departments`, `positions` |
| `hr_shifts`, `employee_shift_assignments` |
| `attendance_daily`, `attendance_monthly_locks` |
| `payroll_snapshots`, `employee_compensation_history` |
| `work_statuses`, `day_types`, `hr_settings` |

### 3.2 Stock owns

| Entity / alan |
|---------------|
| `products`, `brands`, `product_categories`, `units` |
| `warehouses`, `product_stock_balances` |
| `stock_movements`, `stock_cost_layers` |
| `manual_stock_requests` (P5) |

### 3.3 Purchasing owns

| Entity / alan |
|---------------|
| `purchase_requests`, `purchase_request_items`, `purchase_request_approvals` |
| `purchase_orders`, `purchase_order_lines` |
| `purchase_order_price_revisions` |
| `suppliers`, `supplier_contacts` |
| `goods_receipts`, `goods_receipt_lines` (operasyonel kabul kaydı) |
| Fiyat girişi, `buyer_state`, `price_status` (sipariş ekseni) |

### 3.4 Finance owns

| Entity / alan |
|---------------|
| `parties`, `party_contacts`, `supplier_accounts`, `customer_accounts` |
| `invoices`, `invoice_lines` |
| `payments` (`payment_direction` OUT/IN — F2) |
| `payment_allocations` |
| `finance_movements` (F1 — invoice’dan ayrı) |
| `pending_costs` görünüm / çözüm kaydı |
| `price_finalizations` (F4 iki aşamalı) |
| `bank_accounts` (F6 minimal) |
| `finance_settings` |

### 3.5 Admin owns

| Entity / alan |
|---------------|
| `users`, `roles`, `role_permissions`, `user_permissions` |
| `position_permissions` (platform; pozisyon HR’da tanımlı) |
| Sistem ayarları (admin panel) |
| Registry kontrol UI (manifest tetikleyici) |

### 3.6 Registry owns

| Entity / alan |
|---------------|
| `erp_modules`, `erp_pages`, `erp_page_cards`, `erp_page_actions` |
| Modül manifest senkron meta |

### 3.7 Currency config owns

| Kavram | Kaynak |
|--------|--------|
| `country_profiles`, locale, `local_currency`, `base_reporting_currency` | [05](./05-country-currency-language.md) |
| FX policy, `GET /api/public/config` | Gate 1 |
| `Money` value object kuralları | Tüm modüller tüketir |

### 3.8 Project owns (Gate 6+ hazırlık)

| Entity / alan |
|---------------|
| `projects`, project codes |
| BOQ, project delivery |
| Proje maliyet modülü (sonra) |

**Okuma:** Diğer modüller `project_id` FK tutabilir; proje master yazımı Project modülünde.

---

## 4. HR entegrasyonları

| Bağlantı | Mekanizma | Not |
|----------|-----------|-----|
| `employees.user_id` | → `users.id` | [01](./01-permission-role-position-blueprint.md); admin otomatik employee yok |
| `position_permissions` | Pozisyon → perm | HR `positions`; platform tablo |
| `payroll_snapshots` | JSON dondurma | → Finance `employee_advances` / ödeme hazırlığı (F5) |
| `warehouses.responsible_person_id` | FK `employees` | Opsiyonel |
| Zimmet / envanter | Employee seçimi | [07](./07-stock-full-blueprint.md) §20; modül adayı I2 |
| Maaş alanları | API redaction | `hr.salary.*` — `module.hr` yetersiz |

**HR yapmaz:** `stock_movements`, `invoices`, `payments` doğrudan oluşturmaz.

---

## 5. Stock entegrasyonları

| Bağlantı | Mekanizma | Not |
|----------|-----------|-----|
| Mal kabul | PO/line referans; **stok Stock’ta** | `StockPort.recordIn` |
| `stock_movements`, `stock_cost_layers` | Stock sahibi | FIFO unit-cost |
| `pending_cost` | Flag katmanda | Finance listeler / çözer (F3) |
| `stock_movements.project_id` | Zorunlu OUT | Proje maliyet hazırlığı |
| Ürün master | Stock/Purchasing popup | Stok miktarı **oluşturmaz** |
| Envanter/Zimmet | Paylaşılan depo kavramı | Ayrı modül adayı (I2) |

**Stock yapmaz:** `invoices`, `finance_movements`, `purchase_orders` yazmaz.

---

## 6. Purchasing entegrasyonları

| Bağlantı | Mekanizma | Not |
|----------|-----------|-----|
| Talep / sipariş | Purchasing sahibi | |
| Fiyat girişi | Satınalma | Fiyat kaydet ≠ complete |
| Mal kabul | `StockPort.recordIn` | Fiziksel artış Stock’ta |
| Rejected/damaged | GR satırı | Stok **artmaz** |
| `suppliers` | Operasyonel | `suppliers.party_id` → Finance |
| Product popup | → `products` | Stok oluşturmaz (P6) |
| pending cost (basit) | PO fiyat | Satınalma çözebilir (F3) |

**Purchasing yapmaz:** `stock_cost_layers` doğrudan yazmaz; `invoices` oluşturmaz.

---

## 7. Finance entegrasyonları

[09](./09-finance-data-contract.md) F1–F6 önerileri dahil:

| Karar | Entegrasyon |
|-------|-------------|
| **F1** | `invoices` belge; `finance_movements` hareket; **posted** → movement |
| **F2** | `payments` tek tablo; `payment_direction` OUT/IN |
| **F3** | pending cost → satınalma; **final cost** → finance onay |
| **F4** | price_finalization: satınalma başlatır, finance finalize |
| **F5** | Basit `employee_advances` Gate 5 MVP |
| **F6** | Minimal `bank_accounts` seçimi |

| Bağlantı | Mekanizma |
|----------|-----------|
| Supplier borç/alacak | `parties` (type=supplier) |
| Üçlü gerçeklik | PO fiyat ≠ mal kabul miktar ≠ fatura fiyat |
| pending cost çözümü | `CostPort` / auditli layer update veya correction |
| HR payroll | Snapshot okuma; ödeme Finance port |

**Finance yapmaz:** `stock_movements` oluşturmaz; mal kabul yapmaz.

---

## 8. Admin / Permission / Registry entegrasyonu

| Katman | Davranış |
|--------|----------|
| **Registry** | Modül/sayfa/kart/aksiyon aktif-pasif ([03](./03-migration-module-registry.md)) |
| Pasif modül | Menü gizli **ve** API **403** |
| **PermissionGate** (UI) | Görünürlük — güvenlik değil |
| **requirePermission** (API) | Asıl güvenlik |
| **Redaction** (API) | Hassas alanlar omit / `_redacted` |

| Alan ailesi | Minimum perm |
|-------------|--------------|
| Maaş | `hr.salary.*` |
| Stok maliyet | `stock.cost.view` |
| Finans tutarları | `finance.sensitive_amounts.view` |

`module.*` tek başına yukarıdakiler için **yeterli değil**.

---

## 9. Currency entegrasyonu

Tüm modüller [05](./05-country-currency-language.md) **Money** modelini kullanır:

| Alan | Zorunlu (finansal kayıt) |
|------|--------------------------|
| `amount_transaction` | Evet |
| `transaction_currency` | Evet — ezilmez |
| `fx_rate_to_local`, `amount_local` | Evet |
| `fx_rate_to_base`, `amount_base` | Evet |
| `fx_snapshot_at` | Evet |

| Yasak |
|-------|
| Frontend para/kur/COGS hesabı |
| Hardcoded `UZS` / `USD` |
| `SYSTEM` currency alias |

**IT-13:** Frontend money calculation yok.

---

## 10. UI / Modal entegrasyonu

Tüm modüller [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md):

| Bileşen | Kullanım |
|---------|----------|
| AppShell | Sidebar + Topbar |
| PageHeader, DataTable | Liste sayfaları |
| Modal, ConfirmDialog | Akışlar |
| Toast, FormField | Geri bildirim / form |
| PermissionGate | UI gizleme |

`flowId` envanteri → [12-modal-flow-inventory.md](./12-modal-flow-inventory.md) (hr.*, stock.*, purchasing.*, finance.*).

---

## 11. Port sözleşmeleri (taslak)

Kod yok; Gate 1+ implementasyon hedefi.

### 11.1 `StockPort.recordIn`

| | |
|--|--|
| **Sahibi** | Stock |
| **Çağıran** | Purchasing (mal kabul), Stock (manuel onaylı giriş) |
| **Yapar** | `stock_movements` IN, `stock_cost_layers`, bakiye artışı |
| **Yapmaz** | Invoice, payment, PO status (çağıran günceller) |
| **Audit** | Evet — movement + source meta |

### 11.2 `StockPort.recordOut`

| | |
|--|--|
| **Sahibi** | Stock |
| **Çağıran** | Stock UI, ileride Shipment/Project |
| **Yapar** | OUT, FIFO tüketim, `project_id` zorunlu |
| **Yapmaz** | Finance ledger doğrudan |
| **Audit** | Evet |

### 11.3 `CostPort.resolvePendingCost`

| | |
|--|--|
| **Sahibi** | Stock (katman); Finance (iş kuralı onayı) |
| **Çağıran** | Purchasing (basit/pending), Finance (final) |
| **Yapar** | `pending_cost` flag kapatma; auditli layer **update** veya **correction** (F3, P2) |
| **Yapmaz** | Fatura posted (Finance ayrı) |
| **Audit** | Evet |

### 11.4 `FinancePort.createInvoice`

| | |
|--|--|
| **Sahibi** | Finance |
| **Çağıran** | Purchasing (eşleme), Admin |
| **Yapar** | `invoices` + lines; draft |
| **Yapmaz** | Stok hareketi |
| **Audit** | Evet |

### 11.5 `FinancePort.postInvoice` / `recordFinanceMovement`

| | |
|--|--|
| **Sahibi** | Finance |
| **Çağıran** | Finance UI |
| **Yapar** | F1: posted → `finance_movements` |
| **Yapmaz** | Stock layer doğrudan |
| **Audit** | Evet |

### 11.6 `FinancePort.recordPayment`

| | |
|--|--|
| **Sahibi** | Finance |
| **Çağıran** | Finance UI, HR advance ödeme (F5) |
| **Yapar** | `payments` (OUT/IN), allocation, movement |
| **Yapmaz** | Stok |
| **Audit** | Evet |

### 11.7 `FinancePort.initiatePriceFinalization` / `approvePriceFinalization`

| | |
|--|--|
| **Sahibi** | Finance |
| **Çağıran** | Purchasing (initiate — F4), Finance (approve) |
| **Yapar** | `price_finalizations` iki aşama; correction tetikleyebilir |
| **Yapmaz** | Depocu fiyat değiştirme |
| **Audit** | Evet |

### 11.8 `HRPort.getEmployeeSnapshot`

| | |
|--|--|
| **Sahibi** | HR |
| **Çağıran** | Finance, Admin, Stock (zimmet) |
| **Yapar** | Read-only personel özeti; payroll snapshot ref |
| **Yapmaz** | Maaş alanları perm yoksa redacted |
| **Audit** | Okuma log (opsiyonel) |

### 11.9 `ProjectPort.getProjectRef`

| | |
|--|--|
| **Sahibi** | Project (Gate 6+) |
| **Çağıran** | Stock OUT, Purchasing, Finance |
| **Yapar** | `project_id` doğrulama, kod/ad read |
| **Yapmaz** | BOQ yazma |
| **Audit** | Hayır (read) |

### 11.10 `RegistryPort.getActivePages`

| | |
|--|--|
| **Sahibi** | Registry |
| **Çağıran** | Frontend bootstrap, API middleware |
| **Yapar** | Aktif modül/sayfa/aksiyon listesi |
| **Yapmaz** | Permission hesaplama |
| **Audit** | Hayır |

### 11.11 `PermissionPort.getUserPermissionKeys`

| | |
|--|--|
| **Sahibi** | Permission / Admin |
| **Çağıran** | Tüm modül API middleware |
| **Yapar** | Etkili perm seti (rol + pozisyon + istisna) |
| **Yapmaz** | UI render |
| **Audit** | Hayır |

---

## 12. Uçtan uca veri akış senaryoları

### A — Satınalma talebi → PO → Mal kabul → Stok artışı

```text
PR create → PR approve → PO create
  → buyer price entry → buyer complete (≠ stock)
  → GR (Purchasing) → StockPort.recordIn
  → stock_movements + stock_cost_layers + balance ↑
```

### B — Fiyat yokken mal kabul → pending cost → fiyat sonradan

```text
GR (no price) → StockPort.recordIn(pending_cost=true)
  → Purchasing PO price save → CostPort.resolvePendingCost (pending — F3)
  → Finance final approve (F3) → layer update
```

### C — PO fiyatı ≠ fatura fiyatı → price finalization

```text
PO priced → GR → Invoice (Finance) farklı tutar
  → Purchasing initiatePriceFinalization (F4)
  → Finance approvePriceFinalization
  → CostPort correction if finalized (P2)
```

### D — Stok çıkış → project_id → proje maliyet hazırlığı

```text
StockPort.recordOut(project_id required)
  → COGS layers consumed
  → Project costing (Gate 6+) reads movements
```

### E — HR ay kilidi → payroll snapshot → finance advance

```text
HR month lock → payroll_snapshots (frozen)
  → Finance reads snapshot (F5)
  → employee_advances + FinancePort.recordPayment (later)
```

### F — Envanter satınalma → mal kabul seri no → zimmet

```text
PO → GR with serial_numbers (StockPort)
  → Inventory module (I2) assign to employee
  → HRPort.getEmployeeSnapshot
```

### G — Modül pasif → menü gizli + API 403

```text
Admin/registry: erp_modules.is_active = false
  → RegistryPort: page hidden
  → API requireModuleActive → 403
```

### H — Sensitive perm yok → API redaction

```text
GET employee / stock control / finance dashboard
  → no hr.salary.* / stock.cost.view / finance.sensitive_amounts.view
  → amounts omitted or _redacted
```

---

## 13. Anti-pattern / yasaklar

| # | Yasak |
|---|--------|
| 1 | Modül başka modülün tablosunu doğrudan INSERT/UPDATE/DELETE |
| 2 | Frontend WageEngine / CostEngine / FinanceEngine kopyası |
| 3 | Purchasing → `stock_cost_layers` doğrudan yazım |
| 4 | Finance → `stock_movements` oluşturma |
| 5 | Stock → `invoices` oluşturma |
| 6 | HR → `payments` oluşturma |
| 7 | `module.hr` / `module.stock` / `module.purchasing` sensitive alan için yeterli sayma |
| 8 | Registry pasifken yalnızca menü gizleme (API 403 şart) |
| 9 | Hardcoded `UZS` / `USD` / `SYSTEM` currency |
| 10 | V2 `patch-*.js` / servis dosyalarını birebir kopyalama |
| 11 | Fiyat kaydet = sipariş complete = stok artışı (tek adım) |
| 12 | Invoice posted olmadan finance_movement (F1 ihlali) |

---

## 14. Gate bazlı entegrasyon sırası

| Gate | Entegrasyon paketi |
|------|---------------------|
| **Gate 1** | AppShell, Registry, Permission, Currency `public/config`, Audit, Migration runner |
| **Gate 2** | HR ↔ Users/Permission; AttendanceEngine; payroll snapshot; HRPort |
| **Gate 3** | Stock; Product master; Warehouse; FIFO/CostEngine; StockPort |
| **Gate 4** | Purchasing; PR/PO; GR → StockPort; supplier; product popup |
| **Gate 5** | Finance; F1 movements; F2 payments; F3 pending/final cost; F4 finalization; F5 advances; F6 bank_accounts |
| **Gate 6+** | Project; Shipment; Inventory/Zimmet full; Project costing |

**Bağımlılık:** Gate N, Gate N−1 port’larını **tüketir**; tersine yazım yok.

---

## 15. Test / doğrulama senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| IT-01 | permissionKeys | Login/bootstrap set |
| IT-02 | Pasif modül | Menü yok + API 403 |
| IT-03 | Mal kabul | StockPort IN; balance ↑ |
| IT-04 | Rejected qty | Balance değişmez |
| IT-05 | Pending cost | Finance/purchasing list |
| IT-06 | Pending resolve | Layer update/correction + audit |
| IT-07 | Stock OUT | project_id yok → 400 |
| IT-08 | Payroll snapshot | Finance read-only |
| IT-09 | Finance sensitive | Redacted |
| IT-10 | Stock cost | Redacted |
| IT-11 | HR salary | Redacted |
| IT-12 | Product popup | Stok miktarı yok |
| IT-13 | Frontend money | Hesap yok |
| IT-14 | Inactive page URL | 403 |
| IT-15 | modules:register | Sayfa görünür |
| IT-16 | V2 referans | Kod kopyası yok |

---

## 16. Riskler

| Risk | Azaltma |
|------|---------|
| Harita yok | Bu belge Gate 0 zorunlu |
| PUR/STK/FIN karışımı | §3 sahiplik + §13 |
| HR → payment direct | FinancePort only |
| UI-only permission | API requirePermission |
| FX snapshot eksik | [05](./05-country-currency-language.md) |
| Geç `project_id` | Gate 3 OUT zorunlu |
| Zimmet stok içinde şişer | I2 ayrı modül |

---

## 17. Açık kararlar

| # | Karar | Durum | Not / öneri |
|---|--------|--------|-------------|
| **I1** | Project gate sırası | Açık | Gate 6+; `project_id` Gate 3’te hazır |
| **I2** | Inventory/Zimmet | Açık | `module.inventory` vs stock alt |
| **I3** | Shipment | Açık | Stock alt vs project gate ([07](./07-stock-full-blueprint.md) S2) |
| **I4** | Price finalization yetkisi | **Önerildi** | F4: satınalma başlatır, finance finalize ([09](./09-finance-data-contract.md)) |
| **I5** | Event bus vs port | Öneri | Port yeterli Gate 0–5 |
| **I6** | Audit event naming | Açık | [02](./02-admin-control-system.md) ile hizalanacak |

---

## 18. Kabul kriterleri (Gate 0)

- [ ] Modül sahiplik tablosu onaylandı (§3)
- [ ] HR entegrasyonları onaylandı (§4)
- [ ] Stock entegrasyonları onaylandı (§5)
- [ ] Purchasing entegrasyonları onaylandı (§6)
- [ ] Finance entegrasyonları onaylandı (§7, F1–F6)
- [ ] Admin/Permission/Registry onaylandı (§8)
- [ ] Currency entegrasyonu onaylandı (§9)
- [ ] Port sözleşmeleri onaylandı (§11)
- [ ] Uçtan uca senaryolar A–H onaylandı (§12)
- [ ] Anti-pattern listesi onaylandı (§13)
- [ ] Gate bazlı sıra onaylandı (§14)
- [ ] IT-01…IT-16 test planına aktarıldı
- [ ] Açık kararlar I1–I6 işaretlendi (§17)
- [ ] **Durum: FROZEN** (henüz değil)

**Gate 0 kuralı:** Bu belge **FROZEN** olmadan cross-module port implementasyonu **yazılmaz**.

---

## 19. Belge durumu

**Durum: TASLAK / İNCELEME** — Henüz FROZEN değil.

**Sonraki önerilen spec:** [12-modal-flow-inventory.md](./12-modal-flow-inventory.md) (V2 carry: [11](./11-v2-carry-and-drop.md))
