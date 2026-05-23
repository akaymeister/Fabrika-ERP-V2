# FactoryOS V3 — Repo Başlangıç ve İskelet Hazırlığı

**Belge türü:** Gate 0 → Gate 1 geçiş hazırlığı (kod yok)  
**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026  
**Durum:** ☑ Hazırlık dokümante edildi · ☐ Ayrı git repo oluşturuldu · ☐ İlk commit atıldı

**Önkoşul:** Gate 0 **nihai PASS** (kullanıcı onayı) — şu an **PASS ADAYI**.

---

## 1. Amaç

FactoryOS V3, **Fabrika ERP V2 repo’sunun içine yazılmaz**. Gate 0 tamamlandıktan sonra ayrı bir proje olarak başlar:

| Repo | Rol |
|------|-----|
| `Fabrika-ERP-V2` | V2 üretim + **v3-spec referans** (şu an spec’ler burada) |
| `FactoryOS-V3` | V3 üretim kodu (yeni) |

**İlk commit kuralı:** Yalnızca `docs/` + boş proje iskeleti + `README.md` + `.env.example`. **V2 kodu kopyalanmaz.**

---

## 2. Önerilen klasör yapısı

```text
FactoryOS-V3/
├── docs/
│   └── v3-spec/          # Gate 0 spec’lerin kopyası veya submodule (ekip kararı)
├── frontend/             # Gate 1: shell + @factoryos/ui tüketimi
│   └── public/
├── backend/              # Gate 1: API, auth, admin, registry
│   ├── routes/
│   ├── services/
│   └── controllers/
├── database/
│   ├── schema/           # SQL şablonları
│   ├── migrations/       # Gate 1: core_* prefix
│   └── seeds/
├── scripts/              # migrate, seed, backup yardımcıları
├── packages/             # (opsiyonel Gate 1) ui monorepo — bkz. Gate 1 mimari
├── modules/              # manifest.json — modül kayıt
├── README.md
├── .env.example
├── .gitignore
└── package.json          # Gate 1 — şimdilik yok veya placeholder
```

**Gate 0’da oluşturulan iskelet (Fabrika-ERP-V2 içinde hazırlık):** [`../../FactoryOS-V3/README.md`](../../FactoryOS-V3/README.md) — nihai repo taşınırken aynı yapı kullanılır.

---

## 3. İlk commit içeriği (öneri)

| Dahil | Hariç |
|-------|--------|
| `README.md` (proje tanımı, Gate linkleri) | V2 `frontend/public` kopyası |
| `.env.example` (DB adı, port, secret placeholder) | V2 `backend/` servis kopyası |
| `docs/v3-spec/**` (Gate 0 PASS anındaki snapshot) | V2 patch dosyaları |
| Boş `frontend/`, `backend/`, `database/`, `scripts/` (.gitkeep) | `node_modules`, gerçek `.env` |
| `.gitignore` (node, .env, uploads) | HR/Stock/Purch/Finance iş mantığı |

---

## 4. Spec taşıma strateisi

| Seçenek | Artı | Eksi |
|---------|------|------|
| **A — Kopya** | Gate 0 PASS anında snapshot; V2’den bağımsız | İki yerde güncelleme riski (PASS sonrası V3 otorite) |
| **B — Submodule** | Tek kaynak | Submodule operasyon yükü |
| **C — V2’de kalır (geçici)** | Hızlı başlangıç | V3 repo docs eksik kalır |

**Öneri (PASS sonrası):** Seçenek **A** — PASS anında `docs/v3-spec` tam kopya; sonrasında V3 repo spec otoritesi.

Şu an (PASS adayı): Spec’ler `Fabrika-ERP-V2/docs/v3-spec` altında güncellenmeye devam eder.

---

## 5. Ortam değişkenleri (.env.example özeti)

```env
# FactoryOS V3 — örnek (Gate 1 öncesi placeholder)
NODE_ENV=development
PORT=3001

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=factoryos
DB_PASSWORD=change_me
DB_NAME=factoryos_v3

SESSION_SECRET=change_me_long_random
# V2 DB — yalnızca migration/read-only referans (opsiyonel)
# V2_DB_NAME=fabrika_erp_v2
```

---

## 6. V2 referans kullanımı

| Kullanım | İzin |
|----------|------|
| İş kuralı okuma (FIFO, permission isimleri) | ☑ |
| UAT senaryoları | ☑ |
| [v2-reference-index.md](./v2-reference-index.md) | ☑ |
| `style.css` / HTML / patch toplu kopya | ✗ |
| V2 migration’ı V3’e taşıma | ✗ |

---

## 7. Gate 1 başlangıç sırası (özet)

1. Kullanıcı Gate 0 **nihai PASS**
2. `FactoryOS-V3` git repo oluştur (GitHub/GitLab)
3. İlk commit: iskelet + docs snapshot
4. [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md) uygulama planı
5. Core: auth, admin hub, registry, migration runner, permission seed, UI shell

**Gate 1 kapsam dışı:** HR, Stock, Purchasing, Finance domain kodu.

---

## 8. İlgili belgeler

- [00-gate0-pass-candidate.md](./00-gate0-pass-candidate.md)
- [00-gate0-checklist.md](./00-gate0-checklist.md)
- [13-gate1-core-system-architecture.md](./13-gate1-core-system-architecture.md)
- [11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md)
