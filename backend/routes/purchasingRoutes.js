const express = require('express');
const { requireAuth } = require('../middlewares/requireAuth');
const { requireAnyPermission } = require('../middlewares/requirePermission');
const { jsonError } = require('../utils/apiResponse');
const {
  getScope,
  getProductOptions,
  getProjectsBrief,
  getNextRequestCode,
  getUnitsForPurchase,
  getProductsForPurchase,
  lineUpload,
  postLineAttachment,
  getWarehouses,
  getSuppliers,
  postSupplier,
  putSupplier,
  getHubCounters,
  getRequests,
  getRequestById,
  getRequestReceiptOrders,
  putRequest,
  postRequest,
  postRequestSubmit,
  postRequestCancel,
  patchRequestStatus,
  getApprovedRequestItems,
  postOrder,
  getOrders,
  getOrder,
  putOrder,
  putOrderPricing,
  postCancelOrderLine,
  postOrderStartProcessing,
  postOrderBuyerAction,
  postRequestBuyerAction,
  postGoodsReceipt,
} = require('../controllers/purchasingController');

const router = express.Router();
// Faz 3 granular: her grup için eski (kaba) izinler + yeni granular izinler.
// Eski module.X kullanıcıları kırılmaz (OR); yeni granular kullanıcılar açabilir.
const PUR = ['module.purchasing', 'purchasing.hub.view', 'purchasing.order.view'];
const PUR_EDIT = ['module.purchasing', 'purchasing.order.price_edit', 'purchasing.processing.view'];
const PUR_REQ_SEE = [
  'module.purchasing.request',
  'module.purchasing',
  'purchasing.request.view',
  'purchasing.request.create',
];
const PUR_REQ_CREATE = [
  'module.purchasing.request',
  'module.purchasing',
  'purchasing.request.create',
];
const PUR_REQ_APPROVE = [
  'module.purchasing.approve',
  'module.purchasing',
  'purchasing.request.approve',
];
// "LİSTE GÖRME" amaçlı API'ler için: yalnızca view/approve. Talep oluşturma
// yetkili olan kullanıcı liste API'sinden geçmez (kullanıcı planı uyumu —
// Depocu sadece talep aç görür, listeyi görmez).
const PUR_SEE_BASE = [
  'module.purchasing.request',
  'module.purchasing.approve',
  'module.purchasing',
  'purchasing.request.view',
  'purchasing.request.approve',
  'purchasing.hub.view',
];
// "TEKİL GÖRME" amaçlı API'ler için: yukarıdakine ek olarak talep oluşturma
// yetkili kullanıcı kendi açtığı/açacağı talebi açabilmek için izinli olur.
// (Controller'da sahip filtresi varsa zaten ek koruma sağlanır.)
const PUR_SEE_ONE = [...PUR_SEE_BASE, 'purchasing.request.create'];
/** Depo (stock) talep listesini görebilsin — satınalma «gelen» ile aynı kaynak */
const PUR_SEE = [...PUR_SEE_BASE, 'module.stock', 'stock.hub.view', 'stock.movements.view'];
/** Sipariş listesi: satınalmacı + depo + onaycı (fiyatlar hidePrice ile maskelenir) */
const ANY = [
  'module.purchasing',
  'module.purchasing.receipt',
  'module.stock',
  'module.purchasing.approve',
  'purchasing.hub.view',
  'purchasing.order.view',
  'purchasing.receipt.view',
  'stock.hub.view',
];
const PUR_RECEIPT_CREATE = [
  'module.purchasing',
  'module.purchasing.receipt',
  'module.stock',
  'purchasing.receipt.create',
];
const PUR_SUPPLIERS_VIEW = ['module.purchasing', 'purchasing.suppliers.view'];
const PUR_SUPPLIERS_EDIT = ['module.purchasing', 'purchasing.suppliers.view'];

router.use(requireAuth);

router.get('/scope', getScope);
router.get('/hub-counters', requireAnyPermission(PUR_SEE_BASE), getHubCounters);
router.get('/warehouses', requireAnyPermission(ANY), getWarehouses);
router.get('/orders', requireAnyPermission(ANY), getOrders);
router.get('/orders/:id', requireAnyPermission(ANY), getOrder);
router.put('/orders/:id', requireAnyPermission(PUR_EDIT), putOrder);
router.put('/orders/:id/pricing', requireAnyPermission(['module.purchasing', 'purchasing.order.price_edit']), putOrderPricing);
router.post('/orders/:id/items/:itemId/cancel', requireAnyPermission(PUR_EDIT), postCancelOrderLine);
router.post('/orders/:id/start-processing', requireAnyPermission(PUR_EDIT), postOrderStartProcessing);
router.post('/orders/:id/buyer-action', requireAnyPermission(PUR_EDIT), postOrderBuyerAction);
router.post('/goods-receipts', requireAnyPermission(PUR_RECEIPT_CREATE), postGoodsReceipt);

router.get('/next-request-code', requireAnyPermission(PUR_REQ_SEE), getNextRequestCode);
router.get('/units', requireAnyPermission(PUR_REQ_SEE), getUnitsForPurchase);
router.get('/products', requireAnyPermission(PUR_REQ_SEE), getProductsForPurchase);
router.post('/line-attachment', requireAnyPermission(PUR_REQ_CREATE), (req, res, next) => {
  lineUpload.single('file')(req, res, (e) => {
    if (e) {
      return res.status(400).json(jsonError('VALIDATION', e.message || 'Yükleme hatası', null, 'api.pur.upload_invalid'));
    }
    return next();
  });
}, postLineAttachment);

router.get('/product-options', requireAnyPermission(PUR_REQ_SEE), getProductOptions);
router.get('/projects-brief', requireAnyPermission(PUR_REQ_SEE), getProjectsBrief);
router.get('/suppliers', requireAnyPermission(PUR_SUPPLIERS_VIEW), getSuppliers);
router.post('/suppliers', requireAnyPermission(PUR_SUPPLIERS_EDIT), postSupplier);
router.put('/suppliers/:id', requireAnyPermission(PUR_SUPPLIERS_EDIT), putSupplier);
router.get('/requests', requireAnyPermission(PUR_SEE), getRequests);
router.get('/requests/:id/receipt-orders', requireAnyPermission(ANY), getRequestReceiptOrders);
router.get('/requests/:id', requireAnyPermission(PUR_SEE_ONE), getRequestById);
router.put('/requests/:id', requireAnyPermission(PUR_REQ_CREATE), putRequest);
router.post('/requests', requireAnyPermission(PUR_REQ_CREATE), postRequest);
router.post('/requests/:id/submit', requireAnyPermission(PUR_REQ_CREATE), postRequestSubmit);
router.post('/requests/:id/cancel', requireAnyPermission(PUR_SEE_BASE), postRequestCancel);
router.patch('/requests/:id/status', requireAnyPermission(PUR_REQ_APPROVE), patchRequestStatus);
router.post('/requests/:id/buyer-action', requireAnyPermission(PUR_EDIT), postRequestBuyerAction);
router.get('/approved-request-items', requireAnyPermission(PUR_EDIT), getApprovedRequestItems);
router.post('/orders', requireAnyPermission(PUR_EDIT), postOrder);

module.exports = router;
