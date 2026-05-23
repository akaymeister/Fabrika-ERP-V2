# FactoryOS V3

**Durum:** Proje iskeleti — Gate 0 PASS adayı; **henüz üretim kodu yok**

FactoryOS V3, Fabrika ERP V2’den **ayrı** bir ürün kod tabanıdır. V2 yalnızca referans, UAT ve iş kuralı kaynağıdır; V2 UI/CSS/patch borcu taşınmaz.

## Gate durumu

| Gate | Durum |
|------|--------|
| Gate 0 (Master Blueprint) | PASS adayı — kullanıcı nihai onayı bekleniyor |
| Gate 1 (Core skeleton) | Başlamadı |

Spec belgeleri (güncel çalışma kopyası): `Fabrika-ERP-V2/docs/v3-spec/`  
Gate 0 kapanış: `docs/v3-spec/00-gate0-pass-candidate.md` (PASS sonrası buraya kopyalanır)

## Klasör yapısı (hedef)

```text
FactoryOS-V3/
├── docs/v3-spec/
├── frontend/
├── backend/
├── database/
├── scripts/
├── README.md
└── .env.example
```

## İlk commit (plan)

1. Bu iskelet + `.env.example` + `.gitignore`
2. `docs/v3-spec/**` — Gate 0 nihai PASS anındaki snapshot
3. **Dahil değil:** V2 kodu, migration, node_modules, domain modül kodu

## Dokümantasyon

- [Gate 0 checklist](../docs/v3-spec/00-gate0-checklist.md)
- [Repo bootstrap](../docs/v3-spec/00-factoryos-v3-repo-bootstrap.md)
- [Gate 1 mimari taslak](../docs/v3-spec/13-gate1-core-system-architecture.md)

## Yasak (Gate 0 / PASS öncesi)

- HR, Stock, Purchasing, Finance iş mantığı kodu
- V2 `frontend/public` veya `backend/` toplu kopya
- Package kurulumu (Gate 1 planına kadar opsiyonel)
