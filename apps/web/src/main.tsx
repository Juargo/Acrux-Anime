import { reactErrorHandler } from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { initErrorTracking } from './error-tracking';
import { Home } from './routes/Home';

initErrorTracking({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_VERCEL_ENV ?? 'development',
});

const router = createBrowserRouter([{ path: '/', element: <Home /> }]);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const reportReactError = reactErrorHandler();
function onReactError(error: unknown, info: { componentStack?: string | undefined }) {
  reportReactError(error, { componentStack: info.componentStack ?? null });
}

createRoot(root, {
  onUncaughtError: onReactError,
  onCaughtError: onReactError,
  onRecoverableError: onReactError,
}).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
