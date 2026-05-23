# Gate 0 — Kalan Spec Checklist (Takip)

**Ürün:** FactoryOS V3  
**Amaç:** Gate 0 PASS öncesi hangi spec’lerin eksik olduğunu tek sayfada takip  
**Güncelleme:** Her spec FROZEN olduğunda bu dosya ve [00-gate0-checklist.md](./00-gate0-checklist.md) güncellenir.  
**Son durum:** 19.05.2026

---

## Özet

| Metrik | Değer |
|--------|--------|
| UI görsel yön | ☑ **FROZEN** |
| Gate 0 genel | ☐ **DEVAM EDİYOR** |
| FROZEN spec sayısı (01–12) | 0 / 12 |
| Gate 1 kod | ☐ Yasak (Gate 0 PASS bekleniyor) |

---

## Tamamlanan (Gate 0 kısmi)

| Belge | Durum | Not |
|-------|--------|-----|
| [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) | ☑ FROZEN | Mockup 3 dosya + tokenlar |
| [../mockups/factoryos-v3-home-preview.html](../mockups/factoryos-v3-home-preview.html) | ☑ Referans | Ana sayfa |
| [../mockups/factoryos-v3-design-preview.html](../mockups/factoryos-v3-design-preview.html) | ☑ Referans | Stok örneği |
| [../mockups/factoryos-v3-admin-preview.html](../mockups/factoryos-v3-admin-preview.html) | ☑ Referans | Yönetim |
| [00-gate0-required-documents.md](./00-gate0-required-documents.md) | ☑ Liste | Zorunlu doküman envanteri |
| [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md) | ☑ Taslak | Gate 1 hedef; kod yok |

---

## Kalan spec’ler (sıra önerisi)

### Öncelik 1 — Platform (Gate 1 önkoşulu)

| Dosya | Başlık | Eksik başlıca alanlar | Sorumlu | Hedef |
|-------|--------|------------------------|---------|-------|
| [01](./01-central-ui-design-system.md) | Central UI | Bileşen props örnekleri, responsive PASS matrisi, sayfa şablonu | Frontend | ☐ |
| [02](./02-admin-control-system.md) | Admin Control | Tam taslak; FROZEN onayı bekliyor | Backend + Admin | ☐ İnceleme |
| [03](./03-migration-module-registry.md) | Migration & Registry | Tam taslak; FROZEN onayı bekliyor | Backend | ☐ İnceleme |
| [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) + [04](./04-permission-system.md) | Permission | Detay blueprint yazıldı; FROZEN onayı bekliyor | Backend | ☐ İnceleme |
| [05](./05-country-currency-language.md) | Para / dil | Tam taslak; FROZEN onayı bekliyor | Ürün + BE | ☐ İnceleme |

### Öncelik 2 — Domain (Gate 2–5 önkoşulu)

| Dosya | Başlık | Kritik kararlar | Sorumlu | Hedef |
|-------|--------|-----------------|---------|-------|
| [06](./06-hr-full-blueprint.md) | HR Full | Tam taslak; **H1 önerilen C+B**; H5 önerildi; FROZEN bekliyor | HR domain | ☐ İnceleme |
| [07](./07-stock-full-blueprint.md) | Stock Full | Tam taslak; P5 önerilen C; FROZEN bekliyor | Stock | ☐ İnceleme |
| [08](./08-purchasing-full-blueprint.md) | Purchasing Full | Tam taslak; 07-stock uyumlu; FROZEN bekliyor | Purchasing | ☐ İnceleme |
| [09](./09-finance-data-contract.md) | Finance Data Contract | Tam taslak; **F1–F6 önerildi**; FROZEN bekliyor | Finance | ☐ İnceleme |

### Öncelik 3 — Çapraz kesen

| Dosya | Başlık | Minimum çıktı | Sorumlu | Hedef |
|-------|--------|---------------|---------|-------|
| [10](./10-integration-map.md) | Integration Map | Tam taslak; port + A–H akış; FROZEN bekliyor | Mimari | ☐ İnceleme |
| [11](./11-v2-carry-and-drop.md) | V2 Carry/Drop | Tam taslak; taşı/ref/bırak; FROZEN bekliyor | Tüm ekip | ☐ İnceleme |
| [12](./12-modal-flow-inventory.md) | Modal Flow Inventory | 70+ flowId; FROZEN bekliyor | UX | ☐ İnceleme |
| [00-gate0-open-decisions](./00-gate0-open-decisions.md) | Açık kararlar konsolide | ~48 karar; §12 kritik PASS | PM | ☐ İnceleme |
| [v2-reference-index](./v2-reference-index.md) | V2 indeks | HR/Stock/Pur/Admin/UI; do-not-port; V2C2 | Tüm ekip | ☐ İnceleme |

---

## Mimari karar doğrulama (tüm spec’lerde tutarlı olmalı)

Gate 0 PASS öncesi [00-gate0-checklist.md](./00-gate0-checklist.md) B bölümü:

- [ ] `cost_uzs_per_m2` hiçbir spec’te hedef kolon değil
- [ ] `SYSTEM` currency alias yok
- [ ] USD → local otomatik dönüşüm yok
- [ ] Mal kabul `buyer_state=completed` zorunlu değil (08)
- [ ] `pending_cost` tanımlı (08)
- [ ] Depo bazlı bakiye zorunlu (07)
- [ ] Ürün kategorileri tanımlı (07)
- [ ] Finans resmi muhasebe değil (09)

---

## Spec başına tamamlanma kontrol listesi

Her `0X-*.md` dosyası için kopyala-yapıştır:

```markdown
- [ ] Durum satırı: FROZEN
- [ ] Tüm tablolar dolduruldu
- [ ] Açık kararlar kapatıldı — [00-gate0-open-decisions.md](./00-gate0-open-decisions.md) §12 kritikler
- [ ] Kabul kriterleri işaretli
- [ ] V2 referans yolları doğrulandı
- [ ] G0-T2 çapraz okuma yapıldı
- [ ] Sorumlu onay tarihi: ____
```

---

## Haftalık / oturum notları

| Tarih | Yapılan | Sonraki |
|-------|---------|---------|
| 19.05.2026 | UI görsel FROZEN; proje başlangıç kuralları belgelendi; Gate 0 yönetim doc’ları oluşturuldu | 01–05 platform spec doldurma |
| 19.05.2026 | Permission blueprint ([01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md)) tam taslak | Migration, currency, admin, integration |
| 19.05.2026 | Migration & Registry blueprint ([03-migration-module-registry.md](./03-migration-module-registry.md)) tam taslak | Currency, admin, integration |
| 19.05.2026 | Country/Currency/Language ([05-country-currency-language.md](./05-country-currency-language.md)) tam taslak | Admin, HR domain |
| 19.05.2026 | Admin Control ([02-admin-control-system.md](./02-admin-control-system.md)) tam taslak | HR Full Blueprint |
| 19.05.2026 | HR Full Blueprint ([06-hr-full-blueprint.md](./06-hr-full-blueprint.md)) tam taslak | Stock Full Blueprint |
| 19.05.2026 | HR v1.1: H1 açık (vardiya analizi); ücret çakışma §11; HT-19…26 | H1 kararı + vektörler |
| 19.05.2026 | HR v1.2: H1 önerilen **C+B**; AttendanceEngine; H5 red+override | H1 resmi onay + vektörler |
| 19.05.2026 | Stock Full Blueprint ([07-stock-full-blueprint.md](./07-stock-full-blueprint.md)) tam taslak | Purchasing Full Blueprint |
| 19.05.2026 | Purchasing Full Blueprint ([08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md)) tam taslak | Finance Data Contract |
| 19.05.2026 | Purchasing v1.1 P1–P6 önerilen; Finance Data Contract tam taslak | Integration Map |
| 19.05.2026 | Finance v1.1 F1–F6 önerilen (invoice/movement, payment direction, …) | Integration Map |
| 19.05.2026 | Integration Map ([10-integration-map.md](./10-integration-map.md)) tam taslak | V2 carry/drop |
| 19.05.2026 | V2 Carry/Drop ([11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md)) tam taslak | Modal flow inventory |
| 19.05.2026 | Modal Flow Inventory ([12-modal-flow-inventory.md](./12-modal-flow-inventory.md)) 70+ flow | Gate 0 kapanış / v2-index |
| 19.05.2026 | Açık kararlar konsolide ([00-gate0-open-decisions.md](./00-gate0-open-decisions.md)) ~48 karar | H1/C1/G1-1 kapatma; v2-index; PASS |
| 19.05.2026 | V2 referans indeks v2.0 ([v2-reference-index.md](./v2-reference-index.md)) genişletildi | HR fixture; PASS |
| 19.05.2026 | HR fixtures 20+20 ([fixtures/](./fixtures/)) | HR-TST onayı; H1; PASS |
| | | |
| | | |

---

## Gate 0 kapanış

Tüm “Kalan spec’ler” tablosu ☐ → ☑ olduğunda:

1. [00-gate0-checklist.md](./00-gate0-checklist.md) — A, B, C, D tamam
2. [00-gate0-required-documents.md](./00-gate0-required-documents.md) — PASS kaydı
3. [../FactoryOS-V3-Gate-Kabul-Kriterleri.md](../FactoryOS-V3-Gate-Kabul-Kriterleri.md) — Gate 0 işaretle

→ **Gate 1 kod** başlayabilir ([13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md)).
