/**
 * Vercel serverless entry — same Express app as local `server/src/index.js`.
 * All /api/* requests are rewritten here (see vercel.json).
 */
import app from '../server/src/index.js';

export default app;
