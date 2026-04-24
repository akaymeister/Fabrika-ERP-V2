const express = require('express');
const { requireAuth } = require('../middlewares/requireAuth');
const { requirePermission, requireAnyPermission } = require('../middlewares/requirePermission');
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
  postOrderStartProcessing,
  postOrderBuyerAction,
  postRequestBuyerAction,
  postGoodsReceipt,
} = require('../controllers/purchasingController');

const router = express.Router();
const PUR = 'module.purchasing';
const PUR_REQ = ['module.purchasing.request', 'module.purchasing'];
const PUR_APP = ['module.purchasing.approve', 'module.purchasing'];
const PUR_SEE_BASE = ['module.purchasing.request', 'module.purchasing.approve', 'module.purchasing'];
/** Depo (module.stock) talep listesini görebilsin — satınalma «gelen» ile aynı kaynak */
const PUR_SEE = [...PUR_SEE_BASE, 'module.stock'];
/** Depo kabul (mal kabul) sayfası stok modülüne taşındı: module.stock da bu uçlara erişir */
const ANY = ['module.purchasing', 'module.purchasing.receipt', 'module.stock'];

router.use(requireAuth);

router.get('/scope', getScope);
router.get('/warehouses', requireAnyPermission(ANY), getWarehouses);
router.get('/orders', requireAnyPermission(ANY), getOrders);
router.get('/orders/:id', requireAnyPermission(ANY), getOrder);
router.put('/orders/:id', requirePermission(PUR), putOrder);
router.put('/orders/:id/pricing', requirePermission(PUR), putOrderPricing);
router.post('/orders/:id/start-processing', requirePermission(PUR), postOrderStartProcessing);
router.post('/orders/:id/buyer-action', requirePermission(PUR), postOrderBuyerAction);
router.post('/goods-receipts', requireAnyPermission(ANY), postGoodsReceipt);

router.get('/next-request-code', requireAnyPermission(PUR_REQ), getNextRequestCode);
router.get('/units', requireAnyPermission(PUR_REQ), getUnitsForPurchase);
router.get('/products', requireAnyPermission(PUR_REQ), getProductsForPurchase);
router.post('/line-attachment', requireAnyPermission(PUR_REQ), (req, res, next) => {
  lineUpload.single('file')(req, res, (e) => {
    if (e) {
      return res.status(400).json(jsonError('VALIDATION', e.message || 'Yükleme hatası', null, 'api.pur.upload_invalid'));
    }
    return next();
  });
}, postLineAttachment);

router.get('/product-options', requireAnyPermission(PUR_REQ), getProductOptions);
router.get('/projects-brief', requireAnyPermission(PUR_REQ), getProjectsBrief);
router.get('/suppliers', requirePermission(PUR), getSuppliers);
router.post('/suppliers', requirePermission(PUR), postSupplier);
router.get('/requests', requireAnyPermission(PUR_SEE), getRequests);
router.get('/requests/:id/receipt-orders', requireAnyPermission(ANY), getRequestReceiptOrders);
router.get('/requests/:id', requireAnyPermission(PUR_SEE_BASE), getRequestById);
router.put('/requests/:id', requireAnyPermission(PUR_REQ), putRequest);
router.post('/requests', requireAnyPermission(PUR_REQ), postRequest);
router.post('/requests/:id/submit', requireAnyPermission(PUR_REQ), postRequestSubmit);
router.post('/requests/:id/cancel', requireAnyPermission(PUR_SEE_BASE), postRequestCancel);
router.patch('/requests/:id/status', requireAnyPermission(PUR_APP), patchRequestStatus);
router.post('/requests/:id/buyer-action', requirePermission(PUR), postRequestBuyerAction);
router.get('/approved-request-items', requirePermission(PUR), getApprovedRequestItems);
router.post('/orders', requirePermission(PUR), postOrder);

module.exports = router;
