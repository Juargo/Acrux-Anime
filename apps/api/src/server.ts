import app from './app.js';

// Local development only; on Vercel the app runs as a function.
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}/api/health`);
});
