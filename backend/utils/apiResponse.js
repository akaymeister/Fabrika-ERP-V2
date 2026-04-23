function jsonOk(data = {}) {
  return { ok: true, ...data };
}

function jsonError(code, message, details, messageKey) {
  const o = { ok: false, error: code, message };
  if (details != null) o.details = details;
  if (messageKey) o.messageKey = messageKey;
  return o;
}

module.exports = { jsonOk, jsonError };
