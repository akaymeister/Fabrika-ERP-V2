# Gate 0 — Master Blueprint Freeze Checklist

**Otorite doküman:** [`../FactoryOS-V3-Gate-Kabul-Kriterleri.md`](../FactoryOS-V3-Gate-Kabul-Kriterleri.md)

**Durum:** ☐ TASLAK | ☐ İNCELEMEDE | ☐ FROZEN  
**Versiyon:** 0.1.0  
**Son güncelleme:** 19.05.2026

**Proje kuralı:** FactoryOS V3, Fabrika ERP V2 içine yazılmaz; Gate 0 tam PASS sonrası ayrı repo. V2 yalnızca referans.

**İlgili Gate 0 belgeleri:**

| Belge | Amaç |
|-------|------|
| [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) | UI görsel yön ☑ FROZEN |
| [00-gate0-required-documents.md](./00-gate0-required-documents.md) | PASS öncesi zorunlu liste |
| [00-gate0-remaining-spec-checklist.md](./00-gate0-remaining-spec-checklist.md) | Kalan iş takibi |
| [00-gate0-open-decisions.md](./00-gate0-open-decisions.md) | Açık kararlar konsolide (~48 karar) |
| [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md) | Gate 1 hedef taslak (kod yok) |

---

## A. Zorunlu spec dosyaları

- [x] `00-ui-design-direction-freeze.md` — **FROZEN** (görsel yön only)
- [ ] `01-central-ui-design-system.md` — FROZEN (bileşen API + responsive; görsel → 00-ui)
- [ ] `02-admin-control-system.md` — FROZEN (içerik taslak tamam — inceleme)
- [ ] `03-migration-module-registry.md` — FROZEN (içerik taslak tamam — inceleme)
- [ ] `01-permission-role-position-blueprint.md` + `04-permission-system.md` — FROZEN (detay: 01)
- [ ] `05-country-currency-language.md` — FROZEN (içerik taslak tamam — inceleme)
- [ ] `06-hr-full-blueprint.md` — FROZEN (taslak tamam; **H1 önerilen C+B**; resmi onay + vektörler bekliyor)
- [ ] `07-stock-full-blueprint.md` — FROZEN (taslak tamam — inceleme)
- [ ] `08-purchasing-full-blueprint.md` — FROZEN (taslak tamam — inceleme)
- [ ] `09-finance-data-contract.md` — FROZEN (taslak tamam; F1–F6 önerildi)
- [ ] `10-integration-map.md` — FROZEN (taslak tamam — inceleme)
- [ ] `11-v2-carry-and-drop.md` — FROZEN (taslak tamam — inceleme)
- [ ] `12-modal-flow-inventory.md` — FROZEN (taslak tamam — inceleme) (≥20 kayıt)
- [ ] `00-gate0-open-decisions.md` — konsolide tablo (TASLAK; FROZEN değil)
- [ ] `v2-reference-index.md` — genişletildi (v2.0 — inceleme)
- [ ] Kritik açık kararlar kapatıldı — bkz. [00-gate0-open-decisions.md](./00-gate0-open-decisions.md) §12
- [ ] HR-TST fixture dosyaları — [fixtures/hr-wage-vectors.json](./fixtures/hr-wage-vectors.json), [hr-attendance-vectors.json](./fixtures/hr-attendance-vectors.json) (İNCELEMEDE)

## B. Mimari kararlar (çelişki taraması)

- [ ] `cost_uzs_per_m2` hiçbir spec’te hedef kolon değil
- [ ] `SYSTEM` currency alias V3’te yok
- [ ] USD kayıtlar otomatik `local_currency`’ye dönüşmez (tüm spec’lerde aynı)
- [ ] Mal kabul **buyer_state=completed gerektirmez** (08 numaralı spec’te onaylı)
- [ ] `pending_cost` / unpriced akışı tanımlı (08)
- [ ] Warehouse-based balances zorunlu (07)
- [ ] Product categories tanımlı (07)
- [ ] Finance resmi muhasebe değildir (09)

## C. Dokümantasyon testleri (G0)

- [ ] G0-T1 Spec completeness — tüm dosyalar dolu (bkz. [00-gate0-required-documents.md](./00-gate0-required-documents.md))
- [ ] G0-T2 Cross-spec currency tutarlılığı
- [ ] G0-T3 Modal inventory ↔ V2 sayfa eşlemesi
- [ ] G0-T4 Taşınmayacaklar audit
- [x] G0-T6 UI design freeze — mockup + [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md)

## D. Onay

| Rol | İsim | Tarih | İmza |
|-----|------|-------|------|
| Proje lideri | | | |
| Backend lead | | | |
| Frontend lead | | | |
| Domain (HR/Stock/Purch) | | | |

**Gate 0 sonucu:** ☐ PASS → Gate 1 başlayabilir | ☐ FAIL
