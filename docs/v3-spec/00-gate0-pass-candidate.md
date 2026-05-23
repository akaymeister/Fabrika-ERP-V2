# FactoryOS V3 — Gate 0 PASS Adayı Kapanış Kaydı

**Belge türü:** Gate 0 kapanış / geçiş kaydı  
**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026  
**Gate 0 durumu:** ☑ **PASS ADAYI** · ☐ USER FINAL APPROVAL PENDING  
**Nihai FROZEN:** ☐ **Henüz verilmedi** — kullanıcı onayı bekleniyor

**Önemli:** Bu belge Gate 0’ın **PASS adayı** olduğunu kaydeder. Spec dosyalarının başlığında **FROZEN** yazılmaz; nihai dondurma kullanıcı onayı sonrası işlenir.

**İlgili:** [00-gate0-checklist.md](./00-gate0-checklist.md) · [00-factoryos-v3-repo-bootstrap.md](./00-factoryos-v3-repo-bootstrap.md) · [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md)

---

## 1. Özet kararlar (KAPSAM 1)

| # | Karar | Gate 0 durumu | Not |
|---|--------|----------------|-----|
| 1 | Gate 0 artık **PASS adayıdır** | ☑ KABUL | Nihai PASS = kullanıcı imzası |
| 2 | UI yönü **FROZEN** kabul edilir | ☑ KABUL | Yalnız [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) resmi FROZEN |
| 3 | Admin / permission / registry yaklaşımı | ☑ KABUL | [02](./02-admin-control-system.md), [03](./03-migration-module-registry.md), [01-permission](./01-permission-role-position-blueprint.md) / [04](./04-permission-system.md) |
| 4 | Country / currency / language **C1–C4** | ☑ KABUL | [05-country-currency-language.md](./05-country-currency-language.md) v1.1.0 |
| 5 | HR, Stock, Purchasing blueprintleri | ☑ KABUL | Gate 0 kapsamı **yeterli**; detay modül gate’inde |
| 6 | Finance modül tanımı | ☑ KABUL | **Finans Kontrol / Operational Finance Control** — resmi muhasebe değil |
| 7 | Modül detay kodu | ☑ KABUL | Bu aşamada **yazılmaz**; her modül kendi kurulum Gate’inde |
| 8 | V2 konumu | ☑ KABUL | Referans / UAT / iş kuralı; **UI/CSS/patch debt taşınmaz** |

---

## 2. PASS adayı kabul edilen spec’ler

Aşağıdaki belgeler **Gate 0 kapsamında yeterli** kabul edilmiştir. Durumları **İNCELEME / Gate 0 KABUL** olabilir; **FROZEN değildir**.

| Alan | Belge | Versiyon (özet) | Gate 0 |
|------|--------|-----------------|--------|
| UI görsel yön | [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) | — | ☑ **FROZEN** (tek istisna) |
| UI design system | [01-central-ui-design-system.md](./01-central-ui-design-system.md) | v0.2.0 | ☑ KABUL (PASS adayı) |
| Admin | [02-admin-control-system.md](./02-admin-control-system.md) | — | ☑ KABUL |
| Registry / migration | [03-migration-module-registry.md](./03-migration-module-registry.md) | v0.2.0 | ☑ KABUL |
| Permission | [01-permission](./01-permission-role-position-blueprint.md) + [04](./04-permission-system.md) | — | ☑ KABUL |
| Para / dil | [05-country-currency-language.md](./05-country-currency-language.md) | v1.1.0 (C1–C4) | ☑ KABUL |
| HR | [06-hr-full-blueprint.md](./06-hr-full-blueprint.md) | v2.0.0 | ☑ KABUL |
| Stok | [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) | v0.3.0 | ☑ KABUL |
| Satınalma | [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) | v2.0.0 | ☑ KABUL |
| Finans | [09-finance-operational-control-blueprint.md](./09-finance-operational-control-blueprint.md) + [09-finance-data-contract.md](./09-finance-data-contract.md) | v1.2.0 / v1.2.0 | ☑ KABUL |
| Entegrasyon | [10-integration-map.md](./10-integration-map.md) | — | ☑ KABUL (PASS adayı) |
| V2 carry/drop | [11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md) | — | ☑ KABUL |
| Modal envanter | [12-modal-flow-inventory.md](./12-modal-flow-inventory.md) | 70+ flow | ☑ KABUL |

**Platform testleri (dokümantasyon):** G0-T1…G0-T4 PASS adayı olarak işaretlendi — bkz. [00-gate0-checklist.md](./00-gate0-checklist.md) §C.

---

## 3. Finance modül resmi tanımı (Gate 0)

| Alan | Değer |
|------|--------|
| Modül adı (TR) | **Finans Kontrol** |
| Modül adı (EN) | **Operational Finance Control** |
| Otorite belge | [09-finance-operational-control-blueprint.md](./09-finance-operational-control-blueprint.md) |
| Veri sözleşmesi | [09-finance-data-contract.md](./09-finance-data-contract.md) |
| UI mockup (referans) | [mockups/factoryos-v3-finance-dashboard-preview.html](./mockups/factoryos-v3-finance-dashboard-preview.html) |

**Tanım:** Resmi muhasebe defteri değildir. Operasyonel kasa, banka, kart, nakit, gayri resmi kasa, avans, ödeme onayı, proje gideri, genel gider ve kur kontrol modülüdür.

---

## 4. V2 ve V3 ayrımı

| İlke | Detay |
|------|--------|
| V2 repo | `Fabrika-ERP-V2` — referans, UAT, iş kuralı kaynağı |
| V3 repo | `FactoryOS-V3` — ayrı proje; bkz. [00-factoryos-v3-repo-bootstrap.md](./00-factoryos-v3-repo-bootstrap.md) |
| Taşınmaz | V2 `style.css`, patch borcu, eski HTML/JS toplu kopya |
| Taşınır (kavramsal) | Onaylı iş kuralları, FIFO, permission isimleri, modal akış referansı |

---

## 5. Modül detayları — sonraki gate’ler

| Modül | Gate 0 | Detay implementasyon |
|-------|--------|----------------------|
| Core (admin, registry, auth, UI shell) | KABUL | **Gate 1** |
| HR | KABUL | **Gate 2** |
| Stock | KABUL | **Gate 3** |
| Purchasing | KABUL | **Gate 4** |
| Finance | KABUL | **Gate 5** |

Gate 0 bu belgelerde **kod, migration, API, seed yazılmaz**.

---

## 6. USER FINAL APPROVAL — beklenen adımlar

Kullanıcı nihai onay verdiğinde:

1. [00-gate0-checklist.md](./00-gate0-checklist.md) → **Gate 0: PASS** (FROZEN işaretleri ayrı süreç)
2. İlgili spec başlıklarında `Durum: FROZEN` (kullanıcı talimatıyla, tek tek veya toplu)
3. `FactoryOS-V3` repo ilk commit (docs + iskelet) — bkz. bootstrap belgesi
4. **Gate 1** core skeleton — [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md)

**Şu an yapılmayan:** Spec’lere otomatik FROZEN yazma.

---

## 7. Onay tablosu (PASS adayı → nihai PASS)

| Rol | PASS adayı (19.05.2026) | Nihai PASS | Tarih |
|-----|-------------------------|------------|-------|
| Proje lideri | ☐ | ☐ | |
| Backend lead | ☐ | ☐ | |
| Frontend lead | ☐ | ☐ | |
| Domain (HR/Stock/Purch/Fin) | ☐ | ☐ | |

**Gate 0 sonucu (şu an):** ☑ **PASS ADAYI** · ☐ FAIL · ☐ Nihai PASS (kullanıcı onayı bekleniyor)
