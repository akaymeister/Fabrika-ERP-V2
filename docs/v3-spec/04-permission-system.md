# 04 — Permission System (özet kart)

**Durum:** ☐ TASLAK | ☐ İNCELEMEDE | ☐ FROZEN  
**Versiyon:** 1.0.0  
**Son güncelleme:** 19.05.2026

---

## Otorite

Detaylı Gate 0 blueprint:

**→ [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md)**

Bu dosya checklist #4 eşlemesi içindir. Doldurma, kabul kriterleri, test senaryoları ve V2 referansları **yalnızca** yukarıdaki belgede güncellenir.

---

## Tek cümle özet

Tek `PermissionGate`: `super_admin` → `role_permissions` → `position_permissions` → `user_permissions` (istisna); API + sayfa + menü + aksiyon aynı `perm_key`; pasif registry → 403.

---

## Gate 0 kapanış kontrolü

- [ ] [01-permission-role-position-blueprint.md](./01-permission-role-position-blueprint.md) — **FROZEN**
- [ ] Bu özet kartta durum FROZEN işaretlendi
