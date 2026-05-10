/**
 * Server-Side Token Encryption Module
 * 
 * Implements AES-256-GCM encryption using Node.js crypto module.
 * This is the server-side version compatible with the backend implementation.
 * 
 * Note: This module exports utility functions, not Server Actions.
 * These functions can be imported and used in Server Components, Server Actions, and API routes.
 * 
 * @see Frontend implementation: src/lib/crypto.ts
 * @see Backend reference: packages/supabase/src/crypto.ts
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "@/lib/env";

export interface EncryptedToken {
    ciphertext: string; // base64
    iv: string;         // base64
    authTag: string;    // base64
}

/**
 * Encrypt a plaintext token using AES-256-GCM
 * 
 * @param plaintext - The token to encrypt
 * @returns Encrypted token with ciphertext, IV, and auth tag
 * 
 * @example
 * ```typescript
 * const encrypted = encryptToken("my-secret-token");
 * // Store encrypted.ciphertext, encrypted.iv, encrypted.authTag in database
 * ```
 */
export function encryptToken(plaintext: string): EncryptedToken {
    // Generate random 12-byte IV (96 bits) for GCM mode
    const iv = randomBytes(12);

    // Get encryption key from environment (64 hex characters = 32 bytes)
    const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");

    // Create cipher
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    // Encrypt
    let ciphertext = cipher.update(plaintext, "utf8", "base64");
    ciphertext += cipher.final("base64");

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
        ciphertext,
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
    };
}

/**
 * Decrypt an encrypted token using AES-256-GCM
 * 
 * @param ciphertext - Base64-encoded ciphertext
 * @param iv - Base64-encoded initialization vector
 * @param authTag - Base64-encoded authentication tag
 * @returns Decrypted plaintext token
 * 
 * @example
 * ```typescript
 * const plaintext = decryptToken(
 *   encrypted.ciphertext,
 *   encrypted.iv,
 *   encrypted.authTag
 * );
 * ```
 */
export function decryptToken(
    ciphertext: string,
    iv: string,
    authTag: string
): string {
    // Get encryption key from environment
    const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");

    // Decode base64 strings to buffers
    const ivBuffer = Buffer.from(iv, "base64");
    const authTagBuffer = Buffer.from(authTag, "base64");

    // Create decipher
    const decipher = createDecipheriv("aes-256-gcm", key, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    // Decrypt
    let plaintext = decipher.update(ciphertext, "base64", "utf8");
    plaintext += decipher.final("utf8");

    return plaintext;
}
