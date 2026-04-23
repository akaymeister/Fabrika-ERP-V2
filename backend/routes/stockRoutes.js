const express = require('express');
const { requireAuth } = require('../middlewares/requireAuth');
const { requirePermission } = require('../middlewares/requirePermission');
const {
  getBrands,
  postBrand,
  patchBrand,
  removeBrand,
  getUnits,
  postUnit,
  getProducts,
  getProductImportTemplate,
  postProductImport,
  productImportUpload,
  postProduct,
  patchProduct,
  removeProduct,
  getMovements,
  getActiveProjectsForStock,
  postMovement,
  postVoidMovement,
  postReplaceStockIn,
  postReplaceStockOut,
  getWarehouses,
  postWarehouse,
  patchWarehouse,
  postWarehouseSub,
  patchWarehouseSub,
  removeWarehouseSub,
} = require('../controllers/stockController');

const router = express.Router();

router.use(requireAuth);
router.use(requirePermission('module.stock'));

router.get('/brands', getBrands);
router.post('/brands', postBrand);
router.patch('/brands/:id', patchBrand);
router.delete('/brands/:id', removeBrand);
router.get('/units', getUnits);
router.post('/units', postUnit);
router.get('/products/import-template', getProductImportTemplate);
router.post('/products/import', productImportUpload.single('file'), postProductImport);
router.get('/products', getProducts);
router.post('/products', postProduct);
router.patch('/products/:id', patchProduct);
router.delete('/products/:id', removeProduct);
router.get('/movements', getMovements);
router.get('/active-projects', getActiveProjectsForStock);
router.post('/movements', postMovement);
router.post('/movements/:id/void', postVoidMovement);
router.post('/movements/:id/replace', postReplaceStockIn);
router.post('/movements/:id/replace-out', postReplaceStockOut);
router.get('/warehouses', getWarehouses);
router.post('/warehouses', postWarehouse);
router.patch('/warehouses/:id', patchWarehouse);
router.post('/warehouses/:id/subcategories', postWarehouseSub);
router.patch('/warehouses/:id/subcategories/:subId', patchWarehouseSub);
router.delete('/warehouses/:id/subcategories/:subId', removeWarehouseSub);

module.exports = router;
