const express = require('express');
const { getSummary, getActivity } = require('../controllers/dashboardController');
const { requireAuth } = require('../middlewares/requireAuth');
const { requireAnyPermission } = require('../middlewares/requirePermission');

const router = express.Router();

// Dashboard activity (son stok hareketleri) → stok modülüne özel.
// Eski 'module.stock' yetkili kullanıcılar geriye uyum için geçer; yeni
// granular kullanıcılar herhangi bir stok view izniyle geçer. Super admin
// her ikisini de userHasAnyPermission içindeki shortcut ile geçer.
const STOCK_VIEW_ANY = [
  'module.stock',
  'stock.hub.view',
  'stock.products.view',
  'stock.movements.view',
  'stock.in.view',
  'stock.out.view',
];

// Modül 1: Dashboard.
// Özet KPI'lar oturum gerektirir; controller içinde permission'a göre
// alanlar filtrelenir (bkz. dashboardController.getSummary).
router.get('/summary', requireAuth, getSummary);
// Aktivite endpoint'i fail-closed: stok view izni olmayan 403 alır.
router.get('/activity', requireAuth, requireAnyPermission(STOCK_VIEW_ANY), getActivity);

module.exports = router;
