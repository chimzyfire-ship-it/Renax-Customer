export function buildShipmentQrPayload(params: {
  type: 'pickup' | 'delivery';
  otp: string;
  trackingId?: string | null;
}) {
  const query = new URLSearchParams({
    flow: params.type,
    otp: String(params.otp || '').trim(),
  });

  if (params.trackingId) {
    query.set('tracking', String(params.trackingId).trim());
  }

  return `renaxrider://verify?${query.toString()}`;
}
