const express = require('express');
const { requireAuth } = require('../middlewares/requireAuth');
const { requirePermission } = require('../middlewares/requirePermission');
const {
  getHrScope,
  getDepartments,
  postDepartment,
  getPositions,
  postPosition,
  getEmployees,
  postEmployee,
  getAttendance,
  postAttendance,
} = require('../controllers/hrController');

const router = express.Router();

router.use(requireAuth);
router.use(requirePermission('module.hr'));

router.get('/scope', getHrScope);
router.get('/departments', getDepartments);
router.post('/departments', postDepartment);
router.get('/positions', getPositions);
router.post('/positions', postPosition);
router.get('/employees', getEmployees);
router.post('/employees', postEmployee);
router.get('/attendance', getAttendance);
router.post('/attendance', postAttendance);

module.exports = router;
