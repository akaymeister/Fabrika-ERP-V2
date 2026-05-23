# 03 — Migration & Module Registry

**Belge türü:** Gate 0 — migration, registry ve güvenli sistem değişikliği ana karar dokümanı  
**Durum:** ☑ **İNCELEMEDE** (kararlar kilitli; implementasyon Gate 1+)  
**Versiyon:** 0.2.0  
**Son güncelleme:** 21.05.2026  
**Ürün:** FactoryOS V3 · Fabrika ERP V2 = referans only (kod/patch kopyalanmaz)

**İlgili belgeler:**

| Belge | İlişki |
|-------|--------|
| [02-admin-control-system.md](./02-admin-control-system.md) | Admin panel, migration sekmesi, yedek/restore, bakım modu |
| [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) | Permission motoru, ABAC, `required_permissions` |
| [01-central-ui-design-system.md](./01-central-ui-design-system.md) | Merkezi UI; registry görünürlük |
| [05-country-currency-language.md](./05-country-currency-language.md) | `public/config`, tenant-ready para |
| [v2-reference-index.md](./v2-reference-index.md) | V2 patch/nav referansları |

**Gate 0 prensibi:** Kritik konular **“sonra bakılır”** ile belirsiz bırakılmaz. Her madde için **karar, kapsam, sınır, risk politikası, kabul kriteri, uygulama Gate’i** yazılır. Kodlama sırası ayrı olabilir.

**Gate 0 çıktısı:** Bu belge kararları kilitler; Gate 1 migration runner, registry tabloları ve güvenli ops **yazılmaz** (FROZEN öncesi).

---

## §0 Kaynaklar ve otorite ayrımı

| Soru | Cevap (bu belge) |
|------|------------------|
| Modül/sayfa/kart nasıl tutulur? | Merkezi **registry** tabloları + **manifest** |
| Yeni modül nasıl eklenir? | Manifest + migration + `modules:register` (kontrollü) |
| Aktif/pasif/görünürlük? | `is_active` / `is_visible` — §4 |
| Migration admin’de? | Status paneli **zorunlu**; run **güvenlik şartlarıyla** — §10–§11 |
| Panelden migration run? | **Evet, politikası kesin** — Süper Yönetim + bakım + yedek + çift onay — §11 |
| Backup/restore/audit? | §12; [02-admin](./02-admin-control-system.md) ile uyumlu |
| V2’den ne alınır? | §19–§20 |

| Katman | Otorite |
|--------|---------|
| Registry şema | Bu belge (§2–§7) |
| Permission semantiği | [01-permission](./01-permission-role-position-blueprint.md) |
| Admin UI / yedek | [02-admin](./02-admin-control-system.md) |
| Görsel | [00-ui](./00-ui-design-direction-freeze.md) FROZEN |

---

## §1 Ana mimari karar: modular monolith + tenant-ready single-company

### 1.1 Modular monolith (MIG-01, MIG-02)

| Karar | Detay |
|-------|--------|
| Başlangıç mimarisi | **Modüler monolith** — microservice **değil** (MIG-02) |
| Backend | Tek uygulama; modül bazlı servis paketleri (`modules/hr`, `modules/stock`, …) |
| Ortak çekirdek | Auth, permission, audit, **registry**, settings, migration runner |
| Gelecek | API/modül sınırları **ayrılabilir** şekilde tasarlanır; erken dağıtım yok |

```text
┌─────────────────────────────────────────────────────────┐
│              FactoryOS V3 Backend (monolith)           │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐ │
│  │  core   │ │ registry │ │  auth  │ │  migration   │ │
│  │ settings│ │ permission│ │ audit  │ │   runner     │ │
│  └────┬────┘ └────┬─────┘ └───┬────┘ └──────┬───────┘ │
│       └───────────┴───────────┴─────────────┘         │
│                         │                              │
│     ┌──────────┬────────┴────────┬──────────┐         │
│     ▼          ▼                   ▼          ▼         │
│   HR        Stock            Purchasing    Admin       │
└─────────────────────────────────────────────────────────┘
```

**Uygulama Gate’i:** Gate 1 repo iskeleti.

### 1.2 Single-company runtime + tenant-ready data (MIG-03, MIG-04)

| Karar | Detay |
|-------|--------|
| Runtime (Gate 0–1) | **Tek şirket / tek fabrika** — çok kiracılı SaaS **aktif değil** |
| Veri tasarımı | Kritik tablolarda `company_id` / `tenant_id` (nullable veya default 1) **rezerve** |
| Davranış | Gate 1 sorguları tek tenant; çok şirket filtreleri **uygulanmaz** |
| Bu bir erteleme değil | Gate 0 **mimari karar**; uygulama Gate 2+ multi-tenant runtime |

**FAIL:** “Sonra company_id ekleriz” — yeni tablolar Gate 1’den itibaren kolon rezervi ile açılır.

---

## §2 Registry kapsamı ve kavramsal model

Registry sistemi **V3 kapsamındadır** (MIG-05). Aşağıdaki kayıt türleri merkezi yönetilir:

| Tür | Kavramsal varlık | Tablo / kaynak |
|-----|------------------|----------------|
| Modül | `erp_modules` | MIG-06 |
| Sayfa | `erp_pages` | MIG-07 |
| Menü | `erp_pages.show_in_nav` + `GET /api/nav` | |
| Kart | `erp_page_cards` | MIG-08 |
| Aksiyon / buton | `erp_page_actions` | MIG-09 |
| API route | `erp_page_actions.api_*` | MIG-10 |
| Permission key | `permissions` + JSON `required_permissions` | MIG-15 |
| Dashboard kart | `dashboard_widgets` (veya eşdeğer) | MIG-43 |
| Rapor kartı | `dashboard_widgets` tip=`report` | |
| Manifest | `modules/{key}/module.manifest.json` | MIG-40 |
| Migration durumu | `schema_migrations`, `migration_runs` | MIG-21 |

**İzin tabloları (permission blueprint):** `permissions`, `role_permissions`, `user_permissions`, `position_permissions`.

---

## §3 Modül / sayfa / kart / aksiyon registry

### 3.1 `erp_modules`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `module_key` | `VARCHAR(64)` PK | `hr`, `stock`, `admin` |
| `name_i18n_key` | `VARCHAR(128)` | |
| `icon` | `VARCHAR(64)` | SVG set anahtarı |
| `sort_order` | `INT` | |
| `is_active` | `TINYINT(1)` | Operasyonel kapı — §4 |
| `is_visible` | `TINYINT(1)` | Menü/hub görünürlük — §4 |
| `manifest_version` | `VARCHAR(32)` | Son register |
| `depends_on` | `JSON` | Modül bağımlılıkları — §7 |

### 3.2 `erp_pages`

| Kolon | Açıklama |
|-------|----------|
| `page_key` | `stock.movements` |
| `module_key` | FK |
| `path` | SPA/HTML route |
| `required_permissions` | JSON dizi |
| `is_active`, `is_visible`, `show_in_nav` | |

### 3.3 `erp_page_cards` / `erp_page_actions`

Hub ve sayfa kartları; butonlar + opsiyonel `api_method`, `api_path` (MIG-10).

### 3.4 Navigation

```text
GET /api/nav → session + registry (active/visible) + PermissionGate → Sidebar
Sayfa yükleme → path → erp_pages + requirePagePermission
```

V2 `GLOBAL_MODULES` / `navigation.js` hardcode **yasak**.

---

## §4 `is_active` / `is_visible` davranışı

Kesin karar — [02-admin](./02-admin-control-system.md) §10 ve [01-permission](./01-permission-role-position-blueprint.md) ile uyumlu.

| Alan | Anlam | Menü / hub | Operasyonel API |
|------|--------|------------|-----------------|
| `is_visible = 0` | Görünürlük | Gizli | 200 mümkün (perm + doğrudan URL) — MIG-11 |
| `is_active = 0` | Sistemsel kapalı | Gizli | **403** veya bakım cevabı — MIG-12, MIG-13 |
| `is_active = 0` + super_admin | Yönetim | Registry/admin API açık | Operasyonel iş kuralı **403** — MIG-14 |

**Süper Yönetim:** Pasif operasyonel modülde stok girişi yapamaz; modülü tekrar aktif edebilir.

**Çözümleme sırası:**

```text
1. maintenance_mode (varsa) → yazma kilidi
2. erp_*.is_active = 1
3. PermissionGate (ANY/ALL — §5)
4. ABAC context filter (§17)
5. Handler
```

---

## §5 Permission registry bağlantısı

### 5.1 Zorunluluklar (MIG-15…MIG-20)

| Kural | Detay |
|-------|--------|
| Bağlantı | Her modül/sayfa/kart/aksiyon `required_permissions` taşır |
| Frontend | Gizleme **yeterli değil** (MIG-16) |
| Backend | `requirePermission` / route guard **zorunlu** (MIG-17) |
| View / action | Ayrı key’ler — `*.view` vs `*.create` (MIG-18) |

### 5.2 İsimlendirme standardı (öneri — Gate 0 KABUL)

```text
{module}.{resource}.{action}
{module}.{resource}.{action}.{scope}   // opsiyonel

Örnekler:
  module.stock.view
  stock.movements.view
  stock.movements.create
  stock.movements.correct
  purchasing.requests.approve
  admin.registry.manage
  admin.migrations.view
  admin.migrations.run
  admin.backup.manage
```

### 5.3 `required_permissions` semantiği

| Senaryo | Model | Örnek |
|---------|-------|--------|
| Sayfa görüntüleme | **ANY** — listeden biri | `["stock.movements.view", "module.stock.view"]` |
| Riskli işlem | **ALL** veya ek guard | Migration run: `admin.migrations.run` + süper admin + bakım modu + … |

**Migration run guard (Gate 0 politikası — MIG-23…MIG-29):**

| Şart | Zorunlu |
|------|---------|
| `super_admin` | Evet |
| `maintenance_mode` = migration/restore (c) | Evet |
| Normal kullanıcı oturumları sonlandırılmış / yazma kilitli | Evet |
| Öncesi **başarılı backup** | Evet |
| Dry-run / ön kontrol tamamlandı | Evet |
| Pending liste + etkilenen tablo özeti gösterildi | Evet |
| Çift onay | Evet |
| Metin doğrulama: `MIGRATION ÇALIŞTIR` | Evet |
| Audit: `MIGRATION_RUN`, `BACKUP_BEFORE_MIGRATION` | Evet |
| Başarısızlık: güvenli hata durumu + `MIGRATION_FAIL` | Evet |
| Sonrası: **health check** | Evet |

Teknik uygulama Gate 1; **karar Gate 0 KABUL**.

Boş dizi `[]`: yalnızca oturum (nadir). Register’da tanımsız `perm_key` → **reddedilir**.

---

## §6 Manifest sistemi

Her modül **manifest** taşır (MIG-40). Yol: `modules/{module_key}/module.manifest.json`.

### 6.1 Manifest içeriği (minimum)

| Alan | Açıklama |
|------|----------|
| `moduleKey`, `manifestVersion` | Kimlik |
| `nameI18nKey`, `icon`, `sortOrder` | UI |
| `defaultActive`, `defaultVisible` | İlk register |
| `dependencies` | Modül bağımlılıkları — §7 |
| `permissions` | Seed upsert listesi |
| `pages` | path, cards, actions |
| `apiRoutes` | Mount / dokümantasyon |
| `migrations` | Modül SQL dizini |
| `requiredSettings` | Sistem ayarı anahtarları |
| `defaultRoles` / permissionSuggestions | Opsiyonel seed önerisi |

### 6.2 `modules:register`

```text
modules:register [--module=demo] [--dry-run]
```

1. Şema doğrula (JSON Schema Gate 1).
2. `permissions` upsert.
3. `erp_modules`, `erp_pages`, `erp_page_cards`, `erp_page_actions` upsert.
4. Manifest’te olmayan kayıtlar → `is_active=0` (varsayılan pasifleştir).
5. `manifest_version` güncelle.
6. Audit: `MODULE_REGISTER`.

**Onay:** Kritik yeni modül → Süper Yönetim onayı (politika); audit zorunlu.

**Sıra:** `db:migrate` → `db:seed` (gerekirse) → `modules:register`.

---

## §7 Module dependency ve etki analizi

| Örnek bağımlılık | Etki |
|------------------|------|
| Satınalma → Stok | Mal kabul stok hareketi |
| Muhasebe → Stok, Satınalma | Maliyet verisi |
| Proje → Satınalma, Stok, HR | Çok modüllü |

| Karar | Detay |
|-------|--------|
| Tanım | `erp_modules.depends_on` JSON veya `module_dependencies` tablosu |
| Pasif yapma | Bağımlı modüller **uyarı** veya **blok** (kritik ise) — MIG-42 |
| UI | Admin toggle öncesi etki özeti modal |

**Uygulama Gate’i:** Gate 1 dependency graph; Gate 2 gelişmiş analiz.

---

## §8 Migration türleri ve sınıflandırma

| Tür | Açıklama | Risk |
|-----|----------|------|
| **schema** | Tablo/kolon/index | Orta |
| **data** | Veri dönüşümü | Orta–yüksek |
| **seed** | Varsayılan rol/permission/ayar | Düşük (ayrı `db:seed`) |
| **registry** | Modül/sayfa/kart kaydı | Düşük (register ile) |
| **permission** | Yeni perm key | Düşük |
| **settings** | Sistem ayarı | Düşük |
| **repair** | Bozuk veri düzeltme | Yüksek |
| **destructive** | Silme / geri dönüşsüz değişim | **Kritik** — MIG-33 |

**Destructive (MIG-33, MIG-34):** Ekstra onay, zorunlu backup, açıklama metni, rollback/runbook veya restore planı **zorunlu**.

**Seed vs migrate:** `db:migrate` şema; `db:seed` referans veri — karıştırılmaz.

**V2 yasak:** Yeni `patch-*.js` — SQL-first runner (MIG-47).

---

## §9 Migration naming, versioning, checksum

### 9.1 Dosya adı standardı (Gate 0 KABUL)

**Format:**

```text
{module}_{seq4}_{slug}.sql
```

| Parça | Örnek |
|-------|--------|
| module | `core`, `hr`, `stock` |
| seq4 | `0001`, `0010` |
| slug | `registry_tables`, `employees` |

**Örnekler:** `core_0001_init.sql`, `core_0002_registry_tables.sql`, `hr_0100_employees.sql`

**Sıralama:** `module` alfabetik, sonra `seq4` numerik.

**Klasör:**

```text
database/migrations/
  core/
  modules/hr/
  modules/stock/
database/seeds/   ← migrate ile çalışmaz
```

Alternatif timestamp format `YYYYMMDDHHMM__module__desc` Gate 1’de **tek** standarda indirgenir; Gate 0 kararı: **`{module}_{seq4}_{slug}`** birincil.

### 9.2 Tablolar

**`schema_migrations`** — uygulanmış dosya:

| Kolon | Açıklama |
|-------|----------|
| `version` | PK — dosya kimliği |
| `module` | `core`, `hr`, … |
| `checksum` | SHA-256 dosya içeriği |
| `executed_at`, `applied_by`, `duration_ms` | |

**`migration_runs`** — batch/attempt audit:

| Kolon | Açıklama |
|-------|----------|
| `batch_id`, `version`, `status` | pending/running/success/failed/skipped/rolled_back |
| `error_message`, `started_at`, `finished_at` | |
| `backup_run_id` | Öncesi yedek bağlantısı — §12 |
| `triggered_by_user_id` | Panel/CLI |

### 9.3 Checksum (MIG-31, MIG-32)

| Kural | Davranış |
|-------|----------|
| Hesaplama | SHA-256, UTF-8, LF normalize |
| Uygulandıktan sonra dosya değişirse | **CHECKSUM_DRIFT** — kritik uyarı |
| Prod | Migrate **durdur** |
| Düzeltme | Yeni forward migration; eski dosya **düzenlenmez** |

### 9.4 Runner ilkeleri

| İlke | Detay |
|------|--------|
| Fail-stop | Bir fail → sonraki çalışmaz |
| Idempotent SQL | `IF NOT EXISTS`, guarded DDL |
| Rollback otomatik | **Zorunlu değil** — §13 |

---

## §10 Migration paneli ve admin görünümü

Migration paneli **V3 kapsamındadır** (MIG-21). **Status görüntüleme Gate 1 minimum zorunlu** (MIG-22).

### 10.1 Panel kolonları

| Alan | Kaynak |
|------|--------|
| Migration adı / version | `schema_migrations.version` |
| Sıra | Dosya sırası |
| Durum | pending / applied / failed / skipped / rolled_back |
| Uygulama tarihi | `executed_at` |
| Uygulayan | `applied_by` / user |
| Süre | `duration_ms` |
| Hata | `migration_runs.error_message` |
| Modül | `module` |
| Checksum / hash | `checksum` + drift flag |
| Öncesi yedek | `backup_run_id` → dosya adı, boyut |
| Audit | `activity_logs` link |

### 10.2 Yetki

| İşlem | Permission |
|-------|------------|
| Görüntüleme | `admin.migrations.view` |
| Dry-run | `admin.migrations.view` + super_admin |
| Run | §5.3 guard + `admin.migrations.run` |

---

## §11 Panelden migration çalıştırma güvenlik politikası

**Karar Gate 0 KABUL:** Panelden migration çalıştırma **V3 kapsamındadır**; yüksek riskli operasyondur (MIG-23). **Eksik şart = buton disabled** — bu “eksik özellik” değil, **güvenlik kapısıdır**.

| Gate | Kapsam |
|------|--------|
| **Gate 0** | §5.3 şart listesi, MIG-24…MIG-30 kararları |
| **Gate 1 minimum** | Status panel + backup altyapısı + maintenance (c) temel |
| **Gate 1 opsiyonel aktif** | Run butonu **yalnızca** tüm şartlar yeşilse |

CLI `npm run db:migrate` prod’da aynı guard politikasına tabi (Süper Yönetim + bakım önerilir).

---

## §12 Backup, restore ve maintenance mode bağlantısı

### 12.1 Backup (MIG-26, MIG-36)

| Kural | Detay |
|-------|--------|
| Migration öncesi | Otomatik yedek **zorunlu** |
| Backup fail | Migration **çalıştırılamaz** |
| Bağlantı | `migration_runs.backup_run_id` → dosya adı, zaman, boyut, hash |
| Audit | `BACKUP_BEFORE_MIGRATION`, `BACKUP_CREATE` |
| Post-migration snapshot | Değerlendirilir (opsiyonel Gate 1) |

[02-admin](./02-admin-control-system.md) §12: hafif günlük yedek vs tam bakım yedek ayrımı.

### 12.2 Restore (MIG-37, MIG-38)

| Karar | Detay |
|-------|--------|
| Kapsam | Restore UI **V3 kapsamındadır** — yüksek risk |
| Şartlar | super_admin + maintenance (c) + çift onay + restore öncesi **yeni yedek** + seçilen yedek **hash doğrulama** + audit + oturum kapatma + health check |
| Detay UI | [02-admin](./02-admin-control-system.md); bu belge risk politikasını özetler |

### 12.3 Maintenance mode türleri (MIG-39)

| Tür | Kod | Kim açar | API | Dashboard |
|-----|-----|----------|-----|-----------|
| **a) Read-only** | `readonly` | Admin yetkili | GET 200; POST/PUT/PATCH/DELETE 503 veya 423 | Banner: salt okunur |
| **b) Full maintenance** | `full` | Süper Yönetim | Operasyonel 503; admin shell açık | Bakım sayfası |
| **c) Migration/restore** | `migration` | Süper Yönetim | Tüm normal işlem kapalı; teknik ops API | Bakım + migration panel |

| Ortak | Audit |
|-------|-------|
| `MAINTENANCE_MODE_ON` / `OFF` | Kim, ne zaman, tip, süre |

---

## §13 Rollback / runbook politikası

| Seviye | Gate 0 kararı |
|--------|----------------|
| Otomatik down migration | **Zorunlu değil** — her migration için |
| Basit schema | Down **opsiyonel**; forward-fix tercih |
| Destructive | Rollback SQL **veya** restore runbook **zorunlu** (MIG-34) |
| Prod hata sonrası | `migration_runs` failed; transaction rollback (DDL izin verirse); aksi halde restore |
| Canlı otomatik rollback | Tercih: **restore/runbook** > otomatik down zinciri |

`db:migrate:redo`: yalnız **dev/local**; prod yasak.

---

## §14 Audit log kapsamı

Merkezi `activity_logs` — [02-admin](./02-admin-control-system.md) §11. Zorunlu action örnekleri (MIG-35):

| Action | Tetikleyici |
|--------|-------------|
| `MODULE_REGISTER` | manifest register |
| `MODULE_ACTIVATE` / `MODULE_DEACTIVATE` | registry toggle |
| `PAGE_ACTIVATE` / `PAGE_DEACTIVATE` | |
| `CARD_VISIBILITY_CHANGE` | |
| `ACTION_PERMISSION_CHANGE` | |
| `MIGRATION_STATUS_VIEW` | panel açılışı (opsiyonel) |
| `MIGRATION_DRY_RUN` | |
| `MIGRATION_RUN` / `MIGRATION_SUCCESS` / `MIGRATION_FAIL` | |
| `BACKUP_BEFORE_MIGRATION` | |
| `MAINTENANCE_MODE_ON` / `OFF` | |
| `RESTORE_START` / `RESTORE_SUCCESS` / `RESTORE_FAIL` | |

---

## §15 Dashboard widget registry bağlantısı

| Karar | Detay |
|-------|--------|
| Tablo | `dashboard_widgets` (veya eşdeğer) — MIG-43 |
| Alanlar | `widget_key`, `module_key`, `widget_type` (module/report/task), `required_permissions`, `is_active`, `is_visible`, `sort_order`, `config_json` |
| Yetki | Kart permission ile görünür; admin açıp kapatabilir — MIG-42, [02-admin](./02-admin-control-system.md) §13 |
| Kişisel layout | `user_dashboard_layout` (JSON) — sürükle-bırak UI olmasa bile **rezerve** — MIG-44 |
| Registry | Yeni widget manifest/register ile eklenir |

**Uygulama Gate’i:** Gate 1 temel widget seed; Gate 2 kişiselleştirme UI.

---

## §16 Workflow / approval altyapısı bağlantısı

| Karar | Detay |
|-------|--------|
| Dağınık onay yok | Modüller kendi onay tablosu kurmaz (hedef) |
| Merkezi workflow | V3 kapsamı — ayrı workflow spec (Gate 2) |
| Registry hazırlığı | `erp_page_actions.action_type` = `approval` / `workflow_step` — MIG-45 |
| Örnek action key | `purchasing.requests.approve`, `projects.budget.approve` |

**Karar Gate 0 KABUL;** workflow motoru uygulama Gate 2.

---

## §17 ABAC / context-based permission uyumu

Sadece rol yeterli değildir (MIG-46).

| Context | Örnek kısıt |
|---------|-------------|
| Depo | Depocu yalnızca atandığı `warehouse_id` |
| Proje | Proje sorumlusu yalnızca `project_id` |
| Departman | HR verisi departman filtresi |
| Fiyat görünürlüğü | Muhasebe görür; depo personeli görmez |

Registry + API: permission çözümünden sonra **context filter** (ABAC) uygulanır. Detay [01-permission](./01-permission-role-position-blueprint.md).

**Uygulama Gate’i:** Gate 1 temel warehouse/project scope; Gate 2 genişletme.

---

## §18 MIG kabul kriterleri (MIG-01 … MIG-48)

| Durum | Anlamı |
|-------|--------|
| **KABUL** | Gate 0 kararı kesin |
| REVİZE | Karar doğru; ifade/değişir |
| RED | Kapsam dışı |

Kritik maddelerde **BEKLET kullanılmaz**; uygulama sütununda Gate belirtilir.

| No | Kriter | PASS şartı | Gate 0 | Uygulama Gate | Not |
|----|--------|------------|--------|---------------|-----|
| MIG-01 | Modular monolith | Tek backend, modül paketleri | **KABUL** | Gate 1 | §1 |
| MIG-02 | Microservice yok (başlangıç) | Ayrılabilir sınır korunur | **KABUL** | Gate 2+ | |
| MIG-03 | Single-company runtime | Tek fabrika operasyonu | **KABUL** | Gate 1 | |
| MIG-04 | Tenant-ready veri | company_id rezervi | **KABUL** | Gate 1 şema | |
| MIG-05 | Registry V3 kapsamı | Merkezi registry | **KABUL** | Gate 1 | |
| MIG-06 | Modül registry | erp_modules | **KABUL** | Gate 1 | |
| MIG-07 | Sayfa registry | erp_pages | **KABUL** | Gate 1 | |
| MIG-08 | Kart registry | erp_page_cards | **KABUL** | Gate 1 | |
| MIG-09 | Aksiyon registry | erp_page_actions | **KABUL** | Gate 1 | |
| MIG-10 | API route bağlantısı | action api_* alanları | **KABUL** | Gate 1 | |
| MIG-11 | is_visible | Yalnız görünürlük | **KABUL** | Gate 1 | §4 |
| MIG-12 | is_active | Operasyonel kapı | **KABUL** | Gate 1 | §4 |
| MIG-13 | is_active API | Pasif → 403 | **KABUL** | Gate 1 | |
| MIG-14 | Super admin pasif modül | İş kuralı 403; yönetim açık | **KABUL** | Gate 1 | |
| MIG-15 | Registry-permission bağ | required_permissions | **KABUL** | Gate 1 | |
| MIG-16 | Frontend-only yetersiz | Defense-in-depth | **KABUL** | Gate 1 | |
| MIG-17 | API guard zorunlu | middleware | **KABUL** | Gate 1 | |
| MIG-18 | View/action ayrımı | Ayrı perm key | **KABUL** | Gate 1 | |
| MIG-19 | ANY basit erişim | Sayfa görüntüleme | **KABUL** | Gate 1 | §5 |
| MIG-20 | ALL riskli işlem | Migration run guard | **KABUL** | Gate 1 | §5 |
| MIG-21 | Migration paneli | Admin sekme | **KABUL** | Gate 1 | §10 |
| MIG-22 | Status görüntüleme | Liste + drift | **KABUL** | Gate 1 min | |
| MIG-23 | Panelden run politikası | Güvenlik şartları tanımlı | **KABUL** | Gate 1 ops | §11 |
| MIG-24 | Run super_admin | Zorunlu | **KABUL** | Gate 1 ops | |
| MIG-25 | Run maintenance | Mod (c) | **KABUL** | Gate 1 ops | |
| MIG-26 | Run öncesi backup | Başarılı yedek | **KABUL** | Gate 1 ops | |
| MIG-27 | Dry-run | Ön kontrol | **KABUL** | Gate 1 ops | |
| MIG-28 | Çift onay | UI | **KABUL** | Gate 1 ops | |
| MIG-29 | Metin doğrulama | MIGRATION ÇALIŞTIR | **KABUL** | Gate 1 ops | |
| MIG-30 | Post health check | Otomatik kontrol | **KABUL** | Gate 1 ops | |
| MIG-31 | Checksum | schema_migrations | **KABUL** | Gate 1 | §9 |
| MIG-32 | Hash drift uyarı | Kritik blok prod | **KABUL** | Gate 1 | |
| MIG-33 | Destructive sınıf | Etiket + ek onay | **KABUL** | Gate 1 | §8 |
| MIG-34 | Destructive runbook | Rollback/restore plan | **KABUL** | Gate 1 | §13 |
| MIG-35 | Migration audit | activity_logs | **KABUL** | Gate 1 | §14 |
| MIG-36 | Backup fail → no migrate | Blok | **KABUL** | Gate 1 | §12 |
| MIG-37 | Restore UI kapsamı | Yüksek risk tanımlı | **KABUL** | Gate 1–2 UI | §12 |
| MIG-38 | Restore guard | §12 şartları | **KABUL** | Gate 1–2 | |
| MIG-39 | Maintenance türleri | a/b/c | **KABUL** | Gate 1 | §12 |
| MIG-40 | Manifest register | Kontrollü kayıt | **KABUL** | Gate 1 | §6 |
| MIG-41 | Modül bağımlılık | depends_on | **KABUL** | Gate 1 | §7 |
| MIG-42 | Pasif etki analizi | Uyarı/blok | **KABUL** | Gate 1 | §7 |
| MIG-43 | Dashboard widget registry | dashboard_widgets | **KABUL** | Gate 1–2 | §15 |
| MIG-44 | Kişisel layout rezerv | Veri modeli | **KABUL** | Gate 2 | §15 |
| MIG-45 | Workflow registry uyumu | action_type hazır | **KABUL** | Gate 2 | §16 |
| MIG-46 | ABAC destek | Context filter | **KABUL** | Gate 1–2 | §17 |
| MIG-47 | V2 fikir, borç yok | §19–20 | **KABUL** | — | |
| MIG-48 | Gate 0 net karar | Uygulama ayrı Gate | **KABUL** | — | §21 |

**Özet:** 48 kriter × Gate 0 **KABUL**.

---

## §19 V2’den korunacaklar

| Fikir | V3 karşılığı |
|-------|----------------|
| Patch/migration zinciri fikri | SQL runner + `schema_migrations` |
| Checksum drift uyarısı | MIG-31, MIG-32 |
| Fail-stop | Runner |
| Seed permission | `db:seed` + manifest |
| Module navigation fikri | `GET /api/nav` + registry |
| Audit log | Merkezi `activity_logs` |
| Admin registry | erp_* tabloları |
| Backup listesi | `backup_runs` + admin panel |
| `accessService` çözümleme sırası fikri | Permission blueprint |
| patch-036 granular permission **mantığı** | seed, patch dosyası değil |

---

## §20 V2’den taşınmayacak teknik borçlar

| Borç | V3 karşılığı |
|------|----------------|
| 38+ `patch-*.js` karmaşası | SQL-only; CI yasak |
| Kontrolsüz migration çalıştırma | §11 guard |
| Eksik kolon toleranslı yamalı servisler | Explicit migration |
| `GLOBAL_MODULES` hardcode | Registry API |
| Hardcoded permissions | Manifest + katalog |
| Frontend-only visibility | API 403 |
| Super admin / admin karışıklığı | [02-admin](./02-admin-control-system.md) §1 |
| Restore belirsizliği | MIG-37, MIG-38 |
| Backup almadan migrate | MIG-26, MIG-36 |
| Checksum yokluğu | MIG-31 |
| Delete user → audit kopması | Pasif/arşiv |
| `run-migration.js` untracked | Tek runner |

---

## §21 Gate 0 / Gate 1 ayrımı

### Gate 0 (bu belge — karar)

- Modular monolith + tenant-ready tek şirket
- Registry + manifest + is_active/is_visible
- Permission + migration run + restore **risk politikaları**
- Maintenance mode türleri
- MIG-01…48 **KABUL**
- V2 carry/drop

### Gate 1 minimum (zorunlu)

| Deliverable | MIG |
|-------------|-----|
| Registry tabloları DDL | 06–10 |
| `schema_migrations`, `migration_runs` | 31–32 |
| Migration **status** admin panel | 21–22 |
| `is_active`/`is_visible` API davranışı | 11–14 |
| Permission registry bağlantısı | 15–20 |
| Manifest + `modules:register` | 40 |
| Audit entegrasyonu | 35 |
| Backup ön koşul altyapısı | 26, 36 |
| Maintenance mode (a)+(c) temel | 39 |
| `GET /api/nav` | — |
| Demo modül manifest-only | Gate 1 doğrulama |

### Gate 1 güvenli opsiyon (güvenlik kapısı)

Panelden **Run migration** — §5.3 şartları **tamam** ise aktif; değilse **disabled**. CLI prod aynı politika.

### Gate 2+ (karar KABUL, uygulama sonra)

| Konu | Uygulama Gate |
|------|----------------|
| Restore UI tam akış | Gate 1–2 |
| Dashboard kişiselleştirme UI | Gate 2 |
| Workflow builder | Gate 2 |
| Multi-tenant runtime | Gate 2+ |
| Microservice ayrımı | Gate 2+ (sınır hazır) |
| Gelişmiş dependency graph | Gate 2 |

**Yasak ifade:** “Sonra bakılır.” → **“Karar Gate 0 KABUL; uygulama Gate X.”**

### CLI (Gate 1)

| Komut | İşlev |
|-------|--------|
| `npm run db:migrate` | Pending SQL |
| `npm run db:migrate:status` | Drift + liste |
| `npm run db:seed` | Seed (migrate değil) |
| `npm run modules:register` | Manifest → registry |

### Test planı (MT-01…MT-18)

Önceki MT senaryoları Gate 1 QA planına aktarılır (migrate, drift, pasif modül 403, register idempotent, patch yasak CI).

---

## §22 Açık teknik uygulama kararları

Gate 0’da **karar verilmiş**; aşağıdakiler **uygulama detayı** (REVİZE değil, teknik seçim):

| # | Konu | Seçenekler | Uygulama Gate |
|---|------|------------|---------------|
| T1 | `dashboard_widgets` tam şema | Tek tablo vs ayrı report_widgets | Gate 1 |
| T2 | Maintenance API kodu | 503 vs 423 vs 403 | Gate 1 |
| T3 | Migration run UI | Tek sayfa wizard vs modal zinciri | Gate 1 ops |
| T4 | Manifest prune | Pasifleştir vs sil | Gate 1 (varsayılan pasif) |
| T5 | DDL transaction | MySQL DDL sınırı dokümantasyon | Gate 1 |
| T6 | `module.manifest.schema.json` yolu | docs/v3-spec/schemas/ | Gate 1 |
| T7 | Health check endpoint | `/api/health` vs internal | Gate 1 ops |
| T8 | rolled_back status | Gerçek down vs etiket only | Gate 2 |

---

## Onay

| Rol | İsim | Tarih |
|-----|------|-------|
| Proje lideri | | |
| Backend lead | | |
| DBA | | |
| Frontend lead | | |

**Durum:** İNCELEMEDE — Gate 0 kararları dokümante; FROZEN proje onayı sonrası.

**Sonraki:** [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) (motor detay), [02-admin-control-system.md](./02-admin-control-system.md) (admin UI).
