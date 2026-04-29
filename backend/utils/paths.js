const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FRONTEND_PUBLIC = path.join(ROOT, 'frontend', 'public');
const UPLOADS_ROOT = path.join(ROOT, 'uploads');

module.exports = { ROOT, FRONTEND_PUBLIC, UPLOADS_ROOT };
