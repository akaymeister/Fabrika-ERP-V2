/**
 * Express uygulama omurgası: middleware + statik + API.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { createSessionMiddleware } = require('./config/session');
const { requirePageAuth, serveLoginOrRedirectToDashboard } = require('./middlewares/requirePageAuth');
const { FRONTEND_PUBLIC, UPLOADS_ROOT, BACKUP_ROOT } = require('./utils/paths');

if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}
if (!fs.existsSync(BACKUP_ROOT)) {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });
}

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const stockRoutes = require('./routes/stockRoutes');
const projectRoutes = require('./routes/projectRoutes');
const projectControlRoutes = require('./routes/projectControlRoutes');
const purchasingRoutes = require('./routes/purchasingRoutes');
const hrRoutes = require('./routes/hrRoutes');
const meRoutes = require('./routes/meRoutes');
const { getPublicConfig } = require('./controllers/publicConfigController');
const { jsonError } = require('./utils/apiResponse');
const { requirePageSuperAdmin, sendAdminPage } = require('./middlewares/requirePageSuperAdmin');
const { requirePagePermission, requirePageAnyPermission, sendPage } = require('./middlewares/requirePagePermission');

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(createSessionMiddleware());

/** İlk girişte zorunlu şifre değişimi: /api/me ve çıkış dışındaki API'ler kilitli */
app.use((req, res, next) => {
  const raw = req.originalUrl ? String(req.originalUrl).split('?')[0] : '';
  const p = raw || req.path || '';
  if (!p.startsWith('/api/')) return next();
  if (p.startsWith('/api/auth/login') || p.startsWith('/api/public/')) return next();
  if (!req.session?.user?.mustChangePassword) return next();
  if (p.startsWith('/api/me') || p.startsWith('/api/auth/logout')) return next();
  return res
    .status(403)
    .json(jsonError('FORBIDDEN', 'Parola degisikligi gerekli', null, 'api.auth.password_change_required'));
});

// --- API (açık: login) ---
app.get('/api/public/config', getPublicConfig);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/project-control', projectControlRoutes);
app.use('/api/purchasing', purchasingRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/me', meRoutes);

app.use(
  '/uploads',
  express.static(UPLOADS_ROOT, {
    index: false,
    dotfiles: 'ignore',
  })
);

// --- HTML: login / önce; statikten önce (oturum yönlendirmesi) ---
// Kısayol URL'ler (.html olmadan)
app.get('/login', (req, res) => res.redirect(302, '/login.html'));
app.get('/admin', (req, res) => res.redirect(302, '/admin.html'));
app.get('/dashboard', requirePageAuth, (req, res) => res.redirect(302, '/'));

app.get('/login.html', serveLoginOrRedirectToDashboard);
app.get(['/', '/index.html'], requirePageAuth, (req, res) => {
  res.sendFile(path.join(FRONTEND_PUBLIC, 'index.html'));
});

// Süper yönetici arayüzü (statikten önce; dosya sadece yetkiliye)
app.get('/admin.html', requirePageSuperAdmin, sendAdminPage);

// Stok modülü (giriş + module.stock)
app.get('/stock', (req, res) => res.redirect(302, '/stock.html'));
app.get('/hr', (req, res) => res.redirect(302, '/hr.html'));
app.get('/projects', (req, res) => res.redirect(302, '/projects.html'));
app.get('/project-code', (req, res) => res.redirect(302, '/project-list.html'));
app.get('/project-costs', (req, res) => res.redirect(302, '/project-costs.html'));
app.get('/project-quotes', (req, res) => res.redirect(302, '/project-quotes.html'));
app.get('/project-control', (req, res) => res.redirect(302, '/project-control.html'));
app.get('/project-list', (req, res) => res.redirect(302, '/project-list.html'));
app.get('/project-new', (req, res) => res.redirect(302, '/project-list.html'));
// Faz 3 granular: her route'da [eski_kaba_izin, yeni_granular_izin] OR pattern;
// eski module.X kullanıcıları kırılmaz, yeni granular kullanıcılar açabilir.
const PROJECTS_VIEW = ['module.projects', 'projects.hub.view'];
const PROJECTS_CONTROL = ['module.projects', 'projects.control.view'];
app.get('/projects.html', requirePageAuth, requirePageAnyPermission(PROJECTS_VIEW), sendPage('projects.html'));
app.get('/project-list.html', requirePageAuth, requirePageAnyPermission(PROJECTS_VIEW), sendPage('project-list.html'));
app.get('/project-code.html', requirePageAuth, requirePageAnyPermission(PROJECTS_VIEW), (req, res) =>
  res.redirect(302, '/project-list.html')
);
app.get('/project-costs.html', requirePageAuth, requirePageAnyPermission(PROJECTS_VIEW), sendPage('project-costs.html'));
app.get('/project-quotes.html', requirePageAuth, requirePageAnyPermission(PROJECTS_VIEW), sendPage('project-quotes.html'));
app.get('/project-control.html', requirePageAuth, requirePageAnyPermission(PROJECTS_CONTROL), sendPage('project-control.html'));
app.get('/project-new.html', requirePageAuth, requirePageAnyPermission(PROJECTS_VIEW), (req, res) =>
  res.redirect(302, '/project-list.html')
);
app.get('/purchasing', (req, res) => res.redirect(302, '/purchasing.html'));
app.get('/purchase-orders.html', requirePageAuth, (req, res) => res.redirect(302, '/purchasing.html'));
// Purchasing — granular + eski izinler OR
const PUR_HUB = [
  'module.purchasing',
  'module.purchasing.request',
  'module.purchasing.approve',
  'module.purchasing.receipt',
  'purchasing.hub.view',
  'purchasing.request.view',
  'purchasing.request.create',
  'purchasing.processing.view',
  'purchasing.order.view',
  'purchasing.receipt.view',
  'purchasing.suppliers.view',
];
const PUR_RECEIPT = [
  // Geriye uyumluluk: eski module.stock + module.purchasing.* olan kullanıcılar erişir.
  'module.stock',
  'module.purchasing.receipt',
  'module.purchasing',
  // Faz 3: mal kabulü açık tutmak için açık granular gerekli — Depocu'ya
  // otomatik açılmaz (kullanıcı planı: "Mal Kabul: purchasing.receipt.view").
  'purchasing.receipt.view',
  'purchasing.receipt.create',
];
const PUR_REQ_OPEN = [
  'module.purchasing.request',
  'module.purchasing',
  'purchasing.request.view',
  'purchasing.request.create',
];
// Talep listesi: view veya approve gerekir. SADECE create yetkili kullanıcı
// listeyi göremez; ama 'talep aç' sayfasını açabilir (PUR_REQ_OPEN).
const PUR_REQ_LIST = [
  'module.purchasing.request',
  'module.purchasing.approve',
  'module.purchasing',
  'purchasing.request.view',
  'purchasing.request.approve',
];
const PUR_PROCESSING = [
  'module.purchasing',
  'purchasing.processing.view',
  'purchasing.order.view',
  'purchasing.order.price_edit',
];
const PUR_PRINT = ['module.purchasing', 'purchasing.order.view'];
const PUR_SUPPLIERS = ['module.purchasing', 'purchasing.suppliers.view'];
app.get('/purchasing.html', requirePageAuth, requirePageAnyPermission(PUR_HUB), sendPage('purchasing.html'));
app.get('/goods-receipt.html', requirePageAuth, requirePageAnyPermission(PUR_RECEIPT), sendPage('goods-receipt.html'));
app.get('/purchase-requisition-open.html', requirePageAuth, requirePageAnyPermission(PUR_REQ_OPEN), sendPage('purchase-requisition-open.html'));
app.get('/purchase-requests.html', requirePageAuth, requirePageAnyPermission(PUR_REQ_LIST), sendPage('purchase-requests.html'));
/** Eski URL: onay UX tek ekranda — talep listesi + satır seçince altta detay / onay-red */
app.get('/purchase-approvals.html', requirePageAuth, requirePageAnyPermission(PUR_REQ_LIST), (req, res) =>
  res.redirect(302, '/purchase-requests.html?pending')
);
app.get('/purchase-processing.html', requirePageAuth, requirePageAnyPermission(PUR_PROCESSING), sendPage('purchase-processing.html'));
app.get('/purchase-order-print.html', requirePageAuth, requirePageAnyPermission(PUR_PRINT), sendPage('purchase-order-print.html'));
// Stok — kaba module.stock kabul edilir + granular alt sayfa izinleri.
const STK_HUB_ANY = [
  'module.stock',
  'stock.hub.view',
  'stock.products.view',
  'stock.brands.view',
  'stock.warehouses.view',
  'stock.in.view',
  'stock.out.view',
  'stock.movements.view',
  'stock.reports.view',
];
const STK_BRANDS = ['module.stock', 'stock.brands.view'];
const STK_PRODUCTS = ['module.stock', 'stock.products.view'];
const STK_IN = ['module.stock', 'stock.in.view'];
const STK_OUT = ['module.stock', 'stock.out.view'];
const STK_MOV = ['module.stock', 'stock.movements.view'];
const STK_WHS = ['module.stock', 'stock.warehouses.view'];
app.get('/stock.html', requirePageAuth, requirePageAnyPermission(STK_HUB_ANY), sendPage('stock.html'));
app.get('/stock-brands.html', requirePageAuth, requirePageAnyPermission(STK_BRANDS), sendPage('stock-brands.html'));
app.get('/stock-products.html', requirePageAuth, requirePageAnyPermission(STK_PRODUCTS), sendPage('stock-products.html'));
app.get('/stock-in.html', requirePageAuth, requirePageAnyPermission(STK_IN), sendPage('stock-in.html'));
app.get('/stock-out.html', requirePageAuth, requirePageAnyPermission(STK_OUT), sendPage('stock-out.html'));
app.get('/stock-movements.html', requirePageAuth, requirePageAnyPermission(STK_MOV), sendPage('stock-movements.html'));
app.get('/stock-warehouses.html', requirePageAuth, requirePageAnyPermission(STK_WHS), sendPage('stock-warehouses.html'));

// İK — kaba module.hr kabul edilir + granular alt sayfa izinleri.
const HR_HUB_ANY = [
  'module.hr',
  'hr.hub.view',
  'hr.employees.view',
  'hr.attendance.view',
  'hr.payroll.view',
  'hr.compensation.view',
];
const HR_EMP = ['module.hr', 'hr.employees.view'];
const HR_EMP_EDIT = ['module.hr', 'hr.employees.edit'];
const HR_STRUCT = ['module.hr', 'hr.employees.view', 'hr.hub.view'];
const HR_ATT = ['module.hr', 'hr.attendance.view'];
const HR_ATT_LOCK = ['module.hr', 'hr.attendance.view', 'hr.attendance.unlock'];
const HR_SETT = ['module.hr', 'hr.hub.view'];
// Ücret değerlendirme — module.hr KABUL EDİLMEZ; yalnız hr.compensation.view veya
// admin.full ile açılır. super_admin shortcut accessService içinde otomatik geçerli.
const HR_COMP = ['hr.compensation.view', 'admin.full'];
const HR_PAY = ['module.hr', 'hr.payroll.view'];
app.get('/hr.html', requirePageAuth, requirePageAnyPermission(HR_HUB_ANY), sendPage('hr.html'));
app.get('/hr-employees.html', requirePageAuth, requirePageAnyPermission(HR_EMP), sendPage('hr-employees.html'));
app.get('/hr-employee-form.html', requirePageAuth, requirePageAnyPermission(HR_EMP_EDIT), sendPage('hr-employee-form.html'));
app.get('/hr-employee-detail.html', requirePageAuth, requirePageAnyPermission(HR_EMP), sendPage('hr-employee-detail.html'));
app.get('/hr-structure.html', requirePageAuth, requirePageAnyPermission(HR_STRUCT), sendPage('hr-structure.html'));
app.get('/hr-attendance.html', requirePageAuth, requirePageAnyPermission(HR_ATT), sendPage('hr-attendance.html'));
app.get('/hr-settings.html', requirePageAuth, requirePageAnyPermission(HR_SETT), sendPage('hr-settings.html'));
app.get('/hr-attendance-monthly.html', requirePageAuth, requirePageAnyPermission(HR_ATT), sendPage('hr-attendance-monthly.html'));
app.get('/hr-attendance-locks.html', requirePageAuth, requirePageAnyPermission(HR_ATT_LOCK), sendPage('hr-attendance-locks.html'));
app.get('/hr-compensation.html', requirePageAuth, requirePageAnyPermission(HR_COMP), sendPage('hr-compensation.html'));
app.get('/hr-payroll.html', requirePageAuth, requirePageAnyPermission(HR_PAY), sendPage('hr-payroll.html'));

app.get('/suppliers.html', requirePageAuth, requirePageAnyPermission(PUR_SUPPLIERS), sendPage('suppliers.html'));
app.get('/admin-users.html', requirePageSuperAdmin, sendPage('admin-users.html'));
app.get('/admin-settings.html', requirePageSuperAdmin, sendPage('admin-settings.html'));
app.get('/admin-permissions.html', requirePageSuperAdmin, sendPage('admin-permissions.html'));
app.get('/admin-user-new.html', requirePageSuperAdmin, sendPage('admin-user-new.html'));
app.get('/admin-logs.html', requirePageSuperAdmin, sendPage('admin-logs.html'));
app.get('/admin-backup.html', requirePageSuperAdmin, sendPage('admin-backup.html'));
app.get('/my-profile.html', requirePageAuth, sendPage('my-profile.html'));

// --- Statik: index otomatik kapalı ---
app.use(
  express.static(FRONTEND_PUBLIC, {
    index: false,
    dotfiles: 'ignore',
  })
);

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  }
  const safePath = String(req.path || '/')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return res
    .status(404)
    .type('html')
    .send(
      `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>404</title></head><body style="font-family:system-ui;padding:2rem">` +
        `<h1>Sayfa bulunamadı</h1><p>İstek: <code>${safePath}</code></p>` +
        `<p><a href="/">Ana sayfa (dashboard)</a> · <a href="/login.html">Giriş</a> · <a href="/admin.html">Süper yönetim</a></p>` +
        `</body></html>`
    );
});

module.exports = { app, FRONTEND_PUBLIC };
