import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// apps/web/vercel.json sends only link-preview crawlers of /@handle to the API page with the
// Open Graph tags (#37); people, in-app browsers included, must get the SPA.
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  rewrites: { source: string; has?: { key: string; value: string }[] }[];
};
const rule = config.rewrites.find((rewrite) => rewrite.source === '/@:handle');
const crawler = new RegExp(`^${rule?.has?.[0]?.value ?? ''}$`);

describe('the crawler rewrite of /@handle', () => {
  it.each([
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
    'WhatsApp/2.23.20.0',
    'Twitterbot/1.0',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'TelegramBot (like TwitterBot)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Pinterestbot/1.0 (+http://www.pinterest.com/bot.html)',
    'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)',
    'Iframely/1.3.1 (+https://iframely.com/docs/about)',
    'Mozilla/5.0 (compatible; redditbot/1.0; +http://www.reddit.com/feedback)',
  ])('matches the crawler %s', (agent) => {
    expect(crawler.test(agent)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; CUBOT KINGKONG 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 trill_360205 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 Telegram-Android/11.2.3 (Google Pixel 8; Android 14; SDK 34; HIGH)',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [Pinterest/iOS]',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 TwitterAndroid',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 Discord/250.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0.22.109',
  ])('lets a person through: %s', (agent) => {
    expect(crawler.test(agent)).toBe(false);
  });
});

// ZAP baseline findings (#73).
const full = config as unknown as {
  rewrites: { source: string; destination: string }[];
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const headerFor = (source: string, key: string) =>
  full.headers
    .find((rule) => rule.source === source)
    ?.headers.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value;
const spaFallback = full.rewrites.find((rewrite) => rewrite.destination === '/index.html');
const fallsBackToSpa = (path: string) => new RegExp(`^${spaFallback?.source ?? ''}$`).test(path);

describe('static responses', () => {
  it('do not allow every origin to read them', () => {
    expect(headerFor('/(.*)', 'Access-Control-Allow-Origin')).toBe('https://app.acruxanime.com');
  });

  it('cache hashed assets for a year', () => {
    expect(headerFor('/assets/(.*)', 'Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('answer a missing asset with 404, not the SPA', () => {
    expect(fallsBackToSpa('/assets/index-old.js')).toBe(false);
    expect(fallsBackToSpa('/perfil')).toBe(true);
    expect(fallsBackToSpa('/@someone')).toBe(true);
    expect(fallsBackToSpa('/api/me')).toBe(false);
  });
});
