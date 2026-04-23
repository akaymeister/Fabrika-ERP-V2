const express = require('express');
const { requireAuth } = require('../middlewares/requireAuth');
const { requireSuperAdmin } = require('../middlewares/requireSuperAdmin');
const {
  getRolesList,
  getPermissionCatalog,
  getRolePermissionsById,
  putRolePermissionsById,
  getUserExtraPerms,
  putUserExtraPerms,
  getUsersList,
  postUser,
  patchUser,
  postResetPassword,
} = require('../controllers/adminUserController');
const { getSettings, putSettings } = require('../controllers/systemSettingsController');

const router = express.Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

router.get('/roles', getRolesList);
router.get('/permissions', getPermissionCatalog);
router.get('/roles/:id/permissions', getRolePermissionsById);
router.put('/roles/:id/permissions', putRolePermissionsById);

router.get('/users', getUsersList);
router.post('/users', postUser);
router.patch('/users/:id', patchUser);
router.post('/users/:id/reset-password', postResetPassword);
router.get('/users/:id/permissions', getUserExtraPerms);
router.put('/users/:id/permissions', putUserExtraPerms);

router.get('/settings', getSettings);
router.put('/settings', putSettings);

module.exports = router;
