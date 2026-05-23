# FactoryOS V3 — Dokümantasyon

**Resmi ürün adı:** FactoryOS V3  
**Referans sistem:** Fabrika ERP V2 (`f:\Fabrika-ERP-V2`) — çalışan iş kuralları, UAT ve akış incelemesi  
**Önemli:** FactoryOS V3, V2 repo’sunun **içine yazılmaz**. Gate 0 tam PASS sonrası **ayrı proje** olarak başlar.

---

## Proje başlangıç kuralları (özet)

| Kural | Açıklama |
|-------|----------|
| İsim | FactoryOS V3 |
| V2 rolü | Referans only — kod/patch/style kopyalanmaz |
| Gate 0 | Tüm spec’ler FROZEN olmadan PASS sayılmaz |
| UI görsel | ☑ Kilitli — [v3-spec/00-ui-design-direction-freeze.md](./v3-spec/00-ui-design-direction-freeze.md) |
| Gate 1 kod | Gate 0 PASS + ayrı repo (`FactoryOS-V3` önerilen) |
| Modül kodu | HR, Stok, Satınalma, Finans — Gate 0’da **yok** |

**Onaylı UI mockup (Gate 1 referans):**

- [mockups/factoryos-v3-home-preview.html](./mockups/factoryos-v3-home-preview.html)
- [mockups/factoryos-v3-design-preview.html](./mockups/factoryos-v3-design-preview.html)
- [mockups/factoryos-v3-admin-preview.html](./mockups/factoryos-v3-admin-preview.html)

---

## Gate 0 belgeleri (yeni)

| Belge | Açıklama |
|-------|----------|
| [v3-spec/00-ui-design-direction-freeze.md](./v3-spec/00-ui-design-direction-freeze.md) | UI görsel yön FROZEN |
| [v3-spec/00-gate0-required-documents.md](./v3-spec/00-gate0-required-documents.md) | PASS öncesi zorunlu liste |
| [v3-spec/00-gate0-remaining-spec-checklist.md](./v3-spec/00-gate0-remaining-spec-checklist.md) | Kalan spec takibi |
| [v3-spec/00-gate0-checklist.md](./v3-spec/00-gate0-checklist.md) | Master checklist |
| [v3-spec/13-gate1-core-system-architecture.md](./v3-spec/13-gate1-core-system-architecture.md) | Gate 1 hedef mimari taslak |

Tüm spec şablonları: [v3-spec/](./v3-spec/)

---

## Otorite dokümanlar

| Dosya | Açıklama |
|-------|----------|
| [FactoryOS-V3-Gate-Kabul-Kriterleri.md](./FactoryOS-V3-Gate-Kabul-Kriterleri.md) | Gate 0–5 kabul kriterleri |
| [FactoryOS-V3-Gate-Blueprint.md](./FactoryOS-V3-Gate-Blueprint.md) | Gate özeti |
| [FactoryOS-V3-Master-Blueprint.md](./FactoryOS-V3-Master-Blueprint.md) | Master blueprint |

---

## Dışa aktarma (PDF / DOCX)

```powershell
python f:\Fabrika-ERP-V2\docs\export-blueprint.py
```

---

## Yeni repo (Gate 1 — Gate 0 PASS sonrası)

| Öğe | Önerilen ad |
|-----|-------------|
| Klasör | `f:\FactoryOS-V3` |
| Git repo | `FactoryOS-V3` |
| npm package | `factoryos-v3` |
| Veritabanı | `factoryos_v3` |
| UI paket | `@factoryos/ui` |
| API port (dev) | `3001` |
