# FactoryOS V3 — Gate 0 Açık Kararlar (Konsolide)

**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026  
**Durum: TASLAK / İNCELEME** — Bu belge **FROZEN yapılmayacak**; kararlar kapatıldıkça güncellenir.

**İlgili belgeler:** [00-gate0-checklist.md](./00-gate0-checklist.md) · [00-gate0-required-documents.md](./00-gate0-required-documents.md) · [00-gate0-remaining-spec-checklist.md](./00-gate0-remaining-spec-checklist.md)

**Kural:** Gate 0 tam **PASS** olmadan Gate 1 kodu yazılmaz. Bu belge yeni özellik tanımlamaz; mevcut spec’lerdeki açık kararları tek yerde toplar.

---

## 1. Amaç

Bu belge FactoryOS V3 **Gate 0 açık karar listesidir**.

Tüm spec belgelerinde geçen **H1**, **P1**, **S1**, **F1**, **I1**, **M1**, **V2C1**, **C1**, **A1** vb. kararları tek yerde toplar. Amaç:

- Gate 0 **FROZEN / PASS** öncesi hangi kararların **kapatılması** gerektiğini göstermek
- Önerilen yön ile resmi onay arasındaki farkı işaretlemek
- Gate bazlı kapanış sırasını netleştirmek

**Kaynak spec’ler (davranış otoritesi modül belgelerinde kalır):**

| Alan | Spec |
|------|------|
| HR | [06-hr-full-blueprint.md](./06-hr-full-blueprint.md) |
| Stock | [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) |
| Purchasing | [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) |
| Finance | [09-finance-data-contract.md](./09-finance-data-contract.md) |
| Integration | [10-integration-map.md](./10-integration-map.md) |
| V2 carry/drop | [11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md) |
| Modal | [12-modal-flow-inventory.md](./12-modal-flow-inventory.md) |
| Currency | [05-country-currency-language.md](./05-country-currency-language.md) |
| Admin | [02-admin-control-system.md](./02-admin-control-system.md) |
| UI kit | [01-central-ui-design-system.md](./01-central-ui-design-system.md) |
| Gate 1 hedef | [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md) |

---

## 2. Karar durumları

| Durum | Anlamı |
|--------|--------|
| **AÇIK** | Seçenekler tartışılıyor; resmi karar yok |
| **ÖNERİLDİ** | Spec’te önerilen yön yazıldı; proje lideri / domain onayı bekliyor |
| **İNCELEMEDE** | Taslak karar var; çapraz spec veya mockup bekleniyor |
| **KAPANDI** | Resmi onay verildi; ilgili spec’e işlendi (FROZEN öncesi) |
| **FROZEN** | Karar değişmez; yalnızca kontrollü revizyon |

**Not:** Bu belgedeki satırlar çoğunlukla **ÖNERİLDİ** veya **AÇIK** durumundadır. Karar **KAPANDI** olunca ilgili modül spec’indeki açık karar tablosu güncellenir ve burada durum işaretlenir.

---

## 3. Karar öncelikleri

| Öncelik | Anlamı |
|---------|--------|
| **KRİTİK** | Gate 0 **PASS** için kapanmalı |
| **YÜKSEK** | Gate 1 / Gate 2 başlamadan kapanmalı |
| **ORTA** | İlgili modül gate’i başlamadan kapanmalı |
| **DÜŞÜK** | Backlog / future enhancement olabilir |

---

## 4. HR açık kararları

Kaynak: [06-hr-full-blueprint.md](./06-hr-full-blueprint.md) §24

### H1 — Vardiya / gece aşan çalışma modeli

| Alan | Değer |
|------|--------|
| **Öneri** | **C+B kombinasyonu** |
| **Plan** | `hr_shifts` / `work_shifts` + `employee_shift_assignments` |
| **Fiili** | `attendance_daily.start_datetime` / `end_datetime` |
| **MVP** | `shift_id` Gate 2’de zorunlu |
| **Fallback** | `safeEndMinutes` yalnızca V2 import / geçiş |
| **Sonra** | `attendance_segments` (D) Gate 2.1+ |
| **Durum** | **ÖNERİLDİ** — resmi FROZEN öncesi onay bekliyor |
| **Öncelik** | **KRİTİK** |

### H5 — leave / absent / sick_leave + saat girişi

| Alan | Değer |
|------|--------|
| **Öneri** | Varsayılan **red** |
| **İstisna** | `hr.attendance.override` + `override_reason` + `approved_by` + audit |
| **Durum** | **ÖNERİLDİ** |
| **Öncelik** | **YÜKSEK** |

### HR test vektörü

| Alan | Değer |
|------|--------|
| **Karar** | En az **20 maaş** + **20 puantaj** test vektörü FROZEN öncesi gerekli |
| **Fixture** | [fixtures/hr-wage-vectors.json](./fixtures/hr-wage-vectors.json) (20) · [fixtures/hr-attendance-vectors.json](./fixtures/hr-attendance-vectors.json) (20) |
| **Durum** | **İNCELEMEDE** — dosyalar hazır; domain onayı bekliyor |
| **Öncelik** | **KRİTİK** |

### Diğer HR notları (öneri net, resmi kapanış bekliyor)

| ID | Konu | Öneri | Durum | Öncelik |
|----|------|--------|--------|---------|
| H2 | `employment_status` vs `is_active` | terminated ⇒ `is_active=0` | Öneri net | ORTA |
| H3 | Maaş PATCH yasağı | Revision-only | Öneri net | YÜKSEK |
| H4 | Profile self-service puantaj | Gate 2 veya 2.1 | AÇIK | DÜŞÜK |

---

## 5. Stock açık kararları

Kaynak: [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) §27

### S1 — Marka / tedarikçi ilişkisi

| Alan | Değer |
|------|--------|
| **Öneri** | Ayrı entity: `brands` ayrı, `suppliers` ayrı; `supplier_brands` ileride |
| **Durum** | **ÖNERİLDİ** |
| **Öncelik** | **ORTA** (Gate 3 öncesi) |

### P5 (STK) — Manuel stok giriş modeli

| Alan | Değer |
|------|--------|
| **Öneri** | **Seçenek C:** talep + onay |
| **İstisna** | `super_admin` override (audit) |
| **Durum** | **ÖNERİLDİ** |
| **Öncelik** | **KRİTİK** (Gate 0 PASS tablosunda) |

*Not: Satınalma spec’indeki **P5** = under receive close; ID çakışmasını önlemek için burada **P5 (STK)** kullanılır.*

### S2 — Sevkiyat yerleşimi

| Alan | Değer |
|------|--------|
| **Karar** | Mockup sonrası: stock alt modül mü, `project` / `shipment` ayrı gate mi? |
| **Durum** | **AÇIK** |
| **Öncelik** | **DÜŞÜK** (Gate 6+) |

### S3 — Envanter / zimmet

| Alan | Değer |
|------|--------|
| **Karar** | Stock alt modül mü, ayrı `module.inventory` mi? |
| **Durum** | **AÇIK** (I2 ile hizalı) |
| **Öncelik** | **ORTA** (Gate 6+ hazırlık) |

### S4 — Excel duplicate policy

| Alan | Değer |
|------|--------|
| **Öneri** | Merge / review popup; duplicate satır direkt açılmasın |
| **Durum** | **ÖNERİLDİ / İNCELEME** |
| **Öncelik** | **ORTA** (Gate 3 öncesi) |

---

## 6. Purchasing açık kararları

Kaynak: [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) §24

| ID | Konu | Öneri | Durum | Öncelik |
|----|------|--------|--------|---------|
| **P1** | `project_id` request/item zorunlu mu? | Request: opsiyonel; item: opsiyonel, varsa taşınır; Stock OUT’ta `project_id` **zorunlu** | **ÖNERİLDİ** | ORTA (Gate 4) |
| **P2** | Pending cost: update mi correction mı? | Kesinleşmemiş pending → auditli **layer update**; kesinleşmiş/final → **correction record** | **ÖNERİLDİ** | **KRİTİK** |
| **P3** | Price revision yetkisi | Gate 4 satınalma başlatır; Gate 5 finance onay/finalize | **ÖNERİLDİ** | ORTA (Gate 4–5) |
| **P4** | Over receive tolerans | Admin ayarı; varsayılan **%0**; üstü onay | **ÖNERİLDİ** | ORTA |
| **P5 (PUR)** | Under receive close kim onaylar? | Depocu tek başına kapatamaz; satınalma sorumlusu / talep sahibi / yetkili manager | **ÖNERİLDİ** | ORTA |
| **P6** | Product create popup yetkisi | `purchasing.request.create` yeterli değil; `purchasing.product.create` veya `stock.products.create` | **ÖNERİLDİ** | ORTA |

---

## 7. Finance açık kararları

Kaynak: [09-finance-data-contract.md](./09-finance-data-contract.md) v1.1.0 §22

| ID | Konu | Öneri | Durum | Öncelik |
|----|------|--------|--------|---------|
| **F1** | `invoices` vs `finance_movements` | **Ayrı.** Invoice = belge; `finance_movements` = operasyonel borç/alacak. `invoice.posted` → movement üretir | **ÖNERİLDİ** | **KRİTİK** |
| **F2** | Tahsilat modeli | Tek tablo `payments`; `payment_direction` OUT=ödeme, IN=tahsilat; UI ayrı menü olabilir | **ÖNERİLDİ** | **KRİTİK** |
| **F3** | Pending cost onayı | Pending → satınalma çözebilir; final → finance onayı | **ÖNERİLDİ** | YÜKSEK |
| **F4** | Price finalization | Gate 4 satınalma başlatır; Gate 5 finance onay/finalize (P3/I4 ile uyumlu) | **ÖNERİLDİ** | YÜKSEK |
| **F5** | Employee advances | Basit avans Gate 5 MVP; tam maaş ödeme sonraya | **ÖNERİLDİ** | ORTA |
| **F6** | Bank accounts | Minimal `bank_accounts` Gate 5 MVP; mutabakat/API sonra | **ÖNERİLDİ** | ORTA |

---

## 8. Integration Map açık kararları

Kaynak: [10-integration-map.md](./10-integration-map.md) §17

| ID | Konu | Öneri | Durum | Öncelik |
|----|------|--------|--------|---------|
| **I1** | Project module gate sırası | Gate **6+**; `project_id` Gate 3 Stock OUT’ta hazır olmalı | **AÇIK / ÖNERİLDİ** | ORTA (Gate 6+) |
| **I2** | Inventory / zimmet | Ayrı `module.inventory` daha doğru; stock ile mal kabul paylaşır, zimmet/seri kuralları ayrı | **AÇIK** | ORTA |
| **I3** | Shipment | Mockup sonrası ayrı shipment/project delivery gate; stock içinde erken şişirilmemeli | **AÇIK** | DÜŞÜK |
| **I4** | Price finalization yetkisi | F4 ile uyumlu: purchasing başlatır, finance finalize | **ÖNERİLDİ** | YÜKSEK |
| **I5** | Event bus vs port/adaptor | Gate 0–5: **senkron servis portları** yeterli; event bus ileride | **ÖNERİLDİ** | **KRİTİK** |
| **I6** | Audit event naming standardı | Ayrı bölüm veya ek doküman; [02-admin](./02-admin-control-system.md) ile hizalanmalı | **AÇIK** | YÜKSEK |

---

## 9. Modal açık kararları

Kaynak: [12-modal-flow-inventory.md](./12-modal-flow-inventory.md) §18

| ID | Konu | Öneri | Durum | Öncelik |
|----|------|--------|--------|---------|
| **M1** | Drawer mı modal mı (detay ekranları)? | — | **AÇIK** | YÜKSEK (Gate 1 öncesi) |
| **M2** | Wizard standardı Gate 1’de mi modül gate’inde mi? | — | **AÇIK** | YÜKSEK |
| **M3** | PrintPreview Gate 1 UI kit mi modül gate’i mi? | — | **AÇIK** | ORTA |
| **M4** | `flowId` her audit log’da? | **Evet** | **ÖNERİLDİ** | YÜKSEK |
| **M5** | Mobile full-screen tüm formlar için mi? | — | **AÇIK** | ORTA |
| **M6** | Unsaved changes guard Gate 1 zorunlu mu? | **Evet**, Gate 1 temel guard | **ÖNERİLDİ** | **KRİTİK** |

---

## 10. V2 Carry & Drop açık kararları

Kaynak: [11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md) §18

| ID | Konu | Öneri | Durum | Öncelik |
|----|------|--------|--------|---------|
| **V2C1** | Hangi test verileri V2’den alınacak? | — | **AÇIK** | YÜKSEK |
| **V2C2** | Hangi V2 ekranları UAT referansı? | [v2-reference-index.md](./v2-reference-index.md) §12 gate bazlı UAT listesi | **ÖNERİLDİ / İnceleme** | YÜKSEK |
| **V2C3** | V2 canlı + V3 paralel karşılaştırma | — | **AÇIK** | ORTA |
| **V2C4** | Demo seed V2’den taşınacak mı? | — | **AÇIK** | ORTA |
| **V2C5** | V2 bug listesi → “do not port” | **Evet**, ayrı takip listesi | **ÖNERİLDİ** | YÜKSEK |

### V2 ana yasaklar (politika — Gate 0’da kabul bekleniyor)

| Konu | Durum | Not |
|------|--------|-----|
| V2 kod kopyası yok | **ÖNERİLDİ** → PASS’ta **KAPANDI** sayılacak | [11](./11-v2-carry-and-drop.md) §2, §4 |
| V2 UI/CSS/`style.css` taşınmaz | Aynı | Mockup + [00-ui-design-direction-freeze](./00-ui-design-direction-freeze.md) |
| Patch zinciri taşınmaz | Aynı | V3 temiz migration |
| Behavior port serbest, copy-paste yasak | Aynı | UAT referansı |

---

## 11. Platform / Admin / Currency / UI / Gate 1 (ek kararlar)

Bu kararlar modül spec’lerinde dağınık; Gate 0 PASS veya Gate 1 öncesi kapatılmalıdır.

### Currency — [05-country-currency-language.md](./05-country-currency-language.md) §20

| ID | Konu | Durum | Öncelik |
|----|------|--------|---------|
| C1 | `amount_base` hesap yolu | AÇIK | KRİTİK (Gate 1 money) |
| C2 | İzin verilen işlem paraları | AÇIK | YÜKSEK |
| C3 | FX eksikte davranış (blok / son kur) | AÇIK | YÜKSEK |
| C4 | Aktif ülke değiştirme (tek tenant) | AÇIK | ORTA |

### Admin — [02-admin-control-system.md](./02-admin-control-system.md) §22

| ID | Konu | Durum | Öncelik |
|----|------|--------|---------|
| A1 | Migration run admin UI | AÇIK | YÜKSEK |
| A2 | Restore Gate 1 | AÇIK | ORTA |
| A3 | Kart/aksiyon inline edit vs manifest-only | AÇIK | ORTA |
| A4 | `admin.hub.view` vs yalnızca super_admin | AÇIK | YÜKSEK |

### UI kit — [01-central-ui-design-system.md](./01-central-ui-design-system.md) §8

| ID | Konu | Durum | Öncelik |
|----|------|--------|---------|
| UI1 | Frontend build (Vite MPA / saf static) | AÇIK | YÜKSEK |
| UI2 | Tablo satır detay (expand / modal) | AÇIK | YÜKSEK (M1 ile ilişkili) |

### Gate 1 mimari — [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md) §15

| ID | Konu | Durum | Öncelik |
|----|------|--------|---------|
| G1-1 | Auth modeli (session / JWT) | AÇIK | **KRİTİK** |
| G1-2 | Monorepo aracı | AÇIK | YÜKSEK |
| G1-3 | Tablo detay UX | AÇIK | UI2 / M1 |
| G1-4 | (UI1 ile örtüşen build) | AÇIK | UI1 |

### UI Design Direction

| Konu | Durum | Öncelik |
|------|--------|---------|
| Açık tema, kurumsal ERP, kompakt tipografi, hero/glass yok | **FROZEN** ☑ | — ([00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md)) |

---

## 12. Gate 0 PASS için kapanması gereken kritik kararlar

| ID | Konu | Önerilen yön | Mevcut durum | Kaynak |
|----|------|--------------|--------------|--------|
| **H1** | Vardiya / gece aşan çalışma | C+B | ÖNERİLDİ | [06](./06-hr-full-blueprint.md) |
| **HR-TST** | 20 maaş + 20 puantaj test vektörü | [fixtures/](./fixtures/) hazır; onay bekliyor | **İNCELEMEDE** | [06](./06-hr-full-blueprint.md) §11.4 |
| **P5 (STK)** | Manuel stok giriş | Talep + onay (C) | ÖNERİLDİ | [07](./07-stock-full-blueprint.md) |
| **P2** | Pending cost update/correction | Layer update vs correction | ÖNERİLDİ | [08](./08-purchasing-full-blueprint.md) |
| **F1** | Invoice / finance_movements | Ayrı; posted → movement | ÖNERİLDİ | [09](./09-finance-data-contract.md) |
| **F2** | Payments direction | OUT/IN tek tablo | ÖNERİLDİ | [09](./09-finance-data-contract.md) |
| **I5** | Port/adaptor vs event bus | Port yeterli | ÖNERİLDİ | [10](./10-integration-map.md) |
| **M6** | Unsaved changes guard | Gate 1 zorunlu | ÖNERİLDİ | [12](./12-modal-flow-inventory.md) |
| **V2-YASAK** | V2 carry/drop ana yasakları | Kod/UI/patch kopyası yok | ÖNERİLDİ (politika) | [11](./11-v2-carry-and-drop.md) |
| **C1–C3** | Money / FX temel kuralları | Spec’te netleşmeli | AÇIK | [05](./05-country-currency-language.md) |
| **G1-1** | Auth modeli | Session veya JWT seçimi | AÇIK | [13](./13-gate1-core-system-architecture.md) |
| **UI-FROZEN** | UI Design Direction | Mockup + freeze belgesi | **FROZEN** ☑ | [00-ui](./00-ui-design-direction-freeze.md) |

**PASS engeli özeti:** Yukarıdaki **KRİTİK** satırlar **KAPANDI** veya ilgili modül spec’inde **FROZEN** olmadan Gate 0 PASS verilmemeli.

---

## 13. Gate sırasına göre kapanabilecek kararlar

| Gate | Kapanmalı kararlar (özet) |
|------|---------------------------|
| **Gate 0 PASS** | H1, HR-TST, P5 (STK), P2, F1, F2, I5, M6, V2-YASAK, C1–C3, G1-1, tüm domain spec’ler FROZEN |
| **Gate 1 öncesi** | M1–M3, M5, UI1–UI2, A1, A4, permission/redaction, registry pasif → API 403, migration/checksum, money config |
| **Gate 2 öncesi** | H1 resmi onay, H5, H3, WageEngine + AttendanceEngine test vektörleri, H2 |
| **Gate 3 öncesi** | P5 (STK), S1, S4, unit-cost FIFO test vektörleri, `project_id` OUT |
| **Gate 4 öncesi** | P1–P6 (PUR), P3, P4, mal kabul over/under, product popup |
| **Gate 5 öncesi** | F1–F6 resmi onay, F3–F4 finalization, bank_accounts MVP |
| **Gate 6+** | I1 project, I2 inventory, I3 shipment, S2, project modal flows |

---

## 14. Master konsolide tablo

Tüm Gate 0 açık kararları tek tabloda (durumlar 19.05.2026 spec taramasına göre).

| ID | Modül | Konu (kısa) | Önerilen yön | Durum | Öncelik | Kaynak |
|----|--------|-------------|--------------|--------|---------|--------|
| UI-FROZEN | UI | Design direction | Açık tema, ERP admin, kompakt | **FROZEN** | — | [00-ui](./00-ui-design-direction-freeze.md) |
| H1 | HR | Vardiya / gece aşan | C+B: shifts + datetime + AttendanceEngine | ÖNERİLDİ | KRİTİK | [06](./06-hr-full-blueprint.md) |
| H5 | HR | İzinli gün + saat | Varsayılan red; override + audit | ÖNERİLDİ | YÜKSEK | [06](./06-hr-full-blueprint.md) |
| HR-TST | HR | Test vektörleri | [fixtures](./fixtures/) 20+20 | İNCELEMEDE | KRİTİK | [06](./06-hr-full-blueprint.md) |
| H2 | HR | employment_status | terminated ⇒ is_active=0 | Öneri net | ORTA | [06](./06-hr-full-blueprint.md) |
| H3 | HR | Maaş PATCH | Revision-only | Öneri net | YÜKSEK | [06](./06-hr-full-blueprint.md) |
| H4 | HR | Self-service puantaj | Gate 2 / 2.1 | AÇIK | DÜŞÜK | [06](./06-hr-full-blueprint.md) |
| S1 | Stock | Marka / supplier | Ayrı entity | ÖNERİLDİ | ORTA | [07](./07-stock-full-blueprint.md) |
| P5-STK | Stock | Manuel stok | Talep + onay (C) | ÖNERİLDİ | KRİTİK | [07](./07-stock-full-blueprint.md) |
| S2 | Stock | Sevkiyat yerleşimi | Mockup sonrası | AÇIK | DÜŞÜK | [07](./07-stock-full-blueprint.md) |
| S3 | Stock | Envanter / zimmet | module.inventory? | AÇIK | ORTA | [07](./07-stock-full-blueprint.md) |
| S4 | Stock | Excel duplicate | Merge/review popup | ÖNERİLDİ | ORTA | [07](./07-stock-full-blueprint.md) |
| P1 | Purchasing | project_id | Request/item opsiyonel; OUT zorunlu | ÖNERİLDİ | ORTA | [08](./08-purchasing-full-blueprint.md) |
| P2 | Purchasing | Pending cost | Update vs correction | ÖNERİLDİ | KRİTİK | [08](./08-purchasing-full-blueprint.md) |
| P3 | Purchasing | Price revision | Pur başlatır, Fin finalize | ÖNERİLDİ | ORTA | [08](./08-purchasing-full-blueprint.md) |
| P4 | Purchasing | Over receive % | Admin; default 0% | ÖNERİLDİ | ORTA | [08](./08-purchasing-full-blueprint.md) |
| P5-PUR | Purchasing | Under receive close | Çoklu onay; depocu tek başına değil | ÖNERİLDİ | ORTA | [08](./08-purchasing-full-blueprint.md) |
| P6 | Purchasing | Product popup izin | purchasing.product.create | ÖNERİLDİ | ORTA | [08](./08-purchasing-full-blueprint.md) |
| F1 | Finance | Invoice vs movements | Ayrı; posted → movement | ÖNERİLDİ | KRİTİK | [09](./09-finance-data-contract.md) |
| F2 | Finance | Tahsilat | payments + direction OUT/IN | ÖNERİLDİ | KRİTİK | [09](./09-finance-data-contract.md) |
| F3 | Finance | Pending cost | Pur çözer; final Fin onayı | ÖNERİLDİ | YÜKSEK | [09](./09-finance-data-contract.md) |
| F4 | Finance | Price finalization | İki aşamalı Pur→Fin | ÖNERİLDİ | YÜKSEK | [09](./09-finance-data-contract.md) |
| F5 | Finance | Employee advance | Basit MVP Gate 5 | ÖNERİLDİ | ORTA | [09](./09-finance-data-contract.md) |
| F6 | Finance | Bank accounts | Minimal Gate 5 | ÖNERİLDİ | ORTA | [09](./09-finance-data-contract.md) |
| I1 | Integration | Project gate | Gate 6+; project_id Gate 3 | AÇIK/ÖNERİLDİ | ORTA | [10](./10-integration-map.md) |
| I2 | Integration | Inventory | module.inventory | AÇIK | ORTA | [10](./10-integration-map.md) |
| I3 | Integration | Shipment | Ayrı gate | AÇIK | DÜŞÜK | [10](./10-integration-map.md) |
| I4 | Integration | Price finalization | = F4 | ÖNERİLDİ | YÜKSEK | [10](./10-integration-map.md) |
| I5 | Integration | Event bus | Port yeterli 0–5 | ÖNERİLDİ | KRİTİK | [10](./10-integration-map.md) |
| I6 | Integration | Audit naming | Ek standart | AÇIK | YÜKSEK | [10](./10-integration-map.md) |
| M1 | Modal | Drawer vs modal | — | AÇIK | YÜKSEK | [12](./12-modal-flow-inventory.md) |
| M2 | Modal | Wizard yeri | Gate 1 vs modül | AÇIK | YÜKSEK | [12](./12-modal-flow-inventory.md) |
| M3 | Modal | PrintPreview yeri | Kit vs modül | AÇIK | ORTA | [12](./12-modal-flow-inventory.md) |
| M4 | Modal | flowId audit | Evet | ÖNERİLDİ | YÜKSEK | [12](./12-modal-flow-inventory.md) |
| M5 | Modal | Mobile full-screen | — | AÇIK | ORTA | [12](./12-modal-flow-inventory.md) |
| M6 | Modal | Unsaved guard | Gate 1 zorunlu | ÖNERİLDİ | KRİTİK | [12](./12-modal-flow-inventory.md) |
| V2C1 | V2 | Test verisi | — | AÇIK | YÜKSEK | [11](./11-v2-carry-and-drop.md) |
| V2C2 | V2 | UAT ekranları | [v2-reference-index](./v2-reference-index.md) §12 | ÖNERİLDİ | YÜKSEK | [11](./11-v2-carry-and-drop.md) |
| V2C3 | V2 | Paralel karşılaştırma | — | AÇIK | ORTA | [11](./11-v2-carry-and-drop.md) |
| V2C4 | V2 | Demo seed | — | AÇIK | ORTA | [11](./11-v2-carry-and-drop.md) |
| V2C5 | V2 | Do not port listesi | Evet | ÖNERİLDİ | YÜKSEK | [11](./11-v2-carry-and-drop.md) |
| C1 | Currency | amount_base yolu | — | AÇIK | KRİTİK | [05](./05-country-currency-language.md) |
| C2 | Currency | İşlem paraları | — | AÇIK | YÜKSEK | [05](./05-country-currency-language.md) |
| C3 | Currency | FX eksik | — | AÇIK | YÜKSEK | [05](./05-country-currency-language.md) |
| C4 | Currency | Aktif ülke | — | AÇIK | ORTA | [05](./05-country-currency-language.md) |
| A1 | Admin | Migration UI | — | AÇIK | YÜKSEK | [02](./02-admin-control-system.md) |
| A2 | Admin | Restore | — | AÇIK | ORTA | [02](./02-admin-control-system.md) |
| A3 | Admin | Inline registry edit | — | AÇIK | ORTA | [02](./02-admin-control-system.md) |
| A4 | Admin | admin.hub.view | — | AÇIK | YÜKSEK | [02](./02-admin-control-system.md) |
| UI1 | UI | Build toolchain | — | AÇIK | YÜKSEK | [01](./01-central-ui-design-system.md) |
| UI2 | UI | Tablo detay UX | — | AÇIK | YÜKSEK | [01](./01-central-ui-design-system.md) |
| G1-1 | Gate 1 | Auth | Session / JWT | AÇIK | KRİTİK | [13](./13-gate1-core-system-architecture.md) |
| G1-2 | Gate 1 | Monorepo | npm / pnpm | AÇIK | YÜKSEK | [13](./13-gate1-core-system-architecture.md) |

**Özet sayım (19.05.2026):** ~**48** karar satırı · **1 FROZEN** · **~22 ÖNERİLDİ** · **~19 AÇIK** · **1 İNCELEMEDE** (HR-TST) · **2** öneri net (H2, H3)

---

## 15. Kabul kriterleri (bu belge)

- [ ] Tüm açık kararlar §14 master tabloda toplandı
- [ ] Her kararın **kaynak belgesi** belirtildi
- [ ] Her kararın **durumu** yazıldı
- [ ] Her kararın **önerilen yönü** yazıldı (AÇIK olanlar hariç — açıkça “—”)
- [ ] Gate 0 PASS için kritik kararlar §12’de ayrıldı
- [ ] Gate bazlı kapanacak kararlar §13’te ayrıldı
- [ ] [00-gate0-checklist.md](./00-gate0-checklist.md) bu belgeye linklendi
- [ ] [00-gate0-required-documents.md](./00-gate0-required-documents.md) “açık karar boş satır yok” maddesi bu tabloyla doğrulanabilir
- [ ] **Durum: FROZEN yapılmadan** Gate 0 PASS verilmeyecek (bu belge referans kalır; PASS = kritik kararların KAPANDI olması)

---

## 16. Belge durumu

**Durum: TASLAK / İNCELEME** — Bu belge **FROZEN yapılmayacak**; kararlar kapatıldıkça güncellenir.

**Sonraki önerilen adım:**

1. HR-TST fixture onayı → **KAPANDI** ([fixtures/hr-wage-vectors.json](./fixtures/hr-wage-vectors.json), [hr-attendance-vectors.json](./fixtures/hr-attendance-vectors.json))
2. [00-gate0-checklist.md](./00-gate0-checklist.md) PASS değerlendirmesi — §12 kritik kararların **KAPANDI** işaretlenmesi
3. V2C1 / V2C3 / V2C4 kapatma (test verisi, paralel UAT, demo seed)
