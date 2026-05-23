# FactoryOS V3 — HR Full Blueprint (İnsan Kaynakları)

**Belge türü:** Gate 0 domain spec  
**Durum:** ☐ TASLAK | ☑ İNCELEME | ☐ FROZEN  
**Versiyon:** 2.0.0  
**Son güncelleme:** 21.05.2026  
**V2 çalışma oranı (referans):** ~%95 iş kuralı korunur  
**Ürün:** FactoryOS V3 · V2 referans only (kod kopyalanmaz)

**Platform bağımlılıkları:**

- [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md)
- [05-country-currency-language.md](./05-country-currency-language.md)
- [03-migration-module-registry.md](./03-migration-module-registry.md) **v0.2.0** — registry, manifest, ABAC
- [01-central-ui-design-system.md](./01-central-ui-design-system.md) — merkezi modal/UI
- [02-admin-control-system.md](./02-admin-control-system.md) — country profile, admin ayarları
- [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md)
- [09-finance-data-contract.md](./09-finance-data-contract.md) — bordro ödeme, avans, kasa ayrımı
- [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) — platform pattern referansı (registry §2A)

---

## 1. Amaç

FactoryOS V3 **İnsan Kaynakları (HR)** modülü “mini HR” veya demo modül **değildir**. V2’de üretimde çalışan personel master, maaş motoru, puantaj, ay kilidi ve bordro snapshot mantığı **korunur**; ancak:

| V2 sorun | V3 düzeltme |
|----------|-------------|
| Dağınık HR sayfa JS/CSS | `@factoryos/ui` + registry sayfaları |
| Frontend maaş hesabı | Tek backend **WageEngine** |
| `module.hr` ile maaş sızıntısı | Granular `hr.salary.*` + API redaction |
| Saat ondalık / 100’lük hata riski | **Dakika** birincil; saat türev |
| Eksik `termination_date` | Zorunlu çıkış modeli |
| Hardcoded UZS/USD etiketleri | Yerel / rapor para birimi ([05](./05-country-currency-language.md)) |
| Ayrı Personel Kartı sayfası | Personeller popup/edit |
| Ayrı Ay Kilitleri menüsü | Bordro ekranı içi kilitleme |
| HR doğrudan kasa düşümü | Finance onaylı ödeme ([09](./09-finance-data-contract.md)) |
| User ↔ employee duplicate | Bağlantı kuralları |

**Gate 0 çıktısı:** Bu belge FROZEN olmadan Gate 2 HR migration, API ve UI **yazılmaz**.

---

## 2. Kapsam

HR modülü aşağıdaki **tam** iş alanlarını kapsar (Gate 2 minimum = bu listenin tamamı veya belgeli fazlama ile aynı kabul seti).

| # | Alan | Açıklama |
|---|------|----------|
| 1 | **Personel profili** | Kimlik, iletişim, adres, fotoğraf |
| 2 | **Departman** | Organizasyon ağacı |
| 3 | **Pozisyon** | İş tanımı + `position_permissions` bağlantısı |
| 4 | **Kullanıcı bağlantısı** | `users` ↔ `employees` |
| 5 | **Role / position permission** | Platform permission blueprint |
| 6 | **Nationality** | TR / UZ / RU / EN / OTHER |
| 7 | **Address / country / region** | Ülke profiline uyumlu |
| 8 | **Hire date** | İşe giriş |
| 9 | **Termination date & reason** | İşten çıkış (V3 zorunlu) |
| 10 | **Salary structure** | Toplam + resmi/gayri resmi + currency |
| 11 | **Official / unofficial split** | WageEngine ile |
| 12 | **Salary currency** | USD/UZS/… orijinal korunur |
| 13 | **Overtime eligible** | Ödenebilir FM bayrağı |
| 14 | **Daily attendance** | Günlük puantaj |
| 15 | **Monthly attendance** | Ay özeti |
| 16 | **Day types** | Normal, pazar, tatil kuralları |
| 17 | **Work statuses** | worked, absent, leave, … |
| 18 | **Overtime minutes** | raw vs payable |
| 19 | **Monthly lock** | Ay kilidi |
| 20 | **Payroll snapshot** | Kilit anı dondurma |
| 21 | **Salary visibility / redaction** | Granular API |
| 22 | **Profile integration** | `my-profile` / self-service sınırlı |
| 23 | **Finance hazırlık** | `employee_advances`, party link stub |
| 24 | **Vardiya sistemi** | Plan: `hr_shifts` + `employee_shift_assignments` (H1-C) |
| 25 | **Fiili çalışma datetime** | `attendance_daily.start_datetime` / `end_datetime` (H1-B) |

**Gate 0 KABUL (H1):** Vardiya + çalışma takvimi + çalışma durumu bağlı model (**C+B**); uygulama Gate 2 HR settings/attendance engine (§12, §17B).

**Gate 2 dışı (uygulama Gate):** Tam finance ödeme UI; HR **ödeme yükümlülüğü** üretir, kasa finance onayıyla düşer (§15C).

---

## 2A. Registry, manifest ve permission uyumu

[03-migration-module-registry.md](./03-migration-module-registry.md) **v0.2.0** ile uyumlu. HR modülü **hardcoded navigation** kullanmaz; sayfa, kart, aksiyon ve API guard **manifest + registry** üzerinden gelir. Frontend gizleme **yeterli değil** (MIG-16, MIG-17).

### 2A.1 Modül kaydı

| Alan | Değer |
|------|--------|
| `module_key` | `hr` |
| `name_i18n_key` | `menu.module.hr` |
| Manifest | `modules/hr/module.manifest.json` |
| Register | `modules:register --module=hr` (Gate 1) |

### 2A.2 Sayfa registry (`erp_pages`)

| page_key | Menü / ekran | path (örnek) | required_permissions (ANY) | Not |
|----------|--------------|--------------|----------------------------|-----|
| `hr.hub` | HR giriş | `/hr` | `module.hr`, `hr.hub.view` | Hub |
| `hr.employees` | **Personeller** | `/hr/employees` | `hr.employees.view` | Ana merkez; popup CRUD — §6 |
| `hr.attendance.daily` | Günlük Puantaj | `/hr/attendance/daily` | `hr.attendance.daily.view` | |
| `hr.attendance.monthly` | Aylık Puantaj | `/hr/attendance/monthly` | `hr.attendance.monthly.view` | |
| `hr.payroll` | **Bordro** | `/hr/payroll` | `hr.payroll.view` | Ay kilidi **burada** — §15A |
| `hr.compensation` | Ücret Değerlendirme | `/hr/compensation` | `hr.compensation.view` | Sadeleştirilmiş toplam — §17A |
| `hr.departments` | Departmanlar | `/hr/departments` | `hr.departments.view` | |
| `hr.positions` | Pozisyonlar | `/hr/positions` | `hr.positions.view` | |
| `hr.settings` | HR Ayarları | `/hr/settings` | `hr.settings.view` | Vardiya/çalışma — §17B |

**Kaldırılan / birleştirilen (Gate 0 KABUL):**

| Eski (V2) | V3 |
|-----------|-----|
| `hr.employees.form` bağımsız sayfa | **Kaldırıldı** → `hr.employees` popup |
| `hr.attendance.locks` ayrı menü | **Kaldırıldı** → `hr.payroll` kilitleme paneli |
| `hr.structure` tek sayfa | `hr.departments` + `hr.positions` |

### 2A.3 Hub kartları (`erp_page_cards`)

| card_key | Hedef | required_permissions |
|----------|-------|----------------------|
| `hr.card.employees` | `hr.employees` | `hr.employees.view` |
| `hr.card.attendance_daily` | `hr.attendance.daily` | `hr.attendance.daily.view` |
| `hr.card.attendance_monthly` | `hr.attendance.monthly` | `hr.attendance.monthly.view` |
| `hr.card.payroll` | `hr.payroll` | `hr.payroll.view` |
| `hr.card.compensation` | `hr.compensation` | `hr.compensation.view` |
| `hr.card.settings` | `hr.settings` | `hr.settings.view` |

### 2A.4 Sayfa aksiyonları (`erp_page_actions`) — özet

| Sayfa | action_key (örnek) | İzin |
|-------|-------------------|------|
| `hr.employees` | `create_btn` | `hr.employees.create` |
| `hr.employees` | `edit_btn` | `hr.employees.edit` |
| `hr.employees` | `deactivate_btn` | `hr.employees.deactivate` |
| `hr.employees` | `terminate_btn` | `hr.employees.termination` |
| `hr.employees` | `photo_upload_btn` | `hr.employees.photo_upload` |
| `hr.attendance.daily` | `create_line` | `hr.attendance.daily.create` |
| `hr.payroll` | `calculate_btn` | `hr.payroll.calculate` |
| `hr.payroll` | `lock_month_btn` | `hr.payroll.lock` |
| `hr.payroll` | `unlock_month_btn` | `hr.payroll.unlock` |
| `hr.payroll` | `send_finance_btn` | `hr.payroll.send_to_finance` |
| `hr.compensation` | `apply_btn` | `hr.compensation.apply` |

### 2A.5 ABAC ve context permission (HR)

| Context | Kural | Etkilenen alan |
|---------|--------|----------------|
| **Departman** | Departman yöneticisi yalnızca kendi departman personeli | Liste, puantaj, bordro özet |
| **Self-service** | Personel kendi profilinde yalnızca izinli özlük/maaş alanları | `my-profile` |
| **Maaş redaction** | `hr.salary.*` yoksa resmi/gayri resmi ve teknik alanlar API’de omit | Tüm HR list/detail |
| **Yüksek gizlilik** | Bordro ve maaş detayı ayrı permission ağacı | `hr.payroll.*`, `hr.salary.detail.view` |

---

## 3. V2’den korunacak iş kuralları

| Kural | Detay |
|-------|--------|
| Detaylı personel kartı | Tüm profil sekmeleri (kişisel, iş, maaş, kullanıcı) |
| `employee_no` | Otomatik `PRS-###` seri |
| `first_name` / `last_name` | Ayrı; `full_name` türetilir; `toUpperTr` normalize |
| `salary_amount` + `salary_currency` | Cache / güncel değer |
| Resmi / gayri resmi ayrımı | `official_*` + `unofficial_*` |
| Orijinal para birimi | `salary_currency` transaction PB korunur |
| Yerel / rapor PB | WageEngine + country profile |
| **WageEngine** | V2 `computeWageBreakdown` tek motor portu |
| Frontend maaş | **Yasak** — yalnızca API sonucu |
| Puantaj | **Dakika** bazlı; `raw_overtime_minutes`, `payable_overtime_minutes` |
| Saat hatası | Ondalık saat ×100 veya frontend toplama **yok** |
| Ay kilidi | Kilitli ayda yazma engeli |
| Payroll snapshot | Kilit anında donar; sonradan maaş değişimi snapshot’ı bozmaz |
| `overtime_eligible = false` | `payable_overtime_minutes = 0`; **raw** performans için saklanabilir |
| Maaş API | `module.hr` **yetersiz**; granular `hr.salary.*` |

---

## 4. V2’den taşınmayacaklar

| Öğe | V3 |
|-----|-----|
| Sayfa bazlı dağınık HR JS/CSS | Merkezi UI paketi |
| Frontend maaş matematiği | WageEngine only |
| Maaşın `module.hr` ile görünmesi | Redaction zorunlu |
| 100’lük saat / ondalık karışıklığı | Integer dakika |
| Çıkış tarihi olmayan model | `termination_date` + `employment_status` |
| Eksik permission redaction | Tüm list/detail endpoint’lerde |
| Hardcoded `UZS`/`USD` etiket | Yerel / rapor para birimi i18n |
| Bağımsız personel kartı sayfası | Popup CRUD |
| Ayrı ay kilitleri menüsü | Bordro içi |
| HR kasa düşümü | Finance onaylı ödeme |
| User oluştururken otomatik duplicate employee | Seçim veya bilinçli bağlama |
| `SYSTEM` currency alias | Kaldırıldı ([05](./05-country-currency-language.md)) |
| PATCH ile şema | SQL migration ([03](./03-migration-module-registry.md)) |

---

## 5. HR veri modeli taslağı (Gate 0 kontrat)

Tam SQL Gate 2 migration’da; burada **entity sözleşmesi**.

### 5.1 `departments`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| code | string? | UNIQUE |
| name | string | toUpperTr |
| is_active | bool | |
| audit | timestamps | |

### 5.2 `positions`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| department_id | FK | |
| code | string? | |
| name | string | |
| is_active | bool | |
| → `position_permissions` | platform | [01](./01-permission-role-position-blueprint.md) |

### 5.3 `employees`

Bkz. §6.

### 5.4 `employee_compensation_history`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| employee_id | FK | |
| effective_from | date | |
| effective_to | date? | |
| salary_amount, salary_currency | decimal + char(3) | |
| official_salary_amount, official_salary_currency | | |
| unofficial_salary_amount, unofficial_salary_currency | | |
| official_salary_fx_rate | decimal? | |
| reason | string | |
| created_by | FK user | |

**Kural:** Maaş değişikliği PATCH ile doğrudan `employees` üzerinden **yapılmaz** — `POST .../compensation-revisions` (V2 uyum).

### 5.5 `attendance_daily` (`employee_attendance` V2 adı)

H1 Gate 0 model: **C+B** — fiili çalışma datetime; vardiya `shift_id` ile bağlı.

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| employee_id | FK | |
| work_date | date | Başlangıç günü (`start_datetime` tarihinden türetilir) |
| shift_id | FK → `hr_shifts` | **Gate 2 MVP zorunlu** — planlı vardiya |
| start_datetime | datetime | **Birincil** — fiili giriş başlangıcı |
| end_datetime | datetime | **Birincil** — fiili çıkış (gece aşan dahil) |
| day_type | enum/ref | shift + takvim kurallarından |
| work_status_id | FK → `work_statuses` | H5: leave/absent/sick varsayılan saat yok |
| start_time, end_time | time? | **Legacy / V2 import** — ana model değil |
| break_minutes | int | AttendanceEngine veya shift `break_rules` |
| normal_minutes | int | AttendanceEngine çıktısı |
| raw_overtime_minutes | int | Ham / performans |
| payable_overtime_minutes | int | `overtime_eligible` ile |
| overtime_minutes | int? | Görüntüleme alias → `payable_*` (deprecated write) |
| override_reason | string? | H5: izinli istisna |
| override_approved_by | FK user? | H5 |
| project_id | FK? | |
| notes | string? | |
| entered_by, updated_by | FK | |
| audit | timestamps | |
| UNIQUE | (employee_id, work_date) | |

**Doğrulama:** `end_datetime > start_datetime`; timezone = fabrika profili ([05](./05-country-currency-language.md)).

### 5.6 `attendance_monthly_locks`

| Alan | Tip | Not |
|------|-----|-----|
| month_key | char(7) `YYYY-MM` | UNIQUE |
| is_locked | bool | |
| locked_at, locked_by | | |
| unlocked_at, unlocked_by | | |
| payroll_usd_uzs_rate | decimal? | Kilit anı FX |
| note | string? | |

### 5.7 `payroll_snapshots` (`employee_month_payroll_snapshot` V2)

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| employee_id | FK | |
| month_key | char(7) | |
| wage_breakdown_json | JSON | WageEngine çıktısı donmuş |
| attendance_summary_json | JSON? | Toplam dakika/gün |
| fx_snapshot | JSON? | Kur seti |
| locked_at | datetime | |
| source_lock_id | FK | attendance_monthly_locks |

### 5.8 `hr_settings` (key-value veya satır bazlı)

| Örnek anahtarlar | Açıklama |
|------------------|----------|
| standard_start_time / end_time | Puantaj kuralları |
| break_* / lunch_* | Mola pencereleri |
| working_days | mon..sun liste |
| time_deduction_hours | Genel kesinti |
| payroll_usd_uzs_rate | Varsayılan kur |

### 5.9 `work_statuses`

| Alan | Not |
|------|-----|
| code | worked, absent, leave, sick_leave, half_day, overtime |
| multiplier | Ücret çarpanı (opsiyonel Gate 2) |
| is_paid | Ücretli mi |

### 5.10 `day_types`

| Alan | Not |
|------|-----|
| code | weekday, sunday, public_holiday |
| overtime_rule_ref | Hangi hesap fonksiyonu |

### 5.11 `hr_shifts` / `work_shifts` (H1-C — Gate 2 MVP)

Planlanan çalışma bu tabloda tutulur. `crosses_midnight = true` vardiyalar desteklenir.

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| shift_code | string | UNIQUE |
| shift_name | string | |
| planned_start_time | time | Plan başlangıç |
| planned_end_time | time | Plan bitiş |
| crosses_midnight | bool | Gece aşan vardiya — **desteklenir** |
| break_rules | JSON? | Mola pencereleri |
| overtime_rules | JSON? | FM kuralları |
| day_type_rules | JSON? | Pazar/tatil / shift uyumu |
| is_active | bool | |
| audit | timestamps | |

### 5.11a `employee_shift_assignments` (Gate 2 MVP)

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| employee_id | FK | |
| shift_id | FK → `hr_shifts` | |
| effective_from | date | |
| effective_to | date? | |
| is_primary | bool? | Varsayılan vardiya |
| audit | timestamps | |

Günlük puantaj: fiili `start_datetime`/`end_datetime` + `shift_id` → **AttendanceEngine** (vardiya kuralları + `day_type` + `work_status`).

### 5.12 Finance hazırlık (Gate 2 şema stub)

| Entity | Amaç |
|--------|------|
| `employee_advances` | Avans talebi — lifecycle Gate 5 |
| `parties` link | `party.employee_id` — [09](./09-finance-data-contract.md) |

---

## 6. Personeller — ana merkez ve popup profil

**Gate 0 KABUL:** Personeller sayfası HR modülünün **ana merkezidir**. Bağımsız “Personel Kartı” sayfası kaldırılır; oluşturma ve güncelleme **merkezi modal/popup** ile yapılır ([01-central-ui-design-system.md](./01-central-ui-design-system.md)). Sayfa bazlı özel CSS **yasaktır**.

### 6.1 Personeller listesi

| Kolon (gösterilebilir) | Not |
|------------------------|-----|
| personel fotoğrafı | İsteğe bağlı |
| adı soyadı | |
| departman | |
| pozisyon | |
| sade maaş özeti | `hr.salary.view` veya `hr.salary.view_total` yoksa gizlenir |
| durum | aktif / pasif |
| işe giriş tarihi | zorunlu alan |
| işten çıkış tarihi | varsa gösterilir |

**Listede gösterilmez (hesap motoru içi):** `rgu`, `grgu`, `gu`, `rsu`, `grsu`, `su` ve benzeri teknik günlük/saatlik kırılımlar — yalnızca yetkili detay/bordro ekranında.

| UI | Kural |
|----|--------|
| Yeni personel | Personeller sayfasında buton → **popup** |
| Güncelle | Satır aksiyonu → aynı popup (mevcut veri) |
| V2 liste mantığı | Korunabilir; V3 DataTable + registry |

### 6.2 Popup form — alan sırası (Gate 0 KABUL)

| Sıra | Bölüm |
|------|--------|
| 1 | **Kimlik Bilgileri** — ad, soyad, kimlik, doğum, cinsiyet, medeni hal, fotoğraf |
| 2 | **Departman / Pozisyon** — departman, pozisyon, işe giriş |
| 3 | **Adres** — ülke, bölge, şehir, adres, posta kodu |
| 4 | **Telegram** — bildirim alanı; **varsayılan pasif** |
| 5 | **Maaş / ücret** — ayrı kart; `hr.salary.*` permission ile |

### 6.3 Zorunlu alanlar (güncellenmiş)

| Alan | Zorunlu | Not |
|------|---------|-----|
| first_name, last_name | evet | `toUpperTr` |
| hire_date | evet | |
| department_id, position_id | gözden geçirildi | İş kuralına göre zorunlu |
| email | **hayır** | Gate 0 KABUL — zorunlu değil |
| termination_date | pasife alırken **evet** | §6.4 |
| telegram_notify | hayır | **default: false (pasif)** |

### 6.4 Aktif / pasif ve işten çıkış (Gate 0 KABUL)

| Kural | Detay |
|-------|--------|
| Pasife alma | Onay popup; **işten çıkış tarihi zorunlu** |
| Tarih yok | Pasife alınamaz (400) |
| `termination_date` dolu | Personel **pasif** kabul edilir |
| Tarih yok + aktif bayrak | **Aktif** |
| Günlük puantaj | Çıkış tarihinden **sonra** listede görünmez |
| Aylık puantaj / bordro | Çıkış tarihine **kadar** hakediş dahil |
| `user_id` bağlı system user | Çıkış sonrası erişim [02](./02-admin-control-system.md) / admin kararıyla pasif |

**flowId:** `hr.employee.terminate` — tarih + sebep + audit `HR_EMPLOYEE_TERMINATE`.

### 6.5 Maaş görünümü sadeleştirme

| Katman | Görünürlük |
|--------|------------|
| Liste | Sade özet veya hiç (permission) |
| Popup maaş kartı | Günlük kırılımlar yalnızca `hr.salary.detail.view` |
| Resmi / gayri resmi ayrım | Yalnızca yetkili kullanıcı |
| Maaş geçmişi | Tarih + açıklama listesi; `hr.salary.history.view` |
| Değişiklik | `employee_compensation_history` + `HR_SALARY_CHANGE` audit |

### 6.6 Veri modeli alanları (kontrat)

| Alan | Zorunlu | Not |
|------|---------|-----|
| employee_no | auto | `PRS-001` … |
| first_name, last_name | evet | |
| full_name | türetilmiş | |
| nationality | | TR, UZ, RU, EN, OTHER — hardcoded ülke raporu yok |
| photo_path | | `hr.employees.photo_upload` |
| phone, phone_secondary | | |
| email | | Opsiyonel |
| country_code, region, city, address, post_code | | [05](./05-country-currency-language.md) |
| department_id, position_id | | FK |
| user_id | | UNIQUE nullable |
| hire_date | evet | |
| termination_date | çıkışta zorunlu | |
| termination_reason | | |
| employment_status | | active / passive / terminated |
| is_active | | liste filtresi |
| overtime_eligible | | |
| telegram_notify | | default **false** |
| salary_* cache | | Revision ile güncellenir |
| identity_no, passport_no, birth_date, gender, marital_status, note | | |

### 6.7 Metin normalizasyonu

Tüm metin girişleri (ad, soyad, adres, not) `toUpperTr` — proje kuralı.

---

## 7. User bağlantısı

[01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) ile uyumlu.

| Kural | Açıklama |
|-------|----------|
| Kardinalite | `employees.user_id` → `users.id` (0..1 employee per user) |
| super_admin / sistem admin | HR personel kartına **otomatik** employee oluşturulmaz |
| Duplicate yok | Aynı user için ikinci employee **reddedilir** |
| User oluşturma | Admin: mevcut employee seç veya sonra bağla |
| Pozisyon izni | `employees.user_id` dolu → `position_permissions` geçerli |
| Employee silme / user koparma | `user_id` NULL; audit |

**HT-03:** User mevcut employee’ye bağlanır; ikinci kayıt oluşmaz.

---

## 8. Department / position

| Kural | Detay |
|-------|--------|
| Yönetim | HR → Yapı / departman & pozisyon ekranları |
| Pozisyon ↔ permission | `position_permissions` admin’den ([02](./02-admin-control-system.md)) |
| Aynı rol, farklı yetki | Farklı `position_id` |
| Pozisyon değişimi | Eski pozisyon izinleri düşer; yeni geçerli — anında ([01](./01-permission-role-position-blueprint.md)) |
| Departman pasif | Personel ataması korunur; yeni atama engellenebilir |

---

## 9. Salary structure

[05-country-currency-language.md](./05-country-currency-language.md) ile uyumlu. **UZS/USD hardcode etiket yok.**

### 9.1 Para birimi terminolojisi (Gate 0 KABUL)

| Eski (V2 UI) | V3 |
|--------------|-----|
| UZS | **Yerel para birimi** — `local_currency` (admin/country profile) |
| USD | **Rapor para birimi / sistem döviz birimi** — `base_reporting_currency` veya seçili reporting currency |
| rgu uzs | Resmi günlük ücret, yerel para birimi — **ekranda teknik isim yok** |
| grgu uzs | Gayri resmi günlük ücret, yerel para birimi |
| gu usd | Gayri resmi günlük ücret, rapor para birimi |
| rsu / grsu / su | Hesap motoru içi; **kullanıcı listesinde gösterilmez** |

| Katman | Kaynak |
|--------|--------|
| `transaction_currency` | Orijinal maaş para birimi (korunur) |
| `local_currency` | Country profile |
| `amount_local` | WageEngine / MoneyService |
| `amount_base` | Reporting snapshot |
| Frontend | **Maaş/kur hesabı yapmaz** |

### 9.2 Maaş kombinasyonları (Gate 0 KABUL)

| # | Kombinasyon | Günlük/saatlik hesap |
|---|-------------|----------------------|
| 1 | Resmi yerel maaş; gayri resmi yok | Yalnızca resmi kırılım |
| 2 | Resmi yerel + gayri resmi yerel | Her iki kırılım |
| 3 | Resmi yerel + gayri resmi rapor para birimi | Rapor PB yalnızca gayri resmi adımından |
| 4 | Resmi yok + gayri resmi rapor para birimi | Yalnızca gayri resmi (rapor PB) |

| Kural | Detay |
|-------|--------|
| Gayri resmi yok | Gayri resmi günlük/saatlik **hesaplanmaz** |
| Gayri resmi rapor PB | Sadece gayri resmi maaş üzerinden günlük/saatlik adımı |
| Toplam maaş raporu | Rapor para biriminde gösterilebilir; **orijinal PB korunur** |
| Rapor PB | Admin/country settings; **USD hardcode değil** |

### 9.3 Saklama alanları

| Alan | Saklama |
|------|---------|
| salary_amount | Toplam brüt |
| salary_currency | **Orijinal** transaction currency |
| official_salary_amount / _currency | Resmi kısım |
| unofficial_salary_amount / _currency | Gayri resmi kısım |
| official_salary_fx_rate | Resmi rapor PB ise kur snapshot referansı |
| `amount_local`, `amount_base` | Backend üretir |

| Kural | Detay |
|-------|--------|
| Orijinal PB | Asla otomatik ezilmez |
| Güncelleme | `employee_compensation_history` + revision API |
| Bordro snapshot | Kilit anı Money snapshot — §15B |

---

## 10. Wage engine

### 10.1 Tek motor ilkesi

```text
WageEngine.compute(input, context) → WageBreakdown
```

| Girdi | Örnek |
|-------|--------|
| salary_amount, salary_currency | |
| official_*, unofficial_* | |
| official_salary_fx_rate | |
| hr_settings.payroll_fx_rate (veya Money snapshot) | Kilit anı; dashboard kuru bilgilendirme |
| month_key | snapshot için |

| Çıktı | Örnek |
|-------|--------|
| total / official / unofficial | amount + currency |
| normalized UZS/USD kolonları | raporlama |
| breakdown meta | audit |

**V2 port:** `computeWageBreakdown` — test vektörleri: `docs/v3-spec/fixtures/hr-wage-vectors.json` (min. 20 senaryo).

### 10.2 Kurallar

- Tek formül; frontend/backend **çift kopya yok**.
- Resmi/gayri resmi/USD/UZS ayrımı motor içinde.
- Payroll snapshot = motor çıktısının JSON dondurması + kilit FX.
- Liste endpoint’leri motoru veya redaction helper’ı kullanır.

**Puantaj motoru (ayrı):** **AttendanceEngine** — dakika hesabı; WageEngine’den ayrı domain servis (§13). Frontend puantaj matematiği **yapmaz**.

Detaylı çakışma analizi: §11.

---

## 11. Ücret hesaplama formülleri ve çakışma analizi

### 11.1 WageEngine tek motor

| İlke | Açıklama |
|------|----------|
| Tek motor | Tüm maaş/bordro matematiği `WageEngine` içinde |
| Frontend | **Hesap yapmaz** — yalnızca API sonucunu gösterir |
| Backend dışı | Maaş matematiği **yok** (rapor export dahil) |
| V2 referans | `computeWageBreakdown` — iş kuralları korunur; kod birebir kopyalanmaz, temizlenir |

### 11.2 Çakışabilecek alanlar

| Alan / kavram | Katman | Çakıştığı / etkilediği |
|---------------|--------|-------------------------|
| `normal_minutes` | Puantaj | `day_type`, `work_status`, vardiya kuralları, mola |
| `raw_overtime_minutes` | Puantaj | Performans / rapor; ödeme ile karışmamalı |
| `payable_overtime_minutes` | Puantaj | `overtime_eligible`, bordro, WageEngine girdi |
| `overtime_eligible` | Employee | `payable_*` sıfırlama; `raw_*` saklanabilir |
| `day_type` | Puantaj | Pazar/tatil hesap fonksiyonu seçimi |
| `work_status` | Puantaj | worked / leave / absent — saat girişi politikası |
| Sunday / holiday rules | hr_settings + day_type | Normal FM ile pazar FM çakışması |
| `salary_amount` | Maaş cache | `compensation_history`, WageEngine |
| `salary_currency` | Maaş | USD/UZS korunumu; ezilme yok |
| `official_salary_amount` | Maaş | Resmi kısım; farklı currency olabilir |
| `official_salary_currency` | Maaş | `salary_currency` ile farklı → kur kuralı |
| `unofficial_salary_amount` | Maaş | Toplam − resmi |
| `unofficial_salary_currency` | Maaş | Genelde toplam currency |
| `official_salary_fx_rate` | Maaş | USD resmi + UZS toplam karma senaryolar |
| `payroll_fx_snapshot` | Kilit anı Money | local/base/reporting; dashboard kuru geçmişi değiştirmez |
| `compensation_history` | Revision | `employees` cache ile senkron |
| `payroll_snapshot` | Kilit | Geçmiş ay immutability |

### 11.3 Çakışma riskleri

| Risk | Netleştirme gereksinimi |
|------|-------------------------|
| `raw_overtime` ↔ `payable_overtime` karışması | API/UI etiketleri; bordro yalnızca `payable_*` kullanır |
| `overtime_eligible = false` | Performans saati (`raw_*`) ≠ ödeme saati (`payable_* = 0`) |
| Pazar/tatil ↔ normal FM | `day_type` öncelik sırası ve tek hesap yolu (H1 + motor) |
| `work_status = leave/absent/sick` + saat girişi | Varsayılan red; override + audit (H5 önerisi) |
| USD toplam + UZS resmi | `official_salary_fx_rate` + WageEngine kur kuralı (HT-23) |
| Snapshot sonrası maaş revizyonu | Geçmiş `payroll_snapshots` **değişmez** (HT-25) |
| History ↔ employees cache | Revizyon sonrası cache güncelle; çelişide uyarı (HT-24) |
| Frontend toplam saat/maaş | Yasak; lint + HT-26 |
| Kilitli ay puantaj değişikliği | Unlock + yeniden kilitle veya düzeltme snapshot workflow |

### 11.4 Formül inceleme ihtiyacı (Gate 0 → FROZEN öncesi)

**FactoryOS V3 HR FROZEN olmadan önce** WageEngine formülleri ayrı test vektörleriyle doğrulanacaktır:

- En az **20 maaş senaryosu** → `docs/v3-spec/fixtures/hr-wage-vectors.json`
- En az **20 puantaj senaryosu** → `docs/v3-spec/fixtures/hr-attendance-vectors.json` (**C+B** modeline göre; vardiya + datetime + gece aşan)

Vektörler onaylanmadan HR belgesi **FROZEN yapılamaz** (§23 kabul kriterleri).

**Fixture durumu (19.05.2026):** [hr-wage-vectors.json](./fixtures/hr-wage-vectors.json) (WT-01…WT-20) ve [hr-attendance-vectors.json](./fixtures/hr-attendance-vectors.json) (AT-01…AT-20) oluşturuldu — **HR-TST: İNCELEMEDE** ([00-gate0-open-decisions](./00-gate0-open-decisions.md)).

---

## 12. Vardiya sistemi ve gece aşan çalışma analizi

### 12.1 Sorun tanımı

Fabrika ortamında personel **08:00** başlayıp **ertesi gün 04:00** çıkabilir. Bu kayıt yalnızca “`end_time < start_time` ise +1440 dakika” ile kapatılmamalıdır. **Vardiya planlama**, gün bölme, pazar/tatil geçişi ve bordro analizi Gate 0’da değerlendirilmelidir.

**Gate 0 KABUL:** Vardiya sistemi HR için **zorunlu**. Karar **C + B** (§12.6); uygulama Gate 2.

### 12.2 Senaryo örneği

| Alan | Değer |
|------|--------|
| Başlangıç | Pazartesi 08:00 |
| Bitiş | Salı 04:00 (ertesi gün) |
| Tür | Planlı vardiya veya özel uzun çalışma / özel mesai |
| Beklenti | Toplam dakika, gün paylaşımı, pazar/tatil geçişi doğru |

### 12.3 Seçenek karşılaştırması

#### Seçenek A — V2 uyumlu basit model

| Öğe | Açıklama |
|-----|----------|
| Kayıt | `work_date` = başlangıç günü; `start_time` / `end_time` |
| Gece aşan | Hesapta `end < start` → `end += 1440` dakika (`safeEndMinutes`) |
| Avantaj | V2’ye uyumlu; hızlı uygulanabilir |
| Risk | Vardiya planlama, gün bölme, pazar/tatil geçişi, payroll analizinde **yetersiz** kalabilir |
| Gate 2 | **V2 geçiş / fallback only** — ana model değil (`safeEndMinutes` import) |

#### Seçenek B — `start_datetime` / `end_datetime`

| Öğe | Açıklama |
|-----|----------|
| Kayıt | Tam datetime aralığı (`start_datetime`, `end_datetime`) |
| Gece aşan | 08:00 → ertesi gün 04:00 tek kayıtta doğru temsil |
| Avantaj | Gece aşan çalışma daha doğru modellenir |
| Risk | V2 port karmaşıklığı; timezone politikası gerekir |
| Gate 2 | **MVP — fiili çalışma birincil temsil** (C+B ile) |

#### Seçenek C — Vardiya sistemi

| Öğe | Açıklama |
|-----|----------|
| Entity | `hr_shifts` / `work_shifts` (§5.11) |
| Alanlar | `shift_code`, `shift_name`, `planned_start_time`, `planned_end_time`, `crosses_midnight`, `break_rules`, `overtime_rules`, `day_type_rules`, `is_active` |
| Atama | Personel vardiyaya atanır (`employee_shift_assignments`) |
| Puantaj | Günlük kayıt vardiya + fiili giriş ile hesaplanır |
| Avantaj | Planlı üretim, gece vardiyası, kurallar merkezi |
| Risk | Gate 2 kapsamı ve UI karmaşıklığı |
| Gate 2 | **MVP — planlanan çalışma** (C+B ile) |

#### Seçenek D — `attendance_segments`

| Öğe | Açıklama |
|-----|----------|
| Model | Tek günlük kayıt altında çoklu segment (normal, FM, gece mesaisi) |
| Avantaj | En esnek; karmaşık günler |
| Risk | Gate 2 MVP için **ağır**; CRUD ve toplama karmaşık |
| Gate 2 | **Gate 2.1 veya sonraki faz** — MVP dışı |

### 12.4 Karşılaştırma özeti

| Kriter | A | B | C | D |
|--------|---|---|---|---|
| V2 uyumu | ★★★ | ★★ | ★ | ★ |
| Gece aşan doğruluğu | ★ | ★★★ | ★★★ | ★★★ |
| Vardiya planlama | ✗ | △ | ★★★ | ★★ |
| Gate 2 MVP hızı | ★★★ | ★★ | ★ | ★ |
| Bordro / analiz | ★ | ★★ | ★★★ | ★★★ |

### 12.5 Gate 0 / Gate 2 ayrımı

| Aşama | Beklenti |
|-------|----------|
| **Gate 0** | H1 **C+B** **KABUL**; puantaj vektörleri C+B’ye göre |
| **Gate 2 MVP** | §12.7 kapsamı uygulanır |
| **Seçenek A** | Yalnızca V2 import / geçiş fallback — **ana model değil** |
| **Seçenek D** | Gate 2.1+ |
| **Yasak** | +1440 `safeEndMinutes` ile H1’i kapatmak; A’yı birincil model saymak |

**Üst sınır:** `hr_settings.max_daily_minutes` — uyarı.

### 12.6 Gate 0 karar: C + B (KABUL)

| İlke | Karar |
|------|--------|
| Planlanan çalışma | `hr_shifts` / `work_shifts` |
| Personel atama | `employee_shift_assignments` |
| Fiili çalışma | `attendance_daily.start_datetime`, `end_datetime` |
| Vardiya bağlantısı | `attendance_daily.shift_id` |
| Gece aşan | `crosses_midnight` vardiyalar + datetime aralığı |
| Dakika hesabı | Backend **AttendanceEngine** (tek motor) |
| Seçenek A | V2 `safeEndMinutes` — **fallback / import only** |
| Seçenek D | **Gate 2.1+** |

```text
shift (plan) + start_datetime/end_datetime (fiili)
  → AttendanceEngine.compute(...)
  → normal_minutes, raw_overtime_minutes, payable_overtime_minutes
```

**Durum:** Gate 0 **KABUL**; uygulama Gate 2 (§17B, §12.7).

### 12.7 Gate 2 MVP kapsamı (H1 C+B)

| Bileşen | Gate 2 MVP |
|---------|------------|
| `hr_shifts` | ☑ |
| `employee_shift_assignments` | ☑ |
| `attendance_daily.start_datetime` | ☑ |
| `attendance_daily.end_datetime` | ☑ |
| `attendance_daily.shift_id` | ☑ |
| `normal_minutes` | ☑ (AttendanceEngine) |
| `raw_overtime_minutes` | ☑ |
| `payable_overtime_minutes` | ☑ |
| Shift / `day_type` / overtime rule uyumu | ☑ |
| `attendance_segments` (D) | ✗ Gate 2.1+ |
| `start_time`/`end_time` birincil giriş | ✗ (legacy import) |

---

## 13. Attendance daily

H1 Gate 0 model: **C+B** + **AttendanceEngine**.

### 13.0 AttendanceEngine (tek puantaj motoru)

```text
AttendanceEngine.compute({
  employee_id, shift_id,
  start_datetime, end_datetime,
  work_date, day_type, work_status_id,
  overtime_eligible, hr_settings, shift_rules
}) → { normal_minutes, raw_overtime_minutes, payable_overtime_minutes, break_minutes, meta }
```

| İlke | Açıklama |
|------|----------|
| Tek motor | Tüm dakika hesabı backend’de |
| Frontend | Saat/dakika **hesaplamaz**; API sonucunu gösterir |
| Vardiya | `shift.break_rules`, `overtime_rules`, `day_type_rules` |
| Gece aşan | `end_datetime` ertesi gün — datetime farkı; A fallback import’ta `safeEndMinutes` |
| WageEngine | Puantaj **çıktısı** bordro/snapshot girdisi; motorlar ayrı |

### 13.1 Hesaplama akışı (C+B)

```text
employee + shift_id (assignment veya günlük seçim)
  + start_datetime, end_datetime
  + work_status, day_type (shift/takvim)
  → H5: leave/absent/sick → varsayılan RED (override ile istisna)
  → AttendanceEngine
  → normal_minutes, raw_overtime_minutes
  → overtime_eligible ? payable = raw : payable = 0
  → persist attendance_daily
```

### 13.2 V2 uyumlu alanlar

V2’de `raw_overtime_minutes`, `payable_overtime_minutes` patch ile mevcut — V3 **birincil**.

Saat alanları (`total_hours`, `overtime_hours`) yalnızca **görüntüleme türevi** (dakika/60, yuvarlıklı); kaynak dakika.

### 13.3 İş kuralları

| Kural | Detay |
|-------|--------|
| Ay kilitli | INSERT/UPDATE **403** (kilitleme bordro ekranından — §15A) |
| Pazar / tatil | `day_type` + AttendanceEngine |
| **Proje / çalışma alanı** | **Gate 0 KABUL:** Boş geçilemez — `project_id` **veya** kontrollü proje dışı tip |
| Proje dışı tipler | Genel, Fabrika, İç İşler, Bakım, İdari (`non_project_work_type` enum) |
| Yanlış proje | Kullanıcı sahte proje seçmeye **zorlanmaz** |
| İşten çıkmış personel | `termination_date` sonrası günlük listede **yok** |
| Bulk günlük giriş | Toplu API (V2 uyumlu) |
| Vardiya | `shift_id` — Gate 2 MVP zorunlu (H1 KABUL) |
| H5 istisna | `hr.attendance.override` + audit (Gate 0 KABUL) |

### 13.4 H5 — leave / absent / sick_leave + saat girişi (Gate 0 KABUL)

| work_status | Varsayılan |
|-------------|------------|
| `leave`, `absent`, `sick_leave` | Saat girişi **reddedilir** (400) |
| İstisna | `hr.attendance.override` + `override_reason` + `approved_by` + audit |
| `worked`, `half_day`, … | Normal datetime girişi |

**HT-22:** leave + saat → red; override ile kayıt + audit.

---

## 14. Monthly attendance

| Özellik | Açıklama |
|---------|----------|
| Liste | Ay + departman/personel filtresi |
| Toplamlar | `SUM(normal_minutes)`, `SUM(payable_overtime_minutes)`, çalışılan gün |
| Durumlar | absent, leave, sick — sayım |
| Kilit kontrolü | `attendance_monthly_locks.is_locked` — bordro ile **aynı ay** |
| İşten çıkış | Çıkış tarihine kadar hakediş **dahil** |
| Düzenleme | Kilit öncesi serbest; kilitli ayda günlük puantaj **değiştirilemez** |

**API:** `GET /api/hr/attendance/monthly?month=YYYY-MM`

---

## 15. Bordro, ay kilidi ve finance bağlantısı

### 15A. Ay kilidi — bordro ekranında (Gate 0 KABUL)

| Karar | Detay |
|-------|--------|
| Ayrı “Ay Kilitleri” menüsü | **Kaldırıldı** |
| Yönetim | **Bordro** (`hr.payroll`) ekranından kilitle / kilit aç |
| Kilitli ay | Günlük puantaj değiştirilemez |
| Kilitli bordro | Maaş sonucu değiştirilemez |
| Kilit açma | `hr.payroll.unlock` veya `hr.attendance.monthly.unlock` — yüksek yetki + **audit zorunlu** |
| Yeniden hesaplama | Unlock → düzeltme → yeniden `hr.payroll.calculate` → tekrar kilitle |

| Adım | Açıklama |
|------|----------|
| 1 | `hr.payroll.lock` — ay seç, onay modal |
| 2 | `attendance_monthly_locks` + `payroll_period_locks` (eşdeğer) |
| 3 | Money **FX snapshot** dondur (§15B) |
| 4 | WageEngine + puantaj → `payroll_snapshots` |
| 5 | Audit `HR_PAYROLL_LOCK` / `HR_ATTENDANCE_MONTH_LOCK` |

### 15B. Bordro kuru / güncel kur ayrımı (Gate 0 KABUL)

| Kavram | Davranış |
|--------|----------|
| Dashboard / admin güncel kur | **Bilgilendirme** — geçmiş bordroyu değiştirmez |
| Bordro dönemi kuru | Kilit anında **snapshot** (`local` / `base` / `reporting`) |
| Geçmiş bordro | Güncel kur değişince **bozulmaz** |
| Manuel işlem kurları | Satınalma/depo/bordro işlem kurları otomatik **ezilmez** |
| Model | [05](./05-country-currency-language.md) Money snapshot |

### 15C. Bordro → Muhasebe / Finance (Gate 0 KABUL)

| İlke | Detay |
|------|--------|
| HR kasa düşmez | HR **doğrudan** kasadan para düşmez |
| HR çıktısı | Kilitlenen ay → **ödeme yükümlülüğü / ödeme emri** (`hr_payroll_obligations`) |
| Finance onayı | `pending` → `approved` / `paid` / `rejected` — [09](./09-finance-data-contract.md) |
| Kasa hareketi | Yalnızca finance **“ödendi”** onayı sonrası |
| Resmi ödeme | Resmi kasa / cash account |
| Gayri resmi ödeme | Gayri resmi kasa / cash account |
| Referans | Bordro satırı → finance payment `source_type=HR_PAYROLL`, `source_id` |

**Permission:** `hr.payroll.send_to_finance`, `hr.payroll.payment_status.view`; finance tarafı `finance.payments.*`.

**Audit:** `HR_PAYROLL_SEND_TO_FINANCE`, `HR_PAYROLL_PAYMENT_STATUS_CHANGE`.

### 15D. Avans / borç kesintisi (Gate 0 KABUL)

| Kural | Detay |
|-------|--------|
| Kaynak | Finance `employee_advances` / borç kaydı |
| Bordro | Yalnızca **onaylı** kesintiler; `advance_deduction_id` referans |
| HR | Kesinti tutarını okur; finance’de oluşturmaz |
| Audit | Kesinti satırında referans + kullanıcı |

### 15E. Bordro ekranı sadeleştirme

| Karar | Detay |
|-------|--------|
| Formüller | V2 formülleri **korunur** (WageEngine) |
| Gereksiz satırlar | Gizlenir veya admin/permission ile yönetilir |
| Teknik alanlar | Yalnızca `hr.salary.detail.view` / bordro yetkisi |
| Hesap | **Backend** `computeWageBreakdown` / WageEngine — frontend matematik **yasak** |

### 15F. Snapshot immutability

| Kural | Detay |
|-------|--------|
| Sonradan maaş değişimi | Snapshot **değişmez** |
| Puantaj düzeltmesi | Unlock workflow + yeniden kilitle |
| Kilit açma | Audit `HR_PAYROLL_UNLOCK` zorunlu |

---

## 16. Salary visibility / redaction

[01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) §14.

| Kural | Detay |
|-------|--------|
| `module.hr` | Menü/kaba erişim; **maaş için yeterli değil** |
| Granular | `hr.salary.view_*`, `hr.salary.edit` |
| API | Yetkisiz alan **omit** veya `null` + `_redacted: true` meta |
| Liste | Maaş kolonları listeden çıkar |
| Detay | Breakdown sadece yetkiliye |

### 16.1 Permission anahtarları

| perm_key | Veri |
|----------|------|
| `hr.salary.view` | Sade özet (liste) |
| `hr.salary.detail.view` | Resmi/gayri resmi + günlük kırılım (teknik alanlar) |
| `hr.salary.edit` | Revision API |
| `hr.salary.history.view` | Tarihçe listesi |
| `hr.salary.view_total` | Toplam brüt (legacy uyum) |
| `hr.salary.view_official_local` | Resmi yerel kırılım |
| `hr.salary.view_unofficial_local` | Gayri resmi yerel |
| `hr.salary.view_unofficial_reporting` | Gayri resmi rapor PB |

**V2 granular (`view_rgu_uzs` vb.):** Seed’de alias veya migration map; UI’da **hardcode etiket yok**.

**V3 zorunlu:** Tüm `GET /employees` ve bordro endpoint’lerinde API redaction.

---

## 17. HR permissions

**Otorite:** Tam liste [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md); [04-permission-system.md](./04-permission-system.md) özet karttır.

### 17.1 Modül kapısı

| perm_key | Açıklama |
|----------|----------|
| `module.hr` | Modül erişimi (maaş için **yeterli değil**) |

### 17.2 Manifest permission kataloğu (seed)

| perm_key | Açıklama | Registry |
|----------|----------|----------|
| `hr.hub.view` | Hub | `hr.hub` |
| `hr.employees.view` | Personeller listesi | `hr.employees` |
| `hr.employees.create` | Yeni personel popup | action create_btn |
| `hr.employees.edit` | Güncelle popup | action edit_btn |
| `hr.employees.deactivate` | Pasifleştir | |
| `hr.employees.termination` | İşten çıkış (tarih zorunlu) | |
| `hr.employees.photo_upload` | Fotoğraf | |
| `hr.salary.view` | Sade maaş özeti | |
| `hr.salary.detail.view` | Detay kırılım | |
| `hr.salary.edit` | Maaş güncelleme | |
| `hr.salary.history.view` | Maaş geçmişi | |
| `hr.attendance.daily.view` | Günlük puantaj | `hr.attendance.daily` |
| `hr.attendance.daily.create` | Günlük giriş | |
| `hr.attendance.daily.edit` | Düzeltme | |
| `hr.attendance.monthly.view` | Aylık özet | `hr.attendance.monthly` |
| `hr.attendance.monthly.lock` | Ay kilidi (bordro ile hizalı) | `hr.payroll` |
| `hr.attendance.monthly.unlock` | Kilit açma | |
| `hr.attendance.override` | H5 istisna | |
| `hr.payroll.view` | Bordro görüntüleme | `hr.payroll` |
| `hr.payroll.calculate` | Hesaplama | |
| `hr.payroll.lock` | Ay kilitle | |
| `hr.payroll.unlock` | Kilit aç | |
| `hr.payroll.export` | Dışa aktar | |
| `hr.payroll.send_to_finance` | Finance’e ödeme yükümlülüğü | |
| `hr.payroll.payment_status.view` | Ödeme durumu | |
| `hr.compensation.view` | Ücret değerlendirme | `hr.compensation` |
| `hr.compensation.create` | Değerlendirme oluştur | |
| `hr.compensation.apply` | Zam uygula | |
| `hr.settings.view` / `.edit` | HR ayarları | `hr.settings` |
| `hr.departments.view` / `.edit` | Departman | `hr.departments` |
| `hr.positions.view` / `.edit` | Pozisyon | `hr.positions` |
| `hr.shifts.view` / `.edit` | Vardiya (H1) | `hr.settings` altı |

**İsimlendirme:** [03](./03-migration-module-registry.md) §5 — `{module}.{resource}.{action}`.

---

## 17A. Ücret Değerlendirme ekranı (Gate 0 KABUL)

| Karar | Detay |
|-------|--------|
| Resmi/gayri resmi detay | Bu ekranda **kaldırıldı** — personel popup / bordro yetkisinde |
| Ana gösterim | Toplam **eski maaş** → **yeni toplam maaş** (rapor PB opsiyonel) |
| Zam oranı | Gösterilir |
| Aktif personel sayısı | Gösterilir |
| Ülke / grup raporu | Hardcoded TR/UZ **yok** — `country_code` / nationality / country profile |
| Permission | `hr.compensation.view`; tutarlar `hr.salary.view` |

---

## 17B. HR Ayarları — çalışma ve vardiya (Gate 0 KABUL)

| Bileşen | Karar |
|---------|--------|
| Haftanın çalışma günleri | Yalnız checklist **değil** — `work_statuses` ile ilişkili |
| Çalışma takvimi | Tatil / özel gün |
| Vardiya sistemi | `hr_shifts` + atama |
| Bağlantı | Takvim ↔ durum ↔ vardiya |
| Pazartesi–Cuma sabit checklist | Tek başına **yeterli değil** |
| Uygulama | Gate 2 — `hr.settings` + AttendanceEngine |

---

## 17C. Audit log — zorunlu olaylar (Gate 0 KABUL)

| event_key | Tetikleyici |
|-----------|-------------|
| `HR_EMPLOYEE_CREATE` | Personel oluşturma |
| `HR_EMPLOYEE_UPDATE` | Profil güncelleme |
| `HR_EMPLOYEE_DEACTIVATE` | Pasifleştirme |
| `HR_EMPLOYEE_TERMINATE` | İşten çıkış |
| `HR_EMPLOYEE_PHOTO_UPLOAD` | Fotoğraf |
| `HR_SALARY_CHANGE` | Maaş revision |
| `HR_SALARY_HISTORY_VIEW` | Hassas tarihçe görüntüleme (opsiyonel) |
| `HR_ATTENDANCE_DAILY_CREATE` | Günlük puantaj |
| `HR_ATTENDANCE_DAILY_UPDATE` | Puantaj düzeltme |
| `HR_ATTENDANCE_MONTH_LOCK` | Ay kilidi |
| `HR_ATTENDANCE_MONTH_UNLOCK` | Kilit açma |
| `HR_PAYROLL_CALCULATE` | Bordro hesap |
| `HR_PAYROLL_LOCK` | Bordro kilidi |
| `HR_PAYROLL_UNLOCK` | Bordro kilit açma |
| `HR_PAYROLL_SEND_TO_FINANCE` | Finance aktarım |
| `HR_PAYROLL_PAYMENT_STATUS_CHANGE` | Ödeme durumu |
| `HR_COMPENSATION_APPLY` | Zam uygulama |
| `HR_SETTINGS_UPDATE` | Ayar değişikliği |

[02-admin-control-system.md](./02-admin-control-system.md) activity log ile hizalı.

---

## 18. HR modal / popup flows

Merkezi `Modal` / `ConfirmDialog` — `window.prompt` yok. Gate 0 envanter → [12-modal-flow-inventory.md](./12-modal-flow-inventory.md).

| flowId | Açıklama | V2 referans |
|--------|----------|-------------|
| hr.employee.create | Yeni personel popup | Personeller sayfası |
| hr.employee.edit | Güncelle popup | Satır aksiyonu |
| hr.employee.deactivate | Pasifleştir + çıkış tarihi | |
| hr.employee.compensationRevision | Maaş güncelleme | compensation modal |
| hr.employee.linkUser | Kullanıcı bağlama | admin user |
| hr.employee.terminate | Çıkış tarih/sebep | |
| hr.attendance.dayEntry | Günlük puantaj (datetime + shift) | hr-attendance |
| hr.attendance.overrideConfirm | H5: leave/absent/sick + saat istisnası | — |
| hr.attendance.dayDetail | Gün detay / düzeltme | |
| hr.payroll.monthLockConfirm | Ay kilitle (bordro) | hr-payroll |
| hr.payroll.monthUnlockConfirm | Kilit açma | |
| hr.payroll.sendToFinanceConfirm | Finance aktarım | |
| hr.payroll.dispute | İtiraz kaydı (varsa) | payroll_disputes |
| hr.structure.departmentForm | Departman | hr-structure |
| hr.structure.positionForm | Pozisyon | |
| hr.shift.assign | Vardiya atama (H1-C) | — |
| hr.shift.form | Vardiya tanımı | — |

---

## 19. UI yönü

[00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) + [01-central-ui-design-system.md](./01-central-ui-design-system.md):

| Ekran | Bileşenler |
|-------|-----------|
| HR hub | Registry kartları — §2A |
| **Personeller** | DataTable; create/edit **popup**; teknik maaş kolonları yok |
| Günlük puantaj | Proje veya proje dışı tip zorunlu; çıkış sonrası personel yok |
| Aylık puantaj | Özet; kilit rozeti (bordro ile senkron) |
| **Bordro** | Sadeleştirilmiş; kilitleme paneli; finance gönder |
| Ücret değerlendirme | Toplam eski/yeni; zam oranı |
| HR ayarları | Vardiya + çalışma takvimi + durumlar |
| Maaş / para birimi | Yerel / rapor PB etiketleri — hardcode UZS/USD **yok** |

**Yasak:** Hero, landing, sayfa-özel CSS, bağımsız personel kartı sayfası, ayrı ay kilitleri menüsü.

**Sayfa kayıtları:** Tam tablo **§2A.2**.

---

## 20. V2 referans noktaları

| Konu | V2 dosya |
|------|----------|
| Domain servis | `backend/services/hrService.js` — WageEngine, puantaj, redaction |
| API | `backend/controllers/hrController.js`, `backend/routes/hrRoutes.js` |
| Şema | `database/schema/011_hr_module.sql`, `012_employee_compensation_history.sql`, `021_hr_attendance_overtime.sql` |
| Snapshot | `database/patch-034-employee-month-payroll-snapshot.js` |
| Salary perm | `database/patch-024-hr-salary-column-permissions.js` |
| Granular HR view | `database/patch-036-granular-permissions.js` |
| Frontend | `frontend/public/hr*.html`, ilgili JS |
| Dakika / gece | V2: `safeEndMinutes` (fallback); V3: AttendanceEngine + datetime |
| Vardiya | V2’de yok — V3 `hr_shifts` yeni |
| Profile | `meService.js` (maaş özeti) |

---

## 21. Test / doğrulama senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| HT-01 | Personel oluştur | 201 + employee_no |
| HT-02 | employee_no otomatik | PRS-### sıra |
| HT-03 | User → mevcut employee | Tek kayıt |
| HT-04 | USD maaş | currency USD korunur |
| HT-05 | UZS maaş | UZS korunur |
| HT-06 | official/unofficial split | WageEngine + DB |
| HT-07 | Maaş perm yok | API redaction |
| HT-08 | Puantaj | Dakika integer |
| HT-09 | OT eligible false | payable=0, raw≥0 |
| HT-10 | Gece aşan 08:00→04:00 | C+B: datetime aralığı + AttendanceEngine doğru dakika |
| HT-11 | Aylık toplam | SUM doğru |
| HT-12 | Ay kilidi | snapshot oluşur |
| HT-13 | Kilitli ay edit | 403 |
| HT-14 | termination_date | Aktif listeden çıkar |
| HT-15 | Pozisyon değişimi | position perm değişir |
| HT-16 | HR sayfa perm yok | 403 |
| HT-17 | Maaş edit | activity_logs |
| HT-18 | Responsive | 1366/1024/768 scroll |
| HT-19 | Vardiya gece aşar (`crosses_midnight`) | AttendanceEngine toplam dakika doğru |
| HT-20 | Vardiya pazar/tatil geçişi | `day_type` kuralı doğru |
| HT-21 | OT eligible false | `raw_overtime` kayıtlı, `payable_overtime=0` |
| HT-22 | work_status=leave + saat | Varsayılan red; override + audit ile izin |
| HT-23 | USD + UZS resmi karma | WageEngine doğru breakdown |
| HT-24 | History ↔ cache çelişki | Uyarı veya otomatik düzeltme |
| HT-25 | Snapshot sonrası maaş revizyonu | Geçmiş snapshot değişmez |
| HT-26 | Frontend maaş hesabı | Kaynak taramada hesap yok |
| HT-27 | Liste teknik alanlar | rgu/grgu/gu/rsu görünmez |
| HT-28 | salary.detail.view | Yetkili detay görür |
| HT-29 | salary yok | Maaş redacted |
| HT-30 | Popup create/edit | Bağımsız form sayfası yok |
| HT-31 | email opsiyonel | Kayıt 201 |
| HT-32 | telegram default | Pasif |
| HT-33 | Pasif + çıkış tarihi | Tarih olmadan 400 |
| HT-34 | Çıkış sonrası günlük | Personel listede yok |
| HT-35 | Çıkış hakediş | Aylık/bordro çıkışa kadar |
| HT-36 | Proje zorunlu | Boş puantaj 400 |
| HT-37 | Ay kilitleri menü | Ayrı menü yok |
| HT-38 | Kilit bordrodan | lock API payroll |
| HT-39 | Kilitli puantaj | 403 edit |
| HT-40 | FX snapshot | Geçmiş bordro sabit |
| HT-41 | Dashboard kur | Geçmişi değiştirmez |
| HT-42 | send_to_finance | Obligation kaydı |
| HT-43 | Finance ödendi | Kasa hareketi |
| HT-44 | Finance öncesi kasa | Hareket yok |
| HT-45 | Avans kesinti | Finance ref + bordro satırı |
| HT-46 | Ücret değerlendirme | Eski/yeni toplam |
| HT-47 | Para birimi etiket | local/reporting i18n |
| HT-48 | Frontend kur hesabı | Yok |

---

## 22. Riskler

| Risk | Azaltma |
|------|---------|
| Maaş redaction eksik | Code review + HT-07; otomatik test |
| Frontend maaş hesabı | Lint + HT-26; tek WageEngine (§11) |
| Gece aşan / vardiya yanlış model | H1 Gate 0 kapanışı; HT-19/20 |
| A birincil model seçilirse | **Yasak** — C+B Gate 0 KABUL; A yalnızca fallback |
| Snapshot bozulması | Immutability + HT-25 |
| user/employee kopukluğu | Admin UX + UNIQUE |
| USD ezilmesi | [05](./05-country-currency-language.md) |
| WageEngine vektör eksikliği | 20+20 vektör FROZEN öncesi |
| Gate 2 scope | H1 uygulama fazlaması |
| HR doğrudan kasa | §15C; finance onayı zorunlu |
| BOQ benzeri proje karışımı | Proje dışı tip zorunlu |
| Ay kilitleri dağınık menü | Kaldırıldı — bordro tek kaynak |

---

## 23. Kabul kriterleri (Gate 0)

- [ ] HR kapsamı mini değil **tam** onaylandı (§2)
- [ ] **Personeller** ana merkez + popup CRUD onaylandı (§6)
- [ ] Bağımsız personel kartı sayfası **kaldırıldı** onaylandı
- [ ] İşten çıkış tarihi pasif için **zorunlu** (§6.4)
- [ ] E-posta zorunlu **değil**; Telegram **default pasif**
- [ ] Teknik maaş alanları listede **görünmez** (§6.1)
- [ ] Salary/currency **local/reporting** — UZS/USD hardcode **yok** (§9, [05](./05-country-currency-language.md))
- [ ] Maaş kombinasyonları Gate 0 **KABUL** (§9.2)
- [ ] WageEngine tek motor; frontend hesap **yok** (§10)
- [ ] Günlük puantaj proje veya proje dışı tip **zorunlu** (§13.3)
- [ ] Ay kilidi **bordro ekranında**; ayrı menü **yok** (§15A)
- [ ] Bordro FX **snapshot**; dashboard kuru geçmişi bozmaz (§15B)
- [ ] Bordro-finance: HR yükümlülük, kasa finance onayı (§15C, [09](./09-finance-data-contract.md))
- [ ] Avans kesinti finance referanslı (§15D)
- [ ] Ücret değerlendirme sadeleştirildi (§17A)
- [ ] Vardiya/çalışma sistemi Gate 0 **KABUL** (§12, §17B)
- [ ] Registry/manifest/ABAC (§2A) [03](./03-migration-module-registry.md) v0.2.0 uyumu
- [ ] Permission + audit (§17, §17C)
- [ ] HT-01…HT-48 test planına aktarıldı
- [ ] WageEngine vektörleri doğrulandı (§11.4) — fixture inceleme
- [ ] H1, H5, P-HR-1…P-HR-6 Gate 0 **KABUL** (§24)
- [ ] **Durum: FROZEN** (henüz değil)

**Gate 0 kuralı:** Bu belge **FROZEN** olmadan HR modül kodu **yazılmaz**.

---

## 24. Açık kararlar

Gate 0’da **KABUL**; belirsiz “sonra bakılır” yok. Uygulama ayrı Gate’te.

| # | Gate 0 karar | Uygulama Gate | Not |
|---|--------------|---------------|-----|
| **H1** | **KABUL** — Vardiya + çalışma takvimi + durum; model **C+B** (`hr_shifts`, datetime, AttendanceEngine) | Gate 2 HR settings/attendance | A = import fallback only |
| **H2** | **KABUL** — `termination_date` dolu ⇒ pasif; `employment_status` ile hizalı | Gate 2 | |
| **H3** | **KABUL** — Maaş PATCH yok; revision-only | Gate 2 | |
| **H4** | **KABUL** — Self-service puantaj kapsam dışı Gate 0; profil sınırlı | Gate 2.1 | |
| **H5** | **KABUL** — leave/absent/sick + saat varsayılan red; `hr.attendance.override` | Gate 2 | |
| **P-HR-1** | **KABUL** — Personel kartı → Personeller popup | Gate 2 UI | |
| **P-HR-2** | **KABUL** — Local/reporting currency; hardcode yok | Gate 1–2 Money | [05](./05-country-currency-language.md) |
| **P-HR-3** | **KABUL** — Bordro kur snapshot | Gate 2 payroll | |
| **P-HR-4** | **KABUL** — Ay kilidi bordro içi | Gate 2 UI | |
| **P-HR-5** | **KABUL** — Bordro-finance ödeme yükümlülüğü | Gate 5 finance + Gate 2 HR export | [09](./09-finance-data-contract.md) |
| **P-HR-6** | **KABUL** — Günlük puantaj proje/proje dışı zorunlu | Gate 2 | |
| **HR-TST** | Fixture vektör inceleme | FROZEN öncesi | [hr-wage-vectors.json](./fixtures/hr-wage-vectors.json) |

---

## 25. Onay

| Rol | İsim | Tarih |
|-----|------|-------|
| Proje lideri | | |
| İK domain | | |
| Backend lead | | |

---

## 26. Belge durumu

**Versiyon:** 2.0.0 (21.05.2026)

**Önceki:** 1.2.0 — WageEngine, AttendanceEngine, H1 C+B taslak.

**Bu sürüm:** Personeller popup merkez; işten çıkış tarihi; local/reporting currency; maaş kombinasyonları; bordro snapshot; ay kilidi bordro içi; bordro-finance; ücret değerlendirme sadeleştirme; §2A registry; HT-27…HT-48; açık kararlar KABUL.

**Durum: İNCELEMEDE** — Henüz FROZEN değil.

Gate 0 HR kararları kullanıcı HR dokümanına göre genişletildi; personel popup, işten çıkış tarihi, local/reporting currency maaş yapısı, bordro snapshot, bordro-finance bağlantısı ve vardiya/çalışma sistemi kararları eklendi. **FROZEN** proje onayı sonrası.

**Sonraki önerilen spec:** [09-finance-data-contract.md](./09-finance-data-contract.md) (HR payroll obligation hizalama)

### Uygulama Gate’i atanan alanlar (karar KABUL — kod sonra)

| Konu | Uygulama Gate |
|------|----------------|
| Registry/manifest seed | Gate 1 |
| Personeller popup UI | Gate 2 |
| WageEngine / AttendanceEngine | Gate 2 |
| Vardiya + çalışma takvimi | Gate 2 (`hr.settings`) |
| Bordro kilitle + snapshot | Gate 2 |
| Finance ödeme yükümlülüğü | Gate 5 + HR `send_to_finance` Gate 2 |
| Avans kesinti entegrasyonu | Gate 5 finance |
| Self-service puantaj (H4) | Gate 2.1 |
