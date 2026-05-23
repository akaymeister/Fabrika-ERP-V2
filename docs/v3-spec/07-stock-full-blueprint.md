# FactoryOS V3 — Stock Full Blueprint (Stok)

**Belge türü:** Gate 0 domain spec  
**Durum:** ☐ TASLAK | ☑ İNCELEME | ☐ FROZEN  
**Versiyon:** 0.3.0  
**Son güncelleme:** 21.05.2026  
**V2 çalışma oranı (referans):** ~%99 iş kuralı korunur  
**Ürün:** FactoryOS V3 · V2 referans only (kod kopyalanmaz)

**Ana iş kuralı kaynağı:** `FactoryOS-V3/Modül Detayları/02 - Stok Modülü Detayları.docx` — Gate 0 birincil referans; V2 kod yalnızca teknik doğrulama içindir.

**Platform bağımlılıkları (zorunlu uyum):**

- [03-migration-module-registry.md](./03-migration-module-registry.md) **v0.2.0** — registry, manifest, `is_active`/`is_visible`, permission registry, ABAC (MIG-46)
- [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) — redaction, P5 kapanışı, context filter
- [02-admin-control-system.md](./02-admin-control-system.md) — admin registry yönetimi
- [05-country-currency-language.md](./05-country-currency-language.md) — Money, transaction/local/base
- [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) — AppShell, kompakt tablo
- [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) — mal kabul, PO (Gate 0 devam)
- [12-modal-flow-inventory.md](./12-modal-flow-inventory.md) — flowId envanteri

---

## 1. Amaç

FactoryOS V3 **Stok** modülü “mini stok” veya sadece hareket listesi **değildir**. Modül şunları kapsar:

| Alan | Açıklama |
|------|----------|
| Ürün master | Kod, marka, kategori, birim, ölçü yardımcıları |
| Depo | Depo bazlı bakiye ve değerleme |
| Mal kabul | Satınalma fişinden fiziksel giriş |
| Manuel giriş | Talep + onay modeli |
| Ürün çıkış | Proje zorunlu, FIFO |
| Stok kontrol | Bakiye + maliyet (yetkili) |
| Hareketler | Audit, void/replace |
| FIFO / unit-cost | Birincil birim maliyeti |
| Entegrasyon | Satınalma, proje, sevkiyat hazırlığı |
| Envanter / zimmet | Gate 0 KABUL (S3); UI Envanter modül Gate’i |

**V2 korunan:** Hareket disiplini, FIFO tüketim sırası, negatif stok engeli, mal kabul ↔ satınalma ayrımı, void/replace felsefesi.

**V2 taşınmayan (teknik borç):**

| V2 | V3 |
|----|-----|
| `cost_uzs_per_m2` ana maliyet kolonu | `unit_cost_transaction` + `unit_code` |
| `qty_m2_remaining` ana stok bakiyesi | `quantity_remaining` + ürün ana birimi |
| m² legacy FIFO ana model | Unit-cost FIFO, ana birim |
| Hardcoded `UZS` / `SYSTEM` currency | [05](./05-country-currency-language.md) |
| Ürünler sayfasında stok gösterimi | **Yasak** — Stok Kontrol ayrı |
| Frontend maliyet hesabı | **CostEngine** backend only |

**Gate 0 çıktısı:** Bu belge FROZEN olmadan Gate 3 stok migration, API ve UI **yazılmaz**.

---

## 2. Kapsam

| # | Alan | Gate |
|---|------|------|
| 1 | Ürünler / Product Master | Gate 3 MVP |
| 2 | Yeni ürün ekleme popup | Gate 3 |
| 3 | Excel ürün master import | Gate 3 |
| 4 | Markalar | Gate 3 |
| 5 | Kategoriler / alt kategoriler | Gate 3 |
| 6 | Birimler | Gate 3 |
| 7 | Depolar | Gate 3 |
| 8 | Mal Kabul | Gate 3 + [08](./08-purchasing-full-blueprint.md) |
| 9 | Manuel stok giriş talebi / onayı | Gate 3 |
| 10 | Ürün Çıkış | Gate 3 |
| 11 | **Stok Kontrol** (yeni) | Gate 3 |
| 12 | Stok Hareketleri | Gate 3 |
| 13 | FIFO cost layers | Gate 3 |
| 14 | Depo bazlı stok bakiyesi | Gate 3 |
| 15 | Yetki bazlı maliyet görünürlüğü | Gate 3 |
| 16 | Satınalma entegrasyonu | Gate 3–4 |
| 17 | Proje bağlantısı | Gate 3 |
| 18 | Sevkiyat hazırlığı | Mockup → Gate 3.1+ |
| 19 | Envanter / Zimmet hazırlığı | Gate 0 spec; UI mockup sonra |
| 20 | Audit log | Platform |
| 21 | Permission / redaction | Gate 1 seed + Gate 3 |
| 22 | Registry + manifest + permission tanımı | Gate 0 karar ☑ / Gate 1 register |
| 23 | ABAC (depo / proje / fiyat) | Gate 0 karar ☑ / Gate 1 API filter |

---

## 2A. Registry, manifest ve permission uyumu

Bu bölüm [03-migration-module-registry.md](./03-migration-module-registry.md) **v0.2.0** ile **çelişmez**. Stok modülü `navigation.js` / hardcoded menü **kullanmaz**; tüm sayfa, kart ve aksiyonlar **manifest + registry** üzerinden gelir.

### 2A.1 Modül kaydı

| Alan | Değer |
|------|--------|
| `module_key` | `stock` |
| `name_i18n_key` | `menu.module.stock` |
| Manifest | `modules/stock/module.manifest.json` |
| Register | `modules:register --module=stock` (Gate 1) |
| Bağımlılık (örnek) | `purchasing` (mal kabul), `projects` (çıkış/sevkiyat) — [03](./03-migration-module-registry.md) §7 |

### 2A.2 Sayfa registry (`erp_pages`)

| page_key | Menü / ekran | path (örnek) | required_permissions (ANY) | is_active | Not |
|----------|--------------|--------------|----------------------------|-----------|-----|
| `stock.hub` | Modül giriş | `/stock` | `module.stock`, `stock.hub.view` | 1 | Hub |
| `stock.products` | **Ürünler** | `/stock/products` | `stock.products.view` | 1 | **Stok miktarı yok** — §3 |
| `stock.receipts` | **Mal Kabul** | `/stock/receipts` | `stock.receipts.view` | 1 | Satınalma fişi girişi; fiyat ayrı |
| `stock.out` | **Ürün Çıkış** | `/stock/out` | `stock.out.view` | 1 | Proje çıkışı + ABAC §2A.5 |
| `stock.control` | **Stok Kontrol** | `/stock/control` | `stock.control.view` | 1 | Bakiye + maliyet (yetkili) |
| `stock.movements` | Stok hareketleri | `/stock/movements` | `stock.movements.view` | 1 | Audit listesi |
| `stock.warehouses` | **Depolar** | `/stock/warehouses` | `stock.warehouses.view` | 1 | CRUD + sayaçlar |
| `stock.brands` | **Markalar** | `/stock/brands` | `stock.brands.view` | 1 | |
| `stock.categories` | Kategoriler | `/stock/categories` | `stock.categories.view` | 1 | Alt kategori |
| `stock.shipment` | **Sevkiyat** | `/stock/shipment` | `stock.shipment.view` | 1 | Gate 3.1+ UI; registry Gate 0 ☑ |
| `stock.units` | Birimler | `/stock/units` | `stock.units.view` | 0→1 | Master |

**Envanter / zimmet** (ayrı modül veya stock alt ağaç — karar S3):

| page_key | Ekran | required_permissions |
|----------|--------|----------------------|
| `inventory.hub` | Envanter giriş | `module.inventory`, `inventory.assets.view` |
| `inventory.assets` | Envanter kartları | `inventory.assets.view` |
| `inventory.assignments` | Zimmet | `inventory.assignment.view` |

Öneri Gate 0: `module_key=inventory`, manifest `modules/inventory/` — stok fiziksel hareketinden **ayrı** permission ağacı (§20).

### 2A.3 Hub kartları (`erp_page_cards`)

| card_key | Hedef page | required_permissions | Not |
|----------|------------|-------------------|-----|
| `stock.card.products` | `stock.products` | `stock.products.view` | Ürün master |
| `stock.card.receipts` | `stock.receipts` | `stock.receipts.view` | Mal kabul |
| `stock.card.out` | `stock.out` | `stock.out.view` | Ürün çıkış |
| `stock.card.control` | `stock.control` | `stock.control.view` | Stok kontrol |
| `stock.card.shipment` | `stock.shipment` | `stock.shipment.view` | Sevkiyat |
| `stock.card.warehouses` | `stock.warehouses` | `stock.warehouses.view` | Depolar |
| `stock.card.brands` | `stock.brands` | `stock.brands.view` | Markalar |
| `stock.card.inventory` | `inventory.hub` | `inventory.assets.view` | Envanter/zimmet |

Kart `is_visible=0` → hub’da görünmez; `is_active=0` → tıklanamaz + API 403 ([03](./03-migration-module-registry.md) §4).

### 2A.4 Sayfa aksiyonları (`erp_page_actions`) — özet

Her buton ayrı `action_key` + `required_permissions` + opsiyonel `api_method`/`api_path`. Frontend gizleme **yeterli değil** (MIG-16, MIG-17).

#### Ürünler (`stock.products`)

| action_key | İzin | API (örnek) |
|------------|------|-------------|
| `stock.products.create_btn` | `stock.products.create` | POST `/api/stock/products` |
| `stock.products.edit_btn` | `stock.products.edit` | PATCH `/api/stock/products/:id` |
| `stock.products.import_btn` | `stock.products.import` | POST `/api/stock/products/import` |
| `stock.products.deactivate_btn` | `stock.products.edit` | PATCH deactivate |

**Kural:** Hareket görmüş ürün **silinemez**; ad değişimi kısıtlı (DOCX).

#### Mal Kabul (`stock.receipts`)

| action_key | İzin | Not |
|------------|------|-----|
| `stock.receipts.select_po` | `stock.receipts.view` | Fiş listesi |
| `stock.receipts.receive_line` | `stock.receipts.create` | Satır kabul → stok artışı |
| `stock.receipts.over_receive` | `stock.receipts.over_receive.approve` | Fazla miktar onay (talep: `.over_receive.request`) |
| `stock.receipts.under_close` | `stock.receipts.short_close.approve` | Eksik kapatma onay (talep: `.short_close.request`) |
| `stock.receipts.cancel_line` | `stock.receipts.cancel_line_approve` | İptal kalem → satınalma onayı |
| `stock.receipts.manual_in` | `stock.in.manual.create` | Doğrudan manuel giriş (yetkili) |
| `stock.receipts.manual_request` | `stock.in.manual.request` | Talep aç |
| `stock.receipts.manual_approve` | `stock.in.manual.approve` | Talep onayla |
| `stock.receipts.print` | `stock.receipts.print` | Yazdırılabilir form |
| `stock.receipts.view_price` | `stock.cost.view` | Depocu **varsayılan kapalı** |

Satınalma sorumlusu mal kabul **yapamaz** — rol/perm ayrımı (purchasing vs stock.receipts.create).

#### Ürün Çıkış (`stock.out`)

| action_key | İzin | Not |
|------------|------|-----|
| `stock.out.create` | `stock.out.create` | Proje/genel çıkış |
| `stock.out.use_unallocated` | `stock.out.use_unallocated` | Proje dışı stok (FIFO) |
| `stock.out.cross_project` | `stock.out.cross_project` | **Başka proje stoğu** kullanımı — ayrı yetki |
| `stock.out.view_price` | `stock.cost.view` | Birim fiyat görünürlüğü |
| `stock.out.filter_own` | `stock.out.view` | Liste (ABAC proje filtresi) |

#### Stok Kontrol (`stock.control`)

| action_key | İzin |
|------------|------|
| `stock.control.search` | `stock.control.view` |
| `stock.control.export` | `stock.reports.view` |
| `stock.control.view_unit_cost` | `stock.cost.view` |
| `stock.control.view_total_value` | `stock.cost.view` |
| `stock.control.critical_popup` | `stock.control.view` |

#### Depolar / Markalar / Hareketler

| Sayfa | Örnek action | İzin |
|-------|--------------|------|
| `stock.warehouses` | create, edit | `stock.warehouses.create`, `.edit` |
| `stock.brands` | create, edit | `stock.brands.create`, `.edit` |
| `stock.movements` | void, replace | `stock.void.create`, `stock.adjustment.create` |

#### Sevkiyat (`stock.shipment`)

| action_key | İzin |
|------------|------|
| `stock.shipment.create_note` | `stock.shipment.create` |
| `stock.shipment.print` | `stock.shipment.print` |
| `stock.shipment.view_price` | `stock.cost.view` |

Gate 3.1+ tam UI; registry ve permission **Gate 0 tanımlı** (mockup sonra — §19).

### 2A.5 ABAC ve context-based permission (Stok)

[03-migration-module-registry.md](./03-migration-module-registry.md) §17 (MIG-46) + [01-permission](./01-permission-role-position-blueprint.md).

Permission çözümünden **sonra** API sorgularına **context filter** uygulanır:

| Context | Kural | Etkilenen ekran/API |
|---------|--------|---------------------|
| **Depo (`warehouse_id`)** | Kullanıcı yalnızca atandığı depoları görür | Stok Kontrol, Mal Kabul, hareket listesi, bakiye |
| **Proje (`project_id`)** | Proje sorumlusu yalnızca yetkili projelerin **çıkış/sevkiyat** kayıtlarını görür | Ürün çıkış son işlemler, filtre, sevkiyat |
| **Fiyat / maliyet** | `stock.cost.view` **yoksa** birim fiyat, toplam değer, COGS alanları redacted | Stok Kontrol, Mal Kabul (opsiyonel), dashboard |
| **Satınalma rolü** | `purchasing.*` ≠ `stock.receipts.create` | Mal kabul fiziksel giriş depocu |

#### Depo kapsamı (depocu)

| Veri | Filtre |
|------|--------|
| `product_stock_balances` | `warehouse_id IN user.allowed_warehouses` |
| Mal kabul listesi / giriş | Yalnızca yetkili depo |
| Stok Kontrol satırları | Yetkili depo bakiyeleri |

**Atama kaynağı (Gate 1):** `user_warehouse_scopes` veya `employees.default_warehouse_id` + admin atama.

**FAIL:** Depocu A deposu verisini API ile B deposu `warehouse_id` query ile görür.

#### Proje kapsamı (proje sorumlusu)

| Veri | Filtre |
|------|--------|
| Ürün çıkış listesi (son 20) | `project_id IN user.allowed_projects` veya kullanıcı bazlı filtre perm ile |
| Sevkiyat / irsaliye | Aynı proje scope |
| Raporlar | Proje bazlı slice |

Genel kullanım (numune, fire) — `stock.out.create` + `project_id` nullable politika (iş kuralı §12).

#### Fiyat görünürlüğü (ayrı yetki)

| Alan | `stock.cost.view` gerekli |
|------|---------------------------|
| Birim fiyat (Stok Kontrol) | Evet |
| Toplam stok değeri | Evet |
| Mal kabul ekranı fiyat kolonu | Evet (varsayılan gizli) |
| Dashboard stok değeri | Evet |
| Hareket satırı maliyet | Evet |

Depocu: fiziksel miktar görür; fiyat **görmez** (DOCX) — redaction null, sıfır değil.

#### Mal kabul — ayrı işlem yetkileri

| İşlem | Permission | Onay |
|-------|------------|------|
| Normal satır kabul | `stock.receipts.create` | — |
| Fazla kabul | `stock.receipts.over_receive.approve` | Yönetici |
| Eksik kapatma | `stock.receipts.under_receive_close_approve` | Yönetici |
| Kalem iptal (gelmedi) | `stock.receipts.cancel_line_approve` | Satınalma sorumlusu |
| Manuel giriş (direkt) | `stock.in.manual.create` | Yetkili kullanıcı |
| Manuel giriş (talep) | `stock.in.manual.request` → `stock.in.manual.approve` | Onay zinciri |
| Başka proje stoğu kullanımı (çıkış) | `stock.out.cross_project` | Ayrı perm + audit |

### 2A.6 Dashboard widget (stok)

[03](./03-migration-module-registry.md) §15 — örnek `dashboard_widgets`:

| widget_key | Tip | permission |
|------------|-----|------------|
| `stock.widget.critical_count` | report | `stock.control.view` |
| `stock.widget.pending_receipts` | task | `stock.receipts.view` + warehouse scope |
| `stock.widget.warehouse_value` | kpi | `stock.cost.view` |

### 2A.7 Gate 0 / Gate 1 (stok registry)

| Aşama | Deliverable |
|-------|-------------|
| Gate 0 | Bu tablolar + ABAC kuralları + permission listesi **karar** |
| Gate 1 | `modules/stock/module.manifest.json` + `modules:register` + seed permissions |
| Gate 1 | `GET /api/nav` stok dalı; pasif modül 403 |
| Gate 3 | Stok domain API + UI sayfaları |

**Yasak:** Gate 3’te sayfa eklerken registry’yi atlama — yeni sayfa = manifest güncelle + register + permission seed.

---

## 3. Ürünler sayfası kararı

**Kullanıcı raporu kararı (zorunlu):**

> **Ürünler sayfası stok takip alanı değildir.**  
> Ürünler sayfasında **stok gösterilmeyecek.**  
> Ürünler sayfası yalnızca **ürün master** / yeni ürün ekleme / ürün düzenleme alanıdır.

### 3.1 Bu sayfada gösterilebilir

- Ürün listesi
- Yeni ürün ekleme (popup)
- Ürün düzenleme
- Ürün pasifleştirme
- Marka / kategori / birim bilgileri
- Ölçü yardımcı bilgileri (`width_mm`, `m2_per_piece`, …)

### 3.2 Bu sayfada gösterilmeyecek (ana veri olarak)

| Yasak alan | Nerede |
|------------|--------|
| Mevcut stok miktarı | **Stok Kontrol** |
| Stok değeri | Stok Kontrol / dashboard |
| FIFO birim maliyeti | Stok Kontrol (`stock.cost.view`) |
| Depo bazlı bakiye | Stok Kontrol |

**ST-03:** Ürünler sayfasında stok miktarı yok.

---

## 4. Yeni ürün ekleme popup

| İlke | Detay |
|------|--------|
| UI | Merkezi `Modal` — tam sayfa form değil (varsayılan) |
| V2 | Giriş mantığı referans; kod kopyalanmaz |

### 4.1 Popup kullanım yerleri

| Ekran | Koşul |
|-------|--------|
| Ürünler sayfası | `stock.products.create` |
| Satınalma sipariş açma | Ürün bulunamaz + yetki |
| Mal kabul | Ürün bulunamaz + yetki |
| İleride proje / BOQ | Aynı popup bileşeni |

Satınalma: sipariş açan kişi ürünü bulamazsa, yetkisi varsa popup ile **yeni ürün** ekleyebilir.

### 4.2 m² / m³ yardımcı alanlar

Ölçülerden hesaplanan `m2_per_piece`, `m3_per_piece`:

| Kullanım | Durum |
|----------|--------|
| Stok giriş ana miktar | **Hayır** |
| Stok çıkış ana miktar | **Hayır** |
| FIFO maliyet ana birimi | **Hayır** |
| Proje maliyet / BOQ / hesaplama | İleride yardımcı |

---

## 5. Excel ile ürün ekleme

| Kural | Detay |
|-------|--------|
| Permission | `stock.products.import` |
| Kapsam | Yalnızca **ürün master** |
| Stok | Excel import **stok miktarı veya değer oluşturmaz** |

### 5.1 Duplicate inceleme

Import sırasında aynı isimli / eşleşen ürünler:

1. Popup / liste ekranı
2. Eşleşen ürünler gösterilir
3. Düzenle / sil / pasifleştir — yetkiye göre
4. **Duplicate review popup zorunlu** (S4 Gate 0 KABUL): aynı ad+ölçü+marka → duplicate; farklı marka → açılabilir; merge/disable uygulama detayı

### 5.2 Benzersizlik kuralı

| Durum | Sonuç |
|-------|--------|
| Aynı `name` + ölçü + `brand_id` | **Duplicate** |
| Aynı `name` + ölçü, **farklı** marka | Ürün **açılabilir** |

**ST-02, ST-04** ile doğrulanır.

---

## 6. Product master veri modeli (Gate 0 kontrat)

### 6.1 `products`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| product_code | string | Otomatik seri (V2 referans) |
| name | string | toUpperTr |
| brand_id | FK | |
| category_id | FK | |
| subcategory_id | FK? | |
| unit_code | FK → units | **Ana stok birimi** |
| size / dimensions | string? | Görüntü metni |
| width_mm, height_mm, depth_mm, thickness_mm | decimal? | |
| color | string? | |
| material_type | string? | |
| m2_per_piece | decimal? | **Helper only** |
| m3_per_piece | decimal? | **Helper only** |
| is_active | bool | |
| image_asset_id / image_url | FK / string? | İsteğe bağlı ürün fotoğrafı — §6.3 |
| created_by, updated_by | FK | |
| audit | timestamps | |

**Kural:** Ürün hangi `unit_code` ile tanımlandıysa stok giriş/çıkış ve FIFO **o birimden** çalışır.

### 6.3 Ürün fotoğrafı / proje ürün görseli (Gate 0 KABUL)

| Karar | Detay |
|-------|--------|
| Zorunluluk | Fotoğraf **isteğe bağlı** |
| Stok | Fotoğraf **stok oluşturmaz** |
| Maliyet | Fotoğraf **maliyet oluşturmaz** |
| Kapsam | Katalog ürünü, hazır ürün, **BOQ/proje ürünü** görseli |
| Talep formu | BOQ ürün kodu + resim gösterilir (ör. **SND-1234** Y Sandalye) — §18A |
| Kullanım | Satınalma doğrulama, sevkiyat, proje arşivi, maliyet kontrolü (yardımcı veri) |

**Permission:** `stock.products.photo_upload` (katalog); proje BOQ görseli → `projects.boq.photo_upload` veya satınalma modülü izni ([08](./08-purchasing-full-blueprint.md) ile hizalanır).

**ST-35, ST-37**

### 6.2 İlgili master entity’ler

| Entity | Not |
|--------|-----|
| `brands` | §8 |
| `product_categories` | parent/child |
| `units` | §7 |
| `warehouses` | §9 |

---

## 7. Unit model

| unit_code | Açıklama |
|-----------|----------|
| ADET | Adet |
| PLK | Plaka |
| M2 | Metrekare (yalnızca ana birim M2 ise) |
| M3 | Metreküp |
| KG | Kilogram |
| MT | Metre |
| SET | Set |
| KOLİ | Koli |
| PAKET | Paket |

### 7.1 Ana kural

Stok giriş/çıkış ve FIFO maliyet **ürünün ana birimi** (`products.unit_code`) üzerinden çalışır.

**Örnek (kullanıcı raporu):**  
1 PLK MDF = 50 USD → maliyet **1 PLK** üzerinden. Ürün 5,88 m² helper olsa bile FIFO **m² üzerinden yapılmaz**.  
M² yalnızca ürün ana birimi `M2` ise birincil stok birimidir.

**ST-13, ST-14, ST-15, ST-16**

---

## 8. Markalar ve tedarikçi ayrımı

| Entity | Örnek |
|--------|--------|
| `brands` | Blum (marka) |
| `suppliers` | A Tedarikçi, B Tedarikçi |
| `supplier_brands` | Opsiyonel ilişki (Gate 0+) |

**Kullanıcı raporu:** Blum ürünü A veya B tedarikçisinden alınabilir → marka ve tedarikçi **aynı entity olmamalı**.

**Gate 0 KABUL (S1):** Marka ve tedarikçi **ayrı entity**; `supplier_brands` bağlantısı uygulama detayıdır (§27).

---

## 9. Depolar

### 9.1 `warehouses`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| warehouse_code | string | UNIQUE |
| name | string | |
| `warehouse_type` | enum | **Zorunlu** — §9.1.1 |
| location | string? | |
| responsible_person_id | FK employee? | |
| is_active | bool | |
| audit | timestamps | |

#### 9.1.1 Depo tipi (`warehouse_type`)

| Tip | Açıklama |
|-----|----------|
| `physical` | Fiziksel depo (hammadde, üretim vb.) |
| `receiving` | **Kabul deposu** — örn. **Satınalma Depo** |
| `project_reserve` | Proje rezerv alanı |
| `shipment_staging` | Sevkiyat bekleme |
| `inventory` | Envanter deposu (§20) |
| `quarantine` | Karantina / fire |

#### 9.1.2 Satınalma Depo (Gate 0 KABUL)

| Karar | Detay |
|-------|--------|
| Rol | Fiziksel / **kabul** deposu (`warehouse_type=receiving`) |
| Yanlış kullanım yasağı | Sipariş bekleme listesi **değil** — fiziksel stok yalnızca **mal kabul** sonrası |
| Akış | Talep/PO → ürün gelir → **mal kabul** → seçilen depoya (ör. Satınalma Depo) düşer → **projeye çıkış** |
| Stok öncesi | Ürün fiziksel gelmeden Satınalma Depo stoğu **oluşmaz** |

Örnek alt kategori (depo içi organizasyon): *Sandalyeler* — raporlama/ filtre; stok anahtarı yine `product_id` + `warehouse_id`.

**ST-40**

### 9.2 Depo ana sayfa sayaçları

| Sayaç | Görünürlük |
|-------|------------|
| Depodaki ürün çeşidi sayısı | `stock.warehouses.view` |
| Toplam stok miktarı (birim bazlı özet) | `stock.control.view` |
| Toplam stok değeri | `stock.cost.view` |

Örnek: *Hammadde Depo → 1000 ürün, toplam stok değeri X USD*

### 9.3 Depo bazlı bakiye

**Balance key:** `product_id` + `warehouse_id` + `unit_code`

| Kural | Detay |
|-------|--------|
| Aynı ürün, farklı depo | **Ayrı** bakiye satırı |
| Negatif | **Yasak** — işlem öncesi kontrol |

Entity: `product_stock_balances` (veya eşdeğer view + cache tablo).

**ST-05, ST-17**

---

## 10. Mal Kabul (Goods Receipt)

Mal Kabul = satınalma siparişinin **fiziksel** depo girişi.

| İlke | Detay |
|------|--------|
| Kaynak | Aktif satınalma fişleri / PO satırları |
| Akış | Depocu fiş seçer → satır bazlı kabul |
| Stok artışı | **Yalnızca** mal kabul ile |
| Fiyat | Satınalma/finans gerçekliği; fiziksel miktar depo gerçekliği |

### 10.1 Miktar kuralları

| Durum | Davranış |
|-------|----------|
| Gelen > sipariş | `stock.receipts.over_receive.request` → `stock.receipts.over_receive.approve` |
| Gelen < sipariş + kapatma | `stock.receipts.short_close.request` → `stock.receipts.short_close.approve` |
| Partial delivery | Desteklenir |
| Rejected / damaged | **Stok artırmaz** |
| Seri no (envanter) | **Mal kabulde** girilir; PO’da değil |

### 10.2 Satınalma ayrımı

| Taraf | Sorumluluk |
|-------|------------|
| Satınalma fişi | Tedarikçi, fiyat, sipariş durumu |
| Mal kabul | Fiziksel hareket, miktar, depo, seri no |

**ST-06, ST-07, ST-08, ST-21, ST-24**

---

## 11. Manuel stok giriş

### 11.1 P5 — Manuel stok girişi modeli (Gate 0)

| Seçenek | Açıklama |
|---------|----------|
| **A** | Yalnızca `super_admin` |
| **B** | `stock.in.manual_create` doğrudan giriş |
| **C** | Talep → onay → stok girişi |

**Gate 0 KABUL (P5):** **Seçenek C** ana model — talep + onay; `super_admin` override yalnızca acil istisna (§27).

| Rol | Yetki |
|-----|--------|
| Talep | `stock.in.manual.request` |
| Onay | `stock.in.manual.approve` |
| Giriş oluşturma | Onay sonrası sistem / `stock.in.manual_create` |
| Acil düzeltme | `stock.in.manual.override` — **super_admin** istisna |

Manuel giriş **doğrudan serbest işlem değildir**; talep + onay + audit zorunlu.

**ST-09, ST-10, ST-11**

Entity önerisi: `manual_stock_requests` (status: draft → pending → approved → posted | rejected).

---

## 12. Ürün çıkış

Ürün çıkış = **projeye verilen ürün**.

| Alan / kural | Zorunlu |
|--------------|---------|
| `project_id` | **Evet** |
| `warehouse_id` | **Evet** |
| `product_id` | **Evet** |
| `quantity` | Pozitif |
| `unit_code` | Ürün ana birimi ile uyumlu |
| Negatif stok | Engellenir |
| FIFO | Zorunlu — **CostEngine** |
| m²/m³ helper | Çıkış hesabında **kullanılmaz** |

**COGS:** `consumed_quantity × unit_cost` (katman birim maliyeti).

**ST-12, ST-13, ST-18, ST-19**

---

## 13. Stok Kontrol

**Yeni ayrı ekran** — mevcut stokları görmek, araştırmak, depo bazlı incelemek.

| Kolon / özellik | Permission |
|-----------------|------------|
| Ürün, marka, kategori, depo | `stock.control.view` |
| Ana birim, mevcut miktar | `stock.control.view` |
| Minimum stok seviyesi | `stock.control.view` |
| Depo bazlı bakiye | `stock.control.view` |
| Birim maliyet, toplam stok maliyeti | `stock.cost.view` |
| Local / base currency değerleri | `stock.cost.view` |

`stock.cost.view` **yoksa:** `unit_cost`, `total_stock_value`, FIFO layer maliyetleri **redacted** veya omit.

**ST-03, ST-20**

---

## 14. FIFO / unit-cost maliyet modeli

### 14.1 V3 ana karar

**Unit-cost FIFO** — birincil birim üzerinden. m² legacy ana maliyet **taşınmaz**.

**CostEngine** (backend): katman oluşturma, tüketim, COGS — frontend hesap **yapmaz**.

### 14.2 `stock_cost_layers`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| product_id | FK | |
| warehouse_id | FK | Depo bazlı katman |
| source_movement_id | FK | IN hareketi |
| quantity_original | decimal | Giriş miktarı |
| quantity_remaining | decimal | Kalan |
| unit_code | string | Ana birim |
| unit_cost_transaction | decimal | İşlem para biriminde |
| transaction_currency | char(3) | |
| unit_cost_local | decimal | Snapshot |
| unit_cost_base | decimal | Snapshot |
| fx_rate_to_local | decimal | |
| fx_rate_to_base | decimal | |
| pending_cost | bool? | Fiyat yoksa |
| created_at | datetime | |

**YASAK (V3 hedef şemada):** `cost_uzs_per_m2`, `qty_m2_remaining` maliyet/bakiye için.

### 14.3 Formüller

| Olay | Formül |
|------|--------|
| Giriş | `unit_cost = line_total_transaction / primary_quantity` |
| Çıkış COGS | `Σ(consumed_qty × layer.unit_cost)` |
| FIFO | En eski `quantity_remaining > 0` önce |

### 14.4 V2 FIFO öncelik (port referansı)

`layerOutPriority` (V2 `stockMovementService`):

1. Aynı `project_id` katmanları  
2. Genel (proje NULL)  
3. Diğer proje katmanları  
4. `layer.id` ASC (FIFO)

---

## 15. Stock movement model

### 15.1 `stock_movements`

| Alan | Tip | Not |
|------|-----|-----|
| id | PK | |
| movement_type | enum | §15.2 |
| product_id | FK | |
| warehouse_id | FK | |
| quantity | decimal | Pozitif; yön type ile |
| unit_code | string | Ana birim |
| project_id | FK? | OUT için zorunlu |
| source_type | string | PURCHASE_RECEIPT, MANUAL, … |
| source_id | bigint? | |
| movement_date | date/datetime | |
| notes | string? | |
| created_by | FK | |
| audit | timestamps | |

### 15.2 `movement_type`

| Type | Açıklama |
|------|----------|
| IN | Giriş |
| OUT | Çıkış |
| TRANSFER_IN | Depolar arası alıcı |
| TRANSFER_OUT | Gönderen |
| ADJUSTMENT | Sayım düzeltme |
| VOID | İptal karşı kayıt |
| REPLACE | Düzeltme zinciri |
| MANUAL_REQUEST | Talep (henüz stok etkilemez) |
| MANUAL_APPROVED | Onaylı manuel giriş |
| RECEIPT_IN | Mal kabul |
| SHIPMENT_OUT | Sevkiyat (hazırlık) |

**Kural:** Hareket **silinmez**; void/replace/correction ile düzeltilir (§16).

---

## 16. Void / replace / correction workflow

| Akış | Açıklama |
|------|----------|
| Hatalı giriş iptali | VOID IN + FIFO katman restore |
| Hatalı çıkış iptali | VOID OUT + `out_fifo_taken` restore |
| Fiyat düzeltme | Correction / replace + audit |
| Miktar düzeltme | Karşı hareket veya replace |
| Finansal kesinleşmiş | Daha sıkı policy + üst onay |

| Permission | |
|------------|--|
| `stock.void.create` | |
| `stock.adjustment.create` | |

Tüm düzeltmeler **activity_logs** + gerekirse onay modal.

---

## 17. Satınalma entegrasyonu

[08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) ile uyumlu.

| Kural | Detay |
|-------|--------|
| Mal kabul | PO / goods receipt → `RECEIPT_IN` |
| Fiyat yok | `pending_cost = true` |
| Fiyat sonradan | Katman auditli güncelleme veya correction |
| Rejected qty | Stok artırmaz |
| Partial | Desteklenir |
| Buyer completed | Mal kabul **zorunlu değil** (08 kararı) |

**StockPort (taslak sözleşme):**

```text
StockPort.recordIn({ source: 'PURCHASE_RECEIPT', purchaseOrderId, goodsReceiptId, lines[] })
```

**ST-22**

---

## 18. Proje bağlantısı

| Kural | Detay |
|-------|--------|
| Ürün çıkış | `project_id` **zorunlu** |
| `stock_movements.project_id` | Standart alan |
| Amaç | Proje bazlı çıkış raporu; ileride proje maliyeti |

Proje maliyet modülü sonra gelir; stok veri sözleşmesi **şimdiden** hazır.

Detaylı BOQ → talep → mal kabul → çıkış zinciri: **§18A**.

---

## 18A. Proje BOQ ürünü, satınalma talebi ve Satınalma Depo akışı

Gate 0 **onaylı uçtan uca akış** (kullanıcı senaryosu). [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) ile çapraz referans; kayıt türleri burada netleştirilir.

### 18A.1 Senaryo özeti (SND-1234 sandalye örneği)

| Adım | Olay |
|------|------|
| 1 | Proje alındı, sisteme eklendi |
| 2 | BOQ yüklendi |
| 3 | BOQ kalemi: **10 adet Y Sandalye**, ürün kodu **SND-1234**, **ürün resmi** mevcut |
| 4 | Ürün satın alınacak veya fason üretilecek |
| 5 | Depo tarafında **Satınalma Depo** (`warehouse_type=receiving`) tanımlı; alt kategori örn. Sandalyeler |
| 6 | Kullanıcı A **satınalma talebi** açar — Talep No **001** |
| 7 | Depo seçer: **Satınalma Depo** |
| 8 | Ürün kaynağı: **Projeden ürün seç** → BOQ kalemi **SND-1234** |
| 9 | Talep formunda ürün kodu + **resim** görünür |
| 10 | Talep oluşturulur → onaylanır |
| 11 | Satınalma / fason süreci → PO |
| 12 | Ürün fiziksel gelir → **mal kabul** |
| 13 | Stok **Satınalma Depo**’ya düşer (`RECEIPT_IN`) |
| 14 | İleride **projeye çıkış** (`PROJECT_ISSUE_OUT`) |

**ST-36, ST-37, ST-38, ST-39, ST-40, ST-41, ST-42**

### 18A.2 Kavram ayrımı — ne stok değildir

| Kavram | Stok mu? | Fiziksel stok ne zaman? |
|--------|----------|-------------------------|
| **BOQ ürünü / BOQ kalemi** | **Hayır** | Mal kabul sonrası (katalog ürününe bağlanmışsa) |
| **Satınalma talebi** | **Hayır** | — |
| **Satınalma siparişi (PO)** | **Hayır** | — |
| **Mal kabul** | **Evet** — `RECEIPT_IN` | Kabul anı |
| **Projeye çıkış** | **Evet** — tüketim/aktarım | Çıkış anı |
| **Sevkiyat teslim** | BOQ teslim süreci | Çift düşüş yok — §19 |

**Tek kayıt kuralı:** BOQ kalemi, talep kalemi, sipariş kalemi, mal kabul kalemi, stok hareketi ve proje çıkışı **ayrı kayıtlardır**; `source_line_id` / `boq_line_id` / `purchase_request_line_id` / `po_line_id` / `goods_receipt_line_id` / `stock_movement_id` ile **referans zinciri** korunur. Tek satır her şeyin yerine geçmez.

```text
project_boq_line (SND-1234)
    → purchase_request_line (Talep 001)
        → purchase_order_line
            → goods_receipt_line
                → stock_movement RECEIPT_IN (warehouse=Satınalma Depo)
                    → stock_movement PROJECT_ISSUE_OUT (project_id)
                        → (opsiyonel) shipment_delivery_line (BOQ kalan, çift düşüş yok)
```

### 18A.3 Satınalma talep formu — ürün kaynağı

Talep satırı oluştururken en az şu kaynaklar (Gate 0 KABUL):

| Kaynak | İşlev | Stok |
|--------|--------|------|
| **Genel ürün kataloğundan seç** | Mevcut `products` master | Oluşturmaz |
| **Proje/BOQ’den ürün seç** | Mevcut BOQ kalemini talebe bağlar (`boq_line_id`) | Oluşturmaz |
| **Yeni katalog ürünü ekle** | `stock.products.create` (yetki) | Oluşturmaz |
| **Projeye yeni BOQ/proje ürünü ekle** | BOQ’de olmayan yeni kalem (yetki) | Oluşturmaz |

| Ayrım | Açıklama |
|-------|----------|
| Projeden ürün seç | Var olan **SND-1234** gibi kalemi talep satırına bağlar |
| Projeye ürün ekle | BOQ’ye **yeni** kalem ekler (kod, resim, miktar planı) |
| Her ikisi de | Stok **yalnızca mal kabul** sonrası |

**Permission (satınalma — [08](./08-purchasing-full-blueprint.md) seed):** `purchasing.requests.create`, `purchasing.requests.select_from_boq`, `purchasing.requests.select_from_catalog`, `purchasing.boq.add_line`, `stock.products.create`.

**ST-36, ST-38**

### 18A.4 Hazır ürün / proje ürünü (sandalye örneği)

| Karar | Detay |
|-------|--------|
| Hazır ürün | Sandalye, masa vb. — `products` + opsiyonel BOQ bağlantısı |
| Proje ürünü | BOQ satırında planlanan bitmiş ürün (ör. X Model sandalye) |
| BOQ bağlantı | Proje varsa BOQ satırından `product_id` veya `boq_finished_product_id` eşlemesi |
| Sevkiyat | Bitmiş ürün sevk edildiğinde BOQ + stok kuralları §19 |

Ürün kodu **SND-1234** katalog ve BOQ’de **ayrı tutulur**; eşleme tablosu ile bağlanır (karışıklık riski — §26).

### 18A.5 Satınalma Depo bu akışta

- Talep/PO depo hedefi: **Satınalama Depo** (planlama).
- Fiziksel stok: yalnızca **mal kabul** ile oluşur.
- Çıkış: proje için **Ürün Çıkış** ekranından FIFO.

---

## 19. Sevkiyat modülü hazırlığı

**Gate 0 KABUL** (S2 kapatıldı — §27). V3 kapsamındadır; UI mockup/proje modülü hizasına **uygulama Gate’i** atanır (erteleme değil).

### 19.1 Sevkiyat nedir / ne değildir

| | Sevkiyat | Ürün çıkış (hammadde) |
|---|----------|------------------------|
| Amaç | **BOQ / proje teslimat** (bitmiş ürün, irsaliye) | Fiziksel stoktan proje tüketimi |
| Kaynak | Proje yönetimi / BOQ kalan | Depo FIFO |
| Stok etkisi | Kurala göre **tek** fiziksel düşüş | `PROJECT_ISSUE_OUT` |

**Karar:** Sevkiyat **hammadde stok çıkışıyla karıştırılmaz**.

### 19.2 Çift düşüş engeli (Gate 0 KABUL)

| Durum | Davranış |
|-------|----------|
| Ürün önce **projeye çıkış** ile tüketildiyse | Sevkiyat **aynı fiziksel stoğu ikinci kez düşmez** |
| Sevkiyat | BOQ **teslim miktarını** günceller; gerekirse proje/bitmiş ürün durumunu etkiler |
| Aynı ürün hem çıkış hem sevkiyat | Sistem **ST-43 FAIL** — iş kuralı veya workflow kilidi |

**Teknik prensip (Gate 1+):** `shipment_delivery_lines` ↔ `stock_movements` ilişkisi; `already_consumed_by_project_issue` bayrağı veya sevkiyat yalnızca `boq_delivery_status` (fiziksel hareket yok) politikası — uygulama Gate 3.1 detayı.

### 19.3 İşlev ve örnek

| Amaç | Detay |
|------|--------|
| Kaynak | Proje / BOQ |
| İşlem | Kısmi sevk → irsaliye → teslim kaydı |
| Kalan | BOQ kalan miktar güncellenir |

**Örnek:** X dolap BOQ 10 adet → 4 sevk → kalan 6; Y panel 500 m² → 100 m² sevk → kalan 400 m².

| Özellik | Karar |
|---------|--------|
| Form | **Yazdırılabilir** irsaliye (`stock.shipment.delivery_note.print`) |
| Fiyat | `stock.cost.view` — yetkiye tabi |

| Permission | |
|------------|--|
| `stock.shipment.view` | |
| `stock.shipment.create` | |
| `stock.shipment.print` | |
| `stock.shipment.delivery_note.print` | |
| `stock.cost.view` | Fiyat (sevkiyat formunda) |

**ST-23, ST-43**

---

## 20. Envanter / Zimmet

**Mini depo benzeri** ama stoktan farklı davranışlar. Gate 0’da **kapsam** tanımlanır; tam UI mockup sonra.

### 20.1 Kapsam

| Alan | Detay |
|------|--------|
| Fiziksel aletler, makineler, el aletleri | |
| Seri numaralı ürünler | SN mal kabulde |
| Zimmet kayıtları | Personele atama |
| İade formları | Sağlam / kırık / bedel kesintisi |
| Yazdırılabilir zimmet sözleşmesi | 2 sayfa, imzalı arşiv |

### 20.2 Satınalma / mal kabul

| Kural | Detay |
|-------|--------|
| PO | Envanter deposuna alım; **fiyat** PO’da |
| Seri no | **Mal kabulde** depocu girer |
| Manuel envanter girişi | Yetkili; fiyat opsiyonel; audit zorunlu |

### 20.3 Zimmet sözleşmesi

- Personel listeden veya manuel isim
- Çoklu teslim alan
- Ürün bedelleri + toplam bedel
- Yazdır + arşiv
- Zimmetli ürünler sayaçlarda

### 20.4 İade formu alanları

- Ürün sağlam mı?
- Kırık envanterden düşüldü mü?
- Yerine yenisi verildi mi?
- Bedel kesintisi yapıldı mı?

**Gate 0 KABUL (S3):** Envanter/Zimmet V3 kapsamında; `module.inventory` ayrı modül önerisi kabul edilebilir; normal miktarlı stoktan ayrı seri nolu varlık (§27).

**Permission:** `inventory.assets.*`, `inventory.assignment.*` (§22)

**ST-24, ST-25, ST-26**

---

## 21. Stok dashboard / valuation

Stok Kontrol veya hub dashboard:

| Metrik | Permission |
|--------|------------|
| Depo bazlı stok değeri | `stock.cost.view` |
| Ürün / kategori bazlı değer | `stock.cost.view` |
| Local / base toplamları | `stock.cost.view` |
| FIFO maliyeti olmayan ürün uyarısı | `stock.control.view` |
| Hammadde depo ürün sayısı | `stock.control.view` |

**Formül:** `SUM(quantity_remaining × unit_cost)` — local/base snapshot ([05](./05-country-currency-language.md)).

**Yasak:** Sessiz list-price fallback (V2 dashboard gap).

Maliyet `stock.cost.view` olmadan **gösterilmez**.

---

## 22. Permissions

**Otorite:** Tam sayfa/kart/aksiyon eşlemesi → **§2A**. Manifest seed listesi aşağıdadır; yeni izin = manifest + `permissions` tablosu + register.

### 22.1 Modül

| perm_key | Açıklama |
|----------|----------|
| `module.stock` | Modül erişimi (hub + nav) |
| `module.inventory` | Envanter/zimmet (S3 — ayrı modül önerisi) |

### 22.2 Manifest permission kataloğu (seed)

| perm_key | Açıklama | Registry bağlantısı |
|----------|----------|---------------------|
| `stock.hub.view` | Hub | `stock.hub` |
| `stock.products.view` | Ürün listesi | `stock.products` |
| `stock.products.create` | Yeni ürün popup | action create_btn |
| `stock.products.edit` | Düzenle | action edit_btn |
| `stock.products.import` | Excel import | action import_btn |
| `stock.products.photo_upload` | Ürün / BOQ görseli yükleme | §6.3 |
| `stock.products.disable` | Pasifleştir (sil yerine) | |
| `stock.products.revision` | Revizyon geçmişi görüntüleme | |
| `stock.brands.view` / `.create` / `.edit` | Markalar | `stock.brands` |
| `stock.categories.view` / `.edit` | Kategoriler | `stock.categories` |
| `stock.warehouses.view` / `.create` / `.edit` | Depolar | `stock.warehouses` |
| `stock.control.view` | Stok Kontrol | `stock.control` |
| `stock.cost.view` | **Fiyat/maliyet** (redaction) | ABAC §2A.5 |
| `stock.receipts.view` | Mal kabul ekranı | `stock.receipts` |
| `stock.receipts.create` | Satır kabul | action receive_line |
| `stock.receipts.over_receive.request` | Fazla kabul talebi | |
| `stock.receipts.over_receive.approve` | Fazla kabul onay | (≈ `over_receive_approve`) |
| `stock.receipts.short_close.request` | Eksik kapatma talebi | |
| `stock.receipts.short_close.approve` | Eksik kapatma onay | (≈ `under_receive_close_approve`) |
| `stock.receipts.price.view` | Mal kabul fiyat kolonu | `stock.cost.view` ile aynı kapı |
| `stock.receipts.cancel_line_approve` | Kalem iptal onay | |
| `stock.receipts.print` | Mal kabul yazdır | |
| `stock.in.manual.request` | Manuel giriş talebi | |
| `stock.in.manual.approve` | Manuel onay | |
| `stock.in.manual.create` | Doğrudan manuel giriş | |
| `stock.in.manual.override` | Süper Yönetim acil | |
| `stock.out.view` | Ürün çıkış listesi | `stock.out` |
| `stock.out.create` | Çıkış oluştur | |
| `stock.out.use_unallocated` | Tahsis edilmemiş stok (FIFO) | |
| `stock.out.cross_project` | **Başka proje stoğu** kullanımı | |
| `stock.out.cross_project_use` | Başka proje stoğu (onaylı) | §2A / ST-46 |
| `stock.movements.view` | Hareketler | `stock.movements` |
| `stock.adjustment.create` | Düzeltme | |
| `stock.void.create` | İptal/void | |
| `stock.reports.view` | Rapor export | |
| `stock.shipment.view` / `.create` / `.print` | Sevkiyat | `stock.shipment` |
| `stock.shipment.delivery_note.print` | İrsaliye yazdır | §19 |
| `inventory.assets.view` / `.create` / `.edit` | Envanter | `inventory.*` |
| `inventory.assets.serial.manage` | Seri no (mal kabul) | ST-47 |
| `inventory.assets.dispose` | Arızalı düşüm | |
| `inventory.assignment.view` / `.create` / `.return` | Zimmet | |
| `inventory.assignment.agreement.print` | Zimmet sözleşmesi yazdır | ST-48 |
| `inventory.assignment.return` | İade formu | |

**İsimlendirme:** [03](./03-migration-module-registry.md) §5 — `{module}.{resource}.{action}`.

**P5 kapanışı:** [01-permission](./01-permission-role-position-blueprint.md) §P5 → **Seçenek C** (talep + onay).

---

## 23. UI / modal flows

[00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) — açık tema, kompakt tablo, AppShell.

| flowId | Açıklama |
|--------|----------|
| stock.product.create | Yeni ürün popup |
| stock.product.edit | Ürün düzenleme |
| stock.product.importExcel | Excel import |
| stock.product.duplicateReview | Duplicate liste |
| stock.brand.create | Marka |
| stock.warehouse.create | Depo |
| stock.receipt.selectPO | Mal kabul fiş seçimi |
| stock.receipt.receive | Satır kabul |
| stock.receipt.overReceiveApproval | Fazla miktar |
| stock.receipt.underReceiveCloseApproval | Eksik kapatma |
| stock.manual.request | Manuel talep |
| stock.manual.approve | Onay |
| stock.out.projectIssue | Proje çıkışı |
| stock.control.filter | Stok Kontrol filtre |
| stock.fifoLayer.detail | Katman detay |
| stock.void.confirm | İptal onayı |
| stock.shipment.createDeliveryNote | Sevkiyat / irsaliye |
| purchasing.request.selectFromBoq | Projeden ürün seç (Talep 001) |
| purchasing.request.selectFromCatalog | Katalogdan ürün seç |
| purchasing.boq.addLine | Projeye yeni BOQ kalemi |
| stock.product.photoUpload | Ürün fotoğrafı |
| inventory.assetCreate | Envanter kartı |
| inventory.serialEntry | Seri no (mal kabul) |
| inventory.assign | Zimmet |
| inventory.return | İade formu |
| inventory.printAgreement | Zimmet sözleşmesi yazdır |

Detay envanter → [12-modal-flow-inventory.md](./12-modal-flow-inventory.md).

### 23.2 Satınalma talep formu — ürün kaynağı akışları

[08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) ile hizalı modal/ekran akışları (§18A.3):

| flowId | Kaynak | Stok oluşturur? |
|--------|--------|-----------------|
| `purchasing.request.selectFromCatalog` | Genel katalog | Hayır |
| `purchasing.request.selectFromBoq` | Proje/BOQ (ör. SND-1234 + resim) | Hayır |
| `stock.product.create` | Yeni katalog ürünü (yetki) | Hayır |
| `purchasing.boq.addLine` | Yeni BOQ/proje ürünü (yetki) | Hayır |

Talep onayı ve PO sonrası bile stok **yalnızca** `stock.receipt.receive` (mal kabul) ile oluşur.

### 23.1 Sayfa kayıtları (registry)

Tam tablo: **§2A.2** (path, permissions, kartlar, aksiyonlar). Özet:

| page_key | DOCX menü |
|----------|-----------|
| `stock.products` | Ürünler |
| `stock.receipts` | Mal Kabul |
| `stock.out` | Ürün Çıkış |
| `stock.control` | Stok Kontrol |
| `stock.shipment` | Sevkiyat |
| `stock.warehouses` | Depolar |
| `stock.brands` | Markalar |
| `inventory.*` | Envanter / Zimmet |

---

## 24. V2 referans noktaları

| Konu | V2 dosya / alan |
|------|-----------------|
| Hareket servisi | `backend/services/stockMovementService.js` |
| FIFO katman | `backend/services/stockCostLayerService.js` — `cost_uzs_per_m2` **ters örnek** |
| Şema | `database/schema/004_*.sql`, `010_stock_movements_primary_fields.sql` |
| Frontend | `frontend/public/stock*.html`, `stock-products.html` |
| Mal kabul | `purchasingService.js` goods receipt |
| Negatif stok | movement öncesi bakiye kontrolü |
| Void/replace | patch-008, movement meta |
| Dashboard değerleme | `dashboardService.js` — m² FIFO gap |
| Ürün kodu | product code generation |
| i18n | `frontend/public/i18n/*.json` stok anahtarları |

---

## 25. Test / doğrulama senaryoları

| ID | Senaryo | Beklenen |
|----|---------|----------|
| ST-01 | Ürün oluştur | 201 + product_code |
| ST-02 | Aynı isim/ölçü farklı marka | İzin verilir |
| ST-03 | Ürünler sayfası | Stok miktarı yok |
| ST-04 | Excel import | Stok oluşturmaz |
| ST-05 | Depo oluştur | warehouse_code |
| ST-06 | Mal kabul | RECEIPT_IN + katman |
| ST-07 | Fazla kabul | Onay gerekir |
| ST-08 | Eksik kapatma | Onay gerekir |
| ST-09 | Manuel talep | Request kaydı |
| ST-10 | Onaysız manuel | Stok artmaz |
| ST-11 | Onaylı manuel | Stok artar |
| ST-12 | Ürün çıkış | project_id zorunlu |
| ST-13 | PLK FIFO | PLK biriminde tüketim |
| ST-14 | ADET FIFO | ADET biriminde |
| ST-15 | M2 ana birim | M2 FIFO |
| ST-16 | m2_per_piece | Çıkış ana hesabı değil |
| ST-17 | Çoklu depo | Ayrı bakiye |
| ST-18 | Negatif stok | 400/409 |
| ST-19 | COGS | Doğru toplam |
| ST-20 | cost.view yok | Redaction |
| ST-21 | Rejected qty | Stok artmaz |
| ST-22 | pending_cost | Flag + sonra düzeltme |
| ST-23 | Sevkiyat BOQ | Kalan miktar (modül hazır) |
| ST-24 | Seri no | Mal kabulde |
| ST-25 | Zimmet | Toplam bedel |
| ST-26 | İade formu | Kırık/sağlam/kesinti |
| ST-27 | Responsive | 1366/1024/768 |
| ST-28 | Registry pasif sayfa | `is_active=0` → API 403 |
| ST-29 | Depocu depo ABAC | B depo verisi görünmez |
| ST-30 | Proje sorumlusu ABAC | Yetkisiz proje çıkışı görünmez |
| ST-31 | cost.view yok | Mal kabul fiyat kolonu gizli |
| ST-32 | cross_project yok | Başka proje stoğu 403 |
| ST-33 | over_receive onaysız | Stok artmaz |
| ST-34 | Manifest register | `modules:register --module=stock` idempotent |
| ST-35 | Ürün fotoğrafı | Yüklenir; stok oluşmaz |
| ST-36 | BOQ ürünü talep | `boq_line_id` bağlı talep satırı |
| ST-37 | SND-1234 resim | Talep formunda görünür |
| ST-38 | Projeden seçim | Stok oluşmaz |
| ST-39 | Talep onayı sonrası | Mal kabul yok → bakiye 0 |
| ST-40 | Mal kabul | Satınalma Depo bakiyesi artar |
| ST-41 | Proje çıkış | Ayrı `PROJECT_ISSUE_OUT` hareketi |
| ST-42 | Referans zinciri | BOQ→talep→PO→GR→movement zinciri bozulmaz |
| ST-43 | Sevkiyat çift düşüş | İkinci fiziksel düşüş yok |
| ST-44 | Depocu fiyat | Maliyet alanları redacted |
| ST-45 | cost.view var | Stok değeri görünür |
| ST-46 | cross_project | Onay/perm olmadan 403 |
| ST-47 | Seri no | PO’da değil; mal kabulde |
| ST-48 | Zimmet sözleşmesi | Yazdırılabilir PDF/HTML |
| ST-49 | Kritik stok bildirimi | Günlük özet (depo/yönetici) |

---

## 26. Riskler

| Risk | Azaltma |
|------|---------|
| Ürünler = stok takip | §3 kararı; ST-03; UX review |
| m² helper ana miktar sayılır | §7, §12; ST-16 |
| Manuel giriş serbest | P5 Seçenek C; ST-10/11 |
| Mal kabul = fiyat karışımı | §10, §17 ayrımı |
| project_id unutulur | API zorunlu; ST-12 |
| Envanter/stok karışımı | S3; ayrı permission |
| Marka=supplier tek entity | S1 ayrı tut |
| Maliyet sızıntısı | `stock.cost.view`; ST-20, ST-31 |
| ABAC bypass | ST-29, ST-30; API filter zorunlu |
| Registry drift | Manifest + register; ST-34 |
| BOQ ürünü = stok sanılması | §18A.2; ST-38, ST-39 |
| Projeden seçim stok yaratır | §18A.3; ST-38 |
| Talep/PO = stok | §18A.2; ST-39 |
| Mal kabul olmadan stok | ST-39, ST-40 |
| Satınalma Depo = sipariş listesi | §9.1.2 |
| SND-1234 / BOQ-katalog karışımı | Eşleme tablosu; §18A.4 |
| Sevkiyat çift düşüş | §19.2; ST-43 |
| Depocu fiyat sızıntısı | `stock.cost.view`; ST-44 |
| Envanter = miktar stok | S3; seri no; ST-47 |
| Seri no PO’da | §20.2; ST-47 |
| Marka = tedarikçi | S1 Gate 0 KABUL |
| Birim karışık toplam | Birim bazlı özet; ST-17 |
| m² legacy geri gelir | Şema review; yasak kolon listesi |

---

## 27. Açık kararlar

Gate 0’da **KABUL**; uygulama detayı ayrı Gate’te (belirsiz “sonra bakılır” yok).

| # | Gate 0 karar | Uygulama Gate | Not |
|---|--------------|---------------|-----|
| **S1** | **KABUL** — Marka ve tedarikçi **ayrı entity** | Gate 3 | `supplier_brands` bağlantısı uygulama detayı |
| **P5** | **KABUL** — Talep + onay ana model | Gate 3 | `super_admin` override yalnızca acil istisna |
| **S2** | **KABUL** — Sevkiyat V3 kapsamında; BOQ teslim süreci, hammadde çıkışından ayrı | Gate 3.1+ UI | Mockup/proje modülü hizası; §19 |
| **S3** | **KABUL** — Envanter/Zimmet V3 kapsamında; seri nolu varlık; `module.inventory` ayrı modül | Envanter modül Gate’i | Normal stoktan ayrı; §20 |
| **S4** | **KABUL** — Duplicate review popup **zorunlu**; aynı ad+ölçü+marka duplicate; farklı marka açılabilir | Gate 3 | Merge/disable uygulama detayı |

---

## 28. Kabul kriterleri (Gate 0)

- [ ] Stok kapsamı mini değil **tam** onaylandı (§2)
- [ ] Ürünler sayfasının stok takip **olmadığı** onaylandı (§3)
- [ ] Product master modeli onaylandı (§6)
- [ ] Excel import stok oluşturmaz onaylandı (§5)
- [ ] Marka/tedarikçi ayrımı işaretlendi (§8, S1)
- [ ] Depo bazlı stok onaylandı (§9)
- [ ] Mal kabul / satınalma ayrımı onaylandı (§10, §17)
- [ ] Manuel giriş **P5 Seçenek C** onaylandı veya resmi karar (§11)
- [ ] Ürün çıkış `project_id` zorunlu onaylandı (§12)
- [ ] Unit-cost FIFO onaylandı; m² legacy **yok** (§14)
- [ ] m²/m³ helper stok ana hesabı **değil** onaylandı (§4, §7)
- [ ] Stok Kontrol ayrı alan onaylandı (§13)
- [ ] Maliyet redaction onaylandı (§13, §21)
- [ ] Sevkiyat hazırlık kapsamı onaylandı (§19)
- [ ] Envanter/zimmet kapsamı işaretlendi (§20, S3)
- [ ] ST-01…ST-49 test planına aktarıldı
- [ ] P5 [01-permission](./01-permission-role-position-blueprint.md) ile hizalandı (Gate 0 KABUL)
- [ ] Registry + manifest + permission (§2A) [03](./03-migration-module-registry.md) v0.2.0 ile uyumlu
- [ ] ABAC depo / proje / fiyat (§2A.5) onaylandı
- [ ] Mal kabul ayrı işlem yetkileri onaylandı
- [ ] ST-28…ST-34 test planına eklendi
- [ ] Ürün fotoğrafı isteğe bağlı; stok/maliyet oluşturmaz (§6.3)
- [ ] Proje/BOQ ürün resmi talep formunda gösterilebilir (§18A)
- [ ] BOQ ürünü / talep / PO **stok değildir** (§18A.2)
- [ ] Mal kabul fiziksel stok; projeye çıkış tüketim (§18A.2)
- [ ] Projeden ürün seç vs projeye ürün ekle ayrımı (§18A.3)
- [ ] SND-1234 sandalye örneği işlendi (§18A.1)
- [ ] Satınalma Depo kabul deposu tanımı (§9.1.2)
- [ ] Mal kabul sonrası seçilen depoya düşüş (§18A.5)
- [ ] Sevkiyat çift stok düşüşü engeli (§19.2)
- [ ] Envanter seri nolu varlık; normal stoktan ayrı (S3)
- [ ] S1/S2/S3/S4 Gate 0 **KABUL** (§27)
- [ ] **Durum: FROZEN** (henüz değil)

**Gate 0 kuralı:** Bu belge **FROZEN** olmadan stok modül kodu **yazılmaz**.

---

## 29. Belge durumu

**Versiyon:** 0.3.0 (21.05.2026)

**Önceki:** 0.2.0 — §2A registry/manifest/ABAC; [03-migration-module-registry.md](./03-migration-module-registry.md) v0.2.0 uyumu.

**Bu sürüm:** §18A BOQ/talep/mal kabul/çıkış ayrımı; ürün görseli; Satınalma Depo; sevkiyat çift düşüş; S1–S4 Gate 0 KABUL; ST-35…ST-49.

**Durum: İNCELEMEDE** — Henüz FROZEN değil.

Gate 0 stok kararları genişletildi; BOQ/proje/satınalma/mal kabul/projeye çıkış ayrımı eklendi. **FROZEN** proje onayı sonrası.

**Sonraki önerilen spec:** [08-purchasing-full-blueprint.md](./08-purchasing-full-blueprint.md) (talep formu BOQ seçimi ile hizalama), [09-finance-data-contract.md](./09-finance-data-contract.md)

### Uygulama Gate’i atanan alanlar (karar KABUL — kod sonra)

| Konu | Uygulama Gate |
|------|----------------|
| Registry/manifest seed | Gate 1 |
| ABAC depo/proje filter | Gate 1–3 |
| BOQ→talep→PO→GR referans şeması | Gate 3 + [08](./08-purchasing-full-blueprint.md) |
| Sevkiyat UI + çift düşüş motoru | Gate 3.1+ |
| Envanter/zimmet modül | Envanter Gate |
| Satınalma talep “Projeden seç” UI | [08](./08-purchasing-full-blueprint.md) Gate 3 |
| Kritik stok günlük bildirim | Gate 3 (job) |
