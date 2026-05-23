# FactoryOS V3 — Gate / Kabul Kriterleri Dokümanı

**Takvim bazlı değil, tamamlanma kriteri bazlı V3 planı**

**Ana karar:** V3 için süre hedefi yoktur. Her aşama, yalnızca kabul kriterleri tamamlandığında kapanır. Hızlı demo değil; V4 gerektirmeyecek merkezi UI, güçlü admin panel, sağlam migration, doğru currency ve doğru stok maliyet temeli hedeflenir.

---

## 1. Temel Yaklaşım

Bu doküman FactoryOS V3 için takvim yerine **Gate / Kabul Kriteri** sistemi tanımlar. V1 ve V2’de hızlı ilerleme sonucu modüller sonradan birbirine bağlandı; UI tutarsızlığı, patch karmaşası, hardcoded para birimi, m² tabanlı eski FIFO maliyeti ve permission dağınıklığı oluştu. **V3’te aynı hata tekrarlanmayacak.**

**V2 yok sayılmayacak.** V2, çalışan HR, stok ve satınalma iş mantığı için referans sistemdir. Ancak V2’nin dağınık UI/CSS yapısı, patch zinciri, eski maliyet modeli ve dağınık permission kontrolleri V3’e taşınmayacaktır.

---

## 2. Gate Sisteminin Ana Kuralı

- Bir sonraki Gate’e **tarih dolduğu için değil**, mevcut Gate’in **kabul kriterleri tamamlandığı** için geçilir.
- Her modül başlamadan önce V2 iş kuralları, V2 ekranları, modal/popup akışları, migration ihtiyacı, permission anahtarları ve test senaryoları **yazılı** olmalıdır.
- **Eksik analizle kod yazılmaz.** Eksik analiz V3’ü tekrar patch zincirine sürükler.
- Frontend yalnızca sunum yapar; hesap/formül ve kritik doğrulama **backend/domain servislerinde** tek merkezde olur.
- Yeni modül veya yeni kolon ekleme işlemleri **migration/module registry** sistemiyle yapılır; rastgele patch dosyası kültürü oluşturulmaz.

---

## 3. Gate Özet Tablosu

| Gate | Ad | Ana Amaç | Sonraki İşe Geçiş Şartı |
|------|-----|----------|---------------------------|
| **0** | Master Blueprint Freeze | Kod başlamadan tüm mimari ve modül kurallarını kilitlemek | Blueprint, entegrasyon haritası ve V2 referansları onaylanmış olmalı |
| **1** | Core System Ready | Merkezi UI, admin, migration, registry, config ve güvenlik omurgasını kurmak | Core altyapı responsive ve permission testlerinden geçmiş olmalı |
| **2** | HR Ready | V2 HR mantığını merkezi sisteme tam ve güvenli taşımak | Personel, maaş, puantaj, kilit, snapshot, permission görünürlüğü tamam olmalı |
| **3** | Stock Ready | Depo bazlı, unit_cost FIFO kullanan stok omurgasını kurmak | M² legacy ana model olmadan stok giriş/çıkış/FIFO çalışmalı |
| **4** | Purchasing Ready | V2 satınalma workflow’unu merkezi approval/modal sistemiyle taşımak | Talep, onay, fiyat, mal kabul, partial delivery ve pending cost hazır olmalı |
| **5** | Finance Tracking Ready | Resmi muhasebe değil, operasyonel finans takibini kurmak | Cari, kasa/banka, fatura, ödeme, açılış bakiyesi ve bağlantılar net olmalı |

---

## Gate 0 — Master Blueprint Freeze

### Amaç

Kod başlamadan önce tüm V3 mimarisini, modül kapsamlarını, entegrasyonları, V2’den taşınacak/taşınmayacak kararları ve kabul kriterlerini kilitlemek.

### Kapsam

- Central UI Design System blueprint
- Admin Control System blueprint
- Migration & Module Registry blueprint
- Permission / role / position permission blueprint
- Country / Currency / Language blueprint
- HR Full Blueprint
- Stock Full Blueprint
- Purchasing Full Blueprint
- Finance Tracking Data Contract
- Integration Map
- Modal Flow Inventory
- V2’den taşınacaklar / taşınmayacaklar listesi

**Spec dosyaları:** `docs/v3-spec/` (bkz. README)

### Kabul Kriterleri

- [ ] V3’te kullanılacak UI bileşenleri ve sayfa özel CSS yasağı yazılı olmalı.
- [ ] Admin registry tabloları ve modül manifest kuralı net olmalı.
- [ ] Migration runner, schema_migrations, migration_runs, seed ayrımı ve checksum kuralı net olmalı.
- [ ] local_currency, base_reporting_currency, transaction currency ve USD’nin korunması kuralları net olmalı.
- [ ] HR, Stock, Purchasing ve Finance için tam kapsam yazılı olmalı; mini veya eksik modül yaklaşımı olmamalı.
- [ ] Stokta m² legacy maliyet modelinin taşınmayacağı açıkça yazılmış olmalı.
- [ ] Satınalmada fiyat kaydetme, mal kabul, stok hareketi ve finansal kesinleşme ayrımı yazılı olmalı.
- [ ] V2 popup/modal akışları flowId mantığıyla envantere alınmış olmalı (≥20 kayıt).

### Riskler

- Eksik blueprint ile koda başlanırsa V3 de V2 gibi patch zincirine dönebilir.
- Modül bağlantıları baştan çizilmezse HR, stok, satınalma ve finans sonradan kopuk bağlanır.
- Currency veya FIFO kararları netleşmezse finans modülü yanlış veri üzerine kurulur.

### Test / Doğrulama Senaryoları

- Her blueprint başlığı için onay kutusu listesi hazırlanır (`00-gate0-checklist.md`).
- V2 ekranları ve servisleri referans gösterilerek modül kapsamı doğrulanır.
- Bir modülün bağlı olduğu diğer modüller integration map üzerinde işaretlenir (≥10 sözleşme).

### V2 Referans Noktaları

- **V2 HR:** personel, maaş, puantaj, ay kilidi, payroll snapshot, permission visibility.
- **V2 Stock:** ürün, depo, giriş/çıkış, hareket, FIFO, void/replace.
- **V2 Purchasing:** talep, onay, sipariş, fiyatlandırma, mal kabul, kısmi teslimat.
- **V2 Admin:** log, backup, kullanıcı/rol/permission deneyimi.

### Bu Gate Tamamlanmadan Başlanmayacak İşler

- V3 repo geliştirmesine tam kapsamlı başlanmayacak.
- Core UI/Admin/Migration kodu yazılmayacak.
- HR/Stock/Purchasing modül kodlarına başlanmayacak.

---

## Gate 1 — Core System Ready

### Amaç

Tüm modülleri taşıyacak merkezi UI, admin panel, registry, migration, config, permission, audit ve backup omurgasını kurmak.

### Kapsam

- AppShell, Sidebar, Topbar, PageHeader, Card
- Button, DataTable, Modal, ConfirmDialog, Toast
- FormField, FilterBar, Tabs, Pagination, Badge
- CurrencyField, DateField
- Admin module/page/card/action registry
- PermissionGate / RegistryGate
- Migration runner, schema_migrations, migration_runs
- Module manifest ve modules:register
- Seed separation
- Public config: locale, localCurrency, baseReportingCurrency
- Audit log middleware
- Manual backup temel altyapısı
- Responsive test matrix (1366, 1024, 768, mobil)

### Kabul Kriterleri

- [ ] Yeni bir sayfa özel CSS yazmadan merkezi AppShell içine eklenebilmeli.
- [ ] Admin panelden modül/sayfa pasif yapılınca hem menüden gizlenmeli hem API erişimi engellenmeli.
- [ ] Migration runner status, checksum ve failed log üretebilmeli.
- [ ] localStorage yoksa default_locale devreye girmeli.
- [ ] Yeni formlarda local_currency varsayılan olarak kullanılmalı; USD kayıtlar USD kalmalı.
- [ ] DataTable hiçbir ekranda kart dışına taşmamalı; wrapper içinde yatay scroll olmalı.
- [ ] Modal/Confirm/Toast tüm modüller için tek merkezden çalışmalı.
- [ ] 1366, 1024, 768 ve mobil kontrol testleri temel demo sayfalarında geçmeli.

### Riskler

- UI paketi zayıf kurulursa her modül yeniden özel CSS yazmaya başlar.
- Admin registry sadece frontend’de kalırsa güvenlik açığı oluşur.
- Migration sistemi zayıf olursa yeni kolon ve modül eklemeleri yine patch doğurur.

### Test / Doğrulama Senaryoları

- Demo modül oluştur: manifest + migration + registry + permission + i18n ile görünmeli.
- Pasif sayfaya doğrudan URL/API isteği 403 dönmeli.
- Tablo test verisi 1024 genişlikte taşmamalı.
- Default locale ve local currency yeni tarayıcı/localStorage boş senaryoda doğru gelmeli.

### V2 Referans Noktaları

- V2 admin-users, admin-permissions, admin-settings, admin-logs, admin-backup deneyimi.
- V2 navigation ve permission eksikleri.
- V2 style.css ve sayfa bazlı responsive sorunları.

### Bu Gate Tamamlanmadan Başlanmayacak İşler

- HR modülü kodlaması başlamayacak.
- Stock ve Purchasing modülleri eklenmeyecek.
- Finance Tracking veri tabanı oluşturulmayacak.

---

## Gate 2 — HR Ready

### Amaç

V2’de büyük ölçüde çalışan HR modülünü eksik/mini yapmadan, merkezi UI/admin/permission/currency yapısına uygun şekilde V3’e taşımak.

### Kapsam

- Employee profile tam alan seti
- Department, position, user link
- Role/permission/position permission bağlantısı
- Nationality, address, hire date, **termination date**
- Salary structure, official/unofficial split
- Salary currency ve local/USD ayrımı
- Overtime eligible
- Attendance daily/monthly
- Day types, work statuses, overtime minutes
- Monthly lock
- Payroll snapshot
- Permission-based salary visibility
- Profile integration
- Finance payment tracking hazırlığı

### Kabul Kriterleri

- [ ] V2 computeWageBreakdown veya eşdeğer **WageEngine** tek merkezde çalışmalı; frontend maaş hesabı yapmamalı.
- [ ] Maaş alanları permission yoksa API cevabında **redacted** olmalı (liste **ve detay**).
- [ ] employee.user_id ilişkisi tutarlı ve duplicate personel oluşturmayan şekilde çalışmalı.
- [ ] termination_date ve termination_reason V3 veri modelinde olmalı.
- [ ] Ay kilidi oluşunca payroll snapshot donmalı.
- [ ] USD maaş USD olarak korunmalı; local maaş local_currency ile çalışmalı.
- [ ] Puantaj dakika bazlı hesaplanmalı; 100’lük saat hatası olmamalı.
- [ ] HR modal flows merkezi Modal/Confirm sistemiyle çalışmalı.

### Riskler

- Maaş görünürlüğü kaçarsa ciddi güvenlik sorunu oluşur.
- Payroll formülü frontend/backend iki yere kopyalanırsa tutarsızlık çıkar.
- HR ile user/permission ilişkisi zayıf kurulursa satınalma onay sistemi de zayıflar.

### Test / Doğrulama Senaryoları

- USD maaşlı, local maaşlı, official/unofficial maaşlı çalışan testleri.
- Overtime eligible true/false testleri.
- Puantaj günlük giriş, aylık liste, ay kilidi ve snapshot testleri.
- Maaş permission olmayan kullanıcı ile API ve UI testleri.
- Çıkış tarihi girilmiş personelin aktif listeden ayrılması testi.

### V2 Referans Noktaları

- V2 hrService, hr-employee-form, hr-attendance, hr-attendance-monthly, hr-payroll.
- V2 compensation history ve payroll snapshot mantığı.
- V2 salary permission/redaction eksikleri (detay API sızıntısı).

### Bu Gate Tamamlanmadan Başlanmayacak İşler

- Satınalma onaycı/personel bağlantısı HR hazır olmadan kurulmayacak.
- Finance employee payment/advance bağlantısı kurulmayacak.
- Payroll advanced dispute ekranları core HR sağlamlaşmadan genişletilmeyecek.

---

## Gate 3 — Stock Ready

### Amaç

V2’de çalışan stok mantığını koruyarak, fakat m² legacy maliyet modelini taşımadan, **depo bazlı** ve **unit_cost FIFO** temelli stok sistemini kurmak.

### Kapsam

- Products, brands, **categories**, units
- Warehouses ve **depo bazlı bakiye** altyapısı
- Stock in, stock out, stock movements
- Product stock balances: product_id + warehouse_id + unit
- Unit_cost FIFO
- quantity + unit + unit_cost
- remaining_quantity + consumed_quantity
- M2 yalnızca ürün ana birimi M2 ise ana maliyet birimi
- Purchase receipt integration hazırlığı (StockPort)
- Project link hazırlığı
- local/base currency entegrasyonu
- Dashboard stock valuation
- Void/replace modal flows

### Kabul Kriterleri

- [ ] **cost_uzs_per_m2** ve **qty_m2_remaining** ana model olarak V3’te bulunmamalı.
- [ ] ADET ürün ADET üzerinden, PLK ürün PLK üzerinden, M2 ürün M2 üzerinden FIFO tüketmeli.
- [ ] Stok girişinde unit_cost = line_total / primary_quantity olmalı.
- [ ] Stok çıkışında COGS = consumed_quantity × unit_cost olmalı.
- [ ] Depo seçimi stok giriş/çıkışta zorunlu olmalı.
- [ ] Negatif stok engellenmeli.
- [ ] Void/replace işlemleri FIFO restore mantığıyla çalışmalı.
- [ ] Dashboard sessiz list-price fallback yapmamalı; FIFO değeri yoksa uyarı verebilmeli.

### Riskler

- Eski m² mantığı taşınırsa finans ve proje maliyeti yanlış olur.
- Depo bazlı altyapı ertelenirse sonra büyük migration gerekir.
- Void/replace akışları zayıf olursa stok ve FIFO tutarsızlaşır.

### Test / Doğrulama Senaryoları

- ADET ürün: 100 ADET × 50 local; 20 ADET çıkış COGS = 1000 local.
- PLK ürün: 10 PLK × 30 USD; kısmi çıkışta FIFO doğru çalışmalı.
- M2 ürün: 25 M2 × 5 USD; M2 ana birim olarak doğru çalışmalı.
- Farklı depolarda aynı ürün farklı bakiye göstermeli.
- Stok giriş iptali, çıkış iptali ve replace senaryoları.

### V2 Referans Noktaları

- V2 stockMovementService ve stockCostLayerService iş akışları.
- V2 negatif stok engeli, proje öncelikli tüketim, void/replace kararları.
- V2 m² FIFO teknik borç raporu.

### Bu Gate Tamamlanmadan Başlanmayacak İşler

- Purchasing goods receipt stok entegrasyonu başlamayacak.
- Finance stok değeri/COGS bağlantısı kurulmayacak.
- Proje maliyetleri stock unit_cost oturmadan genişletilmeyecek.

---

## Gate 4 — Purchasing Ready

### Amaç

V2 satınalma workflow’unu kaybetmeden, merkezi approval/permission/modal sistemiyle ve stok/finance bağlantılarına hazır şekilde V3’e taşımak.

### Kapsam

- Purchase request
- Approval workflow
- Purchase order
- Pricing
- Supplier / party bağlantısı
- FX rate
- Goods receipt
- Partial delivery
- Rejected/damaged quantity
- Warehouse acceptance
- Goods receipt → stock movement
- **Price save does not complete order**
- **Goods receipt does not require buyer_state completed**
- **pending_cost / unpriced stock flow**
- Centralized approval/permission
- Finance invoice/payable preparation
- Purchasing modal flow inventory

### Kabul Kriterleri

- [ ] Fiyat kaydetme siparişi tamamlamamalı.
- [ ] Mal kabul fiziksel stok hareketidir; fiyat/fatura finansal kesinleşmedir.
- [ ] Mal kabul için PO aktif/onaylı olmalı, satır aktif olmalı, ürün/birim net olmalı, depo seçilmeli, kabul miktarı kalan miktarı aşmamalı.
- [ ] Fiyat eksikse stok hareketi **pending_cost/unpriced** olarak işaretlenebilmeli.
- [ ] Kısmi teslimatta qty_received doğru birikmeli.
- [ ] Rejected/damaged quantity stok artırmamalı.
- [ ] Placeholder tedarikçi ile order complete engellenmeli.
- [ ] Approval sistemi tek merkezi permission modeliyle çalışmalı.

### Riskler

- Mal kabul fiyat tamamlanmadan engellenirse gerçek operasyon kilitlenir (**V3: engellenmez**).
- Fiyat kaydetme ile complete karışırsa satınalma listeleri bozulur.
- Goods receipt stok hareketi ile tutarsız çalışırsa stok/FIFO bozulur.
- Pending cost akışı yoksa finansal maliyetler eksik kalır.

### Test / Doğrulama Senaryoları

- Talep oluştur → onay → otomatik PO.
- Fiyat kaydet → order complete olmamalı.
- Fiyat eksikken mal kabul → stok artar, pending_cost olur.
- Kısmi teslim → kalan miktar doğru kalır.
- Hasarlı/red miktar → stok artmaz.
- Mal kabul sonrası stock movement ve FIFO layer oluşur.
- Complete için tüm aktif satırlarda gerçek tedarikçi + fiyat + FX zorunlu.
- **Mal kabul, buyer_state=completed olmadan başarılı olmalı.**

### V2 Referans Noktaları

- V2 purchasingService, purchaseWorkflow, goods-receipt ekranları.
- V2 fiyat kaydetme / sipariş tamamlama ayrımı.
- V2 mal kabul ve kısmi teslimat akışları.

### Bu Gate Tamamlanmadan Başlanmayacak İşler

- Finance purchase invoice / payable modülü başlamayacak.
- Project purchasing cost reporting genişletilmeyecek.
- Advanced supplier performance raporları yapılmayacak.

---

## Gate 5 — Finance Tracking Ready

### Amaç

Resmi muhasebe olmayan, ERP içi operasyonel finansal takip modülünü stok, satınalma ve HR bağlantılarına hazır şekilde kurmak.

### Kapsam

- Parties / cari hesaplar
- Cash/bank accounts
- Purchase invoices
- Payments
- Collections
- Supplier debt
- Customer receivable
- Employee advance/payment
- Opening balances
- Project link
- Purchasing invoice link
- Finance ledger
- Currency/local/base model

### Kabul Kriterleri

- [ ] Finance modülü resmi muhasebe, bilanço, KDV beyannamesi veya tek düzen hesap planı olarak tasarlanmamalı.
- [ ] Cari bakiyesi fatura/ödeme/tahsilat hareketlerinden hesaplanmalı.
- [ ] Supplier debt purchase invoice ile doğmalı; purchase order tek başına kesin borç oluşturmamalı.
- [ ] Employee payment/advance HR employee ile bağlanmalı.
- [ ] Her finans hareketinde amount, currency_code, amount_local, amount_base veya eşdeğer snapshot standardı olmalı.
- [ ] Opening balance yöntemi desteklenmeli.
- [ ] Project_id opsiyonel ama standart alan olarak hazır olmalı.

### Riskler

- Stok maliyeti ve satınalma akışı oturmadan finance başlarsa yanlış borç/maliyet doğar.
- Para birimi standardı zayıfsa cari bakiyeleri karışır.
- Resmi muhasebe kapsamı açılırsa proje büyür ve çekirdek hedef dağılır.

### Test / Doğrulama Senaryoları

- Tedarikçi faturası → borç oluşur.
- Ödeme → borç azalır.
- USD fatura USD kalır; local karşılığı raporlama için hesaplanır.
- Personel avansı employee party’ye bağlanır.
- Açılış bakiyesi girildiğinde cari/kasa başlangıcı doğru görünür.

### V2 Referans Noktaları

- V2’de tam finans modülü yok; V2 satınalma, HR, stok verileri finans bağlantısı için referanstır.
- V2 currency/local/base tartışmaları.
- V2 stok maliyet ve satınalma borç ayrımı kararları.

### Bu Gate Tamamlanmadan Başlanmayacak İşler

- Resmi muhasebe modülü başlatılmayacak.
- Bilanço/gelir tablosu/KDV gibi konular açılmayacak.
- Projects advanced profitability finance core oturmadan yapılmayacak.

---

## 4. Genel Go / No-Go Checklist

- [ ] Blueprint tüm başlıklarıyla onaylandı mı?
- [ ] V2 HR/Stock/Purchasing iş kuralları yazılı hale getirildi mi?
- [ ] V2 modal/popup flow envanteri tamamlandı mı?
- [ ] UI design system özel CSS ihtiyacını ortadan kaldıracak kadar net mi?
- [ ] Admin registry ve permission modeli hem frontend hem backend için tek kaynak mı?
- [ ] Migration sistemi yeni kolon/modül ekleme sırasında patlamayı önleyecek kadar net mi?
- [ ] Currency/country/language ayarları form davranışına gerçekten etki ediyor mu?
- [ ] Stok unit_cost FIFO modeli m² legacy modelini tamamen dışlıyor mu?
- [ ] Satınalma mal kabul ve fiyat/fatura ayrımı doğru tanımlandı mı?
- [ ] Finance resmi muhasebe değil, finansal takip olarak sınırlandırıldı mı?

---

## 5. V3 İçin Ana Hatırlatma

V3’te amaç hızlı çalışan demo değil; **modül ekledikçe bozulmayan merkezi ERP çekirdeğidir.** Süre değil, **kabul kriteri** esastır. **Gate tamamlanmadan sonraki işe geçilmez.**

---

## İlgili dosyalar

| Dosya | Açıklama |
|-------|----------|
| `docs/v3-spec/README.md` | Gate 0 spec klasörü indeksi |
| `docs/v3-spec/00-gate0-checklist.md` | Gate 0 onay listesi |
| `docs/FactoryOS-V3-Gate-Blueprint.md` | Teknik genişletme (referans) |

**Dışa aktarma:** `python docs/export-blueprint.py` (script güncellenebilir)
