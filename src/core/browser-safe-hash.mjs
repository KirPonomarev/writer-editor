import hashing from './browser-safe-hash.cjs';

// Existing ESM/browser API shares the same pure implementation as Core CJS.
export const sha256Hex = hashing.sha256Hex;
export const canonicalSerialize = hashing.canonicalSerialize;
export const hashCanonicalValue = hashing.hashCanonicalValue;
