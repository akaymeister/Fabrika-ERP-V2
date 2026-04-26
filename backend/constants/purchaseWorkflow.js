/**
 * Satınalma talebi: pr_status (iş akışı) ile purchase_requests.status (legacy / liste kolonu).
 * purchase_requests.status patch-006c sonrası VARCHAR(32); öncesi ENUM ise partial|ordered|cancelled yazılamaz.
 */

/** Talep satırı siparişe bağlandıkça kullanılan ara durumlar */
const PR_STATUS_AFTER_PO = Object.freeze({
  PARTIAL: 'partial',
  ORDERED: 'ordered',
});

/**
 * purchase_requests.status kolonuna yazılacak değer.
 * pending / revision_requested → submitted (eski "onay bekliyor" listesi)
 * diğer pr_status değerleri aynen (draft, approved, rejected, cancelled, partial, ordered, …)
 */
function legacyPurchaseRequestStatusFromPrStatus(prStatus) {
  const s = String(prStatus);
  if (s === 'pending') return 'submitted';
  if (s === 'revision_requested') return 'submitted';
  return s;
}

module.exports = {
  PR_STATUS_AFTER_PO,
  legacyPurchaseRequestStatusFromPrStatus,
};
