import { BUTTONDOWN_API_KEY } from 'astro:env/server';
import type { APIRoute } from 'astro';
import { handleWaitlistRequest } from '../../lib/waitlist';

// Runs on demand as a Vercel function so the Buttondown key never reaches the browser.
export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  handleWaitlistRequest(request, { apiKey: BUTTONDOWN_API_KEY, fetch });
