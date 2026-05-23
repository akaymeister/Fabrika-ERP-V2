# Gate 0 — PASS Öncesi Tamamlanması Gereken Dokümanlar

**Ürün:** FactoryOS V3  
**Otorite:** [`../FactoryOS-V3-Gate-Kabul-Kriterleri.md`](../FactoryOS-V3-Gate-Kabul-Kriterleri.md)  
**Durum:** Gate 0 ☐ PASS | Gate 1 kod ☐ başlamadı  
**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026

---

## 1. Amaç

Gate 0 **tam PASS** olmadan:

- FactoryOS V3 **üretim kodu** yazılmaz.
- Ayrı repo/klasör (`FactoryOS-V3`) **açılmaz** (önerilen başlangıç noktası).
- HR, Stok, Satınalma, Finans modül kodu **yazılmaz**.

Bu liste, PASS için **zorunlu tüm dokümanları** ve mevcut tamamlanma durumunu tanımlar.

---

## 2. Özet durum (19.05.2026)

| Kategori | Toplam | FROZEN | Kısmi | TASLAK |
|----------|--------|--------|-------|--------|
| Görsel UI yönü | 1 | 1 | 0 | 0 |
| Gate 0 yönetim belgeleri | 4 | 0 | 4 | 0 |
| Domain / mimari spec (01–12) | 13 | 0 | 1 | 12 |
| **Toplam zorunlu** | **18** | **1** | **5** | **12** |

**Kısmi:** UI görsel freeze tamam; ilgili spec dosyasında API/checklist eksikleri var.

---

## 3. Zorunlu belge listesi

### A. Proje kuralları ve freeze (yönetim)

| # | Belge | Dosya | PASS için | Durum |
|---|--------|-------|-----------|--------|
| A1 | UI Design Direction Freeze | [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) | ☑ FROZEN | ☑ Tamam |
| A2 | Gate 0 master checklist | [00-gate0-checklist.md](./00-gate0-checklist.md) | Tüm maddeler işaretli | ☐ Devam |
| A3 | Kalan spec checklist (takip) | [00-gate0-remaining-spec-checklist.md](./00-gate0-remaining-spec-checklist.md) | Güncel tutulur | ☑ Oluşturuldu |
| A4 | Bu liste (zorunlu dokümanlar) | [00-gate0-required-documents.md](./00-gate0-required-documents.md) | Onaylı | ☑ Tamam |
| A5 | Gate 1 mimari taslak (referans) | [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md) | Gate 0’da okunur; Gate 1’de uygulanır | ☑ Taslak |

### B. Merkezi platform spec’leri

| # | Belge | Dosya | Sorumlu | Durum |
|---|--------|-------|---------|--------|
| B1 | Central UI Design System | [01-central-ui-design-system.md](./01-central-ui-design-system.md) | Frontend | ☐ Görsel ☑ / API ☐ |
| B2 | Admin Control System | [02-admin-control-system.md](./02-admin-control-system.md) | Backend + Admin | ☐ Taslak tamam — FROZEN bekliyor |
| B3 | Migration & Module Registry | [03-migration-module-registry.md](./03-migration-module-registry.md) | Backend / DBA | ☐ Taslak tamam — FROZEN bekliyor |
| B4 | Permission System | [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) (detay) · [04](./04-permission-system.md) (özet) | Backend | ☐ Taslak tamam — FROZEN bekliyor |
| B5 | Country / Currency / Language | [05-country-currency-language.md](./05-country-currency-language.md) | Backend + Ürün | ☐ Taslak tamam — FROZEN bekliyor |

### C. Domain spec’leri

| # | Belge | Dosya | Sorumlu | Durum |
|---|--------|-------|---------|--------|
| C1 | HR Full Blueprint | [06-hr-full-blueprint.md](./06-hr-full-blueprint.md) | HR domain | ☐ Taslak tamam — FROZEN bekliyor |
| C2 | Stock Full Blueprint | [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) | Stock domain | ☐ Taslak tamam — FROZEN bekliyor |
| C3 | Purchasing Full Blueprint | [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) | Purchasing | ☐ Taslak tamam — FROZEN bekliyor |
| C4 | Finance Data Contract | [09-finance-data-contract.md](./09-finance-data-contract.md) | Finance | ☐ Taslak tamam — FROZEN bekliyor |

### D. Entegrasyon ve V2 geçiş

| # | Belge | Dosya | Sorumlu | Durum |
|---|--------|-------|---------|--------|
| D1 | Integration Map | [10-integration-map.md](./10-integration-map.md) | Mimari | ☐ Taslak tamam — FROZEN bekliyor |
| D2 | V2 Carry & Drop | [11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md) | Tüm ekip | ☐ Taslak tamam — FROZEN bekliyor |
| D3 | Modal Flow Inventory | [12-modal-flow-inventory.md](./12-modal-flow-inventory.md) | UX + Modül | ☐ Taslak tamam (70+ flow) — FROZEN bekliyor |
| D4 | V2 Reference Index | [v2-reference-index.md](./v2-reference-index.md) | Tüm ekip | ☐ v2.0 genişletildi — inceleme |

### D2. Gate 0 kapanış

| # | Belge | Dosya | Not |
|---|--------|-------|-----|
| D0 | Açık kararlar konsolide | [00-gate0-open-decisions.md](./00-gate0-open-decisions.md) | TASLAK; FROZEN değil; ~48 karar |
| D0b | HR test fixtures | [fixtures/hr-wage-vectors.json](./fixtures/hr-wage-vectors.json), [hr-attendance-vectors.json](./fixtures/hr-attendance-vectors.json) | 20+20 — HR-TST İNCELEMEDE |

### E. Üst seviye otorite (mevcut)

| # | Belge | Dosya | Not |
|---|--------|-------|-----|
| E1 | Gate kabul kriterleri | [../FactoryOS-V3-Gate-Kabul-Kriterleri.md](../FactoryOS-V3-Gate-Kabul-Kriterleri.md) | Gate 0–5 |
| E2 | Gate blueprint | [../FactoryOS-V3-Gate-Blueprint.md](../FactoryOS-V3-Gate-Blueprint.md) | Özet mimari |
| E3 | Mockup (UI referans) | [../mockups/](../mockups/) | HTML — görsel FROZEN |

---

## 4. Her spec için “FROZEN” tanımı

Bir dosya **FROZEN** sayılmak için:

- [ ] Başlıkta `Durum: FROZEN` işaretli
- [ ] Açık kararlar tablosunda boş satır yok (karar verilmiş veya “V3 kapsam dışı” yazılmış) — konsolide: [00-gate0-open-decisions.md](./00-gate0-open-decisions.md) §14
- [ ] Kabul kriterleri maddeleri doldurulmuş
- [ ] V2 referans dosya yolları doğrulanmış
- [ ] Çapraz spec çelişki taramasından geçmiş (G0-T2)
- [ ] İlgili sorumlu onay satırı imzalı

---

## 5. Gate 0 dokümantasyon testleri (PASS öncesi)

| ID | Test | Kanıt |
|----|------|-------|
| G0-T1 | Spec completeness | Bu listedeki B–D tamamı FROZEN |
| G0-T2 | Currency tutarlılığı | 05, 06, 07, 08, 09 aynı USD/local kuralı |
| G0-T3 | Modal ↔ V2 eşlemesi | 12 numaralı dosyada ≥20 kayıt |
| G0-T4 | Taşınmayacaklar | 11 + 07: `cost_uzs_per_m2` hedef değil |
| G0-T5 | GR kuralı | 08: mal kabul `buyer_state=completed` zorunlu değil |
| G0-T6 | UI freeze | 00-ui-design-direction-freeze ☑ + mockup’lar mevcut |

---

## 6. Gate 0 PASS sonrası izin verilenler

| İzin | Açıklama |
|------|----------|
| `FactoryOS-V3` repo açılması | Temiz proje kökü |
| Gate 1 kod | Core only: UI paketi, admin, migration, permission, config |
| V2 inceleme | Referans olarak okuma; kopyalama yok |

## 7. Gate 0 PASS olmadan yasaklar

| Yasak |
|-------|
| HR / Stok / Satınalma / Finans modül kodu |
| V2 `style.css` veya `frontend/public` toplu taşıma |
| V2 patch veya servis dosyalarının birebir kopyası |
| Gate 1 dışında modül migration SQL’i |
| “Hızlı demo” modülü üretim branch’ine merge |

---

## 8. Onay kaydı (Gate 0 PASS)

| Alan | Değer |
|------|--------|
| Blueprint versiyon | v0.1.0 → v1.0.0 (PASS anında) |
| PASS tarihi | _______________ |
| Onaylayan | _______________ |
| Sonraki adım | Gate 1 — bkz. [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md) |

**Gate 0 sonucu:** ☐ PASS | ☐ FAIL
