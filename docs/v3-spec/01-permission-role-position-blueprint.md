# FactoryOS V3 — Permission / Role / Position Blueprint

**Belge türü:** Gate 0 platform spec (detay)  
**Checklist eşlemesi:** `04-permission-system.md` (özet kart → bu belge otoritedir)  
**Durum:** ☐ TASLAK | ☐ İNCELEMEDE | ☐ FROZEN  
**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026  
**Ürün:** FactoryOS V3 · V2 referans only (kod kopyalanmaz)

**İlişkili belgeler:** [02-admin-control-system.md](./02-admin-control-system.md) (registry), [03-migration-module-registry.md](./03-migration-module-registry.md) (seed), [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) (UI FROZEN)

---

## 1. Amaç

FactoryOS V3’te yetkilendirme **tek motor** üzerinden yürür:

- Aynı `perm_key` hem API hem sayfa hem menü hem buton için geçerlidir.
- Çözümleme sırası sabittir; istisna yalnızca `super_admin` ve belgeli redaction kurallarıdır.
- V2’deki dağınık `hasAny` / sayfa özel kontroller / sadece frontend gizleme **tekrarlanmaz**.

**Gate 0 çıktısı:** Bu belge FROZEN olmadan permission seed, admin izin ekranları ve Gate 1 `PermissionGate` implementasyonu başlamaz.

---

## 2. Kapsam

| Dahil | Hariç (Gate 0 / bu belge) |
|-------|---------------------------|
| Rol, pozisyon, kullanıcı izin modeli | HR bordro hesaplama formülleri ([06](./06-hr-full-blueprint.md)) |
| `perm_key` katalog yapısı ve isimlendirme | Modül iş kuralları (stok FIFO vb.) |
| Backend guard + frontend PermissionGate | Kod implementasyonu (Gate 1) |
| Registry ile modül/sayfa/kart/action görünürlüğü | V2 dosya kopyalama |
| Hassas alan API redaction (maaş vb.) | |

---

## 3. Aktörler ve tanımlar

| Terim | Açıklama |
|-------|----------|
| **User** | `users` — oturum açan hesap; bir `role_id` taşır |
| **Role** | `roles` — sistem rolü (`super_admin`, `depocu`, `ik_mudur`, …) |
| **Employee / Position** | `employees.position_id` — HR pozisyonu; kullanıcıya bağlı personel kaydı üzerinden izin alır |
| **Permission** | `permissions` — global katalog; `perm_key` benzersiz |
| **perm_key** | `module.stock`, `stock.in.view`, `hr.salary.edit` formatında string |
| **super_admin** | Rol `slug = super_admin` → tüm izinler (bypass) |
| **PermissionGate** | Tek çözümleyici (backend servis + frontend wrapper) |
| **Registry** | `erp_modules`, `erp_pages`, `erp_page_cards`, `erp_page_actions` — pasif kayıt + `required_permissions` |

---

## 4. Çözümleme sırası (otorite kuralı)

Bir `perm_key` için `user` yetkili mi sorusu **yalnızca** şu sırada cevaplanır:

```text
1. super_admin (role.slug)     → EVET (tüm perm_key)
2. role_permissions            → role_id üzerinden
3. position_permissions        → employees.position_id üzerinden (user↔employee bağlı)
4. user_permissions            → kullanıcıya özel ek / istisna
5. Hiçbiri yok                 → HAYIR
```

**Birleşim kuralı:** Katmanlar arasında **OR** (herhangi birinde varsa izin var). Sıra öncelik değil, erken çıkış yalnızca `super_admin` için.

**V2 uyumu:** `backend/services/accessService.js` — `userHasPermission`, `userHasAnyPermission`, `listUserPermissionKeys` aynı sırayı kullanır.

---

## 5. Super admin bypass

| Kural | Detay |
|-------|--------|
| Tanım | `users.role_id` → `roles.slug = 'super_admin'` |
| Etki | Tüm `perm_key` sorguları **true**; registry pasif modül bile super_admin için açılabilir (opsiyonel politika: pasif modül yine 403 — bkz. §10) |
| `perm_key` kaydı | `super_admin` bir **rol slug**’dır; `permissions` tablosunda `perm_key` olarak kullanılmaz |
| Atama | Yalnızca mevcut super_admin veya DB seed; self-service yok |
| Audit | Rol değişikliği ve super_admin ataması `activity_logs` zorunlu |

**Önerilen Gate 1 politikası (çift koruma):**

- **Yetki:** super_admin → her `perm_key` true.
- **Registry:** `erp_modules.is_active = 0` → API **403** (tüm roller dahil) — sistem bakım modu; super_admin yönetim API’sinden modülü açar.

Bu ayrım: “yetki var” ≠ “modül yayında”. V2’de modül pasif kontrolü ayrı katmandır; V3’te birleştirilir.

---

## 6. Role permissions

### 6.1 Veri modeli

| Tablo | Açıklama |
|-------|----------|
| `roles` | `id`, `slug`, `name`, `is_system` |
| `permissions` | `id`, `perm_key`, `name`, `description`, `module_key` (opsiyonel indeks) |
| `role_permissions` | `role_id`, `permission_id` — PK `(role_id, permission_id)` |

### 6.2 Kullanım ilkesi

| İlke | Açıklama |
|------|----------|
| Varsayılan taşıyıcı | Kullanıcının **sistem rolü** (depocu, satınalmacı, ik_mudur) izinlerinin ana kaynağı |
| Modül kapısı | `module.{hr\|stock\|purchasing\|finance\|projects\|reports\|admin}` — kaba erişim; granular key’lerle birlikte |
| Backfill (V2→V3 seed) | `module.X` varsa yalnızca `*.view` otomatik; `create/edit/approve/price_edit` **otomatik verilmez** (V2 patch-036 kuralı korunur) |

### 6.3 Örnek rol matrisi (taslak)

| Rol slug | Örnek izinler |
|----------|----------------|
| `depocu` | `module.stock`, `stock.*.view`, `stock.in.create`, `stock.out.create` |
| `satinalmaci` | `module.purchasing`, `purchasing.*.view`, `purchasing.order.price_edit` |
| `ik_mudur` | `module.hr`, `hr.*.view`, `hr.employees.edit`, `hr.salary.view_group`, … |
| `muhasebe_izleme` | `module.reports`, `reports.*.view` — fiyat/maliyet redaction ayrı |

Tam katalog: Gate 0 kapanışında seed dosyasında (`seeds/core/permissions.sql`).

---

## 7. Position permissions

### 7.1 HR pozisyonu ile ilişki

```text
users.id ←→ employees.user_id (0..1 veya 1..1 — Gate 0’da netleştir: öneri 0..1)
employees.position_id → positions.id
position_permissions.position_id → permission_id
```

| Kural | Açıklama |
|-------|----------|
| Bağlantı | Pozisyon izni **yalnızca** kullanıcının bağlı `employees` kaydı varsa uygulanır |
| Pozisyonsuz kullanıcı | Sadece `role_permissions` + `user_permissions` |
| Pozisyon değişimi | Eski `position_permissions` otomatik düşer; yeni pozisyonun izinleri geçerli olur (anında, cache invalidate) |
| İK domain | Pozisyon tanımı HR modülünde; permission admin’den pozisyona atanır |

### 7.2 Ne zaman pozisyon izni?

| Senaryo | Öneri |
|---------|--------|
| Aynı rol, farklı yetki (ör. “Şef depo” vs “Depo elemanı”) | **Pozisyon** izni |
| Tüm depoculara ortak | **Rol** izni |
| Geçici proje yetkisi | **User** izni (istisna, süreli — Gate 1 opsiyonel `expires_at`) |

### 7.3 V2 referans

- `position_permissions` tablosu ve `accessService` JOIN — V2’de çalışıyor.
- Admin: `admin-permissions` pozisyon sekmesi (V2 frontend).

---

## 8. User-specific permissions (istisna)

| Kural | V3 kararı |
|-------|-----------|
| Varsayılan | **Kapalı varsayılan** — önce rol + pozisyon doldurulur |
| İzin verilir | Evet, **yalnızca istisna**: geçici görev, vekalet, tek kullanıcı pilot, super_admin onaylı istisna |
| Vermeme | Modülün tamamını user’a bağlama (`module.stock` user’a — yasak; role veya position kullan) |
| Denetim | Her `user_permissions` satırı: `granted_by`, `granted_at`, `reason` (zorunlu metin) |
| UI | Admin → Kullanıcı izinleri; uyarı banner: “İstisna — tercih rol/pozisyon” |
| Kaldırma | Silindiğinde anında etkisiz; oturum cache TTL ≤ 60 sn veya logout zorunlu |

**Gerekçe:** User izinleri audit ve sürpriz 403/ fazla yetki riski taşır; V3’te korunur ama şişirilmez.

---

## 9. Permission key katalogu

### 9.1 İsimlendirme

```text
{module}.{resource}.{action}
{module}.{action}          # hub: hr.hub.view
module.{module}            # kaba kapı: module.stock
```

| Segment | Örnek | Not |
|---------|--------|-----|
| `module` | `stock`, `hr`, `purchasing` | Küçük harf, snake yok |
| `resource` | `in`, `employees`, `order` | |
| `action` | `view`, `create`, `edit`, `approve`, `price_edit` | `view` menü/sayfa için minimum |

### 9.2 Katmanlar (üç seviye)

| Seviye | Örnek | Amaç |
|--------|--------|------|
| Modül kapısı | `module.hr` | Modül kartı + genel API grubu |
| Sayfa / özellik | `hr.attendance.view` | Sayfa registry `required_permissions` |
| Hassas alt alan | `hr.salary.view_rsu` | API redaction alan eşlemesi |

### 9.3 V2’den taşınacak granular set (özet)

V2 `patch-036-granular-permissions.js` içindeki anahtarlar **mümkün olduğunca 1:1** seed edilir:

- Stok: `stock.hub.view` … `stock.reports.view` (10)
- Satınalma: `purchasing.hub.view` … `purchasing.suppliers.view` (10)
- İK: `hr.hub.view`, `hr.employees.view`, … (mevcut + maaş alt anahtarları)
- Projeler: `projects.hub.view`, `projects.control.*`

Yeni V3 modülü: `reports.*`, `admin.*` — Gate 1 core seed.

---

## 10. Module / page / card / action görünürlüğü

Registry ([02-admin-control-system.md](./02-admin-control-system.md)) + PermissionGate birlikte çalışır.

### 10.1 Karar matrisi

| Kontrol | Koşul | Menü | Sayfa HTML | API |
|---------|--------|------|------------|-----|
| Modül pasif | `erp_modules.is_active = 0` | Gizli | 403 redirect | **403** |
| Sayfa pasif | `erp_pages.is_active = 0` | Gizli | 403 | **403** |
| `required_permissions` | Kullanıcıda yok | Gizli | 403 | **403** |
| Kart / action | `erp_page_actions.required_permissions` | Kart yok | Buton yok | İlgili route 403 |

**Kural:** Frontend gizleme yeterli değil; **her zaman** backend guard.

### 10.2 Nav çözümleme (Gate 1)

```text
GET /api/nav → sunucu tarafı filtrelenmiş ağaç
  filter: module.is_active
  filter: page.is_active
  filter: PermissionGate.any(user, page.required_permissions)
```

V2 `navigation.js` + `GLOBAL_MODULES` → V3 registry API; hardcoded modül listesi yok.

### 10.3 Doğrudan URL / derin link

| Durum | Davranış |
|-------|----------|
| Yetkisiz kullanıcı `/stock-in.html` açar | `requirePagePermission` → `/?err=forbidden` veya 403 sayfa |
| Yetkisiz `POST /api/stock/in` | **403** JSON `{ code: 'FORBIDDEN' }` |
| Bilgi sızıntısı | 404 vs 403: **API’de 403** tutarlı; kayıt varlığını gizlemek için hassas id’lerde 404 opsiyonel (HR maaş) |

---

## 11. Frontend PermissionGate

### 11.1 Oturum yükü

Login / session yenileme sonrası:

```json
{
  "user": { "id", "role": { "slug" }, "employeeId": null },
  "permissionKeys": ["module.stock", "stock.in.view", ...]
}
```

- `permissionKeys`: sunucu `listUserPermissionKeys` ile üretir (client hesaplamaz).
- Cache: bellek + `sessionStorage` yok (tam liste sunucudan); TTL session ömrü.

### 11.2 API (frontend)

```javascript
// Gate 1 hedef — isimler sabit
PermissionGate.has('stock.in.view')
PermissionGate.any(['stock.in.view', 'stock.in.create'])
PermissionGate.assert('stock.in.create')  // UI: disabled + tooltip
```

| Kullanım yeri | Davranış |
|---------------|----------|
| Modül hub kartı | `PermissionGate.any(card.required_permissions)` |
| Tablo satır aksiyonu | `erp_page_actions` key |
| Form alanı (maaş) | Alan bazlı key veya sunucu redaction |
| Router guard | Sayfa açılmadan önce `permissionKeys` kontrol |

**Yasak:** Sadece `display:none` ile gizleyip API’yi korumasız bırakmak.

### 11.3 V2 referans

- `frontend/public/js/auth-context.js` — oturum ve izin listesi
- `navigation.js` — `hasPermissionAccess`

---

## 12. Backend requirePermission / API guard

### 12.1 Middleware

```javascript
requirePermission('stock.in.create')
requireAnyPermission(['purchasing.receipt.view', 'purchasing.receipt.create'])
```

| Durum | HTTP | Gövde |
|-------|------|--------|
| Oturum yok | 401 | `UNAUTHORIZED` |
| Oturum var, izin yok | **403** | `FORBIDDEN` — `api.permission.denied` |
| super_admin | 200 (registry pasif hariç) | |

### 12.2 Servis katmanı

İş mantığı içinde ek kontrol:

```javascript
await PermissionResolver.assert(user, 'hr.salary.edit')
```

Route’ta unutulan endpoint’ler için integration test zorunlu.

### 12.3 Sayfa (HTML) guard

V2: `requirePagePermission` → V3 aynı mantık:

- Express static/HTML route öncesi middleware
- Yetkisiz → login veya `forbidden` landing

Gate 1’de SPA/MPA kararına göre uygulanır; kural değişmez.

### 12.4 V2 referans

| Dosya | Not |
|-------|-----|
| `backend/middlewares/requirePermission.js` | API guard |
| `backend/middlewares/requirePagePermission.js` | HTML guard |
| `backend/services/accessService.js` | Çözümleyici |

---

## 13. Admin panel — yetki verme / alma

### 13.1 Ekranlar (V3 hedef — admin mockup uyumlu)

| Ekran | İşlev | Yetki |
|-------|--------|-------|
| Rol izinleri | `role_permissions` CRUD | `admin.permissions.roles` |
| Pozisyon izinleri | `position_permissions` CRUD | `admin.permissions.positions` |
| Kullanıcı izinleri | `user_permissions` istisna | `admin.permissions.users` |
| İzin kataloğu (salt okunur) | `permissions` listesi | `admin.permissions.catalog.view` |

### 13.2 İş kuralları

| Kural | Açıklama |
|-------|----------|
| Kim değiştirir | `admin.permissions.*` veya super_admin |
| Kendi kendine yükseltme | Kullanıcı kendi rolüne `admin.*` ekleyemez |
| super_admin rolü | Yalnızca super_admin atar / kaldırır |
| Pozisyon izni | Pozisyon HR’da tanımlı olmalı (`positions.id` FK) |
| User istisna | `reason` zorunlu; `activity_logs` |
| Anında etki | Değişiklik sonrası `permissionKeys` yenileme veya kısa TTL cache purge |

### 13.3 API (taslak)

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/admin/roles/:id/permissions` | Rol izinleri |
| PUT | `/api/admin/roles/:id/permissions` | Tam liste replace veya delta (karar Gate 1) |
| GET | `/api/admin/positions/:id/permissions` | Pozisyon izinleri |
| PUT | `/api/admin/positions/:id/permissions` | |
| GET | `/api/admin/users/:id/permissions` | Kullanıcı istisnaları |
| PUT | `/api/admin/users/:id/permissions` | Audit alanları zorunlu |

---

## 14. Hassas alanlar — API redaction

**İlke:** Yetkisiz kullanıcıya alan **null / omit** veya **403**; asla kısmi gerçek değer sızıntısı yok.

### 14.1 HR maaş (V2 kanıtı)

V2 `hrService.js` — grup bazlı anahtarlar:

| Alan grubu | perm_key (örnek) |
|------------|------------------|
| Grup görünürlüğü | `hr.salary.view_group` |
| Toplam | `hr.salary.view_total` |
| RSU / GRGU / GU / SU alt alanları | `hr.salary.view_rsu`, `hr.salary.view_grsu`, … |
| Düzenleme | `hr.salary.edit` |
| Tazminat listesi | `hr.compensation.view` |
| Geçmiş | `hr.salary.history_view` |

| Kural | V3 |
|-------|-----|
| `module.hr` yetmez | Maaş alanları için granular key zorunlu (V2 ile aynı) |
| Liste endpoint | Yetkisiz kolonlar response’tan çıkarılır |
| Tekil personel | Yetkisiz ise 403 veya maskeli DTO |
| Puantajda maaş | `listMonthlyAttendance` compensation_source — viewer iznine göre |

### 14.2 Satınalma fiyat gizleme (V2)

`purchasingController` — `hidePrice` flag: `module.purchasing` yoksa fiyat alanları gizlenir.

| V3 perm_key | Davranış |
|-------------|----------|
| `purchasing.order.view` + fiyat yok | Sipariş görür, `unit_price` null |
| `purchasing.order.price_edit` | Fiyat girer/günceller |

### 14.3 Stok maliyet (FIFO)

| perm_key | Davranış |
|----------|----------|
| `stock.cost.view` (yeni — seed) | `unit_cost`, katman detayı |
| Yok | Hareket görür, maliyet kolonları redacted |

### 14.4 Redaction implementasyon notu (Gate 1)

- DTO mapper katmanında `redactFields(user, payload, schema)` 
- Schema Gate 0’da HR/Stock/Purch spec’lerde alan listesi olarak genişler
- **Asla** yalnızca frontend’de `***` gösterip API’de ham değer döndürmek

---

## 15. Özel kurallar özeti

| # | Kural | V2 | V3 |
|---|--------|-----|-----|
| P1 | Çözümleme sırası | accessService sırası | Aynı |
| P2 | super_admin bypass | Var | Var + registry pasif istisnası net |
| P3 | module.X → sadece *.view backfill | patch-036 | Seed kuralı |
| P4 | User izin istisna | Var | Var, audit zorunlu |
| P5 | Manuel stok girişi | super_admin only (V2 pratik) | **Önerilen: Seçenek C** → [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) §11 (talep+onay) |
| P6 | HR maaş granular | Var | Zorunlu redaction |
| P7 | Doğrudan API | 403 | 403 |
| P8 | Pasif modül | Kısmen | 403 + menü gizli |

**Karar P5 (önerilen):** [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) — Seçenek **C** (talep + onay); `stock.in.manual.override` yalnızca super_admin. Resmi kapanış: Stock belgesi FROZEN ile.

---

## 16. Veri modeli (Gate 1 migration özeti)

```sql
-- Özet; tam SQL 03-migration + 04 seed
roles (id, slug, name, is_system)
permissions (id, perm_key, name, description, module_key)
role_permissions (role_id, permission_id)
position_permissions (position_id, permission_id)
user_permissions (user_id, permission_id, granted_by, granted_at, reason)
```

İndeksler: `permissions(perm_key)` UNIQUE; FK CASCADE politikası Gate 1 DBA onayı.

---

## 17. Test / doğrulama senaryoları

| ID | Senaryo | Adımlar | Beklenen |
|----|---------|---------|----------|
| PT-01 | super_admin bypass | super_admin ile herhangi bir `perm_key` route | 200 |
| PT-02 | Rol izni | depocu + `stock.in.view` | 200 view; create 403 |
| PT-03 | Pozisyon izni | Aynı rol; pozisyonda `stock.out.create` | create 200 |
| PT-04 | User istisna | Rolde yok; user_permissions’ta var | 200 + audit kaydı |
| PT-05 | User istisna yok | Rolde yok; user’da yok | 403 |
| PT-06 | Pozisyonsuz | employee bağlı değil | Yalnızca rol + user |
| PT-07 | Pasif modül | `module stock` pasif | Menü yok; API 403 |
| PT-08 | Doğrudan URL | Yetkisiz `/stock-movements.html` | Redirect forbidden |
| PT-09 | Doğrudan API | Yetkisiz POST | 403 JSON |
| PT-10 | Nav API | Kısmi izin | Yalnızca yetkili sayfalar |
| PT-11 | Maaş redaction | `module.hr` var, `hr.salary.view_*` yok | Maaş alanları yok |
| PT-12 | Maaş görünür | `hr.salary.view_group` | İzinli kolonlar dolu |
| PT-13 | Fiyat gizleme | purchasing view, price yok | `hidePrice` DTO |
| PT-14 | Cache invalidate | Admin rol izni kaldır | ≤60 sn veya relogin sonrası 403 |
| PT-15 | Self-escalation | User kendi admin iznini ekler | 403 |
| PT-16 | listUserPermissionKeys | Normal user | Birleşik DISTINCT liste |
| PT-17 | requireAny | İki keyden biri | 200 |
| PT-18 | Registry + perm | Sayfa `required_permissions` | İkisi de gerekli |

---

## 18. Riskler

| Risk | Etki | Azaltma |
|------|------|---------|
| User izin şişmesi | Audit zor, fazla yetki | İstisna + reason zorunlu; periyodik review |
| Frontend-only guard | API sızıntısı | Her route middleware; otomatik route scan testi |
| Cache eski izin | Yanlış 200 | Kısa TTL; admin değişikliğinde purge |
| perm_key drift | 403 sürpriz | Katalog seed + registry codegen |
| module.X yeter sanılması | Maaş sızıntısı | Redaction şeması + PT-11/12 |
| V2 1:1 seed eksik | UAT kırılması | patch-036 tam import checklist |
| Pozisyon–user kopukluğu | Beklenmeyen 403 | HR onboarding: user↔employee zorunluluğu politikası |

---

## 19. Kabul kriterleri (Gate 0 — bu belge)

- [ ] Çözümleme sırası (§4) paydaş onayı
- [ ] super_admin + registry pasif politikası (§5, §10) yazılı ve onaylı
- [ ] User izin “istisna only” kuralı (§8) onaylı
- [ ] `perm_key` isimlendirme ve katmanlar (§9) onaylı
- [ ] Module/page/card/action matrisi (§10) onaylı
- [ ] Frontend PermissionGate + backend guard sözleşmesi (§11–12) onaylı
- [ ] Admin verme/alma ekranları ve API taslağı (§13) onaylı
- [ ] HR maaş + purchasing fiyat + stok maliyet redaction (§14) onaylı
- [ ] Test senaryoları PT-01…PT-18 Gate 1 test planına aktarıldı
- [ ] V2 referans dosyaları doğrulandı (§20)
- [ ] Açık karar P5 — [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) içinde kapatıldı (bu belgeye referans)
- [ ] Durum satırı: **FROZEN**

---

## 20. V2 referans noktaları

| Konu | V2 dosya |
|------|----------|
| Çözümleyici | `backend/services/accessService.js` |
| API middleware | `backend/middlewares/requirePermission.js` |
| Sayfa middleware | `backend/middlewares/requirePagePermission.js` |
| Granular seed | `database/patch-036-granular-permissions.js` |
| Auth / super_admin | `backend/services/authService.js` |
| HR maaş redaction | `backend/services/hrService.js` (compensation / salary keys) |
| HR routes guard | `backend/routes/hrRoutes.js` |
| Purchasing hidePrice | `backend/controllers/purchasingController.js` |
| Frontend nav | `frontend/public/js/navigation.js`, `auth-context.js` |
| Admin izin UI | `frontend/public/admin-permissions.html` (referans akış) |

**Taşınmayacak:** Middleware veya servisin birebir kopyası; yalnızca davranış referansı.

---

## 21. Onay

| Rol | İsim | Tarih | Not |
|-----|------|-------|-----|
| Proje lideri | | | |
| Backend lead | | | |
| Frontend lead | | | |
| İK domain | | | Maaş redaction |

**Sonraki spec (platform sırası):** [03-migration-module-registry.md](./03-migration-module-registry.md)
