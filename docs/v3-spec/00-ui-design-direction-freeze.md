# FactoryOS V3 — UI Design Direction Freeze

**Belge türü:** Gate 0 — görsel yön (kısmi freeze)  
**Durum:** ☑ **FROZEN** (görsel yön)  
**Versiyon:** 1.0.0  
**Freeze tarihi:** 19.05.2026  
**Ürün adı:** FactoryOS V3  
**Referans sistem:** Fabrika ERP V2 — yalnızca iş kuralı / UAT incelemesi; UI kopyalanmaz

---

## 1. Kapsam ve otorite

Bu belge, FactoryOS V3 **merkezi kullanıcı arayüzünün görsel yönünü** dondurur. Gate 1 `@factoryos/ui` ve tüm modül ekranları bu yöne uymak zorundadır.

| Kapsam | Durum |
|--------|--------|
| Renk, tipografi, layout, bileşen görünümü | ☑ FROZEN |
| Bileşen API / props sözleşmesi | ☐ `01-central-ui-design-system.md` ile tamamlanacak |
| Modül ekran içerikleri (HR, Stok, vb.) | ☐ İlgili domain spec’lerde tanımlanacak |

**Onaylı HTML referanslar** (Gate 1 UI ana kaynak):

| Dosya | Ekran |
|-------|--------|
| [`../mockups/factoryos-v3-home-preview.html`](../mockups/factoryos-v3-home-preview.html) | Ana sayfa |
| [`../mockups/factoryos-v3-design-preview.html`](../mockups/factoryos-v3-design-preview.html) | Modül örneği: Stok |
| [`../mockups/factoryos-v3-admin-preview.html`](../mockups/factoryos-v3-admin-preview.html) | Yönetim paneli |

Mockup indeksi: [`../mockups/README.md`](../mockups/README.md)

---

## 2. Proje ayrımı (zorunlu)

| Kural | Açıklama |
|-------|----------|
| Resmi ad | **FactoryOS V3** |
| V2’ye kod yazılmaz | V3, Fabrika ERP V2 repo’suna modül olarak eklenmez |
| V3 başlangıcı | Gate 0 **tam PASS** sonrası ayrı klasör/repo (`FactoryOS-V3` önerilen) |
| V2 rolü | Çalışan iş kuralları, UAT, akış referansı |
| V2’den kopyalanmaz | `style.css`, `frontend/public` toplu kopya, patch dosyaları, servis dosyalarının taşınması |

---

## 3. Tasarım ilkeleri (yapılacaklar)

| İlke | Uygulama |
|------|----------|
| Açık tema | Açık arka plan (`#f4f6f9`), beyaz yüzey kartları |
| Kurumsal ERP / admin | Yoğun veri, tablo ve form odaklı; iş yazılımı hissi |
| Kompakt tipografi | 14px gövde; sıkı satır aralığı; KPI ve tablo öncelikli |
| Okunabilir font | **DM Sans** (UI), **JetBrains Mono** (kod, belge no) |
| Sabit AppShell | Sol sidebar + üst topbar; içerik alanı kayar |
| Küçük kartlar | Hub modül kartları, KPI kartları; abartılı padding yok |
| Sade border | `1px` nötr border; hafif gölge (`shadow-sm`) |
| Kontrollü accent | Teal birincil (`#0d6e7a`); sidebar koyu slate; turuncu yalnızca önizleme/uyarı şeridi |
| Daraltılabilir sidebar | 248px açık / 72px kapalı; tercih `localStorage` |
| Modül ikonları | Emoji yok; renkli gradient kutu + stroke SVG |
| i18n hazır | Hardcoded UI metni yok (Gate 1); tr/en/ru/uz |
| UTF-8 Türkçe | Sistem ana dili Türkçe; ç, ğ, ı, İ, ö, ş, ü zorunlu |

---

## 4. Yasaklar (yapılmayacaklar)

| Yasak | Gerekçe |
|-------|---------|
| Büyük hero alanı | ERP giriş/dashboard; landing değil |
| Glassmorphism, glow, neon gradient | Kurumsal sade çizgi |
| Satış sitesi / marketing landing havası | Ürün içi operasyon paneli |
| V2 `style.css` devralma | Teknik borç ve tutarsızlık |
| Sayfa başına özel layout CSS (Gate 1+) | Token + `@factoryos/ui` bileşenleri |
| Dark mode (Gate 0–1) | Sonra ayrı karar; şimdilik tek açık tema |

---

## 5. Design tokenlar (`:root`)

Mockup’larda kullanılan değerler Gate 1 CSS token dosyalarının başlangıç setidir.

```css
--fos-primary: #0d6e7a;
--fos-primary-hover: #0a5862;
--fos-primary-muted: #e6f4f6;
--fos-accent: #e85d2c;
--fos-bg: #f4f6f9;
--fos-surface: #ffffff;
--fos-border: #e2e8f0;
--fos-border-strong: #cbd5e1;
--fos-text: #0f172a;
--fos-text-secondary: #64748b;
--fos-text-muted: #94a3b8;
--fos-sidebar: #0f172a;
--fos-sidebar-accent: #2dd4bf;
--fos-success: #059669;
--fos-warning: #d97706;
--fos-sidebar-w: 248px;
--fos-sidebar-w-collapsed: 72px;
--fos-topbar-h: 56px;
--fos-radius-sm: 6px;
--fos-radius: 10px;
--fos-font: "DM Sans", system-ui, sans-serif;
--fos-mono: "JetBrains Mono", monospace;
```

Modül hub ikon renkleri (ana sayfa): HR mor, Stok teal, Satınalma turuncu, Raporlamalar indigo, Finans yeşil (yakında), Yönetim slate, Projeler mavi — mockup’taki sınıflar referans alınır.

---

## 6. AppShell yapısı

```text
┌─────────────────────────────────────────────────────────┐
│ [≡] Breadcrumb / başlık          [ara] [dil] [avatar]   │  ← Topbar (sticky)
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │  İçerik (padding 24px)                      │
│ (fixed)  │  · PageHeader / KPI / Card / DataTable      │
│          │                                               │
│ Brand    │                                               │
│ Nav      │                                               │
│ (modül)  │                                               │
└──────────┴──────────────────────────────────────────────┘
```

- **Sidebar:** modül grupları (Genel, Modüller, Sistem); aktif öğe sol accent çizgisi.
- **Topbar:** sidebar toggle, breadcrumb, isteğe bağlı arama, dil, kullanıcı.
- **Ana sayfa hub:** modül kartları + KPI + son işlemler + bekleyen görevler (mockup).

---

## 7. Bileşen görünümü (Gate 1 hedef)

| Bileşen | Görsel not |
|---------|------------|
| Button | Primary teal; secondary border; ghost metin |
| Card | Beyaz yüzey, ince border, hafif gölge |
| DataTable | Sticky header hissi; uppercase kolon başlığı; satır hover |
| Badge | Pill; success/warning/info pastel arka plan |
| Modal | Ortalanmış; backdrop; footer aksiyon alanı |
| Toast | Sağ alt; kart stili |
| Tabs | Alt çizgi aktif (admin mockup) |
| Toggle | Teal aktif switch (registry) |

Detaylı API: [`01-central-ui-design-system.md`](./01-central-ui-design-system.md) (henüz tam FROZEN değil).

---

## 8. Gate 0 / Gate 1 ilişkisi

| Aşama | UI ile ilgili iş |
|-------|------------------|
| Gate 0 (şimdi) | Bu belge ☑ FROZEN — görsel yön kilitli |
| Gate 0 (devam) | Bileşen kataloğu, responsive matris, CSS yasağı → `01` tamamlanmalı |
| Gate 1 | Ayrı repo; `@factoryos/ui`; mockup’lara sadık demo shell |
| Gate 2+ | Modül ekranları aynı AppShell içinde; yeni görsel dil üretilmez |

---

## 9. Sapma yönetimi

Görsel yönde değişiklik gerekiyorsa:

1. Bu belgede versiyon artırılır ve değişiklik gerekçesi yazılır.
2. Mockup HTML güncellenir veya yeni mockup eklenir.
3. Proje lideri onayı olmadan Gate 1 implementasyonu sapmaz.

---

## 10. Onay

| Rol | İsim | Tarih | Not |
|-----|------|-------|-----|
| Proje sahibi | | 19.05.2026 | FactoryOS V3 UI yönü kabul |
| Frontend lead | | | |
| UX / Ürün | | | |

**Sonuç:** Görsel yön **FROZEN**. Gate 0 genel PASS için diğer spec’ler bkz. [`00-gate0-required-documents.md`](./00-gate0-required-documents.md).
