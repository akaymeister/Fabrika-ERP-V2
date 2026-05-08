const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middlewares/requireAuth');
const { requirePermission } = require('../middlewares/requirePermission');
const { UPLOADS_ROOT } = require('../utils/paths');
const {
  getProjects,
  postBoq,
  getBoq,
  getBoqDetail,
  patchBoq,
  deleteBoq,
  postWorkItem,
  patchWorkItem,
  deleteWorkItem,
  postAssign,
  deleteAssign,
  postColumn,
  patchColumn,
  getAssignableEmployees,
  getWorkItemDepartmentTasks,
  getWorkItemHistory,
  postWorkItemDepartmentTaskInit,
  postWorkItemDepartmentTask,
} = require('../controllers/projectControlController');
const { jsonError } = require('../utils/apiResponse');

const router = express.Router();

const projectControlUploadDir = path.join(UPLOADS_ROOT, 'project-control');
if (!fs.existsSync(projectControlUploadDir)) {
  fs.mkdirSync(projectControlUploadDir, { recursive: true });
}

const boqUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, projectControlUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ['.xlsx', '.xls', '.csv'].includes(ext) ? ext : '.xlsx';
      cb(null, `boq-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok =
      ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'].includes(file.mimetype) ||
      /\.(xlsx|xls|csv)$/i.test(file.originalname || '');
    cb(ok ? null : new Error('INVALID_BOQ_FILE'), ok);
  },
});

function uploadBoqMw(req, res, next) {
  boqUpload.single('file')(req, res, (err) => {
    if (err) {
      return res
        .status(400)
        .json(jsonError('VALIDATION', 'Gecersiz BOQ dosyasi', null, 'api.project_control.import_invalid_file'));
    }
    return next();
  });
}

router.use(requireAuth);
router.use(requirePermission('projects.control.view'));

router.get('/projects', getProjects);
router.get('/boq', getBoq);
router.get('/boq/:revisionId', getBoqDetail);
router.get('/employees', getAssignableEmployees);

router.post('/boq', requirePermission('projects.control.boq.upload'), uploadBoqMw, postBoq);
router.patch('/boq/:revisionId', requirePermission('projects.control.boq.edit'), patchBoq);
router.delete('/boq/:revisionId', requirePermission('projects.control.boq.delete'), deleteBoq);

router.post('/work-items', requirePermission('projects.control.boq.edit'), postWorkItem);
router.patch('/work-items/:id', requirePermission('projects.control.boq.edit'), patchWorkItem);
router.delete('/work-items/:id', requirePermission('projects.control.boq.edit'), deleteWorkItem);
router.post('/work-items/:id/assign', requirePermission('projects.control.assign_person'), postAssign);
router.delete('/work-items/:id/assign', requirePermission('projects.control.assign_person'), deleteAssign);
router.get('/work-items/:id/department-tasks', requirePermission('projects.control.view'), getWorkItemDepartmentTasks);
router.get('/work-items/:id/history', requirePermission('projects.control.view'), getWorkItemHistory);
router.post('/work-items/:id/department-tasks/init', requirePermission('projects.control.boq.edit'), postWorkItemDepartmentTaskInit);
router.post('/work-items/:id/department-tasks', requirePermission('projects.control.boq.edit'), postWorkItemDepartmentTask);

router.post('/columns', requirePermission('projects.control.boq.edit'), postColumn);
router.patch('/columns/:id', requirePermission('projects.control.boq.edit'), patchColumn);

module.exports = router;
