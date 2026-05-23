# FactoryOS V3 — HR Fixture Review

**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026 (WT + AT ilk domain taraması, policy kararları modül kurulumuna ertelendi, orta öncelik Gate 2’ye devredildi, ana vektör durumları sınıflandırıldı, §2 tutarlılık düzeltildi)  
**Durum:** İNCELEMEDE (Gate 0 HR-TST kapanış kontrolü)

**Kaynak fixture dosyaları:**

- [hr-wage-vectors.json](./hr-wage-vectors.json) — WT-01…WT-20
- [hr-attendance-vectors.json](./hr-attendance-vectors.json) — AT-01…AT-20

**İlgili spec:** [06-hr-full-blueprint.md](../06-hr-full-blueprint.md) · [00-gate0-open-decisions.md](../00-gate0-open-decisions.md) (HR-TST)

---

## 1. Doküman amacı

Bu dokümanın amacı, FactoryOS V3 Gate 0 kapsamında oluşturulan HR maaş ve puantaj test vektörlerinin domain açısından incelenmesini sağlamaktır.

Bu doküman kodlama dokümanı değildir. Gate 1 başlangıç dokümanı değildir. Sadece Gate 0 HR-TST kapanışına hazırlık dokümanıdır.

---

## 2. Mevcut karar durumu

| Karar / Alan | Durum | Not |
|---|---|---|
| HR-TST | İNCELEMEDE | WT ve AT test vektörleri domain olarak onaylanmadan KAPANDI yapılamaz |
| WT-01…WT-20 | GATE 0 SINIFLANDIRILDI | 10 baseline uygun, 6 modül kurulumunda detay, 3 Gate 2 devir, 1 ek test önerisi |
| AT-01…AT-20 | GATE 0 SINIFLANDIRILDI | 16 baseline uygun, 3 modül kurulumunda detay, 1 Gate 2 devir |
| Gate 1 | BAŞLAMADI | Gate 0 PASS olmadan başlanmayacak |
| FactoryOS-V3 repo | OLUŞTURULMADI | Gate 0 PASS olmadan oluşturulmayacak |

---

## 3. İnceleme prensipleri

Aşağıdaki kurallar test vektörleri incelenirken temel kabul kriteri olarak kullanılacaktır:

1. `computeWageBreakdown` (V3: **WageEngine**) FactoryOS V3 için tek maaş hesap motoru kabul edilir.
2. Frontend bağımsız maaş matematiği yapamaz.
3. Resmi / gayri resmi / USD / UZS ücret ayrımı testlerde açık görünmelidir.
4. Normal saat ve fazla mesai saatleri ayrı izlenmelidir.
5. Fazla mesaiye uygun olmayan personelde fazla mesai saatleri performans/rapor için tutulabilir ancak maaşa etki etmemelidir.
6. Günlük puantaj ve aylık puantaj aynı mantıktan beslenmelidir.
7. Gece yarısını geçen çalışmalar özel olarak test edilmelidir.
8. Pazar / tatil / ücretsiz gün / izin gibi durumlar HR ayarlarından gelen kurallara göre yorumlanmalıdır.
9. Eski V2 davranışı yalnızca iş kuralı referansı olabilir; teknik borç kopyalanamaz.
10. Test vektörleri V3’te regressionsız taşınabilecek kadar net olmalıdır.

---

## 4. WT — Maaş test vektörü inceleme tablosu

Kaynak: [hr-wage-vectors.json](./hr-wage-vectors.json). Aşağıdaki tablo WT-01…WT-20 için domain kontrol listesidir. **Karar sütunu Gate 0 durum sınıflandırmasıdır; resmi domain KABUL değildir.**

Sütunlar: **Giriş** = `employee_profile` + `salary_model` + `attendance_summary` özeti; **Beklenen** = `expected_result` özeti; **Kritik kontrol** = WageEngine / para birimi / split / FM / izin kuralları.

| ID | Senaryo özeti | Giriş (özet) | Beklenen çıktı (özet) | Kritik domain kontrol | Beklenen davranış tutarlı mı? | Eksik / şüpheli nokta | Karar |
|---|---|---|---|---|---|---|---|
| WT-01 | UZS tam maaş, normal ay, FM yok | 12M UZS (3M resmi + 9M GR); FM 0; tam ay 10560 dk normal | Toplam 12M UZS; `transaction_currency=UZS`; redaction yok | Tek para; split=toplam; WageEngine-only | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| WT-02 | USD tam maaş, normal ay, FM yok | 5K USD (1.5K+3.5K); `payroll_usd_uzs_rate` rapor için 12500 | Toplam 5K USD korunur; FM 0 | USD ezilmez; split USD | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| WT-03 | USD toplam + UZS resmi (FX) | 5K USD toplam; resmi 12.5M UZS; `official_salary_fx_rate=12500` | Resmi UZS; gayri resmi 4K USD; toplam 5K USD | Karma FX zorunlu; unofficial=total−resmi/kur | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| WT-04 | Split toplam maaşa eşit + FM | 10M UZS split 2.5M+7.5M; payable OT 120 dk | `is_valid=true`; toplam 10M; FM dakikası var | Split doğrulama; raw=payable OT | İlk inceleme — tutarlı | FM tutarı (`overtime_pay`) vektörde sayısal yok; Gate 2 formül onayı gerekir | **GATE 2 FORMÜL / WORKFLOW DEVİR** |
| WT-05 | Split toplamı aşıyor — hata | 1K USD toplam; resmi 50M UZS; kur 12500 | `is_valid=false`; ödeme null; `NEGATIVE_UNOFFICIAL` | Motor hata/uyarı; ödeme üretilmez | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| WT-06 | FM eligible=true, payable OT | 8M UZS; raw/payable OT 480 dk; eligible true | Taban 8M + `overtime_pay_uzs>0` | payable OT bordroya girer | İlk inceleme — kısmen | FM ücret formülü ve kesin tutar Gate 2; `>0` yalnızca yön testi | **GATE 2 FORMÜL / WORKFLOW DEVİR** |
| WT-07 | FM eligible=false, raw≠payable | 6M UZS resmi tam; raw OT 600; payable OT 0 | Toplam 6M; `overtime_pay_uzs=0` | Performans saati ≠ ödeme | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| WT-08 | Ücretsiz izin kesintisi | 11M UZS; 2 `unpaid_leave_days`; normal 9600 dk | Toplam 10M; `deduction_applied` | Ücretsiz izin düşer | İlk inceleme — kısmen | Kesinti oranı ve resmi/GR dağılımı Gate 2; fixture kesinti sonrası split oranı domain onayı | **MODÜL KURULUMUNDA DETAYLANDIRILACAK** |
| WT-09 | Ücretli izin kesintisiz | 10M UZS; 3 `paid_leave_days`; fiili normal 9120 dk | Toplam 10M; `payable_normal_minutes=10560` | Ücretli izin tam ücret | İlk inceleme — kısmen | Fiili puantaj dk (9120) ≠ bordro payable dk (10560); politika bilinçli mi yazılmalı | **MODÜL KURULUMUNDA DETAYLANDIRILACAK** |
| WT-10 | Hastalık/rapor policy | 9M UZS; 3 `sick_leave_days`; `sick_leave_pay_policy` | Toplam 8.775M; policy bayrağı | hr_settings’e bağlı kesinti | İlk inceleme — kısmen | Kesinti yüzdesi örnek sayı; Gate 2’de `hr_settings` ile sabitlenmeli | **MODÜL KURULUMUNDA DETAYLANDIRILACAK** |
| WT-11 | Devamsızlık kesintisi | 10M UZS; 2 `absent_days` | ~9.09M UZS; `deduction_reason=absent_days` | Devamsızlık düşer | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| WT-12 | Pazar default unpaid | 7M UZS; `sunday_work_minutes=480`; policy unpaid | Toplam 7M; `sunday_premium_pay=0` | Pazar ödemesi yok | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| WT-13 | Pazar override ödemeli | 7M UZS; pazar 480 dk; `sunday_override_applied` | Toplam >7M; premium >0 | Override + audit (H5) | İlk inceleme — kısmen | Premium tutarı ve resmi/GR payı `>0`; Gate 2 formül + AT-14 ile hizalama | **GATE 2 FORMÜL / WORKFLOW DEVİR** |
| WT-14 | Tatil çarpanı | 8M UZS split; `holiday_work_minutes=480`; çarpan 2.0 | Toplam 8.363M; holiday premium | Tatil rate `hr_settings` | İlk inceleme — kısmen | Resmi/gayri resmi tatil payı dağılımı ve çarpan uygulama sırası domain kararı | **MODÜL KURULUMUNDA DETAYLANDIRILACAK** |
| WT-15 | İşe giriş prorate | hire 2026-04-15; 12M UZS; 5280 dk | Toplam 6.4M; `proration_factor≈0.53` | Ay ortası giriş | İlk inceleme — kısmen | `calendar_days_in_month` vs `work_days` prorate kuralı Gate 2’de netleşmeli | **MODÜL KURULUMUNDA DETAYLANDIRILACAK** |
| WT-16 | İşten çıkış prorate | termination 2026-04-20; 10M UZS; 7200 dk | Toplam ~6.67M; factor ≈0.67 | Ay ortası çıkış | İlk inceleme — kısmen | WT-15 ile aynı prorate metodu onayı gerekir | **MODÜL KURULUMUNDA DETAYLANDIRILACAK** |
| WT-17 | Snapshot dondurma | Nisan kilitli; snapshot gen=1; Mayıs’ta yeni maaş | Nisan 5K USD snapshot; canlı revizyon yok | Geçmiş ay immutable | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| WT-18 | Compensation history dönem | Nisan 6M / Mayıs 6.5M UZS revizyon | Ay bazlı farklı `total_pay` | Revision-only (H3) | İlk inceleme — kısmen | Ay içi iki maaş versiyonu (prorate) bu vektörde yok; ayrı vektör gerekebilir | **EK TEST ÖNERİSİ** |
| WT-19 | Maaş redaction | `hr.salary.view_group` yok | Tüm maaş alanları null; dk görünür | API redaction | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| WT-20 | Frontend hesap yok | 4K USD; API motor çıktısı | `frontend_calculation_allowed=false` | Tek kaynak backend | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |

### 4.1 WT ilk tarama özeti (19.05.2026)

| Metrik | Adet |
|--------|------|
| Toplam vektör | 20 |
| İlk incelemede kritik belirsizlik yok | **10** (WT-01, 02, 03, 05, 07, 11, 12, 17, 19, 20) |
| Eksik / şüpheli nokta işaretli | **10** (WT-04, 06, 08, 09, 10, 13, 14, 15, 16, 18) |
| Resmi domain KABUL | 0 |
| GATE 0 BASELINE UYGUN | **10** |
| MODÜL KURULUMUNDA DETAYLANDIRILACAK | **6** |
| GATE 2 FORMÜL / WORKFLOW DEVİR | **3** |
| EK TEST ÖNERİSİ | **1** |

**Not:** “Tutarlı” ifadesi Gate 0 fixture taslağının prensiplerle uyumunu ifade eder; **KABUL** kararı ancak domain sahibi imzasından sonra verilir. Karar sütunu Gate 0 sınıflandırmasıdır.

---

## 5. AT — Puantaj test vektörü inceleme tablosu

Kaynak: [hr-attendance-vectors.json](./hr-attendance-vectors.json) (H1 **C+B**). **Karar sütunu Gate 0 durum sınıflandırmasıdır; resmi domain KABUL değildir.**

| ID | Senaryo özeti | Giriş (özet) | Beklenen çıktı (özet) | Kritik domain kontrol | Beklenen davranış tutarlı mı? | Eksik / şüpheli nokta | Karar |
|---|---|---|---|---|---|---|---|
| AT-01 | Normal gündüz 08:00–17:00 | DAY-STD; 08–17; mola 60; `shift_id=1`; worked | total 540; normal 480; OT 0 | Dakika bazlı; mola düşümü | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-02 | Mola → normal 480 dk | AT-01 ile aynı aralık; `break_deduction` kuralı | total 540; normal 480 | normal = total − break | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-03 | Gece aşan 20:00–04:00 | NIGHT-A; `crosses_midnight=true`; end ertesi gün 04:00 | total 450; normal 420 (mola 30) | datetime birincil; `work_date` başlangıç günü | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-04 | Uzun vardiya 08:00→ertesi 04:00 | LONG-PROD; 20 saat brüt; mola 60 | total 1140; normal 1080; OT 0 | Gece geçişi datetime ile | İlk inceleme — kısmen | Gün bölme/`attendance_segments` yok (Gate 2.1+); tek kayıtta tüm süre normal — domain onayı | **GATE 2 FORMÜL / WORKFLOW DEVİR** |
| AT-05 | safeEndMinutes yalnız import | `v2_import_mode`; `shift_id=null`; 22:00–06:00 datetime | 480 dk; `fallback_used`; shift zorunlu değil | V3 ana model datetime; legacy fallback | İlk inceleme — kısmen | AT-18 ile istisna yolu net yazılmalı; import dışı shift_id zorunluluğu H1 onayı | **MODÜL KURULUMUNDA DETAYLANDIRILACAK** |
| AT-06 | Vardiya dışı raw OT | Plan 17:00; fiili 19:00; eligible true | normal 480; raw/payable OT 120 | Vardiya sonrası FM | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-07 | eligible=true payable OT | 18:30 çıkış; raw/payable 90 dk | payable OT = raw OT | FM ödenebilir | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-08 | eligible=false payable=0 | 19:00 çıkış; raw 120; eligible false | payable OT 0 | Performans ≠ ödeme (WT-07) | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-09 | leave + saat → red | `work_status=leave`; saat var; override yok | `rejected`; H5_LEAVE… | H5 varsayılan red | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-10 | absent + saat → red | `work_status=absent`; kısa saat aralığı | `rejected`; H5_ABSENT… | Devamsızlıkta saat yok | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-11 | sick_leave + saat → red | `sick_leave`; override yok | `rejected`; H5_SICK… | H5 / policy (AT-12 istisna) | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-12 | Override + leave kabul | `override_reason` + `approved_by=42` | 480 normal; `audit_required=true` | Override zorunlu audit | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-13 | Pazar default unpaid | `day_type=sunday`; 240 dk; policy unpaid | `normal_minutes=0`; `sunday_minutes_unpaid=240` | Pazar ödemesiz | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-14 | Pazar override ödemeli | override + audit; 08–16 mola 30 | `sunday_minutes_paid=450`; audit | Override ile pazar çalışır | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-15 | Tatil day_type rule | `day_type=holiday`; 6 saat; `holiday_premium` shift | `holiday_minutes=330` | Tatil kuralı hr_settings | İlk inceleme — kısmen | Premium/rate WageEngine (WT-14) ile bağlantı ve çarpan sırası Gate 2’de netleşmeli | **MODÜL KURULUMUNDA DETAYLANDIRILACAK** |
| AT-16 | Sıfır süre red | start=end 17:00 | `rejected`; time_order_invalid | Negatif/sıfır süre yasak | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-17 | Datetime eksik red | start/end null | `rejected`; time_required | Zorunlu datetime (H1-B) | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-18 | shift_id zorunlu | `shift_id=null`; yeni kayıt | `rejected`; shift_id_required | C+B MVP shift bağlantısı | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-19 | Ay kilitli → red | `month_locked=true` Nisan | `rejected`; month_locked | Kilitli ay yazılamaz | İlk inceleme — tutarlı | İlk incelemede kritik belirsizlik yok | **GATE 0 BASELINE UYGUN** |
| AT-20 | Kilidi aç + düzelt + audit | `monthUnlock` + reason; düzeltme 17:30; relock | 570 total; raw/payable OT 30; audit; `relock_snapshot_required` | Yetkili unlock + audit | İlk inceleme — kısmen | Unlock→düzeltme→yeniden kilitle→snapshot adımları Gate 2 workflow spec’te ayrıntılandırılmalı | **MODÜL KURULUMUNDA DETAYLANDIRILACAK** |

### 5.1 AT ilk tarama özeti (19.05.2026)

| Metrik | Adet |
|--------|------|
| Toplam vektör | 20 |
| İlk incelemede kritik belirsizlik yok | **16** (AT-01, 02, 03, 06, 07, 08, 09, 10, 11, 12, 13, 14, 16, 17, 18, 19) |
| Eksik / şüpheli nokta işaretli | **4** (AT-04, 05, 15, 20) |
| Resmi domain KABUL | 0 |
| GATE 0 BASELINE UYGUN | **16** |
| MODÜL KURULUMUNDA DETAYLANDIRILACAK | **3** |
| GATE 2 FORMÜL / WORKFLOW DEVİR | **1** |

**Not:** “Tutarlı” ifadesi fixture taslağının H1 C+B ve dakika kurallarıyla uyumunu gösterir; **KABUL** yalnızca domain imzası sonrası. Karar sütunu Gate 0 sınıflandırmasıdır.

---

## 6. Şüpheli Maddeler İçin Domain Resolution Matrix

Bu bölüm, ilk domain taramasında net olmayan WT ve AT test vektörlerinin nasıl kapatılacağını tanımlar. **Yüksek öncelikli** maddeler (10 adet): **MODÜL KURULUMUNDA KARAR VERİLECEK**. **Orta öncelikli** maddeler (4 adet): **GATE 2 FORMÜL / WORKFLOW DETAYINA DEVREDİLECEK** (Gate 0 blocker değil). HR-TST genel durumu bu adımda **KAPANDI yapılmaz**.

**Kapsam:** WT-04, 06, 08, 09, 10, 13, 14, 15, 16, 18 · AT-04, 05, 15, 20 (toplam **14** madde).

### 6.1 WT domain resolution matrix

| ID | Belirsizlik | Önerilen domain kararı | Fixture etkisi | Gate etkisi | Öncelik | Durum |
|----|-------------|------------------------|----------------|-------------|---------|--------|
| WT-04 | FM tutarı sayısal değil | **Gate 0 (tespit):** Split doğrulama testi; FM parasal tutar vektörde zorunlu değil. **Gate 2 (çözüm):** Fazla mesai parasal formülü WageEngine detayında netleşir | `overtime_pay_policy_deferred=true` (Gate 0 bayrak) | Gate 0 yeterli; Gate 2 WageEngine formül | Orta | **GATE 2 FORMÜL / WORKFLOW DETAYINA DEVREDİLECEK** |
| WT-06 | FM eligible=true için kesin tutar yok; yalnızca `>0` | **Gate 0 (tespit):** eligible=true → `overtime_pay > 0` yön testi yeterli. **Gate 2 (çözüm):** Kesin FM formülü ve tutar WageEngine’de | `formula_deferred_to_gate2=true` | Gate 0 yeterli; Gate 2 WageEngine | Orta | **GATE 2 FORMÜL / WORKFLOW DETAYINA DEVREDİLECEK** |
| WT-08 | Ücretsiz izin kesintisinin resmi/gayri resmi dağılımı net değil | **Aday (Gate 0):** Kesinti toplam maaş üzerinden oransal; split oranı korunur. **Kesin karar:** HR modülü kurulumu — `hr_settings` (izin kesinti politikası), WageEngine | `deduction_distribution` adayı fixture notu | Gate 2 HR; hr_settings + WageEngine | Yüksek | **MODÜL KURULUMUNDA KARAR VERİLECEK** |
| WT-09 | Fiili dk 9120 vs bordro payable dk 10560 | **Aday (Gate 0):** `actual_work_minutes` ≠ `payroll_payable_minutes`; ücretli izin bordroda tam ay dahil olabilir. **Kesin karar:** AttendanceEngine + bordro ekranları + WageEngine sözleşmesi | Ayrım alanları fixture notu | Gate 2 HR; puantaj + bordro UI | Yüksek | **MODÜL KURULUMUNDA KARAR VERİLECEK** |
| WT-10 | Hastalık/rapor kesinti yüzdesi örnek sayı gibi | **Aday (Gate 0):** Oran hard-code değil; `hr_settings.sick_leave_pay_ratio`. **Kesin karar:** HR ayarları ekranı + WageEngine | `sick_leave_policy_source=hr_settings` adayı | Gate 2 HR; hr_settings | Yüksek | **MODÜL KURULUMUNDA KARAR VERİLECEK** |
| WT-13 | Pazar override premium `>0`; formül yok | **Gate 0 (tespit):** Pazar override + audit + paid minutes akışı test edilir. **Gate 2 (çözüm):** Pazar premium parasal formülü WageEngine + `hr_settings.sunday_policy` | `sunday_premium_formula_deferred=true` | Gate 0 yeterli; Gate 2 WageEngine + hr_settings | Orta | **GATE 2 FORMÜL / WORKFLOW DETAYINA DEVREDİLECEK** |
| WT-14 | Tatil çarpanı resmi/GR dağılımı ve uygulama sırası | **Aday (Gate 0):** Tatil premium toplam ücret; split oranlı dağılım; `hr_settings.holiday_rate`. **Kesin karar:** hr_settings + WageEngine + gün tipi kuralları | `holiday_rate_source`, `holiday_distribution` adayları | Gate 2 HR; WageEngine | Yüksek | **MODÜL KURULUMUNDA KARAR VERİLECEK** |
| WT-15 | Prorate: calendar days vs work days | **Aday (Gate 0):** Default **work_days**; `hr_settings.proration_basis` opsiyonları. **Kesin karar:** HR ayarları + işe giriş ekranı + WageEngine | `proration_basis` adayı | Gate 2 HR; hr_settings | Yüksek | **MODÜL KURULUMUNDA KARAR VERİLECEK** |
| WT-16 | Çıkış prorate WT-15 ile aynı yöntem | **Aday (Gate 0):** WT-15 ile aynı prensip (work_days default). **Kesin karar:** işten çıkış akışı + WageEngine | `proration_basis` adayı | Gate 2 HR; hr_settings | Yüksek | **MODÜL KURULUMUNDA KARAR VERİLECEK** |
| WT-18 | Ay içi maaş değişikliği/prorate yok | **Aday (Gate 0):** WT-18 = dönemsel history; ay içi değişiklik ayrı **WT-21** vektörü. **Kesin karar:** compensation history UI + WageEngine prorate | WT-21 önerisi (fixture bekliyor) | Gate 2 HR; ek test vektörü | Yüksek | **MODÜL KURULUMUNDA KARAR VERİLECEK** |

### 6.2 AT domain resolution matrix

| ID | Belirsizlik | Önerilen domain kararı | Fixture etkisi | Gate etkisi | Öncelik | Durum |
|----|-------------|------------------------|----------------|-------------|---------|--------|
| AT-04 | 20 saat tek kayıtta tamamen normal; segment yok | **Gate 0 (tespit):** Gece yarısını aşan uzun çalışma tek kayıt ile test edilir; `extended_shift` / `special_work` işareti. **Gate 2.1+ (çözüm):** Gün bölme / `attendance_segments` backlog | `work_type=extended_shift` veya `special_work` | Gate 0 yeterli; Gate 2.1+ segment | Orta | **GATE 2 FORMÜL / WORKFLOW DETAYINA DEVREDİLECEK** |
| AT-05 | safeEndMinutes fallback vs AT-18 `shift_id` zorunlu | **Aday (Gate 0):** Yeni kayıtta `shift_id` zorunlu; V2 import istisnası işaretli. **Kesin karar:** AttendanceEngine + vardiya atama ekranı + import pipeline | `import_mode`, `legacy_import_exception` adayları | Gate 2 HR; AttendanceEngine + import | Yüksek | **MODÜL KURULUMUNDA KARAR VERİLECEK** |
| AT-15 | Tatil premium WageEngine bağlantısı | **Aday (Gate 0):** Attendance yalnızca dakika/gün tipi; para WageEngine’de. **Kesin karar:** AttendanceEngine ↔ WageEngine sözleşmesi + hr_settings | Parasal alan yok (fixture notu) | Gate 2 HR; modül sınırı | Yüksek | **MODÜL KURULUMUNDA KARAR VERİLECEK** |
| AT-20 | Unlock → düzelt → relock → snapshot adımları eksik | **Aday (Gate 0):** Unlock yetki+audit; relock; snapshot yenileme. **Kesin karar:** payroll lock workflow + izinler + audit log | `workflow_steps` adayı | Gate 2 HR; payroll lock workflow | Yüksek | **MODÜL KURULUMUNDA KARAR VERİLECEK** |

### 6.3 Kapanış notu

Bu maddeler Gate 0’da **kesin iş kuralı olarak kabul edilmemiştir**. Gate 0’da yalnızca **karar gerektiren policy alanları** tespit edilmiştir. Kesin kararlar **HR modülü kurulumu** sırasında, ilgili ekranlar, `hr_settings` yapısı, **WageEngine** ve **payroll lock workflow** tasarlanırken verilecektir.

| Özet | Adet |
|------|------|
| Toplam §6 madde | 14 |
| MODÜL KURULUMUNDA KARAR VERİLECEK | 10 |
| GATE 2 FORMÜL / WORKFLOW DETAYINA DEVREDİLECEK | 4 |
| DOMAIN KARARI BEKLİYOR | 0 |
| WT-21 ek vektör önerisi | Gate 2 / fixture |

**Orta öncelikli 4 madde (WT-04, WT-06, WT-13, AT-04)** Gate 2 formül/workflow detayına devredildi; **Gate 0 blocker değildir**.

**WT-21:** `month_inside_compensation_change_proration` — karar alanı tanımlandı; vektör Gate 2 / fixture (henüz oluşturulmadı).

HR-TST kapanışı için §6 maddelerinin Gate 0’da **kesinleşmesi şart değildir** (§7).

---

## 7. Onay kriterleri

HR-TST kararının **KAPANDI** yapılabilmesi için aşağıdaki kriterlerin tamamı sağlanmalıdır:

- WT-01…WT-20 test vektörleri domain olarak incelenmiş olmalı.
- AT-01…AT-20 test vektörleri domain olarak incelenmiş olmalı.
- §6 matrix (14 madde): her madde için **karar alanı** veya **devir alanı** tanımlanmış olmalı (Gate 0 yeterli).
- **DOMAIN KARARI BEKLİYOR** kalmamalı (tüm §6 maddeleri kategorize edilmiş).
- Kesin policy/formül kararları **Gate 2 HR modül kurulumu**, **WageEngine**, **AttendanceEngine** veya **Gate 2.1+ backlog**’a taşındığı açık olmalı.
- Yüksek öncelik: **MODÜL KURULUMUNDA KARAR VERİLECEK** — `hr_settings`, payroll workflow, UI.
- Orta öncelik: **GATE 2 FORMÜL / WORKFLOW DETAYINA DEVREDİLECEK** — WT-04, WT-06, WT-13, AT-04.
- §4–§5 ana tablolarında her vektör için **Gate 0 durumu** atanmış olmalı: baseline uygun / modül kurulumunda detay / Gate 2 devir / ek test önerisi.
- Maaş hesaplama motoru için tek kaynak prensibi (WageEngine) Gate 0’da onaylanmış olmalı.
- Puantaj saat matematiği dakika bazlı olmalı.
- Gece yarısını geçen çalışma senaryoları açık şekilde kapsanmış olmalı.
- Pazar / tatil / izin: policy alanları tespit edilmiş; kesin oranlar modül kurulumunda.
- Frontend/backend çift hesaplama riski kapatılmış olmalı.

---

## 8. HR-TST kapanış notu

Şu an HR-TST durumu:

**DURUM: İNCELEMEDE**

Bu doküman tamamlandıktan sonra HR-TST **otomatik olarak KAPANDI yapılmayacaktır**.

HR-TST ancak aşağıdaki ifade domain sahibi tarafından onaylandıktan sonra **KAPANDI** yapılabilir:

> “WT-01…WT-20 ve AT-01…AT-20 test vektörleri FactoryOS V3 HR iş kuralları açısından yeterlidir. Bu test setleri Gate 1 HR çekirdeği için kabul kriteri olarak kullanılabilir.”

**Onay kaydı (doldurulacak):**

| Rol | İsim | Tarih | İmza / onay |
|-----|------|-------|-------------|
| İK domain | | | |
| Backend lead | | | |
| Proje lideri | | | |

---

## 9. Sonraki adım

Bu dokümandan sonraki önerilen adım:

1. §6 domain resolution matrix — 14 madde için domain sahibi onayı.
2. Gerekirse [hr-wage-vectors.json](./hr-wage-vectors.json) / [hr-attendance-vectors.json](./hr-attendance-vectors.json) revize et (bayraklar, WT-21 önerisi).
3. §4–§5 tablolarında **Karar** sütununu güncelle (KABUL / REVİZYON / RED) — otomatik KABUL yok.
4. Domain onayı al (§8 ifadesi).
5. HR-TST → **KAPANDI** (ayrı belge/karar kaydı; bu adımda yapılmaz).
6. Gate 0 genel checklist değerlendirmesine geç.

---

## 10. Kesin yasaklar

Gate 0 PASS olmadan aşağıdaki işler yapılmayacaktır:

- FactoryOS-V3 repo oluşturmak
- Gate 1 auth/core koduna başlamak
- V2 `style.css` kopyalamak
- V2 patch zincirini kopyalamak
- V2 `frontend/public` yapısını taşımak
- HR servislerini birebir kopyalamak
- Yeni UI uygulamasına başlamak
