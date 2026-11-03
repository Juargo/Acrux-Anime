import { reactErrorHandler } from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { App } from './App';
import { initErrorTracking } from './error-tracking';
import './styles.css';

initErrorTracking({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_VERCEL_ENV ?? 'development',
});

const router = createBrowserRouter([{ path: '/', element: <App /> }]);

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
    <RouterProvider router={router} />
  </StrictMode>,
);
