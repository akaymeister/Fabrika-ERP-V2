-- Taşıyıcı rol: pozisyonlu kullanıcılar users.role_id FK için (yetki position_permissions üzerinden)
SET NAMES utf8mb4;

INSERT IGNORE INTO roles (name, slug) VALUES ('PERSONEL', 'staff');

DELETE rp FROM role_permissions rp
INNER JOIN roles r ON r.id = rp.role_id AND r.slug = 'staff';
