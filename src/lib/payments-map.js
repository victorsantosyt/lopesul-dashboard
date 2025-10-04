// src/lib/payments-map.js
export function mapChargeStatusToEnum(pagarmeStatus) {
  switch ((pagarmeStatus || '').toLowerCase()) {
    case 'paid':       return 'PAID';
    case 'authorized': return 'AUTHORIZED';
    case 'refunded':   return 'REFUNDED';
    case 'canceled':   return 'CANCELED';
    case 'failed':     return 'FAILED';
    case 'processing':
    case 'pending':    return 'CREATED';
    default:           return 'CREATED';
  }
}

export function mapOrderStatusToPaymentEnum(pagarmeStatus) {
  switch ((pagarmeStatus || '').toLowerCase()) {
    case 'paid':     return 'PAID';
    case 'canceled': return 'CANCELED';
    case 'failed':   return 'FAILED';
    case 'expired':  return 'EXPIRED';
    default:         return 'PENDING';
  }
}
