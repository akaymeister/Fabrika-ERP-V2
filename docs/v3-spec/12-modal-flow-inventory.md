# FactoryOS V3 — Modal Flow Inventory

**Belge türü:** Gate 0 UI / UX spec  
**Durum:** ☐ TASLAK | ☑ İNCELEME | ☐ FROZEN  
**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026  
**Minimum kayıt:** ≥20 (bu belgede **70+** flowId)

**İlişkili belgeler:**

- [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) — görsel FROZEN
- [01-central-ui-design-system.md](./01-central-ui-design-system.md) — bileşen API (Gate 1)
- [11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md) — V2 akış referans, kod kopyası yok
- Domain: [06-hr](./06-hr-full-blueprint.md), [07-stock](./07-stock-full-blueprint.md), [08-purchasing](./08-purchasing-full-blueprint.md), [09-finance](./09-finance-data-contract.md), [02-admin](./02-admin-control-system.md)

**Gate 0 kuralı:** Bu belge FROZEN olmadan Gate 1 merkezi UI kit modal bileşen kodu **yazılmaz**.

---

## 1. Amaç

FactoryOS V3’te tüm modüllerde kullanıcı etkileşimleri **standart modal dili** ile yönetilir:

| Akış türü | Bileşen |
|-----------|---------|
| Create / edit | FormModal, FormDialog |
| Onay / red / iptal | ConfirmDialog, ApprovalDialog |
| İçe aktarma | ImportWizard + duplicate review |
| Detay | DetailDrawer |
| Yazdır | PrintPreviewDialog |
| Çok adım | Wizard |

**Hedef:** Aynı buton düzeni, hata/başarı davranışı, permission kontrolü, audit disiplini — modül başına özel popup sistemi **yok**.

---

## 2. Ana ilke

> Her popup/modal **merkezi UI kit** üzerinden çalışır ([00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md)).

### 2.1 Bileşenler (Gate 1)

| Bileşen | Kullanım |
|---------|----------|
| `Modal` / `FormModal` | Genel çerçeve |
| `FormDialog` | Form + footer aksiyonlar |
| `ConfirmDialog` | Onay / iptal / destructive |
| `ApprovalDialog` | Onay + reason + audit |
| `Drawer` / `DetailDrawer` | Yan panel detay |
| `Wizard` | Çok adımlı işlem |
| `ImportWizard` | Excel / toplu içe aktarma |
| `PrintPreviewDialog` | Zimmet, irsaliye, rapor |

### 2.2 Yasaklar

| Yasak |
|-------|
| `window.alert`, `window.confirm`, `window.prompt` |
| Sayfa içi rastgele `position:fixed` popup |
| Modüle özel modal CSS |
| Permission **yalnızca** frontend (API guard şart) |

---

## 3. Flow kayıt şeması (standart alanlar)

Her `flowId` için envanterde şu alanlar tanımlıdır:

| Alan | Açıklama |
|------|----------|
| `flowId` | Global unique: `{module}.{entity}.{action}` |
| `module` | hr / stock / purchasing / finance / admin / project |
| `title` | i18n key (`modal.{flowId}.title`) |
| `type` | FormModal, ConfirmDialog, … |
| `trigger` | Buton / satır aksiyonu / menü |
| `required_permissions` | UI PermissionGate |
| `backend_guard` | API `requirePermission` |
| `data_owner` | Sahip modül servisi |
| `creates_records` | Y/N |
| `updates_records` | Y/N |
| `audit_required` | Y/N |
| `confirmation_required` | Y/N (ConfirmDialog) |
| `destructive` | Y/N |
| `status` | Planlandı / İnceleme / Gate N |
| `notes` | Özel kurallar, V2 referans |

**Kısaltmalar (tablolarda):** C=create, U=update, A=audit, CF=confirm, D=destructive

---

## 4. Modal tipleri

| Tip | Açıklama | Örnek |
|-----|----------|--------|
| **FormModal** | Yeni kayıt / düzenleme formu | `stock.product.create` |
| **ConfirmDialog** | Silme, iptal, tamamlama onayı | `stock.void.confirm` |
| **ApprovalDialog** | Onay + reason + audit | `purchasing.request.approveConfirm` |
| **ImportWizard** | Excel + duplicate review | `stock.product.importExcel` |
| **DetailDrawer** | Read-only / kısıtlı edit detay | `stock.fifoLayer.detail` |
| **PrintPreviewDialog** | Yazdırılabilir çıktı | `inventory.printAgreement` |
| **Wizard** | Çok adımlı | `purchasing.receipt.receive` |

---

## 5. Global modal kuralları

| Kural | Detay |
|-------|--------|
| Esc / backdrop | Normal form: kapatılabilir; **destructive / approval: backdrop kapatmaz** |
| Unsaved changes | Close öncesi ConfirmDialog (M6) |
| Submit | Buton disable + çift tıklama engeli |
| Hata | Modal içi `Alert` / field errors |
| Başarı | Toast + modal kapanır (veya sonraki adım) |
| Audit | `reason` zorunlu (ApprovalDialog) |
| Permission | Trigger gizli + API **403** |
| Responsive | §15; mobile full-width |
| V2 | Akış mantığı referans; **kod/CSS kopyası yok** ([11](./11-v2-carry-and-drop.md)) |

---

## 6. HR modal flows

**Özel:** Maaş alanları `hr.salary.*`; vardiya H1 C+B ([06](./06-hr-full-blueprint.md)).

| flowId | type | permissions | backend_guard | C | U | A | CF | D | notes |
|--------|------|-------------|---------------|---|---|---|----|---|-------|
| hr.employee.create | FormModal | hr.employees.create | same | Y | — | Y | — | — | toUpperTr |
| hr.employee.edit | FormModal | hr.employees.edit | same | — | Y | Y | — | — | |
| hr.employee.terminate | ApprovalDialog | hr.employees.terminate | same | — | Y | Y | Y | Y | termination_date zorunlu |
| hr.employee.linkUser | FormModal | hr.employees.edit | same | — | Y | Y | Y | — | duplicate employee yok |
| hr.compensation.update | FormModal | hr.salary.edit, hr.compensation.edit | same | Y | — | Y | Y | — | revision API; redaction |
| hr.attendance.dailyEntry | FormModal | hr.attendance.create/edit | same | Y | Y | Y | — | — | datetime+shift C+B |
| hr.attendance.monthLockConfirm | ConfirmDialog | hr.attendance.lock | same | — | Y | Y | Y | — | snapshot üretir |
| hr.attendance.override | ApprovalDialog | hr.attendance.override | same | — | Y | Y | Y | — | leave+saat H5 |
| hr.shift.create | FormModal | hr.shifts.edit | same | Y | — | Y | — | — | crosses_midnight |
| hr.shift.assign | FormModal | hr.shifts.edit | same | Y | Y | Y | — | — | effective_from |
| hr.payroll.snapshotReview | DetailDrawer | hr.payroll.view | same | — | — | — | — | — | read-only frozen |
| hr.settings.dayTypeEdit | FormModal | hr.settings.edit | same | — | Y | Y | — | — | |
| hr.settings.workStatusEdit | FormModal | hr.settings.edit | same | — | Y | Y | — | — | |

---

## 7. Stock modal flows

**Özel:** Ürün popup stok oluşturmaz; maliyet `stock.cost.view`; manuel P5-C; OUT `project_id` zorunlu.

| flowId | type | permissions | backend_guard | C | U | A | CF | D | notes |
|--------|------|-------------|---------------|---|---|---|----|---|-------|
| stock.product.create | FormModal | stock.products.create | same | Y | — | Y | — | — | m² helper only |
| stock.product.edit | FormModal | stock.products.edit | same | — | Y | Y | — | — | |
| stock.product.importExcel | ImportWizard | stock.products.import | same | Y | — | Y | — | — | no stock qty |
| stock.product.duplicateReview | FormModal | stock.products.import | same | — | Y | Y | Y | — | merge/skip |
| stock.brand.create | FormModal | stock.brands.edit | same | Y | — | Y | — | — | |
| stock.category.create | FormModal | stock.categories.edit | same | Y | — | Y | — | — | |
| stock.warehouse.create | FormModal | stock.warehouses.create | same | Y | — | Y | — | — | |
| stock.receipt.selectPO | FormModal | stock.receipts.view | same | — | — | — | — | — | Purchasing PO list |
| stock.receipt.receive | Wizard | stock.receipts.create | same | Y | Y | Y | — | — | StockPort.recordIn |
| stock.receipt.overReceiveApproval | ApprovalDialog | stock.receipts.over_receive_approve | same | — | Y | Y | Y | — | P4 tolerans |
| stock.receipt.underReceiveCloseApproval | ApprovalDialog | stock.receipts.under_receive_close_approve | same | — | Y | Y | Y | — | P5 onay |
| stock.manual.request | FormModal | stock.in.manual.request | same | Y | — | Y | — | — | |
| stock.manual.approve | ApprovalDialog | stock.in.manual.approve | same | — | Y | Y | Y | — | sonra IN |
| stock.out.projectIssue | FormModal | stock.out.create | same | Y | — | Y | — | — | project_id zorunlu |
| stock.control.filter | FormModal | stock.control.view | same | — | — | — | — | — | filter only |
| stock.fifoLayer.detail | DetailDrawer | stock.cost.view | same | — | — | — | — | — | redacted w/o perm |
| stock.void.confirm | ApprovalDialog | stock.void.create | same | — | Y | Y | Y | Y | reason; reverse mv |
| stock.adjustment.create | FormModal | stock.adjustment.create | same | Y | — | Y | Y | — | |
| stock.shipment.createDeliveryNote | Wizard | stock.shipment.create | same | Y | — | Y | — | — | Gate 6+ hazırlık |
| inventory.assetCreate | FormModal | inventory.assets.create | same | Y | — | Y | — | — | I2 modül |
| inventory.serialEntry | FormModal | stock.receipts.create | same | — | Y | Y | — | — | GR’de SN |
| inventory.assign | FormModal | inventory.assignment.create | same | Y | — | Y | Y | — | |
| inventory.return | ApprovalDialog | inventory.assignment.return | same | — | Y | Y | Y | — | iade formu |
| inventory.printAgreement | PrintPreviewDialog | inventory.assignment.print | same | — | — | Y | — | — | 2 sayfa |

---

## 8. Purchasing modal flows

**Özel:** price≠complete; placeholder supplier block; GR’de fiyat yok; product popup no stock.

| flowId | type | permissions | backend_guard | C | U | A | CF | D | notes |
|--------|------|-------------|---------------|---|---|---|----|---|-------|
| purchasing.request.create | FormModal | purchasing.request.create | same | Y | — | Y | — | — | P1 project opt |
| purchasing.request.edit | FormModal | purchasing.request.edit | same | — | Y | Y | — | — | draft only |
| purchasing.request.approveConfirm | ApprovalDialog | purchasing.request.approve | same | — | Y | Y | Y | — | |
| purchasing.request.rejectConfirm | ApprovalDialog | purchasing.request.reject | same | — | Y | Y | Y | Y | reason |
| purchasing.order.createFromRequest | ConfirmDialog | purchasing.order.create | same | Y | — | Y | Y | — | |
| purchasing.order.process | ConfirmDialog | purchasing.order.process | same | — | Y | Y | Y | — | buyer start |
| purchasing.order.priceEntry | FormModal | purchasing.order.price.edit | same | — | Y | Y | — | — | **≠ complete** |
| purchasing.order.completeConfirm | ConfirmDialog | purchasing.order.complete | same | — | Y | Y | Y | — | validation all lines |
| purchasing.receipt.selectOrder | FormModal | purchasing.receipt.view | same | — | — | — | — | — | |
| purchasing.receipt.receive | Wizard | purchasing.receipt.create | same | Y | Y | Y | — | — | → StockPort |
| purchasing.receipt.overReceiveApproval | ApprovalDialog | purchasing.receipt.over_receive_approve | same | — | Y | Y | Y | — | |
| purchasing.receipt.underReceiveCloseApproval | ApprovalDialog | purchasing.receipt.under_receive_close_approve | same | — | Y | Y | Y | — | P5 |
| purchasing.product.createPopup | FormModal | purchasing.product.create | same | Y | — | Y | — | — | P6; not request.create |
| purchasing.supplier.create | FormModal | purchasing.supplier.create | same | Y | — | Y | — | — | party link later |
| purchasing.priceRevision.create | FormModal | purchasing.price_revision.create | same | Y | — | Y | Y | — | |
| purchasing.priceFinalization.initiate | ApprovalDialog | purchasing.price_revision.create | same | Y | — | Y | Y | — | F4 step 1 |

---

## 9. Finance modal flows

**Özel:** `finance.sensitive_amounts.view`; invoice post → movement; payment OUT/IN.

| flowId | type | permissions | backend_guard | C | U | A | CF | D | notes |
|--------|------|-------------|---------------|---|---|---|----|---|-------|
| finance.party.create | FormModal | finance.parties.create | same | Y | — | Y | — | — | |
| finance.party.edit | FormModal | finance.parties.edit | same | — | Y | Y | — | — | |
| finance.invoice.create | FormModal | finance.invoices.create | same | Y | — | Y | — | — | draft |
| finance.invoice.matchPurchase | Wizard | finance.invoices.create | same | — | Y | Y | — | — | PO/GR lines |
| finance.invoice.postConfirm | ConfirmDialog | finance.invoices.edit | same | — | Y | Y | Y | — | **F1 movement** |
| finance.payment.create | FormModal | finance.payments.create | same | Y | — | Y | — | — | direction OUT/IN |
| finance.payment.allocate | Wizard | finance.payments.create | same | — | Y | Y | — | — | allocations |
| finance.collection.create | FormModal | finance.collections.create | same | Y | — | Y | — | — | direction=IN |
| finance.pendingCost.resolve | ApprovalDialog | finance.pending_cost.resolve | same | — | Y | Y | Y | — | F3 final |
| finance.priceFinalization.approve | ApprovalDialog | finance.price_finalization.approve | same | — | Y | Y | Y | — | F4 step 2 |
| finance.bankAccount.create | FormModal | finance.bank_accounts.edit | same | Y | — | Y | — | — | F6 |
| finance.report.filter | FormModal | finance.reports.view | same | — | — | — | — | — | filter only |

---

## 10. Admin / Registry / Permission modal flows

| flowId | type | permissions | backend_guard | C | U | A | CF | D | notes |
|--------|------|-------------|---------------|---|---|---|----|---|-------|
| admin.user.create | FormModal | admin.users.create | same | Y | — | Y | — | — | employee link opt |
| admin.user.disableConfirm | ApprovalDialog | admin.users.edit | same | — | Y | Y | Y | Y | |
| admin.user.resetPassword | ConfirmDialog | admin.users.edit | same | — | Y | Y | Y | — | |
| admin.role.create | FormModal | admin.roles.edit | same | Y | — | Y | — | — | |
| admin.role.permissionEdit | FormModal | admin.roles.edit | same | — | Y | Y | Y | — | |
| admin.position.permissionEdit | FormModal | admin.structure.edit | same | — | Y | Y | Y | — | position_permissions |
| admin.userPermission.exceptionCreate | ApprovalDialog | admin.users.permissions | same | Y | — | Y | Y | — | **reason zorunlu** |
| admin.module.toggleActiveConfirm | ConfirmDialog | admin.registry.edit | same | — | Y | Y | Y | Y | API 403 pasif |
| admin.page.toggleActiveConfirm | ConfirmDialog | admin.registry.edit | same | — | Y | Y | Y | — | |
| admin.card.toggleVisibleConfirm | ConfirmDialog | admin.registry.edit | same | — | Y | Y | Y | — | |
| admin.action.permissionEdit | FormModal | admin.registry.edit | same | — | Y | Y | Y | — | erp_page_actions |
| admin.systemSetting.edit | FormModal | admin.settings.edit | same | — | Y | Y | Y | — | local_currency RO |
| admin.backup.createConfirm | ConfirmDialog | admin.backup.create | same | Y | — | Y | Y | — | |
| admin.migration.statusDetail | DetailDrawer | admin.migration.view | same | — | — | — | — | — | read-only |
| admin.modules.registerConfirm | ConfirmDialog | admin.modules.register | same | — | Y | Y | Y | — | manifest sync |

---

## 11. Project / future modal flows (Gate 6+)

**Not:** Kod yok; envanter hazırlık.

| flowId | type | permissions (taslak) | notes |
|--------|------|------------------------|-------|
| project.create | FormModal | project.create | |
| project.codeGeneratePreview | ConfirmDialog | project.create | |
| project.boq.importExcel | ImportWizard | project.boq.edit | |
| project.boq.duplicateReview | FormModal | project.boq.edit | |
| project.boq.approveConfirm | ApprovalDialog | project.boq.approve | |
| project.delivery.shipmentCreate | Wizard | project.delivery.create | stock.shipment link |
| project.costing.review | DetailDrawer | project.costing.view | |
| project.status.changeConfirm | ConfirmDialog | project.edit | |

---

## 12. Modal permission standardı

```text
UI: PermissionGate.has(required_permissions) → trigger render
API: requirePermission(backend_guard) → 403 if missing
Response: sensitive fields redacted per module perm
```

| Senaryo | Beklenen |
|---------|----------|
| Trigger gizli | Kullanıcı butonu görmez |
| Direct API | **403** + audit attempt (opsiyonel) |
| Partial perm | Alan bazlı redaction (maaş/maliyet/finans) |

**MT-01, MT-02, MT-08–10**

---

## 13. Modal audit standardı

Audit **zorunlu** flow tipleri: approval, reject, cancel, disable, permission change, salary change, stock void, manual stock approve, price finalization, invoice post, backup, modules register.

| Alan | Tip |
|------|-----|
| actor_user_id | FK |
| action | string (flowId önerilir — M4) |
| entity_type | string |
| entity_id | bigint |
| before_snapshot | JSON? |
| after_snapshot | JSON? |
| reason | string? (ApprovalDialog zorunlu) |
| created_at | datetime |

**MT-15, MT-18**

---

## 14. Modal UX standardı

### 14.1 Footer buton sırası

| Konum | Buton |
|-------|--------|
| Sol | Cancel / Close |
| Sağ | Secondary → **Primary** |

### 14.2 Destructive

- `variant="danger"`
- `reason` textarea (ApprovalDialog)
- Açıklama: “Karşı kayıt oluşturulur” / “Geri alınamaz”

### 14.3 Form

- Required `*`
- Inline validation
- Loading spinner on primary
- Success → toast
- Error → modal `Alert`

---

## 15. Responsive modal standardı

| Breakpoint | Genişlik |
|------------|----------|
| sm | 420px |
| md | 640px |
| lg | 860px |
| xl | 1080px |
| Mobile | full-width, safe-area padding |

| Kural | |
|-------|--|
| Uzun form | Scrollable body; fixed header/footer |
| Geniş tablo | DetailDrawer veya full-screen modal (M5) |

**MT-16**

---

## 16. Test / doğrulama senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| MT-01 | Perm yok | Trigger gizli |
| MT-02 | Direct API | 403 |
| MT-03 | Destructive no reason | Submit disabled |
| MT-04 | Unsaved close | Confirm uyarı |
| MT-05 | Double submit | Button disabled |
| MT-06 | Success | Toast |
| MT-07 | Validation error | Modal içi hata |
| MT-08 | HR salary modal | Redaction |
| MT-09 | Stock cost drawer | Redaction |
| MT-10 | Finance amount | Redaction |
| MT-11 | Excel duplicate | Review modal |
| MT-12 | Over receive | ApprovalDialog |
| MT-13 | PO complete invalid | Block + message |
| MT-14 | Invoice post | Movement + close |
| MT-15 | Perm exception | Reason required |
| MT-16 | Mobile | No overflow |
| MT-17 | Print preview | Render + print |
| MT-18 | flowId log | activity_logs action |

---

## 17. Riskler

| Risk | Azaltma |
|------|---------|
| Envanter yok | Bu belge Gate 0 zorunlu |
| UI-only perm | §12 + MT-02 |
| Dev form in modal | Drawer / full-screen |
| Print geç | inventory/finance flows erken |
| Approval no audit | §13 + ApprovalDialog |
| Excel dup review eksik | stock/purchasing import flows |

---

## 18. Açık kararlar

| # | Karar | Durum |
|---|--------|--------|
| **M1** | Drawer vs modal detay | Açık |
| **M2** | Wizard standardı Gate 1 vs modül | Açık |
| **M3** | PrintPreview Gate 1 kit vs modül | Açık |
| **M4** | flowId her audit log’da | Öneri: evet |
| **M5** | Mobile full-screen tüm formlar | Açık |
| **M6** | Unsaved changes guard zorunlu | Öneri: Gate 1 evet |

---

## 19. Kabul kriterleri (Gate 0)

- [ ] Global modal standartları onaylandı (§5, §14–15)
- [ ] HR flows onaylandı (§6)
- [ ] Stock flows onaylandı (§7)
- [ ] Purchasing flows onaylandı (§8)
- [ ] Finance flows onaylandı (§9)
- [ ] Admin flows onaylandı (§10)
- [ ] Project future flows işaretlendi (§11)
- [ ] Permission standardı onaylandı (§12)
- [ ] Audit standardı onaylandı (§13)
- [ ] MT-01…MT-18 test planına aktarıldı
- [ ] Açık kararlar M1–M6 işaretlendi
- [ ] [11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md) ile uyum (V2 kod kopyası yok)
- [ ] **Durum: FROZEN** (henüz değil)

**Gate 0 kuralı:** FROZEN olmadan Gate 1 UI kit modal kodu **yazılmaz**.

---

## Ek A — V2 akış referansı (kod kopyalanmaz)

| V3 flowId | V2 referans (mantık) |
|-----------|----------------------|
| stock.manual.* | `#stockInModal` → talep+onay modeli |
| stock.void.confirm | `#voidReasonDlg` |
| purchasing.receipt.receive | `#grReceiptDlg`, `window.prompt` → **yasak** |
| purchasing.request.* | `#prViewDlg` |
| purchasing.order.priceEntry | processing dialog |

---

## 20. Belge durumu

**Durum: TASLAK / İNCELEME** — Henüz FROZEN değil.

**Flow sayısı:** 70+ `flowId` (hedef ≥20 aşıldı).

**Sonraki önerilen adım:** [v2-reference-index.md](./v2-reference-index.md) (UI_AKIS); HR fixture; [00-gate0-checklist.md](./00-gate0-checklist.md) PASS.
