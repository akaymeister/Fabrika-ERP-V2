const { sendTelegramMessage, isTelegramSendEnabled } = require('./telegramService');
const { logActivityFireAndForget } = require('./activityLogService');
const { pool } = require('../config/database');

const AUDIT_SENT = 'telegram_employee_created_message_sent';
const AUDIT_FAIL = 'telegram_employee_created_message_failed';
const AUDIT_MISSING = 'telegram_chat_id_missing';

function buildPersonnelMessage({ employeeNo, fullName, hireDate }) {
  return (
    `AHK Factory giriş kaydınız yapılmıştır.\n\n` +
    `Personel numaranız: ${employeeNo}\n` +
    `Ad soyad: ${fullName}\n` +
    `Giriş tarihi: ${hireDate}\n\n` +
    `İyi çalışmalar.`
  );
}

function buildErpMessage({ employeeNo, fullName, hireDate, username, plainPassword }) {
  return (
    `AHK Factory ERP kullanıcı kaydınız oluşturulmuştur.\n\n` +
    `Personel numaranız: ${employeeNo}\n` +
    `Ad soyad: ${fullName}\n` +
    `Giriş tarihi: ${hireDate}\n\n` +
    `Kullanıcı adınız: ${username}\n` +
    `Geçici parolanız: ${plainPassword}\n\n` +
    `Güvenliğiniz için ilk girişten sonra parolanızı değiştiriniz.\n\n` +
    `İyi çalışmalar.`
  );
}

function formatHireDate(d) {
  if (d == null || d === '') return '-';
  return String(d).slice(0, 10);
}

async function loadEmployeeRow(employeeId) {
  const id = parseInt(String(employeeId), 10);
  if (!Number.isFinite(id) || id < 1) return null;
  const [rows] = await pool.query(
    `SELECT id, employee_no, full_name, hire_date, telegram_chat_id, telegram_notify_enabled
     FROM employees WHERE id = :id LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}

/**
 * Personel oluşturma veya personele ERP kullanıcısı bağlama sonrası hoş geldin Telegram'ı.
 * Personel kaydı başarılı olduktan sonra çağrılmalı; hata personeli geri almaz.
 *
 * @param {import('express').Request|null} req
 * @param {number} employeeId
 * @param {{ erpUserCreated?: boolean, newUsername?: string|null, plainPassword?: string|null }} [options]
 */
async function notifyEmployeeCreatedTelegram(req, employeeId, options = {}) {
  const { erpUserCreated = false, newUsername = null, plainPassword = null } = options;
  try {
    const emp = await loadEmployeeRow(employeeId);
    if (!emp) return;

    const notifyOn = Number(emp.telegram_notify_enabled) !== 0;
    if (!notifyOn) return;

    const chatId = emp.telegram_chat_id != null ? String(emp.telegram_chat_id).trim() : '';
    if (!chatId) {
      // eslint-disable-next-line no-console
      console.warn('[telegram] telegram chat id eksik', { employeeId });
      logActivityFireAndForget(req, {
        action_type: 'NOTIFY',
        module_name: 'telegram',
        table_name: 'employees',
        record_id: String(employeeId),
        new_data: { event: AUDIT_MISSING, employee_id: employeeId },
        description: AUDIT_MISSING,
      });
      return;
    }

    const base = {
      employeeNo: emp.employee_no != null && String(emp.employee_no).trim() !== '' ? String(emp.employee_no) : '-',
      fullName: emp.full_name != null && String(emp.full_name).trim() !== '' ? String(emp.full_name) : '-',
      hireDate: formatHireDate(emp.hire_date),
    };

    const useErp =
      erpUserCreated &&
      newUsername != null &&
      String(newUsername).trim() !== '' &&
      plainPassword != null &&
      String(plainPassword) !== '';

    const text = useErp
      ? buildErpMessage({
          ...base,
          username: String(newUsername).trim(),
          plainPassword: String(plainPassword),
        })
      : buildPersonnelMessage(base);

    if (!isTelegramSendEnabled()) {
      // eslint-disable-next-line no-console
      console.info('[telegram] TELEGRAM_ENABLED kapali; mesaj gonderilmedi', { employeeId });
      return;
    }

    const sendResult = await sendTelegramMessage(chatId, text);
    if (sendResult.ok) {
      logActivityFireAndForget(req, {
        action_type: 'NOTIFY',
        module_name: 'telegram',
        table_name: 'employees',
        record_id: String(employeeId),
        new_data: { event: AUDIT_SENT, employee_id: employeeId },
        description: AUDIT_SENT,
      });
    } else {
      logActivityFireAndForget(req, {
        action_type: 'NOTIFY',
        module_name: 'telegram',
        table_name: 'employees',
        record_id: String(employeeId),
        new_data: { event: AUDIT_FAIL, employee_id: employeeId, error: sendResult.error || null },
        description: AUDIT_FAIL,
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[telegram] notifyEmployeeCreatedTelegram:', e && e.message ? e.message : e);
  }
}

function scheduleNotifyEmployeeCreatedTelegram(req, employeeId, options) {
  setImmediate(() => {
    notifyEmployeeCreatedTelegram(req, employeeId, options).catch(() => {});
  });
}

module.exports = {
  notifyEmployeeCreatedTelegram,
  scheduleNotifyEmployeeCreatedTelegram,
  buildPersonnelMessage,
  buildErpMessage,
};
