# Gate 0 — Master Blueprint Freeze Checklist

**Otorite doküman:** [`../FactoryOS-V3-Gate-Kabul-Kriterleri.md`](../FactoryOS-V3-Gate-Kabul-Kriterleri.md)

**Gate 0 durumu:** ☑ **PASS ADAYI** · ☐ **USER FINAL APPROVAL PENDING** · ☐ Nihai PASS  
**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026

**Proje kuralı:** FactoryOS V3, Fabrika ERP V2 içine yazılmaz; Gate 0 nihai PASS sonrası ayrı repo. V2 yalnızca referans.

**Kapanış kaydı:** [00-gate0-pass-candidate.md](./00-gate0-pass-candidate.md)  
**V3 repo hazırlığı:** [00-factoryos-v3-repo-bootstrap.md](./00-factoryos-v3-repo-bootstrap.md)

> **FROZEN uyarısı:** Domain spec’ler (01–12) bu aşamada **FROZEN yazılmadı**. Yalnız UI görsel yön belgesi resmi FROZEN’dur. Nihai FROZEN kullanıcı onayı ile işlenir.

**İlgili Gate 0 belgeleri:**

| Belge | Amaç |
|-------|------|
| [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) | UI görsel yön ☑ FROZEN |
| [00-gate0-pass-candidate.md](./00-gate0-pass-candidate.md) | PASS adayı kapanış kararları |
| [00-gate0-required-documents.md](./00-gate0-required-documents.md) | PASS öncesi zorunlu liste |
| [00-gate0-remaining-spec-checklist.md](./00-gate0-remaining-spec-checklist.md) | Kalan iş takibi |
| [00-gate0-open-decisions.md](./00-gate0-open-decisions.md) | Açık kararlar konsolide |
| [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md) | Gate 1 hedef taslak (kod yok) |

---

## A. Zorunlu spec dosyaları

**Açıklama:** ☑ **Gate 0 KABUL (PASS adayı)** = içerik Gate 0 için yeterli; **FROZEN değil**.

- [x] `00-ui-design-direction-freeze.md` — **FROZEN** (görsel yön only)
- [x] `01-central-ui-design-system.md` — Gate 0 KABUL (PASS adayı); FROZEN bekliyor
- [x] `02-admin-control-system.md` — Gate 0 KABUL (PASS adayı)
- [x] `03-migration-module-registry.md` — Gate 0 KABUL (PASS adayı)
- [x] `01-permission-role-position-blueprint.md` + `04-permission-system.md` — Gate 0 KABUL (PASS adayı)
- [x] `05-country-currency-language.md` — Gate 0 KABUL — **C1–C4** kapatıldı
- [x] `06-hr-full-blueprint.md` — Gate 0 KABUL (yeterli kapsam; detay Gate 2)
- [x] `07-stock-full-blueprint.md` — Gate 0 KABUL (yeterli kapsam; detay Gate 3)
- [x] `08-purchasing-full-blueprint.md` — Gate 0 KABUL (yeterli kapsam; detay Gate 4)
- [x] `09-finance-operational-control-blueprint.md` + `09-finance-data-contract.md` — Gate 0 KABUL; **Finans Kontrol** tanımı
- [x] `10-integration-map.md` — Gate 0 KABUL (PASS adayı)
- [x] `11-v2-carry-and-drop.md` — Gate 0 KABUL (PASS adayı)
- [x] `12-modal-flow-inventory.md` — Gate 0 KABUL (70+ flow)
- [x] `00-gate0-open-decisions.md` — konsolide tablo (referans; FROZEN değil)
- [x] `v2-reference-index.md` — Gate 0 KABUL (v2.0)
- [x] Kritik Gate 0 kararları — bkz. [00-gate0-pass-candidate.md](./00-gate0-pass-candidate.md) §1
- [ ] HR-TST fixture dosyaları — [fixtures/hr-wage-vectors.json](./fixtures/hr-wage-vectors.json), [hr-attendance-vectors.json](./fixtures/hr-attendance-vectors.json) (İNCELEMEDE; PASS adayı için bloklayıcı değil)

**Domain spec FROZEN onayı (kullanıcı):** ☐ 01 ☐ 02 ☐ 03 ☐ 04 ☐ 05 ☐ 06 ☐ 07 ☐ 08 ☐ 09 ☐ 10 ☐ 11 ☐ 12

---

## B. Mimari kararlar (çelişki taraması)

- [x] `cost_uzs_per_m2` hiçbir spec’te hedef kolon değil
- [x] `SYSTEM` currency alias V3’te yok
- [x] USD kayıtlar otomatik `local_currency`’ye dönüşmez
- [x] Mal kabul **buyer_state=completed gerektirmez** (08)
- [x] `pending_cost` / unpriced akışı tanımlı (08)
- [x] Warehouse-based balances zorunlu (07)
- [x] Product categories tanımlı (07)
- [x] Finance resmi muhasebe değildir — **Finans Kontrol / Operational Finance Control** (09)

---

## C. Dokümantasyon testleri (G0)

- [x] G0-T1 Spec completeness — tüm zorunlu dosyalar dolu ([00-gate0-required-documents.md](./00-gate0-required-documents.md))
- [x] G0-T2 Cross-spec currency tutarlılığı (C1–C4, 05 + 09)
- [x] G0-T3 Modal inventory ↔ V2 sayfa eşlemesi (12)
- [x] G0-T4 Taşınmayacaklar audit (11)
- [x] G0-T6 UI design freeze — mockup + [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md)

---

## D. Onay

| Rol | PASS adayı | Nihai PASS | Tarih |
|-----|--------------|------------|-------|
| Proje lideri | ☐ | ☐ | |
| Backend lead | ☐ | ☐ | |
| Frontend lead | ☐ | ☐ | |
| Domain (HR/Stock/Purch/Fin) | ☐ | ☐ | |

**Gate 0 sonucu (19.05.2026):**

| Sonuç | Durum |
|-------|--------|
| **PASS ADAYI** | ☑ |
| USER FINAL APPROVAL PENDING | ☑ (aktif) |
| Nihai PASS → Gate 1 başlayabilir | ☐ |
| FAIL | ☐ |

**Sonraki adım:** Kullanıcı nihai onayı → [00-factoryos-v3-repo-bootstrap.md](./00-factoryos-v3-repo-bootstrap.md) → Gate 1 core skeleton
