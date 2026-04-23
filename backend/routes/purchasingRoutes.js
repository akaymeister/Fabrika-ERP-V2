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
  postRequest,
  postRequestSubmit,
  postRequestCancel,
  patchRequestStatus,
  getApprovedRequestItems,
  postOrder,
  getOrders,
  getOrder,
  postGoodsReceipt,
} = require('../controllers/purchasingController');

const router = express.Router();
const PUR = 'module.purchasing';
/** Depo kabul (mal kabul) sayfası stok modülüne taşındı: module.stock da bu uçlara erişir */
const ANY = ['module.purchasing', 'module.purchasing.receipt', 'module.stock'];

router.use(requireAuth);

router.get('/scope', getScope);
router.get('/warehouses', requireAnyPermission(ANY), getWarehouses);
router.get('/orders', requireAnyPermission(ANY), getOrders);
router.get('/orders/:id', requireAnyPermission(ANY), getOrder);
router.post('/goods-receipts', requireAnyPermission(ANY), postGoodsReceipt);

router.get('/next-request-code', requirePermission(PUR), getNextRequestCode);
router.get('/units', requirePermission(PUR), getUnitsForPurchase);
router.get('/products', requirePermission(PUR), getProductsForPurchase);
router.post('/line-attachment', requirePermission(PUR), (req, res, next) => {
  lineUpload.single('file')(req, res, (e) => {
    if (e) {
      return res.status(400).json(jsonError('VALIDATION', e.message || 'Yükleme hatası', null, 'api.pur.upload_invalid'));
    }
    return next();
  });
}, postLineAttachment);

router.get('/product-options', requirePermission(PUR), getProductOptions);
router.get('/projects-brief', requirePermission(PUR), getProjectsBrief);
router.get('/suppliers', requirePermission(PUR), getSuppliers);
router.post('/suppliers', requirePermission(PUR), postSupplier);
router.get('/requests', requirePermission(PUR), getRequests);
router.post('/requests', requirePermission(PUR), postRequest);
router.post('/requests/:id/submit', requirePermission(PUR), postRequestSubmit);
router.post('/requests/:id/cancel', requirePermission(PUR), postRequestCancel);
router.patch('/requests/:id/status', requirePermission(PUR), patchRequestStatus);
router.get('/approved-request-items', requirePermission(PUR), getApprovedRequestItems);
router.post('/orders', requirePermission(PUR), postOrder);

module.exports = router;
