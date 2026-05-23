# Gate 1 — Core System Hedef Mimari Taslağı

**Belge türü:** Mimari taslak — **kod içermez**  
**Durum:** ☐ TASLAK (Gate 0 onayı sonrası uygulanır)  
**Versiyon:** 0.1.0  
**Ürün:** FactoryOS V3  
**Önkoşul:** Gate 0 **tam PASS**  
**UI referans:** [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md)

> Bu belge Gate 1’in **ne inşa edileceğini** tanımlar. Gate 0 bitmeden implementasyon başlamaz.

---

## 1. Amaç

FactoryOS V3’ün **ayrı ve temiz** kod tabanında, tüm sonraki modüllerin (HR, Stok, Satınalma, Finans) üzerine oturacağı çekirdeği kurmak:

- Tek UI dili (`@factoryos/ui`)
- Tek admin / registry
- Tek migration runner
- Tek permission motoru
- Tek ülke / para / dil config

**Gate 1 kapsam dışı:** HR, Stok, Satınalma, Finans iş mantığı ve modül ekranları.

---

## 2. Repo ve ortam (hedef)

| Öğe | Önerilen değer |
|-----|----------------|
| Klasör | `f:\FactoryOS-V3` (V2 dışında) |
| Git repo | `FactoryOS-V3` |
| npm root | `factoryos-v3` |
| Veritabanı | `factoryos_v3` |
| API port (dev) | `3001` (V2 ile çakışmaması için) |
| UI paket | `@factoryos/ui` |
| V2 | Referans only — **kopyalanmaz** |

```text
FactoryOS-V3/
├── packages/
│   └── ui/                 # @factoryos/ui
├── apps/
│   └── api/                # Express (veya seçilen stack)
├── database/
│   ├── migrations/         # core_*, modül prefix’li
│   └── seeds/
├── modules/                # manifest.json (boş veya core-only)
├── frontend/
│   └── public/             # Gate 1 shell sayfaları
├── docs/                   # v3-spec symlink veya kopya (opsiyonel)
└── package.json
```

---

## 3. Katmanlı mimari

```text
┌─────────────────────────────────────────────────────────┐
│  Browser — AppShell + modül sayfaları (Gate 2+)         │
│  @factoryos/ui bileşenleri + i18n (tr/en/ru/uz)         │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP / JSON
┌───────────────────────────▼─────────────────────────────┐
│  API Gateway katmanı                                     │
│  · auth session / JWT (karar Gate 0’da 04)              │
│  · PermissionGate (her route)                            │
│  · ModuleRegistryGuard (pasif modül → 403)               │
│  · activity_logs middleware                              │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Core services                                           │
│  · configService (country_profiles, public config)       │
│  · adminRegistryService                                  │
│  · migrationRunner                                       │
│  · permissionResolver                                    │
│  · backupService (manuel)                                │
│  · activityLogService                                    │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  MySQL — factoryos_v3                                    │
│  schema_migrations, erp_*, country_profiles, …           │
└─────────────────────────────────────────────────────────┘
```

---

## 4. UI paketi (`@factoryos/ui`)

### 4.1 Tasarım uyumu

Gate 1 implementasyonu **birebir** şu mockup’lara sadık kalır:

- `docs/mockups/factoryos-v3-home-preview.html`
- `docs/mockups/factoryos-v3-design-preview.html`
- `docs/mockups/factoryos-v3-admin-preview.html`

Tokenlar: [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) §5.

### 4.2 Bileşen seti (MVP)

| Bileşen | Gate 1 çıktı |
|---------|----------------|
| AppShell | Sidebar + topbar + collapse |
| Sidebar / Topbar / PageHeader | Nav API’den beslenir |
| Card, Button, Badge | Demo shell |
| DataTable | Scroll, locked kolon |
| Modal, ConfirmDialog, Toast | Stack; prompt yok |
| FormField, FilterBar, Tabs, Pagination | Admin + demo |
| CurrencyField, DateField | `GET /api/public/config` bağlı |

### 4.3 CSS kuralları

- Design token CSS dosyası (tek kaynak)
- Sayfa başına layout CSS **yasak** (print hariç)
- V2 `style.css` import **yasak**

### 4.4 Demo shell sayfası

Gate 1 kabulü için tek “bileşen vitrin” + gerçek admin layout:

- Tüm bileşenler render
- Responsive matris PASS: 1366, 1024, 768, 390

---

## 5. Admin ve registry

**Spec:** [02-admin-control-system.md](./02-admin-control-system.md) (detay), [03-migration-module-registry.md](./03-migration-module-registry.md) (registry tabloları)

| Tablo (hedef) | Amaç |
|---------------|------|
| `erp_modules` | Modül aktif/pasif, sıra |
| `erp_pages` | Sayfa yolu, izin anahtarı |
| `erp_page_cards` | Hub kartları |
| `erp_page_actions` | Buton/aksiyon izinleri |

**Davranış:**

- Pasif modül → menüde gizli + ilgili API **403**
- Admin UI: mockup `factoryos-v3-admin-preview.html` akışı
- `modules:register` CLI — manifest’ten idempotent kayıt

---

## 6. Permission motoru

**Spec:** [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md)

Çözümleme sırası (V2 `accessService` ile uyumlu hedef):

1. `super_admin` → tam yetki  
2. Rol izinleri  
3. Pozisyon izinleri  
4. Kullanıcı özel izinleri  

Tek `PermissionGate` — API route, sayfa render, nav item, action button.

---

## 7. Migration sistemi

**Spec:** [03-migration-module-registry.md](./03-migration-module-registry.md)

| Özellik | Kural |
|---------|--------|
| Tablolar | `schema_migrations`, `migration_runs` |
| Runner | Sıralı, checksum, fail → dur |
| Komutlar | `db:migrate` / `db:seed` ayrı |
| V2 `run-patches.js` | Kullanılmaz |

Gate 1’de yalnızca **core** migration’lar: registry, permission catalog, country_profiles, activity_logs, backup_runs, vb.

---

## 8. Config — ülke, para, dil

**Spec:** [05-country-currency-language.md](./05-country-currency-language.md)

| Alan | Kural |
|------|--------|
| `local_currency` | Form varsayılanı |
| `base_reporting_currency` | Varsayılan USD |
| `default_locale` | localStorage yoksa |
| USD kayıt | Otomatik local’e dönüşmez |
| `SYSTEM` alias | Yok |

`GET /api/public/config` — frontend formlar ve CurrencyField için.

---

## 9. Ops (çekirdek)

| Özellik | Gate 1 |
|---------|--------|
| `activity_logs` | CRUD audit |
| Manuel backup | Oluştur / listele / indir (admin) |
| Health | `/api/health` (opsiyonel) |

V2 `backupService` / `activityLog` **fikir** referansı; dosya kopyası yok.

---

## 10. API yüzeyi (Gate 1 tahmini)

| Grup | Örnek endpoint |
|------|------------------|
| Public | `GET /api/public/config` |
| Auth | `POST /api/auth/login` (mevcut karara bağlı) |
| Admin registry | `GET/PUT /api/admin/modules`, `pages`, … |
| Admin settings | `GET/PUT /api/admin/settings` |
| Admin users | `GET /api/admin/users` (liste; tam CRUD spec’e bağlı) |
| Logs | `GET /api/admin/activity-logs` |
| Backup | `POST/GET /api/admin/backups` |
| Migration | `GET /api/admin/migrations/status` (internal/admin) |

Modül API’leri (HR, stock, purchasing) **Gate 2+**.

---

## 11. i18n

- Dosyalar: `tr.json`, `en.json`, `ru.json`, `uz.json`
- Ana dil: **Türkçe**
- HTML/JS hardcoded metin yasak
- Gate 1 shell ve admin tam i18n

---

## 12. V2’den taşınmayacaklar (Gate 1)

| V2 | V3 Gate 1 |
|----|-----------|
| `frontend/public/style.css` | Token + `@factoryos/ui` |
| `run-patches.js` | `migrationRunner` |
| Dağınık admin HTML | Registry-driven admin |
| `GLOBAL_MODULES` hardcode | `erp_modules` API |
| Modül servisleri | Yok |

---

## 13. Gate 1 kabul kriterleri (özet)

Detay: [../FactoryOS-V3-Gate-Blueprint.md](../FactoryOS-V3-Gate-Blueprint.md) Gate 1 bölümü.

- [ ] Demo shell + admin mockup’a uygun UI
- [ ] 0 sayfa-özel layout CSS (kural ihlali yok)
- [ ] Pasif modül → 403 + nav gizli
- [ ] Migration fail güvenli
- [ ] Permission matrisi test kullanıcılarıyla PASS
- [ ] Config → CurrencyField entegrasyonu
- [ ] Audit log örnek işlem
- [ ] Backup manuel job
- [ ] Responsive matris PASS

---

## 14. Gate 1 sonrası (yönlendirme)

| Gate | İçerik |
|------|--------|
| Gate 2 | HR — [06](./06-hr-full-blueprint.md) |
| Gate 3 | Stok — [07](./07-stock-full-blueprint.md) |
| Gate 4 | Satınalma — [08](./08-purchasing-full-blueprint.md) |
| Gate 5 | Finans takip — [09](./09-finance-data-contract.md) |

---

## 15. Açık kararlar (Gate 0’da kapatılmalı)

| # | Karar | Seçenekler |
|---|--------|------------|
| 1 | Auth modeli | Session / JWT |
| 2 | Frontend build | Vite MPA / saf static |
| 3 | Monorepo aracı | npm workspaces / pnpm |
| 4 | Tablo detay UX | Expand row / modal |

---

## 16. Onay

| Rol | Gate 0 spec okudu | Gate 1 taslağa onay | Tarih |
|-----|-------------------|---------------------|-------|
| Proje lideri | ☐ | ☐ | |
| Backend lead | ☐ | ☐ | |
| Frontend lead | ☐ | ☐ | |

**Not:** Gate 1 kodu yalnızca Gate 0 **PASS** + bu taslağın onayı sonrası başlar.
