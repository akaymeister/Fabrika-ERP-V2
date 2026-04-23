const express = require('express');
const { postLogin, postLogout, getMe } = require('../controllers/authController');
const { requireAuth } = require('../middlewares/requireAuth');

const router = express.Router();

router.post('/login', postLogin);
router.post('/logout', postLogout);
router.get('/me', requireAuth, getMe);

module.exports = router;
