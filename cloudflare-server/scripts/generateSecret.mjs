import crypto from 'crypto';

const secret = crypto.randomBytes(32).toString('hex');
console.log('Copy this to Render → BETTER_AUTH_SECRET:');
console.log(secret);
