const express = require('express');
const { getSummary, getActivity } = require('../controllers/dashboardController');
const { requireAuth } = require('../middlewares/requireAuth');

const router = express.Router();

// Modül 1: Dashboard — tüm uç noktalar oturum gerektirir
router.get('/summary', requireAuth, getSummary);
router.get('/activity', requireAuth, getActivity);

module.exports = router;
