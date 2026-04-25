const express = require('express');
const { requireAuth } = require('../middlewares/requireAuth');
const { requirePermission } = require('../middlewares/requirePermission');
const {
  getHrScope,
  getDepartments,
  postDepartment,
  patchDepartment,
  getPositions,
  postPosition,
  patchPosition,
  getEmployees,
  getEmployee,
  postEmployee,
  patchEmployee,
  getAssignableUsers,
  getAttendance,
  postAttendance,
  patchAttendance,
} = require('../controllers/hrController');

const router = express.Router();

router.use(requireAuth);
router.use(requirePermission('module.hr'));

router.get('/scope', getHrScope);
router.get('/departments', getDepartments);
router.post('/departments', postDepartment);
router.patch('/departments/:id', patchDepartment);
router.get('/positions', getPositions);
router.post('/positions', postPosition);
router.patch('/positions/:id', patchPosition);
router.get('/employees', getEmployees);
router.get('/employees/:id', getEmployee);
router.post('/employees', postEmployee);
router.patch('/employees/:id', patchEmployee);
router.get('/users', getAssignableUsers);
router.get('/attendance', getAttendance);
router.post('/attendance', postAttendance);
router.patch('/attendance/:id', patchAttendance);

module.exports = router;
