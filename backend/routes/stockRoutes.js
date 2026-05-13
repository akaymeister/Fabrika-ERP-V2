const express = require('express');
const { requireAuth } = require('../middlewares/requireAuth');
const { requireAnyPermission } = require('../middlewares/requirePermission');
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

// Faz 3 granular: route-bazlı OR pattern. Eski 'module.stock' her zaman kabul
// (geriye uyumluluk); yeni granular izinlerden en az biri olan kullanıcı da geçer.
// Aksiyon route'ları (POST/PATCH/DELETE) için 'module.stock' VEYA ilgili
// granular aksiyon iznine ihtiyaç var; eski kullanıcı kırılmaz, yeni
// granular kullanıcının module.stock'u olmasa bile uygun aksiyon iznine
// sahipse devam eder.
const STK_BRANDS_VIEW = ['module.stock', 'stock.brands.view'];
const STK_BRANDS_EDIT = ['module.stock', 'stock.brands.view']; // brand edit izni yok; module.stock veya brands.view ile sınırlı (admin işi)
const STK_PRODUCTS_VIEW = ['module.stock', 'stock.products.view'];
const STK_PRODUCTS_EDIT = ['module.stock', 'stock.products.view'];
const STK_WHS_VIEW = ['module.stock', 'stock.warehouses.view'];
const STK_WHS_EDIT = ['module.stock', 'stock.warehouses.view'];
const STK_MOV_VIEW = ['module.stock', 'stock.movements.view', 'stock.in.view', 'stock.out.view'];
const STK_IN_CREATE = ['module.stock', 'stock.in.create'];
const STK_OUT_CREATE = ['module.stock', 'stock.out.create'];
// In/out birleşik movement controller'ı tip'e göre seçim yapar (postMovement);
// fail-closed mantığı için her iki create izninden birini yeterli sayarız —
// controller içinde tip kontrolü güvenli üst sınırı zaten korur.
const STK_MOVEMENT_CREATE = ['module.stock', 'stock.in.create', 'stock.out.create'];

router.use(requireAuth);

router.get('/brands', requireAnyPermission(STK_BRANDS_VIEW), getBrands);
router.post('/brands', requireAnyPermission(STK_BRANDS_EDIT), postBrand);
router.patch('/brands/:id', requireAnyPermission(STK_BRANDS_EDIT), patchBrand);
router.delete('/brands/:id', requireAnyPermission(STK_BRANDS_EDIT), removeBrand);
router.get('/units', requireAnyPermission(STK_PRODUCTS_VIEW), getUnits);
router.post('/units', requireAnyPermission(STK_PRODUCTS_EDIT), postUnit);
router.get('/products/import-template', requireAnyPermission(STK_PRODUCTS_VIEW), getProductImportTemplate);
router.post('/products/import', requireAnyPermission(STK_PRODUCTS_EDIT), productImportUpload.single('file'), postProductImport);
router.get('/products', requireAnyPermission(STK_PRODUCTS_VIEW), getProducts);
router.post('/products', requireAnyPermission(STK_PRODUCTS_EDIT), postProduct);
router.patch('/products/:id', requireAnyPermission(STK_PRODUCTS_EDIT), patchProduct);
router.delete('/products/:id', requireAnyPermission(STK_PRODUCTS_EDIT), removeProduct);
router.get('/movements', requireAnyPermission(STK_MOV_VIEW), getMovements);
router.get('/active-projects', requireAnyPermission(STK_MOV_VIEW), getActiveProjectsForStock);
router.post('/movements', requireAnyPermission(STK_MOVEMENT_CREATE), postMovement);
router.post('/movements/:id/void', requireAnyPermission(STK_MOVEMENT_CREATE), postVoidMovement);
router.post('/movements/:id/replace', requireAnyPermission(STK_IN_CREATE), postReplaceStockIn);
router.post('/movements/:id/replace-out', requireAnyPermission(STK_OUT_CREATE), postReplaceStockOut);
router.get('/warehouses', requireAnyPermission(STK_WHS_VIEW), getWarehouses);
router.post('/warehouses', requireAnyPermission(STK_WHS_EDIT), postWarehouse);
router.patch('/warehouses/:id', requireAnyPermission(STK_WHS_EDIT), patchWarehouse);
router.post('/warehouses/:id/subcategories', requireAnyPermission(STK_WHS_EDIT), postWarehouseSub);
router.patch('/warehouses/:id/subcategories/:subId', requireAnyPermission(STK_WHS_EDIT), patchWarehouseSub);
router.delete('/warehouses/:id/subcategories/:subId', requireAnyPermission(STK_WHS_EDIT), removeWarehouseSub);

module.exports = router;
