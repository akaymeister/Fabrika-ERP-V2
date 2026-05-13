const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middlewares/requireAuth');
const { requirePermission, requireAnyPermission } = require('../middlewares/requirePermission');
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
  getEmployeeCompensationHistory,
  getEmployeeCompensationCurrent,
  postEmployee,
  postCompensationRevision,
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
  postWagePreview,
  getPayrollSnapshot,
  postPayrollDispute,
  patchPayrollDispute,
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
// Faz 3 granular: HR modülü her route'da kaba 'module.hr' veya ilgili granular
// HR iznine (hr.hub.view, hr.employees.view, hr.attendance.view, ...) ihtiyaç
// duyar. Eski 'module.hr' kullanıcıları kırılmaz.
const HR_ANY = [
  'module.hr',
  'hr.hub.view',
  'hr.employees.view',
  'hr.attendance.view',
  'hr.payroll.view',
  'hr.compensation.view',
];
const HR_EMP_VIEW = ['module.hr', 'hr.employees.view'];
const HR_EMP_EDIT = ['module.hr', 'hr.employees.edit'];
const HR_ATT_VIEW = ['module.hr', 'hr.attendance.view'];

router.get('/scope', requireAnyPermission(HR_ANY), getHrScope);
router.get('/departments', requireAnyPermission(HR_ANY), getDepartments);
router.post('/departments', requireAnyPermission(HR_EMP_EDIT), postDepartment);
router.patch('/departments/:id', requireAnyPermission(HR_EMP_EDIT), patchDepartment);
router.get('/positions', requireAnyPermission(HR_ANY), getPositions);
router.post('/positions', requireAnyPermission(HR_EMP_EDIT), postPosition);
router.patch('/positions/:id', requireAnyPermission(HR_EMP_EDIT), patchPosition);
router.get('/employees', requireAnyPermission(HR_EMP_VIEW), getEmployees);
router.get('/compensation/employees', requirePermission('hr.compensation.view'), getCompensationEmployees);
router.get('/employees/:id/compensation-history', requirePermission('hr.salary.history_view'), getEmployeeCompensationHistory);
router.get('/employees/:id/compensation-current', requirePermission('hr.salary.history_view'), getEmployeeCompensationCurrent);
router.post(
  '/employees/:id/compensation-revisions',
  requirePermission('hr.salary.edit'),
  postCompensationRevision
);
router.get('/employees/:id', requireAnyPermission(HR_EMP_VIEW), getEmployee);
router.post('/employees', requireAnyPermission(HR_EMP_EDIT), postEmployee);
router.post('/employees/:id/photo', requireAnyPermission(HR_EMP_EDIT), uploadEmployeePhotoMw, postEmployeePhoto);
router.patch('/employees/:id', requireAnyPermission(HR_EMP_EDIT), patchEmployee);
router.get('/users', requireAnyPermission(HR_ANY), getAssignableUsers);
router.get('/attendance', requireAnyPermission(HR_ATT_VIEW), getAttendance);
router.post('/attendance', requirePermission('hr.attendance.edit'), postAttendance);
router.patch('/attendance/:id', requirePermission('hr.attendance.edit'), patchAttendance);
router.get('/attendance/daily-summary', requireAnyPermission(HR_ATT_VIEW), getDailyAttendanceSummary);
router.get('/attendance/daily', requireAnyPermission(HR_ATT_VIEW), getDailyAttendance);
router.put('/attendance/daily-bulk', requirePermission('hr.attendance.edit'), putDailyAttendanceBulk);
router.get('/attendance/monthly', requireAnyPermission(HR_ATT_VIEW), getMonthlyAttendance);
router.patch('/attendance/monthly/:id', requirePermission('hr.attendance.edit'), patchMonthlyAttendanceRow);
router.get('/attendance-locks', requireAnyPermission(HR_ATT_VIEW), getAttendanceLocks);
router.get('/attendance-projects', requireAnyPermission(HR_ATT_VIEW), getAttendanceProjects);
router.post('/attendance-locks/lock', requirePermission('hr.attendance.unlock'), postAttendanceLock);
router.post('/attendance-locks/unlock', requirePermission('hr.attendance.unlock'), postAttendanceUnlock);
router.get('/settings', requireAnyPermission(HR_ANY), getHrSettings);
router.put('/settings', requireAnyPermission(['module.hr']), putHrSettings);
router.get('/work-types', requireAnyPermission(HR_ANY), getWorkTypes);
router.post('/work-types', requireAnyPermission(['module.hr']), postWorkType);
router.patch('/work-types/:id', requireAnyPermission(['module.hr']), patchWorkType);
router.delete('/work-types/:id', requireAnyPermission(['module.hr']), removeWorkType);
router.get('/work-statuses', requireAnyPermission(HR_ANY), getWorkStatuses);
router.post('/work-statuses', requireAnyPermission(['module.hr']), postWorkStatus);
router.patch('/work-statuses/:id', requireAnyPermission(['module.hr']), patchWorkStatus);
router.delete('/work-statuses/:id', requireAnyPermission(['module.hr']), removeWorkStatus);

// Maaş kırılımı preview (stateless). module.hr veya granular HR izniyle çalışır.
router.post('/wage/preview', requireAnyPermission(HR_ANY), postWagePreview);

router.get('/payroll/snapshot', requirePermission('hr.payroll.view'), getPayrollSnapshot);
router.post('/payroll/disputes', requirePermission('hr.payroll.edit'), postPayrollDispute);
router.patch('/payroll/disputes/:id', requirePermission('hr.payroll.edit'), patchPayrollDispute);

module.exports = router;
