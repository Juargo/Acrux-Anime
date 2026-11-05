import { reactErrorHandler } from '@sentry/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { App } from './App';
import { AnalyticsProvider } from './analytics/AnalyticsContext';
import { createAnalytics, type PostHogLike } from './analytics/analytics';
import { ConsentBanner } from './analytics/ConsentBanner';
import { eventCallbacks } from './analytics/events';
import { onAniListRateLimited } from './anilist/hooks';
import { createQueryClient } from './anilist/query-client';
import { initErrorTracking } from './error-tracking';
import { publicProfileRoute } from './public-profile/routes';
import { signedInRoutes } from './routes/signed-in-routes';
import './styles.css';

initErrorTracking({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_VERCEL_ENV ?? 'development',
});

function localStore(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// PostHog after consent only (#46, ADR-0028); the SDK is its own chunk, loaded on "Aceptar".
const analytics = createAnalytics({
  key: import.meta.env.VITE_POSTHOG_KEY,
  storage: localStore(),
  // The web vitals extension comes from our bundle: remote code stays off (ADR-0028).
  load: () =>
    Promise.all([import('posthog-js'), import('posthog-js/dist/web-vitals')]).then(
      ([module]) => module.default as unknown as PostHogLike,
    ),
  clearCookies: (prefix) => {
    const domain = location.hostname;
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0]?.trim() ?? '';
      if (!name.startsWith(prefix)) continue;
      document.cookie = `${name}=; Max-Age=0; path=/`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${domain}`;
    }
  },
});
const events = eventCallbacks(analytics);
onAniListRateLimited(events.onRateLimited);

const queryClient = createQueryClient();
// The public profile (/@handle) lives outside App, so visitors need no session (RF-40).
const router = createBrowserRouter([
  { path: '/', element: <App />, children: signedInRoutes },
  publicProfileRoute({ onViewed: events.onViewed }),
]);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const reportReactError = reactErrorHandler();
// Custom root handlers replace React's own logging, so it stays here.
function onReactError(error: unknown, info: { componentStack?: string | undefined }) {
  console.error(error);
  reportReactError(error, { componentStack: info.componentStack ?? null });
}

createRoot(root, {
  onUncaughtError: onReactError,
  onCaughtError: onReactError,
  onRecoverableError: onReactError,
}).render(
  <StrictMode>
    <AnalyticsProvider analytics={analytics}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
      <ConsentBanner />
    </AnalyticsProvider>
  </StrictMode>,
);
