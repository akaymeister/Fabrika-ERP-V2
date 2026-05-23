# FactoryOS V3 — Revize Master Blueprint

**Belge türü:** Mimari analiz ve uygulanabilir plan (kod içermez)  
**Referans sistem:** Fabrika ERP V2  
**Tarih:** Mayıs 2026  
**Yaklaşım:** Hızlı mini modül değil; V4 gerektirmeyen sağlam çekirdek

---

## Özet

Bu belge, V2'deki iş mantığını koruyarak (HR ~%95, Stok ~%99, Satınalma ~%95) merkezi UI, admin kontrol, migration, para birimi ve modüler altyapı kurmayı hedefler. V2'nin dağınık CSS, patch karmaşası, m² FIFO ve hardcoded para birimi borçları taşınmaz.

**Temel ilke:** Önce tam analiz + merkezi altyapı → sonra modüller V2 referansıyla uygulanır.

---

## 1. V3 Master Blueprint

### 1.1 Vizyon ve mimari taahhütler

| Taahhüt | Açıklama |
|---------|----------|
| V4 gerektirmeyen çekirdek | Modül/kolon ekleme çekirdeği kırmaz; V3.1/V3.2 ile genişler |
| Merkezi kontrol | UI, izin, menü, ayar, para/dil tek kaynaktan |
| Domain tek kaynak | Hesap/formül backend'de; frontend sadece sunum |
| V2 = spec + UAT | İş kuralı + modal akış envanteri zorunlu |
| Veri geçişi ayrı faz | FIFO V2→V3 otomatik map yok |

### 1.2 Repo yapısı (öneri)

```
FactoryOS-V3/
├── apps/api/                    # Express 5, mysql2, session
├── apps/web/                    # MPA sayfalar
├── packages/ui/                 # Design system
├── packages/domain/             # Saf iş kuralları
├── packages/contracts/          # API DTO, permission keys
├── database/
│   ├── core/migrations/
│   ├── modules/{hr,stock,...}/migrations/
│   └── seeds/
├── docs/v2-spec/
└── tools/migrate.js
```

### 1.3 Faz sırası

| Faz | Süre | İçerik |
|-----|------|--------|
| 0 — Blueprint | Ay 1 | Spec + modal envanteri + entegrasyon haritası |
| 1 — Çekirdek | Ay 1–2 | UI DS, Admin, Migration, Registry, Settings |
| 2 — HR | Ay 2–4 | Tam HR blueprint |
| 3 — Stock | Ay 4–6 | unit_cost FIFO |
| 4 — Purchasing | Ay 6–8 | Tam workflow |
| 5 — Finance | Ay 8–10 | Stok/satınalma sonrası |
| 6 — Projects/Reports | Ay 10+ | |

---

## A) Central UI Design System

### Bileşen kataloğu

| Bileşen | Sorumluluk |
|---------|------------|
| AppShell | sidebar + topbar + main grid |
| Sidebar | Modül menüsü API'den |
| Topbar | Dil, kullanıcı, breadcrumb |
| PageHeader | Başlık, aksiyon slotu |
| Card | Hub kartları, KPI |
| Button | primary/secondary/danger/ghost/link |
| DataTable | Scroll wrapper, sticky header |
| Modal | Stack, focus trap |
| ConfirmDialog | Onay/iptal; prompt yasak |
| Toast | Bildirimler |
| FormField | label, hint, error, i18n |
| FilterBar | Filtreler; tablet'te collapsible |
| Tabs | Sekmeler |
| Pagination | Sunucu sayfalı listeler |
| Badge | Durum etiketleri |
| CurrencyField | local_currency default |
| DateField | locale format |

### Responsive kurallar

| Breakpoint | Genişlik | Kurallar |
|------------|----------|----------|
| Desktop | ≥1366px | Tam sidebar; tam tablo |
| Laptop | 1024–1365px | Daraltılabilir sidebar; yatay scroll |
| Tablet | 768–1023px | Sidebar overlay; modal fullscreen |
| Mobile | <768px | Kritik veri gizlenmez |

**Test matrisi:** 1366×768, 1024×768, 768×1024, 390×844

### CSS stratejisi — 10.000 satır tekrarını önleme

- Tek token dosyası (renk, spacing, font)
- Prefix: .erp-btn, .erp-table — sayfa override yok
- Yasak: body.app-ui-v3.*-page stilleri
- Print: ayrı print.css (max 50 satır/sayfa)
- Lint: sayfalarda inline style yasak

### Modal Flow Registry

**Stok:** stock.in.manual, stock.in.void, stock.in.replace, stock.out.void, stock.out.replace  
**Satınalma:** purchasing.pr.viewApprove, purchasing.order.processing, purchasing.order.cancelLine, purchasing.gr.receipt  
**HR:** hr.attendance.dayDetail, hr.payroll.dispute, hr.employee.compensationRevision

---

## B) Admin Control System

### Registry tabloları

- erp_modules — modül aktif/pasif
- erp_pages — sayfa, path, permissions
- erp_page_cards — hub kartları
- erp_page_actions — buton/aksiyon kontrolü

is_active=false → API 403 + menüde gizli

### Permission modeli (V2 korunur)

1. super_admin → tümü  
2. role_permissions  
3. position_permissions  
4. user_permissions  

Tek kapı: PermissionGate.assert()

### Admin bölümleri

Modül/sayfa/kart/aksiyon, kullanıcı & rol, pozisyon izinleri, ülke profili, para (base_reporting_currency varsayılan USD), dil, marka, audit log, yedek, migration durumu, sistem ayarları

---

## C) Migration & Module System

### Tablolar

- schema_migrations: version, module, checksum, duration_ms
- migration_runs: batch, status, error_message

### Kurallar

- Tek runner (patch-*.js yok)
- Idempotent SQL
- Seed ayrı: npm run db:seed
- module.manifest.json → modules:register
- Yeni kolon: önce migration (nullable/default), sonra kod

---

## D) Currency / Country / Language

| Anahtar | Davranış |
|---------|----------|
| country_code | Ülke seçimi |
| local_currency | Ülkeye bağlı; form varsayılanı |
| base_reporting_currency | Varsayılan USD |
| default_locale | localStorage yoksa kullanılır |

**Parasal kayıt:** amount, currency_code, fx_rate, amount_local, amount_base

**Kurallar:**
- USD otomatik local'e dönüşmez
- SYSTEM alias V3'te yok
- Raporlama: toBase() bilinçli çağrı

---

## 2. Merkezi UI Mimarisi

packages/ui: tokens, layout, components, flows

Her sayfa: AppShell + PageHeader + içerik; özel CSS 0

DataTable: columns (priority, locked), serverSide, rowActions permission filtreli

Modal hiyerarşisi: Toast < ConfirmDialog < Modal < AppShell

---

## 3. Admin Panel Mimarisi

Ekranlar: Hub, Modüller, Sayfalar & kartlar, Kullanıcılar, İzinler, Ülke & para, Dil, Marka, Loglar, Yedek, Migration, Sistem

API: GET /api/admin/navigation, GET /api/public/config, POST /api/admin/modules/register

Yeni modül checklist: manifest, registry seed, permissions, i18n 4 dil, modal flow docs

---

## 4. Migration / Module Registry

Versiyon format: {module}_{seq4}_{slug}

Patlamayı önleme: nullable kolon önce; NOT NULL iki aşama; FK önce index

---

## 5. HR Full Blueprint

**V2 referans:** hrService.js (~4000 satır), %95 çalışıyor

### Varlıklar

departments, positions, employees, employee_attendance, attendance_month_locks, employee_compensation_history, employee_month_payroll_snapshot, payroll_disputes, hr_work_types, hr_work_statuses

### Personel profili

Kimlik, uyruk (TR/UZ/RU/EN/OTHER), demografi, adres (+ post_code V3'te eklenecek), iletişim, hire_date, termination_date (V3 yeni), employment_status, department, position, user_id, foto, telegram

### Maaş — WageEngine

computeWageBreakdown port; compensation-revisions ile değişim; PATCH'te maaş yok

Permissions: hr.salary.view_group + alt kolonlar; GET /employees/:id redaction (V2 gap kapatılacak)

### Puantaj

İş tipi/durumu, multiplier, günlük bulk, aylık liste, mesai (overtime_eligible), proje bağlantısı, ay kilidi

### Bordro snapshot

Kilit → employee_month_payroll_snapshot; disputes; V3'te snapshot okuma varsayılan açık

### Sayfa eşlemesi

hr.hub, hr.employees.*, hr.structure, hr.attendance.*, hr.settings, hr.compensation, hr.payroll

### Finans hazırlığı

my-profile attendance API; employee_advances tablosu

---

## 6. Stock Full Blueprint

**V2 referans:** %99 çalışıyor; borç m² FIFO

### Varlıklar

units, brands, products, warehouses, stock_movements, stock_cost_layers (unit_cost model)

### Unit-cost FIFO (V2 m² taşınmaz)

remaining_quantity, unit, unit_cost, currency_code, fx_rate, line_total_local, line_total_base

unit_cost = line_total_local / primary_qty  
m² sadece primary_unit = M2 ise maliyet birimi

### Akışlar

IN: proje zorunlu, açık PO bloku, PURCHASE_RECEIPT  
OUT: FIFO + proje önceliği  
Void/replace: out_fifo_taken ile restore

### Para birimi

USD otomatik UZS'ye dönüşmez; dashboard SUM(remaining × unit_cost)

### Modal envanteri

stock.in.create/void/replace, stock.out.void/replace

---

## 7. Purchasing Full Blueprint

**V2 referans:** purchasingService.js, %95 çalışıyor

### pr_status

draft → pending → approved|rejected|revision_requested → partial|ordered|cancelled

### Sipariş eksenleri

buyer_state, receipt_status, pricing_status, satır qty_received

### İş akışı

Talep → onay → auto PO → start-processing → fiyat kaydet (complete değil) → sipariş tamamla → mal kabul → stok

### Kısmi teslim

qty_accepted stok artırır; rejected/damaged kayıt only

### V3 sıkılaştırma

Mal kabul varsayılan: buyer_state=completed gerekli; request_status kaldır veya kullan; ready action düzelt

### Modal envanteri

purchasing.pr.view, purchasing.order.processing, purchasing.order.cancelLine, purchasing.gr.receipt

### Finans hazırlığı

purchase_invoices FK; parties supplier link

---

## 8. Finance Tracking Blueprint

Resmi muhasebe değil.

Kapsam: parties, cash/bank, purchase_invoices, payments, collections, AP/AR, employee advances, project link, finance_ledger_entries, opening_balances

Para: amount_local, amount_base; USD otomatik dönüşmez

Sıra: parties → opening → purchase invoice → payment → collections → employee advance → ledger

---

## 9. Modüller Arası Bağlantı Haritası

| Bağlantı | Mekanizma |
|----------|-----------|
| HR ↔ Users | employees.user_id |
| HR ↔ Permissions | position_permissions |
| HR ↔ Purchasing onay | purchasing.request.approve |
| Purchasing ↔ Stock | PURCHASE_RECEIPT → recordMovementIn |
| Stock ↔ Finance | StockCogsRecognized event |
| HR ↔ Finance | parties.employee_id |
| Projects ↔ Stock | ref_type=project, FIFO öncelik |
| Settings ↔ Forms | GET /api/public/config |
| Audit ↔ All | activityLog middleware |

Yasak: purchasingService içinden doğrudan stock SQL — StockPort kullan

---

## 10. V2'den Korunacak / Silinecek

### Korunacaklar

WageEngine, snapshot on lock, attendance kuralları, salary column perms, FIFO proje önceliği, açık PO bloku, void/replace, pr_status akışı, fiyat≠complete, kısmi mal kabul, permission sırası, i18n, audit+backup, toUpperTr

### Silinecekler

10k CSS, sayfa bazlı UI, patch zinciri, cost_uzs_per_m2, SYSTEM→UZS, app.js permission map, navigation hardcode, window.prompt, frontend maaş hesabı, sessiz dashboard fallback

---

## 11. Riskler

| Risk | Azaltma |
|------|---------|
| Blueprint baskısı | Ay 1 kod yok |
| V2↔V3 çift bakım | V2 freeze |
| FIFO cutover | Açılış fişi |
| God service tekrarı | packages/domain |
| HR scope creep | HR Faz1 master only |
| Modal kaybı | flowId UAT checklist |

---

## 12. Kabul Kriterleri

**Çekirdek:** 0 sayfa CSS; admin modül kapatma 403; migration status; default_locale; local_currency formlarda; USD korunur

**HR:** wage test vektörleri; salary redaction; termination_date; ay kilidi snapshot

**Stock:** cost_uzs_per_m2 yok; ADET/M2 doğru FIFO; dashboard unit_cost

**Purchasing:** fiyat complete yapmaz; GR gate; 6 modal UAT

**Mimari:** yeni modül mevcut deploy'u kırmaz

---

## 13. İlk 30 Gün Görev Listesi

### Hafta 1 — V2 spec (kod yok)
Gün 1–5: HR, Stock, Purchasing, Integration, Finance spec docs  
Gün 6–7: Money value object spec

### Hafta 2 — UI Design System
Gün 8–14: Token, AppShell, Button, DataTable, Modal, FormField, CurrencyField spec + demo

### Hafta 3 — Admin + Migration
Gün 15–21: migrate.js, registry tables, auth seed, country_profiles, admin API

### Hafta 4 — Entegrasyon
Gün 22–30: public config, i18n, audit, backup spec, HR schema draft, wage tests, modal registry JSON, demo, blueprint review

---

## 14. İlk 90 Gün Yol Haritası

**Ay 1:** Analiz + çekirdek demo  
**Ay 2:** HR master (dept, position, employee, wage, compensation)  
**Ay 3:** HR puantaj + lock + snapshot; Stock unit FIFO başlangıç  

**Ay 4–6 önizleme:** Stock tamam, Purchasing, Finance parties+AP

---

## Onay Karar Noktaları

1. Depo bazlı stok: Faz1 global (V2), Faz2 depo tablosu?  
2. Manuel stok girişi: super_admin only mi?  
3. Mal kabul gate: buyer_state=completed zorunlu mu? (öneri: evet)  
4. V2 freeze tarihi?  
5. Payroll tam: ay 3 mü ay 6 mı? (öneri: snapshot ay 3, dispute ay 6)

---

## Ek A — V2 Kaynak Dosya İndeksi

| Modül | Kritik dosyalar |
|-------|-----------------|
| HR | backend/services/hrService.js, backend/routes/hrRoutes.js, database/schema/011_hr_module.sql, 012, 021 |
| Stok | backend/services/stockMovementService.js, stockCostLayerService.js, database/schema/004, 010 |
| Satınalma | backend/services/purchasingService.js, backend/constants/purchaseWorkflow.js, database/schema/006 |
| Admin | backend/routes/adminRoutes.js, frontend/public/js/admin-common.js |
| Migration | database/run-patches.js (V2), schema_migrations |
| i18n | frontend/public/js/i18n.js, frontend/public/i18n/tr.json |
| İzin | backend/services/accessService.js, database/patch-036-granular-permissions.js |

## Ek B — Satınalma Modal Akış Envanteri (V2)

| # | Sayfa | Element | flowId önerisi |
|---|-------|---------|----------------|
| 1 | purchase-requests.html | #prViewDlg | purchasing.pr.view |
| 2 | purchase-requests-workflow.js | Print | purchasing.pr.print |
| 3 | purchase-processing.html | #procDlg | purchasing.order.processing |
| 4 | purchase-processing.html | #cancelLineModal | purchasing.order.cancelLine |
| 5 | goods-receipt.html | #grReceiptDlg | purchasing.gr.receipt |
| 6 | goods-receipt.html | window.prompt | purchasing.gr.editReason → ConfirmDialog |

## Ek C — Stok Modal Akış Envanteri (V2)

| Sayfa | Element | flowId |
|-------|---------|--------|
| stock-in.html | #stockInModal | stock.in.create |
| stock-in.html | #voidReasonDlg | stock.in.void |
| stock-out.html | #outVoidDialog | stock.out.void |
| stock-out.html | #outEditDialog | stock.out.replace |

## Ek D — HR Permission Anahtarları (V2 referans)

module.hr, hr.hub.view, hr.employees.view, hr.employees.edit, hr.attendance.view, hr.attendance.edit, hr.attendance.unlock, hr.salary.view_group, hr.salary.view_total, hr.salary.view_rgu_uzs, hr.salary.view_grgu_uzs, hr.salary.view_gu_usd, hr.salary.view_rsu, hr.salary.view_grsu, hr.salary.view_su, hr.salary.edit, hr.salary.history_view, hr.compensation.view, hr.compensation.edit, hr.payroll.view, hr.payroll.edit

## Ek E — Satınalma Durum Özeti

**pr_status:** draft, pending, approved, rejected, revision_requested, partial, ordered, cancelled

**buyer_state:** draft, in_progress, prices_saved, completed

**receipt_status:** pending, partial, completed

**pricing_status:** unpriced, partially_priced, priced

**Kritik iş kuralı:** PUT /pricing stok artırmaz ve siparişi tamamlamaz. Complete ayrı buyer-action.

## Ek F — İlk 30 Gün Günlük Detay (özet tablo)

| Gün | Görev |
|-----|--------|
| 1 | Repo + ADR-001/002 |
| 2 | V2 HR spec dokümanı |
| 3 | V2 Stock spec |
| 4 | V2 Purchasing spec + gap listesi |
| 5 | Integration map |
| 6–7 | Finance blueprint + Money spec |
| 8–14 | UI bileşen spec ve demo |
| 15–21 | Migration runner + registry + admin API |
| 22–25 | public config, i18n, audit, backup spec |
| 26–28 | HR schema draft, wage test vektörleri, modal registry JSON |
| 29 | Demo: login + shell + admin |
| 30 | Blueprint review / onay |

## Ek G — stock_cost_layers V3 Şema (hedef)

- product_id, movement_in_id
- remaining_quantity (primary unit)
- unit (FK units)
- unit_cost, currency_code, fx_rate
- line_total_local, line_total_base
- Taşınmayacak: cost_uzs_per_m2, qty_m2_remaining (maliyet için)

---

*Belge Fabrika ERP V2 kod tabanı analizine dayanır. Uygulama onay sonrası başlar.*

*Dışa aktarma: docs/export-blueprint.py — DOCX ve PDF üretir.*
