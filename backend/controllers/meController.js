const { jsonOk, jsonError } = require('../utils/apiResponse');
const { getMyProfile, changeMyPassword } = require('../services/meService');

async function getProfile(req, res) {
  const userId = req.session?.user?.id;
  const profile = await getMyProfile(userId);
  if (!profile) {
    return res.status(404).json(jsonError('NOT_FOUND', 'Kullanici bulunamadi', null, 'api.auth.failed'));
  }
  return res.json(jsonOk({ profile }));
}

async function postChangePassword(req, res) {
  const userId = req.session?.user?.id;
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res
      .status(400)
      .json(jsonError('VALIDATION', 'Tum sifre alanlari zorunlu', null, 'api.me.password_fields_required'));
  }
  if (newPassword.length < 6) {
    return res.status(400).json(jsonError('VALIDATION', 'Yeni sifre en az 6 karakter olmali', null, 'api.me.password_too_short'));
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json(jsonError('VALIDATION', 'Yeni sifreler uyusmuyor', null, 'api.me.password_confirm_mismatch'));
  }

  const out = await changeMyPassword(userId, currentPassword, newPassword);
  if (out?.error) {
    return res.status(400).json(jsonError('VALIDATION', 'Mevcut sifre hatali', null, out.error));
  }
  if (req.session?.user) {
    req.session.user.mustChangePassword = false;
  }
  return res.json(jsonOk({ ok: true }));
}

module.exports = {
  getProfile,
  postChangePassword,
};
