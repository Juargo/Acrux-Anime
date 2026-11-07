// Playwright fixtures of the E2E journeys (ADR-0037). Every context is offline except for
// localhost: AniList and Neon Auth answer from routes, and anything else is aborted, so a
// test never reaches a real service.
import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  test as base,
  expect,
} from '@playwright/test';
import { installAniList } from './anilist.ts';
import { createUser, installNeonAuth, type TestUser } from './neon-auth.ts';

const isLocal = (url: URL) => url.hostname === 'localhost' || url.hostname === '127.0.0.1';

// Web Share is missing in headless browsers anyway; removing it makes every run take the
// download path of RF-31 (@CA-RF31-02).
const withoutWebShare = () => {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
};

async function isolate(context: BrowserContext) {
  // Registered first, so the AniList and Neon Auth routes below take precedence.
  await context.route(
    (url) => !isLocal(url),
    (route) => route.abort(),
  );
  await context.addInitScript(withoutWebShare);
  await installAniList(context);
}

// A browser with no session, on the same phone: someone opening a public link.
export async function visitorContext(browser: Browser) {
  const { defaultBrowserType: _type, ...options } = test.info().project
    .use as BrowserContextOptions & {
    defaultBrowserType?: string;
  };
  const context = await browser.newContext(options);
  await isolate(context);
  await installNeonAuth(context, null);
  return context;
}

export const test = base.extend<{ signedIn: TestUser }>({
  context: async ({ context }, use) => {
    await isolate(context);
    await use(context);
  },
  // A new Neon Auth user per test, signed in less than 24 hours ago.
  signedIn: async ({ context }, use, testInfo) => {
    const user = await createUser(`Camila ${testInfo.workerIndex}`);
    await installNeonAuth(context, user);
    await use(user);
  },
});

export { expect };
