/**
 * Merkezi activity / audit log. Ana işlemi bozmayacak şekilde hata yutar.
 */
const { pool } = require('../config/database');

/**
 * @param {import('express').Request} req
 * @param {object} p
 * @param {string} p.action_type
 * @param {string} p.module_name
 * @param {string} [p.table_name]
 * @param {string|number|null} [p.record_id]
 * @param {object|string|null|undefined} [p.old_data]
 * @param {object|string|null|undefined} [p.new_data]
 * @param {string|null} [p.description]
 * @param {{ userId?: number|null, username?: string|null, fullName?: string|null }} [p.actor]
 * @param {string|null|undefined} [p.clientIp] – req yok veya servis çağrısı (ör. ip izin verilir)
 * @param {string|null|undefined} [p.userAgent]
 */
async function logActivity(req, p) {
  if (!p || !p.action_type || !p.module_name) {
    return;
  }
  try {
    const actor = p.actor && (p.actor.userId != null || p.actor.username)
      ? p.actor
      : req && req.session && req.session.user
        ? { userId: req.session.user.id, username: req.session.user.username, fullName: req.session.user.fullName }
        : { userId: null, username: null, fullName: null };
    const userId = actor.userId != null ? parseInt(String(actor.userId), 10) : null;
    const uid = Number.isFinite(userId) && userId > 0 ? userId : null;
    const rid = p.record_id != null && p.record_id !== '' ? String(p.record_id).slice(0, 64) : null;
    const ip =
      p.clientIp != null && String(p.clientIp).trim() !== ''
        ? String(p.clientIp).slice(0, 64)
        : getClientIp(req);
    const ua = truncate(p.userAgent != null && p.userAgent !== '' ? p.userAgent : req && req.get && req.get('user-agent'), 512);
    const jOld = toJsonString(p.old_data);
    const jNew = toJsonString(p.new_data);

    await pool.query(
      `INSERT INTO activity_logs (
        user_id, username, full_name, action_type, module_name, table_name, record_id,
        old_data, new_data, description, ip_address, user_agent
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uid,
        actor.username != null ? String(actor.username).slice(0, 191) : null,
        actor.fullName != null ? String(actor.fullName).slice(0, 255) : null,
        String(p.action_type).slice(0, 32),
        String(p.module_name).slice(0, 32),
        p.table_name != null ? String(p.table_name).slice(0, 128) : null,
        rid,
        jOld,
        jNew,
        p.description != null ? String(p.description).slice(0, 2000) : null,
        ip != null ? String(ip).slice(0, 64) : null,
        ua,
      ]
    );
  } catch (e) {
    if (e && e.code === 'ER_NO_SUCH_TABLE') {
      // eslint-disable-next-line no-console
      console.warn('[activity_logs] tablo yok: npm run db:migrate (007_activity_logs.sql)');
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[logActivity]', e.message);
  }
}

function getClientIp(req) {
  if (!req) {
    return null;
  }
  const x = req.headers && req.headers['x-forwarded-for'];
  if (x) {
    const f = String(x).split(',')[0].trim();
    if (f) {
      return f;
    }
  }
  if (req.ip) {
    return String(req.ip);
  }
  if (req.connection && req.connection.remoteAddress) {
    return String(req.connection.remoteAddress);
  }
  return null;
}

function truncate(s, n) {
  if (s == null) {
    return null;
  }
  const t = String(s);
  return t.length <= n ? t : t.slice(0, n);
}

function toJsonString(v) {
  if (v == null) {
    return null;
  }
  if (typeof v === 'string') {
    const trimmed = v.length > 50000 ? `${v.slice(0, 50000)}…` : v;
    return JSON.stringify({ text: trimmed });
  }
  try {
    const s = JSON.stringify(v);
    if (s == null) {
      return null;
    }
    if (s.length > 60000) {
      return JSON.stringify({ truncated: true, preview: s.slice(0, 2000) });
    }
    return s;
  } catch {
    return JSON.stringify({ text: String(v).slice(0, 50000) });
  }
}

/**
 * Aynı istekte await etmeden log (dönüş cevabını geciktirmez; hata yine yutulur)
 */
function logActivityFireAndForget(req, p) {
  setImmediate(() => {
    logActivity(req, p).catch(() => {});
  });
}

module.exports = { logActivity, logActivityFireAndForget };
