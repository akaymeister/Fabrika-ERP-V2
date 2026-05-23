# FactoryOS V3 — Gate Tabanlı Master Blueprint (Revize)

**Belge türü:** Mimari plan — kod içermez  
**Referans:** Fabrika ERP V2 (iş mantığı kaynağı; teknik borç taşınmaz)  
**Zaman modeli:** Takvim yok — sadece Gate tamamlanma ve kabul kriterleri  
**Hedef:** V4 gerektirmeyecek sağlam V3 çekirdeği; hızlı demo değil

---

## Stratejik çerçeve

V1/V2’de modüller hızlı başlayıp sonradan bağlandı → patch karmaşası, UI tutarsızlığı, currency ve stok maliyet modelinin sonradan düzeltilmesi, dağınık permission kontrolleri.

**V3 kuralı:** Bir sonraki Gate’e, önceki Gate’in tüm kabul kriterleri **PASS** olmadan geçilmez. Modül “yarım” deploy edilmez.

```text
Gate 0 (Blueprint Freeze)
    ↓
Gate 1 (Core System Ready)
    ↓
Gate 2 (HR Ready) ─────────────────────────┐
    ↓                                      │ paralel değil — sıralı
Gate 3 (Stock Ready)                       │
    ↓                                      │
Gate 4 (Purchasing Ready)                  │
    ↓                                      │
Gate 5 (Finance Tracking Ready) ←──────────┘
```

**Not:** Gate 2 (HR) ile Gate 3 (Stock) arasında kullanıcı/permission bağımlılığı vardır; Stock, HR Gate’inin “user link + permission” alt kümesi tamamlanmadan başlamaz (detay Gate 2’de).

---

# Gate 0 — Master Blueprint Freeze

## 1. Amaç

Kod yazılmadan önce tüm mimari kararların, modül sınırlarının, entegrasyon sözleşmelerinin ve V2’den taşınacak/taşınmayacak kuralların **donmuş (frozen)** olması. Bu Gate onaylanmadan tek satır üretim kodu yazılmaz.

## 2. Kapsam

| Alan | Çıktı belgesi |
|------|----------------|
| Central UI Design System | Bileşen kataloğu, responsive kurallar, CSS yasağı, test matrisi |
| Admin Control System | Registry modeli, aktif/pasif katmanları |
| Migration & Module Registry | Runner kuralları, manifest, seed ayrımı |
| Permission System | 4 katman çözümleme, catalog yapısı |
| Country / Currency / Language | Money modeli, USD kuralı, locale zinciri |
| HR Full Blueprint | Entity, wage engine, attendance, snapshot spec |
| Stock Full Blueprint | unit_cost FIFO, warehouse balances, m² kuralı |
| Purchasing Full Blueprint | Workflow, pending_cost, GR kuralları |
| Finance Tracking Data Contract | Ledger/parties/AP-AR sözleşmesi (uygulama Gate 5) |
| Integration Map | Modüller arası event/FK/port listesi |
| Taşınacaklar / Taşınmayacaklar | Onaylı liste |
| Modal Flow Inventory | Tüm flowId envanteri (HR, Stock, Purchasing) |

## 3. Kabul kriterleri

- [ ] Tüm tablolar yukarıdaki alanlar için **yazılı spec** mevcut (`docs/v3-spec/` altında)
- [ ] Her modül için **bounded context** ve **yasak bağımlılıklar** tanımlı (ör. Purchasing → Stock sadece `StockPort`)
- [ ] `cost_uzs_per_m2` ve benzeri V2 borçları **taşınmayacaklar** listesinde ve Stock spec’te açıkça yasak
- [ ] `goods_receipt` için **buyer_state=completed zorunlu değil** — Gate 0 spec’te onaylı
- [ ] `pending_cost` / `unpriced` akışı Purchasing spec’te tanımlı
- [ ] Warehouse-based balances Stock spec’te **zorunlu** (V2 global bakiye tek başına yeterli değil)
- [ ] Product **categories** Stock spec’te tanımlı
- [ ] Modal Flow Inventory: minimum 20 kayıtlı akış (HR + Stock + Purchasing)
- [ ] Integration Map: minimum 10 bağlantı sözleşmesi yazılı
- [ ] Paydaş **Blueprint Freeze** imzası / onay kaydı (tarih + versiyon no)

## 4. Riskler

| Risk | Azaltma |
|------|---------|
| Spec yazılırken “sonra hallederiz” | Gate 0 checklist; eksik alan = FAIL |
| V2’den eksik kural çıkarımı | Modül başına V2 dosya indeksi + UAT notları |
| Scope creep spec içinde | Finance Gate 5’te uygulama; Gate 0’da sadece contract |
| Çelişkili kararlar (eski plan vs yeni) | Bu belgedeki GR/buyer_state kuralı authoritative |

## 5. Test senaryoları (dokümantasyon)

| ID | Senaryo | Beklenen |
|----|---------|----------|
| G0-T1 | Spec completeness review | Tüm Gate 0 alanları dosyada |
| G0-T2 | Cross-spec çelişki taraması | Currency kuralları HR/Stock/Purchasing’de aynı |
| G0-T3 | Modal inventory ↔ sayfa eşlemesi | Her V2 kritik dialog bir flowId’ye map |
| G0-T4 | Taşınmayacaklar audit | cost_uzs_per_m2 hiçbir spec’te hedef kolon değil |

## 6. V2 referans noktaları

| Alan | V2 dosya |
|------|----------|
| HR | `backend/services/hrService.js`, `database/schema/011_hr_module.sql` |
| Stock | `backend/services/stockMovementService.js`, `stockCostLayerService.js` |
| Purchasing | `backend/services/purchasingService.js`, `purchaseWorkflow.js` |
| Permission | `backend/services/accessService.js`, `patch-036-granular-permissions.js` |
| Migration (ters örnek) | `database/run-patches.js` — **V3’te kullanılmayacak model** |
| UI (ters örnek) | `frontend/public/style.css` (~10k satır) |

## 7. Tamamlanmadan başlanmayacak işler

- Repo scaffolding (üretim kodu)
- Gate 1 UI bileşen implementasyonu
- Herhangi bir modül migration’ı (HR/Stock/Purchasing)
- V2 veri migrasyonu

---

# Gate 1 — Core System Ready

## 1. Amaç

Tüm modüllerin üzerine inşa edeceği **tek UI dili**, **tek admin/registry**, **tek migration**, **tek permission guard** ve **tek ayar/para/dil** altyapısının çalışır ve test edilmiş olması.

## 2. Kapsam

### UI Design System (`@factoryos/ui`)
- AppShell, Sidebar, Topbar, PageHeader, Card, Button
- DataTable, Modal, ConfirmDialog, Toast
- FormField, FilterBar, Tabs, Pagination, Badge
- CurrencyField, DateField
- Responsive test matrix: 1366, 1024, 768, mobile
- Sayfa özel CSS: **yasak** (print hariç)

### Admin & Registry
- `erp_modules`, `erp_pages`, `erp_page_cards`, `erp_page_actions`
- Modül/sayfa/kart/aksiyon aktif-pasif
- Admin UI (super_admin): registry yönetimi

### Permission
- `PermissionGate`: super_admin → role → position → user
- API + sayfa + nav + action aynı motor

### Migration
- `schema_migrations`, `migration_runs`
- Idempotent SQL runner, checksum, status log
- `module.manifest.json` + `modules:register`
- Seed ayrımı (`db:migrate` vs `db:seed`)

### Settings & Config
- `country_profiles`: country_code, local_currency, default_locale
- `base_reporting_currency` (varsayılan USD)
- `GET /api/public/config` — formlarda gerçek etki
- `default_locale`: localStorage yoksa çalışır
- USD kayıtlar otomatik local’e dönüşmez

### Ops
- `activity_logs` (audit)
- Manuel backup (V2 MVP modeli)

## 3. Kabul kriterleri

- [ ] Demo shell sayfası: tüm bileşenler render; **0 sayfa-özel layout CSS**
- [ ] DataTable: 1366/1024/768’de kritik kolonlar görünür; taşma wrapper scroll ile
- [ ] Modal stack + ConfirmDialog; `window.prompt` kullanılmıyor
- [ ] CurrencyField: config.local_currency varsayılan; USD seçilince submit currency korunur
- [ ] Admin: modül kapatılınca ilgili sayfa API **403** + menüde yok
- [ ] Migration: sıfırdan DB; runner status; başarısız migration sonraki dosyayı çalıştırmaz
- [ ] Yeni test migration + seed: mevcut core’u kırmadan uygulanır
- [ ] Permission: test kullanıcılarıyla 403/200 matrisi geçer
- [ ] Audit: örnek CRUD işlemi loglanır
- [ ] Backup: manuel job oluşturulur, listelenir
- [ ] i18n: tr/en/ru/uz; hardcoded UI metin yok
- [ ] Responsive test matrix dokümante edilmiş ve **PASS**

## 4. Riskler

| Risk | Azaltma |
|------|---------|
| UI paketi yetersiz kalır | Gate 0’da bileşen spec freeze; Gate 1’de demo sayfası |
| Registry over-engineering | MVP: modül+sayfa+kart; action registry basit başlar |
| Migration runner edge case | migration_runs + failed state testleri |
| Config formlara bağlanmaz | CurrencyField/DateField entegrasyon testi zorunlu |

## 5. Test senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| G1-T1 | Pasif modül | API 403, nav gizli |
| G1-T2 | locale zinciri | localStorage boş → default_locale |
| G1-T3 | USD form submit | DB currency_code USD |
| G1-T4 | Migration fail | Sonraki migration çalışmaz; runs tablosunda failed |
| G1-T5 | DataTable 1024px | Yatay scroll; locked kolonlar görünür |
| G1-T6 | Permission position | Pozisyon izni API’yi açar |
| G1-T7 | modules:register idempotent | İkinci çalıştırma duplicate üretmez |

## 6. V2 referans noktaları

| Özellik | V2 | V3 fark |
|---------|-----|---------|
| Layout | `style.css`, `app-ui-v3` | Token + bileşen |
| Nav | `navigation.js` GLOBAL_MODULES | Admin API |
| Permission | `accessService.js` | Aynı sıra, tek gate |
| Settings | `systemSettingsService.js` | country_profiles + ayrılmış currency |
| Migration | `run-patches.js` + untracked schema | Tek runner |
| Admin | `adminRoutes.js`, admin-*.html | Registry-driven |
| Backup/Log | `backupService.js`, `activityLogService.js` | Port + aynı fikir |

## 7. Tamamlanmadan başlanmayacak işler

- HR personel CRUD (Gate 2)
- Stock hareket/FIFO (Gate 3)
- Purchasing workflow (Gate 4)
- Finance ledger (Gate 5)
- V2 canlı veri migrasyonu

---

# Gate 2 — HR Ready

## 1. Amaç

V2’de ~%95 çalışan HR iş mantığının V3’te merkezi sisteme uygun, eksiksiz ve güvenli şekilde yeniden kurulması; finans ve satınalma onayları için personel/kullanıcı/izin omurgasının hazır olması.

## 2. Kapsam

### Personel master
- Employee profile (kimlik, uyruk, adres, iletişim, kimlik belgeleri)
- `hire_date`, **`termination_date`**, `employment_status` (active/passive/terminated)
- Department, position
- User link (1:1, duplicate koruması)
- Photo, note; telegram opsiyonel

### Maaş
- **WageEngine** (V2 `computeWageBreakdown` kuralları)
- Total / official / unofficial; mixed currency + FX
- `employee_compensation_history`; revision-only değişim
- Salary currency per employee

### Puantaj & bordro
- `hr_work_types`, `hr_work_statuses` (+ multiplier)
- Daily bulk attendance, monthly view
- `overtime_eligible`, raw/payable overtime minutes
- Project link on attendance (opsiyonel satır)
- **Monthly lock** + `payroll_usd_uzs_rate` at lock
- **Payroll snapshot** on lock (`employee_month_payroll_snapshot`)
- Payroll disputes (open/approved/rejected/resolved)

### Permission & gizlilik
- `hr.salary.view_group` + granular column keys
- Liste **ve detay** API salary redaction (V2 gap kapatılır)
- `hr.compensation.view` izole (module.hr yetmez)

### UI (merkezi bileşenler)
- Hub, employees list/form/detail, structure, settings
- Attendance daily/monthly/locks, compensation, payroll
- **HR modal flows** (registry’de kayıtlı)

### Finans hazırlığı
- `parties` veya `employee_advances` şema hook
- `my-profile`: gerçek attendance özeti (V2 placeholder kalkar)

### Teknik
- HR modül migrations + seeds
- WageEngine unit/integration test vektörleri (V2’den türetilmiş)
- Activity log entegrasyonu

## 3. Kabul kriterleri

- [ ] V2 wage test vektörleri **%100 PASS**
- [ ] Personel CRUD + compensation revision akışı UAT
- [ ] User link: bir user iki employee’ye bağlanamaz; anlamlı hata
- [ ] Salary: perm yokken `GET /employees/:id` maaş alanı döndürmez
- [ ] Ay kilidi: kilitli ayda attendance yazılamaz
- [ ] Kilitleme: snapshot oluşur; breakdown_json dolu
- [ ] Unlock politikası spec’e uygun (snapshot davranışı dokümante)
- [ ] Tüm HR sayfaları Gate 1 bileşenleriyle; özel CSS yok
- [ ] HR modal flow’ları inventory’deki flowId’lerle eşleşir
- [ ] i18n: tüm statik metinler 4 dilde
- [ ] `toUpperTr` tüm metin girişlerinde
- [ ] Finance hazırlık tabloları/API stub dokümante

## 4. Riskler

| Risk | Azaltma |
|------|---------|
| hrService god object tekrarı | WageEngine, AttendanceService, PayrollService ayrımı |
| Maaş sızıntısı | Detay API redaction testi zorunlu |
| Snapshot/unlock tutarsızlığı | G2-T8, G2-T9 |
| Compensation apply yarım | Ya implement ya spec’ten çıkar; Gate 2’de net |

## 5. Test senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| G2-T1 | Mixed USD/UZS official wage | breakdown doğru |
| G2-T2 | Compensation revision | employees cache güncellenir |
| G2-T3 | Salary perm yok | detail API redacted |
| G2-T4 | Month lock | attendance 409/403 |
| G2-T5 | Lock → snapshot | N employees with attendance → N snapshots |
| G2-T6 | Daily bulk 50 employee | transaction bütünlüğü |
| G2-T7 | User link duplicate | anlamlı 409 |
| G2-T8 | Unlock month | spec’teki snapshot kuralı |
| G2-T9 | Payroll dispute lifecycle | status geçişleri |
| G2-T10 | my-profile linked user | salary own only |

## 6. V2 referans noktaları

| Konu | V2 |
|------|-----|
| Wage engine | `hrService.computeWageBreakdown` |
| Attendance bulk | `saveDailyAttendanceBulk` |
| Lock/snapshot | `lockAttendanceMonth`, `insertPayrollSnapshotsForLockedMonth` |
| Permissions | patch-024, 033, 026, 036 |
| Sayfalar | `hr-*.html`, `hr-common.js` |
| Gap: termination_date | V3 yeni |
| Gap: detail salary leak | V3 düzeltme |
| Gap: structure nav admin.full | V3: hr.employees.edit |

## 7. Tamamlanmadan başlanmayacak işler

- Stock FIFO hareketleri (Gate 3) — *user/permission tamamlandıktan sonra*
- Purchasing approval actor mapping (Gate 4) — *HR user/position hazır olmadan*
- Finance employee payment (Gate 5)
- V2 HR veri migrasyonu (Gate 2 PASS sonrası planlanır)

---

# Gate 3 — Stock Ready

## 1. Amaç

V2’de ~%99 çalışan stok operasyonlarının **unit_cost FIFO** ve **depo bazlı bakiye** ile sıfır m²-maliyet borcuyla kurulması; satınalma mal kabul ve proje tüketimi için hazır stok omurgası.

## 2. Kapsam

### Master data
- Units (m2, adet, kg, plaka, özel)
- Brands
- **Categories** (ürün taksonomisi — V2’de yoktu)
- Products (boyut, m2_per_piece, m3 metadata)
- Warehouses + subcategories

### Bakiye modeli
- **Warehouse-based balances** (`product_id` + `warehouse_id` + qty)
- Hareketler bakiyeyi depo bazında günceller
- Global özet görünüm (raporlama) türetilebilir

### Hareketler
- Stock IN / OUT / adjustment (spec’te tanımlı olanlar)
- `stock_movements`: primary_qty, primary_unit authoritative
- Project ref (ref_type=project) — IN/OUT zorunluluğu V2 ile uyumlu
- Movement source enum (MANUAL, PURCHASE_RECEIPT, …)
- Void IN / void OUT / replace IN / replace OUT

### FIFO (unit_cost — V2 m² modeli yok)
- `stock_cost_layers`: remaining_quantity, unit, unit_cost, currency_code, fx_rate, line_total_local, line_total_base
- `unit_cost = line_total_local / primary_qty`
- **m2_per_piece**: sadece birim çevrimi; maliyet birimi = ürün ana birimi
- **m2 maliyet**: yalnızca ana birim M2 ise
- OUT: `consumed_quantity`, COGS = Σ(qty × unit_cost)
- Project-priority consumption (V2 `layerOutPriority` mantığı)

### Entegrasyon hazırlığı
- `StockPort.recordIn / recordOut` — Purchasing için
- Open PO block (manuel IN) — V2 mantığı
- Dashboard valuation: FIFO unit_cost (sessiz list-price fallback yok)

### UI
- Hub, brands, categories, products, warehouses
- Stock in, stock out, movements
- Void/replace **modal flows**

### Teknik
- Stock migrations + seeds
- FIFO + void/replace otomasyon testleri

## 3. Kabul kriterleri

- [ ] `cost_uzs_per_m2` / `qty_m2_remaining` **kolon yok**
- [ ] ADET ürün: FIFO ADET; M2 ürün: FIFO M2 — ayrı test PASS
- [ ] Depo A’ya IN, Depo B’den OUT → B’de yetersiz stok hatası
- [ ] Negatif stok imkansız (işlem öncesi kontrol + transaction)
- [ ] Void OUT: out_fifo_taken ile katman restore
- [ ] Project priority: aynı üründe proje katmanı önce tüketilir
- [ ] PURCHASE_RECEIPT source ile IN (Gate 4 öncesi mock/port test)
- [ ] Currency: USD hareket local’e otomatik dönmez
- [ ] Dashboard: değerleme formülü dokümante ve testli
- [ ] Tüm sayfalar Gate 1 UI; modal flow inventory eşleşir
- [ ] Migration idempotent; seed units/brands

## 4. Riskler

| Risk | Azaltma |
|------|---------|
| Warehouse balance migration karmaşıklığı | Gate 0’da veri modeli freeze; V2 ETL ayrı plan |
| Void fallback (V2 ilk katman bug) | out_fifo_taken zorunlu; test G3-T5 |
| primary_qty / FIFO uyumsuzluğu | Tek hesap motoru |
| Categories scope | MVP ağaç veya düz liste — spec’te net |

## 5. Test senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| G3-T1 | IN 100 ADET @ 500 UZS/adet | unit_cost=500; remaining=100 |
| G3-T2 | OUT 30 ADET | consumed=30; COGS=15000 |
| G3-T3 | M2 ürün direct m2 | unit_cost m2 başına |
| G3-T4 | Depo izolasyonu | cross-warehouse OUT fail |
| G3-T5 | Void OUT | katmanlar restore |
| G3-T6 | Project priority | proje katmanı önce |
| G3-T7 | Open PO block | manuel IN reject |
| G3-T8 | USD IN | currency USD korunur |
| G3-T9 | Dashboard FIFO | list price fallback yok |
| G3-T10 | Replace IN | eski void + yeni layer |

## 6. V2 referans noktaları

| Konu | V2 | V3 |
|------|-----|-----|
| Hareket | `stockMovementService.js` | unit_cost + warehouse balance |
| FIFO | `stockCostLayerService.js` consumeFifoM2 | consumeFifoByUnit |
| Ürün | `stockProductService.js` | + categories |
| Depo | `warehouseService.js` — metadata only | **bakiye bağlı** |
| Dashboard | `dashboardService.js` m² FIFO | unit_cost SUM |
| Manual IN super_admin | V2 kural | Gate 0 kararına göre perm |

## 7. Tamamlanmadan başlanmayacak işler

- Purchasing goods receipt gerçek entegrasyonu (Gate 4)
- Finance COGS ledger posting (Gate 5)
- V2 stok veri cutover (Gate 3 PASS + Purchasing PASS sonrası)
- Projects modülü genişlemesi (Gate 3 sonrası planlanabilir)

---

# Gate 4 — Purchasing Ready

## 1. Amaç

V2’de ~%95 çalışan satınalma zincirinin (talep → onay → sipariş → fiyat → mal kabul → stok) merkezi onay ve **pending_cost/unpriced** modeliyle V3’e taşınması; finans fatura/borç için hazır belge hattı.

## 2. Kapsam

### Workflow
- Purchase request (draft → pending → …)
- Approval (merkezi approval + permission)
- Purchase order (auto on approve + manuel yollar)
- Pricing (`PUT /pricing`) — **siparişi tamamlamaz**
- Order complete (buyer-action) — ayrı adım
- Goods receipt (partial delivery)
- Rejected/damaged quantity kaydı
- Warehouse acceptance → `StockPort.recordIn`
- **Goods receipt, buyer_state=completed gerektirmez** (V2 davranışı korunur)
- **pending_cost / unpriced flow**: fiyat yokken mal kabul; maliyet katmanı pending veya sonradan fiyatlandırma ile güncelleme — spec Gate 0’da freeze

### Master
- Suppliers (→ Gate 5 party link hazırlığı)
- FX rate (satır bazlı, UZS/USD)
- Line cancel

### Durum eksenleri
- `pr_status` (talep)
- `buyer_state`, `receipt_status`, `pricing_status` (sipariş)
- Line: qty_ordered, qty_received, line_status

### UI & modal
- Hub, requests, requisition open, processing, goods receipt, suppliers, print
- **Modal flow inventory** tamamı (pr view, processing, cancel line, GR, …)

### Finans hazırlığı
- `purchase_invoices` FK stub: PO, GR, supplier
- Fiyat görünürlük permission (V2 hidePrice)

### Teknik
- Purchasing migrations + seeds
- StockPort entegrasyon testleri
- Approval permission matrisi

## 3. Kabul kriterleri

- [ ] Talep → onay → PO akışı UAT PASS
- [ ] Fiyat kaydet: stok artırmaz, complete yapmaz, buyer_state=prices_saved
- [ ] Complete: placeholder tedarikçi yasak; FX>0; tüm aktif satırlar
- [ ] Mal kabul **buyer_state incomplete** iken mümkün (bilinçli kural)
- [ ] Unpriced receipt: pending_cost işaretli katman/hareket; fiyat sonrası recalc PASS
- [ ] Partial delivery: çoklu GR; qty_received birikir
- [ ] Rejected/damaged: stok artmaz; GR satırında kayıt
- [ ] Accepted qty → stock IN + warehouse doğru
- [ ] Open PO block: manuel stock IN engeli (Gate 3 ile birlikte test)
- [ ] Merkezi onay: permission dışı kullanıcı 403
- [ ] Modal flows: inventory ile birebir
- [ ] i18n + activity log
- [ ] Finance stub: invoice create API draft veya şema hazır

## 4. Riskler

| Risk | Azaltma |
|------|---------|
| pending_cost muhasebe karmaşıklığı | Gate 0 data contract; sadece maliyet katmanı flag |
| Unpriced receipt yanlış COGS | G4-T6, G4-T7 |
| request_status çift eksen (V2) | V3’te tek model |
| İki approval UI (V2) | Tek workflow UI |

## 5. Test senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| G4-T1 | Approve request | auto PO, placeholder supplier |
| G4-T2 | Pricing only | prices_saved; receipt_status değişmez |
| G4-T3 | Complete | buyer_state completed |
| G4-T4 | GR before complete | başarılı (kural gereği) |
| G4-T5 | Partial GR | partial receipt_status |
| G4-T6 | Unpriced GR | pending_cost layer |
| G4-T7 | Price after GR | recalc unit_cost |
| G4-T8 | Reject/damage only | no stock movement |
| G4-T9 | Multi GR same line | qty_received sum |
| G4-T10 | Approve perm yok | 403 |

## 6. V2 referans noktaları

| Konu | V2 |
|------|-----|
| Ana servis | `purchasingService.js` |
| pr_status | `purchaseWorkflow.js` |
| Pricing vs complete | `PUT /pricing` vs `buyer-action complete` |
| GR → stock | `createGoodsReceipt` → `recordMovementIn` |
| Recalc | `recalculateCostLayersForOrderId` → V3 unit_cost |
| Modals | `purchase-requests-workflow.js`, `purchase-processing.js`, `goods-receipt.html` |
| Gap: request_status | V3 kaldır veya kullan |
| Gap: ready action no-op | V3 düzelt/kaldır |

## 7. Tamamlanmadan başlanmayacak işler

- Finance tam uygulama (Gate 5)
- V2 purchasing veri migrasyonu (Gate 4 PASS)
- 3-way match / resmi muhasebe

---

# Gate 5 — Finance Tracking Ready

## 1. Amaç

Resmi muhasebe olmadan operasyonel finans takibinin (cari, kasa/banka, fatura, ödeme, borç/alacak) HR/Stock/Purchasing ile **aynı currency modeli** üzerinde çalışması.

**Önkoşul:** Gate 2, 3, 4 PASS.

## 2. Kapsam

### Kapsam dışı (net)
- TFRS/UFRS defter
- Beyanname, e-defter, çek/senet karmaşık senaryolar (ileri faz)

### Dahil
- **Parties / cari** (supplier, customer, employee)
- Cash/bank accounts + movements
- Purchase invoices (+ Purchasing link)
- Payments, collections
- Supplier AP, customer AR
- Employee advance/payment (HR link)
- Opening balances
- Project link (opsiyonel belgelerde)
- **Finance ledger** (basit çift taraflı veya yarı-ledger — Gate 0 contract)
- currency: transaction + amount_local + amount_base

## 3. Kabul kriterleri

- [ ] Gate 0 Finance Data Contract’a %100 uyum
- [ ] Supplier party ↔ Purchasing supplier
- [ ] Purchase invoice ↔ PO/GR
- [ ] Payment AP bakiyesini düşürür
- [ ] USD belge local’e otomatik dönmez
- [ ] Employee advance ↔ HR employee
- [ ] Stock OUT COGS → ledger satırı (policy Gate 0’da tanımlıysa)
- [ ] Opening balance import
- [ ] Rapor: party balance, cash position
- [ ] Permission: finans görünürlük ayrı catalog
- [ ] Migration + entegrasyon testleri (Purchasing invoice, HR payment)

## 4. Riskler

| Risk | Azaltma |
|------|---------|
| Scope accounting’a kayar | “Resmi muhasebe değil” banner + scope checklist |
| COGS çift kayıt | Event idempotency |
| FX tutarsızlığı | Gate 1 Money modeli zorunlu |

## 5. Test senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| G5-T1 | Supplier party + invoice | AP artar |
| G5-T2 | Payment | AP azalır |
| G5-T3 | USD invoice | currency USD |
| G5-T4 | Employee advance | party employee |
| G5-T5 | GR link invoice | traceability |
| G5-T6 | Opening balance | başlangıç AP/AR |
| G5-T7 | Project expense | project_id kayıtlı |

## 6. V2 referans noktaları

| Konu | V2 |
|------|-----|
| Finance modül | **Yok** — sıfırdan |
| Purchasing hook | suppliers, GR — fatura yok |
| HR hook | my-profile advance placeholder |
| Stok COGS | movement.cogs_uzs_total |

## 7. Tamamlanmadan başlanmayacak işler

- Resmi muhasebe entegrasyonu
- Payroll ödeme batch (HR Gate 2 snapshot sonrası alt faz)
- V2 finans veri migrasyonu (V2’de yok)

---

# Genel: V2’den Taşınacaklar / Taşınmayacaklar

## Taşınacaklar
- HR wage engine, attendance, lock/snapshot kuralları
- Stok FIFO proje önceliği, void/replace, open PO block
- Satınalma pr_status akışı, fiyat≠complete, kısmi mal kabul
- Permission 4 katman
- i18n, audit, backup fikri
- toUpperTr, modal/iş akışı kararları

## Taşınmayacaklar
- 10k CSS, sayfa bazlı UI
- patch-*.js zinciri
- cost_uzs_per_m2 / m² maliyet FIFO
- hardcoded UZS/USD, SYSTEM alias
- app.js sayfa permission map
- navigation.js hardcode
- frontend/backend duplicate formulas
- window.prompt

---

# Gate Geçiş Özeti

| Gate | Sonraki Gate için minimum çıktı |
|------|----------------------------------|
| **0** | Frozen spec set + onay |
| **1** | UI + admin + migration + config çalışır |
| **2** | User/position/employee hazır |
| **3** | StockPort + warehouse FIFO hazır |
| **4** | GR → stock + supplier + invoice stub |
| **5** | Operasyonel finans döngüsü kapalı |

**Kural:** Herhangi bir kabul kriteri FAIL ise Gate tamamlanmış sayılmaz; sonraki Gate’e geçiş yok.

---

*Revize: Takvim/30 gün/90 gün hedefleri kaldırıldı. Yalnızca Gate ve kabul kriterleri geçerlidir.*
