const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { requireAuth } = require('../middlewares/requireAuth');
const { requireSuperAdmin } = require('../middlewares/requireSuperAdmin');
const {
  getRolesList,
  getPermissionCatalog,
  getRolePermissionsById,
  putRolePermissionsById,
  getPermissionSubjects,
  getPermissionSubjectPermissions,
  putPermissionSubjectPermissions,
  getUserExtraPerms,
  putUserExtraPerms,
  getUsersList,
  getUnlinkedEmployees,
  postUser,
  patchUser,
  patchUserPermissionSubject,
  postResetPassword,
} = require('../controllers/adminUserController');
const { getSettings, putSettings } = require('../controllers/systemSettingsController');
const {
  getBrandLogo,
  postBrandLogo,
  deleteBrandLogo,
} = require('../controllers/brandLogoController');
const { getTunnelStatus, postTunnelStart, postTunnelStop } = require('../controllers/adminTunnelController');
const {
  getActivityLogs,
  getActivityLogDetail,
  getActivityLogsMeta,
} = require('../controllers/adminActivityLogController');
const {
  getBackupRuns,
  postBackupRun,
  getBackupDownload,
  deleteBackupRun,
} = require('../controllers/adminBackupController');
const { UPLOADS_ROOT } = require('../utils/paths');
const { jsonError } = require('../utils/apiResponse');

const router = express.Router();

const brandUploadDir = path.join(UPLOADS_ROOT, 'brand');
if (!fs.existsSync(brandUploadDir)) {
  fs.mkdirSync(brandUploadDir, { recursive: true });
}

const ALLOWED_LOGO_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif']);
const ALLOWED_LOGO_MIME = new Set(['image/jpeg', 'image/png', 'image/gif']);

const brandLogoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, brandUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ALLOWED_LOGO_EXT.has(ext) ? (ext === '.jpeg' ? '.jpg' : ext) : '.png';
      cb(null, `logo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const ok = ALLOWED_LOGO_MIME.has(file.mimetype) && ALLOWED_LOGO_EXT.has(ext);
    cb(ok ? null : new Error('INVALID_LOGO'), ok);
  },
});

function uploadBrandLogoMw(req, res, next) {
  brandLogoUpload.single('logo')(req, res, (err) => {
    if (err) {
      return res
        .status(400)
        .json(jsonError('VALIDATION', 'Geçersiz logo dosyası (jpg/png/gif, max 4MB)', null, 'api.admin.brand_logo_invalid'));
    }
    next();
  });
}

router.use(requireAuth);
router.use(requireSuperAdmin);

router.get('/roles', getRolesList);
router.get('/permissions', getPermissionCatalog);
router.get('/roles/:id/permissions', getRolePermissionsById);
router.put('/roles/:id/permissions', putRolePermissionsById);
router.get('/permission-subjects', getPermissionSubjects);
router.get('/permission-subjects/:type/:id/permissions', getPermissionSubjectPermissions);
router.put('/permission-subjects/:type/:id/permissions', putPermissionSubjectPermissions);

router.get('/users', getUsersList);
router.get('/employees/unlinked', getUnlinkedEmployees);
router.post('/users', postUser);
router.patch('/users/:id', patchUser);
router.patch('/users/:id/permission-subject', patchUserPermissionSubject);
router.post('/users/:id/reset-password', postResetPassword);
router.get('/users/:id/permissions', getUserExtraPerms);
router.put('/users/:id/permissions', putUserExtraPerms);

router.get('/settings', getSettings);
router.put('/settings', putSettings);
router.get('/settings/brand-logo', getBrandLogo);
router.post('/settings/brand-logo', uploadBrandLogoMw, postBrandLogo);
router.delete('/settings/brand-logo', deleteBrandLogo);
router.get('/tunnel/status', getTunnelStatus);
router.post('/tunnel/start', postTunnelStart);
router.post('/tunnel/stop', postTunnelStop);

router.get('/activity-logs/meta', getActivityLogsMeta);
router.get('/activity-logs', getActivityLogs);
router.get('/activity-logs/:id', getActivityLogDetail);

router.get('/backup/runs', getBackupRuns);
router.post('/backup/runs', postBackupRun);
router.get('/backup/runs/:id/download', getBackupDownload);
router.delete('/backup/runs/:id', deleteBackupRun);

module.exports = router;
