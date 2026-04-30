/**
 * Express uygulama omurgası: middleware + statik + API.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { createSessionMiddleware } = require('./config/session');
const { requirePageAuth, serveLoginOrRedirectToDashboard } = require('./middlewares/requirePageAuth');
const { FRONTEND_PUBLIC, UPLOADS_ROOT } = require('./utils/paths');

if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const stockRoutes = require('./routes/stockRoutes');
const projectRoutes = require('./routes/projectRoutes');
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
app.get('/project-list', (req, res) => res.redirect(302, '/project-list.html'));
app.get('/project-new', (req, res) => res.redirect(302, '/project-list.html'));
app.get('/projects.html', requirePageAuth, requirePagePermission('module.projects'), sendPage('projects.html'));
app.get('/project-list.html', requirePageAuth, requirePagePermission('module.projects'), sendPage('project-list.html'));
app.get('/project-code.html', requirePageAuth, requirePagePermission('module.projects'), (req, res) =>
  res.redirect(302, '/project-list.html')
);
app.get('/project-costs.html', requirePageAuth, requirePagePermission('module.projects'), sendPage('project-costs.html'));
app.get('/project-quotes.html', requirePageAuth, requirePagePermission('module.projects'), sendPage('project-quotes.html'));
app.get('/project-new.html', requirePageAuth, requirePagePermission('module.projects'), (req, res) =>
  res.redirect(302, '/project-list.html')
);
app.get('/purchasing', (req, res) => res.redirect(302, '/purchasing.html'));
app.get('/purchase-orders.html', requirePageAuth, (req, res) => res.redirect(302, '/purchasing.html'));
app.get(
  '/purchasing.html',
  requirePageAuth,
  requirePageAnyPermission([
    'module.purchasing',
    'module.purchasing.request',
    'module.purchasing.approve',
    'module.purchasing.receipt',
  ]),
  sendPage('purchasing.html')
);
app.get(
  '/goods-receipt.html',
  requirePageAuth,
  requirePageAnyPermission(['module.stock', 'module.purchasing.receipt']),
  sendPage('goods-receipt.html')
);
app.get(
  '/purchase-requisition-open.html',
  requirePageAuth,
  requirePageAnyPermission(['module.purchasing.request', 'module.purchasing']),
  sendPage('purchase-requisition-open.html')
);
app.get(
  '/purchase-requests.html',
  requirePageAuth,
  requirePageAnyPermission(['module.purchasing.request', 'module.purchasing.approve', 'module.purchasing']),
  sendPage('purchase-requests.html')
);
/** Eski URL: onay UX tek ekranda — talep listesi + satır seçince altta detay / onay-red */
app.get(
  '/purchase-approvals.html',
  requirePageAuth,
  requirePageAnyPermission(['module.purchasing.request', 'module.purchasing.approve', 'module.purchasing']),
  (req, res) => res.redirect(302, '/purchase-requests.html?pending')
);
app.get(
  '/purchase-processing.html',
  requirePageAuth,
  requirePagePermission('module.purchasing'),
  sendPage('purchase-processing.html')
);
app.get(
  '/purchase-order-print.html',
  requirePageAuth,
  requirePagePermission('module.purchasing'),
  sendPage('purchase-order-print.html')
);
app.get('/stock.html', requirePageAuth, requirePagePermission('module.stock'), sendPage('stock.html'));
app.get('/stock-brands.html', requirePageAuth, requirePagePermission('module.stock'), sendPage('stock-brands.html'));
app.get('/stock-products.html', requirePageAuth, requirePagePermission('module.stock'), sendPage('stock-products.html'));
app.get(
  '/stock-in.html',
  requirePageAuth,
  requirePageSuperAdmin,
  sendPage('stock-in.html')
);
app.get('/stock-out.html', requirePageAuth, requirePagePermission('module.stock'), sendPage('stock-out.html'));
app.get('/stock-movements.html', requirePageAuth, requirePagePermission('module.stock'), sendPage('stock-movements.html'));
app.get('/hr.html', requirePageAuth, requirePagePermission('module.hr'), sendPage('hr.html'));
app.get('/hr-employees.html', requirePageAuth, requirePagePermission('module.hr'), sendPage('hr-employees.html'));
app.get('/hr-employee-form.html', requirePageAuth, requirePagePermission('module.hr'), sendPage('hr-employee-form.html'));
app.get('/hr-employee-detail.html', requirePageAuth, requirePagePermission('module.hr'), sendPage('hr-employee-detail.html'));
app.get('/hr-structure.html', requirePageAuth, requirePagePermission('module.hr'), sendPage('hr-structure.html'));
app.get('/hr-attendance.html', requirePageAuth, requirePagePermission('module.hr'), sendPage('hr-attendance.html'));
app.get('/hr-settings.html', requirePageAuth, requirePagePermission('module.hr'), sendPage('hr-settings.html'));
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
