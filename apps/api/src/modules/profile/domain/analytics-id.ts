import { createHmac } from 'node:crypto';

// The id PostHog knows a person by (#46, L2 of odd/tasks/posthog.md): an HMAC of the user id
// with a server secret, so analytics never sees the id the database and the logs use, and
// the same person is recognized across devices.
export function analyticsId(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(userId).digest('hex').slice(0, 32);
}
