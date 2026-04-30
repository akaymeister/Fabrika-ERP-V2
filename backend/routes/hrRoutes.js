const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middlewares/requireAuth');
const { requirePermission } = require('../middlewares/requirePermission');
const { jsonError } = require('../utils/apiResponse');
const { UPLOADS_ROOT } = require('../utils/paths');
const {
  getHrScope,
  getDepartments,
  postDepartment,
  patchDepartment,
  getPositions,
  postPosition,
  patchPosition,
  getEmployees,
  getCompensationEmployees,
  getEmployee,
  postEmployee,
  patchEmployee,
  postEmployeePhoto,
  getAssignableUsers,
  getAttendance,
  postAttendance,
  patchAttendance,
  getDailyAttendanceSummary,
  getDailyAttendance,
  putDailyAttendanceBulk,
  getMonthlyAttendance,
  patchMonthlyAttendanceRow,
  getAttendanceLocks,
  getAttendanceProjects,
  postAttendanceLock,
  postAttendanceUnlock,
  getHrSettings,
  putHrSettings,
  getWorkTypes,
  postWorkType,
  patchWorkType,
  removeWorkType,
  getWorkStatuses,
  postWorkStatus,
  patchWorkStatus,
  removeWorkStatus,
} = require('../controllers/hrController');

const router = express.Router();

const hrEmployeesDir = path.join(UPLOADS_ROOT, 'hr-employees');
if (!fs.existsSync(hrEmployeesDir)) {
  fs.mkdirSync(hrEmployeesDir, { recursive: true });
}

const hrEmployeePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, hrEmployeesDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
      cb(null, `${req.params.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okMime = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(okMime ? null : new Error('INVALID_PHOTO'), okMime);
  },
});

function uploadEmployeePhotoMw(req, res, next) {
  hrEmployeePhotoUpload.single('photo')(req, res, (err) => {
    if (err) {
      return res
        .status(400)
        .json(jsonError('VALIDATION', 'Gecersiz fotograf dosyasi', null, 'api.hr.photo_invalid'));
    }
    next();
  });
}

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
router.get('/compensation/employees', requirePermission('hr.compensation.view'), getCompensationEmployees);
router.get('/employees/:id', getEmployee);
router.post('/employees', postEmployee);
router.post('/employees/:id/photo', uploadEmployeePhotoMw, postEmployeePhoto);
router.patch('/employees/:id', patchEmployee);
router.get('/users', getAssignableUsers);
router.get('/attendance', getAttendance);
router.post('/attendance', requirePermission('hr.attendance.edit'), postAttendance);
router.patch('/attendance/:id', requirePermission('hr.attendance.edit'), patchAttendance);
router.get('/attendance/daily-summary', getDailyAttendanceSummary);
router.get('/attendance/daily', getDailyAttendance);
router.put('/attendance/daily-bulk', requirePermission('hr.attendance.edit'), putDailyAttendanceBulk);
router.get('/attendance/monthly', getMonthlyAttendance);
router.patch('/attendance/monthly/:id', requirePermission('hr.attendance.edit'), patchMonthlyAttendanceRow);
router.get('/attendance-locks', getAttendanceLocks);
router.get('/attendance-projects', getAttendanceProjects);
router.post('/attendance-locks/lock', requirePermission('hr.attendance.unlock'), postAttendanceLock);
router.post('/attendance-locks/unlock', requirePermission('hr.attendance.unlock'), postAttendanceUnlock);
router.get('/settings', getHrSettings);
router.put('/settings', putHrSettings);
router.get('/work-types', getWorkTypes);
router.post('/work-types', postWorkType);
router.patch('/work-types/:id', patchWorkType);
router.delete('/work-types/:id', removeWorkType);
router.get('/work-statuses', getWorkStatuses);
router.post('/work-statuses', postWorkStatus);
router.patch('/work-statuses/:id', patchWorkStatus);
router.delete('/work-statuses/:id', removeWorkStatus);

module.exports = router;
