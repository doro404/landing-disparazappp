/**
 * Run with: npm run keys:generate
 * Outputs the two lines you need to paste into your .env file.
 */
import { generateKeyPair } from '../services/crypto';

const { privateKey, publicKey } = generateKeyPair();

console.log('\n✅ Ed25519 key pair generated. Add these to your .env:\n');
console.log(`ED25519_PRIVATE_KEY="${privateKey}"`);
console.log(`ED25519_PUBLIC_KEY="${publicKey}"`);
console.log('\n⚠️  Keep the PRIVATE KEY secret. Embed only the PUBLIC KEY in your client app.\n');
