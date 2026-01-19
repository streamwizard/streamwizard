# Frontend Token Encryption - Usage Guide

## Overview

The frontend crypto module provides AES-256-GCM encryption compatible with your backend implementation. It uses the Web Crypto API for browser-based encryption and decryption.

## Files Created

- [`crypto.ts`](file:///home/jochemwhite/documents/github/streamwizard/streamwizard/src/lib/crypto.ts) - Main crypto module
- [`crypto-examples.ts`](file:///home/jochemwhite/documents/github/streamwizard/streamwizard/src/lib/crypto-examples.ts) - Usage examples and tests
- [`env.ts`](file:///home/jochemwhite/documents/github/streamwizard/streamwizard/src/lib/env.ts) - Updated with encryption key config

## Setup

### 1. Add Encryption Key to Environment

Add the following to your `.env.local` file:

```bash
NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY=your-64-character-hex-key-here
```

> [!IMPORTANT]
> The key must be exactly 64 hex characters (32 bytes). Use the same key as your backend for compatibility.

### 2. Generate Encryption Key (if needed)

If you need to generate a new key:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

## Basic Usage

### Encrypting a Token

```typescript
import { encryptToken } from "@/lib/crypto";

const token = "my-secret-access-token";
const encrypted = await encryptToken(token);

console.log(encrypted);
// {
//   ciphertext: "base64-encoded-ciphertext",
//   iv: "base64-encoded-iv",
//   authTag: "base64-encoded-auth-tag"
// }
```

### Decrypting a Token

```typescript
import { decryptToken } from "@/lib/crypto";

const plaintext = await decryptToken(encrypted.ciphertext, encrypted.iv, encrypted.authTag);

console.log(plaintext); // "my-secret-access-token"
```

## Use Cases

### Use Case 1: Encrypt Before Sending to Backend

```typescript
import { encryptToken } from "@/lib/crypto";

async function saveToken(accessToken: string) {
  const encrypted = await encryptToken(accessToken);

  await fetch("/api/tokens", {
    method: "POST",
    body: JSON.stringify(encrypted),
  });
}
```

### Use Case 2: Decrypt Token from Backend

```typescript
import { decryptToken, type EncryptedToken } from "@/lib/crypto";

async function getToken(): Promise<string> {
  const response = await fetch("/api/tokens");
  const encrypted: EncryptedToken = await response.json();

  return await decryptToken(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
}
```

### Use Case 3: Client-Side Token Storage

```typescript
import { encryptToken, decryptToken } from "@/lib/crypto";

// Store encrypted in localStorage
async function storeToken(token: string) {
  const encrypted = await encryptToken(token);
  localStorage.setItem("token", JSON.stringify(encrypted));
}

// Retrieve and decrypt
async function retrieveToken(): Promise<string | null> {
  const stored = localStorage.getItem("token");
  if (!stored) return null;

  const encrypted = JSON.parse(stored);
  return await decryptToken(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
}
```

## Testing

### Run Examples in Browser Console

```typescript
import { basicExample, testRoundTrip } from "@/lib/crypto-examples";

// Test basic encryption/decryption
await basicExample();

// Test multiple cases
const results = await testRoundTrip();
console.table(results);
```

### Backend Compatibility Test

**Step 1: Backend → Frontend**

1. Use your backend to encrypt a test token:

   ```typescript
   // Backend (Node.js)
   import { encryptToken } from "@repo/supabase/crypto";
   const encrypted = encryptToken("test-token-123");
   console.log(encrypted);
   ```

2. Copy the values and test in frontend:

   ```typescript
   import { testBackendCompatibility } from "@/lib/crypto-examples";

   await testBackendCompatibility(
     {
       ciphertext: "...",
       iv: "...",
       authTag: "...",
     },
     "test-token-123",
   );
   ```

**Step 2: Frontend → Backend**

1. Encrypt on frontend:

   ```typescript
   import { encryptToken } from "@/lib/crypto";
   const encrypted = await encryptToken("test-token-456");
   console.log(encrypted);
   ```

2. Decrypt on backend:
   ```typescript
   // Backend (Node.js)
   import { decryptToken } from "@repo/supabase/crypto";
   const plaintext = decryptToken(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
   console.log(plaintext); // Should be "test-token-456"
   ```

## Security Considerations

> [!WARNING]
> **Key Exposure**: The encryption key is exposed in the frontend as `NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY`. This means:
>
> - Anyone can view the key in browser DevTools
> - Anyone can decrypt tokens encrypted with this key
> - This is suitable for obfuscation, not true security

> [!CAUTION]
> **When to Use Frontend Encryption**:
>
> - ✅ Obfuscating tokens in localStorage
> - ✅ Encrypting before sending to backend (if backend also validates)
> - ❌ Protecting truly sensitive data (use server-side only)
> - ❌ Replacing proper authentication/authorization

## API Reference

### `encryptToken(plaintext: string): Promise<EncryptedToken>`

Encrypts a plaintext string using AES-256-GCM.

**Parameters:**

- `plaintext` - The string to encrypt

**Returns:**

- `Promise<EncryptedToken>` - Object with `ciphertext`, `iv`, and `authTag` (all base64-encoded)

**Throws:**

- Error if encryption key is invalid or encryption fails

---

### `decryptToken(ciphertext: string, iv: string, authTag: string): Promise<string>`

Decrypts an encrypted token using AES-256-GCM.

**Parameters:**

- `ciphertext` - Base64-encoded ciphertext
- `iv` - Base64-encoded initialization vector
- `authTag` - Base64-encoded authentication tag

**Returns:**

- `Promise<string>` - Decrypted plaintext

**Throws:**

- Error if decryption fails (invalid key, corrupted data, or tampered ciphertext)

---

### `EncryptedToken` Interface

```typescript
interface EncryptedToken {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}
```

## Troubleshooting

### Error: "Encryption key must be 64 hex characters"

The `NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY` must be exactly 64 hexadecimal characters (0-9, a-f). Generate a new one:

```bash
openssl rand -hex 32
```

### Error: "Operation failed" during decryption

This usually means:

- Wrong encryption key
- Corrupted or tampered ciphertext
- Invalid base64 encoding
- Mismatched IV or auth tag

### Tokens encrypted on backend won't decrypt on frontend

Ensure:

- Same encryption key on both sides
- Backend uses the crypto module from `packages/supabase/src/crypto.ts`
- All values are properly base64-encoded
- No whitespace or encoding issues in the values
