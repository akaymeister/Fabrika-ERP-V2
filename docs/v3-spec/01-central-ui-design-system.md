# 01 — Central UI Design System

**Belge türü:** Gate 0 — merkezi UI ana karar dokümanı  
**Durum:** ☑ **İNCELEMEDE** (kararlar kilitli; bileşen API Gate 1’de detaylandırılır)  
**Görsel tasarım (UI mockup):** ☑ **FROZEN** — bkz. [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md)  
**Versiyon:** 0.2.0  
**Son güncelleme:** 19.05.2026  
**Paket adı (hedef):** `@factoryos/ui`  
**Sistem ana dili:** Türkçe (`tr`) — tüm HTML `charset=UTF-8`, dosyalar UTF-8 kaydedilir; Türkçe karakterler (ç, ğ, ı, İ, ö, ş, ü) zorunludur.

**Kaynaklar:**

| Kaynak | Rol |
|--------|-----|
| `FactoryOS-V3/Modül Detayları/00- UI Tasarımı Kuralları.docx` | Ürün kuralları + UI-01…UI-60 |
| [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) | Görsel yön FROZEN |
| [../mockups/](../mockups/) | Onaylı HTML referans |
| Fabrika ERP V2 | **Referans only** — UI/CSS kopyalanmaz |

**Otorite ayrımı:**

| Belge | Ne kilitler |
|-------|-------------|
| **00-ui** | Renk, tipografi, layout görünümü, mockup HTML |
| **01 (bu belge)** | Merkezi UI sistemi kararı, AppShell davranışı, i18n/para/alfabe, Gate 0 UI kabul kriterleri UI-01…UI-60 |
| Domain spec’ler (HR, Stok, …) | Ekran içeriği ve iş akışı; görsel çerçeve 00-ui + 01’e uyar |

---

## 0. Onaylı görsel referans (mockup) — FROZEN

**Otorite:** [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) (FROZEN). Bu dosya bileşen API ve responsive kurallarını tanımlar; **görsel sapma** için önce 00-ui belgesi ve mockup güncellenir.

| Dosya | Ekran |
|-------|--------|
| [`../mockups/factoryos-v3-home-preview.html`](../mockups/factoryos-v3-home-preview.html) | Ana sayfa (dashboard, modül kartları, KPI) |
| [`../mockups/factoryos-v3-design-preview.html`](../mockups/factoryos-v3-design-preview.html) | Modül örneği: Stok hareketleri (DataTable, filtre, modal) |
| [`../mockups/factoryos-v3-admin-preview.html`](../mockups/factoryos-v3-admin-preview.html) | Yönetim paneli (registry, ayarlar, log, yedek) |

**Ortak AppShell:** daraltılabilir sidebar (248px / 72px), topbar, breadcrumb, dil seçici, kullanıcı alanı, DM Sans + JetBrains Mono.

**Renk tokenları (mockup `:root`):**

| Token | Değer | Kullanım |
|-------|--------|----------|
| `--fos-primary` | `#0d6e7a` | Birincil aksiyon, aktif vurgu |
| `--fos-primary-muted` | `#e6f4f6` | Hover / focus arka plan |
| `--fos-accent` | `#e85d2c` | Önizleme şeridi, dikkat |
| `--fos-sidebar` | `#0f172a` | Sol navigasyon |
| `--fos-sidebar-accent` | `#2dd4bf` | Aktif menü çizgisi |
| `--fos-bg` | `#f4f6f9` | Sayfa arka planı |
| `--fos-surface` | `#ffffff` | Kart, topbar |
| `--fos-text` | `#0f172a` | Ana metin |

**Modül kart ikonları:** emoji değil; modül başına renkli gradient kutu + stroke SVG (ana sayfa mockup). Hub’da modül tanıma rengi **kart ikonu** içindir; sayfa içi buton/tablo renkleri modüle özel olmayacak (UI-22).

**Ana sayfa modülleri (hub):** İK, Stok, Satınalma, **Raporlamalar**, Finans Takip (yakında), Yönetim, Projeler.

---

## 1. Amaç ve merkezi UI kararı

FactoryOS V3’te **tek merkezi UI sistemi** zorunludur. Tüm modüller aynı tasarım dilini, aynı AppShell’i, aynı bileşen kütüphanesini (`@factoryos/ui`) ve aynı format/i18n kurallarını kullanır.

| Karar | Açıklama |
|-------|----------|
| Evrensel tasarım | Mockup tasarım dili proje genelinde geçerlidir; sayfa/modül başına ayrı CSS üretilmez |
| V2 UI taşınmaz | `frontend/public/style.css` (~10k satır), sayfa özel CSS ve dağınık `.btn` stilleri kopyalanmaz |
| Gate 0 | UI-01…UI-60 **karar** olarak bu belgede kabul edilir; implementasyon Gate 1+ |
| Gate 1 | `@factoryos/ui` + token dosyaları; mockup’a sadık demo shell |

---

## 2. AppShell — topbar, profil, bildirim, dil

Tüm sayfalar aynı ana kabuk üzerinden çalışır (UI-06).

```text
┌──────────────────────────────────────────────────────────────────┐
│ [≡] Breadcrumb              [ara?] [kur?] [🔔] [dil] [avatar ▾]  │
├──────────┬───────────────────────────────────────────────────────┤
│ Sidebar  │  PageHeader · KPI · Card · DataTable · Modal           │
│          │                                                       │
│ Brand    │                                                       │
│ Nav      │                                                       │
└──────────┴───────────────────────────────────────────────────────┘
│ Footer / copyright (merkezi layout)                              │
└──────────────────────────────────────────────────────────────────┘
```

### 2.1 Sağ üst kullanıcı alanı (UI-07…UI-10)

| Öğe | Kural |
|-----|--------|
| Kullanıcı bilgisi | Sağ üstte görünür ad / kısa kimlik |
| Profil menüsü (açılır) | En az: **Profilim** → **Şifre değiştir** → **Bildirimler** → **Çıkış**; ileride genişletilebilir |
| Bildirim / alarm | Profil alanının yanında ikon; tıklanınca bildirim paneli veya sayfası |
| Dil seçimi | Profil çevresinde; seçim **tüm sayfalarda** geçerli (UI-27, UI-28) |

**FAIL:** Bazı sayfalarda çıkış üstte, bazılarında yanda veya yok.

### 2.2 Ana sayfa — güncel kur bilgisi (UI-47…UI-51)

| Kural | Detay |
|-------|--------|
| Gösterim | Admin’in seçtiği ülke/para birimine göre dashboard’da **bilgilendirme** amaçlı güncel kur (Google veya admin tanımlı kaynak) |
| Kaynak | `hr_settings` / sistem ayarları üzerinden yapılandırılabilir (UI-48) |
| Ayrım | Dashboard kuru **referans**; bordro, satınalma, stok, muhasebe **manuel işlem kurlarını** otomatik değiştirmez |
| Geçmiş | Kur güncellenince geçmiş işlem maliyetleri değişmez |

### 2.3 Dashboard yönetimi (UI-11…UI-15)

| Kural | Detay |
|-------|--------|
| Modül kartları | Admin/kullanıcı ayarına göre açılıp kapanabilir |
| Rapor kartları | Admin panelinden çeşitlendirilip ana menüye eklenip çıkarılabilir |
| Yetki | Kullanıcının yetkisi olmayan modül/kart görünmez |
| Boş durum | Rapor/kart yoksa düzgün empty state; kırık layout yok |
| Copyright | V2 footer metni **içerik** olarak alınabilir; yerleşim merkezi layout’ta standart |

### 2.4 Logo ve marka ayrımı (UI-57…UI-60)

| Tür | Kullanım | Yönetim |
|-----|----------|---------|
| **FactoryOS V3** sistem logosu | Sidebar marka, favicon, masaüstü kısayol ikonu | Gate 1+ tasarım varlığı; sabit sistem kimliği |
| **Şirket logosu** | Kurumsal formlar, raporlar, yazdırma | Admin panelinden yükleme (UI-56, UI-60) |

**FAIL:** Sistem logosu ile şirket logosu aynı slot’ta karışık kullanım.

---

## 3. i18n, alfabe ve font

| Konu | Gate 0 kararı |
|------|----------------|
| Ana dil | Türkçe (`tr`) — varsayılan |
| Desteklenen UI dilleri | `tr`, `en`, `ru`, `uz` (genişletme admin kararı) |
| Kapsam | Menü, buton, hata, uyarı, boş durum — hardcoded metin yok (UI-30) |
| Oturum | Login sonrası kullanıcı dil tercihiyle devam (UI-28) |
| Ham key | `hr.role.cancel` gibi anahtarlar ekranda görünmez (UI-29) |
| Veri giriş dili | **Latin alfabesi** zorunlu (UI-31) |
| Kiril | Frontend uyarı + API reddi (UI-32, UI-33); mesaj: “Lütfen Latin alfabesi kullanın.” |
| İstisna | Pasaport/evrak vb. ileride admin ayarıyla kontrollü (UI-35) |
| Font | Tek font ailesi (DM Sans); TR/Özbek/RU arayüz karakterleri bozulmadan (UI-36…UI-40) |

**İlgili spec:** [05-country-currency-language.md](./05-country-currency-language.md)

---

## 4. Para birimi ve format

| Kural | Detay |
|-------|--------|
| Merkezi helper | Tüm modüller aynı `formatMoney` / para bileşenini kullanır (UI-41) |
| UZS örnek | `1.000.000,00 UZS` — binlik `.`, ondalık `,` (UI-42) |
| USD örnek | `1.000,00 USD` (UI-43) |
| Hesaplama | Virgülden sonra **6 hane** iç hassasiyet (UI-44) |
| Ekran | Gösterim **2 hane** (UI-45) |
| Sembol / kod | Seçilen ülke para birimi: `€`, `₺`, `UZS` vb. doğru etiket (UI-46) |
| Hardcode | Sayfa bazında `UZS` sabitleme yok — tenant `local_currency` |

**FAIL:** Aynı tutar farklı sayfalarda `1000000`, `1,000,000`, `1.000.000,0000` karışık görünüm.

---

## 5. Bileşen kataloğu (`@factoryos/ui`)

Gate 1’de implement edilecek merkezi bileşenler. Modül sayfaları yalnızca bu API’yi compose eder.

| Bileşen | API özeti | V2 karşılığı / not |
|---------|-----------|---------------------|
| AppShell | `sidebarCollapsed`, `nav`, `topbar`, `footer` | `app-ui-v3`, dağınık layout |
| Sidebar | modül grupları, collapse, tooltip | `navigation.js` |
| Topbar | breadcrumb, search?, locale, notifications, userMenu | dağınık header |
| UserMenu | profil, şifre, bildirimler, çıkış | tutarsız çıkış linkleri |
| NotificationBell | count, panel | yok / parça parça |
| LocaleSwitcher | `tr` `en` `ru` `uz`, persist | sayfa bazlı dil |
| PageHeader | title, actions, breadcrumb | sayfa başlıkları |
| Card | KPI, module hub | hub kartları |
| Button | `primary` `secondary` `danger` `ghost`, size tokens | dağınık `.btn` |
| DataTable | columns, `locked`, serverSide, horizontal scroll | tablo taşması |
| Modal | stack, sizes, focus trap | `#stockInModal`, `#procDlg` |
| ConfirmDialog | async onConfirm | `window.prompt` yerine |
| Toast | variant, queue | `ui-notify.js` |
| FormField | label, error, latin validate | |
| FilterBar | chips, reset | |
| Tabs | underline active | admin mockup |
| Pagination | | |
| Badge | status pill | |
| CurrencyField | 6dp internal, 2dp display | hardcode UZS |
| DateField | locale aware | |
| EmptyState | dashboard / table | |
| ExchangeRateBadge | read-only dashboard FX | `app.js` dashboardCurrency |

**Gate 1:** Her bileşen için props/events TypeScript sözleşmesi ayrı teknik notta tamamlanır.

---

## 6. Responsive kurallar ve test matrisi

**Karar:** “PC’de okunuyor, laptopta okunmuyor” **kabul edilmez** (UI-16…UI-20).

| Breakpoint | Genişlik | Cihaz tipi |
|------------|----------|------------|
| Mobile | &lt;768px | Telefon (390px test) |
| Tablet | 768–1023px | Tablet |
| Laptop | 1024–1365px | Küçük laptop (1024px test) |
| Desktop | 1366–1919px | Standart laptop (1366px test) |
| Wide | ≥1920px | Büyük ekran |

| Kural | PASS |
|-------|------|
| Okunabilirlik | Tüm ana ekranlar telefon→PC okunabilir |
| Stok ürün adı | Laptop’ta anlamsız kesilme yok; tooltip veya kontrollü genişlik |
| Tablo | Sayfa kırmaz; `locked: true` kolonlar yatay kaydırma |
| Buton / kart | Üst üste binme ve kart dışı taşma yok |

**Gate 1 test matrisi (zorunlu ekranlar):** Ana sayfa, Stok hareketleri (mockup referans), Admin hub, HR bordro listesi (örnek), Satınalma liste.

---

## 7. CSS yasağı ve token stratejisi

| Kural | Açıklama |
|-------|----------|
| Token dosyaları | colors, spacing, typography, breakpoints, z-index — 00-ui `:root` ile uyumlu |
| Sınıf prefix | `.fos-*` veya `.erp-*` (Gate 1 tek prefix seçimi) |
| Sayfa CSS yasağı | `body.*-page { }`, modül özel stylesheet yok (UI-02) |
| Inline style | Zorunlu olmayan `style=""` yok (UI-03) |
| Print | Sayfa başına max sınırlı `print.css` istisna |
| Lint | CI: inline style, yasak selector |

---

## 8. Sayfa şablonu (Gate 1 iskelet)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title data-i18n="..."></title>
  <!-- @factoryos/ui global CSS + tokens only -->
</head>
<body>
  <div id="app" data-fos-shell>
    <!-- AppShell: Sidebar + Topbar (user, notify, locale) + main -->
    <main data-fos-content>
      <!-- PageHeader, FilterBar, Card/DataTable, Modal host -->
    </main>
    <!-- Footer / copyright -->
  </div>
</body>
</html>
```

Modül sayfaları **yalnızca** içerik slotunu doldurur; shell tekrar implement edilmez.

---

## 9. Gate 0 UI kabul kriterleri (UI-01 … UI-60)

Gate 0’da **kod yazılmaz**; kriterler **KABUL** = V3’te kesin uygulanacak karar. Gate 0 UI PASS: tüm maddeler **KABUL** (veya açıkça REVİZE/RED kayıtlı).

**Durum kodları (Gate 0):**

| Durum | Anlamı |
|-------|--------|
| **KABUL** | V3’te kesin uygulanacak |
| REVİZE | Madde doğru; wording/teknik detay değişecek |
| BEKLET | Gate 1 veya modül spec’inde detay |
| RED | V3 kapsamı dışı |

### 9.1 Merkezi UI sistemi (UI-01 … UI-05)

| No | Kriter | PASS şartı | Gate 0 |
|----|--------|------------|--------|
| UI-01 | Global tasarım sistemi | Renk, font, buton, kart, tablo, form, modal, layout merkezi dosyalardan | **KABUL** |
| UI-02 | Sayfa bazlı CSS yasağı | Modül başına dağınık CSS yok | **KABUL** |
| UI-03 | Inline style yasağı | Zorunlu olmayan `style=""` yok | **KABUL** |
| UI-04 | Mockup uyumu | Onaylı mockup ana referans | **KABUL** |
| UI-05 | Sayfa tutarlılığı | HR, stok, satınalma, proje, admin aynı sistem | **KABUL** |

**FAIL örneği:** Stok mavi tema, HR gri, satınalma farklı buton/tablo → FAIL.

### 9.2 Layout / AppShell (UI-06 … UI-10)

| No | Kriter | PASS şartı | Gate 0 |
|----|--------|------------|--------|
| UI-06 | Sabit ana layout | Sidebar, topbar, içerik, footer aynı mantık | **KABUL** |
| UI-07 | Sağ üst kullanıcı alanı | Kullanıcı bilgisi + profil menüsü | **KABUL** |
| UI-08 | Profil menüsü içeriği | Profilim, Şifre değiştir, Bildirimler, Çıkış | **KABUL** |
| UI-09 | Bildirim ikonu | Profil yanında bildirim/alarm | **KABUL** |
| UI-10 | Dil seçimi | Kullanıcı alanı çevresinde | **KABUL** |

### 9.3 Dashboard (UI-11 … UI-15)

| No | Kriter | PASS şartı | Gate 0 |
|----|--------|------------|--------|
| UI-11 | Modül kartları yönetilebilir | Admin/kullanıcı ayarı ile aç/kapa | **KABUL** |
| UI-12 | Rapor kartları yönetilebilir | Admin’den ekle/çıkar | **KABUL** |
| UI-13 | Yetkiye göre görünüm | Yetkisiz kart görünmez | **KABUL** |
| UI-14 | Boş dashboard | Düzgün empty state | **KABUL** |
| UI-15 | V2 copyright | Footer içerik V2’den alınabilir; layout standart | **KABUL** |

### 9.4 Responsive (UI-16 … UI-20)

| No | Kriter | PASS şartı | Gate 0 |
|----|--------|------------|--------|
| UI-16 | Tüm cihazlarda okunabilirlik | 390 / 768 / 1024 / 1366 / 1920 | **KABUL** |
| UI-17 | Stok ürün adı | Laptop’ta anlamsız kesilme yok | **KABUL** |
| UI-18 | Tablo taşma | Kontrollü yatay kaydırma | **KABUL** |
| UI-19 | Buton çakışması | Üst üste binme yok | **KABUL** |
| UI-20 | Kart taşması | KPI/kart içeriği taşmaz | **KABUL** |

### 9.5 Buton ve bileşen standardı (UI-21 … UI-25)

| No | Kriter | PASS şartı | Gate 0 |
|----|--------|------------|--------|
| UI-21 | Global buton sistemi | primary, secondary, danger, ghost | **KABUL** |
| UI-22 | Modüle özel renk yasağı | Menü/sayfa özel renk paleti yok | **KABUL** |
| UI-23 | Buton ölçüsü | Merkezi height/padding/font | **KABUL** |
| UI-24 | İkon standardı | Aynı boyut ve hizalama | **KABUL** |
| UI-25 | Form standardı | Input/select/date/textarea aynı | **KABUL** |

### 9.6 Dil ve i18n (UI-26 … UI-30)

| No | Kriter | PASS şartı | Gate 0 |
|----|--------|------------|--------|
| UI-26 | Ana dil Türkçe | Varsayılan `tr` | **KABUL** |
| UI-27 | Dil seçimi kalıcı | Tüm sayfalarda geçerli | **KABUL** |
| UI-28 | Login sonrası dil | Kullanıcı tercihiyle devam | **KABUL** |
| UI-29 | Ham i18n key yok | Teknik anahtar görünmez | **KABUL** |
| UI-30 | Tüm metinler i18n | Menü, hata, boş durum | **KABUL** |

### 9.7 Alfabe ve veri girişi (UI-31 … UI-35)

| No | Kriter | PASS şartı | Gate 0 |
|----|--------|------------|--------|
| UI-31 | Latin alfabe | Veri girişi Latin | **KABUL** |
| UI-32 | Kiril frontend engeli | Uyarı gösterilir | **KABUL** |
| UI-33 | Kiril backend engeli | API reddeder | **KABUL** |
| UI-34 | Açıklayıcı hata | Kullanıcı dostu mesaj | **KABUL** |
| UI-35 | İstisna alanları | Admin kontrollü istisna tanımı | **KABUL** |

### 9.8 Font (UI-36 … UI-40)

| No | Kriter | PASS şartı | Gate 0 |
|----|--------|------------|--------|
| UI-36 | Türkçe karakter | ç, ğ, ı, İ, ö, ş, ü doğru | **KABUL** |
| UI-37 | Özbekçe karakter | O‘zbekcha doğru | **KABUL** |
| UI-38 | Rusça arayüz | Kiril arayüz metni doğru | **KABUL** |
| UI-39 | PDF/rapor | Karakter bozulması yok | **KABUL** |
| UI-40 | Tek font ailesi | Dağınık font yok | **KABUL** |

### 9.9 Para formatı (UI-41 … UI-46)

| No | Kriter | PASS şartı | Gate 0 |
|----|--------|------------|--------|
| UI-41 | Merkezi para formatı | Tek helper | **KABUL** |
| UI-42 | UZS formatı | `1.000.000,00 UZS` | **KABUL** |
| UI-43 | USD formatı | `1.000,00 USD` | **KABUL** |
| UI-44 | Hesaplama 6 hane | İç hassasiyet | **KABUL** |
| UI-45 | Ekran 2 hane | Gösterim | **KABUL** |
| UI-46 | Sembol/etiket | Ülke para birimi doğru | **KABUL** |

### 9.10 Güncel kur (UI-47 … UI-51)

| No | Kriter | PASS şartı | Gate 0 |
|----|--------|------------|--------|
| UI-47 | Dashboard kur | Admin ülke/para birimine göre gösterim | **KABUL** |
| UI-48 | Kur kaynağı ayarı | Admin yapılandırması | **KABUL** |
| UI-49 | Bilgilendirme ayrımı | Referans only | **KABUL** |
| UI-50 | Manuel işlem kuru | Otomatik ezilmez | **KABUL** |
| UI-51 | Geçmiş kayıt | Geçmiş maliyet değişmez | **KABUL** |

### 9.11 Admin UI kontrol (UI-52 … UI-56)

| No | Kriter | PASS şartı | Gate 0 |
|----|--------|------------|--------|
| UI-52 | Modül görünürlük | Admin aktif/pasif | **KABUL** |
| UI-53 | Dashboard kart ayarı | Admin yönetir | **KABUL** |
| UI-54 | Rapor görünürlük | Role/kullanıcı bazlı | **KABUL** |
| UI-55 | Ülke/para birimi | Admin seçimi | **KABUL** |
| UI-56 | Şirket logosu | Admin yükleme | **KABUL** |

**UI referans:** [02-admin-control-system.md](./02-admin-control-system.md), mockup `factoryos-v3-admin-preview.html`.

### 9.12 Logo ve marka (UI-57 … UI-60)

| No | Kriter | PASS şartı | Gate 0 |
|----|--------|------------|--------|
| UI-57 | FactoryOS V3 logosu | Sistem logosu ayrı | **KABUL** |
| UI-58 | Favicon | Browser sekmesi | **KABUL** |
| UI-59 | Masaüstü ikon | Kısayol ikonu | **KABUL** |
| UI-60 | Şirket logosu ayrımı | Yalnız kurumsal form/rapor | **KABUL** |

### 9.13 Gate 0 UI PASS özeti

| Metrik | Değer |
|--------|-------|
| Toplam kriter | 60 |
| Gate 0 durumu | **60 × KABUL** (karar) |
| Implementasyon | Gate 1 `@factoryos/ui` + modül ekranları |
| Görsel otorite | 00-ui FROZEN + 3 mockup |

---

## 10. V2’den taşınmayacak UI borçları

Aşağıdaki V2 kalıpları **bilinçli olarak bırakılır**; V3’te 01 + 00-ui + mockup ile değiştirilir.

| # | V2 borç | Konum / belirti | V3 karşılık |
|---|---------|-----------------|-------------|
| B1 | Monolit `style.css` (~10k satır) | `frontend/public/style.css` | Token + `@factoryos/ui` |
| B2 | Sayfa özel CSS | `body.app-ui-v3.*-page`, modül inline | UI-02 yasağı |
| B3 | Dağınık buton stilleri | `.btn`, modül özel renk | UI-21…UI-23 |
| B4 | `window.prompt` / native confirm | çeşitli JS | ConfirmDialog |
| B5 | Parça bildirim | `ui-notify.js` dağınık | Merkezi Toast |
| B6 | Sayfa bazlı dil | bazı sayfalar TR sabit | LocaleSwitcher + i18n |
| B7 | Hardcode `dashboardCurrency = 'UZS'` | `app.js` | tenant `local_currency` + UI-46 |
| B8 | Tutarsız çıkış / profil | modül common farklı | UserMenu UI-07…UI-08 |
| B9 | Tablo taşma / kesik ürün adı | stok hareketleri laptop | DataTable `locked` + UI-17 |
| B10 | Frontend maaş gösterimi riski | HR sayfaları | WageEngine-only; UI redaction domain |
| B11 | Emoji / rastgele ikon | eski hub | SVG modül ikonları (mockup) |
| B12 | Kiril veri girişi kontrolsüz | V2 genel | UI-31…UI-33 |
| B13 | Para format tutarsızlığı | sayfa bazlı `toFixed` | Merkezi format UI-41…UI-45 |
| B14 | Dashboard kur → işlem karışması | manuel kur ekranları | UI-49…UI-51 ayrımı |
| B15 | Sistem / şirket logo karışımı | tek logo alanı | UI-57…UI-60 |

**Referans indeks:** [v2-reference-index.md](./v2-reference-index.md) §7 UI · [11-v2-carry-and-drop.md](./11-v2-carry-and-drop.md).

---

## 11. Gate 0 / Gate 1 kabul (bu belge)

| Aşama | Gereksinim |
|-------|------------|
| Gate 0 (bu belge) | UI-01…UI-60 karar tablosu ☑; merkezi UI kararı yazılı; V2 UI borç listesi; mockup FROZEN referansı |
| Gate 0 PASS (UI) | 60 kriter **KABUL**; 00-ui FROZEN; 3 mockup mevcut |
| Gate 1 | Bileşen API implementasyonu; responsive test matrisi PASS; lint kuralları CI |

- [x] Merkezi UI sistemi kararı (§1)
- [x] UI-01…UI-60 tabloları (§9)
- [x] Profil, bildirim, dil, kur, dashboard, alfabe, para, logo (§2–§4)
- [x] V2 UI borçları listesi (§10)
- [x] Mockup FROZEN referansı (§0)
- [ ] Bileşen props/events tam sözleşme (Gate 1)
- [ ] Responsive otomatik test PASS kaydı (Gate 1)

---

## 12. V2 referans (yalnızca inceleme)

| Dosya | V3’te rol |
|-------|-----------|
| `frontend/public/style.css` | KOPYALANMAZ — ters örnek |
| `frontend/public/js/ui-notify.js`, `ui-format.js` | Davranış referansı; API yeniden yazılır |
| [v2-reference-index.md](./v2-reference-index.md) | UI bölümü |

---

## 13. Açık kararlar (implementasyon detayı)

| # | Karar | Seçenek | Gate |
|---|--------|---------|------|
| UI1 | Build toolchain | Vite MPA / saf static + `@factoryos/ui` | Gate 1 |
| UI2 | Tablo satır detay | expand row / side panel / modal | Gate 1 |
| UI3 | Dashboard kur API sağlayıcı | Google / TCMB / manuel feed | Gate 1 + admin |
| UI4 | CSS sınıf prefix kesinleşme | `.fos-*` vs `.erp-*` | Gate 1 |

Görsel yön değişikliği **00-ui** + mockup onayı gerektirir; bu tablodaki maddeler görsel freeze’i ihlal etmez.

---

## 14. İlgili belgeler

| Belge | İlişki |
|-------|--------|
| [00-ui-design-direction-freeze.md](./00-ui-design-direction-freeze.md) | Görsel FROZEN |
| [02-admin-control-system.md](./02-admin-control-system.md) | Admin UI-52…UI-56 |
| [05-country-currency-language.md](./05-country-currency-language.md) | Ülke, para, dil policy |
| [00-gate0-checklist.md](./00-gate0-checklist.md) | G0-T6 UI freeze |
| [00-gate0-required-documents.md](./00-gate0-required-documents.md) | B1 bu belge |

**Mockup dizini:** [../mockups/README.md](../mockups/README.md)
