-- Stok modülü: varsayılan rollere module.stock
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.perm_key = 'module.stock'
  AND r.slug IN ('admin', 'yonetici', 'satin_almaci', 'depocu');
