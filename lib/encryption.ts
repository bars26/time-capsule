// lib/encryption.ts
// AES-256-GCM encryption via the browser's Web Crypto API.
// Zero external dependencies — `crypto.subtle` is built into all modern browsers.
//
// Threat model (V2): protects messages from casual observation via blockchain
// explorers and IPFS gateway browsing. The encryption key travels alongside the
// ciphertext in IPFS, so a determined attacker who can fetch the IPFS blob can
// decrypt. Frontend honors `unlockTime` and `recipient` checks.

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits, recommended length for AES-GCM

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export type EncryptedPayload = {
  ciphertext: string; // base64
  key: string;        // base64 (raw 256-bit AES key)
  iv: string;         // base64 (96-bit IV for GCM)
};

/**
 * Generate a fresh AES-256-GCM key, encrypt the given plaintext, return the
 * ciphertext + key + IV all as base64 strings ready to be JSON-serialized.
 */
export async function encryptMessage(plaintext: string): Promise<EncryptedPayload> {
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintextBytes = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    plaintextBytes,
  );
  const keyBuffer = await crypto.subtle.exportKey("raw", key);

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    key: bufferToBase64(keyBuffer),
    iv: bufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt a payload previously produced by `encryptMessage`.
 */
export async function decryptMessage(payload: EncryptedPayload): Promise<string> {
  const keyBuffer = base64ToBuffer(payload.key);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["decrypt"],
  );

  const ivBuffer = base64ToBuffer(payload.iv);
  const ciphertextBuffer = base64ToBuffer(payload.ciphertext);

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBuffer },
    key,
    ciphertextBuffer,
  );

  return new TextDecoder().decode(plaintextBuffer);
}
