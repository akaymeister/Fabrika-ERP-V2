# Fabrika ERP V2 — FactoryOS V3 Referans İndeksi

**Versiyon:** 2.0.0  
**Son güncelleme:** 19.05.2026  
**Durum: TASLAK / İNCELEME**

**Yol kökü (V2 repo):** `f:\Fabrika-ERP-V2\`

**İlgili Gate 0 belgeleri:** [11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md) · [00-gate0-open-decisions.md](./00-gate0-open-decisions.md) (V2C1–V2C5) · [12-modal-flow-inventory.md](./12-modal-flow-inventory.md)

---

## 1. Amaç

Bu belge **Fabrika ERP V2**’nin **FactoryOS V3** için **referans indeksidir**.

| V2 ne değildir | V2 ne olabilir |
|----------------|----------------|
| Kod kopyalama kaynağı | İş kuralı referansı |
| UI/CSS şablonu | UAT davranış referansı |
| Patch/migration taşıma listesi | Test vektörü kaynağı |
| Gate 1+ implementasyon hedefi | Karşılaştırma ve “do not port” listesi |

**Kural:** V2 dosyalarına dokunulmaz; V3 kodu Gate 0 **PASS** olmadan başlamaz. Davranış portu serbest; copy-paste port **yasak** ([11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md)).

---

## 2. Referans kullanım türleri

Her satırda aşağıdaki etiketlerden biri (veya birkaçı) kullanılır:

| Etiket | Anlamı |
|--------|--------|
| **UAT_REFERANS** | Ekran/akış UAT sırasında “V2 böyle davrandı” karşılaştırması |
| **IS_KURALI_REFERANS** | İş kuralı, durum makinesi, validasyon mantığı |
| **TEKNIK_TERS_ORNEK** | V3’te bilinçli olarak yapılmayacak model veya kırık desen |
| **TEST_VECTOR_KAYNAGI** | Fixture / smoke script / manuel senaryo üretim kaynağı |
| **UI_AKIS_REFERANS** | Modal/popup/wizard **akış sırası** (tasarım/CSS değil) |
| **KOPYALAMA_YASAK** | Dosya veya desen V3’e taşınmaz |

**Taşıma sütunu değerleri:**

| Değer | Anlamı |
|-------|--------|
| **Referans** | Davranış/kural incelenir; kod yeniden yazılır |
| **Bırak** | V3’te bilinçli yok / farklı model |
| **Kısmi** | Alt parça referans; üst model değişir |

---

## 3. HR referansları

Kaynak spec: [06-hr-full-blueprint.md](./06-hr-full-blueprint.md)

| Konu | V2 dosya / yol | Referans tipi | V3 karşılığı | Taşıma | Not |
|------|----------------|---------------|--------------|--------|-----|
| HR hub | `frontend/public/hr.html`, `js/hr-common.js` | UAT_REFERANS | `module.hr` AppShell | Referans | Menü yapısı V3 registry’den |
| Personel listesi | `frontend/public/hr-employees.html`, `js/hr-employees.js` | UAT_REFERANS | `hr.employee.*` | Referans | |
| Personel formu (create/edit) | `frontend/public/hr-employee-form.html`, `js/hr-employee-form.js` | UAT_REFERANS + UI_AKIS | `hr.employee.create` / `.edit` | Referans | `window.alert` → **TEKNIK_TERS_ORNEK** |
| Personel detay | `frontend/public/hr-employee-detail.html`, `js/hr-employee-detail.js` | UAT_REFERANS | `hr.employee.*` DetailDrawer | Referans | Frontend maaş hesabı yok (backend) |
| Organizasyon | `frontend/public/hr-structure.html`, `js/hr-structure.js` | UAT_REFERANS | `hr` org tree | Referans | `window.prompt` → ters örnek |
| Günlük puantaj | `frontend/public/hr-attendance.html`, `js/hr-attendance.js` | UAT_REFERANS + IS_KURALI | `hr.attendance.dailyEntry` | Referans | `timeToMinutes` / `safeEndMinutes` **frontend duplicate** → V3 backend AttendanceEngine |
| Aylık puantaj | `frontend/public/hr-attendance-monthly.html`, `js/hr-attendance-monthly.js` | UAT_REFERANS | `hr.attendance.monthLockConfirm` | Referans | KPI UZS formatı frontend’de |
| Ay kilidi | `frontend/public/hr-attendance-locks.html`, `js/hr-attendance-locks.js` | IS_KURALI_REFERANS | `attendance_month_locks` | Referans | |
| Payroll / bordro liste | `frontend/public/hr-payroll.html`, `js/hr-payroll.js` | UAT_REFERANS | `hr.payroll.snapshotReview` | Referans | `window.confirm` akışı |
| Payroll snapshot yazma/okuma | `backend/services/hrService.js` (`employee_month_payroll_snapshot`, lock ile yazım) | IS_KURALI_REFERANS | `PayrollSnapshot` + WageEngine | Referans | `snapshotRowToSalaryRowForRead` |
| Compensation history | `backend/services/hrService.js`, şema `database/schema/012_employee_compensation_history.sql` | IS_KURALI_REFERANS | revision-only maaş (H3) | Referans | PATCH yasağı V3 |
| Compensation UI | `frontend/public/hr-compensation.html`, `js/hr-compensation.js` | UAT_REFERANS | `hr.compensation.update` | Referans | |
| HR ayarları (gün tipi, molalar) | `frontend/public/hr-settings.html`, `js/hr-settings.js` | IS_KURALI_REFERANS | `hr.settings.*` | Referans | Frontend `diffMinutes` duplicate |
| Ana HR servis | `backend/services/hrService.js` | IS_KURALI_REFERANS | `HrService` + `AttendanceEngine` + `WageEngine` | Kısmi | Monolit; V3 parçalanır |
| HR routes | `backend/routes/hrRoutes.js`, `controllers/hrController.js` | IS_KURALI_REFERANS | HR API + `requirePermission` | Referans | |
| HR şema | `database/schema/011_hr_module.sql`, `021_hr_attendance_overtime.sql` | IS_KURALI_REFERANS | V3 migration (temiz) | Kısmi | Patch zinciri taşınmaz |
| Profil (self) | `frontend/public/my-profile.html`, `backend/services/meService.js` | UAT_REFERANS | `me` + sınırlı HR | Referans | H4 self-service açık |
| **computeWageBreakdown** | `backend/services/hrService.js` (~L154+) | IS_KURALI_REFERANS + TEST_VECTOR | `WageEngine` | Referans | Tek motor; `backend/scripts/wage-breakdown-smoke.js` |
| **timeToMinutes / diffMinutes / safeEndMinutes** | `hrService.js` (backend); duplicate: `hr-attendance.js`, `hr-settings.js` | IS_KURALI_REFERANS | `AttendanceEngine` (H1 C+B) | Kısmi | V3: hesap **backend**; `safeEndMinutes` yalnız import fallback |
| **Salary redaction** | `hrService.js` (`hr.salary.view_*`, `canViewSalaryGroup`, null alanlar) | IS_KURALI_REFERANS | Permission + API redaction | Referans | Frontend gizleme tek başına yetmez |
| Puantaj API | `hrService.js` `listMonthlyAttendance`, `saveDailyAttendance`, lock kontrolü | IS_KURALI_REFERANS | `AttendanceEngine` + H5 override | Referans | leave+sick+saat → V3 default red |
| Smoke / backfill | `backend/scripts/wage-breakdown-smoke.js`, `backfill-payroll-snapshot-2026-04.js` | TEST_VECTOR_KAYNAGI | `fixtures/hr-wage-vectors.json` | Referans | Script kopyalanmaz; vektör türetilir |

---

## 4. Stock referansları

Kaynak spec: [07-stock-full-blueprint.md](./07-stock-full-blueprint.md)

| Konu | V2 dosya / yol | Referans tipi | V3 karşılığı | Taşıma | Not |
|------|----------------|---------------|--------------|--------|-----|
| Stok hub | `frontend/public/stock.html`, `js/stock-common.js` | UAT_REFERANS | `module.stock` | Referans | `__erpCurrency` default UZS → ters örnek |
| Ürün master (stok miktarı yok) | `frontend/public/stock-products.html`, `backend/services/stockProductService.js` | UAT_REFERANS + IS_KURALI | `stock.product.*` | Referans | Ürün sayfası ≠ stok bakiye (V3 kuralı) |
| **Product code generation** | `backend/utils/productCode.js`, `stockProductService.js` `nextProductCodeFromDb` | IS_KURALI_REFERANS | `ProductCodeService` | Referans | |
| Excel import | `backend/services/stockProductImportService.js` | UAT_REFERANS + UI_AKIS | `stock.product.importExcel` + duplicate review | Referans | Import stok oluşturmaz (V3) |
| Markalar | `frontend/public/stock-brands.html`, `backend/services/stockBrandService.js` | UAT_REFERANS | `stock.brand.*` (S1 ayrı entity) | Referans | |
| Depolar | `frontend/public/stock-warehouses.html`, `backend/services/warehouseService.js` | IS_KURALI_REFERANS | `stock.warehouse.*` | Referans | Depo bazlı bakiye zorunlu |
| **Stock movement** | `backend/services/stockMovementService.js` | IS_KURALI_REFERANS | `StockMovementService` + FIFO port | Kısmi | m² alanları legacy |
| **Stock cost layer (FIFO)** | `backend/services/stockCostLayerService.js` | TEKNIK_TERS_ORNEK + IS_KURALI | Unit-cost FIFO (`quantity_remaining`, `unit_cost_*`) | Bırak (model) / Referans (FIFO sırası) | `cost_uzs_per_m2`, `qty_m2_remaining` |
| Stok giriş UI | `frontend/public/stock-in.html` (`#stockInModal`, `#voidReasonDlg`) | UI_AKIS_REFERANS | `stock.manual.*`, `stock.void.confirm` | Referans | Manuel giriş V3: talep+onay (P5-STK) |
| Stok çıkış | `frontend/public/stock-out.html` | UAT_REFERANS + IS_KURALI | `stock.out.projectIssue` | Referans | `project_id` zorunlu V3 |
| Hareket listesi | `frontend/public/stock-movements.html` | UAT_REFERANS | movement audit list | Referans | |
| **Negative stock protection** | `stockMovementService.js` (`Math.max(0, …)`, işlem öncesi kontroller) | IS_KURALI_REFERANS | V3 strict check + transaction | Referans | V3: işlem öncesi miktar doğrulama |
| **Void / replace** | `stockMovementService.js` `voidStockInMovement*`, `voidStockOutMovement*` | IS_KURALI_REFERANS + UI_AKIS | `stock.void.confirm` | Referans | `stock_in_void_audit` / `stock_out_void_audit` |
| Mal kabul (fiziksel) | `frontend/public/goods-receipt.html` + `purchasingService` GR | UAT_REFERANS | `StockPort.recordIn` (integration) | Referans | `window.prompt` edit reason → **yasak** |
| Dashboard değerleme | `backend/services/dashboardService.js` (m² FIFO toplam) | TEKNIK_TERS_ORNEK | unit-cost aggregation | Bırak | `qty_m2_remaining * cost_uzs_per_m2` |
| Stok şema | `database/schema/004_product_currency_i18n_fifo.sql`, `005_warehouses_*`, `010_stock_movements_*` | IS_KURALI_REFERANS | V3 stock schema | Kısmi | m² kolonları taşınmaz |
| Routes | `backend/routes/stockRoutes.js`, `controllers/stockController.js` | IS_KURALI_REFERANS | Stock API | Referans | |

### m² legacy — TEKNIK_TERS_ORNEK (V3’te hedef kolon değil)

| V2 alan / desen | Dosya | V3 hedef |
|-----------------|-------|----------|
| `cost_uzs_per_m2` | `stockCostLayerService.js`, `004_*.sql`, `purchasingService.js` (layer update) | `unit_cost_transaction` + `unit_code` |
| `qty_m2_remaining` | `stockCostLayerService.js`, `stockMovementService.js` | `quantity_remaining` (ürün ana birimi) |
| m² ana maliyet / ana stok | Tüm m²-first çıkış hesapları | Unit-cost FIFO; m² yalnızca helper ([07](./07-stock-full-blueprint.md) §4) |
| `cost_usd_per_m2`, `input_currency` layer patch | `purchasingService.js` ~L1861 | Pending/final cost ayrımı (P2, F3) |

---

## 5. Purchasing referansları

Kaynak spec: [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md)

| Konu | V2 dosya / yol | Referans tipi | V3 karşılığı | Taşıma | Not |
|------|----------------|---------------|--------------|--------|-----|
| Satınalma hub | `frontend/public/purchasing.html`, `js/purchasing-common.js` | UAT_REFERANS | `module.purchasing` | Referans | |
| **Purchase request** | `frontend/public/purchase-requests.html`, `purchase-requisition-open.html`, `js/purchase-requisition-open.js` | UAT_REFERANS + UI_AKIS | `purchasing.request.*` | Referans | `#prViewDlg` akışı → [12](./12-modal-flow-inventory.md) |
| Talep workflow JS | `frontend/public/js/purchase-requests-workflow.js` | UI_AKIS_REFERANS | onay/red modalları | Referans | |
| **Approval** | `frontend/public/purchase-approvals.html` | UAT_REFERANS | `purchasing.request.approveConfirm` / `.rejectConfirm` | Referans | |
| **Purchase order oluşturma** | `backend/services/purchasingService.js` (PR→PO) | IS_KURALI_REFERANS | `purchasing.order.createFromRequest` | Referans | |
| **Buyer processing** | `frontend/public/purchase-processing.html`, `js/purchase-processing.js` | UAT_REFERANS + UI_AKIS | `purchasing.order.process`, `.priceEntry` | Referans | Processing dialog akışı |
| **Price save** | `purchasingService.js` + `purchase-processing.js` (fiyat kaydet ≠ complete) | IS_KURALI_REFERANS | ayrı API; complete ayrı ConfirmDialog | Referans | V3: fiyat kaydet siparişi tamamlamaz |
| **Complete order** | `purchase-processing.js` `completeOrder()` → `/buyer-action` `complete` | IS_KURALI_REFERANS | `purchasing.order.completeConfirm` | Referans | Eksik fiyat/supplier engeli V3 |
| Workflow sabitleri | `backend/constants/purchaseWorkflow.js` | IS_KURALI_REFERANS | Purchasing state machine | Referans | |
| **Goods receipt** | `frontend/public/goods-receipt.html`, `purchasingService` receive | UAT_REFERANS + UI_AKIS | `purchasing.receipt.*`, `StockPort` | Referans | Mal kabul `buyer_state=completed` **zorunlu değil** (G0-T5) |
| **Partial receipt** | `purchasingService.js` `qty_received`, `receipt_status` partial | IS_KURALI_REFERANS | kısmi mal kabul + over/under approval | Referans | |
| **Placeholder supplier** | `purchase-processing.js` complete validasyonu; backend complete kontrolleri | IS_KURALI_REFERANS | complete engeli | Referans | V3: placeholder supplier ile complete yok |
| **currency / fx_rate** | `purchase_order_items.currency`, `fx_rate`; patch `009_purchase_order_items_fx_rate.sql` | IS_KURALI_REFERANS | [05](./05-country-currency-language.md) Money | Referans | Layer’a m² maliyet yazımı → ters örnek |
| **buyer_state / buyer_status** | `database/patch-012-purchase-orders-buyer-state.js`, `purchasingService.js` | IS_KURALI_REFERANS | buyer workflow enum | Referans | `ready_for_warehouse` ↔ completed eşlemesi |
| **receipt_status / pricing_status** | `database/patch-014-purchasing-process-states.js` | IS_KURALI_REFERANS | receipt/pricing ayrı alanlar | Referans | |
| Ana servis | `backend/services/purchasingService.js` (~2400+ satır) | IS_KURALI_REFERANS | `PurchasingService` + portlar | Kısmi | Monolit parçalanır |
| Routes | `backend/routes/purchasingRoutes.js`, `controllers/purchasingController.js` | IS_KURALI_REFERANS | Purchasing API | Referans | |
| Şema | `database/schema/006_purchasing_module.sql`, `008_*` | IS_KURALI_REFERANS | V3 purchasing schema | Kısmi | |
| Sipariş yazdırma | `frontend/public/purchase-order-print.html` | UAT_REFERANS | PrintPreview (M3) | Referans | Tasarım V3 mockup |

---

## 6. Admin / Permission referansları

Kaynak spec: [02-admin-control-system.md](./02-admin-control-system.md) · [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md)

| Konu | V2 dosya / yol | Referans tipi | V3 karşılığı | Taşıma | Not |
|------|----------------|---------------|--------------|--------|-----|
| **accessService** | `backend/services/accessService.js` (`userHasPermission`, `listUserPermissionKeys`) | IS_KURALI_REFERANS | `PermissionResolver` | Referans | super_admin bypass V3’te kontrollü |
| **permissionService** | `backend/services/permissionService.js` | IS_KURALI_REFERANS | Admin permission CRUD | Referans | |
| **requirePermission** | `backend/middlewares/requirePermission.js` | IS_KURALI_REFERANS | API guard (asıl güvenlik) | Referans | |
| **requirePagePermission** | `backend/middlewares/requirePagePermission.js` | IS_KURALI_REFERANS | HTML route guard | Referans | |
| Admin hub | `frontend/public/admin.html`, `js/admin-common.js` | UAT_REFERANS | `admin.hub` | Referans | |
| **admin-users** | `frontend/public/admin-users.html`, `admin-user-new.html`, `adminUserService.js` | UAT_REFERANS | `admin.user.*` | Referans | |
| **admin-permissions** | `frontend/public/admin-permissions.html`, `js/admin.js` (rol/kullanıcı izin) | UAT_REFERANS + TEKNIK_TERS_ORNEK | `admin.role.permissionEdit`, `admin.userPermission.exception` | Kısmi | `window.alert/prompt`; kayıt UX kırık olabilir |
| **admin-settings** | `frontend/public/admin-settings.html`, `systemSettingsService.js` | IS_KURALI_REFERANS | `admin.systemSetting.edit` | Referans | `local_currency` Gate 1 read-only |
| Yedek / log | `admin-backup.html`, `admin-logs.html`, `backupService.js`, `activityLogQueryService.js` | UAT_REFERANS | `admin.backup.*`, `admin.migration.statusDetail` | Referans | `window.confirm` delete |
| **Navigation** | `frontend/public/js/navigation.js` (`GLOBAL_MODULES`, permission listesi) | TEKNIK_TERS_ORNEK + IS_KURALI | Module Registry + PermissionGate | Bırak (dosya) / Referans (menü mantığı) | Hardcoded modül listesi |
| Sayfa route map | `backend/app.js` (static + API mount) | IS_KURALI_REFERANS | Registry-driven routes | Referans | |
| Rol / pozisyon / kullanıcı izin | `database/schema/014_position_permissions.sql`, patch `036-granular-permissions` | IS_KURALI_REFERANS | [01-permission](./01-permission-role-position-blueprint.md) | Referans | |
| **Salary redaction** | `hrService.js` `hr.salary.view_*` | IS_KURALI_REFERANS | field-level redaction | Referans | |
| **Cost redaction** | (V2’de tutarlı API redaction zayıf) | TEKNIK_TERS_ORNEK | `stock.cost.view` | Bırak / yeni | Dashboard maliyet sızıntısı riski |
| **Finance redaction** | (V2 finance modülü yok) | — | `finance.sensitive_amounts.view` | — | V3 yeni |
| Granular seed | `database/patch-036-granular-permissions.js` | TEST_VECTOR_KAYNAGI | permission manifest | Kısmi | Patch taşınmaz; key listesi referans |

### Kırık / istenmeyen davranışlar — TEKNIK_TERS_ORNEK

| Davranış | V2 kanıt | V3 hedef |
|----------|----------|----------|
| **Frontend-only permission** | `navigation.js` L150–151: permission yoksa menü **serbest** | PermissionGate + backend 403 |
| **Boş permission listesiyle gevşek görünürlük** | `hasPermissionAccess`: `requiredPermission` yok → true | Explicit deny; registry `active` |
| **Hardcoded navigation** | `navigation.js` `GLOBAL_MODULES` | DB/module manifest |
| **Admin permission panel sorunları** | `admin.js` alert/prompt; karmaşık rol/kullanıcı UI | Manifest + merkezi FormDialog |
| **super_admin her şeye frontend’de açık** | `user.isSuperAdmin` nav bypass | Backend her endpoint’te guard |

---

## 7. UI referansları

| Konu | V2 | V3 |
|------|-----|-----|
| Görsel tasarım | `frontend/public/style.css`, sayfa içi CSS | **KOPYALAMA_YASAK** → [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) |
| HTML/JS sayfaları | `frontend/public/*.html`, `js/*.js` | **KOPYALAMA_YASAK** — behavior-only port |
| Bildirim | `js/ui-notify.js`, `ui-format.js` | V3 UI kit toast/format |
| Modal akışları | `#stockInModal`, `#voidReasonDlg`, `#prViewDlg`, `goods-receipt` dialog | **UI_AKIS_REFERANS** → [12-modal-flow-inventory.md](./12-modal-flow-inventory.md) |
| `window.prompt` / `alert` / `confirm` | `goods-receipt.html`, `hr-settings.js`, `hr-structure.js`, `admin.js`, `project-control.js`, … | **TEKNIK_TERS_ORNEK** — V3: ConfirmDialog / FormModal |

### V3 UI otoritesi (kopyalama yok)

| Kaynak | Amaç |
|--------|------|
| [docs/mockups/factoryos-v3-home-preview.html](../mockups/factoryos-v3-home-preview.html) | AppShell / home |
| [docs/mockups/factoryos-v3-admin-preview.html](../mockups/factoryos-v3-admin-preview.html) | Admin hub |
| [docs/mockups/factoryos-v3-design-preview.html](../mockups/factoryos-v3-design-preview.html) | Bileşen önizleme |
| [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) | Görsel yön **FROZEN** |

---

## 8. Currency / i18n referansları

Kaynak spec: [05-country-currency-language.md](./05-country-currency-language.md)

| Konu | V2 dosya / yol | Referans tipi | V3 | Taşıma | Not |
|------|----------------|---------------|-----|--------|-----|
| Satınalma currency/fx | `purchasingService.js`, `purchase_order_items.currency`, `fx_rate` | IS_KURALI_REFERANS | Money + FX snapshot | Referans | |
| HR salary currency | `hr-employee-form.js`, `hrService.js` compensation | IS_KURALI_REFERANS | `salary_currency` + backend WageEngine | Referans | Frontend `UZS` default |
| Project cost UZS/USD | `project-control.js`, `projectControlService.js` (`projects.control.price.*.view`) | IS_KURALI_REFERANS | project costing gate 6+ | Referans | Permission redaction örneği |
| Dashboard currency | `frontend/public/js/app.js` `dashboardCurrency = 'UZS'` | TEKNIK_TERS_ORNEK | tenant `local_currency` | Bırak | |
| **i18n dosyaları** | `frontend/public/i18n/tr.json`, `en.json`, `ru.json`, `uz.json` + `js/i18n.js` | IS_KURALI_REFERANS (key kapsamı) | V3 i18n aynı 4 dil | Kısmi | Key’ler kopyalanmaz; kapsam referans |
| Metin normalizasyon | `backend/utils/textNormalize.js` `toUpperTr` | IS_KURALI_REFERANS | zorunlu util | Referans | |

### Taşınmayacaklar (currency/i18n)

| V2 desen | Etiket |
|----------|--------|
| Hardcoded `UZS` / `USD` frontend varsayılanları | TEKNIK_TERS_ORNEK |
| `SYSTEM` currency alias | KOPYALAMA_YASAK |
| Frontend para / maaş / KPI hesap motorları | TEKNIK_TERS_ORNEK |
| Raw i18n key’in UI’da görünmesi | TEKNIK_TERS_ORNEK |

---

## 9. Finance referansları

V2’de **tam finance modülü yoktur** (ayrı `finance_*` servis/ekran yok). Aşağıdakiler Gate 5 operasyonel finans için **referans parçalarıdır**:

| Konu | V2 kaynak | V3 karşılığı | Referans tipi |
|------|-----------|--------------|---------------|
| Satınalma fiyat / FX | `purchasingService.js`, PO item fiyatları | `finance.pendingCost`, invoice match | IS_KURALI_REFERANS |
| Stok pending cost ihtiyacı | Mal kabul + layer fiyat güncelleme (m² legacy) | pending vs final (P2, F3) | IS_KURALI_REFERANS + TEKNIK_TERS_ORNEK |
| HR payroll snapshot | `employee_month_payroll_snapshot`, `hr-payroll` UI | Gate 5 avans öncesi personel maliyet | IS_KURALI_REFERANS |
| Project cost UZS/USD | `project-costs.html`, `projectControlService` | Gate 6+ costing | UAT_REFERANS |
| Dashboard toplamları | `dashboardService.js` | `finance.report` / KPI (redacted) | TEKNIK_TERS_ORNEK (m² değerleme) |
| Activity log | `activityLogService.js` | audit trail | IS_KURALI_REFERANS |

Detay sözleşme: [09-finance-data-contract.md](./09-finance-data-contract.md) (F1–F6).

---

## 10. Test vektörü kaynakları

Fixture hedef yolu (henüz oluşturulmadı): `docs/v3-spec/fixtures/`

| Fixture dosyası | V2 kaynak | Üretim yöntemi |
|-----------------|-----------|----------------|
| `hr-wage-vectors.json` | `backend/scripts/wage-breakdown-smoke.js`, `computeWageBreakdown` senaryoları | Smoke script çıktısı + HR spec §11 |
| `hr-attendance-vectors.json` | `hrService.js` attendance + `hr-attendance.js` edge cases | Gece aşan, mola, H5 red/override |
| `stock-fifo-vectors.json` | `stockCostLayerService.js`, `stockMovementService.js` | Katman tüketim sırası — **m² örnekleri negatif test** |
| `purchasing-complete-vectors.json` | `purchase-processing.js` complete, `purchasingService` buyer-action | Eksik fiyat, placeholder supplier |
| `pending-cost-vectors.json` | `purchasingService` layer price update, GR | Pending update vs correction (P2) |
| `permission-redaction-vectors.json` | `hrService` salary null, `projectControlService` price hide | API response `redacted` alanları |

**Durum:** [00-gate0-open-decisions.md](./00-gate0-open-decisions.md) **HR-TST** → **İNCELEMEDE** (dosyalar: [hr-wage-vectors.json](./fixtures/hr-wage-vectors.json), [hr-attendance-vectors.json](./fixtures/hr-attendance-vectors.json))

---

## 11. Do not port listesi (V2C5 başlangıç)

Kaynak: [11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md) · bu belge V2C5 indeksidir.

| # | Öğe | Etiket | Not |
|---|-----|--------|-----|
| 1 | `frontend/public/style.css` ve sayfa özel CSS | KOPYALAMA_YASAK | V3 mockup + design system |
| 2 | `database/patch-*.js`, `run-patches.js` zinciri | KOPYALAMA_YASAK | V3 temiz migration |
| 3 | Frontend maaş / puantaj / KPI hesap motorları | TEKNIK_TERS_ORNEK | `computeWageBreakdown` yalnız backend |
| 4 | m² legacy FIFO (`cost_uzs_per_m2`, `qty_m2_remaining`) | TEKNIK_TERS_ORNEK | Unit-cost FIFO |
| 5 | Hardcoded `navigation.js` modül listesi | TEKNIK_TERS_ORNEK | Module registry |
| 6 | Hardcoded para birimi (`UZS` default, `__erpCurrency`) | TEKNIK_TERS_ORNEK | Money config |
| 7 | `SYSTEM` currency alias | KOPYALAMA_YASAK | |
| 8 | Frontend-only permission (nav serbest) | TEKNIK_TERS_ORNEK | API 403 + PermissionGate |
| 9 | `window.prompt` / `alert` / `confirm` iş akışları | TEKNIK_TERS_ORNEK | Merkezi ConfirmDialog |
| 10 | V2 workaround’ları (buyer/receipt status patch karmaşası) | Bırak | V3 net state machine |
| 11 | Admin permission panel UX borçları | TEKNIK_TERS_ORNEK | Manifest-first |
| 12 | `frontend/public` komple kopya | KOPYALAMA_YASAK | |
| 13 | Ürün sayfasında stok miktarı | TEKNIK_TERS_ORNEK | Stok Kontrol ayrı |
| 14 | Mal kabulde fiyat değiştirme (V2 layer patch) | Kısmi bırak | V3 pending/final ayrımı |
| 15 | Dashboard m² FIFO değerleme | TEKNIK_TERS_ORNEK | |

---

## 12. V2C2 kapanış önerisi

### V2C2 — Hangi V2 ekranları UAT referansı olacak?

**Öneri:**

Bu belge **V2C2 için referans indeksidir**. İlgili modül gate’i başlamadan, aşağıdaki ekranlar UAT davranışı için incelenecek; **kod kopyalanmayacak**.

| Gate | V2 UAT ekranları (minimum) |
|------|---------------------------|
| Gate 2 HR | `hr-employees`, `hr-employee-form`, `hr-attendance`, `hr-attendance-monthly`, `hr-payroll`, `hr-compensation`, `hr-settings` |
| Gate 3 Stock | `stock-products`, `stock-in`, `stock-out`, `stock-movements`, `stock-warehouses`, `goods-receipt` (fiziksel) |
| Gate 4 Purchasing | `purchase-requests`, `purchase-approvals`, `purchase-processing`, `goods-receipt` |
| Gate 5 Finance | (V2 ekran yok) — purchasing/HR/dashboard parçaları |
| Gate 1 Admin | `admin`, `admin-users`, `admin-permissions`, `admin-settings`, `admin-logs`, `admin-backup` |
| Gate 6+ Project | `projects`, `project-control`, `project-costs` |

**Durum:** **ÖNERİLDİ / İnceleme** — [00-gate0-open-decisions.md](./00-gate0-open-decisions.md) V2C2 satırı bu belgeye linklenir.

---

## 13. Çapraz referanslar (tüm modüller)

| Konu | V2 dosya | V3 | Etiket |
|------|----------|-----|--------|
| Metin normalizasyon | `backend/utils/textNormalize.js` | `toUpperTr` zorunlu | IS_KURALI_REFERANS |
| Audit log yazma | `backend/services/activityLogService.js` | `audit_events` standardı (I6) | IS_KURALI_REFERANS |
| Audit log okuma | `backend/services/activityLogQueryService.js` | `admin` log ekranı | UAT_REFERANS |
| Oturum / auth | `backend/services/authService.js`, `routes/authRoutes.js` | G1-1 auth modeli | IS_KURALI_REFERANS |
| Public config | `controllers/publicConfigController.js` | tenant config API | IS_KURALI_REFERANS |
| Telegram (HR) | `backend/services/telegramService.js` | opsiyonel / sonra | Bırak (Gate 0 dışı) |

---

## 14. Kabul kriterleri

- [x] HR referansları listelendi (§3)
- [x] Stock referansları listelendi (§4)
- [x] Purchasing referansları listelendi (§5)
- [x] Admin/Permission referansları listelendi (§6)
- [x] UI carry/drop ayrımı yazıldı (§7)
- [x] Currency/i18n referansları yazıldı (§8)
- [x] Finance referansları yazıldı (§9)
- [x] Test fixture kaynakları listelendi (§10)
- [x] Do not port listesi oluşturuldu (§11)
- [x] V2C2 için kapanış önerisi yazıldı (§12)
- [x] Kod yazılmadı
- [x] V2 dosyaları değiştirilmedi

---

## 15. Belge durumu

**Durum: TASLAK / İNCELEME**

**Sonraki önerilen adım:** HR test fixture hazırlığı — `docs/v3-spec/fixtures/hr-wage-vectors.json` ve `hr-attendance-vectors.json` (kaynak: §10, [06-hr-full-blueprint.md](./06-hr-full-blueprint.md) §11.4).

**Spec yazım notu:** Her `0x-*.md` dosyasının **V2 Referans** bölümü bu indekse linklenmelidir.
