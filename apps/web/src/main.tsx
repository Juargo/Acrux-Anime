import { reactErrorHandler } from '@sentry/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { App } from './App';
import { createQueryClient } from './anilist/query-client';
import { initErrorTracking } from './error-tracking';
import { signedInRoutes } from './routes/signed-in-routes';
import './styles.css';

initErrorTracking({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_VERCEL_ENV ?? 'development',
});

const queryClient = createQueryClient();
const router = createBrowserRouter([{ path: '/', element: <App />, children: signedInRoutes }]);

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
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
