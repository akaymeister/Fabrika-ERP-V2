# FactoryOS V3 — Purchasing Full Blueprint (Satınalma)

**Belge türü:** Gate 0 domain spec  
**Durum:** ☐ TASLAK | ☑ İNCELEME | ☐ FROZEN  
**Versiyon:** 2.0.0  
**Son güncelleme:** 21.05.2026  
**Ana iş kuralı kaynağı:** `FactoryOS-V3/Modül Detayları/04 - Satın alma Modül Detayları.docx` (Gate 0 birincil referans; V2 kod yalnızca teknik doğrulama)  
**V2 çalışma oranı (referans):** ~%95 iş kuralı korunur  
**Ürün:** FactoryOS V3 · V2 referans only (kod kopyalanmaz)

**Platform bağımlılıkları:**

- [03-migration-module-registry.md](./03-migration-module-registry.md) **v0.2.0** — registry, manifest, permission
- [05-country-currency-language.md](./05-country-currency-language.md) **v1.1.0** — C1–C4 local/reporting, FX snapshot, format
- [07-stock-full-blueprint.md](./07-stock-full-blueprint.md) — mal kabul, FIFO, BOQ→talep zinciri
- [09-finance-data-contract.md](./09-finance-data-contract.md) — kasa/cari, ödeme onayı
- [01-central-ui-design-system.md](./01-central-ui-design-system.md) — merkezi modal/UI
- [02-admin-control-system.md](./02-admin-control-system.md) — system settings, logo
- [06-hr-full-blueprint.md](./06-hr-full-blueprint.md) — audit pattern referansı
- [12-modal-flow-inventory.md](./12-modal-flow-inventory.md) — flowId

---

## 1. Amaç ve kapsam

FactoryOS V3 **Satınalma** modülü “mini satınalma” veya yalnızca sipariş listesi **değildir**.

**Modül tanımı (Gate 0 KABUL):**

> Satınalma modülü; ihtiyaç talebi, talep onayı ve satınalma fişi/siparişi işleme modülüdür. Fiziksel stok hareketi olan mal kabulü **yapmaz**. Kesin muhasebe/kasa hareketi **oluşturmaz**. Depo ve muhasebe modülleriyle referans, bildirim ve onay zinciri üzerinden entegre çalışır.

| Kapsam dahil | Kapsam dışı |
|--------------|-------------|
| Talep açma, taslak, revizyon | Mal kabul (fiziksel) → [07-stock](./07-stock-full-blueprint.md) |
| Talep onay / red / revizyon | Kesin kasa düşümü → [09-finance](./09-finance-data-contract.md) |
| Satınalma fişi / siparişi işleme | Stok hareketi oluşturma |
| Fiyat, tedarikçi, manuel kur, ödeme kaynağı **seçimi** | Muhasebe defteri |
| Muhasebe bildirimi ve bağlantı durumu | |
| pending_cost **işaretleme** (maliyet tamamlama yetkisi) | |

**Gate 0 çıktısı:** Bu belge FROZEN olmadan Gate 4 satınalma migration, API ve UI **yazılmaz**.

---

## 2. Satınalma modülünün sınırları

### 2.1 Üç modül ayrımı

| Modül | Sorumluluk | Satınalma yapar mı? |
|-------|------------|---------------------|
| **Satınalma** | Talep, onay, fiş/sipariş, fiyat, kur snapshot, muhasebe **bildirimi** | — |
| **Stok / Depo** | Mal kabul, `stock_movement`, FIFO katman | **Hayır** (satınalma ekranından GR yok) |
| **Finance / Muhasebe** | Kesin ödeme, kasa/kart/cari düşüm, onay/red | **Hayır** (satınalma kasa düşmez) |

### 2.2 Ne stok / muhasebe oluşturmaz

| Olay | Stok | Muhasebe/kasa |
|------|------|----------------|
| Talep oluştur / taslak | Hayır | Hayır |
| Talep onay | Hayır | Hayır |
| Satınalma siparişi oluşumu | Hayır | Hayır |
| Fiyat / kur kaydet | Hayır | Hayır |
| Sipariş tamamla (satınalmacı) | Hayır | Bildirim; **kesin düşüm yok** |
| Mal kabul | **Evet** (stok modülü) | — |
| Muhasebe onayı | — | **Evet** (finance) |

---

## 2A. Registry, manifest ve permission uyumu

[03-migration-module-registry.md](./03-migration-module-registry.md) v0.2.0. Hardcoded menü **yok**; kart ve aksiyonlar registry + permission ile.

### 2A.1 Modül kaydı

| Alan | Değer |
|------|--------|
| `module_key` | `purchasing` |
| Manifest | `modules/purchasing/module.manifest.json` |
| Register | `modules:register --module=purchasing` (Gate 1) |

### 2A.2 Sayfa registry (`erp_pages`)

| page_key | Menü adı (i18n) | path (örnek) | Not |
|----------|-----------------|--------------|-----|
| `purchasing.hub` | Satınalma | `/purchasing` | Ana sayfa — §3 |
| `purchasing.request.create` | **Talep Aç** | `/purchasing/request/create` | |
| `purchasing.requests` | **Satınalma Talepleri** | `/purchasing/requests` | V2 “Yönetici Onayları” **kaldırıldı** |
| `purchasing.orders` | **Satınalma Fişleri** | `/purchasing/orders` | İç kayıt: Satınalma Siparişi |
| `purchasing.receipts.info` | Mal kabul bekleyen (bilgi) | — | Yalnızca hub kartı; GR işlemi **stock.receipts** |

**Kaldırılan V2 sayfalar:**

| V2 | V3 |
|----|-----|
| Yönetici Onayları | `purchasing.requests` |
| Satınalma İşleme (mal kabul karışık) | `purchasing.orders` — GR **yok** |

### 2A.3 Hub kartları (`erp_page_cards`)

| card_key | Hedef / anlam | required_permissions |
|----------|---------------|----------------------|
| `purchasing.card.pending_approval` | Onay bekleyen talepler | `purchasing.request.review.view` |
| `purchasing.card.today_requests` | Bugün açılan talepler | `purchasing.request.review.view` |
| `purchasing.card.in_progress` | Satınalması devam eden | `purchasing.order.view` |
| `purchasing.card.completed_orders` | Tamamlanmış siparişler | `purchasing.order.view` |
| `purchasing.card.revision_pending` | Revizyon bekleyen | `purchasing.request.revision.view` |
| `purchasing.card.accounting_pending` | Muhasebe bildirimi bekleyen fişler | `purchasing.accounting.status.view` |
| `purchasing.card.gr_pending_info` | Mal kabul bekleyen (bilgi) | `purchasing.order.view` — **işlem yok** |

Kart `is_visible=0` → hub’da görünmez; yetki yok → API 403.

---

## 3. Ana akış (Gate 0 KABUL)

```text
1. Talep Aç          → purchase_request (draft/submitted)
2. Satınalma Talepleri / Onay → approve | reject | revision_requested
3. Satınalma Fişi / Siparişi → purchase_order (onay sonrası)
4. Muhasebe bildirimi / onay → accounting_link (waiting → approved → payment_posted)
5. Mal kabul / Depo  → goods_receipt (stock modülü — ayrı ekran)
6. Stok hareketi     → stock_movement RECEIPT_IN
7. pending_cost / maliyet tamamlama → fiyat kesinleşince cost layer (satınalma/finance yetkili)
```

---

## 4. Temel kavramlar ve isimlendirme

| Kavram | Tanım | Stok? |
|--------|--------|-------|
| **Satınalma talebi** | Kullanıcının ihtiyaç isteği (`purchase_request`) | Hayır |
| **Satınalma fişi** | Menü/ekran adı — onaylı talebin işleneceği operasyonel belge | Hayır |
| **Satınalma siparişi** | Kayıt tipi (`purchase_order`) — tedarikçi, fiyat, kur, ödeme kaynağı | Hayır |
| **Mal kabul** | Fiziksel kabul (`goods_receipt`) — **stok modülü** | Evet (kabul sonrası) |
| **Muhasebe bağlantısı** | Ödeme kaynağı seçimi + finance onay durumu | Kesin hareket finance’de |

**Gate 0 KABUL — isimlendirme:**

| UI | Kayıt |
|----|--------|
| Menü: **Satınalma Fişleri** | Entity: **Satınalma Siparişi** (`purchase_order`) |
| Menü: **Satınalma Talepleri** | Entity: **Satınalma Talebi** (`purchase_request`) |

---

## 5. Roller ve yetkiler (özet)

| Rol | Tipik yetkiler |
|-----|----------------|
| Talep açan | `purchasing.request.create`, `draft.manage`, `submit` |
| Onaycı | `request.review.*`, `approve`, `reject`, `revise`, `line.cancel`, `qty.revise` |
| Satınalmacı | `order.process`, `price.edit`, `fx.edit`, `complete`, `payment_source.select` |
| Muhasebe | Finance modülü — `finance.payments.*`; satınalma `accounting.status.view` |
| Depocu | `stock.receipts.*` — **purchasing.receipt.create yok** (mal kabul stokta) |
| Fiyat görüntüleme | `purchasing.sensitive_price.view` |

`module.purchasing` veya `module.purchasing.view` menü kapısıdır; **tüm işlemleri açmaz** (§22).

---

## 6. Satınalma ana sayfası (hub)

[00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) + [01-central-ui-design-system.md](./01-central-ui-design-system.md).

| Kural | Detay |
|-------|--------|
| Tasarım | Onaylı V3 UI; hero/landing yok |
| Menüleri Göster | Korunur |
| Kartlar | Registry + permission (§2A.3) |
| Amaç | Özet ve yönlendirme — işlem detayı alt sayfalarda |

---

## 7. Talep Aç sayfası

V2 alt mimarisi **iş kuralı referansı**; V2 UI/CSS **kopyalanmaz**.

### 7.1 Oluşturma sırası (Gate 0 KABUL)

| Sıra | Adım |
|------|------|
| 1 | Proje seç (opsiyonel / iş kuralına göre) |
| 2 | Depo seç |
| 3 | Alt kategori seç |
| 4 | Ürün seç (katalog / proje-BOQ — §18) |
| 5 | Sipariş miktarı |
| 6 | Birim seç |
| 7 | Görsel (varsa) |
| 8 | PDF / belge eki |
| 9 | Açıklama / not |
| 10 | Talep oluştur veya taslağa kaydet |

### 7.2 Kurallar

| Kural | Detay |
|-------|--------|
| Her kullanıcı | Kendi adına taslak/talep |
| Talep oluşturma | Stok **oluşturmaz**; muhasebe **oluşturmaz** |
| Submit sonrası | `purchasing.requests` listesine düşer |
| Bildirim | Onay yetkililerine — §20 |

**Test:** PT-01, PT-03, PT-30.

---

## 8. Taslak talep sistemi

| Kural | Detay |
|-------|--------|
| Durum | `purchase_request.status = draft` |
| Kaydet | Kullanıcı yarım bırakıp devam edebilir |
| Devam | Taslak listesinden seç → Talep Aç formu dolu açılır |
| Submit | `draft` → `submitted` |
| Audit | `PURCHASE_REQUEST_DRAFT_SAVED` |

**Test:** PT-02.

---

## 9. Revize Talepleri kartı (Talep Aç sayfası)

| Kural | Detay |
|-------|--------|
| Konum | Talep Aç sayfasında kart |
| Tetikleyici | Yetkili `revision_requested` gönderir |
| Bildirim | Talep açan kullanıcıya |
| Liste | Revizyon bekleyen talepler |
| Tıklama | Popup — satır düzenle / sil (iptal statüsü) |
| Zorunlu | Revizyon açıklaması |
| Tekrar gönder | `revision_requested` → `submitted` |
| Audit | Eski/yeni değer; `PURCHASE_REQUEST_REVISION_*` |

**Test:** PT-04, PT-05.

---

## 10. Satınalma Talepleri sayfası

V2 **“Yönetici Onayları” kaldırıldı** — Gate 0 KABUL.

### 10.1 Sayfa kartları

| Kart | İçerik |
|------|--------|
| Onay bekleyen / son açılan | `submitted` |
| Onaylanan | `approved`, `converted_to_order` |
| Red / revizyon bekleyen | `rejected`, `revision_requested` |

### 10.2 Yetki katmanları

| perm_key | Yetki |
|----------|--------|
| `purchasing.request.review.view` | Liste görüntüleme |
| `purchasing.request.review.action` | Onay/red/revizyon butonları |
| `purchasing.request.approve` | Onayla |
| `purchasing.request.reject` | Reddet |
| `purchasing.request.revise` | Revizyona gönder |
| `purchasing.request.line.cancel` | Satır iptal |
| `purchasing.request.qty.revise` | Miktar revizyonu (onay sürecinde) |

**Test:** PT-06, PT-07.

---

## 11. Onay / red / revizyon popup akışı

| Davranış | Detay |
|----------|--------|
| Açılış | Talep satırına tık → merkezi popup |
| Onay / red / revizyon | Popup üzerinden |
| Yazdır | Talep formu yazdırılabilir (§24) |
| Satır iptal | Açıklama **zorunlu**; fiziksel silme **yok** → `line_status=cancelled` |
| Miktar revizyonu | Onaycı `qty.revise` ile |

### 11.1 Onaycı sınırları (Gate 0 KABUL)

| İzin verilen | Yasak |
|--------------|--------|
| Onay, red, revizyona gönder | Yeni ürün eklemek |
| Satır iptal, miktar revizyonu | Ürünü başka ürünle değiştirmek |
| | Ürün değişimi → **revizyona gönder** |

**Test:** PT-08, PT-09, PT-10.

---

## 12. Satınalma Fişleri / Satınalma Siparişleri sayfası

| Kural | Detay |
|-------|--------|
| Menü | **Satınalma Fişleri** |
| Kayıt | **Satınalma Siparişi** (`purchase_order`) |
| V2 referans | İş kuralı; UI V3 |
| Mal kabul | Bu ekrandan **yapılamaz** — PT-12 |
| Yazdır | Her fiş/sipariş formu yazdırılabilir |

### 12.1 Sayfa kartları

| Kart | Filtre |
|------|--------|
| Yeni açılan | `new`, `in_progress` |
| Devam eden | `priced`, `waiting_accounting` |
| Tamamlanmış | `completed_by_purchasing`, `partially_received`, `fully_received`, `closed` |

### 12.2 Satınalmacı aksiyonları

| Aksiyon | Ayrı mı? |
|---------|----------|
| Tedarikçi seç | Evet |
| Fiyat gir | Evet — **tamamlama değil** |
| `currency_code` seç | transaction currency |
| Manuel kur gir | Zorunlu (finansal tamamlama için) |
| Ödeme kaynağı seç | Cari / resmi kasa / gayri resmi kasa / kart / banka |
| Sipariş tamamla | **Ayrı aksiyon** — muhasebe bildirimi |

**Test:** PT-11, PT-15, PT-16.

---

## 13. Fiyat / tedarikçi / kur girişi

[05-country-currency-language.md](./05-country-currency-language.md) v1.1.0 C1–C4 uyumu.

### 13.1 Satır alanları

| Alan | Açıklama |
|------|----------|
| `unit_price` | Transaction currency cinsinden |
| `currency_code` | İşlem para birimi (`transaction_currency`) |
| `fx_rate_to_local` | → `local_currency` (config) |
| `fx_rate_to_base` | → `reporting_currency` (config) |
| `line_total_transaction` | Backend PricingEngine |
| `line_total_local` | Snapshot |
| `line_total_base` | Snapshot |
| `fx_snapshot_at` | İşlem anı |
| `fx_source` | `manual` \| `approved_snapshot` |

### 13.2 Kurallar

| Kural | Detay |
|-------|--------|
| Hard-code | **UZS/USD yasak** — config’ten `local_currency`, `reporting_currency` |
| Otomatik kur | Sistem dashboard kuru satıra **yazmaz** |
| Satınalmacı | Kuru **manuel** girer |
| Eksik kur | Finansal tamamlama **blok** (C2) |
| Gösterim | `formatMoney` merkezi formatter |
| Geçmiş kur | Sessizce değiştirilemez; audit zorunlu |

**Test:** PT-13, PT-22, PT-23.

---

## 14. Manuel kur ve üstten kur kopyala

| Kural | Detay |
|-------|--------|
| Dashboard kur | Bilgi amaçlı; işlem satırına otomatik yazılmaz |
| Üstten kur kopyala | Üst formdaki kuru satırlara **kullanıcı kontrollü** kopyalar |
| Otomatik feed → satır | **Yasak** (işlem kuru manuel) |
| Kopyalama | `PURCHASE_ORDER_TOP_FX_COPIED` audit |
| Kur değişikliği | `PURCHASE_ORDER_FX_CHANGED` audit |

**Test:** PT-14.

---

## 15. Muhasebe / kasa / kart / cari bağlantısı

Satınalma **muhasebe modülü değildir**; finance ile **doğrudan ilişkilidir**.

### 15.1 Ödeme kaynağı seçimi (satınalmacı)

| Kaynak | Kaynak modül |
|--------|----------------|
| Cari | [09-finance](./09-finance-data-contract.md) `parties` |
| Resmi kasa | Finance cash account |
| Gayri resmi kasa | Finance cash account |
| Kart / banka / transfer | Admin tanımlı hesaplar |

### 15.2 Akış (Gate 0 KABUL)

```text
Satınalmacı ödeme kaynağı seçer + sipariş tamamlar
  → accounting_link.status = waiting_accounting
  → Muhasebe birimine bildirim
  → Finance onay / red / revizyon
  → Onay sonrası payment_posted (finance modülünde kasa hareketi)
```

| Kural | Detay |
|-------|--------|
| Kesin kasa düşümü | **Yalnızca** finance onayı sonrası |
| Satınalma | Bildirim + `accounting_link` durumu; hareket **oluşturmaz** |
| Muhasebe red / revizyon | Satınalmacıya bildirim |

**Test:** PT-16, PT-17, PT-18, PT-28.

---

## 16. Mal kabul ayrımı

| Kural | Detay |
|-------|--------|
| Ekran | [07-stock](./07-stock-full-blueprint.md) `stock.receipts` — **Satınalma Fişleri’nden GR yok** |
| Stok artışı | Yalnızca mal kabul |
| Fiyat girişi | Stok artırmaz |
| Sipariş tamamlama | Stok artırmaz |
| Kısmi kabul | Desteklenir; çoklu GR |
| Alanlar | Kabul / red / hasarlı miktar, depo, irsaliye no, not |

**Test:** PT-12, PT-19.

---

## 17. Pending cost

| Kural | Detay |
|-------|--------|
| Mal kabul fiyatsız | Yapılabilir |
| Fiziksel stok | Artar (`qty_accepted`) |
| Maliyet | `pending_cost` / `cost_status=pending_cost` |
| Tamamlama | Satınalma veya finance yetkili (`purchasing.cost.finalize`) |
| Depocu | Fiyat **değiştiremez** — PT-21 |
| Revizyon | Audit; sessiz toplu overwrite **yok** |
| FIFO | [07-stock](./07-stock-full-blueprint.md) cost layer uyumu |

**Test:** PT-20, PT-21.

---

## 18. Proje / BOQ bağlantısı

[07-stock](./07-stock-full-blueprint.md) §18A ile hizalı.

| Kural | Detay |
|-------|--------|
| Talep | Proje seçilebilir |
| Ürün kaynağı | Katalog; **Projeden ürün seç**; yeni BOQ kalemi (yetki) |
| Stok | Talep/BOQ seçimi stok **oluşturmaz** |
| Zincir | `boq_line_id` → `purchase_request_line` → `purchase_order_line` → GR → movement |
| Karışım yasağı | Katalog ürün ≠ BOQ kalemi ≠ fiziksel stok ≠ proje rezervi |

**Test:** PT-30, PT-29.

---

## 19. Depo / stok / stock_movement bağlantısı

**Referans zinciri (Gate 0 KABUL):**

```text
purchase_request (+ lines, boq_line_id?)
  → purchase_order (+ lines)
    → goods_receipt (+ lines)
      → stock_movement (RECEIPT_IN)
        → stock_cost_layers (FIFO)
```

| Alan | Taşınır |
|------|---------|
| `project_id` | Talep/PO/GR/movement zincirinde (varsa) |
| `warehouse_id` | Talep hedef depo; GR gerçek depo |

---

## 20. Bildirim olayları

| Olay | Alıcı |
|------|--------|
| Yeni talep açıldı | Onay yetkilileri |
| Revizyona gönderildi | Talep açan |
| Reddedildi | Talep açan |
| Onaylandı | Satınalma yetkilileri |
| Satınalma fişi oluştu | Satınalmacı |
| Sipariş işleme alındı | İlgili kişiler |
| Sipariş tamamlandı (satınalmacı) | Muhasebe + ilgili |
| Muhasebe onayladı | Satınalma / ilgili |
| Muhasebe revizyon istedi | Satınalmacı |
| Mal kabul yapıldı | Satınalma / proje / ilgili (stok modülü tetikler) |

Altyapı: sistem içi bildirim + kullanıcı profil; Telegram uyumlu (opsiyonel).

**Test:** PT-26.

---

## 21. Durum makineleri

### 21.1 `purchase_request.status`

| Durum | Açıklama |
|-------|----------|
| `draft` | Taslak |
| `submitted` | Onaya gönderildi |
| `revision_requested` | Revizyon bekleniyor |
| `approved` | Onaylandı |
| `rejected` | Reddedildi |
| `cancelled` | İptal |
| `converted_to_order` | Siparişe dönüştü |

### 21.2 `purchase_request_line.status`

| Durum | Açıklama |
|-------|----------|
| `active` | Aktif |
| `revised` | Miktar/içerik revize edildi |
| `cancelled` | İptal (pasif; açıklama ile) |
| `rejected` | Red |
| `approved` | Onaylı satır |

### 21.3 `purchase_order.status`

| Durum | Açıklama |
|-------|----------|
| `new` | Yeni |
| `in_progress` | İşleniyor |
| `priced` | Fiyatlandırıldı (kısmi/tam) |
| `waiting_accounting` | Muhasebe bekliyor |
| `completed_by_purchasing` | Satınalmacı tamamladı |
| `partially_received` | Kısmi mal kabul |
| `fully_received` | Tam mal kabul |
| `closed` | Kapatıldı |
| `cancelled` | İptal |

### 21.4 `purchase_order_line.cost_status`

| Durum | Açıklama |
|-------|----------|
| `price_missing` | Fiyat yok |
| `fx_missing` | Kur yok |
| `priced` | Fiyat+kur tamam |
| `pending_cost` | Mal kabul sonrası maliyet bekliyor |
| `cost_finalized` | Maliyet kesin |
| `price_revised` | Fiyat revize edildi |

### 21.5 `accounting_link.status`

| Durum | Açıklama |
|-------|----------|
| `not_required` | Muhasebe akışı gerekmez |
| `payment_source_selected` | Ödeme kaynağı seçildi |
| `waiting_accounting` | Muhasebe onayı bekliyor |
| `approved_by_accounting` | Muhasebe onayladı |
| `payment_posted` | Ödeme finance’de işlendi |
| `rejected` | Muhasebe reddetti |
| `revision_requested` | Muhasebe revizyon istedi |

### 21.6 `goods_receipt.status` (stok modülü — referans)

| Durum | Açıklama |
|-------|----------|
| `not_started` | Henüz kabul yok |
| `partially_received` | Kısmi |
| `fully_received` | Tam |
| `rejected` | Red |
| `voided` | İptal |

**Not:** V2 `buyer_state` / `receipt_status` karışımı V3’te yukarıdaki ayrı eksenlerle çözülür; detay Gate 4 uygulama.

---

## 22. İzin kataloğu

**İsimlendirme:** [03](./03-migration-module-registry.md) §5 — `{module}.{resource}.{action}`.

| perm_key | Açıklama |
|----------|----------|
| `module.purchasing` | Modül menü kapısı |
| `purchasing.dashboard.view` | Hub |
| `purchasing.request.create` | Talep oluştur |
| `purchasing.request.draft.manage` | Taslak |
| `purchasing.request.submit` | Gönder |
| `purchasing.request.revision.view` | Revize listesi |
| `purchasing.request.revision.edit` | Revize düzenle |
| `purchasing.request.review.view` | Onay listesi |
| `purchasing.request.review.action` | Onay aksiyonları |
| `purchasing.request.approve` | Onayla |
| `purchasing.request.reject` | Reddet |
| `purchasing.request.revise` | Revizyona gönder |
| `purchasing.request.line.cancel` | Satır iptal |
| `purchasing.request.qty.revise` | Miktar revizyon |
| `purchasing.request.select_from_catalog` | Katalogdan ürün |
| `purchasing.request.select_from_boq` | Projeden ürün |
| `purchasing.boq.add_line` | Yeni BOQ kalemi |
| `purchasing.order.view` | Fiş/sipariş listesi |
| `purchasing.order.process` | İşleme al |
| `purchasing.order.price.edit` | Fiyat |
| `purchasing.order.fx.edit` | Kur |
| `purchasing.order.complete` | Satınalmacı tamamlama |
| `purchasing.order.print` | Yazdır |
| `purchasing.order.payment_source.select` | Ödeme kaynağı |
| `purchasing.accounting.notify` | Muhasebe bildirimi tetik |
| `purchasing.accounting.status.view` | Muhasebe durumu |
| `purchasing.cost.finalize` | pending_cost kapat |
| `purchasing.cost.revise` | Maliyet revizyon |
| `purchasing.sensitive_price.view` | Fiyat/kur görüntüleme |
| `purchasing.audit.view` | Audit log |
| `purchasing.product.create` | Ürün popup (yetkili) |

**Kural:** `module.purchasing` onay, fiyat, muhasebe ve mal kabul **açmaz**.

---

## 23. Audit log olayları

| event_key | Tetikleyici |
|-----------|-------------|
| `PURCHASE_REQUEST_DRAFT_SAVED` | Taslak kayıt |
| `PURCHASE_REQUEST_CREATED` | Talep oluştur |
| `PURCHASE_REQUEST_SUBMITTED` | Gönder |
| `PURCHASE_REQUEST_REVISION_REQUESTED` | Revizyon iste |
| `PURCHASE_REQUEST_REVISION_RESUBMITTED` | Revizyon sonrası gönder |
| `PURCHASE_REQUEST_APPROVED` | Onay |
| `PURCHASE_REQUEST_REJECTED` | Red |
| `PURCHASE_REQUEST_LINE_CANCELLED` | Satır iptal |
| `PURCHASE_REQUEST_QTY_REVISED` | Miktar revizyon |
| `PURCHASE_ORDER_CREATED` | Sipariş oluşumu |
| `PURCHASE_ORDER_PROCESSING_STARTED` | İşleme |
| `PURCHASE_ORDER_SUPPLIER_SELECTED` | Tedarikçi |
| `PURCHASE_ORDER_PRICE_SAVED` | Fiyat kayıt |
| `PURCHASE_ORDER_FX_CHANGED` | Kur değişimi |
| `PURCHASE_ORDER_TOP_FX_COPIED` | Üstten kur kopyala |
| `PURCHASE_ORDER_PAYMENT_SOURCE_SELECTED` | Ödeme kaynağı |
| `PURCHASE_ORDER_COMPLETED_BY_PURCHASING` | Satınalmacı tamamlama |
| `PURCHASE_ORDER_ACCOUNTING_NOTIFIED` | Muhasebe bildirimi |
| `ACCOUNTING_APPROVAL_RECEIVED` | Muhasebe onay (finance) |
| `ACCOUNTING_REVISION_REQUESTED` | Muhasebe revizyon |
| `ACCOUNTING_PAYMENT_POSTED` | Ödeme işlendi |
| `PURCHASE_COST_PENDING_CREATED` | pending_cost |
| `PURCHASE_COST_FINALIZED` | Maliyet kesin |
| `PURCHASE_COST_REVISED` | Maliyet revizyon |
| `GOODS_RECEIPT_POSTED` | Mal kabul (stok modülü kaydı) |

---

## 24. Yazdırma / form formatları

| Form | Yazdırılabilir |
|------|----------------|
| Satınalma talep formu | Evet |
| Satınalma fişi / sipariş formu | Evet |
| UI | V3 kurumsal rapor kuralları |
| Logo | [02-admin](./02-admin-control-system.md) system settings |
| Font | Türkçe karakter destekli |
| Fiyat | `purchasing.sensitive_price.view` yoksa redaction |

**Test:** PT-24.

---

## 25. Veri modeli taslağı (Gate 0 kontrat)

Tam SQL Gate 4 migration’da. Özet entity’ler:

| Entity | Not |
|--------|-----|
| `purchase_requests` | `request_code`, `project_id`, `warehouse_id`, `status` §21.1 |
| `purchase_request_lines` | `product_id`, `boq_line_id?`, `requested_quantity`, `unit_code`, `line_status` |
| `purchase_request_approvals` | `decision`, `comment` |
| `purchase_orders` | `order_code`, `supplier_id`, `status` §21.3, `accounting_link_id?` |
| `purchase_order_lines` | Money alanları §13.1, `cost_status` §21.4 |
| `accounting_links` | `payment_source_type`, `status` §21.5 |
| `purchase_order_price_revisions` | Auditli fiyat değişimi |
| `suppliers`, `supplier_contacts` | Marka ≠ supplier ([07](./07-stock-full-blueprint.md) S1) |
| `goods_receipts`, `goods_receipt_lines` | Stok modülü şeması — referans |
| `pending_costs` | Çözüm izleme |

---

## 26. V2’den taşınacaklar

| Alan | Detay |
|------|--------|
| Talep Aç akışı | Proje → depo → alt kategori → ürün → miktar → birim |
| Popup/form domain akışı | Referans |
| Onay sonrası PO | İş kuralı |
| Fiyat kaydet ≠ complete | **Korunur ve güçlendirilir** |
| Satır bazlı currency/fx | Korunur — [05](./05-country-currency-language.md) ile hizalanır |
| Partial delivery, pending_cost | Korunur |
| Mal kabul ↔ PO bağlantısı | Stok modülünde |
| Çalışan iş kuralları | V3 mimarisinde yeniden tanımlanır |

---

## 27. V2’den taşınmayacaklar

| V2 | V3 |
|----|-----|
| UI/CSS birebir kopya | V3 merkezi UI |
| **Yönetici Onayları** sayfası | **Satınalma Talepleri** |
| Fiyat kaydet = sipariş tamamla | Ayrı aksiyonlar |
| Satınalma Fişleri’nden mal kabul | Stok `stock.receipts` |
| Hard-coded UZS/USD | local/reporting currency |
| `SYSTEM` currency alias | Kaldırıldı |
| `module.purchasing` her şeyi açar | Granular perm |
| Satır fiziksel DELETE | `cancelled` statüsü |
| Satınalma içi kesin kasa düşümü | Finance onayı |
| Muhasebe onayı olmadan finans kesinleşmesi | Blok |
| Onaycı ürün ekleme/değiştirme | Revizyon akışı |
| Otomatik kur satıra yazma | Manuel + üstten kopyala |

---

## 28. Test / doğrulama senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| PT-01 | Talep Aç akışı | proje→depo→kategori→ürün→miktar→birim |
| PT-02 | Taslak kaydet / devam | draft persist |
| PT-03 | Talep oluştur | Stok/muhasebe hareketi yok |
| PT-04 | Revizyon kartı | Talep Aç’ta görünür |
| PT-05 | Revizyon popup | Düzenle → resubmit |
| PT-06 | review.view vs action | Ayrı perm |
| PT-07 | Yetkisiz onay butonu | Gizli / 403 |
| PT-08 | Popup onay/red/revizyon | Çalışır |
| PT-09 | Satır iptal | Açıklama zorunlu; pasif kalır |
| PT-10 | Onaycı yeni ürün | 403; revizyon gerekir |
| PT-11 | Onay → PO | `purchase_order` oluşur |
| PT-12 | Fiş ekranından GR | 403 / UI yok |
| PT-13 | Kur olmadan complete | 400 blok |
| PT-14 | Üstten kur kopyala | Satırlara kopya; audit |
| PT-15 | Fiyat kaydet | Sipariş tamamlanmaz |
| PT-16 | Complete → muhasebe bildirimi | `waiting_accounting` |
| PT-17 | Ödeme kaynağı | Finance master’dan |
| PT-18 | Finance onayı olmadan kasa | Hareket yok |
| PT-19 | GR sonrası stok | Stok artar; fiyat girişi artırmaz |
| PT-20 | Fiyatsız GR | pending_cost |
| PT-21 | Depocu fiyat | 403 |
| PT-22 | Para birimi config | local/reporting |
| PT-23 | Hard-code tarama | UZS/USD sabit yok |
| PT-24 | Yazdır redaction | Fiyat gizli |
| PT-25 | Kritik audit | Olaylar loglanır |
| PT-26 | Bildirimler | Doğru alıcı |
| PT-27 | V2 Yönetici Onayları | Sayfa yok |
| PT-28 | Satınalma ≠ kesin ödeme | Finance’de posted |
| PT-29 | Referans zinciri | request→order→GR→movement |
| PT-30 | BOQ seçim | Stok oluşmaz |

---

## 29. Riskler

| Risk | Azaltma |
|------|---------|
| Mal kabul satınalma ekranında | §16; PT-12 |
| Fiyat kaydet = complete | §12; PT-15 |
| Otomatik kur geçmişi bozar | [05](./05-country-currency-language.md) C2; PT-13 |
| Kesin kasa satınalmada | §15; PT-18, PT-28 |
| Onaycı ürün değiştirir | §11.1; PT-10 |
| Hard-code currency | §13; PT-23 |
| pending_cost unutulur | §17; PT-20 |
| module.purchasing geniş | §22; PT-06/07 |
| BOQ = stok sanılması | §18; PT-30 |
| Zincir kopukluğu | §19; PT-29 |

---

## 30. Açık kararlar — Gate 0 kapanışı

Belirsiz “sonra bakılacak” **yok**. Uygulama Gate 4+ ayrıdır.

| # | Gate 0 karar | Uygulama Gate | Kabul / test |
|---|--------------|---------------|--------------|
| **P-01** | **KABUL** — Menü: **Satınalma Fişleri**; kayıt: **Satınalma Siparişi** | Gate 4 UI/i18n | §4; PT-11 |
| **P-02** | **KABUL** — V2 **Yönetici Onayları** kaldırılır → **Satınalma Talepleri** | Gate 4 | PT-27 |
| **P-03** | **KABUL** — Mal kabul satınalma fişi ekranından **yapılmaz** | Gate 4 + [07](./07-stock-full-blueprint.md) | PT-12 |
| **P-04** | **KABUL** — Kesin muhasebe/kasa hareketi satınalmada **oluşmaz** | Gate 5 finance | PT-18, PT-28 |
| **P-05** | **KABUL** — İşlem kuru **manuel** zorunlu; dashboard kur bilgi only | Gate 4 | PT-13, PT-14 |
| **P-06** | **KABUL** — V2 UI/CSS **taşınmaz** | Gate 4 | §27 |
| **P-07** | **KABUL** — Fiyat kaydet ≠ sipariş tamamla | Gate 4 | PT-15 |
| **P-08** | **KABUL** — `project_id` talep/satır opsiyonel; BOQ bağlantısı desteklenir | Gate 4 | PT-30 |
| **P-09** | **KABUL** — pending_cost: fiyatsız GR; finalize satınalma/finance | Gate 4–5 | PT-20, PT-21 |
| **P-10** | **KABUL** — Over receive varsayılan %0; under close depocu tek başına değil | Gate 4 + [07](./07-stock-full-blueprint.md) | (stok testleri) |

---

## 31. Kabul kriterleri (Gate 0)

- [ ] Modül tanım cümlesi ve üçlü ayrım onaylandı (§1–§2)
- [ ] Ana akış 7 adım onaylandı (§3)
- [ ] Hub kartları registry/permission onaylandı (§2A, §6)
- [ ] Talep Aç + taslak + revizyon onaylandı (§7–§9)
- [ ] Satınalma Talepleri (Yönetici Onayları yok) onaylandı (§10)
- [ ] Onaycı sınırları onaylandı (§11)
- [ ] Satınalma Fişleri / Siparişi isimlendirme onaylandı (§4, §12)
- [ ] Manuel kur + üstten kopyala; dashboard kur bilgi (§13–§14, [05](./05-country-currency-language.md))
- [ ] Muhasebe bağlantısı; kasa finance onayında (§15, [09](./09-finance-data-contract.md))
- [ ] Mal kabul ayrımı onaylandı (§16, [07](./07-stock-full-blueprint.md))
- [ ] pending_cost onaylandı (§17)
- [ ] Proje/BOQ zinciri onaylandı (§18–§19)
- [ ] Bildirimler tanımlandı (§20)
- [ ] Durum makineleri onaylandı (§21)
- [ ] İzin kataloğu onaylandı (§22)
- [ ] Audit olayları onaylandı (§23)
- [ ] P-01…P-10 Gate 0 **KABUL** (§30)
- [ ] PT-01…PT-30 test planına aktarıldı
- [ ] **Durum: FROZEN** (henüz değil)

**Gate 0 kuralı:** Bu belge **FROZEN** olmadan satınalma modül kodu **yazılmaz**.

---

## 32. Belge durumu

**Versiyon:** 2.0.0 (21.05.2026)

**Önceki:** 1.1.0 — temel PO/GR ayrımı; P1–P6 öneri.

**Bu sürüm:** Tam Gate 0 akış (talep→onay→fiş→muhasebe→GR→stok); hub kartları; revizyon; muhasebe bağlantısı; [05](./05-country-currency-language.md) v1.1.0 uyumu; PT-01…PT-30; P-01…P-10 KABUL.

**Durum: İNCELEMEDE** — FROZEN kararı kullanıcıya aittir.

Gate 0 satınalma kararları kullanıcı HR/satınalma detay dokümanına göre genişletildi; talep/onay/fiş/muhasebe/mal kabul ayrımı, manuel kur ve registry permission yapısı netleştirildi. **FROZEN** proje onayı sonrası.

**Sonraki önerilen adım:** [10-integration-map.md](./10-integration-map.md) (modüller arası entegrasyon) ve [09-finance-data-contract.md](./09-finance-data-contract.md) (ödeme yükümlülüğü hizalama)

### Uygulama Gate özeti

| Konu | Gate |
|------|------|
| Registry/manifest seed | Gate 1 |
| Money/PricingEngine, FX snapshot | Gate 1–4 |
| Talep / onay / revizyon UI | Gate 4 |
| Satınalma fişi / sipariş UI | Gate 4 |
| Muhasebe bağlantı UI | Gate 4–5 |
| Mal kabul | Gate 3–4 ([07-stock](./07-stock-full-blueprint.md)) |
