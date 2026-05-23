# FactoryOS V3 — Finans Kontrol (Operational Finance Control)

**Belge türü:** Gate 0 domain blueprint — operasyonel finans tanımı  
**Modül kodu (öneri):** `finance` · görünen ad: **Finans Kontrol**  
**Durum:** ☑ **Gate 0 KABUL (PASS adayı)** | ☐ FROZEN  
**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026  
**Uygulama gate:** Gate 5 (kod); Gate 0 yalnızca karar ve sözleşme  
**Veri sözleşmesi:** [09-finance-data-contract.md](./09-finance-data-contract.md)  
**UI referans:** [mockups/factoryos-v3-finance-dashboard-preview.html](./mockups/factoryos-v3-finance-dashboard-preview.html)

---

## 1. Modül adı ve tanım

| Alan | Değer |
|------|--------|
| **Modül adı (TR)** | Finans Kontrol |
| **Modül adı (EN)** | Operational Finance Control |
| **Resmi muhasebe mi?** | **Hayır** |

### 1.1 Modül tanımı

Bu modül **resmi muhasebe defteri değildir**. Aşağıdaki operasyonel finans kontrol alanlarını kapsar:

- Operasyonel kasa, banka, kart, nakit hareketleri
- Gayri resmi kasa
- Avans ve avans kasası izleme
- Ödeme onayı ve ödeme yükümlülüğü
- Proje gideri ve genel gider
- Kur kontrolü (snapshot; dashboard bilgi amaçlı)
- Ay operasyonel kapanışı (resmi muhasebe kapanışı değil)

**İleride:** Harici resmi muhasebe entegrasyonu için veri sözleşmesi [09-finance-data-contract.md](./09-finance-data-contract.md) üzerinden kurulabilir; Gate 0’da entegrasyon kodu yoktur.

---

## 2. Satınalma ↔ Finans ayrımı (temel karar)

| # | Karar | Gate 0 |
|---|--------|--------|
| F-G0-01 | Satınalma tamamlanınca **gerçek kasa/banka/kart düşümü oluşmaz** | ☑ KABUL |
| F-G0-02 | Satınalma yalnızca **ödeme yükümlülüğü / ödeme talebi** oluşturur | ☑ KABUL |
| F-G0-03 | **Finance onayı** sonrası gerçek `finance_transaction` (veya eşdeğer operasyonel hareket) oluşur | ☑ KABUL |

**Akış özeti:**

```text
Satınalma (PO / fatura / maliyet)  →  ödeme yükümlülüğü / talep
Finance onay                       →  finance_transaction (gerçek düşüm)
```

Çapraz referans: [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) · [09-finance-data-contract.md](./09-finance-data-contract.md) §8, §22 (F1–F3).

---

## 3. Hesap türleri (ayrı izleme)

Aşağıdakiler **ayrı hesap türleri** olarak tanımlanır; tek “kasa” altında birleştirilmez:

| Hesap türü | Açıklama |
|------------|----------|
| Resmi banka hesabı | Yasal banka |
| Resmi kasa | Yasal nakit kasa |
| Gayri resmi nakit kasa | Operasyonel gayri resmi nakit |
| Kart | Kurumsal / operasyonel kart |
| Petty cash | Küçük nakit / harcırah |
| Avans kasası | Personel avansları — **ayrı izlenir** |
| Proje küçük gider kasası | Proje bazlı küçük gider |

**Karar F-G0-04:** Avans kasası diğer kasalardan **ayrı ledger / bakiye** ile izlenir.

---

## 4. Ödeme yöntemi vs gider nedeni

| Kavram | Tanım | Karıştırma |
|--------|--------|------------|
| **Ödeme yöntemi** | Nakit, resmi banka, kart, gayri resmi kasa, cari (hesap) | Gider nedeni ile **aynı alan değil** |
| **Gider nedeni** | Neden harcandı (malzeme, nakliye, avans, proje, genel gider vb.) | Ödeme kanalından **bağımsız** |

**Karar F-G0-05:** Ödeme yöntemi ile gider nedeni veri modelinde **ayrı tutulur**.

**Karar F-G0-06:** Ödemeler şu kanallardan yapılabilir: nakit, resmi banka, kart, gayri resmi kasa veya **cari (party) üzerinden**.

---

## 5. Yurt dışı alım ve landed cost

Yurt dışı malzeme alımlarında aşağıdakiler **ayrı gider / landed cost bağlantısı** olarak izlenebilir:

| Gider kalemi | Bağlantı |
|--------------|----------|
| Komisyon | Ayrı gider satırı |
| Nakliye | Landed cost |
| Gümrük | Landed cost |
| Vergi / ithalat gideri | Landed cost |
| Lokal taşıma | Landed cost |

**Karar F-G0-07:** Landed cost kalemleri stok maliyetine veya proje giderine **bağlantı anahtarı** ile bağlanır; tek satırda gizlenmez.

**Karar F-G0-08:** Para nakitleştirme (FX cash-out) **komisyonları** ayrı gider hareketi olarak tutulur.

---

## 6. Kur politikası

| # | Karar | Detay |
|---|--------|--------|
| F-G0-09 | Yerel kur etkileri | **Manuel / snapshot** kurla izlenir ([05](./05-country-currency-language.md) C2) |
| F-G0-10 | Dashboard kuru | **Bilgi amaçlıdır**; kayıtlı işlem kurunu **değiştirmez** |
| F-G0-11 | İşlem kuru | Belge oluşturulurken `fx_snapshot_at` ile kilitlenir |

---

## 7. Ay kapanışı (operasyonel kontrol)

| Alan | Gate 0 tanımı |
|------|----------------|
| Resmi muhasebe kapanışı mı? | **Hayır** |
| Ne yapılır? | Operasyonel kontrol ve **kilitleme** süreci |

### 7.1 Kapanış kontrol listesi

Ay kapanışında kontrol edilenler:

- [ ] Kasa / banka / kart bakiyeleri
- [ ] Açık avanslar
- [ ] Açık ödemeler ve onay bekleyen talepler
- [ ] Eksik belgeler
- [ ] Proje giderleri özeti
- [ ] Kur snapshot’ları (dönem sonu)

### 7.2 Geriye dönük değişiklik

| # | Karar |
|---|--------|
| F-G0-12 | Kapanmış aya **geriye dönük sessiz değişiklik yapılmaz** |
| F-G0-13 | Düzeltme gerekiyorsa **sonraki ayda** `adjustment` hareketi açılır; audit izi zorunlu |

---

## 8. Gate 0 kabul kriterleri (bu belge)

- [x] Modül resmi muhasebe **olmadığı** onaylandı
- [x] Satınalma → yükümlülük; Finance onay → gerçek hareket
- [x] Hesap türleri ayrımı tanımlandı
- [x] Avans kasası ayrı izleme
- [x] Ödeme yöntemi ≠ gider nedeni
- [x] Landed cost ve komisyon ayrı hareketler
- [x] Kur snapshot vs dashboard ayrımı
- [x] Operasyonel ay kapanışı ve adjustment kuralı
- [ ] **Durum: FROZEN** — kullanıcı nihai onayı bekleniyor

---

## 9. Sonraki adımlar

| Gate | İş |
|------|-----|
| Gate 0 kapanış | Kullanıcı nihai PASS → spec FROZEN (talimatla) |
| Gate 1 | Core; finance kodu yok |
| Gate 5 | `finance_transaction`, hesaplar, onay kuyruğu, ay kapanışı implementasyonu |

**Gate 0 kuralı:** Bu belge **FROZEN** olmadan finance modül **kodu** yazılmaz (dokümantasyon ve mockup hariç).
