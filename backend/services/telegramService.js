/**
 * Telegram Bot API — gönderim hataları uygulamayı düşürmez.
 */

function isTelegramSendEnabled() {
  const v = String(process.env.TELEGRAM_ENABLED ?? 'true').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function getBotToken() {
  const t = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  return t || null;
}

/**
 * @param {string} chatId
 * @param {string} text
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function sendTelegramMessage(chatId, text) {
  if (!isTelegramSendEnabled()) {
    return { ok: false, error: 'telegram_disabled' };
  }
  const token = getBotToken();
  if (!token) {
    // eslint-disable-next-line no-console
    console.warn('[telegram] TELEGRAM_BOT_TOKEN tanimli degil');
    return { ok: false, error: 'missing_token' };
  }
  const id = chatId != null ? String(chatId).trim() : '';
  if (!id) {
    return { ok: false, error: 'missing_chat_id' };
  }
  const body = String(text ?? '');
  if (!body) {
    return { ok: false, error: 'empty_text' };
  }
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: id, text: body }),
    });
    const data = await res.json().catch(() => ({}));
    if (data && data.ok === true) {
      return { ok: true };
    }
    const desc = data && data.description ? String(data.description) : `http_${res.status}`;
    // eslint-disable-next-line no-console
    console.warn('[telegram] sendMessage basarisiz:', desc);
    return { ok: false, error: desc };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[telegram] sendMessage exception:', e && e.message ? e.message : e);
    return { ok: false, error: e && e.message ? e.message : 'fetch_error' };
  }
}

module.exports = {
  isTelegramSendEnabled,
  getBotToken,
  sendTelegramMessage,
};
