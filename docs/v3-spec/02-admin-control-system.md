# 02 — Admin Control System

**Belge türü:** Gate 0 — merkezi admin/kontrol sistemi ana karar dokümanı  
**Durum:** ☑ **İNCELEMEDE** (kararlar kilitli; API/UI implementasyon Gate 1)  
**Versiyon:** 0.2.0  
**Son güncelleme:** 21.05.2026  
**Ürün:** FactoryOS V3 · Fabrika ERP V2 = referans only (kod kopyalanmaz)

**Kaynaklar:**

| Kaynak | Rol |
|--------|-----|
| `FactoryOS-V3/Modül Detayları/01- Admin Paneli Kullanıcı Yorumları.docx` | Ürün yorumları + admin mockup kabulü |
| [01-central-ui-design-system.md](./01-central-ui-design-system.md) | UI-47…UI-51 kur ayrımı; UI-52…UI-56 admin kontrol |
| [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) | Görsel yön FROZEN |
| [05-country-currency-language.md](./05-country-currency-language.md) | Ülke/para/config sözleşmesi |
| [03-migration-module-registry.md](./03-migration-module-registry.md) | Registry tabloları, manifest |
| [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) | Yetki motoru |
| [v2-reference-index.md](./v2-reference-index.md) | V2 admin dosya yolları |
| **UI referans:** [`../mockups/factoryos-v3-admin-preview.html`](../mockups/factoryos-v3-admin-preview.html) |

**Gate 0 çıktısı:** Bu belge kararları kilitler; Gate 1 admin API, admin UI ve registry entegrasyonu **yazılmaz** (FROZEN öncesi).

---

## §0 Kaynaklar ve otorite ayrımı

| Katman | Otorite | Ne tanımlar |
|--------|---------|-------------|
| **00-ui** | Görsel FROZEN | Renk, tipografi, mockup HTML |
| **01-central-ui** | UI kararları | AppShell, profil menüsü, para formatı, dashboard kur **bilgilendirme** ayrımı |
| **02 (bu belge)** | Admin/kontrol kararları | Süper Yönetim, sistem ayarları, kullanıcı/rol, audit, yedek, dashboard yönetimi |
| **05-country-currency** | Para/ülke sözleşmesi | `Money`, `public/config`, snapshot |
| **03-migration-module-registry** | Registry şeması | `erp_modules`, `erp_pages`, manifest |

Admin paneli **basit kullanıcı/yetki ekranı değildir**; FactoryOS V3’ün **merkezi kontrol panelidir**:

| Sorumluluk | Açıklama |
|------------|----------|
| **Registry** | Modül, sayfa, kart, aksiyon yaşam döngüsü |
| **Kimlik & yetki** | Kullanıcı, sistem rolü, pozisyon, istisna izinler |
| **Konfigürasyon** | Firma, ülke, para, ön ekler, session, marka |
| **Operasyon** | Audit, yedek, migration durumu, geçici online erişim |
| **Dashboard yönetimi** | Hub modül kartları ve rapor kartları |
| **Güvenlik** | Defense-in-depth: UI gizleme + API guard + audit |

Operasyonel modüller (HR, Stok, Satınalma, Finans) **iş kuralı** yönetimini admin panelde yapmaz; **erişim, görünürlük ve sistem politikası** yönetilir.

**Mockup kabulü (DOCX):** `factoryos-v3-admin-preview.html` Gate 0 referansıdır; admin paneli bağımsız görsel dil üretemez (ADM-43).

---

## §1 Süper Yönetim / Admin ayrımı

| Kavram | Tanım |
|--------|--------|
| **Süper Yönetim** (`super_admin`) | Sistem kurucusu / en üst kontrol katmanı; tüm sistemi yönetir |
| **Admin** (`admin` ve genişletilmiş sistem rolleri) | Operasyonel yönetim; Süper Yönetim tarafından **kısıtlanabilir** |

| Karar | Detay |
|-------|--------|
| Ayrım | Süper Yönetim ≠ Admin; aynı yetki seti varsayılmaz (ADM-01) |
| Kısıtlama | Süper Yönetim gereksiz menü/kartları kapatabilir; Admin rolünün erişimini sınırlayabilir (ADM-02) |
| Admin sınırı | Admin **tüm sistemi otomatik** kontrol edemez; her menü/kart/ayar/işlem alanı **yetkiye tabidir** (ADM-03) |
| Registry pasif modül | `erp_modules.is_active = 0` → operasyonel API **403** (bakım); Süper Yönetim bile operasyonel işlem yapamaz |
| Yönetim API | Registry, ayar, yedek, audit — ayrı `admin.*` izinleri |

**FAIL:** “Admin her şeyi görür” varsayımı; frontend’de gizlenmiş ama API açık endpoint.

**İlgili:** [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) §5, §13.

---

## §2 Sistem ayarları

**Sistem Ayarları** tek merkezi ekran/sekmedir. Tüm alt alanlar **ayrı izin anahtarlarına** tabidir (`admin.settings.*` veya granular keys).

### 2.1 Firma ve iletişim (ADM-04, ADM-05)

| Alan | Açıklama | Gate |
|------|----------|------|
| Firma adı | Kurumsal unvan | 0 karar ☑ / Gate 1 UI |
| Adres | | 0 ☑ / Gate 1 |
| Telefon | | 0 ☑ / Gate 1 |
| Web sitesi | | 0 ☑ / Gate 1 |
| **Şirket logosu** | Kurumsal form/rapor/yazdırma; **sistem logosundan ayrı** (UI-60, ADM-05) | 0 ☑ / Gate 1 upload |

### 2.2 Oturum ve UI politikası (ADM-14)

| Alan | Açıklama |
|------|----------|
| Session timeout | Kullanıcının sistemde kalma süresi; admin panelinden ayarlanır |
| Sistem genel UI | [01-central-ui-design-system.md](./01-central-ui-design-system.md) ve [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) kararları **değiştirilemez**; admin yalnızca politika bayrakları (ör. desteklenen diller listesi) |

### 2.3 Yetki

Tüm §2 alanları görüntüleme/düzenleme için ayrı izin; Süper Yönetim bypass politikası Gate 1’de teknik detay (§17 A1).

---

## §3 Ülke, para birimi, kur ve prefix ayarları

[05-country-currency-language.md](./05-country-currency-language.md) ile **çelişmez**. Admin paneli **sistem politikası** ayarlar; işlem snapshot’larını ezmez.

### 3.1 Ülke ve para (ADM-06…ADM-09)

| Ayar | UI | Kural |
|------|-----|--------|
| Ülke seçimi | Çoktan seçmeli (`country_code`) | Admin ayarı (ADM-06) |
| Yerel para birimi | Çoktan seçmeli | Seçilen ülkeye göre **önerilen** varsayılan (ADM-07, ADM-08) |
| Raporlama para birimi | Çoktan seçmeli | Sınırlı set ile başlar (ör. yerel, USD); genişletme kontrollü (ADM-09) |
| Kur yapısı | FX policy tablosu | **Bozulmaz** — geçmiş snapshot korunur (ADM-10) |

### 3.2 Kur ayrımı (ADM-11, ADM-12) — 01-ui ile uyum

| Bağlam | Davranış |
|--------|----------|
| Dashboard güncel kur | Bilgilendirme/referans; Google veya admin tanımlı kaynak (UI-47) |
| Satınalma / bordro / stok / muhasebe | **Manuel girilen işlem kuru** otomatik **ezilmez** |
| Geçmiş kayıtlar | Güncel kur değişince geçmiş maliyet/tutar **değişmez** |

**FAIL:** Dashboard kuru güncellenince eski PO maliyeti değişiyor.

### 3.3 Belge ön ekleri (ADM-13)

| Ön ek | Kullanım |
|-------|----------|
| Proje ön eki | Proje belge no |
| Satınalma ön eki | PO, talep vb. |
| Personel ön eki | HR personel kodu |
| Muhasebe kayıt ön ekleri | Fiş/evrak no (çoklu alt alan olabilir) |
| Raporlama ön ekleri | Rapor çıktı kodları |

Gate 1: `system_settings` veya `document_prefixes` JSON; validasyon ve çakışma kontrolü **BEKLET**.

### 3.4 Gate 1 read-only sınırları (05 ile uyum)

| Alan | Gate 1 düzenleme |
|------|------------------|
| `local_currency` | Kontrollü / çoğu kurulumda read-only sonrası |
| `base_reporting_currency` | Kontrollü |
| Canlı para değişimi | Bakım runbook + migration |

---

## §4 Geçici online erişim

Ayrı **kart** (Genel bakış) veya **menü**; kullanım **yetkiye bağlı** (ADM-15, ADM-16).

| Özellik | Karar |
|---------|--------|
| Süreli erişim | Başlangıç/bitiş; otomatik kapanma |
| Kapsam | Hangi modül/aksiyon veya “salt okunur” katmanı — Gate 1 detay |
| Görünürlük | Her kullanıcı göremez; yalnızca yetkili admin |
| Audit | Kim açtı, ne zaman açtı, ne zaman kapattı → `activity_logs` |
| V2 referans | Fikir geliştirilebilir; kod birebir taşınmaz |

**Gate 1:** Tablo `temporary_access_grants` veya eşdeğer; API `POST/DELETE /api/admin/temporary-access` — **BEKLET** teknik şema.

---

## §5 Kullanıcı yönetimi

### 5.1 Liste ve ekleme (ADM-17…ADM-22)

| Karar | Detay |
|-------|--------|
| Birleşik ekran | Kullanıcı listesi + “Yeni kullanıcı” aynı sayfada (ADM-17) |
| Yeni kullanıcı | **Modal/popup** ile ekleme (ADM-18) |
| Liste sütunları | Kullanıcı adı + **aldığı roller** (ADM-19) |
| Satır aksiyonları | **Görüntüle** / **Düzenle** (ADM-20) |
| Düzenle modal | Kullanıcı adı, roller, yetkiler, aktif/pasif (ADM-20) |
| Silme yasağı | Giriş geçmişi olan kullanıcı **silinemez** (ADM-21) |
| Pasif / arşiv | Silme yerine `is_active=0` + arşiv; audit zinciri korunur (ADM-22) |
| Şifre | Admin tetikli sıfırlama / değiştirme |

### 5.2 Audit olayları (örnek)

`USER_CREATE`, `USER_DEACTIVATE`, `USER_PASSWORD_RESET`, `USER_ROLE_CHANGE`, `USER_PERMISSION_GRANT` / `REVOKE`.

### 5.3 Yetki

`admin.users.view`, `admin.users.manage` (granular); Süper Yönetim bypass.

### 5.4 V2 referans (davranış)

`admin-users.html`, `admin-user-new.html` → Gate 1’de birleşik ekran; HTML/CSS kopyalanmaz.

---

## §6 User–Employee bağlantısı

| Karar | Detay |
|-------|--------|
| Ayrı varlık | **User** (`users`) ≠ **Employee** (`employees`) (ADM-23) |
| Bağlantı | `employees.user_id` ↔ `users.id` — **opsiyonel** (ADM-24) |
| Admin kullanıcısı | Admin panelinde oluşturulan kullanıcı İK personeli **olmak zorunda değil** |
| İK personeli | İK’da kayıt olan kişi sistem kullanıcısı **olmak zorunda değil** |
| İK → profil | İK personeline erişim verilirse kullanıcı profili oluşur |
| İşten ayrılma | İK `terminated` / işten ayrıldı → bağlı kullanıcı **otomatik pasif** (ADM-25) |
| Yetkisiz İK | İK personeli olmayan kullanıcı yetki alıp işlem yapabilir (ADM-26) |

**Gate 1:** HR modülü personel durumu değişiminde `UserLifecycleService.deactivateLinkedUser(employeeId)` — **BEKLET** API adı.

---

## §7 İlk giriş ve şifre güvenliği

| Karar | Alan | Detay |
|-------|------|--------|
| Zorunlu ilk şifre | `must_change_password` (veya eşdeğer) | İlk girişte şifre değişimi **zorunlu** (ADM-27) |
| Modül kilidi | — | Şifre değişmeden verilen modül/yetkiler **açılmaz** (ADM-28) |
| UI | — | Yalnızca şifre değiştirme ekranı/modal erişilebilir; popup uyarı |
| Sonrası | — | Başarılı değişim → normal nav + permissionKeys yenileme |

**FAIL:** `must_change_password=true` iken stok API 200 dönüyor.

---

## §8 Rol ve yetkiler

### 8.1 Sistem rolü modeli (ADM-29…ADM-33)

| Karar | Detay |
|-------|--------|
| V2 fikir | Sistem rolü / İK rolü (pozisyon) ayrımı **incelendi** — fikir korunur, teknik borç taşınmaz |
| Sabit 3 rol yasağı | `super_admin`, `admin`, `staff` **yeterli değil**; yeni sistem rolü eklenebilir (ADM-29) |
| Rol ekleme | **Modal/popup** ile yeni sistem rolü (ADM-30) |
| Kapsam | Tüm modül, menü, kart, rapor, buton, işlem aksiyonu yetkiye dahil (ADM-31) |
| Admin rolü | Süper Yönetim tarafından **düzenlenebilir** (ADM-33) |
| İstisna izin | Kullanıcı bazlı ek yetki; **reason** zorunlu + audit |

### 8.2 Veri kaynakları

| Kaynak | Admin ekranı |
|--------|----------------|
| `roles` + `role_permissions` | Roller ve yetkiler |
| `position_permissions` | Pozisyon yetkileri (İK) |
| `user_permissions` | Kullanıcı istisnaları |
| `permissions` | Salt okunur katalog |

### 8.3 Registry entegrasyonu (ADM-32)

[03-migration-module-registry.md](./03-migration-module-registry.md):

| Tablo | Admin yönetimi |
|-------|----------------|
| `erp_modules` | Aktif/görünür/sıra |
| `erp_pages` | Path, `required_permissions`, nav |
| `erp_page_cards` | Hub + sayfa kartları |
| `erp_page_actions` | Buton + API route eşlemesi |

Yeni modül/menü/kart manifest veya controlled register ile permission registry’ye **otomatik veya onaylı** eklenir.

`required_permissions` semantiği: **ANY** (listeden biri yeterli).

---

## §9 Super admin güvenliği

| Kural | Detay |
|-------|--------|
| Kontrol | Süper Yönetim tüm sistemi yönetir (ADM-34 öncül) |
| Değiştirilemezlik | Başka hiçbir kullanıcı super_admin rol/yetki **değiştiremez** |
| Görünürlük | Başka kullanıcı super_admin bilgilerini **göremez/değiştiremez** |
| Liste | Super admin kayıtları gizli veya özel güvenli görünürlük kuralı |
| Kod yasağı | E-posta/telefon/şifre **düz metin** kod içinde tutulmaz |
| Bootstrap | Güvenli bootstrap/recovery akışı — **Gate 1** (§17) |
| Atama | `SUPER_ADMIN_GRANT` / `REVOKE` yalnızca mevcut super_admin; audit zorunlu |
| Self-escalation | Kullanıcı kendi kaydına `admin.*` veya `super_admin` **ekleyemez** |

---

## §10 Permission registry ve yetkisiz görünürlük

### 10.1 Defense-in-depth (ADM-35, ADM-36)

| Katman | Zorunluluk |
|--------|------------|
| Nav / hub / kart | Yetkisiz öğe render edilmez |
| Buton / aksiyon | `PermissionGate` |
| API | `requirePermission` / `requirePagePermission` → **403** |
| Doğrudan URL | Pasif sayfa veya izin yok → forbidden |

**Yalnızca frontend gizleme FAIL.**

### 10.2 View-only vs full-action (ADM-37)

| Katman | Örnek |
|--------|--------|
| View-only | `stock.movements.view` — liste görür, giriş yapamaz |
| Full-action | `stock.movements.create` — giriş modalı + API POST |

Aynı sayfada görüntüleme ve işlem izinleri **ayrı permission key** ile tanımlanır.

### 10.3 `is_active` vs `is_visible`

| Alan | Menü | Operasyonel API |
|------|------|-----------------|
| `is_active=0` | Gizli | **403** tüm roller |
| `is_active=1`, `is_visible=0` | Gizli | 200 (perm + doğrudan URL) |
| `is_active=1`, `is_visible=1` | Görünür (perm varsa) | 200 |

Pasif modül toggle → onay modalı (mockup) + `MODULE_DEACTIVATE` audit.

### 10.4 İzin yenileme

Rol/izin değişimi sonrası `permissionKeys` oturum yenileme veya TTL ≤ 60 sn.

---

## §11 Denetim günlüğü

**Merkezi** `activity_logs` (veya eşdeğer); V2 fikri referans, kod birebir taşınmaz (ADM-38).

### 11.1 Minimum alanlar

| Alan | Açıklama |
|------|----------|
| Kim | `actor_user_id` |
| Ne zaman | `occurred_at` |
| Modül | `admin`, `auth`, `hr`, `stock`, … |
| Kayıt | `entity_type`, `entity_id` |
| İşlem | `action` (enum) |
| Değişim | `old_value` / `new_value` (payload_json) |
| IP / cihaz | `ip_address`, `user_agent` (opsiyonel) |
| Sonuç | başarılı / başarısız |
| Yetkisiz deneme | `AUTHZ_DENIED`, `AUTH_LOGIN_FAIL` |

### 11.2 Kapsam (zorunlu olaylar)

| Alan | Örnek `action` |
|------|----------------|
| Auth | `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAIL` |
| Kullanıcı / rol / yetki | `USER_*`, `ROLE_PERMISSION_UPDATE` |
| Sistem ayarları | `SYSTEM_SETTING_UPDATE` |
| Yedek | `BACKUP_CREATE`, `BACKUP_DELETE` |
| Geçici erişim | `TEMP_ACCESS_GRANT`, `TEMP_ACCESS_REVOKE` |
| Registry | `MODULE_ACTIVATE`, `PAGE_DEACTIVATE`, `MODULE_REGISTER` |
| Satınalma onay | `PO_APPROVE`, … (domain) |
| Stok hareket | `STOCK_MOVEMENT_CREATE`, … |
| Muhasebe | (Gate 2+ finance) |
| Super admin | `SUPER_ADMIN_GRANT` |

Admin UI: filtre (tarih, modül, action, kullanıcı) — mockup log sekmesi. Silme yalnızca Süper Yönetim + ayrı politika (Gate 2).

---

## §12 Yedekleme ve bakım modu

### 12.1 Otomatik yedek (ADM-39, ADM-40)

| Özellik | Karar |
|---------|--------|
| Günlük yedek | Desteklenir |
| Saat ayarı | Admin panelinden (`backup_schedule`) |
| Liste | Son yedek tarihi + dosya boyutu + durum |
| Audit | `BACKUP_CREATE`, `BACKUP_DOWNLOAD`, `BACKUP_DELETE` |

### 12.2 Yedek modları (ADM-41) — DOCX iyileştirmesi

Kullanıcı isteği “yedek sırasında herkesi at” yerine **profesyonel ayrım**:

| Mod | Kullanıcı etkisi | Kullanım |
|-----|------------------|----------|
| **a) Hafif otomatik yedek** | Kullanıcı **atılmaz**; kısa kilit yok veya row-level snapshot | Günlük DB dump |
| **b) Tam sistem yedeği / bakım** | Uyarı; yeni işlem **engellenir**; gerekirse oturum sonlandırma | Planlı bakım penceresi |
| **c) Migration / restore** | **Bakım modu** (`maintenance_mode`); kullanıcılar çıkarılır; yazma API 503/403 | Migration, restore |

**Gate 0 karar:** (a) varsayılan günlük; (b)(c) açık runbook + admin onayı.

### 12.3 Restore

| Gate | Politika |
|------|----------|
| Gate 1 | UI **kapalı** veya Süper Yönetim + çift onay + (c) modu |
| Gerekçe | Canlı veri riski |

### 12.4 V2 referans

`admin-backup.html`, `backupService.js`, `backup_runs` — davranış referansı; kod kopyalanmaz.

### 12.5 Migration panel

[03-migration-module-registry.md](./03-migration-module-registry.md): applied/pending/failed görüntüleme; Gate 1’de panelden migrate **opsiyonel** (Süper Yönetim + bakım modu). Mockup “Yedek & migration” sekmesi.

---

## §13 Dashboard / anasayfa yönetimi

| Karar | Detay |
|-------|--------|
| Hub | Modül yönlendirme kartları + rapor kartları ([01-ui](./01-central-ui-design-system.md) UI-11…UI-13) |
| Yetki | Kullanıcı yalnızca yetkili modül/kart görür |
| Admin | Dashboard kartları ve raporlar admin panelden açılıp kapatılır (ADM-42) |
| Kullanıcı şablonu | Profile özel görev/rapor kartları — **geliştirme önerisi** |

### 13.1 Rol bazlı kart örnekleri (öneri)

| Rol / profil | Örnek kart |
|--------------|------------|
| Depocu | Bekleyen mal kabul |
| Satınalmacı | Fiyat bekleyen siparişler |
| Yönetici | Onay bekleyen talepler |
| İK | Eksik puantaj günleri |
| Muhasebe | Fatura bekleyen kayıtlar |
| Proje sorumlusu | Proje görevleri / sevkiyat durumu |

Gate 1: `dashboard_widgets` registry + `required_permissions` — **BEKLET** şema.

---

## §14 Admin kabul kriterleri (ADM-01 … ADM-44)

Gate 0’da **kod yazılmaz**. Varsayılan: karar maddeleri **KABUL**; teknik şema/API **BEKLET** veya Gate 1.

| Durum | Anlamı |
|-------|--------|
| **KABUL** | V3’te kesin uygulanacak karar |
| REVİZE | Karar doğru; detay değişecek |
| BEKLET | Gate 1 teknik uygulama |
| RED | Kapsam dışı |

| No | Kriter | PASS şartı | Gate 0 | Not |
|----|--------|------------|--------|-----|
| ADM-01 | Süper Yönetim ≠ Admin | Ayrı katman ve yetki modeli | **KABUL** | §1 |
| ADM-02 | Admin kısıtlama | Süper Yönetim Admin menü/kart kısıtlayabilir | **KABUL** | §1 |
| ADM-03 | Tüm menüler yetkiye tabi | Admin otomatik tam erişim yok | **KABUL** | §1, §10 |
| ADM-04 | Firma bilgileri | Sistem ayarlarında firma adı, adres, tel, web | **KABUL** | §2 |
| ADM-05 | Şirket logosu | Admin yükleme; sistem logosundan ayrı | **KABUL** | §2, UI-60 |
| ADM-06 | Ülke seçimi | Admin çoktan seçmeli | **KABUL** | §3 |
| ADM-07 | Yerel para birimi | Admin ayarı | **KABUL** | §3 |
| ADM-08 | Ülkeye göre öneri | Ülke seçilince para önerilir | **KABUL** | §3 |
| ADM-09 | Raporlama para birimi | Admin ayarı; kontrollü set | **KABUL** | §3 |
| ADM-10 | Kur yapısı korunur | Geçmiş snapshot bozulmaz | **KABUL** | §3, [05](./05-country-currency-language.md) |
| ADM-11 | Dashboard kuru bilgi | Referans only | **KABUL** | §3, UI-47 |
| ADM-12 | Manuel işlem kuru | Otomatik ezilmez | **KABUL** | §3, UI-50 |
| ADM-13 | Sistem ön ekleri | Admin panelinden yönetim | **KABUL** | §3 |
| ADM-14 | Session timeout | Admin ayarı | **KABUL** | §2 |
| ADM-15 | Geçici online erişim | Ayrı kart/menü; yetkili | **KABUL** | §4 |
| ADM-16 | Geçici erişim audit | Aç/kapa loglanır | **KABUL** | §4, §11 |
| ADM-17 | Kullanıcı birleşik ekran | Liste + ekleme aynı sayfa | **KABUL** | §5 |
| ADM-18 | Yeni kullanıcı modal | Popup ile ekleme | **KABUL** | §5 |
| ADM-19 | Liste kullanıcı + rol | Sütunlarda görünür | **KABUL** | §5 |
| ADM-20 | Görüntüle/düzenle | Satır aksiyonları + düzenle modal | **KABUL** | §5 |
| ADM-21 | Giriş geçmişi silme yok | Delete yasak | **KABUL** | §5 |
| ADM-22 | Pasif/arşiv | Silme yerine pasifleştirme | **KABUL** | §5 |
| ADM-23 | User ≠ Employee | Ayrı varlıklar | **KABUL** | §6 |
| ADM-24 | Bağlantı opsiyonel | user_id nullable | **KABUL** | §6 |
| ADM-25 | İşten ayrılma → pasif | Bağlı user otomatik pasif | **KABUL** | §6 |
| ADM-26 | İK’sız kullanıcı | Yetki ile işlem yapabilir | **KABUL** | §6 |
| ADM-27 | İlk giriş şifre | must_change_password zorunlu | **KABUL** | §7 |
| ADM-28 | Şifre öncesi modül yok | Yetkiler kilitli | **KABUL** | §7 |
| ADM-29 | Genişletilebilir sistem rolü | 3 rol ile sınırlı değil | **KABUL** | §8 |
| ADM-30 | Yeni rol modal | Popup ile rol ekleme | **KABUL** | §8 |
| ADM-31 | Tam permission kapsamı | Modül/menü/kart/buton/aksiyon | **KABUL** | §8, §10 |
| ADM-32 | Yeni registry → permission | Otomatik/kontrollü kayıt | **KABUL** | §8 |
| ADM-33 | Admin rolü düzenleme | Süper Yönetim düzenler | **KABUL** | §8 |
| ADM-34 | Super admin koruma | Başkası göremez/değiştiremez | **KABUL** | §9 |
| ADM-35 | Yetkisiz görünürlük | Menü/kart/sayfa/buton yok | **KABUL** | §10 |
| ADM-36 | API permission zorunlu | Backend 403 | **KABUL** | §10 |
| ADM-37 | View / action ayrımı | Ayrı permission key | **KABUL** | §10 |
| ADM-38 | Merkezi audit | Tek activity_logs | **KABUL** | §11 |
| ADM-39 | Günlük otomatik yedek | Zamanlanmış yedek | **KABUL** | §12 |
| ADM-40 | Yedek yönetim UI | Saat, liste, boyut | **KABUL** | §12 |
| ADM-41 | Bakım modu ayrımı | Hafif/tam/migration modları | **KABUL** | §12 |
| ADM-42 | Dashboard kart yönetimi | Admin/yetki bazlı | **KABUL** | §13 |
| ADM-43 | Merkezi UI uyumu | 00-ui + 01-ui; sayfa CSS yok | **KABUL** | §0, §14 UI |
| ADM-44 | V2 fikir, borç yok | Referans alınır; teknik borç taşınmaz | **KABUL** | §15, §16 |

**Gate 0 özet:** 44 kriter × **KABUL** (karar).

---

## §15 V2’den korunacaklar

| Fikir | V3’te |
|-------|--------|
| Sistem rolü / İK rolü (pozisyon) ayrımı | Genişletilmiş rol modeli + pozisyon permissions |
| Audit log | Merkezi `activity_logs` |
| Geçici online erişim | §4 yeni kart/menü |
| Kullanıcı aktif/pasif | Arşiv; delete yok |
| Yetkiye göre menü/kart | Registry + `GET /api/nav` |
| Admin hub sekme yapısı | Mockup uyumlu |
| Backup liste + manuel tetik | `backup_runs` + otomatik schedule |
| `requirePermission` middleware pattern | Tüm `/api/admin/*` |
| Manifest register | `POST /api/admin/modules/register` |

---

## §16 V2’den taşınmayacak teknik borçlar

| Borç | V2 belirti | V3 karşılığı |
|------|------------|--------------|
| Kırık permission fallback | `accessService` edge case | Tek çözümleme sırası + test |
| Admin her şeyi görür | Varsayılan geniş erişim | ADM-03 granular |
| Super admin / admin karışıklığı | Aynı ekran yetkileri | §1, §9 |
| Modül bazlı dağınık yetki | Sayfa içi özel kontrol | Registry + merkezi guard |
| Frontend-only permission | Gizli menü, açık API | ADM-36 |
| Kod içi super admin bilgisi | Hardcoded | Bootstrap env / secure store |
| Sabit 3 sistem rolü | staff/admin/super_admin only | ADM-29 |
| Sayfa bazlı admin CSS | `style.css`, admin sayfaları | `@factoryos/ui` |
| Dashboard kartları kodda sabit | `navigation.js`, hub hardcode | Registry + ADM-42 |
| Kur/para hardcode | `dashboardCurrency = 'UZS'` | [05](./05-country-currency-language.md) |
| Delete user | Audit zinciri kopması | ADM-21, ADM-22 |
| `GLOBAL_MODULES` / nav hardcode | `navigation.js` | `GET /api/nav` |
| Sınırsız user permission | İstisna reason + audit |
| Restore kolay buton | Gate 1 kapalı / runbook |
| `window.prompt` confirm | ConfirmDialog |

**V2 dosya referansı (inceleme):** [v2-reference-index.md](./v2-reference-index.md) §6 Admin.

---

## §17 Gate 0 / Gate 1 ayrımı ve açık kararlar

### 17.1 Aşama tablosu

| Aşama | Admin ile ilgili iş |
|-------|---------------------|
| **Gate 0 (şimdi)** | Bu belge v0.2.0 — ADM-01…44 **KABUL**; mockup + 00-ui/01-ui uyumu |
| **Gate 1** | `@factoryos/ui` admin shell; `/api/admin/*`; registry CRUD; kullanıcı/rol; audit liste; yedek (a) modu; migration **görüntüleme** |
| **Gate 2+** | Restore UI; dashboard widget registry; geçici erişim tam API; gelişmiş raporlama admin |

### 17.2 Gate 1 MVP kesim (korunmuş)

| Dahil Gate 1 | Sonraki gate |
|--------------|--------------|
| Hub + sekmeler (mockup) | Dashboard widget şablonları |
| Registry pasif/visible/sort | Inline permission JSON edit |
| Kullanıcı birleşik + modal | Toplu import |
| Rol + pozisyon izin matrisi | |
| Audit filtre liste | Arşiv/export |
| Yedek liste + schedule + (a) otomatik | Restore UI |
| Migration status görüntüleme | Panelden migrate (kısıtlı) |
| Manifest register | CI otomatik register |

### 17.3 Gate 1 test planı (AT — admin)

| ID | Senaryo | Beklenen |
|----|---------|----------|
| AT-01 | super_admin admin açar | 200 hub |
| AT-02 | Admin izni yok | 403 |
| AT-03 | Modül pasif | Menüden kaybolur |
| AT-04 | Pasif modül API | 403 |
| AT-05 | Sayfa pasif + URL | 403 |
| AT-06 | Kart pasif | Hub’da yok |
| AT-07 | Aksiyon pasif / izinsiz | UI yok + API 403 |
| AT-08 | Rol izin değişimi | audit |
| AT-09 | must_change_password | Modül API 403 |
| AT-10 | User izin reason yok | Red |
| AT-11 | Self admin yükseltme | Red |
| AT-12 | Super admin listede gizli | Başka admin göremez |
| AT-13 | Hafif yedek kullanıcı oturumu | Oturum devam |
| AT-14 | Bakım modu yazma | 503/403 |
| AT-15 | Geçici erişim audit | Log kaydı |

### 17.4 Açık kararlar (Gate 1+)

| # | Karar | Seçenek | Gate |
|---|--------|---------|------|
| A1 | Super admin bootstrap/recovery | Env seed / offline token / break-glass runbook | Gate 1 |
| A2 | Geçici online erişim şeması | Grant tablosu alanları | Gate 1 |
| A3 | Migration run admin UI | Kapalı / Süper Yönetim + bakım (c) | Gate 1 |
| A4 | Restore UI | Kapalı / çift onay | Gate 1–2 |
| A5 | Dashboard widget registry | Statik config vs DB | Gate 2 |
| A6 | Ön ek validasyon | Regex / uniqueness | Gate 1 |
| A7 | `admin.hub.view` granular | Modül bazlı admin keys | Gate 1 |
| A8 | Kiril/Latin backend | [01-ui](./01-central-ui-design-system.md) UI-33 ile ortak middleware | Gate 1 |

### 17.5 API yüzeyi taslağı (Gate 1 — özet)

| Grup | Örnek path |
|------|------------|
| Registry | `GET/PATCH /api/admin/registry/modules`, pages, cards, actions |
| Manifest | `POST /api/admin/modules/register` |
| Kullanıcı | `GET/POST/PATCH /api/admin/users`, reset-password |
| Rol/izin | `GET/PUT /api/admin/roles/:id/permissions`, positions, users |
| Ayarlar | `GET/PATCH /api/admin/settings` |
| Ops | `GET /api/admin/activity-logs`, `GET/POST /api/admin/backups` |
| Migration | `GET /api/admin/migrations/status` |
| Geçici erişim | `POST/DELETE /api/admin/temporary-access` (BEKLET) |

Tüm `/api/admin/*` → `requirePermission` + audit middleware.

### 17.6 Belge onayı

| Rol | İsim | Tarih |
|-----|------|-------|
| Proje lideri | | |
| Backend lead | | |
| Frontend lead | | |
| Ops / DBA | | |

**Durum:** İNCELEMEDE — Gate 0 admin kararları dokümante; **FROZEN** proje onayı sonrası.

**Sonraki spec:** [03-migration-module-registry.md](./03-migration-module-registry.md) (registry detay), [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) (motor).
