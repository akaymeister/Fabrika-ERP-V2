const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FRONTEND_PUBLIC = path.join(ROOT, 'frontend', 'public');
const UPLOADS_ROOT = path.join(ROOT, 'uploads');
const BACKUP_ROOT = process.env.BACKUP_DIR
  ? path.isAbsolute(process.env.BACKUP_DIR)
    ? process.env.BACKUP_DIR
    : path.join(ROOT, process.env.BACKUP_DIR)
  : path.join(ROOT, 'backups');

module.exports = { ROOT, FRONTEND_PUBLIC, UPLOADS_ROOT, BACKUP_ROOT };
