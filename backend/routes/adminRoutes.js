const express = require('express');
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
const { getTunnelStatus, postTunnelStart, postTunnelStop } = require('../controllers/adminTunnelController');

const router = express.Router();

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
router.get('/tunnel/status', getTunnelStatus);
router.post('/tunnel/start', postTunnelStart);
router.post('/tunnel/stop', postTunnelStop);

module.exports = router;
