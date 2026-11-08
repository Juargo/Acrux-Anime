import { createHmac, timingSafeEqual } from 'node:crypto';

// Lemon Squeezy signs the raw body with HMAC-SHA256 and sends the hex digest in X-Signature
// (https://docs.lemonsqueezy.com/help/webhooks/signing-requests). Constant-time compare.
export function hasValidSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
