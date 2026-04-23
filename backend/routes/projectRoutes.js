const express = require('express');
const { requireAuth } = require('../middlewares/requireAuth');
const { requirePermission } = require('../middlewares/requirePermission');
const { getProjects, postProject, putProject, patchProject, deleteProjectById } = require('../controllers/projectController');

const router = express.Router();
router.use(requireAuth);
router.use(requirePermission('module.projects'));

router.get('/', getProjects);
router.post('/', postProject);
router.put('/:id', putProject);
router.patch('/:id', patchProject);
router.delete('/:id', deleteProjectById);

module.exports = router;
