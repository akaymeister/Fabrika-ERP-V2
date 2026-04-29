const express = require('express');
const { requireAuth } = require('../middlewares/requireAuth');
const { getProfile, postChangePassword } = require('../controllers/meController');

const router = express.Router();

router.use(requireAuth);
router.get('/profile', getProfile);
router.post('/change-password', postChangePassword);

module.exports = router;
