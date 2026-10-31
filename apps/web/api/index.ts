import app from '@acrux/api';

// Vercel function for every /api/* request (rewritten here by vercel.json).
// The Express app keeps the original path, so its routes match /api/... as in local dev.
export default app;
