/**
 * Application entrypoint for cPanel / Phusion Passenger / DirectAdmin / Yegara Host.
 *
 * Uses dynamic import() because Phusion Passenger loads this startup file
 * via CommonJS require(). In Node.js v20.20+, synchronous require(esm) fails
 * on packages without a "main" field (like Express). Dynamic import()
 * uses standard asynchronous ESM resolution and boots cleanly.
 */
import('./src/index.js').catch((err) => {
  console.error('❌ Failed to start server:', err);
});
