# FactoryOS V3 — Gate 0 Spec Klasörü

**Ürün adı:** FactoryOS V3  
**Referans sistem:** Fabrika ERP V2 (`f:\Fabrika-ERP-V2`) — iş mantığı ve UAT; **kod taşınmaz**  
**Ana doküman (otorite):** [`../FactoryOS-V3-Gate-Kabul-Kriterleri.md`](../FactoryOS-V3-Gate-Kabul-Kriterleri.md)

**Amaç:** Gate 0 (Master Blueprint Freeze) tamamlanmadan üretim kodu yazılmaz.  
**Kural:** Bu klasördeki her dosya doldurulup checklist PASS olmalıdır. **Süre hedefi yok** — yalnızca kabul kriterleri.

**V3 başlangıç:** Gate 0 tam PASS → ayrı repo `FactoryOS-V3` (Gate 1). V2 repo’suna modül eklenmez.

---

## Proje durumu (19.05.2026)

| Alan | Durum |
|------|--------|
| UI görsel yön | ☑ **FROZEN** |
| Gate 0 genel | ☑ **PASS ADAYI** · USER FINAL APPROVAL PENDING |
| Domain spec FROZEN | ☐ Kullanıcı onayı bekleniyor |
| Gate 1 kod | ☐ Yasak (nihai PASS sonrası) |
| V3 iskelet | ☑ [FactoryOS-V3/](../../FactoryOS-V3/) hazırlık (kod yok) |

---

## Gate 0 yönetim belgeleri (önce bunlar)

| # | Dosya | Açıklama | Durum |
|---|--------|----------|--------|
| 0a | [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) | UI görsel yön + mockup referansı | ☑ FROZEN |
| 0b | [00-gate0-required-documents.md](./00-gate0-required-documents.md) | PASS öncesi zorunlu tüm belgeler | ☑ Liste |
| 0c | [00-gate0-remaining-spec-checklist.md](./00-gate0-remaining-spec-checklist.md) | Kalan spec takibi | ☑ Aktif |
| 0d | [00-gate0-checklist.md](./00-gate0-checklist.md) | Master checklist + onay | ☑ PASS adayı |
| 0f | [00-gate0-pass-candidate.md](./00-gate0-pass-candidate.md) | Gate 0 kapanış kararları | ☑ |
| 0g | [00-factoryos-v3-repo-bootstrap.md](./00-factoryos-v3-repo-bootstrap.md) | V3 repo iskelet hazırlığı | ☑ |
| 0e | [00-gate0-open-decisions.md](./00-gate0-open-decisions.md) | Açık kararlar konsolide (~48) | ☐ İnceleme |
| — | [fixtures/](./fixtures/) | HR-TST: wage + attendance vektörleri (20+20) | ☐ İnceleme |
| 13 | [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md) | Gate 1 hedef mimari (kod yok) | ☑ Taslak |

**Onaylı UI mockup:** [`../mockups/`](../mockups/)

---

## Gate 0 spec dosyaları (01–12)

Her madde için ilgili spec **DURUM: FROZEN** olmalı ve sorumlu onayı işlenmelidir.

| # | Spec dosyası | Sorumlu | Durum |
|---|--------------|---------|-------|
| 1 | [01-central-ui-design-system.md](./01-central-ui-design-system.md) | UI / Frontend | ☐ (görsel → 00a) |
| 2 | [02-admin-control-system.md](./02-admin-control-system.md) | Backend + Admin | ☐ Taslak |
| 3 | [03-migration-module-registry.md](./03-migration-module-registry.md) | Backend / DBA | ☐ Taslak |
| 4 | [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) · [04](./04-permission-system.md) | Backend | ☐ Taslak |
| 5 | [05-country-currency-language.md](./05-country-currency-language.md) | Backend + Ürün | ☐ Taslak |
| 6 | [06-hr-full-blueprint.md](./06-hr-full-blueprint.md) | HR domain | ☐ İnceleme |
| 7 | [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) | Stock domain | ☐ İnceleme |
| 8 | [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) | Purchasing domain | ☐ İnceleme |
| 9 | [09-finance-operational-control-blueprint.md](./09-finance-operational-control-blueprint.md) · [09-finance-data-contract.md](./09-finance-data-contract.md) | Finans Kontrol | ☑ Gate 0 KABUL (PASS adayı) |
| 10 | [10-integration-map.md](./10-integration-map.md) | Mimari | ☐ İnceleme |
| 11 | [11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md) | Tüm ekip | ☐ İnceleme |
| 12 | [12-modal-flow-inventory.md](./12-modal-flow-inventory.md) | UX + Modül | ☐ İnceleme |
| — | [v2-reference-index.md](./v2-reference-index.md) | Tüm ekip | ☐ İnceleme (v2.0) |

**Minimum:** modal flow ≥20 · entegrasyon sözleşmesi ≥10

---

## Gate 0 PASS sonrası

| Adım | Belge |
|------|--------|
| Repo aç | `FactoryOS-V3` |
| Gate 1 kod | [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md) |
| Özet | [../FactoryOS-V3-Gate-Blueprint.md](../FactoryOS-V3-Gate-Blueprint.md) |

---

## Şimdilik yasak (Gate 0 bitene kadar)

- HR / Stok / Satınalma / Finans **modül kodu**
- V2 `style.css`, `frontend/public`, patch veya servis **toplu kopya**
- Fabrika ERP V2 repo’suna FactoryOS V3 modülü yazma

---

## Freeze onayı (Gate 0 tam)

| Alan | Değer |
|------|--------|
| Blueprint versiyon | v0.1.0 |
| PASS tarihi | _______________ |
| Onaylayan | _______________ |
