import {
  BUTTONDOWN_API_KEY,
  UPSTASH_REDIS_REST_TOKEN,
  UPSTASH_REDIS_REST_URL,
} from 'astro:env/server';
import type { APIRoute } from 'astro';
import { createUpstashFixedWindow } from '../../lib/rate-limit';
import { handleWaitlistRequest } from '../../lib/waitlist';

// Five attempts per IP every ten minutes, as the firewall rule it replaces.
const limit =
  UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
    ? createUpstashFixedWindow({
        url: UPSTASH_REDIS_REST_URL,
        token: UPSTASH_REDIS_REST_TOKEN,
        requests: 5,
        windowSeconds: 600,
      })
    : undefined;

// Runs on demand as a Vercel function so the Buttondown key never reaches the browser.
export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  handleWaitlistRequest(request, {
    apiKey: BUTTONDOWN_API_KEY,
    fetch,
    ...(limit ? { limit } : {}),
  });
