/**
 * Frontend Token Encryption Module
 * 
 * Implements AES-256-GCM encryption using Web Crypto API.
 * Compatible with backend Node.js crypto implementation.
 * 
 * @see Backend implementation: packages/supabase/src/crypto.ts
 */

import { env } from "./env";

export interface EncryptedToken {
    ciphertext: string; // base64
    iv: string;         // base64
    authTag: string;    // base64
}

/**
 * Convert hex string to ArrayBuffer
 * @param hex - 64-character hex string (32 bytes)
 */
function hexToArrayBuffer(hex: string): ArrayBuffer {
    if (hex.length !== 64) {
        throw new Error("Encryption key must be 64 hex characters (32 bytes)");
    }

    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes.buffer;
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Import encryption key from hex string
 */
async function importKey(hexKey: string): Promise<CryptoKey> {
    const keyBuffer = hexToArrayBuffer(hexKey);

    return await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypt a plaintext token using AES-256-GCM
 * 
 * @param plaintext - The token to encrypt
 * @returns Encrypted token with ciphertext, IV, and auth tag
 * 
 * @example
 * ```typescript
 * const encrypted = await encryptToken("my-secret-token");
 * // Store encrypted.ciphertext, encrypted.iv, encrypted.authTag
 * ```
 */
export async function encryptToken(plaintext: string): Promise<EncryptedToken> {
    // Generate random 12-byte IV (96 bits) for GCM mode
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Import the encryption key
    const key = await importKey(env.TOKEN_ENCRYPTION_KEY);

    // Encode plaintext to bytes
    const plaintextBytes = new TextEncoder().encode(plaintext);

    // Encrypt using AES-256-GCM
    // Web Crypto API automatically appends the 16-byte auth tag to the ciphertext
    const encryptedBuffer = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
            tagLength: 128, // 16 bytes = 128 bits
        },
        key,
        plaintextBytes
    );

    // Split the result: last 16 bytes are the auth tag
    const encryptedBytes = new Uint8Array(encryptedBuffer);
    const ciphertextBytes = encryptedBytes.slice(0, -16);
    const authTagBytes = encryptedBytes.slice(-16);

    return {
        ciphertext: arrayBufferToBase64(ciphertextBytes.buffer),
        iv: arrayBufferToBase64(iv.buffer),
        authTag: arrayBufferToBase64(authTagBytes.buffer),
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
 * const plaintext = await decryptToken(
 *   encrypted.ciphertext,
 *   encrypted.iv,
 *   encrypted.authTag
 * );
 * ```
 */
export async function decryptToken(
    ciphertext: string,
    iv: string,
    authTag: string
): Promise<string> {
    // Import the decryption key
    const key = await importKey(env.TOKEN_ENCRYPTION_KEY);

    // Decode base64 strings to ArrayBuffers
    const ivBuffer = base64ToArrayBuffer(iv);
    const ciphertextBuffer = base64ToArrayBuffer(ciphertext);
    const authTagBuffer = base64ToArrayBuffer(authTag);

    // Combine ciphertext and auth tag for Web Crypto API
    // Web Crypto API expects them together
    const ciphertextBytes = new Uint8Array(ciphertextBuffer);
    const authTagBytes = new Uint8Array(authTagBuffer);
    const combined = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
    combined.set(ciphertextBytes, 0);
    combined.set(authTagBytes, ciphertextBytes.length);

    // Decrypt using AES-256-GCM
    const decryptedBuffer = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: ivBuffer,
            tagLength: 128,
        },
        key,
        combined
    );

    // Decode bytes to string
    return new TextDecoder().decode(decryptedBuffer);
}
